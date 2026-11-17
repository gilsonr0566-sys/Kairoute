// Sights list probe (Richard, Nov 17: "still a lot of movement, double sites that should nest inside a main site").
// For every city day of the example trip: the list as drawn (sections and order), what moves when one sight is
// ticked, whether a second open gives the same list, and which sights stand inside another one (map areas, or named
// as one of its parts). Screenshots of an Athens and a Rome day on phone and tablet. URL: the site to probe.
const { chromium } = require("playwright"); const fs = require("fs");
// Screenshots go into the log too (base64 JPEG in lines), for machines that can't download workflow files.
async function shot(p, file) { const buf = await p.screenshot({ path: file, type: "jpeg", quality: 72 }); const b = buf.toString("base64"), name = file.split("/").pop(); for (let k = 0; k < b.length; k += 3000) console.log(`SHOT ${name} ${k / 3000} ${b.slice(k, k + 3000)}`); }
const URL = process.env.URL || "https://gilsonr0566-sys.github.io/Kairoute/", OUT = process.env.OUT || "probe-shots";
(async () => {
  fs.mkdirSync(OUT, { recursive: true }); const b = await chromium.launch();
  for (const [W, H, tag] of [[412, 900, "phone"], [1280, 800, "tablet"]]) {
    const p = await b.newPage({ viewport: { width: W, height: H } });
    await p.addInitScript(() => { try { localStorage.setItem("kairoute.intro1", "1"); } catch (e) {} });
    p.on("pageerror", e => console.log(`${tag} PAGE ERROR ${e.message}`));
    await p.goto(URL); await p.waitForFunction(() => window.__kairouteAt && window.__kairouteAiReady, null, { timeout: 120000 });
    console.log(tag, "Version", await p.evaluate(() => fetch("version.txt", { cache: "no-store" }).then(r => r.text()).catch(() => "?")));
    await p.getByText("Continue trip").click({ timeout: 15000 }).catch(() => {});
    await p.waitForFunction(() => window.__kairouteAiReady(), null, { timeout: 90000 }).catch(() => {});
    await p.waitForTimeout(20000); // guides, sources and map areas arrive
    const days = (await p.evaluate(() => window.__kairouteDays())).filter(d => d.city && d.type !== "sea");
    const read = () => p.evaluate(() => [...document.querySelectorAll(".sitesmain [data-card]")].map(c => { const sec = c.closest(".picksfold") ? "picks" : c.closest("details") ? "more" : c.closest(".sched") ? "sched" : c.closest(".wontlist") ? "wont" : "main"; return { id: c.dataset.card, n: ((c.querySelector(".name") || {}).textContent || "").trim(), sec, on: !!c.querySelector("input:checked"), y: Math.round(c.getBoundingClientRect().top + (document.querySelector(".sitesmain").scrollTop || 0) + scrollY) }; }));
    const seen = new Set();
    for (const d of days) {
      if (seen.has(d.city) && tag === "tablet") continue; seen.add(d.city);
      await p.evaluate(i => window.__kairouteAt(i, "sites"), d.i); await p.waitForTimeout(4000);
      const a = await read();
      if (tag === "phone") {
        console.log(`\nDAY ${d.i + 1} ${d.date} ${d.dest}: ${a.length} cards`);
        for (const s of ["picks", "main", "wont", "more", "sched"]) { const xs = a.filter(x => x.sec === s); if (xs.length) console.log(`  [${s}] ${xs.map(x => x.n + (x.on ? "*" : "")).join(" | ")}`); }
        const nest = await p.evaluate(i => { const T = window.__kairoutePickerNest ? window.__kairoutePickerNest(i) : null; if (T) return T;
          return null; }, d.i);
        if (nest) console.log("  NEST " + JSON.stringify(nest));
        // Tick the third free card and see what moved.
        const free = a.filter(x => x.sec === "main" && !x.on); const t = free[2] || free[0];
        if (t) {
          await p.evaluate(id => { const e = document.getElementById("s-" + id); e && e.click(); }, t.id); await p.waitForTimeout(3000);
          const b2 = await read(); const moved = a.filter(x => { const y = b2.find(z => z.id === x.id); return !y || y.sec !== x.sec || Math.abs(y.y - x.y) > 4; });
          const order = (l, s) => l.filter(x => x.sec === s).map(x => x.id).join(",");
          console.log(`  TICK ${t.n}: ${moved.length} of ${a.length} cards moved${moved.length ? " (" + moved.slice(0, 8).map(x => x.n).join("; ") + ")" : ""}; main order ${order(a, "main") === order(b2, "main") ? "same" : "changed"}`);
          await p.evaluate(id => { const e = document.getElementById("s-" + id); e && e.checked && e.click(); }, t.id); await p.waitForTimeout(2500);
        }
        await p.evaluate(i => window.__kairouteAt(i, "plan"), d.i); await p.waitForTimeout(1500);
        await p.evaluate(i => window.__kairouteAt(i, "sites"), d.i); await p.waitForTimeout(4000);
        const c = await read(); const same = JSON.stringify(a.map(x => x.id + x.sec)) === JSON.stringify(c.map(x => x.id + x.sec));
        console.log(`  REOPEN ${same ? "same list" : "DIFFERENT list: " + c.map(x => x.n).filter((n, k) => !a[k] || a[k].n !== n).slice(0, 6).join("; ")}`);
      }
      if (/athens|rome|madrid/i.test(d.dest) && !fs.existsSync(`${OUT}/${tag}-${d.city}.jpg`)) {
        await p.evaluate(() => { const m = document.querySelector(".sitesmain"); if (m) m.scrollTop = 0; scrollTo(0, 0); }); await p.waitForTimeout(400);
        await shot(p, `${OUT}/${tag}-${d.city}.jpg`);
        await p.evaluate(() => { const m = document.querySelector(".sitesmain"); if (m && m.scrollHeight > m.clientHeight) m.scrollTop = 700; else scrollTo(0, 900); }); await p.waitForTimeout(400);
        await shot(p, `${OUT}/${tag}-${d.city}-2.jpg`);
      }
    }
    await p.close();
  }
  await b.close();
})();
