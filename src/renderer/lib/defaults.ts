/**
 * Default application settings.
 */

import type { AppSettings } from '../types';
import { DEFAULT_CHART_FOCUS_KEYS } from './ganttFocus';

export const DEFAULT_SETTINGS: AppSettings = {
    keyboardLayout: 'full',
    showMouseButtons: true,
    chartFilterMode: 'focus',
    chartFocusKeys: DEFAULT_CHART_FOCUS_KEYS,
    keyHighlightColor: '#6366f1',
    defaultZoomMs: 5000,
    ganttRowHeight: 28,
    ganttBarColor: '#6366f1',
    patternBarColor: '#4b5563',
    defaultTimingToleranceMs: 80,
    enableMetronome: false,
    metronomeIntervalMs: 500,
    timingOffsetMs: 0,
    language: 'en',
};
