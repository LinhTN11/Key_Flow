/**
 * GanttChart — Context provider and container for the GanttCanvas.
 */

import React, { useRef, useEffect, useState } from 'react';
import { useInputStore } from '../../stores/inputStore';
import { useComparisonStore } from '../../stores/comparisonStore';
import { useViewportStore } from '../../stores/viewportStore';
import { useGantt } from '../../hooks/useGantt';
import { GanttCanvas } from './GanttCanvas';

export function GanttChart() {
    const containerRef = useRef<HTMLDivElement>(null);
    const presses = useInputStore((s) => s.presses);
    const status = useInputStore((s) => s.status);
    const activePattern = useComparisonStore((s) => s.activePattern);
    const userRows = useGantt();
    const [scrollY, setScrollY] = useState(0);

    const { viewport, setViewport, zoom } = useViewportStore();

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

        const lastPress = presses[presses.length - 1];
        const latestMs = lastPress.endTime ?? lastPress.startTime;

        // If the latest press is beyond the current viewport, jump forward
        if (latestMs > viewport.endMs) {
            const visibleRange = viewport.endMs - viewport.startMs;
            setViewport({
                startMs: latestMs - visibleRange * 0.1, // Show latest press near the left with 10% margin
                endMs: latestMs - visibleRange * 0.1 + visibleRange,
            });
        }
    }, [presses, status]);

    // Freestyle: also jump viewport when an active (held) bar grows beyond the viewport
    useEffect(() => {
        if (status !== 'idle') return;
        const state = useInputStore.getState();
        if (state.freestyleBaseTime === 0 || state.activeKeys.size === 0) return;

        let reqId: number;
        const check = () => {
            reqId = requestAnimationFrame(check);
            const s = useInputStore.getState();
            if (s.status !== 'idle' || s.freestyleBaseTime === 0 || s.activeKeys.size === 0) return;

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
    }, [status, presses]); // re-trigger when presses change (new key held)

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
                const delta = e.deltaX || (e.shiftKey ? e.deltaY : 0);
                const shiftMs = delta / (viewport.pixelsPerMs || 1);
                setViewport({
                    startMs: Math.max(0, viewport.startMs + shiftMs),
                    endMs: Math.max(viewport.endMs - viewport.startMs, viewport.endMs + shiftMs),
                });
            } else {
                // Pan Vertically
                const allKeys = new Set(userRows.map(r => r.key));
                activePattern?.events.forEach(pe => allKeys.add(pe.key));
                const totalRows = allKeys.size;
                const maxScrollY = Math.max(0, 24 + totalRows * 28 - (el.clientHeight || 0));

                setScrollY(prev => Math.max(0, Math.min(maxScrollY, prev + e.deltaY)));
            }
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [viewport, setViewport, zoom, userRows, activePattern]);

    const practiceSpeed = useComparisonStore((s) => s.practiceSpeed);
    const scaledPatternEvents = activePattern?.events.map(pe => {
        const scaledStart = pe.startTime / practiceSpeed;
        return {
            ...pe,
            startTime: scaledStart,
            endTime: scaledStart + pe.duration,
            duration: pe.duration,
        };
    }) ?? [];

    return (
        <div
            ref={containerRef}
            className="w-full h-full bg-transparent rounded-lg border border-[#333] overflow-hidden kf-panel"
        >
            <GanttCanvas
                userRows={userRows}
                patternEvents={scaledPatternEvents}
                viewport={viewport}
                playheadOffset={useViewportStore((s) => s.playheadOffset)}
                scrollY={scrollY}
            />
        </div>
    );
}

