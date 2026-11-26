// R-33 / R-12 in the release gate: every ride on every saved test trip's plan is compared, offline, with the real-world
// least times the nightly real-world check measured (BRouter for walks and taxis, the operators' own timetable files
// for trains, metro, buses and ferries; tools/truth/real-world-cache.json, kept by tools/truth/real-world.mjs --cache). Second fault audit (Nov 24):
// ride-time bugs gave plausible rides that every check in the gate compared only with the app itself; the real-world
// check would see them, but only the night after a release. A ride planned faster than the real world allows (5 min or
// more under it, and 25% or more) fails; on the ride back on a ship, train or flight day it is S1.
// Then a copy of the engine with the street routes ignored and taxis without start-up time is planted on every run, and
// this check must fail on it.
// Usage: node tools/truth/real-world-gate.cjs [--min 40]   (at least --min rides must find a measured time)
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..'), SRC = path.join(ROOT, 'src');
const MIN = +((process.argv.indexOf('--min') > 0 && process.argv[process.argv.indexOf('--min') + 1]) || 40);
const kindOf = x => { const k = String(x.kind || x.mode || '').toLowerCase(); return x.mode === 'lift' || /^(cable car|funicular|lift)\b/i.test(x.how || '') ? 'lift' : /walk/.test(k) ? 'walk' : /taxi|car|drive/.test(k) ? 'taxi' : /ferry|boat|tender|water/.test(k) ? 'ferry' : /train|rail/.test(k) ? 'train' : /metro|subway|tram|light/.test(k) ? 'metro' : /bus/.test(k) ? 'bus' : /lift|cable|funic/.test(k) ? 'lift' : k || 'other'; };
const ck = (kind, a, b) => `${kind}|${(+a.lat).toFixed(4)},${(+a.lng).toFixed(4)}|${(+b.lat).toFixed(4)},${(+b.lng).toFixed(4)}`;

function compare(engineFile) {
  const E = require(engineFile), PD = path.join(ROOT, 'tools', 'places', 'data'), places = {};
  for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; }
  const cache = new Map((JSON.parse(fs.readFileSync(path.join(__dirname, 'real-world-cache.json'), 'utf8')).rides || []).map(r => [ck(r.kind, r.from, r.to), r]));
  const route = new Map([...cache.values()].map(r => [`${r.kind}|${(+r.from.lat).toFixed(4)},${(+r.from.lng).toFixed(4)}|${(+r.to.lat).toFixed(4)},${(+r.to.lng).toFixed(4)}`, r]));
  const dir = process.env.SNAP_DIR || path.join(ROOT, 'tools', 'beta2', 'corpus'), out = { compared: 0, bad: [], kinds: {}, backUnchecked: [] }, seen = new Set();
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    const name = f.replace(/\.json$/, ''), b = JSON.parse(fs.readFileSync(path.join(dir, f))); let plans;
    // The street routes the app asks the helper for (R-33), here the measured ones: the plan is the one a traveler sees.
    const bb = E.applyPlaces(b, places), pt = p => (+p.lat).toFixed(4) + ',' + (+p.lng).toFixed(4);
    bb.routes = (a, z) => { if (!a || !z || !isFinite(a.lat) || !isFinite(z.lat)) return null; const f = route.get('walk|' + pt(a) + '|' + pt(z)) || route.get('walk|' + pt(z) + '|' + pt(a)), c = route.get('taxi|' + pt(a) + '|' + pt(z)) || route.get('taxi|' + pt(z) + '|' + pt(a));
      return f || c ? Object.assign({}, f && f.realKm ? { foot: { km: f.realKm, up: f.up } } : {}, c && c.realKm ? { car: { km: c.realKm, min: c.real } } : {}) : null; };
    // All the measured routes, as the app hands the engine every route it knows (a ride near a timed one is timed from it).
    bb.routes.known = () => [...route.values()].filter(r => r.realKm && /walk|taxi/.test(r.kind)).map(r => ({ a: r.from, b: r.to, car: r.kind === 'taxi' ? { km: r.realKm, min: r.real } : null, foot: r.kind === 'walk' ? { km: r.realKm, up: r.up } : null }));
    try { plans = E.planTrip(bb); } catch (e) { out.bad.push(`${name}: does not plan (${e.message})`); continue; }
    b.days.forEach((d, i) => { const p = plans[i]; if (!p || !p.items) return; const its = p.items, lastRide = its.map(x => x.t).lastIndexOf('ride'), hard = /port|departure|embark/.test(d.type);
      its.forEach((x, j) => { if (x.t !== 'ride' || !x.from || !x.to || !(x.min > 0)) return;
        const kind = kindOf(x), k = ck(kind, x.from, x.to), m = cache.get(k);
        const planned = /train|metro|bus|ferry/.test(kind) ? x.min + (x.wait || 0) : x.min, back = hard && j === lastRide, id = k + '|' + planned;
        if (seen.has(id)) return; seen.add(id);
        // Tallies for the readiness score (tools/truth/readiness-score.cjs): every different ride on the plans, by kind,
        // how many have a real-world time, how many of those are right, and rides back with no real-world time.
        const t = out.kinds[kind] = out.kinds[kind] || { rides: 0, compared: 0, right: 0 }; t.rides++;
        if (!m) { if (back) out.backUnchecked.push(`${name} day ${i + 1} ${d.city || ''}: ${kind} ride back`); return; }
        out.compared++; t.compared++;
        if (!(m.real - planned >= 5 && planned < m.real * 0.75) && !(!back && planned > m.real * 2.5 && planned - m.real > 15)) t.right++;
        if (m.real - planned >= 5 && planned < m.real * 0.75) out.bad.push(`${back ? 'S1 ' : ''}${name} day ${i + 1} ${d.city || ''}: ${kind} ${(its[j - 1] && its[j - 1].name) || '?'} > ${(its[j + 1] && its[j + 1].name) || '?'} planned ${planned} min, real least ${m.real} min (${m.src}, measured ${m.measured})${back ? ' RIDE BACK' : ''}`); }); });
  }
  return out;
}

if (require.main === module) {
  const real = compare(path.join(ROOT, 'tools', 'beta2', 'engine.cjs'));
  real.bad.slice(0, 30).forEach(m => console.log('FAIL ' + m));
  const few = real.compared < MIN; if (few) console.log(`FAIL only ${real.compared} rides found a real-world time (at least ${MIN} needed): the measured times are out of date; run the real-world check with --cache`);
  // Planted: street routes ignored and taxis without the start-up minutes, the kind of change no self-agreeing check sees.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rw-plant-')); fs.cpSync(SRC, tmp, { recursive: true });
  const f = path.join(tmp, 'engine', '10-travel.js'); let s = fs.readFileSync(f, 'utf8');
  const P = [['let rt = !pinned && typeof routes === "function" ? routes(a, b) || null : null;', 'let rt = null;'], ['if (!pinned && !rt && knownNear())', 'if (false)'], ['add = 10 + 5 * Math.min(1, d / 40)', 'add = 0']];
  for (const [a, b] of P) { if (!s.includes(a)) { console.log('FAIL the planted copy could not be made: the engine text it changes is gone'); process.exit(1); } s = s.replace(a, b); }
  fs.writeFileSync(f, s);
  const o = cp.spawnSync(process.execPath, ['-e', `process.stdout.write(JSON.stringify(require(${JSON.stringify(__filename)}).compare(${JSON.stringify(path.join(ROOT, 'tools', 'beta2', 'engine.cjs'))})))`], { env: Object.assign({}, process.env, { ENGINE_SRC: tmp }), encoding: 'utf8', maxBuffer: 1 << 26 });
  fs.rmSync(tmp, { recursive: true, force: true });
  let pl = null; try { pl = JSON.parse(o.stdout); } catch (e) { console.log('FAIL planted run broke: ' + (o.stderr || '').slice(0, 300)); process.exit(1); }
  console.log(`planted (street routes ignored, taxis without start-up time): ${pl.bad.length ? pl.bad.length + ' rides too fast, caught' : 'NOT caught - BLIND'}`);
  const s1 = real.bad.filter(m => /^S1 /.test(m)).length;
  console.log(`real-world-gate: ${real.compared} rides compared with real-world times; ${real.bad.length} planned too fast (${s1} on the ride back)`);
  process.exit(real.bad.length || few || !pl.bad.length ? 1 : 0);
}
module.exports = { compare };
