// Trip step by step, with the AI writer switched off (Richard, Nov 17: no AI, no paid service).
// 1. The day rules: stop lists of every shape (city stays, a cruise between stays, flying in and boarding the same day,
//    off the ship and flying home the same day, a one-night stop, sea days) make exactly the expected days.
// 2. The real screens, phone and tablet: New trip -> step by step (no AI shortcut offered while it's off) -> a city
//    with no built-in guide (Paris), a built-in one (Athens) and a cruise with two ports -> Build my trip. The trip has
//    the right days and times; the Paris guide is built from its sources alone (snapshot in tools/fixtures) with no AI
//    asked; its sightseeing days get real stops; the hotel typed is found on the map; nothing calls the AI.
// Usage: node tools/steps-e2e.cjs [path/to/index.html]   (exit 1 on any FAIL)
// LIVE: URL=https://gilsonr0566-sys.github.io/Kairoute/ node tools/steps-e2e.cjs  (the real helper and sources, AI as it is set)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const FIX = n => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8'));
const PARIS = FIX('src-paris.json');
const LIVE = process.env.URL || '';
const HOTEL = LIVE ? 'Hotel Lutetia' : 'Grand Test Hotel';
let fails = 0; const bad = m => { fails++; console.log('FAIL ' + m); }, ok = m => console.log('ok   ' + m);
const RULES = [
  { name: 'Greece-shaped trip: 4 nights, cruise, 4 nights, train, 3 nights', legs: [
      { k: 'stay', place: 'Athens', date: '2027-06-30', nights: 4, inBy: 'flight', inAt: '10:30' },
      { k: 'cruise', board: 'Athens', date: '2027-07-04', aboard: '18:30', ship: 'Sun Princess', ports: [
        { date: '2027-07-05', place: 'Heraklion', arrive: '07:00', aboard: '16:30' }, { date: '2027-07-07', place: 'Santorini', arrive: '07:00', aboard: '20:30', tender: true }],
        end: 'Barcelona', endDate: '2027-07-09', off: '07:00' },
      { k: 'stay', place: 'Barcelona', date: '2027-07-09', nights: 4 },
      { k: 'stay', place: 'Madrid', date: '2027-07-13', nights: 3, inBy: 'train', leaveAt: '09:00', inAt: '11:45', homeBy: 'flight', homeAt: '16:00' }],
    want: ['2027-06-30|arrival|Athens|flight|10:30||', '2027-07-01|land|Athens|flight|||', '2027-07-02|land|Athens|flight|||', '2027-07-03|land|Athens|flight|||',
      '2027-07-04|embark|Athens|flight||18:30|', '2027-07-05|port|Heraklion|flight||07:00-16:30|', '2027-07-06|sea|At sea|flight|||', '2027-07-07|port|Santorini|flight||07:00-20:30|',
      '2027-07-08|sea|At sea|flight|||', '2027-07-09|arrival|Barcelona|ship|07:00||', '2027-07-10|land|Barcelona|flight|||', '2027-07-11|land|Barcelona|flight|||', '2027-07-12|land|Barcelona|flight|||',
      '2027-07-13|departure|Barcelona|train|09:00||', '2027-07-13|arrival|Madrid|train|11:45||', '2027-07-14|land|Madrid|flight|||', '2027-07-15|land|Madrid|flight|||', '2027-07-16|departure|Madrid|flight|16:00||'] },
  // Round 1 part 2: a stay and the cruise from the same city's port, typed as the form suggests ("Piraeus (Athens)") or
  // with the country after the stay: straight from the hotel to the ship, never a flight out and back in with times made up.
  { name: 'a stay, then the cruise from its port typed "Port (City)" or with the country: no flight out and in', legs: [
      { k: 'stay', place: 'Athens, Greece', date: '2027-06-30', nights: 2, inBy: 'flight', inAt: '10:30' },
      { k: 'cruise', board: 'Piraeus (Athens)', date: '2027-07-02', aboard: '18:30', ports: [], end: 'Piraeus (Athens)', endDate: '2027-07-04', off: '07:00', homeBy: 'flight', homeAt: '15:00' }],
    want: ['2027-06-30|arrival|Athens, Greece|flight|10:30||', '2027-07-01|land|Athens, Greece|flight|||', '2027-07-02|embark|Piraeus (Athens)|flight||18:30|', '2027-07-03|sea|At sea|flight|||',
      '2027-07-04|arrival|Piraeus (Athens)|ship|07:00||', '2027-07-04|departure|Piraeus (Athens)|flight|15:00||'] },
  { name: 'fly in and board the same day, off the ship and fly home the same day', legs: [
      { k: 'cruise', board: 'Miami', date: '2027-01-11', aboard: '16:00', inBy: 'flight', inAt: '09:15', ports: [{ date: '2027-01-12', place: 'Nassau', arrive: '08:00', aboard: '17:00' }], end: 'Miami', endDate: '2027-01-14', off: '07:30', homeBy: 'flight', homeAt: '14:00' }],
    want: ['2027-01-11|arrival|Miami|flight|09:15||', '2027-01-11|embark|Miami|flight||16:00|', '2027-01-12|port|Nassau|flight||08:00-17:00|', '2027-01-13|sea|At sea|flight|||',
      '2027-01-14|arrival|Miami|ship|07:30||', '2027-01-14|departure|Miami|flight|14:00||'] },
  { name: 'empty times are typical times marked estimated; one-night stop', legs: [
      { k: 'stay', place: 'Lisbon', date: '2027-03-01', nights: 1, inBy: 'flight' }, { k: 'stay', place: 'Porto', date: '2027-03-02', nights: 2, inBy: 'train' }],
    want: ['2027-03-01|arrival|Lisbon|flight|10:30||est', '2027-03-02|departure|Lisbon|train|12:00||est', '2027-03-02|arrival|Porto|train|11:00||est', '2027-03-03|land|Porto|flight|||', '2027-03-04|departure|Porto|flight|15:00||est'] },
  { name: 'a port outside the cruise dates is caught', legs: [
      { k: 'cruise', board: 'Rome', date: '2027-05-01', ports: [{ date: '2027-05-09', place: 'Naples' }], end: 'Rome', endDate: '2027-05-04' }], err: /outside the cruise/ },
  { name: 'a stop that starts before the last one ends is caught', legs: [
      { k: 'stay', place: 'Rome', date: '2027-05-01', nights: 3 }, { k: 'stay', place: 'Florence', date: '2027-05-02', nights: 2 }], err: /before the stop before it ends/ }
];
const MOCK = 'https://mock.test';
const PARIS_NEXT = [
  { name: 'Versailles', wd: 'Q621', lat: 48.8049, lng: 2.1204, km: 17.1, rank: 0, sl: 140, note: "Versailles — the Sun King's palace and gardens, an easy RER ride away." },
  { name: 'Barbizon', wd: 'Q213585', lat: 48.4447, lng: 2.6036, km: 49, rank: 1, sl: 40, note: 'Barbizon: the painters\' village on the edge of the forest of Fontainebleau.' },
  { name: 'Mont-Saint-Michel', wd: 'Q180374', lat: 48.636, lng: -1.5115, km: 290, rank: 2, sl: 120, note: 'Mont-Saint-Michel: the abbey on a tidal island.' }];
function helper(r, calls) {
  const u = new URL(r.request().url()), j = o => r.fulfill({ contentType: 'application/json', body: JSON.stringify(o) });
  calls.push(u.pathname);
  if (u.pathname === '/status') return j({ ok: true, on: false, left: 0, budget: 0 });
  if (u.pathname === '/sample') return r.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'The AI guide writer is switched off for now.' }) });
  if (u.pathname === '/sources') return /paris/i.test(u.searchParams.get('city')) ? j(Object.assign({}, PARIS.sources, { next: PARIS_NEXT })) : r.fulfill({ status: 404, body: '{}' });
  // Day trips: a train to Versailles; nothing public to Barbizon (so it is never offered); Mont-Saint-Michel is too far.
  if (u.pathname === '/transit') { const b = JSON.parse(r.request().postData() || '{}');
    return j({ results: (b.pairs || []).map(q => Math.abs(q.b[0] - 48.8049) < 0.01 && Math.abs(q.b[1] - 2.1204) < 0.01
      ? { opts: [{ mode: 'train', kind: 'Train', label: 'RER C', operator: 'SNCF', from: 'Saint-Michel Notre-Dame', to: 'Versailles Château Rive Gauche', ride: 38, wait: 8, every: 15, everySrc: 'timetable', access: { how: 'walk', min: 6, km: 0.4 }, egress: { how: 'walk', min: 10, km: 0.8 }, min: 62, km: 20, stops: 9, src: 'test copy' }] }
      : { opts: [] }) }); }
  if (u.pathname === '/famous') return /paris/i.test(u.searchParams.get('city')) ? j(PARIS.famous) : r.fulfill({ status: 404, body: '{}' });
  if (u.pathname === '/ground') { const b = JSON.parse(r.request().postData() || '{}'), names = b.names || [];
    if (/example harbour town/i.test(b.city || '')) return j({ center: null, results: names.map(n => /^Port of/.test(n) ? { wiki: [], answered: true, map: [{ name: "Example Harbour Town's Port Shop", kind: 'yes', lat: 25.0783, lng: -77.3430 }] }
      : /cruise terminal/.test(n) ? { wiki: [], answered: true, map: [{ name: 'Example Wharf Cruise Ship Terminal', kind: 'dock', lat: 25.0812, lng: -77.3375 }] } : { wiki: [], map: [], answered: true }) });
    // A port named apart from its city: the city's own harbour sits by the centre, the port's pier (mapped only as
    // "Cruise Terminal") 70 km out; "inland town" has only the city's harbour.
    if (/example old harbour/i.test(b.city || '')) return j({ center: null, results: names.map(n => /^Port of/.test(n) ? { wiki: [], answered: true, map: [{ name: 'Port of Example Cove', kind: 'harbour', lat: 42.6256, lng: 18.1229 }] }
      : /cruise terminal/.test(n) ? { wiki: [], answered: true, map: [{ name: 'Example Old Harbour Cruise Port', kind: 'harbour', lat: 42.6590, lng: 18.0850 }] } : { wiki: [], map: [], answered: true }) });
    // Round 2 re-check, from the real answers: a pier named as another port's; a port 180 km out; a passenger terminal
    // the map files as a public building.
    if (/example other cove/i.test(b.city || '')) return j({ center: null, results: names.map(n => /^Port of/.test(n) ? { wiki: [], answered: true, map: [{ name: 'Port of Somewhere Else', kind: 'pier', lat: 42.6256, lng: 18.1229 }] } : { wiki: [], map: [], answered: true }) });
    if (/example far capital/i.test(b.city || '')) return j({ center: null, results: names.map(n => /cruise terminal/.test(n) ? { wiki: [], answered: true, map: [{ name: 'Cruise Terminal', kind: 'ferry_terminal', lat: 49.4809, lng: 0.1077 }] } : { wiki: [], map: [], answered: true }) });
    if (/example passenger port/i.test(b.city || '')) return j({ center: null, results: names.map(n => /cruise terminal/.test(n) ? { wiki: [], answered: true, map: [{ name: 'Example Passenger Port Industrial Port', kind: 'industrial', lat: 32.8193, lng: 35.0361 }, { name: 'Passengers Terminal', kind: 'public', lat: 32.8223, lng: 34.9997 }] } : { wiki: [], map: [], answered: true }) });
    if (/example inland (city|town)/i.test(b.city || '')) { const out = /city/i.test(b.city);
      return j({ center: null, results: names.map(n => /^Port of/.test(n) ? { wiki: [], answered: true, map: [{ name: 'Example Inland Port', kind: 'harbour', lat: 13.70, lng: 100.56 }] }
        : /cruise terminal/.test(n) && out ? { wiki: [], answered: true, map: [{ name: 'Cruise Terminal', kind: 'terminal', lat: 13.08, lng: 100.88 }] } : { wiki: [], map: [], answered: true }) }); }
    if (/example cay/i.test(b.city || '')) { const near = !/far/i.test(b.city);
      return j({ center: null, results: names.map(n => n === 'Cruise pier' && b.center ? { wiki: [], answered: true, map: [
        { name: 'Fishing Pier', kind: 'pier', lat: 25.8180, lng: -77.9340 },
        ...(near ? [{ name: 'Neighbour Island Cruise Pier', kind: 'pier', lat: 25.8300, lng: -77.9000 }, { name: 'Example Cay Cruise Pier', kind: 'pier', lat: 25.8232, lng: -77.9365 }] : [])] }
        : { wiki: [], map: [], answered: true }) }); }
    return j({ results: names.map(n => /paris airport|paris international airport/i.test(n) ? { wiki: [{ title: 'Charles de Gaulle Airport', lat: 49.0097, lng: 2.5479 }], map: [], answered: true }
      : /paris (railway|central) station/i.test(n) ? { wiki: [{ title: 'Gare du Nord', lat: 48.8809, lng: 2.3553 }], map: [], answered: true } : { wiki: [], map: [], answered: true }), center: { lat: 48.856, lng: 2.351 } }); }
  if (u.pathname === '/places') { const b = JSON.parse(r.request().postData() || '{}');
    return j({ places: (b.pts || []).slice(0, 10).flatMap((p, i) => [0, 1].map(k => ({ name: `Test Bistro ${i}-${k}`, lat: p.lat + 0.0012 * (k + 1), lng: p.lng + 0.001, amenity: 'restaurant', cuisine: 'french', tags: 5, hours: 'Mo-Su 12:00-22:00' }))) }); }
  if (u.pathname === '/findplace') return j({ places: /grand test/i.test(u.searchParams.get('q')) ? [{ name: 'Grand Test Hotel', names: ['Grand Test Hotel'], lat: 48.8662, lng: 2.3236, kind: 'hotel', cat: 'tourism', addr: 'Rue de Test 1' }] : [] });
  if (u.pathname === '/guide') return r.fulfill({ status: 404, body: '{}' });
  return r.fulfill({ status: 404, body: '{}' });
}
(async () => {
  const b = await chromium.launch();
  // 1. The rules.
  { const p = await b.newPage(); if (!LIVE) await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    if (LIVE) { for (let k = 0; k < 110; k++) { await p.goto(LIVE + '?t=' + Date.now()); await p.waitForTimeout(3000); if (await p.evaluate(() => !!window.__kairouteTripSteps)) break; console.log('waiting for the new version to publish…'); await p.waitForTimeout(27000); } }
    else { await p.goto('file://' + FILE); await p.waitForTimeout(300); }
    for (const t of RULES) {
      const got = await p.evaluate(l => window.__kairouteTripSteps(l), t.legs);
      if (t.err) { if (got.err && t.err.test(got.err)) ok(t.name + ': ' + got.err); else bad(`${t.name}: expected an error, got ${JSON.stringify(got)}`); continue; }
      if (got.err) { bad(`${t.name}: ${got.err}`); continue; }
      const diff = t.want.map((w, i) => w === got.days[i] ? null : `#${i + 1} want ${w} got ${got.days[i]}`).filter(Boolean);
      if (got.days.length !== t.want.length) diff.push(`${got.days.length} days, want ${t.want.length}`);
      if (diff.length) bad(`${t.name}:\n   ${diff.join('\n   ')}`); else ok(t.name);
    }
    // Round 2, S1-6: an arrival or ship time the traveler never gave is never shown as theirs on the day's cover.
    { const l = await p.evaluate(() => [window.__kairouteThroughLede({ mode: 'flight', time: '10:30', estimated: true }, { type: 'embark', allAboard: '17:00', estimated: true }),
        window.__kairouteThroughLede({ mode: 'flight', time: '09:15' }, { type: 'embark', allAboard: '16:30' })]);
      if (/10:30|17:00/.test(l[0]) || !/09:15/.test(l[1]) || !/16:30/.test(l[1])) bad(`cover: a time the traveler never gave is shown: ${l.join(' | ')}`); else ok('cover: only the times the traveler gave are shown'); }
    await p.close(); }
  // 1b. A boarding time typed and then redrawn over (an answer from the internet arriving before Save) is still saved
  // (Nov 17: the demo gate's typed 12:30 was lost to a redraw, and the day planned to all-aboard instead).
  if (!LIVE) { const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + FILE); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(600);
    const s = p.locator('[data-act="loadsample"]').first(); if (await s.isVisible().catch(() => false)) await s.click(); await p.waitForTimeout(1200);
    const d = (await p.evaluate(() => window.__kairouteDays())).find(x => x.type === 'embark');
    if (!d) bad('boarding: the sample trip has no boarding day');
    else { await p.evaluate(i => window.__kairouteGo('plan', i), d.i); await p.waitForTimeout(1200);
      await p.locator('#bc-time').fill('12:30');
      await p.evaluate(i => { window.__kairouteGo('trip', i); window.__kairouteGo('plan', i); }, d.i); await p.waitForTimeout(300);
      await p.locator('[data-act="boardsave"]').first().click(); await p.waitForTimeout(1000);
      const saved = await p.evaluate(i => JSON.parse(localStorage.getItem('wayside.trip2')).days[i].boardTime, d.i);
      if (saved !== '12:30') bad(`boarding: a typed time redrawn over before Save was lost (saved ${saved})`); else ok('boarding: a typed time survives a redraw before Save (12:30 saved)'); }
    await p.close(); }
  // 1b2. A boarding morning too short for any sight (boarding 10:00) still has a Guide and a tour that walk through the
  // day: hotel, bags, the ride, what to expect at the terminal (Nov 18: "Embarkation day still has a blank screen";
  // the Guide said only "No stops planned for today" and the tour jumped to "You saw 0 stops").
  if (!LIVE) { const p = await b.newPage({ viewport: { width: 800, height: 1280 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + FILE); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(600);
    const s = p.locator('[data-act="loadsample"]').first(); if (await s.isVisible().catch(() => false)) await s.click(); await p.waitForTimeout(1200);
    const d = (await p.evaluate(() => window.__kairouteDays())).find(x => x.type === 'embark');
    if (d) { await p.evaluate(i => window.__kairouteGo('plan', i), d.i); await p.waitForTimeout(1000);
      if (!(await p.locator('#bc-time').isVisible().catch(() => false))) { await p.locator('[data-act="boardchange"]').first().click(); await p.waitForTimeout(500); }
      await p.locator('#bc-time').fill('10:00'); await p.locator('[data-act="boardsave"]').first().click(); await p.waitForTimeout(1000);
      await p.evaluate(i => window.__kairouteGo('guide', i), d.i); await p.waitForTimeout(800);
      const g = await p.evaluate(() => document.getElementById('view').innerText);
      if (/No stops planned/.test(g) || !/terminal/i.test(g) || !/bags/i.test(g)) bad(`boarding 10:00: the Guide doesn't walk through the day: ${JSON.stringify(g.replace(/\s+/g, ' ').slice(0, 200))}`);
      else ok('boarding 10:00: the Guide walks through the hotel, bags and terminal');
      await p.locator('[data-act="tourstart"]').first().click(); await p.waitForTimeout(600);
      for (let k = 0; k < 8 && await p.locator('[data-act="tournext"],[data-act="tourhere"]').count(); k++) { await p.locator('[data-act="tournext"],[data-act="tourhere"]').first().click(); await p.waitForTimeout(300); }
      const e = await p.evaluate(() => document.getElementById('view').innerText);
      if (/saw 0 stops/i.test(e) || !/terminal/i.test(e)) bad(`boarding 10:00: the tour ends without the terminal notes: ${JSON.stringify(e.replace(/\s+/g, ' ').slice(0, 200))}`);
      else ok('boarding 10:00: the tour ends with what to expect at the terminal');
      if (errs.length) bad('boarding 10:00: page errors ' + errs.slice(0, 3).join(' / ')); }
    await p.close(); }
  // 1c. A trip that starts with a cruise (Bahamas test trip, Nov 17): "+ Add a cruise" on the new form replaces the empty
  // city stay it opens with, so the traveler isn't stopped by "Stop 1: type the city"; one typed into is kept.
  if (!LIVE) { const p = await b.newPage({ viewport: { width: 412, height: 860 } });
    await p.route('**/*', r => { const u = r.request().url(); if (u.startsWith(MOCK)) return helper(r, []); return /^file:/.test(u) ? r.continue() : r.abort(); });
    await p.goto('file://' + FILE); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(500);
    await p.evaluate(m => window.__kairouteMockHelper(m, null, true), MOCK);
    await p.evaluate(() => document.querySelector('[data-act="newtrip"]').click()); await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('[data-ts="addcruise"]').click()); await p.waitForTimeout(300);
    const legs = await p.evaluate(() => [...document.querySelectorAll('[data-leg]')].map(x => x.querySelector('.eyebrow').innerText));
    if (legs.length !== 1 || !/cruise/i.test(legs[0])) bad(`cruise first: the form shows ${JSON.stringify(legs)}, not one cruise`); else ok('cruise first: + Add a cruise replaces the empty city stay');
    await p.evaluate(() => document.querySelector('[data-ts="addstay"]').click()); await p.waitForTimeout(200);
    await p.fill('#ts-1-place', 'Miami'); await p.dispatchEvent('#ts-1-place', 'change');
    await p.evaluate(() => document.querySelector('[data-ts="addcruise"]').click()); await p.waitForTimeout(300);
    const n = await p.evaluate(() => document.querySelectorAll('[data-leg]').length);
    if (n !== 3) bad(`cruise first: a typed stop was dropped (${n} stops)`); else ok('cruise first: stops already typed are kept');
    // A private island or small port whose pier has no "Port of ..." name: the closest place that calls itself a cruise
    // pier is the ship's spot (never a fishing pier, never a neighbour island's); with none, the port stays unknown
    // and the day isn't planned on a guess (Nov 18, CocoCay).
    const pier = await p.evaluate(() => window.__kairouteSrcStarts('Example Cay', { lat: 25.8167, lng: -77.9333 }).then(s => s.cruise[0]));
    if (!pier || pier.name !== 'Example Cay Cruise Pier' || pier.unknown) bad(`small port: the cruise pier wasn't found: ${JSON.stringify(pier)}`); else ok('small port: the ship docks at the closest cruise pier on the map');
    const wharf = await p.evaluate(() => window.__kairouteSrcStarts('Example Harbour Town', { lat: 25.0782, lng: -77.3438 }).then(s => s.cruise[0]));
    if (!wharf || wharf.name !== 'Example Wharf Cruise Ship Terminal') bad(`port: a shop with "port" in its name was taken for the cruise terminal: ${JSON.stringify(wharf)}`); else ok('port: the real cruise terminal wins over a shop named "Port Shop"');
    const none = await p.evaluate(() => window.__kairouteSrcStarts('Example Cay far', { lat: 25.8167, lng: -77.9333 }).then(s => s.cruise[0]));
    if (!none || !none.unknown) bad(`small port: a fishing pier was taken for the cruise pier: ${JSON.stringify(none)}`); else ok('small port: a pier not named for cruises is never the ship\'s spot');
    const oh = await p.evaluate(() => window.__kairouteSrcStarts('Example Old Harbour', { lat: 42.6407, lng: 18.1077 }).then(s => s.cruise[0]));
    if (!oh || oh.name !== 'Example Old Harbour Cruise Port') bad(`port: a harbour found first was taken over the cruise port: ${JSON.stringify(oh)}`); else ok('port: the cruise port wins over an old harbour found first');
    const oc = await p.evaluate(() => window.__kairouteSrcStarts('Example Other Cove', { lat: 42.6407, lng: 18.1077 }).then(s => s.cruise[0]));
    if (!oc || !oc.unknown) bad(`port: a pier named as another port's was taken: ${JSON.stringify(oc)}`); else ok('port: a pier named as another port\'s is never this port\'s; asked instead');
    const fc = await p.evaluate(() => window.__kairouteSrcStarts('Example Far Capital', { lat: 48.8566, lng: 2.3522 }, 'Example Coast Port').then(s => s.cruise));
    if (!fc || !fc[0] || fc[0].name !== 'Cruise Terminal, Example Coast Port') bad(`port apart from the city: a pier 180 km out was not found: ${JSON.stringify(fc)}`); else ok('port apart from the city: a pier 180 km out is found and named with its port');
    const pt = await p.evaluate(() => window.__kairouteSrcStarts('Example Passenger Port', { lat: 32.794, lng: 34.9896 }).then(s => s.cruise[0]));
    if (!pt || pt.name !== 'Passengers Terminal') bad(`port: the passenger terminal was dropped for how the map files it: ${JSON.stringify(pt)}`); else ok('port: a passenger terminal counts however the map files it');
    // Round 2, N1: "Port (City)" docks at the port's own pier, never the city's harbour by the centre; with none named
    // for the port and none out of the city, the pier is asked, never guessed.
    const gp = await p.evaluate(() => window.__kairouteSrcStarts('Example Inland City', { lat: 13.75, lng: 100.50 }, 'Example Seaport').then(s => s.cruise));
    const g0 = gp && gp[0]; if (!g0 || g0.name !== 'Cruise Terminal, Example Seaport') bad(`port apart from the city: the city's harbour was taken for the port's pier: ${JSON.stringify(gp)}`); else ok('port apart from the city: the pier out of the city is the ship\'s spot, never the city\'s harbour');
    const gn = await p.evaluate(() => window.__kairouteSrcStarts('Example Inland Town', { lat: 13.75, lng: 100.50 }, 'Example Seaport').then(s => s.cruise[0]));
    if (!gn || !gn.unknown) bad(`port apart from the city: the city's harbour was guessed for the port: ${JSON.stringify(gn)}`); else ok('port apart from the city: no pier for the port, so it is asked');
    await p.close(); }
  // 2. The screens.
  for (const [W, H, tag] of [[412, 915, 'phone'], [1280, 800, 'tablet']]) {
    const p = await b.newPage({ viewport: { width: W, height: H } }); const errs = [], calls = []; p.on('pageerror', e => errs.push(e.message)); if (process.env.DEBUG) p.on('console', m => { if (/Kairoute|transit|far/i.test(m.text())) console.log('CON', m.text().slice(0, 200)); });
    if (LIVE) {
      p.on('request', q => { try { const u = new URL(q.url()); if (/workers\.dev$/.test(u.hostname)) calls.push(u.pathname); } catch (e) {} });
      await p.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
      for (let k = 0; k < 110; k++) { await p.goto(LIVE + '?t=' + Date.now()); await p.waitForTimeout(3000); if (await p.evaluate(() => !!window.__kairouteTripSteps)) break; console.log('waiting for the new version to publish…'); await p.waitForTimeout(27000); }
      if (!(await p.evaluate(() => !!window.__kairouteTripSteps))) { bad(`${tag}: the live site never got the step-by-step version`); await p.close(); continue; }
      await p.waitForFunction(() => window.__kairouteState && document.querySelector('[data-act="newtrip"]'), null, { timeout: 60000 });
      await p.waitForTimeout(4000); // the helper's status (AI on or off) arrives
    } else {
      await p.route('**/*', r => { const u = r.request().url(); if (u.startsWith(MOCK)) return helper(r, calls); return /^file:/.test(u) ? r.continue() : r.abort(); });
      await p.goto('file://' + FILE); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(500);
      await p.evaluate(m => window.__kairouteMockHelper(m, null, true), MOCK);
    }
    if (!LIVE && await p.evaluate(() => window.__kairouteAiReady())) bad(`${tag}: the app thinks the AI is on while the helper says it is off`);
    await p.evaluate(() => document.querySelector('[data-act="newtrip"]').click()); await p.waitForTimeout(300);
    const shortcut = await p.evaluate(() => !!document.querySelector('[data-ts="mode"][data-v="words"]') || !!document.getElementById('w-text'));
    if (shortcut && LIVE && await p.evaluate(() => window.__kairouteAiReady())) await p.evaluate(() => document.querySelector('[data-ts="mode"][data-v="steps"]').click());
    else if (shortcut) bad(`${tag}: the AI shortcut (describe / photo) is offered while the AI is off`);
    const disabled = await p.evaluate(() => [...document.querySelectorAll('#wizForm button[type=submit]')].filter(x => /Build my trip/.test(x.innerText)).every(x => x.disabled));
    if (disabled) bad(`${tag}: Build my trip is disabled with the AI off`);
    const fill = async (sel, v) => { await p.fill(sel, v); await p.dispatchEvent(sel, 'change'); };
    const tap = async (sel) => { await p.evaluate(s => { const el = document.querySelector(s); if (!el) throw new Error('no ' + s); el.click(); }, sel); await p.waitForTimeout(150); };
    // Stop 1: Paris, 3 nights, flight in at 10:30, a hotel by name.
    await fill('#ts-0-place', 'Paris'); await fill('#ts-0-date', '2027-05-03'); await fill('#ts-0-nights', '3'); await fill('#ts-0-inAt', '10:30'); await fill('#ts-0-hotel', HOTEL);
    // Stop 2: Athens by flight, offered the day Paris ends.
    await tap('[data-ts="addstay"]');
    const d2 = await p.inputValue('#ts-1-date'); if (d2 !== '2027-05-06') bad(`${tag}: stop 2 offered ${d2}, not the day Paris ends (2027-05-06)`);
    await fill('#ts-1-place', 'Athens'); await fill('#ts-1-nights', '2'); await tap('[data-ts="set"][data-i="1"][data-key="inBy"][data-v="flight"]'); await fill('#ts-1-leaveAt', '09:00'); await fill('#ts-1-inAt', '13:30');
    // Stop 3: the cruise boards in Athens the day the stay ends; two ports, the second offered the next day.
    await tap('[data-ts="addcruise"]');
    const cb = await p.inputValue('#ts-2-board'), cd = await p.inputValue('#ts-2-date'), p0 = await p.inputValue('#ts-2-p0-date');
    if (!/athens/i.test(cb) || cd !== '2027-05-08' || p0 !== '2027-05-09') bad(`${tag}: cruise offered ${cb} ${cd}, first port ${p0}`);
    const joined = await p.evaluate(() => !document.getElementById('ts-2-inAt')); if (!joined) bad(`${tag}: boarding where the stay ends still asks how you get to the ship`);
    await fill('#ts-2-aboard', '17:00'); await fill('#ts-2-p0-place', 'Santorini'); await fill('#ts-2-p0-arrive', '07:00'); await fill('#ts-2-p0-aboard', '20:30');
    await p.check('[data-tsf="ts-2-p0-tender"]');
    await tap('[data-ts="addport"][data-i="2"]');
    const p1 = await p.inputValue('#ts-2-p1-date'); if (p1 !== '2027-05-10') bad(`${tag}: second port offered ${p1}`);
    await fill('#ts-2-p1-place', 'Mykonos'); await fill('#ts-2-end', 'Athens'); await fill('#ts-2-endDate', '2027-05-12'); await fill('#ts-2-off', '07:30');
    await tap('[data-ts="set"][data-i="2"][data-key="homeBy"][data-v="flight"]'); await fill('#ts-2-homeAt', '14:00');
    const prev = await p.evaluate(() => (document.querySelector('#tsPrev summary') || {}).innerText || '');
    if (!/10 days · 2 ports/.test(prev)) bad(`${tag}: the day list says "${prev}"`); else ok(`${tag}: day list "${prev}"`);
    if (tag === 'phone' || process.env.SHOTS) await p.screenshot({ path: path.join(process.env.SHOTS || '/tmp', 'steps-form-' + tag + '.png'), fullPage: true });
    await p.evaluate(() => [...document.querySelectorAll('#wizForm button[type=submit]')].find(x => /Build my trip/.test(x.innerText)).click());
    await p.waitForTimeout(500);
    const st0 = await p.evaluate(() => window.__kairouteState());
    if (st0.view !== 'trip') bad(`${tag}: after Build my trip the view is ${st0.view} (${st0.err})`);
    const want = ['2027-05-03 arrival Paris', '2027-05-04 land Paris', '2027-05-05 land Paris', '2027-05-06 departure Paris', '2027-05-06 arrival Athens', '2027-05-07 land Athens',
      '2027-05-08 embark Athens', '2027-05-09 port Santorini', '2027-05-10 port Mykonos', '2027-05-11 sea At sea', '2027-05-12 arrival Athens', '2027-05-12 departure Athens'];
    const got = st0.days.map(d => `${d.date} ${d.type} ${d.dest}`);
    if (got.join('|') !== want.join('|')) bad(`${tag}: days\n   got  ${got.join(' | ')}\n   want ${want.join(' | ')}`); else ok(`${tag}: ${got.length} days in order`);
    const san = st0.days.find(d => d.dest === 'Santorini'); if (!san || san.arrive !== '07:00' || san.aboard !== '20:30' || san.estimated) bad(`${tag}: Santorini times ${JSON.stringify(san)}`);
    const myk = st0.days.find(d => d.dest === 'Mykonos'); if (!myk || !myk.estimated) bad(`${tag}: Mykonos had no times typed but is not marked estimated`);
    // The guides: Paris from its sources (no AI), Athens built in.
    await p.waitForFunction(() => { const s = window.__kairouteState(); return !s.busy && s.days.filter(d => /Paris/.test(d.dest)).every(d => d.guide); }, null, { timeout: LIVE ? 240000 : 30000 }).catch(() => {});
    await p.waitForTimeout(LIVE ? 15000 : 1500);
    const st = await p.evaluate(() => window.__kairouteState());
    const noGuide = [...new Set(st.days.filter(d => d.type !== 'sea' && !d.guide).map(d => d.dest))];
    // Santorini, Mykonos and Athens are built in; Paris comes from its sources. Nothing else may be missing.
    if (noGuide.length) bad(`${tag}: no guide for ${noGuide.join(', ')} (${st.err})`); else ok(`${tag}: every place has a guide`);
    for (const i of [1, 2]) {
      const t = await p.evaluate(i => window.__kairouteTruth(i), i);
      if (t.error || !(t.stopNames || []).length) bad(`${tag}: Paris day ${i + 1} plan: ${t.error || 'no stops'}`); else ok(`${tag}: Paris day ${i + 1}: ${t.stopNames.length} stops (${t.stopNames.slice(0, 4).join(', ')}…)`);
      if (process.env.DEBUG) console.log('     ', JSON.stringify({ stops: t.stopNames, times: t.times, end: t.end, endBy: t.endBy, fill: t.fill, dropped: t.dropped, hours: t.hours }));
    }
    // Rules for any city with no AI: a full day is filled (no afternoon left empty), a place visitors can't go into
    // is never a sight, and a day trip is offered only where a real line gets there (with its ride named).
    if (!LIVE) for (const i of [1, 2]) { const t = await p.evaluate(i => window.__kairouteTruth(i), i);
      if (t.fill && t.fill.spare > 120) bad(`${tag}: Paris day ${i + 1} ends with ${t.fill.spare} min free (at ${Math.floor(t.end / 60)}:${String(t.end % 60).padStart(2, '0')})`); else ok(`${tag}: Paris day ${i + 1} is full (${t.stopNames.length} stops, ${t.fill ? t.fill.spare : 0} min spare)`); }
    const g = await p.evaluate(() => { const c = window.__kairouteCityOf(1); return c ? { sites: (c.sites || []).map(x => x.name), far: (c.farther || []).map(x => ({ n: x.name, t: x.travel })) } : null; });
    if (process.env.DEBUG) console.log('DBG', JSON.stringify(await p.evaluate(() => { const c = window.__kairouteCityOf(1); return { v: c.farNoAIV, ffv: c.farFillV, city: c.city, srcG: c.srcGuide }; })));
    if (!g) bad(`${tag}: no Paris guide to check`);
    else {
      if (g.sites.some(n => /lys[ée]e Palace|Meudon Observatory/i.test(n))) bad(`${tag}: a place closed to visitors is a sight: ${g.sites.filter(n => /lys[ée]e|Meudon/.test(n)).join(', ')}`); else ok(`${tag}: places closed to visitors are left out`);
      if (!LIVE) { const v = g.far.find(x => /Versailles/.test(x.n));
        if (!v || !/Train from Saint-Michel Notre-Dame, about \d+ min one way/.test(v.t)) bad(`${tag}: Versailles day trip missing or untimed: ${JSON.stringify(g.far)}`); else ok(`${tag}: day trip with no AI: ${v.n} (${v.t})`);
        if (g.far.some(x => /Barbizon|Mont-Saint-Michel/.test(x.n))) bad(`${tag}: a day trip with no line or too far was offered: ${JSON.stringify(g.far)}`); else ok(`${tag}: no day trip offered without a real line, or too far`); }
      else console.log(`note ${tag}: day trips ${JSON.stringify(g.far)}`);
    }
    const t0 = await p.evaluate(() => window.__kairouteTruth(0)); if (t0.error || !(t0.stopNames || []).length) bad(`${tag}: Paris arrival day: ${t0.error || 'no stops'}`);
    const hotel = await p.evaluate(() => { const k = Object.keys(JSON.parse(localStorage.getItem('wayside.trip2')).lodging || {}); return JSON.parse(localStorage.getItem('wayside.trip2')).lodging[k.find(x => /paris/.test(x))] || null; });
    if (!hotel || !hotel.ll || !new RegExp(HOTEL.split(' ').pop().normalize('NFD').replace(/[\u0300-\u036f]/g, ''), 'i').test(String(hotel.name).normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) bad(`${tag}: the hotel typed wasn't found on the map: ${JSON.stringify(hotel)}`); else ok(`${tag}: hotel found on the map`);
    await p.evaluate(() => window.__kairouteAt(1, 'plan')); await p.waitForTimeout(800);
    const shown = await p.evaluate(() => [...document.querySelectorAll('.tl .nm')].length);
    if (!shown) bad(`${tag}: the Paris day plan screen shows no stops`);
    if (process.env.SHOTS) await p.screenshot({ path: path.join(process.env.SHOTS, 'steps-paris-plan-' + tag + '.png') });
    const aiOn = await p.evaluate(() => window.__kairouteAiReady()); if (LIVE) console.log(`note ${tag}: AI guide is ${aiOn ? 'ON' : 'off'} on the live site`);
    const aiCalls = aiOn ? [] : calls.filter(c => c === '/sample' || c === '/script' || c === '/speak');
    if (aiCalls.length) bad(`${tag}: the AI was asked ${aiCalls.length} times while off (${[...new Set(aiCalls)].join(', ')})`); else ok(`${tag}: no AI asked (${calls.length} free lookups)`);
    if (errs.length) bad(`${tag}: page errors: ${errs.slice(0, 3).join(' | ')}`);
    await p.close();
  }
  await b.close();
  console.log(fails ? `${fails} FAIL` : 'All step-by-step checks passed');
  process.exit(fails ? 1 : 0);
})();
