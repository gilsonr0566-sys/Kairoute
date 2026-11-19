// Beta 2 engine, part 6c and 6d: fit one day. Takes the day's chosen stops, finds the best order, puts lunch where it
// falls (at a real place to eat, never one used on another day), repairs the order for opening hours, drops the least
// worth until the day fits its window, then fills spare time with the best unclaimed sights nearby. Every check is one
// walk through the clock (walkDay) with stable estimates, so the same inputs always give the same day.
(function (E) {
  const L = E.MEALS[0], D = E.MEALS[1];
  E.FILL_MARGIN = 15; // a sight the app adds on its own never brings a ship, train or plane day closer than this to its deadline
  E.eatKey = name => String(name || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  // Penalty of a timed day: running past the end is worst, then stops reached after their last entry, then a late lunch.
  // A minute riding weighs like a minute waiting (Nov 19, Richard's day trip crossed the same stretch three times: at a tenth
  // of a wait, a long crossing was "cheaper" than a few minutes waiting for a gate to open).
  const penalty = E.dayCost = r => r.over * 1000 + r.late * 500 + (r.mealPen || 0) * 4 + r.waits * 0.5 + r.end * 0.01 + r.rideMin * 0.5;
  function walk(seq, win, ctx, from) {
    const r = E.walkDay(seq, win, ctx.tr.estimate, ctx.siteDay, from);
    r.lateMeal = r.items.reduce((a, x) => a + (x.lateMeal || 0), 0);
    // A meal at a time the traveler set is held like a booked table: being late for it costs ten times as much.
    r.mealPen = r.items.reduce((a, x) => a + (x.lateMeal || 0) * (x.pinned ? 10 : 1), 0);
    return r;
  }
  // Lunch belongs in a day whose sightseeing runs at least four hours and through the middle of the day.
  // A day wants lunch when it is out over lunchtime: at least two hours of sightseeing, with room in the lunch hours for at
  // least a short lunch (Nov 19, Richard: a day landing at the airport and out from 13:40 still gets lunch).
  const lunchWanted = E.lunchWanted = win => { const from = win.sightFrom || win.start, to = isFinite(win.sightTo) ? win.sightTo : win.endBy, L = E.MEALS[0];
    return to - from >= 120 && Math.min(to, L.to) - Math.max(from, L.from) >= E.TO_GO + 10; };
  // The nearest few real places to eat around a point that are open for this meal today and not used on another day.
  function eatsNear(p, ctx, meal, n) {
    // Within one day the list of places to eat and the ledger don't change, so each point is worked out once.
    if (!ctx.eatMemo) {
      ctx.eatMemo = new Map();
      ctx.eatList = ctx.eats.filter(r => isFinite(r.lat) && isFinite(r.lng) && !r.drop && E.mealPlace(r) && E.readable(E.latin(r.name) || r.name)).map(r => { // only a name the traveler can read
        const k = E.eatKey(r.name), f = ctx.eatFacts[k] || ctx.eatFacts[r.name && r.name.toLowerCase()] || {};
        return { r, k, f };
      });
    }
    const key = meal + n + "@" + p.lat + "," + p.lng, got = ctx.eatMemo.get(key); if (got) return got;
    const out = [];
    for (const x of ctx.eatList) {
      if (meal === "Lunch" ? x.f.lunchShut : x.f.dinnerShut || x.r.townLunch || x.r.inTown) continue;
      if (!ctx.ledger.eatFree(x.k, ctx.dayIdx)) continue;
      out.push({ r: x.r, k: x.k, d: E.hav(p, x.r) + (x.r.fromMap ? 0.4 : 0) }); // a guide place to eat first, a map one when it is nearer the way
    }
    out.sort((a, b) => a.d - b.d || a.k.localeCompare(b.k));
    const res = out.slice(0, n).filter(x => x.d <= 1.5);
    ctx.eatMemo.set(key, res); return res;
  }
  // The traveler's own say on a meal (d.mealPrefs.Lunch / .Dinner): skip it, a time to hold ("13:30"), or the place.
  // A set time becomes a ten-minute window from that time; a chosen place is the only one tried, and when the guide
  // lists a place of the same name within 200 m, the guide's entry (with its facts) is the one used.
  E.mealPlan = (ctx, label) => {
    const p = (ctx.mealPrefs || {})[label] || {}, base = label === "Lunch" ? L : D, at = E.toMin(p.at);
    const meal = isFinite(at) ? Object.freeze({ label, from: at, to: at + 10, len: base.len, quick: base.quick, pinned: true }) : base;
    let pick = null;
    if (p.pick && isFinite(p.pick.lat) && isFinite(p.pick.lng)) {
      const k = E.eatKey(p.pick.name), guide = (ctx.eats || []).find(r => E.eatKey(r.name) === k && E.hav(r, p.pick) <= 0.2);
      // A place the traveler chose that doesn't serve this meal that day (its listed hours): not planned there, and the plan
      // says why (Nov 19 review: a chosen restaurant skipped every check).
      const f = (ctx.eatFacts || {})[k] || {};
      if (label === "Lunch" ? f.lunchShut : f.dinnerShut) return { skip: !!p.skip, meal, pick: null, pickShut: p.pick.name || "The place you chose" };
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
    if (my.skip || !lunchWanted(win) || (!ctx.eats.length && !my.pick)) return { seq: order, r: plain };
    const pts = [win.head[win.head.length - 1]].concat(order), lens = [L.len, L.quick, E.TO_GO];
    const mealAt = (e, len, extra) => Object.assign({ id: "eat:" + e.k, eatKey: e.k, name: e.r.name, lat: e.r.lat, lng: e.r.lng, mealOf: L, len, quick: len < L.len, toGo: len === E.TO_GO, chosen: !!my.pick, fromMap: !!e.r.fromMap, travelNote: e.r.travelNote || "",
      open: len === E.TO_GO ? null : ((ctx.eatFacts || {})[e.k] || {}).lunchOpen || null }, extra || {});
    const ok = c => c.r.lateMeal < 90 && !c.r.items.some(x => x.shut) && c.r.late <= plain.late && c.r.over <= plain.over
      && (c.k === order.length || c.r.waits - plain.waits <= 45)
      && !(win.hard && !c.r.over && c.r.end > plain.end && win.endBy - c.r.end < E.FILL_MARGIN);
    let best = null, tried = 0;
    const offer = (seq, k, len, off, fromMap, cut) => {
      // k: where lunch goes in the day; the timing is reused from the plain day up to the first stop that changed.
      const r = walk(seq, win, ctx, { r: plain, k: cut ? k - 1 : k }), c = { seq, r, k, cut };
      c.pen = penalty(r) + (cut || 0) + (len === E.TO_GO ? 60 : len < L.len ? 20 : 0) + off * 1.5 + (fromMap ? 0.5 : 0);
      tried++; if (ok(c) && (!best || c.pen < best.pen - 1e-9)) best = c;
      return c;
    };
    // Between stops: the gaps near lunchtime (left from an hour and a quarter before the kitchen opens to its last orders,
    // plus the last gap before and the first after), or where the traveler put lunch on the Day plan.
    const stops = plain.items.filter(x => x.t === "stop"), dep = [win.sightFrom || win.start].concat(stops.map(x => x.at + (x.min || 0)));
    const gaps = [];
    for (let k = 0; k <= order.length; k++) if (dep[k] >= L.from - 75 && dep[k] <= L.to) gaps.push(k);
    const before = dep.map((t, k) => t < L.from - 75 ? k : -1).filter(k => k >= 0).pop(), after = dep.findIndex(t => t > L.to);
    if (before != null) gaps.push(before); if (after >= 0) gaps.push(after);
    if (ctx.lunchAt != null && !my.pick) { const k = ctx.lunchAt === "^" ? 0 : order.findIndex(s => String(s.id) === ctx.lunchAt) + 1; if (k >= 0 && (ctx.lunchAt === "^" || k > 0)) gaps.splice(0, gaps.length, k); }
    for (const k of [...new Set(gaps)].sort((a, b) => a - b)) {
      // Places near the stop before, near the stop after and halfway: each costs what it takes them out of their way
      // (Nov 18, Corpus Christi: not back over the bridge for lunch). After the last stop: near where the day ends.
      const a = pts[k], b = order[k] || (k === order.length && win.tail.length ? win.tail[0] : null);
      const mid = b && isFinite(b.lat) ? { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 } : null;
      const offOf = e => b && isFinite(b.lat) ? E.hav(a, e.r) + E.hav(e.r, b) - E.hav(a, b) : E.hav(a, e.r);
      const cands = my.pick ? [my.pick] : [...new Map((quick ? [a] : [a, b, mid]).filter(q => q && isFinite(q.lat)).flatMap(q => eatsNear(q, ctx, "Lunch", 3)).map(e => [e.k, e])).values()]
        .sort((x, y) => offOf(x) + (x.r.fromMap ? 0.3 : 0) - offOf(y) - (y.r.fromMap ? 0.3 : 0) || x.k.localeCompare(y.k)).slice(0, quick ? 1 : 3);
      for (const e of cands) for (const len of lens) {
        const c = offer(order.slice(0, k).concat([mealAt(e, len)], order.slice(k)), k, len, my.pick ? 0 : offOf(e), e.r.fromMap);
        if (len === L.len && ok(c) && !c.r.over && !c.r.late) break; // the full lunch fits: a shorter one only costs more
      }
    }
    // Inside a long visit over lunchtime: the visit gives up the lunch and the walk there and back. A visit keeps at least
    // 45 minutes of its own.
    plain.items.filter(x => x.t === "stop" || x.t === "meal").forEach((st, k) => {
      const s = order[k]; if (!s || s.mealOf || st.t !== "stop" || !isFinite(s.lat)) return;
      const over = Math.min(st.at + (st.min || 0), L.to) - Math.max(st.at, L.from);
      const cands = my.pick ? [my.pick] : eatsNear(s, ctx, "Lunch", quick ? 1 : 3);
      for (const len of lens) {
        if (over < len) continue;
        for (const e of cands) {
          const build = cut => order.slice(0, k).concat([Object.assign({}, s, { minutes: s.minutes - cut, lunchIn: len, lunchCut: cut }),
            mealAt(e, len, { inside: s.id, travelNote: e.r.travelNote || (E.byBoat(s.travelNote) && E.hav(s, e.r) <= 3 ? s.travelNote : "") })], order.slice(k + 1));
          if ((s.minutes || 0) - len < 45) continue;
          // First try: the visit loses the lunch itself; the walk shows as how much later the day ends. Then it loses that too.
          const r0 = walk(build(len), win, ctx, { r: plain, k }), cut = len + Math.max(0, Math.ceil(r0.end - plain.end));
          if ((s.minutes || 0) - cut < 45) continue;
          offer(build(cut), k + 1, len, E.hav(s, e.r), e.r.fromMap, cut);
        }
      }
    });
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
    const byId = new Map(stops.map(s => [String(s.id), s]));
    return withLunch(got.seq.filter(x => !x.mealOf).map(x => byId.get(String(x.id)) || x), win, ctx, quick);
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
    if (!quick && (cur.r.late || cur.r.over || cur.noLunch === "time")) {
      // Each pass tries every single move from the same order and takes the best one (Nov 19: the first move that fixed a
      // late museum was taken, a sight beside the first stop sent across town and back, when swapping two museums was better).
      for (let pass = 0; pass < 3; pass++) {
        let best = null;
        for (let i = 0; i < order.length; i++) for (let j = 0; j < order.length; j++) {
          if (i === j || j === i - 1) continue; // moving to just before the previous is the same as moving that one after
          const o = order.slice(); const [x] = o.splice(i, 1); o.splice(j, 0, x);
          if (far.length && near.length && !blockAtEnd(o)) continue;
          // Lunch only adds time, so an order already later or later at a last entry without lunch can't win.
          const bare = walk(o, win, ctx); if (bare.over > cur.r.over || bare.late > cur.r.late) continue;
          const c = withLunch(o, win, ctx), p = cost(c);
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
  const lowestFirst = (a, b) => keepRank(a) - keepRank(b) || (a.worth || 0) - (b.worth || 0) || E.byId(b, a);
  // stops: the day's chosen sights (each with worth; wish = the traveler picked it). pool: other sights it may add.
  // Which stop to give up: among those whose loss makes the day fit, the one worth least; if no single loss is enough,
  // the one that gives back the most time for its worth (a far stop on its own goes before a cluster of near ones).
  function toDrop(keep, from, win, ctx, why) {
    // Each loss is judged on the day as it would really be planned (the same arrange as the final day, lunch included, in its
    // quick form), never on a simpler schedule that could pick a different stop to give up (Nov 19 review).
    const quick = seq => arrange(seq, win, ctx, true).r;
    const base = quick(keep).end;
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
    let keep = stops.slice(), dropped = [], cur = arrange(keep, win, ctx), guard = 0;
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
      const lateIds = new Set(cur.r.items.filter(x => x.late).map(x => String(x.id)));
      const pickFrom = why === "over" ? keep : why === "late" ? keep.filter(s => lateIds.has(String(s.id))) : keep.filter(s => !s.wish);
      const out = toDrop(keep, pickFrom.length ? pickFrom : keep, win, ctx, why);
      if (why === "over" && wanted(out)) {
        const t = trimToFit(keep, win, ctx); if (t) { keep = t.keep; cur = t.cur; continue; }
      }
      const next = keep.filter(s => s !== out), c = arrange(next, win, ctx);
      if (why === "lunch" && c.noLunch === "time") break; // giving it up wouldn't make room for lunch: keep it
      keep = next; cur = c;
      dropped.push({ id: out.id, name: out.name, wish: !!out.wish, wanted: wanted(out), stop: out, why: why === "late" ? "would arrive after its last entry" : "didn't fit in the time" });
    }
    // Room left after the drops: a stop given up earlier comes back when it now fits (wanted ones first, best first).
    for (const x of dropped.slice().sort((a, b) => keepRank(b.stop) - keepRank(a.stop) || (b.stop.worth || 0) - (a.stop.worth || 0) || E.byId(a.stop, b.stop))) {
      const next = keep.concat([x.stop]), c = arrange(next, win, ctx);
      if (!c.r.over && !c.r.late && !(win.hard && win.endBy - c.r.end < E.FILL_MARGIN) && (c.noLunch !== "time" || cur.noLunch === "time" || wanted(x.stop))) { keep = next; cur = c; dropped = dropped.filter(y => y !== x); }
    }
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
  E.dinnerAfter = (win, lastPoint, end, ctx, usedToday) => {
    const my = E.mealPlan(ctx, "Dinner");
    if (win.hard || !lastPoint || my.skip) return null;
    const e = my.pick || eatsNear(lastPoint, ctx, "Dinner", 4).find(x => !(usedToday && usedToday.has(x.k))); if (!e) return null;
    const ride = my.pick ? ctx.tr.min(lastPoint, e.r) : 30, from = my.meal.pinned ? my.meal.from : D.from;
    return Object.assign({ t: "evening", id: "eat:" + e.k, eatKey: e.k, name: e.r.name, at: Math.max(end + ride, from), min: D.len, lat: e.r.lat, lng: e.r.lng }, my.pick ? { chosen: true } : {});
  };
})(KEngine);
