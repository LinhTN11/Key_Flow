/**
 * Error Analysis Engine — Classifies errors from comparison results.
 */

import type {
    Pattern, Attempt, EventMatchResult, ErrorItem, ErrorType,
    ComparisonResult, AttemptAnalysis, KeyStat,
} from '../types';
import i18n from '../i18n';
import { getDisplayLabel, normalizeDurationTolerancePct } from './patternUtils';

export function analyzeErrors(
    pattern: Pattern,
    attempt: Attempt,
    eventResults: EventMatchResult[]
): ErrorItem[] {
    const errors: ErrorItem[] = [];

    // --- Detect "stopped mid-combo" ---
    // Find last non-missed index
    let lastHitIdx = -1;
    eventResults.forEach((r, i) => { if (r.status !== 'missed') lastHitIdx = i; });

    const trailingMissed = eventResults.slice(lastHitIdx + 1).filter(r => r.status === 'missed');
    const trailingMissedIds = new Set(trailingMissed.map(r => r.patternEventId));

    // Detect stop-early: >=2 trailing misses AND input ended before 75% of pattern
    const patternDuration = pattern.events.length > 1
        ? pattern.events[pattern.events.length - 1].startTime - pattern.events[0].startTime
        : 0;
    const sortedPresses = [...attempt.presses].sort((a, b) => a.startTime - b.startTime);
    const inputDuration = sortedPresses.length > 1
        ? (sortedPresses[sortedPresses.length - 1].endTime ?? sortedPresses[sortedPresses.length - 1].startTime)
        - sortedPresses[0].startTime
        : 0;

    const stoppedEarly = trailingMissed.length >= 2 && patternDuration > 0 && inputDuration < patternDuration * 0.75;

    if (stoppedEarly) {
        const missedLabels = trailingMissed
            .map(r => pattern.events.find(e => e.id === r.patternEventId)?.displayLabel ?? '')
            .filter(Boolean).join(', ');
        const firstMissedKey = pattern.events.find(e => e.id === trailingMissed[0]?.patternEventId)?.key ?? 'unknown';

        errors.push({
            type: 'missed_key',
            severity: 'critical',
            key: firstMissedKey,
            message: i18n.t('feedback.combo_incomplete', { count: trailingMissed.length, labels: missedLabels }),
            suggestion: i18n.t('feedback.practice_suggestion', { labels: missedLabels }),
            params: { count: trailingMissed.length, labels: missedLabels },
            occurrences: 1,
        });
    }

    // --- Per-event errors ---
    for (const result of eventResults) {
        // Skip trailing misses already grouped above
        if (stoppedEarly && trailingMissedIds.has(result.patternEventId)) continue;

        const pe = pattern.events.find(e => e.id === result.patternEventId);
        if (!pe) continue;

        if (result.status === 'early') {
            const ms = Math.abs(Math.round(result.timingDeltaMs));
            errors.push({
                type: 'timing_early',
                severity: ms > 150 ? 'major' : 'minor',
                key: pe.key,
                message: i18n.t('feedback.press_early', { name: pe.displayLabel, ms }),
                suggestion: i18n.t('feedback.press_early_suggestion', { ms, name: pe.displayLabel }),
                params: { name: pe.displayLabel, ms },
                occurrences: 1,
                eventId: pe.id,
            });
        } else if (result.status === 'late') {
            const ms = Math.abs(Math.round(result.timingDeltaMs));
            errors.push({
                type: 'timing_late',
                severity: ms > 150 ? 'major' : 'minor',
                key: pe.key,
                message: i18n.t('feedback.press_late', { name: pe.displayLabel, ms }),
                suggestion: i18n.t('feedback.press_late_suggestion', { ms, name: pe.displayLabel }),
                params: { name: pe.displayLabel, ms },
                occurrences: 1,
                eventId: pe.id,
            });
        } else if (result.status === 'missed') {
            errors.push({
                type: 'missed_key',
                severity: 'critical',
                key: pe.key,
                message: i18n.t('feedback.missed_key', { name: pe.displayLabel }),
                suggestion: i18n.t('feedback.missed_key_suggestion', { name: pe.displayLabel }),
                params: { name: pe.displayLabel },
                occurrences: 1,
                eventId: pe.id,
            });
        }

        // Duration errors (for any non-missed event)
        if (result.status !== 'missed') {
            const durationDelta = Math.round(result.durationDeltaMs);
            const tolerance = pe.duration * normalizeDurationTolerancePct(pe.durationTolerancePct);
            const ms = Math.abs(durationDelta);
            if (durationDelta < -tolerance) {
                errors.push({
                    type: 'duration_too_short',
                    severity: 'minor',
                    key: pe.key,
                    message: i18n.t('feedback.duration_too_short', { name: pe.displayLabel, ms }),
                    suggestion: i18n.t('feedback.duration_too_short_suggestion', { ms, name: pe.displayLabel }),
                    params: { name: pe.displayLabel, ms },
                    occurrences: 1,
                    eventId: pe.id,
                });
            } else if (durationDelta > tolerance) {
                errors.push({
                    type: 'duration_too_long',
                    severity: 'minor',
                    key: pe.key,
                    message: i18n.t('feedback.duration_too_long', { name: pe.displayLabel, ms }),
                    suggestion: i18n.t('feedback.duration_too_long_suggestion', { ms, name: pe.displayLabel }),
                    params: { name: pe.displayLabel, ms },
                    occurrences: 1,
                    eventId: pe.id,
                });
            }
        }
    }

    // --- Extra key presses ---
    const matchedPressIds = new Set(eventResults.map(r => r.pressId).filter(Boolean));
    for (const press of attempt.presses) {
        if (!matchedPressIds.has(press.id)) {
            errors.push({
                type: 'extra_key',
                severity: 'major',
                key: press.key,
                message: i18n.t('feedback.extra_key', { name: getDisplayLabel(press.key) }),
                suggestion: i18n.t('feedback.extra_key_suggestion', { name: getDisplayLabel(press.key) }),
                params: { name: getDisplayLabel(press.key) },
                occurrences: 1,
            });
        }
    }

    const order: Record<string, number> = { critical: 0, major: 1, minor: 2 };
    return errors.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function analyzeMultipleAttempts(pattern: Pattern, results: ComparisonResult[]): AttemptAnalysis {
    if (results.length === 0) {
        return { patternId: pattern.id, attempts: [], averageScore: 0, trend: 'stable', consistentErrors: [], perKeyStats: [] };
    }

    const scores = results.map(r => r.overallScore);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const trend = computeTrend(scores);

    const errorCounts = new Map<ErrorType, number>();
    for (const result of results) {
        const seen = new Set<ErrorType>();
        for (const err of result.errors) {
            if (!seen.has(err.type)) {
                errorCounts.set(err.type, (errorCounts.get(err.type) ?? 0) + 1);
                seen.add(err.type);
            }
        }
    }
    const consistentErrors = Array.from(errorCounts.entries())
        .filter(([, c]) => c / results.length > 0.5)
        .map(([t]) => t);

    const keyDeltas = new Map<string, number[]>();
    for (const result of results) {
        for (const er of result.eventResults) {
            if (er.status !== 'missed' && er.pressId) {
                if (!keyDeltas.has(er.patternEventId)) keyDeltas.set(er.patternEventId, []);
                keyDeltas.get(er.patternEventId)!.push(er.timingDeltaMs);
            }
        }
    }

    const perKeyStats: KeyStat[] = Array.from(keyDeltas.entries()).map(([eventId, deltas]) => {
        const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        const stdDev = Math.sqrt(deltas.reduce((s, d) => s + (d - avg) ** 2, 0) / deltas.length);
        const pe = pattern.events.find(e => e.id === eventId);
        const missCount = results.reduce((s, r) => {
            const er = r.eventResults.find(e => e.patternEventId === eventId);
            return s + (er?.status === 'missed' ? 1 : 0);
        }, 0);
        return { key: eventId, label: pe?.displayLabel ?? 'Key', averageTimingDelta: avg, timingStdDev: stdDev, missRate: missCount / results.length };
    });

    return { patternId: pattern.id, attempts: results, averageScore, trend, consistentErrors, perKeyStats };
}

function computeTrend(scores: number[]): 'improving' | 'declining' | 'stable' {
    if (scores.length < 3) return 'stable';
    const mid = Math.floor(scores.length / 2);
    const a = scores.slice(0, mid).reduce((x, y) => x + y, 0) / mid;
    const b = scores.slice(mid).reduce((x, y) => x + y, 0) / (scores.length - mid);
    return b - a > 5 ? 'improving' : a - b > 5 ? 'declining' : 'stable';
}
