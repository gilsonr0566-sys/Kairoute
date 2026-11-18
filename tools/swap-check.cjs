// Swap check (no network, no AI): on a full day, swapping in a sight planned on another day (the won't-fit box's
// "Swap X for Y") moves it: it comes off the other day, and a second page opened on the same device storage plans
// every day of that city exactly the same (Nov 18 Demo flow gate: Athens day 2 differed on phone and tablet).
// Usage: node tools/swap-check.cjs   (serves index.html itself)
const { chromium } = require("playwright"); const fs = require("fs"); const path = require("path"); const http = require("http");
const ROOT = path.join(__dirname, ".."), fix = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "src-athens.json")));
let fails = 0, b0 = null; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; return c; };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split("?")[0]).replace(/\/$/, "/index.html")); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200); r.end(b); } }); });
(async () => {
  await new Promise(res => srv.listen(0, res)); const URL = `http://localhost:${srv.address().port}/`;
  const b = b0 = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }), errs = [];
  await ctx.addInitScript(() => { try { localStorage.setItem("kairoute.intro1", "1"); } catch (e) {} });
  await ctx.route("**/*", r => r.request().url().startsWith(URL) ? r.continue() : r.abort());
  const seed = pg => pg.evaluate(([f, s]) => window.__kairouteSeedSources("Athens", f, s), [fix.famous, fix.sources]);
  const open = async pg => { pg.on("pageerror", e => errs.push(e.message)); await pg.goto(URL); await pg.waitForFunction(() => window.__kairouteGo); await seed(pg); await pg.waitForTimeout(1500);
    for (const a of ["loadsample", "continue"]) { const l = pg.locator(`[data-act="${a}"]`).first(); if (await l.isVisible().catch(() => false)) { await l.click(); break; } }
    await pg.waitForTimeout(1500); await seed(pg); for (let i = 0; i < 5; i++) { await pg.evaluate(i => window.__kairouteGo("plan", i), i); await pg.waitForTimeout(1000); } await pg.waitForTimeout(2000); };
  const days = pg => pg.evaluate(() => window.__kairouteDays().filter(d => /athens/i.test(d.dest)).map(d => { const t = window.__kairouteTruth(d.i); return { i: d.i, sel: t.selected || [], kept: t.keptNames || [] }; }));
  const p = await ctx.newPage(); await open(p);
  const D = await days(p), to = D.find(d => d.i === 1), from = [...D].sort((a, b) => (a.i === 2 ? -1 : 0) - (b.i === 2 ? -1 : 0)).find(d => d.i !== 1 && d.sel.some(x => !/far/.test(x) && !to.sel.includes(x)));
  if (!ok(to && from, "an Athens day with a sight planned on another day")) { await b.close(); srv.close(); process.exitCode = 1; return; }
  let id = null, swapped = null;
  for (const cand of from.sel.filter(x => !/far/.test(x) && !to.sel.includes(x))) {
    await p.evaluate(() => window.__kairouteGo("sites", 1)); await p.waitForTimeout(1200);
    await p.evaluate(id => { const el = document.getElementById("s-" + id); if (el) (el.closest("label") || el).scrollIntoView({ block: "center" }); }, cand);
    await p.locator("#s-" + cand).first().click({ force: true }).catch(() => {}); await p.waitForTimeout(2000);
    swapped = await p.evaluate(() => { const b = [...document.querySelectorAll(".fitbox [data-act=fitfixgo]")].find(x => /^Swap /.test(x.innerText)); if (b) { const t = b.innerText; b.click(); return t; } const c = document.querySelector(".fitbox [data-act=fitcancel]"); if (c) c.click(); return null; });
    if (swapped) { id = cand; break; }
    if ((await days(p)).find(d => d.i === 1).sel.includes(cand)) { id = cand; break; } // it simply fit: a plain move
  }
  if (!ok(!!id, `a sight from day ${from.i + 1} was put on day 2${swapped ? " with the box's swap (" + swapped.replace(/\s+/g, " ").slice(0, 80) + ")" : ""}`)) { await b.close(); srv.close(); process.exitCode = 1; return; }
  await p.waitForTimeout(2500);
  const A = await days(p);
  ok(A.find(d => d.i === 1).sel.includes(id), `${id} is on day 2`);
  ok(A.filter(d => d.sel.includes(id)).length === 1, `${id} is on one day only (${A.filter(d => d.sel.includes(id)).map(d => d.i + 1).join(", ")})`);
  const q = await ctx.newPage(); await open(q); const B = await days(q), A2 = await days(p);
  for (const d of A2) { const e = B.find(x => x.i === d.i); ok(e && e.kept.join("|") === d.kept.join("|"), `day ${d.i + 1}: a second page plans the same stops [${d.kept.join("; ")}]${e && e.kept.join("|") !== d.kept.join("|") ? " vs [" + e.kept.join("; ") + "]" : ""}`); }
  ok(!errs.length, `no page errors ${errs.slice(0, 2).join(" / ")}`);
  await b.close(); srv.close(); console.log(fails ? `${fails} FAIL` : "Swap check passed"); process.exitCode = fails ? 1 : 0;
})().catch(e => { console.log("FAIL " + e.stack); process.exitCode = 1; b0 && b0.close(); srv.close(); });
