/**
 * settingsStore — Zustand store for managing app settings.
 * Synchronizes with the database in Tauri and localStorage in browser preview.
 */

import { create } from 'zustand';
import type { AppSettings } from '../types';
import * as db from '../services/db';
import { isTauriRuntime } from '../lib/runtime';
import { DEFAULT_SETTINGS, mergeSettings } from '../lib/settings';
import i18n from '../i18n';

const STORAGE_KEY = 'keyflow_app_settings';

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
            const saved = localStorage.getItem(STORAGE_KEY);
            const settings = isTauriRuntime()
                ? await db.getSettings()
                : saved
                    ? mergeSettings(JSON.parse(saved) as unknown)
                    : DEFAULT_SETTINGS;
            set({ settings });

            // Apply language immediately if loaded
            if (settings.language) {
                i18n.changeLanguage(settings.language);
            }
        } catch (err) {
            console.error('[SettingsStore] Failed to load settings:', err);
            set({ settings: DEFAULT_SETTINGS });
        } finally {
            set({ isLoading: false });
        }
    },

    updateSettings: async (data) => {
        // If we are in a popout window, we cannot mutate state locally because the main window
        // will continuously overwrite it with old state via state-sync. Instead, forward the command.
        if (window.location.hash.includes('/popout') && isTauriRuntime()) {
            import('@tauri-apps/api/event').then(({ emit }) => emit('cmd-update-settings', data));
            return;
        }

        const currentSettings = get().settings;
        const newSettings = mergeSettings({ ...currentSettings, ...data });

        try {
            const persistedSettings = isTauriRuntime()
                ? await db.setSettings(data)
                : newSettings;

            if (!isTauriRuntime()) localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedSettings));
            set({ settings: persistedSettings });

            // Sync with other windows (popouts)
            if (isTauriRuntime()) {
                import('@tauri-apps/api/event').then(({ emit }) => {
                    emit('state-sync', { type: 'settings', data: persistedSettings });
                });
            }

            // Handle language change
            if (data.language) {
                i18n.changeLanguage(data.language);
            }
        } catch (err) {
            console.error('[SettingsStore] Failed to update settings:', err);
        }
    },
}));
