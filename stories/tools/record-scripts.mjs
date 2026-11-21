// Records the app's hand-written stop scripts (src/features/stop-scripts.js) in every Kairoute guide voice with
// Kokoro (free, Apache 2.0), on GitHub's machines. Build time only: the app just plays the saved files.
// Output: audio/<script id>/<kokoro voice>/p<part>-<paragraph>.mp3, plus said.json (what each file says) so only
// changed paragraphs are recorded again.
import fs from "node:fs"; import vm from "node:vm"; import crypto from "node:crypto"; import { execFileSync } from "node:child_process";
import { KokoroTTS } from "kokoro-js";
const src = fs.readFileSync("src/features/stop-scripts.js", "utf8");
const body = src.slice(src.indexOf("const SAY ="), src.indexOf("// The script that belongs to a stop"));
const box = {}; vm.runInNewContext(body.replace("const SAY =", "SAY =").replace("const sayText =", "sayText =").replace("var STOP_SCRIPTS =", "STOP_SCRIPTS ="), box);
const { STOP_SCRIPTS, sayText } = box;
const voices = (process.argv[2] || "af_heart af_bella bf_emma am_michael bm_george").split(/\s+/).filter(Boolean);
const only = process.argv[3] || "";
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
const h = t => crypto.createHash("sha1").update(t).digest("hex").slice(0, 10);
let made = 0, kept = 0;
for (const sc of STOP_SCRIPTS) {
  if (only && sc.id !== only) continue;
  for (const voice of voices) {
    const dir = `audio/${sc.id}/${voice}`; fs.mkdirSync(dir, { recursive: true });
    const saidFile = `${dir}/said.json`, said = fs.existsSync(saidFile) ? JSON.parse(fs.readFileSync(saidFile, "utf8")) : {};
    const want = {};
    for (const [k, p] of sc.parts.entries()) for (const [i, t] of p.paras.entries()) {
      const f = `p${k}-${i}.mp3`, text = sayText(t); want[f] = h(voice + "|" + text);
      if (said[f] === want[f] && fs.existsSync(`${dir}/${f}`)) { kept++; continue; }
      const a = await tts.generate(text, { voice, speed: 0.95 }); await a.save("/tmp/s.wav");
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", "/tmp/s.wav", "-ac", "1", "-b:a", "48k", `${dir}/${f}`]);
      made++; console.log(sc.id, voice, f);
    }
    for (const f of fs.readdirSync(dir)) if (f.endsWith(".mp3") && !want[f]) fs.rmSync(`${dir}/${f}`); // paragraphs that no longer exist
    fs.writeFileSync(saidFile, JSON.stringify(want, null, 1));
  }
}
console.log(`made ${made}, kept ${kept}`);
