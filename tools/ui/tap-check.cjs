// Tap sweep (Nov 22 2026, offline / old-trip / dead-button review): on every page of the sample trip, at phone and tablet
// size, tap every visible button, link and fold one at a time and record what a traveler would meet:
//   - an error in the app;
//   - a button that does nothing visible (the page, the open dialog, the address and the scroll are all unchanged);
//   - a spinner or "…ing" message still on screen 15 s after the tap;
//   - the page wider than the screen after the tap;
//   - with no signal, a claim it can't know ("couldn't find" a place it never searched for).
// OFFLINE=1 runs the same sweep with no signal (the app opened once online, then the phone loses its connection), where
// a tap must still answer: either it works from the device, or it says plainly that it needs a connection.
// Nothing that deletes the trip or the traveler's data is tapped. No internet, no AI.
// Usage: node tools/ui/tap-check.cjs [beta2-site/index.html]   SIZES=phone,tablet,upright  PAGES=trip,plan,...  OFFLINE=1
//   Exit 1 on an error or a dead button. Writes the full list to checks/tap-check.json.
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'beta2-site/index.html'), ROOT = path.join(__dirname, '..', '..');
const SIZES = { phone: { width: 412, height: 915, isMobile: true, hasTouch: true }, tablet: { width: 1280, height: 800 }, upright: { width: 800, height: 1280, hasTouch: true } };
const OFFLINE = process.env.OFFLINE === '1';
// Never tapped: they delete the trip, a day, the saved copies or the traveler's settings, or start a new trip.
const SKIP = /^(deltrip|delask|delday|reset|resetyes|offclear|clearkey|archive|syncoff|bookremove|newtrip|loadsample|copytrip|restore|offdl|celoffdl|offstop)$/;
const SKIPTEXT = /delete|remove this|erase|start over|clear (all|my)|forget this/i;
// Taps whose whole job is outside the page (a sound, a share sheet, the camera, a file): no visible change is expected.
const QUIET = /^(voicetry|camopen|campick|camplay|memshare|printday|printtrip|boardcal|film|filmreplay|geo|livegps)$/;
function serve(file) { const dir = path.dirname(file), name = path.basename(file);
  return new Promise(res => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
    let f = path.join(dir, u === '/' ? name : u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, u);
    if (!f.startsWith(ROOT) && !f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.json') || f.endsWith('.webmanifest') ? 'application/json' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
    s.listen(+process.env.PORT || 0, () => res({ url: 'http://localhost:' + s.address().port + '/' + name, close: () => { s.closeAllConnections && s.closeAllConnections(); s.close(); } })); }); }
// What the traveler sees: the page's words, which folds and dialogs are open, the address, the scroll, the theme.
const LOOK = () => { const v = [...document.querySelectorAll('details')].map(d => d.open ? 1 : 0).join('');
  const dlg = [...document.querySelectorAll('dialog[open], .modal, .sheet, [role=dialog]')].filter(x => x.offsetParent || x.open).length;
  const sel = [...document.querySelectorAll('.on, .sel, [aria-pressed=true], [aria-selected=true], input:checked')].length;
  return [document.body.innerText, v, dlg, sel, location.hash, Math.round(scrollY), document.documentElement.className, [...document.querySelectorAll('.pane')].map(p => Math.round(p.scrollTop)).join(','), document.activeElement && document.activeElement.tagName === 'INPUT' ? 'input' : ''].join('\u0001'); };
async function targets(p) {
  return p.evaluate(() => { const vis = e => { const r = e.getBoundingClientRect(); if (!r.width || !r.height || (e.checkVisibility && !e.checkVisibility({ visibilityProperty: true, opacityProperty: true }))) return false; return !e.closest('[hidden], .maplibregl-ctrl, .maplibregl-map, .leaflet-container') && !e.disabled && !!(e.innerText || e.getAttribute('aria-label') || '').trim(); };
    // Already the current choice (this page's tab, today's day, the open section, the chosen filter): tapping it again may rightly do nothing.
    const cur = e => !!e.closest('[aria-selected=true], [aria-current]:not([aria-current=false]), [aria-pressed=true]') || /(^|\s)(on|active|sel|cur|current|picked)(\s|$)/.test(e.className || '');
    const els = [...document.querySelectorAll('button, a[href], summary, [data-act]:not(input):not(select), [role=button], [data-day]')].filter(vis);
    const seen = new Map(); return els.map(e => { const key = [e.tagName, e.dataset.act || '', (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 50)].join('|');
      const n = seen.get(key) || 0; seen.set(key, n + 1); return { key, n, act: e.dataset.act || '', text: (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 50), href: e.tagName === 'A' ? e.getAttribute('href') : '', cur: cur(e) }; }); }); }
async function tapOne(p, t) {
  return p.evaluate(t => { const vis = e => { const r = e.getBoundingClientRect(); return r.width && r.height && (!e.checkVisibility || e.checkVisibility({ visibilityProperty: true })); };
    const els = [...document.querySelectorAll('button, a[href], summary, [data-act]:not(input):not(select), [role=button], [data-day]')].filter(vis)
      .filter(e => [e.tagName, e.dataset.act || '', (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 50)].join('|') === t.key);
    const e = els[t.n]; if (!e) return false; e.scrollIntoView({ block: 'center' }); return true; }, t);
}
(async () => {
  const srv = await serve(FILE); const browser = await chromium.launch(); const out = [];
  const sizes = (process.env.SIZES || 'phone,tablet,upright').split(',');
  for (const size of sizes) {
    const ctx = await browser.newContext(Object.assign({ deviceScaleFactor: 1, timezoneId: 'America/Chicago', locale: 'en-US', serviceWorkers: OFFLINE ? 'allow' : 'block' }, SIZES[size], { viewport: { width: SIZES[size].width, height: SIZES[size].height } }));
    await ctx.addInitScript(() => { try { const k = 'b2:kairoute.app', v = JSON.parse(localStorage.getItem(k) || '{}'); if (!v.backAck) v.backAck = '2026-11-20'; localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} });
    await ctx.route(u => !/^http:\/\/localhost/.test(String(u)), r => r.fulfill({ status: 503, body: '' }));
    let popups = 0;
    const p = await ctx.newPage(); ctx.on('page', pg => { if (pg === p) return; popups++; pg.close().catch(() => {}); }); let errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    let dialogs = []; p.on('dialog', d => { dialogs.push(d.message().slice(0, 80)); d.dismiss().catch(() => {}); });
    let downloads = 0; p.on('download', () => downloads++);
    await p.goto(srv.url); await p.waitForTimeout(2500);
    const sample = p.locator('[data-act="loadsample"]').first(); if (await sample.isVisible().catch(() => false)) await sample.click();
    await p.waitForTimeout(5000);
    for (let k = 0; k < 5; k++) { const sk = p.locator('.coach button:has-text("Skip")').first(); if (await sk.isVisible().catch(() => false)) await sk.click(); else break; }
    if (OFFLINE) { await p.evaluate(() => Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(r, 8000))])); await p.reload(); await p.waitForTimeout(2500); await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(3000); }
    const saved = await p.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]))));
    const days = await p.evaluate(() => window.__kairouteDays().map((d, i) => ({ i, type: d.type })));
    const port = (days.find(d => /port/.test(d.type)) || days[1] || days[0]).i, land = (days.find(d => d.type === 'land') || days[0]).i;
    const pages = [['trips', 0, 'Home'], ['trip', 0, 'Trip'], ['plan', port, 'Day plan (ship day)'], ['plan', land, 'Day plan (city day)'], ['sites', port, 'Choose sights'], ['guide', port, 'Guide'], ['tour', port, 'Tour'], ['journal', 0, 'Journal'], ['settings', 0, 'Settings']]
      .filter(x => !process.env.PAGES || process.env.PAGES.split(',').includes(x[0]));
    const reopen = async (v, i) => { // the same trip and page every time: put the saved trip back and reload when a tap changed it
      const now = await p.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])))).catch(() => '');
      // An overlay the last tap opened (the intro film, a dialog, a sheet) is closed by reopening the page.
      const over = await p.evaluate(() => [...document.querySelectorAll('[role=dialog], dialog[open], .film, .coach, .sheet, .modal')].some(x => x.offsetParent || (x.getBoundingClientRect().width && getComputedStyle(x).visibility !== 'hidden' && getComputedStyle(x).display !== 'none'))).catch(() => true);
      if (over || now !== saved || !(await p.evaluate(() => !!window.__kairouteGo).catch(() => false))) {
        await p.evaluate(s => { const o = JSON.parse(s); Object.keys(localStorage).forEach(k => { if (!(k in o)) localStorage.removeItem(k); }); Object.entries(o).forEach(([k, v]) => localStorage.setItem(k, v)); }, saved).catch(() => {});
        if (!/localhost/.test(p.url())) await p.goto(srv.url).catch(() => {}); else await p.reload().catch(() => {}); await p.waitForFunction(() => !!window.__kairouteGo, null, { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(500); }
      await p.evaluate(([v, i]) => { document.querySelectorAll('dialog[open]').forEach(d => d.close()); window.__kairouteGo('day', i); window.__kairouteGo(v); scrollTo(0, 0); }, [v, i]); await p.waitForTimeout(700); };
    for (const [v, i, label] of pages) {
      await reopen(v, i); const list = await targets(p); let n = 0;
      for (const t of list) {
        if (SKIP.test(t.act) || SKIPTEXT.test(t.text)) continue;
        await reopen(v, i); errs = []; dialogs = []; popups = 0; downloads = 0; if (process.env.VERBOSE) console.log("  tap", t.key, t.n);
        if (!(await tapOne(p, t))) continue; await p.waitForTimeout(200);
        const before = await p.evaluate(LOOK); const url0 = p.url(); n++;
        const el = await p.evaluateHandle(t => [...document.querySelectorAll('button, a[href], summary, [data-act]:not(input):not(select), [role=button], [data-day]')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && (!e.checkVisibility || e.checkVisibility({ visibilityProperty: true })); }).filter(e => [e.tagName, e.dataset.act || '', (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 50)].join('|') === t.key)[t.n], t);
        if (!el.asElement()) continue;
        try { await el.asElement().click({ timeout: 3000 }); } catch (e) { out.push({ size, page: label, tap: t.text || t.act, act: t.act, errs: [], dead: false, spin: [], wide: '', covered: ((String(e.message).match(/[^\n]*intercepts pointer events/) || String(e.message).match(/element is (not \w+|outside[^\n]*)/) || [String(e.message).split('\n')[0]])[0]).trim().slice(0, 160) }); continue; }
        await p.waitForTimeout(1200);
        let after = await p.evaluate(LOOK).catch(() => 'navigated'); const moved = p.url() !== url0;
        const spinning = async () => p.evaluate(() => [...document.querySelectorAll('.spinner, [aria-busy=true]')].filter(x => x.offsetParent).map(x => ((x.parentElement || x).innerText || '').trim().slice(0, 80))).catch(() => []);
        let spin = await spinning(); if (spin.length) { await p.waitForTimeout(14000); spin = await spinning(); }
        const wide = await p.evaluate(() => { const W = document.documentElement.clientWidth, sw = document.scrollingElement.scrollWidth; return sw > W + 2 ? `${sw}px wide on a ${W}px screen` : ''; }).catch(() => '');
        const dead = before === after && !t.cur && !moved && !popups && !dialogs.length && !downloads && !QUIET.test(t.act) && !/^(tel:|mailto:|sms:)/.test(t.href || '');
        const r = { size, page: label, tap: t.text || t.act || t.key, act: t.act, errs: [...new Set(errs)], dead, spin, wide, popup: popups, dialog: dialogs };
        if (r.errs.length || r.dead || r.spin.length || r.wide) out.push(r);
      }
      console.log(`${size} ${label}: ${n} taps`);
    }
    // With no signal, asking for a place the guide doesn't have can't be looked up: the screen says there is no internet,
    // never "couldn't find" (Nov 22: it said "I couldn't find \"Spinalonga\"" at the top of the page, out of sight).
    if (OFFLINE && (!process.env.PAGES || /sites|addplace/.test(process.env.PAGES))) { // PAGES=addplace runs this alone
      await reopen('sites', port); errs = [];
      const box = p.locator('#addPlace'); if (await box.count()) { await box.fill('Spinalonga'); await p.locator('[data-act="addplace"]').click().catch(() => {}); await p.waitForTimeout(8000); }
      const said = await p.evaluate(() => ({ all: document.querySelector('#view').innerText, card: (document.querySelector('.card.addplace') || {}).innerText || '' }));
      const lie = (said.all.match(/[^\n]*(couldn't find|could not find|no more day trips came back)[^\n]*/i) || [''])[0];
      const r = { size, page: 'Choose sights (no signal)', tap: 'Add a place the guide lacks', act: 'addplace', errs: [...new Set(errs)], dead: false, spin: [], wide: '', untrue: lie || (/internet/i.test(said.card) ? '' : 'the add-a-place card does not say it needs the internet: ' + said.card.replace(/\s+/g, ' ').slice(0, 120)) };
      if (r.untrue || r.errs.length) out.push(r);
    }
    // With no signal, Settings > AI guide never says the AI is simply "On": it needs the internet.
    if (OFFLINE && (!process.env.PAGES || /settings|aiguide/.test(process.env.PAGES))) { // PAGES=aiguide runs this alone
      await reopen('settings', 0); const b = p.locator('#view button', { hasText: 'AI guide' }).first();
      if (await b.count()) { await b.click(); await p.waitForTimeout(800);
        const t = await p.evaluate(() => (document.querySelector('#view') || document.body).innerText);
        const on = (t.match(/(^|\n)On\.[^\n]*/) || [''])[0].trim();
        if (on && !/internet|signal/i.test(on)) out.push({ size, page: 'Settings (no signal)', tap: 'AI guide', act: '', errs: [], dead: false, spin: [], wide: '', untrue: 'says the AI is on with no signal: ' + on.slice(0, 140) }); }
    }
    await ctx.close();
  }
  await browser.close(); srv.close();
  fs.mkdirSync(path.join(ROOT, 'checks'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'checks', 'tap-check.json'), JSON.stringify(out, null, 1));
  const bad = out.filter(r => r.errs.length || r.dead || r.untrue), soft = out.filter(r => !r.errs.length && !r.dead && !r.untrue);
  for (const r of out) console.log(`${r.errs.length || r.dead || r.untrue ? 'FAIL' : 'NOTE'} ${r.size} ${r.page}: "${r.tap}"${r.errs.length ? ' error: ' + r.errs.join(' | ') : ''}${r.dead ? ' does nothing visible' : ''}${r.spin.length ? ' still waiting 15 s later: ' + r.spin.join(' | ') : ''}${r.wide ? ' page ' + r.wide : ''}${r.covered ? ' could not be tapped: ' + r.covered : ''}${r.untrue ? ' says: ' + r.untrue : ''}`);
  console.log(`\nTap check${OFFLINE ? ' (no signal)' : ''}: ${bad.length} failure(s), ${soft.length} note(s)`);
  process.exitCode = bad.length ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 2; });
