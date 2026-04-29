import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/globals.css';
import './i18n'; // Initialize i18n
import { useSettingsStore } from './stores/settingsStore';
import i18n from './i18n';

function Root() {
    const loadSettings = useSettingsStore(s => s.loadSettings);
    const settings = useSettingsStore(s => s.settings);

    useEffect(() => {
        loadSettings().then(() => {
            const currentSettings = useSettingsStore.getState().settings;
            if (currentSettings?.language) {
                i18n.changeLanguage(currentSettings.language);
                console.log('[Main] Language set to:', currentSettings.language);
            }
        });
    }, [loadSettings]);

    if (!settings) {
        return <div className="h-screen w-screen bg-[#0f0f0f] flex items-center justify-center text-[#666]">Loading...</div>;
    }

    return <App />;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <Root />
);
