// Demo flow (Richard's planning session, Nov 20 2026): run what a traveler does with the real Greece trip on the
// LIVE site, with the real AI and outside services, at phone and tablet sizes, and log every failure.
//   Part A (the trip they will show): open the Sun Princess trip, then for every day open the Day plan and check it
//     has stops (unless the day is at sea or aboard), no page errors, no freezes; edit stops on Change stops and see
//     the plan follow; on the Naples day pick the ferry (if offered) and check Sorrento stays; open Guide and Tour;
//     same screens at phone and upright-tablet size; then Download for offline, cut the internet, reload and check
//     every day plan comes back the same.
//   Part B (making a new trip): New trip -> type the trip in words -> Build my trip. Check the ship is kept, the
//     Athens days and every port day land on the right dates, ship times are filled (estimated, with the ask for the
//     booking's times), the named places are on their days. Then the same with the photo of the cruise itinerary
//     (tools/fixtures/sun-princess-2027-itinerary.jpg): every port's arrive / all-aboard time must match the photo.
// Writes checks/demo/report.md, report.json and screenshots. Exit 1 on any FAIL.
// Usage: node tools/demo-flow.cjs        (PARTS=A or PARTS=B to run one part; URL=... for another site)
const { chromium } = require("playwright"); const fs = require("fs"); const path = require("path");
const URL = process.env.URL || "https://gilsonr0566-sys.github.io/Kairoute/";
const PARTS = process.env.PARTS || "AB";
// GATE=1: the pre-publish run in pages.yml, against the freshly built site served locally (real internet). Skips the
// slow parts that have their own publish checks (offline download: offline-e2e.cjs) and the minute-long ferry wait.
const GATE = !!process.env.GATE;
// Sights the Change stops list must offer for the demo trip (a benchmark the sources must meet, never copied into
// the app). hard = blocks a publish; soft = logged as a warning until the guide has it.
const PICKER = [[/athens/i, [/acropolis/i, /corinth/i], []], [/naples/i, [/pompeii/i, /sorrento/i, /capri/i], [/amalfi|positano/i]],
  [/rome|civitavecchia/i, [/colosseum/i, /vatican|st\.? peter/i], []], [/barcelona/i, [/sagrada/i], []], [/kusadasi|ephesus/i, [/ephesus/i], []]];
const OUT = path.join(__dirname, "..", "checks", "demo"); fs.mkdirSync(OUT, { recursive: true });
const SIZES = { tablet: { width: 1280, height: 800 }, upright: { width: 800, height: 1280 }, phone: { width: 412, height: 915 } };
const FREEZE_MS = 1500, SLOW_MS = 600;
const TEXT = "We fly into Athens on June 30, 2027 and stay 4 nights. In Athens we want the Acropolis, Mars Hill and a day trip to Ancient Corinth. " +
  "On July 4 we board the Sun Princess in Piraeus for 11 nights: Heraklion, Ephesus, Santorini, Mykonos, Chania, a sea day, Messina, Naples, Rome (Civitavecchia), a sea day, and we get off in Barcelona on July 15. " +
  "In Naples we want Pompeii and Sorrento.";
const PHOTO = path.join(__dirname, "fixtures", "sun-princess-2027-itinerary.jpg");
// The published itinerary in the photo (date: [port words, arrive, all aboard/depart]).
const PORTS = { "2027-07-05": [/heraklion|crete/i, "07:00", "17:00"], "2027-07-06": [/kusadasi|ephesus/i, "09:00", "19:00"], "2027-07-07": [/santorini/i, "07:00", "21:00"],
  "2027-07-08": [/mykonos/i, "08:00", "21:00"], "2027-07-09": [/chania|crete/i, "08:00", "18:00"], "2027-07-11": [/messina|sicily/i, "08:00", "18:00"],
  "2027-07-12": [/naples/i, "07:00", "19:00"], "2027-07-13": [/rome|civitavecchia/i, "07:00", "21:00"] };
const SEA = ["2027-07-10", "2027-07-14"];

const lines = [], report = { url: URL, started: new Date().toISOString(), fails: [], warns: [], timings: {} };
const log = m => { console.log(m); lines.push(m); };
const ok = (c, m, warnOnly) => { if (c) log("ok   " + m); else if (warnOnly) { log("WARN " + m); report.warns.push(m); } else { log("FAIL " + m); report.fails.push(m); } return c; };
const sec = t0 => Math.round((Date.now() - t0) / 1000);

async function newCtx(b, size) {
  const ctx = await b.newContext({ viewport: SIZES[size], deviceScaleFactor: 1, hasTouch: size === "phone", isMobile: size === "phone" });
  await ctx.addInitScript(() => {
    try { localStorage.setItem("kairoute.intro1", "1"); } catch (e) {}
    window.__lt = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(e.duration))).observe({ type: "longtask", buffered: true }); } catch (e) {}
    // Phones and tablets have voices on the device; a test browser has none. Offer one so "Download for offline"
    // uses the device voice like the traveler's tablet does, and the natural voice allowance is not spent by tests.
    try { const v = [{ name: "Test English", lang: "en-US", localService: true, default: true, voiceURI: "test" }]; speechSynthesis.getVoices = () => v; } catch (e) {}
  });
  return ctx;
}
function watch(p, tag) {
  const errs = []; p.on("pageerror", e => { errs.push(e.message); log(`PAGE ERROR (${tag}) ${e.message}`); });
  p.on("dialog", d => d.dismiss().catch(() => {})); return errs;
}
// Opens the app. Right after a push the site shows GitHub's "Kairoute is updating" placeholder for some minutes
// (see kairoute-publishing): wait for the real app (up to 25 min) instead of failing.
async function open(p) {
  const t0 = Date.now();
  for (let n = 0; ; n++) {
    await p.goto(URL, { waitUntil: "domcontentloaded" }).catch(() => {});
    const up = await p.waitForFunction(() => window.__kairouteGo && window.__kairouteDays && document.querySelector("header.top"), null, { timeout: 60000 }).then(() => true).catch(() => false);
    if (up) break;
    const ph = await p.evaluate(() => !!document.querySelector('meta[name="kairoute-placeholder"]')).catch(() => false);
    if (Date.now() - t0 > 1500000) throw new Error(ph ? "the site still showed the updating placeholder after 25 minutes" : "the app did not open");
    if (!n) log(`     ${ph ? "the site is updating (placeholder)" : "the app did not open yet"}, waiting...`);
    await p.waitForTimeout(30000);
  }
  await p.waitForTimeout(1500);
}
// Time one screen change: the synchronous render, plus the longest main-thread block in the next few seconds.
async function timed(p, label, fn, settle = 4000) {
  await p.evaluate(() => { window.__lt = []; });
  const t0 = Date.now(); const ms = await p.evaluate(fn); const wall = Date.now() - t0;
  await p.waitForTimeout(settle);
  const lt = await p.evaluate(() => Math.round(Math.max(0, ...window.__lt)));
  const worst = Math.max(ms || 0, lt); (report.timings[label] = report.timings[label] || []).push({ render: Math.round(ms || 0), longest: lt, wall });
  if (worst >= FREEZE_MS) ok(false, `${label}: the app froze for ${(worst / 1000).toFixed(1)} s (render ${Math.round(ms)} ms, longest block ${lt} ms)`);
  else if (worst >= SLOW_MS) ok(false, `${label}: slow, ${worst} ms block (render ${Math.round(ms)} ms, longest ${lt} ms)`, true);
  return worst;
}
const go = (v, i) => `(() => { const t = performance.now(); window.__kairouteGo(${JSON.stringify(v)}, ${i}); return performance.now() - t; })()`;
// What the traveler sees on the Day plan: numbered stops, optional stops, meals, rides and their menus.
const seen = p => p.evaluate(() => {
  const rows = [...document.querySelectorAll(".tl")];
  const nm = r => ((r.querySelector(".nm") || {}).innerText || "").trim();
  return {
    stops: rows.filter(r => { const d = r.querySelector(".rail .dot"); return d && d.className.trim() === "dot"; }).map(nm),
    optional: rows.filter(r => r.classList.contains("optional")).map(nm),
    meals: rows.filter(r => r.querySelector(".dot.meal")).map(nm),
    rides: [...document.querySelectorAll("select[data-ride]")].map(s => ({ key: s.dataset.ride, chosen: s.options[s.selectedIndex] ? s.options[s.selectedIndex].textContent.trim() : "", opts: [...s.options].map(o => o.textContent.trim()) })),
    text: (document.querySelector("main") || document.body).innerText.slice(0, 4000)
  };
});
const shot = (p, name) => p.screenshot({ path: path.join(OUT, name + ".png") }).catch(() => {});

async function partA(b) {
  log("\n=== Part A: the Sun Princess trip on the live site ===");
  const ctx = await newCtx(b, "tablet"), p = await ctx.newPage(), errs = watch(p, "tablet");
  let t0 = Date.now(); await open(p); report.timings.firstOpen = sec(t0);
  ok(report.timings.firstOpen < 20, `the app opens (${report.timings.firstOpen} s)`, true);
  log("Version " + await p.evaluate(() => fetch("version.txt", { cache: "no-store" }).then(r => r.text()).catch(() => "?")));
  await shot(p, "A0-lobby-tablet");
  // The lobby's "Open your Sun Princess trip" button, as the traveler taps it.
  const sample = p.locator('[data-act="loadsample"]').first();
  const cont0 = p.locator('[data-act="continue"]').first();
  if (await sample.isVisible().catch(() => false)) await sample.click(); else if (await cont0.isVisible().catch(() => false)) await cont0.click();
  const S = () => p.evaluate(() => window.__kairouteState());
  if (!ok(await p.evaluate(() => !!window.__kairouteState), "the live site has the demo-flow test hook")) throw new Error("live site is older than the demo-flow hook");
  ok((await S()).days.some(d => d.date === "2027-07-12" && /naples/i.test(d.dest)), "the Sun Princess trip is open");
  await p.waitForTimeout(2000);
  const days = await p.evaluate(() => window.__kairouteDays());
  log("Days: " + days.map(d => `${d.i}:${d.date} ${d.type} ${d.dest}${d.city ? "" : " (no guide yet)"}`).join(" | "));
  ok(days.length >= 15, `the trip has its ${days.length} days`);
  // Wait for city guides that are not on this device yet (they come from the shared cache).
  t0 = Date.now();
  for (;;) { const miss = await p.evaluate(() => window.__kairouteDays().filter(d => d.type !== "sea" && !d.city).map(d => d.dest)); if (!miss.length || Date.now() - t0 > 600000) { ok(!miss.length, "every place has its city guide" + (miss.length ? " (missing after 10 min: " + [...new Set(miss)].join(", ") + ")" : ` (${sec(t0)} s)`)); break; } await p.waitForTimeout(5000); }

  // 1. Every day's plan.
  const plans = {};
  for (const d of days) {
    await timed(p, "open Day plan", go("plan", d.i), 6000);
    let s = await seen(p);
    if (!s.stops.length && d.type !== "sea") { await p.waitForTimeout(8000); s = await seen(p); } // restaurants / rides still arriving
    plans[d.i] = s;
    const aboard = (await S()).days[d.i].stayAboard;
    const needs = d.type !== "sea" && !aboard && d.type !== "departure";
    log(`     day ${d.i + 1} ${d.date} ${d.dest}: ${s.stops.length} stops [${s.stops.join("; ")}]${s.optional.length ? ", optional: " + s.optional.join("; ") : ""}, ${s.meals.length} meals, rides: ${s.rides.map(r => r.chosen).join(" / ") || "none to choose"}`);
    if (needs) ok(s.stops.length > 0, `day ${d.i + 1} ${d.dest} (${d.date}, ${d.type}) has stops on its Day plan`, d.type === "embark");
    if (/something went wrong|undefined|NaN|\[object/i.test(s.text)) ok(false, `day ${d.i + 1} ${d.dest}: broken text on the Day plan: ` + (s.text.match(/.{0,60}(something went wrong|undefined|NaN|\[object).{0,60}/i) || [""])[0]);
    if (d.type === "port") {
      const pinned = await p.evaluate(() => (document.querySelector(".dayhead") || {}).innerText || "");
      ok(/leave by|back on board|all aboard|aboard/i.test(pinned + s.text), `day ${d.i + 1} ${d.dest}: the back-on-board time is shown`);
    }
  }
  const first = days.find(d => d.type === "arrival") || days[0];
  await p.evaluate(go("plan", first.i)); await p.waitForTimeout(3000); await shot(p, "A1-dayplan-athens-tablet");
  // Named highlights of the real trip (the day plans together, not one day).
  const all = Object.values(plans).flatMap(s => s.stops.concat(s.optional)).join(" | ");
  for (const [re, nm] of [[/acropolis|parthenon/i, "the Acropolis"], [/pompeii/i, "Pompeii"], [/colosseum|vatican|st\.? peter/i, "Rome's Colosseum or Vatican"], [/sagrada/i, "the Sagrada Familia"], [/ephesus/i, "Ephesus"]])
    ok(re.test(all), `${nm} is planned somewhere on the trip`, GATE);

  // 1b. Change stops offers every sight in the day's guide (nothing hidden), and the demo trip's must-offer sights.
  const doneCity = new Set(), guides = await p.evaluate(() => window.__kairouteSights());
  for (const d of days) {
    if (d.type === "sea" || !d.city || doneCity.has(d.city)) continue; doneCity.add(d.city);
    await timed(p, "open Change stops", go("sites", d.i), 2500);
    const shown = await p.evaluate(() => [...document.querySelectorAll("[data-card]")].map(e => ((e.querySelector(".name") || {}).textContent || "").trim()));
    const g = guides[d.dest] || {}; const inGuide = (g.sites || []).map(x => x.replace(/ \[quick\]$/, "")).concat(g.farther || []);
    const missing = inGuide.filter(n => !shown.some(x => x === n));
    ok(!missing.length, `Change stops for ${d.dest} offers every sight in its guide (${shown.length} shown${missing.length ? "; missing: " + missing.join(", ") : ""})`);
    const all = shown.join(" | ");
    for (const [city, hard, soft] of PICKER) if (city.test(d.dest)) {
      for (const re of hard) ok(re.test(all), `Change stops for ${d.dest} offers ${re.source.replace(/\\/g, "")}`);
      for (const re of soft) ok(re.test(all), `Change stops for ${d.dest} offers ${re.source.replace(/\\/g, "")}`, true);
    }
  }
  if (!GATE) for (const [city, hard] of PICKER) if (!days.some(d => city.test(d.dest))) ok(false, `the demo trip has a ${city.source} day`);

  // 2. Change stops: tick a sight, see it on the Day plan, untick it.
  const ed = days.find(d => d.type === "land") || first;
  await timed(p, "open Change stops", go("sites", ed.i), 3000); await shot(p, "A2-change-stops-tablet");
  const pick = await p.evaluate(() => { const el = [...document.querySelectorAll("label.site:not(.on) input[data-site]")][0]; if (!el) return null; const name = ((el.closest("label").querySelector(".name, h3, b") || {}).innerText || "").trim(); return { id: el.dataset.site, name }; });
  if (ok(!!pick, `Change stops lists sights to add on day ${ed.i + 1}`)) {
    const before = (await S()).days[ed.i].picks;
    await p.evaluate(() => { window.__lt = []; }); const tc = Date.now();
    await p.locator(`label[for="s-${pick.id}"]`).first().click();
    await p.waitForTimeout(1500); const clickMs = Date.now() - tc, lt = await p.evaluate(() => Math.round(Math.max(0, ...window.__lt)));
    ok(lt < FREEZE_MS, `ticking a sight responds without freezing (longest block ${lt} ms, ${clickMs} ms)`);
    const fitbox = await p.evaluate(() => !!document.querySelector(".fitbox"));
    const after = (await S()).days[ed.i].picks;
    ok(after === before + 1 || fitbox, `ticking "${pick.name}" adds it to the picks (or explains why it doesn't fit) (${before} -> ${after})`);
    if (after === before + 1) {
      await p.evaluate(go("plan", ed.i)); await p.waitForTimeout(4000); const s = await seen(p);
      const inPlan = s.stops.concat(s.optional).some(x => x.toLowerCase().includes(pick.name.toLowerCase().slice(0, 12)));
      const dropped = await p.evaluate(i => { const t = window.__kairouteTruth(i); return t && t.dropped ? t.dropped.map(x => x.name || x) : []; }, ed.i).catch(() => []);
      ok(inPlan || dropped.length > 0, `"${pick.name}" shows on the Day plan (or the plan says what didn't fit)`);
      await p.evaluate(go("sites", ed.i)); await p.waitForTimeout(1500);
      await p.locator(`label[for="s-${pick.id}"]`).first().click().catch(() => {}); await p.waitForTimeout(1000);
      ok((await S()).days[ed.i].picks === before, "unticking it removes it again");
    } else await p.evaluate(() => { const b = document.querySelector(".fitbox [data-act=fitcancel], .fitbox .btn.ghost"); if (b) b.click(); });
  }

  // 3. Rides: on the Naples day, pick the ferry when it is offered; Sorrento and the other stops must stay.
  const nap = days.find(d => /naples/i.test(d.dest));
  if (nap) {
    await p.evaluate(go("plan", nap.i)); await p.waitForTimeout(15000);
    let s = await seen(p); log(`     Naples: stops [${s.stops.join("; ")}], rides ${JSON.stringify(s.rides)}`);
    const sorr = s.stops.some(x => /sorrento/i.test(x));
    ok(sorr, "Naples day: Sorrento is on the plan", true);
    const fr = s.rides.find(r => r.opts.some(o => /ferry|hydrofoil|boat/i.test(o)));
    ok(!!fr || !sorr, "Naples day: a ride to Sorrento offers the ferry", true);
    await shot(p, "A3-naples-rides-tablet");
    if (fr) {
      const opt = fr.opts.find(o => /ferry|hydrofoil|boat/i.test(o));
      await p.evaluate(() => { window.__lt = []; });
      await p.selectOption(`select[data-ride="${fr.key}"]`, { label: opt }).catch(e => log("     select failed: " + e.message));
      await p.waitForTimeout(4000); const s2 = await seen(p);
      ok(s2.stops.length >= s.stops.length && (!sorr || s2.stops.some(x => /sorrento/i.test(x))), `choosing "${opt}" keeps every stop (${s.stops.length} -> ${s2.stops.length}: ${s2.stops.join("; ")})`);
      ok(s2.rides.some(r => r.opts.some(o => /ferry|hydrofoil|boat/i.test(o))), "the ferry is still offered after choosing it");
      await p.waitForTimeout(GATE ? 5000 : 60000); await p.evaluate(go("plan", nap.i)); await p.waitForTimeout(4000); const s3 = await seen(p);
      ok(s3.rides.some(r => r.opts.some(o => /ferry|hydrofoil|boat/i.test(o))) && (!sorr || s3.stops.some(x => /sorrento/i.test(x))), "a minute later the ferry and Sorrento are both still there");
      await shot(p, "A3b-naples-ferry-tablet");
    }
  }
  // Every other day with a ride menu: switching to another ride keeps the stops.
  for (const d of days) {
    if (d === nap || !plans[d.i] || !plans[d.i].rides.length) continue;
    await p.evaluate(go("plan", d.i)); await p.waitForTimeout(2500); const s = await seen(p); const r = s.rides[0]; if (!r || r.opts.length < 2) continue;
    const other = r.opts.find(o => o !== r.chosen);
    await p.selectOption(`select[data-ride="${r.key}"]`, { label: other }).catch(() => {}); await p.waitForTimeout(3000); const s2 = await seen(p);
    ok(s2.stops.length === s.stops.length, `day ${d.i + 1} ${d.dest}: changing a ride to "${other}" keeps the ${s.stops.length} stops (now ${s2.stops.length})`);
    await p.selectOption(`select[data-ride="${r.key}"]`, { label: r.chosen }).catch(() => {}); await p.waitForTimeout(1500);
  }

  // 4. Guide and Tour.
  for (const v of ["guide", "tour", "trip", "journal"]) {
    await timed(p, "open " + v, go(v, first.i), 3000);
    const t = await p.evaluate(() => (document.querySelector("main") || document.body).innerText);
    ok(t.length > 200 && !/something went wrong/i.test(t), `the ${v[0].toUpperCase() + v.slice(1)} screen shows content (${t.length} characters)`);
    await shot(p, `A4-${v}-tablet`);
  }
  await p.evaluate(go("plan", first.i)); await p.waitForTimeout(1500);
  const tb = p.locator('[data-act="tourstart"]').first();
  if (await tb.isVisible().catch(() => false)) { await tb.click(); await p.waitForTimeout(3000); const t = await p.evaluate(() => document.body.innerText); ok(/stop|walk|head|start|next/i.test(t), "Start the tour opens the tour"); await shot(p, "A4b-tour-started-tablet"); }
  else ok(false, "the Day plan has a Start the tour button");

  // 5. Same trip at phone and upright-tablet size (same device storage, like rotating or a second screen).
  for (const size of ["phone", "upright"]) {
    const q = await ctx.newPage(); await q.setViewportSize(SIZES[size]); const e2 = watch(q, size);
    await open(q); const cont = q.locator('[data-act="continue"]').first(); if (await cont.isVisible().catch(() => false)) await cont.click();
    for (const d of [first, ed, nap].filter(Boolean)) {
      await timed(q, `open Day plan (${size})`, go("plan", d.i), 5000); const s = await seen(q);
      ok(s.stops.length === plans[d.i].stops.length, `${size}: day ${d.i + 1} ${d.dest} shows the same ${plans[d.i].stops.length} stops (${s.stops.length})`);
      const wide = await q.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      ok(wide <= 2, `${size}: day ${d.i + 1} fits the screen width (${wide}px too wide)`);
    }
    await shot(q, `A5-dayplan-${size}`);
    for (const v of ["sites", "guide", "tour"]) { await timed(q, `open ${v} (${size})`, go(v, first.i), 2500); await shot(q, `A5-${v}-${size}`); }
    ok(!e2.length, `${size}: no page errors (${e2.slice(0, 3).join(" / ")})`); await q.close();
  }

  // 6. Offline: one tap downloads the trip; with no internet the app and every Day plan come back the same.
  if (GATE) { ok(!errs.length, `tablet: no page errors (${errs.slice(0, 3).join(" / ")})`); await ctx.close(); return; }
  await p.evaluate(go("trip", 0)); await p.waitForTimeout(2000);
  const dl = p.locator('#offCard [data-act="offdl"]').first();
  if (ok(await dl.isVisible().catch(() => false), "the Trip screen offers Download for offline")) {
    t0 = Date.now(); await dl.click(); let st;
    for (;;) { st = await p.evaluate(() => window.__kairouteOffline ? window.__kairouteOffline.state() : null); if (!st || !st.run) break; if (Date.now() - t0 > 900000) { ok(false, "the offline download did not finish in 15 minutes: " + st.run.step); break; } await p.waitForTimeout(3000); }
    report.timings.offlineDownload = sec(t0);
    const rep = st && st.rep;
    ok(rep && rep.ready, `the download finishes "Ready for offline" (${sec(t0)} s)` + (rep && !rep.ready ? ": " + rep.days.filter(x => !x.ready).map(x => `day ${x.i + 1} ${x.place} missing ${Object.values(x.parts).filter(q => !q.ok).map(q => q.miss).join(", ")}`).join("; ") : ""));
    await shot(p, "A6-offline-ready-tablet");
    await ctx.setOffline(true); await p.reload().catch(() => {}); await p.waitForTimeout(3000);
    ok(await p.evaluate(() => !!document.querySelector("header.top")).catch(() => false), "with no internet the app opens from the device");
    const cont = p.locator('[data-act="continue"]').first(); if (await cont.isVisible().catch(() => false)) await cont.click();
    for (const d of days) {
      if (d.type === "sea") continue;
      await p.evaluate(go("plan", d.i)).catch(() => {}); await p.waitForTimeout(1200); const s = await seen(p);
      ok(s.stops.join("|") === plans[d.i].stops.join("|"), `offline: day ${d.i + 1} ${d.dest} has the same stops` + (s.stops.join("|") === plans[d.i].stops.join("|") ? "" : ` (online: ${plans[d.i].stops.join("; ")} | offline: ${s.stops.join("; ")})`));
    }
    await shot(p, "A6b-offline-dayplan-tablet");
    await ctx.setOffline(false);
  }
  ok(!errs.length, `tablet: no page errors (${errs.slice(0, 3).join(" / ")})`);
  await ctx.close();
}

async function buildNew(b, label, text, photo) {
  const ctx = await newCtx(b, "tablet"), p = await ctx.newPage(), errs = watch(p, label);
  await open(p);
  if (!ok(await p.evaluate(() => !!window.__kairouteState), `${label}: the live site has the demo-flow test hook`)) { await ctx.close(); return null; }
  const ready = await p.waitForFunction(() => window.__kairouteAiReady && window.__kairouteAiReady(), null, { timeout: 90000 }).then(() => true).catch(() => false);
  if (!ok(ready, `${label}: the AI guide is on, so a new trip can be built`)) { await ctx.close(); return null; }
  await p.locator('[data-act="newtrip"]').first().click(); await p.waitForTimeout(800);
  await p.fill("#w-text", text);
  if (photo) await p.setInputFiles("#w-img", photo), await p.waitForTimeout(1500);
  await shot(p, `B-${label}-wizard`);
  const t0 = Date.now();
  await p.getByRole("button", { name: "Build my trip" }).click();
  // Wait for the trip and its city guides (the traveler sees a progress block meanwhile).
  let last = "";
  for (;;) {
    const st = await p.evaluate(() => window.__kairouteState());
    if (st.busy !== last) { log(`     ${sec(t0)} s: ${st.busy || "(idle)"} [${st.view}]`); last = st.busy; }
    if (st.err) { ok(false, `${label}: building the trip failed: ${st.err}`); break; }
    // The traveler should not have to tap anything more: city guides start on their own. If a button is still
    // needed, tap it like the traveler would and log it.
    if (!st.busy && st.view === "trip" && await p.locator('[data-act="genall"]').first().isVisible().catch(() => false)) {
      if (!report.tapped) ok(false, `${label}: after the trip was built, the city guides waited for an extra tap on "Build the guides"`, true);
      report.tapped = 1; await p.locator('[data-act="genall"]').first().click(); await p.waitForTimeout(2000); continue;
    }
    if (!st.busy && st.view !== "wizard" && st.days.length > 3 && st.days.filter(d => d.type !== "sea").every(d => d.guide)) break;
    if (Date.now() - t0 > 900000) { ok(false, `${label}: the trip was not ready after 15 minutes (${st.busy})`); break; }
    await p.waitForTimeout(3000);
  }
  report.timings["build " + label] = sec(t0); log(`     built in ${sec(t0)} s`);
  const t = await p.evaluate(() => window.__kairouteState());
  log("     " + t.days.map(d => `${d.date} ${d.type} ${d.dest}${d.arrive || d.aboard ? ` ${d.arrive || "?"}-${d.aboard || "?"}` : ""}${d.estimated ? " est." : ""}${d.wants.length ? " wants:" + d.wants.join("/") : ""}`).join("\n     "));
  ok(t.ship && /sun princess/i.test(t.ship.name || ""), `${label}: the ship is kept (${JSON.stringify(t.ship)})`);
  for (const dt of ["2027-06-30", "2027-07-01", "2027-07-02", "2027-07-03"]) ok(t.days.some(d => d.date === dt && /athens/i.test(d.dest)), `${label}: an Athens day on ${dt}`);
  ok(t.days.some(d => d.date === "2027-07-04" && d.type === "embark"), `${label}: boarding in Piraeus on July 4`);
  for (const [dt, [re, arr, abd]] of Object.entries(PORTS)) {
    const d = t.days.find(x => x.date === dt);
    if (!ok(d && re.test(d.dest) && d.type === "port", `${label}: port day ${dt} is ${re.source} (${d ? d.type + " " + d.dest : "missing"})`)) continue;
    ok(!!(d.arrive && d.aboard), `${label}: ${d.dest} has ship times filled in (${d.arrive || "none"} to ${d.aboard || "none"})`);
    if (photo) ok(d.arrive === arr && d.aboard <= abd && d.aboard >= "00:00", `${label}: ${d.dest} times match the photo: arrive ${arr}, all aboard by ${abd} (got ${d.arrive} to ${d.aboard})`);
  }
  for (const dt of SEA) ok(t.days.some(d => d.date === dt && d.type === "sea"), `${label}: a sea day on ${dt}`);
  ok(t.days.some(d => d.date === "2027-07-15" && /barcelona/i.test(d.dest)), `${label}: Barcelona on July 15`);
  ok(!t.days.some(d => /pompeii|sorrento|corinth|acropolis|mars hill/i.test(d.dest)), `${label}: named sights are not days of their own`);
  if (!photo) {
    await p.evaluate(go("trip", 0)); await p.waitForTimeout(1500);
    const est = t.days.filter(d => d.type === "port" && d.estimated).length;
    const banner = await p.evaluate(() => (document.querySelector(".banner.shiptimes") || {}).innerText || "");
    ok(!est || /Ship times are estimated/.test(banner), `${label}: estimated ship times are marked and the Trip screen asks for the booking's times (${est} estimated)`);
    await shot(p, `B-${label}-trip`);
  }
  // The places they named are on their days' plans.
  const want = [[/athens/i, /acropolis|parthenon/i, "the Acropolis"], [/athens/i, /areopagus|mars hill/i, "Mars Hill"], [/athens/i, /corinth/i, "Ancient Corinth"], [/naples/i, /pompeii/i, "Pompeii"], [/naples/i, /sorrento/i, "Sorrento"]];
  const planned = {};
  for (const d of t.days.filter(x => /athens|naples/i.test(x.dest) && x.type !== "embark")) {
    await p.evaluate(go("plan", d.i)); await p.waitForTimeout(6000); const s = await seen(p); planned[d.i] = s.stops.concat(s.optional);
    log(`     day ${d.i + 1} ${d.date} ${d.dest}: [${planned[d.i].join("; ")}]`);
  }
  for (const [city, re, nm] of want) ok(t.days.some(d => city.test(d.dest) && (planned[d.i] || []).some(x => re.test(x))), `${label}: ${nm} (named in the request) is on a ${city.source} Day plan`);
  const nap = t.days.find(d => /naples/i.test(d.dest)); if (nap) { await p.evaluate(go("plan", nap.i)); await p.waitForTimeout(3000); await shot(p, `B-${label}-naples`); }
  ok(!errs.length, `${label}: no page errors (${errs.slice(0, 3).join(" / ")})`);
  await ctx.close(); return t;
}

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  try { if (PARTS.includes("A")) await partA(b); } catch (e) { ok(false, "Part A stopped: " + e.message.split("\n")[0]); }
  if (PARTS.includes("B")) {
    log("\n=== Part B: building the trip from words, then from the itinerary photo ===");
    try { await buildNew(b, "typed", TEXT, null); } catch (e) { ok(false, "typed trip stopped: " + e.message.split("\n")[0]); }
    try { await buildNew(b, "photo", "Flying into Athens June 30, 2027 for 4 nights, then this cruise.", PHOTO); } catch (e) { ok(false, "photo trip stopped: " + e.message.split("\n")[0]); }
  }
  await b.close();
  report.finished = new Date().toISOString();
  const head = `# Kairoute demo flow, ${report.finished.slice(0, 16).replace("T", " ")} UTC\n\n${report.fails.length ? `**${report.fails.length} failures**` : "**Clean: no failures**"}, ${report.warns.length} warnings.\n\n` +
    (report.fails.length ? "## Failures\n" + report.fails.map(f => "- " + f).join("\n") + "\n\n" : "") + (report.warns.length ? "## Warnings\n" + report.warns.map(f => "- " + f).join("\n") + "\n\n" : "");
  fs.writeFileSync(path.join(OUT, "report.md"), head + "## Full log\n```\n" + lines.join("\n") + "\n```\n");
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
  console.log(`\n${report.fails.length} FAIL, ${report.warns.length} WARN`);
  process.exit(report.fails.length ? 1 : 0);
})();
