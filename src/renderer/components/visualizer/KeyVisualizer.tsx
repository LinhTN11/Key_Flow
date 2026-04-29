import React from 'react';
import { useTranslation } from 'react-i18next';
import { useInputStore } from '../../stores/inputStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { KeyButton } from './KeyButton';
import { MouseVisualizer } from './MouseVisualizer';
import { KEYBOARD_LAYOUTS, FPS_ALLOWED_KEYS, OSU_ALLOWED_KEYS } from '../../lib/keyboardLayouts';

export function KeyVisualizer({ borderless = false }: { borderless?: boolean } = {}) {
    const { i18n } = useTranslation();
    const activeKeys = useInputStore((s) => s.activeKeys);
    const layoutStyle = useSettingsStore((s) => s.settings?.keyboardLayout || 'full');

    // Select layout based on current language, fallback to 'en'
    const layoutKey = i18n.language.split('-')[0]; // Handle language variants like 'en-US'
    const baseLayout = KEYBOARD_LAYOUTS[layoutKey] || KEYBOARD_LAYOUTS['en'];

    const isKeyActive = (code: string) => activeKeys.has(code);

    // Filter layout based on selected style
    const isAllowed = (code: string) => {
        if (layoutStyle === 'fps') return FPS_ALLOWED_KEYS.has(code);
        if (layoutStyle === 'osu') return OSU_ALLOWED_KEYS.has(code);
        return true; // 'full'
    };

    const filterRow = (row: any[]) => row.filter(k => isAllowed(k.code));

    const layout = {
        functionRow: filterRow(baseLayout.functionRow),
        numberRow: filterRow(baseLayout.numberRow),
        topRow: filterRow(baseLayout.topRow),
        middleRow: filterRow(baseLayout.middleRow),
        bottomRow: filterRow(baseLayout.bottomRow),
        spaceRow: filterRow(baseLayout.spaceRow),
    };

    return (
        <div className={`w-full h-full p-3 flex items-center justify-center gap-6 overflow-hidden kf-panel ${borderless ? 'bg-transparent' : 'bg-[#1a1a1a] rounded-lg border border-[#333]'}`}>
            {/* Keyboard Layout */}
            <div className="flex flex-col items-center justify-center gap-1.5">
                {/* Function Row */}
                {layout.functionRow.length > 0 && (
                    <div className="flex gap-1.5 mb-2 w-full justify-center scale-90 origin-bottom">
                        {layout.functionRow.map((key) => (
                            <React.Fragment key={key.code}>
                                <KeyButton
                                    label={key.label}
                                    subLabel={key.subLabel}
                                    tlLabel={key.tlLabel}
                                    trLabel={key.trLabel}
                                    blLabel={key.blLabel}
                                    brLabel={key.brLabel}
                                    isActive={isKeyActive(key.code)}
                                    width={key.width}
                                />
                                {key.code === 'Escape' && <div className="w-4" />}
                            </React.Fragment>
                        ))}
                    </div>
                )}

                {/* Number Row */}
                {layout.numberRow.length > 0 && (
                    <div className="flex gap-1.5">
                        {layout.numberRow.map((key) => (
                            <KeyButton
                                key={key.code}
                                label={key.label}
                                subLabel={key.subLabel}
                                tlLabel={key.tlLabel}
                                trLabel={key.trLabel}
                                blLabel={key.blLabel}
                                brLabel={key.brLabel}
                                isActive={isKeyActive(key.code)}
                                width={key.width}
                            />
                        ))}
                    </div>
                )}

                {/* Top Row */}
                {layout.topRow.length > 0 && (
                    <div className="flex gap-1.5">
                        {layout.topRow.map((key) => (
                            <KeyButton
                                key={key.code}
                                label={key.label}
                                subLabel={key.subLabel}
                                tlLabel={key.tlLabel}
                                trLabel={key.trLabel}
                                blLabel={key.blLabel}
                                brLabel={key.brLabel}
                                isActive={isKeyActive(key.code)}
                                width={key.width}
                            />
                        ))}
                    </div>
                )}

                {/* Middle Row */}
                {layout.middleRow.length > 0 && (
                    <div className="flex gap-1.5">
                        {layout.middleRow.map((key) => (
                            <KeyButton
                                key={key.code}
                                label={key.label}
                                subLabel={key.subLabel}
                                tlLabel={key.tlLabel}
                                trLabel={key.trLabel}
                                blLabel={key.blLabel}
                                brLabel={key.brLabel}
                                isActive={isKeyActive(key.code)}
                                width={key.width}
                            />
                        ))}
                    </div>
                )}

                {/* Bottom Row */}
                {layout.bottomRow.length > 0 && (
                    <div className="flex gap-1.5">
                        {layout.bottomRow.map((key) => (
                            <KeyButton
                                key={key.code}
                                label={key.label}
                                subLabel={key.subLabel}
                                tlLabel={key.tlLabel}
                                trLabel={key.trLabel}
                                blLabel={key.blLabel}
                                brLabel={key.brLabel}
                                isActive={isKeyActive(key.code)}
                                width={key.width}
                            />
                        ))}
                    </div>
                )}

                {/* Space & Mods Row */}
                {layout.spaceRow.length > 0 && (
                    <div className="flex gap-1.5 mt-1">
                        {layout.spaceRow.map((key) => (
                            <KeyButton
                                key={key.code}
                                label={key.label}
                                subLabel={key.subLabel}
                                tlLabel={key.tlLabel}
                                trLabel={key.trLabel}
                                blLabel={key.blLabel}
                                brLabel={key.brLabel}
                                isActive={isKeyActive(key.code)}
                                width={key.width || 'w-12'}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Mouse Visualizer (Right side) */}
            <div className="scale-90 origin-left">
                <MouseVisualizer />
            </div>
        </div>
    );
}
