// Day hours check (Richard, Nov 16: "Can you have a way to pick the length of your day?"): the time tile at the top of
// the Day plan opens the day's start and end time; a new end time re-times the day; times stay inside the real limits
// (an arrival day starts once you're in, nothing ends past the latest the planner allows); a shorter day that would
// take picks off asks first ("Keep my hours" / "Shorten anyway"); the tile never claims more hours than the day has.
// Usage: node tools/hours-check.cjs [path/to/index.html | https://… (the live site)]
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
    await p.goto(URL0); await p.waitForFunction(() => window.__kairouteSettled && window.__kairouteSettled() && window.__kairouteDayHours, null, { timeout: LIVE ? 90000 : 30000 });
    if (LIVE && size === 'phone') console.log('site build ' + await p.evaluate(() => { const m = /var B="([^"]+)"/.exec(document.documentElement.innerHTML); return m ? m[1] : '?'; }));
    const frame = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
    const days = await p.evaluate(() => window.__kairouteDays());
    const go = async i => { await p.evaluate(i => window.__kairouteGo('plan', i), i); await frame(); };
    const get = () => p.evaluate(() => window.__kairouteDayHours.get());
    const setT = async (id, v) => { await p.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]); await frame(); };
    const sel = i => p.evaluate(i => window.__kairouteTruth(i).selected.length, i);
    const settle = async () => { if (LIVE) for (let t = 0; t < 120; t++) { if (await p.evaluate(() => window.__kairouteSettled() && !(window.__kairouteUpgrading && window.__kairouteUpgrading()))) break; await p.waitForTimeout(1000); } };
    // ---- A day in a city: start and end can both change
    const Ld = days.find(d => d.type === 'land' && d.city);
    if (!Ld) { fail(`${size}: no city day in the demo trip`); continue; }
    await go(Ld.i); await settle(); await go(Ld.i);
    const tile = await p.evaluate(() => { const t = document.querySelector('.hrstile'); if (!t) return null; const r = t.getBoundingClientRect(); return { h: r.height, text: t.innerText.replace(/\s+/g, ' ') }; });
    if (!tile || tile.h < 44) fail(`${size}: hours tile ${JSON.stringify(tile)}`); else ok(`${size}: the hours tile is a button (${tile.text})`);
    await p.click('.hrstile'); await frame();
    const ed = await p.evaluate(() => ({ s: !!document.getElementById('hrsStart'), e: !!document.getElementById('hrsEnd'), len: document.querySelectorAll('.daylen button').length }));
    if (!ed.s || !ed.e || ed.len !== 3) fail(`${size}: editor ${JSON.stringify(ed)}`); else ok(`${size}: tapping it opens Start and End, with Light / Half / Full still there`);
    const g0 = await get();
    // a later end: a longer day, the tile shows the new end
    await setT('hrsEnd', '20:00'); const g1 = await get(), t1 = await p.evaluate(() => document.querySelector('.hrstile b').textContent);
    if (!(g1.hours > g0.hours) || g1.end !== '20:00' || !t1.endsWith('20:00') || !(await p.evaluate(() => !!document.getElementById('hrsEnd')))) fail(`${size}: later end: ${JSON.stringify(g0)} -> ${JSON.stringify(g1)}, tile ${t1}`); else ok(`${size}: a later end makes the day longer (${g0.start}–${g0.end} -> ${g1.start}–${g1.end}), editor stays open`);
    // past the latest: kept at the latest
    await setT('hrsEnd', '23:59'); const g2 = await get();
    if (g2.end > '23:30') fail(`${size}: end went past 23:30: ${JSON.stringify(g2)}`); else ok(`${size}: an end past the latest stays at ${g2.end}`);
    // a later start, same end: shorter
    await setT('hrsEnd', '19:00'); await setT('hrsStart', '11:00'); const g3 = await get();
    if (g3.start !== '11:00' || g3.end !== '19:00') fail(`${size}: later start: ${JSON.stringify(g3)}`); else ok(`${size}: a later start keeps the end (${g3.start}–${g3.end})`);
    // much shorter: picks would drop, so it asks first
    const n0 = await sel(Ld.i);
    await setT('hrsEnd', '12:15'); await frame();
    const ask = await p.evaluate(() => (document.querySelector('.cutask') || {}).innerText || '');
    if (!ask) fail(`${size}: a much shorter day did not ask (picks ${n0} -> ${await sel(Ld.i)})`);
    else {
      if (await sel(Ld.i) !== n0) fail(`${size}: picks dropped before the answer`); else ok(`${size}: a shorter day asks first: ${ask.replace(/\s+/g, ' ').slice(0, 120)}`);
      await p.click('[data-act="cutkeep"]'); await frame(); const g4 = await get();
      if (g4.start !== '11:00' || g4.end !== '19:00' || await sel(Ld.i) !== n0) fail(`${size}: Keep my hours: ${JSON.stringify(g4)}`); else ok(`${size}: "Keep my hours" puts the hours back, picks kept`);
      if (!(await p.evaluate(() => !!document.getElementById('hrsEnd')))) await p.click('.hrstile');
      await setT('hrsEnd', '12:15'); await p.click('[data-act="cutok"]'); await frame();
      const n5 = await sel(Ld.i), t5 = await p.evaluate(i => window.__kairouteTruth(i), Ld.i);
      if (!(n5 < n0) || t5.over) fail(`${size}: Shorten anyway: picks ${n0} -> ${n5}, over ${t5.over}`); else ok(`${size}: "Shorten anyway" shortens it (${n0} -> ${n5} picks), and the day fits`);
    }
    await p.click('[data-act="hrsdone"]').catch(() => {}); await frame();
    if (await p.evaluate(() => !!document.getElementById('hrsEdit'))) fail(`${size}: Done did not close the editor`); else ok(`${size}: Done closes it`);
    // ---- An arrival day: the start is set by the arrival, the tile never claims more hours than the evening has
    const A = days.find(d => d.type === 'arrival' && d.city);
    if (A) {
      await go(A.i); await settle(); await go(A.i);
      await p.click('.hrstile'); await frame();
      const a = await p.evaluate(() => ({ start: !!document.getElementById('hrsStart'), fixed: (document.querySelector('.hrsfix') || {}).innerText || '' }));
      if (a.start || !a.fixed) fail(`${size}: arrival day start ${JSON.stringify(a)}`); else ok(`${size}: an arrival day's start is set by the arrival: ${a.fixed.replace(/\s+/g, ' ')}`);
      await setT('hrsEnd', '23:59'); const ga = await get();
      const [sh, sm] = ga.start.split(':').map(Number), [eh, em] = ga.end.split(':').map(Number), span = (eh * 60 + em - sh * 60 - sm) / 60;
      if (ga.end > '23:00' || ga.shown > span) fail(`${size}: arrival day ${JSON.stringify(ga)} (span ${span} h)`); else ok(`${size}: an arrival day ends by 23:00, and the tile says ${ga.shown} h for a ${ga.start}–${ga.end} evening`);
    }
    await ctx.close();
  }
  await b.close(); console.log(fails ? `hours-check: ${fails} failed` : 'hours-check: all good'); process.exit(fails ? 1 : 0);
})();
