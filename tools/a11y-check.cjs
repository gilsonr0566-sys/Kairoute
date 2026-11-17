// Accessibility check (user experience). On every page of every day, phone and tablet, light and dark:
//  names   every button, link and form field has a name a screen reader can say; images have alt text;
//          the page has a language and lets people zoom.
//  contrast  (CONTRAST=1, suggestion-only) text is readable against its background: 4.5:1, or 3:1 for large text.
// Run: node tools/a11y-check.cjs [index.html]       CONTRAST=1 node tools/a11y-check.cjs
const { chromium } = require('playwright'); const path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const CONTRAST = !!process.env.CONTRAST;
(async () => {
  const b = await chromium.launch(); let fails = 0; const found = new Map();
  const note = (key, msg) => { if (!found.has(key)) found.set(key, msg); };
  for (const scheme of CONTRAST ? ['light', 'dark'] : ['light'])
  for (const [tag, vp] of [['phone', { width: 412, height: 900 }], ['tablet', { width: 1280, height: 800 }]]) {
    const p = await b.newPage({ viewport: vp, colorScheme: scheme });
    await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + FILE); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(800);
    if (!CONTRAST && tag === 'phone') {
      const head = await p.evaluate(() => ({ lang: document.documentElement.lang, vp: (document.querySelector('meta[name=viewport]') || {}).content || '' }));
      if (!head.lang) note('lang', 'the page has no language set');
      if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/.test(head.vp)) note('zoom', 'the page stops people zooming in');
    }
    await p.getByText('Continue trip').click(); await p.waitForTimeout(400);
    const days = await p.evaluate(() => window.__kairouteDays());
    for (const d of days) for (const v of ['plan', 'sites', 'guide', 'tour', 'trip', 'journal']) {
      if ((v === 'trip' || v === 'journal') && d.i) continue; // trip-wide pages: once
      await p.evaluate(([i, v]) => window.__kairouteAt(i, v), [d.i, v]); await p.waitForTimeout(150);
      const r = await p.evaluate(CONTRAST => {
        const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
        const out = [];
        if (!CONTRAST) {
          const nameOf = e => (e.getAttribute('aria-label') || e.getAttribute('title') || (e.getAttribute('aria-labelledby') && document.getElementById(e.getAttribute('aria-labelledby')) || {}).textContent || e.textContent || e.value || [...e.querySelectorAll('img[alt],svg title')].map(x => x.alt || x.textContent).join('')).trim();
          for (const e of document.querySelectorAll('button, a[href], [role=button]')) if (vis(e) && !nameOf(e)) out.push(['name', (e.className || e.tagName).toString().slice(0, 40), e.outerHTML.slice(0, 120)]);
          for (const e of document.querySelectorAll('input:not([type=hidden]), select, textarea')) { if (!vis(e)) continue; const lab = e.labels && e.labels.length || e.getAttribute('aria-label') || e.getAttribute('title') || e.getAttribute('placeholder'); if (!lab) out.push(['field', (e.name || e.id || e.className || e.type).toString().slice(0, 40), e.outerHTML.slice(0, 120)]); }
          for (const e of document.querySelectorAll('img')) if (vis(e) && !e.hasAttribute('alt')) out.push(['alt', (e.getAttribute('src') || '').slice(0, 40), e.outerHTML.slice(0, 120)]);
        } else {
          const rgb = s => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const a = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: a[0], g: a[1], b: a[2], a: a.length > 3 ? a[3] : 1 }; };
          const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
          const bgOf = e => { let layers = []; for (let x = e; x; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; const c = rgb(cs.backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; } }
            let base = { r: 255, g: 255, b: 255 }; for (const c of layers.reverse()) base = { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a) }; return base; };
          const walker = document.createTreeWalker(document.querySelector('#view') || document.body, NodeFilter.SHOW_TEXT); const seen = new Set();
          while (walker.nextNode()) { const t = walker.currentNode; if (!t.textContent.trim()) continue; const e = t.parentElement; if (!e || seen.has(e) || !vis(e) || e.closest('[class*="maplibregl"]')) continue; seen.add(e); /* the map library's own hint is not ours to restyle */
            const cs = getComputedStyle(e), fg = rgb(cs.color), bg = bgOf(e); if (!fg || !bg) continue; const op = +cs.opacity;
            const f = { r: fg.r * fg.a * op + bg.r * (1 - fg.a * op), g: fg.g * fg.a * op + bg.g * (1 - fg.a * op), b: fg.b * fg.a * op + bg.b * (1 - fg.a * op) };
            const L1 = lum(f), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05), px = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
            const need = (px >= 24 || (bold && px >= 18.66) || e.matches('.star')) ? 3 : 4.5; /* rating stars are controls drawn as symbols: 3:1, as for icons */ if (ratio < need - 0.05) out.push(['contrast', (e.className || e.tagName).toString().slice(0, 40) + ' ' + ratio.toFixed(2), t.textContent.trim().slice(0, 50)]); }
        }
        return out;
      }, CONTRAST);
      for (const [kind, key, what] of r) note(kind + ':' + key.replace(/ [\d.]+$/, ''), `${kind} ${scheme} ${tag} day ${d.i + 1} ${v}: ${key} — ${what}`);
    }
    await p.close();
  }
  await b.close();
  for (const m of found.values()) console.log('FAIL ' + m); fails = found.size;
  console.log(fails ? `${CONTRAST ? 'Contrast' : 'Accessibility'} check: ${fails} distinct problem(s)` : `${CONTRAST ? 'Contrast' : 'Accessibility'} check passed`);
  process.exit(fails ? 1 : 0);
})();
