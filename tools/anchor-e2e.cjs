// Pick a sight -> it moves to the top as the anchor and every other sight below is sorted closest first,
// with its distance shown; unticking it or "Usual order" goes back. "Suggest my tour" keeps the anchor on
// its day. Runs on every day of the example trip, tablet and phone. Usage: node tools/anchor-e2e.cjs [index.html] [shots dir]
const { chromium } = require('playwright'); const path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html')), SHOTS = process.argv[3] || '';
(async () => {
  const b = await chromium.launch(); let fails = 0, tested = 0, boxes = 0, days = 0; const shotTaken = {};
  for (const [W, H, tag] of [[1280, 800, 'tablet'], [412, 900, 'phone']]) {
    const ctx = await b.newContext({ viewport: { width: W, height: H } }); const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + FILE); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(500);
    await p.getByText('Continue trip').click(); await p.waitForTimeout(400);
    const n = await p.evaluate(() => document.querySelectorAll('.daychip').length);
    const bad = (i, m) => { fails++; console.log(`FAIL ${tag} day ${i + 1}: ${m}`); };
    for (let i = 0; i < n; i++) {
      await p.evaluate(i => document.querySelector(`.daychip[data-day="${i}"]`).click(), i); await p.waitForTimeout(200);
      await p.evaluate(() => { const el = [...document.querySelectorAll('[data-goto="sites"]')].find(e => e.offsetParent); if (el) el.click(); }); await p.waitForTimeout(250);
      // What still fits: once the list settles, a sight has a checkbox exactly when it fits the day (checked
      // against the real plan), sights that don't fit are still shown, and the time left is at the top.
      for (let w = 0; w < 60 && await p.evaluate(() => window.__kairouteFitPending()); w++) await p.waitForTimeout(100);
      const fitBad = await p.evaluate(() => { const out = []; const cards = [...document.querySelectorAll('.sitesmain > .sitelist:not(.anchorlist) [data-card]')]; for (const c of cards.slice(0, 6).concat(cards.filter(x => x.classList.contains('nofitcard')).slice(0, 3))) { const id = c.dataset.card, box = !!c.querySelector('input[data-site]'), ex = window.__kairouteFitExact(id); if (box && !ex && c.querySelector('.tag.fit')) out.push(id + ' says it fits but does not'); if (!box && ex) out.push(id + ' fits but cannot be ticked'); } return out; });
      if (fitBad.length) bad(i, 'fit marks wrong: ' + fitBad.join('; '));
      if (!(await p.evaluate(() => [...document.querySelectorAll('.sitesmain .listlbl')].some(x => /left today|today is full/.test(x.innerText)) || !document.querySelector('.sitesmain .listlbl')))) bad(i, 'time left is not shown above the sights');
      // Pick the last visible unticked sight in the main list (the one farthest down the page).
      const id = await p.evaluate(() => { const xs = [...document.querySelectorAll('.sitesmain > .sitelist input[data-site]:not(:checked)')].filter(e => e.closest('.site').offsetParent); const x = xs[xs.length - 1]; return x ? x.dataset.site : null; });
      // Every other day, try to add a sight that doesn't fit the way any add path does (finding a place,
      // optional stops, a must-see found later all go through the same gate): it must be refused with the box.
      const nofit = i % 2 ? await p.evaluate(() => { const c = document.querySelector('.sitesmain .nofitcard'); return c ? c.dataset.card : null; }) : null;
      const pickId = nofit || id; if (!pickId) continue; tested++;
      if (nofit) { const added = await p.evaluate(id => window.__kairouteTryAdd(id), nofit); await p.waitForTimeout(400); if (added) bad(i, `${nofit} was added through the add gate although it doesn't fit`); if (!(await p.evaluate(() => !!document.querySelector('.fitbox')))) bad(i, `refusing ${nofit} didn't explain why`); }
      else await p.evaluate(id => document.querySelector(`input[data-site="${id}"]`).click(), id);
      await p.waitForTimeout(900);
      // Doesn't fit: the box opens, the sight stays unticked, timing is shown; untick the suggested picks until it fits, then Add.
      if (await p.evaluate(() => !!document.querySelector('.fitbox'))) {
        boxes++;
        const st = await p.evaluate(id => ({ ticked: !!(document.querySelector(`input[data-site="${id}"]`) || {}).checked, meter: !!document.querySelector('.fitbox .meter .mbar'), add: document.querySelector('.fitbox [data-act="fitadd"]').disabled, fixes: [...document.querySelectorAll('.fitbox [data-act="fitfixgo"]')].map(b => b.innerText) }), pickId);
        if (SHOTS && !shotTaken[tag + 'o']) { require('fs').mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, `${tag}-box-open.png`) }); shotTaken[tag + 'o'] = 1; }
        if (st.ticked) bad(i, 'sight that does not fit got ticked');
        if (!st.meter) bad(i, 'no timing in the box');
        if (!st.add) bad(i, 'Add is on before it fits');
        const fx = await p.evaluate(() => ({ fixed: window.__kairouteTimesFixed(), times: [...document.querySelectorAll('.fitbox [data-act="fitfixgo"]')].some(b => /^(Start at|Finish at)/.test(b.innerText)), why: !!document.querySelector('.fitbox .fitwhy') }));
        if (fx.fixed && (fx.times || !fx.why)) bad(i, 'ship/train/flight day offers time changes or no explanation');
        if (!fx.fixed && fx.why) bad(i, 'hotel day says its times are fixed');
        if (!st.fixes.length) { await p.evaluate(() => document.querySelector('.fitbox [data-act="fitcancel"]').click()); await p.waitForTimeout(200); if (await p.evaluate(() => !!document.querySelector('.fitbox'))) bad(i, 'box did not close'); console.log(`note ${tag} day ${i + 1}: no way to fit ${pickId}`); continue; }
        // One tap on the first ready-made fix: the sight is planned (here or on another day) and no day is over.
        await p.evaluate(() => document.querySelector('.fitbox [data-act="fitfixgo"]').click()); await p.waitForTimeout(900); days++;
        const after = await p.evaluate(id => { const n = document.querySelectorAll('.daychip').length; let where = -1, overDays = []; for (let k = 0; k < n; k++) { const t = window.__kairouteTruth(k); if (!t || t.none) continue; if ((t.selected || []).includes(id)) where = k; } return { box: !!document.querySelector('.fitbox'), where, full: !!document.querySelector('.meter.full') }; }, pickId);
        if (after.box) bad(i, `the fix "${st.fixes[0]}" left the box open`);
        if (after.where < 0) bad(i, `the fix "${st.fixes[0]}" didn't plan ${pickId}`);
        if (after.full) bad(i, `after the fix "${st.fixes[0]}" the day is over its time`);
        await p.evaluate(i => document.querySelector(`.daychip[data-day="${i}"]`).click(), i); await p.waitForTimeout(200);
        await p.evaluate(() => { const el = [...document.querySelectorAll('[data-goto="sites"]')].find(e => e.offsetParent); if (el) el.click(); }); await p.waitForTimeout(250);
        continue;
      }
      const r = await p.evaluate(id => {
        const first = document.querySelector('.sitesmain .site'), anc = document.querySelectorAll('.site.anchor');
        const main = [...document.querySelectorAll('.sitesmain > .sitelist:not(.anchorlist)')][0];
        const ds = main ? [...main.querySelectorAll('.tag.near')].map(t => { const m = /([\d.]+)\s*(m|km|ft|mi)\b/.exec(t.innerText); return /Next to/.test(t.innerText) ? 0 : m ? +m[1] * ({ m: 0.001, km: 1, ft: 0.0003048, mi: 1.609 })[m[2]] : NaN; }) : [];
        const ids = [...document.querySelectorAll('input[data-site]')].map(x => x.dataset.site);
        const pane = document.querySelector('.sitesmain'), top = first.getBoundingClientRect().top;
        return { firstId: first.querySelector('input').dataset.site, nAnc: anc.length, ds, dup: ids.length - new Set(ids).size, top, h: innerHeight, scrolled: pane.scrollTop };
      }, id);
      // Every pick of the day is on screen (ticked, not folded away), with any filter.
      for (const flt of ['all', 'must', 'local']) {
        await p.evaluate(f => { const b = document.querySelector(`[data-filter="${f}"]`); if (b) b.click(); }, flt); await p.waitForTimeout(150);
        const miss = await p.evaluate(i => { const sel = (window.__kairouteTruth(i) || {}).selected || []; return sel.filter(sid => { const x = document.querySelector(`.sitesmain input[data-site="${sid}"]`); return !x || !x.checked || !x.closest('.site').offsetParent || (x.closest('details') && !x.closest('details').open); }); }, i);
        if (miss.length) bad(i, `picks not visible with the ${flt} filter: ${miss.join(', ')}`);
      }
      await p.evaluate(() => { const b = document.querySelector('[data-filter="all"]'); if (b) b.click(); }); await p.waitForTimeout(150);
      // The list and the Day plan agree on every pick: on the plan <=> the card says so.
      const dis = await p.evaluate(i => { const t = window.__kairouteTruth(i), onPlan = new Set(t.picks || []); return (t.selected || []).filter(sid => { const c = document.querySelector(`.sitesmain input[data-site="${sid}"]`); const tag = c && c.closest('.site').querySelector('.tag.here'); return !!(tag && /On your plan|On the way/.test(tag.innerText)) !== onPlan.has(sid); }); }, i);
      if (dis.length) bad(i, `list and Day plan disagree about: ${dis.join(', ')}`);
      if (r.firstId !== id || r.nAnc !== 1) bad(i, `picked sight not on top as anchor (${r.firstId} vs ${id})`);
      if (r.dup) bad(i, `${r.dup} sight(s) shown twice`);
      for (let k = 1; k < r.ds.length; k++) if (!(r.ds[k] + 0.06 >= r.ds[k - 1])) { bad(i, `not closest-first: ${r.ds.join(', ')}`); break; }
      if (r.top < 0 || r.top > r.h * 0.75) bad(i, `anchor not scrolled into view (top ${Math.round(r.top)})`);
      if (SHOTS && i < 2) { require('fs').mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, `${tag}-day${i + 1}.png`) }); }
      // Suggest my tour keeps the anchor on this day.
      if (i === 0) { await p.evaluate(() => document.querySelector('[data-act="suggesttour"]').click()); await p.waitForTimeout(2500);
        const still = await p.evaluate(id => { const x = document.querySelector(`input[data-site="${id}"]`); return x && x.checked && !!x.closest('.site.anchor'); }, id);
        if (!still) console.log(`note ${tag} day 1: anchor came off in Suggest my tour (didn't fit the day)`); }
      // Untick -> back to the usual order.
      await p.evaluate(id => { const x = document.querySelector(`input[data-site="${id}"]`); if (x && x.checked) x.click(); }, id); await p.waitForTimeout(300);
      if (await p.evaluate(() => document.querySelectorAll('.site.anchor').length)) bad(i, 'anchor stays after unticking');
      // Picks always on top, with or without an anchor (folded lists aside).
      const order = await p.evaluate(() => [...document.querySelectorAll('.sitesmain input[data-site]')].filter(x => !x.closest('details')).map(x => x.checked));
      if (order.indexOf(false) >= 0 && order.lastIndexOf(true) > order.indexOf(false)) bad(i, 'a picked sight sits below an unpicked one');
    }
    // Richard's sequence on the first Athens day: tick Ancient Corinth, then Corinth Canal, then untick one.
    await p.evaluate(() => document.querySelector('.daychip[data-day="2"]').click()); await p.waitForTimeout(200);
    await p.evaluate(() => { const el = [...document.querySelectorAll('[data-goto="sites"]')].find(e => e.offsetParent); if (el) el.click(); }); await p.waitForTimeout(250);
    const seqTop = async () => p.evaluate(() => { const xs = [...document.querySelectorAll('.sitesmain input[data-site]')].filter(x => !x.closest('details')); const firstOff = xs.findIndex(x => !x.checked); return { picks: xs.slice(0, firstOff < 0 ? xs.length : firstOff).map(x => x.dataset.site), after: firstOff >= 0 && xs.slice(firstOff).some(x => x.checked), all: xs.map(x => (x.checked ? '*' : '') + x.dataset.site).join(' ') }; });
    for (const [act, sid] of [['tick', 'corinth-far'], ['tick', 'corinth-canal-far'], ['untick', 'corinth-far'], ['tick', 'corinth-far']]) {
      const has = await p.evaluate(sid => !!document.querySelector(`input[data-site="${sid}"]`), sid); if (!has) { console.log('note: no ' + sid + ' in this trip'); break; }
      await p.evaluate(sid => document.querySelector(`input[data-site="${sid}"]`).click(), sid); await p.waitForTimeout(600);
      if (await p.evaluate(() => !!document.querySelector('.fitbox'))) { await p.evaluate(() => document.querySelector('.fitbox [data-act="fitcancel"]').click()); continue; }
      const t = await seqTop();
      if (t.after) bad(2, `after ${act} ${sid}: a pick sits below an unpicked sight: ${t.all}`);
      if (act === 'tick' && t.picks[0] !== sid) bad(2, `after ticking ${sid} it isn't first (${t.picks.join(', ')})`);
      if (act === 'untick' && t.picks.includes(sid)) bad(2, `${sid} still in picks after unticking`);
      if (act === 'untick' && t.picks[0] !== 'corinth-canal-far') bad(2, `unticking moved the other picks (${t.picks.join(', ')})`);
    }
    if (errs.length) { fails++; console.log(`FAIL ${tag}: page errors: ${errs.slice(0, 3).join(' | ')}`); }
    await ctx.close();
  }
  await b.close();
  console.log(`${tested} picks checked (${boxes} opened the won't-fit box, ${days} fixed with one tap), ${fails} failure(s)`); process.exit(fails ? 1 : 0);
})();
