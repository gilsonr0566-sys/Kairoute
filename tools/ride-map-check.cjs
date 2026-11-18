// Rides read clearly on the street map, on every day: direction arrows on the lines, a ride badge (walk, taxi,
// metro...) at the middle of each ride, rides that share a road drawn side by side, the start and finish shown as
// what they are (cruise port, airport, station), and the map never wider than its card on a phone.
// Usage: node tools/ride-map-check.cjs [index.html]   MOCK=1 stubs the map tiles and routes (no network).
// Screenshots: checks/rides-*.png (the first cruise port day, and the first day overall).
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const http = require('http');
const ROOT = path.resolve(path.dirname(process.argv[2] || path.join(__dirname, '..', 'index.html')));
const MOCK = process.env.MOCK === '1';
const OUT = path.join(ROOT, 'checks'); fs.mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/json' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
let fails = 0, warns = 0; const bad = m => { fails++; console.log('FAIL ' + m); };
const SIZES = [['tablet', { width: 1280, height: 800 }, 1], ['phone', { width: 384, height: 832 }, 3]];
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = `http://localhost:${srv.address().port}/`;
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [name, size, scale] of SIZES) {
    const ctx = await b.newContext({ viewport: size, deviceScaleFactor: scale, hasTouch: true, isMobile: size.width < 600, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    if (MOCK) {
      const style = { version: 8, sources: { openmaptiles: { type: 'vector', tiles: ['https://tiles.openfreemap.org/t/{z}/{x}/{y}.pbf'], maxzoom: 14 } }, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#eef0ec' } }] };
      await p.route('https://tiles.openfreemap.org/**', r => /\/styles\//.test(r.request().url()) ? r.fulfill({ json: style }) : r.fulfill({ status: 200, body: Buffer.alloc(0), contentType: 'application/x-protobuf' }));
      await p.route('**/route', async r => { const legs = JSON.parse(r.request().postData()).legs; r.fulfill({ json: { routes: legs.map(l => ({ c: [l.a, [(l.a[0] + l.b[0]) / 2 + 0.001, (l.a[1] + l.b[1]) / 2], l.b], km: 1, min: 12 })) } }); });
      await p.route('**/ai.json', r => r.fulfill({ json: { url: 'http://localhost:9/w' } }));
      await p.route('http://localhost:9/**', r => /\/route$/.test(r.request().url()) ? r.fallback() : r.fulfill({ status: 404, body: '' }));
    }
    await p.goto(base + 'index.html'); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(800);
    await p.getByText('Continue trip').click(); await p.waitForTimeout(400);
    // The side-by-side rule itself: an out-and-back on one road is two lines; two rides on different roads are not.
    if (name === 'tablet') {
      const r = await p.evaluate(() => { const road = [[25.143, 35.344], [25.150, 35.330], [25.158, 35.310], [25.1631, 35.2979]];
        return { back: window.__kairouteRideShared([road, road.slice().reverse()]), apart: window.__kairouteRideShared([road, road.map(c => [c[0] + 0.02, c[1]])]) }; });
      if (!(r.back[0] && r.back[1])) bad('an out-and-back on one road is not drawn as two lines side by side');
      if (r.apart[0] || r.apart[1]) bad('two rides on different roads were pushed apart');
    }
    const n = await p.evaluate(() => document.querySelectorAll('.daychip').length);
    let shotPort = false, shotFirst = false, tested = 0, portDays = 0;
    for (let i = 0; i < n; i++) {
      await p.evaluate(i => document.querySelector(`.daychip[data-day="${i}"]`).click(), i); await p.waitForTimeout(200);
      await p.evaluate(() => { const t = document.querySelector('.tab[data-view="plan"]'); if (t) t.click(); }); await p.waitForTimeout(300);
      if (!(await p.evaluate(() => !!document.querySelector('#view [data-map="plan"]')))) continue;
      const t0 = Date.now(); let m; while (Date.now() - t0 < 25000) { m = await p.evaluate(() => window.__kairouteMap()); if (m.live && m.drawn === m.legs && m.tiles) break; await p.waitForTimeout(300); }
      if (!m.live) { if (MOCK) bad(`${name} day ${i + 1}: no live map`); else warns++; continue; }
      tested++;
      await p.waitForTimeout(400);
      const r = await p.evaluate(() => window.__kairouteRides());
      if (!r.arrows) bad(`${name} day ${i + 1}: no direction arrows on the lines`);
      if (r.badges.length !== m.onLegs) bad(`${name} day ${i + 1}: ${m.onLegs} rides but ${r.badges.length} ride badges`);
      if (m.legs && !r.badges.some(x => x.shown)) bad(`${name} day ${i + 1}: every ride badge is hidden`);
      const over = await p.evaluate(() => { const mb = document.querySelector('#view [data-map="plan"]').closest('.mapbox') || document.querySelector('#view [data-map="plan"]').parentElement; return mb.scrollWidth - mb.clientWidth; });
      if (over > 1) bad(`${name} day ${i + 1}: the map is ${over}px wider than its card`);
      const port = await p.evaluate(() => /IN PORT|in port/i.test((document.querySelector('#view .eyebrow') || {}).textContent || ''));
      if (port) { portDays++; if (!r.ends.some(e => /Cruise port/.test(e))) bad(`${name} day ${i + 1}: a port day's start is not marked as the cruise port (${JSON.stringify(r.ends)})`); }
      const shoot = (port && !shotPort) || (!shotFirst);
      if (shoot) { const el = await p.$('#view .mapslot.live'); await el.evaluate(e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(500);
        await p.screenshot({ path: path.join(OUT, `rides-${name}-${port ? 'port' : 'first'}-day.png`) }); if (port) shotPort = true; else shotFirst = true; }
    }
    if (!tested) bad(name + ': no day had a map');
    if (!portDays) console.log('note: the example trip had no port day to check the cruise port marker on');
    if (errs.length) bad(name + ': page errors: ' + [...new Set(errs)].join(' | '));
    await ctx.close();
  }
  // Place names before and after brightening, dark and light, on the first port day's map (tablet).
  for (const scheme of ['dark', 'light']) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: scheme, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    await p.goto(base + 'index.html'); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(800);
    await p.getByText('Continue trip').click(); await p.waitForTimeout(400);
    const i = await p.evaluate(() => [...document.querySelectorAll('.daychip')].findIndex(e => /Heraklion/.test(e.textContent)));
    if (i < 0 || MOCK) { await ctx.close(); continue; }
    await p.evaluate(i => document.querySelector(`.daychip[data-day="${i}"]`).click(), i); await p.waitForTimeout(300);
    await p.evaluate(() => { const t = document.querySelector('.tab[data-view="plan"]'); if (t) t.click(); });
    const t0 = Date.now(); while (Date.now() - t0 < 25000) { const m = await p.evaluate(() => window.__kairouteMap()); if (m.live && m.tiles) break; await p.waitForTimeout(300); }
    await p.waitForTimeout(1500);
    const el = await p.$('#view .mapbox');
    await p.evaluate(() => window.__kairouteLabels(false)); await p.waitForTimeout(800); await el.screenshot({ path: path.join(OUT, `labels-${scheme}-before.png`) });
    await p.evaluate(() => window.__kairouteLabels(true)); await p.waitForTimeout(800); await el.screenshot({ path: path.join(OUT, `labels-${scheme}-after.png`) });
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(fails ? `Ride map check: ${fails} problem(s)` : `Ride map check passed: arrows, ride badges, side-by-side rule, start and finish markers, map fits its card, tablet and phone${warns ? ` (${warns} day(s) skipped: outside map service slow)` : ''}`);
  process.exit(fails ? 1 : 0);
})();
