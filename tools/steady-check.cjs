// A plan once shown stays the plan (Richard, Nov 17: "the moving around, disappearing, changes that cause them to
// come off already made plan"). The sample trip is opened and every day's plan is shown, as the traveler sees it.
// Then the same device opens the app again three ways, and every day must show exactly the same plan (same stops in
// the same order, same optional stops, same places to eat), and every pick must still be on its day:
//   1. a plain reload, with the internet;
//   2. a reload with no internet (the app's own files only);
//   3. a reload after a data refresh: the kept city guides, sources, kept sights and ride answers are thrown away, so
//      everything is fetched and merged again (new ids, merges, ratings and timetables arriving in another order).
// Run: URL=http://localhost:8765/ node tools/steady-check.cjs        (the publish gate runs it on the fresh build)
const { chromium } = require("playwright");
const URL = process.env.URL || "https://gilsonr0566-sys.github.io/Kairoute/";
const HOST = new globalThis.URL(URL).host;
let fails = 0; const fail = m => { fails++; console.log("FAIL " + m); }, log = m => console.log(m);

async function open(p) {
  p0 = p;
  await p.goto(URL, { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => window.__kairouteGo && window.__kairouteDays && document.querySelector("header.top"), null, { timeout: 90000 });
  await p.waitForTimeout(800);
  const sample = p.locator('[data-act="loadsample"]').first(), cont = p.locator('[data-act="continue"]').first();
  if (await sample.isVisible().catch(() => false)) await sample.click(); else if (await cont.isVisible().catch(() => false)) await cont.click();
  await p.waitForTimeout(1000);
}
// Every day's plan as the Day plan shows it, after opening each day (that is what makes a plan "shown").
const snap = (p, base) => p.evaluate(base => {
  const out = {};
  for (const d of window.__kairouteDays()) {
    if (!d.city || d.type === "sea") continue;
    window.__kairouteAt(d.i, "plan");
    const r = window.__kairouteRoute(d.i) || [];
    // The sights and meals in order, each with its spot: a fuller guide can name the same sight another way ("Temple of
    // Artemis (Artemis Tapınağı)") or move the cruise terminal's map point; the same place is the same stop.
    const items = r.filter(x => x.type === "stop" || x.type === "meal").map(x => ({ t: x.type, n: x.name, lat: x.lat, lng: x.lng }));
    out[d.i] = { dest: d.dest, items, plan: r.filter(x => x.type !== "travel").map(x => (x.type === "meal" ? "meal:" : x.bonus ? "+" : "") + x.name).join(" > "), picks: window.__kairouteSteady(d.i, base && base[d.i] ? base[d.i].picks.sel : null) };
  }
  return out;
}, base || null);
// Waits until the app has stopped fetching and planning (or 90 s), then takes the snapshot twice until it holds.
async function settled(p, base) {
  const t0 = Date.now(); let last = null, same = 0;
  while (Date.now() - t0 < 90000) {
    await p.waitForTimeout(3000);
    const busy = await p.evaluate(() => !(window.__kairouteSettled && window.__kairouteSettled()) || !!(window.__kairouteSteadyBusy && window.__kairouteSteadyBusy()));
    const s = JSON.stringify(await snap(p, base));
    if (!busy && s === last && ++same >= 1) return JSON.parse(s);
    if (s !== last) same = 0; last = s;
  }
  return JSON.parse(last);
}
let p0 = null;
const allBreaks = [];
const DBG = process.env.DBG_DAY; // a day id (seen store key) to follow through the phases
async function seenTrace(p, tag) { if (!DBG) return; const r = await p.evaluate(() => { const f = j => { try { return JSON.parse(j || "{}"); } catch (e) { return {}; } };
  const key = Object.keys(localStorage).find(x => x.startsWith("kairoute.seen.")), A = f(window.__seenAtStart), B = f(key ? localStorage.getItem(key) : ""), nm = e => e ? e.lock.seq.map(x => x.meal ? "meal:" + ((x.node || {}).name || "") : x.n).join(" > ") : "(none)";
  return Object.keys(Object.assign({}, A, B)).filter(k => JSON.stringify(A[k]) !== JSON.stringify(B[k])).map(k => k + (nm(A[k]) === nm(B[k]) ? " (same stops)" : ": " + nm(A[k]) + "  ==>  " + nm(B[k]))); }).catch(e => [e.message]);
  log(`     [${tag}] remembered plans changed on this page: ${r.length ? "\n       " + r.join("\n       ") : "none"}`); }
async function done(p) { await seenTrace(p, "closing"); const br = await p.evaluate(() => window.__kairouteSeen.breaks()).catch(() => []); br.forEach(x => allBreaks.push(x)); await p.close(); }
async function compare(a, b, how) {
  let n = 0;
  for (const i of Object.keys(a)) {
    const x = a[i], y = b[i];
    if (!y) { fail(`${how}: day ${+i + 1} ${x.dest} has no plan`); n++; continue; }
    // An optional stop the remembered plan had may be left out only when the app says why (it is now part of a stop
    // planned on another day, or closed that day); everything else must be exactly as shown.
    const left = new Set((y.picks.skipped || []).map(o => o.n)), xi = x.items.filter(o => !left.has(o.n));
    const same = xi.length === y.items.length && (await p0.evaluate(([a, b]) => a.every((o, j) => { const q = b[j]; if (o.t !== q.t) return false; if (o.n === q.n) return true;
      if (o.t !== "stop") return false; const r = window.__kairoutePlaceRel(o, q); return r[0] === "same" || r[1] === "same"; }), [xi, y.items]));
    if (same && left.size) log(`     ${how}: day ${+i + 1} ${x.dest}: optional stop left out with a reason: ${y.picks.skipped.map(o => o.n + " (" + o.why + ")").join(", ")}`);
    else if (!same) { fail(`${how}: day ${+i + 1} ${x.dest} plan changed (${y.picks.seen ? "replayed" : "planned afresh"}${y.picks.why ? ": " + y.picks.why : ""})\n  first visit: ${x.picks.seen ? "replayed" : "planned afresh"}${x.picks.why ? " (" + x.picks.why + ")" : ""}, remembered then: ${x.picks.kept}${x.picks.skip ? " [not kept: " + x.picks.skip + "]" : ""}\n  remembered now: ${y.picks.kept}\n  was: ${x.plan}\n  now: ${y.plan}`); n++; }
    const gone = y.picks.gone;
    if (gone.length) { fail(`${how}: day ${+i + 1} ${x.dest}: picks taken off without a note: ${gone.join(", ")}`); n++; }
    if (y.picks.missing.length) { fail(`${how}: day ${+i + 1} ${x.dest}: picks not on the day and not explained: ${y.picks.missing.join(", ")}`); n++; }
  }
  if (n && p0) { const br = allBreaks.concat(await p0.evaluate(() => window.__kairouteSeen.breaks()).catch(() => [])); if (br.length) log("     replays that didn't hold (so far): " + br.join(" | ")); }
  if (!n) log(`ok   ${how}: all ${Object.keys(a).length} days show the same plan (${Object.values(b).filter(y => y.picks.seen).length} replayed as shown)`);
}

(async () => {
  const b = await chromium.launch(process.env.PROXY ? { proxy: { server: process.env.PROXY, bypass: "localhost,127.0.0.1" } } : {}); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block", ignoreHTTPSErrors: !!process.env.PROXY }); // no cached answers: what's on the device is the app's own store
  await ctx.addInitScript(() => { try { localStorage.setItem("kairoute.intro1", "1"); } catch (e) {}
    try { const k = Object.keys(localStorage).find(x => x.startsWith("kairoute.seen.")); window.__seenAtStart = k ? localStorage.getItem(k) : ""; } catch (e) {} });
  // REPLAY=file.json.gz: internet answers from a recording (tools/freeze-probe.cjs --record), the same on every run.
  if (process.env.REPLAY) { const zlib = require("zlib"), fs = require("fs"), crypto = require("crypto");
    const key = (m, u, pd) => m + " " + u + (pd ? " " + crypto.createHash("md5").update(pd).digest("hex") : "");
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(process.env.REPLAY)).toString()), byKey = new Map(), byPath = new Map();
    rows.forEach(r => { byKey.set(r.k, r); const pk = r.m + " " + r.u.split("?")[0]; if (!byPath.has(pk)) byPath.set(pk, r); });
    await ctx.route(u => u.host !== HOST, async rt => { const q = rt.request(), u = q.url();
      const r = byKey.get(key(q.method(), u, q.postData())) || (q.method() === "GET" ? byPath.get("GET " + u.split("?")[0]) : null);
      if (!r) return rt.abort();
      await new Promise(z => setTimeout(z, Math.min(r.t || 100, 2000)));
      rt.fulfill({ status: r.s, headers: { "content-type": r.ct || "application/json", "access-control-allow-origin": "*" }, body: Buffer.from(r.b, "base64") }).catch(() => {}); });
    log(`     replaying ${rows.length} recorded internet answers`); }
  // No AI, ever (Richard, Nov 17: "Turn it totally off and do not use any without my consent"): the app never finds
  // the AI helper here, so no guide is written or voiced during this check. A recording (REPLAY) is not an AI call.
  await ctx.route(u => /\/ai\.json$/.test(u.pathname) || /workers\.dev$/.test(u.host), rt => rt.abort());
  // 0. First visit: every day's plan is shown once.
  let p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await open(p); const s0 = await settled(p);
  const kept = await p.evaluate(() => window.__kairouteSeen.keepAll());
  { const s1 = await snap(p); for (const i of Object.keys(s0)) if (s1[i]) s0[i].picks = s1[i].picks; } // what was remembered, for the reports
  log(`     ${Object.keys(s0).length} city days shown, ${kept} plans remembered`);
  if (!Object.keys(s0).length) fail("the sample trip has no city days");
  for (const i of Object.keys(s0)) if (s0[i].picks.missing.length) fail(`first visit: day ${+i + 1} ${s0[i].dest}: picks not on the day and not explained: ${s0[i].picks.missing.join(", ")}`);
  await p.waitForTimeout(800); await done(p);
  // 1. Plain reload.
  p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await open(p); await compare(s0, await settled(p, s0), "reload"); await done(p);
  // 2. No internet: only the app's own files load; the device says it is offline.
  p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await p.addInitScript(() => { try { Object.defineProperty(Navigator.prototype, "onLine", { get: () => false, configurable: true }); } catch (e) {} });
  await p.route("**/*", r => { try { return new globalThis.URL(r.request().url()).host === HOST ? r.continue() : r.abort(); } catch (e) { return r.abort(); } });
  await open(p); await compare(s0, await settled(p, s0), "offline reload"); await done(p);
  // 3. Data refresh: kept guides, sources, kept sights and ride answers are gone; the trip and its plans stay.
  p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await open(p);
  await p.evaluate(async () => {
    // Fetched data only (city guides, ride answers, weather, crowds, opening-hours checks): the trip, settings and the
    // app's own one-time marks stay, as they do when a phone's cached answers expire.
    for (const k of Object.keys(localStorage)) if (/^(wayside\.cities|kairoute\.(transit|wx\.|busy\.|crowd\.|fareats|grat|tz))/.test(k)) localStorage.removeItem(k);
    await new Promise(res => { const r = indexedDB.deleteDatabase("kairoute-audio"); r.onsuccess = r.onerror = r.onblocked = () => res(); setTimeout(res, 3000); });
  });
  await done(p);
  p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await open(p); await compare(s0, await settled(p, s0), "reload after a data refresh");
  // 4. New data arriving while the app is open, made the same on every machine: quick trains between every two places
  // of each day (timetables arriving), and a second copy of a picked sight that wins the merge, so the sight that
  // stays carries the other copy's id (how the Acropolis left a day). Every day must still show the same plan.
  const twin = await p.evaluate(() => {
    const km = (a, c) => Math.hypot((a.lat - c.lat) * 111, (a.lng - c.lng) * 85), prs = [];
    for (const d of window.__kairouteDays()) { if (!d.city || d.type === "sea") continue;
      const pts = (window.__kairouteRoute(d.i) || []).filter(x => x.type !== "travel" && isFinite(x.lat) && isFinite(x.lng)).map(x => ({ lat: +x.lat, lng: +x.lng }));
      for (const a of pts) for (const c of pts) if (a !== c && km(a, c) > 1.5) prs.push({ a, b: c, opts: [{ mode: "train", kind: "Train", label: "Test line", operator: "", from: "", to: "", ride: 4, wait: 3, every: 10, everySrc: "timetable",
        access: { how: "walk", min: 2, km: 0.1 }, egress: { how: "walk", min: 2, km: 0.1 }, min: 9, km: km(a, c), stops: 0, hours: "", path: [[a.lng, a.lat], [c.lng, c.lat]] }] }); }
    window.__kairouteTransitSet(prs);
    const d = window.__kairouteDays().find(x => /athens/i.test(x.dest) && window.__kairouteSteady(x.i).sel.length);
    if (!d) return null; const id = window.__kairouteSteady(d.i).sel[0]; return Object.assign({ day: d.i, id }, window.__kairouteOff.twin(d.i, id));
  });
  log(`     new data: quick trains on every day; a second copy of a pick on day ${twin ? twin.day + 1 : "?"} (${twin ? JSON.stringify(twin.kept) : "none"})`);
  if (!twin || twin.error) fail("couldn't add a second copy of a picked sight: " + JSON.stringify(twin));
  await compare(s0, await settled(p, s0), "new rides and a merged sight while open");
  // Proof the check tests something: with the remembered plans forgotten, the same data changes at least one day.
  await p.evaluate(() => window.__kairouteSeen.clear()); const fresh = await snap(p, s0);
  const differ = Object.keys(s0).filter(i => fresh[i] && fresh[i].plan !== s0[i].plan).length;
  if (!differ) fail("planned afresh, the new data changed no day, so this check proved nothing"); else log(`     planned afresh from the same data, ${differ} of ${Object.keys(s0).length} days would differ`);
  await done(p);
  if (errs.length) fail(`${errs.length} page error(s): ${errs[0].slice(0, 200)}`);
  await b.close();
  console.log(fails ? `Steady-plan check: ${fails} problem(s)` : "Steady-plan check passed (reload, offline and data refresh: every day's plan the same)");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log("FAIL " + e.message); process.exit(1); });
