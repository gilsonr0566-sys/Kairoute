// Prints what Transitous (the free, open, worldwide timetable planner built on public GTFS feeds) offers between
// pairs of points on the next weekday at 08:00 and 15:00 local-ish time. Always exits 0: it only reports.
const DEF = [
  ["Naples cruise terminal > Sorrento", "40.8380,14.2550>40.6263,14.3757"],
  ["Sorrento > Pompeii", "40.6263,14.3757>40.7490,14.4848"],
  ["Pompeii > Naples cruise terminal", "40.7490,14.4848>40.8380,14.2550"],
  ["Piraeus cruise port > Acropolis", "37.9420,23.6370>37.9715,23.7257"],
  ["Barcelona Sagrada Familia > Montserrat", "41.4036,2.1744>41.5934,1.8378"],
  ["Civitavecchia port > Rome St Peter's", "42.0930,11.7870>41.9022,12.4539"]
];
const pairs = process.env.PAIRS ? process.env.PAIRS.split(";").map((p, i) => ["pair " + (i + 1), p]) : DEF;
const d = new Date(); d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7)); // next Monday
for (const [name, p] of pairs) {
  const [a, b] = p.split(">");
  for (const hh of ["06", "13"]) {
    const t = d.toISOString().slice(0, 10) + "T" + hh + ":00:00Z";
    const u = `https://api.transitous.org/api/v1/plan?fromPlace=${a}&toPlace=${b}&time=${t}&numItineraries=4`;
    try {
      const r = await fetch(u, { headers: { "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)" }, signal: AbortSignal.timeout(30000) });
      const j = await r.json().catch(() => ({}));
      console.log(`\n== ${name} @${t} HTTP ${r.status}: ${(j.itineraries || []).length} itineraries${j.error ? " " + JSON.stringify(j.error).slice(0, 200) : ""}`);
      for (const it of (j.itineraries || []).slice(0, 4)) console.log(`  ${Math.round(it.duration / 60)} min, ${it.transfers} changes: ` + it.legs.map(l => `${l.mode}${l.routeShortName ? " " + l.routeShortName : ""}${l.agencyName ? " (" + l.agencyName + ")" : ""} ${l.from && l.from.name} ${String(l.startTime).slice(11, 16)} > ${l.to && l.to.name} ${String(l.endTime).slice(11, 16)}${l.legGeometry ? " geom " + String(l.legGeometry.points || "").length + "ch p" + l.legGeometry.precision : ""}`).join(" | "));
      if (!(j.itineraries || []).length) console.log("  keys: " + Object.keys(j).join(","));
    } catch (e) { console.log(`\n== ${name}: ${e.message}`); }
    await new Promise(r => setTimeout(r, 1500));
  }
}
