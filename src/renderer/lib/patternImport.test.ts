import { describe, expect, test } from 'vitest';
import { createPatternPack, parsePatternImport, parsePatternImportFile } from './patternImport';

const validEvent = {
    id: 'event-1',
    key: 'a',
    displayLabel: 'A',
    startTime: 100,
    endTime: 220,
    duration: 120,
    timingToleranceMs: 80,
    durationTolerancePct: 25,
};
const normalizedEvent = {
    ...validEvent,
    durationTolerancePct: 0.25,
};

describe('parsePatternImport', () => {
    test('normalizes a valid imported pattern', () => {
        const pattern = parsePatternImport(JSON.stringify({
            name: 'Dash cancel',
            description: 'Practice opener',
            game: 'Fighting Game',
            character: 'Runner',
            tags: ['dash', 12, 'starter', null],
            events: [validEvent],
        }));

        expect(pattern).toEqual({
            name: 'Dash cancel',
            description: 'Practice opener',
            game: 'Fighting Game',
            character: 'Runner',
            tags: ['dash', 'starter'],
            totalDuration: 220,
            events: [normalizedEvent],
        });
    });

    test('preserves explicit finite total duration', () => {
        const pattern = parsePatternImport(JSON.stringify({
            name: 'Timed combo',
            totalDuration: 1000,
            events: [validEvent],
        }));

        expect(pattern.totalDuration).toBe(1000);
    });

    test('rejects malformed event data', () => {
        expect(() => parsePatternImport(JSON.stringify({
            name: 'Broken combo',
            events: [{ ...validEvent, endTime: 50 }],
        }))).toThrow('Invalid event data');
    });

    test('rejects non-pattern JSON', () => {
        expect(() => parsePatternImport(JSON.stringify({ name: 'No events' }))).toThrow('Invalid format');
    });

    test('imports a pattern pack', () => {
        const patterns = parsePatternImportFile(JSON.stringify({
            format: 'keyflow-pattern-pack',
            version: 1,
            patterns: [
                { name: 'One', events: [validEvent] },
                { name: 'Two', events: [{ ...validEvent, id: 'event-2' }] },
            ],
        }));

        expect(patterns).toHaveLength(2);
        expect(patterns.map((pattern) => pattern.name)).toEqual(['One', 'Two']);
    });

    test('exports a pattern pack without database metadata', () => {
        const pack = createPatternPack([{
            id: 'db-id',
            name: 'Pack item',
            description: '',
            game: '',
            character: '',
            tags: [],
            totalDuration: 220,
            events: [validEvent],
            createdAt: 1,
            updatedAt: 2,
        }]);

        expect(pack.patterns[0]).not.toHaveProperty('id');
        expect(pack.patterns[0]).not.toHaveProperty('createdAt');
        expect(pack.patterns[0].name).toBe('Pack item');
    });
});
