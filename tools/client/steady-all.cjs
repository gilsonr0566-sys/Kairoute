// Steady screens on every test trip (class rules, Nov 23 2026: Richard, "every fix must be an app-wide rule for the
// whole class of error"). The client feel test (tools/client/feel.cjs) uses one trip with a real finger; this check
// opens the BUILT Beta 2 app on EVERY saved test trip (tools/beta2/corpus: the 20-city list, the sample cruise and its
// variants, live trips) at phone and tablet size, and holds three class rules on every screen it opens:
//
//   STEADY-REDRAW  A redraw of the screen the traveler is on (answers arriving, live updates) moves nothing: no layout
//                  shift and every element on screen keeps its place. (Escaped: tablets counted the whole screen moving
//                  57 px on each redraw; Choose sights cards jumping.)
//   SETTLES        A screen stops changing by itself within 2.5 s of opening (outside live regions such as clocks and
//                  progress lines). (Escaped: the Journal's cost card redrew every 0.3 s for 6 s.)
//   WAIT-ENDS      With every outside service hanging (never answering), no spinner is left on any screen, including in
//                  folded cards, once the app's time limits have passed (the limits are shortened 20 times in this
//                  check so it runs in seconds). (Escaped: a lookup with no time limit kept "More about today" spinning.)
//   RESUME-LEFT    Reopening the app after Exit tour opens the Day plan, never the tour the traveler left. (Escaped
//                  Nov 23.)
//
// Data sources: built-in places, places from sources, helper answers (refused or hanging), no internet. No AI, no spend.
// Usage: node tools/client/steady-all.cjs [beta2-site/index.html]   TRIPS=g01,g04 (name prefixes)  SIZES=phone,tablet
// Exit 1 on any failure. PLANT=redraw|settle|wait plants a known defect in the page to prove the check fires.
const { chromium } = require('playwright'); const path = require('path'), http = require('http'), fs = require('fs');
const ROOT = path.join(__dirname, '..', '..'), FILE = path.resolve(process.argv[2] || path.join(ROOT, 'beta2-site', 'index.html'));
const CORPUS = process.env.CORPUS || path.join(ROOT, 'tools', 'beta2', 'corpus');
const SIZES = { phone: { width: 412, height: 915, isMobile: true }, tablet: { width: 1280, height: 800, isMobile: true } };
const PICK = (process.env.SIZES || 'phone,tablet').split(','), ONLY = (process.env.TRIPS || '').split(',').filter(Boolean);
const PLANT = process.env.PLANT || '';
const fails = [], counts = { trips: 0, screens: 0, redraws: 0, hung: 0, resumes: 0 };
const fail = (rule, where, why) => { fails.push({ rule, where, why }); console.log(`FAIL ${rule} [${where}] ${why}`); };
function serve() { return new Promise(res => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
  const f = u === '/' || u === '/index.html' ? FILE : path.join(path.dirname(FILE), u);
  if (!f.startsWith(path.dirname(FILE)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
  s.listen(0, () => res({ url: 'http://localhost:' + s.address().port + '/', close: () => s.close() })); }); }
// A saved test trip as the app keeps it on the device.
function appTrip(name, c) {
  const days = c.days.map(d => { const x = Object.assign({}, d); delete x.i; delete x.sites; delete x.wx; delete x.missing; delete x.order;
    x.cityKey = d.city; x.destination = d.city && c.cities[d.city] ? c.cities[d.city].name : d.destination || ''; return x; });
  return { trip: { id: 'steady-' + name, name: c.name || name, style: c.style || 'mix', active: 0, days, lodging: {}, journal: {}, prefs: c.prefs || {}, legModes: c.legModes || {} }, cities: c.cities };
}
// Runs in the page before the app: the trip, no coach, the probes (layout shifts, changes outside live regions),
// shortened time limits, and the planted defects.
const PROBE = ([seed, plant]) => {
  try { const ls = localStorage; if (!ls.getItem('b2:__copied')) { ls.setItem('b2:__copied', '1'); ls.setItem('b2:__merged2', '1');
    ls.setItem('b2:wayside.trip2', seed.trip); ls.setItem('b2:wayside.cities', seed.cities); ls.setItem('b2:kairoute.lobbySeen', '1');
    ['intro1', 'sunprincess1', 'spread1', 'bible1', 'coach1', 'coachDone', 'tourTip'].forEach(k => ls.setItem('b2:kairoute.' + k, '1')); } } catch (e) {}
  const T = AbortSignal.timeout && AbortSignal.timeout.bind(AbortSignal); if (T) AbortSignal.timeout = ms => T(Math.max(40, ms / 20));
  const st = window.__steady = { shifts: 0, last: 0, n: 0 };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) st.shifts += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
  addEventListener('DOMContentLoaded', () => { new MutationObserver(ms => { for (const m of ms) { const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (!t || t.closest('[role=status],[aria-live],.clock,.countdown,time,.spinner,.coach,.toast')) continue; if (m.type === 'attributes' && (/^(aria-|data-feel|style$)/.test(m.attributeName || '') || m.oldValue === m.target.getAttribute(m.attributeName))) continue; /* written again with the same value: nothing changed on screen */ st.last = performance.now(); st.n++; st.what = m.type + ' ' + (t.id ? '#' + t.id : t.tagName.toLowerCase() + '.' + String(t.className).split(' ')[0]) + (m.attributeName ? ' [' + m.attributeName + ']' : '') + ' "' + (t.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40) + '"'; } })
    .observe(document.body, { subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true });
    // Planted defects (each a way this class has gone wrong before): the check must catch every one.
    if (plant === 'redraw') { const v = document.getElementById('view'); new MutationObserver(() => { if (!window.__pl) { window.__pl = 1; v.style.paddingTop = '57px'; requestAnimationFrame(() => requestAnimationFrame(() => { v.style.paddingTop = ''; window.__pl = 0; })); } }).observe(v, { attributes: true, attributeFilter: ['class'] }); } /* the Nov 23 tablet bug: each redraw reset the view's classes and the screen dropped for a frame */
    if (plant === 'settle') { let k = 0; const id = setInterval(() => { const v = document.querySelector('#view .dayhead, #view h2'); if (v) v.setAttribute('data-tick', String(k++)); if (k > 40) clearInterval(id); }, 150); }
    if (plant === 'wait') { const v = document.getElementById('view'); new MutationObserver(() => { const c = document.querySelector('#view details .card, #view details > :not(summary), #view .card'); if (c && !c.querySelector('.planted')) c.insertAdjacentHTML('beforeend', '<p class="ai-note planted"><span class="spinner"></span> Looking that up…</p>'); }).observe(v, { childList: true }); }
  });
};
// Where everything on screen is: the first 60 visible elements with their own box, keyed by their place in the page.
const LAYOUT = () => { const out = {}; let n = 0; const all = document.querySelectorAll('#view *');
  for (let i = 0; i < all.length && n < 60; i++) { const e = all[i]; if (!e.offsetParent && getComputedStyle(e).position !== 'fixed') continue;
    const b = e.getBoundingClientRect(); if (b.height < 8 || b.bottom < 0 || b.top > innerHeight) continue;
    const k = e.tagName + '#' + i + ' ' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24); out[k] = Math.round(b.top) + ',' + Math.round(b.left); n++; }
  return out; };
const SPINNERS = () => [...document.querySelectorAll('.spinner, [aria-busy="true"]')].filter(x => x.offsetParent && (!x.checkVisibility || x.checkVisibility({ visibilityProperty: true, opacityProperty: true })))
  .map(x => { let a = x.parentElement; while (a && a !== document.body && !(a.textContent || '').trim()) a = a.parentElement; return ((a && a.textContent) || '').trim().replace(/\s+/g, ' ').slice(0, 70); });
(async () => {
  const browser = await chromium.launch(), srv = await serve();
  const files = fs.readdirSync(CORPUS).filter(f => f.endsWith('.json')).sort().filter(f => !ONLY.length || ONLY.some(o => f.startsWith(o)));
  for (const f of files) {
    let c; try { c = JSON.parse(fs.readFileSync(path.join(CORPUS, f), 'utf8')); } catch (e) { fail('NOT TESTED', f, 'trip file unreadable'); continue; }
    if (!c.days || !c.cities) { fail('NOT TESTED', f, 'trip file has no days or places'); continue; }
    const name = f.replace(/\.json$/, ''), a = appTrip(name, c), seed = { trip: JSON.stringify(a.trip), cities: JSON.stringify(a.cities) }; counts.trips++;
    for (const size of PICK) { const vp = SIZES[size]; if (!vp) continue;
      for (const net of ['refused', 'hanging']) {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: true, deviceScaleFactor: 1, timezoneId: 'America/Chicago' });
        await ctx.addInitScript(PROBE, [seed, PLANT]);
        const hung = [];
        await ctx.route(u => !/^http:\/\/localhost/.test(String(u)), r => { if (net === 'refused' || !/^(fetch|xhr)$/.test(r.request().resourceType())) return r.fulfill({ status: 503, body: '' }); hung.push(r); }); // hanging: questions to services are never answered
        const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
        const tag = `${name} ${size} ${net}`;
        await p.goto(srv.url, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000);
        const ok = await p.evaluate(n => { const s = window.__kairouteState && window.__kairouteState(); return !!(s && window.__kairouteDays && window.__kairouteDays().length); }).catch(() => false);
        if (!ok) { fail('NOT TESTED', tag, 'the trip did not open in the app'); await ctx.close(); continue; }
        const days = await p.evaluate(() => window.__kairouteDays().map((d, i) => ({ i, type: d.type })));
        const shore = days.filter(d => d.type !== 'sea').map(d => d.i);
        // The screens: the trip page, a Day plan of each kind of day (and the first and last), and on the first two shore days Choose sights and the Guide;
        // then the Journal and Settings.
        const kinds = []; for (const d of days) if (!kinds.some(k => k.type === d.type)) kinds.push(d); // one day of each kind, then the first and last
        for (const d of [days[0], days[days.length - 1]]) if (d && !kinds.includes(d)) kinds.push(d);
        const screens = [['trip', 0]]; kinds.slice(0, +process.env.DAYS || 7).sort((a, b) => a.i - b.i).forEach(d => screens.push(['plan', d.i])); shore.slice(0, 2).forEach(i => screens.push(['sites', i], ['guide', i])); screens.push(['journal', 0], ['settings', 0]);
        for (const [v, i] of (net === 'refused' ? screens : screens.filter(s => s[0] === 'plan' || s[0] === 'guide'))) {
          const where = `${tag} ${v}${v === 'plan' || v === 'sites' || v === 'guide' ? ' day ' + (i + 1) : ''}`;
          const t0 = await p.evaluate(([v, i]) => { window.__kairouteGo(v, i); return performance.now(); }, [v, i]).catch(e => { fail('ERROR', where, 'could not open: ' + e.message.slice(0, 80)); return null; });
          if (t0 == null) continue; counts.screens++;
          if (net === 'refused') {
            // SETTLES: the last change outside live regions within 2.5 s of opening (watched for 4 s).
            await p.waitForTimeout(4000);
            const [last, what] = await p.evaluate(t0 => [window.__steady.last - t0, window.__steady.what], t0).catch(() => [0, '']);
            if (last > 2500) fail('SETTLES', where, `the screen kept changing by itself for ${Math.round(last)} ms after it opened (limit 2500); last change: ${what}`);
            // STEADY-REDRAW: redraw the same screen twice (as an answer arriving does); nothing may move.
            const before = await p.evaluate(LAYOUT).catch(() => ({}));
            const sh = await p.evaluate(async ([v, i]) => { const s0 = window.__steady.shifts; window.__kairouteGo(v, i); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); window.__kairouteGo(v, i); await new Promise(r => setTimeout(r, 400)); return window.__steady.shifts - s0; }, [v, i]).catch(() => 0);
            const after = await p.evaluate(LAYOUT).catch(() => ({})); counts.redraws++;
            const far = (x, y) => { const [a1, b1] = x.split(',').map(Number), [a2, b2] = y.split(',').map(Number); return Math.abs(a1 - a2) > 2 || Math.abs(b1 - b2) > 2; }; /* under 3 px is rounding (a fraction of a pixel), not a move anyone sees */
            const moved = Object.keys(before).filter(k => k in after && far(before[k], after[k])).map(k => `${k.split(' ').slice(1).join(' ') || k} ${before[k]}→${after[k]}`);
            if (sh > 0.01 || moved.length) fail('STEADY-REDRAW', where, `a redraw of the same screen moved things (layout shift ${sh.toFixed(3)}${moved.length ? '; ' + moved.slice(0, 3).join('; ') : ''})`);
          } else {
            // WAIT-ENDS: open every folded card, then wait past the (shortened) time limits; no spinner may be left.
            await p.waitForTimeout(800);
            await p.evaluate(() => document.querySelectorAll('#view details').forEach(d => { d.open = true; })).catch(() => {});
            await p.waitForTimeout(7000); counts.hung++;
            const sp = await p.evaluate(SPINNERS).catch(() => []);
            if (sp.length) fail('WAIT-ENDS', where, `${sp.length} spinner(s) still turning with no answer coming: "${sp.slice(0, 2).join('" / "')}"`);
          }
        }
        // RESUME-LEFT: on the day Continue opens, start the tour and close the app: reopening goes back into the tour (the
        // control: the check can see a tour). Then Exit tour and reopen: the Day plan, never the tour the traveler left.
        if (net === 'refused' && size === PICK[0] && shore.length) {
          const reopen = async () => { await p.reload(); await p.waitForTimeout(1500);
            return p.evaluate(async () => { const c = document.querySelector('[data-act="continue"]'); if (c) { c.click(); await new Promise(r => setTimeout(r, 600)); }
              const ch = document.querySelector('[data-day][aria-pressed="true"]'); return { v: window.__kairouteState().view, d: ch ? +ch.dataset.day : null }; }).catch(() => ({ v: '?', d: null })); };
          const at = await reopen();
          const go = await p.evaluate(async i => { const W = ms => new Promise(r => setTimeout(r, ms)); window.__kairouteGo('guide', i); await W(500);
            const st = document.querySelector('[data-act="tourstart"]'); if (!st) return 'no Start the tour on the Guide'; st.click(); await W(600); return window.__kairouteState().view === 'tour' ? 'ok' : 'the tour did not open'; }, at.d == null ? shore[0] : at.d).catch(e => 'error ' + e.message.slice(0, 60));
          if (go === 'ok') { const ctl = await reopen();
            if (ctl.v === 'tour') { await p.evaluate(async () => { const ex = document.querySelector('[data-act="tourexit"]'); if (ex) ex.click(); await new Promise(r => setTimeout(r, 400)); }).catch(() => {});
              const v = await reopen(); counts.resumes++;
              if (v.v === 'tour') fail('RESUME-LEFT', tag, 'reopening the app after Exit tour put the traveler back in the tour'); }
            else counts.noresume = (counts.noresume || 0) + 1; } // a day with no tour to resume: nothing to check here
        }
        if (errs.length) fail('ERROR', tag, errs.slice(0, 2).join(' | '));
        for (const r of hung) r.abort().catch(() => {});
        await ctx.close();
      }
    }
    console.log(`  ${name}: done (${fails.length} problem(s) so far)`);
  }
  await browser.close(); srv.close();
  const by = {}; fails.forEach(x => { by[x.rule] = (by[x.rule] || 0) + 1; });
  console.log(`\nSteady screens: ${counts.trips} trips, ${counts.screens} screens opened, ${counts.redraws} redraws, ${counts.hung} screens with hanging services, ${counts.resumes} tours reopened`);
  if (counts.trips && !counts.resumes) { fails.push({ rule: 'NOT TESTED' }); console.log('FAIL NOT TESTED [RESUME-LEFT] no trip could start and exit a tour'); by['NOT TESTED'] = (by['NOT TESTED'] || 0) + 1; }
  for (const [k, n] of Object.entries(by)) console.log(`FAIL ${k} ${n}`);
  // Proof, every run: each planted defect (a way this class has gone wrong before) must be caught by its rule.
  if (!PLANT && !process.env.NO_PROOF) {
    const { spawnSync } = require('child_process');
    for (const [plant, rule] of [['redraw', 'STEADY-REDRAW'], ['settle', 'SETTLES'], ['wait', 'WAIT-ENDS']]) {
      const r = spawnSync(process.execPath, [__filename, FILE], { env: Object.assign({}, process.env, { PLANT: plant, TRIPS: 'g01', SIZES: 'phone', NO_PROOF: '1' }), encoding: 'utf8', timeout: 900000 });
      const caught = r.status === 1 && new RegExp('^FAIL ' + rule + ' [0-9]', 'm').test(r.stdout || '');
      console.log(`${caught ? 'ok  ' : 'FAIL'} planted ${plant}: ${caught ? 'caught by ' + rule : 'NOT caught by ' + rule + ' (the check is blind)'}`);
      if (!caught) fails.push({ rule: 'PROOF', where: plant, why: 'planted defect not caught' });
    }
  }
  console.log(`Steady screens: ${fails.length ? fails.length + ' failed' : '0 failed'}${PLANT ? ' (planted: ' + PLANT + ')' : ''}`);
  process.exit(fails.length ? 1 : 0);
})();
