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
      // Pick the last visible unticked sight in the main list (the one farthest down the page).
      const id = await p.evaluate(() => { const xs = [...document.querySelectorAll('.sitesmain > .sitelist input[data-site]:not(:checked)')].filter(e => e.closest('.site').offsetParent); const x = xs[xs.length - 1]; return x ? x.dataset.site : null; });
      if (!id) continue; tested++;
      await p.evaluate(id => document.querySelector(`input[data-site="${id}"]`).click(), id); await p.waitForTimeout(900);
      // Doesn't fit: the box opens, the sight stays unticked, timing is shown; untick the suggested picks until it fits, then Add.
      if (await p.evaluate(() => !!document.querySelector('.fitbox'))) {
        boxes++;
        const st = await p.evaluate(id => ({ ticked: document.querySelector(`input[data-site="${id}"]`).checked, meter: !!document.querySelector('.fitbox .meter .mbar'), add: document.querySelector('.fitbox [data-act="fitadd"]').disabled, sugg: [...document.querySelectorAll('.fitbox .fitrow')].filter(r => r.querySelector('.tag.here')).map(r => r.querySelector('input').dataset.fitdrop), more: !!document.querySelector('.fitbox [data-act="fitmore"]') }), id);
        if (SHOTS && !shotTaken[tag + 'o']) { require('fs').mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, `${tag}-box-open.png`) }); shotTaken[tag + 'o'] = 1; }
        if (st.ticked) bad(i, 'sight that does not fit got ticked');
        if (!st.meter) bad(i, 'no timing in the box');
        if (!st.add) bad(i, 'Add is on before it fits');
        if (!st.sugg.length && await p.evaluate(() => !!document.querySelector('.fitbox [data-act="fitday"]'))) {
          const to = await p.evaluate(() => { const b = document.querySelector('.fitbox [data-act="fitday"]'); b.click(); return +b.dataset.fitday; }); await p.waitForTimeout(900); days++;
          const ok = await p.evaluate(([id, to]) => { const x = document.querySelector(`input[data-site="${id}"]`); const chip = document.querySelector(`.daychip[data-day="${to}"]`); return !!(x && x.checked && x.closest('.site.anchor')) && !!chip && (chip.getAttribute('aria-current') || chip.className).length > 0 && !document.querySelector('.meter.full'); }, [id, to]);
          if (!ok) bad(i, `"Add it to another day" did not put ${id} on day ${to + 1} as a fitting pick`);
          await p.evaluate(i => document.querySelector(`.daychip[data-day="${i}"]`).click(), i); await p.waitForTimeout(200);
          continue;
        }
        if (!st.sugg.length && !st.more) { await p.evaluate(() => document.querySelector('.fitbox [data-act="fitcancel"]').click()); await p.waitForTimeout(200); if (await p.evaluate(() => !!document.querySelector('.fitbox'))) bad(i, 'box did not close'); console.log(`note ${tag} day ${i + 1}: nothing can make room for ${id}`); continue; }
        if (st.sugg.length) { for (const sid of st.sugg) { await p.evaluate(sid => document.querySelector(`.fitbox [data-fitdrop="${sid}"]`).click(), sid); await p.waitForTimeout(150); }
          if (await p.evaluate(() => document.querySelector('.fitbox [data-act="fitadd"]').disabled)) { bad(i, 'still does not fit after unticking the suggested picks'); await p.evaluate(() => document.querySelector('.fitbox [data-act="fitcancel"]').click()); continue; }
          if (SHOTS && !shotTaken[tag]) { require('fs').mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, `${tag}-box.png`) }); shotTaken[tag] = 1; }
          await p.evaluate(() => document.querySelector('.fitbox [data-act="fitadd"]').click()); }
        else await p.evaluate(() => document.querySelector('.fitbox [data-act="fitmore"]').click());
        await p.waitForTimeout(900);
        const after = await p.evaluate(id => ({ box: !!document.querySelector('.fitbox'), ticked: document.querySelector(`input[data-site="${id}"]`).checked, banner: document.querySelector('.meter') ? document.querySelector('.meter').classList.contains('full') : false }), id);
        if (after.box || !after.ticked) bad(i, 'Add did not tick the sight');
        if (after.banner) bad(i, 'day is still over after the box said it fits');
      }
      const r = await p.evaluate(id => {
        const first = document.querySelector('.sitesmain .site'), anc = document.querySelectorAll('.site.anchor');
        const main = [...document.querySelectorAll('.sitesmain > .sitelist:not(.anchorlist)')][0];
        const ds = main ? [...main.querySelectorAll('.tag.near')].map(t => { const m = /([\d.]+)\s*(m|km|ft|mi)\b/.exec(t.innerText); return /Right here/.test(t.innerText) ? 0 : m ? +m[1] * ({ m: 0.001, km: 1, ft: 0.0003048, mi: 1.609 })[m[2]] : NaN; }) : [];
        const ids = [...document.querySelectorAll('input[data-site]')].map(x => x.dataset.site);
        const pane = document.querySelector('.sitesmain'), top = first.getBoundingClientRect().top;
        return { firstId: first.querySelector('input').dataset.site, nAnc: anc.length, ds, dup: ids.length - new Set(ids).size, top, h: innerHeight, scrolled: pane.scrollTop };
      }, id);
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
      if (await p.evaluate(() => document.querySelectorAll('.site.anchor, .anchorbar').length)) bad(i, 'anchor stays after unticking');
    }
    if (errs.length) { fails++; console.log(`FAIL ${tag}: page errors: ${errs.slice(0, 3).join(' | ')}`); }
    await ctx.close();
  }
  await b.close();
  console.log(`${tested} picks checked (${boxes} opened the won't-fit box, ${days} moved to another day), ${fails} failure(s)`); process.exit(fails ? 1 : 0);
})();
