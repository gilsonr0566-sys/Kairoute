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
    const walk = (prefs && prefs.walk) || "medium", lim = WALK_LIMIT[walk] || WALK_LIMIT.medium, speed = walk === "low" ? 3.6 : 4.5, modes = legModes || {}, memo = new Map(), memoEnd = new Map();
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
      if (!lines || !lines.length || d < 0.6 || leg.pinned || leg.mode === "boat" || leg.mode === "lift") return leg;
      // A day trip out of town: a train that serves both ends (a taxi from the station at either end) is offered, and
      // taken unless a taxi saves a lot (the app's rule, above). A ride to a ship, train
      // or plane keeps its extra time either way.
      if (d > 15) {
        const t = E.transitOption(a, b, lines.filter(l => l.mode === "train"), km => Math.max(1, Math.round(km * 1.3 / speed * 60)), { km: 12, taxiMin: km => road(km).min });
        if (!t) return leg;
        const sl = leg.slack || 0, tmin = t.min + sl, options = [{ mode: "transit", how: t.how, min: tmin }, { mode: "ride", how: leg.how, min: leg.min }];
        const want = modes[E.pairKey(a, b)];
        if (want === "ride" || want === "taxi" || (want !== "transit" && !E.publicWins(tmin, leg.min))) return Object.assign(leg, { options });
        return { mode: "transit", transitMode: t.mode, how: t.how, km: leg.km, min: tmin, slack: sl || undefined, options };
      }
      const walkMin = km => Math.max(1, Math.round(km * 1.3 / speed * 60)), onFoot = walkMin(d);
      const t = E.transitOption(a, b, lines, walkMin); if (!t || t.min >= onFoot) return leg;
      const taxi = road(d), want = modes[E.pairKey(a, b)];
      const options = [{ mode: "walk", how: "Walk", min: onFoot }, { mode: "transit", how: t.how, min: t.min }, { mode: "ride", how: taxi.how, min: taxi.min }];
      if (want === "transit") return { mode: "transit", transitMode: t.mode, how: t.how, km: d * 1.3, min: t.min, either: true, options };
      return Object.assign(leg, { options, either: true });
    }
    function known(a, b, leg, d) {
      if (!answers || d < 1.5 || leg.pinned || leg.mode === "boat" || leg.mode === "lift" || leg.mode === "walk") return leg;
      const got = (answers(a, b) || []).filter(o => o && isFinite(o.min)).sort((x, y) => x.min - y.min || String(x.label).localeCompare(String(y.label)));
      if (!got.length) return leg;
      const want = modes[E.pairKey(a, b)], o = got.find(x => x.id != null && x.id === want) || got[0], sl = leg.slack || 0, pub = o.min + sl;
      const options = got.slice(0, 3).map(x => ({ mode: "transit", transitMode: x.kind, how: E.latin(x.label), min: x.min + sl })).concat([{ mode: "ride", how: "Taxi or car", min: leg.min }]);
      if (want === "taxi" || want === "ride" || (want !== "transit" && o.id !== want && !E.publicWins(pub, leg.min))) return Object.assign({}, leg, { how: "Taxi or car", options });
      return { mode: "transit", transitMode: o.kind, how: E.latin(o.label), km: leg.km, min: pub, slack: sl || undefined, options };
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
      const walkMin = Math.max(2, Math.round(d * 1.3 / speed * 60)), either = d >= 0.6 && d <= WALK_EITHER, want = either ? modes[E.pairKey(a, b)] : null;
      if (d <= lim ? !want || want === "walk" : want === "walk") return { mode: "walk", how: "Walk", km: d * 1.3, min: walkMin, either };
      let leg = road(d); leg.either = either;
      if (d > 15) { // a day trip: the guide's own note on how long it takes wins over the estimate, plus getting to the station or pier
        const sa = saidMin(a.travelNote), sb = saidMin(b.travelNote), said = Math.max(sa, sb);
        // and the ride says where its time comes from, so it matches the sight's own note ("Bus or car, 50-60 min").
        if (said && !(sa && sb)) leg = Object.assign(leg, said + 15 >= leg.min ? { min: said + 15, said: true, how: leg.how + ": " + said + " min as the guide says, plus 15 to get going" } : { said: true });
      }
      // A long ride (over 15 km) to a ship, train or plane gets time for a late train or traffic: 30% more, at least 15 minutes.
      if (d > 15 && (b.backToShip || b.deadline) && leg.min >= 30) { const sl = Math.max(15, Math.round(leg.min * 0.3 / 5) * 5); leg = Object.assign(leg, { min: leg.min + sl, slack: sl }); }
      return leg;
    }
    const min = (a, b) => (a && b ? estimate(a, b).min : 0);
    return { estimate, min, road, saidMin };
  };
})(KEngine);
