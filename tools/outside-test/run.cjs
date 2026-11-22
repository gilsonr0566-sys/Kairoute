// Outside test runner (tester's tool, changes nothing in the app). Opens the LIVE Beta 2 site in a headless browser,
// enters one trip through Start a new trip > Step by step, waits for the guides, then saves every day's text and a
// picture of it. AI is off and every paid or AI helper path is refused at the network layer, so a run costs nothing.
// Usage: TRIP=<name> node tools/outside-test/run.cjs   (trips come from tools/outside-test/queue.json)
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const Q = JSON.parse(fs.readFileSync(path.join(__dirname, 'queue.json'), 'utf8'));
const LIVE = Q.url || 'https://gilsonr0566-sys.github.io/Kairoute-Beta2/';
const PASS = new Set(['/sources', '/famous', '/ground', '/places', '/transit', '/route', '/departures', '/ferries', '/weather', '/facts', '/osm', '/findplace', '/nearsights', '/verify', '/bookcheck', '/voyage', '/x/near', '/x/group']);
const INJECT = fs.readFileSync(path.join(__dirname, 'inject.js'), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SC = require('./screen-check.cjs');
let SR = null; try { SR = require('./screen-rules.js'); } catch (e) {}
const screen = (res, where, text) => { const c = SC.check(text); if (!c) return; if (c.late.length || c.badLunch.length) { const f = { where, head: String(text).split('\n')[0], leaveBy: c.lbTxt, late: c.late.map(x => x.k + ' ' + x.name + ' leaves ' + x.leaveTxt), lunch: c.badLunch.map(x => x.name + ' | ' + x.meta) }; res.screen.push(f); console.log('SCREEN CHECK FAIL ' + JSON.stringify(f)); } res.screenRead++; if (SR && SR.rules) { try { for (const f of SR.rules(text, {})) { res.rules.push({ where, sev: f.sev, rule: f.rule, msg: f.msg }); if (/^S[12]/.test(f.sev)) console.log('SCREEN RULE ' + f.sev + ' ' + f.rule + ' @ ' + where + ': ' + f.msg); } } catch (e) { res.errors.push('screen-rules: ' + String(e.message).slice(0, 200)); } } };
(async () => {
  const t = Q.trips.find(x => x.name === process.env.TRIP); if (!t) { console.log('no such trip', process.env.TRIP); process.exit(1); }
  const out = path.join(process.cwd(), 'outside-out', t.name); fs.mkdirSync(out, { recursive: true });
  const res = { name: t.name, label: t.label || '', legs: t.legs, started: new Date().toISOString(), passed: {}, refused: {}, errors: [], days: [], guides: {}, steps: [], screen: [], screenRead: 0, rules: [] };
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1100, height: 2800 }, locale: 'en-US', timezoneId: t.tz || 'America/Chicago' });
  await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
  if (t.seed) { const old = JSON.parse(fs.readFileSync(path.join(process.cwd(), t.seed), 'utf8')).bucket || {}; res.seeded = { from: t.seed, keys: Object.keys(old).length }; await ctx.addInitScript(o => { try { if (!localStorage.getItem('ot.seeded')) { for (const k in o) localStorage.setItem(k, o[k]); localStorage.setItem('ot.seeded', '1'); } } catch (e) {} }, old); }
  const helperRoute = async r => {
    const req = r.request(), u = new URL(req.url()), p = u.pathname;
    if (p === '/status') return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, on: false, left: 0, budget: 0 }) });
    if (req.method() === 'OPTIONS') return r.continue();
    if (PASS.has(p) || (p === '/guide' && req.method() === 'GET')) { res.passed[p] = (res.passed[p] || 0) + 1; return r.continue(); }
    res.refused[p] = (res.refused[p] || 0) + 1; return r.fulfill({ status: 429, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":"off in this test"}' });
  };
  await ctx.route(u => /workers\.dev/.test(u.hostname), helperRoute);
  const p = await ctx.newPage(); p.on('pageerror', e => res.errors.push(String(e.message).slice(0, 300)));
  await p.goto(LIVE, { waitUntil: 'load' }); await sleep(2500);
  res.version = await p.evaluate(() => fetch('version.txt', { cache: 'no-store' }).then(r => r.text()).catch(e => 'ERR ' + e));
  await p.evaluate(() => window.__kairouteMockHelper && window.__kairouteMockHelper('https://kairoute-ai.rickgilson.workers.dev', null, true));
  await p.evaluate(INJECT + '; 1');
  res.aiReady = await p.evaluate(() => window.__kairouteAiReady && window.__kairouteAiReady());
  res.wizard = await p.evaluate(([legs, name]) => window.__T.wizard(legs, name), [t.legs, t.label || t.name]);
  await p.screenshot({ path: path.join(out, 'wizard.jpg'), type: 'jpeg', quality: 55, fullPage: true });
  const t0 = Date.now(); await p.click('#wizForm button[type=submit]'); await sleep(4000);
  const limit = (t.buildMin || 45) * 60000; let last = '';
  while (Date.now() - t0 < limit) { const s = await p.evaluate(() => { const s = window.__kairouteState(); return { busy: s.busy, err: s.err }; }); if (s.busy !== last) { console.log(Math.round((Date.now() - t0) / 1000) + 's', s.busy || '(done)', s.err || ''); last = s.busy; } if (!s.busy) break; await sleep(2000); }
  res.buildSec = Math.round((Date.now() - t0) / 1000); await sleep(10000);
  const st = await p.evaluate(() => { const s = window.__kairouteState(); return { busy: s.busy, err: s.err, days: (s.days || []).map(d => ({ date: d.date, type: d.type, destination: d.destination, mode: d.mode, time: d.time, portArrive: d.portArrive, allAboard: d.allAboard })) }; });
  res.state = st;
  for (let i = 0; i < st.days.length; i++) {
    const d = st.days[i]; if (t.onlyDays && !t.onlyDays.includes(i)) continue; if (d.type === 'sea') { res.days.push({ i, date: d.date, type: 'sea' }); continue; }
    await p.evaluate(i => window.__kairouteAt(i, 'plan'), i); await sleep(6000);
    let textEarly; if (Q.dayWait) { textEarly = await p.evaluate(() => document.querySelector('main').innerText); await sleep(Q.dayWait); }
    const text = await p.evaluate(() => document.querySelector('main').innerText);
    await p.screenshot({ path: path.join(out, 'day-' + String(i).padStart(2, '0') + '.jpg'), type: 'jpeg', quality: 55, fullPage: true });
    // A picture of every card on the day's timeline (stops, rides, lunch, free time, start and end) at phone width, folded notes open.
    let cards; if (Q.stopShots) { try { await p.setViewportSize({ width: 412, height: 900 }); await sleep(1500); await p.evaluate(() => { document.querySelectorAll('main .timeline details, main details.why, main .tl details').forEach(x => { x.open = true; }); }); await sleep(600);
      const dir = path.join(out, 'stops'); fs.mkdirSync(dir, { recursive: true }); const loc = p.locator('.timeline .tl'); const n = await loc.count(); cards = [];
      for (let k = 0; k < n; k++) { const el = loc.nth(k); const f = 'd' + String(i).padStart(2, '0') + '-' + String(k).padStart(2, '0') + '.jpg'; const info = await el.evaluate(x => ({ cls: x.className, text: x.innerText.slice(0, 1200) })).catch(() => null); if (!info) continue; try { await el.screenshot({ path: path.join(dir, f), type: 'jpeg', quality: 55, timeout: 8000 }); cards.push({ f, cls: info.cls, text: info.text }); } catch (e) { cards.push({ f: null, cls: info.cls, text: info.text, err: String(e.message).slice(0, 120) }); } }
    } catch (e) { res.errors.push('stops day ' + i + ': ' + String(e.message).slice(0, 200)); } await p.setViewportSize({ width: 1100, height: 2800 }); await p.evaluate(i => window.__kairouteAt(i, 'plan'), i); await sleep(1500); }
    const g = await p.evaluate(i => window.__T.guide(i), i); if (g && !res.guides[g.city]) res.guides[g.city] = g;
    screen(res, 'day ' + i, text); if (textEarly) screen(res, 'day ' + i + ' early', textEarly);
    res.days.push({ i, date: d.date, type: d.type, destination: d.destination, cards, text, textEarly: textEarly && textEarly !== text ? textEarly : undefined });
    console.log('\n===== day ' + i + ' ' + d.date + ' ' + d.type + ' ' + (d.destination || '') + '\n' + text);
  }
  // The first sightseeing day again at phone size.
  const ph = st.days.findIndex(d => d.type === 'land' || d.type === 'port');
  if (ph >= 0) { await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(i => window.__kairouteAt(i, 'plan'), ph); await sleep(5000); await p.screenshot({ path: path.join(out, 'phone-day-' + String(ph).padStart(2, '0') + '.jpg'), type: 'jpeg', quality: 55, fullPage: true }); res.phoneText = await p.evaluate(() => document.querySelector('main').innerText.slice(0, 1500)); await p.setViewportSize({ width: 1100, height: 2800 }); }
  // Extra traveler steps for this trip: each is a line of page script (a tap, a tick, a changed hour) and a picture after it.
  for (const s of t.steps || []) { let r; if (s.reload) { await p.reload({ waitUntil: 'load' }); await sleep(3000); await p.evaluate(() => window.__kairouteMockHelper && window.__kairouteMockHelper('https://kairoute-ai.rickgilson.workers.dev', null, true)); await p.evaluate(INJECT + '; 1'); } try { r = await p.evaluate(s.js); } catch (e) { r = 'ERR ' + e.message; } await sleep(s.wait || 4000); if (s.phone) await p.setViewportSize({ width: 390, height: 844 }); if (s.tablet) await p.setViewportSize({ width: 1100, height: 2800 });
    const text = await p.evaluate(() => document.querySelector('main').innerText).catch(() => ''); await p.screenshot({ path: path.join(out, 'step-' + s.name + '.jpg'), type: 'jpeg', quality: 55, fullPage: !s.screen }); screen(res, 'step ' + s.name, text); res.steps.push({ name: s.name, r, text }); console.log('\n===== step ' + s.name + ' -> ' + JSON.stringify(r) + '\n' + text.slice(0, 6000)); }

  // Group trip: this browser shares the trip (owner), a second clean browser joins with the code (member) and makes its own day.
  if (t.group) { const G = res.group = { log: [] }, gi = t.group.day; const shot = (pg, n) => pg.screenshot({ path: path.join(out, 'group-' + n + '.jpg'), type: 'jpeg', quality: 55, fullPage: true }).catch(() => {});
    const nav = pg => pg.evaluate(async () => { const b = [...document.querySelectorAll('header nav button, [data-act="settings"]')].find(x => /^Settings$/.test(x.innerText.trim())); if (b) b.click(); await new Promise(r => setTimeout(r, 2000)); const g = [...document.querySelectorAll('main button, main a')].find(x => /^Group trip$/.test(x.innerText.trim())); if (g) g.click(); return !!b && !!g; });
    const read = pg => pg.evaluate(() => { const m = document.querySelector('main').innerText; const ban = document.querySelector('[data-grpday]'); return { banner: ban ? ban.dataset.grpday + ': ' + ban.innerText.slice(0, 400) : null, sights: (m.match(/\n(\d+)\nsights?\n/) || [])[1] || null, stops: (m.match(/\n\d+\n[^\n]+\n[^\n]* · [^\n]*/g) || []).map(x => x.split('\n')[2]), text: m.slice(0, 9000) }; });
    const ticks = (pg, i) => pg.evaluate(i => window.__T.ticks(i).then(a => a.filter(x => x.on).map(x => x.n)), i);
    try {
      G.navA = await nav(p); await sleep(3000); G.leadBtns = await p.evaluate(() => document.querySelectorAll('[data-grp="lead"]').length); await p.click('[data-grp="lead"]'); await sleep(12000);
      G.code = await p.evaluate(() => { const e = document.querySelector('.grpcard p.synccode'); return e ? e.innerText.trim() : null; }); G.cardA = await p.evaluate(() => (document.querySelector('.grpcard') || {}).innerText || null); await shot(p, 'a-shared');
      await p.evaluate(i => window.__kairouteAt(i, 'plan'), gi); await sleep(8000); G.ownerPlan = await read(p); G.ownerTicks = await ticks(p, gi);
      if (G.code) { const ctx2 = await b.newContext({ viewport: { width: 1100, height: 2800 }, locale: 'en-US', timezoneId: t.tz || 'America/Chicago' }); await ctx2.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} }); await ctx2.route(u => /workers\.dev/.test(u.hostname), helperRoute);
        const q = await ctx2.newPage(); q.on('pageerror', e => res.errors.push('B: ' + String(e.message).slice(0, 300))); await q.goto(LIVE, { waitUntil: 'load' }); await sleep(2500); await q.evaluate(() => window.__kairouteMockHelper && window.__kairouteMockHelper('https://kairoute-ai.rickgilson.workers.dev', null, true)); await q.evaluate(INJECT + '; 1');
        G.navB = await nav(q); await sleep(3000); await q.fill('#grp-code', G.code); await q.click('[data-grp="join"]'); await sleep(15000); G.cardB = await q.evaluate(() => (document.querySelector('.grpcard') || {}).innerText || null); await shot(q, 'b-joined');
        G.openBtn = await q.evaluate(() => !!document.querySelector('[data-grp="opentrip"]')); if (G.openBtn) await q.click('[data-grp="opentrip"]'); await sleep(20000); await q.evaluate(i => window.__kairouteAt(i, 'plan'), gi); await sleep(25000); G.memberFollow = await read(q); await shot(q, 'b-follow');
        await q.click('[data-grp="ownday"]'); await sleep(3000); G.ticksOwn3s = await ticks(q, gi); await shot(q, 'b-own-picker'); await sleep(12000); G.ticksOwn15s = await ticks(q, gi);
        await q.evaluate(i => window.__kairouteAt(i, 'plan'), gi); await sleep(15000); G.memberOwn = await read(q); await shot(q, 'b-own-plan');
        // untick one sight, then see that it stays unticked
        G.unticked = await q.evaluate(async i => { window.__kairouteAt(i, 'sites'); await window.__T.sleep(3000); const c = [...document.querySelectorAll('input[data-site]')].filter(x => x.checked).pop(); if (!c) return null; const n = c.getAttribute('aria-label'); c.click(); return n; }, gi); await sleep(3000); G.ticksAfterUntick3s = await ticks(q, gi); await sleep(20000); G.ticksAfterUntick25s = await ticks(q, gi); await sleep(60000); G.ticksAfterUntick85s = await ticks(q, gi);
        await q.evaluate(i => window.__kairouteAt(i, 'plan'), gi); await sleep(15000); G.memberOwnAfter = await read(q); await shot(q, 'b-own-after-untick');
        G.followBtn = await q.evaluate(() => !!document.querySelector('[data-grp="follow"]')); if (G.followBtn) { await q.click('[data-grp="follow"]'); await sleep(15000); G.memberBack = await read(q); G.ticksBack = await ticks(q, gi); await shot(q, 'b-back-to-group'); }
        // leave the group and stop sharing, so nothing is left on the helper
        try { G.navB2 = await nav(q); await sleep(2500); q.on('dialog', d => d.accept()); await q.click('[data-grp="leave"]', { timeout: 5000 }); await sleep(4000); } catch (e) { G.log.push('leave: ' + e.message.slice(0, 200)); }
        await ctx2.close(); }
    } catch (e) { G.error = String(e.message).slice(0, 600); await shot(p, 'error'); }
    try { await nav(p); await sleep(2500); p.on('dialog', d => d.accept()); await p.click('[data-grp="end"]', { timeout: 5000 }); await sleep(4000); G.ended = true; } catch (e) { G.log.push('end: ' + e.message.slice(0, 200)); }
    console.log('\nGROUP ' + JSON.stringify(G).slice(0, 6000)); }
  console.log('\nGUIDES ' + JSON.stringify(res.guides)); console.log('\nversion', res.version, 'aiReady', res.aiReady, 'build', res.buildSec + 's', 'passed', JSON.stringify(res.passed), 'refused', JSON.stringify(res.refused), 'errors', JSON.stringify([...new Set(res.errors)]));
  try { res.bucket = await p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; }); } catch (e) { res.bucket = { error: String(e) }; }
  res.finished = new Date().toISOString(); fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(res, null, 1)); await b.close();
})().catch(e => { console.log('RUNNER ERROR', e); process.exit(1); });
