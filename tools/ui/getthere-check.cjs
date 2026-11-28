// R-40 screen check: "Get there". On the real screens (Day plan, Guide and Tour buttons), at phone and tablet sizes, a
// traveler taps Get there, types, taps a result, and reads the ways there. What must hold, on a ship day and a city day:
//  - the day's own places (the ship on a ship day) are offered before anything is typed, with no internet;
//  - a guide sight is found from a few letters, a street address and a place named only in the local script are found
//    on the map (/findplace, answered by the test as the real one answers), and a place the map doesn't have is said so;
//  - every way there says where its time comes from, and a time no timetable confirms reads "about";
//  - a place across the water is reached by boat, never only on foot or by taxi (the plans' own ride layer, R-06);
//  - on a ship day the card gives the latest time to leave the place to be back; with too little time left it says so
//    as an alert; on a city day with no time to be back it says nothing of the kind;
//  - nothing on the sheet is in another script (R-11), and the page throws no errors.
// Also plants the bugs this rule exists for (window.__kairoutePlant) and fails if any one goes unnoticed.
// Usage: node tools/ui/getthere-check.cjs [beta2-site/index.html]   SHOT=<prefix> saves screenshots.
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'beta2-site/index.html'), SHOT = process.env.SHOT;
const serve = f => new Promise(res => { const dir = path.dirname(f); const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/ai.json') { r.writeHead(200, { 'content-type': 'application/json' }); return r.end('{"url":"https://kairoute-ai.rickgilson.workers.dev"}'); }
  const p = path.join(dir, u === '/' ? path.basename(f) : u); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'text/plain' }); fs.createReadStream(p).pipe(r); });
  s.listen(0, () => res({ url: 'http://localhost:' + s.address().port + '/', close: () => s.close() })); });
const OTHER = /[Ͱ-ϿЀ-ӿ֐-׿؀-ۿ぀-ヿ一-鿿가-힯]/;
// The map's answers, by what was typed (offsets in degrees from the day's start point).
const MAP = {
  'Odos Testou 12': [{ dlat: 0.004, dlng: 0.003, name: '', kind: 'house', cat: 'building', road: 'Odos Testou', house: '12', addr: 'Odos Testou 12, Center', spanM: 20 }],
  'Ταβέρνα Δοκιμή': [{ dlat: 0.003, dlng: -0.002, name: 'Ταβέρνα Δοκιμή', names: ['Ταβέρνα Δοκιμή'], kind: 'restaurant', cat: 'amenity', road: 'Οδός Δοκιμής', house: '3', addr: 'Οδός Δοκιμής 3', spanM: 15 }],
  'Isola Test Cafe': [{ dlat: 0.0, dlng: 0.09, name: 'Isola Test Cafe', kind: 'cafe', cat: 'amenity', road: '', house: '', addr: '', spanM: 10 }],
  'Qwzxv 9999': [],
};
const PLANTS = { 'gt-no-deadline': 'a ship day with no time left is not warned', 'gt-local-script': 'a map name shown in the local script', 'gt-confirmed': 'an estimate shown as a confirmed time', 'gt-own-ride': 'a second ride calculator (straight-line walk, no boat)' };
(async () => {
  const s = await serve(FILE); const b = await chromium.launch(), fails = [], caught = {}; let ok = 0;
  const run = async (plant, size) => {
    const ctx = await b.newContext(size === 'tablet' ? { viewport: { width: 1280, height: 800 }, hasTouch: true, deviceScaleFactor: SHOT ? 2 : 1 } : { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: SHOT ? 2 : 1 });
    await ctx.addInitScript(pl => { try { localStorage.setItem('kairoute.intro1', '1'); if (pl) window.__kairoutePlant = pl; } catch (e) {} }, plant);
    let centre = null;
    await ctx.route(u => !/^http:\/\/localhost/.test(String(u)), r => { const u = new URL(r.request().url()), H = { 'access-control-allow-origin': '*' };
      if (/workers\.dev/.test(u.hostname) && u.pathname === '/status') return r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: '{"ok":true,"on":false}' });
      if (/workers\.dev/.test(u.hostname) && u.pathname === '/findplace') { const q = u.searchParams.get('q'), m = MAP[q] || [];
        return r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify({ places: m.map((x, k) => Object.assign({ osm: 'N' + k, names: x.name ? [x.name] : [] }, x, { lat: centre.lat + x.dlat, lng: centre.lng + x.dlng })) }) }); }
      return r.fulfill({ status: 503, body: '' }); });
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.goto(s.url); await p.waitForTimeout(2500);
    const sample = p.locator('[data-act="loadsample"]').first(); if (await sample.isVisible().catch(() => false)) await sample.click();
    await p.waitForTimeout(4000);
    for (let k = 0; k < 5; k++) { const sk = p.locator('.coach button:has-text("Skip")').first(); if (await sk.isVisible().catch(() => false)) await sk.click(); else break; }
    const days = await p.evaluate(() => window.__kairouteState().days.map(d => d.type));
    const ship = days.indexOf('port'), land = days.indexOf('land');
    const bad = (label, why) => { if (plant) caught[plant] = (caught[plant] || []).concat(label + ': ' + why); else fails.push(`${size} ${label}: ${why}`); };
    const sheet = () => p.evaluate(() => { const el = document.getElementById('gtSheet'); return el ? el.innerText : null; });
    // Opens Get there from the screen given, by a real tap.
    const open = async (i, screen) => { await p.evaluate(() => { const c = document.querySelector('[data-act="gtclose"]'); if (c) c.click(); });
      await p.evaluate(([i, v]) => window.__kairouteAt(i, v), [i, screen]); await p.waitForTimeout(1500);
      const btn = p.locator('[data-act="gtopen"]:visible').first(); if (!(await btn.count())) { bad(`day ${i} ${screen}`, 'no Get there button on the screen'); return false; }
      await btn.scrollIntoViewIfNeeded(); await btn.tap(); await p.waitForTimeout(700); if ((await sheet()) == null) { bad(`day ${i} ${screen}`, 'tapping Get there opened nothing'); return false; } return true; };
    const type = async (q, map) => { await p.fill('#gtQ', q); await p.waitForTimeout(400); if (map) { await p.locator('#gtQ').press('Enter'); await p.waitForTimeout(1500); } };
    const pick = async (re) => { const r = p.locator('[data-act="gtpick"]', { hasText: re }).first(); if (!(await r.count())) return false; await r.tap(); await p.waitForTimeout(1800); return true; };
    // The card's ways: every one says its source, and a time no timetable confirms reads "about".
    const ways = () => p.evaluate(() => [...document.querySelectorAll('#gtSheet .gtway')].map(li => ({ kind: li.dataset.kind, src: li.dataset.src, min: (li.querySelector('.gtmin') || {}).innerText || '', sub: (li.querySelector('.sub') || {}).innerText || '' })));
    const checkWays = async (label, w) => { if (!w.length) return bad(label, 'no way there shown');
      for (const x of w) { if (!x.sub.trim()) bad(label, x.kind + ': does not say where its time comes from');
        if (x.kind !== 'walk' && x.src !== 'timetable' && !/^about /.test(x.min)) bad(label, `${x.kind} ${x.min}: a time no timetable confirms is shown as a fact`); } };
    const noScript = async label => { const t = await sheet(); if (t && OTHER.test(t)) bad(label, 'the sheet shows another script (R-11): ' + (t.match(new RegExp('.{0,30}' + OTHER.source + '.{0,30}')) || [''])[0]); };
    for (const [i, kind] of plant ? [[ship, 'ship']] : [[ship, 'ship'], [land, 'city']]) {   // a planted bug is looked for on the ship day, where all four show
      if (i < 0) { fails.push('the sample trip has no ' + kind + ' day'); continue; }
      centre = await p.evaluate(i => { const c = window.__kairouteCityOf(i), x = (c.starts && c.starts.point && c.starts.point[0]) || c.sites[0]; return { lat: +x.lat, lng: +x.lng }; }, i);
      const L = `${plant || 'app'} ${kind} day ${i}`;
      if (!(await open(i, 'plan'))) continue;
      const first = await sheet();
      if (kind === 'ship' && !/Your ship/.test(first)) bad(L, 'the ship is not offered before anything is typed');
      // A guide sight from a few letters, offline.
      const site = await p.evaluate(i => { const pl = window.__kairouteLiveTest.plan(i); const s = pl && pl.stops.filter(x => !x.bonus).sort((a, b) => b.t - a.t)[0]; return s ? s.name : null; }, i);
      if (site) { const w3 = site.split(/\s+/).find(w => w.length >= 4) || site; await type(w3.slice(0, 4));
        if (!(await pick(site.slice(0, 12)))) bad(L, `typing "${w3.slice(0, 4)}" does not list ${site}`);
        else { const t = await sheet(); await checkWays(L + ' ' + site, await ways()); await noScript(L + ' guide sight');
          const back = await p.evaluate(() => { const b = document.querySelector('#gtSheet .gtback'); return b ? b.dataset.back : null; });
          if (kind === 'ship' && !back) bad(L, 'a ship day card does not say when to leave to be back');
          if (kind === 'city' && back) bad(L, 'a city day with no time to be back shows a back-by: ' + t.slice(0, 120));
          if (SHOT && !plant) await p.screenshot({ path: `${SHOT}-${size}-${kind}-sight.png` });
          ok++; }
        // Too late to go: the clock set 15 min before the time to be back, the place farther than that.
        if (kind === 'ship') { await p.evaluate(i => { const a = window.__kairouteLiveTest.alarm(i); window.__kairouteGtAt = a.backBy - 15; }, i);
          await p.evaluate(() => { const c = document.querySelector('[data-act="gtback"]'); if (c) c.click(); }); await p.waitForTimeout(300); await type(site.split(/\s+/).find(w => w.length >= 4).slice(0, 4)); await pick(site.slice(0, 12));
          const late = await p.evaluate(() => { const b = document.querySelector('#gtSheet .gtback'); return b ? { back: b.dataset.back, role: b.getAttribute('role'), t: b.innerText } : null; });
          if (!late || late.back !== 'none' || late.role !== 'alert') bad(L, 'with 15 min left before the time to be back, going to ' + site + ' is not said to leave no time: ' + JSON.stringify(late));
          else ok++;
          if (SHOT && !plant) await p.screenshot({ path: `${SHOT}-${size}-ship-late.png` });
          await p.evaluate(() => { delete window.__kairouteGtAt; }); }
      }
      // A street address, from the map, at its door.
      await p.evaluate(() => { const c = document.querySelector('[data-act="gtback"]'); if (c) c.click(); }); await p.waitForTimeout(300);
      await type('Odos Testou 12', true);
      if (!(await pick(/Odos Testou 12/))) bad(L, 'a street address the map has is not listed: ' + (await sheet()).slice(0, 200)); else { await checkWays(L + ' address', await ways()); ok++; }
      // A place named only in the local script: listed and shown in Latin letters.
      await p.evaluate(() => { const c = document.querySelector('[data-act="gtback"]'); if (c) c.click(); }); await p.waitForTimeout(300);
      // Also: the app's last-resort exit rule (R-11) must not have had to rewrite it: the name is written right at the source.
      const exitFix = () => p.evaluate(() => ((window.__kairouteLang || {}).last || []).filter(x => /Δοκιμ/.test(x)).length);
      const fix0 = await exitFix();
      await type('Ταβέρνα Δοκιμή', true); await noScript(L + ' local-script search');
      if ((await exitFix()) > fix0) bad(L, 'the map name reached the screen in the local script (the exit rule had to rewrite it)');
      if (!(await pick(/./))) bad(L, 'a place the map names only in the local script is not listed'); else { await noScript(L + ' local-script card'); ok++; }
      // Not on the map: said plainly.
      await p.evaluate(() => { const c = document.querySelector('[data-act="gtback"]'); if (c) c.click(); }); await p.waitForTimeout(300);
      await type('Qwzxv 9999', true); const nf = await sheet();
      if (!/couldn.t find .Qwzxv 9999. in .* on the map/i.test(nf)) bad(L, 'a place the map does not have is not said plainly: ' + nf.slice(0, 200)); else ok++;
      // Across the water: an island the map's paths don't reach, 7-10 km off; the place on it is reached by boat.
      if (kind === 'ship') {
        await p.evaluate(([i, c]) => { const k = window.__kairouteCityOf(i).city.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(), la = c.lat, ln = c.lng + 0.09, e = 0.01;
          window.__kairouteIsles().set(k, { shapes: [{ id: 'test-isle', name: 'Test Isle', walk: false, rings: [[la - e, ln - e, la - e, ln + e, la + e, ln + e, la + e, ln - e, la - e, ln - e]] }], centreShape: 'mainland' }); }, [i, centre]);
        await p.evaluate(() => { const c = document.querySelector('[data-act="gtback"]'); if (c) c.click(); }); await p.waitForTimeout(300);
        await type('Isola Test Cafe', true);
        if (!(await pick(/Isola Test Cafe/))) bad(L, 'the island place is not listed'); else { const w = await ways();
          if (!w.some(x => x.kind === 'ferry')) bad(L, 'a place across the water is offered no boat: ' + w.map(x => x.kind + ' ' + x.min).join(', '));
          else if (w.some(x => x.kind === 'walk' || x.kind === 'taxi')) bad(L, 'a place across the water is offered a walk or taxi: ' + w.map(x => x.kind).join(', '));
          else ok++;
          await checkWays(L + ' island', w); if (SHOT && !plant) await p.screenshot({ path: `${SHOT}-${size}-island.png` }); }
      }
    }
    // The other screens carry the button too.
    if (!plant && ship >= 0) for (const v of ['guide', 'tour']) { if (await open(ship, v)) ok++; }
    if (errs.length) fails.push(`${plant || 'app'} ${size}: page errors: ${errs.slice(0, 3).join(' | ')}`);
    await ctx.close();
  };
  await run('', 'phone'); await run('', 'tablet');
  for (const pl of Object.keys(PLANTS)) await run(pl, 'phone');
  for (const [pl, what] of Object.entries(PLANTS)) { if (caught[pl]) console.log(`planted "${what}": caught (${caught[pl].length}) e.g. ${caught[pl][0]}`); else fails.push(`planted bug "${what}" (${pl}) was NOT caught`); }
  await b.close(); s.close();
  if (fails.length) { console.log('GET THERE CHECK FAILED (R-40)\n- ' + fails.join('\n- ')); process.exit(1); }
  console.log(`GET THERE CHECK OK (R-40): ${ok} checks passed on phone and tablet (ship day, city day, guide sight, address, local script, not found, across the water, too late, every screen); ${Object.keys(PLANTS).length} planted bugs caught`);
})();
