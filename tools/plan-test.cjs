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
  const b = await chromium.launch(); let fails = 0, warns = 0, days = 0, meters = 0;
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
    // Time meter: it adds up (visits + meals + getting around + arrival + picks that don't fit), never counts
    // bonus stops, and a day with nothing ticked shows the whole day free apart from getting to the hotel.
    for (const clear of [false, true]) {
      const ms = await p.evaluate(c => window.__kairouteMeter ? window.__kairouteMeter(c) : null, clear);
      if (!ms) { console.log('meter hook missing'); fails++; break; }
      for (const m of ms) {
        if (m.skip) continue; if (m.err) { console.log(`FAIL meter ${m.i}: ${m.err}`); fails++; continue; }
        const bad = [];
        if (Math.abs(m.settle + m.leave + m.visits + m.eat + m.moving + m.extra - m.used) > 1) bad.push(`parts don't add up (${m.settle}+${m.leave}+${m.visits}+${m.eat}+${m.moving}+${m.extra} vs ${m.used})`);
        if (clear && (m.visits || m.extra || m.bonus || m.stops || (!m.booked && (m.eat || m.moving > 2)))) bad.push(`cleared day still counts ${m.used} min (visits ${m.visits}, meals ${m.eat}, bonus ${m.bonus}, stops ${m.stops})`);
        if (bad.length) { fails++; console.log(`FAIL meter${clear ? ' (cleared)' : ''} ${m.date} ${m.dest}: ${bad.join('; ')}`); }
      }
      meters += ms.filter(m => !m.skip).length;
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
  console.log(`\nTime meter checked ${meters} times (every day as planned, and again with every stop unticked).`);
  console.log(`\n${days} days planned: ${fails} with problems, ${warns} travel-heavy warnings.`);
  // Stop times (Nov 16): a stop's time covers its guide at 150 words a minute plus a look around, and at a timed show
  // the plan arrives 10 min before the next show when none falls during the visit (waiting at most 30 min).
  { const p = await b.newPage(); await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + FILE); await p.waitForTimeout(600);
    const r = await p.evaluate(() => { const T = window.__kairouteStopTime, sh = { every: 60, first: '09:00', last: '23:00' }, words = n => Array(n).fill('word').join(' ');
      return { long: T.stopFloor({ minutes: 10, guide: words(1500) }), quick: T.stopFloor({ minutes: 10, quick: true, guide: words(100) }), parts: T.stopFloor({ minutes: 10, parts: [{ guide: words(300) }, { guide: words(300) }, { guide: words(300) }], partsOff: [2] }),
        during: T.showWait({ show: sh, minutes: 33 }, 10 * 60 + 30), before: T.showWait({ show: sh, minutes: 20 }, 10 * 60 + 25), far: T.showWait({ show: sh, minutes: 20 }, 10 * 60 + 5), short: T.short() }; });
    const chk = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
    console.log('\n== Stop times');
    chk(r.long === 20, `a 1,500-word guide gets 20 min (10 min to say it + 10 to look around): ${r.long}`);
    chk(r.quick === 10, `a quick sight with a short guide gets 10 min: ${r.quick}`);
    chk(r.parts === 15, `only the ticked parts count, plus a minute between parts: ${r.parts}`);
    chk(r.during === 0, `a show during the visit needs no wait: ${r.during}`);
    chk(r.before === 25, `no show during a 20-min visit from 10:25: wait to arrive 10:50 for the 11:00 show: ${r.before}`);
    chk(r.far === 0, `a 45-min wait for the next show isn't made: ${r.far}`);
    console.log(`stops whose guide time raised their planned time: ${r.short.length ? r.short.join('; ') : 'none'}`); await p.close(); }
  await b.close(); process.exit(fails ? 1 : 0);
})();
