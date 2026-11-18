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
  // far: a day trip out of town ({ km, taxiMin(km) }): the far end may be a taxi ride from its station (Ancient Corinth
  // from Corinth station), trains run about hourly (half an hour's wait counted), and the option says so.
  E.transitOption = (a, b, lines, walkMin, far) => {
    if (!lines || !lines.length || !a || !b || !isFinite(a.lat) || !isFinite(b.lat)) return null;
    const near = (p, km) => { const out = []; lines.forEach((l, li) => l.stops.forEach((s, si) => { const d = E.hav(p, s); if (d <= km) out.push({ li, si, d }); })); return out; };
    const reach = far ? far.km : ACCESS_KM, endMin = d => d <= ACCESS_KM ? walkMin(d) : far.taxiMin(d), endWord = (d, nm) => d <= ACCESS_KM ? "" : ", then a taxi " + far.taxiMin(d) + " min";
    const from = near(a, reach).filter(x => !far || x.d <= reach), to = near(b, reach); if (!from.length || !to.length) return null;
    const wait = m => far ? 30 : (WAIT[m] || 6);
    let best = null;
    const consider = o => { if (!best || o.min < best.min || (o.min === best.min && o.how < best.how)) best = o; };
    for (const f of from) for (const t of to) {
      const L = lines[f.li], M = lines[t.li];
      if (f.li === t.li) {
        if (f.si === t.si) continue;
        const min = endMin(f.d) + wait(L.mode) + ride(L, f.si, t.si) + endMin(t.d);
        consider({ min, mode: L.mode, how: (f.d > ACCESS_KM ? "Taxi " + endMin(f.d) + " min to " + L.stops[f.si].name + ", then " : "") + E.transitLabel(L) + ", " + L.stops[f.si].name + " to " + M.stops[t.si].name + endWord(t.d), legs: 1 });
        continue;
      }
      // One change: a stop of the first line that is (or stands beside) a stop of the second.
      for (let i = 0; i < L.stops.length; i++) for (let j = 0; j < M.stops.length; j++) {
        const x = L.stops[i], y = M.stops[j];
        if (i === f.si || j === t.si || !(norm(x.name) === norm(y.name) || E.hav(x, y) <= SAME_STOP_KM)) continue;
        const min = endMin(f.d) + wait(L.mode) + ride(L, f.si, i) + CHANGE_MIN + wait(M.mode) + ride(M, j, t.si) + endMin(t.d);
        consider({ min, mode: L.mode, how: (f.d > ACCESS_KM ? "Taxi " + endMin(f.d) + " min to " + L.stops[f.si].name + ", then " : "") + E.transitLabel(L) + " to " + x.name + ", then " + E.transitLabel(M) + " to " + M.stops[t.si].name + endWord(t.d), legs: 2 });
      }
    }
    return best;
  };
})(KEngine);
