// Beta 2 engine, part 6b: the best order for a day's stops between where the day starts and where it must end.
// Exact for up to 8 stops, otherwise nearest-neighbour then 2-opt, always with a fixed tie-break by id, so the same
// stops give the same order whatever order they arrived in (lesson 1). cost(a, b) is the stable travel estimate.
// An open path that ends at the ship or station puts far stops first and leaves the stop nearest the way back last.
(function (E) {
  const pathCost = (seq, from, to, cost) => { let c = 0, p = from; for (const s of seq) { c += cost(p, s); p = s; } if (to) c += cost(p, to); return c; };
  E.pathCost = pathCost;
  const key = seq => seq.map(s => String(s.id)).join("|");
  function exact(stops, from, to, cost) {
    let best = null, bestC = Infinity, bestK = "";
    const used = new Array(stops.length).fill(false), cur = [];
    (function go(c, prev) {
      if (c >= bestC + 1e-9 && cur.length < stops.length) return;
      if (cur.length === stops.length) { const t = c + (to ? cost(prev, to) : 0), k = key(cur); if (t < bestC - 1e-9 || (Math.abs(t - bestC) < 1e-9 && k < bestK)) { bestC = t; best = cur.slice(); bestK = k; } return; }
      for (let i = 0; i < stops.length; i++) if (!used[i]) { used[i] = true; cur.push(stops[i]); go(c + cost(prev, stops[i]), stops[i]); cur.pop(); used[i] = false; }
    })(0, from);
    return best || [];
  }
  function heuristic(stops, from, to, cost) {
    const left = stops.slice().sort(E.byId), seq = []; let p = from;
    while (left.length) { let bi = 0, bc = Infinity; left.forEach((s, i) => { const c = cost(p, s); if (c < bc - 1e-9) { bc = c; bi = i; } }); p = left[bi]; seq.push(p); left.splice(bi, 1); }
    let improved = true, guard = 0;
    while (improved && guard++ < 200) {
      improved = false;
      for (let i = 0; i < seq.length - 1; i++) for (let j = i + 1; j < seq.length; j++) {
        const cand = seq.slice(0, i).concat(seq.slice(i, j + 1).reverse(), seq.slice(j + 1));
        if (pathCost(cand, from, to, cost) < pathCost(seq, from, to, cost) - 1e-9) { seq.splice(0, seq.length, ...cand); improved = true; }
      }
    }
    return seq;
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
    const best = sorted.length <= 8 ? exact(sorted, from, to, cost) : heuristic(sorted, from, to, cost);
    m.set(k, best.map(s => String(s.id)));
    return best;
  };
})(KEngine);
