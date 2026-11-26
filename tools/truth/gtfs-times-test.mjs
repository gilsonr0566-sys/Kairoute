// Proof that the timetable reader (tools/truth/gtfs-times.mjs) gets the right time, and that it would notice if it
// didn't. A small made-up timetable is written to a zip file, with every awkward thing real feeds have: a line given
// stop by stop, a line given as "every 15 minutes" (frequencies.txt), a change with a walk between two stops, a
// Sunday-only express, a cancelled day (calendar_dates.txt), a boat and a faster bus between the same two piers, names
// with commas in quotes, a file that starts with a byte-order mark, files in a sub-folder. The expected minutes below
// were worked out BY HAND from that timetable (see each line), not by this code.
// Then five bugs are planted in a copy of the reader, one at a time, and each must change an answer (so a reader that
// ignored the calendar, the time to change, the "every N minutes" lines, the boat rule or the walk to the stop could not
// pass unnoticed).
// Usage: node tools/truth/gtfs-times-test.mjs     (exit 1 on any failure)
import fs from 'fs'; import os from 'os'; import path from 'path'; import cp from 'child_process'; import { fileURLToPath, pathToFileURL } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gtfs-test-'));
const dir = path.join(tmp, 'feed', 'gtfs'); fs.mkdirSync(dir, { recursive: true });
const w = (f, s) => fs.writeFileSync(path.join(dir, f), s);
w('stops.txt', '﻿stop_id,stop_name,stop_lat,stop_lon\nA,"Alpha, main gate",40.0,0.0\nB,Beta,40.0,0.02\nC,Gamma,40.0,0.04\nC2,"Gamma ""upper""",40.0015,0.04\nD,Delta,40.0015,0.08\nX,Pier X,40.1,0.0\nY,Pier Y,40.1,0.1\nFAR,Far away,48.0,9.0\n');
w('routes.txt', 'route_id,route_short_name,route_long_name,route_type\nM1,M1,Line one,1\nM2,M2,Line two,1\nEX,EX,Sunday express,2\nFY,,Pier ferry,4\nBUS,9,Pier bus,3\n');
w('calendar.txt', 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nWK,1,1,1,1,1,0,0,20261101,20261231\nSU,0,0,0,0,0,0,1,20261101,20261231\nALL,1,1,1,1,1,1,1,20261101,20261231\n');
w('calendar_dates.txt', 'service_id,date,exception_type\nWK,20261202,2\n');
let trips = 'route_id,service_id,trip_id\nM2,WK,m2\nEX,SU,ex\nFY,ALL,fy\nBUS,ALL,bus\n', st = 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n';
const hm = s => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
for (let t = 7 * 3600; t <= 12 * 3600; t += 600) { const id = 'm1-' + t; trips += `M1,WK,${id}\n`; st += `${id},${hm(t)},${hm(t)},A,1\n${id},${hm(t + 180)},${hm(t + 180)},B,2\n${id},${hm(t + 360)},${hm(t + 360)},C,3\n`; } // M1: A every 10 min, 3 min a hop
st += 'm2,00:00:00,00:00:00,C2,1\nm2,00:07:00,00:07:00,D,2\n';                       // M2: C2 to D in 7 min, every 15 min (below)
st += 'ex,09:00:00,09:00:00,A,1\nex,09:05:00,09:05:00,D,2\n';                         // Sunday only: A to D in 5 min
st += 'fy,09:30:00,09:30:00,X,1\nfy,10:10:00,10:10:00,Y,2\n';                         // the boat: 40 min
st += 'bus,08:30:00,08:30:00,X,1\nbus,08:40:00,08:40:00,Y,2\n';                       // a bus between the piers: 10 min
w('trips.txt', trips); w('stop_times.txt', st);
w('frequencies.txt', 'trip_id,start_time,end_time,headway_secs\nm2,08:00:00,12:00:00,900\n');
const zip = path.join(tmp, 'feed.zip'); cp.execFileSync('zip', ['-qr', zip, 'gtfs'], { cwd: path.join(tmp, 'feed') });

const O = { lat: 40.0, lng: -0.003 }, T = { lat: 40.0015, lng: 0.083 }, O2 = { lat: 40.0, lng: -0.05 }, X = { lat: 40.1, lng: 0.0 }, Y = { lat: 40.1, lng: 0.1 }, BOX = [39.9, -0.2, 40.2, 0.2];
// By hand. Walk O to A and D to T: 0.2555 km x 1.3 at 4.5 km/h = 266 s each. C to C2: 0.1668 km = 174 s, plus 120 s to change.
//  1 Wednesday 08:00, O to T: M1 leaves A on the 10s, at C 6 min later, at C2 ready 294 s after that (:x0:54), M2 leaves
//    on the quarter hours; the shortest wait is 246 s (M1 08:30, C 08:36, ready 08:40:54, M2 08:45, D 08:52).
//    266 + 360 + 294 + 246 + 420 + 266 = 1852 s = 30.87 min.
//  2 Sunday 08:00, O to T: only the express runs: 266 + 300 + 266 = 832 s = 13.87 min.
//  3 Wednesday Dec 2 is cancelled for the weekday lines: no connection.
//  4 a ride of 11 km, O2 to T, may use a taxi at either end: taxi to A (4.26 km: 180 + 664 = 844 s), M1 to C 360 s, taxi
//    from C (3.67 km: 180 + 572 = 752 s) = 1956 s = 32.6 min (a taxi straight to C2 and M2 would be 2062 s).
//  5 the boat X to Y: 40 min (the bus takes 10, and is not a boat).   6 the same two piers as a bus ride: 10 min.
//  7 a timetable that has run out is read on its last Wednesday, and says so: as 1.
const CASES = [
  ['weekday, change with a walk, every-15-minutes line', { today: '2026-11-24', wd: 3 }, { from: O, to: T, at: 480, kind: 'metro' }, 30.87],
  ['Sunday: only the Sunday express', { today: '2026-11-24', wd: 0 }, { from: O, to: T, at: 480, kind: 'train' }, 13.87],
  ['cancelled day: no connection', { today: '2026-12-01', wd: 3 }, { from: O, to: T, at: 480, kind: 'metro' }, null],
  ['long ride: taxi to the station', { today: '2026-11-24', wd: 3 }, { from: O2, to: T, at: 480, kind: 'train' }, 32.6],
  ['ferry: only the boat counts', { today: '2026-11-24', wd: 3 }, { from: X, to: Y, at: 480, kind: 'ferry' }, 40],
  ['bus between the piers', { today: '2026-11-24', wd: 3 }, { from: X, to: Y, at: 480, kind: 'bus' }, 10],
  ['timetable run out: last such weekday', { today: '2027-03-01', wd: 3, dated: '20261231' }, { from: O, to: T, at: 480, kind: 'metro' }, 30.87],
];
async function run(modFile) {
  const M = await import(pathToFileURL(modFile).href + '?' + Math.random()), out = [];
  for (const [name, o, ride, want] of CASES) { let got = null, F = null;
    try { F = await M.readFeed(zip, BOX, o.wd, new Date(o.today + 'T00:00:00Z')); const j = M.least(M.network([F]), ride); got = j ? Math.round(j.min * 100) / 100 : null; } catch (e) { got = 'error ' + e.message; }
    const ok = (want == null ? got == null : typeof got === 'number' && Math.abs(got - want) <= 0.05) && (!o.dated || (F && F.dated === o.dated));
    out.push({ name, want, got, ok }); }
  return out;
}
let fail = 0;
const real = await run(path.join(HERE, 'gtfs-times.mjs'));
for (const r of real) { console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}: ${r.got == null ? 'no connection' : r.got + ' min'}${r.ok ? '' : ` (by hand: ${r.want == null ? 'no connection' : r.want + ' min'})`}`); if (!r.ok) fail++; }
// The catalog: the smallest area that holds both ends comes first; a broken world-wide box and a dead feed are left out.
{ const M = await import(pathToFileURL(path.join(HERE, 'gtfs-times.mjs')).href), cdir = path.join(tmp, 'cat'); fs.mkdirSync(cdir);
  const feed = (id, box, extra) => fs.writeFileSync(path.join(cdir, id + '.json'), JSON.stringify(Object.assign({ mdb_source_id: id, provider: 'P' + id, location: { bounding_box: { minimum_latitude: box[0], minimum_longitude: box[1], maximum_latitude: box[2], maximum_longitude: box[3] } }, urls: { latest: 'https://example.org/' + id + '.zip' } }, extra || {})));
  feed(1, [39, -1, 41, 1]); feed(2, [39.9, -0.1, 40.1, 0.1]); feed(3, [-90, -180, 90, 180]); feed(4, [39.9, -0.1, 40.1, 0.1], { status: 'deprecated' }); feed(5, [50, 5, 51, 6]);
  const got = M.feedsFor(M.loadCatalog(cdir, [{ provider: 'X', bbox: [39.5, -0.5, 40.5, 0.5], url: 'https://example.org/x.zip' }]), [O, T]).map(f => f.id).join(',');
  const ok = got === 'mdb-2,extra-X,mdb-1'; console.log(`${ok ? 'ok  ' : 'FAIL'} catalog: feeds for a place, smallest area first (${got})`); if (!ok) fail++; }

// Planted bugs: each must change at least one answer.
const src = fs.readFileSync(path.join(HERE, 'gtfs-times.mjs'), 'utf8');
const PLANTS = [
  ['the calendar ignored (every service runs every day)', "if (on.has(r.service_id)) trips.set(", 'trips.set('],
  ['no time to change', 'CHANGE_SEC = 120', 'CHANGE_SEC = 0'],
  ['"every N minutes" lines read as one departure', 'if (!fq) push(t.st, 0, rt); else', 'if (true) push(t.st, 0, rt); else'],
  ['a ferry compared with any ride', 'if (boat && !isBoat(c.route.type)) continue;', ''],
  ['the walk to the stop not counted', 'const walkSec = km => km * 1.3 / WALK_KMH * 3600', 'const walkSec = km => 0'],
];
for (const [name, a, b] of PLANTS) {
  if (!src.includes(a)) { console.log(`FAIL planted "${name}": the text it changes is gone from gtfs-times.mjs`); fail++; continue; }
  const f = path.join(tmp, 'plant-' + Math.random().toString(36).slice(2) + '.mjs'); fs.writeFileSync(f, src.replace(a, b));
  const res = await run(f), caught = res.filter(r => !r.ok);
  console.log(`${caught.length ? 'ok  ' : 'FAIL'} planted: ${name}: ${caught.length ? 'caught (' + caught[0].name + ': ' + (caught[0].got == null ? 'no connection' : caught[0].got + ' min') + ')' : 'NOT caught - BLIND'}`); if (!caught.length) fail++;
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\ngtfs-times-test: ${CASES.length + 1} checks, ${PLANTS.length} planted bugs, ${fail} failed`);
process.exit(fail ? 1 : 0);
