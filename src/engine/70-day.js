// Beta 2 engine, part 6c and 6d: fit one day. Takes the day's chosen stops, finds the best order, puts lunch where it
// falls (at a real place to eat, never one used on another day), repairs the order for opening hours, drops the least
// worth until the day fits its window, then fills spare time with the best unclaimed sights nearby. Every check is one
// walk through the clock (walkDay) with stable estimates, so the same inputs always give the same day.
(function (E) {
  const L = E.MEALS[0], D = E.MEALS[1];
  E.FILL_MARGIN = 15; // a sight the app adds on its own never brings a ship, train or plane day closer than this to its deadline
  E.eatKey = name => String(name || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  // Penalty of a timed day: running past the end is worst, then stops reached after their last entry, then a late lunch.
  const penalty = r => r.over * 1000 + r.late * 500 + r.lateMeal * 4 + r.waits * 0.5 + r.end * 0.01 + r.rideMin * 0.05;
  function walk(seq, win, ctx) {
    const r = E.walkDay(seq, win, ctx.tr.estimate, ctx.siteDay);
    r.lateMeal = r.items.reduce((a, x) => a + (x.lateMeal || 0), 0);
    return r;
  }
  // Lunch belongs in a day whose sightseeing runs at least four hours and through the middle of the day.
  const lunchWanted = E.lunchWanted = win => { const from = win.sightFrom || win.start, to = isFinite(win.sightTo) ? win.sightTo : win.endBy; return to - from >= 240 && from <= 13 * 60 + 30 && to >= 12 * 60 + 45; };
  // The nearest few real places to eat around a point that are open for this meal today and not used on another day.
  function eatsNear(p, ctx, meal, n) {
    // Within one day the list of places to eat and the ledger don't change, so each point is worked out once.
    if (!ctx.eatMemo) {
      ctx.eatMemo = new Map();
      ctx.eatList = ctx.eats.filter(r => isFinite(r.lat) && isFinite(r.lng) && !r.drop).map(r => {
        const k = E.eatKey(r.name), f = ctx.eatFacts[k] || ctx.eatFacts[r.name && r.name.toLowerCase()] || {};
        return { r, k, f };
      });
    }
    const key = meal + n + "@" + p.lat + "," + p.lng, got = ctx.eatMemo.get(key); if (got) return got;
    const out = [];
    for (const x of ctx.eatList) {
      if (meal === "Lunch" ? x.f.lunchShut : x.f.dinnerShut) continue;
      if (!ctx.ledger.eatFree(x.k, ctx.dayIdx)) continue;
      out.push({ r: x.r, k: x.k, d: E.hav(p, x.r) });
    }
    out.sort((a, b) => a.d - b.d || a.k.localeCompare(b.k));
    const res = out.slice(0, n).filter(x => x.d <= 1.5);
    ctx.eatMemo.set(key, res); return res;
  }
  // Best place for lunch in an ordered day: each gap, each of the nearest places to eat; the lowest penalty wins.
  function withLunch(order, win, ctx) {
    const plain = walk(order, win, ctx);
    if (!lunchWanted(win) || !ctx.eats.length) return { seq: order, r: plain };
    let best = null;
    const pts = [win.head[win.head.length - 1]].concat(order);
    // Only the gaps near lunchtime are worth trying: those left between an hour and a quarter before the kitchen opens
    // and its last orders, plus the last gap before that and the first one after.
    const stops = plain.items.filter(x => x.t === "stop"), dep = [win.sightFrom || win.start].concat(stops.map(x => x.at + (x.min || 0)));
    const gaps = [];
    for (let k = 0; k <= order.length; k++) if (dep[k] >= L.from - 75 && dep[k] <= L.to) gaps.push(k);
    const before = dep.map((t, k) => t < L.from - 75 ? k : -1).filter(k => k >= 0).pop(), after = dep.findIndex(t => t > L.to);
    if (before != null) gaps.push(before); if (after >= 0) gaps.push(after);
    for (const k of [...new Set(gaps)].sort((a, b) => a - b)) {
      for (const e of eatsNear(pts[k], ctx, "Lunch", 3)) {
        const meal = { id: "eat:" + e.k, eatKey: e.k, name: e.r.name, lat: e.r.lat, lng: e.r.lng, mealOf: L, len: L.len };
        const seq = order.slice(0, k).concat([meal], order.slice(k)), r = walk(seq, win, ctx), pen = penalty(r);
        if (!best || pen < best.pen - 1e-9) best = { seq, r, pen };
      }
    }
    // Lunch never makes the day run late or reach a stop after its last entry: then the day goes without (and says so).
    // Nor does it mean sitting idle waiting for the kitchen to open (lunch first, then a long ride out of town).
    const ok = best && best.r.lateMeal < 90 && best.r.over <= plain.over && best.r.late <= plain.late && best.r.waits - plain.waits <= 45;
    return ok ? { seq: best.seq, r: best.r } : { seq: order, r: plain, noLunch: best ? "time" : "place" };
  }
  // A day that could have lunch but lost it to the stops counts as worse than a slightly later end.
  const cost = c => penalty(c.r) + (c.noLunch === "time" ? 300 : 0);
  // Order the stops for travel, then try every single move for a better timed day (opening hours, lunch).
  // The out-of-town stops sit together at the start or the end of the day.
  const blockAtEnd = o => { const f = o.map(s => !!s.far), n = f.filter(Boolean).length; return f.slice(0, n).every(Boolean) || f.slice(o.length - n).every(Boolean); };
  // quick: skip the move-by-move repair (used to test a candidate; the day is repaired once it is chosen).
  function arrange(stops, win, ctx, quick) {
    const from = win.head[win.head.length - 1], to = win.tail.length ? win.tail[0] : null;
    let order = E.bestOrder(stops, from, to, ctx.tr.min);
    // A trip out of town is one block, first or last in the day, never wedged between sights in town.
    const far = stops.filter(s => s.far), near = stops.filter(s => !s.far);
    if (far.length && near.length) {
      const farFirst = E.bestOrder(far, from, null, ctx.tr.min), a = farFirst.concat(E.bestOrder(near, farFirst[farFirst.length - 1], to, ctx.tr.min));
      const nearFirst = E.bestOrder(near, from, null, ctx.tr.min), b = nearFirst.concat(E.bestOrder(far, nearFirst[nearFirst.length - 1], to, ctx.tr.min));
      const ca = withLunch(a, win, ctx), cb = withLunch(b, win, ctx);
      order = cost(ca) <= cost(cb) ? a : b;
    }
    let cur = withLunch(order, win, ctx), pen = cost(cur);
    if (!quick && (cur.r.late || cur.r.over || cur.noLunch === "time")) {
      for (let pass = 0; pass < 2; pass++) {
        let better = false;
        for (let i = 0; i < order.length; i++) for (let j = 0; j < order.length; j++) {
          if (i === j || j === i - 1) continue; // moving to just before the previous is the same as moving that one after
          const o = order.slice(); const [x] = o.splice(i, 1); o.splice(j, 0, x);
          if (far.length && near.length && !blockAtEnd(o)) continue;
          // Lunch only adds time, so an order already later or later at a last entry without lunch can't win.
          const bare = walk(o, win, ctx); if (bare.over > cur.r.over || bare.late > cur.r.late) continue;
          const c = withLunch(o, win, ctx), p = cost(c);
          if (p < pen - 1e-6) { order = o; cur = c; pen = p; better = true; }
        }
        if (!better) break;
      }
    }
    return cur;
  }
  const lowestFirst = (a, b) => (a.wish ? 1 : 0) - (b.wish ? 1 : 0) || (a.worth || 0) - (b.worth || 0) || E.byId(b, a);
  // stops: the day's chosen sights (each with worth; wish = the traveler picked it). pool: other sights it may add.
  // Which stop to give up: among those whose loss makes the day fit, the one worth least; if no single loss is enough,
  // the one that gives back the most time for its worth (a far stop on its own goes before a cluster of near ones).
  function toDrop(keep, from, win, ctx, why) {
    const quick = seq => { const o = E.bestOrder(seq, win.head[win.head.length - 1], win.tail.length ? win.tail[0] : null, ctx.tr.min); return E.walkDay(o, win, ctx.tr.estimate, ctx.siteDay); };
    const base = quick(keep).end;
    const scored = from.map(s => { const r = quick(keep.filter(k => k !== s)); return { s, fits: !r.over && !r.late, saved: Math.max(1, base - r.end) }; });
    const fixing = scored.filter(x => x.fits);
    const list = why === "lunch" || !fixing.length ? scored.sort((a, b) => (a.s.wish ? 1 : 0) - (b.s.wish ? 1 : 0) || (a.s.worth || 1) / a.saved - (b.s.worth || 1) / b.saved || E.byId(a.s, b.s))
      : fixing.sort((a, b) => lowestFirst(a.s, b.s));
    return list[0].s;
  }
  // stops: the day's chosen sights (each with worth; wish = the traveler picked it). pool: other sights it may add.
  E.fitDay = (d, win, stops, pool, ctx) => {
    let keep = stops.slice(), dropped = [], cur = arrange(keep, win, ctx), guard = 0;
    const needsLunchRoom = () => cur.noLunch === "time" && keep.some(s => !s.wish);
    while ((cur.r.over || cur.r.late || needsLunchRoom()) && keep.length && guard++ < 40) {
      const why = cur.r.over ? "over" : cur.r.late ? "late" : "lunch";
      const lateIds = new Set(cur.r.items.filter(x => x.late).map(x => String(x.id)));
      const pickFrom = why === "over" ? keep : why === "late" ? keep.filter(s => lateIds.has(String(s.id))) : keep.filter(s => !s.wish);
      const out = toDrop(keep, pickFrom.length ? pickFrom : keep, win, ctx, why);
      const next = keep.filter(s => s !== out), c = arrange(next, win, ctx);
      if (why === "lunch" && c.noLunch === "time") break; // giving it up wouldn't make room for lunch: keep it
      keep = next; cur = c;
      dropped.push({ id: out.id, name: out.name, wish: !!out.wish, why: why === "late" ? "would arrive after its last entry" : "didn't fit in the time" });
    }
    if (d.fillTime !== false && !win.straight) {
      // Spare time: the best unused sights, each worth its detour (worth minus a quarter of the minutes of riding out and back
      // from the nearest stop), added while the day still fits. Cheap check first, then the full timed day.
      const start = win.head[win.head.length - 1];
      const detour = s => 2 * Math.min(ctx.tr.min(start, s), ...keep.map(k => ctx.tr.min(k, s)));
      const farOk = s => keep.some(k => k.far && E.hav(k, s) <= 2.5); // the rest of a day-trip town, never a day in the city
      const cands = pool.filter(s => !keep.some(k => String(k.id) === String(s.id)) && (!s.far || farOk(s)) && (ctx.mayAdd ? ctx.mayAdd(s.id) : ctx.ledger.sightFree(s.id, ctx.dayIdx)))
        .map(s => ({ s, v: (s.worth || 0) - 0.25 * detour(s) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v || E.byId(a.s, b.s));
      const room = win.hard ? E.FILL_MARGIN : 0;
      let tries = 0;
      for (const { s } of cands) {
        if (tries >= 25) break;
        const add = Object.assign({}, s, { filled: true }), next = keep.concat([add]);
        const rough = E.walkDay(E.bestOrder(next, start, win.tail.length ? win.tail[0] : null, ctx.tr.min), win, ctx.tr.estimate, ctx.siteDay);
        if (rough.over || win.endBy - rough.end < room) continue;
        tries++;
        let c = arrange(next, win, ctx, true);
        const fits = x => !x.r.over && !x.r.late && win.endBy - x.r.end >= room && (x.noLunch !== "time" || cur.noLunch === "time");
        if (!fits(c) && tries <= 2) c = arrange(next, win, ctx); // the first two also get the full repair
        if (fits(c)) { keep = next; cur = c; }
      }
      if (cur.noLunch || cur.r.late) cur = arrange(keep, win, ctx);
    }
    return { seq: cur.seq, r: cur.r, kept: keep, dropped, noLunch: lunchWanted(win) ? cur.noLunch || null : null };
  };
  // A dinner suggestion after a land day: the nearest open place to eat not used on another day.
  E.dinnerAfter = (win, lastPoint, end, ctx, usedToday) => {
    if (win.hard || !lastPoint) return null;
    const e = eatsNear(lastPoint, ctx, "Dinner", 4).find(x => !(usedToday && usedToday.has(x.k))); if (!e) return null;
    return { t: "evening", id: "eat:" + e.k, eatKey: e.k, name: e.r.name, at: Math.max(end + 30, D.from), min: D.len, lat: e.r.lat, lng: e.r.lng };
  };
})(KEngine);
