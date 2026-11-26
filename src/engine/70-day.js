// Beta 2 engine, part 6c and 6d: fit one day. Takes the day's chosen stops, finds the best order, puts lunch where it
// falls (at a real place to eat, never one used on another day), repairs the order for opening hours, drops the least
// worth until the day fits its window, then fills spare time with the best unclaimed sights nearby. Every check is one
// walk through the clock (walkDay) with stable estimates, so the same inputs always give the same day.
(function (E) {
  const L = E.MEALS[0], D = E.MEALS[1];
  E.FILL_MARGIN = 15; // a sight the app adds on its own never brings a ship, train or plane day closer than this to its deadline
  const eatKeys = new Map(); // the same names are keyed again and again while a day is planned
  E.eatKey = name => { const n = String(name || ""); let k = eatKeys.get(n); if (k === undefined) { if (eatKeys.size > 50000) eatKeys.clear(); k = n.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); eatKeys.set(n, k); } return k; };
  // Penalty of a timed day: running past the end is worst, then stops reached after their last entry, then a late lunch.
  // A minute riding weighs like a minute waiting (Nov 19, Richard's day trip crossed the same stretch three times: at a tenth
  // of a wait, a long crossing was "cheaper" than a few minutes waiting for a gate to open).
  // Lunch late in the afternoon is a cost of its own (Round 1 part 3: with eight picks lunch slid to 2:10 and 2:50 pm while
  // another order of the same picks had it before 1:30): each minute lunch starts after E.LUNCH_BY weighs a little less than a
  // minute riding, so the order and the gap for lunch keep it near midday unless that costs a lot of travel.
  E.LUNCH_BY = 14 * 60;
  const penalty = E.dayCost = r => r.over * 1000 + r.late * 500 + (r.mealPen || 0) * 4 + r.waits * 0.5 + r.end * 0.01 + r.rideMin * 0.5 + (r.lunchLate || 0) * 0.4 + (r.lunchShort || 0) * 0.45 + (r.visitCut || 0);
  function walk(seq, win, ctx, from) {
    // A sight's hours for the day are read once and kept for the day's other tries (the timeline only reads them; planning time, Nov 23).
    if (ctx.siteDay && ctx.sdFor !== ctx.siteDay) { const f = ctx.siteDay, m = new Map(); ctx.sdFor = f; ctx.sdKept = id => { if (m.has(id)) return m.get(id); const v = f(id); m.set(id, v); return v; }; }
    const r = E.walkDay(seq, win, ctx.tr.estimate, ctx.siteDay && ctx.sdKept, from);
    r.lateMeal = r.items.reduce((a, x) => a + (x.lateMeal || 0), 0);
    // A meal at a time the traveler set is held like a booked table: being late for it costs ten times as much.
    r.mealPen = r.items.reduce((a, x) => a + (x.lateMeal || 0) * (x.pinned ? 10 : 1), 0);
    r.lunchLate = r.items.reduce((a, x) => a + (x.t === "meal" && x.meal === "Lunch" && !x.pinned && E.fin(x.at) ? Math.max(0, x.at - E.LUNCH_BY) : 0), 0);
    // A lunch made shorter than a sit-down lunch is a real loss, not a few minutes saved (Nov 23: with an hour to spare at the
    // end of the day, the order that squeezed lunch to 35 min to fit one more square won over the order that kept a full lunch
    // and ended later, and a day with a short lunch and the time to spare now looks for an order that gives it back): each minute lunch loses weighs about as much as a minute riding.
    r.lunchShort = r.items.reduce((a, x) => a + (x.t === "meal" && x.meal === "Lunch" && !x.booked && !x.chosen && !x.packed && x.min > 0 ? Math.max(0, E.MEALS[0].len - x.min) : 0), 0);
    // ...and never at a visit's cost: minutes a visit gives up for lunch weigh more than minutes of lunch (a visit cut in half
    // to keep a full lunch is worse than a quick lunch).
    r.visitCut = seq.reduce((a, x) => a + (x && x.lunchCut ? x.lunchCut : 0), 0);
    return r;
  }
  // Lunch belongs in a day whose sightseeing runs at least four hours and through the middle of the day.
  // A day wants lunch when it is out over lunchtime: at least two hours of sightseeing, with room in the lunch hours for at
  // least a short lunch (Nov 19, Richard: a day landing at the airport and out from 13:40 still gets lunch).
  const lunchWanted = E.lunchWanted = win => { const from = win.sightFrom || win.start, to = E.fin(win.sightTo) ? win.sightTo : win.endBy, L = E.MEALS[0];
    return to - from >= 120 && Math.min(to, L.to) - Math.max(from, L.from) >= E.TO_GO + 10; };
  // ONE hours rule for places to eat and sights alike (Nov 19 fold: lunch had its own "shut" flags and its own lunch-hour
  // spans beside the sights' hours). A place's facts for the date are { closed, oh } read the same way as a sight's; it
  // is shut for a meal when E.closedForDay says so over the meal's hours, and its timing uses E.hoursFit (part 2).
  E.eatShut = (f, label) => { const m = E.MEALS.find(x => x.label === label) || E.MEALS[0]; return E.closedForDay(f, { start: m.from, endBy: m.to }, m.quick); };
  // The nearest few real places to eat around a point that are open for this meal today and not used on another day.
  function eatsNear(p, ctx, meal, n) {
    // Within one day the list of places to eat and the ledger don't change, so each point is worked out once.
    if (!ctx.eatMemo) {
      ctx.eatMemo = new Map();
      ctx.eatList = ctx.eats.filter(r => E.fin(r.lat) && E.fin(r.lng) && !r.drop && E.mealPlace(r) && E.readable(E.latin(r.name))).map(r => { // only a name the traveler can read
        const k = E.eatKey(r.name), f = ctx.eatFacts[k] || ctx.eatFacts[r.name && r.name.toLowerCase()] || {};
        return { r, k, f };
      });
    }
    const key = meal + n + "@" + p.lat + "," + p.lng, got = ctx.eatMemo.get(key); if (got) return got;
    // Which places are open for this meal and free today doesn't depend on the point either: worked out once per meal
    // (speed, Nov 24: this scan ran for every point of every trial plan on Choose sights).
    if (!ctx.eatOpen) ctx.eatOpen = new Map();
    let open = ctx.eatOpen.get(meal);
    if (!open) { open = ctx.eatList.filter(x => !(E.eatShut(x.f, meal) || (meal !== "Lunch" && (x.r.townLunch || x.r.inTown))) && ctx.ledger.eatFree(x.k, ctx.dayIdx))
      .map(x => ({ x, add: (x.r.fromMap ? 0.4 : 0) + (E.cafeName(x.r) ? 0.6 : 0) })); ctx.eatOpen.set(meal, open); }
    const out = [];
    const bLat = 1.5 / 110, bLng = 1.5 / (110 * Math.max(0.05, Math.cos(p.lat * Math.PI / 180))); // only places within 1.5 km are kept
    for (const { x, add } of open) { if (Math.abs(x.r.lat - p.lat) > bLat || Math.abs(x.r.lng - p.lng) > bLng) continue; out.push({ r: x.r, k: x.k, d: E.hav(p, x.r) + add }); } // a guide place to eat first, a map one when it is nearer the way
    out.sort((a, b) => a.d - b.d || a.k.localeCompare(b.k));
    const res = out.slice(0, n).filter(x => x.d <= 1.5);
    ctx.eatMemo.set(key, res); return res;
  }
  // The traveler's own say on a meal (d.mealPrefs.Lunch / .Dinner): skip it, a time to hold ("13:30"), or the place.
  // A set time becomes a ten-minute window from that time; a chosen place is the only one tried, and when the guide
  // lists a place of the same name within 200 m, the guide's entry (with its facts) is the one used.
  // ONE meal input from the day: the traveler's say on each meal (d.mealPrefs: place, time, skip) with any table they booked
  // (d.booked: its place at its time) taking that meal's place and time.
  E.mealInput = d => { const out = Object.assign({}, (d && d.mealPrefs) || {});
    ((d && d.booked) || []).forEach(b => { if (!b || !b.label || !E.fin(b.from) || !b.place || !E.hasPos(b.place)) return;
      out[b.label] = { pick: { name: b.place.name || "Your table", lat: b.place.lat, lng: b.place.lng }, at: String(Math.floor(b.from / 60)).padStart(2, "0") + ":" + String(b.from % 60).padStart(2, "0"), booked: true }; });
    return out; };
  E.mealPlan = (ctx, label) => {
    const p = (ctx.mealPrefs || {})[label] || {}, base = label === "Lunch" ? L : D, at = E.toMin(p.at);
    // A booked table is held at its own time and place, whatever its listed hours (the booking is the proof it serves then).
    const meal = E.fin(at) ? Object.freeze(Object.assign({ label, from: at, to: at + 10, len: base.len, quick: base.quick, pinned: true }, p.booked ? { booked: true } : {})) : base;
    let pick = null;
    if (p.pick && E.fin(p.pick.lat) && E.fin(p.pick.lng)) {
      const k = E.eatKey(p.pick.name), guide = (ctx.eats || []).find(r => E.eatKey(r.name) === k && E.hav(r, p.pick) <= 0.2);
      // A place the traveler chose that doesn't serve this meal that day (its listed hours): not planned there, and the plan
      // says why (Nov 19 review: a chosen restaurant skipped every check).
      const f = (ctx.eatFacts || {})[k] || {};
      if (!p.booked && E.eatShut(f, label)) return { skip: !!p.skip, meal, pick: null, pickShut: p.pick.name || "The place you chose" };
      pick = { r: guide || p.pick, k, d: 0 };
    }
    return { skip: !!p.skip, meal, pick };
  };
  // Best place for lunch in an ordered day: each gap, each of the nearest places to eat; the lowest penalty wins.
  // quick: a rough check while trying a candidate stop (the nearest place to eat only); the chosen day gets the full search.
  // The same order in the same day window always gets the same lunch, so each is worked out once per day (the
  // move-by-move repair and the fill try many orders more than once).
  function withLunch(order, win, ctx, quick) {
    if (!ctx.lunchMemo) ctx.lunchMemo = new WeakMap(); let wm = ctx.lunchMemo.get(win); if (!wm) ctx.lunchMemo.set(win, wm = new Map());
    const key = (quick ? "q" : "f") + order.map(p => p.id + ":" + p.minutes + ":" + p.lat + ":" + p.lng + ":" + (p.far ? 1 : 0) + (p.bonus ? "b" : "") + (p.along ? "a" : "")).join("|");
    let got = wm.get(key); if (!got) { if (wm.size > 20000) wm.clear(); wm.set(key, got = Object.assign(lunchFor(order, win, ctx, quick), { orderIn: order })); }
    // The answer carries this call's own stops (the same places, perhaps as other objects).
    if (got.orderIn === order) return got;
    return Object.assign({}, got, { seq: got.seq.map(x => { const j = got.orderIn.indexOf(x); return j >= 0 ? order[j] : x; }) });
  }
  // ONE lunch rule (Nov 19 fold; it replaces a gap search, a separate inside-a-visit search and two acceptance tests).
  // Lunch is part of the day: a sit-down lunch (full or quick), else a timed short lunch at a real place, never only a note.
  // Every way to fit it goes into one list and passes one test:
  //   - between two stops (or before the first, or on the way back), at a place near or along the way; or
  //   - inside a long visit over lunchtime (a town, an island, a big site), the visit shortened by the lunch AND the walk
  //     to the place and back, so the day doesn't get longer (Nov 18 island day; Nov 19: a town visit refused for 13 min of walk).
  // A lunch is kept when the place is serving when you arrive, lunch starts in good time, no stop is reached late,
  // the day runs no later past its time to be back, waits stay short, and on a ship, train or plane day the safety margin
  // is untouched. The lowest cost wins: the time a visit loses weighs most, then a shorter lunch, then the detour.
  function lunchFor(order, win, ctx, quick) {
    const plain = walk(order, win, ctx), my = E.mealPlan(ctx, "Lunch"), L = my.meal;
    // A day emptied of stops plans no lunch of its own (Nov 22 lunch audit: an emptied port day walked 25 minutes each way
    // from the ship for lunch): its free time is the traveler's, unless they chose or booked a place for lunch.
    if (my.skip || !lunchWanted(win) || (!ctx.eats.length && !my.pick) || (!order.length && !my.pick)) return { seq: order, r: plain };
    const pts = [win.head[win.head.length - 1]].concat(order), lens = [L.len, L.quick, E.TO_GO];
    // A place to eat on an island the day visits is on that island: nearer that island stop than to anything else on the
    // day's land (the start, the end, the other stops), it takes the island's facts, so the way on from it is the boat,
    // never a taxi over the sea (Nov 21 live check: lunch at an island's far end, then "Taxi or car, 24 mi" to the ship).
    const wet = p => !!p && (E.byBoat(p.travelNote) || E.waterOnly(p) || !!p.acrossWater);
    const isles = order.filter(s => wet(s) && !s.mealOf && E.fin(s.lat)), land = win.head.concat(win.tail, order.filter(s => !wet(s) && !s.mealOf)).filter(p => p && E.fin(p.lat));
    const isleOf = r => { if (!isles.length || !E.fin(r.lat)) return null; let best = null, bd = Infinity; for (const s of isles) { const d = E.hav(s, r); if (d < bd) { bd = d; best = s; } }
      return land.every(p => E.hav(p, r) > bd) ? best : null; };
    const isleFacts = r => { const s = isleOf(r); return !s ? {} : Object.assign({ travelNote: r.travelNote || s.travelNote || "", onIsle: s.id }, s.wish && !s.guideWish ? { insideWish: true } : {}, s.acrossWater ? { acrossWater: s.acrossWater } : {}, E.waterOnly(s) ? { access: s.access } : {}); };
    const mealAt = (e, len, extra) => Object.assign({ id: "eat:" + e.k, eatKey: e.k, name: E.say(e.r.name), lat: e.r.lat, lng: e.r.lng, mealOf: L, len, quick: len < L.len, toGo: len === E.TO_GO, chosen: !!my.pick, fromMap: !!e.r.fromMap, packed: !!e.r.packed, travelNote: e.r.travelNote || "",
      // A lunch to go is still bought at that place, so it waits for it to open too (Nov 23 audit: a lunch to go at 11:56
      // at a place that opens at noon).
      oh: ((ctx.eatFacts || {})[e.k] || {}).oh || null }, isleFacts(e.r), extra || {});
    // On time first (Nov 22 lunch audit: lunch at 2:40 to 3:30 pm back in town after a day out, while the town out there had
    // places to eat, or a lunch brought along would have been at 1 pm): a lunch that starts by the kitchen's last orders, at a
    // place to eat or one the traveler brings, beats any later one. Only when none is on time does a late lunch (up to an hour
    // past) count, and the day says it is late.
    // A lunch at a time the traveler set is kept like a booked table: at most 10 minutes late (Nov 23: a longer castle
    // visit pushed a 1:30 pm lunch to 1:54; the day now orders its stops around it).
    let strict = true;
    const ok = c => (L.pinned ? c.r.lateMeal <= 10 : strict ? !c.r.lateMeal : c.r.lateMeal <= E.MEAL_LATE) && !c.r.items.some(x => x.shut) && c.r.late <= plain.late && c.r.over <= plain.over
      && (c.k === order.length || c.r.waits - plain.waits <= 45)
      && !(win.hard && !c.r.over && c.r.end > plain.end && win.endBy - c.r.end < E.FILL_MARGIN);
    let best = null, tried = 0, grp = null, packedPass = false;
    // Every lunch tried is kept with where it was tried: when none is on time, the late pass weighs the same tries again
    // instead of timing the whole day for each one a second time (the same answers; planning time, Nov 23).
    const log = [];
    const offer = (seq, k, len, off, fromMap, cut) => {
      // k: where lunch goes in the day; the timing is reused from the plain day up to the first stop that changed.
      // A lunch that runs the day later past its time than the day without it is never kept, so its walk stops once it does.
      const r = walk(seq, win, ctx, Object.assign({ r: plain, k: cut ? k - 1 : k, cap: plain.over, lateCap: plain.late, noShut: true }, k === order.length ? {} : { waitFrom: plain.waits })), c = { seq, r, k, cut };
      c.pen = penalty(r) + (cut || 0) + (len === E.TO_GO ? 60 : len < L.len ? 20 : 0) + off * 1.5 + (fromMap ? 0.5 : 0);
      tried++; if (ok(c) && (!best || c.pen < best.pen - 1e-9)) best = c;
      log.push({ c, grp, full: len === L.len, packed: packedPass });
      return c;
    };
    // The late pass over the kept tries, in the same order and with the same rule as the first: once the full lunch fits
    // at a place, its shorter lunches there are not weighed; lunches brought along only when nothing else fits.
    const replay = () => { const skip = new Set();
      const run = list => list.forEach(x => { if (x.grp && skip.has(x.grp)) return; const c = x.c; if (ok(c) && (!best || c.pen < best.pen - 1e-9)) best = c;
        if (x.grp && x.full && ok(c) && !c.r.over && !c.r.late) skip.add(x.grp); });
      run(log.filter(x => !x.packed)); if (!best && !quick) run(log.filter(x => x.packed)); };
    // Between stops: the gaps near lunchtime (left from an hour and a quarter before the kitchen opens to its last orders,
    // plus the last gap before and the first after), or where the traveler put lunch on the Day plan.
    const stops = plain.items.filter(x => x.t === "stop"), dep = [win.sightFrom || win.start].concat(stops.map(x => x.at + (x.min || 0)));
    const gaps = [];
    for (let k = 0; k <= order.length; k++) if (dep[k] >= L.from - 75 && dep[k] <= L.to) gaps.push(k);
    const before = dep.map((t, k) => t < L.from - 75 ? k : -1).filter(k => k >= 0).pop(), after = dep.findIndex(t => t > L.to);
    if (before != null) gaps.push(before); if (after >= 0) gaps.push(after);
    if (ctx.lunchAt != null && !my.pick) { const k = ctx.lunchAt === "^" ? 0 : order.findIndex(s => String(s.id) === ctx.lunchAt) + 1; if (k >= 0 && (ctx.lunchAt === "^" || k > 0)) gaps.splice(0, gaps.length, k); }
    const between = () => { for (const k of [...new Set(gaps)].sort((a, b) => a - b)) {
      // Places near the stop before, near the stop after and halfway: each costs what it takes them out of their way
      // (Nov 18, a city across a bay: not back over the bridge for lunch). After the last stop: near where the day ends.
      const a = pts[k], b = order[k] || (k === order.length && win.tail.length ? win.tail[0] : null);
      const mid = b && E.fin(b.lat) ? { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 } : null;
      // Worked out once a place (the sort asks for each place many times; planning time, Nov 23).
      // (kept for the day's other tries too, by the two stops and the place: planning time, Nov 23)
      const om = ctx.offMemo || (ctx.offMemo = new WeakMap()); let oa = om.get(a); if (!oa) om.set(a, oa = new Map()); let offs = oa.get(b || null); if (!offs) oa.set(b || null, offs = new WeakMap());
      const offOf = e => { let v = offs.get(e.r); if (v === undefined) { v = b && E.fin(b.lat) ? E.hav(a, e.r) + E.hav(e.r, b) - E.hav(a, b) : E.hav(a, e.r); offs.set(e.r, v); } return v; };
      const cands = my.pick ? [my.pick] : [...new Map((quick ? [a] : [a, b, mid]).filter(q => q && E.fin(q.lat)).flatMap(q => eatsNear(q, ctx, "Lunch", 3)).map(e => [e.k, e])).values()]
        .sort((x, y) => offOf(x) + (x.r.fromMap ? 0.3 : 0) - offOf(y) - (y.r.fromMap ? 0.3 : 0) || x.k.localeCompare(y.k)).slice(0, quick ? 1 : 3);
      for (const e of cands) for (const len of lens) {
        grp = k + "|" + e.k;
        const c = offer(order.slice(0, k).concat([mealAt(e, len)], order.slice(k)), k, len, my.pick ? 0 : offOf(e), e.r.fromMap); grp = null;
        if (len === L.len && ok(c) && !c.r.over && !c.r.late) break; // the full lunch fits: a shorter one only costs more
      }
    } };
    // Inside a long visit over lunchtime: the visit gives up the lunch and the walk there and back. A visit keeps at least
    // 45 minutes of its own.
    // A lunch inside a visit across the water is on that island however far from the visit's own point it is: the way on
    // from it is the boat, never a taxi over the sea (Nov 21 live check: lunch at the far end of an island, then "Taxi or
    // car, 24 mi" back to the ship).
    // Last of all, only when no place to eat fits anywhere on the day: inside a long visit with no place to eat known
    // within reach (a beach park, a ranch), lunch is still a timed stop, one the traveler brings, said plainly (Nov 20,
    // the lunch goal: every day out over lunchtime has a timed lunch).
    const inside = packed => plain.items.filter(x => x.t === "stop" || x.t === "meal").forEach((st, k) => {
      const s = order[k]; if (!s || s.mealOf || st.t !== "stop" || !E.fin(s.lat)) return;
      const over = Math.min(st.at + (st.min || 0), L.to) - Math.max(st.at, L.from);
      const near = my.pick ? [my.pick] : eatsNear(s, ctx, "Lunch", quick ? 1 : 3);
      const cands = !packed ? near : near.length || my.pick || (s.minutes || 0) < 120 ? [] : [{ k: "own:" + s.id, r: { name: "A lunch you bring", lat: s.lat, lng: s.lng, packed: true } }];
      for (const len of lens) {
        if (over < len) continue;
        for (const e of cands) {
          // The lunch goes after the visit, or first thing on arriving when the visit starts near lunchtime (Nov 22 lunch
          // audit: a visit starting at 1 pm had its lunch put after it, at 3:13 pm).
          const build = (cut, first, part1) => { const v = Object.assign({}, s, { minutes: s.minutes - cut, lunchIn: len, lunchCut: cut }),
            m = mealAt(e, len, Object.assign({ inside: s.id, ...(part1 != null ? { during: s.id } : {}), insideWish: !!(s.wish && !s.guideWish), travelNote: e.r.travelNote || (E.byBoat(s.travelNote) || E.waterOnly(s) || s.acrossWater ? s.travelNote || "" : "") },
            s.acrossWater ? { acrossWater: s.acrossWater } : {}, E.waterOnly(s) && !E.byBoat(s.travelNote) ? { access: s.access } : {}));
            // In the middle of the visit: its first part, lunch, then the rest of it (one visit on the screens, see shortForm).
            if (part1 != null) return order.slice(0, k).concat([Object.assign({}, v, { minutes: part1, part: 1 }), m, Object.assign({}, v, { minutes: v.minutes - part1, part: 2 })], order.slice(k + 1));
            return order.slice(0, k).concat(first ? [m, v] : [v, m], order.slice(k + 1)); };
          if ((s.minutes || 0) - len < 45) continue;
          for (const first of st.at >= L.from - 30 ? [false, true] : [false]) {
            // First try: the visit loses the lunch itself; the walk shows as how much later the day ends. Then it loses that too.
            const r0 = walk(build(len, first), win, ctx, { r: plain, k }), cut = len + Math.max(0, Math.ceil(r0.end - plain.end));
            if ((s.minutes || 0) - cut < 45) continue;
            offer(build(cut, first), first ? k : k + 1, len, E.hav(s, e.r), e.r.fromMap, cut);
          }
          // A lunch brought along is eaten in the visit around midday, when the visit runs on past lunchtime (Nov 23 lunch
          // audit: a 5 h ranch visit from 10:30 am had its brought lunch after it, at 3:30 pm). The visit is timed in two
          // parts around it, at least 30 min each, and lunch starts by the kitchen-hours end every other lunch keeps to.
          if (e.r.packed) { const t = Math.max(st.at + 45, L.from + 30), a = Math.round((t - st.at) / 5) * 5;
            if (a >= 30 && (s.minutes || 0) - len - a >= 30 && st.at + a + len <= L.to && st.at + (s.minutes || 0) - len > L.to) offer(build(len, false, a), k + 1, len, 0, false, len); }
        }
      }
    });
    between(); inside(false); if (!best && !quick) { packedPass = true; inside(true); packedPass = false; }
    if (!best) { strict = false; replay(); }
    if (best) return Object.assign({ seq: best.seq, r: best.r }, best.cut ? { lunchIn: true } : {});
    // No lunch: on a day with room it's for want of a place; otherwise the stops fill the day.
    return { seq: order, r: plain, noLunch: tried ? "time" : "place" };
  }
  // ONE test of "this fits the day", for the planner's offers, the free time and the app's site list alike (Nov 19, Richard:
  // "It doesnt have time to give me lunch but when you go into the selector, it gives me a bunch of stuff I can add"):
  // nothing past the time to be back, no stop late, the margin kept on a ship, train or plane day, and lunch still in.
  E.roomFor = (c, win) => !c.r.over && !c.r.late && (!win.hard || win.endBy - c.r.end >= E.FILL_MARGIN) && c.noLunch !== "time";
  // And an added sight fits only as the day stands: nothing on it gets shorter to make room (a visit cut, lunch made quick).
  // (Lunch may move to another place or time; it keeps its length. A visit with lunch inside it counts with that lunch.)
  E.keepsDay = (c, base) => base.seq.every(x => { const y = x.mealOf ? c.seq.find(z => z.mealOf === x.mealOf) : c.seq.find(z => !z.mealOf && String(z.id) === String(x.id));
    const own = z => (z.minutes || 0) + (z.lunchCut || 0); return x.mealOf ? !!y && y.len >= x.len : !y || own(y) >= own(x); });
  // A day that could have lunch but lost it to the stops counts as worse than a slightly later end.
  const cost = c => penalty(c.r) + (c.noLunch === "time" ? 300 : 0);
  // Order the stops for travel, then try every single move for a better timed day (opening hours, lunch).
  // The out-of-town stops sit together at the start or the end of the day.
  const blockAtEnd = o => { const f = o.map(s => !!s.far), n = f.filter(Boolean).length; return f.slice(0, n).every(Boolean) || f.slice(o.length - n).every(Boolean); };
  // quick: skip the move-by-move repair (used to test a candidate; the day is repaired once it is chosen).
  // The order of the stops is decided with the usual ride times (no ride choices), then timed with the traveler's choices.
  // The traveler's own order (dragged on the Day plan) holds as they set it (Nov 19, Richard: "drag to reorder is not
  // allowing you to drop it where you want it": the app kept planning its own order). A stop not in their list (added
  // since) goes where it adds the least riding. If their order doesn't fit, a stop drops, never the time back.
  function ownOrder(stops, win, ctx) {
    const ids = ctx.ownOrder, at = id => ids.indexOf(String(id)), from = win.head[win.head.length - 1], to = win.tail.length ? win.tail[0] : null;
    const order = stops.filter(s => at(s.id) >= 0).sort((a, b) => at(a.id) - at(b.id));
    for (const s of stops.filter(s => at(s.id) < 0).sort(E.byId)) { let bk = order.length, bc = Infinity;
      for (let k = 0; k <= order.length; k++) { const p = k ? order[k - 1] : from, q = order[k] || to; const c = ctx.tr.min(p, s) + (q ? ctx.tr.min(s, q) - ctx.tr.min(p, q) : 0); if (c < bc - 1e-9) { bc = c; bk = k; } }
      order.splice(bk, 0, s); }
    return withLunch(order, win, ctx);
  }
  function arrange(stops, win, ctx, quick) {
    if (ctx.ownOrder) return ownOrder(stops, win, ctx);
    const pt = ctx.tr.plainTr && ctx.tr.plainTr();
    if (!pt) return arrangeBy(stops, win, ctx, quick);
    // Its own lunch memo: a day timed by the plain rides is never reused as the day timed by the traveler's choices (Nov 19:
    // the train picked for a day trip was planned as a taxi, with no word why, when the plain day was worked out first).
    const pctx = Object.assign({}, ctx, { tr: pt, lunchMemo: ctx.plainLunchMemo || (ctx.plainLunchMemo = new WeakMap()) }), got = arrangeBy(stops, win, pctx, quick);
    const byId = new Map(stops.map(s => [String(s.id), s])), order = got.seq.filter(x => !x.mealOf).map(x => byId.get(String(x.id)) || x);
    // The lunch place too is the plain day's, while it still fits with the rides picked: a ride the traveler picks changes the
    // clock, never where lunch is, so the ride (and the choice on it) stays where it was (Nov 20 sweep: picking the light rail
    // back from an excavation site moved lunch next door, and the picked ride, now from another place, was quietly lost).
    const pm = got.seq.find(x => x.mealOf && x.eatKey), own = (ctx.mealPrefs || {}).Lunch;
    if (pm && !(own && (own.pick || own.skip || own.at))) { const only = (ctx.eats || []).filter(r => E.eatKey(r.name) === pm.eatKey);
      if (only.length) { const c = withLunch(order, win, Object.assign({}, ctx, { eats: only, lunchMemo: ctx.hintMemo || (ctx.hintMemo = new WeakMap()) }), quick); if (!c.noLunch && !c.r.over && !c.r.late) return c; } }
    return withLunch(order, win, ctx, quick);
  }
  // The orders the planner starts from (the best order for travel; with a trip out of town, that trip first and last), and
  // whether any of them, or any single move or reversed run of one (up to 3 places), has no stop late and the day not over,
  // timed with no lunch.
  function firstOrders(stops, win, ctx) {
    const from = win.head[win.head.length - 1], to = win.tail.length ? win.tail[0] : null, om = ctx.tr.orderMin || ctx.tr.min, out = [E.bestOrder(stops, from, to, om)];
    const far = stops.filter(s => s.far), near = stops.filter(s => !s.far);
    if (far.length && near.length) { const f = E.bestOrder(far, from, null, om), n = E.bestOrder(near, from, null, om);
      out.push(f.concat(E.bestOrder(near, f[f.length - 1], to, om)), n.concat(E.bestOrder(far, n[n.length - 1], to, om))); }
    return out;
  }
  function someOrderFits(stops, win, ctx) {
    const tol = (win.hard || win.strict ? 0 : 5) + 10, reach = 3;
    const fits = o => { const r = walk(o, win, ctx, { cap: tol }); return r.end - win.endBy <= tol && r.items.every(x => x.t === "ride" ? !x.noRun : !x.late || (x.t === "stop" && x.min >= 45 + E.TO_GO)); };
    for (const order of firstOrders(stops, win, ctx)) {
      if (fits(order)) return true;
      for (let i = 0; i < order.length; i++) for (let j = 0; j < order.length; j++) {
        if (i === j || j === i - 1 || Math.abs(i - j) > reach) continue;
        const o = order.slice(); const [x] = o.splice(i, 1); o.splice(j, 0, x); if (fits(o)) return true; }
      for (let i = 0; i < order.length - 2; i++) for (let j = i + 2; j < order.length && j - i <= reach; j++) if (fits(order.slice(0, i).concat(order.slice(i, j + 1).reverse(), order.slice(j + 1)))) return true;
    }
    return false;
  }
  function arrangeBy(stops, win, ctx, quick) {
    const from = win.head[win.head.length - 1], to = win.tail.length ? win.tail[0] : null;
    const om = ctx.tr.orderMin || ctx.tr.min; let order = E.bestOrder(stops, from, to, om);
    // A trip out of town is one block, first or last in the day, never wedged between sights in town.
    const far = stops.filter(s => s.far), near = stops.filter(s => !s.far);
    if (far.length && near.length) {
      const farFirst = E.bestOrder(far, from, null, om), a = farFirst.concat(E.bestOrder(near, farFirst[farFirst.length - 1], to, om));
      const nearFirst = E.bestOrder(near, from, null, om), b = nearFirst.concat(E.bestOrder(far, nearFirst[nearFirst.length - 1], to, om));
      const ca = withLunch(a, win, ctx, quick), cb = withLunch(b, win, ctx, quick);
      order = cost(ca) <= cost(cb) ? a : b;
    }
    let cur = withLunch(order, win, ctx, quick), pen = cost(cur);
    if (!quick && (cur.r.late || cur.r.over || cur.noLunch === "time" || (cur.r.lunchShort > 0 && win.endBy - cur.r.end >= cur.r.lunchShort))) {
      // Each pass tries every single move from the same order and takes the best one (Nov 19: the first move that fixed a
      // late museum was taken, a sight beside the first stop sent across town and back, when swapping two museums was better).
      // A day of more than 10 stops tries each stop up to 3 places either way, in one pass (Nov 22 odd-trips run: a leaving day
      // with 18 picks tried a thousand lunches per repair and took seconds; a move across a long day is never the fix).
      const many = order.length > 10, reach = many ? 3 : Infinity;
      for (let pass = 0; pass < (many ? 1 : 3); pass++) {
        let best = null;
        // Each single move of one stop, and each reversed run of stops (a loop walked the other way round fixes a late
        // museum without sending a sight across town and back: phone trip check, Nov 23, a full port day zig-zagged).
        const cands = [];
        for (let i = 0; i < order.length; i++) for (let j = 0; j < order.length; j++) {
          if (i === j || j === i - 1 || Math.abs(i - j) > reach) continue; // moving to just before the previous is the same as moving that one after
          const o = order.slice(); const [x] = o.splice(i, 1); o.splice(j, 0, x); cands.push(o); }
        const nMoves = cands.length;
        for (let i = 0; i < order.length - 2; i++) for (let j = i + 2; j < order.length && j - i <= reach; j++) cands.push(order.slice(0, i).concat(order.slice(i, j + 1).reverse(), order.slice(j + 1)));
        for (const [ci, o] of cands.entries()) {
          if (far.length && near.length && !blockAtEnd(o)) continue;
          // Lunch only adds time, so an order already later or later at a last entry without lunch can't win.
          const bare = walk(o, win, ctx, Object.assign({ cap: cur.r.over, lateCap: cur.r.late }, ci >= nMoves ? { rideCap: cur.r.rideMin + 1 } : {})); if (bare.over > cur.r.over || bare.late > cur.r.late || (ci >= nMoves && bare.rideMin > cur.r.rideMin + 1)) continue;
          const c = withLunch(o, win, ctx), p = cost(c);
          // A reversed run is taken only when it rides no more than the order it replaces (it is there to undo a zig-zag).
          if (ci >= nMoves && c.r.rideMin > cur.r.rideMin + 1) continue;
          if (p < pen - 1e-6 && (!best || p < best.p - 1e-6)) best = { o, c, p };
        }
        if (!best) break;
        order = best.o; cur = best.c; pen = best.p;
      }
    }
    return cur;
  }
  // What gives way first: the app's own additions, then the traveler's picks in town, and last a day out of town the
  // traveler picked (a trip out is the day's purpose; the sights in town can move to another day).
  // A sight with its own finished guide or a must-see counts as wanted, like a pick.
  const wanted = s => !!(s.wish || (E.ownStop && E.ownStop(s)));
  const keepRank = s => (wanted(s) ? 1 : 0) + (s.wish && s.far ? 1 : 0);
  E.wantedStop = wanted;
  // Ways to make room that cost no sight, tried before a wanted one goes: a shorter visit to a long stop the traveler
  // didn't ask for by name (up to a third of it, never under 25 minutes, in 5-minute steps). Lunch on the go is already
  // tried inside each arrangement. The time to be back (and the margin around it) is never touched.
  const SHORT_MIN = 25;
  const cut = s => Math.max(0, Math.min(Math.floor((s.trimmed || s.minutes || 0) / 3 / 5) * 5, (s.minutes || 0) - SHORT_MIN));
  const trimmable = s => !wanted(s) && !(s.far && E.has(s, "day-trip")) && cut(s) >= 10;
  function trimToFit(keep, win, ctx) {
    let k = keep.slice(), c = null;
    const order = keep.filter(trimmable).sort((a, b) => (a.worth || 0) - (b.worth || 0) || E.byId(a, b));
    for (const s of order) {
      const by = cut(s), t = Object.assign({}, s, { minutes: s.minutes - by, trimmed: s.trimmed || s.minutes });
      k = k.map(x => x === s ? t : x); c = arrange(k, win, ctx);
      if (!c.r.over && !c.r.late) return { keep: k, cur: c };
    }
    return null;
  }
  // Lunch is part of the day (Richard, Nov 19: "Even if its a short 20 30 minute lunch, it needs to be notated"): a day
  // whose stops leave no time for lunch gives one visit the few minutes a lunch on the go needs, the longest visit first,
  // never below half its time or SHORT_MIN, as a visit is shortened to fit the day (and said so), before anything is dropped.
  function trimForLunch(keep, win, ctx, end0) {
    const ok = c => !c.r.over && !c.r.late && c.noLunch !== "time" && !(win.hard && c.r.end > end0 && win.endBy - c.r.end < E.FILL_MARGIN);
    // One visit at a time, longest first, then the next as well: at most 45 minutes in all, so a short lunch is planned.
    let k = keep.slice(), given = 0;
    const cands = keep.filter(s => (s.minutes || 0) >= 40 && !s.mealOf).sort((a, b) => (b.minutes || 0) - (a.minutes || 0) || E.byId(a, b));
    for (const s0 of cands) {
      for (const by of [10, 15, 20, 25, 30]) {
        const s = k.find(x => String(x.id) === String(s0.id)), was = s0.trimmed || s0.minutes, to = s0.minutes - by;
        if (to < Math.max(SHORT_MIN, Math.ceil(was / 2)) || given + by > 45) break;
        const t = k.map(x => x === s ? Object.assign({}, s0, { minutes: to, trimmed: was }) : x), c = arrange(t, win, ctx);
        if (ok(c)) return { keep: t, cur: c };
        if (by === 15 || to - 5 < Math.max(SHORT_MIN, Math.ceil(was / 2))) { k = t; given += by; break; } // keep this much and try the next visit too
      }
    }
    return null;
  }
  const lowestFirst = (a, b) => keepRank(a) - keepRank(b) || (a.worth || 0) - (b.worth || 0) || E.byId(b, a);
  // stops: the day's chosen sights (each with worth; wish = the traveler picked it). pool: other sights it may add.
  // Which stop to give up: among those whose loss makes the day fit, the one worth least; if no single loss is enough,
  // the one that gives back the most time for its worth (a far stop on its own goes before a cluster of near ones).
  function toDrop(keep, from, win, ctx, why) {
    // Each loss is judged on the day as it would really be planned (the same arrange as the final day, lunch included, in its
    // quick form), never on a simpler schedule that could pick a different stop to give up (Nov 19 review).
    const quick = seq => arrange(seq, win, ctx, true).r;
    const b0 = arrange(keep, win, ctx, true), base = b0.r.end;
    // Many to choose from (a day with every sight ticked): each is first weighed by what leaving it out of today's route
    // saves (its visit and its detour), and only the 6 that look best by the same order below are planned in full
    // (Nov 22 odd-trips run: 46 picks planned the day 1,000 times over to give up 36 of them). 12 or fewer: all of them.
    if (from.length > 12) { const seq = b0.seq.filter(x => !x.mealOf), at = new Map(seq.map((x, k) => [String(x.id), k])), head = win.head[win.head.length - 1], tail = win.tail.length ? win.tail[0] : null;
      const gain = s => { const k = at.get(String(s.id)); if (k == null) return s.minutes || 0; const p = k ? seq[k - 1] : head, q = seq[k + 1] || tail;
        return (s.minutes || 0) + ctx.tr.min(p, s) + (q ? ctx.tr.min(s, q) - ctx.tr.min(p, q) : 0); };
      from = from.map(s => ({ s, g: Math.max(1, gain(s)) })).sort((a, b) => keepRank(a.s) - keepRank(b.s) || (a.s.worth || 1) / a.g - (b.s.worth || 1) / b.g || E.byId(a.s, b.s)).slice(0, 6).map(x => x.s); }
    const scored = from.map(s => { const r = quick(keep.filter(k => k !== s)); return { s, fits: !r.over && !r.late, saved: Math.max(1, base - r.end) }; });
    const fixing = scored.filter(x => x.fits);
    // Over the time: the stop giving back the most time for its worth goes first (two lesser stops before one great
    // one), wanted stops last; one that fixes the day alone wins a tie.
    const list = why === "lunch" || why === "over" || !fixing.length ? scored.sort((a, b) => keepRank(a.s) - keepRank(b.s) || (a.s.worth || 1) / a.saved - (b.s.worth || 1) / b.saved || E.byId(a.s, b.s))
      : fixing.sort((a, b) => lowestFirst(a.s, b.s));
    if (why === "over") list.sort((a, b) => keepRank(a.s) - keepRank(b.s) || (a.s.worth || 1) / a.saved - (b.s.worth || 1) / b.saved || (b.fits ? 1 : 0) - (a.fits ? 1 : 0) || E.byId(a.s, b.s));
    return list[0].s;
  }
  // Ways to fit in a stop that doesn't fit (the traveler adding one, or a wanted one the day had to give up), each one
  // checked on the timed day with the time to be back untouched, best first: lunch on the go, a shorter visit to a long
  // stop (the fewest minutes that do it, in 5-minute steps, up to a third of the visit and never under 25 minutes), and
  // only then giving up another stop. [] when nothing makes it fit.
  E.waysToFit = (win, kept, add, ctx) => {
    const fits = c => !c.r.over && !c.r.late && !(win.hard && win.endBy - c.r.end < E.FILL_MARGIN);
    const out = [], all = kept.concat([add]);
    const c0 = arrange(all, win, ctx);
    if (fits(c0)) { const m = c0.seq.find(x => x.mealOf); return m && m.toGo || c0.noLunch ? [{ kind: "lunchToGo", say: "have lunch on the go between stops instead of sitting down" }] : []; }
    // With a quick lunch on the go in every try below, so a shorter visit is only as short as it needs to be.
    for (const s of kept.filter(s => (s.minutes || 0) >= 45 && !(s.far && E.has(s, "day-trip"))).sort((a, b) => (a.worth || 0) - (b.worth || 0) || E.byId(a, b))) {
      const most = Math.min(Math.floor(s.minutes / 3 / 5) * 5, s.minutes - 25);
      for (let by = 5; by <= most; by += 5) {
        const t = Object.assign({}, s, { minutes: s.minutes - by }), c = arrange(all.map(x => x === s ? t : x), win, ctx, true);
        if (fits(c)) { const m = c.seq.find(x => x.mealOf); out.push({ kind: "shorten", id: s.id, name: s.name, by, to: s.minutes - by, toGo: !!(m && m.toGo), say: "spend " + by + " minutes less at " + String(s.name).split(",")[0] + (m && m.toGo ? " and have lunch on the go" : "") }); break; }
      }
    }
    out.sort((a, b) => a.by - b.by || E.byId(a, b));
    const drops = [];
    // Only a stop worth less than the one to fit in is offered to skip.
    for (const s of kept.slice().sort(lowestFirst)) { if (keepRank(s) > keepRank(add) || (s.worth || 0) >= (add.worth || 0)) continue;
      const c = arrange(kept.filter(x => x !== s).concat([add]), win, ctx, true);
      if (fits(c)) drops.push({ kind: "drop", id: s.id, name: s.name, wanted: wanted(s), say: "skip " + String(s.name).split(",")[0] });
      if (drops.length >= 2) break;
    }
    return out.slice(0, 3).concat(drops);
  };
  // stops: the day's chosen sights (each with worth; wish = the traveler picked it). pool: other sights it may add.
  // A ride the traveler picked changes the clock, never the order (Nov 19, Richard's Jul 2): the day is first planned with
  // the plain rides, and that order is then timed with the rides picked, as if it were the traveler's own order. A visit
  // shortened to fit the slower ride no longer flips the order and loses the ride picked.
  E.fitDay = (d, win, stops, pool, ctx) => {
    const pt = !(Array.isArray(d.order) && d.order.length > 1) && ctx.tr.plainTr && ctx.tr.plainTr();
    if (!pt) return fitDayOnce(d, win, stops, pool, ctx);
    const plain = fitDayOnce(d, win, stops, pool, Object.assign({}, ctx, { tr: pt, lunchMemo: ctx.plainLunchMemo || (ctx.plainLunchMemo = new WeakMap()) }));
    const ids = plain.seq.filter(x => !x.mealOf).map(x => String(x.id));
    const got = fitDayOnce(Object.assign({}, d, { order: ids.length > 1 ? ids : null }), win, stops, pool, ctx);
    got.orderExtra = 0; return got;
  };
  function fitDayOnce(d, win, stops, pool, ctx) {
    ctx.ownOrder = Array.isArray(d.order) && d.order.length > 1 ? d.order.map(String) : null;
    ctx.lunchAt = d.mealAt && d.mealAt.Lunch != null ? String(d.mealAt.Lunch) : null;
    let keep = stops.slice(), dropped = [];
    let cur = arrange(keep, win, ctx), guard = 0;
    const needsLunchRoom = () => cur.noLunch === "time" && keep.some(s => !s.wish);
    while ((cur.r.over || cur.r.late || needsLunchRoom()) && keep.length && guard++ < 40) {
      const why = cur.r.over ? "over" : cur.r.late ? "late" : "lunch";
      // A town visited for the day has no fixed length: before giving up a pick, its time there shrinks (to half at most).
      const least = s => Math.round((s.trimmed || s.minutes || 0) / 2 / 15) * 15;
      const flex = why === "over" && keep.find(s => s.far && E.has(s, "day-trip") && (s.trimmed || s.minutes || 0) >= 90 && s.minutes > least(s));
      if (flex) {
        const was = flex.trimmed || flex.minutes, to = Math.max(least(flex), Math.ceil((flex.minutes - cur.r.over) / 15) * 15);
        const t = Object.assign({}, flex, { minutes: Math.min(to, flex.minutes - 15), trimmed: was });
        keep = keep.map(s => s === flex ? t : s); cur = arrange(keep, win, ctx); continue;
      }
      const lateIds = new Set(cur.r.items.filter(x => x.late || x.noBoat).map(x => String(x.id))), noBoat = new Map(cur.r.items.filter(x => x.noBoat).map(x => [String(x.id), x.noBoat]));
      const pickFrom = why === "over" ? keep : why === "late" ? keep.filter(s => lateIds.has(String(s.id))) : keep.filter(s => !s.wish);
      const out = toDrop(keep, pickFrom.length ? pickFrom : keep, win, ctx, why);
      if (why === "over" && wanted(out)) {
        const t = trimToFit(keep, win, ctx); if (t) { keep = t.keep; cur = t.cur; continue; }
      }
      // Still over by more than an hour, the day is timed the quick way (no reordering to repair it: no move fixes an hour);
      // the day as kept is timed in full once the loop ends.
      const overWas = cur.r.over, lateWas = (cur.r.items.find(x => x.t === "stop" && String(x.id) === String(out.id)) || {}).late || 0;
      const far = why === "over" && cur.r.over > 60, next = keep.filter(s => s !== out), c = Object.assign(arrange(next, win, ctx, far), far ? { roughly: true } : {});
      if (why === "lunch" && c.noLunch === "time") break; // giving it up wouldn't make room for lunch: keep it
      const endWith = cur.r.end; keep = next; cur = c;
      // The time it needs and the time there is, in numbers (Nov 22, Richard asked how a day trip was "closed" when the note said
      // "closed, or no longer fits the time safely"): with today's other stops, what it adds to the day, and what is left.
      // What it needs rounds up and what is left rounds down (to 5 minutes), so the two never read the same; when they
      // would, the exact minutes are said.
      const hm = (m, f) => { m = Math.max(0, f(m)); return m >= 60 ? Math.floor(m / 60) + " h" + (m % 60 ? " " + (m % 60) + " min" : "") : m + " min"; };
      const up = m => Math.ceil(m / 5) * 5, down = m => Math.floor(m / 5) * 5, exact = m => Math.round(m);
      const addMin = endWith - c.r.end, leftMin = win.endBy - c.r.end, close = up(addMin) <= down(leftMin) || up(addMin) - down(leftMin) < 5;
      const timeWhy = E.fin(addMin) && E.fin(leftMin) && addMin > leftMin && addMin > 0 ? "needs about " + hm(addMin, close ? exact : up) + " (the visit and the rides to it and on), and " + (Math.max(0, close ? exact(leftMin) : down(leftMin)) > 0 ? "with today's other stops only " + hm(leftMin, close ? exact : down) + " is left before " : "today's other stops already fill the time until ") + E.clock(win.endBy) : null;
      // The real reason (Fable review #13: a museum "didn't fit" when it simply opens too late for the day): a sight that
      // opens too late to be seen before the day's end says so.
      const sd = ctx.siteDay ? ctx.siteDay(out.id) : null, opens = sd && sd.oh && sd.oh.spans && sd.oh.spans.length ? sd.oh.spans[0][0] : null;
      // Given up to make room for lunch: said so, with the numbers of the shortest lunch the day would plan.
      const LM = E.MEALS[0], lunchWhy = "with it, today has no room for lunch (even a quick lunch takes " + LM.quick + " min)";
      const tooLate = opens != null && E.fin(win.endBy) && opens + Math.min(out.minutes || 60, 60) > win.endBy;
      dropped.push({ id: out.id, name: out.name, wish: !!out.wish, wanted: wanted(out), stop: out, why: noBoat.has(String(out.id)) ? "is reached only by boat, and " + noBoat.get(String(out.id)) + ": on a day with a time to be back, the way back is planned only on a sailing a timetable confirms" : tooLate ? "opens at " + E.clock(opens) + ", too late to see before " + E.clock(win.endBy) : why === "late" ? (lateWas > 0 ? "would arrive " + hm(lateWas, up) + " after its last entry" : "would arrive after its last entry") : why === "lunch" ? lunchWhy : "didn't fit in the time", needs: timeWhy || (why === "over" && overWas > 0 ? "with it, today's plan runs " + hm(overWas, up) + " past " + E.clock(win.endBy) : null) });
    }
    if (cur.roughly) cur = arrange(keep, win, ctx);
    // Room left after the drops: a stop given up earlier comes back when it now fits (wanted ones first, best first).
    for (const x of dropped.slice().sort((a, b) => keepRank(b.stop) - keepRank(a.stop) || (b.stop.worth || 0) - (a.stop.worth || 0) || E.byId(a.stop, b.stop))) {
      // A stop whose visit is longer than all the time left (with a lunch shortened to the quickest), or that runs the day
      // over even in the best order with no lunch at all, can't come back: not tried (each try plans the day with its lunch,
      // seconds on a phone for a day of many picks; Nov 22 odd-trips run).
      if ((x.stop.minutes || 0) > win.endBy - cur.r.end + 30 || (() => { const r = E.walkDay(E.bestOrder(keep.concat([x.stop]), win.head[win.head.length - 1], win.tail.length ? win.tail[0] : null, ctx.tr.min), win, ctx.tr.estimate, ctx.siteDay); return r.over > 0; })()) continue;
      // Nor, on a day of more than 10 stops (one pass of single moves and reversed runs repairs it), one that runs the day over
      // or leaves a stop late in every order that pass can reach, timed with no lunch at all: lunch only adds time. A late stop
      // long enough to have lunch inside it (which shortens the visit) still counts as able to fit (Nov 23 odd-trips run: 35
      // stops tried back on a full Vienna day, each a full repair of the day with its lunches, 3 of the 6 seconds it took).
      if (!ctx.ownOrder && keep.length + 1 > 10 && !someOrderFits(keep.concat([x.stop]), win, ctx)) continue;
      const next = keep.concat([x.stop]), c = arrange(next, win, ctx);
      if (!c.r.over && !c.r.late && !(win.hard && win.endBy - c.r.end < E.FILL_MARGIN) && (c.noLunch !== "time" || cur.noLunch === "time" || wanted(x.stop))) { keep = next; cur = c; dropped = dropped.filter(y => y !== x); }
      // Not back only because a stop would then be reached after its last entry, with the day not over: that is the reason
      // said, never "the other stops fill the time" (odd-trips roomleft, Nov 24: a museum given up "for time" on a day with
      // 2 h 12 min free at its end; with it in any order a cathedral was reached 2 min after its last entry).
      else if (c.r.late && !c.r.over && x.why === "didn't fit in the time") { const L = c.r.items.find(y => y.t === "stop" && y.late > 0);
        if (L) { x.why = String(L.id) === String(x.stop.id) ? "fits in today's free time only after its last entry (" + Math.max(1, Math.round(L.late)) + " min late), whatever the order" : "fits in today's free time only if " + String(L.name).split(",")[0] + " is reached after its last entry (" + Math.max(1, Math.round(L.late)) + " min late)"; x.needs = null; } }
    }
    if (cur.noLunch === "time" && lunchWanted(win)) { const t = trimForLunch(keep, win, ctx, cur.r.end); if (t) { keep = t.keep; cur = t.cur; } }
    // Spare time is the traveler's (Nov 18, Richard: "I wouldn't do the suggested options. Just let them select to fill
    // the spots."): the app never adds a sight on its own. It names the best unused sights nearby that would still fit,
    // each checked with the day as it is, for the traveler to add if they like. The day itself is only their picks.
    const suggest = [];
    if (d.fillTime !== false && !win.straight) {
      const start = win.head[win.head.length - 1];
      const detour = s => 2 * Math.min(ctx.tr.min(start, s), ...keep.map(k => ctx.tr.min(k, s)));
      const farOk = s => keep.some(k => k.far && E.hav(k, s) <= 2.5); // the rest of a day-trip town, never a day in the city
      // A listing within a few steps of a stop already planned is the same place under another name, or part of it.
      const cands = pool.filter(s => !keep.some(k => String(k.id) === String(s.id) || (E.hav(k, s) < 0.08 && !wanted(s))) && (!s.far || farOk(s)) && (ctx.mayAdd ? ctx.mayAdd(s.id) : ctx.ledger.sightFree(s.id, ctx.dayIdx)))
        .map(s => { const dt = detour(s), near = wanted(s) && dt <= 10; return { s, near, v: near ? Math.max(1, s.worth || 0) : (s.worth || 0) - 0.25 * dt }; })
        // a must-see or a finished voiced tour a few steps off the day's walk is offered first
        // (any that would fit is worth naming: the traveler decides, so a lesser one is offered when nothing better fits)
        // Must-sees first of all (Nov 18: Richard missed the Little Metropolis and Monastiraki; within his rule that the
        // app adds nothing on its own, a must-see that fits is the first thing offered, marked as one).
        .map(x => Object.assign(x, { must: x.s.mustSee || E.has(x.s, "must-see") || x.s.hasGuide ? 1 : 0 }))
        .sort((a, b) => (b.must - a.must) || (b.near - a.near) || b.v - a.v || E.byId(a.s, b.s));
      const room = win.hard ? E.FILL_MARGIN : 0;
      let tries = 0;
      if (cur.noLunch === "time") cands.length = 0; // a day without time for lunch has no room for more
      for (const { s } of cands) {
        if (tries >= 12 || suggest.length >= 4) break;
        const next = keep.concat([s]);
        const rough = E.walkDay(E.bestOrder(next, start, win.tail.length ? win.tail[0] : null, ctx.tr.min), win, ctx.tr.estimate, ctx.siteDay);
        if (rough.over || rough.late || win.endBy - rough.end < room) continue;
        tries++;
        const fitsDay = x => E.roomFor(x, win) && E.keepsDay(x, cur);
        let c = arrange(next, win, ctx, true);
        if (!fitsDay(c) && tries <= 4) c = arrange(next, win, ctx); // the first few also get the full repair
        if (fitsDay(c)) suggest.push({ id: s.id, name: s.name, minutes: s.minutes || 0, far: !!s.far, must: !!(s.mustSee || E.has(s, "must-see")), voiced: !!s.hasGuide });
      }
    }
    // The traveler's own order is kept, and when the app's order would ride much less (the same stops, lunch, nothing late,
    // back no later) the day says how much more riding theirs costs, beside the one tap back to the app's order (Nov 19).
    let orderExtra = 0;
    if (ctx.ownOrder && keep.length >= 2) {
      const own = ctx.ownOrder; ctx.ownOrder = null;
      try { const b = arrange(keep, win, ctx), extra = Math.round(cur.r.rideMin - b.r.rideMin);
        if (extra >= Math.max(15, cur.r.rideMin / 10) && !b.r.over && !b.r.late && b.r.end <= cur.r.end + 1 && !(b.noLunch && !cur.noLunch)) orderExtra = extra;
      } finally { ctx.ownOrder = own; }
    }
    return { seq: cur.seq, r: cur.r, kept: keep, dropped, suggest, noLunch: lunchWanted(win) ? cur.noLunch || null : null, orderExtra };
  }
  // A dinner suggestion after a land day: the nearest open place to eat not used on another day.
  // The traveler's dinner choice wins: skipped means none; a chosen place is used at its set time (or 6:30 pm), never
  // before the day's end plus the ride there.
  E.DINNER_LAST = 21 * 60 + 30;
  E.dinnerAfter = (win, lastPoint, end, ctx, usedToday) => {
    const my = E.mealPlan(ctx, "Dinner");
    if (win.hard || !lastPoint || my.skip) return null;
    const e = my.pick || eatsNear(lastPoint, ctx, "Dinner", 4).find(x => !(usedToday && usedToday.has(x.k))); if (!e) return null;
    const ride = my.pick ? ctx.tr.min(lastPoint, e.r) : 30, from = my.meal.pinned ? my.meal.from : D.from, at = Math.max(end + ride, from);
    // A day that ends late (an arrival at 10 pm) gets no dinner the app picked at 11:30 pm or past midnight, when most
    // kitchens are closed (outside test round 5, Nov 22); the traveler's own pick or booking stays.
    if (!my.pick && !my.meal.booked && !my.meal.pinned && at > E.DINNER_LAST) return null;
    return Object.assign({ t: "evening", id: "eat:" + e.k, eatKey: e.k, name: E.say(e.r.name), at: Math.max(end + ride, from), min: D.len, lat: e.r.lat, lng: e.r.lng }, my.pick ? { chosen: true } : {}, my.meal.booked ? { booked: true } : {});
  };
})(KEngine);
