/**
 * GanttChart — Context provider and container for the GanttCanvas.
 */

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInputStore } from '../../stores/inputStore';
import { useComparisonStore } from '../../stores/comparisonStore';
import { useViewportStore } from '../../stores/viewportStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useGantt } from '../../hooks/useGantt';
import { CHART_FOCUS_KEY_OPTIONS, DEFAULT_CHART_FOCUS_KEYS, filterGanttRowsForChartFocus } from '../../lib/ganttFocus';
import { getDisplayLabel } from '../../lib/patternUtils';
import { isTauriRuntime } from '../../lib/runtime';
import { GanttCanvas } from './GanttCanvas';
import type { AppSettings } from '../../types';

const RULER_HEIGHT = 24;
const TOOLBAR_HEIGHT = 34;
const DEFAULT_CHART_WIDTH = 760;

interface GanttChartProps {
    fitContent?: boolean;
    onContentSizeChange?: (size: { width: number; height: number }) => void;
}

export function GanttChart({ fitContent = false, onContentSizeChange }: GanttChartProps = {}) {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const presses = useInputStore((s) => s.presses);
    const status = useInputStore((s) => s.status);
    const activePattern = useComparisonStore((s) => s.activePattern);
    const settings = useSettingsStore((s) => s.settings);
    const updateSettings = useSettingsStore((s) => s.updateSettings);
    const clearChart = useInputStore((s) => s.clearChart);
    const ganttRowHeight = settings?.ganttRowHeight ?? 28;
    const defaultZoomMs = settings?.defaultZoomMs ?? 5000;
    const chartFilterMode = settings?.chartFilterMode ?? 'focus';
    const chartFocusKeys = settings?.chartFocusKeys ?? DEFAULT_CHART_FOCUS_KEYS;
    const userRows = useGantt();
    const [scrollY, setScrollY] = useState(0);
    const [isKeyPickerOpen, setIsKeyPickerOpen] = useState(false);

    const { viewport, setViewport, zoom } = useViewportStore();
    const autoScrollPausedRef = useRef(false);
    const practiceSpeed = useComparisonStore((s) => s.practiceSpeed);
    const scaledPatternEvents = useMemo(() => activePattern?.events.map(pe => {
        const scaledStart = pe.startTime / practiceSpeed;
        return {
            ...pe,
            startTime: scaledStart,
            endTime: scaledStart + pe.duration,
            duration: pe.duration,
        };
    }) ?? [], [activePattern, practiceSpeed]);

    const focusedChart = useMemo(() => filterGanttRowsForChartFocus({
        rows: userRows,
        patternEvents: scaledPatternEvents,
        mode: chartFilterMode,
        focusKeys: chartFocusKeys,
        otherLabel: t('gantt.other_inputs', { defaultValue: 'Other' }) as string,
    }), [chartFilterMode, chartFocusKeys, scaledPatternEvents, t, userRows]);

    const displayedRows = focusedChart.rows;
    const displayedPatternEvents = focusedChart.patternEvents;
    const trackedKeys = focusedChart.allowedKeys;

    const availableFocusKeys = useMemo(() => {
        const keys = new Set<string>([
            ...CHART_FOCUS_KEY_OPTIONS,
            ...chartFocusKeys,
            ...userRows.map((row) => row.key),
            ...scaledPatternEvents.map((event) => event.key),
        ]);
        return Array.from(keys).map((key) => ({
            key,
            label: getDisplayLabel(key),
            selected: chartFocusKeys.includes(key),
        }));
    }, [chartFocusKeys, scaledPatternEvents, userRows]);

    // Calculate pixelsPerMs when container resizes
    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(([entry]) => {
            const availableWidth = entry.contentRect.width - 100;
            setViewport({
                pixelsPerMs: availableWidth / (viewport.endMs - viewport.startMs),
            });
        });
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [viewport.startMs, viewport.endMs]);

    // Auto-scroll while recording (continuous smooth scrolling)
    useEffect(() => {
        if (status !== 'recording') return;

        let reqId: number;
        const loop = () => {
            reqId = requestAnimationFrame(loop);

            const state = useInputStore.getState();
            if (state.status !== 'recording') return;
            if (state.startOnFirstInput && !state.hasFirstInput) return;

            let currentMs = Date.now() - state.sessionBaseTime;
            if (state.startOnFirstInput) currentMs -= state.startOffset;

            const vState = useViewportStore.getState();
            const { viewport, setViewport, playheadOffset } = vState;
            const visibleRange = viewport.endMs - viewport.startMs;

            // Continuous Smooth Scrolling: Keep the current time at the chosen playheadOffset
            setViewport({
                startMs: Math.max(0, currentMs - visibleRange * playheadOffset),
                endMs: Math.max(visibleRange, currentMs + visibleRange * (1 - playheadOffset)),
            });
        };

        reqId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(reqId);
    }, [status]);

    // Freestyle mode: jump viewport forward when latest press exceeds visible range
    useEffect(() => {
        if (status !== 'idle' || presses.length === 0) return;

        let lastTrackedPress: typeof presses[number] | undefined;
        for (let i = presses.length - 1; i >= 0; i -= 1) {
            const press = presses[i];
            if (chartFilterMode === 'all' || trackedKeys?.has(press.key)) {
                lastTrackedPress = press;
                break;
            }
        }
        if (!lastTrackedPress) return;

        const latestMs = lastTrackedPress.endTime ?? lastTrackedPress.startTime;

        // If the latest press is beyond the current viewport, jump forward
        const vp = useViewportStore.getState().viewport;

        // If this is a new key press (or key release), we re-enable auto scroll
        autoScrollPausedRef.current = false;
        if (latestMs > vp.endMs) {
            const visibleRange = vp.endMs - vp.startMs;
            setViewport({
                startMs: latestMs - visibleRange * 0.1, // Show latest press near the left with 10% margin
                endMs: latestMs - visibleRange * 0.1 + visibleRange,
            });
        }
    }, [chartFilterMode, presses, status, trackedKeys, setViewport]);

    // Freestyle: also jump viewport when an active (held) bar grows beyond the viewport
    useEffect(() => {
        if (status !== 'idle') return;
        const state = useInputStore.getState();
        if (state.freestyleBaseTime === 0 || state.activeKeys.size === 0) return;

        let reqId: number;
        const check = () => {
            reqId = requestAnimationFrame(check);
            if (autoScrollPausedRef.current) return;
            const s = useInputStore.getState();
            if (s.status !== 'idle' || s.freestyleBaseTime === 0 || s.activeKeys.size === 0) return;
            if (chartFilterMode === 'focus') {
                const hasTrackedActiveKey = Array.from(s.activeKeys.keys()).some((key) => trackedKeys?.has(key));
                if (!hasTrackedActiveKey) return;
            }

            const currentMs = (performance.timeOrigin + performance.now()) - s.freestyleBaseTime;
            const vp = useViewportStore.getState().viewport;

            if (currentMs > vp.endMs) {
                const visibleRange = vp.endMs - vp.startMs;
                useViewportStore.getState().setViewport({
                    startMs: currentMs - visibleRange * 0.1,
                    endMs: currentMs - visibleRange * 0.1 + visibleRange,
                });
            }
        };

        reqId = requestAnimationFrame(check);
        return () => cancelAnimationFrame(reqId);
    }, [chartFilterMode, status, presses, trackedKeys]); // re-trigger when presses change (new key held)

    // Zoom and Pan
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (e.ctrlKey) {
                // Zoom
                const factor = e.deltaY > 0 ? 1.2 : 0.8;
                const rect = el.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                // Timeline starts after the label column (usually 60px)
                const timelineX = Math.max(0, mouseX - 60);
                const anchorMs = viewport.startMs + timelineX / (viewport.pixelsPerMs || 1);

                zoom(factor, anchorMs);
            } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                // Pan Horizontally
                autoScrollPausedRef.current = true;
                const delta = e.deltaX || (e.shiftKey ? e.deltaY : 0);
                const shiftMs = delta / (viewport.pixelsPerMs || 1);
                setViewport({
                    startMs: Math.max(0, viewport.startMs + shiftMs),
                    endMs: Math.max(viewport.endMs - viewport.startMs, viewport.endMs + shiftMs),
                });
            } else {
                // Pan Vertically
                const allKeys = new Set(displayedRows.map(r => r.key));
                displayedPatternEvents.forEach(pe => allKeys.add(pe.key));
                const totalRows = allKeys.size;
                const maxScrollY = Math.max(0, 24 + totalRows * ganttRowHeight - (el.clientHeight || 0));

                setScrollY(prev => Math.max(0, Math.min(maxScrollY, prev + e.deltaY)));
            }
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [viewport, setViewport, zoom, displayedRows, displayedPatternEvents, ganttRowHeight]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const totalRows = new Set([
            ...displayedRows.map((row) => row.key),
            ...displayedPatternEvents.map((event) => event.key),
        ]).size;
        const maxScrollY = Math.max(0, 24 + totalRows * ganttRowHeight - (el.clientHeight || 0));
        setScrollY((prev) => Math.min(prev, maxScrollY));
    }, [displayedRows, displayedPatternEvents, ganttRowHeight]);

    useEffect(() => {
        if (!onContentSizeChange) return;

        const rowCount = Math.max(1, displayedRows.length);
        onContentSizeChange({
            width: DEFAULT_CHART_WIDTH,
            height: TOOLBAR_HEIGHT + RULER_HEIGHT + rowCount * ganttRowHeight + 2,
        });
    }, [displayedRows.length, ganttRowHeight, onContentSizeChange]);

    const handleModeChange = (mode: AppSettings['chartFilterMode']) => {
        void updateSettings({ chartFilterMode: mode });
    };

    const handleKeyToggle = (key: string) => {
        const nextKeys = chartFocusKeys.includes(key)
            ? chartFocusKeys.filter((item) => item !== key)
            : [...chartFocusKeys, key];
        void updateSettings({ chartFocusKeys: nextKeys });
    };

    const handleResetFocusKeys = () => {
        void updateSettings({ chartFocusKeys: DEFAULT_CHART_FOCUS_KEYS });
    };

    return (
        <div
            data-fit-content={fitContent ? 'true' : undefined}
            className="relative flex h-full w-full flex-col overflow-visible rounded-lg border border-[#333] bg-transparent kf-panel"
        >
            <div className="relative z-20 flex h-[34px] flex-shrink-0 items-center justify-end gap-1 border-b border-white/10 bg-[#111]/82 px-2 backdrop-blur">
                <div className="flex items-center rounded-md border border-white/10 bg-black/20 p-0.5">
                    <button
                        type="button"
                        onPointerDown={() => handleModeChange('focus')}
                        className={`h-6 px-2 text-[9px] font-black uppercase tracking-wider transition-all rounded ${chartFilterMode === 'focus'
                            ? 'bg-[#6366f1] text-white'
                            : 'text-[#777] hover:bg-white/5 hover:text-white'
                        }`}
                    >
                        {t('gantt.focus_mode', { defaultValue: 'Focus' }) as string}
                    </button>
                    <button
                        type="button"
                        onPointerDown={() => handleModeChange('all')}
                        className={`h-6 px-2 text-[9px] font-black uppercase tracking-wider transition-all rounded ${chartFilterMode === 'all'
                            ? 'bg-[#6366f1] text-white'
                            : 'text-[#777] hover:bg-white/5 hover:text-white'
                        }`}
                    >
                        {t('gantt.all_mode', { defaultValue: 'All' }) as string}
                    </button>
                </div>

                <button
                    type="button"
                    disabled={chartFilterMode === 'all'}
                    onPointerDown={() => setIsKeyPickerOpen((open) => !open)}
                    className="h-7 rounded-md border border-white/10 bg-[#181818] px-2 text-[9px] font-black uppercase tracking-wider text-[#d4d4d4] outline-none transition-all hover:border-[#6366f1]/60 hover:bg-[#202020] disabled:cursor-not-allowed disabled:opacity-35"
                >
                    {t('gantt.visible_keys', { defaultValue: 'Keys' }) as string} {chartFocusKeys.length}
                </button>

                {chartFilterMode === 'focus' && focusedChart.hiddenPressCount > 0 && (
                    <span className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-1 text-[9px] font-black uppercase tracking-wider text-[#888]">
                        {focusedChart.hiddenPressCount}
                    </span>
                )}

                <div className="h-5 w-px bg-white/10 mx-0.5" />

                <button
                    onPointerDown={() => { 
                        clearChart(); 
                        useViewportStore.getState().setViewport({ startMs: 0, endMs: defaultZoomMs }); 
                        if (isTauriRuntime()) {
                            import('@tauri-apps/api/event').then(({ emit }) => emit('cmd-clear-chart'));
                        }
                    }}
                    title={t('practice.clear_chart')}
                    className="p-1.5 rounded-lg text-[#777] hover:text-red-400 hover:bg-red-400/10 transition-all border border-transparent hover:border-red-400/20"
                >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                </button>
            </div>

            {isKeyPickerOpen && chartFilterMode === 'focus' && (
                <div className="absolute right-2 top-[38px] z-30 w-[720px] max-w-[calc(100vw-2rem)] rounded-lg border border-[#333] bg-[#111]/95 p-3 shadow-2xl backdrop-blur-xl">
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#a3a3a3]">
                            {t('gantt.visible_keys', { defaultValue: 'Visible keys' }) as string}
                        </span>
                        <button
                            type="button"
                            onClick={handleResetFocusKeys}
                            className="rounded border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#777] transition-all hover:border-[#6366f1]/40 hover:text-white"
                        >
                            {t('gantt.reset_focus_keys', { defaultValue: 'Reset' }) as string}
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {availableFocusKeys.map((option) => (
                            <button
                                key={option.key}
                                type="button"
                                onClick={() => handleKeyToggle(option.key)}
                                title={option.key}
                                className={`h-7 px-2.5 rounded-md border text-[10px] font-black uppercase tracking-wider transition-all ${option.selected
                                    ? 'border-[#6366f1] bg-[#6366f1]/25 text-white shadow-[0_0_14px_rgba(99,102,241,0.18)]'
                                    : 'border-white/10 bg-white/[0.03] text-[#888] hover:border-white/25 hover:text-white'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div
                ref={containerRef}
                className="min-h-0 flex-1 w-full overflow-hidden"
            >
                <GanttCanvas
                    userRows={displayedRows}
                    patternEvents={displayedPatternEvents}
                    viewport={viewport}
                    playheadOffset={useViewportStore((s) => s.playheadOffset)}
                    scrollY={scrollY}
                />
            </div>
        </div>
    );
}

