import { describe, expect, test } from 'vitest';
import type { GanttRow, PatternEvent } from '../types';
import { CHART_OTHER_ROW_KEY, DEFAULT_CHART_FOCUS_KEYS, filterGanttRowsForChartFocus, resolveChartFocusKeys } from './ganttFocus';

const rows: GanttRow[] = [
    {
        key: 'KeyW',
        displayLabel: 'W',
        presses: [{ pressId: 'w1', startTime: 0, endTime: 100, duration: 100, isActive: false }],
    },
    {
        key: 'F13',
        displayLabel: 'F13',
        presses: [{ pressId: 'f1', startTime: 50, endTime: 70, duration: 20, isActive: false }],
    },
    {
        key: 'MouseLeft',
        displayLabel: 'MouseLeft',
        presses: [{ pressId: 'm1', startTime: 80, endTime: 130, duration: 50, isActive: false }],
    },
];

const patternEvents: PatternEvent[] = [
    {
        id: 'p1',
        key: 'KeyW',
        displayLabel: 'W',
        startTime: 0,
        endTime: 100,
        duration: 100,
        timingToleranceMs: 80,
        durationTolerancePct: 0.3,
    },
];

describe('gantt focus filtering', () => {
    test('all mode preserves every row and pattern event', () => {
        const result = filterGanttRowsForChartFocus({
            rows,
            patternEvents,
            mode: 'all',
            focusKeys: ['KeyW'],
            otherLabel: 'Other',
        });

        expect(result.rows).toBe(rows);
        expect(result.patternEvents).toBe(patternEvents);
        expect(result.hiddenPressCount).toBe(0);
    });

    test('focus mode uses custom visible keys', () => {
        const result = filterGanttRowsForChartFocus({
            rows,
            patternEvents,
            mode: 'focus',
            focusKeys: ['KeyW'],
            otherLabel: 'Other',
        });

        expect(result.rows.map((row) => row.key)).toEqual(['KeyW', CHART_OTHER_ROW_KEY]);
        expect(result.patternEvents.map((event) => event.key)).toEqual(['KeyW']);
        expect(result.hiddenKeyCount).toBe(2);
        expect(result.hiddenPressCount).toBe(2);
        expect(result.rows[1].presses[0].sourceKey).toBe('F13');
    });

    test('focus mode falls back to default keys when custom list is empty', () => {
        const allowedKeys = resolveChartFocusKeys('focus', []);

        expect(allowedKeys?.has('KeyW')).toBe(true);
        expect(allowedKeys?.has('MouseLeft')).toBe(true);
        expect(allowedKeys?.has('F13')).toBe(false);
        expect(Array.from(allowedKeys ?? [])).toEqual(DEFAULT_CHART_FOCUS_KEYS);
    });
});
