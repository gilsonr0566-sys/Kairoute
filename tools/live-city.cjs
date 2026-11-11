// Builds a brand-new city guide on the live site the way a traveler would (new trip -> Build the guide)
// and prints any error. Usage: CITY="Corpus Christi, Texas" node tools/live-city.cjs
const { chromium, devices } = require('playwright');
(async () => {
  const city = process.env.CITY || 'Corpus Christi';
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Galaxy S9+'] }); const p = await ctx.newPage();
  const logs = []; p.on('pageerror', e => logs.push('PAGE ERROR ' + e.message)); p.on('console', m => { if (m.type() !== 'log') logs.push(m.type() + ' ' + m.text()); });
  await p.goto('https://gilsonr0566-sys.github.io/Kairoute/?t=' + Date.now()); await p.waitForTimeout(3000);
  await p.evaluate(c => {
    const day = (i, type) => ({ id: 'd' + (900 + i), date: '2026-11-1' + (1 + i), destination: c, type, mode: 'car', time: '09:00', pointIdx: 0, portArrive: '08:00', allAboard: '17:00', tender: false, startTime: '09:00', hours: 8, alongWay: true, returnToStart: true, event: '', selected: null, cityKey: null });
    localStorage.setItem('wayside.trip2', JSON.stringify({ id: 't-live-city', name: c + ' test', style: 'mix', active: 0, days: [day(0, 'land'), day(1, 'land')], lodging: {}, journal: {}, prefs: { pace: 'moderate', walk: 'medium', interests: [], travelers: '', access: 'none', party: 2, lang: 'English', voice: 'buttery' } }));
  }, city);
  await p.reload(); await p.waitForTimeout(3000);
  await p.click('text=Continue trip').catch(() => {}); await p.waitForTimeout(500);
  await p.click('#tab-plan').catch(() => {}); await p.waitForTimeout(500);
  const btn = await p.$('text=/Build the .* guide/'); if (!btn) { console.log('No build button. Screen:', (await p.innerText('#view')).slice(0, 300)); }
  else { await btn.click(); const t0 = Date.now();
    while (Date.now() - t0 < 240000) { await p.waitForTimeout(3000); const txt = await p.innerText('#view'); if (!/Writing the|Asking your guide/.test(txt)) break; }
    console.log('After', Math.round((Date.now() - t0) / 1000) + 's:', (await p.innerText('#view')).slice(0, 500).replace(/\n+/g, ' | ')); }
  console.log(logs.join('\n') || 'no errors'); await b.close();
})();
