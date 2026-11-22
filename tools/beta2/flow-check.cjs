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
// Tap a button the way a person does: scrolled into view, aimed where nothing covers it. Returns false if it can't be.
async function tapSel(p, sel) {
  const el = await p.$(sel); if (!el) return false;
  await el.evaluate(x => x.scrollIntoView({ block: 'center' })); await p.waitForTimeout(250);
  const r = await el.evaluate(x => { const b = x.getBoundingClientRect(), pt = { x: b.x + b.width / 2, y: b.y + b.height / 2 }, at = document.elementFromPoint(pt.x, pt.y); return at && (at === x || x.contains(at)) ? pt : null; });
  if (!r) return false; await p.touchscreen.tap(r.x, r.y); await p.waitForTimeout(600); return true;
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
    const said = await p.evaluate(() => { const m = /(\d+) sights? chosen/.exec((document.querySelector('.pickbar') || {}).innerText || ''); return m ? +m[1] : null; });
    const ticked = (await boxes(p)).filter(b => b.on).length;
    if (said != null && said !== ticked) counts.push(`day ${i + 1}: says ${said} picked, ${ticked} ticked`);
  }
  check('Every Day plan reads in English letters', !foreign.length, foreign.slice(0, 3).join('; '));
  check('Picker count matches the ticks on every day', !counts.length, counts.slice(0, 3).join('; '));

  // 2. Untick everything on a port day, then pick a day trip and a sight in town (Richard, Nov 18: Naples).
  const ni = await dayIdx(p, /Naples/);
  await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('sites'); }, ni); await p.waitForTimeout(800);
  const yp = p.locator('[data-act="picksfold"][aria-expanded="false"]').first(); if (await yp.isVisible().catch(() => false)) { await yp.tap(); await p.waitForTimeout(500); }
  // Nov 21 live re-check: with the day's sights on, the box for a place reached only by boat said "Even with nothing else
  // picked, it can't fit this day" on a day it fits alone, and offered no way. It offers the sights to swap for it.
  { const isle = await p.evaluate(() => [...document.querySelectorAll('[data-act="fitask"]')].map(x => x.dataset.id).find(id => window.__kairouteBoatPlace(id)) || null);
    if (isle) { await p.evaluate(id => document.querySelector(`[data-act="fitask"][data-id="${id}"]`).click(), isle); await p.waitForTimeout(5000);
      const t = await p.evaluate(() => (document.querySelector('.fitbox') || {}).innerText || '');
      check(`A place reached only by boat (${isle}) that fits the day alone: its box offers sights to swap for it, never "can't fit this day"`, /Swap .+ for /.test(t) && !/can't fit this day|no way to fit it/.test(t), t.replace(/\s+/g, ' ').slice(0, 300));
      await p.evaluate(() => { const c = document.querySelector('.fitbox [data-act="fitcancel"]'); if (c) c.click(); }); await p.waitForTimeout(500); } }
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
  // Nov 21 live check: a place reached only by boat, picked alone on the emptied ship day, was said to "never fit" a
  // 9 h 45 min day it fits in under 7 hours (lunch on the island was refused, as if the boat back were the app's pick).
  { const isle = await p.evaluate(() => { const ids = [...document.querySelectorAll('input[data-site]')].map(x => x.dataset.site); return ids.find(id => window.__kairouteBoatPlace(id)) || null; });
    if (isle) { const r = await p.evaluate(id => window.__kairouteFitTrial([id]), isle);
      check(`A place reached only by boat (${isle}), picked alone on the emptied ship day, fits with lunch when the box tries it`, r.fits, JSON.stringify(r).slice(0, 400)); } }
  // Nov 21 live check: a train kept from before the helper sent every departure of the kind knew only its own few, and
  // the way back to the ship became a taxi ("no departure near 4:10 pm"). A fresh answer that knows the whole day replaces it.
  { const mg = await p.evaluate(() => { const M = window.__kairouteTransitMerge, kd = [{ t: 960, lead: 5, dur: 90, a: 5 }];
      const old = { v: 1, opts: [{ mode: 'train', label: 'Train REG 1 + 2 changes', min: 90, deps: [{ t: 700, lead: 5, dur: 90 }] }, { mode: 'ferry', label: 'Ferry A - B', min: 70 }] };
      const r = M({ opts: [{ mode: 'train', label: 'Train RV 2 + 1 change', min: 92, deps: [{ t: 860, lead: 5, dur: 90 }], kindDeps: kd }], partial: true }, old);
      return r.opts.map(o => o.label).join(','); });
    check('A train kept from older answers gives way to a fresh one that knows the whole day (a ferry once found stays)', mg === 'Ferry A - B,Train RV 2 + 1 change' || mg === 'Train RV 2 + 1 change,Ferry A - B', mg); }
  // Nov 21 live re-check: an answer kept as complete by the last version (it knew 3 of the day's 15 hours) was never
  // asked again on a phone that planned the trip before, so its way back stayed a taxi. Answers of the last version are asked again.
  { const td = await p.evaluate(() => window.__kairouteTransitDue());
    check('Ride answers kept by the last version are asked again; fresh ones are kept', td.lastV === true && td.fresh === false && td.old === true, JSON.stringify(td));
    // Nov 22 live probe: a way back answered only in part (trains known until 9:53 am) waited 10 minutes to be asked again.
    check('A ride answered only in part is asked again after 2 minutes, and less often after five tries', td.busyNow === false && td.busy2min === true && td.busyOften === false && td.busyLater === true, JSON.stringify(td)); }
  const all = (await boxes(p)).map(b => b.id), far = all.find(id => /pompeii/.test(id)) || all.find(id => /-far$/.test(id)), town = all.find(id => !/-far$/.test(id));
  for (const id of [far, town].filter(Boolean)) { await tapBox(p, id); const on = (await boxes(p)).some(b => b.id === id && b.on);
    const box = await p.evaluate(() => [...document.querySelectorAll('.fitbox, .closedbox')].map(e => e.innerText.slice(0, 120)).join(' / '));
    check(`Pick ${id} on the emptied day`, on, box ? 'the app said: ' + box : 'the tick did not stay'); }
  const planP = await p.evaluate(i => window.__kairouteEngine2()[i], ni);
  check('The picks are on the day plan', [far, town].filter(Boolean).every(id => (planP.items || []).some(x => x.t === 'stop' && x.id === id)), 'plan has: ' + (planP.items || []).filter(x => x.t === 'stop').map(x => x.id).join(', '));

  // 2a. Richard's Naples day, Nov 18: Sorrento and Pompeii picked. Getting out to Sorrento is a ride of its own with every
  // way the guide names as a choice (the ferry among them); no stop runs past the leave-by time back to the ship.
  // Since Nov 20 (outside review #12) Pompeii picked on its own keeps its full visit, so Pompeii and Sorrento no longer fit
  // one port day together: Sorrento is picked with the sight in town instead.
  { const sor = all.find(id => /sorrento/.test(id)); if (sor) { if (far && (await boxes(p)).some(b => b.id === far && b.on)) await tapBox(p, far); await tapBox(p, sor);
      if (process.env.VERBOSE) console.error('sorrento card', await p.evaluate(id => { const c = document.querySelector(`[data-card="${id}"]`); return (c ? c.className + ' ' + c.innerText.replace(/\s+/g, ' ').slice(0, 160) : 'no card') + ' | box: ' + [...document.querySelectorAll('.fitbox, .closedbox')].map(e => e.innerText.replace(/\s+/g, ' ').slice(0, 300)).join(' / '); }, sor));
      const legs = await p.evaluate(i => window.__kairouteLegs(i), ni), plan = await p.evaluate(i => window.__kairouteEngine2()[i], ni);
      const k = (plan.items || []).findIndex(x => x.t === 'stop' && x.id === sor), before = k > 0 ? plan.items[k - 1] : null;
      check('Naples: the ride out to Sorrento is on the plan', before && before.t === 'ride', 'no ride before Sorrento');
      // With no ferry timetable known (this check runs offline), the ride says the guide's ferry may run, never a ferry
      // made up from the guide's words (Nov 18 night: one ride layer, data only); with one, the ferry is a choice (2a1).
      check('Naples: the ferry the guide names is offered, or said to be unknown', (legs || []).some(l => (l.choices || []).some(c => /ferry/i.test(c)) || /names a ferry, but no timetable/i.test(l.note || '')), 'legs: ' + JSON.stringify((legs || []).map(l => [l.how, l.choices, l.note])).slice(0, 300)); } }

  // 2a1. Every ride choice on the Naples day plan can be tapped and is taken, in any order, for several sets of picks
  // (a trip out alone, two trips out, a trip out with sights in town), unless it would cost one of the traveler's own
  // stops (the app then offers to take it anyway) or the ship. Nov 18: the train was refused for an optional stop; the
  // ferry back couldn't be picked once the train was taken out; a ride picked out decided the ride picked back.
  // Unticks first: a pick that fits alone may not fit beside the last set's picks (Pompeii keeps its full visit since Nov 20).
  { const setPicks = async want => { for (let k = 0; k < 30; k++) { const st = await boxes(p), w = st.find(x => x.on && !want.includes(x.id)) || st.find(x => x.on !== want.includes(x.id)); if (!w) return true;
        if (!(await tapBox(p, w.id))) return false; if (await p.$('.fitbox, .closedbox')) { let ok = (await boxes(p)).some(x => x.id === w.id && x.on === want.includes(x.id));
          // A pick that fits only with another shorter: added through its pop-up, as the traveler would ("Add it, with ...").
          if (!ok && want.includes(w.id)) { const fix = p.locator('.fitbox .fixbtn', { hasText: 'Add it, with' }).first(); if (await fix.isVisible().catch(() => false)) { await fix.evaluate(e => e.click()); await p.waitForTimeout(500); ok = (await boxes(p)).some(x => x.id === w.id && x.on); } }
          if (!ok) return false; } } return false; };
    const pick = re => all.find(id => re.test(id));
    // The last set again with a timetable answer for every ride, as the app has online (Nov 18, 7:14 PM: with an answer
    // the guide's train showed as "Taxi or car" and the train tapped was refused; the offline test had no answers).
    const sets = [[pick(/pompeii/)], [pick(/sorrento/)], [pick(/sorrento/), town], [pick(/pompeii-far$/), pick(/pompeii-far~/)], [pick(/pompeii/), town, 'answers']].map(x => x.filter(Boolean)).filter(x => x.filter(y => y !== 'answers').length);
    const bad = []; let tapped = 0;
    for (const set0 of sets) {
      const withAns = set0.includes('answers'), set = set0.filter(x => x !== 'answers');
      await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('sites'); }, ni); await p.waitForTimeout(500);
      if (!(await setPicks(set))) { bad.push(`could not pick ${set.join(' + ')}`); continue; }
      await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('plan'); }, ni); await p.waitForTimeout(800);
      if (withAns) { const legs = await p.evaluate(i => (window.__kairouteEngine2()[i].items || []).filter(x => x.t === 'ride' && x.from && x.to && x.mode !== 'walk').map(x => ({ a: x.from, b: x.to, min: x.min - (x.slack || 0) })), ni); // the answer's own time (the ship's extra time is added to every way alike)
        // Real answers come as several runs of the same line (Nov 18, Athens airport: three M3 rows): one choice per way of
        // going is shown, and the planned ride gives its steps (walk to the stop, the line, the walk at the end).
        const ans = (min, label, extra) => Object.assign({ mode: 'rail', label, min, ride: min - 15, km: 10, access: { how: 'walk', min: 5, km: 0.3 }, egress: { how: 'walk', min: 8, km: 0.5 }, from: 'Central Station', to: 'Far Station', steps: ['Train 4: Central Station to Far Station, ' + (min - 15) + ' min'], every: 30, everySrc: 'timetable' }, extra || {});
        // Kept as the app keeps a real answer: under the timetable day of the Naples day's own date (weekday, Saturday or
        // Sunday). Nov 19, Richard's Jul 2: an answer kept under Friday vanished when the trip was planned while another
        // day was on screen, and the train he had picked was then "not known".
        const days0 = await p.evaluate(() => window.__kairouteDays()), kdOf = dt => { const w = new Date(dt + 'T12:00:00Z').getUTCDay(); return w === 0 ? 'su' : w === 6 ? 'sa' : 'wk'; };
        const nkd = kdOf(days0[ni].date), other = days0.findIndex(d => d.date && kdOf(d.date) !== nkd);
        await p.evaluate(([ls, kd]) => window.__kairouteTransitSet(ls.flatMap(l => [[l.a, l.b], [l.b, l.a]].map(([a, b]) => ({ a, b, kd, opts: l.opts })))), [legs.map(l => Object.assign({}, l, { opts: [ans(Math.max(20, l.min - 3), 'Train 4 + 1 change'), ans(Math.max(20, l.min - 3) + 3, 'Train 4 + 1 change'), ans(Math.max(20, l.min - 3) + 5, 'Train 4')] })), nkd]);
        if (other >= 0) { await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('plan'); }, other); await p.waitForTimeout(800); }
        await p.evaluate(i => { window.__kairouteGo('sites'); window.__kairouteGo('day', i); window.__kairouteGo('plan'); }, ni); await p.waitForTimeout(800);
        if (process.env.VERBOSE) console.error('rides with answers', JSON.stringify(await p.evaluate(i => (window.__kairouteEngine2()[i].items || []).filter(x => x.t === 'ride' && x.mode !== 'walk').map(x => [x.how, x.kind, x.min, x.slack, (x.options || []).map(o => o.id + ':' + o.how + ':' + o.min)]), ni)));
        const named = await p.evaluate(i => (window.__kairouteLegs(i) || []).filter(l => l.mode !== 'ride' && /^Taxi/.test(l.how || '')).length, ni);
        if (named) bad.push(`${set.join('+')} with timetable answers: ${named} ride(s) called "Taxi or car" that aren't a taxi`);
        // A ride the traveler set to another way in the taps above keeps that way (their choice holds): Train 4 is picked
        // for every ride offering it, as a traveler would tap it, and then shows its steps.
        const tkeys = await p.$$eval('[data-rideval="train"]', xs => [...new Set(xs.map(x => x.dataset.ridekey))]);
        for (const key of tkeys) await p.evaluate(([i, key]) => window.__kairouteRideSwitch(i, key, 'train'), [ni, key]);
        await p.evaluate(i => { window.__kairouteGo('sites'); window.__kairouteGo('day', i); window.__kairouteGo('plan'); }, ni); await p.waitForTimeout(800);
        const dup = await p.$$eval('.ridechips', xs => xs.filter(x => [...x.querySelectorAll('.ridechip')].filter(c => /^Train 4/.test(c.innerText)).length > 1).length);
        if (dup) bad.push(`${set.join('+')} with timetable answers: ${dup} ride(s) offer the same train more than once`);
        const steps = await p.$$eval('.tl.leg', xs => xs.filter(x => /Train 4/.test(x.querySelector('b') ? x.querySelector('b').innerText : '')).map(x => /Walk 5 min to Central Station/.test(x.innerText) || x.innerText.replace(/\s+/g, ' ').slice(0, 200)));
        if (!steps.length || steps.some(v => v !== true)) bad.push(`${set.join('+')} with timetable answers: a planned train ride without its steps (walk to the station, the line, the walk at the end): ${steps.length ? steps.filter(v => v !== true).join(' / ') : 'no Train 4 planned'}`); }
      const first = await p.$$eval('[data-ridekey]', xs => xs.map(x => ({ key: x.dataset.ridekey, val: x.dataset.rideval })));
      // Each choice, then each again in reverse order (so a later pick on one ride meets an earlier pick on another).
      const seq = first.concat(first.slice().reverse()).slice(0, 14);
      for (const c of seq) {
        const sel = `[data-ridekey="${c.key}"][data-rideval="${c.val}"]`; if (!(await p.$(sel)) || (await p.$(sel + '.on'))) continue;
        if (!(await tapSel(p, sel))) { bad.push(`${set.join('+')}: could not tap ${c.val}`); continue; } tapped++;
        const on = !!(await p.$(sel + '.on')) || await p.evaluate(([key, val]) => { const kp = key.split(',').map(Number), d = (a, b) => { const R = Math.PI / 180, x = Math.sin((b[0] - a[0]) * R / 2) ** 2 + Math.cos(a[0] * R) * Math.cos(b[0] * R) * Math.sin((b[1] - a[1]) * R / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
          const tol = Math.max(1.5, d([kp[0], kp[1]], [kp[2], kp[3]]) / 5);
          return [...document.querySelectorAll(`[data-rideval="${val}"].on`)].some(x => { const q = x.dataset.ridekey.split(',').map(Number); return d([q[0], q[1]], [kp[0], kp[1]]) <= tol && d([q[2], q[3]], [kp[2], kp[3]]) <= tol; }); }, [c.key, c.val]);
        const note = await p.evaluate(() => [...document.querySelectorAll('.ridenote, .notice, [data-ridenotice]')].map(e => e.innerText).join(' ').replace(/\s+/g, ' '));
        const canForce = !!(await p.$('[data-act="rideforce"]'));
        if (!on && !canForce && !/too late|after .* ship|isn't available|another way round/i.test(note)) bad.push(`${set.join('+')}: ${c.val} not taken${note ? ': ' + note.slice(0, 120) : ' (nothing said)'}`);
        if (!on && /another way round/i.test(note) && withAns) bad.push(`${set.join('+')}: ${c.val} said the day goes another way round`);
      }
    }
    check(`Naples: every ride choice is taken, in any order, for ${sets.length} sets of picks (${tapped} taps), unless it costs a pick or the ship`, tapped > 0 && !bad.length, tapped ? bad.slice(0, 3).join('; ') : 'no ride choices on the plan'); }

  // 2a1a. A ferry is drawn straight across the water, never along the road (Nov 18, Naples to Sorrento on the coast road).
  { await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('plan'); }, ni); await p.waitForTimeout(600);
    const ls = await p.evaluate(() => window.__kairouteMapLegs().map(l => ({ kind: l.kind, n: (l.path || []).length, road: !l.path })));
    const bad = ls.filter(l => l.kind === 'ferry' && (l.road || l.n > 2));
    check('Every ferry on the map crosses the water (drawn straight, not along a road)', !bad.length, bad.length + ' ferry legs follow a road'); }

  // 2a1c. Every line on the map is the kind of ride it is (Nov 18, Richard's Naples map: "floating cars and ferries that
  // drive on land"): a ferry runs from a pier (never from a church in town) to a pier or the island itself, the way to
  // the pier is drawn on its own, and no ride by road or on foot goes to a place reached only by boat. A road route
  // joins a stop only where the stop is beside the street (no straight line over the harbour to a terminal on its pier).
  // A pick that fits only with something else shorter opens the box that names it (Nov 19, Richard: no quiet cuts); the
  // traveler taps "Add it, with ..." as Richard would.
  // Unticks first: a pick that fits alone may not fit beside the last set's picks (Pompeii keeps its full visit since Nov 20).
  { const setPicks = async want => { for (let k = 0; k < 30; k++) { const st = await boxes(p), w = st.find(x => x.on && !want.includes(x.id)) || st.find(x => x.on !== want.includes(x.id));
        // A wanted sight with no tick (it fits only if something changes) is added through its pop-up, as Richard asked.
        let miss = !w ? want.find(id => !st.some(x => x.id === id)) : null; if (!w && !miss) return true;
        if (w) { if (await tapBox(p, w.id)) { const fix = p.locator('.fitbox .fixbtn', { hasText: 'Add it, with' }).first(); if (await fix.isVisible().catch(() => false)) { await fix.evaluate(e => e.click()); await p.waitForTimeout(400); } continue; }
          if (want.includes(w.id) && !w.on) miss = w.id; else return false; }
        if (miss) {
          await p.waitForFunction(() => !window.__kairouteFitPending || window.__kairouteFitPending() === 0, null, { timeout: 15000, polling: 100 }).catch(() => {});
          const ask = p.locator(`[data-act="fitask"][data-id="${miss}"]`).first(); if (!(await ask.isVisible().catch(() => false))) { await p.$eval(`[data-card="${miss}"]`, x => { const det = x.closest('details'); if (det && !det.open) det.open = true; x.scrollIntoView({ block: 'center' }); }).catch(() => {}); }
          if (!(await ask.isVisible().catch(() => false))) { if (process.env.VERBOSE2) console.error('NOASK', miss, await p.evaluate(id => { const c = document.querySelector(`[data-card="${id}"]`); return c ? c.className + ' ' + c.innerText.replace(/\s+/g, ' ').slice(0, 200) : 'no card'; }, miss)); return false; } await ask.evaluate(e => e.click()); await p.waitForTimeout(600);
          const fix = p.locator('.fitbox .fixbtn', { hasText: 'Add it, with' }).first(); if (!(await fix.isVisible().catch(() => false))) { const t = await p.evaluate(() => (document.querySelector('.fitbox') || {}).innerText || ''); if (/doesn't fit/.test(t)) { await p.evaluate(() => { const c = document.querySelector('.fitbox [data-act="fitcancel"]'); if (c) c.click(); }); return 'nofit'; } if (process.env.VERBOSE2) console.error('BOX', miss, await p.evaluate(() => [...document.querySelectorAll('.fitbox')].map(e => e.innerText.replace(/\s+/g, ' ').slice(0, 600)).join(' / '))); return false; }
          await fix.evaluate(e => e.click()); await p.waitForTimeout(600); continue; }
      } return false; };
    const isle = all.find(id => /capri/.test(id)), inland = all.find(id => /duomo/.test(id)) || town, inl = all.find(id => /pompeii/.test(id));
    const bad = []; let ferries = 0, skipped = 0; // a set that doesn't fit the day (the pop-up says so) is not tried
    // On a ship day a boat is planned only on a sailing a timetable confirms (Nov 21 outside review): the island's ferry gets
    // its timetable here (every half hour, 7:00 to 19:30), as the helper sends it, kept under the Naples day's own kind of day.
    await p.evaluate(([i, isleId]) => { const b = window.__kairouteBucket(true), d = b.days[i], c = (b.cities || {})[d.city] || {}, x = [...(c.sites || []), ...(c.farther || [])].find(y => String(y.id) === String(isleId));
      const e = (window.__kairouteEngine2()[i] || {}).items || [], o = e[0]; if (!x || !o || !isFinite(o.lat)) return;
      const w = new Date(d.date + 'T12:00:00Z').getUTCDay(), kd = w === 0 ? 'su' : w === 6 ? 'sa' : 'wk', deps = []; for (let t = 7 * 60; t <= 19 * 60 + 30; t += 30) deps.push({ t });
      const f = { mode: 'ferry', label: 'Ferry', min: 60, ride: 50, wait: 5, every: 30, everySrc: 'timetable', km: 30, access: { how: 'walk', min: 5, km: 0.3 }, egress: { how: 'walk', min: 5, km: 0.3 }, steps: ['Ferry, 50 min'], deps };
      const A = { lat: o.lat, lng: o.lng }, B = { lat: x.lat, lng: x.lng }; window.__kairouteTransitSet([{ a: A, b: B, kd, opts: [f] }, { a: B, b: A, kd, opts: [f] }]); }, [ni, isle]);
    for (const set of [[inland, isle], [isle, inl], [inland, isle, inl]].map(x => x.filter(Boolean)).filter(x => x.includes(isle))) {
      await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('sites'); }, ni); await p.waitForTimeout(500);
      const got = await setPicks(set); if (got === 'nofit') { skipped++; continue; } if (!got) { bad.push(`could not pick ${set.join(' + ')}`); continue; }
      await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('plan'); }, ni); await p.waitForTimeout(800);
      const r = await p.evaluate(() => { const R = Math.PI / 180, km = (a, b) => { const x = Math.sin((b[1] - a[1]) * R / 2) ** 2 + Math.cos(a[1] * R) * Math.cos(b[1] * R) * Math.sin((b[0] - a[0]) * R / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
        const piers = window.__kairoutePiers().map(q => [q.lng, q.lat]), d = window.__kairouteEngine2()[window.__kairouteDays().findIndex(x => /Naples/.test(x.dest))];
        const boatAt = (d.items || []).filter(x => x.t === 'stop' && window.__kairouteBoatPlace(x.id)).map(x => [x.lng, x.lat]);
        const atPier = q => piers.some(pq => km(pq, q) <= 0.3), atIsle = q => boatAt.some(b => km(b, q) <= 0.05), onIsle = q => boatAt.some(b => km(b, q) <= 5);
        return window.__kairouteMapLegs().map(l => ({ kind: l.kind, a: l.a, b: l.b, ok: l.kind === 'ferry' ? (atPier(l.a) || atIsle(l.a)) && (atPier(l.b) || atIsle(l.b)) : !(atIsle(l.a) && !onIsle(l.b)) && !(atIsle(l.b) && !onIsle(l.a)) })); });
      ferries += r.filter(l => l.kind === 'ferry').length;
      r.filter(l => !l.ok).forEach(l => bad.push(`${set.join('+')}: a ${l.kind} line from ${l.a.map(n => n.toFixed(4))} to ${l.b.map(n => n.toFixed(4))}`));
      const tl = await p.$$eval('.tl', xs => xs.map(x => x.innerText.replace(/\s+/g, ' ')).join(' | '));
      if (set.length === 2 && set.includes(inland) && !/to the ferry at/i.test(tl)) bad.push(`${set.join('+')}: the day plan doesn't show the way to the ferry pier (${tl.slice(0, process.env.VERBOSE2 ? 3000 : 300)})`); }
    // A road route ending on the street 300 m from a terminal out on its pier: drawn to the street, not over the water.
    const road = await p.evaluate(() => window.__kairouteRoadEnds({ mode: 'car', a: [14.2600, 40.8500], b: [14.2550, 40.8380] }, [[14.2601, 40.8501], [14.2580, 40.8440], [14.2560, 40.8410]]));
    if (road.length !== 4 || road[road.length - 1][1] !== 40.8410) bad.push('a road line was joined over the water to a stop 300 m from the street');
    check(`Every line on the Naples map is its kind of ride: ferries pier to pier (${ferries} drawn), nothing on land goes to the island, roads don't cross the harbour`, ferries > 0 && !bad.length, bad.slice(0, 3).join('; ') || 'no ferry drawn'); }

  // 2a1b. Free time is the traveler's (Nov 18, Richard: "I wouldn't do the suggested options. Just let them select to
  // fill the spots."): no day plan has a stop the app put there on its own. A day with free time says so in one row
  // whose "See what fits" opens Choose sights at its "Still fits today" list (outside UI review, Nov 20: the row's own
  // list of sights said the same as that page); ticking one there makes it a pick that stays after a reload (on the plan, or
  // part of a visit on it: folded, Nov 20).
  { const days = await p.evaluate(() => window.__kairouteDays()), extra = []; let done = null;
    for (let i = 0; i < days.length; i++) {
      const it = await p.evaluate(i => (window.__kairouteEngine2()[i] || {}).items || [], i);
      const opt = it.filter(x => x.t === 'stop' && x.bonus); if (opt.length) extra.push(`day ${i + 1}: ${opt.map(x => x.name).join(', ')}`);
      if (done) continue;
      await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('plan'); }, i); await p.waitForTimeout(400);
      if (await p.$('.tl.optional')) extra.push(`day ${i + 1}: an "Optional:" stop shows`);
      if (!(await p.$('.freetime [data-goto="sites"]'))) continue;
      const went = await tapSel(p, '.freetime [data-goto="sites"]') && await p.evaluate(() => !!document.querySelector('.pickbar'));
      await p.waitForFunction(() => !window.__kairouteFitPending || window.__kairouteFitPending() === 0, null, { timeout: 8000, polling: 100 }).catch(() => {});
      const id = await p.$eval('.mustlist input[data-site]:not(:checked), .fitlist input[data-site]:not(:checked)', x => x.dataset.site).catch(() => null);
      if (!id) { if (went) continue; done = { i, id: '(none)', went }; continue; }
      const ok = await tapBox(p, id);
      const has = () => p.evaluate(([i, id]) => ((window.__kairouteEngine2()[i].items || []).some(x => x.t === 'stop' && String(x.id) === String(id) && !x.bonus) || (window.__kairouteEngine2()[i].folded || []).map(String).includes(String(id))), [i, id]);
      const now = ok && await has(); await p.reload(); await p.waitForTimeout(6000);
      done = { i, id, went, ok, now, after: await has() }; }
    check('No day plan has a sight the app added on its own', !extra.length, extra.slice(0, 3).join('; '));
    check('Free time\'s "See what fits" opens the sights that fit, and ticking one makes it a pick that stays after a reload', !!done && done.went && done.ok && done.now && done.after, !done ? 'no day offered a sight in its free time' : `day ${done.i + 1} ${done.id}: ${!done.went ? '"See what fits" did not open Choose sights' : !done.ok ? 'could not tick' : !done.now ? 'not on the plan' : 'gone after a reload'}`); }

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
      for (let k = 0; k < 15; k++) { const on = (await boxes(p)).filter(b => b.on); if (!on.length) break; if (process.env.VERBOSE2) console.error('untick', i + 1, k, on.length, on.map(b => b.id).join(' ')); await tapBox(p, on[0].id); }
      if ((await boxes(p)).some(b => b.on)) { bad.push(`day ${i + 1} (${days[i].dest}): could not untick everything (still on: ${(await boxes(p)).filter(b => b.on).map(b => b.id).join(', ')})`); continue; }
      const free = await p.evaluate(i => (window.__kairouteEngine2()[i].items || []).filter(x => x.t === 'stop' && !x.bonus).length, i);
      if (free) bad.push(`day ${i + 1} (${days[i].dest}): emptied, yet ${free} stops planned (${await p.evaluate(i => (window.__kairouteEngine2()[i].items || []).filter(x => x.t === 'stop' && !x.bonus).map(x => x.name).join(', ') + ' | ' + (window.__kairouteEngine2()[i].explain || []).join(' '), i)})`);
      const ids = (await boxes(p)).map(b => b.id), pick = [ids.find(x => !/-far$/.test(x)), ids.find(x => /-far$/.test(x))].filter(Boolean);
      for (const id of pick) { await tapBox(p, id); const okTick = (await boxes(p)).some(b => b.id === id && b.on);
        const why = okTick ? '' : await p.evaluate(id => [...document.querySelectorAll('.fitbox, .closedbox')].map(e => e.innerText.replace(/\s+/g, ' ').slice(0, 100)).join(' / ') || ((document.querySelector(`[data-card="${id}"]`) || {}).innerText || 'no card').replace(/\s+/g, ' ').slice(0, 120), id);
        // A day still asking the traveler something (which pier) keeps the tick and plans once answered.
        const planned = okTick && await p.evaluate(([i, id]) => { const e = window.__kairouteEngine2()[i]; return /\?/.test(String(e.error || '')) || (e.items || []).some(x => x.t === 'stop' && x.id === id) || (e.folded || []).map(String).includes(String(id)); }, [i, id]);
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

  // 2c. Drag to reorder (Nov 19, Richard: "drag to reorder is not allowing you to drop it where you want it"): on the first
  // day with three stops or more, in Compact view, the third stop is dragged by its handle above the first; it is then the
  // first stop of the plan, and the plan keeps the order dropped.
  { const nd = await p.evaluate(() => window.__kairouteDays().length); let di = -1;
    for (let i = 0; i < nd && di < 0; i++) { const st = await p.evaluate(i => (window.__kairouteEngine2()[i].items || []).filter(x => x.t === 'stop').length, i); if (st >= 3) di = i; }
    if (di < 0) check('Drag to reorder: the stop dragged to the top is planned first, and the order holds', !!process.env.FULL, 'no day has three stops'); // FULL leaves every day with two picks
    else {
    await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('plan'); }, di); await p.waitForTimeout(800);
    const cbtn = await p.$('[data-act="tlview"][data-v="compact"]'); if (cbtn) { await cbtn.evaluate(b => b.click()); await p.waitForTimeout(800); }
    const before = await p.$$eval('.timeline .tl[data-stop]', xs => xs.map(x => x.dataset.stop));
    const hs = await p.$$('.timeline .draghandle[data-drag]'); let moved = null; const dragInfo = {};
    if (before.length >= 3 && hs.length >= 3) {
      // The third stop is dragged above the first (both on screen, as a finger can reach them).
      const last = await p.$(`.timeline .draghandle[data-drag="${before[2]}"]`), first = await p.$(`.timeline .tl[data-stop="${before[0]}"]`);
      await first.evaluate(x => x.scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
      const hb = await last.boundingBox(), fb = await first.boundingBox();
      if (hb && fb) { await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await p.mouse.down(); dragInfo.on = await p.evaluate(() => document.body.classList.contains('dragging-on')); dragInfo.hit = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.closest('.draghandle') ? 'handle' : e.className) : 'none'; }, [hb.x + hb.width / 2, hb.y + hb.height / 2]);
        for (let k = 1; k <= 12; k++) { await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + (fb.y + 4 - hb.y - hb.height / 2) * k / 12); await p.waitForTimeout(40); }
        await p.mouse.up(); await p.waitForTimeout(1200);
        // A day marked ready asks first (its heart comes off): the traveler says yes.
        const yes = await p.$('[data-act="readyorderyes"]'); if (yes) { dragInfo.asked = true; await yes.evaluate(b => b.click()); await p.waitForTimeout(1200); }
        moved = await p.$$eval('.timeline .tl[data-stop]', xs => xs.map(x => x.dataset.stop)); dragInfo.order = await p.evaluate(i => window.__kairouteOrder.get(i), di); dragInfo.ask = await p.evaluate(() => [...document.querySelectorAll('.orderask, .readyask')].map(e => e.innerText.slice(0, 80)).join(' / ')); dragInfo.hb = hb; dragInfo.fb = fb; } }
    check('Drag to reorder: the stop dragged to the top is planned first, and the order holds', moved && moved[0] === before[2],
      `day ${di + 1}: before ${before.join('>')}, after ${(moved || []).join('>') || 'no drag possible'} ${JSON.stringify(dragInfo)}`);
    const back = await p.$('[data-act="orderreset"]'); if (back) { await back.evaluate(b => b.click()); await p.waitForTimeout(600); }
    const fbtn = await p.$('[data-act="tlview"][data-v="full"]'); if (fbtn) { await fbtn.evaluate(b => b.click()); await p.waitForTimeout(400); } } }

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

  // 3c. ONE "fits" test (Nov 19, Richard: "It doesnt have time to give me lunch but when you go into the selector, it gives
  // me a bunch of stuff I can add"). A sight with a plain tick in the list really fits: ticked, it is on the plan, and
  // nothing already on the day got shorter (no visit cut, lunch not made quicker or lost).
  { const bad = []; let tried = 0; const days = await p.evaluate(() => window.__kairouteDays());
    const idxs = days.map((d, i) => i).filter(i => /Athens|Naples/.test(days[i].dest)).slice(0, 4);
    for (const i of idxs) {
      await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('sites'); }, i); await p.waitForTimeout(400);
      await p.waitForFunction(() => !window.__kairouteFitPending || window.__kairouteFitPending() === 0, null, { timeout: 15000, polling: 200 }).catch(() => {});
      const ids = await p.evaluate(() => [...document.querySelectorAll('label.site')].filter(l => l.querySelector('.tag.fit') && !l.querySelector('input:checked')).map(l => l.dataset.card).slice(0, 2));
      for (const id of ids) {
        // Marks are checked again after every change (a sight moved between days): only a card that still has its tick.
        await p.waitForFunction(() => !window.__kairouteFitPending || window.__kairouteFitPending() === 0, null, { timeout: 20000, polling: 200 }).catch(() => {}); await p.waitForTimeout(300);
        if (!(await p.evaluate(id => { const l = document.querySelector(`label.site[data-card="${id}"]`); return !!(l && l.querySelector('.tag.fit') && !l.querySelector('input:checked')); }, id))) continue;
        tried++;
        const before = await p.evaluate(i => window.__kairouteEngine2()[i], i);
        await tapBox(p, id); const ok = (await boxes(p)).some(b => b.id === id && b.on);
        const after = await p.evaluate(i => window.__kairouteEngine2()[i], i);
        const own = x => (x.min || 0) + (x.lunchCut || 0), stops = pl => (pl.items || []).filter(x => x.t === 'stop'), lunch = pl => (pl.items || []).find(x => x.t === 'meal' && x.meal === 'Lunch');
        const why = [];
        if (!ok) why.push('the tick was refused');
        else if (!stops(after).some(x => String(x.id) === String(id)) && !(after.folded || []).map(String).includes(String(id))) why.push('not on the plan');
        for (const x of stops(before)) { const y = stops(after).find(z => String(z.id) === String(x.id)); if (!y) why.push(x.name + ' dropped'); else if (own(y) < own(x)) why.push(`${x.name} ${own(x)} -> ${own(y)} min`); }
        if (lunch(before) && (!lunch(after) || lunch(after).min < lunch(before).min)) why.push('lunch ' + lunch(before).min + ' -> ' + (lunch(after) ? lunch(after).min : 'none') + ' min');
        if (why.length && process.env.VERBOSE2) console.error('3C', id, JSON.stringify((after.explain || []).join(' | ')).slice(0, 600));
        if (why.length) bad.push(`day ${i + 1} (${days[i].dest}), ${id}: ${why.join('; ')}`);
        if (ok) await tapBox(p, id); else await p.evaluate(() => { const c = document.querySelector('.fitbox [data-act="fitcancel"]'); if (c) c.click(); }); } }
    check(`A sight with a plain tick really fits: on the plan, nothing else shorter, lunch kept (${tried} tried)`, tried > 0 && !bad.length, tried ? bad.slice(0, 3).join(' | ') : 'no sight with a tick to try'); }

  // 3d. The sight list organizes itself (Richard, Nov 19): Your picks, Still fits, Also see (farther out), Already picked
  // on other days, Doesn't fit, in that order. Every card under "Still fits" has a tick; every card under "Doesn't fit"
  // has none and opens the box that says why and how to make it fit; a sight ticked goes up to Your picks.
  { const bad = []; const days = await p.evaluate(() => window.__kairouteDays());
    const ORDER = ['Your picks', 'Still fits today', 'Also see, farther out', 'Already picked on other days', "Doesn't fit today"];
    for (const i of days.map((d, i) => i).filter(i => /Athens|Naples|Chania/.test(days[i].dest)).slice(0, 4)) {
      await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('sites'); }, i); await p.waitForTimeout(400);
      await p.waitForFunction(() => !window.__kairouteFitPending || window.__kairouteFitPending() === 0, null, { timeout: 20000, polling: 200 }).catch(() => {}); await p.waitForTimeout(600);
      const r = await p.evaluate(() => { const heads = [...document.querySelectorAll('.sitesmain .foldrow span:first-child, .sitesmain .secttl')].map(e => e.innerText.replace(/\s*\(.*$/, '').trim());
        const after = lbl => { const h = [...document.querySelectorAll('.sitesmain .secttl')].find(e => e.innerText.startsWith(lbl)); if (!h) return []; let e = h.nextElementSibling, out = []; while (e && !e.classList.contains('secttl')) { if (e.matches('.sitelist')) out = out.concat([...e.querySelectorAll(':scope > [data-card]')]); e = e.nextElementSibling; } return out; };
        const fits = after('Still fits').concat(after('Also see')), wont = after("Doesn't fit");
        return { heads, fitsNoTick: fits.filter(c => !c.querySelector('input[data-site]')).map(c => c.dataset.card), wontTick: wont.filter(c => c.querySelector('input[data-site]') || !c.querySelector('[data-act="fitask"]')).map(c => c.dataset.card), first: fits.length ? fits[0].dataset.card : null }; });
      const seen = r.heads.filter(h => ORDER.includes(h)), want = ORDER.filter(h => seen.includes(h));
      if (seen.join('|') !== want.join('|')) bad.push(`day ${i + 1}: sections out of order: ${seen.join(', ')}`);
      if (r.fitsNoTick.length) bad.push(`day ${i + 1}: under "Still fits" without a tick: ${r.fitsNoTick.join(', ')}`);
      if (r.wontTick.length) bad.push(`day ${i + 1}: under "Doesn't fit" with a tick or no way to ask why: ${r.wontTick.join(', ')}`);
      if (r.first) { await tapBox(p, r.first); const up = await p.evaluate(id => { const f = document.querySelector('.sitesmain .picksfold'); return !!(f && f.querySelector(`[data-card="${id}"]`)); }, r.first);
        if (!up) bad.push(`day ${i + 1}: ${r.first} ticked but not under Your picks`); else await tapBox(p, r.first); } }
    check('The sight list sorts itself: Your picks, Still fits, Also see, Already picked, Doesn\'t fit (ticks only where it fits)', !bad.length, bad.slice(0, 3).join(' | ')); }

  // 3e. The scorecard's goals, on screen (Nov 19, Richard: "And the phone test"): every day's plan, as the traveler sees it.
  //   - lunch: every day out over lunchtime with sights shows a timed "Lunch:" stop (Richard: "it needs to be notated")
  //   - rides: no ride choice is much slower than its walk where the walk is one this traveler would take (his Rome boats)
  //   - the sight list: every sight listed once
  { const nd = await p.evaluate(() => window.__kairouteDays().length), noLunch = [], slowRide = [], twice = [], notSame = [];
    const mins = t => { const h = /(\d+)\s*h/.exec(t), m = /(\d+)\s*min/.exec(t); return (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0); };
    for (let i = 0; i < nd; i++) {
      await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('plan'); }, i); await p.waitForTimeout(400);
      const r = await p.evaluate(i => { const e = window.__kairouteEngine2()[i] || {}, w = e.w || {}, st = (e.stops || []).length;
        const wants = st > 0 && !e.error && typeof KEngine !== 'undefined' && KEngine.lunchWanted({ start: w.start, endBy: w.endBy, sightFrom: w.sightFrom, sightTo: w.sightTo });
        const tl = [...document.querySelectorAll('.timeline .tl')].map(x => x.innerText.replace(/\s+/g, ' ')).join(' | ');
        const legs = [...document.querySelectorAll('.timeline .tl.leg')].map(x => ({ head: (x.querySelector('.what span') || x).innerText.split('\n')[0], chips: [...x.querySelectorAll('.ridechip')].map(c => ({ k: [...c.classList].find(n => /^k-/.test(n)), t: c.innerText.replace(/\s+/g, ' ') })) }));
        const shown = [...new Set([...document.querySelectorAll('.timeline [data-stop]')].map(x => x.dataset.stop))], planned = [...new Set((e.items || []).filter(x => x.t === 'stop' && !x.along && !x.bonus).map(x => String(x.id)))];
        return { dest: (window.__kairouteDays()[i] || {}).dest, wants, lunch: /Lunch:/.test(tl) || (e.items || []).some(x => x.lunchIn), legs, shown, planned }; }, i);
      if (r.shown.join('>') !== r.planned.join('>')) notSame.push(`day ${i + 1}: screen ${r.shown.join('>')}, plan ${r.planned.join('>')}`);
      if (r.wants && !r.lunch) noLunch.push(`day ${i + 1} (${r.dest})`);
      for (const l of r.legs) { const w = l.chips.find(c => c.k === 'k-walk'); if (!w) continue; const mi = /([\d.]+)\s*mi\b/.exec(l.head), km = mi ? +mi[1] * 1.609 : 0;
        if (km / 1.3 > 2 * 1.7) continue; // the sample trip's traveler walks a medium amount (limit 1.7 km)
        l.chips.filter(c => c.k !== 'k-walk' && c.k !== 'k-car' && c.k !== 'k-taxi' && mins(c.t) > mins(w.t) + 10).forEach(c => slowRide.push(`day ${i + 1}: ${c.t} beside ${w.t}`)); }
      await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('sites'); }, i); await p.waitForTimeout(300);
      const ids = await p.$$eval('input[data-site]', xs => xs.map(x => x.dataset.site)), seen = new Set();
      ids.forEach(id => { if (seen.has(id)) twice.push(`day ${i + 1}: ${id}`); seen.add(id); });
    }
    check('Every day out over lunchtime shows a timed lunch on its plan', !noLunch.length, noLunch.slice(0, 5).join('; '));
    check('No ride choice on any day is much slower than walking it', !slowRide.length, slowRide.slice(0, 5).join('; '));
    check('Every sight is listed once in each day\'s list', !twice.length, twice.slice(0, 5).join('; '));
    check('Every day shows its stops in the order the planner chose', !notSame.length, notSame.slice(0, 3).join('; ')); }
  // 3f. The rest of the scorecard on the phone's own trip (Nov 20, Richard: "And the phone test"): the trip exactly as the
  // phone holds it (its facts and the demo planner's own plans for it) goes through the same leak, demo and order checks.
  { const snap = await p.evaluate(() => window.__kairouteBucket(true)), sd = fs.mkdtempSync(path.join(require('os').tmpdir(), 'phone-snap-'));
    fs.writeFileSync(path.join(sd, 'phone-trip.json'), JSON.stringify(Object.assign({ label: 'the trip on the phone' }, snap)));
    const { execFileSync } = require('child_process'), PD = path.join(__dirname, '..', 'places', 'data');
    const run = (f, a) => { try { return execFileSync('node', [path.join(__dirname, f)].concat(a || []), { env: Object.assign({}, process.env, { SNAP_DIR: sd, PLACES_DIR: PD }), encoding: 'utf8', maxBuffer: 1 << 26 }); } catch (e) { return String(e.stdout || '') + String(e.stderr || ''); } };
    const num = (t, re) => { const m = re.exec(t); return m ? +m[1] : null; };
    const lk = run('leaks.cjs', ['--list']), cmp = run('compare.cjs'), st = run('stress.cjs', ['--list']);
    const nl = num(lk, /(\d+)\s+leaks?\b/i) != null ? num(lk, /(\d+)\s+leaks?\b/i) : num(lk, /leaks?:\s*(\d+)/i), worse = num(cmp, /worse than the old engine:\s*(\d+)/), unsafe = num(cmp, /safety failures:\s*(\d+)/), zig = num(st, /(\d+)\s+order crosses back and forth/) || 0;
    check('No leaks on the trip as the phone holds it', nl === 0, nl == null ? 'leak report did not run: ' + lk.slice(-300) : lk.split('\n').filter(l => /^      \S/.test(l)).slice(0, 3).join(' | '));
    check('No day on the phone is worse than the demo app plans it', worse === 0 && unsafe === 0, `${worse} worse, ${unsafe} safety failures` + (worse || unsafe ? ': ' + cmp.split('\n').filter(l => /WORSE|NEW FAIL/.test(l)).slice(0, 3).map(l => l.trim()).join('; ') : ''));
    check('No day on the phone crosses back and forth', zig === 0, st.split('\n').filter(l => /^      \S/.test(l)).slice(0, 3).join(' | '));
    if (process.env.KEEP_SNAP) fs.copyFileSync(path.join(sd, 'phone-trip.json'), process.env.KEEP_SNAP); fs.rmSync(sd, { recursive: true, force: true }); }

  // 4. Speed: tapping between days, against the demo app on the same trip and the same slowed CPU.
  const b2t = await tapTimes(p);
  let demoMed = null; if (DEMO) { const s2 = await serve(DEMO); const d = await open(browser, s2.url); demoMed = median(await tapTimes(d.p)); await d.ctx.close(); s2.close(); }
  const m = median(b2t);
  check(`Tapping between days is quick (${Math.round(m)} ms on a phone-speed CPU${demoMed != null ? `, demo app ${Math.round(demoMed)} ms` : ''})`, demoMed != null ? m <= Math.max(150, demoMed * 2) : m <= 300, `median ${Math.round(m)} ms`);
  { const sl = tickMs.slice().sort((a, b) => a - b), med = median(sl), worst = sl[sl.length - 1] || 0;
    check(`Ticking a sight answers quickly (median ${med} ms, slowest ${worst} ms on a phone-speed CPU, ${sl.length} taps)`, med <= 700 && worst <= 2500, `median ${med} ms, slowest ${worst} ms`); }
  { const shut = await p.evaluate(() => window.__foldShut || 0); check('A fold the traveler opened never closes by itself', !shut, shut + ' times a fold had closed again before the next tap'); }
  check('No errors in the app', !errs.length, errs.slice(0, 2).join(' | '));
  // 4b. A won't-fit box belongs to its day (Nov 20 sweep: El Escorial's box from one Madrid day stayed over the next
  // day's list, and nothing there could be tapped). Open one, go to another day: no box is left over.
  { const nd = await p.evaluate(() => window.__kairouteDays().length); let found = null;
    for (let i = 0; i < nd && !found; i++) {
      await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('sites'); }, i); await p.waitForTimeout(500);
      await p.waitForFunction(() => !window.__kairouteFitPending || window.__kairouteFitPending() === 0, null, { timeout: 8000, polling: 100 }).catch(() => {});
      const ask = await p.$$eval('#view [data-act="fitask"]', xs => xs.map(x => x.dataset.id).filter(Boolean));
      for (const id of ask.slice(0, 2)) { const sel = `#view [data-act="fitask"][data-id="${id}"]`; if (!(await p.$(sel))) continue; const tA = Date.now(); await tapSel(p, sel);
        await p.waitForSelector('.fitbox', { timeout: 5000 }).catch(() => {}); if (await p.$('.fitbox')) { found = { i, id, ms: Date.now() - tA }; break; } } }
    // The box opens at once and its ways to fit fill in a moment later: they do arrive (never left "working out").
    if (found) { const t0 = Date.now(); await p.waitForFunction(() => !/Working out the ways/.test((document.querySelector('.fitbox') || {}).innerText || ''), null, { timeout: 15000, polling: 100 }).catch(() => {});
      const txt = await p.evaluate(() => (document.querySelector('.fitbox') || {}).innerText || '');
      check("A won't-fit box fills in its ways to fit within a few seconds", !/Working out the ways/.test(txt) && /one tap|no way to fit|Untick picks/i.test(txt) && Date.now() - t0 < 8000, `after ${Date.now() - t0} ms: ${txt.replace(/\s+/g, ' ').slice(0, 160)}`); }
    if (found) { const j = (found.i + 1) % nd; await p.evaluate(j => { window.__kairouteGo('day', j); window.__kairouteGo('sites'); }, j); await p.waitForTimeout(600); }
    check("A won't-fit box closes when the traveler goes to another day", !!found && !(await p.$('.fitbox')), !found ? 'no sight opened a won\'t-fit box' : `the box for ${found.id} (day ${found.i + 1}) stayed open on another day`);
    const left = await p.$('.fitbox'); if (left) await p.evaluate(() => { const b = document.querySelector('.fitbox'); if (b) b.remove(); }); }
  // 5. A hotel the map hasn't placed (typed in or brought in with a trip, no spot yet, no name, or an empty spot) never
  // blanks a day (demo copy rule, Nov 19: the boarding day showed only "Choose where you're staying"). Each hotel day
  // still plans, from the guide's hotel area, and says the hotel isn't placed yet. Last, as it changes the saved trip.
  for (const v of [{ name: 'Hotel Grande Bretagne', ll: null }, { name: '', ll: null }, { name: 'X', ll: { lat: null, lng: null } }]) {
    await p.evaluate(v => { const t = JSON.parse(localStorage.getItem('wayside.trip2')); t.lodging = t.lodging || {};
      for (const d of t.days) { const k = (d.cityKey || d.destination || '').toLowerCase().trim(); if (k) t.lodging[k] = Object.assign({ idx: 'custom' }, v); }
      for (const k of Object.keys(t.lodging)) t.lodging[k] = Object.assign({ idx: 'custom' }, v);
      localStorage.setItem('wayside.trip2', JSON.stringify(t)); }, v);
    await p.reload(); await p.waitForTimeout(4000);
    const days = (await p.evaluate(() => window.__kairouteDays())).filter(x => /^(land|arrival|embark|departure)$/.test(x.type)).slice(0, 5), blank = [], noted = [];
    for (const d of days) { await p.evaluate(i => window.__kairouteAt(i, 'plan'), d.i); await p.waitForTimeout(500);
      const t = await p.evaluate(() => document.getElementById('view').innerText);
      if (/Choose where you're staying/.test(t)) blank.push(d.date + ' ' + d.type); if (/on the map yet/.test(t)) noted.push(d.i); }
    check(`A hotel not on the map yet never blanks a day (${JSON.stringify(v.name)}${v.ll ? ', empty spot' : ''})`, days.length && !blank.length && noted.length, !days.length ? 'no hotel days' : blank.length ? 'blank: ' + blank.join(', ') : 'never says the hotel is not placed yet'); }

  // 6. A day the new planner can't plan says so and shows nothing else, never the old planner's day (Nov 20 review).
  { const d = (await p.evaluate(() => window.__kairouteDays())).find(x => x.type === 'land' || x.type === 'port');
    if (d) { await p.evaluate(i => { window.__kairouteFailDay = i; window.__kairouteAt(i, 'plan'); }, d.i); await p.waitForTimeout(800);
      const t = await p.evaluate(() => document.getElementById('view').innerText), stops = await p.$$eval('#view [data-act="stopinfo"], #view .stop', xs => xs.length).catch(() => 0);
      await p.evaluate(() => { window.__kairouteFailDay = undefined; });
      check('A day the planner can\'t plan says so, with no stand-in plan', /couldn't be planned/.test(t) && !stops, /couldn't be planned/.test(t) ? `${stops} stops shown under the message` : 'no message: ' + t.slice(0, 120).replace(/\s+/g, ' ')); } }
  // 7. A city with more than one station or airport and none chosen: the day asks which, with no leave-by time on a guess,
  //    and once the traveler chooses in the day's settings the day is planned (Nov 20 tester: the wrong station, said with confidence).
  { const days = await p.evaluate(() => window.__kairouteDays()), many = [];
    for (const d of days.filter(x => x.type === 'departure' || x.type === 'arrival')) {
      await p.evaluate(i => window.__kairouteUnpickPoint(i), d.i); await p.waitForTimeout(150);
      const e = await p.evaluate(i => (window.__kairouteEngine2()[i] || {}).error || '', d.i); if (/^Which (station|airport)/.test(e)) many.push(d.i); }
    let ok7 = many.length > 0, why = many.length ? '' : 'no day with more than one station or airport to ask about';
    for (const i of many) { if (!ok7) break;
      const lb = await p.evaluate(i => window.__kairouteLiveTest.alarm(i), i);
      await p.evaluate(i => window.__kairouteAt(i, 'plan'), i); await p.waitForTimeout(500);
      const t = await p.evaluate(() => document.getElementById('view').innerText);
      if (lb || !/Which (station|airport)/.test(t)) { ok7 = false; why = `day ${i + 1}: ${lb ? 'a leave-by time on a guess' : 'no question on the day: ' + t.slice(0, 100).replace(/\s+/g, ' ')}`; break; }
      await p.evaluate(i => window.__kairouteAt(i, 'trip'), i); await p.waitForTimeout(500);
      const sel = await p.$('#f-point'); const ph = sel && await sel.evaluate(x => x.value === '-1' && x.dataset.ask === '1');
      if (!ph) { ok7 = false; why = `day ${i + 1}: the day's settings don't ask which one`; break; }
      await sel.selectOption('0'); await p.waitForTimeout(600);
      const e2 = await p.evaluate(i => (window.__kairouteEngine2()[i] || {}).error || '', i);
      if (e2) { ok7 = false; why = `day ${i + 1}: still not planned after choosing (${e2.slice(0, 80)})`; } }
    check('A city with several stations or airports asks which, gives no time on a guess, and plans the day once chosen', ok7, why); }
  // Not a sight, in any city (competitor review, Nov 20): a stock exchange, an office building, an event such as a crash. Listed
  // monuments and memorials stay. And no staff canteen as a place to eat.
  { const r = await p.evaluate(() => { const no = ['Tokyo Stock Exchange', 'NTT Docomo Yoyogi Building', 'Bijlmer disaster', 'Shell Headquarters'].filter(n => !window.__kairouteNotSpot({ name: n }));
      const yes = ['Senso-ji', 'Empire State Building|h', 'National Monument', 'Bijlmer disaster memorial'].map(n => n.split('|')).filter(([n, h]) => window.__kairouteNotSpot({ name: n, heritage: !!h })).map(x => x[0]);
      const eat = ["Metropolitan Officers' Cafeteria", 'Staff canteen'].filter(n => !KEngine.notPublicEat({ name: n }));
      return { no, yes, eat }; });
    check('A business, an office building or an event is never a sight; a monument or memorial is; a staff canteen is never a place to eat', !r.no.length && !r.yes.length && !r.eat.length,
      `taken as sights: ${r.no.join(', ') || 'none'}; refused: ${r.yes.join(', ') || 'none'}; canteens kept: ${r.eat.join(', ') || 'none'}`); }
  // The leave-by time on every fixed day leaves room for the ride back: leave-by plus the ride is never past the time to be
  // back (Round 1, Nov 20: Ketchikan's badge said leave by 12:15, the time to be back, with a 38 min ride after it).
  { const days = await p.evaluate(() => window.__kairouteDays()), bad = []; let n = 0;
    for (const d of days) { const F = await p.evaluate(i => { try { return window.__kairouteFacts.day(i); } catch (e) { return null; } }, d.i); if (!F || !F.fixed) continue; n++;
      if (F.leaveBy + F.back > F.endBy + 0.5) bad.push(`day ${d.i + 1}: leave by ${F.leaveBy} + ride ${F.back} > back by ${F.endBy}`); }
    check(`Every fixed day's leave-by leaves time for the ride back (${n} days)`, n > 0 && !bad.length, bad.slice(0, 3).join('; ') || 'no fixed day'); }
  // Round 1 part 3 (A4): an earlier start is offered only when it doesn't mean waiting at a door (hours written or assumed).
  { const days = await p.evaluate(() => window.__kairouteDays()), bad = []; let n = 0;
    for (const d of days) { const e = await p.evaluate(i => { try { return window.__kairouteEarlierStart(i); } catch (x) { return { err: String(x) }; } }, d.i); if (!e) continue; n++;
      if (e.err || e.waits.length) bad.push(`day ${d.i + 1}: leave at ${e.start} ${e.err || 'waits at ' + e.waits.join(', ')}`); }
    check(`An earlier start never means waiting for a sight to open (${n} offered)`, !bad.length, bad.slice(0, 3).join('; ')); }
  // A request the helper couldn't finish (a big city's lines, Nov 20: Tokyo got only taxis) is asked again in smaller parts.
  { const r = await p.evaluate(() => { const f = window.__kairouteTransitNextBatch; return f ? [f(12, false, 12), f(6, false, 6), f(2, false, 2), f(6, true, 6), f(12, true, 12)] : null; });
    check('Rides the helper couldn\'t answer in one go are asked again in smaller parts', !!r && r.join() === '6,3,2,7,12', `batch sizes ${r}`); }
  // Famous sights first (competitor review, Nov 20): for each place saved from the sources (tools/beta2/sources, by the
  // Sources probe), the app's sight list offers every sight visitors expect (tools/beta2/fame-expect.json) that the sources
  // return. One the sources don't return at all is a data gap, listed apart.
  { const fe = JSON.parse(fs.readFileSync(path.join(__dirname, 'fame-expect.json'))), SD = path.join(__dirname, 'sources'), fk = t => t.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const miss = [], gaps = []; let n = 0;
    for (const pl of fe.places) { const f = path.join(SD, fk(pl.label) + '.json'); if (!fs.existsSync(f)) continue; const src = JSON.parse(fs.readFileSync(f));
      const r = await p.evaluate(([label, src, expect]) => { const k = t => String(t || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
        const has = (list, names) => list.some(x => names.some(nm => { const a = k(x.name), b = k(nm), c = k(x.local); return a === b || (b.length > 4 && (a.includes(b) || (a.length > 4 && b.includes(a)))) || (c && c === b); }));
        const city = { city: label.split(',')[0], country: '', sites: [], farther: [], starts: {}, restaurants: [] }; window.__kairouteSourceSights(city, src);
        return expect.map(e => { const names = e.split('|'); return { e: names[0], inSrc: has(src.stops || [], names), inApp: has(city.sites, names) }; }); }, [pl.label, src, pl.expect]);
      for (const x of r) { n++; if (!x.inSrc) gaps.push(pl.label.split(',')[0] + ': ' + x.e); else if (!x.inApp) miss.push(pl.label.split(',')[0] + ': ' + x.e); } }
    if (n) check(`Every famous sight the sources know is offered (${n - miss.length - gaps.length} of ${n}; not in the sources at all: ${gaps.join(', ') || 'none'})`, !miss.length, `left out: ${miss.join(', ')}`); }
  // How long to sightsee is set in the day's settings, as in the demo (Richard, Nov 21: "It use to allow you to say how
  // many hours a day you want to site see"), and the plan follows it.
  { const i = await p.evaluate(() => window.__kairouteDays().findIndex(d => d.type === 'land')); let why = '';
    if (i < 0) why = 'no city day in the sample trip';
    else { await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('trip'); }, i); await p.waitForTimeout(800);
      if (!(await p.$('#dayForm #f-hours'))) why = 'no "Hours to sightsee" in the day\'s settings';
      else { const ok = await tapSel(p, '#dayForm [data-hrs="4"]'); await p.waitForTimeout(800);
        await p.evaluate(() => window.__kairouteGo('plan')); await p.waitForTimeout(800);
        const h = await p.evaluate(() => window.__kairouteDayHours.get());
        if (!ok || !h || +h.hours !== 4) why = 'Half day tapped, the day has ' + JSON.stringify(h);
        else { await p.evaluate(() => window.__kairouteGo('trip')); await p.waitForTimeout(600); await p.fill('#f-hours', '6'); await p.$eval('#f-hours', x => x.dispatchEvent(new Event('change', { bubbles: true }))); await p.waitForTimeout(800);
          const h2 = await p.evaluate(() => window.__kairouteDayHours.get()); if (!h2 || +h2.hours !== 6) why = '6 hours typed, the day has ' + JSON.stringify(h2); } } }
    check('The day\'s settings say how many hours to sightsee, and the plan follows', !why, why); }
  // A port whose pier the map search couldn't find (Nov 21 outside check: Dubrovnik and Reykjavik days blank with nothing
  // to do): the day says so and asks for the pier's name; the traveler's pick from the map plans the day from there.
  { const i = await dayIdx(p, /Naples/); let why = '';
    // A name the map knows only as a quarter of the city (Nov 21 live check: the port's quarter, offered as a pier, then
    // nothing at all once areas were refused): the piers and terminals inside it are offered, never the area itself.
    await p.route(u => /\/findplace\?/.test(String(u)), r => { const q = new URL(r.request().url()).searchParams.get('q') || '';
      const places = /^Quarterville$/.test(q) ? [{ name: 'Quarterville', lat: 40.86, lng: 14.27, kind: 'administrative' }]
        : /^cruise terminal$/.test(q) ? [{ name: 'Some Other Cruise Terminal', lat: 40.70, lng: 14.40, kind: 'ferry_terminal' }]
        : /Quarterville/.test(q) ? []
        : [{ name: 'Molo Angioino Cruise Terminal', lat: 40.8385, lng: 14.2545, kind: 'ferry_terminal' }, { name: 'Far Away Pier', lat: 41.9, lng: 12.5, kind: 'pier' }];
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ places }) }); });
    // What the map has drawn around the quarter: a named ferry terminal, an unnamed port area, a far quay with a name.
    await p.route(u => /overpass/.test(String(u)), r => { const b = decodeURIComponent(r.request().postData() || '');
      if (!/ferry_terminal/.test(b)) return r.fallback();
      const els = /around:2000,40\.86000,14\.27000/.test(b) ? [{ type: 'node', lat: 40.865, lon: 14.272, tags: { amenity: 'ferry_terminal', name: 'Quarterville Ferry Terminal' } },
        { type: 'way', center: { lat: 40.862, lon: 14.278 }, tags: { landuse: 'port' } },
        { type: 'node', lat: 40.855, lon: 14.265, tags: { amenity: 'ferry_terminal', name: 'Quarterville' } }, { type: 'node', lat: 40.869, lon: 14.27, tags: { amenity: 'ferry_terminal', name: 'Quarterville' } }] : [];
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: els }) }); });
    await p.evaluate(() => window.__kairouteMockHelper('http://helper.test', null, true));
    await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteLosePier(i); window.__kairouteGo('plan'); }, i);
    const asked = await p.waitForSelector('#pierform #pier-name', { timeout: 8000 }).catch(() => null);
    // Its sight list never says what "fits" a day that has no plan (Nov 21 outside check: "Still fits today (9)").
    if (asked) { await p.evaluate(() => window.__kairouteGo('sites')); await p.waitForTimeout(800);
      const t = await p.evaluate(() => (document.querySelector('main') || document.body).innerText);
      if (/Still fits today|Each one fits as your day stands/.test(t)) why = 'the blank day\'s sight list says sights fit it';
      await p.evaluate(() => window.__kairouteGo('plan')); await p.waitForSelector('#pierform #pier-name', { timeout: 8000 }).catch(() => null); }
    if (why) {} else if (!asked) why = 'no pier form on the blank day: ' + (await p.evaluate(() => (document.querySelector('.card.empty') || {}).innerText || '')).slice(0, 160);
    else { await p.fill('#pier-name', 'Quarterville'); await tapSel(p, '[data-act="piersearch"]'); await p.waitForTimeout(1200);
      const qp = await p.$$eval('[data-pierpick]', xs => xs.map(x => x.innerText.replace(/\s+/g, ' ')));
      check('A name the map knows only as a part of the city offers the terminals and port the map has drawn in it, not the area or one far away', qp.length === 4 && /Quarterville Ferry Terminal/.test(qp[0]) && qp.some(x => /Port area, no name on the map/.test(x)) && !qp.some(x => /Some Other|^Quarterville (administrative|·|ferry terminal)/.test(x)), JSON.stringify(qp));
      // Nov 22 live check: two choices read the same; each one can be told apart.
      const titles = await p.$$eval('[data-pierpick] b', xs => xs.map(x => x.innerText));
      check('The pier choices for a part of the city can each be told apart', new Set(titles).size === titles.length && titles.some(t => /Ferry terminal in Quarterville \(the (north|south)ern one\)/.test(t)), JSON.stringify(titles)); }
    if (!why && asked) { await p.fill('#pier-name', 'Molo Angioino'); await tapSel(p, '[data-act="piersearch"]'); await p.waitForTimeout(800);
      const picks = await p.$$eval('[data-pierpick]', xs => xs.map(x => x.innerText.replace(/\s+/g, ' ')));
      if (picks.length !== 1) why = 'the map answers offered: ' + JSON.stringify(picks) + ' (the one 200 km away must not be)';
      else { await tapSel(p, '[data-pierpick="0"]'); await p.waitForTimeout(1200);
        const r = await p.evaluate(() => ({ err: (document.querySelector('.card.empty') || {}).innerText || '', first: (document.querySelector('.timeline .tl.first') || {}).innerText || '' }));
        if (r.err || !/Molo Angioino/.test(r.first)) why = 'after the pick: ' + (r.err || r.first).replace(/\s+/g, ' ').slice(0, 160); } }
    check('A port whose pier the map can\'t find asks for its name, and the pier picked on the map plans the day', !why, why); }
  await ctx.close(); srv.close(); await browser.close();
  const leaks = results.filter(r => !r.ok);
  for (const r of results) console.log((r.ok ? 'pass  ' : 'LEAK  ') + r.name + (r.ok ? '' : ' — ' + r.why));
  console.log(`Phone-flow check: ${results.length - leaks.length} passed, ${leaks.length} leak${leaks.length === 1 ? '' : 's'}`);
  process.exitCode = leaks.length ? 1 : 0;
})().catch(e => { console.error(e); process.exit(2); });
