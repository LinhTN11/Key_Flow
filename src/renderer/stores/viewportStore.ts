/**
 * viewportStore — Manages the Gantt chart visible range and navigation.
 */

import { create } from 'zustand';
import type { GanttViewport } from '../types';

interface ViewportStore {
    viewport: GanttViewport;
    playheadOffset: number; // 0.0 to 1.0
    setViewport: (v: Partial<GanttViewport>) => void;
    setPlayheadOffset: (offset: number) => void;
    seek: (timeMs: number) => void;
    zoom: (zoomFactor: number, anchorMs?: number) => void;
}

const DEFAULT_RANGE_MS = 5000;

export const useViewportStore = create<ViewportStore>((set, get) => ({
    viewport: {
        startMs: 0,
        endMs: DEFAULT_RANGE_MS,
        pixelsPerMs: 0,
    },
    playheadOffset: 0.1,

    setViewport: (v) => set((state) => ({
        viewport: { ...state.viewport, ...v }
    })),

    setPlayheadOffset: (offset) => set({
        playheadOffset: Math.max(0, Math.min(0.9, offset)) // Cap at 90% for visible area
    }),

    seek: (timeMs) => {
        const { viewport, playheadOffset } = get();
        const range = viewport.endMs - viewport.startMs;
        // Position timeMs at current playheadOffset
        set({
            viewport: {
                ...viewport,
                startMs: Math.max(0, timeMs - range * playheadOffset),
                endMs: Math.max(range, timeMs + range * (1 - playheadOffset)),
            }
        });
    },

    zoom: (zoomFactor, anchorMs) => {
        const { viewport } = get();
        const oldRange = viewport.endMs - viewport.startMs;
        const newRange = Math.max(500, oldRange * zoomFactor);

        // If anchor provided, zoom relative to that point
        const anchor = anchorMs ?? viewport.startMs;
        const ratio = (anchor - viewport.startMs) / oldRange;

        set({
            viewport: {
                ...viewport,
                startMs: Math.max(0, anchor - newRange * ratio),
                endMs: anchor + newRange * (1 - ratio),
            }
        });
    }
}));
