import { describe, expect, test } from 'vitest';
import type { Attempt, Pattern } from '../types';
import { buildMatchResults } from './scoring';

const pattern: Pattern = {
    id: 'pattern-1',
    name: 'Offset check',
    description: '',
    game: '',
    character: '',
    tags: [],
    totalDuration: 1000,
    createdAt: 0,
    updatedAt: 0,
    events: [
        {
            id: 'event-1',
            key: 'KeyA',
            displayLabel: 'A',
            startTime: 100,
            endTime: 160,
            duration: 60,
            timingToleranceMs: 30,
            durationTolerancePct: 0.2,
        },
    ],
};

const attempt: Attempt = {
    id: 'attempt-1',
    sessionId: 'session-1',
    patternId: 'pattern-1',
    startTime: 0,
    endTime: 60,
    presses: [
        {
            id: 'press-1',
            key: 'KeyA',
            keyCode: 0,
            startTime: 0,
            endTime: 60,
            duration: 60,
            sessionId: 'session-1',
        },
    ],
    result: null,
};

describe('buildMatchResults', () => {
    test('applies timing offset during matching', () => {
        expect(buildMatchResults(pattern, attempt)[0].timingDeltaMs).toBe(0);
        expect(buildMatchResults(pattern, attempt, 40)[0]).toMatchObject({
            status: 'late',
            timingDeltaMs: 40,
        });
        expect(buildMatchResults(pattern, attempt, -40)[0]).toMatchObject({
            status: 'early',
            timingDeltaMs: -40,
        });
    });
});
