// Saved content passes today's rules every time it is opened (rule R-30, Nov 24). Class: content made and saved before a
// rule existed (a guide the AI wrote before AI was turned off, guides copied over from the first app, day trips the AI
// filled in) reached the screen past every check made since.
// The check plants an AI-era device: the first app's saved guides (the shape it saved before AI was turned off) for
// two cities of the example trip, one checked on the map and one never checked, then opens the built Beta 2 app, which
// copies them in as it does for a real traveler. Every screen of those days is read (Choose sights, Day plan, the
// guide, the city basics), hidden folds included. Fails on any AI-written fact with no source on screen (hours,
// tickets, crowds, prices, access, emergency numbers, a restaurant's AI style or price band), any place from the
// never-checked guide, a place to eat not on the map, an AI story without "not confirmed" beside it, or AI travel
// words shown as a checked fact.
// Proof it fires: the same run on a copy of the build with the re-check switched off must fail (planted every run).
// Offline, no AI. Usage: node tools/ui/saved-recheck.cjs [beta2-site/index.html]
'use strict';
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs'); const os = require('os');
const FILE = path.resolve(process.argv[2] || 'beta2-site/index.html');
const serve = dir => new Promise(res => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(dir, u === '/' ? 'index.html' : u);
  if (u === '/ai.json') { r.writeHead(200, { 'content-type': 'application/json' }); return r.end('{"url":"https://helper.workers.dev"}'); }
  fs.readFile(p, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': /\.html$/.test(p) ? 'text/html' : 'application/octet-stream' }); r.end(b); }); });
  s.listen(0, () => res({ url: 'http://localhost:' + s.address().port + '/', close: () => s.close() })); });
// What the first app saved for a city it had the AI write (normSite/cleanCity shape, before AI was turned off).
const site = (id, name, lat, lng, extra) => Object.assign({ id, name, lat, lng, minutes: 60, kind: 'touristy', mustSee: true, quick: false, far: false, category: 'Museum',
  summary: 'PLANTSTORY This is where the story of the old city and its people begins.', guide: 'PLANTSTORY You are standing where the people of the city met, traded and argued for many centuries.', lookFor: ['PLANTSTORY detail'], photoTip: 'PLANTSTORY photo spot', picks: [],
  travel: '', hours: '09:00-17:00 PLANTHOURS', closed: 'PLANTCLOSED on Tuesdays', tickets: 'PLANTTICKETS adults 20', crowds: 'PLANTCROWDS at noon', cost: 37, indoor: true,
  access: 'PLANTACCESS step-free', travelerTip: 'PLANTSTORY tip', priceNote: 'PLANTPRICENOTE', web: '', sources: ['Wikipedia'] }, extra || {});
const aiCity = (city, grounded, sites, farther) => ({ city, country: 'Greece', ai: true, verified: 2, grounded, gv: 'v9', eatsV: 1, farFillV: 2, startsOk: 1, starts: {}, sites, farther,
  basics: { currency: 'EUR', symbol: '€', prices: 'EUR', language: 'Greek', langCode: 'el', tipping: 'PLANTTIPPING', safety: 'PLANTSAFETY', emergency: 'PLANTSOS 999', plugs: 'PLANTPLUGS', water: 'PLANTWATER', phrases: [{ local: 'PLANTPHRASE', say: 'x', meaning: 'y', lang: 'el' }] },
  lang: 'English', gettingAround: [{ mode: 'Metro', tip: 'PLANTGETAROUND' }],
  restaurants: [{ onMap: true, name: 'Taverna Mapped', lat: 37.9716, lng: 23.7262, kind: 'local', cuisine: 'Greek', price: '$$$', style: 'PLANTSTYLE', top: true, why: '', hours: '' },
    { onMap: false, name: 'PLANTNOTMAP Taverna', lat: 37.9726, lng: 23.7272, kind: 'local', cuisine: 'Greek', price: '$$', style: 'classic', why: '', hours: '' }] });
const SAVED = {
  athens: aiCity('Athens', true, [site('acropolis', 'Acropolis of Athens', 37.9715, 23.7257), site('agora', 'Ancient Agora of Athens', 37.9747, 23.7224), site('benaki', 'Benaki Museum', 37.9758, 23.7402)],
    [site('aegina-far', 'Aegina', 37.7467, 23.4285, { far: true, category: 'Island', travel: 'Fast ferry from Piraeus PLANTTRAVEL 40 min' }),
     site('sounion-far', 'Temple of Poseidon at Sounion', 37.6502, 24.0245, { far: true, famousFix: true, wd: 'Q1426190', fame: 60, travel: 'Bus PLANTTRAVEL 90 min', src: ['Wikidata (Wikipedia in many languages)'] })]),
  'heraklion crete': aiCity('Heraklion', false, [site('h1', 'PLANTUNCHECKED Palace', 35.2980, 25.1630), site('h2', 'PLANTUNCHECKED Museum', 35.3390, 25.1370)], [])
};
// Words that must never reach the screen, and words that may only with their "not confirmed" mark.
const NEVER = ['PLANTHOURS', 'PLANTCLOSED', 'PLANTTICKETS', 'PLANTCROWDS', 'PLANTACCESS', 'PLANTPRICENOTE', 'PLANTTIPPING', 'PLANTSAFETY', 'PLANTSOS', 'PLANTPLUGS', 'PLANTWATER', 'PLANTPHRASE', 'PLANTGETAROUND', 'PLANTSTYLE', 'PLANTNOTMAP', 'PLANTUNCHECKED', '€37', '€ 37', '$$$'];
async function run(b, url) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(saved => { try { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('kairoute.intro1', '1'); localStorage.setItem('wayside.cities', JSON.stringify(saved));
    const k = 'b2:kairoute.app', v = JSON.parse(localStorage.getItem(k) || '{}'); v.backAck = '2026-11-20'; localStorage.setItem(k, JSON.stringify(v)); } } catch (e) {} }, SAVED);
  await ctx.route(u => !/^http:\/\/localhost/.test(String(u)), r => { const u = new URL(r.request().url());
    if (u.pathname === '/status') return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true,"on":false}' });
    return r.fulfill({ status: 503, body: '' }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(url); await p.waitForTimeout(2500);
  const found = [], screens = [];
  // The example trip: day 1 Athens (a land day), day 5 Heraklion. Every screen of each, every fold opened.
  // Opened twice: the second open reads what the first one saved, so a re-check that harms checked writing shows up.
  for (const pass of [1, 2]) { if (pass === 2) { await p.reload(); await p.waitForTimeout(2500); }
  for (const [i, where] of [[1, 'Athens'], [5, 'Heraklion']]) for (const v of ['sites', 'plan', 'guide', 'trip']) {
    await p.evaluate(([i, v]) => { window.__kairouteGo(v, i); }, [i, v]); await p.waitForTimeout(900);
    await p.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
    const text = await p.evaluate(() => (document.getElementById('view') || document.body).textContent.replace(/\s+/g, ' '));
    screens.push(where + ' ' + v + (pass === 2 ? ' (opened again)' : ''));
    for (const w of NEVER) if (text.includes(w)) found.push(`${where} ${v}: "${w}" on screen: ${text.slice(Math.max(0, text.indexOf(w) - 80), text.indexOf(w) + 60)}`);
    // An AI story only with its mark; AI travel words only with "not confirmed" in front.
    for (const [w, n] of [['PLANTSTORY', 60], ['PLANTTRAVEL', 140]]) for (const m of text.matchAll(new RegExp(w, 'g'))) { const before = text.slice(Math.max(0, m.index - n), m.index); if (!/not confirmed/i.test(before)) found.push(`${where} ${v}: AI-written words shown with no "not confirmed" mark: ${before.slice(-90)}${w}`); }
    if (/Not confirmed[^.]{0,60}The rock of Athens/.test(text)) found.push(`${where} ${v} (open ${pass}): the built-in guide's checked writing is marked as the AI's`);
    if (v === 'sites' && where === 'Athens' && !text.includes('Benaki Museum')) found.push('Athens sites: the checked AI guide\'s real places are gone (the re-check must keep real places)');
  }
  }
  if (errs.length) found.push('page errors: ' + errs.join(' | ').slice(0, 300));
  await ctx.close(); return { found, screens };
}
(async () => {
  const b = await chromium.launch();
  // The real build.
  const s1 = await serve(path.dirname(FILE)); const real = await run(b, s1.url); s1.close();
  // The planted miss: the same build with the re-check switched off must be caught.
  const src = fs.readFileSync(FILE, 'utf8'), from = 'function recheckSaved(city) {', at = src.indexOf(from);
  let planted = null;
  if (at < 0) planted = { found: [] }; else { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'kr-recheck-')); fs.writeFileSync(path.join(d, 'index.html'), src.slice(0, at + from.length) + ' return city; ' + src.slice(at + from.length));
    const s2 = await serve(d); planted = await run(b, s2.url); s2.close(); }
  await b.close();
  console.log(`screens read: ${real.screens.join(', ')}`);
  const blind = !planted.found.length;
  console.log(blind ? 'FAIL the check is blind: with the re-check switched off it found nothing' : `ok   planted: with the re-check switched off it finds ${planted.found.length} problems (e.g. ${planted.found[0].slice(0, 120)})`);
  real.found.forEach(f => console.log('FAIL ' + f));
  if (!real.found.length) console.log('ok   0 unchecked saved items reach the screen');
  const fail = blind || real.found.length; console.log(`saved-recheck: ${fail ? 'FAIL' : 'PASS'}`); process.exit(fail ? 1 : 0);
})();
