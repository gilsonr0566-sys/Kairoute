// Drag to reorder check (Richard, Nov 16): every stop on the Day plan has a handle; dragging it (finger) or the arrow
// keys put the stops in a new order and the day is planned again in that order; an order that costs a stop the
// traveler picked asks first ("Put back" / "Keep new order") and never gives up the time back to the ship; a day
// marked ready asks before its order changes and only then loses its heart; "Use Kairoute's best order" goes back.
// Usage: node tools/reorder-check.cjs [path/to/index.html | https://… (the live site, with its real services)]
const { chromium } = require('playwright'); const path = require('path');
const ARG = process.argv[2] || '', LIVE = /^https?:/.test(ARG), FILE = LIVE ? '' : path.resolve(ARG || path.join(__dirname, '..', 'index.html'));
const URL0 = LIVE ? ARG : 'file://' + FILE;
(async () => {
  const b = await chromium.launch(); let fails = 0; const fail = m => { fails++; console.log('FAIL ' + m); }, ok = m => console.log('ok   ' + m);
  for (const [size, w, h] of [['phone', 412, 900], ['tablet', 1280, 800]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
    const p = await ctx.newPage(); p.on('pageerror', e => fail(`${size}: page error ${e.message}`));
    if (!LIVE) await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto(URL0); await p.waitForFunction(() => window.__kairouteSettled && window.__kairouteSettled() && window.__kairouteOrder, null, { timeout: LIVE ? 90000 : 30000 });
    if (LIVE && size === 'phone') console.log('site build ' + await p.evaluate(() => { const m = /var B="([^"]+)"/.exec(document.documentElement.innerHTML); return m ? m[1] : '?'; }));
    const days = await p.evaluate(() => window.__kairouteDays()), D = days.find(d => d.type === 'port' && d.city);
    const frame = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
    const go = async () => { await p.evaluate(i => window.__kairouteGo('plan', i), D.i); await frame(); };
    const ids = () => p.evaluate(() => window.__kairouteOrder.ids());
    const truth = () => p.evaluate(i => { const t = window.__kairouteTruth(i); return { kept: t.keptNames, end: t.end, endBy: t.endBy, over: t.over, sel: t.selected }; }, D.i);
    const notes = () => p.evaluate(() => [...document.querySelectorAll('.asknote')].map(x => x.innerText.replace(/\s+/g, ' ')));
    await go();
    // On the live site the city's shared guide can arrive in the first moments and replace the built-in one (new ids for
    // the same places): start once the day's stops have stayed the same for a few seconds.
    if (LIVE) { let last = '', same = 0; for (let t = 0; t < 240 && same < 4; t++) { await p.waitForTimeout(1000); await go(); const now = (await ids()).join(), up = await p.evaluate(() => window.__kairouteUpgrading && window.__kairouteUpgrading()); same = now === last && !up ? same + 1 : 0; last = now; } }
    // 0. Full details shows no handles; Compact shows them (Richard, Nov 17: dragging is hard when fully open)
    const fullH = await p.evaluate(() => [...document.querySelectorAll('.draghandle')].filter(x => x.offsetParent).length);
    // Change the order is in the day's More menu (outside UI review, Nov 20): open it, then pick the item.
    await p.click('details.planmore:has([data-act="tlview"]) > summary'); await frame(); await p.click('[data-act="tlview"][data-v="compact"]'); await frame();
    const cmp = await p.evaluate(() => ({ on: !!document.querySelector('.timeline.compact'), saved: localStorage.getItem('kairoute.tlview'), chips: [...document.querySelectorAll('.timeline .ridechips')].filter(x => x.offsetParent).length }));
    if (fullH || !cmp.on || cmp.saved !== 'compact' || cmp.chips) fail(`${size}: view switch: ${fullH} handles in Full details, compact ${JSON.stringify(cmp)}`); else ok(`${size}: Full details has no handles; Compact shows them, hides the ride buttons, and is remembered`);
    // 1. A handle on every stop, big enough for a finger
    const hs = await p.evaluate(() => { const r = [...document.querySelectorAll('.timeline .tl[data-stop]')]; return { rows: r.length, handles: r.filter(x => x.querySelector('.draghandle')).length, small: [...document.querySelectorAll('.draghandle')].filter(x => { const b = x.getBoundingClientRect(); return b.width < 44 || b.height < 44; }).length }; });
    if (hs.rows < 3 || hs.handles !== hs.rows || hs.small) fail(`${size}: handles ${JSON.stringify(hs)}`); else ok(`${size}: a 44 px handle on each of the ${hs.rows} stops`);
    const start = await ids();
    // 2. Arrow keys: the stop moves one place, the day is planned in that order, focus stays on it
    await p.focus('.draghandle'); await p.keyboard.press('ArrowDown'); await frame();
    const k1 = await ids(), foc = await p.evaluate(() => document.activeElement && document.activeElement.dataset.drag);
    if (k1[1] !== start[0] || k1[0] !== start[1] || foc !== start[0]) fail(`${size}: arrow key: ${start.join(',')} -> ${k1.join(',')}, focus ${foc}`); else ok(`${size}: the arrow keys move a stop and keep it in focus`);
    // 3. Dragging with a finger (touch): the third stop goes above the second
    await p.evaluate(() => document.querySelectorAll('.timeline .tl[data-stop]')[1].scrollIntoView({ block: 'center' })); await frame();
    const before = await ids(), hb = await (await p.$$('.draghandle'))[2].boundingBox(), r2 = await (await p.$$('.timeline .tl[data-stop]'))[1].boundingBox();
    const cdp = await ctx.newCDPSession(p), T = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const x = hb.x + hb.width / 2; let y = hb.y + hb.height / 2; await T('touchStart', x, y);
    while (y > r2.y + 10) { y -= 12; await T('touchMove', x, y); await frame(); }
    await T('touchEnd', x, y); await p.waitForFunction(b => window.__kairouteOrder.ids().join() !== b, before.join(), { timeout: 5000 }).catch(() => {});
    const t1 = await ids(), want = [before[0], before[2], before[1], ...before.slice(3)];
    const saved = await p.evaluate(i => (JSON.parse(localStorage.getItem('wayside.trip2')).days[i].order || []).join(), D.i);
    if (t1.join() !== want.join() || saved !== t1.join()) fail(`${size}: drag: ${before.join(',')} -> ${t1.join(',')} (wanted ${want.join(',')}), saved ${saved}`); else ok(`${size}: dragging a stop with a finger puts it there, and the order is saved with the trip`);
    // 4. "Use Kairoute's best order" goes back to the app's own order
    await p.click('[data-act="orderreset"]'); await frame();
    if ((await ids()).join() !== start.join() || await p.evaluate(i => window.__kairouteOrder.get(i), D.i)) fail(`${size}: best order did not come back`); else ok(`${size}: "Use Kairoute's best order" puts the app's order back`);
    // 4b. Lunch moves with the route by itself; one the traveler drags stays where they put it (Richard: "would you move a lunch automatically")
    const mealRow = () => p.evaluate(() => { const rows = [...document.querySelectorAll('.timeline .tl[data-stop], .timeline .tl[data-meal]')]; const mi = rows.findIndex(r => r.dataset.meal); return mi < 0 ? null : { after: mi ? rows[mi - 1].dataset.stop || null : '^', name: rows[mi].querySelector('.nm').textContent }; });
    const m0 = await mealRow();
    if (!m0) fail(`${size}: no lunch row with a handle`);
    else {
      await p.focus('.tl[data-meal] .draghandle'); await p.keyboard.press('ArrowUp'); await frame();
      const pin = await p.evaluate(i => window.__kairouteOrder.meals(i), D.i), m1 = await mealRow(), lbl = pin && Object.keys(pin)[0];
      const okPin = pin && m1 && m1.after === pin[lbl] && m1.after !== m0.after;
      // reorder the stops: a dragged lunch keeps its place after the same stop
      const cur = await ids(); await p.evaluate(([i, q]) => window.__kairouteOrder.set(i, q), [D.i, cur.slice().reverse()]); await frame();
      const m2 = await mealRow();
      if (!okPin || !m2 || (pin[lbl] !== '^' && m2.after !== pin[lbl])) fail(`${size}: dragged lunch: before ${JSON.stringify(m0)}, pin ${JSON.stringify(pin)}, after move ${JSON.stringify(m1)}, after reorder ${JSON.stringify(m2)}`);
      else ok(`${size}: lunch dragged earlier stays after the stop it was put after, even when the stops are reordered (${m1.name})`);
      await p.click('[data-act="orderreset"]'); await frame();
      if (await p.evaluate(i => window.__kairouteOrder.meals(i), D.i)) fail(`${size}: best order kept the lunch pin`);
    }
    // 5. An order that costs a picked stop asks first; the time back to the ship never gives
    const sel0 = (await truth()).sel.slice().sort().join();
    let found = null;
    for (let i = 0; i < start.length && !found; i++) for (let j = 0; j < start.length && !found; j++) {
      if (i === j) continue; const q = start.slice(); q.splice(j, 0, q.splice(i, 1)[0]);
      await p.evaluate(([i, q]) => window.__kairouteOrder.set(i, q), [D.i, q]); await frame();
      if (await p.evaluate(i => window.__kairouteOrder.pending(i), D.i)) found = q; else { await p.click('[data-act="orderreset"]').catch(() => {}); await frame(); }
    }
    if (!found) fail(`${size}: no order of the stops cost a stop, so the question could not be checked`);
    else {
      const n = await notes(), t = await truth(), dropBanner = await p.evaluate(() => [...document.querySelectorAll('.banner.dropped')].map(x => x.innerText).join(' '));
      const pend = await p.evaluate(i => window.__kairouteOrder.pending(i), D.i), name = pend.names[0];
      if (!n.some(s => s.includes(name) && /Put back/.test(s) && /Keep new order/.test(s))) fail(`${size}: no question naming ${name}: ${JSON.stringify(n)}`);
      else if (t.sel.slice().sort().join() !== sel0) fail(`${size}: a pick came off before the traveler answered`);
      else if (t.over || t.end > t.endBy) fail(`${size}: the new order runs past the time back (${t.end} > ${t.endBy})`);
      else if (dropBanner.includes(name)) fail(`${size}: ${name} is named twice (question and "Didn't fit today")`);
      else ok(`${size}: an order that costs ${name} asks first: ${n.find(s => s.includes(name)).split('?')[0]}?`);
      await p.click('.asknote [data-act="orderback"]'); await frame();
      if ((await ids()).join() !== start.join() || (await truth()).sel.slice().sort().join() !== sel0) fail(`${size}: Put back did not restore the order and picks`); else ok(`${size}: "Put back" restores the stops as they were`);
      await p.evaluate(([i, q]) => window.__kairouteOrder.set(i, q), [D.i, found]); await frame();
      await p.click('.asknote [data-act="orderkeep"]'); await frame();
      const t2 = await truth();
      if (t2.sel.length >= sel0.split(',').length || (await ids()).join() === start.join() || t2.over || t2.end > t2.endBy || (await notes()).length) fail(`${size}: Keep new order: ${JSON.stringify(t2)} ${JSON.stringify(await notes())}`); else ok(`${size}: "Keep new order" keeps it, without the stop that no longer fits, still back in time`);
      await p.click('[data-act="orderreset"]'); await frame();
    }
    // 6. A day marked ready asks before its order changes; the heart comes off only with a yes
    await go(); const cur = await ids();
    await p.evaluate(i => window.__kairouteReady.mark(i), D.i); await go();
    await p.focus('.draghandle'); await p.keyboard.press('ArrowDown'); await frame();
    const a1 = await notes(), o1 = await ids(), r1 = await p.evaluate(i => window.__kairouteReady.state(i), D.i);
    if (!a1.some(s => /marked ready/.test(s)) || o1.join() !== cur.join() || r1 !== 'ok') fail(`${size}: hearted day: ${JSON.stringify(a1)} order ${o1.join(',')} heart ${r1}`); else ok(`${size}: a day marked ready asks before its order changes`);
    await p.click('[data-act="readyorderno"]'); await frame();
    if ((await ids()).join() !== cur.join() || await p.evaluate(i => window.__kairouteReady.state(i), D.i) !== 'ok') fail(`${size}: "Keep it as it was" changed the day`); else ok(`${size}: "Keep it as it was" leaves the order and the heart`);
    await p.focus('.draghandle'); await p.keyboard.press('ArrowDown'); await frame(); await p.click('[data-act="readyorderyes"]'); await frame();
    const o2 = await ids(), r2s = await p.evaluate(i => window.__kairouteReady.state(i), D.i);
    if (o2[1] !== cur[0] || r2s) fail(`${size}: "Change the order": ${o2.join(',')} heart "${r2s}"`); else ok(`${size}: "Change the order" changes it and takes the heart off`);
    await ctx.close();
  }
  await b.close();
  if (fails) { console.log(`reorder-check: ${fails} problem(s)`); process.exit(1); }
  console.log('reorder-check: all good');
})();
