// ---------- Beta 2 app: the new engine plans every day ----------
// Only in the Beta 2 build (build-beta2.sh sets ENGINE2 and adds src/engine/ and the places files). The app gathers
// its trip bucket (zz-engine-bucket.js), the new engine plans the whole trip from it at once (KEngine.planTrip), and
// each day's plan is handed to the screens in the shape they already read, so every screen shows the new engine's
// plan. In the normal build none of this runs.
if (typeof window !== "undefined" && window.ENGINE2 && window.KEngine) (function () {
  const E = window.KEngine;
  let memo = { k: "", plans: null, bucket: null };
  function keyNow() {
    let t; const a = trip.active, sp = trip.spent; try { trip.active = 0; trip.spent = undefined; t = JSON.stringify(trip); } finally { trip.active = a; trip.spent = sp; }
    // An answer arriving for a ride (a timetable search) replans, as it does in the app.
    return strHash(t) + "|" + dataGen + "|" + (typeof nearGen !== "undefined" ? nearGen : 0) + "|" + citiesSig() + "|" + todayISO();
  }
  // The engine weighs many possible rides: it reads the answers known so far without asking for each one. The rides
  // it keeps are asked for when their day is shown (below), as the app does for its plans; an answer that arrives for
  // one of them changes what the plans used, so they are made again with it.
  const answerOf = (a, b) => { let r; transitPeek = true; try { r = transitFor(a, b); } finally { transitPeek = false; } return r && r.map(o => ({ id: rideId(o), min: o.min, label: o.label, kind: rideKind(o) })); };
  const askRides = ep => { (ep && ep.items || []).forEach(x => { if (x.t === "ride" && x.from && x.to && x.mode !== "walk" && x.mode !== "boat" && x.mode !== "lift") { try { transitFor(x.from, x.to); } catch (e) {} } }); };
  const answerSig = (a, b) => JSON.stringify(answerOf(a, b));
  // The whole trip planned once per change (the traveler's trip, an answer arriving, the guides, the date).
  const stat = { calls: 0, keyMs: 0, bucketMs: 0, checkMs: 0, used: 0, planned: 0 };
  window.__kairouteEngine2Stat = () => Object.assign({}, stat, { used: memo.used ? memo.used.size : 0 });
  function tripPlans() {
    stat.calls++; let t0 = performance.now();
    const k = keyNow(); stat.keyMs += performance.now() - t0;
    if (memo.k === k && memo.plans) return memo;
    // The plans depend only on what the engine is given (the bucket) and the ride answers known so far. Most changes
    // to the trip or answers arriving (weather, a photo, the day being looked at) leave both as they were: then the
    // plans stand and nothing is planned again. Only a real change of the engine's inputs replans.
    t0 = performance.now(); let bucket = engineBucket(false);
    const ik = strHash(JSON.stringify(bucket)) + "|" + todayISO(); // the places files never change while the app runs
    // A ride answer arriving replans only when it is an answer the plans used and it changed (answers for rides the
    // plans never take, arriving all the time while the traveler looks around, change nothing).
    stat.bucketMs += performance.now() - t0; t0 = performance.now();
    const same = memo.ik === ik && memo.plans && [...memo.used.values()].every(u => answerSig(u.a, u.b) === u.sig); stat.checkMs += performance.now() - t0;
    if (same) { memo.k = k; return memo; }
    stat.planned++;
    if (window.PLACES2) bucket = E.applyPlaces(bucket, window.PLACES2);
    // The app's own public transport answers for each ride (asked for any ride not known yet, as in the app).
    const used = new Map();
    bucket.answers = (a, b) => { const r = answerOf(a, b); used.set(a.lat + "," + a.lng + ">" + b.lat + "," + b.lng, { a, b, sig: JSON.stringify(r) }); return r; };
    let plans; try { plans = E.planTrip(bucket); } catch (e) { console.warn("Beta 2 engine", e); plans = []; }
    // A day still on the app's own seeding (the traveler hasn't ticked or unticked anything there) shows what the
    // engine planned: its ticks become the engine's stops, so the picker, the counts and the plan always agree.
    let synced = false;
    trip.days.forEach((d, i) => {
      const ep = plans[i], fresh = !Array.isArray(d.selected);
      if (!ep || ep.error || !Array.isArray(ep.items) || d.ready || (!fresh && (!d.seedSig || d.seedSig !== seedSigOf(d)))) return;
      const ids = ep.items.filter(x => x.t === "stop" && x.id != null).map(x => x.id);
      // A day not seeded yet is seeded here, from the engine's plan (the old planner's background seeding then has
      // nothing left to do): the sights the traveler named become theirs, as seeding does.
      if (fresh) { const c = cityFor(d); if (!c) return; const w = (typeof wantIds === "function" ? wantIds(d, c) : []); d.selected = []; w.forEach(id => markMine(d, id, true)); }
      else if (ids.map(String).sort().join("|") === d.selected.map(String).sort().join("|")) return;
      d.selected = ids; d.seedSig = seedSigOf(d); d.autoEmpty = !ids.length; synced = true;
    });
    // The bucket is the same after the sync (a seeded day sends only the traveler's own picks), so the plans stand.
    memo = { k: synced ? keyNow() : k, ik, used, plans, bucket }; return memo;
  }
  window.__kairouteEngine2 = () => JSON.parse(JSON.stringify(tripPlans().plans));
  const MODE = { walk: "walk", ride: "ride", transit: "ride", boat: "ferry", lift: "ride" };
  const byName = (list, name) => (list || []).find(r => r && r.name === name);
  function toApp(d, city, ep) {
    const w = dayWindow(d, city); if (w.error) return w;
    if (!ep) return { error: "The new engine has no plan for this day." };
    if (ep.error) return { error: ep.error };
    const sites = (city.sites || []).concat(city.farther || []), byId = new Map(sites.map(s => [String(s.id), s]));
    const items = [], stops = [], meals = [], evening = [];
    const at = (x, name, extra) => Object.assign({ name: name || x.name || "", lat: x.lat, lng: x.lng }, extra || {});
    ep.items.forEach((x, k) => {
      if (x.t === "ride") {
        const leg = { mode: MODE[x.mode] || "ride", how: x.how || (x.mode === "walk" ? "Walk" : x.mode === "boat" ? "Boat" : x.mode === "lift" ? "Cable car" : "Taxi or car"), km: x.km || 0, min: x.min || 0 };
        // Drawn and labelled as what it is: a boat as a ferry, a cable car with the rail-like lines (never as a taxi).
        if (x.mode === "boat") leg.kind = "ferry"; else if (x.mode === "lift") leg.kind = "train";
        else if (x.mode === "transit") leg.kind = ({ subway: "train", light_rail: "train", monorail: "train", tram: "train", train: "train", bus: "bus", ferry: "ferry" })[x.transitMode] || "train";
        if (x.options) leg.options = x.options; if (x.from) leg.from = x.from; if (x.to) leg.to = x.to;
        items.push({ type: "travel", leg, time: (items.length ? items[items.length - 1].time + (items[items.length - 1].dur || 0) : ep.start) }); return;
      }
      if (x.t === "start") { items.push({ type: "start", place: Object.assign({}, w.head[0] || at(x)), time: x.at, label: w.startLabel }); return; }
      if (x.t === "end") { items.push({ type: "end", place: Object.assign({}, w.tail[w.tail.length - 1] || at(x)), time: x.at, label: w.endLabel || "Day done" }); return; }
      if (x.t === "fixed") { items.push({ type: "fixed", place: at(x, x.name, { minutes: x.min, fixed: true }), time: x.at }); return; }
      if (x.t === "stop") {
        const s = byId.get(String(x.id)); const p = Object.assign({}, s || at(x), { minutes: x.min });
        p.bonus = !!x.bonus; // the engine's own word: a stop it planned is part of the day, whatever the guide's listing says
        if (x.within) p.within = x.within; if (x.includes) p.includes = x.includes;
        const it = Object.assign({ type: "stop", place: p, time: x.at }, x.wait ? { wait: x.wait } : {}, x.late ? { ohLate: x.late } : {});
        items.push(it); stops.push(it); return;
      }
      if (x.t === "meal" || x.t === "evening") {
        const label = x.meal || "Lunch", m = MEALS.find(z => z.label === label) || MEALS[0];
        const r = Object.assign({}, byName(city.restaurants, x.name) || at(x), { alts: [] });
        const it = { type: x.t === "evening" ? "evening" : "meal", meal: Object.assign({}, m, { len: x.min || m.len }), place: r, time: x.at };
        items.push(it); (x.t === "evening" ? evening : meals).push(x.t === "evening" ? it : r);
      }
    });
    // The rides' clock: each starts where the item before it ends.
    items.forEach((it, k) => { if (it.type !== "travel") return; const p = items[k - 1]; if (p) it.time = p.time + (p.type === "meal" ? p.meal.len : p.place && p.place.minutes || 0); });
    const dropped = (ep.dropped || []).map(id => byId.get(String(id))).filter(Boolean);
    const walkKm = items.filter(i => i.type === "travel" && i.leg.mode === "walk").reduce((a, i) => a + (i.leg.km || 0), 0);
    return { city, w: Object.assign({}, w, { start: ep.start, endBy: ep.endBy }), items, stops, dropped, folded: [], elsewhere: [], quickMeals: false, along: [], bonus: [], fill: [],
      meals, evening, swaps: [], closedToday: [], lock: { t: null, seq: stops.map(s => s.place.id), late: 0, quick: false, eve: "" }, locked: false, seen: false, seenBroke: false, seenSkipped: [],
      lockBroken: false, routeX: null, start: ep.start, endBy: ep.endBy, end: ep.end, walkKm, over: !!ep.over,
      engine2: { explain: ep.explain || [], waysToFit: ep.waysToFit || null, leftOut: ep.leftOut || [], safe: !!ep.safe } };
  }
  // The engine chooses each untouched day's stops, so the old planner's late hand-out of a day trip stays off.
  if (typeof leadLate === "function") leadLate = function () {};
  const oldDay = buildPlanForDay;
  buildPlanForDay = function (d) {
    const city = cityFor(d); if (!city) return null;
    const i = trip.days.indexOf(d); if (i < 0) return oldDay(d); // a day outside the trip (a preview): the old planner
    try { const ep = tripPlans().plans[i]; askRides(ep); return toApp(d, city, ep); } catch (e) { console.warn("Beta 2 day", e); return oldDay(d); }
  };
})();
