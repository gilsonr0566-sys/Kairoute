// Beta 2 engine, the whole trip: bucket in, plans out. Days are built hearted (locked) days first, then in date order,
// sharing one ledger, so a sight or a place to eat is used once in the whole trip. Each day: window (step 4), picks
// (step 5: the traveler's wishes, else the best area around the day's best free sight), fit (step 6), timeline
// (step 7), final guard (step 8: a day that breaks a safety rule becomes a safe day, never a broken plan), and the
// explanations (step 9). Pure: the same bucket always gives the same plans.
(function (E) {
  const AREA_KM = 2.5;
  const lunchWanted = win => E.lunchWanted(win);
  // The best area around the day's best free sight, up to about three quarters of the free time (fit trims, fill adds).
  function autoPicks(pool, win, ctx) {
    const free = pool.filter(s => !s.far && !s.quick && ctx.mayAdd(s.id));
    if (!free.length) return [];
    // A skipped lunch gives its time to sightseeing.
    const lunch = lunchWanted(win) && !(ctx.mealPrefs && ctx.mealPrefs.Lunch && ctx.mealPrefs.Lunch.skip);
    const anchor = free[0], budget = (win.endBy - (win.sightFrom || win.start) - (lunch ? E.MEALS[0].len : 0)) * 0.75;
    const near = free.filter(s => E.hav(anchor, s) <= AREA_KM).map(s => ({ s, v: (s.worth || 0) - 20 * E.hav(anchor, s) }))
      .sort((a, b) => b.v - a.v || E.byId(a.s, b.s));
    const out = []; let used = 0;
    // A place seen on one day only: every sight with its own finished guide or a must-see starts in the day, wherever it
    // is in the place; the fit then gives way in order (app additions, shorter visits, lunch on the go, and last a sight).
    if (ctx.single) for (const s of free.filter(s => E.ownStop(s)).sort(E.byId)) { out.push(s); used += (s.minutes || 30) + 12; }
    for (const { s } of near) if (!out.includes(s)) { const cost = (s.minutes || 30) + 12; if (out.length && used + cost > budget) continue; out.push(s); used += cost; }
    return out;
  }
  const dur = m => m >= 60 ? Math.floor(m / 60) + " h" + (m % 60 ? " " + (m % 60) + " min" : "") : m + " min";
  const point = p => p && isFinite(p.lat) ? { lat: p.lat, lng: p.lng } : {};
  // The plan in the short form the scorer and the screens read (the same shape as the old engine's, for side by side).
  // own: a day of the traveler's own list, where everything the app adds is optional.
  function shortForm(i, win, fit, autoIds, dinner, own) {
    const byId = new Map(fit.seq.map(s => [String(s.id), s])), items = [];
    // Where each item is: a stop or meal of the day, the day's first or last point, or a fixed step at either end.
    const fixedAt = id => win.head.concat(win.tail).find(p => p.fixed && p.id === id);
    const whereIs = x => x.t === "fixed" ? fixedAt(x.id) : x.id != null ? byId.get(String(x.id)) : x.t === "start" ? win.head[0] : x.t === "end" ? win.tail[win.tail.length - 1] : null;
    for (const x of fit.r.items) {
      if (x.t === "ride") {
        const { parts, ...one } = x, ride = Object.assign({}, one);
        if (!x.parts) { items.push(ride); continue; }
        // A boat between piers: the way to the pier and from it are rides of their own, around the boat. The traveler's
        // choice of ways stays on the boat, for the whole ride between the two places.
        const ground = x.parts.filter(g => !g.boat).reduce((t, g) => t + g.min, 0);
        x.parts.forEach(g => { const r = g.boat ? Object.assign(ride, { min: x.min - ground, whole: true }, g.from ? { pierName: g.from } : {})
            : E.rideItem(g);
          if (g.to) r.to = { lat: g.to.lat, lng: g.to.lng }; items.push(r); });
        continue;
      }
      // Each ride knows where it starts and ends (the map draws each one apart, out and back side by side). Two rides in
      // a row (to the pier, then the boat) meet at the pier; the ride with the traveler's choices keeps the whole ride's
      // two ends for that choice.
      const here = point(whereIs(x));
      let k = items.length; while (k > 0 && items[k - 1].t === "ride") k--;
      const a = items[k - 1], run = items.slice(k);
      if (run.length && a && isFinite(a.lat) && isFinite(here.lat)) {
        const A = { lat: a.lat, lng: a.lng };
        run.forEach((r, j) => { r.from = j === 0 ? A : run[j - 1].to; if (!r.to || j === run.length - 1) r.to = j === run.length - 1 ? here : r.to;
          if (r.whole) { r.whole = undefined; delete r.whole; if (run.length > 1) Object.assign(r, { pairFrom: A, pairTo: here }); } });
      }
      const src = x.id != null ? byId.get(String(x.id)) : null;
      // Every stop on a plan is a pick: the traveler's, or the app's starting picks on a day they haven't touched (shown
      // ticked). Nothing is optional (Nov 18, Richard).
      const it = { t: x.t, id: x.t === "meal" ? null : x.id, name: x.name, at: x.at, min: x.min, bonus: false, along: false, meal: x.meal || null, late: x.late || 0 };
      if (x.wait) it.wait = x.wait; if (x.freeBefore) it.freeBefore = x.freeBefore; if (x.chosen) it.chosen = true; if (x.pinned) it.pinned = true; if (x.booked) it.booked = true;
      if (x.packed) it.packed = true; if (src && src.lunchCut) it.lunchCut = src.lunchCut; // lunch is inside this visit: the visit gave it these minutes
      Object.assign(it, point(whereIs(x)));
      items.push(it);
    }
    if (fit.onBoard) { const sp = win.tail[win.tail.length - 1]; items.push({ t: "meal", id: null, name: "Back on board", at: fit.onBoard.at, min: fit.onBoard.min, bonus: false, along: false, meal: "Lunch", late: 0, onBoard: true, lat: sp.lat, lng: sp.lng }); }
    if (dinner) items.push({ t: "evening", id: null, name: dinner.name, at: dinner.at, min: dinner.min, lat: dinner.lat, lng: dinner.lng, bonus: false, along: false, meal: "Dinner", late: 0, booked: !!dinner.booked, chosen: !!dinner.chosen });
    return { i, start: win.start, endBy: win.endBy, end: fit.r.end, over: fit.r.over > 0, straight: !!win.straight,
      head: win.head.map(x => ({ name: x.name, fixed: !!x.fixed, minutes: x.fixed ? x.minutes : 0 })), tail: win.tail.map(x => ({ name: x.name, fixed: !!x.fixed, minutes: x.fixed ? x.minutes : 0 })), items,
      suggest: (fit.suggest || []).slice(), noLunch: fit.noLunch || null, orderExtra: fit.orderExtra || 0 };
  }
  // Step 8: the final guard. Any broken safety rule turns the day into a safe day that says why.
  function guard(plan, win) {
    const why = [];
    if (win.hard && plan.end > win.endBy) why.push("would end " + (plan.end - win.endBy) + " min after the time to be back");
    plan.items.forEach(x => { if (x.t === "stop" && x.late) why.push(x.name + " reached after its last entry"); if (win.hard && x.t === "stop" && x.at + (x.min || 0) > win.endBy) why.push(x.name + " runs past the time to be back"); });
    // Checked from the plan itself, not the planner's word (Nov 19 review): every ride between two places apart takes time;
    // on a ship, train or plane day no ride is a guess (a place not on the map), and the ride back of half an hour or
    // more carries its extra time.
    plan.items.forEach((x, k) => { if (x.t !== "ride" || x.mode === "lift") return; const a = plan.items[k - 1], b = plan.items[k + 1];
      if (x.from && x.to && E.hasPos(x.from) && E.hasPos(x.to) && E.hav(x.from, x.to) > 0.05 && !(x.min > 0)) why.push("a ride with no time between " + ((a && a.name) || "two places") + " and " + ((b && b.name) || "the next"));
      if (win.hard && x.guess) why.push("a ride to or from a place not on the map, on a day with a time to be back");
    });
    // The way back from the day's farthest place carries its extra time, however many stops lie on it (Nov 20 review).
    const end = plan.items[plan.items.length - 1];
    if (win.hard && end && end.t === "end") {
      let far = 0, fd = -1; if (E.hasPos(end)) plan.items.forEach((x, k) => { if ((x.t === "stop" || x.t === "meal") && E.hasPos(x) && E.hav(end, x) > fd) { fd = E.hav(end, x); far = k; } });
      const back = plan.items.slice(far).filter(x => x.t === "ride"), has = back.reduce((a, x) => a + (x.slack || 0), 0), base = back.reduce((a, x) => a + (x.mode === "walk" ? 0 : x.min || 0), 0) - has;
      if (has < E.slackFor(base)) why.push("the way back has no extra time for traffic or delays");
    }
    return why;
  }
  E.guardPlan = (plan, win) => guard(plan, win);
  function safeDay(i, win, tr, why) {
    const r = E.walkDay([], win, tr.estimate, null);
    return Object.assign(shortForm(i, win, { seq: [], r }, new Set(), null), { safe: true, explain: ["Kept to the safe minimum: " + why.join("; ") + "."] });
  }
  // A sight inside a group (a church on a square) is folded into the group's visit, unless it is worth a stop of its
  // own: a finished guide or audio tour, a must-see, or the traveler's pick. Then it is always its own stop.
  E.ownStop = (s, picked) => !!(s && (s.hasGuide || s.mustSee || E.has(s, "must-see") || (picked && picked.has(String(s.id)))));
  // ONE rule for "has a door and hours" (Nov 20 review: two word lists disagreed, and a fortress named for its harbor or a
  // "Castel" was on neither): read from the sight's tags, which the app sets once per sight. Anything not open-air needs
  // hours; a trip out of town is its own place.
  E.needsHours = s => !!s && !s.far && !E.has(s, "open-air");
  const ACT = /didn't fit|would arrive after|too late to see before|is closed on|Boats keep their own timetable|^Bring lunch|where you put it|lunch is back on board|no room for lunch|take a boat back/i, FREE = /^Free time|^Time left for|^Nothing left to plan/;
  // A place to eat named only as a kind of place ("Harbor-front tavernas", "Seafood restaurants on the quay") is a tip, never
  // a timed lunch at a real place (Fable review #13; Richard's lunch rule: a real place).
  E.genericEat = n => { const t = String(n || "").trim(); return !t || (/\b(tavernas|restaurants|cafes|cafés|bars|eateries|stalls|kiosks|trattorias|bistros|pubs|food trucks|places to eat|spots|joints|street food)\b/i.test(t) && !/^[A-Z][\w'’.-]*\s*['’]s\b/.test(t) && !/\b(&|and)\b.*\b(bar|cafe|restaurant)\b$/i.test(t)); };
  E.explainKind = t => FREE.test(t) ? "free" : ACT.test(t) ? "act" : "info";
  E.ASSUME_OPEN = 9 * 60; E.ASSUME_CLOSE = 17 * 60; // hours assumed for a sight that needs them when none are known
  // Richard, Nov 20: a sight inside a bigger visit the traveler picked (a house in an excavation site, a chapel in a museum
  // complex, a tower in a castle), or a small open-air sight right beside it (a fountain on its square), is seen on that
  // visit: it adds only a small extra time, never a whole stop of its own with walks to and from it ("a false sense of not
  // enough time in the day"). Folds into a gated visit (one with hours: the time inside covers what is inside), or an
  // open-air sight into any visit; a museum inside an open old town stays a stop of its own (the walk doesn't cover it).
  // picks: the day's picks; groups: E.makeGroups. Returns { picks, folded: holder id -> [{ id, name, extra, beside }] }.
  E.FOLD_NEAR = 0.2; // km: right beside the bigger visit
  E.foldExtra = s => Math.min(20, Math.max(5, Math.round((s.minutes || 30) * 0.25 / 5) * 5));
  // gated(h): the bigger visit has its own opening hours this day (a gate: an excavation town, a castle).
  E.foldPicks = (picks, groups, gated) => {
    const ids = new Map(picks.map(s => [String(s.id), s])), into = new Map();
    const covers = (h, s) => !!(gated && gated(h)) || (!s.far && !E.needsHours(s)) || (s.minutes || 30) <= 15 || (!h.far && E.needsHours(h) && !E.isOpenArea(h));
    for (const s of picks) {
      let k = String(s.id), seen = new Set([k]), h = null;
      if (s.town != null && ids.has(String(s.town))) h = ids.get(String(s.town));
      else while (groups && groups.groupOf.has(k)) { k = String(groups.groupOf.get(k)); if (seen.has(k)) break; seen.add(k); if (ids.has(k)) { h = ids.get(k); break; } }
      if (h && covers(h, s)) { into.set(String(s.id), { h, beside: false }); continue; }
      // Beside: only one small thing (a fountain, a statue), never an area or a street (a historic centre is never part of a chapel).
      if (s.far || E.needsHours(s) || E.isAreaKind(s) || E.isOpenArea(s) || /\b(street|road|avenue|boulevard|lane|rua|calle|strasse|straße)\b/i.test(s.name) || !isFinite(s.lat)) continue;
      const near = picks.filter(x => x !== s && !x.far && isFinite(x.lat) && (x.fullMinutes || x.minutes || 30) > (s.minutes || 30) && E.hav(x, s) <= E.FOLD_NEAR)
        .sort((a, b) => E.hav(a, s) - E.hav(b, s) || E.byId(a, b))[0];
      if (near) into.set(String(s.id), { h: near, beside: true }); }
    // Through a chain (a fountain beside a chapel folded into a museum) to the visit that stays a stop.
    const root = id => { let k = id, n = 0; while (into.has(k) && n++ < 20) k = String(into.get(k).h.id); return k; };
    const folded = {};
    for (const [id, f] of into) { const r = root(id); if (r === id) continue; const s = ids.get(id);
      (folded[r] = folded[r] || []).push({ id: s.id, name: s.name, extra: E.foldExtra(s), beside: f.beside && r === String(f.h.id) }); }
    if (!Object.keys(folded).length) return { picks, folded };
    const out0 = picks.filter(s => !(into.has(String(s.id)) && root(String(s.id)) !== String(s.id)));
    const out = out0.map(s => { const f = folded[String(s.id)]; if (!f) return s;
      const gone = new Set(f.map(x => x.name)), walkOf = (s.walkOf || []).filter(n => !gone.has(n));
      // Its own time back, less only what its remaining own stops take (as the pool shortens it, never under half an hour).
      const base = s.fullMinutes || s.minutes || 60, rest = out0.filter(x => walkOf.includes(x.name)).reduce((a, x) => a + (x.minutes || 30), 0);
      const left = walkOf.length ? Math.min(base, Math.max(30, Math.round((base - rest) / 5) * 5)) : base;
      const t = Object.assign({}, s, { minutes: left + f.reduce((a, x) => a + x.extra, 0), folded: f });
      if (walkOf.length) t.walkOf = walkOf; else { delete t.walkOf; delete t.fullMinutes; }
      return t; });
    return { picks: out, folded };
  };
  E.listWords = (xs, joiner) => xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " " + (joiner || "or") + " " + xs[xs.length - 1];
  // Which list a sight came in on (a guide's sights or its trips out) doesn't decide how it's planned; where it is does.
  // A sight more than FAR_KM from the heart of the place's sights (their median point) is a trip out, with its own ride,
  // planned as a day trip or named as one, never mixed into a day in town. Pure: returns new guides.
  E.FAR_KM = 20;
  E.sortFar = guides => {
    const out = {};
    for (const [k, g] of Object.entries(guides)) {
      const pts = (g.sites || []).filter(s => isFinite(s.lat) && isFinite(s.lng));
      if (pts.length < 4) { out[k] = g; continue; }
      const med = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
      const heart = { lat: med(pts.map(s => s.lat)), lng: med(pts.map(s => s.lng)) };
      const away = (g.sites || []).filter(s => isFinite(s.lat) && E.hav(heart, s) > E.FAR_KM);
      if (!away.length) { out[k] = g; continue; }
      const ids = new Set(away.map(s => String(s.id)));
      out[k] = Object.assign({}, g, { sites: g.sites.filter(s => !ids.has(String(s.id))), farther: (g.farther || []).concat(away.map(s => Object.assign({}, s, { far: true }))) });
    }
    return out;
  };
  const planAll = bucket => {
    const prefs = bucket.prefs || {}, style = bucket.style || "mix", tr = E.makeTravel(prefs, bucket.legModes, bucket.legs, bucket.transit, bucket.answers, E.piersOf(bucket)), ledger = E.makeLedger();
    const guides = E.sortFar(bucket.cities || {}), days = bucket.days || [], out = new Array(days.length).fill(null);
    // Each day knows where its place's own sights are, so a gate far from all of them is caught (part 3).
    const spots = key => ((guides[key] || {}).sites || []).filter(s => isFinite(s.lat)).map(s => ({ lat: s.lat, lng: s.lng }));
    const wins = days.map(d => (d.noShore || d.type === "sea") ? null : E.dayWindow(Object.assign({}, d, { siteSpots: spots(d.city), placeName: d.city + " " + ((guides[d.city] || {}).name || "") }), tr));
    // A pick closed on its own day moves to another day in the same place when it's open then (never onto or off a
    // day the traveler locked, nor onto a day they made their own: a list they set, or emptied, stays theirs), and the
    // plan says so.
    const sel = days.map(d => (d.selected || []).slice()), movedTo = new Map();
    const findSite = (city, id) => city && ((city.sites || []).find(s => String(s.id) === String(id)) || (city.farther || []).find(s => String(s.id) === String(id)));
    const openOn = (s, j) => wins[j] && !wins[j].error && E.allowed(s, prefs, (days[j].sites || {})[s.id] || null, wins[j]);
    days.forEach((d, i) => { if (d.locked || !wins[i] || wins[i].error) return; const city = guides[d.city];
      for (const id of (d.selected || []).slice().sort()) { const s = findSite(city, id); if (!s || openOn(s, i)) continue;
        const j = days.findIndex((e, k) => k !== i && e.city === d.city && !e.locked && !e.own && openOn(s, k) && !sel[k].map(String).includes(String(id)));
        if (j < 0) continue; sel[i] = sel[i].filter(x => String(x) !== String(id)); sel[j].push(id); movedTo.set(String(id), { from: i, to: j, name: s.name }); } });
    // A pick that stands inside an area picked for another day (the Erechtheion on the Acropolis) moves to that day: one
    // walk, not two trips. Never onto or off a locked day; the plan says so.
    days.forEach((d, i) => { if (d.locked || !wins[i] || wins[i].error) return; const city = guides[d.city]; if (!city) return;
      const g = E.makeGroups((city.sites || []).concat((city.farther || []).map(x => Object.assign({}, x, { far: true }))));
      for (const id of sel[i].slice().sort()) { const h = g.groupOf.get(String(id)); if (h == null || sel[i].map(String).includes(String(h))) continue;
        const j = days.findIndex((e, k) => k !== i && e.city === d.city && !e.locked && sel[k].map(String).includes(String(h)) && wins[k] && !wins[k].error);
        if (j < 0) continue;
        const s = findSite(city, id), hs = findSite(city, h); if (!s || !hs || !openOn(s, j)) continue;
        sel[i] = sel[i].filter(x => String(x) !== String(id)); if (!sel[j].map(String).includes(String(id))) sel[j].push(id);
        movedTo.set(String(id), { from: i, to: j, name: s.name, inside: hs.name }); } });
    const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayWord = j => { const t = Date.parse(String(days[j].date || "") + "T12:00:00Z"); return isFinite(t) ? WEEKDAY[new Date(t).getUTCDay()] : "another day"; };
    const order = days.map((d, i) => i).sort((a, b) => (days[b].locked ? 1 : 0) - (days[a].locked ? 1 : 0) || a - b);
    // A sight the traveler picked for a day is kept for that day: no other day adds it on its own.
    const wishDay = new Map();
    for (const i of order) for (const id of sel[i]) if (!wishDay.has(String(id))) wishDay.set(String(id), i);
    // Step 6a: a stay of several days in one place is split into areas, one per day.
    const areaDay = new Map(), dayTrip = new Map();
    const byCity = new Map();
    days.forEach((d, i) => { const w = wins[i]; if (!w || w.error || w.straight || !guides[d.city]) return; if (!byCity.has(d.city)) byCity.set(d.city, []); byCity.get(d.city).push(i); });
    for (const [key, idx] of [...byCity].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
      if (idx.length < 2) continue;
      const city = guides[key], ranked = E.rank((city.sites || []).map((s, k) => Object.assign({}, s, { rank: k })), prefs, style);
      const picked = new Set(idx.flatMap(i => sel[i].map(String)));
      const groups = E.makeGroups(ranked), sights = ranked.filter(s => !s.far && E.allowed(s, prefs, null, null) && (!groups.groupOf.has(String(s.id)) || E.ownStop(s, picked)));
      const byId = new Map(ranked.map(s => [String(s.id), s]));
      const farRanked = E.rank((city.farther || []).map(s => Object.assign({}, s, { far: true })), prefs, style).filter(s => E.allowed(s, prefs, null, null));
      const allById = new Map(E.rank((city.farther || []).map(s => Object.assign({}, s, { far: true })), prefs, style).concat(ranked).map(s => [String(s.id), s]));
      // A day trip the traveler picked takes its own time (there and back, and the visit) out of that day's share.
      const stay = idx.map(i => {
        const own = sel[i].filter(id => wishDay.get(String(id)) === i).map(id => allById.get(String(id))).filter(s => s && isFinite(s.lat));
        const away = own.filter(s => s.far).reduce((a, s) => a + (s.minutes || 60) + 2 * tr.min(wins[i].head[wins[i].head.length - 1], s), 0);
        return { i, free: (isFinite(wins[i].sightTo) ? wins[i].sightTo : wins[i].endBy) - (wins[i].sightFrom || wins[i].start) - away, wishes: own.filter(s => !s.far), picked: own.length };
      });
      const home = wins[idx[0]].head[wins[idx[0]].head.length - 1];
      // The traveler already picked a day out of town on this stay: the app adds no other on its own.
      const pickedFar = idx.some(i => sel[i].some(id => { const s = allById.get(String(id)); return s && s.far; }));
      const outing = pickedFar ? null : E.pickDayTrip(stay.map(x => Object.assign({}, x, { wishes: x.picked ? [1] : [] })), sights, farRanked.filter(s => !wishDay.has(String(s.id))), s => tr.min(home, s), AREA_KM);
      if (outing) { dayTrip.set(outing.day, outing.ids); outing.ids.forEach(id => areaDay.set(key + "|" + id, outing.day)); }
      const split = E.splitAreas(stay.filter(x => !outing || x.i !== outing.day), sights);
      split.forEach((v, k) => areaDay.set(key + "|" + k, v));
      // A sight with its own tour inside an area goes on the day that area is walked: one walk, not two trips.
      // The area's day is the day it was picked for, or the day its area walk falls on.
      for (const [m, g] of groups.groupOf) { const gd = wishDay.has(String(g)) ? wishDay.get(String(g)) : areaDay.get(key + "|" + g);
        if (gd != null && !wishDay.has(String(m)) && E.ownStop(byId.get(String(m)), picked)) areaDay.set(key + "|" + m, gd); }
    }
    // Plan one day. again: the day's stops from the first pass, now free to fill from any sight still unused.
    const planDay = (i, again) => {
      const d = days[i];
      if (d.noShore || d.type === "sea") return { plan: { i, error: "At sea or staying aboard: no time ashore." } };
      const win = wins[i];
      if (win.error) return { plan: { i, error: win.error } };
      const city = guides[d.city];
      if (!city) return { plan: { i, error: "no guide" } };
      const listed = (city.sites || []).map((s, k) => Object.assign({}, s, { rank: k })).concat((city.farther || []).map(s => Object.assign({}, s, { far: true })));
      // A sight that needs hours and has none known for the date is never planned as open at dawn or late (Nov 20 review: a
      // fortress at 7:39 am): it is planned inside 9 to 5 and marked for checking.
      // A sight inside a place whose gates keep hours (a town listed with opening hours is a walled site, like an excavation)
      // keeps those hours when it has none of its own (Fable review #12: a house inside the excavations planned before it opened).
      const townOf = new Map(listed.filter(s => s.town).map(s => [String(s.id), String(s.town)]));
      const ownDay = id => (d.sites || {})[id] || null, gated = sd => !!(sd && (sd.closed || (sd.oh && sd.oh.spans && sd.oh.spans.length)));
      const rawDay = id => { const sd = ownDay(id), t = townOf.get(String(id)); return !gated(sd) && t && gated(ownDay(t)) ? Object.assign({}, sd, ownDay(t), { fromTown: true }) : sd; }, needById = new Map(listed.map(s => [String(s.id), E.needsHours(s)]));
      const hoursKnown = id => { const sd = rawDay(id); return !!(sd && (sd.closed || sd.allDay || (sd.oh && sd.oh.spans && sd.oh.spans.length))); };
      const siteDay = id => { const sd = rawDay(id); return needById.get(String(id)) && !hoursKnown(id) ? Object.assign({}, sd, { oh: { spans: [[E.ASSUME_OPEN, E.ASSUME_CLOSE]], last: null }, assumed: true }) : sd; };
      const ranked = E.rank(listed, prefs, style);
      // A town a day away whose travel guide names places to eat gets a lunch stop in its centre (the plan names the
      // guide's suggestions); it is never a dinner idea.
      // Its places to eat that are on the map are planned by name, where they are (Nov 18, Richard's day on an island: "Lunch in
      // <town>", with no place named); a town whose guide gives none a spot keeps a lunch stop in its centre.
      const townLunch = (city.farther || []).filter(t => !t.town && (t.foodDrink || []).length && isFinite(t.lat)).flatMap(t => {
        const real = t.foodDrink.filter(x => x.kind === "eat" && isFinite(x.lat) && isFinite(x.lng) && E.hav(x, t) <= 3);
        // The town's note is how to get there from where the day starts: a town beside it (a few minutes away) gives its
        // places to eat no note, or a ride to one from a far sight would read the near town's "5 minutes by taxi" and lose
        // the far sight's own time (Nov 19: back from a lagoon 1 h 30 min away, timed as a 55 min taxi to lunch by the port).
        const o = win.head[win.head.length - 1], tn = o && isFinite(o.lat) && E.hav(o, t) <= 5 ? "" : t.travelNote || "";
        return real.length ? real.map(x => ({ name: x.name, lat: x.lat, lng: x.lng, kind: "restaurant", amenity: "restaurant", fromMap: !!x.fromMap, inTown: t.id, travelNote: tn }))
          : [{ name: "Lunch in " + t.name, lat: t.lat, lng: t.lng, townLunch: t.id, travelNote: t.travelNote || "" }]; });
      const ctx = { single: (byCity.get(d.city) || [i]).length === 1, tr, ledger, dayIdx: i, siteDay, eats: (city.restaurants || []).concat(townLunch).filter(r => !E.genericEat(r.name)).sort((a, b) => E.eatKey(a.name).localeCompare(E.eatKey(b.name))), eatFacts: d.eats || {}, mealPrefs: E.mealInput(d) };
      // May this day add a sight on its own? Not one used on another day, picked for another day, or in another
      // day's area, unless that day is already planned and left it over.
      const doneDay = j => j == null || j === i || out[j] != null;
      ctx.mayAdd = id => ledger.sightFree(id, i) && doneDay(wishDay.get(String(id))) && doneDay(areaDay.get(d.city + "|" + id));
      const picked = new Set(sel[i].map(String));
      const groups = E.makeGroups(ranked), folded = s => groups.groupOf.get(String(s.id)) != null && !E.ownStop(s, picked);
      // An area walk whose sights with their own tour are stops of their own: the walk keeps only the time between them
      // (its own time less theirs, never under half an hour), and its time goes to more sights.
      const byIdR = new Map(ranked.map(s => [String(s.id), s]));
      const own = g => (groups.members.get(String(g.id)) || []).map(m => byIdR.get(String(m))).filter(m => m && E.ownStop(m, picked));
      // A sight seen only from the water is never a stop the app adds on a ship, train or plane day (a boat tour is the
      // traveler's own pick); picked, it is reached by boat.
      // An optional stop the traveler said "Skip it" to is never added to this day again (Nov 18: the button did nothing).
      const skipped = new Set((d.skipBonus || []).map(String));
      const pool = ranked.filter(s => E.allowed(s, prefs, siteDay(s.id), win) && !folded(s) && !(win.hard && E.waterOnly(s) && !picked.has(String(s.id))) && !(skipped.has(String(s.id)) && !picked.has(String(s.id))))
        .map(s => { const inTown = s.townWalk ? [...picked].map(id => byIdR.get(id)).filter(m => m && String(m.town) === String(s.id)) : [];
          if (inTown.length && s.townWalk < (s.minutes || 60)) return Object.assign({}, s, { minutes: s.townWalk, walkOf: inTown.map(m => m.name), fullMinutes: s.minutes || 60 });
          const o = own(s); if (!o.length) return s; const left = Math.max(30, Math.round(((s.minutes || 60) - o.reduce((a, m) => a + (m.minutes || 30), 0)) / 5) * 5);
          return left < (s.minutes || 60) ? Object.assign({}, s, { minutes: left, walkOf: o.map(m => m.name), fullMinutes: s.minutes || 60 }) : s; });
      const explain = [], wishes = [];
      let picks = null, autoIds;
      if (again) {
        picks = again.kept.slice(); autoIds = new Set(again.autoIds); explain.push(...again.explain);
        const extra = again.extra && pool.find(s => String(s.id) === String(again.extra));
        if (extra && !picks.some(k => String(k.id) === String(extra.id))) { picks.push(extra); autoIds.add(String(extra.id)); explain.push("With time to spare, a trip out to " + extra.name + "."); }
      }
      else {
        (bucket.placeNotes || []).filter(n => n.day === (d.i != null ? d.i : i)).forEach(n => explain.push(n.note));
        if (win.borderNeed) explain.push("Your train crosses a border: be at the station " + win.borderNeed + " min before it leaves" + (win.borderNeed >= E.BORDER_NEED.passport ? ", for passport and security checks." : ", for ID checks.") + " The plan ends in time for that.");
        if (win.borderUnknown) explain.push("This plan has you at the station " + E.BORDER_NEED.open + " min before your train, enough for ID checks at a border. Where passports and bags are checked (to or from Britain, for one), be there " + E.BORDER_NEED.passport + " min before: leave the last stop earlier.");
        if (win.leaveEarly) explain.push("The day starts at " + E.clock(win.start) + ", " + win.leaveEarly + " min before your planned start of " + E.clock(win.plannedStart) + ", to be " + (d.type === "embark" ? "at the cruise terminal" : "there") + " by " + E.clock(win.endBy) + ".");
        for (const [id, m] of movedTo) if (m.from === i) explain.push(m.inside ? m.name + " is inside " + m.inside + ", so it's planned with it on " + dayWord(m.to) + "." : m.name + " is closed on " + dayWord(i) + ", so it's planned on " + dayWord(m.to) + ".");
        for (const id of sel[i]) {
          const s = pool.find(x => String(x.id) === String(id)) || ranked.find(x => String(x.id) === String(id)); if (!s) continue;
          const on = ledger.sightDay(s.id);
          if (on != null && on !== i) { explain.push(s.name + " is planned on another day."); continue; }
          if (!E.allowed(s, prefs, siteDay(s.id), win)) { explain.push(s.name + " is closed or can't be visited this day."); continue; }
          wishes.push(Object.assign({}, s, { wish: true }));
        }
        // A day the traveler has made their own (they ticked or unticked its sights) is planned from their list only:
        // the app never picks in their place there, and a list they emptied is a free day. Spare time may still take an
        // optional stop (marked optional, never in the way of a pick), unless they cleared the day.
        if (d.own) { picks = wishes; if (!wishes.length) explain.push(d.cleared ? "You cleared this day: nothing is planned. Pick any sight to plan it." : "Pick the sights you want and they're planned here."); }
        const tripIds = !d.own && !wishes.length && dayTrip.get(i);
        if (tripIds) {
          picks = tripIds.map(id => pool.find(s => String(s.id) === id)).filter(Boolean);
          const place = picks.find(s => !s.town) || picks[0];
          if (picks.length) explain.push("A day trip to " + (place.townName || place.name) + ": the main sights of " + String(city.name || "this place").split(",")[0] + " fit on your other days.");
        }
        if (!d.own && (!picks || !picks.length)) picks = wishes.length ? wishes : autoPicks(pool, win, ctx);
        autoIds = new Set(wishes.length ? [] : picks.map(s => String(s.id)));
      }
      // Straight from the plane to the ship (under 3 h left with a safe margin): no sightseeing at all, the app's or the
      // traveler's (Round 1, Nov 20: the day said "no time for sightseeing" and then planned three sights with luggage).
      if (win.straight) { if (!again && wishes.length) explain.push("Not planned today: " + E.listWords(wishes.map(s => s.name), "and") + ". You fly in the day the ship sails, with too little time for sightseeing with a safe margin."); picks = []; }
      // Picks inside or right beside a bigger picked visit are part of it (E.foldPicks); never added again as fillers.
      let foldedIds = new Set();
      if (!again) { const fp = E.foldPicks(picks, groups, h => gated(ownDay(h.id))); picks = fp.picks; Object.values(fp.folded).forEach(f => f.forEach(x => foldedIds.add(String(x.id)))); }
      else again.kept.forEach(k => (k.folded || []).forEach(x => foldedIds.add(String(x.id))));
      const fit = E.fitDay(d.cleared ? Object.assign({}, d, { fillTime: false }) : d, win, picks, foldedIds.size ? pool.filter(s => !foldedIds.has(String(s.id))) : pool, ctx);
      fit.kept.forEach(s => { if (s.filled) autoIds.add(String(s.id)); });
      // A place shortened because its own sights are stops of their own says so (Fable review #12: never shortened silently).
      fit.kept.filter(s => s.walkOf && s.fullMinutes > s.minutes).forEach(s => { const line = s.name + " gets " + s.minutes + " min, the walk " + (s.walkOf.length > 1 ? "between " + E.listWords(s.walkOf, "and") + ", which you picked as stops of their own" : "to " + s.walkOf[0] + ", which you picked as a stop of its own") + " (on its own it gets " + s.fullMinutes + " min).";
        if (!explain.includes(line)) explain.push(line); });
      fit.kept.forEach(s => (s.folded || []).forEach(x => { const line = x.name + (x.beside ? " is right beside " : " is inside ") + s.name + ": seen on that visit (" + x.extra + " min more), not a stop of its own.";
        if (!explain.includes(line)) explain.push(line); }));
      // Lunch back on board (Nov 20, decided for Richard's lunch rule: every day over lunchtime has a timed lunch): a port day
      // whose picks fill the time ashore, back at the ship in time for lunch, has lunch on board. It never shortens a pick
      // and never touches the time to be back: it comes after the return.
      { const L = E.MEALS[0], ship = win.tail.length && win.tail[win.tail.length - 1].backToShip;
        if (fit.noLunch === "time" && ship && fit.kept.length && fit.r.end <= L.to - E.TO_GO) {
          fit.onBoard = { at: Math.max(fit.r.end, L.from), min: E.TO_GO + 10 }; fit.noLunch = null;
          explain.push("Your picks fill the time ashore, so lunch is back on board at " + E.clock(fit.onBoard.at) + "."); } }
      { const pk = (fit.r.items || []).find(x => x.packed), at = pk && fit.r.items.filter(x => x.t === "stop" && x.at <= pk.at).pop();
        if (pk) explain.push("Bring lunch for " + E.clock(pk.at) + (at ? " at " + at.name : "") + ": places to eat there aren't in the guide yet."); }
      // A wanted stop the day had to give up (a pick, a finished guide, a must-see) comes with the ways to fit it back in.
      const ways = {};
      if (!again) fit.dropped.forEach(x => { if (!x.wish && !x.wanted) return;
        const w = x.why === "didn't fit in the time" ? E.waysToFit(win, fit.kept, x.stop, ctx) : [];
        if (w.length) ways[x.id] = w;
        explain.push((d.wantsOnly ? "Not planned today: " : "") + x.name + " " + x.why + (w.length ? ". To fit it in: " + E.listWords(w.map(o => o.say), "or") : "") + "."); });
      fit.kept.forEach(s => { if (s.trimmed && !(again && again.kept.some(k => k.trimmed && String(k.id) === String(s.id)))) explain.push("A shorter visit to " + s.name + " (" + dur(s.minutes) + " instead of " + dur(s.trimmed) + ") so the rest of the day fits."); });
      const last = fit.seq.length ? fit.seq[fit.seq.length - 1] : win.head[0];
      const dinner = E.dinnerAfter(win, win.tail.length ? win.tail[win.tail.length - 1] : last, fit.r.end, ctx, new Set(fit.seq.filter(s => s.eatKey).map(s => s.eatKey)));
      // Out of town: the town itself (a sight inside it names its town), and what its travel guide lists to eat and drink,
      // tastings and local specialties first.
      const outStop = fit.kept.find(k => k.far), townNear = s => (city.farther || []).filter(t => t !== s && !t.town && (t.foodDrink || []).length && isFinite(t.lat) && isFinite(s.lat) && E.hav(t, s) <= 3).sort((x, y) => E.hav(x, s) - E.hav(y, s) || E.byId(x, y))[0];
      // A sight out of town is eaten near in its own town: the one it names, else the nearest town (3 km at most) whose
      // travel guide lists places to eat (Pompeii's ruins and the town of Pompei beside them).
      const outTown = outStop && (outStop.town ? (city.farther || []).find(t => String(t.id) === String(outStop.town)) || { name: outStop.townName } : (outStop.foodDrink || []).length ? outStop : townNear(outStop) || outStop);
      const eatList = outTown ? (outTown.foodDrink || []).slice().sort((a, b) => (a.fromMap ? 1 : 0) - (b.fromMap ? 1 : 0) || (b.special ? 1 : 0) - (a.special ? 1 : 0)).slice(0, 3) : [];
      const eatThere = eatList.map(x => x.name), fromMap = eatList.length && eatList.every(x => x.fromMap);
      // Who names them: the travel guide, or the map (places to eat beside the sight, with no review behind them).
      const suggests = fromMap ? "places to eat on the map beside it: " : "the travel guide suggests ";
      if (outTown && eatThere.length && !fit.noLunch) explain.push("In " + outTown.name + ", " + suggests + E.listWords(eatThere) + (fromMap ? " (check reviews before you go)." : "."));
      const longVisit = fit.kept.filter(k => (k.minutes || 0) >= 60 && !(k.far && E.has(k, "day-trip"))).sort((a, b) => b.minutes - a.minutes || E.byId(a, b))[0];
      // A lunch place the traveler chose that doesn't serve lunch that day: said, with where lunch went instead.
      { const lp = E.mealPlan(ctx, "Lunch"); if (lp.pickShut) explain.push(lp.pickShut + " doesn't serve lunch on this day (its listed hours), so lunch is planned at another place nearby."); }
      const lunchNote = !fit.kept.length ? null : fit.noLunch && outTown ? (fit.noLunch === "time" ? "No time for a sit-down lunch on this plan: grab lunch on the go in " : "Have lunch in ") + outTown.name + (eatThere.length ? ": " + suggests + E.listWords(eatThere) + (fromMap ? " (check reviews before you go)." : ".") : ": its places to eat aren't in the guide yet.") : fit.noLunch ? (fit.noLunch === "time" ? (win.hard ? (fit.kept.some(k => k.wish) ? "Your picks fill" : "Today's stops fill") + " the time ashore, so there's no room for lunch and still a safe margin to get back. Grab lunch on the go between stops" + (longVisit ? ", or spend less time at " + String(longVisit.name).split(",")[0] + " to make room." : ".") : "No time for a sit-down lunch on this plan: grab lunch on the go between stops.") : "No place to eat along the way at lunchtime: bring food or eat at a stop's own café.") : null;
      // Never quietly sure: where the map gives hours for this place's sights but not for some of today's stops, say so.
      { const m = (fit.seq || []).find(x => x.mealOf && x.fromMap); if (m) explain.push("Lunch at " + m.name + " is a place to eat on the map beside your stops (the guide names none on your way): check reviews before you go."); }
      const plan = shortForm(i, win, fit, autoIds, dinner, !!d.own);
      // The first stop not open yet: the day starts later and says so, instead of a wait at a locked door (Nov 20 review: 68
      // minutes at a chapel's door after leaving the ship at 7:30). Only when nothing fixed comes before it.
      { const k = plan.items.findIndex(x => x.t === "stop"), st = plan.items[0];
        if (k > 0 && st && st.t === "start" && plan.items.slice(1, k).every(x => x.t === "ride") && plan.items[k].wait > 20) {
          const w = plan.items[k].wait; st.at += w; plan.items[k].wait = 0; plan.lateStart = w;
          explain.push(String(plan.items[k].name).split(",")[0] + " opens at " + E.clock(plan.items[k].at) + ", so the day starts at " + E.clock(st.at) + (d.type === "port" ? ": leave the ship then" : "") + "."); } }
      // ONE leave-by time on a leaving or boarding day, read off the plan itself (Nov 20 tester: a leaving day showed
      // 8:15 on the badge, 8:29 in the note and 8:44 on the timeline). out: the ride to the station, airport or ship starts;
      // bags: the bags are collected (when that's a stop of its own); last: the last stop or meal is left.
      // A port day too (Nov 20 tester: the badge said leave by 15:26 while the plan was already back at 15:21).
      // The end is found by its kind, not as the last row: lunch back on board comes after it (Round 1, Nov 20: a port day's
      // badge said leave by 12:15, the time to be back, because that lunch hid the 38 min ride back).
      const endI = plan.items.findIndex(x => x.t === "end");
      if ((d.type === "departure" || d.type === "embark" || (d.type === "port" && win.hard)) && endI > 0 && plan.items.slice(0, endI).some(x => x.t === "stop" || (x.t === "meal" && !x.onBoard) || x.t === "fixed")) {
        const its = plan.items.slice(0, endI + 1), endAt = its[endI].at; let k = endI, t = endAt;
        while (k > 0 && its[k - 1].t === "ride") { k--; t -= its[k].min || 0; }
        // The latest safe time to leave: the time to be back less the rides there. Time left before it is free time, so the
        // badge, the free time row and the notes all say this one time (Round 1).
        // A boat or a timetabled line back keeps the plan's own time (its sailings don't move to suit the traveler).
        const backRides = its.slice(k, endI), fixedTimes = backRides.some(x => x.mode === "boat" || x.kind === "ferry" || (x.ans && Array.isArray(x.ans.deps) && x.ans.deps.length));
        if (!fixedTimes && isFinite(win.endBy) && win.endBy - (endAt - t) > t) t = win.endBy - (endAt - t);
        const bagsK = its.findIndex(x => x.t === "fixed" && /bags/i.test(x.name || "")), lastK = its.map(x => x.t).reduce((a, x, j) => x === "stop" || x === "meal" || x === "start" ? j : a, -1);
        plan.leaveAt = { out: t, bags: bagsK >= 0 && its[bagsK].at != null ? its[bagsK].at : null, last: bagsK < 0 ? t : lastK >= 0 && lastK < bagsK ? (its[lastK].at || 0) + (its[lastK].t === "start" ? 0 : its[lastK].min || 0) : null };
        const word = d.type === "embark" ? "the cruise terminal" : d.type === "port" ? "the ship" : "the " + ((E.MODES[d.mode] || E.MODES.flight).word);
        const atHotel = bagsK >= 0 && plan.leaveAt.last != null && Math.abs(plan.leaveAt.bags - plan.leaveAt.last) <= 2;
        explain.push(plan.leaveAt.bags != null && !atHotel && plan.leaveAt.last != null
          ? "Leave " + String(its[lastK].name || "your last stop").split(",")[0] + " by " + E.clock(plan.leaveAt.last) + ", collect your bags at " + E.clock(plan.leaveAt.bags) + ", and leave for " + word + " by " + E.clock(t) + "."
          : (plan.leaveAt.bags != null ? "Collect your bags at " + E.clock(plan.leaveAt.bags) + " and leave" : "Leave") + " for " + word + " by " + E.clock(t) + "."); }
      // Twenty minutes or more of nothing before a meal is named as free time, never a silent jump in the clock (Fable review #10).
      plan.items.filter(x => x.t === "meal" && x.freeBefore > 20).forEach(x => explain.push("Free time: about " + x.freeBefore + " min before " + String(x.meal || "lunch").toLowerCase() + " at " + E.clock(x.at) + ". Linger where you are or look around nearby."));
      // Lunch the traveler put after a stop that isn't there: said, never moved without a word (Nov 20: the extra time for
      // the way back can leave no room where it was put).
      { const at = d.mealAt && d.mealAt.Lunch != null ? String(d.mealAt.Lunch) : null, li = plan.items.findIndex(x => x.t === "meal" && x.meal === "Lunch");
        if (at && at !== "^" && li > 0 && !plan.items[li].inside) { const prev = plan.items.slice(0, li).reverse().find(x => x.t !== "ride"), st = plan.items.find(x => x.t === "stop" && String(x.id) === at);
          if (st && !(prev && String(prev.id) === at)) explain.push("Lunch is after " + String(prev && prev.name || "another stop").split(",")[0] + ", not after " + String(st.name).split(",")[0] + " where you put it: there it doesn't fit the day" + (win.hard ? " with a safe margin before the time to be back" : "") + "."); } }
      // A boat on its own timetable: the plan names the latest boat back that keeps the day as planned.
      // The stop before it and the next timed item are found past the walks to and from the piers (Nov 20 review: since the
      // way to the pier became its own ride, the line was never written).
      plan.items.forEach((x, k) => { if (x.t !== "ride" || x.mode !== "boat" || x.source === "timetable") return;
        let j = k - 1; while (j >= 0 && plan.items[j].t === "ride") j--; let n = k + 1; while (n < plan.items.length && plan.items[n].t === "ride") n++;
        const from = plan.items[j], next = plan.items[n]; if (!from || from.t !== "stop" || !next || !isFinite(next.at)) return;
        const lands = next.at - plan.items.slice(k + 1, n).reduce((a, r) => a + (r.min || 0), 0);
        explain.push("Boats keep their own timetable: take one back from " + from.name + " that lands you by " + E.clock(lands) + (win.hard ? ", well before the time to be back at the ship (" + E.clock(win.endBy) + ")" : "") + "."); });
      plan.explain = explain.slice();
      // A stop inside an area walked today says so: one walk, not separate trips.
      const keptIds = new Set(fit.kept.map(k => String(k.id)));
      // A group's visit names what it includes (the sights folded into it), so nothing is hidden.
      plan.items.forEach(x => { if (x.t !== "stop") return; const inc = (groups.members.get(String(x.id)) || []).map(m => byIdR.get(String(m))).filter(m => m && !E.ownStop(m, picked));
        const k = fit.kept.find(s => String(s.id) === String(x.id)), f = (k && k.folded) || [];
        if (inc.length || f.length) { x.includes = inc.map(m => m.name).concat(f.map(m => m.name)); x.includesIds = inc.map(m => m.id).concat(f.map(m => m.id)); } });
      plan.items.forEach(x => { if (x.t !== "stop") return; const g = groups.groupOf.get(String(x.id)); if (g != null && keptIds.has(String(g))) x.within = (byIdR.get(String(g)) || {}).name; });
      const bad = guard(plan, win);
      if (bad.length) return { plan: safeDay(i, win, tr, bad) };
      const sightIds = [];
      const byIdHere = new Map(ranked.map(s => [String(s.id), s]));
      fit.kept.forEach(s => { sightIds.push(String(s.id)); (s.folded || []).forEach(x => sightIds.push(String(x.id))); (groups.members.get(String(s.id)) || []).filter(m => !E.ownStop(byIdHere.get(String(m)), picked)).forEach(m => sightIds.push(String(m))); });
      const eatIds = fit.seq.filter(s => s.eatKey).map(s => s.eatKey).concat(dinner ? [dinner.eatKey] : []);
      sightIds.forEach(id => ledger.claimSight(id, i)); eatIds.forEach(k => ledger.claimEat(k, i));
      // Unknown opening hours are never read as open (Nov 19 review), by the one rule above: every planned stop that needs hours
      // and has none known for the date is marked, and the plan says to check.
      const noHours = plan.items.filter(x => x.t === "stop" && needById.get(String(x.id)) && !hoursKnown(x.id));
      noHours.forEach(x => { x.hoursUnknown = true; });
      if (noHours.length) explain.push("Opening hours aren't known for " + E.listWords(noHours.slice(0, 3).map(x => String(x.name).split(",")[0]), "and") + (noHours.length > 3 ? " and " + (noHours.length - 3) + " more" : "") + " on this date: planned between " + E.clock(E.ASSUME_OPEN) + " and " + E.clock(E.ASSUME_CLOSE) + ", check before you go.");
      // Only the traveler's own picks are "didn't fit" (Nov 20 tester: a leaving day with no picks said "Didn't fit today:
      // an abbey. Your picks are over today's time.").
      plan.folded = [].concat(...fit.kept.map(s => (s.folded || []).map(x => x.id)));
      // A visit that didn't fit takes what was folded into it along (never dropped silently).
      plan.dropped = d.wantsOnly ? [] : [].concat(...fit.dropped.map(x => [x.id].concat(((picks.find(p => String(p.id) === String(x.id)) || {}).folded || []).map(f => f.id)))); if (Object.keys(ways).length) plan.waysToFit = ways; plan.explain = explain.concat(lunchNote ? [lunchNote] : []);
      return { plan, sightIds, eatIds, kept: fit.kept, autoIds: [...autoIds], explain, spare: win.endBy - fit.r.end, win };
    };
    const done = new Array(days.length).fill(null);
    // A day marked alone (the Sights list asking whether one sight fits) is the only day planned: the other days still
    // count for which picks move where, but their plans are not made.
    const only = days.findIndex(d => d.alone), skip = i => only >= 0 && i !== only;
    for (const i of order) { if (skip(i)) { done[i] = { plan: null, sightIds: [], eatIds: [], kept: [] }; continue; } done[i] = planDay(i, null); out[i] = done[i].plan; }
    // Second pass: a day with spare time takes sights no day used (an area's leftovers, a later day's surplus).
    for (const i of order) {
      const was = done[i], d = days[i];
      if (skip(i) || !was.kept || was.win.straight || d.fillTime === false || d.cleared) continue;
      was.sightIds.forEach(id => ledger.release(id, i)); was.eatIds.forEach(k => ledger.releaseEat(k, i));
      const keepsAll = r => r.kept && was.kept.every(s => r.kept.some(k => String(k.id) === String(s.id)));
      const undo = r => { if (r.sightIds) { r.sightIds.forEach(id => ledger.release(id, i)); r.eatIds.forEach(k => ledger.releaseEat(k, i)); } };
      // Only worth replanning when there is time left and an unused sight in this place.
      const cityNow = guides[d.city] || {};
      const unused = (cityNow.sites || []).some(s => ledger.sightFree(s.id, i) && !was.kept.some(k => String(k.id) === String(s.id)));
      let now = null;
      if (was.spare >= 30 && unused) {
        now = planDay(i, was);
        if (!(keepsAll(now) && now.kept.length > was.kept.length)) { undo(now); if (was.plan && was.plan.suggest && now.plan && now.plan.suggest) now.plan.suggest.forEach(x => { if (!was.plan.suggest.some(y => String(y.id) === String(x.id))) was.plan.suggest.push(x); }); now = null; } // what would fit, seen with the other days planned
      }
      // A trip out to the best farther sight nobody has used, when it gives more than the sights it replaces (the
      // traveler's own picks always stay). On a ship, train or plane day only by road, an hour at most each way, and only
      // when the day still ends 45 minutes before the time to be back: the app adds no boat there on its own (boats keep
      // their own timetable), it names it instead.
      // How far a trip out is: from the nearest of the day's start and the stops it already has (Rome's sights from the
      // Colosseum, not from the ship two hours away).
      const from0 = was.win.head[was.win.head.length - 1], near = [from0].concat(was.kept.filter(k => isFinite(k.lat)));
      const away = s => Math.min(...near.map(a => tr.min(a, s)));
      const shortRoad = s => away(s) <= 60 && !E.byBoat(s.travelNote || "");
      // A boat trip the guide times (its crossing), kept only when the day still ends an hour before the time to be back.
      const boatOk = s => E.byBoat(s.travelNote || "") && tr.saidMin(s.travelNote) > 0 && tr.saidMin(s.travelNote) <= 90;
      // Trips out already planned on the stay's other days.
      const otherDayFar = (s, here) => (byCity.get(d.city) || []).some(j => j !== here && done[j] && done[j].kept.some(k => k.far && isFinite(k.lat) && E.hav(k, s) <= 15));
      const worthOf = r => r.kept.reduce((a, k) => a + (k.worth || 0), 0);
      const city = guides[d.city] || {}, far = E.rank((city.farther || []).map(s => Object.assign({}, s, { far: true })), prefs, style)
        .filter(s => !s.town && ledger.sightFree(s.id, i) && !wishDay.has(String(s.id)) && !was.kept.some(k => String(k.id) === String(s.id)) && (!(now || was).kept.some(k => k.far) || (now || was).kept.some(k => k.far && isFinite(k.lat) && E.hav(k, s) <= 15)))
        // a quick look first: there and back plus the visit must fit in the day at all
        .filter(s => 2 * away(s) + (s.minutes || 60) <= (was.win.sightTo || was.win.endBy) - (was.win.sightFrom || was.win.start))
        // A city day is padded only with a short trip out (45 minutes or less each way, like a metro ride to a basilica
        // across town). A longer one is a day trip: it gets a day of its own or is named as free time, never tacked
        // onto a full day in town. Nor a sight beside a trip out planned on another day (it belongs to that day).
        .filter(s => away(s) <= E.PAD_MAX && !otherDayFar(s, i))
        .filter(s => !was.win.hard || shortRoad(s) || boatOk(s)).slice(0, 3);
      // Spare time is the traveler's: a trip out that would fit is named for them to add, never added on its own
      // (Nov 18, Richard: "Just let them select to fill the spots").
      if (was.plan && was.plan.suggest && was.plan.noLunch !== "time") for (const f of far) if (was.spare >= 2 * away(f) + (f.minutes || 60) + (was.win.hard ? 45 : 0) && !was.plan.suggest.some(x => String(x.id) === String(f.id)))
        was.plan.suggest.push({ id: f.id, name: f.name, minutes: f.minutes || 60, far: true, rideMin: Math.round(away(f)), must: !!(f.mustSee || E.has(f, "must-see")), voiced: !!f.hasGuide });
      // must-sees and voiced tours first, each marked (a stable sort keeps the rest in the order found)
      if (was.plan && was.plan.suggest) was.plan.suggest.sort((a, b) => (b.must || b.voiced ? 1 : 0) - (a.must || a.voiced ? 1 : 0));
      if (now) { done[i] = now; out[i] = now.plan; continue; }
      // Time left on a ship day and a trip out by boat the guide names: say so, with the time to be back on shore.
      if (was.win.hard && d.type === "port" && was.plan && was.plan.items) {
        const boat = E.rank((city.farther || []).map(s => Object.assign({}, s, { far: true })), prefs, style)
          .find(s => !s.town && E.byBoat(s.travelNote || "") && ledger.sightFree(s.id, i) && !was.kept.some(k => String(k.id) === String(s.id)) && 2 * (tr.saidMin(s.travelNote) || 60) + (s.minutes || 60) + 60 <= was.spare);
        if (boat) was.plan.explain = (was.plan.explain || []).concat(["Time left for " + boat.name + (boat.travelNote ? " (" + String(boat.travelNote).replace(/[.\s]+$/, "") + ")" : "") + ": not added on its own, since boats keep their own timetable. If you go, take a boat back that lands you by " + E.clock(was.win.endBy - 30) + "."]);
      }
      was.sightIds.forEach(id => ledger.claimSight(id, i)); was.eatIds.forEach(k => ledger.claimEat(k, i));
    }
    // Never a silent gap: on a place seen one day only, the sights with their own finished tour or a must-see that no day
    // could fit are named, so the traveler knows they were weighed, not missed.
    const plannedIds = new Set(); out.forEach(p => p && p.items && p.items.forEach(x => { if (x.t === "stop") plannedIds.add(String(x.id)); }));
    out.forEach((p, i) => { if (!p || !p.items || p.safe) return; const d = days[i], city = guides[d.city]; if (!city || (byCity.get(d.city) || []).length !== 1) return;
      const said = (p.explain || []).join(" "), left = (city.sites || []).filter(s => E.ownStop(s) && !plannedIds.has(String(s.id)) && !said.includes(s.name));
      if (!left.length) return; p.leftOut = left.map(s => s.id);
      const names = left.slice(0, 4).map(s => s.name).concat(left.length > 4 ? [(left.length - 4) + " more"] : []);
      p.explain = (p.explain || []).concat([(d.own ? "Also worth seeing here, not on your list: " : "Also worth seeing here, but not in today's time: ") + E.listWords(names, "and") + "."]); });
    // Never a silent gap of time either: an hour or more left at the end of a day are named as free time,
    // with the nearest trip out nobody took and why it wasn't added (it doesn't fit, or not with a safe margin).
    const hm = m => { const h = Math.floor(m / 60), r = Math.round(m % 60); return (h ? h + " h" : "") + (h && r ? " " : "") + (r ? r + " min" : ""); };
    out.forEach((p, i) => { if (!p || !p.items || p.safe || !isFinite(p.end) || !isFinite(p.endBy)) return;
      const free = p.endBy - p.end, win = wins[i]; if (free < 60 || !win) return;
      const said = (p.explain || []).join(" "); if (/free time|time left/i.test(said)) return;
      const d = days[i], city = guides[d.city] || {}, from = win.head[win.head.length - 1];
      const stops = p.items.filter(x => x.t === "stop" && isFinite(x.lat)), near = [from].concat(stops);
      const away = s => Math.min(...near.map(a => tr.min(a, s)));
      const fars = (city.farther || []).filter(s => !s.town && isFinite(s.lat) && !plannedIds.has(String(s.id)) && !said.includes(s.name))
        .map(s => ({ s, need: 2 * away(s) + (s.minutes || 60) })).sort((a, b) => a.need - b.need), far = fars[0];
      if (!stops.length && !far) { p.explain = (p.explain || []).concat([`Nothing left to plan here: every sight in the guide for ${city.name || "this place"} is on your other day${(byCity.get(d.city) || []).length > 2 ? "s" : ""}. The day is yours until ${E.clock(p.endBy)}.`]); return; }
      let why = "";
      // On a day the traveler made their own, the free time is theirs: no reasons why the app didn't add a trip out.
      if (far && !d.own) why = far.need > free ? ` ${far.s.name} needs about ${hm(far.need)} there and back with the visit, more than the time left.`
        // The real reason, never a stand-in (Fable review #13: "to keep a safe margin" with over two hours free): too tight
        // to leave a safe margin, or it fits and is the traveler's to pick (the app never adds sights on its own).
        : win.hard && free - far.need < E.FILL_MARGIN ? ` ${far.s.name} needs about ${hm(far.need)} there and back with the visit, which would leave under ${E.FILL_MARGIN} min before the time to be back: too tight.`
        : win.hard ? ` ${far.s.name} (about ${hm(far.need)} there and back with the visit) fits in the time left: pick it to plan it.`
        : ` ${far.s.name} (about ${hm(far.need)} there and back with the visit) is a trip of its own: pick it for a day to plan it.`;
      if (fars[1] && !d.own) why += ` Also a trip of its own: ${fars[1].s.name}, about ${hm(fars[1].need)}.`;
      p.explain = (p.explain || []).concat([`Free time: about ${hm(free)} left after the last stop, before ${win.hard ? "the time to be back" : "the day ends"} (${E.clock(p.endBy)}). Linger where you like.${why}`]); });
    // A sight offered for free time is never one planned on any day.
    out.forEach(p => { if (p && p.suggest) p.suggest = p.suggest.filter(x => !plannedIds.has(String(x.id))); });
    // Each thing said once.
    out.forEach(p => { if (p && p.explain) p.explain = p.explain.filter((t, k, a) => a.indexOf(t) === k); });
    // Each line's kind, for the screens: "act" when the traveler has something to decide or do, "free" for the time left,
    // "info" for the rest. Read from the planner's own sentences, in one place.
    out.forEach(p => { if (p && p.explain) p.explainKind = p.explain.map(E.explainKind); });
    return out;
  };
  // The whole trip, place by place. Days in different places share nothing (a sight, a place to eat and a day trip
  // belong to one place; places that share a sight, like two ports with the same day trip, are planned together), so
  // each place's days are planned on their own and kept: a change on one day replans only the days of its place, and
  // checking whether a sight fits (the Sights list asks for every sight after every tick) replans one place, not the
  // whole trip. Kept plans are reused only when everything they were made from is the same, ride answers included.
  // A day planned alone keeps its plans apart, so the Sights list's many quick checks never push out the whole plans.
  const kept = new Map(), keptAlone = new Map(), KEEP = 30;
  // The guides one day is planned from: its own place's and those of places sharing a sight with it (planned together).
  // A day planned alone needs no other guide, so the app copies no other.
  E.citiesFor = (bucket, i) => {
    const all = bucket.cities || {}, own = ((bucket.days || [])[i] || {}).city; if (own == null || !all[own]) return all;
    const idsOf = c => [].concat(c.sites || [], c.farther || []).map(x => String(x.id)), mine = new Set(idsOf(all[own])), keep = { [own]: all[own] };
    for (let grew = true; grew;) { grew = false;
      for (const [k, c] of Object.entries(all)) if (!keep[k] && idsOf(c).some(id => mine.has(id))) { keep[k] = c; idsOf(c).forEach(id => mine.add(id)); grew = true; } }
    return keep;
  };
  E.planTrip = bucket => {
    const days = bucket.days || [], cities = bucket.cities || {}, out = new Array(days.length).fill(null);
    const ids = key => { const c = cities[key] || {}; return (c.sites || []).concat(c.farther || []).map(x => String(x.id)); };
    // Places joined when they share a sight.
    const keys = [...new Set(days.map(d => d.city))], root = new Map(keys.map(k => [k, k])), owner = new Map();
    const top = k => { while (root.get(k) !== k) k = root.get(k); return k; };
    keys.sort((a, b) => String(a).localeCompare(String(b))).forEach(k => ids(k).forEach(id => { const o = owner.get(id); if (o == null) owner.set(id, k); else { const a = top(o), b = top(k); if (a !== b) root.set(b, a); } }));
    const groups = new Map(); days.forEach((d, i) => { const g = top(d.city); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(i); });
    const lines = bucket.transit && bucket.transit.length ? E.linesKey(bucket.transit) : "";
    for (const idx of groups.values()) {
      if (days.some(d => d.alone) && !idx.some(i => days[i].alone)) continue;
      const gk = [...new Set(idx.map(i => days[i].city))], sub = {};
      for (const k in bucket) if (k !== "days" && k !== "cities" && k !== "answers" && k !== "transit" && k !== "placeNotes") sub[k] = bucket[k];
      sub.days = idx.map(i => days[i].i != null ? days[i] : Object.assign({}, days[i], { i }));
      sub.cities = {}; gk.forEach(k => { if (cities[k]) sub.cities[k] = cities[k]; });
      sub.placeNotes = (bucket.placeNotes || []).filter(n => idx.some(i => n.day === (days[i].i != null ? days[i].i : i)));
      const sig = JSON.stringify(sub) + "|" + lines;
      const store = idx.some(i => days[i].alone) ? keptAlone : kept;
      let got = store.get(sig);
      if (got && got.asked.every(([a, b, was]) => JSON.stringify(bucket.answers ? bucket.answers(a, b) : null) === was)) { store.delete(sig); store.set(sig, got); }
      else {
        const asked = [];
        if (bucket.answers) sub.answers = (a, b) => { const r = bucket.answers(a, b); asked.push([a, b, JSON.stringify(r)]); return r; };
        if (bucket.transit) sub.transit = bucket.transit;
        const plans = planAll(sub); plans.forEach((p, k) => { if (p) p.i = idx[k]; });
        got = { plans, asked }; store.set(sig, got); if (store.size > KEEP) store.delete(store.keys().next().value);
      }
      idx.forEach((i, k) => { out[i] = got.plans[k]; });
    }
    return out;
  };
})(KEngine);
