// Beta 2 engine, part 1b: public transport between two points (metro, light rail, tram, train), from the lines mapped
// on OpenStreetMap (the places files). Every leg where a line serves both ends is offered beside walking and a taxi,
// in every city: a stop within a short walk of each end, on the same line or with one change. Pure: same lines, same
// answer. Buses are left out (too many routes to read reliably); a leg with no line nearby simply has no option.
(function (E) {
  const SPEED = { subway: 30, light_rail: 25, monorail: 25, tram: 15, train: 40 };      // km/h between stops, stops included
  const WAIT = { subway: 5, light_rail: 6, monorail: 6, tram: 7, train: 10 };          // half the usual gap between trains
  const LABEL = { subway: "Metro", light_rail: "Light rail", monorail: "Monorail", tram: "Tram", train: "Train" };
  const ACCESS_KM = 0.8, CHANGE_MIN = 6, SAME_STOP_KM = 0.25;
  const norm = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  E.transitLabel = l => (LABEL[l.mode] || "Train") + (l.ref ? " " + (/^\d+$/.test(l.ref) ? "Line " + l.ref : E.latin(l.ref)) : "");
  // Minutes riding a line from stop index i to j (along the line's own stop order).
  // Worked out once per line and kept with it: the distance along the line to each stop, and the stops where it meets
  // each other line (same name, or within a short walk). A long train or a city of many lines stays quick to plan.
  const cumOf = new WeakMap(), meetOf = new WeakMap();
  const cum = l => { let c = cumOf.get(l); if (c) return c; c = [0]; for (let k = 1; k < l.stops.length; k++) c.push(c[k - 1] + E.hav(l.stops[k - 1], l.stops[k])); cumOf.set(l, c); return c; };
  const meets = (L, M) => { let m = meetOf.get(L); if (!m) { m = new Map(); meetOf.set(L, m); } let r = m.get(M); if (r) return r; r = [];
    const nm = M.stops.map(y => norm(y.name));
    for (let i = 0; i < L.stops.length; i++) { const x = L.stops[i], nx = norm(x.name); for (let j = 0; j < M.stops.length; j++) if (nx === nm[j] || E.hav(x, M.stops[j]) <= SAME_STOP_KM) r.push([i, j]); }
    m.set(M, r); return r; };
  // Every stop of a set of lines filed by map square (about a kilometre), so the stops near a point are found
  // without measuring to every stop in the city.
  const CELL = 0.01, gridMemo = new WeakMap();
  const gridOf = lines => { let g = gridMemo.get(lines); if (g) return g; g = new Map();
    lines.forEach((l, li) => l.stops.forEach((st, si) => { if (!isFinite(st.lat)) return; const k = Math.floor(st.lat / CELL) + "," + Math.floor(st.lng / CELL); let c = g.get(k); if (!c) g.set(k, c = []); c.push([li, si]); }));
    gridMemo.set(lines, g); return g; };
  const ride = (l, i, j) => { const c = cum(l), [a, b] = i < j ? [i, j] : [j, i];
    return Math.round((c[b] - c[a]) / (SPEED[l.mode] || 25) * 60 + 0.5 * (b - a)); };
  // lines: [{ mode, ref, name, stops: [{ name, lat, lng }] in order }]. walkMin(km) -> minutes on foot.
  // far: a day trip out of town ({ km, taxiMin(km) }): the far end may be a taxi ride from its station (Ancient Corinth
  // from Corinth station), trains run about hourly (half an hour's wait counted), and the option says so.
  E.transitOption = (a, b, lines, walkMin, far) => {
    if (!lines || !lines.length || !a || !b || !isFinite(a.lat) || !isFinite(b.lat)) return null;
    const near = (p, km) => { const g = gridOf(lines), out = [], la = Math.floor(p.lat / CELL), lo = Math.floor(p.lng / CELL);
      const sLa = Math.ceil(km / (111 * CELL)) , sLo = Math.ceil(km / (111 * CELL * Math.max(0.2, Math.cos(p.lat * Math.PI / 180))));
      for (let x = la - sLa; x <= la + sLa; x++) for (let y = lo - sLo; y <= lo + sLo; y++) { const c = g.get(x + "," + y); if (!c) continue;
        for (const [li, si] of c) { const d = E.hav(p, lines[li].stops[si]); if (d <= km) out.push({ li, si, d }); } }
      return out.sort((a, b) => a.li - b.li || a.si - b.si); };
    const reach = far ? far.km : ACCESS_KM, endMin = d => d <= ACCESS_KM ? walkMin(d) : far.taxiMin(d), endWord = (d, nm) => d <= ACCESS_KM ? "" : ", then a taxi " + far.taxiMin(d) + " min";
    const from = near(a, reach).filter(x => !far || x.d <= reach), to = near(b, reach); if (!from.length || !to.length) return null;
    const wait = m => far ? 30 : (WAIT[m] || 6);
    let best = null;
    // The label is written only for a ride that beats (or ties) the best so far: most candidates never need one.
    const consider = (min, mode, legs, how) => { if (best && min > best.min) return; const h = how(); if (!best || min < best.min || h < best.how) best = { min, mode, how: h, legs }; };
    for (const f of from) for (const t of to) {
      const L = lines[f.li], M = lines[t.li];
      if (f.li === t.li) {
        if (f.si === t.si) continue;
        const min = endMin(f.d) + wait(L.mode) + ride(L, f.si, t.si) + endMin(t.d);
        consider(min, L.mode, 1, () => (f.d > ACCESS_KM ? "Taxi " + endMin(f.d) + " min to " + E.latin(L.stops[f.si].name) + ", then " : "") + E.transitLabel(L) + ", " + E.latin(L.stops[f.si].name) + " to " + E.latin(M.stops[t.si].name) + endWord(t.d));
        continue;
      }
      // One change: a stop of the first line that is (or stands beside) a stop of the second.
      for (const [i, j] of meets(L, M)) {
        const x = L.stops[i];
        if (i === f.si || j === t.si) continue;
        const min = endMin(f.d) + wait(L.mode) + ride(L, f.si, i) + CHANGE_MIN + wait(M.mode) + ride(M, j, t.si) + endMin(t.d);
        consider(min, L.mode, 2, () => (f.d > ACCESS_KM ? "Taxi " + endMin(f.d) + " min to " + E.latin(L.stops[f.si].name) + ", then " : "") + E.transitLabel(L) + " to " + E.latin(x.name) + ", then " + E.transitLabel(M) + " to " + E.latin(M.stops[t.si].name) + endWord(t.d));
      }
    }
    return best;
  };
})(KEngine);
