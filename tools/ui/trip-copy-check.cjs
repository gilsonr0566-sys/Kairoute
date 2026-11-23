// Trips planned in the first app come over to Beta 2 on the same device (Richard, Nov 23 2026: yes). Checks, offline:
//  1. a phone that never opened Beta 2: the first app's trip is in Beta 2's trip list; the example trip is not doubled;
//  2. a phone that already used Beta 2 (its own trip open): the first app's trip is ADDED, Beta 2's open trip stays open
//     and unchanged, and opening again adds nothing twice;
//  3. the first app's own saved trips are never changed.
// Usage: node tools/ui/trip-copy-check.cjs [beta2-site/index.html]
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'beta2-site/index.html');
const serve = f => new Promise(res => { const dir = path.dirname(f); const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(dir, u === '/' ? path.basename(f) : u); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'text/plain' }); fs.createReadStream(p).pipe(r); }); s.listen(0, () => res({ url: 'http://localhost:' + s.address().port + '/', close: () => s.close() })); });
const fails = []; const ok = (c, m) => { if (!c) fails.push(m); };
(async () => {
  const s = await serve(FILE); const b = await chromium.launch();
  const page = async seed => { const ctx = await b.newContext({ viewport: { width: 412, height: 915 } }); await ctx.route(u => !/^http:\/\/localhost/.test(String(u)), r => r.fulfill({ status: 503, body: '' }));
    if (seed) await ctx.addInitScript(o => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear(); for (const k in o) localStorage.setItem(k, o[k]); }, seed);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); await p.goto(s.url); await p.waitForTimeout(3000); return { ctx, p, errs }; };
  // A real trip object, from the app itself (its example trip), renamed into two trips of a traveler's own.
  const z = await page(null); const ex = JSON.parse(await z.p.evaluate(() => window.localStorage.getItem('wayside.trip2') || 'null')); await z.ctx.close();
  if (!ex) { console.log('FAIL\ncould not read a trip to copy'); process.exit(1); }
  const mk = (id, name) => Object.assign(JSON.parse(JSON.stringify(ex)), { id, name, sample: false });
  const A = mk('t-first-app', 'Trip from the first app'), B = mk('t-beta2-own', 'My Beta 2 trip');
  const first = { 'wayside.trip2': JSON.stringify(A), 'wayside.library': JSON.stringify([{ id: A.id, name: A.name, updated: 1, trip: A }]) };
  const lib = p => p.evaluate(() => { const L = JSON.parse(window.localStorage.getItem('wayside.library') || '[]'); const t = JSON.parse(window.localStorage.getItem('wayside.trip2') || 'null'); return { ids: L.map(x => x.id), open: t && t.id, openName: t && t.name }; });
  // 1. never opened Beta 2
  let r = await page(first), L = await lib(r.p);
  ok(L.ids.includes(A.id), '1: the first app\'s trip is not in Beta 2\'s trip list: ' + JSON.stringify(L));
  ok(L.ids.filter(x => x === A.id).length === 1, '1: the trip is listed twice');
  ok(!r.errs.length, '1: page errors ' + r.errs.join(' | ').slice(0, 200)); await r.ctx.close();
  // 2. already used Beta 2 with its own trip open
  const used = Object.assign({}, first, { 'b2:__copied': '1', 'b2:kairoute.sunprincess1': '1', 'b2:kairoute.bible1': '1', 'b2:wayside.trip2': JSON.stringify(B), 'b2:wayside.library': JSON.stringify([{ id: B.id, name: B.name, updated: 2, trip: B }]) });
  r = await page(used); L = await lib(r.p);
  ok(L.ids.includes(A.id) && L.ids.includes(B.id), '2: both trips should be in the list: ' + JSON.stringify(L));
  ok(L.open === B.id && L.openName === B.name, '2: Beta 2\'s open trip changed to ' + L.open);
  await r.p.reload(); await r.p.waitForTimeout(2500); const L2 = await lib(r.p);
  ok(L2.ids.filter(x => x === A.id).length === 1, '2: opening again copied the trip twice: ' + JSON.stringify(L2.ids));
  // 3. the first app's own keys are untouched
  const firstTrip = await r.ctx.storageState(); const o = (firstTrip.origins[0] || { localStorage: [] }).localStorage.reduce((m, x) => (m[x.name] = x.value, m), {});
  ok(o['wayside.trip2'] === first['wayside.trip2'] && o['wayside.library'] === first['wayside.library'], '3: the first app\'s saved trips were changed');
  ok(!r.errs.length, '2: page errors ' + r.errs.join(' | ').slice(0, 200)); await r.ctx.close();
  await b.close(); s.close();
  if (fails.length) { console.log('FAIL\n' + fails.join('\n')); process.exit(1); } console.log('PASS trip-copy check');
})();
