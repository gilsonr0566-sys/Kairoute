// The independent safety check (Nov 23 2026, thread "Rebuild the testing and review process").
//
// Why it exists: every older check read the planner's OWN numbers (its back-by time, its leave-by, its day start, its
// "late" and "shut" flags) and asked whether the plan agreed with them. When the planner got one of those numbers wrong,
// the plan and the check were wrong together and every test passed. That is how these reached travelers or outside
// testers: a 5:45 am flight with a full Sintra day; a 9:00 am train read as tomorrow's; a countdown 41 min late on a bag
// day; "off the ship 5:30 am" before the ship was in.
//
// This check never reads the planner's window, back-by, leave-by basis, flags or constants. It reads only:
//   - what the traveler typed for the day (date, type, times, the gate's map point), and
//   - what the plan shows (each item's place, clock time and minutes, and the leave-by time shown on screen),
// and works out, with its own small model of the world, whether a traveler following the plan is safe. Its floors are
// deliberately generous to the planner (the least time anyone could ever need), so a failure here is a real failure,
// never a matter of taste.
//
// Rules (S1 = could miss a flight, train or ship; S2 = wrong or impossible on screen):
//   S1 gone      a stop or meal planned after the traveler has had to leave for the flight, train or ship, read
//                literally on the day's own date (the time the traveler typed, on the date the traveler typed)
//   S1 reach     from the last stop or meal, even the fastest possible ride (straight line, 60 km/h, no traffic) and the
//                bags step cannot reach the gate by the least time any traveler needs there
//   S1 leaveby   the leave-by time shown, plus the fastest possible way to the gate (via the bags when the plan collects
//                them), is later than the least time needed at the gate
//   S1 before    a stop or meal before the traveler can be there: before the plane lands (+20), the train arrives, the
//                ship docks (+15, +30 at a tender port), or before the day's own start time
//   S1 night     a departure typed in the small hours (before 5:00) on a day the plan fills with sights: the plan takes it
//                as the NEXT night, a ticket dated that day means THIS morning. Never assumed: it must be asked.
//   S2 physics   a ride faster than its kind can move in a straight line (walk 6.5 km/h, taxi, bus 90, metro 90, train
//                300, ferry 80), or no time at all between two places apart
//   S2 clock     the clock runs backwards, or a time that is not a number
//   S2 drift     a ride's two ends are not the places before and after it (the ride says one place, the card another)
//   S2 slowride  a ride more than 3 times the road time a taxi would need and more than 45 min over it (absurd)
// Usage (module): require('./oracle.cjs').checkDay(day, plan, ctx) -> [{rule, sev, msg}]
// Usage (CLI):    node tools/truth/oracle.cjs [--trips odd.json] [--corpus] [--show 6] [--warn rule,rule]
//                 --trips reads the file odd-trips.cjs --out writes; --corpus plans the saved test trips.
'use strict';
const R = 6371, rad = x => x * Math.PI / 180;
const hav = (a, b) => { const dl = rad(b.lat - a.lat), dg = rad(b.lng - a.lng); const h = Math.sin(dl / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dg / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const pos = x => x && isFinite(x.lat) && isFinite(x.lng) && !(x.lat === 0 && x.lng === 0);
const toMin = s => { if (typeof s === 'number') return s; const m = /^(\d{1,2}):(\d\d)/.exec(String(s || '')); return m ? +m[1] * 60 + +m[2] : NaN; };
const clk = m => { if (!isFinite(m)) return String(m); const d = Math.floor(m / 1440), r = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}${d > 0 ? ' (+' + d + ' day)' : d < 0 ? ' (day before)' : ''}`; };

// The least time anyone could need at the gate before it leaves (generous to the planner: real needs are larger).
const FLOOR = { flight: 60, train: 10, ship: 15, bus: 10, checkin: 30 };
// The least time to get off and out after arriving.
const OFF = { flight: 20, train: 5, ship: 15, bus: 5 };
const BAGS = 10;                          // collecting bags from storage or a hotel desk, at the very least
const FASTEST_KMH = 60;                   // straight line, no traffic, no waiting: no real ride is faster on average
const MAX_KMH = { walk: 6.5, taxi: 90, ride: 90, car: 90, bus: 90, metro: 90, tram: 90, transit: 300, train: 300, rail: 300, ferry: 80, boat: 80, lift: 60, funicular: 60, cable: 60 };
const fastest = km => km <= 0.05 ? 0 : Math.ceil(km / FASTEST_KMH * 60);
const kindOf = x => String(x.kind || x.mode || '').toLowerCase();

// The hard time to be at the gate on this day, read literally from what the traveler typed (minutes after the day's
// midnight). Ship days: all aboard after docking; earlier on the clock than docking is the next morning (that is how a
// ship's daily programme prints it, never ambiguous). Flights and trains: the time on the day's own date.
function deadline(d) {
  if (d.type === 'port') { let a = toMin(d.allAboard); if (!isFinite(a)) return null; if (isFinite(toMin(d.portArrive)) && a < toMin(d.portArrive)) a += 1440; return { at: a, mode: 'ship', need: FLOOR.ship, point: d.point }; }
  // Boarding day: the boarding time is an appointment (arriving at it is on time); the hard time is all aboard, and the
  // terminal's check-in closes before it (30 min at the very least).
  if (d.type === 'embark') { const a = toMin(d.allAboard); if (!isFinite(a)) return null; return { at: a, mode: 'ship', need: FLOOR.checkin, point: d.point }; }
  if (d.type === 'departure') { const a = toMin(d.time); if (!isFinite(a)) return null; const mode = FLOOR[d.mode] ? d.mode : 'flight'; return { at: a, mode, need: FLOOR[mode], point: d.point }; }
  return null;
}
// The earliest a traveler can be anywhere but the gate they arrive at.
function earliest(d) {
  if (d.type === 'port') { const a = toMin(d.portArrive); return isFinite(a) ? a + OFF.ship + (d.tender ? 15 : 0) : null; }
  if (d.type === 'arrival') { const a = toMin(d.time); return isFinite(a) ? a + (OFF[d.mode] || OFF.flight) : null; }
  if ((d.type === 'departure' || d.type === 'embark') && d.thru && isFinite(toMin(d.thru.time))) return toMin(d.thru.time) + (OFF[d.thru.mode] || OFF.flight);
  return null;
}

function checkDay(d, p, ctx) {
  const out = [], add = (rule, sev, msg) => out.push({ rule, sev, msg });
  if (!d || d.noShore || d.type === 'sea' || !p || p.error || !Array.isArray(p.items)) return out;
  const its = p.items, visits = its.filter(x => x.t === 'stop' || (x.t === 'meal' && !x.onBoard));
  const ends = x => x.at + (x.min || 0);
  // ---- clock: numbers and order (arithmetic only)
  let t = null;
  its.forEach(x => {
    if (x.at != null && !isFinite(x.at)) add('clock', 'S2', `${x.t} ${x.name || ''} at ${x.at}`);
    if (x.min != null && !isFinite(x.min)) add('clock', 'S2', `${x.t} ${x.name || ''} lasts ${x.min}`);
    if (x.at == null || !isFinite(x.at)) return;
    if (t != null && x.at < t - 1) add('clock', 'S2', `${x.name || x.t} at ${clk(x.at)}, before the item above it ends (${clk(t)})`);
    t = x.at + (x.min || 0) + (x.t === 'ride' ? (x.wait || 0) : 0);
  });
  // ---- physics + drift + absurd rides: a run of ride items between two places is one journey (walk to the pier, the
  // boat, the walk from the pier), so the speeds are judged on the whole run, the ends on its first and last leg.
  for (let k = 0; k < its.length; k++) {
    if (its[k].t !== 'ride' || (k && its[k - 1].t === 'ride')) continue;
    let j = k; while (j + 1 < its.length && its[j + 1].t === 'ride') j++;
    const legs = its.slice(k, j + 1), x = legs[0], y = legs[legs.length - 1];
    const a = its.slice(0, k).reverse().find(q => q.t !== 'ride' && pos(q)), z = its.slice(j + 1).find(q => q.t !== 'ride' && pos(q));
    if (!a || !z) continue;
    // A cable car or funicular step carries its own time; the ride to its far end is not a ride of its own.
    if (a.viaLift || z.viaLift || /cable car|funicular/i.test((a.name || '') + ' ' + (z.name || ''))) continue;
    const km = hav(a, z), kinds = legs.map(kindOf), min = legs.reduce((s, q) => s + (q.min || 0) + (q.wait || 0), 0);
    const vmax = Math.max(...kinds.map(q => MAX_KMH[q] || 300)), what = [...new Set(kinds)].join(' + ');
    if (km > 0.15 && min <= 0) add('physics', 'S2', `${a.name} to ${z.name}: ${km.toFixed(2)} km apart, ride of 0 min`);
    else if (km > 0.3 && min > 0 && km / (min / 60) > vmax * 1.05) add('physics', 'S2', `${what} ${min} min for ${km.toFixed(1)} km straight-line between ${a.name} and ${z.name} (${Math.round(km / (min / 60))} km/h, more than ${vmax})`);
    if (pos(x.from) && hav(x.from, a) > 0.3) add('drift', 'S2', `ride after ${a.name} starts ${hav(x.from, a).toFixed(1)} km from it`);
    if (pos(y.to) && hav(y.to, z) > 0.3) add('drift', 'S2', `ride to ${z.name} ends ${hav(y.to, z).toFixed(1)} km from it`);
    const road = km * 1.4 / 25 * 60 + 10; // a slow city taxi
    if (km > 1 && min > 3 * road && min - road > 45 && !kinds.some(q => /ferry|boat/.test(q))) add('slowride', 'S2', `${what} ${min} min for ${km.toFixed(1)} km (${a.name} to ${z.name}); a taxi needs about ${Math.round(road)}`);
  }
  // ---- before: nothing before the traveler can be there
  const e0 = earliest(d), st = toMin(d.startTime);
  visits.forEach(x => {
    if (e0 != null && x.at < e0 - 1) add('before', 'S1', `${x.name} at ${clk(x.at)}, but the ${d.type === 'port' ? 'ship docks' : (d.thru ? d.thru.mode : d.mode) + ' arrives'} ${clk(e0 - (d.type === 'port' ? OFF.ship + (d.tender ? 15 : 0) : OFF[(d.thru || d).mode] || OFF.flight))}`);
  });
  if (d.type === 'land' && isFinite(st)) visits.forEach(x => { if (x.at < st - 1) add('before', 'S1', `${x.name} at ${clk(x.at)}, before the day's start ${clk(st)}`); });
  // ---- the gate
  const D = deadline(d);
  if (!D) return out;
  const G = pos(D.point) ? D.point : (its.slice().reverse().find(y => y.t === 'end' && pos(y)) || null);
  const lastBy = D.at - D.need; // the latest anyone could arrive at the gate
  // night: a small-hours departure typed on a day the plan fills, read as the next night by the plan
  if (d.type === 'departure' && D.at < 5 * 60 && visits.length && !d.nightOf) {
    const after = visits.filter(x => x.at > D.at);
    if (after.length) add('night', 'S1', `departure typed ${clk(D.at)} on ${d.date || 'this day'}; the plan visits ${after.length} place(s) after it (${after[0].name} at ${clk(after[0].at)}), taking it as the next night without asking`);
  }
  // literal reading for the rest, unless the night question was answered as "the next night"
  const lastAt = lastBy;
  const smallHours = d.type === 'departure' && D.at < 5 * 60;
  if (!smallHours) {
    // The plan's own arrival at the gate.
    const endIt = its.slice().reverse().find(y => y.t === 'end' && Number.isFinite(y.at));
    if (endIt && endIt.at > lastAt) add('gone', 'S1', `the plan reaches ${endIt.name || 'the ' + D.mode} at ${clk(endIt.at)}; the ${D.mode} leaves ${clk(D.at)} (be there by ${clk(lastAt)} at the very least)`);
    visits.forEach(x => { if (ends(x) > lastAt) add('gone', 'S1', `${x.name} ends ${clk(ends(x))}; the ${D.mode} leaves ${clk(D.at)} (be there by ${clk(lastAt)} at the very least)`); });
    if (G) {
      const last = visits.slice().sort((a, b) => ends(b) - ends(a))[0];
      const bagsAt = its.find(x => /collect (your )?bags|bags from storage/i.test(x.name || '') && pos(x));
      const via = (from) => bagsAt && ends(last || { at: -1e9 }) <= bagsAt.at + 1 ? fastest(hav(from, bagsAt)) + BAGS + fastest(hav(bagsAt, G)) : fastest(hav(from, G));
      if (last && pos(last)) { const need = ends(last) + via(last); if (need > lastAt) add('reach', 'S1', `from ${last.name} (ends ${clk(ends(last))}) even the fastest ride${bagsAt ? ' via the bags' : ''} reaches the ${D.mode} at ${clk(need)}, after ${clk(lastAt)}`); }
      // What the screen shows as "leave <last place> by" (live.js: leaveAt.last when known, else leaveAt.out).
      const lv = p.leaveAt ? (Number.isFinite(p.leaveAt.last) ? p.leaveAt.last : Number.isFinite(p.leaveAt.out) ? p.leaveAt.out : null) : null;
      if (lv != null && last && pos(last)) { const need = lv + via(last); if (need > lastAt) add('leaveby', 'S1', `the screen says leave ${last.name} by ${clk(lv)}; even the fastest way${bagsAt ? ' via the bags' : ''} then reaches the ${D.mode} at ${clk(need)}, after ${clk(lastAt)}`); }
      // The two leave-by times on screen must agree with the steps between them: leaving the last place at the time shown,
      // the plan's own rides and steps up to collecting the bags must still be done by the time to leave for the gate.
      const loT = p.leaveAt && Number.isFinite(p.leaveAt.out) ? p.leaveAt.out : null;
      if (lv != null && loT != null && bagsAt && last && ends(last) <= bagsAt.at + 1) {
        const i0 = its.indexOf(last), i1 = its.indexOf(bagsAt), between = its.slice(i0 + 1, i1 + 1).reduce((m, x) => m + (x.min || 0) + (x.wait || 0), 0);
        if (lv + between > loT + 1) add('leaveby', 'S1', `the screen says leave ${last.name} by ${clk(lv)}; the ${between} min to the bags and collecting them then end at ${clk(lv + between)}, after the time to leave for the ${D.mode} (${clk(loT)})`);
      }
      const lo = loT;
      if (lo != null) { const from = bagsAt && lo >= bagsAt.at ? bagsAt : (last && pos(last) ? last : null); if (from) { const need = lo + fastest(hav(from, G)); if (need > lastAt) add('leaveby', 'S1', `the screen says leave for the ${D.mode} by ${clk(lo)}; even the fastest ride gets there at ${clk(need)}, after ${clk(lastAt)}`); } }
    }
  }
  return out;
}

function loadEngine(src) {
  const fs = require('fs'), path = require('path'), vm = require('vm');
  const ctx = vm.createContext({ console, Date, Math, JSON, Object, Array, Map, Set, Number, String, isFinite, isNaN, NaN, Infinity });
  for (const sub of ['engine', 'engine-data']) { const dir = path.join(src, sub); if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f }); }
  return vm.runInContext('KEngine', ctx);
}
module.exports = { checkDay, hav, clk, FLOOR, loadEngine };

// ---- CLI
if (require.main === module) {
  const fs = require('fs'), path = require('path');
  const arg = (k, dflt) => { const i = process.argv.indexOf('--' + k); return i > 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : dflt; };
  // ENGINE_SRC=<dir with engine/ and engine-data/>: replay an older build's engine (what would this check have said?)
  const E = require('../beta2/engine.cjs'), PD = path.join(__dirname, '..', 'places', 'data'), places = {};
  if (fs.existsSync(PD)) for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; }
  const trips = [];
  if (arg('trips')) for (const t of JSON.parse(fs.readFileSync(arg('trips')))) trips.push({ name: t.name, b: t.bucket });
  if (arg('corpus') || !arg('trips')) { const dir = process.env.SNAP_DIR || path.join(__dirname, '..', 'beta2', 'corpus'); for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) trips.push({ name: f.replace(/\.json$/, ''), b: JSON.parse(fs.readFileSync(path.join(dir, f))) }); }
  const found = {}, ex = {}, SHOW = +arg('show', 6), WARN = String(arg('warn', '') || '').split(',').filter(Boolean);
  let days = 0, planned = 0;
  for (const { name, b } of trips) {
    let plans; try { plans = E.planTrip(E.applyPlaces(b, places)); } catch (e) { (found.error = (found.error || 0) + 1); (ex.error = ex.error || []).push(name + ': ' + e.message); continue; }
    b.days.forEach((d, i) => { days++; const p = plans[i]; if (p && p.items) planned++;
      for (const f of checkDay(d, p)) { const k = f.rule; found[k] = (found[k] || 0) + 1; (ex[k] = ex[k] || []).push(`${f.sev} ${name} day ${i + 1} ${d.type}${d.mode && /arrival|departure/.test(d.type) ? '/' + d.mode : ''} ${d.city || ''}: ${f.msg}`); } });
  }
  console.log(`Independent safety check: ${trips.length} trips, ${days} days, ${planned} planned`);
  const order = ['error', 'gone', 'reach', 'leaveby', 'before', 'night', 'physics', 'clock', 'drift', 'slowride'];
  for (const k of order) { const n = found[k] || 0; console.log(`${n ? (WARN.includes(k) ? 'WARN' : 'FAIL') : 'ok  '} ${k.padEnd(9)} ${n}`); (ex[k] || []).slice(0, SHOW).forEach(e => console.log('       ' + e)); }
  if (process.env.ALL) fs.writeFileSync(process.env.ALL, JSON.stringify(ex, null, 1));
  process.exitCode = order.some(k => found[k] && !WARN.includes(k)) ? 1 : 0;
}
