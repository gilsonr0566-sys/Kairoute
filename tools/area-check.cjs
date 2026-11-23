// Area visits (Richard's Rome day, Nov 17): an area and the picked sights inside it are one visit, never separate stops
// counted twice; the sights inside go timed tickets first, open-air last; the leave-by time is from the day's real last
// stop. Membership comes from the map's boundaries (here a recorded answer). Usage: node tools/area-check.cjs [index.html]
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; }; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
  await p.goto('file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'))); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(500);
  await p.locator('[data-act=continue]').click(); await p.waitForTimeout(400);
  const R = await p.evaluate(() => window.__kairouteDays().find(d => /rome/i.test(d.dest) && d.type === 'port').i);
  // The live Rome guide's sights, as Richard's printout had them, and the map's answer (OpenStreetMap: Vatican City, Q237).
  const VAT = [{ n: 'Civitas Vaticana - Città del Vaticano', en: 'Vatican City', wd: 'Q237' }];
  const sites = [
    { id: 'vatican-city', name: 'Vatican City', category: 'city-state', lat: 41.904, lng: 12.453, minutes: 125, mustSee: true, wd: 'Q237', tickets: 'Mandatory online booking for Museums; Basilica is free but has long security lines.', summary: 'The smallest country in the world.', guide: 'x' },
    { id: 'sistine', name: 'Sistine Chapel', category: 'chapel', lat: 41.90296, lng: 12.45443, minutes: 45, mustSee: true, wd: 'Q2943', tickets: 'Mandatory pre-booking required for Vatican Museums.', summary: 'Michelangelo\'s ceiling.', guide: 'x' },
    { id: 'piazza-sp', name: 'Piazza San Pietro', category: 'square', lat: 41.90218, lng: 12.45724, minutes: 30, mustSee: true, wd: 'Q83425', summary: 'Bernini\'s colonnade.', guide: 'x' },
  ];
  await p.evaluate(([R, sites]) => window.__kairouteArea.addSites(R, sites), [R, sites]);
  const ids = await p.evaluate(R => window.__kairouteDay(R, 'x') , R); // all ids + names
  const basil = ids.find(x => /peter/i.test(x) && /basilica/i.test(x)).split(' ')[0], pan = ids.find(x => /pantheon/i.test(x)).split(' ')[0];
  const before = await p.evaluate(([R, sel]) => { window.__kairouteEdit(R, { selected: sel, mine: sel }); return window.__kairouteArea.plan(R); }, [R, ['vatican-city', 'sistine', basil, 'piazza-sp', pan]]);
  ok(before.stops.filter(s => !s.bonus && !s.along).length === 5 && !before.stops.some(s => s.area), 'without the map\'s answer nothing is folded (5 separate stops)');
  const memSet = await p.evaluate(([R, VAT, basil]) => { const ks = window.__kairouteArea.keysFor(R); const m = {}; ks.forEach(k => { m[k.key] = ['sistine', 'piazza-sp', basil, 'vatican-city'].includes(k.id) ? VAT : []; }); window.__kairouteArea.set(m); return ks.length; }, [R, VAT, basil]);
  ok(memSet > 5, 'map answers set for ' + memSet + ' sights');
  const A = await p.evaluate(R => window.__kairouteArea.plan(R), R);
  const kept = A.stops.filter(s => !s.bonus && !s.along);
  console.log('     ' + A.stops.map(s => (s.area ? '[' + (s.area.k + 1) + '/' + s.area.n + '] ' : '') + s.name + ' ' + s.len).join(' | '));
  const vis = kept.filter(s => s.area);
  ok(vis.length === 3 && vis.every(s => s.area.name === 'Vatican City'), 'the three Vatican sights are one Vatican City visit');
  ok(!kept.some(s => s.name === 'Vatican City' && !s.area), 'Vatican City is not also a separate stop');
  const idx = vis.map(s => kept.indexOf(s)); ok(idx.every((x, k) => !k || x === idx[k - 1] + 1), 'the visit\'s sights follow one another');
  ok(vis.map(s => s.id).join() === ['sistine', basil, 'piazza-sp'].join(), 'order: Sistine Chapel (timed tickets), then St. Peter\'s, then the square (open-air): ' + vis.map(s => s.name).join(' > '));
  const tot = vis.reduce((a, s) => a + s.len, 0), was = before.stops.filter(s => ['vatican-city', 'sistine', basil, 'piazza-sp'].includes(s.id)).reduce((a, s) => a + s.len, 0);
  ok(tot < was && tot >= 125, `visit time counted once: ${tot} min of sights (was ${was} with Vatican City again)`);
  ok(['vatican-city', 'sistine', basil, 'piazza-sp'].every(id => A.folded.includes(id)) && !A.dropped.length, 'every pick accounted for (on the plan or in the visit)');
  ok(!A.over && A.end <= A.endBy, 'still back at the ship in time');
  ok(A.leave && A.leave.from === A.last, `leave-by is from the day's last stop: ${A.leave && A.leave.from} (last stop ${A.last})`);
  await p.evaluate(R => window.__kairouteAt(R, 'plan'), R); await p.waitForTimeout(500);
  const txt = await p.evaluate(() => document.querySelector('#view').innerText);
  ok(/Your Vatican City visit: 3 stops/i.test(txt) && /Part of your Vatican City visit \(2 of 3\)/i.test(txt), 'the Day plan shows the visit heading on its sights');
  ok(!errs.length, 'no page errors ' + errs.join(' | ')); await b.close(); console.log(fails ? fails + ' FAIL' : 'Area check passed'); process.exit(fails ? 1 : 0); })();
