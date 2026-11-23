// A brought lunch eaten during a long visit, as the Day plan shows it (Nov 23; see lunch-during-check.cjs for the planner).
// The built Beta 2 app offline: the example trip's first day in town, one 6-hour visit far from any place to eat. The
// visit must be one stop with a line "Lunch during this visit ... eat about <a time between 11:30 am and 2:30 pm>", no
// lunch row after it, and the screen rules pass. Usage: node tools/beta2/lunch-during-screen.cjs [beta2-site/index.html]
const { chromium } = require('playwright'), path = require('path'), R = require('./screen-rules.cjs');
const file = path.resolve(process.argv[2] || 'beta2-site/index.html'), fails = []; let n = 0;
const ok = (what, cond, got) => { n++; if (!cond) fails.push(what + (got !== undefined ? ' (got ' + JSON.stringify(got).slice(0, 300) + ')' : '')); };
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
  await ctx.route(u => !/^file:/.test(String(u)), r => r.fulfill({ status: 503, body: '' }));
  const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.goto('file://' + file); await p.waitForTimeout(2500);
  const bt = p.locator('[data-act="loadsample"]').first(); if (await bt.isVisible().catch(() => false)) await bt.click(); await p.waitForTimeout(5000);
  const i = await p.evaluate(() => { const days = window.__kairouteDays(), i = days.findIndex(d => d.type === 'land'), d = days[i];
    // 50 km out of town, where the guide knows no place to eat: a long visit over lunchtime.
    window.__kairouteArea.addSites(i, [{ id: 'zz-ranch', name: 'Testland Ranch', category: 'Ranch', lat: 38.25, lng: 23.40, minutes: 360, summary: 'x', guide: 'x' }]);
    window.__kairouteDay(i, ['zz-ranch'], { startTime: '09:00', hours: 9 }); window.__kairouteGo('plan', i); return i; });
  await p.waitForTimeout(2500);
  const text = await p.evaluate(() => document.querySelector('#view').innerText), lines = text.split('\n');
  const line = lines.find(l => /^Lunch during this visit/.test(l)), m = line && /eat about (\d{1,2}):(\d\d) (am|pm)/.exec(line);
  const at = m ? (+m[1] % 12 + (m[3] === 'pm' ? 12 : 0)) * 60 + +m[2] : null;
  ok('the visit says lunch is eaten during it', !!line, lines.filter(l => /lunch|Ranch/i.test(l)));
  ok('at a lunch hour (11:30 am to 2:30 pm)', at != null && at >= 690 && at <= 870, line);
  ok('the visit is one stop', lines.filter(l => l.trim() === 'Testland Ranch').length === 1, lines.filter(l => /Testland Ranch/.test(l)));
  ok('no lunch row of its own after the visit', !lines.some(l => /^Lunch: Bring your own/i.test(l)), lines.filter(l => /^Lunch/i.test(l)));
  const rf = R.rules(text, { type: 'land' }); ok('screen rules pass', !rf.length, rf.map(f => f.rule + ': ' + f.msg));
  ok('no page errors', !errs.length, errs);
  await b.close();
  console.log(fails.length ? 'FAILED:\n- ' + fails.join('\n- ') : '');
  console.log(`lunch-during-screen (day ${i + 1}): ${n - fails.length} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})();
