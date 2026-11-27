// Day trips, live (rule R-37): for real cities, what the built app offers as classic day trips from the helper's real
// answers (free sources only, AI off): the candidates it ranked, the way it found to each, and whether the day trips a
// visitor expects are there. Runs on GitHub (the container can't reach the helper or the sources). Prints; changes nothing.
// Usage: HELPER=http://localhost:8790/workers.dev node tools/beta2/day-trips-live.cjs beta2-site/index.html
//   HELPER unset = the live helper (ai.json). ONLY=regex limits the cities. Exit 1 when an expected day trip is missing.
const { chromium } = require('playwright'), path = require('path'), fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'beta2-site/index.html');
const H = (process.env.HELPER || JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'ai.json'))).url).replace(/\/$/, '');
const CITIES = JSON.parse(fs.readFileSync(path.join(__dirname, 'day-trips-expect.json'))).cities.filter(c => !process.env.ONLY || new RegExp(process.env.ONLY, 'i').test(c.city))
  .filter((c, i) => !(+process.env.PARTS > 1) || i % +process.env.PARTS === +process.env.PART);   // PART of PARTS: every n-th city, so a run splits over jobs
(async () => {
  // The page is a file, so the live helper sees origin "null" and its CORS rule refuses it (every ask a TypeError): the test
  // browser alone skips that rule for the live helper; the app's own page on its own site is let in by the helper as usual.
  const b = await chromium.launch(process.env.HELPER ? {} : { args: ['--disable-web-security'] }); let bad = 0, open = 0; const lines = [];
  const one = async c => {
    const p = await b.newPage(), log = []; p.on('console', m => { if (/Kairoute added/.test(m.text())) log.push(m.text()); });
    await p.goto('file://' + FILE); await p.waitForTimeout(800);
    await p.evaluate(h => window.__kairouteMockHelper(h, null, true), H);
    const t0 = Date.now();
    const r = await p.evaluate(async ({ h, city, want }) => {
      let src = null, code = 0;
      for (let t = 0; t < 5 && !src; t++) { try { const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 60000); const q = await fetch(h + '/sources?city=' + encodeURIComponent(city), { signal: ac.signal }); clearTimeout(tm); code = q.status; if (q.ok) { const j = await q.json(); if (j && Array.isArray(j.stops)) src = j; } } catch (e) { code = String(e.name || e); } if (!src) await new Promise(z => setTimeout(z, 4000)); }
      if (!src) return { err: 'no sources (' + code + ')' };
      const g = { city, country: '', sites: [], farther: [], starts: {}, restaurants: [] };
      window.__kairouteSourceSights(g, src);
      const cands = window.__kairouteTripCands(g, src);
      let n = 0; for (let t = 0; t < 3; t++) { n += await window.__kairouteClassicTrips(g, src); if (!g.tripsOpen) break; await new Promise(z => setTimeout(z, 125000)); }
      return { log: window.__kairouteTripLog(g), why: (want || []).map(w => ({ w, got: window.__kairouteTripWhy(g, src, w) })), centre: src.center || null, far: (src.far || []).length, voy: (src.far || []).filter(x => x.voy).length, said: (src.far || []).filter(x => x.said > 0 || x.part).length, kinds: (src.far || []).filter(x => Array.isArray(x.kinds)).length, stopFacts: (src.stops || []).filter(x => Array.isArray(x.kinds)).length + ' of ' + (src.stops || []).length, factsMissed: src.factsMissed ? String(src.factsWhy || 'no reason given') : '', filed: (src.next || []).map(x => Object.assign({ go: 1 }, x)).concat((src.far || []).filter(x => x.said > 0)).map(x => `${x.name}${x.go ? ' [next]' : ''}=${x.vt || 'not known'}${x.voy && x.voy !== x.name ? ' <' + x.voy + '>' : ''}${x.said ? ' said' + x.said : ''}${x.inVoy ? ' in ' + x.inVoy : ''}`).join('; '), next: (src.next || []).length, regions: (src.regions || []).map(t => t + ' (' + (src.far || []).filter(x => x.inVoy === t).length + ' places: ' + (src.far || []).filter(x => x.inVoy === t).sort((a, b) => (b.sl || 0) - (a.sl || 0)).slice(0, 8).map(x => x.name + ' ' + (x.sl || 0) + (x.vt ? ' ' + x.vt : '')).join(', ') + ')').join('; ') + (src.regionsMissed ? ' [some not answered]' : ''), sights: g.sites.length, cands, open: !!g.tripsOpen,
        trips: g.farther.map(s => ({ name: s.name, cat: s.category, way: s.travelSrc, travel: s.travel, landing: s.landing || '', at: [s.lat, s.lng] })) };
    }, { h: H, city: c.city, want: c.want || [] });
    await p.close();
    const out = [`\n===== ${c.city} (${((Date.now() - t0) / 1000).toFixed(0)} s)`];
    if (r.err) { open++; out.push('  NOT TESTED: ' + r.err); lines.push(out.join('\n')); console.log(out.join('\n')); return; }
    out.push(`  sources: ${r.sights} sights; ${r.far} far places (${r.voy} with a travel-guide page, ${r.said} the city's guide points to, ${r.kinds} with facts), ${r.next} "Go next"; regions read: ${r.regions || 'none'}; sights with facts: ${r.stopFacts}${r.factsMissed ? '; the helper says facts were not answered: ' + r.factsMissed : ''}`);
    out.push('  filed by the travel guide as: ' + r.filed);
    out.push('  ranked: ' + r.cands.map(x => `${x.name} (${x.score}${x.next ? ' next' : ''}${x.part ? ' part' : ''}${x.said ? ' said' + x.said : ''}${x.unesco ? ' unesco' : ''}${x.isle ? ' island' : ''} ${x.kinds}, ${x.km} km)`).join('; '));
    for (const l of r.log || []) out.push(`  . ${l.name}: ${l.got} (asked at ${l.at}; lines: ${(l.lines || []).join(' | ') || 'not asked'}${l.road ? '; road: ' + l.road : ''})`);
    for (const w of r.why || []) out.push(`  ? ${w.w}: ${JSON.stringify(w.got).slice(0, 700)}`);
    // An island asked for with no outline on the map: what the helper and each map server say about it, one by one.
    const seen = new Set();
    for (const w of r.why || []) for (const g of w.got || []) { if (!g.wd || seen.has(g.wd) || !(g.kinds || []).includes('island') || !(r.log || []).some(l => l.name === g.name && /no outline/.test(l.at))) continue; seen.add(g.wd);
      try { const j = await (await fetch(H + '/landing?wd=' + g.wd)).json(); out.push(`  # ${g.name} ${g.wd} helper: ${JSON.stringify(Object.assign({}, j, { piers: (j.piers || []).length })).slice(0, 200)}`); } catch (e) { out.push(`  # ${g.name} helper: ${e.message}`); }
      for (const ep of ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']) {
        try { const q = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(`[out:json][timeout:25];(node["wikidata"="${g.wd}"];way["wikidata"="${g.wd}"];relation["wikidata"="${g.wd}"];);out tags 20;`), headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'day-trips-check' }, signal: AbortSignal.timeout(30000) });
          const t = await q.text(); let d = ''; try { const j = JSON.parse(t); d = (j.remark ? 'remark ' + j.remark + '; ' : '') + (j.elements || []).map(e => e.type + ' ' + e.id + ' ' + ['place', 'type', 'natural', 'boundary'].map(k => e.tags && e.tags[k] ? k + '=' + e.tags[k] : '').filter(Boolean).join(',')).join(' | '); } catch (e) { d = t.slice(0, 80).replace(/\s+/g, ' '); }
          out.push(`  #   ${ep.split('/')[2]}: ${q.status} ${d || 'nothing'}`); } catch (e) { out.push(`  #   ${ep.split('/')[2]}: ${e.message}`); } } }
    if (!r.centre) out.push('  no centre in the sources');
    for (const t of r.trips) out.push(`  + ${t.name} [${t.cat}] (${t.way})${t.landing ? ' at ' + t.landing : ''}: ${t.travel}`);
    if (r.open) { open++; out.push('  NOT FINAL: a way could not be asked (a service was busy) after 3 tries'); }
    const miss = (c.want || []).filter(w => !r.trips.some(t => new RegExp(w, 'i').test(t.name)));
    const wrong = r.trips.filter(t => (c.never || []).some(w => new RegExp(w, 'i').test(t.name)));
    if (miss.length) { if (!r.open) bad++; out.push(`  ${r.open ? 'not yet' : 'MISSING'}: ${miss.join(', ')}`); }
    if (wrong.length) { bad++; out.push('  WRONG: ' + wrong.map(t => t.name).join(', ')); }
    lines.push(out.join('\n')); console.log(out.join('\n'));
  };
  const todo = CITIES.slice(); // One city at a time, as one traveler's phone would ask: three at once had the free map servers refuse most asks
  // (live check, Nov 26).
  while (todo.length) await one(todo.shift());
  console.log(`\nday-trips-live: ${CITIES.length} cities, ${bad} with an expected day trip missing or a wrong one, ${open} not tested or not final`);
  await b.close(); process.exit(bad ? 1 : 0);
})();
