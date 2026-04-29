/**
 * useStoreBridge — Synchronizes practice state from the main window to pop-out windows.
 */

import { useEffect, useRef } from 'react';
import { useInputStore } from '../stores/inputStore';
import { useComparisonStore } from '../stores/comparisonStore';
import { useViewportStore } from '../stores/viewportStore';
import { useSettingsStore } from '../stores/settingsStore';

const isTauri = !!(window as any).__TAURI_INTERNALS__;

interface StoreBridgeOptions {
    mode: 'broadcast' | 'receive';
}

/** Snapshot of serializable store state to sync to pop-out windows */
interface StateSnapshot {
    input: {
        sessionId: string | null;
        sessionBaseTime: number;
        startOffset: number;
        presses: unknown[];
        activeKeys: [string, unknown][];   
        status: 'idle' | 'recording' | 'paused';
        hasFirstInput: boolean;
        startOnFirstInput: boolean;
        freestyleBaseTime: number;
    };
    comparison: {
        activePattern: unknown;
        isComparing: boolean;
        latestResult: unknown;
        analysis: unknown;
        highlightedError: unknown;
        practiceSpeed: number;
    };
    viewport: {
        startMs: number;
        endMs: number;
        playheadOffset: number;
    };
    settings: unknown; // Synchronize app settings (language, layout, etc)
}

function buildSnapshot(): StateSnapshot {
    const input = useInputStore.getState();
    const comparison = useComparisonStore.getState();
    const viewport = useViewportStore.getState();
    const settings = useSettingsStore.getState();

    return {
        input: {
            sessionId: input.sessionId,
            sessionBaseTime: input.sessionBaseTime,
            startOffset: input.startOffset,
            presses: input.presses,
            activeKeys: Array.from(input.activeKeys.entries()),
            status: input.status,
            hasFirstInput: input.hasFirstInput,
            startOnFirstInput: input.startOnFirstInput,
            freestyleBaseTime: input.freestyleBaseTime,
        },
        comparison: {
            activePattern: comparison.activePattern,
            isComparing: comparison.isComparing,
            latestResult: comparison.latestResult,
            analysis: comparison.analysis,
            highlightedError: comparison.highlightedError,
            practiceSpeed: comparison.practiceSpeed,
        },
        viewport: {
            startMs: viewport.viewport.startMs,
            endMs: viewport.viewport.endMs,
            playheadOffset: viewport.playheadOffset,
        },
        settings: settings.settings,
    };
}

async function applySnapshot(snapshot: StateSnapshot) {
    // Patch inputStore
    useInputStore.setState({
        sessionId: snapshot.input.sessionId,
        sessionBaseTime: snapshot.input.sessionBaseTime,
        startOffset: snapshot.input.startOffset,
        presses: snapshot.input.presses as never,
        activeKeys: new Map(snapshot.input.activeKeys as never),
        status: snapshot.input.status,
        hasFirstInput: snapshot.input.hasFirstInput,
        startOnFirstInput: snapshot.input.startOnFirstInput,
        freestyleBaseTime: snapshot.input.freestyleBaseTime,
    });

    // Patch comparisonStore
    useComparisonStore.setState({
        activePattern: snapshot.comparison.activePattern as never,
        isComparing: snapshot.comparison.isComparing,
        latestResult: snapshot.comparison.latestResult as never,
        analysis: snapshot.comparison.analysis as never,
        highlightedError: snapshot.comparison.highlightedError as never,
        practiceSpeed: snapshot.comparison.practiceSpeed,
    });

    // Patch settingsStore
    if (snapshot.settings) {
        const current = useSettingsStore.getState().settings;
        const incoming = snapshot.settings as any;
        
        // Only update and re-i18n if language changed
        if (incoming.language && incoming.language !== current?.language) {
            const i18n = (await import('../i18n')).default;
            i18n.changeLanguage(incoming.language);
        }
        
        useSettingsStore.setState({ settings: incoming });
    }

    // Patch viewportStore
    const isRecording = snapshot.input.status === 'recording';
    useViewportStore.setState((prev) => ({
        viewport: isRecording
            ? prev.viewport  
            : {
                ...prev.viewport,
                startMs: snapshot.viewport.startMs,
                endMs: snapshot.viewport.endMs,
            },
        playheadOffset: snapshot.viewport.playheadOffset,
    }));
}

export function useStoreBridge({ mode }: StoreBridgeOptions) {
    const broadcastRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (mode === 'broadcast') {
            let lastBroadcast = 0;
            let rafId: number | null = null;

            const doSend = () => {
                rafId = null;
                const now = Date.now();
                if (now - lastBroadcast >= 50) {
                    lastBroadcast = now;
                    const snapshot = buildSnapshot();

                    if (isTauri) {
                        import('@tauri-apps/api/event').then(({ emit }) => {
                            emit('state-sync', snapshot);
                        });
                    } else {
                        window.electronAPI?.window?.broadcastState?.(snapshot);
                    }
                }
            };

            const scheduleBroadcast = () => {
                if (rafId != null) return;
                rafId = requestAnimationFrame(doSend);
            };

            const unsubInput = useInputStore.subscribe(scheduleBroadcast);
            const unsubComparison = useComparisonStore.subscribe(scheduleBroadcast);
            const unsubSettings = useSettingsStore.subscribe(scheduleBroadcast);
            const unsubViewport = useViewportStore.subscribe(() => {
                const s = useInputStore.getState();
                if (s.status !== 'recording') scheduleBroadcast();
            });

            broadcastRef.current = () => {
                unsubInput();
                unsubComparison();
                unsubSettings();
                unsubViewport();
                if (rafId != null) cancelAnimationFrame(rafId);
            };

            return () => broadcastRef.current?.();
        }

        if (mode === 'receive') {
            if (isTauri) {
                let unlisten: (() => void) | undefined;
                import('@tauri-apps/api/event').then(({ listen }) => {
                    listen<StateSnapshot>('state-sync', (event) => {
                        try {
                            applySnapshot(event.payload);
                        } catch (e) {
                            console.warn('[StoreBridge] Failed to apply Tauri snapshot:', e);
                        }
                    }).then((fn) => {
                        unlisten = fn;
                    });
                });
                return () => unlisten?.();
            } else {
                const cleanup = window.electronAPI?.window?.onStateSync?.((raw) => {
                    try {
                        applySnapshot(raw as StateSnapshot);
                    } catch (e) {
                        console.warn('[StoreBridge] Failed to apply snapshot:', e);
                    }
                });
                return () => cleanup?.();
            }
        }
    }, [mode]);
}
