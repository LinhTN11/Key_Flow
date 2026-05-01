import type { Pattern, PatternEvent } from '../types';
import { normalizeDurationTolerancePct } from './patternUtils';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isPatternEvent(value: unknown): value is PatternEvent {
    if (!isRecord(value)) return false;

    return typeof value.id === 'string'
        && typeof value.key === 'string'
        && typeof value.displayLabel === 'string'
        && isFiniteNumber(value.startTime)
        && isFiniteNumber(value.endTime)
        && isFiniteNumber(value.duration)
        && isFiniteNumber(value.timingToleranceMs)
        && isFiniteNumber(value.durationTolerancePct)
        && value.startTime >= 0
        && value.endTime >= value.startTime
        && value.duration >= 0;
}

function readStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string') : [];
}

export type ImportedPattern = Omit<Pattern, 'id' | 'createdAt' | 'updatedAt'>;

function parsePatternData(data: unknown): ImportedPattern {
    if (!isRecord(data) || typeof data.name !== 'string' || !Array.isArray(data.events)) {
        throw new Error('Invalid format');
    }

    const events = data.events;
    if (!events.every(isPatternEvent)) {
        throw new Error('Invalid event data');
    }
    const normalizedEvents = events.map((event) => ({
        ...event,
        durationTolerancePct: normalizeDurationTolerancePct(event.durationTolerancePct),
    }));

    return {
        name: data.name,
        description: typeof data.description === 'string' ? data.description : '',
        game: typeof data.game === 'string' ? data.game : '',
        character: typeof data.character === 'string' ? data.character : '',
        tags: readStringArray(data.tags),
        totalDuration: isFiniteNumber(data.totalDuration)
            ? data.totalDuration
            : normalizedEvents.reduce((max, event) => Math.max(max, event.endTime), 0),
        events: normalizedEvents,
    };
}

export function parsePatternImport(text: string): ImportedPattern {
    return parsePatternData(JSON.parse(text) as unknown);
}

export function parsePatternImportFile(text: string): ImportedPattern[] {
    const data = JSON.parse(text) as unknown;
    if (isRecord(data) && Array.isArray(data.patterns)) {
        if (data.patterns.length === 0) throw new Error('Pattern pack is empty');
        return data.patterns.map(parsePatternData);
    }

    return [parsePatternData(data)];
}

export function createPatternPack(patterns: Pattern[]) {
    return {
        format: 'keyflow-pattern-pack',
        version: 1,
        exportedAt: Date.now(),
        patterns: patterns.map(({ name, description, game, character, tags, totalDuration, events }) => ({
            name,
            description,
            game,
            character,
            tags,
            totalDuration,
            events,
        })),
    };
}
