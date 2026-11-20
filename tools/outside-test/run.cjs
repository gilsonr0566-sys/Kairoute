// Outside test runner (tester's tool, changes nothing in the app). Opens the LIVE Beta 2 site in a headless browser,
// enters one trip through Start a new trip > Step by step, waits for the guides, then saves every day's text and a
// picture of it. AI is off and every paid or AI helper path is refused at the network layer, so a run costs nothing.
// Usage: TRIP=<name> node tools/outside-test/run.cjs   (trips come from tools/outside-test/queue.json)
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const Q = JSON.parse(fs.readFileSync(path.join(__dirname, 'queue.json'), 'utf8'));
const LIVE = Q.url || 'https://gilsonr0566-sys.github.io/Kairoute-Beta2/';
const PASS = new Set(['/sources', '/famous', '/ground', '/places', '/transit', '/route', '/departures', '/ferries', '/weather', '/facts', '/osm', '/findplace', '/nearsights', '/verify', '/bookcheck', '/voyage', '/x/near']);
const INJECT = fs.readFileSync(path.join(__dirname, 'inject.js'), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const t = Q.trips.find(x => x.name === process.env.TRIP); if (!t) { console.log('no such trip', process.env.TRIP); process.exit(1); }
  const out = path.join(process.cwd(), 'outside-out', t.name); fs.mkdirSync(out, { recursive: true });
  const res = { name: t.name, label: t.label || '', legs: t.legs, started: new Date().toISOString(), passed: {}, refused: {}, errors: [], days: [], guides: {}, steps: [] };
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1100, height: 2800 }, locale: 'en-US', timezoneId: t.tz || 'America/Chicago' });
  await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
  await ctx.route(u => /workers\.dev/.test(u.hostname), async r => {
    const req = r.request(), u = new URL(req.url()), p = u.pathname;
    if (p === '/status') return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, on: false, left: 0, budget: 0 }) });
    if (req.method() === 'OPTIONS') return r.continue();
    if (PASS.has(p) || (p === '/guide' && req.method() === 'GET')) { res.passed[p] = (res.passed[p] || 0) + 1; return r.continue(); }
    res.refused[p] = (res.refused[p] || 0) + 1; return r.fulfill({ status: 429, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":"off in this test"}' });
  });
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
    const d = st.days[i]; if (d.type === 'sea') { res.days.push({ i, date: d.date, type: 'sea' }); continue; }
    await p.evaluate(i => window.__kairouteAt(i, 'plan'), i); await sleep(6000);
    const text = await p.evaluate(() => document.querySelector('main').innerText);
    await p.screenshot({ path: path.join(out, 'day-' + String(i).padStart(2, '0') + '.jpg'), type: 'jpeg', quality: 55, fullPage: true });
    const g = await p.evaluate(i => window.__T.guide(i), i); if (g && !res.guides[g.city]) res.guides[g.city] = g;
    res.days.push({ i, date: d.date, type: d.type, destination: d.destination, text });
    console.log('\n===== day ' + i + ' ' + d.date + ' ' + d.type + ' ' + (d.destination || '') + '\n' + text);
  }
  // The first sightseeing day again at phone size.
  const ph = st.days.findIndex(d => d.type === 'land' || d.type === 'port');
  if (ph >= 0) { await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(i => window.__kairouteAt(i, 'plan'), ph); await sleep(5000); await p.screenshot({ path: path.join(out, 'phone-day-' + String(ph).padStart(2, '0') + '.jpg'), type: 'jpeg', quality: 55, fullPage: true }); res.phoneText = await p.evaluate(() => document.querySelector('main').innerText.slice(0, 1500)); await p.setViewportSize({ width: 1100, height: 2800 }); }
  // Extra traveler steps for this trip: each is a line of page script (a tap, a tick, a changed hour) and a picture after it.
  for (const s of t.steps || []) { let r; try { r = await p.evaluate(s.js); } catch (e) { r = 'ERR ' + e.message; } await sleep(s.wait || 4000); if (s.phone) await p.setViewportSize({ width: 390, height: 844 }); if (s.tablet) await p.setViewportSize({ width: 1100, height: 2800 });
    const text = await p.evaluate(() => document.querySelector('main').innerText).catch(() => ''); await p.screenshot({ path: path.join(out, 'step-' + s.name + '.jpg'), type: 'jpeg', quality: 55, fullPage: !s.screen }); res.steps.push({ name: s.name, r, text }); console.log('\n===== step ' + s.name + ' -> ' + JSON.stringify(r) + '\n' + text.slice(0, 6000)); }
  console.log('\nGUIDES ' + JSON.stringify(res.guides)); console.log('\nversion', res.version, 'aiReady', res.aiReady, 'build', res.buildSec + 's', 'passed', JSON.stringify(res.passed), 'refused', JSON.stringify(res.refused), 'errors', JSON.stringify([...new Set(res.errors)]));
  res.finished = new Date().toISOString(); fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(res, null, 1)); await b.close();
})().catch(e => { console.log('RUNNER ERROR', e); process.exit(1); });
