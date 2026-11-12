// Live check that day-trip stops get real restaurants: plans the Corinth day of the example Athens trip on the
// published site, waits for the map lookup, and prints the day with its lunch.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  p.on('requestfinished', async r => { if (/workers\.dev\/places/.test(r.url())) { const res = await r.response(); console.log('PLACES', res.status(), r.postData(), (await res.text()).slice(0, 600)); } });
  p.on('pageerror', e => console.log('PAGE ERROR ' + e.message));
  await p.goto('https://gilsonr0566-sys.github.io/Kairoute/?t=' + Date.now()); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(3000);
  console.log('BEFORE', JSON.stringify(await p.evaluate(() => window.__kairouteDay(3, 'corinth|acrocorinth', { hours: 10 })), null, 1));
  await p.click('text=Continue trip').catch(() => {}); await p.waitForTimeout(500);
  await p.click('.daychip[data-day="3"]').catch(e => console.log('no day chip', e.message)); await p.waitForTimeout(300);
  await p.click('#tab-plan').catch(() => {}); await p.waitForTimeout(25000);
  console.log('ACTIVE', await p.evaluate(() => document.querySelector('.daychip[aria-pressed=true]') && document.querySelector('.daychip[aria-pressed=true]').textContent), 'VIEW', (await p.innerText('#view').catch(() => '')).slice(0, 200).replace(/\n+/g, ' | '));
  console.log('FAREATS', await p.evaluate(() => localStorage.getItem('kairoute.fareats')));
  const r = await p.evaluate(() => window.__kairouteDay(3));
  console.log('AFTER', JSON.stringify(r, null, 1));
  const ok = r && r.items && r.items.some(x => / meal: /.test(x) && !/ meal: (Lunch|Dinner) near /.test(x));
  console.log(ok ? 'REAL LUNCH OK' : 'NO REAL LUNCH');
  await b.close();
})();
