/**
 * AnalysisPanel — Displays multi-attempt trends and statistics.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AttemptAnalysis } from '../../types';

interface Props {
    analysis: AttemptAnalysis;
}

export function AnalysisPanel({ analysis }: Props) {
    const { t } = useTranslation();
    const { averageScore, trend, consistentErrors, perKeyStats } = analysis;

    return (
        <div className="flex-1 h-full bg-[#1a1a1a] rounded-2xl border border-[#252525] p-5 flex flex-col gap-4 shadow-2xl relative overflow-hidden group">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#6366f1] blur-[80px] opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none" />

            <header className="flex justify-between items-center relative z-10">
                <div>
                    <h3 className="text-[10px] font-black text-[#444] uppercase tracking-[0.2em] mb-1">{t('analysis.performance_header')}</h3>
                    <div className="flex items-center gap-3">
                        <span className="text-4xl font-black text-white tracking-tighter">{Math.round(averageScore)}</span>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-[#666] uppercase tracking-wider">{t('analysis.avg_score')}</span>
                            <TrendBadge trend={trend} />
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex flex-row gap-4 flex-1 min-h-0 relative z-10 overflow-hidden">
                {/* Consistent Errors */}
                <div className="flex-1 min-w-0 bg-[#141414] rounded-2xl p-4 border border-[#252525] flex flex-col min-h-0 overflow-hidden">
                    <h4 className="text-[9px] font-black text-[#444] uppercase tracking-widest mb-4 flex-shrink-0">{t('analysis.consistent_issues')}</h4>
                    {consistentErrors.length > 0 ? (
                        <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                            {consistentErrors.map((type, i) => (
                                <div key={i} className="flex items-center gap-3 text-xs bg-[#1a1a1a] p-2 rounded-lg border border-white/[0.02]">
                                    <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                    <span className="text-[#a3a3a3] font-bold uppercase tracking-tight text-[10px]">
                                        {t(`feedback.${type}_summary`, { 
                                            defaultValue: t(`feedback.${type}`, { name: '', ms: '?' }) 
                                        })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-[10px] text-[#22c55e] font-black uppercase tracking-widest text-center">{t('analysis.perfect_consistency')}</p>
                        </div>
                    )}
                </div>

                {/* Key Stability */}
                <div className="flex-1 min-w-0 bg-[#141414] rounded-2xl p-4 border border-[#252525] flex flex-col min-h-0 overflow-hidden">
                    <h4 className="text-[9px] font-black text-[#444] uppercase tracking-widest mb-4 flex-shrink-0">{t('analysis.key_stability')}</h4>
                    <div className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pr-2 min-h-0 flex flex-col">
                        {perKeyStats.length > 0 ? (
                            perKeyStats.map((stat, i) => (
                                <div key={i} className="space-y-1.5">
                                    <div className="flex justify-between items-baseline gap-2 flex-wrap">
                                        <span className="text-[10px] font-black text-[#f5f5f5] uppercase tracking-tighter whitespace-nowrap">{stat.label.replace('Key', '')}</span>
                                        <span className={`text-[9px] font-bold ${stat.timingStdDev > 50 ? 'text-red-400' : 'text-[#666]'} uppercase whitespace-nowrap`}>
                                            ±{Math.round(stat.timingStdDev)}ms
                                        </span>
                                    </div>
                                    <div className="h-1 bg-[#252525] rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-1000 ${stat.timingStdDev > 50 ? 'bg-red-500' : stat.timingStdDev > 20 ? 'bg-amber-500' : 'bg-[#6366f1]'}`}
                                            style={{ width: `${Math.max(5, Math.min(100, 100 - (stat.timingStdDev / 2)))}%` }}
                                        />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-[9px] text-[#444] uppercase font-bold italic text-center mt-4 tracking-widest">{t('analysis.awaiting_data')}</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function TrendBadge({ trend }: { trend: AttemptAnalysis['trend'] }) {
    const { t } = useTranslation();
    const config = {
        improving: { label: t('analysis.trend.improving'), color: 'text-green-400', icon: '↑' },
        declining: { label: t('analysis.trend.declining'), color: 'text-red-400', icon: '↓' },
        stable: { label: t('analysis.trend.stable'), color: 'text-[#444]', icon: '→' },
    }[trend];

    return (
        <div className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest ${config.color}`}>
            <span>{config.icon}</span>
            <span>{config.label}</span>
        </div>
    );
}
