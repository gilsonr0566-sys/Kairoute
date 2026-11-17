// Suggested days and "If you come back" (Richard, Nov 16): on a booked city (every day dated) a pick that comes off a
// shorter day goes to "If you come back", shown once; with the days not booked yet, a quiet "Your picks fit best in N
// days" shows instead, and never "you need more days". Usage: node tools/later-check.cjs [index.html]
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const errs = []; let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; }; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
  await p.goto('file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'))); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(500);
  await p.getByText('Continue trip').click(); await p.waitForTimeout(400);
  for (const i of [19, 20, 21]) { await p.evaluate(i => window.__kairouteGo('sites', i), i); await p.waitForTimeout(600); }
  const b0 = await p.evaluate(() => window.__kairouteLater(20)); ok(b0.booked && !b0.hint, 'a dated city shows no days hint'); ok(!(await p.locator('.daysfit').count()), 'no days hint on screen for a booked city');
  // Shorten day 21 (index 20) to 2 hours and accept: picks come off -> If you come back
  await p.evaluate(() => window.__kairouteGo('plan', 20)); await p.waitForTimeout(500); await p.evaluate(() => window.__kairouteSetHours(2)); await p.waitForTimeout(800); const c = p.locator('[data-act="cutok"]').first(); ok(await c.count() > 0, 'a shorter day asks first'); if (await c.count()) await c.click(); await p.waitForTimeout(800);
  await p.evaluate(() => window.__kairouteGo('sites', 20)); await p.waitForTimeout(800);
  const a1 = await p.evaluate(() => window.__kairouteLater(20)); ok(a1.later.length > 0, 'picks that came off a booked day are kept for "If you come back": ' + a1.later.join(', '));
  const blk = await p.evaluate(() => { const e = document.querySelector('details.comeback'); return e ? e.textContent.replace(/\s+/g, ' ') : ''; }); ok(/If you come back/.test(blk) && a1.later.every(n => blk.includes(n)), 'Change stops shows the "If you come back" list');
  const dup = await p.evaluate(names => { const t = [...document.querySelectorAll('#view .sitelist')].map(x => x.textContent).join(' '); return names.filter(n => t.split(n).length > 2); }, a1.later); ok(!dup.length, 'each come-back sight is listed once' + (dup.length ? ': twice: ' + dup.join(', ') : ''));
  
  // Not booked: Madrid's days without dates
  await p.evaluate(() => window.__kairouteEdit('all', d => /Madrid/.test(d.destination) ? { date: '' } : {}));
  await p.evaluate(() => window.__kairouteGo('sites', 20)); await p.waitForTimeout(800);
  const u = await p.evaluate(() => (document.querySelector('.daysfit') || {}).textContent || ''); ok(/^Your picks fit best in \d+(–\d+)? days?\.$/.test(u), 'days not booked: quiet hint "' + u + '"'); ok(!/need more/i.test(await p.evaluate(() => document.body.innerText)), 'never says "you need more days"'); ok(!(await p.locator('details.comeback').count()), 'no come-back list while the days are not booked'); const vis = await p.evaluate(() => document.querySelector('#view').innerText); ok(a1.later.every(n => vis.includes(n)), 'with the days not booked, the sights that came off are still offered in the list');
  ok(!errs.length, 'no page errors ' + errs.join(' | ')); await b.close(); console.log(fails ? fails + ' FAIL' : 'Come-back check passed'); process.exit(fails ? 1 : 0); })();
