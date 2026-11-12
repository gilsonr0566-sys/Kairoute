// Lists every sight Kairoute's guides offer for each city of the example trip, as the live site has them
// (full guides load from the shared cache). Run by the "List guide sights" workflow.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } }); p.on('response', r => { if (r.status() >= 500) console.log('HTTP ' + r.status() + ' ' + r.url().slice(0, 160)); });
  await p.goto('https://gilsonr0566-sys.github.io/Kairoute/?t=' + Date.now()); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(3000);
  await p.click('[data-act="continue"]').catch(() => {}); await p.waitForTimeout(800);
  const n = await p.evaluate(() => document.querySelectorAll('.daychip').length);
  for (let i = 0; i < n; i++) { await p.click(`.daychip[data-day="${i}"]`).catch(() => {}); await p.click('#tab-plan').catch(() => {}); for (let t = 0; t < 40; t++) { await p.waitForTimeout(1500); if (!(await p.evaluate(() => window.__kairouteUpgrading()))) break; } }
  console.log('SIGHTS ' + JSON.stringify(await p.evaluate(() => window.__kairouteSights())));
  await b.close();
})();
