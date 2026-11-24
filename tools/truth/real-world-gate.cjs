// R-33 / R-12 in the release gate: every ride on every saved test trip's plan is compared, offline, with the real-world
// least times the nightly real-world check measured (BRouter for walks and taxis, the DB journey planner for trains, metro
// and buses; tools/truth/real-world-cache.json, kept by tools/truth/real-world.mjs --cache). Second fault audit (Nov 24):
// ride-time bugs gave plausible rides that every check in the gate compared only with the app itself; the real-world
// check would see them, but only the night after a release. A ride planned faster than the real world allows (5 min or
// more under it, and 25% or more) fails; on the ride back on a ship, train or flight day it is S1.
// Then a copy of the engine with taxis and walks made quicker is planted on every run, and this check must fail on it.
// Usage: node tools/truth/real-world-gate.cjs [--min 40]   (at least --min rides must find a measured time)
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..'), SRC = path.join(ROOT, 'src');
const MIN = +((process.argv.indexOf('--min') > 0 && process.argv[process.argv.indexOf('--min') + 1]) || 40);
const kindOf = x => { const k = String(x.kind || x.mode || '').toLowerCase(); return /walk/.test(k) ? 'walk' : /taxi|car|drive/.test(k) ? 'taxi' : /ferry|boat|tender|water/.test(k) ? 'ferry' : /train|rail/.test(k) ? 'train' : /metro|subway|tram|light/.test(k) ? 'metro' : /bus/.test(k) ? 'bus' : /lift|cable|funic/.test(k) ? 'lift' : k || 'other'; };
const ck = (kind, a, b) => `${kind}|${(+a.lat).toFixed(4)},${(+a.lng).toFixed(4)}|${(+b.lat).toFixed(4)},${(+b.lng).toFixed(4)}`;

function compare(engineFile) {
  const E = require(engineFile), PD = path.join(ROOT, 'tools', 'places', 'data'), places = {};
  for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; }
  const cache = new Map((JSON.parse(fs.readFileSync(path.join(__dirname, 'real-world-cache.json'), 'utf8')).rides || []).map(r => [ck(r.kind, r.from, r.to), r]));
  const dir = process.env.SNAP_DIR || path.join(ROOT, 'tools', 'beta2', 'corpus'), out = { compared: 0, bad: [] }, seen = new Set();
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    const name = f.replace(/\.json$/, ''), b = JSON.parse(fs.readFileSync(path.join(dir, f))); let plans;
    try { plans = E.planTrip(E.applyPlaces(b, places)); } catch (e) { out.bad.push(`${name}: does not plan (${e.message})`); continue; }
    b.days.forEach((d, i) => { const p = plans[i]; if (!p || !p.items) return; const its = p.items, lastRide = its.map(x => x.t).lastIndexOf('ride'), hard = /port|departure|embark/.test(d.type);
      its.forEach((x, j) => { if (x.t !== 'ride' || !x.from || !x.to || !(x.min > 0)) return;
        const kind = kindOf(x), k = ck(kind, x.from, x.to), m = cache.get(k); if (!m) return;
        const planned = /train|metro|bus/.test(kind) ? x.min + (x.wait || 0) : x.min, back = hard && j === lastRide, id = k + '|' + planned;
        if (seen.has(id)) return; seen.add(id); out.compared++;
        if (m.real - planned >= 5 && planned < m.real * 0.75) out.bad.push(`${back ? 'S1 ' : ''}${name} day ${i + 1} ${d.city || ''}: ${kind} ${(its[j - 1] && its[j - 1].name) || '?'} > ${(its[j + 1] && its[j + 1].name) || '?'} planned ${planned} min, real least ${m.real} min (${m.src}, measured ${m.measured})${back ? ' RIDE BACK' : ''}`); }); });
  }
  return out;
}

if (require.main === module) {
  const real = compare(path.join(ROOT, 'tools', 'beta2', 'engine.cjs'));
  real.bad.slice(0, 30).forEach(m => console.log('FAIL ' + m));
  const few = real.compared < MIN; if (few) console.log(`FAIL only ${real.compared} rides found a real-world time (at least ${MIN} needed): the measured times are out of date; run the real-world check with --cache`);
  // Planted: taxis without the start-up minutes and walks at 6 km/h, the kind of change no self-agreeing check sees.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rw-plant-')); fs.cpSync(SRC, tmp, { recursive: true });
  const f = path.join(tmp, 'engine', '10-travel.js'); let s = fs.readFileSync(f, 'utf8');
  const P = [['add = 10 + 5 * Math.min(1, d / 40)', 'add = 0'], ['speed = walk === "low" ? 3.6 : 4.5', 'speed = walk === "low" ? 6 : 6']];
  for (const [a, b] of P) { if (!s.includes(a)) { console.log('FAIL the planted copy could not be made: the engine text it changes is gone'); process.exit(1); } s = s.replace(a, b); }
  fs.writeFileSync(f, s);
  const o = cp.spawnSync(process.execPath, ['-e', `process.stdout.write(JSON.stringify(require(${JSON.stringify(__filename)}).compare(${JSON.stringify(path.join(ROOT, 'tools', 'beta2', 'engine.cjs'))})))`], { env: Object.assign({}, process.env, { ENGINE_SRC: tmp }), encoding: 'utf8', maxBuffer: 1 << 26 });
  fs.rmSync(tmp, { recursive: true, force: true });
  let pl = null; try { pl = JSON.parse(o.stdout); } catch (e) { console.log('FAIL planted run broke: ' + (o.stderr || '').slice(0, 300)); process.exit(1); }
  console.log(`planted (taxis without start-up time, walks at 6 km/h): ${pl.bad.length ? pl.bad.length + ' rides too fast, caught' : 'NOT caught - BLIND'}`);
  const s1 = real.bad.filter(m => /^S1 /.test(m)).length;
  console.log(`real-world-gate: ${real.compared} rides compared with real-world times; ${real.bad.length} planned too fast (${s1} on the ride back)`);
  process.exit(real.bad.length || few || !pl.bad.length ? 1 : 0);
}
module.exports = { compare };
