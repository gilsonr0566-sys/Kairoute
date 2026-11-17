// Locked picks survive a fold, and the day lists what was taken off (Richard, Nov 17: his hearted Jul 1 Athens day said
// "Acropolis and Parthenon is no longer in the guide" and took it off, though the guide still had it). Cause: a second
// copy of the Acropolis arrived (a city guide's "Acropolis of Athens") and the duplicates check kept that copy, under the
// shown name "Acropolis and Parthenon" but with the other copy's id; the heart's saved plan still named the old id.
// Here: heart the Athens day, bring the twin in, and the day must stay locked with the Acropolis on it. Then a pick that
// no longer fits must show in "Taken off this day" with its reason, and Put back must bring it back.
// Usage: node tools/offlog-check.cjs [index.html]
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 412, height: 900 } })).newPage(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; }; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
  await p.goto('file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'))); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(500);
  await p.getByText('Continue trip').click(); await p.waitForTimeout(400);
  const days = await p.evaluate(() => window.__kairouteDays());
  let A = null;
  for (const d of days.filter(d => /athens/i.test(d.dest || ''))) { const sel = await p.evaluate(i => window.__kairouteTruth(i).selected, d.i); if (sel.includes('acropolis')) { A = d.i; break; } }
  if (A == null) { A = days.find(d => /athens/i.test(d.dest || '') && d.type !== 'sea').i; await p.evaluate(i => { const s = window.__kairouteTruth(i).selected; window.__kairouteEdit(i, { selected: ['acropolis'].concat(s.filter(x => x !== 'acropolis')) }); }, A); }
  const names = i => p.evaluate(i => window.__kairouteReady.shape(i), i);
  await p.evaluate(i => window.__kairouteAt(i, 'plan'), A); await p.waitForTimeout(300);
  const before = await names(A);
  ok(/Acropolis/.test(before), 'the Athens day plans the Acropolis: ' + before);
  await p.evaluate(i => window.__kairouteReady.mark(i), A);
  ok(await p.evaluate(i => window.__kairouteReady.state(i), A) === 'ok', 'the day is hearted');
  // The twin wins the fold (longer write-up, not built in), so the kept sight carries the twin's id.
  const tw = await p.evaluate(i => window.__kairouteOff.twin(i, 'acropolis', { name: 'Acropolis of Athens' }), A);
  ok(tw.n >= 1 && tw.kept.length === 1, `the two copies fold into one: ${JSON.stringify(tw.kept)}`);
  await p.evaluate(i => window.__kairouteAt(i, 'plan'), A); await p.waitForTimeout(300);
  const st = await p.evaluate(i => ({ state: window.__kairouteReady.state(i), plan: window.__kairouteReady.plan(i), sel: window.__kairouteTruth(i).selected }), A);
  const after = await names(A);
  ok(/Acropolis/.test(after), 'the Acropolis is still on the day: ' + after);
  ok(st.state === 'ok' && st.plan && st.plan.locked && !st.plan.why, `the day stays locked (state ${st.state}, ${st.plan && st.plan.why || 'no break'})`);
  ok(st.sel.includes(tw.kept[0].id), 'the pick follows the sight that stayed (' + tw.kept[0].id + ')');
  const txt0 = await p.evaluate(() => document.querySelector('#view').innerText);
  ok(!/no longer in the guide/i.test(txt0) && !/Your locked day changed/i.test(txt0), 'no "locked day changed" note');
  // A device that met the old bug: the lock names the old id, the sight now has another, and the pick was taken off.
  // On the next look the pick must be back and the heart hold, with no tap.
  await p.evaluate(i => window.__kairouteReady.mark(i), A);
  const ob = await p.evaluate(i => window.__kairouteOff.oldBug(i, window.__kairouteTruth(i).selected.find(x => /acropolis/.test(x))), A);
  await p.evaluate(i => window.__kairouteAt(i, 'plan'), A); await p.waitForTimeout(400);
  const rp = await p.evaluate(([i, nid]) => ({ state: window.__kairouteReady.state(i), sel: window.__kairouteTruth(i).selected, shape: window.__kairouteReady.shape(i), txt: document.querySelector('#view').innerText }), [A, ob.nid]);
  ok(!ob.error && rp.sel.includes(ob.nid) && /Acropolis/.test(rp.shape), `a day the old bug took the Acropolis off gets it back by itself (${ob.error || rp.shape})`);
  ok(rp.state === 'ok' && !/Your locked day changed|no longer in the guide/i.test(rp.txt), `and its heart holds with no note (state ${rp.state})`);
  // Taken off this day: unheart, cut the day's hours so a pick no longer fits, and the list says which and why.
  await p.evaluate(i => window.__kairouteReady.clear(i), A);
  await p.evaluate(i => { window.__kairouteEdit(i, { hours: 1.5, cutOk: true }); }, A); await p.evaluate(i => window.__kairouteAt(i, 'plan'), A); await p.waitForTimeout(600);
  const log = await p.evaluate(i => window.__kairouteOff.shown(i), A);
  ok(log.length >= 1 && log.every(o => o.why), 'the day lists what was taken off, with a reason: ' + log.map(o => o.n + ' (' + o.why + ')').join('; '));
  const note = await p.locator('[data-act=bumpok]').count(); if (note) { await p.locator('[data-act=bumpok]').first().click(); await p.waitForTimeout(400); }
  const ui = await p.evaluate(() => { const f = document.querySelector('.offlog'); return f ? { open: f.open, text: f.innerText, btn: f.querySelectorAll('[data-act=offback]').length } : null; });
  ok(ui && /Taken off this day/.test(ui.text) && ui.btn >= 1, 'the Day plan shows "Taken off this day" with Put back');
  await p.locator('.offlog summary').click().catch(() => {}); await p.waitForTimeout(200); await p.locator('.offlog').scrollIntoViewIfNeeded().catch(() => {}); await p.screenshot({ path: process.env.SHOT || '/tmp/offlog.png', fullPage: false }).catch(() => {});
  // Put back: hours restored, then one tap brings the first one back.
  await p.evaluate(i => window.__kairouteEdit(i, { hours: 8 }), A); await p.evaluate(i => window.__kairouteAt(i, 'plan'), A); await p.waitForTimeout(600);
  const left = await p.evaluate(i => window.__kairouteOff.shown(i), A);
  if (left.length) { const first = left[0].n; await p.evaluate(() => { const f = document.querySelector('.offlog'); if (f) f.open = true; }); await p.locator('[data-act=offback]').first().click(); await p.waitForTimeout(500);
    const now = await p.evaluate(i => window.__kairouteOff.shown(i).map(o => o.n), A); ok(!now.includes(first), 'Put back brings ' + first + ' back'); }
  else ok(true, 'picks came back by themselves once the day was long enough again');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); console.log(fails ? `Taken-off check failed (${fails})` : 'Taken-off check passed'); process.exit(fails ? 1 : 0);
})();
