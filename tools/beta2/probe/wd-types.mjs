// Probe (sight audit): which kinds Wikidata gives the sources' stops, to set the "is it a place to visit" rule and the
// visit-length kinds from facts, not words. Prints one line per stop. Runs on GitHub (wd-probe.yml).
import fs from 'fs';
const UA = { 'user-agent': 'KairouteAudit/1.0 (test run; https://github.com/gilsonr0566-sys/kairoute)', accept: 'application/sparql-results+json' };
const CLASSES = { Q811979: 'structure', Q2221906: 'geo-location', Q41176: 'building', Q4989906: 'monument', Q839954: 'archaeological', Q22698: 'park', Q33506: 'museum', Q16970: 'church', Q43229: 'organization',
  Q1656682: 'event', Q34770: 'language', Q476028: 'football-club', Q1002697: 'periodical', Q1190554: 'occurrence', Q17537576: 'creative-work', Q3305213: 'painting', Q15284: 'municipality', Q486972: 'settlement', Q56061: 'admin-territory',
  Q35145263: 'natural-object', Q618123: 'geographical-feature', Q1497364: 'building-complex', Q570116: 'tourist-attraction', Q2319498: 'landmark', Q12518: 'tower', Q23413: 'castle', Q57821: 'fortification', Q16560: 'palace', Q11303: 'skyscraper',
  Q207694: 'art-museum', Q2977: 'cathedral', Q32815: 'mosque', Q34627: 'synagogue', Q44539: 'temple', Q12280: 'bridge', Q174782: 'square', Q54831: 'amphitheatre', Q483110: 'stadium', Q3918: 'university', Q31855: 'research-institute', Q7075: 'library', Q1137809: 'courthouse', Q7188: 'government', Q327333: 'gov-agency', Q15991290: 'intergov-org' };
const want = Object.keys(CLASSES).map(x => 'wd:' + x).join(' ');
const rows = [];
for (const f of fs.readdirSync('tools/beta2/sources').filter(f => !/probe/.test(f))) {
  let d; try { d = JSON.parse(fs.readFileSync('tools/beta2/sources/' + f)); } catch (e) { continue; }
  const st = (d.stops || []).filter(x => x.wd && (x.sl >= 30 || (x.src || []).length >= 3));
  for (let i = 0; i < st.length; i += 60) {
    const part = st.slice(i, i + 60), q = `SELECT ?item ?w WHERE { VALUES ?item { ${part.map(x => 'wd:' + x.wd).join(' ')} } VALUES ?w { ${want} } ?item wdt:P31/wdt:P279* ?w }`;
    let j = null; for (let t = 0; t < 3 && !j; t++) { try { const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: UA }); if (r.ok) j = await r.json(); else await new Promise(x => setTimeout(x, 4000)); } catch (e) {} }
    const m = {}; for (const b of (j && j.results.bindings) || []) { const k = b.item.value.split('/').pop(); (m[k] = m[k] || new Set()).add(CLASSES[b.w.value.split('/').pop()]); }
    for (const x of part) rows.push(`${f.replace('.json', '')} | ${x.name} | sl${x.sl} | src${(x.src || []).length} | ${[...(m[x.wd] || [])].sort().join(',')}`);
  }
}
console.log(rows.join('\n'));
