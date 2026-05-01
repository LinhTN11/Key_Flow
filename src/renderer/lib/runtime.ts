import type { Attempt, Pattern, Session } from '../types';

export interface LegacyElectronApi {
    patterns?: {
        getAll: () => Promise<Pattern[]>;
        create: (data: Omit<Pattern, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Pattern>;
        update: (id: string, data: Partial<Pattern>) => Promise<Pattern>;
        delete: (id: string) => Promise<void>;
    };
    sessions?: {
        create: (patternId: string | null) => Promise<Session>;
        end: (sessionId: string) => Promise<void>;
    };
    attempts?: {
        create: (data: Attempt) => Promise<Attempt>;
    };
    window?: {
        broadcastState?: (snapshot: unknown) => void;
        onStateSync?: (handler: (snapshot: unknown) => void) => (() => void) | void;
        onPopoutClosed?: (handler: (section: string) => void) => (() => void) | void;
        showPopout?: (section: string) => void;
        hidePopout?: (section: string) => void;
    };
    startListening?: (sessionId: string) => Promise<void>;
    stopListening?: () => Promise<void>;
}

type RuntimeWindow = Window & typeof globalThis & {
    __TAURI_INTERNALS__?: unknown;
    __kfDomCleanup?: () => void;
    electronAPI?: LegacyElectronApi;
};

export function getRuntimeWindow(): RuntimeWindow {
    return window as RuntimeWindow;
}

export function isTauriRuntime(): boolean {
    return Boolean(getRuntimeWindow().__TAURI_INTERNALS__);
}

export function getElectronAPI(): LegacyElectronApi | undefined {
    return getRuntimeWindow().electronAPI;
}
