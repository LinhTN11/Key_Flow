/**
 * useGantt — Hook that transforms input store data into Gantt-renderable rows.
 */

import { useMemo } from 'react';
import { useInputStore } from '../stores/inputStore';
import { useComparisonStore } from '../stores/comparisonStore';
import { buildGanttRows } from '../lib/patternUtils';
import type { GanttRow } from '../types';

export function useGantt(): GanttRow[] {
    const presses = useInputStore((s) => s.presses);
    const activeKeys = useInputStore((s) => s.activeKeys);
    const activePattern = useComparisonStore((s) => s.activePattern);

    const allPatternKeys = useMemo(() => {
        if (!activePattern) return [];
        return Array.from(new Set(activePattern.events.map(e => e.key)));
    }, [activePattern]);

    return useMemo(
        () => buildGanttRows(presses, activeKeys, allPatternKeys),
        [presses, activeKeys, allPatternKeys]
    );
}
