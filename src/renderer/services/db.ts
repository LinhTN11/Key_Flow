/**
 * db.ts — Database service for Tauri using tauri-plugin-sql.
 * Mirrors the DatabaseService API from Electron but runs in the renderer.
 */

import Database from '@tauri-apps/plugin-sql';
import type { Pattern, Session, Attempt, AppSettings } from '../types';

let db: Database | null = null;

const DEFAULT_SETTINGS: AppSettings = {
    keyboardLayout: 'full',
    showMouseButtons: true,
    keyHighlightColor: '#6366f1',
    defaultZoomMs: 5000,
    ganttRowHeight: 28,
    ganttBarColor: '#6366f1',
    patternBarColor: '#4b5563',
    defaultTimingToleranceMs: 80,
    autoStartComparison: false,
    showRealtimeOverlay: true,
    enableMetronome: false,
    metronomeIntervalMs: 500,
    language: 'vi', // Default to Vietnamese for this version
};

export async function getDb() {
    if (db) return db;
    
    // Load database (creates it if missing)
    db = await Database.load('sqlite:keyflow.db');
    
    // Initialize Tables
    await db.execute(`
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
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            pattern_id TEXT,
            start_time INTEGER NOT NULL,
            end_time INTEGER,
            status TEXT NOT NULL DEFAULT 'idle'
        );

        CREATE TABLE IF NOT EXISTS attempts (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            pattern_id TEXT NOT NULL,
            start_time INTEGER NOT NULL,
            end_time INTEGER NOT NULL,
            presses TEXT NOT NULL,
            result TEXT,
            FOREIGN KEY (session_id) REFERENCES sessions(id)
        );

        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            data TEXT NOT NULL
        );
    `);

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
    const rows = await db.select<any[]>('SELECT * FROM patterns ORDER BY updated_at DESC');
    
    return rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        game: row.game,
        character: row.character,
        tags: JSON.parse(row.tags),
        totalDuration: row.total_duration,
        events: JSON.parse(row.events),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }));
}

export async function updatePattern(id: string, data: Partial<Pattern>): Promise<Pattern> {
    const db = await getDb();
    const existingRows = await db.select<any[]>('SELECT * FROM patterns WHERE id = ?', [id]);
    if (existingRows.length === 0) throw new Error(`Pattern ${id} not found`);
    
    const existing = {
        ...existingRows[0],
        tags: JSON.parse(existingRows[0].tags),
        events: JSON.parse(existingRows[0].events),
        totalDuration: existingRows[0].total_duration,
        createdAt: existingRows[0].created_at,
        updatedAt: existingRows[0].updated_at
    };

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
    await db.execute('DELETE FROM patterns WHERE id = ?', [id]);
}

// ─── Settings ──────────────────────────────────────────────

export async function getSettings(): Promise<AppSettings> {
    const db = await getDb();
    const rows = await db.select<{ data: string }[]>('SELECT data FROM settings WHERE id = 1');
    return JSON.parse(rows[0].data);
}

export async function setSettings(data: Partial<AppSettings>): Promise<AppSettings> {
    const db = await getDb();
    const current = await getSettings();
    const merged = { ...current, ...data };
    await db.execute('UPDATE settings SET data = ? WHERE id = 1', [JSON.stringify(merged)]);
    return merged;
}
