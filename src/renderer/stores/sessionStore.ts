/**
 * sessionStore — Zustand store for managing the current practice session.
 * Creates/ends sessions via IPC and tracks session state.
 */

import { create } from 'zustand';
import type { Session } from '../types';

interface SessionStore {
    currentSession: Session | null;

    startSession: (patternId: string | null) => Promise<Session>;
    endSession: () => Promise<void>;
    reset: () => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
    currentSession: null,

    startSession: async (patternId) => {
        if (!window.electronAPI) {
            const mock = {
                id: 'mock-session-' + Date.now(),
                patternId,
                startTime: Date.now(),
                endTime: null,
                status: 'recording',
                attempts: [],
            } as Session;
            set({ currentSession: mock });
            return mock;
        }
        const session = await window.electronAPI.sessions.create(patternId);
        set({ currentSession: session });
        return session;
    },

    endSession: async () => {
        const { currentSession } = get();
        if (currentSession) {
            if (window.electronAPI) {
                await window.electronAPI.sessions.end(currentSession.id);
            }
            set({ currentSession: { ...currentSession, status: 'completed', endTime: Date.now() } });
        }
    },

    reset: () => {
        set({ currentSession: null });
    },
}));
