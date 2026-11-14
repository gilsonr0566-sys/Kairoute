// Speed check: opens the built app the way a phone and a tablet would (mid-range CPU, slowed 4x) and times what
// a traveler feels: how long until the app is usable, and how long each tap takes to show its result on the
// Day plan, the Sights list and when switching days (including the busiest port day). Fails if anything is
// slower than the limits below, so the app can't quietly get slow again.
// The slow-down is calibrated: a fixed bit of work is timed first, so a slower or faster test machine (GitHub's
// runners vary) is slowed to the same speed, about a quarter of a fast laptop.
// Usage: node tools/perf-check.cjs [path/to/site-folder] [--json out.json]   (env CPU=4 fixes the slow-down instead)
const { chromium, devices } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const ARG = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '';
const LIVE = /^https?:/.test(ARG) ? ARG.replace(/\/?$/, '/') : ''; // a web address: test the published site itself (real network)
const ROOT = path.resolve(!LIVE && ARG ? ARG : path.join(__dirname, '..'));
let CPU = +(process.env.CPU || 0);
const REF_MS = 240; // the calibration work on the machine the limits were set on, at full speed
// Limits (ms, at the calibrated speed). Google calls a tap response over 200 ms "needs improvement"; the limits
// leave room for test-machine noise but are far below the 400 to 900 ms taps (2 s at worst) measured before the
// speed work of Nov 13 2026.
const LIMIT = { ready: 2500, tap: 300, tapWorst: 900, freeze: 500, freezeAny: 600 }; // freezeAny: longest freeze anywhere while the traveler uses the app
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
const server = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); }); });
const SIZES = [['phone', { ...devices['Galaxy S9+'], viewport: { width: 412, height: 860 } }], ['tablet', { viewport: { width: 1280, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }]];
(async () => {
  let URL = LIVE; if (!LIVE) { await new Promise(r => server.listen(0, r)); URL = `http://127.0.0.1:${server.address().port}/`; }
  const b = await chromium.launch(); let fails = 0; const rows = [];
  if (!CPU) { const pg = await b.newPage(); await pg.setContent('<p>calibrating</p>'); const t = [];
    for (let k = 0; k < 7; k++) t.push(await pg.evaluate(() => { const s = performance.now(); let x = 0; const a = [];
      for (let i = 0; i < 300000; i++) { a.push({ lat: Math.sin(i), lng: Math.cos(i), k: 's' + (i % 100) }); x += Math.asin(Math.sqrt(Math.abs(Math.sin(i * 1e-3)))); }
      a.sort((p, q) => p.lat - q.lat); JSON.stringify(a.slice(0, 20000)); return performance.now() - s + x * 0; }));
    await pg.close(); t.sort((x, y) => x - y); const med = t[3];
    CPU = Math.max(1.5, Math.min(6, +(4 * REF_MS / med).toFixed(2))); console.log(`calibration: ${Math.round(med)} ms (reference ${REF_MS}), CPU slowed ${CPU}x`); }
  const fail = m => { fails++; console.log('FAIL ' + m); };
  for (const [name, opts] of SIZES) {
    const ctx = await b.newContext(opts);
    await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {}
      window.__lt = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => { window.__lt.push(e.duration); if (window.__ltOn) window.__ltRun.push(Math.round(e.duration)); })).observe({ type: 'longtask', buffered: true }); } catch (e) {} });
    const p = await ctx.newPage(); p.on('pageerror', e => fail(`${name}: page error ${e.message}`));
    // No outside network (maps tiles, fonts, AI): the check measures the app itself.
    await p.route('**/*', r => r.request().url().startsWith(URL) && !/sw\.js$/.test(r.request().url()) ? r.continue() : r.abort());
    const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    // The published site is also loaded over a phone connection (about 9 Mbit/s, 150 ms delay: decent 4G in port).
    if (LIVE) { await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 9e6 / 8, uploadThroughput: 3e6 / 8 }); }
    const t0 = Date.now();
    await p.goto(URL, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__kairouteDays && document.querySelector('#view') && document.querySelector('#view').children.length);
    await p.evaluate(() => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0))));
    const ready = Date.now() - t0;
    await p.waitForTimeout(1500);
    const loadLong = await p.evaluate(() => Math.round(window.__lt.reduce((a, x) => a + x, 0)));
    rows.push([name, 'App ready to use', ready, LIMIT.ready]); rows.push([name, '  busy time while opening (long tasks)', loadLong, null]);
    if (ready > LIMIT.ready) fail(`${name}: app took ${ready} ms to open (limit ${LIMIT.ready})`);
    const days = await p.evaluate(() => window.__kairouteDays());
    await p.evaluate(() => { window.__ltRun = []; window.__ltOn = true; }); // every freeze from here on counts
    // One tap = from the touch until the screen has painted the result.
    const tap = async (sel, label, idx = 0) => {
      const loc = p.locator(sel).nth(idx); if (!(await loc.count())) return null;
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      await p.evaluate(() => { window.__tapStart = 0; });
      const h = await loc.elementHandle();
      const ms = await p.evaluate(el => new Promise(res => { const s = performance.now();
        el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.click();
        requestAnimationFrame(() => setTimeout(() => res(Math.round(performance.now() - s)), 0)); }), h);
      await p.waitForTimeout(250); return ms;
    };
    await p.evaluate(() => window.__kairouteGo('plan', 0)); await p.waitForTimeout(400);
    const res = {};
    const add = (k, v) => { if (v == null) return; (res[k] = res[k] || []).push(v); };
    // Day switching across the whole trip (Day plan).
    const chips = await p.locator('.daychip').count();
    for (let i = 1; i < chips; i++) { const ms = await tap('.daychip', 'day', i); add('Switch day (Day plan)', ms); if (process.env.PERF_DEBUG) console.log(name, 'day', i + 1, days[i] && days[i].dest, ms); }
    // The busiest port day: Naples if the trip has it, otherwise the port day with the most stops.
    const port = days.find(d => /naples/i.test(d.dest)) || days.find(d => d.type === 'port') || days[0];
    await p.evaluate(i => window.__kairouteGo('plan', i), port.i); await p.waitForTimeout(400);
    for (let k = 0; k < 3; k++) { add(`Port day (${port.dest}): Light/Half/Full`, await tap('[data-act="dayfill"], [data-fill], .fillbtn', 'fill', k % 3)); }
    add(`Port day (${port.dest}): open Change stops`, await tap('[data-goto="sites"]', 'sites'));
    await p.waitForTimeout(300);
    for (let k = 0; k < 4; k++) add(`Port day (${port.dest}): tick a sight`, await tap('input[data-site]', 'site', k));
    for (let k = 0; k < 4; k++) add(`Port day (${port.dest}): tick a sight`, await tap('input[data-site]', 'site', k));
    for (let i = 1; i < Math.min(chips, 6); i++) add('Switch day (Sights list)', await tap('.daychip', 'day', i));
    // The Sights list checks what still fits in the background: it must never freeze the screen while it does.
    await p.evaluate(i => window.__kairouteGo('sites', i), port.i);
    await p.evaluate(() => { window.__lt = []; });
    await p.waitForFunction(() => !window.__kairouteFitPending || window.__kairouteFitPending() === 0, null, { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(300);
    const freeze = await p.evaluate(() => Math.round(Math.max(0, ...window.__lt)));
    rows.push([name, `Longest freeze while the Sights list checks what fits`, freeze, LIMIT.freeze]);
    if (freeze > LIMIT.freeze) fail(`${name}: the Sights list froze for ${freeze} ms while checking what fits (limit ${LIMIT.freeze})`);
    // Going back to days already seen (the usual way around a trip).
    await p.evaluate(() => window.__kairouteGo('plan', 0)); await p.waitForTimeout(300);
    for (let i = 1; i < chips; i++) add('Switch day again (days already seen)', await tap('.daychip', 'day', i));
    add('Back to Day plan', await tap('.tab[data-view="plan"], [data-goto="plan"]', 'plan'));
    add('Open Guide tab', await tap('.tab[data-view="guide"]', 'guide'));
    add('Open Trip tab', await tap('.tab[data-view="trip"]', 'trip'));
    // No freeze anywhere: whatever the app does in the background (answers arriving, the offline check, plans being
    // made ahead), the screen must never lock up for long.
    const longest = await p.evaluate(() => Math.max(0, ...window.__ltRun));
    rows.push([name, 'Longest freeze anywhere while using the app', longest, LIMIT.freezeAny]);
    if (longest > LIMIT.freezeAny) fail(`${name}: the screen froze for ${longest} ms (limit ${LIMIT.freezeAny})`);
    for (const [k, v] of Object.entries(res)) { const avg = Math.round(v.reduce((a, x) => a + x, 0) / v.length), worst = Math.max(...v);
      // A screen opened once (the Trip screen, which plans every day) is held to the worst-case limit.
      const lim = v.length > 1 ? LIMIT.tap : LIMIT.tapWorst;
      rows.push([name, v.length > 1 ? `${k} (avg of ${v.length}, worst ${worst})` : k, avg, lim]);
      if (avg > lim) fail(`${name}: "${k}" takes ${avg} ms on average (limit ${lim})`);
      if (worst > LIMIT.tapWorst) fail(`${name}: "${k}" took ${worst} ms at worst (limit ${LIMIT.tapWorst})`); }
    await ctx.close();
  }
  await b.close(); if (!LIVE) server.close();
  console.log(`\nSpeed check (CPU slowed ${CPU}x, like a mid-range phone; limits: tap ${LIMIT.tap} ms on average, ${LIMIT.tapWorst} ms at worst):`);
  for (const [n, k, v, lim] of rows) console.log(`${n.padEnd(7)} ${k.padEnd(62)} ${String(v).padStart(6)} ms${lim ? (v > lim ? '  OVER ' + lim : '') : ''}`);
  if (process.argv.includes('--json')) { const out = process.argv[process.argv.indexOf('--json') + 1]; fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); } if (process.argv.includes('--json')) fs.writeFileSync(process.argv[process.argv.indexOf('--json') + 1], JSON.stringify(rows));
  if (fails) { console.log(`perf-check: ${fails} problem(s)`); process.exit(1); }
  console.log('perf-check: all good');
})();
