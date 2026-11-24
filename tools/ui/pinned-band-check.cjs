// Nothing pinned ever covers content (R-30; Richard, Nov 24 2026: on Choose sights the pinned green LEAVE BY banner sat
// over a sight's name, "Seikilos epitaph" half hidden, with cards showing around and between the pinned pieces).
// Drives the built Beta 2 app over every day of each trip, on Day plan and Choose sights, at phone, tablet and upright
// tablet size, and scrolls each screen top to bottom. At every stop, whenever something is pinned at the top (the day
// strip, the back-to-the-ship countdown, any other .pinned piece):
//   1. Nothing of the page shows in the pinned area: across the full width, from the top of the screen to the bottom of
//      the lowest pinned piece, every point is either a pinned piece or the solid band behind them (no card, no title).
//   2. Bars that stick (Choose sights' time-left bar) sit fully below the pinned area, never under it.
// Points are measured with the browser's own hit test (what a finger or an eye would meet), not by reading CSS.
// It proves itself once per run: with the planted bug "no band" on, check 1 must fail on a ship day.
// Usage: node tools/ui/pinned-band-check.cjs [beta2-site/index.html]   SIZES=phone,tablet,upright  DAYS=6|all
//   TRIPS=sample (default, the release gate) | corpus | comma list of corpus names. NO_PROOF=1 skips the proof.
// Exit 1 on any failure. No internet, no AI.
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'beta2-site/index.html');
const SIZES = { phone: { width: 412, height: 915, isMobile: true, hasTouch: true }, small: { width: 360, height: 780, isMobile: true, hasTouch: true }, tablet: { width: 1280, height: 800, hasTouch: true }, upright: { width: 800, height: 1280, hasTouch: true } };
const PICK = (process.env.SIZES || 'phone,tablet,upright').split(',');
const NDAYS = process.env.DAYS === 'all' ? 1e9 : +process.env.DAYS || 8;
const CORPUS = path.join(__dirname, '..', 'beta2', 'corpus');
const TRIPS = (() => { const t = process.env.TRIPS || 'sample'; if (t === 'sample') return ['sample'];
  const all = fs.readdirSync(CORPUS).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')); return t === 'corpus' ? all : t.split(',').filter(x => x === 'sample' || all.includes(x)); })();
const hm = m => m == null ? null : String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
function corpusTrip(name) { const j = JSON.parse(fs.readFileSync(path.join(CORPUS, name + '.json'), 'utf8')), cities = {};
  for (const [k, c] of Object.entries(j.cities || {})) cities[k] = Object.assign({ city: c.name }, c);
  const days = j.days.map(d => ({ id: d.id, date: d.date, destination: (j.cities[d.city] || {}).name || d.city || 'At sea', type: d.type, mode: d.mode, time: d.time, startTime: d.startTime, hours: d.hours,
    portArrive: hm(d.portArrive), allAboard: hm(d.allAboard), tender: d.tender, returnToStart: d.returnToStart, alongWay: true, pointIdx: 0, pointPicked: true, selected: d.selected, ownList: true, cityKey: d.city, event: '' }));
  return { cities, trip: { id: 't-' + name, name: j.label || name, style: j.style || 'mix', active: 0, days, lodging: {}, journal: {}, prefs: j.prefs, legModes: j.legModes || {} } }; }
const res = []; let pinnedSeen = 0;
const check = (name, ok, why) => { res.push({ name, ok }); if (!ok || process.env.VERBOSE) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ': ' + why}`); return ok; };
function serve(file) { const dir = path.dirname(file), name = path.basename(file);
  return new Promise(r0 => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? name : u);
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
    s.listen(0, () => r0({ url: 'http://localhost:' + s.address().port + '/' + name, close: () => s.close() })); }); }
// In the page: the pinned area and anything of the page that shows inside it.
const LOOK = () => {
  const fixedTop = e => { const c = getComputedStyle(e), r = e.getBoundingClientRect(); return c.position === 'fixed' && c.visibility !== 'hidden' && r.height > 0 && r.top < innerHeight / 3 && r.bottom > 0; };
  const pins = [...document.querySelectorAll('.pinned, .pinned > summary')].filter(fixedTop);
  if (!pins.length) return null;
  const B = Math.max(...pins.map(e => e.getBoundingClientRect().bottom));
  const inPin = el => pins.some(p => p.contains(el));
  const shows = new Set();
  for (let y = 2; y < B - 1; y += 5) for (let x = 4; x < innerWidth - 4; x += 20) {
    const el = document.elementFromPoint(x, y); if (!el || inPin(el)) continue;
    const v = el.closest('#view'); if (!v) continue; // the band, the header, the side rail are not the page's content
    const card = el.closest('[data-card], .card, .tl, .site, section, li') || el;
    shows.add(((card.querySelector && card.querySelector('.name, h3, h2, strong')) || card).textContent.trim().replace(/\s+/g, ' ').slice(0, 40) + ` (y ${Math.round(y)})`); }
  const bars = [...document.querySelectorAll('#view .pickbar, #view .meter')].filter(b => { const c = getComputedStyle(b); return c.position === 'sticky' && b.offsetParent; })
    .map(b => ({ cls: b.className, top: b.getBoundingClientRect().top })).filter(b => b.top >= -1 && b.top < B - 1);
  return { B: Math.round(B), pins: pins.map(p => p.id || p.className || p.tagName).join('+'), shows: [...shows].slice(0, 3), bars: bars.map(b => `${b.cls} at ${Math.round(b.top)}`) };
};
const SCROLL = f => { const panes = [...document.querySelectorAll('#view .pane')].filter(p => p.scrollHeight > p.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(p).overflowY));
  const se = document.scrollingElement; window.scrollTo(0, Math.round((se.scrollHeight - innerHeight) * f)); for (const p of panes) p.scrollTop = Math.round((p.scrollHeight - p.clientHeight) * f);
  window.dispatchEvent(new Event('scroll')); return se.scrollHeight > innerHeight + 40 || panes.length > 0; };
(async () => {
  const browser = await chromium.launch(); const srv = await serve(FILE);
  for (const size of PICK) for (const tripName of TRIPS) { const vp = SIZES[size]; if (!vp) continue;
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: 1 });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await p.route(u => !/^http:\/\/localhost/.test(String(u)), r => r.fulfill({ status: 503, body: '' }));
    await p.goto(srv.url); await p.waitForTimeout(2500);
    if (tripName === 'sample') { const s = p.locator('[data-act="loadsample"]').first(); if (await s.isVisible().catch(() => false)) await s.click(); await p.waitForTimeout(5000); }
    else { await p.evaluate(A => { localStorage.setItem('kairoute.intro1', '1'); localStorage.setItem('wayside.cities', JSON.stringify(A.cities)); localStorage.setItem('wayside.trip2', JSON.stringify(A.trip)); }, corpusTrip(tripName)); await p.reload(); await p.waitForTimeout(3000); }
    for (let k = 0; k < 5; k++) { const sk = p.locator('.coach button:has-text("Skip")').first(); if (await sk.isVisible().catch(() => false)) await sk.tap(); else break; }
    const days = await p.evaluate(() => window.__kairouteDays().map((d, i) => ({ i, dest: d.dest })));
    const settle = async () => { for (let w = 0; w < 80 && await p.evaluate(() => window.__kairouteFitPending && window.__kairouteFitPending()); w++) await p.waitForTimeout(100); await p.waitForTimeout(250); };
    const scan = async (tag) => { const bad = [], bars = []; let pinned = 0;
      for (const f of [0, .15, .3, .45, .6, .75, .9, 1]) { const can = await p.evaluate(SCROLL, f); if (!can) break; await p.waitForTimeout(150);
        const r = await p.evaluate(LOOK); if (!r) continue; pinned++;
        if (r.shows.length) bad.push(`${r.pins} to ${r.B} px: ${r.shows.join('; ')}`);
        if (r.bars.length) bars.push(`pinned area ends at ${r.B} px, ${r.bars.join(', ')}`); }
      return { bad, bars, pinned }; };
    let n = 0;
    for (const d of days) { if (n >= NDAYS) break; n++;
      for (const scr of ['plan', 'sites']) {
        await p.evaluate(([i, s]) => { window.__kairouteGo('day', i); window.__kairouteGo(s); }, [d.i, scr]); await settle();
        const tag = `${size}${tripName === 'sample' ? '' : ' ' + tripName} day ${d.i + 1} ${d.dest} ${scr === 'plan' ? 'Day plan' : 'Choose sights'}`;
        const r = await scan(tag); if (!r.pinned) continue; pinnedSeen++;
        check(`${tag}: nothing of the page shows in the pinned area`, !r.bad.length, r.bad.slice(0, 2).join(' | '));
        check(`${tag}: sticky bars sit below the pinned area`, !r.bars.length, r.bars.slice(0, 2).join(' | '));
        await p.evaluate(() => window.scrollTo(0, 0)); } }
    check(`${size} ${tripName}: no errors in the app`, !errs.length, errs.slice(0, 2).join(' | '));
    // Its own proof, once per run: plant "no band" and the check must see the page show through on a ship day.
    if (tripName === TRIPS[0] && size === PICK[0] && !process.env.NO_PROOF) { let caught = null;
      await p.evaluate(() => { window.__kairoutePlant = 'noband'; });
      for (const d of days) { await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('sites'); }, d.i); await settle();
        const r = await scan('proof'); if (!r.pinned) continue; caught = r.bad.length > 0; if (caught) break; }
      await p.evaluate(() => { window.__kairoutePlant = ''; });
      check(`proof: the planted bug "no band behind pinned pieces" is caught (${size} ${tripName})`, caught === true, caught === null ? 'NOT TESTED: nothing pinned on any day' : 'the check did not see the page under the pinned pieces: it is blind'); }
    await ctx.close(); }
  await browser.close(); srv.close();
  const f = res.filter(r => !r.ok).length;
  console.log(`\nPinned band check (${TRIPS.length} trip(s), ${PICK.join('/')}): ${res.length - f} passed, ${f} failed, ${pinnedSeen} screen(s) with something pinned`);
  process.exitCode = f ? 1 : (pinnedSeen ? 0 : 1);
})().catch(e => { console.error('FAIL pinned band check crashed:', e); process.exitCode = 2; });
