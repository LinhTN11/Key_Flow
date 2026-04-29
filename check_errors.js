const fs = require('fs');

function buildMatchResults(pattern, attempt) {
    const results = []; const usedInputIndices = new Set();
    const pOffset = pattern.events.length > 0 ? pattern.events[0].startTime : 0;
    const aOffset = attempt.presses.length > 0 ? attempt.presses[0].startTime : 0;

    pattern.events.forEach((pe) => {
        let bestInputIdx = undefined; let bestDelta = Infinity;
        const nPatternTime = pe.startTime - pOffset;

        attempt.presses.forEach((press, iIdx) => {
            if (usedInputIndices.has(iIdx)) return;
            if (press.key !== pe.key) return;

            const nPressTime = press.startTime - aOffset;
            const delta = nPressTime - nPatternTime;
            const absDelta = Math.abs(delta);
            const window = Math.max(pe.timingToleranceMs * 3, 300);

            if (absDelta <= window && absDelta < bestDelta) {
                bestDelta = absDelta;
                bestInputIdx = iIdx;
            }
        });

        if (bestInputIdx !== undefined) {
            usedInputIndices.add(bestInputIdx);
            const press = attempt.presses[bestInputIdx];
            const nPressTime = press.startTime - aOffset;
            const timingDeltaMs = Math.round(nPressTime - nPatternTime);
            const durationDeltaMs = Math.round((press.duration ?? 0) - pe.duration);
            const status = Math.abs(timingDeltaMs) <= pe.timingToleranceMs ? 'matched' : timingDeltaMs < 0 ? 'early' : 'late';
            results.push({ patternEventId: pe.id, pressId: press.id, status, timingDeltaMs, durationDeltaMs });
        } else {
            results.push({ patternEventId: pe.id, pressId: null, status: 'missed', timingDeltaMs: 0, durationDeltaMs: 0 });
        }
    });

    attempt.presses.forEach((press, iIdx) => {
        if (!usedInputIndices.has(iIdx)) {
            results.push({ pressId: press.id, status: 'extra' });
        }
    });
    return results;
}

function analyzeErrors(pattern, attempt, eventResults) {
    const errors = [];
    let lastHitIdx = -1;
    eventResults.forEach((r, i) => { if (r.status !== 'missed' && r.status !== 'extra') lastHitIdx = i; });

    // Filter only pattern events so we don't count 'extra' as missing
    const patternResults = eventResults.filter(r => r.patternEventId);

    const trailingMissed = patternResults.slice(lastHitIdx + 1).filter(r => r.status === 'missed');
    const trailingMissedIds = new Set(trailingMissed.map(r => r.patternEventId));

    const patternDuration = pattern.events[pattern.events.length - 1].startTime - pattern.events[0].startTime;
    const sortedPresses = [...attempt.presses].sort((a, b) => a.startTime - b.startTime);
    const inputDuration = (sortedPresses[sortedPresses.length - 1].endTime ?? sortedPresses[sortedPresses.length - 1].startTime) - sortedPresses[0].startTime;

    const stoppedEarly = trailingMissed.length >= 2 && patternDuration > 0 && inputDuration < patternDuration * 0.75;
    if (stoppedEarly) {
        errors.push({ type: 'missed_key', message: 'Combo chưa hoàn thành' });
    }

    for (const result of eventResults) {
        if (result.status === 'extra') continue; // Extra handled later
        if (stoppedEarly && trailingMissedIds.has(result.patternEventId)) continue;
        const pe = pattern.events.find(e => e.id === result.patternEventId);

        if (result.status === 'early') errors.push({ type: 'timing_early', key: pe.key });
        else if (result.status === 'late') errors.push({ type: 'timing_late', key: pe.key });
        else if (result.status === 'missed') errors.push({ type: 'missed_key', key: pe.key });
    }

    const matchedPressIds = new Set(eventResults.map(r => r.pressId).filter(Boolean));
    for (const press of attempt.presses) {
        if (!matchedPressIds.has(press.id)) {
            errors.push({ type: 'extra_key', key: press.key });
        }
    }
    return errors;
}

const p = JSON.parse(fs.readFileSync('C:\\Users\\trann\\Downloads\\NohBoard vjp\\Hutao_combo.json'));
const a = JSON.parse(fs.readFileSync('C:\\Users\\trann\\Downloads\\NohBoard vjp\\test_combo.json'));

const attempt = {
    id: "a1", sessionId: "s1", patternId: "p1", startTime: 0,
    endTime: a.totalDuration,
    presses: a.events.map(e => ({
        id: e.id, key: e.key, startTime: e.startTime, endTime: e.endTime, duration: e.duration
    })),
};

const results = buildMatchResults(p, attempt);
const errors = analyzeErrors(p, attempt, results);
console.log(errors);
