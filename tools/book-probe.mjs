// Booking links and long-distance timetables: which booking pages open for a route, and what the free timetable
// planner (Transitous) knows between two stations on a date. Only reports; always exits 0.
const UA = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", "accept-language": "en-US,en;q=0.9", accept: "text/html" };
const urls = (process.env.URLS || [
  "https://www.omio.com/trains/barcelona/madrid", "https://www.omio.com/trains/paris/lyon", "https://www.omio.com/trains/rome/florence",
  "https://www.omio.com/trains/new-york/washington", "https://www.omio.com/trains/athens/thessaloniki", "https://www.omio.com/trains/naples/rome",
  "https://www.omio.com/ferries/piraeus/mykonos", "https://www.omio.com/ferries/athens/mykonos", "https://www.omio.com/ferries/naples/capri", "https://www.omio.com/trains/barcelona/nowhere-town",
  "https://www.thetrainline.com/en/train-times/barcelona-to-madrid", "https://www.ferryhopper.com/en/ferry-routes/direct/piraeus-mykonos"].join(" ")).split(/\s+/);
for (const u of urls) {
  try { const r = await fetch(u, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(20000) }); const t = await r.text();
    const title = (/<title[^>]*>([^<]*)/i.exec(t) || [])[1] || ""; console.log(`${r.status} ${u} -> ${r.url} | ${title.trim().slice(0, 120)}`);
  } catch (e) { console.log(`ERR ${u} ${e.message}`); }
}
const pairs = [["Barcelona Sants > Madrid Atocha", "41.3792,2.1400", "40.4065,-3.6895"], ["Roma Termini > Firenze SMN", "41.9010,12.5018", "43.7764,11.2480"], ["Paris Gare de Lyon > Lyon Part-Dieu", "48.8443,2.3744", "45.7606,4.8597"], ["Piraeus > Mykonos", "37.9420,23.6370", "37.4467,25.3289"]];
for (const [n, a, b] of pairs) for (const date of ["2027-07-18", "2026-12-07"]) for (const hh of ["06", "10", "14"]) {
  const u = `https://api.transitous.org/api/v1/plan?fromPlace=${a}&toPlace=${b}&time=${date}T${hh}:00:00Z&numItineraries=6`;
  try { const r = await fetch(u, { headers: { "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)" }, signal: AbortSignal.timeout(30000) }); const j = await r.json();
    console.log(`\n== ${n} ${date} from ${hh}Z: ${(j.itineraries || []).length}`);
    for (const it of j.itineraries || []) console.log("  " + Math.round(it.duration / 60) + " min: " + it.legs.filter(l => l.mode !== "WALK").map(l => `${l.mode} ${l.routeShortName || ""} (${l.agencyName || ""}) ${l.from.name} ${l.startTime.slice(11, 16)}Z > ${l.to.name} ${l.endTime.slice(11, 16)}Z`).join(" | "));
  } catch (e) { console.log(`== ${n} ${date} ${hh}: ${e.message}`); }
  await new Promise(r => setTimeout(r, 1200));
}
