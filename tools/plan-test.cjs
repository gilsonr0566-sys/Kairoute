// Planner quality test: plans every day of the example trips (Athens, the cruise ports, Barcelona, Madrid),
// a Corinth day trip from Athens, and a 3-day Corpus Christi trip, then fails on any day that
//  - goes back to an area it already left (backtracking between far-apart areas),
//  - sends you more than 25 minutes out of the way for a meal,
//  - repeats a restaurant on another day of the trip,
//  - runs past the end of the day.
// Travel-heavy days are reported as warnings. Usage: node tools/plan-test.cjs [path/to/index.html]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
(async () => {
  const b = await chromium.launch(); let fails = 0, warns = 0, days = 0;
  const run = async (label, setup) => {
    const p = await b.newPage(); p.on('pageerror', e => console.log('PAGE ERROR', e.message));
    await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + FILE); await p.waitForTimeout(600);
    if (setup) { await p.evaluate(setup.fn, setup.arg); await p.reload(); await p.waitForTimeout(600); }
    const pre = setup && setup.after ? await p.evaluate(setup.after.fn, setup.after.arg) : null;
    const q = await p.evaluate(() => window.__kairouteQuality ? window.__kairouteQuality() : null);
    if (!q) { console.log(label + ': quality hook missing'); fails++; await p.close(); return; }
    console.log('\n== ' + label);
    const seen = new Map();
    for (const d of q) {
      if (d.skip) continue; days++;
      const issues = (d.issues || []).slice();
      (d.mealKeys || []).forEach(k => { if (seen.has(k) && seen.get(k) !== d.i) issues.push('repeats restaurant ' + k); seen.set(k, d.i); });
      const softRe = /^(travel |free |\d+ crossing)/, hard = issues.filter(x => !softRe.test(x)), soft = issues.filter(x => softRe.test(x));
      fails += hard.length ? 1 : 0; warns += soft.length ? 1 : 0;
      console.log(`${hard.length ? 'FAIL' : soft.length ? 'WARN' : 'ok  '} ${d.date} ${d.dest}: ${d.stops} stops, ends ${d.end} (by ${d.endBy})${d.meals.length ? ' | ' + d.meals.join('; ') : ''}${d.dropped.length ? ' | did not fit: ' + d.dropped.join(', ') : ''}${issues.length ? ' | ' + issues.join('; ') : ''}`);
    }
    await p.close();
  };
  await run('Example trip: Athens, cruise ports, Barcelona, Madrid');
  await run('Corinth day trip from Athens (Corinth Canal, Ancient Corinth, Acrocorinth), 10 hours', { fn: () => {}, after: { fn: () => window.__kairouteDay(3, 'corinth|acrocorinth', { hours: 10 }), arg: null } });
  await run('Overfilled Athens day: Corinth sights plus Delphi and Sounion in other directions, 8 hours', { fn: () => {}, after: { fn: () => window.__kairouteDay(3, 'corinth|acrocorinth|delphi|sounion', { hours: 8 }), arg: null } });
  // Tables the traveler booked: pinned at their time, and the route reshapes around them.
  await run('Corinth day trip with lunch booked in Ancient Corinth at 13:30', { fn: () => {}, after: { fn: () => window.__kairouteDay(3, 'corinth|acrocorinth', { hours: 10, booked: { Lunch: { name: 'Booked taverna in Ancient Corinth', lat: 37.9069, lng: 22.8786, time: '13:30' } } }), arg: null } });
  await run('Athens day with lunch booked in Plaka at 12:15 and dinner at 20:30', { fn: () => {}, after: { fn: () => window.__kairouteDay(1, null, { booked: { Lunch: { name: 'Booked lunch in Plaka', lat: 37.9725, lng: 23.7300, time: '12:15' }, Dinner: { name: 'Booked dinner in Psyrri', lat: 37.9780, lng: 23.7240, time: '20:30' } } }), arg: null } });
  const cc = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'corpus.json'))); const key = Object.keys(cc.cities)[0];
  await run('Corpus Christi, 3 days', { fn: ([city, key]) => { localStorage.setItem('wayside.cities', JSON.stringify({ [key]: city }));
    const day = i => ({ id: 'd' + (900 + i), date: '2026-11-1' + (1 + i), destination: 'Corpus Christi', type: 'land', mode: 'car', time: '09:00', pointIdx: 0, startTime: '09:00', hours: 8, alongWay: true, returnToStart: true, event: '', selected: null, cityKey: key });
    localStorage.setItem('wayside.trip2', JSON.stringify({ id: 't', name: 'Corpus', style: 'mix', active: 0, days: [day(0), day(1), day(2)], lodging: {}, journal: {}, prefs: { pace: 'moderate', walk: 'medium', interests: [], travelers: '', access: 'none', party: 2, lang: 'English' } })); }, arg: [cc.cities[key], key] });
  // All or something: a short day with more picks than time keeps as many as fit, must-sees first, never none.
  { const p = await b.newPage(); await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort()); await p.goto('file://' + FILE); await p.waitForTimeout(600);
    for (const h of [1, 2.5]) {
      const o = await p.evaluate(h => window.__kairouteDay(0, 'plaka and|syntagma|athens cathedral|national garden', { hours: h }), h);
      const stops = o.items.filter(x => / stop: /.test(x)), plaka = stops.some(x => /Plaka and/.test(x)), need = h >= 2.5 ? 3 : 1;
      const ok = stops.length >= need && plaka; if (!ok) fails++; days++;
      console.log(`\n== Arrival day, 4 central Athens picks, ${h} h to sightsee\n${ok ? 'ok  ' : 'FAIL'} keeps ${stops.length} of 4 (needs ${need}+, the must-see Plaka first)${o.dropped.length ? ' | did not fit: ' + o.dropped.join(', ') : ''}`);
    }
    await p.close(); }
  console.log(`\n${days} days planned: ${fails} with problems, ${warns} travel-heavy warnings.`);
  await b.close(); process.exit(fails ? 1 : 0);
})();
