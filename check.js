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

const patternData = JSON.parse(fs.readFileSync('C:\\Users\\trann\\Downloads\\NohBoard vjp\\Hutao_combo.json'));
const attemptData = JSON.parse(fs.readFileSync('C:\\Users\\trann\\Downloads\\NohBoard vjp\\test_combo.json'));

const attempt = {
    id: "a1",
    sessionId: "s1",
    patternId: "p1",
    startTime: 0,
    endTime: attemptData.totalDuration,
    presses: attemptData.events.map(e => ({
        id: e.id,
        key: e.key,
        keyCode: 0,
        startTime: e.startTime,
        endTime: e.endTime,
        duration: e.duration,
        sessionId: "s1"
    })),
    result: null
};

const results = buildMatchResults(patternData, attempt);

let out = "";
results.forEach(r => {
    if (r.status === 'extra') {
        out += `- EXTRA Event: ${r.pressId}\n`;
    } else {
        const p = patternData.events.find(x => x.id === r.patternEventId);
        out += `- ${p?.displayLabel} (${r.patternEventId.slice(-4)}): ${r.status.toUpperCase()} | Timing: ${r.timingDeltaMs}ms | Dur: ${r.durationDeltaMs}ms\n`;
    }
});

fs.writeFileSync('C:\\Users\\trann\\Downloads\\NohBoard vjp\\keyflow\\check_out.txt', out);
