/**
 * useInputEvents — Hook to subscribe to input events.
 * Supports both Tauri (rdev global hook) and Electron (uiohook) backends.
 * Includes a DOM fallback for when the Tauri window is focused (rdev limitation on Windows).
 */

import { useEffect } from 'react';
import { useInputStore } from '../stores/inputStore';
import { v4 as uuid } from 'uuid';
import { getRuntimeWindow, isTauriRuntime } from '../lib/runtime';
import type { InputEventType, RawInputEvent } from '../types';


interface KeyInputPayload {
    key_name: string;
    event_type: 'keydown' | 'keyup' | 'mousedown' | 'mouseup';
}

function normalizeRustKey(keyName: string): string {
    if (keyName.startsWith("Key") || keyName.startsWith("Digit")) return keyName;
    if (keyName.startsWith("Mouse")) return keyName;
    const map: Record<string, string> = {
        "Return": "Enter",
        "Escape": "Escape",
        "Space": "Space",
        "ShiftLeft": "ShiftLeft",
        "ShiftRight": "ShiftRight",
        "ControlLeft": "ControlLeft",
        "ControlRight": "ControlRight",
        "Alt": "AltLeft",
        "AltGr": "AltRight",
        "Tab": "Tab",
        "Backspace": "Backspace",
        "CapsLock": "CapsLock",
        "UpArrow": "ArrowUp",
        "DownArrow": "ArrowDown",
        "LeftArrow": "ArrowLeft",
        "RightArrow": "ArrowRight",
        "Comma": "Comma",
        "Dot": "Period",
        "Slash": "Slash",
        "SemiColon": "Semicolon",
        "Quote": "Quote",
        "BackSlash": "Backslash",
        "LeftBracket": "BracketLeft",
        "RightBracket": "BracketRight",
        "Minus": "Minus",
        "Equal": "Equal",
        "BackQuote": "Backquote",
        "F1": "F1", "F2": "F2", "F3": "F3", "F4": "F4",
    };
    return map[keyName] || keyName;
}

/** Map browser MouseEvent.button to our key names */
function mouseButtonToKey(button: number): string {
    switch (button) {
        case 0: return 'MouseLeft';
        case 1: return 'MouseMiddle';
        case 2: return 'MouseRight';
        default: return `Mouse${button}`;
    }
}

function createInputEvent(key: string, type: InputEventType): RawInputEvent {
    const state = useInputStore.getState();
    const absoluteTime = performance.timeOrigin + performance.now();
    return {
        id: uuid(),
        type,
        key,
        keyCode: 0,
        timestamp: absoluteTime - state.sessionBaseTime,
        sessionId: state.sessionId || 'freestyle',
    };
}

export function useInputEvents(): void {
    const handleRawEvents = useInputStore((s) => s.handleRawEvents);
    const ignoreNextUIEvent = useInputStore((s) => s.ignoreNextUIEvent);
    const status = useInputStore((s) => s.status);

    useEffect(() => {
        // 1. Guard against UI events (Filter)
        const handleUIInteraction = (e: MouseEvent | KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('button, input, [role="button"], a, select, textarea, .no-drag')) {
                ignoreNextUIEvent();
            }
        };

        window.addEventListener('mousedown', handleUIInteraction, true);
        window.addEventListener('mouseup', handleUIInteraction, true);
        window.addEventListener('keydown', handleUIInteraction, true);

        // Track which keys we've already handled via DOM to avoid duplicates with rdev
        const domHandledKeys = new Set<string>();

        // 2. Tauri IPC Listener (Global native events from Rust rdev)
        let unlistenTauri: (() => void) | undefined;
        let unlistenKeysSync: (() => void) | undefined;
        let releaseNativeCapture: (() => void) | undefined;
        let disposed = false;

        if (isTauriRuntime()) {
            import('@tauri-apps/api/core').then(({ invoke }) => {
                if (disposed) return;
                void invoke('input_capture_acquire');
                releaseNativeCapture = () => {
                    void invoke('input_capture_release');
                };
            });

            import('@tauri-apps/api/event').then(({ listen }) => {
                listen<KeyInputPayload>('global-input', (event) => {
                    const { key_name, event_type } = event.payload;
                    const mappedKey = normalizeRustKey(key_name);

                    // Skip if this key was just handled via DOM fallback (avoid duplicate)
                    const dedupKey = `${mappedKey}:${event_type}`;
                    if (domHandledKeys.has(dedupKey)) {
                        domHandledKeys.delete(dedupKey);
                        return;
                    }

                    handleRawEvents([createInputEvent(mappedKey, event_type)]);
                }).then((fn) => {
                    if (disposed) fn();
                    else unlistenTauri = fn;
                });

                listen<{ active_keys: string[] }>('keys-sync', (event) => {
                    // CRITICAL FIX: On Windows, rdev cannot hook keyboard events if our own window is focused.
                    // This causes rustKeys to be empty for keys handled via DOM. If we process the sync here,
                    // we will incorrectly delete keys the user is currently holding down, causing flickering and missed keyups.
                    if (document.hasFocus()) return;

                    const state = useInputStore.getState();
                    const rustKeys = new Set(event.payload.active_keys.map(normalizeRustKey));
                    const localKeys = state.activeKeys;
                    const staleKeys: string[] = [];

                    for (const key of localKeys.keys()) {
                        if (!rustKeys.has(key)) staleKeys.push(key);
                    }

                    if (staleKeys.length > 0) {
                        const newActiveKeys = new Map(localKeys);
                        for (const key of staleKeys) newActiveKeys.delete(key);
                        useInputStore.setState({ activeKeys: newActiveKeys });
                    }
                }).then((fn) => {
                    if (disposed) fn();
                    else unlistenKeysSync = fn;
                });
            });

            // 3. DOM Fallback — catch keyboard/mouse when Tauri window is focused
            //    (rdev on Windows misses events from the same process)
            const onDomKeyDown = (e: KeyboardEvent) => {
                // Don't capture if user is typing in an input field
                const target = e.target as HTMLElement;
                if (target.closest('input, textarea, select')) return;

                const key = e.code; // Already in standard format: "KeyA", "Space", etc.
                const dedupKey = `${key}:keydown`;
                domHandledKeys.add(dedupKey);
                // Auto-clear dedup after 50ms
                setTimeout(() => domHandledKeys.delete(dedupKey), 50);

                handleRawEvents([createInputEvent(key, 'keydown')]);
            };

            const onDomKeyUp = (e: KeyboardEvent) => {
                const target = e.target as HTMLElement;
                if (target.closest('input, textarea, select')) return;

                const key = e.code;
                const dedupKey = `${key}:keyup`;
                domHandledKeys.add(dedupKey);
                setTimeout(() => domHandledKeys.delete(dedupKey), 50);

                handleRawEvents([createInputEvent(key, 'keyup')]);
            };

            const onDomMouseDown = (e: MouseEvent) => {
                // Skip clicks on UI elements to avoid conflicting with the UI guard
                const target = e.target as HTMLElement;
                if (target.closest('button, input, [role="button"], a, select, textarea')) return;

                const key = mouseButtonToKey(e.button);
                const dedupKey = `${key}:mousedown`;
                domHandledKeys.add(dedupKey);
                setTimeout(() => domHandledKeys.delete(dedupKey), 50);

                handleRawEvents([createInputEvent(key, 'mousedown')]);
            };

            const onDomMouseUp = (e: MouseEvent) => {
                const target = e.target as HTMLElement;
                if (target.closest('button, input, [role="button"], a, select, textarea')) return;

                const key = mouseButtonToKey(e.button);
                const dedupKey = `${key}:mouseup`;
                domHandledKeys.add(dedupKey);
                setTimeout(() => domHandledKeys.delete(dedupKey), 50);

                handleRawEvents([createInputEvent(key, 'mouseup')]);
            };

            window.addEventListener('keydown', onDomKeyDown);
            window.addEventListener('keyup', onDomKeyUp);
            window.addEventListener('mousedown', onDomMouseDown);
            window.addEventListener('mouseup', onDomMouseUp);

            // Store cleanup refs
            getRuntimeWindow().__kfDomCleanup = () => {
                window.removeEventListener('keydown', onDomKeyDown);
                window.removeEventListener('keyup', onDomKeyUp);
                window.removeEventListener('mousedown', onDomMouseDown);
                window.removeEventListener('mouseup', onDomMouseUp);
            };
        }

        // 4. Context menu prevention during recording
        const onContextMenu = (e: Event) => {
            if (useInputStore.getState().status === 'recording') e.preventDefault();
        };
        window.addEventListener('contextmenu', onContextMenu);

        return () => {
            disposed = true;
            if (unlistenTauri) unlistenTauri();
            if (unlistenKeysSync) unlistenKeysSync();
            releaseNativeCapture?.();
            getRuntimeWindow().__kfDomCleanup?.();
            getRuntimeWindow().__kfDomCleanup = undefined;
            window.removeEventListener('mousedown', handleUIInteraction, true);
            window.removeEventListener('mouseup', handleUIInteraction, true);
            window.removeEventListener('keydown', handleUIInteraction, true);
            window.removeEventListener('contextmenu', onContextMenu);
        };
    }, [handleRawEvents, ignoreNextUIEvent, status]);
}
