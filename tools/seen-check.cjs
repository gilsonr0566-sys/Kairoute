// Offline = what you saw online (Nov 17 test pass: after "Download for offline", two Athens days came out with the
// same stops in another order and other places to eat, because more ride timetables had arrived after the plan was
// shown and offline the day was planned afresh from them). Online, every city day of the sample trip is opened on the
// Day plan (that is what the traveler saw). Then the internet goes, and fast trains between the day's stops are on
// the device (timetables fetched by the download after the plan was seen). Every day must still show exactly the plan
// it showed online: same stops, same order, same places to eat. The check proves it tests something: back online,
// the same timetables must change at least one day's plan. A traveler's own change offline (clearing a day) must
// still re-plan. Run: node tools/seen-check.cjs [index.html]
const { chromium } = require('playwright'); const path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
(async () => {
  const b = await chromium.launch(); let fails = 0, changed = 0, days = 0; const fail = m => { fails++; console.log('FAIL ' + m); };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
  await p.goto('file://' + FILE); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(800);
  await p.getByText('Continue trip').click(); await p.waitForTimeout(400);
  const all = (await p.evaluate(() => window.__kairouteDays())).filter(d => d.city && d.type !== 'sea');
  const shown = () => p.evaluate(() => [...document.querySelectorAll('#view .tl .stop .name, #view .tl [data-stop] .name, #view .timeline .name')].map(e => e.textContent.trim()).filter(Boolean).join(' | '));
  const plan = i => p.evaluate(i => { const r = window.__kairouteRoute(i) || []; return r.filter(x => x.type !== 'travel').map(x => x.name).join(' > '); }, i);
  const fast = (pts, opts) => { const out = []; for (const a of pts) for (const c of pts) if (a !== c) out.push({ a, b: c, opts: opts(a, c) }); return out; };
  const online = {}, pairs = {}, km = (a, c) => Math.hypot((a.lat - c.lat) * 111, (a.lng - c.lng) * 85);
  const train = (a, c) => [{ mode: 'train', kind: 'Train', label: 'Train test line', operator: '', from: '', to: '', ride: 6, wait: 4, every: 10, everySrc: 'timetable', access: { how: 'walk', min: 2, km: 0.1 }, egress: { how: 'walk', min: 2, km: 0.1 }, min: 14, km: km(a, c), stops: 0, hours: '', path: [[a.lng, a.lat], [c.lng, c.lat]] }];
  for (const d of all) {
    await p.evaluate(i => window.__kairouteAt(i, 'plan'), d.i); await p.waitForTimeout(250);
    // Quick trains between every two places of the day (and its other sights) more than 2 km apart.
    const pts = await p.evaluate(i => { const r = (window.__kairouteRoute(i) || []).filter(x => x.type !== 'travel' && isFinite(x.lat) && isFinite(x.lng)); return r.map(x => ({ lat: +x.lat, lng: +x.lng })); }, d.i);
    const more = await p.evaluate(i => { window.__kairouteAt(i, 'sites'); return [...document.querySelectorAll('#view [data-card]')].length; }, d.i);
    await p.evaluate(i => window.__kairouteAt(i, 'plan'), d.i); await p.waitForTimeout(150);
    const prs = []; for (const a of pts) for (const c of pts) if (a !== c && km(a, c) > 2) prs.push({ a, b: c });
    if (!prs.length) continue; pairs[d.i] = prs;
    online[d.i] = { plan: await plan(d.i), shown: await shown() }; days++;
  }
  // The internet goes; the download had fetched more timetables after these plans were shown.
  await ctx.setOffline(true); await p.waitForTimeout(300);
  for (const i of Object.keys(pairs).map(Number)) await p.evaluate(pr => window.__kairouteTransitSet(pr), pairs[i].map(x => ({ a: x.a, b: x.b, opts: train(x.a, x.b) })));
  for (const d of all) {
    if (!online[d.i]) continue;
    await p.evaluate(i => window.__kairouteAt(i, 'plan'), d.i); await p.waitForTimeout(250);
    const off = { plan: await plan(d.i), shown: await shown() };
    if (off.plan !== online[d.i].plan) fail(`day ${d.i + 1} ${d.dest}: offline plan differs\n  online:  ${online[d.i].plan}\n  offline: ${off.plan}`);
    else if (off.shown !== online[d.i].shown) fail(`day ${d.i + 1} ${d.dest}: the Day plan shows different stops offline\n  online:  ${online[d.i].shown}\n  offline: ${off.shown}`);
  }
  // Back online, the same timetables are planned with afresh: at least one day must change, or nothing was tested.
  await ctx.setOffline(false); await p.waitForTimeout(300);
  for (const d of all) if (online[d.i] && (await plan(d.i)) !== online[d.i].plan) changed++;
  await ctx.setOffline(true); await p.waitForTimeout(300);
  if (!changed) fail(`the timetables changed no plan on ${days} days, so this check proved nothing`);
  // A traveler's own change offline still re-plans: clearing a day's sights must clear its plan.
  { const d = all.find(x => online[x.i]); if (d) { const before = await plan(d.i);
    await p.evaluate(i => { window.__kairouteAt(i, 'plan'); window.__kairouteEdit(i, { selected: [], cleared: true }); }, d.i); await p.waitForTimeout(250);
    const after = await plan(d.i); if (after === before) fail(`offline, clearing day ${d.i + 1}'s sights didn't change its plan`); } }
  if (errs.length) fail(`${errs.length} script error(s): ${errs[0].slice(0, 200)}`);
  await b.close();
  console.log(fails ? `Seen-plan check: ${fails} problem(s)` : `Seen-plan check passed (${days} days; timetables changed the plan on ${changed}; every one the same offline)`);
  process.exit(fails ? 1 : 0);
})();
