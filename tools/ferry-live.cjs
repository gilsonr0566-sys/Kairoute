// Ferry live check: opens the published site fresh (empty browser, so no saved rides), opens the sample trip's Naples
// port day with Sorrento and Pompeii picked, waits for the real rides, and prints each ride as the Day plan shows it
// and the options its Ride menu holds. Fails (exit 1) when the leg from the ship to Sorrento offers no ferry.
// Then the same on a phone that planned the trip earlier: every ride of the day is kept from an older version with no
// lines at all (as Richard's phone had, Nov 14: "Train or car", no ferry); the kept answers must be replaced.
const { chromium } = require("playwright");
async function naples(p, label) {
  await p.goto(URL); await p.waitForFunction(() => window.__kairouteDays && window.__kairouteDay && window.__kairouteRideLegs, null, { timeout: 180000 });
  const days = await p.evaluate(() => window.__kairouteDays()), d = days.find(x => /naples/i.test(x.dest + " " + x.city));
  if (!d) throw new Error("no Naples day in the sample trip");
  await p.evaluate(i => { window.__kairouteDay(i, "Pompeii|^Sorrento"); window.__kairouteEdit(i, { mine: window.__kairouteTruth(i).picks.slice() }); }, d.i); // ticked by the traveler, as Richard did
  for (let k = 0; k < 2; k++) { await p.evaluate(i => window.__kairouteGo("plan", i), d.i); await p.waitForTimeout(40000); }
  const rides = await p.$$eval(".tl.leg", els => els.map(e => e.innerText.replace(/\n+/g, " / ")));
  const menus = await p.$$eval(".tl.leg select", els => els.map(s => [...s.options].map(o => o.textContent.trim()).join(" | ")));
  const legs = await p.evaluate(i => window.__kairouteRideLegs(i), d.i);
  console.log("\n== " + label + ": rides"); rides.forEach(r => console.log("   " + r.slice(0, 300)));
  console.log("   menus: " + menus.map(m => m.slice(0, 200)).join(" || "));
  const first = rides.find(r => /sorrento/i.test(r)) || "", ok = /ferry/i.test(first) || menus.some(m => /ferry/i.test(m));
  console.log((ok ? "ok   " : "FAIL ") + label + ": the ride from the ship to Sorrento offers the ferry" + (ok ? "" : ": " + first.slice(0, 200)));
  return { ok, legs };
}
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
    await p.evaluate(i => { window.__kairouteDay(i, "Pompeii|^Sorrento"); window.__kairouteEdit(i, { mine: window.__kairouteTruth(i).picks.slice() }); }, d.i); // ticked by the traveler, as Richard did
    for (let k = 0; k < 2; k++) { await p.evaluate(i => window.__kairouteGo("plan", i), d.i); await p.waitForTimeout(40000); }
    const rides = await p.$$eval(".tl.leg", els => els.map(e => e.innerText.replace(/\n+/g, " / ")));
    console.log("\n== Rides on the Day plan"); rides.forEach(r => console.log("   " + r.slice(0, 400)));
    const menus = await p.$$eval(".tl.leg select", els => els.map(s => [...s.options].map(o => o.textContent.trim()).join(" | ")));
    console.log("\n== Ride menus"); menus.forEach(m => console.log("   " + m.slice(0, 400)));
    const legs = await p.evaluate(i => window.__kairouteRideLegs(i), d.i);
    console.log("\n== Stops: " + JSON.stringify(await p.evaluate(i => window.__kairouteTruth(i).stopNames, d.i)));
    console.log("\n== Ride legs: " + JSON.stringify(legs).slice(0, 3000));
    const first = rides.find(r => /sorrento/i.test(r)) || "", firstMenu = menus.find(m => /ferry/i.test(m));
    const ok = /ferry/i.test(first) || !!firstMenu;
    console.log((ok ? "ok   " : "FAIL ") + "the ride from the ship to Sorrento offers the ferry" + (ok ? "" : ": " + first.slice(0, 200)));
    if (!ok) bad++;
    // Change stops (Richard, Nov 14: "Change stops button isn't working now"): tap it on the Day plan; the stops list
    // must open with its sights, and no page error.
    { const errs = []; p.on("pageerror", e => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
      await p.evaluate(i => window.__kairouteGo("plan", i), d.i); await p.waitForTimeout(1500);
      const btn = await p.$('[data-goto="sites"]'); if (btn) { await btn.click(); await p.waitForTimeout(2500); }
      const v = await p.evaluate(() => ({ boxes: document.querySelectorAll('input[type=checkbox]').length, text: document.body.innerText.slice(0, 200).replace(/\n+/g, " / ") }));
      const okS = !!btn && v.boxes >= 5 && !errs.length;
      console.log((okS ? "ok   " : "FAIL ") + "Change stops opens the stops list (" + (btn ? v.boxes + " sights" : "no button") + ")" + (errs.length ? " page errors: " + errs.join(" || ") : "") + (okS ? "" : " :: " + v.text));
      if (!okS) bad++; }
    // A phone that planned the trip earlier: its kept answers are from an older version and hold no lines.
    const old = {}; for (const l of (legs.legs || [])) { old[l.key] = { opts: [], t: Date.now() - 60000 }; old[l.key.split("|")[0]] = { opts: [], t: Date.now() - 60000 }; }
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript(o => { try { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("kairoute.transit3", o); sessionStorage.setItem("seeded", "1"); } } catch (e) {} }, JSON.stringify(old));
    const p2 = await ctx.newPage(); p2.on("pageerror", e => console.log("PAGE ERROR " + e.message));
    const r2 = await naples(p2, "phone with old kept rides (" + Object.keys(old).length + " kept)");
    if (!r2.ok) bad++;
  } catch (e) { console.log("CHECK ERROR " + e.message); bad++; }
  await b.close(); process.exit(bad ? 1 : 0);
})();
