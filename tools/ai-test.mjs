// Calls the live AI helper the way the website does, and reports speed and quality.
import fs from "fs";
const URL_ = JSON.parse(fs.readFileSync("ai.json", "utf8")).url;
const H = { "content-type": "application/json", Origin: "https://gilsonr0566-sys.github.io" };
console.log("status:", await (await fetch(URL_ + "/status")).text());
async function run(body) {
  const t0 = Date.now(); const r = await fetch(URL_ + "/sample", { method: "POST", headers: H, body: JSON.stringify(body) });
  if (!r.ok) { console.log("HTTP", r.status, await r.text()); return ""; }
  const raw = await r.text(); let text = "", finish = null, sample = raw.slice(0, 400);
  for (const line of raw.split("\n")) {
    const d = line.replace(/^data:\s*/, "").trim(); if (!line.startsWith("data:") || !d || d === "[DONE]") continue;
    try { const ev = JSON.parse(d); const ch = ev.choices && ev.choices[0];
      text += typeof ev.response === "string" ? ev.response : (ch && ch.delta && ch.delta.content) || "";
      if (ch && ch.finish_reason) finish = ch.finish_reason; } catch (e) {}
  }
  console.log(`time ${((Date.now() - t0) / 1000).toFixed(1)}s, ${text.length} chars, finish=${finish}`);
  if (!text) console.log("RAW START:", sample);
  return text;
}
console.log("--- quick question");
console.log(await run({ prompt: "In two sentences, what should a visitor look for at the Parthenon?", tier: "quick" }));
console.log("--- Lisbon city guide");
const body = JSON.parse(fs.readFileSync("tools/ai-test-lisbon.json", "utf8"));
const out = await run(body);
try {
  const j = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
  const sites = j.sites || [];
  console.log("JSON OK. sites:", sites.length, "quick:", sites.filter(s => s.quick).length, "farther:", (j.farther || []).length, "restaurants:", (j.restaurants || []).length, "phrases:", ((j.basics || {}).phrases || []).length);
  for (const s of sites.slice(0, 16)) console.log(" -", s.name, s.lat, s.lng, s.minutes + "min", (s.guide || "").split(/\s+/).length + "w");
  console.log("first guide:", (sites[0] || {}).guide);
} catch (e) { console.log("JSON FAILED:", e.message, "\nEND OF TEXT:", out.slice(-600)); }
console.log("status after:", await (await fetch(URL_ + "/status")).text());
