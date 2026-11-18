// Beta 2 engine, part 6a: a stay of several days in one place is split into areas first, and each day takes its own
// area (city-stay dry run: "earliest day it fits" filled day 1 with sights from all over town and left the last days
// empty). Each day gets a share of the sights in proportion to its free time, sights go to the nearest day's area that
// still has room, and a day the traveler picked sights for has its area centred on those picks. A sight left over
// after its own day is planned may still be used by a later day. Pure and order-free: ties break by id.
(function (E) {
  // days: [{ i, free (minutes), wishes: [sights] }]. sights: the place's sights (with worth, lat, lng, minutes).
  // Returns Map(sight id -> day index).
  E.splitAreas = (days, sights) => {
    const out = new Map();
    const list = sights.filter(s => isFinite(s.lat) && isFinite(s.lng)).slice().sort((a, b) => (b.worth || 0) - (a.worth || 0) || E.byId(a, b));
    if (days.length < 2 || !list.length) return out;
    const totalFree = days.reduce((a, d) => a + Math.max(30, d.free), 0);
    const totalMin = list.reduce((a, s) => a + (s.minutes || 30) + 12, 0);
    // Seeds: the middle of a day's own picks; then, for the other days (most free time first), the good sight
    // farthest from every seed so far (the best sight when there is none yet).
    const seeds = new Map(), centre = pts => ({ lat: pts.reduce((a, p) => a + p.lat, 0) / pts.length, lng: pts.reduce((a, p) => a + p.lng, 0) / pts.length });
    days.filter(d => d.wishes.length).forEach(d => seeds.set(d.i, centre(d.wishes)));
    const good = list.slice(0, Math.max(1, Math.ceil(list.length / 2)));
    days.filter(d => !seeds.has(d.i)).sort((a, b) => b.free - a.free || a.i - b.i).forEach(d => {
      const have = [...seeds.values()];
      let best = null, bestD = -1;
      for (const s of good) { const dist = have.length ? Math.min(...have.map(p => E.hav(p, s))) : 0; if (dist > bestD + 1e-9) { best = s; bestD = dist; } }
      seeds.set(d.i, { lat: best.lat, lng: best.lng });
    });
    // Each day's room: its share of all the sights' minutes, plus a little slack, so no day takes everything.
    const room = new Map(days.map(d => [d.i, totalMin * Math.max(30, d.free) / totalFree * 1.15]));
    const wishDay = new Map(); days.forEach(d => d.wishes.forEach(s => wishDay.set(String(s.id), d.i)));
    for (const s of list) {
      const k = String(s.id), cost = (s.minutes || 30) + 12;
      let day = wishDay.get(k);
      if (day == null) {
        const order = days.map(d => ({ i: d.i, dist: E.hav(seeds.get(d.i), s) })).sort((a, b) => a.dist - b.dist || a.i - b.i);
        day = (order.find(o => room.get(o.i) >= cost) || order[0]).i;
      }
      out.set(k, day); room.set(day, room.get(day) - cost);
    }
    return out;
  };
})(KEngine);
// A day trip on a stay of several days (Hamburg dry run: the app should find the best town nearby by its own rule).
// The best farther sight, with the farther sights within a short walk of it, earns a whole day when what it gives is
// worth more than the city sights the stay would lose by giving up that day. days: [{ i, free, wishes }] (days with
// the traveler's own picks are never taken). city, far: sights with worth. ride(s): minutes one way from the stay.
// Returns { day, ids } or null.
(function (E) {
  const fill = (sights, room) => { let used = 0, w = 0; for (const s of sights) { const c = (s.minutes || 30) + 12; if (used + c <= room) { used += c; w += s.worth || 0; } } return w; };
  E.pickDayTrip = (days, city, far, ride, near) => {
    const open = days.filter(d => !d.wishes.length);
    if (days.length < 2 || !open.length || !far.length) return null;
    const best = city.slice().sort((a, b) => (b.worth || 0) - (a.worth || 0) || E.byId(a, b));
    const share = d => Math.max(0, d.free) * 0.75, all = days.reduce((a, d) => a + share(d), 0);
    const day = open.slice().sort((a, b) => b.free - a.free || b.i - a.i)[0];
    const lost = fill(best, all) - fill(best, all - share(day));
    let top = null;
    // A day out goes to a place (a town, a big site), never to one sight inside a town: that town's sights come along
    // in its group.
    for (const f of far.filter(s => !s.town).sort((a, b) => (b.worth || 0) - (a.worth || 0) || E.byId(a, b))) {
      const group = far.filter(s => s === f || E.hav(f, s) <= near).sort((a, b) => (b.worth || 0) - (a.worth || 0) || E.byId(a, b));
      const room = day.free * 0.85 - 2 * ride(f);
      if (room < (f.minutes || 60)) continue;
      const gain = fill(group, room);
      if (!top || gain > top.gain) top = { gain, group };
    }
    if (!top || top.gain <= lost) return null;
    return { day: day.i, ids: top.group.map(s => String(s.id)) };
  };
})(KEngine);
