/**
 * PatternRecorder — UI for recording new pattern combo.
 */


import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { useInputStore } from '../../stores/inputStore';
import { useSessionStore } from '../../stores/sessionStore';
import { usePatternStore } from '../../stores/patternStore';
import { getDisplayLabel } from '../../lib/patternUtils';
import { v4 as uuid } from 'uuid';
import type { PatternEvent } from '../../types';


// Toast helper
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
    React.useEffect(() => {
        const t = setTimeout(onClose, 2000);
        return () => clearTimeout(t);
    }, [onClose]);

    return createPortal(
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[99999] bg-[#1a1a1a] text-white px-8 py-4 rounded-2xl shadow-2xl border border-[#6366f1]/50 animate-fade-in font-black uppercase tracking-widest text-[10px] backdrop-blur-md">
            <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#6366f1] shadow-[0_0_8px_#6366f1]" />
                {message}
            </div>
        </div>,
        document.body
    );
}

interface Props {
    variant?: 'compact' | 'large';
}

export function PatternRecorder({ variant = 'large' }: Props) {
    const { t } = useTranslation();
    const { presses, clearSession, startSession: inputStartSession, stopSession: inputStopSession } = useInputStore();
    const { startSession, endSession, currentSession } = useSessionStore();
    const { createPattern } = usePatternStore();

    const [isNaming, setIsNaming] = useState(false);
    const [name, setName] = useState('');
    const [game, setGame] = useState('');
    const [character, setCharacter] = useState('');
    const [showToast, setShowToast] = useState(false);
    const [toastMsg, setToastMsg] = useState('');
    const [step, setStep] = useState<'idle' | 'recording' | 'naming'>('idle');

    // Determine recording state by local step, not just session
    const isRecording = step === 'recording';

    // Sync step with session status (for robustness)
    React.useEffect(() => {
        if (currentSession?.status === 'recording' && currentSession.patternId === null) {
            setStep('recording');
        } else if (step === 'recording' && (!currentSession || currentSession.status !== 'recording')) {
            setStep('idle');
        }
    }, [currentSession, step]);

    // Space shortcut removed to prevent conflict with combo inputs

    // Main workflow
    const handleToggleRecording = async () => {
        if (isRecording) {
            await endSession();
            inputStopSession();
            await window.electronAPI.stopListening();
            setStep('naming');
            setIsNaming(true);
        } else {
            clearSession();
            const session = await startSession(null);

            // Wait for first input so timeline begins precisely when user types
            inputStartSession(session.id, true);

            // Immediately set status locally
            setStep('recording');
            await window.electronAPI.startListening(session.id);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || presses.length === 0) {
            setIsNaming(false);
            setStep('idle');
            return;
        }
        // Convert InputPress to PatternEvent
        const firstStartTime = presses[0].startTime;
        const events: PatternEvent[] = presses.map(p => {
            const startTime = Math.round(p.startTime - firstStartTime);
            const endTime = Math.round((p.endTime || p.startTime) - firstStartTime);
            return {
                id: uuid(),
                key: p.key,
                displayLabel: getDisplayLabel(p.key),
                startTime,
                endTime,
                duration: Math.round(p.duration || (endTime - startTime)),
                timingToleranceMs: 80,
                durationTolerancePct: 0.3,
            };
        });
        const totalDuration = events.length > 0 ? Math.max(...events.map(e => e.endTime)) : 0;
        await createPattern({
            name,
            game,
            character,
            description: '',
            tags: [],
            totalDuration,
            events
        });
        setIsNaming(false);
        setStep('idle');
        setName('');
        setGame('');
        setCharacter('');
        clearSession();
        setToastMsg(t('library.save_success') || 'Combo saved!');
        setShowToast(true);
    };

    const handleCancel = () => {
        setIsNaming(false);
        setStep('idle');
        setName('');
        setGame('');
        setCharacter('');
        clearSession();
    };

    const renderNamingModal = () => {
        if (!isNaming) return null;

        const modalContent = (
            <div
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
                onClick={(e) => e.stopPropagation()}
            >
                <form
                    onSubmit={handleSave}
                    className="bg-[#1a1a1a] border border-[#333] rounded-3xl p-8 w-full max-w-md shadow-2xl relative overflow-hidden text-left"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="absolute top-[-10%] right-[-10%] w-32 h-32 bg-[#6366f1] blur-[64px] opacity-10 pointer-events-none" />

                    <h2 className="text-2xl font-black mb-8 tracking-tighter text-white uppercase">{t('practice.save_new_combo')}</h2>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[#666] uppercase tracking-[0.2em]">{t('practice.combo_name')}</label>
                            <input autoFocus required value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Hu Tao N1CJP" className="w-full px-4 py-3 rounded-xl bg-[#222] text-white border border-[#333] focus:outline-none focus:border-[#6366f1] transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[#666] uppercase tracking-[0.2em]">Game</label>
                            <input value={game} onChange={e => setGame(e.target.value)} placeholder="e.g., Genshin Impact" className="w-full px-4 py-3 rounded-xl bg-[#222] text-white border border-[#333] focus:outline-none focus:border-[#6366f1] transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[#666] uppercase tracking-[0.2em]">{t('practice.character')}</label>
                            <input value={character} onChange={e => setCharacter(e.target.value)} placeholder="e.g., Hu Tao" className="w-full px-4 py-3 rounded-xl bg-[#222] text-white border border-[#333] focus:outline-none focus:border-[#6366f1] transition-all" />
                        </div>
                    </div>

                    <div className="flex gap-4 mt-10">
                        <button
                            type="submit"
                            className={`flex-1 font-black py-4 rounded-2xl transition-all shadow-lg text-xs uppercase active:scale-95 ${presses.length === 0
                                ? 'bg-[#333] text-[#666] cursor-not-allowed'
                                : 'bg-[#6366f1] text-white hover:bg-[#818cf8] shadow-[#6366f1]/20'
                                }`}
                            disabled={presses.length === 0}
                        >
                            {presses.length === 0 ? t('practice.no_keys_recorded') : t('practice.save_now')}
                        </button>
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="bg-[#333] text-[#a3a3a3] font-black px-6 py-4 rounded-2xl hover:bg-[#444] transition-all text-xs uppercase"
                        >
                            {t('practice.cancel')}
                        </button>
                    </div>

                    {presses.length === 0 && (
                        <p className="mt-4 text-center text-red-500 text-[10px] font-bold uppercase tracking-widest animate-pulse">
                            {t('practice.press_key_warning')}
                        </p>
                    )}
                </form>
            </div>
        );

        return createPortal(modalContent, document.body);
    };

    if (variant === 'compact') {
        return (
            <div className="flex items-center gap-3">
                <button
                    onClick={handleToggleRecording}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2 ${isRecording
                        ? 'bg-red-500 hover:bg-red-400 text-white animate-pulse'
                        : 'bg-white hover:bg-gray-100 text-black'
                        }`}
                    disabled={isNaming}
                >
                    <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-red-500'}`} />
                    {isRecording ? (t('practice.stop_recording') || 'Stop Recording') : (t('practice.record_new') || 'Record New')}
                </button>

                {isRecording && (
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-px bg-white/10" />
                        <span className="text-[10px] text-red-500 font-bold tracking-widest uppercase animate-pulse">
                            Rec: {presses.length}
                        </span>
                    </div>
                )}

                {renderNamingModal()}
                {showToast && <Toast message={toastMsg} onClose={() => setShowToast(false)} />}
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center">
            <button
                onClick={handleToggleRecording}
                className={`group relative px-8 py-4 rounded-full font-bold flex items-center gap-3 transition-all shadow-xl hover:scale-105 active:scale-95 ${isRecording
                    ? 'bg-red-500 text-white ring-4 ring-red-500/30'
                    : 'bg-white text-black ring-4 ring-white/10'
                    }`}
                disabled={isNaming}
            >
                <div className={`w-3.5 h-3.5 rounded-full transition-all ${isRecording
                    ? 'bg-white animate-pulse shadow-[0_0_12px_rgba(255,255,255,0.8)]'
                    : 'bg-red-500 group-hover:scale-110'
                    }`} />
                <span className="tracking-tight uppercase">
                    {isRecording ? (t('practice.stop_recording') || 'Stop Recording') : (t('practice.record_new_combo') || 'Record New Combo')}
                </span>
            </button>

            {isRecording && (
                <div className="flex flex-col items-center mt-4">
                    <p className="text-xs text-red-500 font-bold animate-bounce tracking-widest uppercase">
                        {t('practice.recording')} {presses.length} {t('practice.events')}
                    </p>
                    <div className="mt-2 animate-pulse text-[10px] text-[#f5f5f5] bg-[#333] px-3 py-1 rounded-full">
                        {t('practice.stop_recording_hint')}
                    </div>
                </div>
            )}

            {renderNamingModal()}
            {showToast && <Toast message={toastMsg} onClose={() => setShowToast(false)} />}
        </div>
    );
}
