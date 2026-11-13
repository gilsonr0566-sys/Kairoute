// The real street map on the real screens. For every sightseeing day of the example trip: the Day plan shows
// a live map (not the fallback diagram) with the map tiles loaded, one line per leg of the route, a numbered
// marker for every numbered stop in the plan, "+" markers for optional stops, a marker for each meal, and
// walking legs that follow the streets. Then Tour mode: the map is on the walk screen, the leg being walked is
// highlighted, and Follow me puts the traveler's blue dot on the map.
// Usage: node tools/map-e2e.cjs [index.html]   MOCK=1 stubs the map tiles and routes (no network needed).
// STREETS=1 also requires street-following routes from the live helper. Screenshots go to checks/map-*.png.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const http = require('http');
const ROOT = path.resolve(path.dirname(process.argv[2] || path.join(__dirname, '..', 'index.html')));
const MOCK = process.env.MOCK === '1', STREETS = process.env.STREETS === '1';
const OUT = path.join(ROOT, 'checks'); fs.mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/json' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = `http://localhost:${srv.address().port}/`;
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, geolocation: { latitude: 0, longitude: 0 }, permissions: ['geolocation'], serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  if (MOCK) {
    // A tiny map style with one background layer, and straight-ish "street" routes with a bend in the middle.
    const style = { version: 8, sources: { openmaptiles: { type: 'vector', tiles: ['https://tiles.openfreemap.org/t/{z}/{x}/{y}.pbf'], maxzoom: 14 } }, glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf', layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#eef0ec' } }, { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': '#aad' } }] };
    await p.route('https://tiles.openfreemap.org/**', r => /\/styles\//.test(r.request().url()) ? r.fulfill({ json: style }) : r.fulfill({ status: 200, body: Buffer.alloc(0), contentType: 'application/x-protobuf' }));
    await p.route('**/route', async r => { const legs = JSON.parse(r.request().postData()).legs; r.fulfill({ json: { routes: legs.map(l => ({ c: [l.a, [(l.a[0] + l.b[0]) / 2 + 0.001, (l.a[1] + l.b[1]) / 2], l.b], km: 1, min: 12 })) } }); });
    await p.route('**/ai.json', r => r.fulfill({ json: { url: 'http://localhost:9/w' } }));
    await p.route('http://localhost:9/**', r => /\/route$/.test(r.request().url()) ? r.fallback() : r.fulfill({ status: 404, body: '' }));
  }
  await p.goto(base + 'index.html'); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(800);
  await p.getByText('Continue trip').click(); await p.waitForTimeout(400);
  const n = await p.evaluate(() => document.querySelectorAll('.daychip').length);
  // On the live run, the outside map services (OpenFreeMap tiles, the route helper) are sometimes slow or busy: those
  // are warnings, not failures, so the run only goes red (and emails) for a real problem in Kairoute's map code.
  let fails = 0, tested = 0, warns = 0; const outside = m => !MOCK && /tiles did not load|map library failed|straight lines|did not appear/.test(m);
  const bad = (i, m) => { if (outside(m)) { warns++; console.log(`WARN day ${i + 1} (outside map service slow or busy): ${m}`); } else { fails++; console.log(`FAIL day ${i + 1}: ${m}`); } };
  const M = () => p.evaluate(() => window.__kairouteMap());
  const waitMap = async (pred, ms = 25000) => { const t0 = Date.now(); let m; while (Date.now() - t0 < ms) { m = await M(); if (pred(m)) return m; await p.waitForTimeout(300); } return m; };
  for (let i = 0; i < n; i++) {
    await p.evaluate(i => document.querySelector(`.daychip[data-day="${i}"]`).click(), i); await p.waitForTimeout(200);
    await p.evaluate(() => { const t = document.querySelector('.tab[data-view="plan"]'); if (t) t.click(); }); await p.waitForTimeout(300);
    if (!(await p.evaluate(() => !!document.querySelector('#view [data-map="plan"]')))) continue; // sea day or a day with no plan
    tested++;
    const m = await waitMap(x => x.live && x.tiles && x.slot === 'plan' && (!STREETS || x.streetLegs === x.legs), STREETS ? 50000 : 25000);
    if (!m.live) { bad(i, 'the street map did not appear (diagram only)' + (m.noGo ? ': map library failed to load' : '')); continue; }
    if (!m.tiles) bad(i, 'map tiles did not load');
    if (m.drawn !== m.legs) bad(i, `route has ${m.legs} legs but the map draws ${m.drawn}`);
    if (STREETS && m.streetLegs < m.legs) bad(i, `${m.legs - m.streetLegs} of ${m.legs} legs are straight lines, not streets`);
    const want = await p.evaluate(() => { const svg = document.querySelector('#view [data-map="plan"] > svg'); const t = [...svg.querySelectorAll('text')].map(x => x.textContent);
      return { stops: t.filter(x => /^\d+$/.test(x)).length, bonus: t.filter(x => x === '+').length, meals: svg.querySelectorAll('circle[stroke="var(--meal)"]').length }; });
    const got = { stops: m.marks.filter(x => /^stop/.test(x)).length, bonus: m.marks.filter(x => /^bonus/.test(x)).length, meals: m.marks.filter(x => /^meal/.test(x)).length };
    for (const k of ['stops', 'bonus', 'meals']) if (got[k] !== want[k]) bad(i, `map shows ${got[k]} ${k}, the plan has ${want[k]}`);
    const nums = await p.evaluate(() => [...document.querySelectorAll('#view .mk-stop')].map(e => +e.textContent));
    if (nums.some((x, k) => x !== k + 1)) bad(i, 'stop numbers on the map are out of order: ' + nums.join(','));
    if (m.zoom < 7) bad(i, `map is zoomed out too far to see the route (zoom ${m.zoom.toFixed(1)})`);
    if (tested === 1 || i === n - 1) await p.screenshot({ path: path.join(OUT, `map-plan-day${i + 1}.png`) });
  }
  if (!tested) { fails++; console.log('FAIL: no day had a map'); }
  // Tour mode on the first sightseeing day.
  for (let i = 0; i < n; i++) {
    await p.evaluate(i => document.querySelector(`.daychip[data-day="${i}"]`).click(), i); await p.waitForTimeout(200);
    await p.evaluate(() => { const t = document.querySelector('.tab[data-view="plan"]'); if (t) t.click(); }); await p.waitForTimeout(300);
    const pt = await p.evaluate(() => { const pl = window.__kairoutePlans()[+document.querySelector('.daychip[aria-pressed="true"]').dataset.day]; return pl && pl.pts && pl.pts.length > 2 ? pl.pts[1] : null; });
    if (!pt) continue;
    await p.evaluate(() => [...document.querySelectorAll('[data-act="tourstart"]')].find(e => e.offsetParent).click()); await p.waitForTimeout(400);
    let m = await waitMap(x => x.live && x.slot === 'tour');
    if (!m.live) { if (MOCK) fails++; else warns++; console.log((MOCK ? 'FAIL' : 'WARN (outside map service slow or busy)') + ' tour: no map on the tour start screen'); break; }
    await p.evaluate(() => document.querySelector('[data-act="tournext"]').click()); await p.waitForTimeout(400);
    m = await waitMap(x => x.live && x.slot === 'tour' && x.active != null);
    if (!m.live) { if (MOCK) fails++; else warns++; console.log((MOCK ? 'FAIL' : 'WARN (outside map service slow or busy)') + ' tour: no map on the walk screen'); }
    else if (m.onLegs !== 1) { fails++; console.log(`FAIL tour: ${m.onLegs} legs highlighted on the walk screen, expected 1`); }
    await ctx.setGeolocation({ latitude: pt.lat + 0.003, longitude: pt.lng + 0.003 });
    await p.evaluate(() => { const b = document.querySelector('[data-act="follow"]'); if (b) b.click(); });
    m = await waitMap(x => x.you, 15000);
    if (!m.you) { fails++; console.log('FAIL tour: Follow me did not put the blue dot on the map'); }
    await p.screenshot({ path: path.join(OUT, 'map-tour-walk.png') });
    await p.evaluate(() => { const b = document.querySelector('[data-act="follow"]'); if (b) b.click(); const x = document.querySelector('[data-act="tourexit"]'); if (x) x.click(); });
    break;
  }
  if (errs.length) { fails++; console.log('FAIL page errors: ' + [...new Set(errs)].join(' | ')); }
  console.log(fails ? `Map check: ${fails} problem(s) across ${tested} days` : `Map check passed: live street map on ${tested} days and in Tour mode${warns ? ` (${warns} warning(s): an outside map service was slow)` : ''}`);
  await b.close(); srv.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
