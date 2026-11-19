// Beta 2 scenario sweep: every day of every test trip, re-picked the ways a traveler re-picks it, each checked against the
// app's rules. Not tied to any place: the same rules run on every day. No AI, no internet.
//   For each day ashore: the day emptied; each day trip alone; every two day trips together; a day trip with the best
//   sight in town; the best three sights in town. Each variant is planned as the traveler's own list (as after ticking).
// Rules checked on every variant:
//   safe      every stop ends before the time to be back, and the last ride gets there in time (ship, train, plane)
//   picked    every pick is planned, or the plan says why
//   cleared   an emptied day plans nothing
//   rideFrom  a ride between two trips out is never timed from either one's "getting there" note (the note is from town)
//   ways      a ride out to a sight offers every way its note names, each with the note's own time
//   rideChoice a ride choice the traveler picks is the ride the plan takes between those two places, whichever way
//             the day runs (Nov 18: the train from Sorrento to Pompeii was lost when the day turned round)
//   lunchWay  lunch is where the traveler is or along the way: never out and back off the path (Nov 18, Corpus Christi:
//             North Beach, back over the bridge for lunch, then over the bridge again)
//   lunch     a day out of town at lunchtime names a place to eat there (a data gap when the guide has none: listed apart)
//   tickets   a planned book-ahead sight has its own official website for tickets (a data gap when missing: listed apart)
// Usage: PLACES_DIR=tools/places/data node tools/beta2/scenarios.cjs [--list]
const fs = require('fs'), path = require('path'), E = require('./engine.cjs');
const dir = path.join(__dirname, 'snapshots'), list = process.argv.includes('--list');
const PD = process.env.PLACES_DIR, places = {};
if (PD) for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; }
const out = { safe: [], picked: [], cleared: [], rideFrom: [], ways: [], rideChoice: [], lunchWay: [], lunch: [], tickets: [] }, gaps = { lunch: [], tickets: [] };
const label = { safe: 'stop or ride past the time to be back', picked: 'pick neither planned nor explained', cleared: 'emptied day still planned',
  rideFrom: "ride between two trips out timed from a sight's own note", ways: "way to a sight its note names, not offered", lunchWay: 'lunch off the way (out and back)', rideChoice: 'a picked ride not taken', lunch: 'lunch out of town not named', tickets: 'book-ahead sight without its official website' };
let variants = 0;
const seen = new Set(), add = (k, msg) => { if (seen.has(k + msg)) return; seen.add(k + msg); out[k].push(msg); };
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  const raw0 = JSON.parse(fs.readFileSync(path.join(dir, f))), base = PD ? E.applyPlaces(JSON.parse(JSON.stringify(raw0)), places) : raw0;
  base.days.forEach((d, i) => {
    if (d.noShore || d.type === 'sea') return; const city = base.cities[d.city]; if (!city) return;
    const far = (city.farther || []).filter(s => !s.town && isFinite(s.lat)).slice(0, 4), town = (city.sites || []).filter(s => isFinite(s.lat) && !s.quick).slice(0, 3);
    const sets = [[]].concat(far.map(s => [s.id]));
    for (let a = 0; a < far.length; a++) for (let b = a + 1; b < far.length; b++) sets.push([far[a].id, far[b].id]);
    if (far[0] && town[0]) sets.push([far[0].id, town[0].id]);
    if (town.length) sets.push(town.map(s => s.id));
    for (const pick of sets) {
      variants++;
      const s = Object.assign({}, base, { days: base.days.map((e, j) => j === i ? Object.assign({}, e, { selected: pick.slice(), mine: pick.slice(), own: true, cleared: !pick.length }) : e) });
      let p; try { p = E.planTrip(s)[i]; } catch (e) { add('safe', `${f} day ${i} [${pick}]: engine error ${e.message}`); continue; }
      const tag = `${f} day ${i} (${d.city}) [${pick.join(', ') || 'emptied'}]`;
      if (!p || p.error || !p.items) continue;
      const st = p.items.filter(x => x.t === 'stop'), said = (p.explain || []).join(' ');
      // safe
      // A ship, train or plane: not a minute past. A day at the hotel may run up to 5 minutes over its planned end (the
      // timeline's own allowance): more is a leak.
      const hard = /port|embark|departure/.test(d.type), slack = hard ? 0.5 : 5.5;
      if (isFinite(p.endBy)) { st.forEach(x => { if (x.at + x.min > p.endBy + slack) add('safe', `${tag}: ${x.name} ends ${E.clock(x.at + x.min)}, after ${E.clock(p.endBy)}`); });
        if (isFinite(p.end) && p.end > p.endBy + slack) add('safe', `${tag}: back ${E.clock(p.end)}, after ${E.clock(p.endBy)}`); }
      // cleared / picked
      if (!pick.length && st.some(x => !x.bonus)) add('cleared', `${tag}: ${st.filter(x => !x.bonus).map(x => x.name).join(', ')}`);
      for (const id of pick) { const sx = (city.sites || []).concat(city.farther || []).find(y => String(y.id) === String(id));
        if (!st.some(x => String(x.id) === String(id) || (x.includesIds || []).map(String).includes(String(id))) && !(sx && said.includes(sx.name))) add('picked', `${tag}: ${sx ? sx.name : id}`); }
      // rides
      p.items.forEach((x, k) => { if (x.t !== 'ride') return; const a = p.items[k - 1], b = p.items[k + 1]; if (!a || !b) return;
        const sa = (city.sites || []).concat(city.farther || []).find(y => String(y.id) === String(a.id)), sb = (city.sites || []).concat(city.farther || []).find(y => String(y.id) === String(b.id));
        const noteOf = y => y && y.travelNote && !E.byBoat(y.travelNote) ? y.travelNote : '';
        if (noteOf(sa) && noteOf(sb) && (x.options || []).some(o => (o.id === 'boat' || o.id === 'transit') && /plus 15 to get to the station|at the pier for the next sailing/.test(o.how || '')))
          add('rideFrom', `${tag}: ${a.name} to ${b.name} offers "${(x.options.find(o => /plus 15|at the pier/.test(o.how || '')) || {}).how}"`);
        // Only a ride between the sight and the place itself (within 15 km of where the day starts) is the note's ride.
        const home = E.dayWindow(d, E.makeTravel(base.prefs, base.legModes)), h0 = home && home.head && home.head[home.head.length - 1];
        const farIds = new Set((city.farther || []).map(z => String(z.id))), inTown = y => h0 && isFinite(y.lat) && E.hav(h0, y) <= 15 && !farIds.has(String(y.id)) && !/^Lunch in /.test(y.name || '');
        const one = noteOf(sa) && !noteOf(sb) && inTown(b) ? sa : noteOf(sb) && !noteOf(sa) && inTown(a) ? sb : null;
        if (one && E.hav(a, b) > 15) for (const w of E.noteWays(one.travelNote).filter(w => w.said && w.id !== 'taxi'))
          if (!(x.options || []).some(o => o.id === w.id && o.min >= w.said)) add('ways', `${tag}: ${a.name} to ${b.name}: ${w.how} (${w.said} min) not offered`); });
      // a picked ride is taken: each other way on the first long ride, picked, is the ride between those places
      if (pick.some(id => /-far$/.test(id))) { const legs = p.items.filter((x, k) => x.t === 'ride' && x.from && x.to && E.hav(x.from, x.to) > 5 && (x.options || []).length > 1 && ![p.items[k - 1], p.items[k + 1]].some(y => !y || y.bonus || y.t === 'meal')); // between the traveler's own places (an optional stop gives way)
        for (const leg of legs.slice(0, 1)) for (const o of leg.options.filter(o => o.id && o.id !== leg.choice && o.id !== 'walk')) {
          const k = E.pairKey(leg.from, leg.to), s2 = Object.assign({}, s, { legModes: Object.assign({}, s.legModes || {}, { [k]: o.id }) });
          let p2; try { p2 = E.planTrip(s2)[i]; } catch (e) { continue; } if (!p2 || !p2.items || p2.safe) continue;
          const tol = Math.max(1.5, E.hav(leg.from, leg.to) / 5), near = (x, y) => E.hav(x, y) <= tol, same = r => r.t === 'ride' && r.from && r.to && ((near(r.from, leg.from) && near(r.to, leg.to)) || (near(r.from, leg.to) && near(r.to, leg.from)));
          const allKept = pick.every(id => p2.items.some(x => x.t === 'stop' && String(x.id) === String(id))); // a ride that costs a pick is the traveler's call (the app asks first)
          const got = p2.items.filter(same);
          if (allKept && got.length && !got.some(r => r.choice === o.id || (o.id === 'taxi' && r.mode === 'ride'))) add('rideChoice', `${tag}: ${leg.from.name || ''} to ${leg.to.name || ''}: picked ${o.how || o.id}, plan took ${got.map(r => r.choice || r.mode).join('/')}`);
                    if (!got.length && allKept) add('rideChoice', `${tag}: picked ${o.how || o.id}: the ride is gone from the plan`); } }
      // lunch on the way: from the place before lunch to the one after, lunch adds at most 1 km of going out of the way (a tenth of
      // the hop on a long ride back from a trip out)
      p.items.forEach((x, k) => { if (x.t !== 'meal' || !isFinite(x.lat)) return;
        const pts = p.items.filter(y => isFinite(y.lat) && y.t !== 'ride'), j = pts.indexOf(x), a = pts[j - 1], b = pts[j + 1]; if (!a || !b || (a.t !== 'stop' && b.t !== 'stop')) return; // lunch alone is the outing
        const off = E.hav(a, x) + E.hav(x, b) - E.hav(a, b);
        if (off > Math.max(1.0, 0.1 * E.hav(a, b))) add('lunchWay', `${tag}: ${a.name} > ${x.name} > ${b.name}: ${off.toFixed(1)} km out of the way`); });
      // lunch out of town
      if (/places to eat aren't in the guide yet/.test(said)) gaps.lunch.push(`${tag}: ${said.match(/Have lunch in ([^:]+)/) ? said.match(/Have lunch in ([^:]+)/)[1] : ''}`);
      // tickets
      st.forEach(x => { const sx = (city.sites || []).concat(city.farther || []).find(y => String(y.id) === String(x.id));
        if (sx && (sx.tags || []).includes('book-ahead') && !sx.web) gaps.tickets.push(`${f} (${d.city}): ${sx.name}`); });
    }
  });
}
let total = 0;
for (const k of Object.keys(out)) { total += out[k].length; console.log(`${String(out[k].length).padStart(4)}  ${label[k]}`); if (list) out[k].slice(0, 40).forEach(m => console.log('      ' + m)); }
for (const k of Object.keys(gaps)) { const u = [...new Set(gaps[k])]; console.log(`      data gap: ${label[k]}: ${u.length}`); if (list) u.slice(0, 30).forEach(m => console.log('        ' + m)); }
console.log(`${String(total).padStart(4)}  leaks in ${variants} re-picked days${PD ? ' (with the places files)' : ''}`);
process.exit(total ? 1 : 0);
