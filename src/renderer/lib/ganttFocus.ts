import type { AppSettings, GanttBar, GanttRow, PatternEvent } from '../types';
import { getDisplayLabel } from './patternUtils';

export const CHART_OTHER_ROW_KEY = '__keyflow_other_inputs__';

export const DEFAULT_CHART_FOCUS_KEYS = [
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'ShiftLeft',
    'ShiftRight',
    'ControlLeft',
    'ControlRight',
    'Space',
    'MouseLeft',
    'MouseRight',
    'MouseMiddle',
    'MouseX1',
    'MouseX2',
];

export const CHART_FOCUS_KEY_OPTIONS = [
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'KeyQ',
    'KeyE',
    'KeyR',
    'KeyF',
    'KeyZ',
    'KeyX',
    'KeyC',
    'KeyV',
    'ShiftLeft',
    'ShiftRight',
    'ControlLeft',
    'ControlRight',
    'AltLeft',
    'AltRight',
    'Space',
    'Tab',
    'Escape',
    'MouseLeft',
    'MouseRight',
    'MouseMiddle',
    'MouseX1',
    'MouseX2',
];

export interface GanttFocusResult {
    rows: GanttRow[];
    patternEvents: PatternEvent[];
    allowedKeys: Set<string> | null;
    hiddenKeyCount: number;
    hiddenPressCount: number;
}

export function resolveChartFocusKeys(
    mode: AppSettings['chartFilterMode'],
    focusKeys: string[]
): Set<string> | null {
    if (mode === 'all') return null;
    return new Set(focusKeys.length > 0 ? focusKeys : DEFAULT_CHART_FOCUS_KEYS);
}

function toOtherBar(bar: GanttBar, sourceKey: string): GanttBar {
    return {
        ...bar,
        sourceKey,
        sourceLabel: getDisplayLabel(sourceKey),
        isMuted: true,
    };
}

export function filterGanttRowsForChartFocus({
    rows,
    patternEvents,
    mode,
    focusKeys,
    otherLabel,
}: {
    rows: GanttRow[];
    patternEvents: PatternEvent[];
    mode: AppSettings['chartFilterMode'];
    focusKeys: string[];
    otherLabel: string;
}): GanttFocusResult {
    const allowedKeys = resolveChartFocusKeys(mode, focusKeys);
    if (!allowedKeys) {
        return {
            rows,
            patternEvents,
            allowedKeys,
            hiddenKeyCount: 0,
            hiddenPressCount: 0,
        };
    }

    const visibleRows: GanttRow[] = [];
    const otherBars: GanttBar[] = [];
    const hiddenKeys = new Set<string>();

    for (const row of rows) {
        if (allowedKeys.has(row.key)) {
            visibleRows.push(row);
            continue;
        }

        if (row.presses.length > 0) {
            hiddenKeys.add(row.key);
            otherBars.push(...row.presses.map((bar) => toOtherBar(bar, row.key)));
        }
    }

    const hiddenPressCount = otherBars.length;
    if (hiddenPressCount > 0) {
        otherBars.sort((a, b) => a.startTime - b.startTime);
        visibleRows.push({
            key: CHART_OTHER_ROW_KEY,
            displayLabel: `${otherLabel} (${hiddenKeys.size})`,
            presses: otherBars,
        });
    }

    return {
        rows: visibleRows,
        patternEvents: patternEvents.filter((event) => allowedKeys.has(event.key)),
        allowedKeys,
        hiddenKeyCount: hiddenKeys.size,
        hiddenPressCount,
    };
}
