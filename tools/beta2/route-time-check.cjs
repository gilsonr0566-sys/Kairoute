// R-33: a walk or taxi whose real route is known is never planned on the straight-line guess. Made-up rides only (no
// internet): a walk whose street route goes round the water, a taxi over a mountain road, and the floor (a route
// shorter than the guess never shortens it). Then a copy of the engine with real routes ignored is planted on every run,
// and this check must fail on it (a check that can't fail proves nothing).
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
  return bad;
}
const real = run(require('./engine.cjs'));
for (const m of real) console.log('FAIL ' + m);
// Planted: the engine with real routes ignored.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'route-plant-')); fs.cpSync(SRC, tmp, { recursive: true });
const f = path.join(tmp, 'engine', '10-travel.js'), s = fs.readFileSync(f, 'utf8'), want = 'const rt = !pinned && typeof routes === "function" ? routes(a, b) || null : null;';
if (!s.includes(want)) { console.log('FAIL the planted copy could not be made: the engine text it changes is gone'); process.exit(1); }
fs.writeFileSync(f, s.replace(want, 'const rt = null;'));
const out = cp.spawnSync(process.execPath, ['-e', `const E=require(${JSON.stringify(path.join(__dirname, 'engine.cjs'))});process.stdout.write(JSON.stringify((${run.toString()})(E)))`], { env: Object.assign({}, process.env, { ENGINE_SRC: tmp }), encoding: 'utf8' });
let planted = []; try { planted = JSON.parse(out.stdout); } catch (e) { console.log('FAIL planted run broke: ' + (out.stderr || '').slice(0, 300)); process.exit(1); }
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`planted (real routes ignored): ${planted.length} finding(s)${planted.length ? '' : ' - BLIND'}`);
console.log(`route-time-check: ${real.length ? real.length + ' failed' : 'all passed'}${planted.length ? '' : ', but the planted copy went unseen'}`);
process.exit(real.length || !planted.length ? 1 : 0);
