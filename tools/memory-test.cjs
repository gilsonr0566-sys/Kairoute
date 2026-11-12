// Live check of restaurant ratings and the memory video on the published site.
// Loads the (cached) Corpus Christi guide, checks each sight's Wikipedia photo, rates a test place on a
// test city, makes a memory video and saves sample frames to memory-test/.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  fs.mkdirSync('memory-test', { recursive: true });
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } }); const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGE ERROR ' + e.message));
  await p.goto('https://gilsonr0566-sys.github.io/Kairoute/?t=' + Date.now()); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(3000);
  await p.evaluate(() => {
    const day = (i) => ({ id: 'd' + (900 + i), date: '2026-11-1' + (1 + i), destination: 'Corpus Christi', type: 'land', mode: 'car', time: '09:00', pointIdx: 0, portArrive: '08:00', allAboard: '17:00', tender: false, startTime: '09:00', hours: 8, alongWay: true, returnToStart: true, event: '', selected: null, cityKey: null });
    localStorage.setItem('wayside.trip2', JSON.stringify({ id: 't-mem', name: 'Corpus Christi weekend', style: 'mix', active: 0, days: [day(0), day(1)], lodging: {}, journal: {}, prefs: { pace: 'moderate', walk: 'medium', interests: [], travelers: '', access: 'none', party: 2, lang: 'English' } }));
  });
  await p.reload(); await p.waitForTimeout(3000);
  await p.click('text=Continue trip').catch(() => {}); await p.waitForTimeout(500);
  await p.click('#tab-plan').catch(() => {}); await p.waitForTimeout(500);
  const btn = await p.$('text=/Build the .* guide/');
  if (btn) { await btn.click(); const t0 = Date.now(); while (Date.now() - t0 < 300000) { await p.waitForTimeout(3000); if (!/Building the .* guide ·|Writing the|Asking your guide|Checking every place/.test(await p.innerText('#view'))) break; } }
  const sites = await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('wayside.cities') || '{}')).flatMap(c => (c.sites || []).map(s => ({ name: s.name, lat: s.lat, lng: s.lng }))));
  console.log('Sites:', sites.length);
  let found = 0;
  for (const s of sites) { const r = await p.evaluate(s => window.__kairouteSpot(s), s); if (r) found++; console.log('PHOTO', s.name, '->', r ? `${r.w}x${r.h} canvasSafe=${r.canvasSafe} ${r.src}` : 'none'); }
  console.log(`PHOTOS ${found} of ${sites.length}`);
  // Ratings round trip on a test city (not a real one)
  const rt = await p.evaluate(async () => { const u = (await (await fetch('ai.json')).json()).url;
    const dev = 'abcdef0123456789abcdef01';
    const r1 = await (await fetch(u + '/rate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ city: 'zz kairoute test', place: 'test cafe', stars: 4, dev }) })).json();
    const r2 = await (await fetch(u + '/rate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ city: 'zz kairoute test', place: 'test cafe', stars: 5, dev }) })).json();
    const bad = (await fetch(u + '/rate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ city: 'zz kairoute test', place: 'test cafe', stars: 9, dev }) })).status;
    const g = await (await fetch(u + '/ratings?city=zz%20kairoute%20test&t=' + Date.now())).json();
    return { first: r1, again: r2, badStatus: bad, list: g }; });
  console.log('RATINGS', JSON.stringify(rt));
  // Memory video: one journal note and photo, then make the video
  await p.click('#tab-guide'); await p.waitForTimeout(800);
  await p.evaluate(() => { const ta = document.querySelector('textarea[data-note]'); if (ta) { ta.value = 'What a view from up here. Worth every step.'; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.dispatchEvent(new Event('change', { bubbles: true })); } });
  await p.locator('[data-rate="5"]').first().click().catch(() => {});
  await p.click('#tab-journal'); await p.waitForTimeout(500);
  await p.click('[data-act="memmake"]'); const t0 = Date.now();
  await p.waitForSelector('video.memvideo', { timeout: 240000 }).catch(async e => console.log('NO VIDEO', (await p.innerText('.memcard').catch(() => '')).slice(0, 300)));
  const info = await p.evaluate(async () => { const v = document.querySelector('video.memvideo'); if (!v) return null; await new Promise(r => { if (v.readyState >= 1) r(); else v.onloadedmetadata = r; }); const bl = await (await fetch(v.src)).blob(); return { type: bl.type, size: bl.size, dur: v.duration, w: v.videoWidth, h: v.videoHeight }; });
  console.log('VIDEO', Math.round((Date.now() - t0) / 1000) + 's to make', JSON.stringify(info));
  for (const t of [1.5, 4.5, 7.5, 11, 15, 20, 26, 32]) {
    const d = await p.evaluate(async (t) => { const v = document.querySelector('video.memvideo'); if (!v || t > v.duration) return null; v.muted = true; v.currentTime = t; await new Promise(r => { v.onseeked = r; setTimeout(r, 2000); }); const c = document.createElement('canvas'); c.width = 360; c.height = 640; c.getContext('2d').drawImage(v, 0, 0, 360, 640); return c.toDataURL('image/jpeg', .8); }, t);
    if (d) fs.writeFileSync(`memory-test/frame-${t}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
  }
  await b.close();
})();
