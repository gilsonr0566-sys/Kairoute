// Sea days, boarding days, leaving days and cruise-end days: each paid day gives the traveler something real, and
// no plan ever risks the ship, train or plane. Runs the app's own checks (window.__kairouteVoyageCheck) with no
// network, the way the app works on a ship, and fails the publish if any check fails.
// Usage: node tools/voyage-check.cjs [path/to/index.html]
const { chromium } = require('playwright'); const path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, offline: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
  await p.goto('file://' + FILE); await p.waitForTimeout(600);
  const res = await p.evaluate(() => window.__kairouteVoyageCheck());
  let fails = 0;
  for (const r of res) { if (!r.pass) fails++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.info ? '  (' + r.info + ')' : ''}`); }
  if (errs.length) { fails++; console.log('Page errors:\n  ' + errs.join('\n  ')); }
  console.log(`\n${res.length - fails >= 0 ? res.length - (fails - (errs.length ? 1 : 0)) : 0} of ${res.length} checks passed.`);
  await b.close(); process.exit(fails ? 1 : 0);
})();
