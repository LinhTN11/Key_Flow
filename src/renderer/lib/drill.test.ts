import { describe, expect, test } from 'vitest';
import type { ErrorItem, Pattern } from '../types';
import { createDrillPattern, getDrillableEventIds } from './drill';

const pattern: Pattern = {
    id: 'combo-1',
    name: 'Full combo',
    description: '',
    game: '',
    character: '',
    tags: ['test'],
    totalDuration: 600,
    createdAt: 0,
    updatedAt: 0,
    events: [0, 200, 400].map((start, index) => ({
        id: `event-${index + 1}`,
        key: `Key${index + 1}`,
        displayLabel: `${index + 1}`,
        startTime: start,
        endTime: start + 100,
        duration: 100,
        timingToleranceMs: 50,
        durationTolerancePct: 0.2,
    })),
};

const error: ErrorItem = {
    type: 'timing_late',
    severity: 'minor',
    key: 'Key2',
    message: '',
    suggestion: '',
    occurrences: 1,
    eventId: 'event-2',
};

describe('drill patterns', () => {
    test('extracts drillable event IDs', () => {
        expect(getDrillableEventIds([
            error,
            { ...error, eventId: 'event-2' },
            { ...error, eventId: 'drill-event-2' },
            { ...error, eventId: undefined },
        ])).toEqual(['event-2']);
    });

    test('creates a normalized drill pattern with context', () => {
        const drill = createDrillPattern(pattern, [error]);

        expect(drill?.id).toBe('combo-1');
        expect(drill?.name).toBe('Full combo - Drill');
        expect(drill?.tags).toContain('drill');
        expect(drill?.events.map((event) => event.id)).toEqual(['drill-event-1', 'drill-event-2', 'drill-event-3']);
        expect(drill?.events[0].startTime).toBe(0);
        expect(drill?.totalDuration).toBe(500);
    });

    test('does not keep appending drill metadata when drilling a drill pattern', () => {
        const firstDrill = createDrillPattern(pattern, [error]);
        const secondDrill = createDrillPattern(firstDrill!, [{ ...error, eventId: 'drill-event-2' }]);

        expect(secondDrill?.name).toBe('Full combo - Drill');
        expect(secondDrill?.tags.filter((tag) => tag === 'drill')).toHaveLength(1);
        expect(secondDrill?.events.map((event) => event.id)).toEqual(['drill-event-1', 'drill-event-2', 'drill-event-3']);
    });

    test('returns null when errors do not point to pattern events', () => {
        expect(createDrillPattern(pattern, [{ ...error, eventId: undefined }])).toBeNull();
    });
});
