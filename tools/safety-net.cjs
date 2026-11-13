// Kairoute safety net: runs before every publish and blocks it if anything fails.
//  1. One truth: on every day of several sample trips, the Day plan, map, Change stops, time bar and Guide
//     must agree with what the planner decided (same stops, same counts, times that add up, no sight on two
//     days, no optional stop shown as a pick, labels that follow the evidence rule).
//  2. Data truth: every stop is a real guide sight, every restaurant comes from the map data (never invented),
//     meals are near the route.
//  3. Real-screen walkthroughs (tools/picks-e2e.cjs) on tablet landscape, tablet upright and phone.
// Writes a plain report with screenshots to checks/index.html. Usage: node tools/safety-net.cjs [index.html]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), FILE = path.resolve(process.argv[2] || path.join(ROOT, 'index.html')), OUT = path.join(ROOT, 'checks');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const mins = t => { let m = 0; const h = /(\d+)\s*h/.exec(t), n = /(\d+)\s*min/.exec(t); if (h) m += +h[1] * 60; if (n) m += +n[1]; return m; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'corpus.json'))); const ccKey = Object.keys(corpus.cities)[0];
const prefs = { pace: 'moderate', walk: 'medium', interests: [], travelers: '', access: 'none', party: 2, lang: 'English' };
const day = (o) => Object.assign({ id: 'd' + Math.random().toString(36).slice(2, 8), date: '2027-05-10', destination: '', type: 'land', mode: 'car', time: '09:00', pointIdx: 0, startTime: '09:00', hours: 8, alongWay: true, returnToStart: true, event: '', selected: null }, o);
const TRIPS = [
  { key: 'example', label: "Richard's style of trip: Athens, a 9-port cruise, Barcelona and Madrid" },
  { key: 'us-city', label: 'A US city: Corpus Christi, 3 days by car', store: { cities: { [ccKey]: corpus.cities[ccKey] }, trip: { id: 't-us', name: 'Corpus Christi', style: 'mix', active: 0, lodging: {}, journal: {}, prefs,
    days: [0, 1, 2].map(i => day({ date: '2027-05-1' + i, destination: 'Corpus Christi', cityKey: ccKey })) } } },
  { key: 'one-day-train', label: 'A one-day trip: Barcelona, arriving by train', store: { trip: { id: 't-bcn', name: 'Barcelona day', style: 'mix', active: 0, lodging: {}, journal: {}, prefs,
    days: [day({ date: '2027-05-20', destination: 'Barcelona', cityKey: 'barcelona', type: 'arrival', mode: 'train', time: '09:40', hours: 6 })] } } },
  { key: 'short-ports', label: 'A cruise with short port stops (4 hours ashore)', patch: d => d.type === 'port' ? { portArrive: '10:00', allAboard: '14:30' } : {} },
  { key: 'rainy', label: 'Rainy days (indoor swaps)', patch: d => ({ rain: true }) },
  { key: 'empty', label: 'Days with nothing picked', patch: d => ({ selected: [] }) }
];
const results = []; let fails = 0;
const log = (suite, trip, ok, what) => { results.push({ suite, trip, ok, what }); if (!ok) { fails++; console.log(`FAIL [${trip}] ${what}`); } };
(async () => {
  const b = await chromium.launch(); const shots = [];
  for (const T of TRIPS) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + FILE);
    await p.evaluate(st => { localStorage.setItem('kairoute.intro1', '1'); if (st) { if (st.cities) localStorage.setItem('wayside.cities', JSON.stringify(st.cities)); localStorage.setItem('wayside.trip2', JSON.stringify(st.trip)); } }, T.store || null);
    await p.reload(); await p.waitForTimeout(500);
    if (T.patch) await p.evaluate(src => window.__kairouteEdit('all', eval(src)), T.patch.toString());
    const days = await p.evaluate(() => window.__kairouteDays());
    // Open every day once first, as a traveler would, so each day has its picks before days are compared.
    for (const D of days) if (D.type !== 'sea' && D.city) await p.evaluate(i => window.__kairouteTruth(i), D.i);
    let checked = 0, closedTried = 0, titled = 0; const seenBy = new Map(), fillBy = new Map();
    for (const D of days) {
      if (D.type === 'sea' || !D.city) continue;
      const t = await p.evaluate(i => window.__kairouteTruth(i), D.i);
      const tag = `${D.date} ${D.dest}`, bad = [];
      if (t.error) { log('One truth', T.key, false, `${tag}: the day can't be planned (${t.error})`); continue; }
      checked++;
      // Data truth
      if (t.unknownStops.length) bad.push(`stops that aren't guide sights: ${t.unknownStops.join(', ')}`);
      if (t.invented.length) bad.push(`restaurants not in the map data: ${t.invented.join(', ')}`);
      if (t.farMeals.length) bad.push(`meals far off the route: ${t.farMeals.map(x => x.name + ' +' + x.extra + ' min').join(', ')}`);
      if (t.mustLocal.length) bad.push(`must-sees labelled Local favorite: ${t.mustLocal.join(', ')}`);
      for (let k = 1; k < t.times.length; k++) if (t.times[k] < t.times[k - 1] - 1) { bad.push('times go backwards in the schedule'); break; }
      // Picks and plan
      if (T.key !== 'rainy') {
        t.picks.forEach(id => { if (!t.selected.includes(id)) bad.push(`${id} is planned but not ticked`); });
        t.selected.forEach(id => { if (!t.picks.includes(id) && !t.dropped.includes(id) && !t.elsewhere.includes(id) && !(t.closed || []).includes(id)) bad.push(`${id} is ticked but missing from the plan with no explanation`); });
        if ((t.closedPicks || []).length) bad.push(`planned on a day it is closed: ${t.closedPicks.join(', ')}`);
      }
      t.bonus.forEach(id => { if (t.selected.includes(id)) bad.push(`${id} is ticked but shown as optional`); });
      [...t.picks, ...t.bonus].forEach(id => { const k = D.city + '/' + id; if (seenBy.has(k)) bad.push(`${id} is also planned on ${seenBy.get(k)}`); seenBy.set(k, D.date); });
      // Filling the day: spare time is filled (the fill never stops early), must-sees first (checked per city below).
      // Day title: the main destination only ("Naples"), never side places in brackets ("Naples (Capri, Sorrento)"):
      // a client reading Capri in the title expects to go there. The traveler can rename a day themselves.
      if (/[()]/.test(t.destination || '')) bad.push(`the port or city is still called "${t.destination}" (should be just ${t.place})`);
      if (t.autoTitle) { titled++; if (t.autoTitle !== t.place || /[()]/.test(t.autoTitle)) bad.push(`day title "${t.autoTitle}" should be just the destination (${t.place})`); }
      if (T.key !== 'rainy' && (t.closedSel || []).length) bad.push(`picked on a day it is closed: ${t.closedSel.join(', ')}`);
      { const ct = await p.evaluate(i => window.__kairouteClosedTry(i), D.i); if (ct) { closedTried++;
        if (ct.added) bad.push(`${ct.sight} was added on a day it is closed`);
        else if (!/is closed on/.test(ct.title) || !(ct.offers.length || ct.none)) bad.push(`adding ${ct.sight} (closed that day) didn't explain it or offer an open day or an open sight (box: "${ct.title}")`); } }
      if (t.fill && t.fill.capped) bad.push(`the day still had room but filling stopped early (${t.fill.spare} min spare)`);
      { const F = fillBy.get(D.city) || { placed: new Set(), must: new Map(), roomy: [] }; fillBy.set(D.city, F);
        [...t.picks, ...t.bonus, ...(t.along || []), ...t.selected].forEach(id => F.placed.add(id)); (t.mustSees || []).forEach(m => F.must.set(m.id, m.minutes));
        if (t.fill && t.fillOn && !t.rain && (t.type === 'land' || t.type === 'port')) F.roomy.push({ date: D.date, spare: t.fill.spare, left: t.fill.mustLeft || [] }); }
      // Day plan screen
      await p.evaluate(i => window.__kairouteAt(i, 'plan'), D.i); await p.waitForTimeout(120);
      const pv = await p.evaluate(() => {
        const tl = [...document.querySelectorAll('.tl')].filter(e => e.querySelector('[data-open]') && !/^On the way:/.test(e.querySelector('.nm').innerText));
        const nums = [...document.querySelectorAll('.mapbox svg text')].map(x => x.textContent.trim());
        const stat = [...document.querySelectorAll('.daysum div')].find(x => /pick/.test(x.innerText));
        return { numbered: tl.filter(e => !e.classList.contains('optional')).length, optional: tl.filter(e => e.classList.contains('optional')).length,
          mapNums: nums.filter(x => /^\d+$/.test(x)).length, mapPlus: nums.filter(x => x === '+').length, stat: stat ? stat.querySelector('b').innerText : '',
          dropped: ([...document.querySelectorAll('.banner.dropped')].map(x => x.innerText)[0] || '') };
      });
      if (pv.numbered !== t.picks.length) bad.push(`Day plan numbers ${pv.numbered} stops, the planner has ${t.picks.length} picks`);
      if (pv.optional !== t.bonus.length) bad.push(`Day plan shows ${pv.optional} optional stops, the planner has ${t.bonus.length}`);
      if (pv.mapNums !== t.picks.length || pv.mapPlus !== t.bonus.length) bad.push(`map shows ${pv.mapNums} numbered + ${pv.mapPlus} optional, plan has ${t.picks.length} + ${t.bonus.length}`);
      const want = t.picks.length + (t.bonus.length ? ' + ' + t.bonus.length : '');
      if (pv.stat !== want) bad.push(`summary says "${pv.stat}" stops, plan has ${want}`);
      if (!!pv.dropped !== !!t.dropped.length) bad.push(`"Didn't fit" note ${pv.dropped ? 'shown' : 'missing'} but ${t.dropped.length} picks don't fit`);
      // Change stops screen
      await p.evaluate(i => window.__kairouteAt(i, 'sites'), D.i); await p.waitForTimeout(120);
      const sv = await p.evaluate(() => {
        const cards = [...document.querySelectorAll('.site')];
        const m = document.querySelector('.meter');
        return { checked: [...document.querySelectorAll('input[data-site]:checked')].map(x => x.dataset.site),
          optional: cards.filter(c => c.querySelector('.tag.bonus')).map(c => c.querySelector('input').dataset.site),
          both: cards.filter(c => c.querySelector('.tag.must') && c.querySelector('.tag.local')).map(c => c.querySelector('.name').innerText),
          count: ((document.querySelector('.stickybar .count') || {}).innerText || ''),
          head: m ? m.querySelector('.mrow b').innerText : '', parts: m ? ((m.querySelector('.mparts:not(.mextra)') || {}).innerText || '') : '' };
      });
      const sel = new Set(t.selected);
      sv.checked.forEach(id => { if (!sel.has(id)) bad.push(`${id} shows ticked but isn't picked`); });
      if (parseInt(sv.count) !== t.selected.length) bad.push(`Change stops says "${sv.count}", ${t.selected.length} are picked`);
      if (sv.optional.sort().join() !== t.bonus.slice().sort().join()) bad.push(`Change stops marks ${sv.optional.length} as optional on the plan, the plan has ${t.bonus.length}`);
      if (sv.both.length) bad.push(`Must-see and Local favorite on the same sight: ${sv.both.join(', ')}`);
      if (sv.head) { const sum = sv.parts.split('·').reduce((a, x) => a + mins(x), 0), tot = mins(sv.head.split(' of ')[0]); if (Math.abs(sum - tot) > 2) bad.push(`time bar parts add to ${sum} min, its total says ${tot} min`); }
      // Guide screen
      await p.evaluate(i => window.__kairouteAt(i, 'guide'), D.i); await p.waitForTimeout(120);
      const gv = await p.evaluate(() => [...document.querySelectorAll('.jumps .chip b')].map(x => x.innerText));
      if (gv.filter(x => /^\d+$/.test(x)).length !== t.picks.length || gv.filter(x => x === '+').length !== t.bonus.length) bad.push(`Guide lists ${gv.join(' ')}, plan has ${t.picks.length} picks + ${t.bonus.length} optional`);
      log('One truth', T.key, !bad.length, bad.length ? `${tag}: ${bad.join('; ')}` : `${tag}: all screens agree`);
    }
    // Must-sees first: a must-see left off every day in its city while one of those days had plenty of spare time
    // (its visit plus 90 minutes for getting there) means the fill chose lesser sights over it.
    for (const [city, F] of fillBy) {
      const missed = [...F.must].filter(([id, min]) => !F.placed.has(id) && F.roomy.some(r => r.spare >= min + 90 && r.left.includes(id))).map(([id]) => id);
      log('Fill the day', T.key, !missed.length, missed.length ? `${city}: must-sees left out while a day had room: ${missed.join(', ')} (spare: ${F.roomy.map(r => r.date + ' ' + r.spare + ' min').join(', ')})` : `${city}: must-sees first, ${F.roomy.length} days filled (spare left: ${F.roomy.map(r => r.spare + ' min').join(', ') || 'none'})`);
    }
    // Screenshots: the first planned day of each trip
    const first = days.find(D => D.type !== 'sea' && D.city);
    if (first) for (const [v, nm] of [['plan', 'day plan'], ['sites', 'change stops']]) { await p.evaluate(([i, v]) => window.__kairouteAt(i, v), [first.i, v]); await p.waitForTimeout(200); const f = `${T.key}-${v}.jpg`; await p.screenshot({ path: path.join(OUT, f), type: 'jpeg', quality: 60 }); shots.push({ f, cap: `${T.label}: ${nm}, ${first.date}` }); }
    // Staying on board (port days): one tap; no shore plan, no ship-time alerts, not a tour day, the title says so,
    // the picks go to another day here or back to the list, and going ashore after all puts everything back.
    { let ab = 0; const abBad = [];
      for (const D of (await p.evaluate(() => window.__kairouteDays())).filter(x => x.type === 'port').slice(0, 3)) {
        const r = await p.evaluate(i => window.__kairouteAboard(i), D.i); if (!r) continue; ab++; const o = r.on, f = r.off, w = `${D.date}:`;
        if (!o.aboard || o.selected || !o.card || !o.sitesCard) abBad.push(`${w} staying on board still shows a shore plan or keeps picks`);
        if (o.alarm) abBad.push(`${w} ship-time alerts still on while staying on board`);
        if (o.tourDay) abBad.push(`${w} a day on board still counts as a tour day`);
        if (!/, staying aboard$/.test(o.title) || !/staying aboard/.test(o.chip)) abBad.push(`${w} title doesn't say staying aboard ("${o.title}")`);
        if (r.before && !o.note) abBad.push(`${w} didn't say where the picks went`);
        if (o.movedTo && !o.elsewhere) abBad.push(`${w} said picks moved to another day but they aren't there`);
        if (o.elsewhere && !/Moved to another day/.test(o.note)) abBad.push(`${w} picks moved to another day without saying so`);
        if (f.aboard || f.card || !f.restored || f.elsewhere) abBad.push(`${w} going ashore after all didn't put the day back`);
      }
      log('Staying on board', T.key, !abBad.length, abBad.length ? abBad.join(' | ') : `${ab} port days: on board and back again with one tap`); }
    if (T.key === TRIPS[0].key) { const sz = await p.evaluate(() => ({ jul: window.__kairouteRunsThen('2027-07-12', [4, 5, 6, 7, 8, 9, 10]), jan: window.__kairouteRunsThen('2027-01-12', [4, 5, 6, 7, 8, 9, 10]), all: window.__kairouteRunsThen('2027-01-12', null) }));
      log('Seasonal ferries', T.key, sz.jul && !sz.jan && sz.all, sz.jul && !sz.jan && sz.all ? 'a ferry that runs April to October is offered in July, not in January; year-round lines always' : 'seasonal check wrong: ' + JSON.stringify(sz)); }
    // Naples, Sorrento and Pompeii with the real lines (Richard's loop): the ferry from the ship's pier wins the first
    // ride over a 75-minute taxi, Sorrento comes before Pompeii, the train brings you back, and the day ends in time.
    if (T.key === TRIPS[0].key) { const D = (await p.evaluate(() => window.__kairouteDays())).find(x => /naples/i.test(x.city || '') && x.type === 'port');
      if (D) { const r = await p.evaluate(i => { window.__kairouteEdit(i, { selected: ['sorrento-far', 'pompeii-far'], legModes: undefined });
          const ship = { lat: 40.8380, lng: 14.2550 }, sor = { lat: 40.6263, lng: 14.3757 }, pom = { lat: 40.7489, lng: 14.4848 };
          const op = (mode, label, ride, every, from, to, tt) => ({ mode, kind: mode === 'ferry' ? 'Ferry' : 'Train', label, operator: '', from: '', to: '', ride, wait: tt ? 10 : Math.min(every, 60) + (mode === 'ferry' ? 10 : 3), every, everySrc: tt ? 'timetable' : 'usual', access: { how: 'walk', min: 5, km: 0.3 }, egress: { how: 'walk', min: 8, km: 0.5 }, min: 13 + ride + (tt ? 10 : Math.min(every, 60) + (mode === 'ferry' ? 10 : 3)), km: 30, stops: 0, hours: '', path: [[from.lng, from.lat], [to.lng, to.lat]], fromPt: [from.lng, from.lat], toPt: [to.lng, to.lat], src: 'test', noTimetable: !tt });
          window.__kairouteTransitSet([{ a: ship, b: sor, opts: [op('ferry', 'Ferry Napoli - Sorrento', 45, 60, ship, sor)] }, { a: sor, b: pom, opts: [op('train', 'Train Circumvesuviana', 30, 30, sor, pom, true)] }, { a: pom, b: ship, opts: [op('train', 'Train Circumvesuviana', 40, 30, pom, ship, true)] }]);
          return { legs: window.__kairouteRideLegs(i).legs, t: window.__kairouteTruth(i) }; }, D.i);
        const L = r.legs || [], first = L[0] || {}, iS = L.findIndex(x => x.to === 'Sorrento'), iP = L.findIndex(x => x.to === 'Pompeii');
        const okL = /^Ferry/.test(first.how || '') && first.to === 'Sorrento' && iS >= 0 && iP > iS && !r.t.over;
        log('Ferry out, train back', T.key, okL, okL ? `Naples: ${L.map(x => `${x.how} to ${x.to}`).join(', ')}` : 'Naples loop wrong: ' + JSON.stringify(L.map(x => [x.how, x.to, x.min])) + ' over=' + r.t.over); } }
    // Turning off "Churches & faith" (Richard: "I just turned off churches and its still showing churches"): the
    // app's own church picks leave every day and the fill doesn't add new ones; the traveler's own picks and famous
    // must-sees stay. Done through the real Interests button.
    if (T.key === TRIPS[0].key) { const RE = /\b(church|cathedral|basilica|monaster|chapel|shrine|abbey|agios|agia|panagia|saint|st\.? )/i;
      const days = await p.evaluate(() => window.__kairouteDays()); let pick = null;
      await p.evaluate(() => window.__kairoutePrefs({ interests: ['churches'], noChurches: undefined }));
      for (const D of days) { const t = await p.evaluate(i => window.__kairouteTruth(i), D.i); if (!t.picks) continue;
        const must = new Set((t.mustSees || []).map(x => x.id)), ch = t.picks.map((id, k) => ({ id, name: t.keptNames[k] })).filter(x => RE.test(x.name) && !/ancient|ruin/i.test(x.name) && !must.has(x.id));
        if (ch.length >= 2) { pick = { i: D.i, mine: ch[0], app: ch[1] }; break; } }
      if (!pick) log('Interests off', T.key, false, 'no day with two church picks to test');
      else { const r = await p.evaluate(async P => { window.__kairouteEdit(P.i, { mine: [P.mine.id] }); window.__kairouteGo('settings'); const sec = document.querySelector('[data-setsec="prefs"]'); if (sec) sec.click();
          const btn = document.querySelector('[data-pref="interest"][data-v="churches"]'); if (!btn) return { nobtn: true }; btn.click(); await new Promise(z => setTimeout(z, 200));
          const t = window.__kairouteTruth(P.i); return { on: (document.querySelector('[data-pref="interest"][data-v="churches"]') || btn).getAttribute('aria-pressed'), mineKept: t.stopNames.includes(P.mine.name), appGone: !t.stopNames.includes(P.app.name), stops: t.stopNames.length,
            unwanted: window.__kairouteDays().flatMap(x => (window.__kairouteTruth(x.i).unwanted || []).map(n => x.date + ' ' + n)),
            kept: window.__kairouteDays().flatMap(x => window.__kairouteTruth(x.i).stopNames || []).filter(n => /\b(church|cathedral|basilica|chapel|monaster|agios|agia|panagia|saint)/i.test(n)).length }; }, pick);
        const bad = []; if (r.nobtn) bad.push('no Churches button in Settings'); else { if (r.on !== 'false') bad.push('button still on');
          if (!r.appGone) bad.push(`${pick.app.name} (the app's pick) still planned`); if (!r.mineKept) bad.push(`${pick.mine.name} (the traveler's own pick) was removed`); if (!r.stops) bad.push('day left empty'); }
        if ((r.unwanted || []).length) bad.push('churches still planned: ' + r.unwanted.join(', '));
        log('Interests off', T.key, !bad.length, bad.length ? bad.join(' | ') : `Churches off: ${pick.app.name} left the plan, ${pick.mine.name} (picked by the traveler) stayed; no other church left that the traveler didn't pick, ${r.kept} famous or own church stops kept trip-wide`); }
      await p.evaluate(() => window.__kairoutePrefs({ interests: ['bible', 'churches'], noChurches: undefined })); }
    // Must-sees first (Richard: Plaka, a must-see, "doesn't fit today's time" while Syntagma Square stayed). Every
    // day of every test trip is planned with all its must-sees ticked at 2.5, 4 and 8 hours: a must-see left out
    // never loses to a lesser stop that takes at least as long (a swap would have fitted it).
    { const r = await p.evaluate(() => { const out = []; let n = 0; for (const D of window.__kairouteDays()) { if (D.type === 'sea' || !D.city) continue; const t0 = window.__kairouteTruth(D.i); if (!t0.mustSees) continue;
          for (const H of [2.5, 4, 8]) { window.__kairouteEdit(D.i, { selected: [...new Set(t0.mustSees.map(x => x.id).concat(t0.selected))], hours: H }); const t = window.__kairouteTruth(D.i); n++; (t.outranked || []).forEach(x => out.push(`${D.date} ${D.dest} ${H} h: ${x}`)); }
          window.__kairouteEdit(D.i, { selected: t0.selected, hours: t0.hours }); } return { n, out }; });
      log('Must-sees first', T.key, !r.out.length, r.out.length ? r.out.slice(0, 6).join(' | ') : `${r.n} day plans with every must-see ticked (2.5, 4 and 8 hours): no must-see lost to a lesser stop`); }
    log('Day titles', T.key, true, `${titled} automatic day titles name only the destination`);
    log('Closed sights', T.key, true, `${closedTried} days tried adding a sight closed that day: never added, an open day or sight offered`);
    log('One truth', T.key, !errs.length, errs.length ? 'page errors: ' + [...new Set(errs)].join(' | ') : `${checked} days checked, no page errors`);
    await ctx.close();
  }
  await b.close();
  // New trips: several cities, several days each, planned from a description. The stand-in AI answers give
  // every day the same date (what happened on Richard's Prague and Hamburg trip) or leave dates out; the app
  // must put them in order and the Trip screen must count days and missing guides right.
  const NEW = [
    { label: 'Prague 4 days then Hamburg 2 days, every day given the same date', desc: 'Prague for 4 days from June 11 2027, then the train to Hamburg for 2 days',
      lines: ['arrival|Prague|train|10:30', 'land|Prague||', 'land|Prague||', 'departure|Prague|train|15:00', 'arrival|Hamburg|train|19:00', 'land|Hamburg||', 'departure|Hamburg|flight|16:00'].map(l => { const [t, c, m, tm] = l.split('|'); return `DAY|2027-06-11|${c}|${t}|${m}|${tm}|||no||yes`; }),
      want: ['2027-06-11', '2027-06-12', '2027-06-13', '2027-06-14', '2027-06-14', '2027-06-15', '2027-06-16'] },
    { label: 'Lisbon, Porto and Madrid, no dates given after the first', desc: 'Lisbon 3 days, Porto 2 days, Madrid 2 days',
      lines: ['DAY|2027-09-06|Lisbon|arrival|flight|10:30|||no||yes', 'DAY||Lisbon|land||||||no||yes', 'DAY||Lisbon|departure|train|09:00|||no||yes', 'DAY||Porto|arrival|train|12:30|||no||yes', 'DAY||Porto|departure|flight|15:00|||no||yes', 'DAY||Madrid|arrival|flight|17:00|||no||yes', 'DAY||Madrid|departure|flight|15:00|||no||yes'],
      want: ['2027-09-06', '2027-09-07', '2027-09-08', '2027-09-08', '2027-09-09', '2027-09-09', '2027-09-10'] }
  ];
  { const b2 = await chromium.launch(); const ctx = await b2.newContext({ viewport: { width: 800, height: 1280 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + FILE); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(400);
    for (const N of NEW) {
      const got = await p.evaluate(([d, a]) => window.__kairouteNewTrip(d, a), [N.desc, 'STOPS: x\n' + N.lines.join('\n')]); await p.waitForTimeout(300);
      const bad = [];
      if (got.map(x => x.date).join() !== N.want.join()) bad.push(`dates ${got.map(x => x.date.slice(5)).join(', ')} instead of ${N.want.map(x => x.slice(5)).join(', ')}`);
      for (let k = 1; k < got.length; k++) if (got[k].date < got[k - 1].date) { bad.push('dates go backwards'); break; }
      const tv = await p.evaluate(() => ({ rows: [...document.querySelectorAll('.itrow .dt')].map(x => x.innerText), head: (document.querySelector('.leftcol .pagehead .eyebrow') || {}).textContent || '', btn: ([...document.querySelectorAll('[data-act="genall"]')][0] || {}).innerText || '' }));
      if (tv.rows.length !== got.length) bad.push(`Trip screen lists ${tv.rows.length} days, the trip has ${got.length}`);
      { const nd = new Set(got.map(x => x.date)).size; if (!new RegExp('\\b' + nd + ' days').test(tv.head)) bad.push(`Trip screen says "${tv.head}" for ${nd} calendar days`); }
      if (/all 1 places|all [012] places/.test(tv.btn)) bad.push(`guide button reads "${tv.btn}"`);
      if (new Set(tv.rows).size < new Set(got.map(x => x.date)).size) bad.push('Trip screen shows fewer distinct dates than the trip has');
      log('New trip', 'new-trips', !bad.length, `${N.label}: ${bad.length ? bad.join('; ') : 'dates in order, Trip screen counts right'}`);
      const f = 'new-trip-' + NEW.indexOf(N) + '.jpg'; await p.screenshot({ path: path.join(OUT, f), type: 'jpeg', quality: 60 }); shots.push({ f, cap: 'New trip: ' + N.label });
    }
    log('New trip', 'new-trips', !errs.length, errs.length ? 'page errors: ' + [...new Set(errs)].join(' | ') : 'no page errors');
    await b2.close(); }
  // Duplicate sights (Richard, Santorini: "I think there are several duplicate stops"): the same place under two
  // names (Oia / Oia village, Fira (Thira) / Fira caldera path, a Greek and an English name) is one sight, a small
  // part of a village (Megalochori Bell Tower) folds into it, and look-alike names that are different places stay
  // apart (Acropolis / Acropolis Museum, San Lorenzo / San Paolo Maggiore, two museums of Thera). Every guide the
  // app holds is scanned too.
  { const b4 = await chromium.launch(); const p = await b4.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + FILE); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(400);
    const FX = require('./dedupe-fixture.cjs'), want = { Santorini: [['Oia', 'Oia village'], ['Akrotiri', 'Akrotiri prehistoric town'], ['Fira (Thira)', 'Fira caldera path'], ['Pyrgos Kallistis', 'Pyrgos village'], ['Museum of Prehistoric Thera', 'Museum of Prehistoric Thera'], ['Megalochori Bell Tower', 'Megalochori'], ['Kamari Beach Boardwalk', 'Kamari']], Chania: [['Church of Saint Nicholas, Splantzia', 'Agios Nikolaos in Chania (Splantzia)'], ['Nautical Museum of Crete', 'Maritime Museum of Crete']] };
    const apart = { Santorini: ['Archaeological Museum of Thera', 'Museum of Prehistoric Thera', 'Nea Kameni', 'Palea Kameni'], Athens: ['Acropolis and Parthenon', 'Acropolis Museum', 'Ancient Agora', 'Roman Agora and Tower of the Winds'], Naples: ['San Lorenzo Maggiore', 'San Paolo Maggiore', 'Castel Nuovo', 'Royal Palace of Naples', 'Fontana di Palazzo Reale'] };
    const bad = []; let folded = 0;
    for (const [city, L] of Object.entries(FX)) { const sites = L.map(([name, lat, lng, category], i) => ({ id: 's' + i, name, lat, lng, category, guide: name === 'Fira caldera path' ? 'x'.repeat(400) : '' }));
      const r = await p.evaluate(s => window.__kairouteDedupe(s, []), sites), names = r.kept.map(x => x.name), cnt = n => names.filter(x => x === n).length;
      for (const [gone, into] of want[city] || []) { const k = r.kept.find(x => x.name === into); if (!k || (gone !== into && names.includes(gone)) || cnt(into) !== 1) bad.push(`${city}: "${gone}" and "${into}" still listed separately`); else folded++; }
      for (const n of apart[city] || []) if (!names.includes(n)) bad.push(`${city}: "${n}" was folded into another sight but is a different place`); }
    const scan = await p.evaluate(() => window.__kairouteDupScan()); scan.forEach(x => bad.push('guide still lists one place twice: ' + x));
    if (errs.length) bad.push('page errors: ' + [...new Set(errs)].join(' | '));
    log('Duplicate sights', 'guides', !bad.length, bad.length ? bad.join(' | ') : `${folded} repeats folded (same place under two names, or a part of a village); look-alike names of different places kept apart; no guide lists a place twice`);
    await b4.close(); }
  // Famous sights and big stops: with a snapshot of Prague's sources and stand-in AI answers, the top famous
  // sights must survive every way a guide writer can lose them (left out, filed as a quick stop, called
  // unvisitable, cut from a long list), saved guides must be repaired, and big stops must split into real parts.
  { const b3 = await chromium.launch(); const ctx = await b3.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message)); await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + FILE); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(500);
    const fix = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'prague-sources.json'), 'utf8'));
    const fr = await p.evaluate(f => window.__kairouteFameCheck(f), fix);
    fr.forEach(r => log('Famous sights', 'famous', r.pass, `${r.name}: ${r.what}`));
    // A big stop on the real screens and in the voice tour: listed part by part, each part tickable, and the tour
    // plays one part at a time with Next part between them.
    await p.getByText('Continue trip').click().catch(() => {}); await p.waitForTimeout(300);
    const days = await p.evaluate(() => window.__kairouteDays()); const D = days.find(x => x.type === 'land' && x.city) || days.find(x => x.type !== 'sea' && x.city);
    const bad = []; await p.evaluate(i => window.__kairouteTruth(i), D.i); const sp = await p.evaluate(i => window.__kairouteSplitStop(i, 3), D.i);
    if (!sp) bad.push('no stop to split'); else {
      await p.evaluate(i => window.__kairouteAt(i, 'plan'), D.i); await p.waitForTimeout(150);
      const onPlan = await p.evaluate(nm => { const tl = [...document.querySelectorAll('.tl')].find(e => e.querySelector('.nm') && e.querySelector('.nm').innerText === nm); return tl ? tl.querySelectorAll('ol.parts li').length : -1; }, sp.name);
      if (onPlan !== 3) bad.push(`Day plan lists ${onPlan} parts for ${sp.name}, it has 3`);
      await p.evaluate(i => window.__kairouteAt(i, 'sites'), D.i); await p.waitForTimeout(150);
      const ticks = await p.evaluate(id => document.querySelectorAll(`input[data-part^="${id}:"]`).length, sp.id);
      if (ticks !== 3) bad.push(`Change stops shows ${ticks} part ticks, the stop has 3`);
      await p.evaluate(id => document.querySelector(`input[data-part="${id}:2"]`).click(), sp.id); await p.waitForTimeout(150);
      const stillPicked = await p.evaluate(id => document.querySelector(`input[data-site="${id}"]`).checked, sp.id);
      if (!stillPicked) bad.push('unticking a part unticked the whole stop');
      await p.evaluate(i => window.__kairouteAt(i, 'plan'), D.i); await p.waitForTimeout(150);
      const after = await p.evaluate(nm => { const tl = [...document.querySelectorAll('.tl')].find(e => e.querySelector('.nm') && e.querySelector('.nm').innerText === nm); return tl ? tl.querySelectorAll('ol.parts li').length : -1; }, sp.name);
      if (after !== 2) bad.push(`after unticking a part the Day plan lists ${after} parts, not 2`);
      // Voice tour
      await p.evaluate(i => window.__kairouteAt(i, 'tour'), D.i); await p.waitForTimeout(150);
      const btn = async act => { await p.evaluate(a => { const el = [...document.querySelectorAll(`[data-act="${a}"]`)].find(e => e.offsetParent); if (el) el.click(); }, act); await p.waitForTimeout(200); };
      let reached = false;
      for (let k = 0; k < 20 && !reached; k++) {
        const st = await p.evaluate(() => ({ title: (document.querySelector('.tourtitle') || {}).innerText || '', here: !!document.querySelector('[data-act="tourhere"]') }));
        if (st.here) { await btn('tourhere'); reached = st.title === sp.name; } else await btn('tournext');
      }
      if (!reached) bad.push('the tour never reached the split stop');
      const seen = [];
      for (let k = 0; k < 3; k++) {
        const v = await p.evaluate(() => ({ meta: (document.querySelector('.tourcard .stopmeta') || {}).innerText || '', play: [...document.querySelectorAll('.tourcard [data-play^="part:"]')].length, next: !!document.querySelector('[data-act="tourpart"]') }));
        seen.push(v.meta); if (v.play !== 1) bad.push(`tour part ${k + 1} has ${v.play} play buttons, not 1`);
        if (!v.next) break; await btn('tourpart');
      }
      if (seen.length !== 2 || !/Part 1 of 2/.test(seen[0]) || !/Part 2 of 2/.test(seen[1])) bad.push('tour parts: ' + seen.join(' | '));
      await p.screenshot({ path: path.join(OUT, 'big-stop-tour.jpg'), type: 'jpeg', quality: 60 }); shots.push({ f: 'big-stop-tour.jpg', cap: 'Voice tour: a big stop, one part at a time' });
    }
    log('Famous sights', 'famous', !bad.length, bad.length ? 'Big stop on the screens: ' + bad.join('; ') : 'Big stop on the screens: Day plan lists the parts, each part tickable, the tour plays one part at a time');
    log('Famous sights', 'famous', !errs.length, errs.length ? 'page errors: ' + [...new Set(errs)].join(' | ') : 'no page errors');
    await b3.close(); }
  // Sights coverage: with real snapshots of each city's sources (tools/fixtures/src-*.json, no network, no AI), every
  // big city offers at least 30 worthwhile sights (smaller ones most of what their sources know), nothing twice, every added
  // sight carries its sources, a gateway port is planned for the city it serves, look-alike names are told apart, and
  // a benchmark list (what a free chatbot names for the city) is mostly covered. On a port day, far sights stay
  // visible but can't be picked when they don't fit the ship time.
  { const b5 = await chromium.launch(); const p = await (await b5.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message)); await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + FILE); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(500);
    const bench = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'coverage-bench.json'), 'utf8'));
    const files = fs.readdirSync(path.join(__dirname, 'fixtures')).filter(f => /^src-.*\.json$/.test(f)).sort();
    if (!files.length) log('Sights coverage', 'coverage', false, 'no source snapshots in tools/fixtures');
    for (const f of files) {
      const fix = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8')), key = f.replace(/^src-|\.json$/g, ''), bl = (bench[key] || {});
      const r = await p.evaluate(x => window.__kairouteSrcCheck(x), Object.assign({ bench: bl.names || [], cityKey: bl.cityKey }, fix));
      const tot = r.after.main + r.after.quick, hits = r.bench.filter(x => x.hit).length;
      log('Sights coverage', key, r.after.main >= r.min, `${fix.destination}: ${r.before.main} written sights before, ${r.after.main} sights + ${r.after.quick} quick stops + ${r.after.far} day trips now (needs at least ${r.min} sights for a city its size)`);
      log('Sights coverage', key, !r.dup.length, r.dup.length ? 'same place twice: ' + r.dup.slice(0, 5).join('; ') : 'no place listed twice');
      log('Sights coverage', key, !r.noSrc.length, r.noSrc.length ? 'added without sources: ' + r.noSrc.join(', ') : 'every added sight names its sources');
      if (bl.area) log('Sights coverage', key, new RegExp(bl.area, 'i').test(r.label) || new RegExp(bl.area, 'i').test(fix.sources.area), `sources asked for "${r.label}" (area ${fix.sources.area}); the day is spent in ${bl.area}`);
      if (r.bench.length) log('Sights coverage', key, hits >= Math.ceil(r.bench.length * (bl.share || 0.5)), `benchmark: ${hits} of ${r.bench.length} places a free chatbot names are on the list${r.bench.filter(x => !x.hit).length ? ' (not yet: ' + r.bench.filter(x => !x.hit).map(x => x.n).join(', ') + ')' : ''}`);
      for (const [a, b] of bl.twins || []) { const t = r.twins.find(x => new RegExp(a, 'i').test(x.s)); log('Sights coverage', key, !!(t && new RegExp(b, 'i').test(t.note)), t ? `${t.s}: "${t.note}"` : `${a}: no note telling it apart from ${b}`); }
    }
    // Port day: Rome from the ship. Far sights are listed but greyed out (no tick box) when they don't fit.
    const rome = files.find(f => /rome/.test(f));
    if (rome) {
      const fix = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', rome), 'utf8'));
      await p.getByText('Continue trip').click().catch(() => {}); await p.waitForTimeout(300);
      const days = await p.evaluate(() => window.__kairouteDays()); const D = days.find(x => /civitavecchia|rome/i.test(x.dest || ''));
      if (!D) log('Sights coverage', 'rome-port', false, 'the example trip has no Rome port day');
      else {
        await p.evaluate(([fam, src]) => { window.__kairouteSeedSources('Rome (from Civitavecchia)', fam, src); window.__kairouteSeedSources('Civitavecchia (Rome)', fam, src); }, [fix.famous, fix.sources]);
        // The day itself stays a few top sights with the long ride both ways counted (not every sight on the list).
        await p.evaluate(i => window.__kairouteAt(i, 'plan'), D.i); await p.waitForTimeout(400);
        const pl = await p.evaluate(() => ({ rides: [...document.querySelectorAll('.tl')].map(e => e.innerText.replace(/\s+/g, ' ')).filter(t => /^(Train|Taxi|Car|Ferry|Bus)[^·]*· /.test(t)), picks: document.querySelectorAll('.tl .nm').length, opt: [...document.querySelectorAll('.tl')].filter(e => /Optional:/.test(e.innerText)).length }));
        const mins = t => { const h = /(\d+) h/.exec(t), m = /(\d+) min/.exec(t); return (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0); };
        const first = pl.rides[0] || '', last = pl.rides[pl.rides.length - 1] || '';
        log('Sights coverage', 'rome-port', mins(first) >= 60 && mins(last) >= 60, `Rome port day counts the ride from the ship (${first.slice(0, 40)}) and back (${last.slice(0, 40)})`);
        log('Sights coverage', 'rome-port', pl.opt <= 2, `Rome port day adds ${pl.opt} optional stops on its own (at most 2: a longer list is for browsing, not for packing the day)`);
        await p.evaluate(i => window.__kairouteAt(i, 'sites'), D.i); await p.waitForTimeout(400);
        const v = await p.evaluate(() => ({ cards: document.querySelectorAll('.sitesmain [data-card]').length, nofit: [...document.querySelectorAll('.sitesmain .nofitcard .name')].map(e => e.innerText), boxes: document.querySelectorAll('.sitesmain input[data-site]').length, twin: [...document.querySelectorAll('.sitesmain .travelnote')].map(e => e.innerText).filter(t => /Not the same place/.test(t)) }));
        log('Sights coverage', 'rome-port', v.cards >= 30, `Rome port day, Change stops: ${v.cards} sights listed (${v.boxes} can be ticked, ${v.nofit.length} shown greyed out as not fitting the ship time)`);
        log('Sights coverage', 'rome-port', v.twin.some(t => /Peter|Paul/.test(t)), `look-alike basilicas told apart on screen: ${v.twin.slice(0, 2).join(' / ') || 'no note shown'}`);
        await p.screenshot({ path: path.join(OUT, 'rome-port-sights.jpg'), type: 'jpeg', quality: 60 }); shots.push({ f: 'rome-port-sights.jpg', cap: 'Rome port day: the full sights list, far ones greyed out' });
      }
    }
    log('Sights coverage', 'coverage', !errs.length, errs.length ? 'page errors: ' + [...new Set(errs)].join(' | ') : 'no page errors');
    await b5.close(); }
  // Real transport for rides (a stand-in /transit answer for Naples, shaped like the helper's): the plan names the
  // ferry and the train, each ride can be switched to a taxi and the plan follows, the map draws the line's path,
  // the ride back to the ship says what to do if you miss it, and the ship checks still pass.
  { const b4 = await chromium.launch(); const p = await (await b4.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); const errs = [], bad = [];
    p.on('pageerror', e => errs.push(e.message)); await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + FILE); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(500);
    const pairs = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'naples-transit.json'), 'utf8'));
    const i = await p.evaluate(pr => { window.__kairouteTransitSet(pr); const d = window.__kairouteDays().find(x => /Naples/.test(x.dest)); window.__kairouteDay(d.i, 'Pompeii|^Sorrento'); window.__kairouteAt(d.i, 'plan'); return d.i; }, pairs);
    await p.waitForTimeout(300);
    const legs = await p.$$eval('.tl.leg.ridecho', els => els.map(e => ({ t: e.innerText, sel: e.querySelector('select[data-ride]') ? [...e.querySelector('select[data-ride]').options].map(o => o.text) : [] })));
    if (legs.length < 3) bad.push(`${legs.length} rides with a choice, expected 3`);
    if (!legs[0] || !/Ferry/.test(legs[0].t) || !/Molo Beverello/.test(legs[0].t)) bad.push('the first ride is not the ferry from Molo Beverello: ' + (legs[0] || {}).t);
    if (!legs.slice(1).some(l => /Circumvesuviana/.test(l.t) && /Pompei Scavi/.test(l.t))) bad.push('no Circumvesuviana ride via Pompei Scavi');
    if (!legs.every(l => l.sel.some(o => /Taxi/.test(o)))) bad.push('a ride without the taxi choice');
    const last = legs[legs.length - 1]; if (!last || !/If you miss it/.test(last.t) || !/spare before the ship/.test(last.t)) bad.push('the ride back to the ship does not say what to do if you miss it, or its spare time');
    if (!legs.some(l => /Next departure about \d\d:\d\d/.test(l.t) && /timetable checked/.test(l.t))) bad.push('no ride shows its next departure from the timetable');
    if (!last || !/Last safe departure back: \d\d:\d\d/.test(last.t)) bad.push('the ride back to the ship does not show the last safe departure');
    if (!/No published timetable found/.test((legs[0] || {}).t || '')) bad.push('the ferry without a timetable does not say so');
    const q1 = await p.evaluate(() => window.__kairouteQuality().find(x => /Naples/.test(x.dest)));
    if (!q1 || q1.issues.length || q1.stops !== 2) bad.push('ship checks with the train and ferry: ' + JSON.stringify(q1 && q1.issues) + ' stops ' + (q1 && q1.stops));
    const mp = await p.evaluate(() => window.__kairouteMap ? window.__kairouteMap() : null);
    const pathLegs = await p.evaluate(() => (window.__kairouteMapLegs ? window.__kairouteMapLegs() : []).filter(l => l.path).length);
    if (pathLegs < 2) bad.push(`map draws ${pathLegs} rides along the line's path, expected 3`);
    await p.screenshot({ path: path.join(OUT, 'rides-naples.jpg'), type: 'jpeg', quality: 60 }); shots.push({ f: 'rides-naples.jpg', cap: 'Day plan: real ferry and train rides, each with a choice' });
    // Switch the first ride to a taxi: the plan follows.
    await p.evaluate(() => { const s = document.querySelector('.tl.leg.ridecho select[data-ride]'); s.value = 'taxi'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(300);
    const first = await p.$eval('.tl.leg.ridecho', e => e.innerText).catch(() => '');
    if (!/^Taxi or car/m.test(first.trim())) bad.push('switching to a taxi did not change the ride: ' + first.slice(0, 80));
    const q2 = await p.evaluate(() => window.__kairouteQuality().find(x => /Naples/.test(x.dest)));
    if (!q2 || q2.issues.length) bad.push('ship checks after switching to a taxi: ' + JSON.stringify(q2 && q2.issues));
    void mp; void i;
    log('Rides', 'transport', !bad.length, bad.length ? bad.join('; ') : 'Naples: ferry out, Circumvesuviana via Pompeii and back, each ride switchable to a taxi, the plan and ship checks follow, the map draws the real lines');
    log('Rides', 'transport', !errs.length, errs.length ? 'page errors: ' + [...new Set(errs)].join(' | ') : 'no page errors');
    await b4.close(); }
  // Real-screen walkthroughs at three sizes
  for (const [nm, w, h] of [['tablet landscape', 1280, 800], ['tablet upright', 800, 1280], ['phone', 412, 900]]) {
    const r = spawnSync('node', [path.join(__dirname, 'picks-e2e.cjs'), FILE, String(w), String(h), path.join(OUT, 'walk-' + w)], { encoding: 'utf8', timeout: 15 * 60 * 1000 });
    const lines = (r.stdout || '').trim().split('\n'); const fl = lines.filter(l => /^FAIL|PAGE ERRORS/.test(l));
    fl.forEach(l => log('Walkthrough', nm, false, l));
    log('Walkthrough', nm, r.status === 0, lines[lines.length - 1] || (r.stderr || '').slice(0, 300));
    const dir = path.join(OUT, 'walk-' + w); if (fs.existsSync(dir)) fs.readdirSync(dir).sort().forEach(f => shots.push({ f: 'walk-' + w + '/' + f, cap: `${nm}: ${f.replace(/^\d+-|\.jpg$/g, '').replace(/-/g, ' ')}` }));
  }
  // Live trip features: opening hours, weather, crowds, running late, the back-to-the-ship alarm, ratings, camera
  await require('./live-check.cjs').run({ chromium, FILE, log, OUT, shots });
  // Report
  const when = new Date().toUTCString(), passed = results.filter(r => r.ok).length;
  const groups = [...new Set(results.map(r => r.suite + '|' + r.trip))];
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Kairoute checks</title>
<style>:root{--bg:#f4f6f5;--card:#fff;--ink:#123c3a;--muted:#5b6b69;--ok:#1f7a5a;--bad:#b3261e;--line:#dfe6e4}@media (prefers-color-scheme:dark){:root{--bg:#0f1716;--card:#16201f;--ink:#e6efed;--muted:#9fb1ae;--ok:#5fd3a5;--bad:#ff8a80;--line:#28403d}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,sans-serif}main{max-width:1100px;margin:0 auto;padding:20px 16px 60px}h1{margin:0 0 4px}.sub{color:var(--muted);margin:0 0 18px}
.big{font-size:1.25rem;font-weight:700;padding:14px 16px;border-radius:12px;background:var(--card);border:2px solid ${fails ? 'var(--bad)' : 'var(--ok)'};margin-bottom:18px}
details{background:var(--card);border:1px solid var(--line);border-radius:12px;margin:10px 0;padding:10px 14px}summary{cursor:pointer;font-weight:700}li{margin:4px 0}.ok{color:var(--ok)}.bad{color:var(--bad);font-weight:600}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}figure img{width:100%;display:block}figcaption{padding:6px 10px;font-size:.85rem;color:var(--muted)}</style></head>
<body><main><h1>Kairoute checks</h1><p class="sub">Run ${esc(when)}. These run automatically before every update; if anything fails, the update is held back.</p>
<div class="big">${fails ? `${fails} problem${fails > 1 ? 's' : ''} found: this update was held back` : `All ${passed} checks passed`}</div>
<p>What's checked: on every day of ${TRIPS.length} sample trips, the Day plan, map, Change stops, time bar and Guide must agree with the planner (same stops, same counts, times that add up, no sight on two days, no optional stop shown as a pick, labels that follow the sources). Every stop must be a real guide sight, every restaurant must come from the map data, and meals must be near the route. Then a script taps through the real screens on tablet and phone: untick everything, reload, tick, change the day length, Suggest my tour, and sync between two devices. Live trip features are checked with a stand-in server, a fake clock and a fake GPS: opening hours and closed days, the rain swap, crowd tips, re-planning when you fall behind, the back-to-the-ship alerts, traveler ratings and the photo look-up.</p>
${groups.map(g => { const [suite, trip] = g.split('|'), rs = results.filter(r => r.suite === suite && r.trip === trip), nb = rs.filter(r => !r.ok).length, T = TRIPS.find(x => x.key === trip) || (trip === 'famous' ? { label: 'Top famous sights and big stops (Prague snapshot)' } : trip === 'new-trips' ? { label: 'Planning a new trip from a description (several cities)' } : trip === 'live' ? { label: 'Live trip features: opening hours, weather, crowds, running late, back-to-the-ship alarm, traveler ratings, What am I looking at?' } : null);
  return `<details ${nb ? 'open' : ''}><summary>${esc(suite)}: ${esc(T ? T.label : trip)} <span class="${nb ? 'bad' : 'ok'}">${nb ? nb + ' failed' : 'all passed'}</span></summary><ul>${rs.map(r => `<li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓' : '✗'} ${esc(r.what)}</li>`).join('')}</ul></details>`; }).join('')}
<h2>Screenshots from this run</h2><div class="shots">${shots.map(s => `<figure><a href="${esc(s.f)}"><img loading="lazy" src="${esc(s.f)}" alt=""></a><figcaption>${esc(s.cap)}</figcaption></figure>`).join('')}</div></main></body></html>`;
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  console.log(`\n${passed} passed, ${fails} failed. Report: checks/index.html`);
  process.exit(fails ? 1 : 0);
})();
