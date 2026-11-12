// Pre-records every built-in city stop in the default guide voice, using the live app's own code, so
// travelers' first play is instant and free. Stops when today's allowance gets low (keeps 15,000 for
// live use) and picks up where it left off on the next run: finished stops are cached and cost nothing.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('https://gilsonr0566-sys.github.io/Kairoute/?v=' + Date.now()); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(4000);
  p.on('console', m => console.log(m.text()));
  const r = await p.evaluate(() => window.kairoutePrewarm ? window.kairoutePrewarm(15000) : { error: 'old page' });
  const msg = r.error ? 'Prewarm: ' + r.error : r.stopped ? `Prewarm: ${r.done} of ${r.total} stops ready. Paused to keep today's allowance for live use; the next nightly run continues.` : `Prewarm: all ${r.total} stops are recorded.`;
  console.log(msg); if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, msg + '\n');
  await b.close();
})().catch(e => { console.log('Prewarm could not run: ' + e.message); });
