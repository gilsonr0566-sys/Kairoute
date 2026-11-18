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
  function shortForm(i, win, fit, autoIds, dinner) {
    const byId = new Map(fit.seq.map(s => [String(s.id), s])), items = [];
    for (const x of fit.r.items) {
      if (x.t === "ride") { items.push(Object.assign({ t: "ride", mode: x.mode, min: x.min, km: x.km }, x.options ? { how: x.how, options: x.options } : {})); continue; }
      // Each ride knows where it starts and ends (the map draws each one apart, out and back side by side).
      const prev = items[items.length - 1], here = point(x.id != null ? byId.get(String(x.id)) : (x.t === "start" ? win.head[0] : x.t === "end" ? win.tail[win.tail.length - 1] : null));
      if (prev && prev.t === "ride" && items.length >= 2) { const a = items[items.length - 2]; if (isFinite(a.lat) && isFinite(here.lat)) Object.assign(prev, { from: { lat: a.lat, lng: a.lng }, to: here }); }
      const src = x.id != null ? byId.get(String(x.id)) : null;
      const it = { t: x.t, id: x.t === "meal" ? null : x.id, name: x.name, at: x.at, min: x.min, bonus: x.t === "stop" && autoIds.has(String(x.id)), along: false, meal: x.meal || null, late: x.late || 0 };
      if (x.wait) it.wait = x.wait; if (x.chosen) it.chosen = true; if (x.pinned) it.pinned = true;
      Object.assign(it, point(src || (x.t === "start" ? win.head[0] : x.t === "end" ? win.tail[win.tail.length - 1] : null)));
      items.push(it);
    }
    if (dinner) items.push({ t: "evening", id: null, name: dinner.name, at: dinner.at, min: dinner.min, lat: dinner.lat, lng: dinner.lng, bonus: false, along: false, meal: "Dinner", late: 0, chosen: !!dinner.chosen });
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
  // A sight inside a group (a church on a square) is folded into the group's visit, unless it is worth a stop of its
  // own: a finished guide or audio tour, a must-see, or the traveler's pick. Then it is always its own stop.
  E.ownStop = (s, picked) => !!(s && (s.hasGuide || s.mustSee || E.has(s, "must-see") || (picked && picked.has(String(s.id)))));
  E.listWords = (xs, joiner) => xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " " + (joiner || "or") + " " + xs[xs.length - 1];
  E.planTrip = bucket => {
    const prefs = bucket.prefs || {}, style = bucket.style || "mix", tr = E.makeTravel(prefs, bucket.legModes, bucket.legs, bucket.transit), ledger = E.makeLedger();
    const guides = bucket.cities || {}, days = bucket.days || [], out = new Array(days.length).fill(null);
    const wins = days.map(d => (d.noShore || d.type === "sea") ? null : E.dayWindow(d, tr));
    // A pick closed on its own day moves to another day in the same place when it's open then (never onto or off a
    // day the traveler locked), and the plan says so.
    const sel = days.map(d => (d.selected || []).slice()), movedTo = new Map();
    const findSite = (city, id) => city && ((city.sites || []).find(s => String(s.id) === String(id)) || (city.farther || []).find(s => String(s.id) === String(id)));
    const openOn = (s, j) => wins[j] && !wins[j].error && E.allowed(s, prefs, (days[j].sites || {})[s.id] || null, wins[j]);
    days.forEach((d, i) => { if (d.locked || !wins[i] || wins[i].error) return; const city = guides[d.city];
      for (const id of (d.selected || []).slice().sort()) { const s = findSite(city, id); if (!s || openOn(s, i)) continue;
        const j = days.findIndex((e, k) => k !== i && e.city === d.city && !e.locked && openOn(s, k) && !sel[k].map(String).includes(String(id)));
        if (j < 0) continue; sel[i] = sel[i].filter(x => String(x) !== String(id)); sel[j].push(id); movedTo.set(String(id), { from: i, to: j, name: s.name }); } });
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
      // A town a day away whose travel guide names places to eat gets a lunch stop in its centre (the plan names the
      // guide's suggestions); it is never a dinner idea.
      const townLunch = (city.farther || []).filter(t => !t.town && (t.foodDrink || []).length && isFinite(t.lat)).map(t => ({ name: "Lunch in " + t.name, lat: t.lat, lng: t.lng, townLunch: t.id }));
      const ctx = { single: (byCity.get(d.city) || [i]).length === 1, tr, ledger, dayIdx: i, siteDay, eats: (city.restaurants || []).concat(townLunch).sort((a, b) => E.eatKey(a.name).localeCompare(E.eatKey(b.name))), eatFacts: d.eats || {}, mealPrefs: d.mealPrefs || {} };
      // May this day add a sight on its own? Not one used on another day, picked for another day, or in another
      // day's area, unless that day is already planned and left it over.
      const doneDay = j => j == null || j === i || out[j] != null;
      ctx.mayAdd = id => ledger.sightFree(id, i) && doneDay(wishDay.get(String(id))) && doneDay(areaDay.get(d.city + "|" + id));
      const picked = new Set(sel[i].map(String));
      const groups = E.makeGroups(ranked), folded = s => groups.groupOf.get(String(s.id)) != null && !E.ownStop(s, picked);
      const pool = ranked.filter(s => E.allowed(s, prefs, siteDay(s.id), win) && !folded(s));
      const explain = [], wishes = [];
      let picks = null, autoIds;
      if (again) {
        picks = again.kept.slice(); autoIds = new Set(again.autoIds); explain.push(...again.explain);
        const extra = again.extra && pool.find(s => String(s.id) === String(again.extra));
        if (extra) { picks.push(extra); autoIds.add(String(extra.id)); explain.push("With time to spare, a trip out to " + extra.name + "."); }
      }
      else {
        (bucket.placeNotes || []).filter(n => n.day === d.i || n.day === i).forEach(n => explain.push(n.note));
        if (win.leaveEarly) explain.push("Leave by " + E.clock(win.start) + ", " + win.leaveEarly + " min before your planned start of " + E.clock(win.plannedStart) + ", to be " + (d.type === "embark" ? "at the cruise terminal" : "there") + " by " + E.clock(win.endBy) + ".");
        for (const [id, m] of movedTo) if (m.from === i) explain.push(m.name + " is closed on " + dayWord(i) + ", so it's planned on " + dayWord(m.to) + ".");
        for (const id of sel[i]) {
          const s = ranked.find(x => String(x.id) === String(id)); if (!s) continue;
          const on = ledger.sightDay(s.id);
          if (on != null && on !== i) { explain.push(s.name + " is planned on another day."); continue; }
          if (!E.allowed(s, prefs, siteDay(s.id), win)) { explain.push(s.name + " is closed or can't be visited this day."); continue; }
          wishes.push(Object.assign({}, s, { wish: true }));
        }
        const tripIds = !wishes.length && dayTrip.get(i);
        if (tripIds) {
          picks = tripIds.map(id => pool.find(s => String(s.id) === id)).filter(Boolean);
          const place = picks.find(s => !s.town) || picks[0];
          if (picks.length) explain.push("A day trip to " + (place.townName || place.name) + ": the main sights of " + String(city.name || "this place").split(",")[0] + " fit on your other days.");
        }
        if (!picks || !picks.length) picks = wishes.length ? wishes : autoPicks(pool, win, ctx);
        autoIds = new Set(wishes.length ? [] : picks.map(s => String(s.id)));
      }
      const fit = E.fitDay(d, win, picks, pool, ctx);
      fit.kept.forEach(s => { if (s.filled) autoIds.add(String(s.id)); });
      // A wanted stop the day had to give up (a pick, a finished guide, a must-see) comes with the ways to fit it back in.
      const ways = {};
      if (!again) fit.dropped.forEach(x => { if (!x.wish && !x.wanted) return;
        const w = x.why === "didn't fit in the time" ? E.waysToFit(win, fit.kept, x.stop, ctx) : [];
        if (w.length) ways[x.id] = w;
        explain.push(x.name + " " + x.why + (w.length ? ". To fit it in: " + E.listWords(w.map(o => o.say), "or") : "") + "."); });
      fit.kept.forEach(s => { if (s.trimmed && !(again && again.kept.some(k => k.trimmed && String(k.id) === String(s.id)))) explain.push("A shorter visit to " + s.name + " (" + dur(s.minutes) + " instead of " + dur(s.trimmed) + ") so the rest of the day fits."); });
      const last = fit.seq.length ? fit.seq[fit.seq.length - 1] : win.head[0];
      const dinner = E.dinnerAfter(win, win.tail.length ? win.tail[win.tail.length - 1] : last, fit.r.end, ctx, new Set(fit.seq.filter(s => s.eatKey).map(s => s.eatKey)));
      // Out of town: the town itself (a sight inside it names its town), and what its travel guide lists to eat and drink,
      // tastings and local specialties first.
      const outStop = fit.kept.find(k => k.far), outTown = outStop && (outStop.town ? (city.farther || []).find(t => String(t.id) === String(outStop.town)) || { name: outStop.townName } : outStop);
      const eatThere = outTown && (outTown.foodDrink || []).slice().sort((a, b) => (b.special ? 1 : 0) - (a.special ? 1 : 0)).slice(0, 3).map(x => x.name);
      if (outTown && eatThere.length && !fit.noLunch) explain.push("In " + outTown.name + ", the travel guide suggests " + E.listWords(eatThere) + ".");
      const longVisit = fit.kept.filter(k => (k.minutes || 0) >= 60 && !(k.far && E.has(k, "day-trip"))).sort((a, b) => b.minutes - a.minutes || E.byId(a, b))[0];
      const lunchNote = fit.noLunch && outTown ? "Have lunch in " + outTown.name + (eatThere.length ? ": the travel guide suggests " + E.listWords(eatThere) + "." : ": its places to eat aren't in the guide yet.") : fit.noLunch ? (fit.noLunch === "time" ? (win.hard ? (fit.kept.some(k => k.wish) ? "Your picks fill" : "Today's stops fill") + " the time ashore, so there's no room for lunch and still a safe margin to get back. Grab lunch on the go between stops" + (longVisit ? ", or spend less time at " + String(longVisit.name).split(",")[0] + " to make room." : ".") : "No time for a sit-down lunch on this plan: grab lunch on the go between stops.") : "No place to eat along the way at lunchtime: bring food or eat at a stop's own café.") : null;
      // Never quietly sure: where the map gives hours for this place's sights but not for some of today's stops, say so.
      const hoursKnown = id => { const sd = siteDay(id); return !!(sd && (sd.closed || sd.allDay || (sd.oh && sd.oh.spans && sd.oh.spans.length))); };
      // Only for a stop you go into (a museum, church, palace...) or one the traveler picked: a square or a district has no door.
      const BUILDING = /museum|church|basilica|cathedral|chapel|mosque|synagogue|temple|monaster|abbey|palace|castle|fort|galler|parliament|knesset|tower|hall|house|library|aquarium|zoo/i;
      const unknownHours = fit.kept.filter(k => !k.far && !E.has(k, "open-air") && (k.wish || BUILDING.test(k.name + " " + (k.category || ""))) && !hoursKnown(k.id));
      if (unknownHours.length && (city.sites || []).some(s => hoursKnown(s.id)))
        explain.push("Opening hours for " + E.listWords(unknownHours.slice(0, 4).map(k => String(k.name).split(",")[0]).concat(unknownHours.length > 4 ? ["others"] : []), "and") + " aren't on the map yet: check before you go.");
      const plan = shortForm(i, win, fit, autoIds, dinner);
      const bad = guard(plan, win);
      if (bad.length) return { plan: safeDay(i, win, tr, bad) };
      const sightIds = [];
      const byIdHere = new Map(ranked.map(s => [String(s.id), s]));
      fit.kept.forEach(s => { sightIds.push(String(s.id)); (groups.members.get(String(s.id)) || []).filter(m => !E.ownStop(byIdHere.get(String(m)), picked)).forEach(m => sightIds.push(String(m))); });
      const eatIds = fit.seq.filter(s => s.eatKey).map(s => s.eatKey).concat(dinner ? [dinner.eatKey] : []);
      sightIds.forEach(id => ledger.claimSight(id, i)); eatIds.forEach(k => ledger.claimEat(k, i));
      plan.dropped = fit.dropped.map(x => x.id); if (Object.keys(ways).length) plan.waysToFit = ways; plan.explain = explain.concat(lunchNote ? [lunchNote] : []);
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
        .filter(s => !s.town && ledger.sightFree(s.id, i) && !wishDay.has(String(s.id)) && !(now || was).kept.some(k => k.far))
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
