// Classic day trips check (rule R-37, Nov 25): every city's guide offers its well-known day trips, the ones reached by
// boat included, from free sources alone. A made-up port city ("Testport") whose sources hold every kind of place that
// once went wrong on a real one: an island the encyclopedia points to in its middle (Hvar), an island group that is a
// part of the city's own travel guide (the Princes' Islands, Lantau), a town by boat (Vaxholm), a famous town the
// city's guide never points to (Salerno from Naples), an airport, a stadium, a province, a drive that takes a ferry.
// Part 1 reads the finished Sights screen of a trip made the app's own way (AI off, the helper mocked): what is offered,
// what "Getting there" says, and that nothing was put on the day by the app. Part 2 checks the rule's edges by its own
// function. Part 3 plants each known way this has gone wrong in a copy of the build and must fail on every one.
// Usage: node tools/beta2/day-trips-check.cjs [beta2-site/index.html] [--no-plants]
'use strict';
const { chromium } = require('playwright'), path = require('path'), fs = require('fs'), os = require('os'), { spawn } = require('child_process');
const argv = process.argv.slice(2), FILE = path.resolve(argv.find(a => !a.startsWith('--')) || 'beta2-site/index.html'), PLANTS = !argv.includes('--no-plants');
const MOCK = 'https://mock.test', C = { lat: 41.9, lng: 12.48 }, at = (dx, dy) => ({ lat: +(C.lat + dy / 111).toFixed(5), lng: +(C.lng + dx / 83).toFixed(5) });
const km = p => Math.hypot((p.lat - C.lat) * 111, (p.lng - C.lng) * 83);
const SRC4 = ['Wikivoyage (English)', 'Wikidata (Wikipedia in many languages)', 'Wikipedia (local language)', 'Heritage register'];
let q = 100; const stop = (name, kinds, sl, dx, dy) => Object.assign({ name, wd: 'Q' + (q++), sl, src: SRC4, heritage: true, kinds, en: name + ' is one of the sights every visitor to Testport sees, in the middle of the old town.' }, at(dx, dy));
const stops = [stop('Testport Cathedral', ['building', 'cathedral', 'church', 'structure'], 78, 0, 0.1), stop('Harbour Fort', ['castle', 'fortification', 'structure'], 70, 0.4, -0.2), stop('Testport City Museum', ['building', 'museum', 'structure'], 60, -0.3, 0.3),
  stop('Clock Tower of Testport', ['structure', 'tower'], 50, 0.2, 0.4), stop('Admiral Square', ['square', 'structure'], 45, -0.1, -0.3), stop('Old Market Hall', ['building', 'market', 'structure'], 40, 0.5, 0.2)];
const far = (name, wd, kinds, sl, dx, dy, more) => { const p = at(dx, dy); return Object.assign({ name, wd, sl, kinds, voy: name, said: 0 }, p, { km: +km(p).toFixed(1) }, more || {}); };
const FAR = [
  far('Testvar', 'Q501', ['feature', 'island', 'natural'], 63, 30, -20),                                   // an island: its point is its middle
  far('Testholm', 'Q502', ['admin-area', 'settlement'], 41, 10, 14, { said: 4 }),                          // a town by boat, on a timetable
  far('Testa Islands', 'Q503', ['feature', 'island', 'natural'], 64, -12, -15, { voy: 'Testport/Testa Islands', part: true }), // a part of the city's own guide
  far('Testport International Airport', 'Q504', ['airport', 'structure'], 73, 12, 9, { said: 3 }),
  far('Test Field Stadium', 'Q505', ['building', 'stadium', 'structure'], 71, 8, -6, { said: 1 }),
  far('Testport Grand Prix', 'Q520', ['event', 'occurrence'], 73, 13, -8, { said: 3 }),                    // a race with a travel-guide page: not a place to go
  far('Testport Sea Bridge', 'Q521', ['bridge', 'structure'], 66, -9, -7, { said: 3 }),
  far('Testport Island Airport', 'Q522', ['airport', 'island', 'structure'], 84, -14, 12, { said: 7 }),    // an airport on an island of its own (Hong Kong)
  far('Testport Old Quarter', 'Q523', ['settlement'], 60, 7, 4, { voy: 'Testport/Old Quarter', part: true, said: 8 }), // a district of the city itself, in town (Kadıköy, Bondi)
  far('Testland', 'Q524', ['feature', 'island', 'region'], 260, 16, -14, { said: 5, vt: 'country' }),
  far('Testra', 'Q526', ['admin-area', 'feature', 'organization', 'region'], 74, -20, 9, { said: 6, vt: 'city' }), // a town the encyclopedia files only as a municipality (Sintra)
  far('Testa Delta', 'Q527', ['admin-area', 'feature', 'region', 'settlement'], 60, 18, 12, { said: 5, vt: 'region' }),               // a region page: where the city is, not a place to go
  far('Testport Isles', 'Q525', ['feature', 'island', 'region'], 70, 9, 9, { said: 5, vt: 'region' }),    // the island group the city itself stands on (Cyclades from Mykonos)                                // the country the city is in (Japan from Kyoto)
  far('Testshire Province', 'Q506', ['admin-area'], 95, 20, 20, { said: 4 }),
  far('Old Testa Ruins', 'Q507', ['ancient-city', 'archaeological'], 45, 40, 5, { unesco: true, heritage: true }), // a heritage site with no line: by road
  far('Test Cape Village', 'Q508', ['settlement'], 50, -30, 10, { said: 3 }),                             // the drive takes a car ferry
  far('Far Testerly', 'Q509', ['settlement'], 80, 60, 30, { said: 2 }),                                    // too far by any way
  far('Little Testing', 'Q510', ['settlement'], 8, 15, -9, { said: 1 }),                                   // hardly known
  far('Testbury', 'Q511', ['settlement'], 98, 25, 30),                                                     // famous, but the city's guide never points to it
  far('Testim', 'Q512', ['admin-area', 'settlement'], 30, 31, -50.5, { said: 1 }), far('Testyma', 'Q513', ['archaeological', 'temple'], 45, 30, -50, { said: 2 }), // one outing
  far('テスト島', 'Q516', ['island'], 50, -20, 25, { said: 2 }),
  far('Testa Abbey', 'Q514', ['building', 'monastery', 'structure'], 30, -25, -30, { said: 1 }),
  far('Testmoor', 'Q515', ['settlement'], 40, 22, -12, { said: 1 }),
  far('Testford', 'Q517', ['settlement'], 35, -18, 8, { said: 1 }), far('Testwick', 'Q518', ['settlement'], 25, 14, 22, { said: 1 }),
];
// "Go next" on the city's page: eight villages nothing goes to come first (the old rule read only the first eight).
const nx = (name, wd, dx, dy, note, sl) => { const p = at(dx, dy); return Object.assign({ name, wd, note, rank: 0 }, p, { km: +km(p).toFixed(1) }, sl ? { sl } : {}); };
const NEXT = [...Array(8)].map((_, i) => nx('Hamlet ' + 'ABCDEFGH'[i], 'Q60' + i, 9 + i * 2, -40 + i * 9, 'A quiet hamlet in the hills.')).concat([
  nx('Testvar', 'Q501', 30, -20, 'Testvar: an island of lavender fields and a walled harbour town.', 63), nx('Testby', 'Q519', -9, 12, 'Testby — a market town with a castle, an easy train ride.', 22)]);
NEXT.find(x => x.name === 'Testby').kinds = ['settlement']; NEXT.find(x => x.name === 'Testvar').kinds = ['feature', 'island', 'natural'];
const SOURCES = { area: 'Testport', lang: 'en', langName: 'English', center: C, sources: [], stops, eats: [], far: FAR, next: NEXT };
const PIERS = { Q501: [Object.assign({ name: 'Old Grad Pier' }, at(34, -15)), Object.assign({ name: 'Testvar Town Pier' }, at(19, -22))], Q503: [Object.assign({ name: 'Big Isle Pier' }, at(-11, -14))], Q516: [Object.assign({ name: 'テスト' }, at(-19, 24))], Q530: [Object.assign({ name: 'Testora Pier' }, at(48, -29))], Q531: [Object.assign({ name: 'Water Quay' }, at(-24, -18))], Q525: [Object.assign({ name: 'Town Quay' }, at(0.5, 0.4)), Object.assign({ name: 'Outer Isle Pier' }, at(10, 10))] };
const near = (b, p, m) => Math.hypot((b[0] - p.lat) * 111, (b[1] - p.lng) * 83) <= (m || 0.3);
const line = (mode, kind, from, min, more) => Object.assign({ mode, kind, label: kind, operator: 'Test Lines', from, to: '', ride: min - 15, wait: 10, every: 60, access: { how: 'walk', min: 5, km: 0.3 }, egress: { how: 'walk', min: 0, km: 0 }, min, km: 20, stops: 0, src: 'test copy' }, more || {});
const byName = n => FAR.concat(NEXT).find(x => x.name === n);
function transitFor(b) {
  if (state.partialAt && near(b, state.partialAt)) return { opts: [], partial: true };
  if (near(b, PIERS.Q501[1])) return { opts: [line('ferry', 'Ferry', 'Testport Harbour', 75, { noTimetable: true, src: 'OpenStreetMap w1' })] };
  if (near(b, PIERS.Q501[0])) return { opts: [line('ferry', 'Ferry', 'Testport Harbour', 110, { noTimetable: true, src: 'OpenStreetMap w2' })] };
  if (near(b, at(-12, 20))) return { opts: [line('ferry', 'Ferry', 'Central Bus Stop', 70, { label: 'Ferry F1 + 1 change', mainFrom: 'Lagoon Quay', changes: 1 })] };   // Lagoonside: a bus, then the boat
  if (near(b, at(20, 30))) return { opts: [line('train', 'Train', 'Testport Central', 150)] };
  if (near(b, at(-38, 30))) return { opts: [line('train', 'Train', 'Testport Tram Stop', 55, { label: 'Train + 2 changes' })] };   // Hillton: a helper that does not say where the train is boarded
  if (near(b, at(12, 44))) return { opts: [line('train', 'Train', 'Testport Central', 55)] };   // Skerry Town, Hillton   // Testslow: a known line, too slow
  if (near(b, PIERS.Q531[0])) return { opts: [line('ferry', 'Ferry', 'Stream Quay', 60)] };
  if (near(b, at(6, -5))) return { opts: [line('train', 'Train', 'Testport Central', 40)] };   // Testport Riverside, a district in town
  if (near(b, byName('Testholm'))) return { opts: [line('ferry', 'Ferry', 'Stream Quay', 50)] };
  // The slow-boat test: the only way to two islands is a ferry the map shows with no timetable, its time guessed long.
  if (state.slowBoat && near(b, PIERS.Q503[0])) return { opts: [line('ferry', 'Ferry', 'East Quay', 181, { noTimetable: true, src: 'OpenStreetMap w3' })] };
  if (state.slowBoat && near(b, PIERS.Q530[0])) return { opts: [line('ferry', 'Ferry', 'East Quay', 300, { noTimetable: true, src: 'OpenStreetMap w4' })] };
  if (near(b, PIERS.Q503[0])) return { opts: [line('ferry', 'Ferry', 'East Quay', 45)] };
  if (near(b, PIERS.Q525[1]) || near(b, PIERS.Q525[0])) return { opts: [line('ferry', 'Ferry', 'Town Quay', 30)] };
  if (near(b, PIERS.Q516[0])) return { opts: [line('ferry', 'Ferry', 'East Quay', 40)] };
  if (near(b, byName('Far Testerly'))) return { opts: [line('train', 'Train', 'Testport Central', 150)] };
  for (const n of ['Testbury', 'Testim', 'Testyma', 'Testa Abbey', 'Testmoor', 'Testford', 'Testwick', 'Testby', 'Little Testing', 'Testport International Airport', 'Test Field Stadium', 'Testshire Province', 'Testport Grand Prix', 'Testport Sea Bridge', 'Testport Island Airport', 'Testport Old Quarter', 'Testland', 'Testra', 'Testa Delta'])
    if (near(b, byName(n))) return { opts: [line('train', 'Train', 'Testport Central', 40)] };
  return { opts: [] };
}
function roadFor(b) {
  if (near(b, byName('Old Testa Ruins'))) return { min: 48, km: 52, ferry: false };
  if (near(b, byName('Test Cape Village'))) return { min: 40, km: 35, ferry: true };
  if (near(b, byName('Far Testerly'))) return { min: 100, km: 95, ferry: false };
  if (near(b, at(-26, -20))) return { min: 200, km: 60, ferry: true };   // Testwater: the drive takes a car ferry
  if (near(b, at(6, -5))) return { min: 15, km: 8, ferry: false };
  if (near(b, at(20, 30))) return { min: 50, km: 45, ferry: false };
  return { none: true };
}
const state = { busy: 0, asked: [], partialAt: null, slowBoat: false };
function helper(r) {
  const u = new URL(r.request().url()), j = o => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) }), city = u.searchParams.get('city') || '';
  if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, GET, OPTIONS' } });
  state.asked.push(u.pathname);
  if (u.pathname === '/status') return j({ ok: true, on: false, left: 0, budget: 0 });
  if (u.pathname === '/sample') return r.fulfill({ status: 429, body: '{"error":"AI off"}' });
  if (u.pathname === '/sources') return /testport/i.test(city) ? j(SOURCES) : r.fulfill({ status: 404, body: '{}' });
  if (u.pathname === '/ground') { const b = JSON.parse(r.request().postData() || '{}');
    return j({ results: (b.names || []).map(n => /cruise|port of|terminal|pier/i.test(n) ? { wiki: [{ title: 'Testport Cruise Terminal', lat: C.lat - 0.004, lng: C.lng + 0.006 }], map: [], answered: true } : { wiki: [], map: [], answered: true }) }); }
  if (u.pathname === '/places') { const b = JSON.parse(r.request().postData() || '{}');
    return j({ places: (b.pts || []).slice(0, 12).flatMap((p, i) => [0, 1].map(k => ({ name: `Test Eatery ${i}-${k}`, lat: +(p.lat + 0.0012 * (k + 1)).toFixed(5), lng: +(p.lng + 0.001).toFixed(5), amenity: 'restaurant', cuisine: k ? 'local' : 'seafood', tags: 5, hours: 'Mo-Su 11:00-22:00' }))) }); }
  if (u.pathname === '/transit') { if (state.busy > 0) { state.busy--; return r.fulfill({ status: 503, body: '{"error":"Busy"}' }); } const b = JSON.parse(r.request().postData() || '{}'); return j({ results: (b.pairs || []).map(pr => transitFor(pr.b)) }); }
  if (u.pathname === '/landing') { const wd = u.searchParams.get('wd'); return j({ wd, outline: !!PIERS[wd], piers: PIERS[wd] || [] }); }
  if (u.pathname === '/roadway') { const b = (u.searchParams.get('b') || '').split(',').map(Number); return j(roadFor(b)); }
  return r.fulfill({ status: 404, body: '{}' });
}
const fails = []; let n = 0;
const ok = (what, cond, got) => { n++; if (!cond) fails.push(what + (got !== undefined ? ' (got ' + JSON.stringify(got).slice(0, 400) + ')' : '')); };
const prefs = { pace: 'moderate', walk: 'medium', interests: [], travelers: '', access: 'none', party: 2, lang: 'English' };
const day = o => Object.assign({ id: 'd' + o.date, destination: '', type: 'land', mode: 'flight', time: '09:00', pointIdx: 0, startTime: '09:00', hours: 8, alongWay: true, returnToStart: true, selected: null }, o);
async function run(file) {
  const b = await chromium.launch();
  // ---- Part 1: the finished screen of a trip made the app's own way ----
  { const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', r => { const u = r.request().url(); if (u.startsWith(MOCK)) return helper(r); return /^file:/.test(u) ? r.continue() : r.abort(); });
    await p.goto('file://' + file);
    const days = [day({ date: '2027-06-08', destination: 'At sea', type: 'sea' }), day({ date: '2027-06-09', destination: 'Testport', type: 'port', portArrive: '08:00', allAboard: '19:00' }), day({ date: '2027-06-10', destination: 'Testport' })];
    await p.evaluate(([days, prefs]) => { localStorage.setItem('kairoute.intro1', '1'); localStorage.setItem('wayside.trip2', JSON.stringify({ id: 't-daytrips', name: 'Test', style: 'mix', active: 1, lodging: {}, journal: {}, prefs, days })); }, [days, prefs]);
    await p.reload(); await p.waitForTimeout(500);
    await p.evaluate(m => window.__kairouteMockHelper(m, null, true), MOCK);
    await p.evaluate(() => window.__kairouteAt(1, 'plan')); await p.waitForTimeout(300);
    const btn = p.locator('[data-act="gen"]').first(); if (await btn.isVisible().catch(() => false)) await btn.click();
    await p.waitForFunction(() => { const s = window.__kairouteState(); return !s.busy && !!window.__kairouteCityOf(1); }, null, { timeout: 40000 }).catch(() => {});
    await p.waitForFunction(() => { const c = window.__kairouteCityOf(1); return c && (c.farther || []).length >= 6; }, null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(1500);
    ok('the made-up port city gets a guide from its sources (the test can run)', await p.evaluate(() => !!window.__kairouteCityOf(1)), await p.evaluate(() => window.__kairouteState().err));
    // Each of the three screens that shows a day: the port day's Sights list, the stay day's Sights list, the port day's plan.
    const sights = async i => { await p.evaluate(i => window.__kairouteAt(i, 'sites'), i); await p.waitForTimeout(700); return p.evaluate(() => (document.querySelector('#view') || document.body).textContent.replace(/\s+/g, ' ')); };
    for (const [i, label] of [[1, 'ship day'], [2, 'stay day']]) { const t = await sights(i), has = w => t.includes(w), T = label + ' Sights screen: ';
      ok(T + 'the island the encyclopedia points to in its middle is offered (Hvar from Split)', has('Testvar'));
      ok(T + 'an island group that is a part of the city\'s own guide is offered (the Princes\' Islands, Lantau)', has('Testa Islands'));
      ok(T + 'a town reached by boat is offered (Vaxholm from Stockholm)', has('Testholm'));
      ok(T + 'a heritage site with no line is offered by road', has('Old Testa Ruins'));
      ok(T + 'a place "Go next" names beyond its first eight links is offered', has('Testvar'));
      ok(T + 'an airport is never a day trip', !has('Testport International Airport'));
      ok(T + 'an airport is never a day trip, even on an island of its own (Hong Kong International, live check Nov 26)', !has('Testport Island Airport'));
      ok(T + 'a district of the city itself, in town, is not a day trip (Kadıköy, Bondi Beach, live check Nov 26)', !has('Testport Old Quarter'));
      ok(T + 'the country or island group the city is in is not a day trip (Japan from Kyoto, live check Nov 26)', !/Testland\b/.test(t));
      ok(T + 'a town the encyclopedia files only as a municipality is offered when the travel guide files it as a city (Sintra from Lisbon, live check Nov 26)', has('Testra'));
      ok(T + 'a page the travel guide files as a region is not a day trip unless it is an island, a heritage site or a "Go next" (Pearl River Delta, live check Nov 26)', !has('Testa Delta'));
      ok(T + 'the island group the city itself stands on is not a day trip (Cyclades from Mykonos, New Providence from Nassau, live check Nov 26)', !has('Testport Isles'));
      ok(T + 'a race or a bridge with a travel-guide page is never a day trip', !has('Testport Grand Prix') && !has('Testport Sea Bridge'));
      ok(T + 'a stadium is never a day trip', !has('Test Field Stadium'));
      ok(T + 'a province is never a day trip', !has('Testshire Province'));
      ok(T + 'a famous town the city\'s own guide never points to is not offered ahead of the classics (Salerno from Naples)', !has('Testbury'));
      ok(T + 'a place whose drive takes a car ferry is not offered "by road"', !has('Test Cape Village'));
      ok(T + 'a place more than 2 hours away by line and 90 minutes by road is not offered', !has('Far Testerly'));
      ok(T + 'a hardly known village is not offered', !has('Little Testing'));
      ok(T + 'a place nothing goes to is never offered on a guess (the eight hamlets)', !/Hamlet [A-H]\b/.test(t), (t.match(/Hamlet [A-H]/g) || []).slice(0, 3));
      ok(T + 'a name in another script is never shown (R-11)', !has('テスト'));
      ok(T + 'two places 1.5 km apart are one outing, the better known one', has('Testyma') && !has('Testim '), [has('Testyma'), has('Testim ')]);
      ok(T + 'at most 6 classic day trips', !has('Testford') && !has('Testwick'));
      ok(T + 'a boat the map shows with no timetable says its times are not confirmed', /Getting there: Ferry from Testport Harbour: the map shows the route, but its times are not confirmed\. About 75 min one way is an estimate/.test(t), (t.match(/Getting there: Ferry from Testport Harbour[^.]*\.[^.]*\./) || [''])[0]);
      ok(T + 'a boat on a timetable says so, from the quay it leaves', /Getting there: Ferry from Stream Quay, about 50 min one way by its timetable/.test(t));
      ok(T + 'a drive says it is by road and that the app knows of no line (never that there is none)', /Getting there: By road \(taxi or car\), about 60 min one way by the road route\. Kairoute doesn.t know of a train, bus or boat line for this trip\./.test(t), (t.match(/Getting there: By road[^.]*\./) || [''])[0]);
      ok(T + 'no day trip says "as the travel guide says" about a time the travel guide never gave', !/as the travel guide says/.test(t)); }
    // Nothing put on a day by the app: the plan of each day, and its ticks.
    // The app's own first picks for a day never lead with a classic day trip, however famous (the same place without
    // the mark does lead: the test can fail).
    { const lt = await p.evaluate(() => { const e = { name: 'Lead Isle', fame: 300, unesco: true, mustSee: true, dlat: 0.2 }, c = window.__kairouteCityOf(2), x = (c.farther || []).find(y => y.classic && /Testa Islands/.test(y.name));
        if (!x) return { none: true }; const was = { fame: x.fame, mustSee: x.mustSee, unesco: x.unesco }; Object.assign(x, { fame: 300, mustSee: true, unesco: true });
        try { return { plain: window.__kairouteLeadTest(2, e), classic: window.__kairouteLeadTest(2, { name: 'Small Isle', fame: 1, dlat: 0.2 }), id: x.id }; } finally { Object.assign(x, was); } });
      ok('a famous day trip of the guide\'s own leads a free day (the test can fail)', !!(lt.plain && lt.plain.lead === lt.plain.id), lt);
      ok('a classic day trip never leads a day, however famous: it is offered, never picked by the app', !!(lt.classic && !lt.classic.lead), lt); }
    for (const i of [1, 2]) { const tr = await p.evaluate(i => { const t = window.__kairouteTruth(i), c = window.__kairouteCityOf(i), d = window.__kairouteState().days[i]; return { stops: t.stopNames || [], err: t.error || '', ticked: [...document.querySelectorAll('input[data-site]:checked')].map(x => x.dataset.site), far: (c.farther || []).map(x => x.id) }; }, i);
      ok(`day ${i + 1}: the app puts no classic day trip on the day by itself (they are offered, never inserted)`, !tr.stops.some(s => /Testvar|Testa Islands|Testholm|Old Testa Ruins|Testby|Testyma/.test(s)), tr.stops);
      await p.evaluate(i => window.__kairouteAt(i, 'sites'), i); await p.waitForTimeout(500);
      const tk = await p.evaluate(() => [...document.querySelectorAll('input[data-site]:checked')].map(x => x.dataset.site));
      ok(`day ${i + 1}: no classic day trip is ticked by the app`, !tk.some(id => /^trip-/.test(id)), tk); }
    // The island is planned to its pier, the nearest to the city, never to the middle of the island.
    const isle = await p.evaluate(() => { const c = window.__kairouteCityOf(1), s = (c.farther || []).find(x => x.name === 'Testvar'); return s ? { lat: s.lat, lng: s.lng, landing: s.landing, src: s.travelSrc } : null; });
    ok('the island day trip is planned to the pier the boat lands at, the nearest to the city', !!isle && near([isle.lat, isle.lng], PIERS.Q501[1]) && isle.landing === 'Testvar Town Pier', isle);
    // The traveler picks the island on the stay day: it is planned, by boat (their own pick; R-06 and E8 keep their say).
    for (const [i, label] of [[2, 'stay day'], [1, 'ship day']]) {
      const r = await p.evaluate(([i]) => { const r = window.__kairouteDay(i, '^Testvar$', { ownList: true }); window.__kairouteAt(i, 'plan'); return { r, text: (document.querySelector('#view') || document.body).innerText.replace(/\s+/g, ' ') }; }, [i]);
      if (process.env.DEBUG) console.log('   ' + label + ': ' + JSON.stringify(r.r).slice(0, 1800));
      const items = (r.r && r.r.items) || [], onPlan = items.some(x => /Testvar/.test(x)), dropped = ((r.r && r.r.dropped) || []).some(x => /Testvar/.test(x));
      ok(`${label}: the island day trip the traveler picks is on the plan, or the plan says it was left out (never silently gone)`, onPlan || dropped || !!(r.r && r.r.error), r.r && (r.r.error || r.r.items));
      if (onPlan) { ok(`${label}: the picked island is reached by boat, never by taxi or on foot across the water (R-06)`, !items.some((x, k) => /^\s*~/.test(x) && /taxi|walk/i.test(x) && /Testvar/.test(items[k + 1] || '') && !/ferry|boat/i.test(x)), items.filter(x => /^\s*~/.test(x)));
        ok(`${label}: the plan screen says the boat's times are not confirmed`, /not confirmed|no timetable|check the (sailing )?times/i.test(r.text), r.text.slice(0, 600)); }
    }
    ok('no page error', !errs.length, [...new Set(errs)].slice(0, 3));
    await p.close(); }
  // ---- Part 2: the rule's edges, by its own function ----
  { const p = await b.newPage(); await p.route('**/*', r => { const u = r.request().url(); if (u.startsWith(MOCK)) return helper(r); return /^file:/.test(u) ? r.continue() : r.abort(); });
    await p.goto('file://' + file); await p.waitForTimeout(800); await p.evaluate(m => window.__kairouteMockHelper(m, null, true), MOCK);
    const own = Object.assign({ id: 'abbey', name: 'Abbey of Testa', wd: 'Q514', minutes: 120, far: true, category: 'Day trip', travel: 'About 45 minutes by train.', summary: 'A hilltop abbey.' }, at(-25, -30));
    const go = (farther, busy) => { state.busy = busy || 0; return p.evaluate(async a => { const c = { city: 'Testport', country: 'Testland', sites: [], farther: JSON.parse(JSON.stringify(a.farther)), starts: {}, restaurants: [] };
      window.__kairouteSourceSights(c, a.src); const cands = window.__kairouteTripCands(c, a.src); const n1 = await window.__kairouteClassicTrips(c, a.src); const after1 = c.farther.map(s => s.name), open1 = !!c.tripsOpen;
      const n2 = await window.__kairouteClassicTrips(c, a.src); return { cands: cands.map(x => x.name), n1, after1, open1, n2, after2: c.farther.map(s => s.name), open2: !!c.tripsOpen, classic: c.farther.filter(s => s.classic).map(s => s.name) }; }, { farther, src: SOURCES }); };
    const a = await go([own]);
    ok('a guide with day trips of its own still gets the classics it lacks (the old rule gave it none)', a.classic.length === 6 && a.classic.includes('Testvar'), a.classic);
    ok('a day trip the guide already has is not offered twice (same place by its id)', a.after2.filter(x => /Abbey/.test(x)).length === 1 && !a.classic.includes('Testa Abbey'), a.after2);
    ok('the day trips come in the order the city\'s own guide puts them, then fame: the island "Go next" names and the islands that are part of its guide first, never a hamlet first mentioned', a.cands.filter(x => !/^(Testport Isles|Testra)$/.test(x)).slice(0, 2).sort().join() === 'Testa Islands,Testvar' && !/Hamlet/.test(a.cands.slice(0, 6).join()), a.cands.slice(0, 8));
    ok('a second look with the same sources adds nothing more', a.n2 === 0, a.n2);
    const bz = await go([], 9);
    ok('while a service is busy nothing is offered on a guess, and the question stays open', bz.n1 === 0 && bz.open1 && bz.after1.length === 0, { n1: bz.n1, open: bz.open1, after: bz.after1 });
    state.busy = 0; await p.close();
    const p2 = await b.newPage(); await p2.route('**/*', r => { const u = r.request().url(); if (u.startsWith(MOCK)) return helper(r); return /^file:/.test(u) ? r.continue() : r.abort(); });
    await p2.goto('file://' + file); await p2.waitForTimeout(800); await p2.evaluate(m => window.__kairouteMockHelper(m, null, true), MOCK);
    state.busy = 1; const again = await p2.evaluate(async a => { const c = { city: 'Testport', country: 'Testland', sites: [], farther: [], starts: {}, restaurants: [] }; window.__kairouteSourceSights(c, a.src);
      const n1 = await window.__kairouteClassicTrips(c, a.src), open1 = !!c.tripsOpen, n2 = await window.__kairouteClassicTrips(c, a.src); return { n1, open1, n2, open2: !!c.tripsOpen, names: c.farther.map(s => s.name) }; }, { src: SOURCES });
    ok('once the service answers, the day trips it could not ask about are asked again and offered', again.open1 && again.n1 + again.n2 === 6 && !again.open2 && again.names.includes('Testholm'), again);
    state.busy = 0; await p2.close();
    // One place's line not answered yet (a partial answer): the places ranked after it wait, so lesser ones never fill the list first.
    const p3 = await b.newPage(); await p3.route('**/*', r => { const u = r.request().url(); if (u.startsWith(MOCK)) return helper(r); return /^file:/.test(u) ? r.continue() : r.abort(); });
    await p3.goto('file://' + file); await p3.waitForTimeout(800); await p3.evaluate(m => window.__kairouteMockHelper(m, null, true), MOCK);
    state.partialAt = PIERS.Q503[0];
    const w1 = await p3.evaluate(async a => { const c = window.__tc = { city: 'Testport', country: 'Testland', sites: [], farther: [], starts: {}, restaurants: [] }; window.__kairouteSourceSights(c, a.src);
      const cands = window.__kairouteTripCands(c, a.src).map(x => x.name); await window.__kairouteClassicTrips(c, a.src); return { cands, open: !!c.tripsOpen, names: c.farther.map(s => s.name) }; }, { src: SOURCES });
    const before = w1.cands.slice(0, w1.cands.indexOf('Testa Islands'));
    ok('while a better-ranked place is still being asked about, no place ranked after it is offered (Enköping before Sigtuna, live check Nov 26)', w1.open && w1.cands.includes('Testa Islands') && w1.names.every(n => before.includes(n)), w1);
    state.partialAt = null;
    const w2 = await p3.evaluate(async a => { const c = window.__tc; await window.__kairouteClassicTrips(c, a.src); return { open: !!c.tripsOpen, names: c.farther.map(s => s.name) }; }, { src: SOURCES });
    ok('once it is answered the list fills in rank order', !w2.open && w2.names.length === 6 && w2.names.includes('Testa Islands'), w2);
    // A place whose line is not answered yet: on the last try of the session it is offered by road, in words that say
    // the app knows of no line (never that there is none), and it takes the line once that is known.
    state.partialAt = byName('Old Testa Ruins');
    const w3 = await p3.evaluate(async a => { const c = window.__tc3 = { city: 'Testport', country: 'Testland', sites: [], farther: [], starts: {}, restaurants: [] }; window.__kairouteSourceSights(c, a.src);
      await window.__kairouteClassicTrips(c, a.src); const r = c.farther.find(s => /Ruins/.test(s.name)); return { open: !!c.tripsOpen, travel: r && r.travel, names: c.farther.map(s => s.name) }; }, { src: SOURCES });
    ok('on the last try a place whose line is still unanswered is offered by road, saying the app knows of no line, and the question stays open', w3.open && /By road .*Kairoute doesn.t know of a train, bus or boat line/.test(w3.travel || '') && !/no .* line was found|there is no/i.test(w3.travel || ''), w3);
    state.partialAt = null;
    const p4 = await b.newPage(); await p4.route('**/*', r => { const u = r.request().url(); if (u.startsWith(MOCK)) return helper(r); return /^file:/.test(u) ? r.continue() : r.abort(); });
    await p4.goto('file://' + file); await p4.waitForTimeout(800); await p4.evaluate(m => window.__kairouteMockHelper(m, null, true), MOCK);
    state.partialAt = byName('Old Testa Ruins');
    const w4 = await p4.evaluate(async a => { const c = { city: 'Testport', country: 'Testland', sites: [], farther: [], starts: {}, restaurants: [] }; window.__kairouteSourceSights(c, a.src);
      await window.__kairouteClassicTrips(c, a.src); return { open: !!c.tripsOpen, names: c.farther.map(s => s.name) }; }, { src: SOURCES });
    ok('before the last try a place whose line is not answered yet is not offered by road: the line is asked about again first', w4.open && !w4.names.includes('Old Testa Ruins'), w4);
    state.partialAt = null; await p4.close();
    // A boat the map shows with no timetable, its time guessed at over two hours: to a pier near by the place is still
    // offered, with no guessed time on the card (the Princes' Islands from Istanbul, guessed at 3 hours; live check, Nov 26);
    // to a pier far out it is not.
    const p5 = await b.newPage(); await p5.route('**/*', r => { const u = r.request().url(); if (u.startsWith(MOCK)) return helper(r); return /^file:/.test(u) ? r.continue() : r.abort(); });
    await p5.goto('file://' + file); await p5.waitForTimeout(800); await p5.evaluate(m => window.__kairouteMockHelper(m, null, true), MOCK);
    state.slowBoat = true;
    const SRC5 = Object.assign({}, SOURCES, { far: FAR.concat([far('Testora', 'Q530', ['feature', 'island', 'natural'], 70, 50, -30, { said: 6 })]) });
    const w5 = await p5.evaluate(async a => { const c = { city: 'Testport', country: 'Testland', sites: [], farther: [], starts: {}, restaurants: [] }; window.__kairouteSourceSights(c, a.src);
      const cands = window.__kairouteTripCands(c, a.src).map(x => x.name); await window.__kairouteClassicTrips(c, a.src); const r = c.farther.find(s => /Testa Islands/.test(s.name)); return { cands, travel: r && r.travel, src: r && r.travelSrc, names: c.farther.map(s => s.name) }; }, { src: SRC5 });
    ok('an island near by whose only boat has no timetable is offered, saying a boat goes and that the app does not know its times', /Ferry from .*map shows the route.*Kairoute doesn.t know its times or how long/.test(w5.travel || '') && w5.src === 'map', w5);
    ok('its card shows no guessed minutes', !!w5.travel && !/\d+\s*min|\d+\s*h\b/.test(w5.travel), w5.travel);
    ok('an island far out (pier over 40 km) whose only boat has no timetable and a guessed time over two hours is not offered', w5.cands.includes('Testora') && !w5.names.includes('Testora'), w5);
    state.slowBoat = false; await p5.close();
    // The encyclopedia's facts not answered (live helper, Nov 26: no place a day out had its facts): a place across the
    // water is still found at its pier, because the road map says the drive takes a ferry; a district in town is still
    // not a day out.
    const p6 = await b.newPage(); await p6.route('**/*', r => { const u = r.request().url(); if (u.startsWith(MOCK)) return helper(r); return /^file:/.test(u) ? r.continue() : r.abort(); });
    await p6.goto('file://' + file); await p6.waitForTimeout(800); await p6.evaluate(m => window.__kairouteMockHelper(m, null, true), MOCK);
    const SRC6 = Object.assign({}, SOURCES, { far: FAR.concat([far('Testwater', 'Q531', undefined, 80, -26, -20, { said: 5, vt: 'city' }), far('Testport Riverside', 'Q532', undefined, 60, 6, -5, { voy: 'Testport/Riverside', part: true, said: 6, vt: 'district' })]) });
    const w6 = await p6.evaluate(async a => { const c = { city: 'Testport', country: 'Testland', sites: [], farther: [], starts: {}, restaurants: [] }; window.__kairouteSourceSights(c, a.src);
      const cands = window.__kairouteTripCands(c, a.src).map(x => x.name); await window.__kairouteClassicTrips(c, a.src); const r = c.farther.find(s => s.name === 'Testwater'); return { cands, travel: r && r.travel, landing: r && r.landing, names: c.farther.map(s => s.name) }; }, { src: SRC6 });
    ok('with no facts answered, a place the road reaches only by ferry is asked about at its pier and offered by its boat', /^Ferry from Stream Quay, about 60 min/.test(w6.travel || '') && w6.landing === 'Water Quay', w6);
    ok('with no facts answered, a district of the city in town is still not a day trip', !w6.cands.includes('Testport Riverside') && !w6.names.includes('Testport Riverside'), w6);
    // What the card says of the way (live check, Nov 27): a ride with changes, a line known but too slow, a guide part's name.
    // A region the guide sends readers to is visited at a place its own page names (live check, Nov 27: Vaxholm for
    // the Stockholm archipelago): an island group with no pier on the map, and a range of hills.
    const REG = [Object.assign(nx('Testa Skerries', 'Q540', 30, 60, '', 70), { voy: 'Testa Skerries', vt: 'region', kinds: ['feature', 'island', 'region'] }), Object.assign(nx('Testa Hills', 'Q542', -45, 35, '', 70), { voy: 'Testa Hills', vt: 'region', kinds: ['feature', 'natural', 'region'] })];
    const IN = [far('Skerry Town', 'Q541', ['settlement'], 30, 12, 44, { vt: 'city', inVoy: 'Testa Skerries' }), far('Hillton', 'Q543', ['settlement'], 50, -38, 30, { vt: 'city', inVoy: 'Testa Hills' }), far('Hillby', 'Q544', ['settlement'], 20, -36, 28, { vt: 'city', inVoy: 'Testa Hills' })];
    const SRC7 = Object.assign({}, SOURCES, { far: FAR.concat([far('Testslow', 'Q534', ['settlement'], 80, 20, 30, { said: 5, vt: 'city' })]).concat(IN), next: [nx('Testport/Lagoonside', 'Q533', -12, 20, 'A fishing village on the lagoon.', 90)].concat(REG).concat(NEXT) });
    const w7 = await p6.evaluate(async a => { const c = { city: 'Testport', country: 'Testland', sites: [], farther: [], starts: {}, restaurants: [] }; window.__kairouteSourceSights(c, a.src);
      await window.__kairouteClassicTrips(c, a.src); const f = n => (c.farther.find(s => s.name === n) || {}).travel; return { lagoon: f('Lagoonside'), slow: f('Testslow'), hill: f('Hillton'), names: c.farther.map(s => s.name), skerry: (c.farther.find(s => s.name === 'Skerry Town') || {}).summary }; }, { src: SRC7 });
    ok('an island group the guide sends readers to, with no pier of its own on the map, is offered at the place its own page names (Vaxholm for the Stockholm archipelago)', w7.names.includes('Skerry Town') && !w7.names.includes('Testa Skerries'), w7.names);
    ok('its card says which region it stands for', /^A town in Testa Skerries, which the travel guide to Testport sends its readers to\.$/.test(w7.skerry || ''), w7.skerry);
    ok('a region the guide sends readers to is offered at its best-known place, once (never the region\'s middle, never two of its towns)', w7.names.includes('Hillton') && !w7.names.includes('Hillby') && !w7.names.includes('Testa Hills'), w7.names);
    ok('a ride with changes says so and where it starts, never "Ferry from" a stop no ferry leaves (Manly from Sydney)', /^Ferry from Lagoon Quay, with 1 change on the way \(the ride starts at Central Bus Stop\), about 70 min one way by its timetable/.test(w7.lagoon || ''), w7);
    ok('when the helper does not say where the named part is boarded, the card says the ride has changes and where it starts', /^Train with 2 changes, starting from Testport Tram Stop, about 55 min one way by its timetable/.test(w7.hill || ''), w7.hill);
    ok('a part of the city\'s guide is shown by its own name, never "City/Part" (Venice/Burano)', w7.names.includes('Lagoonside') && !w7.names.some(x => /\//.test(x)), w7.names);
    ok('a drive offered while a line is known but too slow says the lines take longer, never that no line is known (Wollongong from Sydney)', /^By road \(taxi or car\), about 60 min one way by the road route\. The train, bus or boat lines Kairoute knows of take more than 2 hours\.$/.test(w7.slow || ''), w7);
    await p6.close();
    await p3.close(); }
  await b.close();
}
// Planted bugs: each puts back, in a copy of the build, one way day trips have really gone wrong.
const PLANT = [
  { id: 'first-stop-as-the-quay', from: 'const main = o.mainFrom && !nonLatin(o.mainFrom) ? o.mainFrom : "";', to: 'const main = "";',
    was: 'the card names the first stop of the ride, not the quay the ferry leaves, though the helper says which' },
  { id: 'island-group-at-its-middle', from: 'if (!ps.length && y.stand) {', to: 'if (false) {',
    was: 'Vaxholm missing from Stockholm: the archipelago was asked about at a point in the sea' },
  { id: 'region-at-its-middle', from: 'if (tripIsle(R)) R.stand = stand; else pool[i] = stand; }', to: 'if (tripIsle(R)) R.stand = stand; }',
    was: 'a region offered at its middle point, where no line goes' },
  { id: 'changes-hidden', from: 'const ch = +(/', to: 'const ch = 0 * +(/',
    was: '"Ferry from Sydenham Station": a ride with changes named by its longest part from the first stop of another' },
  { id: 'slow-line-said-unknown', from: 'slow: slowLine }', to: 'slow: false }',
    was: '"Kairoute doesn\'t know of a line" on a drive while a train of over two hours was known' },
  { id: 'guide-part-name-as-filed', from: 'if (m && names.includes(keyOf(m[1]))) y =', to: 'if (false) y =',
    was: '"Venice/Burano" shown as the name of a day trip' },
  { id: 'slow-boat-guess-rules-out', from: 'if (!best && boat) best = boat;', to: '',
    was: 'the Princes\' Islands found with their piers and ferry, then dropped because the ferry\'s guessed time was 3 hours (live check, Nov 26)' },
  { id: 'slow-boat-guess-shown', from: 'if (way.noTime) return `', to: 'if (false) return `',
    was: 'a guessed boat time of three hours printed on the card as "about 180 min"' },
  { id: 'slow-boat-any-distance', from: 'hav(centre, x.t) <= TRIP_BOAT_KM && !boat', to: '!boat',
    was: 'an island 70 km out offered as a day trip on a boat with no known times' },
  { id: 'water-not-asked-of-road', from: 'else if (j.ferry || j.none) y.water = true;', to: '',
    was: 'with the encyclopedia\'s facts not answered, Hvar was looked for at its middle and never offered from Split; Lamma the same from Hong Kong (live helper, Nov 26)' },
  { id: 'town-district-when-facts-missing', from: 'if (y.part && !y.next && !srcHas2(y, /^island$/)', to: 'if (srcKnown(y) && y.part && !y.next && !srcHas2(y, /^island$/)',
    was: 'Kadıköy, 7.5 km from the middle of Istanbul, offered as a day trip by road when the facts had not come (live helper, Nov 26)' },
  { id: 'trips-go-next-only', from: 'for (const y of src.far || []) if (y && y.voy && (y.said > 0 || y.part || y.unesco)) put(y, {});', to: '',
    was: 'day trips read only from the "Go next" list: the Princes\' Islands, Lantau, Manly and Vaxholm in no guide (ferry test trips, Nov 25)' },
  { id: 'island-at-its-middle', from: 'if (!tripWater(y) || !y.wd) return [{ lat: y.lat, lng: y.lng }];', to: 'if (true) return [{ lat: y.lat, lng: y.lng }];',
    was: 'the boat to an island looked for at the middle of the island: Hvar never offered from Split (Nov 25)' },
  { id: 'own-trips-block-classics', from: 'const cands = room > 0 || (city.farther || []).some(x => x.lineOpen) ? tripCands(city, src) : [];', to: 'const cands = room > 0 && !(city.farther || []).some(x => !x.noAI) ? tripCands(city, src) : [];',
    was: 'a guide with one day trip of its own never got another (the old rule)' },
  { id: 'fame-alone-ranks', from: 'if (y && y.voy && (y.said > 0 || y.part || y.unesco)) put(y, {});', to: 'if (y && y.voy) put(y, {});',
    was: 'fame alone: Salerno and Benevento ahead of Capri and Sorrento for Naples (probe, Nov 25)' },
  { id: 'thing-as-day-trip', from: 'if (!guidePlace && srcHas2(y, TRIP_NOT) && !srcHas2(y, TRIP_PLACE)) return false;', to: '',
    was: 'a race, a bridge or a road with a travel-guide page offered as a day out: only places are day trips' },
  { id: 'island-airport-as-day-trip', from: 'if (srcHas2(y, TRIP_NEVER) && !srcHas2(y, /^settlement$/)) return false;', to: '',
    was: 'Hong Kong International Airport, on its own island, ranked as a day trip (live check, Nov 26)' },
  { id: 'town-district-as-day-trip', from: 'if (y.part && !y.next && !srcHas2(y, /^island$/) && y.km != null && y.km < TRIP_PART_KM) return false;', to: '',
    was: 'districts of the city itself offered as days out: Kadıköy, Bondi Beach, the business district (live check, Nov 26)' },
  { id: 'country-as-day-trip', from: 'if (/^(country|airport|itinerary|topic)$/.test(y.vt || "")) return false;', to: '',
    was: '"Japan" ranked first as a day trip from Kyoto, "Cyclades" from Mykonos (live check, Nov 26)' },
  { id: 'lesser-place-jumps-queue', from: 'else if (unknown) { open = true; if (!last) break; } }', to: 'else if (unknown) { open = true; } }',
    was: 'Enköping offered from Stockholm while Sigtuna and Uppsala were still unanswered (live check, Nov 26)' },
  { id: 'province-as-day-trip', from: 'if (!y.vt && srcHas2(y, /^(admin-area|region)$/) && !srcHas2(y, TRIP_PLACE) && !y.unesco) return false;', to: '',
    was: 'provinces and counties have travel-guide pages too (Split-Dalmatia County, Nov 25 probe)' },
  { id: 'drive-with-a-ferry', from: '&& !j.ferry && !j.none) best', to: '&& !j.none) best',
    was: 'a drive that takes a car ferry offered as "by road" (rule R-06: across water means a boat)' },
  { id: 'estimate-as-timetable', from: 'if (o.noTimetable) return `', to: 'if (false) return `',
    was: 'a map line\'s estimated time shown as a timetable\'s (no untrue statements, Nov 22)' },
  { id: 'trip-guessed-when-busy', from: 'else if (unknown) { open = true; if (!last) break; } }', to: 'else if (unknown) { if (!last) break; } }',
    was: 'a busy service read as "no way there": the day trips never came back' },
  { id: 'app-leads-with-day-trip', from: 'const far = (city.farther || []).filter(x => !x.classic && !taken[x.id]', to: 'const far = (city.farther || []).filter(x => !taken[x.id]',
    was: 'the app put an optional day trip on a day by itself (Richard, Nov 18: never)' },
  { id: 'planner-adds-day-trip', from: '&& !s.offerOnly), s => tr.min(home, s), AREA_KM);', to: '), s => tr.min(home, s), AREA_KM);',
    was: 'the planner put a classic day trip on a stay day by itself (found by this check, Nov 25)' },
  { id: 'road-when-line-unknown', from: 'if (!best && (!unknown || last) && !tripWater(y)', to: 'if (!best && !tripWater(y)',
    was: 'a place offered by road at once while its line was still being asked about (found by this check, Nov 25)' },
  { id: 'no-line-said-as-fact', from: "Kairoute doesn't know of a train, bus or boat line for this trip.", to: 'No train, bus or boat line was found.',
    was: '"No train, bus or boat line was found" for Pompeii from Naples, which has a train: the lookup had only come back empty (live check, Nov 26)' },
  { id: 'guide-city-kept-out', from: 'if (!y.vt && srcHas2(y, /^(admin-area|region)$/)', to: 'if (srcHas2(y, /^(admin-area|region)$/)',
    was: 'Sintra in no list for Lisbon: the encyclopedia files the town only as a municipality (live check, Nov 26)' },
  { id: 'region-page-as-day-trip', from: 'if (y.vt === "region" && !srcHas2(y, /^island$/) && !y.unesco && !y.next) return false;', to: '',
    was: '"Pearl River Delta" ranked as a day trip from Hong Kong (live check, Nov 26)' },
  { id: 'home-island-as-day-trip', from: 'if (ps.length && hav(centre, ps[0]) <= TRIP_KM_MIN) return [{ home: true }];', to: '',
    was: '"Cyclades" ranked as a day trip from Mykonos, "New Providence" from Nassau: the islands the city stands on (live check, Nov 26)' },
  { id: 'trips-uncapped', from: 'if (added >= room) continue;', to: '',
    was: 'every place with a line offered: quantity, not the classics' },
  { id: 'travel-guide-words-for-our-time', from: 's.classic && s.travelSrc ? `<p class="travelnote tripway"', to: 'false ? `<p class="travelnote tripway"',
    was: '"as the travel guide says" printed before a time the travel guide never gave' },
];
(async () => {
  if (process.env.DAYTRIP_PLANTED) { await run(FILE); process.exit(fails.length ? 1 : 0); }
  await run(FILE);
  for (const f of fails) console.log('- ' + f);
  let bad = fails.length, planted = 0;
  if (!fails.length && PLANTS) {
    const html = fs.readFileSync(FILE, 'utf8'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'day-trips-'));
    // Four planted copies at a time, each in its own process: one after another they outran the gate's 15 minutes.
    const todo = PLANT.filter(m => !process.env.ONLY || process.env.ONLY.split(',').includes(m.id));
    await Promise.all([0, 1, 2, 3].map(async () => { while (todo.length) { const m = todo.shift();
      if (html.split(m.from).length !== 2) { bad++; console.log(`NOT TESTED ${m.id}: its text is not in the build once (the code moved on: update the planted bug)`); continue; }
      const f = path.join(tmp, m.id + '.html'); fs.writeFileSync(f, html.replace(m.from, m.to));
      const code = await new Promise(done => { const c = spawn('node', [__filename, f, '--no-plants'], { stdio: 'ignore', env: Object.assign({}, process.env, { DAYTRIP_PLANTED: '1' }) }); c.on('exit', done); c.on('error', () => done(0)); }), caught = code !== 0 && code !== null;
      if (!caught) bad++; else planted++;
      console.log(`${caught ? 'caught' : 'MISSED'} ${m.id}: ${m.was}`);
    } }));
  }
  console.log(`day-trips-check: ${n} checks, ${fails.length} failed${PLANTS && !fails.length ? `; ${planted} of ${PLANT.length} planted bugs caught` : ''}`);
  process.exit(bad ? 1 : 0);
})();
