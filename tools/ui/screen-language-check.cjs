// Every finished screen in the traveler's language, on every saved test trip (Rule R-11; Richard, Nov 23: "the app is
// presented in the language that is selected to view it in"; Nov 25: one app-wide rule, every source, every screen).
// The language checks until now read what the PLANNER hands the app (tools/truth/language-check.cjs,
// tools/beta2/names-check.cjs). The app prints names in some 450 places of its own, from a dozen sources, and the screen
// rule read the Day plan of one trip. So a name in another script planted in a saved guide passed every check and
// reached the Day plan, the Guide and the Tour on 17 of the 35 saved trips (Nov 25).
// This opens the BUILT Beta 2 app (never the demo; no internet, no AI) on EVERY saved test trip and reads EVERY screen
// the traveler can open: the trip page, and for every day ashore the Day plan, Choose sights, the Guide and the Tour,
// with every folded card opened, then the Journal. It reads the words on the page and the words a screen reader
// speaks (labels, titles, picture descriptions, hints). Five parts:
//   1 AS SAVED   every trip as it is: no letter of another script anywhere, and the app's last-step rule (the exit rule,
//                src/features/shown-language.js) never had to act: a source that lets a name through is found here, not hidden.
//   2 PLANTED    every trip again with names in 7 scripts planted in every text of every source the trip holds (sight,
//                town and restaurant names, ride notes, descriptions, stories, tips, hotel, pier, station and airport
//                names): still no letter of another script on any screen.
//   3 EXIT ALONE the same planted trips with the source rule switched off: the exit rule alone keeps every screen clean.
//   4 NOT BLIND  with both rules switched off the check itself must find the planted names on screen, or it is blind.
//   5 ANY SOURCE text in another script written straight onto the page, into a label, a drawn picture, the voice and
//                the clipboard (as any code, old or new, could do) leaves in Latin letters; the phrase card's local
//                words stay as they are.
// Usage: node tools/ui/screen-language-check.cjs [beta2-site/index.html]   TRIPS=g06,g17 (name prefixes)  PARTS=12345
//   LANES=4  PROOF=4 (trips used for parts 3 and 4)  SHOW=6. Exit 1 on any failure; a trip that will not open is NOT TESTED.
'use strict';
const { chromium } = require('playwright'); const path = require('path'), http = require('http'), fs = require('fs');
const ROOT = path.join(__dirname, '..', '..'), FILE = path.resolve(process.argv[2] || path.join(ROOT, 'beta2-site', 'index.html'));
const CORPUS = process.env.CORPUS || path.join(ROOT, 'tools', 'beta2', 'corpus');
const ONLY = (process.env.TRIPS || '').split(',').filter(Boolean), PARTS = process.env.PARTS || '12345', LANES = +(process.env.LANES || 4), PROOF = +(process.env.PROOF || 4), SHOW = +(process.env.SHOW || 6);
// A letter of any writing system but Latin (digits, punctuation, symbols, icons and accents belong to no script).
const OTHER = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\p{Script=Braille}]/u;
const SCR = ['נתי מזנון', '三条駅', 'Σταθμός Λαρίσης', 'مطعم الشاطئ', '경복궁', 'วัดพระแก้ว', 'Кафе Пушкин'];
const fails = [], notTested = [], log = s => console.log(s);
const fail = (part, why) => { fails.push(part + ': ' + why); log(`FAIL ${part}: ${why}`); };
function serve() { return new Promise(res => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
  const f = u === '/' || u === '/index.html' ? FILE : path.join(path.dirname(FILE), u);
  if (!f.startsWith(path.dirname(FILE)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
  s.listen(0, () => res({ url: 'http://localhost:' + s.address().port + '/', close: () => s.close() })); }); }
// A saved test trip as the app keeps it on the device (as tools/client/steady-all.cjs does).
function appTrip(name, c) {
  const days = c.days.map(d => { const x = Object.assign({}, d); delete x.i; delete x.sites; delete x.wx; delete x.missing; delete x.order;
    x.cityKey = d.city; x.destination = d.city && c.cities[d.city] ? c.cities[d.city].name : d.destination || ''; return x; });
  return { trip: { id: 'lang-' + name, name: c.name || name, style: c.style || 'mix', active: 0, days, lodging: {}, journal: {}, prefs: c.prefs || {}, legModes: c.legModes || {} }, cities: c.cities };
}
// A name in another script in every text of every source the trip holds. Texts the traveler typed (the trip's and the
// place's own name) and the phrase card are left as they are.
const TEXT = /^(name|summary|guide|desc|why|note|tip|travel|travelNote|tickets|crowds|priceNote|access|blurb|cuisine|townName|lookFor|picks|photoTip|travelerTip|gettingAround|tipping|safety|emergency|plugs|water|address|label|title|text|local|style)$/;
function plant(c) { let k = 0, n = 0; const p = () => SCR[k++ % SCR.length];
  const walk = (o, key) => { if (Array.isArray(o)) { o.forEach((v, i) => { if (typeof v === 'string' && TEXT.test(key) && v) { o[i] = p() + ' ' + v; n++; } else walk(v, key); }); return; }
    if (!o || typeof o !== 'object') return;
    for (const [kk, v] of Object.entries(o)) { if (kk === 'phrases' || kk === 'tags') continue; if (typeof v === 'string') { if (TEXT.test(kk) && v) { o[kk] = kk === 'travelNote' || kk === 'travel' ? 'Train from ' + p() + ', about 30 min' : p() + ' ' + v; n++; } } else walk(v, kk); } };
  for (const city of Object.values(c.cities)) for (const kk of Object.keys(city)) if (kk !== 'name' && kk !== 'key') walk(city[kk], kk);
  for (const d of c.days) for (const f of ['lodging', 'point', 'pier', 'hotel']) if (d[f] && d[f].name) { d[f].name = p() + ' ' + d[f].name; n++; }
  return n; }
const SEED = ([seed, plantSwitch]) => { if (plantSwitch) window.__kairoutePlant = plantSwitch;
  try { const ls = localStorage; if (!ls.getItem('b2:__copied')) { ls.setItem('b2:__copied', '1'); ls.setItem('b2:__merged2', '1');
    ls.setItem('b2:wayside.trip2', seed.trip); ls.setItem('b2:wayside.cities', seed.cities); ls.setItem('b2:kairoute.lobbySeen', '1');
    ['intro1', 'sunprincess1', 'spread1', 'bible1', 'coach1', 'coachDone', 'tourTip'].forEach(k => ls.setItem('b2:kairoute.' + k, '1')); } } catch (e) {} };
// One screen as the traveler has it: the words on the page with every folded card open, and what a screen reader says.
const READ = async ([v, i]) => { try { window.__kairouteGo(v, i); } catch (e) { return { err: e.message }; }
  await new Promise(r => setTimeout(r, 800)); document.querySelectorAll('details').forEach(d => { d.open = true; }); await new Promise(r => setTimeout(r, 300));
  const skip = el => !!(el && el.closest && el.closest('.pl, [data-local-words]')); // the phrase card's local words
  const texts = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const t = n.data.trim(); if (t && !skip(n.parentElement) && !n.parentElement.closest('script,style')) texts.push(t); }
  for (const el of document.querySelectorAll('[aria-label],[title],[alt],[placeholder]')) if (!skip(el)) for (const a of ['aria-label', 'title', 'alt', 'placeholder']) { const t = el.getAttribute(a); if (t) texts.push(t); }
  const L = window.__kairouteLang || null;
  return { view: window.__kairouteState && window.__kairouteState().view, texts, exit: L ? L.fixed : null, exitLast: L ? L.last.slice(0, 5) : [] }; };

async function runTrips(browser, url, files, opts) {
  const res = { trips: 0, screens: 0, texts: 0, found: [], exit: 0, exitEx: [], opened: [], planted: 0 }; let next = 0;
  const lane = async () => { while (next < files.length) { const f = files[next++], name = f.replace(/\.json$/, '');
    let c; try { c = JSON.parse(fs.readFileSync(path.join(CORPUS, f), 'utf8')); } catch (e) { notTested.push(`${opts.part} ${name}: trip file unreadable`); continue; }
    if (!c.days || !c.cities) { notTested.push(`${opts.part} ${name}: trip file has no days or places`); continue; }
    if (opts.plant) res.planted += plant(c);
    const a = appTrip(name, c), vp = opts.tablet && next % 3 === 0 ? { width: 1280, height: 800 } : { width: 412, height: 915 };
    const ctx = await browser.newContext({ viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 1, timezoneId: 'America/Chicago' });
    await ctx.addInitScript(SEED, [{ trip: JSON.stringify(a.trip), cities: JSON.stringify(a.cities) }, opts.plantSwitch || '']);
    await ctx.route(u => !/^http:\/\/localhost/.test(String(u)), r => r.fulfill({ status: 503, body: '' }));
    const p = await ctx.newPage(); await p.goto(url, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000);
    const days = await p.evaluate(() => window.__kairouteDays && window.__kairouteState ? window.__kairouteDays().map((d, i) => ({ i, type: d.type })) : null).catch(() => null);
    if (!days || !days.length) { notTested.push(`${opts.part} ${name}: the trip did not open in the app`); await ctx.close(); continue; }
    res.trips++; res.opened.push(name);
    const screens = [['trip', 0]]; days.filter(d => d.type !== 'sea').forEach(d => screens.push(['plan', d.i], ['sites', d.i], ['guide', d.i], ['tour', d.i])); screens.push(['journal', 0]);
    let exit = 0, last = [];
    for (const [v, i] of screens) { const r = await p.evaluate(READ, [v, i]).catch(e => ({ err: e.message }));
      if (r.err) { notTested.push(`${opts.part} ${name} ${v} day ${i + 1}: could not open (${String(r.err).slice(0, 60)})`); continue; }
      res.screens++; res.texts += r.texts.length; if (r.exit != null) { exit = r.exit; last = r.exitLast; } else if (!opts.noExit) notTested.push(`${opts.part} ${name}: the app has no exit rule to read (window.__kairouteLang)`);
      for (const t of r.texts) if (OTHER.test(t)) res.found.push(`${name} ${v}${v === 'trip' || v === 'journal' ? '' : ' day ' + (i + 1)}: "${t.replace(/\s+/g, ' ').slice(0, 90)}"`); }
    res.exit += exit; if (exit) res.exitEx.push(`${name}: ${last.join(' | ')}`);
    await ctx.close(); } };
  await Promise.all(Array.from({ length: LANES }, lane));
  return res; }

(async () => {
  if (!fs.existsSync(FILE)) { log(`NOT TESTED: no built app at ${FILE} (sh build-beta2.sh). An unrun check is never a pass.`); process.exit(1); }
  const browser = await chromium.launch(), srv = await serve();
  const files = fs.readdirSync(CORPUS).filter(f => f.endsWith('.json')).sort().filter(f => !ONLY.length || ONLY.some(o => f.startsWith(o)));
  const show = xs => [...new Set(xs)].slice(0, SHOW).forEach(x => log('       ' + x));
  let plantedTrips = [];
  if (PARTS.includes('1')) { const r = await runTrips(browser, srv.url, files, { part: '1 as saved', tablet: true });
    log(`1 AS SAVED   ${r.trips} trips, ${r.screens} screens, ${r.texts} texts read`);
    if (r.found.length) { fail('1 as saved', `${r.found.length} texts in another script on screen`); show(r.found); } else log('ok   no letter of another script on any screen');
    if (r.exit) { fail('1 as saved', `the exit rule had to rewrite ${r.exit} texts: a source let names through in another script`); show(r.exitEx); } else log('ok   the exit rule never had to act: every source gave its names in Latin letters'); }
  if (PARTS.includes('2')) { const r = await runTrips(browser, srv.url, files, { part: '2 planted', plant: true, tablet: true }); plantedTrips = r.opened;
    log(`2 PLANTED    ${r.trips} trips, ${r.screens} screens, ${r.texts} texts read, ${r.planted} texts planted in 7 scripts in every source`);
    if (!r.planted) fail('2 planted', 'nothing was planted');
    if (r.found.length) { fail('2 planted', `${r.found.length} texts in another script on screen`); show(r.found); } else log('ok   no letter of another script on any screen'); }
  // The proofs use the trips with the most to show: the first few that opened (all of them when TRIPS is given).
  const few = (plantedTrips.length ? plantedTrips : files.map(f => f.replace(/\.json$/, ''))).filter(n => !/^(g07|g16|live-cococay)/.test(n) || ONLY.length).slice(0, ONLY.length ? 99 : PROOF).map(n => n + '.json');
  if (PARTS.includes('3')) { const r = await runTrips(browser, srv.url, few, { part: '3 exit alone', plant: true, plantSwitch: 'names-in-off' });
    log(`3 EXIT ALONE ${r.trips} trips, ${r.screens} screens, the source rule switched off`);
    if (r.found.length) { fail('3 exit alone', `${r.found.length} texts in another script on screen`); show(r.found); } else log('ok   no letter of another script on any screen');
    if (!r.exit) fail('3 exit alone', 'the exit rule did not act at all, so this part proved nothing'); else log(`ok   the exit rule rewrote ${r.exit} texts on its own`); }
  if (PARTS.includes('4')) { const r = await runTrips(browser, srv.url, few, { part: '4 not blind', plant: true, plantSwitch: 'names-off', noExit: true });
    const kinds = new Set(r.found.map(x => x.split(' ')[1]));
    log(`4 NOT BLIND  ${r.trips} trips, ${r.screens} screens, both rules switched off`);
    if (r.found.length < 20 || !['plan', 'guide', 'tour'].every(k => kinds.has(k))) fail('4 not blind', `MISSED: with both rules off the check found only ${r.found.length} planted texts (screens: ${[...kinds].join(', ') || 'none'}); it must see them on the Day plan, the Guide and the Tour`);
    else log(`ok   the check sees planted names when nothing stops them: ${r.found.length} texts on ${[...kinds].join(', ')}`); }
  if (PARTS.includes('5')) { const f = few[0] || files[0], name = f.replace(/\.json$/, ''), c = JSON.parse(fs.readFileSync(path.join(CORPUS, f), 'utf8')), a = appTrip(name, c);
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, permissions: ['clipboard-read', 'clipboard-write'] });
    await ctx.addInitScript(SEED, [{ trip: JSON.stringify(a.trip), cities: JSON.stringify(a.cities) }, '']); await ctx.route(u => !/^http:\/\/localhost/.test(String(u)), r => r.fulfill({ status: 503, body: '' }));
    const p = await ctx.newPage(); await p.goto(srv.url, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000);
    const r = await p.evaluate(async SCR => { const out = {}, v = document.getElementById('view') || document.body, tick = () => new Promise(r => setTimeout(r, 30));
      const d = document.createElement('div'); d.innerHTML = SCR.map(s => `<p class="t">${s}</p><p class="t">Train from ${s} to Uji</p><button aria-label="Open ${s}" title="${s}"><img alt="${s} Museum"></button><input placeholder="${s}">`).join('') + `<div class="phrases"><button class="phrase"><span class="pl">${SCR[2]}</span><span class="pm">station</span></button></div>`;
      v.appendChild(d); await tick();
      out.page = [...d.querySelectorAll('.t')].map(e => e.textContent); out.attrs = [...d.querySelectorAll('button:not(.phrase), img, input')].flatMap(e => ['aria-label', 'title', 'alt', 'placeholder'].map(a => e.getAttribute(a)).filter(Boolean)); out.phrase = d.querySelector('.pl').textContent;
      const t = d.querySelector('.t'); t.firstChild.data = 'Lunch at ' + SCR[1]; await tick(); out.changed = t.textContent; t.textContent = SCR[3]; await tick(); out.replaced = t.textContent;
      d.querySelector('button').setAttribute('aria-label', SCR[4]); await tick(); out.relabel = d.querySelector('button').getAttribute('aria-label');
      try { const cv = document.createElement('canvas'), cx = cv.getContext('2d'); const n0 = window.__kairouteLang.by.picture || 0; cx.fillText(SCR[1] + ' Station', 1, 10); cx.fillText('Kyoto Station', 1, 20); out.picture = (window.__kairouteLang.by.picture || 0) - n0 === 1 ? 'rewritten' : 'as it came'; } catch (e) { out.picture = 'error ' + e.message; }
      try { let said = null; const S = window.speechSynthesis; if (S && window.SpeechSynthesisUtterance) { const u = new SpeechSynthesisUtterance('Next stop ' + SCR[1]); u.lang = 'en-US'; u.volume = 0; S.speak(u); said = u.text; const u2 = new SpeechSynthesisUtterance(SCR[2]); u2.lang = 'el'; u2.volume = 0; S.speak(u2); out.phraseVoice = u2.text; S.cancel(); } out.voice = said; } catch (e) { out.voice = 'error ' + e.message; }
      try { const cb = navigator.clipboard; if (cb && cb.writeText && cb.readText) { await cb.writeText('Meet at ' + SCR[0] + ' Square'); out.copy = await cb.readText(); } else out.copy = null; } catch (e) { out.copy = null; out.copyErr = e.message; }
      d.remove(); return out; }, SCR).catch(e => ({ err: e.message }));
    log('5 ANY SOURCE text in another script written straight onto the page, a label, a picture, the voice and the clipboard');
    if (r.err) fail('5 any source', 'could not run: ' + r.err); else {
      const bad = [...r.page, ...r.attrs, r.changed, r.replaced, r.relabel].filter(t => OTHER.test(t));
      if (bad.length || r.page.length !== SCR.length * 2 || r.attrs.length !== SCR.length * 4) { fail('5 any source', `${bad.length} texts stayed in another script on the page or in a label`); show(bad); } else log(`ok   ${r.page.length + r.attrs.length + 3} texts and labels written onto the page all left in Latin letters ("${r.page[1]}", "${r.page[3]}")`);
      if (r.phrase !== SCR[2]) fail('5 any source', `the phrase card's local words were changed ("${r.phrase}")`); else log('ok   the phrase card keeps its local words');
      if (r.picture !== 'rewritten') fail('5 any source', 'a drawn picture kept its text in another script (' + r.picture + ')'); else log('ok   a drawn picture');
      if (r.voice == null) notTested.push('5 any source: this browser has no speech, the voice was not checked'); else if (OTHER.test(r.voice) || r.phraseVoice !== SCR[2]) fail('5 any source', `the voice: "${r.voice}", a phrase in its own language: "${r.phraseVoice}"`); else log(`ok   the voice ("${r.voice}"); a phrase spoken in its own language is left alone`);
      if (r.copy == null) notTested.push('5 any source: copied text could not be read back (' + (r.copyErr || 'no clipboard in this browser') + ')'); else if (OTHER.test(r.copy)) fail('5 any source', `copied text: "${r.copy}"`); else log(`ok   copied text ("${r.copy}")`); }
    await ctx.close(); }
  await browser.close(); srv.close();
  // A saved trip with no guide at all (the places the app can't plan) opens with its message and is read like any other;
  // anything that could not be opened or read is said, and is never a pass.
  [...new Set(notTested)].forEach(x => log('NOT TESTED ' + x));
  log(`Language on every screen: ${fails.length} failed, ${new Set(notTested).size} not tested`);
  process.exit(fails.length || notTested.length ? 1 : 0);
})();
