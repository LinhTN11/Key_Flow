import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../stores/settingsStore';
import { usePatternStore } from '../stores/patternStore';
import * as db from '../services/db';
import { parseAppBackup } from '../lib/appBackup';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

function downloadFile(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

export function SettingsPage() {
    const { t } = useTranslation();
    const settings = useSettingsStore(s => s.settings);
    const updateSettings = useSettingsStore(s => s.updateSettings);
    const loadSettings = useSettingsStore(s => s.loadSettings);
    const loadPatterns = usePatternStore(s => s.loadAll);
    const [isLangDropdownOpen, setIsLangDropdownOpen] = React.useState(false);
    const [isLayoutDropdownOpen, setIsLayoutDropdownOpen] = React.useState(false);
    const [backupStatus, setBackupStatus] = React.useState('');
    const langDropdownRef = React.useRef<HTMLDivElement>(null);
    const layoutDropdownRef = React.useRef<HTMLDivElement>(null);
    const backupInputRef = React.useRef<HTMLInputElement>(null);

    const languages = [
        { id: 'en', label: 'English' },
        { id: 'vi', label: 'Tiếng Việt' },
        { id: 'ja', label: '日本語' },
        { id: 'zh', label: '简体中文' },
        { id: 'ko', label: '한국어' },
    ] as const;

    const layouts = [
        { id: 'full', label: t('settings.layout_full') },
        { id: 'fps', label: t('settings.layout_fps') },
        { id: 'osu', label: t('settings.layout_osu') },
    ] as const;

    const currentLanguage = languages.find(l => l.id === (settings?.language || 'en'));
    const currentLayout = layouts.find(l => l.id === (settings?.keyboardLayout || 'full'));

    const handleLanguageChange = (lng: 'en' | 'vi' | 'ja' | 'zh' | 'ko') => {
        updateSettings({ language: lng });
        setIsLangDropdownOpen(false);
    };

    const handleLayoutChange = (layout: 'full' | 'fps' | 'osu') => {
        updateSettings({ keyboardLayout: layout });
        setIsLayoutDropdownOpen(false);
    };

    const handleTimingOffsetChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(event.target.value);
        if (Number.isFinite(value)) {
            updateSettings({ timingOffsetMs: value });
        }
    };

    const updateNumberSetting = (key: keyof NonNullable<typeof settings>, value: string) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            updateSettings({ [key]: parsed });
        }
    };

    const handleExportBackup = async () => {
        try {
            const backup = await db.createAppBackup();
            downloadFile(`keyflow_backup_${Date.now()}.json`, JSON.stringify(backup, null, 2), 'application/json');
            setBackupStatus(t('settings.backup_export_success'));
        } catch (error) {
            console.error('[SettingsPage] Failed to export backup:', error);
            setBackupStatus(t('settings.backup_error'));
        }
    };

    const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const backup = parseAppBackup(await file.text());
            const result = await db.importAppBackup(backup);
            await Promise.all([loadPatterns(), loadSettings()]);
            setBackupStatus(t('settings.backup_import_success', result));
        } catch (error) {
            console.error('[SettingsPage] Failed to import backup:', error);
            setBackupStatus(t('settings.backup_error'));
        } finally {
            event.target.value = '';
        }
    };

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
                setIsLangDropdownOpen(false);
            }
            if (layoutDropdownRef.current && !layoutDropdownRef.current.contains(event.target as Node)) {
                setIsLayoutDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto scrollbar-hide">
            <h2 className="text-2xl font-semibold text-white tracking-tight mb-6" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {t('settings.title')}
            </h2>

            <div className="columns-1 xl:columns-2 gap-6">
            <div className="mb-6 break-inside-avoid bg-[#1a1a1a] border border-[#333] rounded-2xl p-5 sm:p-6 lg:p-8 shadow-2xl relative overflow-visible group min-w-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#6366f1] blur-[120px] opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none" />

                <h3 className="text-[10px] font-black text-[#444] uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <span className="w-1 h-1 bg-[#6366f1] rounded-full" />
                    {t('settings.appearance')}
                </h3>

                <div className="space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-4 border-b border-white/[0.03]">
                        <div className="min-w-0">
                            <p className="text-sm text-white font-bold tracking-tight">{t('settings.dark_mode')}</p>
                            <p className="text-xs text-[#666] font-medium leading-relaxed mt-0.5">{t('settings.dark_mode_desc')}</p>
                        </div>
                        <div className="inline-flex items-center gap-2 self-start rounded-full border border-[#6366f1]/30 bg-[#6366f1]/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#818cf8] sm:self-auto">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#818cf8] shadow-[0_0_10px_rgba(129,140,248,0.75)]" />
                            {t('settings.dark')}
                        </div>
                    </div>

                    {/* Keyboard Layout Dropdown */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-4 border-b border-white/[0.03] relative">
                        <div className="min-w-0">
                            <p className="text-sm text-white font-bold tracking-tight">{t('settings.keyboard_layout')}</p>
                            <p className="text-xs text-[#666] font-medium leading-relaxed mt-0.5">{t('settings.keyboard_layout_desc')}</p>
                        </div>
                        <div className="relative w-full sm:w-[180px] sm:flex-shrink-0" ref={layoutDropdownRef}>
                            <button
                                onClick={() => setIsLayoutDropdownOpen(!isLayoutDropdownOpen)}
                                className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-[#f5f5f5] hover:text-white transition-all bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] hover:border-white/[0.1] rounded-xl px-4 py-3"
                            >
                                <span className="truncate pr-4">{currentLayout?.label}</span>
                                <svg className={`w-3 h-3 text-[#6366f1] transition-transform duration-300 ${isLayoutDropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M6 9l6 6 6-6" />
                                </svg>
                            </button>

                            {isLayoutDropdownOpen && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 z-50">
                                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar p-1.5">
                                        {layouts.map(layout => (
                                            <button
                                                key={layout.id}
                                                onClick={() => handleLayoutChange(layout.id)}
                                                className={`w-full text-left px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${layout.id === currentLayout?.id
                                                        ? 'bg-[#6366f1]/20 text-[#6366f1]'
                                                        : 'text-[#666] hover:text-white hover:bg-white/[0.05]'
                                                    }`}
                                            >
                                                {layout.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Language Custom Dropdown */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-4 relative">
                        <div className="min-w-0">
                            <p className="text-sm text-white font-bold tracking-tight">{t('settings.language')}</p>
                            <p className="text-xs text-[#666] font-medium leading-relaxed mt-0.5">{t('settings.language_desc')}</p>
                        </div>

                        <div className="relative w-full sm:w-[180px] sm:flex-shrink-0" ref={langDropdownRef}>
                            <button
                                onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                                className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-[#f5f5f5] hover:text-white transition-all bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] hover:border-white/[0.1] rounded-xl px-4 py-3"
                            >
                                <span className="truncate pr-4">{currentLanguage?.label}</span>
                                <svg className={`w-3 h-3 text-[#6366f1] transition-transform duration-300 ${isLangDropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M6 9l6 6 6-6" />
                                </svg>
                            </button>

                            {isLangDropdownOpen && (
                                <div className="absolute bottom-full left-0 w-full mb-2 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 z-50">
                                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar p-1.5">
                                        {languages.map(lang => (
                                            <button
                                                key={lang.id}
                                                onClick={() => handleLanguageChange(lang.id)}
                                                className={`w-full text-left px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${lang.id === currentLanguage?.id
                                                    ? 'bg-[#6366f1]/20 text-[#6366f1]'
                                                    : 'text-[#666] hover:text-white hover:bg-white/[0.05]'
                                                    }`}
                                            >
                                                {lang.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mb-6 break-inside-avoid bg-[#1a1a1a] border border-[#333] rounded-2xl p-5 sm:p-6 lg:p-8 shadow-2xl relative overflow-visible group min-w-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#6366f1] blur-[120px] opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none" />

                <h3 className="text-[10px] font-black text-[#444] uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <span className="w-1 h-1 bg-[#6366f1] rounded-full" />
                    {t('settings.practice')}
                </h3>

                <div className="space-y-1">
                    <NumberSetting
                        label={t('settings.timing_offset')}
                        description={t('settings.timing_offset_desc')}
                        value={settings?.timingOffsetMs ?? 0}
                        min={-300}
                        max={300}
                        step={5}
                        unit="ms"
                        onChange={handleTimingOffsetChange}
                    />
                    <NumberSetting
                        label={t('settings.default_timing_tolerance')}
                        description={t('settings.default_timing_tolerance_desc')}
                        value={settings?.defaultTimingToleranceMs ?? 80}
                        min={10}
                        max={500}
                        step={5}
                        unit="ms"
                        onChange={(event) => updateNumberSetting('defaultTimingToleranceMs', event.target.value)}
                    />
                    <ToggleSetting
                        label={t('settings.enable_metronome')}
                        description={t('settings.enable_metronome_desc')}
                        checked={settings?.enableMetronome ?? false}
                        onChange={(checked) => updateSettings({ enableMetronome: checked })}
                    />
                    <NumberSetting
                        label={t('settings.metronome_interval')}
                        description={t('settings.metronome_interval_desc')}
                        value={settings?.metronomeIntervalMs ?? 500}
                        min={100}
                        max={3000}
                        step={25}
                        unit="ms"
                        disabled={!settings?.enableMetronome}
                        onChange={(event) => updateNumberSetting('metronomeIntervalMs', event.target.value)}
                    />
                </div>
            </div>

            <div className="mb-6 break-inside-avoid bg-[#1a1a1a] border border-[#333] rounded-2xl p-5 sm:p-6 lg:p-8 shadow-2xl relative overflow-visible group min-w-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#6366f1] blur-[120px] opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none" />

                <h3 className="text-[10px] font-black text-[#444] uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <span className="w-1 h-1 bg-[#6366f1] rounded-full" />
                    {t('settings.visualizer')}
                </h3>

                <div className="space-y-1">
                    <ToggleSetting
                        label={t('settings.show_mouse_buttons')}
                        description={t('settings.show_mouse_buttons_desc')}
                        checked={settings?.showMouseButtons ?? true}
                        onChange={(checked) => updateSettings({ showMouseButtons: checked })}
                    />
                    <ColorSetting
                        label={t('settings.key_highlight_color')}
                        description={t('settings.key_highlight_color_desc')}
                        value={settings?.keyHighlightColor ?? '#6366f1'}
                        onChange={(value) => updateSettings({ keyHighlightColor: value })}
                    />
                    <ColorSetting
                        label={t('settings.gantt_bar_color')}
                        description={t('settings.gantt_bar_color_desc')}
                        value={settings?.ganttBarColor ?? '#6366f1'}
                        onChange={(value) => updateSettings({ ganttBarColor: value })}
                    />
                    <ColorSetting
                        label={t('settings.pattern_bar_color')}
                        description={t('settings.pattern_bar_color_desc')}
                        value={settings?.patternBarColor ?? '#4b5563'}
                        onChange={(value) => updateSettings({ patternBarColor: value })}
                    />
                    <NumberSetting
                        label={t('settings.default_zoom')}
                        description={t('settings.default_zoom_desc')}
                        value={settings?.defaultZoomMs ?? 5000}
                        min={500}
                        max={30000}
                        step={500}
                        unit="ms"
                        onChange={(event) => updateNumberSetting('defaultZoomMs', event.target.value)}
                    />
                    <NumberSetting
                        label={t('settings.gantt_row_height')}
                        description={t('settings.gantt_row_height_desc')}
                        value={settings?.ganttRowHeight ?? 28}
                        min={20}
                        max={48}
                        step={1}
                        unit="px"
                        onChange={(event) => updateNumberSetting('ganttRowHeight', event.target.value)}
                    />
                </div>
            </div>

            {/* System / Updates Section */}
            <div className="mb-6 break-inside-avoid bg-[#1a1a1a] border border-[#333] rounded-2xl p-5 sm:p-6 lg:p-8 shadow-2xl relative overflow-visible group min-w-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#6366f1] blur-[120px] opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none" />
                
                <h3 className="text-[10px] font-black text-[#444] uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <span className="w-1 h-1 bg-[#6366f1] rounded-full" />
                    {t('settings.system')}
                </h3>

                <div className="space-y-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 sm:pr-8">
                            <p className="text-sm text-white font-bold tracking-tight">{t('settings.backup_restore')}</p>
                            <p className="text-xs text-[#666] font-medium leading-relaxed mt-0.5">{t('settings.backup_restore_desc')}</p>
                            {backupStatus && <p className="text-[10px] text-[#818cf8] font-black uppercase tracking-widest mt-2">{backupStatus}</p>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            <button
                                onClick={handleExportBackup}
                                className="px-4 py-3 rounded-xl border border-[#333] text-[#a3a3a3] hover:text-white hover:border-[#6366f1] text-[10px] font-black uppercase tracking-widest"
                            >
                                {t('settings.export_backup')}
                            </button>
                            <button
                                onClick={() => backupInputRef.current?.click()}
                                className="px-4 py-3 rounded-xl bg-[#6366f1] text-white hover:bg-[#818cf8] text-[10px] font-black uppercase tracking-widest"
                            >
                                {t('settings.import_backup')}
                            </button>
                            <input ref={backupInputRef} type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-white/[0.03] pt-5">
                        <div className="min-w-0 sm:pr-8">
                            <p className="text-sm text-white font-bold tracking-tight">{t('settings.software_update')}</p>
                            <p className="text-xs text-[#666] font-medium leading-relaxed mt-0.5">{t('settings.software_update_desc')}</p>
                        </div>
                        <UpdateButton />
                    </div>
                </div>
            </div>

            </div>
        </div>
    );
}

function ToggleSetting({
    label,
    description,
    checked,
    onChange,
}: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-4 border-b border-white/[0.03]">
            <div className="min-w-0 sm:pr-8">
                <p className="text-sm text-white font-bold tracking-tight">{label}</p>
                <p className="text-xs text-[#666] font-medium leading-relaxed mt-0.5">{description}</p>
            </div>
            <button
                type="button"
                onClick={() => onChange(!checked)}
                className={`w-11 h-6 rounded-full relative transition-all ${checked ? 'bg-[#6366f1]' : 'bg-[#333]'}`}
            >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg transition-all ${checked ? 'left-6' : 'left-1'}`} />
            </button>
        </div>
    );
}

function NumberSetting({
    label,
    description,
    value,
    min,
    max,
    step,
    unit,
    disabled = false,
    onChange,
}: {
    label: string;
    description: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit: string;
    disabled?: boolean;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
    return (
        <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-4 border-b border-white/[0.03] ${disabled ? 'opacity-40' : ''}`}>
            <div className="min-w-0 sm:pr-8">
                <p className="text-sm text-white font-bold tracking-tight">{label}</p>
                <p className="text-xs text-[#666] font-medium leading-relaxed mt-0.5">{description}</p>
            </div>
            <div className="flex items-center gap-3 sm:flex-shrink-0">
                <input
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    disabled={disabled}
                    onChange={onChange}
                    className="w-24 px-3 py-2 rounded-xl bg-[#222] text-white border border-[#333] focus:outline-none focus:border-[#6366f1] transition-all text-right font-mono disabled:cursor-not-allowed"
                />
                <span className="text-[10px] text-[#666] font-black uppercase tracking-widest">{unit}</span>
            </div>
        </div>
    );
}

function ColorSetting({
    label,
    description,
    value,
    onChange,
}: {
    label: string;
    description: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-4 border-b border-white/[0.03]">
            <div className="min-w-0 sm:pr-8">
                <p className="text-sm text-white font-bold tracking-tight">{label}</p>
                <p className="text-xs text-[#666] font-medium leading-relaxed mt-0.5">{description}</p>
            </div>
            <div className="relative flex flex-wrap items-center gap-3 sm:flex-shrink-0">
                <ColorPickerPopover value={value} onChange={onChange} />
                <input
                    type="text"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    onBlur={(event) => {
                        const normalized = normalizeHexColor(event.target.value);
                        if (normalized) onChange(normalized);
                    }}
                    className="w-24 px-3 py-2 rounded-xl bg-[#222] text-white border border-[#333] focus:outline-none focus:border-[#6366f1] transition-all text-right font-mono text-xs"
                />
            </div>
        </div>
    );
}

function ColorPickerPopover({
    value,
    onChange,
}: {
    value: string;
    onChange: (value: string) => void;
}) {
    const [isOpen, setIsOpen] = React.useState(false);
    const pickerRef = React.useRef<HTMLDivElement>(null);
    const color = normalizeHexColor(value) ?? '#6366f1';
    const hsv = React.useMemo(() => hexToHsv(color), [color]);

    React.useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const updateSaturationValue = (event: React.PointerEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const saturation = clamp((event.clientX - rect.left) / rect.width, 0, 1);
        const brightness = clamp(1 - ((event.clientY - rect.top) / rect.height), 0, 1);
        onChange(hsvToHex({ h: hsv.h, s: saturation, v: brightness }));
    };

    return (
        <div ref={pickerRef} className="relative">
            <button
                type="button"
                aria-label="Open color picker"
                onClick={() => setIsOpen(!isOpen)}
                className="relative h-10 w-10 rounded-full border border-[#333] bg-[#222] p-1 shadow-inner transition-all hover:border-[#6366f1] focus:outline-none focus:border-[#6366f1]"
            >
                <span
                    className="block h-full w-full rounded-full border border-white/20 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25)]"
                    style={{ backgroundColor: color }}
                />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full z-[80] mt-3 w-[260px] rounded-2xl border border-[#333] bg-[#181818] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
                    <div className="mb-3 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full border border-white/10 p-1" style={{ backgroundColor: color }}>
                            <div className="h-full w-full rounded-full border border-black/20" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#666]">HEX</p>
                            <p className="font-mono text-xs font-bold uppercase text-white">{color}</p>
                        </div>
                    </div>

                    <div
                        className="relative h-36 cursor-crosshair overflow-hidden rounded-xl border border-[#333] bg-clip-padding"
                        style={{
                            background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h}, 100%, 50%))`,
                            backgroundClip: 'padding-box',
                        }}
                        onPointerDown={(event) => {
                            event.currentTarget.setPointerCapture(event.pointerId);
                            updateSaturationValue(event);
                        }}
                        onPointerMove={(event) => {
                            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                                updateSaturationValue(event);
                            }
                        }}
                    >
                        <span
                            className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_2px_10px_rgba(0,0,0,0.65)]"
                            style={{
                                left: `${hsv.s * 100}%`,
                                top: `${(1 - hsv.v) * 100}%`,
                                backgroundColor: color,
                            }}
                        />
                    </div>

                    <input
                        type="range"
                        min={0}
                        max={359}
                        value={Math.round(hsv.h)}
                        onChange={(event) => onChange(hsvToHex({ ...hsv, h: Number(event.target.value) }))}
                        className="kf-hue-slider mt-4 w-full"
                        style={{ '--thumb-color': `hsl(${hsv.h}, 100%, 50%)` } as React.CSSProperties}
                    />

                    <div className="mt-4 grid grid-cols-8 gap-2">
                        {PRESET_COLORS.map((preset) => (
                            <button
                                key={preset}
                                type="button"
                                aria-label={`Use ${preset}`}
                                onClick={() => onChange(preset)}
                                className={`h-6 rounded-full border transition-all hover:scale-110 ${
                                    color === preset ? 'border-white shadow-[0_0_0_2px_rgba(99,102,241,0.35)]' : 'border-white/10'
                                }`}
                                style={{ backgroundColor: preset }}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

const PRESET_COLORS = [
    '#6366f1',
    '#818cf8',
    '#22c55e',
    '#14b8a6',
    '#06b6d4',
    '#3b82f6',
    '#f59e0b',
    '#ef4444',
    '#ec4899',
    '#a855f7',
    '#f5f5f5',
    '#4b5563',
] as const;

type HsvColor = {
    h: number;
    s: number;
    v: number;
};

function normalizeHexColor(value: string) {
    const raw = value.trim();
    const hex = raw.startsWith('#') ? raw.slice(1) : raw;

    if (/^[0-9a-f]{3}$/i.test(hex)) {
        return `#${hex.split('').map((char) => `${char}${char}`).join('').toLowerCase()}`;
    }

    if (/^[0-9a-f]{6}$/i.test(hex)) {
        return `#${hex.toLowerCase()}`;
    }

    return null;
}

function hexToRgb(hex: string) {
    const normalized = normalizeHexColor(hex) ?? '#6366f1';
    const value = Number.parseInt(normalized.slice(1), 16);
    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255,
    };
}

function hexToHsv(hex: string): HsvColor {
    const { r, g, b } = hexToRgb(hex);
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    let hue = 0;

    if (delta !== 0) {
        if (max === red) {
            hue = ((green - blue) / delta) % 6;
        } else if (max === green) {
            hue = (blue - red) / delta + 2;
        } else {
            hue = (red - green) / delta + 4;
        }
        hue = Math.round(hue * 60);
        if (hue < 0) hue += 360;
    }

    return {
        h: hue % 360,
        s: max === 0 ? 0 : delta / max,
        v: max,
    };
}

function hsvToHex({ h, s, v }: HsvColor) {
    const hue = ((h % 360) + 360) % 360;
    const saturation = clamp(s, 0, 1);
    const brightness = clamp(v, 0, 1);
    const chroma = brightness * saturation;
    const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = brightness - chroma;
    let red = 0;
    let green = 0;
    let blue = 0;

    if (hue < 60) {
        red = chroma;
        green = x;
    } else if (hue < 120) {
        red = x;
        green = chroma;
    } else if (hue < 180) {
        green = chroma;
        blue = x;
    } else if (hue < 240) {
        green = x;
        blue = chroma;
    } else if (hue < 300) {
        red = x;
        blue = chroma;
    } else {
        red = chroma;
        blue = x;
    }

    return rgbToHex((red + m) * 255, (green + m) * 255, (blue + m) * 255);
}

function rgbToHex(red: number, green: number, blue: number) {
    const toHex = (value: number) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0');
    return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function UpdateButton() {
    const { t } = useTranslation();
    const [status, setStatus] = React.useState<'idle' | 'checking' | 'downloading' | 'up-to-date' | 'error'>('idle');
    const [progress, setProgress] = React.useState(0);

    const handleUpdate = async () => {
        try {
            setStatus('checking');
            const update = await check();
            
            if (update) {
                setStatus('downloading');
                let downloaded = 0;
                let contentLength: number | undefined = 0;
                
                await update.downloadAndInstall((event) => {
                    switch (event.event) {
                        case 'Started':
                            contentLength = event.data.contentLength;
                            break;
                        case 'Progress':
                            downloaded += event.data.chunkLength;
                            if (contentLength) {
                                setProgress(Math.round((downloaded / contentLength) * 100));
                            }
                            break;
                        case 'Finished':
                            break;
                    }
                });
                
                await relaunch();
            } else {
                setStatus('up-to-date');
                setTimeout(() => setStatus('idle'), 3000);
            }
        } catch (error) {
            console.error('Update failed:', error);
            setStatus('error');
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    return (
        <button
            onClick={handleUpdate}
            disabled={status !== 'idle'}
            className={`min-w-[140px] text-[10px] font-black uppercase tracking-widest py-3 px-6 rounded-xl border transition-all duration-300 ${
                status === 'idle' 
                ? 'bg-[#6366f1] text-white border-[#6366f1] hover:bg-[#4f46e5] hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]' 
                : status === 'error'
                ? 'bg-red-500/20 text-red-400 border-red-500/40 cursor-default'
                : 'bg-white/[0.03] text-[#666] border-white/[0.1] cursor-default'
            }`}
        >
            {status === 'idle' && t('settings.update_check')}
            {status === 'checking' && t('settings.update_checking')}
            {status === 'downloading' && t('settings.update_downloading', { progress })}
            {status === 'up-to-date' && t('settings.update_up_to_date')}
            {status === 'error' && t('settings.update_error')}
        </button>
    );
}
