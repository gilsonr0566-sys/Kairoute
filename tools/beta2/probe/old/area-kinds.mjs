// Probe (sight audit, Nov 23): facts behind three live findings: the Bastille (demolished, still offered as a 2-hour
// must-see fort), the Santa Justa Lift (called a church), Les Invalides (a plain 40-minute sight). Prints each one's
// P31 classes and every end/state statement (P576, P5817, P3999, P582, P793).
const UA = { 'user-agent': 'KairouteAudit/1.0 (test run; https://github.com/gilsonr0566-sys/kairoute)', accept: 'application/sparql-results+json' };
const ask = async q => { for (let t = 0; t < 3; t++) { try { const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: UA }); if (r.ok) return await r.json(); } catch (e) {} await new Promise(x => setTimeout(x, 4000)); } return null; };
const names = ['Bastille', 'Santa Justa Lift', 'Les Invalides', 'Hagia Sophia', 'Belém Tower', 'Arc de Triomphe', 'Praça do Comércio'];
const q = `SELECT ?n ?item ?sl ?p ?v ?vl WHERE { VALUES ?n { ${names.map(n => JSON.stringify(n) + '@en').join(' ')} } ?item rdfs:label ?n ; wikibase:sitelinks ?sl . FILTER(?sl > 30)
  VALUES ?p { wdt:P31 wdt:P576 wdt:P5817 wdt:P3999 wdt:P582 wdt:P793 } ?item ?p ?v . OPTIONAL { ?v rdfs:label ?vl FILTER(LANG(?vl)="en") } }`;
const j = await ask(q);
for (const b of (j && j.results.bindings) || []) console.log(`FACT | ${b.n.value} ${b.item.value.split('/').pop()} sl${b.sl.value} | ${b.p.value.split('/').pop()} | ${b.vl ? b.vl.value : b.v.value}`);
