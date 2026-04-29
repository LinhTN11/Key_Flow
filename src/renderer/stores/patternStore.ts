/**
 * patternStore — Zustand store for managing patterns from the library.
 * Handles loading, creating, updating, and deleting patterns via IPC.
 */

import { create } from 'zustand';
import type { Pattern } from '../types';
import * as db from '../services/db';

interface PatternStore {
    patterns: Pattern[];
    isLoading: boolean;

    loadAll: () => Promise<void>;
    createPattern: (data: Omit<Pattern, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Pattern>;
    updatePattern: (id: string, data: Partial<Pattern>) => Promise<void>;
    deletePattern: (id: string) => Promise<void>;
}

const isTauri = !!(window as any).__TAURI_INTERNALS__;

export const usePatternStore = create<PatternStore>((set, get) => ({
    patterns: [],
    isLoading: false,

    loadAll: async () => {
        set({ isLoading: true });
        try {
            if (isTauri) {
                const patterns = await db.getAllPatterns();
                set({ patterns });
                return;
            }
            if (!window.electronAPI) {
                console.warn('[PatternStore] electronAPI not found, using empty storage');
                set({ patterns: [] });
                return;
            }
            const patterns = await window.electronAPI.patterns.getAll();
            set({ patterns });
        } catch (err) {
            console.error('[PatternStore] Failed to load patterns:', err);
        } finally {
            set({ isLoading: false });
        }
    },

    createPattern: async (data) => {
        if (isTauri) {
            const pattern = await db.createPattern(data);
            set({ patterns: [pattern, ...get().patterns] });
            return pattern;
        }
        if (!window.electronAPI) {
            const mock = { ...data, id: 'mock-' + Date.now(), createdAt: Date.now(), updatedAt: Date.now() } as Pattern;
            set({ patterns: [mock, ...get().patterns] });
            return mock;
        }
        const pattern = await window.electronAPI.patterns.create(data);
        set({ patterns: [pattern, ...get().patterns] });
        return pattern;
    },

    updatePattern: async (id, data) => {
        if (isTauri) {
            const updated = await db.updatePattern(id, data);
            set({ patterns: get().patterns.map((p) => (p.id === id ? updated : p)) });
            return;
        }
        if (!window.electronAPI) {
            set({ patterns: get().patterns.map((p) => (p.id === id ? { ...p, ...data, updatedAt: Date.now() } : p)) });
            return;
        }
        const updated = await window.electronAPI.patterns.update(id, data);
        set({ patterns: get().patterns.map((p) => (p.id === id ? updated : p)) });
    },

    deletePattern: async (id) => {
        if (isTauri) {
            await db.deletePattern(id);
            set({ patterns: get().patterns.filter((p) => p.id !== id) });
            return;
        }
        if (!window.electronAPI) {
            set({ patterns: get().patterns.filter((p) => p.id !== id) });
            return;
        }
        await window.electronAPI.patterns.delete(id);
        set({ patterns: get().patterns.filter((p) => p.id !== id) });
    },
}));
