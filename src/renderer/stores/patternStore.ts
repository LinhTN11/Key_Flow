/**
 * patternStore — Zustand store for managing patterns from the library.
 * Handles loading, creating, updating, and deleting patterns via IPC.
 */

import { create } from 'zustand';
import type { Pattern } from '../types';
import * as db from '../services/db';
import { getElectronAPI, isTauriRuntime } from '../lib/runtime';

interface PatternStore {
    patterns: Pattern[];
    isLoading: boolean;

    loadAll: () => Promise<void>;
    createPattern: (data: Omit<Pattern, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Pattern>;
    updatePattern: (id: string, data: Partial<Pattern>) => Promise<void>;
    deletePattern: (id: string) => Promise<void>;
}

export const usePatternStore = create<PatternStore>((set, get) => ({
    patterns: [],
    isLoading: false,

    loadAll: async () => {
        set({ isLoading: true });
        try {
            if (isTauriRuntime()) {
                const patterns = await db.getAllPatterns();
                set({ patterns });
                return;
            }
            const electronAPI = getElectronAPI();
            if (!electronAPI?.patterns?.getAll) {
                console.warn('[PatternStore] electronAPI not found, using empty storage');
                set({ patterns: [] });
                return;
            }
            const patterns = await electronAPI.patterns.getAll();
            set({ patterns });
        } catch (err) {
            console.error('[PatternStore] Failed to load patterns:', err);
        } finally {
            set({ isLoading: false });
        }
    },

    createPattern: async (data) => {
        if (isTauriRuntime()) {
            const pattern = await db.createPattern(data);
            set({ patterns: [pattern, ...get().patterns] });
            return pattern;
        }
        const electronAPI = getElectronAPI();
        if (!electronAPI?.patterns?.create) {
            const mock = { ...data, id: 'mock-' + Date.now(), createdAt: Date.now(), updatedAt: Date.now() } as Pattern;
            set({ patterns: [mock, ...get().patterns] });
            return mock;
        }
        const pattern = await electronAPI.patterns.create(data);
        set({ patterns: [pattern, ...get().patterns] });
        return pattern;
    },

    updatePattern: async (id, data) => {
        if (isTauriRuntime()) {
            const updated = await db.updatePattern(id, data);
            set({ patterns: get().patterns.map((p) => (p.id === id ? updated : p)) });
            return;
        }
        const electronAPI = getElectronAPI();
        if (!electronAPI?.patterns?.update) {
            set({ patterns: get().patterns.map((p) => (p.id === id ? { ...p, ...data, updatedAt: Date.now() } : p)) });
            return;
        }
        const updated = await electronAPI.patterns.update(id, data);
        set({ patterns: get().patterns.map((p) => (p.id === id ? updated : p)) });
    },

    deletePattern: async (id) => {
        if (isTauriRuntime()) {
            await db.deletePattern(id);
            set({ patterns: get().patterns.filter((p) => p.id !== id) });
            return;
        }
        const electronAPI = getElectronAPI();
        if (!electronAPI?.patterns?.delete) {
            set({ patterns: get().patterns.filter((p) => p.id !== id) });
            return;
        }
        await electronAPI.patterns.delete(id);
        set({ patterns: get().patterns.filter((p) => p.id !== id) });
    },
}));
