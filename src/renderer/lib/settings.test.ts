import { describe, expect, test } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings, normalizeSettings } from './settings';

describe('settings normalization', () => {
    test('returns defaults for non-object values', () => {
        expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
        expect(normalizeSettings('broken')).toEqual(DEFAULT_SETTINGS);
    });

    test('keeps valid settings and rejects invalid enum values', () => {
        expect(mergeSettings({
            keyboardLayout: 'fps',
            chartFilterMode: 'all',
            chartFocusKeys: ['KeyW', 'KeyA', 'KeyW'],
            language: 'ja',
            showMouseButtons: false,
        })).toMatchObject({
            keyboardLayout: 'fps',
            chartFilterMode: 'all',
            chartFocusKeys: ['KeyW', 'KeyA'],
            language: 'ja',
            showMouseButtons: false,
        });

        expect(mergeSettings({
            keyboardLayout: 'custom',
            chartFilterMode: 'compact',
            chartFocusKeys: 'KeyW',
            language: 'de',
        })).toMatchObject({
            keyboardLayout: DEFAULT_SETTINGS.keyboardLayout,
            chartFilterMode: DEFAULT_SETTINGS.chartFilterMode,
            chartFocusKeys: DEFAULT_SETTINGS.chartFocusKeys,
            language: DEFAULT_SETTINGS.language,
        });
    });

    test('falls back on malformed primitive settings', () => {
        expect(mergeSettings({
            defaultZoomMs: Number.NaN,
            ganttRowHeight: 'large',
            enableMetronome: 'yes',
            timingOffsetMs: 'late',
        })).toMatchObject({
            defaultZoomMs: DEFAULT_SETTINGS.defaultZoomMs,
            ganttRowHeight: DEFAULT_SETTINGS.ganttRowHeight,
            enableMetronome: DEFAULT_SETTINGS.enableMetronome,
            timingOffsetMs: DEFAULT_SETTINGS.timingOffsetMs,
        });
    });
});
