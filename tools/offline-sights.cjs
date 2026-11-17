// Offline sights check: with the real source snapshots in tools/fixtures/src-*.json (and a stand-in AI that writes in
// any famous place a guide lacks), every city of the example trip lists the same sights online and after reopening
// with no internet. Camp Nou (Barcelona) and the Bernabéu (Madrid) must be there both ways (they went missing offline,
// Nov 16). No network, no cost. Usage: node tools/offline-sights.cjs   (DAYS, W: days to visit, ms per day)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const http = require('http');
const ROOT = path.resolve(path.join(__dirname, '..'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/json', '.txt': 'text/plain' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  if (q.url.split('?')[0] === '/ai.json') { r.writeHead(200, { 'content-type': 'application/json' }); return r.end(JSON.stringify({ url: 'http://localhost:9/w' })); }
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
const fx = {}; for (const f of fs.readdirSync(path.join(__dirname, 'fixtures')).filter(f => /^src-.*\.json$/.test(f))) { const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', f))); fx[f.replace(/^src-|\.json$/g, '')] = j; }
const pick = c => { c = (c || '').toLowerCase(); const k = Object.keys(fx).find(k => c.includes(k.split('-')[0])); return k && fx[k]; };
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = `http://localhost:${srv.address().port}/`;
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route(/^https?:\/\/(?!localhost:\d{4,5}\/)/, async r => { const u = new URL(r.request().url()), p = u.pathname.replace(/^\/w/, '');
    if (u.hostname === 'localhost' && u.port === '9') { const c = u.searchParams.get('city');
      if (p === '/status') return r.fulfill({ json: { left: 5000, budget: 10000, voiceLeft: 5e7 } });
      if (p === '/famous') { const f = pick(c); return f ? r.fulfill({ json: f.famous }) : r.fulfill({ status: 404, json: {} }); }
      if (p === '/sources') { const f = pick(c); return f ? r.fulfill({ json: f.sources }) : r.fulfill({ status: 404, json: {} }); }
      if (p === '/sample') { const body = (() => { try { return JSON.parse(r.request().postData() || '{}'); } catch (e) { return {}; } })(), pr = body.prompt || '';
        if (/which the guide is missing/.test(pr)) { const n = (pr.match(/^\d+\. /mg) || []).length; return r.fulfill({ json: { text: JSON.stringify({ places: Array.from({ length: n }, (_, i) => ({ n: i + 1, minutes: 60, category: 'Landmark', summary: 'Test.', guide: 'You stand here.', lookFor: ['a', 'b', 'c'], photoTip: 'x', picks: [], hours: '9-17', closed: '', tickets: '', crowds: '', cost: 0, indoor: false, access: '' })) }) } }); } }
      return r.fulfill({ status: 503, json: { error: 'busy' } }); }
    return r.abort(); });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(base + 'index.html'); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1'));
  await p.evaluate(() => navigator.serviceWorker.ready); await p.reload(); await p.waitForTimeout(800);
  await p.getByText('Continue trip').click(); await p.waitForTimeout(400);
  const N = +(process.env.DAYS || 23);
  for (let i = 0; i < N; i++) { await p.evaluate(i => window.__kairouteGo('sites', i), i).catch(() => {}); await p.waitForTimeout(+(process.env.W || 1500)); }
  await p.waitForTimeout(3000);
  const on = await p.evaluate(() => window.__kairouteSights());
  await ctx.setOffline(true); await ctx.unrouteAll({ behavior: 'ignoreErrors' }); await ctx.route('**/*', r => r.abort('internetdisconnected'));
  srv.close(); srv.closeAllConnections && srv.closeAllConnections();
  await p.reload(); await p.waitForTimeout(1500);
  for (let i = 0; i < N; i++) { await p.evaluate(i => window.__kairouteGo('sites', i), i).catch(() => {}); await p.waitForTimeout(+(process.env.W || 1500)); }
  await p.waitForTimeout(3000);
  const off = await p.evaluate(() => window.__kairouteSights());
  let fails = 0; const must = { Barcelona: /camp nou/i, Madrid: /bernab/i };
  for (const k of Object.keys(on)) { const a = on[k].shown, o = (off[k] || {}).shown || [];
    const miss = a.filter(x => !o.includes(x)), extra = o.filter(x => !a.includes(x));
    if (process.env.V) console.log(k, JSON.stringify(a)); if (miss.length || extra.length) { fails++; console.log(`FAIL ${k}: ${a.length} sights online, ${o.length} offline. Missing offline: ${miss.join(', ') || '-'}; only offline: ${extra.join(', ') || '-'}`); }
    else console.log(`ok   ${k}: the same ${a.length} sights online and offline`);
    if (must[k]) for (const [tag, l] of [['online', a], ['offline', o]]) if (!l.some(n => must[k].test(n))) { fails++; console.log(`FAIL ${k}: ${must[k].source} is not in the sights list ${tag}`); } }
  console.log(fails ? fails + ' FAIL' : 'Offline sights check passed');
  await b.close(); process.exit(fails ? 1 : 0);
})();
