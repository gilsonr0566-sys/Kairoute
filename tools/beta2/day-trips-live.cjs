// Day trips, live (rule R-36): for real cities, what the built app offers as classic day trips from the helper's real
// answers (free sources only, AI off): the candidates it ranked, the way it found to each, and whether the day trips a
// visitor expects are there. Runs on GitHub (the container can't reach the helper or the sources). Prints; changes nothing.
// Usage: HELPER=http://localhost:8790/workers.dev node tools/beta2/day-trips-live.cjs beta2-site/index.html
//   HELPER unset = the live helper (ai.json). ONLY=regex limits the cities. Exit 1 when an expected day trip is missing.
const { chromium } = require('playwright'), path = require('path'), fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'beta2-site/index.html');
const H = (process.env.HELPER || JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'ai.json'))).url).replace(/\/$/, '');
const CITIES = JSON.parse(fs.readFileSync(path.join(__dirname, 'day-trips-expect.json'))).cities.filter(c => !process.env.ONLY || new RegExp(process.env.ONLY, 'i').test(c.city));
(async () => {
  const b = await chromium.launch(); let bad = 0, open = 0; const lines = [];
  const one = async c => {
    const p = await b.newPage(), log = []; p.on('console', m => { if (/Kairoute added/.test(m.text())) log.push(m.text()); });
    await p.goto('file://' + FILE); await p.waitForTimeout(800);
    await p.evaluate(h => window.__kairouteMockHelper(h, null, true), H);
    const t0 = Date.now();
    const r = await p.evaluate(async ({ h, city }) => {
      let src = null, code = 0;
      for (let t = 0; t < 5 && !src; t++) { try { const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 60000); const q = await fetch(h + '/sources?city=' + encodeURIComponent(city), { signal: ac.signal }); clearTimeout(tm); code = q.status; if (q.ok) { const j = await q.json(); if (j && Array.isArray(j.stops)) src = j; } } catch (e) { code = String(e.name || e); } if (!src) await new Promise(z => setTimeout(z, 4000)); }
      if (!src) return { err: 'no sources (' + code + ')' };
      const g = { city, country: '', sites: [], farther: [], starts: {}, restaurants: [] };
      window.__kairouteSourceSights(g, src);
      const cands = window.__kairouteTripCands(g, src);
      let n = 0; for (let t = 0; t < 3; t++) { n += await window.__kairouteClassicTrips(g, src); if (!g.tripsOpen) break; await new Promise(z => setTimeout(z, 20000)); }
      return { far: (src.far || []).length, voy: (src.far || []).filter(x => x.voy).length, said: (src.far || []).filter(x => x.said > 0 || x.part).length, kinds: (src.far || []).filter(x => Array.isArray(x.kinds)).length, next: (src.next || []).length, sights: g.sites.length, cands, open: !!g.tripsOpen,
        trips: g.farther.map(s => ({ name: s.name, cat: s.category, way: s.travelSrc, travel: s.travel, landing: s.landing || '', at: [s.lat, s.lng] })) };
    }, { h: H, city: c.city });
    await p.close();
    const out = [`\n===== ${c.city} (${((Date.now() - t0) / 1000).toFixed(0)} s)`];
    if (r.err) { open++; out.push('  NOT TESTED: ' + r.err); lines.push(out.join('\n')); console.log(out.join('\n')); return; }
    out.push(`  sources: ${r.sights} sights; ${r.far} far places (${r.voy} with a travel-guide page, ${r.said} the city's guide points to, ${r.kinds} with facts), ${r.next} "Go next"`);
    out.push('  ranked: ' + r.cands.map(x => `${x.name} (${x.score}${x.next ? ' next' : ''}${x.part ? ' part' : ''}${x.said ? ' said' + x.said : ''}${x.unesco ? ' unesco' : ''}${x.isle ? ' island' : ''}, ${x.km} km)`).join('; '));
    for (const t of r.trips) out.push(`  + ${t.name} [${t.cat}] (${t.way})${t.landing ? ' at ' + t.landing : ''}: ${t.travel}`);
    if (r.open) { open++; out.push('  NOT FINAL: a way could not be asked (a service was busy) after 3 tries'); }
    const miss = (c.want || []).filter(w => !r.trips.some(t => new RegExp(w, 'i').test(t.name)));
    const wrong = r.trips.filter(t => (c.never || []).some(w => new RegExp(w, 'i').test(t.name)));
    if (miss.length) { if (!r.open) bad++; out.push(`  ${r.open ? 'not yet' : 'MISSING'}: ${miss.join(', ')}`); }
    if (wrong.length) { bad++; out.push('  WRONG: ' + wrong.map(t => t.name).join(', ')); }
    lines.push(out.join('\n')); console.log(out.join('\n'));
  };
  const todo = CITIES.slice(); await Promise.all([0, 1, 2].map(async () => { while (todo.length) await one(todo.shift()); }));
  console.log(`\nday-trips-live: ${CITIES.length} cities, ${bad} with an expected day trip missing or a wrong one, ${open} not tested or not final`);
  await b.close(); process.exit(bad ? 1 : 0);
})();
