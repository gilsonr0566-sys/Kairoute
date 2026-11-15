// Printable plan live check: on the published site, the Trip page's "Print or save as PDF" opens the print dialog
// with the whole trip laid out (one section per day, stops with times, safety wording), and the Day plan's
// "Print or save this day" prints just that day. Prints what the PDF holds.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://gilsonr0566-sys.github.io/Kairoute/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(4000);
  let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
  console.log('version', await p.evaluate(() => fetch('version.txt', { cache: 'no-store' }).then(r => r.text())).catch(() => '?'));
  const days = await p.evaluate(() => window.__kairouteDays());
  await p.evaluate(() => window.__kairouteGo('trip', 0)); await p.waitForTimeout(800);
  ok(await p.$('[data-act=printtrip]'), 'Trip page has Print or save as PDF');
  await p.click('[data-act=printtrip]'); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => window.__printed === 1), 'print dialog opened');
  await p.emulateMedia({ media: 'print' });
  const t = await p.evaluate(() => document.getElementById('printView').innerText);
  const sec = await p.evaluate(() => document.querySelectorAll('#printView .pday').length);
  ok(sec === days.length, `one section per day (${sec} of ${days.length})`);
  ok(/All aboard/i.test(t) && /Leave by/i.test(t) && /Arrive/i.test(t), 'key times and arrive/leave shown');
  ok(/times are final/.test(t) && /safety margin/.test(t) && !/guarantee/i.test(t), 'safety wording, no "guarantee"');
  const hidden = await p.evaluate(() => [...document.body.children].filter(e => e.id !== 'printView' && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0).map(e => e.id || e.className));
  ok(!hidden.length, 'only the plan prints' + (hidden.length ? ': ' + hidden.join(',') : ''));
  const pdf = await p.pdf({ format: 'Letter', printBackground: true });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  ok(pages >= days.length - 4, `PDF has ${pages} pages`);
  await p.emulateMedia({ media: 'screen' });
  const port = days.find(d => d.city && d.type === 'port');
  await p.evaluate(i => window.__kairouteGo('plan', i), port.i); await p.waitForTimeout(1500);
  await p.evaluate(() => { const f = document.querySelector('.morefold'); if (f) f.open = true; });
  await p.click('[data-act=printday]'); await p.waitForTimeout(1000);
  const one = await p.evaluate(() => document.querySelectorAll('#printView .pday').length);
  ok(one === 1, 'Print this day prints one day');
  console.log('\n--- first lines of the trip print ---\n' + t.split('\n').filter(Boolean).slice(0, 40).join('\n'));
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); console.log(fail ? `\n${fail} failed` : '\nPrint live check passed'); process.exit(fail ? 1 : 0);
})();
