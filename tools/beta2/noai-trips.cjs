// Beta 2 yardstick, part 2 (lesson #14: hand-written guides hid gaps in the automatic path). Test trips whose guides are
// built the automatic way, AI off, from saved source data (tools/fixtures/src-*.json): a big city stay, a small cruise
// port (full day and short call) and a cruise line's private island. Saves each trip's bucket and the old engine's plans
// next to the others in tools/beta2/snapshots/. No network, no AI. Usage: ./build.sh && node tools/beta2/noai-trips.cjs
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'index.html'));
const FIX = n => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', n), 'utf8'));
const OUT = path.join(__dirname, 'snapshots'); fs.mkdirSync(OUT, { recursive: true });
const MOCK = 'https://mock.test';
// Older fixtures were saved before the helper sent a centre; add one from the stops.
const withCenter = (o) => { if (o.center || !o.stops || !o.stops.length) return o; const v = (k) => o.stops.map((x) => +x[k]).filter(isFinite).sort((a, b) => a - b); const m = (a) => a[a.length >> 1]; return Object.assign({ center: { lat: m(v('lat')), lng: m(v('lng')) } }, o); };
const SRC = [{ re: /paris/i, f: FIX('src-paris.json') }, { re: /prague|praha/i, f: FIX('prague-sources.json') }, { re: /nassau/i, f: FIX('src-nassau.json'), dock: { re: /port of nassau|nassau cruise terminal|cruise/i, at: { title: 'Prince George Wharf', lat: 25.0793, lng: -77.3428 } } },
  { re: /example cay/i, f: FIX('src-private-island.json'), dock: { re: /cruise|pier|port/i, at: { title: 'Example Cay pier', lat: 25.8180, lng: -77.9350 } } }];
const prefs = { pace: 'moderate', walk: 'medium', interests: [], travelers: '', access: 'none', party: 2, lang: 'English' };
let seq = 0; const day = o => Object.assign({ id: 'd' + (++seq), date: '2027-01-12', destination: '', type: 'land', mode: 'flight', time: '09:00', pointIdx: 0, startTime: '09:00', hours: 8, alongWay: true, returnToStart: true, selected: null }, o);
function helper(r) {
  const u = new URL(r.request().url()), j = o => r.fulfill({ contentType: 'application/json', body: JSON.stringify(o) }), city = u.searchParams.get('city') || '';
  const src = SRC.find(s => s.re.test(city));
  if (u.pathname === '/status') return j({ ok: true, on: false, left: 0, budget: 0 });
  if (u.pathname === '/sample') return r.fulfill({ status: 429, body: '{"error":"AI off"}' });
  if (u.pathname === '/sources') return src ? j(withCenter(src.f.sources)) : r.fulfill({ status: 404, body: '{}' });
  if (u.pathname === '/famous') return src ? j(src.f.famous) : r.fulfill({ status: 404, body: '{}' });
  if (u.pathname === '/ground') { const b = JSON.parse(r.request().postData() || '{}');
    return j({ results: (b.names || []).map(n => { const s = SRC.find(x => x.dock && x.re.test(n) && x.dock.re.test(n)); return s ? { wiki: [s.dock.at], map: [], answered: true } : { wiki: [], map: [], answered: true }; }) }); }
  if (u.pathname === '/places') { const b = JSON.parse(r.request().postData() || '{}');
    return j({ places: (b.pts || []).slice(0, 12).flatMap((p, i) => [0, 1].map(k => ({ name: `Test Eatery ${i}-${k}`, lat: +(p.lat + 0.0012 * (k + 1)).toFixed(5), lng: +(p.lng + 0.001).toFixed(5), amenity: 'restaurant', cuisine: k ? 'local' : 'seafood', tags: 5, hours: 'Mo-Su 11:00-22:00' }))) }); }
  if (u.pathname === '/transit') { const b = JSON.parse(r.request().postData() || '{}'); return j({ results: (b.pairs || []).map(() => ({ opts: [] })) }); }
  return r.fulfill({ status: 404, body: '{}' });
}
const TRIPS = [
  { name: 'noai-city', label: 'No-AI guide: big city stay, 3 days', days: [day({ date: '2027-05-04', destination: 'Paris' }), day({ date: '2027-05-05', destination: 'Paris' }), day({ date: '2027-05-06', destination: 'Paris', hours: 4 })] },
  { name: 'noai-prague', label: 'No-AI guide: Prague city stay, 2 days (old town and castle)', days: [day({ date: '2027-05-11', destination: 'Prague' }), day({ date: '2027-05-12', destination: 'Prague' })] },
  { name: 'noai-port', label: 'No-AI guide: small cruise port, full day and short call', days: [day({ date: '2027-01-11', destination: 'At sea', type: 'sea' }), day({ date: '2027-01-12', destination: 'Nassau, Bahamas', type: 'port', portArrive: '08:00', allAboard: '17:00' }),
      day({ date: '2027-01-13', destination: 'At sea', type: 'sea' }), day({ date: '2027-01-14', destination: 'Nassau, Bahamas', type: 'port', portArrive: '10:00', allAboard: '14:30' })] },
  { name: 'noai-island', label: "No-AI guide: a cruise line's private island", days: [day({ date: '2027-01-13', destination: 'At sea', type: 'sea' }), day({ date: '2027-01-14', destination: 'Example Cay', type: 'port', portArrive: '07:30', allAboard: '16:30' })] }
];
(async () => {
  const b = await chromium.launch(); let bad = 0;
  for (const t of TRIPS.filter(t => !process.env.ONLY || process.env.ONLY.split(',').includes(t.name))) {
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', r => { const u = r.request().url(); if (u.startsWith(MOCK)) return helper(r); return /^file:/.test(u) ? r.continue() : r.abort(); });
    await p.goto('file://' + FILE);
    const first = t.days.findIndex(d => d.type !== 'sea');
    await p.evaluate(([days, prefs, a]) => { localStorage.setItem('kairoute.intro1', '1'); localStorage.setItem('wayside.trip2', JSON.stringify({ id: 't-' + days[0].id, name: 'Test', style: 'mix', active: a, lodging: {}, journal: {}, prefs, days })); }, [t.days, prefs, first]);
    await p.reload(); await p.waitForTimeout(500);
    await p.evaluate(m => window.__kairouteMockHelper(m, null, true), MOCK);
    await p.evaluate(i => window.__kairouteAt(i, 'plan'), first); await p.waitForTimeout(300);
    const btn = p.locator('[data-act="gen"]').first();
    if (await btn.isVisible().catch(() => false)) await btn.click();
    await p.waitForFunction(i => { const s = window.__kairouteState(); return !s.busy && !!window.__kairouteCityOf(i); }, first, { timeout: 40000 }).catch(() => {});
    await p.waitForTimeout(2500);
    const snap = await p.evaluate(() => window.__kairouteBucket(true));
    snap.name = t.name; snap.label = t.label;
    const noGuide = snap.days.filter(d => !d.noShore && !d.city).length, planned = snap.old.filter(x => !x.error).length;
    if (noGuide) { bad++; console.log(`FAIL ${t.name}: ${noGuide} day(s) got no guide from the sources`); }
    fs.writeFileSync(path.join(OUT, t.name + '.json'), JSON.stringify(snap));
    console.log(`${noGuide ? 'FAIL' : 'ok  '} ${t.name}: ${snap.days.length} days, ${planned} planned by the old engine${errs.length ? ' | page errors: ' + [...new Set(errs)].join('; ') : ''}`);
    snap.old.forEach((o, i) => { if (o.error && !snap.days[i].noShore) console.log('     day ' + i + ': ' + o.error); });
    await p.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
