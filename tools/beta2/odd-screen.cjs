// Odd trips on the screen (Nov 22 2026, Richard's 33-hour push: "Check everything every different way"). The BUILT Beta 2
// app (never the demo) on a phone, no internet, no AI. Each day of the sample trip is changed the odd ways a traveler can
// change it (port calls short, late, at dawn and past midnight, tender; flights and trains at 00:20, 06:00 and 23:55;
// hours Light, Half, Full; every sight ticked, emptied, reversed), and every day as SHOWN is read by the screen rules
// (tools/beta2/screen-rules.cjs: leave-by after every stop, the ride back fits, the clock adds up, lunch has a real place,
// times agree, never slower than walking, true words). Usage: node tools/beta2/odd-screen.cjs [beta2-site/index.html]
//   VARIANTS=n limits the changes per day; DAYS=1,5 limits the days. Exit 1 on any S1 or S2 failure.
const { chromium } = require('playwright'); const path = require('path'), http = require('http'), fs = require('fs');
const R = require('./screen-rules.cjs'), ROOT = path.join(__dirname, '..', '..');
const B2 = path.resolve(process.argv[2] || path.join(ROOT, 'beta2-site', 'index.html'));
const DAYS = (process.env.DAYS || '').split(',').filter(Boolean).map(n => +n - 1), MAXV = +(process.env.VARIANTS || 99);
function serve() { return new Promise(res => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
  let f = u === '/' || u === '/index.html' ? B2 : null; if (!f) for (const base of [path.dirname(B2), ROOT]) { const g = path.join(base, u); if (g.startsWith(base) && fs.existsSync(g) && !fs.statSync(g).isDirectory()) { f = g; break; } }
  if (!f) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
  s.listen(0, () => res({ base: 'http://localhost:' + s.address().port, close: () => s.close() })); }); }
const hm = m => String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0') + ':' + String(((m % 60) + 60) % 60).padStart(2, '0');
// The changes for a day of each kind: [label, fields to set on the saved day, sights: 'all' | 'none' | 'rev' | null]
const variants = d => {
  const v = [];
  if (d.type === 'port') for (const [a, b] of [[7 * 60, 11 * 60], [6 * 60, 13 * 60], [13 * 60, 17 * 60], [17 * 60, 23 * 60 + 30], [19 * 60, 90], [8 * 60, 18 * 60]])
    for (const tender of [false, true]) v.push([`docks ${hm(a)}, all aboard ${hm(b)}${tender ? ', tender' : ''}`, { portArrive: hm(a), allAboard: hm(b), tender }]);
  if (d.type === 'embark') for (const b of [13 * 60, 16 * 60 + 30, 23 * 60 + 30, 30]) v.push([`all aboard ${hm(b)}`, { allAboard: hm(b) }]);
  if (d.type === 'departure') for (const t of ['00:20', '06:00', '11:00', '15:30', '23:55']) v.push([`${d.mode} at ${t}`, { time: t }]);
  if (d.type === 'arrival') for (const t of ['00:30', '05:40', '13:40', '20:00', '23:50']) for (const h of [2.5, 4, 8]) v.push([`${d.mode} in ${t}, ${h} h`, { time: t, hours: h }]);
  if (d.type === 'land') for (const s of ['06:00', '09:00', '14:00', '17:30']) for (const h of [2.5, 4, 8]) v.push([`start ${s}, ${h} h`, { startTime: s, hours: h }]);
  if (d.type !== 'sea') v.push(['every sight ticked', {}, 'all'], ['day emptied', {}, 'none'], ['picks in reverse order', {}, 'rev']);
  return v.slice(0, MAXV);
};
(async () => {
  const browser = await chromium.launch(), srv = await serve();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, timezoneId: 'America/Chicago' });
  await ctx.route(u => !/^http:\/\/localhost/.test(String(u)), r => r.fulfill({ status: 503, body: '' }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.goto(srv.base + '/index.html'); await p.waitForTimeout(2500);
  const b = p.locator('[data-act="loadsample"]').first(); if (await b.isVisible().catch(() => false)) await b.click(); await p.waitForTimeout(5000);
  for (let k = 0; k < 5; k++) { const sk = p.locator('.coach button:has-text("Skip")').first(); if (await sk.isVisible().catch(() => false)) await sk.tap().catch(() => {}); else break; }
  const saved = await p.evaluate(() => localStorage.getItem('wayside.trip2'));
  const days = await p.evaluate(() => window.__kairouteDays ? window.__kairouteDays() : []);
  const trip0 = JSON.parse(saved); let shown = 0; const fails = [], slow = [];
  for (let i = 0; i < trip0.days.length; i++) { if (DAYS.length && !DAYS.includes(i)) continue;
    for (const [label, fields, sights] of variants(trip0.days[i])) {
      const t0 = Date.now();
      const text = await p.evaluate(async ({ i, fields, sights, saved }) => {
        // Every change starts from the day as saved: its own fields put back first (the app keeps the trip in memory).
        const d0 = JSON.parse(saved).days[i];
        window.__kairouteDay(i, d0.selected == null ? null : d0.selected, Object.assign({}, d0, { cleared: d0.cleared, order: d0.order || null }));
        const all = window.__kairouteDay(i, sights === 'all' ? '.' : null, fields) || [];
        if (sights === 'none') window.__kairouteDay(i, []);
        if (sights === 'rev' && window.__kairouteOrder) { try { const ids = (window.__kairouteAt(i, 'ids') || []).slice().reverse(); window.__kairouteOrder(i, ids); } catch (e) {} }
        window.__kairouteGo('day', i); window.__kairouteGo('plan');
        await new Promise(r => setTimeout(r, 700));
        for (let k = 0; k < 40 && window.__kairouteFitPending && window.__kairouteFitPending() > 0; k++) await new Promise(r => setTimeout(r, 200));
        document.querySelectorAll('#view details').forEach(d => { d.open = true; });
        return (document.querySelector('main') || document.body).innerText;
      }, { i, fields, sights, saved });
      const ms = Date.now() - t0; if (ms > 6000) slow.push(`day ${i + 1} (${label}): ${(ms / 1000).toFixed(1)} s to show`);
      if (process.env.BUCKET && label.includes(process.env.DUMP || '')) fs.writeFileSync(process.env.BUCKET, JSON.stringify([{ name: 'b', edits: [], bucket: await p.evaluate(() => window.__kairouteBucket(true)) }]));
      if (process.env.DUMP && label.includes(process.env.DUMP)) console.log('=== day ' + (i + 1) + ' ' + label + '\n' + text);
      shown++; const info = Object.assign({}, days[i] || {}, { i });
      for (const f of R.rules(text, info)) fails.push(Object.assign({ where: `day ${i + 1} ${info.type || ''} ${info.dest || ''} (${label})` }, f));
    }
    // back to the saved trip before the next day
    await p.evaluate(s => localStorage.setItem('wayside.trip2', s), saved); await p.reload(); await p.waitForTimeout(3500);
  }
  const by = {}; fails.forEach(f => { const k = f.sev + ' ' + f.rule; (by[k] = by[k] || []).push(f.where + ': ' + f.msg); });
  console.log(`Odd days on screen: ${shown} day plans shown, ${fails.length} rule failures, ${slow.length} slow, ${errs.length} page errors`);
  Object.keys(by).sort().forEach(k => { console.log(`FAIL ${k}: ${by[k].length}`); by[k].slice(0, +(process.env.SHOW || 4)).forEach(m => console.log('     ' + m.slice(0, 300))); });
  slow.slice(0, 5).forEach(m => console.log('SLOW ' + m)); [...new Set(errs)].slice(0, 5).forEach(m => console.log('ERROR ' + m));
  if (process.env.ALL) fs.writeFileSync(process.env.ALL, JSON.stringify({ by, slow, errs }, null, 1));
  await browser.close(); srv.close(); process.exitCode = fails.some(f => f.sev !== 'S3') || errs.length ? 1 : 0;
})();
