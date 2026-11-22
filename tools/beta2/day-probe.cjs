// One-off live probe (Nov 22): opens a test cruise on the live Beta 2 app with the real free services and logs, over
// two minutes, how many sights the ship day has and what the water check is doing. Test trip only, no traveler data. Re-run after 9d8cba9.
const { chromium } = require('playwright'); const fs = require('fs');
const http = require('http'), TRIP = fs.readFileSync(__dirname + '/' + (process.env.TRIP || 'probe-trip.json'), 'utf8'), DEST = new RegExp(process.env.DEST || 'Naples');
const T0 = Date.now(), ts = () => ((Date.now() - T0) / 1000).toFixed(1) + 's';
const SEED = process.env.SEED ? JSON.parse(require('zlib').gunzipSync(fs.readFileSync(__dirname + '/' + process.env.SEED)).toString()) : null;
(async () => { const sv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(__dirname + '/../../beta2-site/index.html').pipe(r); }).listen(0), URL = process.env.LIVE ? 'https://gilsonr0566-sys.github.io/Kairoute-Beta2/' : 'http://localhost:' + sv.address().port + '/';
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 412, height: 915 } })).newPage();
  if (SEED) await p.addInitScript(ls => { if (!localStorage.getItem('b2:__copied')) { localStorage.setItem('b2:__copied', '1'); for (const k in ls) localStorage.setItem('b2:' + k, ls[k]); } }, SEED);
  await p.addInitScript(t => { if (!localStorage.getItem('b2:__copied')) { localStorage.setItem('b2:__copied', '1'); localStorage.setItem('b2:wayside.trip2', t); localStorage.setItem('b2:kairoute.lobbySeen', '1'); ['intro1', 'sunprincess1', 'spread1', 'bible1'].forEach(k => localStorage.setItem('b2:kairoute.' + k, '1')); } }, TRIP);
  if (process.env.LOCAL) await p.route(u => !/^http:\/\/localhost/.test(String(u)), r => r.fulfill({ status: 503, body: '' }));
  p.on('request', q => { const u = q.url(); if (/osrm|routing\.openstreetmap|overpass/.test(u)) console.log(ts(), 'REQ', u.slice(0, 110)); });
  p.on('requestfinished', async q => { const u = q.url(); if (/osrm|routing\.openstreetmap|overpass/.test(u)) { const r = await q.response(); console.log(ts(), 'DONE', r && r.status(), u.slice(0, 80)); } });
  p.on('response', async r => { const u = r.url(); if (!/\/transit$/.test(u)) return; let b = ''; try { b = await r.text(); } catch (e) {}
    let pairs = []; try { pairs = JSON.parse(r.request().postData() || '{}').pairs || []; } catch (e) {}
    let j = null; try { j = JSON.parse(b); } catch (e) {}
    pairs.forEach((q, k) => { if (!(q.b && +[].concat(q.b.lat != null ? q.b.lat : q.b[0])[0] < 42.2 && +[].concat(q.b.lat != null ? q.b.lat : q.b[0])[0] > 42.0)) return; const a = j && (j.results || j.answers || j)[k];
      console.log(ts(), 'BACK', JSON.stringify(q).slice(0, 160), 'ANSWER', JSON.stringify(a && a.opts ? { partial: a.partial, opts: a.opts.map(o => ({ mode: o.mode, label: o.label, min: o.min, deps: (o.deps || []).map(d => d.t), kd: (o.kindDeps || []).map(d => d.t) })) } : a).slice(0, 3000)); });
    if (!pairs.some(q => q.b && +[].concat(q.b.lat != null ? q.b.lat : q.b[0])[0] < 42.2 && +[].concat(q.b.lat != null ? q.b.lat : q.b[0])[0] > 42.0)) console.log(ts(), 'TRANSIT', pairs.length, 'pairs', b.length, 'bytes', JSON.stringify(Object.keys(j || {}))); });
  p.on('requestfailed', q => { const u = q.url(); if (/osrm|routing\.openstreetmap|overpass/.test(u)) console.log(ts(), 'FAIL', q.failure() && q.failure().errorText, u.slice(0, 80)); });
  await p.goto(URL); await p.waitForTimeout(3000);
  const i = await p.evaluate(dest => window.__kairouteDays().findIndex(d => new RegExp(dest).test(d.dest)), DEST.source); console.log('day', i);
  await p.evaluate(i => window.__kairouteGo('day', i), i);
  let last = '';
  for (let k = 0; k < (+process.env.N || 75); k++) { await p.waitForTimeout(2000);
    if (process.env.PIER && k === 10) { const [la, ln] = process.env.PIER.split(',').map(Number); await p.evaluate(([i, la, ln]) => window.__kairouteEdit(i, { pier: { name: 'Probe pier', lat: la, lng: ln } }), [i, la, ln]); console.log(ts(), 'PIER SET'); }
    if (process.env.PIER) console.log(ts(), 'SEL', await p.evaluate(() => window.__kairouteSelCount()), await p.evaluate(i => { const d = JSON.parse(localStorage.getItem('wayside.trip2') || 'null'); const x = d && d.days[i]; return x ? JSON.stringify({ sel: (x.selected || []).length, seed: x.seedSig, auto: x.autoEmpty, own: x.ownList, ready: !!x.ready }) : ''; }, i));
    const r = await p.evaluate(i => { const pl = window.__kairouteEngine2()[i] || {}, stops = (pl.items || []).filter(x => x.t === 'stop');
      const rides = (pl.items || []).filter(x => x.t === 'ride' && (x.min || 0) > 30).map(x => ({ kind: x.kind, how: x.how, min: x.min, note: x.note, src: x.source, deps: x.ans && x.ans.deps, kd: x.ans && x.ans.kindDeps && x.ans.kindDeps.map(q => q.t) }));
      return JSON.stringify(Object.assign({ stops: stops.map(x => x.name || x.id).join('|'), rides })); }, i);
    if (r !== last) console.log(ts(), r); last = r; }
  await b.close(); sv.close(); })();
