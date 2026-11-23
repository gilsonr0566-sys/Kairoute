// An arriving or leaving day whose airport or station the guide doesn't know is never a dead end (first-time traveler
// walk, Nov 22, 2026: Rome's arrival and leaving days said "Choose your arrival airport" with no airport to choose).
// Every arriving and leaving day of the sample trip has its airport/station list emptied in turn; the Day plan must then
// offer "Which airport?" / "Which station?" with a name search, and a place picked from it must plan the day.
// Offline, no AI: the map search (/findplace) is answered by the test. Usage: node tools/ui/gate-ask-check.cjs [beta2-site/index.html]
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'beta2-site/index.html');
const serve = f => new Promise(res => { const dir = path.dirname(f); const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/ai.json') { r.writeHead(200, { 'content-type': 'application/json' }); return r.end('{"url":"https://kairoute-ai.rickgilson.workers.dev"}'); }
  const p = path.join(dir, u === '/' ? path.basename(f) : u); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'text/plain' }); fs.createReadStream(p).pipe(r); });
  s.listen(0, () => res({ url: 'http://localhost:' + s.address().port + '/', close: () => s.close() })); });
const fails = []; const SHOT = process.env.SHOT;
(async () => {
  const s = await serve(FILE); const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: SHOT ? 2 : 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); const k = 'b2:kairoute.app', v = JSON.parse(localStorage.getItem(k) || '{}'); v.backAck = '2026-11-20'; localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} });
  let at = null, typed = null;
  const C0 = { lat: 40.0, lng: -20.0 }, GROUND = {
    'Testville airport': { wiki: [
      { title: 'Testville Airport', lat: 40.05, lng: -20.02, extract: 'Testville Airport (IATA: TVX, ICAO: XTVX) is the main international airport serving Testville.' },
      { title: 'Testville New Airport', lat: 40.25, lng: -20.30, extract: 'Testville New Airport is a planned international airport to serve Testville, expected to open in 2034.' },
      { title: 'Aeroporto (Testville Metro)', lat: 40.06, lng: -20.06, extract: 'Aeroporto is a station on the Red Line of the Testville Metro.' },
      { title: 'Old Testville Airport', lat: 39.90, lng: -19.90, extract: 'Old Testville Airport (IATA: OTV) was the main airport of Testville until it closed in 2001.' }],
      map: [{ name: 'Testville Airport Terminal 2', lat: 40.07, lng: -20.05, kind: 'terminal' }, { name: 'Testville Hospital Heliport', lat: 40.01, lng: -20.0, kind: 'helipad' }, { name: 'Testville Gliding Club Airfield', lat: 40.12, lng: -20.12, kind: 'aerodrome' }] },
    'Testville international airport': { wiki: [{ title: 'Testville South Airport', lat: 39.85, lng: -20.10, extract: 'Testville South Airport (IATA: TVS, ICAO: XTVS) is a smaller airport south of Testville with flights to nearby islands.' }], map: [] } };
  await ctx.route(u => !/^http:\/\/localhost/.test(String(u)), r => { const u = new URL(r.request().url()), H = { 'access-control-allow-origin': '*' };
    if (/workers\.dev/.test(u.hostname) && u.pathname === '/status') return r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: '{"ok":true,"on":false}' });
    // The map and encyclopedia lookup (/ground) for a made-up city: one real airport, a second real one, and places that
    // are no airport anyone flies to (one still planned, a terminal, a heliport, a metro stop, an airfield).
    if (/workers\.dev/.test(u.hostname) && u.pathname === '/ground') { const names = (JSON.parse(r.request().postData() || '{}').names || []);
      return r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify({ results: names.map(n => GROUND[n] || { wiki: [], map: [] }) }) }); }
    if (/workers\.dev/.test(u.hostname) && u.pathname === '/findplace' && typed) return r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify({ places: typed }) });
    if (/workers\.dev/.test(u.hostname) && u.pathname === '/findplace' && at) return r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify({ places: [{ name: at.name, lat: at.lat, lng: at.lng, kind: at.kind }, { name: 'Old Town', lat: at.lat, lng: at.lng, kind: 'suburb' }] }) });
    return r.fulfill({ status: 503, body: '' }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(s.url); await p.waitForTimeout(2500);
  const sample = p.locator('[data-act="loadsample"]').first(); if (await sample.isVisible().catch(() => false)) await sample.click();
  await p.waitForTimeout(5000);
  for (let k = 0; k < 5; k++) { const sk = p.locator('.coach button:has-text("Skip")').first(); if (await sk.isVisible().catch(() => false)) await sk.click(); else break; }
  const days = await p.evaluate(() => window.__kairouteState().days.map((d, i) => ({ i, type: d.type, mode: d.mode, dest: d.destination })).filter(d => (d.type === 'arrival' || d.type === 'departure') && (d.mode === 'flight' || d.mode === 'train')));
  if (!days.length) fails.push('the sample trip has no arriving or leaving day by air or rail');
  let shots = 0;
  for (const d of days) {
    const kind = d.mode === 'flight' ? 'airport' : 'station';
    const c = await p.evaluate(([i, kind]) => { const c = window.__kairouteCityOf(i); if (!c) return null; c.starts = c.starts || {}; const was = (c.starts[kind] || []).slice(); c.__was = was; c.starts[kind] = []; const any = was[0] || (c.sites || [])[0]; return any ? { lat: +any.lat, lng: +any.lng } : null; }, [d.i, kind]);
    if (!c) continue;
    at = { name: kind === 'airport' ? 'Test International Airport' : 'Test Central Station', lat: c.lat + 0.01, lng: c.lng, kind: kind === 'airport' ? 'aerodrome' : 'station' };
    await p.evaluate(i => window.__kairouteAt(i, 'plan'), d.i); await p.waitForTimeout(2500);
    const form = p.locator('#pierform'); const where = `day ${d.i} (${d.type} by ${d.mode}, ${d.dest})`;
    if (!(await form.isVisible().catch(() => false))) { const t = await p.evaluate(() => document.querySelector('main').innerText.slice(0, 300)); if (/Choose your (arrival|departure)/.test(t)) fails.push(where + ': "' + t.split('\n').find(x => /Choose your/.test(x)) + '" and no way to name the ' + kind); }
    else {
      if (SHOT && !shots) await p.screenshot({ path: SHOT + '-ask.png' });
      const h = await form.locator('h3').innerText(); if (!new RegExp(kind, 'i').test(h)) fails.push(where + ': the form asks "' + h + '" on a day by ' + d.mode);
      await p.fill('#pier-name', at.name.split(' ')[0]); await p.click('[data-act="piersearch"]'); await p.waitForTimeout(1500);
      const picks = await p.locator('[data-pierpick]').allInnerTexts(); if (picks.some(x => /Old Town/.test(x))) fails.push(where + ': a part of town is offered as the ' + kind);
      if (!picks.length) fails.push(where + ': the search found nothing: ' + await p.evaluate(() => (document.getElementById('pierform') || {}).innerText));
      else { await p.locator('[data-pierpick]').first().click(); await p.waitForTimeout(2500); const t = await p.evaluate(() => document.querySelector('main').innerText);
        if (/Choose your (arrival|departure)/.test(t)) fails.push(where + ': still asks to choose after the ' + kind + ' was picked');
        if (!t.includes(at.name)) fails.push(where + ': the picked ' + kind + ' is not on the plan');
        if (SHOT && !shots) await p.screenshot({ path: SHOT + '-picked.png', fullPage: false }); shots++; }
    }
    await p.evaluate(([i, kind]) => { const c = window.__kairouteCityOf(i); c.starts[kind] = c.__was; delete c.__was; window.__kairouteForgetGate(i); }, [d.i, kind]);
    if (process.env.ONE) break;
  }
  // Round 6a (w01): only airports with passenger flights are offered or planned from; never one still being planned or
  // closed, a terminal, a heliport, an airfield or a metro stop named after the airport.
  { const st = await p.evaluate(C => window.__kairouteSrcStarts('Testville, Testland', C).then(s => s.airport.map(x => x.name)), C0).catch(e => ['error: ' + e]);
    const want = ['Testville Airport', 'Testville South Airport'];
    if (st.length !== want.length || want.some(n => !st.includes(n))) fails.push('airports offered for a city: ' + JSON.stringify(st) + ', wanted only ' + JSON.stringify(want)); }
  const air = days.find(d => d.mode === 'flight');
  if (air) {
    const setList = list => p.evaluate(([i, list]) => { const c = window.__kairouteCityOf(i); c.starts = c.starts || {}; if (!c.__was) c.__was = (c.starts.airport || []).slice(); const any = c.__was[0] || (c.sites || [])[0];
      c.starts.airport = list.map(x => ({ name: x.name, lat: +any.lat + x.dy, lng: +any.lng, note: '' })); window.__kairouteForgetGate(i); window.__kairouteAt(i, 'plan'); }, [air.i, list]);
    const mainText = () => p.evaluate(() => document.querySelector('main').innerText);
    // A guide that lists a heliport as the only "airport": the day is not planned from it, and says why.
    await setList([{ name: 'Test City Heliport', dy: 0.01 }]); await p.waitForTimeout(2000);
    let t = await mainText();
    if (!/isn't an airport with passenger flights/.test(t)) fails.push('a heliport as the airport: the day does not say it is no airport with passenger flights: ' + t.slice(0, 600));
    if (/Out of Test City Heliport|Leave for Test City Heliport|At Test City Heliport/i.test(t) || /\bLEAVE\b[\s\S]*Test City Heliport/.test(t)) fails.push('a heliport as the airport: a normal day is planned from it');
    // A real airport and a terminal on its own: no question with the terminal in it; the real airport is used.
    await setList([{ name: 'Test International Airport', dy: 0.01 }, { name: 'Test Airport Terminal 3', dy: 0.06 }]); await p.waitForTimeout(2000);
    t = await mainText();
    if (/Terminal 3/.test(t)) fails.push('a terminal on its own is offered or used as the airport: ' + (t.split('\n').find(x => /Terminal 3/.test(x)) || ''));
    // Typed by name: a terminal and a heliport the map finds are never offered, and the traveler is told why.
    await setList([{ name: 'Test City Heliport', dy: 0.01 }]); await p.waitForTimeout(1500);
    const c = await p.evaluate(i => { const s = (window.__kairouteCityOf(i).sites || [])[0]; return { lat: +s.lat, lng: +s.lng }; }, air.i);
    typed = [{ name: 'Test Airport Terminal 1', lat: c.lat + 0.02, lng: c.lng, kind: 'terminal' }, { name: 'Test City Heliport', lat: c.lat + 0.01, lng: c.lng, kind: 'helipad' }, { name: 'Test Old Airport', lat: c.lat + 0.03, lng: c.lng, kind: 'disused' }];
    if (await p.locator('#pier-name').isVisible().catch(() => false)) {
      await p.fill('#pier-name', 'Test airport'); await p.click('[data-act="piersearch"]'); await p.waitForTimeout(1500);
      const picks = await p.locator('[data-pierpick]').allInnerTexts();
      if (picks.length) fails.push('typed airport search offers what is no airport: ' + picks.join(' | '));
      const msg = await p.evaluate(() => (document.getElementById('pierform') || {}).innerText || '');
      if (!/not as an airport with passenger flights/.test(msg)) fails.push('typed airport search finding only a terminal and a heliport does not say so: ' + msg.slice(0, 200));
    } else fails.push('a heliport as the airport: no way to name the real airport');
    typed = null;
    await p.evaluate(i => { const c = window.__kairouteCityOf(i); c.starts.airport = c.__was; delete c.__was; window.__kairouteForgetGate(i); }, air.i);
  }
  if (errs.length) fails.push('page errors: ' + errs.join(' | ').slice(0, 300));
  await b.close(); s.close();
  if (fails.length) { console.log('FAIL\n' + fails.join('\n')); process.exit(1); } console.log('PASS gate-ask check (' + days.length + ' days, and only airports with passenger flights)');
})();
