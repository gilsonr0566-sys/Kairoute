// Probe: which map areas (OpenStreetMap boundaries) each sight stands inside, for the area-visit fold.
// Prints one JSON line per city: { city, areas: { "<name>|<lat>|<lng>": [{ n, en, wd, len }] } }.
import fs from "fs";
const EPS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const files = ["src-civitavecchia-rome", "prague-sources", "src-athens", "src-paris", "src-barcelona", "src-madrid"];
function query(pts) {
  return "[out:json][timeout:90];" + pts.map((p, i) => `is_in(${(+p.lat).toFixed(5)},${(+p.lng).toFixed(5)})->.a;(way(pivot.a)(if:length()<12000);rel(pivot.a)(if:length()<12000););out tags bb;make sep i=${i};out;`).join("");
}
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(`tools/fixtures/${f}.json`, "utf8")), src = j.sources || j;
  const pts = (src.stops || []).filter(x => isFinite(x.lat)).slice(0, 70);
  let d = null, why = "";
  for (const ep of EPS) {
    try { const r = await fetch(ep, { method: "POST", body: "data=" + encodeURIComponent(query(pts)), headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "kairoute-area-probe" } });
      if (!r.ok) { why += ep + " " + r.status + " " + (await r.text()).slice(0, 200) + "; "; continue; } d = await r.json(); break; } catch (e) { why += ep + " " + e + "; "; }
  }
  if (!d) { console.log(JSON.stringify({ city: f, error: why })); continue; }
  const out = {}; let cur = [];
  for (const e of d.elements || []) {
    if (e.type === "sep") { const p = pts[+e.tags.i]; out[`${p.name}|${p.lat}|${p.lng}`] = cur; cur = []; continue; }
    const t = e.tags || {}, b = e.bounds;
    cur.push({ n: t.name, en: t["name:en"], wd: t.wikidata, k: t.boundary || t.tourism || t.historic || t.amenity || t.place || t.leisure || t.landuse || t.building || "", bb: b ? [b.minlat, b.minlon, b.maxlat, b.maxlon] : null });
  }
  console.log("AREAS " + JSON.stringify({ city: f, remark: d.remark, n: pts.length, areas: out }));
}
