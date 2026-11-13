// Navigation bar check: the nav bar (left rail on sideways tablets and computers, bottom bar on upright tablets,
// bottom tab bar on phones) must sit in exactly the same place, at the same size, on every page, in every orientation.
// Fails the publish if any page draws it differently. Usage: node tools/nav-check.cjs [path/to/index.html]
const { chromium } = require('playwright'); const path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const SIZES = [['tablet upright', 800, 1280], ['tablet upright, browser bars', 800, 1180], ['tablet sideways', 1280, 800], ['tablet sideways, browser bars', 1280, 720], ['computer', 1440, 900], ['phone', 412, 860], ['phone small', 360, 740], ['phone sideways', 860, 412]];
const PAGES = ['trip', 'plan', 'sites', 'guide', 'journal', 'settings', 'privacy', 'terms'];
(async () => {
  const b = await chromium.launch(); let fails = 0;
  for (const [name, w, h] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
    const p = await ctx.newPage(); p.on('pageerror', e => { console.log(`FAIL ${name}: page error ${e.message}`); fails++; });
    await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + FILE); await p.waitForTimeout(500);
    const boxes = {};
    for (const v of PAGES) {
      await p.evaluate(v => window.__kairouteGo(v, 0), v); await p.waitForTimeout(150);
      boxes[v] = await p.evaluate(() => {
        const t = document.querySelector('header.top .tabs'); if (!t) return 'missing';
        const r = t.getBoundingClientRect(), cs = getComputedStyle(t);
        if (cs.display === 'none' || cs.visibility === 'hidden' || !r.width || !r.height) return 'hidden';
        const tabs = [...t.querySelectorAll('.tab')].filter(x => x.getBoundingClientRect().width);
        const wrapped = tabs.some(x => x.getBoundingClientRect().height > tabs[0].getBoundingClientRect().height + 2 || x.scrollWidth > x.clientWidth + 1);
        return [r.left, r.top, r.width, r.height].map(Math.round).join(',') + ` ${tabs.length} tabs` + (wrapped ? ' WRAPPED' : '');
      });
    }
    const want = boxes.plan, bad = PAGES.filter(v => boxes[v] !== want || /WRAPPED|missing|hidden/.test(boxes[v]));
    if (bad.length) { fails++; console.log(`FAIL ${name} (${w}x${h}): nav bar on Day plan is ${want}; ` + bad.map(v => `${v}: ${boxes[v]}`).join('; ')); }
    else console.log(`ok   ${name} (${w}x${h}): ${want} on all ${PAGES.length} pages`);
    await ctx.close();
  }
  await b.close();
  if (fails) { console.log(`\nNav bar check failed in ${fails} size(s).`); process.exit(1); }
  console.log('\nNav bar check passed');
})();
