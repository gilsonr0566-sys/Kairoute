// Shows every source Kairoute gathers for each city and how well they agree. Run by "Check city sources".
const U = "https://kairoute-ai.rickgilson.workers.dev", H = { Origin: "https://gilsonr0566-sys.github.io" };
for (const city of (process.env.CITIES || "Civitavecchia (Rome)|Madrid|Athens|Kusadasi (Ephesus)|Corpus Christi").split("|")) {
  const t0 = Date.now(); let r = { status: "fetch failed" }, j = {}; try { r = await fetch(U + "/sources?city=" + encodeURIComponent(city), { headers: H, signal: AbortSignal.timeout(170000) }); j = await r.json(); } catch (e) { j = { error: String(e) }; }
  console.log(`\n## ${city} -> area ${j.area} lang ${j.lang} (${r.status}, ${Date.now() - t0} ms) ${j.error || ""} ${JSON.stringify(j.ms || {})}`);
  console.log("SOURCES: " + (j.sources || []).map(s => `${s.name}: ${s.none ? "none" : s.failed ? "FAILED" : s.n}${s.pages ? " (" + s.pages + " pages)" : ""}`).join(" | "));
  const st = j.stops || [];
  const by = n => st.filter(x => x.src.length >= n).length;
  console.log(`STOPS ${st.length}: 4+ sources ${by(4)}, 3+ ${by(3)}, 2+ ${by(2)}, no place ${st.filter(x => x.lat == null).length}`);
  console.log(st.slice(0, 40).map(x => `${x.name}${x.local ? " [" + x.local + "]" : ""} ${x.src.length}${x.unesco ? " UNESCO" : x.heritage ? " H" : ""}${x.web ? " web" : ""}`).join("; "));
  const e = j.eats || []; console.log(`EATS ${e.length} (both guidebooks ${e.filter(x => x.src.length > 1).length}, with place ${e.filter(x => x.lat != null).length}): ` + e.slice(0, 15).map(x => x.name).join("; "));
}
