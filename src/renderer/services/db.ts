/**
 * db.ts — Database service for Tauri using tauri-plugin-sql.
 * Mirrors the DatabaseService API from Electron but runs in the renderer.
 */

import Database from '@tauri-apps/plugin-sql';
import type { AppSettings, Attempt, Pattern, PatternStats, PracticeHistoryItem, Session } from '../types';
import { DEFAULT_SETTINGS, mergeSettings } from '../lib/settings';
import { normalizeDurationTolerancePct } from '../lib/patternUtils';

let db: Database | null = null;
const SCHEMA_VERSION = 1;

interface PatternRow {
    id: string;
    name: string;
    description: string;
    game: string;
    character: string;
    tags: string;
    total_duration: number;
    events: string;
    created_at: number;
    updated_at: number;
}

interface SessionRow {
    id: string;
    pattern_id: string | null;
    start_time: number;
    end_time: number | null;
    status: Session['status'];
}

interface AttemptRow {
    id: string;
    session_id: string;
    pattern_id: string;
    start_time: number;
    end_time: number;
    presses: string;
    result: string | null;
}

interface PracticeHistoryRow extends AttemptRow {
    pattern_name: string | null;
    game: string | null;
    character: string | null;
    session_start_time: number;
}

interface PatternStatsRow {
    pattern_id: string;
    end_time: number;
    result: string;
}

type Migration = (database: Database) => Promise<void>;

export interface AppBackup {
    format: 'keyflow-app-backup';
    version: 1;
    exportedAt: number;
    settings: AppSettings;
    patterns: Pattern[];
    sessions: Array<Omit<Session, 'attempts'>>;
    attempts: Attempt[];
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
    if (!value) return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

function mapPattern(row: PatternRow): Pattern {
    const events = parseJson<Pattern['events']>(row.events, []).map((event) => ({
        ...event,
        durationTolerancePct: normalizeDurationTolerancePct(event.durationTolerancePct),
    }));

    return {
        id: row.id,
        name: row.name,
        description: row.description,
        game: row.game,
        character: row.character,
        tags: parseJson<string[]>(row.tags, []),
        totalDuration: row.total_duration,
        events,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function mapSession(row: SessionRow, attempts: Attempt[] = []): Session {
    return {
        id: row.id,
        patternId: row.pattern_id,
        startTime: row.start_time,
        endTime: row.end_time,
        status: row.status,
        attempts,
    };
}

function mapAttempt(row: AttemptRow): Attempt {
    return {
        id: row.id,
        sessionId: row.session_id,
        patternId: row.pattern_id,
        startTime: row.start_time,
        endTime: row.end_time,
        presses: parseJson<Attempt['presses']>(row.presses, []),
        result: parseJson<Attempt['result']>(row.result, null),
    };
}

function mapPracticeHistoryItem(row: PracticeHistoryRow): PracticeHistoryItem {
    return {
        attempt: mapAttempt(row),
        patternName: row.pattern_name ?? 'Deleted combo',
        game: row.game ?? '',
        character: row.character ?? '',
        sessionStartTime: row.session_start_time,
    };
}

const migrations: Record<number, Migration> = {
    1: async (database) => {
        await database.execute(`
            CREATE TABLE IF NOT EXISTS patterns (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                game TEXT DEFAULT '',
                character TEXT DEFAULT '',
                tags TEXT DEFAULT '[]',
                total_duration INTEGER NOT NULL,
                events TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `);

        await database.execute(`
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                pattern_id TEXT,
                start_time INTEGER NOT NULL,
                end_time INTEGER,
                status TEXT NOT NULL DEFAULT 'idle',
                FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE SET NULL
            )
        `);

        await database.execute(`
            CREATE TABLE IF NOT EXISTS attempts (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                pattern_id TEXT NOT NULL,
                start_time INTEGER NOT NULL,
                end_time INTEGER NOT NULL,
                presses TEXT NOT NULL,
                result TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
                FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
            )
        `);

        await database.execute(`
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY DEFAULT 1,
                data TEXT NOT NULL
            )
        `);

        await database.execute('CREATE INDEX IF NOT EXISTS idx_patterns_updated_at ON patterns(updated_at)');
        await database.execute('CREATE INDEX IF NOT EXISTS idx_sessions_pattern_id ON sessions(pattern_id)');
        await database.execute('CREATE INDEX IF NOT EXISTS idx_attempts_session_id ON attempts(session_id)');
        await database.execute('CREATE INDEX IF NOT EXISTS idx_attempts_pattern_id ON attempts(pattern_id)');
    },
};

async function getSchemaVersion(database: Database): Promise<number> {
    const rows = await database.select<Array<{ user_version: number }>>('PRAGMA user_version');
    return rows[0]?.user_version ?? 0;
}

async function migrate(database: Database) {
    const currentVersion = await getSchemaVersion(database);
    if (currentVersion > SCHEMA_VERSION) {
        throw new Error(`Database schema version ${currentVersion} is newer than app schema ${SCHEMA_VERSION}`);
    }

    for (let version = currentVersion + 1; version <= SCHEMA_VERSION; version += 1) {
        const migration = migrations[version];
        if (!migration) throw new Error(`Missing database migration ${version}`);

        await database.execute('BEGIN');
        try {
            await migration(database);
            await database.execute(`PRAGMA user_version = ${version}`);
            await database.execute('COMMIT');
        } catch (error) {
            await database.execute('ROLLBACK');
            throw error;
        }
    }
}

export async function getDb() {
    if (db) return db;
    
    // Load database (creates it if missing)
    db = await Database.load('sqlite:keyflow.db');
    await db.execute('PRAGMA foreign_keys = ON');
    await migrate(db);

    // Ensure default settings
    const settings = await db.select<{ data: string }[]>('SELECT data FROM settings WHERE id = 1');
    if (settings.length === 0) {
        await db.execute('INSERT INTO settings (id, data) VALUES (1, ?)', [JSON.stringify(DEFAULT_SETTINGS)]);
    }

    return db;
}

// ─── Pattern CRUD ──────────────────────────────────────────

export async function createPattern(data: Omit<Pattern, 'id' | 'createdAt' | 'updatedAt'>): Promise<Pattern> {
    const db = await getDb();
    const id = crypto.randomUUID();
    const now = Date.now();
    
    await db.execute(
        `INSERT INTO patterns (id, name, description, game, character, tags, total_duration, events, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id, 
            data.name, 
            data.description, 
            data.game, 
            data.character, 
            JSON.stringify(data.tags), 
            data.totalDuration, 
            JSON.stringify(data.events), 
            now, 
            now
        ]
    );
    
    return { ...data, id, createdAt: now, updatedAt: now };
}

export async function getAllPatterns(): Promise<Pattern[]> {
    const db = await getDb();
    const rows = await db.select<PatternRow[]>('SELECT * FROM patterns ORDER BY updated_at DESC');
    return rows.map(mapPattern);
}

export async function updatePattern(id: string, data: Partial<Pattern>): Promise<Pattern> {
    const db = await getDb();
    const existingRows = await db.select<PatternRow[]>('SELECT * FROM patterns WHERE id = ?', [id]);
    if (existingRows.length === 0) throw new Error(`Pattern ${id} not found`);
    
    const existing = mapPattern(existingRows[0]);

    const updated = { ...existing, ...data, updatedAt: Date.now() };
    
    await db.execute(
        `UPDATE patterns SET name=?, description=?, game=?, character=?, tags=?, total_duration=?, events=?, updated_at=?
         WHERE id=?`,
        [
            updated.name, 
            updated.description, 
            updated.game, 
            updated.character, 
            JSON.stringify(updated.tags), 
            updated.totalDuration, 
            JSON.stringify(updated.events), 
            updated.updatedAt, 
            id
        ]
    );
    
    return updated as Pattern;
}

export async function deletePattern(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM attempts WHERE pattern_id = ?', [id]);
    await db.execute('UPDATE sessions SET pattern_id = NULL WHERE pattern_id = ?', [id]);
    await db.execute('DELETE FROM patterns WHERE id = ?', [id]);
}

// ─── Session / Attempt CRUD ───────────────────────────────────────────────

export async function createSession(patternId: string | null): Promise<Session> {
    const db = await getDb();
    const id = crypto.randomUUID();
    const now = Date.now();

    await db.execute(
        `INSERT INTO sessions (id, pattern_id, start_time, end_time, status)
         VALUES (?, ?, ?, ?, ?)`,
        [id, patternId, now, null, 'recording']
    );

    return {
        id,
        patternId,
        startTime: now,
        endTime: null,
        status: 'recording',
        attempts: [],
    };
}

export async function endSession(id: string): Promise<Session | null> {
    const db = await getDb();
    const now = Date.now();

    await db.execute(
        'UPDATE sessions SET end_time = ?, status = ? WHERE id = ?',
        [now, 'completed', id]
    );

    const rows = await db.select<SessionRow[]>('SELECT * FROM sessions WHERE id = ?', [id]);
    if (rows.length === 0) return null;

    const attempts = await getAttemptsForSession(id);
    return mapSession(rows[0], attempts);
}

export async function createAttempt(data: Attempt): Promise<Attempt> {
    const db = await getDb();

    await db.execute(
        `INSERT INTO attempts (id, session_id, pattern_id, start_time, end_time, presses, result)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            data.id,
            data.sessionId,
            data.patternId,
            data.startTime,
            data.endTime,
            JSON.stringify(data.presses),
            data.result ? JSON.stringify(data.result) : null,
        ]
    );

    return data;
}

export async function getAttemptsForSession(sessionId: string): Promise<Attempt[]> {
    const db = await getDb();
    const rows = await db.select<AttemptRow[]>(
        'SELECT * FROM attempts WHERE session_id = ? ORDER BY start_time ASC',
        [sessionId]
    );
    return rows.map(mapAttempt);
}

export async function getPracticeHistory(limit = 100): Promise<PracticeHistoryItem[]> {
    const db = await getDb();
    const rows = await db.select<PracticeHistoryRow[]>(
        `SELECT
            attempts.*,
            patterns.name AS pattern_name,
            patterns.game AS game,
            patterns.character AS character,
            sessions.start_time AS session_start_time
         FROM attempts
         LEFT JOIN patterns ON patterns.id = attempts.pattern_id
         LEFT JOIN sessions ON sessions.id = attempts.session_id
         WHERE attempts.result IS NOT NULL
         ORDER BY attempts.end_time DESC
         LIMIT ?`,
        [limit]
    );
    return rows.map(mapPracticeHistoryItem);
}

// ─── Settings ──────────────────────────────────────────────

export async function getPatternStats(): Promise<Record<string, PatternStats>> {
    const db = await getDb();
    const rows = await db.select<PatternStatsRow[]>(
        `SELECT pattern_id, end_time, result
         FROM attempts
         WHERE result IS NOT NULL
         ORDER BY end_time DESC`
    );

    const stats: Record<string, PatternStats> = {};

    for (const row of rows) {
        const result = parseJson<Attempt['result']>(row.result, null);
        if (!result) continue;

        const current = stats[row.pattern_id] ?? {
            patternId: row.pattern_id,
            attemptCount: 0,
            bestScore: 0,
            averageScore: 0,
            lastAttemptAt: null,
        };

        current.attemptCount += 1;
        current.bestScore = Math.max(current.bestScore, result.overallScore);
        current.averageScore += result.overallScore;
        current.lastAttemptAt = Math.max(current.lastAttemptAt ?? 0, row.end_time);
        stats[row.pattern_id] = current;
    }

    for (const stat of Object.values(stats)) {
        stat.averageScore = Math.round(stat.averageScore / stat.attemptCount);
    }

    return stats;
}

export async function getSettings(): Promise<AppSettings> {
    const db = await getDb();
    const rows = await db.select<{ data: string }[]>('SELECT data FROM settings WHERE id = 1');
    if (rows.length === 0) {
        const defaults = mergeSettings(null);
        await db.execute('INSERT INTO settings (id, data) VALUES (1, ?)', [JSON.stringify(defaults)]);
        return defaults;
    }

    const parsed = parseJson<unknown>(rows[0].data, null);
    if (!parsed) {
        const defaults = mergeSettings(null);
        await db.execute('UPDATE settings SET data = ? WHERE id = 1', [JSON.stringify(defaults)]);
        return defaults;
    }

    return mergeSettings(parsed);
}

export async function setSettings(data: Partial<AppSettings>): Promise<AppSettings> {
    const db = await getDb();
    const current = await getSettings();
    const merged = mergeSettings({ ...current, ...data });
    await db.execute(
        `INSERT INTO settings (id, data) VALUES (1, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
        [JSON.stringify(merged)]
    );
    return merged;
}

export async function createAppBackup(): Promise<AppBackup> {
    const db = await getDb();
    const patterns = await getAllPatterns();
    const sessionRows = await db.select<SessionRow[]>('SELECT * FROM sessions ORDER BY start_time ASC');
    const attemptRows = await db.select<AttemptRow[]>('SELECT * FROM attempts ORDER BY end_time ASC');

    return {
        format: 'keyflow-app-backup',
        version: 1,
        exportedAt: Date.now(),
        settings: await getSettings(),
        patterns,
        sessions: sessionRows.map((row) => ({
            id: row.id,
            patternId: row.pattern_id,
            startTime: row.start_time,
            endTime: row.end_time,
            status: row.status,
        })),
        attempts: attemptRows.map(mapAttempt),
    };
}

export async function importAppBackup(backup: AppBackup): Promise<{ patterns: number; sessions: number; attempts: number }> {
    const db = await getDb();
    const settings = mergeSettings(backup.settings);

    await db.execute('BEGIN');
    try {
        for (const pattern of backup.patterns) {
            await db.execute(
                `INSERT INTO patterns (id, name, description, game, character, tags, total_duration, events, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    game = excluded.game,
                    character = excluded.character,
                    tags = excluded.tags,
                    total_duration = excluded.total_duration,
                    events = excluded.events,
                    updated_at = excluded.updated_at`,
                [
                    pattern.id,
                    pattern.name,
                    pattern.description,
                    pattern.game,
                    pattern.character,
                    JSON.stringify(pattern.tags),
                    pattern.totalDuration,
                    JSON.stringify(pattern.events),
                    pattern.createdAt,
                    pattern.updatedAt,
                ]
            );
        }

        for (const session of backup.sessions) {
            await db.execute(
                `INSERT INTO sessions (id, pattern_id, start_time, end_time, status)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                    pattern_id = excluded.pattern_id,
                    start_time = excluded.start_time,
                    end_time = excluded.end_time,
                    status = excluded.status`,
                [session.id, session.patternId, session.startTime, session.endTime, session.status]
            );
        }

        for (const attempt of backup.attempts) {
            await db.execute(
                `INSERT INTO attempts (id, session_id, pattern_id, start_time, end_time, presses, result)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                    session_id = excluded.session_id,
                    pattern_id = excluded.pattern_id,
                    start_time = excluded.start_time,
                    end_time = excluded.end_time,
                    presses = excluded.presses,
                    result = excluded.result`,
                [
                    attempt.id,
                    attempt.sessionId,
                    attempt.patternId,
                    attempt.startTime,
                    attempt.endTime,
                    JSON.stringify(attempt.presses),
                    attempt.result ? JSON.stringify(attempt.result) : null,
                ]
            );
        }

        await db.execute(
            `INSERT INTO settings (id, data) VALUES (1, ?)
             ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
            [JSON.stringify(settings)]
        );

        await db.execute('COMMIT');
        return {
            patterns: backup.patterns.length,
            sessions: backup.sessions.length,
            attempts: backup.attempts.length,
        };
    } catch (error) {
        await db.execute('ROLLBACK');
        throw error;
    }
}
