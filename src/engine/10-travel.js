// Beta 2 engine, part 1: minutes between two places.
// Two kinds of answer, kept apart on purpose (lesson 1: plans drifted as ride answers arrived):
//  - estimate(a, b): the stable estimate from distance, the traveler's walking limit, their walk-or-ride choice and the
//    guide's own ride note. Used for every decision: which sights fit, which day, what order. It never changes as
//    answers arrive, so the plan's shape never does.
//  - live times (real timetables) only set the clock in the timeline (part 9), and can only flag a stop, not reorder.
(function (E) {
  E.PIER_MIN = 15; // at the pier: buying a ticket, boarding, and the wait for the next sailing
  E.BOAT = /\b(boat|boats|ferry|ferries|hydrofoil|catamaran|water ?bus|vaporetto)\b/i;
  // Reached only by water: the note names a boat and no way by land (a note offering a train, bus, car or walk too is a
  // place on the mainland). "Water taxi" is a boat, not a taxi.
  const LAND = /\b(train|rail|metro|tram|bus|coach|car|road|drive|taxi|cab|walk|hike|bridge|causeway)\b/i;
  // Seen only from the water (an islet, a sea cave): its access or tickets say so.
  E.waterOnly = s => !!s && /\b(viewed|seen|viewable|visible) from (the )?(water|sea|a boat|boat)|\bonly (by|from) (boat|sea)\b|\bboat tours? only\b/i.test(String(s.access || ""));
  E.byBoat = note => { const n = String(note || "").replace(/water ?taxi/gi, "boat"); return E.BOAT.test(n) && !LAND.test(n); };
  // Every way a guide's ride note names, each with its own time: "40 minutes by ferry, or 1 hour on the Circumvesuviana
  // train" is a ferry (40 min) and a train (60 min), not one ride of an hour. A way named without a time ("or by car")
  // is a ride by road, timed like any other. [{ id: "boat" | "transit" | "taxi", kind, how, said }]
  E.noteWays = note => {
    const out = [];
    for (const part of String(note || "").split(/;|,?\s+\bor\b\s+|\.\s+/i)) {
      const c = part.replace(/water ?taxi/gi, "boat"), said = saidMin(c);
      if (E.BOAT.test(c)) out.push({ id: "boat", kind: "ferry", how: /high.?speed|fast ferry|hydrofoil|catamaran/i.test(c) ? "Fast ferry" : /ferry|ferries/i.test(c) ? "Ferry" : "Boat", said });
      else if (/\b(train|rail|railway|metro|tram)\b/i.test(c)) { const nm = /\b([A-Z][\w'-]+)\s+(train|railway|line)\b/.exec(c); out.push({ id: "transit", kind: "train", how: nm && !/^(The|A|An|By|On|Take|Fast|Slow|Regional|Local)$/.test(nm[1]) ? nm[1] + " train" : "Train", said }); }
      else if (/\b(bus|coach)\b/i.test(c)) out.push({ id: "transit", kind: "bus", how: "Bus", said });
      else if (/\b(car|taxi|cab|drive|road)\b/i.test(c.replace(/cable ?cars?|funiculars?|rack railway/gi, ""))) out.push({ id: "taxi", kind: "car", how: "Taxi or car", said });
    }
    // One of each way (the quickest named), timed ones only for public transport.
    const seen = new Map(); for (const w of out) { const k = w.id + w.kind, o = seen.get(k); if (!o || (w.said && (!o.said || w.said < o.said))) seen.set(k, w); }
    return [...seen.values()];
  };
  const WALK_LIMIT = { low: 0.8, medium: 1.7, high: 3.2 }, WALK_EITHER = 4;
  // By road (taxi, car or bus) for d km as the crow flies: town streets, regional roads, then highway.
  function road(d) {
    if (d <= 6) return { mode: "ride", how: "Taxi or car", km: d * 1.3, min: Math.round(10 + d * 1.3 / 22 * 60) };
    if (d <= 15) return { mode: "ride", how: "Taxi or car", km: d * 1.3, min: Math.round(10 + d * 1.3 / 25 * 60) };
    return d <= 40 ? { mode: "ride", how: "Train or car", km: d * 1.35, min: Math.round(15 + d * 1.35 / 45 * 60) }
      : { mode: "ride", how: "Train or car", km: d * 1.25, min: Math.round(15 + d * 1.25 / 85 * 60) };
  }
  // The longest time a guide's ride note names ("1 hour on the train", "60-75 min"), 10 to 300 minutes, else 0.
  function saidMin(note) {
    const low = String(note || "").toLowerCase(); if (!low) return 0; let m = 0;
    for (const x of low.matchAll(/(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|h\b|minutes?|mins?\b|min\b)/g)) m = Math.max(m, +x[2] * (/^h/.test(x[3]) ? 60 : 1));
    for (const x of low.matchAll(/(\d+(?:\.\d+)?|an|one|half an)\s*(hours?|hrs?|h\b|minutes?|mins?\b|min\b)/g)) { const n = x[1] === "an" || x[1] === "one" ? 1 : x[1] === "half an" ? 0.5 : +x[1]; m = Math.max(m, n * (/^h/.test(x[2]) ? 60 : 1)); }
    for (const x of low.matchAll(/(\d+)\s*h(?:ours?|rs?)?\s*(\d+)\s*m/g)) m = Math.max(m, +x[1] * 60 + +x[2]);
    return m >= 10 && m <= 300 ? Math.round(m) : 0;
  }
  // A travel calculator for one trip's preferences. Pure and memoised per pair (the same pair always gives the same answer).
  // legs: pinned network times from the places database, keyed by pairKey (step change, Nov 18: decisions use real
  // walking, road and ferry times, pinned so they stay steady; the straight-line estimate is only the fallback).
  // lines: public transport lines from the places files (part 1b); every leg they serve offers them as a choice.
  // answers(a, b): the app's own public transport answers for a ride, as the app keeps them (a timetable search per ride,
  // [{ min, label, kind }]), or null. A known line is taken unless a taxi saves a lot (over 25 minutes and a third of
  // the time), the same rule the app uses: cheaper, and no traffic. The traveler's own choice always wins.
  E.publicWins = (pub, roadMin) => !(roadMin < pub - 25 && roadMin < pub * 0.67);
  E.makeTravel = (prefs, legModes, legs, lines, answers) => {
    const walk = (prefs && prefs.walk) || "medium", lim = WALK_LIMIT[walk] || WALK_LIMIT.medium, speed = walk === "low" ? 3.6 : 4.5, modes = legModes || {}, memo = new Map(), memoEnd = new Map(), trains = (lines || []).filter(l => l.mode === "train");
    // The traveler's ride choice belongs to the two places, whichever way the day goes between them (Nov 18: the train
    // picked from Sorrento to Pompeii was lost when the day ran Pompeii first).
    // A ride from the lunch place next door, or from a sight beside the place, is still that ride: a choice also holds
    // for any two points each within a short walk (1.5 km) of its two places, on a ride long enough to need one (over 5 km).
    const chosenPairs = Object.keys(modes).map(k => { const v = k.split(",").map(Number); return v.length === 4 && v.every(isFinite) ? { a: { lat: v[0], lng: v[1] }, b: { lat: v[2], lng: v[3] }, m: modes[k] } : null; }).filter(Boolean);
    const modeOf = (a, b) => { const k = modes[E.pairKey(a, b)]; if (k != null) return k; const r = modes[E.pairKey(b, a)]; if (r != null) return r;
      if (!chosenPairs.length || !a || !b || E.hav(a, b) < 5) return undefined;
      // (each end within 1.5 km, or a fifth of the ride: the ride out to a town 80 km away and its sights around it is the same from any hotel in the city)
      const tol = Math.max(1.5, E.hav(a, b) / 5), c = chosenPairs.find(p => (E.hav(p.a, a) <= tol && E.hav(p.b, b) <= tol) || (E.hav(p.a, b) <= tol && E.hav(p.b, a) <= tol)); return c ? c.m : undefined; };
    function estimate(a, b) {
      if (!a || !b || !isFinite(a.lat) || !isFinite(b.lat)) return { mode: "walk", how: "Walk", km: 0, min: 0, unknown: true };
      // The cable car (or funicular) between a landing and the town above: its own fixed step holds the time.
      const lift = (p, q) => p.viaLift && E.hav(q, p.viaLift) < 0.05;
      if (lift(a, b) || lift(b, a)) return { mode: "lift", how: (a.viaLift || b.viaLift).name || "Cable car", km: 0, min: 0 };
      // Remembered by the four coordinates (numbers make fast keys), apart for legs that end at a deadline.
      let m = (b.backToShip || b.deadline) ? memoEnd : memo;
      for (const x of [a.lat, a.lng, b.lat]) { let n = m.get(x); if (!n) { n = new Map(); m.set(x, n); } m = n; }
      const got = m.get(b.lng); if (got) return got;
      const v = Object.freeze(calc(a, b)); m.set(b.lng, v); return v;
    }
    // The leg as planned, plus every way to make it (walk, public transport, taxi) so the traveler can choose.
    function calc(a, b) {
      const leg0 = base(a, b), d = E.hav(a, b), leg = known(a, b, leg0, d);
      if (leg !== leg0) return leg;
      if (!lines || !lines.length || d < 0.6 || leg.pinned || leg.mode === "boat" || leg.mode === "lift" || (leg.said && leg.options)) return leg; // the guide's own ways stand
      // A day trip out of town: a train that serves both ends (a taxi from the station at either end) is offered, and
      // taken unless a taxi saves a lot (the app's rule, above). A ride to a ship, train
      // or plane keeps its extra time either way.
      if (d > 15) {
        const t = E.transitOption(a, b, trains, km => Math.max(1, Math.round(km * 1.3 / speed * 60)), { km: 12, taxiMin: km => road(km).min });
        if (!t) return leg;
        const sl = leg.slack || 0, tmin = t.min + sl, options = [{ id: "transit", mode: "transit", kind: "train", how: t.how, min: tmin }, { id: "taxi", mode: "ride", kind: "car", how: leg.how, min: leg.min }];
        const want = modeOf(a, b);
        if (want === "ride" || want === "taxi" || (want !== "transit" && !E.publicWins(tmin, leg.min))) return Object.assign(leg, { options, choice: "taxi" });
        return { mode: "transit", transitMode: t.mode, how: t.how, km: leg.km, min: tmin, slack: sl || undefined, options, choice: "transit" };
      }
      const walkMin = km => Math.max(1, Math.round(km * 1.3 / speed * 60)), onFoot = walkMin(d);
      // A leg short enough to walk offers the line only when it is quicker than walking; a leg too far to walk weighs it
      // against the taxi instead (an uphill walk from the station can make it slower than the whole walk, never than a taxi).
      const t = E.transitOption(a, b, lines, walkMin); if (!t || (leg.mode !== "ride" && t.min >= onFoot)) return leg;
      const taxi = road(d), want = modeOf(a, b);
      const options = [{ id: "walk", mode: "walk", kind: "walk", how: "Walk", min: onFoot }, { id: "transit", mode: "transit", kind: t.mode === "tram" ? "tram" : "train", how: t.how, min: t.min }, { id: "taxi", mode: "ride", kind: "car", how: taxi.how, min: taxi.min }];
      // Too far to walk: public transport is taken unless a taxi saves a lot (the same rule as everywhere: cheaper, no
      // traffic); the traveler's own choice always wins.
      const tooFar = leg.mode === "ride" && want !== "ride" && want !== "taxi" && want !== "walk" && E.publicWins(t.min, taxi.min);
      if (want === "transit" || tooFar) return { mode: "transit", transitMode: t.mode, how: t.how, km: d * 1.3, min: t.min, either: true, options, choice: "transit" };
      return Object.assign(leg, { options, either: true, choice: leg.mode === "walk" ? "walk" : "taxi" });
    }
    function known(a, b, leg, d) {
      if (!answers || d < 1.5 || leg.pinned || leg.mode === "boat" || leg.mode === "lift" || leg.mode === "walk") return leg;
      const got = (answers(a, b) || []).filter(o => o && isFinite(o.min)).sort((x, y) => x.min - y.min || String(x.label).localeCompare(String(y.label)));
      if (!got.length) return leg;
      const want = modeOf(a, b), o = got.find(x => x.id != null && x.id === want) || got[0], sl = leg.slack || 0, pub = o.min + sl;
      const boats = (leg.options || []).filter(x => x.mode === "boat"); // a ferry the guide names stays a choice beside the timetable answers
      const options = got.slice(0, 3).map(x => ({ id: x.id != null ? String(x.id) : "transit", mode: "transit", transitMode: x.kind, kind: x.kind, how: E.latin(x.label), min: x.min + sl })).concat(boats, [{ id: "taxi", mode: "ride", kind: "car", how: "Taxi or car", min: leg.min }]);
      if (want === "taxi" || want === "ride" || (want !== "transit" && o.id !== want && !E.publicWins(pub, leg.min))) return Object.assign({}, leg, { how: "Taxi or car", options, choice: "taxi" });
      return { mode: "transit", transitMode: o.kind, how: E.latin(o.label), km: leg.km, min: pub, slack: sl || undefined, options, choice: o.id != null ? String(o.id) : "transit" };
    }
    function base(a, b) {
      const pin = legs && legs[E.pairKey(a, b)];
      if (pin && isFinite(pin.min)) { let leg = { mode: pin.mode || "ride", how: pin.how || "Ride", km: pin.km || 0, min: Math.round(pin.min), pinned: true };
        if ((b.backToShip || b.deadline) && leg.min >= 30 && leg.mode !== "walk") { const sl = Math.max(15, Math.round(leg.min * 0.3 / 5) * 5); leg = Object.assign(leg, { min: leg.min + sl, slack: sl }); }
        return leg; }
      const d = E.hav(a, b);
      if (d < 0.02) return { mode: "walk", how: "Walk", km: 0, min: 0 };
      // Across water: a place the guide says is reached by boat is always reached by boat (never a taxi or a walk), on
      // the boat's own timetable: the crossing the guide names, plus 20 minutes for the pier and the wait for a sailing.
      // To a ship, train or plane it gets the same extra time as any long ride.
      const byBoat = p => E.byBoat(p.travelNote) || E.waterOnly(p);
      if (byBoat(a) !== byBoat(b) && d > 1) {
        const note = byBoat(a) ? a.travelNote : b.travelNote, said = saidMin(note) || Math.round(d / 25 * 60) + 10;
        const how = /high.?speed|fast ferry|hydrofoil|catamaran/i.test(note) ? "Fast ferry" : /ferry/i.test(note) ? "Ferry" : "Boat";
        let leg = { mode: "boat", how: how + ", " + said + " min crossing, plus " + E.PIER_MIN + " min at the pier for the next sailing", km: d, min: said + E.PIER_MIN, cross: said, pier: E.PIER_MIN, timetable: true };
        if (b.backToShip || b.deadline) { const sl = Math.max(15, Math.round(leg.min * 0.3 / 5) * 5); leg = Object.assign(leg, { min: leg.min + sl, slack: sl }); }
        return leg;
      }
      const walkMin = Math.max(2, Math.round(d * 1.3 / speed * 60)), either = d >= 0.6 && d <= WALK_EITHER, want = either ? modeOf(a, b) : null;
      if (d <= lim ? !want || want === "walk" : want === "walk") return { mode: "walk", how: "Walk", km: d * 1.3, min: walkMin, either };
      let leg = road(d); leg.either = either;
      if (d > 15) { // a day trip: the guide's own note on how to get there, from the place's own base (port, hotel, town)
        // A note tells how to get out to a sight from the place itself, so it is read only for a ride between the two:
        // a ride from one trip out to another (Sorrento to Pompeii) is planned from the map, never from either note.
        const note = a.travelNote && !b.travelNote ? a.travelNote : b.travelNote && !a.travelNote ? b.travelNote : "";
        const ways = E.noteWays(note).filter(w => w.said || w.id === "taxi"), taxi = Object.assign({}, leg, { how: "Taxi or car" });
        // Every way the guide names is a choice of its own, with its own time: a ferry (its crossing, plus the pier and the
        // wait for a sailing), a train or bus (its ride, plus getting to the station), and a taxi or car by road.
        const opts = ways.filter(w => w.id !== "taxi").map(w => w.id === "boat"
          ? { id: "boat", mode: "boat", kind: "ferry", how: w.how + ", " + w.said + " min crossing, plus " + E.PIER_MIN + " min at the pier for the next sailing", min: w.said + E.PIER_MIN, cross: w.said, timetable: true }
          : { id: "transit", mode: "transit", transitMode: w.kind, kind: w.kind, how: w.how + ", " + w.said + " min, plus 15 to get to the station", min: w.said + 15 });
        if (opts.length) {
          const all = opts.concat([{ id: "taxi", mode: "ride", kind: "car", how: "Taxi or car", min: taxi.min }]), wantNow = modeOf(a, b);
          const best = opts.slice().sort((x, y) => x.min - y.min || x.id.localeCompare(y.id))[0];
          // The traveler's own choice wins; else the quickest public way, unless a taxi saves a lot (the app's rule).
          const pick = all.find(o => o.id === wantNow) || (E.publicWins(best.min, taxi.min) ? best : all[all.length - 1]);
          const options = all.map(o => ({ id: o.id, mode: o.mode, how: o.how, min: o.min, kind: o.kind }));
          leg = pick.mode === "ride" ? Object.assign(taxi, { options, choice: "taxi", said: true })
            : Object.assign({ mode: pick.mode, how: pick.how, km: d * 1.3, min: pick.min, options, choice: pick.id, said: true }, pick.mode === "boat" ? { cross: pick.cross, pier: E.PIER_MIN, timetable: true } : { transitMode: pick.transitMode });
        } else {
          // A note with a time and no way named ("about an hour"): the guide's time wins over the estimate.
          const said = saidMin(note);
          if (said) leg = Object.assign(leg, said + 15 >= leg.min ? { min: said + 15, said: true, how: leg.how + ": " + said + " min as the guide says, plus 15 to get going" } : { said: true });
        }
      }
      // A long ride (over 15 km) to a ship, train or plane gets time for a late train or traffic: 30% more, at least 15 minutes.
      if (d > 15 && (b.backToShip || b.deadline) && leg.min >= 30) { const sl = Math.max(15, Math.round(leg.min * 0.3 / 5) * 5); leg = Object.assign(leg, { min: leg.min + sl, slack: sl }); }
      return leg;
    }
    const min = (a, b) => (a && b ? estimate(a, b).min : 0);
    return { estimate, min, road, saidMin, chosen: (a, b) => modeOf(a, b) != null };
  };
})(KEngine);
