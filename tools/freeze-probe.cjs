// Freeze probe: uses the app the way a traveler does, with the real internet (guide helper, maps, rides) and a
// mid-range phone or tablet's speed, and reports every freeze (a stretch over 100 ms when the screen can't respond),
// what the traveler was doing at the time, how long each tap took to show, and which parts of the app were busy.
// Usage: node tools/freeze-probe.cjs <site-url | site-folder> [--cpu 4] [--device phone|tablet] [--out file.json]
const { chromium, devices } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const TARGET = process.argv[2] || path.join(__dirname, '..');
const CPU = +arg('--cpu', 4), DEV = arg('--device', 'phone'), OUT = arg('--out', '');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.wasm': 'application/wasm' };
(async () => {
  let URL = TARGET, server = null;
  if (!/^https?:/.test(TARGET)) { const ROOT = path.resolve(TARGET);
    server = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
      fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); }); });
    await new Promise(r => server.listen(0, r)); URL = `http://127.0.0.1:${server.address().port}/`; }
  URL = URL.replace(/\/?$/, '/');
  const b = await chromium.launch();
  const opts = DEV === 'tablet' ? { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { ...devices['Galaxy S9+'], viewport: { width: 412, height: 860 } };
  const ctx = await b.newContext(opts);
  await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {}
    window.__lt = []; window.__step = 'opening';
    try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push({ at: Math.round(e.startTime), ms: Math.round(e.duration), step: window.__step }))).observe({ type: 'longtask', buffered: true }); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  let reqs = 0; p.on('request', () => reqs++);
  const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 80, downloadThroughput: 20e6 / 8, uploadThroughput: 5e6 / 8 });
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
  const step = s => p.evaluate(x => { window.__step = x; }, s).catch(() => {});
  const taps = [];
  // A real tap; the time until the next frame is painted after the browser handled it.
  const tap = async (sel, label, i = 0) => {
    const loc = p.locator(sel).nth(i); if (!(await loc.count())) return;
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    await p.evaluate(() => { window.__tapT = performance.now(); window.__tapDone = 0; addEventListener('click', () => requestAnimationFrame(() => setTimeout(() => { window.__tapDone = performance.now() - window.__tapT; }, 0)), { once: true, capture: true }); });
    await loc.tap({ timeout: 15000 }).catch(() => loc.click({ timeout: 15000 }).catch(() => {}));
    await p.waitForFunction(() => window.__tapDone > 0, null, { timeout: 30000 }).catch(() => {});
    taps.push({ label, ms: Math.round(await p.evaluate(() => window.__tapDone || -1)) });
  };
  const t0 = Date.now();
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.__kairouteDays && document.querySelector('#view') && document.querySelector('#view').children.length, null, { timeout: 60000 });
  const ready = Date.now() - t0;
  await step('lobby, waiting'); await p.waitForTimeout(3000);
  await step('open the trip'); const cont = p.getByText(/Continue trip|Open trip|Continue/).first(); if (await cont.count()) await cont.tap().catch(() => {}); else await p.evaluate(() => window.__kairouteGo('plan', 0));
  await step('Day plan, data arriving (20 s)'); await p.waitForTimeout(20000);
  const days = await p.evaluate(() => window.__kairouteDays());
  const chips = await p.locator('.daychip').count();
  for (let i = 1; i < chips; i++) { await step(`switch to day ${i + 1} (${(days[i] || {}).dest || ''})`); await tap('.daychip', `day ${i + 1} ${(days[i] || {}).dest || ''}`, i); await p.waitForTimeout(1500); }
  const port = days.find(d => /naples/i.test(d.dest)) || days.find(d => d.type === 'port');
  if (port) {
    await step('Naples day'); await tap('.daychip', `back to ${port.dest}`, port.i); await p.waitForTimeout(8000);
    await step('Naples: scroll the Day plan'); for (let k = 0; k < 6; k++) { await p.mouse.wheel(0, 500); await p.waitForTimeout(250); }
    await step('Naples: open Change stops'); await tap('[data-goto="sites"]', 'open Change stops'); await p.waitForTimeout(3000);
    await step('Naples: scroll the Sights list'); for (let k = 0; k < 8; k++) { await p.mouse.wheel(0, 600); await p.waitForTimeout(250); }
    for (let k = 0; k < 3; k++) { await step('Naples: tick a sight'); await tap('input[data-site]', 'tick a sight', k); await p.waitForTimeout(1500); }
    await step('Naples: back to Day plan, waiting (10 s)'); await tap('.tab[data-view="plan"]', 'back to Day plan'); await p.waitForTimeout(10000);
  }
  await step('Trip screen'); await tap('.tab[data-view="trip"]', 'open Trip screen'); await p.waitForTimeout(3000);
  await step('Guide'); await tap('.tab[data-view="guide"]', 'open Guide'); await p.waitForTimeout(5000);
  const lt = await p.evaluate(() => window.__lt);
  const { profile } = await cdp.send('Profiler.stop');
  // Busy time by function (inclusive), over the whole visit.
  const byId = new Map(profile.nodes.map(n => [n.id, n])), parent = new Map(); profile.nodes.forEach(n => (n.children || []).forEach(c => parent.set(c, n.id)));
  const cnt = new Map(); profile.samples.forEach((s, i) => cnt.set(s, (cnt.get(s) || 0) + (profile.timeDeltas[i] || 0)));
  const incl = new Map(), self = new Map();
  for (const [id, t] of cnt) { const n = byId.get(id); const nm = f => (f.callFrame.functionName || '(anonymous)') + ':' + (f.callFrame.lineNumber + 1);
    if (/^\((idle|program|garbage collector|root)\)/.test(n.callFrame.functionName)) continue;
    self.set(nm(n), (self.get(nm(n)) || 0) + t); const seen = new Set(); let cur = id;
    while (cur) { const m = byId.get(cur), k = nm(m); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + t); } cur = parent.get(cur); } }
  const top = (m, n) => [...m].sort((a, c) => c[1] - a[1]).slice(0, n).map(([k, v]) => `${String(Math.round(v / 1000)).padStart(7)} ms  ${k}`);
  const big = lt.filter(x => x.ms >= 100), byStep = {};
  big.forEach(x => { const s = byStep[x.step] || (byStep[x.step] = { n: 0, total: 0, worst: 0 }); s.n++; s.total += x.ms; s.worst = Math.max(s.worst, x.ms); });
  console.log(`\nFreeze probe: ${URL} as a ${DEV}, CPU slowed ${CPU}x, real internet. App ready in ${ready} ms. ${reqs} requests.`);
  console.log(`Freezes over 100 ms: ${big.length}, ${big.reduce((a, x) => a + x.ms, 0)} ms in all; over 300 ms: ${big.filter(x => x.ms >= 300).length}; longest ${Math.max(0, ...big.map(x => x.ms))} ms`);
  console.log('\nBy what the traveler was doing (count, total, longest):');
  Object.entries(byStep).forEach(([k, v]) => console.log(`  ${k.padEnd(48)} ${String(v.n).padStart(3)} ${String(v.total).padStart(6)} ms ${String(v.worst).padStart(6)} ms`));
  console.log('\nTaps (ms until the screen showed the result):'); taps.forEach(t => console.log(`  ${t.label.padEnd(40)} ${t.ms}`));
  console.log('\nBusiest parts of the app (inclusive):\n' + top(incl, 45).join('\n'));
  console.log('\nBusiest single functions (self):\n' + top(self, 25).join('\n'));
  if (errs.length) console.log('\nPage errors:\n' + [...new Set(errs)].slice(0, 10).join('\n'));
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ URL, DEV, CPU, ready, lt, taps, incl: top(incl, 80), self: top(self, 40) }, null, 1));
  await b.close(); if (server) server.close();
})();
