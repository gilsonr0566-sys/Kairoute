// Shows what the place check sees for a few names on the live helper. Run by the "Debug places" workflow.
{ const st = await (await fetch("https://kairoute-ai.rickgilson.workers.dev/status")).json(); console.log("STATUS", JSON.stringify(st)); }
// Uses cached answers where they exist, so it costs nothing.
const U = "https://kairoute-ai.rickgilson.workers.dev", H = { "content-type": "application/json", Origin: "https://gilsonr0566-sys.github.io" };
const city = process.env.CITY || "Kotor";
const names = (process.env.NAMES || "Cat Museum|Kotor City Museum|Perast|Our Lady of the Rocks|Skonto Square|Trg od Obala|Piazza of the Cats|St. George's Church Gate|The Lion Fountain|Aquarium Boka|Tivat Porto Montenegro|Cathedral of Saint Nicholas|San Giovanni Fortress|Kotor City Walls|St. Tryphon Cathedral|Maritime Museum|St. Luke's Church|Sea Gate|Church of St. Nicholas|Ladder of Kotor").split("|");
const t0 = Date.now(), r = await fetch(U + "/ground", { method: "POST", headers: H, body: JSON.stringify({ city, names }) });
const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (e) { console.log("BODY", txt.slice(0, 500)); } console.log("ground", r.status, Date.now() - t0, "ms center", JSON.stringify(j && j.center));
(j && j.results || []).forEach((x, i) => { console.log("==", names[i], "| answered", x && x.answered);
  console.log("   wiki", (x.wiki || []).length, "map", (x.map || []).length, ((x.map || [])[0] || {}).name);
 });
