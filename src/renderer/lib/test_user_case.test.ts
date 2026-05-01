import { expect, test } from 'vitest';
import * as fs from 'fs';
import { buildMatchResults, calculateScore } from './scoring';
import { analyzeErrors } from './errorAnalysis';
import type { Pattern, Attempt } from '../types';

interface AttemptFixture {
    totalDuration: number;
    events: Array<{
        id: string;
        key: string;
        startTime: number;
        endTime: number;
        duration: number;
    }>;
}

test('Test User Real Data against New Algorithm', () => {
    // Read the JSON files provided by the user
    // The working dir for vitest is the keyflow root
    const patternPath = 'C:\\Users\\trann\\Downloads\\NohBoard vjp\\Hutao_combo.json';
    const attemptPath = 'C:\\Users\\trann\\Downloads\\NohBoard vjp\\test_combo.json';

    if (!fs.existsSync(patternPath)) return;
    if (!fs.existsSync(attemptPath)) return;

    const pattern = JSON.parse(fs.readFileSync(patternPath, 'utf-8')) as Pattern;
    const testJson = JSON.parse(fs.readFileSync(attemptPath, 'utf-8')) as AttemptFixture;

    // Map the testJson.events into an Attempt.presses format
    const attempt: Attempt = {
        id: 'attempt1',
        sessionId: 'session1',
        patternId: pattern.id,
        startTime: 0,
        endTime: testJson.totalDuration,
        presses: testJson.events.map((e) => ({
            id: e.id,
            key: e.key,
            keyCode: 0,
            startTime: e.startTime,
            endTime: e.endTime,
            duration: e.duration,
            sessionId: 'session1'
        })),
        result: null
    };

    const eventResults = buildMatchResults(pattern, attempt);
    const score = calculateScore(pattern, attempt, eventResults);
    const errors = analyzeErrors(pattern, attempt, eventResults);

    console.log('\n========= MATCH RESULTS =========\n');
    eventResults.forEach(r => {
        const pe = pattern.events.find(e => e.id === r.patternEventId);
        console.log(`Event [${pe?.displayLabel}] (tolerance: ${pe?.timingToleranceMs}ms) -> Status: ${r.status.toUpperCase()} | Timing Delta: ${r.timingDeltaMs}ms | Duration Delta: ${r.durationDeltaMs}ms`);
    });

    console.log('\n========= SCORES =========\n');
    console.log(JSON.stringify(score, null, 2));

    console.log('\n========= ERRORS FOUND =========\n');
    errors.forEach(e => {
        console.log(`[${e.severity.toUpperCase()}] ${e.type} (${e.key}): ${e.message} -> ${e.suggestion}`);
    });
    console.log('\n=================================\n');

    expect(true).toBe(true);
});
