// AI and voice honesty check (Nov 21 review): the app's words and buttons must match what the helper can really do
// right now, read from its /status "caps". Runs the built app against a stand-in helper in three states (AI off,
// minimal AI, full AI) with no network or cost, opens Settings (AI guide, Natural voice) and every page of every day
// on phone and tablet, and fails when:
//   - the app promises a job the helper has switched off (photos, questions, a natural voice being made),
//   - the app tells the traveler to "turn on the AI guide in Settings" (there is no such switch for them),
//   - a "Tell me more" or question box is shown while questions are off,
//   - in full mode, those features are NOT offered (so the check can't pass by hiding everything).
// Usage: sh build.sh && node tools/ai-honesty-check.cjs [index.html]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const http = require('http');
const ROOT = path.resolve(path.dirname(process.argv[2] || path.join(__dirname, '..', 'index.html')));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/json', '.txt': 'text/plain' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  if (q.url.split('?')[0] === '/ai.json') { r.writeHead(200, { 'content-type': 'application/json' }); return r.end(JSON.stringify({ url: 'https://helper.test' })); }
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
const CAPS = {
  off: { on: false, mode: 'off', caps: { tripImport: false, cityGuide: false, askQuestions: false, photoIdentify: false, extras: false, stopScripts: false, liveVoice: false, savedVoice: true, savedGuides: true } },
  minimal: { on: true, mode: 'minimal', caps: { tripImport: true, cityGuide: true, askQuestions: false, photoIdentify: false, extras: false, stopScripts: false, liveVoice: false, savedVoice: true, savedGuides: true } },
  full: { on: true, mode: 'full', caps: { tripImport: true, cityGuide: true, askQuestions: true, photoIdentify: true, extras: true, stopScripts: true, liveVoice: true, savedVoice: true, savedGuides: true } } };
// Words that promise a switched-off job.
const PROMISE = { askQuestions: /answers? (your )?questions|ask the guide questions/i, photoIdentify: /reads? itinerary photos|names? a sight from your photo/i, liveVoice: /lifelike AI recording of each story/i };
const DEAD_END = /turn on the AI guide in Settings/i;
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL ' + m); } };
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = `http://localhost:${srv.address().port}/index.html`;
  const b = await chromium.launch();
  for (const [state, st] of Object.entries(CAPS)) for (const [tag, vp] of [['phone', { width: 412, height: 900 }], ['tablet', { width: 1280, height: 800 }]]) {
    const ctx = await b.newContext({ viewport: vp }); let identify = 0;
    await ctx.route(/^https?:\/\/(?!localhost:\d{2,5}\/)/, r => { const u = new URL(r.request().url());
      if (u.hostname === 'helper.test') { if (u.pathname === '/status') return r.fulfill({ json: { ok: true, left: 2000, budget: 3000, ...st } });
        if (u.pathname === '/identify') identify++; return r.fulfill({ status: 403, json: { error: 'off', disabled: true } }); }
      return r.abort(); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(1500);
    const cont = p.getByText('Continue trip'); if (await cont.count()) { await cont.first().click(); await p.waitForTimeout(500); }
    // Settings: the AI guide and the voice, word for word.
    await p.evaluate(() => document.querySelector('[data-act="settings"]') && document.querySelector('[data-act="settings"]').click()); await p.waitForTimeout(300);
    const sec = async k => { await p.evaluate(k => { const x = document.querySelector(`[data-setsec="${k}"]`); if (x) x.click(); }, k); await p.waitForTimeout(200); return p.evaluate(() => document.body.innerText); };
    // What Settings says is off ("Not in this version yet: ...") is not a promise.
    const said = t => t.replace(/Not in this version yet:[^.]*\./g, '');
    const aiTxt = said(await sec('ai')), voiceTxt = said(await sec('voice'));
    for (const [k, re] of Object.entries(PROMISE)) { const said = re.test(aiTxt + '\n' + voiceTxt);
      if (!st.caps[k]) ok(!said, `${state} ${tag}: Settings promises "${(aiTxt + voiceTxt).match(re)}" but ${k} is off`);
      else if (k !== 'liveVoice') ok(said, `${state} ${tag}: Settings doesn't mention ${k}, which is on`); }
    ok(!DEAD_END.test(aiTxt + voiceTxt), `${state} ${tag}: Settings sends the traveler to a switch they don't have`);
    // Every page of every day: no dead end, no question box or "Tell me more" while questions are off.
    await p.evaluate(() => { const x = document.querySelector('[data-act="setclose"],[data-act="home"],[data-act="back"]'); if (x) x.click(); }); await p.waitForTimeout(300);
    const days = await p.evaluate(() => (window.__kairouteDays ? window.__kairouteDays() : []));
    ok(days.length > 0, `${state} ${tag}: no days to check`);
    let deadEnds = 0, askShown = 0, moreShown = 0, pages = 0;
    for (const d of days) for (const v of ['plan', 'sites', 'guide', 'tour', 'trip']) {
      try { await p.evaluate(([i, v]) => window.__kairouteAt(i, v), [d.i, v]); } catch (e) { continue; } await p.waitForTimeout(80); pages++;
      await p.evaluate(() => { document.querySelectorAll('#view .site').forEach(x => x.classList.add('open')); document.querySelectorAll('details').forEach(x => { x.open = true; }); });
      const r = await p.evaluate(() => ({ t: document.body.innerText, ask: document.querySelectorAll('form.ask[data-ask]').length, more: document.querySelectorAll('#view [data-deeper]').length }));
      if (DEAD_END.test(r.t)) deadEnds++; askShown += r.ask; moreShown += r.more; }
    ok(deadEnds === 0, `${state} ${tag}: ${deadEnds} of ${pages} pages tell the traveler to turn on the AI guide in Settings`);
    if (!st.caps.askQuestions) { ok(askShown === 0, `${state} ${tag}: a question box shows on ${askShown} place(s) while questions are off`); ok(moreShown === 0, `${state} ${tag}: "Tell me more" shows ${moreShown} time(s) while questions are off`); }
    else ok(askShown + moreShown > 0, `${state} ${tag}: questions are on but no question box or "Tell me more" was offered (check may be blind)`);
    if (errs.length) console.log(`NOTE ${state} ${tag}: ${errs.length} script error(s), first: ${errs[0].slice(0, 160)}`);
    console.log(`${state} ${tag}: ${pages} pages`);
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(fails ? `AI honesty check: ${fails} of ${checks} failed` : `AI honesty check passed (${checks} checks)`);
  process.exit(fails ? 1 : 0);
})();
