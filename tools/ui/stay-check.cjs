// R-38 screen check: "Where you're staying" finds the traveler's hotel or rental by its NAME or its STREET ADDRESS,
// typed any way a booking shows it, and the Trip screen says what was found and how sure; else it says plainly that
// nothing was found and the plan never uses a guessed place. Offline, no AI: the map search (/findplace) is answered by
// the test with the kinds of answers the real one gives (a house with no name, a street, a hotel, a neighbour's door).
// Every city day of the sample trip's first stay is used; each case is typed and Find it tapped, as a traveler does.
// Also plants the bugs this rule exists for (window.__kairoutePlant) and fails if any one goes unnoticed.
// Usage: node tools/ui/stay-check.cjs [beta2-site/index.html]   SHOT=<prefix> saves screenshots.
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'beta2-site/index.html'), SHOT = process.env.SHOT;
const serve = f => new Promise(res => { const dir = path.dirname(f); const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/ai.json') { r.writeHead(200, { 'content-type': 'application/json' }); return r.end('{"url":"https://kairoute-ai.rickgilson.workers.dev"}'); }
  const p = path.join(dir, u === '/' ? path.basename(f) : u); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'text/plain' }); fs.createReadStream(p).pipe(r); });
  s.listen(0, () => res({ url: 'http://localhost:' + s.address().port + '/', close: () => s.close() })); });
// Each case: what the traveler types, what the map search answers (offsets from the city's centre), and what the screen
// must then say: found by name (place), at the door (door), on a short street only (street), or not found (none).
const C = (dlat, dlng, x) => Object.assign({ lat: dlat, lng: dlng }, x);
const CASES = [
  { q: 'Rua Augusta 100', map: [C(0.002, 0.001, { name: '', kind: 'house', cat: 'building', road: 'Rua Augusta', house: '100', addr: 'Rua Augusta 100, Baixa', spanM: 20 })], want: 'door', shows: /Rua Augusta 100/ },
  { q: 'Mariahilfer Straße 47/12', map: [C(0.003, -0.002, { name: '', kind: 'apartments', cat: 'building', road: 'Mariahilfer Straße', house: '47', addr: 'Mariahilfer Straße 47, Mariahilf', spanM: 30 })], want: 'door', shows: /Mariahilfer Stra(ß|ss)e 47/ },
  { q: 'Rua dos Remédios 70, 2º Esq', map: [C(0.001, 0.004, { name: '', kind: 'house', cat: 'place', road: 'Rua dos Remédios', house: '70', addr: 'Rua dos Remédios 70, Alfama', spanM: 15 })], want: 'door', shows: /Rem(é|e)dios 70/ },
  { q: 'Apartment 4, Neubaugasse 25', map: [C(-0.002, 0.001, { name: '', kind: 'house', cat: 'building', road: 'Neubaugasse', house: '25', addr: 'Neubaugasse 25, Neubau', spanM: 18 })], want: 'door', shows: /Neubaugasse 25/ },
  { q: 'Rua Agusta 100', map: [C(0.002, 0.001, { name: '', kind: 'house', cat: 'building', road: 'Rua Augusta', house: '100', addr: 'Rua Augusta 100, Baixa', spanM: 20, src: 'photon' })], want: 'door', shows: /Rua Augusta 100/ },
  { q: 'Grand Test Hotel', map: [C(0.004, 0.003, { name: 'Grand Test Hotel', kind: 'hotel', cat: 'tourism', road: 'Main Street', house: '5', addr: 'Main Street 5', spanM: 40 })], want: 'place', shows: /Grand Test Hotel/ },
  // A name in the local script: shown in the traveler's language (R-11), never in the script typed.
  { q: 'Ξενοδοχείο Δοκιμή', map: [C(0.001, 0.001, { name: 'Ξενοδοχείο Δοκιμή', names: ['Ξενοδοχείο Δοκιμή'], kind: 'hotel', cat: 'tourism', road: '', house: '', addr: '', spanM: 30 })], want: 'place', latin: true },
  // Only the street: a short one is used and said to be the street; a long one is not used.
  { q: 'Kurze Gasse 9', map: [C(0.002, 0.002, { name: 'Kurze Gasse', kind: 'residential', cat: 'highway', road: 'Kurze Gasse', house: '', addr: 'Kurze Gasse, Altstadt', spanM: 300 })], want: 'street', shows: /street.*not number 9/i },
  { q: 'Long Avenue 1200', map: [C(0.02, 0.02, { name: 'Long Avenue', kind: 'primary', cat: 'highway', road: 'Long Avenue', house: '', addr: 'Long Avenue', spanM: 6500 })], want: 'none' },
  // The map answers a neighbour's door, or some other hotel: never taken for the traveler's.
  { q: 'Rua Augusta 100', alt: 'neighbour', map: [C(0.002, 0.001, { name: '', kind: 'house', cat: 'building', road: 'Rua Augusta', house: '12', addr: 'Rua Augusta 12, Baixa', spanM: 20 })], want: 'none' },
  { q: 'Hotel Imaginary Palace', map: [C(0.004, 0.003, { name: 'Hotel Real Other', kind: 'hotel', cat: 'tourism', road: 'Side Street', house: '3', addr: 'Side Street 3', spanM: 40 })], want: 'none' },
  { q: 'Qwzxv Street 9999', map: [], want: 'none' },
  // The search can't be reached: said as not answered, never as "couldn't find" (press-every-button thread, Nov 28).
  { q: 'Rua Augusta 100', alt: 'search down', down: true, map: [], want: 'none', says: /didn.t answer/, notSays: /couldn.t find|not found/i, page: true },
  // Nothing typed: the box says what to type, never nothing at all.
  { q: '', alt: 'empty box', map: [], want: 'none', says: /Type your hotel/, focus: true },
];
const PLANTS = { 'stay-down-as-none': 'a search not answered is said as not found', 'stay-empty-silent': 'Find it with an empty box says nothing', 'stay-name-only': 'an address is never found (the bug of Nov 27)', 'stay-any-hotel': 'the first hotel the map lists is taken', 'stay-long-street': 'a long street is used as the door', 'stay-wrong-door': "a neighbour's door is taken", 'stay-down-label': 'the trip\'s still-needed list says a search not answered was not found', 'stay-empty-nofocus': 'Find it with an empty box leaves the cursor out of the box' };
(async () => {
  const s = await serve(FILE); const b = await chromium.launch(), fails = [], caught = {};
  let answer = [];
  const run = async (plant, size) => {
    const ctx = await b.newContext(size === 'tablet' ? { viewport: { width: 1280, height: 800 }, hasTouch: true, deviceScaleFactor: SHOT ? 2 : 1 } : { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: SHOT ? 2 : 1 });
    await ctx.addInitScript(pl => { try { localStorage.setItem('kairoute.intro1', '1'); if (pl) window.__kairoutePlant = pl; } catch (e) {} }, plant);
    await ctx.route(u => !/^http:\/\/localhost/.test(String(u)), r => { const u = new URL(r.request().url()), H = { 'access-control-allow-origin': '*' };
      if (/workers\.dev/.test(u.hostname) && u.pathname === '/status') return r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: '{"ok":true,"on":false}' });
      if (/workers\.dev/.test(u.hostname) && u.pathname === '/findplace' && answer === 'DOWN') return r.fulfill({ status: 503, headers: H, body: '' });
      if (/workers\.dev/.test(u.hostname) && u.pathname === '/findplace') return r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify({ places: answer }) });
      return r.fulfill({ status: 503, body: '' }); });
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.goto(s.url); await p.waitForTimeout(2500);
    const sample = p.locator('[data-act="loadsample"]').first(); if (await sample.isVisible().catch(() => false)) await sample.click();
    await p.waitForTimeout(4000);
    for (let k = 0; k < 5; k++) { const sk = p.locator('.coach button:has-text("Skip")').first(); if (await sk.isVisible().catch(() => false)) await sk.click(); else break; }
    const day = await p.evaluate(() => window.__kairouteState().days.findIndex(d => d.type === 'land'));
    if (day < 0) { fails.push('the sample trip has no city day'); await ctx.close(); return; }
    const centre = await p.evaluate(i => { const c = window.__kairouteCityOf(i), x = (c.starts && c.starts.point && c.starts.point[0]) || c.sites[0]; return { lat: +x.lat, lng: +x.lng }; }, day);
    const cases = plant ? CASES : CASES.filter((c, k) => size === 'phone' || k % 3 === 0);
    for (const c of cases) {
      answer = c.down ? 'DOWN' : c.map.map((m, k) => Object.assign({ osm: 'N' + k, names: m.name ? [m.name] : [] }, m, { lat: centre.lat + m.lat, lng: centre.lng + m.lng }));
      await p.evaluate(i => window.__kairouteAt(i, 'trip'), day); await p.waitForTimeout(600);
      await p.selectOption('#f-lodging', 'custom'); await p.waitForTimeout(400);
      await p.fill('#f-lname', c.q); await p.locator('[data-act="geo"]').scrollIntoViewIfNeeded(); await p.locator('[data-act="geo"]').tap();
      await p.waitForTimeout(1200);
      const st = await p.evaluate(i => { const h = document.querySelector('[data-stay]'), f = document.getElementById('f-lname'), st = window.__kairouteState();
        const L = (window.__kairouteTripLodging ? window.__kairouteTripLodging(i) : null); return { how: h ? h.dataset.stay : 'missing', hint: h ? h.innerText : '', err: st.err || '', typed: f ? f.value : '', L, page: document.body.innerText, focus: document.activeElement ? document.activeElement.id : '' }; }, day);
      const said = st.hint + ' ' + st.err + (c.page ? ' ' + st.page : ''), label = `${plant || 'app'} ${size} "${c.q}"${c.alt ? ' (' + c.alt + ')' : ''}`;
      const bad = [];
      if (st.how !== c.want) bad.push(`found as "${st.how}", should be "${c.want}"`);
      if (c.shows && !c.shows.test(said)) bad.push('the screen does not say ' + c.shows);
      if (c.want === "none" && !c.says && !/couldn.t find .* on the map/i.test(st.hint)) bad.push('nothing found, and the screen does not say so plainly');
      if (c.says && !c.says.test(st.hint)) bad.push('the screen beside the box does not say ' + c.says + ': "' + st.hint + '"');
      if (c.notSays && c.notSays.test(said)) bad.push('the screen says ' + c.notSays + ' when the search was not answered');
      if (c.focus && st.focus !== 'f-lname') bad.push('Find it with an empty box does not put the cursor in the box (focus on "' + st.focus + '")');
      if (c.want === 'none' && st.L && st.L.ll) bad.push('nothing found, yet a place is kept for the plan: ' + JSON.stringify(st.L));
      if (/[Ͱ-ϿЀ-ӿ぀-ヿ一-鿿]/.test(st.hint)) bad.push('the screen shows a name in another script (R-11): ' + st.hint);
      if (st.typed !== c.q) bad.push(`the box no longer shows what was typed ("${st.typed}")`);
      if (SHOT && !plant && /Augusta 100|Kurze|Qwzxv/.test(c.q) && !c.alt) { await p.locator('[data-stay]').scrollIntoViewIfNeeded().catch(() => {}); await p.screenshot({ path: `${SHOT}-${size}-${c.q.replace(/\W+/g, '_')}.png` }); }
      if (bad.length) { if (plant) caught[plant] = (caught[plant] || []).concat(label + ': ' + bad[0]); else fails.push(label + ': ' + bad.join('; ') + ' | screen: ' + said.replace(/\s+/g, ' ').slice(0, 200)); }
      else if (!plant) console.log('ok  ' + label + ' -> ' + st.how + ' | ' + said.replace(/\s+/g, ' ').trim().slice(0, 140));
      // The planner starts the day at the place found (or, with none, at the area, marked as not placed).
      if (!plant && c.want !== 'none') { const at = await p.evaluate(i => window.__kairouteStayAt ? window.__kairouteStayAt(i) : null, day);
        if (!at || Math.abs(at.lat - answer[0].lat) > 1e-4 || Math.abs(at.lng - answer[0].lng) > 1e-4) fails.push(label + ': the day plan does not start at the place found: ' + JSON.stringify(at)); }
    }
    if (errs.length) fails.push(`${plant || 'app'} ${size}: page errors: ${errs.slice(0, 3).join(' | ')}`);
    await ctx.close();
  };
  await run('', 'phone'); await run('', 'tablet');
  for (const pl of Object.keys(PLANTS)) await run(pl, 'phone');
  for (const [pl, what] of Object.entries(PLANTS)) { if (caught[pl]) console.log(`planted "${what}": caught (${caught[pl].length}) e.g. ${caught[pl][0]}`); else fails.push(`planted bug "${what}" (${pl}) was NOT caught`); }
  await b.close(); s.close();
  if (fails.length) { console.log('STAY CHECK FAILED (R-38)\n- ' + fails.join('\n- ')); process.exit(1); }
  console.log('STAY CHECK OK (R-38): hotel names and addresses found or said plainly not found, phone and tablet; ' + Object.keys(PLANTS).length + ' planted bugs caught');
})();
