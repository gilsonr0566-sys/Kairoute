// Flight lookup check: a flight number on an arrival or departure day fills the airport, the local time and the
// right airport buffers (passport control or not), a typed time wins over the schedule, and an unpublished
// flight keeps the traveler's time. The Worker's /flight answers are faked here; no outside calls.
// Run: node tools/flight-test.cjs
const { chromium } = require("playwright"), http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), fails = [];
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails.push(m); };
const ap = (iata, name, city, country, lat, lng, date, time) => ({ iata, name, city, country, lat, lng, date, time, terminal: "" });
const FLIGHTS = {
  A3611: [{ number: "A3 611", airline: "Aegean Airlines", dep: ap("JFK", "New York John F Kennedy", "New York", "US", 40.64, -73.78, "2027-06-29", "18:30"), arr: ap("ATH", "Athens Eleftherios Venizelos", "Athens", "GR", 37.936, 23.947, "2027-06-30", "09:55") }],
  IB3010: [{ number: "IB 3010", airline: "Iberia", dep: ap("MAD", "Adolfo Suárez Madrid–Barajas", "Madrid", "ES", 40.47, -3.56, "2027-07-20", "13:10"), arr: ap("BCN", "Barcelona El Prat", "Barcelona", "ES", 41.29, 2.07, "2027-07-20", "14:25") }],
  UA88: [{ number: "UA 88", airline: "United", dep: ap("MAD", "Adolfo Suárez Madrid–Barajas", "Madrid", "ES", 40.47, -3.56, "2027-07-20", "12:05"), arr: ap("EWR", "Newark Liberty", "Newark", "US", 40.69, -74.17, "2027-07-20", "14:50") }]
};
(async () => {
  const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split("?")[0]) === "/" ? "index.html" : decodeURIComponent(q.url.split("?")[0]));
    fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": f.endsWith(".html") ? "text/html" : "application/octet-stream" }); r.end(b); }); }).listen(0);
  const base = "http://localhost:" + srv.address().port + "/";
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { try { localStorage.setItem("kairoute.intro1", "1"); } catch (e) {} });
  await ctx.route(/cdnjs|fonts\.g|unpkg|jsdelivr|github\.io/, r => r.abort());
  await ctx.route(/ai\.json/, r => r.fulfill({ json: { url: "https://fake.workers.dev" } }));
  await ctx.route(/fake\.workers\.dev/, r => { const u = new URL(r.request().url());
    if (u.pathname === "/status") return r.fulfill({ json: { ok: true, left: 5000, budget: 8500 } });
    if (u.pathname === "/flight") { const legs = FLIGHTS[u.searchParams.get("no")]; return r.fulfill({ json: legs ? { state: "ok", source: "AeroDataBox", legs } : { state: "notyet" } }); }
    return r.fulfill({ status: 404, body: "" }); });
  const p = await ctx.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(base); await p.waitForTimeout(1500);
  const W = i => p.evaluate(i => __kairouteFlight.win(i), i);
  const type = async (sel, v) => { await p.fill(sel, v); await p.dispatchEvent(sel, "change"); await p.waitForTimeout(600); };
  const ai = await p.evaluate(() => __kairouteFlight.days().findIndex(d => d.type === "arrival" && d.mode === "flight"));
  const di = await p.evaluate(() => __kairouteFlight.days().findIndex(d => d.type === "departure" && d.mode === "flight"));
  ok(ai >= 0 && di >= 0, "sample trip has a flight arrival and departure");

  await p.evaluate(i => __kairouteFlight.go(i, "trip"), ai); await type("#f-flight", "a3 611");
  let w = await W(ai);
  ok(w.time === "09:55" && w.by === "flight", "arrival time comes from the schedule (" + w.time + ")");
  ok(/ATH/.test(w.point || ""), "arrival airport comes from the flight (" + w.point + ")");
  ok(w.start === "11:10", "international arrival allows 1 h 15 for passport and bags (out at " + w.start + ")");
  ok(/next day/.test(await p.textContent("#flightHint")), "hint shows the overnight flight");
  await type("#f-time", "11:00"); w = await W(ai);
  ok(w.time === "11:00" && /your time/.test(w.notes[0]), "a typed time wins and the day says so");

  await p.evaluate(i => __kairouteFlight.go(i, "trip"), di); await type("#f-flight", "IB3010"); w = await W(di);
  ok(w.time === "13:10" && w.endBy === "11:10", "domestic departure: at the airport 2 h early (sightseeing ends " + w.endBy + ")");
  await type("#f-flight", "UA 88"); w = await W(di);
  ok(w.time === "12:05" && w.endBy === "09:05", "international departure: 3 h early (ends " + w.endBy + ")");
  await type("#f-flight", "XX999"); w = await W(di);
  ok(w.time === "12:05" && /hasn't published/.test(await p.textContent("#flightHint")), "unpublished flight keeps the current time");
  ok(!errs.length, "no page errors " + errs.join("; "));
  await b.close(); srv.close();
  console.log(fails.length ? fails.length + " flight checks failed" : "All flight checks passed");
  process.exit(fails.length ? 1 : 0);
})();
