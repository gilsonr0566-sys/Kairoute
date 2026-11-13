// Prints the real public transport OpenStreetMap knows between pairs of points (no AI used), the same way the
// worker's /transit finds it. Usage: node tools/transit-probe.mjs  (PAIRS="lat,lng>lat,lng;..." to choose)
// Always exits 0: it only reports what the map holds.
import { allOptions } from "../worker/transit.js";
const DEF = [
  ["Naples cruise terminal > Sorrento", "40.8380,14.2550>40.6263,14.3757"],
  ["Sorrento > Pompeii", "40.6263,14.3757>40.7490,14.4848"],
  ["Pompeii > Naples cruise terminal", "40.7490,14.4848>40.8380,14.2550"],
  ["Naples cruise terminal > Pompeii", "40.8380,14.2550>40.7490,14.4848"],
  ["Piraeus cruise port > Acropolis", "37.9420,23.6370>37.9715,23.7257"],
  ["Barcelona Sagrada Familia > Montserrat", "41.4036,2.1744>41.5934,1.8378"],
  ["Civitavecchia port > Rome St Peter's", "42.0930,11.7870>41.9022,12.4539"]
];
const pairs = process.env.PAIRS ? process.env.PAIRS.split(";").map((p, i) => ["pair " + (i + 1), p]) : DEF;
const pt = s => { const [lat, lng] = s.split(",").map(Number); return { lat, lng }; };
for (const [name, p] of pairs) {
  const [a, b] = p.split(">").map(pt);
  try {
    const t0 = Date.now(), r0 = await allOptions(a, b, 1, 90000), r = r0.late ? (await r0.late) || r0 : r0, o = r.opts;
    console.log(`\n== ${name} (${o.length} options, ${Date.now() - t0} ms${r.partial ? ", PARTIAL (a source was busy)" : ""})`);
    for (const x of o) console.log(`  ${x.min} min total: ${x.label}${x.operator ? " (" + x.operator + ")" : ""} | ${x.access.how} ${x.access.min} min to ${x.from || "?"} | wait ${x.wait} (every ${x.every} min, ${x.everySrc}) | ride ${x.ride} min, ${x.km} km, ${x.stops} stops | ${x.egress.how} ${x.egress.min} min from ${x.to || "?"} | path ${x.path.length} pts${x.hours ? " | hours " + x.hours : ""}${x.fare ? " | fare " + x.fare : ""} | ${x.src}${x.steps ? "\n      " + x.steps.join("\n      ") : ""}`);
  } catch (e) { console.log(`\n== ${name}: ${e.message} ${(e.why || []).join("; ")}`); }
  await new Promise(r => setTimeout(r, 3000));
}
