// Booking links and long-distance timetables: which booking pages open for a route, and what the free timetable
// planner (Transitous) knows between two stations on a date. Only reports; always exits 0.
const UA = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", "accept-language": "en-US,en;q=0.9", accept: "text/html" };
const urls = (process.env.URLS || [
  "https://www.thetrainline.com/en/train-times/barcelona-to-madrid", "https://www.thetrainline.com/en/train-times/paris-to-lyon", "https://www.thetrainline.com/en/train-times/rome-to-florence",
  "https://www.thetrainline.com/en/train-times/naples-to-rome", "https://www.thetrainline.com/en/train-times/athens-to-thessaloniki", "https://www.thetrainline.com/en/train-times/lisbon-to-porto",
  "https://www.thetrainline.com/en/train-times/london-to-edinburgh", "https://www.thetrainline.com/en/train-times/munich-to-vienna", "https://www.thetrainline.com/en/train-times/prague-to-vienna",
  "https://www.thetrainline.com/en/train-times/barcelona-to-nowhere-town", "https://www.thetrainline.com/en/train-times/new-york-to-washington", "https://www.thetrainline.com/en/train-times/venice-to-florence",
  "https://www.ferryhopper.com/en/ferries/piraeus/mykonos", "https://www.ferryhopper.com/en/piraeus-mykonos-ferry", "https://www.ferryhopper.com/en/ferry-routes/piraeus-mykonos", "https://www.ferryhopper.com/en/",
  "https://www.directferries.com/piraeus_mykonos_ferry.htm", "https://www.directferries.co.uk/piraeus_mykonos_ferry.htm", "https://www.amtrak.com/home.html", "https://www.trainline.com/"].join(" ")).split(/\s+/);
for (const u of urls) {
  try { const r = await fetch(u, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(20000) }); const t = await r.text();
    const title = (/<title[^>]*>([^<]*)/i.exec(t) || [])[1] || ""; console.log(`${r.status} ${u} -> ${r.url} | ${title.trim().slice(0, 120)}`);
  } catch (e) { console.log(`ERR ${u} ${e.message}`); }
}
const pairs = process.env.SKIP_TT ? [] : [["Barcelona Sants > Madrid Atocha", "41.3792,2.1400", "40.4065,-3.6895"], ["Roma Termini > Firenze SMN", "41.9010,12.5018", "43.7764,11.2480"], ["Paris Gare de Lyon > Lyon Part-Dieu", "48.8443,2.3744", "45.7606,4.8597"], ["Piraeus > Mykonos", "37.9420,23.6370", "37.4467,25.3289"]];
for (const [n, a, b] of pairs) for (const date of ["2027-07-18", "2026-12-07"]) for (const hh of ["06", "10", "14"]) {
  const u = `https://api.transitous.org/api/v1/plan?fromPlace=${a}&toPlace=${b}&time=${date}T${hh}:00:00Z&numItineraries=6`;
  try { const r = await fetch(u, { headers: { "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)" }, signal: AbortSignal.timeout(30000) }); const j = await r.json();
    console.log(`\n== ${n} ${date} from ${hh}Z: ${(j.itineraries || []).length}`);
    for (const it of j.itineraries || []) console.log("  " + Math.round(it.duration / 60) + " min: " + it.legs.filter(l => l.mode !== "WALK").map(l => `${l.mode} ${l.routeShortName || ""} (${l.agencyName || ""}) ${l.from.name} ${l.startTime.slice(11, 16)}Z > ${l.to.name} ${l.endTime.slice(11, 16)}Z`).join(" | "));
  } catch (e) { console.log(`== ${n} ${date} ${hh}: ${e.message}`); }
  await new Promise(r => setTimeout(r, 1200));
}
