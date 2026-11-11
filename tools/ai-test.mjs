// Calls the live AI helper the way the website does, and reports speed and quality.
import fs from "fs";
const URL_ = JSON.parse(fs.readFileSync("ai.json", "utf8")).url;
const H = { "content-type": "application/json", Origin: "https://gilsonr0566-sys.github.io" };
console.log("status:", await (await fetch(URL_ + "/status")).text());
async function run(body) {
  const t0 = Date.now(); const r = await fetch(URL_ + "/sample", { method: "POST", headers: H, body: JSON.stringify(body) });
  if (!r.ok) { console.log("HTTP", r.status, await r.text()); return ""; }
  const raw = await r.text(); let text = "", finish = null, sample = raw.slice(0, 400);
  try { const j = JSON.parse(raw); text = j.text || ""; finish = j.finish; } catch (e) {}
  console.log(`time ${((Date.now() - t0) / 1000).toFixed(1)}s, ${text.length} chars, finish=${finish}`);
  if (!text) console.log("RAW START:", sample);
  return text;
}
console.log("--- quick question");
console.log(await run({ prompt: "In two sentences, what should a visitor look for at the Parthenon?", tier: "quick" }));
console.log("--- Lisbon city guide in 4 parallel parts");
const body = JSON.parse(fs.readFileSync("tools/ai-test-lisbon.json", "utf8"));
const parts = [
  'For this request return ONLY {"city","country","starts","restaurants","gettingAround","basics"}. Leave out "sites" and "farther".',
  'For this request return ONLY {"sites":[...]} holding the 7 most famous main sights of this destination (3-5 of them mustSee true). No quick sights.',
  'For this request return ONLY {"sites":[...]} holding 7 more main sights that are NOT among the 7 most famous: lesser-known gems and places locals love (most with "kind":"local"). No quick sights.',
  'For this request return ONLY {"sites":[...],"farther":[...]}: "sites" holds just the 5 quick sights ("quick": true) and "farther" holds 3-4 day trips.'
];
const t0 = Date.now();
const outs = await Promise.all(parts.map(x => run({ ...body, tier: "part", prompt: body.prompt + "\n\n" + x + " Ignore any other counts above and write exactly that many items, keeping each one as concise as the format allows." })));
console.log("all parts done in", ((Date.now() - t0) / 1000).toFixed(1) + "s");
const js = outs.map((o, i) => { try { return JSON.parse(o.slice(o.indexOf("{"), o.lastIndexOf("}") + 1)); } catch (e) { console.log("part", i, "JSON FAILED", e.message, o.slice(-300)); return null; } });
const sites = js.slice(1).flatMap(j => (j && j.sites) || []);
const a = js[0] || {};
console.log("sites:", sites.length, "quick:", sites.filter(s => s.quick).length, "farther:", ((js[3] || {}).farther || []).length, "restaurants:", (a.restaurants || []).length, "phrases:", ((a.basics || {}).phrases || []).length, "hotels:", ((a.starts || {}).hotel || []).length);
for (const s of sites) console.log(" -", s.name, s.lat, s.lng, s.minutes + "min", s.kind, (s.guide || "").split(/\s+/).length + "w");
console.log("sample guide:", (sites[0] || {}).guide);
console.log("status after:", await (await fetch(URL_ + "/status")).text());
