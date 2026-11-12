// Shows the outside fame ranking (Wikidata) the guide builder gets for each city. Run by "Check famous places".
const U = "https://kairoute-ai.rickgilson.workers.dev", H = { Origin: "https://gilsonr0566-sys.github.io" };
for (const city of (process.env.CITIES || "Madrid|Civitavecchia (Rome)|Santorini|Mykonos|Chania, Crete|Naples (Capri, Sorrento)|Kusadasi (Ephesus)|Barcelona|Athens|Messina, Sicily|Heraklion, Crete|Corpus Christi").split("|")) {
  const t0 = Date.now(), r = await fetch(U + "/famous?city=" + encodeURIComponent(city), { headers: H }); const j = await r.json().catch(() => ({}));
  console.log(`\n## ${city} -> area ${j.area} (${r.status}, ${Date.now() - t0} ms)`);
  console.log("MAIN: " + (j.main || []).slice(0, 30).map(x => `${x.name} ${x.sl}`).join("; "));
  console.log("FAR: " + (j.far || []).slice(0, 15).map(x => `${x.name} ${x.sl} ${x.km}km`).join("; "));
}
