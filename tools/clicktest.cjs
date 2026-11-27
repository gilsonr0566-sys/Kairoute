// Taps every button and link the app shows, a few screens deep, at phone and tablet sizes,
// and lists any that do nothing or cause an error. Run: node tools/clicktest.cjs http://localhost:8000/
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:8000/";
const ALL = { phone: [412, 900], tablet: [1280, 800], "tablet-tall": [800, 1280] };
const SIZES = (process.argv[3] || "phone,tablet").split(",").map(n => [n, ...ALL[n]]);
const DEPTH = +(process.argv[4] || 2);
const SKIP = /^(Delete|Yes, delete|Reset|Yes, reset|Start over)/i;
const NO_DEEPER = /^(Watch the intro|Intro video)$/; // a full-screen film covers the page; its own buttons are still tested
async function fresh(b, w, h) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, acceptDownloads: true });
  await ctx.addInitScript(() => { window.alert = () => {}; window.confirm = () => true; window.print = () => {}; });
  await ctx.route(/cdnjs|fonts\.g/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(600);
  await p.evaluate(() => document.querySelectorAll("*").forEach(e => e.getAnimations && e.getAnimations().forEach(a => a.finish())));
  return { ctx, p, errs };
}
const sig = p => p.evaluate(() => { const v = document.body.innerText; return v.length + ":" + v.slice(0, 4000) + [...document.querySelectorAll("details")].map(d => d.open ? 1 : 0).join("") + [...document.querySelectorAll("input,select,textarea")].map(e => e.type === "checkbox" ? e.checked : e.value).join("|")
    + [...document.querySelectorAll("[aria-pressed],[aria-selected],[aria-expanded]")].map(e => (e.getAttribute("aria-pressed") || "") + (e.getAttribute("aria-selected") || "") + (e.getAttribute("aria-expanded") || "")).join("")
    + JSON.stringify(document.documentElement.dataset) + document.documentElement.className + document.body.className + (window.speechSynthesis && speechSynthesis.speaking ? "speaking" : "") + window.scrollY; });
async function targets(p) {
  return p.evaluate(() => {
    const out = [];
    document.querySelectorAll("button, a[href], [data-act], [data-view], [data-goto], summary, [role=tab]").forEach((el, i) => {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === "hidden" || el.disabled || el.closest("[hidden]")) return;
      if (el.tagName !== "SUMMARY" && el.closest("details:not([open])")) return; // folded away, can't be tapped
      if (["true"].includes(el.getAttribute("aria-pressed")) || el.getAttribute("aria-selected") === "true" || el.getAttribute("aria-current")) return; // already chosen
      el.setAttribute("data-ct", i);
      out.push({ ct: i, text: (el.innerText || el.getAttribute("aria-label") || el.value || el.tagName).trim().replace(/\s+/g, " ").slice(0, 50), tag: el.tagName, href: el.getAttribute("href") || "" });
    });
    return out;
  });
}
async function replay(p, path) { for (const t of path) { const el = await p.$(`text="${t}"`) || await p.$(`:text("${t}")`); if (!el) return false; await el.click({ timeout: 2000 }).catch(() => {}); await p.waitForTimeout(350); } return true; }
(async () => {
  const b = await chromium.launch(); const problems = [];
  for (const [name, w, h] of SIZES) {
    const seen = new Set(); let queue = [[]], tested = 0;
    while (queue.length) {
      const path = queue.shift(); if (path.length > DEPTH) continue;
      const { ctx, p, errs } = await fresh(b, w, h);
      if (!(await replay(p, path))) { await ctx.close(); continue; }
      const state = (await sig(p)).slice(0, 300); if (seen.has(state)) { await ctx.close(); continue; } seen.add(state);
      const list = await targets(p); await ctx.close();
      for (const t of list) {
        if (SKIP.test(t.text) || /^(mailto|tel|http)/.test(t.href) && !t.href.includes("localhost")) continue;
        const f = await fresh(b, w, h); await replay(f.p, path); await targets(f.p);
        const before = await sig(f.p), url0 = f.p.url();
        let popup = false, dl = false; f.ctx.on("page", () => popup = true); f.p.on("download", () => dl = true);
        const el = await f.p.$(`[data-ct="${t.ct}"]`);
        if (!el) { await f.ctx.close(); continue; }
        await el.click({ timeout: 2000 }).catch(e => problems.push(`${name} | ${path.join(" > ") || "start"} | "${t.text}" could not be tapped: ${e.message.split("\n")[0]}`));
        await f.p.waitForTimeout(500); tested++;
        const after = await sig(f.p).catch(() => "nav");
        const n0 = problems.length;
        if (f.errs.length) problems.push(`${name} | ${path.join(" > ") || "start"} | "${t.text}" ERROR: ${f.errs.join("; ")}`);
        else if (after === before && f.p.url() === url0 && !popup && !dl && !t.href) problems.push(`${name} | ${path.join(" > ") || "start"} | "${t.text}" did nothing`);
        if (problems.length > n0) console.log("  " + problems[problems.length - 1]);
        if (after !== before && t.text && !NO_DEEPER.test(t.text) && path.length < DEPTH && t.tag !== "SUMMARY") queue.push([...path, t.text]);
        await f.ctx.close();
      }
    }
    console.log(name, "screens", seen.size, "taps", tested);
  }
  console.log(problems.length ? "PROBLEMS:\n" + [...new Set(problems)].join("\n") : "No dead buttons or errors found");
  await b.close();
})();
