// Screens for the Kairoute sales video (Nov 2026): opens the LIVE site with the Sun Princess sample trip, at tablet
// and phone size, and saves screenshots of each feature the video shows into video-out/shots/. Nothing is published
// or changed on the site: everything happens in a fresh test browser. Natural voice is off (no voice cost).
// Usage: node tools/video-capture.cjs [only-prefix]
const { chromium } = require("playwright"); const fs = require("fs"); const path = require("path");
const URL = process.env.URL || "https://gilsonr0566-sys.github.io/Kairoute/";
const OUT = path.join(__dirname, "..", "video-out", "shots"); fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.argv[2] || "";
const log = m => console.log(m);
const SIZES = { tablet: { width: 1280, height: 800 }, phone: { width: 412, height: 915 } };

async function newCtx(b, size) {
  const ctx = await b.newContext({ viewport: SIZES[size], deviceScaleFactor: size === "phone" ? 3 : 2, hasTouch: size === "phone", isMobile: size === "phone", timezoneId: "Europe/Athens", locale: "en-US" });
  await ctx.addInitScript(() => {
    try { localStorage.setItem("kairoute.intro1", "1"); } catch (e) {}
    try { const a = JSON.parse(localStorage.getItem("kairoute.app") || "{}"); a.natvoice = "off"; localStorage.setItem("kairoute.app", JSON.stringify(a)); } catch (e) {}
    try { const v = [{ name: "Test English", lang: "en-US", localService: true, default: true, voiceURI: "test" }]; speechSynthesis.getVoices = () => v; speechSynthesis.speak = () => {}; } catch (e) {}
    window.print = () => {};
  });
  return ctx;
}
async function open(p, q = "") {
  for (let n = 0; n < 20; n++) {
    await p.goto(URL + q, { waitUntil: "domcontentloaded" }).catch(() => {});
    const up = await p.waitForFunction(() => window.__kairouteGo && window.__kairouteDays && document.querySelector("header.top"), null, { timeout: 60000 }).then(() => true).catch(() => false);
    if (up) break; await p.waitForTimeout(30000);
  }
  await p.waitForTimeout(2000);
}
const shot = async (p, name) => { if (ONLY && !name.startsWith(ONLY)) return; await p.screenshot({ path: path.join(OUT, name + ".jpg"), type: "jpeg", quality: 88 }).catch(e => log("shot fail " + name + " " + e.message)); log("shot " + name); };
const go = (p, v, i) => p.evaluate(([v, i]) => window.__kairouteGo(v, i), [v, i]);
const clickText = async (p, re) => { const ok = await p.evaluate(src => { const re = new RegExp(src, "i"); const b = [...document.querySelectorAll("button, summary, a, [role=button]")].find(x => x.offsetParent && re.test(x.innerText.trim())); if (b) { b.scrollIntoView({ block: "center" }); b.click(); return true; } return false; }, re.source); await p.waitForTimeout(900); return ok; };
// Scrolls the pane that holds the timeline (or the page) by a fraction of a screen.
const scrollPane = (p, sel, by) => p.evaluate(([sel, by]) => {
  const el = document.querySelector(sel); let n = el;
  while (n && n !== document.body) { const cs = getComputedStyle(n); if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 5) break; n = n.parentElement; }
  const t = n && n !== document.body ? n : document.scrollingElement; t.scrollBy(0, by * t.clientHeight); return t.scrollTop;
}, [sel, by]);
const resetScroll = p => p.evaluate(() => { document.querySelectorAll("*").forEach(n => { if (n.scrollTop) n.scrollTop = 0; }); window.scrollTo(0, 0); });
const settle = async (p, max = 180000) => { const t0 = Date.now(); while (Date.now() - t0 < max) { const busy = await p.evaluate(() => /Building a fuller guide|Getting ready|Finding places to eat/i.test(document.body.innerText)).catch(() => false); if (!busy) break; await p.waitForTimeout(5000); } await p.waitForTimeout(2500); };
async function loadSample(p) {
  const s = p.locator('[data-act="loadsample"]').first(), c = p.locator('[data-act="continue"]').first();
  if (await s.isVisible().catch(() => false)) await s.click(); else if (await c.isVisible().catch(() => false)) await c.click();
  await p.waitForTimeout(3000);
  const t0 = Date.now(); for (;;) { const miss = await p.evaluate(() => window.__kairouteDays().filter(d => d.type !== "sea" && !d.city).length); if (!miss || Date.now() - t0 > 600000) break; await p.waitForTimeout(5000); }
}

async function tablet(b) {
  const ctx = await newCtx(b, "tablet"), p = await ctx.newPage(); p.on("pageerror", e => log("PAGE ERROR " + e.message)); p.on("dialog", d => d.dismiss().catch(() => {}));
  await open(p); await shot(p, "t01-lobby");
  // New trip in plain words (typed, never built: no AI cost).
  if (await clickText(p, /^Start a new trip$/)) {
    await p.waitForTimeout(1500); await shot(p, "t02-wizard-empty");
    const box = p.locator("#w-text");
    if (await box.isVisible().catch(() => false)) {
      const words = "Flying into Prague on May 14 for a long weekend, staying near Old Town Square. Then the train to Vienna for two nights, and we fly home from Vienna on May 19 at 4 pm. We love history, churches and good food.";
      const parts = words.match(/.{1,40}(\s|$)/g); let acc = "";
      for (const [k, w] of parts.entries()) { acc += w; await box.fill(acc); await p.waitForTimeout(150); await shot(p, "t03-wizard-type-" + String(k).padStart(2, "0")); }
      await box.scrollIntoViewIfNeeded().catch(() => {}); await p.waitForTimeout(500); await shot(p, "t04-wizard-filled");
      await p.evaluate(() => window.scrollBy(0, 500)); await p.waitForTimeout(600); await shot(p, "t04-wizard-filled-down");
    }
  }
  await open(p); await loadSample(p);
  const days = await p.evaluate(() => window.__kairouteDays()); log(JSON.stringify(days));
  const find = (type, re) => (days.find(d => d.type === type && (!re || re.test(d.dest))) || {}).i;
  await go(p, "trip", 0); await p.waitForTimeout(2500); await shot(p, "t05-trip");
  await clickText(p, /^Got it$/); await p.waitForTimeout(800); await shot(p, "t05-trip-clean");
  for (let k = 1; k <= 4; k++) { await scrollPane(p, ".daylist, .tripdays, main", 0.8); await p.waitForTimeout(700); await shot(p, "t06-trip-scroll-" + k); }
  await resetScroll(p);
  // Print the whole trip (the print view the browser would print).
  try { await go(p, "trip", 0); await p.waitForTimeout(1500); await p.evaluate(() => { const b = document.querySelector('[data-act="printtrip"]'); if (b) b.click(); }); await p.waitForTimeout(1500);
    await p.emulateMedia({ media: "print" }); await p.pdf({ path: path.join(OUT, "..", "trip-print.pdf"), format: "Letter", printBackground: true }); await p.emulateMedia({ media: "screen" }); log("pdf saved"); } catch (e) { log("pdf fail " + e.message); }
  // Day plans.
  const planDays = [["t10-athens", find("land", /athens/i)], ["t20-kusadasi", find("port", /kusadasi/i)], ["t21-naples", find("port", /naples/i)], ["t22-santorini", find("port", /santorini/i)], ["t23-rome", find("port", /rome/i)], ["t30-barcelona", find("land", /barcelona/i)], ["t31-madrid-arrive", find("arrival", /madrid/i)], ["t32-barcelona-leave", find("departure", /barcelona/i)]];
  for (const [nm, i] of planDays) {
    if (i == null) continue;
    await go(p, "plan", i); await p.waitForTimeout(4000); await settle(p);
    await clickText(p, /^Full details$/); await resetScroll(p); await p.waitForTimeout(800);
    await shot(p, nm + "-plan");
    for (let k = 1; k <= 3; k++) { await scrollPane(p, ".tl", 0.7); await p.waitForTimeout(800); await shot(p, `${nm}-plan-scroll-${k}`); }
    await resetScroll(p);
  }
  // Athens: Change stops, compact view, drag, heart.
  const ath = find("land", /athens/i);
  if (ath != null) {
    await go(p, "sites", ath); await p.waitForTimeout(3000); await settle(p, 60000); await shot(p, "t11-sites");
    for (let k = 1; k <= 3; k++) { await scrollPane(p, ".sitecard, .site, .pick, main", 0.7); await p.waitForTimeout(800); await shot(p, "t11-sites-scroll-" + k); }
    await resetScroll(p);
    // Open one sight card.
    await p.evaluate(() => { const c = [...document.querySelectorAll("details summary, .sitecard, [data-site]")].find(x => x.offsetParent); if (c) c.click(); }); await p.waitForTimeout(900); await shot(p, "t12-sites-card");
    await go(p, "plan", ath); await p.waitForTimeout(3000);
    if (await clickText(p, /^(⠿\s*)?Compact$/)) { await resetScroll(p); await shot(p, "t13-compact");
      // Drag the second stop's handle down (mid-drag frame, then drop).
      try { const h = p.locator(".draghandle, .handle, [data-drag]").nth(1); const bb = await h.boundingBox();
        if (bb) { await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); for (let s = 1; s <= 8; s++) { await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2 + s * 14); await p.waitForTimeout(60); } await shot(p, "t14-dragging"); await p.mouse.up(); await p.waitForTimeout(2500); await shot(p, "t15-dropped"); } else log("no drag handle"); } catch (e) { log("drag fail " + e.message); }
      await clickText(p, /^Full details$/); }
    await resetScroll(p);
    if (await clickText(p, /Mark day ready|Day ready/)) { await p.waitForTimeout(1500); await resetScroll(p); await shot(p, "t16-heart"); }
    // Day hours tile.
    await p.evaluate(() => { const t = [...document.querySelectorAll("button, [data-act]")].find(x => x.offsetParent && /^\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}/.test(x.innerText.trim())); if (t) t.click(); }); await p.waitForTimeout(1200); await shot(p, "t17-hours");
    await p.keyboard.press("Escape").catch(() => {});
  }
  // Ride buttons: Naples (ferry/train).
  const nap = find("port", /naples/i);
  if (nap != null) {
    await go(p, "plan", nap); await p.waitForTimeout(3000); await settle(p, 60000); await clickText(p, /^Full details$/);
    const n = await p.evaluate(() => document.querySelectorAll(".ridechips").length);
    for (let k = 0; k < Math.min(n, 4); k++) { await p.evaluate(k => { const g = document.querySelectorAll(".ridechips")[k]; g.scrollIntoView({ block: "center" }); }, k); await p.waitForTimeout(700); await shot(p, "t24-rides-" + k); }
    await resetScroll(p);
    // Ship's tour savings (Guide page of the port day).
    await go(p, "guide", nap); await p.waitForTimeout(3500); await shot(p, "t25-guide-port");
    try { const f = p.locator('details[data-gx-fold="save"]').first(); if (await f.count()) { await f.evaluate(e => { e.open = true; e.scrollIntoView({ block: "center" }); }); await p.waitForTimeout(600);
      await p.locator('form[data-gx-price] input[type=number]').first().fill("189"); await p.locator('form[data-gx-price] button[type=submit]').first().click(); await p.waitForTimeout(1500);
      await p.locator('details[data-gx-fold="save"]').first().evaluate(e => { e.open = true; e.scrollIntoView({ block: "center" }); }); await p.waitForTimeout(600); await shot(p, "t26-ship-savings"); } else log("no savings fold"); } catch (e) { log("savings fail " + e.message); }
    await go(p, "tour", nap); await p.waitForTimeout(3000); await shot(p, "t27-tour-port");
  }
  // Boarding day.
  const emb = find("embark");
  if (emb != null) {
    await go(p, "plan", emb); await p.waitForTimeout(4000); await settle(p, 60000); await resetScroll(p); await shot(p, "t40-boarding");
    try { if (!(await p.locator("#bc-time").isVisible().catch(() => false))) await p.locator('[data-act="boardchange"]').first().click(); await p.waitForTimeout(600);
      await p.locator("#bc-time").fill("12:30"); await p.locator('[data-act="boardsave"]').first().click(); await p.waitForTimeout(4000); await resetScroll(p); await shot(p, "t41-boarding-set");
      await p.locator(".boardcard").first().evaluate(e => e.scrollIntoView({ block: "start" })); await p.waitForTimeout(600); await shot(p, "t42-boardcard");
      const fold = p.locator(".bc-list summary").first(); if (await fold.isVisible().catch(() => false)) { await fold.click(); await p.waitForTimeout(500); }
      const box = p.locator("[data-board-check]"); const nb = await box.count(); for (let k = 0; k < Math.min(nb, 3); k++) await box.nth(k).check().catch(() => {});
      await p.waitForTimeout(600); await p.locator(".bc-list").first().evaluate(e => e.scrollIntoView({ block: "center" })).catch(() => {}); await p.waitForTimeout(500); await shot(p, "t43-board-checklist");
    } catch (e) { log("boarding fail " + e.message); }
    await resetScroll(p);
    for (let k = 1; k <= 2; k++) { await scrollPane(p, ".tl", 0.7); await p.waitForTimeout(800); await shot(p, "t44-boarding-scroll-" + k); }
  }
  // Sea day.
  const sea = find("sea");
  if (sea != null) {
    await go(p, "plan", sea); await p.waitForTimeout(4000); await resetScroll(p); await shot(p, "t50-sea");
    for (let k = 1; k <= 3; k++) { await scrollPane(p, ".voygrid", 0.7); await p.waitForTimeout(800); await shot(p, "t50-sea-scroll-" + k); }
    await resetScroll(p);
    await p.evaluate(() => { document.querySelectorAll(".voygrid details").forEach((d, k) => { if (k < 3) d.open = true; }); }); await p.waitForTimeout(800); await shot(p, "t51-sea-open");
  }
  // Guide, tour and journal for a city day.
  if (ath != null) {
    await go(p, "guide", ath); await p.waitForTimeout(3000); await shot(p, "t60-guide");
    await scrollPane(p, "main", 0.8); await p.waitForTimeout(700); await shot(p, "t60-guide-scroll");
    await go(p, "tour", ath); await p.waitForTimeout(3000); await shot(p, "t61-tour");
    await go(p, "journal", ath); await p.waitForTimeout(3000); await shot(p, "t62-journal");
  }
  // A port day seen from another screen (the pinned ship clock).
  const kus = find("port", /kusadasi/i);
  if (kus != null) { await go(p, "trip", kus); await p.waitForTimeout(3000); await shot(p, "t28-trip-port-pinned"); }
  // Offline card on the Trip page.
  await go(p, "trip", 0); await p.waitForTimeout(2000); await resetScroll(p);
  await p.evaluate(() => { const c = [...document.querySelectorAll(".card, section, div")].find(x => x.offsetParent && /ready for offline|Download for offline/i.test(x.innerText) && x.innerText.length < 400); if (c) c.scrollIntoView({ block: "center" }); }); await p.waitForTimeout(600); await shot(p, "t70-offline-card");
  await ctx.close();
}
async function prague(b) {
  const ctx = await newCtx(b, "tablet"), p = await ctx.newPage(); p.on("dialog", d => d.dismiss().catch(() => {}));
  await open(p, "?stop=prague-clock"); await p.waitForTimeout(3000); await shot(p, "t80-prague");
  await scrollPane(p, "main", 0.7); await p.waitForTimeout(700); await shot(p, "t80-prague-scroll");
  await ctx.close();
}
async function phone(b) {
  const ctx = await newCtx(b, "phone"), p = await ctx.newPage(); p.on("dialog", d => d.dismiss().catch(() => {}));
  await open(p); await shot(p, "p01-lobby"); await loadSample(p);
  const days = await p.evaluate(() => window.__kairouteDays());
  const find = (type, re) => (days.find(d => d.type === type && (!re || re.test(d.dest))) || {}).i;
  for (const [nm, v, i] of [["p10-athens-plan", "plan", find("land", /athens/i)], ["p20-kusadasi-plan", "plan", find("port", /kusadasi/i)], ["p21-naples-plan", "plan", find("port", /naples/i)], ["p30-sea", "plan", find("sea")], ["p40-tour", "tour", find("land", /athens/i)], ["p50-trip", "trip", 0], ["p60-journal", "journal", find("land", /athens/i)]]) {
    if (i == null) continue; await go(p, v, i); await p.waitForTimeout(4000); if (v === "plan") await settle(p, 90000); await clickText(p, /^Got it$/); await resetScroll(p); await shot(p, nm);
    if (v === "plan") for (let k = 1; k <= 2; k++) { await p.evaluate(() => window.scrollBy(0, innerHeight * 0.75)); await p.waitForTimeout(700); await shot(p, `${nm}-scroll-${k}`); }
  }
  await ctx.close();
}
(async () => {
  const b = await chromium.launch();
  for (const [nm, fn] of [["tablet", tablet], ["prague", prague], ["phone", phone]]) { try { await fn(b); } catch (e) { log(nm + " FAILED " + e.stack); } }
  await b.close(); log("done");
})();
