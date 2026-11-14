// Intake live check (Richard's Naples test, Nov 14): on the published site, with the real AI, type
// "I'm going on the Sun Princess to Naples on July 12, 2027. I want to go to Pompeii and Sorrento.", build the trip and
// its guide, open the Naples day and check: the ship is kept, the port times are marked estimated (none were given)
// with the ask for the booking on the Trip screen, Pompeii and Sorrento are picked, and the ride to Sorrento offers
// the ferry; then wait three minutes and check the ferry is still there and still selectable. Exit 1 on a problem.
const { chromium } = require("playwright");
const URL = process.env.URL || "https://gilsonr0566-sys.github.io/Kairoute/";
const TEXT = "I'm going on the Sun Princess to Naples on July 12, 2027. I want to go to Pompeii and Sorrento.";
(async () => {
  let bad = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) bad++; };
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on("pageerror", e => console.log("PAGE ERROR " + e.message));
  try {
    await p.goto(URL); await p.waitForFunction(() => window.__kairouteBuildTrip && window.__kairouteRideLegs, null, { timeout: 180000 });
    console.log("Version", await p.evaluate(() => fetch("version.txt", { cache: "no-store" }).then(r => r.text()).catch(() => "?")));
    await p.waitForFunction(() => window.__kairouteAiReady(), null, { timeout: 90000 });
    const t = await p.evaluate(x => window.__kairouteBuildTrip(x), TEXT);
    console.log("Trip: " + JSON.stringify(t));
    if (t.error) throw new Error("trip not built: " + t.error);
    ok(t.ship && /sun princess/i.test(t.ship.name), "the ship is kept (" + JSON.stringify(t.ship) + ")");
    ok(t.days.length === 1, "one day, as described (" + t.days.length + " days)");
    const d = t.days.find(x => /naples/i.test(x.dest) && (x.wants || []).length) || t.days.find(x => /naples/i.test(x.dest) && x.type === "port");
    ok(d && d.type === "port", "the Naples day is a port day (" + (d && d.type) + ")");
    ok(!!d, "a Naples port day on July 12 (" + t.days.map(x => x.date + " " + x.type + " " + x.dest).join(", ") + ")");
    if (!d) throw new Error("no Naples port day");
    ok(d.date === "2027-07-12", "on July 12, 2027 (" + d.date + ")");
    ok(d.estimated, `times not given, so marked estimated (${d.arrive} to ${d.aboard})`);
    ok(!t.days.some(x => /pompeii|sorrento/i.test(x.dest)), "Pompeii and Sorrento are not days of their own");
    await p.evaluate(() => window.__kairouteGo("trip", 0)).catch(() => {}); await p.waitForTimeout(1500);
    const banner = await p.evaluate(() => (document.querySelector(".banner.shiptimes") || {}).innerText || "");
    ok(/Ship times are estimated/.test(banner), "the Trip screen asks for the booking's ship times (" + banner.slice(0, 120) + ")");
    await p.evaluate(i => window.__kairouteGo("plan", i), d.i); await p.waitForTimeout(60000);
    await p.evaluate(i => window.__kairouteGo("plan", i), d.i); await p.waitForTimeout(30000);
    const look = async label => {
      const legs = await p.evaluate(i => window.__kairouteRideLegs(i), d.i);
      const rides = await p.$$eval(".tl.leg", els => els.map(e => e.innerText.replace(/\n+/g, " / ")));
      const menus = await p.$$eval(".tl.leg select", els => els.map(s => [...s.options].map(o => o.textContent.trim()).join(" | ")));
      const stops = await p.$$eval(".tl.stop h3, .tl.stop b, .tl .stopname", els => els.map(e => e.innerText.trim()).slice(0, 20)).catch(() => []);
      console.log(`\n== ${label}\n   legs: ${JSON.stringify(legs).slice(0, 1500)}\n   rides: ${rides.map(r => r.slice(0, 160)).join("\n          ")}\n   menus: ${menus.join(" || ")}`);
      const names = ((legs && legs.legs) || []).flatMap(l => [l.from, l.to]).join(" ");
      return { names, menus, rides, stops };
    };
    const r1 = await look("Naples day after it settles");
    ok(/pompeii/i.test(r1.names) && /sorrento/i.test(r1.names), "Pompeii and Sorrento are on the day plan");
    const ferry1 = r1.menus.some(m => /ferry/i.test(m)) || r1.rides.some(r => /ferry/i.test(r));
    ok(ferry1, "a ride to Sorrento offers the ferry");
    // Pick the ferry (Richard, Nov 14: picking it took Sorrento off and then the ferry was gone): every stop stays,
    // and whatever the plan does, the ferry stays in the menu. Then reload: the saved trip keeps all of it.
    const legs1 = await p.evaluate(i => window.__kairouteRideLegs(i), d.i), toS = ((legs1 && legs1.legs) || []).find(l => /sorrento/i.test(l.to));
    if (toS) { const id = await p.evaluate(([i, k]) => { const pl = window.__kairouteRideSwitch(i, k, null); return pl.choices.find(c => /^ferry/.test(c)) || null; }, [d.i, toS.key.split("|")[0]]);
      ok(!!id, "the ride to Sorrento has a ferry choice (" + id + ")");
      if (id) { const sw = await p.evaluate(([i, k, v]) => window.__kairouteRideSwitch(i, k, v), [d.i, toS.key.split("|")[0], id]);
        console.log("   after picking the ferry: " + JSON.stringify(sw));
        ok(sw.stops.some(n => /sorrento/i.test(n)) && sw.stops.some(n => /pompeii/i.test(n)), "picking the ferry keeps Sorrento and Pompeii (" + sw.stops.join(", ") + ")");
        ok(sw.choices.includes(id), "the ferry is still in the ride menu after picking it");
        await p.reload(); await p.waitForFunction(() => window.__kairouteRideLegs && window.__kairouteDays, null, { timeout: 180000 }); await p.evaluate(i => window.__kairouteGo("plan", i), d.i); await p.waitForTimeout(20000);
        const again = await p.evaluate(([i, k]) => window.__kairouteRideSwitch(i, k, null), [d.i, toS.key.split("|")[0]]).catch(e => ({ error: String(e) }));
        console.log("   saved trip after reload: " + JSON.stringify(again));
        ok(again.choices && again.choices.includes(id) && again.stops.some(n => /sorrento/i.test(n)), "after reopening the saved trip, Sorrento is there and the ferry is still offered"); } }
    else ok(false, "no ride to Sorrento on the day plan");
    await p.waitForTimeout(180000); await p.evaluate(i => window.__kairouteGo("plan", i), d.i); await p.waitForTimeout(5000);
    const r2 = await look("three minutes later");
    ok(r2.menus.some(m => /ferry/i.test(m)) || r2.rides.some(r => /ferry/i.test(r)), "three minutes later the ferry is still offered and selectable");
  } catch (e) { console.log("CHECK ERROR " + e.message); bad++; }
  await b.close(); process.exit(bad ? 1 : 0);
})();
