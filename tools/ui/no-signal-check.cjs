// A place the app could not ask about is never called misspelled (first-time traveler walk, Nov 22, 2026).
// A new traveler builds a trip while the travel guides and maps can't be reached (helper's address unknown, or the helper down / no signal): the message
// must say it couldn't reach them and the trip is saved, never "check the spelling". Then the same trip with the helper
// answering "nothing known" must still say "check the spelling". Offline, no AI. Usage: node tools/ui/no-signal-check.cjs [beta2-site/index.html]
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'beta2-site/index.html');
const serve = f => new Promise(res => { const dir = path.dirname(f); const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(dir, u === '/' ? path.basename(f) : u); if (u === '/ai.json' && serve.addr) { r.writeHead(200, { 'content-type': 'application/json' }); return r.end('{"url":"https://kairoute-ai.rickgilson.workers.dev"}'); } if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'text/plain' }); fs.createReadStream(p).pipe(r); }); s.listen(0, () => res({ url: 'http://localhost:' + s.address().port + '/', close: () => s.close() })); });
const fails = [];
async function run(b, url, mode) { serve.addr = mode !== 'noaddr';
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: process.env.SHOT ? 2 : 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
  await ctx.route(u => !/^http:\/\/localhost/.test(String(u)), r => {
    const u = new URL(r.request().url());
    if (/workers\.dev/.test(u.hostname) && u.pathname === '/status') return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true,"on":false}' });
    if (mode === 'unknown' && /workers\.dev/.test(u.hostname) && u.pathname === '/sources') return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"stops":[]}' });
    if (mode === 'slow' && /workers\.dev/.test(u.hostname) && u.pathname === '/sources') return r.fulfill({ status: 504, headers: { 'access-control-allow-origin': '*' }, body: '' }); // the helper online but too slow (outside test round 8a)
    return r.fulfill({ status: 503, body: '' });
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(url); await p.waitForTimeout(2500);
  await p.getByRole('button', { name: /Plan a new trip/i }).click(); await p.waitForTimeout(800);
  await p.fill('#ts-0-place', 'Lisbon'); await p.fill('#ts-0-date', '2027-05-09'); await p.fill('#ts-0-nights', '3'); await p.press('#ts-0-nights', 'Tab');
  await p.getByRole('button', { name: /Build my trip/i }).click();
  let msg = ''; for (let k = 0; k < 60; k++) { await p.waitForTimeout(1000); const s = await p.evaluate(() => window.__kairouteState()); if (!s.busy && k > 3) { msg = s.err || ''; break; } }
  const text = await p.evaluate(() => document.body.innerText);
  if (mode === 'slow') { if (/when you're online|no internet|couldn't reach/i.test(msg)) fails.push('helper slow while online: the words blame the connection or say it was unreachable: ' + msg); if (!/taking longer than usual/i.test(msg)) fails.push('helper slow: no "taking longer than usual" message: ' + msg); }
  else if (mode !== 'unknown') { if (/spelling/i.test(msg + text)) fails.push('helper down: the traveler is told to check the spelling: ' + msg); if (!/couldn't reach/i.test(msg)) fails.push(mode + ': no "couldn\'t reach" message: ' + msg); }
  else if (!/spelling/i.test(msg)) fails.push('place not known: the "check the spelling" message is gone: ' + msg);
  if (mode === 'unknown') { await p.evaluate(() => window.__kairouteAt(1, 'plan')); await p.waitForTimeout(1500); const day = await p.evaluate(() => document.querySelector('main').innerText);
    if (/will build the guide/i.test(day)) fails.push('place not known: the day still promises to build its guide after the try found nothing');
    if ((day.match(/couldn't find|don't list sights/gi) || []).length !== 1) fails.push('place not known: the day should say once that nothing is listed: ' + day.slice(0, 400).replace(/\n/g, ' / '));
    if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT + '-unknown-day.png' });
    await p.evaluate(() => window.__kairouteGo('trip')); await p.waitForTimeout(800); }
  const btn = await p.locator('[data-act="genall"]').first().isVisible().catch(() => false); if (!btn) fails.push(mode + ': no Build the guide button to try again');
  if (errs.length) fails.push(mode + ': page errors ' + errs.join(' | ').slice(0, 300));
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT + '-' + mode + '.png' }); console.log(mode + ': ' + msg); await ctx.close();
}
(async () => { const s = await serve(FILE); const b = await chromium.launch(); await run(b, s.url, 'noaddr'); await run(b, s.url, 'down'); await run(b, s.url, 'unknown'); await run(b, s.url, 'slow'); await b.close(); s.close();
  if (fails.length) { console.log('FAIL\n' + fails.join('\n')); process.exit(1); } console.log('PASS no-signal check'); })();
