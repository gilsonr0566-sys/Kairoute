// Missing-sights audit: opens the site (live, or the branch build with URL), opens every day of the example trip so each
// guide and its sources load, then lists for every city the sources' best-known places that the guide lacks or has
// folded into another sight, and every fold of two places more than 1 km apart. Exit 1 when a famous town sight is
// missing or folded into a place over 1 km away. Run by the "Missing sights audit" workflow.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://gilsonr0566-sys.github.io/Kairoute/';
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  await p.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
  await p.goto(URL + (URL.includes('?') ? '&' : '?') + 't=' + Date.now()); await p.waitForFunction(() => window.__kairouteDays && window.__kairouteFamousAudit, null, { timeout: 180000 });
  console.log('Version', await p.evaluate(() => fetch('version.txt', { cache: 'no-store' }).then(r => r.text()).catch(() => '?')));
  const days = await p.evaluate(() => window.__kairouteDays());
  for (const d of days) { if (d.type === 'sea') continue; await p.evaluate(i => window.__kairouteGo('plan', i), d.i); await p.waitForTimeout(6000); }
  await p.waitForTimeout(20000); // sources still arriving
  for (const d of days) { if (d.type === 'sea') continue; await p.evaluate(i => window.__kairouteGo('sites', i), d.i); await p.waitForTimeout(1500); }
  const rows = await p.evaluate(() => window.__kairouteFamousAudit());
  let bad = 0;
  for (const r of rows) {
    console.log(`\n## ${r.city}${r.sources ? '' : ' (sources not loaded)'}`);
    for (const x of r.missing) { console.log('MISSING ' + x); if (/town/.test(x)) bad++; }
    for (const x of r.folded) console.log('FOLDED  ' + x);
    for (const x of r.wideFolds) { console.log('WIDE    ' + x); bad++; }
    if (!r.missing.length && !r.folded.length && !r.wideFolds.length) console.log('ok');
  }
  for (const d of days) if (d.type === 'port' || d.type === 'land') { const w = await p.evaluate(i => window.__kairouteLeadWhy ? window.__kairouteLeadWhy(i) : null, d.i); if (w) console.log('LEAD ' + JSON.stringify(w).slice(0, 1500)); }
  console.log(`\n${bad} problem(s)`); await b.close(); process.exit(bad ? 1 : 0);
})();
