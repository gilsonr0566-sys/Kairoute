// "You on the map": the traveler shows as a small person on the street map (Day plan and Tour), with a beam for
// the way they're facing, live as they walk, and polite handling when location is off or there's no signal.
// 1. Location already allowed: the person appears on the Day plan by itself, moves when the position moves, shows
//    the compass direction, falls back to the walking direction, and turns grey when the position is old.
// 2. Location not allowed yet: nothing is asked until the map's locate button is tapped; when the traveler says no,
//    a short note says how to turn it on, and the app carries on with no errors.
// 3. Far from the day's places (planning at home): the map stays on the trip and says how far away you are.
// 4. Tour: the same person on the tour map, never two markers.
// Usage: node tools/you-map-check.cjs [index.html]   MOCK=1 stubs the map tiles (no network). Screenshots: checks/you-*.png
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const http = require('http');
const ROOT = path.resolve(path.dirname(process.argv[2] || path.join(__dirname, '..', 'index.html')));
const MOCK = process.env.MOCK === '1';
const OUT = path.join(ROOT, 'checks'); fs.mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/json' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
const SIZES = [['tablet', { width: 1280, height: 800 }, 1], ['phone', { width: 384, height: 832 }, 3]];
let fails = 0; const bad = m => { fails++; console.log('FAIL ' + m); };
async function page(b, size, scale, perms) {
  const ctx = await b.newContext({ viewport: size, deviceScaleFactor: scale, hasTouch: true, isMobile: size.width < 600, geolocation: { latitude: 0, longitude: 0 }, permissions: perms, serviceWorkers: 'block' });
  // Test browsers have no compass; give them the same compass events an Android phone sends.
  await ctx.addInitScript(() => { if (!window.DeviceOrientationEvent) window.DeviceOrientationEvent = function () {}; if (!('ondeviceorientationabsolute' in window)) window.ondeviceorientationabsolute = null; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  if (MOCK) {
    const style = { version: 8, sources: { openmaptiles: { type: 'vector', tiles: ['https://tiles.openfreemap.org/t/{z}/{x}/{y}.pbf'], maxzoom: 14 } }, glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf', layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#eef0ec' } }] };
    await p.route('https://tiles.openfreemap.org/**', r => /\/styles\//.test(r.request().url()) ? r.fulfill({ json: style }) : r.fulfill({ status: 200, body: Buffer.alloc(0), contentType: 'application/x-protobuf' }));
    await p.route('**/route', async r => { const legs = JSON.parse(r.request().postData()).legs; r.fulfill({ json: { routes: legs.map(l => ({ c: [l.a, [(l.a[0] + l.b[0]) / 2 + 0.001, (l.a[1] + l.b[1]) / 2], l.b], km: 1, min: 12 })) } }); });
    await p.route('**/ai.json', r => r.fulfill({ json: { url: 'http://localhost:9/w' } }));
    await p.route('http://localhost:9/**', r => /\/route$/.test(r.request().url()) ? r.fallback() : r.fulfill({ status: 404, body: '' }));
  }
  await p.goto(base + 'index.html'); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(800);
  await p.getByText('Continue trip').click(); await p.waitForTimeout(400);
  return { ctx, p, errs };
}
// The first sightseeing day with a map, and a spot on the walk between its first two stops.
async function openDay(p) {
  const n = await p.evaluate(() => document.querySelectorAll('.daychip').length);
  for (let i = 0; i < n; i++) {
    await p.evaluate(i => document.querySelector(`.daychip[data-day="${i}"]`).click(), i); await p.waitForTimeout(200);
    await p.evaluate(() => { const t = document.querySelector('.tab[data-view="plan"]'); if (t) t.click(); }); await p.waitForTimeout(300);
    const pts = await p.evaluate(() => { const pl = window.__kairoutePlans()[+document.querySelector('.daychip[aria-pressed="true"]').dataset.day]; return pl && pl.pts && pl.pts.length > 2 ? pl.pts : null; });
    if (pts && await p.evaluate(() => !!document.querySelector('#view [data-map="plan"]'))) return { i, a: pts[1], b: pts[2] };
  }
  return null;
}
const Y = p => p.evaluate(() => window.__kairouteYou());
const waitFor = async (p, fn, ms = 20000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v) return v; await p.waitForTimeout(250); } return v; };
const compass = (p, alpha) => p.evaluate(a => { const e = new Event('deviceorientationabsolute'); Object.assign(e, { alpha: a, beta: 0, gamma: 0, absolute: true }); window.dispatchEvent(e); }, alpha);
const mapShot = async (p, name) => { const el = await p.$('#view .mapslot.live'); if (el) { await el.evaluate(e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(400); } await p.screenshot({ path: path.join(OUT, name) }); if (process.env.JPG) await p.screenshot({ path: path.join(OUT, name.replace(/\.png$/, '.jpg')), type: 'jpeg', quality: 60, scale: 'css' }); };
let base;
(async () => {
  await new Promise(r => srv.listen(0, r)); base = `http://localhost:${srv.address().port}/`;
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [name, size, scale] of SIZES) {
    // 1. Location allowed.
    let { ctx, p, errs } = await page(b, size, scale, ['geolocation']);
    const day = await openDay(p); if (!day) { bad(name + ': no day with a map'); continue; }
    const mid = (k, t) => ({ latitude: day.a.lat + (day.b.lat - day.a.lat) * t, longitude: day.a.lng + (day.b.lng - day.a.lng) * t, accuracy: 25 });
    await ctx.setGeolocation(mid(0, 0.35));
    const live = await waitFor(p, async () => (await p.evaluate(() => window.__kairouteMap())).live && (await Y(p)).on);
    if (!live) { bad(name + ': the person did not appear on the Day plan map with location allowed'); continue; }
    let y = await Y(p);
    if (!y.person) bad(name + ': the marker is not a person');
    if (!y.btn) bad(name + ': no "Show where I am" button on the map');
    await p.click('#view .you-btn'); await p.waitForTimeout(900);
    const at1 = await p.evaluate(() => { const r = document.querySelector('.mk-you').getBoundingClientRect(); return [r.x, r.y]; });
    await compass(p, 360 - 60); await p.waitForTimeout(300); for (let k = 0; k < 8; k++) { await compass(p, 360 - 60); await p.waitForTimeout(40); }
    y = await Y(p);
    if (!y.beam) bad(name + ': no facing beam with a compass reading');
    if (!/rotate\((5[5-9]|6[0-5])deg\)/.test(y.turn)) bad(name + ': beam does not point the way the compass says (want ~60°, got ' + y.turn + ')');
    if (!/north-east|east/.test(y.label)) bad(name + ': label does not say the direction: ' + y.label);
    await mapShot(p, `you-${name}-plan.png`);
    // Walking: the person moves with the position.
    await ctx.setGeolocation(mid(0, 0.6)); await p.waitForTimeout(2600);
    const at2 = await p.evaluate(() => { const r = document.querySelector('.mk-you').getBoundingClientRect(); return [r.x, r.y]; });
    if (Math.hypot(at2[0] - at1[0], at2[1] - at1[1]) < 3) bad(name + ': the person did not move when the position moved');
    // No compass (some tablets): once the compass goes quiet, the beam follows the walking direction from GPS.
    await p.waitForTimeout(4300);
    const want = await p.evaluate(([a, b]) => { const r = Math.PI / 180, y = Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r), x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r); return (Math.atan2(y, x) / r + 360) % 360; }, [day.a, day.b]);
    await ctx.setGeolocation(mid(0, 0.8)); await p.waitForTimeout(2600);
    y = await Y(p);
    const got = y.beam ? +((/rotate\((-?\d+)deg\)/.exec(y.turn) || [])[1]) : NaN;
    if (!(Math.abs(((got - want + 540) % 360) - 180) <= 8)) bad(name + `: with no compass the beam should follow the walking direction (want ${Math.round(want)}°, got ${y.beam ? y.turn : 'no beam'})`);
    if ((await p.$$('#view .mk-you')).length !== 1) bad(name + ': more than one "you" marker');
    // Old position: grey, no beam.
    await p.evaluate(() => { const g = window.__kairouteYouAge; if (g) g(-120e3); }); await p.waitForTimeout(2300);
    y = await Y(p); if (!y.stale) bad(name + ': an old position does not turn grey');
    if (errs.length) bad(name + ': page errors: ' + [...new Set(errs)].join(' | '));
    // 4. Tour: same person.
    await p.evaluate(() => { const g = window.__kairouteYouAge; if (g) g(0); });
    await p.evaluate(() => [...document.querySelectorAll('[data-act="tourstart"]')].find(e => e.offsetParent).click()); await p.waitForTimeout(400);
    await p.evaluate(() => { const n = document.querySelector('[data-act="tournext"]'); if (n) n.click(); }); await p.waitForTimeout(400);
    await ctx.setGeolocation(mid(0, 0.4));
    const t = await waitFor(p, async () => { const m = await p.evaluate(() => window.__kairouteMap()); return m.live && m.slot === 'tour' && (await Y(p)).on; });
    if (!t) bad(name + ': no person on the Tour map'); else { await compass(p, 360 - 300); for (let k = 0; k < 8; k++) { await compass(p, 360 - 300); await p.waitForTimeout(40); } await mapShot(p, `you-${name}-tour.png`); }
    if ((await p.$$('#view .mk-you')).length > 1) bad(name + ': two "you" markers on the Tour map');
    await ctx.close();
    // 2. Location not allowed yet, then refused.
    ({ ctx, p, errs } = await page(b, size, scale, []));
    await openDay(p);
    await waitFor(p, async () => (await p.evaluate(() => window.__kairouteMap())).live);
    y = await Y(p); if (y.on) bad(name + ': a person showed without location being allowed');
    if (y.watching) bad(name + ': the app asked for location before the button was tapped');
    await p.click('#view .you-btn'); await p.waitForTimeout(1500);
    y = await Y(p);
    if (!/allow location|ask to share|Looking/i.test(y.note)) bad(name + ': no polite note after tapping with location refused: "' + y.note + '"');
    await mapShot(p, `you-${name}-refused.png`);
    if (errs.length) bad(name + ': page errors (refused): ' + [...new Set(errs)].join(' | '));
    await ctx.close();
    // 3. Far away.
    ({ ctx, p, errs } = await page(b, size, scale, ['geolocation']));
    await ctx.setGeolocation({ latitude: 39.1, longitude: -94.6 });
    await openDay(p); await waitFor(p, async () => (await p.evaluate(() => window.__kairouteMap())).live);
    await p.click('#view .you-btn'); await p.waitForTimeout(1500);
    y = await Y(p); if (!/from this day's places/.test(y.note)) bad(name + ': far away, the map should say how far: "' + y.note + '"');
    const z = await p.evaluate(() => window.__kairouteMap().zoom); if (z < 7) bad(name + ': far away, the map left the trip (zoom ' + z.toFixed(1) + ')');
    if (name === 'phone') await mapShot(p, `you-${name}-far.png`);
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(fails ? `You-on-the-map check: ${fails} problem(s)` : 'You-on-the-map check passed: person, facing beam, live movement, old position, permission and far-away notes, tablet and phone');
  process.exit(fails ? 1 : 0);
})();
