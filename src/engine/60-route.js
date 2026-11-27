// Beta 2 engine, part 6b: the best order for a day's stops between where the day starts and where it must end.
// Exact for up to 10 stops, otherwise nearest-neighbour then 2-opt, always with a fixed tie-break by id, so the same
// stops give the same order whatever order they arrived in (lesson 1). cost(a, b) is the stable travel estimate.
// An open path that ends at the ship or station puts far stops first and leaves the stop nearest the way back last.
(function (E) {
  const pathCost = (seq, from, to, cost) => { let c = 0, p = from; for (const s of seq) { c += cost(p, s); p = s; } if (to) c += cost(p, to); return c; };
  E.pathCost = pathCost;
  // Exact best order by dynamic programming over subsets (fast up to 10 stops). Stops arrive sorted by id and every
  // tie keeps the first found, so the same stops always give the same order.
  function exact(stops, from, to, cost) {
    const n = stops.length, full = (1 << n) - 1, d = stops.map(a => stops.map(b => cost(a, b)));
    const best = new Float64Array((1 << n) * n).fill(Infinity), prev = new Int8Array((1 << n) * n).fill(-1);
    for (let i = 0; i < n; i++) best[(1 << i) * n + i] = cost(from, stops[i]);
    for (let m = 1; m <= full; m++) for (let i = 0; i < n; i++) {
      const c = best[m * n + i]; if (!(m & (1 << i)) || c === Infinity) continue;
      for (let j = 0; j < n; j++) { if (m & (1 << j)) continue; const mm = m | (1 << j), v = c + d[i][j];
        if (v < best[mm * n + j] - 1e-9) { best[mm * n + j] = v; prev[mm * n + j] = i; } }
    }
    let last = -1, bc = Infinity;
    for (let i = 0; i < n; i++) { const v = best[full * n + i] + (to ? cost(stops[i], to) : 0); if (v < bc - 1e-9) { bc = v; last = i; } }
    const seq = []; let m = full;
    while (last >= 0) { seq.push(stops[last]); const p = prev[m * n + last]; m &= ~(1 << last); last = p; }
    return seq.reverse();
  }
  // Every ride cost is worked out once into a table, then the same nearest-neighbour and 2-opt steps run on the table
  // (Nov 22 odd-trips run: a day with every one of 39 sights ticked took a minute, each 2-opt try re-measuring every ride).
  function heuristic(stops, from, to, cost) {
    const n = stops.length, F = n, T = n + 1, pt = k => k === F ? from : k === T ? to : stops[k];
    const C = []; for (let a = 0; a <= T; a++) { C.push(new Float64Array(T + 1)); for (let b = 0; b < n; b++) if (a !== b && a !== T) C[a][b] = cost(pt(a), stops[b]); if (to && a < n) C[a][T] = cost(stops[a], to); }
    const left = stops.map((s, i) => i).sort((a, b) => E.byId(stops[a], stops[b])), seq = []; let p = F;
    while (left.length) { let bi = 0, bc = Infinity; left.forEach((s, i) => { const c = C[p][s]; if (c < bc - 1e-9) { bc = c; bi = i; } }); p = left[bi]; seq.push(p); left.splice(bi, 1); }
    // Each try is costed in place, adding the same rides in the same order as the whole path would (the same sums to the
    // last digit): the part before the reversed run is the current path's own running total, and once the total is past the
    // current path's cost (rides never cost less than nothing) the try can't win (planning time, Nov 23).
    let neg = false; for (const row of C) for (const v of row) if (v < 0) neg = true;
    const pre = new Float64Array(n + 1); let cur = 0;
    const sums = () => { let c = 0, q = F; pre[0] = 0; for (let k = 0; k < n; k++) { c += C[q][seq[k]]; q = seq[k]; pre[k + 1] = c; } cur = to ? c + C[q][T] : c; };
    const tryCost = (i, j, lim) => { let c = pre[i], q = i ? seq[i - 1] : F;
      for (let k = i; k < n; k++) { const s = k <= j ? seq[i + j - k] : seq[k]; c += C[q][s]; q = s; if (!neg && c >= lim) return Infinity; }
      if (to) c += C[q][T]; return c; };
    let improved = true, guard = 0; sums();
    while (improved && guard++ < 200) {
      improved = false;
      for (let i = 0; i < seq.length - 1; i++) for (let j = i + 1; j < seq.length; j++) {
        const lim = cur - 1e-9;
        if (tryCost(i, j, lim) < lim) { const cand = seq.slice(0, i).concat(seq.slice(i, j + 1).reverse(), seq.slice(j + 1)); seq.splice(0, seq.length, ...cand); sums(); improved = true; }
      }
    }
    return seq.map(k => stops[k]);
  }
  // Remembered per cost function: the same stops between the same ends always give the same order, so it is worked
  // out once (a day is re-checked many times while it is fitted and filled).
  const memo = new WeakMap(), at = p => p ? p.lat + "," + p.lng : "-";
  E.bestOrder = (stops, from, to, cost) => {
    if (!stops.length) return [];
    const sorted = stops.slice().sort(E.byId);
    let m = memo.get(cost); if (!m) { m = new Map(); memo.set(cost, m); }
    const k = at(from) + ">" + at(to) + ">" + sorted.map(s => String(s.id) + "@" + at(s)).join("|"), got = m.get(k);
    if (got) { const byId = new Map(sorted.map(s => [String(s.id), s])); return got.map(id => byId.get(id)); }
    const best = sorted.length <= 10 ? exact(sorted, from, to, cost) : heuristic(sorted, from, to, cost);
    m.set(k, best.map(s => String(s.id)));
    return best;
  };
})(KEngine);
