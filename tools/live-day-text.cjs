// Prints the Day plan text of one day of the example trip on a live build, as a traveler sees it (phone size). Used to
// confirm a fix on the live app from threads whose containers can't reach github.io.
// env: URL (default Beta 2 live), DAY = destination words to find the day (e.g. "Chania"), DATE optional (e.g. "Jul 9").
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://gilsonr0566-sys.github.io/Kairoute-Beta2/', DAY = process.env.DAY || '', DATE = process.env.DATE || '';
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  p.on('pageerror', e => console.log('PAGE ERROR ' + e.message));
  await p.goto(URL + (URL.includes('?') ? '&' : '?') + 'v=' + Date.now(), { waitUntil: 'load' }); await p.waitForTimeout(3000);
  console.log('VERSION ' + await p.evaluate(() => fetch('version.txt?v=' + Date.now(), { cache: 'no-store' }).then(r => r.text()).catch(() => '?')));
  for (let k = 0; k < 8; k++) { const nx = p.locator('[data-act=coachnext]'); if (!(await nx.first().isVisible().catch(() => false))) break; await nx.first().click(); await p.waitForTimeout(300); }
  const sk = p.locator('[data-act=coachskip], .coach button'); if (await sk.first().isVisible().catch(() => false)) await sk.last().click();
  await p.locator('[data-act=continue]').first().click(); await p.waitForTimeout(2500);
  const days = await p.evaluate(() => (window.__kairouteDays ? window.__kairouteDays() : []).map((d, i) => ({ i, type: d.type, dest: d.destination || d.dest || '', date: d.date || '' })));
  console.log('DAYS ' + days.map(d => `${d.i}:${d.date} ${d.dest}`).join(' / '));
  const hit = days.filter(d => (!DAY || d.dest.toLowerCase().includes(DAY.toLowerCase())) && (!DATE || String(d.date).includes(DATE)));
  for (const d of hit.slice(0, 2)) { await p.locator(`[data-day="${d.i}"]`).first().click().catch(() => {}); await p.waitForTimeout(20000);
    console.log(`\n===== DAY ${d.i} ${d.date} ${d.dest} (${d.type}) =====\n` + (await p.evaluate(() => (document.querySelector('main') || document.body).innerText))); }
  if (!hit.length) console.log('NO DAY MATCHED ' + DAY + ' ' + DATE);
  await b.close(); })();
