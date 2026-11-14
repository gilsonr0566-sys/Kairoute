// One-off probe (Nov 14): what the helper answers for the Naples ship -> Sorrento ride, asked a few times, and which
// public pages list a cruise ship's port times (for filling a typed cruise day with real times).
const U = "https://kairoute-ai.rickgilson.workers.dev";
const pts = { beverello: [40.8378, 14.2546], marittima: [40.8383, 14.2555], sorrento: [40.626, 14.376], pompeii: [40.749, 14.485] };
for (let round = 0; round < 3; round++) {
  const pairs = [["beverello", "sorrento"], ["marittima", "sorrento"], ["sorrento", "pompeii"]];
  const t0 = Date.now();
  const r = await fetch(U + "/transit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pairs: pairs.map(([a, b]) => ({ a: pts[a], b: pts[b], dow: 1 })) }) }).then(r => r.json()).catch(e => ({ error: String(e) }));
  console.log(`ROUND ${round} ${Date.now() - t0} ms`);
  (r.results || [r]).forEach((x, i) => console.log("  " + pairs[i].join(">") + " partial=" + x.partial + " err=" + (x.error || "") + " :: " + (x.opts || []).map(o => `${o.mode}:${o.label}:${o.min}${o.months ? ":m" + o.months.join("/") : ""}`).join(" | ")));
  await new Promise(r => setTimeout(r, 20000));
}
const UA = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", "accept-language": "en" };
const pages = [
  "https://www.cruisemapper.com/ships/Sun-Princess-2273",
  "https://www.cruisemapper.com/ports/naples-port-30",
  "https://www.crew-center.com/sun-princess-cruise-ship-schedule-2027",
  "https://crew-center.com/naples-italy-cruise-ship-schedule-2027-july",
  "https://www.cruisetimetables.com/cruises-to-naples-italy-from-all-ports-2027.html",
  "https://www.cruisetimetables.com/sun-princess-cruise-schedule-2027.html",
  "https://www.portofnaples.com/en/cruise-schedule",
  "https://www.adsptirrenocentrale.it/",
  "https://www.princess.com/en-us/ships-and-experience/ships/su-sun-princess",
  "https://www.whatsinport.com/Naples.htm",
  "https://www.cruisedig.com/ships/sun-princess-2024/itineraries",
  "https://www.cruiseportinsider.com/naples-cruise-port-schedule"
];
for (const u of pages) {
  try { const r = await fetch(u, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(20000) }); const t = await r.text();
    const txt = t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const i = txt.search(/Jul(y)? 12|12 Jul|2027-07-12|12\.07\.2027|07\/12\/2027/i);
    console.log(`\nPAGE ${r.status} ${t.length}b ${r.url}\n  sun princess: ${/sun princess/i.test(txt)} | naples: ${/naples|napoli/i.test(txt)} | 2027: ${/2027/.test(txt)}\n  around Jul 12: ${i >= 0 ? txt.slice(Math.max(0, i - 200), i + 300) : "-"}\n  start: ${txt.slice(0, 300)}`);
  } catch (e) { console.log(`\nPAGE ERR ${u} ${e.message}`); }
}
