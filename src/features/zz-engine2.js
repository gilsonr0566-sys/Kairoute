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
  // The timetable answers as they are: the engine keeps one per kind of ride (part 1) and carries the chosen one's
  // steps, departures and line on the ride itself.
  // The whole trip is planned at once, so the answers read never depend on which day happens to be on screen (Nov 19,
  // Richard's Jul 2: the Athens to Corinth train was kept under Friday's timetable and read under another day's, so it
  // vanished, and the train he then picked "wasn't known"). Each ride reads the answer kept for the trip's own dates,
  // in date order, the first one found (a Friday ride on a Friday's timetable when the trip has one).
  // One date for each kind of timetable day (weekday, Saturday, Sunday) in the trip, earliest first: three looks at most.
  const tripDates = () => { const seen = new Map(); for (const dt of (trip.days || []).map(d => d.date).filter(Boolean).sort()) { const t = Date.parse(dt + "T12:00:00Z"); if (!isFinite(t)) continue; const k = dayKind(new Date(t).getUTCDay()); if (!seen.has(k)) seen.set(k, dt); } return [...seen.values()]; };
  // Asked for thousands of rides on every replan: each pair's answer is kept until an answer arrives (nearGen) or the
  // trip's dates change.
  let peekMemo = new Map(), peekGen = "";
  const peek = (a, b) => { const g = nearGen + "|" + (trip.days || []).length + "|" + ((trip.days || [])[0] || {}).date; if (g !== peekGen) { peekGen = g; peekMemo = new Map(); }
    const k = a.lat + "," + a.lng + ">" + b.lat + "," + b.lng; if (peekMemo.has(k)) return peekMemo.get(k);
    const was = planDate; let r = null; transitPeek = true;
    try { for (const dt of tripDates().concat([null])) { planDate = dt; r = transitFor(a, b); if (r && r.length) break; } } finally { transitPeek = false; planDate = was; }
    if (peekMemo.size > 50000) peekMemo.clear(); peekMemo.set(k, r); return r; };
  const answerOf = (a, b) => { const r = peek(a, b); return r && r.map(o => Object.assign({}, o, { id: rideId(o), kind: rideKind(o) })); };
  const askRides = ep => { (ep && ep.items || []).forEach(x => { if (x.t === "ride" && x.from && x.to && x.mode !== "walk" && x.mode !== "boat" && x.mode !== "lift") { try { transitFor(x.from, x.to); } catch (e) {} } }); };
  const answerSig = (a, b) => JSON.stringify((peek(a, b) || []).map(o => [rideId(o), o.min, o.label]));
  // The whole trip planned once per change (the traveler's trip, an answer arriving, the guides, the date).
  const recent = new Map(), recentAlone = new Map(); // the quick checks' plans kept apart (see alonePlans)
  const stat = { calls: 0, keyMs: 0, bucketMs: 0, checkMs: 0, used: 0, planned: 0 };
  window.__kairouteEngine2Stat = () => Object.assign({}, stat, { used: memo.used ? memo.used.size : 0 });
  // Every sight the engine may plan is one the traveler can see and tick: the sights the places files add (the travel
  // guide's own listings, a day-trip town's sights) join the app's guide once, as the engine sees them (Nov 18: Naples
  // gained 30 sights the engine planned while the list never showed them, so an emptied day could not be emptied).
  function guideFromPlaces(bucket) {
    const seenC = new Set();
    trip.days.forEach(d => { const city = cityFor(d); if (!city || seenC.has(city)) return; seenC.add(city);
      const bc = bucket.cities && bucket.cities[keyOf(city.city)]; if (!bc) return;
      const have = new Set(allSites(city).map(x => String(x.id)));
      const app = (s, far) => Object.assign({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, minutes: s.minutes || 30, category: s.category || "Sight", summary: s.blurb || "",
        mustSee: false, quick: false, unesco: !!s.unesco, fromPlaces: true }, far ? { far: true, town: s.town, townName: s.townName, travel: s.travelNote || "" } : {}, s.web ? { web: s.web } : {});
      const addS = (bc.sites || []).filter(s => !have.has(String(s.id)) && isFinite(s.lat)), addF = (bc.farther || []).filter(s => !have.has(String(s.id)) && isFinite(s.lat));
      if (addS.length) city.sites = (city.sites || []).concat(addS.map(s => app(s, false)));
      if (addF.length) city.farther = (city.farther || []).concat(addF.map(s => app(s, true))); });
  }
  // A quick "does it fit?" check from the Sights list plans the day being checked on its own (the other days of its place
  // still decide which picks move where, but are not planned): planning every other day of the place again for each card made the list keep
  // a phone busy for half a minute after a tick (Nov 20 sweep, Madrid). Only for the list's marks; a tick plans in full.
  let alone = null;
  window.__kairouteAlone = (d, fn) => { const was = alone; alone = d; try { return fn(); } finally { alone = was; } };
  function alonePlans() {
    const ai = trip.days.indexOf(alone), k = keyNow() + "|alone:" + ai, m = recentAlone.get(k); if (m) { recentAlone.delete(k); recentAlone.set(k, m); return m; }
    let bucket = engineBucket(false);
    // Only the guides of the day's own place (and places sharing a sight with it) are needed: the trip's other places
    // aren't planned, so they aren't copied either.
    bucket.cities = E.citiesFor(bucket, ai);
    if (window.PLACES2) { bucket = E.applyPlaces(bucket, window.PLACES2); guideFromPlaces(bucket); }
    bucket.days = bucket.days.map((x, i) => i === ai ? Object.assign({}, x, { alone: true }) : x);
    bucket.answers = (a, b) => answerOf(a, b);
    let plans; try { plans = E.planTrip(bucket); } catch (e) { console.warn("Beta 2 engine", e); plans = []; }
    const mm = { k, plans, bucket, used: new Map() }; recentAlone.set(k, mm); if (recentAlone.size > 40) recentAlone.delete(recentAlone.keys().next().value); return mm;
  }
  function tripPlans() {
    if (alone && trip.days.includes(alone)) return alonePlans();
    stat.calls++; let t0 = performance.now();
    const k = keyNow(); stat.keyMs += performance.now() - t0;
    if (memo.k === k && memo.plans) return memo;
    // The last few states are kept too: the Sights list tries a sight (a different selection), then the day as it is
    // again, then the next sight; going back to a state planned a moment ago is a lookup, not a new bucket and plan.
    { const m = recent.get(k); if (m && m.plans) { recent.delete(k); recent.set(k, m); memo = m; stat.recent = (stat.recent || 0) + 1; return memo; } }
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
    if (window.PLACES2) { bucket = E.applyPlaces(bucket, window.PLACES2); guideFromPlaces(bucket); }
    // The app's own public transport answers for each ride (asked for any ride not known yet, as in the app).
    const used = new Map();
    bucket.answers = (a, b) => { const r = answerOf(a, b); used.set(a.lat + "," + a.lng + ">" + b.lat + "," + b.lng, { a, b, sig: answerSig(a, b) }); return r; };
    let plans; try { plans = E.planTrip(bucket); } catch (e) { console.warn("Beta 2 engine", e); plans = []; }
    // A day still on the app's own seeding (the traveler hasn't ticked or unticked anything there) shows what the
    // engine planned: its ticks become the engine's stops, so the picker, the counts and the plan always agree.
    let synced = false;
    trip.days.forEach((d, i) => {
      const ep = plans[i], fresh = !Array.isArray(d.selected);
      // An empty list with no seeding mark is the app's too (nothing of the traveler's to lose); a non-empty one without
      // the mark (an older trip's picks) is left as it is.
      if (!ep || ep.error || !Array.isArray(ep.items) || d.ready || listIsOwn(d) || (!fresh && !appSeeded(d) && d.selected.length)) return;
      const ids = ep.items.filter(x => x.t === "stop" && x.id != null).map(x => x.id);
      // A day not seeded yet is seeded here, from the engine's plan (the old planner's background seeding then has
      // nothing left to do): the sights the traveler named become theirs, as seeding does.
      if (fresh) { const c = cityFor(d); if (!c) return; const w = (typeof wantIds === "function" ? wantIds(d, c) : []); d.selected = []; w.forEach(id => markMine(d, id, true)); }
      else if (ids.map(String).sort().join("|") === d.selected.map(String).sort().join("|")) return;
      d.selected = ids; d.seedSig = seedSigOf(d); d.autoEmpty = !ids.length; synced = true;
    });
    // The bucket is the same after the sync (a seeded day sends only the traveler's own picks), so the plans stand.
    memo = { k: synced ? keyNow() : k, ik, used, plans, bucket }; recent.set(memo.k, memo); if (recent.size > 8) recent.delete(recent.keys().next().value); return memo;
  }
  window.__kairouteEngine2 = () => JSON.parse(JSON.stringify(tripPlans().plans));
  // Each day's planned stops in order (ids), for the group trip's snapshot (guide-group.js).
  window.__kairoutePlanStops = () => tripPlans().plans.map(ep => ep && !ep.error && Array.isArray(ep.items) ? ep.items.filter(y => y.t === "stop" && y.id != null).map(y => String(y.id)) : []);
  // For the phone test: every pier a boat may leave from, and whether a place is reached only by boat.
  window.__kairoutePiers = () => E.piersOf(tripPlans().bucket || {});
  window.__kairouteBoatPlace = id => { const b = tripPlans().bucket || {}; for (const c of Object.values(b.cities || {})) { const x = [...(c.sites || []), ...(c.farther || [])].find(y => String(y.id) === String(id)); if (x) return E.byBoat(x.travelNote) || E.waterOnly(x); } return false; };
  const MODE = { walk: "walk", ride: "ride", transit: "ride", boat: "ferry", lift: "ride" };
  const UIKIND = { walk: "walk", taxi: "car", ferry: "ferry", bus: "bus", metro: "train", tram: "train", train: "train" };
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
        // One ride record from the engine (part 1): its kind sets the icon and the line on the map, its label names what
        // it is, its steps say how to make it, the guide's words are a note beside it.
        const leg = { mode: MODE[x.mode] || "ride", kind: UIKIND[x.kind] || (x.mode === "walk" ? "walk" : "car"), how: x.how || (x.mode === "walk" ? "Walk" : "Taxi or car"), km: x.km || 0, min: x.min || 0 };
        if (x.pierName) leg.pier = x.pierName; if (x.from) leg.from = x.from; if (x.to) leg.to = x.to; if (x.options) leg.options = x.options;
        if (x.ans) leg.transit = x.ans; if (x.steps) leg.steps = x.steps; if (x.note) leg.note = x.note; if (x.lost) leg.lost = x.lost; if (x.slack) leg.slack = x.slack;
        // Every way for this ride is a choice on the plan (the ride chips): a tap saves it as the traveler's own choice for
        // this ride, and the engine plans with it.
        if (x.from && x.to && x.options && x.options.length > 1) {
          leg.key = E.pairKey(x.pairFrom || x.from, x.pairTo || x.to); leg.choice = x.choice;
          leg.choices = x.options.map(o => ({ id: o.id, label: o.how, min: o.min, kind: UIKIND[o.kind] || "car" }));
        }
        items.push({ type: "travel", leg, time: (items.length ? items[items.length - 1].time + (items[items.length - 1].dur || 0) : ep.start) }); return;
      }
      if (x.t === "start") { items.push({ type: "start", place: Object.assign({}, w.head[0] || at(x)), time: x.at, label: w.startLabel }); return; }
      if (x.t === "end") { items.push({ type: "end", place: Object.assign({}, w.tail[w.tail.length - 1] || at(x)), time: x.at, label: w.endLabel || "Day done" }); return; }
      if (x.t === "fixed") { items.push({ type: "fixed", place: at(x, x.name, { minutes: x.min, fixed: true }), time: x.at }); return; }
      if (x.t === "stop") {
        const s = byId.get(String(x.id)); const p = Object.assign({}, s || at(x), { minutes: x.min });
        p.bonus = !!x.bonus; // the engine's own word: a stop it planned is part of the day, whatever the guide's listing says
        if (x.lunchCut) p.lunchCut = x.lunchCut; // lunch is inside this visit
        if (x.within) p.within = x.within; if (x.includes) p.includes = x.includes;
        const it = Object.assign({ type: "stop", place: p, time: x.at }, x.wait ? { wait: x.wait } : {}, x.late ? { ohLate: x.late } : {});
        items.push(it); stops.push(it); return;
      }
      if (x.t === "meal" || x.t === "evening") {
        const label = x.meal || "Lunch", m = MEALS.find(z => z.label === label) || MEALS[0];
        const r = x.onBoard ? { name: "Back on board", onBoard: true, generic: true, lat: x.lat, lng: x.lng, alts: [] } : x.packed ? { name: "Bring your own", packed: true, generic: true, lat: x.lat, lng: x.lng, alts: [] } : Object.assign({}, byName(city.restaurants, x.name) || at(x), { alts: [] });
        if (x.booked) Object.assign(r, { booked: true, why: "Your reservation at " + fmt(x.at) + "." }); // a table the traveler booked shows as theirs
        const it = { type: x.t === "evening" ? "evening" : "meal", meal: Object.assign({}, m, { len: x.min || m.len }), place: r, time: x.at };
        items.push(it); (x.t === "evening" ? evening : meals).push(x.t === "evening" ? it : r);
      }
    });
    // The rides' clock: each starts where the item before it ends.
    items.forEach((it, k) => { if (it.type !== "travel") return; const p = items[k - 1]; if (p) it.time = p.time + (p.type === "travel" ? p.leg.min : p.type === "meal" ? p.meal.len : p.place && p.place.minutes || 0); });
    const dropped = (ep.dropped || []).map(id => byId.get(String(id))).filter(Boolean);
    const walkKm = items.filter(i => i.type === "travel" && i.leg.mode === "walk").reduce((a, i) => a + (i.leg.km || 0), 0);
    return { city, w: Object.assign({}, w, { start: ep.start, endBy: ep.endBy }), items, stops, dropped, folded: (ep.folded || []).slice(), elsewhere: [], quickMeals: false, along: [], bonus: stops.filter(s => s.place.bonus).map(s => s.place), fill: [], noLunch: ep.noLunch || null, orderExtra: ep.orderExtra || 0, suggest: (ep.suggest || []).map(x => { const p = byId.get(String(x.id)); return p ? { place: p, minutes: x.minutes, far: x.far, rideMin: x.rideMin, must: !!x.must, voiced: !!x.voiced } : null; }).filter(Boolean),
      meals, evening, swaps: [], closedToday: [], lock: { t: null, seq: stops.map(s => s.place.id), late: 0, quick: false, eve: "" }, locked: false, seen: false, seenBroke: false, seenSkipped: [],
      lockBroken: false, routeX: null, start: ep.start, endBy: ep.endBy, end: ep.end, walkKm, over: !!ep.over,
      engine2: { leaveAt: ep.leaveAt || null, explain: ep.explain || [], explainKind: (ep.explain || []).map(E.explainKind), waysToFit: ep.waysToFit || null, leftOut: ep.leftOut || [], safe: !!ep.safe } };
  }
  // The engine chooses each untouched day's stops, so the old planner's late hand-out of a day trip stays off.
  if (typeof leadLate === "function") leadLate = function () {};
  const oldDay = buildPlanForDay;
  buildPlanForDay = function (d) {
    const city = cityFor(d); if (!city) return null;
    const i = trip.days.indexOf(d); if (i < 0) return oldDay(d); // a day outside the trip (a preview): the old planner
    // A day the new planner can't plan says so plainly and shows nothing else (Nov 20 review: it quietly showed the old
    // planner's day, with its looser safety rules, and nobody could tell which planner made it).
    try { if (window.__kairouteFailDay === i) throw new Error("phone check: a forced error"); const ep = tripPlans().plans[i]; askRides(ep); return toApp(d, city, ep); } catch (e) { console.warn("Beta 2 day", e); window.__kairouteDayErrors = (window.__kairouteDayErrors || 0) + 1; return { error: "This day couldn't be planned. Nothing is shown rather than a plan we can't stand behind: change a pick or reload, and tell us if it stays." }; }
  };
})();
