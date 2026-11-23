// Day plan, Choose sights, Guide, voices and Tour as a first-time traveler meets them (Nov 22 first-timer check), on the
// sample trip, on a phone, offline. Each rule is general: it holds for any trip, any day. No internet, no AI.
// Usage: node tools/ui/dayplan-check.cjs [beta2-site/index.html]   (serves ../audio too, so the recorded voices play)
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'beta2-site/index.html'), ROOT = path.resolve(path.dirname(FILE), '..');
const results = []; const ok = (name, cond, why) => results.push({ name, ok: !!cond, why: cond ? '' : why });
function serve() { const dir = path.dirname(FILE), name = path.basename(FILE);
  return new Promise(res => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
    const f = u.startsWith('/audio/') ? path.join(ROOT, u) : path.join(dir, u === '/' ? name : u);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.mp3') ? 'audio/mpeg' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
    s.listen(0, () => res({ url: 'http://localhost:' + s.address().port + '/' + name, close: () => s.close() })); }); }
async function open(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, timezoneId: 'America/Chicago', locale: 'en-US' });
  await ctx.addInitScript(() => { try { const k = 'b2:kairoute.app', v = JSON.parse(localStorage.getItem(k) || '{}'); v.clock = '12'; v.backAck = '2026-11-20'; localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} });
  const p = await ctx.newPage(), errs = [], dialogs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  p.on('dialog', d => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  await p.route(u => !/^http:\/\/localhost/.test(String(u)), r => r.fulfill({ status: 503, body: '' }));
  await p.goto(url); await p.waitForTimeout(2500);
  const sample = p.locator('[data-act="loadsample"]').first(); if (await sample.isVisible().catch(() => false)) await sample.click();
  await p.waitForTimeout(5000);
  for (let k = 0; k < 5; k++) { const sk = p.locator('.coach button:has-text("Skip")').first(); if (await sk.isVisible().catch(() => false)) await sk.click(); else break; }
  return { p, ctx, errs, dialogs };
}
async function go(p, view, i) { await p.evaluate(([v, i]) => { if (i != null) window.__kairouteGo('day', i); window.__kairouteGo(v); }, [view, i]); await p.waitForTimeout(700); await p.evaluate(() => scrollTo(0, 0)); }
const text = p => p.evaluate(() => document.querySelector('#view').innerText);
const clk = (p, m) => p.evaluate(m => window.__kairouteClock.of(m), m);
const OLD = /\b(Choose|Change) stops\b/;
(async () => {
  const srv = await serve(), browser = await chromium.launch(); const { p, ctx, errs, dialogs } = await open(browser, srv.url);
  const days = await p.evaluate(() => window.__kairouteDays().map((d, i) => ({ i, type: d.type, dest: d.dest, date: d.date })));
  for (const D of days) { const dn = `${D.date} ${D.dest}`;
    await go(p, 'plan', D.i); await p.waitForTimeout(D.type === 'sea' ? 300 : 2500); const t = await text(p);
    // 1. The sample trip shows a planned day on every day ashore (a day that can't be planned is the traveler's to fix, not the demo's).
    if (D.type !== 'sea') ok(`sample trip: every day is planned (${dn})`, await p.evaluate(i => !!window.__kairouteFacts.day(i), D.i), `the day isn't planned: "${t.split('\n').slice(2, 5).join(' ')}"`);
    // 2. Nothing says it is looking something up that nobody looks up (no timetable service runs in the app).
    ok(`no endless "looking up" (${dn})`, !/Looking up the|Loading…/.test(t), `still says "${(t.match(/[^\n]*(Looking up the|Loading…)[^\n]*/) || [''])[0]}" after 2.5 s offline`);
    ok(`one word for choosing sights (${dn})`, !OLD.test(t), `old words "${(t.match(OLD) || [''])[0]}" on the Day plan`);
    // 2b. No red "fewer far-apart stops" on a day with one stop or only a day out of town: there is nothing to make fewer.
    { const n = await p.evaluate(() => document.querySelectorAll('.timeline .tl[data-stop]').length);
      if (n <= 1) ok(`no "fewer stops" warning on a one-stop day (${dn})`, !/Consider fewer far-apart stops/.test(t), 'a one-stop day is told to have fewer far-apart stops'); }
    // 3. A dinner suggested after the day ends is the evening's, never a timed "Arrive".
    const eve = await p.evaluate(() => [...document.querySelectorAll('.timeline .tl.evening')].map(x => x.innerText));
    for (const e of eve) if (!/Your reservation/.test(e)) ok(`suggested dinner isn't a timed arrival (${dn})`, !/^\s*Arrive/i.test(e), `dinner row reads "${e.replace(/\n/g, ' ').slice(0, 80)}"`);
    // 4. A sea day's look ahead gives each port's back-at-the-ship time as that day's own plan does (dayFacts).
    if (D.type === 'sea') { const rows = await p.evaluate(() => [...document.querySelectorAll('#view .voyday')].map(c => ({ t: c.innerText, open: (c.querySelector('[data-voyopen]') || {}).dataset ? c.querySelector('[data-voyopen]').dataset.voyopen : '' })));
      for (const r of rows) { const j = +String(r.open).split(':')[0], m = /back at the ship by ([0-9:]+\s?[ap]m)/i.exec(r.t) || /has you back by ([0-9:]+\s?[ap]m)/i.exec(r.t);
        if (!m) continue; const F = await p.evaluate(j => window.__kairouteFacts.day(j), j);
        ok(`sea day: next port's back-by = its Day plan's (${dn} → ${days[j] && days[j].dest})`, F && m[1] === await clk(p, F.endBy), `sea day says back by ${m[1]}, the port's Day plan says ${F ? await clk(p, F.endBy) : '(not planned)'}`); }
      ok(`one word for choosing sights on the sea day (${dn})`, !OLD.test(t), `old words "${(t.match(OLD) || [''])[0]}"`); continue; }
    // 5. Choose sights says only what is true of its own lists.
    await go(p, 'sites', D.i); await p.waitForTimeout(2500); const s = await text(p);
    ok(`Choose sights: no claim that every sight needs more time (${dn})`, !/every sight still to see needs more time/.test(s), 'says every sight still to see needs more time than is left');
    if (/See "Doesn't fit today"/.test(s)) ok(`Choose sights: points only to a list it has (${dn})`, /\nDoesn't fit today \(\d+\)/.test(s), 'points to "Doesn\'t fit today" but there is no such list');
    ok(`Choose sights: one word for choosing sights (${dn})`, !OLD.test(s), `old words "${(s.match(OLD) || [''])[0]}"`);
    await go(p, 'guide', D.i); const g = await text(p); ok(`Guide: one word for choosing sights (${dn})`, !OLD.test(g), `old words "${(g.match(OLD) || [''])[0]}"`);
  }
  // 6. A day that asks which station, airport or terminal offers the choices as one tap each, and one tap plans the day.
  { let done = false;
    for (const D of days.filter(d => d.type === 'arrival' || d.type === 'departure')) {
      await p.evaluate(i => window.__kairouteUnpickPoint(i), D.i); await go(p, 'plan', D.i);
      const n = await p.locator('#view [data-act="pointpick"]').count(); if (!n) { await p.evaluate(i => { const d = window.__kairouteDays()[i]; }, D.i); continue; }
      const t = await text(p); ok('a day that asks which station or port offers each one as a button', !/in the day's settings/.test(t), `asks with "${t.split('\n').find(x => /Which/.test(x))}"`);
      await p.locator('#view [data-act="pointpick"]').first().click(); await p.waitForTimeout(1500);
      ok('one tap on a station or port plans the day', await p.evaluate(i => !!window.__kairouteFacts.day(i), D.i), 'the day is still not planned after the tap'); done = true; break; }
    ok('a day that asks which station or port was found to test', done, 'no arrival or leaving day asked once its choice was cleared'); }
  // 7. Quiet places: nothing plays on its own there, and every Play asks for earbuds first, a part's as much as the stop's.
  { const plan = await p.evaluate(() => window.__kairouteDays().map((d, i) => i));
    let tested = 0;
    for (const i of plan) { await go(p, 'guide', i);
      const parts = await p.$$eval('#view .stopcard', cs => cs.filter(c => c.querySelector('.banner.quiet') && c.querySelector('[data-play^="part:"]')).map(c => c.querySelector('[data-play^="part:"]').dataset.play));
      if (!parts.length) continue;
      const n0 = dialogs.length; await p.locator(`#view [data-play="${parts[0]}"]`).first().click(); await p.waitForTimeout(500);
      const st = await p.evaluate(() => window.__kairouteScripts.state());
      ok('Guide: a part\'s Play in a quiet place asks for earbuds first', dialogs.length > n0 && !st.speakingId, `played ${parts[0]} with no earbuds question`);
      const banner = await p.$eval('#view .banner.quiet', b => b.innerText); ok('Guide: the quiet-place line points nowhere the words are not', !/below/.test(banner), `says "${banner}"`);
      tested++; break; }
    ok('a quiet place with parts was found on the Guide', tested, 'no quiet stop with parts on any day');
    // The tour: arriving at a quiet stop plays nothing until earbuds are confirmed.
    let quietTour = 0;
    for (const D of days.filter(d => d.type !== 'sea')) { await go(p, 'plan', D.i); const mb = p.locator('#view .mainbtn[data-act="tourstart"]').first(); if (!(await mb.count())) continue;
      await mb.click(); await p.waitForTimeout(800);
      for (let k = 0; k < 40; k++) {
        const here = p.locator('[data-act="tourhere"]').first();
        if (await here.isVisible().catch(() => false)) { await here.click(); await p.waitForTimeout(700);
          const q = await p.evaluate(() => ({ quiet: !!document.querySelector('#view .tourcard .banner.quiet') || /church|cathedral|basilica|chapel|monastery|museum/i.test(((document.querySelector('#view .tourtitle') || {}).textContent || '') + ' ' + ((document.querySelector('#view .tourcard .stopmeta') || {}).textContent || '')), st: window.__kairouteScripts.state(), title: (document.querySelector('#view .tourtitle') || {}).textContent, left: (document.getElementById('tourLeft') || {}).textContent || '' }));
          if (/\b([6-9]\d|\d{3,}) min left/.test(q.left)) ok('Tour: time left in hours and minutes', false, `"${q.left}"`);
          if (q.quiet) { quietTour++; ok(`Tour: nothing plays on arrival at a quiet place (${q.title})`, !q.st.speakingId && q.st.ttsState !== 'speaking', `playing ${q.st.speakingId} on arrival`); }
          continue; }
        const nx = p.locator('[data-act="tourpart"], [data-act="tournext"]').first(); if (!(await nx.isVisible().catch(() => false))) break; await nx.click(); await p.waitForTimeout(500);
      }
      await p.evaluate(() => { const b = document.querySelector('[data-act="tourexit"]'); if (b) b.click(); }); if (quietTour >= 2) break; }
    ok('the tour reached a quiet place', quietTour, 'no quiet stop met on the tours walked'); }
  // 8. The tour's opening and its spoken plan promise nothing about getting back.
  { const PROMISE = /I('ll| will) (have|get) you back|so you're back aboard|keep you on time/i;
    const port = days.find(d => d.type === 'port'); await go(p, 'plan', port.i); await p.locator('#view .mainbtn[data-act="tourstart"]').first().click(); await p.waitForTimeout(800);
    const t = await text(p); ok('Tour: the opening card promises nothing about getting back', !PROMISE.test(t), `says "${(t.match(PROMISE) || [''])[0]}"`);
    await p.evaluate(() => { const b = document.querySelector('[data-act="tourexit"]'); if (b) b.click(); }); }
  // 9. "About today's plan": sights with no room are one line, and never "only 0 min".
  { const n = x => `Not planned today: ${x} needs about 1 h 30 min (the visit and the rides to it and on), and with today's other stops only 0 min is left before 16:00.`;
    const grp = ts => p.evaluate(ts => window.__kairouteNoteGroup ? window.__kairouteNoteGroup(ts) : ts, ts); // no grouping at all: the notes as they come
    const g = await grp([n('A'), 'Other note.', n('B'), n('C')]), one = await grp([n('A')]);
    ok('notes: sights with no room are said in one line', g.length === 2 && /A .*B .*C/.test(g[0]), `notes: ${JSON.stringify(g)}`);
    ok('notes: never "only 0 min is left"', ![...g, ...one].some(x => /only 0 min/.test(x)), `notes: ${JSON.stringify(one)}`); }
  // 10. Voices: each guide voice plays its own recording of the stop shown.
  { let found = false;
    for (const D of days) { await go(p, 'guide', D.i); const sel = p.locator('#view select[data-guidepick]').first(); if (!(await sel.count())) continue;
      const card = sel.locator('xpath=ancestor::article[contains(@class,"stopcard")]'), sid = (await card.getAttribute('id') || '').replace(/^stop-/, '');
      const quiet = await card.locator('.banner.quiet').count(); if (quiet) continue;
      const voices = await sel.evaluate(s => [...s.options].map(o => o.value)), seen = [];
      p.on('request', r => { if (/\.mp3/.test(r.url())) seen.push(r.url()); });
      const speakers = await p.evaluate(() => window.__kairouteScripts.voices);
      for (const [k, v] of voices.entries()) { await p.locator('#view select[data-guidepick]').first().selectOption(v); await p.waitForTimeout(300); seen.length = 0;
        const play = p.locator(`#stop-${sid} [data-play="${sid}"]`).first(); await play.click(); await p.waitForTimeout(1200);
        const st = await p.evaluate(() => window.__kairouteScripts.state());
        ok(`voice ${v} plays its own recording of the stop shown`, st.speakingId === sid && seen.some(u => u.includes('/audio/') && u.includes('/' + speakers[k] + '/')), `playing ${st.speakingId} for stop ${sid}; recordings asked: ${seen.join(', ') || 'none'}`);
        await play.click(); await p.waitForTimeout(300); }
      found = true; break; }
    ok('a stop with recorded voices (not a quiet place) was found', found, 'none found'); }
  ok('no page errors', !errs.length, errs.slice(0, 2).join(' | '));
  await ctx.close(); await browser.close(); srv.close();
  const bad = results.filter(r => !r.ok), byRule = new Map(); bad.forEach(r => { const k = r.name.replace(/ \(.*\)$/, ''); if (!byRule.has(k)) byRule.set(k, []); byRule.get(k).push(r); });
  console.log(`Day plan check: ${results.length - bad.length} of ${results.length} pass, ${byRule.size} rule${byRule.size === 1 ? '' : 's'} broken.`);
  for (const [k, rs] of byRule) { console.log(`LEAK: ${k}: ${rs.length} time${rs.length === 1 ? '' : 's'}`); rs.slice(0, 4).forEach(r => console.log(`   ${r.name.replace(/^.*\(/, '(')} ${r.why}`)); }
  process.exit(bad.length ? 1 : 0);
})();
