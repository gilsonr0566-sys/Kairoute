// Safety net for the guide extras (src/features/guide-extras.js). Runs offline against a stand-in for Kairoute's
// helper, so it checks the app's own logic: sun times against published almanac values, theme tours steering the
// stop choice, the Day plan extras (sun, viewpoints, know-how, primer, savings, theme), kids mode and badges,
// "Ask your guide" getting real restrooms, the storybook PDF, and group tours. Fails (exit 1) on any problem.
// Usage: node tools/extras-check.cjs [index.html] [screenshot-dir]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html')), SHOTS = process.argv[3] || '';
const W = 'https://mock-helper.example';
const fails = [], ok = m => console.log('  ok  ' + m), bad = m => { fails.push(m); console.log('  FAIL ' + m); };
const groups = new Map(); let gseq = 0;
function helper(url, body) {
  const u = new URL(url), p = u.pathname, q = u.searchParams;
  if (p === '/status') return { ok: true, left: 5000, budget: 8500 };
  if (p === '/x/near' && q.get('what') === 'view') return { spots: [{ name: 'Filopappou Hill viewpoint', lat: 37.9678, lng: 23.7196, wd: 'Q1' }, { name: 'Lycabettus summit', lat: 37.9819, lng: 23.7433 }] };
  if (p === '/x/near') return { places: [{ kind: 'toilets', name: 'Public toilets', lat: +q.get('lat') + 0.001, lng: +q.get('lng'), fee: 'no' }, { kind: 'drinking_water', name: '', lat: +q.get('lat'), lng: +q.get('lng') + 0.002 }] };
  if (p === '/x/knowhow') return { groups: { etiquette: [{ t: 'Cover shoulders and knees in churches and monasteries.', src: 'Greece' }], tipping: [{ t: 'Round up the bill in cafés.', src: 'Greece' }], prices: [], scams: [{ t: 'Watch for pickpockets on the metro to the Acropolis.', src: 'Athens' }] }, sources: [{ title: 'Athens', url: 'https://en.wikivoyage.org/wiki/Athens' }, { title: 'Greece', url: 'https://en.wikivoyage.org/wiki/Greece' }] };
  if (p === '/voyage') return { understand: 'Athens is the capital of Greece and one of the oldest cities in the world, with a recorded history of more than 3,000 years.' };
  if (p === '/x/write') { const b = JSON.parse(body); return b.kind === 'theme' ? (/paul|areopagus|corinth|agora/i.test(b.text) ? { text: 'Paul spoke here, the guide text says.' } : { none: true }) : b.kind === 'kids' ? { text: 'KIDS STORY for ' + b.name } : { text: 'PRIMER STORY of ' + b.name + '. '.repeat(20) }; }
  if (p === '/x/film') return { places: [] };
  if (p === '/x/group') {
    const b = body ? JSON.parse(body) : {}; const code = b.op === 'new' ? 'ABC' + (++gseq) + 'XY'.slice(0, 2 - String(gseq).length + 1) : (b.code || q.get('code'));
    if (b.op === 'new') { const c = ('ABCD' + gseq).slice(-6).padStart(6, 'K'); groups.set(c, { token: 'tok', rev: 1, tripRev: 1, trip: b.trip, live: b.live || null, regroup: null, name: b.name }); return { code: c, token: 'tok', rev: 1, now: Date.now() }; }
    const g = groups.get(code); if (!g) return { __status: 404, error: 'Unknown code' };
    if (!body) { const out = { rev: g.rev, live: g.live, regroup: g.regroup, name: g.name, now: Date.now(), followers: 1 }; if ((+q.get('since') || 0) < g.tripRev) { out.trip = g.trip; out.tripRev = g.tripRev; } return out; }
    if (b.op === 'hello') return { ok: true };
    if (b.token !== g.token) return { __status: 403, error: 'no' };
    if (b.op === 'live') { g.live = Object.assign({}, b.live, { at: Date.now() }); g.rev++; }
    if (b.op === 'regroup') { g.regroup = { where: b.where, lat: b.lat, lng: b.lng, note: b.note, at: Date.now(), id: String(Date.now()) }; g.rev++; }
    if (b.op === 'trip') { g.trip = b.trip; g.tripRev = g.rev + 1; g.rev++; }
    if (b.op === 'end') { groups.delete(code); return { ok: true }; }
    return { rev: g.rev, now: Date.now() };
  }
  return { __status: 404, error: 'nf' };
}
async function page(b, w, h) {
  const ctx = await b.newContext({ viewport: { width: w || 1280, height: h || 800 }, acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.errs = errs;
  await ctx.route('**/*', async r => {
    const url = r.request().url();
    if (/^file:/.test(url)) return r.continue();
    if (/cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf/.test(url)) { const local = process.env.JSPDF_FILE; return local && fs.existsSync(local) ? r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(local, 'utf8') }) : r.continue(); }
    if (/\/ai\.json$/.test(url)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: W }) });
    if (url.startsWith(W)) { const o = helper(url, r.request().postData()); const st = o.__status || 200; delete o.__status; return r.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(o), headers: { 'access-control-allow-origin': '*' } }); }
    if (/overpass/.test(url)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: [{ type: 'node', lat: 37.97, lon: 23.72, tags: { tourism: 'viewpoint', name: 'Direct viewpoint' } }] }), headers: { 'access-control-allow-origin': '*' } });
    if (/open-meteo/.test(url)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ timezone: /longitude=2\./.test(url) ? 'Europe/Madrid' : /longitude=-/.test(url) ? 'America/Chicago' : 'Europe/Athens' }), headers: { 'access-control-allow-origin': '*' } });
    return r.abort();
  });
  await p.goto('file://' + FILE); await p.waitForTimeout(1200);
  return p;
}
const shot = async (p, n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, n + '.png') }); } };
(async () => {
  const b = await chromium.launch(); const p = await page(b);
  console.log('Sun times (almanac values, local time)');
  const sun = await p.evaluate(() => { const X = window.__kairouteExtras; const f = (iso, la, ln, tz) => { const s = X.gxSun(iso, la, ln); return { rise: X.gxLocalMin(s.sunrise, tz), set: X.gxLocalMin(s.sunset, tz) }; };
    return { athens: f('2027-07-01', 37.9715, 23.7257, 'Europe/Athens'), cc: f('2026-12-21', 27.8006, -97.3964, 'America/Chicago'), bcn: f('2027-03-20', 41.3874, 2.1686, 'Europe/Madrid') }; });
  // Reference values from the independent astral library (Python): Athens 1 Jul 06:06 / 20:51;
  // Corpus Christi 21 Dec 07:16 / 17:39; Barcelona 20 Mar 06:55 / 19:02 (before daylight saving starts).
  const near = (got, want, what) => Math.abs(got - want) <= 3 ? ok(`${what}: ${Math.floor(got / 60)}:${String(got % 60).padStart(2, '0')}`) : bad(`${what}: got ${got}, expected about ${want}`);
  near(sun.athens.rise, 6 * 60 + 6, 'Athens sunrise, 1 July'); near(sun.athens.set, 20 * 60 + 51, 'Athens sunset, 1 July');
  near(sun.cc.rise, 7 * 60 + 16, 'Corpus Christi sunrise, 21 December'); near(sun.cc.set, 17 * 60 + 39, 'Corpus Christi sunset, 21 December');
  near(sun.bcn.rise, 6 * 60 + 55, 'Barcelona sunrise, 20 March'); near(sun.bcn.set, 19 * 60 + 2, 'Barcelona sunset, 20 March');

  console.log('Theme tours');
  const th = await p.evaluate(() => { const X = window.__kairouteExtras; const before = X.interestWords().length; window.__kairouteSetPrefs({ theme: 'paul' }); const w = X.interestWords(); const r = { before, after: w.length, paul: w.filter(x => x === 'paul').length, name: X.themeOf()[1] }; window.__kairouteSetPrefs({ theme: '' }); return r; });
  th.paul >= 3 && th.name === 'Footsteps of Paul' ? ok(`theme words weigh 3x in stop choice (${th.before} -> ${th.after} words)`) : bad('theme words not applied: ' + JSON.stringify(th));
  const picks = await p.evaluate(() => window.__kairouteThemePicks('barcelona', 'royal'));
  picks.withTheme !== picks.without ? ok('a theme changes which stops are suggested (' + picks.withTheme + ')') : bad('theme did not change the suggested stops: ' + JSON.stringify(picks));

  console.log('Day plan extras');
  await p.evaluate(() => window.__kairouteGo('plan', 1)); await p.waitForTimeout(1500);
  await p.evaluate(() => document.querySelectorAll('details[data-gx-fold]').forEach(d => d.open = true)); await p.waitForTimeout(200);
  const plan = await p.evaluate(() => { const t = s => (document.querySelector(`[data-gx-fold="${s}"]`) || {}).innerText || ''; return { light: t('light'), know: t('know'), primer: t('primer'), save: t('save') }; });
  /Sunset\s*20:5\d/i.test(plan.light) ? ok('golden hour card shows Athens sunset') : bad('golden hour card: ' + plan.light.slice(0, 200));
  /Filopappou/.test(plan.light) ? ok('real viewpoints listed near the route') : bad('viewpoints missing: ' + plan.light.slice(0, 300));
  /Cover shoulders/.test(plan.know) && /Wikivoyage/.test(plan.know) ? ok('local know-how shown with its Wikivoyage source') : bad('know-how: ' + plan.know.slice(0, 200));
  await p.evaluate(() => { const el = document.querySelector('[data-gx-fold="light"]'); if (el) el.scrollIntoView(); }); await p.waitForTimeout(200);
  await shot(p, 'extras-day-plan');
  await p.evaluate(() => window.__kairouteGo('plan', 0)); await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelectorAll('details[data-gx-fold]').forEach(d => d.open = true)); await p.waitForTimeout(200);
  const pr = await p.evaluate(() => (document.querySelector('[data-gx-fold="primer"]') || {}).innerText || '');
  /PRIMER STORY of Athens/.test(pr) ? ok('before-you-arrive story on the first Athens day') : bad('primer: ' + pr.slice(0, 200));
  await p.evaluate(() => window.__kairouteGo('plan', 1)); await p.waitForTimeout(600);
  (await p.$('[data-gx-fold="primer"]')) ? bad('primer repeats on the second Athens day') : ok('primer only on the first day in a city');

  console.log("Ship's tour savings");
  const port = await p.evaluate(() => window.__kairouteDays().findIndex(d => d.type === 'port' && d.city));
  if (port < 0) bad('no built port day in the sample trip'); else {
    await p.evaluate(i => window.__kairouteGo('plan', i), port); await p.waitForTimeout(800);
    await p.evaluate(() => { document.querySelector('[data-gx-fold="save"]').open = true; }); 
    await p.fill('[data-gx-price] input[type=number]', '189'); await p.click('[data-gx-price] button[type=submit]'); await p.waitForTimeout(500);
    const sv = await p.evaluate(i => { const X = window.__kairouteExtras; return { txt: (document.querySelector('[data-gx-fold="save"]') || {}).innerText || '', calc: window.__kairouteSavings(i) }; }, port);
    sv.calc && sv.calc.ship === 189 * sv.calc.party && sv.calc.save === sv.calc.ship - sv.calc.own && sv.txt.includes(String(sv.calc.ship)) ? ok(`savings: ship ${sv.calc.ship} vs Kairoute ${sv.calc.own} for ${sv.calc.party}`) : bad('savings: ' + JSON.stringify(sv).slice(0, 300));
    await shot(p, 'extras-savings');
  }

  console.log('Kids mode and badges');
  await p.evaluate(() => { window.__kairouteSetPrefs({ kids: 'on' }); window.__kairouteGo('guide', 1); }); await p.waitForTimeout(1200);
  const kids = await p.evaluate(() => (document.querySelector('.gxkidsbox') || {}).innerText || '');
  /KIDS STORY/.test(kids) && /badge/i.test(kids) ? ok("kids' story and treasure hunt on the stop") : bad('kids block: ' + kids.slice(0, 200));
  const badge = await p.evaluate(async () => { window.__kairouteGo('plan', 1); document.querySelector('[data-act="tourstart"]').click(); await new Promise(r => setTimeout(r, 200));
    const T = window.__kairouteTour(); for (let i = 0; i < 30; i++) { T.i = i; T.phase = 'at'; const st = window.__kairouteTourStep(); if (!st) break; if (st.type === 'stop' && st.n && !st.parts) break; }
    window.__kairouteGo('tour', 1); await new Promise(r => setTimeout(r, 300));
    const finds = [...document.querySelectorAll('[data-find]')].map(f => f.dataset.find); for (const k of finds) { document.querySelector(`[data-find="${k}"]`).click(); await new Promise(r => setTimeout(r, 80)); }
    await new Promise(r => setTimeout(r, 300)); return { finds: finds.length, badges: window.__kairouteBadges().length, banner: !!document.querySelector('.gxkidsbox .banner.ok') }; });
  badge.finds && badge.badges >= 1 && badge.banner ? ok(`finding all ${badge.finds} things earns the badge`) : bad('badge: ' + JSON.stringify(badge));
  await shot(p, 'extras-kids-tour');
  await p.evaluate(() => { window.__kairouteGo('journal'); }); await p.waitForTimeout(400);
  { const sh = await p.evaluate(() => ({ v: window.__kairouteView(), txt: (document.querySelector('.gxbadges') || {}).innerText || '', n: window.__kairouteBadges().length, has: /Explorer badges/i.test(document.body.innerText) })); sh.has && /explorer/.test(sh.txt) ? ok('badge shelf in the journal') : bad('badge shelf missing: ' + JSON.stringify(sh)); }
  await p.evaluate(() => { window.__kairouteSetPrefs({ kids: 'off' }); });

  console.log('Ask your guide: real places');
  const amen = await p.evaluate(async () => { window.__kairouteGo('plan', 1); return await window.__kairouteExtras.askExtra(null, null, 'Where is the nearest restroom?'); });
  /Public toilets/.test(amen) && /only mention these/.test(amen) ? ok('restroom question gets real map places') : bad('ask extra: ' + amen);
  const none = await p.evaluate(async () => window.__kairouteExtras.askExtra(null, null, 'Who built this temple?'));
  none === '' ? ok('history questions are not sent to the map') : bad('non-practical question fetched map data');

  const direct = await p.evaluate(async () => window.__kairouteExtras.gxNearDirect('view', '37.970', '23.720'));
  direct && direct.spots && direct.spots[0].name === 'Direct viewpoint' ? ok('when the helper is busy, the device asks OpenStreetMap itself') : bad('direct map fallback: ' + JSON.stringify(direct));

  console.log('Trip storybook');
  await p.evaluate(() => window.__kairouteGo('journal')); await p.waitForTimeout(300);
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 90000 }).catch(() => null), p.click('[data-gx-book]')]);
  if (!dl) bad('storybook PDF was not made'); else { const f = await dl.path(); const buf = fs.readFileSync(f); buf.slice(0, 5).toString() === '%PDF-' && buf.length > 20000 ? ok(`storybook PDF made (${Math.round(buf.length / 1024)} KB, ${(buf.toString('latin1').match(/\/Type \/Page\b/g) || []).length} pages)`) : bad('storybook PDF looks wrong: ' + buf.length + ' bytes'); }

  console.log('Group tour');
  const g = await p.evaluate(async () => { const r = await window.__kairouteGroup.lead(); return r; });
  if (!g || !g.code) bad('could not start a group: ' + JSON.stringify(g)); else {
    ok('leader started group ' + g.code);
    const p2 = await page(b, 412, 860);
    const joined = await p2.evaluate(async c => window.__kairouteGroup.join(c), g.code);
    joined && joined.ok ? ok('follower joined and received the trip') : bad('join failed: ' + JSON.stringify(joined));
    await p.evaluate(async () => { window.__kairouteGo('tour', 1); const T = window.__kairouteTour(); T.i = 2; T.phase = 'at'; await window.__kairouteGroup.push(); });
    await p2.evaluate(async () => window.__kairouteGroup.poll()); await p2.waitForTimeout(300);
    const f = await p2.evaluate(() => ({ view: window.__kairouteView(), i: (window.__kairouteTour() || {}).i }));
    f.view === 'tour' && f.i === 2 ? ok('follower moves to the leader\'s step') : bad('follower did not follow: ' + JSON.stringify(f));
    await p.evaluate(async () => window.__kairouteGroup.regroup('the main fountain', 'In 10 minutes'));
    await p2.evaluate(async () => window.__kairouteGroup.poll()); await p2.waitForTimeout(300);
    (await p2.evaluate(() => /Regroup/.test(document.body.innerText) && /main fountain/.test(document.body.innerText))) ? ok('regroup call reaches the follower') : bad('regroup banner missing');
    await shot(p2, 'extras-group-follower');
    const off = await p2.evaluate(async () => window.__kairouteGroup.offlineNote(40000));
    /signal/i.test(off) ? ok('weak signal: follower is told and keeps touring on their own phone') : bad('no weak-signal note: ' + off);
    if (p2.errs.length) bad('follower page errors: ' + p2.errs.join(' | '));
  }
  if (p.errs.length) bad('page errors: ' + p.errs.join(' | '));
  await b.close();
  if (fails.length) { console.log(`\n${fails.length} extras check(s) failed.`); process.exit(1); }
  console.log('\nAll guide-extras checks passed.');
})().catch(e => { console.error(e); process.exit(1); });
