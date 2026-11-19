// Beta 2 engine, part 9: the timed day. Walks a finished order through the clock: rides, waits for opening, time at
// each stop, meals inside their hours, the fixed steps at both ends. It decides nothing: it only reports what the
// order gives, including any stop reached after its last entry and whether the day ends in time. Used both to check a
// candidate order (with stable estimates) and to write the shown plan (with live ride times when given).
(function (E) {
  // seq: stops and meals in order. win: the day's window. ride(a, b) -> leg { min, mode }. siteDay(id) -> today's hours facts.
  // from: { r, k } resumes from an earlier walk r of the same day whose first k stops match seq (lunch tried in each
  // gap re-walks only from that gap on); the answer is the same as walking seq from the start.
  E.walkDay = (seq, win, ride, siteDay, from) => {
    const O = win.head[0], Z = win.tail.length ? win.tail[win.tail.length - 1] : null, st = from && from.r.states && from.r.states[from.k];
    const items = st ? from.r.items.slice(0, st.n) : [], states = [];
    let clock = win.start, prev = O, late = 0, waits = 0, rideMin = 0;
    if (st) ({ clock, prev, late, waits, rideMin } = st); else items.push({ t: "start", name: O && O.name, at: clock });
    const go = (p, type) => {
      const leg = ride(prev, p); items.push(E.rideItem(leg, leg.parts ? { parts: leg.parts } : null)); clock += leg.min; rideMin += leg.min;
      const it = { t: type, id: p.id || null, name: p.name, min: p.minutes || 0 };
      if (type === "stop") { const sd = siteDay ? siteDay(p.id) : null, f = E.hoursFit(sd && sd.oh, clock, p.minutes);
        if (f.wait) { clock += f.wait; waits += f.wait; it.wait = f.wait; } if (f.late > 0) { late++; it.late = f.late; }
        if (p.bonus) it.bonus = true; if (p.along) it.along = true; }
      if (type === "meal") { const m = p.mealOf; if (clock < m.from) { waits += m.from - clock; clock = m.from; } it.meal = m.label; it.min = p.len || m.len; if (m.booked) it.booked = true; if (m.pinned) it.pinned = true; if (p.chosen) it.chosen = true; if (p.toGo) it.toGo = true; if (p.fromMap) it.fromMap = true; if (clock > m.to) it.lateMeal = clock - m.to; }
      it.at = clock; items.push(it); clock += it.min; prev = p;
    };
    const keep = () => states.push({ clock, prev, late, waits, rideMin, n: items.length });
    if (st) { for (let i = 0; i <= from.k; i++) states.push(from.r.states[i]); }
    else { win.head.slice(1).forEach(p => go(p, "fixed")); keep(); }
    seq.forEach((p, i) => { if (st && i < from.k) return; go(p, p.mealOf ? "meal" : "stop"); keep(); });
    win.tail.forEach((p, i) => go(Object.assign({}, p, { minutes: p.fixed ? p.minutes : 0 }), i === win.tail.length - 1 ? "end" : "fixed"));
    if (!Z) items.push({ t: "end", name: "Day done", at: clock });
    const end = clock, over = end - win.endBy;
    return { items, end, late, waits, rideMin, over: over > (win.hard ? 0 : 5) ? over : 0, states };
  };
})(KEngine);
