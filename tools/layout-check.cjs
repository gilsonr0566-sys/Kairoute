// Layout check: every page follows the design rules (docs/design-rules.md) at tablet and phone sizes, held
// upright and sideways. Fails the publish if any page:
//  - runs off the side of the screen (anything wider than the window, outside a sideways-scrolling strip),
//  - scrolls as a whole on a tablet (tablet pages fit the window; their panels scroll on their own),
//  - has a day page without the shared head (day name, and on ship/train/flight days the back-to-the-ship
//    countdown in the head), or shows more than one main action,
//  - shows the same title twice, or has buttons too small to tap,
//  - draws a way of getting around (walk, taxi, bus, train, ferry...) in anything but its own colour, icon and line.
// Usage: node tools/layout-check.cjs [path/to/index.html]
const { chromium } = require('playwright'); const path = require('path'); const wideFont = require('./wide-font.cjs');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const SIZES = [['tablet sideways', 1280, 800], ['tablet sideways, browser bars', 1280, 720], ['tablet upright', 800, 1280], ['computer', 1440, 900],
  ['phone', 412, 860], ['phone small', 360, 740], ['phone sideways', 860, 412]];
const PAGES = ['lobby', 'trip', 'plan', 'sites', 'guide', 'tour', 'journal', 'settings', 'privacy', 'terms'];
const DAY_PAGES = ['plan', 'sites', 'guide'];
(async () => {
  const b = await chromium.launch(); let fails = 0, checks = 0;
  for (const [name, w, h] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} }); await ctx.addInitScript(wideFont);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + FILE); await p.waitForTimeout(500);
    const days = await p.evaluate(() => window.__kairouteDays());
    const land = days.find(d => d.city && d.type === 'land'), port = days.find(d => d.city && d.type === 'port'), sea = days.find(d => d.type === 'sea');
    const tablet = w >= 800 && h >= 560, bad = [];
    for (const D of [land, port, sea].filter(Boolean)) for (const v of PAGES) {
      if (D === port && !DAY_PAGES.concat('tour').includes(v)) continue;
      if (D === sea && v !== 'plan') continue; // a day at sea: its "get ready for the next ports" page
      await p.evaluate(([v, i]) => { window.__kairouteGo(v, i); }, [v, D.i]); await p.waitForTimeout(150);
      // walk through the pages a traveler would visit, scrolled the way they'd leave them
      const r = await p.evaluate(({ v, tablet, dayPage, fixedDay }) => {
        const out = [], W = document.documentElement.clientWidth, vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.closest('details:not([open]) > :not(summary)'); };
        const scrollsSideways = e => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const ox = getComputedStyle(a).overflowX; if (ox === 'auto' || ox === 'scroll' || (ox === 'hidden' && a.id !== 'view')) return true; } return false; };
        const view = document.getElementById('view');
        // 1. nothing runs off the side
        const wide = [...view.querySelectorAll('*')].filter(e => vis(e) && !scrollsSideways(e) && getComputedStyle(e).position !== 'fixed').filter(e => { const r = e.getBoundingClientRect(); return r.right > W + 1 || r.left < -1; });
        if (wide.length) out.push(`runs off the side: ${wide.slice(0, 2).map(e => (e.className || e.tagName).toString().split(' ')[0] + ' "' + (e.innerText || '').trim().slice(0, 24) + '"').join(', ')}`);
        if (document.documentElement.scrollWidth > W + 1) out.push(`page is ${document.documentElement.scrollWidth - W}px wider than the screen`);
        // 2. tablets: the page fits the window (lobby and the new-trip form are exempt: they're one-time screens)
        if (tablet && v !== 'lobby' && document.documentElement.scrollHeight > innerHeight + 1) out.push(`page scrolls on a tablet (${document.documentElement.scrollHeight}px tall in a ${innerHeight}px window)`);
        // 3. the shared head on day pages, with the countdown on ship, train and flight days
        if (dayPage) {
          const heads = [...view.querySelectorAll('.dayhead')].filter(vis);
          if (heads.length !== 1) out.push(`${heads.length} page heads (want 1)`);
          else if (!heads[0].querySelector('.dayname')) out.push('page head has no day name');
          if (fixedDay && !view.querySelector('.dayhead #cdCard')) out.push('no back-to-the-ship countdown in the head');
        }
        if (v === 'tour' && fixedDay && !view.querySelector('.tourhead #cdCard')) out.push('tour: no back-to-the-ship countdown in the head');
        // 4. one main action at most
        const main = [...document.querySelectorAll('[data-act="tourstart"]')].filter(vis);
        if (main.length > 1) out.push(`${main.length} Start the tour buttons on screen`);
        // 5. no title shown twice
        const titles = [...document.querySelectorAll('#view h2, #tripName')].filter(vis).map(e => (e.firstChild && e.firstChild.nodeType === 3 ? e.firstChild.textContent : e.innerText).trim()).filter(Boolean);
        const dup = titles.filter((t, i) => titles.indexOf(t) !== i);
        if (dup.length) out.push(`"${dup[0]}" shown twice`);
        // 6. buttons big enough to tap
        const tiny = [...view.querySelectorAll('button, .btn, summary, a.btn')].filter(e => vis(e) && !e.closest('.tl, .maplibregl-ctrl, .mapbox, .leaflet-control') && e.getBoundingClientRect().height < 30);
        if (tiny.length) out.push(`buttons under 30px tall: ${tiny.slice(0, 3).map(e => '"' + (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 20) + '"').join(', ')}`);
        return out;
      }, { v, tablet, dayPage: DAY_PAGES.includes(v), fixedDay: D === port });
      checks++;
      if (r.length) bad.push(`${v}${D === port ? ' (port day)' : D === sea ? ' (day at sea)' : ''}: ${r.join('; ')}`);
    }
    if (errs.length) bad.push('page errors: ' + errs.slice(0, 2).join(' | '));
    if (bad.length) { fails++; console.log(`FAIL ${name} (${w}x${h}):\n  ` + bad.join('\n  ')); }
    else console.log(`ok   ${name} (${w}x${h}): all ${PAGES.length} pages follow the layout rules`);
    await ctx.close();
  }
  // Ways of getting around (design rules, section 9): each kind has its own colour token, readable on light and dark,
  // kept apart for colour-blind eyes, and every leg on the timeline, the map and the map key uses its own kind's look.
  { const ctx = await b.newContext({ viewport: { width: 800, height: 1280 } }); await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
    const p = await ctx.newPage(); await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + FILE); await p.waitForTimeout(500); const bad = [], KINDS = ['walk', 'car', 'bus', 'train', 'ferry', 'flight', 'ship'];
    const lin = c => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4, rgb = h => [1, 3, 5].map(i => lin(parseInt(h.slice(i, i + 2), 16)));
    const lum = h => { const [r, g, bb] = rgb(h); return 0.2126 * r + 0.7152 * g + 0.0722 * bb; }, contrast = (a, c) => (Math.max(lum(a), lum(c)) + 0.05) / (Math.min(lum(a), lum(c)) + 0.05);
    const CVD = { normal: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], deuteranopia: [[0.367, 0.861, -0.228], [0.280, 0.673, 0.047], [-0.012, 0.043, 0.969]], protanopia: [[0.152, 1.053, -0.205], [0.115, 0.786, 0.099], [-0.004, -0.048, 1.052]], tritanopia: [[1.256, -0.077, -0.179], [-0.078, 0.931, 0.148], [0.005, 0.691, 0.304]] };
    const lab = c => { const [r, g, bb] = c, f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116, X = (0.4124 * r + 0.3576 * g + 0.1805 * bb) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * bb, Z = (0.0193 * r + 0.1192 * g + 0.9505 * bb) / 1.08883; return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]; };
    const seen = (h, m) => lab(CVD[m].map(row => Math.min(1, Math.max(0, row.reduce((a, v, j) => a + v * rgb(h)[j], 0)))));
    for (const theme of ['light', 'dark']) {
      const t = await p.evaluate(([th, ks]) => { document.documentElement.dataset.theme = th; const cs = getComputedStyle(document.documentElement); return Object.fromEntries(ks.concat('card', 'paper').map(k => [k, cs.getPropertyValue(k === 'card' || k === 'paper' ? '--' + k : '--t-' + k).trim().toUpperCase()])); }, [theme, KINDS]);
      for (const k of KINDS) { if (!/^#[0-9A-F]{6}$/.test(t[k])) { bad.push(`${theme}: no colour token --t-${k}`); continue; }
        for (const bg of ['card', 'paper']) if (contrast(t[k], t[bg]) < 4.5) bad.push(`${theme}: ${k} colour ${t[k]} is hard to read on the ${bg} (${contrast(t[k], t[bg]).toFixed(1)}:1, needs 4.5)`); }
      const legs = ['walk', 'car', 'bus', 'train', 'ferry'];
      for (const m of Object.keys(CVD)) for (let i = 0; i < legs.length; i++) for (let j = i + 1; j < legs.length; j++) {
        const dd = Math.hypot(...seen(t[legs[i]], m).map((v, n) => v - seen(t[legs[j]], m)[n])); if (dd < 8) bad.push(`${theme}: ${legs[i]} and ${legs[j]} look too alike${m === 'normal' ? '' : ' with ' + m} (difference ${dd.toFixed(1)}, needs 8)`); }
    }
    await p.evaluate(() => { delete document.documentElement.dataset.theme; });
    // A day with a ferry, a bus and a train: each leg is drawn in its own kind's colour and pattern, everywhere.
    const DD = await p.evaluate(() => window.__kairouteDays()), todo = ['ferry', 'bus', 'train'], got = { rows: [], key: [], lines: [] };
    for (const D of DD.filter(d => d.city && d.type === 'port')) { if (!todo.length) break;
      const far = (await p.evaluate(i => window.__kairouteLiveTest.rideLegs(i), D.i)).filter(l => l.far); if (!far.length) continue;
      for (const l of far) { const m = todo.shift(); if (!m) break; const kind = m[0].toUpperCase() + m.slice(1);
        await p.evaluate(([key, o]) => window.__kairouteLiveTest.addTransit(key, [o]), [l.key, { mode: m, kind, label: kind + ' test line', from: 'A', to: 'B', ride: 5, wait: 2, every: 10, access: { how: 'walk', min: 1, km: 0.1 }, egress: { how: 'walk', min: 1, km: 0.1 }, min: 6, km: 5, stops: 2, steps: [], path: [] }]); }
      await p.evaluate(i => window.__kairouteGo('plan', i), D.i); await p.waitForTimeout(200);
      const g = await p.evaluate(() => { const root = getComputedStyle(document.documentElement), out = { rows: [], key: [], lines: [] };
        document.querySelectorAll('.tl.leg').forEach(r => { const k = r.dataset.kind, w = r.querySelector('.what'), rb = getComputedStyle(r.querySelector('.rail'), '::before'); out.rows.push({ k, lc: getComputedStyle(r).getPropertyValue('--lc').trim().toUpperCase(), tok: k && root.getPropertyValue('--t-' + k).trim().toUpperCase(), rail: rb.backgroundImage + rb.backgroundSize + rb.backgroundColor, ico: r.querySelector('.legico') && r.querySelector('.legico').getAttribute('aria-label') }); });
        document.querySelectorAll('.maplegend [data-kind]').forEach(e => out.key.push(e.dataset.kind));
        document.querySelectorAll('svg line[class^="leg-"]').forEach(l => out.lines.push(l.getAttribute('class').slice(4) + '|' + l.getAttribute('stroke')));
        return out; });
      const dayKinds = [...new Set(g.rows.map(r => r.k))];
      for (const k of dayKinds) if (!g.key.includes(k)) bad.push(`${D.dest}: the map key doesn't list ${k}`);
      for (const k of g.key) if (!dayKinds.includes(k)) bad.push(`${D.dest}: the map key lists ${k}, which isn't on that day's map`);
      got.rows.push(...g.rows); got.lines.push(...g.lines); }
    const kinds = [...new Set(got.rows.map(r => r.k))]; if (todo.length) bad.push(`no far ride left to test ${todo.join(', ')} on`);
    for (const want of ['ferry', 'bus', 'train']) if (!kinds.includes(want)) bad.push(`a ${want} leg isn't drawn as a ${want}`);
    for (const r of got.rows) { if (!r.k) { bad.push('a leg on the timeline has no kind'); continue; } if (r.lc !== r.tok) bad.push(`${r.k} leg uses colour ${r.lc}, not its own ${r.tok}`); if (!r.ico) bad.push(`${r.k} leg has no icon`); }
    const rails = {}; got.rows.forEach(r => { rails[r.k] = r.rail; }); const rk = Object.keys(rails);
    for (let i = 0; i < rk.length; i++) for (let j = i + 1; j < rk.length; j++) if (rails[rk[i]] === rails[rk[j]]) bad.push(`${rk[i]} and ${rk[j]} legs draw the same line on the timeline`);
    if (got.lines.length && got.lines.some(l => { const [k, s] = l.split('|'); return s !== 'var(--t-' + k + ')'; })) bad.push('a map line is not drawn in its own kind\'s colour: ' + got.lines.join(', '));
    checks++; if (bad.length) { fails++; console.log('FAIL ways of getting around:\n  ' + bad.join('\n  ')); }
    else console.log(`ok   ways of getting around: ${KINDS.length} colours readable on light and dark and apart for colour-blind eyes; ${kinds.join(', ')} legs each drawn in their own colour, icon and line on the timeline, map and key`);
    await ctx.close(); }
  await b.close();
  if (fails || !checks) { console.log(`\nLayout check failed in ${fails} size(s). See docs/design-rules.md.`); process.exit(1); }
  console.log('\nLayout check passed');
})();
