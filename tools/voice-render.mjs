// Records the hand-written stop scripts (src/features/stop-scripts.js) in Kairoute's voice, Aurora (Deepgram
// aura-2 on Cloudflare Workers AI), one file per paragraph: audio/<script id>/p<part>-<paragraph>.mp3.
// Only paragraphs whose words changed are recorded again (audio/<id>/manifest.json keeps a hash of each).
// Records through Kairoute's AI helper (/speak with the recorder key, which is derived from CLOUDFLARE_API_TOKEN
// and set on the helper by the "Publish website" workflow), paid from the monthly extra. Cost: about 2.7 neurons a character (11,400 characters ≈ 31,000 neurons ≈ $0.35).
// Usage: node tools/voice-render.mjs [--dry]
import fs from "node:fs"; import vm from "node:vm"; import crypto from "node:crypto";
const dry = process.argv.includes("--dry");
const code = fs.readFileSync("src/features/stop-scripts.js", "utf8");
const noop = () => {}, ctx = vm.createContext({ partSpeech: noop, speakText: noop, speakSite: noop, updateAudioUI: noop });
const { S, say } = vm.runInContext(code + "\n;({ S: STOP_SCRIPTS, say: sayText })", ctx);
const T = process.env.CLOUDFLARE_API_TOKEN, AI = JSON.parse(fs.readFileSync("ai.json", "utf8")).url;
const KEY = T ? crypto.createHash("sha256").update(T).digest("hex").slice(0, 40) : "";
if (!dry && !T) { console.error("No CLOUDFLARE_API_TOKEN"); process.exit(1); }
let made = 0, kept = 0, chars = 0, failed = 0;
for (const sc of S) {
  const dir = `audio/${sc.id}`; fs.mkdirSync(dir, { recursive: true });
  const mf = `${dir}/manifest.json`, old = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, "utf8")) : {}, now = {};
  for (const [k, p] of sc.parts.entries()) for (const [i, para] of p.paras.entries()) {
    const text = say(para), h = crypto.createHash("sha1").update("aura-2:aurora:" + text).digest("hex").slice(0, 16), f = `${dir}/p${k}-${i}.mp3`;
    now[`p${k}-${i}`] = h;
    if (old[`p${k}-${i}`] === h && fs.existsSync(f) && fs.statSync(f).size > 1000) { kept++; continue; }
    chars += text.length; if (dry) { console.log("would record", f, text.length); continue; }
    let ok = false;
    for (let tries = 0; tries < 3 && !ok; tries++) {
      const r = await fetch(AI + "/speak", { method: "POST", headers: { "content-type": "application/json", "x-kairoute-rec": KEY }, body: JSON.stringify({ text, model: "aura-2", speaker: "aurora" }) });
      const b = Buffer.from(await r.arrayBuffer());
      if (r.ok && b.length > 1000 && /audio/.test(r.headers.get("content-type") || "")) { fs.writeFileSync(f, b); ok = true; made++; console.log("recorded", f, b.length, "bytes"); }
      else { console.log("retry", f, r.status, b.toString("utf8", 0, 200)); await new Promise(z => setTimeout(z, 2000)); }
    }
    if (!ok) { failed++; delete now[`p${k}-${i}`]; }
  }
  if (dry) continue;
  // Files for paragraphs that no longer exist are removed.
  for (const fn of fs.readdirSync(dir)) if (/^p\d+-\d+\.mp3$/.test(fn) && !now[fn.slice(0, -4)]) fs.unlinkSync(`${dir}/${fn}`);
  fs.writeFileSync(mf, JSON.stringify(now, null, 1) + "\n");
}
console.log(`Stop scripts: ${made} recorded, ${kept} unchanged, ${failed} failed, ${chars} characters (~${Math.round(chars * 2.73)} neurons)`);
if (failed) process.exit(1);
