/**
 * GanttCanvas — The performance-critical Konva renderer for the Gantt chart.
 * Uses pure Konva without React re-renders for smooth 60fps animations.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Konva from 'konva';
import type { GanttRow, GanttViewport, PatternEvent, GanttBar } from '../../types';
import { useInputStore } from '../../stores/inputStore';
import { useViewportStore } from '../../stores/viewportStore';
import { useComparisonStore } from '../../stores/comparisonStore';

const ROW_HEIGHT = 28;
const ROW_PADDING = 4;
const LABEL_WIDTH = 100;
const BAR_RADIUS = 4;
const RULER_HEIGHT = 24;

interface Props {
    userRows: GanttRow[];
    patternEvents: PatternEvent[];
    viewport: GanttViewport;
    playheadOffset: number;
    scrollY: number;
}

export function GanttCanvas({ userRows, patternEvents, viewport, playheadOffset, scrollY }: Props) {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<Konva.Stage | null>(null);
    const barLayerRef = useRef<Konva.Layer | null>(null);
    const labelLayerRef = useRef<Konva.Layer | null>(null);
    const annotationLayerRef = useRef<Konva.Layer | null>(null); // NEW TOP LAYER FOR ERRORS
    const overlayLayerRef = useRef<Konva.Layer | null>(null);
    const playheadLayerRef = useRef<Konva.Layer | null>(null);
    const rulerLayerRef = useRef<Konva.Layer | null>(null);

    // Detect popup mode — use transparent backgrounds so window transparency shows through
    const isPopout = document.documentElement.hasAttribute('data-popout');
    const BG_RULER = isPopout ? 'rgba(15,15,15,0.55)' : '#0f0f0f';
    const BG_LABEL = isPopout ? 'rgba(26,26,26,0.55)' : '#1a1a1a';
    const BG_STAGE = isPopout ? 'transparent' : '#1a1a1a';

    const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

    // 1. Initialize Stage and Layers
    useEffect(() => {
        if (!containerRef.current) return;
        const { clientWidth, clientHeight } = containerRef.current;

        const stage = new Konva.Stage({
            container: containerRef.current,
            width: clientWidth,
            height: clientHeight,
        });
        // Make Konva's own canvas background transparent so Electron window transparency shows
        (stage as any).content.style.background = 'transparent';

        // Native hardware clipping
        const rulerLayer = new Konva.Layer({
            clipX: LABEL_WIDTH, clipY: 0, clipWidth: clientWidth - LABEL_WIDTH, clipHeight: RULER_HEIGHT
        });
        const overlayLayer = new Konva.Layer({
            clipX: LABEL_WIDTH, clipY: RULER_HEIGHT, clipWidth: clientWidth - LABEL_WIDTH, clipHeight: clientHeight - RULER_HEIGHT
        });
        const barLayer = new Konva.Layer({
            clipX: LABEL_WIDTH, clipY: RULER_HEIGHT, clipWidth: clientWidth - LABEL_WIDTH, clipHeight: clientHeight - RULER_HEIGHT
        });
        const annotationLayer = new Konva.Layer({
            clipX: LABEL_WIDTH, clipY: RULER_HEIGHT, clipWidth: clientWidth - LABEL_WIDTH, clipHeight: clientHeight - RULER_HEIGHT
        });
        const playheadLayer = new Konva.Layer({
            clipX: LABEL_WIDTH, clipY: 0, clipWidth: clientWidth - LABEL_WIDTH, clipHeight: clientHeight
        });
        const labelLayer = new Konva.Layer({
            clipX: 0, clipY: RULER_HEIGHT, clipWidth: clientWidth, clipHeight: clientHeight - RULER_HEIGHT
        });

        // Add in z-index order (bottom to top)
        stage.add(rulerLayer);
        stage.add(overlayLayer);
        stage.add(barLayer);
        stage.add(annotationLayer); // Highlighting shows on top of bars
        stage.add(labelLayer);
        stage.add(playheadLayer);

        // Initial Playhead line & handle
        const vState = useViewportStore.getState();
        const timelineWidth = clientWidth - LABEL_WIDTH;
        const playheadX = LABEL_WIDTH + (timelineWidth * vState.playheadOffset);

        const playheadGroup = new Konva.Group({
            x: playheadX,
            y: 0,
            draggable: true,
            name: 'playhead-group',
            dragBoundFunc: (pos) => {
                const stageW = stageRef.current?.width() || clientWidth;
                return {
                    x: Math.max(LABEL_WIDTH, Math.min(stageW - 20, pos.x)),
                    y: 0
                };
            }
        });

        const line = new Konva.Line({
            points: [0, RULER_HEIGHT, 0, clientHeight],
            stroke: '#ef4444',
            strokeWidth: 2,
            dash: [4, 4],
            listening: false,
            name: 'playhead-line',
        });

        const handle = new Konva.RegularPolygon({
            x: 0,
            y: RULER_HEIGHT / 2,
            sides: 3,
            radius: 8,
            fill: '#ef4444',
            rotation: 180,
            shadowBlur: 5,
            shadowColor: 'black',
            cursor: 'ew-resize',
        });

        playheadGroup.add(line, handle);
        playheadLayer.add(playheadGroup);
        playheadLayer.draw();

        playheadGroup.on('dragmove', () => {
            const stageW = stageRef.current?.width() || clientWidth;
            const currentX = playheadGroup.x();
            const newOffset = (currentX - LABEL_WIDTH) / (stageW - LABEL_WIDTH);
            useViewportStore.getState().setPlayheadOffset(newOffset);
        });

        playheadGroup.on('mouseenter', () => {
            document.body.style.cursor = 'ew-resize';
        });
        playheadGroup.on('mouseleave', () => {
            document.body.style.cursor = 'default';
        });

        stageRef.current = stage;
        overlayLayerRef.current = overlayLayer;
        barLayerRef.current = barLayer;
        annotationLayerRef.current = annotationLayer;
        labelLayerRef.current = labelLayer;
        playheadLayerRef.current = playheadLayer;
        rulerLayerRef.current = rulerLayer;

        // Handle container resize
        const ro = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            stage.width(width);
            stage.height(height);

            const vStore = useViewportStore.getState();
            const newTimelineW = width - LABEL_WIDTH;
            const newPlayheadX = LABEL_WIDTH + (newTimelineW * vStore.playheadOffset);

            // Update native clip paths
            rulerLayer.clipWidth(newTimelineW);
            rulerLayer.clipHeight(RULER_HEIGHT);

            [overlayLayer, barLayer, annotationLayer].forEach(l => {
                l.clipWidth(newTimelineW);
                l.clipHeight(height - RULER_HEIGHT);
            });

            labelLayer.clipWidth(width);
            labelLayer.clipHeight(height - RULER_HEIGHT);

            playheadLayer.clipWidth(newTimelineW);
            playheadLayer.clipHeight(height);

            // Resync playhead group position and line height
            playheadGroup.x(newPlayheadX);
            line.points([0, RULER_HEIGHT, 0, height]);

            stage.batchDraw();
        });
        ro.observe(containerRef.current);

        return () => {
            ro.disconnect();
            stage.destroy();
        };
    }, []);

    // 2. Render Ruler (Time Axis)
    useEffect(() => {
        const layer = rulerLayerRef.current;
        if (!layer || !stageRef.current) return;
        layer.destroyChildren();

        const stageW = stageRef.current.width();

        layer.add(new Konva.Rect({
            x: 0, y: 0, width: stageW, height: RULER_HEIGHT, fill: BG_RULER
        }));
        layer.add(new Konva.Line({
            points: [LABEL_WIDTH, RULER_HEIGHT, stageW, RULER_HEIGHT], stroke: '#333', strokeWidth: 1
        }));

        // Dynamic tick scaling
        const rangeMs = viewport.endMs - viewport.startMs;
        let tickInterval = 500;
        let isMajorTick = (t: number) => t % 1000 === 0;
        let format = (t: number) => `${(t / 1000).toFixed(1)}s`;

        if (rangeMs <= 500) {
            tickInterval = 50;
            isMajorTick = (t) => t % 100 === 0;
            format = (t) => `${Math.round(t)}ms`;
        } else if (rangeMs <= 5000) {
            tickInterval = 500;
            isMajorTick = (t) => t % 1000 === 0;
            format = (t) => `${(t / 1000).toFixed(1)}s`;
        } else if (rangeMs <= 30000) {
            tickInterval = 5000;
            isMajorTick = (t) => t % 10000 === 0;
            format = (t) => `${Math.floor(t / 1000)}s`;
        } else if (rangeMs <= 120000) {
            tickInterval = 10000;
            isMajorTick = (t) => t % 30000 === 0;
            format = (t) => `${Math.floor(t / 1000)}s`;
        } else {
            tickInterval = 60000;
            isMajorTick = () => true;
            format = (t) => `${Math.floor(t / 60000)}m`;
        }

        const startTick = Math.floor(viewport.startMs / tickInterval) * tickInterval;
        const endTick = Math.ceil(viewport.endMs / tickInterval) * tickInterval;

        for (let time = startTick; time <= endTick; time += tickInterval) {
            if (time < 0) continue;
            const x = LABEL_WIDTH + (time - viewport.startMs) * viewport.pixelsPerMs;
            const major = isMajorTick(time);

            layer.add(new Konva.Line({
                points: [x, RULER_HEIGHT - (major ? 10 : 5), x, RULER_HEIGHT],
                stroke: '#888', strokeWidth: 1
            }));

            if (major) {
                layer.add(new Konva.Text({
                    x: x + 4, y: 4, text: format(time), fontSize: 10, fill: '#a3a3a3'
                }));
            }
        }

        // Draw Start/End Mocks
        const endX = Math.min(LABEL_WIDTH + (viewport.endMs - viewport.startMs) * viewport.pixelsPerMs, stageW - 5);

        layer.add(new Konva.Text({
            x: LABEL_WIDTH + 4, y: RULER_HEIGHT - 12, text: format(viewport.startMs), fontSize: 10, fill: '#ef4444', fontStyle: 'bold'
        }));

        layer.batchDraw();
    }, [viewport]);

    // 3. Render User Rows & Bars
    useEffect(() => {
        const layer = barLayerRef.current;
        const labelLayer = labelLayerRef.current;
        if (!layer || !labelLayer || !stageRef.current) return;
        layer.destroyChildren();
        labelLayer.destroyChildren();

        const stageW = stageRef.current.width();

        // Clear tooltips and guides immediately when viewport changes to prevent "drifting" issues when scrolling
        setTooltip(null);
        if (playheadLayerRef.current) {
            const oldGuides = playheadLayerRef.current.find('.hover-guide');
            if (oldGuides.length > 0) {
                oldGuides.forEach(g => g.destroy());
                playheadLayerRef.current.batchDraw();
            }
        }

        userRows.forEach((row, rowIdx) => {
            const y = RULER_HEIGHT + rowIdx * ROW_HEIGHT - scrollY;

            // Draw Row Background / Separator (on Label Layer to not overlap)
            const sep = new Konva.Line({
                points: [0, y + ROW_HEIGHT, stageW, y + ROW_HEIGHT],
                stroke: '#333333',
                strokeWidth: 0.5,
            });
            labelLayer.add(sep);

            // Draw Label Background
            const labelBg = new Konva.Rect({
                x: 0, y,
                width: LABEL_WIDTH,
                height: ROW_HEIGHT,
                fill: BG_LABEL,
            });
            labelLayer.add(labelBg);

            // Draw Label Text
            const label = new Konva.Text({
                x: 8, y: y + (ROW_HEIGHT / 2) - 5,
                text: row.displayLabel,
                fontSize: 11,
                fontFamily: 'Inter',
                fill: '#f5f5f5',
            });
            labelLayer.add(label);

            // Draw User Presses (Bars)
            row.presses.forEach((bar) => {
                const x = LABEL_WIDTH + (bar.startTime - viewport.startMs) * viewport.pixelsPerMs;
                const duration = bar.duration !== undefined ? bar.duration : Math.max(0, bar.endTime - bar.startTime);
                const w = Math.max(duration * viewport.pixelsPerMs, 4); // Min 4px width
                const barY = y + ROW_PADDING;
                const barH = ROW_HEIGHT - ROW_PADDING * 2;

                const rect = new Konva.Rect({
                    x, y: barY, width: w, height: barH,
                    fill: getBarColor(bar),
                    cornerRadius: BAR_RADIUS,
                    opacity: bar.isActive ? 0.7 : 1,
                    name: bar.isActive ? 'active-bar' : undefined,
                });

                if (bar.isActive) {
                    rect.setAttr('startTime', bar.startTime);
                }

                // Hover events for tooltip
                rect.on('mouseenter mousemove', (e) => {
                    document.body.style.cursor = 'pointer';

                    // Draw visual guides on playheadLayer
                    const plLayer = playheadLayerRef.current;
                    if (plLayer) {
                        const oldGuides = plLayer.find('.hover-guide');
                        oldGuides.forEach(g => g.destroy());

                        const guideStart = new Konva.Line({
                            points: [x, 0, x, stageRef.current!.height()],
                            stroke: '#818cf8', strokeWidth: 1, dash: [4, 4], name: 'hover-guide'
                        });
                        const guideEnd = new Konva.Line({
                            points: [x + w, 0, x + w, stageRef.current!.height()],
                            stroke: '#818cf8', strokeWidth: 1, dash: [4, 4], name: 'hover-guide'
                        });

                        const formatLabel = (t: number) => t < 1000 ? `${t}ms` : `${(t / 1000).toFixed(2)}s`;

                        // To avoid overlap for very short presses, offset the Y position of the end label slightly
                        // To avoid overlap for very short presses, offset the Y position of the end label below the ruler
                        const isShort = w < 46;
                        const startY = RULER_HEIGHT - 16;
                        const endY = isShort ? RULER_HEIGHT + 2 : RULER_HEIGHT - 16;

                        const startMarkerBg = new Konva.Rect({
                            x: x - 22, y: startY, width: 44, height: 14,
                            fill: '#312e81', stroke: '#818cf8', strokeWidth: 1,
                            cornerRadius: 2, name: 'hover-guide'
                        });
                        const startMarkerTxt = new Konva.Text({
                            x: x - 22, y: startY + 2, width: 44, align: 'center',
                            text: formatLabel(bar.startTime), fill: '#a5b4fc', fontSize: 9, fontStyle: 'bold', name: 'hover-guide'
                        });

                        const endMarkerBg = new Konva.Rect({
                            x: x + w - 22, y: endY, width: 44, height: 14,
                            fill: '#312e81', stroke: '#818cf8', strokeWidth: 1,
                            cornerRadius: 2, name: 'hover-guide'
                        });
                        const endMarkerTxt = new Konva.Text({
                            x: x + w - 22, y: endY + 2, width: 44, align: 'center',
                            text: formatLabel(bar.startTime + bar.duration), fill: '#a5b4fc', fontSize: 9, fontStyle: 'bold', name: 'hover-guide'
                        });

                        plLayer.add(guideStart, guideEnd, startMarkerBg, startMarkerTxt, endMarkerBg, endMarkerTxt);
                        plLayer.batchDraw();
                    }

                    setTooltip({
                        x: e.evt.clientX,
                        y: e.evt.clientY,
                        text: t('gantt.tooltip', {
                            label: row.displayLabel,
                            time: (bar.startTime / 1000).toFixed(2),
                            duration: bar.duration
                        })
                    });
                });
                rect.on('mouseleave', () => {
                    document.body.style.cursor = 'default';

                    // Remove visual guides
                    const plLayer = playheadLayerRef.current;
                    if (plLayer) {
                        const oldGuides = plLayer.find('.hover-guide');
                        oldGuides.forEach(g => g.destroy());
                        plLayer.batchDraw();
                    }

                    setTooltip(null);
                });

                layer.add(rect);
            });
        });

        // Draw vertical separator for Labels area (on labelLayer)
        labelLayer.add(new Konva.Line({
            points: [LABEL_WIDTH, 0, LABEL_WIDTH, stageRef.current.height()],
            stroke: '#ef4444', // Highlight exactly at red line
            strokeWidth: 1.5,
        }));

        layer.batchDraw();
        labelLayer.batchDraw();

        // Add animation loop for active bars (works in both recording and freestyle modes)
        const activeRects = layer.find('.active-bar');
        let anim: Konva.Animation | null = null;
        if (activeRects.length > 0) {
            anim = new Konva.Animation((frame) => {
                const state = useInputStore.getState();

                let currentMs: number;
                if (state.status === 'recording') {
                    currentMs = Date.now() - state.sessionBaseTime;
                    if (state.startOnFirstInput) currentMs -= state.startOffset;
                } else if (state.status === 'idle' && state.freestyleBaseTime > 0) {
                    // Freestyle mode: time since first freestyle input
                    currentMs = (performance.timeOrigin + performance.now()) - state.freestyleBaseTime;
                } else {
                    return false;
                }

                let changed = false;
                activeRects.forEach((rect) => {
                    const st = rect.getAttr('startTime');
                    const w = Math.max((currentMs - st) * viewport.pixelsPerMs, 4);
                    if (Math.abs(rect.width() - w) > 0.5) {
                        rect.width(w);
                        changed = true;
                    }
                });
                return changed;
            }, layer);
            anim.start();
        }

        // Resync playhead group position and line height during prop changes (dragging, seek, etc)
        const stage = stageRef.current;
        const plLayer = playheadLayerRef.current;
        if (stage && plLayer) {
            const currentTimelineW = stage.width() - LABEL_WIDTH;
            const currentPlayheadX = LABEL_WIDTH + (currentTimelineW * playheadOffset);

            const group = plLayer.findOne('.playhead-group') as Konva.Group;
            if (group) {
                group.x(currentPlayheadX);
                const line = group.findOne('.playhead-line') as Konva.Line;
                if (line) line.points([0, RULER_HEIGHT, 0, stage.height()]);
                plLayer.batchDraw();
            }
        }

        return () => {
            if (anim) anim.stop();
        };
    }, [userRows, viewport, playheadOffset, scrollY]);

    // 4. Render Pattern Overlay
    useEffect(() => {
        const layer = overlayLayerRef.current;
        if (!layer) return;
        layer.destroyChildren();

        patternEvents.forEach((pe, idx) => {
            // Find row index, or append below if key not pressed yet
            const rowIdx = userRows.findIndex((r) => r.key === pe.key);
            const y = RULER_HEIGHT + (rowIdx >= 0 ? rowIdx : userRows.length + idx) * ROW_HEIGHT - scrollY;

            const x = LABEL_WIDTH + (pe.startTime - viewport.startMs) * viewport.pixelsPerMs;
            const w = Math.max(pe.duration * viewport.pixelsPerMs, 4);

            const er = latestResult?.eventResults.find(e => e.patternEventId === pe.id);
            const isMissed = er?.status === 'missed';

            const rect = new Konva.Rect({
                x, y: y + ROW_PADDING,
                width: w,
                height: ROW_HEIGHT - ROW_PADDING * 2,
                fill: isMissed ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                stroke: isMissed ? '#ef4444' : '#4b5563', // Red or Gray outline
                strokeWidth: 1.5,
                dash: isMissed ? [] : [4, 4],
                cornerRadius: BAR_RADIUS,
                opacity: isMissed ? 0.8 : 0.6,
            });
            layer.add(rect);
        });

        layer.batchDraw();
    }, [patternEvents, userRows, viewport, scrollY]);

    // 5. Render Error Highlights
    const highlightedError = useComparisonStore(s => s.highlightedError);
    const latestResult = useComparisonStore(s => s.latestResult);
    const currentSpeed = useComparisonStore(s => s.practiceSpeed);

    useEffect(() => {
        const layer = annotationLayerRef.current;
        if (!layer) return;
        layer.destroyChildren(); // Clear prev

        // Reset if no error, no result, or speed mismatch (failsafe)
        if (!highlightedError || !latestResult || latestResult.practiceSpeed !== currentSpeed) {
            layer.batchDraw();
            return;
        }

        latestResult.eventResults.forEach((er) => {
            const pe = patternEvents.find(e => e.id === er.patternEventId);
            if (!pe) return;

            // "Combo chưa hoàn thành" error contains multiple keys, skip exact key check for it
            const isStoppedEarly = highlightedError.type === 'missed_key' && highlightedError.message?.includes('Combo chưa hoàn thành');

            // If the error has a specific eventId, ONLY highlight that event!
            if (!isStoppedEarly && highlightedError.eventId && pe.id !== highlightedError.eventId) return;

            // Fallback for older errors running the app or "extra_key" where we might just check key
            if (!isStoppedEarly && !highlightedError.eventId && pe.key !== highlightedError.key) return;

            // Check if this specific eventResult matches the highlighted error type
            let isTypeMatch = false;
            let start = 0;
            let end = 0;

            // Unify colors by error type
            let color = '#f59e0b'; // Default amber for timing
            if (highlightedError.type === 'missed_key') color = '#ef4444'; // Red
            else if (highlightedError.type.startsWith('duration')) color = '#3b82f6'; // Blue
            else if (highlightedError.type === 'extra_key' || highlightedError.type === 'wrong_order') color = '#a855f7'; // Purple

            let overrideMagnitude = 0;

            let press: GanttBar | undefined = undefined;
            if (er.pressId) {
                for (const row of userRows) {
                    press = row.presses.find(p => p.pressId === er.pressId);
                    if (press) break;
                }
            }

            const userStartTime = press ? press.startTime : (pe.startTime + er.timingDeltaMs);
            const userDuration = press ? (press.duration !== undefined ? press.duration : Math.max(0, press.endTime - press.startTime)) : (pe.duration + er.durationDeltaMs);
            const userEndTime = userStartTime + userDuration;

            if (highlightedError.type === 'timing_early' && er.status === 'early') {
                isTypeMatch = true;
                start = userStartTime;
                end = pe.startTime;
                overrideMagnitude = er.timingDeltaMs;
            } else if (highlightedError.type === 'timing_late' && er.status === 'late') {
                isTypeMatch = true;
                start = pe.startTime;
                end = userStartTime;
                overrideMagnitude = er.timingDeltaMs;
            } else if (highlightedError.type === 'duration_too_long' && er.durationDeltaMs > 0) {
                isTypeMatch = true;
                start = userStartTime + pe.duration;
                end = userEndTime;
                overrideMagnitude = er.durationDeltaMs;
            } else if (highlightedError.type === 'duration_too_short' && er.durationDeltaMs < 0) {
                isTypeMatch = true;
                start = userEndTime;
                end = userStartTime + pe.duration;
                overrideMagnitude = er.durationDeltaMs;
            } else if (highlightedError.type === 'missed_key' && er.status === 'missed') {
                isTypeMatch = true;
                start = pe.startTime;
                end = pe.endTime;
                color = '#ef4444'; // RED for missed
            }

            if (isTypeMatch) {
                const rowIdx = userRows.findIndex((r) => r.key === pe.key);
                // Should always be found now due to useGantt update
                const actualRowIdx = rowIdx >= 0 ? rowIdx : userRows.length;
                const y = RULER_HEIGHT + actualRowIdx * ROW_HEIGHT - scrollY;
                const x = LABEL_WIDTH + (start - viewport.startMs) * viewport.pixelsPerMs;
                const w = Math.max((end - start) * viewport.pixelsPerMs, 4);

                const barH = ROW_HEIGHT - ROW_PADDING * 2;
                const barY = y + ROW_PADDING;

                // 1. Solid highlight box that perfectly aligns with timeline row heights
                const errorRect = new Konva.Rect({
                    x, y: barY, width: w, height: barH,
                    fill: color, opacity: 0.75,
                    cornerRadius: 4,
                    shadowBlur: 5, shadowColor: 'rgba(0,0,0,0.5)',
                    name: 'error-highlight',
                });
                layer.add(errorRect);

                const magnitudeText = er.status === 'missed' ? t('gantt.missed') : `${Math.round(Math.abs(overrideMagnitude))}ms`;

                // Hover tooltip for tiny error boxes (tracking mouse)
                errorRect.on('mousemove', (e) => {
                    setTooltip({ x: e.evt.clientX, y: e.evt.clientY - 12, text: magnitudeText });
                });
                errorRect.on('mouseleave', () => setTooltip(null));

                // 2. Magnitude text (Only if enough space)
                if (w >= 30) {
                    layer.add(new Konva.Text({
                        x, y: barY + (barH / 2) - 5,
                        width: w, align: 'center',
                        text: magnitudeText,
                        fontSize: 10, fontStyle: 'bold', fill: '#fff',
                        shadowBlur: 2, shadowColor: 'black',
                        listening: false, // Let hover pass through to rect
                    }));
                }
            }
        });

        layer.batchDraw();
    }, [highlightedError, latestResult, patternEvents, userRows, viewport, scrollY]);

    return (
        <div className="relative w-full h-full">
            <div ref={containerRef} className="w-full h-full" />
            {tooltip && (
                <div
                    className="fixed z-[100] pointer-events-none bg-black border border-[#333] shadow-lg rounded px-3 py-2 text-xs font-mono text-[#f5f5f5] whitespace-pre"
                    style={{ left: tooltip.x + 15, top: tooltip.y + 15 }}
                >
                    {tooltip.text}
                </div>
            )}
        </div>
    );
}

/** Get color based on comparison status or active state. */
function getBarColor(bar: GanttBar): string {
    if (bar.isActive) return '#818cf8'; // Lighter indigo while held down
    switch (bar.matchStatus) {
        case 'matched': return '#22c55e'; // Green
        case 'early': return '#f59e0b'; // Amber
        case 'late': return '#fb923c'; // Orange
        case 'missed': return '#ef4444'; // Red (Only for pattern bars without match)
        case 'extra': return '#8b5cf6'; // Purple (User pressed key not in pattern)
        default: return '#6366f1'; // Indigo (Default, no comparison yet)
    }
}
