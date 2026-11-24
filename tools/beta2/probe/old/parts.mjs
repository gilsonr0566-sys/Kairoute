// Probe (sight audit): which stops Wikidata says are part of (P361) or stand in (P276) another place, with that whole's
// name, fame and distance, and whether the whole is itself one of the city's stops. Sets the fold rule on real data.
import fs from 'fs';
const UA = { 'user-agent': 'KairouteAudit/1.0 (test run; https://github.com/gilsonr0566-sys/kairoute)', accept: 'application/sparql-results+json' };
const hav = (a, b) => { const R = 6371, r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lng - a.lng) * r; const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const ask = async q => { for (let t = 0; t < 3; t++) { try { const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: UA }); if (r.ok) return await r.json(); } catch (e) {} await new Promise(x => setTimeout(x, 4000)); } return null; };
for (const f of fs.readdirSync('tools/beta2/sources').filter(f => !/probe/.test(f))) {
  let d; try { d = JSON.parse(fs.readFileSync('tools/beta2/sources/' + f)); } catch (e) { continue; }
  const st = (d.stops || []).filter(x => x.wd), byWd = new Map(st.map(x => [x.wd, x]));
  for (let i = 0; i < st.length; i += 80) {
    const part = st.slice(i, i + 80);
    const j = await ask(`SELECT ?item ?p ?whole ?wl ?wsl ?wloc WHERE { VALUES ?item { ${part.map(x => 'wd:' + x.wd).join(' ')} } VALUES ?p { wdt:P361 wdt:P276 } ?item ?p ?whole . OPTIONAL { ?whole rdfs:label ?wl FILTER(LANG(?wl)="en") } OPTIONAL { ?whole wikibase:sitelinks ?wsl } OPTIONAL { ?whole wdt:P625 ?wloc } }`);
    for (const b of (j && j.results.bindings) || []) {
      const x = byWd.get(b.item.value.split('/').pop()), w = b.whole.value.split('/').pop(), m = b.wloc && /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.wloc.value);
      const km = m && x.lat != null ? hav(x, { lat: +m[2], lng: +m[1] }).toFixed(2) : '?';
      console.log(`${f.replace('.json', '')} | ${x.name} sl${x.sl} | ${b.p.value.split('/').pop()} | ${b.wl ? b.wl.value : w} ${w} sl${b.wsl ? b.wsl.value : '?'} | ${km} km | ${byWd.has(w) ? 'STOP' : '-'}`);
    }
  }
}
