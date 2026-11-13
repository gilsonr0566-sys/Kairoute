// Faith talk live check: opens the published site's sample trip, turns the faith interests off, opens the Naples
// day (or DAY=regex) on the Day plan, the Guide and the Tour, waits for the walk-throughs to be written, and prints
// every text that talks about the Bible: which stop, which field and which screen. Always exits 0 (it reports).
const { chromium } = require("playwright");
const URL = process.env.URL || "https://gilsonr0566-sys.github.io/Kairoute/", DAY = new RegExp(process.env.DAY || "naples", "i"), BIBLE = /\b(gospels?|bible|biblical|scriptures?|apostles?|testament|evangelists?|st\.? paul|saint paul|paul's)\b|\b(acts|matthew|mark|luke|john|romans|corinthians|revelation)\s+\d+:\d+/i;
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on("pageerror", e => console.log("PAGE ERROR " + e.message));
  try {
    await p.goto(URL); await p.waitForFunction(() => window.__kairouteDays && window.__kairoutePrefs, null, { timeout: 30000 });
    console.log("Version", await p.evaluate(() => fetch("version.txt", { cache: "no-store" }).then(r => r.text()).catch(() => "?")));
    console.log("Prefs before", JSON.stringify(await p.evaluate(() => window.__kairoutePrefs({}))));
    console.log("Prefs now", JSON.stringify(await p.evaluate(() => { const i = window.__kairoutePrefs({}).interests.filter(x => x !== "bible" && x !== "churches"); return window.__kairoutePrefs({ interests: i, theme: "" }); })));
    const days = await p.evaluate(() => window.__kairouteDays()), d = days.find(x => DAY.test(x.dest + " " + x.city)) || days[0];
    console.log("Day", JSON.stringify(d));
    for (const v of ["plan", "guide", "tour"]) {
      await p.evaluate(([v, i]) => window.__kairouteGo(v, i), [v, d.i]);
      await p.waitForTimeout(v === "plan" ? 150000 : 8000); // the plan writes the walk-throughs
      const text = await p.evaluate(() => document.body.innerText), hits = text.split(/\n+/).filter(l => BIBLE.test(l));
      console.log(`\n== ${v}: ${hits.length} lines mention the Bible`); hits.slice(0, 20).forEach(l => console.log("   " + l.slice(0, 300)));
    }
    const scan = await p.evaluate(i => window.__kairouteFaithScan(i), d.i);
    console.log("\n== Stored text on " + scan.day + " " + scan.date + " (faith '" + scan.faith + "', theme '" + scan.theme + "')");
    (scan.hits || []).forEach(h => console.log(`   ${h.stop} / ${h.field}${h.bibleSite ? " (Bible site)" : ""}: ${h.text}`));
  } catch (e) { console.log("CHECK ERROR " + e.message); }
  await b.close();
})();
