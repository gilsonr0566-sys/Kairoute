// Opens the live site in Chrome, plays a stop with the natural voice, and reports what happened.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--autoplay-policy=user-gesture-required"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
  const p = await ctx.newPage(); const log = [];
  p.on("pageerror", e => log.push("ERROR " + e.message)); p.on("console", m => log.push("console " + m.type() + " " + m.text()));
  p.on("request", r => { if (/workers\.dev/.test(r.url())) log.push("-> " + r.method() + " " + r.url().replace(/.*workers\.dev/, "")); });
  p.on("response", r => { if (/workers\.dev/.test(r.url())) log.push("<- " + r.status() + " " + r.url().replace(/.*workers\.dev/, "") + " " + (r.headers()["content-type"] || "")); });
  await p.goto("https://gilsonr0566-sys.github.io/Kairoute/"); await p.evaluate(() => localStorage.setItem("kairoute.intro1", "1")); await p.reload(); await p.waitForTimeout(4000);
  await p.click("text=Continue trip"); await p.waitForTimeout(800);
  await p.click("#tab-guide"); await p.waitForTimeout(800);
  await p.click("[data-play]");
  for (let i = 0; i < 12; i++) { await p.waitForTimeout(2500); log.push("t+" + (i + 1) * 2.5 + "s state: " + await p.evaluate(() => { const b = document.querySelector("[data-play]"); return b.textContent + " | " + (b.parentElement.querySelector(".state") || {}).textContent; })); }
  console.log(log.join("\n")); await b.close();
})();
