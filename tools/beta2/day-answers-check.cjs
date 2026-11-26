// Day rules (R-36, R-21, R-01, R-07), checked on every saved test trip with the places files, each with a planted copy that must fail:
//  R-36 (small hours): arriving in the small hours (before 5 am), the traveler sleeps first. No sight or meal is planned
//    before 5 am; the night at the hotel is a step of the day (odd trips, Nov 25: a 00:15 train planned a city square at
//    1:11 am). Every arrival day of every saved trip is planned again with the arrival moved to 00:15.
//  R-21 (every tick answered on its own day): a ticked sight the day doesn't plan is named on that day, also when it is
//    ticked on another day too (odd trips, Nov 25: two churches ticked on Friday and Sunday were explained only on
//    Sunday). Every land and port day of every saved trip is planned again with every sight of its place ticked, on that
//    day and on the next day in the same place.
// Usage: node tools/beta2/day-answers-check.cjs
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..'), SRC = path.join(ROOT, 'src');
function run(E) {
  const bad = [], t = (c, m) => { if (!c) bad.push(m); };
  const PD = path.join(ROOT, 'tools', 'places', 'data'), places = {};
  for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; }
  const dir = path.join(ROOT, 'tools', 'beta2', 'corpus'); let nights = 0, ticks = 0, boards = 0;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    const trip = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    // Small hours.
    trip.days.forEach((d, i) => { if (d.type !== 'arrival' || d.timeGuess) return;
      const b = JSON.parse(JSON.stringify(trip)); b.days[i].time = '00:15'; let p;
      try { p = E.planTrip(E.applyPlaces(b, places))[i]; } catch (e) { t(false, `${f} day ${i + 1}: does not plan with a 00:15 arrival (${e.message})`); return; }
      if (!p || !p.items) return; nights++;
      const early = p.items.filter(x => (x.t === 'stop' || x.t === 'meal') && isFinite(x.at) && x.at % 1440 < 5 * 60);
      t(!early.length, `${f} day ${i + 1}: arriving at 00:15, ${early.map(x => x.name + ' at ' + E.clock(x.at)).join(', ')} planned in the small hours`);
      t(!p.items.some(x => x.t === 'stop') || p.items.some(x => x.t === 'fixed' && /rest/i.test(x.name || '')), `${f} day ${i + 1}: arriving at 00:15, the night at the hotel isn't a step of the day`); });
    // Every tick answered.
    trip.days.forEach((d, i) => { if (!/land|port/.test(d.type)) return; const c = trip.cities[d.city]; if (!c) return;
      const ids = [].concat(c.sites || [], c.farther || []).map(x => String(x.id)); if (!ids.length) return;
      const j = trip.days.findIndex((e, k) => k > i && e.city === d.city && /land|port/.test(e.type));
      const b = JSON.parse(JSON.stringify(trip)); [i, j].filter(k => k >= 0).forEach(k => { b.days[k].selected = ids.slice(); b.days[k].wantsOnly = true; b.days[k].own = true; });
      let ps, ab; try { ab = E.applyPlaces(b, places); ps = E.planTrip(ab); } catch (e) { t(false, `${f} day ${i + 1}: does not plan with every sight ticked (${e.message})`); return; }
      const p = ps[i]; if (!p || !p.items || p.safe) return; ticks++;
      const all = [].concat(ab.cities[d.city].sites || [], ab.cities[d.city].farther || []), said = (p.explain || []).join(' ').toLowerCase();
      const here = new Set(); p.items.forEach(x => { if (x.t === 'stop') { here.add(String(x.id)); (x.includesIds || []).forEach(y => here.add(String(y))); } });
      (p.dropped || []).concat(p.folded || []).forEach(x => here.add(String(x && x.id != null ? x.id : x)));
      const quiet = ids.filter(id => !here.has(id)).map(id => all.find(y => String(y.id) === id)).filter(s => s && s.name && !said.includes(String(s.name).toLowerCase()));
      t(!quiet.length, `${f} day ${i + 1}: every sight ticked (here${j >= 0 ? ' and on day ' + (j + 1) : ''}): ${quiet.slice(0, 3).map(s => s.name).join(', ')}${quiet.length > 3 ? ' and ' + (quiet.length - 3) + ' more' : ''} not planned and not said`); });
    // A missing boarding time is never read as midnight (isFinite(null) is true in JavaScript: an embark day with no
    // boarding time took the ship as the next night's and planned past all aboard; odd trips seed 7, Nov 25).
    trip.days.forEach((d, i) => { if (d.type !== 'embark' || !Number.isFinite(d.allAboard) || d.allAboard < 6 * 60) return;
      const b = JSON.parse(JSON.stringify(trip)); b.days[i].boardAt = null; const P = d.point && Number.isFinite(+d.point.lat) ? d.point : null; if (!P) return;
      const late = d.allAboard - 30; b.days[i].thru = { mode: 'flight', time: String(Math.floor(late / 60)).padStart(2, '0') + ':' + String(late % 60).padStart(2, '0'), point: { name: 'International airport', lat: +P.lat + 0.05, lng: +P.lng } }; let p; try { p = E.planTrip(E.applyPlaces(b, places))[i]; } catch (e) { return; } // a flight landing 30 min before all aboard: the ship can't be made
      if (!p) return; boards++;
      t(!p.items || !(p.endBy > 24 * 60), `${f} day ${i + 1}: with no boarding time and a flight landing 30 min before all aboard (${E.clock(d.allAboard)}), the ship is taken as the next night's (the day ends ${E.clock(p.endBy)} +1 day) instead of saying it can't be made`); });
  }
  // A cruise pier is never an air or cargo terminal (the map search for a port gave an air cargo terminal by the airport).
  for (const n of ['Terminal de Carga Aérea', 'Air Cargo Terminal', 'Container Terminal', 'Aeroporto João Paulo II']) t(!E.cruiseOk({ name: n }), `"${n}" is taken for a cruise pier`);
  for (const n of ['Portas do Mar', 'Prince George Wharf', 'Terminal Marítimo', 'Cruise and Container Terminal']) t(E.cruiseOk({ name: n }), `"${n}" is kept out of cruise piers`);
  t(nights >= 3, `too few arrival days planned to check the small hours (${nights})`); t(ticks >= 10, `too few days planned to check every tick (${ticks})`);
  t(boards >= 3, `too few embark days planned to check a missing boarding time (${boards})`);
  return { bad, nights, ticks, boards };
}
const real = run(require('./engine.cjs'));
for (const m of real.bad) console.log('FAIL ' + m);
const PLANTS = [
  ['a small-hours arrival goes sightseeing at once', '30-window.js', 'if (E.fin(arrive) && arrive < E.NIGHT_DEP && morning - at > 30)', 'if (false)'],
  ['a missing boarding time read as midnight', '30-window.js', 'const depAt = ship ? (Number.isFinite(d.boardAt) ? d.boardAt : d.allAboard)', 'const depAt = ship ? (isFinite(d.boardAt) ? +d.boardAt : d.allAboard)'],
  ['an air cargo terminal taken for a cruise pier', '30-window.js', 'const NOT_SHIP = /\\b(cargo|carga|freight|container|air ?port|aeroporto|aeropuerto|a[eé]roport|a[eé]rea|aerial)\\b/i;', 'const NOT_SHIP = /^$/;'],
  ['a tick taken by another day left unsaid', '95-plan.js', 'out.forEach((p, i) => { if (!p || !p.items || p.safe || !days[i]) return; const d = days[i], c = guides[d.city]', 'out.forEach((p, i) => { if (true) return; const d = days[i], c = guides[d.city]'],
];
let blind = 0;
for (const [name, file, want, to] of PLANTS) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'day-answers-plant-')); fs.cpSync(SRC, tmp, { recursive: true });
  const f = path.join(tmp, 'engine', file), s = fs.readFileSync(f, 'utf8');
  if (!s.includes(want)) { console.log(`FAIL the planted copy "${name}" could not be made: the engine text it changes is gone`); process.exit(1); }
  fs.writeFileSync(f, s.replace(want, to));
  const out = cp.spawnSync(process.execPath, ['-e', `const E=require(${JSON.stringify(path.join(__dirname, 'engine.cjs'))});const fs=require('fs'),os=require('os'),path=require('path'),ROOT=${JSON.stringify(ROOT)};process.stdout.write(JSON.stringify((${run.toString()})(E).bad))`], { env: Object.assign({}, process.env, { ENGINE_SRC: tmp }), encoding: 'utf8', maxBuffer: 1 << 26 });
  let planted = null; try { planted = JSON.parse(out.stdout); } catch (e) { console.log('FAIL planted run broke: ' + (out.stderr || '').slice(0, 300)); process.exit(1); }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`planted (${name}): ${planted.length} finding(s)${planted.length ? '' : ' - BLIND'}`); if (!planted.length) blind++;
}
console.log(`day-answers-check: ${real.nights} small-hours arrivals, ${real.ticks} days with every sight ticked, ${real.boards} boarding days with no boarding time; ${real.bad.length ? real.bad.length + ' failed' : 'all passed'}${blind ? ', but ' + blind + ' planted copies went unseen' : `; planted ${PLANTS.length} of ${PLANTS.length} caught`}`);
process.exit(real.bad.length || blind ? 1 : 0);
