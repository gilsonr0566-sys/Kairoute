// Screen text check: what the traveler reads is English only and never says "None", "null" or "undefined"
// (Richard, Nov 16: Erechtheion's "What's here" showed "12 minΕρέχθειο", "Local name: Ερέχθειο" and hours
// ending "· None"). Every city day's sights list (every card opened) and Guide are read on phone and tablet,
// after one sight is given the kind of data the live sources send: parts named in Greek, a local name, "None".
const { chromium } = require('playwright'); const path = require('path');
const FOREIGN = /[Ͱ-Ͽἀ-῿Ѐ-ӿ֐-׿؀-ۿ぀-ヿ一-鿿가-힯]/;
const EMPTY = /(^|[\s·:(])(None|null|undefined|NaN)([\s·.,)]|$)/m;
(async () => {
  const b = await chromium.launch(); let fails = 0;
  for (const [tag, vp] of [['phone', { width: 412, height: 900 }], ['tablet', { width: 1280, height: 800 }]]) {
    const p = await b.newPage({ viewport: vp }); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + path.resolve('index.html')); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(800);
    await p.getByText('Continue trip').click(); await p.waitForTimeout(400);
    const days = (await p.evaluate(() => window.__kairouteDays())).filter(d => d.city);
    // Live-style data on one Athens sight.
    const ath = days.find(d => /athens/i.test(d.dest));
    if (ath) await p.evaluate(i => window.__kairouteSiteSet(i, { acropolis: { parts: [{ name: 'Ερέχθειο', en: 'Erechtheion', minutes: 12, guide: 'x' }, { name: 'Caryatids Καρυάτιδες', minutes: 10, guide: 'x' }, { name: 'Παρθενώνας', minutes: 20, guide: 'x' }], local: 'Ακρόπολη Αθηνών', closed: 'None', hours: 'Mo-Su 08:00-20:00', src: ['Wikipedia', 'Wikivoyage'], travel: 'null' } }), ath.i);
    for (const d of days) {
      for (const v of ['sites', 'guide']) {
        await p.evaluate(([i, v]) => window.__kairouteAt(i, v), [d.i, v]); await p.waitForTimeout(250);
        const t = await p.evaluate(() => { document.querySelectorAll('#view .site').forEach(x => x.classList.add('open')); document.querySelectorAll('#view details').forEach(x => { x.open = true; }); const v = document.querySelector('#view'); const c = v.cloneNode(true); c.querySelectorAll('.phrases, .phrase, [lang]:not([lang^="en"])').forEach(x => x.remove()); document.body.appendChild(c); c.style.position = 'absolute'; c.style.left = '-9999px'; const s = c.innerText; c.remove(); return s; });
        const lines = t.split('\n'), bad = lines.filter(l => FOREIGN.test(l) || EMPTY.test(l));
        if (bad.length) { fails++; console.log(`FAIL ${tag} day ${d.i + 1} ${d.dest} ${v}: ${bad.slice(0, 4).map(l => JSON.stringify(l.slice(0, 90))).join(' | ')}`); }
      }
    }
    if (ath) { await p.evaluate(i => window.__kairouteAt(i, 'sites'), ath.i); await p.waitForTimeout(250);
      const what = await p.evaluate(() => { const c = document.querySelector('#view [data-card="acropolis"]'); return c ? c.innerText : ''; });
      if (!/Erechtheion/.test(what)) { fails++; console.log(`FAIL ${tag}: a part with an English name doesn't show it (${JSON.stringify(what.slice(0, 200))})`); } }
    // Interest labels (Richard, Nov 16: Bernabéu had none; parks said "Nature" though he never chose it): every card
    // has a label; a label naming a setup interest is always one the traveler chose, highlighted. Run with the
    // sample trip's interests and again with only History chosen (most cards then fall back to what they are).
    const SETUP = { history: 'History', art: 'Art & museums', architecture: 'Architecture', food: 'Food & markets', views: 'Views & nature', churches: 'Churches & faith', bible: 'Bible sites', shopping: 'Shopping', beaches: 'Beaches', kids: 'Kid-friendly' };
    const ints0 = (await p.evaluate(() => window.__kairoutePrefs({}))).interests || [];
    for (const ints of [ints0, ['history']]) {
      await p.evaluate(x => window.__kairoutePrefs({ interests: x }), ints); let cards = 0, bare = [], wrong = [];
      for (const d of days) {
        await p.evaluate(i => window.__kairouteAt(i, 'sites'), d.i); await p.waitForTimeout(200);
        const r = await p.evaluate(() => [...document.querySelectorAll('#view [data-card]')].map(c => ({ n: (c.querySelector('.name') || {}).textContent, l: [...c.querySelectorAll('.tags.ints .tag')].map(t => ({ t: t.textContent.trim(), mine: t.classList.contains('mine') })) })));
        cards += r.length;
        for (const c of r) { if (!c.l.length || c.l.some(x => !x.t)) bare.push(`${d.dest}: ${c.n}`);
          for (const x of c.l) { const k = Object.keys(SETUP).find(k => SETUP[k] === x.t); if ((k && !ints.includes(k)) || (k && !x.mine) || (!k && x.mine)) wrong.push(`${d.dest}: ${c.n} "${x.t}"`); } }
      }
      if (bare.length) { fails++; console.log(`FAIL ${tag} [${ints}]: ${bare.length} of ${cards} cards have no interest label: ${bare.slice(0, 5).join('; ')}`); }
      if (wrong.length) { fails++; console.log(`FAIL ${tag} [${ints}]: label names an interest not chosen (or isn't marked): ${wrong.slice(0, 5).join('; ')}`); }
      if (!cards) { fails++; console.log(`FAIL ${tag}: no sight cards found`); }
    }
    if (errs.length) { fails++; console.log(`FAIL ${tag}: page errors: ${errs.join(' | ')}`); }
    await p.close();
  }
  await b.close();
  console.log(fails ? `${fails} screen text problem(s)` : 'Screen text check passed: English only, no None/null on any sights list or guide');
  process.exit(fails ? 1 : 0);
})();
