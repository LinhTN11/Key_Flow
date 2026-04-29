/**
 * PatternEditor — Interactive Gantt editor for patterns.
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Konva from 'konva';
import { v4 as uuid } from 'uuid';
import type { Pattern, PatternEvent, GanttViewport } from '../../types';

const ROW_HEIGHT = 32;
const ROW_PADDING = 4;
const LABEL_WIDTH = 120;
const BAR_RADIUS = 6;
const RULER_HEIGHT = 32;
const DEFAULT_ZOOM_MS = 3000;

interface Props {
    pattern: Pattern;
    onSave: (updatedPattern: Pattern) => void;
    onCancel: () => void;
}

const formatKey = (key: string) => {
    if (!key) return "";
    return key
        .replace('Key', '')
        .replace('Digit', '')
        .replace('Arrow', '')
        .replace('Numpad', 'Num ')
        .replace('ControlLeft', 'Ctrl')
        .replace('ControlRight', 'Ctrl')
        .replace('ShiftLeft', 'Shift')
        .replace('ShiftRight', 'Shift')
        .replace('AltLeft', 'Alt')
        .replace('AltRight', 'Alt');
};

const KeySelector = ({
    value,
    onChange,
    placeholder = "Press a key...",
    className = ""
}: {
    value: string,
    onChange: (val: string) => void,
    placeholder?: string,
    className?: string
}) => {
    const { t } = useTranslation();
    const [capturing, setCapturing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!capturing) return;
        const handleKey = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();
            onChange(e.code);
            setCapturing(false);
            inputRef.current?.blur();
        };
        const handleMouse = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Ignore if clicking the input or the dropdown itself
            if (inputRef.current?.contains(target) || target.closest('.key-dropdown')) return;

            if (capturing) {
                e.preventDefault();
                e.stopPropagation();
                const buttonMap: Record<number, string> = { 0: 'MouseLeft', 1: 'MouseMiddle', 2: 'MouseRight', 3: 'MouseBack', 4: 'MouseForward' };
                onChange(buttonMap[e.button] || `Mouse${e.button}`);
                setCapturing(false);
                inputRef.current?.blur();
            }
        };
        window.addEventListener('keydown', handleKey, true);
        window.addEventListener('mousedown', handleMouse, true);
        return () => {
            window.removeEventListener('keydown', handleKey, true);
            window.removeEventListener('mousedown', handleMouse, true);
        };
    }, [capturing, onChange]);

    const commonKeys = [
        'MouseLeft', 'MouseRight', 'MouseMiddle',
        'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyA', 'KeyS', 'KeyD', 'KeyF',
        'Key1', 'Key2', 'Key3', 'Key4', 'Key5',
        'Space', 'ShiftLeft', 'ControlLeft', 'AltLeft', 'Escape', 'Enter', 'Tab'
    ];

    return (
        <div className={`relative group ${className}`}>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    readOnly
                    value={capturing ? t('editor.capturing_hint') : formatKey(value)}
                    onFocus={() => setCapturing(true)}
                    onBlur={() => setTimeout(() => setCapturing(false), 200)}
                    placeholder={placeholder || t('editor.press_any_key')}
                    className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#6366f1] cursor-pointer transition-all pr-12"
                />
                {capturing && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1 pointer-events-none">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    </div>
                )}
            </div>

            <div className="absolute top-full left-0 right-0 mt-1 bg-[#0f0f0f] border border-[#222] rounded-lg shadow-2xl z-[1000] max-h-48 overflow-y-auto hidden group-focus-within:block border-t-0 rounded-t-none scrollbar-hide py-1 key-dropdown">
                <div className="px-2 py-1 text-[8px] font-black text-[#333] uppercase tracking-widest border-b border-[#222] mb-1">{t('editor.common_keys')}</div>
                {commonKeys.map(k => (
                    <div
                        key={k}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onChange(k);
                            setCapturing(false);
                            inputRef.current?.blur();
                        }}
                        className="px-3 py-2 text-[10px] font-bold text-[#666] hover:text-white hover:bg-[#6366f1]/20 cursor-pointer uppercase transition-colors"
                    >
                        {formatKey(k)}
                    </div>
                ))}
            </div>
        </div>
    );
};

const NumberInput = ({ value, onChange, label, className = "" }: { value: number, onChange: (val: number) => void, label?: string, className?: string }) => {
    return (
        <div className={`space-y-2 ${className}`}>
            {label && <label className="text-[9px] font-black text-[#555] uppercase tracking-widest block">{label}</label>}
            <div className="relative group flex items-center">
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#6366f1] transition-all pr-8"
                />
                <div className="absolute right-0 top-0 bottom-0 flex flex-col w-6 border-l border-[#222]/50">
                    <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); onChange(value + 1); }}
                        className="flex-1 flex items-center justify-center text-[#444] hover:text-[#6366f1] hover:bg-[#6366f1]/10 transition-colors rounded-tr-lg"
                    >
                        <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current scale-125"><path d="M7 14l5-5 5 5H7z" /></svg>
                    </button>
                    <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); onChange(Math.max(0, value - 1)); }}
                        className="flex-1 flex items-center justify-center text-[#444] hover:text-[#6366f1] hover:bg-[#6366f1]/10 transition-colors border-t border-[#222]/50 rounded-br-lg"
                    >
                        <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current scale-125"><path d="M7 10l5 5 5-5H7z" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export function PatternEditor({ pattern, onSave, onCancel }: Props) {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<Konva.Stage | null>(null);
    const layerRef = useRef<Konva.Layer | null>(null);
    const rulerLayerRef = useRef<Konva.Layer | null>(null);
    const gridLayerRef = useRef<Konva.Layer | null>(null);

    const [localEvents, setLocalEvents] = useState<PatternEvent[]>(() =>
        pattern.events.map(e => ({
            ...e,
            startTime: Math.round(e.startTime),
            endTime: Math.round(e.endTime),
            duration: Math.round(e.duration)
        }))
    );
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

    const [viewport, setViewport] = useState<GanttViewport>({
        startMs: 0,
        endMs: Math.max(DEFAULT_ZOOM_MS, pattern.totalDuration + 500),
        pixelsPerMs: 0,
    });

    const [sessionKeys, setSessionKeys] = useState<string[]>(() =>
        Array.from(new Set(pattern.events.map(e => e.key))).sort()
    );

    const allKeys = useMemo(() => {
        const eventKeys = Array.from(new Set(localEvents.map(e => e.key)));
        const combined = [...sessionKeys];
        eventKeys.forEach(k => {
            if (!combined.includes(k)) combined.push(k);
        });
        return combined;
    }, [sessionKeys, localEvents]);

    const canvasHeight = Math.max(containerRef.current?.clientHeight || 600, allKeys.length * ROW_HEIGHT + RULER_HEIGHT + 100);

    // Initial Stage Creation
    useEffect(() => {
        if (!containerRef.current) return;
        const stage = new Konva.Stage({
            container: containerRef.current,
            width: containerRef.current.clientWidth,
            height: canvasHeight,
        });

        const gridLayer = new Konva.Layer();
        const rulerLayer = new Konva.Layer();
        const layer = new Konva.Layer({
            clipX: LABEL_WIDTH, clipY: 0, clipWidth: stage.width() - LABEL_WIDTH, clipHeight: 2000
        });

        stage.add(gridLayer, layer, rulerLayer);
        stageRef.current = stage;
        layerRef.current = layer;
        rulerLayerRef.current = rulerLayer;
        gridLayerRef.current = gridLayer;

        const ro = new ResizeObserver(([entry]) => {
            const { width } = entry.contentRect;
            stage.width(width);
            layer.clipWidth(width - LABEL_WIDTH);
            setViewport(v => ({ ...v, pixelsPerMs: (width - LABEL_WIDTH) / (v.endMs - v.startMs) }));
        });
        ro.observe(containerRef.current);

        return () => {
            ro.disconnect();
            stage.destroy();
        };
    }, []);

    // Sync stage height
    useEffect(() => {
        if (stageRef.current) {
            stageRef.current.height(canvasHeight);
            layerRef.current?.clipHeight(canvasHeight);
        }
    }, [canvasHeight]);

    const updateEvent = (id: string, updates: Partial<PatternEvent>) => {
        setLocalEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    };

    const handleDelete = () => {
        if (!selectedEventId) return;
        setLocalEvents(prev => prev.filter(e => e.id !== selectedEventId));
        setSelectedEventId(null);
    };

    // Render Loop
    useEffect(() => {
        const stage = stageRef.current;
        const layer = layerRef.current;
        const rulerLayer = rulerLayerRef.current;
        const gridLayer = gridLayerRef.current;
        if (!stage || !layer || !rulerLayer || !gridLayer) return;

        layer.destroyChildren();
        rulerLayer.destroyChildren();
        gridLayer.destroyChildren();

        const stageW = stage.width();
        const stageH = stage.height();
        const pixPerMs = viewport.pixelsPerMs || (stageW - LABEL_WIDTH) / (viewport.endMs - viewport.startMs);

        // 1. Grid & Guideline
        gridLayer.add(new Konva.Rect({ x: LABEL_WIDTH, y: RULER_HEIGHT, width: stageW - LABEL_WIDTH, height: stageH, fill: '#0a0a0a' }));
        const guideLine = new Konva.Line({
            points: [0, 0, 0, stageH],
            stroke: '#6366f1', strokeWidth: 1, dash: [4, 2],
            visible: false, opacity: 0.5, name: 'guideLine'
        });
        gridLayer.add(guideLine);

        // 2. Time Markers
        rulerLayer.add(new Konva.Rect({ x: 0, y: 0, width: stageW, height: RULER_HEIGHT, fill: '#0a0a0a' }));
        rulerLayer.add(new Konva.Line({ points: [LABEL_WIDTH, RULER_HEIGHT, stageW, RULER_HEIGHT], stroke: '#333', strokeWidth: 1 }));

        const possibleIntervals = [10, 50, 100, 250, 500, 1000, 2000, 5000, 10000];
        let intervalMs = possibleIntervals.find(it => it * pixPerMs >= 100) || 1000;
        const firstMarker = Math.max(0, Math.ceil(viewport.startMs / intervalMs) * intervalMs);

        for (let t = firstMarker; t <= viewport.endMs; t += intervalMs) {
            const x = LABEL_WIDTH + (t - viewport.startMs) * pixPerMs;
            if (x < LABEL_WIDTH) continue;
            rulerLayer.add(new Konva.Line({ points: [x, 20, x, RULER_HEIGHT], stroke: '#444', strokeWidth: 1 }));
            const precision = intervalMs < 100 ? 2 : 1;
            rulerLayer.add(new Konva.Text({
                x: x + 4, y: 8, text: `${(t / 1000).toFixed(precision)}s`,
                fontSize: 9, fill: '#444', fontStyle: 'bold'
            }));
            gridLayer.add(new Konva.Line({ points: [x, RULER_HEIGHT, x, stageH], stroke: '#1a1a1a', strokeWidth: 1, dash: [4, 4] }));
        }

        // 3. Tracks & Events
        allKeys.forEach((key, rowIdx) => {
            const y = RULER_HEIGHT + rowIdx * ROW_HEIGHT;
            gridLayer.add(new Konva.Line({ points: [0, y + ROW_HEIGHT, stageW, y + ROW_HEIGHT], stroke: '#1a1a1a', strokeWidth: 1 }));

            const labelGroup = new Konva.Group({
                x: 0, y, width: LABEL_WIDTH, height: ROW_HEIGHT, draggable: true,
                name: `label-${key}`
            });
            labelGroup.dragBoundFunc(pos => ({ x: 0, y: Math.max(RULER_HEIGHT, pos.y) }));

            const labelBg = new Konva.Rect({ x: 0, y: 0, width: LABEL_WIDTH, height: ROW_HEIGHT, fill: '#111' });
            const labelText = new Konva.Text({
                x: 12, y: ROW_HEIGHT / 2 - 6,
                text: formatKey(key),
                fontSize: 11, fontStyle: 'bold', fill: '#666'
            });

            const deleteBtn = new Konva.Group({ x: LABEL_WIDTH - 24, y: ROW_HEIGHT / 2 - 8, opacity: 0 });
            deleteBtn.add(new Konva.Rect({ width: 16, height: 16, fill: '#ef444420', cornerRadius: 4 }));
            deleteBtn.add(new Konva.Text({ text: '✕', fontSize: 10, fill: '#ef4444', x: 4, y: 3, fontStyle: 'bold' }));

            labelGroup.on('mouseenter', () => { deleteBtn.opacity(1); labelBg.fill('#161616'); rulerLayer.batchDraw(); });
            labelGroup.on('mouseleave', () => { deleteBtn.opacity(0); labelBg.fill('#111'); rulerLayer.batchDraw(); });

            deleteBtn.on('mousedown', (e) => {
                e.cancelBubble = true;
                setSessionKeys(prev => prev.filter(k => k !== key));
                setLocalEvents(prev => prev.filter(ev => ev.key !== key));
            });

            labelGroup.on('dragmove', () => {
                const currentY = labelGroup.y();
                const targetIdx = Math.max(0, Math.min(allKeys.length - 1, Math.floor((currentY - RULER_HEIGHT + ROW_HEIGHT / 2) / ROW_HEIGHT)));

                // Update current row's events to follow the label
                stage.find(`.event-${key}`).forEach(n => {
                    n.y(currentY + ROW_PADDING);
                });

                allKeys.forEach((k, idx) => {
                    if (idx === rowIdx) return;
                    let visualIdx = idx;
                    if (rowIdx < targetIdx && idx > rowIdx && idx <= targetIdx) visualIdx = idx - 1;
                    else if (rowIdx > targetIdx && idx < rowIdx && idx >= targetIdx) visualIdx = idx + 1;

                    const rowY = RULER_HEIGHT + visualIdx * ROW_HEIGHT;
                    stage.find(`.label-${k}`).forEach(n => n.to({ y: rowY, duration: 0.1 }));
                    stage.find(`.event-${k}`).forEach(n => n.to({ y: rowY + ROW_PADDING, duration: 0.1 }));
                });
            });

            labelGroup.on('dragend', () => {
                const newY = labelGroup.y();
                const newIdx = Math.max(0, Math.min(allKeys.length - 1, Math.floor((newY - RULER_HEIGHT + ROW_HEIGHT / 2) / ROW_HEIGHT)));
                if (newIdx !== rowIdx) {
                    const newOrder = [...allKeys];
                    const [removed] = newOrder.splice(rowIdx, 1);
                    newOrder.splice(newIdx, 0, removed);
                    setSessionKeys(newOrder);
                }
                labelGroup.y(y);
                stage.find(`.event-${key}`).forEach(n => n.y(y + ROW_PADDING));
                rulerLayer.batchDraw();
                layer.batchDraw();
            });

            labelGroup.add(labelBg, labelText, deleteBtn);
            rulerLayer.add(labelGroup);

            localEvents.filter(e => e.key === key).forEach(ev => {
                const x = LABEL_WIDTH + (ev.startTime - viewport.startMs) * pixPerMs;
                const w = ev.duration * pixPerMs;
                const isSelected = selectedEventId === ev.id;

                const group = new Konva.Group({
                    x, y: y + ROW_PADDING, draggable: true,
                    name: `event-${key}`
                });
                group.dragBoundFunc((pos) => {
                    const minX = LABEL_WIDTH - viewport.startMs * pixPerMs;
                    const stageY = stage.getPointerPosition()?.y || pos.y;
                    const rowIdxUnderMouse = Math.floor((stageY - RULER_HEIGHT) / ROW_HEIGHT);
                    return {
                        x: Math.max(minX, pos.x),
                        y: RULER_HEIGHT + Math.max(0, Math.min(allKeys.length - 1, rowIdxUnderMouse)) * ROW_HEIGHT + ROW_PADDING
                    };
                });

                const rect = new Konva.Rect({
                    width: Math.max(10, w), height: ROW_HEIGHT - ROW_PADDING * 2,
                    fill: isSelected ? '#818cf8' : '#312e81',
                    stroke: isSelected ? '#fff' : '#6366f1',
                    strokeWidth: 2, cornerRadius: BAR_RADIUS, opacity: 0.9
                });

                const leftHandle = new Konva.Group({ x: 0, y: 0, opacity: 0, draggable: true });
                leftHandle.add(new Konva.Rect({ width: 10, height: ROW_HEIGHT - ROW_PADDING * 2, fill: '#fff', cornerRadius: [BAR_RADIUS, 0, 0, BAR_RADIUS] }));
                for (let i = 0; i < 3; i++) leftHandle.add(new Konva.Line({ points: [3 + i * 2, 6, 3 + i * 2, ROW_HEIGHT - ROW_PADDING * 2 - 6], stroke: '#000', strokeWidth: 1, opacity: 0.5 }));

                const rightHandle = new Konva.Group({ x: Math.max(10, w) - 10, y: 0, opacity: 0, draggable: true });
                rightHandle.add(new Konva.Rect({ width: 10, height: ROW_HEIGHT - ROW_PADDING * 2, fill: '#fff', cornerRadius: [0, BAR_RADIUS, BAR_RADIUS, 0] }));
                for (let i = 0; i < 3; i++) rightHandle.add(new Konva.Line({ points: [3 + i * 2, 6, 3 + i * 2, ROW_HEIGHT - ROW_PADDING * 2 - 6], stroke: '#000', strokeWidth: 1, opacity: 0.5 }));

                const updateGL = (gx: number) => {
                    const gl = gridLayer.findOne('.guideLine') as Konva.Line;
                    if (gl) { gl.points([gx, 0, gx, stage.height()]); gl.visible(true); gl.moveToTop(); gridLayer.batchDraw(); }
                };

                group.on('mouseenter', () => { leftHandle.opacity(0.8); rightHandle.opacity(0.8); layer.batchDraw(); });
                group.on('mouseleave', () => { leftHandle.opacity(0); rightHandle.opacity(0); layer.batchDraw(); });
                group.on('dragmove', () => updateGL(group.x()));
                group.on('dragend', () => {
                    gridLayer.findOne('.guideLine')?.visible(false); gridLayer.batchDraw();
                    const nS = Math.round((group.x() - LABEL_WIDTH) / pixPerMs + viewport.startMs);
                    const nR = Math.floor((group.y() - RULER_HEIGHT) / ROW_HEIGHT);
                    const nK = allKeys[nR] || ev.key;
                    setLocalEvents(prev => prev.map(e => e.id === ev.id ? { ...e, key: nK, startTime: nS, endTime: nS + e.duration } : e));
                });

                leftHandle.on('dragmove', (e) => {
                    e.cancelBubble = true;
                    const dX = leftHandle.x();
                    const nW = rect.width() - dX;
                    if (nW > 10) { group.x(group.x() + dX); rect.width(nW); leftHandle.x(0); rightHandle.x(nW - 10); updateGL(group.x()); }
                    else { leftHandle.x(0); }
                });
                leftHandle.on('dragend', () => {
                    gridLayer.findOne('.guideLine')?.visible(false); gridLayer.batchDraw();
                    const nS = Math.round((group.x() - LABEL_WIDTH) / pixPerMs + viewport.startMs);
                    const nD = Math.max(10, Math.round(rect.width() / pixPerMs));
                    setLocalEvents(prev => prev.map(e => e.id === ev.id ? { ...e, startTime: nS, duration: nD, endTime: nS + nD } : e));
                });

                rightHandle.on('dragmove', (e) => {
                    e.cancelBubble = true;
                    const nW = Math.max(10, rightHandle.x() + 10);
                    rect.width(nW); rightHandle.x(nW - 10); updateGL(group.x() + nW);
                });
                rightHandle.on('dragend', () => {
                    gridLayer.findOne('.guideLine')?.visible(false); gridLayer.batchDraw();
                    const nD = Math.max(10, Math.round(rect.width() / pixPerMs));
                    setLocalEvents(prev => prev.map(e => e.id === ev.id ? { ...e, duration: nD, endTime: e.startTime + nD } : e));
                });

                group.on('mousedown', (e) => { e.cancelBubble = true; setSelectedEventId(ev.id); });
                group.add(rect, leftHandle, rightHandle);
                layer.add(group);
            });
        });

        const handleDblClick = () => {
            const pos = stage.getPointerPosition();
            if (!pos || pos.x < LABEL_WIDTH) return;
            const ms = Math.round((pos.x - LABEL_WIDTH) / pixPerMs + viewport.startMs);
            const rIdx = Math.floor((pos.y - RULER_HEIGHT) / ROW_HEIGHT);
            if (rIdx >= 0 && rIdx < allKeys.length) {
                const key = allKeys[rIdx];
                const nE: PatternEvent = { id: uuid(), key, displayLabel: key, startTime: ms, endTime: ms + 100, duration: 100, timingToleranceMs: 50, durationTolerancePct: 20 };
                setLocalEvents(prev => [...prev, nE]);
                setSelectedEventId(nE.id);
            }
        };
        stage.on('dblclick', handleDblClick);

        const handleKD = (e: KeyboardEvent) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement?.tagName !== 'INPUT') handleDelete();
        };
        window.addEventListener('keydown', handleKD);

        layer.batchDraw(); rulerLayer.batchDraw(); gridLayer.batchDraw();

        return () => {
            stage.off('dblclick', handleDblClick);
            window.removeEventListener('keydown', handleKD);
        };
    }, [localEvents, allKeys, viewport, selectedEventId]);

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const containerW = containerRef.current?.clientWidth || 800;
            const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
            setViewport(v => {
                const range = (v.endMs - v.startMs) * zoomFactor;
                const newPixelsPerMs = (containerW - LABEL_WIDTH) / range;
                return { ...v, endMs: v.startMs + range, pixelsPerMs: newPixelsPerMs };
            });
        } else {
            const shiftMs = e.deltaY / (viewport.pixelsPerMs || 1);
            setViewport(v => {
                const newStart = Math.max(0, v.startMs + shiftMs);
                const duration = v.endMs - v.startMs;
                return { ...v, startMs: newStart, endMs: newStart + duration };
            });
        }
    };

    const handleSaveLocal = () => {
        const sorted = [...localEvents].sort((a, b) => a.startTime - b.startTime);
        const totalDuration = sorted.length > 0 ? Math.max(...sorted.map(e => e.endTime)) : 0;
        onSave({ ...pattern, events: sorted, totalDuration, updatedAt: Date.now() });
    };

    const selectedEvent = useMemo(() => localEvents.find(e => e.id === selectedEventId), [localEvents, selectedEventId]);
    const lastKeyAdded = sessionKeys.length > 0 ? sessionKeys[sessionKeys.length - 1] : "";

    return (
        <div className="fixed inset-0 bg-[#0f0f0f] z-[200] flex flex-col animate-in fade-in duration-300 font-sans">
            <div className="h-16 px-6 border-b border-[#333] flex items-center justify-between bg-[#0a0a0a]">
                <div className="flex items-center gap-6">
                    <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-[#666] hover:text-white">✕</button>
                    <div>
                        <h2 className="text-xs font-black tracking-[0.2em] uppercase text-white/40 mb-0.5">{t('editor.editing_pattern')}</h2>
                        <h1 className="text-lg font-bold text-white tracking-tight">{pattern.name}</h1>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {selectedEventId && (
                        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg">
                            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">{t('editor.selected_event')}</span>
                            <button onClick={handleDelete} className="text-red-500 hover:text-red-400 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border border-red-500/30 rounded bg-red-500/10 active:scale-95 transition-all">{t('common.delete')}</button>
                        </div>
                    )}
                    <button onClick={handleSaveLocal} className="px-8 py-2.5 bg-[#6366f1] text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-[#818cf8] transition-all shadow-[0_4px_20px_rgba(99,102,241,0.4)]">{t('editor.save_changes')}</button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden relative bg-[#0a0a0a] scrollbar-hide">
                    <div ref={containerRef} className="w-full bg-[#0f0f0f] relative" onWheel={handleWheel} style={{ height: canvasHeight }} />
                </div>

                <div className="w-80 bg-[#0a0a0a] border-l border-[#222] p-6 flex flex-col gap-8">
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <h3 className="text-[10px] font-black text-[#444] uppercase tracking-[0.3em]">{t('editor.timeline_tracks')}</h3>
                            <p className="text-xs text-[#666]">{t('editor.timeline_desc')}</p>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder={t('editor.add_row_placeholder')}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const val = (e.target as HTMLInputElement).value.trim();
                                        if (val) {
                                            setSessionKeys(prev => Array.from(new Set([...prev, val])));
                                            (e.target as HTMLInputElement).value = '';
                                        }
                                    }
                                }}
                                className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#6366f1] transition-all"
                            />
                        </div>
                    </div>

                    {!selectedEvent ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30 select-none">
                            <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-white/20 mb-4 flex items-center justify-center"><svg className="w-5 h-5 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg></div>
                            <p className="text-[10px] font-black uppercase tracking-widest">{t('editor.select_event_hint')}</p>
                        </div>
                    ) : (
                        <div className="flex-1 space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-[#555] uppercase tracking-widest block">{t('editor.key_action')}</label>
                                <KeySelector value={selectedEvent.key} onChange={(val) => updateEvent(selectedEvent.id, { key: val, displayLabel: val })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <NumberInput
                                    label={t('editor.start_ms')}
                                    value={selectedEvent.startTime}
                                    onChange={(v) => updateEvent(selectedEvent.id, { startTime: v, endTime: v + selectedEvent.duration })}
                                />
                                <NumberInput
                                    label={t('editor.duration_ms')}
                                    value={selectedEvent.duration}
                                    onChange={(v) => updateEvent(selectedEvent.id, { duration: v, endTime: selectedEvent.startTime + v })}
                                />
                            </div>
                            <div className="space-y-4 pt-4 border-t border-[#222]">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center"><label className="text-[9px] font-black text-[#555] uppercase tracking-widest block">{t('editor.timing_tolerance')}</label><span className="text-[9px] font-bold text-[#6366f1]">{selectedEvent.timingToleranceMs}ms</span></div>
                                    <input type="range" min="0" max="500" step="10" value={selectedEvent.timingToleranceMs} onChange={(e) => updateEvent(selectedEvent.id, { timingToleranceMs: parseInt(e.target.value) })} className="w-full accent-[#6366f1]" />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center"><label className="text-[9px] font-black text-[#555] uppercase tracking-widest block">{t('editor.duration_tolerance')}</label><span className="text-[9px] font-bold text-[#6366f1]">{selectedEvent.durationTolerancePct}%</span></div>
                                    <input type="range" min="0" max="100" step="5" value={selectedEvent.durationTolerancePct} onChange={(e) => updateEvent(selectedEvent.id, { durationTolerancePct: parseInt(e.target.value) })} className="w-full accent-[#6366f1]" />
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedEventId(null)}
                                className="w-full py-3 bg-[#6366f1] text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-[#818cf8] transition-all shadow-[0_4px_20px_rgba(99,102,241,0.2)] mt-4"
                            >
                                {t('editor.save_event')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="h-10 px-6 border-t border-[#222] flex items-center justify-between bg-[#0a0a0a] text-[9px] font-black text-[#444] uppercase tracking-[0.2em]">
                <div className="flex gap-6">
                    <span>{t('editor.footer_scroll')}</span>
                    <span>{t('editor.footer_zoom')}</span>
                    <span>{t('editor.footer_dblclick')}</span>
                </div>
                <div>
                    {t('editor.events_count', { count: localEvents.length })} • {t('editor.total_time', { time: (localEvents.length > 0 ? (Math.max(...localEvents.map(e => e.endTime)) / 1000).toFixed(2) : 0) })}
                </div>
            </div>
        </div>
    );
}
