// Beta 2 engine, part 1: minutes between two places.
// Two kinds of answer, kept apart on purpose (lesson 1: plans drifted as ride answers arrived):
//  - estimate(a, b): the stable estimate from distance, the traveler's walking limit, their walk-or-ride choice and the
//    guide's own ride note. Used for every decision: which sights fit, which day, what order. It never changes as
//    answers arrive, so the plan's shape never does.
//  - live times (real timetables) only set the clock in the timeline (part 9), and can only flag a stop, not reorder.
(function (E) {
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
  E.makeTravel = (prefs, legModes) => {
    const walk = (prefs && prefs.walk) || "medium", lim = WALK_LIMIT[walk] || WALK_LIMIT.medium, speed = walk === "low" ? 3.6 : 4.5, modes = legModes || {}, memo = new Map();
    function estimate(a, b) {
      if (!a || !b || !isFinite(a.lat) || !isFinite(b.lat)) return { mode: "walk", how: "Walk", km: 0, min: 0, unknown: true };
      const key = a.lat + "," + a.lng + "," + b.lat + "," + b.lng + (b.backToShip || b.deadline ? "!" : ""); const got = memo.get(key); if (got) return got;
      const v = calc(a, b); memo.set(key, Object.freeze(v)); return v;
    }
    function calc(a, b) {
      const d = E.hav(a, b);
      if (d < 0.02) return { mode: "walk", how: "Walk", km: 0, min: 0 };
      const walkMin = Math.max(2, Math.round(d * 1.3 / speed * 60)), either = d >= 0.6 && d <= WALK_EITHER, want = either ? modes[E.pairKey(a, b)] : null;
      if (d <= lim ? !want || want === "walk" : want === "walk") return { mode: "walk", how: "Walk", km: d * 1.3, min: walkMin, either };
      let leg = road(d); leg.either = either;
      if (d > 15) { // a day trip: the guide's own note on how long it takes wins over the estimate, plus getting to the station or pier
        const sa = saidMin(a.travelNote), sb = saidMin(b.travelNote), said = Math.max(sa, sb);
        if (said && !(sa && sb)) leg = Object.assign(leg, { min: Math.max(leg.min, said + 15), said: true });
      }
      // A long ride (over 15 km) to a ship, train or plane gets time for a late train or traffic: 30% more, at least 15 minutes.
      if (d > 15 && (b.backToShip || b.deadline) && leg.min >= 30) { const sl = Math.max(15, Math.round(leg.min * 0.3 / 5) * 5); leg = Object.assign(leg, { min: leg.min + sl, slack: sl }); }
      return leg;
    }
    const min = (a, b) => (a && b ? estimate(a, b).min : 0);
    return { estimate, min, road, saidMin };
  };
})(KEngine);
