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
  // The list finishes marking what fits (cards settle) before the tap, as a traveler's eye would wait for it.
  await p.waitForFunction(() => !window.__kairouteFitPending || window.__kairouteFitPending() === 0, null, { timeout: 8000, polling: 100 }).catch(() => {});
  if (!(await p.$(`input[data-site="${id}"]`))) return false;
  // Aimed where the box is now and nothing covers it (a traveler sees the box before tapping it).
  let r = null;
  for (let k = 0; k < 4 && !r; k++) { r = await p.$eval(`input[data-site="${id}"]`, x => { const b = x.getBoundingClientRect(), pt = { x: b.x + b.width / 2, y: b.y + b.height / 2 }, at = document.elementFromPoint(pt.x, pt.y);
      if (at && (at === x || x.closest('label, [data-card]').contains(at))) return pt; const det = x.closest('details'); if (det && !det.open) { det.open = true; window.__foldShut = (window.__foldShut || 0) + 1; } x.scrollIntoView({ block: 'center' }); return null; });
    if (!r) { if (process.env.VERBOSE) console.error('re-aim', id); await p.waitForTimeout(400); } }
  if (!r) { if (process.env.VERBOSE) { await p.screenshot({ path: '/tmp/claude-0/noaim-' + id + '.png' }); console.error('no aim', id, await p.evaluate(id => { const x = document.querySelector(`input[data-site="${id}"]`); if (!x) return 'gone'; const b = x.getBoundingClientRect(), at = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); x.scrollIntoView({ block: 'center' }); const b2 = x.getBoundingClientRect(); const det = x.closest('details'); const cs = []; for (let e = x; e; e = e.parentElement) { const st = getComputedStyle(e); if (st.display === 'none' || st.visibility === 'hidden' || /hidden|auto|scroll/.test(st.overflowY)) cs.push(e.tagName + '.' + e.className + ':' + st.display + '/' + st.overflowY + '/' + e.scrollTop); } return JSON.stringify([Math.round(b.x), Math.round(b.y), b.width, b.height, innerHeight, scrollY, 'after', Math.round(b2.y), scrollY, det ? 'det:' + det.open : '', cs.join(' > ')]) + ' at ' + (at ? at.tagName + '.' + at.className + ' ' + (at.innerText || '').slice(0, 60) : 'null'); }, id)); } return false; }
  // The tap is done when the box shows its new state (or a won't-fit / closed box opens); how long that takes on a
  // phone-speed CPU is kept, so a slow tick is a leak of its own rather than a false "would not tick".
  const was = await p.$eval(`input[data-site="${id}"]`, x => x.checked), t0 = Date.now();
  await p.touchscreen.tap(r.x, r.y);
  await p.waitForFunction(([id, was]) => { const x = document.querySelector(`input[data-site="${id}"]`); return (x && x.checked !== was) || document.querySelector('.fitbox, .closedbox'); }, [id, was], { timeout: 8000, polling: 50 }).catch(() => {});
  tickMs.push(Date.now() - t0); if (process.env.VERBOSE) console.error('tap', id, was ? 'off' : 'on', Date.now() - t0, 'ms'); await p.waitForTimeout(150); return true;
}
const tickMs = [];
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
  const yp = p.locator('[data-act="picksfold"][aria-expanded="false"]').first(); if (await yp.isVisible().catch(() => false)) { await yp.tap(); await p.waitForTimeout(500); }
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

  // 2a. Richard's Naples day, Nov 18: Sorrento and Pompeii picked. Getting out to Sorrento is a ride of its own with every
  // way the guide names as a choice (the ferry among them); no stop runs past the leave-by time back to the ship.
  { const sor = all.find(id => /sorrento/.test(id)); if (sor) { await tapBox(p, sor);
      if (process.env.VERBOSE) console.error('sorrento card', await p.evaluate(id => { const c = document.querySelector(`[data-card="${id}"]`); return (c ? c.className + ' ' + c.innerText.replace(/\s+/g, ' ').slice(0, 160) : 'no card') + ' | box: ' + [...document.querySelectorAll('.fitbox, .closedbox')].map(e => e.innerText.replace(/\s+/g, ' ').slice(0, 300)).join(' / '); }, sor));
      const legs = await p.evaluate(i => window.__kairouteLegs(i), ni), plan = await p.evaluate(i => window.__kairouteEngine2()[i], ni);
      const k = (plan.items || []).findIndex(x => x.t === 'stop' && x.id === sor), before = k > 0 ? plan.items[k - 1] : null;
      check('Naples: the ride out to Sorrento is on the plan', before && before.t === 'ride', 'no ride before Sorrento');
      check('Naples: the ferry is offered for Sorrento', (legs || []).some(l => (l.choices || []).some(c => /ferry/i.test(c))), 'choices: ' + JSON.stringify((legs || []).map(l => l.choices)).slice(0, 200)); } }

  // 2a2. A fold opened by the traveler (its title carries a count) stays open when a sight inside it is ticked.
  { const det = await p.$('#view details:not([open]) input[data-site]');
    if (det) { const id = await det.evaluate(x => x.dataset.site); const ok = await tapBox(p, id);
      const still = await p.evaluate(id => { const x = document.querySelector(`input[data-site="${id}"]`), d = x && x.closest('details'); return !d || d.open; }, id);
      check('A fold the traveler opened stays open after a tick inside it', ok && still, ok ? 'the fold closed' : 'could not tap inside the fold'); } }

  // 2b. Hearted day: mark a day ready, change another day in the same place, reload: the hearted day is untouched.
  { const days = await p.evaluate(() => window.__kairouteDays());
    const pairs = days.map((d, i) => ({ i, c: d.city })).filter(x => x.c), byC = {}; pairs.forEach(x => (byC[x.c] = byC[x.c] || []).push(x.i));
    const two = Object.values(byC).find(a => a.length >= 2);
    if (two) { const [h, o] = two;
      await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('plan'); }, h); await p.waitForTimeout(600);
      const hb = p.locator('[data-act="dayready"]').first(); if (await hb.isVisible().catch(() => false)) { await hb.tap(); await p.waitForTimeout(800); }
      const hp = await p.evaluate(i => JSON.stringify((window.__kairouteEngine2()[i].items || []).filter(x => x.t === 'stop').map(x => x.id)), h);
      await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('sites'); }, o); await p.waitForTimeout(600);
      const yp2 = p.locator('[data-act="picksfold"][aria-expanded="false"]').first(); if (await yp2.isVisible().catch(() => false)) { await yp2.tap(); await p.waitForTimeout(400); }
      const on = (await boxes(p)).filter(b => b.on); if (on.length) await tapBox(p, on[0].id);
      await p.reload(); await p.waitForTimeout(6000);
      const st = await p.evaluate(i => window.__kairouteReady.state(i), h), hp2 = await p.evaluate(i => JSON.stringify((window.__kairouteEngine2()[i].items || []).filter(x => x.t === 'stop').map(x => x.id)), h);
      check(`A hearted day stays as it was after changes on another day and a reload (day ${h + 1})`, st === 'ok' && hp === hp2, `heart: ${st}; stops ${hp} -> ${hp2}`); } }

  // 2c. Every day of the trip: empty it, then pick one sight in town and one day trip; both stay and are planned.
  if (process.env.FULL) { const days = await p.evaluate(() => window.__kairouteDays()); const bad = [];
    for (let i = 0; i < days.length; i++) { if (process.env.DAYS && !process.env.DAYS.split(',').includes(String(i + 1))) continue;
      await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('sites'); }, i); await p.waitForTimeout(500);
      if (!(await p.$('input[data-site]'))) continue;
      const yp3 = p.locator('[data-act="picksfold"][aria-expanded="false"]').first(); if (await yp3.isVisible().catch(() => false)) { await yp3.tap(); await p.waitForTimeout(300); }
      for (let k = 0; k < 15; k++) { const on = (await boxes(p)).filter(b => b.on); if (!on.length) break; await tapBox(p, on[0].id); }
      if ((await boxes(p)).some(b => b.on)) { bad.push(`day ${i + 1} (${days[i].dest}): could not untick everything (still on: ${(await boxes(p)).filter(b => b.on).map(b => b.id).join(', ')})`); continue; }
      const free = await p.evaluate(i => (window.__kairouteEngine2()[i].items || []).filter(x => x.t === 'stop' && !x.bonus).length, i);
      if (free) bad.push(`day ${i + 1} (${days[i].dest}): emptied, yet ${free} stops planned (${await p.evaluate(i => (window.__kairouteEngine2()[i].items || []).filter(x => x.t === 'stop' && !x.bonus).map(x => x.name).join(', ') + ' | ' + (window.__kairouteEngine2()[i].explain || []).join(' '), i)})`);
      const ids = (await boxes(p)).map(b => b.id), pick = [ids.find(x => !/-far$/.test(x)), ids.find(x => /-far$/.test(x))].filter(Boolean);
      for (const id of pick) { await tapBox(p, id); const okTick = (await boxes(p)).some(b => b.id === id && b.on);
        const why = okTick ? '' : await p.evaluate(id => [...document.querySelectorAll('.fitbox, .closedbox')].map(e => e.innerText.replace(/\s+/g, ' ').slice(0, 100)).join(' / ') || ((document.querySelector(`[data-card="${id}"]`) || {}).innerText || 'no card').replace(/\s+/g, ' ').slice(0, 120), id);
        const planned = okTick && await p.evaluate(([i, id]) => (window.__kairouteEngine2()[i].items || []).some(x => x.t === 'stop' && x.id === id), [i, id]);
        if (!okTick && !/closed|won.t fit|doesn.t fit|isn.t open|not open|Needs \d/i.test(why)) bad.push(`day ${i + 1} (${days[i].dest}): ${id} would not tick${why ? ' (' + why + ')' : ''}`);
        else if (okTick && !planned) bad.push(`day ${i + 1} (${days[i].dest}): ${id} ticked but not on the plan`); }
    }
    check('Every day: empty it, then pick a sight in town and a day trip', !bad.length, bad.length + ' problems: ' + bad.slice(0, 12).join('; ')); }

  // 2d. Safety (rule 2): on every day tied to a ship, train or flight, no stop on the plan ends after the leave-by time.
  { const days = await p.evaluate(() => window.__kairouteDays()), bad = [];
    for (let i = 0; i < days.length; i++) { if (!/port|embark|departure/.test(days[i].type || '')) continue;
      const r = await p.evaluate(i => { const a = window.__kairouteLiveTest.alarm(i), pl = window.__kairouteLiveTest.plan(i); return a && pl ? { lb: a.leaveBy, from: a.from, late: pl.stops.filter(s => s.t + s.len > a.leaveBy + 0.5).map(s => s.name + ' to ' + Math.round(s.t + s.len)) } : null; }, i);
      if (r && r.late.length) bad.push(`day ${i + 1} (${days[i].dest}): leave by ${r.lb} from ${r.from}, but ${r.late.join(', ')}`); }
    check('No stop runs past the leave-by time on a ship, train or flight day', !bad.length, bad.slice(0, 3).join('; ')); }

  // 3. Reload: the trip comes back as it was (the traveler's Naples list kept), and every other day is planned the same.
  const before = await p.evaluate(() => JSON.stringify(window.__kairouteEngine2().map(d => (d.items || []).filter(x => x.t === 'stop').map(x => x.id))));
  await p.reload(); await p.waitForTimeout(6000);
  const after = await p.evaluate(() => JSON.stringify(window.__kairouteEngine2().map(d => (d.items || []).filter(x => x.t === 'stop').map(x => x.id))));
  check('After a reload every day is planned the same', before === after, 'plans changed on reload');

  // 3b. Picker and plan agree on every day (Nov 18, Madrid: a day the app seeded empty was filled by the engine while its
  // picker showed nothing ticked, so the traveler could neither see nor untick what the plan had). Every stop the plan
  // has for its own sake (not optional fill) is ticked in the day's list, or the list says the guide added it.
  { const days = await p.evaluate(() => window.__kairouteDays()), bad = [];
    for (let i = 0; i < days.length; i++) {
      await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('sites'); }, i); await p.waitForTimeout(250);
      const r = await p.evaluate(i => { const pl = window.__kairouteEngine2()[i] || {}, box = new Map([...document.querySelectorAll('input[data-site]')].map(x => [x.dataset.site, x.checked]));
        const said = ((document.querySelector('.pickbar') || {}).innerText || '');
        return { off: (pl.items || []).filter(x => x.t === 'stop' && !x.bonus && x.id != null && box.get(String(x.id)) === false).map(x => x.name), added: /added by your guide/.test(said) }; }, i);
      if (r.off.length && !r.added) bad.push(`day ${i + 1} (${days[i].dest}): planned but not ticked: ${r.off.join(', ')}`); }
    check('Every stop on a day plan is ticked in that day\'s list (or said to be added by the guide)', !bad.length, bad.slice(0, 4).join('; ')); }

  // 4. Speed: tapping between days, against the demo app on the same trip and the same slowed CPU.
  const b2t = await tapTimes(p);
  let demoMed = null; if (DEMO) { const s2 = await serve(DEMO); const d = await open(browser, s2.url); demoMed = median(await tapTimes(d.p)); await d.ctx.close(); s2.close(); }
  const m = median(b2t);
  check(`Tapping between days is quick (${Math.round(m)} ms on a phone-speed CPU${demoMed != null ? `, demo app ${Math.round(demoMed)} ms` : ''})`, demoMed != null ? m <= Math.max(150, demoMed * 2) : m <= 300, `median ${Math.round(m)} ms`);
  { const sl = tickMs.slice().sort((a, b) => a - b), med = median(sl), worst = sl[sl.length - 1] || 0;
    check(`Ticking a sight answers quickly (median ${med} ms, slowest ${worst} ms on a phone-speed CPU, ${sl.length} taps)`, med <= 700 && worst <= 2500, `median ${med} ms, slowest ${worst} ms`); }
  { const shut = await p.evaluate(() => window.__foldShut || 0); check('A fold the traveler opened never closes by itself', !shut, shut + ' times a fold had closed again before the next tap'); }
  check('No errors in the app', !errs.length, errs.slice(0, 2).join(' | '));

  await ctx.close(); srv.close(); await browser.close();
  const leaks = results.filter(r => !r.ok);
  for (const r of results) console.log((r.ok ? 'pass  ' : 'LEAK  ') + r.name + (r.ok ? '' : ' — ' + r.why));
  console.log(`Phone-flow check: ${results.length - leaks.length} passed, ${leaks.length} leak${leaks.length === 1 ? '' : 's'}`);
  process.exitCode = leaks.length ? 1 : 0;
})().catch(e => { console.error(e); process.exit(2); });
