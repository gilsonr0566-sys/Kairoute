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
//   S1 unverified the way back to the flight, train or ship rests on a ride with no timetable behind it, and the plan marks
//                it as resting on timetables, or a train, bus or boat on it says nothing of the missing timetable
//   S1 water     a stop across the water (an island, a place the guide says is reached by boat, a place the map puts
//                across the water) reached with no boat since the town's side, or a town stop reached from it without a
//                boat back: a walk or taxi to an island (Nov 18 "ferries that drive on land"; Lokrum as a 16 min taxi)
//   S2 about     the same for a city metro, tram or bus on the way back (it runs often; its time must still read "about")
//   S2 physics   a ride faster than its kind can move in a straight line (walk 6.5 km/h, taxi, bus 90, metro 90, train
//                300, ferry 80), or no time at all between two places apart
//   S2 clock     the clock runs backwards, or a time that is not a number
//   S2 drift     a ride's two ends are not the places before and after it (the ride says one place, the card another)
//   S2 slowride  a ride more than 3 times the road time a taxi would need and more than 45 min over it (absurd)
//   S2 lunchshut a lunch at a place to eat whose own map opening hours (the raw OpenStreetMap text, read with the free
//                opening_hours library, never the planner's reader) say it is shut when lunch starts, or open for less than
//                20 min of it, on the day's date. A place whose hours are not on the map is not judged (unknown).
//   S2 lunchlate a lunch at a place to eat starting after 3:30 pm (an hour past the usual last orders)
// Usage (module): require('./oracle.cjs').checkDay(day, plan, ctx) -> [{rule, sev, msg}]
// Usage (CLI):    node tools/truth/oracle.cjs [--trips odd.json] [--corpus] [--show 6] [--warn rule,rule  (S2 rules only; an S1 rule is refused)]
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

// Lunch, judged from the raw map data with a reader the planner doesn't use (Richard's testing directive, Nov 23: a check
// must not agree with the planner just because it reads the planner's numbers). The opening_hours library is installed
// by the gate; without it the rule says NOT TESTED instead of passing.
let OHLib = null; try { OHLib = require('opening_hours'); } catch (e) { OHLib = null; }
const STOP = /\b(the|restaurant|ristorante|restaurante|trattoria|taverna|cafe|bar|and)\b/g;
const nameKey = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(STOP, ' ').replace(/\s+/g, ' ').trim();
const sameName = (a, b) => { a = nameKey(a); b = nameKey(b); return !!a && !!b && (a === b || (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a)))); };
function rawHours(x, P) {
  if (!P || !pos(x)) return null;
  const rows = [].concat((P.eatHours || []).map(e => ({ name: e[0], lat: e[1], lng: e[2], hours: e[3] })), (P.cityEats || []).map(e => ({ name: e.name, lat: e.lat, lng: e.lng, hours: e.hours })));
  const hit = rows.filter(r => r.hours && pos(r) && hav(x, r) <= 0.2 && sameName(r.name, x.name)).sort((a, b) => hav(x, a) - hav(x, b))[0];
  return hit ? hit.hours : null;
}
const lunchUntested = { n: 0 };
function lunchRules(d, its, ctx, add) {
  const meals = its.filter(x => x.t === 'meal' && (x.meal || 'Lunch') === 'Lunch' && !x.packed && !x.onBoard && !x.booked && !x.chosen && Number.isFinite(x.at));
  for (const x of meals) {
    if (x.at > 15 * 60 + 30) add('lunchlate', 'S2', `lunch at ${x.name} starts ${clk(x.at)}, more than an hour past the usual last orders`);
    const P = ctx && ctx.places, h = rawHours(x, P); if (!h || !d.date) continue;
    if (!OHLib) { lunchUntested.n++; continue; }
    let oh; try { oh = new OHLib(h, { lat: x.lat, lon: x.lng, address: { country_code: '', state: '' } }, { mode: 0 }); } catch (e) { continue; } // hours the library can't read: unknown
    const [Y, M, D] = d.date.split('-').map(Number), at = m => new Date(Y, M - 1, D, Math.floor(m / 60), m % 60);
    let start; try { start = oh.getState(at(x.at)); } catch (e) { continue; }
    let openMin = 0; const len = Math.max(1, x.min || 0); for (let m = x.at; m < x.at + len; m += 5) { try { if (oh.getState(at(m))) openMin += Math.min(5, x.at + len - m); } catch (e) {} }
    if (!start || openMin < Math.min(20, len)) add('lunchshut', 'S2', `lunch at ${x.name} ${clk(x.at)}-${clk(x.at + len)} on ${d.date}: its map hours "${h}" say ${start ? 'open only ' + openMin + ' min of it' : 'shut when it starts'}`);
  }
}

function checkDay(d, p, ctx) {
  const out = [], add = (rule, sev, msg) => out.push({ rule, sev, msg });
  if (!d || d.noShore || d.type === 'sea' || !p || p.error || !Array.isArray(p.items)) return out;
  const its = p.items, visits = its.filter(x => x.t === 'stop' || (x.t === 'meal' && !x.onBoard));
  const ends = x => x.at + (x.min || 0);
  // ---- lunch: open when it starts, by its own raw map hours (ctx.places: the place's raw places file)
  lunchRules(d, its, ctx, add);
  // ---- clock: numbers and order (arithmetic only)
  let t = null;
  its.forEach(x => {
    if (x.at != null && !isFinite(x.at)) add('clock', 'S2', `${x.t} ${x.name || ''} at ${x.at}`);
    if (x.min != null && !isFinite(x.min)) add('clock', 'S2', `${x.t} ${x.name || ''} lasts ${x.min}`);
    if (x.at == null || !isFinite(x.at)) return;
    if (t != null && x.at < t - 1) add('clock', 'S2', `${x.name || x.t} at ${clk(x.at)}, before the item above it ends (${clk(t)})`);
    t = x.at + (x.min || 0) + (x.t === 'ride' ? (x.wait || 0) : 0);
  });
  // ---- water: the day starts on the town's side of the water; a run of rides with a boat (ferry, tender, cable car) in it
  // crosses to the other side and back. A stop the place's own facts put across the water (ctx.wet) must be on the far
  // side when it is reached, and a stop that is not must be on the town's side: a walk or taxi to an island fails.
  if (ctx && ctx.wet) { let away = false, run = [];
    const BOAT = /ferry|boat|water ?taxi|sea ?bus|hydrofoil|catamaran/i; // a tender (ship to shore) and a cable car land on the town's side
    for (const x of its) { if (x.t === 'ride') { run.push(x); continue; }
      if (run.some(q => BOAT.test(kindOf(q) + ' ' + (q.how || '') + ' ' + (q.name || '')))) away = !away;
      if (x.t === 'stop' && x.id) { const w = ctx.wet(x); if (w !== away) add('water', 'S1', `${x.name} is ${w ? 'across the water' : 'on the town\'s side'}, but the plan reaches it by ${run.length ? run.map(q => kindOf(q) + ' ' + (q.min || 0) + ' min').join(' + ') : 'no ride'}${w ? ' with no boat' : ' without crossing back'}`); away = w; }
      run = []; } }
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
    // Spare time the plan holds on the way back (x.slack, said on the card as "includes N min spare") is not ride time.
    const road = km * 1.4 / 25 * 60 + 10, rideOnly = min - legs.reduce((s2, q) => s2 + (q.slack || 0), 0); // a slow city taxi
    if (km > 1 && rideOnly > 3 * road && rideOnly - road > 45 && min - road > 45 && !kinds.some(q => /ferry|boat/.test(q))) add('slowride', 'S2', `${what} ${rideOnly} min (spare left out) for ${km.toFixed(1)} km (${a.name} to ${z.name}); a taxi needs about ${Math.round(road)}`);
  }
  // ---- unverified: the way back to the gate (every ride after the last stop or meal) rests on a timetable, or it is never
  // shown as sure (Richard, Nov 23 release target: "unverified return connections presented as confirmed: 0").
  const D0 = deadline(d);
  if (D0) {
    const lastVisit = its.reduce((a, x, j) => (x.t === 'stop' || (x.t === 'meal' && !x.onBoard)) ? j : a, -1);
    const back = its.slice(lastVisit + 1).filter(x => x.t === 'ride' && x.mode !== 'lift' && x.mode !== 'walk' && !/walk|lift/.test(kindOf(x)) && (x.min || 0) > 0);
    const unsure = back.filter(x => x.source !== 'timetable');
    const said = x => /no timetable|not confirmed|estimate|about|check the timetable|no sailing times|not known/i.test([x.note, x.how, ...(x.steps || [])].join(' '));
    if (unsure.length && p.leaveAt && p.leaveAt.basis === 'timetable') add('unverified', 'S1', `the way back is marked as resting on timetables, but ${unsure.map(x => kindOf(x) + ' (' + (x.source || 'no source') + ')').join(', ')} has none`);
    // A boat or train that must be caught: S1. A city metro, tram or bus (runs every few minutes): S2, its time still says "about".
    unsure.filter(x => /ferry|boat|train|rail/.test(kindOf(x)) && !said(x)).forEach(x => add('unverified', 'S1', `the ${kindOf(x)} back (${x.min} min, source ${x.source || 'none'}) has no timetable behind it and nothing on it says so`));
    // (A ride with ride choices shows "about N min" on its chip when no timetable confirms it, zz-engine2 est: only a ride
    // with a single way has no such chip.)
    unsure.filter(x => /bus|metro|tram|transit/.test(kindOf(x)) && !said(x) && !((x.options || []).length > 1)).forEach(x => add('about', 'S2', `the ${kindOf(x)} back (${x.min} min, from the ${x.source || 'no source'}) has no timetable behind it and nothing on it says it is an estimate`));
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
  // backwait: on a day with a time to be back, every ride after the last visit (to the bags, to the gate) on a line with
  // no timetable carries at least the full gap between departures as its wait (Rides thread, Nov 23: a ride out may plan
  // half the gap; the way back never). Read from the helper's own answer on the ride: how often it runs.
  { const lastV = visits.slice().sort((a, b) => ends(b) - ends(a))[0], i0 = lastV ? its.indexOf(lastV) : -1;
    its.slice(i0 + 1).forEach(x => { const a = x.t === 'ride' && x.ans; if (!a || !a.noTimetable || !(+a.every > 0) || (Array.isArray(a.deps) && a.deps.length)) return;
      const gap = Math.min(+a.every, 60); if (!(+a.wait >= gap)) add('backwait', 'S1', `the ${x.kind || 'ride'} back (${a.label || ''}) has no timetable and runs about every ${a.every} min, but plans ${a.wait} min of waiting: the way back must allow the full gap`); }); }
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
  // --warn rule,rule lists a known finding without failing the run. It is allowed ONLY for S2 rules (wrong on screen).
  // An S1 rule (could miss a flight, train or ship) can never be warned: asking for it is refused and the rule still
  // fails (Richard, Nov 23: "the S1 warning exception is a serious design flaw"). A safety finding always blocks.
  const S1 = ['error', 'gone', 'reach', 'leaveby', 'before', 'night', 'unverified', 'backwait', 'water'];
  const asked = String(arg('warn', '') || '').split(',').filter(Boolean), refused = asked.filter(k => S1.includes(k)), WARN = asked.filter(k => !S1.includes(k));
  if (refused.length) console.log(`REFUSED --warn ${refused.join(',')}: S1 safety rules always fail the run; no warn-only path`);
  const found = {}, ex = {}, SHOW = +arg('show', 6);
  // --no-timetable: every ride of 1.5 km or more is also answered as a train with no published timetable, only how often
  // it runs (every 60 min, the full gap plus boarding as the helper sends it), so the rules about such rides are tested
  // offline (the saved trips hold few of them).
  const NOTT = arg('no-timetable') ? (a, z) => { const km = hav(a, z); if (!(km >= 1.5)) return []; const ride = Math.round(km / 40 * 60) + 5, wait = 63;
    return [{ id: 'rail|T', label: 'Train T', mode: 'train', kind: 'Train', steps: ['T'], ride, wait, every: 60, everySrc: 'usual', noTimetable: true, min: 5 + wait + ride + 8, access: { how: 'walk', min: 5, km: 0.4 }, egress: { how: 'walk', min: 8, km: 0.6 } }]; } : null;
  // Which stops are across the water, from the place's own facts (the guide's "by boat" note, a place reachable only by
  // water, the map's island check), never from the ride the planner chose. A stop with no id (the ship, the hotel) is
  // where the day starts, so it counts as on the same side as the town.
  const wetOf = (bb, d) => { const c = (bb.cities || {})[d.city] || {}, ids = {}; [].concat(c.sites || [], c.farther || []).forEach(s => { ids[s.id] = !!(s.acrossWater || E.byBoat(s.travelNote) || E.waterOnly(s)); });
    return x => !!(x && x.id && ids[x.id]); };
  let days = 0, planned = 0;
  for (const { name, b } of trips) {
    let plans, bb; try { bb = E.applyPlaces(b, places); if (NOTT) bb.answers = NOTT; plans = E.planTrip(bb); } catch (e) { (found.error = (found.error || 0) + 1); (ex.error = ex.error || []).push(name + ': ' + e.message); continue; }
    b.days.forEach((d, i) => { days++; const p = plans[i]; if (p && p.items) planned++;
      for (const f of checkDay(d, p, { places: places[d.city], wet: wetOf(bb, d) })) { const k = f.rule; found[k] = (found[k] || 0) + 1; (ex[k] = ex[k] || []).push(`${f.sev} ${name} day ${i + 1} ${d.type}${d.mode && /arrival|departure/.test(d.type) ? '/' + d.mode : ''} ${d.city || ''}: ${f.msg}`); } });
  }
  console.log(`Independent safety check: ${trips.length} trips, ${days} days, ${planned} planned`);
  const order = ['error', 'gone', 'reach', 'leaveby', 'before', 'night', 'unverified', 'backwait', 'water', 'about', 'physics', 'clock', 'drift', 'slowride', 'lunchshut', 'lunchlate'];
  for (const k of order) { const n = found[k] || 0; console.log(`${n ? (WARN.includes(k) ? 'WARN' : 'FAIL') : 'ok  '} ${k.padEnd(9)} ${n}`); (ex[k] || []).slice(0, SHOW).forEach(e => console.log('       ' + e)); }
  if (lunchUntested.n) { console.log(`NOT TESTED lunchshut: ${lunchUntested.n} lunches with map hours not judged (the opening_hours library is not installed: npm i --no-save opening_hours@3.16.0)`); }
  if (process.env.ALL) fs.writeFileSync(process.env.ALL, JSON.stringify(ex, null, 1));
  process.exitCode = order.some(k => found[k] && !WARN.includes(k)) || lunchUntested.n || refused.length ? 1 : 0;
}
