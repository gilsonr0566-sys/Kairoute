// Beta 2 screen gate (Nov 22 2026, Richard: "what are all the ways the app can fail" / "Are every one of those being
// looked at in our runs"). Drives the BUILT Beta 2 app (never the demo) on a phone, no internet, no AI, and checks
// what the traveler SEES, not the planner's numbers:
//   A. every day of the trip passes the screen rules (tools/beta2/screen-rules.cjs: leave-by after every stop, the ride
//      back fits, the clock adds up, visit lengths, lunch has a real place, dates match, readable, ...)
//   B. the plan is the same when the phone is set to another time zone (Chicago, Tokyo, the trip's own)
//   C. with no signal: a trip opened before still opens and every day plans the same
//   D. a trip saved by an older published build opens in this one: no errors, the traveler's own changes kept,
//      every day passes the screen rules
//   E. every screen size: no page wider than the screen (phone, phone sideways, tablet both ways)
//   F. every recorded guide story has its recording in every guide voice (else the device voice reads it)
// Usage: node tools/beta2/screen-gate.cjs [beta2-site/index.html] [older build .html ...]
//   OLD=<file> also from env. Exit 1 on any S1/S2 failure. Prints plain words.
const { chromium } = require('playwright'); const path = require('path'), http = require('http'), fs = require('fs');
const R = require('./screen-rules.cjs');
const ROOT = path.join(__dirname, '..', '..');
const B2 = path.resolve(process.argv[2] || path.join(ROOT, 'beta2-site', 'index.html'));
const OLDS = process.argv.slice(3).concat((process.env.OLD || '').split(',').filter(Boolean)).map(f => path.resolve(f));
const ONLY = process.env.ONLY || 'ABCDEF', on = k => ONLY.includes(k);
const results = []; const check = (sev, name, ok, why) => results.push({ sev, name, ok: !!ok, why: ok ? '' : why });
// What a plan IS on screen: the LEAVE BY time, every row's times and name, every ride's chosen way. Notices that come
// and go with the signal ("No internet", the boarding-pass reader) or the phone's own clock ("7 h ahead") are not the plan.
const norm = t => { const P = R.parse(t); return [`LEAVE BY ${P.leaveBy}`, `back ${P.backBy}`].concat(P.rows.map(r => [r.key, r.arrive, r.leave, r.until, r.by, r.name].join(' ')), P.rides.map(r => r.head)).join('\n'); };

function serve() { const files = { '/index.html': B2 }; OLDS.forEach((f, i) => { files['/old' + i + '.html'] = f; });
  return new Promise(res => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
    let f = files[u] || (u === '/' ? B2 : null); if (!f) { for (const base of [path.dirname(B2), ROOT]) { const g = path.join(base, u); if (g.startsWith(base) && fs.existsSync(g) && !fs.statSync(g).isDirectory()) { f = g; break; } } }
    if (!f) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.mp3') ? 'audio/mpeg' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
    s.listen(0, () => res({ base: 'http://localhost:' + s.address().port, close: () => s.close() })); }); }

async function phone(browser, o = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, timezoneId: 'America/Chicago', serviceWorkers: 'allow' }, o));
  await ctx.route(u => !/^http:\/\/localhost/.test(String(u)), r => r.fulfill({ status: 503, body: '' }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  return { ctx, p, errs };
}
async function openApp(p, url, sample = true) {
  await p.goto(url); await p.waitForTimeout(2500);
  if (sample) { const b = p.locator('[data-act="loadsample"]').first(); if (await b.isVisible().catch(() => false)) await b.click(); }
  await p.waitForTimeout(5000);
  for (let k = 0; k < 5; k++) { const sk = p.locator('.coach button:has-text("Skip")').first(); if (await sk.isVisible().catch(() => false)) await sk.tap().catch(() => {}); else break; }
}
const settle = p => p.waitForFunction(() => !window.__kairouteFitPending || window.__kairouteFitPending() === 0, null, { timeout: 8000, polling: 200 }).catch(() => {});
async function dayTexts(p) {
  const days = await p.evaluate(() => window.__kairouteDays ? window.__kairouteDays() : []); const out = [];
  for (let i = 0; i < days.length; i++) {
    await p.evaluate(i => { window.__kairouteGo('day', i); window.__kairouteGo('plan'); }, i); await p.waitForTimeout(500); await settle(p); await p.waitForTimeout(300);
    out.push({ trip: 'sample', i, date: days[i].date, type: days[i].type, dest: days[i].dest, text: await p.evaluate(() => (document.querySelector('main') || document.body).innerText) });
  }
  return out;
}
// Plans settle as stored ride answers are read: read twice, keep the second read when the first one moved.
async function steadyTexts(p) { const a = await dayTexts(p); await p.waitForTimeout(1500); const b = await dayTexts(p); return b.length ? b : a; }

(async () => {
  const browser = await chromium.launch(); const srv = await serve(), URL = srv.base + '/index.html';
  // ---- A. every day on the screen
  const A = await phone(browser); await openApp(A.p, URL);
  const base = await steadyTexts(A.p);
  check('S1', `The trip opens and plans every day (${base.length} days)`, base.length > 0, 'no days on the screen');
  const fails = []; for (const d of base) for (const f of R.rules(d.text, d)) fails.push(Object.assign({ day: d }, f));
  for (const sev of ['S1', 'S2', 'S3']) { const byRule = {}; fails.filter(f => f.sev === sev).forEach(f => (byRule[f.rule] = byRule[f.rule] || []).push(`day ${f.day.i + 1} (${f.day.dest}): ${f.msg}`));
    const rulesSeen = new Set(Object.keys(byRule)); for (const r of rulesSeen) check(sev, `Screen rule "${r}" on every day`, false, byRule[r].slice(0, 3).join('; ') + (byRule[r].length > 3 ? ` (+${byRule[r].length - 3} more)` : '')); }
  if (fails.some(f => f.sev === 'S1')) check('S1', 'No ship, train or flight rule fails on screen', false, `${fails.filter(f => f.sev === 'S1').length} failures (listed above)`); else check('S1', 'No ship, train or flight rule fails on screen', true);
  // ---- G. the app's own screen guard: quiet on a good day; on a day whose banner disagrees with a stop it says so
  if (on('G')) { const i = base.findIndex(d => /port/.test(d.type) && R.parse(d.text).leaveBy != null);
    const g = i < 0 ? null : await A.p.evaluate(async i => { window.__kairouteGo('day', i); window.__kairouteGo('plan'); await new Promise(r => setTimeout(r, 1500));
      const quiet = !document.querySelector('.guardnote'); const g0 = window.__kairouteGuard;
      // Make the banner's time 2 hours earlier on screen only (as a wrong banner would look), then let the guard read it.
      const lb = [...document.querySelectorAll('#view *')].find(e => e.children.length === 0 && /^\d{1,2}:\d\d\s*[ap]m$/i.test(e.textContent.trim()) && /LEAVE BY/.test((e.closest('div,section') || {}).innerText || ''));
      if (!lb) return { quiet, g0, why: 'no LEAVE BY time found on the page' };
      lb.textContent = '6:00 am'; const r = window.__kairouteGuardCheck(); const note = document.querySelector('.guardnote');
      return { quiet, g0, warned: !!note, txt: note ? note.innerText : '', r }; }, i);
    check('S1', 'The app\'s own guard stays quiet on a day whose times agree', g && g.quiet, JSON.stringify(g && g.g0).slice(0, 200));
    check('S1', 'The app\'s own guard warns on a day whose LEAVE BY comes before a stop ends, and names the earliest time', g && g.warned && /leave by 6:00 am/i.test(g.txt), g ? (g.why || g.txt || JSON.stringify(g.r).slice(0, 200)) : 'no port day');
    await A.p.evaluate(() => { window.__kairouteGo('plan'); }); }
  // ---- B. phone set to other time zones
  for (const tz of on('B') ? ['Asia/Tokyo', 'Europe/Athens'] : []) {
    const B = await phone(browser, { timezoneId: tz }); await openApp(B.p, URL); const t = await steadyTexts(B.p);
    const diff = base.map((d, i) => t[i] && norm(t[i].text) !== norm(d.text) ? i : -1).filter(i => i >= 0);
    const firstDiff = diff.length ? (() => { const a = norm(base[diff[0]].text).split('\n'), b = norm(t[diff[0]].text).split('\n'); const k = a.findIndex((l, j) => l !== b[j]); return `day ${diff[0] + 1}: "${a[k]}" on a Chicago phone, "${b[k]}" in ${tz}`; })() : '';
    check('S1', `A phone set to ${tz} shows the same plan as one in Chicago`, t.length === base.length && !diff.length, t.length !== base.length ? `${t.length} days vs ${base.length}` : `${diff.length} days differ, e.g. ${firstDiff}`);
    await B.ctx.close(); }
  // ---- C. no signal
  if (on('C')) { const sw = await A.p.evaluate(async () => { try { if (!navigator.serviceWorker) return 'none'; const r = await Promise.race([navigator.serviceWorker.ready.then(() => 'ready'), new Promise(r => setTimeout(() => r('not ready'), 8000))]); return r; } catch (e) { return 'error ' + e; } });
    await A.ctx.setOffline(true);
    let ok = true, why = ''; try { await A.p.reload({ timeout: 20000 }); await A.p.waitForTimeout(5000); const t = await steadyTexts(A.p);
      const diff = base.map((d, i) => t[i] && norm(t[i].text) !== norm(d.text) ? i + 1 : 0).filter(Boolean);
      ok = t.length === base.length && !diff.length; const dd = diff.length ? (() => { const a = norm(base[diff[0] - 1].text).split('\n'), b = norm(t[diff[0] - 1].text).split('\n'); const k = a.findIndex((l, j) => l !== b[j]); return ` (day ${diff[0]}: "${a[k]}" with signal, "${b[k]}" without)`; })() : '';
      why = t.length !== base.length ? `${t.length} of ${base.length} days open with no signal` : `days ${diff.slice(0, 8).join(', ')} plan differently with no signal${dd}`; } catch (e) { ok = false; why = 'the app did not open with no signal: ' + String(e).slice(0, 120); }
    check('S1', `With no signal, a trip opened before still opens and plans the same (offline helper: ${sw})`, ok, why);
    await A.ctx.setOffline(false); }
  check('S2', 'No errors in the app', !A.errs.length, A.errs.slice(0, 2).join(' | '));
  // ---- D. a trip saved by an older published build
  for (let k = 0; k < (on('D') ? OLDS.length : 0); k++) {
    const D = await phone(browser); await openApp(D.p, srv.base + '/old' + k + '.html');
    const own = await D.p.evaluate(async () => { const days = window.__kairouteDays(); const i = days.findIndex(d => /port/.test(d.type)); if (i < 0) return null;
      window.__kairouteGo('day', i); window.__kairouteGo('sites'); await new Promise(r => setTimeout(r, 1500));
      const on = [...document.querySelectorAll('input[data-site]')].filter(x => x.checked); if (on.length < 2) return null; const x = on[on.length - 1]; x.click(); await new Promise(r => setTimeout(r, 2500)); return { i, id: x.dataset.site }; });
    await D.p.waitForTimeout(2000); const oldDays = await D.p.evaluate(() => window.__kairouteDays().length); D.errs.length = 0;
    await openApp(D.p, URL, false); const t = await steadyTexts(D.p);
    const kept = own ? await D.p.evaluate(async o => { window.__kairouteGo('day', o.i); window.__kairouteGo('sites'); await new Promise(r => setTimeout(r, 1500)); const x = document.querySelector(`input[data-site="${o.id}"]`); return !x || !x.checked; }, own) : null;
    const f = []; t.forEach(d => R.rules(d.text, d).filter(x => x.sev !== 'S3').forEach(x => f.push(`day ${d.i + 1}: ${x.msg}`)));
    const name = path.basename(OLDS[k]);
    check('S1', `A trip saved by an older build (${name}) opens in this one with every day`, t.length === oldDays && t.length > 0, `${t.length} of ${oldDays} days`);
    check('S2', `A trip saved by an older build (${name}): the traveler's own untick is kept`, kept !== false, own ? `${own.id} on day ${own.i + 1} came back ticked` : '');
    check('S1', `A trip saved by an older build (${name}): every day passes the screen rules`, !f.length, f.slice(0, 3).join('; '));
    check('S2', `A trip saved by an older build (${name}): no errors`, !D.errs.length, D.errs.slice(0, 2).join(' | '));
    await D.ctx.close(); }
  // ---- E. screen sizes
  if (on('E')) { const sizes = [[360, 780, true], [412, 915, true], [915, 412, true], [800, 1280, false], [1280, 800, false]], bad = [];
    for (const [w, h, mob] of sizes) { const E = await phone(browser, { viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob }); await openApp(E.p, URL);
      const n = await E.p.evaluate(() => window.__kairouteDays().length);
      for (const i of [0, Math.floor(n / 2), n - 1]) for (const v of ['plan', 'sites', 'trip']) {
        const o = await E.p.evaluate(([i, v]) => { window.__kairouteGo('day', i); window.__kairouteGo(v); const W = document.documentElement.clientWidth;
          const sw = document.scrollingElement.scrollWidth; const wide = [...document.querySelectorAll('main *')].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.right > W + 2 && getComputedStyle(e).position !== 'fixed' && !e.closest('.maplibregl-map, .leaflet-container, [style*="overflow"], .scrollx, pre'); }).slice(0, 2).map(e => (e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().right));
          return sw > W + 2 ? `page ${sw}px wide on a ${W}px screen` + (wide.length ? ' (' + wide.join(', ') + ')' : '') : null; }, [i, v]);
        if (o) bad.push(`${w}x${h} day ${i + 1} ${v}: ${o}`); }
      await E.ctx.close(); }
    check('S2', 'No page is wider than the screen (phone, phone sideways, tablet both ways)', !bad.length, bad.slice(0, 4).join('; ')); }
  // ---- F. recorded voices (read from the app's own story files, so a new story or voice is covered the day it is added)
  if (on('F')) { let want = null; try { const vm = require('vm');
      const stub = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : stub, apply: () => stub, construct: () => stub });
      const ctx = new Proxy({ console }, { has: () => true, get: (t, k) => k in t ? t[k] : (k in globalThis ? globalThis[k] : stub), set: (t, k, v) => { t[k] = v; return true; } });
      const src = ['stop-scripts.js', 'stop-stories.js'].map(f => fs.readFileSync(path.join(ROOT, 'src', 'features', f), 'utf8')).join(';\n');
      vm.runInNewContext(src + ';this.__S = STOP_SCRIPTS;', ctx);
      const voices = [...fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8').matchAll(/\["\w+", "\w+", "[^"]+", "([a-z]{2}_\w+)"\]/g)].map(m => m[1]);
      want = ctx.__S.flatMap(sc => voices.flatMap(v => sc.parts.flatMap((p, k) => p.paras.map((t, i) => `audio/${sc.id}/${v}/p${k}-${i}.mp3`))));
      if (!voices.length) want = null; } catch (e) { console.error('stories:', e.message); }
    const AUD = process.env.AUDIO_DIR || ROOT; const miss = want ? want.filter(f => !fs.existsSync(path.join(AUD, f))) : null;
    check('S2', `Every recorded story has its recording in every guide voice (${want ? want.length : 0} files)`, want && !miss.length, !want ? 'could not read the stories list' : `${miss.length} missing, e.g. ${miss.slice(0, 3).join(', ')}`); }
  await browser.close(); srv.close();
  const order = { S1: 0, S2: 1, S3: 2 }; results.sort((a, b) => (a.ok - b.ok) || order[a.sev] - order[b.sev]);
  const bad = results.filter(r => !r.ok);
  console.log(`\nBeta 2 screen gate: ${results.length - bad.length} of ${results.length} pass` + (bad.length ? `, ${bad.filter(r => r.sev === 'S1').length} could risk the ship/train/flight` : ''));
  for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'} [${r.sev}] ${r.name}${r.ok ? '' : '\n        ' + r.why}`);
  if (process.env.TEXTS_OUT) fs.writeFileSync(process.env.TEXTS_OUT, JSON.stringify(base));
  process.exitCode = bad.some(r => r.sev !== 'S3') ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 2; });
