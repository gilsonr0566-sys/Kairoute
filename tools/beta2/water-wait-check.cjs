// The water check never leaves a ship day empty while it waits on the slow part (Nov 21 live check: the port day with
// an island off it showed no sights at all while the walking routes came in). The road service answers at once here and
// the walking and island services take 40 seconds: the day must have its sights within a few seconds, and keep them.
// Usage: node tools/beta2/water-wait-check.cjs beta2-site/index.html
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const F = path.resolve(process.argv[2] || 'beta2-site/index.html');
(async () => { const s = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(F).pipe(r); }).listen(0);
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 412, height: 915 } })).newPage();
  await p.route(u => !/^http:\/\/localhost/.test(String(u)), r => { const u = r.request().url();
    if (/router\.project-osrm/.test(u)) { const n = u.split('/driving/')[1].split('?')[0].split(';').length;
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'Ok', sources: Array.from({ length: n }, (x, k) => ({ distance: k === 0 ? 900 : 40 })) }) }); }
    if (/routing\.openstreetmap|overpass/.test(u)) { setTimeout(() => r.fulfill({ status: 503, body: '' }).catch(() => {}), 40000); return; }
    r.fulfill({ status: 503, body: '' }); });
  await p.goto('http://localhost:' + s.address().port + '/'); await p.waitForTimeout(2500);
  const sm = p.locator('[data-act="loadsample"]').first(); if (await sm.isVisible().catch(() => false)) await sm.click(); await p.waitForTimeout(3000);
  const days = await p.evaluate(() => window.__kairouteDays().map((d, i) => ({ i, type: d.type })).filter(d => d.type === 'port').map(d => d.i));
  let bad = []; const counts = [];
  for (const t of [3, 20]) { await p.waitForTimeout(t === 3 ? 3000 : 17000);
    for (const i of days) { const n = await p.evaluate(i => ((window.__kairouteEngine2()[i] || {}).items || []).filter(x => x.t === 'stop').length, i); counts.push(`t+${t}s day ${i + 1}: ${n}`); if (!n) bad.push(`day ${i + 1} has no sights ${t} s in`); } }
  console.log(counts.join('\n'));
  console.log(bad.length ? 'FAIL ' + bad.join('; ') : 'Water wait check passed (' + days.length + ' ship days keep their sights while the walking answers come in)');
  await b.close(); s.close(); process.exit(bad.length ? 1 : 0); })();
