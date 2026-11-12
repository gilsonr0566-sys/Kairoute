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
    let checked = 0; const seenBy = new Map();
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
        t.selected.forEach(id => { if (!t.picks.includes(id) && !t.dropped.includes(id) && !t.elsewhere.includes(id)) bad.push(`${id} is ticked but missing from the plan with no explanation`); });
      }
      t.bonus.forEach(id => { if (t.selected.includes(id)) bad.push(`${id} is ticked but shown as optional`); });
      [...t.picks, ...t.bonus].forEach(id => { const k = D.city + '/' + id; if (seenBy.has(k)) bad.push(`${id} is also planned on ${seenBy.get(k)}`); seenBy.set(k, D.date); });
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
          head: m ? m.querySelector('.mrow b').innerText : '', parts: m ? ((m.querySelector('.mparts') || {}).innerText || '') : '' };
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
    // Screenshots: the first planned day of each trip
    const first = days.find(D => D.type !== 'sea' && D.city);
    if (first) for (const [v, nm] of [['plan', 'day plan'], ['sites', 'change stops']]) { await p.evaluate(([i, v]) => window.__kairouteAt(i, v), [first.i, v]); await p.waitForTimeout(200); const f = `${T.key}-${v}.jpg`; await p.screenshot({ path: path.join(OUT, f), type: 'jpeg', quality: 60 }); shots.push({ f, cap: `${T.label}: ${nm}, ${first.date}` }); }
    log('One truth', T.key, !errs.length, errs.length ? 'page errors: ' + [...new Set(errs)].join(' | ') : `${checked} days checked, no page errors`);
    await ctx.close();
  }
  await b.close();
  // Real-screen walkthroughs at three sizes
  for (const [nm, w, h] of [['tablet landscape', 1280, 800], ['tablet upright', 800, 1280], ['phone', 412, 900]]) {
    const r = spawnSync('node', [path.join(__dirname, 'picks-e2e.cjs'), FILE, String(w), String(h), path.join(OUT, 'walk-' + w)], { encoding: 'utf8', timeout: 15 * 60 * 1000 });
    const lines = (r.stdout || '').trim().split('\n'); const fl = lines.filter(l => /^FAIL|PAGE ERRORS/.test(l));
    fl.forEach(l => log('Walkthrough', nm, false, l));
    log('Walkthrough', nm, r.status === 0, lines[lines.length - 1] || (r.stderr || '').slice(0, 300));
    const dir = path.join(OUT, 'walk-' + w); if (fs.existsSync(dir)) fs.readdirSync(dir).sort().forEach(f => shots.push({ f: 'walk-' + w + '/' + f, cap: `${nm}: ${f.replace(/^\d+-|\.jpg$/g, '').replace(/-/g, ' ')}` }));
  }
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
<p>What's checked: on every day of ${TRIPS.length} sample trips, the Day plan, map, Change stops, time bar and Guide must agree with the planner (same stops, same counts, times that add up, no sight on two days, no optional stop shown as a pick, labels that follow the sources). Every stop must be a real guide sight, every restaurant must come from the map data, and meals must be near the route. Then a script taps through the real screens on tablet and phone: untick everything, reload, tick, change the day length, Suggest my tour, and sync between two devices.</p>
${groups.map(g => { const [suite, trip] = g.split('|'), rs = results.filter(r => r.suite === suite && r.trip === trip), nb = rs.filter(r => !r.ok).length, T = TRIPS.find(x => x.key === trip);
  return `<details ${nb ? 'open' : ''}><summary>${esc(suite)}: ${esc(T ? T.label : trip)} <span class="${nb ? 'bad' : 'ok'}">${nb ? nb + ' failed' : 'all passed'}</span></summary><ul>${rs.map(r => `<li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓' : '✗'} ${esc(r.what)}</li>`).join('')}</ul></details>`; }).join('')}
<h2>Screenshots from this run</h2><div class="shots">${shots.map(s => `<figure><a href="${esc(s.f)}"><img loading="lazy" src="${esc(s.f)}" alt=""></a><figcaption>${esc(s.cap)}</figcaption></figure>`).join('')}</div></main></body></html>`;
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  console.log(`\n${passed} passed, ${fails} failed. Report: checks/index.html`);
  process.exit(fails ? 1 : 0);
})();
