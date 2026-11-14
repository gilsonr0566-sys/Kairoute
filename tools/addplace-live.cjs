// "Don't see a place you want?" live check (Richard, Nov 14): on the published site with the real AI, type real
// places into the box on an Athens day (phone and tablet) and check each one ends up in the sights list, either
// ticked and on the Day plan or explained by the won't-fit box, and that no error is shown. Exit 1 on a problem.
const { chromium } = require("playwright");
const URL = process.env.URL || "https://gilsonr0566-sys.github.io/Kairoute/";
const NAMES = (process.env.NAMES || "Roman Agora|Corinth Canal|Hadrian's Library").split("|").map(s => s.trim()).filter(Boolean);
(async () => {
  let bad = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) bad++; };
  const b = await chromium.launch();
  for (const [W, H, tag] of [[412, 900, "phone"], [1280, 800, "tablet"]]) {
    const p = await b.newPage({ viewport: { width: W, height: H } });
    await p.addInitScript(() => { try { localStorage.setItem("kairoute.intro1", "1"); } catch (e) {} });
    p.on("pageerror", e => console.log(`${tag} PAGE ERROR ${e.message}`));
    p.on("console", m => { if (m.type() === "error") console.log(`${tag} console: ${m.text().slice(0, 200)}`); });
    try {
      await p.goto(URL); await p.waitForFunction(() => window.__kairouteAt && window.__kairouteAiReady, null, { timeout: 120000 });
      if (tag === "phone") console.log("Version", await p.evaluate(() => fetch("version.txt", { cache: "no-store" }).then(r => r.text()).catch(() => "?")));
      await p.getByText("Continue trip").click({ timeout: 15000 }).catch(() => {});
      await p.waitForFunction(() => window.__kairouteAiReady(), null, { timeout: 90000 }).catch(() => {});
      ok(await p.evaluate(() => window.__kairouteAiReady()), `${tag}: AI guide is ready`);
      // The sights list on every Athens day: no pick stays ticked when it isn't on the plan, the count matches,
      // and sights planned on other days sit under the "Already scheduled" line naming their day.
      for (const di of [0, 1, 2, 3, 4]) {
        await p.evaluate(i => window.__kairouteAt(i, "sites"), di); await p.waitForTimeout(1200);
        const st = await p.evaluate(() => { const cards = [...document.querySelectorAll(".sitesmain [data-card]")].filter(c => !c.closest("details")); const ticked = cards.filter(c => c.querySelector("input:checked")); const inS = c => !!c.closest(".sitelist.sched"); const f = cards.findIndex(inS); const sb = document.querySelector(".stickybar .count");
          return { day: (document.querySelector("h1, .dayhead h2, h2") || {}).innerText, ticked: ticked.length, count: sb ? parseInt(sb.innerText, 10) : -1, offPlan: ticked.filter(c => /doesn't fit|not on today/.test(c.innerText)).map(c => c.querySelector(".name").innerText), sched: cards.filter(inS).length, line: !!document.querySelector(".schedline"), mixed: f >= 0 && cards.slice(f).some(c => !inS(c)), noDay: cards.filter(inS).filter(c => !/Day \d+ · /.test(c.innerText)).length }; });
        console.log(`${tag} day ${di + 1} list: ${JSON.stringify(st)}`);
        ok(!st.offPlan.length, `${tag} day ${di + 1}: no ticked pick off the plan${st.offPlan.length ? " (" + st.offPlan.join(", ") + ")" : ""}`);
        ok(st.count === st.ticked, `${tag} day ${di + 1}: "${st.count} sites picked" matches ${st.ticked} ticked`);
        ok(!st.sched || (st.line && !st.mixed && !st.noDay), `${tag} day ${di + 1}: ${st.sched} sights scheduled on other days sit under the line, each naming its day`);
      }
      for (const [k, name] of NAMES.entries()) {
        const di = 2 + (k % 2);
        await p.evaluate(i => window.__kairouteAt(i, "sites"), di); await p.waitForTimeout(800);
        const before = await p.evaluate(() => [...document.querySelectorAll("[data-card]")].map(c => c.dataset.card));
        const has = await p.evaluate(() => !!document.getElementById("addPlace"));
        if (!has) { ok(false, `${tag} "${name}": no place box (${await p.evaluate(() => (document.querySelector(".addplace") || {}).innerText || "no card")})`); continue; }
        await p.fill("#addPlace", name); await p.evaluate(() => [...document.querySelectorAll('[data-act="addplace"]')].find(e => !e.disabled).click());
        const t0 = Date.now();
        await p.waitForFunction(() => { const i = document.getElementById("addPlace"); return !i || !i.disabled; }, null, { timeout: 200000 }).catch(() => {});
        await p.waitForTimeout(800);
        const r = await p.evaluate(([nm, before]) => {
          const err = [...document.querySelectorAll('.banner.warn[role="alert"]')].map(e => e.innerText).join(" | ");
          const key = s => s.toLowerCase().replace(/[^a-z]/g, "");
          const cards = [...document.querySelectorAll("[data-card]")].filter(c => { const n = c.querySelector(".name"); return n && (key(n.innerText).includes(key(nm).slice(0, 8)) || key(nm).includes(key(n.innerText).slice(0, 8))); });
          return { err, box: !!document.querySelector(".fitbox"), boxText: ((document.querySelector(".fitbox") || {}).innerText || "").slice(0, 300),
            cards: cards.map(c => ({ id: c.dataset.card, name: c.querySelector(".name").innerText, ticked: !!c.querySelector("input:checked"), tags: [...c.querySelectorAll(".tag")].map(t => t.innerText).join(" / "), isNew: !before.includes(c.dataset.card) })) };
        }, [name, before]);
        console.log(`${tag} "${name}" after ${Math.round((Date.now() - t0) / 1000)}s: ${JSON.stringify(r)}`);
        ok(!r.err, `${tag} "${name}": no error shown${r.err ? " (" + r.err + ")" : ""}`);
        ok(r.cards.length > 0, `${tag} "${name}": in the sights list`);
        ok(r.cards.some(c => c.ticked) || r.box, `${tag} "${name}": picked, or the won't-fit box explains why`);
        if (r.box) await p.evaluate(() => { const c = document.querySelector('.fitbox [data-act="fitcancel"]'); if (c) c.click(); });
      }
    } catch (e) { ok(false, `${tag}: ${e.message}`); }
    await p.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
