// Beta 2 engine, part 9: the timed day. Walks a finished order through the clock: rides, waits for opening, time at
// each stop, meals inside their hours, the fixed steps at both ends. It decides nothing: it only reports what the
// order gives, including any stop reached after its last entry and whether the day ends in time. Used both to check a
// candidate order (with stable estimates) and to write the shown plan (with live ride times when given).
(function (E) {
  // Extra time on the way back to a ship, train or plane for t minutes of riding: none under 10, then half of it up to 15,
  // then 30% (at least 15). It only grows with the riding.
  E.slackFor = t => t < 10 ? 0 : t < 30 ? Math.min(15, Math.ceil(t / 2 / 5) * 5) : Math.max(15, Math.round(t * 0.3 / 5) * 5);
  E.MEAL_SEATED = 15; // minutes early at a place to eat that are no idle wait
  // seq: stops and meals in order. win: the day's window. ride(a, b) -> leg { min, mode }. siteDay(id) -> today's hours facts.
  // from: { r, k } resumes from an earlier walk r of the same day whose first k stops match seq (lunch tried in each
  // gap re-walks only from that gap on); the answer is the same as walking seq from the start.
  E.walkDay = (seq, win, ride, siteDay, from) => {
    const O = win.head[0], Z = win.tail.length ? win.tail[win.tail.length - 1] : null, st = from && from.r.states && from.r.states[from.k];
    const items = st ? from.r.items.slice(0, st.n) : [], states = [];
    let clock = win.start, prev = O, late = 0, waits = 0, rideMin = 0;
    if (st) ({ clock, prev, late, waits, rideMin } = st); else items.push({ t: "start", name: O && O.name, at: clock });
    const go = (p, type) => {
      const leg = ride(prev, p), ri = E.rideItem(leg, leg.parts ? { parts: leg.parts } : null); items.push(ri); clock += leg.min; rideMin += leg.min;
      // A boat that doesn't sail before a set time (the guide's first boat): the wait at the pier is part of the day.
      if (leg.first && clock < leg.first.at + leg.first.after) { const w = leg.first.at + leg.first.after - clock; clock += w; waits += w; ri.wait = w; ri.firstBoat = leg.first.at; }
      const it = { t: type, id: p.id || null, name: p.name, min: p.minutes || 0 };
      if (type === "stop") { const sd = siteDay ? siteDay(p.id) : null, f = E.hoursFit(sd && sd.oh, clock, p.minutes);
        if (f.wait) { clock += f.wait; waits += f.wait; it.wait = f.wait; } if (f.late > 0) { late++; it.late = f.late; }
        if (p.bonus) it.bonus = true; if (p.along) it.along = true; }
      // Early at a place to eat: seated with a drink and the menu, the first quarter hour is no idle wait (Nov 19: lunch
      // 1.7 km out of the way, to save five minutes before the kitchen opened). Longer is still a wait.
      if (type === "meal") { const m = p.mealOf; if (clock < m.from) { waits += Math.max(0, m.from - clock - E.MEAL_SEATED); clock = m.from; }
        // The place's own hours that day, read and checked exactly as a sight's (E.hoursFit): wait for it to open (the first
        // quarter hour seated is no idle wait), and a meal that can't finish before closing is late by the minutes it runs
        // over (Nov 19 review: lunch was planned when the restaurant was shut).
        if (p.oh) { const len = p.len || m.len, f = E.hoursFit(p.oh, clock, len);
          if (f.wait) { waits += Math.max(0, f.wait - E.MEAL_SEATED); clock += f.wait; } if (f.late > 0) { it.shut = true; it.lateMeal = (it.lateMeal || 0) + f.late; } } it.meal = m.label; it.min = p.len || m.len; if (m.booked) it.booked = true; if (m.pinned) it.pinned = true; if (p.chosen) it.chosen = true; if (p.toGo) it.toGo = true; if (p.fromMap) it.fromMap = true; if (p.packed) it.packed = true; if (clock > m.to) it.lateMeal = (it.lateMeal || 0) + clock - m.to; }
      it.at = clock; items.push(it); clock += it.min; prev = p;
    };
    const keep = () => states.push({ clock, prev, late, waits, rideMin, n: items.length });
    if (st) { for (let i = 0; i <= from.k; i++) states.push(from.r.states[i]); }
    else { win.head.slice(1).forEach(p => go(p, "fixed")); keep(); }
    seq.forEach((p, i) => { if (st && i < from.k) return; go(p, p.mealOf ? "meal" : "stop"); keep(); });
    win.tail.forEach((p, i) => go(Object.assign({}, p, { minutes: p.fixed ? p.minutes : 0 }), i === win.tail.length - 1 ? "end" : "fixed"));
    // The extra time for the ship, train or plane belongs to the whole way back (Nov 20 review: a stop beside the ship
    // took the extra off the long taxi back from a far site). Every ride after the day's farthest place counts, and the
    // extra slides with their time (E.slackFor), never less than what the rides already carry.
    if (win.hard && Z && E.hasPos(Z)) {
      let far = -1, fd = -1; seq.forEach((p, i) => { if (E.hasPos(p)) { const dd = E.hav(Z, p); if (dd > fd) { fd = dd; far = i; } } });
      const at = states[far + 1], back = items.slice(at.n).filter(x => x.t === "ride"), has = back.reduce((a, x) => a + (x.slack || 0), 0);
      const base = back.reduce((a, x) => a + (x.mode === "walk" ? 0 : x.min || 0), 0) - has, need = E.slackFor(base) - has;
      // It sits on the last ride, into the ship: the time to leave the last stop comes that much earlier.
      const last = back[back.length - 1];
      if (need > 0 && last) { last.min += need; last.slack = (last.slack || 0) + need; last.wayBack = need; rideMin += need; clock += need; const e = items[items.length - 1]; if (e.t === "end") e.at += need; }
    }
    if (!Z) items.push({ t: "end", name: "Day done", at: clock });
    const end = clock, over = end - win.endBy;
    return { items, end, late, waits, rideMin, over: over > (win.hard ? 0 : 5) ? over : 0, states };
  };
})(KEngine);
