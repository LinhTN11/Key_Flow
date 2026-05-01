import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { usePatternStore } from '../stores/patternStore';
import { useComparisonStore } from '../stores/comparisonStore';
import { PatternEditor } from '../components/pattern/PatternEditor';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { createPatternPack, parsePatternImportFile } from '../lib/patternImport';
import { isTauriRuntime } from '../lib/runtime';
import * as db from '../services/db';
import type { Pattern, PatternStats } from '../types';

export function LibraryPage() {
    const { t } = useTranslation();
    const patterns = usePatternStore((s) => s.patterns);
    const loadAll = usePatternStore((s) => s.loadAll);
    const isLoading = usePatternStore((s) => s.isLoading);
    const updatePattern = usePatternStore((s) => s.updatePattern);
    const deletePattern = usePatternStore((s) => s.deletePattern);

    const activePattern = useComparisonStore((s) => s.activePattern);
    const setPattern = useComparisonStore((s) => s.setPattern);
    const markedPatterns = useComparisonStore((s) => s.markedPatterns);
    const isMultiSelectMode = useComparisonStore((s) => s.isMultiSelectMode);
    const toggleMarkPattern = useComparisonStore((s) => s.toggleMarkPattern);
    const setMultiSelectMode = useComparisonStore((s) => s.setMultiSelectMode);
    const clearMarkedPatterns = useComparisonStore((s) => s.clearMarkedPatterns);

    const [editingPattern, setEditingPattern] = React.useState<Pattern | null>(null);
    const [isCreatingNew, setIsCreatingNew] = React.useState(false);
    const [pendingNewPattern, setPendingNewPattern] = React.useState<Pattern | null>(null);
    const [newName, setNewName] = useState('');
    const [newGame, setNewGame] = useState('');
    const [newCharacter, setNewCharacter] = useState('');
    const [searchQuery, setSearchQuery] = React.useState('');
    const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
    const [isAlertOpen, setIsAlertOpen] = React.useState(false);
    const [alertMessage, setAlertMessage] = React.useState('');
    const [patternToDelete, setPatternToDelete] = React.useState<string | null>(null);
    const [showToast, setShowToast] = useState(false);
    const [toastMsg, setToastMsg] = useState('');
    const [patternStats, setPatternStats] = useState<Record<string, PatternStats>>({});

    useEffect(() => {
        if (!showToast) return;
        const t = setTimeout(() => setShowToast(false), 2000);
        return () => clearTimeout(t);
    }, [showToast]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    useEffect(() => {
        let disposed = false;

        async function loadStats() {
            if (!isTauriRuntime()) {
                setPatternStats({});
                return;
            }

            try {
                const stats = await db.getPatternStats();
                if (!disposed) setPatternStats(stats);
            } catch (error) {
                console.error('[LibraryPage] Failed to load pattern stats:', error);
                if (!disposed) setPatternStats({});
            }
        }

        void loadStats();
        return () => {
            disposed = true;
        };
    }, [patterns.length]);

    const filteredPatterns = patterns.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.game?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.character?.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleExport = (p: Pattern) => {
        const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${p.name.replace(/\s+/g, '_')}_combo.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportPack = () => {
        if (markedPatterns.length === 0) return;
        const pack = createPatternPack(markedPatterns);
        const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `keyflow_pack_${markedPatterns.length}_combos.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        try {
            const importedPatterns = parsePatternImportFile(text);
            for (const pattern of importedPatterns) {
                await usePatternStore.getState().createPattern(pattern);
            }
            e.target.value = '';
            setToastMsg(t('library.import_success', { count: importedPatterns.length }));
            setShowToast(true);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setAlertMessage(t('library.import_failed') + ': ' + message);
            setIsAlertOpen(true);
        }
    };

    const blankPattern: Pattern = {
        id: '__new__',
        name: t('library.new_combo'),
        game: '',
        character: '',
        description: '',
        tags: [],
        events: [],
        totalDuration: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };

    const handleCreateNew = () => {
        setIsCreatingNew(true);
    };

    const handleNewEditorSave = (updated: Pattern) => {
        // Instead of saving directly, show naming modal
        setPendingNewPattern(updated);
        setIsCreatingNew(false);
    };

    const handleNewEditorCancel = () => {
        setIsCreatingNew(false);
    };

    const handleConfirmNewSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pendingNewPattern || !newName) return;
        await usePatternStore.getState().createPattern({
            name: newName,
            game: newGame,
            character: newCharacter,
            description: pendingNewPattern.description,
            tags: pendingNewPattern.tags,
            totalDuration: pendingNewPattern.totalDuration,
            events: pendingNewPattern.events,
        });
        setPendingNewPattern(null);
        setNewName('');
        setNewGame('');
        setNewCharacter('');
        setToastMsg(t('library.save_success'));
        setShowToast(true);
    };

    const handleCancelNewSave = () => {
        setPendingNewPattern(null);
        setNewName('');
        setNewGame('');
        setNewCharacter('');
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-full text-[#a3a3a3]">{t('common.loading')}</div>;
    }

    return (
        <div className="p-8 h-full overflow-y-auto custom-scrollbar">
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tighter mb-2">{t('library.title')}</h1>
                    <p className="text-[#666] font-medium uppercase tracking-widest text-[10px]">{t('library.subtitle')}</p>
                </div>
                <div className="flex items-center gap-4">
                    {isMultiSelectMode && markedPatterns.length > 0 && (
                        <>
                            <button
                                onClick={handleExportPack}
                                className="px-4 py-3 rounded-full font-bold text-xs uppercase tracking-tight transition-all border border-[#6366f1]/40 text-[#818cf8] hover:bg-[#6366f1] hover:text-white"
                            >
                                {t('library.export_pack')}
                            </button>
                            <button
                                onClick={clearMarkedPatterns}
                                className="px-4 py-3 rounded-full font-bold text-xs uppercase tracking-tight transition-all border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white"
                            >
                                {t('library.clear_all')}
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setMultiSelectMode(!isMultiSelectMode)}
                        className={`px-6 py-3 rounded-full font-bold text-sm uppercase tracking-tight transition-all border ${isMultiSelectMode
                            ? 'bg-[#6366f1] border-[#6366f1] text-white'
                            : 'bg-[#1a1a1a] border-[#333] text-[#f5f5f5] hover:border-[#666]'
                            }`}
                    >
                        {isMultiSelectMode ? t('library.done_selecting') : t('library.select_multiple')}
                    </button>
                    <button
                        onClick={handleCreateNew}
                        className="bg-[#6366f1] hover:bg-[#818cf8] text-white font-bold px-6 py-3 rounded-full cursor-pointer transition-all text-sm uppercase tracking-tight shadow-lg shadow-[#6366f1]/20 active:scale-95 flex items-center gap-2"
                    >
                        <span className="text-lg leading-none">+</span>
                        {t('library.create_new')}
                    </button>
                    <label className="bg-[#1a1a1a] border border-[#333] hover:border-[#666] text-[#f5f5f5] font-bold px-6 py-3 rounded-full cursor-pointer transition-all text-sm uppercase tracking-tight">
                        {t('common.import')}
                        <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                    </label>
                </div>
            </div>

            <div className="mb-8 flex gap-4">
                <div className="relative flex-1 group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        <svg
                            className="w-4 h-4 text-[#666] group-focus-within:text-[#6366f1] transition-colors"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.3-4.3" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder={t('library.search_placeholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl py-3 pl-12 pr-4 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#6366f1] transition-all"
                    />
                </div>
            </div>

            <ConfirmDialog
                isOpen={isConfirmOpen}
                title={t('library.delete_confirm_title')}
                message={t('library.delete_confirm_msg')}
                confirmLabel={t('library.delete_pattern')}
                variant="danger"
                onConfirm={async () => {
                    if (patternToDelete) {
                        await deletePattern(patternToDelete);
                    }
                    setIsConfirmOpen(false);
                    setPatternToDelete(null);
                }}
                onCancel={() => {
                    setIsConfirmOpen(false);
                    setPatternToDelete(null);
                }}
            />

            <ConfirmDialog
                isOpen={isAlertOpen}
                title={t('common.notification')}
                message={alertMessage}
                confirmLabel={t('common.close')}
                onConfirm={() => setIsAlertOpen(false)}
            />

            {editingPattern && (
                <PatternEditor
                    pattern={editingPattern}
                    onSave={async (updated) => {
                        await updatePattern(updated.id, updated);
                        setEditingPattern(null);
                    }}
                    onCancel={() => setEditingPattern(null)}
                />
            )}

            {isCreatingNew && (
                <PatternEditor
                    pattern={blankPattern}
                    onSave={handleNewEditorSave}
                    onCancel={handleNewEditorCancel}
                />
            )}

            {pendingNewPattern && createPortal(
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
                    onClick={(e) => e.stopPropagation()}
                >
                    <form
                        onSubmit={handleConfirmNewSave}
                        className="bg-[#1a1a1a] border border-[#333] rounded-3xl p-8 w-full max-w-md shadow-2xl relative overflow-hidden text-left"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="absolute top-[-10%] right-[-10%] w-32 h-32 bg-[#6366f1] blur-[64px] opacity-10 pointer-events-none" />

                        <h2 className="text-2xl font-black mb-2 tracking-tighter text-white uppercase">{t('practice.save_new_combo')}</h2>
                        <p className="text-xs text-[#666] mb-8">{pendingNewPattern.events.length} {t('library.events_short')} - {((pendingNewPattern.totalDuration || 0) / 1000).toFixed(2)}s</p>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-[#666] uppercase tracking-[0.2em]">{t('practice.combo_name')}</label>
                                <input autoFocus required value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('practice.combo_name_placeholder')} className="w-full px-4 py-3 rounded-xl bg-[#222] text-white border border-[#333] focus:outline-none focus:border-[#6366f1] transition-all" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-[#666] uppercase tracking-[0.2em]">{t('practice.game')}</label>
                                <input value={newGame} onChange={e => setNewGame(e.target.value)} placeholder={t('practice.game_placeholder')} className="w-full px-4 py-3 rounded-xl bg-[#222] text-white border border-[#333] focus:outline-none focus:border-[#6366f1] transition-all" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-[#666] uppercase tracking-[0.2em]">{t('practice.character')}</label>
                                <input value={newCharacter} onChange={e => setNewCharacter(e.target.value)} placeholder={t('practice.character_placeholder')} className="w-full px-4 py-3 rounded-xl bg-[#222] text-white border border-[#333] focus:outline-none focus:border-[#6366f1] transition-all" />
                            </div>
                        </div>

                        <div className="flex gap-4 mt-10">
                            <button
                                type="submit"
                                className={`flex-1 font-black py-4 rounded-2xl transition-all shadow-lg text-xs uppercase active:scale-95 ${
                                    pendingNewPattern.events.length === 0
                                        ? 'bg-[#333] text-[#666] cursor-not-allowed'
                                        : 'bg-[#6366f1] text-white hover:bg-[#818cf8] shadow-[#6366f1]/20'
                                }`}
                                disabled={pendingNewPattern.events.length === 0}
                            >
                                {pendingNewPattern.events.length === 0 ? t('practice.no_keys_recorded') : t('practice.save_now')}
                            </button>
                            <button
                                type="button"
                                onClick={handleCancelNewSave}
                                className="bg-[#333] text-[#a3a3a3] font-black px-6 py-4 rounded-2xl hover:bg-[#444] transition-all text-xs uppercase"
                            >
                                {t('practice.cancel')}
                            </button>
                        </div>

                        {pendingNewPattern.events.length === 0 && (
                            <p className="mt-4 text-center text-red-500 text-[10px] font-bold uppercase tracking-widest animate-pulse">
                                {t('library.add_events_hint')}
                            </p>
                        )}
                    </form>
                </div>,
                document.body
            )}

            {showToast && createPortal(
                <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[99999] bg-[#1a1a1a] text-white px-8 py-4 rounded-2xl shadow-2xl border border-[#6366f1]/50 animate-fade-in font-black uppercase tracking-widest text-[10px] backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-[#6366f1] shadow-[0_0_8px_#6366f1]" />
                        {toastMsg}
                    </div>
                </div>,
                document.body
            )}

            {patterns.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-[#1a1a1a] border border-[#333] border-dashed rounded-lg">
                    <svg className="w-10 h-10 text-[#444] mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
                    <p className="text-[#f5f5f5] font-medium">{t('library.no_combos')}</p>
                    <p className="text-[#a3a3a3] text-sm mt-1 mb-4">{t('library.no_combos_desc')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                    {filteredPatterns.map((p) => {
                        const isActive = activePattern?.id === p.id;
                        const isMarked = markedPatterns.some(m => m.id === p.id);
                        const stats = patternStats[p.id];
                        return (
                            <div
                                key={p.id}
                                className={`bg-[#1a1a1a] border rounded-2xl p-5 transition-all cursor-pointer group hover:-translate-y-1 flex flex-col min-h-[180px] ${isActive ? 'border-[#6366f1] ring-1 ring-[#6366f1] shadow-lg shadow-[#6366f1]/10' :
                                    isMarked ? 'border-[#818cf8] ring-1 ring-[#818cf8]/50 shadow-md shadow-[#818cf8]/5' :
                                        'border-[#333] hover:border-[#666]'
                                    }`}
                                onClick={() => {
                                    if (isMultiSelectMode) {
                                        toggleMarkPattern(p);
                                    } else {
                                        if (activePattern?.id === p.id) {
                                            setPattern(null);
                                        } else {
                                            setPattern(p);
                                        }
                                    }
                                }}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-[#6366f1] bg-[#6366f1]/10 px-2.5 py-1 rounded-md uppercase tracking-wider">
                                            {p.game}
                                        </span>
                                        {isMarked && (
                                            <span className="text-[10px] font-black text-white bg-[#6366f1] px-2 py-1 rounded-md uppercase tracking-wider">
                                                {t('library.marked_badge')}
                                            </span>
                                        )}
                                    </div>
                                    {isActive && <div className="animate-pulse w-2 h-2 rounded-full bg-[#22c55e]" />}
                                </div>
                                <h3 className="text-[#f5f5f5] font-bold text-xl mb-1 leading-none tracking-tight">{p.name}</h3>
                                <p className="text-[#666] text-xs font-medium uppercase mb-4 tracking-wide">{p.character}</p>

                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    <PatternStat label={t('library.attempts')} value={stats?.attemptCount ?? 0} />
                                    <PatternStat label={t('library.best_score')} value={stats?.bestScore ?? '-'} />
                                    <PatternStat label={t('library.avg_score')} value={stats?.averageScore ?? '-'} />
                                </div>

                                <div className="flex items-center gap-3 mt-auto pt-4 border-t border-white/[0.03]">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setEditingPattern(p); }}
                                        className="text-[10px] font-black text-[#666] hover:text-[#f5f5f5] transition-colors uppercase tracking-widest whitespace-nowrap"
                                    >
                                        {t('common.edit')}
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setPatternToDelete(p.id); setIsConfirmOpen(true); }}
                                        className="text-[10px] font-black text-red-500/50 hover:text-red-500 transition-colors uppercase tracking-widest whitespace-nowrap"
                                    >
                                        {t('common.delete')}
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleExport(p); }}
                                        className="text-[10px] font-black text-[#6366f1]/70 hover:text-[#6366f1] transition-colors uppercase tracking-widest whitespace-nowrap"
                                    >
                                        {t('common.export')}
                                    </button>
                                    <div className="flex-1" />
                                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest whitespace-nowrap text-right">
                                        {p.events.length} {t('library.events_short')}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function PatternStat({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-2 py-2 min-w-0">
            <p className="text-[8px] text-[#555] font-black uppercase tracking-widest truncate">{label}</p>
            <p className="text-sm text-white font-black leading-tight mt-0.5">{value}</p>
        </div>
    );
}
