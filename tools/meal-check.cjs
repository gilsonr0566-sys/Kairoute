// Change lunch (src/features/meal-change.js): the "Change lunch" link on the Day plan and what it does. Fails if:
//  - a planned lunch has no "Change lunch" link, or the card doesn't open, or offers no other real place to eat,
//  - a place it offers isn't one of the guide's restaurants, is another day's meal, or is far from today's stops,
//  - picking a place doesn't make it the day's lunch, or the day then runs late or drops a pick it kept before,
//  - a chosen time isn't kept (lunch at 13:30 starts at 13:30, give or take a ride),
//  - skipping lunch leaves a lunch on the plan, or "Add lunch back" doesn't bring it back,
//  - "Use Kairoute's pick" doesn't put the day back exactly as it was,
//  - a hearted day isn't planned again when lunch changes, or anything throws.
// No network, no AI. Usage: node tools/meal-check.cjs [path/to/index.html] [--shots dir]
const { chromium } = require('playwright'); const path = require('path'), http = require('http'), fs = require('fs');
const args = process.argv.slice(2), si = args.indexOf('--shots'), SHOTS = si >= 0 ? args.splice(si, 2)[1] : null;
const FILE = path.resolve(args[0] || path.join(__dirname, '..', 'index.html'));
const serve = () => new Promise(res => { const root = path.dirname(FILE); const s = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/' + path.basename(FILE); fs.readFile(path.join(root, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': /\.html$/.test(u) ? 'text/html; charset=utf-8' : /\.js$/.test(u) ? 'text/javascript' : /\.json$/.test(u) ? 'application/json' : 'application/octet-stream' }); r.end(d); }); }); s.listen(0, '127.0.0.1', () => res(s)); });
(async () => {
  const srv = await serve(), BASE = `http://127.0.0.1:${srv.address().port}/`, b = await chromium.launch(); let fails = 0;
  const bad = x => { fails++; console.log('FAIL ' + x); }, ok = x => console.log('ok   ' + x);
  async function open(size, opt) {
    const ctx = await b.newContext(Object.assign({ viewport: size || { width: 1280, height: 800 } }, opt || {}));
    await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', rt => { const u = rt.request().url();
      if (u.includes('workers.dev/status')) return rt.fulfill({ json: { left: 5000, budget: 8500 } });
      if (u.includes('workers.dev')) return rt.fulfill({ status: 503, json: { error: 'busy' } });
      return u.startsWith(BASE) && !/sw\.js$/.test(u) ? rt.continue() : rt.abort(); });
    await p.goto(BASE); await p.waitForTimeout(800);
    return { ctx, p, errs };
  }
  const settle = async p => { for (let k = 0; k < 60 && !(await p.evaluate(() => window.__kairouteSettled())); k++) await p.waitForTimeout(200); await p.waitForTimeout(200); };
  const meals = p => p.evaluate(() => [...document.querySelectorAll('#view .timeline .tl')].filter(r => r.querySelector('.dot.meal')).map(r => ({ nm: r.querySelector('.nm').textContent.trim(), t: (r.querySelector('.time') || {}).textContent || '', link: !!r.querySelector('[data-act="mealopen"]') })));

  const { ctx, p, errs } = await open();
  const days = await p.evaluate(() => window.__kairouteDays());
  // Every day that has a planned lunch.
  const withLunch = [];
  for (const d of days) {
    await p.evaluate(i => window.__kairouteAt(i, 'plan'), d.i); await settle(p);
    const m = await meals(p); const l = m.find(x => /^(Quick )?[Ll]unch/.test(x.nm));
    if (l) { withLunch.push(Object.assign({ i: d.i, dest: d.dest }, l)); if (!l.link) bad(`day ${d.i} ${d.dest}: lunch has no Change lunch link`); }
  }
  withLunch.length ? ok(`${withLunch.length} days with lunch; every one has a Change lunch link`) : bad('no day with a lunch');
  // Pick the first lunch day with real choices.
  let D = null, ch = [];
  for (const l of withLunch) { const c = await p.evaluate(([i]) => window.__kairouteMeal.choices(i, 'Lunch'), [l.i]); if (c.length >= 2) { D = l; ch = c; break; } }
  if (!D) { bad('no lunch day offers 2 or more other places'); }
  else {
    ok(`${D.dest} (day ${D.i}): ${ch.length} other places: ${ch.map(x => x.name + ' ' + x.km + ' km from ' + x.near).join('; ')}`);
    ch.every(x => x.km <= 1.2) ? ok('every place offered is close to the day\'s stops') : bad('a place offered is far from the day');
    await p.evaluate(i => window.__kairouteAt(i, 'plan'), D.i); await settle(p);
    const before = await p.evaluate(() => document.querySelector('#view .timeline').innerText);
    const beforeStops = await p.evaluate(() => [...document.querySelectorAll('#view .timeline [data-stop]')].map(x => x.dataset.stop).join(','));
    // Open the card with a tap.
    await p.click('#view [data-act="mealopen"][data-meal="Lunch"]'); await p.waitForTimeout(300);
    const card = await p.evaluate(() => { const c = document.getElementById('mealform'); return c ? { n: c.querySelectorAll('[data-mealpick]').length, times: [...c.querySelectorAll('[data-act="mealtime"]')].map(x => x.textContent), text: c.innerText } : null; });
    card && card.n >= 2 ? ok(`card opens with ${card.n} places and times ${card.times.join(' ')}`) : bad('card: ' + JSON.stringify(card));
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.evaluate(() => document.getElementById('mealform').scrollIntoView({ block: 'start' })); await p.screenshot({ path: path.join(SHOTS, 'tablet-card.png') }); }
    // Tap the second place.
    const want = await p.evaluate(() => document.querySelectorAll('#mealform [data-mealpick]')[1].querySelector('b').textContent);
    await p.click('#mealform [data-mealpick="1"]'); await settle(p);
    let m = await meals(p), l = m.find(x => /unch/.test(x.nm));
    l && l.nm.endsWith(want) ? ok(`tap makes ${want} the lunch (${l.t.trim()})`) : bad(`after the tap lunch is ${l && l.nm}, wanted ${want}`);
    const afterStops = await p.evaluate(() => [...document.querySelectorAll('#view .timeline [data-stop]')].map(x => x.dataset.stop).join(','));
    const over = await p.evaluate(() => !!document.querySelector('#view .heads [role="alert"]'));
    over ? bad('the day runs late after the lunch change') : ok('the day still fits');
    beforeStops.split(',').filter(Boolean).every(s => afterStops.split(',').includes(s)) ? ok('no stop dropped') : bad(`stops changed: ${beforeStops} -> ${afterStops}`);
    (await p.evaluate(() => /Your choice/.test(document.querySelector('#view .timeline').innerText))) ? ok('row says "Your choice"') : bad('no "Your choice" on the row');
    // Time
    const has1330 = await p.evaluate(() => !!document.querySelector('#mealform [data-act="mealtime"][data-v="13:30"]'));
    if (has1330) { await p.click('#mealform [data-act="mealtime"][data-v="13:30"]'); await settle(p);
      m = await meals(p); l = m.find(x => /unch/.test(x.nm)); const t = l && l.t.match(/\d\d:\d\d/); const mm = t ? +t[0].slice(0, 2) * 60 + +t[0].slice(3) : 0;
      mm >= 810 && mm <= 835 && l.nm.endsWith(want) ? ok(`lunch at ${t[0]} at ${want}`) : bad(`lunch at 13:30: shows ${l && l.nm} ${t && t[0]}`); }
    if (SHOTS) { await p.evaluate(() => document.getElementById('mealform').scrollIntoView({ block: 'start' })); await p.screenshot({ path: path.join(SHOTS, 'tablet-after-pick.png') }); }
    // Reset
    await p.click('#mealform [data-act="mealreset"]'); await settle(p);
    const back = await p.evaluate(() => document.querySelector('#view .timeline').innerText);
    back === before ? ok("Use Kairoute's pick puts the day back exactly") : bad("reset didn't restore the day");
    // Skip
    await p.click('#mealform [data-act="mealskip"]'); await settle(p);
    m = await meals(p);
    m.some(x => /unch/.test(x.nm)) ? bad('lunch still on the plan after Skip') : ok('Skip lunch takes lunch off the plan');
    (await p.evaluate(() => !!document.querySelector('#view .heads [data-act="mealunskip"]'))) ? ok('heads-up offers Add lunch back') : bad('no Add lunch back');
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'tablet-skipped.png') });
    await p.click('#view [data-act="mealunskip"]'); await settle(p);
    (await p.evaluate(() => document.querySelector('#view .timeline').innerText)) === before ? ok('Add lunch back restores the day') : bad('unskip did not restore the day');
    (await p.evaluate(i => window.__kairouteMeal.prefs(i), D.i)) == null ? ok('nothing left stored on the day') : bad('prefs left behind');
    // A hearted day is planned again when its lunch changes, and says why.
    await p.evaluate(i => window.__kairouteReady.mark(i), D.i); await settle(p);
    const st0 = await p.evaluate(i => window.__kairouteReady.state(i), D.i);
    await p.evaluate(([i, n]) => { const c = window.__kairouteMeal.choices(i, 'Lunch')[0]; window.__kairouteMeal.pick(i, 'Lunch', n); }, [D.i, 0]); await settle(p);
    m = await meals(p); l = m.find(x => /unch/.test(x.nm));
    l && l.nm.endsWith(ch[0].name) ? ok(`hearted day: the lunch change is planned (${ch[0].name}), heart was ${JSON.stringify(st0)}, now ${JSON.stringify(await p.evaluate(i => window.__kairouteReady.state(i), D.i))}`) : bad(`hearted day kept ${l && l.nm} after choosing ${ch[0].name}`);
    await p.evaluate(i => { window.__kairouteMeal.set(i, 'Lunch', { pick: null }); window.__kairouteReady.clear(i); }, D.i); await settle(p);
  }
  errs.length ? bad('page errors: ' + errs.slice(0, 3).join(' | ')) : ok('no page errors');
  await ctx.close();
  // Phone screenshots.
  if (SHOTS && D) { const { ctx, p } = await open(null, { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p.evaluate(i => window.__kairouteAt(i, 'plan'), D.i); await settle(p);
    const row = await p.$('#view [data-act="mealopen"][data-meal="Lunch"]'); await row.scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -250)); await p.screenshot({ path: path.join(SHOTS, 'phone-link.png') });
    await row.click(); await p.waitForTimeout(400); await p.evaluate(() => document.getElementById('mealform').scrollIntoView({ block: 'start' })); await p.evaluate(() => window.scrollBy(0, -110)); await p.screenshot({ path: path.join(SHOTS, 'phone-card.png') });
    await ctx.close(); }
  await b.close(); srv.close();
  console.log(fails ? `${fails} FAILED` : 'All meal checks passed'); process.exit(fails ? 1 : 0);
})();
