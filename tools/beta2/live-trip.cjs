// Beta 2 dry runs on places the app was never tuned for. The app is built and run with AI OFF. Its helper calls go to
// the real helper, but only the free, no-AI lookups pass (sources, fame, map places, rides, weather); everything else
// (AI text, voices, Google ratings, sync) is refused here, so nothing counts against the AI cap or any paid allowance.
// Prints a summary per day and the raw source answers (gzip+base64) so they can be saved as offline fixtures.
// Runs on GitHub Actions (beta2-live.yml). Usage: ONLY=live-hamburg-stay node tools/beta2/live-trip.cjs [built index.html]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const zlib = require('zlib');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'index.html'));
const REAL = 'https://kairoute-ai.rickgilson.workers.dev', MOCK = 'https://mock.test';
const PASS = new Set(['/sources', '/famous', '/ground', '/places', '/transit', '/route', '/departures', '/ferries', '/weather', '/facts', '/osm', '/findplace', '/nearsights', '/verify', '/bookcheck', '/voyage']);
const K = require('./engine.cjs'); const E = K.KEngine || K;
const OUT = path.join(__dirname, 'snapshots'); fs.mkdirSync(OUT, { recursive: true });
const raw = {}, calls = {}, refused = {};
async function helper(r) {
  const req = r.request(), u = new URL(req.url());
  if (u.pathname === '/status') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, on: false, left: 0, budget: 0 }) });
  if (!PASS.has(u.pathname)) { refused[u.pathname] = (refused[u.pathname] || 0) + 1; return r.fulfill({ status: 429, body: '{"error":"off in this test"}' }); }
  calls[u.pathname] = (calls[u.pathname] || 0) + 1;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(REAL + u.pathname + u.search, { method: req.method(), headers: { 'content-type': 'application/json', origin: 'https://gilsonr0566-sys.github.io' }, body: req.method() === 'POST' ? req.postData() : undefined, signal: AbortSignal.timeout(45000) });
      const body = await res.text();
      if (res.ok) { if (/^\/(sources|famous|transit|ground)$/.test(u.pathname)) (raw[u.pathname] = raw[u.pathname] || []).push({ q: u.search, post: req.postData() || null, body: JSON.parse(body) }); return r.fulfill({ status: 200, contentType: 'application/json', body }); }
      if (res.status < 500) return r.fulfill({ status: res.status, contentType: 'application/json', body });
    } catch (e) { console.log('helper', u.pathname, e.message); }
    await new Promise(x => setTimeout(x, 3000));
  }
  return r.fulfill({ status: 502, body: '{}' });
}
const prefs = { pace: 'moderate', walk: 'medium', interests: [], travelers: '', access: 'none', party: 2, lang: 'English' };
let seq = 0; const day = o => Object.assign({ id: 'd' + (++seq), date: '2027-05-11', destination: '', type: 'land', mode: 'flight', time: '09:00', pointIdx: 0, startTime: '09:00', hours: 8, alongWay: true, returnToStart: true, selected: null }, o);
const sea = date => day({ date, destination: 'At sea', type: 'sea' });
const TRIPS = [
  { name: 'live-hamburg-stay', label: 'Hamburg: 2-day land stay (Tue, Wed)', days: [day({ date: '2027-05-11', destination: 'Hamburg, Germany' }), day({ date: '2027-05-12', destination: 'Hamburg, Germany' })] },
  { name: 'live-hamburg-port', label: 'Hamburg: cruise call on a Sunday (ashore 8:00, all aboard 18:00)', days: [sea('2027-05-15'), day({ date: '2027-05-16', destination: 'Hamburg, Germany', type: 'port', portArrive: '08:00', allAboard: '18:00' })] },
  { name: 'live-nassau', label: 'Nassau: cruise call (ashore 8:00, all aboard 17:00)', days: [sea('2027-01-11'), day({ date: '2027-01-12', destination: 'Nassau, Bahamas', type: 'port', portArrive: '08:00', allAboard: '17:00' })] },
  { name: 'live-cococay', label: "CocoCay: cruise line's private island (ashore 7:00, all aboard 17:00)", days: [sea('2027-01-13'), day({ date: '2027-01-14', destination: 'Perfect Day at CocoCay, Bahamas', type: 'port', portArrive: '07:00', allAboard: '17:00' })] },
];
const hm = m => m == null ? '--:--' : String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.round(m % 60)).padStart(2, '0');
(async () => {
  const b = await chromium.launch();
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
    await p.waitForFunction(i => { const s = window.__kairouteState(); return !s.busy && !!window.__kairouteCityOf(i); }, first, { timeout: 150000 }).catch(() => console.log('  (timed out waiting for the guide)'));
    await p.waitForTimeout(8000);
    const snap = await p.evaluate(() => window.__kairouteBucket(true)); snap.name = t.name; snap.label = t.label;
    fs.writeFileSync(path.join(OUT, t.name + '.json'), JSON.stringify(snap));
    console.log('\n===== ' + t.label + (errs.length ? ' | page errors: ' + [...new Set(errs)].join('; ') : ''));
    for (const d of snap.days) {
      if (d.type === 'sea') continue;
      const c = snap.cities[d.city] || {}; const sites = (c.sites || []).concat(c.farther || []);
      console.log(`-- day ${d.i} ${d.date} ${d.type} noShore=${!!d.noShore} city=${c.name || d.city} start=${JSON.stringify(d.point)} window ${hm(d.portArrive)}-${hm(d.allAboard)} missing=${JSON.stringify(d.missing)}`);
      if (d.i === first) {
        console.log(`   ${(c.sites || []).length} sights, ${(c.farther || []).length} farther, ${(c.restaurants || []).length} restaurants, srcGuide=${c.srcGuide}`);
        sites.forEach(x => { const sd = (d.sites || {})[x.id] || {}; console.log(`   ${x.id} | ${x.name} | ${x.lat},${x.lng} | ${x.min || x.minutes}m | ${x.category || ''} | ${(x.tags || []).join(',')} | in:${(x.in || []).join(',')} | hours:${sd.oh ? JSON.stringify(sd.oh.spans) : '?'}${sd.closed ? ' CLOSED' : ''}`); });
        (c.restaurants || []).slice(0, 12).forEach(x => console.log(`   eat | ${x.name} | ${x.lat},${x.lng} | ${x.cuisine || ''}`));
        const g = E.makeGroups(sites); console.log('   GROUPS', JSON.stringify(g.members));
      }
      const o = snap.old[d.i] || {}; if (o.error) { console.log('   OLD ERROR', o.error); continue; }
      console.log(`   old plan: start ${hm(o.start)} back by ${hm(o.endBy)} ends ${hm(o.end)} dropped=${JSON.stringify(o.dropped || [])} closedToday=${JSON.stringify(o.closedToday || [])}`);
      (o.items || []).forEach(it => console.log(it.t === 'ride' ? `        ~ ${it.mode} ${it.min}m ${(+it.km || 0).toFixed(1)}km` : `   ${hm(it.at)} ${it.t} ${it.name || ''} ${it.min || ''}${it.late ? ' LATE' : ''}`));
    }
    await p.close();
  }
  await b.close();
  console.log('\nhelper calls passed:', JSON.stringify(calls), ' refused:', JSON.stringify(refused));
  const z = zlib.gzipSync(JSON.stringify(raw)).toString('base64');
  console.log('RAW-BEGIN'); for (let i = 0; i < z.length; i += 2000) console.log('RAW ' + z.slice(i, i + 2000)); console.log('RAW-END');
})();
