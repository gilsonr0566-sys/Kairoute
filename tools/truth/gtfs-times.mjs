// The real-world time of a train, metro, tram, bus or ferry ride, read from the OPERATORS' OWN PUBLISHED TIMETABLES.
// (Nov 25 2026: the free DB journey planners the real-world check asked all stopped answering, so trains, metro and
// buses had no real-world check at all and counted zero in the readiness score; ferries never had one.)
//
// Transport operators publish their timetables as open files (GTFS: stops.txt, stop_times.txt, calendar.txt ...). The
// Mobility Database catalog (github.com/MobilityData/mobility-database-catalogs, about 1,800 live feeds worldwide) lists
// them with the area each covers and a download address. This reads the files themselves and works the journey out with
// its own arithmetic, so it shares nothing with the app's way of getting ride times (the app asks the Transitous journey
// planner and reads lines mapped on OpenStreetMap; it never opens a timetable file). A wrong answer in the app, in the
// planner it asks, or in the map's line data shows up as a difference from the operator's timetable.
//
// For a ride from A to B at a time of day:
//   1. the feeds whose area holds both ends (smallest areas first: the city's own operator before a national one);
//   2. every departure of the same weekday in the feed's current timetable (calendar.txt, calendar_dates.txt, and
//      frequencies.txt for lines given as "every N minutes");
//   3. the quickest door-to-door journey leaving in the two hours after the planned time: on foot to a stop (straight
//      line x 1.3 at 4.5 km/h, up to 1.2 km; on a ride of 8 km or more also by taxi to a station up to 10 km off, 3 min +
//      30 km/h, the least a taxi takes), the timetabled rides with changes (2 min to change, walking up to 300 m between
//      stops), on foot or by taxi from the last stop. Time waiting for the first departure is not counted (as a journey
//      planner counts it).
// A ferry ride is only ever compared with timetabled BOATS (route_type 4 and the extended 1000s/1200s).
// No answer (no feed for the area, no stop near an end, no departure that day) is "not checked", never a pass.
//
// Used by tools/truth/real-world.mjs. Self-test with planted bugs: tools/truth/gtfs-times-test.mjs.
// Free public files only, no key, no AI. Needs `unzip` on the machine (GitHub's runners have it).
import fs from 'fs'; import path from 'path'; import os from 'os'; import cp from 'child_process'; import readline from 'readline';

const hav = (a, b) => { const R = 6371, r = Math.PI / 180, x = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lng - a.lng) * r / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
export const WALK_KMH = 4.5, WALK_MAX_KM = 1.2, TAXI_FROM_KM = 8, TAXI_MAX_KM = 10, CHANGE_SEC = 120, FOOT_LINK_KM = 0.3, SEARCH_MIN = 120, STEP_MIN = 5;
const walkSec = km => km * 1.3 / WALK_KMH * 3600, taxiSec = km => 180 + km * 1.3 / 30 * 3600;
const isBoat = t => t === 4 || (t >= 1000 && t < 1100) || (t >= 1200 && t < 1300);

// ---- 1. The catalog: which feeds cover a place
// dir: catalogs/sources/gtfs/schedule of the Mobility Database catalog. extra: [{ provider, bbox: [minLat, minLng,
// maxLat, maxLng], url }] for official feeds the catalog lacks (tools/truth/gtfs-extra-feeds.json).
export function loadCatalog(dir, extra) {
  const out = [];
  if (dir && fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { continue; }
    const b = j.location && j.location.bounding_box; if (!b || !isFinite(b.minimum_latitude) || b.minimum_latitude == null) continue;
    if (/inactive|deprecated/.test(j.status || '')) continue;
    const urls = [j.urls && j.urls.latest, j.urls && j.urls.direct_download].filter(u => /^https?:/.test(u || '')); if (!urls.length) continue;
    out.push({ id: 'mdb-' + j.mdb_source_id, provider: j.provider || f, official: /true/i.test(j.is_official || ''), urls, box: [+b.minimum_latitude, +b.minimum_longitude, +b.maximum_latitude, +b.maximum_longitude] });
  }
  for (const x of extra || []) out.push({ id: 'extra-' + x.provider, provider: x.provider, official: !!x.official, urls: [x.url], box: x.bbox });
  for (const f of out) f.area = (f.box[2] - f.box[0]) * (f.box[3] - f.box[1]);
  return out;
}
// Feeds whose area holds every point. A box bigger than 900 square degrees (a third of Europe) is a broken box or a
// continent-wide coach network: not a city's timetable. Smallest first, at most `max`.
export function feedsFor(cat, pts, max = 8) {
  const m = 0.02, has = (f, p) => p.lat >= f.box[0] - m && p.lat <= f.box[2] + m && p.lng >= f.box[1] - m && p.lng <= f.box[3] + m;
  return cat.filter(f => f.area > 0 && f.area <= 900 && pts.every(p => has(f, p))).sort((a, b) => a.area - b.area).slice(0, max);
}
export async function fetchFeed(feed, dir, maxMB = 250) {
  const file = path.join(dir, feed.id.replace(/[^\w-]/g, '_') + '.zip'); if (fs.existsSync(file) && fs.statSync(file).size > 1000) return file;
  let last;
  for (const u of feed.urls) { try {
    const res = await fetch(u, { headers: { 'User-Agent': 'kairoute-test (timetable check; github.com/gilsonr0566-sys/kairoute)' }, redirect: 'follow', signal: AbortSignal.timeout(180000) });
    if (!res.ok) { last = new Error('feed ' + res.status); continue; }
    const len = +res.headers.get('content-length') || 0; if (len > maxMB * 1e6) { last = new Error(`feed too big (${Math.round(len / 1e6)} MB)`); continue; }
    const buf = Buffer.from(await res.arrayBuffer()); if (buf.length > maxMB * 1e6) { last = new Error('feed too big'); continue; }
    if (buf.length < 1000 || buf[0] !== 0x50 || buf[1] !== 0x4b) { last = new Error('not a zip file'); continue; }
    fs.writeFileSync(file, buf); return file;
  } catch (e) { last = e; } }
  throw new Error(`${feed.provider}: ${(last && last.message) || 'no download'}`);
}

// ---- 2. Reading a feed (only the stops inside `box`, so a national feed stays small)
const csvLine = s => { const out = []; let i = 0, n = s.length; while (i <= n) { if (s[i] === '"') { let v = ''; i++; while (i < n) { if (s[i] === '"') { if (s[i + 1] === '"') { v += '"'; i += 2; continue; } i++; break; } v += s[i++]; } out.push(v); while (i < n && s[i] !== ',') i++; i++; } else { const j = s.indexOf(',', i); if (j < 0) { out.push(s.slice(i)); break; } out.push(s.slice(i, j)); i = j + 1; } } return out; };
const members = zip => cp.execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8', maxBuffer: 1 << 24 }).split('\n').filter(Boolean);
async function rows(zip, names, file, each) {
  const m = names.find(n => n === file) || names.find(n => n.endsWith('/' + file)); if (!m) return false;
  const p = cp.spawn('unzip', ['-p', zip, m.replace(/[[\]*?]/g, '\\$&')], { stdio: ['ignore', 'pipe', 'ignore'] });
  const rl = readline.createInterface({ input: p.stdout, crlfDelay: Infinity }); let head = null;
  for await (let line of rl) { if (!line) continue; if (!head) { head = csvLine(line.replace(/^﻿/, '')).map(h => h.trim()); continue; }
    const c = line.indexOf('"') < 0 ? line.split(',') : csvLine(line), o = {}; for (let i = 0; i < head.length; i++) o[head[i]] = c[i] == null ? '' : c[i].trim(); each(o); }
  return true;
}
const sec = t => { const m = /^(\d+):(\d\d)(?::(\d\d))?/.exec(t || ''); return m ? +m[1] * 3600 + +m[2] * 60 + +(m[3] || 0) : NaN; };
const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');
// weekday: 0 Sunday .. 6 Saturday. today: Date (the timetable day is the next such weekday the feed still covers).
// win: [from, to] seconds after midnight; only departures inside it are kept (a big city's buses run to millions a day).
export async function readFeed(zip, box, weekday, today = new Date(), win = [0, 40 * 3600]) {
  const names = members(zip), F = { stops: [], conns: [], routes: new Map(), day: null, dated: false };
  const sid = new Map();
  await rows(zip, names, 'stops.txt', r => { const lat = +r.stop_lat, lng = +r.stop_lon; if (!isFinite(lat) || !isFinite(lng) || (!lat && !lng)) return;
    if (lat < box[0] || lat > box[2] || lng < box[1] || lng > box[3]) return; sid.set(r.stop_id, F.stops.length); F.stops.push({ lat, lng, name: r.stop_name || '' }); });
  if (!F.stops.length) return F;
  await rows(zip, names, 'routes.txt', r => F.routes.set(r.route_id, { name: r.route_short_name || r.route_long_name || r.route_id, type: +r.route_type }));
  // The service day: the next date with the wanted weekday; a feed whose timetable has run out is read on its last such
  // date, and says so ("timetable to ...").
  const cal = [], exc = [];
  await rows(zip, names, 'calendar.txt', r => cal.push(r)); await rows(zip, names, 'calendar_dates.txt', r => exc.push(r));
  let lo = '99999999', hi = '00000000'; for (const r of cal) { if (r.start_date < lo) lo = r.start_date; if (r.end_date > hi) hi = r.end_date; } for (const r of exc) { if (r.date < lo) lo = r.date; if (r.date > hi) hi = r.date; }
  if (hi === '00000000') return F;
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1)); while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  if (ymd(d) > hi) F.dated = hi; while (ymd(d) > hi) d.setUTCDate(d.getUTCDate() - 7); while (ymd(d) < lo) d.setUTCDate(d.getUTCDate() + 7);
  if (ymd(d) > hi) return F;
  const day = ymd(d), wk = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][weekday], on = new Set(); F.day = day;
  for (const r of cal) if (r[wk] === '1' && r.start_date <= day && r.end_date >= day) on.add(r.service_id);
  for (const r of exc) if (r.date === day) { if (r.exception_type === '1') on.add(r.service_id); else on.delete(r.service_id); }
  const trips = new Map(); await rows(zip, names, 'trips.txt', r => { if (on.has(r.service_id)) trips.set(r.trip_id, { route: r.route_id, st: [] }); });
  if (!trips.size) return F;
  await rows(zip, names, 'stop_times.txt', r => { const t = trips.get(r.trip_id); if (!t) return; const s = sid.get(r.stop_id); if (s == null) return;
    const a = sec(r.arrival_time), dp = sec(r.departure_time); if (!isFinite(a) && !isFinite(dp)) return; t.st.push([+r.stop_sequence, s, isFinite(a) ? a : dp, isFinite(dp) ? dp : a]); });
  const freq = new Map(); await rows(zip, names, 'frequencies.txt', r => { const h = +r.headway_secs, a = sec(r.start_time), z = sec(r.end_time); if (h > 0 && isFinite(a) && isFinite(z)) { if (!freq.has(r.trip_id)) freq.set(r.trip_id, []); freq.get(r.trip_id).push([a, z, h]); } });
  let tn = 0; const push = (st, shift, route) => { const id = tn++; for (let i = 0; i + 1 < st.length; i++) { const dep = st[i][3] + shift, arr = st[i + 1][2] + shift; if (arr >= dep && dep >= win[0] && dep <= win[1] && st[i][1] !== st[i + 1][1]) F.conns.push({ dep, arr, from: st[i][1], to: st[i + 1][1], trip: id, route }); } };
  for (const [id, t] of trips) { if (t.st.length < 2) continue; t.st.sort((x, y) => x[0] - y[0]); const rt = F.routes.get(t.route) || { name: t.route, type: 3 }, fq = freq.get(id);
    if (!fq) push(t.st, 0, rt); else { const t0 = t.st[0][3]; for (const [a, z, h] of fq) for (let s = Math.max(a, a + Math.ceil((win[0] - 6 * 3600 - a) / h) * h); s < z && s <= win[1]; s += h) push(t.st, s - t0, rt); } }
  return F;
}

// ---- 3. One day's network from several feeds, and the quickest journey on it
export function network(feeds) {
  const N = { stops: [], conns: [], trips: 0 };
  for (const f of feeds) { const off = N.stops.length, toff = N.trips; let tmax = -1; for (const s of f.stops) N.stops.push(s);
    for (const c of f.conns) { N.conns.push({ dep: c.dep, arr: c.arr, from: c.from + off, to: c.to + off, trip: c.trip + toff, route: c.route }); if (c.trip > tmax) tmax = c.trip; }
    N.trips = toff + tmax + 1; }
  N.conns.sort((a, b) => a.dep - b.dep || a.arr - b.arr);
  // Stops in use, on a grid, for "stops near a point" and for walking between stops when changing.
  const used = new Uint8Array(N.stops.length); for (const c of N.conns) { used[c.from] = 1; used[c.to] = 1; }
  const cell = 0.02, grid = new Map();
  N.stops.forEach((s, i) => { if (!used[i]) return; const k = Math.floor(s.lat / cell) + ':' + Math.floor(s.lng / cell); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
  N.near = (p, km) => { const out = [], dLa = km / 111, dLo = km / (111 * Math.max(0.2, Math.cos(p.lat * Math.PI / 180)));
    for (let la = Math.floor((p.lat - dLa) / cell); la <= Math.floor((p.lat + dLa) / cell); la++) for (let lo = Math.floor((p.lng - dLo) / cell); lo <= Math.floor((p.lng + dLo) / cell); lo++)
      for (const i of grid.get(la + ':' + lo) || []) { const d = hav(p, N.stops[i]); if (d <= km) out.push([i, d]); } return out; };
  N.foot = N.stops.map((s, i) => used[i] ? N.near(s, FOOT_LINK_KM).filter(([j]) => j !== i).map(([j, d]) => [j, Math.round(walkSec(d))]) : []);
  return N;
}
// ride: { from, to, at (minutes after midnight, local), kind }. Returns { min, lines, dep } or null.
// Earliest arrival over the day's departures in time order, from each leaving time in the search window; the journey
// kept is the shortest from leaving the door (just in time for its first departure) to reaching the other door.
export function least(N, ride) {
  if (!N.conns.length) return null;
  const straight = hav(ride.from, ride.to), boat = ride.kind === 'ferry', taxi = !boat && straight >= TAXI_FROM_KM;
  const ends = p => { const m = new Map(); for (const [i, d] of N.near(p, taxi ? TAXI_MAX_KM : WALK_MAX_KM)) m.set(i, Math.round(Math.min(d <= WALK_MAX_KM ? walkSec(d) : Infinity, taxi ? taxiSec(d) : Infinity))); return m; };
  const acc = ends(ride.from), egr = ends(ride.to); if (!acc.size || !egr.size) return null;
  const C = N.conns, n = N.stops.length, at = (isFinite(ride.at) ? ride.at : 600) * 60; let best = null;
  // S: the soonest one can board at a stop (after the walk there, or after getting off plus the time to change).
  // A: the soonest arrival at a stop by a ride. L / LA: when the door was left for that. P / PA: the ride that brought it.
  const S = new Float64Array(n), L = new Float64Array(n), P = new Int32Array(n), A = new Float64Array(n), LA = new Float64Array(n), PA = new Int32Array(n), TL = new Float64Array(N.trips), TE = new Int32Array(N.trips);
  for (let t0 = at; t0 <= at + SEARCH_MIN * 60; t0 += STEP_MIN * 60) {
    S.fill(Infinity); A.fill(Infinity); P.fill(-1); PA.fill(-1); TE.fill(-1);
    for (const [i, w] of acc) S[i] = t0 + w;
    let lo = 0, hi = C.length; while (lo < hi) { const m = (lo + hi) >> 1; if (C[m].dep < t0) lo = m + 1; else hi = m; }
    let bound = Infinity;
    for (let k = lo; k < C.length; k++) { const c = C[k]; if (c.dep > bound || c.dep > t0 + 8 * 3600) break; if (boat && !isBoat(c.route.type)) continue;
      if (TE[c.trip] < 0) { if (!(S[c.from] <= c.dep)) continue; TE[c.trip] = k; TL[c.trip] = P[c.from] < 0 ? c.dep - acc.get(c.from) : L[c.from]; }
      const lv = TL[c.trip];
      if (c.arr < A[c.to] || (c.arr === A[c.to] && lv > LA[c.to])) { A[c.to] = c.arr; LA[c.to] = lv; PA[c.to] = k; const e = egr.get(c.to); if (e != null && c.arr + e < bound) bound = c.arr + e; }
      if (c.arr + CHANGE_SEC < S[c.to]) { S[c.to] = c.arr + CHANGE_SEC; L[c.to] = lv; P[c.to] = k; }
      for (const [j, w] of N.foot[c.to]) { const a = c.arr + w + CHANGE_SEC; if (a < S[j]) { S[j] = a; L[j] = lv; P[j] = k; } }
    }
    for (const [b, e] of egr) { if (PA[b] < 0) continue; const total = A[b] + e - LA[b];
      if (!best || total < best.sec) { const lines = []; let k = PA[b], guard = 0; while (k >= 0 && guard++ < 12) { const c = C[k]; lines.unshift(c.route.name); k = P[C[TE[c.trip]].from]; }
        best = { sec: total, lines: lines.filter((x, i, a) => x !== a[i - 1]), dep: LA[b] }; } }
  }
  return best ? { min: best.sec / 60, lines: best.lines.join(' + '), dep: best.dep } : null;
}

// ---- 4. The whole thing for a list of rides (grouped by place, so each feed is read once per place and weekday)
// rides: [{ kind, from, to, at, date (YYYY-MM-DD), city }]. Returns a Map ride -> { min, src } or { err }.
export async function gtfsTimes(rides, { catalog, tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gtfs-')), log = () => { }, today = new Date() } = {}) {
  const out = new Map(), groups = new Map();
  for (const r of rides) { const wd = new Date((r.date || today.toISOString().slice(0, 10)) + 'T12:00:00Z').getUTCDay(), k = (r.city || `${r.from.lat.toFixed(0)},${r.from.lng.toFixed(0)}`) + '|' + wd; if (!groups.has(k)) groups.set(k, { wd, rides: [] }); groups.get(k).rides.push(r); }
  for (const [gk, g] of groups) {
    const pts = g.rides.flatMap(r => [r.from, r.to]), pad = 0.12;
    const box = [Math.min(...pts.map(p => p.lat)) - pad, Math.min(...pts.map(p => p.lng)) - pad, Math.max(...pts.map(p => p.lat)) + pad, Math.max(...pts.map(p => p.lng)) + pad];
    // Feeds per ride (a day trip's train needs the national feed, a metro ride the city's), read once for the group.
    const want = new Map(); for (const r of g.rides) for (const f of feedsFor(catalog, [r.from, r.to])) want.set(f.id, f);
    const read = new Map(), ats = g.rides.map(r => isFinite(r.at) ? r.at : 600), win = [(Math.min(...ats) - 5) * 60, (Math.max(...ats) + SEARCH_MIN + 8 * 60) * 60];
    for (const f of want.values()) { try { const zip = await fetchFeed(f, tmp), F = await readFeed(zip, box, g.wd, today, win);
      if (F.conns.length > 6e6) { log(`  ${gk}: ${f.provider}: ${F.conns.length} legs, too many to read here: left out`); continue; } if (F.dated && (today - new Date(F.dated.replace(/(\d{4})(\d\d)(\d\d)/, '$1-$2-$3'))) / 864e5 > 400) { log(`  ${gk}: ${f.provider}: timetable file ended ${F.dated}, too old to count`); continue; }
      if (F.conns.length) { read.set(f.id, Object.assign(F, { feed: f })); log(`  ${gk}: ${f.provider}: ${F.conns.length} legs between stops on ${F.day}${F.dated ? ' (timetable ended ' + F.dated + ')' : ''}`); } else log(`  ${gk}: ${f.provider}: no departures in this area that day`); } catch (e) { log(`  ${gk}: ${String(e.message || e).slice(0, 140)}`); } }
    if (!read.size) { for (const r of g.rides) out.set(r, { err: want.size ? 'timetable files: none could be read for this place' : 'timetable files: no open feed covers this place' }); continue; }
    const N = network([...read.values()]);
    for (const r of g.rides) { const j = least(N, r);
      if (!j) { out.set(r, { err: r.kind === 'ferry' ? 'timetable files: no timetabled boat between these two places' : 'timetable files: no connection between these two places' }); continue; }
      const prov = [...read.values()].map(F => F.feed.provider + (F.dated ? ` (timetable ended ${F.dated})` : '')).join(', ');
      out.set(r, { min: j.min, lines: j.lines, src: `Operator timetable (GTFS): ${j.lines}; feeds read: ${prov}`, dated: [...read.values()].some(F => F.dated) }); }
  }
  return out;
}
