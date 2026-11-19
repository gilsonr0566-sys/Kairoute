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
  // A train whose stops are 4 km apart or more on average is a regional line: about 70 km/h between stops (a 75 km
  // regional ride takes about an hour, not two).
  const speedOf = l => { const c = cum(l), n = l.stops.length; return l.mode === "train" && n > 1 && c[n - 1] / (n - 1) >= 4 ? 70 : (SPEED[l.mode] || 25); };
  const ride = (l, i, j) => { const c = cum(l), [a, b] = i < j ? [i, j] : [j, i];
    return Math.round((c[b] - c[a]) / speedOf(l) * 60 + 0.5 * (b - a)); };
  // lines: [{ mode, ref, name, stops: [{ name, lat, lng }] in order }]. walkMin(km) -> minutes on foot.
  // A line is offered only with a walk at each end (a stop within a short walk): never a taxi stitched to a train (Nov 18:
  // "Taxi 19 min to Athina, then Train A4, then a taxi 30 min, 3 h 28" next to a 95-minute ride). A ride with no stop
  // near either end is the timetable's to answer, or a taxi.
  // The same lines (the places files load once; each plan gathers them into a new list) give the same answer for the
  // same two points, so answers are kept with the set of lines, not with one plan: a tick on the Sights list replans
  // the trip without measuring every metro ride again.
  const lineId = new WeakMap(), setOf = new WeakMap(), sets = new Map(); let nextLine = 1;
  const linesSet = lines => { let k = setOf.get(lines); if (k) return k;
    const key = lines.map(l => { let n = lineId.get(l); if (!n) lineId.set(l, n = nextLine++); return n; }).join(",");
    k = sets.get(key); if (!k) { if (sets.size > 50) sets.clear(); sets.set(key, k = { key, lines, answers: new Map() }); }
    setOf.set(lines, k); return k; };
  E.linesKey = lines => linesSet(lines).key;
  // The kind of ride a line is, as the traveler sees it: metro, tram (light rail too), train or bus.
  E.lineKind = m => /subway|metro/.test(m) ? "metro" : /tram|light_rail|monorail/.test(m) ? "tram" : /bus|coach/.test(m) ? "bus" : /ferry|boat/.test(m) ? "ferry" : "train";
  // { min, mode, kind, how, legs, steps: ["Walk 6 min to Syntagma", "Metro Line 3, Syntagma to Airport, 38 min", "Walk 3 min"] }
  // far: a ride of 20 km or more ({ taxiMin(km) }). Then a train station farther than a walk may be reached by a short
  // taxi at either end, as people really do (Nov 19, Richard: "Is there a train" on an 80 km day trip: the train was
  // mapped, its station 2.5 km from the hotel and 5 km from the ruins). The same limits as the app's
  // timetable lookup: a station within 12% of the ride (10 km at most), and the taxis together a third of the ride at most.
  // Trains out of town run about hourly: half an hour's wait is counted. Every step is said, the taxis too.
  E.transitOption = (a, b, lines, walkMin, far) => {
    if (!lines || !lines.length || !a || !b || !isFinite(a.lat) || !isFinite(b.lat)) return null;
    const set = linesSet(lines), key = walkMin(10) + "|" + (far ? "far" + far.taxiMin(10) : "") + "|" + a.lat + "," + a.lng + "|" + b.lat + "," + b.lng;
    if (set.answers.has(key)) return set.answers.get(key);
    if (set.answers.size > 100000) set.answers.clear();
    const got = findOption(a, b, set.lines, walkMin, far); set.answers.set(key, got && Object.freeze(got)); return got;
  };
  const findOption = (a, b, lines, walkMin, far) => {
    const near = (p, km) => { const g = gridOf(lines), out = [], la = Math.floor(p.lat / CELL), lo = Math.floor(p.lng / CELL);
      const sLa = Math.ceil(km / (111 * CELL)) , sLo = Math.ceil(km / (111 * CELL * Math.max(0.2, Math.cos(p.lat * Math.PI / 180))));
      for (let x = la - sLa; x <= la + sLa; x++) for (let y = lo - sLo; y <= lo + sLo; y++) { const c = g.get(x + "," + y); if (!c) continue;
        for (const [li, si] of c) { const d = E.hav(p, lines[li].stops[si]); if (d <= km) out.push({ li, si, d }); } }
      return out.sort((a, b) => a.li - b.li || a.si - b.si); };
    const D = E.hav(a, b), reach = far ? Math.max(ACCESS_KM, Math.min(10, D * 0.12)) : ACCESS_KM;
    // Beyond a walk only a train station counts (a taxi to a metro stop across town is just a longer taxi).
    const ok = x => x.d <= ACCESS_KM || lines[x.li].mode === "train";
    const from = near(a, reach).filter(ok), to = near(b, reach).filter(ok); if (!from.length || !to.length) return null;
    const nm = st => E.latin(st.name || "the stop"), wait = m => far && m === "train" ? 30 : WAIT[m] || 6;
    const endMin = d => d <= ACCESS_KM ? walkMin(d) : far.taxiMin(d), taxiKm = (f, t) => (f.d > ACCESS_KM ? f.d : 0) + (t.d > ACCESS_KM ? t.d : 0);
    const goStep = (d, st) => (d <= ACCESS_KM ? "Walk " + walkMin(d) + " min to " : "Taxi " + far.taxiMin(d) + " min to ") + nm(st) + (d > ACCESS_KM ? " station" : "");
    const endStep = (d, st) => d <= ACCESS_KM ? "Walk " + walkMin(d) + " min" : "Taxi " + far.taxiMin(d) + " min from " + nm(st) + " station";
    let best = null;
    // The words are written only for a ride that beats (or ties) the best so far: most candidates never need them.
    const consider = (min, mode, legs, stepsOf) => { if (best && min > best.min) return; const steps = stepsOf(), h = steps.slice(1, -1).map(x => x.replace(/ \(.*\)$/, "").replace(/, \d+ min$/, "").replace(/^Change to /, "then ")).join(", ");
      if (!best || min < best.min || h < best.how) best = { min, mode, kind: E.lineKind(mode), how: h, legs, steps }; };
    for (const f of from) for (const t of to) {
      const L = lines[f.li], M = lines[t.li];
      if (f.li === t.li) {
        if (f.si === t.si) continue;
        if (taxiKm(f, t) > D / 3) continue; // the taxis would be most of the trip
        const r = ride(L, f.si, t.si), min = endMin(f.d) + wait(L.mode) + r + endMin(t.d);
        consider(min, L.mode, 1, () => [goStep(f.d, L.stops[f.si]), E.transitLabel(L) + ", " + nm(L.stops[f.si]) + " to " + nm(L.stops[t.si]) + ", " + r + " min" + (far && L.mode === "train" ? " (trains about hourly: up to 30 min wait counted)" : ""), endStep(t.d, L.stops[t.si])]);
        continue;
      }
      // One change: a stop of the first line that is (or stands beside) a stop of the second.
      for (const [i, j] of meets(L, M)) {
        if (i === f.si || j === t.si) continue;
        if (taxiKm(f, t) > D / 3) continue;
        const r1 = ride(L, f.si, i), r2 = ride(M, j, t.si), min = endMin(f.d) + wait(L.mode) + r1 + CHANGE_MIN + wait(M.mode) + r2 + endMin(t.d);
        consider(min, L.mode, 2, () => [goStep(f.d, L.stops[f.si]), E.transitLabel(L) + ", " + nm(L.stops[f.si]) + " to " + nm(L.stops[i]) + ", " + r1 + " min", "Change to " + E.transitLabel(M) + ", " + nm(M.stops[j]) + " to " + nm(M.stops[t.si]) + ", " + r2 + " min", endStep(t.d, M.stops[t.si])]);
      }
    }
    return best;
  };
})(KEngine);
