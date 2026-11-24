// Steady sights list (Richard, Nov 23 2026: "The select site page is unusable. It's jumping around").
// Drives the built Beta 2 app on Choose sights the way a traveler does, at phone, tablet and upright-tablet size with
// the CPU slowed like a phone, over the sample trip, and measures where every card is ON SCREEN over time:
//   1. Opening the page: once a card is shown, no shown card moves or vanishes by itself (the list is sorted before
//      it shows, never in front of the traveler).
//   2. Ticking a sight in the middle of the list: the ticked card stays under the finger (within 4 px), and from
//      0.3 s to 3 s after the tap nothing on screen moves (no late jump when the fits check finishes).
//   3. Unticking: the same.
//   4. Next visit to the page: the sights ticked are sorted into "Your sights" (the list organizes itself, on open).
// Card positions are measured directly, not by the browser's layout-shift score: the app redraws by replacing the
// page's HTML, which the layout-shift score does not see. No internet, no AI.
// Usage: node tools/ui/steady-sights-check.cjs [beta2-site/index.html]   SIZES=phone,tablet,upright  DAYS=4|all  CPU_SLOW=4
//   TRIPS=sample (default, the release gate) | corpus (every saved test trip in tools/beta2/corpus: the 20-city list, live
//   trips, no-AI trips, the sample cruise and its variants; the nightly run, DAYS=all) | a comma list of corpus names.
// Exit 1 on any failure. Prints PASS/FAIL per check and a summary line.
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'beta2-site/index.html');
const SIZES = { phone: { width: 412, height: 915, isMobile: true, hasTouch: true }, tablet: { width: 1280, height: 800, hasTouch: true }, upright: { width: 800, height: 1280, hasTouch: true } };
const PICK = (process.env.SIZES || 'phone,tablet,upright').split(',');
const NDAYS = process.env.DAYS === 'all' ? 1e9 : +process.env.DAYS || 4, SLOW = +process.env.CPU_SLOW || 4;
const CORPUS = path.join(__dirname, '..', 'beta2', 'corpus');
const TRIPS = (() => { const t = process.env.TRIPS || 'sample'; if (t === 'sample') return ['sample'];
  const all = fs.readdirSync(CORPUS).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')); return t === 'corpus' ? all : t.split(',').filter(x => x === 'sample' || all.includes(x)); })();
// A saved test trip (the engine's facts) as the app stores a trip: its guides and its days, the traveler's picks kept.
const hm = m => m == null ? null : String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
function corpusTrip(name) { const j = JSON.parse(fs.readFileSync(path.join(CORPUS, name + '.json'), 'utf8')), cities = {};
  for (const [k, c] of Object.entries(j.cities || {})) cities[k] = Object.assign({ city: c.name }, c);
  const days = j.days.map(d => ({ id: d.id, date: d.date, destination: (j.cities[d.city] || {}).name || d.city || 'At sea', type: d.type, mode: d.mode, time: d.time, startTime: d.startTime, hours: d.hours,
    portArrive: hm(d.portArrive), allAboard: hm(d.allAboard), tender: d.tender, returnToStart: d.returnToStart, alongWay: true, pointIdx: 0, pointPicked: true, selected: d.selected, ownList: true, cityKey: d.city, event: '' }));
  return { cities, trip: { id: 't-' + name, name: j.label || name, style: j.style || 'mix', active: 0, days, lodging: {}, journal: {}, prefs: j.prefs, legModes: j.legModes || {} } }; }
const res = [], skipped = []; const check = (name, ok, why) => { res.push({ name, ok, why }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ': ' + why}`); return ok; };
function serve(file) { const dir = path.dirname(file), name = path.basename(file);
  return new Promise(r0 => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? name : u);
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
    s.listen(0, () => r0({ url: 'http://localhost:' + s.address().port + '/' + name, close: () => s.close() })); }); }
// Every card the traveler can see right now: id -> top on screen (px). Hidden (not yet sorted) or folded cards don't count.
const SEEN = () => { const out = {}; for (const c of document.querySelectorAll('#view .sitesmain [data-card]')) {
    if (!c.offsetParent || c.closest('.sorthold, details:not([open]), .picksfold:not(.open) .anchorlist')) continue;
    const st = getComputedStyle(c); if (st.visibility === 'hidden') continue; const b = c.getBoundingClientRect();
    if (b.bottom <= 0 || b.top >= innerHeight || b.height < 4) continue; out[c.dataset.card] = Math.round(b.top); }
  if (window.__steadyDiag) for (const e of document.querySelectorAll('#view .sitesmain [data-card], #view .sitesmain > *, #view .sitesside, header.top, #dayRowSpace, #view > *')) { const b = e.getBoundingClientRect(); if (b.height) out['@ ' + (e.dataset.card || e.id || e.className.slice(0, 24))] = Math.round(b.top) + '/' + Math.round(b.height); }
  return out; };
const moves = (a, b, tol = 2) => Object.keys(a).filter(id => id in b && (Math.abs(a[id] - b[id]) > tol || (id[0] === '@' && a[id] !== b[id]))).map(id => `${id} ${a[id]}→${b[id]}`);
// The cards on screen in both looks, in their order down the screen: a re-sort changes it even when the tapped card stays.
const orderOf = (o, other) => Object.keys(o).filter(k => k[0] !== '@' && k in other).sort((x, y) => o[x] - o[y]).join(',');
const gone = (a, b) => Object.keys(a).filter(id => !(id in b) && a[id] > 60 && a[id] < 700).map(id => `${id} (was at ${a[id]})`); // vanished from mid-screen
(async () => {
  const browser = await chromium.launch(); const srv = await serve(FILE);
  for (const size of PICK) for (const tripName of TRIPS) { const vp = SIZES[size]; if (!vp) continue;
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: 1 });
    const p = await ctx.newPage(); if (process.env.DIAG) await p.addInitScript(() => { window.__steadyDiag = 1; }); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await p.route(u => !/^http:\/\/localhost/.test(String(u)), r => r.fulfill({ status: 503, body: '' }));
    await p.goto(srv.url); await p.waitForTimeout(2500);
    if (tripName === 'sample') { const sample = p.locator('[data-act="loadsample"]').first(); if (await sample.isVisible().catch(() => false)) await sample.click(); await p.waitForTimeout(5000); }
    else { await p.evaluate(A => { localStorage.setItem('kairoute.intro1', '1'); localStorage.setItem('wayside.cities', JSON.stringify(A.cities)); localStorage.setItem('wayside.trip2', JSON.stringify(A.trip)); }, corpusTrip(tripName)); await p.reload(); await p.waitForTimeout(3000); }
    for (let k = 0; k < 5; k++) { const sk = p.locator('.coach button:has-text("Skip")').first(); if (await sk.isVisible().catch(() => false)) await sk.tap(); else break; }
    for (let w = 0; w < 300 && !(await p.evaluate(() => window.__kairouteSeedDone && window.__kairouteSeedDone())); w++) await p.waitForTimeout(100);
    const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: SLOW });
    const days = await p.evaluate(() => window.__kairouteDays().map((d, i) => ({ i, dest: d.dest })));
    const open = async i => { await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('plan'); }, i); await p.waitForTimeout(300); await p.evaluate(() => window.__kairouteGo('sites')); };
    const settle = async () => { for (let w = 0; w < 120 && await p.evaluate(() => window.__kairouteFitPending && window.__kairouteFitPending()); w++) await p.waitForTimeout(100); await p.waitForTimeout(300); };
    let tried = 0;
    for (const d of days) { if (tried >= NDAYS) break;
      const tag = `${size}${tripName === 'sample' ? '' : ' ' + tripName} day ${d.i + 1} ${d.dest}`;
      // 1. Opening: sample every 100 ms for 4 s; from the first shown card on, nothing shown moves or vanishes by itself.
      await open(d.i); let prev = null, first = -1; const bad1 = [];
      for (let t = 0; t < 40; t++) { const now = await p.evaluate(SEEN);
        if (prev && Object.keys(prev).length) { const m = moves(prev, now), g = gone(prev, now); if (m.length || g.length) bad1.push(`at ${t * 100} ms: ${m.concat(g.map(x => 'gone ' + x)).slice(0, 3).join(', ')}`); }
        if (first < 0 && Object.keys(now).length) first = t * 100; prev = now; await p.waitForTimeout(100); }
      await settle();
      const free = await p.evaluate(() => [...document.querySelectorAll('#view .sitesmain label.site input[data-site]:not(:checked)')].filter(x => !x.closest('details:not([open]), .picksfold, .sorthold') && x.dataset.site === (x.closest('[data-card]') || {dataset:{}}).dataset.card).map(x => x.dataset.site));
      if (free.length < 2) continue; tried++;
      check(`${tag}: opening the list, nothing on screen moves by itself`, !bad1.length, bad1.slice(0, 2).join(' | '));
      check(`${tag}: the list shows within 4 s`, first >= 0, 'no card shown 4 s after opening');
      // 2. Tick up to three sights from the middle and end of the list, each scrolled to mid-screen and tapped.
      const ticked = [];
      for (const id of [free[Math.floor(free.length / 2)], free[free.length - 1], free[1]].filter((x, k, a) => x && a.indexOf(x) === k)) {
        const r = await p.evaluate(id => { const x = document.querySelector(`input[data-site="${id}"]`); if (!x || x.checked) return null; x.closest('[data-card]').scrollIntoView({ block: 'center' }); return true; }, id); if (!r) continue;
        await p.waitForTimeout(600);
        const pt = await p.evaluate(id => { const x = document.querySelector(`input[data-site="${id}"]`), b = x.getBoundingClientRect(), at = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return at && x.closest('[data-card]').contains(at) ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null; }, id);
        if (!pt) { check(`${tag}: ${id} can be tapped`, false, 'something covers its tick box'); continue; }
        const before = await p.evaluate(SEEN); await p.touchscreen.tap(pt.x, pt.y);
        await p.waitForTimeout(300);
        if (await p.evaluate(() => !!document.querySelector('.fitbox, .closedbox'))) { await p.evaluate(() => { const c = document.querySelector('.fitbox [data-act="fitcancel"], .closedbox [data-act="fitcancel"]'); if (c) c.click(); }); await p.waitForTimeout(300); continue; }
        const on = await p.evaluate(id => { const x = document.querySelector(`input[data-site="${id}"]`); return !!(x && x.checked); }, id); if (!on) continue; ticked.push(id);
        const a = await p.evaluate(SEEN); await p.waitForTimeout(2700); await settle(); const b = await p.evaluate(SEEN);
        check(`${tag}: ticking ${id} keeps it under the finger`, id in a && Math.abs(a[id] - before[id]) <= 4, (id in a ? `moved ${before[id]}→${a[id]} px` : 'it left the screen') + (process.env.DIAG ? ' DIAG ' + moves(before, a).slice(0, 30).join(' ; ') : ''));
        check(`${tag}: ticking ${id} keeps the cards around it in their order`, orderOf(before, a) === orderOf(a, before) && !gone(before, a).length, orderOf(before, a) !== orderOf(a, before) ? `order on screen was ${orderOf(before, a)}, now ${orderOf(a, before)}` : 'gone from the screen: ' + gone(before, a).slice(0, 3).join(', '));
        const late = moves(a, b).concat(gone(a, b).map(x => 'gone ' + x));
        check(`${tag}: after ticking ${id}, nothing jumps later`, !late.length, late.slice(0, 3).join(', '));
      }
      check(`${tag}: at least one sight could be ticked`, ticked.length > 0, 'none of the tried sights ticked');
      // 2b. Opening a card's details, then another card below it: the card tapped stays under the finger (the first
      //     one closing above it must not pull it up; Nov 23 feel check measured 270 px).
      { const two = await p.evaluate(() => [...document.querySelectorAll('#view .sitesmain label.site')].filter(x => !x.closest('details:not([open]), .picksfold:not(.open), .sorthold')).map(x => x.dataset.card));
        if (two.length >= 3) { const A = two[0], B = two[Math.min(2, two.length - 1)];
          const tapBody = async id => { await p.evaluate(id => document.querySelector(`[data-card="${id}"]`).scrollIntoView({ block: 'center' }), id); await p.waitForTimeout(400);
            const pt = await p.evaluate(id => { const n = document.querySelector(`[data-card="${id}"] .l2`); if (!n) return null; const b = n.getBoundingClientRect(); return { x: b.x + Math.min(b.width - 4, 60), y: b.y + b.height / 2 }; }, id); if (!pt) return null;
            const before = await p.evaluate(SEEN); await p.touchscreen.tap(pt.x, pt.y); await p.waitForTimeout(400); const after = await p.evaluate(SEEN); return [before[id], after[id]]; };
          await tapBody(A); const r = await tapBody(B);
          if (r) check(`${tag}: opening a second card keeps it under the finger`, r[1] != null && Math.abs(r[1] - r[0]) <= 4, r[1] == null ? 'it left the screen' : `moved ${r[0]}→${r[1]} px`);
          await tapBody(B); } }
      // 4. Next visit: what was ticked is sorted into "Your sights".
      await p.evaluate(() => window.__kairouteGo('plan')); await p.waitForTimeout(300); await p.evaluate(() => window.__kairouteGo('sites')); await settle();
      const notUp = await p.evaluate(ids => ids.filter(id => !document.querySelector(`.sitesmain .picksfold [data-card="${id}"]`)), ticked);
      check(`${tag}: on the next visit the ticked sights are under Your sights`, !notUp.length, notUp.join(', '));
      // 3. Untick them again (from Your sights), with the same checks.
      await p.evaluate(() => { const b = document.querySelector('[data-act="picksfold"][aria-expanded="false"]'); if (b) b.click(); }); await p.waitForTimeout(300);
      for (const id of ticked) {
        await p.evaluate(id => { const x = document.querySelector(`input[data-site="${id}"]`); if (x) x.closest('[data-card]').scrollIntoView({ block: 'center' }); }, id); await p.waitForTimeout(600);
        const pt = await p.evaluate(id => { const x = document.querySelector(`input[data-site="${id}"]`); if (!x) return null; const b = x.getBoundingClientRect(), at = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return at && x.closest('[data-card]').contains(at) ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null; }, id);
        if (!pt) { check(`${tag}: ${id} can be unticked`, false, 'its tick box is missing or covered'); continue; }
        const SCR = () => [scrollY, ...[...document.querySelectorAll('#view .pane')].map(e => e.scrollTop + '/' + (e.scrollHeight - e.clientHeight))];
        const scr = [await p.evaluate(SCR)];
        const before = await p.evaluate(SEEN); await p.touchscreen.tap(pt.x, pt.y); await p.waitForTimeout(300);
        const a = await p.evaluate(SEEN); scr.push(await p.evaluate(SCR)); await p.waitForTimeout(2700); await settle(); const b = await p.evaluate(SEEN);
        check(`${tag}: unticking ${id} keeps it under the finger`, id in a && Math.abs(a[id] - before[id]) <= 4, (id in a ? `moved ${before[id]}→${a[id]} px` : 'it left the screen') + (process.env.DIAG ? ' DIAG ' + moves(before, a).join(' ; ') + ' DIAGSCROLL ' + JSON.stringify(scr) : ''));
        check(`${tag}: unticking ${id} keeps the cards around it in their order`, orderOf(before, a) === orderOf(a, before) && !gone(before, a).length, orderOf(before, a) !== orderOf(a, before) ? `order on screen was ${orderOf(before, a)}, now ${orderOf(a, before)}` : 'gone from the screen: ' + gone(before, a).slice(0, 3).join(', '));
        const late = moves(a, b).concat(gone(a, b).map(x => 'gone ' + x));
        check(`${tag}: after unticking ${id}, nothing jumps later`, !late.length, late.slice(0, 3).join(', '));
      }
    }
    // A trip whose every day is at sea or has under 2 sights to tick is reported, never counted as passed.
    const roomy = tripName === 'sample' ? Math.min(NDAYS, 2) : 1;
    if (tried >= roomy) check(`${size} ${tripName}: ${tried} day(s) with sights tried`, true, '');
    else if (tripName === 'sample') check(`${size} sample: ${NDAYS} days with sights tried`, false, `only ${tried}`);
    else { console.log(`NOTE ${size} ${tripName}: not tested, no day with 2 or more sights to tick`); skipped.push(`${size} ${tripName}`); }
    check(`${size} ${tripName}: no errors in the app`, !errs.length, errs.slice(0, 2).join(' | '));
    // Its own proof (R-28), once per run: with the planted bug "re-sort the list after a tap" switched on, this check
    // must see the ticked card leave the finger. If it doesn't, the check is blind and the run fails.
    if (tripName === TRIPS[0] && size === PICK[0] && !process.env.NO_PROOF) {
      let caught = null;
      for (const d of days) { await open(d.i); await settle();
        const id = await p.evaluate(() => { const xs = [...document.querySelectorAll('#view .sitesmain label.site input[data-site]:not(:checked)')].filter(x => !x.closest('details:not([open]), .picksfold, .sorthold') && x.dataset.site === (x.closest('[data-card]') || {dataset:{}}).dataset.card); const x = xs[Math.floor(xs.length / 2)]; if (!x) return null; x.closest('[data-card]').scrollIntoView({ block: 'center' }); return x.dataset.site; });
        if (!id) continue; await p.waitForTimeout(600);
        const pt = await p.evaluate(id => { const b = document.querySelector(`input[data-site="${id}"]`).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, id);
        const before = await p.evaluate(SEEN); await p.evaluate(() => { window.__kairoutePlant = 'resort'; });
        await p.touchscreen.tap(pt.x, pt.y); await p.waitForTimeout(300);
        if (await p.evaluate(() => !!document.querySelector('.fitbox, .closedbox'))) { await p.evaluate(() => { window.__kairoutePlant = ''; const c = document.querySelector('.fitbox [data-act="fitcancel"], .closedbox [data-act="fitcancel"]'); if (c) c.click(); }); continue; }
        const a = await p.evaluate(SEEN); await p.evaluate(() => { window.__kairoutePlant = ''; });
        // A re-sort shows as the tapped card leaving the finger, or as the cards on screen changing order around it
        // (the app keeps the tapped card in place through any redraw, Nov 24, so the order is what gives a re-sort away).
        caught = !(id in a) || Math.abs(a[id] - before[id]) > 4 || orderOf(before, a) !== orderOf(a, before) || gone(before, a).length > 0;
        await settle(); await p.evaluate(id => { const x = document.querySelector(`input[data-site="${id}"]`); if (x && x.checked) x.click(); }, id); await p.waitForTimeout(400); break; }
      check(`proof: the planted bug "re-sort after a tap" is caught (${size} ${tripName})`, caught === true, caught === null ? 'NOT TESTED: no sight to tick for the proof' : 'the check did not see the card move: it is blind');
    }
    await ctx.close();
  }
  await browser.close(); srv.close();
  const f = res.filter(r => !r.ok).length;
  console.log(`\nSteady sights check (${TRIPS.length} trip(s), ${PICK.join('/')}): ${res.length - f} passed, ${f} failed, ${skipped.length} not tested${skipped.length ? ' (' + skipped.join(', ') + ')' : ''}`);
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('FAIL steady sights check crashed:', e); process.exitCode = 2; });
