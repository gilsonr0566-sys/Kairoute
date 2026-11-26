// Classic day trips check (rule R-36, Nov 25): every city's guide offers its well-known day trips, the ones reached by
// boat included, from free sources alone. A made-up port city ("Testport") whose sources hold every kind of place that
// once went wrong on a real one: an island the encyclopedia points to in its middle (Hvar), an island group that is a
// part of the city's own travel guide (the Princes' Islands, Lantau), a town by boat (Vaxholm), a famous town the
// city's guide never points to (Salerno from Naples), an airport, a stadium, a province, a drive that takes a ferry.
// Part 1 reads the finished Sights screen of a trip made the app's own way (AI off, the helper mocked): what is offered,
// what "Getting there" says, and that nothing was put on the day by the app. Part 2 checks the rule's edges by its own
// function. Part 3 plants each known way this has gone wrong in a copy of the build and must fail on every one.
// Usage: node tools/beta2/day-trips-check.cjs [beta2-site/index.html] [--no-plants]
'use strict';
const { chromium } = require('playwright'), path = require('path'), fs = require('fs'), os = require('os'), { spawnSync } = require('child_process');
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
  far('Testland', 'Q524', ['island', 'region'], 260, 16, -14, { said: 5 }),                                // the country the city is in (Japan from Kyoto)
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
const PIERS = { Q501: [Object.assign({ name: 'Old Grad Pier' }, at(34, -15)), Object.assign({ name: 'Testvar Town Pier' }, at(19, -22))], Q503: [Object.assign({ name: 'Big Isle Pier' }, at(-11, -14))], Q516: [Object.assign({ name: 'テスト' }, at(-19, 24))] };
const near = (b, p, m) => Math.hypot((b[0] - p.lat) * 111, (b[1] - p.lng) * 83) <= (m || 0.3);
const line = (mode, kind, from, min, more) => Object.assign({ mode, kind, label: kind, operator: 'Test Lines', from, to: '', ride: min - 15, wait: 10, every: 60, access: { how: 'walk', min: 5, km: 0.3 }, egress: { how: 'walk', min: 0, km: 0 }, min, km: 20, stops: 0, src: 'test copy' }, more || {});
const byName = n => FAR.concat(NEXT).find(x => x.name === n);
function transitFor(b) {
  if (state.partialAt && near(b, state.partialAt)) return { opts: [], partial: true };
  if (near(b, PIERS.Q501[1])) return { opts: [line('ferry', 'Ferry', 'Testport Harbour', 75, { noTimetable: true, src: 'OpenStreetMap w1' })] };
  if (near(b, PIERS.Q501[0])) return { opts: [line('ferry', 'Ferry', 'Testport Harbour', 110, { noTimetable: true, src: 'OpenStreetMap w2' })] };
  if (near(b, byName('Testholm'))) return { opts: [line('ferry', 'Ferry', 'Stream Quay', 50)] };
  if (near(b, PIERS.Q503[0])) return { opts: [line('ferry', 'Ferry', 'East Quay', 45)] };
  if (near(b, PIERS.Q516[0])) return { opts: [line('ferry', 'Ferry', 'East Quay', 40)] };
  if (near(b, byName('Far Testerly'))) return { opts: [line('train', 'Train', 'Testport Central', 150)] };
  for (const n of ['Testbury', 'Testim', 'Testyma', 'Testa Abbey', 'Testmoor', 'Testford', 'Testwick', 'Testby', 'Little Testing', 'Testport International Airport', 'Test Field Stadium', 'Testshire Province', 'Testport Grand Prix', 'Testport Sea Bridge', 'Testport Island Airport', 'Testport Old Quarter', 'Testland'])
    if (near(b, byName(n))) return { opts: [line('train', 'Train', 'Testport Central', 40)] };
  return { opts: [] };
}
function roadFor(b) {
  if (near(b, byName('Old Testa Ruins'))) return { min: 48, km: 52, ferry: false };
  if (near(b, byName('Test Cape Village'))) return { min: 40, km: 35, ferry: true };
  if (near(b, byName('Far Testerly'))) return { min: 100, km: 95, ferry: false };
  return { none: true };
}
const state = { busy: 0, asked: [], partialAt: null };
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
      ok(T + 'a place "Go next" names beyond its first eight links is offered', has('Testby'));
      ok(T + 'an airport is never a day trip', !has('Testport International Airport'));
      ok(T + 'an airport is never a day trip, even on an island of its own (Hong Kong International, live check Nov 26)', !has('Testport Island Airport'));
      ok(T + 'a district of the city itself, in town, is not a day trip (Kadıköy, Bondi Beach, live check Nov 26)', !has('Testport Old Quarter'));
      ok(T + 'the country or island group the city is in is not a day trip (Japan from Kyoto, live check Nov 26)', !/Testland\b/.test(t));
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
      ok(T + 'a drive says it is by road and that no line was found', /Getting there: By road \(taxi or car\), about 60 min one way by the road route\. No train, bus or boat line was found\./.test(t), (t.match(/Getting there: By road[^.]*\./) || [''])[0]);
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
    ok('the day trips come in the order the city\'s own guide puts them, then fame: the island "Go next" names and the islands that are part of its guide first, never a hamlet first mentioned', a.cands.slice(0, 2).sort().join() === 'Testa Islands,Testvar' && !/Hamlet/.test(a.cands.slice(0, 6).join()), a.cands.slice(0, 8));
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
    await p3.close(); }
  await b.close();
}
// Planted bugs: each puts back, in a copy of the build, one way day trips have really gone wrong.
const PLANT = [
  { id: 'trips-go-next-only', from: 'for (const y of src.far || []) if (y && y.voy && (y.said > 0 || y.part || y.unesco)) put(y, {});', to: '',
    was: 'day trips read only from the "Go next" list: the Princes\' Islands, Lantau, Manly and Vaxholm in no guide (ferry test trips, Nov 25)' },
  { id: 'island-at-its-middle', from: 'if (!tripIsle(y) || !y.wd) return [{ lat: y.lat, lng: y.lng }];', to: 'if (true) return [{ lat: y.lat, lng: y.lng }];',
    was: 'the boat to an island looked for at the middle of the island: Hvar never offered from Split (Nov 25)' },
  { id: 'own-trips-block-classics', from: 'const cands = room > 0 ? tripCands(city, src) : [];', to: 'const cands = room > 0 && !(city.farther || []).some(x => !x.noAI) ? tripCands(city, src) : [];',
    was: 'a guide with one day trip of its own never got another (the old rule)' },
  { id: 'fame-alone-ranks', from: 'if (y && y.voy && (y.said > 0 || y.part || y.unesco)) put(y, {});', to: 'if (y && y.voy) put(y, {});',
    was: 'fame alone: Salerno and Benevento ahead of Capri and Sorrento for Naples (probe, Nov 25)' },
  { id: 'thing-as-day-trip', from: 'if (srcHas2(y, TRIP_NOT) && !srcHas2(y, TRIP_PLACE)) return false;', to: '',
    was: 'a race, a bridge or a road with a travel-guide page offered as a day out: only places are day trips' },
  { id: 'island-airport-as-day-trip', from: 'if (srcHas2(y, TRIP_NEVER) && !srcHas2(y, /^settlement$/)) return false;', to: '',
    was: 'Hong Kong International Airport, on its own island, ranked as a day trip (live check, Nov 26)' },
  { id: 'town-district-as-day-trip', from: 'if (y.part && !y.next && !srcHas2(y, /^island$/) && y.km != null && y.km < TRIP_PART_KM) return false;', to: '',
    was: 'districts of the city itself offered as days out: Kadıköy, Bondi Beach, the business district (live check, Nov 26)' },
  { id: 'country-as-day-trip', from: 'if (srcHas2(y, /^region$/) && !y.unesco && !y.next) return false;', to: '',
    was: '"Japan" ranked first as a day trip from Kyoto, "Cyclades" from Mykonos (live check, Nov 26)' },
  { id: 'lesser-place-jumps-queue', from: 'else if (unknown) { open = true; if (!last) break; } }', to: 'else if (unknown) { open = true; } }',
    was: 'Enköping offered from Stockholm while Sigtuna and Uppsala were still unanswered (live check, Nov 26)' },
  { id: 'province-as-day-trip', from: 'if (srcHas2(y, /^(admin-area|region)$/) && !srcHas2(y, TRIP_PLACE) && !y.unesco) return false;', to: '',
    was: 'provinces and counties have travel-guide pages too (Split-Dalmatia County, Nov 25 probe)' },
  { id: 'drive-with-a-ferry', from: '&& !j.ferry && !j.none) best', to: '&& !j.none) best',
    was: 'a drive that takes a car ferry offered as "by road" (rule R-06: across water means a boat)' },
  { id: 'estimate-as-timetable', from: 'if (o.noTimetable) return `', to: 'if (false) return `',
    was: 'a map line\'s estimated time shown as a timetable\'s (no untrue statements, Nov 22)' },
  { id: 'trip-guessed-when-busy', from: 'if (best) ways.push({ y, way: best }); else if (unknown) open = true; }', to: 'if (best) ways.push({ y, way: best }); }',
    was: 'a busy service read as "no way there": the day trips never came back' },
  { id: 'app-leads-with-day-trip', from: 'const far = (city.farther || []).filter(x => !x.classic && !taken[x.id]', to: 'const far = (city.farther || []).filter(x => !taken[x.id]',
    was: 'the app put an optional day trip on a day by itself (Richard, Nov 18: never)' },
  { id: 'planner-adds-day-trip', from: '&& !s.offerOnly), s => tr.min(home, s), AREA_KM);', to: '), s => tr.min(home, s), AREA_KM);',
    was: 'the planner put a classic day trip on a stay day by itself (found by this check, Nov 25)' },
  { id: 'road-when-line-unknown', from: 'if (!best && !unknown && !tripIsle(y)', to: 'if (!best && !tripIsle(y)',
    was: '"No train, bus or boat line was found" said while the line question was still unanswered (found by this check, Nov 25)' },
  { id: 'trips-uncapped', from: 'if (added >= room) break;', to: '',
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
    for (const m of PLANT.filter(m => !process.env.ONLY || process.env.ONLY.split(',').includes(m.id))) {
      if (html.split(m.from).length !== 2) { bad++; console.log(`NOT TESTED ${m.id}: its text is not in the build once (the code moved on: update the planted bug)`); continue; }
      const f = path.join(tmp, m.id + '.html'); fs.writeFileSync(f, html.replace(m.from, m.to));
      const r = spawnSync('node', [__filename, f, '--no-plants'], { encoding: 'utf8', env: Object.assign({}, process.env, { DAYTRIP_PLANTED: '1' }) }), caught = r.status !== 0;
      if (!caught) bad++; else planted++;
      console.log(`${caught ? 'caught' : 'MISSED'} ${m.id}: ${m.was}`);
    }
  }
  console.log(`day-trips-check: ${n} checks, ${fails.length} failed${PLANTS && !fails.length ? `; ${planted} of ${PLANT.length} planted bugs caught` : ''}`);
  process.exit(bad ? 1 : 0);
})();
