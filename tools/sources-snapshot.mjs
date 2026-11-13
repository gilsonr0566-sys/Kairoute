// Prints Kairoute's /famous and /sources answers for several cities, one JSON line per city part, so a trimmed
// snapshot can be saved as a test fixture (this container can't reach the helper). Usage: CITIES="Rome|Paris" node tools/sources-snapshot.mjs
const U = "https://kairoute-ai.rickgilson.workers.dev";
const get = async p => { for (let i = 0; i < 3; i++) { try { const r = await fetch(U + p); if (r.ok) return await r.json(); console.log(p, "HTTP", r.status); } catch (e) { console.log(p, e.message); } await new Promise(r => setTimeout(r, 5000)); } return null; };
for (const city of (process.env.CITIES || "Civitavecchia (Rome)").split("|")) {
  const f = await get("/famous?city=" + encodeURIComponent(city)), s = await get("/sources?city=" + encodeURIComponent(city));
  console.log("FXF " + JSON.stringify({ city, famous: f && { area: f.area, port: f.port, center: f.center, main: f.main, far: (f.far || []).slice(0, 15) } }));
  if (s) { console.log("FXS " + JSON.stringify({ city, area: s.area, lang: s.lang, langName: s.langName, center: s.center, sources: s.sources, n: s.stops.length }));
    for (const x of s.stops) console.log("FXT " + JSON.stringify(Object.assign({ city }, x, { en: x.en ? x.en.slice(0, 260) : undefined, lc: x.lc ? x.lc.slice(0, 160) : undefined }))); }
}
