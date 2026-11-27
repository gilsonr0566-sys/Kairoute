// Steady sights list (Richard, Nov 17: "still a lot of movement, double sites that should nest inside a main site ...
// this will confuse the heck out of the user"). On phone and tablet, on every city day of the sample trip:
//  - the list is set once when the page opens: ticking, unticking and fit changes never change its order;
//  - every section runs nearest the day's start first (sights planned on other days: by day);
//  - opening the page twice gives the same list (same data, same list);
//  - a sight that arrives while the page is open joins the end of its section, nothing else moves;
//  - "Sort again" puts the day's picks in Your picks;
//  - a sight inside a bigger one (map area, or one half of a joined name) is shown in it as "Included", never as a
//    card or pick of its own; unticking the bigger one unticks what's inside.
// Usage: node tools/picker-check.cjs [index.html]
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); let fails = 0; const ok = (c, m) => { if (!c) { console.log('FAIL ' + m); fails++; } return c; }; const diff = (a, b) => { a = a.split(','); b = b.split(','); const k = a.findIndex((x, i) => x !== b[i]); return k < 0 ? '' : ` [${a.slice(Math.max(0, k - 1), k + 3).join(' ')} -> ${b.slice(Math.max(0, k - 1), k + 3).join(' ')}; gone: ${a.filter(x => !b.includes(x)).join(' ')}; new: ${b.filter(x => !a.includes(x)).join(' ')}]`; };
  for (const [tag, vp] of [['phone', { width: 412, height: 900 }], ['tablet', { width: 1280, height: 800 }]]) {
    const p = await b.newPage({ viewport: vp }); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'))); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(600);
    await p.locator('[data-act=continue]').click(); await p.waitForTimeout(400);
    const days = (await p.evaluate(() => window.__kairouteDays())).filter(d => d.city && d.type !== 'sea');
    for (let w = 0; w < 300 && !(await p.evaluate(() => window.__kairouteSeedDone())); w++) await p.waitForTimeout(100); // every day's starting picks made first
    const open = async i => { await p.evaluate(i => window.__kairouteAt(i, 'plan'), i); await p.waitForTimeout(80); await p.evaluate(i => window.__kairouteAt(i, 'sites'), i); for (let w = 0; w < 80 && await p.evaluate(() => window.__kairouteFitPending()); w++) await p.waitForTimeout(50); await p.waitForTimeout(150); };
    const list = () => p.evaluate(() => [...document.querySelectorAll('.sitesmain [data-card]')].map(c => c.dataset.card).join(','));
    let ticks = 0;
    for (const d of days) {
      await open(d.i); const L0 = await list(); if (!L0) continue;
      await open(d.i); { const L1 = await list(); ok(L1 === L0, `${tag} day ${d.i + 1} ${d.dest}: opening the list twice gives a different list${diff(L0, L1)}`); }
      // Nearest first in every section (the distance line is from the day's start).
      const secs = await p.evaluate(() => [...document.querySelectorAll('.sitesmain .sitelist:not(.sched)')].map(l => [...l.querySelectorAll(':scope > [data-card] .l2')].map(t => { const m = /([\d.,]+)\s*(ft|mi|m|km)\s+from\b/.exec(t.textContent); return /\bAt /.test(t.textContent) ? 0 : m ? +m[1].replace(',', '') * ({ m: 0.001, km: 1, ft: 0.0003048, mi: 1.609 })[m[2]] : null; })));
      for (const L of secs) { const v = L.filter(x => x != null); for (let k = 1; k < v.length; k++) if (!ok(v[k] + 0.06 >= v[k - 1], `${tag} day ${d.i + 1} ${d.dest}: a section isn't nearest-first (${v.join(', ')})`)) break; }
      // Tick up to three free sights one after another, then untick them: the order never changes.
      const free = await p.evaluate(() => [...document.querySelectorAll('.sitesmain .sitelist:not(.anchorlist) label.site input[data-site]:not(:checked)')].filter(x => !x.closest('details')).map(x => x.dataset.site));
      const done = [];
      for (const id of [free[0], free[Math.floor(free.length / 2)], free[free.length - 1]].filter((x, k, a) => x && a.indexOf(x) === k)) {
        const has = await p.evaluate(id => !!document.querySelector(`input[data-site="${id}"]:not(:checked)`), id); if (!has) continue;
        await p.evaluate(id => document.querySelector(`input[data-site="${id}"]`).click(), id); await p.waitForTimeout(250);
        if (await p.evaluate(() => !!document.querySelector('.fitbox'))) { await p.evaluate(() => document.querySelector('.fitbox [data-act="fitcancel"]').click()); await p.waitForTimeout(100); }
        else done.push(id);
        for (let w = 0; w < 80 && await p.evaluate(() => window.__kairouteFitPending()); w++) await p.waitForTimeout(50);
        { const L1 = await list(); ok(L1 === L0, `${tag} day ${d.i + 1} ${d.dest}: ticking ${id} changed the list's order${diff(L0, L1)}`); } ticks++;
      }
      for (const id of done) { await p.evaluate(id => { const x = document.querySelector(`input[data-site="${id}"]`); if (x && x.checked) x.click(); }, id); await p.waitForTimeout(200);
        ok((await list()) === L0, `${tag} day ${d.i + 1} ${d.dest}: unticking ${id} changed the list's order`); }
    }
    ok(ticks > 10, `${tag}: only ${ticks} ticks tried`);
    // Sort again: the picks go into Your picks.
    const ath = days.find(d => /athens/i.test(d.dest)); await open(ath.i);
    const t = await p.evaluate(() => { const x = [...document.querySelectorAll('.sitesmain .sitelist:not(.anchorlist) label.site input[data-site]:not(:checked)')].find(x => !x.closest('details')); if (x) x.click(); return x && x.dataset.site; }); await p.waitForTimeout(300);
    if (t && !(await p.evaluate(() => !!document.querySelector('.fitbox')))) {
      await p.evaluate(() => document.querySelector('[data-act="sortagain"]').click()); await p.waitForTimeout(300);
      ok(await p.evaluate(t => !!document.querySelector(`.picksfold input[data-site="${t}"]:checked`), t), `${tag}: after Sort again ${t} is not in Your picks`);
      await p.evaluate(t => document.querySelector(`input[data-site="${t}"]`).click(), t); await p.waitForTimeout(200);
    }
    // A sight that arrives while the list is open (a fuller guide) joins the end of its section; nothing else moves.
    await open(ath.i); const before = (await list()).split(',');
    await p.evaluate(i => window.__kairouteArea.addSites(i, [{ id: 'zz-late', name: 'Kairoute Late Sight', category: 'museum', lat: 37.9715, lng: 23.7257, minutes: 30, summary: 'x', guide: 'x' }]), ath.i);
    await p.evaluate(() => window.__kairouteAt(window.__kairouteDays().findIndex(() => true) >= 0 ? null : 0, 'sites')).catch(() => {});
    await p.evaluate(i => { window.__kairouteAt(i, 'sites'); }, ath.i).catch(() => {}); // a re-render on the same page
    const after = (await list()).split(',').filter(x => x !== 'zz-late');
    ok(JSON.stringify(after) === JSON.stringify(before), `${tag}: a sight arriving later moved others`);
    // Nesting: Rome with the map's answer that the Sistine Chapel and St Peter's Square stand in Vatican City, and a
    // joined name holding another sight.
    const R = days.find(d => /rome/i.test(d.dest)).i;
    await p.evaluate(R => window.__kairouteArea.addSites(R, [
      { id: 'vatican-city', name: 'Vatican City', category: 'city-state', lat: 41.904, lng: 12.453, minutes: 125, wd: 'Q237', summary: 'x', guide: 'x' },
      { id: 'sistine', name: 'Sistine Chapel', category: 'chapel', lat: 41.90296, lng: 12.45443, minutes: 45, summary: 'x', guide: 'x' },
      { id: 'piazza-sp', name: 'Piazza San Pietro', category: 'square', lat: 41.90218, lng: 12.45724, minutes: 30, summary: 'x', guide: 'x' },
      { id: 'forum-x', name: 'Roman Forum', category: 'ancient site', lat: 41.8925, lng: 12.4853, minutes: 60, summary: 'x', guide: 'x' }]), R);
    await p.evaluate(R => { const VAT = [{ n: 'Civitas Vaticana - Città del Vaticano', en: 'Vatican City', wd: 'Q237' }]; const ks = window.__kairouteArea.keysFor(R); const m = {}; ks.forEach(k => { m[k.key] = ['sistine', 'piazza-sp', 'vatican-city'].includes(k.id) ? VAT : []; }); window.__kairouteArea.set(m); }, R);
    await open(R);
    const nest = await p.evaluate(() => { const card = id => document.querySelector(`.sitesmain [data-card="${id}"]`); const v = card('vatican-city'); const col = [...document.querySelectorAll('.sitesmain [data-card]')].find(c => /Colosseum/.test(c.textContent)); return { kids: ['sistine', 'piazza-sp', 'forum-x'].filter(id => card(id) || document.querySelector(`input[data-site="${id}"]`)), vat: v ? (v.querySelector('.incl') || {}).textContent || '' : null, col: col ? (col.querySelector('.incl') || {}).textContent || '' : null }; });
    ok(!nest.kids.length, `${tag}: sights inside a bigger one still have their own card: ${nest.kids.join(', ')}`);
    ok(/Sistine Chapel/.test(nest.vat || '') && /Piazza San Pietro/.test(nest.vat || ''), `${tag}: Vatican City doesn't show what it includes (${nest.vat})`);
    ok(nest.col == null || /Roman Forum/.test(nest.col), `${tag}: "Colosseum and Roman Forum" doesn't include the Roman Forum (${nest.col})`);
    // Wikidata says the clock is part of the cathedral: the clock is shown in the cathedral's card.
    await p.evaluate(R => { window.__kairouteArea.addSites(R, [
      { id: 'zz-cath', name: 'Kairoute Test Cathedral', category: 'cathedral', lat: 41.8986, lng: 12.4769, minutes: 40, wd: 'Q900001', summary: 'x', guide: 'x' },
      { id: 'zz-clock', name: 'Kairoute Test Clock', category: 'clock', lat: 41.8987, lng: 12.4771, minutes: 15, wd: 'Q900002', summary: 'x', guide: 'x' }]); window.__kairoutePartSet({ Q900002: { p: ['Q900001'], at: [] } }); }, R);
    await open(R);
    const wdn = await p.evaluate(() => ({ clock: !!document.querySelector('.sitesmain [data-card="zz-clock"]'), incl: ((document.querySelector('.sitesmain [data-card="zz-cath"] .incl') || {}).textContent || '') }));
    ok(!wdn.clock && /Kairoute Test Clock/.test(wdn.incl), `${tag}: a sight Wikidata places inside another isn't shown in it (${JSON.stringify(wdn)})`);
    // Mars Hill (Richard, Nov 17): just below the Acropolis but outside its fence, its own site. Wikidata's loose "part of"
    // for a sight a short walk away never nests it; neither does being next to it.
    const ath2 = days.find(d => /athens/i.test(d.dest)).i;
    await p.evaluate(i => { window.__kairouteArea.addSites(i, [
      { id: 'zz-acro', name: 'Kairoute Test Acropolis', category: 'ancient site', lat: 37.9715, lng: 23.7267, minutes: 120, wd: 'Q900011', summary: 'x', guide: 'x' },
      { id: 'zz-hill', name: 'Kairoute Test Hill', category: 'hill', lat: 37.9724, lng: 23.7235, minutes: 25, wd: 'Q900012', summary: 'x', guide: 'x' }]); window.__kairoutePartSet({ Q900012: { p: ['Q900011'], at: [] } }); }, ath2);
    await open(ath2);
    ok(await p.evaluate(() => !!document.querySelector('.sitesmain [data-card="zz-hill"]')), `${tag}: a site a short walk from a bigger one (Mars Hill and the Acropolis) was folded into it`);
    // A pick saved under an id the guide has since changed (a fuller guide came in) still counts on its own day: on
    // another day in that city it is under "Already scheduled", not offered as free (Nov 17 gate: ticking the hearted
    // Jun 30 Acropolis on Jul 1 took it off the locked day).
    const athD = days.filter(d => /athens/i.test(d.dest)).map(d => d.i);
    if (ok(athD.length >= 2, `${tag}: the sample trip has two Athens days`)) {
      const [A, B] = athD;
      await p.evaluate(A => { const s = (window.__kairouteTruth(A).selected || []).filter(x => x !== 'zz-acro'); window.__kairouteEdit(A, { selected: s.concat(['zz-acro-old']), mine: s.concat(['zz-acro-old']), pickNames: { 'zz-acro-old': 'Kairoute Test Acropolis' } }); }, A);
      await p.evaluate(B => { const s = (window.__kairouteTruth(B).selected || []).filter(x => x !== 'zz-acro'); window.__kairouteEdit(B, { selected: s, mine: s }); }, B);
      await p.evaluate(() => { window.__kairouteGo && window.__kairouteGo('plan', 0); }); await open(B);
      const where = await p.evaluate(() => { const c = document.querySelector('.sitesmain [data-card="zz-acro"]'); return c ? (c.closest('.sitelist.sched') ? 'sched' : (c.closest('.sitelist, details') || {}).className || '?') : 'none'; });
      ok(where === 'sched', `${tag}: a pick saved under an older id on day ${A + 1} is offered as free on day ${B + 1} (${where})`);
    }
    // A sight inside picked on its own (an older trip) shows its bigger one ticked; unticking it takes both off.
    await p.evaluate(R => { const s = window.__kairouteTruth(R).selected || []; window.__kairouteEdit(R, { selected: s.concat(['sistine']), mine: s.concat(['sistine']) }); }, R); await open(R);
    ok(await p.evaluate(() => !!document.querySelector('input[data-site="vatican-city"]:checked')), `${tag}: Vatican City isn't shown ticked when the Sistine Chapel is picked`);
    await p.evaluate(() => document.querySelector('input[data-site="vatican-city"]').click()); await p.waitForTimeout(250);
    ok(!(await p.evaluate(R => (window.__kairouteTruth(R).selected || []).some(x => x === 'sistine' || x === 'vatican-city'), R)), `${tag}: unticking Vatican City left what's inside it picked`);
    ok(!errs.length, `${tag}: page errors: ${errs.join(' | ')}`);
    await p.close();
  }
  await b.close();
  console.log(fails ? `${fails} sights list problem(s)` : 'Sights list check passed: steady order, nearest first, same list twice, nested sights included');
  process.exit(fails ? 1 : 0);
})();
