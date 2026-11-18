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
  ok(ab.mode === E.makeTravel({ walk: 'medium' }, {}).estimate(a, b).mode && ab.min === E.makeTravel({ walk: 'medium' }, {}).estimate(a, b).min, 'offering it never changes the planned leg on its own');
  const ac = tt.estimate(a, c); ok((ac.options || []).some(o => o.mode === 'transit' && /then Tram T to Far East/.test(o.how)), 'one change between lines is found');
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
    if (Math.abs(r.end - o.end) <= 1) same++; else ok(false, `${f} day ${i} ${d.type}: old order ends ${r.end} on the new clock, old engine says ${o.end}`); });
  if (!n && s.old.every(o => !o || o.error)) { console.log(`gap  ${s.name}: the old engine planned no day here either (${(s.old.find(o => o && o.error) || {}).error || 'no plan'})`); continue; }
  ok(n > 0 || liveDays > 0, f + ': no days to compare'); oks += same; console.log(`ok   ${s.name}: ${same} of ${n} timed days match the old engine to the minute${liveDays ? ` (${liveDays} left out: the old app used a live route time)` : ''}`);
}

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
{ const f = path.join(dir, 'sample-cruise.json');
  if (fs.existsSync(f)) {
    const s0 = JSON.parse(fs.readFileSync(f)), di = 5, base = E.planTrip(s0)[di];
    const ids = base.items.filter(x => x.t === 'stop').map(x => String(x.id));
    const tight = cut => { const s = JSON.parse(JSON.stringify(s0)); s.days[di].selected = ids; s.days[di].allAboard -= cut; return s; };
    const p20 = E.planTrip(tight(20))[di], meal20 = p20.items.find(x => x.t === 'meal');
    ok(ids.every(id => p20.items.some(x => x.t === 'stop' && String(x.id) === id)) && meal20 && meal20.min < 60,
      `20 minutes less ashore: every pick kept, the lunch gets quicker instead (lunch ${meal20 && meal20.min} min)`);
    const s90 = tight(90), p90 = E.planTrip(s90)[di], w = E.dayWindow(s90.days[di], E.makeTravel(s90.prefs, s90.legModes));
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
  ok(go.min === 40 + E.PIER_MIN && go.cross === 40 && /40 min crossing/.test(go.how), `the crossing is the guide's time plus the pier, shown apart (got ${go.min} min: ${go.how})`);
  ok(ship.min <= 40 + E.PIER_MIN + Math.max(15, Math.round((40 + E.PIER_MIN) * 0.3 / 5) * 5), 'back to the ship by boat: only the usual extra time on top'); }
{ let boats = 0; for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const s = JSON.parse(fs.readFileSync(path.join(dir, f))), ps = E.planTrip(s);
    ps.forEach((p, i) => p && p.items && p.items.forEach((x, k) => { if (x.t !== 'ride') return; const a = p.items[k - 1], b = p.items[k + 1], c = s.cities[s.days[i].city] || {};
      const site = it => it && it.id != null && [...(c.sites || []), ...(c.farther || [])].find(y => String(y.id) === String(it.id));
      const boatEnd = [site(a), site(b)].filter(y => y && E.byBoat(y.travelNote));
      if (boatEnd.length === 1) { boats++; ok(x.mode === 'boat', `${f} day ${i}: the ride to or from ${boatEnd[0].name} crosses water but is planned as ${x.mode}`); } })); }
  console.log(`ok   ${boats} rides across water, every one by boat`); }

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
      if ((x.t === 'meal' || x.t === 'evening') && x.name) { const k = x.name.toLowerCase(); const was = eats.get(k); if (was != null && was !== i) ok(false, `${f}: ${x.name} used on day ${was} and day ${i}`); eats.set(k, i); } }); });
  ok(unsafe === 0, `${f}: ${unsafe} unsafe stops or late days`);
  // A sight with its own finished guide, a must-see, or the traveler's pick is never folded away into a visit next door.
  const planned = new Set([...sights.keys()]); let kept = 0;
  for (const c of Object.values(s.cities)) for (const g of (c.sites || []).filter(x => x.hasGuide || x.mustSee)) {
    if (planned.has(String(g.id))) { kept++; continue; }
    const gr = E.makeGroups(c.sites || []), holder = gr.groupOf.get(String(g.id));
    // Folded: its group is visited on a day with room for it too, and the plan doesn't say why it was left out.
    const gd = holder != null ? sights.get(String(holder)) : null, gp = gd != null && plans[gd], gw = gp && E.dayWindow(s.days[gd], E.makeTravel(s.prefs, s.legModes));
    const room = gw && isFinite(gw.endBy) ? gw.endBy - gp.end : 0, said = gp && ((gp.explain || []).join(' ').includes(g.name) || (gp.leftOut || []).map(String).includes(String(g.id)));
    const beside = gd != null && !said && room >= (g.minutes || 30) + 25;
    if (beside) ok(false, `${f}: ${g.name} has its own guide or is a must-see, but was folded into the visit to the group around it`); }
  if (f === 'sample-cruise.json') ok(plans.some(p => p && p.items && p.items.some(x => x.t === 'stop' && /Saint Titus/.test(x.name))), 'Heraklion: the Church of Saint Titus, a finished voiced tour, keeps its own stop');
  oks += same; console.log(`ok   ${s.name}: same plan in ${same} of 10 shuffles, nothing used twice, every day safe`);
}
console.log(`\n${oks} checks passed, ${fails} failed`); process.exit(fails ? 1 : 0);
