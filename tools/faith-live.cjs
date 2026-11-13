// Faith talk live check: opens the published site's sample trip, turns the faith interests off, opens the Naples
// day (or DAY=regex) on the Day plan, the Guide and the Tour, waits for the walk-throughs to be written, and prints
// every text that talks about the Bible: which stop, which field and which screen. Always exits 0 (it reports).
const { chromium } = require("playwright");
const URL = process.env.URL || "https://gilsonr0566-sys.github.io/Kairoute/", DAY = new RegExp(process.env.DAY || "naples", "i"), BIBLE = /\b(gospels?|bible|biblical|scriptures?|apostles?|testament|evangelists?|st\.? paul|saint paul|paul's)\b|\b(acts|matthew|mark|luke|john|romans|corinthians|revelation)\s+\d+:\d+/i;
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on("pageerror", e => console.log("PAGE ERROR " + e.message));
  // Every request the page makes for rides: when it went, what came back and how long it took.
  const sent = new Map();
  p.on("request", r => { if (/\/transit\b/.test(r.url())) { sent.set(r, Date.now()); console.log(`-> ${r.method()} ${r.url()} ${(r.postData() || "").slice(0, 160)}`); } });
  p.on("requestfinished", async r => { if (sent.has(r)) { const res = await r.response(); const body = res ? (await res.text().catch(() => "")).slice(0, 200) : ""; console.log(`<- ${res && res.status()} in ${((Date.now() - sent.get(r)) / 1000).toFixed(1)} s: ${body}`); } });
  p.on("requestfailed", r => { if (sent.has(r)) console.log(`<- FAILED after ${((Date.now() - sent.get(r)) / 1000).toFixed(1)} s: ${r.failure() && r.failure().errorText}`); });
  try {
    await p.goto(URL); await p.waitForFunction(() => window.__kairouteDays && window.__kairoutePrefs, null, { timeout: 120000 }); // waits out the short "updating" page
    console.log("Version", await p.evaluate(() => fetch("version.txt", { cache: "no-store" }).then(r => r.text()).catch(() => "?")));
    console.log("Prefs before", JSON.stringify(await p.evaluate(() => window.__kairoutePrefs({}))));
    console.log("Prefs now", JSON.stringify(await p.evaluate(() => { const i = window.__kairoutePrefs({}).interests.filter(x => x !== "bible" && x !== "churches"); return window.__kairoutePrefs({ interests: i, theme: "" }); })));
    const days = await p.evaluate(() => window.__kairouteDays()), d = days.find(x => DAY.test(x.dest + " " + x.city)) || days[0];
    console.log("Day", JSON.stringify(d));
    console.log("Helper", JSON.stringify(await p.evaluate(() => fetch("ai.json", { cache: "no-store" }).then(r => r.json()).catch(e => String(e)))));
    for (const v of ["plan", "guide", "tour"]) {
      await p.evaluate(([v, i]) => window.__kairouteGo(v, i), [v, d.i]);
      await p.waitForTimeout(v === "plan" ? 150000 : 8000); // the plan writes the walk-throughs
      const text = await p.evaluate(() => document.body.innerText), hits = text.split(/\n+/).filter(l => BIBLE.test(l));
      console.log(`\n== ${v}: ${hits.length} lines mention the Bible`); hits.slice(0, 20).forEach(l => console.log("   " + l.slice(0, 300)));
    }
    // The rides on this day as the Day plan shows them (real transport from the helper's /transit).
    await p.evaluate(([i]) => window.__kairouteDay(i, "Pompeii|^Sorrento"), [d.i]); await p.evaluate(([v, i]) => window.__kairouteGo(v, i), ["plan", d.i]); await p.waitForTimeout(45000);
    await p.evaluate(([v, i]) => window.__kairouteGo(v, i), ["plan", d.i]); await p.waitForTimeout(1500);
    const rides = await p.$$eval(".tl.leg", els => els.map(e => e.innerText.replace(/\n+/g, " / ")));
    console.log("\n== Rides on the Day plan (Pompeii and Sorrento picked)"); rides.forEach(r => console.log("   " + r.slice(0, 600)));
    const scan = await p.evaluate(i => window.__kairouteFaithScan(i), d.i);
    console.log("\n== Stored text on " + scan.day + " " + scan.date + " (faith '" + scan.faith + "', theme '" + scan.theme + "')");
    (scan.hits || []).forEach(h => console.log(`   ${h.stop} / ${h.field}${h.bibleSite ? " (Bible site)" : ""}: ${h.text}`));
  } catch (e) { console.log("CHECK ERROR " + e.message); }
  await b.close();
})();
