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
    const anchor = free[0], budget = (win.endBy - (win.sightFrom || win.start) - (lunchWanted(win) ? E.MEALS[0].len : 0)) * 0.75;
    const near = free.filter(s => E.hav(anchor, s) <= AREA_KM).map(s => ({ s, v: (s.worth || 0) - 20 * E.hav(anchor, s) }))
      .sort((a, b) => b.v - a.v || E.byId(a.s, b.s));
    const out = []; let used = 0;
    for (const { s } of near) { const cost = (s.minutes || 30) + 12; if (out.length && used + cost > budget) continue; out.push(s); used += cost; }
    return out;
  }
  const point = p => p && isFinite(p.lat) ? { lat: p.lat, lng: p.lng } : {};
  // The plan in the short form the scorer and the screens read (the same shape as the old engine's, for side by side).
  function shortForm(i, win, fit, autoIds, dinner) {
    const byId = new Map(fit.seq.map(s => [String(s.id), s])), items = [];
    for (const x of fit.r.items) {
      if (x.t === "ride") { items.push({ t: "ride", mode: x.mode, min: x.min, km: x.km }); continue; }
      const src = x.id != null ? byId.get(String(x.id)) : null;
      const it = { t: x.t, id: x.t === "meal" ? null : x.id, name: x.name, at: x.at, min: x.min, bonus: x.t === "stop" && autoIds.has(String(x.id)), along: false, meal: x.meal || null, late: x.late || 0 };
      if (x.wait) it.wait = x.wait;
      Object.assign(it, point(src || (x.t === "start" ? win.head[0] : x.t === "end" ? win.tail[win.tail.length - 1] : null)));
      items.push(it);
    }
    if (dinner) items.push({ t: "evening", id: null, name: dinner.name, at: dinner.at, min: dinner.min, lat: dinner.lat, lng: dinner.lng, bonus: false, along: false, meal: "Dinner", late: 0 });
    return { i, start: win.start, endBy: win.endBy, end: fit.r.end, over: fit.r.over > 0, straight: !!win.straight,
      head: win.head.map(x => ({ name: x.name, fixed: !!x.fixed, minutes: x.fixed ? x.minutes : 0 })), tail: win.tail.map(x => ({ name: x.name, fixed: !!x.fixed, minutes: x.fixed ? x.minutes : 0 })), items };
  }
  // Step 8: the final guard. Any broken safety rule turns the day into a safe day that says why.
  function guard(plan, win) {
    const why = [];
    if (win.hard && plan.end > win.endBy) why.push("would end " + (plan.end - win.endBy) + " min after the time to be back");
    plan.items.forEach(x => { if (x.t === "stop" && x.late) why.push(x.name + " reached after its last entry"); if (win.hard && x.t === "stop" && x.at + (x.min || 0) > win.endBy) why.push(x.name + " runs past the time to be back"); });
    return why;
  }
  function safeDay(i, win, tr, why) {
    const r = E.walkDay([], win, tr.estimate, null);
    return Object.assign(shortForm(i, win, { seq: [], r }, new Set(), null), { safe: true, explain: ["Kept to the safe minimum: " + why.join("; ") + "."] });
  }
  E.planTrip = bucket => {
    const prefs = bucket.prefs || {}, style = bucket.style || "mix", tr = E.makeTravel(prefs, bucket.legModes, bucket.legs), ledger = E.makeLedger();
    const guides = bucket.cities || {}, days = bucket.days || [], out = new Array(days.length).fill(null);
    const order = days.map((d, i) => i).sort((a, b) => (days[b].locked ? 1 : 0) - (days[a].locked ? 1 : 0) || a - b);
    // A sight the traveler picked for a day is kept for that day: no other day adds it on its own.
    const wishDay = new Map();
    for (const i of order) for (const id of days[i].selected || []) if (!wishDay.has(String(id))) wishDay.set(String(id), i);
    // Step 6a: a stay of several days in one place is split into areas, one per day.
    const areaDay = new Map(), dayTrip = new Map(), wins = days.map(d => (d.noShore || d.type === "sea") ? null : E.dayWindow(d, tr));
    const byCity = new Map();
    days.forEach((d, i) => { const w = wins[i]; if (!w || w.error || w.straight || !guides[d.city]) return; if (!byCity.has(d.city)) byCity.set(d.city, []); byCity.get(d.city).push(i); });
    for (const [key, idx] of [...byCity].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
      if (idx.length < 2) continue;
      const city = guides[key], ranked = E.rank((city.sites || []).map((s, k) => Object.assign({}, s, { rank: k })), prefs, style);
      const groups = E.makeGroups(ranked), sights = ranked.filter(s => !s.far && E.allowed(s, prefs, null, null) && !groups.groupOf.has(String(s.id)));
      const byId = new Map(ranked.map(s => [String(s.id), s]));
      const farRanked = E.rank((city.farther || []).map(s => Object.assign({}, s, { far: true })), prefs, style).filter(s => E.allowed(s, prefs, null, null));
      const allById = new Map(E.rank((city.farther || []).map(s => Object.assign({}, s, { far: true })), prefs, style).concat(ranked).map(s => [String(s.id), s]));
      // A day trip the traveler picked takes its own time (there and back, and the visit) out of that day's share.
      const stay = idx.map(i => {
        const own = (days[i].selected || []).filter(id => wishDay.get(String(id)) === i).map(id => allById.get(String(id))).filter(s => s && isFinite(s.lat));
        const away = own.filter(s => s.far).reduce((a, s) => a + (s.minutes || 60) + 2 * tr.min(wins[i].head[wins[i].head.length - 1], s), 0);
        return { i, free: (isFinite(wins[i].sightTo) ? wins[i].sightTo : wins[i].endBy) - (wins[i].sightFrom || wins[i].start) - away, wishes: own.filter(s => !s.far), picked: own.length };
      });
      const home = wins[idx[0]].head[wins[idx[0]].head.length - 1];
      // The traveler already picked a day out of town on this stay: the app adds no other on its own.
      const pickedFar = idx.some(i => (days[i].selected || []).some(id => { const s = allById.get(String(id)); return s && s.far; }));
      const outing = pickedFar ? null : E.pickDayTrip(stay.map(x => Object.assign({}, x, { wishes: x.picked ? [1] : [] })), sights, farRanked.filter(s => !wishDay.has(String(s.id))), s => tr.min(home, s), AREA_KM);
      if (outing) { dayTrip.set(outing.day, outing.ids); outing.ids.forEach(id => areaDay.set(key + "|" + id, outing.day)); }
      const split = E.splitAreas(stay.filter(x => !outing || x.i !== outing.day), sights);
      split.forEach((v, k) => areaDay.set(key + "|" + k, v));
    }
    // Plan one day. again: the day's stops from the first pass, now free to fill from any sight still unused.
    const planDay = (i, again) => {
      const d = days[i];
      if (d.noShore || d.type === "sea") return { plan: { i, error: "At sea or staying aboard: no time ashore." } };
      const win = wins[i];
      if (win.error) return { plan: { i, error: win.error } };
      const city = guides[d.city];
      if (!city) return { plan: { i, error: "no guide" } };
      const siteDay = id => (d.sites || {})[id] || null;
      const listed = (city.sites || []).map((s, k) => Object.assign({}, s, { rank: k })).concat((city.farther || []).map(s => Object.assign({}, s, { far: true })));
      const ranked = E.rank(listed, prefs, style);
      const ctx = { tr, ledger, dayIdx: i, siteDay, eats: (city.restaurants || []).slice().sort((a, b) => E.eatKey(a.name).localeCompare(E.eatKey(b.name))), eatFacts: d.eats || {} };
      // May this day add a sight on its own? Not one used on another day, picked for another day, or in another
      // day's area, unless that day is already planned and left it over.
      const doneDay = j => j == null || j === i || out[j] != null;
      ctx.mayAdd = id => ledger.sightFree(id, i) && doneDay(wishDay.get(String(id))) && doneDay(areaDay.get(d.city + "|" + id));
      const groups = E.makeGroups(ranked), memberOfPicked = id => { const g = groups.groupOf.get(String(id)); return g != null; };
      const pool = ranked.filter(s => E.allowed(s, prefs, siteDay(s.id), win) && !memberOfPicked(s.id));
      const explain = [], wishes = [];
      let picks = null, autoIds;
      if (again) {
        picks = again.kept.slice(); autoIds = new Set(again.autoIds); explain.push(...again.explain);
        const extra = again.extra && pool.find(s => String(s.id) === String(again.extra));
        if (extra) { picks.push(extra); autoIds.add(String(extra.id)); explain.push("With time to spare, a trip out to " + extra.name + "."); }
      }
      else {
        for (const id of d.selected || []) {
          const s = ranked.find(x => String(x.id) === String(id)); if (!s) continue;
          const on = ledger.sightDay(s.id);
          if (on != null && on !== i) { explain.push(s.name + " is planned on another day."); continue; }
          if (!E.allowed(s, prefs, siteDay(s.id), win)) { explain.push(s.name + " is closed or can't be visited this day."); continue; }
          wishes.push(Object.assign({}, s, { wish: true }));
        }
        const tripIds = !wishes.length && dayTrip.get(i);
        if (tripIds) {
          picks = tripIds.map(id => pool.find(s => String(s.id) === id)).filter(Boolean);
          if (picks.length) explain.push("A day trip to " + picks[0].name + ": the main sights in town fit on your other days.");
        }
        if (!picks || !picks.length) picks = wishes.length ? wishes : autoPicks(pool, win, ctx);
        autoIds = new Set(wishes.length ? [] : picks.map(s => String(s.id)));
      }
      const fit = E.fitDay(d, win, picks, pool, ctx);
      fit.kept.forEach(s => { if (s.filled) autoIds.add(String(s.id)); });
      if (!again) fit.dropped.forEach(x => { if (x.wish) explain.push(x.name + " " + x.why + "."); });
      const last = fit.seq.length ? fit.seq[fit.seq.length - 1] : win.head[0];
      const dinner = E.dinnerAfter(win, win.tail.length ? win.tail[win.tail.length - 1] : last, fit.r.end, ctx, new Set(fit.seq.filter(s => s.eatKey).map(s => s.eatKey)));
      const lunchNote = fit.noLunch ? (fit.noLunch === "time" ? "No time for a sit-down lunch on this plan: grab something quick on the way." : "No place to eat along the way at lunchtime: bring food or eat at a stop's own café.") : null;
      const plan = shortForm(i, win, fit, autoIds, dinner);
      const bad = guard(plan, win);
      if (bad.length) return { plan: safeDay(i, win, tr, bad) };
      const sightIds = [];
      fit.kept.forEach(s => { sightIds.push(String(s.id)); (groups.members.get(String(s.id)) || []).forEach(m => sightIds.push(String(m))); });
      const eatIds = fit.seq.filter(s => s.eatKey).map(s => s.eatKey).concat(dinner ? [dinner.eatKey] : []);
      sightIds.forEach(id => ledger.claimSight(id, i)); eatIds.forEach(k => ledger.claimEat(k, i));
      plan.dropped = fit.dropped.map(x => x.id); plan.explain = explain.concat(lunchNote ? [lunchNote] : []);
      return { plan, sightIds, eatIds, kept: fit.kept, autoIds: [...autoIds], explain, spare: win.endBy - fit.r.end, win };
    };
    const done = new Array(days.length).fill(null);
    for (const i of order) { done[i] = planDay(i, null); out[i] = done[i].plan; }
    // Second pass: a day with spare time takes sights no day used (an area's leftovers, a later day's surplus).
    for (const i of order) {
      const was = done[i], d = days[i];
      if (!was.kept || was.win.straight || d.fillTime === false) continue;
      was.sightIds.forEach(id => ledger.release(id, i)); was.eatIds.forEach(k => ledger.releaseEat(k, i));
      const keepsAll = r => r.kept && was.kept.every(s => r.kept.some(k => String(k.id) === String(s.id)));
      const undo = r => { if (r.sightIds) { r.sightIds.forEach(id => ledger.release(id, i)); r.eatIds.forEach(k => ledger.releaseEat(k, i)); } };
      // Only worth replanning when there is time left and an unused sight in this place.
      const cityNow = guides[d.city] || {};
      const unused = (cityNow.sites || []).some(s => ledger.sightFree(s.id, i) && !was.kept.some(k => String(k.id) === String(s.id)));
      let now = null;
      if (was.spare >= 30 && unused) {
        now = planDay(i, was);
        if (!(keepsAll(now) && now.kept.length > was.kept.length)) { undo(now); now = null; }
      }
      // A trip out to the best farther sight nobody has used, when it gives more than the sights it replaces (the
      // traveler's own picks always stay). Never on a ship, train or plane day: the app adds no long ride on its own there.
      const worthOf = r => r.kept.reduce((a, k) => a + (k.worth || 0), 0);
      const city = guides[d.city] || {}, far = E.rank((city.farther || []).map(s => Object.assign({}, s, { far: true })), prefs, style)
        .filter(s => ledger.sightFree(s.id, i) && !wishDay.has(String(s.id)) && !(now || was).kept.some(k => k.far))
        // a quick look first: there and back plus the visit must fit in the day at all
        .filter(s => 2 * tr.min(was.win.head[was.win.head.length - 1], s) + (s.minutes || 60) <= (was.win.sightTo || was.win.endBy) - (was.win.sightFrom || was.win.start))
        .slice(0, was.win.hard ? 0 : 3);
      const wished = was.kept.filter(k => !k.filled); // only what the app added to fill spare time may give way
      for (const f of far) {
        const cur = now || was;
        if (now) undo(now);
        const r = planDay(i, Object.assign({}, was, { kept: wished, extra: f.id }));
        const better = r.kept && wished.every(w => r.kept.some(k => String(k.id) === String(w.id))) && r.kept.some(k => String(k.id) === String(f.id)) && worthOf(r) > worthOf(cur);
        if (better) { now = r; continue; }
        undo(r);
        if (now) now.sightIds.forEach(id => ledger.claimSight(id, i)), now.eatIds.forEach(k => ledger.claimEat(k, i));
      }
      if (now) { done[i] = now; out[i] = now.plan; continue; }
      was.sightIds.forEach(id => ledger.claimSight(id, i)); was.eatIds.forEach(k => ledger.claimEat(k, i));
    }
    return out;
  };
})(KEngine);
