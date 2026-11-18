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

// ---- Travel estimate is stable and order-free ----
{ const a = { lat: 37.97, lng: 23.72 }, b = { lat: 37.975, lng: 23.73 };
  ok(tr.min(a, b) === tr.min(a, b) && tr.estimate(a, b).mode === 'walk', 'short hop is a walk, same answer every time');
  const tr2 = E.makeTravel({ walk: 'medium' }, { [E.pairKey(a, b)]: 'taxi' }); ok(tr2.estimate(a, b).mode === 'ride', "traveler's chosen ride is used");
  ok(tr.saidMin('About 1 hour on the Circumvesuviana train') === 60 && tr.saidMin('60-75 min') === 75, "guide's ride notes are read"); }

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
    ok(w.start === o.start && w.endBy === o.endBy, `${f} day ${i} ${d.type}: window ${w.start}-${w.endBy}, old ${o.start}-${o.endBy}`);
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
  oks += same; console.log(`ok   ${s.name}: same plan in ${same} of 10 shuffles, nothing used twice, every day safe`);
}
console.log(`\n${oks} checks passed, ${fails} failed`); process.exit(fails ? 1 : 0);
