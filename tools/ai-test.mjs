// Runs the app's own city-guide builder (copied from src/main.js) against the live AI helper,
// for several different cities, and checks the guide store. Run by the "Test AI helper" workflow.
import fs from "fs";
const URL_ = JSON.parse(fs.readFileSync("ai.json", "utf8")).url;
const H = { "content-type": "application/json", Origin: "https://gilsonr0566-sys.github.io", "x-kairoute-lab": "1" };
const src = fs.readFileSync("src/main.js", "utf8");
const grab = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
let calls = 0, fails = 0;
async function sample(prompt, opts = {}) {
  calls++;
  const r = await fetch(URL_ + "/sample", { method: "POST", headers: H, body: JSON.stringify({ prompt, tier: opts.modelTier || "default" }) });
  if (!r.ok) { fails++; let m = "HTTP " + r.status; try { m = (await r.json()).error || m; } catch (e) {} throw new Error(m); }
  const j = await r.json();
  const tag = (prompt.match(/For this (?:first step|request) return ONLY \{[^}]{0,40}/) || [""])[0].slice(-30);
  if (process.env.VERBOSE) console.log(`   call ${opts.modelTier} ${(j.text || "").length} chars finish=${j.finish} out=${j.usage && j.usage.out} [${tag}]`);
  return { text: j.text || "", truncated: j.finish === "length" };
}
const keyOf = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const numV = v => (typeof v === "number" && isFinite(v) ? v : parseFloat(v));
const { parseJSON } = eval(grab("function parseJSON", "const numV") + "; ({ parseJSON })");
const cityInParts = eval("(" + grab("async function cityInParts", "// Finished guides are kept") + ")");
const base = JSON.parse(fs.readFileSync("tools/ai-test-lisbon.json", "utf8")).prompt;
const status = async () => (await (await fetch(URL_ + "/status")).json());
console.log("status:", JSON.stringify(await status()));
const cities = (process.env.CITIES || "Lisbon|Kotor, Montenegro|Savannah, Georgia").split("|").filter(Boolean);
async function storeTest(g) {
  const k = "test|" + Date.now();
  const put = await fetch(URL_ + "/guide", { method: "POST", headers: H, body: JSON.stringify({ k, guide: g }) });
  let back, bj = null; const t0 = Date.now();
  for (let i = 0; i < 12; i++) { back = await fetch(URL_ + "/guide?k=" + encodeURIComponent(k)); if (back.ok) { bj = await back.json(); break; } await new Promise(r => setTimeout(r, 10000)); }
  const ok = put.ok && bj && bj.sites && bj.sites.length === g.sites.length;
  console.log(`   guide store: ${ok ? "PASS" : "FAIL"} (save ${put.status}, read back ${back.status} after ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  return ok;
}
if (process.env.SPEAK_ONLY) {
  const body = JSON.stringify({ text: "Welcome to Kairoute. This is your natural guide voice, ready for the tour.", voice: "buttery" });
  for (let i = 0; i < 2; i++) { const t0 = Date.now(); const r = await fetch(URL_ + "/speak", { method: "POST", headers: H, body }); const buf = r.ok ? await r.arrayBuffer() : null; console.log(`speak ${i + 1}: HTTP ${r.status} ${r.headers.get("content-type")} ${buf ? buf.byteLength : (await r.text())} bytes cached=${r.headers.get("x-cached")} ${Date.now() - t0}ms`); }
  const story = JSON.parse(fs.readFileSync("tools/ai-test-lisbon.json", "utf8")).story || "As you stand before the Sé de Lisboa, you are looking at the spiritual heart of the city since the 12th century. Built on the site of a former mosque after the Christian reconquest in 1147, the cathedral has survived several earthquakes, including the devastating one of 1755. Its architecture is a blend of Romanesque, Gothic and Baroque styles because of the many rebuilds. Step inside and notice the rose window above the entrance, then walk to the Gothic cloister at the back, where excavations have uncovered Roman, Moorish and medieval remains.";
  const t0 = Date.now(); const r = await fetch(URL_ + "/script", { method: "POST", headers: H, body: JSON.stringify({ text: story }) });
  console.log(`script: HTTP ${r.status} ${Date.now() - t0}ms`); console.log(await r.text());
  console.log("status:", JSON.stringify(await status())); process.exit(0);
}
if (process.env.STORE_ONLY) { const ok = await storeTest({ city: "Test", sites: Array.from({ length: 9 }, (_, i) => ({ name: "S" + i })) }); console.log(ok ? "ALL PASS" : "SOME FAILED"); process.exit(0); }
let allOk = true;
for (const city of cities) {
  const prompt = base.replace("Destination: Lisbon", "Destination: " + city);
  calls = 0; fails = 0; const t0 = Date.now(), before = (await status()).usedToday;
  try {
    const g = await cityInParts(prompt, () => {});
    const main = g.sites.filter(s => !s.quick), q = g.sites.filter(s => s.quick);
    const words = main.map(s => (s.guide || "").split(/\s+/).length);
    const ok = main.length >= 12 && q.length >= 3 && g.farther.length >= 3 && (g.restaurants || []).length >= 5 && g.basics;
    allOk = allOk && ok;
    console.log(`\n== ${city}: ${ok ? "PASS" : "FAIL"} in ${((Date.now() - t0) / 1000).toFixed(0)}s, ${calls} requests (${fails} retried), ~${(await status()).usedToday - before} neurons`);
    console.log(`   main ${main.length} (mustSee ${main.filter(s => s.mustSee).length}, local ${main.filter(s => s.kind === "local").length}), quick ${q.length}, farther ${g.farther.length}, restaurants ${(g.restaurants || []).length}, phrases ${((g.basics || {}).phrases || []).length}, guide words ${Math.min(...words)}-${Math.max(...words)}`);
    console.log("   " + main.map(s => s.name).join("; "));
    console.log("   farther: " + g.farther.map(s => s.name).join("; "));
    if (city === cities[0]) allOk = (await storeTest(g)) && allOk;
  } catch (e) { allOk = false; console.log(`\n== ${city}: FAIL ${e.message} after ${((Date.now() - t0) / 1000).toFixed(0)}s`); }
}
console.log("\nstatus after:", JSON.stringify(await status()));
console.log(allOk ? "ALL PASS" : "SOME FAILED");
