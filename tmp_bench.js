// Vanilla node script to just calculate the numbers and print them clearly
function distance(a, b) {
    if (a.key !== b.key) return 100000;
    let timingWeight = 0.7;
    let timingDiff = b.normalizedStartTime - a.normalizedStartTime;
    if (timingDiff < 0) timingDiff = Math.abs(timingDiff) * 3.0;
    else timingDiff = Math.abs(timingDiff);
    return timingDiff * timingWeight + Math.abs(a.normalizedDuration - b.normalizedDuration) * (1 - timingWeight);
}

function computeDTW(pattern, input) {
    const n = pattern.length; const m = input.length;
    if (n === 0 || m === 0) return { distance: Infinity, path: [] };
    const dtw = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(Infinity));
    dtw[0][0] = 0; const GAP_COST = 800;
    for (let i = 1; i <= n; i++) dtw[i][0] = i * GAP_COST;
    for (let j = 1; j <= m; j++) dtw[0][j] = j * GAP_COST;
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            dtw[i][j] = Math.min(dtw[i - 1][j] + GAP_COST, dtw[i][j - 1] + GAP_COST, dtw[i - 1][j - 1] + distance(pattern[i - 1], input[j - 1]));
        }
    }
    const path = []; let i = n; let j = m;
    if (dtw[n][m] === Infinity) return { distance: Infinity, path: [] };
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0) {
            const diag = dtw[i - 1][j - 1] + distance(pattern[i - 1], input[j - 1]);
            const up = dtw[i - 1][j] + GAP_COST;
            const left = dtw[i][j - 1] + GAP_COST;
            const minVal = Math.min(diag, up, left);
            if (minVal === diag) { path.unshift([i - 1, j - 1]); i--; j--; }
            else if (minVal === up) i--;
            else j--;
        } else if (i > 0) i--; else j--;
    }
    return { path };
}

function buildMatchResultsOld(pattern, attempt, dtwPath) {
    const results = [];
    const usedInputIndices = new Set();
    const pathMap = new Map();
    for (const [pIdx, iIdx] of dtwPath) {
        if (!pathMap.has(pIdx)) pathMap.set(pIdx, []);
        pathMap.get(pIdx).push(iIdx);
    }
    const confirmedByDTW = new Set();
    pattern.events.forEach((pe, pi) => {
        const candidates = pathMap.get(pi) || [];
        let bestInputIdx = undefined; let bestDelta = Infinity;
        for (const iIdx of candidates) {
            if (usedInputIndices.has(iIdx)) continue;
            const press = attempt.presses[iIdx];
            if (!press || press.key !== pe.key) continue;
            const delta = Math.abs(press.startTime - pe.startTime);
            if (delta < bestDelta) { bestDelta = delta; bestInputIdx = iIdx; }
        }
        if (bestInputIdx !== undefined) {
            usedInputIndices.add(bestInputIdx); confirmedByDTW.add(pi); pe.__matchedIdx = bestInputIdx;
        }
    });
    pattern.events.forEach((pe, pi) => {
        if (confirmedByDTW.has(pi)) return;
        let bestInputIdx = undefined; let bestDelta = Infinity;
        attempt.presses.forEach((press, iIdx) => {
            if (usedInputIndices.has(iIdx)) return;
            if (press.key !== pe.key) return;
            const delta = Math.abs(press.startTime - pe.startTime);
            if (delta < bestDelta) { bestDelta = delta; bestInputIdx = iIdx; }
        });
        if (bestInputIdx !== undefined) { usedInputIndices.add(bestInputIdx); pe.__matchedIdx = bestInputIdx; }
    });
    pattern.events.forEach((pe) => {
        const matchedIdx = pe.__matchedIdx; delete pe.__matchedIdx;
        if (matchedIdx === undefined) { results.push({ status: 'missed', timingDeltaMs: 0 }); return; }
        const press = attempt.presses[matchedIdx];
        const timingDeltaMs = press.startTime - pe.startTime;
        results.push({ status: 'matched', timingDeltaMs });
    });
    return results;
}

function buildMatchResults(pattern, attempt) {
    const results = []; const usedInputIndices = new Set();
    pattern.events.forEach((pe) => {
        let bestInputIdx = undefined; let bestDelta = Infinity;
        attempt.presses.forEach((press, iIdx) => {
            if (usedInputIndices.has(iIdx)) return;
            if (press.key !== pe.key) return;
            const absDelta = Math.abs(press.startTime - pe.startTime);
            const window = Math.max(pe.timingToleranceMs * 3, 300);
            if (absDelta <= window && absDelta < bestDelta) { bestDelta = absDelta; bestInputIdx = iIdx; }
        });
        if (bestInputIdx !== undefined) {
            usedInputIndices.add(bestInputIdx);
            results.push({ status: 'matched', timingDeltaMs: attempt.presses[bestInputIdx].startTime - pe.startTime });
        } else {
            results.push({ status: 'missed', timingDeltaMs: 0 });
        }
    });
    return results;
}

const pattern = {
    events: [
        { id: '1', key: 'A', startTime: 0, duration: 100, timingToleranceMs: 50 },
        { id: '2', key: 'B', startTime: 200, duration: 100, timingToleranceMs: 50 },
        { id: '3', key: 'C', startTime: 400, duration: 100, timingToleranceMs: 50 },
        { id: '4', key: 'D', startTime: 600, duration: 100, timingToleranceMs: 50 }
    ]
};
function rand(m) { return (Math.random() * m * 2) - m; }

let oldC = 0; let newC = 0;
for (let i = 0; i < 1000; i++) {
    let presses = [];
    pattern.events.forEach(pe => {
        if (Math.random() < 0.1) return;
        presses.push({ key: pe.key, startTime: pe.startTime + rand(20), duration: 100 + rand(5) });
        if (Math.random() < 0.1) presses.push({ key: pe.key, startTime: pe.startTime + 250, duration: 50 });
    });
    if (Math.random() < 0.15 && presses.length > 2) {
        const t = presses[1]; presses[1] = presses[0]; presses[0] = t;
    }
    const attempt = { presses };
    const patVec = pattern.events.map(e => ({ key: e.key, normalizedStartTime: e.startTime / 1000, normalizedDuration: e.duration / 1000 }));
    const inVec = attempt.presses.map(p => ({ key: p.key, normalizedStartTime: p.startTime / 1000, normalizedDuration: p.duration / 1000 }));
    const { path } = computeDTW(patVec, inVec);

    let o = buildMatchResultsOld(pattern, attempt, path);
    let n = buildMatchResults(pattern, attempt);

    if (o.every(r => r.status === 'missed' || Math.abs(r.timingDeltaMs) < 100)) oldC++;
    if (n.every(r => r.status === 'missed' || Math.abs(r.timingDeltaMs) < 100)) newC++;
}
console.log(`Old Accuracy: ${(oldC / 1000) * 100}%`);
console.log(`New Accuracy: ${(newC / 1000) * 100}%`);
