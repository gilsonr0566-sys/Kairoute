// First-time traveler walk on the LIVE Beta 2 site (thread "Walk through the app as a first-time traveler").
// A clean browser opens the app, enters one trip with real taps and typing (Plan a new trip > Step by step), waits for
// the guides, then uses every page the way a new traveler would: day plans, Choose sights, Guide and voice, Tour,
// Journal, Settings, then comes back later (reload) and opens it with no signal (offline). It counts taps and
// keystrokes, saves a picture and the text of every screen, and records page errors, dead taps and endless spinners.
// AI is off and every paid or AI helper path is refused at the network layer, so a run costs nothing.
// Usage: TRIP=<name> SIZE=phone|tablet node tools/first-timer/walk.cjs   (trips from tools/first-timer/trips.json)
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const Q = JSON.parse(fs.readFileSync(path.join(__dirname, 'trips.json'), 'utf8'));
const LIVE = process.env.URL || Q.url || 'https://gilsonr0566-sys.github.io/Kairoute-Beta2/';
const PASS = new Set(['/sources', '/famous', '/ground', '/places', '/transit', '/route', '/departures', '/ferries', '/weather', '/facts', '/osm', '/findplace', '/nearsights', '/verify', '/bookcheck', '/voyage', '/x/near']);
const SIZES = {
  phone: { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },        // Galaxy S24 Ultra
  tablet: { viewport: { width: 1280, height: 800 }, hasTouch: true, deviceScaleFactor: 1.5 }                    // Lenovo Idea Tab Plus 12.1", sideways
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const t = Q.trips.find(x => x.name === process.env.TRIP); const SIZE = process.env.SIZE || 'phone'; if (!t) { console.log('no such trip'); process.exit(1); }
  const out = path.join(process.cwd(), 'ft-out', t.name + '-' + SIZE); fs.mkdirSync(out, { recursive: true });
  const R = { trip: t.name, size: SIZE, started: new Date().toISOString(), taps: 0, keys: 0, screens: [], errors: [], console: [], passed: {}, refused: {}, dead: [], busyLog: [] };
  const b = await chromium.launch();
  const ctx = await b.newContext(Object.assign({ locale: 'en-US', timezoneId: 'America/Chicago' }, SIZES[SIZE]));
  await ctx.route(u => /workers\.dev/.test(u.hostname), async r => {
    const req = r.request(), p = new URL(req.url()).pathname;
    if (p === '/status') return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, on: false, left: 0, budget: 0 }) });
    if (req.method() === 'OPTIONS') return r.continue();
    if (PASS.has(p) || (p === '/guide' && req.method() === 'GET')) { R.passed[p] = (R.passed[p] || 0) + 1; return r.continue(); }
    R.refused[p] = (R.refused[p] || 0) + 1; return r.fulfill({ status: 429, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":"off in this test"}' });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => R.errors.push(String(e.message).slice(0, 300)));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) R.console.push(m.text().slice(0, 200)); });
  let n = 0;
  const shot = async (name, full = true) => { const f = String(n++).padStart(2, '0') + '-' + name + '.jpg'; const text = await p.evaluate(() => document.body.innerText).catch(() => '');
    const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth).catch(() => 0);
    const spin = await p.evaluate(() => [...document.querySelectorAll('.spinner, .spin, [aria-busy="true"], .loading')].filter(x => x.offsetParent).length).catch(() => 0);
    await p.screenshot({ path: path.join(out, f), type: 'jpeg', quality: 60, fullPage: full }).catch(e => R.errors.push('shot ' + name + ': ' + e.message.slice(0, 100)));
    R.screens.push({ f, name, overflowPx: over, spinners: spin, text }); console.log('\n===== ' + f + (over > 1 ? ' OVERFLOW ' + over + 'px' : '') + (spin ? ' SPINNERS ' + spin : '') + '\n' + text.slice(0, 4000)); };
  // A tap as a person makes it: the button must be visible; the screen must change, or it is recorded as a dead tap.
  const tap = async (loc, label) => { const el = loc.first(); if (!(await el.isVisible().catch(() => false))) { R.dead.push('not visible: ' + label); console.log('NOT VISIBLE ' + label); return false; }
    const before = await p.evaluate(() => document.body.innerText.length + ':' + location.hash + ':' + document.querySelectorAll('*').length).catch(() => '');
    await el.scrollIntoViewIfNeeded().catch(() => {}); await el.click({ timeout: 8000 }).catch(e => R.dead.push('click failed: ' + label + ' ' + e.message.slice(0, 120))); R.taps++; await sleep(900);
    const after = await p.evaluate(() => document.body.innerText.length + ':' + location.hash + ':' + document.querySelectorAll('*').length).catch(() => '');
    if (before === after) { R.dead.push('nothing changed: ' + label); console.log('DEAD? ' + label); } return true; };
  const type = async (id, v) => { if (v == null || v === '') return; const el = p.locator('#' + id); if (!(await el.count())) { R.dead.push('no field ' + id); return; } await el.click().catch(() => {}); R.taps++; await el.fill(String(v)); R.keys += String(v).replace(/[-:]/g, '').length; await el.press('Tab').catch(() => {}); await sleep(250); };
  const seg = async (i, key, v) => { if (!v) return; const el = p.locator(`[data-ts="set"][data-i="${i}"][data-key="${key}"][data-v="${v}"]`); if ((await el.getAttribute('aria-pressed').catch(() => null)) === 'true') return; await tap(el, key + ' ' + v); };
  const nav = async name => tap(p.locator('nav button, header button, .tabbar button, [role="tablist"] button').filter({ hasText: new RegExp('^\\s*' + name + '\\s*$') }), 'nav ' + name);

  await p.goto(LIVE, { waitUntil: 'load' }); await sleep(3500);
  R.version = await p.evaluate(() => fetch('version.txt', { cache: 'no-store' }).then(r => r.text())).catch(e => 'ERR ' + e);
  await shot('first-open', false);
  for (let k = 0; k < 6; k++) { const nx = p.locator('.coach button', { hasText: /^Next$/ }); if (await nx.first().isVisible().catch(() => false)) { await tap(nx, 'coach next'); await shot('coach-' + (k + 2), false); } else break; }
  const done = p.locator('.coach button'); if (await done.first().isVisible().catch(() => false)) await tap(done.last(), 'coach last');
  await shot('home');
  await tap(p.getByRole('button', { name: /Plan a new trip/i }), 'Plan a new trip'); await shot('new-trip');
  // Typed in the traveler's own words (no AI in the app): the second way the form offers.
  if (t.text) { await tap(p.locator('[data-ts="mode"]').nth(1), 'Describe it mode'); await type('w-text', t.text); }
  // Enter the trip leg by leg, in the order the form asks.
  for (let i = 0; i < (t.legs || []).length; i++) { const l = t.legs[i];
    if (i > 0 || l.k === 'cruise') await tap(p.locator(`[data-ts="${l.k === 'cruise' ? 'addcruise' : 'addstay'}"]`), 'add ' + l.k);
    if (l.k === 'stay') { await type(`ts-${i}-place`, l.place); await type(`ts-${i}-date`, l.date); await type(`ts-${i}-nights`, l.nights); await type(`ts-${i}-hotel`, l.hotel); }
    else { await type(`ts-${i}-board`, l.board); await type(`ts-${i}-ship`, l.ship); await type(`ts-${i}-date`, l.date); await type(`ts-${i}-aboard`, l.aboard); }
    await seg(i, 'inBy', l.inBy); await type(`ts-${i}-leaveAt`, l.leaveAt); await type(`ts-${i}-inAt`, l.inAt);
    for (let j = 0; j < (l.ports || []).length; j++) { const q = l.ports[j]; if (j > 0) await tap(p.locator(`[data-ts="addport"][data-i="${i}"]`), 'add port');
      await type(`ts-${i}-p${j}-date`, q.date); await type(`ts-${i}-p${j}-place`, q.place); await type(`ts-${i}-p${j}-arrive`, q.arrive); await type(`ts-${i}-p${j}-aboard`, q.aboard); if (q.tender) await tap(p.locator(`[data-tsf="ts-${i}-p${j}-tender"]`), 'tender port'); }
    if (l.k === 'cruise') { await type(`ts-${i}-end`, l.end); await type(`ts-${i}-endDate`, l.endDate); await type(`ts-${i}-off`, l.off); }
    if (i === (t.legs || []).length - 1) { await seg(i, 'homeBy', l.homeBy); await type(`ts-${i}-homeAt`, l.homeAt); } }
  const prev = p.locator('#tsPrev summary'); if (await prev.first().isVisible().catch(() => false)) await tap(prev, 'Your days preview');
  await shot('wizard-filled'); R.entry = { taps: R.taps, keys: R.keys };
  await tap(p.getByRole('button', { name: /Build my trip/i }), 'Build my trip');
  const t0 = Date.now(); let last = null, shots = 0;
  while (Date.now() - t0 < 30 * 60000) { const s = await p.evaluate(() => { const s = window.__kairouteState ? window.__kairouteState() : {}; return { busy: s.busy || null, err: s.err || null }; }).catch(() => ({}));
    const msg = JSON.stringify(s); if (msg !== last) { R.busyLog.push({ s: Math.round((Date.now() - t0) / 1000), ...s }); console.log(Math.round((Date.now() - t0) / 1000) + 's', msg); last = msg; }
    if ((Date.now() - t0 > 6000 && shots === 0) || (Date.now() - t0 > 45000 && shots === 1)) { await shot('building-' + Math.round((Date.now() - t0) / 1000) + 's', false); shots++; }
    if (!s.busy && Date.now() - t0 > 8000) break; await sleep(2000); }
  R.buildSec = Math.round((Date.now() - t0) / 1000); await sleep(8000);
  await shot('after-build');
  const days = await p.evaluate(() => (window.__kairouteDays ? window.__kairouteDays() : []).map((d, i) => ({ i, type: d.type, dest: d.destination || d.dest, date: d.date })));
  R.days = days; console.log('DAYS', JSON.stringify(days));
  // Every day's plan, opened from the Trip screen's day list where possible.
  for (const d of days) { await p.evaluate(i => window.__kairouteAt(i, 'plan'), d.i); await sleep(d === days[0] ? 6000 : 4500); await shot('day' + d.i + '-' + d.type + '-plan'); }
  const sd = (days.find(d => d.type === 'port') || days.find(d => d.type === 'land') || days[0] || { i: 0 }).i;
  await p.evaluate(i => window.__kairouteAt(i, 'plan'), sd); await sleep(4000);
  await tap(p.locator('button, a').filter({ hasText: /^\s*Choose sights\s*$/ }), 'Choose sights'); await sleep(1500); await shot('choose-sights');
  const tick = p.locator('input[data-site]:checked'); if (await tick.count()) { const nm = await tick.last().getAttribute('aria-label'); await tick.last().click({ force: true }).catch(() => {}); R.taps++; await sleep(2500); await shot('untick-' + String(nm || '').replace(/[^A-Za-z]+/g, '-').slice(0, 30)); }
  await tap(p.locator('.mainbtn').filter({ hasText: /Day plan/ }), 'Back to my day plan'); await sleep(3000); await shot('plan-after-untick');
  await nav('Guide'); await sleep(2500); await shot('guide');
  const play = p.locator('button').filter({ hasText: /Play|Listen|Hear/ }); if (await play.first().isVisible().catch(() => false)) { await tap(play, 'play story'); await sleep(3000); R.audio = await p.evaluate(() => [...document.querySelectorAll('audio')].map(a => ({ src: a.currentSrc.split('/').slice(-2).join('/'), paused: a.paused, t: a.currentTime, err: a.error && a.error.code }))); await shot('guide-playing', false); }
  await tap(p.locator('.mainbtn').filter({ hasText: /Start the tour/ }), 'Start the tour'); await sleep(2500); await shot('tour-1', false);
  for (let k = 0; k < 3; k++) { const nx = p.locator('button').filter({ hasText: /^(Let's go|Next|I'm here)/ }); if (!(await nx.first().isVisible().catch(() => false))) break; await tap(nx, 'tour step'); await sleep(2000); await shot('tour-' + (k + 2), false); }
  await tap(p.locator('button').filter({ hasText: /Exit tour/ }), 'Exit tour'); await sleep(1500);
  await nav('Journal'); await sleep(2000); await shot('journal');
  await nav('Settings'); await sleep(2000); await shot('settings');
  const secs = await p.locator('main .setnav button, main [data-sec], main .sections button').allInnerTexts().catch(() => []); R.settingsSections = secs;
  for (const s of secs.slice(0, 12)) { await tap(p.locator('main .setnav button, main [data-sec], main .sections button').filter({ hasText: s }), 'settings ' + s); await sleep(1200); await shot('settings-' + s.replace(/[^A-Za-z]+/g, '-').slice(0, 24)); }
  await nav('Trip'); await sleep(2000); await shot('trip');
  // Coming back later: the app opened again.
  await p.reload({ waitUntil: 'load' }); await sleep(5000); await shot('reopened');
  // No signal.
  await ctx.setOffline(true); await p.reload({ waitUntil: 'load' }).catch(e => R.errors.push('offline reload: ' + e.message.slice(0, 120))); await sleep(5000); await shot('offline-home');
  await p.evaluate(i => window.__kairouteAt && window.__kairouteAt(i, 'plan'), sd).catch(() => {}); await sleep(4000); await shot('offline-day');
  await nav('Guide'); await sleep(2500); await shot('offline-guide'); await ctx.setOffline(false);
  R.finished = new Date().toISOString();
  console.log('\nSUMMARY version', R.version, 'entry', JSON.stringify(R.entry), 'build', R.buildSec + 's', 'dead', JSON.stringify(R.dead), 'errors', JSON.stringify([...new Set(R.errors)]), 'console', JSON.stringify([...new Set(R.console)].slice(0, 20)), 'passed', JSON.stringify(R.passed), 'refused', JSON.stringify(R.refused));
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(R, null, 1)); await b.close();
})().catch(e => { console.log('WALK ERROR', e); process.exit(1); });
