// Injection check (security): text that comes from outside (AI answers, map and encyclopedia data, what a traveler
// types) must show as text, never run as code. Puts HTML/script payloads into a day's title and into sights' names,
// descriptions and parts, opens every page of every day on phone and tablet, and fails if any payload ran or
// became a real page element. Run: node tools/inject-check.cjs [index.html]
const { chromium } = require('playwright'); const path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const P = n => `<img src=x id=kinj${n} onerror="window.__inj=(window.__inj||0)+1"><script>window.__inj=99</script>`;
(async () => {
  const b = await chromium.launch(); let fails = 0, pages = 0, shown = 0;
  for (const [tag, vp] of [['phone', { width: 412, height: 900 }], ['tablet', { width: 1280, height: 800 }]]) {
    const p = await b.newPage({ viewport: vp }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { fails++; console.log('FAIL a dialog opened: ' + d.message()); d.dismiss(); });
    await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + FILE); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(800);
    await p.locator('[data-act=continue]').click(); await p.waitForTimeout(400);
    const days = await p.evaluate(() => window.__kairouteDays());
    for (const d of days) {
      await p.evaluate(([i, t]) => window.__kairouteEdit(i, { title: t, titleTyped: true }), [d.i, P('t' + d.i)]);
    }
    // Sight payloads (as outside sources could send them), set inside the page.
    await p.evaluate(P2 => { const mk = n => P2.replace('ID', n); window.__kairouteDays().filter(d => d.city).forEach(d => { const t = window.__kairouteTruth(d.i) || {}; const ids = [].concat(t.picks || [], t.bonus || [], t.dropped || []).map(x => (x && x.id) || x).filter(x => typeof x === 'string').slice(0, 3);
      const patch = {}; ids.forEach((id, n) => { patch[id] = { name: mk(d.i + 's' + n) + ' Sight', blurb: mk(d.i + 'b' + n), parts: [{ name: mk(d.i + 'p' + n), en: mk(d.i + 'e' + n), minutes: 10, guide: mk(d.i + 'g' + n) }] }; }); try { window.__kairouteSiteSet(d.i, patch); } catch (e) {} }); },
      `<img src=x id=kinjID onerror="window.__inj=(window.__inj||0)+1"><script>window.__inj=99</script>`);
    for (const d of days) for (const v of ['plan', 'sites', 'guide', 'tour', 'trip', 'journal']) {
      await p.evaluate(([i, v]) => window.__kairouteAt(i, v), [d.i, v]); await p.waitForTimeout(150); pages++;
      await p.evaluate(() => { document.querySelectorAll('#view .site').forEach(x => x.classList.add('open')); document.querySelectorAll('details').forEach(x => { x.open = true; }); });
      const r = await p.evaluate(() => ({ ran: window.__inj || 0, els: document.querySelectorAll('[id^=kinj]').length, shown: document.body.innerText.includes('<img src=x') }));
      if (r.shown) shown++;
      if (r.ran || r.els) { fails++; console.log(`FAIL ${tag} day ${d.i + 1} ${d.dest} ${v}: payload ${r.ran ? 'ran' : 'became an element'} (${r.els} element(s))`); await p.evaluate(() => { window.__inj = 0; document.querySelectorAll('[id^=kinj]').forEach(e => e.remove()); }); }
    }
    if (errs.length) console.log(`NOTE ${tag}: ${errs.length} script error(s), first: ${errs[0].slice(0, 160)}`);
    await p.close();
  }
  await b.close();
  if (!shown) { fails++; console.log('FAIL the payloads never reached the screen, so this check proved nothing'); }
  console.log(fails ? `Injection check: ${fails} problem(s) over ${pages} pages` : `Injection check passed (${pages} pages, phone and tablet; payload shown as plain text on ${shown})`);
  process.exit(fails ? 1 : 0);
})();
