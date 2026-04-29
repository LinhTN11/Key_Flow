import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ErrorItem } from '../../types';
import { useComparisonStore } from '../../stores/comparisonStore';
import { getDisplayLabel } from '../../lib/patternUtils';

interface Props { errors: ErrorItem[]; }

const MissedIcon = () => (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

const WarningIcon = () => (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
);

const StopwatchIcon = () => (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="13" r="8"></circle>
        <path d="M12 9v4l2 2"></path>
        <path d="M12 2v3"></path>
        <path d="M10 2h4"></path>
    </svg>
);

const PlusIcon = () => (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
);

const SwapIcon = () => (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="17 1 21 5 17 9"></polyline>
        <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
        <polyline points="7 23 3 19 7 15"></polyline>
        <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
    </svg>
);

const TYPE_CONFIG: Record<string, { color: string, bg: string, icon: React.ReactNode, border: string }> = {
    missed_key: { color: 'text-red-400', bg: 'bg-red-500/10', icon: <MissedIcon />, border: 'border-red-500/20' },
    timing_early: { color: 'text-amber-400', bg: 'bg-amber-500/10', icon: <WarningIcon />, border: 'border-amber-500/20' },
    timing_late: { color: 'text-amber-400', bg: 'bg-amber-500/10', icon: <WarningIcon />, border: 'border-amber-500/20' },
    duration_too_short: { color: 'text-blue-400', bg: 'bg-blue-500/10', icon: <StopwatchIcon />, border: 'border-blue-500/20' },
    duration_too_long: { color: 'text-blue-400', bg: 'bg-blue-500/10', icon: <StopwatchIcon />, border: 'border-blue-500/20' },
    extra_key: { color: 'text-purple-400', bg: 'bg-purple-500/10', icon: <PlusIcon />, border: 'border-purple-500/20' },
    wrong_order: { color: 'text-purple-400', bg: 'bg-purple-500/10', icon: <SwapIcon />, border: 'border-purple-500/20' },
};


export function FeedbackPanel({ errors }: Props) {
    const { t } = useTranslation();
    const { highlightedError, setHighlightedError } = useComparisonStore();

    if (errors.length === 0) {
        return (
            <div className="flex-1 h-full bg-[#1a1a1a] rounded-lg border border-[#333] p-4 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <p className="text-[#22c55e] font-medium">{t('feedback.perfect_combo')}</p>
                <p className="text-sm text-[#a3a3a3] mt-1">{t('feedback.no_errors_desc')}</p>
            </div>
        );
    }

    return (
        <div className="flex-1 h-full bg-[#1a1a1a] rounded-lg border border-[#333] p-4 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#f5f5f5]">{t('feedback.detailed_analysis')}</h3>
                <span className="text-xs px-2 py-1 bg-[#252525] rounded-full text-[#a3a3a3]">
                    {t('feedback.errors_count', { count: errors.length })}
                </span>
            </div>

            <div className="space-y-2 overflow-y-auto pr-2 pb-2 custom-scrollbar flex-1">
                {errors.map((err, i) => {
                    const cfg = TYPE_CONFIG[err.type] || TYPE_CONFIG.missed_key;

                    // Strictly match eventId if available, otherwise fallback to type+key
                    const isHighlighted = highlightedError?.eventId
                        ? highlightedError.eventId === err.eventId
                        : (highlightedError?.type === err.type && highlightedError?.key === err.key);

                    return (
                        <div
                            key={i}
                            onClick={() => setHighlightedError(isHighlighted ? null : { type: err.type, key: err.key, message: err.message, eventId: err.eventId })}
                            className={`rounded-md p-3 border transition-all cursor-pointer active:scale-[0.98] ${cfg.bg} ${isHighlighted ? 'border-white/40 ring-1 ring-white/10 shadow-lg' : cfg.border} flex items-start gap-3 hover:translate-x-1`}
                        >
                            <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs bg-black/20 ${cfg.color}`}>
                                {cfg.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold ${cfg.color} leading-tight`}>
                                    {(() => {
                                        const p = err.params || {
                                            name: getDisplayLabel(err.key),
                                            ms: '??',
                                            count: err.occurrences
                                        };
                                        // Ensure we pass 'name' to match the new JSON schema
                                        const params = { ...p, name: p.name || (p as any).label || getDisplayLabel(err.key) };
                                        return t(`feedback.${err.type}`, params) as string;
                                    })()}
                                    {err.occurrences > 1 && (
                                        <span className="ml-2 px-1.5 py-0.5 rounded-full bg-black/20 text-[10px] font-mono">
                                            ×{err.occurrences}
                                        </span>
                                    )}
                                </p>
                                <p className="text-[10px] text-[#a3a3a3] mt-1.5 font-medium">
                                    {(() => {
                                        const p = err.params || {
                                            name: getDisplayLabel(err.key),
                                            ms: '??',
                                            count: err.occurrences
                                        };
                                        const params = { ...p, name: p.name || (p as any).label || getDisplayLabel(err.key) };
                                        return t(`feedback.${err.type}_suggestion`, params) as string;
                                    })()}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
