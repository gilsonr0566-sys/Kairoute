// Opens the live site's hand-written stop page (?stop=prague-clock), taps Play the way a person would, and reports
// whether Aurora's recordings play (every recording file must answer, and the button must say Aurora is playing).
// Usage: node tools/script-live.cjs [url]
const { chromium } = require("playwright");
const URL0 = process.argv[2] || "https://gilsonr0566-sys.github.io/Kairoute/";
(async () => {
  const b = await chromium.launch({ args: ["--autoplay-policy=user-gesture-required"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
  const p = await ctx.newPage(); const errs = [], got = [];
  p.on("pageerror", e => errs.push(e.message));
  p.on("response", r => { if (/\/audio\//.test(r.url())) got.push(r.status() + " " + r.url().split("/audio/")[1]); });
  await p.goto(URL0 + "?stop=prague-clock&t=" + Date.now()); await p.evaluate(() => localStorage.setItem("kairoute.intro1", "1")); await p.reload(); await p.waitForTimeout(4000);
  let bad = 0;
  const parts = await p.$$eval("[data-sp]", bs => bs.map(x => x.dataset.sp));
  console.log("Play buttons:", parts.length);
  if (parts.length < 10) { bad++; console.log("FAIL the stop page did not open with all its parts"); }
  // Every recording answers (checked directly, so a missing file is found without listening to the whole stop).
  const missing = await p.evaluate(async () => { const S = window.__kairouteScripts.STOP_SCRIPTS, out = [];
    for (const sc of S) for (const [k, pt] of sc.parts.entries()) for (let i = 0; i < pt.paras.length; i++) { const u = `audio/${sc.id}/p${k}-${i}.mp3`, r = await fetch(u, { method: "HEAD", cache: "no-store" }); if (!r.ok || !/audio|mpeg/.test(r.headers.get("content-type") || "")) out.push(u + " " + r.status); }
    return out; });
  console.log("Missing recordings:", missing.length ? missing.join(", ") : "none");
  if (missing.length) bad++;
  await p.click('[data-sp="script:prague-clock:0"]');
  let state = "";
  for (let i = 0; i < 8; i++) { await p.waitForTimeout(2500); state = await p.evaluate(() => { const x = document.querySelector('[data-sp="script:prague-clock:0"]'); return x.textContent + " | " + x.parentElement.querySelector(".state").textContent; }); console.log("t+" + (i + 1) * 2.5 + "s " + state); }
  if (!/Aurora/.test(state)) { bad++; console.log("FAIL Aurora's voice was not playing"); }
  console.log("Audio files fetched:", got.join(", "));
  if (errs.length) { bad++; console.log("PAGE ERRORS: " + errs.join(" | ")); }
  console.log(bad ? `${bad} problem(s).` : "Stop script live check passed: Aurora plays on the live site.");
  await b.close(); process.exit(bad ? 1 : 0);
})();
