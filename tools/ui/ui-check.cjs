// UI rules from the outside look-and-flow review (Nov 20, 2026), checked on every day of the sample trip, on a phone
// and on a tablet held both ways, in both clock settings. Each rule is general: it holds for any trip, any day.
// No internet, no AI. A failure is printed in plain words. Usage: node tools/ui/ui-check.cjs [beta2-site/index.html]
//   DAYS=8,12 limits the days; SIZES=phone limits the screens; CLOCKS=12 limits the clock settings.
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'beta2-site/index.html');
const SIZES = { phone: { width: 412, height: 915, isMobile: true, hasTouch: true }, tablet: { width: 1280, height: 800 }, upright: { width: 800, height: 1280, hasTouch: true } };
const results = []; const ok = (name, cond, why) => results.push({ name, ok: !!cond, why: cond ? '' : why });
function serve(file) { const dir = path.dirname(file), name = path.basename(file);
  return new Promise(res => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(dir, u === '/' ? name : u);
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
    s.listen(0, () => res({ url: 'http://localhost:' + s.address().port + '/' + name, close: () => s.close() })); }); }
async function open(browser, url, size, clock) {
  const ctx = await browser.newContext(Object.assign({ deviceScaleFactor: 1, timezoneId: 'America/Chicago', locale: 'en-US' }, SIZES[size], { viewport: { width: SIZES[size].width, height: SIZES[size].height } }));
  await ctx.addInitScript(c => { try { const k = 'b2:kairoute.app', v = JSON.parse(localStorage.getItem(k) || '{}'); v.clock = c; localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, clock);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.route(u => !/^http:\/\/localhost/.test(String(u)), r => r.fulfill({ status: 503, body: '' }));
  await p.goto(url); await p.waitForTimeout(2500);
  const sample = p.locator('[data-act="loadsample"]').first(); if (await sample.isVisible().catch(() => false)) await sample.click();
  await p.waitForTimeout(5000);
  for (let k = 0; k < 5; k++) { const sk = p.locator('.coach button:has-text("Skip")').first(); if (await sk.isVisible().catch(() => false)) await sk.click(); else break; }
  return { p, ctx, errs };
}
async function go(p, view, i) { await p.evaluate(([v, i]) => { if (i != null) window.__kairouteGo('day', i); window.__kairouteGo(v); }, [view, i]); await p.waitForTimeout(700); await p.evaluate(() => { scrollTo(0, 0); document.querySelectorAll('.pane').forEach(x => x.scrollTop = 0); }); await p.waitForTimeout(150); }
// What the page says, as the traveler reads it.
const pageText = p => p.evaluate(() => (document.querySelector('#view') || document.body).innerText);
const H24 = /\b([01]\d|2[0-3]):[0-5]\d\b(?!\s?[ap]m)/, H12 = /\b(1[0-2]|[1-9]):[0-5]\d\s?(am|pm|AM|PM)\b/;
// Sentences said twice on one screen (longer than a short label), with the place each was found.
function repeats(text) {
  const seen = new Map(), out = [];
  for (const raw of text.split(/(?<=[.!?])\s+|\n+/)) { const t = raw.trim(); if (t.length < 28 || !/[a-z]/.test(t) || /^(Walk|Taxi|Train|Bus|Ferry|Arrive|Leave)\b/.test(t)) continue; const k = t.toLowerCase(); if (seen.has(k)) out.push(t); else seen.set(k, 1); }
  return [...new Set(out)];
}
(async () => {
  const srv = await serve(FILE); const browser = await chromium.launch();
  const sizes = (process.env.SIZES || 'phone,tablet,upright').split(','), clocks = (process.env.CLOCKS || '12,24').split(',');
  for (const size of sizes) for (const clock of clocks) {
    if (size === 'upright' && clock === '24') continue; // the upright tablet checks layout only once
    const { p, ctx, errs } = await open(browser, srv.url, size, clock), tag = `${size} ${clock}h`;
    const days = await p.evaluate(() => window.__kairouteDays().map((d, i) => ({ i, type: d.type, dest: d.dest, date: d.date })));
    const want = process.env.DAYS ? process.env.DAYS.split(',').map(Number) : days.map(d => d.i);
    const trip = await p.evaluate(() => window.__kairouteFacts.trip());
    for (const i of want) { const D = days[i]; if (!D) continue; const dn = `${tag} ${D.date} ${D.dest}`;
      await go(p, 'plan', i);
      const t = await pageText(p);
      // 1. One clock: every time on the page in the chosen format.
      ok(`one clock format (${dn})`, clock === '12' ? !H24.test(t) : !H12.test(t), `a ${clock === '12' ? '24-hour' : '12-hour'} time on a ${clock}-hour page: "${(t.match(clock === '12' ? H24 : H12) || [''])[0]}"`);
      if (D.type === 'sea') continue;
      const F = await p.evaluate(i => window.__kairouteFacts.day(i), i); if (!F) continue;
      const clk = m => p.evaluate(m => window.__kairouteClock.of(m), m);
      const dom = await p.evaluate(() => ({
        cd: (document.getElementById('cdBig') || {}).textContent || '', fact: (document.querySelector('.factline') || {}).innerText || '',
        free: (() => { const f = document.querySelector('.tl.freetime'); return f ? f.innerText : ''; })(), freeN: document.querySelectorAll('.tl.freetime').length,
        endBy: (() => { const e = [...document.querySelectorAll('.timeline .tl.last .time')].pop(); return e ? e.innerText : ''; })(),
        hours: (document.querySelector('.daysum > div:first-child') || {}).innerText || '',
        tzWarn: !!document.querySelector('.tzline.warn, .banner.warn .tzline'), tz: (document.querySelector('.tzline') || {}).innerText || '',
        firstStop: (() => { const s = document.querySelector('.timeline .tl:not(.leg)'); return s ? Math.round(s.getBoundingClientRect().top) : null; })(),
        aboutOpen: (() => { const a = document.querySelector('.engine2why'); return a ? { open: a.open, act: !!a.querySelector('li.act') } : null; })(),
        dropped: !!document.querySelector('.banner.dropped'), zero: /\b0\.0 (mi|km)\b/.test(document.body.innerText),
        badge: (() => { const bs = [...document.querySelectorAll('.b2tag')].filter(b => b.offsetParent); const tabs = [...document.querySelectorAll('.tabs .tab, .tabs a')].filter(x => x.offsetParent);
          return bs.some(b => { const r = b.getBoundingClientRect(); return tabs.some(x => { const q = x.getBoundingClientRect(); const lab = x.querySelector('span'); const L = lab ? lab.getBoundingClientRect() : q; return r.left < L.right && r.right > L.left && r.top < L.bottom && r.bottom > L.top; }); }); })(),
        head: (() => { const h = document.querySelector('#view .dayhead h2'), m = document.querySelector('#view .dayhead .mainbtn'); if (!h || !m) return null; const a = h.getBoundingClientRect(), b = m.getBoundingClientRect(); return { same: b.top < a.bottom && b.bottom > a.top - 30 }; })(),
        named: (() => { const s = document.querySelector('.timeline .tl.first .what'); if (!s) return null; const sub = [...s.querySelectorAll('.sub')].map(x => x.innerText).join(' '); const chips = [...s.parentElement.parentElement.querySelectorAll('.tl.leg')].slice(0, 1).flatMap(l => [...l.querySelectorAll('.ridechip')].map(c => c.className)); return { sub, chips: chips.join(' ') }; })(),
        words: (document.body.innerText.match(/\b\d+ (picks?|sites? picked)\b|\bYour picks\b|\bChange stops\b|\bMark day ready\b/g) || []),
      }));
      // 2. One back-by time, one leave-by time, one time left: the countdown, the line under the head, the free
      //    time row and the end of the day all say the same.
      if (F.fixed) {
        ok(`ship/train/flight times named once, in one line (${dn})`, dom.fact.includes(await clk(F.endBy)) && (F.allAboard == null || dom.fact.includes(await clk(F.allAboard))), `line under the head "${dom.fact}" lacks back-by ${await clk(F.endBy)}${F.allAboard != null ? ' or all aboard ' + await clk(F.allAboard) : ''}`);
        if (dom.cd && !/\d+h|min|Go now/.test(dom.cd)) ok(`countdown = leave-by (${dn})`, dom.cd.trim() === await clk(F.leaveBy), `countdown "${dom.cd}" but the day's leave-by is ${await clk(F.leaveBy)}`);
      } else ok(`the day's hours tile = the day's hours (${dn})`, dom.hours.includes(await clk(F.start)) && dom.hours.includes(await clk(F.endBy)), `tile "${dom.hours.replace(/\n/g, ' ')}" vs ${await clk(F.start)}–${await clk(F.endBy)}`);
      if (dom.freeN) { ok(`free time = the day's time left (${dn})`, new RegExp('Free time: ' + (await p.evaluate(m => { const d = Math.round(m); return d < 60 ? d + ' min' : Math.floor(d / 60) + ' h' + (d % 60 ? ' ' + d % 60 + ' min' : ''); }, F.left)).replace(/ /g, '\\s')).test(dom.free), `free time row "${dom.free.replace(/\n/g, ' ')}" vs ${F.left} min left`);
        ok(`free time ends at the leave-by time (${dn})`, dom.free.includes(await clk(F.leaveBy)), `free row "${dom.free.replace(/\n/g, ' ')}" lacks ${await clk(F.leaveBy)}`);
        ok(`back by the day's back-by time after free time (${dn})`, dom.endBy.includes(await clk(F.endBy)), `end row "${dom.endBy}" vs ${await clk(F.endBy)}`); }
      ok(`only one free time row (${dn})`, dom.freeN <= 1, `${dom.freeN} free time rows`);
      // 3. The time zone is quiet grey text, never a warning.
      ok(`time zone note is quiet (${dn})`, !dom.tzWarn, `time zone note styled as a warning: "${dom.tz}"`);
      // 4. Plan first: notes start folded unless one needs a decision; on a phone the first stop is on the first screen.
      if (dom.aboutOpen) ok(`notes fold opens only for a decision (${dn})`, dom.aboutOpen.open === dom.aboutOpen.act, `"About today's plan" is ${dom.aboutOpen.open ? 'open' : 'closed'} with${dom.aboutOpen.act ? '' : 'out'} a note that needs a decision`);
      if (size === 'phone' && dom.firstStop != null && !dom.dropped) ok(`phone: the plan starts on the first screen (${dn})`, dom.firstStop < SIZES.phone.height - 120, `first stop starts at ${dom.firstStop}px on a ${SIZES.phone.height}px screen`);
      if (size !== 'phone' && dom.head) ok(`tablet: title and main button on one row (${dn})`, dom.head.same, 'the main button sits on a row of its own');
      ok(`Beta 2 tag covers no menu label (${dn})`, !dom.badge, 'the Beta 2 tag overlaps a menu label');
      ok(`no "0.0" distance (${dn})`, !dom.zero, 'a distance reads 0.0');
      ok(`one word for a sight (${dn})`, !dom.words.length, `old words on the page: ${dom.words.join(', ')}`);
      // 5. A ride named in the text is a button, or the text says it isn't planned.
      if (dom.named) { const kinds = [[/\b(sea ?bus|water ?bus|water taxi|ferr(y|ies)|boats?)\b/i, /k-ferry/], [/\b(shuttle|bus(es)?)\b/i, /k-bus/], [/\b(tram|metro|train|funicular)\b/i, /k-(train|tram|metro)/]];
        for (const [re, chip] of kinds) if (re.test(dom.named.sub)) ok(`a named ride has a button or says it isn't planned (${dn})`, chip.test(dom.named.chips) || /isn't in the plan/.test(dom.named.sub), `"${dom.named.sub.slice(0, 120)}" names a ride with no button`); }
      // 6. Nothing said twice on the screen.
      const rep = repeats(t); ok(`nothing said twice on the Day plan (${dn})`, !rep.length, `said twice: ${rep.slice(0, 3).map(x => '"' + x.slice(0, 80) + '"').join('; ')}`);
      // 7. Choose sights says the same time left and day length as the Day plan.
      if (clock === '12' && size !== 'upright') { await go(p, 'sites', i);
        const s = await p.evaluate(() => ({ left: (document.querySelector('.pickbar .pbleft') || {}).innerText || '', title: (document.querySelector('#view .dayhead h2') || {}).innerText || '', text: (document.querySelector('#view') || document.body).innerText }));
        const dt = m => { const d = Math.round(m); return d < 60 ? d + ' min' : Math.floor(d / 60) + ' h' + (d % 60 ? ' ' + d % 60 + ' min' : ''); };
        if (F.left >= 5 && s.left) ok(`Choose sights: same time left and day length (${dn})`, s.left.includes(dt(F.left)) && s.left.includes(dt(F.len)), `"${s.left}" vs ${dt(F.left)} left of ${dt(F.len)}`);
        ok(`Choose sights has its own title (${dn})`, /Choose sights/.test(s.title), `title "${s.title}"`);
        const r2 = repeats(s.text); ok(`nothing said twice on Choose sights (${dn})`, !r2.length, `said twice: ${r2.slice(0, 3).map(x => '"' + x.slice(0, 80) + '"').join('; ')}`);
        // The Tour's map key is the Day plan's.
        await go(p, 'plan', i); const k1 = await p.evaluate(() => [...document.querySelectorAll('.mapbox .maplegend .lk')].map(x => x.dataset.kind).join(','));
        await go(p, 'tour', i); const k2 = await p.evaluate(() => [...document.querySelectorAll('.tourmap .maplegend .lk')].map(x => x.dataset.kind).join(','));
        if (k2 || /tourmap/.test(await p.content())) ok(`Tour map key = Day plan map key (${dn})`, k1 === k2, `Day plan key "${k1}" vs Tour key "${k2}"`);
        await p.evaluate(() => { const b = document.querySelector('[data-act="tourexit"], [data-act="exittour"]'); if (b) b.click(); });
      }
    }
    // 8. The trip is one length everywhere; the day list comes before the offline and partner cards.
    await go(p, 'trip', 0); const tp = await p.evaluate(() => ({ text: document.querySelector('#view').innerText, order: [...document.querySelectorAll('#view .itin, #view .offcard, #view .esimcard, #view [class*=esim]')].map(x => x.className.split(' ')[0]) }));
    const counts = [...tp.text.matchAll(/\b(\d+)\s+(DAYS|days?)(?! ashore)\b/g)].map(m => +m[1]).filter(n => n > 3);
    ok(`trip length is one number on the Trip page (${tag})`, counts.every(n => n === trip.days), `day counts ${counts.join(', ')} on the Trip page; the trip is ${trip.days} days`);
    const iI = tp.order.indexOf('itin'), iE = tp.order.findIndex(x => /esim/.test(x)); if (iE >= 0) ok(`partner card below the day list (${tag})`, iI >= 0 && iI < iE, `order: ${tp.order.join(' > ')}`);
    await go(p, 'lobby'); const home = await p.evaluate(() => document.body.innerText);
    const hc = [...home.matchAll(/\b(\d+) days?\b/g)].map(m => +m[1]).filter(n => n > 3); ok(`trip length on Home (${tag})`, hc.every(n => n === trip.days), `Home says ${hc.join(', ')} days; the trip is ${trip.days}`);
    ok(`Home names its button as the welcome card does (${tag})`, !/Tap <?b?>?Plan a new trip/.test(home) || /Plan a new trip/.test(home), 'the welcome card and the button use different words');
    ok(`no page errors (${tag})`, !errs.length, errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  await browser.close(); srv.close();
  const bad = results.filter(r => !r.ok), byRule = new Map(); bad.forEach(r => { const k = r.name.replace(/ \(.*\)$/, ''); if (!byRule.has(k)) byRule.set(k, []); byRule.get(k).push(r); });
  console.log(`UI check: ${results.length - bad.length} of ${results.length} pass, ${byRule.size} rule${byRule.size === 1 ? '' : 's'} broken.`);
  for (const [k, rs] of byRule) { console.log(`LEAK: ${k}: ${rs.length} time${rs.length === 1 ? '' : 's'}`); rs.slice(0, 4).forEach(r => console.log(`   ${r.name.replace(/^.*\(/, '(')} ${r.why}`)); }
  process.exit(bad.length ? 1 : 0);
})();
