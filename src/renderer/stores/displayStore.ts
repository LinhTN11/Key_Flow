import { create } from 'zustand';
import type { PopoutSection } from '../types';
import { isTauriRuntime } from '../lib/runtime';

const STORAGE_KEY = 'keyflow_display_settings';

interface PopoutState {
    keyboard: boolean;
    chart: boolean;
    score: boolean;
}

interface DisplayStore {
    showKeyboard: boolean;
    showChart: boolean;
    showScore: boolean;
    poppedOut: PopoutState;

    toggleKeyboard: () => void;
    toggleChart: () => void;
    toggleScore: () => void;
    popoutSection: (section: PopoutSection) => void;
    closePopout: (section: PopoutSection, closeWindow?: boolean) => void;
}

type DisplayState = Pick<DisplayStore, 'showKeyboard' | 'showChart' | 'showScore' | 'poppedOut'>;

const DEFAULT_DISPLAY_STATE: DisplayState = {
    showKeyboard: true,
    showChart: true,
    showScore: true,
    poppedOut: { keyboard: false, chart: false, score: false },
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function toStoredState(state: DisplayStore | DisplayState): Pick<DisplayState, 'showKeyboard' | 'showChart' | 'showScore'> {
    return {
        showKeyboard: state.showKeyboard,
        showChart: state.showChart,
        showScore: state.showScore,
    };
}

function persistDisplayState(state: DisplayStore | DisplayState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStoredState(state)));
}

// Load initial state from localStorage if available
const loadInitialState = (): DisplayState => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved) as unknown;
            if (!isRecord(parsed)) return DEFAULT_DISPLAY_STATE;
            return {
                showKeyboard: readBoolean(parsed.showKeyboard, true),
                showChart: readBoolean(parsed.showChart, true),
                showScore: readBoolean(parsed.showScore, true),
                poppedOut: { keyboard: false, chart: false, score: false },
            };
        }
    } catch (e) {
        console.error('Failed to load display settings', e);
    }
    return DEFAULT_DISPLAY_STATE;
};

export const useDisplayStore = create<DisplayStore>((set, get) => ({
    ...loadInitialState(),

    toggleKeyboard: () => {
        set((state) => {
            const newState = { showKeyboard: !state.showKeyboard };
            if (!newState.showKeyboard && !state.showChart && !state.showScore) {
                return state;
            }
            persistDisplayState({ ...get(), ...newState });
            return newState;
        });
    },

    toggleChart: () => {
        set((state) => {
            const newState = { showChart: !state.showChart };
            if (!state.showKeyboard && !newState.showChart && !state.showScore) {
                return state;
            }
            persistDisplayState({ ...get(), ...newState });
            return newState;
        });
    },

    toggleScore: () => {
        set((state) => {
            const newState = { showScore: !state.showScore };
            if (!state.showKeyboard && !state.showChart && !newState.showScore) {
                return state;
            }
            persistDisplayState({ ...get(), ...newState });
            return newState;
        });
    },

    popoutSection: (section: PopoutSection) => {
        const state = get();
        // Call Rust command to open popup window
        if (isTauriRuntime()) {
            import('@tauri-apps/api/core').then(({ invoke }) => {
                void invoke('popout_open', { section });
            });
        }
        if (!state.poppedOut[section]) {
            set((s) => ({
                poppedOut: { ...s.poppedOut, [section]: true },
            }));
        }
    },

    closePopout: (section: PopoutSection, closeWindow = true) => {
        if (closeWindow && isTauriRuntime()) {
            import('@tauri-apps/api/core').then(({ invoke }) => {
                void invoke('popout_close', { section });
            });
        }
        set((s) => ({
            poppedOut: { ...s.poppedOut, [section]: false },
        }));
    },
}));
