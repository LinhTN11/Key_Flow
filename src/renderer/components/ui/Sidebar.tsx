import React from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { useTranslation } from 'react-i18next';
import { useComparisonStore } from '../../stores/comparisonStore';

type Page = 'practice' | 'library' | 'history' | 'settings';

const KeyboardIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect>
        <line x1="6" y1="9" x2="6" y2="9"></line>
        <line x1="10" y1="9" x2="10" y2="9"></line>
        <line x1="14" y1="9" x2="14" y2="9"></line>
        <line x1="18" y1="9" x2="18" y2="9"></line>
        <line x1="6" y1="13" x2="6" y2="13"></line>
        <line x1="10" y1="13" x2="10" y2="13"></line>
        <line x1="14" y1="13" x2="14" y2="13"></line>
        <line x1="18" y1="13" x2="18" y2="13"></line>
        <line x1="7" y1="17" x2="17" y2="17"></line>
    </svg>
);

const PracticeIcon = () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
);

const LibraryIcon = () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
    </svg>
);

const HistoryIcon = () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="m7 15 4-4 3 3 5-7" />
    </svg>
);

const SettingsIcon = () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
);

export function Sidebar({ currentPage, onNavigate }: {
    currentPage: Page;
    onNavigate: (page: Page) => void;
}) {
    const { t } = useTranslation();
    const [appVersion, setAppVersion] = React.useState('1.0.0');
    const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const activePattern = useComparisonStore((s) => s.activePattern);
    const markedPatterns = useComparisonStore((s) => s.markedPatterns);
    const setPattern = useComparisonStore((s) => s.setPattern);
    const allResults = useComparisonStore((s) => s.allResults);

    const navItems = [
        { id: 'practice', label: t('nav.practice'), icon: <PracticeIcon /> },
        { id: 'library', label: t('nav.library'), icon: <LibraryIcon /> },
        { id: 'history', label: t('nav.history'), icon: <HistoryIcon /> },
        { id: 'settings', label: t('nav.settings'), icon: <SettingsIcon /> },
    ] as const;

    React.useEffect(() => {
        void getVersion()
            .then(setAppVersion)
            .catch(() => undefined);
    }, []);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <aside className="w-64 flex-shrink-0 bg-[#1a1a1a] border-r border-[#333] flex flex-col">
            {/* Logo */}
            <div className="p-6 border-b border-[#333]">
                <h1
                    className="flex items-center gap-4 group cursor-default"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                    <KeyboardIcon className="w-10 h-10 text-[#6366f1] opacity-90 group-hover:scale-110 group-hover:opacity-100 transition-all duration-300" />
                    <div className="flex flex-col -space-y-0.5">
                        <span className="text-2xl font-black italic text-white leading-none uppercase tracking-[-0.05em]">
                            Key<span className="text-[#6366f1]">Flow</span>
                        </span>
                        <span className="text-xs text-[#555] tracking-[0.4em] font-extrabold uppercase pl-0.5">
                            Trainer
                        </span>
                    </div>
                </h1>
            </div>

            {/* Navigation */}
            <nav className="p-3 flex-1 flex flex-col gap-1">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${currentPage === item.id
                            ? 'bg-[#6366f1]/15 text-[#818cf8]'
                            : 'text-[#a3a3a3] hover:bg-[#252525] hover:text-white'
                            }`}
                    >
                        <div className={`transition-colors ${currentPage === item.id ? 'text-[#818cf8]' : 'text-[#666] group-hover:text-white'}`}>
                            {item.icon}
                        </div>
                        {item.label}
                    </button>
                ))}
            </nav>

            {/* Active Pattern Info Card */}
            {activePattern ? (
                <div className="p-4 border-t border-[#333] bg-[#0f0f0f]/50">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-[#666] mb-2">
                        {markedPatterns.length > 1 ? t('sidebar.selecting_pattern') : t('sidebar.selecting')}
                    </p>
                    <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 relative" ref={dropdownRef}>
                        <div className="absolute top-0 right-0 w-16 h-16 bg-[#6366f1] blur-[32px] opacity-10" />

                        {markedPatterns.length > 1 ? (
                            <div className="relative z-10">
                                <button
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="w-full flex items-center justify-between text-sm font-semibold text-[#f5f5f5] hover:text-white transition-all mb-1 group"
                                >
                                    <span className="truncate pr-4">{activePattern.name}</span>
                                    <svg className={`w-3 h-3 text-[#666] group-hover:text-white transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M6 9l6 6 6-6" />
                                    </svg>
                                </button>

                                {isDropdownOpen && (
                                    <div className="absolute bottom-full -left-3 w-[calc(100%+1.5rem)] mb-2 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                                        <div className="max-h-[160px] overflow-y-auto custom-scrollbar">
                                            {markedPatterns.map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => {
                                                        setPattern(p);
                                                        setIsDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2 text-sm font-semibold transition-colors hover:bg-[#6366f1]/20 ${activePattern.id === p.id ? 'text-[#6366f1] bg-[#6366f1]/5' : 'text-[#a3a3a3] hover:text-white'}`}
                                                >
                                                    {p.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm font-semibold text-[#f5f5f5] mb-1 line-clamp-1 relative z-10">{activePattern.name}</p>
                        )}

                        {allResults.length > 0 && (
                            <div className="mt-3 flex items-baseline gap-2 relative z-10">
                                <span className="text-xl font-bold text-[#6366f1]">
                                    {Math.max(...allResults.map(r => r.overallScore))}
                                </span>
                                <span className="text-[10px] text-[#666] uppercase font-semibold">{t('sidebar.best_score')}</span>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="p-4 border-t border-[#333] text-center">
                    <p className="text-xs text-[#666]">{t('sidebar.no_combo_selected')}</p>
                    <p className="text-xs text-[#666]">{t('sidebar.freestyle_practice')}</p>
                </div>
            )}

            <div className="p-4 border-t border-[#333] mt-auto">
                <p className="text-[10px] text-center text-[#444] font-bold uppercase tracking-widest">
                    v{appVersion}
                </p>
            </div>
        </aside>
    );
}
