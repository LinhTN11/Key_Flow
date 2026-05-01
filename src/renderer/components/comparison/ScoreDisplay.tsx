import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ComparisonResult } from '../../types';

interface Props { result: ComparisonResult; }
type Rank = ReturnType<typeof getRank>;

export function ScoreDisplay({ result }: Props) {
    const { t } = useTranslation();
    const { overallScore, timingScore, orderScore, completionScore, durationScore } = result;
    const rank = getRank(overallScore);

    return (
        <div className="bg-[#1a1a1a] rounded-lg border border-[#333] p-4 w-[320px] flex-shrink-0 flex flex-col justify-center">
            <div className="flex items-center gap-6 mb-6 px-2">
                <ScoreRing score={overallScore} rank={rank} size={90} />
                <div>
                    <p className="text-3xl font-semibold text-white tracking-tight">{overallScore}</p>
                    <p className="text-[10px] text-[#666] font-black uppercase tracking-widest mt-1">{t('scoring.total_score')}</p>
                </div>
            </div>

            <div className="space-y-3 px-2">
                <SubScore label={t('scoring.completion')} value={completionScore} color="#f59e0b" />
                <SubScore label={t('scoring.timing')} value={timingScore} color="#6366f1" />
                <SubScore label={t('scoring.order')} value={orderScore} color="#22c55e" />
                <SubScore label={t('scoring.duration')} value={durationScore} color="#8b5cf6" />
            </div>
        </div>
    );
}

function getRank(score: number) {
    if (score >= 100) return { label: 'SSS', color: '#ef4444', glow: 'rgba(239, 68, 68, 0.5)' };
    if (score >= 95) return { label: 'SS', color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' };
    if (score >= 90) return { label: 'S', color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.3)' };
    if (score >= 80) return { label: 'A', color: '#22c55e', glow: 'transparent' };
    if (score >= 70) return { label: 'B', color: '#3b82f6', glow: 'transparent' };
    if (score >= 60) return { label: 'C', color: '#a855f7', glow: 'transparent' };
    return { label: 'D', color: '#666666', glow: 'transparent' };
}

function SubScore({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-[10px] text-[#666] w-[80px] font-black uppercase tracking-wider">{label}</span>
            <div className="flex-1 h-2 bg-[#333] rounded-full overflow-hidden">
                <div
                    className="h-full border-r border-black/20 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${value}%`, backgroundColor: color }}
                />
            </div>
            <span className="text-[10px] font-mono text-[#f5f5f5] w-8 text-right font-black">{Math.round(value)}</span>
        </div>
    );
}

function ScoreRing({ score, rank, size }: { score: number; rank: Rank; size: number }) {
    const strokeWidth = 8;
    const r = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * r;
    const offset = circumference - (score / 100) * circumference;

    return (
        <div className="relative group" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="drop-shadow-lg overflow-visible">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#252525" strokeWidth={strokeWidth} />
                <circle
                    cx={size / 2} cy={size / 2} r={r}
                    fill="none" stroke={rank.color} strokeWidth={strokeWidth}
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    className="transition-all duration-1000 ease-out"
                    style={{ filter: rank.glow !== 'transparent' ? `drop-shadow(0 0 4px ${rank.glow})` : 'none' }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span
                    className="text-2xl font-black italic tracking-tighter transition-all duration-500"
                    style={{ color: rank.color, textShadow: rank.glow !== 'transparent' ? `0 0 10px ${rank.glow}` : 'none' }}
                >
                    {rank.label}
                </span>
            </div>
        </div>
    );
}
