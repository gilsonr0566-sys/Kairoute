// Records the story library in the free Kokoro voice (Apache 2.0 model, run on GitHub's machines at build time; nothing
// runs on the traveler's phone). Each spoken paragraph becomes stories/<city>/audio/<story>/<voice>/<part>-<para>.mp3.
// A paragraph is re-recorded only when its words change (a hash of the spoken text is kept in the file name list).
// Usage: node render-voice.mjs <city> [voice] [story-id]
import fs from "node:fs"; import crypto from "node:crypto"; import { execFileSync } from "node:child_process";
import { KokoroTTS } from "kokoro-js";
const [city, voice = "af_heart", only] = process.argv.slice(2), dir = `stories/${city}`;
const files = fs.readdirSync(dir).filter(f => /^[a-z0-9-]+\.json$/.test(f) && !["sources.json", "check-report.json"].includes(f)).filter(f => !only || f === only + ".json");
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
// Pronunciation: the voice reads the "say" spelling; the screen shows the real one.
const lex = fs.existsSync("stories/say.json") ? JSON.parse(fs.readFileSync("stories/say.json", "utf8")) : [];
const sayIt = t => lex.reduce((a, [from, to]) => a.replace(new RegExp(`\\b${from}\\b`, "g"), to), t);
const manifest = {};
for (const f of files) {
  const st = JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8")), out = `${dir}/audio/${st.id}/${voice}`;
  fs.mkdirSync(out, { recursive: true }); manifest[st.id] = [];
  for (const [pi, part] of st.parts.entries()) {
    const paras = [part.stand ? { t: part.stand } : null, ...part.paras].filter(Boolean);
    for (const [qi, p] of paras.entries()) {
      const text = sayIt(p.t), h = crypto.createHash("sha1").update(voice + "|" + text).digest("hex").slice(0, 10);
      const name = `${pi}-${qi}-${h}.mp3`; manifest[st.id].push({ part: pi, para: qi, file: name, text: p.t });
      if (fs.existsSync(`${out}/${name}`)) continue;
      const t0 = Date.now(), audio = await tts.generate(text, { voice, speed: 0.95 });
      await audio.save(`/tmp/k.wav`);
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", "/tmp/k.wav", "-ac", "1", "-b:a", "64k", `${out}/${name}`]);
      console.log(st.id, name, ((Date.now() - t0) / 1000).toFixed(1) + "s");
    }
    for (const old of fs.readdirSync(out)) if (!manifest[st.id].some(x => x.file === old)) fs.unlinkSync(`${out}/${old}`);
  }
}
fs.writeFileSync(`${dir}/audio/manifest-${voice}${only ? "-" + only : ""}.json`, JSON.stringify(manifest, null, 1));
