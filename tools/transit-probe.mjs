// Prints the real public transport OpenStreetMap knows between pairs of points (no AI used), the same way the
// worker's /transit finds it. Usage: node tools/transit-probe.mjs  (PAIRS="lat,lng>lat,lng;..." to choose)
// Always exits 0: it only reports what the map holds.
import { allOptions, setMapWait, transitOptions } from "../worker/transit.js";
if (process.env.MAP_MS) setMapWait(+process.env.MAP_MS); // give the free map servers longer when they are busy
const DEF = [
  ["Naples cruise terminal > Sorrento", "40.8380,14.2550>40.6263,14.3757"],
  ["Sorrento > Pompeii", "40.6263,14.3757>40.7490,14.4848"],
  ["Pompeii > Naples cruise terminal", "40.7490,14.4848>40.8380,14.2550"],
  ["Naples cruise terminal > Pompeii", "40.8380,14.2550>40.7490,14.4848"],
  ["Piraeus cruise port > Acropolis", "37.9420,23.6370>37.9715,23.7257"],
  ["Barcelona Sagrada Familia > Montserrat", "41.4036,2.1744>41.5934,1.8378"],
  ["Civitavecchia port > Rome St Peter's", "42.0930,11.7870>41.9022,12.4539"]
];
// TRACE=1: print every request to the map servers and timetables (host, answer, time), to see which one is busy.
if (process.env.TRACE) { const f0 = globalThis.fetch; globalThis.fetch = async (u, o) => { const t0 = Date.now(), h = String(u).split("/")[2], q = String((o && o.body) || "").slice(0, 70); if (q) console.log(`  [${h}] asking ${decodeURIComponent(q)}`);
  try { const r = await f0(u, o); let more = "";
    if (q && r.ok) { try { const d = await r.clone().json(), n = {}; for (const e of d.elements || []) n[e.type] = (n[e.type] || 0) + 1; more = ` -> ${JSON.stringify(n)}${d.remark ? " REMARK " + String(d.remark).slice(0, 90) : ""}`; } catch (e) {} }
    console.log(`  [${h}] ${r.status} ${Date.now() - t0} ms ${q ? decodeURIComponent(q) : ""}${more}`); return r; } catch (e) { console.log(`  [${h}] ${e.name} ${Date.now() - t0} ms ${q ? decodeURIComponent(q) : ""}`); throw e; } }; }
const pairs = process.env.PAIRS ? process.env.PAIRS.split(";").map((p, i) => ["pair " + (i + 1), p]) : DEF;
const pt = s => { const [lat, lng] = s.split(",").map(Number); return { lat, lng }; };
for (const [name, p] of pairs) {
  const [a, b] = p.split(">").map(pt);
  try {
    const t0 = Date.now(), r0 = await allOptions(a, b, process.env.DATE ? new Date(process.env.DATE + "T12:00:00Z").getUTCDay() : 1, 90000, undefined, process.env.DATE || undefined), r = r0.late ? (await r0.late) || r0 : r0, o = r.opts;
    console.log(`\n== ${name} (${o.length} options, ${Date.now() - t0} ms${r.partial ? ", PARTIAL (a source was busy)" : ""})`);
    for (const x of o) console.log(`  ${x.min} min total: ${x.label}${x.forDate ? ' [timetable for ' + x.forDate + ']' : ''}${x.months ? ' [months ' + x.months.join(',') + ']' : ''}${x.operator ? " (" + x.operator + ")" : ""} | ${x.access.how} ${x.access.min} min to ${x.from || "?"} | wait ${x.wait} (every ${x.every} min, ${x.everySrc}) | ride ${x.ride} min, ${x.km} km, ${x.stops} stops | ${x.egress.how} ${x.egress.min} min from ${x.to || "?"} | path ${x.path.length} pts${x.hours ? " | hours " + x.hours : ""}${x.fare ? " | fare " + x.fare : ""} | ${x.src}${x.steps ? "\n      " + x.steps.join("\n      ") : ""}`);
    if (process.env.TRACE && r.partial) { const d = await transitOptions(a, b).catch(e => ({ why: [e.message] })); console.log(`  map alone: ${(d.length ?? 0)} options${d.why ? ", busy: " + d.why.join(" | ") : ""}`); for (const x of Array.isArray(d) ? d : []) console.log(`    ${x.label}: ${x.from} > ${x.to}, ${x.min} min`); }
  } catch (e) { console.log(`\n== ${name}: ${e.message} ${(e.why || []).join("; ")}`); }
  await new Promise(r => setTimeout(r, 3000));
}
// RAILDUMP="lat,lng;...": the train route relations within 3 km of each point, with how their stops are mapped
// (which member types and roles), to see why a line isn't matched.
if (process.env.RAILDUMP) for (const p of process.env.RAILDUMP.split(";")) {
  const q = `[out:json][timeout:60];(node(around:3000,${p})[railway~"^(station|halt|stop)$"];node(around:3000,${p})[public_transport=stop_position];way(around:3000,${p})[railway=platform];)->.s;.s out tags 20;rel(bn.s)[type=route];out tags;rel(bw.s)[type=route];out tags;`;
  for (const ep of ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]) {
    try { const r = await fetch(ep, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)" }, signal: AbortSignal.timeout(90000) }); if (!r.ok) { console.log(`  ${ep.split("/")[2]} ${r.status}`); continue; }
      const d = await r.json(); console.log(`\n== rail near ${p} (${ep.split("/")[2]})${d.remark ? " REMARK " + d.remark.slice(0, 80) : ""}`);
      for (const e of d.elements || []) console.log(`  ${e.type}/${e.id} ${JSON.stringify(e.tags || {}).slice(0, 230)}`);
      if ((d.elements || []).length) break; } catch (e) { console.log(`  ${ep.split("/")[2]} ${e.name}`); }
  }
}
