// Prints the visible text of a live page after it loads (used to check the Usage & cost page).
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => console.log('PAGE ERROR ' + e.message));
  await p.goto(process.env.URL); await p.waitForTimeout(6000);
  console.log('TEXT ' + (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ')); await b.close(); })();
