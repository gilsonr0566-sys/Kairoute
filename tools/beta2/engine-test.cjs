// Beta 2 engine tests: each piece on its own (made-up days) and against the old engine (saved test trips).
// Pure Node, no browser, no internet, no AI. Usage: node tools/beta2/engine-test.cjs
const E = require('./engine.cjs'), fs = require('fs'), path = require('path');
let fails = 0, oks = 0; const ok = (c, msg) => { if (c) oks++; else { fails++; console.log('FAIL ' + msg); if (process.env.FAIL_FAST) process.exit(1); } };
const dir = path.join(__dirname, 'snapshots');
const tr = E.makeTravel({ walk: 'medium' }, {});
const port = { name: 'Port', lat: 37.94, lng: 23.64 }, hotel = { name: 'Hotel', lat: 37.97, lng: 23.73 }, air = { name: 'Airport', lat: 37.94, lng: 23.94 };
const day = o => Object.assign({ type: 'land', mode: 'flight', startTime: '09:00', hours: 8, returnToStart: true, lodging: hotel, point: port }, o);

// ---- Safety times (Rule #2) ----
{ const w = E.dayWindow(day({ type: 'port', portArrive: 480, allAboard: 1020 }), tr);
  ok(w.start === 510 && w.endBy === 975 && w.hard, `port day: ashore 30 min after docking, back 45 min before all aboard (got ${w.start}-${w.endBy})`); }
ok(E.waterOnly({ access: 'Viewed from the water on a boat tour' }) && E.waterOnly({ access: 'Only by boat' }) && !E.waterOnly({ access: 'Walk up from the old port' }), 'a sight seen only from the water is read from its access note');
{ // A ride picked one way doesn't overrule the ride the traveler picked back (Nov 18: the ferry out to Sorrento decided the
  // ride back to a sight in the city, so the train picked for it did nothing).
  const port = { lat: 40.838, lng: 14.255 }, town = { lat: 40.626, lng: 14.376, travelNote: 'Ferry from the port, 40 min; or the Circumvesuviana train, 60 min.' }, sight = { lat: 40.849, lng: 14.255 }, near = { lat: 40.836, lng: 14.249 };
  const ans = () => [{ id: 'ferry|Ferry', min: 55, label: 'Ferry', mode: 'ferry' }, { id: 'rail|Circumvesuviana', min: 75, label: 'Circumvesuviana', mode: 'rail' }];
  const tr = E.makeTravel({}, { [E.pairKey(port, town)]: 'ferry', [E.pairKey(town, sight)]: 'train' }, null, null, ans);
  ok(tr.estimate(port, town).choice === 'ferry' && tr.estimate(town, sight).choice === 'train' && tr.estimate(town, near).choice === 'train', 'out by ferry and back by train, as picked, also from a stop next door');
  // A choice saved before the kinds were named ("boat", "transit") still holds.
  const old = E.makeTravel({}, { [E.pairKey(port, town)]: 'boat', [E.pairKey(town, sight)]: 'transit' }, null, null, ans);
  ok(old.estimate(port, town).choice === 'ferry' && old.estimate(town, sight).choice === 'train', 'a ride choice saved by the old names still holds'); }
{ // One layer for every ride (Nov 18 night): each way is real data with one label; the guide's words are a note, never a ride.
  const port = { lat: 40.838, lng: 14.255 }, far = { lat: 40.749, lng: 14.485, travelNote: 'Circumvesuviana train, 40 min.' };
  const ans = () => [{ id: 'rail|Train 4 + 1 change', min: 110, label: 'Train 4 + 1 change', mode: 'rail', steps: ['Train 4 to X', 'Train 7 to Y'] }, { id: 'rail|Train 4', min: 115, label: 'Train 4', mode: 'rail' }, { id: 'rail|Train 9', min: 160, label: 'Train 9', mode: 'rail' }];
  const plain = E.makeTravel({}, {}, null, null, ans).estimate(port, far);
  ok(plain.options.filter(o => o.kind === 'train').length === 1 && plain.options.find(o => o.kind === 'train').how === 'Train 4', 'one choice per kind: the timetable\'s train with fewer changes, at most 10 min slower');
  ok(plain.options.every(o => E.RIDE_KINDS.includes(o.kind) && o.mode === E.modeOfKind(o.kind)) && plain.options.find(o => o.id === 'taxi').how === 'Taxi or car' && plain.options.find(o => o.id === 'taxi').min >= 40, 'every way has a kind, its mode follows it, the taxi is the taxi (no shorter than the guide\'s time)');
  ok(!plain.options.some(o => /guide says|plus 15/.test(o.how)) && /The guide says: Circumvesuviana train, 40 min/.test(plain.note || ''), 'the guide\'s words are a note beside the ride, never a ride of their own');
  for (const [want, got] of [['rail|Train 4 + 1 change', 'train'], ['transit', 'train'], ['taxi', 'taxi'], ['train', 'train']]) ok(E.makeTravel({}, { [E.pairKey(port, far)]: want }, null, null, ans).estimate(port, far).choice === got, 'the ride tapped is taken: ' + want);
  // No data for the train the guide names: a taxi, and the note says so plainly; never a train guessed from the note.
  const none = E.makeTravel({}, {}).estimate(port, far);
  ok(none.kind === 'taxi' && !none.options && /names a train, but no timetable for it is known/.test(none.note || ''), 'no train known: the taxi, and the note says the guide\'s train has no known timetable (never a guessed train)');
  const lost = E.makeTravel({}, { [E.pairKey(port, far)]: 'train' }).estimate(port, far);
  ok(lost.kind === 'taxi' && lost.lost === 'train', 'a choice that can\'t hold says so (lost: train)');
  // The ship's extra time is the same for every way.
  const back = E.makeTravel({}, {}, null, null, ans).estimate(far, Object.assign({}, port, { backToShip: true }));
  ok((back.options || [back]).filter(o => o.min >= 30 && o.kind !== 'walk').every(o => o.slack >= 15), 'every way back to the ship has its extra time'); }
ok(E.publicWins(73, 46) && E.publicWins(100, 50) === false, 'a train an hour and a quarter long wins over a 46-minute taxi; a taxi saving 50 minutes of a 100-minute ride wins (Nov 18, Sorrento to Pompeii)');
// A pick inside an area picked for another day moves to the area's day (one walk), and the plan says so; a sight far
// from the heart of the place is a trip out, never a stop of a day in town.
{ const s0 = JSON.parse(fs.readFileSync(path.join(dir, 'athens-booked.json'))), c = s0.cities.athens;
  const plaka = c.sites.find(x => /Plaka/.test(x.name)), cath = c.sites.find(x => /Athens Cathedral/.test(x.name));
  if (plaka && cath) { s0.days[1].selected = [plaka.id]; s0.days[2].selected = [cath.id];
    const p = E.planTrip(s0), on = (i, id) => p[i] && p[i].items && p[i].items.some(x => x.t === 'stop' && String(x.id) === String(id));
    ok(on(1, cath.id) && !on(2, cath.id) && (p[2].explain || []).some(t => /inside Plaka/.test(t)), 'a pick inside an area picked for another day is planned with the area, and the plan says why'); }
  const s1 = JSON.parse(fs.readFileSync(path.join(dir, 'athens-booked.json'))), c1 = s1.cities.athens, far = c1.farther.find(x => /Ancient Corinth/.test(x.name));
  if (far) { c1.sites = c1.sites.concat([Object.assign({}, far, { id: 'far-in-sites' })]); c1.farther = c1.farther.filter(x => x !== far);
    const p = E.planTrip(s1); p.forEach((x, i) => { if (!x || !x.items) return; const st = x.items.filter(y => y.t === 'stop'), here = st.some(y => y.id === 'far-in-sites');
      if (here) ok(st.every(y => y.id === 'far-in-sites' || E.hav(far, y) <= 20), `day ${i}: a sight 80 km out, listed among the city's sights, is planned as a day trip, not mixed into a day in town`); }); } }
ok(!E.mealPlace({ cuisine: 'Honey doughnuts', why: 'Perfect afternoon treat.' }) && !E.mealPlace({ amenity: 'cafe' }) && E.mealPlace({ cuisine: 'Greek', why: 'Save room for dessert' }) && E.mealPlace({ amenity: 'restaurant', cuisine: 'coffee_shop;greek' }), 'lunch and dinner only at a place that serves a meal (a doughnut shop is a snack, not dinner)');
ok(E.latin('Ζευγολατιό') === 'Zevgolatio' && E.latin('Ευαγγελισμός') === 'Evangelismos' && E.latin('Μπενάκη') === 'Benaki' && E.latin('Киевская') === 'Kievskaya' && E.latin('Piraeus') === 'Piraeus', 'Greek and Cyrillic names are written in Latin letters by fixed rules');
// A port placed on the wrong island (a lookup gone astray) is never planned from; a guide written as a trip out from
// that very port ("Rome from Civitavecchia") is far by design and is planned.
{ const fira = [{ lat: 36.416, lng: 25.432 }], wrong = { name: 'Athinios port', lat: 35.345, lng: 25.14 };
  const w = E.dayWindow(day({ type: 'port', portArrive: 480, allAboard: 1020, point: wrong, siteSpots: fira, placeName: 'santorini Santorini' }), tr);
  ok(w.error && w.farGate, 'a port 120 km from every sight of the island is not planned from');
  const rome = [{ lat: 41.89, lng: 12.49 }], civ = { name: 'Civitavecchia cruise port', lat: 42.095, lng: 11.79 };
  const v = E.dayWindow(day({ type: 'port', portArrive: 480, allAboard: 1200, point: civ, siteSpots: rome, placeName: 'rome from civitavecchia Rome (from Civitavecchia)' }), tr);
  ok(!v.error, 'a guide named for its port (Rome from Civitavecchia) is planned from that port'); }
{ const w = E.dayWindow(day({ type: 'port', portArrive: 480, allAboard: 1020, tender: true }), tr); ok(w.start === 540, 'tender port: an hour to get ashore'); }
{ const w = E.dayWindow(day({ type: 'embark', allAboard: 1020, boardAt: 780 }), tr); ok(w.endBy === 780, 'boarding day: at the terminal by the boarding time'); }
{ const w = E.dayWindow(day({ type: 'embark', allAboard: 1020, boardAt: 990 }), tr); ok(w.endBy === 960, 'boarding day: never later than an hour before all aboard'); }
{ const w = E.dayWindow(day({ type: 'departure', mode: 'flight', time: '15:00' }), tr); ok(w.endBy === 720, 'flight: at the airport 3 h early'); }
{ const w = E.dayWindow(day({ type: 'departure', mode: 'train', time: '15:00' }), tr); ok(w.endBy === 870, 'train: at the station 30 min early'); }
{ const w = E.dayWindow(day({ type: 'embark', allAboard: 930, boardAt: null, thru: { mode: 'flight', time: '11:25', point: air } }), tr);
  ok(w.straight === true && w.tail.length === 1 && w.head.length === 1, 'same-day fly-in with under 3 h free: straight to the ship'); }
// Round 1 (Nov 20): an arrival time nobody gave is asked, never planned on; and a straight-to-the-ship day plans no sights.
// Off a ship and flying out the same day (outside test, Nov 22: bags left at 8:30, collected at 8:45, nothing between):
// bags are stored only with an hour or more free; under that the day goes straight on with them.
{ const tight = E.dayWindow(day({ type: 'departure', mode: 'flight', time: '13:00', thru: { mode: 'ship', time: '07:30', point: port }, point: air }), tr);
  const roomy = E.dayWindow(day({ type: 'departure', mode: 'flight', time: '18:00', thru: { mode: 'ship', time: '07:30', point: port }, point: air }), tr);
  const has = w => [].concat(w.head || [], w.tail || []).some(x => /bags/i.test(x.name || ''));
  ok(!tight.error && !has(tight) && tight.bagsStraight, `under an hour free: no luggage storage, straight on with the bags (head ${JSON.stringify((tight.head || []).map(x => x.name))})`);
  ok(!roomy.error && has(roomy) && !roomy.bagsStraight, 'a long free stretch stores the bags'); }
{ const g = E.dayWindow(day({ type: 'embark', allAboard: 930, boardAt: null, thru: { mode: 'flight', time: '10:30', point: air, guess: true } }), tr);
  const a = E.dayWindow(day({ type: 'arrival', mode: 'flight', time: '10:30', timeGuess: true }), tr);
  ok(g.error && g.askArrive && a.error && a.askArrive && /When does your flight arrive/.test(a.error), 'an arrival time the traveler never gave is asked, never planned on'); }
{ const b = JSON.parse(fs.readFileSync(path.join(dir, 'sample-cruise.json'))), i = b.days.findIndex(d => d.type === 'embark');
  if (i >= 0) { const st = JSON.parse(JSON.stringify(b)); const air0 = Object.assign({}, st.days[i].point || st.days[i].lodging, { name: 'Airport' });
    st.days[i] = Object.assign({}, st.days[i], { thru: { mode: 'flight', time: (m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'))((st.days[i].allAboard || 930) - 200), point: air0 }, boardAt: null });
    const w = E.dayWindow(st.days[i], E.makeTravel(st.prefs, st.legModes)), p = E.planTrip(st)[i];
    ok(w.straight && (p.items || []).every(x => x.t !== 'stop'), `a day straight from the plane to the ship plans no sights (${w.straight ? (p.items || []).filter(x => x.t === 'stop').length + ' stops' : 'not straight'})`);
    ok(w.straight && !(p.explain || []).some(t => /^Free time/.test(t)) && (p.explain || []).every(t => !/Free time/.test(t) || /margin/.test(t)), 'straight to the ship: the time to spare is margin, never free time at the airport');
    { const la = p.leaveAt, end = (p.items || []).filter(x => x.t === 'ride').pop(), endBy = w.endBy;
      ok(la && la.out != null && end && la.out + (end.min || 0) <= endBy && la.out + (end.min || 0) >= endBy - 5, `straight to the ship: the leave-by plus the ride the plan shows reach the be-by time (${la ? E.clock(la.out) : 'none'} + ${end ? end.min : '?'} min vs ${E.clock(endBy)})`); } } }
{ const w = E.dayWindow(day({ type: 'embark', allAboard: 1200, boardAt: null, thru: { mode: 'flight', time: '08:00', point: air } }), tr);
  ok(!w.straight && w.notes.includes('flyInWarn'), 'same-day fly-in with time to spare: sightseeing, with the late-flight warning'); }
{ const w = E.dayWindow(day({ type: 'port', portArrive: NaN, allAboard: 1020 }), tr); ok(w.error && /times/.test(w.error), 'missing ship times: an error, never a guess'); }
{ const w = E.dayWindow(day({ type: 'port', portArrive: 480, allAboard: 1020, point: Object.assign({}, port, { unknown: true }) }), tr); ok(w.error && w.unsure, 'unknown port: not planned on a guess'); }
{ const far = { lat: 38.2, lng: 23.0, name: 'Far' }, back = Object.assign({}, port, { backToShip: true });
  const a = tr.estimate(far, port), b = tr.estimate(far, back); ok(b.min > a.min && b.slack >= 15, 'long ride back to the ship gets at least 15 extra minutes'); }

{ const w = E.dayWindow(day({ type: 'embark', allAboard: 1020, boardAt: 570, date: '2027-07-01' }), tr), r = E.walkDay([], w, tr.estimate, null);
  ok(w.leaveEarly > 0 && r.end <= w.endBy && w.start < 540, `boarding sooner than the bags and the ride allow: the day starts earlier (start ${w.start}, end ${r.end}, board ${w.endBy})`); }
{ const w = E.dayWindow(day({ type: 'embark', allAboard: 1020, boardAt: 780 }), tr); ok(!w.leaveEarly && w.start === 540, 'boarding with time to spare: the planned start stays'); }

// ---- Travel estimate is stable and order-free ----
{ const a = { lat: 37.97, lng: 23.72 }, b = { lat: 37.975, lng: 23.73 };
  ok(tr.min(a, b) === tr.min(a, b) && tr.estimate(a, b).mode === 'walk', 'short hop is a walk, same answer every time');
  const tr2 = E.makeTravel({ walk: 'medium' }, { [E.pairKey(a, b)]: 'taxi' }); ok(tr2.estimate(a, b).mode === 'ride', "traveler's chosen ride is used");
  ok(tr.saidMin('About 1 hour on the Circumvesuviana train') === 60 && tr.saidMin('60-75 min') === 75, "guide's ride notes are read"); }

// ---- Public transport: offered beside walking and a taxi wherever a line serves both ends, in any city ----
{ const line = (mode, ref, pts) => ({ mode, ref, stops: pts.map(([n, lat, lng]) => ({ name: n, lat, lng })) });
  const L1 = line('subway', '1', [['North', 38.000, 23.730], ['Mid', 37.990, 23.730], ['Change', 37.980, 23.730], ['South', 37.970, 23.730]]);
  const L2 = line('tram', 'T', [['Change', 37.980, 23.731], ['East', 37.980, 23.750], ['Far East', 37.980, 23.770]]);
  const tt = E.makeTravel({ walk: 'medium' }, {}, null, [L1, L2]);
  const a = { lat: 38.0005, lng: 23.7305 }, b = { lat: 37.9705, lng: 23.7305 }, c = { lat: 37.9805, lng: 23.7695 }, nowhere = { lat: 38.2, lng: 23.2 };
  const ab = tt.estimate(a, b), opts = ab.options || [];
  ok(opts.some(o => o.mode === 'transit' && /^Metro Line 1, North to South$/.test(o.how)), `a leg along a metro line offers it (got ${JSON.stringify(opts.map(o => o.how))})`);
  ok(opts.some(o => o.mode === 'walk') && opts.some(o => o.mode === 'ride'), 'walking and a taxi are still offered beside it');
  { const plain = E.makeTravel({ walk: 'medium' }, {}).estimate(a, b), t = opts.find(o => o.mode === 'transit');
    ok(plain.mode === 'walk' ? ab.mode === 'walk' : (E.publicWins(t.min, plain.min) ? ab.mode === 'transit' : ab.mode === plain.mode),
      `too far to walk: the line is taken unless a taxi saves a lot; a walkable leg stays a walk (got ${ab.mode}, plain ${plain.mode} ${plain.min}, line ${t.min})`); }
  // Too far to walk, and the line far slower than both the taxi and walking all the way (Round 1: a 2-hour ferry
  // offered for a 15-minute ride back to the ship): the line is not offered; the walk and the taxi stay.
  { const L3 = line('tram', '3', [['Top', 38.100, 23.700], ['Hill', 38.200, 23.680], ['Bottom', 38.100, 23.660]]), t3 = E.makeTravel({ walk: 'low' }, {}, null, [L3]);
    const p = { lat: 38.1003, lng: 23.7003 }, q = { lat: 38.1065, lng: 23.660 }, e = t3.estimate(p, q);
    ok(e.mode !== 'walk' && !(e.options || []).some(o => o.mode === 'transit') && (e.options || []).some(o => o.mode === 'walk') && (e.options || []).some(o => o.kind === 'taxi'), `a line far slower than both the taxi and the walk is not offered; walk and taxi stay (got ${e.mode} ${JSON.stringify((e.options || []).map(o => o.mode + o.min))})`); }
  const ac = tt.estimate(a, c); ok((ac.options || []).some(o => o.mode === 'transit' && /then Tram T, .* to Far East/.test(o.how)), 'one change between lines is found');
  const picked = E.makeTravel({ walk: 'medium' }, { [E.pairKey(a, b)]: 'transit' }, null, [L1, L2]).estimate(a, b);
  ok(picked.mode === 'transit' && picked.min === opts.find(o => o.mode === 'transit').min, "the traveler's choice of the metro is planned with its own time");
  ok(!tt.estimate(a, nowhere).options, 'no line near one end: no public transport offered');
  ok(!tt.estimate(a, { lat: 38.0015, lng: 23.7305 }).options, 'a short walk offers no transport'); 
  const r = E.walkDay([Object.assign({ id: 'x', minutes: 30 }, b)], { start: 540, endBy: 1080, head: [Object.assign({ name: 'Hotel' }, a)], tail: [Object.assign({ name: 'Hotel' }, a)] }, tt.estimate, null);
  ok(r.items.filter(x => x.t === 'ride').every(x => (x.options || []).some(o => o.mode === 'transit')), 'the day plan carries the choices on each ride'); }

// ---- The traveler's meal choices (d.mealPrefs): skip, a set time, a chosen place ----
{ const s0 = JSON.parse(fs.readFileSync(path.join(dir, 'noai-prague.json'))), di = s0.days.findIndex(d => d.type !== 'sea');
  const run = prefs => { const s = JSON.parse(JSON.stringify(s0)); s.days[di].mealPrefs = prefs; return E.planTrip(s)[di]; };
  const base = run(undefined), lunch0 = base.items.find(x => x.t === 'meal');
  ok(!!lunch0, 'the test day has a lunch to change');
  const sk = run({ Lunch: { skip: true } });
  ok(!sk.items.some(x => x.t === 'meal') && !(sk.explain || []).some(e => /lunch/i.test(e)), 'lunch skipped: no lunch and no lunch note');
  const sights = p => p.items.filter(x => x.t === 'stop').reduce((a, x) => a + x.min, 0);
  ok(sights(sk) >= sights(base), 'a skipped lunch gives its time to sightseeing, never takes any');
  const at = run({ Lunch: { at: '13:30' } }), m = at.items.find(x => x.t === 'meal');
  ok(m && m.at >= 810 && m.at <= 820 && m.pinned, `lunch at a set time starts then (got ${m && m.at})`);
  const c0 = s0.cities[s0.days[di].city], other = (c0.restaurants || []).find(r => lunch0 && r.name !== lunch0.name && isFinite(r.lat));
  if (other) { const pk = run({ Lunch: { pick: { name: other.name, lat: other.lat, lng: other.lng } } }), pm = pk.items.find(x => x.t === 'meal');
    ok(pm && pm.name === other.name && pm.chosen, `the chosen lunch place is the one used (got ${pm && pm.name})`);
    const all = E.planTrip(Object.assign(JSON.parse(JSON.stringify(s0)), { days: s0.days.map((d, k) => k === di ? Object.assign({}, d, { mealPrefs: { Lunch: { pick: { name: other.name, lat: other.lat, lng: other.lng } } } }) : d) }));
    ok(all.filter((p, k) => k !== di && p && p.items).every(p => !p.items.some(x => (x.t === 'meal' || x.t === 'evening') && x.name === other.name)), 'no other day takes the chosen place'); }
  const dsk = run({ Dinner: { skip: true } }); ok(!dsk.items.some(x => x.t === 'evening'), 'dinner skipped: no dinner idea');
  if (other) { const dp = run({ Dinner: { pick: { name: other.name, lat: other.lat, lng: other.lng }, at: '19:30' } }), ev = dp.items.find(x => x.t === 'evening');
    ok(ev && ev.name === other.name && ev.at >= 1170 && ev.chosen, `the chosen dinner place at its set time (got ${ev && ev.name} ${ev && ev.at})`); }
  ok(JSON.stringify(run({})) === JSON.stringify(base), 'no meal choices: the same plan as before'); }

// ---- Opening hours ----
{ const oh = { spans: [[540, 1020]], last: 960 };
  ok(E.hoursFit(oh, 500, 60).wait === 40, 'waits for opening'); ok(E.hoursFit(oh, 970, 60).late === 10, 'late after last entry');
  ok(E.closedForDay({ closed: true }, { start: 0, endBy: 1440 }), 'closed date is closed');
  ok(E.closedForDay({ oh: { spans: [[1200, 1320]] } }, { start: 510, endBy: 975 }, 60), 'open only outside the window counts as closed'); }


// ---- A port with nothing to see still gets a safe day (lesson #9) ----
{ const w = E.dayWindow(day({ type: 'port', portArrive: 480, allAboard: 1020 }), tr), r = E.walkDay([], w, tr.estimate, () => null);
  ok(!w.error && r.end <= w.endBy && !r.over && r.items[0].t === 'start' && r.items[r.items.length - 1].t === 'end', 'a port with no sights: ashore and back at the ship in time, no error'); }

// ---- Groups and sites (step 3) ----
{ // Richard's example: an old town square is a group, the famous clock on it is a site. Real map data, general rule.
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'prague-sources.json'))), all = new Map();
  const walk = o => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (o.name && isFinite(o.lat)) { const id = o.wd || o.name; if (!all.has(id)) all.set(id, { id, name: o.name, lat: +o.lat, lng: +o.lng, category: o.category || '' }); } else Object.values(o).forEach(walk); } };
  walk(j); const sites = [...all.values()], G = E.makeGroups(sites), id = n => (sites.find(x => x.name === n) || {}).id;
  ok(G.kind.get(id('Old Town Square')) === 'group', 'old town square is a group');
  ok(G.kind.get(id('Prague Astronomical Clock')) === 'site', 'the astronomical clock is a site');
  for (const n of ['Prague Astronomical Clock', 'Church of Our Lady before Týn', 'Old Town Hall', 'Church of Saint Nicholas', 'Jan Hus Memorial'])
    ok(G.groupOf.get(id(n)) === id('Old Town Square'), n + ' is inside the square');
  ok(G.groupOf.get(id('House of the Black Madonna')) !== id('Old Town Square'), 'a building 300 m away is not part of the square');
  const shuffled = E.makeGroups(sites.slice().reverse()); ok(JSON.stringify([...shuffled.groupOf].sort()) === JSON.stringify([...G.groupOf].sort()), 'groups come out the same whatever order the pieces arrive in');
  const L = E.makeLedger(); ok(E.claimVisit(L, G, id('Old Town Square'), 3) && !L.sightFree(id('Prague Astronomical Clock'), 5), 'a group visit claims its sights for that day only (never scheduled twice)');
}
{ // Nesting from the map's boundaries: chapel inside museum inside a walled state; a mutual match folds nothing.
  const S = [{ id: 'state', name: 'Walled State', category: 'City-state', lat: 41.9029, lng: 12.4534 }, { id: 'museum', name: 'Museums', category: 'Museum complex', lat: 41.9065, lng: 12.4536, in: ['state'] },
    { id: 'chapel', name: 'Chapel', category: 'Chapel', lat: 41.9030, lng: 12.4545, in: ['museum', 'state'] }, { id: 'a', name: 'Harbour', lat: 1, lng: 1, in: ['b'] }, { id: 'b', name: 'Aquarium', lat: 1, lng: 1.001, in: ['a'] }];
  const G = E.makeGroups(S); ok(G.groupOf.get('chapel') === 'museum' && G.groupOf.get('museum') === 'state' && G.top('chapel') === 'state', 'nested groups: innermost holds it, outermost visit includes it');
  ok(G.within('state').sort().join() === 'chapel,museum', 'a group visit includes every level inside it');
  ok(G.kind.get('a') === 'site' && G.kind.get('b') === 'site', 'two places that each contain the other are both sites');
}

// ---- Categories (step 4) ----
{ const S = [{ id: 'm', name: 'Big Ruins', fame: 3, tags: ['must-see', 'famous', 'interest:history', 'open-air'] }, { id: 'c', name: 'Small Church', fame: 1, tags: ['local-favorite', 'religious', 'interest:churches'] },
    { id: 'g', name: 'Gallery', fame: 2, tags: ['famous', 'interest:art', 'indoor'] }];
  const ids = l => l.map(x => x.id).join();
  ok(ids(E.filterSights(S, {})) === 'm,g,c', 'sorted must-sees first, then by fame');
  ok(ids(E.filterSights(S, { show: 'local' })) === 'c', 'local favorites filter');
  ok(ids(E.filterSights(S, { interests: ['art'] })) === 'm,g', "interests filter keeps must-sees and the traveler's interests");
  ok(ids(E.filterSights(S, { skip: ['religious'] })) === 'm,g', 'religious sites off');
  ok(ids(E.filterSights(S.slice().reverse(), {})) === ids(E.filterSights(S, {})), 'same order whatever order they arrive in'); }
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const s = JSON.parse(fs.readFileSync(path.join(dir, f))); let n = 0;
  for (const c of Object.values(s.cities)) { const all = [...c.sites, ...c.farther], G = E.makeGroups(all), T = E.tagGroups(all, G);
    T.forEach(x => { n++; const t = x.tags || [];
      ok(t.includes('famous') !== t.includes('local-favorite'), `${f} ${x.name}: exactly one of famous / local favorite`);
      ok(t.includes('must-see') === !!x.mustSee, `${f} ${x.name}: must-see tag matches`);
      ok(t.includes('group') !== t.includes('site'), `${f} ${x.name}: exactly one of group / site`);
      ok(t.filter(k => k.startsWith('interest:')).every(k => E.INTEREST_KEYS.includes(k.slice(9))), `${f} ${x.name}: unknown interest`); }); }
  console.log(`ok   ${s.name}: ${n} sights carry their categories`);
}

// The two checks against the old engine below compare the clock itself, so they run on the old engine's road estimate (one
// speed for the whole ride by its length); the estimate changed on purpose on Nov 20 (review finding 5, tested above).
const roadNow = E.roadTime;
const bagsNow = E.BAGS_WALK; E.BAGS_WALK = 1e9; E.roadTime = d => { const k = d <= 15 ? 1.3 : d <= 40 ? 1.35 : 1.25, v = d <= 6 ? 22 : d <= 15 ? 25 : d <= 40 ? 45 : 85, add = d <= 15 ? 10 : 15; return { km: d * k, min: Math.round(add + d * k / v * 60) }; };
// ---- Against the old engine: every day's window on the saved test trips ----

if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const s = JSON.parse(fs.readFileSync(path.join(dir, f))), t2 = E.makeTravel(s.prefs, s.legModes); let n = 0;
  s.days.forEach((d, i) => { const o = s.old[i], w = E.dayWindow(d, t2); if (!o || o.error) { ok(!!w.error || !d.city, `${f} day ${i}: old engine had no plan (${o && o.error}) but the new window has none of its reasons`); return; }
    n++; ok(!w.error, `${f} day ${i}: new window error ${w.error}`); if (w.error) return;
    ok((w.plannedStart != null ? w.plannedStart : w.start) === o.start && w.endBy === o.endBy - (d.type === 'port' && d.tender ? E.TENDER_BACK : 0), `${f} day ${i} ${d.type}: window ${w.start}-${w.endBy}, old ${o.start}-${o.endBy}`);
    ok(!!w.straight === !!o.straight && w.head.length === o.head.length && w.tail.length === o.tail.length, `${f} day ${i}: fixed steps differ`); });
  console.log(`ok   ${s.name}: ${n} day windows compared with the old engine`);
}

// ---- Against the old engine: the timed day. The old engine's own stop order, walked through the new clock, must
// end at the same minute (rides, waits for opening, visits, meals, fixed steps).
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const s = JSON.parse(fs.readFileSync(path.join(dir, f))), t2 = E.makeTravel(s.prefs, s.legModes); let n = 0, same = 0, liveDays = 0;
  s.days.forEach((d, i) => { const o = s.old[i]; if (!o || o.error) return; const w = E.dayWindow(d, t2), c = s.cities[d.city], all = [...c.sites, ...c.farther];
    const body = o.items.slice(1 + (w.head.length - 1) * 2, o.items.length - w.tail.length * 2), seq = [];
    for (const x of body) { if (x.t === 'stop') { const f0 = all.find(y => y.id === x.id); seq.push(f0 ? Object.assign({}, f0, { minutes: x.min }) : null); }
      else if (x.t === 'meal') seq.push({ id: 'meal', name: x.name, lat: x.lat, lng: x.lng, mealOf: E.MEALS.find(m => m.label === x.meal), len: x.min }); }
    if (seq.includes(null) || body.some(x => x.t === 'fixed')) return; // area visits (parts) and booked tables are compared once those steps are built
    n++; const r = E.walkDay(seq, w, t2.estimate, id => d.sites[id]);
    // A ride the old app timed from a live route lookup (its distance differs from the steady estimate's) is a data
    // difference, not a clock one: that day is left out of this comparison.
    const oldRides = body.filter(x => x.t === 'ride'), newRides = r.items.filter(x => x.t === 'ride').slice(0, oldRides.length);
    const live = oldRides.some((x, k) => newRides[k] && x.km > 0.3 && Math.abs(x.km - newRides[k].km) > 0.02 * x.km);
    if (live && Math.abs(r.end - o.end) > 1) { n--; liveDays++; return; }
    // A day trip the guide names its ways for (a train, a ferry) now rides the way chosen, with that way's own time, where
    // the old engine took the slower of the road and the note: a rule change (Nov 18), not a clock difference.
    const guideWay = seq.some((x, k) => x && (k ? seq[k - 1] : w.head[w.head.length - 1]) && t2.estimate(k ? seq[k - 1] : w.head[w.head.length - 1], x).note)
      || (seq.length && t2.estimate(seq[seq.length - 1], w.tail[0]).note);
    if (guideWay && Math.abs(r.end - o.end) > 1) { n--; liveDays++; return; }
    // A ride of half an hour or more to a ship, train or plane gets time for traffic at any distance now, where the old
    // engine gave it only past 15 km (Nov 18, a rule change for safety): that extra time is not a clock difference.
    const pts = [...w.head, ...seq.filter(x => !x.mealOf || isFinite(x.lat)), ...w.tail];
    const ruleSlack = pts.slice(1).reduce((t, b, k) => t + ((b.deadline || b.backToShip) && E.hav(pts[k], b) <= 15 ? (t2.estimate(pts[k], b).slack || 0) : 0), 0);
    // And since Nov 20 (review finding 2) the extra time covers the whole way back from the farthest place: also a rule change.
    const wayBack = r.items.reduce((t, x) => t + (x.wayBack || 0), 0);
    if ((ruleSlack || wayBack) && [ruleSlack + wayBack, wayBack].some(v => Math.abs(r.end - v - o.end) <= 1)) { same++; return; }
    if (Math.abs(r.end - o.end) <= 1) same++; else ok(false, `${f} day ${i} ${d.type}: old order ends ${r.end} on the new clock, old engine says ${o.end}`); });
  if (!n && s.old.every(o => !o || o.error)) { console.log(`gap  ${s.name}: the old engine planned no day here either (${(s.old.find(o => o && o.error) || {}).error || 'no plan'})`); continue; }
  ok(n > 0 || liveDays > 0, f + ': no days to compare'); oks += same; console.log(`ok   ${s.name}: ${same} of ${n} timed days match the old engine to the minute${liveDays ? ` (${liveDays} left out: the old app used a live route time)` : ''}`);
}

E.roadTime = roadNow; E.BAGS_WALK = bagsNow;
// ---- A day planned alone (the Sights list's quick "does it fit?") has the same sights as in the whole trip ----
// Nov 20: the alone check first dropped the place's other days, so a pick closed on its day and moved to another
// day (or into an area picked for another day) was lost from the check. The other days still decide the moves.
if (fs.existsSync(dir)) { let n = 0, same = 0;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const s0 = JSON.parse(fs.readFileSync(path.join(dir, f))), full = E.planTrip(s0);
    const stops = p => (p && p.items || []).filter(x => x.t === 'stop').map(x => String(x.id)).sort().join(',');
    (s0.days || []).forEach((d, i) => { if (!full[i] || !full[i].items || !Array.isArray(d.selected) || d.own === false) return; n++; // a day the app fills itself (no picks yet: old trips, or own false) takes other days' leftovers
      const s = JSON.parse(JSON.stringify(s0)); s.days[i] = Object.assign({}, s.days[i], { alone: true }); s.cities = E.citiesFor(s, i); const p = E.planTrip(s);
      const others = p.some((x, k) => k !== i && x && x.items && x.items.length);
      if (stops(p[i]) === stops(full[i]) && !others) same++; else ok(false, `${f} day ${i}: planned alone it has ${stops(p[i]) || 'no sights'}, in the whole trip ${stops(full[i])}${others ? ' (and other days were planned)' : ''}`); }); }
  ok(n > 20, 'days to plan alone: ' + n); console.log(`ok   ${same} of ${n} days planned alone (with only their own place's guides) keep the same sights as in the whole trip`); }

// ---- Every ride in a plan says where it starts and ends (the map draws each ride on its own) ----
if (fs.existsSync(dir)) { let rides = 0, placed = 0;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) E.planTrip(JSON.parse(fs.readFileSync(path.join(dir, f)))).forEach(p => (p && p.items || []).forEach((x, k) => {
    if (x.t !== 'ride') return; const a = p.items[k - 1], b = p.items[k + 1]; if (!a || !b || !isFinite(a.lat) || !isFinite(b.lat)) return; rides++;
    if (x.from && x.to && x.from.lat === a.lat && x.to.lng === b.lng) placed++; else ok(false, `${f} day ${p.i}: ride ${a.name} to ${b.name} has no start and end`); }));
  console.log(`ok   ${placed} of ${rides} rides carry their start and end points`); }

// ---- Every city with public transport lines in its places file: each ride the day plan makes along a line offers it.
{ const PD = path.join(__dirname, '..', 'places', 'data'), places = {};
  if (fs.existsSync(PD)) for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; }
  // A port with no town around it (a private island, Nov 20: no day plan at all) still gets its mapped pier: every port day
  // whose places file maps a cruise pier is planned from it, never from a guess, and gets a plan.
  { let n = 0; const bad = [];
    if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const s0 = JSON.parse(fs.readFileSync(path.join(dir, f)));
      if (!s0.days.some(d => d.type === 'port' && places[d.city] && (places[d.city].ports || []).some(x => x.cruise))) continue;
      const s = E.applyPlaces(s0, places), P = E.planTrip(s);
      s.days.forEach((d, i) => { if (d.type !== 'port' || !places[d.city] || !(places[d.city].ports || []).some(x => x.cruise)) return; n++;
        if (!d.point || d.point.unknown || !P[i] || P[i].error) bad.push(f + ' ' + d.city + ': ' + (P[i] && P[i].error || 'no pier')); }); }
    ok(n > 0 && !bad.length, `every port day with a mapped cruise pier is planned from it (${n} days${bad.length ? '; not: ' + bad.join('; ') : ''})`); }
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const s0 = JSON.parse(fs.readFileSync(path.join(dir, f))); if (!Object.keys(s0.cities || {}).some(k => (places[k] && places[k].transit || []).length)) continue;
    const s = E.applyPlaces(s0, places), plans = E.planTrip(s), walkMin = km => Math.max(1, Math.round(km * 1.3 / (s.prefs && s.prefs.walk === 'low' ? 3.6 : 4.5) * 60));
    let legs = 0, offered = 0;
    plans.forEach(p => { if (!p || !p.items) return; p.items.forEach((x, k) => { if (x.t !== 'ride') return; const a = p.items[k - 1], b = p.items[k + 1]; if (!a || !b || !isFinite(a.lat) || !isFinite(b.lat)) return;
      const d = E.hav(a, b); if (d < 0.6 || d > 15) return; const t = E.transitOption(a, b, s.transit, walkMin); if (!t || t.min >= walkMin(d)) return;
      legs++; const has = (x.options || []).some(o => o.mode === 'transit'); if (has) offered++; else ok(false, `${f}: ${a.name} to ${b.name}: ${t.how} serves this leg but isn't offered`); }); });
    console.log(`ok   ${s.label || f}: ${offered} of ${legs} rides along a public transport line offer it`);
  } }

// ---- Fitting a wanted stop in: lunch on the go and shorter visits come before giving up a sight, and every way offered
// is checked (the time to be back never moves).
// ---- A day the traveler made their own is planned from their list only (Richard, Nov 18: Naples unticked to add
// Pompeii, and the app filled the day with its own picks so nothing else "fit") ----
// On a day with a time to be back, the app never picks on its own a stop across the water, or one whose water check
// hasn't answered yet (Nov 21 outside check: an island off an old town picked and planned by taxi); the traveler's own still is.
{ const s0 = JSON.parse(fs.readFileSync(path.join(dir, 'sample-cruise.json'))), i = s0.days.findIndex(d => /napl/i.test(d.city));
  const base = E.planTrip(JSON.parse(JSON.stringify(s0)))[i], ids = (base.items || []).filter(x => x.t === 'stop' && !x.bonus).map(x => String(x.id));
  const app = JSON.parse(JSON.stringify(s0)); Object.assign(app.days[i], { own: false, selected: null, mine: [] });
  const pend = JSON.parse(JSON.stringify(app)), ck = pend.days[i].city;
  for (const k of Object.keys(pend.cities)) if (k === ck) ['sites', 'farther'].forEach(f => { pend.cities[k][f] = (pend.cities[k][f] || []).map(x => Object.assign({}, x, { waterPending: true })); });
  const pp = E.planTrip(pend)[i], picked = (pp.items || []).filter(x => x.t === 'stop' && !x.bonus);
  ok(ids.length && !picked.length, `a ship day whose water check is still out picks nothing on its own (base ${ids.length}, now ${picked.map(x => x.name).join(', ') || 'none'})`);
  const wet = JSON.parse(JSON.stringify(app)), keyId = ids[0];
  for (const k of Object.keys(wet.cities)) if (k === ck) wet.cities[k].sites = (wet.cities[k].sites || []).map(x => String(x.id) === keyId ? Object.assign({}, x, { acrossWater: 'An island' }) : x);
  const pw = E.planTrip(wet)[i];
  ok(!(pw.items || []).some(x => x.t === 'stop' && String(x.id) === keyId && !x.bonus), 'a ship day never picks a stop across the water on its own');
  const mine = JSON.parse(JSON.stringify(pend)); Object.assign(mine.days[i], { own: true, selected: [keyId], mine: [keyId] });
  const pm = E.planTrip(mine)[i];
  ok((pm.items || []).some(x => x.t === 'stop' && String(x.id) === keyId), 'the traveler\'s own pick is planned while the water check is out'); }
// Lunch inside the traveler's own island visit goes back on the same boat they chose (Nov 21 live check: an island
// picked alone on a 9 h 45 min ship day "could never fit", because the boat back from the island's lunch place was
// refused as one the app had picked).
{ const s0 = JSON.parse(fs.readFileSync(path.join(dir, 'sample-cruise.json'))), i = s0.days.findIndex(d => /napl/i.test(d.city));
  const b = JSON.parse(JSON.stringify(s0)), ck = b.days[i].city, isle = (b.cities[ck].farther || []).find(x => E.byBoat(x.travelNote) || E.waterOnly(x));
  if (isle) { b.cities[ck].farther = b.cities[ck].farther.map(x => x === isle ? Object.assign({}, x, { minutes: 300 }) : x);
    Object.assign(b.days[i], { own: true, selected: [isle.id], mine: [isle.id] });
    const p = E.planTrip(b)[i], its = p.items || [], si = its.findIndex(x => x.t === 'stop' && String(x.id) === String(isle.id)), mi = its.findIndex(x => x.t === 'meal');
    const back = its.findIndex((x, k) => k > si && x.t === 'ride' && x.kind === 'ferry');
    ok(si >= 0 && mi > si && back > mi && !p.noLunch, `lunch inside the traveler's own island visit, before the boat back (${its.map(x => x.t === 'ride' ? x.kind : x.t).join(' ')}, noLunch ${p.noLunch})`); }
  // The same with a place to eat on the island 1.2 km from the visit's own point (Nov 21 live check: lunch there, then
  // "Taxi or car, 24 mi" back to the ship): after the island, the way off it is the boat, and no taxi on the way back.
  if (isle) { const b2 = JSON.parse(JSON.stringify(b)), far = { id: 'eat-isle-far', name: 'Island Trattoria', lat: isle.lat + 0.011, lng: isle.lng, kind: 'restaurant', amenity: 'restaurant', cuisine: 'italian' };
    b2.cities[ck].restaurants = [far].concat(b2.cities[ck].restaurants || []);
    const p2 = E.planTrip(b2)[i], it2 = p2.items || [], s2 = it2.findIndex(x => x.t === 'stop' && String(x.id) === String(isle.id));
    const after = it2.slice(s2 + 1), firstAway = after.findIndex(x => x.t === 'ride' && x.kind !== 'walk');
    ok(s2 >= 0 && firstAway >= 0 && after[firstAway].kind === 'ferry' && !after.some(x => x.t === 'ride' && x.kind === 'taxi'), `from lunch on the island, the way off it is the boat, never a taxi (${it2.map(x => x.t === 'ride' ? x.kind : x.t + (x.name ? ':' + x.name : '')).join(' ')})`); }
  else ok(false, 'the sample ship day has a place reached by boat'); }
{ const s0 = JSON.parse(fs.readFileSync(path.join(dir, 'sample-cruise.json'))), i = s0.days.findIndex(d => /napl/i.test(d.city));
  const cleared = JSON.parse(JSON.stringify(s0)); Object.assign(cleared.days[i], { own: true, cleared: true, selected: [], mine: [] });
  const pc = E.planTrip(cleared)[i];
  ok(pc && pc.items && !pc.items.some(x => x.t === 'stop'), 'a day the traveler cleared stays free: no sights planned');
  const one = JSON.parse(JSON.stringify(s0)); Object.assign(one.days[i], { own: true, selected: ['pompeii-far'], mine: ['pompeii-far'] });
  const po = E.planTrip(one)[i], st = po && po.items ? po.items.filter(x => x.t === 'stop') : [];
  ok(st.some(x => x.id === 'pompeii-far') && st.every(x => x.id === 'pompeii-far' || x.bonus), 'a day of the traveler\'s own: their pick is planned and anything the app adds is optional');
  const own0 = JSON.parse(JSON.stringify(s0)); Object.assign(own0.days[i], { own: true, selected: [], mine: [] });
  const p0 = E.planTrip(own0)[i]; ok(p0 && p0.items && p0.items.filter(x => x.t === 'stop').every(x => x.bonus), 'an emptied list of their own: anything planned is optional, never in the way of a pick'); }
{ const f = path.join(dir, 'sample-cruise.json');
  if (fs.existsSync(f)) {
    const s0 = JSON.parse(fs.readFileSync(f)), di = 5, base = E.planTrip(s0)[di];
    const ids = base.items.filter(x => x.t === 'stop').map(x => String(x.id)).concat((base.folded || []).map(String));
    const tight = cut => { const s = JSON.parse(JSON.stringify(s0)); Object.assign(s.days[di], { selected: ids, own: true, wantsOnly: false }); s.days[di].allAboard -= cut; return s; }; // the traveler's own picks
    const p20 = E.planTrip(tight(20))[di], meal20 = p20.items.find(x => x.t === 'meal');
    ok(ids.every(id => p20.items.some(x => x.t === 'stop' && String(x.id) === id) || (p20.folded || []).map(String).includes(id)) && meal20 && meal20.min < 60,
      `20 minutes less ashore: every pick kept, the lunch gets quicker instead (lunch ${meal20 && meal20.min} min)`);
    // Cut until a pick has to go (folding sights into the visit around them leaves more time, Nov 20).
    let cutBy = 80; while (cutBy < 240 && !(E.planTrip(tight(cutBy))[di].dropped || []).length) cutBy += 20;
    const s90 = tight(cutBy), p90 = E.planTrip(s90)[di], w = E.dayWindow(s90.days[di], E.makeTravel(s90.prefs, s90.legModes));
    const lost = (p90.dropped || [])[0], ways = lost != null && (p90.waysToFit || {})[lost];
    ok(!!(ways && ways.length), 'a pick that had to go comes with ways to fit it back in');
    if (ways && ways.length) {
      const firstDrop = ways.findIndex(o => o.kind === 'drop');
      ok(firstDrop === -1 || ways.slice(0, firstDrop).length > 0 && ways.slice(firstDrop).every(o => o.kind === 'drop'), 'shorter visits are offered before skipping another sight');
      ok((p90.explain || []).some(e => /To fit it in: spend \d+ minutes less at/.test(e)), 'the plan says the ways in plain words');
      for (const o of ways.filter(o => o.kind === 'shorten')) {
        const s = JSON.parse(JSON.stringify(s90)); const c = Object.values(s.cities).find(c => (c.sites || []).some(x => String(x.id) === String(o.id)));
        c.sites.find(x => String(x.id) === String(o.id)).minutes = o.to;
        const q = E.planTrip(s)[di];
        ok(q.items.some(x => x.t === 'stop' && String(x.id) === String(lost)) && q.end <= w.endBy, `"${o.say}" really fits it in, back in time (end ${q.end}, back by ${w.endBy})`);
      }
    }
  } }

// ---- A pick closed on its own day moves to another day of the same stay when it's open then, and the plan says so.
{ const f = path.join(dir, 'g02-vienna.json'), PD = path.join(__dirname, '..', 'places', 'data'), places = {};
  if (fs.existsSync(f) && fs.existsSync(PD)) {
    for (const g of fs.readdirSync(PD).filter(g => g.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, g))); places[p.key] = p; }
    const s = E.applyPlaces(JSON.parse(fs.readFileSync(f)), places), ps = E.planTrip(s);
    s.days.forEach((d, i) => (d.selected || []).forEach(id => { const sd = (d.sites || {})[id];
      if (!sd || !(sd.closed || (sd.oh && sd.oh.spans && !sd.oh.spans.length)) || d.locked) return; // only picks the map says are shut that day
      const j = ps.findIndex((p, k) => k !== i && p && p.items && p.items.some(x => x.t === 'stop' && String(x.id) === String(id)));
      const name = ((s.cities[d.city].sites || []).find(x => String(x.id) === String(id)) || {}).name;
      // (Nov 22: or, when that day is already full, the plan says it didn't fit there either; never "planned on" a day without it.)
      const said = (ps[i].explain || []).find(e => e.startsWith(name + ' is closed on')) || '';
      ok(j >= 0 ? /so it's planned on/.test(said) : /didn't fit on/.test(said), `${name}, shut on its day, is planned on another day of the stay (or said not to fit there), and the plan says so truly (${said})`); })); } }

// ---- Across water: a place reached by boat is reached by boat, its crossing the guide's own time plus the pier, never a taxi.
{ const tb = E.makeTravel({ walk: 'medium' }, {}), port = { lat: 37.46, lng: 25.326 }, isle = { lat: 37.396, lng: 25.268, travelNote: 'About 30 to 40 minutes each way by boat from the old harbor.' };
  const go = tb.estimate(port, isle), back = tb.estimate(isle, port), ship = tb.estimate(isle, Object.assign({}, port, { backToShip: true }));
  ok(go.mode === 'boat' && back.mode === 'boat' && ship.mode === 'boat', 'an island the guide says is reached by boat: by boat both ways, never a taxi');
  ok(go.min === 40 + E.PIER_MIN && go.cross === 40 && go.steps.some(x => /40 min crossing/.test(x)) && go.kind === 'ferry', `the crossing is the guide's time plus the pier, shown apart (got ${go.min} min: ${go.how})`);
  ok(ship.min <= 40 + E.PIER_BACK + Math.max(15, Math.round((40 + E.PIER_BACK) * 0.3 / 5) * 5) && back.min === 40 + E.PIER_BACK, 'back by boat with no sailing times known: a gap between sailings at the pier, and only the usual extra time on top for the ship'); }
// Nov 20 review (finding 1): a boat out never sails before the first boat the guide gives, and the wait shows on the day.
{ ok(E.firstSailing('Boats leave from about 9:00.') === 540 && E.firstSailing('first boat at 9.30 am') === 570 && E.firstSailing('first ferry leaves at 1:15 pm') === 795 && E.firstSailing('30 to 40 minutes by boat') === null, 'the first sailing is read from a guide note');
  ok(E.pierWords('From the old harbor') === 'from the old port' && E.pierWords('Old Port') === 'old port' && E.pierWords('Hafen') === 'port', 'a harbor is a port in every pier name and note');
  const piers = [{ name: 'Ship dock', lat: 37.46, lng: 25.326 }, { name: 'Old port, museum - bus station', lat: 37.451, lng: 25.328 }];
  const tb = E.makeTravel({ walk: 'medium' }, {}, null, null, null, piers), dock = { lat: 37.46, lng: 25.326 }, isle = { lat: 37.396, lng: 25.268, travelNote: 'About 40 minutes by boat from the old harbor. Boats leave from about 9:00.' };
  const go = tb.estimate(dock, isle), boat = (go.parts || []).find(x => x.boat);
  ok(boat && boat.from === 'Old port' && go.parts[0].pierName === 'Old port', `the boat leaves from the pier the guide names (the old harbor), not the ship's dock (got ${boat && boat.from})`);
  ok(go.first && go.first.at === 540, 'the boat out carries the first sailing the guide gives');
  const win = { start: 480, endBy: 1000, hard: true, head: [dock], tail: [dock] }, w = E.walkDay([Object.assign({ id: 'isle', name: 'Isle', minutes: 60 }, isle)], win, (a, b) => tb.estimate(a, b), null);
  const st = w.items.find(x => x.t === 'stop'), ri = w.items.filter(x => x.t === 'ride' && x.mode === 'boat')[0];
  ok(st.at >= 540 + 40 && ri.wait > 0 && ri.firstBoat === 540, `nobody lands on the island before the first boat out could (landed ${E.clock(st.at)}, wait ${ri.wait})`);
  // First-timer walk, Nov 22: an island only the guide suggested (the traveler ticked nothing) is never "planned because
  // you chose it" on a boat no timetable confirms; the traveler's own pick is.
  const walkAs = q => E.walkDay([Object.assign({ id: 'isle', name: 'Isle', minutes: 60 }, isle, q)], win, (a, b) => tb.estimate(a, b), null).items.filter(x => x.t === 'ride' && /boat|ferry/.test(x.mode + x.kind));
  const mine = walkAs({ wish: true }), guide = walkAs({ wish: true, guideWish: true });
  ok(!guide.some(b => /because you chose it/.test(b.note || '') || b.ownBoat), `a guide suggestion's boat is never said to be the traveler's choice (${JSON.stringify(guide.map(b => b.note || ''))})`);
  ok(mine.length === 0 || mine.some(b => b.ownBoat) || mine.every(b => !b.note || !/isn't planned on its own/.test(b.note)), "the traveler's own island pick still keeps its boat"); }
{ let boats = 0; for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const s = JSON.parse(fs.readFileSync(path.join(dir, f))), ps = E.planTrip(s);
    ps.forEach((p, i) => p && p.items && p.items.forEach((x, k) => { if (x.t !== 'ride') return; const a = p.items[k - 1], b = p.items[k + 1], c = s.cities[s.days[i].city] || {};
      const site = it => it && it.id != null && [...(c.sites || []), ...(c.farther || [])].find(y => String(y.id) === String(it.id));
      const boatEnd = x.pierName && x.mode !== 'boat' ? [] : [site(a), site(b)].filter(y => y && E.byBoat(y.travelNote)); // the walk or ride to a pier is on land
      if (boatEnd.length === 1) { boats++; ok(x.mode === 'boat', `${f} day ${i}: the ride to or from ${boatEnd[0].name} crosses water but is planned as ${x.mode}`); } })); }
  console.log(`ok   ${boats} rides across water, every one by boat`); }

// ---- Every ride is the kind it is drawn as (Nov 18, Richard: "floating cars and ferries that drive on land"): a boat
// runs pier to pier (or to a place reached only by boat, or from where no pier is mapped), never from a sight inland; a
// ride by road or rail never crosses to a place reached only by boat. Every trip, with the places files (the piers).
{ const PD = path.join(__dirname, '..', 'places', 'data'), places = {}; let boats = 0, piered = 0;
  if (fs.existsSync(PD)) for (const g of fs.readdirSync(PD).filter(g => g.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, g))); places[p.key] = p; }
  const check = (f, s, plans) => {
  // Every ride is the kind it is drawn as (Nov 18, Richard: "floating cars and ferries that drive on land"): a boat runs
  // pier to pier (or to a place reached only by boat, or from where no pier is mapped), never from a sight inland; a
  // ride by road or rail never crosses to a place reached only by boat.
    { const piers = E.piersOf(s), placeAt = new Map();
    for (const c of Object.values(s.cities)) for (const x of [...(c.sites || []), ...(c.farther || [])]) if (isFinite(x.lat)) placeAt.set(x.lat.toFixed(5) + ',' + x.lng.toFixed(5), x);
    // On an island: at a place reached only by boat, or within 2 km of one (a place to eat in its town, its pier).
    const isles = [...placeAt.values()].filter(x => E.byBoat(x.travelNote) || E.waterOnly(x));
    const boatPlace = q => !!q && isles.some(x => E.hav(x, q) <= 2);
    const near = (q, km) => piers.some(p => E.hav(p, q) <= km);
    plans.forEach((p, i) => { if (!p || !p.items) return; p.items.forEach(x => { if (x.t !== 'ride' || !x.from || !x.to || x.mode === 'lift') return; if (x.mode === 'boat') boats++; if (x.pierName) piered++;
      if (x.mode === 'boat') { for (const q of [x.from, x.to]) ok(near(q, E.PIER_AT) || boatPlace(q) || !near(q, E.PIER_KM),
          `${f}: day ${i + 1} a boat ride starts or ends away from the water (${q.lat},${q.lng}), not at a pier`); }
      else if (x.mode !== 'walk' || E.hav(x.from, x.to) > 1) { const A = boatPlace(x.from), B = boatPlace(x.to);
        ok(A === B || near(A ? x.to : x.from, E.PIER_ISLAND), `${f}: day ${i + 1} a ${x.mode} ride crosses to a place reached only by boat`); } }); }); }
  };
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const s = E.applyPlaces(JSON.parse(fs.readFileSync(path.join(dir, f))), places); check(f, s, E.planTrip(s)); }
  // Naples, the cathedral and Capri picked (Richard's map, Nov 18): the walk to the ferry pier, then the boat from it
  // (a short island visit, so both fit with the wait for a boat back).
  const nf = path.join(dir, 'sample-cruise.json');
  if (fs.existsSync(nf)) { const s = E.applyPlaces(JSON.parse(fs.readFileSync(nf)), places), ni = s.days.findIndex(d => /naples/i.test(d.city));
    if (ni >= 0) { s.days[ni].selected = ['duomo-na', 'capri-far']; s.days[ni].own = true; (s.cities[s.days[ni].city].farther || []).forEach(x => { if (x.id === 'capri-far') x.minutes = 120; });
      // Ship safety (Nov 21 outside review): with no sailing times known, the island isn't planned on a ship day, and says why.
      s.answers = () => null; const p0 = E.planTrip(s)[ni];
      // Richard, Nov 21 ("Yes, your pick, with a warning"): the island the traveler picked is planned on the guide's boat all
      // the same, said plainly, with the hour at the pier for the boat back; the final check lets it through.
      const boats0 = (p0.items || []).filter(x => x.t === 'ride' && x.kind === 'ferry');
      ok(!p0.safe && boats0.length === 2 && boats0.every(b => b.ownBoat && /planned because you chose it/.test(b.note || '')) && boats0.some(b => b.isle === 'back' && b.pier >= E.PIER_BACK) && (p0.items || []).some(x => x.t === 'stop' && /duomo|cathedral/i.test(x.id + ' ' + x.name)),
        'ship day, an island the traveler picked with no sailing times known: planned on their pick, with the warning and an hour at the pier for the boat back');
      // With the boat's timetable (sailings every half hour, 7:00 to 20:00): planned, the walk to the pier, then the boat.
      const capri = (s.cities[s.days[ni].city].farther || []).find(x => x.id === 'capri-far'), deps = []; for (let t = 7 * 60; t <= 20 * 60; t += 30) deps.push({ t });
      s.answers = (a, b) => capri && (E.hav(a, capri) < 3 || E.hav(b, capri) < 3) ? [{ id: 'f1', mode: 'ferry', label: 'Ferry', min: 55, every: 30, deps }] : null;
      const p = E.planTrip(s)[ni], rides = (p.items || []).filter(x => x.t === 'ride'); delete s.answers;
      const its = p.items || [], ks = its.map((x, k) => x.t === 'ride' && x.mode === 'boat' ? k : -1).filter(k => k > 0);
      ok(ks.length === 2 && ks.every(k => its[k].source === 'timetable') && ks.some(k => { const before = its[k - 1]; return before.t === 'ride' && before.pierName && before.to && E.hav(before.to, its[k].from) < 0.01; }),
        'Naples: the island and the cathedral, a walk or ride to the ferry pier, then the boat from the pier (sailings known)');
      check('sample-cruise.json (cathedral and Capri)', s, [].concat(new Array(ni).fill(null), [p])); } }
  // The pier the guide's note names is the one taken, when it is mapped (not merely the nearest pier).
  { const t = E.makeTravel({}, null, null, [], null, [{ name: 'Near Pier', lat: 40.8429, lng: 14.2612 }, { name: 'Named Quay (Terminal)', lat: 40.8374, lng: 14.2548 }]);
    const e = t.estimate({ lat: 40.8525, lng: 14.2597 }, { lat: 40.5532, lng: 14.2222, travelNote: 'About 50 minutes by fast ferry from Named Quay.' });
    ok(e.parts && e.parts[0].pierName === 'Named Quay (Terminal)' && /from Named Quay/.test(e.how), `the boat leaves from the pier the guide names (got ${e.parts && e.parts[0].pierName})`); }
  // Lunch on every day over lunchtime (Nov 18, Richard: "No lunch in Naples trip"): a day with stops whose time ashore
  // or in town spans lunch has a lunch stop, at a real place, unless the traveler skipped it; a long visit over midday
  // has it inside. Every trip, and the Naples picks that had none (Capri and Pompeii, Capri alone, the cathedral too).
  { let days = 0, said = 0; const noLunch = [], shutAt = [];
    const lunchCheck = (f, s, plans) => plans.forEach((p, i) => { if (!p || !p.items || p.error || p.safe) return; const d = s.days[i]; if (((d.mealPrefs || {}).Lunch || {}).skip) return;
      const w = E.dayWindow(d, E.makeTravel(s.prefs, s.legModes)); if (!w || w.error || !E.lunchWanted(w) || !p.items.some(x => x.t === 'stop')) return;
      const c = s.cities[d.city] || {}; if (!(c.restaurants || []).length && !(c.farther || []).some(t => (t.foodDrink || []).length)) return; // no place to eat known at all
      days++; const m = p.items.find(x => x.t === 'meal' && x.meal === 'Lunch');
      // ...and open then: the day's facts, else the place's own map hours for that date (Nov 23 real-map check: Sorbillo at
      // 11:45 when it opens at noon, Han Gang at 12:03 when it opens at 1 pm).
      if (m && !m.packed && !m.onBoard && !m.booked && !m.chosen) { const fx = E.eatFactsFor(d, (c.restaurants || []).concat((c.farther || []).flatMap(t => (t.foodDrink || []).filter(x => x.kind === 'eat'))))[E.eatKey(m.name)];
        if (fx && E.closedForDay(fx, { start: m.at, endBy: m.at + m.min }, m.min)) shutAt.push(`${f} day ${i + 1}: ${m.name} at ${E.clock(m.at)} (${fx.mapHours || 'day facts'})`); }
      // None only when the plan says why, plainly (no time left before the ship; no place to eat known out there).
      if (!m && !(p.explain || []).some(t => /no room for lunch|no time for a sit-down lunch|no place to eat|places to eat aren't in the guide/i.test(t))) noLunch.push(`${f} day ${i + 1}`); else if (!m) said++; else if (/^Lunch in /.test(m.name) && (c.farther || []).some(t => ('Lunch in ' + t.name) === m.name && (t.foodDrink || []).some(x => x.kind === 'eat' && isFinite(x.lat) && E.hav(x, t) <= 3))) noLunch.push(`${f} day ${i + 1}: "${m.name}" names no place`); });
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const s = E.applyPlaces(JSON.parse(fs.readFileSync(path.join(dir, f))), places); lunchCheck(f, s, E.planTrip(s)); }
    if (fs.existsSync(nf)) for (const picks of [['capri-far', 'pompeii-far'], ['capri-far'], ['duomo-na', 'capri-far', 'pompeii-far'], ['pompeii-far'], ['sorrento-far', 'pompeii-far']]) {
      const s = E.applyPlaces(JSON.parse(fs.readFileSync(nf)), places), ni = s.days.findIndex(d => /naples/i.test(d.city)); if (ni < 0) continue;
      s.days[ni].selected = picks; s.days[ni].own = true; const ps = E.planTrip(s); lunchCheck('Naples ' + picks.join('+'), s, ps.map((p, k) => k === ni ? p : null));
      check('Naples ' + picks.join('+'), s, ps.map((p, k) => k === ni ? p : null)); }
    for (const x of noLunch.slice(0, 8)) ok(false, `no lunch on a day over lunchtime: ${x}`);
    for (const x of shutAt.slice(0, 8)) ok(false, `lunch at a place shut at that hour: ${x}`);
    ok(!shutAt.length, `every planned lunch is at a place not known to be shut then (map hours read for the date)`);
    { const b = E.applyPlaces({ cities: { X: { restaurants: [{ name: 'Sorbillo', lat: 40.85, lng: 14.255 }, { name: 'Far Away Grill', lat: 40.86, lng: 14.255 }, { name: 'Bar', lat: 40.85, lng: 14.255 }] } }, days: [] },
        { X: { key: 'X', eatHours: [['Antonio Sorbillo', 40.8503, 14.255, 'Mo-Sa 12:00-15:30', 'restaurant'], ['Far Away Grill', 40.85, 14.255, 'Mo-Su 10:00-22:00', 'restaurant'], ['Barolo Wine', 40.85, 14.255, 'Mo-Su 18:00-23:00', 'bar']] } });
      const rs = b.cities.X.restaurants;
      ok(rs[0].hours === 'Mo-Sa 12:00-15:30' && !rs[1].hours && !rs[2].hours, 'a guide place to eat takes the map hours of the place with its name within 200 m (never a far one, never on a short name)'); }
    // A nearby town's places to eat take their map hours too (Nov 23 release gate: Komokieras in Sitges at 11:45, opens 13:15).
    { const b = E.applyPlaces({ cities: { X: { restaurants: [], farther: [{ id: 'tn', name: 'Townie', lat: 41.2372, lng: 1.8067 }] } }, days: [] },
        { X: { key: 'X', towns: { tn: { foodDrink: [{ kind: 'eat', name: 'Komokieras', lat: 41.2372466, lng: 1.8067256 }] } }, eatHours: [['Komokieras', 41.23719, 1.80675, 'Th-Mo 13:15-15:30, 20:30-23:00; Tu off, We off', 'restaurant']] } });
      const t = (b.cities.X.farther || []).find(x => x.id === 'tn'), r = t && (t.foodDrink || []).find(x => x.name === 'Komokieras');
      const fx = r && E.eatFactsFor({ date: '2027-07-03' }, [r])[E.eatKey('Komokieras')];
      ok(!!(r && r.hours && fx && fx.oh && JSON.stringify(fx.oh.spans[0]) === '[795,930]' && E.closedForDay(fx, { start: 705, endBy: 765 }, 60)),
        "a nearby town's place to eat takes its map hours, so lunch there waits for it to open (Komokieras opens 13:15)"); }
    { const fx = E.eatFactsFor({ date: '2026-11-23', eats: {} }, [{ name: 'Noon Place', hours: 'Mo-Sa 12:00-15:30; Su off' }, { name: 'Sunday Shut', hours: 'Mo-Sa 12:00-15:00' }, { name: 'Odd', hours: 'Jun-Sep 12:00-15:00' }, { name: 'Junk', hours: 'ask the owner' }]);
      const sun = E.eatFactsFor({ date: '2026-11-22' }, [{ name: 'Noon Place', hours: 'Mo-Sa 12:00-15:30; Su off' }]);
      ok(fx[E.eatKey('Noon Place')] && JSON.stringify(fx[E.eatKey('Noon Place')].oh.spans) === '[[720,930]]' && sun[E.eatKey('Noon Place')].closed && fx[E.eatKey('Odd')] && fx[E.eatKey('Odd')].closed && !fx[E.eatKey('Junk')]
        && E.eatShut(sun[E.eatKey('Noon Place')], 'Lunch') && !E.eatShut(fx[E.eatKey('Noon Place')], 'Lunch'),
        'a place to eat with map hours: open spans read for the date, shut on its day off and out of its season (one hours reader), unreadable hours left unknown'); }
    if (!noLunch.length) oks++; console.log(`ok   lunch on ${days - said - noLunch.length} of ${days} days over lunchtime (${said} say plainly why not)${noLunch.length ? ', missing silently on ' + noLunch.length : ''}`); }
  console.log(`ok   every ride the kind it is drawn as: ${boats} boat rides, ${piered} rides to or from a pier`); }

// ---- The whole trip (step 6 to 8): same plan whatever order the pieces arrive in, nothing used twice, every day safe.
const shuffle = (a, seed) => { const b = a.slice(); let x = seed; for (let i = b.length - 1; i > 0; i--) { x = (x * 1103515245 + 12345) % 2147483648; const j = x % (i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const planKey = plans => JSON.stringify(plans.map(p => p && (p.error || p.items.map(x => x.t + ':' + (x.id || x.name || x.mode) + '@' + (x.at != null ? x.at : x.min)).join(','))));
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const s = JSON.parse(fs.readFileSync(path.join(dir, f))), plans = E.planTrip(s), base = planKey(plans);
  let same = 0;
  for (let k = 1; k <= 10; k++) {
    const t = JSON.parse(JSON.stringify(s));
    for (const c of Object.values(t.cities)) { c.sites = shuffle(c.sites || [], k * 7); c.farther = shuffle(c.farther || [], k * 11); c.restaurants = shuffle(c.restaurants || [], k * 13); }
    // the guide's own order is a fact (best first), so it travels with each sight rather than with its place in the list
    for (const c of Object.values(t.cities)) { const was = (s.cities[c.key] || Object.values(s.cities).find(x => x.name === c.name) || {}).sites || []; c.sites.sort((a, b) => was.findIndex(x => x.id === a.id) - was.findIndex(x => x.id === b.id)); }
    t.days.forEach(d => { if (d.selected) d.selected = shuffle(d.selected, k * 17); });
    if (planKey(E.planTrip(t)) === base) same++; else ok(false, `${f}: shuffle ${k} gives a different plan`);
  }
  const sights = new Map(), eats = new Map(); let unsafe = 0;
  plans.forEach((p, i) => { if (!p || p.error) return; const w = E.dayWindow(s.days[i], E.makeTravel(s.prefs, s.legModes));
    if (w.hard && p.end > w.endBy) unsafe++;
    p.items.forEach(x => { if (x.t === 'stop') { if (x.late) unsafe++; const was = sights.get(String(x.id)); if (was != null && was !== i) ok(false, `${f}: ${x.name} planned on day ${was} and day ${i}`); sights.set(String(x.id), i); }
      if ((x.t === 'meal' || x.t === 'evening') && x.name && !x.packed && !x.onBoard) { const k = x.name.toLowerCase(); const was = eats.get(k); if (was != null && was !== i) ok(false, `${f}: ${x.name} used on day ${was} and day ${i}`); eats.set(k, i); } }); });
  ok(unsafe === 0, `${f}: ${unsafe} unsafe stops or late days`);
  // A sight with its own finished guide, a must-see, or the traveler's pick is never folded away into a visit next door.
  const planned = new Set([...sights.keys()]); let kept = 0;
  for (const c of Object.values(s.cities)) for (const g of (c.sites || []).filter(x => x.hasGuide || x.mustSee)) {
    if (planned.has(String(g.id))) { kept++; continue; }
    const gr = E.makeGroups(c.sites || []), holder = gr.groupOf.get(String(g.id));
    // Folded: its group is visited on a day with room for it too, and the plan doesn't say why it was left out.
    const gd = holder != null ? sights.get(String(holder)) : null, gp = gd != null && plans[gd], gw = gp && E.dayWindow(s.days[gd], E.makeTravel(s.prefs, s.legModes));
    const room = gw && isFinite(gw.endBy) ? gw.endBy - gp.end : 0, said = gp && ((gp.explain || []).join(' ').includes(g.name) || (gp.leftOut || []).map(String).includes(String(g.id)) || (gp.suggest || []).some(x => String(x.id) === String(g.id))); // offered in the free time counts (the traveler fills it)
    const beside = gd != null && !said && room >= (g.minutes || 30) + 25;
    if (beside) ok(false, `${f}: ${g.name} has its own guide or is a must-see, but was folded into the visit to the group around it`); }
  // Free time is the traveler's (Nov 18, Richard): the app never puts a sight on a day on its own; what would fit is
  // offered beside the plan, never on it.
  plans.forEach((p, i) => { if (!p || !p.items) return; const extra = p.items.filter(x => x.t === 'stop' && x.bonus);
    ok(!extra.length, `${f}: day ${i + 1} has sights the app added on its own: ${extra.map(x => x.name).join(', ')}`);
    const on = new Set(p.items.filter(x => x.t === 'stop').map(x => String(x.id)));
    ok(!(p.suggest || []).some(x => on.has(String(x.id))), `${f}: day ${i + 1} offers a sight already on the plan`);
    // Must-sees and finished voiced tours that fit the free time come first and say so (Nov 19: Richard missed two).
    const byId = new Map(); for (const c of Object.values(s.cities)) for (const g of (c.sites || []).concat(c.farther || [])) byId.set(String(g.id), g);
    const sg = p.suggest || []; let seenPlain = false;
    sg.forEach(x => { const g = byId.get(String(x.id)); if (!g) return; const star = !!(g.mustSee || (g.tags || []).includes('must-see') || g.hasGuide);
      ok(star === !!(x.must || x.voiced), `${f}: day ${i + 1} offers ${x.name} without marking it a must-see or voiced tour`);
      if (star && seenPlain) ok(false, `${f}: day ${i + 1} lists ${x.name} (must-see or voiced tour) after a plain sight`); if (!star) seenPlain = true; }); });
  if (f === 'sample-cruise.json') ok(plans.some(p => p && p.items && p.items.some(x => x.t === 'stop' && /Saint Titus/.test(x.name))), 'Heraklion: the Church of Saint Titus, a finished voiced tour, keeps its own stop');
  oks += same; console.log(`ok   ${s.name}: same plan in ${same} of 10 shuffles, nothing used twice, every day safe`);
}
// ---- Nov 18, 11 PM (Richard's Jul 2 screenshot): Athens to Acrocorinth was "Train or car: 80 min as the guide says, plus 15
// to get going", drawn as a taxi, beside "Taxi 19 min to Athina, then Train A4, then a taxi 30 min, 3 h 28".
{ const plaka = { lat: 37.9725, lng: 23.73 }, acro = { lat: 37.8890, lng: 22.8690, travelNote: 'A 10-minute drive up from Ancient Corinth (about 1 hour 20 minutes from Athens); taxis wait at Ancient Corinth.' };
  const A4 = { mode: 'train', ref: 'A4', stops: [{ name: 'Athina', lat: 37.9923, lng: 23.7210 }, { name: 'Korinthos', lat: 37.9180, lng: 22.9300 }] };
  const e = E.makeTravel({}, {}, null, [A4]).estimate(plaka, acro);
  ok(e.kind === 'taxi' && e.how === 'Taxi or car' && !(e.options || []).some(o => /then a taxi|Taxi \d+ min to/.test(o.how)), `Athens to Acrocorinth offline: a taxi called a taxi, no train stitched to taxis (got ${e.how}; ${(e.options || []).map(o => o.how).join(' | ')})`);
  // Nov 19, Richard: "Is there a train". Offline, the mapped train is offered beside the taxi, with every step said: the taxi
  // to the station (beyond a walk), the train, and the taxi from the station; its label is the train alone, and its time
  // counts the taxis and up to half an hour's wait for an hourly train.
  const tr = (e.options || []).find(o => o.kind === 'train');
  ok(tr && tr.how === 'Train A4, Athina to Korinthos' && /^Taxi \d+ min to Athina station$/.test(tr.steps[0]) && /^Train A4, Athina to Korinthos, \d+ min/.test(tr.steps[1]) && /^Taxi \d+ min from Korinthos station$/.test(tr.steps[2]) && tr.min >= 110 && tr.min <= 170,
    `Athens to Acrocorinth offline: the mapped train is offered, with the taxis to and from the stations said (got ${tr ? tr.how + ' ' + tr.min + ' min: ' + tr.steps.join(' / ') : 'no train'})`);
  // A station farther than a walk counts only for a long ride, and only a train station: never a taxi to a metro stop across town.
  const M1 = { mode: 'subway', ref: 'M1', stops: [{ name: 'Far A', lat: 37.9923, lng: 23.7210 }, { name: 'Far B', lat: 37.9180, lng: 22.9300 }] };
  const em = E.makeTravel({}, {}, null, [M1]).estimate(plaka, acro);
  ok(!(em.options || []).some(o => /Taxi \d+ min to/.test((o.steps || [])[0] || '')), 'beyond a walk only a train station counts: no taxi to a metro stop');
  const near = { lat: 37.9923 - 0.04, lng: 23.7210 }, nb = E.makeTravel({}, {}, null, [A4]).estimate(plaka, near);
  ok(!(nb.options || []).some(o => /Taxi \d+ min to/.test((o.steps || [])[0] || '')), 'a short ride never gets a taxi to a station');
  ok(/The guide says/.test(e.note || '') && !/guide says/.test(e.how), 'the guide\'s words sit beside the ride as a note');
  const ans = () => [{ id: 'rail|A4', min: 105, label: 'Train A4', mode: 'rail', steps: ['Metro M1 to Athina', 'Train A4, Athina to Korinthos', 'Taxi 15 min from Korinthos'], access: { how: 'walk', min: 8 }, egress: { how: 'taxi', min: 15 } }];
  const on = E.makeTravel({}, {}, null, [A4], ans).estimate(plaka, acro);
  ok(on.kind === 'train' && on.how === 'Train A4' && on.steps.length === 3 && on.options.find(o => o.kind === 'taxi').how === 'Taxi or car', 'with the timetable\'s answer (as the demo has it): the train, its steps, the taxi beside it'); }
// ---- A ride choice changes the clock, never the order, and never turns into "not known" (Nov 19, Richard's Jul 2: the train
// home was offered, he picked it, the day went back and forth across Corinth and then said there was no train). On every
// day of every test trip, with timetable answers, each other way offered on a ride is picked in turn: the stops keep their
// order, and no ride says the way picked isn't known.
{ let tried = 0, moved = 0, lostN = 0, notTaken = 0;
  const fake = (a, b) => { const d = E.hav(a, b); return d < 1.5 ? [] : [{ id: 'rail|T7', min: Math.round(d * 1.4 + 25), label: 'Train T7', mode: 'rail', steps: ['Train T7'], access: { how: 'walk', min: 5 }, egress: { how: 'walk', min: 5 } }]; };
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const s0 = JSON.parse(fs.readFileSync(path.join(dir, f))); s0.answers = fake; const base = E.planTrip(s0);
    base.forEach((p, i) => { if (!p || !p.items) return; const order = p.items.filter(x => x.t === 'stop').map(x => x.id).join('>');
      const r = p.items.find(x => x.t === 'ride' && x.from && x.to && (x.options || []).length > 1); if (!r) return;
      for (const o of r.options.filter(o => o.id !== r.choice && o.kind !== 'walk')) { tried++;
        const s = Object.assign({}, s0, { legModes: Object.assign({}, s0.legModes || {}, { [E.pairKey(r.from, r.to)]: o.id }) }), q = E.planTrip(s)[i];
        if (!q || !q.items) continue; const o2 = q.items.filter(x => x.t === 'stop').map(x => x.id).join('>');
        const common = x => x.split('>').filter(id => order.split('>').includes(id) && o2.split('>').includes(id)).join('>'); // a faster or slower way can change which stops fit; never their order
        const sameSet = order.split('>').sort().join() === o2.split('>').sort().join(); // with other stops the best route is another route
        if (sameSet && o2 !== order) { moved++; if (moved <= 3) ok(false, `${f} day ${i + 1}: picking ${o.how} moved the stops: ${order} -> ${o2}`); }
        const l = q.items.find(x => x.t === 'ride' && x.lost); if (l) { lostN++; if (lostN <= 3) ok(false, `${f} day ${i + 1}: picking ${o.how} on one ride made another say "${l.lost} not known"`); }
        // and the way picked is the way planned (Nov 19: the train picked was planned as a taxi, with no word why)
        const same = q.items.find(x => x.t === 'ride' && x.from && x.to && E.pairKey(x.from, x.to) === E.pairKey(r.from, r.to));
        if (sameSet && same && same.choice !== o.id && !same.lost && !/isn't planned on a day with a time to be back|shows no departure near|aren't known yet|couldn't be read yet/.test(same.note || '')) { notTaken++; if (notTaken <= 3) ok(false, `${f} day ${i + 1}: picked ${o.how}, the plan took ${same.how}`); } } }); }
  ok(tried > 30 && !moved && !lostN && !notTaken, `a ride choice is the way planned, never moves the stops or turns into "not known" (${tried} choices tried)`); }
// The ride home from Acrocorinth by train, picked: the stops stay, the train is the ride home, nothing says "no train".
{ const s = JSON.parse(fs.readFileSync(path.join(dir, 'corinth-day.json'))), i = 3, hotel = { lat: 37.9725, lng: 23.73 }, acro = s.cities.athens.farther.find(x => x.id === 'acrocorinth-far');
  s.answers = (a, b) => (E.hav(a, acro) < 0.3 && E.hav(b, hotel) < 0.3) || (E.hav(b, acro) < 0.3 && E.hav(a, hotel) < 0.3) ? [{ id: 'rail|P', min: 160, label: 'Train P', mode: 'rail', steps: ['Train P'] }] : [];
  const before = E.planTrip(s)[i].items.filter(x => x.t === 'stop').map(x => x.id).join('>');
  s.legModes = Object.assign({}, s.legModes, { [E.pairKey(acro, hotel)]: 'train' }); const p = E.planTrip(s)[i];
  ok(p.items.filter(x => x.t === 'stop').map(x => x.id).join('>') === before && p.items.some(x => x.t === 'ride' && x.kind === 'train') && !p.items.some(x => x.lost), 'the train home from Acrocorinth, picked: same stops, the train is the ride, nothing says "no train"'); }
// ---- The ride back from a far sight keeps the guide's time for it (Nov 19: back from a lagoon the guide puts 1 h 30 min
// away, timed as a 55 min taxi to lunch in the town by the port, whose note said "5 minutes by taxi"). With the places
// files, on every planned day and on each far sight picked alone: a ride from a far sight to a point within 5 km of where
// the day starts takes at least the guide's time.
{ const PD = path.join(__dirname, '..', 'places', 'data'), places = {}; let n = 0, bad = 0;
  if (fs.existsSync(PD)) for (const g of fs.readdirSync(PD).filter(g => g.endsWith('.json'))) { const q = JSON.parse(fs.readFileSync(path.join(PD, g))); places[q.key] = q; }
  const tr0 = E.makeTravel({}, {});
  const look = (f, i, p, d) => { if (!p || !p.items) return; const o = p.items[0], c = p.items.find(x => x.t === 'start') || o;
    const start = (d && d.startAt) || null; const home = p.items.filter(x => isFinite(x.lat))[0] || null;
    p.items.forEach((x, k) => { if (x.t !== 'ride' || !x.from || !x.to) return; const a = p.items[k - 1]; if (!a || a.t !== 'stop') return;
      const src = d.src.find(y => String(y.id) === String(a.id)); const said = src && src.travelNote ? tr0.saidMin(src.travelNote) : 0;
      if (!said || !home || E.hav(x.to, home) > 5 || E.hav(x.from, home) < 15) return; n++;
      if (x.min < said) { bad++; if (bad <= 3) ok(false, `${f} day ${i + 1}: back from ${a.name} in ${x.min} min; the guide says ${said}`); } }); };
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const s0 = E.applyPlaces(JSON.parse(fs.readFileSync(path.join(dir, f))), places);
    s0.days.forEach((d, i) => { const city = s0.cities[d.city]; if (!city || d.noShore || d.type === 'sea') return; const src = (city.farther || []);
      for (const far of src.filter(t => !t.town && t.travelNote).slice(0, 4)) {
        const s = Object.assign({}, s0, { days: s0.days.map((e, j) => j === i ? Object.assign({}, e, { selected: [far.id], mine: [far.id], own: true }) : e) });
        let p; try { p = E.planTrip(s)[i]; } catch (e) { continue; } look(f, i, p, { src }); } }); }
  ok(n > 20 && !bad, `the ride back from a far sight keeps the guide's time for it (${n} rides back checked)`); }
// ---- Nov 19 outside review, each true finding a rule and a test.
{ const tr = E.makeTravel({}, {}), at = { lat: 38, lng: 23.7 };
  // A place with no map position: never a ride of no time; a taxi guess, said as one.
  for (const q of [{ lat: NaN, lng: NaN }, {}, { lat: null, lng: null }, { lat: 38.1 }]) { const e = tr.estimate(at, q), e2 = tr.estimate(q, at);
    ok(e.min >= 30 && e2.min >= 30 && e.guess && /guess/.test(e.note || ''), `a ride to a place not on the map is a stated guess, never 0 min (got ${e.min} min, ${e.how})`); }
  // The whole visit fits before closing; entry by the last entry when listed.
  const oh = { spans: [[9 * 60, 17 * 60]], last: null };
  ok(E.hoursFit(oh, 16 * 60 + 15, 120).late > 0 && !E.hoursFit(oh, 15 * 60, 120).late && !E.hoursFit(oh, 16 * 60 + 30, 30).late, 'a 2-hour visit is late when started 45 min before closing; on time when it all fits');
  ok(E.hoursFit({ spans: [[9 * 60, 17 * 60]], last: 16 * 60 }, 16 * 60 + 10, 20).late > 0, 'entry after the last entry is late, even for a short visit');
  // A ferry the data has no timetable for: never marked as timetabled, and says to check the sailings.
  const isle = { lat: 40.5532, lng: 14.2222, travelNote: 'About 50 minutes by fast ferry.', boatOnly: true }, f = tr.estimate({ lat: 40.8525, lng: 14.2597 }, isle);
  ok(f.kind === 'ferry' && (!f.timetable && f.source !== 'timetable' && (f.steps || []).some(x => /No sailing times are known/.test(x))), `a ferry without a timetable says so (got ${f.kind} ${f.source} ${(f.steps || []).join(' / ')})`);
  // Every way says where its time comes from; the ride back to the ship on an estimate says so.
  const ship = { lat: 38.3, lng: 23.9, backToShip: true }, r = tr.estimate(at, ship);
  ok((r.options || [r]).every(o => ['timetable', 'map', 'roads', 'guide', 'estimate'].includes(o.source)) && /estimate/.test(r.note || ''), `the ride back to the ship says it is an estimate (got ${r.source}: ${r.note || 'no note'})`); }
// Lunch at a time the place serves it (its listed hours that day); a chosen place shut that day is said, not planned.
{ const L = E.MEALS[0], o = { lat: 0, lng: 0, name: 'A' }, tr = () => ({ min: 0, mode: 'walk', kind: 'walk', how: 'Walk' });
  const day = (start, open) => E.walkDay([{ id: 'eat:x', name: 'X', lat: 0, lng: 0, mealOf: L, len: 60, oh: { spans: open, last: null } }], { start, endBy: 18 * 60, head: [o], tail: [] }, tr, null);
  const a = day(12 * 60, [[13 * 60, 15 * 60]]), m = a.items.find(x => x.t === 'meal');
  ok(m.at === 13 * 60 && !m.shut, `lunch waits for the place to open (at ${E.clock(m.at)})`);
  ok(m.freeBefore === 60, `the hour waiting for the place to open is named free time, never a silent gap (got ${m.freeBefore})`);
  const b = day(12 * 60 + 30, [[11 * 60, 13 * 60]]), mb = b.items.find(x => x.t === 'meal');
  ok(mb.shut && mb.lateMeal >= 30, 'a lunch running past the place\'s closing is marked shut and late');
  const ctx = { mealPrefs: { Lunch: { pick: { name: 'Shut Taverna', lat: 1, lng: 1 } } }, eatFacts: { [E.eatKey('Shut Taverna')]: { closed: false, oh: { spans: [[18 * 60, 23 * 60]], last: null } } }, eats: [] };
  const mp = E.mealPlan(ctx, 'Lunch'); ok(!mp.pick && mp.pickShut === 'Shut Taverna', 'a chosen lunch place shut that day is not planned, and named'); }
// Nov 20 review (finding 2): the extra time for the ship covers the whole way back from the farthest place; a stop near the
// ship on the way back never lowers it, and it only grows with the riding.
{ let worse = 0, n = 0, prev = 0; for (let t = 0; t <= 300; t++) { if (E.slackFor(t) < prev) worse++; prev = E.slackFor(t); }
  ok(!worse && E.slackFor(5) === 0 && E.slackFor(29) === 15 && E.slackFor(60) === 20, 'the extra time for the way back only grows with the riding');
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const s0 = JSON.parse(fs.readFileSync(path.join(dir, f)));
    s0.days.forEach((d, i) => { if (d.type !== 'port') return; const c = s0.cities[d.city] || {}, far = (c.farther || []).filter(x => isFinite(x.lat))[0], near = (c.sites || []).filter(x => isFinite(x.lat) && d.point && E.hav(x, d.point) < 1.5)[0];
      if (!far || !near) return;
      const run = sel => { const s = JSON.parse(JSON.stringify(s0)); s.days[i].selected = sel; s.days[i].own = true; const p = E.planTrip(s)[i]; if (!p || !p.items || !p.items.some(x => x.t === 'stop' && String(x.id) === String(far.id))) return null;
        const k = p.items.findIndex(x => x.t === 'stop' && String(x.id) === String(far.id)); return p.items.slice(k).reduce((a, x) => a + (x.t === 'ride' ? x.slack || 0 : 0), 0); };
      const a = run([far.id]), b = run([far.id, near.id]); if (a == null || b == null) return; n++;
      if (b < a) { worse++; ok(false, `${f} day ${i}: adding ${near.name} beside the ship cut the extra time back from ${far.name} from ${a} to ${b} min`); } }); }
  ok(n >= 3, 'port days with a far place and a sight beside the ship: ' + n); }
// Nov 20 review (finding 3): no ship, train or plane day ends on a train or bus known only from the map (no timetable)
// unless the traveler chose it; it stays offered as a choice.
{ const PD = path.join(__dirname, '..', 'places', 'data'), places = {}; let ends = 0, bad = 0, offered = 0;
  if (fs.existsSync(PD)) for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; }
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const s = E.applyPlaces(JSON.parse(fs.readFileSync(path.join(dir, f))), places);
    E.planTrip(s).forEach((p, i) => { if (!p || !p.items || !p.endBy || s.days[i].type !== 'port') return; const last = p.items.filter(x => x.t === 'ride').pop(); if (!last) return; ends++;
      if (last.source === 'map' && (last.kind === 'train' || last.kind === 'bus')) { bad++; ok(false, `${f} day ${i}: the ride back to the ship is ${last.how}, known only from the map`); }
      if ((last.options || []).some(o => o.source === 'map' && o.kind === 'train')) offered++; }); }
  ok(ends > 20 && !bad, `${ends} ship days end on a ride the app can stand behind (${offered} keep a mapped train as a choice)`); }
// Nov 20 review (finding 4): ONE meal input. A booked table is planned at its own place and time (lunch and dinner), a
// skipped lunch plans no lunch, and a chosen place is the place planned.
{ const f = path.join(dir, 'athens-booked.json');
  if (fs.existsSync(f)) { const s0 = JSON.parse(fs.readFileSync(f)), i = s0.days.findIndex(d => (d.booked || []).length), d0 = s0.days[i], p = E.planTrip(s0)[i];
    for (const b of d0.booked) { const it = p.items.find(x => (x.t === 'meal' || x.t === 'evening') && x.meal === b.label);
      ok(it && it.name === b.place.name && it.booked && Math.abs(it.at - b.from) <= 10, `a booked ${b.label.toLowerCase()} is planned at its table and time (got ${it ? it.name + ' at ' + E.clock(it.at) : 'none'}, booked ${E.clock(b.from)})`); }
    const sk = JSON.parse(JSON.stringify(s0)); sk.days[i].booked = []; sk.days[i].mealPrefs = { Lunch: { skip: true } }; const ps = E.planTrip(sk)[i];
    ok(!ps.items.some(x => x.t === 'meal' && x.meal === 'Lunch'), 'a skipped lunch plans no lunch');
    const r = (s0.cities[d0.city].restaurants || []).filter(x => isFinite(x.lat))[3], ch = JSON.parse(JSON.stringify(s0)); ch.days[i].booked = []; ch.days[i].mealPrefs = { Lunch: { pick: { name: r.name, lat: r.lat, lng: r.lng } } };
    const pc = E.planTrip(ch)[i], lu = pc.items.find(x => x.t === 'meal' && x.meal === 'Lunch');
    ok(lu && lu.name === r.name, `a chosen lunch place is the place planned (chose ${r.name}, got ${lu && lu.name})`);
    const mi = E.mealInput({ mealPrefs: { Lunch: { skip: true } }, booked: [{ label: 'Lunch', from: 735, place: { name: 'T', lat: 1, lng: 1 } }] });
    ok(mi.Lunch.booked && mi.Lunch.at === '12:15' && !mi.Lunch.skip, 'a booked table takes its meal\'s place in the one meal input'); } }
// Nov 20 review (finding 5): a road time estimated from the distance never drops as the distance grows.
{ const tb = E.makeTravel({}, {}); let down = 0, prev = 0; for (let km = 1; km <= 300; km += 0.1) { const m = tb.road(km).min; if (m < prev) down++; prev = m; }
  ok(!down, `the road estimate never gets shorter for a longer ride (${down} drops from 1 to 300 km)`); }
// Weekly ladder, Nov 22: off the ship at 7:00 am with a 10:00 am flight can't work (getting off, the ride, the airport's
// time); the day says so and plans nothing, never "off the ship" before the ship is in.
{ const tb = E.makeTravel({ walk: 'medium' }, {}), w = E.dayWindow(day({ type: 'departure', mode: 'flight', time: '10:00', point: air, thru: { mode: 'ship', time: '07:00', point: { lat: air.lat + 0.1, lng: air.lng + 0.1, name: 'Port' } } }), tb);
  ok(w.error && /won't work/.test(w.error) && w.tooTight > 0, `a 10:00 am flight after a 7:00 am ship: said it can't work (${w.error || 'planned from ' + E.clock(w.start)})`);
  const ok2 = E.dayWindow(day({ type: 'departure', mode: 'flight', time: '15:00', point: air, thru: { mode: 'ship', time: '07:00', point: { lat: air.lat + 0.1, lng: air.lng + 0.1, name: 'Port' } } }), tb);
  ok(!ok2.error && ok2.start >= 7 * 60, `a 3:00 pm flight after a 7:00 am ship is planned, starting once off the ship (${ok2.error || E.clock(ok2.start)})`); }
// Nov 23 (leaving-day thread): off the ship and flying out the same day, the bags LEFT in storage at the start are never
// read as the bags COLLECTED on the way back. With a sight planned, the time to leave it reaches the bags by their time
// (the countdown said "leave Casa Batlló by 11:27", the time to leave for the airport, 41 min too late); with none, the
// traveler is at the luggage storage when the free time begins, and the day's first steps are marked as such.
{ const s0 = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f)))).find(s => (s.days || []).some(d => d.type === 'departure' && d.mode === 'flight' && d.lodging));
  if (s0) { const li = s0.days.findIndex(d => d.type === 'departure' && d.mode === 'flight' && d.lodging);
    for (const empty of [false, true]) for (const fl of ['14:30', '15:30', '18:00']) {
      const s = JSON.parse(JSON.stringify(s0)), d = s.days[li]; Object.assign(d, { time: fl, thru: { mode: 'ship', time: '07:00', point: Object.assign({}, d.lodging, { name: 'Cruise port', lat: d.lodging.lat + 0.01 }) } });
      if (empty) { d.selected = []; d.cleared = true; }
      const p = E.planTrip(s)[li], its = p.items || [], la = p.leaveAt || {}, tag = `off a 7:00 am ship, ${fl} flight${empty ? ', no sights' : ''}`;
      const drop = its.findIndex(x => x.t === 'fixed' && /leave your bags/i.test(x.name || '')), pick = its.findIndex(x => x.t === 'fixed' && /collect/i.test(x.name || ''));
      if (drop < 0 || pick < 0) { ok(p.error || p.straight || (p.items || []).length, `${tag}: planned (${p.error || 'no bag steps'})`); continue; }
      ok(its[drop].head && !its[pick].head, `${tag}: the bags left are a step of the day's start, the bags collected are not`);
      const lastK = its.reduce((a, x, j) => j < pick && (x.t === 'stop' || x.t === 'meal' || (x.t === 'fixed' && x.head)) ? j : a, -1);
      const toBags = its.slice(lastK + 1, pick).reduce((m, x) => m + (x.min || 0) + (x.wait || 0), 0);
      ok(Number.isFinite(la.last) && Number.isFinite(la.bags) && la.last + toBags <= la.bags + 1 && la.bags + (its[pick].min || 0) <= la.out + 1, `${tag}: leaving ${its[lastK] && its[lastK].name} by ${E.clock(la.last)} reaches the bags by ${E.clock(la.bags)}, then the airport ride at ${E.clock(la.out)}`);
      ok(!(p.explain || []).some(t => /^Leave .* by /.test(t)) || (p.explain || []).some(t => t.includes(E.clock(la.last))), `${tag}: the note names the same time to leave the last place`); } } }
// Nov 23 (testing thread's oracle): a flight or train typed in the small hours (before E.NIGHT_DEP) may be this very
// morning or late tonight. Asked once, never guessed; answered "night", the day runs to it after midnight; answered
// "morning", the day is only the way there, setting out the evening before. Ships keep their all-aboard rule.
{ const tb = E.makeTravel({ walk: 'medium' }, {});
  for (const [mode, t] of [['flight', '00:20'], ['flight', '03:10'], ['train', '04:45']]) {
    const ask = E.dayWindow(day({ type: 'departure', mode, time: t, point: air }), tb);
    ok(ask.error && ask.askNight && /early this morning, or late tonight/.test(ask.error), `a ${t} ${mode}, not yet answered: asked this morning or tonight (${ask.error || 'planned'})`);
    const night = E.dayWindow(day({ type: 'departure', mode, time: t, point: air, nightDep: 'night' }), tb);
    ok(!night.error && night.endBy > 24 * 60 - 200 && night.endBy > night.start, `a ${t} ${mode} tonight: be there by ${E.clock(night.endBy)} after midnight`);
    const morn = E.dayWindow(day({ type: 'departure', mode, time: t, point: air, nightDep: 'morning' }), tb), r = !morn.error && E.walkDay([], morn, tb.estimate, null);
    ok(!morn.error && morn.endBy < E.toMin(t) && r && r.end <= morn.endBy + 1 && morn.start < morn.endBy, `a ${t} ${mode} this morning: set out ${morn.error || E.clock(morn.start)}, there by ${E.clock(morn.endBy)}`); }
  const late = E.dayWindow(day({ type: 'departure', mode: 'flight', time: '06:30', point: air }), tb);
  ok(!late.error || !late.askNight, 'a 6:30 am flight is this morning\'s, never asked');
  const ship = E.dayWindow(day({ type: 'embark', allAboard: 30, boardAt: null }), tb);
  ok(!ship.askNight, 'all aboard at 0:30 is the ship\'s own night, never asked');
  // On a whole trip: the question stops the day (no sights); answered "morning", still no sights; "night", a day is planned.
  const s0 = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f)))).find(s => (s.days || []).some(d => d.type === 'departure' && d.lodging));
  if (s0) { const li = s0.days.findIndex(d => d.type === 'departure' && d.lodging);
    for (const nd of ['', 'morning', 'night']) { const s = JSON.parse(JSON.stringify(s0)); Object.assign(s.days[li], { mode: 'flight', time: '03:10', startTime: '09:00', nightDep: nd });
      const p = E.planTrip(s)[li], stops = (p.items || []).filter(x => x.t === 'stop');
      ok(nd === '' ? p.error && p.askNight : nd === 'morning' ? !p.error && !stops.length && p.end <= p.endBy : !p.error && p.endBy > 24 * 60, `a 3:10 am flight on a trip, ${nd || 'unanswered'}: ${p.error ? 'asked' : stops.length + ' sights, there by ' + E.clock(p.endBy)}`); } } }
// Nov 23 (tester round 7a, evening calls h33, w20): a day whose picks are ALL shut in its time says so, each with its
// reason, never "Pick the sights you want" as if nothing was picked; the app adds no sight of its own.
{ const s0 = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f)))).find(s => (s.days || []).some(d => d.type === 'port' && (s.cities[d.city] || {}).sites && s.cities[d.city].sites.length >= 4));
  if (s0) { const pi = s0.days.findIndex(d => d.type === 'port' && (s0.cities[d.city] || {}).sites && s0.cities[d.city].sites.length >= 4), s = JSON.parse(JSON.stringify(s0)), d = s.days[pi], c = s.cities[d.city];
    const shut = c.sites.slice(0, 2).map(x => x.id); c.sites.forEach(x => { if (shut.includes(x.id)) x.visitable = false; });
    Object.assign(d, { selected: shut, own: true, mine: shut });
    const p = E.planTrip(s)[pi], stops = (p.items || []).filter(x => x.t === 'stop'), ex = (p.explain || []).join(' ');
    ok(!stops.length || stops.every(x => shut.includes(x.id)), `every pick shut: no sight of the app's own is added (${stops.map(x => x.name).join(', ')})`);
    if (!stops.length) ok(/None of your picks can be visited/.test(ex) && !/Pick the sights you want/.test(ex), `every pick shut: the day says none of the picks can be visited (${ex.slice(0, 160)})`); } }
// Nov 23 (tester round 7a, finding 109): a field its article calls general aviation, closed or military is never offered,
// also when the map finds it again under its own name or a few hundred metres off with nothing said; a second airport the
// map alone knows stays offered. Terminals of one airport are asked as the terminal, never as "which airport".
{ const L = [{ name: 'Big City Airport', lat: 45.505, lng: 12.352, wiki: true, about: 'Big City Airport (IATA: BCX, ICAO: XXXX) is the international airport of Big City.' },
    { name: 'Island Airfield Airport', lat: 45.428, lng: 12.388, wiki: true, about: 'Island Airfield Airport (ICAO: XXXY) is a general aviation airport on the island.' },
    { name: 'Aeroporto Nicolo', lat: 45.4285, lng: 12.3875, kind: 'aerodrome' }, { name: 'Island Airfield Airport', lat: 45.44, lng: 12.40, kind: 'aerodrome' },
    { name: 'Second Town Airport', lat: 45.65, lng: 12.19, kind: 'aerodrome' }];
  const got = E.gateChoices(L, 'airport').map(x => x.name);
  ok(got.length === 2 && got.includes('Big City Airport') && got.includes('Second Town Airport'), `a general-aviation field is never offered, found by its article or on the map; a real second airport stays (${got.join(', ')})`);
  const tb = E.makeTravel({ walk: 'medium' }, {});
  const t = E.dayWindow(day({ type: 'departure', mode: 'flight', time: '15:00', point: Object.assign({}, air, { name: 'Big City Airport, Terminal 1', ask: ['Big City Airport, Terminal 1', 'Big City Airport, Terminal 2'] }) }), tb);
  ok(t.error && /^Which terminal of Big City Airport do you leave from\?/.test(t.error) && !/more than one here/.test(t.error), `terminals of one airport: asked which terminal (${t.error})`);
  const a = E.dayWindow(day({ type: 'departure', mode: 'flight', time: '15:00', point: Object.assign({}, air, { name: 'Big City Airport', ask: ['Big City Airport', 'Second Town Airport'] }) }), tb);
  ok(a.error && /^Which airport do you leave from\?/.test(a.error), 'two airports: asked which airport'); }
// Nov 23: a late arrival's day ends no sooner than the traveler reaches the hotel (a 9:30 pm flight gave a day of 10:45 to
// 11:00 pm and a plan reaching the hotel at 12:14 am, past its own end).
{ const tb = E.makeTravel({ walk: 'medium' }, {});
  for (const t of ['19:00', '21:30', '23:10']) { const w = E.dayWindow(day({ type: 'arrival', mode: 'flight', time: t, point: air, hours: 4 }), tb), r = E.walkDay([], w, tb.estimate, null);
    ok(!w.error && w.endBy >= w.sightFrom && r.end <= w.endBy + 1, `a ${t} flight in: the day ends at ${E.clock(w.endBy)}, at the hotel by ${E.clock(r.end)}`); } }
// First-timer walk, Nov 22: a 9:00 am train on a day set to start at 9:00 is this morning's: the day starts earlier to
// reach it, with no time for sights (it was taken as the next morning's: sights all day, "free time 16 h 10 min").
{ const tb = E.makeTravel({ walk: 'medium' }, {}), w = E.dayWindow(day({ type: 'departure', mode: 'train', time: '09:00', startTime: '09:00', point: air }), tb);
  ok(!w.error && w.endBy < 9 * 60 && w.start < w.endBy && w.leaveEarly > 0, `a 9:00 am train: be at the station by ${E.clock(w.endBy)}, the day starts ${E.clock(w.start)} (${w.leaveEarly} min early)`);
  ok(w.sightTo <= (w.sightFrom != null ? w.sightFrom : w.start) + 1 || w.sightTo - w.start < 30, `no sightseeing before a 9:00 am train (sights until ${E.clock(w.sightTo)})`);
  // Outside test round 5 (Nov 22): a 6:30 am or 8:00 am flight and a 9:10 am train planned a full day of sights after
  // the departure. On a whole leaving day: no sights, the day never starts after the time to leave, and no free time.
  const s0 = fs.existsSync(dir) && fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f)))).find(s => (s.days || []).some(d => d.type === 'departure'));
  if (s0) { const li = s0.days.findIndex(d => d.type === 'departure');
    for (const [mode, t] of [['flight', '05:00'], ['flight', '05:45'], ['flight', '06:30'], ['flight', '08:00'], ['train', '09:10']]) { const s = JSON.parse(JSON.stringify(s0)); Object.assign(s.days[li], { mode, time: t, startTime: '09:00' });
      const p = E.planTrip(s)[li], stops = (p.items || []).filter(x => x.t === 'stop');
      ok(!stops.length && p.end <= p.endBy && p.end <= E.toMin(t) && !(p.explain || []).some(x => /^Free time/.test(x)), `a ${t} ${mode} on the leaving day: no sights, straight there (${stops.length} sights, ends ${E.clock(p.end)}, be there by ${E.clock(p.endBy)})`); } } }
// Outside test round 5 (Nov 22): a late arrival never gets a dinner the app picked at 11:30 pm or after midnight.
{ const s0 = fs.existsSync(dir) && fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f)))).find(s => (s.days || []).some(d => d.type === 'arrival'));
  if (s0) { const ai = s0.days.findIndex(d => d.type === 'arrival');
    for (const t of ['21:30', '22:00']) { const s = JSON.parse(JSON.stringify(s0)); Object.assign(s.days[ai], { mode: 'flight', time: t }); delete (s.days[ai].mealPrefs || {}).Dinner;
      const ev = (E.planTrip(s)[ai].items || []).find(x => x.t === 'evening');
      ok(!ev || ev.at <= E.DINNER_LAST, `arriving at ${t}: no dinner picked for ${ev ? E.clock(ev.at) : '-'}`); } } }
// Nov 20 review (finding 8): a flight or all aboard after midnight is the next morning's; the day stays readable and no
// clock prints a minus sign.
{ const tb = E.makeTravel({ walk: 'medium' }, {});
  // (Nov 23: a small-hours departure is asked first; answered "tonight" it is the next morning's.)
  for (const t of ['00:40', '05:30']) { const w = E.dayWindow(day({ type: 'departure', mode: 'flight', time: t, point: air, nightDep: 'night' }), tb);
    ok(!w.error && w.endBy > w.start && !/-/.test(E.clock(w.endBy)), `a flight at ${t}: the day runs to ${E.clock(w.endBy)} (start ${E.clock(w.start)})`); }
  const wp = E.dayWindow(day({ type: 'port', portArrive: 480, allAboard: 60 }), tb);
  ok(!wp.error && wp.endBy > wp.start && wp.endBy === 60 + 1440 - wp.buffer, `all aboard at 1:00 am: ashore until ${E.clock(wp.endBy)}`);
  ok(E.clock(-17) === '11:43 pm' && E.clock(1440 + 40) === '12:40 am' && E.clock(13 * 60 + 5) === '1:05 pm', 'a clock time never shows a minus sign'); }
// Each plan line has a kind for the screens (act / free / info), and the app may set the clock format.
{ let n = 0, bad = 0; if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) E.planTrip(JSON.parse(fs.readFileSync(path.join(dir, f)))).forEach(p => { if (!p || !p.explain) return; n++;
    if (p.explain.some(t => /^(Free time|Time left for|Nothing left to plan)/.test(t) !== (E.explainKind(t) === 'free') || (/didn't fit/.test(t) && E.explainKind(t) !== 'act'))) bad++; });
  ok(n > 50 && !bad, `every plan's lines carry their kind (${n} plans, ${bad} wrong)`);
  E.clockFmt = m => 'T' + m; const c = E.clock(600); E.clockFmt = null; ok(c === 'T600' && E.clock(600) === '10:00 am', 'the app can set the clock format; the engine\'s own is am/pm'); }
// The final check reads the plan itself: a ride of no time between places apart, a guessed ride on a ship day, or a ride
// back with no extra time each make the day unsafe; and every planned ship day passes it.
{ const win = { hard: true, endBy: 17 * 60 }, A = { lat: 38, lng: 23.7 }, B = { lat: 38.05, lng: 23.75 };
  const plan = x => ({ end: 16 * 60, items: [{ t: 'start', name: 'Port' }, Object.assign({ t: 'ride', mode: 'ride', from: A, to: B }, x), { t: 'end', name: 'Port' }] });
  ok(E.guardPlan(plan({ min: 0 }), win).length && E.guardPlan(plan({ min: 40, guess: true, slack: 15 }), win).length && E.guardPlan(plan({ min: 40 }), win).length && !E.guardPlan(plan({ min: 40, slack: 15 }), win).length,
    'the final check catches a ride of no time, a guessed ride and a ride back with no extra time on a ship day');
  let shipDays = 0, safe = 0; for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const s = JSON.parse(fs.readFileSync(path.join(dir, f))); E.planTrip(s).forEach((p, i) => { if (p && p.items && s.days[i].type === 'port') { shipDays++; if (p.safe) safe++; } }); }
  ok(shipDays > 10 && safe <= 2, `ship days still planned in full under the final check (${shipDays - safe} of ${shipDays})`); }
// Ship safety, boats (Nov 21 outside review): on a day with a time to be back, a boat is planned only on a sailing a
// timetable confirms for the day; the final check reads where every boat's time comes from, not only how long it is.
{ const win = { hard: true, endBy: 17 * 60 }, A = { lat: 38, lng: 23.7 }, B = { lat: 38.05, lng: 23.75 };
  const plan = x => ({ end: 16 * 60, items: [{ t: 'start', name: 'Port' }, Object.assign({ t: 'ride', mode: 'boat', kind: 'ferry', from: A, to: B, min: 105, slack: 25 }, x), { t: 'end', name: 'Port' }] });
  ok(!E.guardPlan(plan({ source: 'guide', ownBoat: 'x', isle: 'back', pier: 60 }), win).length && E.guardPlan(plan({ source: 'guide', ownBoat: 'x', isle: 'back', pier: 15 }), win).length && E.guardPlan(plan({ source: 'guide' }), win).length && E.guardPlan(plan({ source: 'estimate' }), win).length && E.guardPlan(plan({ source: 'timetable', unsure: 'x' }), win).length && !E.guardPlan(plan({ source: 'timetable' }), win).length
    && !E.guardPlan(plan({ source: 'guide' }), { hard: false, endBy: 17 * 60 }).length,
    'final check: a boat on a ship day from the guide or an estimate is refused; a confirmed sailing passes; a day with no time to be back is not held to it');
  const deps = (from, to, every) => { const r = []; for (let t = from; t <= to; t += every) r.push({ t }); return r; };
  const leg = (ans, x) => Object.assign({ kind: 'ferry', mode: 'boat', min: 60, source: ans ? 'timetable' : 'guide' }, ans ? { ans } : {}, x || {});
  const runs = { id: 'f', mode: 'ferry', min: 50, every: 30, deps: deps(7 * 60, 19 * 60, 30) };
  ok(/no sailing times are known/.test(E.boatUnsure(leg(null), 600, '2027-07-01') || ''), 'no timetable: the boat is not confirmed');
  ok(/doesn't run in November/.test(E.boatUnsure(leg(Object.assign({}, runs, { months: [5, 6, 7, 8, 9] })), 600, '2026-11-25') || '') && !E.boatUnsure(leg(Object.assign({}, runs, { months: [5, 6, 7, 8, 9] })), 600, '2027-07-01'),
    'seasonal boat: not confirmed outside its months, confirmed in them');
  ok(/no sailing after 7:30 pm/.test(E.boatUnsure(leg(runs), 19 * 60 + 30, '2027-07-01') || ''), 'last sailing missed: not confirmed after it');
  ok(/no sailing times for this day/.test(E.boatUnsure(leg(Object.assign({}, runs, { deps: [] })), 600, '2027-07-01') || ''), 'no service that day (a line on the map, no sailings): not confirmed');
  ok(/next is about 4:00 pm/.test(E.boatUnsure(leg(Object.assign({}, runs, { deps: [{ t: 8 * 60 }, { t: 16 * 60 }] })), 600, '2027-07-01') || '') && !E.boatUnsure(leg(runs), 600, '2027-07-01'),
    'a sailing hours away is not near enough; one within the half hour is confirmed');
  // In the timed day: the island across the water with no sailing known is not reached on a ship day; the boat back waits
  // for its real sailing.
  const port = { name: 'Port', lat: 40.84, lng: 14.255 }, isle = { id: 'i', name: 'Island', lat: 40.55, lng: 14.24, minutes: 60, acrossWater: 'island' };
  const W = { start: 540, endBy: 1020, hard: true, date: '2027-07-01', head: [port], tail: [Object.assign({ backToShip: true }, port)] };
  const t0 = E.makeTravel({}, null, null, [], null, []), r0 = E.walkDay([isle], W, t0.estimate, null), st0 = r0.items.find(x => x.t === 'stop');
  ok(r0.late > 0 && st0 && /no sailing times are known/.test(st0.noBoat || ''), 'timed day: an island with no sailing known is marked, never planned on an hour at the pier');
  const rw = E.walkDay([Object.assign({ wish: true }, isle)], W, t0.estimate, null), bw = rw.items.filter(x => x.t === 'ride' && x.kind === 'ferry');
  ok(!rw.late && bw.length === 2 && bw.every(b => b.ownBoat) && !E.guardPlan({ end: rw.end, items: rw.items }, W).filter(t => /boat/.test(t)).length,
    'timed day: the traveler\'s own island pick is planned on the boat with the warning, and the final check accepts it');
  const pk = E.pairKey(isle, port), tm = E.makeTravel({}, { [pk]: 'ferry' }, null, [], null, []);
  ok(tm.estimate(isle, Object.assign({ backToShip: true }, port)).mine === true && !t0.estimate(isle, Object.assign({ backToShip: true }, port)).mine, 'a ride the traveler chose is marked as theirs; the app\'s own pick is not');
  const ansF = (a, b) => [{ id: 'f', mode: 'ferry', label: 'Ferry', min: 50, every: 60, deps: deps(9 * 60 + 15, 18 * 60 + 15, 60) }];
  const t1 = E.makeTravel({}, null, null, [], ansF, []), r1 = E.walkDay([isle], W, t1.estimate, null), boats = r1.items.filter(x => x.t === 'ride' && x.kind === 'ferry');
  ok(!r1.late && boats.length === 2 && boats.every(b => b.source === 'timetable') && boats[0].depWait === 15 && boats[1].depWait > 0,
    `timed day: with sailings known the island is planned, and each boat waits for its real sailing (${boats.map(b => b.depWait).join(', ')})`);
  ok(E.walkDay([isle], Object.assign({}, W, { hard: false }), t0.estimate, null).late === 0, 'a day with no time to be back still plans the island on the guide\'s boat'); }
// How sure the way back is: every ship day's leave-by says what it rests on, and a ride back timed from the distance is
// never called a timetable.
{ let n = 0, wrong = 0; for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const s = JSON.parse(fs.readFileSync(path.join(dir, f)));
    E.planTrip(s).forEach(p => { if (!p || !p.leaveAt) return; n++; const back = p.items.filter(x => x.t === 'ride' && x.mode !== 'walk' && x.mode !== 'lift'), b = p.leaveAt.basis;
      if (!['timetable', 'roads', 'estimate', 'walk'].includes(b) || (b === 'timetable' && back.length && p.items.slice(-4).some(x => x.t === 'ride' && x.mode !== 'walk' && x.source === 'estimate'))) wrong++; }); }
  ok(n > 20 && !wrong, `every leave-by says what the way back rests on (${n} days, ${wrong} wrong)`); }
// Unknown opening hours are never read as open: a stop with an entrance whose hours aren't known for the date is marked,
// and the day says to check.
{ let marked = 0, silent = 0, dawn = 0; for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const s = JSON.parse(fs.readFileSync(path.join(dir, f)));
    E.planTrip(s).forEach((p, i) => { if (!p || !p.items || p.safe) return; const d = s.days[i], c = s.cities[d.city] || {};
      for (const x of p.items.filter(x => x.t === 'stop')) { const sx = (c.sites || []).find(y => String(y.id) === String(x.id)); if (!sx) continue; const sd = (d.sites || {})[x.id];
        if (E.needsHours(sx) && !(sd && (sd.closed || sd.allDay || (sd.oh && sd.oh.spans && sd.oh.spans.length)))) { if (x.hoursUnknown && x.hours && x.hours.unknown && (p.explain || []).some(t => /(Opening|Sunday) hours not confirmed/.test(t))) marked++; else silent++;
          // Nov 20 review (finding 7): and never planned at dawn or late on a guess (9 to 5), unless the traveler set the order.
          const pw = (x.hours && x.hours.planned) || [E.ASSUME_OPEN, E.ASSUME_CLOSE]; if (!d.order && (x.at < pw[0] || x.at + x.min > pw[1])) { dawn++; if (dawn <= 3) ok(false, `${f} day ${i}: ${x.name}, hours unknown, planned at ${E.clock(x.at)}`); } } } }); }
  ok(marked > 0 && !silent && !dawn, `unknown opening hours are said, never read as open, and kept to 9 to 5 (${marked} stops marked, ${silent} silent, ${dawn} outside)`);
  ok(E.needsHours({ tags: ['indoor'] }) && E.needsHours({ tags: ['inside-or-out'] }) && !E.needsHours({ tags: ['open-air'] }) && !E.needsHours({ far: true, tags: ['indoor'] }), 'one rule from the tags decides which sights need hours'); }
ok(E.readable('Café Ñandú') && E.readable("Joe's Bar & Grill") && !E.readable('נתי- מזנון המשק') && !E.readable('東京'), 'a place to eat named only in another script is not readable');
{ const s = E.applyPlaces({ cities: { x: { name: 'X', sites: [{ id: 'a', name: 'A', lat: 1, lng: 1 }], restaurants: [] } }, days: [] }, { x: { key: 'x', cityEats: [{ name: 'נתי- מזנון המשק', lat: 1, lng: 1 }, { name: 'Good Cafe', lat: 1, lng: 1 }] } });
  ok(s.cities.x.restaurants.length === 1 && s.cities.x.restaurants[0].name === 'Good Cafe', 'map places to eat named only in another script are left out'); }
// The order repair takes the best single move, not the first that helps (Nov 19: a sight beside the first stop was sent
// across town and back to fix a late museum, when swapping the two museums fixed it with less riding).
{ const PD = path.join(__dirname, '..', 'places', 'data'), places = {}; if (fs.existsSync(PD)) for (const g of fs.readdirSync(PD).filter(g => g.endsWith('.json'))) { const q = JSON.parse(fs.readFileSync(path.join(PD, g))); places[q.key] = q; }
  // A trip from the live 20-city run (tools/beta2/live-trip.cjs, needs the internet): checked where it has been saved, said when not.
  if (!fs.existsSync(path.join(dir, 'g17-haifa.json'))) console.log('NOT RUN here: the Old City order check needs g17-haifa.json (node tools/beta2/live-trip.cjs)'); else {
  const s = E.applyPlaces(JSON.parse(fs.readFileSync(path.join(dir, 'g17-haifa.json'))), places), p = E.planTrip(s)[1], ids = p.items.filter(x => x.t === 'stop').map(x => x.name);
  const old = ['Dome of the Rock', 'Al-Aqsa Mosque', 'Western Wall'].map(n => ids.indexOf(n)), museum = Math.min(...['Israel Museum', 'Bible Lands Museum'].map(n => ids.indexOf(n)).filter(k => k >= 0));
  // (Nov 20: with unknown hours kept to 9 to 5 the museums may come first; what counts is that each side of town is visited once.)
  const mus = ['Israel Museum', 'Bible Lands Museum'].map(n => ids.indexOf(n)).filter(k => k >= 0), museumLast = Math.max(...mus);
  // (Nov 23: on a Saturday the Temple Mount is shut by its official hours, so only the Old City sights planned count.)
  const oldIn = old.filter(k => k >= 0);
  ok(oldIn.length >= 1 && (oldIn.every(k => k < museum) || oldIn.every(k => k > museumLast)), `the Old City sights together, never split by the museums across town (got ${ids.join(' > ')})`); } }
// Road times from the map: two trips out across a gulf are timed by the road, not the straight line.
{ const PD = path.join(__dirname, '..', 'places', 'data'), places = {}; if (fs.existsSync(PD)) for (const g of fs.readdirSync(PD).filter(g => g.endsWith('.json'))) { const q = JSON.parse(fs.readFileSync(path.join(PD, g))); places[q.key] = q; }
  const s = E.applyPlaces(JSON.parse(fs.readFileSync(path.join(dir, 'athens-booked.json'))), places), far = id => s.cities.athens.farther.find(x => x.id === id);
  const tr = E.makeTravel(s.prefs, s.legModes, s.legs, s.transit, null, E.piersOf(s)), e = tr.estimate(far('corinth-far'), far('delphi-far'));
  ok(e.min >= 180 && e.source === 'roads', `Ancient Corinth to Delphi by the map's roads, round the gulf (got ${e.min} min, ${e.source})`); }
// ---- Early at a place to eat (Nov 19: lunch 1.7 km out of the way on an island day, to save five minutes before the kitchen
// opened): the first quarter hour early at lunch is no idle wait, so a place on the way is never passed over to avoid it.
{ const L = E.MEALS[0], o = { lat: 0, lng: 0, name: 'A' }, win = { start: L.from - 20, endBy: 18 * 60, head: [o], tail: [] }, tr = () => ({ min: 0, mode: 'walk', kind: 'walk', how: 'Walk' });
  const at = early => E.walkDay([{ id: 'eat:x', name: 'X', lat: 0, lng: 0, mealOf: L, len: 60 }], Object.assign({}, win, { start: L.from - early }), tr, null).waits;
  ok(at(10) === 0 && at(15) === 0 && at(25) === 10, `lunch: up to 15 min early is seated, not waiting (10 early: ${at(10)}, 25 early: ${at(25)})`); }
// ---- The traveler's own order holds (Nov 19, Richard: "drag to reorder is not allowing you to drop it where you want it":
// the engine planned its own order whatever was dragged). On every day of every test trip with three stops or more, the
// stops dragged into reverse order are planned in that order (a stop that no longer fits may drop), and lunch dragged
// after the second stop is eaten there.
{ let days = 0, wrong = 0, lunchWrong = 0;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const s0 = JSON.parse(fs.readFileSync(path.join(dir, f))), base = E.planTrip(s0);
    base.forEach((p, i) => { if (!p || !p.items || s0.days[i].locked) return; const ids = p.items.filter(x => x.t === 'stop').map(x => String(x.id)); if (ids.length < 3) return; days++;
      const want = ids.slice().reverse(), s = JSON.parse(JSON.stringify(s0)); Object.assign(s.days[i], { selected: ids.slice(), mine: ids.slice(), own: true, order: want, mealAt: { Lunch: want[1] } });
      const q = E.planTrip(s)[i]; if (!q || !q.items) return; const got = q.items.filter(x => x.t === 'stop').map(x => String(x.id));
      if (got.join('>') !== want.filter(id => got.includes(id)).join('>')) { wrong++; if (wrong <= 3) ok(false, `${f} day ${i + 1}: dragged ${want.join('>')}, planned ${got.join('>')}`); }
      const lunch = q.items.findIndex(x => x.t === 'meal' && x.meal === 'Lunch'), prev = lunch > 0 ? q.items.slice(0, lunch).reverse().find(x => x.t !== 'ride') : null;
      const w1 = q.items.find(x => x.t === 'stop' && String(x.id) === want[1]), ends = w1 ? w1.at + w1.min : -1; // a place at lunchtime (11 to 2:30), not one left at 10 am
      if (lunch > 0 && w1 && ends >= 660 && ends <= 870 && !q.items[lunch].inside && !(prev && String(prev.id) === want[1]) && !(q.explain || []).some(t => /^Lunch is after .* where you put it/.test(t))) { lunchWrong++; if (lunchWrong <= 3) ok(false, `${f} day ${i + 1}: lunch dragged after the second stop is planned elsewhere`); } }); }
  ok(days > 20 && !wrong && !lunchWrong, `the traveler's dragged order and lunch place hold (${days} days)`); }
// ---- Never fewer ways than the demo (Nov 18 night, the ride rewrite's gate). The demo app offers, for every ride, a walk
// when it is short, each kind of public transport its timetable answers give, and a taxi. With the same answers for
// every ride of every test trip, each ride of Beta 2 offers every kind the demo would (or is reached only by water);
// the planned way has one label of its kind, is drawn as that kind, and gives its steps.
{ let rides = 0, bad = 0;
  const fake = (a, b) => { const d = E.hav(a, b); if (d < 1.5) return []; const out = [{ id: 'subway|M9', min: Math.round(d * 2 + 10), label: 'Metro M9', mode: 'subway', steps: ['Metro M9, A to B'], access: { how: 'walk', min: 4 }, egress: { how: 'walk', min: 4 } }];
    if (d > 15) out.push({ id: 'rail|R9', min: Math.round(d * 1.1 + 20), label: 'Train R9', mode: 'rail', steps: ['Train R9, C to D'], access: { how: 'walk', min: 6 }, egress: { how: 'walk', min: 6 } });
    return out; };
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const s = JSON.parse(fs.readFileSync(path.join(dir, f))); s.answers = fake;
    E.planTrip(s).forEach((p, i) => p && p.items && p.items.forEach(x => { if (x.t !== 'ride' || !x.from || !x.to || x.whole || x.pierName) return; rides++;
      const d = E.hav(x.from, x.to), opts = x.options || [{ kind: x.kind, id: x.choice }], has = k => opts.some(o => o.kind === k), why = [];
      if (x.mode === 'boat' || x.mode === 'lift') { if (!(x.mode === 'boat' ? x.kind === 'ferry' : true)) why.push('a boat not called a ferry'); }
      else {
        if (d >= 1.5 && !has('metro')) why.push('no metro (the demo offers it)');
        if (d > 15 && !has('train')) why.push('no train (the demo offers it)');
        if (d >= 0.6 && !has('taxi')) why.push('no taxi');
        if (x.mode !== E.modeOfKind(x.kind)) why.push(`drawn as ${x.mode} but is a ${x.kind}`);
        if ((x.kind === 'metro' || x.kind === 'train') && !(x.ans && (x.steps || []).length)) why.push('a train or metro planned without its steps');
        if (x.kind === 'taxi' && x.how !== 'Taxi or car') why.push(`a taxi labelled "${x.how}"`);
        if (opts.some(o => /guide says|plus 15|then a taxi/.test(o.how || ''))) why.push('a way made from the guide\'s words or stitched together');
        const kinds = opts.map(o => o.kind); if (new Set(kinds).size !== kinds.length) why.push('two choices of one kind');
      }
      if (why.length) { bad++; if (bad <= 8) ok(false, `${f} day ${i + 1}: ${x.how || x.mode} (${d.toFixed(1)} km): ${why.join('; ')}`); } })); }
  ok(rides > 300 && !bad, `never fewer ways than the demo: ${rides} rides on all test trips, ${bad} short`); }
// ---- Nov 19 fold: ONE lunch rule, ONE "fits the day" test, and the traveler's order with its cost said.
{ const PD = path.join(__dirname, '..', 'places', 'data'), places = {}; if (fs.existsSync(PD)) for (const g of fs.readdirSync(PD).filter(g => g.endsWith('.json'))) { const q = JSON.parse(fs.readFileSync(path.join(PD, g))); places[q.key] = q; }
  const cf = path.join(dir, 'corinth-day.json');
  if (fs.existsSync(cf)) { const b0 = E.applyPlaces(JSON.parse(fs.readFileSync(cf)), places), i = 3;
    const withDay = patch => Object.assign({}, b0, { days: b0.days.map((d, j) => j === i ? Object.assign({}, d, patch) : d) });
    const ids = ['corinth-far', 'corinth-canal-far', 'acrocorinth-far'], perms = [];
    const perm = (a, pre) => { if (!a.length) return perms.push(pre); a.forEach((x, k) => perm(a.filter((_, j) => j !== k), pre.concat(x))); }; perm(ids, []);
    // Richard, Nov 19: "Well, it didn't put a lunch" / "Even if its a short 20 30 minute lunch, it needs to be notated".
    const noLunch = [null].concat(perms).filter(o => { const p = E.planTrip(withDay(o ? { order: o } : {}))[i]; return !p.items.some(x => x.t === 'meal' && x.meal === 'Lunch'); });
    ok(!noLunch.length, `the Corinth day gets a timed lunch in the app's order and every dragged order (missing in ${noLunch.map(o => o ? o.join('>') : 'the app\'s order').join(', ')})`);
    // A dragged order that rides far more than the app's says so; the app's own order never does.
    const zig = E.planTrip(withDay({ order: ['corinth-far', 'corinth-canal-far', 'acrocorinth-far'] }))[i], app = E.planTrip(b0)[i];
    ok(zig.orderExtra >= 15 && !app.orderExtra, `a dragged order back and forth across Corinth says how much more travel it costs (got ${zig.orderExtra}; the app's order ${app.orderExtra})`);
    // Adding a sight in town to the full Corinth day: it fits only by ending later, never by quietly cutting Ancient Corinth or lunch.
    const before = app.items.filter(x => x.t === 'stop' || x.t === 'meal').map(x => x.name + ':' + x.min).join(',');
    ok(app.suggest.every(x => { const q = E.planTrip(withDay({ selected: b0.days[i].selected.concat(x.id) }))[i];
      return app.items.filter(y => y.t === 'stop' || (y.t === 'meal' && y.meal === 'Lunch')).every(y => q.items.some(z => z.name === y.name && z.min >= y.min)); }), `every sight offered for the free time fits without shortening a visit or lunch (${before})`);
  }
  // Lunch inside a long visit takes the walk there and back out of the visit too: the day never ends later for it.
  { let n = 0, bad = 0;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const s = E.applyPlaces(JSON.parse(fs.readFileSync(path.join(dir, f))), places); let pl; try { pl = E.planTrip(s); } catch (e) { continue; }
      pl.forEach((p, i) => { if (!p || !p.items || p.safe) return;
        // ONE test of "fits": a day with no time for lunch offers nothing more for its free time.
        if (p.noLunch === 'time' && (p.suggest || []).length) { bad++; if (bad <= 3) ok(false, `${f} day ${i + 1}: no time for lunch, yet ${p.suggest.length} sights offered as fitting`); }
        if (p.items.some(x => x.lunchIn)) n++; }); }
    ok(!bad, `a day without time for lunch offers no sights as fitting (${n} days with lunch inside a long visit)`); }
  // A day out from early afternoon (an airport arrival) still gets lunch; a short morning out doesn't need one.
  const w = (from, to) => ({ start: from, sightFrom: from, endBy: to, sightTo: to });
  ok(E.lunchWanted(w(13 * 60 + 40, 18 * 60)) && E.lunchWanted(w(9 * 60, 17 * 60)) && !E.lunchWanted(w(9 * 60, 11 * 60 + 30)) && !E.lunchWanted(w(15 * 60, 19 * 60)),
    'lunch is wanted on any day out over lunchtime for two hours or more, an afternoon from 13:40 included');
  // A minute riding weighs at least as much as a minute waiting: the planner never buys a little less waiting with a long crossing.
  { const r = { over: 0, late: 0, mealPen: 0, end: 600 }; ok(E.dayCost(Object.assign({ waits: 0, rideMin: 60 }, r)) >= E.dayCost(Object.assign({ waits: 60, rideMin: 0 }, r)), 'an hour more riding never costs less than an hour of waiting'); }
  // One sight, one id (Nov 19 sweep: the app sends back the town sights it lists from the places files, and they were
  // added a second time: a day trip of 23 stops, an 8-second tick). Facts applied twice still list every sight once.
  { const PD = path.join(__dirname, '..', 'places', 'data'), places = {}, dup = [];
    if (fs.existsSync(PD)) for (const g of fs.readdirSync(PD).filter(g => g.endsWith('.json'))) { const q = JSON.parse(fs.readFileSync(path.join(PD, g))); places[q.key] = q; }
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const b = E.applyPlaces(E.applyPlaces(JSON.parse(fs.readFileSync(path.join(dir, f))), places), places);
      for (const [k, c] of Object.entries(b.cities || {})) { const ids = (c.sites || []).concat(c.farther || []).map(x => String(x.id)), seen = new Set();
        for (const id of ids) { if (seen.has(id)) dup.push(f + ' ' + k + ': ' + id); seen.add(id); } } }
    ok(!dup.length, `every sight is listed once, even when the app sends back the sights it got from the places files (${dup.length} twice: ${dup.slice(0, 3).join('; ')})`); }
  // Lunch on every day out over lunchtime (Nov 20, the scorecard's lunch goal). Two general ways when the picks fill the day:
  //   - a port day whose return is before lunch ends: lunch back on board, timed, after the traveler is back, never moving
  //     the time back at the ship or the margin;
  //   - otherwise a visit or two of 40 min or more give up a few minutes (never below half, or SHORT_MIN) for a short lunch.
  { const PD = path.join(__dirname, '..', 'places', 'data'), places = {}, bad = [], cut = []; let onBoard = 0;
    if (fs.existsSync(PD)) for (const g of fs.readdirSync(PD).filter(g => g.endsWith('.json'))) { const q = JSON.parse(fs.readFileSync(path.join(PD, g))); places[q.key] = q; }
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const s = E.applyPlaces(JSON.parse(fs.readFileSync(path.join(dir, f))), places), pl = E.planTrip(s);
      pl.forEach((p, i) => { if (!p || !p.items) return; const d = s.days[i], c = s.cities[d.city] || {}, mins = new Map((c.sites || []).concat(c.farther || []).map(x => [String(x.id), x.minutes || 0]));
        p.items.filter(x => x.onBoard).forEach(x => { onBoard++; if (!/port/.test(d.type) || x.at < p.end || x.at + x.min > E.MEALS[0].to + 30) bad.push(`${f} day ${i + 1} at ${E.clock(x.at)}, back ${E.clock(p.end)}`); });
        p.items.filter(x => x.t === 'stop' && mins.has(String(x.id))).forEach(x => { const was = mins.get(String(x.id)); if (x.min < was && x.min < Math.min(was, Math.max(E.SHORT_MIN || 25, Math.floor(was / 2) - 8))) cut.push(`${f} day ${i + 1}: ${x.name} ${x.min} of ${was} min`); }); }); }
    ok(!bad.length && onBoard > 0, `lunch back on board only on port days, after the traveler is back, never moving the time back at the ship (${onBoard} days; ${bad.slice(0, 3).join('; ')})`);
    ok(!cut.length, `a visit shortened for lunch or to fit the day keeps at least half its time (${cut.slice(0, 3).join('; ')})`); }
  // Never a way much slower than walking where the walk is offered (Nov 19, Richard's Rome day: "Those 2 ferries stick out
  // like a sore thumb", a river boat of 1 h 40 min for a 1.6-mile hop beside a 34-minute walk and a 17-minute taxi).
  { const a = { lat: 41.8986, lng: 12.4769 }, b = { lat: 41.9022, lng: 12.4539 };
    const ans = () => [{ id: 'ferry|boat', mode: 'ferry', min: 100, label: 'Ferry Battelli', steps: [] }, { id: 'bus|40', mode: 'bus', min: 20, label: 'Bus 40', steps: [] }];
    const r = E.makeTravel({}, {}, null, null, ans).estimate(a, b), kinds = (r.options || []).map(o => o.kind + ' ' + o.min);
    ok(!(r.options || []).some(o => o.kind === 'ferry') && (r.options || []).some(o => o.kind === 'bus'), `a boat far slower than the walk is not offered; a quicker bus is (got ${kinds.join(', ')})`);
    // On every ride of every saved trip (with the places files): no way offered beside a walk is much slower than it.
    const PD = path.join(__dirname, '..', 'places', 'data'), places = {}; let rides = 0, slow = [];
    if (fs.existsSync(PD)) for (const g of fs.readdirSync(PD).filter(g => g.endsWith('.json'))) { const q = JSON.parse(fs.readFileSync(path.join(PD, g))); places[q.key] = q; }
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { let pl, sn; try { sn = JSON.parse(fs.readFileSync(path.join(dir, f))); pl = E.planTrip(E.applyPlaces(sn, places)); } catch (e) { continue; }
      const lim = { low: 0.8, medium: 1.7, high: 3.2 }[(sn.prefs || {}).walk || 'medium'] || 1.7;
      pl.forEach((p, i) => (p && p.items || []).forEach(x => { if (x.t !== 'ride' || !x.options) return; const w = x.options.find(o => o.kind === 'walk'); if (!w || x.km / 1.3 > 2 * lim) return; rides++;
        x.options.filter(o => o.kind !== 'walk' && o.kind !== 'taxi' && o.min > w.min + E.SLOWER_THAN_WALK).forEach(o => slow.push(`${f} day ${i + 1}: ${o.how} ${o.min} min beside a ${w.min}-min walk`)); })); }
    ok(!slow.length, `no way offered beside a walk of up to twice the walking limit is more than ${E.SLOWER_THAN_WALK} min slower than walking (${rides} rides with a walk; ${slow.slice(0, 3).join('; ')})`);
    // The way taken is never a bus or metro slower than the walk, for a traveler who walks little too (odd-trips stress test,
    // Nov 22: Barcelona, 28 min by bus for 0.9 km beside a 16-20 min walk): it stays a choice.
    const picked = []; let n2 = 0;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { let pl; try { const sn = JSON.parse(fs.readFileSync(path.join(dir, f))); sn.prefs = Object.assign({}, sn.prefs, { walk: 'low' }); pl = E.planTrip(E.applyPlaces(sn, places)); } catch (e) { continue; }
      pl.forEach((p, i) => (p && p.items || []).forEach(x => { if (x.t !== 'ride' || !x.options || x.chosen || x.mine) return; const w = x.options.find(o => o.kind === 'walk'), pk = x.options.find(o => o.id === x.choice) || null;
        if (!w) return; n2++; if (x.mode !== 'walk' && x.kind !== 'taxi' && x.kind !== 'walk' && (x.min || 0) > w.min && !x.options.some(o => o.kind === 'taxi' && o.min < x.min)) picked.push(`${f} day ${i + 1}: ${x.how || x.kind} ${x.min} min beside a ${w.min}-min walk`); })); }
    ok(n2 > 50 && !picked.length, `walking little, no ride taken is a bus or metro slower than walking (${n2} rides; ${picked.slice(0, 3).join('; ')})`); }
  // ONE hours rule for places to eat and sights (Nov 19 fold): shut for a meal exactly when E.closedForDay says so over
  // the meal's hours, and a place that opens later is waited for by E.hoursFit, as a sight is.
  { const dinnerOnly = { closed: false, oh: { spans: [[18 * 60, 23 * 60]], last: null } }, late = { closed: false, oh: { spans: [[13 * 60, 23 * 60]], last: null } };
    const L = E.MEALS[0], D = E.MEALS[1], same = f => E.eatShut(f, 'Lunch') === E.closedForDay(f, { start: L.from, endBy: L.to }, L.quick) && E.eatShut(f, 'Dinner') === E.closedForDay(f, { start: D.from, endBy: D.to }, D.quick);
    ok(E.eatShut(dinnerOnly, 'Lunch') && !E.eatShut(dinnerOnly, 'Dinner') && !E.eatShut(late, 'Lunch') && E.eatShut({ closed: true }, 'Dinner') && !E.eatShut({}, 'Lunch')
      && [dinnerOnly, late, { closed: true }, {}].every(same), 'a place to eat is shut for a meal by the same hours check as a sight');
    const f = E.hoursFit(late.oh, 12 * 60, 60); ok(f.wait === 60 && !f.late, `a lunch place opening at 13:00 is waited for, as a sight is (got wait ${f.wait}, late ${f.late})`); }
  // A timetable's boat (exact or borrowed from the ride next door) is still a boat from pier to pier: the way to the pier
  // is a ride of its own, and the whole ride is never shorter than that way plus the time at the pier.
  { const land = { lat: 40.850, lng: 14.258 }, pier = { name: 'Main Pier', lat: 40.838, lng: 14.255 }, isle = { lat: 40.550, lng: 14.240, travelNote: 'Ferry from the main pier, 50 min.' };
    const ans = () => [{ id: 'ferry|x', mode: 'ferry', min: 55, label: 'Ferry', steps: ['Ferry: Main Pier to Isle, 50 min'] }];
    for (const [a, b] of [[land, isle], [isle, land]]) { const r = E.makeTravel({}, {}, null, null, ans, [pier]).estimate(a, b), g = (r.parts || []).filter(x => !x.boat);
      ok(r.kind === 'ferry' && g.length === 1 && /(to|from) the ferry at Main Pier/.test(E.rideItem(g[0]).how) && r.min >= g[0].min + E.PIER_MIN, `a timetable ferry ${a === land ? 'out' : 'back'} shows the way to the pier as its own ride, named as the way to the ferry even on foot (got ${r.min} min, parts ${(r.parts || []).map(x => x.boat ? 'boat' : x.how).join(' / ')})`); } }
  // ONE "close enough" rule for every answer borrowed from a ride next door (Nov 19 fold): a choice, a road time and a
  // timetable answer all use E.nearRide, and a borrowed time is never shorter than reaching the known ride's ends and
  // riding it (safe by construction for the ship).
  { const A = { lat: 37.97, lng: 23.73 }, B = { lat: 38.25, lng: 23.73 }, d = E.hav(A, B);
    ok(E.nearTol(1) === 0.6 && E.nearTol(200) === 5 && Math.abs(E.nearTol(d) - d / 10) < 1e-9, 'close enough: a tenth of the ride, 600 m to 5 km');
    const leg = { road: true, a: A, b: B, min: 40, km: 36 }, legs = { [E.pairKey(A, B)]: leg };
    let worse = 0, used = 0;
    for (let k = 0; k < 60; k++) { const off = (k % 12) * 0.0025, a = { lat: A.lat + off, lng: A.lng - off / 2 }, b = { lat: B.lat - off / 3, lng: B.lng + off };
      const r = E.makeTravel({}, { [E.pairKey(A, B)]: 'taxi' }, legs).estimate(a, b), n = E.nearRide(a, b, [leg], l => [l.a, l.b]);
      if (n) { used++; const floor = 40 + E.gapMin(E.hav(a, A), true) + E.gapMin(E.hav(b, B), true); if (r.min < floor) worse++; if (r.kind !== 'taxi') worse++; }
      else if (r.pinned) worse++; }
    ok(used > 10 && !worse, `a borrowed road time is never shorter than reaching the known ride's ends and riding it, and a choice is borrowed by the same rule (${used} borrowed, ${worse} wrong)`);
    ok(E.gapMin(0.5) > E.gapMin(0.5, true) && E.gapMin(2) >= 5 && E.gapMin(0) === 0, 'the gap to a borrowed public ride is walked (a taxi beyond a walk); to a road time it is driven'); }
  // Fable review #10-#12 (Nov 20): no silent waits, no long walks with luggage, a place keeps its own visit length.
  { const PD = path.join(__dirname, '..', 'places', 'data'), places = {}; let firsts = 0, meals = 0, bagRides = 0; const waits = [], silent = [], bagWalks = [], shortSilent = [];
    if (fs.existsSync(PD)) for (const g of fs.readdirSync(PD).filter(g => g.endsWith('.json'))) { const q = JSON.parse(fs.readFileSync(path.join(PD, g))); places[q.key] = q; }
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { let s, pl; try { s = E.applyPlaces(JSON.parse(fs.readFileSync(path.join(dir, f))), places); pl = E.planTrip(s); } catch (e) { continue; }
      pl.forEach((p, i) => { if (!p || !p.items) return; const d = s.days[i], c = s.cities[d.city] || {}, mins = new Map((c.sites || []).concat(c.farther || []).map(x => [String(x.id), x.minutes || 0]));
        const k = p.items.findIndex(x => x.t === 'stop');
        if (k > 0 && p.items[0].t === 'start' && p.items.slice(1, k).every(x => x.t === 'ride')) { firsts++; if ((p.items[k].wait || 0) > 20) waits.push(`${f} day ${i + 1}: ${p.items[k].name} ${p.items[k].wait} min`); }
        p.items.forEach((x, j) => { if (x.t !== 'meal' || x.onBoard || !x.at) return; meals++; const prev = p.items.slice(0, j).reverse().find(y => y.at != null && y.t !== 'ride');
          if (x.freeBefore > 20 && !(p.explain || []).some(t => /^Free time: about \d+ min before/.test(t))) silent.push(`${f} day ${i + 1}: ${x.freeBefore} min before ${x.name}`); });
        if (/arriv|embark|depart|disembark/.test(d.type || '') || d.mode) p.items.forEach((x, j) => { if (x.t !== 'ride') return; const nx = p.items[j + 1], pv = p.items[j - 1];
          const bags = (nx && /Check in or drop bags/.test(nx.name || '')) || (j === p.items.length - 2 && nx && nx.t === 'end' && !d.noBags && d.type !== 'port' && !d.returnToStart);
          if (!bags) return; bagRides++; if (x.kind === 'walk' && x.min > E.BAGS_WALK) bagWalks.push(`${f} day ${i + 1}: walk ${x.min} min`); });
        p.items.filter(x => x.t === 'stop' && mins.has(String(x.id))).forEach(x => { const was = mins.get(String(x.id)); if (x.min * 2 < was && !(p.explain || []).some(t => t.startsWith(String(x.name) + ' gets '))) shortSilent.push(`${f} day ${i + 1}: ${x.name} ${x.min} of ${was}`); }); }); }
    ok(firsts > 20 && !waits.length, `a day never starts with a wait of over 20 min at the first stop's door: it starts later and says so (${firsts} days; ${waits.slice(0, 3).join('; ')})`);
    ok(meals > 20 && !silent.length, `over 20 free minutes before a meal is named as free time (${meals} meals; ${silent.slice(0, 3).join('; ')})`);
    ok(!bagWalks.length, `no ride with luggage is a walk of over ${E.BAGS_WALK} min (${bagRides} rides with bags; ${bagWalks.slice(0, 3).join('; ')})`);
    ok(!shortSilent.length, `no visit is cut below half its length without a line saying why (${shortSilent.slice(0, 3).join('; ')})`);
    // A town with its own sights listed keeps its full visit picked on its own; with one of its sights picked too it becomes the
    // walk to it, and says so; that sight keeps the gated town's opening hours.
    const sf = path.join(dir, 'athens-booked.json');
    if (fs.existsSync(sf)) { const s0 = E.applyPlaces(JSON.parse(fs.readFileSync(sf)), places); let ni = -1, town = null, inner = null;
      const runAt = (k, sel) => { const s = JSON.parse(JSON.stringify(s0)); s.days[k].selected = sel; return E.planTrip(s)[k]; };
      for (let k = 0; k < s0.days.length && !town; k++) for (const t of ((s0.cities[s0.days[k].city] || {}).farther || []).filter(t => t.townWalk && t.minutes > t.townWalk)) {
        const p = runAt(k, [t.id]); if (p && p.items && p.items.some(x => String(x.id) === String(t.id))) { ni = k; town = t; inner = s0.cities[s0.days[k].city].farther.find(x => x.town === t.id); break; } }
      if (town && inner) { const run = sel => runAt(ni, sel);
        const a = run([town.id]), b = run([town.id, inner.id]), sa = a.items.find(x => String(x.id) === String(town.id)), sb = b.items.find(x => String(x.id) === String(town.id)), ib = b.items.find(x => String(x.id) === String(inner.id));
        ok(sa && sa.min > town.townWalk && !(a.explain || []).some(t => t.startsWith(town.name + ' gets ')), `${town.name} picked on its own keeps its own visit (got ${sa && sa.min} of ${town.minutes} min)`);
        const tday = (s0.days[ni].sites || {})[town.id], open = tday && tday.oh && tday.oh.spans && tday.oh.spans.length ? tday.oh.spans[0][0] : null;
        // Richard (Nov 20): a sight inside a gated town (one with its own opening hours) is part of that visit: the town keeps
        // its full time plus a little, and the sight is no stop of its own. An open town becomes the walk to it, and says so.
        if (open != null || (inner.minutes || 30) <= 15) ok(sb && (sb.min === (town.minutes || 60) + E.foldExtra(inner) || (b.explain || []).some(t => t.startsWith('A shorter visit to ' + town.name + ' (' ) && t.includes(' instead of ' + ((m => m >= 60 ? Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : m + ' min')((town.minutes || 60) + E.foldExtra(inner)))))) && !ib && (b.folded || []).map(String).includes(String(inner.id)) && (b.explain || []).some(t => t.startsWith(inner.name + ' is inside ' + town.name + ': seen on that visit')),
          `${inner.name} inside the gated ${town.name} is part of that visit (+${E.foldExtra(inner)} min), not a stop of its own (got ${sb && sb.min} of ${town.minutes} + ${E.foldExtra(inner)} min, own stop: ${!!ib}, trimmed ${sb && sb.trimmed})`);
        else { ok(sb && sb.min === town.townWalk && (b.explain || []).some(t => t.startsWith(town.name + ' gets ' + town.townWalk + ' min, the walk to ' + inner.name)), `${town.name} with ${inner.name} picked too becomes the walk to it, and says so (got ${sb && sb.min} min)`);
          ok(open == null || (ib && ib.at >= open), `a sight inside a gated town is never planned before the town opens (${inner.name} at ${ib && E.clock(ib.at)}, opens ${open == null ? '?' : E.clock(open)})`); } }
      else ok(false, 'a town with its own sights is in the test trip');
      // Nov 23 outside test (Sintra): planned together without the traveler's ticks (the guide's day trip there, a set
      // list), an open town is the walk to its sight all the same, never its whole visit again beside it, and never says
      // "you picked".
      let openTown = 0;
      for (let k = 0; k < s0.days.length; k++) for (const t of ((s0.cities[s0.days[k].city] || {}).farther || []).filter(t => t.townWalk && t.minutes > t.townWalk)) {
        const tdy = (s0.days[k].sites || {})[t.id], inn = s0.cities[s0.days[k].city].farther.find(x => x.town === t.id);
        if (!inn || (tdy && tdy.oh && tdy.oh.spans && tdy.oh.spans.length) || (inn.minutes || 30) <= 15) continue;
        const sc = JSON.parse(JSON.stringify(s0)); sc.days[k].selected = []; sc.days[k].only = [t.id, inn.id]; const c = E.planTrip(sc)[k], it = c && (c.items || []).find(x => String(x.id) === String(t.id));
        if (!it || !(c.items || []).some(x => String(x.id) === String(inn.id))) continue; openTown++;
        ok(it.min === t.townWalk && (c.explain || []).some(x => x.startsWith(t.name + ' gets ' + t.townWalk + ' min, the walk to ' + inn.name) && !/you picked/.test(x)), `${t.name} planned with ${inn.name} by the app (no ticks) is the walk to it (got ${it.min} of ${t.minutes} min; ${(c.explain || []).filter(x => x.startsWith(t.name + ' gets ')).join(' ')})`); }
      ok(openTown > 0, `an open town planned with its own sight is in the test trip (${openTown})`); } }
  ok(E.notPublicEat({ name: "Metropolitan Officers' Cafeteria" }) && E.notPublicEat({ name: 'Cafe', access: 'private' }) && !E.notPublicEat({ name: 'Trattoria da Enzo' }), 'a staff or officers\' canteen, or a private place, is never a place to eat');
  // Round 1 (Nov 20): no ride option far slower than the road, and on a day with a time to be back none that would get the
  // traveler back late (a ferry to another island across a city, a train back landing after the time to be back).
  { const PD2 = path.join(__dirname, '..', 'places', 'data'), pl2 = {}; if (fs.existsSync(PD2)) for (const g of fs.readdirSync(PD2).filter(g => g.endsWith('.json'))) { const q = JSON.parse(fs.readFileSync(path.join(PD2, g))); pl2[q.key] = q; }
    let n = 0; const slow = [], late = [];
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { let s2, P2; try { s2 = E.applyPlaces(JSON.parse(fs.readFileSync(path.join(dir, f))), pl2); P2 = E.planTrip(s2); } catch (e) { continue; }
      P2.forEach((p, i) => { if (!p || !p.items) return; const eI = p.items.findIndex(x => x.t === 'end'), spare = eI > 0 ? p.endBy - p.items[eI].at : Infinity, hard = /port|embark|departure/.test(s2.days[i].type);
        p.items.forEach(x => { if (x.t !== 'ride' || !x.options) return; n++; const t = x.options.find(o => o.kind === 'taxi');
          const w = x.options.find(o => o.kind === 'walk'), back = x === p.items[eI - 1] || p.items.slice(p.items.indexOf(x) + 1, eI).every(y => y.t === 'ride');
          x.options.forEach(o => { if (!t || o.kind === 'walk' || o.kind === 'taxi' || o.id === x.choice) return; const raw = o.min - (o.slack || 0), tr = t.min - (t.slack || 0);
            if (!/^note\|/.test(String(o.id)) && raw > 2 * tr + 20 && (!w || o.min > w.min)) slow.push(`${f} day ${i + 1}: ${o.how} ${o.min} vs taxi ${t.min}`); }); }); }); }
    ok(n > 0 && !slow.length, `ride options: none far slower than both the road and the walk (${n} rides; ${slow.slice(0, 3).join('; ')})`); }
  // Across the water from the map (Fable review #6): a town on another island with no road there but a ferry is reached by
  // boat, even with no guide note and a road time on file (a car ferry's route), never by taxi.
  { const mk = across => { const b = { prefs: { walk: 'medium' }, cities: { k: { key: 'k', name: 'K', sites: [{ id: 'a', name: 'Harbour Church', lat: 37.0, lng: 25.0, minutes: 30 }], farther: [{ id: 't', name: 'Isle Town', lat: 37.0, lng: 25.25, minutes: 120, travelNote: '' }], restaurants: [] } },
      days: [{ i: 0, type: 'land', city: 'k', date: '2027-06-03', startTime: '09:00', hours: 10, lodging: { name: 'Hotel', lat: 37.001, lng: 25.001 }, selected: ['t'], own: true }] };
      const P = { k: { key: 'k', towns: { t: { editions: 5 } }, roads: [{ a: { lat: 37.001, lng: 25.001 }, b: { lat: 37.0, lng: 25.25 }, min: 40, km: 30 }], islands: { centre: { id: '1', name: 'Big' }, towns: { t: { island: { id: across ? '2' : '1', name: 'Isle' }, across } } } } };
      const p = E.planTrip(E.applyPlaces(b, P))[0]; return (p.items || []).filter(x => x.t === 'ride').map(x => x.kind); };
    const a = mk(true), b = mk(false);
    ok(a.length && a.every(k => k === 'ferry' || k === 'walk') && b.includes('taxi'), `a town across the water on the map is reached by boat, one on the same land by road (got ${a.join(', ')} / ${b.join(', ')})`); }
  // Round 1 S1-9: a port typed with the place to see in brackets is looked up by the port's own name, no stray space.
  { const cases = { 'Le Havre (Paris), France': 'Le Havre, France', 'Haifa (Jerusalem), Israel': 'Haifa, Israel', 'Laem Chabang (Bangkok), Thailand': 'Laem Chabang, Thailand', 'Aqaba (Petra)': 'Aqaba', 'Kotor, Montenegro': 'Kotor, Montenegro', 'Zeebrugge ( Bruges ) , Belgium': 'Zeebrugge, Belgium' };
    const bad = Object.entries(cases).filter(([k, v]) => E.bareName(k) !== v).map(([k]) => k + ' -> ' + JSON.stringify(E.bareName(k)));
    ok(!bad.length, `a port's name without the brackets, never a space before the comma (${bad.join('; ')})`);
    ok(E.bracketPlace('Warnemunde (Berlin), Germany') === 'Berlin' && E.bracketPlace('Kotor') === '', 'the place in brackets is read apart'); }
  // Round 1 S1-2: a cruise pier is a place ships tie up, never a ferry terminal, an old harbour, a sentence or an article
  // about the whole port; a port with several sure ones is asked.
  { const bad = [{ name: 'Alaska Marine Highway Ferry Terminal', kind: 'ferry_terminal' }, { name: 'Old Port of Marseille' }, { name: 'Vieux-Port' }, { name: 'From Jordan to Egypt. (Aqaba Nuwaibee, 50JD, 3hours, taxi from center 5JD max)' }, { name: 'Port of Venice', wiki: true }];
    const good = [{ name: 'Berth 2 Cruise Terminal' }, { name: 'Prince George Wharf' }, { name: 'Port of Venice', kind: 'harbour' }, { name: 'Marina Bay Cruise Centre' }, { name: 'Cruise and Ferry Terminal' }];
    const wrong = bad.filter(c => E.cruiseOk(c)).map(c => c.name).concat(good.filter(c => !E.cruiseOk(c)).map(c => '(kept out) ' + c.name));
    ok(!wrong.length, `cruise piers: ferry terminals, old harbours, sentences and whole-port articles are not piers (${wrong.join('; ')})`);
    const ch = E.gateChoices([{ name: 'Alaska Marine Highway Ferry Terminal', kind: 'ferry_terminal', lat: 55.37, lng: -131.72 }, { name: 'Berth 1 Cruise Ship Dock', lat: 55.342, lng: -131.646 }], 'cruise');
    ok(ch.length === 1 && /Berth 1/.test(ch[0].name), `the ship's pier is chosen over the state ferry (got ${ch.map(x => x.name)})`);
    ok(E.cruiseRank({ name: 'Marina Bay Cruise Centre' }) > E.cruiseRank({ name: 'Harbour' }), 'a pier named for cruises ranks above a plain harbour'); }
  // Round 1 S1-3: no military or executive airfield is offered as the airport, and a closed station never as a station.
  { const a = E.gateChoices([{ name: 'Tennessee Air National Guard', lat: 36.1, lng: -86.7 }, { name: 'Example Executive Airport', lat: 36.3, lng: -86.9 }, { name: 'Example International Airport', lat: 36.12, lng: -86.68 }], 'airport');
    ok(a.length === 1 && /International/.test(a[0].name), `only the passenger airport is offered (got ${a.map(x => x.name)})`);
    const st = E.gateChoices([{ name: 'Example Necropolis railway station (closed 1941)', lat: 51.5, lng: -0.1 }, { name: 'Example Central', lat: 51.53, lng: -0.12 }], 'station');
    ok(st.length === 1 && st[0].name === 'Example Central', `a closed station is never offered (got ${st.map(x => x.name)})`); }
  // Round 1 part 3 (A1): lunch sliding into mid-afternoon costs the plan, so the order and lunch's gap keep it near midday.
  { const r = { over: 0, late: 0, mealPen: 0, waits: 0, end: 900, rideMin: 60 }, lateL = Object.assign({}, r, { lunchLate: 50 });
    ok(E.dayCost(lateL) - E.dayCost(r) >= 15, `a lunch 50 min past ${E.clock(E.LUNCH_BY)} costs about as much as 40 min more riding (got ${E.dayCost(lateL) - E.dayCost(r)})`); }
  // Nov 24 (P1, rule R-05 with R-30): travel words no source confirms (an earlier AI guide's, marked "Not confirmed: ") may say
  // a boat is needed, never how long it takes or when it sails. The same words confirmed give the guide's times; marked, the
  // crossing comes from the distance as an estimate, with no first sailing, no ride floor for a taxi, no note-named ride.
  { const T = () => E.makeTravel({ walk: 'medium' }, {}), town = { lat: 37.86, lng: 27.26 }, words = 'Ferry from the harbour, about 45 min crossing; boats leave from about 9:30.';
    const isle = n => ({ lat: 37.55, lng: 26.97, acrossWater: 'Isle', travelNote: n });
    const fo = n => { const e = T().estimate(town, isle(n)); return (e.options || [e]).find(o => o.kind === 'ferry') || {}; }, fo0 = n => ((T().estimate(town, isle(n)).options) || []).find(o => o.kind === 'ferry') || {};
    const ok1 = fo(words), nc = fo('Not confirmed: ' + words);
    ok(ok1.cross === 45 && ok1.source === 'guide' && ok1.first, `confirmed travel words give the guide's crossing and first sailing (${ok1.cross}, ${ok1.source})`);
    ok(nc.kind === 'ferry' && nc.cross !== 45 && nc.source === 'estimate' && !nc.first, `unconfirmed travel words still mean a boat, but never give its time or first sailing (${nc.kind} ${nc.cross} ${nc.source} first=${!!nc.first})`);
    const land = n => { const e = T().estimate(town, { lat: 37.94, lng: 27.37, travelNote: n }); return (e.options || [e]).find(o => o.kind === 'taxi') || {}; };
    ok(land('Not confirmed: about 2 hours by bus').source !== 'guide' && land('about 2 hours by bus').source === 'guide', 'unconfirmed travel words never set a ride time on land either');
    ok(!/The guide says/.test(T().estimate(town, isle('Not confirmed: ' + words)).note || '') && /not confirmed/.test(T().estimate(town, isle('Not confirmed: ' + words)).note || ''), 'unconfirmed words are never shown as what the guide says');
    ok(!E.noteWays('Not confirmed: Sea bus every 20 minutes, about 10 minutes').length && E.firstSailing('Not confirmed: first boat 9:30') == null, 'no ride or sailing time is read from unconfirmed words anywhere'); }
  // Round 1 S1-8: a stop the map puts across the water is a boat away however close it looks (Lokrum, "Walk 6 min"), and
  // a stop far from any road is reached on foot or by a taxi from the nearest road (Venice: taxis between sights).
  { const tw = E.makeTravel({ walk: 'medium' }, {});
    const town = { lat: 42.640, lng: 18.110 }, isle = { lat: 42.634, lng: 18.118, acrossWater: 'Lokrum' }, isle2 = { lat: 42.600, lng: 18.200, acrossWater: 'Other' };
    const e = tw.estimate(town, isle), back = tw.estimate(isle, town);
    ok(e.mode === 'boat' && !(e.options || []).some(o => o.kind === 'walk' || o.kind === 'taxi'), `a stop across the water 1 km away is a boat ride, never a walk or a taxi (got ${e.mode} ${JSON.stringify((e.options || []).map(o => o.kind))})`);
    ok(back.mode === 'boat', 'and the way back from it too');
    const two = tw.estimate(isle, isle2); ok(two.mode === 'boat' && !(two.options || []).some(o => o.kind === 'walk' || o.kind === 'taxi'), `two stops on two different islands across the water are a boat apart (got ${JSON.stringify((two.options || [two]).map(o => o.kind))})`);
    const same = tw.estimate(isle, { lat: 42.6345, lng: 18.1185, acrossWater: 'Lokrum' }); ok(same.mode === 'walk', 'two stops on the same island are a walk apart');
    const v1 = { lat: 45.434, lng: 12.338, roadGap: 1500 }, v2 = { lat: 45.440, lng: 12.327, roadGap: 900 }, road = { lat: 45.437, lng: 12.318 };
    const vv = tw.estimate(v1, v2); ok(!(vv.options || [vv]).some(o => o.kind === 'taxi'), `two stops far from any road within a walk: no taxi (got ${JSON.stringify((vv.options || [vv]).map(o => o.kind + o.min))})`);
    const plain = E.makeTravel({ walk: 'low' }, {}).estimate({ lat: 45.434, lng: 12.338 }, { lat: 45.48, lng: 12.36 }), vr = E.makeTravel({ walk: 'low' }, {}).estimate(v1, { lat: 45.48, lng: 12.36 });
    const tx = (vr.options || [vr]).find(o => o.kind === 'taxi'), tp = (plain.options || [plain]).find(o => o.kind === 'taxi');
    ok(tx && tp && tx.min > tp.min + 10 && /Walk to the road/.test(tx.how), `a taxi from a stop far from the road starts at the road, the walk to it counted (got ${tx && tx.how} ${tx && tx.min} vs ${tp && tp.min})`);
    void road; }
  // Nov 22 outside test: the boat to an island off an old town was planned from the cruise pier 4 km away ("Off the ship",
  // then "Boat 35 min"). The map's ferry routes say which pier sails to the island: the boat leaves from there, with a
  // ride to it first; with no route known, the nearest pier as before.
  { const ship = { lat: 42.6578, lng: 18.0864 }, isle = { lat: 42.6230, lng: 18.1210, acrossWater: 'Isle' };
    const piers = [{ name: 'Cruise pier', lat: 42.6578, lng: 18.0864 }, { name: 'Old harbour', lat: 42.6412, lng: 18.1118 }, { name: 'Isle pier', lat: 42.6256, lng: 18.1232 }];
    const withRoute = Object.assign(piers.slice(), { links: [{ name: 'Old harbour - Isle', a: { lat: 42.6413, lng: 18.1120 }, b: { lat: 42.6255, lng: 18.1231 } }] });
    const parts = e => (e.parts || ((e.options || []).find(o => o.kind === 'ferry') || {}).parts || []);
    const boatOf = e => parts(e).find(x => x.boat) || {};
    const r = E.makeTravel({ walk: 'medium' }, {}, null, null, null, withRoute).estimate(ship, isle), b = boatOf(r), first = parts(r)[0] || {};
    ok(r.mode === 'boat' && b.from === 'Old harbour' && !first.boat && /to the ferry at Old harbour/.test(first.how || ''), `the boat to an island leaves from the pier its mapped route starts at, with a ride there first (got ${JSON.stringify(parts(r).map(x => x.boat ? 'boat from ' + x.from : x.how))})`);
    const back = E.makeTravel({ walk: 'medium' }, {}, null, null, null, withRoute).estimate(isle, ship), bb = boatOf(back);
    ok(bb.at === 'Old harbour', `and the boat back lands there too (got ${JSON.stringify(parts(back).map(x => x.boat ? 'boat to ' + x.at : x.how))})`);
    const none = E.makeTravel({ walk: 'medium' }, {}, null, null, null, piers.slice()).estimate(ship, isle);
    const far = Object.assign(piers.slice(), { links: [{ name: 'Elsewhere', a: { lat: 42.70, lng: 18.00 }, b: { lat: 42.72, lng: 17.98 } }] });
    const rf = E.makeTravel({ walk: 'medium' }, {}, null, null, null, far).estimate(ship, isle);
    ok(JSON.stringify(parts(rf)) === JSON.stringify(parts(none)), 'a route that does not reach the island changes nothing'); }
  // Nov 22, Richard ("How is Sorrento closed"): a sight the day gives up says the one reason, in numbers when it is time:
  // what it needs with the day's other stops and what is left before the time to be back. Never "closed" unless closed.
  { const s0 = JSON.parse(fs.readFileSync(path.join(dir, 'sample-cruise.json'))), i = s0.days.findIndex(d => /napl/i.test(d.city));
    const sel = ['pompeii-far', 'capri-far', 'sorrento-far', 'pozzuoli-far'], one = JSON.parse(JSON.stringify(s0)); Object.assign(one.days[i], { own: true, wantsOnly: false, selected: sel, mine: sel });
    const po = E.planTrip(one)[i], ws = Object.values(po.dropWhy || {});
    ok((po.dropped || []).length > 0 && ws.length && ws.every(w => /^needs about \d.* is left before \d/.test(w) && !/closed/.test(w)), `a sight given up for time says what it needs and what is left (got ${JSON.stringify(po.dropWhy)})`); }
  // Nov 22, Richard's ship day: a local line every half hour all afternoon showed nothing between 3:20 and 4:35 pm, said
  // as "no departure". A hole far wider than the line's usual gap is missing data: said so, the ride stays a taxi.
  { const deps = [600, 630, 660, 690, 720, 750, 780, 810, 840, 870, 900, 920, 995, 1025, 1055].map(t => ({ t }));
    const leg = { ans: { deps } };
    const h = E.depGap(leg, 940);
    ok(h && h.from === 920 && h.to === 995 && h.every === 30, `a 75-minute hole in a half-hourly line is found as missing times (got ${JSON.stringify(h)})`);
    ok(!E.depGap({ ans: { deps: [600, 720, 840, 960].map(t => ({ t })) } }, 700), 'a line that runs every 2 hours has no hole: its gaps are its timetable');
    ok(!E.depGap(leg, 700), 'no hole where the line runs as usual');
    const sw = E.legAs({ how: 'Train', min: 60, note: '' }, { kind: 'taxi', how: 'Taxi or car', min: 50 }, 'why it changed.');
    ok(sw.swapWhy === 'why it changed.', 'a ride planned another way keeps the reason, for the ride choice notice'); }
  // Nov 22 outside sweep: a way that takes over three times the quickest and 2 h more (next day's bus) is never offered.
  {
    const opts = [{ id: 't', kind: 'taxi', min: 60 }, { id: 'b', kind: 'bus', min: 1561 }, { id: 'm', kind: 'metro', min: 90 }];
    const best = Math.min(...opts.map(o => o.min)), real = o => !(o.min > best * 3 && o.min - best >= 120);
    ok(opts.filter(real).map(o => o.id).join() === 't,m', 'the rule keeps the taxi and a metro of 1 h 30 min, drops a bus of 26 h');
    ok(/o\.min > best \* 3 && o\.min - best >= 120/.test(require('fs').readFileSync(require('path').join(__dirname, '../../src/engine/10-travel.js'), 'utf8')), 'the travel engine applies the same rule to the ride choices'); }
  // Nov 22 outside test: a sight whose spot isn't sure (the guide and the encyclopedia disagree, nothing told which is
  // right) has the rides to and from it said as not sure, never as a fact; a sure sight's rides say nothing of the kind.
  { const H = { name: 'Hotel', lat: 37.97, lng: 23.73 }, win = { start: 540, endBy: 1080, head: [H], tail: [H] };
    const walk = q => E.walkDay([Object.assign({ id: 'x', name: 'Old prayer house', minutes: 30, lat: 37.975, lng: 23.735 }, q)], win, tr.estimate, null).items.filter(x => x.t === 'ride');
    const rd = walk({ posDoubt: true });
    ok(rd.length === 2 && rd.every(x => /Old prayer house is isn't sure|Where Old prayer house is isn't sure/.test(x.note || '')), `both rides to and from a sight whose spot isn't sure say so (got ${JSON.stringify(rd.map(x => x.note))})`);
    ok(walk({}).every(x => !/isn't sure/.test(x.note || '')), "a sight whose spot is sure has no such note"); }
  // The app's map check (water-check.js), its rule apart from the fetching: an island no start stands on, with no way on
  // foot without a ferry, is across the water; a bridge (a way on foot) keeps it on land; the mainland is never across.
  { const fs = require('fs'), src = fs.readFileSync(require('path').join(__dirname, '../../src/features/water-check.js'), 'utf8');
    const W = new Function('fetch', 'allSites', 'keyOf', 'save', 'render', 'window', src + '; return { waterIslandsFrom, waterAcross, waterIslandQuery };')(null, () => [], x => x, () => {}, () => {}, undefined);
    const ans = { elements: [{ tags: { i: '0', isl: '', nm: '', nl: '' } }, { tags: { i: '1', isl: '3600001', nm: 'Lokrum', nl: 'Lokrum' } }, { tags: { i: '2', isl: '3600002', nm: '', nl: 'Bridge Isle' } }, { tags: { i: '3', isl: '' } }] };
    const isl = W.waterIslandsFrom(ans, 4);
    ok(isl[0] === '' && isl[1].name === 'Lokrum' && isl[2].name === 'Bridge Isle' && isl[3] === '', `islands read per point from the map's answer (got ${JSON.stringify(isl)})`);
    const stops = [{ id: 'old' }, { id: 'lok' }, { id: 'br' }];
    const out = W.waterAcross(stops, [{}], isl.slice(0, 3), [isl[3]], i => i === 1 ? false : true);
    ok(out.lok === 'Lokrum' && !out.br && !out.old, `across the water: the island with no way on foot only (got ${JSON.stringify(out)})`);
    ok(!Object.keys(W.waterAcross(stops, [{}], isl.slice(0, 3), [isl[1]], () => false)).includes('lok'), 'a stop on the island the ship or hotel is on is not across the water');
    ok(!Object.keys(W.waterAcross(stops, [{}], isl.slice(0, 3), [null], () => false)).length, 'no answer about the start: nothing is marked');
    ok(!Object.keys(W.waterAcross(stops, [{}], isl.slice(0, 3), [isl[3]], () => null)).length, 'no answer from the walking router: nothing is marked');
    // Round 2 re-check: the map's island question often gets no answer; a walking route that takes a ferry is enough.
    { const Wh = new Function('fetch', 'allSites', 'keyOf', 'save', 'render', 'window', 'hav', src + '; return { waterAcross };')(null, () => [], x => x, () => {}, () => {}, undefined, E.hav);
      const st = [{ id: 'a', name: 'Isle A', lat: 42.627, lng: 18.119 }, { id: 'b', name: 'Tower', lat: 42.630, lng: 18.121 }, { id: 'c', name: 'Summit', lat: 42.70, lng: 18.2 }, { id: 'd', name: 'Old town', lat: 42.64, lng: 18.11 }], none = st.map(() => null);
      const r = Wh.waterAcross(st, [{}], none, [null], i => ['ferry', 'ferry', false, true][i]);
      ok(r.a === 'Isle A' && r.b === 'Isle A' && !r.c && !r.d, `with no island answer: a ferry on the only way on foot is across, stops close together share one island, a summit with no path is not (got ${JSON.stringify(r)})`);
      const fr = Wh.waterAcross(st, [{}], none, [null], i => i === 2 ? false : true, i => i === 2);
      const fn = Wh.waterAcross(st, [{}], none, [null], i => i === 2 ? false : true, () => false);
      ok(fr.c && !fn.c, 'no path near a stop over a kilometre from any road: reached by boat; near a road it is not');
      const nr = Wh.waterAcross(st, [{}], none, [null], i => i === 0 ? 'none' : true);
      ok(nr.a === 'Isle A' && !nr.b, 'paths that never join the start\'s (another shore) are across the water');
      const same = Wh.waterAcross(st, [{}], [isl[1], null, null, null], [isl[1]], () => 'ferry');
      ok(!same.a, 'a ferry shortcut on the island a start stands on is not across the water'); }
    ok(/is_in\(42\.00000,18\.00000\)/.test(W.waterIslandQuery([{ lat: 42, lng: 18 }])) && /make w i=0/.test(W.waterIslandQuery([{ lat: 42, lng: 18 }])), 'one map question for all points, each answer tagged with its point'); }
  // Folding (Richard, Nov 20: "a false sense of not enough time in the day"): a picked sight inside a bigger picked visit, or a
  // small open-air sight right beside it, is part of that visit and adds only a little time.
  { const castle = { id: 'c', name: 'Hill Castle', category: 'Castle', lat: 40.0, lng: 10.0, minutes: 120 }, tower = { id: 't', name: 'Keep Tower', lat: 40.0004, lng: 10.0003, minutes: 30, in: ['c'] },
      ot = { id: 'o', name: 'Old Town', category: 'Old town', lat: 40.01, lng: 10.01, minutes: 90, tags: ['open-air'] }, mus = { id: 'm', name: 'Town Museum', lat: 40.0105, lng: 10.0102, minutes: 60, in: ['o'] },
      ch = { id: 'h', name: 'Big Church', lat: 40.02, lng: 10.02, minutes: 45 }, fo = { id: 'f', name: 'Lion Fountain', lat: 40.0208, lng: 10.0205, minutes: 15, tags: ['open-air'] },
      far = { id: 'x', name: 'Far Fountain', lat: 40.03, lng: 10.03, minutes: 15, tags: ['open-air'] };
    const all = [castle, tower, ot, mus, ch, fo, far], g = E.makeGroups(all), fp = E.foldPicks(all, g, () => false), ids = fp.picks.map(s => s.id).sort().join(',');
    ok(ids === 'c,h,m,o,x', `inside a gated visit or right beside a bigger one is folded; a museum in an open old town and a sight further away stay stops (left ${ids})`);
    const c2 = fp.picks.find(s => s.id === 'c'), h2 = fp.picks.find(s => s.id === 'h');
    ok(c2.minutes === 120 + E.foldExtra(tower) && h2.minutes === 45 + E.foldExtra(fo) && E.foldExtra(tower) >= 5 && E.foldExtra(tower) <= 20 && E.foldExtra({ minutes: 300 }) === 20 && E.foldExtra({ minutes: 10 }) === 5,
      `a folded sight adds 5 to 20 min, a quarter of its own time (castle ${c2.minutes}, church ${h2.minutes})`);
    { const area = { id: 'a', name: 'Old Lanes and the historic center', lat: 40.05, lng: 10.05, minutes: 30, tags: ['open-air'] }, chap = { id: 'p', name: 'Small Chapel', lat: 40.0505, lng: 10.0503, minutes: 45 },
        st2 = { id: 's', name: 'Main Street', lat: 40.0502, lng: 10.0501, minutes: 20, tags: ['open-air'] };
      ok((r => r.includes('a') && r.includes('p') && !r.includes('s'))(E.foldPicks([area, chap, st2], E.makeGroups([area, chap, st2]), () => false).picks.map(x => x.id)), 'an area is never folded into a small building beside it (a historic centre into a chapel); a street inside it is part of its walk'); }
    ok(!E.foldPicks([tower], g, () => false).folded.c && E.foldPicks([tower], g, () => false).picks.length === 1, 'a sight inside a visit not picked stays a stop of its own');
    const ga = E.foldPicks([ot, mus], g, s => s.id === 'o'); ok(ga.picks.length === 1, 'inside a place with its own opening hours (a gate) is folded, even a museum');
    // R-16, one story one stop (Nov 24, Richard's Chania screenshot): a sight the walk's story stops at (onWalk) is on that
    // walk, even a gated one in an open old town; the walk keeps the time the two had side by side; alone it stays a stop.
    { const ow = { id: 'w', name: 'Old Town Lanes', category: 'Old town', lat: 40.2, lng: 10.2, minutes: 60, tags: ['open-air'] }, syn = { id: 'y', name: 'Old Synagogue', category: 'Synagogue', lat: 40.2008, lng: 10.2012, minutes: 30, mustSee: true, onWalk: ['w'] },
        far2 = { id: 'z', name: 'Hill Chapel', lat: 40.23, lng: 10.23, minutes: 30, onWalk: ['w'] };
      const gw = E.makeGroups([ow, syn, far2]); ok(gw.groupOf.get('y') === 'w' && gw.groupOf.get('z') === 'w', 'a sight a story walk stops at belongs to that walk');
      const fw = E.foldPicks([ow, syn], gw, () => false), w2 = fw.picks.find(x => x.id === 'w');
      ok(fw.picks.length === 1 && w2 && w2.minutes === 60 && fw.folded.w[0].walk, `a sight on the walk's story folds into the walk, one stop, the walk's time kept (${fw.picks.map(x => x.id + ' ' + x.minutes)})`);
      const fw2 = E.foldPicks([Object.assign({}, ow, { minutes: 30 }), syn], gw, () => false); ok(fw2.picks[0].minutes === 60, `a short walk grows to hold the sight's own time with half an hour around it (${fw2.picks[0].minutes})`);
      const nw = E.foldPicks([ow, Object.assign({}, syn, { onWalk: undefined })], E.makeGroups([ow, Object.assign({}, syn, { onWalk: undefined, lat: 40.21 })]), () => false);
      ok(nw.picks.length === 2, 'without the story, a gated sight in an open old town stays a stop of its own');
      ok(E.foldPicks([syn], gw, () => false).picks.length === 1, 'a sight on a walk that is not planned that day is a stop of its own'); }
    // ...and only while it is open (Nov 24 review): its own hours decide. On the sample cruise's Chania day, a synagogue on
    // the old-town walk open 2-6 pm puts the walk in those hours; open only 4-6 pm (less than the walk) it is not folded;
    // shut that date it is said shut and the walk is not shortened for it. Planted: folding with no hours check (no
    // walkOk) must fold the 4-6 pm one, so these checks can tell the two apart.
    { const base = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'corpus', 'sample-cruise.json'), 'utf8')), di = base.days.findIndex(d => d.city === 'chania');
      const run = sd => { const b = JSON.parse(JSON.stringify(base)), c = b.cities.chania, ot = c.sites.find(x => x.id === 'oldtown');
        c.sites.push({ id: 'syn-t', name: 'Old Synagogue', lat: ot.lat + 0.0008, lng: ot.lng + 0.0012, minutes: 30, mustSee: true, category: 'Synagogue', tags: ['indoor', 'must-see'], onWalk: ['oldtown'] });
        b.days[di].sites['syn-t'] = sd; const p = E.planTrip(b)[di]; return { stops: p.items.filter(x => x.t === 'stop'), ex: (p.explain || []).join(' | ') }; };
      const a = run({ closed: false, oh: { spans: [[840, 1080]], last: null } }), w = a.stops.find(x => x.id === 'oldtown');
      ok(w && !a.stops.some(x => x.id === 'syn-t') && w.at >= 840 && w.at + w.min <= 1080, `a sight on the walk open 2-6 pm: one stop, the walk planned inside its hours (${w && E.clock(w.at)})`);
      const bb = run({ closed: false, oh: { spans: [[960, 1080]], last: null } });
      ok(!/Old Synagogue is on the/.test(bb.ex), `a sight on the walk open less than the walk lasts is never "seen on the walk" (${bb.ex.slice(0, 160)})`);
      const cc = run({ closed: true, oh: null });
      ok(!/Old Synagogue is on the|walk to Old Synagogue/.test(cc.ex) && /Old Synagogue is closed on this date/.test(cc.ex) && cc.stops.find(x => x.id === 'oldtown').min === 60, `a sight on the walk shut that date is said shut and the walk keeps its time (${cc.ex.slice(0, 160)})`);
      const g2 = E.makeGroups([{ id: 'w', name: 'Old Town Lanes', category: 'Old town', lat: 1, lng: 1, minutes: 60 }, { id: 's', name: 'Old Synagogue', lat: 1.0008, lng: 1.0012, minutes: 30, onWalk: ['w'] }]), pk = [{ id: 'w', name: 'Old Town Lanes', category: 'Old town', lat: 1, lng: 1, minutes: 60 }, { id: 's', name: 'Old Synagogue', lat: 1.0008, lng: 1.0012, minutes: 30, onWalk: ['w'] }];
      ok(E.foldPicks(pk, g2, () => false).picks.length === 1 && E.foldPicks(pk, g2, () => false, () => false).picks.length === 2, 'planted: without the hours check the shut sight would fold; with it, it stays apart'); }
    // In a plan: one stop, the folded sight named on it, claimed for that day, a line that says so.
    const trip = { prefs: { walk: 'medium' }, cities: { k: { key: 'k', name: 'K', sites: all.map(x => Object.assign({}, x)), restaurants: [] } },
      days: [{ i: 0, type: 'land', city: 'k', date: '2027-05-04', startTime: '09:00', hours: 9, lodging: { name: 'Hotel', lat: 40.005, lng: 10.005 }, selected: ['c', 't'], own: true }, { i: 1, type: 'land', city: 'k', date: '2027-05-05', startTime: '09:00', hours: 9, lodging: { name: 'Hotel', lat: 40.005, lng: 10.005 }, selected: [] }] };
    const P = E.planTrip(trip), st = (P[0].items || []).filter(x => x.t === 'stop'), cs = st.find(x => x.id === 'c');
    ok(st.length === 1 && cs && cs.min === 120 + E.foldExtra(tower) && (cs.includes || []).includes('Keep Tower') && (P[0].folded || []).includes('t') && (P[0].explain || []).some(t => t === 'Keep Tower is inside Hill Castle: seen on that visit (' + E.foldExtra(tower) + ' min more), not a stop of its own.'),
      `castle and its tower picked: one visit of ${120 + E.foldExtra(tower)} min that names the tower, and says so (got ${st.map(x => x.name + ' ' + x.min).join(', ')})`);
    ok(!(P[1].items || []).some(x => x.id === 't'), 'a folded sight is never planned again on another day'); }
  // Tester's safety findings (Nov 20): the right station or airport or a question, never a building site; border trains;
  // no "your picks" when the traveler picked nothing; one leave-by time.
  { const ch = E.gateChoices([{ name: 'Chantier Grand Paris Express - Future Station Saint-Denis-Pleyel', lat: 48.918, lng: 2.343 }, { name: 'Gare du Nord', lat: 48.8809, lng: 2.3553 }, { name: 'Paris Gare du Nord', lat: 48.8812, lng: 2.3550 }, { name: 'Gare de Lyon', lat: 48.8443, lng: 2.3744 }]);
    ok(ch.length === 2 && !ch.some(x => /chantier|future/i.test(x.name)), `a building site is never a station, and one place is listed once (got ${ch.map(x => x.name).join(', ')})`);
    const wrong = [['station', { name: 'Central Fire Station' }], ['station', { name: 'Rubis Service Station' }], ['station', { name: 'Old Terminus' }], ['station', { name: 'Main Square', kind: 'subway_entrance' }],
      ['airport', { name: 'Harbor Seaplane Base' }], ['airport', { name: 'List of airports in the Greater Area' }], ['airport', { name: 'City Airfield' }], ['cruise', { name: 'Gladstone Freight Terminal' }], ['cruise', { name: 'City Marina' }], ['cruise', { name: 'Kotor Bay' }], ['cruise', { name: 'Port', kind: 'fuel' }]];
    const right = [['station', { name: 'Central Station', kind: 'station' }], ['station', { name: 'Roma Termini' }], ['airport', { name: 'International Airport', kind: 'aerodrome' }], ['cruise', { name: 'Prince George Wharf' }], ['cruise', { name: 'Cruise Terminal', kind: 'ferry_terminal' }]];
    const badOk = wrong.filter(([k, c]) => E.gateOk(k, c)).map(([k, c]) => k + ': ' + c.name), goodNo = right.filter(([k, c]) => !E.gateOk(k, c)).map(([k, c]) => k + ': ' + c.name);
    ok(!badOk.length && !goodNo.length, `a station, airport or cruise port is the right kind of place (taken wrongly: ${badOk.join('; ') || 'none'}; refused wrongly: ${goodNo.join('; ') || 'none'})`);
    const hotel = { name: 'Hotel', lat: 51.5007, lng: -0.1246 }, st = { name: 'St Pancras', lat: 51.5308, lng: -0.1260 };
    const trip = (o, dd) => ({ prefs: { walk: 'medium' }, cities: { lon: { key: 'lon', name: 'L', sites: [{ id: 'wa', name: 'Abbey', lat: 51.4993, lng: -0.1273, minutes: 90 }], restaurants: [] } },
      days: [Object.assign({ i: 0, type: 'departure', mode: 'train', city: 'lon', date: '2027-05-03', time: '12:31', startTime: '09:00', hours: 8, lodging: hotel, point: Object.assign({}, st, o || {}), selected: [] }, dd || {})] });
    const asked = E.planTrip(trip({ ask: ['St Pancras', 'Victoria'] }))[0];
    ok(asked && asked.error && /^Which station do you leave from\?/.test(asked.error) && !asked.items, `a city with more than one station and none chosen is asked, with no time given on a guess (got ${asked && (asked.error || 'a plan')})`);
    ok(E.trainNeed('France', 'Germany') === E.BORDER_NEED.open && E.trainNeed('United Kingdom', 'France') === E.BORDER_NEED.passport && E.trainNeed('Italy', 'Italy') === null && E.trainNeed('', 'France') === null, 'border trains: ID checks inside the open-border area, passport checks across its edge');
    const uk = E.planTrip(trip(null, { country: 'United Kingdom', toCountry: 'France', toOther: true }))[0], unk = E.planTrip(trip(null, { toOther: true }))[0], home = E.planTrip(trip(null, { country: 'Italy', toCountry: 'Italy', toOther: true }))[0];
    ok(uk.endBy === 12 * 60 + 31 - E.BORDER_NEED.passport && uk.explain.some(t => /passport and security/.test(t)), `a train out of Britain to France: at the station ${E.BORDER_NEED.passport} min before, and said (back by ${E.clock(uk.endBy)})`);
    ok(unk.endBy === 12 * 60 + 31 - E.BORDER_NEED.open && unk.explain.some(t => /Where passports and bags are checked/.test(t)) && home.endBy === 12 * 60 + 31 - E.MODES.train.need, `countries unknown: ${E.BORDER_NEED.open} min and the plan says when to allow more; a train at home keeps ${E.MODES.train.need} min`);
    const wants = E.planTrip(Object.assign(trip(null, { time: '09:31', wantsOnly: true }), {}))[0], tw = trip(null, { time: '10:31', wantsOnly: true }); tw.days[0].selected = ['wa'];
    const pw = E.planTrip(tw)[0], tp = trip(null, { time: '10:31' }); tp.days[0].selected = ['wa']; const pp = E.planTrip(tp)[0];
    ok(!(pw.dropped || []).length && pw.explain.some(t => /^Not planned today: Abbey/.test(t)) && (pp.dropped || []).length === 1, `a sight the guide wanted that doesn't fit is "not planned today", never a dropped pick; a real pick that doesn't fit is (${(pw.dropped || []).length} / ${(pp.dropped || []).length})`);
    // One leave-by on every leaving and boarding day of every saved trip: the time the last rides to the end begin.
    const PD = path.join(__dirname, '..', 'places', 'data'), places = {}; let n = 0; const bad = [];
    if (fs.existsSync(PD)) for (const g of fs.readdirSync(PD).filter(g => g.endsWith('.json'))) { const q = JSON.parse(fs.readFileSync(path.join(PD, g))); places[q.key] = q; }
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { let s, pl; try { s = E.applyPlaces(JSON.parse(fs.readFileSync(path.join(dir, f))), places); pl = E.planTrip(s); } catch (e) { continue; }
      pl.forEach((p, i) => { if (!p || !p.items || !(/departure|embark/.test(s.days[i].type) || (s.days[i].type === 'port' && p.leaveAt))) return; if (!p.items.some(x => x.t === 'stop' || (x.t === 'meal' && !x.onBoard))) return; n++;
        const its = p.items, endI = its.findIndex(x => x.t === 'end'); let k = endI, t = its[endI].at; while (k > 0 && (its[k - 1].t === 'ride' || (its[k - 1].t === 'fixed' && !/bags/i.test(its[k - 1].name || '')))) { k--; t -= (its[k].min || 0) + (its[k].wait || 0); }
        // The way back counts a fixed step on it (a cable car's queue down), never just the rides after it (Nov 20 sweep).
        const ride = its[endI].at - t, timed = its.slice(k, endI).some(x => x.mode === 'boat' || x.kind === 'ferry' || (x.ans && (x.ans.deps || []).length)), want = timed ? t : Math.max(t, p.endBy - ride);
        const lines = (p.explain || []).filter(x => / leave for .* by |^Leave for /i.test(x));
        // Never later than the time to be back less the ride there (Round 1, Ketchikan: the badge was the time to be back).
        if (!p.leaveAt || p.leaveAt.out !== want || p.leaveAt.out + ride > p.endBy || lines.length !== 1 || !lines[0].endsWith(E.clock(want) + '.') || (p.explain || []).some(x => /^Leave by /.test(x))) bad.push(`${f} day ${i + 1}: ${lines.join(' | ') || 'no line'} (leave ${p.leaveAt && E.clock(p.leaveAt.out)}, want ${E.clock(want)}, ride ${ride}, back by ${E.clock(p.endBy)})`); }); }
    ok(n > 10 && !bad.length, `one leave-by time on every leaving, boarding and port day: the latest that still gets back in time after the rides there (${n} days; ${bad.slice(0, 3).join('; ')})`); }
  // A way a start place's note names (a port's sea bus or shuttle) is a choice of its own, never taken on its own, with the
  // wait for it; the way back to the ship waits the whole interval (Nov 20 UI review, finding 5).
  { const w = E.noteWays('Sea bus to the old harbor every 20 to 30 minutes, about 10 minutes. A port shuttle bus runs to the main square.');
    ok(w.length === 2 && w[0].kind === 'ferry' && w[0].how === 'Sea bus' && w[0].ride === 10 && w[0].every === 30 && w[1].kind === 'bus' && w[1].how === 'Port shuttle bus', `a note's ways are read with their names, times and intervals (got ${JSON.stringify(w.map(x => [x.kind, x.how, x.ride, x.every]))})`);
    const port = { name: 'Port', lat: 37.4467, lng: 25.3289, startNote: 'Sea bus to the old harbor every 20 to 30 minutes, about 10 minutes.' }, town = { name: 'Town', lat: 37.4456, lng: 25.3589 }, tr = E.makeTravel({ walk: 'medium' }, {});
    const out = tr.estimate(port, town), back = tr.estimate(town, Object.assign({}, port, { backToShip: true })), so = (out.options || []).find(o => o.how === 'Sea bus'), sb = (back.options || []).find(o => o.how === 'Sea bus');
    ok(so && sb && out.kind !== 'ferry' && back.kind !== 'ferry' && so.min === 10 + 15 + 10 && sb.min >= 10 + 30 + 10, `the port's sea bus is offered both ways, never picked on its own, with half the interval going out and all of it back (out ${so && so.min}, back ${sb && sb.min})`);
    const pick = E.makeTravel({ walk: 'medium' }, { [E.pairKey(port, town)]: 'ferry' }).estimate(port, town);
    const tap = E.makeTravel({ walk: 'medium' }, { [E.pairKey(port, town)]: 'note|ferry' }).estimate(port, town);
    ok(pick.kind === 'ferry' && pick.how === 'Sea bus' && tap.how === 'Sea bus', `the traveler's tap on it plans it, by kind or by its chip's id (got ${pick.how}, ${tap.how})`);
    ok(!E.noteWays('Right by the old town and the ferries to the islands.').length, 'a note that only says where the port is offers no ride'); }
  // The last day of a trip, arriving with no hotel of the traveler's own: going home at an unknown time, so asked, never
  // planned as a stay (Nov 20 tester: off the ship at 6:00, then a hotel check-in, a museum and a dinner).
  { const hotel = { name: 'Hotel in central X', lat: 25.77, lng: -80.19 }, pier = { name: 'Pier', lat: 25.78, lng: -80.17 };
    const mk = o => ({ prefs: { walk: 'medium' }, cities: { x: { key: 'x', name: 'X', sites: [{ id: 'm', name: 'Museum', lat: 25.74, lng: -80.21, minutes: 90 }], restaurants: [] } },
      days: [Object.assign({ i: 0, type: 'arrival', mode: 'ship', city: 'x', date: '2027-01-15', time: '06:00', hours: 8, lodging: hotel, point: pier, selected: ['m'] }, o)] });
    const last = E.planTrip(mk({ lastDay: true, stayGuess: true }))[0], own = E.planTrip(mk({ lastDay: true, stayGuess: false }))[0], mid = E.planTrip(mk({ lastDay: false, stayGuess: true }))[0];
    ok(last.error && /This is your last day/.test(last.error) && own.items && mid.items, `the trip's last day with no hotel of the traveler's own asks how they leave; with their hotel, or mid-trip, it is planned (${last.error ? 'asked' : 'planned'})`); }
}
// Round 2: a train back to the ship with a change keeps one spare train (a missed change waits for the next), the
// timetable's own interval when it gives one; a straight train keeps the usual 30%.
{ const A = { lat: 41.90, lng: 12.50, name: 'Station A' }, P = { lat: 42.09, lng: 11.79, name: 'Pier', backToShip: true };
  const ans = (ev) => (a, b) => [{ id: 'rail|X', min: 75, label: 'Train + 1 change', mode: 'rail', steps: ['Train 1', 'Train 2'], every: ev }];
  const one = E.makeTravel({ walk: 'medium' }, null, null, null, ans(0), null).estimate(A, P);
  const own = E.makeTravel({ walk: 'medium' }, null, null, null, ans(90), null).estimate(A, P);
  const str = E.makeTravel({ walk: 'medium' }, null, null, null, (a, b) => [{ id: 'rail|Y', min: 75, label: 'Train', mode: 'rail', steps: ['Train 1'] }], null).estimate(A, P);
  const tr1 = o => (o.options || [o]).find(x => x.ans);
  ok(tr1(one) && tr1(one).slack >= E.SPARE_RUN && tr1(own) && tr1(own).slack >= 90 && tr1(str) && tr1(str).slack < E.SPARE_RUN && tr1(str).slack >= 15,
    `a train back to the ship with a change keeps a spare train (${tr1(one) && tr1(one).slack} / ${tr1(own) && tr1(own).slack} / straight ${tr1(str) && tr1(str).slack})`); }
// Round 2 re-check: a big airport known only from the encyclopedia is never dropped beside mapped ones (dropping it
// picked a small airport silently, with no question).
{ const g = E.gateChoices([{ name: 'Big International Airport', lat: 63.98, lng: -22.62, wiki: true }, { name: 'City Airport', lat: 64.13, lng: -21.94, kind: 'aerodrome' }], 'airport');
  ok(g.length === 2 && g.some(x => x.name === 'Big International Airport'), `an airport only the encyclopedia knows stays a choice beside the map's (${g.map(x => x.name)})`); }
// Round 2 re-check: a pier found for a port named apart from its city carries that port's name, so the plan knows it
// serves the place from there and never refuses it as too far.
{ const d0 = E.planTrip ? null : null; const tr0 = E.makeTravel({ walk: 'medium' });
  const base = { i: 0, type: 'port', mode: 'ship', city: 'x', date: '2027-06-01', portArrive: 480, allAboard: 1080, siteSpots: [{ lat: 43.77, lng: 11.25 }], lodging: null };
  const far = E.dayWindow(Object.assign({}, base, { point: { name: 'Cruise Terminal, Example Port', lat: 43.552, lng: 10.30 }, placeName: 'x Example City Example Port (Example City)' }), tr0);
  const bare = E.dayWindow(Object.assign({}, base, { point: { name: 'Cruise Terminal', lat: 43.552, lng: 10.30 }, placeName: 'x Example City Example Port (Example City)' }), tr0);
  ok(!far.farGate && bare.farGate, `a pier named with the port the traveler typed serves the place; an unnamed one far away is refused (${!!far.farGate} / ${!!bare.farGate})`); }
// Round 2 re-check 3: a timetabled ride with no departure near the time it is needed (a rest-day bus whose next one is
// hours later) is never planned on: the taxi instead, said; with a departure soon, the line is kept.
{ const O = { lat: 32.82, lng: 35.0, name: 'Pier' }, S = { id: 'far', lat: 31.78, lng: 35.23, name: 'Far town sight', minutes: 60 };
  const mk = deps => (a, b) => ({ mode: 'transit', kind: 'bus', how: 'Bus 9 + 2 changes', min: 171, ans: { id: 'bus|9', label: 'Bus 9', deps, every: 0, access: { min: 5 } }, source: 'timetable',
    options: [{ id: 'bus', kind: 'bus', how: 'Bus 9 + 2 changes', min: 171, source: 'timetable' }, { id: 'taxi', kind: 'taxi', how: 'Taxi or car', min: 150, source: 'estimate' }] });
  const win = { head: [O], tail: [], start: 390, endBy: 1215, hard: true, notes: [] };
  const D = ts => ts.map(t => ({ t, lead: 5, dur: 171 }));
  const late = E.walkDay([S], win, mk(D([1038, 1068, 1098])), null), soon = E.walkDay([S], win, mk(D([410, 470, 530])), null);
  const r1 = late.items.find(x => x.t === 'ride'), r2 = soon.items.find(x => x.t === 'ride');
  ok(r1.kind === 'taxi' && /no departure near/.test(r1.note || '') && r2.kind === 'bus', `a line with no departure near the time is planned by taxi, said; one leaving soon is kept (${r1.kind} / ${r2.kind})`);
  // Re-check 4: the departures are a sample. A train known by its own number (one or two departures), a time before the
  // first search's hour with a departure soon after it, or no later departure in the sample never drop the line.
  const early = E.walkDay([S], Object.assign({}, win, { start: 450 }), mk(D([511])), null), none = E.walkDay([S], Object.assign({}, win, { start: 900 }), mk(D([500, 560, 620])), null);
  const k = r => r.items.find(x => x.t === 'ride').kind;
  ok(k(early) === 'bus' && k(none) === 'bus', `a sample of departures never drops a line without strong evidence (${k(early)} / ${k(none)})`);
  // Re-check 5: the way back to the ship rests only on a known departure near the time; else another way.
  const Z = Object.assign({}, O, { id: 'ship', backToShip: true });
  const winB = st => Object.assign({}, win, { head: [S], tail: [Z], start: st });
  const bFar = E.walkDay([], winB(884), mk(D([1080])), null), bNear = E.walkDay([], winB(884), mk(D([900])), null);
  const rb = r => (r.items.filter(x => x.t === 'ride').pop() || {}).kind;
  ok(rb(bFar) === 'taxi' && rb(bNear) === 'bus', `the way back to the ship rests only on a departure known near the time (${rb(bFar)} / ${rb(bNear)})`);
  // Nov 22 live probe: departures known only until 9:53 am for a way back at 3:59 pm were said as "no departure near
  // 3:59 pm". Times that don't reach the hour are said as not known yet (still the taxi).
  { const bShort = E.walkDay([], winB(959), mk(D([372, 450, 593])), null), r = bShort.items.filter(x => x.t === 'ride').pop() || {};
    ok(r.kind === 'taxi' && /only reach \d+:\d\d am; the times near \d+:\d\d pm aren't known yet/.test(r.note || '') && !/shows no departure/.test(r.note || ''), `times that don't reach the hour are said as not known, not as no departure (${r.kind}: ${r.note})`);
    const r2 = bFar.items.filter(x => x.t === 'ride').pop() || {}; ok(/shows no departure near/.test(r2.note || ''), `a known gap is still said as no departure (${r2.note})`);
    // Nov 22 live check: an answer the helper marked incomplete (hours it couldn't read) said "FR 8606 shows no departure
    // near 4:23 pm". Said as not read yet, still the taxi.
    const mkP = deps => (a, b) => { const l = mk(deps)(a, b); l.ans = Object.assign({}, l.ans, { partial: true }); return l; };
    const bPart = E.walkDay([], winB(884), mkP(D([700, 840, 1080])), null), r3 = bPart.items.filter(x => x.t === 'ride').pop() || {};
    ok(r3.kind === 'taxi' && /couldn't be read yet/.test(r3.note || '') && !/shows no departure/.test(r3.note || ''), `an incomplete answer's gap is said as not read yet (${r3.kind}: ${r3.note})`); }
  // The departures of every answer of the kind count together (a train known by its own number shows once).
  const two = E.makeTravel({ walk: 'medium' }, null, null, null, (a, b) => [{ id: 'rail|A', min: 75, label: 'Train A', mode: 'rail', steps: ['A'], deps: [{ t: 1231 }] }, { id: 'rail|B', min: 80, label: 'Train B', mode: 'rail', steps: ['B'], deps: [{ t: 515 }, { t: 600 }] }], null).estimate({ lat: 41.9, lng: 12.5 }, { lat: 42.09, lng: 11.79 });
  const lt = ((two.options || [two]).find(x => x.kind === 'train') || two).leaveTimes || two.leaveTimes;
  ok(Array.isArray(two.leaveTimes || lt) && (two.leaveTimes || lt).length === 3, `a kind's departures are read together (${JSON.stringify(two.leaveTimes || lt)})`);
  const kd = E.makeTravel({ walk: 'medium' }, null, null, null, (a, b) => [{ id: 'rail|A', min: 75, label: 'Train A', mode: 'rail', steps: ['A'], deps: [{ t: 1231 }], kindDeps: [{ t: 455, a: 5 }, { t: 515, a: 5 }, { t: 1231, a: 8 }] }], null).estimate({ lat: 41.9, lng: 12.5 }, { lat: 42.09, lng: 11.79 });
  ok(JSON.stringify(kd.leaveTimes) === '[450,510,1223]', `every departure of the kind the helper sends is read (${JSON.stringify(kd.leaveTimes)})`); }
// Names in Latin letters only (round 2 outside test, Nov 23: Hebrew train lines, Japanese station and lunch names).
{ const LAT = /^[\u0000-\u024F\u1E00-\u1EFF\u2000-\u206F\u20A0-\u20CF]*$/;
  ok(E.latin('とうきょう') === 'Tokyo' && E.latin('シンジュク') === 'Shinjuku' && E.latin('ラーメン') === 'Ramen' && E.latin('きっさてん') === 'Kissaten', `kana are written in Latin letters (${E.latin('とうきょう')}, ${E.latin('シンジュク')}, ${E.latin('ラーメン')})`);
  ok(E.say('銀座線', 'the stop') === 'the stop' && E.say('תל אביב מרכז', 'the stop') === 'the stop' && E.say('Tel Aviv HaShalom', 'x') === 'Tel Aviv HaShalom', 'a name with no Latin reading gives way to a plain word');
  const st = ['Take 銀座線 from 渋谷 to 銀座', 'Train קו 1 to תל אביב מרכז', 'Walk 5 min to 新宿 station'].map(x => E.say(x));
  ok(st.every(x => LAT.test(x)) && st[0] === 'Take the line from the stop to the stop' && st[2] === 'Walk 5 min to the station', `ride steps keep no other script (${st.join(' | ')})`);
  ok(E.transitLabel({ mode: 'train', ref: 'קו 1' }) === 'Train' && E.transitLabel({ mode: 'subway', ref: 'G' }) === 'Metro G' && E.transitLabel({ mode: 'subway', ref: '7' }) === 'Metro Line 7', `a Hebrew line letter is left out of the line's label (${E.transitLabel({ mode: 'train', ref: 'קו 1' })})`);
  const tr = E.makeTravel({ walk: 'medium' }, null, null, null, () => [{ id: 'rail|1', min: 40, label: 'רכבת ישראל', mode: 'rail', steps: ['Train רכבת from חיפה to תל אביב'] }], null).estimate({ lat: 32.8, lng: 35.0 }, { lat: 32.08, lng: 34.78 });
  const shown = [tr.how].concat((tr.options || []).flatMap(o => [o.how].concat(o.steps || []))).filter(Boolean);
  ok(shown.every(x => LAT.test(x)), `a ride's label and steps from the helper keep no other script (${shown.join(' | ')})`); }
// Nov 23 ride check against real timetables: trains with no timetable (only how often they run) were planned with a
// full gap of waiting, about 28 min longer than the real ride. Going out: half the gap plus boarding, the full gap kept
// as "up to". On the way back to the ship (or a train or plane): the full gap, unchanged. With real departures: as sent.
{ const ans = deps => [{ id: 'rail|N', min: 13 + 40 + 63, ride: 40, wait: 63, every: 60, everySrc: 'usual', label: 'Train N', mode: 'train', kind: 'Train', steps: ['N'], noTimetable: !deps, deps, access: { how: 'walk', min: 5, km: 0.4 }, egress: { how: 'walk', min: 8, km: 0.6 } }];
  const A = { lat: 41.9, lng: 12.5 }, B = { lat: 42.09, lng: 11.79 }, train = e => (e.options || [e]).find(x => x.kind === 'train') || {};
  const out = train(E.makeTravel({ walk: 'medium' }, null, null, null, () => ans(), null).estimate(A, B));
  const back = train(E.makeTravel({ walk: 'medium' }, null, null, null, () => ans(), null).estimate(A, Object.assign({ backToShip: true }, B)));
  const dl = train(E.makeTravel({ walk: 'medium' }, null, null, null, () => ans(), null).estimate(A, Object.assign({ deadline: 1000 }, B)));
  const tt = E.expectWait(ans([{ t: 600 }])[0], false);
  // Testing thread review (Nov 23): the ride from the last stop to the day's own fixed steps (collect the bags, the cable
  // car down) is part of the way back: the full gap, also when the same travel already answered the plain point.
  const trS = E.makeTravel({ walk: 'medium' }, null, null, null, () => ans(), null), plainB = train(trS.estimate(A, B)), fxB = train(trS.estimate(A, Object.assign({}, B, { fixed: true, name: 'Collect bags' })));
  ok(plainB.ans && plainB.ans.wait === 33 && fxB.ans && fxB.ans.wait === 63, `the ride to a fixed step (collect the bags, the cable car down) keeps the full gap, even after the same place was answered plain (${plainB.ans && plainB.ans.wait} / ${fxB.ans && fxB.ans.wait})`);
  ok(out.ans && out.ans.wait === 33 && out.ans.waitMax === 63 && out.ans.min === 86 && out.ans.minMax === 116, `a ride out on a line with no timetable plans half the gap plus boarding, keeps the full gap as "up to" (${out.ans && out.ans.wait}/${out.ans && out.ans.waitMax}, ${out.ans && out.ans.min})`);
  ok(back.ans && back.ans.wait === 63 && back.ans.waitMax == null && dl.ans && dl.ans.wait === 63, `the ride back to the ship, a train or a plane keeps the full gap (${back.ans && back.ans.wait} / ${dl.ans && dl.ans.wait})`);
  ok(back.min >= out.min + 30, `the way back to the ship is planned at least the half gap longer than the same ride out (${back.min} vs ${out.min})`);
  ok(tt.wait === 63 && tt.waitMax == null, 'an answer with real departures keeps its own wait (the timeline waits for the real next one)');
  ok(E.expectWait(Object.assign(ans()[0], { wait: 20 }), false).wait === 20, 'never a longer wait than the helper sent'); }
// Nov 23 live recheck (outside tester, f01): an island sight off the old town planned as "Taxi or car 16 min" whenever the
// phone's own water check couldn't reach the busy map server. The place file now says which sights are across the water.
{ const b0 = { cities: { 'Test Harbour': { city: 'Test Harbour', sites: [{ id: 'isle1', name: 'Isle Garden', lat: 42.62, lng: 18.12 }, { id: 'town1', name: 'Town Gate', lat: 42.64, lng: 18.11 }], farther: [] } }, days: [] };
  const P = { 'Test Harbour': { islands: { centre: null, towns: {}, sites: { isle1: { island: { id: '1', name: 'Isle' }, across: true }, town1: { island: null, across: false } } } } };
  const out = E.applyPlaces(b0, P), ss = out.cities['Test Harbour'].sites;
  ok(ss[0].acrossWater === 'Isle' && !ss[1].acrossWater && !b0.cities['Test Harbour'].sites[0].acrossWater, `a sight the place file puts across the water is reached by boat, offline (${ss[0].acrossWater} / ${ss[1].acrossWater})`); }
// R-06 as a class rule (Nov 23): ANY stop on a mapped island the centre isn't on and no path reaches on foot is across the
// water, from the island outlines in the place file: a stop the file never heard of (one the traveler adds, one the guide
// or the helper brings in, a town's own sights), offline. Never one on the centre's island, one a footbridge reaches, or
// one whose walk answer is unknown.
{ const sq = (s, w, n, e) => [s, w, s, e, n, e, n, w, s, w];
  const shapes = [{ id: 'w1', name: 'Mainland Town', walk: true, rings: [sq(42.63, 18.08, 42.66, 18.13)] },
    { id: 'w2', name: 'Lokrum', walk: false, rings: [sq(42.615, 18.115, 42.63, 18.135)] },
    { id: 'w3', name: 'Bridge Isle', walk: true, rings: [sq(42.60, 18.05, 42.61, 18.07)] },
    { id: 'w4', name: 'Unknown Rock', walk: null, rings: [sq(42.59, 18.14, 42.595, 18.15)] },
    { id: 'w5', name: 'Lake Islet', walk: false, rings: [sq(42.645, 18.10, 42.647, 18.102)] }];
  const b0 = { cities: { 'Test Harbour': { city: 'Test Harbour', sites: [{ id: 'own1', name: 'Garden on the island', lat: 42.622, lng: 18.124 }, { id: 'g', name: 'Old Gate', lat: 42.64, lng: 18.11 },
    { id: 'br', name: 'Bridge Chapel', lat: 42.605, lng: 18.06 }, { id: 'rk', name: 'Rock', lat: 42.592, lng: 18.145 }, { id: 'lk', name: 'Islet Church', lat: 42.646, lng: 18.101 }, { id: 'sea', name: 'Mainland Hill', lat: 42.70, lng: 18.20 }],
    farther: [{ id: 'ft', name: 'Island Town', lat: 42.618, lng: 18.12, minutes: 90 }] } }, days: [] };
  const P = { 'Test Harbour': { islands: { centre: { id: '1', name: 'Mainland Town' }, centreShape: 'w1', towns: {}, sites: {}, shapes } } };
  const out = E.applyPlaces(b0, P), c = out.cities['Test Harbour'], by = id => c.sites.concat(c.farther).find(x => x.id === id);
  ok(by('own1').acrossWater === 'Lokrum' && by('ft').acrossWater === 'Lokrum', `a stop the place file never named, on an island no path reaches, is across the water (${by('own1').acrossWater} / ${by('ft').acrossWater})`);
  ok(!by('g').acrossWater && !by('br').acrossWater && !by('rk').acrossWater && !by('sea').acrossWater, 'never across: the centre\'s own island, a footbridge, an island with no walk answer, the mainland');
  ok(by('lk').acrossWater === 'Lake Islet', 'an islet inside a bigger island\'s outline counts as the islet');
  ok(!b0.cities['Test Harbour'].sites[0].acrossWater, 'the place outlines never change the bucket they were given');
  { const b1 = JSON.parse(JSON.stringify(b0)); b1.days = [{ city: 'Test Harbour', date: '2027-07-01', type: 'port', point: { name: 'Pier', lat: 42.617, lng: 18.118 } }];
    const o1 = E.applyPlaces(b1, P).cities['Test Harbour']; ok(!o1.sites.find(x => x.id === 'own1').acrossWater, 'never across: the island a day of the place starts from (the ship\'s pier on it)');
    b1.days.push({ city: 'Test Harbour', date: '2027-07-02', type: 'port', point: { name: 'Town quay', lat: 42.64, lng: 18.11 } });
    ok(E.applyPlaces(b1, P).cities['Test Harbour'].sites.find(x => x.id === 'own1').acrossWater === 'Lokrum', 'but still across when another day of the place starts on the main island'); }
  { const IS = require('../places/island-shapes.cjs'), f = sq(42.63, 18.08, 42.66, 18.13); ok(IS.nearRing(f, 42.6603, 18.10, 60) && !IS.nearRing(f, 42.67, 18.10, 60), 'a path end 30 m off the simplified coast counts as on the island; one 1 km off does not'); }
  const st = Date.now(); for (let i = 0; i < 200; i++) E.islandAt(shapes, { lat: 42.6 + i * 0.0003, lng: 18.1 }); ok(Date.now() - st < 200, 'island lookups are quick'); }
// The build's ring joining and simplifying (tools/places/island-shapes.cjs): a relation's outer ways in any direction join
// into one closed ring; a ring's inside stays inside after simplifying; a tiny islet keeps an inside.
{ const IS = require('../places/island-shapes.cjs'), g = a => a.map(([lat, lon]) => ({ lat, lon }));
  const rel = { type: 'relation', members: [{ type: 'way', role: 'outer', geometry: g([[0, 0], [0, 1], [1, 1]]) }, { type: 'way', role: 'outer', geometry: g([[0, 0], [1, 0], [1, 1]]) }, { type: 'way', role: 'inner', geometry: g([[0.4, 0.4], [0.5, 0.5]]) }] };
  const r = IS.rings(rel); ok(r.length === 1 && r[0].length === 5 && IS.inRing(IS.flat(r[0]), 0.5, 0.5) && !IS.inRing(IS.flat(r[0]), 1.5, 0.5), `a relation's outer ways join into one ring (${r.length} rings, ${r[0] && r[0].length} points)`);
  const wig = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * 2 * Math.PI, rr = 0.01 * (1 + 0.002 * Math.sin(a * 40)); wig.push([42 + rr * Math.sin(a), 18 + rr * Math.cos(a)]); }
  const sm = IS.simplify(wig, 0.0003); ok(sm.length < wig.length && IS.inRing(IS.flat(sm), 42, 18) && E.inRing(IS.flat(sm), 42, 18), `simplifying keeps the island's inside (${wig.length} -> ${sm.length} points)`);
  const tiny = IS.simplify([[42, 18], [42.00001, 18.00001], [42.00002, 18.00001], [42.00001, 18.00002], [42, 18.00002], [42, 18]], 0.0003); ok(tiny.length === 5, 'a tiny islet keeps a box, so it still has an inside');
  const ip = IS.insidePoint(IS.flat(sm)); ok(IS.inRing(IS.flat(sm), ip.lat, ip.lng), 'the point the walking router aims at is inside the island'); }
// Nov 23 phone feel test: the "Needs" box took 2.5 s, most of it scanning every mapped place to eat for each restaurant.
// One rule for lookups by position (E.nearby, a grid built once per list): its answer is exactly a full scan's, checked
// on every places file at points across the place and at its edges, for short and long distances.
{ const PD = path.join(__dirname, '..', 'places', 'data'); let n = 0, bad = 0;
  const pos = x => x && isFinite(x[1]) && isFinite(x[2]) ? { lat: x[1], lng: x[2] } : null;
  if (fs.existsSync(PD)) for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json'))) { const P = JSON.parse(fs.readFileSync(path.join(PD, f))), L = P.eatHours || []; if (!L.length) continue;
    for (let i = 0; i < L.length; i += Math.max(1, Math.floor(L.length / 25))) for (const km of [0.05, 0.2, 1, 3]) { const p0 = pos(L[i]); if (!p0) continue;
      const pt = { lat: p0.lat + (i % 3 - 1) * 0.0013, lng: p0.lng + (i % 5 - 2) * 0.0011 }, want = L.filter(x => pos(x) && E.hav(pt, pos(x)) <= km), got = E.nearby(L, pos, pt, km); n++;
      if (want.length !== got.length || want.some((x, k) => x !== got[k])) bad++; } }
  ok(n > 100 && bad === 0, `lookups by position give exactly a full scan's answer (${n} lookups on every places file, ${bad} different)`); }
console.log(`\n${oks} checks passed, ${fails} failed`); process.exit(fails ? 1 : 0);
