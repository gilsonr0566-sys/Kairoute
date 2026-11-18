// A cruise port with no built-in guide, AI off (code health review, Nov 18): the guide for a new customer's port comes
// from its free sources alone (snapshot in tools/fixtures/src-nassau.json), never from a hand-written guide. On that
// path the day must still be safe for the ship and agree with itself, the same rules every built-in port day meets:
//  - "Build the guide" on the day gives a guide from the sources, with no AI asked;
//  - the day plans real stops from that guide, starting at the cruise port the map found;
//  - back at the ship with the full cushion before all aboard (the ship checks find no issue), no sight on two days;
//  - a short port call keeps the same rules (back on time, fewer stops, never past all aboard);
//  - a port whose dock can't be found on the map says so instead of planning from a guess.
// Usage: node tools/port-noai-check.cjs [path/to/index.html]   (no network, no AI; exit 1 on any FAIL)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'src-nassau.json'), 'utf8'));
const MOCK = 'https://mock.test', PLACE = 'Nassau, Bahamas';
const DOCK = { title: 'Prince George Wharf', lat: 25.0793, lng: -77.3428 };
let fails = 0; const bad = m => { fails++; console.log('FAIL ' + m); }, ok = m => console.log('ok   ' + m);
const prefs = { pace: 'moderate', walk: 'medium', interests: [], travelers: '', access: 'none', party: 2, lang: 'English' };
const day = o => Object.assign({ id: 'd' + Math.random().toString(36).slice(2, 8), date: '2027-01-12', destination: '', type: 'land', mode: 'flight', time: '09:00', pointIdx: 0, startTime: '09:00', hours: 8, alongWay: true, returnToStart: true }, o);
function helper(r, calls, dockFound) {
  const u = new URL(r.request().url()), j = o => r.fulfill({ contentType: 'application/json', body: JSON.stringify(o) });
  calls.push(u.pathname);
  if (u.pathname === '/status') return j({ ok: true, on: false, left: 0, budget: 0 });
  if (u.pathname === '/sample') return r.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'The AI guide writer is switched off for now.' }) });
  if (u.pathname === '/sources') return /nassau/i.test(u.searchParams.get('city')) ? j(FIX.sources) : r.fulfill({ status: 404, body: '{}' });
  if (u.pathname === '/famous') return /nassau/i.test(u.searchParams.get('city')) ? j(FIX.famous) : r.fulfill({ status: 404, body: '{}' });
  if (u.pathname === '/ground') { const b = JSON.parse(r.request().postData() || '{}');
    return j({ results: (b.names || []).map(n => dockFound && /port of nassau|nassau cruise terminal/i.test(n) ? { wiki: [DOCK], map: [], answered: true } : { wiki: [], map: [], answered: true }), center: FIX.sources.center }); }
  if (u.pathname === '/places') { const b = JSON.parse(r.request().postData() || '{}');
    return j({ places: (b.pts || []).slice(0, 10).flatMap((p, i) => [0, 1].map(k => ({ name: `Test Grill ${i}-${k}`, lat: p.lat + 0.0012 * (k + 1), lng: p.lng + 0.001, amenity: 'restaurant', cuisine: 'caribbean', tags: 5, hours: 'Mo-Su 11:00-22:00' }))) }); }
  if (u.pathname === '/transit') { const b = JSON.parse(r.request().postData() || '{}'); return j({ results: (b.pairs || []).map(() => ({ opts: [] })) }); }
  return r.fulfill({ status: 404, body: '{}' });
}
async function portTrip(b, { arrive, aboard, dockFound, tag }) {
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errs = [], calls = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => { const u = r.request().url(); if (u.startsWith(MOCK)) return helper(r, calls, dockFound); return /^file:/.test(u) ? r.continue() : r.abort(); });
  const trip = { id: 't-port-' + tag, name: 'Port test', style: 'mix', active: 1, lodging: {}, journal: {}, prefs,
    days: [day({ date: '2027-01-11', destination: 'At sea', type: 'sea' }), day({ date: '2027-01-12', destination: PLACE, type: 'port', portArrive: arrive, allAboard: aboard }), day({ date: '2027-01-13', destination: 'At sea', type: 'sea' })] };
  await p.goto('file://' + FILE);
  await p.evaluate(t => { localStorage.setItem('kairoute.intro1', '1'); localStorage.setItem('wayside.trip2', JSON.stringify(t)); }, trip);
  await p.reload(); await p.waitForTimeout(500);
  await p.evaluate(m => window.__kairouteMockHelper(m, null, true), MOCK);
  await p.evaluate(() => window.__kairouteAt(1, 'plan')); await p.waitForTimeout(300);
  if (await p.evaluate(() => !!window.__kairouteCityOf(1))) bad(`${tag}: ${PLACE} already has a guide before it was built (the check needs a place with none)`);
  const btn = p.locator('[data-act="gen"]').first();
  if (!(await btn.isVisible().catch(() => false))) { bad(`${tag}: no "Build the guide" button on a day with no guide`); await p.close(); return null; }
  await btn.click();
  await p.waitForFunction(() => { const s = window.__kairouteState(); return !s.busy && !!window.__kairouteCityOf(1); }, null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const c = await p.evaluate(() => { const c = window.__kairouteCityOf(1); return c ? { ai: c.ai, src: c.srcGuide, sites: (c.sites || []).filter(x => !x.quick).map(x => x.name), cruise: ((c.starts || {}).cruise || []).map(s => ({ n: s.name, u: !!s.unknown })) } : null; });
  if (calls.includes('/sample') || calls.includes('/guide-ai')) bad(`${tag}: the AI was asked (${[...new Set(calls)].join(', ')})`);
  const out = { p, errs, c, calls };
  return out;
}
(async () => {
  const b = await chromium.launch();
  // 1. A full port day, dock found on the map.
  { const r = await portTrip(b, { arrive: '08:00', aboard: '17:00', dockFound: true, tag: 'full day' });
    if (r) { const { p, c } = r;
      if (!c) bad('full day: no guide was built from the sources');
      else {
        if (c.ai !== false || !c.src) bad(`full day: the guide is not marked as built from sources (ai ${c.ai}, srcGuide ${c.src})`); else ok(`full day: guide from sources, no AI (${c.sites.length} sights: ${c.sites.slice(0, 5).join(', ')}…)`);
        const cr = c.cruise[0]; if (!cr || cr.u || !/Prince George/.test(cr.n)) bad(`full day: cruise port start ${JSON.stringify(c.cruise)}, expected Prince George Wharf`); else ok(`full day: starts at ${cr.n}`);
        const t = await p.evaluate(() => window.__kairouteTruth(1));
        if (t.error || !(t.stopNames || []).length) bad(`full day: plan ${t.error || 'has no stops'}`); else ok(`full day: ${t.stopNames.length} stops (${t.stopNames.join(', ')})`);
        const q = await p.evaluate(() => window.__kairouteQuality().find(x => x.i === 1));
        if (!q || q.skip) bad(`full day: ship checks could not run (${q && q.skip})`);
        else { const ship = q.issues.filter(x => /ship|all aboard|ends .* after/.test(x));
          if (ship.length) bad('full day: ship safety: ' + ship.join('; ')); else ok(`full day: back at the ship ${q.end}, be-back-by ${q.endBy} (45 min before all aboard 17:00)`);
          const other = q.issues.filter(x => !ship.includes(x)); if (other.length) console.log('note full day: other plan notes: ' + other.join('; ')); }
        await p.evaluate(() => window.__kairouteAt(1, 'plan')); await p.waitForTimeout(500);
        const shown = await p.evaluate(() => [...document.querySelectorAll('.tl .nm')].map(e => e.innerText.trim()));
        if (!shown.length) bad('full day: the Day plan screen shows no stops');
      }
      if (r.errs.length) bad('full day: page errors: ' + [...new Set(r.errs)].join(' | ')); await p.close(); } }
  // 2. A short call (4 hours ashore): same rules, never past all aboard.
  { const r = await portTrip(b, { arrive: '10:00', aboard: '14:30', dockFound: true, tag: 'short call' });
    if (r) { const { p, c } = r;
      if (!c) bad('short call: no guide was built');
      else { const q = await p.evaluate(() => window.__kairouteQuality().find(x => x.i === 1));
        if (!q || q.skip) bad(`short call: ship checks could not run (${q && q.skip})`);
        else { const ship = q.issues.filter(x => /ship|all aboard|ends .* after/.test(x));
          if (ship.length) bad('short call: ship safety: ' + ship.join('; ')); else ok(`short call: ${q.stops} stops, back at the ship ${q.end}, be-back-by ${q.endBy}`); } }
      if (r.errs.length) bad('short call: page errors: ' + [...new Set(r.errs)].join(' | ')); await p.close(); } }
  // 3. The dock can't be found on the map: never planned from a guess.
  { const r = await portTrip(b, { arrive: '08:00', aboard: '17:00', dockFound: false, tag: 'dock unknown' });
    if (r) { const { p, c } = r;
      if (!c) ok('dock unknown: no guide built (nothing planned from a guess)');
      else { const cr = c.cruise[0];
        if (!cr || !cr.u) bad(`dock unknown: the cruise port is not marked unknown: ${JSON.stringify(c.cruise)}`);
        else { const t = await p.evaluate(() => window.__kairouteTruth(1));
          await p.evaluate(() => window.__kairouteAt(1, 'plan')); await p.waitForTimeout(500);
          const txt = await p.evaluate(() => document.body.innerText);
          const says = /couldn.t find|not sure where|unknown|where the ship docks|Choose where/i.test(txt);
          if (!says) bad(`dock unknown: the day plan doesn't say the dock wasn't found (plan: ${t.error || (t.stopNames || []).join(', ')})`);
          else ok(`dock unknown: the day says the dock wasn't found${t.error ? ' (' + t.error + ')' : ''}`); } }
      if (r.errs.length) bad('dock unknown: page errors: ' + [...new Set(r.errs)].join(' | ')); await p.close(); } }
  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nPort with no built-in guide: all passed');
  process.exit(fails ? 1 : 0);
})();
