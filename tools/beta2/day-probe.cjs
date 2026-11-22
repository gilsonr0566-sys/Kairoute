// One-off live probe (Nov 22): opens a test cruise on the live Beta 2 app with the real free services and logs, over
// two minutes, how many sights the ship day has and what the water check is doing. Test trip only, no traveler data. Re-run after 9d8cba9.
const { chromium } = require('playwright'); const fs = require('fs');
const http = require('http'), TRIP = fs.readFileSync(__dirname + '/probe-trip.json', 'utf8');
const T0 = Date.now(), ts = () => ((Date.now() - T0) / 1000).toFixed(1) + 's';
(async () => { const sv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(__dirname + '/../../beta2-site/index.html').pipe(r); }).listen(0), URL = 'http://localhost:' + sv.address().port + '/';
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 412, height: 915 } })).newPage();
  await p.addInitScript(t => { if (!localStorage.getItem('b2:__copied')) { localStorage.setItem('b2:__copied', '1'); localStorage.setItem('b2:wayside.trip2', t); localStorage.setItem('b2:kairoute.lobbySeen', '1'); ['intro1', 'sunprincess1', 'spread1', 'bible1'].forEach(k => localStorage.setItem('b2:kairoute.' + k, '1')); } }, TRIP);
  if (process.env.LOCAL) await p.route(u => !/^http:\/\/localhost/.test(String(u)), r => r.fulfill({ status: 503, body: '' }));
  p.on('request', q => { const u = q.url(); if (/osrm|routing\.openstreetmap|overpass/.test(u)) console.log(ts(), 'REQ', u.slice(0, 110)); });
  p.on('requestfinished', async q => { const u = q.url(); if (/osrm|routing\.openstreetmap|overpass/.test(u)) { const r = await q.response(); console.log(ts(), 'DONE', r && r.status(), u.slice(0, 80)); } });
  p.on('requestfailed', q => { const u = q.url(); if (/osrm|routing\.openstreetmap|overpass/.test(u)) console.log(ts(), 'FAIL', q.failure() && q.failure().errorText, u.slice(0, 80)); });
  await p.goto(URL); await p.waitForTimeout(3000);
  const i = await p.evaluate(() => window.__kairouteDays().findIndex(d => /Naples/.test(d.dest))); console.log('day', i);
  await p.evaluate(i => window.__kairouteGo('day', i), i);
  let last = '';
  for (let k = 0; k < (+process.env.N || 75); k++) { await p.waitForTimeout(2000);
    const r = await p.evaluate(i => { const pl = window.__kairouteEngine2()[i] || {}, stops = (pl.items || []).filter(x => x.t === 'stop');
      return JSON.stringify(Object.assign({ stops: stops.map(x => x.name || x.id).join('|') }, window.__kairouteWater.state(i))); }, i);
    if (r !== last) console.log(ts(), r); last = r; }
  await b.close(); sv.close(); })();
