// "Don't see a place you want?" (Richard, Nov 14: typing a real place found nothing): with the AI allowance used up,
// a real place is still found from the map and encyclopedia answers and added to the list (and to today when it
// fits); a name the guide already has ("Roman Agora") picks that sight instead of a copy; a name nobody knows says
// so plainly. The map lookups are answered by this test. Usage: node tools/addplace-e2e.cjs [index.html]
const { chromium } = require('playwright'); const path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const GROUND = {
  "Hadrian's Library": { wiki: [{ title: "Hadrian's Library", extract: "Hadrian's Library was created by Roman Emperor Hadrian in AD 132 on the north side of the Acropolis of Athens. It followed a typical Roman Forum architectural style.", lat: 37.9757, lng: 23.7262 }], map: [{ name: "Hadrian's Library", lat: 37.97573, lng: 23.72619, kind: "archaeological_site", osm: "way123" }], answered: true },
  "Zzyzx Qwerty": { wiki: [], map: [], answered: true },
};
(async () => {
  const b = await chromium.launch(); let fails = 0; const bad = m => { fails++; console.log('FAIL ' + m); };
  for (const [W, H, tag] of [[412, 900, 'phone'], [1280, 800, 'tablet']]) {
    const p = await b.newPage({ viewport: { width: W, height: H } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', r => { const u = r.request().url();
      if (u.startsWith('https://mock.test/ground')) { const names = JSON.parse(r.request().postData() || '{}').names || []; return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ results: names.map(n => GROUND[n] || { wiki: [], map: [], answered: true }), center: { lat: 37.9755, lng: 23.7348 } }) }); }
      return /^file:/.test(u) ? r.continue() : r.abort(); });
    await p.goto('file://' + FILE); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(500);
    await p.locator('[data-act=continue]').click(); await p.waitForTimeout(300);
    await p.evaluate(() => window.__kairouteMockHelper('https://mock.test'));
    await p.evaluate(() => window.__kairouteAt(2, 'sites')); await p.waitForTimeout(400);
    const type = async name => { await p.fill('#addPlace', name); await p.evaluate(() => [...document.querySelectorAll('[data-act="addplace"]')].find(e => !e.disabled).click());
      await p.waitForFunction(() => { const i = document.getElementById('addPlace'); return i && !i.disabled; }, null, { timeout: 30000 }); await p.waitForTimeout(300);
      return p.evaluate(nm => { const card = [...document.querySelectorAll('[data-card]')].find(c => (c.querySelector('.name') || {}).innerText === nm);
        return { err: [...document.querySelectorAll('.banner.warn[role="alert"]')].map(e => e.innerText).join(' | '), note: ((document.querySelector('.addplace .banner') || {}).innerText || ''), box: !!document.querySelector('.fitbox'), card: !!card, ticked: !!(card && card.querySelector('input:checked')), n: document.querySelectorAll('[data-card]').length }; }, name); };
    const before = await p.evaluate(() => document.querySelectorAll('[data-card]').length);
    // 1. A real place, AI allowance used up: found from the map, in the list, picked or explained.
    let r = await type("Hadrian's Library");
    if (r.err) bad(`${tag}: Hadrian's Library shows an error: ${r.err}`);
    if (!r.card) bad(`${tag}: Hadrian's Library is not in the list`);
    if (!r.ticked && !r.box) bad(`${tag}: Hadrian's Library neither picked nor explained`);
    if (!/Hadrian's Library/.test(r.note)) bad(`${tag}: no note saying Hadrian's Library was added (${r.note})`);
    if (r.box) await p.evaluate(() => document.querySelector('.fitbox [data-act="fitcancel"]').click());
    // 2. A name the guide has, in short: no copy, the existing sight is used.
    const n1 = await p.evaluate(() => document.querySelectorAll('[data-card]').length);
    r = await p.evaluate(() => [...document.querySelectorAll('[data-card] .name')].map(e => e.innerText).find(t => /^Roman Agora/.test(t)) || null);
    if (r) { const res = await type('Roman Agora'); if (res.n !== n1) bad(`${tag}: "Roman Agora" added a copy`); if (res.err) bad(`${tag}: "Roman Agora" shows an error: ${res.err}`); if (!/Roman Agora/.test(res.note) && !res.box) bad(`${tag}: "Roman Agora" gave no answer`); if (res.box) await p.evaluate(() => document.querySelector('.fitbox [data-act="fitcancel"]').click()); }
    else console.log(`note ${tag}: no Roman Agora in this guide`);
    // 3. Nothing anywhere: said plainly, naming the AI allowance.
    r = await type('Zzyzx Qwerty');
    if (!/couldn't find "Zzyzx Qwerty"/.test(r.err) || !/allowance/.test(r.err)) bad(`${tag}: unknown place not explained (${r.err})`);
    if (errs.length) bad(`${tag}: page errors: ${errs.slice(0, 2).join(' | ')}`);
    console.log(`${tag}: ${before} sights before, Hadrian's Library added`);
    await p.close();
  }
  await b.close(); console.log(fails ? `${fails} failure(s)` : 'Add a place check passed'); process.exit(fails ? 1 : 0);
})();
