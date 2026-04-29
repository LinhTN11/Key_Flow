import { expect, test, describe } from 'vitest';
import { buildMatchResults } from './scoring';
import type { Pattern, Attempt, EventMatchResult } from '../types';

// ==========================================
// LEGACY CODE FOR COMPARISON
// ==========================================
function distance(a: any, b: any): number {
    if (a.key !== b.key) return 100000;
    let timingWeight = 0.7;
    let timingDiff = b.normalizedStartTime - a.normalizedStartTime;
    if (timingDiff < 0) {
        timingDiff = Math.abs(timingDiff) * 3.0;
    } else {
        timingDiff = Math.abs(timingDiff);
    }
    const durationDiff = Math.abs(a.normalizedDuration - b.normalizedDuration);
    return timingDiff * timingWeight + durationDiff * (1 - timingWeight);
}

function computeDTW(pattern: any[], input: any[]) {
    const n = pattern.length;
    const m = input.length;
    if (n === 0 || m === 0) return { distance: Infinity, path: [] };
    const dtw: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(Infinity));
    dtw[0][0] = 0;
    const GAP_COST = 800;
    for (let i = 1; i <= n; i++) dtw[i][0] = i * GAP_COST;
    for (let j = 1; j <= m; j++) dtw[0][j] = j * GAP_COST;
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const cost = distance(pattern[i - 1], input[j - 1]);
            dtw[i][j] = Math.min(dtw[i - 1][j] + GAP_COST, dtw[i][j - 1] + GAP_COST, dtw[i - 1][j - 1] + cost);
        }
    }
    const path: [number, number][] = [];
    let i = n; let j = m;
    if (dtw[n][m] === Infinity) return { distance: Infinity, path: [] };
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0) {
            const current = dtw[i][j];
            const cost = distance(pattern[i - 1], input[j - 1]);
            const diag = dtw[i - 1][j - 1] + cost;
            const up = dtw[i - 1][j] + GAP_COST;
            const left = dtw[i][j - 1] + GAP_COST;
            const minVal = Math.min(diag, up, left);
            if (minVal === diag) {
                path.unshift([i - 1, j - 1]);
                i--; j--;
            } else if (minVal === up) {
                i--;
            } else {
                j--;
            }
        } else if (i > 0) {
            i--;
        } else if (j > 0) {
            j--;
        }
    }
    return { distance: dtw[n][m], path };
}

function toFeatureVectors(events: any[], totalDuration: number) {
    if (totalDuration === 0) return [];
    return events.map((e) => ({
        key: e.key,
        normalizedStartTime: e.startTime / totalDuration,
        normalizedDuration: ((e.duration ?? 100) / totalDuration),
    }));
}

function buildMatchResultsOld(pattern: Pattern, attempt: Attempt, dtwPath: [number, number][]): EventMatchResult[] {
    const results: EventMatchResult[] = [];
    const usedInputIndices = new Set<number>();
    const pOffset = pattern.events.length > 0 ? pattern.events[0].startTime : 0;
    const aOffset = attempt.presses.length > 0 ? attempt.presses[0].startTime : 0;
    const pathMap = new Map<number, number[]>();
    for (const [pIdx, iIdx] of dtwPath) {
        if (!pathMap.has(pIdx)) pathMap.set(pIdx, []);
        pathMap.get(pIdx)!.push(iIdx);
    }
    const confirmedByDTW = new Set<number>();
    pattern.events.forEach((pe, pi) => {
        const candidates = pathMap.get(pi) ?? [];
        let bestInputIdx: number | undefined = undefined;
        let bestDelta = Infinity;
        for (const iIdx of candidates) {
            if (usedInputIndices.has(iIdx)) continue;
            const press = attempt.presses[iIdx];
            if (!press || press.key !== pe.key) continue;
            const nPressTime = press.startTime - aOffset;
            const nPatternTime = pe.startTime - pOffset;
            const delta = Math.abs(nPressTime - nPatternTime);
            if (delta < bestDelta) {
                bestDelta = delta;
                bestInputIdx = iIdx;
            }
        }
        if (bestInputIdx !== undefined) {
            usedInputIndices.add(bestInputIdx);
            confirmedByDTW.add(pi);
            (pe as any).__matchedIdx = bestInputIdx;
        }
    });

    pattern.events.forEach((pe, pi) => {
        if (confirmedByDTW.has(pi)) return;
        const nPatternTime = pe.startTime - pOffset;
        let bestInputIdx: number | undefined = undefined;
        let bestDelta = Infinity;
        attempt.presses.forEach((press, iIdx) => {
            if (usedInputIndices.has(iIdx)) return;
            if (press.key !== pe.key) return;
            const nPressTime = press.startTime - aOffset;
            const delta = Math.abs(nPressTime - nPatternTime);
            if (delta < bestDelta) {
                bestDelta = delta;
                bestInputIdx = iIdx;
            }
        });
        if (bestInputIdx !== undefined) {
            usedInputIndices.add(bestInputIdx);
            (pe as any).__matchedIdx = bestInputIdx;
        }
    });

    pattern.events.forEach((pe) => {
        const matchedIdx: number | undefined = (pe as any).__matchedIdx;
        delete (pe as any).__matchedIdx;
        if (matchedIdx === undefined) {
            results.push({ patternEventId: pe.id, pressId: null, status: 'missed', timingDeltaMs: 0, durationDeltaMs: 0 });
            return;
        }
        const press = attempt.presses[matchedIdx];
        const nPressTime = press.startTime - aOffset;
        const nPatternTime = pe.startTime - pOffset;
        const timingDeltaMs = Math.round(nPressTime - nPatternTime);
        const durationDeltaMs = Math.round((press.duration ?? 0) - pe.duration);
        const status = Math.abs(timingDeltaMs) <= pe.timingToleranceMs ? 'matched' : timingDeltaMs < 0 ? 'early' : 'late';
        results.push({ patternEventId: pe.id, pressId: press.id, status, timingDeltaMs, durationDeltaMs });
    });
    return results;
}

// ==========================================
// BENCHMARK RUNNER
// ==========================================

const createPattern = (): Pattern => ({
    id: 'p1', name: 'Test', description: '', game: '', character: '', tags: [],
    createdAt: 0, updatedAt: 0,
    totalDuration: 1000,
    events: [
        { id: 'e1', key: 'A', displayLabel: 'A', startTime: 0, endTime: 100, duration: 100, timingToleranceMs: 50, durationTolerancePct: 0.5 },
        { id: 'e2', key: 'B', displayLabel: 'B', startTime: 200, endTime: 300, duration: 100, timingToleranceMs: 50, durationTolerancePct: 0.5 },
        { id: 'e3', key: 'C', displayLabel: 'C', startTime: 400, endTime: 500, duration: 100, timingToleranceMs: 50, durationTolerancePct: 0.5 },
        { id: 'e4', key: 'D', displayLabel: 'D', startTime: 600, endTime: 700, duration: 100, timingToleranceMs: 50, durationTolerancePct: 0.5 },
    ]
});

function randomJitter(maxJitter: number) {
    return (Math.random() * maxJitter * 2) - maxJitter;
}

describe('1000 Iteration Benchmark', () => {
    test('Simulate jitter, reorder, miss, spam', () => {
        const pattern = createPattern();

        let oldCorrect = 0;
        let newCorrect = 0;

        for (let i = 0; i < 1000; i++) {
            // Generate presses based on pattern
            let presses: any[] = [];
            pattern.events.forEach((pe) => {
                const j5 = randomJitter(5);
                const j20 = randomJitter(20);

                // Miss key manually ~10% randomly
                if (Math.random() < 0.1) return;

                let start = pe.startTime + j20;
                presses.push({
                    id: Math.random().toString(), key: pe.key, keyCode: 0, startTime: start, duration: pe.duration + j5, endTime: start + pe.duration + j5, sessionId: 's1'
                });

                // Spam key manually ~10% randomly
                if (Math.random() < 0.1) {
                    presses.push({
                        id: Math.random().toString(), key: pe.key, keyCode: 0, startTime: start + 200 + randomJitter(10), duration: 50, endTime: start + 250, sessionId: 's1'
                    });
                }
            });

            // Reorder simulating keyboard 1-2 ms jitter overlaps
            // Randomly swap adjacent events roughly close
            if (Math.random() < 0.2 && presses.length > 2) {
                const temp = presses[1];
                presses[1] = presses[0];
                presses[0] = temp;
                presses[0].startTime += 2;
                presses[1].startTime -= 2;
            }

            const attempt: Attempt = {
                id: 'a1', sessionId: 's1', patternId: 'p1', startTime: 0, endTime: 1000,
                presses, result: null
            };

            // Calculate DTW path for old function
            const patVec = toFeatureVectors(pattern.events, 1000);
            const inVec = toFeatureVectors(attempt.presses.map(p => ({ key: p.key, startTime: p.startTime, duration: p.duration, endTime: p.endTime })), 1000);
            const { path } = computeDTW(patVec, inVec);

            const oldRes = buildMatchResultsOld(pattern, attempt, path);
            const newRes = buildMatchResults(pattern, attempt);

            // Evaluation logic: 
            // We just check how many times mapping avoids crazy 100+ms offsets due to greedy mapping.
            let oldIsSane = true;
            oldRes.forEach(r => {
                if (r.status !== 'missed' && Math.abs(r.timingDeltaMs) > 100) oldIsSane = false;
            });

            let newIsSane = true;
            newRes.forEach(r => {
                if (r.status !== 'missed' && Math.abs(r.timingDeltaMs) > 100) newIsSane = false;
            });

            if (oldIsSane) oldCorrect++;
            if (newIsSane) newCorrect++;
        }

        console.log(`\n==========================================`);
        console.log(`BENCHMARK RESULT (1000 Iterations)`);
        console.log(`==========================================`);
        console.log(`Old Algorithm (DTW + Greedy): ${Math.round((oldCorrect / 1000) * 100)}% accuracy`);
        console.log(`New Algorithm (Tolerance NN): ${Math.round((newCorrect / 1000) * 100)}% accuracy`);
        console.log(`==========================================\n`);

        expect(newCorrect).toBeGreaterThan(oldCorrect);
    });

    test('Simulate Hu Tao Combo Benchmark', () => {
        const hutaoEvents = [{ "id": "f5c8bc5f-b857-4784-a037-ae9cfca29089", "key": "MouseLeft", "displayLabel": "MouseLeft", "startTime": 0, "endTime": 237, "duration": 237, "timingToleranceMs": 80, "durationTolerancePct": 0.3 }, { "id": "3e7b564f-d8a0-42e2-bc3e-84b715fee99e", "key": "MouseLeft", "displayLabel": "MouseLeft", "startTime": 910, "endTime": 1296, "duration": 386, "timingToleranceMs": 80, "durationTolerancePct": 0.3 }, { "id": "9a19e628-ec4d-48c6-b1e8-58f331355d9c", "key": "MouseRight", "displayLabel": "MouseRight", "startTime": 1170, "endTime": 1341, "duration": 171, "timingToleranceMs": 80, "durationTolerancePct": 0.3 }, { "id": "b9cea5bc-fbae-448a-96c4-9c8b4be1279e", "key": "MouseLeft", "displayLabel": "MouseLeft", "startTime": 2244, "endTime": 2490, "duration": 246, "timingToleranceMs": 80, "durationTolerancePct": 0.3 }, { "id": "919a54e1-405e-46dc-9c6f-238dd78353bd", "key": "MouseLeft", "displayLabel": "MouseLeft", "startTime": 2844, "endTime": 3232, "duration": 388, "timingToleranceMs": 80, "durationTolerancePct": 0.3 }, { "id": "641a3440-29b9-4770-8a04-336c8ddbe209", "key": "MouseRight", "displayLabel": "MouseRight", "startTime": 2994, "endTime": 3233, "duration": 239, "timingToleranceMs": 80, "durationTolerancePct": 0.3 }, { "id": "1ffefc72-0332-4804-b094-cb8f3c61cb40", "key": "MouseLeft", "displayLabel": "MouseLeft", "startTime": 4190, "endTime": 4505, "duration": 315, "timingToleranceMs": 80, "durationTolerancePct": 0.3 }, { "id": "08ac65a5-5992-40d8-ba65-d12e647ad2ca", "key": "MouseRight", "displayLabel": "MouseRight", "startTime": 4377, "endTime": 4556, "duration": 179, "timingToleranceMs": 80, "durationTolerancePct": 0.3 }, { "id": "aa804855-a77f-40ce-83ca-d67d05931ec3", "key": "MouseLeft", "displayLabel": "MouseLeft", "startTime": 4986, "endTime": 5271, "duration": 285, "timingToleranceMs": 80, "durationTolerancePct": 0.3 }, { "id": "18506491-fb3b-437d-9c8f-dac6afc30fdc", "key": "MouseRight", "displayLabel": "MouseRight", "startTime": 5075, "endTime": 5285, "duration": 210, "timingToleranceMs": 80, "durationTolerancePct": 0.3 }, { "id": "6a53be0c-58a3-4a8c-942c-e776e33991f3", "key": "MouseLeft", "displayLabel": "MouseLeft", "startTime": 7240, "endTime": 7503, "duration": 263, "timingToleranceMs": 80, "durationTolerancePct": 0.3 }, { "id": "4c148fea-e15c-4b79-b1f8-ff9decc5f243", "key": "MouseLeft", "displayLabel": "MouseLeft", "startTime": 7794, "endTime": 8157, "duration": 363, "timingToleranceMs": 80, "durationTolerancePct": 0.3 }, { "id": "79b9f5eb-7c12-442d-9289-161770b5d506", "key": "MouseRight", "displayLabel": "MouseRight", "startTime": 7919, "endTime": 8189, "duration": 270, "timingToleranceMs": 80, "durationTolerancePct": 0.3 }];
        const pattern: Pattern = {
            id: 'hutao1', name: 'Hu Tao Combo', description: '', game: 'Genshin Impact', character: 'Hu Tao', tags: [],
            createdAt: 0, updatedAt: 0,
            totalDuration: 8189,
            events: hutaoEvents
        };

        let oldCorrect = 0;
        let newCorrect = 0;

        for (let i = 0; i < 1000; i++) {
            let presses: any[] = [];
            pattern.events.forEach((pe) => {
                const j5 = randomJitter(5);
                const j20 = randomJitter(20);

                if (Math.random() < 0.05) return;

                let start = pe.startTime + j20;
                presses.push({
                    id: Math.random().toString(), key: pe.key, keyCode: 0, startTime: start, duration: pe.duration + j5, endTime: start + pe.duration + j5, sessionId: 's1'
                });

                if (Math.random() < 0.1) {
                    presses.push({
                        id: Math.random().toString(), key: pe.key, keyCode: 0, startTime: start + 200 + randomJitter(10), duration: 50, endTime: start + 250, sessionId: 's1'
                    });
                }
            });

            if (Math.random() < 0.2 && presses.length > 2) {
                const temp = presses[1];
                presses[1] = presses[0];
                presses[0] = temp;
                presses[0].startTime += 2;
                presses[1].startTime -= 2;
            }

            const attempt: Attempt = {
                id: 'a1', sessionId: 's1', patternId: 'p1', startTime: 0, endTime: 8189,
                presses, result: null
            };

            const patVec = toFeatureVectors(pattern.events, 8189);
            const inVec = toFeatureVectors(attempt.presses.map(p => ({ key: p.key, startTime: p.startTime, duration: p.duration, endTime: p.endTime })), 8189);
            const { path } = computeDTW(patVec, inVec);

            const oldRes = buildMatchResultsOld(pattern, attempt, path);
            const newRes = buildMatchResults(pattern, attempt);

            let oldIsSane = true;
            oldRes.forEach(r => {
                if (r.status !== 'missed' && Math.abs(r.timingDeltaMs) > 100) oldIsSane = false;
            });

            let newIsSane = true;
            newRes.forEach(r => {
                if (r.status !== 'missed' && Math.abs(r.timingDeltaMs) > 100) newIsSane = false;
            });

            if (oldIsSane) oldCorrect++;
            if (newIsSane) newCorrect++;
        }

        console.log(`\n==========================================`);
        console.log(`HU TAO BENCHMARK RESULT (1000 Iterations)`);
        console.log(`==========================================`);
        console.log(`Old Algorithm (DTW + Greedy): ${Math.round((oldCorrect / 1000) * 100)}% accuracy`);
        console.log(`New Algorithm (Tolerance NN): ${Math.round((newCorrect / 1000) * 100)}% accuracy`);
        console.log(`==========================================\n`);

        expect(newCorrect).toBeGreaterThanOrEqual(oldCorrect);
    });
});

