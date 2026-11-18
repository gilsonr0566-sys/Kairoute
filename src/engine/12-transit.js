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
  E.transitLabel = l => (LABEL[l.mode] || "Train") + (l.ref ? " " + (/^\d+$/.test(l.ref) ? "Line " + l.ref : l.ref) : "");
  // Minutes riding a line from stop index i to j (along the line's own stop order).
  const ride = (l, i, j) => { let km = 0; const [a, b] = i < j ? [i, j] : [j, i]; for (let k = a; k < b; k++) km += E.hav(l.stops[k], l.stops[k + 1]);
    return Math.round(km / (SPEED[l.mode] || 25) * 60 + 0.5 * (b - a)); };
  // lines: [{ mode, ref, name, stops: [{ name, lat, lng }] in order }]. walkMin(km) -> minutes on foot.
  E.transitOption = (a, b, lines, walkMin) => {
    if (!lines || !lines.length || !a || !b || !isFinite(a.lat) || !isFinite(b.lat)) return null;
    const near = p => { const out = []; lines.forEach((l, li) => l.stops.forEach((s, si) => { const d = E.hav(p, s); if (d <= ACCESS_KM) out.push({ li, si, d }); })); return out; };
    const from = near(a), to = near(b); if (!from.length || !to.length) return null;
    let best = null;
    const consider = o => { if (!best || o.min < best.min || (o.min === best.min && o.how < best.how)) best = o; };
    for (const f of from) for (const t of to) {
      const L = lines[f.li], M = lines[t.li];
      if (f.li === t.li) {
        if (f.si === t.si) continue;
        const min = walkMin(f.d) + (WAIT[L.mode] || 6) + ride(L, f.si, t.si) + walkMin(t.d);
        consider({ min, mode: L.mode, how: E.transitLabel(L) + ", " + L.stops[f.si].name + " to " + M.stops[t.si].name, legs: 1 });
        continue;
      }
      // One change: a stop of the first line that is (or stands beside) a stop of the second.
      for (let i = 0; i < L.stops.length; i++) for (let j = 0; j < M.stops.length; j++) {
        const x = L.stops[i], y = M.stops[j];
        if (i === f.si || j === t.si || !(norm(x.name) === norm(y.name) || E.hav(x, y) <= SAME_STOP_KM)) continue;
        const min = walkMin(f.d) + (WAIT[L.mode] || 6) + ride(L, f.si, i) + CHANGE_MIN + (WAIT[M.mode] || 6) + ride(M, j, t.si) + walkMin(t.d);
        consider({ min, mode: L.mode, how: E.transitLabel(L) + " to " + x.name + ", then " + E.transitLabel(M) + " to " + M.stops[t.si].name, legs: 2 });
      }
    }
    return best;
  };
})(KEngine);
