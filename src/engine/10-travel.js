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
    if (/\b(train|trains|rail|railway)\b/i.test(n)) out.push("train"); if (/\b(metro|subway|underground)\b/i.test(n)) out.push("metro");
    if (/\b(tram|trams)\b/i.test(n)) out.push("tram"); if (/\b(bus|buses|coach|shuttle)\b/i.test(n)) out.push("bus"); if (E.BOAT.test(n.replace(/water ?taxi/gi, "boat"))) out.push("ferry"); return out; };
  // Every way a start place's note names (a port's "Sea bus to the old harbor every 20 to 30 minutes, about 10 minutes";
  // "A port shuttle bus runs to the main square"), one per kind, with its name as the guide gives it, its ride time if
  // said, and how often it runs if said (Nov 20 UI review: the note named a ride the plan offered no button for).
  E.noteWays = note => { const out = [];
    for (const part of String(note || "").split(/(?<=[.;!?])\s+|\n/)) {
      // Only a sentence that offers the ride: it gives a time or how often it runs, says it runs or goes, or starts with it
      // ("Right by the ferries to the islands" only says where the port is).
      if (!/\b(every|min|mins|minutes?|hours?|runs?|goes|go|leaves?|departs?|takes?|connects?|links?)\b/i.test(part) && !/^\s*(?:a|an|the|take a|take the|by)?\s*(?:[a-z]+\s+){0,2}?(?:sea ?bus|water ?bus|water ?taxi|shuttle|bus|ferry|boat|tram|metro|train)/i.test(part)) continue;
      const m = part.match(/\b((?:[a-z]+\s+){0,2}?(?:sea ?bus|water ?bus|water ?taxi|shuttle(?: bus(?:es)?)?|bus(?:es)?|ferry|ferries|boats?|tram|metro|train))\b/i); if (!m) continue;
      const kind = /sea ?bus|water|ferr|boat/i.test(m[1]) ? "ferry" : /tram/i.test(m[1]) ? "tram" : /metro/i.test(m[1]) ? "metro" : /train/i.test(m[1]) ? "train" : "bus";
      if (out.some(w => w.kind === kind)) continue;
      const ev = part.match(/every\s+(\d+)(?:\s*(?:-|–|to)\s*(\d+))?\s*(?:minutes?|mins?\b|min\b)/i), every = ev ? +(ev[2] || ev[1]) : 0;
      const ride = saidMin(part.replace(/every\s+\d+(?:\s*(?:-|–|to)\s*\d+)?\s*(?:minutes?|mins?\b|min\b)/ig, ""));
      const name = m[1].replace(/^(?:a|an|the|by|take|takes)\s+/i, "").replace(/buses$/i, "bus").replace(/ferries$/i, "ferry").replace(/boats$/i, "boat").trim();
      out.push({ kind, how: name.charAt(0).toUpperCase() + name.slice(1), ride, every, text: part.trim() }); }
    return out; };
  const WALK_LIMIT = { low: 0.8, medium: 1.7, high: 3.2 }, WALK_EITHER = 4;
  // By road (taxi or car) for d km as the crow flies: town streets, regional roads, then highway.
  // The average speed rises smoothly with the length of the ride (Nov 20 review: one speed for the whole ride, chosen by
  // its length, made a 53 km ride quicker than a 37 km one on the same road). A longer ride is never quicker.
  E.roadSpeed = d => d <= 6 ? 22 : d <= 15 ? 22 + (d - 6) * 8 / 9 : d <= 40 ? 30 + (d - 15) * 1.2 : d <= 70 ? 60 + (d - 40) * 2 / 3 : Math.min(85, 80 + (d - 70) * 0.1);
  // The road is longer than the straight line: about 1.3 times in town, 1.2 on the open road.
  E.roadTime = d => { const k = 1.3 - 0.1 * Math.min(1, Math.max(0, (d - 15) / 25)), add = 10 + 5 * Math.min(1, d / 40); return { km: d * k, min: Math.round(add + d * k / E.roadSpeed(d) * 60) }; };
  const road = d => E.roadTime(d);
  // The longest time a guide's note names ("1 hour on the train", "60-75 min"), 10 to 300 minutes, else 0.
  function saidMin(note) {
    const low = String(note || "").toLowerCase(); if (!low) return 0; let m = 0;
    for (const x of low.matchAll(/(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|h\b|minutes?|mins?\b|min\b)/g)) m = Math.max(m, +x[2] * (/^h/.test(x[3]) ? 60 : 1));
    for (const x of low.matchAll(/(\d+(?:\.\d+)?|an|one|half an)\s*(hours?|hrs?|h\b|minutes?|mins?\b|min\b)/g)) { const n = x[1] === "an" || x[1] === "one" ? 1 : x[1] === "half an" ? 0.5 : +x[1]; m = Math.max(m, n * (/^h/.test(x[2]) ? 60 : 1)); }
    for (const x of low.matchAll(/(\d+)\s*h(?:ours?|rs?)?\s*(\d+)\s*m/g)) m = Math.max(m, +x[1] * 60 + +x[2]);
    return m >= 10 && m <= 300 ? Math.round(m) : 0;
  }
  // The public way wins unless a taxi saves a great deal: over 40 minutes and over 40% of the ride (Nov 18, Richard:
  // a local train of 1 h 13 lost to a 46-minute taxi; he wants the trains).
  E.publicWins = (pub, roadMin) => !(roadMin < pub - 40 && roadMin < pub * 0.6);
  // Every pier a boat may leave from: the ferry piers mapped for each place, and the port of a day the ship docks or sails
  // (a ship's port is on the water). [{ name, lat, lng }]
  E.piersOf = bucket => (bucket.piers || []).filter(p => p && isFinite(p.lat) && isFinite(p.lng)).concat((bucket.days || [])
    .filter(d => d && d.point && isFinite(d.point.lat) && !d.point.unknown && (d.type === "port" || d.type === "embark" || ((d.type === "arrival" || d.type === "departure") && (d.mode === "ship" || d.mode === "ferry"))))
    .map(d => ({ name: d.point.name || "the port", lat: d.point.lat, lng: d.point.lng })));
  // A pier's name or a note in plain words, every word for a harbor read as "port" (harbour, porto, puerto, hafen, limani).
  E.pierWords = t => String(t || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(harbou?r|porto|puerto|porte?|hafen|limani|haven)\b/g, "port").trim();
  E.BAGS_WALK = 10; // longest walk planned with luggage
  E.PIER_BACK = 60; // at the pier for a boat back with no sailing times known: a gap between sailings
  // The first sailing a guide's note gives ("boats leave from about 9:00", "first boat at 9.30 am"), in minutes, else null.
  E.firstSailing = note => { const m = String(note || "").match(/\b(?:from|after|first (?:boat|ferry|sailing|departure)s?(?: \w+){0,2}?)\s+(?:about |around |approx(?:imately|\.)? )?(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
    if (!m) return null; let h = +m[1]; if (m[3] && /pm/i.test(m[3]) && h < 12) h += 12; if (m[3] && /am/i.test(m[3]) && h === 12) h = 0; return h < 24 && +m[2] < 60 ? h * 60 + +m[2] : null; };
  E.PIER_AT = 0.3;  // within this of a pier is at the water already
  E.PIER_KM = 40;   // farthest a pier may be from where the traveler is to take a boat from it
  E.PIER_ISLAND = 5; // farthest the pier of a place reached by boat may be from it (on the same island)
  // How each kind of ride is made, drawn and shown: mode is what the timeline and the map read (walk, ride = by road,
  // transit = on rails or a bus, boat), and every kind has its own icon in the app.
  E.RIDE_KINDS = Object.freeze(["walk", "metro", "tram", "train", "bus", "ferry", "taxi"]);
  E.hasPos = p => !!p && p.lat != null && p.lng != null && p.lat !== "" && p.lng !== "" && isFinite(p.lat) && isFinite(p.lng);
  E.SLOWER_THAN_WALK = 10; // most a way may be slower than a walk of up to twice the traveler's walking limit
  E.SPARE_RUN = 60; // minutes kept for a missed change on the way to the ship, a train or a plane (one train or bus later)
  E.UNKNOWN_RIDE = 45; // minutes for a ride to or from a place not on the map: a guess, said as one
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
  // "Close enough" to a ride already known, ONE rule for every answer borrowed from a ride next door (Nov 19 fold: the
  // traveler's ride choice, a road time from the map and a timetable answer each had their own distance, 1.5 km, 2 km
  // and 600 m): each end within a tenth of the ride of the known ride's ends (600 m at least, 5 km at most); the nearest
  // one wins. A borrowed TIME adds the time to reach the known ride's ends, the same way the ride goes (by road for a
  // road time; on foot, or by taxi beyond a walk, for public transport), so it is never shorter than going to those ends
  // and riding from there: safe by construction, however far within the limit the ends are.
  E.nearTol = d => Math.max(0.6, Math.min(5, d / 10));
  E.gapMin = (km, byRoad) => !(km >= 0.02) ? 0 : byRoad ? Math.round(km * 1.3 / 25 * 60) : km <= 0.8 ? Math.ceil(km * 1.3 / 4 * 60) : Math.round(5 + km * 1.3 / 25 * 60);
  // list: the known rides; endsOf(x) -> [A, B]. Returns { x, A, B, off } for the nearest known ride the same way round,
  // or null. off: the farther end's distance.
  E.nearRide = (a, b, list, endsOf) => { if (!list || !list.length || !E.hasPos(a) || !E.hasPos(b)) return null; const tol = E.nearTol(E.hav(a, b)); let best = null;
    for (const x of list) { const e = endsOf(x); if (!e || !e[0] || !e[1]) continue; const off = Math.max(E.hav(e[0], a), E.hav(e[1], b)); if (off <= tol && (!best || off < best.off)) best = { x, A: e[0], B: e[1], off }; }
    return best; };
  E.nearGap = (a, b, n, byRoad) => n ? E.gapMin(E.hav(a, n.A), byRoad) + E.gapMin(E.hav(b, n.B), byRoad) : 0;
  const roadMemos = new Map();
  E.makeTravel = (prefs, legModes, legs, lines, answers, piers) => {
    const walk = (prefs && prefs.walk) || "medium", lim = WALK_LIMIT[walk] || WALK_LIMIT.medium, speed = walk === "low" ? 3.6 : 4.5, modes = legModes || {}, memo = new Map(), memoEnd = new Map(), memoBags = new Map();
    const walkMinOf = km => Math.max(1, Math.round(km * 1.3 / speed * 60));
    // The traveler's ride choice belongs to the two places, whichever way the day goes between them (Nov 18: the train
    // picked between two trips out was lost when the day ran them the other way round). A choice also holds for a ride close
    // enough to it (E.nearRide); one made the same way round wins, then the closest.
    const chosenPairs = Object.keys(modes).map(k => { const v = k.split(",").map(Number); return v.length === 4 && v.every(isFinite) ? { a: { lat: v[0], lng: v[1] }, b: { lat: v[2], lng: v[3] }, m: modes[k] } : null; }).filter(Boolean);
    const modeOf = (a, b) => { const k = modes[E.pairKey(a, b)]; if (k != null) return k; const r = modes[E.pairKey(b, a)]; if (r != null) return r;
      const best = E.nearRide(a, b, chosenPairs, p => [p.a, p.b]) || E.nearRide(a, b, chosenPairs, p => [p.b, p.a]);
      return best ? { near: best.x.m } : undefined; };
    // A road time from the map (the places files) holds for a ride close enough to it, the gaps added by road (E.nearRide).
    const roadLegs = legs ? Object.values(legs).filter(l => l && l.road && l.a && l.b) : [];
    // The answer depends only on the road times and the two points, so it is kept across plans for the same road times
    // (the Sights list plans the day again for every sight it checks: measuring every ride against every road time each
    // time made a tick on a day of day trips take seconds on a phone, Nov 20 sweep).
    const roadSig = roadLegs.map(l => l.a.lat + "," + l.a.lng + ">" + l.b.lat + "," + l.b.lng + "=" + l.min).join("|");
    let roadMemo = roadMemos.get(roadSig); if (!roadMemo) { if (roadMemos.size > 20) roadMemos.clear(); roadMemos.set(roadSig, roadMemo = new Map()); }
    const roadNear = (a, b) => { const key = a.lat + "," + a.lng + ">" + b.lat + "," + b.lng; if (roadMemo.has(key)) { const r = roadMemo.get(key); return r && Object.assign({}, r); }
      const n = E.nearRide(a, b, roadLegs, l => [l.a, l.b]), r = n && Object.assign({}, n.x, { min: n.x.min + E.nearGap(a, b, n, true) });
      if (roadMemo.size > 200000) roadMemo.clear(); roadMemo.set(key, r && Object.freeze(Object.assign({}, r))); return r; };
    function estimate(a, b) {
      // A place with no position on the map is never a ride of no time (a 0-minute walk made a day look as if it fit): the
      // ride is a taxi of E.UNKNOWN_RIDE minutes, said to be a guess (Nov 19 review).
      if (!E.hasPos(a) || !E.hasPos(b)) return { mode: "ride", kind: "taxi", how: "Taxi or car", km: null, min: E.UNKNOWN_RIDE, unknown: true, guess: true,
        note: "One end of this ride isn't on the map, so its time is a guess: check how to get there before you go." };
      // The cable car (or funicular) between a landing and the town above: its own fixed step holds the time.
      const lift = (p, q) => p.viaLift && E.hav(q, p.viaLift) < 0.05;
      if (lift(a, b) || lift(b, a)) return { mode: "lift", kind: "train", how: (a.viaLift || b.viaLift).name || "Cable car", km: 0, min: 0 };
      // Remembered by the four coordinates (numbers make fast keys), apart for legs that end at a deadline.
      let m = b.bags ? memoBags : (b.backToShip || b.deadline) ? memoEnd : memo;
      for (const x of [a.lat, a.lng, b.lat]) { let n = m.get(x); if (!n) { n = new Map(); m.set(x, n); } m = n; }
      const got = m.get(b.lng); if (got) return got;
      const v = Object.freeze(calc(a, b)); m.set(b.lng, v); return v;
    }
    // The timetable answers for a ride, one per kind: the quickest, or one with fewer changes at most 10 minutes slower,
    // or the very row the traveler chose (Nov 18, an airport ride: three rows of the same metro ride).
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
    const pierList = (piers || []).filter(p => p && isFinite(p.lat)).map(p => Object.assign({}, p, { name: String(p.name || "the pier").split(/\s[-–]\s|,/)[0].trim() })); // its own name, not the stops listed after it
    const nearestPier = (p, km) => { let best = null, bd = Infinity; for (const q of pierList) { const d = E.hav(p, q); if (d < bd || (d === bd && best && String(q.name) < String(best.name))) { best = q; bd = d; } } return best && bd <= km ? { q: best, d: bd } : null; };
    const plainPt = p => ({ lat: p.lat, lng: p.lng });
    const groundOf = (g, pierName, toPier, to) => Object.assign({ mode: g.mode, kind: g.kind, how: g.how + (toPier ? " to the ferry at " : " from the ferry at ") + pierName, min: g.min, km: g.km || 0, pierName, steps: g.steps || [] },
      g.transitMode ? { transitMode: g.transitMode } : {}, g.slack ? { slack: g.slack } : {}, g.ans ? { ans: g.ans } : {}, to ? { to } : {});
    function pierLeg(a, b, boatEnd) {
      const land = boatEnd === b ? a : b; if (!pierList.length || !land || land.viaLift || boatEnd.viaLift) return null;
      // The pier the guide names, matched on its own words with the words for a harbor taken as one ("the old harbor" is the
      // map's "Old port"; Nov 20 review: the boat to an island left from the ship's dock, 2 km from the harbor the guide named).
      const said = E.pierWords(boatEnd.travelNote), base = n => E.pierWords(String(n || "").replace(/\s*\(.*?\)\s*/g, " ").split(/\s[-–,]\s|,/)[0]);
      const named = pierList.filter(q => base(q.name).length >= 5 && (" " + said + " ").includes(" " + base(q.name) + " ") && E.hav(land, q) <= E.PIER_KM).sort((x, y) => E.hav(land, x) - E.hav(land, y))[0];
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
      // A choice made for this very ride, or one made for a ride next door (the same trip out from another hotel or stop
      // nearby): that one is used only when this ride offers the same way, and never reported as lost (Nov 19, Richard's
      // Jul 2: the train he picked for the ride home was carried to the ride out, which has no known train, and the app
      // said "no train").
      const got = modeOf(a, b), nearOnly = got && typeof got === "object", wantRaw = nearOnly ? got.near : got;
      const pin = (legs && legs[E.pairKey(a, b)]) || roadNear(a, b), pinned = pin && isFinite(pin.min) ? pin : null;
      const isle = p => E.byBoat(p.travelNote) || E.waterOnly(p) || !!p.acrossWater, note = noteFor(a, b);
      // The traveler's choice, as a kind (a row of a timetable answer picked earlier counts as its kind).
      const want = wantRaw == null ? null : OLD_CHOICE[wantRaw] || (/^note\|/.test(String(wantRaw)) ? String(wantRaw).slice(5) : wantRaw); // a note's way is its kind
      const opts = [];
      // Two stops on two different islands, each across the water from the start, are a boat apart too; a stop the map
      // puts across the water is a boat away however close it looks (Round 1: an island off an old town planned as "Walk 6 min").
      const across = p => p.acrossWater ? String(p.acrossWater) : "", apart = isle(a) !== isle(b) || (across(a) && across(b) && across(a) !== across(b));
      if (apart && (d > 1 || across(a) || across(b))) {
        // Across water: a place reached only by boat is reached by boat, never a taxi or a walk. The boat's time is the
        // timetable's when the app has it, else the crossing the guide names (or one worked out from the distance),
        // plus the time at the pier for the next sailing.
        const holder = isle(a) ? a : b, ferryAns = answered(a, b, d, wantRaw).find(o => o.kind === "ferry");
        // A timetable's boat is still a boat from pier to pier: the way to (or from) the pier is its own ride, and the
        // boat keeps the rest of the timetable's time, never less than the time at the pier (Nov 19: a sailing borrowed
        // from the ride next door hid the walk to the ferry).
        if (ferryAns) { const pl = pierLeg(a, b, holder);
          opts.push(Object.assign(ferryAns, { km: d }, pl ? { parts: pl.parts, min: Math.max(ferryAns.min, pl.min + E.PIER_MIN) } : {})); }
        else {
          const hn = holder.travelNote || "", cross = saidMin(hn) || Math.round(d / 25 * 60) + 10, pl = pierLeg(a, b, holder);
          const word = /high.?speed|fast ferry|hydrofoil|catamaran/i.test(hn) ? "Fast ferry" : /ferry/i.test(hn) ? "Ferry" : "Boat";
          const fromTo = pl && pl.parts.find(x => x.boat), how = word + (fromTo && fromTo.from ? " from " + fromTo.from : "") + (fromTo && fromTo.at ? " to " + fromTo.at : "");
          // With no sailing times known, the boat back waits as long as a gap between sailings (Nov 20 review: boats to an
          // island sail a few times a day; 15 minutes at the pier planned the ship day on a boat that may not come). The boat
          // out never sails before the first time the guide gives ("boats leave from about 9:00").
          const back = holder === a, pier = back ? E.PIER_BACK : E.PIER_MIN, first = back ? null : E.firstSailing(hn);
          const gIsle = pl && pl.parts.length && !pl.parts[pl.parts.length - 1].boat ? pl.parts[pl.parts.length - 1].min : 0;
          opts.push(Object.assign({ id: "ferry", kind: "ferry", how, min: cross + pier + (pl ? pl.min : 0), km: d, cross, pier, source: saidMin(hn) ? "guide" : "estimate",
            steps: [word + (fromTo && fromTo.from ? " from " + fromTo.from : "") + ", about " + cross + " min crossing" + (first != null ? ", first boat about " + E.clock(first) : ""),
              back ? "No sailing times are known here: up to " + pier + " min at the pier is allowed for the next boat back. Check the timetable at the pier when you land"
                : "Allow " + pier + " min at the pier for the ticket and the next sailing", ...(back ? [] : ["No sailing times are known here: check the timetable at the pier"])] }, pl ? { parts: pl.parts } : {}, first != null ? { first: { at: first, after: cross + gIsle } } : {}));
        }
      } else {
        // On foot: any ride up to 4 km may be walked.
        const onFoot = pinned && pinned.mode === "walk" ? Math.round(pinned.min) : Math.max(2, Math.round(d * 1.3 / speed * 60));
        if (d <= WALK_EITHER || (pinned && pinned.mode === "walk")) opts.push({ id: "walk", kind: "walk", how: "Walk", min: onFoot, km: d * 1.3, steps: [] });
        // Public transport: the timetable's answers, one per kind; a line mapped on OpenStreetMap for a kind they don't
        // have (a stop within a short walk of each end). On a walk short enough, only when it is quicker than walking.
        const pub = answered(a, b, d, wantRaw);
        if (d >= 0.6 && lines && lines.length) { const t = E.transitOption(a, b, lines, walkMinOf, d >= 20 ? { taxiMin: k => road(k).min } : undefined);
          if (t && !pub.some(o => o.kind === t.kind)) pub.push({ id: t.kind, kind: t.kind, how: t.how, min: t.min, steps: t.steps.slice(), mapped: true, transitMode: t.mode }); }
        // Never a way much slower than a walk this traveler would take (Nov 19, Richard: a river boat of 1 h 40 min offered
        // for a 1.6-mile hop beside a 34-minute walk, "sticks out like a sore thumb"). Within the traveler's walking limit a
        // way is offered only when quicker than the walk; up to twice the limit, at most E.SLOWER_THAN_WALK minutes slower
        // (a bus that spares a longish walk); beyond that any way that spares the walk is offered, unless it is far slower
        // than both the taxi and the walk (below).
        // A way the start place's note names (a port's sea bus or shuttle) that the data doesn't have: a choice of its own,
        // on the guide's ride time (else the road's) with the wait for it (half its interval going out, all of it back to a
        // ship, train or plane, 15 min if not said) and 10 min from where it stops. Never taken on its own: the traveler picks it.
        const sNote = a.startNote || b.startNote || "";
        if (sNote && d >= 0.6) for (const w of E.noteWays(sNote)) if (!pub.some(o => o.kind === w.kind)) {
          const wait = w.every ? ((b.backToShip || b.deadline) ? w.every : Math.ceil(w.every / 2)) : 15;
          pub.push({ id: "note|" + w.kind, kind: w.kind, how: w.how, min: (w.ride || road(d).min) + wait + 10, steps: [w.text], said: true, source: w.ride ? "guide" : "estimate" }); }
        const slowOk = o => o.min < onFoot || (d > lim && (d > 2 * lim || o.min <= onFoot + E.SLOWER_THAN_WALK));
        for (const o of pub) if (slowOk(o)) opts.push(Object.assign({ km: d * 1.3 }, o));
        // By road: a taxi or car, on the road network's time when the places database has it, else the road estimate.
        // The guide's own time for the ride (a winding road it knows) is the floor, never the label.
        if (d >= 0.6 || !opts.length) {
          const r = pinned && pinned.mode !== "walk" && pinned.mode !== "boat" ? { km: pinned.km || d * 1.3, min: Math.round(pinned.min) } : road(d), said = d > 5 ? saidMin(note) : 0;
          // A stop far from any road a car can drive (a car-free old town on the water, Round 1: taxis between the
          // sights): the taxi starts or ends at the nearest road, and the walk to it is part of the ride. Between two such
          // stops within a walk, no taxi at all.
          const gap = p => Math.max(0, +p.roadGap || 0) / 1000, ga = gap(a), gb = gap(b);
          if (!(ga && gb && d <= WALK_EITHER)) {
            const gw = k => k ? Math.max(2, Math.round(k * 1.3 / speed * 60)) : 0, walkTo = gw(ga) + gw(gb);
            opts.push(Object.assign({ id: "taxi", kind: "taxi", how: walkTo ? "Walk to the road, then taxi" : "Taxi or car", min: Math.max(r.min, said) + walkTo, km: r.km, steps: walkTo ? [(ga ? "Walk about " + gw(ga) + " min to the nearest road a car can reach" : "") + (ga && gb ? "; " : "") + (gb ? "the taxi stops about " + gw(gb) + " min walk away" : "")] : [], source: said > r.min ? "guide" : pinned && pinned.road ? "roads" : "estimate" }, walkTo ? { roadWalk: walkTo } : {}));
          }
        }
        // Nothing else reaches it (two stops far from any road, farther apart than a walk): the walk is offered, on its time.
        if (!opts.length) opts.push({ id: "walk", kind: "walk", how: "Walk", min: onFoot, km: d * 1.3, steps: [] });
        // Never a way far slower than the road (Round 1, Nov 20: a ferry to another island offered for a ride across the
        // city, a coach with 6 changes taking 13 h): over twice the taxi's time and 20 min more, it isn't offered, unless it is
        // the traveler's own choice.
        const taxiO = opts.find(o => o.kind === "taxi");
        if (taxiO) for (let k = opts.length - 1; k >= 0; k--) { const o = opts[k]; if (o.kind === "taxi" || o.kind === "walk") continue;
          const mine = wantRaw != null && (String(o.id) === String(wantRaw) || (o.ans && String(o.ans.id) === String(wantRaw)) || o.kind === wantRaw);
          // A way the start place's own note names (a port's sea bus) stays: the traveler picks it knowing what it is.
          if (!mine && !o.said && o.min > 2 * taxiO.min + 20 && o.min > onFoot) opts.splice(k, 1); }
      }
      // Time for the ship, a train or a plane, in one place for every way: a ride of half an hour or more to it gets 30%
      // more, at least 15 minutes (a late train, traffic, a slow boat queue).
      // A timetabled train or bus of half an hour or more with a change gets a spare one: a missed change waits for the next,
      // so the time kept is at least one interval (its own, else E.SPARE_RUN) (Round 2: a change 2 min before back-by).
      if (b.backToShip || b.deadline) for (const o of opts) { if (o.kind === "walk") continue;
        if (o.min < 30) continue;
        const spare = o.ans && o.kind !== "ferry" && changesOf(o.ans) >= 1 ? Math.max(15, +o.ans.every || E.SPARE_RUN) : 0;
        o.slack = Math.max(15, Math.round(o.min * 0.3 / 5) * 5, spare); o.min += o.slack; }
      // The way taken: the traveler's own choice when it is offered; else a walk when it is short enough; else the
      // quickest public way unless a taxi saves a great deal; else the taxi.
      const byKind = k => opts.find(o => o.kind === k);
      const pubs = opts.filter(o => o.kind !== "walk" && o.kind !== "taxi").sort((x, y) => x.min - y.min || x.kind.localeCompare(y.kind));
      const ansPick = wantRaw != null ? opts.find(o => o.ans && String(o.ans.id) === String(wantRaw)) : null;
      let pick = ansPick || (want === "transit" ? pubs.find(o => o.kind !== "ferry") : want != null ? byKind(want) : null), lost = null;
      if (want != null && !pick && !nearOnly) lost = want;
      // On the way to a ship, train or plane the app takes a line on its own only when a timetable answers for it, or it is a
      // metro or tram (they run every few minutes); a train or bus known only from the map stays a choice, said (Nov 20
      // review: the ride back to the ship was planned on a long-distance train no timetable confirmed).
      const auto = ((b.backToShip || b.deadline) ? pubs.filter(o => !o.mapped || o.kind === "metro" || o.kind === "tram") : pubs).filter(o => !o.said);
      if (!pick) { const w = byKind("walk"), t = byKind("taxi");
        // With luggage (to the hotel on arrival, to the station, airport or ship from it) a walk is taken only when it is 10
        // minutes or less (Nov 20 review: 29 minutes on foot with suitcases).
        pick = w && d <= lim && !(b.bags && w.min > E.BAGS_WALK) ? w : auto.length && (!t || E.publicWins(auto[0].min, t.min)) ? auto[0] : t || auto[0] || pubs[0] || w || opts[0]; }
      // A way the guide names that the data doesn't have: said plainly, never planned as if it were known.
      const missing = d > 5 && note ? E.noteKinds(note).filter(k => !opts.some(o => o.kind === k || (k === "train" && (o.kind === "metro" || o.kind === "tram")))) : [];
      // Where each way's time comes from (Nov 19 review: an estimate must never read as a timetable): the timetable, a line
      // on the map (no timetable), the map's roads, the guide's words, or an estimate from the distance.
      for (const o of opts) if (!o.source) o.source = o.ans ? "timetable" : o.mapped ? "map" : "estimate";
      const notes = [];
      if (note && d > 5) notes.push("The guide says: " + note.trim().replace(/\s+/g, " "));
      if (missing.length) notes.push("The guide names " + missing.map(k => k === "ferry" ? "a ferry" : "a " + k).join(" and ") + ", but no timetable for it is known here, so this ride is planned " + (pick.kind === "taxi" ? "by taxi" : "as " + pick.how) + ": check at the " + (missing.includes("ferry") && missing.length === 1 ? "pier" : "station") + " or with your hotel.");
      // The ride back to a ship, train or plane on a time no timetable confirms: said, with the extra time already in it.
      if ((b.backToShip || b.deadline) && pick.kind !== "walk" && pick.source !== "timetable" && pick.min >= 30)
        notes.push("No timetable or live traffic confirms this ride's time: it is an estimate with " + (pick.slack || 0) + " min extra for the " + (b.backToShip ? "ship" : "connection") + ". Leave by the time shown, never later.");
      const options = opts.map(o => Object.assign({ id: o.id, kind: o.kind, mode: E.modeOfKind(o.kind), how: o.how, min: o.min, steps: o.steps || [], source: o.source },
        o.ans ? { ans: o.ans } : {}, o.parts ? { parts: o.parts, cross: o.cross } : {}, o.slack ? { slack: o.slack } : {}, o.transitMode ? { transitMode: o.transitMode } : {}));
      const leg = Object.assign({ mode: E.modeOfKind(pick.kind), kind: pick.kind, how: pick.how, km: pick.km || d, min: pick.min, steps: pick.steps || [], choice: pick.id, options },
        pick.kind !== "walk" && pick.kind !== "taxi" && pick.kind !== "ferry" ? { transitMode: pick.transitMode || (pick.ans && pick.ans.mode) || pick.kind } : {},
        pick.kind === "ferry" ? { cross: pick.cross, pier: pick.pier || E.PIER_MIN, timetable: pick.source === "timetable" } : {}, { source: pick.source },
        pick.parts ? { parts: pick.parts } : {}, pick.first ? { first: pick.first } : {}, pick.ans ? { ans: pick.ans } : {}, pick.slack ? { slack: pick.slack } : {}, pinned ? { pinned: true } : {},
        notes.length ? { note: notes.join(" ") } : {}, lost ? { lost } : {});
      if (options.length < 2) delete leg.options;
      return leg;
    }
    const min = (a, b) => (a && b ? estimate(a, b).min : 0);
    // The same calculator without the traveler's ride choices: the day's order is decided with it, so a ride choice changes
    // the clock, never which place comes first (Nov 18: picking the train made the day run another way round and the
    // choice was refused; Nov 19, Richard's Jul 2: picking the train home sent the day back and forth across a town).
    let plain = null;
    const plainTr = () => { if (!Object.keys(modes).length) return null; if (!plain) plain = E.makeTravel(prefs, null, legs, lines, answers, piers); return plain; };
    const orderMin = (a, b) => { const p = plainTr(); return p ? p.min(a, b) : min(a, b); };
    return { estimate, min, orderMin, plainTr, road: d => Object.assign({ mode: "ride", kind: "taxi", how: "Taxi or car" }, road(d)), saidMin, chosen: (a, b) => modeOf(a, b) != null };
  };
  // The ride as the plan lists it: every fact the screens need, from the one ride record. A walk is just "Walk", except
  // the walk to or from a ferry, which says so ("Walk to the ferry at ..."): the traveler sees where the boat leaves.
  // A timetabled ride is taken only when it runs near the time it is needed. The departures known are a sample: the
  // trips found by three searches of the day (from about 8:00, 12:00 and 16:00, on the trip's date or the same kind of
  // day), grouped by line, so a train known by its own number shows once a day. So "doesn't run then" is said only on
  // strong evidence: a line seen at least E.DEP_MIN times, with nothing for E.DEP_GAP minutes after it is needed, and
  // nothing from the first search's hour either until two hours past it or until two hours before it is needed (Round 2
  // re-check 3: a rest-day bus whose first departure was 5:18 pm). A sample never proves there is no later departure
  // (re-check 4: two weekday trains wrongly dropped), so then the line is kept as planned.
  E.DEP_GAP = 60; E.DEP_MIN = 3; E.DEP_FROM = 8 * 60;
  E.runsAt = (leg, at) => { const a = leg && leg.ans; if (!a || !Array.isArray(a.deps) || !isFinite(at)) return true;
    const ts = a.deps.map(d => d && +d.t).filter(isFinite).sort((x, y) => x - y); if (ts.length < E.DEP_MIN) return true;
    const t0 = at + ((a.access && a.access.min) || 0), nx = ts.find(t => t >= t0); if (nx == null) return true;
    if (nx - t0 <= Math.max(E.DEP_GAP, 2 * (+a.every || 0))) return true;
    const S = E.DEP_FROM, emptyFromS = !ts.some(t => t >= S && t < t0);
    return !(nx - Math.max(t0, S) >= 120 || (emptyFromS && t0 - S >= 120)); };
  E.nextDepAfter = (leg, at) => { const a = leg && leg.ans, t0 = at + ((a && a.access && a.access.min) || 0), nx = a && (a.deps || []).find(d => d && d.t >= t0); return nx ? nx.t : null; };
  E.legAs = (leg, o, why) => { const out = Object.assign({}, leg, { mode: E.modeOfKind(o.kind), kind: o.kind, how: o.how, min: o.min, steps: o.steps || [], choice: o.id, source: o.source },
      why ? { note: (leg.note ? leg.note + " " : "") + why } : {});
    ["ans", "transitMode", "parts", "first", "pinned", "slack", "cross", "timetable"].forEach(k => delete out[k]); if (o.slack) out.slack = o.slack; if (o.ans) out.ans = o.ans; return out; };
  E.rideItem = (leg, extra) => Object.assign({ t: "ride", mode: leg.mode, kind: leg.kind || (leg.mode === "walk" ? "walk" : "taxi"), min: leg.min, km: Math.round((leg.km || 0) * 100) / 100 },
    leg.how && (leg.mode !== "walk" || leg.pierName) ? { how: leg.how } : {}, leg.options ? { options: leg.options } : {}, leg.transitMode ? { transitMode: leg.transitMode } : {},
    leg.choice ? { choice: leg.choice } : {}, leg.steps && leg.steps.length ? { steps: leg.steps } : {}, leg.ans ? { ans: leg.ans } : {}, leg.note ? { note: leg.note } : {},
    leg.lost ? { lost: leg.lost } : {}, leg.source ? { source: leg.source } : {}, leg.guess ? { guess: true } : {}, leg.slack ? { slack: leg.slack } : {}, leg.pierName ? { pierName: leg.pierName } : {}, extra || {});
})(KEngine);
