// Area visits on the published site: the live page's own map question for Rome's Vatican sights (real OpenStreetMap
// answer) puts St. Peter's, the square and the Sistine Chapel inside Vatican City. Usage: node tools/area-live.cjs [url]
const { chromium } = require('playwright');
(async () => { const url = process.argv[2] || 'https://gilsonr0566-sys.github.io/Kairoute/'; const b = await chromium.launch(); const p = await (await b.newContext()).newPage(); let fails = 0;
  const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
  await p.goto(url); await p.waitForTimeout(3000);
  ok(await p.evaluate(() => !!window.__kairouteArea), 'the live page has area visits (' + (await p.evaluate(() => fetch('version.txt', { cache: 'no-store' }).then(r => r.text()).catch(() => '?'))).trim() + ')');
  const pts = [{ name: 'Sistine Chapel', lat: 41.90296, lng: 12.45443 }, { name: "St. Peter's Basilica", lat: 41.90222, lng: 12.45342 }, { name: 'Piazza San Pietro', lat: 41.90218, lng: 12.45724 }, { name: 'Pantheon', lat: 41.8986, lng: 12.4769 }];
  const r = await p.evaluate(async pts => { const A = window.__kairouteArea, q = A.query(pts);
    for (const ep of ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']) { try { const x = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded' } }); if (!x.ok) continue; const got = A.parse(await x.json(), pts); A.set(got);
      const V = { id: 'v', name: 'Vatican City', wd: 'Q237', lat: 41.904, lng: 12.453 }; return pts.map(s => [s.name, A.inArea(Object.assign({ id: s.name }, s), V)]); } catch (e) {} } return null; }, pts);
  ok(!!r, 'the map answered');
  if (r) { console.log('     ' + r.map(x => x[0] + ': ' + (x[1] ? 'inside' : 'not inside')).join(', ')); ok(r.slice(0, 3).every(x => x[1]) && !r[3][1], 'the three Vatican sights are inside Vatican City, the Pantheon is not'); }
  await b.close(); console.log(fails ? fails + ' FAIL' : 'Area live check passed'); process.exit(fails ? 1 : 0); })();
