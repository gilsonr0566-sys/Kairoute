// Beta 2: saves the facts the new engine plans from, and the old engine's plans, for each test trip.
// Runs the built app offline (no internet, no AI). Usage: ./build.sh && node tools/beta2/snapshot.cjs [index.html]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'index.html'));
const OUT = path.join(__dirname, 'snapshots'); fs.mkdirSync(OUT, { recursive: true });
const cc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'corpus.json'))); const ccKey = Object.keys(cc.cities)[0];
const TRIPS = [
  { name: 'sample-cruise', label: 'Sample trip: Athens, cruise ports, Barcelona, Madrid' },
  { name: 'corinth-day', label: 'Corinth day trip from Athens, 10 hours', after: () => window.__kairouteDay(3, 'corinth|acrocorinth', { hours: 10 }) },
  { name: 'athens-overfilled', label: 'Overfilled Athens day, 8 hours', after: () => window.__kairouteDay(3, 'corinth|acrocorinth|delphi|sounion', { hours: 8 }) },
  { name: 'athens-booked', label: 'Athens day with lunch and dinner booked', after: () => window.__kairouteDay(1, null, { booked: { Lunch: { name: 'Booked lunch in Plaka', lat: 37.9725, lng: 23.7300, time: '12:15' }, Dinner: { name: 'Booked dinner in Psyrri', lat: 37.9780, lng: 23.7240, time: '20:30' } } }) },
  { name: 'athens-short', label: 'Arrival day, 4 central Athens picks, 2.5 h', after: () => window.__kairouteDay(0, 'plaka and|syntagma|athens cathedral|national garden', { hours: 2.5 }) },
  { name: 'corpus-christi', label: 'Corpus Christi, 3 days (US city, guide from sources)', setup: ([city, key]) => { localStorage.setItem('wayside.cities', JSON.stringify({ [key]: city }));
      const day = i => ({ id: 'd' + (900 + i), date: '2026-11-1' + (1 + i), destination: 'Corpus Christi', type: 'land', mode: 'car', time: '09:00', pointIdx: 0, startTime: '09:00', hours: 8, alongWay: true, returnToStart: true, event: '', selected: null, cityKey: key });
      localStorage.setItem('wayside.trip2', JSON.stringify({ id: 't', name: 'Corpus', style: 'mix', active: 0, days: [day(0), day(1), day(2)], lodging: {}, journal: {}, prefs: { pace: 'moderate', walk: 'medium', interests: [], travelers: '', access: 'none', party: 2, lang: 'English' } })); }, arg: [cc.cities[ccKey], ccKey] },
];
(async () => {
  const b = await chromium.launch(); let bad = 0;
  for (const t of TRIPS) {
    const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + FILE); await p.waitForTimeout(600);
    if (t.setup) { await p.evaluate(t.setup, t.arg); await p.reload(); await p.waitForTimeout(800); }
    // A day that arrives at or leaves from a place with more than one real port, station or airport asks which; the test
    // traveler has answered with the first one listed, as the saved trips always did (the asking itself is checked on the phone).
    if (await p.evaluate(() => { const k = 'wayside.trip2', t = JSON.parse(localStorage.getItem(k) || 'null'); if (!t || !t.days) return false; t.days.forEach(d => { d.pointPicked = true; }); localStorage.setItem(k, JSON.stringify(t)); return true; })) { await p.reload(); await p.waitForTimeout(800); }
    if (t.after) await p.evaluate(t.after);
    // A day that arrives at or leaves from a place with more than one real port, station or airport asks which; the test
    // traveler answers with the first one listed, as the saved trips always did (the asking itself is checked on the phone).
    const snap = await p.evaluate(() => window.__kairouteBucket ? window.__kairouteBucket(true) : null);
    if (!snap) { console.log('FAIL ' + t.name + ': bucket hook missing'); bad++; await p.close(); continue; }
    snap.name = t.name; snap.label = t.label;
    fs.writeFileSync(path.join(OUT, t.name + '.json'), JSON.stringify(snap));
    const days = snap.old.filter(x => !x.error).length;
    console.log(`ok   ${t.name}: ${snap.days.length} days (${days} planned by the old engine)${errs.length ? ' | page errors: ' + errs.join('; ') : ''}`);
    await p.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
