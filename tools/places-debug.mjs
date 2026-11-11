// Shows what the place check sees for a few names on the live helper. Run by the "Debug places" workflow.
// Uses cached answers where they exist, so it costs nothing.
const U = "https://kairoute-ai.rickgilson.workers.dev", H = { "content-type": "application/json", Origin: "https://gilsonr0566-sys.github.io" };
const city = process.env.CITY || "Kotor";
const names = (process.env.NAMES || "Cathedral of Saint Nicholas|The Venetian Arsenal|San Giovanni Fortress|Kotor City Walls|St. Tryphon Cathedral").split("|");
const t0 = Date.now(), r = await fetch(U + "/ground", { method: "POST", headers: H, body: JSON.stringify({ city, names }) });
const j = await r.json().catch(() => null); console.log("ground", r.status, Date.now() - t0, "ms center", JSON.stringify(j && j.center));
(j && j.results || []).forEach((x, i) => { console.log("==", names[i], "| answered", x && x.answered);
  (x.wiki || []).forEach(w => console.log("   wiki", w.title, w.lat, w.lng));
  (x.map || []).forEach(m => console.log("   map ", m.name, m.lat, m.lng, m.kind, m.city, m.osm)); });
