// No-pills check (Richard, Nov 13: "Don't like pills"). Kairoute uses squared corners: tags 4px, buttons, chips and
// fields 6-8px, cards 10px. This opens every page on a tablet (both ways) and a phone and fails if any visible element
// is drawn as a pill: a wide box whose corner radius is half its height or more. Thin progress bars (under 12px tall)
// and circles are fine. Usage: node tools/pill-check.cjs [path/to/index.html]
const { chromium } = require('playwright'); const path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const SIZES = [['tablet upright', 800, 1280], ['tablet sideways', 1280, 800], ['phone', 412, 860]];
const PAGES = ['lobby', 'trip', 'plan', 'sites', 'guide', 'journal', 'settings', 'tour'];
(async () => {
  const b = await chromium.launch(); const found = new Map();
  for (const [name, w, h] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
    const p = await ctx.newPage();
    await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + FILE); await p.waitForTimeout(500);
    for (const v of PAGES) {
      await p.evaluate(v => window.__kairouteGo(v, 0), v); await p.waitForTimeout(200);
      await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true)); await p.waitForTimeout(100);
      const pills = await p.evaluate(() => {
        const out = [];
        document.querySelectorAll('body *').forEach(el => {
          if (el.closest('svg') || el.closest('.maplibregl-map')) return;
          const r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 12) return;
          const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return;
          const rad = Math.max(...['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'].map(k => /%/.test(cs[k]) ? parseFloat(cs[k]) / 100 * Math.min(r.width, r.height) : parseFloat(cs[k]) || 0));
          const drawn = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none';
          if (drawn && r.width > r.height * 1.3 && rad >= r.height / 2 - 1) {
            const cls = (el.className && el.className.baseVal === undefined ? el.className : '') || '';
            out.push(el.tagName.toLowerCase() + (cls ? '.' + String(cls).trim().split(/\s+/).join('.') : '') + ' "' + (el.innerText || '').trim().slice(0, 30) + '"');
          }
        });
        return out;
      });
      pills.forEach(x => { const k = x.replace(/ ".*$/, ''); if (!found.has(k)) found.set(k, `${name} / ${v}: ${x}`); });
    }
    await ctx.close();
  }
  await b.close();
  if (found.size) { console.log('Pill shapes found (use squared corners instead):'); [...found.values()].forEach(x => console.log('  FAIL ' + x)); process.exit(1); }
  console.log('No pills: every page uses squared corners');
})();
