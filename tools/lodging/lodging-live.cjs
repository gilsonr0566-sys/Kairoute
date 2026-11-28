// Where-you're-staying check on a live build (rule R-38): the traveler picks "My hotel or rental…", types a hotel name
// or a street address (with a house or flat number, a typo, local script, or nothing real), taps Find it, and the
// screen must either show the place found (with its street, in the traveler's language) or say plainly it wasn't found.
// It also asks the helper's /findplace (and the free map searches it uses) the same questions, so a cause is seen.
// env: URL (default Beta 2 live), OUT (screenshot folder), SIZES=phone,tablet, ONLY=<case words>
'use strict';
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const URL = process.env.URL || 'https://gilsonr0566-sys.github.io/Kairoute-Beta2/', OUT = process.env.OUT || 'lodging-shots';
const HELPER = 'https://kairoute-ai.rickgilson.workers.dev';
const CASES = require('./lodging-cases.json').filter(c => !process.env.ONLY || new RegExp(process.env.ONLY, 'i').test(c.q));
const SIZES = { phone: { viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true }, tablet: { viewport: { width: 1280, height: 800 }, hasTouch: true } };
fs.mkdirSync(OUT, { recursive: true });
const UA = { 'user-agent': 'Kairoute/1.0 (travel guide test; https://gilsonr0566-sys.github.io/Kairoute/)', 'accept-language': 'en' };
const j = async (u, h) => { try { const r = await fetch(u, { headers: h || UA, signal: AbortSignal.timeout(20000) }); const t = await r.text(); return r.status + ' ' + t.slice(0, 600).replace(/\s+/g, ' '); } catch (e) { return 'ERR ' + e.message; } };
function seedFor(trip) {
  const c = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'beta2', 'corpus', trip + '.json'), 'utf8'));
  const days = c.days.map(d => { const x = Object.assign({}, d); delete x.i; delete x.sites; delete x.wx; delete x.missing; delete x.order;
    for (const k of ['portArrive', 'allAboard', 'boardAt', 'startTime', 'time']) if (typeof x[k] === 'number') x[k] = String(Math.floor(x[k] / 60)).padStart(2, '0') + ':' + String(x[k] % 60).padStart(2, '0');
    x.cityKey = d.city; x.destination = d.city && c.cities[d.city] ? c.cities[d.city].name : d.destination || ''; return x; });
  return { trip: JSON.stringify({ id: 'lodge-' + trip, name: trip, style: 'mix', active: 0, days, lodging: {}, journal: {}, prefs: c.prefs || {}, legModes: {} }),
    cities: JSON.stringify(Object.fromEntries(Object.entries(c.cities || {}).map(([k, g]) => [k, Object.assign({ city: g.name }, g.guide || g)]))) };
}
(async () => {
  if (!process.env.SKIP_API) for (const c of CASES) {
    console.log(`\n## API ${c.city} | ${c.q}`);
    console.log('helper  ' + await j(`${HELPER}/findplace?city=${encodeURIComponent(c.city)}&q=${encodeURIComponent(c.q)}`, { ...UA, origin: 'https://gilsonr0566-sys.github.io' }));
    if (process.env.RAW) { console.log('nominat ' + await j(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&addressdetails=1&q=${encodeURIComponent(c.q + ', ' + c.city)}`)); await new Promise(r => setTimeout(r, 1200));
      console.log('photon  ' + await j(`https://photon.komoot.io/api/?limit=3&lang=en&q=${encodeURIComponent(c.q + ', ' + c.city)}`)); }
  }
  const b = await chromium.launch(), report = [];
  for (const size of (process.env.SIZES || 'phone,tablet').split(',')) for (const c of CASES) {
    if (size === 'tablet' && !c.tablet) continue;
    const p = await b.newPage(SIZES[size]);
    p.on('pageerror', e => console.log('PAGE ERROR ' + e.message));
    await p.addInitScript(s => { try { const ls = localStorage; if (ls.getItem('b2:__copied')) return; ls.setItem('b2:__copied', '1'); ls.setItem('b2:__merged2', '1');
      ls.setItem('b2:wayside.trip2', s.trip); ls.setItem('b2:wayside.cities', s.cities); ls.setItem('b2:kairoute.lobbySeen', '1');
      ['intro1', 'sunprincess1', 'spread1', 'bible1', 'coach1', 'coachDone', 'tourTip'].forEach(k => ls.setItem('b2:kairoute.' + k, '1')); } catch (e) {} }, seedFor(c.trip));
    await p.goto(URL + (URL.includes('?') ? '&' : '?') + 'v=' + Date.now(), { waitUntil: 'load' }); await p.waitForTimeout(3500);
    const ver = await p.evaluate(() => fetch('version.txt?v=' + Date.now(), { cache: 'no-store' }).then(r => r.text()).catch(() => '?'));
    await p.evaluate(() => window.__kairouteGo('trip', 0)); await p.waitForTimeout(800);
    // On a phone the day's form is its own pane: open it the way a traveler does (tap the day).
    await p.evaluate(() => { const f = document.getElementById('f-lodging'); if (f) f.scrollIntoView({ block: 'center' }); });
    const has = await p.$('#f-lodging');
    if (!has) { console.log(`CASE ${size} ${c.q}: NO STAY FIELD ON SCREEN`); report.push({ size, q: c.q, ok: false, why: 'no field' }); await p.close(); continue; }
    await p.selectOption('#f-lodging', 'custom'); await p.waitForTimeout(500);
    await p.fill('#f-lname', c.q);
    const btn = await p.$('[data-act="geo"]'), dis = btn ? await btn.isDisabled() : true;
    if (btn && !dis) await btn.click();
    let t0 = Date.now(); await p.waitForTimeout(1500);
    while (Date.now() - t0 < 40000 && await p.evaluate(() => /Finding /.test(document.body.innerText))) await p.waitForTimeout(1000);
    await p.waitForTimeout(800);
    await p.evaluate(() => { const f = document.getElementById('f-lname'); if (f) f.scrollIntoView({ block: 'center' }); });
    const st = await p.evaluate(() => { const f = document.getElementById('f-lname'), field = f && f.closest('.field');
      const err = [...document.querySelectorAll('.err, .error, .alert, [role=alert]')].map(e => e.innerText.trim()).filter(Boolean).join(' | ');
      return { field: field ? field.innerText.trim() : '', err, value: f ? f.value : '', saved: (() => { try { const t = JSON.parse(localStorage.getItem('b2:wayside.trip2') || '{}'); return JSON.stringify(t.lodging || {}); } catch (e) { return '?'; } })() }; });
    const shot = path.join(OUT, `${size}-${c.trip}-${c.q.replace(/[^\w]+/g, '_').slice(0, 40)}.png`);
    await p.screenshot({ path: shot });
    const found = /Found on the map|Found:/i.test(st.field), said = /couldn.t find|not found|didn.t find|no place/i.test(st.field + ' ' + st.err);
    const ok = c.expect === 'none' ? said && !found : found;
    console.log(`CASE ${ok ? 'OK  ' : 'FAIL'} ${size} [${ver}] ${c.city} | ${c.q} | button ${btn ? (dis ? 'DISABLED' : 'on') : 'missing'} | ${(Date.now() - t0) / 1000 | 0}s\n   field: ${st.field.replace(/\s+/g, ' ').slice(0, 300)}\n   error: ${st.err.slice(0, 300)}\n   saved: ${st.saved.slice(0, 300)}`);
    report.push({ size, q: c.q, ok });
    await p.close();
  }
  await b.close();
  const bad = report.filter(r => !r.ok);
  console.log(`\nSUMMARY ${report.length - bad.length}/${report.length} ok` + (bad.length ? '; failed: ' + bad.map(r => r.size + ' ' + r.q).join('; ') : ''));
  if (process.env.STRICT && bad.length) process.exit(1);
})();
