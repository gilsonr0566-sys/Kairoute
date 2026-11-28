// Live check of the sights fixes on the published Beta 2 (no AI): the names and day trips Choose sights shows.
// Kusadasi (example trip, day 7): every name in Latin letters, no local-language-only listing shown under its local name,
// no "Banner"-type junk; Paris: no Bastille as a standing sight; Thessaloniki: no group listing as one stop.
'use strict';
const { chromium } = require('playwright');
const URL0 = process.env.LIVE || 'https://gilsonr0566-sys.github.io/Kairoute-Beta2/';
const OTHER = /[^\u0000-ɏḀ-ỿ -⁯₠-⃏℀-⅏←-⯿️\u{1F000}-\u{1FAFF}]/u;
const names = p => p.evaluate(() => [...document.querySelectorAll('.site .name')].map(e => e.textContent.trim()));
async function open(b) { const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); const k = 'b2:kairoute.app', v = JSON.parse(localStorage.getItem(k) || '{}'); v.backAck = '2026-11-20'; localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} });
  const p = await ctx.newPage(); await p.goto(URL0); await p.waitForTimeout(4000); return { ctx, p }; }
async function sights(p, i) { await p.evaluate(i => window.__kairouteGo('sites', i), i);
  let last = ''; for (let k = 0; k < 20; k++) { await p.waitForTimeout(3000); const n = JSON.stringify(await names(p)); if (n === last && k > 3) break; last = n; }
  await p.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
  return { names: await names(p), text: await p.evaluate(() => document.getElementById('view').textContent.replace(/\s+/g, ' ')) }; }
async function newTrip(b, city) { const { ctx, p } = await open(b);
  await p.getByRole('button', { name: /Plan a new trip/i }).first().click(); await p.waitForTimeout(800);
  await p.fill('#ts-0-place', city); await p.fill('#ts-0-date', '2027-05-09'); await p.fill('#ts-0-nights', '2'); await p.press('#ts-0-nights', 'Tab');
  await p.getByRole('button', { name: /Build my trip/i }).click();
  // R-41: setup lists the trip details still empty; this check's trip leaves them out on purpose, so it answers "I don't know these yet"
  await p.waitForTimeout(600); if (await p.locator('[data-ts="needok"]').first().isVisible().catch(() => false)) await p.locator('[data-ts="needok"]').first().click();
  for (let k = 0; k < 60; k++) { await p.waitForTimeout(1500); const s = await p.evaluate(() => window.__kairouteState && window.__kairouteState()); if (s && !s.busy && k > 3) break; }
  const r = await sights(p, 1); r.state = JSON.stringify(await p.evaluate(() => window.__kairouteState && window.__kairouteState())).slice(0, 600); await ctx.close(); return r; }
(async () => {
  const b = await chromium.launch(); let fails = 0; const F = m => { fails++; console.log('FAIL ' + m); };
  const v = await (await fetch(URL0 + 'version.txt', { cache: 'no-store' })).text().catch(() => '?'); console.log('live build: ' + String(v).trim());
  { const { ctx, p } = await open(b); const r = await sights(p, 6); console.log('Kusadasi day: ' + r.names.length + ' sights: ' + r.names.join(' | ')); console.log('Kusadasi screen: ' + r.text.slice(0, 3000)); if (!r.names.length) F('Kusadasi: no sights read (check blind)');
    r.names.filter(n => OTHER.test(n)).forEach(n => F('Kusadasi: name in another script: ' + n));
    r.names.filter(n => /^banner$/i.test(n)).forEach(n => F('Kusadasi: junk listing: ' + n));
    const dt = (r.text.match(/Day trip/g) || []).length; console.log('Kusadasi: "Day trip" labels on screen: ' + dt);
    if (/€150|PLANT/.test(r.text)) F('Kusadasi: an AI price or planted text on screen'); await ctx.close(); }
  for (const [city, bad] of [['Paris', /^(the )?bastille$/i], ['Thessaloniki', /walls|ramparts|byzantine (and|&) early christian monuments|paleochristian and byzantine monuments/i]]) {
    const r = await newTrip(b, city); console.log(city + ': ' + r.names.length + ' sights: ' + r.names.join(' | ')); if (!r.names.length) { F(city + ': no sights read (check blind)'); console.log(city + ' screen: ' + r.text.slice(0, 2000) + ' || state: ' + r.state); }
    r.names.filter(n => OTHER.test(n)).forEach(n => F(city + ': name in another script: ' + n));
    r.names.filter(n => bad.test(n)).forEach(n => F(city + ': ' + n + ' is listed'));
    if (city === 'Paris' && /Bastille[^.]{0,80}(standing|still stands)/i.test(r.text)) F('Paris: the Bastille is called standing'); }
  await b.close(); console.log(`sights-live: ${fails ? fails + ' failed' : 'PASS'}`); process.exit(fails ? 1 : 0);
})();
