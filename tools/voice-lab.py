# Voice lab: records the same guide script in several voices and styles, then measures what makes speech
# sound stiff: how much the pitch moves (expressiveness), how fast it talks, and how it pauses.
import json, os, re, sys, urllib.request, numpy as np, librosa
URL = json.load(open("ai.json"))["url"]; H = {"content-type": "application/json", "Origin": "https://gilsonr0566-sys.github.io"}
def post(path, body, raw=False):
    req = urllib.request.Request(URL + path, data=json.dumps(body).encode(), headers=H, method="POST")
    with urllib.request.urlopen(req, timeout=120) as r: return r.read() if raw else json.loads(r.read())
story = "As you stand before the Sé de Lisboa, you are looking at the spiritual heart of the city since the 12th century. Built on the site of a former mosque after the Christian reconquest in 1147, the cathedral has survived several earthquakes, including the devastating one of 1755. Its architecture is a blend of Romanesque, Gothic and Baroque styles because of the many rebuilds. Step inside and notice the rose window above the entrance, then walk to the Gothic cloister at the back, where excavations have uncovered Roman, Moorish and medieval remains."
parts = post("/script", {"text": story})["parts"]
clean = [re.sub(r"^~\s*", "", p) for p in parts]
print("SCRIPT:"); [print("  " + p) for p in parts]
whole = " ".join(clean)
paras, cur = [], []
for p in parts:
    if p.startswith("~") and cur: paras.append(" ".join(cur)); cur = []
    cur.append(re.sub(r"^~\s*", "", p))
paras.append(" ".join(cur))
variants = [("a1-hera-lines", "aura-1", "hera", clean), ("a1-hera-whole", "aura-1", "hera", [whole]), ("a1-asteria-whole", "aura-1", "asteria", [whole]),
            ("a1-athena-whole", "aura-1", "athena", [whole]), ("a1-luna-whole", "aura-1", "luna", [whole]), ("a1-stella-whole", "aura-1", "stella", [whole]),
            ("a2-thalia-whole", "aura-2", "thalia", [whole]), ("a2-andromeda-whole", "aura-2", "andromeda", [whole]), ("a2-helena-whole", "aura-2", "helena", [whole]),
            ("a2-cora-whole", "aura-2", "cora", [whole]), ("a2-iris-whole", "aura-2", "iris", [whole]), ("a2-aurora-whole", "aura-2", "aurora", [whole]),
            ("a2-thalia-paras", "aura-2", "thalia", paras), ("a2-hera-whole", "aura-2", "hera", [whole])]
os.makedirs("voice-lab", exist_ok=True); rows = []
for name, model, sp, chunks in variants:
    ys = []
    for i, c in enumerate(chunks):
        mp3 = post("/speak", {"text": c, "model": model, "speaker": sp}, raw=True)
        fn = f"voice-lab/{name}-{i}.mp3"; open(fn, "wb").write(mp3)
        y, sr = librosa.load(fn, sr=16000); ys.append(y); ys.append(np.zeros(int(sr * (0.5 if len(chunks) > 1 else 0))))
    y = np.concatenate(ys); sr = 16000
    import soundfile as sf; sf.write(f"voice-lab/{name}.wav", y, sr)
    f0, vf, _ = librosa.pyin(y, fmin=70, fmax=400, sr=sr, frame_length=1024)
    f = f0[vf & ~np.isnan(f0)]; st = 12 * np.log2(f / np.median(f))
    # pitch movement inside each spoken stretch (stiff speech is flat and resets the same way each sentence)
    rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=256)[0]; thr = np.percentile(rms, 30) * 1.5
    sil = rms < thr; hop = 256 / sr; pauses = []; run = 0
    for s_ in sil:
        if s_: run += 1
        else:
            if run * hop >= 0.18: pauses.append(run * hop)
            run = 0
    dur = len(y) / sr; words = len(whole.split()); speech = dur - sum(pauses)
    rows.append((name, dur, words / speech * 60, np.std(st), np.percentile(st, 95) - np.percentile(st, 5), len(pauses), np.mean(pauses) if pauses else 0, np.std(pauses) if pauses else 0))
print("\n%-20s %6s %6s %7s %7s %6s %7s %7s" % ("voice", "secs", "wpm", "pitchSD", "range", "pauses", "avgP", "sdP"))
for r in rows: print("%-20s %6.1f %6.0f %7.2f %7.1f %6d %7.2f %7.2f" % r)
