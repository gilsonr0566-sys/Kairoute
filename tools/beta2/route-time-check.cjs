// R-33: a walk or taxi whose real route is known is never planned on the straight-line guess. Made-up rides only (no
// internet): a walk whose street route goes round the water, a taxi over a mountain road, and the floor (a route
// shorter than the guess never shortens it), and hills (E48): a walk's time adds 1 min for every 10 m it climbs and
// 1 min for every 30 m of a steep way down, says so on the ride, and a big climb is not walked when a ride is quicker;
// a walk with no known climb never gets a guessed one. Then copies of the engine are planted on every run (real routes
// ignored; the climb ignored; the steep way down ignored; the hill left out of the walk-or-ride choice), and this check
// must fail on each (a check that can't fail proves nothing).
// Usage: node tools/beta2/route-time-check.cjs
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const SRC = path.join(__dirname, '..', '..', 'src');
function run(E) {
  const bad = []; const t = (c, m) => { if (!c) bad.push(m); };
  const a = { name: 'Pier', lat: 25.078, lng: -77.343 }, isl = { name: 'Island beach', lat: 25.083, lng: -77.33 };   // 1.4 km straight
  const routes = (p, q) => (p === a && q === isl) || (p === isl && q === a) ? { foot: { km: 4.1 }, car: { km: 5.2, min: 12 } } : null;
  const plain = E.makeTravel({ walk: 'medium' }, {}, null, null, null, null).estimate(a, isl);
  const real = E.makeTravel({ walk: 'medium' }, {}, null, null, null, null, routes).estimate(a, isl);
  const walkOf = r => (r.opts || []).find(o => o.kind === 'walk');
  t(plain.min < 30, `the made-up walk is short on the guess (${plain.min} min)`);
  t(real.kind === 'taxi' ? real.min >= 23 : real.min >= 54, `a walk whose street route is 4.1 km round the water is never planned on the guess: by car on the road route (12 min + traffic and start-up), or 55 min on foot (got ${real.how} ${real.min} min)`);
  t(real.kind !== 'walk', `a 55 min way round on foot is not taken when a taxi is far quicker (got ${real.how} ${real.min} min)`);
  const snap = (p, q) => (p === a && q === isl) || (p === isl && q === a) ? { foot: { km: 2075 }, car: { km: 2075, min: 1500 } } : null, sn = E.makeTravel({ walk: 'medium' }, {}, null, null, null, null, snap).estimate(a, isl);
  t(sn.min === plain.min, `a router answer far beyond any road (2,075 km for 1.4 km) is a wrong snap and is left out (got ${sn.min}, guess ${plain.min})`);
  t(!walkOf(real) || walkOf(real).min >= 54, `the walk offered is the street route's 4.1 km at 4.5 km/h, 55 min (got ${walkOf(real) && walkOf(real).min})`);
  const b = { name: 'Port', lat: 42.424, lng: 18.769 }, c = { name: 'Mountain village', lat: 42.433, lng: 18.912 };  // 11.8 km straight
  const mr = (p, q) => (p === b && q === c) || (p === c && q === b) ? { car: { km: 25.5, min: 38 } } : null;
  const g = E.makeTravel({}, {}, null, null, null, null).estimate(b, c), m = E.makeTravel({}, {}, null, null, null, null, mr).estimate(b, c);
  const taxi = r => (r.opts || []).find(o => o.kind === 'taxi') || r;
  t(taxi(m).min >= 38 * 1.15 + 10 - 1, `a taxi over a mountain road (router 25.5 km, 38 min) is planned with traffic and start-up, about 54 min (got ${taxi(m).min}; guess ${taxi(g).min})`);
  t(taxi(m).source === 'roads', `that taxi time says it comes from the road map, not an estimate (got ${taxi(m).source})`);
  const fl = (p, q) => (p === b && q === c) || (p === c && q === b) ? { car: { km: 12, min: 5 } } : null, f = E.makeTravel({}, {}, null, null, null, null, fl).estimate(b, c);
  t(taxi(f).min >= taxi(g).min, `a route shorter than the guess never shortens the ride (got ${taxi(f).min}, guess ${taxi(g).min})`);
  // Plans kept from before a street route arrived are made again with it (live check, Nov 25, Kotor: the app held the
  // 48 min road up the mountain, and the plan kept the 31 min guess). The same saved trip is planned with no route known,
  // then again once routes are known for its long rides: no taxi on a known route may keep the guess.
  const trip = require('./corpus/g09-kotor.json'), long = (p, q) => E.hav(p, q) > 3;
  const rides = ps => [].concat(...ps.filter(Boolean).map(p => (p.items || []).filter(x => x.t === 'ride' && x.kind === 'taxi' && x.from && x.to && long(x.from, x.to))));
  const b1 = JSON.parse(JSON.stringify(trip)); b1.routes = () => null; const first = rides(E.planTrip(b1));
  t(first.some(x => x.min < 79), `the saved Kotor trip has a long taxi on the guess before any route is known (got ${first.map(x => x.min).join(', ') || 'none'})`);
  const b2 = JSON.parse(JSON.stringify(trip)); b2.routes = (p, q) => long(p, q) ? { car: { km: E.hav(p, q) * 6.4, min: 60 } } : null; b2.routes.known = () => [];
  const then = rides(E.planTrip(b2)).filter(x => x.min < 79);
  t(!then.length, `once the street routes arrive (60 min by road), the plans are made again with them, never kept on the guess (got ${then.map(x => x.min + ' min').join(', ')})`);
  // Hills (R-33, E48). A cliff town: 0.61 km straight, the path 0.9 km, 120 m up.
  const lo = { name: 'Low town', lat: 36.4195, lng: 25.427 }, hi = { name: 'High town', lat: 36.425, lng: 25.427 }, near = { name: 'Terrace', lat: 36.4227, lng: 25.427 }, far = { name: 'Hill fort', lat: 36.4317, lng: 25.427 };
  const one = (rt, to, w) => E.makeTravel({ walk: w || 'medium' }, {}, null, null, null, null, () => rt).estimate(lo, to || hi), wk = r => r.kind === 'walk' ? r : (r.options || []).find(o => o.kind === 'walk');
  const up = one({ foot: { km: 0.9, up: 120, down: 0 } }), flat = one({ foot: { km: 0.9, up: null, down: null } });
  t(flat.kind === 'walk' && flat.min === 12 && !(flat.steps || []).length, `a 0.9 km walk with no known climb is 12 min at 4.5 km/h and says nothing of a hill: never a guessed climb (got ${flat.how} ${flat.min} min, ${JSON.stringify(flat.steps)})`);
  t(wk(up) && wk(up).min === 24, `a 0.9 km walk that climbs 120 m is 12 min + 12 min for the climb (1 min per 10 m), 24 min (got ${wk(up) && wk(up).min})`);
  t(wk(up) && /Uphill: about 120 m of climb, 12 min more/.test((wk(up).steps || []).join(' ')), `the walk says its climb (got ${JSON.stringify(wk(up) && wk(up).steps)})`);
  const slow = one({ foot: { km: 0.9, up: 120, down: 0 } }, hi, 'low');
  t(!wk(slow) || wk(slow).min === 30, `a slow walker (3.6 km/h) takes 15 min for 0.9 km and 15 min for the 120 m climb, 30 min (got ${wk(slow) && wk(slow).min})`);
  const dn = one({ foot: { km: 0.5, up: 0, down: 160 } }, near), gentle = one({ foot: { km: 2.4, up: 0, down: 100 } }, { name: 'Shore', lat: 36.4357, lng: 25.427 });
  t(wk(dn) && wk(dn).min === 11, `a steep way down (160 m in 0.5 km) is 7 min + 4 min (1 min per 30 m beyond an 8% slope), 11 min (got ${wk(dn) && wk(dn).min})`);
  t(!wk(gentle) || wk(gentle).min === 32, `a gentle way down (100 m in 2.4 km) costs nothing extra: 32 min (got ${wk(gentle) && wk(gentle).min})`);
  const big = one({ foot: { km: 1.6, up: 250, down: 0 }, car: { km: 3, min: 8 } }, far), same = one({ foot: { km: 1.6 }, car: { km: 3, min: 8 } }, far);
  t(same.kind === 'walk' && big.kind !== 'walk', `a 1.6 km walk is walked on the flat, and not when it climbs 250 m (46 min) with a ride at hand (flat: ${same.how} ${same.min} min; hill: ${big.how} ${big.min} min)`);
  // A walk timed from a neighbour's route (R-33 near-route) keeps that route's climb, the right way round (E48).
  const lo2 = { name: 'Low gate', lat: 36.4199, lng: 25.4272 }, hi2 = { name: 'High gate', lat: 36.4252, lng: 25.4271 };
  const kn = () => null; kn.known = () => [{ a: lo, b: hi, foot: { km: 0.9, up: 120, down: 0 }, car: null }];
  const nUp = E.makeTravel({ walk: 'medium' }, {}, null, null, null, null, kn).estimate(lo2, hi2), nDn = E.makeTravel({ walk: 'medium' }, {}, null, null, null, null, kn).estimate(hi2, lo2);
  t(wk(nUp) && wk(nUp).min >= 22, `a walk next to one known to climb 120 m keeps the climb (about 24 min; got ${wk(nUp) && wk(nUp).min})`);
  t(wk(nDn) && wk(nUp) && wk(nDn).min < wk(nUp).min, `the same walk the other way goes down, not up (got ${wk(nDn) && wk(nDn).min} down, ${wk(nUp) && wk(nUp).min} up)`);
  return bad;
}
const real = run(require('./engine.cjs'));
for (const m of real) console.log('FAIL ' + m);
// Planted, one at a time: each must be seen.
const PLANTS = [
  ['real routes ignored', '10-travel.js', 'let rt = !pinned && typeof routes === "function" ? routes(a, b) || null : null;', 'let rt = null;'],
  ['plans kept although a street route arrived', '95-plan.js', ' && routesSame(got)) {', ') {'],
  ['a climb dropped on a walk timed from it', '10-travel.js', 'foot: x.foot ? { km: x.foot.km + add, up: x.foot.up, down: x.foot.down } : null', 'foot: x.foot ? { km: x.foot.km + add } : null'],
  ['the climb ignored', '10-travel.js', 'const u = isFinite(up) && up > 0 ? up : 0,', 'const u = 0,'],
  ['the steep way down ignored', '10-travel.js', 'Math.max(0, down - 80 * (km > 0 ? km : 0)) : 0; return', '0 : 0; return'],
  ['the hill left out of the walk-or-ride choice', '10-travel.js', 'Math.max(d, (rFoot.km + hill * speed / 60) / 1.3)', 'Math.max(d, rFoot.km / 1.3)'],
  ['a climb guessed where none is known (every walk 100 m up)', '10-travel.js', 'const hill = rFoot ? E.climbMin(rFoot.up, rFoot.down, rFoot.km, speed) : 0;', 'const hill = rFoot ? E.climbMin(isFinite(rFoot.up) && rFoot.up != null ? rFoot.up : 100, rFoot.down, rFoot.km, speed) : 0;'],
];
let blind = 0;
for (const [name, file, want, to] of PLANTS) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'route-plant-')); fs.cpSync(SRC, tmp, { recursive: true });
  const f = path.join(tmp, 'engine', file), s = fs.readFileSync(f, 'utf8');
  if (!s.includes(want)) { console.log(`FAIL the planted copy "${name}" could not be made: the engine text it changes is gone`); process.exit(1); }
  fs.writeFileSync(f, s.replace(want, to));
  const out = cp.spawnSync(process.execPath, ['-e', `const E=require(${JSON.stringify(path.join(__dirname, 'engine.cjs'))});process.stdout.write(JSON.stringify((${run.toString()})(E)))`], { cwd: __dirname, env: Object.assign({}, process.env, { ENGINE_SRC: tmp }), encoding: 'utf8' });
  let planted = []; try { planted = JSON.parse(out.stdout); } catch (e) { console.log('FAIL planted run broke: ' + (out.stderr || '').slice(0, 300)); process.exit(1); }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`planted (${name}): ${planted.length} finding(s)${planted.length ? '' : ' - BLIND'}`); if (!planted.length) blind++;
}
console.log(`route-time-check: ${real.length ? real.length + ' failed' : 'all passed'}${blind ? ', but ' + blind + ' planted copies went unseen' : `; planted ${PLANTS.length} of ${PLANTS.length} caught`}`);
process.exit(real.length || blind ? 1 : 0);
