// Beta 2 dry runs on places the app was never tuned for. The app is built and run with AI OFF. Its helper calls go to
// the real helper, but only the free, no-AI lookups pass (sources, fame, map places, rides, weather); everything else
// (AI text, voices, Google ratings, sync) is refused here, so nothing counts against the AI cap or any paid allowance.
// Prints a summary per day and the raw source answers (gzip+base64) so they can be saved as offline fixtures.
// Runs on GitHub Actions (beta2-live.yml). Usage: ONLY=live-hamburg-stay node tools/beta2/live-trip.cjs [built index.html]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const zlib = require('zlib');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'index.html'));
// The helper address: the CI test stand-in when tools/test-helper.sh pointed ai.json at it (repeat asks then never
// reach the live helper), else the live helper itself.
const AIJ = (() => { try { return JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'ai.json'), 'utf8')).url || ''; } catch (e) { return ''; } })();
const REAL = /^http:\/\/localhost:\d+\/workers\.dev$/.test(AIJ) ? AIJ : 'https://kairoute-ai.rickgilson.workers.dev', MOCK = 'https://mock.test';
const PASS = new Set(['/sources', '/famous', '/ground', '/places', '/transit', '/route', '/departures', '/ferries', '/weather', '/facts', '/osm', '/findplace', '/nearsights', '/verify', '/bookcheck', '/voyage']);
const K = require('./engine.cjs'); const E = K.KEngine || K;
const OUT = path.join(__dirname, 'snapshots'); fs.mkdirSync(OUT, { recursive: true });
const raw = {}, calls = {}, refused = {};
async function helper(r) {
  const req = r.request(), u = new URL(req.url());
  if (u.pathname === '/status') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, on: false, left: 0, budget: 0 }) });
  if (!PASS.has(u.pathname)) { refused[u.pathname] = (refused[u.pathname] || 0) + 1; return r.fulfill({ status: 429, body: '{"error":"off in this test"}' }); }
  calls[u.pathname] = (calls[u.pathname] || 0) + 1;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(REAL + u.pathname + u.search, { method: req.method(), headers: { 'content-type': 'application/json', origin: 'https://gilsonr0566-sys.github.io' }, body: req.method() === 'POST' ? req.postData() : undefined, signal: AbortSignal.timeout(+process.env.HELPER_WAIT || 45000) });
      const body = await res.text();
      if (res.ok) { if (/^\/(sources|famous|transit|ground)$/.test(u.pathname)) (raw[u.pathname] = raw[u.pathname] || []).push({ q: u.search, post: req.postData() || null, body: JSON.parse(body) }); return r.fulfill({ status: 200, contentType: 'application/json', body }); }
      if (res.status < 500) return r.fulfill({ status: res.status, contentType: 'application/json', body });
    } catch (e) { console.log('helper', u.pathname, e.message); }
    await new Promise(x => setTimeout(x, 3000));
  }
  return r.fulfill({ status: 502, body: '{}' });
}
const prefs = { pace: 'moderate', walk: 'medium', interests: [], travelers: '', access: 'none', party: 2, lang: 'English' };
let seq = 0; const day = o => Object.assign({ id: 'd' + (++seq), date: '2027-05-11', destination: '', type: 'land', mode: 'flight', time: '09:00', pointIdx: 0, startTime: '09:00', hours: 8, alongWay: true, returnToStart: true, selected: null }, o);
const sea = date => day({ date, destination: 'At sea', type: 'sea' });
const port = (date, destination, arrive, aboard, extra) => day(Object.assign({ date, destination, type: 'port', portArrive: arrive, allAboard: aboard }, extra || {}));
const stay = (dates, destination) => dates.map(date => day({ date, destination }));
// The build-gate yardstick (Richard, Nov 18): 20 places, each testing something specific, plus the first live runs.
const TRIPS = [
  { name: 'live-hamburg-stay', batch: 0, label: 'Hamburg: 3-day land stay (Tue to Thu)', days: stay(['2027-05-11', '2027-05-12', '2027-05-13'], 'Hamburg, Germany') },
  { name: 'live-hamburg-port', batch: 0, label: 'Hamburg: cruise call on a Sunday', days: [sea('2027-05-15'), port('2027-05-16', 'Hamburg, Germany', '08:00', '18:00')] },
  { name: 'live-nassau', batch: 0, label: 'Nassau: cruise call', days: [sea('2027-01-11'), port('2027-01-12', 'Nassau, Bahamas', '08:00', '17:00')] },
  { name: 'live-cococay', batch: 0, label: "CocoCay: cruise line's private island", days: [sea('2027-01-13'), port('2027-01-14', 'Perfect Day at CocoCay, Bahamas', '07:00', '17:00')] },
  { name: 'g01-istanbul', batch: 1, label: 'Istanbul: Thu+Fri stay (ferries, two continents, Friday prayers)', days: stay(['2027-05-13', '2027-05-14'], 'Istanbul, Turkey') },
  { name: 'g02-vienna', batch: 5, label: 'Vienna: Mon+Tue stay (groups inside groups, Monday closures)', days: stay(['2027-05-10', '2027-05-11'], 'Vienna, Austria') },
  { name: 'g03-lisbon', batch: 1, label: 'Lisbon: Mon+Tue stay (hills, trams, walking effort)', days: stay(['2027-05-10', '2027-05-11'], 'Lisbon, Portugal') },
  { name: 'g04-barcelona', batch: 1, label: 'Barcelona: Sunday cruise call (timed tickets)', days: [sea('2027-05-15'), port('2027-05-16', 'Barcelona, Spain', '08:00', '18:00')] },
  { name: 'g05-edinburgh', batch: 5, label: 'Edinburgh: August stay (hilltop castle, festival crowds)', days: stay(['2027-08-10', '2027-08-11'], 'Edinburgh, Scotland') },
  { name: 'g06-kyoto', batch: 2, label: 'Kyoto: April stay (non-Latin names, early temple closing, spread out)', days: stay(['2027-04-06', '2027-04-07'], 'Kyoto, Japan') },
  { name: 'g07-lehavre', batch: 5, label: 'Le Havre for Paris: Saturday call (long train, tight ship time)', days: [sea('2027-06-11'), port('2027-06-12', 'Le Havre (Paris), France', '07:00', '19:00')] },
  { name: 'g08-southampton', batch: 5, label: 'Southampton: fly in, board next day', days: [day({ date: '2027-05-20', destination: 'Southampton, England', type: 'arrival', mode: 'flight', time: '13:00', hours: 5 }), day({ date: '2027-05-21', destination: 'Southampton, England', type: 'embark', startTime: '09:00', allAboard: '16:00' })] },
  { name: 'g09-kotor', batch: 2, label: 'Kotor: July tender call (fortress climb, heat)', days: [sea('2027-07-07'), port('2027-07-08', 'Kotor, Montenegro', '08:00', '17:00', { tender: true })] },
  { name: 'g10-dubrovnik', batch: 2, label: 'Dubrovnik: July call (timed walls, crowds)', days: [sea('2027-07-08'), port('2027-07-09', 'Dubrovnik, Croatia', '08:00', '18:00')] },
  { name: 'g11-juneau', batch: 3, label: 'Juneau: June call (no roads out, tours)', days: [sea('2027-06-14'), port('2027-06-15', 'Juneau, Alaska', '07:00', '20:00')] },
  { name: 'g12-ketchikan', batch: 3, label: 'Ketchikan: short call (tiny town, rain)', days: [sea('2027-06-15'), port('2027-06-16', 'Ketchikan, Alaska', '06:00', '13:00')] },
  { name: 'g13-grandturk', batch: 3, label: 'Grand Turk: call (almost no data)', days: [sea('2027-02-09'), port('2027-02-10', 'Grand Turk, Turks and Caicos', '08:00', '17:00')] },
  { name: 'g14-mykonos', batch: 3, label: 'Mykonos: tender call into the evening (tiny streets)', days: [sea('2027-07-01'), port('2027-07-02', 'Mykonos, Greece', '10:00', '23:00', { tender: true })] },
  { name: 'g15-pontadelgada', batch: 3, label: 'Ponta Delgada: call (thin island data)', days: [sea('2027-04-19'), port('2027-04-20', 'Ponta Delgada, Azores', '08:00', '17:00')] },
  { name: 'g16-halfmooncay', batch: 5, label: 'Half Moon Cay: second private island (tender)', days: [sea('2027-02-11'), port('2027-02-12', 'Half Moon Cay, Bahamas', '08:00', '16:00', { tender: true })] },
  { name: 'g17-haifa', batch: 4, label: 'Jerusalem from Haifa: Saturday call (Sabbath closures)', days: [sea('2027-05-14'), port('2027-05-15', 'Haifa (Jerusalem), Israel', '06:00', '20:00')] },
  { name: 'g18-reykjavik', batch: 4, label: 'Reykjavik: January stay (day trips, winter dark)', days: stay(['2027-01-19', '2027-01-20'], 'Reykjavik, Iceland') },
  { name: 'g19-venice', batch: 4, label: 'Venice: Sat+Sun stay (no cars, water buses, entry-fee days)', days: stay(['2027-05-15', '2027-05-16'], 'Venice, Italy') },
  { name: 'g20-dubai', batch: 4, label: 'Dubai: July stay (extreme heat, big distances)', days: stay(['2027-07-20', '2027-07-21'], 'Dubai, UAE') },
  // Boats (E8, Nov 25: the boat rule ran on one saved trip only, Mykonos to Delos): ship days with an island only a boat
  // reaches on the traveler's own list, island hops on land days, and arriving and leaving by ferry, in several regions.
  // pick: a pattern for the sights the traveler ticks on the first shore day (their own list, so the boat is their choice).
  { name: 'f01-naples-capri', batch: 6, label: 'Naples: cruise call, the traveler picks Capri (ship day, island by boat)', pick: 'capri', days: [sea('2027-06-09'), port('2027-06-10', 'Naples, Italy', '07:00', '19:00')] },
  { name: 'f02-split-hvar', batch: 6, label: 'Split: cruise call, the traveler picks Hvar (ship day, catamaran)', pick: 'hvar', days: [sea('2027-07-14'), port('2027-07-15', 'Split, Croatia', '08:00', '18:00')] },
  { name: 'f03-seattle-bainbridge', batch: 6, label: 'Seattle: cruise turnaround call, the traveler picks Bainbridge Island (car ferry)', pick: 'bainbridge', days: [sea('2027-06-19'), port('2027-06-20', 'Seattle, Washington', '07:00', '16:30')] },
  { name: 'f04-stockholm-vaxholm', batch: 6, label: 'Stockholm: cruise call, the traveler picks Vaxholm (archipelago boat)', pick: 'vaxholm|fjäderholm', days: [sea('2027-06-22'), port('2027-06-23', 'Stockholm, Sweden', '08:00', '17:00')] },
  { name: 'f05-istanbul-princes', batch: 7, label: "Istanbul: stay with the Princes' Islands, then fly home (island hop, plane day)", pick: 'princes|büyükada|buyukada', days: [day({ date: '2027-05-13', destination: 'Istanbul, Turkey' }), day({ date: '2027-05-14', destination: 'Istanbul, Turkey', type: 'departure', mode: 'flight', time: '19:30' })] },
  { name: 'f06-hongkong-lantau', batch: 7, label: 'Hong Kong: stay with Lantau and the Star Ferry, then fly home', pick: 'lantau|big buddha|tian tan|star ferry', days: [day({ date: '2027-03-09', destination: 'Hong Kong' }), day({ date: '2027-03-10', destination: 'Hong Kong', type: 'departure', mode: 'flight', time: '18:00' })] },
  { name: 'f07-helsinki-ferry', batch: 7, label: 'Helsinki: arrive by ferry from Tallinn, Suomenlinna, leave by ferry next day', pick: 'suomenlinna', days: [day({ date: '2027-06-08', destination: 'Helsinki, Finland', type: 'arrival', mode: 'ferry', time: '10:30', hours: 7 }), day({ date: '2027-06-09', destination: 'Helsinki, Finland', type: 'departure', mode: 'ferry', time: '17:30' })] },
  { name: 'f08-sydney-manly', batch: 7, label: 'Sydney: cruise call, the traveler picks Manly (harbour ferry)', pick: 'manly', days: [sea('2027-02-15'), port('2027-02-16', 'Sydney, Australia', '07:00', '18:00')] },
];
const hm = m => m == null ? '--:--' : String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.round(m % 60)).padStart(2, '0');
(async () => {
  const b = await chromium.launch();
  for (const t of TRIPS.filter(t => (!process.env.ONLY || process.env.ONLY.split(',').includes(t.name)) && (process.env.BATCH == null || String(t.batch) === process.env.BATCH))) {
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', r => { const u = r.request().url(); if (u.startsWith(MOCK)) return helper(r); return /^file:/.test(u) ? r.continue() : r.abort(); });
    await p.goto('file://' + FILE);
    const first = t.days.findIndex(d => d.type !== 'sea');
    console.log('\n>>> starting ' + t.name);
    await p.evaluate(([days, prefs, a]) => { localStorage.setItem('kairoute.intro1', '1'); localStorage.setItem('wayside.trip2', JSON.stringify({ id: 't-' + days[0].id, name: 'Test', style: 'mix', active: a, lodging: {}, journal: {}, prefs, days })); }, [t.days, prefs, first]);
    await p.reload(); await p.waitForTimeout(500);
    await p.evaluate(m => window.__kairouteMockHelper(m, null, true), MOCK);
    await p.evaluate(i => window.__kairouteAt(i, 'plan'), first); await p.waitForTimeout(300);
    const btn = p.locator('[data-act="gen"]').first();
    if (await btn.isVisible().catch(() => false)) await btn.click();
    await p.waitForFunction(i => { const s = window.__kairouteState(); return !s.busy && !!window.__kairouteCityOf(i); }, first, { timeout: +process.env.GUIDE_WAIT || 150000 }).catch(() => console.log('  (timed out waiting for the guide)'));
    await p.waitForTimeout(8000);
    // The traveler's own picks on the first shore day (a boat they choose, not one the guide suggests).
    if (t.pick) { const r = await p.evaluate(([i, re]) => window.__kairouteDay(i, re, { ownList: true }), [first, t.pick]).catch(e => 'error ' + e.message);
      console.log('  picked (' + t.pick + '): ' + (Array.isArray(r) ? 'NONE MATCHED; the list: ' + r.slice(0, 40).join(' | ') : JSON.stringify(r).slice(0, 200))); await p.waitForTimeout(8000); }
    const snap = await p.evaluate(() => window.__kairouteBucket(true)); snap.name = t.name; snap.label = t.label;
    fs.writeFileSync(path.join(OUT, t.name + '.json'), JSON.stringify(snap));
    console.log('\n===== ' + t.label + (errs.length ? ' | page errors: ' + [...new Set(errs)].join('; ') : ''));
    for (const d of snap.days) {
      if (d.type === 'sea') continue;
      const c = snap.cities[d.city] || {}; const sites = (c.sites || []).concat(c.farther || []);
      console.log(`-- day ${d.i} ${d.date} ${d.type} noShore=${!!d.noShore} city=${c.name || d.city} start=${JSON.stringify(d.point)} window ${hm(d.portArrive)}-${hm(d.allAboard)} missing=${JSON.stringify(d.missing)}`);
      if (d.i === first) {
        console.log(`   ${(c.sites || []).length} sights, ${(c.farther || []).length} farther, ${(c.restaurants || []).length} restaurants, srcGuide=${c.srcGuide}`);
        sites.slice(0, 40).forEach(x => { const sd = (d.sites || {})[x.id] || {}; console.log(`   ${x.id} | ${x.name} | ${x.lat},${x.lng} | ${x.min || x.minutes}m | ${x.category || ''} | ${(x.tags || []).join(',')} | in:${(x.in || []).join(',')} | hours:${sd.oh ? JSON.stringify(sd.oh.spans) : '?'}${sd.closed ? ' CLOSED' : ''}`); });
        (c.restaurants || []).slice(0, 12).forEach(x => console.log(`   eat | ${x.name} | ${x.lat},${x.lng} | ${x.cuisine || ''}`));
        const g = E.makeGroups(sites); console.log('   GROUPS', JSON.stringify(g.members));
      }
      const o = snap.old[d.i] || {}; if (o.error) { console.log('   OLD ERROR', o.error); continue; }
      console.log(`   old plan: start ${hm(o.start)} back by ${hm(o.endBy)} ends ${hm(o.end)} dropped=${JSON.stringify(o.dropped || [])} closedToday=${JSON.stringify(o.closedToday || [])}`);
      (o.items || []).forEach(it => console.log(it.t === 'ride' ? `        ~ ${it.mode} ${it.min}m ${(+it.km || 0).toFixed(1)}km` : `   ${hm(it.at)} ${it.t} ${it.name || ''} ${it.min || ''}${it.late ? ' LATE' : ''}`));
    }
    await p.close();
  }
  await b.close();
  console.log('\nhelper calls passed:', JSON.stringify(calls), ' refused:', JSON.stringify(refused));
  const z = zlib.gzipSync(JSON.stringify(raw)).toString('base64');
  console.log('RAW-BEGIN'); for (let i = 0; i < z.length; i += 2000) console.log('RAW ' + z.slice(i, i + 2000)); console.log('RAW-END');
})();
