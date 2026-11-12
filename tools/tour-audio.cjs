// Taps "Start the tour" then "Hear today's plan" on a phone-sized screen with tap-only audio rules,
// and fails unless the plan starts playing. Usage: node tools/tour-audio.cjs http://localhost:8000/
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] });
  const ctx = await b.newContext({ ...devices['Galaxy S9+'] }); const p = await ctx.newPage();
  await p.route(/cdnjs|fonts\.g/, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(process.argv[2] || 'http://localhost:8000/'); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(1500);
  await p.click('text=Continue trip'); await p.waitForTimeout(400);
  await p.click('#tab-plan').catch(() => {}); await p.waitForTimeout(300);
  const ts = await p.$('[data-act="tourstart"]'); if (!ts) throw new Error('no Start the tour button');
  await ts.scrollIntoViewIfNeeded(); await ts.tap(); await p.waitForTimeout(600);
  const btn = await p.$('[data-play^="intro:"]'); if (!btn) throw new Error("no Hear today's plan button");
  await btn.scrollIntoViewIfNeeded(); await btn.tap(); await p.waitForTimeout(5000);
  const st = await p.evaluate(() => { const x = document.querySelector('[data-play^="intro:"]'); return x.textContent + ' | ' + x.parentElement.querySelector('.state').textContent; });
  console.log("Hear today's plan:", st, errs.length ? errs : '');
  await b.close();
  if (!/Stop audio/.test(st) || !/Playing/.test(st) || errs.length) process.exit(1);
})().catch(e => { console.error(e.message); process.exit(1); });
