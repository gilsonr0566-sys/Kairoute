// Beta 2 engine tests: each piece on its own (made-up days) and against the old engine (saved test trips).
// Pure Node, no browser, no internet, no AI. Usage: node tools/beta2/engine-test.cjs
const E = require('./engine.cjs'), fs = require('fs'), path = require('path');
let fails = 0, oks = 0; const ok = (c, msg) => { if (c) oks++; else { fails++; console.log('FAIL ' + msg); } };
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
  ok(back.options.filter(o => o.min >= 30 && o.kind !== 'walk').every(o => o.slack >= 15), 'every way back to the ship has its extra time'); }
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
  // Too far to walk, and the station a long walk from the far end (so the line is slower than walking all the way):
  // the line is still offered beside the taxi, never dropped.
  { const L3 = line('tram', '3', [['Top', 38.100, 23.700], ['Hill', 38.200, 23.680], ['Bottom', 38.100, 23.660]]), t3 = E.makeTravel({ walk: 'low' }, {}, null, [L3]);
    const p = { lat: 38.1003, lng: 23.7003 }, q = { lat: 38.1065, lng: 23.660 }, e = t3.estimate(p, q);
    ok(e.mode !== 'walk' && (e.options || []).some(o => o.mode === 'transit'), `a ride leg offers the line even when walking all the way would be as quick (got ${e.mode} ${JSON.stringify((e.options || []).map(o => o.mode + o.min))})`); }
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
    (s0.days || []).forEach((d, i) => { if (!full[i] || !full[i].items || !Array.isArray(d.selected)) return; n++; // a day the app fills itself (old trips) takes other days' leftovers
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
    const tight = cut => { const s = JSON.parse(JSON.stringify(s0)); s.days[di].selected = ids; s.days[di].allAboard -= cut; return s; };
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
      ok(j >= 0 && (ps[i].explain || []).some(e => e.startsWith(name + ' is closed on')), `${name}, shut on its day, is planned on another day of the stay and the plan says so`); })); } }

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
  ok(st.at >= 540 + 40 && ri.wait > 0 && ri.firstBoat === 540, `nobody lands on the island before the first boat out could (landed ${E.clock(st.at)}, wait ${ri.wait})`); }
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
    if (ni >= 0) { s.days[ni].selected = ['duomo-na', 'capri-far']; s.days[ni].own = true; (s.cities[s.days[ni].city].farther || []).forEach(x => { if (x.id === 'capri-far') x.minutes = 120; }); const p = E.planTrip(s)[ni], rides = (p.items || []).filter(x => x.t === 'ride');
      const k = (p.items || []).findIndex(x => x.t === 'ride' && x.mode === 'boat'), before = p.items[k - 1];
      ok(k > 0 && before.t === 'ride' && before.pierName && before.to && E.hav(before.to, p.items[k].from) < 0.01, 'Naples: the cathedral, then a walk or ride to the ferry pier, then the boat from the pier');
      check('sample-cruise.json (cathedral and Capri)', s, [].concat(new Array(ni).fill(null), [p])); } }
  // The pier the guide's note names is the one taken, when it is mapped (not merely the nearest pier).
  { const t = E.makeTravel({}, null, null, [], null, [{ name: 'Near Pier', lat: 40.8429, lng: 14.2612 }, { name: 'Named Quay (Terminal)', lat: 40.8374, lng: 14.2548 }]);
    const e = t.estimate({ lat: 40.8525, lng: 14.2597 }, { lat: 40.5532, lng: 14.2222, travelNote: 'About 50 minutes by fast ferry from Named Quay.' });
    ok(e.parts && e.parts[0].pierName === 'Named Quay (Terminal)' && /from Named Quay/.test(e.how), `the boat leaves from the pier the guide names (got ${e.parts && e.parts[0].pierName})`); }
  // Lunch on every day over lunchtime (Nov 18, Richard: "No lunch in Naples trip"): a day with stops whose time ashore
  // or in town spans lunch has a lunch stop, at a real place, unless the traveler skipped it; a long visit over midday
  // has it inside. Every trip, and the Naples picks that had none (Capri and Pompeii, Capri alone, the cathedral too).
  { let days = 0, said = 0; const noLunch = [];
    const lunchCheck = (f, s, plans) => plans.forEach((p, i) => { if (!p || !p.items || p.error || p.safe) return; const d = s.days[i]; if (((d.mealPrefs || {}).Lunch || {}).skip) return;
      const w = E.dayWindow(d, E.makeTravel(s.prefs, s.legModes)); if (!w || w.error || !E.lunchWanted(w) || !p.items.some(x => x.t === 'stop')) return;
      const c = s.cities[d.city] || {}; if (!(c.restaurants || []).length && !(c.farther || []).some(t => (t.foodDrink || []).length)) return; // no place to eat known at all
      days++; const m = p.items.find(x => x.t === 'meal' && x.meal === 'Lunch');
      // None only when the plan says why, plainly (no time left before the ship; no place to eat known out there).
      if (!m && !(p.explain || []).some(t => /no room for lunch|no time for a sit-down lunch|no place to eat|places to eat aren't in the guide/i.test(t))) noLunch.push(`${f} day ${i + 1}`); else if (!m) said++; else if (/^Lunch in /.test(m.name) && (c.farther || []).some(t => ('Lunch in ' + t.name) === m.name && (t.foodDrink || []).some(x => x.kind === 'eat' && isFinite(x.lat) && E.hav(x, t) <= 3))) noLunch.push(`${f} day ${i + 1}: "${m.name}" names no place`); });
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const s = E.applyPlaces(JSON.parse(fs.readFileSync(path.join(dir, f))), places); lunchCheck(f, s, E.planTrip(s)); }
    if (fs.existsSync(nf)) for (const picks of [['capri-far', 'pompeii-far'], ['capri-far'], ['duomo-na', 'capri-far', 'pompeii-far'], ['pompeii-far'], ['sorrento-far', 'pompeii-far']]) {
      const s = E.applyPlaces(JSON.parse(fs.readFileSync(nf)), places), ni = s.days.findIndex(d => /naples/i.test(d.city)); if (ni < 0) continue;
      s.days[ni].selected = picks; s.days[ni].own = true; const ps = E.planTrip(s); lunchCheck('Naples ' + picks.join('+'), s, ps.map((p, k) => k === ni ? p : null));
      check('Naples ' + picks.join('+'), s, ps.map((p, k) => k === ni ? p : null)); }
    for (const x of noLunch.slice(0, 8)) ok(false, `no lunch on a day over lunchtime: ${x}`);
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
        if (sameSet && same && same.choice !== o.id && !same.lost) { notTaken++; if (notTaken <= 3) ok(false, `${f} day ${i + 1}: picked ${o.how}, the plan took ${same.how}`); } } }); }
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
// Nov 20 review (finding 8): a flight or all aboard after midnight is the next morning's; the day stays readable and no
// clock prints a minus sign.
{ const tb = E.makeTravel({ walk: 'medium' }, {});
  for (const t of ['00:40', '05:30']) { const w = E.dayWindow(day({ type: 'departure', mode: 'flight', time: t, point: air }), tb);
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
// Unknown opening hours are never read as open: a stop with an entrance whose hours aren't known for the date is marked,
// and the day says to check.
{ let marked = 0, silent = 0, dawn = 0; for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const s = JSON.parse(fs.readFileSync(path.join(dir, f)));
    E.planTrip(s).forEach((p, i) => { if (!p || !p.items || p.safe) return; const d = s.days[i], c = s.cities[d.city] || {};
      for (const x of p.items.filter(x => x.t === 'stop')) { const sx = (c.sites || []).find(y => String(y.id) === String(x.id)); if (!sx) continue; const sd = (d.sites || {})[x.id];
        if (E.needsHours(sx) && !(sd && (sd.closed || sd.allDay || (sd.oh && sd.oh.spans && sd.oh.spans.length)))) { if (x.hoursUnknown && (p.explain || []).some(t => /Opening hours aren't known/.test(t))) marked++; else silent++;
          // Nov 20 review (finding 7): and never planned at dawn or late on a guess (9 to 5), unless the traveler set the order.
          if (!d.order && (x.at < E.ASSUME_OPEN || x.at + x.min > E.ASSUME_CLOSE)) { dawn++; if (dawn <= 3) ok(false, `${f} day ${i}: ${x.name}, hours unknown, planned at ${E.clock(x.at)}`); } } } }); }
  ok(marked > 0 && !silent && !dawn, `unknown opening hours are said, never read as open, and kept to 9 to 5 (${marked} stops marked, ${silent} silent, ${dawn} outside)`);
  ok(E.needsHours({ tags: ['indoor'] }) && E.needsHours({ tags: ['inside-or-out'] }) && !E.needsHours({ tags: ['open-air'] }) && !E.needsHours({ far: true, tags: ['indoor'] }), 'one rule from the tags decides which sights need hours'); }
ok(E.readable('Café Ñandú') && E.readable("Joe's Bar & Grill") && !E.readable('נתי- מזנון המשק') && !E.readable('東京'), 'a place to eat named only in another script is not readable');
{ const s = E.applyPlaces({ cities: { x: { name: 'X', sites: [{ id: 'a', name: 'A', lat: 1, lng: 1 }], restaurants: [] } }, days: [] }, { x: { key: 'x', cityEats: [{ name: 'נתי- מזנון המשק', lat: 1, lng: 1 }, { name: 'Good Cafe', lat: 1, lng: 1 }] } });
  ok(s.cities.x.restaurants.length === 1 && s.cities.x.restaurants[0].name === 'Good Cafe', 'map places to eat named only in another script are left out'); }
// The order repair takes the best single move, not the first that helps (Nov 19: a sight beside the first stop was sent
// across town and back to fix a late museum, when swapping the two museums fixed it with less riding).
{ const PD = path.join(__dirname, '..', 'places', 'data'), places = {}; if (fs.existsSync(PD)) for (const g of fs.readdirSync(PD).filter(g => g.endsWith('.json'))) { const q = JSON.parse(fs.readFileSync(path.join(PD, g))); places[q.key] = q; }
  const s = E.applyPlaces(JSON.parse(fs.readFileSync(path.join(dir, 'g17-haifa.json'))), places), p = E.planTrip(s)[1], ids = p.items.filter(x => x.t === 'stop').map(x => x.name);
  const old = ['Dome of the Rock', 'Al-Aqsa Mosque', 'Western Wall'].map(n => ids.indexOf(n)), museum = Math.min(...['Israel Museum', 'Bible Lands Museum'].map(n => ids.indexOf(n)).filter(k => k >= 0));
  // (Nov 20: with unknown hours kept to 9 to 5 the museums may come first; what counts is that each side of town is visited once.)
  const mus = ['Israel Museum', 'Bible Lands Museum'].map(n => ids.indexOf(n)).filter(k => k >= 0), museumLast = Math.max(...mus);
  ok(old.every(k => k >= 0) && (old.every(k => k < museum) || old.every(k => k > museumLast)), `the Old City sights together, never split by the museums across town (got ${ids.join(' > ')})`); }
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
    ok(!slow.length, `no way offered beside a walk of up to twice the walking limit is more than ${E.SLOWER_THAN_WALK} min slower than walking (${rides} rides with a walk; ${slow.slice(0, 3).join('; ')})`); }
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
      else ok(false, 'a town with its own sights is in the test trip'); } }
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
    ok(!E.foldPicks([tower], g, () => false).folded.c && E.foldPicks([tower], g, () => false).picks.length === 1, 'a sight inside a visit not picked stays a stop of its own');
    const ga = E.foldPicks([ot, mus], g, s => s.id === 'o'); ok(ga.picks.length === 1, 'inside a place with its own opening hours (a gate) is folded, even a museum');
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
      pl.forEach((p, i) => { if (!p || !p.items || !/departure|embark/.test(s.days[i].type)) return; n++; const its = p.items; let k = its.length - 1, t = its[k].at; while (k > 0 && its[k - 1].t === 'ride') { k--; t -= its[k].min || 0; }
        const lines = (p.explain || []).filter(x => / leave for .* by |^Leave for /i.test(x));
        if (!p.leaveAt || p.leaveAt.out !== t || lines.length !== 1 || !lines[0].endsWith(E.clock(t) + '.') || (p.explain || []).some(x => /^Leave by /.test(x))) bad.push(`${f} day ${i + 1}: ${lines.join(' | ') || 'no line'} (rides start ${E.clock(t)})`); }); }
    ok(n > 10 && !bad.length, `one leave-by time on every leaving or boarding day, the time its last rides begin (${n} days; ${bad.slice(0, 3).join('; ')})`); }
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
console.log(`\n${oks} checks passed, ${fails} failed`); process.exit(fails ? 1 : 0);
