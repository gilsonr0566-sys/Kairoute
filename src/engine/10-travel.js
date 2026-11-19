// Beta 2 engine, part 1: the rides between two places. ONE layer (Nov 18 night, Richard: "we are making layers again";
// the ride code had grown a patch for each bug: guide-text rides, stitched routes, relabelled choices). Every ride is
// built here and only here, the same way everywhere:
//  - A short list of real ways to go, at most one of each kind: walk, metro, tram, train, bus, ferry, taxi. Each comes
//    from data: the walking distance, the timetable answers the app has (the same answers the demo used), the lines
//    mapped on OpenStreetMap, the mapped ferry piers, the road. Never from a guess or a route stitched together.
//  - Each way has one label that names what it is (its kind sets its icon and how the map draws it) and its steps.
//  - The guide's own words about getting there are a note beside the ride, never a ride of their own. Where the guide
//    names a train or bus the data doesn't have, the note says so plainly ("A local train may run: check at the station").
//  - The traveler's choice for a ride always holds; when it can't (that way isn't known for this ride), the ride says why.
//  - Time for the ship (or a train or plane) is added in one place, the same for every way.
// Two kinds of answer stay apart on purpose (lesson 1: plans drifted as ride answers arrived): the plan's shape is
// decided with these times, and live times only set the clock in the timeline (part 9).
(function (E) {
  E.PIER_MIN = 15; // at the pier: buying a ticket, boarding, and the wait for the next sailing
  E.BOAT = /\b(boat|boats|ferry|ferries|hydrofoil|catamaran|water ?bus|vaporetto)\b/i;
  // Reached only by water: the note names a boat and no way by land (a note offering a train, bus, car or walk too is a
  // place on the mainland). "Water taxi" is a boat, not a taxi.
  const LAND = /\b(train|rail|metro|tram|bus|coach|car|road|drive|taxi|cab|walk|hike|bridge|causeway)\b/i;
  // Seen only from the water (an islet, a sea cave): its access or tickets say so.
  E.waterOnly = s => !!s && /\b(viewed|seen|viewable|visible) from (the )?(water|sea|a boat|boat)|\bonly (by|from) (boat|sea)\b|\bboat tours? only\b/i.test(String(s.access || ""));
  E.byBoat = note => { const n = String(note || "").replace(/water ?taxi/gi, "boat"); return E.BOAT.test(n) && !LAND.test(n); };
  // The kinds of public transport a guide's note names ("by train and shuttle bus" -> train, bus). Read only to say
  // when the data has no such ride; the note never makes a ride itself.
  E.noteKinds = note => { const n = String(note || "").replace(/cable ?cars?|funiculars?|rack railway/gi, ""), out = [];
    if (/\b(train|trains|rail|railway|circumvesuviana)\b/i.test(n)) out.push("train"); if (/\b(metro|subway|underground)\b/i.test(n)) out.push("metro");
    if (/\b(tram|trams)\b/i.test(n)) out.push("tram"); if (/\b(bus|buses|coach|shuttle)\b/i.test(n)) out.push("bus"); if (E.BOAT.test(n.replace(/water ?taxi/gi, "boat"))) out.push("ferry"); return out; };
  const WALK_LIMIT = { low: 0.8, medium: 1.7, high: 3.2 }, WALK_EITHER = 4;
  // By road (taxi or car) for d km as the crow flies: town streets, regional roads, then highway.
  function road(d) {
    const k = d <= 15 ? 1.3 : d <= 40 ? 1.35 : 1.25, v = d <= 6 ? 22 : d <= 15 ? 25 : d <= 40 ? 45 : 85, add = d <= 15 ? 10 : 15;
    return { km: d * k, min: Math.round(add + d * k / v * 60) };
  }
  // The longest time a guide's note names ("1 hour on the train", "60-75 min"), 10 to 300 minutes, else 0.
  function saidMin(note) {
    const low = String(note || "").toLowerCase(); if (!low) return 0; let m = 0;
    for (const x of low.matchAll(/(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|h\b|minutes?|mins?\b|min\b)/g)) m = Math.max(m, +x[2] * (/^h/.test(x[3]) ? 60 : 1));
    for (const x of low.matchAll(/(\d+(?:\.\d+)?|an|one|half an)\s*(hours?|hrs?|h\b|minutes?|mins?\b|min\b)/g)) { const n = x[1] === "an" || x[1] === "one" ? 1 : x[1] === "half an" ? 0.5 : +x[1]; m = Math.max(m, n * (/^h/.test(x[2]) ? 60 : 1)); }
    for (const x of low.matchAll(/(\d+)\s*h(?:ours?|rs?)?\s*(\d+)\s*m/g)) m = Math.max(m, +x[1] * 60 + +x[2]);
    return m >= 10 && m <= 300 ? Math.round(m) : 0;
  }
  // The public way wins unless a taxi saves a great deal: over 40 minutes and over 40% of the ride (Nov 18, Richard:
  // the Circumvesuviana from Sorrento to Pompeii, 1 h 13, lost to a 46-minute taxi; he wants the trains).
  E.publicWins = (pub, roadMin) => !(roadMin < pub - 40 && roadMin < pub * 0.6);
  // Every pier a boat may leave from: the ferry piers mapped for each place, and the port of a day the ship docks or sails
  // (a ship's port is on the water). [{ name, lat, lng }]
  E.piersOf = bucket => (bucket.piers || []).filter(p => p && isFinite(p.lat) && isFinite(p.lng)).concat((bucket.days || [])
    .filter(d => d && d.point && isFinite(d.point.lat) && !d.point.unknown && (d.type === "port" || d.type === "embark" || ((d.type === "arrival" || d.type === "departure") && (d.mode === "ship" || d.mode === "ferry"))))
    .map(d => ({ name: d.point.name || "the port", lat: d.point.lat, lng: d.point.lng })));
  E.PIER_AT = 0.3;  // within this of a pier is at the water already
  E.PIER_KM = 40;   // farthest a pier may be from where the traveler is to take a boat from it
  E.PIER_ISLAND = 5; // farthest the pier of a place reached by boat may be from it (on the same island)
  // How each kind of ride is made, drawn and shown: mode is what the timeline and the map read (walk, ride = by road,
  // transit = on rails or a bus, boat), and every kind has its own icon in the app.
  E.RIDE_KINDS = Object.freeze(["walk", "metro", "tram", "train", "bus", "ferry", "taxi"]);
  E.modeOfKind = k => k === "walk" ? "walk" : k === "taxi" ? "ride" : k === "ferry" ? "boat" : "transit";
  // A choice saved before the kinds were named (the app kept "transit", "boat", "ride" or a timetable row's own id).
  const OLD_CHOICE = { ride: "taxi", boat: "ferry" };
  // How many changes a timetable answer has, from its steps or its label ("M3 + 1 change").
  const changesOf = o => Array.isArray(o.steps) && o.steps.length ? o.steps.length - 1 : +((/\+\s*(\d+)\s+change/.exec(o.label || "") || [0, 0])[1]);
  // The guide's note on how to get out to a place is read only for a ride between the place and where the day is based
  // (a ride from one trip out to another is planned from the map, never from either note).
  const noteFor = (a, b) => a.travelNote && !b.travelNote ? a.travelNote : b.travelNote && !a.travelNote ? b.travelNote : "";
  // A travel calculator for one trip's preferences. Pure and memoised per pair (the same pair always gives the same answer).
  // legs: pinned network times from the places database, keyed by pairKey (walking, road and ferry times).
  // lines: public transport lines from the places files (part 1b).
  // answers(a, b): the app's own timetable answers for a ride ([{ id, min, label, mode, steps, access, egress, ... }]),
  // or null. piers: every pier a boat may use.
  E.makeTravel = (prefs, legModes, legs, lines, answers, piers) => {
    const walk = (prefs && prefs.walk) || "medium", lim = WALK_LIMIT[walk] || WALK_LIMIT.medium, speed = walk === "low" ? 3.6 : 4.5, modes = legModes || {}, memo = new Map(), memoEnd = new Map();
    const walkMinOf = km => Math.max(1, Math.round(km * 1.3 / speed * 60));
    // The traveler's ride choice belongs to the two places, whichever way the day goes between them (Nov 18: the train
    // picked from Sorrento to Pompeii was lost when the day ran Pompeii first). A choice also holds for any two points
    // each within a short walk (1.5 km, or a fifth of the ride) of its two places, on a ride over 5 km; one made the
    // same way round wins, then the closest.
    const chosenPairs = Object.keys(modes).map(k => { const v = k.split(",").map(Number); return v.length === 4 && v.every(isFinite) ? { a: { lat: v[0], lng: v[1] }, b: { lat: v[2], lng: v[3] }, m: modes[k] } : null; }).filter(Boolean);
    const modeOf = (a, b) => { const k = modes[E.pairKey(a, b)]; if (k != null) return k; const r = modes[E.pairKey(b, a)]; if (r != null) return r;
      if (!chosenPairs.length || !a || !b || E.hav(a, b) < 5) return undefined;
      const tol = Math.max(1.5, E.hav(a, b) / 5), pickOf = dist => { let best = null, bestD = Infinity; for (const p of chosenPairs) { const d = dist(p); if (d <= tol && d < bestD) { best = p; bestD = d; } } return best; };
      const best = pickOf(p => Math.max(E.hav(p.a, a), E.hav(p.b, b))) || pickOf(p => Math.max(E.hav(p.a, b), E.hav(p.b, a)));
      return best ? best.m : undefined; };
    function estimate(a, b) {
      if (!a || !b || !isFinite(a.lat) || !isFinite(b.lat)) return { mode: "walk", kind: "walk", how: "Walk", km: 0, min: 0, unknown: true };
      // The cable car (or funicular) between a landing and the town above: its own fixed step holds the time.
      const lift = (p, q) => p.viaLift && E.hav(q, p.viaLift) < 0.05;
      if (lift(a, b) || lift(b, a)) return { mode: "lift", kind: "train", how: (a.viaLift || b.viaLift).name || "Cable car", km: 0, min: 0 };
      // Remembered by the four coordinates (numbers make fast keys), apart for legs that end at a deadline.
      let m = (b.backToShip || b.deadline) ? memoEnd : memo;
      for (const x of [a.lat, a.lng, b.lat]) { let n = m.get(x); if (!n) { n = new Map(); m.set(x, n); } m = n; }
      const got = m.get(b.lng); if (got) return got;
      const v = Object.freeze(calc(a, b)); m.set(b.lng, v); return v;
    }
    // The timetable answers for a ride, one per kind: the quickest, or one with fewer changes at most 10 minutes slower,
    // or the very row the traveler chose (Nov 18, Athens airport: three rows of the same metro ride).
    function answered(a, b, d, want) {
      if (!answers || d < 1.5) return [];
      const got = (answers(a, b) || []).filter(o => o && isFinite(o.min)).slice().sort((x, y) => x.min - y.min || String(x.label).localeCompare(String(y.label)));
      const by = new Map();
      for (const o of got) { const k = E.lineKind(String(o.mode || o.kind || "train")), r = by.get(k);
        if (!r) { by.set(k, o); continue; } if (want != null && String(r.id) === String(want)) continue;
        if ((want != null && String(o.id) === String(want)) || (changesOf(o) < changesOf(r) && o.min <= r.min + 10)) by.set(k, o); }
      return [...by.entries()].map(([kind, o]) => ({ id: kind, kind, how: E.latin(o.label), min: Math.round(o.min), ans: o, steps: Array.isArray(o.steps) ? o.steps.map(E.latin) : [] }));
    }
    // A boat leaves from a pier and lands at one (Nov 18, Richard's map: the ferry to an island left from a cathedral and
    // ran across the streets). The boat runs from the mapped pier nearest the land end (or the pier the guide's note
    // names) to the pier nearest the boat's place, and the way to or from each pier is a ride of its own. Returns
    // { parts, min, from, to } or null when both ends are at the water already or no pier is known near them.
    const pierList = (piers || []).filter(p => p && isFinite(p.lat));
    const nearestPier = (p, km) => { let best = null, bd = Infinity; for (const q of pierList) { const d = E.hav(p, q); if (d < bd || (d === bd && best && String(q.name) < String(best.name))) { best = q; bd = d; } } return best && bd <= km ? { q: best, d: bd } : null; };
    const plainPt = p => ({ lat: p.lat, lng: p.lng });
    const groundOf = (g, pierName, toPier, to) => Object.assign({ mode: g.mode, kind: g.kind, how: g.how + (toPier ? " to the ferry at " : " from the ferry at ") + pierName, min: g.min, km: g.km || 0, pierName, steps: g.steps || [] },
      g.transitMode ? { transitMode: g.transitMode } : {}, g.slack ? { slack: g.slack } : {}, g.ans ? { ans: g.ans } : {}, to ? { to } : {});
    function pierLeg(a, b, boatEnd) {
      const land = boatEnd === b ? a : b; if (!pierList.length || !land || land.viaLift || boatEnd.viaLift) return null;
      const said = String(boatEnd.travelNote || "").toLowerCase(), base = n => String(n || "").replace(/\s*\(.*?\)\s*/g, " ").trim().toLowerCase();
      const named = pierList.filter(q => base(q.name).length >= 5 && said.includes(base(q.name)) && E.hav(land, q) <= E.PIER_KM).sort((x, y) => E.hav(land, x) - E.hav(land, y))[0];
      const lp = named ? { q: named, d: E.hav(land, named) } : nearestPier(land, E.PIER_KM), bp = nearestPier(boatEnd, E.PIER_ISLAND);
      const useL = lp && lp.d >= E.PIER_AT, useB = bp && bp.d >= E.PIER_AT && (!lp || E.hav(lp.q, bp.q) > 1);
      if (!useL && !useB) return null;
      const L = useL ? { lat: lp.q.lat, lng: lp.q.lng } : null, B = useB ? { lat: bp.q.lat, lng: bp.q.lng } : null, out = boatEnd === b;
      // The ride on land to (or from) the pier is planned as any ride (walk, its lines, a taxi); on the island the pier
      // and the place are on the same land, so it is a walk or a ride, never another boat.
      const gL = useL ? (out ? estimate(a, L) : estimate(L, b)) : null, gB = useB ? (out ? estimate(B, plainPt(b)) : estimate(plainPt(a), B)) : null;
      const from = out ? (lp && lp.q.name) : (bp && bp.q.name), at = out ? (bp && bp.q.name) : (lp && lp.q.name);
      const boat = { boat: true, from: out ? (useL ? lp.q.name : null) : (useB ? bp.q.name : null), at: out ? (useB ? bp.q.name : null) : (useL ? lp.q.name : null) };
      const parts = out ? [gL && groundOf(gL, lp.q.name, true, L), Object.assign(boat, useB ? { to: B } : {}), gB && groundOf(gB, bp.q.name, false)]
        : [gB && groundOf(gB, bp.q.name, true, B), Object.assign(boat, useL ? { to: L } : {}), gL && groundOf(gL, lp.q.name, false)];
      return { parts: parts.filter(Boolean), min: (gL ? gL.min : 0) + (gB ? gB.min : 0), from, to: at };
    }
    // Every way to make the ride, then the one taken.
    function calc(a, b) {
      const d = E.hav(a, b);
      if (d < 0.02) return { mode: "walk", kind: "walk", how: "Walk", km: 0, min: 0 };
      const pin = legs && legs[E.pairKey(a, b)], pinned = pin && isFinite(pin.min) ? pin : null, wantRaw = modeOf(a, b);
      const isle = p => E.byBoat(p.travelNote) || E.waterOnly(p), note = noteFor(a, b);
      // The traveler's choice, as a kind (a row of a timetable answer picked earlier counts as its kind).
      const want = wantRaw == null ? null : OLD_CHOICE[wantRaw] || wantRaw;
      const opts = [];
      if (isle(a) !== isle(b) && d > 1) {
        // Across water: a place reached only by boat is reached by boat, never a taxi or a walk. The boat's time is the
        // timetable's when the app has it, else the crossing the guide names (or one worked out from the distance),
        // plus the time at the pier for the next sailing.
        const holder = isle(a) ? a : b, ferryAns = answered(a, b, d, wantRaw).find(o => o.kind === "ferry");
        if (ferryAns) opts.push(Object.assign(ferryAns, { km: d }));
        else {
          const hn = holder.travelNote || "", cross = saidMin(hn) || Math.round(d / 25 * 60) + 10, pl = pierLeg(a, b, holder);
          const word = /high.?speed|fast ferry|hydrofoil|catamaran/i.test(hn) ? "Fast ferry" : /ferry/i.test(hn) ? "Ferry" : "Boat";
          const fromTo = pl && pl.parts.find(x => x.boat), how = word + (fromTo && fromTo.from ? " from " + fromTo.from : "") + (fromTo && fromTo.at ? " to " + fromTo.at : "");
          opts.push(Object.assign({ id: "ferry", kind: "ferry", how, min: cross + E.PIER_MIN + (pl ? pl.min : 0), km: d, cross, pier: E.PIER_MIN, timetable: true,
            steps: [word + (fromTo && fromTo.from ? " from " + fromTo.from : "") + ", about " + cross + " min crossing", "Allow " + E.PIER_MIN + " min at the pier for the ticket and the next sailing"] }, pl ? { parts: pl.parts } : {}));
        }
      } else {
        // On foot: any ride up to 4 km may be walked.
        const onFoot = pinned && pinned.mode === "walk" ? Math.round(pinned.min) : Math.max(2, Math.round(d * 1.3 / speed * 60));
        if (d <= WALK_EITHER || (pinned && pinned.mode === "walk")) opts.push({ id: "walk", kind: "walk", how: "Walk", min: onFoot, km: d * 1.3, steps: [] });
        // Public transport: the timetable's answers, one per kind; a line mapped on OpenStreetMap for a kind they don't
        // have (a stop within a short walk of each end). On a walk short enough, only when it is quicker than walking.
        const pub = answered(a, b, d, wantRaw);
        if (d >= 0.6 && lines && lines.length) { const t = E.transitOption(a, b, lines, walkMinOf);
          if (t && !pub.some(o => o.kind === t.kind)) pub.push({ id: t.kind, kind: t.kind, how: t.how, min: t.min, steps: t.steps.slice(), mapped: true, transitMode: t.mode }); }
        for (const o of pub) if (d > lim || o.min < onFoot) opts.push(Object.assign({ km: d * 1.3 }, o));
        // By road: a taxi or car, on the road network's time when the places database has it, else the road estimate.
        // The guide's own time for the ride (a winding road it knows) is the floor, never the label.
        if (d >= 0.6 || !opts.length) {
          const r = pinned && pinned.mode !== "walk" && pinned.mode !== "boat" ? { km: pinned.km || d * 1.3, min: Math.round(pinned.min) } : road(d), said = d > 5 ? saidMin(note) : 0;
          opts.push({ id: "taxi", kind: "taxi", how: "Taxi or car", min: Math.max(r.min, said), km: r.km, steps: [] });
        }
      }
      // Time for the ship, a train or a plane, in one place for every way: a ride of half an hour or more to it gets 30%
      // more, at least 15 minutes (a late train, traffic, a slow boat queue).
      if (b.backToShip || b.deadline) for (const o of opts) if (o.kind !== "walk" && o.min >= 30) { o.slack = Math.max(15, Math.round(o.min * 0.3 / 5) * 5); o.min += o.slack; }
      // The way taken: the traveler's own choice when it is offered; else a walk when it is short enough; else the
      // quickest public way unless a taxi saves a great deal; else the taxi.
      const byKind = k => opts.find(o => o.kind === k);
      const pubs = opts.filter(o => o.kind !== "walk" && o.kind !== "taxi").sort((x, y) => x.min - y.min || x.kind.localeCompare(y.kind));
      const ansPick = wantRaw != null ? opts.find(o => o.ans && String(o.ans.id) === String(wantRaw)) : null;
      let pick = ansPick || (want === "transit" ? pubs.find(o => o.kind !== "ferry") : want != null ? byKind(want) : null), lost = null;
      if (want != null && !pick) lost = want;
      if (!pick) { const w = byKind("walk"), t = byKind("taxi");
        pick = w && d <= lim ? w : pubs.length && (!t || E.publicWins(pubs[0].min, t.min)) ? pubs[0] : t || pubs[0] || w || opts[0]; }
      // A way the guide names that the data doesn't have: said plainly, never planned as if it were known.
      const missing = d > 5 && note ? E.noteKinds(note).filter(k => !opts.some(o => o.kind === k || (k === "train" && (o.kind === "metro" || o.kind === "tram")))) : [];
      const notes = [];
      if (note && d > 5) notes.push("The guide says: " + note.trim().replace(/\s+/g, " "));
      if (missing.length) notes.push("The guide names " + missing.map(k => k === "ferry" ? "a ferry" : "a " + k).join(" and ") + ", but no timetable for it is known here, so this ride is planned " + (pick.kind === "taxi" ? "by taxi" : "as " + pick.how) + ": check at the " + (missing.includes("ferry") && missing.length === 1 ? "pier" : "station") + " or with your hotel.");
      const options = opts.map(o => Object.assign({ id: o.id, kind: o.kind, mode: E.modeOfKind(o.kind), how: o.how, min: o.min, steps: o.steps || [] },
        o.ans ? { ans: o.ans } : {}, o.parts ? { parts: o.parts, cross: o.cross } : {}, o.slack ? { slack: o.slack } : {}, o.transitMode ? { transitMode: o.transitMode } : {}));
      const leg = Object.assign({ mode: E.modeOfKind(pick.kind), kind: pick.kind, how: pick.how, km: pick.km || d, min: pick.min, steps: pick.steps || [], choice: pick.id, options },
        pick.kind !== "walk" && pick.kind !== "taxi" && pick.kind !== "ferry" ? { transitMode: pick.transitMode || (pick.ans && pick.ans.mode) || pick.kind } : {},
        pick.kind === "ferry" ? { cross: pick.cross, pier: pick.pier || E.PIER_MIN, timetable: true } : {},
        pick.parts ? { parts: pick.parts } : {}, pick.ans ? { ans: pick.ans } : {}, pick.slack ? { slack: pick.slack } : {}, pinned ? { pinned: true } : {},
        notes.length ? { note: notes.join(" ") } : {}, lost ? { lost } : {});
      if (options.length < 2) delete leg.options;
      return leg;
    }
    const min = (a, b) => (a && b ? estimate(a, b).min : 0);
    // The order of the day is worked out with the usual ride times, never with the way the traveler picked: a slower
    // train they choose changes the clock, not which place comes first (Nov 18: picking the train made the day run
    // another way round, the ride was no longer made, and the choice was refused).
    let plain = null;
    const orderMin = (a, b) => { if (!chosenPairs.length && !Object.keys(modes).length) return min(a, b); if (!plain) plain = E.makeTravel(prefs, null, legs, lines, answers, piers); return plain.min(a, b); };
    return { estimate, min, orderMin, road: d => Object.assign({ mode: "ride", kind: "taxi", how: "Taxi or car" }, road(d)), saidMin, chosen: (a, b) => modeOf(a, b) != null };
  };
  // The ride as the plan lists it: every fact the screens need, from the one ride record.
  E.rideItem = (leg, extra) => Object.assign({ t: "ride", mode: leg.mode, kind: leg.kind || (leg.mode === "walk" ? "walk" : "taxi"), min: leg.min, km: Math.round((leg.km || 0) * 100) / 100 },
    leg.how && leg.mode !== "walk" ? { how: leg.how } : {}, leg.options ? { options: leg.options } : {}, leg.transitMode ? { transitMode: leg.transitMode } : {},
    leg.choice ? { choice: leg.choice } : {}, leg.steps && leg.steps.length ? { steps: leg.steps } : {}, leg.ans ? { ans: leg.ans } : {}, leg.note ? { note: leg.note } : {},
    leg.lost ? { lost: leg.lost } : {}, leg.slack ? { slack: leg.slack } : {}, leg.pierName ? { pierName: leg.pierName } : {}, extra || {});
})(KEngine);
