// Beta 2 lunch audit (Nov 22 2026, Richard: "make the app 100%"; Pompeii with no lunch place). Every day of every test
// trip, re-picked the ways a traveler re-picks it (as the scenario sweep does), and every lunch the plan makes checked
// against ONE set of lunch rules. Not tied to any place: the same rules run on every day. No AI, no internet.
//   real      lunch is at a real, named place to eat (never "Lunch in <town>", "Lunch near X" or a made-up name), or it
//             is a lunch the traveler brings
//   meal      the place serves meals (not only a bar, café, bakery or ice cream)
//   open      the place is not known to be shut when lunch is planned (its hours that weekday)
//   time      lunch starts by 2:30 pm (the kitchen's last orders), and never before 11:30
//   walk      lunch never adds more than a 15-minute walk (1.1 km) out of the way between the stop before and the next
//   once      a place to eat is used on one day of the trip only
//   out       a day out over lunchtime has lunch (or the plan says why)
// Facts that are not known are listed apart (hours not on the map), never counted as passed or failed.
// Usage: PLACES_DIR=tools/places/data node tools/beta2/lunch-audit.cjs [--list] [--json out.json] [--dir <trips dir>]
const fs = require('fs'), path = require('path'), E = require('./engine.cjs');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const dir = arg('--dir') || (fs.existsSync(path.join(__dirname, 'snapshots')) && fs.readdirSync(path.join(__dirname, 'snapshots')).some(f => f.endsWith('.json')) ? path.join(__dirname, 'snapshots') : path.join(__dirname, 'corpus'));
const list = process.argv.includes('--list'), jsonOut = arg('--json');
const PD = process.env.PLACES_DIR, places = {};
if (PD) for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; }
const rules = { real: 'lunch not at a real named place', meal: 'lunch at a place that does not serve meals', open: 'lunch at a place shut at that hour',
  time: 'lunch at an odd hour', walk: 'long walk to or from lunch', once: 'same place to eat on two days', out: 'day out over lunchtime with no lunch said' };
const out = {}, gaps = { hours: new Set(), packed: [], cafe: new Set() }; Object.keys(rules).forEach(k => out[k] = []);
const seen = new Set(), add = (k, msg) => { if (seen.has(k + msg)) return; seen.add(k + msg); out[k].push(msg); };
const lunches = []; let variants = 0, days = 0;
const NOT_REAL = /^(lunch|quick lunch|lunch on the go)( in | near |$)|\byour pick\b|\bfind a place\b/i;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  const raw0 = JSON.parse(fs.readFileSync(path.join(dir, f))), base = PD ? E.applyPlaces(JSON.parse(JSON.stringify(raw0)), places) : raw0;
  base.days.forEach((d, i) => {
    if (d.noShore || d.type === 'sea') return; const city = base.cities[d.city]; if (!city) return;
    const far = (city.farther || []).filter(s => !s.town && isFinite(s.lat)).slice(0, 5), town = (city.sites || []).filter(s => isFinite(s.lat) && !s.quick).slice(0, 3);
    const sets = [null, []].concat(far.map(s => [s.id]));
    for (let a = 0; a < far.length; a++) for (let b = a + 1; b < far.length; b++) sets.push([far[a].id, far[b].id]);
    for (const s of far.slice(0, 3)) if (town[0]) sets.push([s.id, town[0].id]);
    if (town.length) sets.push(town.map(s => s.id));
    for (const pick of sets) {
      variants++;
      const s = pick === null ? base : Object.assign({}, base, { days: base.days.map((e, j) => j === i ? Object.assign({}, e, { selected: pick.slice(), mine: pick.slice(), own: true, cleared: !pick.length }) : e) });
      let all; try { all = E.planTrip(s); } catch (e) { continue; }
      const p = all[i]; if (!p || p.error || !p.items) continue; days++;
      const tag = `${f} day ${i} ${d.date || ''} (${d.city}, ${d.type}) [${pick === null ? 'as saved' : pick.join(', ') || 'emptied'}]`;
      const st = p.items.filter(x => x.t === 'stop' && !x.bonus), said = (p.explain || []).join(' ') + ' ' + (p.lunchNote || '');
      const meals = p.items.filter(x => x.t === 'meal' && x.meal === 'Lunch');
      // out: out from before noon to after 2:30 pm with two stops or more, and no lunch and nothing said
      if (st.length >= 2 && !meals.length) { const first = Math.min(...st.map(x => x.at)), last = Math.max(...st.map(x => x.at + (x.min || 0)));
        if (first <= 12 * 60 && last >= 14 * 60 + 30 && !/lunch/i.test(said)) add('out', `${tag}: out ${E.clock(first)} to ${E.clock(last)}, no lunch and nothing said`); }
      for (const m of meals) {
        const k = E.eatKey(m.name), r = (city.restaurants || []).find(y => E.eatKey(y.name) === k) || {};
        const fact = (d.eats || {})[k] || (d.eats || {})[String(m.name).toLowerCase()];
        const known = !!(fact && (fact.closed || (fact.oh && fact.oh.spans && fact.oh.spans.length)));
        const pts = p.items.filter(y => isFinite(y.lat) && y.t !== 'ride'), j = pts.indexOf(m), before = pts[j - 1], after = pts[j + 1];
        const ix = p.items.indexOf(m), rideIn = p.items[ix - 1] && p.items[ix - 1].t === 'ride' ? p.items[ix - 1] : null, rideOut = p.items[ix + 1] && p.items[ix + 1].t === 'ride' ? p.items[ix + 1] : null;
        const rec = { trip: f, day: i, date: d.date, city: d.city, type: d.type, pick: pick === null ? 'as saved' : pick.join(','), name: m.name, at: m.at, min: m.min, lat: m.lat, lng: m.lng,
          fromMap: !!m.fromMap, packed: !!m.packed, onBoard: !!m.onBoard, booked: !!m.booked, chosen: !!m.chosen, hoursKnown: known, kind: r.kind || '', cuisine: r.cuisine || '',
          before: before ? before.name : '', after: after ? after.name : '', kmBefore: before ? +E.hav(before, m).toFixed(2) : null, kmAfter: after ? +E.hav(m, after).toFixed(2) : null,
          rideIn: rideIn ? rideIn.mode + ' ' + rideIn.min : '', rideOut: rideOut ? rideOut.mode + ' ' + rideOut.min : '' };
        lunches.push(rec);
        if (m.booked || m.chosen) continue; // the traveler's own table
        const where = `${tag}: ${m.name} at ${E.clock(m.at)}`;
        if (!m.packed && !m.onBoard && (NOT_REAL.test(m.name) || r.townLunch || m.townLunch)) add('real', `${where}`);
        if (!m.packed && !m.onBoard && !E.mealPlace(Object.assign({}, r, { name: m.name }))) add('meal', `${where} (${r.cuisine || r.amenity || 'no kind given'})`);
        else if (!m.packed && !m.onBoard && E.cafeName({ name: m.name, cuisine: r.cuisine })) gaps.cafe.add(`${f} (${d.city}): ${m.name}`);
        if (known && E.closedForDay(fact, { start: m.at, endBy: m.at + m.min }, m.min)) add('open', `${where} (hours ${JSON.stringify(fact.oh && fact.oh.spans)})`);
        if (!known && !m.packed && !m.onBoard) gaps.hours.add(`${f} (${d.city}): ${m.name}`);
        if (m.at > 14 * 60 + 30 || m.at < 11 * 60 + 30) add('time', `${where}`);
        const walkIn = rideIn && rideIn.mode === 'walk' ? rideIn.min : null, walkOut = rideOut && rideOut.mode === 'walk' ? rideOut.min : null;
        // The walk lunch adds: from the stop before to lunch and on to the next, against going straight there. A walk back to the
        // ship or the hotel is walked anyway; only what lunch adds counts (more than 15 minutes' walk, about 1.1 km).
        const offKm = before && after ? E.hav(before, m) + E.hav(m, after) - E.hav(before, after) : before ? E.hav(before, m) : 0;
        if (walkIn != null && walkIn > 15 && offKm > 1.1) add('walk', `${where}: walk ${walkIn} min in from ${rec.before}, ${offKm.toFixed(1)} km out of the way`);
        if (m.packed) gaps.packed.push(`${tag}: brings lunch (no place known near ${rec.before || rec.after})`);
      }
      // once: a place to eat on two days of the same plan
      const by = new Map(); all.forEach((q, j) => (q && q.items || []).forEach(x => { if ((x.t === 'meal') && !x.packed && !x.onBoard && !x.booked && !x.chosen) { const kk = E.eatKey(x.name); if (!by.has(kk)) by.set(kk, new Set()); by.get(kk).add(j); } }));
      for (const [kk, set] of by) if (set.size > 1 && set.has(i)) add('once', `${tag}: ${kk} on days ${[...set].join(', ')}`);
    }
  });
}
let total = 0;
for (const k of Object.keys(out)) { total += out[k].length; console.log(`${String(out[k].length).padStart(4)}  ${rules[k]}`); if (list) out[k].slice(0, 40).forEach(m => console.log('      ' + m)); }
console.log(`      not known: ${gaps.hours.size} places to eat planned for lunch with no hours on the map (the day says so)`);
console.log(`      café by name (no restaurant nearer): ${gaps.cafe.size}`); if (list) [...gaps.cafe].forEach(m => console.log('        ' + m));
console.log(`      lunch brought: ${gaps.packed.length} days (no place to eat known nearby)`); if (list) [...new Set(gaps.packed)].slice(0, 30).forEach(m => console.log('        ' + m));
const uniq = new Map(); lunches.forEach(x => uniq.set(x.city + '|' + E.eatKey(x.name), x));
console.log(`${String(total).padStart(4)}  lunch faults in ${days} planned days (${variants} variants), ${uniq.size} different places to eat used`);
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ faults: out, lunches, places: [...uniq.values()] }, null, 1));
process.exit(total ? 1 : 0);
