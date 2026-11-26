// Real-world check: are the ride times the app shows TRUE, measured against sources the app itself never uses?
// (Richard, Nov 24 2026: "Are walk, train, metro, taxi, ferries and alike accurate and giving users an accurate way to
// safely get around ... if you not testing this app to the highest degree, what is the use in the testing.")
//
// Every older ride check either compared the plan with itself (a ride's minutes match its clock) or with the same
// sources the helper reads (OpenStreetMap's foot and car routers, Transitous). If one of those sources is wrong, the app
// and the check are wrong together. This plans every saved test trip and asks, for each ride on the plan:
//   walk   BRouter (brouter.de; a different router from the helper's OSRM and Valhalla), foot profile: the real path
//          length, timed at 4.5 km/h, an ordinary adult pace with no stops
//   taxi   BRouter car profile: the drive time with empty roads (the least any taxi can take)
//   train, metro, tram, bus, ferry   the OPERATORS' OWN PUBLISHED TIMETABLE FILES (open GTFS feeds, found through the
//          Mobility Database catalog and read by tools/truth/gtfs-times.mjs with its own arithmetic; the app never opens
//          a timetable file, it asks the Transitous journey planner and reads lines mapped on OpenStreetMap): the
//          quickest real door-to-door journey leaving in the two hours after the planned time. Until Nov 25 2026 this
//          asked Deutsche Bahn's journey planner (v6.db.transport.rest, db.emmabyte.de, v5): all three stopped answering
//          GitHub's machines, so no train, metro or bus was checked at all. A ferry is compared with timetabled BOATS
//          only; where no operator publishes an open timetable the ferry is NOT CHECKED, never a pass.
//   lift   cable cars, funiculars and lifts have no timetable: NOT CHECKED
// A ride the plan shows FASTER than the real-world least time is "too fast" (planned 5 min or more under it, and 25%
// or more). On the ride back on a ship, train or flight day (any ride after the day's last visit) a too-fast ride is S1:
// following the plan could miss the departure. Too slow (more than double and 15 min over) is S2 (it wastes the day).
//
// Usage: node tools/truth/real-world.mjs --gtfs-catalog <dir of the Mobility Database catalog> [--max 400] [--trips g09-kotor,g02-vienna] [--out file.json] [--cache tools/truth/real-world-cache.json]
// --cache keeps every real-world time measured (merged with the file's earlier ones, newest wins): the release gate compares
// every plan with them offline (tools/truth/real-world-gate.cjs), so a ride-time bug is caught before release, not the night after.
// Needs the internet (run on GitHub: .github/workflows/real-world.yml, nightly). No AI, free public services only, one
// request a second to each. Exit 1 when an S1 is found or nothing could be checked; it never publishes anything.
import fs from 'fs'; import path from 'path'; import { createRequire } from 'module'; import { fileURLToPath } from 'url';
import { loadCatalog, gtfsTimes } from './gtfs-times.mjs';
const require = createRequire(import.meta.url), HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(HERE, '..', '..');
const E = require(path.join(ROOT, 'tools', 'beta2', 'engine.cjs'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const MAX = +arg('max', 400), ONLY = (arg('trips', '') || '').split(',').filter(Boolean), OUT = arg('out', null), CACHE = arg('cache', null), GTFS = arg('gtfs-catalog', process.env.GTFS_CATALOG || null), KINDS = (arg('kinds', '') || '').split(',').filter(Boolean);
const UA = { 'User-Agent': 'kairoute-test (free route check; github.com/gilsonr0566-sys/kairoute)' };
const PD = path.join(ROOT, 'tools', 'places', 'data'), places = {};
if (fs.existsSync(PD)) for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; }
const dir = process.env.SNAP_DIR || path.join(ROOT, 'tools', 'beta2', 'corpus');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hav = (a, b) => { const R = 6371, r = Math.PI / 180, x = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lng - a.lng) * r / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const clk = m => m == null || !isFinite(m) ? '?' : `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
const kindOf = x => { const k = String(x.kind || x.mode || '').toLowerCase(); return x.mode === 'lift' || /^(cable car|funicular|lift)\b/i.test(x.how || '') ? 'lift' : /walk/.test(k) ? 'walk' : /taxi|car|drive/.test(k) ? 'taxi' : /ferry|boat|tender|water/.test(k) ? 'ferry' : /train|rail/.test(k) ? 'train' : /metro|subway|tram|light/.test(k) ? 'metro' : /bus/.test(k) ? 'bus' : /lift|cable|funic/.test(k) ? 'lift' : k || 'other'; };

// ---- 1. Every ride on every saved test trip's plan
const pt = p => (+p.lat).toFixed(4) + ',' + (+p.lng).toFixed(4), known = new Map();
try { for (const r of JSON.parse(fs.readFileSync(CACHE || path.join(ROOT, 'tools', 'truth', 'real-world-cache.json'), 'utf8')).rides || []) known.set(`${r.kind}|${pt(r.from)}|${pt(r.to)}`, r); } catch (e) { }
const rides = [];
// The plan with routes goes first, over every trip, in the gate's own order: the engine keeps what it worked out for a
// trip (its starting picks), so a trip planned once without routes plans again the same way, unlike the gate's.
for (const withRoutes of [true, false]) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  const name = f.replace(/\.json$/, ''); if (ONLY.length && !ONLY.includes(name)) continue;
  const b = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  // Planned twice: with no street routes (the helper out of reach) and with the street routes measured so far, the plan a
  // traveler sees and the one the release gate compares (real-world-gate.cjs). A street route can change a ride (a taxi
  // where the line said walk), and that ride must be measured too, or the gate never finds its time.
  { let plans; const bb = E.applyPlaces(b, places);
  if (withRoutes) { if (!known.size) continue; bb.routes = (a, z) => { if (!a || !z || !isFinite(a.lat) || !isFinite(z.lat)) return null; const f = known.get('walk|' + pt(a) + '|' + pt(z)) || known.get('walk|' + pt(z) + '|' + pt(a)), c = known.get('taxi|' + pt(a) + '|' + pt(z)) || known.get('taxi|' + pt(z) + '|' + pt(a));
    return f || c ? Object.assign({}, f && f.realKm ? { foot: { km: f.realKm } } : {}, c && c.realKm ? { car: { km: c.realKm, min: c.real } } : {}) : null; };
    bb.routes.known = () => [...known.values()].filter(r => r.realKm && /walk|taxi/.test(r.kind)).map(r => ({ a: r.from, b: r.to, car: r.kind === 'taxi' ? { km: r.realKm, min: r.real } : null, foot: r.kind === 'walk' ? { km: r.realKm } : null })); }
  try { plans = E.planTrip(bb); } catch (e) { console.log(`FAIL ${name}: does not plan (${e.message})`); continue; }
  b.days.forEach((d, i) => { const p = plans[i]; if (!p || !p.items) return; const its = p.items;
    // The ride back: the day's last ride on a ship, train or flight day (it ends at the pier, station or airport).
    const lastRide = its.map(x => x.t).lastIndexOf('ride'), hard = /port|departure|embark/.test(d.type);
    its.forEach((x, j) => { if (x.t !== 'ride' || !x.from || !x.to || !(x.min > 0)) return;
      const prev = its[j - 1], at = x.at != null ? x.at : prev && prev.at != null ? prev.at + (prev.min || 0) : null;
      rides.push({ trip: name, day: i + 1, date: d.date, type: d.type, city: d.city, kind: kindOf(x), label: x.how || x.kind || x.mode, min: x.min, wait: x.wait || 0, km: x.km,
        at, from: x.from, to: x.to, back: hard && j === lastRide, straight: hav(x.from, x.to), toName: (its[j + 1] && its[j + 1].name) || '', fromName: (its[j - 1] && its[j - 1].name) || '', routed: withRoutes }); }); }); }
}
// The same two points and kind asked once.
const key = r => `${r.kind}|${r.from.lat.toFixed(4)},${r.from.lng.toFixed(4)}|${r.to.lat.toFixed(4)},${r.to.lng.toFixed(4)}`;
const uniq = new Map(); for (const r of rides) { if (KINDS.length && !KINDS.includes(r.kind)) continue; const k = key(r); if (!uniq.has(k)) uniq.set(k, []); uniq.get(k).push(r); }
// The ride back first (safety), then the rest; cap the number of lookups.
const asks = [...uniq.entries()].sort((a, b) => (b[1].some(r => r.back) - a[1].some(r => r.back)) || (b[1][0].min - a[1][0].min)).slice(0, MAX);

// ---- 2. The independent sources
async function brouter(r, profile) { // the public server asks for patience when busy: wait and ask again, 3 times
  for (let t = 0; ; t++) { try { return await brouter1(r, profile); } catch (e) { if (t >= 3 || !/retry later|fetch failed|watchdog|timeout/i.test(e.message)) throw e; await sleep(8000 * (t + 1)); } } }
// A pier, quay or ship berth is often a short path the router can't join to the streets ("target island detected",
// "no track found"), and those are exactly the rides back to a ship (Nov 25: 27 rides, 10 of them rides back, had no real
// time for this alone). Then the stuck end is moved along the straight line towards the other end, 150 m and then 400 m,
// until the router joins it to a street, and the metres moved are added back (on foot at 4.5 km/h, by car at 20 km/h, a
// port road's pace), so the real time is the router's plus that last bit, never less.
async function brouterNear(r, profile) {
  try { return await brouter(r, profile); } catch (e) { if (!/island|no track found/i.test(e.message)) throw e;
    const mv = (p, q, m) => { const d = hav(p, q) * 1000; if (d < m * 2) return null; const f = m / d; return { lat: p.lat + (q.lat - p.lat) * f, lng: p.lng + (q.lng - p.lng) * f }; };
    for (const m of [150, 400]) for (const ends of /target island/i.test(e.message) ? [['to'], ['from', 'to']] : [['to'], ['from'], ['from', 'to']]) {
      const a = ends.includes('from') ? mv(r.from, r.to, m) : r.from, z = ends.includes('to') ? mv(r.to, r.from, m) : r.to; if (!a || !z) continue;
      await sleep(2500); try { const b = await brouter({ from: a, to: z }, profile); if (b.km > 3 * hav(r.from, r.to) + 2) continue; /* a moved end joined to the wrong shore (Nov 25, Dubrovnik: 16 km for 2.9 km straight): not a measure */ return { km: b.km + ends.length * m / 1000, sec: b.sec + ends.length * m / 1000 / (/car/.test(profile) ? 20 : 4.5) * 3600, moved: ends.length * m }; } catch (e2) { if (!/island|no track found/i.test(e2.message)) throw e2; } }
    throw e; } }
async function brouter1(r, profile) {
  const u = `https://brouter.de/brouter?lonlats=${r.from.lng},${r.from.lat}|${r.to.lng},${r.to.lat}&profile=${profile}&alternativeidx=0&format=geojson`;
  const res = await fetch(u, { headers: UA }); if (!res.ok) throw new Error('brouter ' + res.status + ' ' + (await res.text()).slice(0, 80));
  const j = await res.json(), p = j.features && j.features[0] && j.features[0].properties; if (!p) throw new Error('brouter: no route');
  return { km: +p['track-length'] / 1000, sec: +p['total-time'] };
}
// The timetable kinds, all at once before the street rides: each place's timetable files are read once.
const TT = /^(train|metro|bus|ferry)$/, ttAsks = asks.filter(([, g]) => TT.test(g[0].kind)).map(([, g]) => g[0]);
let tt = new Map();
if (ttAsks.length) { const dir = GTFS && fs.existsSync(path.join(GTFS, 'catalogs', 'sources', 'gtfs', 'schedule')) ? path.join(GTFS, 'catalogs', 'sources', 'gtfs', 'schedule') : GTFS;
  let extra = []; try { extra = JSON.parse(fs.readFileSync(path.join(HERE, 'gtfs-extra-feeds.json'), 'utf8')).feeds || []; } catch (e) { }
  const catalog = loadCatalog(dir, extra); console.log(`Timetable files: ${catalog.length} open feeds in the catalog; ${ttAsks.length} train, metro, bus and ferry rides to look up`);
  if (catalog.length) tt = await gtfsTimes(ttAsks, { catalog, log: m => console.log(m) }); }

// ---- 3. Compare
const rows = [], notChecked = {}; let lastB = 0;
const pace = async (t, gap) => { const w = t + gap - Date.now(); if (w > 0) await sleep(w); return Date.now(); };
for (const [, group] of asks) { const r = group[0], row = { ...r, n: group.length, back: group.some(x => x.back) };
  try {
    if (r.kind === 'walk') { lastB = await pace(lastB, 2500); const b = await brouterNear(r, 'hiking-mountain'); row.realKm = +b.km.toFixed(2); row.real = Math.round(b.km / 4.5 * 60); row.src = 'BRouter foot, 4.5 km/h' + (b.moved ? `, last ${b.moved} m to the street added` : ''); row.planned = r.min; }
    else if (r.kind === 'taxi') { lastB = await pace(lastB, 2500); const b = await brouterNear(r, 'car-fast'); row.realKm = +b.km.toFixed(2); row.real = Math.round(b.sec / 60); row.src = 'BRouter car, empty roads' + (b.moved ? `, last ${b.moved} m to the street added` : ''); row.planned = r.min; }
    else if (TT.test(r.kind)) { const j = tt.get(r); if (!j) throw new Error('timetable files: the catalog of open feeds was not given (--gtfs-catalog)'); if (j.err) { if (r.kind === 'ferry' && /no open feed|no timetabled boat/.test(j.err)) { (notChecked[r.kind] = notChecked[r.kind] || []).push(row); continue; } throw new Error(j.err); }
      row.real = Math.round(j.min); row.src = j.src; row.planned = r.min + r.wait; }
    else { (notChecked[r.kind] = notChecked[r.kind] || []).push(row); continue; }
  } catch (e) { row.err = String(e.message || e).slice(0, 120); (notChecked[r.kind] = notChecked[r.kind] || []).push(row); continue; }
  // A route ten times the straight line (and 20 km more) is the router snapping to the wrong place, not a road: not counted.
  if (row.realKm != null && row.realKm > 10 * r.straight + 20) { row.err = `router found no sensible route (${row.realKm} km for ${r.straight.toFixed(1)} km straight)`; (notChecked[r.kind] = notChecked[r.kind] || []).push(row); continue; }
  const under = row.real - row.planned;
  // Too slow is judged only away from the ride back: the ride back rightly carries the time kept for the ship or train.
  row.verdict = under >= 5 && row.planned < row.real * 0.75 ? 'too fast' : (!row.back && row.planned > row.real * 2.5 && row.planned - row.real > 15 ? 'too slow' : 'ok');
  // A taxi is only ever too fast against empty roads; a walk's 4.5 km/h is already brisk, so neither is held to the minute.
  row.sev = row.verdict === 'too fast' ? (row.back ? 'S1' : 'S2') : row.verdict === 'too slow' ? 'S2' : '';
  rows.push(row);
}

// ---- 4. Report
const kinds = ['walk', 'taxi', 'train', 'metro', 'bus', 'ferry', 'lift', 'other'];
const trips = new Set(rides.map(r => r.trip)), cities = new Set(rides.map(r => r.city).filter(Boolean));
console.log(`Real-world check: ${rides.length} rides on ${trips.size} saved test trips (${cities.size} places), ${uniq.size} different rides, ${asks.length} asked (cap ${MAX})\n`);
console.log('| Kind | Checked | Right (within 25% or 5 min) | Planned too fast | of which the ride back on a ship, train or flight day | Planned far too slow | Not checked (no source, or the source had no answer) |\n|---|---|---|---|---|---|---|');
for (const k of kinds) { const a = rows.filter(r => r.kind === k), nc = (notChecked[k] || []).length; if (!a.length && !nc) continue;
  console.log(`| ${k} | ${a.length} | ${a.filter(r => r.verdict === 'ok').length} | ${a.filter(r => r.verdict === 'too fast').length} | ${a.filter(r => r.sev === 'S1').length} | ${a.filter(r => r.verdict === 'too slow').length} | ${nc} |`); }
const show = (title, list) => { if (!list.length) return; console.log(`\n${title}`); list.slice(0, 25).forEach(r => console.log(`${r.sev === 'S1' ? 'FAIL S1' : r.sev || '  '} ${r.trip} day ${r.day} ${r.type} ${r.city || ''}: ${r.kind} ${r.fromName || '?'} > ${r.toName || '?'} (${r.km != null ? r.km + ' km' : ''}) planned ${r.planned} min at ${clk(r.at)}, real ${r.real} min${r.realKm != null ? ' (' + r.realKm + ' km)' : ''} [${r.src}]${r.back ? ' RIDE BACK' : ''}${r.n > 1 ? ` (on ${r.n} plans)` : ''}`)); };
show('Planned faster than the real world allows:', rows.filter(r => r.verdict === 'too fast').sort((a, b) => (b.sev === 'S1') - (a.sev === 'S1') || (b.real - b.planned) - (a.real - a.planned)));
show('Planned far slower than the real world:', rows.filter(r => r.verdict === 'too slow').sort((a, b) => (b.planned - b.real) - (a.planned - a.real)));
const errs = Object.values(notChecked).flat().filter(r => r.err);
if (errs.length) { console.log(`\nNOT CHECKED, the source gave no answer (${errs.length}):`); const by = {}; errs.forEach(r => { const k = r.err.replace(/\d+/g, '#'); by[k] = (by[k] || 0) + 1; }); Object.entries(by).forEach(([k, n]) => console.log(`  ${n} x ${k}`)); }
const nos = Object.entries(notChecked).map(([k, l]) => [k, l.filter(r => !r.err).length]).filter(([, n]) => n);
if (nos.length) console.log(`NOT CHECKED, no independent source for this kind: ${nos.map(([k, n]) => `${n} ${k}`).join(', ')} (ferries: no operator of these boats publishes an open timetable file; cable cars and lifts have no timetable)`);
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ rows, notChecked }, null, 1));
const s1 = rows.filter(r => r.sev === 'S1').length;
console.log(`\n${rows.length} rides compared with the real world; ${s1} too fast on the ride back (S1); ${rows.filter(r => r.sev === 'S2').length} other gaps (S2)`);
process.exitCode = s1 || !rows.length ? 1 : 0;
if (CACHE) { // the real least time of every ride measured, by kind and its two ends (4 decimals, about 10 m)
  let old = []; try { old = JSON.parse(fs.readFileSync(CACHE, 'utf8')).rides || []; } catch (e) { }
  const ck = r => `${r.kind}|${(+r.from.lat).toFixed(4)},${(+r.from.lng).toFixed(4)}|${(+r.to.lat).toFixed(4)},${(+r.to.lng).toFixed(4)}`, by = new Map(old.map(r => [ck(r), r]));
  const day = new Date().toISOString().slice(0, 10);
  for (const r of rows) if (r.real > 0) by.set(ck(r), { kind: r.kind, from: { lat: +(+r.from.lat).toFixed(4), lng: +(+r.from.lng).toFixed(4) }, to: { lat: +(+r.to.lat).toFixed(4), lng: +(+r.to.lng).toFixed(4) }, real: r.real, realKm: r.realKm, src: r.src.split(':')[0], measured: day });
  const all = [...by.values()].sort((a, b) => ck(a) < ck(b) ? -1 : 1).slice(-4000);
  fs.writeFileSync(CACHE, JSON.stringify({ note: 'Real least ride times measured by tools/truth/real-world.mjs (BRouter for walks and taxis, operators\' timetable files for trains, metro, buses and ferries). Read by tools/truth/real-world-gate.cjs.', rides: all }, null, 0).replace(/\},\{/g, '},\n{') + '\n');
  console.log(`\nKept ${all.length} real-world ride times in ${CACHE}`);
}
