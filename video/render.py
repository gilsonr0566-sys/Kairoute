#!/usr/bin/env python3
"""Renders the Kairoute sales video from the captured live-site screens (video-out/shots), the Aurora narration
(video-out/voice) and the brand intro. Usage: python3 video/render.py OUT.mp4 [--preview]"""
import json, os, re, subprocess, sys, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SH = os.path.join(ROOT, "video-out", "shots")
VO = os.path.join(ROOT, "video-out", "voice")
BRAND = "/mnt/project-files/brand/kairoute-intro.mp4"
LOGO = "/mnt/project-files/logos/kairoute-final/logo-png/kairoute-horizontal-reversed.png"
OUT = sys.argv[1]
PREVIEW = "--preview" in sys.argv
W, H, FPS = 1920, 1080, 30
BG, INK, ORANGE, MINT, PAPER = (18, 60, 58), (243, 245, 241), (233, 98, 46), (156, 214, 200), (243, 245, 241)
FD = "/usr/share/fonts/opentype/inter/"
F = lambda name, size: ImageFont.truetype(FD + name, size)
F_TITLE, F_KICK, F_CAP, F_END, F_END2 = F("InterDisplay-Bold.otf", 64), F("Inter-SemiBold.otf", 24), F("Inter-Medium.otf", 38), F("InterDisplay-Bold.otf", 96), F("InterDisplay-Medium.otf", 52)
XF = 0.45  # crossfade seconds

def dur(path):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]).strip())

# ---------- background, logo, frames ----------
def bg_image():
    im = Image.new("RGB", (W, H), BG); px = Image.new("L", (W, H), 0); d = ImageDraw.Draw(px)
    for r in range(900, 0, -12): d.ellipse([W * 0.62 - r * 1.4, H * 0.45 - r, W * 0.62 + r * 1.4, H * 0.45 + r], fill=int(40 * (1 - r / 900)))
    glow = Image.new("RGB", (W, H), (30, 92, 86)); im = Image.composite(glow, im, px.filter(ImageFilter.GaussianBlur(60)))
    return im
BGIM = bg_image()
def logo_rgba(width):
    im = Image.open(LOGO).convert("RGB"); w, h = im.size
    a = Image.eval(im.convert("L"), lambda v: 0 if v < 60 else min(255, (v - 60) * 3))
    # keep the orange dots: alpha from distance to the background colour
    import numpy as np
    arr = np.asarray(im).astype(int); dist = np.sqrt(((arr - np.array(BG)) ** 2).sum(-1)); al = np.clip((dist - 20) * 4, 0, 255).astype("uint8")
    out = im.convert("RGBA"); out.putalpha(Image.fromarray(al)); bb = out.getbbox(); out = out.crop(bb)
    return out.resize((width, int(out.height * width / out.width)), Image.LANCZOS)
LOGO_SM = logo_rgba(250)

# Tablet area (16:10) on the right, title panel on the left, captions at the bottom.
TAB = (520, 42, 520 + 1344, 42 + 840)  # screen box
BEZ = 22
def rounded(size, r):
    m = Image.new("L", size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], r, fill=255); return m
def shadow(base, box, r, blur=28, off=14, alpha=120):
    s = Image.new("L", (W, H), 0); ImageDraw.Draw(s).rounded_rectangle([box[0], box[1] + off, box[2], box[3] + off], r, fill=alpha)
    base.paste((0, 0, 0), (0, 0), s.filter(ImageFilter.GaussianBlur(blur)))
def wrap(draw, text, font, width):
    words, lines, cur = text.split(), [], ""
    for w_ in words:
        t = (cur + " " + w_).strip()
        if draw.textlength(t, font=font) <= width: cur = t
        else: lines.append(cur); cur = w_
    if cur: lines.append(cur)
    return lines
def panel(title, kicker):
    im = BGIM.copy(); d = ImageDraw.Draw(im)
    x = 56
    d.text((x, 120), kicker.upper(), font=F_KICK, fill=MINT)
    y = 165
    for ln in wrap(d, title, F_TITLE, 420): d.text((x, y), ln, font=F_TITLE, fill=INK); y += 76
    d.rounded_rectangle([x, y + 18, x + 70, y + 26], 4, fill=ORANGE)
    im.paste(LOGO_SM, (x, 790), LOGO_SM)
    return im
def tablet_frame(base):
    b = (TAB[0] - BEZ, TAB[1] - BEZ, TAB[2] + BEZ, TAB[3] + BEZ)
    shadow(base, b, 46)
    d = ImageDraw.Draw(base); d.rounded_rectangle(b, 46, fill=(14, 22, 24)); d.rounded_rectangle([b[0] + 2, b[1] + 2, b[2] - 2, b[3] - 2], 44, outline=(52, 64, 66), width=2)
    return base
def phones_frame(base, n):
    boxes = []; pw, ph = 372, 826; gap = 60; tot = n * pw + (n - 1) * gap; x0 = TAB[0] + (TAB[2] - TAB[0] - tot) // 2; y0 = TAB[1] + 6
    d = ImageDraw.Draw(base)
    for k in range(n):
        x = x0 + k * (pw + gap); b = (x - 14, y0 - 14, x + pw + 14, y0 + ph + 14); shadow(base, b, 52)
        d.rounded_rectangle(b, 52, fill=(14, 22, 24)); d.rounded_rectangle([b[0] + 2, b[1] + 2, b[2] - 2, b[3] - 2], 50, outline=(52, 64, 66), width=2)
        boxes.append((x, y0, x + pw, y0 + ph))
    return boxes

# ---------- shots ----------
_cache = {}
def load(name):
    p = os.path.join(SH, name + ".jpg")
    if not os.path.exists(p): return None
    if p not in _cache: _cache[p] = Image.open(p).convert("RGB")
    return _cache[p]
def first(*names):
    for n in names:
        if load(n) is not None: return n
    return None

class Clip:
    """One picture on screen. kind: tablet | phones | video | card. crop: (x0,y0,x1,y1) fractions of the screenshot."""
    def __init__(self, kind, src, crop=None, zoom=(1.0, 1.05), seq=None, pan=None):
        self.kind, self.src, self.crop, self.zoom, self.seq, self.pan = kind, src, crop, zoom, seq, pan
        self.dur = 0; self.screen = None; self.base = None

def fit_crop(img, crop, aspect):
    w, h = img.size
    if crop: x0, y0, x1, y1 = crop[0] * w, crop[1] * h, crop[2] * w, crop[3] * h
    else: x0, y0, x1, y1 = 0, 0, w, h
    cw, ch = x1 - x0, y1 - y0
    if cw / ch > aspect: nw = ch * aspect; x0 += (cw - nw) / 2; x1 = x0 + nw
    else: nh = cw / aspect; y0 += (ch - nh) / 2; y1 = y0 + nh
    return img.crop((int(x0), int(y0), int(x1), int(y1)))

def screen_frame(img, box, t, zoom, pan, radius):
    bw, bh = box[2] - box[0], box[3] - box[1]
    z = zoom[0] + (zoom[1] - zoom[0]) * ease(t)
    w, h = img.size; cw, ch = w / z, h / z
    px, py = pan if pan else (0.5, 0.5)
    if pan and len(pan) == 4: px = pan[0] + (pan[2] - pan[0]) * ease(t); py = pan[1] + (pan[3] - pan[1]) * ease(t)
    x0 = (w - cw) * px; y0 = (h - ch) * py
    fr = img.crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch))).resize((bw, bh), Image.BILINEAR)
    return fr, rounded((bw, bh), radius)
def ease(t): return 0.5 - 0.5 * math.cos(math.pi * max(0, min(1, t)))

# ---------- scene plan ----------
N = json.load(open(os.path.join(ROOT, "video", "narration.json")))
TXT = {s["id"]: s for s in N}
def T(*names, crop=None, zoom=(1.0, 1.05), pan=None):
    n = first(*names); return Clip("tablet", n, crop, zoom, pan=pan) if n else None
def P(*names):
    ns = [n for n in names if load(n) is not None]; return Clip("phones", ns) if ns else None

typing = sorted([f[:-4] for f in os.listdir(SH) if f.startswith("t03-wizard-type-")]) if os.path.isdir(SH) else []
SCENES = [
 ("s01", "", "", [Clip("video", BRAND)]),
 ("s02", "Plan in plain words", "Any trip", [T("t01-lobby"), T("t02-wizard-empty"), Clip("tablet", None, seq=typing) if typing else None, T("t04-wizard-filled", zoom=(1.0, 1.06))]),
 ("s03", "One trip, every kind of travel", "Flights, cruise, trains", [T("t05-trip-clean", "t05-trip"), T("t05-trip-clean", crop=(0.06, 0.4, 0.46, 1), zoom=(1.0, 1.05)), T("t28-trip-port-pinned"), T("t32-barcelona-leave-plan"), T("t31-madrid-arrive-plan")]),
 ("s04", "A real plan for every day", "Day plan", [T("t10-athens-plan"), T("t10-athens-plan", crop=(0.06, 0.3, 0.56, 0.9), zoom=(1.0, 1.08)), T("t10-athens-plan-scroll-1", crop=(0.55, 0, 1, 1)), T("t10-athens-plan-scroll-2"), T("t30-barcelona-plan")]),
 ("s05", "Your interests, your picks", "Change stops", [T("t11-sites"), T("t11-sites-scroll-1"), T("t12-sites-card"), T("t11-sites-scroll-2")]),
 ("s06", "Drag it. Heart it. Locked.", "Make it yours", [T("t13-compact", "x-compact"), P("x-drag"), T("t16-heart"), T("t16-heart", crop=(0.05, 0.05, 0.55, 0.4), zoom=(1.0, 1.08))]),
 ("s07", "Getting around, built in", "Ride buttons", [T("t24-rides-0"), T("t24-rides-1"), T("t24-rides-2"), T("t21-naples-plan-scroll-1")]),
 ("s08", "Made for cruise port days", "Leave by", [T("t20-kusadasi-plan"), T("t20-kusadasi-plan", crop=(0.06, 0.15, 0.56, 0.4), zoom=(1.0, 1.06)), T("t21-naples-plan"), T("t22-santorini-plan"), T("t26-ship-savings", "t25-guide-port")]),
 ("s09", "Boarding day and sea days", "Every day counts", [T("t41-boarding-set", "t40-boarding"), T("t42-boardcard"), T("t43-board-checklist"), T("t50-sea"), T("t51-sea-open", "t50-sea-scroll-1"), T("t50-sea-scroll-1")]),
 ("s10", "Your guide at every stop", "Audio guide", [T("t61-tour"), T("t27-tour-port")]),
 ("s11", "Your guide at every stop", "Prague Astronomical Clock", [T("t80-prague", zoom=(1.0, 1.08)), T("t80-prague-scroll")]),
 ("s12", "Your guide at every stop", "At your own pace", [T("t60-guide"), T("t60-guide-scroll")]),
 ("s13", "Offline and on paper", "Ready anywhere", [T("t70-offline-card", crop=(0.05, 0.22, 0.47, 0.62), zoom=(1.0, 1.04)), Clip("tablet", "print-1", zoom=(1.0, 1.06)), Clip("tablet", "print-2", zoom=(1.0, 1.06))]),
 ("s14", "Tablet and phone", "Wherever you are", [P("p10-athens-plan", "p20-kusadasi-plan", "p40-tour"), P("p50-trip", "p30-sea", "p60-journal"), T("t62-journal")]),
 ("s15", "", "", [Clip("card", "end")]),
]

# ---------- print pages from the captured print PDF ----------
pdf = os.path.join(ROOT, "video-out", "trip-print.pdf")
if not os.path.exists(pdf): pdf = "/mnt/project-files/print-plan/kairoute-trip-sample.pdf"
os.makedirs("/tmp/claude-0/pp", exist_ok=True)
subprocess.run(["pdftoppm", "-r", "110", "-f", "1", "-l", "3", "-png", pdf, "/tmp/claude-0/pp/pg"], check=True)
pages = sorted(os.listdir("/tmp/claude-0/pp"))
def print_spread(k):
    """Two printed pages side by side on a desk-like light background (16:10)."""
    im = Image.new("RGB", (2560, 1600), (226, 230, 224)); ps = [Image.open("/tmp/claude-0/pp/" + p).convert("RGB") for p in pages[k:k + 2]]
    x = 180
    for pg in ps:
        h = 1440; pg = pg.resize((int(pg.width * h / pg.height), h), Image.LANCZOS); m = Image.new("L", im.size, 0)
        ImageDraw.Draw(m).rectangle([x + 10, 90, x + pg.width + 10, 80 + h + 20], fill=90); im.paste((0, 0, 0), (0, 0), m.filter(ImageFilter.GaussianBlur(18)))
        im.paste(pg, (x, 80)); x += pg.width + 120
    return im
_cache[os.path.join(SH, "print-1.jpg")] = print_spread(0)
_cache[os.path.join(SH, "print-2.jpg")] = print_spread(1) if len(pages) > 2 else print_spread(0)
orig_load = load
def load(name):
    p = os.path.join(SH, name + ".jpg")
    return _cache.get(p) or orig_load(name)

# ---------- timing ----------
GAP = 1.0
timeline = []  # (scene id, start, length, audio path, audio offset)
t = 0.0
for sid, title, kick, clips in SCENES:
    s = TXT.get(sid, {})
    if sid == "s01": a = os.path.join(VO, "s01.mp3"); L = min(dur(BRAND), 1.8 + dur(a) + 1.6); timeline.append((sid, t, L, [(a, 1.8)])); t += L; continue
    if sid == "s11": a = [os.path.join(ROOT, "audio/prague-clock/p0-0.mp3"), os.path.join(ROOT, "audio/prague-clock/p0-1.mp3")]; d0 = dur(a[0]); L = d0 + 0.35 + dur(a[1]) + 0.9; timeline.append((sid, t, L, [(a[0], 0.4), (a[1], 0.4 + d0 + 0.35)])); t += L; continue
    if sid == "s15": a = os.path.join(VO, "s15.mp3"); L = dur(a) + 3.5; timeline.append((sid, t, L, [(a, 0.3)])); t += L; continue
    a = os.path.join(VO, sid + ".mp3"); L = dur(a) + GAP + 0.3; timeline.append((sid, t, L, [(a, 0.3)])); t += L
TOTAL = t
print("total %.1f s" % TOTAL)

# Captions: sentences spread over each narration by length.
caps = []
for sid, st, L, auds in timeline:
    s = TXT.get(sid, {});
    if sid == "s11":
        txt = ["Here we are. Look up at that tower. The big painted dial with the gold hands is the Prague Astronomical Clock, the orloj, as Czechs call it.",
               "This clock has been running since 1410. That's eighty-two years before Columbus sailed. And the people of Prague have kept it going, through fire, war and plenty of breakdowns, for more than six hundred years."]
        for (ap, off), tx in zip(auds, txt):
            d_ = dur(ap); parts = [p for p in re.split(r"(?<=[.!?])\s+", tx) if p]; tot = sum(len(p) for p in parts); c = st + off
            for p in parts: dd = d_ * len(p) / tot; caps.append((c, c + dd, p)); c += dd
        continue
    if not s.get("text"): continue
    ap, off = auds[0]; d_ = dur(ap) - 0.25
    parts = []
    for sent in re.split(r"(?<=[.!?:])\s+", s["text"]):
        while len(sent) > 96:
            cut = max(sent.rfind(", ", 0, 90), sent.rfind(" and ", 0, 90))
            if cut < 30: break
            parts.append(sent[:cut + 1].strip()); sent = sent[cut + 1:].strip()
        parts.append(sent)
    w_ = [len(p) + 12 for p in parts]; tot = sum(w_); c = st + off
    for p, ww in zip(parts, w_): dd = d_ * ww / tot; caps.append((c, c + dd - 0.05, p)); c += dd

# Clip times inside each scene.
plan = []
for (sid, title, kick, clips), (_, st, L, _) in zip(SCENES, timeline):
    clips = [c for c in clips if c]
    each = L / len(clips)
    for k, c in enumerate(clips):
        c.start = st + k * each; c.dur = each + (XF if not (sid == "s15" and k == len(clips) - 1) else 0); c.title, c.kick, c.sid = title, kick, sid
        plan.append(c)
plan[-1].dur = TOTAL - plan[-1].start

# ---------- frame builders ----------
_base = {}
def base_for(c):
    key = (c.kind, c.title, c.kick, len(c.src) if c.kind == "phones" else 0)
    if key not in _base:
        b = panel(c.title, c.kick)
        if c.kind == "tablet": tablet_frame(b); c.boxes = None
        elif c.kind == "phones": c.boxes = phones_frame(b, len(c.src))
        _base[key] = (b, getattr(c, "boxes", None))
    b, boxes = _base[key]; c.boxes = boxes; return b
def end_card():
    im = BGIM.copy(); d = ImageDraw.Draw(im); lg = logo_rgba(720); im.paste(lg, ((W - lg.width) // 2, 250), lg)
    for txt, fnt, y, col in [("A trip to remember.", F_END, 600, INK), ("Your vacation, your way.", F_END2, 730, MINT)]:
        w_ = d.textlength(txt, font=fnt); d.text(((W - w_) / 2, y), txt, font=fnt, fill=col)
    return im
END = end_card()
_vid = {}
def video_frame(c, lt):
    if c.src not in _vid:
        p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", c.src, "-vf", f"scale={W}:{H},fps={FPS}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
        frames = []
        while True:
            b = p.stdout.read(W * H * 3)
            if len(b) < W * H * 3: break
            frames.append(b)
        _vid[c.src] = frames
    fr = _vid[c.src]; i = min(len(fr) - 1, int(lt * FPS)); return Image.frombytes("RGB", (W, H), fr[i])

def compose(c, lt):
    u = lt / max(c.dur, 0.01)
    if c.kind == "video": return video_frame(c, lt)
    if c.kind == "card": return END.copy()
    base = base_for(c).copy()
    if c.kind == "tablet":
        name = c.src
        if c.seq: name = c.seq[min(len(c.seq) - 1, int(lt / (c.dur * 0.85 / len(c.seq))))]
        img = load(name)
        key = ("fit", name, c.crop)
        if key not in _cache: _cache[key] = fit_crop(img, c.crop, 1344 / 840)
        fr, m = screen_frame(_cache[key], TAB, u, c.zoom if not c.seq else (1.0, 1.0), c.pan, 26)
        base.paste(fr, TAB[:2], m)
    elif c.kind == "phones":
        for nm, bx in zip(c.src, c.boxes):
            key = ("fitp", nm)
            if key not in _cache: _cache[key] = fit_crop(load(nm), None, (bx[2] - bx[0]) / (bx[3] - bx[1]))
            fr, m = screen_frame(_cache[key], bx, u, (1.0, 1.03), None, 40); base.paste(fr, bx[:2], m)
    return base

_capimg = {}
def caption(base, tnow):
    cur = [c for c in caps if c[0] <= tnow < c[1]]
    if not cur: return base
    s, e, txt = cur[0]
    if txt not in _capimg:
        d = ImageDraw.Draw(base); lines = wrap(d, txt, F_CAP, 1500)
        h = 22 + 50 * len(lines); im = Image.new("RGBA", (W, h + 10), (0, 0, 0, 0)); dd = ImageDraw.Draw(im)
        widths = [dd.textlength(l, font=F_CAP) for l in lines]; bw = max(widths) + 56
        dd.rounded_rectangle([(W - bw) / 2, 0, (W + bw) / 2, h], 18, fill=(8, 26, 25, 215))
        for k, l in enumerate(lines): dd.text(((W - widths[k]) / 2, 10 + 50 * k), l, font=F_CAP, fill=(255, 255, 255, 255))
        _capimg[txt] = im
    im = _capimg[txt]; a = min(1, (tnow - s) / 0.15, (e - tnow) / 0.15)
    if a < 1: im = im.copy(); im.putalpha(Image.eval(im.getchannel("A"), lambda v: int(v * max(0, a))))
    base.paste(im, (0, H - im.height - 18), im); return base

# ---------- audio ----------
aud_inputs, filt = [], []
for sid, st, L, auds in timeline:
    for ap, off in auds:
        if os.path.exists(ap): aud_inputs.append((ap, st + off))
args = ["ffmpeg", "-y", "-v", "error"]
for ap, _ in aud_inputs: args += ["-i", ap]
f = "".join(f"[{k}:a]aresample=48000,adelay={int(o * 1000)}|{int(o * 1000)}[a{k}];" for k, (_, o) in enumerate(aud_inputs))
f += "".join(f"[a{k}]" for k in range(len(aud_inputs))) + f"amix=inputs={len(aud_inputs)}:normalize=0,apad,atrim=0:{TOTAL:.2f},loudnorm=I=-16:TP=-1.5[out]"
subprocess.run(args + ["-filter_complex", f, "-map", "[out]", "-ac", "2", "/tmp/claude-0/narr.wav"], check=True)

# ---------- video ----------
step = 6 if PREVIEW else 1
enc = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS / step), "-i", "-", "-i", "/tmp/claude-0/narr.wav",
                        "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", OUT], stdin=subprocess.PIPE)
nf = int(TOTAL * FPS)
for i in range(0, nf, step):
    tn = i / FPS
    act = [c for c in plan if c.start <= tn < c.start + c.dur]
    if not act: act = [plan[-1]]
    a = act[0]; fr = compose(a, tn - a.start)
    if len(act) > 1:
        b = act[1]; k = (tn - b.start) / XF
        if 0 <= k < 1: fr = Image.blend(fr, compose(b, tn - b.start), ease(k))
        elif k >= 1: fr = compose(b, tn - b.start)
    fr = caption(fr, tn)
    enc.stdin.write(fr.tobytes())
    if i % (FPS * 20) == 0: print("%.0f s" % tn, flush=True)
enc.stdin.close(); enc.wait()
json.dump([{"start": round(s, 2), "end": round(e, 2), "text": x} for s, e, x in caps], open(OUT + ".captions.json", "w"), indent=0)
print("done", OUT)
