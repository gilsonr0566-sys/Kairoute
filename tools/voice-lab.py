# Voice lab: records the same guide script in several voices and styles, then measures what makes speech
# sound stiff: how much the pitch moves (expressiveness), how fast it talks, and how it pauses.
import json, os, re, sys, functools, urllib.request, urllib.error, numpy as np, librosa
print = functools.partial(print, flush=True)
SUMMARY = os.environ.get("GITHUB_STEP_SUMMARY")
def note(msg):
    print(msg)
    if SUMMARY: open(SUMMARY, "a").write(msg + "\n")
URL = json.load(open("ai.json"))["url"]; H = {"content-type": "application/json", "Origin": "https://gilsonr0566-sys.github.io", "User-Agent": "Mozilla/5.0 (KairouteVoiceLab)"}
def post(path, body, raw=False):
    req = urllib.request.Request(URL + path, data=json.dumps(body).encode(), headers=H, method="POST")
    with urllib.request.urlopen(req, timeout=120) as r: return r.read() if raw else json.loads(r.read())
def get(path):
    req = urllib.request.Request(URL + path, headers=H)
    with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read())
RESERVE = 10000  # always leave this much of today's voice allowance for real app users
story = "As you stand before the Sé de Lisboa, you are looking at the spiritual heart of the city since the 12th century. Built on the site of a former mosque after the Christian reconquest in 1147, the cathedral has survived several earthquakes, including the devastating one of 1755. Its architecture is a blend of Romanesque, Gothic and Baroque styles because of the many rebuilds. Step inside and notice the rose window above the entrance, then walk to the Gothic cloister at the back, where excavations have uncovered Roman, Moorish and medieval remains."
st0 = get("/status"); print("STATUS:", st0)
need = len(story) * (6 * 1.364 + 11 * 2.728) * 1.15
if st0.get("voiceLeft", 0) < need + RESERVE:
    note(f"Voice lab skipped: it needs about {need:.0f} of today's voice allowance plus {RESERVE} kept for real users, and only {st0.get('voiceLeft')} is left. Nothing was spent. Run it again after the daily reset (6 pm Central).")
    sys.exit(0)
parts = post("/script", {"text": story})["parts"]
clean = [re.sub(r"^~\s*", "", p) for p in parts]
print("SCRIPT:"); [print("  " + p) for p in parts]
whole = " ".join(clean)
paras, cur = [], []
for p in parts:
    if p.startswith("~") and cur: paras.append(" ".join(cur)); cur = []
    cur.append(re.sub(r"^~\s*", "", p))
paras.append(" ".join(cur))
V = lambda n, m, sp, ch: (n, m, sp, ch)
variants = [V("a1-hera-lines", "aura-1", "hera", clean), V("a1-hera-whole", "aura-1", "hera", [whole]),
            V("a1-athena-UKf", "aura-1", "athena", [whole]), V("a1-angus-IEm", "aura-1", "angus", [whole]), V("a1-helios-UKm", "aura-1", "helios", [whole]), V("a1-orion-USm", "aura-1", "orion", [whole]),
            V("a2-thalia", "aura-2", "thalia", [whole]), V("a2-andromeda", "aura-2", "andromeda", [whole]), V("a2-helena", "aura-2", "helena", [whole]), V("a2-aurora", "aura-2", "aurora", [whole]),
            V("a2-theia", "aura-2", "theia", [whole]), V("a2-pandora", "aura-2", "pandora", [whole]), V("a2-draco", "aura-2", "draco", [whole]), V("a2-hyperion", "aura-2", "hyperion", [whole]),
            V("a2-apollo", "aura-2", "apollo", [whole]), V("a2-arcas", "aura-2", "arcas", [whole]), V("a2-thalia-paras", "aura-2", "thalia", paras)]
os.makedirs("voice-lab", exist_ok=True); rows = []
stopped = False
for name, model, sp, chunks in variants:
    if stopped: break
    ys = []
    for i, c in enumerate(chunks):
        try: mp3 = post("/speak", {"text": c, "model": model, "speaker": sp}, raw=True)
        except urllib.error.HTTPError as e:
            note(f"Stopped at {name}: the server said {e.code} {e.read()[:200]!r}. Results so far are below."); stopped = True; break
        fn = f"voice-lab/{name}-{i}.mp3"; open(fn, "wb").write(mp3)
        y, sr = librosa.load(fn, sr=16000); ys.append(y); ys.append(np.zeros(int(sr * (0.5 if len(chunks) > 1 else 0))))
    if stopped: break
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
if SUMMARY and rows:
    open(SUMMARY, "a").write("| voice | secs | wpm | pitchSD | range | pauses | avgP | sdP |\n|---|---|---|---|---|---|---|---|\n" + "".join("| %s | %.1f | %.0f | %.2f | %.1f | %d | %.2f | %.2f |\n" % r for r in rows))
