/**
 * PopoutPage - renders a single overlay section in a frameless child window.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { emit, listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, LogicalPosition, LogicalSize } from '@tauri-apps/api/window';
import { KeyVisualizer } from '../components/visualizer/KeyVisualizer';
import { GanttChart } from '../components/gantt/GanttChart';
import { ScoreDisplay } from '../components/comparison/ScoreDisplay';
import { FeedbackPanel } from '../components/comparison/FeedbackPanel';
import { AnalysisPanel } from '../components/comparison/AnalysisPanel';
import { useComparisonStore } from '../stores/comparisonStore';
import { useDisplayStore } from '../stores/displayStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useStoreBridge } from '../hooks/useStoreBridge';
import { useInputEvents } from '../hooks/useInputEvents';
import { isTauriRuntime } from '../lib/runtime';
import type { PopoutSection } from '../types';

interface Props {
    section: PopoutSection;
}

type PopoutConfig = {
    label: string;
    baseWidth: number;
    baseHeight: number;
    targetWidth: number;
    targetHeight: number;
    minZoom: number;
    maxZoom: number;
};

type DragState = {
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
};

type InteractionTransition = {
    from: boolean;
    to: boolean;
};

type Size = {
    width: number;
    height: number;
};

type PopoutInteractionPayload = {
    section: PopoutSection;
    interactive: boolean;
};

const POPUP_CONFIG: Record<PopoutSection, PopoutConfig> = {
    keyboard: {
        label: 'Keyboard',
        baseWidth: 920,
        baseHeight: 300,
        targetWidth: 1200,
        targetHeight: 360,
        minZoom: 55,
        maxZoom: 160,
    },
    chart: {
        label: 'Chart',
        baseWidth: 760,
        baseHeight: 220,
        targetWidth: 760,
        targetHeight: 220,
        minZoom: 55,
        maxZoom: 170,
    },
    score: {
        label: 'Score',
        baseWidth: 720,
        baseHeight: 280,
        targetWidth: 900,
        targetHeight: 320,
        minZoom: 60,
        maxZoom: 160,
    },
};

const CONTROL_RAIL_HEIGHT = 72;
const KEYBOARD_FALLBACK_SIZE: Size = { width: 1040, height: 360 };
const CHART_FALLBACK_SIZE: Size = { width: 760, height: 220 };
const KEYBOARD_MIN_WINDOW_WIDTH = 280;
const KEYBOARD_MIN_WINDOW_HEIGHT = 180;
const CHART_MIN_WINDOW_WIDTH = 520;
const CHART_MIN_WINDOW_HEIGHT = 120;
const INTERACTIVE_CONTENT_INSET_X = 8;
const LOCKED_CONTENT_INSET_X = 6;

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function ScaledContainer({
    children,
    targetWidth,
    targetHeight,
    scaleSafety = 0.96,
}: {
    children: React.ReactNode;
    targetWidth: number;
    targetHeight: number;
    scaleSafety?: number;
}) {
    const outerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    const recalc = useCallback(() => {
        const bounds = outerRef.current?.getBoundingClientRect();
        const width = bounds?.width ?? window.innerWidth;
        const height = bounds?.height ?? window.innerHeight;
        const scaleX = width / targetWidth;
        const scaleY = height / targetHeight;
        setScale(Math.max(0.1, Math.min(scaleX, scaleY) * scaleSafety));
    }, [scaleSafety, targetWidth, targetHeight]);

    useEffect(() => {
        recalc();
        const observer = new ResizeObserver(recalc);
        if (outerRef.current) observer.observe(outerRef.current);
        window.addEventListener('resize', recalc);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', recalc);
        };
    }, [recalc]);

    return (
        <div ref={outerRef} className="flex h-full w-full items-center justify-center overflow-hidden">
            <div
                style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                    width: targetWidth,
                    height: targetHeight,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {children}
            </div>
        </div>
    );
}

function KeyboardPopoutContent({
    targetSize,
    onTargetSizeChange,
}: {
    targetSize: Size;
    onTargetSizeChange: (size: Size) => void;
}) {
    const measureRef = useRef<HTMLDivElement>(null);

    const measure = useCallback(() => {
        const el = measureRef.current;
        if (!el) return;

        const width = Math.ceil(el.scrollWidth || el.getBoundingClientRect().width);
        const height = Math.ceil(el.scrollHeight || el.getBoundingClientRect().height);

        if (width > 0 && height > 0) {
            onTargetSizeChange({ width, height });
        }
    }, [onTargetSizeChange]);

    useLayoutEffect(() => {
        measure();

        const el = measureRef.current;
        if (!el) return;

        const observer = new ResizeObserver(measure);
        observer.observe(el);
        void document.fonts?.ready.then(measure);

        return () => observer.disconnect();
    }, [measure]);

    return (
        <>
            <div
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-0 opacity-0"
                style={{ width: 'max-content', height: 'max-content' }}
            >
                <div ref={measureRef} className="inline-flex">
                    <KeyVisualizer borderless fitContent />
                </div>
            </div>

            <ScaledContainer targetWidth={targetSize.width} targetHeight={targetSize.height} scaleSafety={0.99}>
                <div
                    style={{
                        width: targetSize.width,
                        height: targetSize.height,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <KeyVisualizer borderless fitContent />
                </div>
            </ScaledContainer>
        </>
    );
}

function ControlPuck({
    zoomPct,
    sectionLabel,
    isDragging,
    onPointerDown,
    onWheel,
    onReset,
    onLock,
}: {
    zoomPct: number;
    sectionLabel: string;
    isDragging: boolean;
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
    onWheel: (event: React.WheelEvent<HTMLDivElement>) => void;
    onReset: () => void;
    onLock: () => void;
}) {
    return (
        <div className="absolute left-1/2 top-2 z-[300] -translate-x-1/2">
            <div
                role="button"
                tabIndex={0}
                title="Drag to move. Wheel to resize. Double click to reset."
                onPointerDown={onPointerDown}
                onWheel={onWheel}
                onDoubleClick={onReset}
                className={`group relative flex h-[58px] w-[58px] cursor-grab select-none flex-col items-center justify-center rounded-full border text-center shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-all duration-200 active:cursor-grabbing ${
                    isDragging
                        ? 'scale-105 border-amber-300/70 bg-amber-400/18 text-amber-100 shadow-[0_0_30px_rgba(251,191,36,0.25)]'
                        : 'border-[#818cf8]/45 bg-[#111318]/78 text-white/90 hover:scale-105 hover:border-[#818cf8] hover:bg-[#181824]/90 hover:shadow-[0_0_30px_rgba(129,140,248,0.22)]'
                }`}
            >
                <div className="pointer-events-none absolute inset-1 rounded-full border border-white/8" />
                <div className="pointer-events-none text-[13px] font-black leading-none tracking-tight">{zoomPct}%</div>
                <div className="pointer-events-none mt-0.5 text-[6px] font-black uppercase tracking-[0.16em] text-[#818cf8]">
                    {sectionLabel}
                </div>
                <div className="pointer-events-none mt-0.5 flex gap-0.5 opacity-50 transition-opacity group-hover:opacity-90">
                    <span className="h-0.5 w-1 rounded-full bg-white/70" />
                    <span className="h-0.5 w-1 rounded-full bg-white/70" />
                    <span className="h-0.5 w-1 rounded-full bg-white/70" />
                </div>

                <button
                    type="button"
                    data-no-drag="true"
                    title="Lock click-through"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.stopPropagation();
                        onLock();
                    }}
                    className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-[#10b981]/45 bg-[#071411]/95 text-[#34d399] shadow-[0_10px_24px_rgba(0,0,0,0.45)] transition-all hover:scale-110 hover:border-[#34d399] hover:bg-[#0b2019]"
                >
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 7 9 18l-5-5" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

export function PopoutPage({ section }: Props) {
    const latestResult = useComparisonStore((s) => s.latestResult);
    const analysis = useComparisonStore((s) => s.analysis);
    const closePopout = useDisplayStore((s) => s.closePopout);
    const loadSettings = useSettingsStore((s) => s.loadSettings);
    const config = POPUP_CONFIG[section];
    const dragStateRef = useRef<DragState | null>(null);
    const interactionTransitionRef = useRef<InteractionTransition | null>(null);
    const [zoomPct, setZoomPct] = useState(100);
    const [isInteractive, setIsInteractive] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const [keyboardTargetSize, setKeyboardTargetSize] = useState<Size>(KEYBOARD_FALLBACK_SIZE);
    const [chartTargetSize, setChartTargetSize] = useState<Size>(CHART_FALLBACK_SIZE);
    const hasAppliedInitialSizeRef = useRef(false);

    useStoreBridge({ mode: 'receive' });
    useInputEvents();

    const resizeWindowForZoom = useCallback(async (nextZoom: number, transition?: InteractionTransition | null) => {
        if (!isTauriRuntime()) return;

        const currentInteractive = transition?.from ?? isInteractive;
        const nextInteractive = transition?.to ?? isInteractive;
        const zoomRatio = nextZoom / 100;
        const keyboardPaddingX = nextInteractive ? 16 : 12;
        const keyboardPaddingY = nextInteractive ? 8 : 12;
        const contentPaddingX = nextInteractive ? 16 : 12;
        const contentPaddingY = nextInteractive ? 8 : 12;
        const nextWidth = section === 'keyboard'
            ? Math.max(KEYBOARD_MIN_WINDOW_WIDTH, Math.round(keyboardTargetSize.width * zoomRatio) + keyboardPaddingX)
            : section === 'chart'
                ? Math.max(CHART_MIN_WINDOW_WIDTH, Math.round(chartTargetSize.width * zoomRatio) + contentPaddingX)
            : Math.round(config.baseWidth * zoomRatio);
        const nextHeight = section === 'keyboard'
            ? Math.max(
                KEYBOARD_MIN_WINDOW_HEIGHT,
                Math.round(keyboardTargetSize.height * zoomRatio) + keyboardPaddingY + (nextInteractive ? CONTROL_RAIL_HEIGHT : 0)
            )
            : section === 'chart'
                ? Math.max(
                    CHART_MIN_WINDOW_HEIGHT,
                    Math.round(chartTargetSize.height * zoomRatio) + contentPaddingY + (nextInteractive ? CONTROL_RAIL_HEIGHT : 0)
                )
            : Math.round(config.baseHeight * zoomRatio) + (nextInteractive ? CONTROL_RAIL_HEIGHT : 0);
        const currentRailHeight = currentInteractive ? CONTROL_RAIL_HEIGHT : 0;
        const nextRailHeight = nextInteractive ? CONTROL_RAIL_HEIGHT : 0;
        const currentInsetX = currentInteractive ? INTERACTIVE_CONTENT_INSET_X : LOCKED_CONTENT_INSET_X;
        const nextInsetX = nextInteractive ? INTERACTIVE_CONTENT_INSET_X : LOCKED_CONTENT_INSET_X;
        const centerX = window.screenX + (window.outerWidth / 2);
        const centerY = window.screenY + (window.outerHeight / 2);
        const keepChartTop = section === 'chart' && !transition && hasAppliedInitialSizeRef.current;
        const nextLeft = transition
            ? Math.round(window.screenX + currentInsetX - nextInsetX)
            : Math.round(centerX - (nextWidth / 2));
        const nextTop = transition
            ? Math.round(window.screenY + currentRailHeight - nextRailHeight)
            : keepChartTop
                ? Math.round(window.screenY)
            : Math.round(centerY - (nextHeight / 2));
        const win = getCurrentWindow();

        await win.setSize(new LogicalSize(nextWidth, nextHeight));
        await win.setPosition(new LogicalPosition(nextLeft, nextTop));
        hasAppliedInitialSizeRef.current = true;
    }, [chartTargetSize.height, chartTargetSize.width, config.baseHeight, config.baseWidth, isInteractive, keyboardTargetSize.height, keyboardTargetSize.width, section]);

    useEffect(() => {
        loadSettings();
        document.title = `KeyFlow - ${config.label}`;
    }, [config.label, loadSettings]);

    useEffect(() => {
        const transition = interactionTransitionRef.current;
        interactionTransitionRef.current = null;
        void resizeWindowForZoom(zoomPct, transition);
    }, [resizeWindowForZoom, section, zoomPct]);

    useEffect(() => {
        if (isTauriRuntime()) {
            void getCurrentWindow().setIgnoreCursorEvents(!isInteractive);
        }
    }, [isInteractive]);

    useEffect(() => {
        if (!isTauriRuntime()) return;

        let unlistenRestore: (() => void) | undefined;
        let unlistenInteraction: (() => void) | undefined;
        let disposed = false;

        listen('popout-restore', async () => {
            const win = getCurrentWindow();
            await win.setAlwaysOnTop(true);
            await win.setIgnoreCursorEvents(false);
            await win.center();
            hasAppliedInitialSizeRef.current = false;
            setZoomPct(100);
            setIsInteractive((prev) => {
                if (prev) return prev;
                interactionTransitionRef.current = { from: prev, to: true };
                return true;
            });
        }).then((fn) => {
            if (disposed) fn();
            else unlistenRestore = fn;
        });

        listen<PopoutInteractionPayload>('popout-interaction-changed', (event) => {
            if (event.payload.section === section) {
                setIsInteractive((prev) => {
                    if (prev === event.payload.interactive) return prev;
                    interactionTransitionRef.current = { from: prev, to: event.payload.interactive };
                    return event.payload.interactive;
                });
            }
        }).then((fn) => {
            if (disposed) fn();
            else unlistenInteraction = fn;
        });

        return () => {
            disposed = true;
            unlistenRestore?.();
            unlistenInteraction?.();
        };
    }, [section]);

    const updateZoom = useCallback((nextZoom: number) => {
        setZoomPct(clamp(Math.round(nextZoom / 5) * 5, config.minZoom, config.maxZoom));
    }, [config.maxZoom, config.minZoom]);

    const handleKeyboardTargetSizeChange = useCallback((nextSize: Size) => {
        setKeyboardTargetSize((prev) => (
            Math.abs(prev.width - nextSize.width) < 1 && Math.abs(prev.height - nextSize.height) < 1
                ? prev
                : nextSize
        ));
    }, []);

    const handleChartTargetSizeChange = useCallback((nextSize: Size) => {
        setChartTargetSize((prev) => (
            Math.abs(prev.width - nextSize.width) < 1 && Math.abs(prev.height - nextSize.height) < 1
                ? prev
                : nextSize
        ));
    }, []);

    const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        updateZoom(zoomPct + (event.deltaY < 0 ? 5 : -5));
    };

    const handlePuckPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if ((event.target as HTMLElement).closest('[data-no-drag="true"]')) return;

        // CRITICAL FIX: Do NOT call preventDefault() or stopPropagation() here!
        // Calling preventDefault on pointerdown stops the browser from firing mousedown/mouseup events.
        // This breaks the global DOM Fallback mechanism in useInputEvents.ts, which relies on mousedown/mouseup 
        // to catch inputs when the Tauri window is focused (since rdev on Windows misses local process events).
        // If those events are blocked, fast clicks will drop the UP event and cause stuck keys!
        
        dragStateRef.current = {
            startX: event.screenX,
            startY: event.screenY,
            startLeft: window.screenX,
            startTop: window.screenY,
        };
        setIsDragging(true);

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const dragState = dragStateRef.current;
            if (!dragState) return;

            const nextLeft = dragState.startLeft + (moveEvent.screenX - dragState.startX);
            const nextTop = dragState.startTop + (moveEvent.screenY - dragState.startY);
            void getCurrentWindow().setPosition(new LogicalPosition(nextLeft, nextTop));
        };

        const handlePointerUp = () => {
            dragStateRef.current = null;
            setIsDragging(false);
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
        };

        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
    };

    const handleLockClickThrough = async () => {
        setIsInteractive((prev) => {
            if (!prev) return prev;
            interactionTransitionRef.current = { from: prev, to: false };
            return false;
        });
        if (isTauriRuntime()) {
            await getCurrentWindow().setIgnoreCursorEvents(true);
            await emit('popout-interaction-changed', { section, interactive: false });
        }
    };

    const handleClose = async () => {
        if (isTauriRuntime()) {
            await invoke('popout_close', { section });
            closePopout(section, false);
        } else {
            closePopout(section);
        }
    };

    const contentClassName = isInteractive
        ? 'absolute inset-x-0 bottom-0 z-10 min-h-0 overflow-hidden px-2 pb-2'
        : 'relative z-10 h-full w-full min-h-0 overflow-hidden p-1.5';
    const contentStyle = isInteractive ? { top: CONTROL_RAIL_HEIGHT } : undefined;

    return (
        <div className="relative h-screen w-screen overflow-hidden bg-transparent">
            <style>
                {`
                html, body, #root, main {
                    background: transparent !important;
                    background-color: transparent !important;
                }
                .kf-panel {
                    background: transparent !important;
                }
                `}
            </style>

            {isInteractive && (
                <>
                    <div
                        className="pointer-events-none absolute inset-x-0 top-0 z-[240] border-b border-white/5 bg-black/[0.03]"
                        style={{ height: CONTROL_RAIL_HEIGHT }}
                    />
                    <div className="pointer-events-none absolute inset-0 z-[250] rounded-[14px] border border-amber-300/20 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]" />
                    <ControlPuck
                        zoomPct={zoomPct}
                        sectionLabel={config.label}
                        isDragging={isDragging}
                        onPointerDown={handlePuckPointerDown}
                        onWheel={handleWheel}
                        onReset={() => updateZoom(100)}
                        onLock={handleLockClickThrough}
                    />
                </>
            )}

            <div className={contentClassName} style={contentStyle}>
                {section === 'keyboard' && (
                    <KeyboardPopoutContent
                        targetSize={keyboardTargetSize}
                        onTargetSizeChange={handleKeyboardTargetSizeChange}
                    />
                )}

                {section === 'chart' && (
                    <div className="h-full w-full">
                        <GanttChart fitContent onContentSizeChange={handleChartTargetSizeChange} />
                    </div>
                )}

                {section === 'score' && (
                    <div className="h-full w-full overflow-hidden">
                        {latestResult ? (
                            <ScaledContainer targetWidth={config.targetWidth} targetHeight={config.targetHeight}>
                                <div className="flex items-start gap-4">
                                    <ScoreDisplay result={latestResult} />
                                    <FeedbackPanel errors={latestResult.errors} />
                                    {analysis && <AnalysisPanel analysis={analysis} />}
                                </div>
                            </ScaledContainer>
                        ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                                <svg className="h-12 w-12 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 22V4a2 2 0 0 1 4 0v18" /><path d="M10 14h4" /></svg>
                                <p className="text-xs font-black uppercase tracking-widest text-[#444]">
                                    No results yet - complete a session
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {isInteractive && (
                <button
                    type="button"
                    onClick={handleClose}
                    className="absolute right-3 top-3 z-[300] flex h-8 w-8 items-center justify-center rounded-full border border-red-400/30 bg-red-500/10 text-red-300 shadow-[0_12px_30px_rgba(0,0,0,0.45)] transition-all hover:scale-105 hover:border-red-300 hover:bg-red-500/20"
                    title="Close popout"
                >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                    </svg>
                </button>
            )}
        </div>
    );
}
