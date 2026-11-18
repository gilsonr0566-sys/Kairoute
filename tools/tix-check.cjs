// Book ahead tickets (src/features/tickets.js): the ticket row under a book-ahead stop on the Day plan. Fails the publish if:
//  - the Acropolis or Knossos (Greek state sites) don't open Hellenic Heritage, the Ministry of Culture's own store,
//  - the Colosseum (official website colosseo.it) doesn't open the park's own ticket office,
//  - a sight whose official website is on no known store doesn't open that website, or one with no website on record
//    opens anything but a web search labelled "Find official tickets" with the reseller warning,
//  - any link isn't https, or points at a reseller,
//  - the row doesn't say upfront that the entrance fee isn't included,
//  - "Mark booked" doesn't stick (after a reload too), doesn't reach the day's checks, or re-plans the day,
//  - a stop without book-ahead notes gets a row, or anything throws.
// No network: the helper is mocked. Usage: node tools/tix-check.cjs [path/to/index.html] [--shots dir]
const { chromium } = require('playwright'); const path = require('path'), http = require('http'), fs = require('fs');
const args = process.argv.slice(2), si = args.indexOf('--shots'), SHOTS = si >= 0 ? args.splice(si, 2)[1] : '';
const FILE = path.resolve(args[0] || path.join(__dirname, '..', 'index.html'));
const serve = () => new Promise(res => { const root = path.dirname(FILE); const s = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/' + path.basename(FILE); fs.readFile(path.join(root, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': /\.html$/.test(u) ? 'text/html; charset=utf-8' : /\.js$/.test(u) ? 'text/javascript' : 'application/octet-stream' }); r.end(d); }); }); s.listen(0, '127.0.0.1', () => res(s)); });
const RESELLER = /getyourguide|tiqets|viator|klook|musement|headout|civitatis|tripadvisor|booking\.com|expedia/i;
(async () => {
  const srv = await serve(), BASE = `http://127.0.0.1:${srv.address().port}/`, b = await chromium.launch(); let fails = 0;
  const bad = x => { fails++; console.log('FAIL ' + x); }, ok = x => console.log('ok   ' + x);
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
  const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', rt => { const u = rt.request().url();
    if (u.includes('workers.dev')) return rt.fulfill({ status: 503, json: { error: 'busy' } });
    return u.startsWith(BASE) && !/sw\.js$/.test(u) ? rt.continue() : rt.abort(); });
  await p.goto(BASE); await p.waitForTimeout(900);
  const days = await p.evaluate(() => window.__kairouteDays());
  const rows = async () => p.evaluate(() => [...document.querySelectorAll('#view .tixrow')].map(r => ({ sid: r.dataset.tix, text: r.innerText.replace(/\s+/g, ' '), href: r.querySelector('a.tixbook').href, done: r.classList.contains('done') })));
  const at = async i => { await p.evaluate(i => window.__kairouteAt(i, 'plan'), i); await p.waitForTimeout(200); };
  const stops = async () => p.evaluate(() => [...document.querySelectorAll('#view [data-stop]')].map(x => x.dataset.stop + '@' + ((x.querySelector('.tcell, .time') || {}).textContent || '').trim()).join('|'));
  let all = [];
  for (const d of days) { if (d.type === 'sea') continue; await at(d.i); const r = await rows(); r.forEach(x => all.push(Object.assign({ day: d.i, dest: d.dest }, x))); }
  const find = (re, sid) => all.find(x => re.test(x.dest) && (!sid || x.sid === sid));
  const acro = find(/Athens/, 'acropolis'), kn = find(/Heraklion/, 'knossos'), col = find(/Rome/, 'colosseum');
  acro && acro.href === 'https://tickets.hh.gr/en' ? ok('Acropolis opens Hellenic Heritage') : bad('Acropolis: ' + JSON.stringify(acro));
  kn && kn.href === 'https://tickets.hh.gr/en' ? ok('Knossos opens Hellenic Heritage') : bad('Knossos: ' + JSON.stringify(kn));
  col && col.href === 'https://ticketing.colosseo.it/en/' ? ok('Colosseum opens its own ticket office') : bad('Colosseum: ' + JSON.stringify(col));
  const srch = all.filter(x => /duckduckgo\.com/.test(x.href));
  srch.length && srch.every(x => /Find official tickets/.test(x.text) && /resellers/.test(x.text)) ? ok(`no website on record: ${srch.length} rows open a labelled search with the reseller warning`) : bad('search rows: ' + JSON.stringify(srch.slice(0, 2)));
  all.every(x => /^https:\/\//.test(x.href) && !RESELLER.test(x.href)) ? ok(`all ${all.length} ticket links are https and none is a reseller`) : bad('a link is not https or is a reseller');
  all.every(x => /Entrance fee not included: you pay the site/.test(x.text)) ? ok('every row says the entrance fee is not included') : bad('fee note missing');
  // The rule itself, on sights from any city.
  const L = await p.evaluate(() => { const t = window.__kairouteTix.link; return {
    web: t({ name: 'Prado Museum', web: 'https://www.museodelprado.es/en' }, 'Spain', 'Madrid'),
    alh: t({ name: 'Alhambra', web: 'https://www.alhambra-patronato.es/en' }, 'Spain', 'Granada'),
    delphi: t({ name: 'Delphi', category: 'Archaeological site' }, 'Greece', 'Delphi'),
    grMus: t({ name: 'Benaki Museum', category: 'Museum' }, 'Greece', 'Athens'),
    junk: t({ name: 'X', web: 'javascript:alert(1)' }, 'Italy', 'Rome') }; });
  L.web.kind === 'official' && L.web.url === 'https://www.museodelprado.es/en' ? ok('official website used when no store matches') : bad('web: ' + JSON.stringify(L.web));
  L.alh.url === 'https://tickets.alhambra-patronato.es/en/' ? ok('Alhambra opens its own ticket office') : bad('alh: ' + JSON.stringify(L.alh));
  L.delphi.url === 'https://tickets.hh.gr/en' ? ok('any Greek archaeological site opens Hellenic Heritage') : bad('delphi: ' + JSON.stringify(L.delphi));
  L.grMus.kind === 'search' ? ok('a private Greek museum is not sent to the state store') : bad('benaki: ' + JSON.stringify(L.grMus));
  L.junk.kind === 'search' ? ok('a non-web address is never offered') : bad('junk: ' + JSON.stringify(L.junk));
  // Mark booked: sticks, reaches the checks, doesn't re-plan.
  await at(acro.day); const before = await stops(); if (!before) bad('could not read the day plan stops');
  if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); }
  const shot = async (name, sel) => { if (!SHOTS) return; const el = await p.$(sel); if (el) { await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(150); } await p.screenshot({ path: path.join(SHOTS, name) }); };
  await shot('tablet-book-ahead.png', '#view .tixrow');
  await p.click(`#view .tixrow[data-tix="acropolis"] [data-act="tixdone"]`); await p.waitForTimeout(200);
  let r = (await rows()).find(x => x.sid === 'acropolis');
  r && r.done && /tickets booked/i.test(r.text) ? ok('Mark booked ticks the Acropolis') : bad('after tick: ' + JSON.stringify(r));
  await shot('tablet-booked.png', '#view .tixrow');
  (await stops()) === before ? ok('ticking booked does not re-plan the day') : bad('stops changed after tick');
  await p.reload(); await p.waitForTimeout(900); await at(acro.day);
  r = (await rows()).find(x => x.sid === 'acropolis'); r && r.done ? ok('booked survives a reload') : bad('booked lost on reload');
  const checks = await p.evaluate(() => document.querySelector('#view').innerText);
  !/Book ahead \(timed tickets can sell out\):[^.]*Acropolis and Parthenon/.test(checks) ? ok('day checks no longer list the booked Acropolis') : bad('checks still ask to book the Acropolis');
  await p.click(`#view .tixrow[data-tix="acropolis"] [data-act="tixdone"]`); await p.waitForTimeout(200);
  r = (await rows()).find(x => x.sid === 'acropolis'); r && !r.done ? ok('Undo clears it') : bad('undo failed');
  // A stop without book-ahead notes has no row.
  const stray = await p.evaluate(() => [...document.querySelectorAll('#view .tixrow')].filter(r => !/book ahead|tickets booked/i.test(r.innerText)).length);
  !stray ? ok('only book-ahead stops get a ticket row') : bad(stray + ' rows on stops without book-ahead notes');
  // Phone.
  if (SHOTS) { await p.setViewportSize({ width: 412, height: 915 }); await at(kn.day); await shot('phone-book-ahead.png', '#view .tixrow'); }
  errs.length ? bad('page errors: ' + errs.join(' | ')) : ok('no page errors');
  await b.close(); srv.close();
  console.log(fails ? `${fails} ticket check(s) failed` : 'Ticket checks passed'); process.exit(fails ? 1 : 0);
})();
