import React from 'react';
import { useTranslation } from 'react-i18next';
import * as db from '../services/db';
import { isTauriRuntime } from '../lib/runtime';
import type { ErrorType, PracticeHistoryItem } from '../types';

type DateFilter = 'all' | 'today' | '7d' | '30d';
type ScoreFilter = 'all' | '90' | '70' | '50' | 'low';
type ErrorFilter = 'all' | ErrorType;
type SortOrder = 'newest' | 'oldest' | 'score_high' | 'score_low' | 'errors_high';

const ERROR_TYPES: ErrorType[] = [
    'timing_early',
    'timing_late',
    'missed_key',
    'extra_key',
    'wrong_order',
    'duration_too_short',
    'duration_too_long',
];

function formatDate(value: number, language: string) {
    return new Intl.DateTimeFormat(language, {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}

function getScoreTone(score: number) {
    if (score >= 90) return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10';
    if (score >= 70) return 'text-[#818cf8] border-[#818cf8]/30 bg-[#6366f1]/10';
    if (score >= 50) return 'text-amber-400 border-amber-400/30 bg-amber-400/10';
    return 'text-red-400 border-red-400/30 bg-red-400/10';
}

function summarizeErrors(items: PracticeHistoryItem[]): Array<[ErrorType, number]> {
    const counts = new Map<ErrorType, number>();
    for (const item of items) {
        for (const error of item.attempt.result?.errors ?? []) {
            counts.set(error.type, (counts.get(error.type) ?? 0) + error.occurrences);
        }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
}

function escapeCsv(value: string | number) {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadFile(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

function matchesDateFilter(item: PracticeHistoryItem, filter: DateFilter) {
    if (filter === 'all') return true;
    const now = Date.now();
    const endTime = item.attempt.endTime;
    if (filter === 'today') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        return endTime >= start.getTime();
    }
    const days = filter === '7d' ? 7 : 30;
    return endTime >= now - days * 24 * 60 * 60 * 1000;
}

function matchesScoreFilter(score: number, filter: ScoreFilter) {
    if (filter === 'all') return true;
    if (filter === 'low') return score < 50;
    return score >= Number(filter);
}

function getAttemptErrorCount(item: PracticeHistoryItem) {
    return item.attempt.result?.errors.reduce((sum, error) => sum + error.occurrences, 0) ?? 0;
}

function sortHistoryItems(items: PracticeHistoryItem[], sortOrder: SortOrder) {
    return [...items].sort((a, b) => {
        const aScore = a.attempt.result?.overallScore ?? 0;
        const bScore = b.attempt.result?.overallScore ?? 0;
        const newestFirst = b.attempt.endTime - a.attempt.endTime;

        switch (sortOrder) {
            case 'oldest':
                return a.attempt.endTime - b.attempt.endTime;
            case 'score_high':
                return (bScore - aScore) || newestFirst;
            case 'score_low':
                return (aScore - bScore) || newestFirst;
            case 'errors_high':
                return (getAttemptErrorCount(b) - getAttemptErrorCount(a)) || newestFirst;
            case 'newest':
            default:
                return newestFirst;
        }
    });
}

export function HistoryPage() {
    const { t, i18n } = useTranslation();
    const [items, setItems] = React.useState<PracticeHistoryItem[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [query, setQuery] = React.useState('');
    const [dateFilter, setDateFilter] = React.useState<DateFilter>('all');
    const [scoreFilter, setScoreFilter] = React.useState<ScoreFilter>('all');
    const [errorFilter, setErrorFilter] = React.useState<ErrorFilter>('all');
    const [sortOrder, setSortOrder] = React.useState<SortOrder>('newest');

    React.useEffect(() => {
        let disposed = false;

        async function loadHistory() {
            setIsLoading(true);
            try {
                const history = isTauriRuntime() ? await db.getPracticeHistory(200) : [];
                if (!disposed) setItems(history);
            } catch (error) {
                console.error('[HistoryPage] Failed to load practice history:', error);
                if (!disposed) setItems([]);
            } finally {
                if (!disposed) setIsLoading(false);
            }
        }

        void loadHistory();
        return () => {
            disposed = true;
        };
    }, []);

    const completed = items.filter((item) => item.attempt.result);
    const filtered = completed.filter((item) => {
        const result = item.attempt.result;
        if (!result) return false;

        const normalizedQuery = query.trim().toLowerCase();
        const matchesQuery = normalizedQuery.length === 0
            || item.patternName.toLowerCase().includes(normalizedQuery)
            || item.game.toLowerCase().includes(normalizedQuery)
            || item.character.toLowerCase().includes(normalizedQuery);
        const matchesError = errorFilter === 'all'
            || result.errors.some((error) => error.type === errorFilter);

        return matchesQuery
            && matchesDateFilter(item, dateFilter)
            && matchesScoreFilter(result.overallScore, scoreFilter)
            && matchesError;
    });
    const bestScore = completed.length
        ? Math.max(...filtered.map((item) => item.attempt.result?.overallScore ?? 0), 0)
        : 0;
    const averageScore = filtered.length
        ? Math.round(filtered.reduce((sum, item) => sum + (item.attempt.result?.overallScore ?? 0), 0) / filtered.length)
        : 0;
    const uniqueCombos = new Set(filtered.map((item) => item.attempt.patternId)).size;
    const frequentErrors = summarizeErrors(filtered);
    const sorted = sortHistoryItems(filtered, sortOrder);
    const getErrorSummary = (type: ErrorType) => t(`feedback.${type}_summary`);

    const handleExportJson = () => {
        downloadFile(
            `keyflow_history_${Date.now()}.json`,
            JSON.stringify({
                format: 'keyflow-history-export',
                version: 1,
                exportedAt: Date.now(),
                attempts: sorted,
            }, null, 2),
            'application/json'
        );
    };

    const handleExportCsv = () => {
        const header = ['date', 'combo', 'game', 'character', 'overall', 'timing', 'order', 'completion', 'duration', 'errors', 'inputs'];
        const rows = sorted.map((item) => {
            const result = item.attempt.result;
            return [
                new Date(item.attempt.endTime).toISOString(),
                item.patternName,
                item.game,
                item.character,
                result?.overallScore ?? 0,
                result?.timingScore ?? 0,
                result?.orderScore ?? 0,
                result?.completionScore ?? 0,
                result?.durationScore ?? 0,
                result?.errors.length ?? 0,
                item.attempt.presses.length,
            ].map(escapeCsv).join(',');
        });
        downloadFile(`keyflow_history_${Date.now()}.csv`, [header.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8');
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-full text-[#a3a3a3]">{t('common.loading')}</div>;
    }

    return (
        <div className="h-full overflow-hidden p-8 flex flex-col">
            <div className="mb-8 flex-shrink-0">
                <h1 className="text-4xl font-black text-white tracking-tighter mb-2">{t('history.title')}</h1>
                <p className="text-[#666] font-medium uppercase tracking-widest text-[10px]">{t('history.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 flex-shrink-0">
                <Stat label={t('history.total_attempts')} value={filtered.length.toString()} />
                <Stat label={t('history.best_score')} value={bestScore.toString()} />
                <Stat label={t('history.average_score')} value={averageScore.toString()} />
                <Stat label={t('history.combos_practiced')} value={uniqueCombos.toString()} />
            </div>

            <div className="mb-6 bg-[#1a1a1a] border border-[#333] rounded-xl p-4 flex-shrink-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_repeat(4,150px)_auto_auto] gap-3 items-center">
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t('history.search_placeholder')}
                        className="min-w-0 bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#6366f1]"
                    />
                    <FilterDropdown
                        value={sortOrder}
                        onChange={setSortOrder}
                        options={[
                            { value: 'newest', label: t('history.sort_newest') },
                            { value: 'oldest', label: t('history.sort_oldest') },
                            { value: 'score_high', label: t('history.sort_score_high') },
                            { value: 'score_low', label: t('history.sort_score_low') },
                            { value: 'errors_high', label: t('history.sort_errors_high') },
                        ]}
                    />
                    <FilterDropdown
                        value={dateFilter}
                        onChange={setDateFilter}
                        options={[
                            { value: 'all', label: t('history.date_all') },
                            { value: 'today', label: t('history.date_today') },
                            { value: '7d', label: t('history.date_7d') },
                            { value: '30d', label: t('history.date_30d') },
                        ]}
                    />
                    <FilterDropdown
                        value={scoreFilter}
                        onChange={setScoreFilter}
                        options={[
                            { value: 'all', label: t('history.score_all') },
                            { value: '90', label: t('history.score_90') },
                            { value: '70', label: t('history.score_70') },
                            { value: '50', label: t('history.score_50') },
                            { value: 'low', label: t('history.score_low') },
                        ]}
                    />
                    <FilterDropdown
                        value={errorFilter}
                        onChange={setErrorFilter}
                        options={[
                            { value: 'all', label: t('history.error_all') },
                            ...ERROR_TYPES.map((type) => ({
                                value: type,
                                label: getErrorSummary(type),
                            })),
                        ]}
                    />
                    <button
                        onClick={handleExportCsv}
                        disabled={filtered.length === 0}
                        className="px-4 py-3 rounded-xl border border-[#333] text-[#a3a3a3] hover:text-white hover:border-[#6366f1] disabled:opacity-30 disabled:cursor-not-allowed text-[10px] font-black uppercase tracking-widest"
                    >
                        {t('history.export_csv')}
                    </button>
                    <button
                        onClick={handleExportJson}
                        disabled={filtered.length === 0}
                        className="px-4 py-3 rounded-xl bg-[#6366f1] text-white hover:bg-[#818cf8] disabled:opacity-30 disabled:cursor-not-allowed text-[10px] font-black uppercase tracking-widest"
                    >
                        {t('history.export_json')}
                    </button>
                </div>
            </div>

            {frequentErrors.length > 0 && (
                <div className="mb-6 bg-[#1a1a1a] border border-[#333] rounded-xl p-5 flex-shrink-0">
                    <h2 className="text-[10px] font-black text-[#666] uppercase tracking-[0.2em] mb-4">{t('history.frequent_errors')}</h2>
                    <div className="flex flex-wrap gap-2">
                        {frequentErrors.map(([type, count]) => (
                            <span key={type} className="px-3 py-2 rounded-lg border border-red-400/20 bg-red-400/10 text-red-300 text-xs font-bold">
                                {getErrorSummary(type)} x{count}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar pr-2">
                {completed.length === 0 ? (
                    <div className="min-h-[360px] flex flex-col items-center justify-center border border-[#333] border-dashed rounded-xl bg-[#1a1a1a]">
                        <p className="text-white font-bold">{t('history.empty_title')}</p>
                        <p className="text-[#666] text-sm mt-1">{t('history.empty_desc')}</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="min-h-[360px] flex flex-col items-center justify-center border border-[#333] border-dashed rounded-xl bg-[#1a1a1a]">
                        <p className="text-white font-bold">{t('history.no_results_title')}</p>
                        <p className="text-[#666] text-sm mt-1">{t('history.no_results_desc')}</p>
                    </div>
                ) : (
                    <div className="space-y-3 pb-4">
                        {sorted.map((item) => {
                            const result = item.attempt.result;
                            if (!result) return null;

                            return (
                                <div key={item.attempt.id} className="bg-[#1a1a1a] border border-[#333] rounded-xl p-4 flex items-center gap-4 hover:border-[#555] transition-colors">
                                    <div className={`w-16 h-16 rounded-xl border flex items-center justify-center font-black text-2xl ${getScoreTone(result.overallScore)}`}>
                                        {result.overallScore}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h2 className="text-white font-bold truncate">{item.patternName}</h2>
                                            {item.game && <span className="text-[10px] text-[#818cf8] bg-[#6366f1]/10 px-2 py-0.5 rounded uppercase font-black">{item.game}</span>}
                                        </div>
                                        <p className="text-xs text-[#666] font-medium">
                                            {formatDate(item.attempt.endTime, i18n.language)} {item.character ? `- ${item.character}` : ''}
                                        </p>
                                    </div>

                                    <Metric label={t('scoring.timing')} value={result.timingScore} />
                                    <Metric label={t('scoring.order')} value={result.orderScore} />
                                    <Metric label={t('scoring.completion')} value={result.completionScore} />
                                    <Metric label={t('scoring.duration')} value={result.durationScore} />

                                    <div className="w-24 text-right">
                                        <p className="text-xs text-[#666] uppercase font-black">{t('feedback.errors_count', { count: result.errors.length })}</p>
                                        <p className="text-[10px] text-[#444] mt-1">{t('history.inputs_count', { count: item.attempt.presses.length })}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

function FilterDropdown<T extends string>({
    value,
    options,
    onChange,
}: {
    value: T;
    options: Array<{ value: T; label: string }>;
    onChange: (value: T) => void;
}) {
    const [isOpen, setIsOpen] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const current = options.find((option) => option.value === value) ?? options[0];

    React.useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div ref={dropdownRef} className="relative min-w-0">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full h-11 flex items-center justify-between gap-3 rounded-xl border border-[#333] bg-[#111] px-3 text-left text-[10px] font-black uppercase tracking-widest text-[#f5f5f5] transition-all hover:border-[#6366f1]/60 hover:bg-white/[0.03] focus:outline-none focus:border-[#6366f1]"
            >
                <span className="truncate">{current?.label}</span>
                <svg className={`h-3 w-3 flex-shrink-0 text-[#6366f1] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full z-[70] mt-2 w-full min-w-[190px] overflow-hidden rounded-xl border border-[#333] bg-[#1a1a1a] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                    <div className="max-h-[240px] overflow-y-auto custom-scrollbar p-1.5">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full rounded-lg px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest transition-all ${
                                    option.value === value
                                        ? 'bg-[#6366f1]/20 text-[#818cf8]'
                                        : 'text-[#666] hover:bg-white/[0.05] hover:text-white'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-5">
            <p className="text-[10px] text-[#666] font-black uppercase tracking-[0.2em] mb-2">{label}</p>
            <p className="text-3xl text-white font-black tracking-tight">{value}</p>
        </div>
    );
}

function Metric({ label, value }: { label: string; value: number }) {
    return (
        <div className="hidden xl:block w-20 text-right">
            <p className="text-[10px] text-[#666] uppercase font-black">{label}</p>
            <p className="text-sm text-white font-bold">{value}</p>
        </div>
    );
}
