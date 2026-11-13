// Back-to-the-ship check: on every ship, train and flight day the countdown sits in the Day plan's top row and
// never leaves the screen (on phones it pins to the top when you scroll), its colour follows the time left
// (green, amber at 30 min, red at 15, flashing at leave-by), and a re-render never moves the timeline you are
// reading. Fails the publish otherwise. Usage: node tools/ship-check.cjs [path/to/index.html]
const { chromium } = require('playwright'); const path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const SIZES = [['tablet sideways', 1280, 800], ['tablet upright', 800, 1280], ['phone', 412, 860]];
(async () => {
  const b = await chromium.launch(); let fails = 0;
  const fail = m => { fails++; console.log('FAIL ' + m); };
  for (const [name, w, h] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
    const p = await ctx.newPage(); p.on('pageerror', e => fail(`${name}: page error ${e.message}`));
    await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + FILE); await p.waitForTimeout(500);
    const days = await p.evaluate(() => window.__kairouteDays());
    const fixedDays = days.filter(d => d.city && (d.type === 'port' || d.type === 'embark' || d.type === 'departure'));
    let ok = 0;
    for (const D of fixedDays) {
      await p.evaluate(i => window.__kairouteGo('plan', i), D.i); await p.waitForTimeout(100);
      const r = await p.evaluate(() => { const c = document.getElementById('cdCard'); if (!c) return 'no countdown';
        if (!c.closest('.dayhead')) return 'countdown is not in the top row';
        if (document.querySelector('.right.pane #cdCard, .timeline #cdCard')) return 'countdown is inside the timeline side';
        // Exactly one deadline clock on the page (Richard, Nov 13: two clocks with different times could make someone miss the ship).
        if (document.querySelectorAll('#cdCard, #cdBig, .cdchip').length !== 2 || document.querySelectorAll('#cdBig').length !== 1) return 'more than one countdown on the page';
        const sum = (document.querySelector('.daysum') || {}).textContent || '';
        if (/back on board|at the (station|airport|port)|finish/i.test(sum)) return 'a second deadline time is shown in the day summary: ' + sum.replace(/\s+/g, ' ').trim();
        const s = c.querySelector('summary').getBoundingClientRect(); if (s.top < 0 || s.bottom > innerHeight || s.height < 40) return 'countdown not fully on screen';
        if (!/\d/.test(document.getElementById('cdBig').textContent)) return 'no time shown'; return ''; });
      if (r) fail(`${name}, day ${D.i + 1} (${D.dest}): ${r}`); else ok++;
    }
    // Scroll the timeline (or the page, on phones), then re-render: nothing may move, and the countdown stays visible.
    const D = fixedDays.find(d => d.type === 'port');
    await p.evaluate(i => window.__kairouteGo('plan', i), D.i); await p.waitForTimeout(150);
    const before = await p.evaluate(() => { const r = document.querySelector('.right.pane'); if (r && r.scrollHeight > r.clientHeight + 50) { r.scrollTop = 400; return { pane: r.scrollTop }; } window.scrollTo(0, 1200); return { win: scrollY }; });
    await p.waitForTimeout(200);
    await p.evaluate(() => window.__kairouteLiveTest.render()); await p.waitForTimeout(200);
    const after = await p.evaluate(() => { const r = document.querySelector('.right.pane'); const s = document.querySelector('#cdCard > summary').getBoundingClientRect();
      return { pane: r && r.scrollHeight > r.clientHeight + 50 ? r.scrollTop : undefined, win: scrollY, chip: s.top >= 0 && s.bottom <= innerHeight }; });
    if (before.pane != null && Math.abs(after.pane - before.pane) > 2) fail(`${name}: timeline jumped from ${before.pane} to ${after.pane} on a re-render`);
    if (before.win != null && Math.abs(after.win - before.win) > 2) fail(`${name}: page jumped from ${before.win} to ${after.win} on a re-render`);
    if (!after.chip) fail(`${name}: countdown went off screen after scrolling`);
    // Colours by time left.
    const at = m => new Date(`${D.date}T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(((m % 60) + 60) % 60).padStart(2, '0')}:00`);
    for (const [want, mins] of [['', 60], ['amber', 25], ['soon', 10], ['go', -2]]) {
      let t = 15 * 60;
      for (let k = 0; k < 4; k++) { await p.clock.setFixedTime(at(t)); await p.evaluate(i => window.__kairouteGo('plan', i), D.i); await p.waitForTimeout(80);
        const lb = await p.evaluate(() => { const m = /leave by (\d\d):(\d\d)/i.exec((document.getElementById('cdSub') || {}).textContent || ''); return m ? +m[1] * 60 + +m[2] : null; }); if (lb == null) break; t = lb - mins; }
      await p.clock.setFixedTime(at(t)); await p.evaluate(i => window.__kairouteGo('plan', i), D.i); await p.waitForTimeout(120);
      const cls = await p.evaluate(() => ['amber', 'soon', 'go'].filter(c => document.getElementById('cdCard').classList.contains(c)).join(' '));
      if (cls !== want) fail(`${name}: ${mins} min before leave-by the countdown is "${cls || 'green'}", should be "${want || 'green'}"`);
    }
    console.log(`ok   ${name} (${w}x${h}): countdown in the top row on ${ok} of ${fixedDays.length} ship, train and flight days; stays on screen; colours follow the time left`);
    await ctx.close();
  }
  await b.close();
  if (fails) { console.log(`ship-check: ${fails} problem(s)`); process.exit(1); }
  console.log('ship-check: all good');
})();
