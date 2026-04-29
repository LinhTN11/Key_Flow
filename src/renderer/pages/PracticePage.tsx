import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyVisualizer } from '../components/visualizer/KeyVisualizer';
import { GanttChart } from '../components/gantt/GanttChart';
import { ScoreDisplay } from '../components/comparison/ScoreDisplay';
import { FeedbackPanel } from '../components/comparison/FeedbackPanel';
import { AnalysisPanel } from '../components/comparison/AnalysisPanel';
import { useInputEvents } from '../hooks/useInputEvents';
import { useComparison } from '../hooks/useComparison';
import { useInputStore } from '../stores/inputStore';
import { useComparisonStore } from '../stores/comparisonStore';
import { useSessionStore } from '../stores/sessionStore';
import { useViewportStore } from '../stores/viewportStore';
import { useDisplayStore } from '../stores/displayStore';
import { PatternRecorder } from '../components/pattern/PatternRecorder';
import { useStoreBridge } from '../hooks/useStoreBridge';

export function PracticePage() {
    const { t } = useTranslation();
    const [startOnFirstInput, setStartOnFirstInput] = useState(false);

    useInputEvents();
    useStoreBridge({ mode: 'broadcast' });

    const status = useInputStore((s) => s.status);
    const presses = useInputStore((s) => s.presses);
    const startSession = useInputStore((s) => s.startSession);
    const pauseSession = useInputStore((s) => s.pauseSession);
    const resumeSession = useInputStore((s) => s.resumeSession);
    const stopSession = useInputStore((s) => s.stopSession);
    const clearSession = useInputStore((s) => s.clearSession);
    const clearChart = useInputStore((s) => s.clearChart);

    const activePattern = useComparisonStore((s) => s.activePattern);
    const isComparing = useComparisonStore((s) => s.isComparing);
    const latestResult = useComparisonStore((s) => s.latestResult);
    const analysis = useComparisonStore((s) => s.analysis);
    const startComparison = useComparisonStore((s) => s.startComparison);
    const stopComparison = useComparisonStore((s) => s.stopComparison);
    const practiceSpeed = useComparisonStore((s) => s.practiceSpeed);

    const createSessionDB = useSessionStore((s) => s.startSession);
    const endSessionDB = useSessionStore((s) => s.endSession);
    const currentSession = useSessionStore((s) => s.currentSession);

    const { seek } = useViewportStore();
    const [elapsed, setElapsed] = useState(0);
    // Track which popouts are hidden (opacity=0, invisible but OBS can capture)
    const [hiddenPopouts, setHiddenPopouts] = useState<Record<string, boolean>>({});

    const showKeyboard = useDisplayStore((s) => s.showKeyboard);
    const showChart = useDisplayStore((s) => s.showChart);
    const showScore = useDisplayStore((s) => s.showScore);
    const poppedOut = useDisplayStore((s) => s.poppedOut);

    const toggleKeyboard = useDisplayStore((s) => s.toggleKeyboard);
    const toggleChart = useDisplayStore((s) => s.toggleChart);
    const toggleScore = useDisplayStore((s) => s.toggleScore);
    const popoutSection = useDisplayStore((s) => s.popoutSection);
    const closePopout = useDisplayStore((s) => s.closePopout);

    const handleEnd = React.useCallback(async () => {
        stopSession();
        stopComparison();
        await endSessionDB();
    }, [stopSession, stopComparison, endSessionDB]);

    // Listen for pop-out window closed externally (user presses X on child window)
    useEffect(() => {
        // Electron path
        const cleanup = window.electronAPI?.window?.onPopoutClosed?.((section) => {
            closePopout(section as 'keyboard' | 'chart' | 'score');
        });
        // Tauri path: popup windows emit 'popout-closed' before destroying
        let unlistenTauri: (() => void) | undefined;
        if ((window as any).__TAURI_INTERNALS__) {
            import('@tauri-apps/api/event').then(({ listen }) => {
                listen<string>('popout-closed', (e) => {
                    closePopout(e.payload as 'keyboard' | 'chart' | 'score');
                }).then((fn) => { unlistenTauri = fn; });
            });
        }
        return () => {
            cleanup?.();
            unlistenTauri?.();
        };
    }, [closePopout]);

    const handleShowPopout = async (section: string) => {
        if ((window as any).__TAURI_INTERNALS__) {
            const { invoke } = await import('@tauri-apps/api/core');
            invoke('popout_show', { section });
        } else {
            window.electronAPI?.window?.showPopout?.(section);
        }
        setHiddenPopouts(prev => ({ ...prev, [section]: false }));
    };

    const handleHidePopout = async (section: string) => {
        if ((window as any).__TAURI_INTERNALS__) {
            const { invoke } = await import('@tauri-apps/api/core');
            invoke('popout_hide', { section });
        } else {
            window.electronAPI?.window?.hidePopout?.(section);
        }
        setHiddenPopouts(prev => ({ ...prev, [section]: true }));
    };

    // When a popup is opened, it's always visible initially
    const handlePopout = (section: 'keyboard' | 'chart' | 'score') => {
        popoutSection(section);
        setHiddenPopouts(prev => ({ ...prev, [section]: false }));
    };

    // When a popup is closed/restored, reset hidden state
    const handleClosePopout = (section: 'keyboard' | 'chart' | 'score') => {
        closePopout(section);
        setHiddenPopouts(prev => ({ ...prev, [section]: false }));
    };

    useComparison(() => {
        if (status === 'recording') {
            handleEnd();
        }
    });

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (status === 'recording') {
            interval = setInterval(() => {
                const base = useInputStore.getState().sessionBaseTime;
                setElapsed(Date.now() - base);
            }, 100);
        } else if (status === 'idle') {
            setElapsed(0);
        }
        return () => clearInterval(interval);
    }, [status]);

    const formatTime = (ms: number) => {
        const totalSeconds = ms / 1000;
        const m = Math.floor(totalSeconds / 60);
        const s = Math.floor(totalSeconds % 60);
        const ds = Math.floor((ms % 1000) / 100);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ds}`;
    };

    const handleStartPractice = async () => {
        if (!activePattern) {
            alert(t('practice.select_combo_alert'));
            return;
        }
        clearSession();
        const dbSession = await createSessionDB(activePattern?.id ?? null);
        startSession(dbSession.id, startOnFirstInput);
        startComparison();
        seek(0);
    };

    const handlePause = () => pauseSession();

    const handleResume = () => {
        resumeSession();
        if (presses.length > 0) {
            const last = presses[presses.length - 1];
            seek(last.endTime ?? last.startTime);
        }
    };

    return (
        <div className="flex flex-col h-full gap-4 p-4 overflow-hidden relative">
            <div className="flex items-start justify-between mb-2">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tighter mb-1 select-none">{t('practice.title') || 'PRACTICE MODE'}</h1>
                    <div className="flex items-center gap-2">
                        <span className="text-[#666] font-medium uppercase tracking-widest text-[9px]">{t('practice.target_pattern') || 'Target Pattern'}:</span>
                        {activePattern ? (
                            <span className="text-[#6366f1] font-black uppercase tracking-widest text-[10px] bg-[#6366f1]/10 px-2 py-0.5 rounded">
                                {activePattern.name} ({activePattern.game})
                            </span>
                        ) : (
                            <span className="text-red-500/70 font-black uppercase tracking-widest text-[10px] animate-pulse">
                                {t('practice.no_pattern_selected') || 'No Pattern Selected — Go to Library'}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="absolute top-6 right-6 z-10 flex items-center gap-2 bg-[#18181b]/80 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                {/* 1. Status & Time */}
                {status !== 'idle' && (
                    <div className="flex items-center gap-2 px-2.5 py-1 bg-white/5 rounded-xl border border-white/5">
                        <div className={`w-1.5 h-1.5 rounded-full ${status === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}`} />
                        <span className="text-[11px] font-mono font-black text-white/90">
                            {formatTime(elapsed)}
                        </span>
                    </div>
                )}

                {/* 2. Mode Toggles (Start on First Input) */}
                <button
                    onClick={() => setStartOnFirstInput(!startOnFirstInput)}
                    title={t('practice.start_on_first_input') || 'Start on first input'}
                    className={`p-2 rounded-xl transition-all duration-300 ${startOnFirstInput 
                        ? 'bg-[#6366f1] text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' 
                        : 'text-[#555] hover:text-white hover:bg-white/5'}`}
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="6" width="20" height="12" rx="2" />
                        <path d="M10 10l4 2-4 2z" fill="currentColor" />
                        <path d="M7 15h10" />
                    </svg>
                </button>

                <div className="h-5 w-px bg-white/10 mx-0.5" />

                {/* 3. Speed Control (Compact) */}
                <div className="flex items-center bg-white/5 rounded-xl border border-white/5 p-0.5">
                    {[0.5, 1, 1.5, 2].map(s => (
                        <button
                            key={s}
                            onClick={() => useComparisonStore.getState().setPracticeSpeed(s)}
                            className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all uppercase tracking-tighter ${practiceSpeed === s ? 'bg-white/10 text-[#818cf8]' : 'text-[#444] hover:text-white/60'}`}
                        >
                            {s === 1 ? 'Norm' : `${s}x`}
                        </button>
                    ))}
                </div>

                <div className="h-5 w-px bg-white/10 mx-0.5" />

                {/* 4. Display Controls Grouped by Section */}
                <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
                    {/* Keyboard Section */}
                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={toggleKeyboard}
                            title="Toggle Keyboard View"
                            className={`p-1.5 rounded-lg transition-all ${showKeyboard ? 'text-[#818cf8] bg-[#6366f1]/10' : 'text-[#444] hover:text-white/60'}`}
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="6" y1="9" x2="18" y2="9" /><line x1="6" y1="13" x2="18" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></svg>
                        </button>
                        <button
                            onClick={() => poppedOut.keyboard ? handleClosePopout('keyboard') : handlePopout('keyboard')}
                            title={poppedOut.keyboard ? "Restore Keyboard" : "Pop out Keyboard"}
                            className={`p-1.5 rounded-lg transition-all ${poppedOut.keyboard ? 'text-[#10b981] bg-[#10b981]/10' : 'text-[#444] hover:text-white/60'}`}
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                        </button>
                    </div>

                    <div className="w-px h-3 bg-white/5 mx-0.5" />

                    {/* Chart Section */}
                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={toggleChart}
                            title="Toggle Chart View"
                            className={`p-1.5 rounded-lg transition-all ${showChart ? 'text-[#818cf8] bg-[#6366f1]/10' : 'text-[#444] hover:text-white/60'}`}
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
                        </button>
                        <button
                            onClick={() => poppedOut.chart ? handleClosePopout('chart') : handlePopout('chart')}
                            title={poppedOut.chart ? "Restore Chart" : "Pop out Chart"}
                            className={`p-1.5 rounded-lg transition-all ${poppedOut.chart ? 'text-[#10b981] bg-[#10b981]/10' : 'text-[#444] hover:text-white/60'}`}
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                        </button>
                        <button
                            onClick={() => { clearChart(); useViewportStore.getState().setViewport({ startMs: 0, endMs: 5000 }); }}
                            title="Clear Chart"
                            className="p-1.5 rounded-lg text-[#444] hover:text-red-400 hover:bg-red-400/10 transition-all"
                        >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="1 4 1 10 7 10" />
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                        </svg>
                        </button>
                    </div>

                    <div className="w-px h-3 bg-white/5 mx-0.5" />

                    {/* Score Section */}
                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={toggleScore}
                            title="Toggle Score View"
                            className={`p-1.5 rounded-lg transition-all ${showScore ? 'text-[#818cf8] bg-[#6366f1]/10' : 'text-[#444] hover:text-white/60'}`}
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                        </button>
                        <button
                            onClick={() => poppedOut.score ? handleClosePopout('score') : handlePopout('score')}
                            title={poppedOut.score ? "Restore Score" : "Pop out Score"}
                            className={`p-1.5 rounded-lg transition-all ${poppedOut.score ? 'text-[#10b981] bg-[#10b981]/10' : 'text-[#444] hover:text-white/60'}`}
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                        </button>
                    </div>
                </div>

                <div className="h-5 w-px bg-white/10 mx-0.5" />

                {/* 5. Primary Actions */}
                <div className="flex items-center gap-2">
                    {(status === 'idle' || (status === 'recording' && !currentSession?.patternId)) && (
                        <PatternRecorder variant="compact" />
                    )}

                    {(status === 'idle' || status === 'paused' || (status === 'recording' && currentSession?.patternId)) && (
                        <div className="flex items-center gap-2">
                            {status === 'idle' || status === 'paused' ? (
                                <div className="flex gap-1.5">
                                    <button
                                        onClick={status === 'idle' ? handleStartPractice : handleResume}
                                        className="h-8 px-4 bg-[#6366f1] hover:bg-[#818cf8] text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_4px_15px_rgba(99,102,241,0.3)] active:scale-95 flex items-center gap-2"
                                    >
                                        <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                                        {status === 'idle' ? t('common.start') || 'Start' : t('common.resume') || 'Resume'}
                                    </button>
                                    {status === 'paused' && (
                                        <button
                                            onClick={handleEnd}
                                            className="h-8 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
                                        >
                                            <div className="w-2 h-2 bg-red-500 rounded-sm" />
                                            {t('common.end') || 'End'}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <button
                                    onClick={handlePause}
                                    className="h-8 px-4 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 border border-amber-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95"
                                >
                                    <div className="flex gap-0.5">
                                        <div className="w-1 h-3 bg-amber-500 rounded-full" />
                                        <div className="w-1 h-3 bg-amber-500 rounded-full" />
                                    </div>
                                    {t('common.pause') || 'Pause'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className={`transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${(showKeyboard && !poppedOut.keyboard) ? 'h-[340px] opacity-100 mb-0' : 'h-0 opacity-0 overflow-hidden mb-0 border-0 p-0'
                }`}>
                {showKeyboard && !poppedOut.keyboard && <KeyVisualizer />}
            </div>

            {/* Keyboard pop-out placeholder */}
            {poppedOut.keyboard && (
                <div className="h-[56px] flex items-center justify-center rounded-lg border border-[#10b981]/20 bg-[#10b981]/5 gap-3 flex-shrink-0 px-4">
                    <span className="text-[#34d399] text-[10px] font-black uppercase tracking-widest flex-1 text-center flex items-center justify-center gap-1.5"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="6" y1="9" x2="6" y2="9" /><line x1="10" y1="9" x2="10" y2="9" /><line x1="14" y1="9" x2="14" y2="9" /><line x1="18" y1="9" x2="18" y2="9" /><line x1="7" y1="13" x2="17" y2="13" /></svg> Keyboard — OBS Window</span>
                    {hiddenPopouts['keyboard'] ? (
                        <button onClick={() => handleShowPopout('keyboard')}
                            className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest transition-all bg-[#818cf8]/20 border border-[#818cf8]/40 text-[#818cf8] hover:bg-[#818cf8]/30">
                            <svg className="w-3 h-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg> Show
                        </button>
                    ) : (
                        <button onClick={() => handleHidePopout('keyboard')}
                            className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest transition-all bg-[#555]/20 border border-[#555]/40 text-[#888] hover:bg-[#555]/30 hover:text-[#aaa]">
                            <svg className="w-3 h-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg> Hide
                        </button>
                    )}
                    <button onClick={() => handleClosePopout('keyboard')}
                        className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest transition-all bg-transparent border border-[#333] text-[#555] hover:border-[#34d399]/40 hover:text-[#34d399]">
                        Restore
                    </button>
                </div>
            )}

            <div className={`transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] relative ${(showChart && !poppedOut.chart) ? 'flex-1 min-h-[150px] opacity-100' : 'h-0 flex-none opacity-0 overflow-hidden'
                }`}>
                {isComparing && showChart && !poppedOut.chart && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-[#252525]/80 backdrop-blur border border-[#333] rounded text-xs text-[#a3a3a3] z-10 transition-opacity">
                        {t('practice.comparing_against') || 'Comparing against'}: <span className="text-white font-medium">{activePattern?.name}</span>
                    </div>
                )}
                {showChart && !poppedOut.chart && <GanttChart />}
            </div>

            {/* Chart pop-out placeholder */}
            {poppedOut.chart && (
                <div className="flex-1 min-h-[56px] flex items-center justify-center rounded-lg border border-[#10b981]/20 bg-[#10b981]/5 gap-3 px-4">
                    <span className="text-[#34d399] text-[10px] font-black uppercase tracking-widest flex-1 text-center flex items-center justify-center gap-1.5"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg> Chart — OBS Window</span>
                    {hiddenPopouts['chart'] ? (
                        <button onClick={() => handleShowPopout('chart')}
                            className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest transition-all bg-[#818cf8]/20 border border-[#818cf8]/40 text-[#818cf8] hover:bg-[#818cf8]/30">
                            <svg className="w-3 h-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg> Show
                        </button>
                    ) : (
                        <button onClick={() => handleHidePopout('chart')}
                            className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest transition-all bg-[#555]/20 border border-[#555]/40 text-[#888] hover:bg-[#555]/30 hover:text-[#aaa]">
                            <svg className="w-3 h-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg> Hide
                        </button>
                    )}
                    <button onClick={() => handleClosePopout('chart')}
                        className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest transition-all bg-transparent border border-[#333] text-[#555] hover:border-[#34d399]/40 hover:text-[#34d399]">
                        Restore
                    </button>
                </div>
            )}

            <div className={`transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${showScore && !poppedOut.score && latestResult && status === 'idle'
                ? 'h-[280px] opacity-100 flex-shrink-0 flex gap-4'
                : 'h-0 opacity-0 overflow-hidden'
                }`}>
                {showScore && !poppedOut.score && latestResult && status === 'idle' && (
                    <div className="flex gap-4 w-full h-full">
                        <ScoreDisplay result={latestResult} />
                        <FeedbackPanel errors={latestResult.errors} />
                        {analysis && <AnalysisPanel analysis={analysis} />}
                    </div>
                )}
            </div>

            {/* Score pop-out placeholder */}
            {poppedOut.score && status === 'idle' && latestResult && (
                <div className="h-[56px] flex-shrink-0 flex items-center justify-center rounded-lg border border-[#10b981]/20 bg-[#10b981]/5 gap-3 px-4">
                    <span className="text-[#34d399] text-[10px] font-black uppercase tracking-widest flex-1 text-center flex items-center justify-center gap-1.5"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 22V4a2 2 0 0 1 4 0v18" /><path d="M10 14h4" /></svg> Score — OBS Window</span>
                    {hiddenPopouts['score'] ? (
                        <button onClick={() => handleShowPopout('score')}
                            className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest transition-all bg-[#818cf8]/20 border border-[#818cf8]/40 text-[#818cf8] hover:bg-[#818cf8]/30">
                            <svg className="w-3 h-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg> Show
                        </button>
                    ) : (
                        <button onClick={() => handleHidePopout('score')}
                            className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest transition-all bg-[#555]/20 border border-[#555]/40 text-[#888] hover:bg-[#555]/30 hover:text-[#aaa]">
                            <svg className="w-3 h-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg> Hide
                        </button>
                    )}
                    <button onClick={() => handleClosePopout('score')}
                        className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest transition-all bg-transparent border border-[#333] text-[#555] hover:border-[#34d399]/40 hover:text-[#34d399]">
                        Restore
                    </button>
                </div>
            )}
        </div>
    );
}
