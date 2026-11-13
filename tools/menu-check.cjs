// Drop-down check: the Day plan's More menu must open fully on screen on every day, at every screen size:
// every item inside the window, clear of the nav bar, and not covered by anything (checked at each item's
// left edge, middle and right edge). Fails the publish otherwise. Usage: node tools/menu-check.cjs [index.html]
const { chromium } = require('playwright'); const path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const SIZES = [['tablet upright', 800, 1280], ['tablet sideways', 1280, 800], ['tablet sideways, browser bars', 1280, 720], ['computer', 1440, 900], ['phone', 412, 860], ['phone small', 360, 640]];
(async () => {
  const b = await chromium.launch(); let fails = 0, checked = 0;
  for (const [name, w, h] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
    const p = await ctx.newPage(); p.on('pageerror', e => { console.log(`FAIL ${name}: page error ${e.message}`); fails++; });
    await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + FILE); await p.waitForTimeout(500);
    const n = await p.evaluate(() => (window.__kairouteDays ? window.__kairouteDays() : []).length || 1);
    const bad = [];
    for (let i = 0; i < n; i++) {
      await p.evaluate(i => window.__kairouteGo('plan', i), i); await p.waitForTimeout(120);
      const sm = p.locator('details.planmore > summary').filter({ visible: true }).first();
      if (!(await sm.count())) { if (!(await p.evaluate(i => window.__kairouteDays()[i].type === 'sea', i))) bad.push(`day ${i + 1}: no More button`); continue; }
      await sm.scrollIntoViewIfNeeded(); await sm.click(); await p.waitForTimeout(120);
      const r = await p.evaluate(() => {
        const m = [...document.querySelectorAll('details.planmore[open]')].find(e => e.offsetParent); if (!m) return ['menu did not open'];
        const vw = document.documentElement.clientWidth, vh = window.innerHeight, out = [];
        const t = document.querySelector('header.top .tabs'), tr = t && getComputedStyle(t).display !== 'none' ? t.getBoundingClientRect() : null;
        for (const it of m.querySelectorAll('.menupanel .menuitem')) {
          const q = it.getBoundingClientRect(), lbl = it.textContent.trim().slice(0, 30);
          if (!q.width) continue;
          if (q.left < 0 || q.right > vw || q.top < 0 || q.bottom > vh) { out.push(`"${lbl}" runs off screen`); continue; }
          if (tr && q.left < tr.right && q.right > tr.left && q.top < tr.bottom && q.bottom > tr.top) { out.push(`"${lbl}" sits under the nav bar`); continue; }
          const y = q.top + q.height / 2;
          for (const x of [q.left + 3, q.left + q.width / 2, q.right - 3]) { const e = document.elementFromPoint(x, y); if (!e || !it.contains(e) && !e.contains(it)) { out.push(`"${lbl}" is covered`); break; } }
        }
        return out;
      });
      checked++; if (r.length) bad.push(`day ${i + 1}: ` + r.join('; '));
      await p.keyboard.press('Escape'); await p.mouse.click(w - 2, h / 2); await p.waitForTimeout(60);
      await p.evaluate(() => document.querySelectorAll('details.planmore[open]').forEach(m => m.open = false));
    }
    if (bad.length) { fails++; console.log(`FAIL ${name} (${w}x${h}): ` + bad.join(' | ')); } else console.log(`ok   ${name} (${w}x${h}): More menu fully visible on all ${n} days`);
    await ctx.close();
  }
  await b.close();
  if (fails || !checked) { console.log(`menu-check: ${fails} failing size(s)`); process.exit(1); }
  console.log('menu-check: all good');
})();
