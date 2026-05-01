import type { ErrorItem, Pattern } from '../types';

const DRILL_SUFFIX = ' - Drill';
const DRILL_ID_PREFIX = 'drill-';

function getBasePatternName(name: string) {
    return name.endsWith(DRILL_SUFFIX) ? name.slice(0, -DRILL_SUFFIX.length) : name;
}

function getBaseEventId(id: string) {
    return id.startsWith(DRILL_ID_PREFIX) ? id.slice(DRILL_ID_PREFIX.length) : id;
}

export function getDrillableEventIds(errors: ErrorItem[]): string[] {
    return [...new Set(errors
        .map((error) => error.eventId)
        .filter((id): id is string => typeof id === 'string')
        .map(getBaseEventId))];
}

export function createDrillPattern(pattern: Pattern, errors: ErrorItem[], contextEvents = 1): Pattern | null {
    const drillableIds = new Set(getDrillableEventIds(errors));
    if (drillableIds.size === 0) return null;

    const selectedIndices = new Set<number>();
    pattern.events.forEach((event, index) => {
        if (!drillableIds.has(getBaseEventId(event.id))) return;

        const from = Math.max(0, index - contextEvents);
        const to = Math.min(pattern.events.length - 1, index + contextEvents);
        for (let i = from; i <= to; i += 1) {
            selectedIndices.add(i);
        }
    });

    const selectedEvents = [...selectedIndices]
        .sort((a, b) => a - b)
        .map((index) => pattern.events[index]);

    if (selectedEvents.length === 0) return null;

    const offset = selectedEvents[0].startTime;
    const events = selectedEvents.map((event) => ({
        ...event,
        id: `${DRILL_ID_PREFIX}${getBaseEventId(event.id)}`,
        startTime: event.startTime - offset,
        endTime: event.endTime - offset,
    }));

    return {
        ...pattern,
        name: `${getBasePatternName(pattern.name)}${DRILL_SUFFIX}`,
        description: pattern.description,
        tags: [...new Set([...pattern.tags, 'drill'])],
        events,
        totalDuration: Math.max(...events.map((event) => event.endTime), 0),
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}
