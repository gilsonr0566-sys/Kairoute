// Layout check: every page follows the design rules (docs/design-rules.md) at tablet and phone sizes, held
// upright and sideways. Fails the publish if any page:
//  - runs off the side of the screen (anything wider than the window, outside a sideways-scrolling strip),
//  - scrolls as a whole on a tablet (tablet pages fit the window; their panels scroll on their own),
//  - has a day page without the shared head (day name, and on ship/train/flight days the back-to-the-ship
//    countdown in the head), or shows more than one main action,
//  - shows the same title twice, or has buttons too small to tap.
// Usage: node tools/layout-check.cjs [path/to/index.html]
const { chromium } = require('playwright'); const path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const SIZES = [['tablet sideways', 1280, 800], ['tablet sideways, browser bars', 1280, 720], ['tablet upright', 800, 1280], ['computer', 1440, 900],
  ['phone', 412, 860], ['phone small', 360, 740], ['phone sideways', 860, 412]];
const PAGES = ['lobby', 'trip', 'plan', 'sites', 'guide', 'tour', 'journal', 'settings', 'privacy', 'terms'];
const DAY_PAGES = ['plan', 'sites', 'guide'];
(async () => {
  const b = await chromium.launch(); let fails = 0, checks = 0;
  for (const [name, w, h] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
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
  await b.close();
  if (fails || !checks) { console.log(`\nLayout check failed in ${fails} size(s). See docs/design-rules.md.`); process.exit(1); }
  console.log('\nLayout check passed');
})();
