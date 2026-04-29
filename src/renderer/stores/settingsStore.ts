/**
 * settingsStore — Zustand store for managing app settings.
 * Synchronizes with the database via electronAPI or localStorage (Tauri).
 */

import { create } from 'zustand';
import type { AppSettings } from '../types';

const isTauri = !!(window as any).__TAURI_INTERNALS__;
const STORAGE_KEY = 'keyflow_app_settings';

const DEFAULT_SETTINGS: AppSettings = {
    language: 'vi',
    layoutStyle: 'full',
    theme: 'dark',
    alwaysOnTop: true,
} as any;

interface SettingsStore {
    settings: AppSettings | null;
    isLoading: boolean;

    loadSettings: () => Promise<void>;
    updateSettings: (data: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
    settings: null,
    isLoading: false,

    loadSettings: async () => {
        set({ isLoading: true });
        try {
            if (isTauri) {
                const saved = localStorage.getItem(STORAGE_KEY);
                const settings = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
                set({ settings });
                
                // Apply language immediately if loaded
                if (settings.language) {
                    const i18n = (await import('../i18n')).default;
                    i18n.changeLanguage(settings.language);
                }
            } else if (window.electronAPI) {
                const settings = await window.electronAPI.settings.get();
                set({ settings });
            } else {
                set({ settings: DEFAULT_SETTINGS });
            }
        } catch (err) {
            console.error('[SettingsStore] Failed to load settings:', err);
            set({ settings: DEFAULT_SETTINGS });
        } finally {
            set({ isLoading: false });
        }
    },

    updateSettings: async (data) => {
        const currentSettings = get().settings;
        const newSettings = { ...currentSettings, ...data } as AppSettings;

        try {
            if (isTauri) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
                set({ settings: newSettings });

                // Sync with other windows (popouts)
                import('@tauri-apps/api/event').then(({ emit }) => {
                    emit('state-sync', { type: 'settings', data: newSettings });
                });
            } else if (window.electronAPI) {
                const updated = await window.electronAPI.settings.set(data);
                set({ settings: updated });
            }

            // Handle language change
            if (data.language) {
                const i18n = (await import('../i18n')).default;
                i18n.changeLanguage(data.language);
            }
        } catch (err) {
            console.error('[SettingsStore] Failed to update settings:', err);
        }
    },
}));
