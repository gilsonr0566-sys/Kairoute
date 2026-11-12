// End-to-end sync check on the live site with two separate browsers (a phone and a desktop).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const SITE = 'https://gilsonr0566-sys.github.io/Kairoute/?t=' + Date.now();
  const dev = async (name, vp) => { const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage();
    p.on('pageerror', e => console.log(name, 'PAGE ERROR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log(name, 'console', m.text()); });
    p.on('response', r => { if (/\/sync/.test(r.url())) r.text().then(t => console.log(name, 'sync', r.status(), r.request().postData().slice(0, 40), '->', t.slice(0, 120))).catch(() => {}); });
    p.on('requestfailed', r => { if (/workers\.dev/.test(r.url())) console.log(name, 'FAILED', r.url(), r.failure() && r.failure().errorText); });
    await p.goto(SITE); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(3000); return p; };
  const phone = await dev('PHONE', { width: 412, height: 900 }), desk = await dev('DESK', { width: 1280, height: 900 });
  await phone.click('[data-act="settings"]'); await phone.waitForTimeout(500);
  console.log('PHONE settings has sync card:', !!(await phone.$('#synccard')));
  await phone.click('[data-act="syncstart"]'); await phone.waitForTimeout(4000);
  const code = await phone.innerText('.synccode').catch(() => ''); console.log('PHONE code:', code, '| note:', await phone.innerText('#synccard').then(t => t.slice(0, 200)).catch(() => ''));
  await phone.click('.pagebar .home'); await phone.waitForTimeout(500); await phone.click('[data-act="continue"]'); await phone.waitForTimeout(1500);
  await phone.evaluate(() => window.__kairouteDay(1, null, { booked: { Lunch: { name: 'E2E Taverna', lat: 37.9725, lng: 23.73, time: '12:30' } } }));
  await phone.click('#tab-trip'); await phone.waitForTimeout(300); await phone.click('#tab-plan'); await phone.waitForTimeout(7000);
  await desk.click('[data-act="settings"]'); await desk.waitForTimeout(500); await desk.click('[data-act="syncjoin"]'); await desk.fill('#sync-code', code); await desk.click('[data-act="synclink"]'); await desk.waitForTimeout(5000);
  console.log('DESK note:', await desk.innerText('#synccard').then(t => t.slice(0, 300)).catch(() => ''));
  console.log('DESK has phone booking:', await desk.evaluate(() => JSON.stringify((JSON.parse(localStorage.getItem('wayside.trip2')).days[1] || {}).booked || null)));
  await b.close();
})();
