// Odd trips (Nov 22 2026, Richard: "Lets find all the ways we can to make the app 100%... Check everything every
// different way"). Makes hundreds of unusual trips from the places the test trips already know (big cities, small towns,
// islands, remote ports) and plans every day with the Beta 2 engine. No AI, no network, same seed = same trips.
//
// What is varied (each trip mixes several):
//   - port calls: short (2-4 h), late (ashore after 17:00), all aboard after midnight, early dawn calls, tender ports,
//     overnight stays (all aboard the next morning)
//   - flights and trains in and out around midnight (00:15, 23:50), very early and very late, bag-storage days (off a ship,
//     plane or train and leaving the same day), embarkation after a flight in
//   - hours to sightsee Light (2.5), Half (4), Full (8) and a long 10, early and late starts on stay days
//   - multi-city trips (arrive, stay, train on, arrive, fly home), cruises (embark, ports, sea, off the ship)
//   - edits: picks ticked, unticked, emptied, every sight ticked, reversed and shuffled orders, walks little / a lot,
//     lunch booked, lunch skipped, group trips (a meeting time ends the day)
//   - dates across the clock changes (Europe and US spring and autumn)
// What is checked on every day planned (the core exit criteria, as the engine gives them to the screen):
//   error      the engine threw or gave a day no reason
//   nan        a time that is not a number
//   back       on a ship, train or plane day: a stop or meal ending after the time to be back, or the day back late
//   leaveby    the leave-by time before the last stop or meal ends, or later than the back-by less the ride back
//   order      the clock runs backwards (an item starts before the one before it ends)
//   start      sightseeing before the day's own start (before the ship docks, the flight lands, the hotel is left)
//   lunch      a day over lunchtime with places to eat and no timed lunch and nothing said
//   lunchtime  lunch starting outside its hours (before 11:00 or more than MEAL_LATE after last orders)
//   shut       a meal at a place shut then; a stop reached after its last entry
//   walk       a ride slower than walking the same way (more than 5 min slower, under 3 km)
//   zero       a ride of no time between places apart
//   twice      the same sight planned on two days of one trip
//   pick       a traveler's pick left out with nothing said
//   untrue     a note that names a sight as left out while the plan visits it, or a "leave by" in the notes that isn't
//              the plan's own leave-by
//   slow       a whole trip taking over 2.5 s to plan here (a phone is about 4 times slower)
//   zigzag     an order that crosses back and forth when moving one stop keeps everything and rides a fifth less
// Usage: node tools/beta2/odd-trips.cjs [--n 400] [--seed 1] [--out file.json] [--only rule,rule] [--show 5]
const fs = require('fs'), path = require('path'), E = require('./engine.cjs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SLOW_MS = +(process.env.SLOW_MS || 2500), N = +arg('n', 400), SEED = +arg('seed', 1), SHOW = +arg('show', 4), ONLY = (arg('only', '') || '').split(',').filter(Boolean);
const dir = process.env.SNAP_DIR || path.join(__dirname, 'corpus'), PD = path.join(__dirname, '..', 'places', 'data');
const places = {}; if (fs.existsSync(PD)) for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; }
let rs = SEED >>> 0 || 1; const rnd = () => { rs ^= rs << 13; rs >>>= 0; rs ^= rs >> 17; rs ^= rs << 5; rs >>>= 0; return rs / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)], chance = p => rnd() < p, clone = o => JSON.parse(JSON.stringify(o));
const hm = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

// ---- The places the test trips know: each city's guide, a day of facts to copy, its port, a hotel spot.
const bases = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => ({ f, b: JSON.parse(fs.readFileSync(path.join(dir, f))) }));
const cities = {};
for (const { f, b } of bases) for (const d of b.days) { if (!d.city || !b.cities[d.city]) continue;
  const c = cities[d.city] = cities[d.city] || { key: d.city, guide: b.cities[d.city], prefs: b.prefs, legModes: b.legModes, style: b.style, from: f, days: [] };
  c.days.push(d); if (d.type === 'port' || d.type === 'embark' || (d.type === 'arrival' && d.mode === 'ship')) c.port = c.port || d.point;
  if (d.lodging && !d.lodging.unknown) c.hotel = c.hotel || d.lodging; c.country = c.country || d.country; }
const centre = c => { const s = (c.guide.sites || []).filter(x => isFinite(x.lat)); if (!s.length) return null; const lat = s.map(x => x.lat).sort((a, b) => a - b), lng = s.map(x => x.lng).sort((a, b) => a - b);
  return { lat: lat[lat.length >> 1], lng: lng[lng.length >> 1] }; };
const keys = Object.keys(cities).filter(k => centre(cities[k]));
for (const k of keys) { const c = cities[k], m = centre(c);
  c.hotel = c.hotel || { id: null, name: 'Hotel in the centre', lat: m.lat + 0.002, lng: m.lng + 0.002, unknown: false, ask: null };
  c.station = { id: null, name: 'Central station', lat: m.lat - 0.01, lng: m.lng + 0.008, unknown: false, ask: null };
  c.airport = { id: null, name: 'International airport', lat: m.lat + 0.12, lng: m.lng - 0.1, unknown: false, ask: null };
  c.kind = c.port ? ((c.guide.sites || []).length < 12 ? 'island or small port' : 'port city') : (c.guide.sites || []).length < 15 ? 'small town' : 'big city'; }

// A day of one city, from that city's own saved facts (hours, places to eat), as a new type.
const day = (c, type, o) => { const t = clone(c.days.find(d => d.type === type) || c.days.find(d => d.type !== 'sea') || c.days[0]);
  return Object.assign(t, { type, city: c.key, noShore: false, through: false, thru: null, lodging: c.hotel, selected: null, mine: [], order: null, cleared: false,
    timeGuess: false, lastDay: false, stayGuess: false, booked: [], mealPrefs: null, mealAt: null, locked: null, meet: null, wantsOnly: false, own: false, boardAt: null }, o || {}); };
const sea = () => ({ type: 'sea', noShore: true, city: null, mode: 'flight', sites: {}, eats: {}, missing: [] });
const PORTS = keys.filter(k => cities[k].port), ANY = keys;
const DATES = ['2027-03-26', '2027-10-29', '2027-03-12', '2027-11-05', '2027-06-30', '2027-01-11', '2027-08-14', '2027-12-30'];
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// Port call shapes: [docks, all aboard] in minutes.
const portCall = () => pick([[7 * 60, 11 * 60], [8 * 60, 12 * 60 + 30], [6 * 60, 9 * 60 + 30], [13 * 60, 17 * 60], [17 * 60, 23 * 60 + 30],
  [18 * 60, 30], [19 * 60, 2 * 60], [7 * 60, 16 * 60], [8 * 60, 18 * 60], [10 * 60, 23 * 60 + 59], [12 * 60, 20 * 60], [6 * 60 + 30, 13 * 60], [14 * 60, 19 * 60]]);
const hours = () => pick([2.5, 4, 8, 8, 10]);
const shapes = {
  cruise: () => { const home = cities[pick(ANY)], out = []; const t0 = pick([[11 * 60, 17 * 60], [13 * 60, 16 * 60 + 30], [9 * 60, 15 * 60], [16 * 60, 21 * 60]]);
    if (chance(0.5)) out.push(day(home, 'arrival', { mode: 'flight', point: home.airport, time: hm(pick([30, 6 * 60, 10 * 60 + 30, 15 * 60, 21 * 60, 23 * 60 + 40])), hours: hours() }));
    const thru = chance(0.4) ? { mode: pick(['flight', 'train']), time: hm(pick([6 * 60, 7 * 60 + 30, 9 * 60, 10 * 60 + 30, 12 * 60])), point: home.airport } : null;
    if (thru && thru.mode === 'train') thru.point = home.station;
    out.push(day(home, 'embark', { point: home.port || home.station, allAboard: t0[1], boardAt: chance(0.5) ? t0[0] : null, startTime: hm(pick([8 * 60, 9 * 60, 10 * 60])), thru, noBags: chance(0.15) }));
    for (let k = 0, n = 2 + Math.floor(rnd() * 4); k < n; k++) { if (chance(0.2)) { out.push(sea()); continue; } const c = cities[pick(PORTS)], [a, b] = portCall();
      out.push(day(c, 'port', { point: c.port, portArrive: a, allAboard: b, tender: chance(0.3) }));
      if (chance(0.12)) { const d2 = day(c, 'port', { point: c.port, portArrive: 6 * 60, allAboard: pick([13 * 60, 17 * 60, 2 * 60]), tender: false }); out.push(d2); } }
    const end = cities[pick(ANY)]; out.push(day(end, 'arrival', { mode: 'ship', point: end.port || end.station, time: hm(pick([6 * 60, 7 * 60, 8 * 60 + 30])), hours: hours() }));
    if (chance(0.5)) out.push(day(end, 'departure', { mode: 'flight', point: end.airport, time: hm(pick([30, 6 * 60 + 15, 11 * 60, 14 * 60, 18 * 60 + 40, 23 * 60 + 55])) }));
    else out[out.length - 1] = day(end, 'departure', { mode: pick(['flight', 'train']), point: end.airport, time: hm(pick([13 * 60, 15 * 60 + 30, 19 * 60, 23 * 60 + 30])), thru: { mode: 'ship', time: hm(pick([6 * 60, 7 * 60, 8 * 60])), point: end.port || end.station } });
    return out; },
  multicity: () => { const out = []; const n = 2 + Math.floor(rnd() * 2), cs = []; while (cs.length < n) { const k = pick(ANY); if (!cs.includes(k)) cs.push(k); }
    cs.forEach((k, j) => { const c = cities[k];
      const inMode = j ? pick(['train', 'flight', 'train']) : 'flight', gate = m => m === 'train' ? c.station : c.airport;
      out.push(day(c, 'arrival', { mode: inMode, point: gate(inMode), time: hm(pick([15, 5 * 60 + 40, 8 * 60, 12 * 60 + 30, 16 * 60, 20 * 60, 23 * 60 + 50])), hours: hours() }));
      for (let s = 0, m = Math.floor(rnd() * 3); s < m; s++) out.push(day(c, 'land', { startTime: hm(pick([6 * 60, 7 * 60 + 30, 9 * 60, 11 * 60, 14 * 60, 17 * 60])), hours: hours(), returnToStart: chance(0.85) }));
      const outMode = j < n - 1 ? pick(['train', 'flight']) : 'flight';
      out.push(day(c, 'departure', { mode: outMode, point: gate(outMode), time: hm(pick([20, 6 * 60, 9 * 60 + 30, 13 * 60, 17 * 60 + 45, 22 * 60, 23 * 60 + 59])), startTime: hm(pick([7 * 60, 9 * 60])), noBags: chance(0.1),
        toOther: outMode === 'train', country: c.country || '', toCountry: outMode === 'train' ? (cities[cs[j + 1]] || c).country || '' : '' })); });
    return out; },
  // A same-day hop: off a ship, plane or train in the morning and away again that day, bags stored between.
  hop: () => { const c = cities[pick(ANY)], am = pick(['flight', 'train', 'ship']), out = pick(['flight', 'train']);
    const ap = am === 'ship' ? c.port || c.station : am === 'train' ? c.station : c.airport;
    return [day(c, 'departure', { mode: out, point: out === 'train' ? c.station : c.airport, time: hm(pick([11 * 60, 13 * 60, 15 * 60, 18 * 60, 21 * 60, 23 * 60 + 45, 45])),
      thru: { mode: am, time: hm(pick([5 * 60, 6 * 60 + 30, 8 * 60, 9 * 60 + 15, 11 * 60])), point: ap }, noBags: chance(0.1), toOther: out === 'train', country: c.country || '', toCountry: c.country || '' })]; },
  stay: () => { const c = cities[pick(ANY)], out = []; for (let k = 0, n = 2 + Math.floor(rnd() * 4); k < n; k++) out.push(day(c, 'land', { startTime: hm(pick([5 * 60 + 30, 7 * 60, 8 * 60 + 30, 9 * 60, 10 * 60, 13 * 60, 15 * 60 + 30, 18 * 60])), hours: hours(), returnToStart: chance(0.8) }));
    return out; },
};
// Edits a traveler makes, on one day.
const edit = (b, d) => { const c = b.cities[d.city]; if (!c) return 'none'; const ids = (c.sites || []).map(s => String(s.id)), far = (c.farther || []).map(s => String(s.id));
  const r = rnd();
  if (r < 0.12) { d.selected = []; d.cleared = true; return 'emptied'; }
  if (r < 0.24) { d.selected = ids.slice(); return 'every sight ticked'; }
  if (r < 0.40) { const s = ids.filter(() => chance(0.3)).slice(0, 6); d.selected = s; return 'some ticked'; }
  if (r < 0.50) { const s = ids.filter(() => chance(0.35)).slice(0, 5); d.selected = s; d.order = s.slice().reverse(); return 'own order (reversed)'; }
  if (r < 0.58 && far.length) { d.selected = [pick(far)].concat(ids.filter(() => chance(0.2)).slice(0, 2)); return 'trip out ticked'; }
  if (r < 0.64) { d.mealPrefs = { Lunch: { skip: true } }; return 'lunch skipped'; }
  if (r < 0.70) { d.meet = true; return 'group trip'; }
  return 'as the app picks'; };

const bucketOf = (shape, days) => { const cs = {}, used = days.filter(d => d.city).map(d => d.city);
  used.forEach(k => { cs[k] = clone(cities[k].guide); }); const first = cities[used[0]] || {};
  const date = pick(DATES); days.forEach((d, j) => { d.i = j; d.id = 'o' + j; d.date = addDays(date, j - (shape === 'hop' ? 0 : 0)); });
  // A train to the next city leaves the day that city's arrival is (same date): pairs of departure + arrival share a date.
  for (let j = 1; j < days.length; j++) if (days[j].type === 'arrival' && days[j - 1].type === 'departure' && days[j].mode !== 'ship') days[j].date = days[j - 1].date;
  for (let j = 1; j < days.length; j++) if (days[j].date < days[j - 1].date) days[j].date = days[j - 1].date;
  days[days.length - 1].lastDay = true;
  return { v: 1, complete: true, today: '2026-11-22', prefs: Object.assign({ pace: 'moderate', walk: 'medium', interests: [], party: 2, access: 'none' }, first.prefs || {}), style: 'mix', legModes: {}, cities: cs, days, old: [] }; };

// ---- Checks
const out = {}, examples = {}, add = (k, trip, m) => { if (ONLY.length && !ONLY.includes(k)) return; out[k] = (out[k] || 0) + 1; (examples[k] = examples[k] || []).length < 400 && examples[k].push(trip + ': ' + m); };
const walkMin = km => km * 1.3 / 4.5 * 60;
const said = p => (p.explain || []).join(' ');
let tripsN = 0, daysN = 0, plannedN = 0;
const checkTrip = (name, b, edits) => {
  let plans, ab; try { ab = E.applyPlaces(b, places); plans = E.planTrip(ab); } catch (e) { add('error', name, 'planTrip threw: ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); return; }
  tripsN++; const seen = new Map(), tr = E.makeTravel(b.prefs, b.legModes);
  b.days.forEach((d, i) => { daysN++; const p = plans[i], tag = `${name} day ${i + 1} ${d.type}${d.mode && d.type !== 'land' && d.type !== 'port' ? '/' + d.mode : ''} ${d.city || ''} [${edits[i] || ''}]`;
    if (d.noShore) return; if (!p) return add('error', tag, 'no plan'); if (p.error) { if (!String(p.error).trim()) add('error', tag, 'empty reason'); return; }
    if (!p.items) return add('error', tag, 'no items'); plannedN++;
    let w; try { w = E.dayWindow(Object.assign({}, ab.days[i]), tr); } catch (e) { w = null; }
    const hard = /port|embark|departure/.test(d.type), its = p.items, s = said(p);
    // nan + clock order
    let t = null, prevName = '';
    its.forEach((x, k) => { if (x.at != null && !isFinite(x.at)) add('nan', tag, `${x.t} ${x.name || ''} at ${x.at}`); if (x.min != null && !isFinite(x.min)) add('nan', tag, `${x.t} ${x.name || k} min ${x.min}`);
      if (x.at != null && isFinite(x.at)) { if (t != null && x.at < t - 1) add('order', tag, `${x.t} ${x.name || ''} at ${E.clock(x.at)} before ${prevName} ends ${E.clock(t)}`); t = x.at + (x.t === 'ride' ? 0 : (x.min || 0)); prevName = x.name || x.t; }
      if (x.t === 'ride' && t != null) t += (x.min || 0) + (x.wait || 0); });
    // start
    const st = its.filter(x => x.t === 'stop'), ml = its.filter(x => x.t === 'meal' && !x.onBoard);
    if (!p.safe && isFinite(p.start)) st.concat(ml).forEach(x => { if (x.at < p.start - 1) add('start', tag, `${x.name} at ${E.clock(x.at)}, day starts ${E.clock(p.start)}`); });
    // back in time + leave-by
    if (hard && !p.safe && isFinite(p.endBy)) {
      st.concat(ml).forEach(x => { if (x.at + (x.min || 0) > p.endBy + 0.5) add('back', tag, `${x.name} ends ${E.clock(x.at + x.min)}, back by ${E.clock(p.endBy)}`); });
      if (p.end > p.endBy + 0.5) add('back', tag, `day back ${E.clock(p.end)}, after ${E.clock(p.endBy)}`);
      if (p.leaveAt && isFinite(p.leaveAt.out)) { const last = st.concat(ml).reduce((a, x) => Math.max(a, x.at + (x.min || 0)), -1e9);
        const lv = p.leaveAt.last != null ? p.leaveAt.last : p.leaveAt.out;
        if (last > -1e8 && lv < last - 1) add('leaveby', tag, `leave by ${E.clock(lv)} before the last stop ends ${E.clock(last)}`);
        if (p.leaveAt.out > p.endBy + 0.5) add('leaveby', tag, `leave for the end ${E.clock(p.leaveAt.out)} after back by ${E.clock(p.endBy)}`);
        const m = s.match(/leave for [^.]*? by (\d{1,2}:\d\d(?: ?[ap]m)?)/i); if (m && m[1] !== E.clock(p.leaveAt.out)) add('untrue', tag, `note says leave by ${m[1]}, plan ${E.clock(p.leaveAt.out)}`); }
    }
    // rides
    its.forEach((x, k) => { if (x.t !== 'ride') return; const a = its.slice(0, k).reverse().find(y => y.t !== 'ride' && E.hasPos(y)), z = its.slice(k + 1).find(y => y.t !== 'ride' && E.hasPos(y));
      const km = a && z ? E.hav(a, z) : x.km; if (x.mode !== 'lift' && a && z && km > 0.05 && !(x.min > 0)) add('zero', tag, `${a.name} > ${z.name} ${km.toFixed(2)} km`);
      if (x.mode && x.mode !== 'walk' && x.mode !== 'lift' && x.mode !== 'boat' && km > 0 && km < 3 && x.min > walkMin(km) + 5 && !x.bags && !(z && (z.t === 'end' || /bags/i.test(z.name || ''))) && !(a && /bags/i.test(a.name || ''))) add('walk', tag, `${x.mode} ${x.min} min for ${km.toFixed(2)} km (walk ~${Math.round(walkMin(km))}) ${a && a.name} > ${z && z.name}`); });
    // shut / late
    its.forEach(x => { if (x.t === 'stop' && x.late) add('shut', tag, `${x.name} reached after last entry`); if (x.t === 'meal' && x.shut) add('shut', tag, `${x.meal} at ${x.name} when shut`); });
    // lunch
    const c = b.cities[d.city] || {}, eats = (c.restaurants || []).length || (c.farther || []).some(f => (f.foodDrink || []).length);
    const lunch = ml.find(x => x.meal === 'Lunch') || its.find(x => x.lunchIn);
    if (!p.safe && w && !w.error && E.lunchWanted(w) && st.length && eats && !((d.mealPrefs || {}).Lunch || {}).skip && !lunch && !/lunch/i.test(s)) add('lunch', tag, `day ${E.clock(p.start)}-${E.clock(p.end)} no lunch, nothing said`);
    if (lunch && lunch.t === 'meal' && isFinite(lunch.at) && !lunch.booked) { const L = E.MEALS[0]; if (lunch.at < 11 * 60 || lunch.at > L.to + E.MEAL_LATE) add('lunchtime', tag, `lunch at ${E.clock(lunch.at)}`); }
    // twice
    st.forEach(x => { const id = String(x.id); if (seen.has(id) && seen.get(id) !== i) add('twice', tag, `${x.name} also on day ${seen.get(id) + 1}`); seen.set(id, i); });
    // picks
    const picked = (d.selected || []).map(String), inPlan = new Set(); st.forEach(x => { inPlan.add(String(x.id)); (x.includesIds || []).forEach(y => inPlan.add(String(y))); });
    const dropped = new Set((p.dropped || []).map(String)), folded = new Set((p.folded || []).map(String));
    if (!p.safe) picked.forEach(id => { if (inPlan.has(id) || dropped.has(id) || folded.has(id)) return; const sx = (c.sites || []).concat(c.farther || []).find(y => String(y.id) === id); if (!sx) return;
      const nm = String(sx.name).split(',')[0]; if (s.includes(nm)) return;
      // Claimed by another day of the trip (a pick ticked on two days belongs to one) is said on the screen as "on day N".
      if ([...seen.entries()].some(([k, v]) => k === id && v !== i) || plans.some((q, j) => j !== i && q && q.items && q.items.some(y => y.t === 'stop' && (String(y.id) === id || (y.includesIds || []).map(String).includes(id))))) return;
      add('pick', tag, `${sx.name} ticked, not planned, not said`); });
    // untrue: a note naming a sight as didn't fit / taken off while it's in the plan
    (p.explain || []).forEach(e => { if (!/didn't fit|doesn't fit|taken off|left out|won't fit|no time for/i.test(e)) return; e = e.replace(/To fit it in:.*$/i, '').replace(/\bskip [^,.]*/gi, '');
      st.forEach(x => { const nm = String(x.name).split(',')[0]; if (nm.length > 4 && e.includes(nm) && !new RegExp('(after|before|from|at|leave|visit|in) ' + nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(e)) add('untrue', tag, `note "${e.slice(0, 140)}" names ${nm}, which is planned`); }); });
  });
  return plans;
};
// Zig-zag (costly): only on days with 3-6 stops, planner's order against every single move.
const rideMin = p => p.items.filter(x => x.t === 'ride').reduce((a, x) => a + (x.min || 0) + (x.wait || 0), 0);
const hasLunch = p => p.items.some(x => (x.t === 'meal' && x.meal === 'Lunch') || x.lunchIn);
const zig = (name, b, plans) => b.days.forEach((d, i) => { const p0 = plans && plans[i]; if (!p0 || !p0.items || p0.safe || d.order) return;
  const ids = p0.items.filter(x => x.t === 'stop').map(x => String(x.id)); if (ids.length < 3 || ids.length > 6) return; const r0 = rideMin(p0); let best = null;
  for (let a = 0; a < ids.length; a++) for (let c = 0; c < ids.length; c++) { if (a === c || c === a - 1) continue; const o = ids.slice(); o.splice(c, 0, o.splice(a, 1)[0]);
    const s = Object.assign({}, b, { days: b.days.map((e, j) => j === i ? Object.assign({}, e, { order: o }) : e) });
    let q; try { q = E.planTrip(E.applyPlaces(s, places))[i]; } catch (e) { continue; } if (!q || !q.items || q.safe) continue;
    const qs = q.items.filter(x => x.t === 'stop').map(x => String(x.id));
    if (qs.slice().sort().join() !== ids.slice().sort().join() || q.items.some(x => x.late) || q.end > p0.end + 1 || (hasLunch(p0) && !hasLunch(q))) continue;
    const r = rideMin(q); if (!best || r < best.r) best = { r, o }; }
  if (best && r0 - best.r >= Math.max(20, r0 / 5)) add('zigzag', `${name} day ${i + 1} ${d.city}`, `${ids.join('>')} rides ${r0} min; ${best.o.join('>')} ${best.r} min`); });

const shapeNames = Object.keys(shapes), t0 = Date.now(), trips = [];
for (let n = 0; n < N; n++) {
  const shape = shapeNames[n % shapeNames.length], days = shapes[shape](), b = bucketOf(shape, days);
  const edits = b.days.map(d => d.noShore ? 'sea' : edit(b, d));
  if (chance(0.25)) b.prefs.walk = pick(['low', 'high']); if (chance(0.15)) b.prefs.pace = pick(['relaxed', 'packed']);
  const name = `odd${String(n + 1).padStart(3, '0')}-${shape}`;
  trips.push({ name, b, edits });
  const tt = Date.now(); const plans = checkTrip(name, b, edits); const ms = Date.now() - tt;
  if (process.env.PROGRESS) console.error(`${name} ${b.days.length} days ${ms} ms`);
  if (ms > SLOW_MS) add('slow', name, `whole trip planned in ${(ms / 1000).toFixed(1)} s (a phone is about 4 times slower)`);
  if (plans && (!ONLY.length || ONLY.includes('zigzag')) && n % 3 === 0 && !process.env.NOZIG) zig(name, b, plans);
}
const outFile = arg('out', ''); if (outFile) fs.writeFileSync(outFile, JSON.stringify(trips.map(t => ({ name: t.name, edits: t.edits, bucket: t.b }))));
console.log(`Odd trips: ${tripsN} trips, ${daysN} days, ${plannedN} days planned (seed ${SEED}, ${Math.round((Date.now() - t0) / 1000)} s)`);
const order = ['slow', 'error', 'nan', 'back', 'leaveby', 'order', 'start', 'lunch', 'lunchtime', 'shut', 'walk', 'zero', 'twice', 'pick', 'untrue', 'zigzag'];
for (const k of order) { const n = out[k] || 0; console.log(`${n ? 'FAIL' : 'ok  '} ${k.padEnd(9)} ${n}`); (examples[k] || []).slice(0, SHOW).forEach(e => console.log('       ' + e)); }
if (process.env.ALL) fs.writeFileSync(process.env.ALL, JSON.stringify(examples, null, 1));
process.exitCode = order.some(k => out[k]) ? 1 : 0;
