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
//   train, metro, tram, bus   Deutsche Bahn's journey planner (v6.db.transport.rest, HAFAS: most European rail and
//          many cities' local lines; not used by the app): the fastest real connection near the planned time
//   ferry  no free independent timetable exists: counted as NOT CHECKED, never as a pass
// A ride the plan shows FASTER than the real-world least time is "too fast" (planned 5 min or more under it, and 25%
// or more). On the ride back on a ship, train or flight day (any ride after the day's last visit) a too-fast ride is S1:
// following the plan could miss the departure. Too slow (more than double and 15 min over) is S2 (it wastes the day).
//
// Usage: node tools/truth/real-world.mjs [--max 400] [--trips g09-kotor,g02-vienna] [--out file.json]
// Needs the internet (run on GitHub: .github/workflows/real-world.yml, nightly). No AI, free public services only, one
// request a second to each. Exit 1 when an S1 is found or nothing could be checked; it never publishes anything.
import fs from 'fs'; import path from 'path'; import { createRequire } from 'module'; import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url), HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(HERE, '..', '..');
const E = require(path.join(ROOT, 'tools', 'beta2', 'engine.cjs'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const MAX = +arg('max', 400), ONLY = (arg('trips', '') || '').split(',').filter(Boolean), OUT = arg('out', null);
const UA = { 'User-Agent': 'kairoute-test (free route check; github.com/gilsonr0566-sys/kairoute)' };
const PD = path.join(ROOT, 'tools', 'places', 'data'), places = {};
if (fs.existsSync(PD)) for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; }
const dir = process.env.SNAP_DIR || path.join(ROOT, 'tools', 'beta2', 'corpus');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hav = (a, b) => { const R = 6371, r = Math.PI / 180, x = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lng - a.lng) * r / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const clk = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
const kindOf = x => { const k = String(x.kind || x.mode || '').toLowerCase(); return /walk/.test(k) ? 'walk' : /taxi|car|drive/.test(k) ? 'taxi' : /ferry|boat|tender|water/.test(k) ? 'ferry' : /train|rail/.test(k) ? 'train' : /metro|subway|tram|light/.test(k) ? 'metro' : /bus/.test(k) ? 'bus' : /lift|cable|funic/.test(k) ? 'lift' : k || 'other'; };

// ---- 1. Every ride on every saved test trip's plan
const rides = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  const name = f.replace(/\.json$/, ''); if (ONLY.length && !ONLY.includes(name)) continue;
  let plans; const b = JSON.parse(fs.readFileSync(path.join(dir, f)));
  try { plans = E.planTrip(E.applyPlaces(b, places)); } catch (e) { console.log(`FAIL ${name}: does not plan (${e.message})`); continue; }
  b.days.forEach((d, i) => { const p = plans[i]; if (!p || !p.items) return; const its = p.items;
    const lastVisit = its.map(x => x.t).lastIndexOf('stop'), hard = /port|departure|embark/.test(d.type);
    its.forEach((x, j) => { if (x.t !== 'ride' || !x.from || !x.to || !(x.min > 0)) return;
      rides.push({ trip: name, day: i + 1, date: d.date, type: d.type, city: d.city, kind: kindOf(x), label: x.how || x.kind || x.mode, min: x.min, wait: x.wait || 0, km: x.km,
        at: x.at, from: x.from, to: x.to, back: hard && j > lastVisit, toName: (its[j + 1] && its[j + 1].name) || '', fromName: (its[j - 1] && its[j - 1].name) || '' }); }); });
}
// The same two points and kind asked once.
const key = r => `${r.kind}|${r.from.lat.toFixed(4)},${r.from.lng.toFixed(4)}|${r.to.lat.toFixed(4)},${r.to.lng.toFixed(4)}`;
const uniq = new Map(); for (const r of rides) { const k = key(r); if (!uniq.has(k)) uniq.set(k, []); uniq.get(k).push(r); }
// The ride back first (safety), then the rest; cap the number of lookups.
const asks = [...uniq.entries()].sort((a, b) => (b[1].some(r => r.back) - a[1].some(r => r.back)) || (b[1][0].min - a[1][0].min)).slice(0, MAX);

// ---- 2. The independent sources
async function brouter(r, profile) {
  const u = `https://brouter.de/brouter?lonlats=${r.from.lng},${r.from.lat}|${r.to.lng},${r.to.lat}&profile=${profile}&alternativeidx=0&format=geojson`;
  const res = await fetch(u, { headers: UA }); if (!res.ok) throw new Error('brouter ' + res.status + ' ' + (await res.text()).slice(0, 80));
  const j = await res.json(), p = j.features && j.features[0] && j.features[0].properties; if (!p) throw new Error('brouter: no route');
  return { km: +p['track-length'] / 1000, sec: +p['total-time'] };
}
const nextDate = (iso, at) => { // the same weekday as the trip's day, in the next two weeks (timetables run only so far ahead)
  const want = new Date(iso + 'T12:00:00Z').getUTCDay(), d = new Date(); d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() !== want) d.setUTCDate(d.getUTCDate() + 1);
  // Local clock at the place, from its longitude (one hour per 15 degrees; summer time ignored): the search spans 2 hours
  // after, so an hour off still finds the same service pattern.
  const off = Math.round(r0.lng / 15); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, at - off * 60));
};
let r0 = null;
async function db(r) {
  r0 = r.from; const when = nextDate(r.date || new Date().toISOString().slice(0, 10), r.at || 600);
  const q = new URLSearchParams({ 'from.latitude': r.from.lat, 'from.longitude': r.from.lng, 'from.address': r.fromName || 'start', 'to.latitude': r.to.lat, 'to.longitude': r.to.lng, 'to.address': r.toName || 'end',
    departure: when.toISOString(), results: '6', stopovers: 'false', remarks: 'false', walkingSpeed: 'normal' });
  const res = await fetch('https://v6.db.transport.rest/journeys?' + q, { headers: UA }); if (!res.ok) throw new Error('db ' + res.status);
  const j = await res.json(), js = (j.journeys || []).map(x => { const L = x.legs || [], a = L[0], z = L[L.length - 1];
    const dep = new Date(a.plannedDeparture || a.departure), arr = new Date(z.plannedArrival || z.arrival);
    const lines = L.filter(l => l.line).map(l => (l.line.productName || l.line.mode || '') + ' ' + (l.line.name || '')).join(' + ');
    return { min: (arr - dep) / 60000, lines, transit: L.some(l => l.line) }; }).filter(x => x.transit && x.min > 0);
  if (!js.length) throw new Error('db: no connection');
  return js.sort((a, b) => a.min - b.min)[0];
}

// ---- 3. Compare
const rows = [], notChecked = {}; let lastB = 0, lastD = 0;
const pace = async (t, gap) => { const w = t + gap - Date.now(); if (w > 0) await sleep(w); return Date.now(); };
for (const [, group] of asks) { const r = group[0], row = { ...r, n: group.length, back: group.some(x => x.back) };
  try {
    if (r.kind === 'walk') { lastB = await pace(lastB, 1100); const b = await brouter(r, 'hiking-mountain'); row.realKm = +b.km.toFixed(2); row.real = Math.round(b.km / 4.5 * 60); row.src = 'BRouter foot, 4.5 km/h'; row.planned = r.min; }
    else if (r.kind === 'taxi') { lastB = await pace(lastB, 1100); const b = await brouter(r, 'car-fast'); row.realKm = +b.km.toFixed(2); row.real = Math.round(b.sec / 60); row.src = 'BRouter car, empty roads'; row.planned = r.min; }
    else if (/train|metro|bus/.test(r.kind)) { lastD = await pace(lastD, 700); const j = await db(r); row.real = Math.round(j.min); row.src = 'DB journey planner: ' + j.lines; row.planned = r.min + r.wait; }
    else { (notChecked[r.kind] = notChecked[r.kind] || []).push(row); continue; }
  } catch (e) { row.err = String(e.message || e).slice(0, 120); (notChecked[r.kind] = notChecked[r.kind] || []).push(row); continue; }
  const under = row.real - row.planned;
  row.verdict = under >= 5 && row.planned < row.real * 0.75 ? 'too fast' : (row.planned > row.real * 2 && row.planned - row.real > 15 ? 'too slow' : 'ok');
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
if (nos.length) console.log(`NOT CHECKED, no independent source for this kind: ${nos.map(([k, n]) => `${n} ${k}`).join(', ')} (ferries: no free timetable outside the operators' own pages)`);
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ rows, notChecked }, null, 1));
const s1 = rows.filter(r => r.sev === 'S1').length;
console.log(`\n${rows.length} rides compared with the real world; ${s1} too fast on the ride back (S1); ${rows.filter(r => r.sev === 'S2').length} other gaps (S2)`);
process.exitCode = s1 || !rows.length ? 1 : 0;
