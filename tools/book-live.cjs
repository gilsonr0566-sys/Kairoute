// Book the train on the live site with the real helper: the Barcelona -> Madrid day's card shows real departures and
// opens Trainline's route page; the helper's /departures and /bookcheck answer for a few routes. Phone and tablet,
// screenshots of the card in checks/book/. Usage: node tools/book-live.cjs [url]
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const URL = process.argv[2] || process.env.URL || 'https://gilsonr0566-sys.github.io/Kairoute/';
const OUT = path.join(__dirname, '..', 'checks', 'book'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(); let fails = 0; const bad = m => { fails++; console.log('FAIL ' + m); }, ok = m => console.log('ok   ' + m);
  for (const [name, w, h] of [['tablet', 1280, 800], ['phone', 412, 915]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, locale: 'en-US', hasTouch: name === 'phone', isMobile: name === 'phone' });
    await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    // No AI (Richard, Nov 17: none without his consent): the helper is reached only for timetables and the booking-page
    // check; every other helper call (guides, scripts, voice, photo reading) is refused before it leaves the browser.
    await ctx.route(/workers\.dev\//, r => /\/(departures|bookcheck)\?|\/transit$/.test(r.request().url()) ? r.continue() : r.fulfill({ status: 503, json: { error: 'off in this check' } }));
    await p.goto(URL, { waitUntil: 'load', timeout: 60000 }); await p.waitForTimeout(3000);
    if (!(await p.evaluate(() => !!window.__kairouteBook))) { bad(name + ': live build has no Book train yet'); await ctx.close(); continue; }
    const days = await p.evaluate(() => window.__kairouteDays()), i = days.find(d => d.type === 'departure' && /Barcelona/.test(d.dest)).i;
    await p.evaluate(i => window.__kairouteAt(i, 'plan'), i);
    let c = null; for (let k = 0; k < 90; k++) { await p.waitForTimeout(1000); c = await p.evaluate(() => { const e = document.querySelector('#view .bookride'); return e ? { t: e.innerText.replace(/\s+/g, ' '), href: (e.querySelector('.brbook') || {}).href } : null; }); if (c && /→|couldn't|No published|Only part/.test(c.t)) break; }
    if (!c) { bad(name + ': no card'); await ctx.close(); continue; }
    console.log(name + ' card: ' + c.t);
    /→ \d\d:\d\d/.test(c.t) ? ok(name + ': real departures shown') : bad(name + ': no departures: ' + c.t.slice(0, 200));
    c.href === 'https://www.thetrainline.com/en/train-times/barcelona-to-madrid' ? ok(name + ': Book train -> ' + c.href) : bad(name + ': link ' + c.href);
    const el = await p.$('#view .bookride'); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
    await el.screenshot({ path: path.join(OUT, name + '-card.png') });
    await p.evaluate(() => { const e = document.querySelector('#view .bookride'); e.scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(OUT, name + '-screen.png') });
    // The Athens day with the Corinth Canal: its ride there (the train whose stations are a taxi away, Nov 17).
    for (const d of days.filter(d => /Athens/.test(d.dest))) {
      await p.evaluate(i => window.__kairouteAt(i, 'plan'), d.i); await p.waitForTimeout(1500);
      if (!(await p.evaluate(() => /Corinth/.test(document.querySelector('#view').innerText)))) continue;
      let r = null; for (let k = 0; k < 90 && !(r && /Train/.test(r)); k++) { await p.waitForTimeout(1000); r = await p.evaluate(() => { const ch = [...document.querySelectorAll('#view .ridechips')].find(e => /Train/.test(e.innerText)); return ch ? ch.innerText.replace(/\s+/g, ' ') : null; }); }
      console.log(name + ' Corinth ride: ' + r);
      r && /Train/.test(r) ? ok(name + ': train offered to Corinth') : bad(name + ': no train chip to Corinth: ' + r);
      await p.evaluate(() => { const ch = [...document.querySelectorAll('#view .ridechips')].find(e => /Train/.test(e.innerText)); if (ch) ch.scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(500);
      await p.screenshot({ path: path.join(OUT, name + '-corinth.png') });
      break;
    }
    errs.length ? bad(name + ': page errors: ' + errs.slice(0, 3).join(' | ')) : ok(name + ': no page errors');
    if (name === 'tablet') {
      const helper = await p.evaluate(async () => { const u = JSON.parse(await (await fetch('ai.json')).text()).url, out = [];
        for (const q of ['a=41.3792,2.14&b=40.4065,-3.6895&date=2027-07-18&mode=train', 'a=41.9010,12.5018&b=43.7764,11.2480&date=2026-12-07&mode=train', 'a=37.9420,23.6370&b=37.4467,25.3289&date=2027-07-05&mode=ferry']) {
          try { const j = await (await fetch(u + '/departures?' + q)).json(); out.push(q + ' => ' + (j.error || `${j.deps.length} departures, forDate ${j.forDate} (${j.date}): ` + j.deps.slice(0, 6).map(d => `${String(Math.floor(d.t / 60)).padStart(2, '0')}:${String(d.t % 60).padStart(2, '0')}+${d.min}m`).join(' '))); } catch (e) { out.push(q + ' => ' + e.message); } }
        for (const q of ['from=barcelona&to=madrid', 'from=athens&to=thessaloniki', 'from=rome&to=florence']) { try { out.push(q + ' => ' + JSON.stringify(await (await fetch(u + '/bookcheck?' + q)).json())); } catch (e) { out.push(q + ' => ' + e.message); } }
        return out; });
      helper.forEach(x => console.log('helper ' + x));
    }
    await ctx.close();
  }
  // PRINT=1: the pictures as text in the log (JPEG), for a reader who can read the log but not download the artifact.
  if (process.env.PRINT) { const { chromium: c2 } = require('playwright'); for (const f of fs.readdirSync(OUT).filter(f => f.endsWith('.png'))) {
    const b2 = await c2.launch(), pg = await b2.newPage(); await pg.setContent(`<img src="data:image/png;base64,${fs.readFileSync(path.join(OUT, f)).toString('base64')}">`);
    const im = await pg.$('img'), j = await im.screenshot({ type: 'jpeg', quality: 80 }); await b2.close();
    console.log(`IMG ${f.replace('.png', '.jpg')} ${j.toString('base64')}`); } }
  await b.close(); console.log(fails ? `Book live check: ${fails} problem(s)` : 'Book live check passed'); process.exit(fails ? 1 : 0);
})();
