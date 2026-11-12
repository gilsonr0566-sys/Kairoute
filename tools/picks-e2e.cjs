// Picks, day plan and time meter agree, on the real screens, for every day of the example trip.
// For each day: untick everything -> the meter shows the day free and the plan has no stops; reload -> still
// nothing picked; tick two sights -> each one is on the plan, or named as not fitting or as seen on another
// day, and nothing unticked shows up except labelled bonus stops; the meter's parts add up to its total;
// change the day length -> the picks stay. Usage: node tools/picks-e2e.cjs [path/to/index.html]
const { chromium } = require('playwright'); const path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const mins = t => { let m = 0; const h = /(\d+)\s*h/.exec(t), n = /(\d+)\s*min/.exec(t); if (h) m += +h[1] * 60; if (n) m += +n[1]; return m; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
  await p.goto('file://' + FILE); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(500);
  await p.getByText('Continue trip').click(); await p.waitForTimeout(400);
  const n = await p.evaluate(() => document.querySelectorAll('.daychip').length);
  let fails = 0, tested = 0;
  const bad = (i, msg) => { fails++; console.log(`FAIL day ${i + 1}: ${msg}`); };
  const go = async sel => { await p.evaluate(s => { const el = [...document.querySelectorAll(s)].find(e => e.offsetParent); if (el) el.click(); return !!el; }, sel); await p.waitForTimeout(250); };
  const toDay = async i => { await p.evaluate(i => document.querySelector(`.daychip[data-day="${i}"]`).click(), i); await p.waitForTimeout(250); };
  const toSites = async () => { await go('[data-goto="sites"]'); return p.evaluate(() => !!document.querySelector('input[data-site]')); };
  const meter = () => p.evaluate(() => { const m = document.querySelector('.meter'); if (!m) return null; return { head: m.querySelector('.mrow b').innerText, parts: (m.querySelector('.mparts') || {}).innerText || '', text: m.innerText }; });
  const checked = () => p.evaluate(() => [...document.querySelectorAll('input[data-site]:checked')].map(x => x.dataset.site).sort());
  const planView = () => p.evaluate(() => ({
    stops: [...document.querySelectorAll('.tl')].filter(e => e.querySelector('[data-open]') && !/On the way:/.test(e.innerText)).map(e => ({ name: e.querySelector('.nm').innerText, bonus: !!e.querySelector('.bonus') })),
    banners: [...document.querySelectorAll('.banner')].map(e => e.innerText).join(' | ') }));
  for (let i = 0; i < n; i++) {
    await toDay(i);
    if (!(await toSites())) continue; // a sea day has nothing to pick
    tested++;
    // 1. Untick everything
    await p.evaluate(() => { for (;;) { const el = document.querySelector('input[data-site]:checked'); if (!el) break; el.click(); } });
    await p.waitForTimeout(250);
    if ((await checked()).length) bad(i, 'some picks would not untick');
    const m0 = await meter();
    if (!m0 || !/Nothing picked yet/.test(m0.text)) bad(i, 'meter with nothing picked: ' + (m0 && m0.text.replace(/\s+/g, ' ')));
    else if (/Visits|Lunch|Dinner|Walking/.test(m0.parts)) bad(i, 'meter counts things on a cleared day: ' + m0.parts);
    await go('[data-act="toplan"]');
    const pv0 = await planView();
    if (pv0.stops.length) bad(i, 'plan still shows stops after unticking everything: ' + pv0.stops.map(x => x.name).join(', '));
    // 2. Reload: still nothing picked
    await p.reload(); await p.waitForTimeout(500);
    if (await p.getByText('Continue trip').isVisible().catch(() => false)) await p.getByText('Continue trip').click();
    await toDay(i); await toSites();
    if ((await checked()).length) bad(i, 'picks came back after reload: ' + (await checked()).join(', '));
    // 3. Tick two sights
    const names = await p.evaluate(() => { const out = []; for (const el of document.querySelectorAll('.sitelist input[data-site]:not(:checked)')) { if (!el.closest('.site').offsetParent) continue; out.push([el.dataset.site, el.closest('.site').querySelector('.name').innerText]); if (out.length === 2) break; } return out; });
    for (const [id] of names) { await p.evaluate(id => document.querySelector(`input[data-site="${id}"]`).click(), id); await p.waitForTimeout(200); }
    const picked = await checked();
    if (picked.join() !== names.map(x => x[0]).sort().join()) bad(i, `ticked ${names.map(x => x[0])} but ${picked} are checked`);
    const m1 = await meter();
    if (m1) { const sum = m1.parts.split('·').reduce((a, x) => a + mins(x), 0), head = mins(m1.head.split(' of ')[0]); if (Math.abs(sum - head) > 2) bad(i, `meter parts ${sum} min vs total ${head} min (${m1.parts})`); }
    await go('[data-act="toplan"]');
    const pv1 = await planView();
    for (const [, nm] of names) if (!pv1.stops.some(x => x.name === nm) && !pv1.banners.includes(nm)) bad(i, `${nm} is ticked but neither on the plan nor explained`);
    for (const s of pv1.stops) if (!s.bonus && !names.some(([, nm]) => nm === s.name)) bad(i, `${s.name} is on the plan but wasn't ticked`);
    // 4. Day length keeps the picks
    if (await p.evaluate(() => !!document.querySelector('[data-act="daylen"][aria-pressed="false"]'))) {
      await go('[data-act="daylen"][aria-pressed="false"]'); await toSites();
      if ((await checked()).join() !== picked.join()) bad(i, 'changing the day length changed the picks');
    }
  }
  // 5. Suggest my tour: every pick it makes fits its day, and no sight is on two days
  await toDay(0); await toSites(); await go('[data-act="suggesttour"]'); await p.waitForTimeout(500);
  const seen = new Map();
  for (let i = 0; i < n; i++) {
    const dest = await p.evaluate(i => document.querySelector(`.daychip[data-day="${i}"]`).innerText, i), first = await p.evaluate(() => document.querySelector('.daychip[data-day="0"]').innerText);
    if (dest.split('·')[1].trim() !== first.split('·')[1].trim()) continue;
    await toDay(i); if (!(await toSites())) continue;
    const ids = await checked(); ids.forEach(id => { if (seen.has(id)) bad(i, `Suggest my tour put ${id} on two days`); seen.set(id, i); });
    await go('[data-act="toplan"]'); const pv = await planView();
    if (/Didn't fit today/.test(pv.banners)) bad(i, 'Suggest my tour picked stops that don\'t fit: ' + pv.banners);
    if (pv.stops.filter(x => !x.bonus).length !== ids.length) bad(i, `Suggest my tour ticked ${ids.length} but the plan shows ${pv.stops.filter(x => !x.bonus).length}`);
  }
  // 6. Sync between devices: an untick here beats the other device's older picks, and its newer edits still arrive
  const sc = await p.evaluate(() => window.__kairouteSyncCheck());
  if (!sc.untickKept) { fails++; console.log('FAIL sync: an untick was overwritten by the other device\'s older picks'); }
  if (!sc.renameKept) { fails++; console.log('FAIL sync: the other device\'s newer edit was lost'); }
  if (errs.length) { fails++; console.log('PAGE ERRORS: ' + [...new Set(errs)].join(' | ')); }
  console.log(`\n${tested} days driven on the real screens: ${fails ? fails + ' problems' : 'all agree'}.`);
  await b.close(); process.exit(fails ? 1 : 0);
})();
