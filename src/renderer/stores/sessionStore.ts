/**
 * sessionStore — Zustand store for managing the current practice session.
 * Creates/ends sessions via IPC and tracks session state.
 */

import { create } from 'zustand';
import type { Attempt, Session } from '../types';
import * as db from '../services/db';
import { getElectronAPI, isTauriRuntime } from '../lib/runtime';

interface SessionStore {
    currentSession: Session | null;

    startSession: (patternId: string | null) => Promise<Session>;
    endSession: () => Promise<void>;
    saveAttempt: (attempt: Attempt) => Promise<Attempt | null>;
    reset: () => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
    currentSession: null,

    startSession: async (patternId) => {
        if (isTauriRuntime()) {
            const session = await db.createSession(patternId);
            set({ currentSession: session });
            return session;
        }

        const electronAPI = getElectronAPI();
        if (electronAPI?.sessions?.create) {
            const session = await electronAPI.sessions.create(patternId);
            set({ currentSession: session });
            return session;
        }

        const mock = {
            id: 'mock-session-' + Date.now(),
            patternId,
            startTime: Date.now(),
            endTime: null,
            status: 'recording',
            attempts: [],
        } satisfies Session;
        set({ currentSession: mock });
        return mock;
    },

    endSession: async () => {
        const { currentSession } = get();
        if (currentSession) {
            if (isTauriRuntime()) {
                const ended = await db.endSession(currentSession.id);
                set({ currentSession: ended ?? { ...currentSession, status: 'completed', endTime: Date.now() } });
                return;
            }

            const electronAPI = getElectronAPI();
            if (electronAPI?.sessions?.end) await electronAPI.sessions.end(currentSession.id);
            set({ currentSession: { ...currentSession, status: 'completed', endTime: Date.now() } });
        }
    },

    saveAttempt: async (attemptData) => {
        const { currentSession } = get();
        let attempt: Attempt | null = null;

        if (isTauriRuntime()) {
            attempt = await db.createAttempt(attemptData);
        } else {
            const electronAPI = getElectronAPI();
            attempt = electronAPI?.attempts?.create
                ? await electronAPI.attempts.create(attemptData)
                : { ...attemptData, id: 'mock-attempt-' + Date.now() };
        }

        if (currentSession && currentSession.id === attempt.sessionId) {
            set({
                currentSession: {
                    ...currentSession,
                    attempts: [...currentSession.attempts, attempt],
                },
            });
        }

        return attempt;
    },

    reset: () => {
        set({ currentSession: null });
    },
}));
