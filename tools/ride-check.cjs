// Ride-back check: on a port day the countdown follows where the traveler is and the train or ferry back to the
// ship. GPS at Pompeii, in Sorrento and in central Naples give different leave-by times; a missed train switches to
// the next safe one; with no safe train left it says to take a taxi now; the last safe departure warns about 30
// minutes ahead; the timeline and the countdown name the same last safe train. No network at all (offline).
// Usage: node tools/ride-check.cjs [path/to/index.html]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const http = require('http');
const ROOT = path.resolve(path.dirname(process.argv[2] || path.join(__dirname, '..', 'index.html'))), FILE = path.basename(process.argv[2] || 'index.html');
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(d); }); });
const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const PLACES = { pompeii: { lat: 40.7489, lng: 14.4848 }, sorrento: { lat: 40.6263, lng: 14.3757 }, naples: { lat: 40.8467, lng: 14.2536 } };
(async () => {
  await new Promise(r => srv.listen(0, r)); const BASE = `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch(); let fails = 0, oks = 0; const fail = m => { fails++; console.log('FAIL ' + m); }, ok = m => { oks++; console.log('ok   ' + m); };
  const ctx = await b.newContext({ viewport: { width: 800, height: 1280 }, timezoneId: 'Europe/Rome', permissions: ['geolocation'], geolocation: { latitude: PLACES.naples.lat, longitude: PLACES.naples.lng, accuracy: 20 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort()); // offline: nothing outside the app itself
  const p = await ctx.newPage(); p.on('pageerror', e => fail('page error ' + e.message));
  const at = m => new Date(Date.parse('2027-07-12T00:00:00Z') + (m - 120) * 60000); // Naples is UTC+2 in July
  await p.clock.install({ time: at(9 * 60) }); await p.goto(BASE + FILE); await p.waitForTimeout(600);
  const D = (await p.evaluate(() => window.__kairouteDays())).find(d => d.type === 'port' && /naples/i.test(d.dest));
  // Today's plan: Pompeii only, so the ride back to the ship starts there.
  const pid = await p.evaluate(i => window.__kairouteLiveTest.siteIdByName(i, 'Pompeii'), D.i);
  if (!pid) { fail('no Pompeii in the Naples guide'); process.exit(1); }
  await p.evaluate(([i, id]) => window.__kairouteTime.set(i, { selected: [id], fillTime: false, shipChecked: '2027-07-12', shipOff: 0 }), [D.i, pid]);
  const L = await p.evaluate(i => window.__kairouteLiveTest.lastLeg(i), D.i);
  // A timetable for that leg: trains every 30 minutes, 9 minutes' walk to the station, 50 minutes door to door.
  const deps = []; for (let t = 12 * 60; t <= 19 * 60; t += 30) deps.push({ t, lead: 9, dur: 50 });
  const opt = { mode: 'train', kind: 'Train', label: 'Circumvesuviana', from: 'Pompei Scavi', to: 'Napoli Garibaldi', ride: 35, wait: 10, every: 30, everySrc: 'timetable',
    access: { how: 'walk', min: 9, km: 0.7 }, egress: { how: 'walk', min: 6, km: 0.4 }, min: 60, km: 25, stops: 10, steps: [], deps, checked: '2026-11-13', path: [] };
  await p.evaluate(([k, o]) => window.__kairouteLiveTest.addTransit(k, [o]), [L.key, opt]);
  const L2 = await p.evaluate(i => window.__kairouteLiveTest.lastLeg(i), D.i);
  if (!/Circumvesuviana/.test(L2.leg)) fail(`ride back from ${L2.from.name} doesn't use the timetabled train (${L2.leg})`);
  const set = async (where, m) => { await ctx.setGeolocation({ latitude: PLACES[where].lat, longitude: PLACES[where].lng, accuracy: 20 }); await p.clock.setFixedTime(at(m)); await p.evaluate(i => window.__kairouteGo('plan', i), D.i); await p.waitForTimeout(1200); await p.evaluate(i => window.__kairouteGo('plan', i), D.i); await p.waitForTimeout(300);
    return p.evaluate(i => Object.assign(window.__kairouteLiveTest.ride(i), { big: document.getElementById('cdBig').textContent, to: (document.querySelector('#cdCard .cdto') || {}).textContent, sub: document.getElementById('cdSub').textContent, msg: document.getElementById('cdMsg').textContent, cls: document.getElementById('cdCard').className, tl: (document.querySelector('.timeline') || {}).textContent || '' }), D.i); };
  // Safe trains: departure - 9 + 50 + the ride's delay cushion must be back by the plan's latest time.
  const pom = await set('pompeii', 14 * 60 + 50);
  if (pom.src !== 'GPS' || !pom.ride) fail('Pompeii 14:50: no ride-back countdown ' + JSON.stringify(pom).slice(0, 300));
  else {
    pom.ride.next === 15 * 60 + 0 && pom.leaveBy === 14 * 60 + 51 ? ok(`Pompeii 14:50: catch the ${hm(pom.ride.next)} train, leave by ${hm(pom.leaveBy)} (last safe ${hm(pom.ride.last)}); chip "${pom.to}"`) : fail('Pompeii 14:50: ' + JSON.stringify(pom.ride) + ' leaveBy ' + pom.leaveBy);
    const m = /Last safe departure back: (\d\d:\d\d)/.exec(pom.tl); m && m[1] === hm(pom.ride.last) ? ok(`timeline and countdown agree: last safe train ${m[1]}`) : fail(`timeline says last safe ${m && m[1]}, countdown ${hm(pom.ride.last)}`);
  }
  const sor = await set('sorrento', 14 * 60 + 50);
  sor.ride && sor.ride.extra > 0 && sor.leaveBy < pom.leaveBy + 30 && sor.leaveBy !== pom.leaveBy ? ok(`Sorrento 14:50: ${sor.ride.extra} min to reach the train at Pompeii, catch the ${hm(sor.ride.next)}, leave by ${hm(sor.leaveBy)}`) : fail('Sorrento: ' + JSON.stringify(sor).slice(0, 300));
  const nap = await set('naples', 14 * 60 + 50);
  !nap.ride && nap.leaveBy > pom.leaveBy ? ok(`central Naples 14:50: no train needed, leave by ${hm(nap.leaveBy)} (${nap.sub.slice(0, 90)}…)`) : fail('central Naples: ' + JSON.stringify(nap).slice(0, 300));
  // Missed: still at Pompeii after the planned train's time.
  const plannedT = pom.ride && pom.ride.next;
  if (plannedT) { const mis = await set('pompeii', plannedT - 9 + 3);
    mis.ride && mis.ride.missed && mis.ride.next > plannedT && /missed/i.test(mis.msg + mis.sub) ? ok(`missed the ${hm(plannedT)}: switches to the ${hm(mis.ride.next)} ("${mis.msg.slice(0, 80)}")`) : fail('missed train: ' + JSON.stringify(mis).slice(0, 400)); }
  else fail('no planned train found');
  // Warn early: about 30 minutes before leaving for the last safe train.
  const lastLeave = pom.ride ? pom.ride.last - 9 : 0;
  const warn = await set('pompeii', lastLeave - 25);
  const al = await p.evaluate(() => window.__kairouteLiveTest.alerts().map(a => a.t + ': ' + a.b).join(' | '));
  /Last safe train soon/.test(al) ? ok(`last safe train warning ${25} min ahead`) : fail('no last-safe warning: ' + al.slice(0, 300));
  // Nothing safe left: taxi now, red, with a rough fare.
  const none = await set('pompeii', lastLeave + 2);
  none.ride && none.ride.none && /taxi/i.test(none.msg) && /soon|go/.test(none.cls) && /taxi back now/.test(none.to) ? ok(`no safe train left: "${none.msg.slice(0, 100)}" (${none.ride.taxiMin} min${none.ride.fare ? ', about €' + none.ride.fare.join('–') : ''})`) : fail('no safe train: ' + JSON.stringify(none).slice(0, 400));
  const al2 = await p.evaluate(() => window.__kairouteLiveTest.alerts().map(a => a.t).join(' | '));
  /Take a taxi now/.test(al2) ? ok('loud alert: Take a taxi now') : fail('no taxi alert: ' + al2);
  // Port agent's phone shows once the last train is gone.
  await p.evaluate(i => window.__kairouteTime.set(i, { portAgent: '+39 081 555 0100' }), D.i); await p.waitForTimeout(300);
  const ag = await p.evaluate(() => { const a = document.getElementById('cdAgent'); return a && !a.hidden ? a.textContent : ''; });
  /081 555 0100/.test(ag) ? ok('port agent phone shown with the taxi advice') : fail('port agent phone not shown: ' + ag);
  // Travel days: a countdown for every way of leaving (train, ferry, car or bus, flight), each with its own buffer.
  const dep = (await p.evaluate(() => window.__kairouteDays())).find(d => d.type === 'departure');
  if (dep) { const got = {};
    for (const [m, ic] of [['train', '🚆'], ['ferry', '⛴️'], ['car', '🚌'], ['flight', '✈️']]) {
      await p.evaluate(([i, m]) => { window.__kairouteTime.set(i, { mode: m }); window.__kairouteGo('plan', i); }, [dep.i, m]); await p.waitForTimeout(300);
      const r = await p.evaluate(i => { const c = document.getElementById('cdCard'); return c ? { s: c.querySelector('summary').textContent, by: window.__kairouteLiveTest.plan(i).endBy } : null; }, dep.i);
      if (!r || !r.s.includes(ic)) fail(`${m} travel day: no countdown (${JSON.stringify(r)})`); else got[m] = r.by;
    }
    got.flight < got.ferry && got.ferry < got.train && got.train < got.car ? ok(`travel days: be there by flight ${hm(got.flight)}, ferry ${hm(got.ferry)}, train ${hm(got.train)}, car or bus ${hm(got.car)} (latest safe arrival: the bigger the risk, the bigger the buffer)`) : fail('travel-day buffers out of order: ' + JSON.stringify(got));
  }
  console.log(fails ? `ride-check: ${fails} problem(s)` : `ride-check: all ${oks} checks passed`);
  await b.close(); srv.close(); process.exit(fails ? 1 : 0);
})();
