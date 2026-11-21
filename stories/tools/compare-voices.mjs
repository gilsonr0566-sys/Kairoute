// Records the first lines of the Prague clock script (already recorded in Aurora, audio/prague-clock/p0-<i>.mp3) in
// several free Kokoro voices, so the two can be compared by ear on the same words. Output: stories/compare/<voice>/p0-<i>.mp3
import fs from "node:fs"; import { execFileSync } from "node:child_process"; import { KokoroTTS } from "kokoro-js";
const src = fs.readFileSync("src/features/stop-scripts.js", "utf8");
const paras = JSON.parse("[" + src.match(/"paras": \[\s*([\s\S]*?)\]/)[1] + "]").slice(0, 3);
const say = t => t.replace(/\borloj\b/gi, "orloy");
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
for (const voice of (process.argv[2] || "af_heart af_bella bf_emma am_michael bm_george").split(" ")) {
  fs.mkdirSync(`stories/compare/${voice}`, { recursive: true });
  for (const [i, p] of paras.entries()) {
    const a = await tts.generate(say(p), { voice, speed: 0.95 }); await a.save("/tmp/c.wav");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", "/tmp/c.wav", "-ac", "1", "-b:a", "64k", `stories/compare/${voice}/p0-${i}.mp3`]);
    console.log(voice, i);
  }
}
fs.writeFileSync("stories/compare/texts.json", JSON.stringify(paras, null, 1));
// voices default: af_heart af_bella bf_emma am_michael bm_george
