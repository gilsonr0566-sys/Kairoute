// Freeze probe: uses the app the way a traveler does, with the real internet (guide helper, maps, rides) and a
// mid-range phone or tablet's speed, and reports every freeze (a stretch over 100 ms when the screen can't respond),
// what the traveler was doing at the time, how long each tap took to show, and which parts of the app were busy.
// Usage: node tools/freeze-probe.cjs <site-url | site-folder> [--cpu 4] [--device phone|tablet] [--out file.json]
const { chromium, devices } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const TARGET = process.argv[2] || path.join(__dirname, '..');
const CPU = +arg('--cpu', 4), DEV = arg('--device', 'phone'), OUT = arg('--out', '');
// --record file.json.gz: keep every internet answer (not map tiles) so later runs can replay the same day exactly.
// --replay file.json.gz: answer from that recording instead of the internet (map tiles are left out).
const REC = arg('--record', ''), REP = arg('--replay', '');
// --gate: fail (exit 1) when the visit froze too long: any one freeze over --max-freeze ms (default 2000), all freezes
// over 100 ms adding up to more than --max-total ms (default 60000), or the Day plan re-planning or redrawing while left alone.
const GATE = process.argv.includes('--gate'), MAXF = +arg('--max-freeze', 2000), MAXT = +arg('--max-total', 60000);
const zlib = require('zlib');
const netKey = (m, u, pd) => m + ' ' + u + (pd ? ' ' + require('crypto').createHash('md5').update(pd).digest('hex') : '');
const isTile = u => /tiles\.openfreemap|\/fonts\/|\.pbf(\?|$)|\/sprites?\//.test(u);
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
  const ctx = await b.newContext({ ...opts, ...(REC || REP ? { serviceWorkers: 'block' } : {}) });
  await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {}
    window.__lt = []; window.__step = 'opening';
    try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push({ at: Math.round(e.startTime), ms: Math.round(e.duration), step: window.__step }))).observe({ type: 'longtask', buffered: true }); } catch (e) {} });
  const own = u => u.startsWith(URL);
  const recd = new Map();
  if (REP) { const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(REP)).toString()); const byPath = new Map();
    rows.forEach(r => { recd.set(r.k, r); const pk = r.m + ' ' + r.u.split('?')[0]; if (!byPath.has(pk)) byPath.set(pk, r); });
    let miss = 0;
    await ctx.route(u => !own(u.href), async rt => { const q = rt.request(), u = q.url();
      if (isTile(u)) return rt.abort();
      const r = recd.get(netKey(q.method(), u, q.postData())) || (q.method() === 'GET' ? byPath.get('GET ' + u.split('?')[0]) : null); // a question never asked while recording fails, like a dropped signal
      if (!r) { if (++miss <= 20) console.log('replay: no answer for ' + q.method() + ' ' + u.slice(0, 140)); return rt.abort(); }
      await new Promise(z => setTimeout(z, Math.min(r.t || 100, 3000)));
      rt.fulfill({ status: r.s, headers: { 'content-type': r.ct || 'application/json', 'access-control-allow-origin': '*' }, body: Buffer.from(r.b, 'base64') }); });
    console.log(`Replaying ${rows.length} recorded internet answers from ${REP}`); }
  const p = await ctx.newPage(); const errs = [];
  const recRows = [];
  if (REC) { const t0s = new Map(); p.on('request', q => t0s.set(q, Date.now()));
    p.on('response', async r => { const q = r.request(), u = q.url(); if (own(u) || isTile(u) || u.startsWith('data:')) return;
      try { const b = await r.body(); recRows.push({ k: netKey(q.method(), u, q.postData()), m: q.method(), u, s: r.status(), ct: r.headers()['content-type'] || '', t: Date.now() - (t0s.get(q) || Date.now()), b: b.toString('base64') }); } catch (e) {} }); } p.on('pageerror', e => errs.push(e.message));
  let reqs = 0; const reqKinds = new Map(); p.on('request', r => { reqs++; let k; try { const u = new (require('url').URL)(r.url()); k = u.host + u.pathname.replace(/\/[^/]*\d[^/]*/g, '/#').split('/').slice(0, 3).join('/'); } catch (e) { k = 'other'; } reqKinds.set(k, (reqKinds.get(k) || 0) + 1); });
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
    await step('Naples: open Choose sights'); await tap('[data-goto="sites"]', 'open Choose sights'); await p.waitForTimeout(3000);
    await step('Naples: scroll the Sights list'); for (let k = 0; k < 8; k++) { await p.mouse.wheel(0, 600); await p.waitForTimeout(250); }
    for (let k = 0; k < 3; k++) { await step('Naples: tick a sight'); await tap('input[data-site]', 'tick a sight', k); await p.waitForTimeout(1500); }
    await step('Naples: back to Day plan, waiting (10 s)'); await tap('.tab[data-view="plan"]', 'back to Day plan'); await p.waitForTimeout(10000);
  }
  await step('Trip screen'); await tap('.tab[data-view="trip"]', 'open Trip screen'); await p.waitForTimeout(3000);
  await step('Guide'); await tap('.tab[data-view="guide"]', 'open Guide'); await p.waitForTimeout(5000);
  // Sitting still: the Day plan left alone for 60 s should make no plans and no redraws.
  await step('Day plan, left alone (60 s)'); await tap('.tab[data-view="plan"]', 'back to Day plan'); await p.waitForTimeout(10000);
  const i0 = await p.evaluate(() => window.__kairoutePlanStat ? window.__kairoutePlanStat() : null); await p.waitForTimeout(60000);
  const i1 = await p.evaluate(() => window.__kairoutePlanStat ? window.__kairoutePlanStat() : null);
  const idle = i0 && i1 ? `${i1.built - i0.built} new plans, ${i1.renders - i0.renders} redraws, ${i1.dataGen - i0.dataGen} internet answers` : 'not measured (older app)';
  const lt = await p.evaluate(() => window.__lt);
  const pEnd = await p.evaluate(() => performance.now());
  const { profile } = await cdp.send('Profiler.stop');
  // Busy time by function (inclusive), over the whole visit.
  const byId = new Map(profile.nodes.map(n => [n.id, n])), parent = new Map(); profile.nodes.forEach(n => (n.children || []).forEach(c => parent.set(c, n.id)));
  const cnt = new Map(); profile.samples.forEach((s, i) => cnt.set(s, (cnt.get(s) || 0) + (profile.timeDeltas[i] || 0)));
  const incl = new Map(), self = new Map();
  for (const [id, t] of cnt) { const n = byId.get(id); const nm = f => (f.callFrame.functionName || '(anonymous)') + ':' + (f.callFrame.lineNumber + 1);
    if (/^\((idle|program|garbage collector|root)\)/.test(n.callFrame.functionName)) continue;
    self.set(nm(n), (self.get(nm(n)) || 0) + t); const seen = new Set(); let cur = id;
    while (cur) { const m = byId.get(cur), k = nm(m); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + t); } cur = parent.get(cur); } }
  // What each long freeze was doing: the app functions busiest inside its time window (page clock lined up with the
  // profile at the moment it stopped, so a few ms off at most).
  const sampleAt = []; { let t = profile.startTime; profile.samples.forEach((sid, i) => { t += profile.timeDeltas[i] || 0; sampleAt.push([pEnd - (profile.endTime - t) / 1000, sid, profile.timeDeltas[i] || 0]); }); }
  const inside = x => { const m = new Map(); sampleAt.forEach(([at, sid, dt]) => { if (at < x.at || at > x.at + x.ms) return; const seen = new Set(); let cur = sid;
      while (cur) { const n = byId.get(cur), fnm = n.callFrame.functionName; if (fnm && !/^\(/.test(fnm) && !seen.has(fnm)) { seen.add(fnm); m.set(fnm, (m.get(fnm) || 0) + dt); } cur = parent.get(cur); } });
    return [...m].sort((a, c) => c[1] - a[1]).slice(0, 8).map(([k, v]) => k + ' ' + Math.round(v / 1000)).join(', '); };
  const top = (m, n) => [...m].sort((a, c) => c[1] - a[1]).slice(0, n).map(([k, v]) => `${String(Math.round(v / 1000)).padStart(7)} ms  ${k}`);
  const big = lt.filter(x => x.ms >= 100), byStep = {};
  big.forEach(x => { const s = byStep[x.step] || (byStep[x.step] = { n: 0, total: 0, worst: 0 }); s.n++; s.total += x.ms; s.worst = Math.max(s.worst, x.ms); });
  console.log(`\nFreeze probe: ${URL} as a ${DEV}, CPU slowed ${CPU}x, real internet. App ready in ${ready} ms. ${reqs} requests.`);
  console.log(`Freezes over 100 ms: ${big.length}, ${big.reduce((a, x) => a + x.ms, 0)} ms in all; over 300 ms: ${big.filter(x => x.ms >= 300).length}; longest ${Math.max(0, ...big.map(x => x.ms))} ms`);
  console.log('Requests by kind: ' + [...reqKinds].sort((a, c) => c[1] - a[1]).slice(0, 10).map(([k, v]) => k + ' ' + v).join(', '));
  console.log('Left alone on the Day plan for 60 s: ' + idle);
  console.log('\nBy what the traveler was doing (count, total, longest):');
  Object.entries(byStep).forEach(([k, v]) => console.log(`  ${k.padEnd(48)} ${String(v.n).padStart(3)} ${String(v.total).padStart(6)} ms ${String(v.worst).padStart(6)} ms`));
  console.log('\nFreezes over 250 ms, and what the app was busy with (ms):');
  lt.filter(x => x.ms >= 250).forEach(x => console.log(`  ${String(x.ms).padStart(5)} ms at ${(x.at / 1000).toFixed(1)} s  [${x.step}]  ${inside(x)}`));
  console.log('\nTaps (ms until the screen showed the result):'); taps.forEach(t => console.log(`  ${t.label.padEnd(40)} ${t.ms}`));
  console.log('\nBusiest parts of the app (inclusive):\n' + top(incl, 45).join('\n'));
  console.log('\nBusiest single functions (self):\n' + top(self, 25).join('\n'));
  if (errs.length) console.log('\nPage errors:\n' + [...new Set(errs)].slice(0, 10).join('\n'));
  if (REC) { fs.writeFileSync(REC, zlib.gzipSync(JSON.stringify(recRows))); console.log(`Recorded ${recRows.length} internet answers to ${REC} (${Math.round(fs.statSync(REC).size / 1024)} KB)`); }
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ URL, DEV, CPU, ready, lt, taps, incl: top(incl, 80), self: top(self, 40) }, null, 1));
  await b.close(); if (server) server.close();
  if (GATE) { const longest = Math.max(0, ...big.map(x => x.ms)), total = big.reduce((a, x) => a + x.ms, 0), probs = [];
    if (longest > MAXF) probs.push(`longest freeze ${longest} ms (limit ${MAXF})`);
    if (total > MAXT) probs.push(`frozen ${total} ms in all (limit ${MAXT})`);
    if (i0 && i1 && (i1.built - i0.built || i1.renders - i0.renders)) probs.push(`left alone, the Day plan made ${i1.built - i0.built} plans and ${i1.renders - i0.renders} redraws (must be 0)`);
    console.log(probs.length ? 'FAIL freeze gate: ' + probs.join('; ') : `Freeze gate passed (longest ${longest} ms, ${total} ms in all, idle page still)`);
    process.exit(probs.length ? 1 : 0); }
})();
