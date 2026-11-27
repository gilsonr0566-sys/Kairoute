// Probe (sight audit): which kinds Wikidata gives the sources' stops, to set the "is it a place to visit" rule and the
// visit-length kinds from facts, not words. Prints one line per stop. Runs on GitHub (wd-probe.yml).
import fs from 'fs';
const UA = { 'user-agent': 'KairouteAudit/1.0 (test run; https://github.com/gilsonr0566-sys/kairoute)', accept: 'application/sparql-results+json' };
const CLASSES = { Q811979: 'structure', Q2221906: 'geo-location', Q41176: 'building', Q4989906: 'monument', Q839954: 'archaeological', Q22698: 'park', Q33506: 'museum', Q16970: 'church', Q43229: 'organization',
  Q1656682: 'event', Q34770: 'language', Q476028: 'football-club', Q1002697: 'periodical', Q1190554: 'occurrence', Q17537576: 'creative-work', Q3305213: 'painting', Q15284: 'municipality', Q486972: 'settlement', Q56061: 'admin-territory',
  Q35145263: 'natural-object', Q618123: 'geographical-feature', Q1497364: 'building-complex', Q570116: 'tourist-attraction', Q2319498: 'landmark', Q12518: 'tower', Q23413: 'castle', Q57821: 'fortification', Q16560: 'palace', Q11303: 'skyscraper',
  Q207694: 'art-museum', Q2977: 'cathedral', Q32815: 'mosque', Q34627: 'synagogue', Q44539: 'temple', Q12280: 'bridge', Q174782: 'square', Q54831: 'amphitheatre', Q483110: 'stadium', Q3918: 'university', Q31855: 'research-institute', Q7075: 'library', Q1137809: 'courthouse', Q7188: 'government', Q327333: 'gov-agency', Q15991290: 'intergov-org',
  Q24354: 'theatre', Q153562: 'opera-house', Q641226: 'arena', Q18674739: 'event-venue', Q82794: 'geo-region', Q5107: 'continent', Q1076486: 'sports-venue', Q162875: 'mausoleum', Q1440300: 'observation-tower', Q2105463: 'observation-deck',
  Q1060829: 'concert-hall', Q194195: 'amusement-park', Q43501: 'zoo', Q2281788: 'aquarium', Q37654: 'market', Q39614: 'cemetery', Q40080: 'beach', Q6017969: 'viewpoint', Q1081138: 'historic-site', Q4895393: 'monastery', Q44613: 'monastery2', Q108325: 'chapel', Q1107656: 'garden', Q15661340: 'ancient-city', Q34038: 'waterfall', Q8502: 'mountain', Q23442: 'island', Q12323: 'dam', Q5003624: 'memorial', Q860861: 'sculpture', Q179700: 'statue', Q483453: 'fountain', Q16917: 'hospital', Q55488: 'railway-station', Q1248784: 'airport', Q3917681: 'embassy', Q27686: 'hotel', Q1021645: 'office-building', Q11755880: 'residential-building', Q123705: 'neighbourhood', Q4830453: 'business', Q79007: 'street', Q34442: 'road', Q16970: 'church' };
const want = Object.keys(CLASSES).map(x => 'wd:' + x).join(' ');
const rows = [];
// Named checks (the coordinator's live findings and the famous places whose visit length is in doubt).
{ const names = ['continental Europe', 'Wiener Stadthalle', 'Teatro di San Carlo', 'Hagia Sophia', 'Colosseum', 'Tower of London', 'Topkapı Palace', 'Burj Khalifa', 'Sagrada Família', "St. Peter's Basilica", 'Louvre', 'Edinburgh Castle', 'Vatican Museums', 'Sistine Chapel', 'Camp Nou', 'Elbphilharmonie', 'Miniatur Wunderland', 'Venus de Milo', 'Basilica Cistern', 'Grand Bazaar', 'Hallgrímskirkja', 'Harpa', "Doge's Palace", 'Rialto Bridge', 'Schönbrunn Palace', 'Belém Tower', 'Jerónimos Monastery', 'Park Güell', 'Fushimi Inari-taisha', 'Kinkaku-ji'];
  const q = `SELECT ?n ?item ?sl ?w WHERE { VALUES ?n { ${names.map(n => JSON.stringify(n) + '@en').join(' ')} } ?item rdfs:label ?n ; wikibase:sitelinks ?sl . FILTER(?sl > 20) OPTIONAL { VALUES ?w { ${want} } ?item wdt:P31/wdt:P279* ?w } }`;
  let j = null; for (let t = 0; t < 3 && !j; t++) { try { const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: UA }); if (r.ok) j = await r.json(); else await new Promise(x => setTimeout(x, 4000)); } catch (e) {} }
  const m = {}; for (const b of (j && j.results.bindings) || []) { const k = b.n.value + ' ' + b.item.value.split('/').pop() + ' sl' + b.sl.value; m[k] = m[k] || new Set(); if (b.w) m[k].add(CLASSES[b.w.value.split('/').pop()]); }
  for (const [k, v] of Object.entries(m)) console.log('NAMED | ' + k + ' | ' + [...v].sort().join(',')); }
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
