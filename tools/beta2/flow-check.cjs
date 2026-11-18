// Beta 2 phone-flow check: drives the built Beta 2 app the way a traveler does, on a phone-sized screen with the CPU
// slowed down like a phone, over the sample Greece trip. No internet (every outside call is refused), no AI.
// Each check is a rule the app must keep on its own; a failure is a LEAK, printed in plain words.
// Usage: node tools/beta2/flow-check.cjs [beta2-site/index.html] [demo index.html, for the speed comparison]
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const B2 = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'beta2-site', 'index.html'));
const DEMO = process.argv[3] ? path.resolve(process.argv[3]) : null;
const SLOW = +process.env.CPU_SLOW || 4; // a phone is several times slower than this machine
const results = []; const pass = (name) => results.push({ name, ok: true }); const leak = (name, why) => results.push({ name, ok: false, why });
const check = (name, cond, why) => cond ? pass(name) : leak(name, why);
const SCRIPT = /[Ͱ-Ͽἀ-῿Ѐ-ӿ֐-׿؀-ۿ฀-๿぀-ヿ㐀-鿿가-힯]/;

function serve(file) { const dir = path.dirname(file), name = path.basename(file);
  return new Promise(res => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? name : u);
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
    s.listen(0, () => res({ url: 'http://localhost:' + s.address().port + '/' + name, close: () => s.close() })); }); }

async function open(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.route(u => !/^http:\/\/localhost/.test(String(u)), r => r.fulfill({ status: 503, body: '' }));
  await p.goto(url); await p.waitForTimeout(2500);
  const sample = p.locator('[data-act="loadsample"]').first(); if (await sample.isVisible().catch(() => false)) await sample.click();
  await p.waitForTimeout(5000);
  for (let k = 0; k < 5; k++) { const sk = p.locator('.coach button:has-text("Skip")').first(); if (await sk.isVisible().catch(() => false)) await sk.tap(); else break; }
  const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: SLOW });
  return { p, ctx, errs };
}
const dayIdx = (p, re) => p.evaluate(src => window.__kairouteDays().findIndex(d => new RegExp(src, 'i').test(d.dest)), re.source);
const boxes = p => p.$$eval('input[data-site]', xs => xs.map(x => ({ id: x.dataset.site, on: x.checked })));
async function tapBox(p, id) {
  if (!(await p.$(`input[data-site="${id}"]`))) return false; // not offered at all: the check that wanted it reports the leak
  // A sight in a folded section (More nearby) is opened first, as a traveler would.
  await p.$eval(`input[data-site="${id}"]`, x => { const det = x.closest('details'); if (det && !det.open) det.open = true; x.scrollIntoView({ block: 'center' }); });
  await p.waitForTimeout(300);
  const r = await p.$eval(`input[data-site="${id}"]`, x => { const b = x.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await p.touchscreen.tap(r.x, r.y); await p.waitForTimeout(1200); return true;
}
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
async function tapTimes(p) { const out = []; const n = await p.evaluate(() => window.__kairouteDays().length);
  for (let k = 0; k < 8; k++) { const i = (k * 3) % n; out.push(await p.evaluate(i => { const t = performance.now(); window.__kairouteGo('day', i); return performance.now() - t; }, i)); await p.waitForTimeout(400); }
  return out; }

(async () => {
  const browser = await chromium.launch(); const srv = await serve(B2);
  const { p, ctx, errs } = await open(browser, srv.url);

  // 1. Every day: the Day plan reads in English letters; the picker's count matches what the plan says was picked.
  const n = await p.evaluate(() => window.__kairouteDays().length);
  const foreign = [], counts = [];
  for (let i = 0; i < n; i++) {
    await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('plan'); }, i); await p.waitForTimeout(300);
    const t = await p.evaluate(() => (document.querySelector('main') || document.body).innerText);
    const bad = t.split('\n').filter(l => SCRIPT.test(l)); if (bad.length) foreign.push(`day ${i + 1}: "${bad[0].slice(0, 60)}"`);
    await p.evaluate(() => window.__kairouteGo('sites')); await p.waitForTimeout(300);
    const said = await p.evaluate(() => { const m = /(\d+) sites? picked/.exec((document.querySelector('.pickbar') || {}).innerText || ''); return m ? +m[1] : null; });
    const ticked = (await boxes(p)).filter(b => b.on).length;
    if (said != null && said !== ticked) counts.push(`day ${i + 1}: says ${said} picked, ${ticked} ticked`);
  }
  check('Every Day plan reads in English letters', !foreign.length, foreign.slice(0, 3).join('; '));
  check('Picker count matches the ticks on every day', !counts.length, counts.slice(0, 3).join('; '));

  // 2. Untick everything on a port day, then pick a day trip and a sight in town (Richard, Nov 18: Naples).
  const ni = await dayIdx(p, /Naples/);
  await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('sites'); }, ni); await p.waitForTimeout(800);
  const yp = p.locator('text=Your picks').first(); if (await yp.isVisible().catch(() => false)) { await yp.tap(); await p.waitForTimeout(500); }
  for (let k = 0; k < 12; k++) { const on = (await boxes(p)).filter(b => b.on); if (!on.length) break; await tapBox(p, on[0].id); }
  const left = (await boxes(p)).filter(b => b.on).map(b => b.id);
  check('Untick every sight on a day', !left.length, 'still ticked: ' + left.join(', '));
  // Richard's screen, Nov 18: on the emptied Naples day, sights 0.7 mi from the ship showed "Needs 1 h 17 min" and
  // could not be picked, as if the day's time were used up.
  const needs = await p.evaluate(() => [...document.querySelectorAll('label.site')].filter(l => /\bNeeds \d/.test(l.innerText)).map(l => l.innerText.split('\n')[0]));
  check('On the emptied day no sight in town says "Needs ..." (the day\'s time is free)', !needs.length, needs.length + ' blocked, e.g. ' + needs.slice(0, 3).join(', '));
  const plan0 = await p.evaluate(i => window.__kairouteEngine2()[i], ni);
  const stops0 = (plan0.items || []).filter(x => x.t === 'stop' && !x.bonus);
  check('An emptied day stays free (the app does not refill it)', !stops0.length, 'planned anyway: ' + stops0.map(x => x.name).join(', '));
  const all = (await boxes(p)).map(b => b.id), far = all.find(id => /pompeii/.test(id)) || all.find(id => /-far$/.test(id)), town = all.find(id => !/-far$/.test(id));
  for (const id of [far, town].filter(Boolean)) { await tapBox(p, id); const on = (await boxes(p)).some(b => b.id === id && b.on);
    const box = await p.evaluate(() => [...document.querySelectorAll('.fitbox, .closedbox')].map(e => e.innerText.slice(0, 120)).join(' / '));
    check(`Pick ${id} on the emptied day`, on, box ? 'the app said: ' + box : 'the tick did not stay'); }
  const planP = await p.evaluate(i => window.__kairouteEngine2()[i], ni);
  check('The picks are on the day plan', [far, town].filter(Boolean).every(id => (planP.items || []).some(x => x.t === 'stop' && x.id === id)), 'plan has: ' + (planP.items || []).filter(x => x.t === 'stop').map(x => x.id).join(', '));

  // 3. Reload: the trip comes back as it was (the traveler's Naples list kept), and every other day is planned the same.
  const before = await p.evaluate(() => JSON.stringify(window.__kairouteEngine2().map(d => (d.items || []).filter(x => x.t === 'stop').map(x => x.id))));
  await p.reload(); await p.waitForTimeout(6000);
  const after = await p.evaluate(() => JSON.stringify(window.__kairouteEngine2().map(d => (d.items || []).filter(x => x.t === 'stop').map(x => x.id))));
  check('After a reload every day is planned the same', before === after, 'plans changed on reload');

  // 4. Speed: tapping between days, against the demo app on the same trip and the same slowed CPU.
  const b2t = await tapTimes(p);
  let demoMed = null; if (DEMO) { const s2 = await serve(DEMO); const d = await open(browser, s2.url); demoMed = median(await tapTimes(d.p)); await d.ctx.close(); s2.close(); }
  const m = median(b2t);
  check(`Tapping between days is quick (${Math.round(m)} ms on a phone-speed CPU${demoMed != null ? `, demo app ${Math.round(demoMed)} ms` : ''})`, demoMed != null ? m <= Math.max(150, demoMed * 2) : m <= 300, `median ${Math.round(m)} ms`);
  check('No errors in the app', !errs.length, errs.slice(0, 2).join(' | '));

  await ctx.close(); srv.close(); await browser.close();
  const leaks = results.filter(r => !r.ok);
  for (const r of results) console.log((r.ok ? 'pass  ' : 'LEAK  ') + r.name + (r.ok ? '' : ' — ' + r.why));
  console.log(`Phone-flow check: ${results.length - leaks.length} passed, ${leaks.length} leak${leaks.length === 1 ? '' : 's'}`);
  process.exitCode = leaks.length ? 1 : 0;
})().catch(e => { console.error(e); process.exit(2); });
