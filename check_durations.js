const fs = require('fs');

const p = JSON.parse(fs.readFileSync('C:\\Users\\trann\\Downloads\\NohBoard vjp\\Hutao_combo.json'));
const a = JSON.parse(fs.readFileSync('C:\\Users\\trann\\Downloads\\NohBoard vjp\\test_combo.json'));

const attempt = {
    presses: a.events.map(e => ({
        id: e.id, key: e.key, startTime: e.startTime, endTime: e.endTime, duration: e.duration
    }))
};

console.log("PATTERN EVENTS:");
p.events.forEach((pe, i) => {
    console.log(`[${i}] ${pe.key}: start=${pe.startTime}, dur=${pe.duration}`);
});

console.log("\nATTEMPT PRESSES:");
attempt.presses.forEach((press, i) => {
    console.log(`[${i}] ${press.key}: start=${press.startTime}, dur=${press.duration}`);
});

const usedInputIndices = new Set();
p.events.forEach((pe) => {
    let bestInputIdx = undefined; let bestDelta = Infinity;
    attempt.presses.forEach((press, iIdx) => {
        if (usedInputIndices.has(iIdx)) return;
        if (press.key !== pe.key) return;
        const delta = press.startTime - pe.startTime;
        const absDelta = Math.abs(delta);
        if (absDelta <= 300 && absDelta < bestDelta) {
            bestDelta = absDelta;
            bestInputIdx = iIdx;
        }
    });

    if (bestInputIdx !== undefined) {
        usedInputIndices.add(bestInputIdx);
        const press = attempt.presses[bestInputIdx];
        const timingDeltaMs = Math.round(press.startTime - pe.startTime);
        const durationDeltaMs = Math.round((press.duration ?? 0) - pe.duration);
        console.log(`MATCH [${pe.key}]: patternDur=${pe.duration}, pressDur=${press.duration}, diff=${durationDeltaMs}`);
    }
});
