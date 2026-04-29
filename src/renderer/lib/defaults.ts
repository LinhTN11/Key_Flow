/**
 * Default application settings.
 */

import type { AppSettings } from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
    keyboardLayout: 'full',
    showMouseButtons: true,
    keyHighlightColor: '#6366f1',
    defaultZoomMs: 5000,
    ganttRowHeight: 28,
    ganttBarColor: '#6366f1',
    patternBarColor: '#4b5563',
    defaultTimingToleranceMs: 80,
    autoStartComparison: false,
    showRealtimeOverlay: true,
    enableMetronome: false,
    metronomeIntervalMs: 500,
    language: 'en',
};
