// What OpenStreetMap holds about ferries at two piers: route relations (with how they're mapped: stop members or
// only ways), single ferry ways, their seasonal/opening_hours/duration tags. Usage: node tools/ferry-probe.mjs
// (FERRY="lat,lng>lat,lng" to choose; default Naples cruise terminal > Amalfi). Always exits 0.
const OV = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const [A, B] = (process.env.FERRY || "40.8380,14.2550>40.6335,14.6025").split(">");
async function ov(q) { for (const ep of OV) { try { const r = await fetch(ep, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Kairoute probe" }, signal: AbortSignal.timeout(60000) }); if (r.ok) return await r.json(); console.log(ep, r.status); } catch (e) { console.log(ep, e.name); } } return { elements: [] }; }
for (const [nm, P] of [["A", A], ["B", B]]) {
  const d = await ov(`[out:json][timeout:50];way(around:3000,${P})[route=ferry]->.w;.w out tags;rel(bw.w)[route=ferry];out tags;node(around:3000,${P})[amenity=ferry_terminal];out tags;`);
  console.log(`\n== ${nm} ${P}: ${d.elements.length} elements`);
  for (const e of d.elements) console.log(`  ${e.type}/${e.id} ${JSON.stringify(e.tags)}`);
}
const both = await ov(`[out:json][timeout:50];way(around:3000,${A})[route=ferry]->.wa;way(around:3000,${B})[route=ferry]->.wb;rel(bw.wa)[route=ferry]->.ra;rel(bw.wb)[route=ferry]->.rb;rel.ra.rb;out body;way.wa.wb;out tags;`);
console.log(`\n== serving both ends: ${both.elements.length}`);
for (const e of both.elements) console.log(`  ${e.type}/${e.id} ${JSON.stringify(e.tags)} members: ${(e.members || []).map(m => m.type[0] + (m.role ? ":" + m.role : "")).join(" ")}`);
try { const { allOptions } = await import("../worker/transit.js"); const pt = s => { const [lat, lng] = s.split(",").map(Number); return { lat, lng }; }; const r = await allOptions(pt(A), pt(B), 1, 60000); console.log("\n== allOptions now:"); for (const x of r.opts) console.log(`  ${x.min} min ${x.label} | ${x.from} > ${x.to} | ${x.src}${x.hours ? " | hours " + x.hours : ""}`); } catch (e) { console.log("allOptions failed", e.message); }
