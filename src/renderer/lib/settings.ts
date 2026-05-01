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
    language: 'vi',
};

const KEYBOARD_LAYOUTS = new Set<AppSettings['keyboardLayout']>(['full', 'fps', 'osu']);
const CHART_FILTER_MODES = new Set<AppSettings['chartFilterMode']>(['focus', 'all']);
const LANGUAGES = new Set<AppSettings['language']>(['en', 'vi', 'ja', 'zh', 'ko']);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function readFiniteNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function readStringArray(value: unknown, fallback: string[]): string[] {
    if (!Array.isArray(value)) return fallback;
    const result = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    return Array.from(new Set(result));
}

export function normalizeSettings(value: unknown): AppSettings {
    if (!isRecord(value)) return DEFAULT_SETTINGS;

    return {
        keyboardLayout: KEYBOARD_LAYOUTS.has(value.keyboardLayout as AppSettings['keyboardLayout'])
            ? value.keyboardLayout as AppSettings['keyboardLayout']
            : DEFAULT_SETTINGS.keyboardLayout,
        showMouseButtons: readBoolean(value.showMouseButtons, DEFAULT_SETTINGS.showMouseButtons),
        chartFilterMode: CHART_FILTER_MODES.has(value.chartFilterMode as AppSettings['chartFilterMode'])
            ? value.chartFilterMode as AppSettings['chartFilterMode']
            : DEFAULT_SETTINGS.chartFilterMode,
        chartFocusKeys: readStringArray(value.chartFocusKeys, DEFAULT_SETTINGS.chartFocusKeys),
        keyHighlightColor: readString(value.keyHighlightColor, DEFAULT_SETTINGS.keyHighlightColor),
        defaultZoomMs: readFiniteNumber(value.defaultZoomMs, DEFAULT_SETTINGS.defaultZoomMs),
        ganttRowHeight: readFiniteNumber(value.ganttRowHeight, DEFAULT_SETTINGS.ganttRowHeight),
        ganttBarColor: readString(value.ganttBarColor, DEFAULT_SETTINGS.ganttBarColor),
        patternBarColor: readString(value.patternBarColor, DEFAULT_SETTINGS.patternBarColor),
        defaultTimingToleranceMs: readFiniteNumber(value.defaultTimingToleranceMs, DEFAULT_SETTINGS.defaultTimingToleranceMs),
        enableMetronome: readBoolean(value.enableMetronome, DEFAULT_SETTINGS.enableMetronome),
        metronomeIntervalMs: readFiniteNumber(value.metronomeIntervalMs, DEFAULT_SETTINGS.metronomeIntervalMs),
        timingOffsetMs: readFiniteNumber(value.timingOffsetMs, DEFAULT_SETTINGS.timingOffsetMs),
        language: LANGUAGES.has(value.language as AppSettings['language'])
            ? value.language as AppSettings['language']
            : DEFAULT_SETTINGS.language,
    };
}

export function mergeSettings(value: unknown): AppSettings {
    return normalizeSettings({ ...DEFAULT_SETTINGS, ...(isRecord(value) ? value : {}) });
}
