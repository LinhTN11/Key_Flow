import React from 'react';
import { useInputStore } from '../../stores/inputStore';

export function MouseVisualizer() {
    const activeKeys = useInputStore((s) => s.activeKeys);

    const isLMB = activeKeys.has('MouseLeft');
    const isRMB = activeKeys.has('MouseRight');
    const isMMB = activeKeys.has('MouseMiddle');
    const isX1 = activeKeys.has('MouseX1');
    const isX2 = activeKeys.has('MouseX2');

    // "Không màu mè" - Clean grayscale solid highlights
    const getFill = (isActive: boolean) => isActive ? '#ffffff' : 'transparent';
    const getStroke = (isActive: boolean) => isActive ? '#ffffff' : '#555555';

    return (
        <div className="flex items-center justify-center p-2 h-[210px] ml-8 drop-shadow-md">
            <svg viewBox="0 0 100 150" className="w-[140px] h-[210px]" fill="none" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
                {/* Left Side Buttons */}
                <rect
                    x="10" y="70" width="8" height="15" rx="2"
                    fill={getFill(isX1)}
                    stroke={getStroke(isX1)}
                />
                <rect
                    x="10" y="90" width="8" height="15" rx="2"
                    fill={getFill(isX2)}
                    stroke={getStroke(isX2)}
                />

                {/* Body (Bottom) */}
                <path
                    d="M 18 61 L 82 61 L 82 105 Q 82 135, 50 135 Q 18 135, 18 105 Z"
                    fill="transparent"
                    stroke="#555555"
                />

                {/* Left Mouse Button (LMB) */}
                <path
                    d="M 42 55 L 18 55 L 18 35 Q 18 12, 42 12 Z"
                    fill={getFill(isLMB)}
                    stroke={getStroke(isLMB)}
                />

                {/* Right Mouse Button (RMB) */}
                <path
                    d="M 58 55 L 82 55 L 82 35 Q 82 12, 58 12 Z"
                    fill={getFill(isRMB)}
                    stroke={getStroke(isRMB)}
                />

                {/* Scroll Wheel / MMB */}
                <rect
                    x="46" y="24" width="8" height="20" rx="4"
                    fill={getFill(isMMB)}
                    stroke={getStroke(isMMB)}
                />
            </svg>
        </div>
    );
}
