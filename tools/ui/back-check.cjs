// Phone Back button check (Nov 23 2026, client feel test). A traveler moves through the app with taps, then presses the
// phone's Back button (history back) again and again. Each press must show the screen before, inside the app, in
// reverse order, and the trip must be unchanged; only Back from the first screen may leave the app.
// Found: the app never told the browser about screen changes, so Back from ANY screen closed Kairoute.
// Also: one tap that redraws several times is one Back step; Back then a new tap works; reload keeps working.
// Usage: node tools/ui/back-check.cjs [beta2-site/index.html]. Exit 1 on a failure. No internet, no AI.
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'beta2-site/index.html'), ROOT = path.join(__dirname, '..', '..');
function serve(file) { const dir = path.dirname(file), name = path.basename(file);
  return new Promise(res => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); let f = path.join(dir, u === '/' ? name : u);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
    s.listen(0, () => res({ url: 'http://localhost:' + s.address().port + '/', close: () => { s.closeAllConnections && s.closeAllConnections(); s.close(); } })); }); }
(async () => {
  const srv = await serve(FILE); const b = await chromium.launch(); let fails = 0, passes = 0;
  const ok = (c, m) => { if (c) { passes++; console.log('PASS ' + m); } else { fails++; console.log('FAIL ' + m); } };
  for (const size of [{ width: 412, height: 915 }, { width: 1280, height: 800 }]) {
    const ctx = await b.newContext({ viewport: size, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await ctx.route(u => !/^http:\/\/localhost/.test(String(u)), r => r.fulfill({ status: 503, body: '' }));
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(srv.url); await p.waitForTimeout(3000);
    const sk = p.locator('[data-act=coachskip]'); if (await sk.first().isVisible().catch(() => false)) await sk.first().tap();
    const where = () => p.evaluate(() => { const s = window.__kairouteState ? window.__kairouteState() : {}; const t = document.querySelector('#dayChips [data-day][aria-pressed=true], [data-day][aria-pressed=true]'); return (s.view || '?') + '|' + (s.view === 'lobby' ? '' : (t ? t.dataset.day : '')); }).catch(() => 'gone');
    const tripSig = () => p.evaluate(() => JSON.stringify((window.__kairouteDays ? window.__kairouteDays() : []).map(d => [d.type, d.date, (d.sites || []).length])));
    const steps = []; const go = async (loc) => { await loc.first().tap(); await p.waitForTimeout(900); const w = await where(); if (w !== steps[steps.length - 1]) steps.push(w); };
    steps.push(await where());
    await go(p.locator('[data-act=continue]'));                          // the trip
    const dd = await p.locator('[data-day]').count(); const d2 = Math.min(5, Math.max(0, dd - 1));
    await p.locator(`[data-day="${d2}"]`).first().scrollIntoViewIfNeeded(); await go(p.locator(`[data-day="${d2}"]`));
    await go(p.locator('button, a').filter({ hasText: /^\s*Choose sights\s*$/ }));
    await go(p.locator('button').filter({ hasText: /^\s*Guide\s*$/ }));
    await go(p.locator('button').filter({ hasText: /^\s*Trip\s*$/ }));
    const sig0 = await tripSig();
    console.log(size.width + 'px screens: ' + steps.join(' > '));
    for (let k = steps.length - 2; k >= 0; k--) { await p.goBack({ timeout: 5000 }).catch(() => {}); await p.waitForTimeout(800); const w = await where();
      ok(w === steps[k] && /localhost/.test(p.url()), `${size.width}px Back #${steps.length - 1 - k}: expected ${steps[k]}, saw ${w}`); }
    ok(await tripSig() === sig0, `${size.width}px Back changed nothing in the trip`);
    // After going back, a new tap still works and Back still returns.
    if (!/localhost/.test(p.url())) { await p.goto(srv.url); await p.waitForTimeout(2500); }
    await go(p.locator('[data-act=continue]')); await p.goBack().catch(() => {}); await p.waitForTimeout(800);
    ok(/localhost/.test(p.url()) && (await where()) === steps[0], `${size.width}px Back after a new tap returns to ${steps[0]}`);
    ok(!errs.length, `${size.width}px no app errors${errs.length ? ': ' + errs[0] : ''}`);
    await ctx.close();
  }
  await b.close(); srv.close(); console.log(`Back button: ${passes} passed, ${fails} failed`); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL harness', e); process.exit(1); });
