// Ferry live check: opens the published site fresh (empty browser, so no saved rides), opens the sample trip's Naples
// port day with Sorrento and Pompeii picked, waits for the real rides, and prints each ride as the Day plan shows it
// and the options its Ride menu holds. Fails (exit 1) when the leg from the ship to Sorrento offers no ferry.
const { chromium } = require("playwright");
const URL = process.env.URL || "https://gilsonr0566-sys.github.io/Kairoute/";
(async () => {
  let bad = 0;
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on("pageerror", e => console.log("PAGE ERROR " + e.message));
  try {
    await p.goto(URL); await p.waitForFunction(() => window.__kairouteDays && window.__kairouteDay && window.__kairouteRideLegs, null, { timeout: 180000 });
    console.log("Version", await p.evaluate(() => fetch("version.txt", { cache: "no-store" }).then(r => r.text()).catch(() => "?")));
    const days = await p.evaluate(() => window.__kairouteDays()), d = days.find(x => /naples/i.test(x.dest + " " + x.city));
    if (!d) throw new Error("no Naples day in the sample trip");
    await p.evaluate(i => window.__kairouteDay(i, "Pompeii|^Sorrento"), d.i);
    for (let k = 0; k < 2; k++) { await p.evaluate(i => window.__kairouteGo("plan", i), d.i); await p.waitForTimeout(40000); }
    const rides = await p.$$eval(".tl.leg", els => els.map(e => e.innerText.replace(/\n+/g, " / ")));
    console.log("\n== Rides on the Day plan"); rides.forEach(r => console.log("   " + r.slice(0, 400)));
    const menus = await p.$$eval(".tl.leg select", els => els.map(s => [...s.options].map(o => o.textContent.trim()).join(" | ")));
    console.log("\n== Ride menus"); menus.forEach(m => console.log("   " + m.slice(0, 400)));
    const legs = await p.evaluate(i => window.__kairouteRideLegs(i), d.i);
    console.log("\n== Ride legs: " + JSON.stringify(legs).slice(0, 3000));
    const first = rides.find(r => /sorrento/i.test(r)) || "", firstMenu = menus.find(m => /ferry/i.test(m));
    const ok = /ferry/i.test(first) || !!firstMenu;
    console.log((ok ? "ok   " : "FAIL ") + "the ride from the ship to Sorrento offers the ferry" + (ok ? "" : ": " + first.slice(0, 200)));
    if (!ok) bad++;
  } catch (e) { console.log("CHECK ERROR " + e.message); bad++; }
  await b.close(); process.exit(bad ? 1 : 0);
})();
