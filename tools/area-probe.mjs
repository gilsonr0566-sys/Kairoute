// Probe: which map areas (OpenStreetMap) each sight stands inside, for the area-visit fold.
import fs from "fs";
const EPS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const files = (process.env.CITIES || "src-civitavecchia-rome,prague-sources,src-athens,src-paris,src-barcelona,src-madrid").split(",");
const Q = {
  slim: pts => "[out:json][timeout:60];" + pts.map((p, i) => `is_in(${(+p.lat).toFixed(5)},${(+p.lng).toFixed(5)})->.a;area.a[name]->.a;.a convert a n=t["name"],en=t["name:en"],wd=t["wikidata"],k=t["boundary"],al=t["admin_level"];out;make sep i=${i};out;`).join(""),
};
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(`tools/fixtures/${f}.json`, "utf8")), src = j.sources || j;
  const pts = (src.stops || []).filter(x => isFinite(x.lat)).slice(0, 80);
  for (const [qn, qf] of Object.entries(Q)) {
    let d = null, why = ""; const t0 = Date.now();
    for (const ep of EPS) {
      try { const r = await fetch(ep, { method: "POST", body: "data=" + encodeURIComponent(qf(pts)), headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "kairoute-area-probe" }, signal: AbortSignal.timeout(90000) });
        if (!r.ok) { why += ep + " " + r.status + " " + (await r.text()).slice(0, 300) + "; "; continue; } d = await r.json(); break; } catch (e) { why += ep + " " + e + "; "; }
    }
    if (!d) { console.log(JSON.stringify({ city: f, q: qn, error: why })); continue; }
    const out = {}; let cur = [];
    for (const e of d.elements || []) {
      if (e.type === "sep") { const p = pts[+e.tags.i]; out[`${p.name}|${p.lat}|${p.lng}`] = cur; cur = []; continue; }
      const t = e.tags || {}; cur.push([t.n, t.en, t.wd, t.k, t.al].map(x => x || "").join("~"));
    }
    console.log("AREAS " + JSON.stringify({ city: f, q: qn, ms: Date.now() - t0, remark: d.remark, n: pts.length, got: Object.keys(out).length, bytes: JSON.stringify(d).length, areas: out }));
  }
}
