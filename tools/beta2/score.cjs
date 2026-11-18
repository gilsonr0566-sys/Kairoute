// Beta 2: one scorer for any plan, old or new, in the short plan form (see engineOldPlans in src/features/zz-engine-facts.js).
// score(facts, plans) -> { days: [...], total: {...}, fails: [...] }. Pure: no browser, no internet.
const hav = (a, b) => { const R = x => x * Math.PI / 180, dLa = R(b.lat - a.lat), dLo = R(b.lng - a.lng);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(R(a.lat)) * Math.cos(R(b.lat)) * Math.sin(dLo / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(h)); };
const HARD = new Set(['port', 'embark', 'departure']);
function lateBy(oh, t, len) { // minutes past the last sensible arrival (the listed last entry, or before closing)
  if (!oh || !oh.spans || !oh.spans.length) return 0;
  for (const [a, b] of oh.spans) { const dead = oh.last != null && oh.last <= b ? oh.last : b - Math.min(Math.max(15, len || 0), 45); if (t <= dead) return Math.max(0, Math.max(a, t) - dead); }
  const [, b] = oh.spans[oh.spans.length - 1]; return t - (oh.last != null ? oh.last : b - 30);
}
function score(facts, plans) {
  const days = [], fails = [], seenStop = new Map(), seenMeal = new Map();
  plans.forEach((p, i) => {
    const d = facts.days[i]; if (!p || p.error) { days.push({ i, skip: p ? p.error : 'none' }); return; }
    const city = facts.cities[d.city] || { sites: [], farther: [] }, byId = new Map([...city.sites, ...city.farther].map(s => [s.id, s]));
    const stops = p.items.filter(x => x.t === 'stop'), meals = p.items.filter(x => x.t === 'meal' || x.t === 'evening');
    const rides = p.items.filter(x => x.t === 'ride'), picks = new Set(d.selected || []);
    const r = { i, date: d.date, type: d.type, city: d.city, stops: stops.length, picks: picks.size, picksKept: 0, mustKept: 0, sightMin: 0, rideMin: 0, backtrack: 0, closed: [], late: [], margin: null, over: 0 };
    const been = [];
    stops.forEach(s => {
      const f = byId.get(s.id); if (picks.has(s.id) && !s.bonus && !s.along) r.picksKept++;
      if (f && f.mustSee) r.mustKept++; r.sightMin += s.min || 0;
      const sf = d.sites[s.id]; if (sf && sf.closed) r.closed.push(s.id);
      if (sf && sf.oh && !s.along) { const l = lateBy(sf.oh, s.at, s.min); if (l > 0) r.late.push(s.id + ' +' + Math.round(l)); }
      if (f && isFinite(f.lat)) { const prev = been[been.length - 1]; if (prev && hav(prev, f) > 20 && been.slice(0, -1).some(b => hav(b, f) < 10)) r.backtrack++; been.push(f); }
      if (seenStop.has(s.id) && seenStop.get(s.id) !== i) r.repeat = (r.repeat || []).concat(s.id); else seenStop.set(s.id, i);
    });
    meals.forEach(m => { if (!m.name || /^(Lunch|Dinner) near /.test(m.name) || /^Booked /.test(m.name)) return; const k = m.name.toLowerCase(); if (seenMeal.has(k) && seenMeal.get(k) !== i) r.mealRepeat = (r.mealRepeat || []).concat(m.name); else seenMeal.set(k, i); });
    rides.forEach(x => { r.rideMin += x.min || 0; });
    r.end = p.end; r.endBy = p.endBy;
    if (HARD.has(d.type)) r.margin = p.endBy - p.end; // minutes to spare before the ship, train or plane's "be there by"
    r.over = Math.max(0, p.end - p.endBy - (HARD.has(d.type) ? 0 : 5));
    const label = `${d.date} ${d.city} (${i})`;
    if (r.closed.length) fails.push(label + ': closed stop ' + r.closed.join(', '));
    if (r.late.length) fails.push(label + ': reached after last entry ' + r.late.join(', '));
    if (r.over) fails.push(label + ': ends ' + r.over + ' min late');
    if (r.repeat) fails.push(label + ': sight repeated from another day ' + r.repeat.join(', '));
    if (r.mealRepeat) fails.push(label + ': place to eat repeated ' + r.mealRepeat.join(', '));
    if (r.backtrack) fails.push(label + ': doubles back ' + r.backtrack + 'x');
    days.push(r);
  });
  const ok = days.filter(x => !x.skip), sum = k => ok.reduce((a, x) => a + (x[k] || 0), 0);
  const margins = ok.filter(x => x.margin != null).map(x => x.margin);
  return { days, fails, total: { days: ok.length, stops: sum('stops'), picks: sum('picks'), picksKept: sum('picksKept'), mustKept: sum('mustKept'), sightMin: sum('sightMin'), rideMin: sum('rideMin'), backtrack: sum('backtrack'), minMargin: margins.length ? Math.min(...margins) : null } };
}
module.exports = { score, hav, lateBy };
if (require.main === module) {
  const fs = require('fs'), path = require('path'), dir = path.join(__dirname, 'snapshots');
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const s = JSON.parse(fs.readFileSync(path.join(dir, f))), r = score(s, s.old);
    console.log(`\n== ${s.label} (old engine)\n` + JSON.stringify(r.total)); r.fails.forEach(x => console.log('  FAIL ' + x));
  }
}
