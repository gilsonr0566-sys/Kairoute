// Opens one day of the example trip on the live site and prints the Google ratings shown with its meals.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto('https://gilsonr0566-sys.github.io/Kairoute/?t=' + Date.now()); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(3000);
  await p.click('[data-act="continue"]').catch(() => {}); await p.waitForTimeout(800);
  await p.click(`.daychip[data-day="${process.env.DAY || 1}"]`).catch(() => {}); await p.click('#tab-plan').catch(() => {});
  for (let t = 0; t < 20; t++) { await p.waitForTimeout(1500); if (await p.evaluate(() => document.querySelectorAll('.grate:not(.none)').length >= 2)) break; }
  await p.waitForTimeout(2000);
  console.log('RATINGS ' + JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.mealbox, .tl.evening')].map(e => e.innerText.replace(/\s+/g, ' ').slice(0, 300)))));
  console.log('CHECKS ' + JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.checks li')].map(e => e.innerText))));
  await p.screenshot({ path: 'ratings.png', fullPage: false });
  await b.close();
})();
