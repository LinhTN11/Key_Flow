/**
 * PopoutPage — Renders a single section (keyboard / chart / score)
 * inside a lightweight frameless child window for OBS capture.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentWindow, LogicalSize, LogicalPosition } from '@tauri-apps/api/window';
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
import type { PopoutSection } from '../types';

interface Props {
    section: PopoutSection;
}

const SECTION_LABELS: Record<PopoutSection, string> = {
    keyboard: 'Keyboard',
    chart: 'Chart',
    score: 'Score',
};

const SECTION_ICONS: Record<PopoutSection, React.ReactNode> = {
    keyboard: <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="6" y1="9" x2="6" y2="9" /><line x1="10" y1="9" x2="10" y2="9" /><line x1="14" y1="9" x2="14" y2="9" /><line x1="18" y1="9" x2="18" y2="9" /><line x1="7" y1="13" x2="17" y2="13" /></svg>,
    chart: <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
    score: <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 22V4a2 2 0 0 1 4 0v18" /><path d="M10 14h4" /></svg>,
};

type ResizeEdge =
    | 'top' | 'bottom' | 'left' | 'right'
    | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const EDGE_STYLES: Record<ResizeEdge, React.CSSProperties> = {
    top: { top: 0, left: 10, right: 10, height: 10, cursor: 'n-resize' },
    bottom: { bottom: 0, left: 10, right: 10, height: 10, cursor: 's-resize' },
    left: { left: 0, top: 10, bottom: 10, width: 10, cursor: 'w-resize' },
    right: { right: 0, top: 10, bottom: 10, width: 10, cursor: 'e-resize' },
    'top-left': { top: 0, left: 0, width: 16, height: 16, cursor: 'nw-resize' },
    'top-right': { top: 0, right: 0, width: 16, height: 16, cursor: 'ne-resize' },
    'bottom-left': { bottom: 0, left: 0, width: 16, height: 16, cursor: 'sw-resize' },
    'bottom-right': { bottom: 0, right: 0, width: 16, height: 16, cursor: 'se-resize' },
};

function ResizeHandle({ edge, sectionLabel }: { edge: ResizeEdge; sectionLabel: string }) {
    const [hovered, setHovered] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.screenX;
        const startY = e.screenY;
        const startW = window.outerWidth;
        const startH = window.outerHeight;
        const startLeft = window.screenX;
        const startTop = window.screenY;

        const onMove = (ev: MouseEvent) => {
            const dx = ev.screenX - startX;
            const dy = ev.screenY - startY;
            let newW = Math.max(240, startW + (edge.includes('right') ? dx : edge.includes('left') ? -dx : 0));
            let newH = Math.max(120, startH + (edge.includes('bottom') ? dy : edge.includes('top') ? -dy : 0));

            let newLeft = startLeft;
            let newTop = startTop;
            if (edge.includes('left')) newLeft = startLeft + (startW - newW);
            if (edge.includes('top')) newTop = startTop + (startH - newH);

            const win = getCurrentWindow();
            win.setSize(new LogicalSize(newW, newH));
            if (edge.includes('left') || edge.includes('top')) {
                win.setPosition(new LogicalPosition(newLeft, newTop));
            }
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    const handleMouseEnter = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setHovered(true);
    };

    const handleMouseLeave = () => {
        timerRef.current = setTimeout(() => setHovered(false), 150);
    };

    const tooltipStyle = (): React.CSSProperties => {
        const base: React.CSSProperties = {
            position: 'absolute',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 9999,
            transition: 'opacity 0.18s ease, transform 0.18s ease',
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'scale(1)' : 'scale(0.92)',
        };

        if (edge.includes('top')) {
            return { ...base, top: '100%', marginTop: 6, left: '50%', transform: `translateX(-50%) scale(${hovered ? 1 : 0.92})` };
        }
        if (edge.includes('bottom')) {
            return { ...base, bottom: '100%', marginBottom: 6, left: '50%', transform: `translateX(-50%) scale(${hovered ? 1 : 0.92})` };
        }
        if (edge === 'left') {
            return { ...base, left: '100%', marginLeft: 6, top: '50%', transform: `translateY(-50%) scale(${hovered ? 1 : 0.92})` };
        }
        if (edge === 'right') {
            return { ...base, right: '100%', marginRight: 6, top: '50%', transform: `translateY(-50%) scale(${hovered ? 1 : 0.92})` };
        }
        return { ...base, bottom: '100%', left: '50%', marginBottom: 6, transform: `translateX(-50%) scale(${hovered ? 1 : 0.92})` };
    };

    const edgeLabel: Record<ResizeEdge, string> = {
        top: '↕ Drag to resize',
        bottom: '↕ Drag to resize',
        left: '↔ Drag to resize',
        right: '↔ Drag to resize',
        'top-left': '⤡ Drag to resize',
        'top-right': '⤢ Drag to resize',
        'bottom-left': '⤡ Drag to resize',
        'bottom-right': '⤢ Drag to resize',
    };

    return (
        <div
            style={{
                position: 'absolute',
                ...EDGE_STYLES[edge],
                zIndex: 100,
            }}
            onMouseDown={handleMouseDown}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 2,
                    background: hovered ? 'rgba(99,102,241,0.35)' : 'transparent',
                    transition: 'background 0.18s ease',
                    boxShadow: hovered ? '0 0 8px 2px rgba(99,102,241,0.25)' : 'none',
                }}
            />
            <div style={tooltipStyle()}>
                <div style={{
                    background: 'rgba(18,18,20,0.92)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(99,102,241,0.3)',
                    borderRadius: 8,
                    padding: '6px 10px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 16px rgba(99,102,241,0.12)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        marginBottom: 3,
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        paddingBottom: 4,
                    }}>
                        <span style={{
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: 9,
                            fontWeight: 900,
                            letterSpacing: '0.05em',
                            color: '#818cf8',
                            textTransform: 'uppercase',
                        }}>
                            Key<span style={{ color: '#6366f1' }}>Flow</span>
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 8 }}>—</span>
                        <span style={{
                            fontSize: 9,
                            fontWeight: 800,
                            color: 'rgba(255,255,255,0.5)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                        }}>
                            {sectionLabel}
                        </span>
                    </div>
                    <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.8)',
                        letterSpacing: '0.02em',
                    }}>
                        {edgeLabel[edge]}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── ScaledContainer ─────────────────────────────────────────────────────────

function ScaledContainer({
    children,
    targetWidth,
    targetHeight
}: {
    children: React.ReactNode;
    targetWidth: number;
    targetHeight: number;
}) {
    const outerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    const recalc = useCallback(() => {
        // Use window inner size minus titlebar for the most reliable measurements
        const availW = window.innerWidth;
        const availH = window.innerHeight - 32; // Titlebar height plus safety gap

        const scaleX = availW / targetWidth;
        const scaleY = availH / targetHeight;

        setScale(Math.min(scaleX, scaleY));
    }, [targetWidth, targetHeight]);

    useEffect(() => {
        recalc();
        window.addEventListener('resize', recalc);
        return () => window.removeEventListener('resize', recalc);
    }, [recalc]);

    return (
        <div ref={outerRef} className="w-full h-full flex items-center justify-center overflow-hidden">
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

// ─── TitleBar ────────────────────────────────────────────────────────────────

function TitleBar({ section, onClose }: { section: PopoutSection; onClose: () => void }) {
    const [hovered, setHovered] = useState(false);

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                width: '100%',
                height: 28,
                zIndex: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingLeft: 10,
                paddingRight: 6,
                flexShrink: 0,
                background: hovered
                    ? 'rgba(18,18,20,0.75)'
                    : 'rgba(18,18,20,0.0)',
                backdropFilter: hovered ? 'blur(10px)' : 'none',
                WebkitBackdropFilter: hovered ? 'blur(10px)' : 'none',
                borderBottom: hovered ? '1px solid rgba(99,102,241,0.15)' : '1px solid transparent',
                transition: 'background 0.2s ease, border-color 0.2s ease',
                cursor: 'grab',
                userSelect: 'none',
                WebkitAppRegion: 'drag' as any,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    opacity: hovered ? 1 : 0,
                    transition: 'opacity 0.2s ease',
                    pointerEvents: 'none',
                }}
            >
                <span style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: '0.05em',
                    color: '#818cf8',
                    textTransform: 'uppercase',
                }}>
                    Key<span style={{ color: '#6366f1' }}>Flow</span>
                </span>
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9 }}>—</span>
                <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                }}>
                    {SECTION_ICONS[section]} {SECTION_LABELS[section]}
                </span>
            </div>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                opacity: hovered ? 1 : 0,
                transition: 'opacity 0.15s ease',
                WebkitAppRegion: 'no-drag' as any,
            }}>
                <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: 'rgba(239,68,68,0.2)',
                        border: '1px solid rgba(239,68,68,0.4)',
                        color: '#f87171',
                        fontSize: 12,
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        flexShrink: 0,
                        lineHeight: 1,
                    }}
                >
                    ×
                </button>
            </div>
        </div>
    );
}

// ─── PopoutPage ───────────────────────────────────────────────────────────────

const RESIZE_EDGES: ResizeEdge[] = [
    'top', 'bottom', 'left', 'right',
    'top-left', 'top-right', 'bottom-left', 'bottom-right',
];

export function PopoutPage({ section }: Props) {
    const latestResult = useComparisonStore((s) => s.latestResult);
    const analysis = useComparisonStore((s) => s.analysis);
    const closePopout = useDisplayStore((s) => s.closePopout);
    const loadSettings = useSettingsStore((s) => s.loadSettings);

    useStoreBridge({ mode: 'receive' });
    useInputEvents();

    useEffect(() => {
        loadSettings();
        document.title = `KeyFlow — ${section.charAt(0).toUpperCase() + section.slice(1)}`;
    }, [section, loadSettings]);

    // When popout_open is called again from the main window, restore position + always on top
    useEffect(() => {
        if (!(window as any).__TAURI_INTERNALS__) return;
        let unlisten: (() => void) | undefined;
        import('@tauri-apps/api/event').then(({ listen }) => {
            listen('popout-restore', async () => {
                const win = getCurrentWindow();
                await win.setAlwaysOnTop(true);
                await win.center();
            }).then(fn => { unlisten = fn; });
        });
        return () => unlisten?.();
    }, []);

    const handleClose = async () => {
        if ((window as any).__TAURI_INTERNALS__) {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('popout_close', { section });
            closePopout(section);
        } else {
            closePopout(section);
        }
    };

    return (
        <div
            className="w-screen h-screen overflow-hidden flex flex-col relative"
            style={{
                background: 'transparent',
            }}
        >
            <style dangerouslySetInnerHTML={{
                __html: `
                html, body, #root, main {
                    background: transparent !important;
                    background-color: transparent !important;
                }
                .kf-panel {
                    background: transparent !important;
                }
            `}} />
            {/* ── Custom resize handles (8 directions) ── */}
            {RESIZE_EDGES.map((edge) => (
                <ResizeHandle key={edge} edge={edge} sectionLabel={SECTION_LABELS[section]} />
            ))}

            {/* ── Title bar ── */}
            <TitleBar section={section} onClose={handleClose} />

            {/* ── Content Area ─────────────────────────────────── */}
            <div className="flex-1 min-h-0 w-full relative overflow-hidden flex items-center justify-center">
                {section === 'keyboard' && (
                    <ScaledContainer targetWidth={1200} targetHeight={360}>
                        <div style={{ width: 1200, height: 360 }}>
                            <KeyVisualizer borderless />
                        </div>
                    </ScaledContainer>
                )}

                {section === 'chart' && (
                    <div className="w-full h-full p-2">
                        <GanttChart />
                    </div>
                )}

                {section === 'score' && (
                    <div className="w-full h-full overflow-auto p-4">
                        {latestResult ? (
                            <ScaledContainer targetWidth={900} targetHeight={340}>
                                <div className="flex gap-4 items-start">
                                    <ScoreDisplay result={latestResult} />
                                    <FeedbackPanel errors={latestResult.errors} />
                                    {analysis && <AnalysisPanel analysis={analysis} />}
                                </div>
                            </ScaledContainer>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                                <svg className="w-12 h-12 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 22V4a2 2 0 0 1 4 0v18" /><path d="M10 14h4" /></svg>
                                <p className="text-[#444] text-xs font-black uppercase tracking-widest">
                                    No results yet — complete a session
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
