// Day ready check (the heart, Richard Nov 14): one tap marks a day ready and the heart shows on that day in the day
// list with a count; the app never reshuffles a hearted day on its own ("Suggest my tour" for the city leaves it
// alone); a change the traveler didn't make (here: the ship leaves earlier, so a sight no longer fits) still goes
// in, with a note, and the heart turns to an outline until confirmed; the traveler's own change clears the heart;
// the heart survives a reload; every day hearted shows "Your trip is ready" once, with the summary.
// Usage: node tools/ready-check.cjs [path/to/index.html]
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
(async () => {
  // Served over http like the real site, not opened as a file. Reopening the page while the app was still filling
  // other days in the background sometimes came back with the copy saved before the tap (about 1 run in 4), so the
  // check now waits for the app to settle and for the heart to be in the shared store before it reopens.
  const srv = http.createServer((q, r) => { const f = path.join(path.dirname(FILE), decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '')) ; const name = f === path.dirname(FILE) + path.sep ? FILE : f;
    fs.readFile(name, (e, buf) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': /\.html$/.test(name) ? 'text/html' : /\.js$/.test(name) ? 'text/javascript' : /\.json$/.test(name) ? 'application/json' : 'application/octet-stream' }); r.end(buf); }); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const BASE = `http://127.0.0.1:${srv.address().port}/`, URL0 = BASE + path.basename(FILE);
  const b = await chromium.launch(); let fails = 0; const fail = m => { fails++; console.log('FAIL ' + m); }, ok = m => console.log('ok   ' + m);
  const ctx = await b.newContext({ viewport: { width: 412, height: 860 }, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', e => fail('page error ' + e.message));
  await p.route('**/*', r => r.request().url().startsWith(BASE) && !/\/sw\.js|version\.txt|ai\.json/.test(r.request().url()) ? r.continue() : r.abort());
  // Start once the app has finished filling the other days in the background (it saves after each one).
  const settled = () => p.waitForFunction(() => window.__kairouteSettled && window.__kairouteSettled() && window.__kairouteReady, null, { timeout: 30000 });
  await p.goto(URL0); await settled();
  const days = await p.evaluate(() => window.__kairouteDays()), R = f => p.evaluate(f);
  const D = days.find(d => d.type === 'port' && d.city);
  // Wait on real state, never a fixed delay (a fixed delay made this check fail about 1 run in 4).
  const frame = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  const go = async (v, i) => { await p.evaluate(([v, i]) => window.__kairouteGo(v, i), [v, i]); await frame(); if (v === 'plan') await p.waitForSelector('.heartbtn', { timeout: 5000 }); };
  const until = async (f, arg, ms = 5000) => { const t = Date.now(); for (;;) { const v = await p.evaluate(f, arg); if (v) return v; if (Date.now() - t > ms) return v; await frame(); } };
  const pressed = want => until(w => { const h = document.querySelector('.heartbtn'); return h && h.getAttribute('aria-pressed') === w; }, want);
  // The browser keeps what a page saves in a shared store a moment after the page writes it; reloading before that
  // reads the older copy (seen here as "the heart was lost on reload" right after the tap). A second page reads the
  // shared store, so the reload waits until the heart is really there.
  const peek = await ctx.newPage(); await peek.route('**/*', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>peek</title>' }));
  await peek.goto(URL0 + '?peek');
  const savedReady = async i => { const t = Date.now(); while (Date.now() - t < 5000) { const v = await peek.evaluate(i => { try { const tr = JSON.parse(localStorage.getItem('wayside.trip2') || 'null'); return !!(tr && tr.days[i] && tr.days[i].ready); } catch (e) { return false; } }, i).catch(() => false); if (v) return true; await peek.waitForTimeout(50); } return false; };
  // 1. One tap
  await go('plan', D.i); await p.click('.heartbtn'); await pressed('true');
  const s1 = await R(() => ({ st: document.querySelector('.heartbtn').getAttribute('aria-pressed'), chip: !!document.querySelector('.daychip[aria-pressed="true"] .dheart.ok'), count: document.getElementById('dayCount').textContent }));
  if (s1.st !== 'true' || !s1.chip || !/1\s*$/.test(s1.count)) fail(`tapping the heart: pressed ${s1.st}, heart on the day ${s1.chip}, count "${s1.count}"`); else ok('one tap marks the day ready; the heart shows on that day in the day list, with the count');
  // 2. Survives a reload (saved with the trip, so it syncs and works offline)
  if (!(await savedReady(D.i))) fail('the heart was not saved with the trip');
  await p.reload(); await settled(); await go('plan', D.i);
  if (await R(() => (document.querySelector('.heartbtn') || {}).getAttribute && document.querySelector('.heartbtn').getAttribute('aria-pressed')) !== 'true') fail('the heart was lost on reload'); else ok('the heart is saved with the trip');
  // 3. "Suggest my tour" for the city leaves the hearted day's sights alone
  const city = days.filter(d => d.cityKey && d.cityKey === D.cityKey);
  const other = days.find(d => d.type !== 'port' && d.city && d.i !== D.i && days.filter(x => x.dest === d.dest).length > 1);
  if (other) { await go('plan', other.i); const A = days.find(d => d.dest === other.dest && d.i !== other.i);
    await go('plan', A.i); await p.click('.heartbtn'); await pressed('true'); const before = await p.evaluate(i => window.__kairouteTruth(i).selected.join(), A.i);
    await go('sites', other.i); const tourBtn = p.locator('[data-act="suggesttour"]').first(), btn = await tourBtn.count(); if (btn) { await tourBtn.click(); await frame(); }
    const after = await p.evaluate(i => window.__kairouteTruth(i).selected.join(), A.i), st = await p.evaluate(i => window.__kairouteReady.state(i), A.i);
    if (!btn) fail('no Suggest my tour button to test with'); else if (before !== after || st !== 'ok') fail(`Suggest my tour changed a hearted day: ${before} -> ${after} (${st})`); else ok(`Suggest my tour for ${other.dest} leaves the hearted day's sights as they were`); }
  // 4. A change the traveler didn't make (the ship leaves early): it goes in, with a note, and the heart turns to an outline
  await go('plan', D.i);
  const picks = await p.evaluate(i => window.__kairouteTruth(i).picks.length, D.i);
  await p.evaluate(i => { const d = window.__kairouteDays()[i]; window.__kairouteTime.set(i, { allAboard: '11:00' }); }, D.i); await go('plan', D.i);
  const s4 = await R(() => ({ st: document.querySelector('.heartbtn').className, banner: [...document.querySelectorAll('.banner')].map(x => x.innerText).find(t => /marked this day ready/.test(t)) || '', chip: !!document.querySelector('.daychip[aria-pressed="true"] .dheart.changed') }));
  if (picks < 2) fail('test day has too few sights to show a change');
  else if (!/changed/.test(s4.st) || !s4.banner || !s4.chip) fail(`after the ship time moved: heart "${s4.st}", note "${s4.banner}", outline on the day ${s4.chip}`); else ok('a change the app had to make (ship leaves earlier) shows a note and turns the heart to an outline: ' + s4.banner.split('.')[0]);
  await p.click('.banner [data-act="dayready"]'); await pressed('true');
  if (await p.evaluate(i => window.__kairouteReady.state(i), D.i) !== 'ok') fail('Confirm did not mark the day ready again'); else ok('Confirm marks it ready again');
  // 5. The traveler's own change clears the heart, with no warning
  await p.evaluate(i => { const T = window.__kairouteTruth(i); window.__kairouteDay(i, T.selected.slice(1)); }, D.i); await go('plan', D.i);
  const s5 = await R(() => ({ st: document.querySelector('.heartbtn').getAttribute('aria-pressed'), banner: [...document.querySelectorAll('.banner')].some(x => /marked this day ready/.test(x.innerText)) }));
  if (s5.st !== 'false' || s5.banner) fail(`after the traveler removed a sight: pressed ${s5.st}, warning ${s5.banner}`); else ok("the traveler's own change clears the heart quietly");
  // 6. Every day hearted: "Your trip is ready", once
  const all = await R(() => window.__kairouteReady.days());
  for (const i of all) { await go('plan', i); await p.evaluate(i => { if (window.__kairouteReady.state(i) !== 'ok') window.__kairouteReady.mark(i); }, i); }
  await until(() => { const c = document.getElementById('celebrate'); return !!(c && c.classList.contains('on')); }, null);
  const cel = await R(() => { const c = document.getElementById('celebrate'); return c && { title: c.querySelector('h2').textContent, stats: c.querySelector('.celstats').innerText.replace(/\s+/g, ' '), btn: !!c.querySelector('[data-act=celoffdl], .celoff') }; });
  if (!cel || !/trip is ready/i.test(cel.title) || !cel.btn) fail('no "Your trip is ready" when every day is hearted ' + JSON.stringify(cel)); else ok(`every day hearted: "${cel.title}" with ${cel.stats} and the offline download`);
  await p.click('[data-act=celclose]'); await go('plan', all[0]); await p.waitForTimeout(500); // nothing to wait on: proving something does NOT appear
  if (await R(() => !!document.getElementById('celebrate'))) fail('the celebration showed again'); else ok('it shows once (replay from the Trip screen)');
  await go('trip', 0); if (!(await p.$('[data-act=celebrate]'))) fail('no replay on the Trip screen');
  await b.close(); srv.close();
  if (fails) { console.log(`ready-check: ${fails} problem(s)`); process.exit(1); }
  console.log('ready-check: all good');
})();
