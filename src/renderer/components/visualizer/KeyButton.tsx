/**
 * KeyButton — Individual key display component within the visualizer.
 * Pulses or changes color when active. Supports simple labels and complex 4-quadrant layouts.
 */

import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export interface KeyButtonProps {
    label?: React.ReactNode;
    subLabel?: React.ReactNode;
    tlLabel?: React.ReactNode;
    trLabel?: React.ReactNode;
    blLabel?: React.ReactNode;
    brLabel?: React.ReactNode;
    isActive?: boolean;
    className?: string;
    width?: string;
    activeColor?: string;
}

export function KeyButton({ label, subLabel, tlLabel, trLabel, blLabel, brLabel, isActive, className, width = 'w-12', activeColor = '#6366f1' }: KeyButtonProps) {
    const customHeight = className?.includes('h-') || width.includes('h-');
    const isComplex = tlLabel || trLabel || blLabel || brLabel;

    return (
        <div
            className={cn(
                'rounded flex border shadow-sm transition-colors duration-75 p-1',
                !customHeight && 'h-12',
                width,
                isActive
                    ? 'text-white'
                    : 'bg-[#252525] border-[#333] text-[#a3a3a3]',
                !isComplex && 'flex-col items-center justify-center',
                className
            )}
            style={isActive ? {
                backgroundColor: activeColor,
                borderColor: activeColor,
                boxShadow: `0 1px 3px 0 ${activeColor}80`,
            } : undefined}
        >
            {isComplex ? (
                <div className="w-full h-full flex flex-col justify-between">
                    <div className="flex justify-between w-full leading-none">
                        <span className="text-[10px] whitespace-pre-wrap leading-[1.1]">{tlLabel}</span>
                        <span className="text-[10px] whitespace-pre-wrap leading-[1.1]">{trLabel}</span>
                    </div>
                    <div className="flex justify-between w-full leading-none items-end">
                        <span className="text-[11px] font-medium whitespace-pre-wrap leading-[1.1]">{blLabel}</span>
                        <span className="text-[11px] whitespace-pre-wrap leading-[1.1]">{brLabel}</span>
                    </div>
                </div>
            ) : (
                <>
                    <span className={cn('font-medium', subLabel ? 'text-xs' : 'text-sm')}>{label}</span>
                    {subLabel && <span className="text-[9px] opacity-70 mt-0.5">{subLabel}</span>}
                </>
            )}
        </div>
    );
}
