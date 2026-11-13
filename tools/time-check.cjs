// Local-time check: every day's times are that place's clock, whatever time zone the device is set to, and the
// ship's-clock check works (Matches / type it / photo read on the device with no internet). Runs the app with the
// device clock in America/Chicago and in Europe/Rome at the same real instant: both must show the same countdown.
// Usage: node tools/time-check.cjs [path/to/index.html]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const http = require('http');
const ROOT = path.resolve(path.dirname(process.argv[2] || path.join(__dirname, '..', 'index.html'))), FILE = path.basename(process.argv[2] || 'index.html');
const TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.wasm': 'application/wasm', '.gz': 'application/gzip', '.png': 'image/png', '.json': 'application/json' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const BASE = `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch(); let fails = 0; const fail = m => { fails++; console.log('FAIL ' + m); };
  const open = async (tz, instant, offline) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: tz });
    await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
    await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
    const p = await ctx.newPage(); p.on('pageerror', e => fail(`${tz}: page error ${e.message} ${(e.stack || '').split('\n').slice(1, 6).join(' / ')}`));
    await p.clock.setFixedTime(instant); await p.goto(BASE + FILE); await p.waitForTimeout(500);
    if (offline) await ctx.setOffline(true);
    return { ctx, p };
  };
  // Naples port day (Europe/Rome, summer: UTC+2). 10:00 in Naples = 08:00 UTC = 03:00 in Chicago.
  const probe = await open('Europe/Rome', new Date('2027-07-12T08:00:00Z'));
  const D = (await probe.p.evaluate(() => window.__kairouteDays())).find(d => d.type === 'port' && /naples/i.test(d.dest));
  await probe.ctx.close();
  const seen = {};
  for (const tz of ['America/Chicago', 'Europe/Rome', 'Asia/Tokyo']) {
    const { ctx, p } = await open(tz, new Date('2027-07-12T08:00:00Z'));
    const z = await p.evaluate(i => window.__kairouteTime.dayZone(i), D.i);
    if (z.tz !== 'Europe/Rome' || !z.known) fail(`${tz}: Naples zone is ${JSON.stringify(z)}`);
    if (!(await p.evaluate(i => window.__kairouteTime.isToday(i), D.i))) fail(`${tz}: Jul 12 is not "today" in Naples at 10:00 Naples time`);
    await p.evaluate(i => window.__kairouteGo('plan', i), D.i); await p.waitForTimeout(300);
    // The ship's-clock check shows first on a ship day; it asks about 10:00 AM (Naples time), not the device's time.
    const ask = await p.evaluate(() => (document.querySelector('.shipsheet h2') || {}).textContent || '');
    if (!/10:00 AM/.test(ask)) fail(`${tz}: ship's-clock check asks "${ask}" (should be 10:00 AM, Naples time)`);
    await p.click('[data-act="shipok"]'); await p.waitForTimeout(200);
    const r = await p.evaluate(() => ({ big: document.getElementById('cdBig').textContent, sub: document.getElementById('cdSub').textContent, note: (document.querySelector('.timeline') && document.querySelector('.tzline') || {}).textContent || '' }));
    seen[tz] = r.big + ' | ' + /leave by (\d\d:\d\d)/i.exec(r.sub)?.[1];
    if (!/Naples time/.test(r.note)) fail(`${tz}: no "Naples time" label (${r.note})`);
    if (tz !== 'Europe/Rome' && !/different time zone/.test(r.note)) fail(`${tz}: no note that the device is on another time zone`);
    if (tz === 'Europe/Rome' && /different time zone/.test(r.note)) fail('Europe/Rome: says the device is on another zone');
    await ctx.close();
  }
  if (new Set(Object.values(seen)).size !== 1) fail('countdown differs by device time zone: ' + JSON.stringify(seen));
  // Ship keeps a different clock: typing the ship's time (one hour ahead) moves all aboard to port time.
  { const { ctx, p } = await open('America/Chicago', new Date('2027-07-12T08:00:00Z'));
    await p.evaluate(i => window.__kairouteGo('plan', i), D.i); await p.waitForTimeout(300);
    const before = await p.evaluate(i => window.__kairouteLiveTest.alarm(i).backBy, D.i);
    await p.click('[data-act="shiptype"]'); await p.fill('#shipTime', '11:00'); await p.click('[data-act="shipset"]'); await p.waitForTimeout(200);
    const after = await p.evaluate(i => ({ backBy: window.__kairouteLiveTest.alarm(i).backBy, note: document.querySelector('.tzline').textContent }), D.i);
    if (after.backBy !== before - 60) fail(`ship clock 1 h ahead: back-by moved from ${before} to ${after.backBy}, should be ${before - 60}`);
    if (!/ship's clock is 1 h ahead/i.test(after.note)) fail(`no ship-clock note: ${after.note}`);
    await ctx.close(); }
  // Photo of the ship's clock, read on the device (every outside address is blocked here, as with no internet); never applied without confirming.
  { const { ctx, p } = await open('America/Chicago', new Date('2027-07-12T08:00:00Z'));
    await p.evaluate(i => window.__kairouteGo('plan', i), D.i); await p.waitForTimeout(300);
    const png = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 520; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 520, 200); g.fillStyle = '#000'; g.font = 'bold 120px Arial'; g.fillText('10:15', 60, 145); return c.toDataURL('image/png').split(',')[1]; });
    const chooser = p.waitForEvent('filechooser'); await p.click('[data-act="shipsnap"]'); const fc = await chooser;
    await fc.setFiles({ name: 'clock.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await p.waitForFunction(() => window.__kairouteTime.sheet() !== 'read', null, { timeout: 60000 }).catch(() => {});
    const st = await p.evaluate(() => ({ step: window.__kairouteTime.sheet(), h: (document.querySelector('.shipsheet h2') || {}).textContent || '' }));
    if (st.step !== 'confirm' || !/10:15/.test(st.h)) fail(`photo of 10:15 offline: ${st.step} "${st.h}"`);
    else { const off0 = await p.evaluate(i => window.__kairouteDays()[i] && null, D.i);
      await p.click('[data-act="shipuseread"]'); await p.waitForTimeout(200);
      const n = await p.evaluate(() => document.querySelector('.tzline').textContent); if (!/15 min ahead/.test(n)) fail(`after confirming 10:15 the note says: ${n}`); }
    // An unreadable photo says so plainly and offers typing, prefilled.
    const blank = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#777'; g.fillRect(0, 0, 300, 200); return c.toDataURL('image/png').split(',')[1]; });
    await p.evaluate(() => window.__kairouteTime.set(0, {})); await p.click('#cdCard > summary').catch(() => {});
    await p.evaluate(() => document.querySelector('[data-act="shipcheck"]').click()); await p.waitForTimeout(100);
    const ch2 = p.waitForEvent('filechooser'); await p.click('[data-act="shipsnap"]'); const fc2 = await ch2;
    await fc2.setFiles({ name: 'blank.png', mimeType: 'image/png', buffer: Buffer.from(blank, 'base64') });
    await p.waitForFunction(() => window.__kairouteTime.sheet() !== 'read', null, { timeout: 60000 }).catch(() => {});
    const f2 = await p.evaluate(() => ({ step: window.__kairouteTime.sheet(), msg: (document.querySelector('.shipsheet .banner') || {}).textContent || '', val: (document.getElementById('shipTime') || {}).value }));
    if (f2.step !== 'fail' || !/Couldn't read/.test(f2.msg) || !/^\d\d:\d\d$/.test(f2.val || '')) fail(`unreadable photo: ${JSON.stringify(f2)}`);
    await ctx.close(); }
  await b.close(); srv.close();
  if (fails) { console.log(`time-check: ${fails} problem(s)`); process.exit(1); }
  console.log('time-check: same countdown in Chicago, Rome and Tokyo device time; "Naples time" label and device note; ship clock typed or read from a photo offline, confirmed first; unreadable photo says so. All good');
})();
