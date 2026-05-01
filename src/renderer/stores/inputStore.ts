/**
 * inputStore — Zustand store managing current session input events.
 * Presses are tracked in ALL states (idle + recording) so the chart
 * draws freely on any keypress. Recording mode additionally records
 * rawEvents with session-relative timestamps.
 */

import { create } from 'zustand';
import type { RawInputEvent, InputPress } from '../types';
import { v4 as uuid } from 'uuid';

interface InputStore {
    sessionId: string | null;
    sessionBaseTime: number;
    startOffset: number;
    rawEvents: RawInputEvent[];
    presses: InputPress[];
    activeKeys: Map<string, RawInputEvent>;
    status: 'idle' | 'recording' | 'paused';
    startOnFirstInput: boolean;
    hasFirstInput: boolean;
    ignoreUntil: number;
    /** Base time for freestyle (idle) mode, set on first freestyle input */
    freestyleBaseTime: number;

    startSession: (sessionId: string, startOnFirstInput?: boolean) => void;
    pauseSession: () => void;
    resumeSession: () => void;
    stopSession: () => void;
    handleRawEvents: (events: RawInputEvent[]) => void;
    clearSession: () => void;
    clearChart: () => void;
    ignoreNextUIEvent: () => void;
}

export const useInputStore = create<InputStore>((set, get) => ({
    sessionId: null,
    sessionBaseTime: 0,
    startOffset: 0,
    rawEvents: [],
    presses: [],
    activeKeys: new Map(),
    status: 'idle',
    startOnFirstInput: false,
    hasFirstInput: false,
    ignoreUntil: 0,
    freestyleBaseTime: 0,

    startSession: (sessionId, startOnFirstInput = false) => {
        set({
            sessionId,
            sessionBaseTime: performance.timeOrigin + performance.now(),
            startOffset: 0,
            status: 'recording',
            rawEvents: [],
            presses: [],
            activeKeys: new Map(),
            startOnFirstInput,
            hasFirstInput: false,
        });
    },

    pauseSession: () => set({ status: 'paused' }),

    resumeSession: () => set({ status: 'recording' }),

    stopSession: () => {
        set({ status: 'idle' });
    },

    ignoreNextUIEvent: () => {
        const nowMs = performance.timeOrigin + performance.now();
        set((state) => {
            const newActiveKeys = new Map(state.activeKeys);
            const newPresses = [...state.presses];
            const newRawEvents = [...state.rawEvents];

            // 1. Scrub activeKeys (UNCONDITIONAL for UI events)
            // If a UI event triggers this, any active MouseLeft is guaranteed to be the UI click itself.
            // We unconditionally remove it to prevent it from getting stuck if the thread blocks.
            if (newActiveKeys.has('MouseLeft')) {
                newActiveKeys.delete('MouseLeft');
            }

            // 2. Scrub presses (Conditional, only if recent)
            if (newPresses.length > 0) {
                const lastPress = newPresses[newPresses.length - 1];
                if (lastPress.key === 'MouseLeft' && lastPress.endTime !== null && (nowMs - lastPress.endTime - state.sessionBaseTime) < 500) {
                    newPresses.pop();
                }
            }

            // 3. Scrub rawEvents
            if (newRawEvents.length > 0) {
                while (newRawEvents.length > 0 && newRawEvents[newRawEvents.length - 1].key === 'MouseLeft') {
                    newRawEvents.pop();
                }
            }

            return {
                ignoreUntil: nowMs + 64,
                activeKeys: newActiveKeys,
                presses: newPresses,
                rawEvents: newRawEvents,
            };
        });
    },

    handleRawEvents: (events) => {
        const state = get();
        const nowMs = performance.timeOrigin + performance.now();

        // UI Event Filtering - Priority #1
        // Only ignore MouseLeft clicks when interacting with UI.
        // Never ignore keyboard events or other mouse buttons.
        const filteredEvents = events.filter(e => {
            if (nowMs < state.ignoreUntil && e.key === 'MouseLeft') return false;
            return true;
        });

        if (filteredEvents.length === 0) return;

        const { activeKeys, presses, freestyleBaseTime, rawEvents, startOnFirstInput, status } = state;
        let { startOffset, hasFirstInput } = state;
        const newActiveKeys = new Map(activeKeys);
        const newPresses = [...presses];
        const newRawEvents = [...rawEvents];
        let newFreestyleBaseTime = freestyleBaseTime;

        let hasChanges = false;

        for (const event of filteredEvents) {
            // CRITICAL FIX: Filter out OS auto-repeats globally.
            // If the key is already pressed, do not process subsequent keydown events.
            if ((event.type === 'keydown' || event.type === 'mousedown') && newActiveKeys.has(event.key)) {
                continue;
            }
            hasChanges = true;

            // ── Freestyle (idle) mode: track presses for the chart ──────────
            if (status === 'idle') {
                let baseTime = newFreestyleBaseTime;

                if (event.type === 'keydown' || event.type === 'mousedown') {
                    // Set freestyle base time on first input
                    if (baseTime === 0) {
                        baseTime = nowMs;
                        newFreestyleBaseTime = baseTime;
                    }
                    if (!newActiveKeys.has(event.key)) {
                        newActiveKeys.set(event.key, { ...event, timestamp: nowMs - baseTime });
                    }
                } else {
                    // keyup / mouseup → create a press entry
                    const downEvent = newActiveKeys.get(event.key);
                    if (downEvent && downEvent.timestamp !== undefined) {
                        const relNow = nowMs - baseTime;
                        const press: InputPress = {
                            id: uuid(),
                            key: event.key,
                            keyCode: event.keyCode,
                            startTime: downEvent.timestamp,
                            endTime: relNow,
                            duration: relNow - downEvent.timestamp,
                            sessionId: 'freestyle',
                        };
                        newPresses.push(press);
                    }
                    newActiveKeys.delete(event.key);
                }
            } else {
                // ── Recording / Paused mode ─────────────────────────────────────
                // 1. Update Active Keys (for visualizer)
                if (event.type === 'keydown' || event.type === 'mousedown') {
                    if (!newActiveKeys.has(event.key)) {
                        newActiveKeys.set(event.key, { ...event });
                    }
                } else {
                    newActiveKeys.delete(event.key);
                }

                // 2. Only perform recording and offset logic if in 'recording' state
                if (status === 'recording') {
                    if (startOnFirstInput && !hasFirstInput) {
                        startOffset = event.timestamp;
                        hasFirstInput = true;
                    }

                    const relTimestamp = startOnFirstInput ? event.timestamp - startOffset : event.timestamp;

                    if (event.type === 'keydown' || event.type === 'mousedown') {
                        const existing = newActiveKeys.get(event.key);
                        if (existing) newActiveKeys.set(event.key, { ...existing, timestamp: relTimestamp });
                    } else {
                        const downEvent = newActiveKeys.get(event.key);
                        // Fallback to state.activeKeys if not in newActiveKeys (though we just processed it)
                        const origDownEvent = downEvent || activeKeys.get(event.key);
                        if (origDownEvent && origDownEvent.timestamp !== undefined) {
                            const press: InputPress = {
                                id: uuid(),
                                key: event.key,
                                keyCode: event.keyCode,
                                startTime: origDownEvent.timestamp,
                                endTime: relTimestamp,
                                duration: relTimestamp - origDownEvent.timestamp,
                                sessionId: state.sessionId || 'freestyle',
                            };
                            newPresses.push(press);
                        }
                    }

                    newRawEvents.push({ ...event, timestamp: relTimestamp });
                }
            }
        }

        if (hasChanges) {
            // Cap presses in idle mode to avoid infinite memory growth
            if (status === 'idle' && newPresses.length > 1000) {
                newPresses.splice(0, newPresses.length - 500);
            }

            set({
                activeKeys: newActiveKeys,
                presses: newPresses,
                rawEvents: newRawEvents,
                freestyleBaseTime: newFreestyleBaseTime,
                startOffset,
                hasFirstInput,
            });
        }
    },

    /** Clear chart data (freestyle refresh) — keeps status as idle */
    clearChart: () => {
        set({
            presses: [],
            rawEvents: [],
            activeKeys: new Map(),
            freestyleBaseTime: 0,
        });
    },

    clearSession: () => {
        set({
            sessionId: null,
            sessionBaseTime: 0,
            startOffset: 0,
            rawEvents: [],
            presses: [],
            activeKeys: new Map(),
            status: 'idle',
            startOnFirstInput: false,
            hasFirstInput: false,
            ignoreUntil: 0,
            freestyleBaseTime: 0,
        });
    },
}));

