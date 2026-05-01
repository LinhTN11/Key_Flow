/**
 * useStoreBridge — Synchronizes practice state from the main window to pop-out windows.
 */

import { useEffect, useRef } from 'react';
import { useInputStore } from '../stores/inputStore';
import { useComparisonStore } from '../stores/comparisonStore';
import { useViewportStore } from '../stores/viewportStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getElectronAPI, isTauriRuntime } from '../lib/runtime';
import type { AppSettings } from '../types';
import i18n from '../i18n';

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
    settings: AppSettings | null; // Synchronize app settings (language, layout, etc)
}

interface SettingsPayload {
    type: 'settings';
    data: AppSettings;
}

type BridgePayload = StateSnapshot | SettingsPayload;

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

async function applySettings(settings: AppSettings) {
    const current = useSettingsStore.getState().settings;

    if (settings.language && settings.language !== current?.language) {
        i18n.changeLanguage(settings.language);
    }

    useSettingsStore.setState({ settings });
}

function isSettingsPayload(payload: BridgePayload): payload is SettingsPayload {
    return 'type' in payload && payload.type === 'settings';
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
        await applySettings(snapshot.settings);
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

async function applyBridgePayload(payload: BridgePayload) {
    if (isSettingsPayload(payload)) {
        await applySettings(payload.data);
        return;
    }
    await applySnapshot(payload);
}

export function useStoreBridge({ mode }: StoreBridgeOptions) {
    const broadcastRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (mode === 'broadcast') {
            let lastBroadcast = 0;
            let rafId: number | null = null;

            const doSend = () => {
                const now = Date.now();
                if (now - lastBroadcast >= 50) {
                    rafId = null;
                    lastBroadcast = now;
                    const snapshot = buildSnapshot();

                    if (isTauriRuntime()) {
                        import('@tauri-apps/api/event').then(({ emit }) => {
                            emit('state-sync', snapshot);
                        });
                    } else {
                        getElectronAPI()?.window?.broadcastState?.(snapshot);
                    }
                } else {
                    rafId = requestAnimationFrame(doSend);
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

            let unlistenRequest: (() => void) | undefined;
            if (isTauriRuntime()) {
                import('@tauri-apps/api/event').then(({ listen }) => {
                    listen('state-request', () => {
                        scheduleBroadcast();
                    }).then(fn => { unlistenRequest = fn; });
                });
            }

            broadcastRef.current = () => {
                unsubInput();
                unsubComparison();
                unsubSettings();
                unsubViewport();
                unlistenRequest?.();
                if (rafId != null) cancelAnimationFrame(rafId);
            };

            return () => broadcastRef.current?.();
        }

        if (mode === 'receive') {
            if (isTauriRuntime()) {
                let unlisten: (() => void) | undefined;
                let disposed = false;
                import('@tauri-apps/api/event').then(({ listen, emit }) => {
                    listen<BridgePayload>('state-sync', (event) => {
                        try {
                            void applyBridgePayload(event.payload);
                        } catch (e) {
                            console.warn('[StoreBridge] Failed to apply Tauri snapshot:', e);
                        }
                    }).then((fn) => {
                        if (disposed) fn();
                        else {
                            unlisten = fn;
                            // Request initial state once listener is ready
                            void emit('state-request');
                        }
                    });
                });
                return () => {
                    disposed = true;
                    unlisten?.();
                };
            } else {
                const cleanup = getElectronAPI()?.window?.onStateSync?.((raw) => {
                    try {
                        void applyBridgePayload(raw as BridgePayload);
                    } catch (e) {
                        console.warn('[StoreBridge] Failed to apply snapshot:', e);
                    }
                });
                return () => cleanup?.();
            }
        }
    }, [mode]);
}
