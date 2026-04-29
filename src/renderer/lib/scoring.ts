/**
 * Scoring engine — Calculates match quality between pattern and user attempt.
 * Uses Tolerance-Bounded Nearest-Neighbor mapping.
 */

import type {
    Pattern, Attempt, EventMatchResult, ComparisonResult,
} from '../types';

export function buildMatchResults(
    pattern: Pattern,
    attempt: Attempt
): EventMatchResult[] {
    const results: EventMatchResult[] = [];
    const usedInputIndices = new Set<number>();

    // Normalize offsets — both sequences start at t=0
    const pOffset = pattern.events.length > 0 ? pattern.events[0].startTime : 0;
    const aOffset = attempt.presses.length > 0 ? attempt.presses[0].startTime : 0;

    // Tolerance Bounded Nearest-Neighbor Match
    pattern.events.forEach((pe) => {
        let bestInputIdx: number | undefined = undefined;
        let bestDelta = Infinity;
        const nPatternTime = pe.startTime - pOffset;

        // Try to find the best matching press for this pattern event
        attempt.presses.forEach((press, iIdx) => {
            if (usedInputIndices.has(iIdx)) return;
            if (press.key !== pe.key) return;

            const nPressTime = press.startTime - aOffset;
            const delta = nPressTime - nPatternTime;
            const absDelta = Math.abs(delta);

            // Window boundary: max 3x tolerance or 300ms minimum to prevent distant inputs from absorbing misses
            const window = Math.max(pe.timingToleranceMs * 3, 300);

            if (absDelta <= window && absDelta < bestDelta) {
                bestDelta = absDelta;
                bestInputIdx = iIdx;
            }
        });

        if (bestInputIdx !== undefined) {
            usedInputIndices.add(bestInputIdx);

            const press = attempt.presses[bestInputIdx];
            const nPressTime = press.startTime - aOffset;

            const timingDeltaMs = Math.round(nPressTime - nPatternTime);
            const durationDeltaMs = Math.round((press.duration ?? 0) - pe.duration);

            const status =
                Math.abs(timingDeltaMs) <= pe.timingToleranceMs ? 'matched'
                    : timingDeltaMs < 0 ? 'early'
                        : 'late';

            results.push({
                patternEventId: pe.id,
                pressId: press.id,
                status,
                timingDeltaMs,
                durationDeltaMs,
            });
        } else {
            results.push({
                patternEventId: pe.id,
                pressId: null,
                status: 'missed',
                timingDeltaMs: 0,
                durationDeltaMs: 0,
            });
        }
    });

    return results;
}

/**
 * Calculate 4 sub-scores and overall weighted score.
 * Weights: completion 35%, timing 35%, order 20%, duration 10%.
 */
export function calculateScore(
    pattern: Pattern,
    attempt: Attempt,
    eventResults: EventMatchResult[]
): Pick<ComparisonResult, 'overallScore' | 'timingScore' | 'orderScore' | 'completionScore' | 'durationScore'> {
    const total = pattern.events.length;
    if (total === 0) {
        return { overallScore: 0, timingScore: 0, orderScore: 0, completionScore: 0, durationScore: 0 };
    }

    // Completion: % of pattern events that were hit
    const hitCount = eventResults.filter((r) => r.status !== 'missed').length;
    const completionScore = (hitCount / total) * 100;

    // Timing: score based on how far off each hit was vs tolerance
    // Within tolerance = 100, linearly drops, hits 0 at 3x tolerance
    const matched = eventResults.filter((r) => r.status !== 'missed');
    let timingScore = 0;
    if (matched.length > 0) {
        const totalPct = matched.reduce((sum, r) => {
            const pe = pattern.events.find((e) => e.id === r.patternEventId);
            if (!pe) return sum;
            const excess = Math.max(0, Math.abs(r.timingDeltaMs) - pe.timingToleranceMs);
            const maxExcess = pe.timingToleranceMs * 2;
            return sum + Math.max(0, 100 - (excess / maxExcess) * 100);
        }, 0);
        timingScore = totalPct / matched.length;
    }

    // Duration: 0ms delta = 100, drops linearly, 0 at 300ms delta
    let durationScore = 0;
    if (matched.length > 0) {
        const avgDelta = matched.reduce((sum, r) => sum + Math.abs(r.durationDeltaMs), 0) / matched.length;
        durationScore = Math.max(0, 100 - (avgDelta / 3));
    }

    // Order: Levenshtein on key sequences
    const patternKeys = pattern.events.map((e) => e.key);
    const userKeys = attempt.presses.map((p) => p.key);
    const editDistance = levenshtein(patternKeys, userKeys);
    const orderScore = Math.max(0, 100 - (editDistance / Math.max(patternKeys.length, 1)) * 100);

    const overallScore = Math.round(
        completionScore * 0.35 +
        timingScore * 0.35 +
        orderScore * 0.20 +
        durationScore * 0.10
    );

    return {
        overallScore,
        timingScore: Math.round(timingScore),
        orderScore: Math.round(orderScore),
        completionScore: Math.round(completionScore),
        durationScore: Math.round(durationScore),
    };
}

function levenshtein(a: string[], b: string[]): number {
    const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
        Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            matrix[i][j] = a[i - 1] === b[j - 1]
                ? matrix[i - 1][j - 1]
                : 1 + Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]);
        }
    }
    return matrix[a.length][b.length];
}