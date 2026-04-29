import { create } from 'zustand';
import type { PopoutSection } from '../types';



interface PopoutState {
    keyboard: boolean;
    chart: boolean;
    score: boolean;
}

interface DisplayStore {
    showKeyboard: boolean;
    showChart: boolean;
    showScore: boolean;
    /** @deprecated use poppedOut instead */
    isOverlayMode: boolean;
    poppedOut: PopoutState;

    toggleKeyboard: () => void;
    toggleChart: () => void;
    toggleScore: () => void;
    /** @deprecated */
    toggleOverlayMode: () => void;
    popoutSection: (section: PopoutSection) => void;
    closePopout: (section: PopoutSection) => void;
}

// Load initial state from localStorage if available
const loadInitialState = () => {
    try {
        const saved = localStorage.getItem('keyflow_display_settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            return {
                showKeyboard: parsed.showKeyboard ?? true,
                showChart: parsed.showChart ?? true,
                showScore: parsed.showScore ?? true,
                isOverlayMode: false,
                poppedOut: { keyboard: false, chart: false, score: false },
            };
        }
    } catch (e) {
        console.error('Failed to load display settings', e);
    }
    return {
        showKeyboard: true,
        showChart: true,
        showScore: true,
        isOverlayMode: false,
        poppedOut: { keyboard: false, chart: false, score: false },
    };
};

export const useDisplayStore = create<DisplayStore>((set, get) => ({
    ...loadInitialState(),

    toggleKeyboard: () => {
        set((state) => {
            const newState = { showKeyboard: !state.showKeyboard };
            if (!newState.showKeyboard && !state.showChart && !state.showScore) {
                return state;
            }
            localStorage.setItem('keyflow_display_settings', JSON.stringify({ ...get(), ...newState }));
            return newState;
        });
    },

    toggleChart: () => {
        set((state) => {
            const newState = { showChart: !state.showChart };
            if (!state.showKeyboard && !newState.showChart && !state.showScore) {
                return state;
            }
            localStorage.setItem('keyflow_display_settings', JSON.stringify({ ...get(), ...newState }));
            return newState;
        });
    },

    toggleScore: () => {
        set((state) => {
            const newState = { showScore: !state.showScore };
            if (!state.showKeyboard && !state.showChart && !newState.showScore) {
                return state;
            }
            localStorage.setItem('keyflow_display_settings', JSON.stringify({ ...get(), ...newState, isOverlayMode: undefined }));
            return newState;
        });
    },

    /** @deprecated — kept for legacy callers */
    toggleOverlayMode: () => {
        // No-op; use popoutSection instead
    },

    popoutSection: (section: PopoutSection) => {
        const state = get();
        // Call Rust command to open popup window
        import('@tauri-apps/api/core').then(({ invoke }) => {
            invoke('popout_open', { section });
        });
        if (!state.poppedOut[section]) {
            set((s) => ({
                poppedOut: { ...s.poppedOut, [section]: true },
            }));
        }
    },

    closePopout: (section: PopoutSection) => {
        import('@tauri-apps/api/core').then(({ invoke }) => {
            invoke('popout_close', { section });
        });
        set((s) => ({
            poppedOut: { ...s.poppedOut, [section]: false },
        }));
    },
}));
