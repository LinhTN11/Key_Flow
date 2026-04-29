/**
 * comparisonStore — Zustand store for managing real-time comparison state.
 * Tracks active pattern, comparison mode, and accumulated results.
 */

import { create } from 'zustand';
import type { Pattern, ComparisonResult, AttemptAnalysis } from '../types';

interface ComparisonStore {
    activePattern: Pattern | null;
    markedPatterns: Pattern[];
    isMultiSelectMode: boolean;
    isComparing: boolean;
    latestResult: ComparisonResult | null;
    allResults: ComparisonResult[];
    analysis: AttemptAnalysis | null;
    practiceSpeed: number; // SPEED CONTROL

    setPattern: (pattern: Pattern | null) => void;
    setMarkedPatterns: (patterns: Pattern[]) => void;
    toggleMarkPattern: (pattern: Pattern) => void;
    setMultiSelectMode: (active: boolean) => void;
    clearMarkedPatterns: () => void;
    startComparison: () => void;
    stopComparison: () => void;
    setResult: (result: ComparisonResult) => void;
    setAnalysis: (analysis: AttemptAnalysis) => void;
    setPracticeSpeed: (speed: number) => void;
    highlightedError: { type: string; key: string; message?: string; eventId?: string } | null;
    setHighlightedError: (error: { type: string; key: string; message?: string; eventId?: string } | null) => void;
    reset: () => void;
}

export const useComparisonStore = create<ComparisonStore>((set, get) => ({
    activePattern: null,
    markedPatterns: [],
    isMultiSelectMode: false,
    isComparing: false,
    latestResult: null,
    allResults: [],
    analysis: null,
    practiceSpeed: 1.0,
    highlightedError: null,


    setPattern: (pattern) => set({
        activePattern: pattern,
        latestResult: null,
        allResults: [],
        analysis: null,
    }),

    setMarkedPatterns: (patterns) => set({ markedPatterns: patterns }),

    toggleMarkPattern: (pattern) => {
        const { markedPatterns } = get();
        const exists = markedPatterns.find(p => p.id === pattern.id);
        if (exists) {
            set({ markedPatterns: markedPatterns.filter(p => p.id !== pattern.id) });
        } else {
            set({ markedPatterns: [...markedPatterns, pattern] });
        }
    },

    setMultiSelectMode: (active) => set({ isMultiSelectMode: active }),

    clearMarkedPatterns: () => set({ markedPatterns: [] }),

    startComparison: () => set({ isComparing: true, latestResult: null }),

    stopComparison: () => set({ isComparing: false }),

    setResult: (result) => {
        const newResults = [...get().allResults, result];
        set({ latestResult: result, allResults: newResults, isComparing: false });
    },

    setAnalysis: (analysis) => set({ analysis }),

    setPracticeSpeed: (speed) => set({
        practiceSpeed: speed,
        latestResult: null,
        highlightedError: null,
    }),

    setHighlightedError: (error) => set({ highlightedError: error }),

    reset: () => set({
        isComparing: false,
        latestResult: null,
        allResults: [],
        analysis: null,
        highlightedError: null,
    }),
}));
