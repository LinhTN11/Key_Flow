/**
 * KeyFlow — All shared TypeScript type definitions.
 * This is the single source of truth for all data models used across
 * the renderer and main processes.
 */

// ============================================================
// CORE INPUT TYPES
// ============================================================

export type InputEventType = 'keydown' | 'keyup' | 'mousedown' | 'mouseup';

export interface RawInputEvent {
    id: string;
    type: InputEventType;
    key: string;
    keyCode: number;
    timestamp: number;
    sessionId: string;
}

export interface InputPress {
    id: string;
    key: string;
    keyCode: number;
    startTime: number;
    endTime: number | null;
    duration: number | null;
    sessionId: string;
}

// ============================================================
// GANTT TYPES
// ============================================================

export interface GanttRow {
    key: string;
    displayLabel: string;
    presses: GanttBar[];
}

export interface GanttBar {
    pressId: string;
    startTime: number;
    endTime: number;
    duration: number;
    isActive: boolean;
    matchStatus?: 'matched' | 'early' | 'late' | 'missed' | 'extra';
}

export interface GanttViewport {
    startMs: number;
    endMs: number;
    pixelsPerMs: number;
}

// ============================================================
// PATTERN TYPES
// ============================================================

export interface Pattern {
    id: string;
    name: string;
    description: string;
    game: string;
    character: string;
    tags: string[];
    totalDuration: number;
    events: PatternEvent[];
    createdAt: number;
    updatedAt: number;
}

export interface PatternEvent {
    id: string;
    key: string;
    displayLabel: string;
    startTime: number;
    endTime: number;
    duration: number;
    timingToleranceMs: number;
    durationTolerancePct: number;
}

// ============================================================
// SESSION TYPES
// ============================================================

export interface Session {
    id: string;
    patternId: string | null;
    startTime: number;
    endTime: number | null;
    status: 'recording' | 'idle' | 'comparing' | 'completed';
    attempts: Attempt[];
}

export interface Attempt {
    id: string;
    sessionId: string;
    patternId: string;
    startTime: number;
    endTime: number;
    presses: InputPress[];
    result: ComparisonResult | null;
}

// ============================================================
// COMPARISON TYPES
// ============================================================

export interface ComparisonResult {
    attemptId: string;
    patternId: string;
    overallScore: number;
    timingScore: number;
    orderScore: number;
    completionScore: number;
    durationScore: number;
    eventResults: EventMatchResult[];
    errors: ErrorItem[];
    practiceSpeed: number; // Speed used at time of attempt
}

export interface EventMatchResult {
    patternEventId: string;
    pressId: string | null;
    status: 'matched' | 'early' | 'late' | 'missed';
    timingDeltaMs: number;
    durationDeltaMs: number;
}

export interface ErrorItem {
    type: ErrorType;
    severity: 'minor' | 'major' | 'critical';
    key: string;
    message: string;
    suggestion: string;
    params?: Record<string, any>;
    occurrences: number;
    eventId?: string;
}

export type ErrorType =
    | 'timing_early'
    | 'timing_late'
    | 'missed_key'
    | 'extra_key'
    | 'wrong_order'
    | 'duration_too_short'
    | 'duration_too_long';

// ============================================================
// MULTI-ATTEMPT ANALYSIS
// ============================================================

export interface AttemptAnalysis {
    patternId: string;
    attempts: ComparisonResult[];
    averageScore: number;
    trend: 'improving' | 'declining' | 'stable';
    consistentErrors: ErrorType[];
    perKeyStats: KeyStat[];
}

export interface KeyStat {
    key: string;      // ID of the pattern event
    label: string;    // Display label (e.g., "Key E")
    averageTimingDelta: number;
    timingStdDev: number;
    missRate: number;
}

// ============================================================
export interface AppSettings {
    keyboardLayout: 'full' | 'fps' | 'osu';
    showMouseButtons: boolean;
    keyHighlightColor: string;
    defaultZoomMs: number;
    ganttRowHeight: number;
    ganttBarColor: string;
    patternBarColor: string;
    defaultTimingToleranceMs: number;
    autoStartComparison: boolean;
    showRealtimeOverlay: boolean;
    enableMetronome: boolean;
    metronomeIntervalMs: number;
    language: 'en' | 'vi' | 'ja' | 'zh' | 'ko';
}

// ============================================================
// ELECTRON API (exposed via preload)
// ============================================================

export type PopoutSection = 'keyboard' | 'chart' | 'score';

export interface ElectronAPI {
    startListening: (sessionId: string) => Promise<void>;
    stopListening: () => Promise<void>;
    onInputEventsBatch: (cb: (events: RawInputEvent[]) => void) => () => void;
    onKeysSync: (cb: (data: { activeKeys: string[] }) => void) => () => void;
    patterns: {
        create: (data: Omit<Pattern, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Pattern>;
        getAll: () => Promise<Pattern[]>;
        getById: (id: string) => Promise<Pattern | null>;
        update: (id: string, data: Partial<Pattern>) => Promise<Pattern>;
        delete: (id: string) => Promise<void>;
    };
    sessions: {
        create: (patternId: string | null) => Promise<Session>;
        end: (id: string) => Promise<void>;
    };
    attempts: {
        save: (data: Omit<Attempt, 'id'>) => Promise<Attempt>;
        getByPattern: (patternId: string) => Promise<Attempt[]>;
    };
    settings: {
        get: () => Promise<AppSettings>;
        set: (data: Partial<AppSettings>) => Promise<AppSettings>;
    };
    window: {
        setAlwaysOnTop: (flag: boolean) => Promise<void>;
        getAlwaysOnTop: () => Promise<boolean>;
        // Legacy (kept for type compat)
        setOverlayMode: (flag: boolean) => Promise<void>;
        getOverlayMode: () => Promise<boolean>;
        // Pop-out window API
        popout: (section: PopoutSection) => Promise<void>;
        closePopout: (section: PopoutSection) => Promise<void>;
        onPopoutClosed: (cb: (section: PopoutSection) => void) => () => void;
        // State sync bridge
        broadcastState: (snapshot: unknown) => void;
        onStateSync: (cb: (snapshot: unknown) => void) => () => void;
        // Per-window always-on-top toggle (used by popups)
        toggleAlwaysOnTop: () => Promise<boolean>;
        getAlwaysOnTopSelf: () => Promise<boolean>;
        // Hide/show popup (opacity-based, window stays alive for OBS)
        hidePopout: (section: string) => Promise<void>;
        showPopout: (section: string) => Promise<void>;
        isPopoutHidden: (section: string) => Promise<boolean>;
        // Content visibility toggle via CSS injection
        onPopoutVisibility: (cb: (visible: boolean) => void) => () => void;
    };
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
