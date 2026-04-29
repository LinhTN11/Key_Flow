/**
 * useComparison — Hook that runs DTW comparison when an attempt ends.
 * Triggers scoring when elapsed time exceeds the pattern's total duration.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useInputStore } from '../stores/inputStore';
import { useComparisonStore } from '../stores/comparisonStore';
import { buildMatchResults, calculateScore } from '../lib/scoring';
import { analyzeErrors, analyzeMultipleAttempts } from '../lib/errorAnalysis';
import type { ComparisonResult } from '../types';

/** Small buffer after pattern ends before finalizing, allows last key release */
const END_BUFFER_MS = 300;

export function useComparison(onFinalize?: () => void): void {
    const presses = useInputStore((s) => s.presses);
    const activePattern = useComparisonStore((s) => s.activePattern);
    const isComparing = useComparisonStore((s) => s.isComparing);
    const setResult = useComparisonStore((s) => s.setResult);
    const setAnalysis = useComparisonStore((s) => s.setAnalysis);
    const allResults = useComparisonStore((s) => s.allResults);

    const wasComparingRef = useRef(isComparing);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const hasFinalizedRef = useRef(false);

    // Use a latest-value ref pattern to keep finalizeAttempt stable
    const stateRef = useRef({ presses, activePattern, isComparing, allResults });
    stateRef.current = { presses, activePattern, isComparing, allResults };

    const finalizeAttempt = useCallback(() => {
        if (hasFinalizedRef.current) return;
        hasFinalizedRef.current = true;

        try {
            const { presses: currentPresses, activePattern: currentPattern, allResults: results } = stateRef.current;

            if (!currentPattern || currentPresses.length === 0) {
                console.log('[useComparison] Finalize skipped: no pattern or no presses');
                return;
            }

            const patternDuration = currentPattern.totalDuration;
            const lastPress = currentPresses[currentPresses.length - 1];

            // CRITICAL: Normalize all timestamps to start at 0 for DTW compatibility
            const baseTime = currentPresses[0].startTime;
            const inputDuration = (lastPress.endTime ?? lastPress.startTime) - baseTime;

            console.log(`[useComparison] Syncing: pattern=${currentPattern.name} (${patternDuration}ms), input=${currentPresses.length} events (${inputDuration}ms)`);

            if (inputDuration < 200) return;

            const attempt = {
                id: 'temp-' + Date.now(),
                sessionId: '',
                patternId: currentPattern.id,
                startTime: 0, // Normalized
                endTime: lastPress.endTime ? lastPress.endTime - baseTime : lastPress.startTime - baseTime,
                presses: currentPresses.map(p => ({
                    ...p,
                    startTime: p.startTime - baseTime,
                    endTime: p.endTime ? p.endTime - baseTime : null,
                })),
                result: null,
            };

            const practiceSpeed = useComparisonStore.getState().practiceSpeed;
            const patternOffset = currentPattern.events.length > 0 ? currentPattern.events[0].startTime : 0;

            // Apply speed scaling to pattern intervals while keeping hold durations fixed
            const normalizedPattern = {
                ...currentPattern,
                totalDuration: currentPattern.totalDuration / practiceSpeed,
                events: currentPattern.events.map(e => {
                    const scaledStart = (e.startTime - patternOffset) / practiceSpeed;
                    return {
                        ...e,
                        startTime: scaledStart,
                        endTime: scaledStart + e.duration,
                        duration: e.duration,
                    };
                })
            };

            const eventResults = buildMatchResults(normalizedPattern, attempt);
            const scores = calculateScore(normalizedPattern, attempt, eventResults);
            const errors = analyzeErrors(normalizedPattern, attempt, eventResults);

            const result: ComparisonResult = {
                attemptId: attempt.id,
                patternId: currentPattern.id,
                ...scores,
                eventResults,
                errors,
                practiceSpeed,
            };

            console.log('[useComparison] Scoring complete. Overall:', result.overallScore);
            setResult(result);

            const updatedAllResults = [...results, result];
            if (updatedAllResults.length >= 2) {
                const analysis = analyzeMultipleAttempts(currentPattern, updatedAllResults);
                setAnalysis(analysis);
            }
        } catch (err) {
            console.error('[useComparison] Crash during scoring:', err);
        }
    }, [setResult, setAnalysis]);

    // Reset finalized flag when comparison starts
    useEffect(() => {
        if (isComparing) {
            hasFinalizedRef.current = false;
        }
    }, [isComparing]);

    // Detect manual stop (user clicks End)
    useEffect(() => {
        if (wasComparingRef.current && !isComparing) {
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
            finalizeAttempt();
        }
        wasComparingRef.current = isComparing;
    }, [isComparing, finalizeAttempt]);

    // Pattern-duration-based auto-finalize
    // Poll every 200ms to check if elapsed time exceeds pattern duration
    useEffect(() => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

        if (!isComparing || !activePattern || presses.length === 0) return;

        const practiceSpeed = useComparisonStore.getState().practiceSpeed;
        const scaledDuration = activePattern.totalDuration / practiceSpeed;

        // First press time as reference
        const firstPressTime = presses[0].startTime;

        timerRef.current = setInterval(() => {
            const inputState = useInputStore.getState();
            const elapsed = Date.now() - inputState.sessionBaseTime;
            const adjustedElapsed = inputState.startOnFirstInput
                ? elapsed - inputState.startOffset
                : elapsed;

            // Use the first press as reference for elapsed calculation
            // If session hasn't started formally, use first press directly
            const effectiveElapsed = inputState.sessionBaseTime > 0
                ? adjustedElapsed
                : (Date.now() - firstPressTime);

            if (effectiveElapsed >= scaledDuration + END_BUFFER_MS) {
                if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
                finalizeAttempt();
                onFinalize?.();
            }
        }, 200);

        return () => {
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        };
    }, [presses.length, isComparing, activePattern, finalizeAttempt]);
}
