// Records the sales video's narration (video/narration.json) in Kairoute's voice, Aurora (Deepgram aura-2), through
// the AI helper's /speak with the recorder key (paid from the monthly extra, never travelers' daily allowance).
// Writes video-out/voice/<scene id>.mp3. About 2.7 neurons a character (~4,300 characters ≈ $0.13).
import fs from "node:fs"; import crypto from "node:crypto";
const T = process.env.CLOUDFLARE_API_TOKEN, AI = JSON.parse(fs.readFileSync("ai.json", "utf8")).url;
if (!T) { console.error("No CLOUDFLARE_API_TOKEN"); process.exit(1); }
const KEY = crypto.createHash("sha256").update(T).digest("hex").slice(0, 40);
const say = t => t.replace(/Kairoute/g, "Kai route");
fs.mkdirSync("video-out/voice", { recursive: true });
let failed = 0;
for (const s of JSON.parse(fs.readFileSync("video/narration.json", "utf8"))) {
  if (!s.text) continue; const f = `video-out/voice/${s.id}.mp3`; let ok = false;
  for (let k = 0; k < 4 && !ok; k++) {
    const r = await fetch(AI + "/speak", { method: "POST", headers: { "content-type": "application/json", "x-kairoute-rec": KEY }, body: JSON.stringify({ text: say(s.text), model: "aura-2", speaker: "aurora" }) });
    const b = Buffer.from(await r.arrayBuffer());
    if (r.ok && b.length > 1000 && /audio/.test(r.headers.get("content-type") || "")) { fs.writeFileSync(f, b); ok = true; console.log("recorded", f, b.length); }
    else { console.log("retry", f, r.status, b.toString("utf8", 0, 200)); await new Promise(z => setTimeout(z, 3000)); }
  }
  if (!ok) failed++;
}
if (failed) { console.log(failed + " failed"); process.exit(1); }
