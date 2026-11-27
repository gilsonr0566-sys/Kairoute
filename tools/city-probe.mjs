// Prints what Kairoute's sources say about a city's best-known sights (no AI used): the fame list, the
// cross-checked sources list, and where the named places sit in each. Usage: CITY=Prague FIND="clock|orloj" node tools/city-probe.mjs
const U = "https://kairoute-ai.rickgilson.workers.dev", city = process.env.CITY || "Prague", find = new RegExp(process.env.FIND || "clock|orloj", "i");
const get = async p => { for (let i = 0; i < 3; i++) { try { const r = await fetch(U + p); if (r.ok) return await r.json(); console.log(p, "HTTP", r.status); } catch (e) { console.log(p, e.message); } await new Promise(r => setTimeout(r, 5000)); } return null; };
const f = await get("/famous?city=" + encodeURIComponent(city));
console.log("FAMOUS area=" + (f && f.area) + " main=" + (f && f.main.length));
(f && f.main || []).forEach((x, i) => console.log(` ${i + 1}. ${x.sl} ${x.name} ${x.wd} ${x.km}km${x.unesco ? " UNESCO" : x.heritage ? " heritage" : ""}${find.test(x.name) ? "   <== MATCH" : ""}`));
const s = await get("/sources?city=" + encodeURIComponent(city));
console.log("SOURCES stops=" + (s && s.stops.length) + " " + JSON.stringify(s && s.sources));
(s && s.stops || []).forEach((x, i) => console.log(` ${i + 1}. [${x.src.length}] ${x.sl} ${x.name}${x.local ? " / " + x.local : ""} ${x.wd || ""} ${x.lat},${x.lng} :: ${x.src.join("; ")}${find.test(x.name + " " + (x.local || "")) ? "   <== MATCH" : ""}`));
