// Beta 2 engine, part 9: the timed day. Walks a finished order through the clock: rides, waits for opening, time at
// each stop, meals inside their hours, the fixed steps at both ends. It decides nothing: it only reports what the
// order gives, including any stop reached after its last entry and whether the day ends in time. Used both to check a
// candidate order (with stable estimates) and to write the shown plan (with live ride times when given).
(function (E) {
  // seq: stops and meals in order. win: the day's window. ride(a, b) -> leg { min, mode }. siteDay(id) -> today's hours facts.
  E.walkDay = (seq, win, ride, siteDay) => {
    const items = [], O = win.head[0], Z = win.tail.length ? win.tail[win.tail.length - 1] : null;
    let clock = win.start, prev = O, late = 0, waits = 0, rideMin = 0;
    items.push({ t: "start", name: O && O.name, at: clock });
    const go = (p, type) => {
      const leg = ride(prev, p); items.push(Object.assign({ t: "ride", mode: leg.mode, min: leg.min, km: Math.round((leg.km || 0) * 100) / 100 }, leg.options ? { how: leg.how, options: leg.options } : leg.mode === "boat" || leg.mode === "lift" ? { how: leg.how } : {})); clock += leg.min; rideMin += leg.min;
      const it = { t: type, id: p.id || null, name: p.name, min: p.minutes || 0 };
      if (type === "stop") { const sd = siteDay ? siteDay(p.id) : null, f = E.hoursFit(sd && sd.oh, clock, p.minutes);
        if (f.wait) { clock += f.wait; waits += f.wait; it.wait = f.wait; } if (f.late > 0) { late++; it.late = f.late; }
        if (p.bonus) it.bonus = true; if (p.along) it.along = true; }
      if (type === "meal") { const m = p.mealOf; if (clock < m.from) { waits += m.from - clock; clock = m.from; } it.meal = m.label; it.min = p.len || m.len; if (m.booked) it.booked = true; if (m.pinned) it.pinned = true; if (p.chosen) it.chosen = true; if (p.toGo) it.toGo = true; if (clock > m.to) it.lateMeal = clock - m.to; }
      it.at = clock; items.push(it); clock += it.min; prev = p;
    };
    win.head.slice(1).forEach(p => go(p, "fixed"));
    seq.forEach(p => go(p, p.mealOf ? "meal" : "stop"));
    win.tail.forEach((p, i) => go(Object.assign({}, p, { minutes: p.fixed ? p.minutes : 0 }), i === win.tail.length - 1 ? "end" : "fixed"));
    if (!Z) items.push({ t: "end", name: "Day done", at: clock });
    const end = clock, over = end - win.endBy;
    return { items, end, late, waits, rideMin, over: over > (win.hard ? 0 : 5) ? over : 0 };
  };
})(KEngine);
