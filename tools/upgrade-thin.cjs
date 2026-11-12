// Builds full guides for the example trip's thin built-in cities on the live site (each is cached and shared
// afterwards), one at a time, by opening each day's plan the way a traveler would.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  p.on('pageerror', e => console.log('PAGE ERROR ' + e.message)); p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') console.log('console ' + m.text()); });
  await p.goto('https://gilsonr0566-sys.github.io/Kairoute/?t=' + Date.now()); await p.waitForTimeout(3000);
  await p.click('text=Continue trip').catch(() => {}); await p.waitForTimeout(800);
  const thin = () => p.evaluate(() => window.__kairouteThin().split('\n'));
  const list = (await thin()).filter(l => / builtin$/.test(l) && +l.split(': ')[1].split(' ')[0] < 10);
  console.log('Thin:', list.join(' / '));
  const seen = new Set();
  for (const l of list) {
    const i = +l.split(' ')[0], dest = l.slice(l.indexOf(' ') + 1, l.indexOf(':')); if (seen.has(dest)) continue; seen.add(dest);
    await p.click(`.daychip[data-day="${i}"]`).catch(() => {}); await p.waitForTimeout(300); await p.click('#tab-trip').catch(() => {}); await p.waitForTimeout(200); await p.click('#tab-plan').catch(() => {});
    const t0 = Date.now(); let now = '';
    while (Date.now() - t0 < 360000) { await p.waitForTimeout(5000); now = (await thin()).find(x => x.startsWith(i + ' ')) || ''; if (!/ builtin$/.test(now)) break; }
    console.log(`UPGRADE ${dest}: ${l.split(': ')[1]} -> ${now.split(': ')[1]} (${Math.round((Date.now() - t0) / 1000)}s)`);
  }
  await b.close();
})();
