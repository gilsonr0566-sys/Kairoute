// Probe (never part of the app): what Wikidata knows as travel destinations (own English Wikivoyage page) around a city.
const UA = { "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)", accept: "application/sparql-results+json" };
const C = { Split: [43.508, 16.44], Stockholm: [59.329, 18.069], Istanbul: [41.01, 28.96], "Hong Kong": [22.28, 114.16], Sydney: [-33.868, 151.209], Naples: [40.84, 14.25], Seattle: [47.606, -122.332], Helsinki: [60.17, 24.94],
  Athens: [37.976, 23.727], Lisbon: [38.71, -9.14], Venice: [45.437, 12.335], Dubrovnik: [42.641, 18.108], Barcelona: [41.385, 2.17], Edinburgh: [55.95, -3.19], Kyoto: [35.01, 135.768], Vienna: [48.208, 16.372], Mykonos: [37.447, 25.329], Nassau: [25.078, -77.34], Paris: [48.857, 2.352], Dubai: [25.27, 55.3] };
const only = process.env.ONLY ? new RegExp(process.env.ONLY, "i") : null;
const ask = async (q, ms) => { const t = Date.now(); try { const r = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q), { headers: UA, signal: AbortSignal.timeout(ms || 60000) }); if (!r.ok) return { err: r.status, ms: Date.now() - t }; return { j: await r.json(), ms: Date.now() - t }; } catch (e) { return { err: String(e.message).slice(0, 60), ms: Date.now() - t }; } };
for (const [name, [lat, lng]] of Object.entries(C)) { if (only && !only.test(name)) continue;
  const q = `SELECT ?item ?itemLabel ?sl ?dist ?title (GROUP_CONCAT(DISTINCT ?kl; separator="/") AS ?kinds) (MAX(IF(BOUND(?un),1,0)) AS ?unesco) WHERE {
    SERVICE wikibase:around { ?item wdt:P625 ?loc . bd:serviceParam wikibase:center "Point(${lng} ${lat})"^^geo:wktLiteral . bd:serviceParam wikibase:radius "100" . bd:serviceParam wikibase:distance ?dist . }
    ?voy schema:about ?item ; schema:isPartOf <https://en.wikivoyage.org/> ; schema:name ?title .
    ?item wikibase:sitelinks ?sl .
    OPTIONAL { ?item wdt:P31 ?k . ?k rdfs:label ?kl FILTER(LANG(?kl) = "en") }
    OPTIONAL { ?item wdt:P1435 ?un FILTER(?un = wd:Q9259) }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul" . } } GROUP BY ?item ?itemLabel ?sl ?dist ?title ORDER BY DESC(?sl) LIMIT 80`;
  const a = await ask(q, 60000);
  console.log(`\n===== ${name}: ${a.err ? "ERR " + a.err : a.j.results.bindings.length + " rows"} in ${a.ms} ms`);
  if (a.j) for (const b of a.j.results.bindings) console.log(`  ${(+b.dist.value).toFixed(1).padStart(5)} km  sl ${String(b.sl.value).padStart(3)}  ${b.itemLabel.value}  {${b.title.value}}  [${(b.kinds && b.kinds.value || "").slice(0, 90)}]${b.unesco.value === "1" ? " UNESCO" : ""}`);
  // the city page's own "Go next"
  try { const r = await fetch("https://en.wikivoyage.org/w/api.php?action=parse&format=json&formatversion=2&prop=wikitext&redirects=1&page=" + encodeURIComponent(name), { headers: UA, signal: AbortSignal.timeout(20000) }); const wt = (await r.json()).parse.wikitext;
    const m = /\n==\s*Go next\s*==([\s\S]*?)(\n==[^=]|$)/.exec(wt); const links = m ? [...m[1].matchAll(/^[*#].*?\[\[([^|\]#]+)/gm)].map(x => x[1]) : []; console.log("  GO NEXT: " + links.join(" | "));
  } catch (e) { console.log("  go next: " + e.message); }
  await new Promise(r => setTimeout(r, 1500));
}
