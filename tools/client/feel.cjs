// Client feel test (Nov 23 2026, thread "Use the live app like a real client").
// Richard found the "Choose sights" page jumping around under his finger, and no test caught it: every check we had read
// the words on the screen, none felt the page move. This test uses the app the way a traveler does, with a finger:
// real touch taps (touchscreen, not element.click) and real swipe scrolls (touch scroll gestures), at the sizes of the
// phones and tablets Kairoute supports, and MEASURES what the traveler feels:
//   - JUMP: the thing you tapped moves away from under your finger (it is found again after the tap; moved > 48 px);
//   - SELF-SCROLL: the page scrolls by itself after a tap that should keep you where you are (> 48 px);
//   - DRIFT: the screen keeps moving after it settled (layout shifts or scrolling with no touch, 3 s watched);
//   - SHIFT: layout-shift score of a screen (Chrome's own layout-shift entries, INCLUDING those right after a tap,
//     which Chrome's CLS leaves out but a person sees) over 0.10;
//   - SLOW: a tap that takes over 500 ms to show anything (first change on screen) or 2.5 s to settle;
//   - DEAD: a tap after which nothing on the screen changed;
//   - COVERED: something on top (a pinned strip or band) covers a button where a finger taps it, even mid-screen;
//   - SCROLL: a swipe that doesn't move the page, or a page you cannot scroll to the end of;
//   - LANDING: a new screen opened part way down instead of at its top;
//   - WIDE: the page is wider than the screen; ERROR: an error in the app; STUCK: a spinner still showing.
// Journeys: open the app, the coach, the trip page, day plans (swipe through), Choose sights (scroll half way, tick and
// untick in every list, the filter chips, fold and unfold), open a sight, Guide and a story, the tour, Journal,
// Settings, phone Back button, reopen, then no signal (reload offline, day plan, guide).
// It records a video per size and a picture of every screen, and writes client-out/<size>/result.json and
// client-out/summary.md (Richard's report items). Exit 1 if any FAIL. Nothing is deleted; no AI; paid helper paths are
// refused at the network layer (zero spend).
// Usage: node tools/client/feel.cjs [beta2-site/index.html | https://gilsonr0566-sys.github.io/Kairoute-Beta2/]
//   SIZES=phone,tablet,upright (default all)   OUT=client-out   VIDEO=0 to skip video
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ARG = process.argv[2] || 'beta2-site/index.html', LIVE = /^https?:/.test(ARG), ROOT = path.join(__dirname, '..', '..');
const OUT = path.resolve(process.env.OUT || 'client-out'); fs.mkdirSync(OUT, { recursive: true });
const SIZES = {
  phone: { label: 'Galaxy S24 Ultra (412 x 915)', viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  tablet: { label: 'Lenovo Idea Tab Plus 12.1" sideways (1280 x 800)', viewport: { width: 1280, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  upright: { label: 'Lenovo Idea Tab Plus 12.1" upright (800 x 1280)', viewport: { width: 800, height: 1280 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
};
// The helper's free paths (no AI, no paid lookups). Everything else is refused (zero spend).
const PASS = new Set(['/sources', '/famous', '/ground', '/places', '/transit', '/route', '/departures', '/ferries', '/weather', '/facts', '/osm', '/findplace', '/nearsights', '/verify', '/bookcheck', '/voyage', '/x/near']);
const LIM = { jump: 48, selfScroll: 48, cls: 0.10, firstPaint: 500, settle: 2500, landing: 120 };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function serve(file) { const dir = path.dirname(file), name = path.basename(file);
  return new Promise(res => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
    let f = path.join(dir, u === '/' ? name : u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, u);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    const ty = f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : /\.(json|webmanifest)$/.test(f) ? 'application/json' : f.endsWith('.mp3') ? 'audio/mpeg' : 'application/octet-stream';
    r.writeHead(200, { 'content-type': ty }); fs.createReadStream(f).pipe(r); });
    s.listen(0, () => res({ url: 'http://localhost:' + s.address().port + '/', close: () => { s.closeAllConnections && s.closeAllConnections(); s.close(); } })); }); }

// Runs in the page before the app: records every layout shift (with what moved), every scroll change and who caused
// it, every DOM change, and the browser's own timing of each tap.
const PROBE = () => {
  const F = window.__feel = { shifts: [], scrolls: [], muts: 0, lastMut: 0, events: [], touchUntil: 0 };
  const nm = n => { if (!n || !n.tagName) return '?'; const t = (n.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40); return n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + (t ? ' "' + t + '"' : ''); };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) F.shifts.push({ t: e.startTime, v: e.value, input: e.hadRecentInput, src: (e.sources || []).slice(0, 3).map(s => nm(s.node) + ' ' + Math.round(s.previousRect.top) + '->' + Math.round(s.currentRect.top)) }); }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (/pointer|touch|click|key/.test(e.name)) F.events.push({ t: e.startTime, name: e.name, dur: e.duration, wait: e.processingStart - e.startTime, run: e.processingEnd - e.processingStart }); }).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch (e) {}
  // The part of the screen the traveler scrolls: on tablets the list pane (the map pane beside it pans the map), on a
  // phone the page itself. The biggest scrollable pane on screen.
  const scroller = () => { const ps = [...document.querySelectorAll('.pane, main, #view')].filter(x => x.scrollHeight > x.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(x).overflowY) && !x.closest('.maplibregl-map, .leaflet-container')).sort((a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth); return ps[0] || null; };
  const sc = () => { const pane = scroller(); return pane ? pane.scrollTop : (document.scrollingElement || document.documentElement).scrollTop; };
  F.zone = () => { const pane = scroller(); if (!pane) return null; const r = pane.getBoundingClientRect(); return { l: Math.max(0, r.left), r: Math.min(innerWidth, r.right), t: Math.max(0, r.top), b: Math.min(innerHeight, r.bottom) }; };
  let last = null; const tick = () => { const y = Math.round(sc()); if (last !== null && y !== last) F.scrolls.push({ t: performance.now(), from: last, to: y, touch: performance.now() < F.touchUntil }); last = y; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  F.y = () => Math.round(sc());
  // Progress messages in live regions (offline saving, "Playing…") change by design; they don't count as the screen
  // still changing (any movement they cause is still measured as layout shift).
  const live = n => { const e = n && (n.nodeType === 1 ? n : n.parentElement); return !!(e && e.closest && e.closest('[role=status], [aria-live], .clock, .countdown, time')); };
  const start = () => new MutationObserver(m => { m = m.filter(r => !live(r.target)); if (!m.length) return; F.muts += m.length; F.lastMut = performance.now(); }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start);
};

async function runSize(browser, size, base) {
  const D = SIZES[size], dir = path.join(OUT, size); fs.mkdirSync(dir, { recursive: true });
  const R = { size, device: D.label, url: base, started: new Date().toISOString(), steps: [], fails: [], notes: [], errors: [], refused: {}, passed: {}, screens: 0 };
  const opts = { viewport: D.viewport, isMobile: D.isMobile, hasTouch: D.hasTouch, deviceScaleFactor: D.deviceScaleFactor, locale: 'en-US', timezoneId: 'America/Chicago', serviceWorkers: 'allow' };
  if (process.env.VIDEO !== '0') opts.recordVideo = { dir, size: D.viewport };
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(PROBE);
  await ctx.route(u => /workers\.dev/.test(u.hostname), async r => { const req = r.request(), p = new URL(req.url()).pathname;
    if (p === '/status') return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, on: false, left: 0, budget: 0 }) });
    if (req.method() === 'OPTIONS') return r.continue();
    if (LIVE && (PASS.has(p) || (p === '/guide' && req.method() === 'GET'))) { R.passed[p] = (R.passed[p] || 0) + 1; return r.continue(); }
    R.refused[p] = (R.refused[p] || 0) + 1; return r.fulfill({ status: 429, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":"off in this test"}' }); });
  if (!LIVE) await ctx.route(u => !/^http:\/\/localhost/.test(String(u)) && !/workers\.dev/.test(u.hostname), r => r.fulfill({ status: 503, body: '' }));
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  p.on('pageerror', e => R.errors.push(String(e.message).slice(0, 300)));
  p.on('dialog', d => { R.notes.push('a browser pop-up appeared: ' + d.message().slice(0, 80)); d.dismiss().catch(() => {}); });
  let shotN = 0, where = 'start';
  const fail = (kind, what, extra) => { const f = { size, where, kind, what, ...(extra || {}) }; R.fails.push(f); console.log('  found ' + kind + ' [' + where + '] ' + what); };
  const shot = async name => { const f = String(shotN++).padStart(2, '0') + '-' + name.replace(/[^A-Za-z0-9]+/g, '-').slice(0, 40) + '.jpg'; await p.screenshot({ path: path.join(dir, f), type: 'jpeg', quality: 62 }).catch(() => {}); R.screens++; return f; };
  const now = () => p.evaluate(() => performance.now()).catch(() => 0);
  const feelSince = t0 => p.evaluate(t0 => { const F = window.__feel; return { shifts: F.shifts.filter(s => s.t >= t0), scrolls: F.scrolls.filter(s => s.t >= t0), events: F.events.filter(e => e.t >= t0 - 5), y: F.y(), muts: F.muts, lastMut: F.lastMut }; }, t0).catch(() => { R.notes.push(`[${where}] the page reloaded itself during a measurement`); return { shifts: [], scrolls: [], events: [], y: 0, muts: 0, lastMut: 0 }; });
  const geom = () => p.evaluate(() => ({ y: window.__feel.y(), vh: innerHeight, wide: document.documentElement.scrollWidth - innerWidth, h: (() => { const z = [...document.querySelectorAll('.pane, main, #view')].filter(x => x.scrollHeight > x.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(x).overflowY)).sort((a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth)[0]; return z ? z.scrollHeight : document.documentElement.scrollHeight; })(), ph: (() => { const z = [...document.querySelectorAll('.pane, main, #view')].filter(x => x.scrollHeight > x.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(x).overflowY)).sort((a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth)[0]; return z ? z.clientHeight : innerHeight; })(), spin: [...document.querySelectorAll('.spinner, .spin, [aria-busy="true"]')].filter(x => x.offsetParent && (!x.checkVisibility || x.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true, opacityProperty: true })) && !x.closest('details:not([open]) > :not(summary)')).map(x => x.tagName.toLowerCase() + '.' + String(x.className).trim().split(/\s+/).slice(0, 2).join('.') + ' "' + (() => { let a = x.parentElement; while (a && a !== document.body && !(a.textContent || '').trim()) a = a.parentElement; return ((a && a.textContent) || '').trim().replace(/\s+/g, ' ').slice(0, 60); })() + '" at ' + Math.round(x.getBoundingClientRect().top) + 'px in ' + (x.closest('[id]') || {}).id), head: ((document.querySelector('main h1, main h2, .dayhead, header h1') || {}).innerText || '').trim().slice(0, 60), hash: location.hash })).catch(() => ({ y: 0, vh: D.viewport.height, ph: D.viewport.height, wide: 0, h: 0, spin: [], head: '', hash: '' }));
  // Wait until the screen has stopped changing (no DOM change for 600 ms), at most `max` ms. Returns when it first changed.
  const settle = async (t0, max = 6000) => { const end = Date.now() + max; let first = null;
    while (Date.now() < end) { const s = await p.evaluate(t0 => ({ now: performance.now(), last: window.__feel.lastMut }), t0).catch(() => null); if (!s) { await sleep(500); continue; } if (s.last > t0 && first === null) first = s.last - t0;
      if (s.now - Math.max(s.last, t0) > 600 && (first !== null || s.now - t0 > 1500)) return { first, settled: Math.max(s.last, t0) - t0 }; await sleep(100); }
    return { first, settled: max, timeout: true }; };
  // A finger drag (touch start, 12 moves, touch end), as a thumb does it; the browser's own touch scrolling, with fling.
  const drag = async (x, y, dx, dy) => { await p.evaluate(() => { window.__feel.touchUntil = performance.now() + 3000; });
    const n = 12; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= n; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / n, y: y + dy * i / n }] }); await sleep(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(900); };
  // A swipe up the screen by about dy pixels (positive = page moves down to show more), from a quiet spot mid-screen.
  // Thumb on the scrolling part (on a tablet the list pane, not the map), towards its right edge where there are fewest buttons.
  const swipe = async dy => { const z = (await p.evaluate(() => window.__feel.zone()).catch(() => null)) || { l: 0, r: D.viewport.width, t: 0, b: D.viewport.height };
    const top = Math.max(z.t, 120), bot = Math.min(z.b, D.viewport.height - 90), h = bot - top; if (h < 100) return;
    const d = Math.max(-h * 0.7, Math.min(h * 0.7, dy * 0.7)); const y0 = d > 0 ? bot - h * 0.1 : top + h * 0.1;
    await drag(Math.round(z.l + (z.r - z.l) * 0.88), Math.round(y0), 0, -Math.round(d)); };
  // Watch the screen with no finger on it: anything that moves is drift.
  const still = async (ms = 3000) => { const t0 = await now(); await sleep(ms); const f = await feelSince(t0); const sh = f.shifts.reduce((a, s) => a + s.v, 0), sc = f.scrolls.filter(s => !s.touch);
    if (sh > 0.01 || sc.some(s => Math.abs(s.to - s.from) > 4)) fail('DRIFT', `the screen moved with no finger on it (shift ${sh.toFixed(3)}, ${sc.length} scroll changes${sc.length ? ' e.g. ' + sc[0].from + '->' + sc[0].to : ''})`, { src: f.shifts.flatMap(s => s.src).slice(0, 4) }); };
  // A screen visit: settle, watch it still, check width and spinners, score the layout shift since it opened, picture.
  let screenT0 = 0;
  const screen = async (name, opts = {}) => { where = name; await settle(await now(), 4000); await still(opts.stillMs || 2500); const g = await geom();
    const f = await feelSince(screenT0); const cls = f.shifts.reduce((a, s) => a + s.v, 0);
    if (cls > LIM.cls) fail('SHIFT', `layout shift ${cls.toFixed(2)} while this screen opened and was used (limit ${LIM.cls})`, { src: f.shifts.filter(s => s.v > 0.01).flatMap(s => s.src).slice(0, 5) });
    if (g.wide > 2) fail('WIDE', `page is ${g.wide}px wider than the screen`);
    if (g.spin.length) fail('STUCK', `${g.spin.length} spinner(s) still showing after the screen settled: ${g.spin.slice(0, 2).join('; ')}`);
    const pic = await shot(name); R.steps.push({ step: 'screen', name, pic, cls: +cls.toFixed(3), y: g.y, h: g.h, head: g.head }); console.log('SCREEN ' + name + ' cls ' + cls.toFixed(3) + ' y ' + g.y + '/' + g.h); return g; };
  // Find an element on screen again after a tap: by its data-site / data-day / data-act+text key.
  // The tapped element is marked, so it is found again after the tap even when its words change ("▶ Play" becomes
  // "■ Stop audio"); if the app drew it afresh, it is found by its data-site / data-play / data-day / data-act, then words.
  const keyOf = el => el.evaluate(e => { document.querySelectorAll('[data-feeltap]').forEach(x => x.removeAttribute('data-feeltap')); e.setAttribute('data-feeltap', '1');
    const t = (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 60); const d = e.dataset;
    return { site: d.site || (e.closest('[data-site]') || {}).dataset?.site || '', other: ['play', 'sp', 'open', 'sec'].filter(k => d[k]).map(k => `[data-${k}="${d[k]}"]`)[0] || '', day: d.day || '', act: d.act || '', text: t, tag: e.tagName }; });
  const rectOfKey = k => !k || !k.tag ? Promise.resolve(null) : p.evaluate(k => { const vis = e => { const r = e.getBoundingClientRect(); return r.width && r.height; };
    let c = [...document.querySelectorAll('[data-feeltap]')]; if (c.length) {} else if (k.site) c = [...document.querySelectorAll(`[data-site="${CSS.escape(k.site)}"]`)];
    else if (k.other) c = [...document.querySelectorAll(k.tag + k.other)];
    if (!c.length && !k.site && !k.other && (k.act || k.day)) c = [...document.querySelectorAll(k.tag)].filter(e => (e.dataset.act || '') === k.act && (e.dataset.day || '') === k.day);
    if (!c.length && !k.site && !k.other && !k.act && !k.day) c = [...document.querySelectorAll(k.tag)].filter(e => (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 60) === k.text);
    c = c.filter(vis); if (!c.length) return null; const r = c[0].getBoundingClientRect(); return { top: Math.round(r.top), left: Math.round(r.left), n: c.length }; }, k).catch(() => null);
  // A finger tap. stay=true: the tapped thing should stay under the finger and the page should not scroll by itself.
  const tap = async (loc, label, { stay = false, nav = false, quiet = false } = {}) => {
    const el = loc.first(); if (!(await el.count()) || !(await el.isVisible().catch(() => false))) { R.notes.push(`[${where}] not on screen to tap: ${label}`); console.log('  (not on screen) ' + label); return null; }
    // Bring it into view with a finger swipe, as a person would.
    const vw = D.viewport.width, vh = D.viewport.height;
    // Off to the side in a sideways list (the day chips): swipe that list sideways, inside the list itself.
    for (let k = 0; k < 10; k++) { const b = await el.boundingBox({ timeout: 3000 }).catch(() => null); if (!b) break;
      const row = await el.evaluate(e => { let a = e.parentElement; while (a && a !== document.body) { const o = getComputedStyle(a).overflowX; if (/(auto|scroll)/.test(o) && a.scrollWidth > a.clientWidth) { const r = a.getBoundingClientRect(); return { l: Math.max(0, r.left), r: Math.min(innerWidth, r.right) }; } a = a.parentElement; } return { l: 0, r: innerWidth }; });
      if (b.x >= row.l && b.x + b.width <= row.r) break; const w = row.r - row.l;
      await drag(Math.round(b.x < row.l ? row.l + w * 0.15 : row.r - w * 0.15), Math.round(b.y + b.height / 2), b.x < row.l ? Math.round(w * 0.6) : -Math.round(w * 0.6), 0); }
    for (let k = 0; k < 10; k++) { const b = await el.boundingBox({ timeout: 3000 }).catch(() => null); if (!b) break; if (b.y > 60 && b.y + b.height < vh - 80) break; await swipe(b.y - vh * 0.45); }
    let b = await el.boundingBox({ timeout: 3000 }).catch(() => null); if (!b) { R.notes.push(`[${where}] could not reach: ${label}`); return null; }
    // A person taps what they can see: if something pinned covers the spot (the day strip, the countdown, the band behind
    // them), they scroll it out from under it first. Still covered with the thing in the middle of the screen: COVERED.
    const hitAt = (x, y) => el.evaluate((e, [x, y]) => { const h = document.elementFromPoint(x, y); if (!h || e === h || e.contains(h) || h.contains(e) && h.tagName === 'LABEL') return ''; let a = h, pin = ''; while (a && a !== document.body) { const ps = getComputedStyle(a).position; if (ps === 'fixed' || ps === 'sticky') { pin = a.id ? '#' + a.id : a.tagName.toLowerCase() + '.' + String(a.className).split(' ')[0]; break; } a = a.parentElement; } return pin || (h.tagName.toLowerCase() + '.' + String(h.className).split(' ')[0]); }, [x, y]).catch(() => '');
    let cover = await hitAt(b.x + Math.min(b.width / 2, 24), b.y + b.height / 2);
    if (cover) { await swipe(b.y - vh * 0.45); b = (await el.boundingBox({ timeout: 3000 }).catch(() => null)) || b; cover = await hitAt(b.x + Math.min(b.width / 2, 24), b.y + b.height / 2);
      if (cover) { fail('COVERED', `"${label}" is covered by ${cover} where a finger would tap it, even in the middle of the screen`); return null; } }
    const key = await keyOf(el).catch(() => ({})); const g0 = await geom(); const before = await rectOfKey(key);
    const x = b.x + Math.min(b.width / 2, 24), y = b.y + b.height / 2;
    const t0 = await now(); await p.touchscreen.tap(x, y); const s = await settle(t0, 8000); await sleep(stay ? 1200 : 300);
    const f = await feelSince(t0); const after = await rectOfKey(key); const g1 = await geom();
    const self = f.scrolls.filter(z => !z.touch); const selfDy = g1.y - g0.y;
    const cls = f.shifts.reduce((a, z) => a + z.v, 0); const ev = f.events.filter(e => /pointerup|click|touchend/.test(e.name)).sort((a, b) => b.dur - a.dur)[0];
    const row = { step: 'tap', size, where, label, firstMs: s.first == null ? null : Math.round(s.first), settleMs: Math.round(s.settled), eventMs: ev ? Math.round(ev.dur) : null, moved: before && after ? after.top - before.top : null, selfScroll: selfDy, cls: +cls.toFixed(3) };
    R.steps.push(row); console.log(`  tap ${label}: first ${row.firstMs}ms settle ${row.settleMs}ms event ${row.eventMs}ms moved ${row.moved} scroll ${selfDy} shift ${row.cls}`);
    if (s.first == null && !quiet) fail('DEAD', `tapped "${label}" and nothing on the screen changed`);
    else if (s.first != null && Math.max(s.first, row.eventMs || 0) > LIM.firstPaint) fail('SLOW', `tapped "${label}": ${Math.round(Math.max(s.first, row.eventMs || 0))} ms before anything showed (limit ${LIM.firstPaint})`);
    if (!s.timeout && s.settled > LIM.settle) fail('SLOW', `tapped "${label}": the screen kept changing for ${row.settleMs} ms (limit ${LIM.settle})`);
    if (s.timeout) fail('DRIFT', `tapped "${label}": the screen was still changing 8 s later`);
    if (stay) {
      if (before && after && Math.abs(row.moved) > LIM.jump) fail('JUMP', `tapped "${label}" and it moved ${row.moved > 0 ? 'down' : 'up'} ${Math.abs(row.moved)}px from under the finger`, { src: f.shifts.filter(z => z.v > 0.005).flatMap(z => z.src).slice(0, 5) });
      if (before && !after) fail('JUMP', `tapped "${label}" and it disappeared from the screen`);
      if (Math.abs(selfDy) > LIM.selfScroll) fail('SELF-SCROLL', `tapped "${label}" and the page scrolled itself ${selfDy > 0 ? 'down' : 'up'} ${Math.abs(selfDy)}px`, { scrolls: self.slice(0, 4) });
    }
    if (nav && g1.head !== g0.head || nav && g1.hash !== g0.hash) { if (g1.y > LIM.landing) fail('LANDING', `"${label}" opened the next screen ${g1.y}px down instead of at its top`); }
    screenT0 = nav ? t0 + 600 : screenT0; /* a new screen replacing the old one in its first 600 ms is the change the traveler asked for, not a jump (Chrome's own rule: 500 ms) */ return row; };
  // Scroll the whole screen with the finger, down to the end and back to the top.
  const scrollThrough = async name => { where = name; let g = await geom(); const top0 = g.y; let stuck = 0, guard = 0;
    while (guard++ < 40) { const y0 = g.y; await swipe(D.viewport.height * 0.6); g = await geom(); if (g.y + g.ph >= g.h - 8) break; if (g.y === y0) { if (++stuck >= 2) { fail('SCROLL', `the page stopped scrolling at ${g.y}px of ${g.h}px`); break; } } else stuck = 0; }
    const bottom = g.y; guard = 0; while (guard++ < 40 && g.y > 0) { const y0 = g.y; await swipe(-D.viewport.height * 0.6); g = await geom(); if (g.y === y0) break; }
    if (bottom - top0 < 10 && g.h > g.ph + 50) fail('SCROLL', `a swipe did not move the page (height ${g.h}px)`);
    if (g.y > 4) fail('SCROLL', `could not get back to the top (stuck at ${g.y}px)`);
    R.steps.push({ step: 'scroll', where: name, height: g.h, reached: bottom }); console.log(`  scrolled ${name}: 0 -> ${bottom} -> ${g.y} of ${g.h}`); };
  // Go to a day as a traveler does: the day chips at the top of a day screen, or from the Day plan tab.
  const gotoDay = async (i, label) => { if (!(await p.locator(`[data-day="${i}"]`).first().isVisible().catch(() => false))) { const c = p.locator('[data-act=continue]'); if (await c.first().isVisible().catch(() => false)) await tap(c, 'Continue trip', { nav: true }); else await tap(navBtn('Day plan'), 'Day plan tab', { nav: true }); }
    return tap(p.locator(`[data-day="${i}"]`), label || `day ${i}`, { nav: true }); };
  const navBtn = name => p.locator('nav button, .tabbar button, .bottomnav button, button').filter({ hasText: new RegExp('^\\s*' + name + '\\s*$') });

  // ---------------------------------------------------------------- the journeys
  screenT0 = 0; await p.goto(base, { waitUntil: 'load' }); await sleep(2500);
  R.version = await p.evaluate(() => fetch('version.txt', { cache: 'no-store' }).then(r => r.text()).catch(() => '?')).catch(() => '?');
  await screen('open');
  for (let k = 0; k < 6; k++) { const nx = p.locator('[data-act=coachnext]'); if (!(await nx.first().isVisible().catch(() => false))) break; await tap(nx, 'coach Next', { quiet: false }); }
  const sk = p.locator('[data-act=coachskip], .coach button'); if (await sk.first().isVisible().catch(() => false)) await tap(sk.last(), 'coach done');
  await screen('home'); await scrollThrough('home');
  await tap(p.locator('[data-act=continue]'), 'Open the example trip', { nav: true }); await sleep(1500);
  await screen('trip'); await scrollThrough('trip');
  const days = await p.evaluate(() => (window.__kairouteDays ? window.__kairouteDays() : []).map((d, i) => ({ i, type: d.type, dest: d.destination || d.dest })));
  R.days = days.length;
  // Day plans: one of each kind of day, opened from the day chips at the top.
  const kinds = []; for (const d of days) if (!kinds.find(k => k.type === d.type)) kinds.push(d);
  for (const d of kinds.slice(0, 6)) { await gotoDay(d.i, `day ${d.i} (${d.type} ${d.dest})`); await screen(`day${d.i}-${d.type}`); await scrollThrough(`day${d.i}-${d.type}`); }
  const pd = (days.find(d => d.type === 'port') || days.find(d => d.type === 'land') || days[0] || { i: 0 }).i;
  const ld = (days.find(d => d.type === 'land') || days[0] || { i: 0 }).i;
  for (const di of [...new Set([ld, pd])]) {
    await gotoDay(di); if (!(await p.locator('button, a').filter({ hasText: /^\s*Choose sights\s*$/ }).first().isVisible().catch(() => false))) await tap(navBtn('Day plan'), 'Day plan tab', { nav: true }); /* opening a stop leaves the Day plan (the second day's Choose sights was never reached) */ await screen(`day${di}-before-choose`);
    // Choose sights: Richard's "unusable, jumping around" page.
    await tap(p.locator('button, a').filter({ hasText: /^\s*Choose sights\s*$/ }), 'Choose sights', { nav: true });
    await screen(`choose-sights-day${di}`); await scrollThrough(`choose-sights-day${di}`);
    // Filter chips.
    for (const chip of ['Must-sees', 'Famous', 'Local favorites', 'All']) await tap(p.locator('button').filter({ hasText: new RegExp('^\\s*' + chip + '\\s*$') }), 'filter ' + chip, { stay: true });
    // Ticks, from each part of the list, the way a person goes down it: untick one of theirs, tick it back, tick one
    // from "still fits", one from "other days", one from "doesn't fit"; with the page scrolled part way down.
    const ticks = await p.evaluate(() => [...document.querySelectorAll('input[data-site]')].filter(e => { const r = (e.closest('label, .site, li, .card') || e).getBoundingClientRect(); return r.height > 0; }).map(e => ({ id: e.dataset.site, on: e.checked, sec: ((e.closest('section, .picksfold, details, .sec, .group') || {}).querySelector?.('h3, h4, .foldrow, summary') || {}).innerText || '' })));
    R.notes.push(`[choose-sights-day${di}] ${ticks.length} sights listed, ${ticks.filter(t => t.on).length} ticked`);
    const pick = []; const seen = new Set(); for (const t of ticks) { const s = (t.sec || '').split('\n')[0].slice(0, 30) + (t.on ? '+' : '-'); if (!seen.has(s)) { seen.add(s); pick.push(t); } }
    let k = 0; for (const t of pick.slice(0, 8)) { where = `choose-sights-day${di}`;
      const box = p.locator(`input[data-site="${t.id}"]`); const lab = p.locator(`label[for="s-${t.id}"], label:has(input[data-site="${t.id}"])`);
      const target = (await lab.count()) ? lab : box;
      if (k++ === 1) await swipe(D.viewport.height * 0.35);
      await tap(target, `${t.on ? 'untick' : 'tick'} ${t.id} (${(t.sec || '').split('\n')[0].slice(0, 30)})`, { stay: true });
      await tap(target, `${t.on ? 'tick back' : 'untick'} ${t.id}`, { stay: true }); }
    const fold = p.locator('[data-act=picksfold]'); if (await fold.count()) { await tap(fold, 'Your sights Hide', { stay: true }); await tap(fold, 'Your sights Show', { stay: true }); }
    await screen(`choose-sights-day${di}-after`, { stillMs: 3000 });
    // A sight that doesn't fit: its "Needs 25 min" badge opens the ways to fit it in.
    const nameBtn = p.locator('[data-act=fitask]').first();
    if (await nameBtn.isVisible().catch(() => false)) { await tap(nameBtn, '"Needs ..." (ways to fit it in)', { nav: true }); await screen(`fit-box-day${di}`); const cl = p.locator('.fitbox [data-act=fitcancel]').or(p.locator('[data-act=close], [aria-label=Close], button').filter({ hasText: /^(×|✕|Close|Done|‹ Back|Back)$/ })); /* the box's own "Not now" / "Keep my day as is" (missing it left the box open and the rest of the walk tapped its backdrop) */ if (await cl.first().isVisible().catch(() => false)) await tap(cl, 'close the box', { nav: true }); await screen(`after-close-fit-box-day${di}`); if (await p.locator('.fitbox').count().catch(() => 0)) fail('STUCK', 'the "ways to fit it in" box could not be closed'); }
    await tap(p.locator('button, a').filter({ hasText: /Day plan/ }).filter({ hasNotText: /Lock/ }), 'Back to my day plan', { nav: true }); await screen(`day${di}-after-choose`);
    // A sight on the day plan opened and closed.
    const stop = p.locator('main button').filter({ hasNotText: /Walk|Taxi|bus|Change|See what|Choose|Lock|Rename|Start|Zoom|Show where|What's this|‹|:/ });
    const st = await stop.allInnerTexts().catch(() => []); const sname = st.find(x => x.length > 6 && x.length < 60);
    if (sname) { await tap(p.locator('main button').filter({ hasText: sname }), 'open stop ' + sname.slice(0, 30), { stay: false }); await screen(`stop-open-day${di}`); }
  }
  // Guide and a story.
  await tap(navBtn('Guide'), 'Guide tab', { nav: true }); await screen('guide'); await scrollThrough('guide');
  const play = p.locator('button').filter({ hasText: /▶|Play|Listen|Hear/ }).filter({ hasNotText: /tour/i });
  if (await play.first().isVisible().catch(() => false)) { await tap(play, 'play a story', { stay: true }); await sleep(2500);
    const a = await p.evaluate(() => [...document.querySelectorAll('audio')].map(a => ({ src: a.currentSrc.split('/').slice(-2).join('/'), paused: a.paused, t: +a.currentTime.toFixed(1), err: a.error && a.error.code })));
    R.audio = a; console.log('  audio', JSON.stringify(a)); if (LIVE && !a.some(x => !x.paused && x.t > 0)) R.notes.push('[guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)');
    await screen('guide-playing'); } else R.notes.push('[guide] no play button visible');
  // The tour.
  const ts = p.locator('[data-act=tourstart], button').filter({ hasText: /Start (the )?tour/ });
  if (await ts.first().isVisible().catch(() => false)) { await tap(ts, 'Start the tour', { nav: true }); await screen('tour-1');
    for (let k = 0; k < 3; k++) { const nx = p.locator('button').filter({ hasText: /^(Let's go|Next|I'm here)/ }); if (!(await nx.first().isVisible().catch(() => false))) break; await tap(nx, 'tour step ' + (k + 1), { nav: false }); await screen('tour-' + (k + 2)); }
    await tap(p.locator('button').filter({ hasText: /Exit tour|End tour|Stop tour/ }), 'Exit tour', { nav: true }); await screen('tour-exit'); } else R.notes.push('[tour] no Start the tour button on the Guide screen');
  await tap(navBtn('Journal'), 'Journal tab', { nav: true }); await screen('journal'); await scrollThrough('journal');
  await tap(navBtn('Settings'), 'Settings tab', { nav: true }); await screen('settings'); await scrollThrough('settings');
  await tap(navBtn('Trip'), 'Trip tab', { nav: true }); await screen('trip-again');
  // The phone's Back button: it should step back inside the app, never throw the traveler out of it.
  await gotoDay(pd); await screen('before-back');
  await p.goBack().catch(() => {}); await sleep(1500); where = 'phone back';
  const out = !(await p.evaluate(() => !!document.querySelector('main')).catch(() => false)) || !/localhost|github\.io/.test(p.url());
  if (out) { fail('BACK', 'the phone Back button (from a day plan, opened from the trip page) left the app instead of going back a screen'); await p.goto(base, { waitUntil: 'load' }); await sleep(2500); }
  await screen('after-phone-back');
  // Coming back later.
  screenT0 = 0; await p.reload({ waitUntil: 'load' }); await sleep(2500); await screen('reopened');
  // No signal.
  await ctx.setOffline(true); where = 'offline'; screenT0 = 0;
  await p.reload({ waitUntil: 'load' }).catch(e => fail('OFFLINE', 'the app did not open with no signal: ' + e.message.slice(0, 80))); await sleep(3000);
  if (await p.evaluate(() => !!document.querySelector('main')).catch(() => false)) {
    await screen('offline-open');
    await gotoDay(pd, `offline day ${pd}`);
    if (await p.evaluate(() => window.__kairouteState && __kairouteState().view === 'tour').catch(() => false)) { fail('LANDING', 'reopening the trip put the traveler back in the tour they had left with Exit tour'); const ex = p.locator('button').filter({ hasText: /Exit tour/ }); if (await ex.first().isVisible().catch(() => false)) await tap(ex, 'Exit tour', { nav: true }); await gotoDay(pd, `offline day ${pd}`); }
    await screen('offline-day'); await scrollThrough('offline-day');
    await tap(p.locator('button, a').filter({ hasText: /^\s*Choose sights\s*$/ }), 'offline Choose sights', { nav: true }); await screen('offline-choose');
    await tap(navBtn('Guide'), 'offline Guide', { nav: true }); await screen('offline-guide');
  }
  await ctx.setOffline(false);
  R.errors = [...new Set(R.errors)]; for (const e of R.errors) fail('ERROR', e);
  R.finished = new Date().toISOString();
  const vid = p.video(); await ctx.close(); if (vid) { const vp = await vid.path().catch(() => null); if (vp) { const to = path.join(dir, size + '-walk.webm'); fs.renameSync(vp, to); R.video = path.basename(to); } }
  fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(R, null, 1)); return R;
}

(async () => {
  let srv = null, base = ARG; if (!LIVE) { srv = await serve(path.resolve(ARG)); base = srv.url; }
  const browser = await chromium.launch(); const all = [];
  for (const size of (process.env.SIZES || 'phone,tablet,upright').split(',')) { console.log('\n===== ' + size + ' ' + SIZES[size].label); try { all.push(await runSize(browser, size, base)); } catch (e) { console.log('RUN ERROR', e); all.push({ size, device: SIZES[size].label, fails: [{ size, where: 'harness', kind: 'NOT TESTED', what: 'the walk stopped: ' + String(e.message).slice(0, 200) }], steps: [], notes: [] }); } }
  await browser.close(); srv && srv.close();
  // Known P2 findings may be listed in docs/qa/warns.json (tool "feel", rule = kind, optional "where" pattern) with an
  // owner and an end date at most 7 days ahead: they print WARN and don't fail. P1 kinds can never be warned.
  const P1 = new Set(['BACK', 'DEAD', 'COVERED', 'STUCK', 'ERROR', 'NOT TESTED', 'SCROLL', 'OFFLINE']);
  const today = new Date().toISOString().slice(0, 10), week = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  let W = []; try { W = (JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'qa', 'warns.json'), 'utf8')).warns || []).filter(w => w.tool === 'feel'); } catch (e) {}
  const warnFor = f => P1.has(f.kind) ? null : W.find(w => w.rule === f.kind && w.owner && w.until && w.until >= today && w.until <= week && (!w.where || new RegExp(w.where).test(f.where)));
  for (const w of W) if (P1.has(w.rule)) console.log(`FAIL warns.json: ${w.rule} is a P1 kind and can never be a warning`); else if (!w.owner || !w.until || w.until < today || w.until > week) console.log(`FAIL warns.json: the ${w.rule} warning needs an owner and an end date from ${today} to ${week} (has ${w.owner || 'no owner'}, ${w.until || 'no date'})`);
  const badW = W.filter(w => P1.has(w.rule) || !w.owner || !w.until || w.until < today || w.until > week).length;
  const allF = all.flatMap(r => r.fails); for (const f of allF) { const w = warnFor(f); if (w) f.warn = w.owner + ' until ' + w.until; }
  const fails = allF.filter(f => !f.warn), warns = allF.filter(f => f.warn), taps = all.flatMap(r => r.steps.filter(s => s.step === 'tap'));
  // One line per kind, as the release report reads them ("FAIL <kind> <n>", "WARN <kind> <n>"), then each finding.
  for (const [lst, word] of [[fails, 'FAIL'], [warns, 'WARN']]) { const ks = [...new Set(lst.map(f => f.kind))];
    for (const k of ks) { const fs_ = lst.filter(f => f.kind === k); console.log(`${word} ${k} ${fs_.length}${word === 'WARN' ? ' (known: ' + fs_[0].warn + ')' : ''}`); for (const f of fs_) console.log(`    ${f.size} [${f.where}] ${f.what}`); } }
  const slow = taps.filter(t => t.firstMs != null).sort((a, b) => (b.eventMs || b.firstMs) - (a.eventMs || a.firstMs)).slice(0, 5);
  const byKind = {}; for (const f of fails) byKind[f.kind] = (byKind[f.kind] || 0) + 1;
  const md = [`# Client feel test: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`, '', `App: ${base} (build ${(all[0] && all[0].version || '?').trim()})`, '',
    `Tested (real touch taps and swipes): ${all.map(r => r.device).join('; ')}. ${taps.length} taps, ${all.reduce((a, r) => a + (r.steps || []).filter(s => s.step === 'scroll').length, 0)} full-page swipe scrolls, ${all.reduce((a, r) => a + (r.screens || 0), 0)} screens.`, '',
    `Result: ${fails.length ? 'FAIL, ' + fails.length + ' problem(s): ' + Object.entries(byKind).map(([k, v]) => v + ' ' + k).join(', ') : 'PASS (0 problems)'}${warns.length ? '; ' + warns.length + ' known warning(s) with an owner and an end date' : ''}`, '',
    ...(warns.length ? ['## Known warnings (owner, end date)', '', ...warns.map(f => `- WARN ${f.kind} (${f.size}, ${f.where}): ${f.what} (${f.warn})`), ''] : []),
    '## Problems', '', ...(fails.length ? fails.map(f => `- ${f.kind} (${f.size}, ${f.where}): ${f.what}${f.src && f.src.length ? ' [moved: ' + f.src.join('; ') + ']' : ''}`) : ['None.']), '',
    '## Slowest taps', '', ...slow.map(t => `- ${t.size || ''} ${t.where}: "${t.label}" ${t.eventMs || t.firstMs} ms`), '',
    '## Not tested / notes', '', ...all.flatMap(r => (r.notes || []).map(n => `- ${r.size}: ${n}`)), '- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).', ''];
  for (const r of all) for (const t of taps) if (!t.size) t.size = r.size;
  fs.writeFileSync(path.join(OUT, 'summary.md'), md.join('\n')); fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ base, fails, warns, byKind, taps: taps.length }, null, 1));
  console.log('\n' + md.join('\n')); process.exit(fails.length || badW ? 1 : 0);
})().catch(e => { console.log('HARNESS ERROR', e); process.exit(2); });
