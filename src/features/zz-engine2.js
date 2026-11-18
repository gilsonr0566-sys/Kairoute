// ---------- Beta 2 app: the new engine plans every day ----------
// Only in the Beta 2 build (build-beta2.sh sets ENGINE2 and adds src/engine/ and the places files). The app gathers
// its trip bucket (zz-engine-bucket.js), the new engine plans the whole trip from it at once (KEngine.planTrip), and
// each day's plan is handed to the screens in the shape they already read, so every screen shows the new engine's
// plan. In the normal build none of this runs.
if (typeof window !== "undefined" && window.ENGINE2 && window.KEngine) (function () {
  const E = window.KEngine;
  let memo = { k: "", plans: null, bucket: null };
  // The whole trip planned once per change (the traveler's trip, an answer arriving, the guides, the date).
  function tripPlans() {
    let t; const a = trip.active, sp = trip.spent; try { trip.active = 0; trip.spent = undefined; t = JSON.stringify(trip); } finally { trip.active = a; trip.spent = sp; }
    const k = strHash(t) + "|" + dataGen + "|" + citiesSig() + "|" + todayISO();
    if (memo.k === k && memo.plans) return memo;
    let bucket = engineBucket(false);
    if (window.PLACES2) bucket = E.applyPlaces(bucket, window.PLACES2);
    let plans; try { plans = E.planTrip(bucket); } catch (e) { console.warn("Beta 2 engine", e); plans = []; }
    memo = { k, plans, bucket }; return memo;
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
        if (x.options) leg.options = x.options; if (x.from) leg.from = x.from; if (x.to) leg.to = x.to;
        items.push({ type: "travel", leg, time: (items.length ? items[items.length - 1].time + (items[items.length - 1].dur || 0) : ep.start) }); return;
      }
      if (x.t === "start") { items.push({ type: "start", place: Object.assign({}, w.head[0] || at(x)), time: x.at, label: w.startLabel }); return; }
      if (x.t === "end") { items.push({ type: "end", place: Object.assign({}, w.tail[w.tail.length - 1] || at(x)), time: x.at, label: w.endLabel || "Day done" }); return; }
      if (x.t === "fixed") { items.push({ type: "fixed", place: at(x, x.name, { minutes: x.min, fixed: true }), time: x.at }); return; }
      if (x.t === "stop") {
        const s = byId.get(String(x.id)); const p = Object.assign({}, s || at(x), { minutes: x.min });
        p.bonus = !!x.bonus; // the engine's own word: a stop it planned is part of the day, whatever the guide's listing says if (x.within) p.within = x.within; if (x.includes) p.includes = x.includes;
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
  const oldDay = buildPlanForDay;
  buildPlanForDay = function (d) {
    const city = cityFor(d); if (!city) return null;
    const i = trip.days.indexOf(d); if (i < 0) return oldDay(d); // a day outside the trip (a preview): the old planner
    try { return toApp(d, city, tripPlans().plans[i]); } catch (e) { console.warn("Beta 2 day", e); return oldDay(d); }
  };
})();
