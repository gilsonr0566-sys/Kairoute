// Prints the Day plan text of one day of a SAVED TEST TRIP (tools/beta2/corpus) on a live build, as a traveler sees it on
// a phone, so an escape found on a test trip (not the example trip) can be confirmed fixed, or not, on the live app.
// The trip is put on the device the way tools/client/steady-all.cjs does. The app asks its own helper as usual (street
// routes, islands): this is the plan a traveler gets.
// env: URL (default Beta 2 live), TRIP = corpus file name (e.g. g09-kotor), DAY = day number, 1 = first (default 2),
//   PICKS = optional sight ids the traveler picked that day (comma-separated).
'use strict';
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const URL = process.env.URL || 'https://gilsonr0566-sys.github.io/Kairoute-Beta2/', TRIP = process.env.TRIP || 'g09-kotor', DAY = +(process.env.DAY || 2) - 1;
const c = JSON.parse(fs.readFileSync(path.join(__dirname, 'beta2', 'corpus', TRIP + '.json'), 'utf8'));
const days = c.days.map(d => { const x = Object.assign({}, d); delete x.i; delete x.sites; delete x.wx; delete x.missing; delete x.order;
  if ((/port|embark/.test(d.type) || /ship|ferry/.test(d.mode || '')) && d.point && !d.point.unknown && !x.pier) x.pier = { name: d.point.name, lat: d.point.lat, lng: d.point.lng }; /* the pier or ferry terminal the traveler names from their documents, as the app asks */
  for (const k of ['portArrive', 'allAboard', 'boardAt', 'startTime', 'time']) if (typeof x[k] === 'number') x[k] = String(Math.floor(x[k] / 60)).padStart(2, '0') + ':' + String(x[k] % 60).padStart(2, '0'); /* the corpus keeps engine minutes, the app keeps clock times */
  if (process.env.PICKS && /^src-|^q\d/.test(process.env.PICKS) && c.days.indexOf(d) === DAY) { x.selected = process.env.PICKS.split(','); x.ownList = true; } /* PICKS: the traveler's own list for that day (comma-separated sight ids) */
  x.cityKey = d.city; x.destination = d.city && c.cities[d.city] ? c.cities[d.city].name : d.destination || ''; return x; });
const seed = { trip: JSON.stringify({ id: 'live-' + TRIP, name: c.name || TRIP, style: c.style || 'mix', active: DAY, days, lodging: {}, journal: {}, prefs: c.prefs || {}, legModes: c.legModes || {} }), cities: JSON.stringify(c.cities) };
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
  p.on('pageerror', e => console.log('PAGE ERROR ' + e.message)); p.on('console', m => { if (/error|warn/.test(m.type())) console.log('CONSOLE ' + m.type() + ' ' + m.text().slice(0, 300)); });
  await p.addInitScript(s => { try { const ls = localStorage; if (ls.getItem('b2:__copied')) return; ls.setItem('b2:__copied', '1'); ls.setItem('b2:__merged2', '1');
    ls.setItem('b2:wayside.trip2', s.trip); ls.setItem('b2:wayside.cities', s.cities); ls.setItem('b2:kairoute.lobbySeen', '1');
    ['intro1', 'sunprincess1', 'spread1', 'bible1', 'coach1', 'coachDone', 'tourTip'].forEach(k => ls.setItem('b2:kairoute.' + k, '1')); } catch (e) {} }, seed);
  await p.goto(URL + (URL.includes('?') ? '&' : '?') + 'v=' + Date.now(), { waitUntil: 'load' }); await p.waitForTimeout(3000);
  console.log('VERSION ' + await p.evaluate(() => fetch('version.txt?v=' + Date.now(), { cache: 'no-store' }).then(r => r.text()).catch(() => '?')));
  const n = await p.evaluate(() => window.__kairouteDays ? window.__kairouteDays().length : 0).catch(() => 0);
  if (!n) { console.log('TRIP NOT LOADED'); await b.close(); process.exit(1); }
  // PICKS by name (the sights list on the live app can carry other ids than the saved trip): read the ids off the
  // live list's own tick boxes ("Pick <name>") and make them the day's own list.
  const names = (process.env.PICKS || '').split(',').filter(x => x && !/^src-|^q\d/.test(x));
  if (names.length) { await p.evaluate(i => window.__kairouteGo('sites', i), DAY);
    for (let t = 0; t < 30; t++) { await p.waitForTimeout(3000); const r = await p.evaluate(([i, re]) => window.__kairouteDay(i, re, { ownList: true }), [DAY, names.join('|')]).catch(() => null); // the live guide arrives from the helper
      if (r && !Array.isArray(r)) { console.log('PICKED ' + names.join('|')); break; } if (t === 29) console.log('PICKED [] LIVE LIST ' + JSON.stringify(r)); } }
  await p.evaluate(i => window.__kairouteGo('plan', i), DAY); await p.waitForTimeout(+process.env.WAIT || 45000); // helper answers (routes, islands) arrive
  await p.evaluate(() => document.querySelectorAll('#view details').forEach(d => { d.open = true; })).catch(() => {});
  console.log(`\n===== ${TRIP} day ${DAY + 1} ${days[DAY].destination} (${days[DAY].type}) =====\n` + await p.evaluate(() => (document.querySelector('main') || document.body).innerText));
  if (process.env.DUMP) { const b = await p.evaluate(() => JSON.stringify(window.__kairouteBucket ? window.__kairouteBucket() : null)).catch(e => 'null'); console.log('BUCKET_GZ ' + require('zlib').gzipSync(String(b)).toString('base64')); } // DUMP=1: the day's bucket as the live app planned it (its helper answers), to replan offline
  if (process.env.ROUTES) console.log('ROUTE TIMES ' + JSON.stringify(await p.evaluate(() => window.__kairouteRouteTimes ? window.__kairouteRouteTimes() : null))); // ROUTES=1: the street routes the app holds
  await b.close(); })();
