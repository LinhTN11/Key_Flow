import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../stores/settingsStore';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export function SettingsPage() {
    const { t } = useTranslation();
    const settings = useSettingsStore(s => s.settings);
    const updateSettings = useSettingsStore(s => s.updateSettings);
    const [isLangDropdownOpen, setIsLangDropdownOpen] = React.useState(false);
    const [isLayoutDropdownOpen, setIsLayoutDropdownOpen] = React.useState(false);
    const langDropdownRef = React.useRef<HTMLDivElement>(null);
    const layoutDropdownRef = React.useRef<HTMLDivElement>(null);

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
        <div className="p-8 h-full overflow-y-auto custom-scrollbar">
            <h2 className="text-2xl font-semibold text-white tracking-tight mb-8" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {t('settings.title')}
            </h2>

            <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-8 max-w-2xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#6366f1] blur-[120px] opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none" />

                <h3 className="text-[10px] font-black text-[#444] uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <span className="w-1 h-1 bg-[#6366f1] rounded-full" />
                    {t('settings.appearance')}
                </h3>

                <div className="space-y-6">
                    <div className="flex items-center justify-between py-4 border-b border-white/[0.03]">
                        <div>
                            <p className="text-sm text-white font-bold tracking-tight">{t('settings.dark_mode')}</p>
                            <p className="text-xs text-[#666] font-medium leading-relaxed mt-0.5">{t('settings.dark_mode_desc')}</p>
                        </div>
                        <div className="w-10 h-5 bg-[#6366f1] rounded-full relative shadow-inner cursor-not-allowed opacity-40">
                            <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-lg"></div>
                        </div>
                    </div>

                    {/* Keyboard Layout Dropdown */}
                    <div className="flex items-center justify-between py-4 border-b border-white/[0.03] relative">
                        <div>
                            <p className="text-sm text-white font-bold tracking-tight">{t('settings.keyboard_layout')}</p>
                            <p className="text-xs text-[#666] font-medium leading-relaxed mt-0.5">{t('settings.keyboard_layout_desc')}</p>
                        </div>
                        <div className="relative min-w-[140px]" ref={layoutDropdownRef}>
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
                    <div className="flex items-center justify-between py-4 relative">
                        <div>
                            <p className="text-sm text-white font-bold tracking-tight">{t('settings.language')}</p>
                            <p className="text-xs text-[#666] font-medium leading-relaxed mt-0.5">{t('settings.language_desc')}</p>
                        </div>

                        <div className="relative min-w-[140px]" ref={langDropdownRef}>
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

            {/* System / Updates Section */}
            <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-8 max-w-2xl shadow-2xl relative overflow-hidden group mt-6">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#6366f1] blur-[120px] opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none" />
                
                <h3 className="text-[10px] font-black text-[#444] uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <span className="w-1 h-1 bg-[#6366f1] rounded-full" />
                    System
                </h3>

                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-white font-bold tracking-tight">Software Update</p>
                        <p className="text-xs text-[#666] font-medium leading-relaxed mt-0.5">Check for the latest features and bug fixes.</p>
                    </div>
                    <UpdateButton />
                </div>
            </div>

            <p className="text-[#444] text-[10px] font-black uppercase tracking-[0.3em] mt-12 text-center max-w-2xl opacity-50">
                {t('settings.footer_note')}
            </p>
        </div>
    );
}

function UpdateButton() {
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
            {status === 'idle' && 'Check for Update'}
            {status === 'checking' && 'Checking...'}
            {status === 'downloading' && `Updating ${progress}%`}
            {status === 'up-to-date' && 'Up to Date'}
            {status === 'error' && 'Update Error'}
        </button>
    );
}
