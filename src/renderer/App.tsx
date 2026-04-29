/**
 * App.tsx — Main Router and Layout
 * Detects if running in a pop-out window (URL hash = /popout/<section>)
 * and renders the lightweight PopoutPage instead of the full shell.
 */

import React, { useState, useEffect } from 'react';
import { PracticePage } from './pages/PracticePage';
import { LibraryPage } from './pages/LibraryPage';
import { SettingsPage } from './pages/SettingsPage';
import { PopoutPage } from './pages/PopoutPage';
import { Sidebar } from './components/ui/Sidebar';
import type { PopoutSection } from './types';

type Page = 'practice' | 'library' | 'settings';

/** Detect pop-out section from URL hash, e.g. #/popout/keyboard → 'keyboard' */
function getPopoutSection(): PopoutSection | null {
    const hash = window.location.hash; // e.g. "#/popout/keyboard"
    const match = hash.match(/^#\/popout\/(keyboard|chart|score)$/);
    return match ? (match[1] as PopoutSection) : null;
}

export function App() {
    const [currentPage, setCurrentPage] = useState<Page>('practice');
    const [popoutSection, setPopoutSection] = useState<PopoutSection | null>(() => getPopoutSection());

    // Re-check hash on navigation (in case Vite HMR reloads)
    useEffect(() => {
        const onHashChange = () => setPopoutSection(getPopoutSection());
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);

    // Listen for main process telling us this popout was closed externally
    useEffect(() => {
        if (!popoutSection) return;
        // Tauri path: listen for close-requested on this webview window
        let unlistenTauri: (() => void) | undefined;
        import('@tauri-apps/api/event').then(({ listen }) => {
            listen('tauri://close-requested', () => {
                // Popout is being closed
            }).then((fn) => { unlistenTauri = fn; });
        });
        return () => {
            unlistenTauri?.();
        };
    }, [popoutSection]);

    // ── Pop-out window: render only the specified section ──
    if (popoutSection) {
        // Mark <html> immediately so CSS can apply transparent background before first paint
        document.documentElement.setAttribute('data-popout', 'true');
        
        return (
            <div className="w-screen h-screen overflow-hidden bg-transparent">
                <PopoutPage section={popoutSection} />
            </div>
        );
    }

    // Main window: ensure no popout attribute
    if (document.documentElement.hasAttribute('data-popout')) {
        document.documentElement.removeAttribute('data-popout');
    }

    // ── Main window: full shell ──
    return (
        <div className="flex h-screen w-full overflow-hidden text-[#f5f5f5] bg-[#0f0f0f]">
            <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

            <main className="flex-1 min-w-0 overflow-hidden relative bg-[#0f0f0f]">
                {/* Subtle background glow */}
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#6366f1]/5 blur-[120px] pointer-events-none" />

                {/* Router Views */}
                <div className="w-full h-full relative z-10">
                    {currentPage === 'practice' && <PracticePage />}
                    {currentPage === 'library' && <LibraryPage />}
                    {currentPage === 'settings' && <SettingsPage />}
                </div>
            </main>
        </div>
    );
}
