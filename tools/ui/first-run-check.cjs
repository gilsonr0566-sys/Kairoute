// First-run check: Kairoute as a brand-new traveler sees it (fresh storage), on a phone and on a tablet held both ways,
// with no internet and again with Kairoute's helper reachable but its AI switched off (as the app runs now).
// Each rule is general, for any trip. No internet, no AI. Usage: node tools/ui/first-run-check.cjs [beta2-site/index.html]
//  - Home never says "Pick up where you left off" (or shows a day number) for a trip the traveler never opened; it does
//    once they have opened it.
//  - The first-run walkthrough promises only what the app offers right now: a photo of the itinerary only when the
//    New trip page offers one, "Ask your guide" only when the guide has the box.
//  - The example trip never says it came from the traveler's own booking. The Journal's cost estimate says how many
//    people it is for (a default the traveler may never have set).
//  - A first trip of their own, months ahead: Home shows no day number or "Next:" before it starts, and counts and
//    lists only the trips the traveler made (the example they never opened is offered as the example), saying
//    each thing once. The Trip page
//    shows no demo partner offer unless the traveler turned it on.
//  - Settings, every section opened by tapping it: nothing runs off the side, no page error, no tap target under
//    36 px, the trip length said the same way as on Home, and none of these known untrue or broken sentences:
//    "does not use your location" (the tour and the countdown use it), "about under", "in this view" (outside the
//    Claude app).
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'beta2-site/index.html');
const SIZES = { phone: { width: 412, height: 915, isMobile: true, hasTouch: true }, tablet: { width: 1280, height: 800 }, upright: { width: 800, height: 1280, hasTouch: true } };
const results = []; const ok = (name, cond, why) => results.push({ name, ok: !!cond, why: cond ? '' : why });
// A stand-in for the helper: AI off, group trips kept in memory.
const groups = {};
function helper(q, r, body) {
  const u = new URL(q.url, 'http://x'), send = (s, j) => { r.writeHead(s, { 'content-type': 'application/json' }); r.end(JSON.stringify(j)); };
  if (u.pathname === '/h/status') return send(200, { on: false, mode: 'minimal', left: 0, budget: 0 });
  if (u.pathname === '/h/x/group') { let b = {}; try { b = JSON.parse(body || '{}'); } catch (e) {}
    const code = String(b.code || u.searchParams.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (b.op === 'new') { groups.K7MQ4R = { trip: b.trip, name: b.name, rev: 1 }; return send(200, { code: 'K7MQ4R', token: 't', rev: 1, now: Date.now() }); }
    const g = groups[code]; if (!g) return send(404, { error: 'Unknown code' });
    if (q.method === 'GET') return send(200, { rev: g.rev, name: g.name, now: Date.now(), members: 0, followers: 0, ownDays: {}, offers: {}, trip: g.trip, tripRev: 1 });
    return send(200, { ok: true, rev: ++g.rev, now: Date.now() }); }
  return send(404, {});
}
function serve(file, withHelper) { const dir = path.dirname(file), name = path.basename(file);
  return new Promise(res => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
    if (withHelper && u === '/ai.json') { r.writeHead(200, { 'content-type': 'application/json' }); return r.end(JSON.stringify({ url: 'http://localhost:' + s.address().port + '/h' })); }
    if (withHelper && u.startsWith('/h/')) { let body = ''; q.on('data', c => body += c); q.on('end', () => helper(q, r, body)); return; }
    const f = path.join(dir, u === '/' ? name : u);
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
    s.listen(0, () => res({ url: 'http://localhost:' + s.address().port + '/' + name, close: () => s.close() })); }); }
// Things on screen that run off the side, and tap targets under 36 px, in the given part of the page.
const audit = (p, sel) => p.evaluate(sel => { const W = innerWidth, off = [], small = [];
  document.querySelectorAll(sel).forEach(e => { if (e instanceof SVGElement && e.tagName !== 'svg') return; // a drawing's own lines (the hero's clipped background art)
    const r = e.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') return;
    if ((r.right > W + 1 || r.left < -1) && !e.closest('.setnav, .daystrip, [data-pane]')) off.push(String(e.innerText || e.getAttribute("class") || e.tagName).slice(0, 40));
    if (/^(BUTTON|SUMMARY|SELECT|A)$/.test(e.tagName) && e.offsetParent && r.height < 35.5 && !e.classList.contains('linkbtn') && !e.closest('p, li, .lede, .hint, .small, label')) small.push(`"${(e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(r.height)}px`); });
  return { wide: document.documentElement.scrollWidth > W + 1, off: [...new Set(off)].slice(0, 4), small: [...new Set(small)].slice(0, 4) }; }, sel);
const UNTRUE = [[/does not use your location/i, 'says the app does not use your location (the tour and the countdown do)'], [/\babout under\b/i, 'says "about under"'], [/isn't available in this view/i, 'says "in this view" outside the Claude app']];
(async () => {
  const browser = await chromium.launch();
  for (const withHelper of [false, true]) { const srv = await serve(FILE, withHelper);
    for (const size of (process.env.SIZES || 'phone,tablet,upright').split(',')) {
      const tag = `${size}, ${withHelper ? 'helper with AI off' : 'no internet'}`;
      const ctx = await browser.newContext(Object.assign({ deviceScaleFactor: 1, timezoneId: 'America/Chicago', locale: 'en-US' }, SIZES[size], { viewport: { width: SIZES[size].width, height: SIZES[size].height } }));
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
      await p.route(u => !/^http:\/\/localhost/.test(String(u)), r => r.fulfill({ status: 503, body: '' }));
      await p.goto(srv.url); await p.waitForTimeout(2500);
      // 1. The walkthrough, every screen, as the traveler taps Next.
      const slides = [];
      for (let k = 0; k < 8; k++) { const sh = p.locator('.coach .sheet'); if (!(await sh.isVisible().catch(() => false))) break;
        slides.push(await sh.innerText()); const a = await audit(p, '.coach *');
        ok(`walkthrough screen ${k + 1} fits the screen (${tag})`, !a.wide && !a.off.length, `runs off the side: ${a.off.join(', ')}`);
        ok(`walkthrough screen ${k + 1} buttons are easy to tap (${tag})`, !a.small.length, `small: ${a.small.join(', ')}`);
        await p.locator('.coach [data-act=coachnext]').click(); await p.waitForTimeout(250); }
      ok(`the walkthrough shows on a first start (${tag})`, slides.length >= 3, `${slides.length} screens`);
      const coach = slides.join('\n');
      // 2. Home: the trip on the device was never opened by this traveler.
      const resume = await p.locator('.resume').innerText().catch(() => '');
      ok(`Home doesn't say "pick up where you left off" for a trip never opened (${tag})`, !/pick up where you left off|continue trip/i.test(resume) && !(await p.locator('.resume .stamp').count()), `Home card says: ${resume.replace(/\n/g, ' | ').slice(0, 160)}`);
      { const a = await audit(p, '#view *'); ok(`Home fits the screen (${tag})`, !a.wide && !a.off.length, `runs off: ${a.off.join(', ')}`); }
      const homeLen = ((resume.match(/\b\d+ days?\b/) || [''])[0]);
      // 3. The walkthrough's promises against the New trip page.
      await p.locator('[data-act=newtrip]:visible').first().click(); await p.waitForTimeout(600);
      const photo = await p.locator('#view [data-ts=mode][data-v=words], #view input[type=file]').count();
      ok(`the walkthrough offers a photo of the itinerary only when New trip does (${tag})`, photo || !/photo of your itinerary|snap a photo/i.test(coach), 'the walkthrough says "snap a photo of your itinerary" but New trip has no photo option');
      await p.locator('#view button:has-text("Cancel")').first().click(); await p.waitForTimeout(400);
      // 4. Open the trip: the example says it is one, and the guide has Ask your guide if the walkthrough promised it.
      await p.locator('[data-act=continue]').click(); await p.waitForTimeout(1500);
      await p.locator('[data-goto=trip]:visible, .tabs button:has-text("Trip"):visible').first().click(); await p.waitForTimeout(800);
      const tripText = await p.evaluate(() => document.querySelector('#view').innerText);
      if (/example trip/i.test(resume)) ok(`the example trip doesn't claim the traveler's own booking (${tag})`, !/(come from|from) your booking|this is your [A-Z]/.test(tripText), `Trip page says: ${(tripText.match(/[^.]*(your booking|This is your)[^.]*/) || [''])[0].slice(0, 140)}`);
      await p.locator('.tabs button:has-text("Guide"):visible, [data-goto=guide]:visible').first().click(); await p.waitForTimeout(1200);
      const ask = await p.locator('#view .askbox, #view .askfold').count();
      ok(`the walkthrough promises "Ask your guide" only when the guide has it (${tag})`, ask || !/Ask your guide/.test(coach), 'the walkthrough says "Ask your guide" but the Guide has no question box');
      await p.locator('.tabs button:has-text("Journal"):visible, [data-goto=journal]:visible').first().click(); await p.waitForTimeout(3000);
      const jt = await p.evaluate(() => (document.querySelector('#view .tripbudget summary') || {}).innerText || '');
      if (/people|person/.test(jt)) ok(`the Journal's cost says how many people it is for (${tag})`, /for \d+ (people|person)/.test(jt), `Journal says "${jt}"`);
      // 5. Back Home, the opened trip is now the one to pick up.
      await p.locator('[data-act=lobby]:visible').first().click(); await p.waitForTimeout(800);
      const resume2 = await p.locator('.resume').innerText().catch(() => '');
      ok(`Home offers to pick up a trip once it was opened (${tag})`, /pick up where you left off/i.test(resume2) && /continue trip/i.test(resume2), `Home card says: ${resume2.replace(/\n/g, ' | ').slice(0, 160)}`);
      // 6. Settings, every section, tapped like a traveler would.
      await p.locator('[data-act=settings]:visible').first().click(); await p.waitForTimeout(600);
      const secs = await p.$$eval('.setlink', a => a.map(x => [x.dataset.setsec, x.innerText.trim()]));
      for (const [k, label] of secs) {
        await p.locator(`.setlink[data-setsec="${k}"]`).click(); await p.waitForTimeout(k === 'offline' ? 1500 : 400);
        const t = await p.evaluate(() => (document.querySelector('.setmain') || document.body).innerText), a = await audit(p, '#view *');
        ok(`Settings > ${label} fits the screen (${tag})`, !a.wide && !a.off.length, `runs off the side: ${a.off.join(', ')}`);
        ok(`Settings > ${label} buttons are easy to tap (${tag})`, !a.small.length, `small: ${a.small.join(', ')}`);
        for (const [re, why] of UNTRUE) ok(`Settings > ${label} says nothing untrue (${tag})`, !re.test(t), why);
        if (k === 'group' && homeLen) { const rows = await p.$$eval('.grptrip span.small', a => a.map(x => x.innerText));
          for (const r of rows) ok(`Settings > Group trip says the trip's length as Home does (${tag})`, r.includes(homeLen), `Group trip says "${r}", Home says "${homeLen}"`); }
      }
      ok(`no page errors (${tag})`, !errs.length, errs.slice(0, 2).join(' | '));
      await ctx.close();
      // 7. A first trip of their own, months ahead, one city, built step by step: Home has no day number or "Next:"
      //    before it starts, doesn't count the example they never opened, the Trip page shows no demo offer unless
      //    turned on, and the Journal's cost says how many people it is for.
      { const ctx2 = await browser.newContext(Object.assign({ deviceScaleFactor: 1, timezoneId: 'America/Chicago', locale: 'en-US' }, SIZES[size], { viewport: { width: SIZES[size].width, height: SIZES[size].height } }));
        const q = await ctx2.newPage(); const errs2 = []; q.on('pageerror', e => errs2.push(String(e).slice(0, 200)));
        await q.route(u => !/^http:\/\/localhost/.test(String(u)), r => r.fulfill({ status: 503, body: '' }));
        await q.goto(srv.url); await q.waitForTimeout(2000);
        if (await q.locator('.coach [data-act=coachskip]').isVisible().catch(() => false)) await q.locator('.coach [data-act=coachskip]').click();
        const start = new Date(Date.now() + 160 * 86400000).toISOString().slice(0, 10);
        await q.locator('[data-act=newtrip]:visible').first().click(); await q.waitForTimeout(500);
        await q.getByLabel('City').first().fill('Lisbon'); await q.getByLabel('Arrive on').first().fill(start);
        await q.getByRole('button', { name: 'Build my trip' }).click(); await q.waitForTimeout(2500);
        const tt = await q.evaluate(() => document.querySelector('#view').innerText);
        ok(`no demo partner offer unless turned on (${tag})`, !/\bDEMO\b/.test(tt), 'the Trip page shows a DEMO partner offer by default');
        await q.locator('[data-act=lobby]:visible').first().click(); await q.waitForTimeout(800);
        const home = await q.evaluate(() => ({ card: (document.querySelector('.resume') || {}).innerText || '', stamp: !!document.querySelector('.resume .stamp'), sec: (document.querySelector('.sechead .lede') || {}).innerText || '', cards: document.querySelectorAll('.tripcards .tripcard').length }));
        ok(`Home has no day number or "Next:" before the trip starts (${tag})`, !home.stamp && !/\bNext:/.test(home.card), `Home card says: ${home.card.replace(/\n/g, ' | ').slice(0, 160)}`);
        const n = +((home.sec.match(/^(\d+)/) || [])[1] || 0);
        ok(`Home counts and lists only the trips the traveler made (${tag})`, (!home.sec || n === 1) && home.cards === 0, `"${home.sec}" with ${home.cards} other trip card(s); the traveler made one trip`);
        { const parts = (await q.evaluate(() => document.querySelector('.lobbybody').innerText)).split(/\n| · /).map(x => x.trim().toLowerCase()).filter(x => x.length >= 15), seen = new Set(), twice = [];
          parts.forEach(x => { if (seen.has(x)) twice.push(x); seen.add(x); });
          ok(`Home says each thing once (${tag})`, !twice.length, `said twice: ${[...new Set(twice)].slice(0, 3).join('; ')}`); }
        ok(`no page errors on a first trip (${tag})`, !errs2.length, errs2.slice(0, 2).join(' | '));
        await ctx2.close(); }
    }
    srv.close(); }
  await browser.close();
  const fails = results.filter(r => !r.ok);
  for (const f of fails) console.log('FAIL ' + f.name + ': ' + f.why);
  console.log(`first-run check: ${results.length - fails.length} of ${results.length} passed`);
  process.exit(fails.length ? 1 : 0);
})();
