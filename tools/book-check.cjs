// Book the train (src/features/book-ride.js): the card at the end of a leaving day by train or ferry. Fails the publish if:
//  - the Barcelona -> Madrid train day has no card, or its button doesn't open Trainline's Barcelona to Madrid page,
//  - a route Trainline has no page for (the helper says "missing") still opens Trainline, or a ferry leg doesn't open Rome2Rio,
//  - the departures shown aren't the timetable's (nearest the planned time, in time order), the planned train isn't
//    marked when it's in the timetable, or a planned time missing from that day's published timetable isn't flagged,
//  - usual-day times aren't labelled as usual times, or a helper that can't answer leaves "Looking up" on screen,
//  - a flight day, or a train day with no arrival after it, shows a card,
//  - a timetable answer re-plans the day, or anything throws.
// No network: the helper is mocked. Usage: node tools/book-check.cjs [path/to/index.html]
const { chromium } = require('playwright'); const path = require('path'), http = require('http'), fs = require('fs');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const serve = () => new Promise(res => { const root = path.dirname(FILE); const s = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/' + path.basename(FILE); fs.readFile(path.join(root, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': /\.html$/.test(u) ? 'text/html; charset=utf-8' : /\.js$/.test(u) ? 'text/javascript' : /\.json$/.test(u) ? 'application/json' : 'application/octet-stream' }); r.end(d); }); }); s.listen(0, '127.0.0.1', () => res(s)); });
const m = s => +s.slice(0, 2) * 60 + +s.slice(3);
const DEPS = [['07:27', '10:37'], ['09:00', '12:17'], ['12:00', '15:44'], ['12:50', '16:18'], ['13:00', '16:44'], ['14:00', '17:44'], ['15:00', '18:17'], ['17:25', '20:27']].map(([a, b]) => ({ t: m(a), arr: m(b), min: m(b) - m(a), changes: 0, fast: true }));
(async () => {
  const srv = await serve(), BASE = `http://127.0.0.1:${srv.address().port}/`, b = await chromium.launch(); let fails = 0;
  const bad = x => { fails++; console.log('FAIL ' + x); }, ok = x => console.log('ok   ' + x);
  // mode: what the mocked helper answers.
  async function open(mode, size) {
    const ctx = await b.newContext({ viewport: size || { width: 1280, height: 800 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', rt => { const u = rt.request().url();
      if (u.includes('/departures')) return new Promise(r => setTimeout(r, mode.slow ? 2500 : 0)).then(() => mode.dep === 'fail' ? rt.fulfill({ status: 503, json: { error: 'busy' } }) : rt.fulfill({ json: { deps: mode.dep === 'no13' ? DEPS.filter(d => d.t !== 780) : DEPS, forDate: !!mode.forDate, date: '2027-07-18' } }));
      if (u.includes('/bookcheck')) return rt.fulfill({ json: { trainline: mode.tl || 'ok' } });
      if (u.includes('workers.dev/status')) return rt.fulfill({ json: { left: 5000, budget: 8500 } });
      if (u.includes('workers.dev')) return rt.fulfill({ status: 503, json: { error: 'busy' } });
      return u.startsWith(BASE) && !/sw\.js$/.test(u) ? rt.continue() : rt.abort(); });
    await p.route('https://gilsonr0566-sys.github.io/**', rt => rt.abort());
    await p.goto(BASE); await p.waitForTimeout(800);
    const days = await p.evaluate(() => window.__kairouteDays());
    return { ctx, p, errs, days, bcn: days.find(d => d.type === 'departure' && /Barcelona/.test(d.dest)).i, mad: days.find(d => d.type === 'departure' && /Madrid/.test(d.dest)).i };
  }
  const card = async p => p.evaluate(() => { const c = document.querySelector('#view .bookride'); if (!c) return null; const a = c.querySelector('.brbook');
    return { text: c.innerText.replace(/\s+/g, ' '), href: a && a.href, times: [...c.querySelectorAll('.brtimes li b')].map(x => x.textContent), mine: (c.querySelector('.brtimes li.mine b') || {}).textContent || '', warn: !!c.querySelector('.banner.warn') }; });
  const waitCard = async (p, re) => { let c = null; for (let k = 0; k < 30; k++) { c = await card(p); if (c && (!re || re.test(c.text))) return c; await p.waitForTimeout(250); } return c; };

  // 1. The trip's own train day, timetable for the date.
  { const { ctx, p, errs, bcn, mad } = await open({ forDate: true, slow: true });
    await p.evaluate(i => window.__kairouteAt(i, 'plan'), bcn);
    for (let k = 0; k < 60 && !(await p.evaluate(() => window.__kairouteSettled())); k++) await p.waitForTimeout(250);
    await p.waitForTimeout(300); const built0 = await p.evaluate(() => window.__kairoutePlanStat().built);
    const c = await waitCard(p, /→/);
    if (!c) bad('no Book train card on the Barcelona -> Madrid day');
    else {
      c.href === 'https://www.thetrainline.com/en/train-times/barcelona-to-madrid' ? ok('Book train opens ' + c.href) : bad('Book train link: ' + c.href);
      /Train to Madrid/.test(c.text) && /Choose Sun Jul 18/.test(c.text) ? ok('card names the route and the date to choose') : bad('card text: ' + c.text.slice(0, 200));
      JSON.stringify(c.times) === JSON.stringify(['12:00', '12:50', '13:00', '14:00', '15:00']) ? ok('five departures nearest 13:00, in time order: ' + c.times.join(' ')) : bad('departures shown: ' + c.times.join(' '));
      c.mine === '13:00' ? ok('the planned 13:00 train is marked') : bad('planned train not marked: ' + c.mine);
      /Trains on Sun Jul 18/i.test(c.text) && !c.warn ? ok('labelled as that date\'s trains, no warning') : bad('label/warning wrong: ' + c.text.slice(0, 160));
      /\$|€|£|fare from/i.test(c.text.replace(/The fare is set by the rail company and shown before you pay\./, '')) ? bad('a price is shown: ' + c.text) : ok('no made-up prices');
    }
    await p.waitForTimeout(1500);
    const built1 = await p.evaluate(() => window.__kairoutePlanStat().built);
    built1 === built0 ? ok('timetable answer never re-plans the day') : bad(`timetable answer re-planned (${built0} -> ${built1})`);
    await p.evaluate(i => window.__kairouteAt(i, 'plan'), mad); await p.waitForTimeout(500);
    (await card(p)) ? bad('a flight day shows a Book train card') : ok('no card on the flight home');
    await p.evaluate(i => { window.__kairouteEdit(i, { mode: 'train' }); window.__kairouteAt(i, 'plan'); }, mad); await p.waitForTimeout(500);
    (await card(p)) ? bad('a train day with no arrival after it shows a card') : ok('no card when the trip has no arrival after the train');
    errs.length ? bad('page errors: ' + errs.slice(0, 3).join(' | ')) : ok('no page errors');
    await ctx.close(); }
  // 2. Planned time missing from the date's timetable; usual times; helper down; Trainline has no page; ferry.
  { const { ctx, p, bcn } = await open({ forDate: true, dep: 'no13' }); await p.evaluate(i => window.__kairouteAt(i, 'plan'), bcn);
    const c = await waitCard(p, /→/); c && c.warn && /don't see a 13:00 train/.test(c.text) ? ok('a planned time not in the published timetable is flagged') : bad('missing 13:00 not flagged: ' + (c && c.text.slice(0, 200)));
    await ctx.close(); }
  { const { ctx, p, bcn } = await open({ forDate: false, dep: 'no13' }); await p.evaluate(i => window.__kairouteAt(i, 'plan'), bcn);
    const c = await waitCard(p, /→/); c && /Usual Sunday trains/i.test(c.text) && /isn't out yet/.test(c.text) && !c.warn ? ok('usual-day times are labelled usual, no warning') : bad('usual times label: ' + (c && c.text.slice(0, 220)));
    await ctx.close(); }
  { const { ctx, p, bcn } = await open({ dep: 'fail' }); await p.evaluate(i => window.__kairouteAt(i, 'plan'), bcn);
    const c = await waitCard(p, /couldn't be loaded/); c && /couldn't be loaded/.test(c.text) && c.href ? ok('helper down: says so and still offers Book train') : bad('helper down: ' + (c && c.text.slice(0, 200)));
    await ctx.close(); }
  { const { ctx, p, bcn } = await open({ tl: 'missing', forDate: true }); await p.evaluate(i => window.__kairouteAt(i, 'plan'), bcn);
    let c = null; for (let k = 0; k < 20; k++) { c = await card(p); if (c && /rome2rio/.test(c.href)) break; await p.waitForTimeout(250); }
    c && c.href === 'https://www.rome2rio.com/map/Barcelona/Madrid' ? ok('no Trainline page: opens ' + c.href) : bad('missing Trainline page still links ' + (c && c.href));
    await ctx.close(); }
  { const { ctx, p, bcn } = await open({ forDate: true }, { width: 412, height: 915 });
    await p.evaluate(i => { window.__kairouteEdit(i, { mode: 'ferry' }); window.__kairouteEdit(i + 1, { mode: 'ferry' }); window.__kairouteAt(i, 'plan'); }, bcn);
    const c = await waitCard(p); c && /Ferry to Madrid/.test(c.text) && /Book ferry/.test(c.text) && /rome2rio\.com/.test(c.href) ? ok('a ferry leg gets Book ferry on Rome2Rio (phone)') : bad('ferry leg: ' + (c && c.text.slice(0, 160) + ' ' + c.href));
    const wide = await p.evaluate(() => { const c = document.querySelector('#view .bookride'); return c ? c.scrollWidth - c.clientWidth : 0; });
    wide <= 1 ? ok('card fits the phone screen') : bad('card wider than the phone by ' + wide + 'px');
    await ctx.close(); }
  await b.close(); srv.close();
  console.log(fails ? `Book check: ${fails} problem(s)` : 'Book check passed'); process.exit(fails ? 1 : 0);
})();
