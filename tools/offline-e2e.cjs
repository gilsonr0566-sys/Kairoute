// Offline check: plan a trip online, tap "Download for offline", then cut the internet (the website itself goes
// away too) and use the trip. Every unlocked day must come out the same with no signal: the app opens from the
// device, each Day plan has the same stops, meals, times and rides, the street map draws from saved tiles, a stop's
// story plays in the saved natural voice, and the status says "Ready for offline". Also checks that a day missing
// a piece is named (and says what still works), and that a free trip counts only its first day.
// All outside services are stand-ins (no network or cost). Usage: node tools/offline-e2e.cjs [index.html]
// Screenshots go to checks/offline-*.png.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const http = require('http');
const ROOT = path.resolve(path.dirname(process.argv[2] || path.join(__dirname, '..', 'index.html')));
const OUT = path.join(ROOT, 'checks'); fs.mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/json', '.txt': 'text/plain' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  if (q.url.split('?')[0] === '/ai.json') { r.writeHead(200, { 'content-type': 'application/json' }); return r.end(JSON.stringify({ url: 'http://localhost:9/w' })); }
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const style = theme => ({ version: 8, sources: { openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } }, glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf', sprite: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': theme === 'dark' ? '#223' : '#eef0ea' } }, { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': '#9cf' } }, { id: 'lab', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', layout: { 'text-field': '{name}', 'text-font': ['Noto Sans Regular'] } }] });
let tileHits = 0, speakHits = 0;
// Stand-ins for Kairoute's helper and the outside services.
async function services(ctx) {
  await ctx.route(/^https?:\/\/(?!localhost:\d{4,5}\/)/, async r => {
    const u = new URL(r.request().url()), p = u.pathname;
    if (u.hostname === 'tiles.openfreemap.org') {
      if (/^\/styles\/(positron|dark)/.test(p)) return r.fulfill({ json: style(/dark/.test(p) ? 'dark' : 'light') });
      if (p === '/planet') return r.fulfill({ json: { tilejson: '3.0.0', tiles: ['https://tiles.openfreemap.org/planet/test/{z}/{x}/{y}.pbf'], minzoom: 0, maxzoom: 14 } });
      if (/\.png$/.test(p)) return r.fulfill({ body: PNG1, contentType: 'image/png' });
      if (/\.json$/.test(p)) return r.fulfill({ json: {} });
      tileHits++; return r.fulfill({ status: 200, body: Buffer.alloc(0), contentType: 'application/x-protobuf' });
    }
    if (u.hostname === 'api.open-meteo.com') return r.fulfill({ json: { timezone: 'Europe/Athens', daily: { sunrise: [] } } });
    if (/fonts\.(googleapis|gstatic)\.com/.test(u.hostname)) return r.fulfill({ body: '', contentType: 'text/css' });
    if (u.hostname === 'localhost' && u.port === '9') {
      const body = (() => { try { return JSON.parse(r.request().postData() || '{}'); } catch (e) { return {}; } })();
      const w = p.replace(/^\/w/, '');
      if (w === '/status') return r.fulfill({ json: { left: 5000, budget: 10000, voiceLeft: 5e7 } });
      if (w === '/route') return r.fulfill({ json: { routes: (body.legs || []).map(l => ({ c: [[(l.a[0] + l.b[0]) / 2 + 0.0005, (l.a[1] + l.b[1]) / 2]] })) } });
      if (w === '/transit') return r.fulfill({ json: { results: (body.pairs || []).map(pr => { const km = Math.hypot(pr.a[0] - pr.b[0], (pr.a[1] - pr.b[1]) * Math.cos(pr.a[0] * Math.PI / 180)) * 111;
        const ride = Math.round(km / 40 * 60) + 4, acc = { how: 'walk', min: 6, km: 0.4 }, min = acc.min * 2 + 13 + ride;
        return { opts: [{ mode: 'train', kind: 'Train', label: 'Train T1 Test Line', operator: 'Test Rail', from: 'Start station', to: 'End station', ride, wait: 13, every: 10, everySrc: 'map', access: acc, egress: acc, min, km: +km.toFixed(1), stops: 3, hours: '', fare: '', path: [[pr.a[1], pr.a[0]], [pr.b[1], pr.b[0]]], noTimetable: true }] }; }) } });
      if (w === '/script') { const t = String(body.text || ''); const parts = t.split(/(?<=[.!?])\s+/).filter(Boolean); return r.fulfill({ json: { parts: parts.length >= 2 ? parts : [t, '…'] } }); }
      if (w === '/speak') { speakHits++; return r.fulfill({ body: Buffer.alloc(2048, 7), contentType: 'audio/mpeg' }); }
      if (w === '/voiceplan') return r.fulfill({ json: { ok: true } });
      if (w === '/grating') return r.fulfill({ json: { ratings: Object.fromEntries((body.places || []).map(x => [x.name, { state: 'ok', rating: 4.5, count: 321, url: '' }])) } });
      if (w === '/places') return r.fulfill({ json: { places: [] } });
      if (w === '/ratings') return r.fulfill({ json: { ratings: {}, busy: {} } });
      if (w === '/sample') return r.fulfill({ status: 503, json: { error: 'busy' } });
      return r.fulfill({ status: 404, json: {} });
    }
    return r.abort();
  });
}
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = `http://localhost:${srv.address().port}/`;
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await services(ctx);
  let fails = 0; const fail = m => { fails++; console.log('FAIL ' + m); }, ok = m => console.log('ok   ' + m);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + 'index.html'); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1'));
  await p.evaluate(() => navigator.serviceWorker.ready); await p.reload(); await p.waitForTimeout(800);
  if (!(await p.evaluate(() => !!navigator.serviceWorker.controller))) fail('the service worker did not take control of the page');
  await p.getByText('Continue trip').click(); await p.waitForTimeout(400);
  const O = (fn, ...a) => p.evaluate(([fn, a]) => window.__kairouteOffline[fn](...a), [fn, a]);
  // 1. Before downloading: the Trip screen says the trip is not ready, and offers the download.
  await p.evaluate(() => window.__kairouteGo('trip', 0)); await O('check'); await p.evaluate(() => window.__kairouteGo('trip', 0)); await p.waitForTimeout(300);
  const before = await p.evaluate(() => (document.getElementById('offCard') || {}).textContent || '');
  if (!/Not ready for offline/.test(before) || !/Download for offline/.test(before)) fail('before downloading, the Trip screen should say "Not ready for offline" with a Download button; it says: ' + before.slice(0, 160)); else ok('before downloading: "Not ready for offline yet" with a Download button');
  await p.screenshot({ path: path.join(OUT, 'offline-not-ready.png') });
  // 2. One tap downloads everything.
  const t0 = Date.now();
  await p.locator('#offCard [data-act="offdl"]').click();
  await p.waitForTimeout(1500); await p.screenshot({ path: path.join(OUT, 'offline-downloading.png') });
  let st, lastLog = 0; for (;;) { st = await O('state'); if (!st.run) break; if (Date.now() - lastLog > 15000) { lastLog = Date.now(); console.log(`     … ${st.run.pct}% ${st.run.step}`); } if (Date.now() - t0 > 420000) { fail('download did not finish in 7 minutes: ' + st.run.step); break; } await p.waitForTimeout(1000); }
  const rep = st.rep;
  if (!rep || !rep.ready) { fail('after downloading, the trip is not ready for offline. ' + (st.msg || '') + ' ' + (st.failed || []).join('; ')); (rep ? rep.days : []).filter(x => !x.ready).forEach(x => console.log(`     day ${x.i + 1} ${x.place}: missing ${Object.values(x.parts).filter(q => !q.ok).map(q => q.miss).join(', ')}`)); if (rep && !rep.app.ok) console.log('     app files: ' + rep.app.miss); }
  else ok(`downloaded in ${Math.round((Date.now() - t0) / 1000)} s: ${rep.days.length} days ready (${rep.days.reduce((a, x) => a + x.stories, 0)} pieces of audio, ${tileHits} map tiles, ${speakHits} recordings)`);
  const days = (rep ? rep.days : []).map(x => x.i);
  const planOnline = {}; for (const i of days) planOnline[i] = await O('plan', i);
  await p.evaluate(() => window.__kairouteGo('trip', 0)); await p.waitForTimeout(300);
  const readyTxt = await p.evaluate(() => (document.getElementById('offCard') || {}).textContent || '');
  if (!/Ready for offline/.test(readyTxt)) fail('the Trip screen does not say "Ready for offline": ' + readyTxt.slice(0, 160)); else ok('the Trip screen says "Ready for offline"');
  await p.evaluate(() => { const d = document.querySelector('#offCard details'); if (d) d.open = true; }); await p.waitForTimeout(100);
  await p.screenshot({ path: path.join(OUT, 'offline-ready.png') });
  // 3. Cut the internet. The website goes away too: everything must come from this device.
  await ctx.setOffline(true); await new Promise(r => srv.close(r)); srv.closeAllConnections && srv.closeAllConnections();
  await ctx.unrouteAll({ behavior: 'ignoreErrors' }); await ctx.route('**/*', r => r.abort('internetdisconnected'));
  await p.reload(); await p.waitForTimeout(1500);
  const opened = await p.evaluate(() => ({ app: !!document.querySelector('header.top'), online: navigator.onLine }));
  if (!opened.app) { fail('with no internet the app did not open from the device'); }
  else ok('with no internet (and no website), the app opens from the device');
  if (opened.online) fail('the browser still reports being online');
  await p.evaluate(() => window.__kairouteGo('plan', 0)); await p.waitForTimeout(300);
  let same = 0, maps = 0, rides = 0;
  for (const i of days) {
    const off = await O('plan', i);
    if (off !== planOnline[i]) { fail(`day ${i + 1}: the plan changed with no internet\n     online:  ${planOnline[i]}\n     offline: ${off}`); continue; }
    same++; if (/Train T1/.test(off)) rides++;
    await p.evaluate(i => window.__kairouteGo('plan', i), i);
    const t1 = Date.now(); let m;
    while (Date.now() - t1 < 15000) { m = await p.evaluate(() => window.__kairouteMap()); if (m.live && m.tiles) break; await p.waitForTimeout(250); }
    if (!m || !m.live || !m.tiles) fail(`day ${i + 1}: the street map did not draw from saved tiles (live ${m && m.live}, tiles ${m && m.tiles})`); else maps++;
    const ban = await p.evaluate(() => (document.getElementById('offBanner') || {}).textContent || '');
    if (ban) fail(`day ${i + 1}: a "not saved" banner shows on a saved day: ${ban}`);
  }
  if (same === days.length && days.length) ok(`with no internet: all ${same} days plan exactly the same (stops, meals, times; ${rides} days with real train/ferry rides)`);
  if (maps === days.length && days.length) ok(`with no internet: the street map draws from saved tiles on all ${maps} days`);
  await p.evaluate(() => window.__kairouteGo('plan', 6)); await p.waitForTimeout(800); await p.screenshot({ path: path.join(OUT, 'offline-dayplan-no-internet.png') });
  // 4. A stop's story plays in the saved natural voice.
  await p.evaluate(() => { window.__played = []; const pl = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { window.__played.push(String(this.src).slice(0, 5)); return pl.call(this).catch(() => {}); }; });
  const di = days.find(i => i > 0) ?? days[0];
  await p.evaluate(i => window.__kairouteGo('guide', i), di); await p.waitForTimeout(400);
  const playBtn = p.locator('#view [data-play]').first();
  if (!(await playBtn.count())) fail('no play button on the Guide');
  else { await playBtn.click(); await p.waitForTimeout(2500); const pl = await p.evaluate(() => window.__played);
    if (!pl.includes('blob:')) fail('with no internet the story did not play the saved natural voice (played: ' + pl.join(',') + ')'); else ok('with no internet, a stop\'s story plays in the saved natural voice'); }
  await p.evaluate(() => { const b = document.querySelector('[data-act="stop"], [data-play]'); });
  // 5. The Trip screen still says ready with no internet.
  await O('check'); await p.evaluate(() => window.__kairouteGo('trip', 0)); await p.waitForTimeout(300);
  const offTxt = await p.evaluate(() => (document.getElementById('offCard') || {}).textContent || '');
  if (!/Ready for offline/.test(offTxt)) fail('with no internet the Trip screen no longer says ready: ' + offTxt.slice(0, 200)); else ok('with no internet, the Trip screen still says "Ready for offline"');
  // 6. A day missing a piece is named, and the plan still works. (Remove one day's map tiles.)
  const gone = days.find(i => i > 0);
  await p.evaluate(async i => { const c = await caches.open('kairoute-maps-1'); const ks = await c.keys(); for (const k of ks) if (/\/planet\/test\//.test(k.url)) await c.delete(k); }, gone);
  await O('check'); await p.evaluate(i => window.__kairouteGo('plan', i), gone); await p.waitForTimeout(500);
  const ban = await p.evaluate(() => (document.getElementById('offBanner') || {}).textContent || '');
  if (!/No internet/.test(ban) || !/street map/.test(ban) || !/still work/.test(ban)) fail('a day with no saved map should say so and that the plan still works; banner: ' + ban); else ok('a day missing its map says so with no internet, and that the plan still works');
  await p.screenshot({ path: path.join(OUT, 'offline-missing-map.png') });
  // 7. A free trip counts only its first day; the rest show as unlocking with a trip pass.
  await p.evaluate(() => window.__kairouteOffline.setPass('free')); const fr = await O('check');
  const lockedRows = await p.evaluate(() => { window.__kairouteGo('trip', 0); return document.querySelectorAll('#offCard li.lock').length; });
  if (!fr || fr.days.length !== 1) fail(`a free trip should check only its first day, checked ${fr ? fr.days.length : 0}`); else if (!lockedRows) fail('a free trip should list the other days as unlocking with a trip pass'); else ok(`a free trip counts only its first day (${lockedRows} days shown as unlocking with a trip pass)`);
  await p.evaluate(() => window.__kairouteOffline.setPass(undefined));
  if (errs.length) fail('page errors: ' + [...new Set(errs)].join(' | '));
  await b.close();
  console.log(fails ? `Offline check: ${fails} problem(s)` : 'Offline check passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
