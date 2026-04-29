/**
 * Pattern utility functions — Gantt data transformation and key display labels.
 */

import type { InputPress, RawInputEvent, GanttRow, GanttBar } from '../types';

/** Map of key codes to human-readable display labels. */
const DISPLAY_LABEL_MAP: Record<string, string> = {
    MouseLeft: 'MouseLeft',
    MouseRight: 'MouseRight',
    MouseMiddle: 'MouseMiddle',
    Space: 'SPC',
    ShiftLeft: 'L⇧',
    ShiftRight: 'R⇧',
    ControlLeft: 'L^',
    ControlRight: 'R^',
    AltLeft: 'LAlt',
    AltRight: 'RAlt',
    Tab: 'Tab',
    Enter: '↵',
    Escape: 'Esc',
    Backspace: '⌫',
    CapsLock: 'Caps',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
};

/** Get a short display label for a key name. */
export function getDisplayLabel(key: string): string {
    if (DISPLAY_LABEL_MAP[key]) return DISPLAY_LABEL_MAP[key];
    if (key.startsWith('Key')) return key.slice(3);
    if (key.startsWith('Digit')) return key.slice(5);
    if (key.startsWith('Numpad')) return 'N' + key.slice(6);
    return key;
}

/**
 * Build Gantt rows from completed presses and currently active keys.
 * Rows are ordered by first appearance of each key.
 */
export function buildGanttRows(
    presses: InputPress[],
    activeKeys: Map<string, RawInputEvent>,
    allPatternKeys: string[] = []
): GanttRow[] {
    const keyOrder: string[] = [];
    const keyMap = new Map<string, GanttBar[]>();

    // 1. Ensure all pattern keys are in order first (to keep pattern layout stable)
    for (const key of allPatternKeys) {
        if (!keyMap.has(key)) {
            keyOrder.push(key);
            keyMap.set(key, []);
        }
    }

    // 2. Add completed presses
    for (const press of presses) {
        if (!keyMap.has(press.key)) {
            keyOrder.push(press.key);
            keyMap.set(press.key, []);
        }
        keyMap.get(press.key)!.push({
            pressId: press.id,
            startTime: press.startTime,
            endTime: press.endTime ?? press.startTime,
            duration: press.duration ?? 0,
            isActive: press.endTime === null,
            matchStatus: undefined,
        });
    }

    // Add currently held keys as active bars
    for (const [key, event] of activeKeys) {
        if (!keyMap.has(key)) {
            keyOrder.push(key);
            keyMap.set(key, []);
        }
        keyMap.get(key)!.push({
            pressId: event.id,
            startTime: event.timestamp,
            endTime: event.timestamp, // will be updated each frame
            duration: 0,
            isActive: true,
            matchStatus: undefined,
        });
    }

    return keyOrder.map((key) => ({
        key,
        displayLabel: getDisplayLabel(key),
        presses: keyMap.get(key)!,
    }));
}
