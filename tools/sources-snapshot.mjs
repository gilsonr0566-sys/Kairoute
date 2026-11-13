// Saves Kairoute's /famous and /sources answers for several cities as test fixtures (tools/fixtures/src-<city>.json),
// because this container can't reach the helper. Run by the "Sources snapshot" workflow, which commits the files
// to the branch it ran on. Usage: CITIES="Civitavecchia (Rome)|Paris" node tools/sources-snapshot.mjs
import fs from "node:fs";
const U = "https://kairoute-ai.rickgilson.workers.dev";
const get = async p => { for (let i = 0; i < 3; i++) { try { const r = await fetch(U + p); if (r.ok) return await r.json(); console.log(p, "HTTP", r.status); } catch (e) { console.log(p, e.message); } await new Promise(r => setTimeout(r, 5000)); } return null; };
const slim = x => Object.assign({}, x, { en: x.en ? x.en.slice(0, 300) : undefined, lc: undefined, web: undefined });
for (const city of (process.env.CITIES || "Civitavecchia (Rome)").split("|")) {
  const f = await get("/famous?city=" + encodeURIComponent(city)), s = await get("/sources?city=" + encodeURIComponent(city));
  if (!f || !s) { console.log("SKIP " + city); continue; }
  const out = { note: `Snapshot of Kairoute's /famous and /sources answers for ${city} (${new Date().toISOString().slice(0, 10)}). Used by the safety net's sights-coverage check.`, destination: city,
    famous: { area: f.area, port: f.port, center: f.center, main: f.main, far: f.far },
    sources: { area: s.area, lang: s.lang, langName: s.langName, center: s.center, sources: s.sources, stops: s.stops.map(slim), far: s.far, eats: [] } };
  const file = "tools/fixtures/src-" + city.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "") + ".json";
  fs.writeFileSync(file, JSON.stringify(out));
  console.log(`SAVED ${file}: area ${s.area}, ${s.stops.length} stops, ${(s.far || []).length} far`);
}
