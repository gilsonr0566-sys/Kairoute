// UI review shots: opens the built Beta 2 app with the sample trip (no internet, no AI) at phone and tablet sizes
// and saves pictures of the screens the outside review looked at. Usage: node tools/ui/shots.cjs <index.html> <outdir> [tag]
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'beta2-site/index.html'), OUT = path.resolve(process.argv[3] || 'shots'), TAG = process.argv[4] || '';
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
fs.mkdirSync(OUT, { recursive: true });
function serve(file) { const dir = path.dirname(file), name = path.basename(file);
  return new Promise(res => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? name : u);
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
    s.listen(0, () => res({ url: 'http://localhost:' + s.address().port + '/' + name, close: () => s.close() })); }); }
const SIZES = { phone: { width: 412, height: 915, isMobile: true, hasTouch: true }, tablet: { width: 1280, height: 800 }, upright: { width: 800, height: 1280, hasTouch: true } };
async function open(browser, url, size) {
  const ctx = await browser.newContext(Object.assign({ deviceScaleFactor: +process.env.DSF || 1, timezoneId: 'America/Chicago' }, SIZES[size], { viewport: { width: SIZES[size].width, height: SIZES[size].height } }));
  const p = await ctx.newPage(); p.on('pageerror', e => console.error('pageerror', String(e).slice(0, 200)));
  await p.route(u => !/^http:\/\/localhost/.test(String(u)), r => r.fulfill({ status: 503, body: '' }));
  await p.goto(url); await p.waitForTimeout(2500);
  const sample = p.locator('[data-act="loadsample"]').first(); if (await sample.isVisible().catch(() => false)) await sample.click();
  await p.waitForTimeout(5000);
  for (let k = 0; k < 5; k++) { const sk = p.locator('.coach button:has-text("Skip")').first(); if (await sk.isVisible().catch(() => false)) await sk.click(); else break; }
  return { p, ctx };
}
const dayOf = (p, re) => p.evaluate(src => window.__kairouteDays().findIndex(d => new RegExp(src, 'i').test(d.dest)), re);
async function go(p, view, re) { const i = re ? await dayOf(p, re) : -1; await p.evaluate(([v, i]) => { if (i >= 0) window.__kairouteGo('day', i); window.__kairouteGo(v); }, [view, i]); await p.waitForTimeout(1500); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300); }
const SHOTS = [
  ['home', 'lobby'], ['trip', 'trip'],
  ['plan-barcelona', 'plan', 'Barcelona'], ['sites-barcelona', 'sites', 'Barcelona'],
  ['plan-mykonos', 'plan', 'Mykonos'], ['plan-rome', 'plan', 'Rome|Civitavecchia'],
  ['journal', 'journal'], ['tour-barcelona', 'tour', 'Barcelona'],
];
(async () => {
  const srv = await serve(FILE); const browser = await chromium.launch();
  for (const size of (process.env.SIZES || 'phone,tablet').split(',')) {
    const { p, ctx } = await open(browser, srv.url, size);
    for (const [name, view, re] of SHOTS) { if (ONLY && !ONLY.test(name)) continue;
      try { await go(p, view, re || null); } catch (e) { console.error(name, e.message); continue; }
      const f = path.join(OUT, `${name}-${size}${TAG ? '-' + TAG : ''}.png`); await p.screenshot({ path: f });
      if (process.env.TEXT) fs.writeFileSync(f.replace(/\.png$/, '.txt'), await p.evaluate(() => document.body.innerText));
      console.log('saved', f); }
    await ctx.close(); }
  await browser.close(); srv.close();
})();
