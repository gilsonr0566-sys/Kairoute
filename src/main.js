(() => {
"use strict";

// ---------- Capabilities (AI + voice) ----------
let sample = null, tts = null;
const cl = window.claude;
if (cl && cl.use) {
  cl.use("sample").then(s => { sample = s; render(); }).catch(() => {});
  cl.use("tts").then(t => { tts = t; if (t) t.onState(({ state }) => { ttsState = state; updateAudioUI(); }); }).catch(() => {});
}
// On the website (no Claude app around it), the AI guide runs on the traveler's own Anthropic key.
const KEY_STORE = "kairoute.key";
const WEB_MODELS = { quick: "claude-haiku-5-5", default: "claude-sonnet-5-5", complex: "claude-sonnet-5-5" };
const getKey = () => { try { return localStorage.getItem(KEY_STORE) || ""; } catch (e) { return ""; } };
const blobB64 = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(b); });
async function webSample(prompt, opts = {}) {
  const key = getKey(); if (!key) throw new Error("No AI key");
  const content = [];
  for (const b of opts.images || []) content.push({ type: "image", source: { type: "base64", media_type: b.type || "image/jpeg", data: await blobB64(b) } });
  content.push({ type: "text", text: prompt });
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: WEB_MODELS[opts.modelTier] || WEB_MODELS.default, max_tokens: 16000, stream: true, messages: [{ role: "user", content }] })
  });
  if (!resp.ok) { let m = resp.status + ""; try { m = (await resp.json()).error.message; } catch (e) {} throw new Error(resp.status === 401 ? "The AI key was not accepted. Check it in Settings." : m); }
  const rd = resp.body.getReader(), dec = new TextDecoder(); let buf = "", text = "", stop = null;
  for (;;) {
    const { done, value } = await rd.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      let ev; try { ev = JSON.parse(line.slice(5)); } catch (e) { continue; }
      if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") { text += ev.delta.text; if (opts.onText) opts.onText({ text }); }
      else if (ev.type === "message_delta" && ev.delta) stop = ev.delta.stop_reason;
      else if (ev.type === "error") throw new Error((ev.error && ev.error.message) || "AI error");
    }
  }
  return { text, truncated: stop === "max_tokens" };
}
if (!(cl && cl.use) && getKey()) sample = webSample;
// Free test AI: Kairoute's own Cloudflare Worker in front of Workers AI. The site finds it through ai.json.
let freeAI = null; // { url, left, budget }
const blobURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b); });
async function freeSample(prompt, opts = {}) {
  const images = []; for (const b of opts.images || []) images.push(await blobURL(b));
  const resp = await fetch(freeAI.url + "/sample", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, images, tier: opts.modelTier || "default" }) });
  if (!resp.ok) { let m = "The AI guide is busy. Try again in a minute."; try { m = (await resp.json()).error || m; } catch (e) {} throw new Error(m); }
  let text = "", stop = null;
  if (/json/.test(resp.headers.get("content-type") || "")) {
    // The Worker answers in one piece (streaming used too much of the free plan's CPU), so show steady progress while we wait.
    const t0 = Date.now(), tick = opts.onText ? setInterval(() => opts.onText({ text: "x".repeat(Math.round((Date.now() - t0) / 1000 * 130)) }), 700) : null;
    try { const j = await resp.json(); text = String(j.text || ""); stop = j.finish || null; } finally { if (tick) clearInterval(tick); }
    if (opts.onText && text) opts.onText({ text });
  } else {
    const rd = resp.body.getReader(), dec = new TextDecoder(); let buf = "";
    for (;;) {
      const { done, value } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i; while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim(); if (!data || data === "[DONE]") continue;
        let ev; try { ev = JSON.parse(data); } catch (e) { continue; }
        const ch = ev.choices && ev.choices[0];
        const piece = typeof ev.response === "string" ? ev.response : ch && ch.delta && typeof ch.delta.content === "string" ? ch.delta.content : "";
        if (ch && ch.finish_reason) stop = ch.finish_reason;
        if (piece) { text += piece; if (opts.onText) opts.onText({ text }); }
      }
    }
  }
  if (!text.trim()) throw new Error("The AI guide sent an empty answer. Try again.");
  refreshFreeAI();
  return { text, truncated: stop === "length" };
}
async function refreshFreeAI() {
  if (!freeAI) return;
  try { const st = await (await fetch(freeAI.url + "/status", { cache: "no-store" })).json(); freeAI.left = st.left; freeAI.budget = st.budget; } catch (e) {}
}
async function findFreeAI() {
  if (cl && cl.use) return;
  for (const src of ["ai.json", "https://gilsonr0566-sys.github.io/Kairoute/ai.json"]) {
    try {
      const r = await fetch(src, { cache: "no-store" }); if (!r.ok) continue;
      const j = await r.json(); if (!j || !/^(https:\/\/|http:\/\/localhost)/.test(j.url || "")) continue;
      freeAI = { url: j.url.replace(/\/$/, "") }; await refreshFreeAI();
      if (!getKey()) sample = freeSample;
      if (typeof render === "function") render();
      if (typeof checkSavedCities === "function") checkSavedCities();
      return;
    } catch (e) {}
  }
}
setTimeout(findFreeAI, 0);
// Inside the Android app, native plugins give us device voices and keep the screen awake on tour.
const NATIVE = (window.Capacitor && window.Capacitor.Plugins) || {};
const nativeTTS = NATIVE.TextToSpeech || null, keepAwake = NATIVE.KeepAwake || null;
let ttsState = "idle", speakingId = null, audioUnavailable = false;

// ---------- Constants ----------
const DAY_TYPES = [
  { key: "land", label: "Sightseeing from my hotel", short: "Land day", icon: "⌂" },
  { key: "arrival", label: "Arriving (flight, train or ship)", short: "Arriving", icon: "↘" },
  { key: "departure", label: "Leaving (flight or train)", short: "Leaving", icon: "↗" },
  { key: "embark", label: "Boarding the cruise", short: "Boarding", icon: "⚓" },
  { key: "port", label: "Cruise port day", short: "In port", icon: "⚓" },
  { key: "sea", label: "Day at sea", short: "At sea", icon: "〰" }
];
const MODES = { flight: { label: "Flight", list: "airport", clear: 75, need: 180, word: "airport" }, train: { label: "Train", list: "station", clear: 15, need: 30, word: "station" }, ship: { label: "Ship", list: "cruise", clear: 60, need: 60, word: "port" }, car: { label: "Car or bus", list: "hotel", clear: 10, need: 20, word: "starting point" } };
const INTERESTS = [["history", "History"], ["art", "Art & museums"], ["architecture", "Architecture"], ["food", "Food & markets"], ["views", "Views & nature"], ["churches", "Churches & faith"], ["bible", "Bible sites: St Paul & St John"], ["shopping", "Shopping"], ["beaches", "Beaches"], ["kids", "Kid-friendly"]];
const INTEREST_WORDS = { history: ["history", "roman", "medieval", "ancient", "war", "castle", "ruins"], art: ["museum", "art", "picasso", "painting", "gallery"], architecture: ["architecture", "gaudí", "gaudi", "house", "façade", "building", "palace"], food: ["market", "food", "tapas"], views: ["view", "park", "hill", "garden", "nature"], churches: ["church", "basilica", "cathedral", "monastery", "chapel", "shrine", "madonna", "synagogue", "mosque", "temple"], bible: ["paul", "apostle", "bible", "biblical", "christian", "saint", "basilica", "church", "cathedral", "monastery"], shopping: ["shop", "market", "street"], beaches: ["beach", "sea"], kids: ["park", "beach", "amusement", "zoo"] };
// Religious sites: places of worship (churches, monasteries, mosques, synagogues...). Ancient ruins of temples
// count as history, not worship. With "Religious sites: Skip them" on a trip, these leave suggestions, except a
// must-see landmark that happens to be religious (e.g. the Sagrada Família) stays as a normal sight.
const RELIGIOUS_RE = /\b(church|cathedral|basilica|monaster|chapel|shrine|mosque|synagogue|abbey|convent|sanctuary|pilgrim|religious|holy|parish|agios|agia|panagia|san |santa |saint|st\.? )/i;
const isReligious = x => !!x && RELIGIOUS_RE.test((x.category || "") + " " + (x.name || "")) && !/ancient|ruin|archaeolog/i.test((x.category || "") + " " + (x.name || ""));
const skipReligious = () => P().religious === "off";
const religiousOk = x => !skipReligious() || !isReligious(x) || x.mustSee;
// Quiet places (churches, monasteries, museums...): text first, and audio only once the traveler confirms
// earbuds (a web page can't reliably tell if earbuds are connected). Settings > Quiet places: Automatic, Always, Off.
const isQuietPlace = x => !!x && (isReligious(x) || /museum|gallery|library|crypt|catacomb|tomb|memorial|cemetery/i.test((x.category || "") + " " + (x.name || "")));
const quietOn = x => appSet.quiet === "always" || (appSet.quiet !== "off" && isQuietPlace(x));
let earbudsOkUntil = 0;
const MEALS = [
  { label: "Lunch", from: 11 * 60 + 45, to: 14 * 60 + 30, len: 60 },
  { label: "Dinner", from: 18 * 60 + 30, to: 21 * 60, len: 75 }
];

// ---------- State ----------
const cities = { barcelona: SAMPLE_CITY };
const keyOf = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
let idSeq = 1;
function newDay(o) {
  return Object.assign({ id: "d" + (idSeq++), date: "", destination: "", type: "land", mode: "flight", time: "", pointIdx: 0,
    portArrive: "08:00", allAboard: "17:00", tender: false, startTime: "09:00", hours: 8, alongWay: true, returnToStart: true,
    event: "", selected: null, cityKey: null }, o || {});
}
function defaultPrefs() { return { pace: "moderate", walk: "medium", interests: [], travelers: "", access: "none", party: 2, lang: "English", voice: "buttery" }; }
const P = () => Object.assign(defaultPrefs(), trip.prefs || {});
const LANGS = [["English", "en"], ["Spanish", "es"], ["French", "fr"], ["German", "de"], ["Italian", "it"], ["Portuguese", "pt"]];
// Which of the app's languages a piece of text is written in, from its most common small words.
const LANG_WORDS = {
  English: "the and of to in is you that it was for on with as this are from at by his an which its were built here your can".split(" "),
  Spanish: "el la de que y en los las del se por un una con para es su al lo como más pero sus fue este esta".split(" "),
  French: "le la les de des et en un une du est que qui dans pour sur au aux par il ce cette vous était son".split(" "),
  German: "der die das und ist in den von zu mit sich des auf für im dem nicht ein eine als auch es an wurde".split(" "),
  Italian: "il la di che e in un una per del della è con non le dei si al da sono come gli nel alla questo".split(" "),
  Portuguese: "o a de que e do da em um uma para com não os as dos das se por mais foi no na ao você".split(" ")
};
function textLang(text) {
  const words = String(text || "").toLowerCase().match(/[a-zà-öø-ÿ]+/g) || [];
  if (words.length < 30) return null;
  let best = null, top = 0;
  for (const L in LANG_WORDS) { const set = new Set(LANG_WORDS[L]); const n = words.filter(w => set.has(w)).length / words.length; if (n > top) { top = n; best = L; } }
  return best;
}
// True when a guide's narration is in the traveler's language (or too short to tell).
function guideInLang(c, lang) {
  const txt = [...((c && c.sites) || []), ...((c && c.farther) || [])].slice(0, 8).map(x => (x && (x.guide || x.summary)) || "").join(" ");
  const got = textLang(txt); return !got || got === (lang || "English");
}
const langCode = n => (LANGS.find(x => x[0] === n) || LANGS[0])[1];
const VOICES = [["buttery", "Warm"], ["airy", "Light"], ["glassy", "Clear"], ["rounded", "Deep"]];
// Natural guide voices (Deepgram Aura 2). Picked from a 17-voice listening test (Nov 2026): these moved
// the most in pitch and paced most like a real guide. Chosen once in Settings and used for every stop.
const GUIDES = [
  ["aurora", "Aurora", "Woman, American"], ["andromeda", "Andromeda", "Woman, American, softer"], ["pandora", "Pandora", "Woman, British"], ["theia", "Theia", "Woman, Australian"],
  ["apollo", "Apollo", "Man, American"], ["arcas", "Arcas", "Man, American, deeper"], ["draco", "Draco", "Man, British"], ["hyperion", "Hyperion", "Man, Australian"]];
const guideVoice = () => ({ model: "aura-2", speaker: GUIDES.some(g => g[0] === appSet.guide) ? appSet.guide : "aurora" });
const GUIDE_PACE = 0.9; // the voices speak at ~210-225 words a minute; a real guide is nearer 170-190
const ACCESS = [["none", "No special needs"], ["limited", "Limited walking"], ["wheelchair", "Wheelchair or scooter"], ["kids", "Young kids or a stroller"]];
const DOWS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
function closedOn(s, iso) { if (!s.closed || !iso) return false; const dow = DOWS[new Date(iso + "T12:00:00Z").getUTCDay()]; return s.closed.toLowerCase().includes(dow.toLowerCase()); }
function addDays(iso, n) { const dt = new Date(iso + "T12:00:00Z"); dt.setUTCDate(dt.getUTCDate() + n); return dt.toISOString().slice(0, 10); }
const SAMPLE_ID = "sample-sunprincess-2027";
function sampleTrip() {
  const days = [
    newDay({ date: "2027-06-30", destination: "Athens", type: "arrival", mode: "flight", time: "10:30", hours: 6 }),
    newDay({ date: "2027-07-01", destination: "Athens", type: "land" }),
    newDay({ date: "2027-07-02", destination: "Athens", type: "land" }),
    newDay({ date: "2027-07-03", destination: "Athens", type: "land" }),
    newDay({ date: "2027-07-04", destination: "Athens (Piraeus)", type: "embark", startTime: "09:00", allAboard: "18:30" }),
    newDay({ date: "2027-07-05", destination: "Heraklion, Crete", type: "port", portArrive: "07:00", allAboard: "16:30" }),
    newDay({ date: "2027-07-06", destination: "Kusadasi (Ephesus)", type: "port", portArrive: "09:00", allAboard: "18:30" }),
    newDay({ date: "2027-07-07", destination: "Santorini", type: "port", portArrive: "07:00", allAboard: "20:30", tender: true }),
    newDay({ date: "2027-07-08", destination: "Mykonos", type: "port", portArrive: "08:00", allAboard: "20:30" }),
    newDay({ date: "2027-07-09", destination: "Chania, Crete", type: "port", portArrive: "08:00", allAboard: "17:30" }),
    newDay({ date: "2027-07-10", destination: "At sea", type: "sea" }),
    newDay({ date: "2027-07-11", destination: "Messina, Sicily", type: "port", portArrive: "08:00", allAboard: "17:30" }),
    newDay({ date: "2027-07-12", destination: "Naples (Capri, Sorrento)", type: "port", portArrive: "07:00", allAboard: "18:30" }),
    newDay({ date: "2027-07-13", destination: "Civitavecchia (Rome)", type: "port", portArrive: "07:00", allAboard: "20:30" }),
    newDay({ date: "2027-07-14", destination: "At sea", type: "sea" }),
    newDay({ date: "2027-07-15", destination: "Barcelona", type: "arrival", mode: "ship", time: "07:00", hours: 9, pointIdx: 0, cityKey: "barcelona", selected: ["gothic", "rambla", "smdm", "picasso", "born"] }),
    newDay({ date: "2027-07-16", destination: "Barcelona", type: "land", cityKey: "barcelona", selected: ["sagrada", "santpau", "batllo", "pedrera", "gracia"] }),
    newDay({ date: "2027-07-17", destination: "Barcelona", type: "land", cityKey: "barcelona", startTime: "09:30", hours: 7, selected: ["montserrat"] }),
    newDay({ date: "2027-07-18", destination: "Barcelona", type: "departure", mode: "train", time: "13:00", startTime: "09:00", cityKey: "barcelona", selected: ["parkguell"] }),
    newDay({ date: "2027-07-18", destination: "Madrid", type: "arrival", mode: "train", time: "15:45", hours: 5 }),
    newDay({ date: "2027-07-19", destination: "Madrid", type: "land" }),
    newDay({ date: "2027-07-20", destination: "Madrid", type: "departure", mode: "flight", time: "16:00", startTime: "09:00" })
  ];
  return { id: SAMPLE_ID, name: "Athens, Sun Princess cruise, Barcelona & Madrid", active: 15, style: "mix", prefs: Object.assign(defaultPrefs(), { interests: ["bible", "churches"] }), lodging: { barcelona: { idx: 0 } }, days, sample: true };
}
let trip = sampleTrip();
let library = [];
let view = "lobby", siteFilter = "all", busy = null, aiError = "", tripText = "";
let resetAsk = false, tourTimer = null, delAsk = null, renameId = null;
let wiz = null, cdTimer = null, cdPreview = null, cdSpoken = false, cdWhere = null;
const translations = {};
const deeper = {}, answers = {};
try {
  const saved = JSON.parse(localStorage.getItem("wayside.trip2") || "null");
  const savedCities = JSON.parse(localStorage.getItem("wayside.cities") || "null");
  if (savedCities) {
    for (const k in savedCities) { const c = savedCities[k]; if (c && c.ai && !guideInLang(c, c.lang)) delete savedCities[k]; } // an older build could come back in the wrong language
    Object.assign(cities, savedCities, { barcelona: SAMPLE_CITY });
  }
  if (saved && saved.days && saved.days.length) { trip = saved; idSeq = 1000; }
  library = JSON.parse(localStorage.getItem("wayside.library") || "[]") || [];
} catch (e) {}
// The old example trip had placeholder cruise ports; swap it for the real Sun Princess sailing.
if (trip.id === "sample") trip = sampleTrip();
library = library.filter(x => x.id !== "sample");
// Richard wants St Paul and St John sites on his trip: switch the Bible interest on once.
try { if (!localStorage.getItem("kairoute.bible1")) { localStorage.setItem("kairoute.bible1", "1"); [trip, ...library.map(x => x.trip)].forEach(t => { if (t && t.id === SAMPLE_ID) { t.prefs = Object.assign(defaultPrefs(), t.prefs || {}); ["bible", "churches"].forEach(k => { if (!t.prefs.interests.includes(k)) t.prefs.interests.push(k); }); } }); } } catch (e) {}
// One time: put Richard's real Sun Princess trip in front, so nobody keeps working from an older, wrong reading of it.
try {
  if (!localStorage.getItem("kairoute.sunprincess1")) {
    localStorage.setItem("kairoute.sunprincess1", "1");
    library.forEach(x => { if (x.id !== SAMPLE_ID && /athens|sun princess|barcelona|madrid/i.test(x.name || "") && !x.trip.archived) x.trip.archived = true; });
    if (trip.id !== SAMPLE_ID) { if (/athens|sun princess|barcelona|madrid/i.test(trip.name || "")) trip.archived = true; const e = library.find(x => x.id === trip.id); if (e) e.trip = trip; else if (!trip.placeholder) library.unshift({ id: trip.id, name: trip.name || "Trip", updated: Date.now() - 1000, trip }); }
    trip = sampleTrip(); save();
  }
} catch (e) {}
if (!trip.prefs) trip.prefs = defaultPrefs();
// One time: trips planned before the no-repeats rule had the same sights on every day in a city. Spread them out.
function spreadPicks(t) {
  const seen = {};
  t.days.forEach(d => {
    const k = d.cityKey || keyOf(d.destination); if (!d.selected || !k) return;
    seen[k] = seen[k] || new Set();
    const keep = d.selected.filter(id => !seen[k].has(id));
    if (keep.length < d.selected.length) { d.selected = keep; d.respread = true; }
    keep.forEach(id => seen[k].add(id));
  });
}
try { if (!localStorage.getItem("kairoute.spread1")) { localStorage.setItem("kairoute.spread1", "1"); spreadPicks(trip); library.forEach(x => { if (x.trip && x.trip !== trip) spreadPicks(x.trip); }); } } catch (e) {}
if (!trip.id) trip.id = "t" + Date.now();
function storeInLibrary() {
  if (trip.placeholder) return;
  const i = library.findIndex(x => x.id === trip.id);
  const entry = { id: trip.id, name: trip.name || tripName(trip), updated: Date.now(), trip };
  if (i >= 0 && library[i].stamps) entry.stamps = library[i].stamps;
  if (i >= 0 && library[i].sums) entry.sums = library[i].sums;
  if (i >= 0) library[i] = entry; else library.unshift(entry);
}
function tripName(t) {
  const names = []; t.days.forEach(d => { if (d.type !== "sea" && d.type !== "port" && d.destination && !names.includes(d.destination)) names.push(d.destination); });
  return names.slice(0, 4).join(", ") || "New trip";
}
function save() {
  try {
    storeInLibrary();
    localStorage.setItem("wayside.trip2", JSON.stringify(trip));
    localStorage.setItem("wayside.library", JSON.stringify(library));
    const gen = {}; for (const k in cities) if (k !== "barcelona" && !cities[k].builtin) gen[k] = cities[k];
    localStorage.setItem("wayside.cities", JSON.stringify(gen));
  } catch (e) {}
  try { syncSoon(); } catch (e) {} // (not ready yet while the app is still starting up)
}
// ---- Sync between devices ----
// Turning sync on gives a short code; typing that code on another device links it. Every trip (with its journal)
// and the city guides built for them then stay the same on all linked devices. Each trip carries the time it last
// really changed, so when two devices edit, the newer copy of each trip wins, and a deleted trip stays deleted.
const SYNC_KEY = "kairoute.sync", TOMB_KEY = "kairoute.deleted";
let syncTimer = null, syncBusy = false, syncNote = "", syncJoin = null, applyingSync = false;
const syncSt = () => { try { return JSON.parse(localStorage.getItem(SYNC_KEY) || "null"); } catch (e) { return null; } };
const syncSet = v => { try { if (v) localStorage.setItem(SYNC_KEY, JSON.stringify(v)); else localStorage.removeItem(SYNC_KEY); } catch (e) {} };
const tombs = () => { try { return JSON.parse(localStorage.getItem(TOMB_KEY) || "{}") || {}; } catch (e) { return {}; } };
// A trip syncs in parts (its settings, the order of its days, each day, each journal entry), each stamped with the
// time it last really changed. When the phone edits one day and the computer another, both edits survive; when
// both edit the same part, the newer edit wins. Which day is open and a tour in progress stay on each device.
const LOCAL_ONLY = ["days", "journal", "active", "tour"];
function tripParts(x) {
  const t = x.trip, out = {}, meta = {};
  for (const k in t) if (!LOCAL_ONLY.includes(k)) meta[k] = t[k];
  out.m = JSON.stringify([x.name || "", meta]);
  (t.days || []).forEach(d => { if (!d.id) d.id = "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); out["d:" + d.id] = JSON.stringify(d); });
  out.o = JSON.stringify((t.days || []).map(d => d.id));
  for (const k in t.journal || {}) out["j:" + k] = JSON.stringify(t.journal[k]);
  return out;
}
// Each part's fingerprint is saved with the trip, so a change is noticed even if the app was closed and
// reopened in between (an edit made right after opening the app still counts as the newest).
const fp = t => { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + t.length.toString(36); };
function markChanges() {
  const now = Date.now();
  library.forEach(x => {
    const parts = tripParts(x), first = !x.sums; x.stamps = x.stamps || {}; x.sums = x.sums || {};
    for (const k in parts) { const f = fp(parts[k]); if (x.sums[k] !== f) { x.stamps[k] = first ? x.stamps[k] || 1 : now; x.sums[k] = f; } }
  });
}
function syncPayload() {
  if (trip && trip.days && trip.days.length) storeInLibrary();
  markChanges();
  const gen = {}; for (const k in cities) if (k !== "barcelona" && !cities[k].builtin) gen[k] = cities[k];
  return { v: 2, library: library.map(x => ({ id: x.id, name: x.name, updated: x.updated, stamps: x.stamps || {}, trip: x.trip })), deleted: tombs(), cities: gen };
}
const lastChange = x => Math.max(1, ...Object.values(x.stamps || {}));
// Part by part, the newer edit wins (on a tie, the linked copy when this device has just been linked).
function mergeTrip(L, R, preferRemote) {
  const pl = tripParts(L), pr = tripParts(R), sl = L.stamps || {}, sr = R.stamps || {}, S = {};
  const win = k => { const a = sl[k] || 0, b = sr[k] || 0; if (!(k in pr)) return "L"; if (!(k in pl)) return "R"; return b > a || (b === a && preferRemote) ? "R" : "L"; };
  const pick = (k, lv, rv) => { const w = win(k); S[k] = Math.max(sl[k] || 0, sr[k] || 0); return w === "R" ? rv : lv; };
  const t = {}, mw = pick("m", L.trip, R.trip);
  for (const k in mw) if (!LOCAL_ONLY.includes(k)) t[k] = JSON.parse(JSON.stringify(mw[k]));
  const name = win("m") === "R" ? R.name : L.name;
  const byId = (tr, id) => (tr.days || []).find(d => d.id === id);
  const order = JSON.parse(pick("o", pl.o, pr.o));
  t.days = order.map(id => { const k = "d:" + id, a = byId(L.trip, id), b = byId(R.trip, id); return JSON.parse(JSON.stringify(a && b ? pick(k, a, b) : (S[k] = Math.max(sl[k] || 0, sr[k] || 0), a || b))); }).filter(Boolean);
  t.journal = {};
  new Set([...Object.keys(L.trip.journal || {}), ...Object.keys(R.trip.journal || {})]).forEach(k => { const a = (L.trip.journal || {})[k], b = (R.trip.journal || {})[k]; t.journal[k] = a && b ? pick("j:" + k, a, b) : (S["j:" + k] = Math.max(sl["j:" + k] || 0, sr["j:" + k] || 0), a || b); });
  t.active = Math.min(L.trip.active || 0, Math.max(0, t.days.length - 1)); if (L.trip.tour) t.tour = L.trip.tour;
  return { id: L.id, name, updated: Math.max(L.updated || 0, R.updated || 0), stamps: S, trip: t };
}
// Trips deleted after their last change stay deleted; city guides are added, never removed.
function syncMerge(data, preferRemote) {
  if (!data || !Array.isArray(data.library)) return false;
  const dead = Object.assign({}, data.deleted || {}), mine = tombs(); for (const k in mine) dead[k] = Math.max(dead[k] || 0, mine[k]);
  try { localStorage.setItem(TOMB_KEY, JSON.stringify(dead)); } catch (e) {}
  if (trip && trip.days && trip.days.length) storeInLibrary();
  markChanges();
  let changed = false;
  for (const r0 of data.library) {
    if (!r0 || !r0.id || !r0.trip || !Array.isArray(r0.trip.days)) continue;
    const r = r0.stamps ? r0 : Object.assign({}, r0, { stamps: {} }); // copies saved before part stamps: every part counts as old
    const i = library.findIndex(x => x.id === r.id);
    if (i < 0) { library.push(r); changed = true; continue; }
    const L = library[i], before = JSON.stringify([L.name, L.trip]);
    // Linking a device that planned the same trip differently on its own: keep this device's version as a copy,
    // so nothing anyone planned is ever lost.
    if (preferRemote && lastChange(L) <= 1 && lastChange(r) <= 1) {
      const strip = tr => JSON.stringify([tr.days, tr.journal]);
      if (strip(L.trip) !== strip(r.trip) && !L.trip.placeholder) { const copy = JSON.parse(JSON.stringify(L)); copy.id = "t" + Date.now().toString(36); copy.trip.id = copy.id; copy.name = (L.name || tripName(L.trip)) + " (from this device)"; copy.trip.name = copy.name; copy.stamps = { m: Date.now() }; library.push(copy); }
    }
    const M = mergeTrip(L, r, preferRemote);
    library[i] = M; if (JSON.stringify([M.name, M.trip]) !== before) changed = true;
  }
  const n0 = library.length; library = library.filter(x => !(dead[x.id] && dead[x.id] >= lastChange(x))); if (library.length !== n0) changed = true;
  for (const k in data.cities || {}) if (!cities[k] && data.cities[k] && Array.isArray(data.cities[k].sites)) { cities[k] = data.cities[k]; changed = true; }
  library.forEach(x => { const parts = tripParts(x); x.sums = {}; for (const k in parts) x.sums[k] = fp(parts[k]); x.stamps = x.stamps || {}; });
  if (changed) {
    const cur = library.find(x => x.id === trip.id);
    if (cur) trip = cur.trip;
    else if (!trip.placeholder) { const nx = library.filter(y => !y.trip.archived).sort((a, b) => b.updated - a.updated)[0]; trip = nx ? nx.trip : Object.assign(sampleTrip(), { placeholder: true }); }
    if (!trip.prefs) trip.prefs = defaultPrefs();
    applyingSync = true; save(); applyingSync = false;
    bonusMemo = new Map(); mealMemo = new Map(); eveMemo = new Map();
    if (!wiz && view !== "tour" && !(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) { const y = window.scrollY; render(); window.scrollTo(0, y); }
  }
  return changed;
}
async function syncCall(body) {
  if (!freeAI) throw new Error("offline");
  const r = await fetch(freeAI.url + "/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  return { status: r.status, j };
}
function syncSoon() {
  if (applyingSync || !syncSt() || typeof window === "undefined") return;
  clearTimeout(syncTimer); syncTimer = setTimeout(syncPush, 2500);
}
async function syncPush() {
  const st = syncSt(); if (!st || syncBusy) return; if (navigator.onLine === false) return;
  syncBusy = true;
  try {
    for (let t = 0; t < 3; t++) {
      const { status, j } = await syncCall({ op: "put", code: st.code, base: st.rev, data: syncPayload() });
      if (status === 200 && j) { st.rev = j.rev; st.at = Date.now(); syncSet(st); break; }
      if (status === 409 && j) { syncMerge(j.data); st.rev = j.rev; syncSet(st); continue; }
      if (status === 404) { syncNote = "This sync code no longer exists, so sync is off on this device."; syncSet(null); render(); }
      break;
    }
  } catch (e) {} finally { syncBusy = false; }
}
async function syncPull() {
  const st = syncSt(); if (!st || syncBusy || navigator.onLine === false) return;
  syncBusy = true; let push = false;
  try {
    const m = await syncCall({ op: "rev", code: st.code });
    if (m.status === 404) { syncNote = "This sync code no longer exists, so sync is off on this device."; syncSet(null); render(); return; }
    if (m.status === 200 && m.j && m.j.rev !== st.rev) {
      const g = await syncCall({ op: "get", code: st.code });
      if (g.status === 200 && g.j) { syncMerge(g.j.data); st.rev = g.j.rev; st.at = Date.now(); syncSet(st);
        // This device had newer changes of its own: send them on.
        const pay = syncPayload(); push = pay.library.some(x => { const r = (g.j.data.library || []).find(y => y.id === x.id); if (!r) return true; const rs = r.stamps || {}; return Object.keys(x.stamps || {}).some(k => (x.stamps[k] || 0) > (rs[k] || 0)); }); }
    } else if (m.status === 200) { st.at = Date.now(); syncSet(st); }
  } catch (e) {} finally { syncBusy = false; }
  if (push) syncPush();
}
async function syncStart() {
  syncNote = ""; syncBusy = true; render();
  try { const { status, j } = await syncCall({ op: "new", data: syncPayload() }); if (status === 200 && j && j.code) syncSet({ code: j.code, rev: j.rev, at: Date.now() }); else syncNote = "Sync couldn't start just now. Try again in a minute."; }
  catch (e) { syncNote = "Sync needs the internet. Try again when you're online."; }
  syncBusy = false; render();
}
async function syncLink() {
  const code = String(((document.getElementById("sync-code") || {}).value) || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 8) { syncNote = "A sync code has 8 letters and numbers, like K7MQ-4RX2."; render(); return; }
  syncNote = ""; syncBusy = true; render();
  try {
    const g = await syncCall({ op: "get", code });
    if (g.status === 200 && g.j) { syncBusy = false; syncSet({ code, rev: g.j.rev, at: Date.now() }); syncMerge(g.j.data, true); syncJoin = null; syncNote = "Linked. Your trips now match your other device."; syncPush(); }
    else syncNote = g.status === 404 ? "That code wasn't found. Check it on your other device (Settings > Sync)." : g.status === 429 ? "Too many tries today. Try again tomorrow." : "Sync couldn't connect just now. Try again in a minute.";
  } catch (e) { syncNote = "Linking needs the internet. Try again when you're online."; }
  syncBusy = false; render();
}
const fmtCode = c => c ? c.slice(0, 4) + "-" + c.slice(4) : "";
function syncCard() {
  const st = syncSt();
  return `<div class="card" id="synccard"><h3>Sync between devices</h3>
    ${st ? `<p class="lede">On. Your trips and journal stay the same on every device linked with this code:</p><p class="synccode" aria-label="Sync code">${esc(fmtCode(st.code))}</p>
      <p class="lede small">On your other phone, tablet or computer: open Kairoute, go to Settings > Sync between devices, tap "I have a code" and type it in.${st.at ? " Last synced " + esc(new Date(st.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })) + "." : ""}</p>
      <div class="actions"><button class="btn ghost small" data-act="syncnow" ${syncBusy ? "disabled" : ""}>Sync now</button><button class="btn ghost small" data-act="syncoff">Stop syncing on this device</button></div>`
    : `<p class="lede">Plan on your phone, see it on your tablet or computer. Turn sync on here to get a short code, then type that code on your other device. No account or password.</p>
      ${syncJoin ? `<div class="ask"><input id="sync-code" type="text" inputmode="text" autocapitalize="characters" autocomplete="off" maxlength="9" placeholder="e.g. K7MQ-4RX2" aria-label="Sync code"><button class="btn" data-act="synclink" ${syncBusy ? "disabled" : ""}>${syncBusy ? "Linking…" : "Link"}</button></div><p class="lede small">Your synced trips come to this device. Any other trips already here are kept and shared too.</p>`
        : `<div class="actions"><button class="btn" data-act="syncstart" ${syncBusy ? "disabled" : ""}>${syncBusy ? "Turning on…" : "Turn on sync"}</button><button class="btn ghost" data-act="syncjoin">I have a code</button></div>`}`}
    ${syncNote ? `<p class="banner" role="status">${esc(syncNote)}</p>` : ""}</div>`;
}
if (typeof window !== "undefined") {
  setTimeout(syncPull, 2500);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") syncPull(); else if (syncTimer) { clearTimeout(syncTimer); syncPush(); } });
  window.addEventListener("online", () => setTimeout(() => { syncPull(); syncPush(); }, 2000));
  setInterval(() => { if (document.visibilityState === "visible") syncPull(); }, 20000);
}
const day = () => trip.days[trip.active];
// Match the day's city to a guide, forgiving extra words like "Barcelona, Spain" or "Kusadasi (Ephesus) Turkey".
function looseKey(dest) {
  const dk = " " + keyOf(dest) + " "; if (dk.trim().length < 3) return null;
  return Object.keys(cities).filter(k => !k.includes("|") && k.length > 2).sort((a, b) => b.length - a.length).find(k => dk.includes(" " + k + " ")) || null;
}
const cityKeyFor = d => d.cityKey && cities[d.cityKey] ? d.cityKey : (cities[keyOf(d.destination)] ? keyOf(d.destination) : looseKey(d.destination));
const cityFor = d => { const k = cityKeyFor(d); return k ? cities[k] : null; };
const typeInfo = t => DAY_TYPES.find(x => x.key === t) || DAY_TYPES[0];

// ---------- Helpers ----------
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const toMin = t => { if (!t) return NaN; const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
const fmt = m => { m = Math.round(m); const h = Math.floor(m / 60) % 24, mm = ((m % 60) + 60) % 60; return String(h).padStart(2, "0") + ":" + String(mm).padStart(2, "0"); };
const dur = m => { m = Math.round(m); if (m < 60) return m + " min"; const h = Math.floor(m / 60), r = m % 60; return h + " h" + (r ? " " + r + " min" : ""); };
const fmtDate = iso => { if (!iso) return ""; const dt = new Date(iso + "T12:00:00Z"); return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }); };
const fmtDow = iso => { if (!iso) return ""; const dt = new Date(iso + "T12:00:00Z"); return dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }); };
function hav(a, b) {
  const R = 6371, toR = x => x * Math.PI / 180;
  const dLa = toR(b.lat - a.lat), dLo = toR(b.lng - a.lng);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const WALK_LIMIT = { low: 0.8, medium: 1.7, high: 3.2 }; // straight-line km; medium keeps each walk to about 30 minutes, as promised in setup
const PACE = { relaxed: 1.2, moderate: 1, packed: 0.85 };
function travel(a, b) {
  const d = hav(a, b);
  const lim = WALK_LIMIT[(trip.prefs && trip.prefs.walk) || "medium"];
  const speed = trip.prefs && trip.prefs.walk === "low" ? 3.6 : 4.5;
  if (d <= lim) return { mode: "walk", how: "Walk", km: d * 1.3, min: Math.max(2, Math.round(d * 1.3 / speed * 60)) };
  if (d <= 6) return { mode: "ride", how: "Taxi, bus or metro", km: d * 1.3, min: Math.round(10 + d * 1.3 / 22 * 60) };
  if (d <= 15) return { mode: "ride", how: "Taxi or rideshare", km: d * 1.3, min: Math.round(10 + d * 1.3 / 25 * 60) };
  return { mode: "ride", how: "Train or car", km: d * 1.25, min: Math.round(15 + d * 1.25 / 85 * 60) }; // highway or intercity train, plus getting going (Athens to the Corinth Canal: about 1 h 10)
}
const tmin = (a, b) => (a && b ? travel(a, b).min : 0);
function allSites(city) { return [...(city.sites || []), ...(city.farther || [])]; }
// Sights already planned on another day in the same city, by site id -> that day.
function plannedElsewhere(d) {
  const c = cityFor(d), out = {}; if (!c) return out;
  trip.days.forEach(o => { if (o !== d && cityFor(o) === c && o.selected) o.selected.forEach(id => { if (!out[id]) out[id] = o; }); });
  return out;
}
// Sights that didn't fit on an earlier day in the same city carry over to the next one.
let carrying = false;
function carryOver(d) {
  if (carrying) return [];
  const k = cityKeyFor(d), i = trip.days.indexOf(d), ids = [];
  carrying = true;
  try { for (let j = 0; j < i; j++) { const o = trip.days[j]; if (cityKeyFor(o) !== k || !o.selected) continue; const pl = buildPlan(o); if (pl && pl.dropped) pl.dropped.forEach(x => { if (!ids.includes(x.id)) ids.push(x.id); }); } }
  catch (e) {} finally { carrying = false; }
  return ids;
}
function refillIfNeeded(d, city) {
  if (!d || !d.respread || !city) return;
  delete d.respread;
  const fresh = defaultSelection(city, trip.style, d);
  d.selected = [...new Set([...(d.selected || []), ...fresh])];
}
// "Suggest my tour": fills every day in this city with the best stops that truly fit each day's time.
// Each day starts from the best sight still unseen and grows around it (nearby, high-value sights first),
// checking the real planned day (route, meals, opening days) after every addition, so nothing is dropped
// and no sight repeats across days.
let suggestMsg = "";
function suggestTour(d0) {
  const city = cityFor(d0); if (!city) return 0;
  const days = trip.days.filter(o => cityFor(o) === city);
  const ints = ((trip.prefs && trip.prefs.interests) || []).map(x => INTEREST_WORDS[x] || []).flat(), style = trip.style || "mix";
  const score = x => (x.mustSee ? 3 : 1) + ints.reduce((a, w) => a + ((x.category + " " + x.summary).toLowerCase().includes(w) ? 1 : 0), 0) * 0.8 + (style === "mix" || x.kind === style ? 0.5 : 0);
  const used = new Set(); let total = 0;
  const fills = days.map(o => o.fillTime);
  days.forEach(o => { o.selected = []; o.fillTime = false; });
  for (const d of days) {
    const fits = () => { const p = buildPlan(d); return p && !p.error && !p.over && !(p.dropped || []).length; };
    for (let guard = 0; guard < 14; guard++) {
      const chosen = allSites(city).filter(x => d.selected.includes(x.id));
      let cands = city.sites.filter(x => !x.quick && !used.has(x.id) && !d.selected.includes(x.id) && !closedOn(x, d.date) && religiousOk(x));
      // When the city's sights are all planned, a day with room gets a day trip farther out instead.
      if (!cands.length && d.selected.length < 2) cands = (city.farther || []).filter(x => !used.has(x.id) && !d.selected.includes(x.id) && !closedOn(x, d.date) && religiousOk(x));
      if (!cands.length) break;
      const near = x => chosen.length ? Math.min(...chosen.map(c => hav(c, x))) : 0;
      cands.sort((a, b) => score(b) / (1 + near(b)) - score(a) / (1 + near(a)));
      let added = false;
      for (const c of cands.slice(0, 6)) { d.selected.push(c.id); if (fits()) { added = true; break; } d.selected.pop(); }
      if (!added) break;
    }
    d.selected.forEach(id => used.add(id)); total += d.selected.length;
  }
  days.forEach((o, i) => { o.fillTime = fills[i]; });
  return total;
}
function defaultSelection(city, style, d) {
  const taken = d ? plannedElsewhere(d) : {};
  const s = city.sites.filter(x => !x.quick && !taken[x.id] && religiousOk(x));
  const picks = s.filter(x => x.mustSee).map(x => x.id);
  const ints = ((trip.prefs && trip.prefs.interests) || []).map(x => INTEREST_WORDS[x] || []).flat();
  const score = x => ints.reduce((a, w) => a + ((x.category + " " + x.summary).toLowerCase().includes(w) ? 1 : 0), 0) + (style === "mix" || x.kind === style ? 0.5 : 0);
  const extra = s.filter(x => !x.mustSee).sort((a, b) => score(b) - score(a)).slice(0, 2).map(x => x.id);
  const carried = d ? carryOver(d).filter(id => !taken[id]) : [];
  let sel = [...new Set([...carried, ...picks, ...extra])];
  // When another day later in the trip is in the same city, give this day only what fits its hours
  // (allowing for lunch and getting between stops) and leave the rest for that day, rather than
  // overfilling this one and showing "Didn't fit".
  if (d && (d.type === "land" || d.type === "port")) {
    const i = trip.days.indexOf(d), k = cityKeyFor(d) || keyOf(d.destination);
    const later = trip.days.some((o, j) => j > i && (cityKeyFor(o) || keyOf(o.destination)) === k);
    let w = null; try { w = dayWindow(d, city); } catch (e) {}
    if (later && w && !w.error && w.endBy > w.start) {
      let left = w.endBy - w.start - 60 - (w.buffer || 0); const byId = new Map(city.sites.map(x => [x.id, x]));
      sel = sel.filter((id, n) => { const x = byId.get(id), need = (x ? x.minutes || 45 : 45) + 15; if (n > 0 && need > left) return false; left -= need; return true; });
    }
  }
  // On a short day, keep it light: start with the must-sees only.
  if (d && d.type !== "land" && d.type !== "port") sel = [...new Set([...carried, ...picks])].slice(0, 2);
  return sel;
}

// ---------- Places for a day ----------
function pointList(city, listKey) { return (city && city.starts && city.starts[listKey]) || []; }
function lodgingFor(d, city) {
  const k = cityKeyFor(d) || keyOf(d.destination);
  const L = trip.lodging[k] || { idx: 0 };
  if (L.idx === "custom") return L.ll ? { name: L.name, lat: L.ll.lat, lng: L.ll.lng } : null;
  const list = pointList(city, "hotel");
  const hit = list[L.idx] || list[0];
  if (hit) return hit;
  // A guide with no hotel areas listed: start from the city center rather than stopping the day plan.
  const c = pointList(city, "point")[0] || (city && city.sites && city.sites[0]);
  return c ? { name: "Hotel near " + c.name, lat: c.lat, lng: c.lng } : null;
}
function dayPoint(d, city) {
  const listKey = d.type === "port" || d.type === "embark" ? "cruise" : MODES[d.mode].list;
  const list = pointList(city, listKey);
  return list[d.pointIdx] || list[0] || null;
}
function fixedStop(p, label, minutes) { return Object.assign({}, p, { id: "fx-" + label.replace(/\W+/g, "-").toLowerCase(), name: label, minutes, fixed: true }); }

// The time window and the fixed points at each end of a day.
function dayWindow(d, city) {
  const L = lodgingFor(d, city), P = dayPoint(d, city);
  const w = { head: [], tail: [], start: 0, endBy: 0, notes: [], buffer: 0 };
  if (d.type === "land") {
    if (!L) return { error: "Choose where you're staying in " + d.destination + "." };
    w.head = [L]; w.tail = d.returnToStart ? [L] : [];
    w.start = toMin(d.startTime); w.endBy = w.start + d.hours * 60;
    w.startLabel = "Leave " + L.name; w.endLabel = "Back at " + L.name;
  } else if (d.type === "arrival") {
    if (!L) return { error: "Choose where you're staying in " + d.destination + "." };
    if (!P) return { error: "Choose your arrival " + MODES[d.mode].word + "." };
    const m = MODES[d.mode];
    w.start = toMin(d.time) + m.clear;
    w.head = [P, fixedStop(L, "Check in or drop bags at " + L.name, 20)];
    w.tail = [L]; w.endBy = w.start + d.hours * 60;
    w.startLabel = (d.mode === "ship" ? "Off the ship at " : "Out of ") + P.name;
    w.endLabel = "Back at " + L.name;
    w.notes.push(`${m.label} arrives ${d.time}. We allow ${dur(m.clear)} to get ${d.mode === "flight" ? "through passport control and baggage" : d.mode === "ship" ? "off the ship with your luggage" : d.mode === "train" ? "off the train" : "parked and on your way"}.`);
  } else if (d.type === "departure") {
    if (!L) return { error: "Choose where you're staying in " + d.destination + "." };
    if (!P) return { error: "Choose your departure " + MODES[d.mode].word + "." };
    const m = MODES[d.mode];
    w.start = toMin(d.startTime); w.endBy = toMin(d.time) - m.need;
    w.head = [L]; w.tail = [fixedStop(L, "Collect bags at " + L.name, 15), P];
    w.startLabel = "Check out of " + L.name; w.endLabel = "At " + P.name;
    w.notes.push(`${m.label} leaves ${d.time}. You'll be at the ${m.word} ${dur(m.need)} early${d.mode === "flight" ? " for an international flight" : ""}.`);
  } else if (d.type === "embark") {
    if (!L) return { error: "Choose where you're staying in " + d.destination + "." };
    if (!P) return { error: "Choose the cruise port." };
    w.start = toMin(d.startTime); w.endBy = toMin(d.allAboard) - 60;
    w.head = [L]; w.tail = [fixedStop(L, "Collect bags at " + L.name, 15), P];
    w.startLabel = "Check out of " + L.name; w.endLabel = "Boarding at " + P.name;
    w.notes.push(`All aboard ${d.allAboard}. We get you to the terminal an hour early for check-in.`);
  } else if (d.type === "port") {
    if (!P) return { error: "Choose where the ship docks." };
    w.start = toMin(d.portArrive) + (d.tender ? 60 : 30); w.endBy = toMin(d.allAboard) - 45; w.buffer = 45;
    w.head = [P]; w.tail = [P];
    w.startLabel = (d.tender ? "Tender ashore to " : "Off the ship at ") + P.name; w.endLabel = "Back at the ship";
    w.notes.push(`Ship docks ${d.portArrive}${d.tender ? " (tender port, so we allow an hour to get ashore)" : ""}. All aboard ${d.allAboard}: you'll be back 45 minutes early.`);
  }
  if (!isFinite(w.start) || !isFinite(w.endBy)) return { error: "Add the times for this day." };
  return w;
}

// ---------- Route planning ----------
function routeCost(order, O, Z) {
  let c = 0, prev = O;
  for (const p of order) { c += tmin(prev, p); prev = p; }
  if (Z) c += tmin(prev, Z);
  return c;
}
function optimize(nodes, O, Z) {
  const rest = nodes.slice(), order = [];
  let cur = O;
  while (rest.length) {
    let bi = 0, bd = Infinity;
    rest.forEach((p, i) => { const dd = tmin(cur, p); if (dd < bd) { bd = dd; bi = i; } });
    cur = rest.splice(bi, 1)[0]; order.push(cur);
  }
  let improved = true, guard = 0;
  while (improved && guard++ < 200) {
    improved = false;
    for (let i = 0; i < order.length - 1; i++) for (let k = i + 1; k < order.length; k++) {
      const cand = order.slice(0, i).concat(order.slice(i, k + 1).reverse(), order.slice(k + 1));
      if (routeCost(cand, O, Z) + 0.01 < routeCost(order, O, Z)) { order.splice(0, order.length, ...cand); improved = true; }
    }
  }
  return order;
}
function chainCost(pts) { let c = 0; for (let i = 0; i < pts.length; i++) { if (i) c += tmin(pts[i - 1], pts[i]); c += pts[i].fixed ? pts[i].minutes : 0; } return c; }
function segDist(p, a, b) {
  const k = Math.cos(a.lat * Math.PI / 180) * 111.32, kl = 110.57;
  const ax = a.lng * k, ay = a.lat * kl, bx = b.lng * k, by = b.lat * kl, px = p.lng * k, py = p.lat * kl;
  const dx = bx - ax, dy = by - ay, Ls = dx * dx + dy * dy;
  let t = Ls ? ((px - ax) * dx + (py - ay) * dy) / Ls : 0; t = Math.max(0, Math.min(1, t));
  return { d: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)), t };
}
function pickRestaurant(city, a, b, style, used) {
  const rs = (city.restaurants || []).filter(r => !used.has(r.name) && !r.crowdDrop);
  if (!rs.length) return null;
  const score = r => (b ? tmin(a, r) + tmin(r, b) - tmin(a, b) : tmin(a, r));
  const pref = style === "mix" ? rs : rs.filter(r => r.kind === style);
  const sorted = list => list.map(r => ({ r, extra: score(r) })).sort((x, y) => x.extra - y.extra);
  const best = sorted(pref.length ? pref : rs);
  let pick = best[0];
  if (pref.length && pick.extra > 25) { const any = sorted(rs)[0]; if (any.extra + 10 < pick.extra) pick = any; }
  const alts = sorted(rs).filter(x => x.r !== pick.r).slice(0, 2);
  return Object.assign({}, pick.r, { extra: pick.extra, alts: alts.map(x => x.r) });
}

// ---- Day route: stops, meals and spare time solved together ----
// simDay walks a candidate sequence through the clock: travel, time at each stop, meals that must land
// inside their window (waiting a little is cheap, eating late is expensive). Lower cost = better day.
function simDay(seq, t0, O, Z, style) {
  let clock = t0, prev = O, cost = 0, seenDinner = false;
  const been = [];
  for (let i = 0; i < seq.length; i++) {
    const p = seq[i];
    clock += tmin(prev, p); cost += hav(prev, p) * 0.4; // straight-line distance breaks ties, so equal-time orders never cross
    // Never go back to an area already left behind: a long ride (over 20 km) to somewhere within 10 km of
    // an earlier stop, other than the one just left, is backtracking (e.g. Corinth, Athens, Corinth again).
    if (hav(prev, p) > 20 && been.slice(0, -1).some(b => hav(b, p) < 10)) cost += 600;
    been.push(p);
    if (p.mealOf) {
      // A meal is eaten where you are: a stop that adds more than 20 minutes of travel just to eat costs a lot,
      // so a long detour for lunch never wins (eating a bit later nearby does).
      const nx = seq[i + 1] || Z;
      if (nx) { const extra = tmin(prev, p) + tmin(p, nx) - tmin(prev, nx); if (extra > 20) cost += (extra - 20) * 12; }
      const m = p.mealOf;
      if (m.label === "Lunch" && seenDinner) cost += 500; if (m.label !== "Lunch") seenDinner = true;
      if (clock < m.from) { cost += (m.from - clock) * 0.6; clock = m.from; }
      if (clock > m.to) cost += (clock - m.to) * (m.booked ? 60 : 6); // a table the traveler booked is never missed
      if (style !== "mix" && p.kind && p.kind !== style) cost += 8;
      if (p.recommended) cost -= 6; // recommended by travelers on Wikivoyage
      if (p.top) cost -= 8; // among the best-rated places near the route
      if (p.crowdTop) cost -= 10; // Kairoute travelers rate it highly
      if (p.generic) cost += 25; // a real, named place to eat beats "somewhere around here" unless it means a long detour
      clock += m.len;
    } else clock += p.minutes || 0;
    prev = p;
  }
  if (Z) { clock += tmin(prev, Z); cost += hav(prev, Z) * 0.4; }
  return { cost: clock - t0 + cost, end: clock };
}
// Polish a whole sequence (meals included): move any one item to any other place, reverse any stretch,
// or swap a meal's restaurant, keeping every change that makes the day shorter. Removes zigzags,
// crossings and out-and-back trips to lunch.
function polishDay(seq, t0, O, Z, style, city) {
  const C = q => simDay(q, t0, O, Z, style).cost;
  let best = seq.slice(), bc = C(best), improved = true, guard = 0;
  while (improved && guard++ < 60) {
    improved = false;
    for (let i = 0; i < best.length; i++) for (let j = 0; j < best.length; j++) {
      if (i === j) continue;
      const q = best.slice(); const [x] = q.splice(i, 1); q.splice(j, 0, x);
      const c = C(q); if (c + 0.01 < bc) { best = q; bc = c; improved = true; }
    }
    for (let i = 0; i < best.length - 1; i++) for (let k = i + 1; k < best.length; k++) {
      const q = best.slice(0, i).concat(best.slice(i, k + 1).reverse(), best.slice(k + 1));
      const c = C(q); if (c + 0.01 < bc) { best = q; bc = c; improved = true; }
    }
    best.forEach((x, i) => {
      if (!x.mealOf || x.mealOf.booked) return;
      for (const r0 of mealSpots(best, O, Z, city)) {
        const r = r0.generic ? Object.assign({}, r0, { name: r0.name.replace(/^Lunch/, x.mealOf.label) }) : r0;
        if (best.some(y => y.mealOf && y.name === r.name)) continue;
        const q = best.slice(); q[i] = Object.assign({}, r, { mealOf: x.mealOf }); const c = C(q);
        if (c + 0.01 < bc) { best = q; bc = c; improved = true; }
      }
    });
  }
  return best;
}
// Places to eat that are a short walk (about 8 minutes) from today's stops. If the guide knows none
// that close, the plan says "Lunch near <stop>" and lets the traveler pick, rather than send them far.
// Places to eat already planned on earlier days of the trip, so a meal spot is never repeated.
let mealMemo = new Map(), avoidMeals = new Set(), eveMemo = new Map(), skipEvening = false;
function mealSpots(seq, O, Z, city) {
  const anchors = seq.filter(x => !x.mealOf).concat(O ? [O] : [], Z ? [Z] : []);
  const near = (city.restaurants || []).filter(r => !r.crowdDrop && anchors.some(a => hav(a, r) <= 0.6));
  const fresh = near.filter(r => !avoidMeals.has(keyOf(r.name)));
  // Any stop with no known place to eat a short walk away (often a day trip out of town) also offers
  // "Lunch near <stop>", so the plan never travels back to town just to eat.
  const bare = seq.filter(x => !x.mealOf && !(city.restaurants || []).some(r => !r.crowdDrop && hav(r, x) <= 0.6));
  const gen = bare.map(x => ({ name: "Lunch near " + x.name, lat: x.lat, lng: x.lng, generic: true, kind: "local", cuisine: "Your pick", price: "", why: "Choose any café or taverna around here, or bring a picnic. A good sign is a place full of locals." }));
  return (fresh.length ? fresh : gen.length ? [] : near).concat(gen); // never repeat another day's restaurant when eating right here is possible
}
// Two alternatives for each meal, a short walk away, chosen to be different from the main pick and from
// each other (another cuisine or style), favouring places travelers recommend. Never one used on another day.
function mealAlternatives(s, seq, city) {
  if (s.generic || s.booked) return [];
  const cu = r => keyOf(r.cuisine || "restaurant");
  const pool = (city.restaurants || []).filter(r => !r.generic && !r.crowdDrop && keyOf(r.name) !== keyOf(s.name) && hav(r, s) <= 0.6 && !avoidMeals.has(keyOf(r.name)) && !seq.some(x => x.mealOf && keyOf(x.name) === keyOf(r.name)));
  const out = [];
  while (out.length < 2 && pool.length) {
    const score = r => (r.crowdTop ? 3 : 0) + (r.recommended ? 2 : 0) + (r.top ? 2 : 0) + ([s].concat(out).every(o => cu(o) !== cu(r)) ? 2 : 0) + ([s].concat(out).every(o => o.kind !== r.kind) ? 1 : 0) - hav(r, s) * 3;
    pool.sort((a, b) => score(b) - score(a)); out.push(pool.shift());
  }
  return out;
}
// ---- Traveler ratings of restaurants, shared by every Kairoute traveler ----
// After a meal, travelers rate it 1 to 5 stars. Once at least CROWD_MIN travelers have rated a place, an
// average of CROWD_TOP or more earns the "Kairoute Top Pick" badge and a strong preference in plans, and an
// average under CROWD_DROP takes it out of suggestions. A place you rated 2 stars or less yourself is never
// suggested to you again.
const CROWD_MIN = 3, CROWD_TOP = 4.5, CROWD_DROP = 2.5, crowdCache = {};
function devId() {
  let id = ""; try { id = localStorage.getItem("kairoute.dev") || ""; } catch (e) {}
  if (!/^[a-f0-9]{24}$/.test(id)) { id = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, "0")).join(""); try { localStorage.setItem("kairoute.dev", id); } catch (e) {} }
  return id;
}
const eatKey = (city, name) => keyOf(city.city) + "/eat " + keyOf(name);
const myEatRating = (city, name) => ((trip.journal || {})[eatKey(city, name)] || {}).rating || 0;
function crowdMark(city) {
  const m = (crowdCache[keyOf(city.city)] || {}).map || {};
  (city.restaurants || []).forEach(r => { const c = m[keyOf(r.name)], je = (trip.journal || {})[eatKey(city, r.name)] || {}, mine = je.date && je.date !== day().date ? je.rating || 0 : 0; // today's rating takes effect from tomorrow, so today's plan never shifts under you
    r.crowd = c && c.n >= CROWD_MIN ? c : null;
    r.crowdTop = !!(r.crowd && c.avg >= CROWD_TOP);
    r.crowdDrop = !!((r.crowd && c.avg < CROWD_DROP) || (mine && mine <= 2)); });
}
function crowdFor(city) {
  if (!city) return;
  const k = keyOf(city.city);
  if (!crowdCache[k] && freeAI) {
    crowdCache[k] = { map: null };
    fetch(`${freeAI.url}/ratings?city=${encodeURIComponent(k)}`).then(r => r.ok ? r.json() : null).then(j => {
      if (!j || !j.ratings || !Object.keys(j.ratings).length) return;
      crowdCache[k].map = j.ratings;
      if (view === "plan" || view === "guide") { const y = window.scrollY; render(); window.scrollTo(0, y); }
    }).catch(() => {});
  }
  crowdMark(city);
}
function rateEat(name, stars) {
  const d = day(), city = cityFor(d); if (!city || !name) return;
  trip.journal = trip.journal || {};
  const k = eatKey(city, name), j = trip.journal[k] || { date: d.date, name, city: city.city, meal: true };
  j.rating = stars; trip.journal[k] = j; save();
  if (freeAI) fetch(`${freeAI.url}/rate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ city: keyOf(city.city), place: keyOf(name), stars, dev: devId() }) })
    .then(r => r.ok ? r.json() : null).then(j2 => { if (j2 && j2.ok) { const c = crowdCache[keyOf(city.city)] || (crowdCache[keyOf(city.city)] = {}); c.map = Object.assign({}, c.map, { [keyOf(name)]: { avg: j2.avg, n: j2.n } }); } }).catch(() => {});
}
function eatStars(name, city, label) {
  const mine = myEatRating(city, name);
  return `<div class="raterow"><span>${mine ? "Your rating" : label || "Ate here? Rate it"}</span><div class="stars small" role="group" aria-label="Rate ${esc(name)}">${[1, 2, 3, 4, 5].map(n => `<button class="star ${mine >= n ? "on" : ""}" data-eatrate="${n}" data-eatname="${esc(name)}" aria-label="${n} star${n > 1 ? "s" : ""}">★</button>`).join("")}</div>${mine && mine <= 2 ? `<span class="lede">We won't suggest it to you again.</span>` : mine ? `<span class="lede">Thanks! It helps other travelers.</span>` : ""}</div>`;
}
const crowdBadge = r => r.crowdTop ? `<i class="badge kpick">★ Kairoute Top Pick</i>` : "";
const crowdLine = r => r.crowd ? `★ ${r.crowd.avg.toFixed(1)} from ${r.crowd.n} Kairoute travelers` : "";
// Tables the traveler already booked (Day plan > "I already have a place"), checked as real on the map.
function bookedMeals(d, city) {
  return MEALS.map(m => { const b = (d.booked || {})[m.label]; if (!b || !isFinite(b.lat) || !isFinite(b.lng) || !/^\d\d:\d\d$/.test(b.time || "")) return null;
    const t = toMin(b.time);
    return { label: m.label, from: t, to: t + 10, len: m.len, booked: true,
      node: { id: "booked-" + keyOf(m.label), name: b.name, lat: b.lat, lng: b.lng, booked: true, kind: "local", cuisine: b.kind || "", price: "", why: "Your reservation at " + fmt(t) + (b.addr ? ". " + b.addr : "") + ".", onMap: true } };
  }).filter(Boolean);
}
// The reservation form on the Day plan. A booked place must be found on the map (or among the city's known
// restaurants) before it is used, so the plan never routes to a place that doesn't exist.
let bookForm = null;
async function bookSearch() {
  const d = day(), city = cityFor(d), f = bookForm; if (!f || !city) return;
  f.q = ((document.getElementById("bk-name") || {}).value || "").trim(); f.time = ((document.getElementById("bk-time") || {}).value || f.time);
  if (f.q.length < 2) { f.msg = "Type the name of the restaurant."; render(); return; }
  const L = lodgingFor(d, city), from = L && isFinite(L.lat) ? L : (city.sites || [])[0];
  const found = (city.restaurants || []).filter(r => !r.generic && isFinite(r.lat) && (nameMatch(f.q, r.name) || nameMatch(r.name, f.q))).map(r => ({ name: r.name, lat: r.lat, lng: r.lng, kind: r.cuisine || "" }));
  f.busy = true; f.msg = ""; f.results = found.slice(0, 4); render();
  if (typeof navigator !== "undefined" && navigator.onLine === false) { f.busy = false; if (!found.length) f.msg = "There's no internet right now, and I need it to find the place on the map. Try again when you're online."; render(); return; }
  try {
    // OpenStreetMap, inside the city, under any name the map knows (a taverna listed in Greek still matches).
    const r = freeAI ? await fetch(freeAI.url + "/findplace?city=" + encodeURIComponent(d.destination) + "&q=" + encodeURIComponent(f.q)) : null;
    const j = r && r.ok ? await r.json() : null;
    const core = f.q.replace(/\b(taverna|tavern|restaurant|ristorante|trattoria|osteria|cafe|café|bistro|bar|the|mezedopolio|ouzeri|estiatorio)\b/gi, " ").replace(/\s+/g, " ").trim() || f.q;
    const eats = /restaurant|cafe|pub|bar|fast_food|food_court|biergarten|ice_cream/;
    ((j && j.places) || []).filter(m => isFinite(m.lat) && (m.names || [m.name]).some(n => nameMatch(f.q, n) || nameMatch(core, n) || nameMatch(n, core)))
      .sort((a, b) => (eats.test(b.kind) ? 1 : 0) - (eats.test(a.kind) ? 1 : 0))
      .forEach(m => { if (!f.results.some(y => hav(y, m) < 0.05)) f.results.push({ name: m.name, lat: +(+m.lat).toFixed(5), lng: +(+m.lng).toFixed(5), kind: String(m.kind || "").replace(/_/g, " "), addr: m.addr || "" }); });
  } catch (e) {}
  f.results = f.results.slice(0, 4).map(y => Object.assign(y, { km: from ? hav(from, y) : null }));
  f.busy = false;
  if (!f.results.length) f.msg = `I couldn't find "${f.q}" on the map in ${d.destination}. Check the spelling, or add the street name.`;
  render();
}
function bookFormHTML(d) {
  const f = bookForm; if (!f) return "";
  return `<div class="card bookform" id="bookform"><h3>Your ${esc(f.label.toLowerCase())} reservation</h3><p class="lede small">Tell me where and when. I'll find it on the map and plan the day around it.</p>
    <div class="row2"><label>Restaurant<input id="bk-name" type="text" autocomplete="off" value="${esc(f.q || "")}" placeholder="e.g. Taverna Platanos"></label><label>Time<input id="bk-time" type="time" value="${esc(f.time)}"></label></div>
    <div class="actions"><button class="btn" data-act="booksearch" ${f.busy ? "disabled" : ""}>${f.busy ? "Looking it up…" : "Find it"}</button><button class="btn ghost" data-act="bookcancel">Cancel</button></div>
    ${f.msg ? `<p class="banner warn" role="status">${esc(f.msg)}</p>` : ""}
    ${f.results && f.results.length ? `<p class="lede small">Which one is it?</p><div class="bookres">${f.results.map((y, i) => `<button class="btn ghost" data-bookpick="${i}"><b>${esc(y.name)}</b><small>${[y.addr, y.kind, y.km != null ? distTxt(y.km) + " from your hotel" : ""].filter(Boolean).map(esc).join(" · ")}</small></button>`).join("")}</div>` : ""}</div>`;
}
function placeMeals(order, meals, t0, O, Z, style, city) {
  let seq = order.slice();
  for (const m of meals) {
    let best = null;
    for (const r0 of m.booked ? [m.node] : mealSpots(seq, O, Z, city)) {
      const r = r0.generic ? Object.assign({}, r0, { name: r0.name.replace(/^Lunch/, m.label) }) : r0;
      if (seq.some(x => x.mealOf && x.name === r.name)) continue;
      const node = Object.assign({}, r, { mealOf: m });
      for (let i = 0; i <= seq.length; i++) { const q = seq.slice(0, i).concat([node], seq.slice(i)); const c = simDay(q, t0, O, Z, style).cost; if (!best || c < best.c) best = { c, q }; }
    }
    if (best) seq = best.q;
  }
  return polishDay(seq, t0, O, Z, style, city);
}
let bonusMemo = new Map(); // per render: each day's bonus stops, so two days in a city never get the same one
function buildPlan(d) {
  const city = cityFor(d); if (!city) return null;
  const w = dayWindow(d, city); if (w.error) return w;
  const style = trip.style || "mix";
  const O = w.head[w.head.length - 1], Z = w.tail[0] || null;
  const budget = w.endBy - w.start;
  const fixed = chainCost(w.head) + chainCost(w.tail) + (Z && w.tail.length ? 0 : 0);
  const mult = PACE[(trip.prefs && trip.prefs.pace) || "moderate"];
  let chosen = allSites(city).filter(s => (d.selected || []).includes(s.id));
  const swaps = [];
  if (d.rain) {
    const pool = city.sites.filter(s => !s.quick && s.indoor && !chosen.includes(s));
    chosen = chosen.map(s => {
      if (s.indoor || s.mustSee || !pool.length) return s;
      pool.sort((a, b) => hav(a, s) - hav(b, s));
      const alt = pool.shift(); swaps.push([s, alt]); return alt;
    });
  }
  const closedToday = chosen.filter(s => closedOn(s, d.date));
  chosen = chosen.map(s => Object.assign({}, s, { minutes: Math.round(s.minutes * mult / 5) * 5 || s.minutes }));
  const mealsExpected = MEALS.filter(m => w.start < m.to - 30 && w.endBy > m.from + 45).reduce((a, m) => a + m.len, 0);
  let order = optimize(chosen, O, Z);
  const total = o => fixed + routeCost(o, O, Z) + o.reduce((a, s) => a + s.minutes, 0) + mealsExpected;
  const dropped = [];
  while (order.length && total(order) > budget) {
    const cands = order.filter(s => !s.mustSee);
    const pool = cands.length ? cands : order; // must-sees go last, but the day must still fit
    if (!pool.length) break;
    let best = null, bestVal = -1;
    // Protect what the day is built around: a stop in the day's main area (several chosen stops within
    // 15 km of each other, like Ancient Corinth with the Canal and Acrocorinth) is worth far more than a lone
    // stop in another direction, so the lone far-off stops give way first.
    for (const c of pool) {
      const save = total(order) - total(order.filter(x => x !== c));
      const area = order.filter(x => hav(x, c) < 15).length;
      const val = save / (Math.max(20, c.minutes) * (c.kind === style ? 1.4 : 1) * area * area); // per minute of sightseeing kept: big sights stay, out-of-the-way short ones go
      if (val > bestVal) { bestVal = val; best = c; }
    }
    dropped.push(best);
    order = optimize(order.filter(x => x !== best), O, Z);
  }
  // Quick sights along the way
  const along = [];
  if (d.alongWay) {
    const used = new Set(order.map(s => s.id));
    const quick = (city.sites || []).filter(s => s.quick && !used.has(s.id) && religiousOk(s));
    let slack = budget - total(order);
    const pts = [O, ...order, ...(Z ? [Z] : [])];
    const inserts = [];
    for (const q of quick) {
      let best = null;
      for (let i = 0; i < pts.length - 1; i++) {
        if (travel(pts[i], pts[i + 1]).mode !== "walk") continue;
        const sd = segDist(q, pts[i], pts[i + 1]);
        if (sd.d < 0.22 && (!best || sd.d < best.d)) best = { i, t: sd.t, d: sd.d };
      }
      if (best) inserts.push(Object.assign({ q }, best));
    }
    inserts.sort((a, b) => a.d - b.d);
    const accepted = [];
    for (const ins of inserts) { const cost = ins.q.minutes + 3; if (slack - cost < 0) continue; slack -= cost; accepted.push(ins); }
    accepted.sort((a, b) => a.i - b.i || a.t - b.t);
    const seq = [];
    for (let i = 0; i < order.length + 1; i++) {
      accepted.filter(a => a.i === i).forEach(a => { seq.push(Object.assign({}, a.q, { along: true })); along.push(a.q); });
      if (i < order.length) seq.push(order[i]);
    }
    order = seq;
  }
  // Meals placed on the path, then the whole day polished together
  let t0 = w.start; { let pv = w.head[0]; w.head.slice(1).forEach(p => { t0 += tmin(pv, p) + (p.minutes || 0); pv = p; }); }
  const ZZ = w.tail[0] || null;
  const tailCost = () => { let c = 0, pv = ZZ; w.tail.slice(1).forEach(p => { c += tmin(pv, p) + (p.fixed ? p.minutes || 0 : 0); pv = p; }); return c; };
  // A meal is planned only on a day with stops, and only if it fits before the day has to end.
  // A table the traveler already booked replaces that meal's suggestion and is pinned at its time: the route
  // reshapes around it. One booked after the day's sightseeing ends is added after the day instead.
  const books = bookedMeals(d, city), dayEnd = w.endBy - tailCost();
  const inDay = books.filter(m => m.from >= t0 && m.from + m.len <= dayEnd), lateBooks = books.filter(m => !inDay.includes(m));
  const needMeals = q => q.some(x => !x.mealOf) || inDay.length ? MEALS.filter(m => !books.some(b => b.label === m.label) && t0 < m.to - 30 && m.from + m.len + 15 <= dayEnd).concat(inDay).sort((a, b) => a.from - b.from) : [];
  const withMeals = q => { const bare = q.filter(x => !x.mealOf); return placeMeals(bare, needMeals(bare), t0, O, ZZ, style, city); };
  const savedAvoid = avoidMeals, av = new Set(), myIdx = trip.days.indexOf(d);
  trip.days.slice(0, Math.max(0, myIdx)).forEach(o => { if (cityFor(o) !== city) return; if (!mealMemo.has(o)) { try { buildPlan(o); } catch (e) {} } (mealMemo.get(o) || []).forEach(n => av.add(n)); });
  avoidMeals = av;
  let seq = withMeals(order);
  // Safety net, checked on the real simulated day: if the day still runs late (a reserved table across town
  // can do that), the stop that frees the most time for the least sightseeing gives way, until it fits.
  // The step after this one then puts back every dropped stop that fits somewhere else in the day.
  { const lim = w.endBy - tailCost();
    for (let guard = 0; guard < 12; guard++) {
      if (simDay(seq, t0, O, ZZ, style).end <= lim + 5) break;
      const bare = seq.filter(x => !x.mealOf); if (bare.length < 2) break;
      const cands = bare.filter(x => !x.mustSee).length ? bare.filter(x => !x.mustSee) : bare;
      let best = null;
      for (const c of cands) { const q = polishDay(withMeals(bare.filter(x => x !== c)), t0, O, ZZ, style, city), e = simDay(q, t0, O, ZZ, style).end, val = (simDay(seq, t0, O, ZZ, style).end - e) / Math.max(20, c.minutes || 0); if (!best || val > best.val) best = { val, q, c }; }
      seq = best.q; dropped.push(best.c);
    } }
  // Feedback loop: the drop step above uses a quick estimate. Now check each dropped stop against the real
  // simulated day (actual route, meals, opening times) and put back every one that truly fits, the day's
  // main area first, so a day is never cut short on a guess.
  if (dropped.length) {
    const lim = w.endBy - tailCost();
    const rank = x => (x.mustSee ? 2 : 1) * (seq.filter(y => !y.mealOf && hav(y, x) < 15).length + 1);
    for (const c of dropped.slice().sort((a, b) => rank(b) - rank(a))) {
      const bare = seq.filter(x => !x.mealOf); let best = null;
      for (let i = 0; i <= bare.length; i++) {
        const q = polishDay(withMeals(bare.slice(0, i).concat([c], bare.slice(i))), t0, O, ZZ, style, city), r = simDay(q, t0, O, ZZ, style);
        if (r.end <= lim && (!best || r.cost < best.cost)) best = { q, cost: r.cost };
      }
      if (best) { seq = best.q; dropped.splice(dropped.indexOf(c), 1); }
    }
  }
  // Spare time: add the best nearby sights that still fit, with a 15-minute cushion (they show as bonus stops)
  const bonus = [];
  if (d.fillTime !== false && !d.rain) {
    const taken = new Set(Object.keys(plannedElsewhere(d)));
    trip.days.slice(0, trip.days.indexOf(d)).forEach(o => { if (cityFor(o) !== city) return; if (!bonusMemo.has(o)) { try { buildPlan(o); } catch (e) {} } (bonusMemo.get(o) || []).forEach(id => taken.add(id)); });
    const inSeq = new Set(seq.filter(x => !x.mealOf).map(x => x.id)), skip = new Set((d.selected || []).concat(dropped.map(x => x.id)));
    const pool = (city.sites || []).concat(city.farther || []).filter(x => !x.quick && religiousOk(x) && !inSeq.has(x.id) && !skip.has(x.id) && !taken.has(x.id) && !closedOn(x, d.date) && (!d.rain || x.indoor))
      .map(x => Object.assign({}, x, { minutes: Math.round(x.minutes * mult / 5) * 5 || x.minutes, bonus: true }));
    const limit = w.endBy - 15 - tailCost();
    for (let n = 0; n < 8 && pool.length; n++) {
      const base = simDay(seq, t0, O, ZZ, style); let pick = null;
      // Make the most of the day: with a little time left, only sights right on the route; with hours to
      // spare, sights a short ride away too; with most of a day free, a day trip farther out.
      const spare = limit - base.end, reach = spare > 240 ? 60 : spare > 120 ? 5 : 1.5;
      for (const c of pool) {
        const stopsNow = seq.filter(x => !x.mealOf);
        if (c.far && spare <= 240) continue;
        if (stopsNow.length && hav(c, O) > 4 && !stopsNow.some(x => hav(c, x) < reach)) continue; // once the day has stops, only add sights near its route
        for (let i = 0; i <= seq.length; i++) {
          let q = seq.slice(0, i).concat([c], seq.slice(i));
          if (needMeals(q).length !== seq.filter(x => x.mealOf).length) q = withMeals(q); // first stop of an empty day brings its meal
          const r = simDay(q, t0, O, ZZ, style);
          if (r.end > limit) continue;
          const val = (c.mustSee ? 2 : 1) * (c.kind === style ? 1.3 : 1) / Math.max(10, r.cost - base.cost);
          if (!pick || val > pick.val) pick = { val, q, c };
        }
      }
      if (!pick) break;
      const pol = polishDay(pick.q, t0, O, ZZ, style, city); seq = simDay(pol, t0, O, ZZ, style).end <= limit ? pol : pick.q; bonus.push(pick.c); pool.splice(pool.indexOf(pick.c), 1);
    }
  }
  bonusMemo.set(d, bonus.map(x => x.id));
  // Timeline
  const items = [{ type: "start", place: w.head[0], time: w.start, label: w.startLabel }];
  let clock = w.start, prev = w.head[0];
  const go = (p, type, extra) => {
    const leg = travel(prev, p);
    items.push({ type: "travel", leg, time: clock }); clock += leg.min;
    items.push(Object.assign({ type, place: p, time: clock }, extra || {})); clock += p.minutes || 0; prev = p;
  };
  w.head.slice(1).forEach(p => go(p, "fixed"));
  const meals = [];
  seq.forEach(s => {
    if (!s.mealOf) { go(s, "stop"); return; }
    const leg = travel(prev, s); items.push({ type: "travel", leg, time: clock }); clock += leg.min;
    const at = Math.max(clock, s.mealOf.from), alts = mealAlternatives(s, seq, city);
    const r = Object.assign({}, s, { alts }); delete r.mealOf;
    items.push({ type: "meal", meal: s.mealOf, place: r, time: at }); clock = at + s.mealOf.len; meals.push(r); prev = s;
  });
  w.tail.forEach((p, i) => go(Object.assign({}, p, { minutes: p.fixed ? p.minutes : 0 }), i === w.tail.length - 1 ? "end" : "fixed", i === w.tail.length - 1 ? { label: w.endLabel } : {}));
  if (!w.tail.length) items.push({ type: "end", place: null, time: clock, label: "Day done" });
  // The evening: a table the traveler booked for after the day's sightseeing, or else (on days that end in town)
  // a suggested dinner: a real place a short walk from where the day finishes, with two different alternatives.
  mealMemo.set(d, meals.flatMap(m => [m].concat(m.alts || [])).filter(m => !m.generic).map(m => keyOf(m.name)));
  const evening = [], endAt = (w.tail.length ? w.tail[w.tail.length - 1] : prev) || null;
  lateBooks.forEach(m => { const leg = endAt ? travel(endAt, m.node) : null; evening.push({ type: "evening", meal: m, place: Object.assign({}, m.node), time: Math.max(m.from, clock + (leg ? leg.min : 0)), leg, booked: true, late: m.from < clock + (leg ? leg.min : 0) - 5 }); });
  const hasDinner = seq.some(x => x.mealOf && x.mealOf.label === "Dinner") || books.some(b => b.label === "Dinner");
  if (!hasDinner && !skipEvening && endAt && (d.type === "land" || d.type === "arrival") && clock < MEALS[1].to - 45) {
    // Lunches come first: a suggested dinner never takes a place another day of the trip eats lunch at,
    // nor another evening's dinner.
    const today = new Set(meals.flatMap(m => [m].concat(m.alts || [])).map(m => keyOf(m.name)));
    skipEvening = true;
    try { trip.days.forEach((o, k) => { if (o === d || cityFor(o) !== city) return; if (k > myIdx) { try { buildPlan(o); } catch (e) {} } (mealMemo.get(o) || []).forEach(n => today.add(n)); (eveMemo.get(o) || []).forEach(n => today.add(n)); }); } finally { skipEvening = false; }
    const pool = (city.restaurants || []).filter(r => !r.generic && !r.crowdDrop && hav(r, endAt) <= 0.8 && !avoidMeals.has(keyOf(r.name)) && !today.has(keyOf(r.name)));
    if (pool.length) {
      const sc = r => (r.crowdTop ? 4 : 0) + (r.top ? 2 : 0) + (r.recommended ? 2 : 0) + (trip.style && trip.style !== "mix" && r.kind === trip.style ? 1.5 : 0) - hav(r, endAt) * 3;
      const main = pool.slice().sort((a, b) => sc(b) - sc(a))[0], alts = mealAlternatives(main, seq.concat(meals.map(m => Object.assign({}, m, { mealOf: MEALS[0] }))), city);
      const leg = travel(endAt, main);
      evening.push({ type: "evening", meal: MEALS[1], place: Object.assign({}, main, { alts }), time: Math.max(MEALS[1].from, clock + 30), leg, near: endAt.name });
    }
  }
  evening.forEach(e => items.push(e));
  eveMemo.set(d, evening.filter(e => !e.booked).flatMap(e => [e.place].concat(e.place.alts || [])).map(m => keyOf(m.name)));
  avoidMeals = savedAvoid;
  const walkKm = items.filter(i => i.type === "travel" && i.leg.mode === "walk").reduce((a, i) => a + i.leg.km, 0);
  const stops = items.filter(i => i.type === "stop");
  return { city, w, items, stops, dropped, along, bonus, meals, evening, swaps, closedToday, start: w.start, endBy: w.endBy, end: clock, walkKm, over: clock > w.endBy + 5, tight: budget < fixed + 45 };
}

// ---------- AI ----------
const aiReady = () => !!sample;
// "Change my trip": say what changed or show the new booking, and the AI rewrites the days.
let changeImgs = [], changeText = "";
function changeCard() {
  if (!aiReady()) return "";
  return `<details class="card change more" ${changeText || changeImgs.length || busy ? "open" : ""}><summary>Change my trip by telling your guide</summary><p class="lede">Say what changed, or add a photo of the new booking. I'll update the days and keep everything else.</p>
    <div class="chips">${(() => { const c = trip.days.filter(x => x.type !== "sea" && x.type !== "port").map(x => x.destination); const first = c[0] || "the first city", last = c[c.length - 1] || "the last city";
      return [`Add a day in ${first}`, "We fly home a day later", `We're staying at a different hotel in ${first}`, `Remove a day in ${last}`]; })().map(x => `<button class="chip" data-chg="${esc(x)}">${esc(x)}</button>`).join("")}</div>
    <textarea id="chgText" rows="2" placeholder="e.g. Our flight now lands at 2 pm on June 30, and we're staying at the Hotel Grande Bretagne">${esc(changeText)}</textarea>
    <div class="actions">${changeImgs.length ? changeImgs.map((x, i) => `<img class="thumb" src="${x.url}" alt="New booking photo ${i + 1}">`).join("") : ""}
      ${changeImgs.length < 4 ? `<label class="btn ghost small">+ Photo of new booking<input type="file" accept="image/*" capture="environment" id="chg-img" hidden></label>` : ""}
      <button class="btn" data-act="changetrip" ${busy ? "disabled" : ""}>Update my trip</button></div></details>`;
}
async function changeTrip() {
  const tx = ((document.getElementById("chgText") || {}).value || "").trim(); changeText = tx;
  if (!aiReady() || (!tx && !changeImgs.length)) return;
  busy = { text: "Updating your trip…" }; aiError = ""; render();
  const lines = trip.days.map(d => ["DAY", d.date, d.destination, d.type, d.mode, d.time, d.portArrive, d.allAboard, d.tender ? "yes" : "no", "", d.estimated ? "yes" : "no"].join("|")).join("\n");
  try {
    const imgs = changeImgs.map(x => x.blob);
    const r = await sample(`Here is a traveler's trip, one day per line (DAY|date YYYY-MM-DD|destination|type|mode|time HH:MM|portArrive|allAboard|tender yes/no|lodging|estimated yes/no):\n${lines}\n\n${tx ? `What changed, in their words: "${tx}"\n` : ""}${imgs.length ? "Photos of their new or updated booking are attached; copy their dates, places and times exactly.\n" : ""}Apply the change and write the complete updated trip in the same DAY line format. Keep every day that isn't affected exactly as it is. Types: arrival, land, embark, port, sea, departure. Modes: flight, train, ship, car. On a travel day between two cities make a departure and an arrival with the same date. Only DAY lines.`, { modelTier: "complex", ...(imgs.length ? { images: imgs } : {}) });
    const days = parseDayLines(r.text || "");
    if (!days.length || r.truncated) throw new Error("short");
    const old = {}; trip.days.forEach(d => { old[d.date + "|" + keyOf(d.destination) + "|" + d.type] = d; });
    const before = trip.days.length, activeDay = trip.days[trip.active];
    trip.days = days.map(d => { const o = old[d.date + "|" + keyOf(d.destination) + "|" + d.type]; return o ? Object.assign(o, { time: d.time, portArrive: d.portArrive, allAboard: d.allAboard, mode: d.mode }) : d; });
    if (days.some(d => d._lodging)) { trip.lodging = trip.lodging || {}; days.forEach(dd => { if (dd._lodging) trip.lodging[keyOf(dd.destination)] = { idx: "custom", name: dd._lodging, ll: null }; }); }
    trip.days.forEach(dd => delete dd._lodging);
    const ai = trip.days.indexOf(activeDay); trip.active = ai >= 0 ? ai : Math.min(trip.active, trip.days.length - 1); trip.tour = null;
    changeImgs = []; changeText = ""; busy = null; trip.lastChange = { at: Date.now(), from: before, to: trip.days.length };
    save(); render();
  } catch (e) { busy = null; aiError = "I couldn't apply that change. Try saying it another way, or tap the day to edit it."; render(); }
}
function missingStops() {
  const pc = trip.portCheck; if (!pc) return null;
  const has = n => { const k = keyOf(n.replace(/\(.*\)/, "")); return !k || trip.days.some(dd => keyOf(dd.destination).includes(k) || k.includes(keyOf(dd.destination.replace(/\(.*\)/, "")))); };
  const miss = (pc.missing || []).filter(n => !has(n)), ports = trip.days.filter(x => x.type === "port").length;
  const short = pc.expected && ports < pc.expected ? pc.expected - ports : 0;
  return miss.length || short ? { miss, short, ports, expected: pc.expected } : null;
}
function stopsBanner() {
  const m = missingStops(); if (!m) return "";
  const what = [m.miss.length ? "<b>" + m.miss.map(esc).join(", ") + "</b>" : "", m.short ? `${m.short} cruise stop${m.short > 1 ? "s" : ""} (you said ${m.expected}, I have ${m.ports})` : ""].filter(Boolean).join(" and ");
  return `<div class="banner warn" role="alert"><span>Some stops are missing: ${what}.</span>${aiReady() ? `<button class="btn small" data-act="fixstops" ${busy ? "disabled" : ""}>Fix it for me</button>` : `<span>Tap the day before it and use <b>+ Add a port day</b>.</span>`}</div>`;
}
async function fixStops() {
  const m = missingStops(); if (!m || !aiReady()) return;
  busy = { text: "Adding the missing stops…" }; aiError = ""; render();
  const lines = trip.days.map(d => ["DAY", d.date, d.destination, d.type, d.mode, d.time, d.portArrive, d.allAboard, d.tender ? "yes" : "no", "", d.estimated ? "yes" : "no"].join("|")).join("\n");
  try {
    const r = await sample(`A traveler's trip itinerary is missing stops. ${m.miss.length ? "Missing places: " + m.miss.join(", ") + ". " : ""}${m.short ? `They said the cruise has ${m.expected} ports but the list has ${m.ports}. ` : ""}${trip.sourceText ? `Their own description:\n"""${trip.sourceText}"""\n` : ""}Current itinerary, one day per line (DAY|date|destination|type|mode|time|portArrive|allAboard|tender|lodging|estimated):\n${lines}\n\nWrite the complete corrected itinerary in the same DAY line format, keeping every existing day and its details, inserting the missing stops in the right order and shifting later dates only if needed. Types: arrival, land, embark, port, sea, departure. Modes: flight, train, ship, car. Only DAY lines.`, { modelTier: "complex" });
    const days = parseDayLines(r.text || "");
    if (days.length < trip.days.length || r.truncated) throw new Error("short");
    const old = {}; trip.days.forEach(d => { old[d.date + "|" + keyOf(d.destination)] = d; });
    trip.days = days.map(d => { const o = old[d.date + "|" + keyOf(d.destination)]; return o ? Object.assign(o, { type: d.type }) : d; });
    trip.active = Math.min(trip.active, trip.days.length - 1);
    busy = null; save(); render();
  } catch (e) { busy = null; aiError = "I couldn't add the missing stops just now. Try again, or add them with + Add a port day."; render(); }
}
function parseDayLines(out) {
  const types = DAY_TYPES.map(t => t.key), hm = v => /^\d\d:\d\d$/.test((v || "").trim()) ? v.trim() : "";
  return String(out).split("\n").filter(l => /^\s*DAY\|/.test(l)).map(l => l.trim().split("|").map(x => x.trim())).filter(f => f[2]).map(f => {
    const [, date, destination, type0, mode0, time, pa, aa, tender, lodging, est] = f;
    const type = types.includes(type0) ? type0 : "land", mode = MODES[mode0] ? mode0 : "flight";
    return newDay({
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "", destination, type, mode,
      time: hm(time) || (type === "departure" ? "15:00" : "10:30"), portArrive: hm(pa) || "08:00", allAboard: hm(aa) || "16:30",
      tender: /^y/i.test(tender || ""), hours: type === "arrival" ? 6 : 8, _lodging: lodging || "", estimated: /^y/i.test(est || "")
    });
  });
}
function parseJSON(text) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("no json");
  try { return JSON.parse(text.slice(a, b + 1)); } catch (e) { const r = salvageJSON(text.slice(a)); if (r) return r; throw e; }
}
// If an answer was cut off mid-way, keep everything up to the last complete item and close the brackets.
function salvageJSON(t) {
  const stack = []; let inStr = false, esc = false, lastOk = -1, lastStack = null;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") stack.push(c === "{" ? "}" : "]");
    else if (c === "}" || c === "]") { stack.pop(); if (!stack.length) return JSON.parse(t.slice(0, i + 1)); lastOk = i; lastStack = stack.slice(); }
  }
  if (lastOk < 0) return null;
  try { return JSON.parse(t.slice(0, lastOk + 1) + lastStack.reverse().join("")); } catch (e) { return null; }
}
const numV = v => (typeof v === "number" && isFinite(v) ? v : parseFloat(v));
function normSite(s, i, extra) {
  const num = numV;
  return {
    id: String(s.id || ("s" + i)).replace(/[^a-z0-9-]/gi, "-").toLowerCase() + (extra || ""),
    name: String(s.name || "Site"), lat: num(s.lat), lng: num(s.lng),
    minutes: Math.max(5, Math.min(360, Math.round(num(s.minutes) || 45))),
    kind: s.kind === "local" ? "local" : "touristy", mustSee: !!s.mustSee, quick: !!s.quick, far: !!s.far,
    category: String(s.category || ""), summary: String(s.summary || ""), guide: String(s.guide || ""),
    lookFor: Array.isArray(s.lookFor) ? s.lookFor.map(String).slice(0, 4) : [], photoTip: String(s.photoTip || ""), picks: normPicks(s.picks),
    travel: s.travel ? String(s.travel) : "",
    hours: String(s.hours || ""), closed: String(s.closed || ""), tickets: String(s.tickets || ""), crowds: String(s.crowds || ""),
    cost: Math.max(0, num(s.cost) || 0), indoor: !!s.indoor, access: String(s.access || ""),
    travelerTip: String(s.travelerTip || ""), priceNote: String(s.priceNote || ""), web: /^https?:\/\//.test(s.web || "") ? String(s.web) : "", sources: Array.isArray(s.sources) ? s.sources.map(String).slice(0, 5) : []
  };
}
function cleanCity(c, dest) {
  const num = numV;
  const okLL = p => p && isFinite(num(p.lat)) && isFinite(num(p.lng));
  const site = normSite;
  const starts = {};
  for (const k of ["cruise", "airport", "station", "hotel", "point"]) starts[k] = ((c.starts && c.starts[k]) || []).filter(okLL).map(p => ({ name: String(p.name), lat: num(p.lat), lng: num(p.lng), note: p.note ? String(p.note) : "" }));
  return {
    city: String(c.city || dest), country: String(c.country || ""), ai: true, verified: c.verified || 0, grounded: !!c.grounded, gv: String(c.gv || ""), eatsV: +c.eatsV || 0, startsOk: !!c.startsOk, starts,
    sites: (c.sites || []).filter(okLL).map((s, i) => site(s, i)),
    farther: (c.farther || []).filter(okLL).map((s, i) => Object.assign(site(s, i, "-far"), { far: true })),
    basics: c.basics ? {
      currency: String(c.basics.currency || ""), symbol: String(c.basics.symbol || ""), language: String(c.basics.language || ""), langCode: String(c.basics.langCode || ""),
      tipping: String(c.basics.tipping || ""), safety: String(c.basics.safety || ""), emergency: String(c.basics.emergency || ""), plugs: String(c.basics.plugs || ""), water: String(c.basics.water || ""),
      phrases: (c.basics.phrases || []).filter(p => p && p.local).slice(0, 10).map(p => ({ local: String(p.local), say: String(p.say || ""), meaning: String(p.meaning || ""), lang: String(p.lang || c.basics.langCode || "") }))
    } : null,
    lang: P().lang,
    gettingAround: (c.gettingAround || []).filter(x => x && x.tip).slice(0, 5).map(x => ({ mode: String(x.mode || ""), tip: String(x.tip) })),
    restaurants: (c.restaurants || []).filter(okLL).map(r => ({ onMap: !!r.onMap, generic: !!r.generic, recommended: !!r.recommended, top: !!r.top, style: String(r.style || ""), name: String(r.name), lat: num(r.lat), lng: num(r.lng), kind: r.kind === "local" ? "local" : "touristy", cuisine: String(r.cuisine || ""), price: String(r.price || ""), why: String(r.why || "") }))
  };
}
function faithNote() {
  const i = P().interests;
  return i.includes("bible") ? " The travelers follow St Paul and St John: share the faith perspective, including any Bible connection with chapter and verse, and the place's meaning for Christians." : i.includes("churches") ? " The travelers value faith: include the place's religious meaning where it has one." : "";
}
// Add any place the traveler names, or more day trips beyond what the guide listed.
let addBusy = null;
async function addPlaces(d, ask) {
  const city = cityFor(d); if (!city || !aiReady() || addBusy) return;
  addBusy = ask ? "Finding " + ask + "…" : "Looking farther afield…"; aiError = ""; render();
  const have = allSites(city).map(x => x.name).join(", ");
  const base = cityKeyFor(d) === "barcelona" ? "Barcelona" : city.city;
  const prompt = `You are an expert tour guide writing data for a self-guided tour app. The traveler is based in ${base}${city.country ? ", " + city.country : ""} for the day${d.type === "port" ? " on a cruise port stop and must be back aboard the same day" : ""}.
${ask ? `They want to visit: "${ask}". If it is one sight, return it. If it is a town or area with several sights (for example Ancient Corinth: the Temple of Apollo and site museum, Acrocorinth, the Corinth Canal), return each sight a visitor should see there as its own place, up to 5, in a sensible visiting order, with the first one marked "mustSee": true. If it is far away, say honestly in "travel" how long it takes to get there from ${base}.` : `Suggest 4 more day trips or sights farther out (up to about 2.5 hours away each way) that are NOT in this list: ${have}. Mix famous and lesser-known.${P().interests.includes("bible") ? " Favor Bible and early Christian sites." : P().interests.includes("churches") ? " Favor important churches and pilgrimage sites." : ""}`}
Return ONLY JSON: {"places":[{"id","name","lat","lng","minutes","kind":"touristy"|"local","mustSee":boolean,"category","far":boolean,"travel","summary","guide","lookFor","photoTip","picks","hours","closed","tickets","crowds","cost","indoor","access"}]}
- "far": true if it is more than about 6 km from the center of ${base}; then "travel" says how to get there and the one-way time, and "minutes" is time on site.
- "guide": spoken narration in second person, 110-150 words, with real history and stories. "lookFor": 3 specific details. "picks": 3 insider extras a professional guide would share, each {"k": "spot"|"timing"|"story"|"taste", "t": one or two sentences}. "cost": typical adult ticket in local currency as a number (0 if free).
- Write human-readable text in ${P().lang}. Real coordinates.${P().interests.includes("bible") ? "\n- The travelers follow St Paul and St John: in each guide, tell any Bible connection with chapter and verse." : ""}`;
  try {
    const r = await sample(prompt, { modelTier: "default" });
    const j = parseJSON(r.text || "");
    const okLL = p => p && isFinite(numV(p.lat)) && isFinite(numV(p.lng));
    const added = (j.places || []).filter(okLL).map((x, i) => { const st = normSite(x, i, "-add" + Date.now().toString(36) + i); st.added = true; return st; });
    if (!added.length) throw new Error("none");
    const center = (city.starts && city.starts.point && city.starts.point[0]) || allSites(city)[0];
    added.forEach(st => { if (center && hav(center, st) > 6) st.far = true; (st.far ? (city.farther = city.farther || []) : city.sites).push(st); });
    if (ask) { d.selected = d.selected || []; added.forEach(st => d.selected.push(st.id)); }
    addBusy = null; save(); render();
    const el = document.getElementById("s-" + added[0].id); if (el) el.closest("label").scrollIntoView({ block: "center" });
  } catch (e) { addBusy = null; aiError = ask ? `I couldn't find "${ask}". Try the full name, like "Ancient Corinth".` : "No more day trips came back. Try again in a moment."; render(); }
}
function addPlaceCard(d) {
  if (!aiReady()) return `<div class="card addplace"><h3>Don't see a place you want?</h3><p class="lede">Adding any place, or more day trips, uses Claude. Turn on the AI guide in Settings to turn it on.</p></div>`;
  return `<div class="card addplace"><div><h3>Don't see a place you want?</h3><p class="lede">Name it and your guide adds it to today, with the travel time and its story.</p></div>
    <div class="addrow"><input id="addPlace" type="text" placeholder="e.g. Ancient Corinth" enterkeyhint="go" ${addBusy ? "disabled" : ""}><button class="btn" data-act="addplace" ${addBusy ? "disabled" : ""}>Add it</button></div>
    <div class="actions"><button class="btn ghost" data-act="moretrips" ${addBusy ? "disabled" : ""}>Show more day trips farther out</button>${addBusy ? `<span class="lede"><span class="spinner"></span> ${esc(addBusy)}</span>` : ""}</div></div>`;
}
function aiErrorText(e, what) {
  return e && e.code === "not_granted" ? "Claude access was turned off, so only the built-in Barcelona guide works." :
    e && e.code === "rate_limited" ? "Too many requests right now. Try again in a minute." :
    what + " didn't come through. Try again.";
}
let progressTicker = 0; const stopTicker = () => clearInterval(progressTicker);
async function generateCity(d, quiet) {
  if (!aiReady()) return false;
  const label = d.destination;
  // Show the build on the day plan, which has the progress bar (the tour screen is for walking a finished guide).
  if (!quiet) { if (view === "tour") view = "plan"; busy = { text: "Asking your guide about " + label + "…" }; aiError = ""; render(); window.scrollTo(0, 0); }
  const isPort = d.type === "port";
  const prompt = `You are an expert local tour guide writing data for a self-guided tour app that replaces paid guided tours.
Destination: ${label}
Date of visit: ${d.date || "not given"}
Kind of day: ${typeInfo(d.type).label}${isPort ? ". The traveler arrives on a cruise ship and must be back aboard the same day; if the port is a gateway to a bigger city (for example Civitavecchia for Rome), put that city's highlights in \"farther\" with honest travel times" : ""}.
${d.event ? "Special event: " + d.event + ". Include its venue as a mustSee site." : ""}
${trip.prefs && trip.prefs.interests.length ? "Traveler interests: " + trip.prefs.interests.join(", ") + ". Favor sights that match." : ""}
${trip.prefs && trip.prefs.interests.includes("churches") ? "Always include the city's most important churches, cathedrals, monasteries and other places of worship, with their history and what makes them sacred." : ""}
${trip.prefs && trip.prefs.interests.includes("bible") ? "The travelers want Bible and early Christian sites: include any place linked to the Bible, the apostles (for example Paul's journeys through Athens, Corinth, Ephesus, Crete, Malta and Rome, and John in Ephesus and Patmos), early churches, catacombs and pilgrimage sites, as main sights or in farther, and in each guide tell the Bible connection with the chapter and verse." : ""}
${trip.prefs && trip.prefs.travelers ? "About the travelers: " + trip.prefs.travelers + "." : ""}

Return ONLY a JSON object, no commentary, with this shape:
{
 "city": string, "country": string,
 "starts": { "cruise": [ {"name","lat","lng","note"} ], "airport": [...], "station": [...], "hotel": [...], "point": [...] },
 "sites": [ {"id","name","lat","lng","minutes","kind","mustSee","category","summary","guide","lookFor","photoTip","picks"} ],
 "farther": [ {"id","name","lat","lng","minutes","kind","category","travel","summary","guide","lookFor","photoTip","picks"} ],
 "restaurants": [ {"name","lat","lng","kind","cuisine","price","why"} ],
 "gettingAround": [ {"mode","tip"} ]
}
Rules:
- "gettingAround": 3-4 practical tips on the best ways to get around (for example metro and which pass to buy, taxis and apps that work there, port shuttles, walking), each with a short "mode" label and a one-sentence "tip".
- "starts": real places. "cruise": the cruise terminal(s) where ships dock or tender (empty array if none). "airport": nearest main airport. "station": main train station(s), empty if none. "hotel": 3 central areas to stay, named like "Hotel near <landmark>". "point": 1-2 central landmarks. Add a short "note" when useful (shuttle bus, tender, distance to center).
- "sites": 14 main sights, plus 5 small quick sights ("quick": true, minutes 10) that people walk past: fountains, statues, façades. 3-5 main sights are mustSee true. About a third are "kind":"local" (places locals love that tour groups skip), the rest "touristy".
- "minutes": realistic visit time. "summary": one sentence. "guide": spoken narration in second person, 110-150 words for main sights and 40-60 for quick ones, with real history, stories and what makes it special. "lookFor": 3 specific details to spot (1 for quick sights). "photoTip": one sentence. "picks": for main sights and day trips (not quick sights), 3 insider extras a professional licensed local guide would share at this stop, each {"k": "spot" | "timing" | "story" | "taste", "t": one or two specific sentences}: where to stand or a hidden detail, when to go or how to beat the line, the anecdote guides tell, or a nearby local food or drink.
- "farther": 3-4 day trips or out-of-area sights. "travel": how to get there and the one-way time. "minutes": time on site.
- "restaurants": 10 real, long-established places spread near the sites, half "local" favorites and half "touristy". "price": $, $$ or $$$ or the local currency symbol. "why": one sentence.
- Every site (main, quick and farther) also has: "hours" (typical opening hours, short), "closed" (closed days like "Closed Mondays", or ""), "tickets" (booking and skip-the-line tip), "crowds" (best time to avoid crowds, mention cruise groups if relevant), "cost" (typical adult entry fee as a number in local currency, 0 if free; for farther sights include round-trip transport), "indoor" (true if mostly indoors), "access" (step-free or not, steep, stairs; one short sentence).
- Add "basics": {"currency","symbol","language","langCode" (BCP-47 like "el" or "it"),"tipping","safety","emergency","plugs","water","phrases":[8 useful phrases for travelers: {"local","say" (simple English pronunciation),"meaning","lang" (BCP-47)}]}.
- Coordinates accurate to 4 decimals. Only real places that exist. No markdown.
- Write all human-readable text (summary, guide, lookFor, tips, basics, phrase meanings) in ${P().lang}. Keep place names and local phrases in their own language.
${P().access !== "none" ? "- The travelers need: " + ACCESS.find(a => a[0] === P().access)[1] + ". Prefer accessible sights and mention access issues honestly." : ""}`;
  try {
    // Progress that always moves: each step has a ceiling, and between real updates the bar creeps
    // toward it, so the traveler sees the build working even while a slow step waits on a server.
    const started = Date.now(); let pct = 0, cap = 8, step = "Choosing the best places";
    const paint = () => { if (!busy) return; const s = Math.round((Date.now() - started) / 1000); busy.text = (quiet ? busy.prefix || "" : "") + "Building the " + label + " guide · " + step + "… " + Math.min(99, Math.round(pct)) + "% · " + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); updateBusy(); };
    const show = (n, what, top) => { if (what) step = what; if (top) cap = top; pct = Math.max(pct, Math.min(99, n)); paint(); };
    clearInterval(progressTicker);
    progressTicker = setInterval(() => { if (!busy) return clearInterval(progressTicker); if (pct < cap) pct += Math.max(0.05, (cap - pct) * 0.03); paint(); }, 1000);
    show(1);
    let raw = await cachedGuide(d), fresh = !raw;
    if (raw && !guideInLang(raw, P().lang)) { raw = null; fresh = true; }
    // A saved guide no fuller than the built-in one is no upgrade: build a new one instead.
    const builtinNow = cityFor(d) && cityFor(d).builtin ? cityFor(d) : null;
    if (raw && builtinNow && (raw.sites || []).length <= (builtinNow.sites || []).length) { raw = null; fresh = true; }
    if (!raw) raw = sample === freeSample ? await cityInParts(prompt, show, label) : parseJSON((await sample(prompt, { modelTier: "default", onText: ({ text }) => show(text.length / 260, "Writing the stories", 90) })).text);
    if (raw) {
      const before = JSON.stringify([raw.verified, raw.grounded, (raw.restaurants || []).length, raw.startsOk, raw.eatsV]);
      show(90, "Finding real restaurants on the map", 99);
      raw = await realPlaces(raw, label);
      // Safeguard: never show a city whose places couldn't be confirmed.
      if (!raw.grounded) throw new Error("check unavailable");
      if (fresh || !raw.gv) raw.gv = GUIDE_V;
      if (JSON.stringify([raw.verified, raw.grounded, (raw.restaurants || []).length, raw.startsOk, raw.eatsV]) !== before) fresh = true;
    }
    const c = cleanCity(raw, label);
    if (!c.sites.length) throw new Error("empty");
    if (!guideInLang(c, P().lang)) throw new Error("The guide came back in the wrong language. Try again.");
    // Never swap a built-in guide for a thinner one (and don't save it for others): keep what the traveler has.
    if (builtinNow && c.sites.length <= (builtinNow.sites || []).length) throw new Error("not fuller");
    if (fresh) keepGuide(d, raw);
    const key = keyOf(label) + (d.event ? "|" + keyOf(d.event) : "");
    const wasBuiltin = !!(cities[key] && cities[key].builtin) || !!(cityFor(d) && cityFor(d).builtin);
    cities[key] = c;
    // A fuller guide replacing a built-in one has new stop ids, so those days get fresh picks.
    trip.days.forEach(x => { if (keyOf(x.destination) === keyOf(label) && !x.event === !d.event) { x.cityKey = key; x.pointIdx = 0; if (wasBuiltin) x.selected = null; if (!x.selected) x.selected = defaultSelection(c, trip.style, x); } });
    save();
    stopTicker();
    if (!quiet) { busy = null; view = "plan"; render(); window.scrollTo(0, 0); }
    return true;
  } catch (e) {
    stopTicker();
    try { console.warn("Guide build failed for " + label + ":", e && (e.stack || e.message || e)); } catch (x) {}
    if (!quiet) { busy = null; aiError = /allowance/i.test((e && e.message) || "") ? e.message : /check unavailable/.test((e && e.message) || "") ? "The map service that checks every place didn't answer, so I didn't build the guide (I never show places I can't confirm). Try again in a minute." : aiErrorText(e, "The guide for " + label); render(); }
    return false;
  }
}
// Grounding: looks up each named place on Wikipedia and the map. A place counts as real when its name
// matches a Wikipedia article or a map entry near the city. Returns null if the lookup service didn't answer.
const SMALL_WORDS = new Set("the of and a an de la el le du del di da des los las st saint san santa archaeological site".split(" "));
function nameMatch(want, got) {
  const w = keyOf(String(want).replace(/\(.*?\)/g, " ")).split(" ").filter(t => t.length > 1 && !SMALL_WORDS.has(t)), g = new Set(keyOf(got).split(" "));
  if (!w.length) return false;
  // Same word, the same stem (Venetian/Venice), or one letter apart in the local spelling (Luka/Luke).
  const oneOff = (a, b) => a.length === b.length && a.length >= 4 && a.slice(0, 2) === b.slice(0, 2) && [...a].filter((c, i) => c !== b[i]).length === 1;
  return w.filter(t => g.has(t) || [...g].some(x => (x.length > 4 && t.length > 4 && (x.startsWith(t.slice(0, 5)) || t.startsWith(x.slice(0, 5)))) || oneOff(t, x))).length / w.length >= 0.75;
}
async function groundNames(names, label, farSet) {
  if (!freeAI || !names.length) return null;
  const lookOne = async list => { try { const r = await fetch(freeAI.url + "/ground", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ city: label, names: list, far: list.filter(n => farSet && farSet.has(n)) }) }); if (r.ok) { const j = await r.json(); if (Array.isArray(j.results)) { if (j.center && isFinite(j.center.lat) && isFinite(j.center.lng)) cityMid = j.center; return j.results; } } } catch (e) {} return null; };
  // In batches of 8 names: one long request can pass the 100-second limit of the network in front of the helper
  // (it then answers 502 and the whole check fails). A batch that fails is tried once more; names still
  // unanswered count as unanswered rather than failing the whole check.
  const look = async list => {
    const out = []; let any = false;
    for (let i = 0; i < list.length; i += 8) {
      const part = list.slice(i, i + 8);
      let r = await lookOne(part); if (!r) { await new Promise(ok => setTimeout(ok, 2500)); r = await lookOne(part); }
      if (r) any = true; part.forEach((n, k) => out.push(r ? r[k] : null));
    }
    return any ? out : null;
  };
  let cityMid = null;
  let res = await look(names);
  if (!res) { await new Promise(ok => setTimeout(ok, 2500)); res = await look(names); }
  if (!res) return null;
  // A busy map or encyclopedia server can miss a few names: ask again for just those (answers are cached).
  for (let round = 0; round < 2; round++) {
    const miss = names.map((n, i) => (res[i] && res[i].answered ? -1 : i)).filter(i => i >= 0);
    if (!miss.length) break;
    await new Promise(ok => setTimeout(ok, 2000 + round * 2000));
    const again = await look(miss.map(i => names[i]));
    if (again) miss.forEach((i, k) => { if (again[k] && again[k].answered) res[i] = again[k]; });
  }
  const answered = res.filter(x => x && x.answered).length;
  if (answered < names.length * 0.8) return null; // the lookup was patchy: don't judge places on it
  // The city's middle: the median of the best matches.
  const firsts = res.map((x, i) => x && ((x.map || []).find(m => nameMatch(names[i], m.name)) || (x.wiki || []).find(w => w.lat && nameMatch(names[i], w.title)))).filter(Boolean);
  const la = firsts.map(p => p.lat).sort((a, b) => a - b), ln = firsts.map(p => p.lng).sort((a, b) => a - b);
  const median = la.length ? { lat: la[la.length >> 1], lng: ln[ln.length >> 1] } : null;
  // Measure "in this city" from the city's real centre when the map gave one.
  const center = cityMid || median;
  const out = new Map();
  names.forEach((n, i) => {
    const x = res[i] || {}, lim = farSet && farSet.has(n) ? 250 : 40, inArea = p => p && isFinite(p.lat) && (!center || hav(p, center) <= lim);
    const wiki = (x.wiki || []).find(w => nameMatch(n, w.title) && (w.lat == null || inArea(w)));
    const map = (x.map || []).find(m => nameMatch(n, m.name) && inArea(m));
    let pos = map || (wiki && wiki.lat != null ? wiki : null);
    // A local-language name ("Iglesia de San Jerónimo el Real") often comes back from both sources under its
    // English name ("Church of Saint Jerome the Royal"). When the encyclopedia's top answer and a map entry
    // agree on that name and sit within 1 km of each other inside the city, both sources found the same real place.
    let agreed = null;
    if (!(wiki || map)) {
      const w0 = (x.wiki || [])[0], m0 = w0 && w0.lat != null && (x.map || []).find(m => inArea(m) && nameMatch(w0.title, m.name) && hav(m, w0) <= 1);
      if (m0) { agreed = { wiki: w0, map: m0 }; pos = m0; }
    }
    if (agreed) { out.set(n, { osm: agreed.map.osm ? String(agreed.map.osm).replace(/^node/i, "N").replace(/^way/i, "W").replace(/^relation/i, "R").replace(/^([nwr])/, c => c.toUpperCase()) : "", real: true, facts: agreed.wiki.extract.replace(/\s+/g, " ").trim(), title: agreed.wiki.title, lat: +(+pos.lat).toFixed(5), lng: +(+pos.lng).toFixed(5) }); return; }
    if (!(wiki || map)) out.miss = (out.miss || []).concat(n + " [wiki: " + ((x.wiki || [])[0] || {}).title + " | map: " + ((x.map || [])[0] || {}).name + "]");
    out.set(n, { osm: map && map.osm ? String(map.osm).replace(/^node/i, "N").replace(/^way/i, "W").replace(/^relation/i, "R").replace(/^([nwr])/, c => c.toUpperCase()) : "", real: !!(wiki || map), facts: wiki ? wiki.extract.replace(/\s+/g, " ").trim() : "", title: wiki ? wiki.title : "", lat: pos ? +(+pos.lat).toFixed(5) : null, lng: pos ? +(+pos.lng).toFixed(5) : null });
  });
  if (out.miss) console.info("Kairoute left out places it couldn't confirm in " + label + ": " + out.miss.join("; "));
  return out;
}
// Wikivoyage, the travel guide written by travelers: listings with tips, hours and prices.
const voyageCache = {};
async function voyageFor(label) {
  if (!freeAI || !label) return null;
  if (voyageCache[label]) return voyageCache[label];
  try { const r = await fetch(freeAI.url + "/voyage?city=" + encodeURIComponent(label)); if (r.ok) { const j = await r.json(); if (j && Array.isArray(j.listings)) return (voyageCache[label] = j); } } catch (e) {}
  return null;
}
const voyageListing = (vg, name, types) => vg && vg.listings.find(l => (!types || types.includes(l.type)) && (nameMatch(name, l.name) || nameMatch(l.name, name)));
// Opening hours, fees, wheelchair access and websites from OpenStreetMap, by map id.
async function osmDetails(ids) {
  ids = [...new Set(ids.filter(Boolean))].slice(0, 50); if (!freeAI || !ids.length) return {};
  try { const r = await fetch(freeAI.url + "/osm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids }) }); if (r.ok) return (await r.json()).places || {}; } catch (e) {}
  return {};
}
function addRealDetails(x, g, vg, osm) {
  const l = voyageListing(vg, x.name, ["see", "do", "listing", "buy"]), o = g && g.osm ? osm[g.osm] : null;
  if (l && l.content) x.travelerTip = l.content;
  if (o && o.hours) x.hours = o.hours.replace(/;\s*/g, "; "); else if (l && l.hours) x.hours = l.hours;
  if (l && l.price) x.priceNote = l.price;
  if (o && o.wheelchair) x.access = o.wheelchair === "yes" ? "Wheelchair accessible (map data)." : o.wheelchair === "limited" ? "Limited wheelchair access (map data)." : o.wheelchair === "no" ? "Not wheelchair accessible (map data)." : x.access;
  const web = (o && o.web) || (l && l.url); if (web && /^https?:\/\//.test(web)) x.web = web;
  x.sources = (g && g.voyage ? [] : ["map"]).concat(g && g.facts ? ["Wikipedia"] : [], l ? ["Wikivoyage"] : [], o && (o.hours || o.wheelchair) ? ["OpenStreetMap"] : []);
}
// The free AI writes more slowly, so a city guide is built in two steps: first a short list of which
// places to cover, then small pieces written at the same time, each for a fixed set of named places.
// That keeps every piece short (no duplicates, no runaway lists), and any piece that comes back short
// or broken is asked for again, up to 3 tries.
async function cityInParts(prompt, show, label) {
  const okLL = x => x && x.name && isFinite(numV(x.lat)) && isFinite(numV(x.lng));
  const lang = P().lang || "English";
  const tail = ` Ignore any other counts above and keep each item as concise as the format allows. Write every summary, guide, lookFor, photoTip, pick, tip and note in ${lang}, even though the place is abroad; only place names and the local phrases stay in the local language.`;
  // Pieces that write named places get the guide's style rules but not the "how many places" rules,
  // so the AI writes only the places it is given.
  const detailPrompt = prompt.replace(/Return ONLY a JSON object[\s\S]*?Rules:\n/, "Each place is a JSON object {\"id\",\"name\",\"lat\",\"lng\",\"minutes\",\"kind\",\"mustSee\",\"category\",\"summary\",\"guide\",\"lookFor\",\"photoTip\",\"picks\"}. Day trips also have \"travel\" (how to get there and the one-way time) and their \"minutes\" is time on site.\nRules:\n").split("\n")
    .filter(l => !/^- "(sites|farther|restaurants|gettingAround|starts)":/.test(l) && !/^- Add "basics"/.test(l)).join("\n");
  const ask = async (extra, tier, ok, onText, detail) => {
    let last = null;
    for (let tries = 0; tries < 3; tries++) {
      let r;
      try { r = await sample((detail ? detailPrompt : prompt) + "\n\n" + extra + tail, { modelTier: tier, onText }); }
      catch (e) { if (/allowance|used up/i.test(e.message || "")) throw e; last = e; continue; }
      let j = null; try { j = parseJSON(r.text || ""); } catch (e) { last = e; }
      if (ok(j) && guideInLang(j, lang)) return j;
      if (ok(j)) last = new Error("The guide came back in the wrong language. Try again.");
      else try { console.info("Guide piece retry (" + extra.slice(0, 50) + "…): " + (j ? "keys " + Object.keys(j).join(",") + " " + JSON.stringify(j).slice(0, 300) : "unreadable " + String(r.text || "").length + " chars: " + String(r.text || "").slice(-200))); } catch (x) {}
    }
    throw last || new Error("The guide came back incomplete. Try again.");
  };
  show(2, "Choosing the best places", 9);
  // Wikivoyage, written by travelers, lists the real sights: offer them to the planner by name.
  const vg = label ? await voyageFor(label) : null;
  const seeList = vg ? [...new Set(vg.listings.filter(l => l.type === "see" && l.name && l.name.length < 60).map(l => l.name))].slice(0, 45) : [];
  const hint = seeList.length ? ` Travelers on Wikivoyage list these real places in ${label}. Prefer them where they fit, and use these exact names for them: ${seeList.join("; ")}.` : "";
  // Ask for more than the guide needs: any name the check can't confirm is dropped, and the rest still fill the guide.
  const plan = await ask('For this first step return ONLY {"main":[{"name","mustSee","kind"}],"quick":["name"],"farther":["name"]}: exactly 18 main sights in order of importance (3-5 mustSee true, about a third "kind":"local"), 7 small quick sights people walk past, and 5 day trips or sights farther out. Real, distinct places, each under its usual name as it appears on maps; if visitors know it by another name, add that in parentheses, for example "Mirador de la Flor (Selena Memorial)". Places only, not activities, walks, hikes or tours, and one entry per place (never separate entries for parts of the same place). Always include the city\'s best-known landmarks, monuments, memorials and statues (as main or quick sights), even if they are not in any list below. Names and those fields only.' + hint, "quick",
    j => j && (j.main || []).filter(x => x && x.name).length >= 8);
  let main = plan.main.filter(x => x && x.name).slice(0, 20), quick = (plan.quick || []).map(String).filter(Boolean).slice(0, 8), far = (plan.farther || []).map(String).filter(Boolean).slice(0, 5);
  // Keep only places that really exist, and give the writer each place's real facts to work from.
  show(9, "Checking each place is real", 17);
  const farSet = new Set(far), grounded = label && typeof groundNames === "function" ? await groundNames([...main.map(x => x.name), ...quick, ...far], label, farSet) : null;
  // Safeguard: never write a guide whose places couldn't be checked (and don't spend the AI allowance on it).
  if (label && !grounded) throw new Error("check unavailable");
  if (grounded) {
    // A place the map knows under a local-language name can still be confirmed by its Wikivoyage listing,
    // which travelers wrote with the exact location.
    const ok = [...grounded.values()].filter(g => g.real && g.lat != null), la = ok.map(g => g.lat).sort((a, b) => a - b), ln = ok.map(g => g.lng).sort((a, b) => a - b);
    const mid = ok.length ? { lat: la[ok.length >> 1], lng: ln[ok.length >> 1] } : null;
    for (const [n, g] of grounded) {
      if (g.real || !mid) continue;
      const l = voyageListing(vg, n, ["see", "do", "listing", "buy"]);
      if (l && isFinite(l.lat) && isFinite(l.lng) && hav(l, mid) <= (farSet.has(n) ? 250 : 40)) grounded.set(n, Object.assign({}, g, { real: true, lat: +l.lat.toFixed(5), lng: +l.lng.toFixed(5), voyage: true }));
    }
    const real = n => grounded.get(n).real;
    const keepMain = main.filter(x => real(x.name)), must = keepMain.filter(x => x.mustSee);
    main = must.concat(keepMain.filter(x => !x.mustSee)).slice(0, Math.max(14, must.length));
    quick = quick.filter(real).slice(0, 5); far = far.filter(real).slice(0, 4);
  }
  const tipFor = n => { const l = voyageListing(vg, n, ["see", "do", "listing", "buy"]); return l && (l.content || l.hours || l.price) ? ` Traveler notes (Wikivoyage): ${l.content}${l.hours ? " Hours: " + l.hours + "." : ""}${l.price ? " Price: " + l.price + "." : ""}` : ""; };
  const facts = names => grounded ? names.map(n => grounded.get(n)).some(g => g && g.facts) ? "\n\nFacts to build on, from each place's Wikipedia article. Use them, never contradict them, and do not invent names, dates or numbers beyond them and well-established history:\n" + names.map(n => { const g = grounded.get(n); return g && g.facts ? `- ${n}: ${g.facts.slice(0, 1200)}${tipFor(n)}` : `- ${n}: (no article; describe only what is certain and keep it short)${tipFor(n)}`; }).join("\n") + "\nUse the traveler notes for practical tips (when to go, what to look for, what to skip), in your own words." : "" : "";
  const groups = [[], [], [], []]; main.forEach((x, i) => groups[i % 4].push(x));
  const list = xs => xs.map(n => '"' + n + '"').join(", ");
  const parts = [
    { ask: 'For this request return ONLY {"city","country","starts","gettingAround","basics"}, with 8 phrases. Leave out "sites", "farther" and "restaurants" (places to eat come from the map).' + (vg && (vg.getAround || vg.staySafe) ? "\n\nTraveler notes from Wikivoyage to base gettingAround and safety on:\nGet around: " + vg.getAround.slice(0, 1200) + "\nStay safe: " + vg.staySafe.slice(0, 800) : ""), size: 4000,
      ok: j => j && j.city && j.starts && (j.starts.hotel || []).filter(okLL).length >= 1 && j.basics && (j.gettingAround || []).length >= 2 },
    ...groups.filter(g => g.length).map(g => ({ names: g.map(x => x.name), ask: `For this request return ONLY {"sites":[...]} with full details for exactly these ${g.length} main sights and no others, using these exact names: ${list(g.map(x => x.name))}.${facts(g.map(x => x.name))}`, size: 3000 * g.length,
      ok: j => j && (j.sites || []).filter(x => okLL(x) && x.guide).length >= g.length - 1 })),
    ...(quick.length ? [{ optional: true, names: quick, ask: `For this request return ONLY {"sites":[...]} with exactly these ${quick.length} quick sights ("quick": true, minutes 10) and no others, using these exact names: ${list(quick)}.${facts(quick)}`, size: 1000 * quick.length,
      ok: j => j && (j.sites || []).filter(okLL).length >= Math.max(1, quick.length - 2) }] : []),
    ...(far.length ? [{ optional: true, names: far, ask: `For this request return ONLY {"farther":[...]} with exactly these ${far.length} day trips and no others, using these exact names: ${list(far)}.${facts(far)}`, size: 3000 * far.length,
      ok: j => j && (j.farther || []).filter(okLL).length >= Math.max(1, far.length - 1) }] : [])
  ];
  const got = parts.map(() => 0), tell = () => show(17 + got.reduce((a, b) => a + b, 0) / parts.length * 72, "Writing the stories", 89);
  tell();
  const res = await Promise.all(parts.map((p, i) => ask(p.ask, "part", p.ok, ({ text }) => { got[i] = Math.min(0.97, text.length / p.size); tell(); }, i > 0).then(j => { got[i] = 1; tell(); return j; },
    // Quick sights and day trips add to a guide but aren't needed for it: if they won't come back, the guide goes ahead without them.
    e => { if (!p.optional || /allowance|used up/i.test((e && e.message) || "")) throw e; got[i] = 1; tell(); console.info("Guide built without its " + (p.ask.includes('"farther"') ? "day trips" : "quick sights") + " for " + label); return {}; })));
  const quickSet = new Set(quick.map(keyOf));
  const info = res[0], byName = new Map(main.map(x => [keyOf(x.name), x]));
  const seen = new Set(), sites = [], farther = [];
  const near = (a, b) => a === b || (a.length > 4 && b.length > 4 && (a.includes(b) || b.includes(a)));
  const only = (xs, names) => { // the places that were asked for, in case the AI added extras
    const ks = names.map(keyOf), good = (xs || []).filter(x => x && ks.some(k => near(keyOf(x.name), k)));
    return good.length >= names.length - 1 ? good.slice(0, names.length) : (xs || []).slice(0, names.length);
  };
  res.slice(1).forEach((j, n) => { const nm = parts[n + 1].names; if (j.sites) j.sites = only(j.sites, nm); if (j.farther) j.farther = only(j.farther, nm); });
  for (const j of res.slice(1)) {
    for (const x of j.sites || []) {
      const k = keyOf(String((x && x.name) || "").replace(/&/g, " and ")); if (!k || seen.has(k)) continue; seen.add(k); x.id = k.replace(/ /g, "-");
      const pl = byName.get(k); if (pl) { x.mustSee = !!pl.mustSee; x.kind = pl.kind === "local" ? "local" : "touristy"; x.quick = false; }
      if (quickSet.has(k)) x.quick = true;
      const gx = grounded && [...grounded.keys()].find(n => grounded.get(n).real && (keyOf(n) === k || nameMatch(n, x.name))); if (gx) { const g = grounded.get(gx); if (g.lat != null) { x.lat = g.lat; x.lng = g.lng; } x.onMap = true; }
      sites.push(x);
    }
    for (const x of j.farther || []) { const k = keyOf(String((x && x.name) || "").replace(/&/g, " and ")); if (!k || seen.has(k)) continue; seen.add(k); x.id = k.replace(/ /g, "-"); farther.push(x); }
  }
  const order = k => { const i = main.findIndex(x => keyOf(x.name) === k); return i < 0 ? 99 : i; };
  sites.sort((x, y) => (x.quick ? 1 : 0) - (y.quick ? 1 : 0) || order(x.id.replace(/-/g, " ")) - order(y.id.replace(/-/g, " ")));
  farther.forEach(x => { const gx = grounded && [...grounded.keys()].find(n => grounded.get(n).real && nameMatch(n, x.name)); if (gx) { const g = grounded.get(gx); if (g.lat != null) { x.lat = g.lat; x.lng = g.lng; } x.onMap = true; } });
  if (grounded) {
    const all = sites.concat(farther), gOf = x => { const gx = [...grounded.keys()].find(n => keyOf(n) === keyOf(x.name) || nameMatch(n, x.name)); return gx ? grounded.get(gx) : null; };
    const osm = await osmDetails(all.map(x => (gOf(x) || {}).osm));
    all.forEach(x => addRealDetails(x, gOf(x), vg, osm));
  }
  // Anything the writer returned that wasn't one of the confirmed places is left out.
  const keep = xs => { if (!grounded) return xs; const lost = xs.filter(x => x.onMap !== true); if (lost.length) console.info("Kairoute left out written places that didn't match a checked place: " + lost.map(x => x.name).join("; ")); return xs.filter(x => x.onMap === true); };
  return Object.assign({}, info, { sites: keep(sites), farther: keep(farther), grounded: !!grounded });
}
// Real-world check for an AI-written city, against OpenStreetMap (the open world map):
// every sight is looked up by name; found ones get the map's exact location, ones the map can't find
// are left out. Restaurants always come from the map itself (real places near the stops), never from
// the AI. The checked guide is what gets saved and shared.
const EATS_V = 4;
// The guide's local knowledge, applied only to real places: it sorts the restaurants found on the map and
// Wikivoyage by reputation, and says what each serves and why go. It can't add a place: any name it
// returns that isn't on the list is ignored.
async function rankEats(raw, label) {
  const list = (raw.restaurants || []).filter(r => r.onMap);
  if (!sample || list.length < 3) return;
  const lines = list.map((r, i) => `${i + 1}. ${r.name}${r.cuisine && r.cuisine !== "Restaurant" ? " (" + r.cuisine + ")" : ""}${r.recommended ? " [recommended on Wikivoyage]" : ""}`).join("\n");
  const prompt = `You are a well-travelled local food guide for ${label}. Below are real places to eat near the sights, numbered. Using what you know about each place's reputation, return ONLY JSON {"eats":[{"n":number,"cuisine":"Seafood, Tex-Mex, Thai, Café, BBQ...","style":"local favorite" | "classic" | "casual" | "upscale" | "quick bite","price":"$" | "$$" | "$$$","top":true|false}]} for every place you can describe. "top": true only for about the 10 places locals and visitors rate best, and only when you actually know the place. If you don't know a place, give only its likely cuisine from the name and top false. Never add places that aren't on the list.\n\n${lines}`;
  try {
    const r = await sample(prompt, { modelTier: "part" }); const j = parseJSON(r.text || "");
    (j && Array.isArray(j.eats) ? j.eats : []).forEach(e => { const x = list[(+e.n || 0) - 1]; if (!x) return;
      if (e.cuisine && (!x.cuisine || x.cuisine === "Restaurant")) x.cuisine = String(e.cuisine).slice(0, 40);
      if (e.style) x.style = String(e.style).slice(0, 20); if (e.price && !x.price) x.price = String(e.price).slice(0, 4);
      x.top = !!e.top; // Only the ranking and cuisine come from AI. Its descriptions could state things that aren't true (a view that isn't there), so the shown text stays factual: map data or traveler notes.
      x.kind = /local|casual|quick/.test(x.style || "") ? "local" : x.kind; });
    list.sort((a, b) => (b.top ? 2 : 0) + (b.recommended ? 1 : 0) - ((a.top ? 2 : 0) + (a.recommended ? 1 : 0)));
    raw.restaurants = list.concat((raw.restaurants || []).filter(r => !r.onMap));
  } catch (e) { /* ranking is a bonus: the real list stands without it */ }
}
async function realPlaces(raw, label) {
  if (!freeAI || !raw) return raw;
  const realEats = (raw.restaurants || []).length && raw.restaurants.every(r => r.onMap);
  // eatsV: bump when the way places to eat are chosen improves; older guides get new restaurants (no AI needed).
  if (raw.verified >= 2 && raw.grounded && realEats && raw.startsOk && raw.eatsV === EATS_V) return raw;
  const okLL = x => x && x.name && isFinite(numV(x.lat)) && isFinite(numV(x.lng));
  const pos = x => ({ lat: numV(x.lat), lng: numV(x.lng) });
  const post = (path, body) => fetch(freeAI.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(r => r.ok ? r.json() : null).catch(() => null);
  const sites = (raw.sites || []).filter(okLL), far = (raw.farther || []).filter(okLL);
  const lats = sites.map(x => numV(x.lat)).sort((a, b) => a - b), lngs = sites.map(x => numV(x.lng)).sort((a, b) => a - b);
  const center = { lat: lats[lats.length >> 1], lng: lngs[lngs.length >> 1] };
  if (!raw.grounded) {
    const items = sites.concat(far), g = await groundNames(items.map(x => x.name), label, new Set(far.map(x => x.name)));
    if (!g) return raw; // lookup unavailable right now: try again next time rather than guess
    items.forEach(x => { const r = g.get(x.name); x.onMap = !!(r && r.real); if (r && r.lat != null) { x.lat = r.lat; x.lng = r.lng; } });
    raw.sites = (raw.sites || []).filter(x => x.onMap !== false); raw.farther = (raw.farther || []).filter(x => x.onMap !== false);
    raw.grounded = true;
  }
  // Start points (hotels, ports, airports, stations) get checked too: a hotel area named after a sight
  // goes to that sight; others are looked up by name; anything still far off moves to the city centre.
  { const ss = (raw.sites || []).filter(okLL), la2 = ss.map(x => numV(x.lat)).sort((a, b) => a - b), ln2 = ss.map(x => numV(x.lng)).sort((a, b) => a - b);
    const mid = ss.length ? { lat: la2[la2.length >> 1], lng: ln2[ln2.length >> 1] } : null;
    if (mid && raw.starts) {
      const all = []; for (const k of Object.keys(raw.starts)) (raw.starts[k] || []).filter(okLL).forEach(p => all.push([k, p]));
      const lookup = all.filter(([k, p]) => !ss.some(x => nameMatch(x.name, p.name) || keyOf(p.name).includes(keyOf(x.name))));
      const g = lookup.length ? await groundNames(lookup.map(([, p]) => p.name), label, new Set(lookup.filter(([k]) => k === "airport" || k === "cruise").map(([, p]) => p.name))) : null;
      for (const [k, p] of all) {
        const site = ss.find(x => nameMatch(x.name, p.name) || keyOf(p.name).includes(keyOf(x.name)));
        const r = g && g.get(p.name), lim = k === "airport" || k === "cruise" ? 60 : 15;
        if (site) { p.lat = numV(site.lat); p.lng = numV(site.lng); }
        else if (r && r.real && r.lat != null && hav(r, mid) <= lim) { p.lat = r.lat; p.lng = r.lng; }
        else if (hav(pos(p), mid) > lim) { p.lat = mid.lat; p.lng = mid.lng; p.note = ((p.note || "") + " Location approximate: city centre.").trim(); }
      }
    } }
  raw.startsOk = true;
  const main = (raw.sites || []).filter(x => okLL(x) && !x.quick), must = main.filter(x => x.mustSee);
  const pts = main.slice(0, 14).map(pos);
  const pl = pts.length ? await post("/places", { pts, r: 700 }) : null;
  if (pl && Array.isArray(pl.places)) {
    const seen = new Set(), score = p => (p.cuisine ? 2 : 0) + (p.hours ? 1 : 0) + (p.web ? 1 : 0) + Math.min(6, p.tags) / 3 + (p.amenity === "restaurant" ? 1 : 0);
    const good = pl.places.filter(p => p.amenity !== "bar" && !(p.amenity === "fast_food" && !p.cuisine) && !seen.has(keyOf(p.name)) && seen.add(keyOf(p.name))).sort((a, b) => score(b) - score(a));
    const pick = []; // the best few near each stop, so every part of the city has somewhere to eat
    for (const sct of main) good.filter(p => hav(p, pos(sct)) <= 0.5 && !pick.includes(p) && !pick.some(q => hav(q, p) < 0.03)).slice(0, 5).forEach(p => pick.push(p));
    const vg = await voyageFor(label);
    // Places travelers recommend on Wikivoyage come first. When the map knows the same place, use the map's
    // location and details and add the travelers' notes; otherwise use the listing's own location.
    const nearStops = p => main.some(sct => hav(pos(sct), p) <= 0.6);
    let recs = 0;
    for (const l of (vg ? vg.listings : []).filter(l => l.type === "eat" || l.type === "drink")) {
      if (recs >= 25) break;
      const mp = good.find(p => nearStops(p) && (nameMatch(l.name, p.name) || nameMatch(p.name, l.name)));
      const note = l.content || "Recommended by travelers on Wikivoyage.";
      if (mp) { Object.assign(mp, { voyage: note, price: l.price || mp.price, web: mp.web || l.url, hours: mp.hours || l.hours }); const i = pick.indexOf(mp); if (i >= 0) pick.splice(i, 1); pick.unshift(mp); recs++; }
      else if (isFinite(l.lat) && isFinite(l.lng) && nearStops(l) && !pick.some(p => nameMatch(p.name, l.name))) { pick.unshift({ name: l.name, lat: l.lat, lng: l.lng, amenity: l.type === "drink" ? "pub" : "restaurant", cuisine: "", hours: l.hours, web: l.url, voyage: note, price: l.price }); recs++; }
    }
    const nice = t => String(t || "").split(/[;,]/)[0].replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
    raw.restaurants = pick.slice(0, 60).map(p => {
      const by = main.slice().sort((a, b) => hav(pos(a), p) - hav(pos(b), p))[0];
      return { name: p.name, lat: +(+p.lat).toFixed(5), lng: +(+p.lng).toFixed(5), kind: must.some(m => hav(pos(m), p) <= 0.2) ? "touristy" : "local", cuisine: nice(p.cuisine) || (p.amenity === "cafe" ? "Café" : p.amenity === "pub" ? "Pub" : "Restaurant"), price: p.price ? String(p.price).slice(0, 60) : "",
        why: p.voyage ? p.voyage.slice(0, 260) + " (Wikivoyage)" : `A real ${p.amenity === "cafe" ? "café" : p.amenity === "pub" ? "pub" : "place to eat"} a short walk from ${by ? by.name : "your stops"}${p.hours ? ". Hours listed: " + p.hours : ""}. Check it's open before you go.`, onMap: true, recommended: !!p.voyage };
    });
    await rankEats(raw, label);
    raw.verified = 2; raw.eatsV = EATS_V;
  } else raw.restaurants = (raw.restaurants || []).filter(r => r.onMap); // no map answer now: eat near a stop, and look again next time
  return raw;
}
// Cities written before the map check get checked once, in the background.
async function checkSavedCities() {
  for (const k of Object.keys(cities)) {
    const c = cities[k]; if (!c || !c.ai) continue;
    if (c.grounded && c.gv === GUIDE_V && (c.sites || []).some(x => x.sources && x.sources.length)) { if (!(c.restaurants || []).length || !c.startsOk || c.eatsV !== EATS_V) { try { await realPlaces(c, c.city); if ((c.restaurants || []).length) { save(); if (typeof render === "function" && view !== "tour") render(); } } catch (e) {} } continue; }
    // Written before places and facts were checked: set it aside so it's rebuilt (one tap) with real places and facts.
    delete cities[k]; trip.days.forEach(x => { if (x.cityKey === k) { x.cityKey = null; x.selected = null; } });
    save(); if (typeof render === "function" && view !== "tour") render();
  }
}
// Finished guides are kept on Kairoute's AI helper, so each city is written only once and opens in seconds after that.
// Bump when the way guides are checked improves: older AI guides are then rebuilt with the better check.
const GUIDE_V = "v9";
function guideCacheKey(d) {
  return [GUIDE_V, keyOf(d.destination), d.event ? keyOf(d.event) : "", d.type === "port" ? "port" : "", ((trip.prefs && trip.prefs.interests) || []).slice().sort().join(","), P().lang, P().access].join("|");
}
async function cachedGuide(d) {
  if (!freeAI) return null;
  // Maintenance: a city named in kairoute.rebuild is written fresh once (its new guide then replaces the saved one).
  try { const rb = JSON.parse(localStorage.getItem("kairoute.rebuild") || "[]"), k = keyOf(d.destination); if (rb.includes(k)) { localStorage.setItem("kairoute.rebuild", JSON.stringify(rb.filter(x => x !== k))); return null; } } catch (e) {}
  try { const r = await fetch(freeAI.url + "/guide?k=" + encodeURIComponent(guideCacheKey(d)), { cache: "no-store" }); if (!r.ok) return null; const j = await r.json(); return j && Array.isArray(j.sites) && j.sites.length ? j : null; } catch (e) { return null; }
}
function keepGuide(d, raw) {
  if (!freeAI) return;
  try { fetch(freeAI.url + "/guide", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ k: guideCacheKey(d), guide: raw }) }).catch(() => {}); } catch (e) {}
}
async function buildAllGuides() {
  if (!aiReady()) return;
  const todo = [];
  trip.days.forEach(d => { if (d.type !== "sea" && !cityFor(d) && d.destination && !todo.some(x => keyOf(x.destination) === keyOf(d.destination))) todo.push(d); });
  aiError = "";
  for (let i = 0; i < todo.length; i++) {
    busy = { prefix: `${i + 1} of ${todo.length}: `, text: `${i + 1} of ${todo.length}: starting ${todo[i].destination}…` }; render();
    const ok = await generateCity(todo[i], true);
    if (!ok) { aiError = "Stopped at " + todo[i].destination + ". Tap Build again to carry on."; break; }
  }
  busy = null; render();
}
async function geocodeLodging(d) {
  const k = cityKeyFor(d) || keyOf(d.destination);
  const L = trip.lodging[k];
  if (!aiReady() || !L || !L.name) return;
  busy = { text: "Finding " + L.name + "…" }; render();
  try {
    const { text } = await sample(`Give the coordinates of "${L.name}" in or near ${d.destination}. Reply ONLY with JSON {"name": string, "lat": number, "lng": number}.`, { modelTier: "quick" });
    const j = parseJSON(text);
    if (!isFinite(j.lat) || !isFinite(j.lng)) throw 0;
    L.ll = { lat: +j.lat, lng: +j.lng }; L.name = j.name || L.name;
    busy = null; save(); render();
  } catch (e) { busy = null; aiError = "Couldn't find that place. Try adding the street or neighborhood."; render(); }
}
async function buildTripFromText(text) {
  if (!aiReady() || !text.trim()) return;
  const imgs = wiz && wiz.images && wiz.images.length ? wiz.images.map(x => x.blob) : null;
  busy = { text: "Reading your trip…" }; aiError = ""; render();
  const prompt = `Turn this traveler's trip description into a day-by-day itinerary for a self-guided tour app.

Trip description:
"""${text}"""
${imgs ? "Photos of the traveler's itinerary, booking confirmations or tickets are attached. Read every date, city, port, arrival and departure time, flight, train and hotel from them; they take priority over the description, and their times are not estimated." : ""}
${wiz && wiz.hotels ? "Where they are staying: " + wiz.hotels : ""}
${wiz && (wiz.cruiseLine || wiz.ship) ? "Cruise: " + [wiz.cruiseLine, wiz.ship, wiz.sail ? "sailing " + wiz.sail : ""].filter(Boolean).join(", ") + ". If you know this ship's published itinerary for that sailing, use its ports and times; otherwise use the cruise line's typical itinerary for that route." : ""}

First write one line that starts with STOPS: and lists, in order, every city, port, island or event place the traveler mentions or that appears in the photos, separated by " > ", followed by the count, for example "STOPS: Athens > Mykonos > Santorini > Rome (3 ports)". Then write one line per day, nothing else, in exactly this format with | between fields:
DAY|date YYYY-MM-DD|destination|type|mode|time HH:MM|portArrive HH:MM|allAboard HH:MM|tender yes/no|lodging|estimated yes/no
type is one of arrival, land, embark, port, sea, departure. mode is flight, train, ship or car. Leave a field empty when it doesn't apply, but keep the | separators. No JSON, no commentary.
Rules:
- One entry per day per city. On a day you travel between two cities, make two entries with the same date: a "departure" in the first city and an "arrival" in the second, with the mode used (flight, train, or car for a drive or bus).
- First day in a city reached by plane, train, car or by getting off a cruise: "arrival" with mode and time = arrival time. Last day when leaving: "departure" with mode and time = departure time. Days in between: "land". A trip that is just one city or one event day is fine: use "land" days.
- The day a cruise leaves: "embark" in the departure city with allAboard. Each stop: "port" with portArrive and allAboard (30 minutes before sailing). Days with no stop: "sea". A cruise that ends in a city: the next day there is an "arrival" with mode ship and time when passengers get off (usually 07:00-08:00).
- Every place on your STOPS line must appear in the days, in order. When photos or a pasted itinerary are given, copy their ports, dates and times exactly and never add or invent a port. Only if the traveler names no ports but gives a number (for example "9 destinations") choose that many realistic ports and mark them estimated; the count may include the city where the cruise ends.
- A port the ship visits twice on different days (for example two stops in Crete) gets two "port" days.
- If the traveler doesn't name the ports, choose a realistic route and use real port names; mark them estimated.
- If dates are missing, start on the first Monday at least 60 days from ${new Date().toISOString().slice(0, 10)}. If times are missing, use typical ones (flights arrive 10:30, leave 15:00; ports 08:00 to 17:00).
- "lodging": the hotel name if given, else empty. "estimated": yes for anything you chose or are not sure of.
- Use the common English city name, and for gateway ports add the big city in brackets, e.g. "Civitavecchia (Rome)".`;
  try {
    const say = t => { if (busy) { busy.text = t; updateBusy(); } };
    const lineCount = t => (t.match(/^DAY\|/gm) || []).length;
    let r = await sample(prompt, { modelTier: "complex", ...(imgs ? { images: imgs } : {}), onText: ({ text }) => say("Laying out your days… " + lineCount(text) + " so far") });
    let out = r.text || "";
    // Long trips can run past one answer: keep asking for the rest until it's complete.
    for (let k = 0; k < 4 && r.truncated; k++) {
      const lines = out.split("\n").filter(l => /^DAY\|/.test(l)); const last = lines[lines.length - 1] || "";
      out = lines.slice(0, -1).join("\n") + "\n" + (out.match(/^STOPS:.*$/m) || [""])[0];
      r = await sample(prompt + `\n\nYou already wrote these days:\n${lines.slice(0, -1).join("\n")}\nContinue with the next day after them (redo this one if incomplete: ${last}). Write only DAY lines.`, { modelTier: "complex", ...(imgs ? { images: imgs } : {}), onText: ({ text }) => say("Laying out your days… " + (lines.length - 1 + lineCount(text)) + " so far") });
      out += "\n" + (r.text || "");
    }
    let days = parseDayLines(out);
    // Check every stop the traveler named made it in; if not, ask once for a corrected full list.
    const stopsLine = (out.match(/^STOPS:(.*)$/m) || [, ""])[1];
    const named = stopsLine.replace(/\([^)]*ports?[^)]*\)\s*$/i, "").split(">").map(x => x.trim()).filter(Boolean);
    const NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15 };
    const mm0 = String(text).toLowerCase().match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen)\s+(?:different\s+)?(?:ports?|destinations?|stops?|islands?|ports of call)\b/);
    // "9 destinations" often counts the city where the cruise ends, so only hold the AI to the count when nothing was attached.
    const want = mm0 && !imgs ? (NUMW[mm0[1]] || +mm0[1]) : 0;
    const missingNames = () => named.filter(n => { const k = keyOf(n.replace(/\(.*\)/, "")); return k && !days.some(dd => keyOf(dd.destination).includes(k) || k.includes(keyOf(dd.destination.replace(/\(.*\)/, "")))); });
    let miss = missingNames(), ports = days.filter(x => x.type === "port").length;
    const shortOf = () => want && ports + 1 < want;
    if (days.length && (miss.length || shortOf())) {
      say("Double-checking every stop…");
      const fix = await sample(prompt + `\n\nA first draft missed ${miss.length ? "these stops: " + miss.join(", ") : ""}${miss.length && want ? " and " : ""}${want && ports < want ? `ports (it had ${ports}, the traveler said ${want})` : ""}. Here is the draft:\n${out.split("\n").filter(l => /^DAY\|/.test(l)).join("\n")}\nWrite the complete corrected list: the STOPS line, then every DAY line for the whole trip.`, { modelTier: "complex", ...(imgs ? { images: imgs } : {}) });
      const fixed = parseDayLines(fix.text || "");
      if (fixed.length >= days.length && !fix.truncated) { days = fixed; miss = missingNames(); ports = days.filter(x => x.type === "port").length; }
    }
    if (!days.length) throw new Error("none");
    const lodging = {};
    days.forEach(dd => { if (dd._lodging && !lodging[keyOf(dd.destination)]) lodging[keyOf(dd.destination)] = { idx: "custom", name: dd._lodging, ll: null }; delete dd._lodging; });
    const prefs = wiz ? { pace: wiz.pace, walk: wiz.walk, interests: wiz.interests.slice(), travelers: wiz.travelers, access: wiz.access, party: wiz.party, lang: wiz.lang, voice: wiz.voice } : P();
    if (prefs.pace === "relaxed") days.forEach(x => { if (x.type === "land") x.hours = 6.5; });
    if (prefs.pace === "packed") days.forEach(x => { if (x.type === "land") x.hours = 10; });
    trip = { id: "t" + Date.now(), name: (wiz && wiz.name) || "", active: 0, sourceText: String(text).slice(0, 4000), portCheck: (want && ports + 1 < want) || miss.length ? { expected: want || ports, got: ports, missing: miss } : null, style: wiz ? wiz.style : (trip.style || "mix"), prefs, lodging, days, sample: false };
    if (!trip.name) trip.name = tripName(trip);
    wiz = null; busy = null; tripText = ""; save(); view = "trip"; render(); window.scrollTo(0, 0);
  } catch (e) { busy = null; aiError = aiErrorText(e, "Your itinerary"); render(); }
}
function normPicks(a) { return Array.isArray(a) ? a.filter(x => x && x.t).slice(0, 4).map(x => ({ k: PICK_KINDS[x.k] ? x.k : "spot", t: String(x.t) })) : []; }
const PICK_KINDS = { spot: ["Where to look", "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z|M12 12.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"], timing: ["Timing tip", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M12 7v5l3 2"], story: ["The story guides tell", "M4 5h11a3 3 0 0 1 3 3v12H7a3 3 0 0 1-3-3z|M18 8h2v12h-2"], taste: ["Local taste", "M7 3v8a3 3 0 0 0 6 0V3|M10 3v18|M17 3c-2 2-2 6 0 8v10"] };
const pickPromise = {};
async function getPicks(site, city) {
  if (!aiReady() || pickPromise[site.id]) return;
  pickPromise[site.id] = true; renderGuideOnly();
  try {
    const r = await sample(`You are a professional licensed tour guide in ${city.city}${city.country ? ", " + city.country : ""} with 20 years of experience. For ${site.name}, give the 3 insider extras you share with your private clients at this stop. Each has "k" ("spot" = where to stand or a hidden detail, "timing" = when to go or how to beat lines, "story" = the anecdote guides tell, "taste" = nearby local food or drink) and "t" (one or two specific sentences). Write "t" in ${P().lang}. Reply with JSON only: {"picks":[{"k":"","t":""}]}`, { modelTier: "default" });
    const txt = typeof r === "string" ? r : (r && (r.text || r.content)) || "";
    const j = JSON.parse(String(txt).replace(/^[^{]*/, "").replace(/[^}]*$/, ""));
    site.picks = normPicks(j.picks); save();
  } catch (e) { aiError = "The guide's picks didn't come back. Try again in a moment."; }
  pickPromise[site.id] = false; renderGuideOnly();
}
function picksBlock(s, compact) {
  const pk = s.picks || [];
  if (!pk.length) return s.quick ? "" : (aiReady() ? `<div class="picks"><div class="pickhead"><span class="badge">PRO</span><b>Pro guide's picks</b></div><button class="btn ghost small" data-act="picks" data-id="${esc(s.id)}" ${pickPromise[s.id] ? "disabled" : ""}>${pickPromise[s.id] ? "Asking the guide…" : "Get the pro guide's picks"}</button></div>` : "");
  const ic = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d.split("|").map(x => `<path d="${x}"/>`).join("")}</svg>`;
  return `<div class="picks"><div class="pickhead"><span class="badge">PRO</span><b>Pro guide's picks</b><span class="lede">What a private guide would show you here</span></div>
    <ul>${pk.map(x => `<li><span class="pic">${ic(PICK_KINDS[x.k][1])}</span><span><span class="pk">${PICK_KINDS[x.k][0]}</span>${esc(x.t)}</span></li>`).join("")}</ul></div>`;
}
async function goDeeper(site, city) {
  if (!aiReady()) return;
  const k = site.id; deeper[k] = { text: "", loading: true }; renderGuideOnly();
  try {
    await sample(`You are a warm, expert tour guide speaking to a traveler standing at ${site.name} in ${city.city}${city.country ? ", " + city.country : ""}. They already heard this introduction:\n"${site.guide}"\n\nContinue the tour with about 300 more words of spoken narration they haven't heard: deeper history, a surprising story or legend, how locals see the place, and one insider tip for visiting (best time, hidden corner, or etiquette).${faithNote()} Plain paragraphs, no headings or lists, no markdown.`, {
      modelTier: "default", onText: ({ text }) => { deeper[k].text = text; const el = document.getElementById("deep-" + k); if (el) el.innerHTML = paras(text); }
    });
    deeper[k].loading = false; renderGuideOnly();
  } catch (e) { deeper[k] = { text: deeper[k].text || "", loading: false, error: "The guide couldn't continue right now. Try again in a moment." }; renderGuideOnly(); }
}
// ---- Ask your guide ----
// Questions like you'd ask a real guide, about a stop or about the day. Answers are built only from what the
// app knows for sure (the stop's guide and facts, today's plan, real nearby places) plus well-established
// knowledge, in plain words with no filler. When there's no reliable answer, the guide says so kindly.
// Offline, the question is saved and answered automatically when the connection is back.
const ASK_STORE = "kairoute.asks", ASK_DAILY = 40;
let askState = (() => { try { return JSON.parse(localStorage.getItem(ASK_STORE) || "{}"); } catch (e) { return {}; } })();
askState.pending = askState.pending || []; askState.log = askState.log || {};
Object.assign(answers, askState.log);
let askNotice = "";
const askSave = () => { try { askState.log = {}; for (const k in answers) if (answers[k] && !answers[k].loading) askState.log[k] = answers[k]; localStorage.setItem(ASK_STORE, JSON.stringify(askState)); } catch (e) {} };
function askContext(site, city, d) {
  const lines = [`City: ${city.city}${city.country ? ", " + city.country : ""}. Date: ${d.date || "unknown"}. Local time now: ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.`];
  let plan = null; try { plan = buildPlan(d); } catch (e) {}
  if (plan && plan.items) lines.push("Today's plan: " + plan.items.filter(i => i.type !== "travel").map(i => fmt(i.time) + " " + (i.type === "meal" ? i.meal.label + " at " + i.place.name : i.place ? i.place.name : i.label)).join("; ") + ".");
  if (site) {
    lines.push(`The traveler is at: ${site.name} (${site.category || "sight"}). ${site.summary || ""}`);
    if (site.guide) lines.push("Guide text: " + site.guide);
    if (site.lookFor && site.lookFor.length) lines.push("Things to look for: " + site.lookFor.join(" "));
    ["hours", "closed", "tickets", "crowds", "access", "priceNote", "photoTip"].forEach(k => { if (site[k]) lines.push(k + ": " + site[k]); });
  }
  const here = site || (plan && plan.items && (plan.items.find(i => i.type === "stop") || {}).place);
  if (here && isFinite(here.lat)) {
    const eats = (city.restaurants || []).filter(r => !r.generic && hav(r, here) <= 1).sort((a, b) => hav(a, here) - hav(b, here)).slice(0, 10);
    if (eats.length) lines.push("Real places to eat nearby (only recommend from this list): " + eats.map(r => `${r.name} (${r.cuisine || "restaurant"}, ${distTxt(hav(r, here))} away${r.recommended ? ", recommended by travelers" : ""}${r.crowdTop ? ", Kairoute Top Pick" : ""})`).join("; ") + ".");
    const near = allSites(city).filter(x => x !== site && isFinite(x.lat) && hav(x, here) <= 1.5).slice(0, 10);
    if (near.length) lines.push("Other real sights nearby: " + near.map(x => `${x.name} (${distTxt(hav(x, here))})`).join("; ") + ".");
  }
  return lines.join("\n");
}
async function askGuide(site, city, q, opts) {
  q = String(q || "").trim(); if (!q || !city) return;
  const k = site ? site.id : "day:" + (day().date || trip.active), d = day(), voice = opts && opts.voice;
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (offline || !aiReady()) {
    if (!offline) { answers[k] = { q, text: "", error: "Turn on the AI guide in Settings to ask questions." }; renderGuideOnly(); return; }
    askState.pending.push({ k, siteId: site ? site.id : null, dayIdx: trip.active, q, at: Date.now() });
    answers[k] = { q, text: "", saved: true, note: "There's no internet connection right now, so I can't look that up. I've saved your question and I'll answer it as soon as you're back online." };
    askSave(); renderGuideOnly(); return;
  }
  const today = new Date().toISOString().slice(0, 10);
  if (askState.day !== today) { askState.day = today; askState.n = 0; }
  if (askState.n >= ASK_DAILY) { answers[k] = { q, text: "", error: "That's all the questions for today. Ask again tomorrow." }; renderGuideOnly(); return; }
  askState.n++;
  const prev = answers[k] && answers[k].text ? `Earlier, the traveler asked "${answers[k].q}" and you answered: "${answers[k].text}"\n\n` : "";
  answers[k] = { q, text: "", loading: true }; renderGuideOnly();
  const prompt = `You are a knowledgeable local guide answering a traveler's question.
Facts you can rely on:
${askContext(site, city, d)}

${prev}Question: "${q}"

How to answer:
- Start with the answer itself. Plain, friendly words, at most 90 words. No greeting, no "great question", no filler, no summary at the end.
- Use the facts above and well-established knowledge only. Never make up names, places, dates, prices, opening hours or numbers.
- Recommend only places named in the facts above. If none fit, say so.
- For hours, prices or tickets not given above, say you don't have current details and suggest the official site or the ticket desk.
- If you don't know or aren't sure, say kindly that you don't have a reliable answer, and if possible say where they could find out.${faithNote()}
- No markdown.`;
  try {
    await sample(prompt, { modelTier: "quick", cache: false, onText: ({ text }) => { answers[k].text = text; const el = document.getElementById("ans-" + k.replace(/[^\w-]/g, "_")); if (el) el.textContent = text; } });
    answers[k].loading = false; answers[k].at = Date.now(); askSave(); renderGuideOnly();
    if (voice && answers[k].text && !(site && quietOn(site))) speakText("ans:" + k, answers[k].text);
  } catch (e) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) { askState.n--; answers[k] = null; return askGuide(site, city, q, opts); }
    answers[k] = { q, text: "", loading: false, error: "No answer came back. Try asking again." }; renderGuideOnly();
  }
}
// Back online: answer every saved question, then let the traveler know quietly.
async function askPending() {
  if (!askState.pending.length || navigator.onLine === false || !aiReady()) return;
  const list = askState.pending.splice(0); askSave(); let done = 0;
  for (const p of list) {
    const d = trip.days[p.dayIdx] || day(), city = cityFor(d); if (!city) continue;
    const site = p.siteId ? allSites(city).find(x => x.id === p.siteId) : null;
    await askGuide(site, city, p.q); if (answers[p.k] && answers[p.k].text) done++;
  }
  if (done) { askNotice = done === 1 ? `You're back online. Your guide answered the question you saved: "${list[0].q}"` : `You're back online. Your guide answered the ${done} questions you saved.`; render(); }
}
if (typeof window !== "undefined") { window.addEventListener("online", () => setTimeout(askPending, 1500)); setTimeout(askPending, 4000); }
// Voice questions: tap the microphone, speak, and the answer is read aloud too.
const SpeechRec = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
function listenAsk(siteId) {
  if (!SpeechRec) return;
  const rec = new SpeechRec(); rec.lang = langCode ? (langCode(P().lang) || "en-US") : "en-US"; rec.interimResults = true; rec.maxAlternatives = 1;
  const inp = document.getElementById("ask-" + siteId), btn = document.querySelector(`[data-mic="${siteId}"]`);
  if (btn) { btn.classList.add("on"); btn.setAttribute("aria-label", "Listening"); }
  let said = "";
  rec.onresult = e => { said = Array.from(e.results).map(r => r[0].transcript).join(" "); if (inp) inp.value = said; };
  rec.onend = () => { if (btn) btn.classList.remove("on");
    if (said.trim()) { const city = cityFor(day()), site = siteId === "day" ? null : allSites(city).find(x => x.id === siteId); stopAudio(); askGuide(site, city, said, { voice: true }); } };
  rec.onerror = () => { if (btn) btn.classList.remove("on"); };
  try { stopAudio(); rec.start(); } catch (e) {}
}
function askBlock(site, placeholder) {
  const id = site ? site.id : "day", k = site ? site.id : "day:" + (day().date || trip.active), an = answers[k], domId = "ans-" + k.replace(/[^\w-]/g, "_");
  return `<div class="askbox"><span class="eyebrow">Ask your guide</span>
    <form class="ask" data-ask="${esc(id)}"><input type="text" id="ask-${esc(id)}" placeholder="${esc(placeholder || "Ask anything about this place")}" aria-label="Ask your guide" enterkeyhint="send">${SpeechRec && !(site && quietOn(site)) ? `<button class="btn ghost small mic" type="button" data-mic="${esc(id)}" aria-label="Ask by voice">🎤</button>` : ""}<button class="btn small" type="submit">Ask</button></form>
    ${an ? `<div class="answer"><b>${esc(an.q)}</b><span id="${domId}">${esc(an.text || an.note || (an.loading ? "Thinking…" : an.error || ""))}</span>${an.text && !an.loading ? `<button class="linkbtn" data-play-ans="${esc(k)}">${speakingId === "ans:" + k ? "■ Stop" : "▶ Listen"}</button>` : ""}</div>` : ""}</div>`;
}

// ---------- Audio guide ----------
function stopAudio() {
  if (tts) { try { tts.stop(); } catch (e) {} }
  if (window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending)) try { speechSynthesis.cancel(); } catch (e) {}
  if (nativeTTS) { nativeRun++; try { nativeTTS.stop(); } catch (e) {} }
  if (natAudio) { try { natAudio.onended = null; natAudio.onerror = null; natAudio.pause(); } catch (e) {} }
  speakingId = null; ttsState = "idle"; updateAudioUI();
}
function speakSite(site) {
  if (speakingId === site.id) { stopAudio(); return; }
  stopAudio();
  const tr = translations[site.id + "|" + P().lang];
  const parts = tr && tr.text && !tr.loading ? [`${site.name}.`, tr.text] : siteLines(site);
  if (deeper[site.id] && deeper[site.id].text && !deeper[site.id].loading) parts.push(deeper[site.id].text);
  const lines = toLines(parts);
  const city = cityFor(day()), lc = (tr && tr.text) || (city && city.lang && city.lang === P().lang && P().lang !== "English") ? langCode(P().lang) : null;
  speakLines(site.id, lines, lc);
}
function speakText(id, text) {
  if (speakingId === id) { stopAudio(); return; }
  stopAudio();
  const lines = String(text).split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
  const city = cityFor(day()), lc = city && city.lang && city.lang === P().lang && P().lang !== "English" ? langCode(P().lang) : null;
  speakLines(id, lines, lc);
}
// Natural voice: Kairoute's AI helper turns the story into a lifelike recording (made once per stop and
// kept, so replays are free). Falls back to the device voice if it's off, used up for the day, or offline.
const natAudio = typeof Audio !== "undefined" ? new Audio() : null;
const SILENT = (() => { // a tiny silent WAV, played on the tap itself so the browser lets the recording play later
  const n = 800, b = new Uint8Array(44 + n), v = new DataView(b.buffer), w = (o, t) => [...t].forEach((c, i) => b[o + i] = c.charCodeAt(0));
  w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, "data"); v.setUint32(40, n, true); b.fill(128, 44);
  let bin = ""; b.forEach(x => bin += String.fromCharCode(x)); return "data:audio/wav;base64," + btoa(bin);
})();
let natVoiceNote = "";
const natVoiceOn = lc => !!(freeAI && natAudio && !tts && !lc && (P().lang || "English") === "English" && appSet.natvoice !== "off");
// ---- The Kairoute voice: our own delivery and sound on top of the voice engines ----
// Delivery: rewrite the written guide the way a guide would say it (no abbreviations, natural pauses).
function shapeForSpeech(t) {
  return String(unitText(t) || "")
    .replace(/\bSt\.? (?=[A-Z])/g, "Saint ").replace(/\bSts\.? (?=[A-Z])/g, "Saints ")
    .replace(/\bc\. ?(?=\d)/g, "around ").replace(/\bca\. ?(?=\d)/g, "around ")
    .replace(/(\d) ?km\b/g, "$1 kilometers").replace(/(\d) ?mi\b/g, "$1 miles").replace(/(\d) ?ft\b/g, "$1 feet").replace(/(\d) ?m\b/g, "$1 meters").replace(/(\d) ?min\b/g, "$1 minutes")
    .replace(/(\d)(st|nd|rd|th)-century/g, "$1$2 century").replace(/\be\.g\.,?/g, "for example,").replace(/\bi\.e\.,?/g, "that is,")
    .replace(/\b(\d{1,2}):(\d{2})\b/g, (m, a, b) => +a > 23 ? m : String(+a % 12 || 12) + (b === "00" ? "" : " " + b) + (+a < 12 ? " AM" : " PM"))
    .replace(/\s*[—–]\s*/g, ", ").replace(/\s+-\s+/g, ", ").replace(/\s*;\s*/g, ". ")
    .replace(/\s*\(([^)]{1,80})\)/g, ", $1,").replace(/,\s*,/g, ",").replace(/,\s*\./g, ".")
    .replace(/\n\s*\n/g, "\n\n…\n\n");
}
// Sound: a gentle broadcast chain (warmth, clarity for noisy streets, even loudness, a touch of room).
let soundCtx = null, soundReady = false;
function kairouteSound() {
  if (!natAudio || appSet.voicefx === "off") return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    if (!soundCtx) {
      soundCtx = new AC(); const c = soundCtx, src = c.createMediaElementSource(natAudio);
      const warm = c.createBiquadFilter(); warm.type = "lowshelf"; warm.frequency.value = 180; warm.gain.value = 3;
      const mud = c.createBiquadFilter(); mud.type = "peaking"; mud.frequency.value = 420; mud.Q.value = 1.1; mud.gain.value = -2;
      const clear = c.createBiquadFilter(); clear.type = "peaking"; clear.frequency.value = 2600; clear.Q.value = 0.9; clear.gain.value = 2.5;
      const air = c.createBiquadFilter(); air.type = "highshelf"; air.frequency.value = 9000; air.gain.value = -1.5;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -22; comp.ratio.value = 3; comp.attack.value = 0.008; comp.release.value = 0.25; comp.knee.value = 12;
      const room = c.createConvolver(), len = Math.floor(c.sampleRate * 0.45), ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
      room.buffer = ir; const wet = c.createGain(); wet.gain.value = 0.07; const out = c.createGain(); out.gain.value = 1.15;
      src.connect(warm); warm.connect(mud); mud.connect(clear); clear.connect(air); air.connect(comp);
      comp.connect(out); comp.connect(room); room.connect(wet); wet.connect(out); out.connect(c.destination);
      soundReady = true;
    }
    if (soundCtx.state === "suspended") soundCtx.resume().catch(() => {});
  } catch (e) { soundReady = false; }
}
// The natural voice speaks a guide's script one breath at a time, with real pauses between, instead
// of reading the whole page in one go. The script and each line's audio are made once and kept.
function localParts(text) {
  const out = [];
  text.split(/\n\s*\n/).forEach((para, pi) => {
    const sent = para.replace(/…/g, "").match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [para];
    for (let i = 0; i < sent.length; i += 2) { const t = sent.slice(i, i + 2).join(" ").trim(); if (t) out.push((pi && !i ? "~" : "") + t); }
  });
  return out;
}
// Offline store: each stop's guide script and recorded lines are kept on the device after the first play
// (or after "Save for offline"), so they replay instantly with no signal and cost nothing.
const kv = (() => {
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => { try { const r = indexedDB.open("kairoute-audio", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }));
  const tx = (mode, fn) => db().then(d => new Promise((res, rej) => { const t = d.transaction("kv", mode), q = fn(t.objectStore("kv")); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }));
  return { get: k => tx("readonly", st => st.get(k)).catch(() => undefined), set: (k, v) => tx("readwrite", st => st.put(v, k)).catch(() => {}) };
})();
// The words for a stop, the same whether it is played now or saved ahead.
function siteLines(site) {
  const parts = [`${site.name}.`, site.guide];
  if (site.lookFor && site.lookFor.length) parts.push("While you're here, look for these. " + site.lookFor.map((x, i) => (i + 1) + ". " + x).join(" "));
  if (site.picks && site.picks.length) parts.push("And here are your guide's insider picks. " + site.picks.map(x => x.t).join(" "));
  return parts;
}
function toLines(parts) {
  const lines = [];
  parts.join("\n\n").split(/\n\s*\n/).forEach(p => { p = p.trim(); while (p.length > 1800) { const cut = p.lastIndexOf(". ", 1800) + 1 || 1800; lines.push(p.slice(0, cut)); p = p.slice(cut).trim(); } if (p) lines.push(p); });
  return lines;
}
// The whole stop becomes one guide script, in pieces of up to ~2,200 characters, so one voice reads it all.
async function scriptParts(lines) {
  const chunks = []; let cur = "";
  lines.map(shapeForSpeech).map(l => l.replace(/\n\n…\n\n/g, "\n\n")).forEach(l => { if (cur && (cur + "\n\n" + l).length > 2200) { chunks.push(cur); cur = l; } else cur += (cur ? "\n\n" : "") + l; });
  if (cur) chunks.push(cur);
  const each = await Promise.all(chunks.map(async text => {
    const saved = await kv.get("s:" + text); if (Array.isArray(saved) && saved.length) return saved;
    try { const r = await fetch(freeAI.url + "/script", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) }); if (r.ok) { const parts = (await r.json()).parts; if (Array.isArray(parts) && parts.length >= 2) { kv.set("s:" + text, parts); return parts; } } } catch (e) {}
    return localParts(text);
  }));
  return each.flatMap((ps, i) => i && ps.length && !/^~/.test(ps[0]) ? ["~" + ps[0], ...ps.slice(1)] : ps);
}
const RESTING = "The natural voice is resting until 6 pm Central, so your device voice is reading for now.";
async function lineAudio(t) {
  const v = guideVoice(), k = "a:" + v.model + ":" + v.speaker + ":" + t;
  const saved = await kv.get(k); if (saved instanceof Blob && saved.size > 500) return saved;
  const once = () => fetch(freeAI.url + "/speak", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.assign({ text: t }, v)) })
    .then(r => { if (r.status === 429) { natVoiceNote = RESTING; throw new Error("resting"); } return r.ok ? r.blob() : null; });
  let b = null; try { b = await once(); if (!b) b = await once(); } catch (e) { if (e.message === "resting") return null; }
  if (b && b.size > 500) kv.set(k, b);
  return b;
}
async function voicePlanOk(parts) {
  try {
    const pr = await fetch(freeAI.url + "/voiceplan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.assign({ texts: parts.map(t => t.replace(/^~\s*/, "")) }, guideVoice())) });
    if (pr.ok) return !!(await pr.json()).ok;
  } catch (e) {}
  return true; // offline or unsure: try anyway, saved lines still play
}
async function speakNatural(id, lines) {
  if (!lines.length) return false;
  // Must run on the tap itself, first thing, on the tap: phones only allow audio that starts from a tap.
  kairouteSound(); // set up on the tap itself, which browsers require for audio
  try { natAudio.src = SILENT; natAudio.play().catch(() => {}); } catch (e) {} // claim the tap so the recording can play when it arrives
  const parts = await scriptParts(lines);
  if (speakingId !== id) return true;
  // One voice for the whole stop: if the allowance can't cover every line, the device voice reads it all.
  if (!(await voicePlanOk(parts))) { natVoiceNote = RESTING; return false; }
  if (speakingId !== id) return true;
  const clean = t => t.replace(/^~\s*/, "");
  let next = lineAudio(clean(parts[0]));
  for (let i = 0; i < parts.length; i++) {
    const blob = await next;
    if (speakingId !== id) return true;
    if (!blob) { if (i === 0) return false; speakDevice(id, parts.slice(i).map(clean), null); return true; }
    if (i + 1 < parts.length) next = lineAudio(clean(parts[i + 1])); // fetch the next line while this one plays
    const url = URL.createObjectURL(blob);
    const done = new Promise(res => { natAudio.onended = () => res(true); natAudio.onerror = () => res(false); });
    natAudio.src = url; natAudio.preservesPitch = true; natAudio.defaultPlaybackRate = natAudio.playbackRate = GUIDE_PACE;
    try { await natAudio.play(); } catch (e) { URL.revokeObjectURL(url); if (i === 0) return false; speakDevice(id, parts.slice(i).map(clean), null); return true; }
    if (i === 0) { const g = GUIDES.find(x => x[0] === guideVoice().speaker); voiceNow = `${g[1]}, natural voice`; ttsState = "speaking"; natVoiceNote = ""; updateAudioUI(); }
    await done; URL.revokeObjectURL(url);
    if (speakingId !== id) return true;
    const gap = i + 1 < parts.length ? (/^~/.test(parts[i + 1]) ? 900 : /\?\s*$/.test(parts[i]) ? 700 : 380) : 0;
    if (gap) await new Promise(r => setTimeout(r, gap));
  }
  if (speakingId === id) { speakingId = null; ttsState = "idle"; updateAudioUI(); }
  return true;
}
// Save every stop of the given cities ahead of time (on the device, and recorded once on the server for everyone).
// Stops early if today's allowance runs low, keeping `reserve` for live use; run again later to finish.
async function saveStops(sites, onStep, reserve) {
  let done = 0, made = 0;
  for (const site of sites) {
    const lines = toLines(siteLines(site)).map(shapeForSpeech);
    const parts = await scriptParts(toLines(siteLines(site)));
    if (reserve) { try { const st = await (await fetch(freeAI.url + "/status")).json(); const need = parts.join(" ").length * 2.75; if ((st.voiceLeft || 0) - need < reserve) return { done, made, total: sites.length, stopped: true }; } catch (e) {} }
    for (const p of parts) { const b = await lineAudio(p.replace(/^~\s*/, "")); if (!b) return { done, made, total: sites.length, stopped: true }; }
    done++; made += lines.length; if (onStep) onStep(done, sites.length, site);
  }
  return { done, made, total: sites.length, stopped: false };
}
// Quality check for every day of a trip (used by the automated planner test).
if (typeof window !== "undefined") window.__kairouteQuality = () => { bonusMemo = new Map(); mealMemo = new Map(); eveMemo = new Map(); avoidMeals = new Set(); return trip.days.map((d, i) => {
  const pl = buildPlan(d); if (!pl || pl.error || !pl.items) return { i, date: d.date, dest: d.destination, skip: pl && pl.error ? pl.error : "no guide" };
  const its = pl.items, issues = [], pts = its.filter(x => x.place && x.type !== "travel" && x.type !== "evening");
  its.forEach(x => { if ((x.type === "meal" || x.type === "evening") && x.place.booked && x.time > x.meal.from + 10) issues.push("misses the " + x.meal.label.toLowerCase() + " reservation by " + dur(x.time - x.meal.from)); });
  its.forEach(x => { if (x.type === "evening" && !x.booked && x.leg && x.leg.km > 1.2) issues.push("suggested dinner " + distTxt(x.leg.km) + " from where the day ends"); });
  for (let k = 0; k < pts.length; k++) for (let j = k + 2; j < pts.length; j++) if (hav(pts[j - 1], pts[j]) > 20 && hav(pts[k], pts[j]) < 10 && !(pts[k].type === "start" && pts[j].type === "end") && k !== j - 1) { issues.push("backtrack to " + pts[j].name + " area"); break; }
  its.forEach((x, k) => { if (x.type !== "meal" || x.place.booked) return; const pv = its.slice(0, k).reverse().find(y => y.place && y.type !== "travel"), nx = its.slice(k + 1).find(y => y.place && y.type !== "travel"); if (pv && nx) { const extra = tmin(pv.place, x.place) + tmin(x.place, nx.place) - tmin(pv.place, nx.place); if (extra > 25) issues.push(x.meal.label + " detour " + Math.round(extra) + " min (" + x.place.name + ")"); } });
  const names = its.filter(x => (x.type === "meal" || x.type === "evening") && !x.place.generic && !x.place.booked).map(x => keyOf(x.place.name));
  const tc = travelCheck(pl); if (tc) issues.push("travel " + dur(tc.ride) + " vs sights " + dur(tc.see));
  // Route shape: legs that cross each other mean the order zigzags.
  const P = pts.map(x => ({ x: x.place.lng * Math.cos(x.place.lat * Math.PI / 180), y: x.place.lat })), cr = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  let crossings = 0, crossWhat = "";
  for (let a1 = 0; a1 < P.length - 1; a1++) for (let b1 = a1 + 2; b1 < P.length - 1; b1++) { if (a1 === 0 && b1 === P.length - 2) continue; const A = P[a1], B = P[a1 + 1], C = P[b1], D = P[b1 + 1]; if (hav(pts[a1].place, pts[a1 + 1].place) < 1 || hav(pts[b1].place, pts[b1 + 1].place) < 1) continue; if (cr(A, B, C) * cr(A, B, D) < 0 && cr(C, D, A) * cr(C, D, B) < 0) { crossings++; crossWhat = pts[a1].place.name + "→" + pts[a1 + 1].place.name + " crosses " + pts[b1].place.name + "→" + pts[b1 + 1].place.name; } }
  if (crossings) issues.push(crossings + " crossing leg" + (crossings > 1 ? "s" : "") + " (" + crossWhat + ")");
  // The day's main sight must never be the one left out: a dropped stop that is a must-see, or longer than
  // every kept stop in its own area, means the wrong stop was cut.
  const kept = pts.filter(x => x.type === "stop").map(x => x.place);
  (pl.dropped || []).forEach(x => { const same = kept.filter(k => hav(k, x) < 15); if (same.length && (x.mustSee && !same.every(k => k.mustSee) || same.every(k => (k.minutes || 0) < (x.minutes || 0) * 0.8))) issues.push("left out main sight " + x.name); });
  if (pl.end > pl.endBy + 5) issues.push("ends " + fmt(pl.end) + " after " + fmt(pl.endBy));
  if (pl.endBy - pl.end > 120 && d.type !== "embark" && d.type !== "depart") issues.push("free " + dur(pl.endBy - pl.end));
  return { i, date: d.date, dest: d.destination, stops: pl.stops.length, end: fmt(pl.end), endBy: fmt(pl.endBy), meals: its.filter(x => x.type === "meal" || x.type === "evening").map(x => (x.type === "evening" && !x.booked ? "Suggested dinner" : x.meal.label) + (x.place.booked ? " (booked " + fmt(x.meal.from) + ", at " + fmt(x.time) + ")" : "") + ": " + x.place.name), mealKeys: names, dropped: (pl.dropped || []).map(x => x.name), issues };
}); };
if (typeof window !== "undefined") window.__kairouteDay = (i, sel, extra) => { const d = trip.days[i]; if (typeof sel === "string") { const all = allSites(cityFor(d)); sel = all.filter(x => new RegExp(sel, "i").test(x.name)).map(x => x.id); if (!sel.length) return all.map(x => x.id + " " + x.name); } if (sel) d.selected = sel; if (extra) Object.assign(d, extra); bonusMemo = new Map(); mealMemo = new Map(); eveMemo = new Map(); avoidMeals = new Set(); const pl = buildPlan(d); if (!pl || pl.error) return pl; return { dropped: (pl.dropped || []).map(x => x.name), end: fmt(pl.end), endBy: fmt(pl.endBy), rideMin: pl.items.filter(x => x.type === "travel" && x.leg.mode === "ride").reduce((a, x) => a + x.leg.min, 0), items: pl.items.map(it => it.type === "travel" ? "   ~ " + it.leg.how + " " + it.leg.min + " min " + it.leg.km.toFixed(1) + " km" : fmt(it.time) + " " + it.type + ": " + (it.place ? it.place.name : it.label)) }; };
if (typeof window !== "undefined") window.__kairoutePlans = (ov) => { if (ov) trip.days.forEach((d, i) => { if (ov.sel && ov.sel[i]) d.selected = ov.sel[i]; if ("fill" in ov) d.fillTime = ov.fill; }); bonusMemo = new Map(); mealMemo = new Map(); eveMemo = new Map(); avoidMeals = new Set(); return trip.days.map((d, i) => { const pl = buildPlan(d); if (!pl || !pl.items) return { i, date: d.date, dest: d.destination, none: true }; const pts = pl.items.filter(x => x.place && x.type !== "travel").map(x => ({ lat: x.place.lat, lng: x.place.lng, t: x.type, n: x.place.name })); return { i, date: d.date, dest: d.destination, pts, km: +pl.walkKm.toFixed(2), end: pl.end, endBy: pl.endBy, stops: pl.stops.length, bonus: (pl.bonus || []).map(x => x.name), meals: pl.items.filter(x => x.type === "meal").map(x => x.meal.label + "@" + x.time + " " + x.place.name + " | alts: " + (x.place.alts || []).map(r => r.name + " (" + r.cuisine + ")").join("; ")) }; }); };
// Test hook: pick each day's stops the way a fresh build does.
if (typeof window !== "undefined") window.__kairouteFreshPicks = () => { trip.days.forEach(x => { x.selected = null; }); trip.days.forEach(x => { const c = cities[cityKeyFor(x)]; if (c) x.selected = defaultSelection(c, trip.style, x); }); return trip.days.map(x => x.selected); };
if (typeof window !== "undefined") window.kairoutePrewarm = (reserve, log) => saveStops(BUILTIN_CITIES.flatMap(([c]) => allSites(c)), log || ((d, n, s) => console.log(`saved ${d}/${n} ${s.name}`)), reserve ?? 15000);
function speakLines(id, lines, lc) {
  speakingId = id; audioMsg = "";
  if (natVoiceOn(lc)) { speakNatural(id, lines).then(ok => { if (!ok && speakingId === id) speakDevice(id, lines, lc); }); return; }
  speakDevice(id, lines, lc);
}
function speakDevice(id, lines, lc) {
  const site = { id };
  speakingId = site.id; audioMsg = "";
  if (tts) {
    ttsState = "starting"; updateAudioUI();
    tts.speak(lines.map(text => Object.assign({ text, voice: P().voice }, lc ? { language: lc } : {}))).then(() => { if (speakingId === site.id) { speakingId = null; updateAudioUI(); } })
      .catch(e => {
        if (speakingId !== site.id) return;
        const code = e && e.code;
        if (code === "viewer_stopped" || code === "stopped" || code === "replaced" || code === "hidden" || code === "cancelled") { speakingId = null; updateAudioUI(); return; }
        if (code === "not_granted") { speakingId = null; audioMsg = "Reading aloud is turned off for this page. Turn it back on in the page's Permissions menu."; updateAudioUI(); return; }
        if (code === "rate_limited") { speakingId = null; audioMsg = "Too much audio in a short time. Try again in a minute."; updateAudioUI(); return; }
        if (code === "busy") { speakingId = null; audioMsg = "Audio can't play while dictation is on."; updateAudioUI(); return; }
        speakBrowser(site.id, lines, lc);
      });
  } else if (nativeTTS) speakNative(site.id, lines, lc);
  else speakBrowser(site.id, lines, lc);
}
let nativeRun = 0;
async function speakNative(id, lines, lc) {
  const run = ++nativeRun;
  voiceNow = "your tablet's voice"; ttsState = "speaking"; updateAudioUI();
  try {
    for (const text of lines) {
      if (run !== nativeRun || speakingId !== id) return;
      await nativeTTS.speak({ text, lang: lc || (P().lang === "English" || !P().lang ? "en-US" : langCode(P().lang)), rate: 0.95, pitch: 1.0, volume: 1.0, category: "playback" });
    }
    if (run === nativeRun && speakingId === id) { speakingId = null; ttsState = "idle"; updateAudioUI(); }
  } catch (e) { if (run === nativeRun && speakingId === id) { speakingId = null; audioMsg = "The device voice couldn't start. Check that a text-to-speech voice is installed in Android settings."; updateAudioUI(); } }
}
let audioMsg = "";
const IN_CLAUDE = /claude\.ai|claudeusercontent|anthropic/.test(location.hostname);
const NO_AUDIO = IN_CLAUDE ? "Sound can't play inside the Claude app on phones and tablets. Open Kairoute's website in Chrome instead. The story is written out below meanwhile."
  : "This browser didn't start the voice. Check that the volume is up and the phone isn't on silent, then tap play again. The story is written out below meanwhile.";
// The most natural-sounding device voice for a language: Google's online voices and anything marked
// Natural, Neural, Enhanced or Premium sound far less robotic than the basic offline ones.
function bestVoice(synth, want) {
  const norm = l => (l || "").replace("_", "-").toLowerCase(), pre = want.slice(0, 2).toLowerCase();
  const score = v => (/natural|neural|enhanced|premium|wavenet|studio/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 3 : 0) + (v.localService ? 0 : 1) + (norm(v.lang) === norm(want) ? 2 : 0) - (/compact|espeak/i.test(v.name) ? 5 : 0);
  return synth.getVoices().filter(v => norm(v.lang).startsWith(pre)).sort((x, y) => score(y) - score(x))[0] || null;
}
try { if (window.speechSynthesis) { speechSynthesis.getVoices(); speechSynthesis.addEventListener && speechSynthesis.addEventListener("voiceschanged", () => {}); } } catch (e) {}
function speakBrowser(id, lines, lc) {
  const synth = window.speechSynthesis;
  if (!synth || !window.SpeechSynthesisUtterance) { speakingId = null; audioMsg = NO_AUDIO; updateAudioUI(); return; }
  // Short chunks: some browsers stop long utterances after about 15 seconds.
  const chunks = [];
  lines.map(shapeForSpeech).map(l => l.replace(/…/g, "")).forEach(l => (l.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [l]).forEach(sn => {
    sn = sn.trim(); if (!sn) return;
    const last = chunks[chunks.length - 1];
    if (last && (last + " " + sn).length < 220) chunks[chunks.length - 1] = last + " " + sn; else chunks.push(sn);
  }));
  // Always name the language and pick a matching voice, so the phone's default voice (which may be set
  // to another language) never reads an English story with foreign pronunciation.
  const want = lc || (P().lang === "English" || !P().lang ? "en-US" : langCode(P().lang)), pre = want.slice(0, 2).toLowerCase();
  let voice = null;
  try { voice = bestVoice(synth, want); } catch (e) {}
  voiceNow = voice ? `device voice "${voice.name.replace(/\s*\(.*\)$/, "")}"` : "your device voice";
  let started = false;
  try {
    chunks.forEach((t, i) => {
      const u = new SpeechSynthesisUtterance(t); u.lang = want; if (voice) u.voice = voice;
      // A guide's rhythm instead of a flat read: a touch slower, questions lift, the pitch moves a little between sentences.
      u.rate = 0.94; u.pitch = /\?\s*$/.test(t) ? 1.06 : [1, 1.03, 0.98][i % 3];
      u.onstart = () => { started = true; if (speakingId === id) { ttsState = "speaking"; updateAudioUI(); } };
      u.onerror = ev => { if (ev && (ev.error === "interrupted" || ev.error === "canceled")) return; if (speakingId === id && !started) { speakingId = null; audioMsg = NO_AUDIO; updateAudioUI(); } };
      if (i === chunks.length - 1) u.onend = () => { if (speakingId === id) { speakingId = null; ttsState = "idle"; updateAudioUI(); } };
      synth.speak(u);
    });
    if (synth.paused) synth.resume();
    ttsState = "starting"; updateAudioUI();
    setTimeout(() => { if (!started && speakingId === id && !synth.speaking) { speakingId = null; try { synth.cancel(); } catch (e) {} audioMsg = NO_AUDIO; updateAudioUI(); } }, 3000);
  } catch (e) { speakingId = null; audioMsg = NO_AUDIO; updateAudioUI(); }
}
function speakPhrase(p) {
  stopAudio();
  if (tts) { tts.speak(p.local, Object.assign({ voice: P().voice, rate: 0.85 }, p.lang ? { language: p.lang } : {})).catch(() => {}); return; }
  if (nativeTTS) { nativeTTS.speak({ text: p.local, lang: p.lang || "en-US", rate: 0.85 }).catch(() => {}); return; }
  if (window.speechSynthesis && window.SpeechSynthesisUtterance) { try { const u = new SpeechSynthesisUtterance(p.local); if (p.lang) u.lang = p.lang; u.rate = 0.85; speechSynthesis.speak(u); } catch (e) {} }
}
async function translateSite(site) {
  if (!aiReady()) return;
  const k = site.id + "|" + P().lang; translations[k] = { text: "", loading: true }; renderGuideOnly();
  try {
    await sample(`Translate this tour-guide narration into ${P().lang} for a traveler, keeping it warm and spoken. Keep place names as they are. Then add one paragraph starting with the ${P().lang} for "Things to look for" that lists these details: ${site.lookFor.join(" | ")}. Plain paragraphs, no markdown.\n\n${site.guide}`, {
      modelTier: "quick", onText: ({ text }) => { translations[k].text = text; const el = document.getElementById("tr-" + site.id); if (el) el.innerHTML = paras(text); }
    });
    translations[k].loading = false; renderGuideOnly();
  } catch (e) { translations[k] = { text: "", loading: false, error: "The translation didn't come through. Try again." }; renderGuideOnly(); }
}
let voiceNow = ""; // what the traveler is hearing, shown beside the play button
function updateAudioUI() {
  document.querySelectorAll("[data-play]").forEach(b => {
    const on = b.dataset.play === speakingId;
    b.innerHTML = on ? "■ Stop audio" : (b.dataset.label || "▶ Play audio guide");
    b.setAttribute("aria-pressed", on ? "true" : "false");
    const st = b.parentElement.querySelector(".state");
    if (st) st.textContent = on ? (ttsState === "starting" ? "Starting…" : natVoiceNote ? `Playing with ${voiceNow || "your device voice"}. The natural voice is back at 6 pm Central.` : `Playing${voiceNow ? " · " + voiceNow : ""}`) : (audioMsg || "");
  });
}

// ---------- Rendering ----------
const $view = document.getElementById("view");
const FULL_VIEWS = { lobby: () => renderLobby(), settings: () => renderSettings(), privacy: () => renderPrivacy(), terms: () => renderTerms() };
// Built-in guides (cities1-4.js) fill in any city on the trip that has no guide yet.
let builtinsReady = false;
function ensureBuiltins() {
  if (builtinsReady || typeof BUILTIN_CITIES === "undefined") return; builtinsReady = true;
  for (const [raw, keys] of BUILTIN_CITIES) {
    const c = Object.assign(cleanCity(raw, raw.city), { ai: false, builtin: true });
    for (const k of keys) if (!cities[k]) cities[k] = c;
  }
}
// Fold-out sections stay open across re-renders, so a tap inside one never snaps it shut.
const openFolds = new Set();
document.addEventListener("toggle", e => {
  const el = e.target; if (!el.matches || !el.matches("details") || el.classList.contains("moremenu")) return;
  const sm = el.querySelector("summary"); if (!sm) return;
  const k = view + "|" + sm.textContent.trim(); if (el.open) openFolds.add(k); else openFolds.delete(k);
}, true);
// ---- First-run walkthrough: four short, skippable screens; replay from Settings > How Kairoute works ----
const COACH = [
  ["🧭", "Plan a trip in a minute", "Tap <b>Plan a new trip</b>. Type where you're going, or snap a photo of your itinerary or cruise schedule. Kairoute builds every day for you."],
  ["🗺️", "Your day plan", "The <b>Day plan</b> tab shows your route on a map with times, real places to eat on the way, and what's happening locally. Tap <b>Change stops</b> to add or remove anything."],
  ["🎧", "Start the tour", "On the day, tap <b>Start the tour</b>. Kairoute walks you stop to stop and tells each place's story, like a private guide. In churches and museums it switches to text unless your earbuds are in."],
  ["💬", "Ask your guide", "Curious about something? Use <b>Ask your guide</b> on any stop. Type, or tap 🎤 and ask out loud. No signal? Your question is saved and answered when you're back online."]
];
let coachStep = (() => { try { return localStorage.getItem("kairoute.intro1") ? -1 : 0; } catch (e) { return -1; } })();
function coachHTML() {
  if (coachStep < 0 || coachStep >= COACH.length) return "";
  const [art, title, body] = COACH[coachStep], last = coachStep === COACH.length - 1;
  return `<div class="coach" role="dialog" aria-modal="true" aria-label="How Kairoute works"><div class="sheet">
    <div class="art" aria-hidden="true">${art}</div><span class="eyebrow">How Kairoute works · ${coachStep + 1} of ${COACH.length}</span><h2>${title}</h2><p>${body}</p>
    <div class="row"><div class="dots">${COACH.map((x, i) => `<i class="${i === coachStep ? "on" : ""}"></i>`).join("")}</div>
      <div class="actions">${last ? "" : `<button class="btn ghost small" data-act="coachskip">Skip</button>`}<button class="btn" data-act="coachnext">${last ? "Let's go" : "Next"}</button></div></div></div></div>`;
}
function coachDone() { coachStep = -1; try { localStorage.setItem("kairoute.intro1", "1"); } catch (e) {} }
function render() {
  bonusMemo = new Map(); mealMemo = new Map(); eveMemo = new Map(); avoidMeals = new Set();
  renderView();
  { const old = document.querySelector(".coach"); if (old) old.remove(); const ch = coachHTML(); if (ch) document.body.insertAdjacentHTML("beforeend", ch); }
  if (askNotice && !FULL_VIEWS[view]) { const v = document.getElementById("view"); if (v) v.insertAdjacentHTML("afterbegin", `<p class="banner ok" role="status">${esc(askNotice)} <button class="linkbtn" data-act="asknoticeok">OK</button></p>`); }
  if (openFolds.size) document.querySelectorAll("#view details").forEach(el => { const sm = el.querySelector("summary"); if (sm && openFolds.has(view + "|" + sm.textContent.trim())) el.open = true; });
}
function renderView() {
  ensureBuiltins();
  if (view === "trips") view = "lobby";
  const full = !!FULL_VIEWS[view];
  document.querySelector("header.top").hidden = full;
  document.querySelector("header.top").classList.toggle("touring", view === "tour"); // more room for the tour; Exit tour brings the day list back
  $view.className = full ? "full" : "wrap";
  if (full) { if (tourTimer) { clearInterval(tourTimer); tourTimer = null; } stopCountdownIfAny(); $view.innerHTML = FULL_VIEWS[view](); return; }
  document.getElementById("aiStatus").textContent = aiReady() ? "AI guide on" : "Your own guide, any city";
  document.getElementById("dayChips").innerHTML = trip.days.map((x, i) =>
    `<button class="daychip" data-day="${i}" aria-pressed="${i === trip.active}"><b>${esc(fmtDate(x.date) || "Day " + (i + 1))}</b> · ${esc(x.title && x.title.trim() ? x.title.trim() : x.type === "sea" ? "At sea" : x.destination || "New day")}</button>`).join("");
  const chip = document.querySelector('.daychip[aria-pressed="true"]');
  if (chip && chip.scrollIntoView) { const box = chip.parentElement; const cr = chip.getBoundingClientRect(), br = box.getBoundingClientRect(); box.scrollTo({ left: box.scrollLeft + (cr.left + cr.width / 2) - (br.left + br.width / 2), behavior: "instant" }); }
  document.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", t.dataset.view === (view === "sites" ? "plan" : view) ? "true" : "false"));
  const d = day();
  document.getElementById("tripName").textContent = trip.name || tripName(trip);
  const tripScreens = view === "trips" || view === "wizard";
  document.getElementById("dayRow").hidden = tripScreens;
  document.getElementById("dayCount").textContent = (trip.active + 1) + " of " + trip.days.length;
  document.querySelector(".tabs").hidden = tripScreens;
  if (view === "trips") { $view.innerHTML = renderTrips(); return; }
  if (view === "wizard") { $view.innerHTML = renderWizard(); return; }
  if (view === "journal") { $view.innerHTML = renderJournal(); return; }
  if (view === "tour") { $view.innerHTML = renderTour(d); updateAudioUI(); startTourTimer(); return; }
  if (tourTimer) { clearInterval(tourTimer); tourTimer = null; }
  if (view === "trip") $view.innerHTML = renderTrip(d);
  else if (d.type === "sea") $view.innerHTML = renderSea(d);
  else if (view === "sites") { $view.innerHTML = renderSites(d); const h = document.querySelector("header.top"); if (h) document.documentElement.style.setProperty("--hdr", (h.offsetHeight + 8) + "px"); }
  else if (view === "plan") $view.innerHTML = renderPlan(d);
  else $view.innerHTML = renderGuide(d);
  updateAudioUI();
  startCountdown();
}
function updateBusy() { const el = document.getElementById("busyText"); if (el && busy) el.textContent = busy.text; }
const busyBlock = () => busy ? `<div class="banner" role="status"><span class="spinner"></span><span id="busyText">${esc(busy.text)}</span></div>` : "";
const errBlock = () => aiError ? `<div class="banner warn" role="alert">${esc(aiError)}</div>` : "";
// Each day has a name: the traveler's own, or one suggested from the day's main sight ("Ancient Corinth day").
function dayAuto(d) {
  if (d.type === "sea") return "At sea";
  const city = cityFor(d), sel = city ? allSites(city).filter(x => (d.selected || []).includes(x.id)) : [];
  const main = sel.find(x => x.mustSee && !x.quick) || sel.find(x => !x.quick);
  const short = n => String(n || "").replace(/\s*\(.*?\)\s*/g, " ").replace(/^the /i, "").trim();
  return main ? short(main.name) + " day" : d.destination || "New day";
}
const dayName = d => (d.title && d.title.trim()) || dayAuto(d);
let dayRenaming = null;
function dayHeading(d) {
  const sub = [fmtDow(d.date) + " " + fmtDate(d.date), d.type === "sea" ? "" : d.destination, typeInfo(d.type).short].filter(Boolean).map(esc).join(" · ");
  if (dayRenaming === d.id) return `<div><div class="eyebrow">${sub}</div><div class="renamebox dayrename"><input id="dayTitleInput" type="text" maxlength="60" value="${esc(dayName(d))}" aria-label="Name this day" enterkeyhint="done">
    <button class="btn small" data-act="daytitlesave">Save</button>${d.title ? `<button class="btn ghost small" data-act="daytitleauto">Use "${esc(dayAuto(d))}"</button>` : ""}<button class="btn ghost small" data-act="daytitlecancel">Cancel</button></div></div>`;
  return `<div><div class="eyebrow">${sub}</div><h2 class="dayname">${esc(dayName(d))} <button class="linkbtn rename" data-act="daytitle" aria-label="Rename this day">✎ Rename</button></h2></div>`;
}
function needsCity(d) {
  const ready = aiReady();
  if (ready) return `<div class="card empty">
    <h3>No guide for ${esc(d.destination || "this day")} yet</h3>
    <p>Your guide will research sights, places to eat, the cruise port, stations and day trips for ${esc(d.destination)}.</p>
    <button class="btn" data-act="gen" ${busy ? "disabled" : ""}>Build the ${esc(d.destination)} guide</button>
  </div>`;
  const have = ["Barcelona"].concat(typeof BUILTIN_CITIES === "undefined" ? [] : BUILTIN_CITIES.map(([c]) => String(c.city).replace(/\s*\(.*\)/, "")));
  return `<div class="card empty">
    <h3>${esc(d.destination || "This day")} isn't in the guidebook yet</h3>
    <p>Kairoute has full guides for ${esc(have.slice(0, -1).join(", "))} and ${esc(have[have.length - 1])}. More cities are being added. If this day is one of those places with a different spelling, fix the city name and the guide appears.</p>
    <button class="btn" data-goto="trip">Edit this day</button>
  </div>`;
}
// ---------- Lobby, settings, legal, brand film ----------
const TAGLINE = "Be your own guide.";
const APP_VERSION = "Preview 0.9";
let appSet = { theme: "system", text: "standard", natvoice: "on", voicefx: "on", guide: "aurora" };
try { Object.assign(appSet, JSON.parse(localStorage.getItem("kairoute.app") || "{}")); } catch (e) {}
function applyAppSet() {
  const r = document.documentElement;
  if (appSet.theme === "system") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", appSet.theme);
  if (appSet.text === "large") r.setAttribute("data-text", "large"); else r.removeAttribute("data-text");
}
// Distances: miles or kilometers (Settings > Distances). Default follows the device: miles in the US.
function useMiles() { const u = appSet.units || (/^en-(US|LR|MM)$|-US$/i.test((typeof navigator !== "undefined" && navigator.language) || "") ? "mi" : "km"); return u === "mi"; }
const KM_MI = 0.621371;
// short: a few hundred meters or feet for the last stretch of a walk.
function distTxt(km, short) {
  if (useMiles()) { const mi = km * KM_MI; if (short && mi < 0.2) return Math.max(10, Math.round(mi * 5280 / 50) * 50) + " ft"; return (mi < 10 ? mi.toFixed(1) : Math.round(mi)) + " mi"; }
  if (short && km < 1) return Math.max(10, Math.round(km * 1000 / 10) * 10) + " m";
  return (km < 10 ? km.toFixed(1) : Math.round(km)) + " km";
}
// Distances the guide wrote in kilometers, shown and spoken in miles when miles are chosen.
function unitText(t) {
  if (!useMiles()) return t;
  return String(t || "").replace(/(\d+(?:[.,]\d+)?)(?:\s?(?:-|–|to)\s?(\d+(?:[.,]\d+)?))?\s?(?:km|kilometers|kilometres)\b/gi, (m, a, b) => {
    const c = x => { const v = parseFloat(String(x).replace(",", ".")) * KM_MI; return v < 10 ? +v.toFixed(1) : Math.round(v); };
    return (b ? c(a) + "-" + c(b) : c(a)) + " mi";
  });
}
function saveAppSet() { try { localStorage.setItem("kairoute.app", JSON.stringify(appSet)); } catch (e) {} applyAppSet(); }
applyAppSet();
function markSVG(anim) {
  return `<svg class="k-mark${anim ? " k-anim" : ""}" viewBox="0 0 100 100" aria-hidden="true"><rect class="k-stem" x="14" y="8" width="17" height="84" rx="8.5" stroke="none"/><path class="k-leg" d="M34,52 L77,88" stroke-width="17" stroke-linecap="round" pathLength="1"/><circle class="k-dot" cx="45.5" cy="41" r="4.2"/><circle class="k-dot" cx="52.67" cy="34.83" r="4.2"/><circle class="k-dot" cx="59.83" cy="28.67" r="4.2"/><circle class="k-dot" cx="67" cy="22.5" r="4.2"/><circle class="k-ring" cx="77" cy="15" r="9" stroke-width="5.5" pathLength="1"/></svg>`;
}
const ICON = {
  gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  plan: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18M8 14h3M8 17h6"/></svg>`,
  walk: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7"/></svg>`,
  ear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14v-2a9 9 0 0 1 18 0v2"/><path d="M21 15a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2zM3 15a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>`
};
function heroBg() {
  return `<svg class="bg" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <path d="M-40,420 C160,380 220,250 380,270 S600,420 760,330 S980,150 1240,190"/>
    <path d="M-40,140 C120,190 260,90 420,120 S700,40 880,90 S1100,60 1240,30"/>
    <path d="M120,560 C200,460 360,470 470,400 S640,250 820,260 S1060,420 1240,360"/>
    <circle cx="380" cy="270" r="5"/><circle cx="760" cy="330" r="5"/><circle cx="420" cy="120" r="4"/><circle cx="880" cy="90" r="4"/><circle cx="820" cy="260" r="4"/>
  </svg>`;
}
function bandArt(seed) {
  let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const y = i => 20 + ((h >>> (i * 3)) % 40);
  const pts = [0, 1, 2, 3, 4].map(i => [i * 80 + 10, y(i)]);
  const d = "M" + pts.map(p => p.join(",")).join(" L");
  return `<svg viewBox="0 0 340 74" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/>${pts.slice(1, 4).map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="4"/>`).join("")}</svg>`;
}
function tripSpan(t) {
  const ds = t.days.filter(d => d.date).map(d => d.date).sort();
  return ds.length ? fmtDate(ds[0]) + " to " + fmtDate(ds[ds.length - 1]) : "";
}
function renameBox(id, name) {
  return `<div class="renamebox"><input id="renameInput" type="text" value="${esc(name)}" aria-label="Trip name" enterkeyhint="done"><button class="btn small" data-act="renamesave" data-id="${esc(id)}">Save</button><button class="btn ghost small" data-act="renamecancel">Cancel</button></div>`;
}
function doRename(id) {
  const v = ((document.getElementById("renameInput") || {}).value || "").trim(); renameId = null;
  if (v) { const x = library.find(y => y.id === id); const tt = id === trip.id ? trip : x && x.trip; if (tt) { tt.name = v; if (x) { x.name = v; x.trip = tt; } } }
  save(); render();
}
function renderLobby() {
  if (trip && trip.days && trip.days.length) storeInLibrary();
  const list = library.slice().sort((a, b) => b.updated - a.updated);
  const cur = trip && trip.days && trip.days.length && !trip.archived && !trip.placeholder ? trip : null;
  const d = cur ? cur.days[cur.active] || cur.days[0] : null;
  const hasSample = list.some(x => x.id === SAMPLE_ID);
  const others = list.filter(x => (!cur || x.id !== cur.id) && !x.trip.archived);
  const archived = list.filter(x => x.trip.archived);
  const moreMenu = (id, inner) => `<details class="moremenu" ${delAsk === id || renameId === id ? "open" : ""}><summary>More</summary><div class="mm">${inner}</div></details>`;
  const delBtn = id => delAsk === id ? `<button class="btn small" style="background:var(--warn)" data-act="deltrip" data-id="${esc(id)}">Yes, delete</button><button class="btn ghost small" data-act="delno">Keep</button>` : `<button class="btn ghost small" data-act="delask" data-id="${esc(id)}">Delete</button>`;
  return `<div class="lobby">
  <section class="hero">
    ${heroBg()}
    <div class="herobar"><span class="pill">${esc(APP_VERSION)}</span><button class="iconbtn" data-act="settings">${ICON.gear}Settings</button></div>
    <div class="herocore">
      ${markSVG(true)}
      <h1 class="wordmark">kairoute</h1>
      <p class="tagline">Be your <b>own</b> guide.</p>
      <p class="herosub">Plan every day of the trip, walk the best route between the sights, and hear the story at each stop. Like a private tour guide, on your own time.</p>
      <div class="heroacts"><button class="btn sun" data-act="newtrip">Start a new trip</button><button class="btn light" data-act="film">${ICON.play.replace("<svg", '<svg width="18" height="18"')}Watch the intro</button></div>
    </div>
  </section>
  <div class="lobbybody">
    ${cur ? `<div class="resume">
      <div class="stamp"><span>Day<b>${cur.active + 1}</b></span></div>
      <div><div class="eyebrow">Pick up where you left off</div>${renameId === cur.id ? renameBox(cur.id, cur.name || tripName(cur)) : `<h3>${esc(cur.name || tripName(cur))}</h3>`}
        <div class="meta">${esc(tripSpan(cur))} · ${cur.days.length} days · ${(() => { const td = cur.days.find(x => x.date === todayISO()); const dd = td || d; return (td ? "Today: " : "Next: ") + esc(dd.type === "sea" ? "At sea" : dd.destination || "New day"); })()}</div></div>
      <div class="go"><button class="btn" data-act="continue">Continue trip</button></div>
      <div class="resacts"><span class="lede">Saved automatically</span><button class="btn ghost small" data-goto="trip" data-act2="edit">Edit itinerary</button>${moreMenu(cur.id, `<button class="btn ghost small" data-act="rename" data-id="${esc(cur.id)}">Rename</button><button class="btn ghost small" data-act="archive" data-id="${esc(cur.id)}">Archive</button>${delBtn(cur.id)}`)}</div>
    </div>` : ""}
    <div class="sechead"><h2>Planned trips</h2><span class="lede">${list.length - archived.length} ${syncSt() ? "synced across your devices" + (syncSt().at ? " · last synced " + esc(new Date(syncSt().at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })) : "") : `saved on this device · <button class="linkbtn" data-act="syncfromlobby">Sync with another device</button>`}</span></div>
    <div class="tripcards">
      ${others.map(x => `<div class="tripcard"><div class="band">${bandArt(x.id)}</div><div class="in">
        <div><div class="eyebrow">${esc(tripSpan(x.trip))}${tripSpan(x.trip) ? " · " : ""}${x.trip.days.length} days</div>${renameId === x.id ? renameBox(x.id, x.name) : `<h3>${esc(x.name)}</h3>`}</div>
        <div class="acts"><button class="btn small" data-act="opentrip" data-id="${esc(x.id)}">Open</button>${moreMenu(x.id, `<button class="btn ghost small" data-act="rename" data-id="${esc(x.id)}">Rename</button><button class="btn ghost small" data-act="archive" data-id="${esc(x.id)}">Archive</button>${delBtn(x.id)}`)}</div>
      </div></div>`).join("")}
      <button class="newcard" data-act="newtrip"><span class="plus">+</span>Plan a new trip<span class="lede" style="font-weight:400">Answer a few questions, or snap a photo of your itinerary</span></button>
      ${hasSample ? "" : `<button class="newcard" data-act="loadsample"><span class="plus" style="background:var(--meal)">★</span>Open your Sun Princess trip<span class="lede" style="font-weight:400">Athens, the July 4, 2027 cruise, Barcelona and Madrid</span></button>`}
    </div>
    ${archived.length ? `<details class="card more archive"><summary>Archived trips (${archived.length})</summary>
      <div class="sitelist">${archived.map(x => `<div class="daycard"><div><b>${esc(x.name)}</b><div class="meta">${esc(tripSpan(x.trip))}${tripSpan(x.trip) ? " · " : ""}${x.trip.days.length} days</div></div>
        <div class="actions"><button class="btn small" data-act="restore" data-id="${esc(x.id)}">Restore</button>${delBtn(x.id)}</div></div>`).join("")}</div>
    </details>` : ""}
    <div class="pillars">
      <div class="pillar"><span class="ic">${ICON.plan}</span><h3>Plan the day</h3><p>Pick the sights. Kairoute fits them to your hours, wherever you start: hotel, airport, train or ship.</p></div>
      <div class="pillar"><span class="ic">${ICON.walk}</span><h3>Walk the route</h3><p>The shortest path between stops, a meal at the right time, and quick sights along the way.</p></div>
      <div class="pillar"><span class="ic">${ICON.ear}</span><h3>Hear the story</h3><p>An audio guide at every stop, with the details a professional guide would point out.</p></div>
    </div>
  </div>
  ${footer()}
</div>`;
}
function footer() {
  return `<footer class="lobbyfoot"><div class="in">
    <nav aria-label="About Kairoute"><button class="linkbtn" data-act="settings">Settings</button><button class="linkbtn" data-act="privacy">Privacy</button><button class="linkbtn" data-act="terms">Terms</button><button class="linkbtn" data-act="film">Intro video</button></nav>
    <small>© 2026 Kairoute · ${esc(APP_VERSION)}</small></div></footer>`;
}
function pageBar(title) {
  return `<div class="pagebar"><button class="home" data-act="lobby">${markSVG(false)}kairoute</button><button class="btn ghost small" data-act="lobby">Back to home</button></div>
  <div><div class="eyebrow">Kairoute</div><h2>${esc(title)}</h2></div>`;
}
function renderSettings() {
  const seg = (key, list) => `<div class="seg" role="group">${list.map(([k, l]) => `<button type="button" data-app="${key}" data-v="${k}" aria-pressed="${appSet[key] === k}">${l}</button>`).join("")}</div>`;
  return `<div class="page">${pageBar("Settings")}
  ${syncCard()}
  <div class="card"><h3>Display</h3>
    <div class="field"><span class="lbl">Appearance</span>${seg("theme", [["system", "Match my device"], ["light", "Light"], ["dark", "Dark"]])}</div>
    <div class="field"><span class="lbl">Text size</span>${seg("text", [["standard", "Standard"], ["large", "Large"]])}</div>
    <div class="field"><span class="lbl">New to Kairoute?</span><div><button class="btn ghost small" data-act="coachreplay">How Kairoute works</button></div></div>
    <div class="field"><span class="lbl">Quiet places</span>${seg("quiet", [["auto", "Automatic"], ["always", "Always quiet"], ["off", "Off"]]).replace('data-v="auto" aria-pressed="false"', appSet.quiet && appSet.quiet !== "auto" ? 'data-v="auto" aria-pressed="false"' : 'data-v="auto" aria-pressed="true"')}<span class="hint">In churches, monasteries and museums the guide shows text first and only plays audio once you confirm your earbuds are in.</span></div>
    <div class="field"><span class="lbl">Distances</span>${seg("units", [["mi", "Miles"], ["km", "Kilometers"]]).replace(/aria-pressed="(true|false)"/g, "").replace(/data-v="(mi|km)"/g, (m, k) => m + ' aria-pressed="' + ((k === "mi") === useMiles()) + '"')}</div>
  </div>
  <div class="card"><h3>Natural voice</h3><p class="lede">${freeAI ? "The natural voice is a lifelike AI recording of each story, made once per stop and kept, so replays are free. A few new stops a day fit in the free allowance; after that your device's best voice reads until 6 pm Central." : "Your device's most natural voice reads the stories."}${natVoiceNote ? " " + esc(natVoiceNote) : ""}</p>
    ${freeAI ? `<div class="field"><span class="lbl">Natural AI voice (English)</span>${seg("natvoice", [["on", "On"], ["off", "Device voice only"]])}</div>
    <div class="field"><span class="lbl">Guide voice</span>${seg("guide", GUIDES.map(([k, n, d]) => [k, `${n} <small>${d}</small>`]))}
      <button type="button" class="btn" data-act="voicetry">Hear this voice</button></div>
    <div class="field"><span class="lbl">Kairoute sound (warmer, clearer outdoors, even volume)</span>${seg("voicefx", [["on", "On"], ["off", "Off"]])}</div>` : ""}
  </div>
  ${settingsCard().replace('<details class="card more">', '<details class="card more" open>')}
  <div class="card"><h3>AI guide</h3><p class="lede">${sample === freeSample ? `On, using Kairoute's free test AI. It builds guides for any city, finds your hotel, reads itinerary photos and answers questions.${freeAI && freeAI.budget ? ` About ${Math.round(100 * (freeAI.left || 0) / freeAI.budget)}% of today's free allowance is left; it resets every evening at 6 pm Central (7 pm in summer).` : ""}` : aiReady() ? "On. Kairoute uses Claude to build city guides, find your hotel, read itinerary photos and answer your questions." : "Off right now. The built-in cities still work fully."}</p>
    ${cl && cl.use ? "" : `<details class="more" ${getKey() ? "open" : ""}><summary>Advanced: use your own Anthropic key</summary><div class="field" style="margin-top:10px"><label for="aikey">Anthropic API key</label><div class="ask"><input type="password" id="aikey" autocomplete="off" placeholder="${getKey() ? "Saved on this device" : "sk-ant-…"}"><button type="button" class="btn small" data-act="savekey">Save</button>${getKey() ? `<button type="button" class="btn ghost small" data-act="clearkey">Remove</button>` : ""}</div><span class="hint">Stored only on this device and sent only to Anthropic. Get one at console.anthropic.com under API keys. Usage on your key is billed to you by Anthropic.</span></div></details>`}</div>
  <div class="card"><div><h3>Your data</h3><p class="lede">Trips, guides and journal entries are saved on this device${syncSt() ? ", and copied to your other devices through sync" : ""}. Starting over clears all of it and loads the example trip again.</p></div>
    <div class="actions">${resetAsk ? `<button class="btn" data-act="resetyes" style="background:var(--warn)">Yes, clear everything</button><button class="btn ghost" data-act="resetno">Keep my trips</button>` : `<button class="btn ghost" data-act="reset">Start over</button>`}</div></div>
  <details class="card more"><summary>Coming in the full app</summary>
    <ul class="tips">${[
      ["Book it", "Reserve tickets, timed entries and restaurant tables right from a stop."],
      ["Live maps", "Mapbox maps with turn-by-turn walking directions and your blue dot."],
      ["Real photos", "Pictures of every stop showing exactly what to look for."],
      ["Offline days", "Download each day's maps, audio and photos before you leave the ship."],
      ["Weather smarts", "Read the forecast and move indoor sights to rainy days for you."],
      ["Travel together", "Share a live trip so everyone in your group sees the same plan and journal."],
      ["Running-late alerts", "Phone alerts for the ship countdown, even with the app closed."],
      ["Follow me, phone in pocket", "GPS keeps guiding and starts each story even with the screen off."]
    ].map(([a, b]) => `<li><span><b>${a}:</b> ${b}</span></li>`).join("")}</ul>
  </details>
  <div class="card"><div class="setrow"><div><h3>About</h3><p class="lede">Kairoute ${esc(APP_VERSION)}. ${esc(TAGLINE)}</p></div><button class="btn ghost small" data-act="film">Watch the intro</button></div>
    <div class="actions"><button class="btn ghost small" data-act="privacy">Privacy policy</button><button class="btn ghost small" data-act="terms">Terms of use</button></div></div>
  </div>${footer()}`;
}
const DRAFT = `<p class="draftnote"><b>Draft for the preview.</b> Have a lawyer review this before Kairoute is sold or published in an app store.</p>`;
function renderPrivacy() {
  return `<div class="page">${pageBar("Privacy policy")}${DRAFT}<div class="card legal">
  <p class="lede">Effective November 10, 2026</p>
  <p>Kairoute is built to keep your trip yours. This policy explains what the app stores, what it sends, and the choices you have.</p>
  <h3>What stays on your device</h3>
  <ul><li>Your trips, itineraries, hotels, cruise details and preferences.</li><li>City guides the app has built for you.</li><li>Your journal: notes, ratings and photos.</li></ul>
  <p>The preview has no accounts. We do not see this information unless you share it.</p>
  <h3>What is sent to provide the AI guide</h3>
  <p>When you build a guide, import an itinerary, ask the guide a question or translate a story, the text or photo you provide is sent to our AI provider to produce the answer. Do not include passport numbers, payment details or other sensitive information in itinerary photos.</p>
  <h3>Location</h3>
  <p>The preview does not use your location. The full app will ask for permission before using GPS for walking directions and arrival alerts, and you can turn it off at any time.</p>
  <h3>What we do not do</h3>
  <ul><li>We do not sell your personal information.</li><li>We do not show third-party ads or use advertising trackers.</li><li>We do not build a profile of you for marketing.</li></ul>
  <h3>Sharing a trip</h3>
  <p>When you share or export a trip, the people you send it to can see everything in it. Shared copies are under their control.</p>
  <h3>Deleting your data</h3>
  <p>Delete a single trip from the home screen, or clear everything in Settings, Start over. Uninstalling the app or clearing your browser data also removes it.</p>
  <h3>Children</h3>
  <p>Kairoute is not directed to children under 13, and we do not knowingly collect their information.</p>
  <h3>Changes and contact</h3>
  <p>If this policy changes, we will update the date above and tell you in the app. Questions: privacy@[your domain].</p>
  </div></div>${footer()}`;
}
function renderTerms() {
  return `<div class="page">${pageBar("Terms of use")}${DRAFT}<div class="card legal">
  <p class="lede">Effective November 10, 2026</p>
  <p>By using Kairoute you agree to these terms. If you do not agree, please do not use the app.</p>
  <h3>A planning guide, not a guarantee</h3>
  <p>Kairoute suggests routes, times, places to eat and stories about the sights. Opening hours, prices, port times, transit and closures change. Always confirm important details with the venue, your cruise line, airline or rail operator.</p>
  <h3>You are responsible for your timing</h3>
  <p>Countdowns and leave-by times are estimates. You are responsible for being back aboard your ship, at your gate or on your train on time. Kairoute is not liable for missed departures, connections or bookings.</p>
  <h3>AI content</h3>
  <p>Guides, translations and answers are written with the help of AI and can contain mistakes. Use your judgment, and do not rely on the app for medical, legal or safety advice.</p>
  <h3>Stay safe</h3>
  <p>Watch where you walk, follow local laws and posted rules, and be aware of your surroundings. Do not use the app while driving.</p>
  <h3>Third parties</h3>
  <p>Kairoute is not affiliated with any cruise line, airline, railway, museum or restaurant it mentions. Links to other sites are provided for convenience.</p>
  <h3>Your content</h3>
  <p>Your journal entries and photos remain yours. You give Kairoute permission to store and process them only to run the app for you.</p>
  <h3>Our content</h3>
  <p>The Kairoute name, logo, design and guide content belong to Kairoute and may not be copied or resold.</p>
  <h3>Limitation of liability</h3>
  <p>To the extent the law allows, Kairoute is provided "as is" without warranties, and our total liability is limited to the amount you paid for the app in the past 12 months.</p>
  <h3>Changes and contact</h3>
  <p>We may update these terms and will note the new date above. Questions: support@[your domain].</p>
  </div></div>${footer()}`;
}
// Brand film: a 16-second animated intro, built from the logo.
let filmTimers = [];
function filmHTML() {
  const words = (s, start) => s.split(" ").map((w, i) => `<span class="word" style="animation-delay:${(start + i * 0.12).toFixed(2)}s">${w}</span>`).join(" ");
  const stops = [["09:00", "Leave the hotel"], ["09:40", "Old town"], ["12:30", "Lunch, locals' pick"], ["14:10", "Cathedral"], ["15:45", "Catch your train"]];
  return `<div class="film" id="film" role="dialog" aria-label="Kairoute intro video">
  <div class="grain"></div>
  <div class="chrome"><button class="iconbtn" data-act="filmreplay">Replay</button><button class="iconbtn" data-act="filmclose">Close</button></div>
  <div class="scene" data-s="0">${markSVG(true)}<div class="big r3" style="animation-delay:1.9s">kairoute</div></div>
  <div class="scene" data-s="1"><div class="ftl">${words("Every trip deserves", 0.1)}<br>${words("a great guide.", 0.6)}</div></div>
  <div class="scene" data-s="2"><div class="kicker r1">Plan the day</div>
    <svg class="art" viewBox="0 0 640 230">
      <line class="drawin" x1="40" y1="110" x2="600" y2="110" stroke="#F7F5F0" stroke-opacity=".5" stroke-width="3" stroke-dasharray="2 8" pathLength="1"/>
      ${stops.map(([t, n], i) => { const x = 40 + i * 140; const meal = i === 2, ship = i === 4; return `<g style="animation-delay:${(0.4 + i * 0.3).toFixed(1)}s" class="fade" opacity="1"><circle class="pop" style="animation-delay:${(0.4 + i * 0.3).toFixed(1)}s" cx="${x}" cy="110" r="${ship ? 14 : 11}" fill="${meal || ship ? "#F0643A" : "#F7F5F0"}"/><text x="${x}" y="${i % 2 ? 160 : 72}" text-anchor="middle" font-weight="700">${t}</text><text class="lbl2" x="${x}" y="${i % 2 ? 180 : 52}" text-anchor="middle">${n}</text></g>`; }).join("")}
    </svg><div class="ftl r2" style="animation-delay:1.9s">Fit to <b>your schedule</b>.</div></div>
  <div class="scene" data-s="3"><div class="kicker r1">Walk the route</div>
    <svg class="art" viewBox="0 0 640 260">
      <path id="fpath" class="drawin" d="M40,210 C140,210 150,90 250,110 S380,230 450,150 S560,40 600,50" fill="none" stroke="#F7F5F0" stroke-opacity=".7" stroke-width="4" stroke-linecap="round" stroke-dasharray="1" pathLength="1"/>
      <circle class="pop" style="animation-delay:.3s" cx="40" cy="210" r="10" fill="#F7F5F0"/><circle class="pop" style="animation-delay:.9s" cx="250" cy="110" r="9" fill="#F7F5F0"/><circle class="pop" style="animation-delay:1.4s" cx="450" cy="150" r="9" fill="#F0643A"/><circle class="pop" style="animation-delay:1.8s" cx="600" cy="50" r="12" fill="none" stroke="#F0643A" stroke-width="5"/>
      <circle class="walker" r="7" fill="#F0643A" style="offset-path: path('M40,210 C140,210 150,90 250,110 S380,230 450,150 S560,40 600,50')"/>
    </svg><div class="ftl r2" style="animation-delay:1.7s">The best path, <b>no wasted steps</b>.</div></div>
  <div class="scene" data-s="4"><div class="kicker r1">Hear the story</div>
    <svg class="art bars" viewBox="0 0 640 160">${Array.from({ length: 23 }, (_, i) => { const hgt = 30 + Math.round(Math.abs(Math.sin(i * 1.7)) * 100); return `<rect x="${44 + i * 24}" y="${80 - hgt / 2}" width="12" height="${hgt}" rx="6" style="animation-delay:${(i * 0.07).toFixed(2)}s"/>`; }).join("")}</svg>
    <div class="ftl r2" style="animation-delay:.9s">What to look for, <b>at every stop</b>.</div></div>
  <div class="scene" data-s="5">${markSVG(true)}<div class="big r3" style="animation-delay:1.7s">kairoute</div><div class="ftl r3" style="animation-delay:2.3s">Be your <b>own</b> guide.</div></div>
  <div class="bar" id="filmbar"></div>
</div>`;
}
const FILM_CUES = [0, 3.4, 6.4, 9.8, 13.2, 16.4], FILM_END = 21;
function playFilm(rec) {
  closeFilm();
  document.body.insertAdjacentHTML("beforeend", filmHTML());
  const f = document.getElementById("film"); if (rec) f.classList.add("rec");
  const scenes = [...f.querySelectorAll(".scene")];
  const show = i => scenes.forEach((s, j) => { s.classList.toggle("on", j === i); });
  FILM_CUES.forEach((t, i) => filmTimers.push(setTimeout(() => show(i), t * 1000)));
  const bar = document.getElementById("filmbar"); bar.style.transition = `width ${FILM_END}s linear`; requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = "100%"; }));
  if (!rec) filmTimers.push(setTimeout(closeFilm, (FILM_END + 0.5) * 1000));
  const c = f.querySelector('[data-act="filmclose"]'); if (c) c.focus();
}
function closeFilm() { filmTimers.forEach(clearTimeout); filmTimers = []; const f = document.getElementById("film"); if (f) f.remove(); }
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && document.getElementById("film")) closeFilm();
  if (e.target && e.target.id === "dayTitleInput") { if (e.key === "Enter") { e.preventDefault(); const b = document.querySelector('[data-act="daytitlesave"]'); if (b) b.click(); } else if (e.key === "Escape") { dayRenaming = null; render(); } return; }
  if (e.target && e.target.id === "renameInput") { if (e.key === "Enter") { e.preventDefault(); doRename(renameId); } else if (e.key === "Escape") { renameId = null; render(); } return; }
  if (e.key === "Enter" && e.target && e.target.id === "addPlace" && e.target.value.trim()) { e.preventDefault(); addPlaces(day(), e.target.value.trim()); }
});
function renderTrips() {
  const list = library.slice().sort((a, b) => b.updated - a.updated);
  const hasSample = list.some(x => x.id === SAMPLE_ID);
  return `<div><h2>My trips</h2><p class="lede">Trips are saved on this device. Open one to keep planning, or start a new one.</p></div>
  <div class="actions"><button class="btn" data-act="newtrip">Plan a new trip</button>${hasSample ? "" : `<button class="btn ghost" data-act="loadsample">Open the example trip</button>`}</div>
  ${settingsCard()}
  <div class="card"><div><h3>Start over</h3><p class="lede">Clears every saved trip, built guide and journal entry on this device and loads the example trip again.</p></div>
    <div class="actions">${resetAsk ? `<button class="btn" data-act="resetyes" style="background:var(--warn)">Yes, clear everything</button><button class="btn ghost" data-act="resetno">Keep my trips</button>` : `<button class="btn ghost" data-act="reset">Start over</button>`}</div></div>
  <details class="card more"><summary>Idea garden: coming in the full app</summary>
    <ul class="tips">${[
      ["Book it", "Reserve tickets, timed entries and restaurant tables right from a stop."],
      ["Live maps", "Mapbox maps with turn-by-turn walking directions and your blue dot."],
      ["Real photos", "Pictures of every stop showing exactly what to look for."],
      ["Offline days", "Download each day's maps, audio and photos before you leave the ship."],
      ["Weather smarts", "Read the forecast and move indoor sights to rainy days for you."],
      ["Travel together", "Share a live trip so everyone in your group sees the same plan and journal."],
      ["Running-late alerts", "Phone alerts for the ship countdown, even with the app closed."]
    ].map(([a, b]) => `<li><span><b>${a}:</b> ${b}</span></li>`).join("")}</ul>
  </details>
  <div class="sitelist">${list.map(x => {
    const ds = x.trip.days.filter(d => d.date).map(d => d.date).sort();
    return `<div class="card">
      <div><div class="eyebrow">${ds.length ? esc(fmtDate(ds[0])) + " to " + esc(fmtDate(ds[ds.length - 1])) : ""} · ${x.trip.days.length} days</div><h3>${esc(x.name)}</h3></div>
      <div class="actions">${x.id === trip.id ? `<span class="tag fit">Open now</span>` : `<button class="btn small" data-act="opentrip" data-id="${esc(x.id)}">Open</button>`}
      <button class="btn ghost small" data-act="deltrip" data-id="${esc(x.id)}">Delete</button></div>
    </div>`; }).join("") || `<div class="card empty"><p>No saved trips yet.</p></div>`}</div>`;
}
function settingsCard() {
  const p = P();
  const seg = (key, list) => `<div class="seg" role="group">${list.map(([k, l]) => `<button type="button" data-pref="${key}" data-v="${k}" aria-pressed="${String(p[key]) === String(k)}">${l}</button>`).join("")}</div>`;
  return `<details class="card more"><summary>Preferences for "${esc(trip.name || tripName(trip))}"</summary>
    <div class="field"><span class="lbl">Pace</span>${seg("pace", [["relaxed", "Relaxed"], ["moderate", "Steady"], ["packed", "See it all"]])}</div>
    <div class="field"><span class="lbl">Walking</span>${seg("walk", [["low", "Short walks only"], ["medium", "Up to 30 minutes"], ["high", "Happy to walk a lot"]])}</div>
    <div class="field"><span class="lbl">Accessibility</span>${seg("access", ACCESS)}</div>
    <div class="field"><span class="lbl">Interests</span><div class="seg" role="group">${INTERESTS.map(([k, l]) => `<button type="button" data-pref="interest" data-v="${k}" aria-pressed="${p.interests.includes(k)}">${l}</button>`).join("")}</div></div>
    <div class="field"><span class="lbl">Religious sites</span>${seg("religious", [["on", "Include them"], ["off", "Skip them"]]).replace('data-v="on" aria-pressed="false"', p.religious === "off" ? 'data-v="on" aria-pressed="false"' : 'data-v="on" aria-pressed="true"')}<span class="hint">Churches, monasteries and other places of worship. Famous landmarks stay either way.</span></div>
    <div class="field"><span class="lbl">Guide voice</span>${seg("voice", VOICES)}</div>
    <div class="row2"><div class="field"><label for="p-lang">Guide language</label><select id="p-lang">${LANGS.map(([n]) => `<option ${p.lang === n ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      <div class="field"><label for="p-party">People traveling</label><input type="number" id="p-party" min="1" max="20" value="${p.party}"></div></div>
  </details>`;
}
function renderWizard() {
  const w = wiz, ready = aiReady();
  const steps = ["Your trip", "How you explore", "Last details"];
  const head = `<div><div class="eyebrow">${w.step === 0 ? "New trip" : "Personalize · " + w.step + " of 2: " + steps[w.step]}</div></div>`;
  let body = "";
  if (w.step === 0) body = `
    <div class="field"><label for="w-text">Where are you going, and how?</label>
      <textarea id="w-text" placeholder="Flying into Athens on May 3 and staying 4 days. Then a cruise from Athens to 9 ports, ending in Barcelona, where we stay 3 days. Train to Madrid for 2 days and fly home from Madrid at 4 pm.">${esc(w.text)}</textarea>
      <span class="hint">Include dates, flights and trains, the cruise and its ports if you know them, and how long you stay in each place. Your guide fills in what's missing and you can change anything after.</span></div>
    <div class="field"><span class="lbl">Or snap your itinerary</span>
      <div class="photos">${(w.images || []).map((im, i) => `<div class="ph"><img src="${im.url}" alt="Itinerary photo ${i + 1}"><button type="button" data-wimgdel="${i}" aria-label="Remove photo">×</button></div>`).join("")}
      ${(w.images || []).length < 4 ? `<label class="addph">+ Photo of itinerary<input type="file" accept="image/*" capture="environment" id="w-img" hidden></label>` : ""}</div>
      <span class="hint">Take a photo of your cruise confirmation, flight emails or a printed plan. Your guide reads the dates, ports and times from it.</span></div>
    <details class="more"><summary>Add more details (optional)</summary>
    <div class="row2"><div class="field"><label for="w-line">Cruise line</label><input type="text" id="w-line" value="${esc(w.cruiseLine)}" placeholder="e.g. Celebrity"></div>
      <div class="field"><label for="w-ship">Ship and sail date (optional)</label><input type="text" id="w-ship" value="${esc(w.ship)}" placeholder="e.g. Celebrity Beyond, May 7 2027"></div></div>
    <span class="hint">With the ship and date, your guide fills in the ports and times. Always check them against your cruise documents.</span>
    <div class="field"><label for="w-hotels">Where you're staying</label><textarea id="w-hotels" style="min-height:70px" placeholder="Athens: Hotel Grande Bretagne. Madrid: near Puerta del Sol.">${esc(w.hotels)}</textarea></div>
    <div class="field"><label for="w-name">Name this trip</label><input type="text" id="w-name" value="${esc(w.name)}" placeholder="e.g. Mediterranean 2027"></div></details>
    <p class="lede">That's all Kairoute needs. It picks good defaults for pace, walking and voice, and you can change any of them later.</p>
    ${ready ? "" : `<div class="banner warn">Building a new trip uses the AI guide, which is off while we test for free. Try the Sun Princess trip meanwhile.</div>`}`;
  if (w.step === 1) body = `
    <div class="field"><span class="lbl">What kind of places?</span><div class="seg" role="group" aria-label="Style">${[["touristy", "Famous sights"], ["mix", "A bit of both"], ["local", "Local favorites"]].map(([k, l]) => `<button type="button" data-wz="style" data-v="${k}" aria-pressed="${w.style === k}">${l}</button>`).join("")}</div></div>
    <div class="field"><span class="lbl">What do you enjoy?</span><div class="seg" role="group" aria-label="Interests">${INTERESTS.map(([k, l]) => `<button type="button" data-wz="interest" data-v="${k}" aria-pressed="${w.interests.includes(k)}">${l}</button>`).join("")}</div></div>
    <div class="field"><span class="lbl">Your pace</span><div class="seg" role="group" aria-label="Pace">${[["relaxed", "Relaxed"], ["moderate", "Steady"], ["packed", "See it all"]].map(([k, l]) => `<button type="button" data-wz="pace" data-v="${k}" aria-pressed="${w.pace === k}">${l}</button>`).join("")}</div></div>
    <div class="field"><span class="lbl">How much walking is comfortable?</span><div class="seg" role="group" aria-label="Walking">${[["low", "Short walks only"], ["medium", "Up to 30 minutes"], ["high", "Happy to walk a lot"]].map(([k, l]) => `<button type="button" data-wz="walk" data-v="${k}" aria-pressed="${w.walk === k}">${l}</button>`).join("")}</div>
      <span class="hint">Longer stretches get a metro, bus, taxi or train instead.</span></div>
    <div class="field"><span class="lbl">Any accessibility needs?</span><div class="seg" role="group" aria-label="Accessibility">${ACCESS.map(([k, l]) => `<button type="button" data-wz="access" data-v="${k}" aria-pressed="${w.access === k}">${l}</button>`).join("")}</div>
      <span class="hint">Your guide flags steps and steep climbs and favors easier routes.</span></div>`;
  if (w.step === 2) body = `
    <div class="row2"><div class="field"><label for="w-party">How many people?</label><input type="number" id="w-party" min="1" max="20" value="${w.party}"></div>
      <div class="field"><label for="w-lang">Guide language</label><select id="w-lang">${LANGS.map(([n]) => `<option ${w.lang === n ? "selected" : ""}>${n}</option>`).join("")}</select></div></div>
    <div class="field"><label for="w-trav">Anything else about the travelers? (optional)</label><input type="text" id="w-trav" value="${esc(w.travelers)}" placeholder="e.g. one uses a cane; kids aged 8 and 11"></div>
    ${ready ? "" : `<div class="banner warn">Building the trip uses the AI guide. Turn on the AI guide in Settings to turn it on.</div>`}`;
  return `${head}<div><h2>${["Where are you going?", "How do you like to explore?", "A few last details"][w.step]}</h2></div>
    ${busyBlock()}${errBlock()}
    <form class="card" id="wizForm" autocomplete="off">${body}
      <div class="actions">${w.step > 0 ? `<button type="button" class="btn ghost" data-act="wizback">Back</button>` : `<button type="button" class="btn ghost" data-act="wizcancel">Cancel</button>`}
      ${w.step === 0 ? `<button type="button" class="btn ghost" data-act="wizmore">Personalize first</button>` : ""}
      ${w.step === 1 ? `<button type="submit" class="btn ghost" data-next="1">Next</button>` : ""}
      <button type="submit" class="btn" ${ready && !busy ? "" : "disabled"}>Build my trip</button></div>
    </form>`;
}
function readWiz() {
  if (!wiz) return; const g = id => document.getElementById(id);
  if (g("w-text")) wiz.text = g("w-text").value;
  if (g("w-name")) wiz.name = g("w-name").value.trim();
  if (g("w-hotels")) wiz.hotels = g("w-hotels").value;
  if (g("w-trav")) wiz.travelers = g("w-trav").value.trim();
  if (g("w-line")) wiz.cruiseLine = g("w-line").value.trim();
  if (g("w-ship")) wiz.ship = g("w-ship").value.trim();
  if (g("w-party")) wiz.party = Math.max(1, Math.min(20, +g("w-party").value || 2));
  if (g("w-lang")) wiz.lang = g("w-lang").value;
}
const priceLevel = p => Math.max(1, Math.min(3, (String(p || "").match(/[$€£¥₺₹]|kr|zł/g) || ["x"]).length));
function planBudget(plan) {
  const party = Math.max(1, +P().party || 2), city = plan.city;
  const entry = plan.stops.reduce((a, i) => a + (i.place.cost || 0), 0) * party;
  const food = plan.meals.reduce((a, r) => a + [0, 15, 30, 55][priceLevel(r.price)], 0) * party;
  let move = 0;
  plan.items.forEach((it, i) => {
    if (it.type !== "travel" || it.leg.mode === "walk") return;
    const next = plan.items[i + 1]; if (next && next.place && next.place.far) return;
    move += it.leg.km <= 8 ? 2.5 * party : Math.round(4 + it.leg.km * 1.4);
  });
  const sym = (city.basics && city.basics.symbol) || "€";
  return { entry: Math.round(entry), food: Math.round(food), move: Math.round(move), total: Math.round(entry + food + move), sym, party };
}
const money = (sym, n) => sym + n.toLocaleString("en-US");
function budgetCard(plan) {
  const b = planBudget(plan);
  return `<div class="card"><div><span class="eyebrow">Today's budget estimate · ${b.party} ${b.party === 1 ? "person" : "people"}</span></div>
    <div class="summary">
      <div class="stat"><b>${money(b.sym, b.entry)}</b><span>tickets</span></div>
      <div class="stat"><b>${money(b.sym, b.food)}</b><span>food</span></div>
      <div class="stat"><b>${money(b.sym, b.move)}</b><span>getting around</span></div>
      <div class="stat"><b>${money(b.sym, b.total)}</b><span>total</span></div>
    </div><p class="footnote">Rough figures from typical prices. Change the number of people in Settings.</p></div>`;
}
function tripBudget() {
  const by = {}; let days = 0, missing = 0;
  trip.days.forEach(d => {
    if (d.type === "sea") return;
    const city = cityFor(d); if (!city) { missing++; return; }
    refillIfNeeded(d, city); if (!d.selected) d.selected = defaultSelection(city, trip.style, d);
    const plan = buildPlan(d); if (!plan || plan.error) return;
    const b = planBudget(plan); by[b.sym] = (by[b.sym] || 0) + b.total; days++;
  });
  return { by, days, missing };
}
function basicsCard(city) {
  const b = city.basics; if (!b) return "";
  return `<div class="card"><div><span class="eyebrow">Local basics</span></div>
    <div class="basics">
      ${b.currency ? `<div><b>Money</b><span>${esc(b.currency)}${b.symbol ? " (" + esc(b.symbol) + ")" : ""}</span></div>` : ""}
      ${b.tipping ? `<div><b>Tipping</b><span>${esc(b.tipping)}</span></div>` : ""}
      ${b.safety ? `<div><b>Safety</b><span>${esc(b.safety)}</span></div>` : ""}
      ${b.water ? `<div><b>Water</b><span>${esc(b.water)}</span></div>` : ""}
      ${b.plugs ? `<div><b>Plugs</b><span>${esc(b.plugs)}</span></div>` : ""}
      ${b.emergency ? `<div><b>Emergency</b><span>${esc(b.emergency)}</span></div>` : ""}
    </div>
    ${b.phrases && b.phrases.length ? `<div><span class="eyebrow">Useful words${b.language ? " · " + esc(b.language) : ""}</span></div>
    <div class="phrases">${b.phrases.map((p, i) => `<button class="phrase" data-phrase="${i}"><span class="pl">${esc(p.local)}</span><span class="ps">${esc(p.say)}</span><span class="pm">${esc(p.meaning)}</span><span class="pp" aria-hidden="true">▶</span></button>`).join("")}</div>` : ""}
  </div>`;
}
const todayISO = () => { const n = new Date(); return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0"); };
function countdownCard(d, plan) {
  if (d.type !== "port") return "";
  const stops = plan.items.filter(i => i.type === "stop" || i.type === "meal");
  return `<div class="card countdown" id="cdCard">
    <div><span class="eyebrow">Back to the ship</span></div>
    <div class="cdrow"><div><div class="cdbig" id="cdBig">--:--</div><div class="cdsub" id="cdSub"></div></div>
      <div class="field" style="flex:1;min-width:200px"><label for="cdWhere">Where are you now?</label>
      <select id="cdWhere"><option value="auto">Wherever the plan says</option>${stops.map((i, k) => `<option value="${k}" ${String(cdWhere) === String(k) ? "selected" : ""}>${esc(i.place.name)}</option>`).join("")}</select></div></div>
    <div class="banner" id="cdMsg"></div>
    ${d.date !== todayISO() ? `<div class="actions"><button class="btn ghost small" data-act="cdpreview">${cdPreview == null ? "Preview the countdown" : "Stop preview"}</button></div>` : ""}
  </div>`;
}
function tickCountdown() {
  const d = day(); const el = document.getElementById("cdBig"); if (!el || d.type !== "port") return;
  const plan = buildPlan(d); if (!plan || plan.error) return;
  const backBy = plan.endBy, port = plan.w.tail[plan.w.tail.length - 1];
  const live = d.date === todayISO();
  let now = live ? (new Date().getHours() * 60 + new Date().getMinutes() + new Date().getSeconds() / 60) : cdPreview;
  const stops = plan.items.filter(i => i.type === "stop" || i.type === "meal");
  let here = null;
  if (cdWhere != null && cdWhere !== "auto") here = stops[+cdWhere];
  else if (now != null) here = stops.filter(i => i.time <= now).pop() || null;
  else here = stops[stops.length - 1] || null;
  const from = here ? here.place : plan.w.head[0];
  const back = travel(from, port).min, leaveBy = backBy - back;
  const sub = document.getElementById("cdSub"), msg = document.getElementById("cdMsg");
  sub.textContent = `All aboard ${d.allAboard}. Be at the ship by ${fmt(backBy)}. From ${from.name}: ${travel(from, port).how.toLowerCase()} ${dur(back)}, so leave by ${fmt(leaveBy)}.`;
  if (now == null) { el.textContent = fmt(leaveBy); msg.className = "banner"; msg.textContent = `Leave-by time from ${from.name}. On ${fmtDate(d.date)} this turns into a live countdown.`; return; }
  const left = leaveBy - now;
  el.textContent = left > 0 ? (left >= 60 ? Math.floor(left / 60) + "h " + String(Math.floor(left % 60)).padStart(2, "0") + "m" : Math.floor(left) + " min") : "Go now";
  if (left <= 0) { msg.className = "banner warn"; msg.textContent = `Head back to the ship now. You're ${dur(-left)} past your leave-by time.`; }
  else if (left <= 20) { msg.className = "banner warn"; msg.textContent = `Start heading back in ${Math.ceil(left)} minutes.`; if (!cdSpoken && tts) { cdSpoken = true; tts.speak("Time to start heading back to the ship.", { voice: P().voice }).catch(() => {}); } }
  else { msg.className = "banner"; msg.textContent = `You have time. Leave ${from.name} by ${fmt(leaveBy)}.`; }
}
function stopCountdownIfAny() { if (cdTimer) { clearInterval(cdTimer); cdTimer = null; } }
function startCountdown() {
  if (cdTimer) { clearInterval(cdTimer); cdTimer = null; }
  if (!document.getElementById("cdBig")) return;
  tickCountdown(); cdTimer = setInterval(tickCountdown, 15000);
}
const jKey = (s) => (cityKeyFor(day()) || "x") + "/" + s.id;
function journalBlock(s) {
  const j = (trip.journal || {})[jKey(s)] || {};
  return `<div class="journal"><span class="eyebrow">Your journal</span>
    <div class="stars" role="group" aria-label="Rate ${esc(s.name)}">${[1, 2, 3, 4, 5].map(n => `<button class="star ${j.rating >= n ? "on" : ""}" data-rate="${n}" data-sid="${esc(s.id)}" aria-label="${n} star${n > 1 ? "s" : ""}">★</button>`).join("")}</div>
    <textarea id="note-${esc(s.id)}" data-note="${esc(s.id)}" placeholder="What did you think? Anything to remember?" style="min-height:70px">${esc(j.note || "")}</textarea>
    <div class="photos">${(j.photos || []).map((p, i) => `<div class="ph"><img src="${p}" alt="Your photo ${i + 1} of ${esc(s.name)}"><button data-delphoto="${i}" data-sid="${esc(s.id)}" aria-label="Remove photo">×</button></div>`).join("")}
      ${(j.photos || []).length < 4 ? `<label class="addph">+ Add photo<input type="file" accept="image/*" data-photo="${esc(s.id)}" hidden></label>` : ""}</div>
  </div>`;
}
function jUpdate(sid, fn) {
  trip.journal = trip.journal || {};
  const k = (cityKeyFor(day()) || "x") + "/" + sid;
  const j = trip.journal[k] || { date: day().date, name: (allSites(cityFor(day())).find(x => x.id === sid) || {}).name, city: cityFor(day()).city };
  fn(j); trip.journal[k] = j; save();
}
function shrinkImage(file, max) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => {
      const sc = Math.min(1, (max || 900) / Math.max(img.width, img.height)); const c = document.createElement("canvas");
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", 0.72)); }; img.onerror = rej; img.src = r.result; };
    r.onerror = rej; r.readAsDataURL(file);
  });
}
function renderJournal() {
  const entries = Object.values(trip.journal || {}).filter(j => j.rating || j.note || (j.photos && j.photos.length)).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  return `<div><h2>Trip journal</h2><p class="lede">Rate stops, jot notes and add photos from the Guide tab. Everything collects here.</p></div>
    ${memCard()}
    ${entries.length ? `<div class="sitelist">${entries.map(j => `<div class="card"><div><div class="eyebrow">${esc(fmtDate(j.date))} · ${esc(j.city || "")}</div><h3>${esc(j.name || "")}</h3></div>
      ${j.meal ? `<span class="eyebrow">Meal</span>` : ""}${j.rating ? `<div class="stars static">${"★".repeat(j.rating)}<span style="opacity:.25">${"★".repeat(5 - j.rating)}</span></div>` : ""}
      ${j.note ? `<p>${esc(j.note)}</p>` : ""}
      ${j.photos && j.photos.length ? `<div class="photos">${j.photos.map(p => `<div class="ph"><img src="${p}" alt="Photo of ${esc(j.name || "")}"></div>`).join("")}</div>` : ""}
    </div>`).join("")}</div>` : `<div class="card empty"><p>Nothing yet. Open the Guide tab on any day, rate a stop or add a photo.</p><button class="btn" data-goto="guide">Open the guide</button></div>`}`;
}
// ---- Memory video: the trip as a short, shareable video ----
// Made on the device from the traveler's own photos, journal notes and star ratings, plus real photos of the
// places they visited (each place's own Wikipedia photo, found by its location). Nothing is uploaded. A small
// Kairoute logo sits in the corner of every frame and the video ends on a Kairoute card.
const MEM_W = 720, MEM_H = 1280, MEM_FADE = 0.6;
let mem = { busy: false, pct: 0, url: "", blob: null, ext: "", err: "", msg: "" };
function memCard() {
  const has = Object.values(trip.journal || {}).some(j => j.rating || j.note || (j.photos && j.photos.length)) || trip.days.some(d => cityFor(d));
  if (!has) return "";
  return `<div class="card memcard"><div><span class="eyebrow">Keep the memories</span><h3>Your trip as a short video</h3>
    <p class="lede">Kairoute turns your photos, journal notes and ratings, plus photos of the places you visited, into a video about a minute long. Save it or share it to Facebook, Instagram or anywhere else. It's made right on this device.</p></div>
    ${mem.busy ? `<p><b>${esc(mem.msg || "Making your video…")}</b></p><div class="memprog" role="progressbar" aria-valuenow="${Math.round(mem.pct)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${mem.pct.toFixed(0)}%"></i></div>`
    : mem.url ? `<video class="memvideo" src="${mem.url}" controls playsinline></video><div class="actions"><button class="btn" data-act="memsave">Save video</button>${navigator.canShare && navigator.canShare({ files: [new File([mem.blob], "kairoute-trip." + mem.ext, { type: mem.blob.type })] }) ? `<button class="btn" data-act="memshare">Share</button>` : ""}<button class="btn ghost" data-act="memmake">Make it again</button></div>`
    : `<div class="actions"><button class="btn bigbtn" data-act="memmake">Make my memory video</button></div>`}
    ${mem.err ? `<p class="banner warn" role="alert">${esc(mem.err)}</p>` : ""}</div>`;
}
function memRefresh() { if (view === "journal") { const y = window.scrollY; render(); window.scrollTo(0, y); } else if (view === "tour") render(); }
const memImgCache = new Map();
function loadImg(src) {
  return new Promise(res => { if (!src) return res(null); const im = new Image(); if (!/^data:/.test(src)) im.crossOrigin = "anonymous";
    const to = setTimeout(() => res(null), 12000); im.onload = () => { clearTimeout(to); res(im); }; im.onerror = () => { clearTimeout(to); res(null); }; im.src = src; });
}
// The place's own photo from Wikipedia: articles within 400 m of the place, matched by name.
async function spotPhoto(p) {
  if (!p || !isFinite(p.lat) || !isFinite(p.lng)) return null;
  const k = keyOf(p.name); if (memImgCache.has(k)) return memImgCache.get(k);
  let img = null;
  try {
    const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggscoord=${p.lat}|${p.lng}&ggsradius=400&ggslimit=15&prop=pageimages&piprop=thumbnail&pithumbsize=1000`, { signal: AbortSignal.timeout(10000) });
    const pages = Object.values(((await r.json()).query || {}).pages || {});
    // Only the place's own article: same name, or a shorter form of it (e.g. "Texas State Aquarium"), never a
    // longer different thing that merely shares words (e.g. "Flour Bluff High School"), and no logos.
    const core = t => keyOf(String(t).replace(/\s*\(.*?\)\s*/g, " ").replace(/,.*$/, "")), want = keyOf(p.name);
    const own = x => { const t = core(x.title); return t && (t === want || (t.split(" ").length >= 2 && (" " + want + " ").includes(" " + t + " "))); };
    const hit = pages.find(x => x.thumbnail && own(x) && !/\.(png|svg|gif)(\?|$)/i.test(x.thumbnail.source) && !/logo|seal|flag|map/i.test(x.thumbnail.source));
    if (hit) img = await loadImg(hit.thumbnail.source);
  } catch (e) {}
  memImgCache.set(k, img); return img;
}
async function memSlides() {
  const slides = [], J = trip.journal || {}, used = new Set();
  const days = trip.days.filter(d => d.type !== "sea" && cityFor(d));
  const first = days[0], last = days[days.length - 1] || first;
  slides.push({ kind: "title", title: trip.name || tripName(trip), sub: first ? fmtDate(first.date) + (last && last.date !== first.date ? " – " + fmtDate(last.date) : "") : "", line: [...new Set(days.map(d => d.destination))].slice(0, 4).join(" · ") });
  for (const [i, d] of days.entries()) {
    if (slides.length > 34) break;
    const city = cityFor(d), ck = cityKeyFor(d); refillIfNeeded(d, city); if (!d.selected) d.selected = defaultSelection(city, trip.style, d);
    const plan = buildPlan(d), items = plan && !plan.error ? plan.items.filter(it => it.type === "stop" || it.type === "meal") : [];
    const daySlides = []; let spotOnly = 0;
    for (const it of items) {
      const p = it.place, j = it.type === "meal" ? J[eatKey(city, p.name)] : J[ck + "/" + p.id];
      if (j) used.add(j);
      const cap = { title: p.name, eyebrow: it.type === "meal" ? it.meal.label : (p.category || ""), stars: j && j.rating || 0, quote: j && j.note ? j.note.trim() : "" };
      const ph = (j && j.photos) || [];
      if (ph.length) { for (const [n, src] of ph.slice(0, 3).entries()) daySlides.push(Object.assign({ kind: "photo", src }, n ? { title: p.name, eyebrow: "", stars: 0, quote: "" } : cap)); }
      else if (it.type === "stop" && (cap.quote || cap.stars || spotOnly < 3)) { spotOnly++; daySlides.push(Object.assign({ kind: "photo", spot: p }, cap)); }
      else if (cap.quote || cap.stars) daySlides.push(Object.assign({ kind: "text" }, cap));
    }
    Object.entries(J).filter(([k, j]) => !used.has(j) && j.date === d.date && (j.note || j.rating || (j.photos && j.photos.length))).forEach(([k, j]) => { used.add(j);
      const cap = { title: j.name || "", eyebrow: j.meal ? "Meal" : "", stars: j.rating || 0, quote: (j.note || "").trim() };
      if (j.photos && j.photos.length) j.photos.slice(0, 3).forEach((src, n) => daySlides.push(Object.assign({ kind: "photo", src }, n ? { title: cap.title } : cap)));
      else daySlides.push(Object.assign({ kind: "text" }, cap)); });
    if (!daySlides.length) continue;
    slides.push({ kind: "day", title: dayName(d), eyebrow: "Day " + (i + 1), sub: fmtDow(d.date) + " " + fmtDate(d.date) + (dayName(d) !== d.destination ? " · " + d.destination : ""), spot: items.find(it => it.type === "stop") ? items.find(it => it.type === "stop").place : null });
    slides.push(...daySlides);
  }
  slides.push({ kind: "end" });
  // Load every picture first, so the recording runs smoothly. Places without a real photo become text slides.
  let n = 0; const todo = slides.filter(s => s.src || s.spot);
  for (const s of todo) {
    mem.msg = "Gathering photos (" + (++n) + " of " + todo.length + ")…"; mem.pct = n / todo.length * 30; memRefresh();
    s.img = s.src ? await loadImg(s.src) : await spotPhoto(s.spot);
  }
  const kept = slides.filter(s => s.img || s.kind !== "photo" || s.quote || s.stars).map(s => (s.kind === "photo" && !s.img ? Object.assign(s, { kind: "text" }) : s));
  return kept.filter((s, i) => s.kind !== "day" || (kept[i + 1] && kept[i + 1].kind !== "day" && kept[i + 1].kind !== "end"));
}
if (typeof window !== "undefined") window.__kairouteSpot = async p => { const im = await spotPhoto(p); if (!im) return null; const c = document.createElement("canvas"); c.width = 40; c.height = 40; c.getContext("2d").drawImage(im, 0, 0, 40, 40); let safe = true; try { c.toDataURL(); } catch (e) { safe = false; } return { w: im.naturalWidth, h: im.naturalHeight, src: im.src, canvasSafe: safe }; };
const memLogoSvg = (ink, dot) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 92 104" width="184" height="208"><rect x="14" y="8" width="16" height="84" rx="8" fill="${ink}"/><path d="M36,50 L74,16" fill="none" stroke="${dot}" stroke-width="7" stroke-linecap="round" stroke-dasharray="0.1 13"/><circle cx="78" cy="14" r="10" fill="none" stroke="${dot}" stroke-width="5"/><path d="M36,50 L78,88" fill="none" stroke="${ink}" stroke-width="16" stroke-linecap="round"/></svg>`;
function memWrap(c, text, x, y, maxW, lh, maxLines) {
  const words = String(text).split(/\s+/); let line = "", lines = [];
  for (const w of words) { const t = line ? line + " " + w : w; if (c.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "…"; }
  lines.forEach((l, i) => c.fillText(l, x, y + i * lh)); return lines.length * lh;
}
function memDraw(c, s, t, dur, idx, logos, font) {
  const W = MEM_W, H = MEM_H, ink = "#123C3A", meal = "#D9532A";
  c.save(); c.textBaseline = "alphabetic"; c.textAlign = "left";
  if (s.img) {
    const z = 1 + 0.09 * (t / dur), iw = s.img.naturalWidth || s.img.width, ih = s.img.naturalHeight || s.img.height, sc = Math.max(W / iw, H / ih) * z;
    const dx = (idx % 2 ? -1 : 1) * 24 * (t / dur - 0.5);
    c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
    c.drawImage(s.img, (W - iw * sc) / 2 + dx, (H - ih * sc) / 2, iw * sc, ih * sc);
  } else {
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, ink); g.addColorStop(1, s.kind === "text" ? "#2b5f58" : "#1b4f4b"); c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  const fadeIn = Math.min(1, t / 0.8);
  if (s.kind === "title" || s.kind === "day") {
    c.fillStyle = s.img ? "rgba(10,25,24,.55)" : "rgba(0,0,0,0)"; c.fillRect(0, 0, W, H);
    c.globalAlpha = fadeIn; c.fillStyle = "#fff"; c.textAlign = "center";
    if (s.kind === "title") { c.drawImage(logos.light, W / 2 - 46, 330, 92, 104); c.font = `800 30px ${font}`; c.fillStyle = "#F7C59F"; c.fillText("MY TRIP", W / 2, 520); c.fillStyle = "#fff"; c.font = `800 64px ${font}`; const h = memWrap(c, s.title, W / 2, 600, W - 100, 72, 3); c.font = `600 34px ${font}`; c.fillText(s.sub, W / 2, 620 + h); c.font = `500 28px ${font}`; memWrap(c, s.line, W / 2, 672 + h, W - 120, 36, 2); }
    else { c.font = `800 30px ${font}`; c.fillStyle = "#F7C59F"; c.fillText(s.eyebrow.toUpperCase(), W / 2, 560); c.fillStyle = "#fff"; c.font = `800 72px ${font}`; const h = memWrap(c, s.title, W / 2, 650, W - 90, 80, 2); c.font = `600 34px ${font}`; c.fillText(s.sub, W / 2, 660 + h); }
  } else if (s.kind === "end") {
    c.globalAlpha = fadeIn; c.textAlign = "center"; c.drawImage(logos.light, W / 2 - 70, 400, 140, 158);
    c.fillStyle = "#fff"; c.font = `800 76px ${font}`; c.fillText("kairoute", W / 2, 680); c.font = `600 32px ${font}`; c.fillStyle = "#F7C59F"; c.fillText("Planned and guided with Kairoute", W / 2, 740);
    c.fillStyle = "rgba(255,255,255,.8)"; c.font = `500 26px ${font}`; c.fillText("Your own guide, everywhere you go", W / 2, 790);
  } else {
    const g = c.createLinearGradient(0, H * 0.48, 0, H); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.82)"); c.fillStyle = g; c.fillRect(0, H * 0.48, W, H * 0.52);
    c.globalAlpha = fadeIn; let y = H - 120; const L = 48, MW = W - 96;
    const blocks = [];
    c.font = `italic 500 34px ${font}`; const qLines = s.quote ? Math.min(4, Math.ceil(c.measureText("“" + s.quote + "”").width / MW) + 0) : 0;
    y -= (s.quote ? qLines * 44 + 18 : 0) + (s.stars ? 56 : 0);
    if (s.eyebrow) { c.font = `800 24px ${font}`; c.fillStyle = "#F7C59F"; c.fillText(String(s.eyebrow).toUpperCase(), L, y - 70); }
    c.fillStyle = "#fff"; c.font = `800 50px ${font}`; memWrap(c, s.title, L, y - 18, MW, 56, 2);
    let yy = y + 36;
    if (s.stars) { c.font = `700 42px ${font}`; c.fillStyle = "#F7B53D"; c.fillText("★".repeat(s.stars), L, yy + 12); c.fillStyle = "rgba(255,255,255,.3)"; c.fillText("★".repeat(5 - s.stars), L + c.measureText("★".repeat(s.stars)).width, yy + 12); yy += 56; }
    if (s.quote) { c.fillStyle = "#fff"; c.font = `italic 500 34px ${font}`; memWrap(c, "“" + s.quote + "”", L, yy + 16, MW, 44, 4); }
  }
  c.globalAlpha = 1;
  // the small Kairoute mark in the corner of every frame
  if (s.kind !== "end") { c.globalAlpha = 0.85; c.drawImage(logos.light, W - 132, 44, 23, 26); c.fillStyle = "#fff"; c.font = `800 24px ${font}`; c.textAlign = "left"; c.shadowColor = "rgba(0,0,0,.5)"; c.shadowBlur = 6; c.fillText("kairoute", W - 104, 66); c.shadowBlur = 0; c.globalAlpha = 1; }
  c.restore();
}
async function makeMemoryVideo() {
  if (mem.busy) return;
  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) { mem.err = "This browser can't make videos. Try Chrome on your tablet or phone."; memRefresh(); return; }
  if (mem.url) URL.revokeObjectURL(mem.url);
  mem = { busy: true, pct: 0, url: "", blob: null, ext: "", err: "", msg: "Gathering your photos…" }; memRefresh();
  try {
    const slides = await memSlides();
    const logos = { light: await loadImg("data:image/svg+xml;charset=utf-8," + encodeURIComponent(memLogoSvg("#ffffff", "#F58A62"))) };
    const font = getComputedStyle(document.body).fontFamily || "sans-serif";
    const durOf = s => s.kind === "title" || s.kind === "end" ? 3.6 : s.kind === "day" ? 2.6 : s.kind === "text" ? (s.quote ? 4.2 : 2.8) : (s.quote ? 4.4 : 3.2);
    const starts = []; let total = 0; slides.forEach(s => { starts.push(total); total += durOf(s); });
    const cv = document.createElement("canvas"); cv.width = MEM_W; cv.height = MEM_H; const c = cv.getContext("2d");
    const types = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm"], type = types.find(t => MediaRecorder.isTypeSupported(t)) || "";
    const stream = cv.captureStream(30), rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 5000000 } : undefined), chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise(res => { rec.onstop = res; });
    const frame = t => { let i = starts.findIndex((s0, k) => t >= s0 && t < s0 + durOf(slides[k])); if (i < 0) i = slides.length - 1;
      const lt = t - starts[i]; memDraw(c, slides[i], lt, durOf(slides[i]), i, logos, font);
      const left = durOf(slides[i]) - lt; if (left < MEM_FADE && slides[i + 1]) { c.globalAlpha = 1 - left / MEM_FADE; memDraw(c, slides[i + 1], 0, durOf(slides[i + 1]), i + 1, logos, font); c.globalAlpha = 1; } };
    frame(0); rec.start(1000); mem.msg = "Recording your video…";
    const t0 = performance.now(); let lastPct = -1;
    await new Promise(res => { const tick = () => { const t = (performance.now() - t0) / 1000; frame(Math.min(t, total - 0.01));
      const pct = 30 + Math.min(70, t / total * 70); if (Math.floor(pct) !== lastPct) { lastPct = Math.floor(pct); mem.pct = pct; const bar = document.querySelector(".memprog i"); if (bar) bar.style.width = pct.toFixed(0) + "%"; }
      if (t >= total) res(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    rec.stop(); await done; stream.getTracks().forEach(tr => tr.stop());
    const blob = new Blob(chunks, { type: (type || "video/webm").split(";")[0] });
    mem = { busy: false, pct: 100, url: URL.createObjectURL(blob), blob, ext: /mp4/.test(blob.type) ? "mp4" : "webm", err: "", msg: "" };
  } catch (e) { mem = { busy: false, pct: 0, url: "", blob: null, ext: "", err: "The video couldn't be made (" + (e && e.message || e) + "). Try again.", msg: "" }; }
  memRefresh();
}
const memFileName = () => (trip.name || "kairoute-trip").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") + "." + mem.ext;
async function memSave() {
  if (!mem.blob) return;
  const dl = cl && cl.use ? await cl.use("downloads").catch(() => null) : null;
  if (dl) { try { await dl.save({ filename: memFileName(), data: mem.blob }); } catch (e) {} return; }
  const a = document.createElement("a"); a.href = mem.url; a.download = memFileName(); document.body.appendChild(a); a.click(); a.remove();
}
async function memShare() {
  if (!mem.blob) return;
  try { await navigator.share({ files: [new File([mem.blob], memFileName(), { type: mem.blob.type })], title: trip.name || "My trip", text: "My trip, planned and guided with Kairoute" }); } catch (e) {}
}
function itineraryText() {
  const out = [(trip.name || tripName(trip)), ""];
  trip.days.forEach(d => {
    out.push(`${fmtDow(d.date)} ${fmtDate(d.date)} · ${d.type === "sea" ? "At sea" : d.destination} · ${typeInfo(d.type).short} · ${dayMeta(d)}`);
    const city = cityFor(d);
    if (d.type !== "sea" && city) {
      refillIfNeeded(d, city); if (!d.selected) d.selected = defaultSelection(city, trip.style, d);
      const plan = buildPlan(d);
      if (plan && !plan.error) plan.items.forEach(it => {
        if (it.type === "travel") return;
        const nm = it.type === "meal" ? it.meal.label + ": " + it.place.name : it.type === "start" || it.type === "end" ? it.label : (it.place.along ? "On the way: " : "") + it.place.name;
        out.push(`   ${fmt(it.time)}  ${nm}`);
      });
    } else if (d.type !== "sea") out.push("   (guide not built yet)");
    out.push("");
  });
  return out.join("\n");
}
async function exportPDF() {
  const J = window.jspdf && window.jspdf.jsPDF;
  const dl = cl && cl.use ? await cl.use("downloads") : null;
  if (!J || !dl) { aiError = "Saving a PDF isn't available in this view. Use Copy itinerary instead."; render(); return; }
  const doc = new J({ unit: "pt", format: "letter" });
  const clean = t => String(t).normalize("NFC").replace(/[–—]/g, "-").replace(/[^\x20-\xFF\n]/g, "");
  let y = 56; const L = 54, W = 504;
  const line = (t, size, bold, gap) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.splitTextToSize(clean(t), W).forEach(r => { if (y > 740) { doc.addPage(); y = 56; } doc.text(r, L, y); y += size * 1.35; }); y += gap || 0; };
  line(trip.name || tripName(trip), 20, true, 6);
  line("Made with Kairoute. Times are estimates; check opening hours and your cruise documents.", 9, false, 10);
  trip.days.forEach(d => {
    line(`${fmtDow(d.date)} ${fmtDate(d.date)}  ${d.type === "sea" ? "At sea" : d.destination}  (${typeInfo(d.type).short}: ${dayMeta(d)})`, 12, true, 2);
    const city = cityFor(d);
    if (d.type !== "sea" && city) {
      refillIfNeeded(d, city); if (!d.selected) d.selected = defaultSelection(city, trip.style, d);
      const plan = buildPlan(d);
      if (plan && !plan.error) plan.items.forEach(it => {
        if (it.type === "travel") { if (it.leg.km >= 0.1) line(`        ${it.leg.how}, ${dur(it.leg.min)}`, 8, false); return; }
        const nm = it.type === "meal" ? it.meal.label + ": " + it.place.name : it.type === "start" || it.type === "end" ? it.label : (it.place.along ? "On the way: " : "") + it.place.name;
        line(`${fmt(it.time)}   ${nm}`, 10, false);
      });
    } else if (d.type !== "sea") line("Guide not built yet.", 10, false);
    y += 8;
  });
  try { await dl.save({ filename: (trip.name || "trip").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") + ".pdf", data: doc.output("blob") }); }
  catch (e) { if (e && e.code !== "declined") { aiError = "The PDF couldn't be saved here. Use Copy itinerary instead."; render(); } }
}
function gettingAround(city, plan) {
  const legs = plan.items.filter(i => i.type === "travel" && i.leg.km >= 0.1);
  const counts = {}; legs.forEach(l => { counts[l.leg.how] = (counts[l.leg.how] || 0) + 1; });
  const walkMin = legs.filter(l => l.leg.mode === "walk").reduce((a, l) => a + l.leg.min, 0);
  const summary = Object.entries(counts).map(([k, v]) => `${k}: ${v} leg${v > 1 ? "s" : ""}`).join(" · ");
  const tips = city.gettingAround || [];
  return `<div class="card"><div><span class="eyebrow">Getting around today</span><p>${esc(summary || "Everything is close together.")}${walkMin ? ` · about ${dur(walkMin)} on foot` : ""}</p></div>
    ${tips.length ? `<ul class="tips">${tips.map(t => `<li><span><b>${esc(t.mode)}:</b> ${esc(t.tip)}</span></li>`).join("")}</ul>` : ""}</div>`;
}
function renderSea(d) {
  return `${dayHeading(d)}<div class="card seacard"><div class="big" aria-hidden="true">〰</div><h3>A day at sea</h3><p class="lede">Nothing to plan today. A good time to read ahead in the guide for your next port.</p>
    ${trip.days[trip.active + 1] ? `<button class="btn ghost" data-day="${trip.active + 1}">Next: ${esc(trip.days[trip.active + 1].destination)}</button>` : ""}</div>`;
}
function dayMeta(x) {
  if (x.type === "port") return `Ashore ${x.portArrive}, all aboard ${x.allAboard}${x.tender ? " · tender" : ""}`;
  if (x.type === "arrival") return `${MODES[x.mode].label} arrives ${x.time || "?"}`;
  if (x.type === "departure") return `${MODES[x.mode].label} leaves ${x.time || "?"}`;
  if (x.type === "embark") return `All aboard ${x.allAboard}`;
  if (x.type === "sea") return "No stops";
  return `From ${x.startTime}, ${x.hours} h`;
}
function itinerary() {
  let lastCity = null, out = "";
  trip.days.forEach((x, i) => {
    const group = x.type === "port" || x.type === "sea" || (x.type === "embark") ? "Cruise" : x.destination;
    if (group !== lastCity) { out += `<div class="legsep">${esc(group === "Cruise" ? "Cruise" : "Stay in " + x.destination)}</div>`; lastCity = group; }
    const built = x.type === "sea" || !!cityFor(x);
    out += `<button class="itrow ${i === trip.active ? "active" : ""}" data-day="${i}">
      <span class="dt">${esc(fmtDate(x.date))}</span>
      <span class="ic ${x.type}" aria-hidden="true">${typeInfo(x.type).icon}</span>
      <span class="tx"><b>${esc(x.type === "sea" ? "At sea" : x.destination || "New day")}</b><span>${esc(typeInfo(x.type).short)} · ${esc(dayMeta(x))}${x.estimated ? " · estimated" : ""}</span>${built ? "" : `<span class="ok" style="display:block;color:var(--meal);font-weight:700">Guide not built yet</span>`}</span>
    </button>`;
  });
  return out;
}
function opts(list, cur) { return list.map((s, i) => `<option value="${i}" ${String(cur) === String(i) ? "selected" : ""}>${esc(s.name)}</option>`).join(""); }
function renderTrip(d) {
  const city = cityFor(d);
  const missing = trip.days.filter(x => x.type !== "sea" && !cityFor(x)).map(x => keyOf(x.destination)).filter((v, i, a) => v && a.indexOf(v) === i).length;
  const t = d.type;
  const lk = cityKeyFor(d) || keyOf(d.destination);
  const L = trip.lodging[lk] || { idx: 0 };
  const hotels = pointList(city, "hotel");
  const needsLodging = ["land", "arrival", "departure", "embark"].includes(t);
  const listKey = t === "port" || t === "embark" ? "cruise" : MODES[d.mode].list;
  const points = pointList(city, listKey);
  const pointWord = t === "port" || t === "embark" ? "Cruise terminal" : t === "arrival" ? "Arriving at" : "Leaving from";
  return `
  ${trip.sample && !trip.bannerSeen ? `<div class="banner"><span>This is your Sun Princess trip: Athens, the 11-night cruise from Piraeus on July 4, 2027, then Barcelona and Madrid. Ports and times come from your booking; all-aboard is set 30 minutes before sailing. Flight, hotel and train times are my guesses, so tap a day to change them.</span><button class="btn ghost small" data-act="gotit" style="white-space:nowrap">Got it</button></div>` : ""}
  ${stopsBanner()}
  ${changeCard()}
  <div class="tripgrid">
    <div class="leftcol">
      <div>${renameId === trip.id ? renameBox(trip.id, trip.name || tripName(trip)) : `<div class="setrow"><h2>${esc(trip.name || "Your trip")}</h2><button class="btn ghost small" data-act="rename" data-id="${esc(trip.id)}">Rename</button></div>`}<p class="lede">${trip.days.length} day${trip.days.length === 1 ? "" : "s"}${(() => { const n = trip.days.filter(x => x.type === "port").length; return n ? `, ${n} cruise stop${n === 1 ? "" : "s"}` : ""; })()}. Tap a day to edit it.</p></div>
      ${aiReady() && missing ? `<button class="btn ghost small" data-act="genall" ${busy ? "disabled" : ""}>Build guides for all ${missing} places</button>` : ""}
      <div class="itin">${itinerary()}</div>
      <div class="actions"><button class="btn ghost small" data-act="addday">+ Add a day</button><button class="btn ghost small" data-act="addport">+ Add a port day</button></div>
      ${(() => { const tb = tripBudget(); const parts = Object.entries(tb.by).map(([k, v]) => money(k, v)).join(" + ");
        return `<div class="card"><div><span class="eyebrow">Trip budget estimate · ${P().party} people</span><p><b style="font-family:var(--font-display);font-size:1.4rem">${parts || "-"}</b></p>
          <p class="footnote">Tickets, food and getting around for the ${tb.days} planned day${tb.days === 1 ? "" : "s"}${tb.missing ? `. ${tb.missing} day${tb.missing === 1 ? "" : "s"} still need a guide` : ""}. Flights, the cruise and hotels aren't included.</p></div></div>`; })()}
      <details class="card more">
        <summary>Share, print or rebuild the trip</summary>
        <div class="actions"><button class="btn ghost small" data-act="pdf">Save as PDF</button><button class="btn ghost small" data-act="copytrip">Copy itinerary</button></div>
        <div id="copyBox"></div>
        ${aiReady() ? `<div class="field"><label for="f-triptext">Your trip</label><textarea id="f-triptext" placeholder="Flying into Athens on May 3 and staying 4 days at the Hotel Grande Bretagne. Then a cruise from Piraeus to Mykonos, Santorini… ending in Barcelona. 3 days in Barcelona, train to Madrid for 2 days, flying home at 4 pm.">${esc(tripText)}</textarea><span class="hint">Your guide lays out every day, with port times, flights and trains. This replaces the trip above.</span></div>
        <div class="actions"><button class="btn" data-act="parsetrip" ${busy ? "disabled" : ""}>Build my itinerary</button></div>` : `<p class="ai-note">This uses the AI guide. Turn on the AI guide in Settings to turn it on.</p>`}
      </details>
    </div>
    <div>
      ${busyBlock()}${errBlock()}
      <form class="card" id="dayForm" autocomplete="off">
        <div class="eyebrow">${esc(fmtDow(d.date))} ${esc(fmtDate(d.date))}</div>
        <div class="row2">
          <div class="field"><label for="f-dest">${t === "port" ? "Port" : "City"}</label><input type="text" id="f-dest" value="${esc(d.destination)}" placeholder="e.g. Rome, Nashville, Juneau"></div>
          <div class="field"><label for="f-date">Date</label><input type="date" id="f-date" value="${esc(d.date)}"></div>
        </div>
        <div class="field"><label for="f-type">What kind of day?</label>
          <select id="f-type">${DAY_TYPES.map(x => `<option value="${x.key}" ${x.key === t ? "selected" : ""}>${esc(x.label)}</option>`).join("")}</select>
        </div>
        ${t === "sea" ? `<p class="lede">Nothing to plan on a sea day.</p>` : `
        ${t === "arrival" || t === "departure" ? `<div class="field"><span class="lbl">${t === "arrival" ? "Arriving by" : "Leaving by"}</span>
          <div class="seg" role="group" aria-label="Travel mode">${Object.keys(MODES).filter(k => t === "arrival" || k !== "ship").map(k => `<button type="button" data-mode="${k}" aria-pressed="${d.mode === k}">${MODES[k].label}</button>`).join("")}</div></div>` : ""}
        ${t !== "land" ? `<div class="field"><label for="f-point">${pointWord}</label>
          ${city ? (points.length ? `<select id="f-point">${opts(points, d.pointIdx)}</select>${points[d.pointIdx] && points[d.pointIdx].note ? `<span class="hint">${esc(points[d.pointIdx].note)}</span>` : ""}` : `<span class="hint">No ${esc(listKey)} listed for this city.</span>`) : `<span class="hint">Appears once the guide for ${esc(d.destination || "this city")} is built.</span>`}
        </div>` : ""}
        <div class="row2">
          ${t === "arrival" || t === "departure" ? `<div class="field"><label for="f-time">${t === "arrival" ? "Arrival time" : "Departure time"}</label><input type="time" id="f-time" value="${esc(d.time)}"></div>` : ""}
          ${t === "port" ? `<div class="field"><label for="f-parr">Ship docks</label><input type="time" id="f-parr" value="${esc(d.portArrive)}"></div>` : ""}
          ${t === "port" || t === "embark" ? `<div class="field"><label for="f-aboard">All-aboard time</label><input type="time" id="f-aboard" value="${esc(d.allAboard)}"></div>` : ""}
          ${t === "land" || t === "departure" || t === "embark" ? `<div class="field"><label for="f-start">${t === "land" ? "Start time" : "Check out at"}</label><input type="time" id="f-start" value="${esc(d.startTime)}"></div>` : ""}
          ${t === "land" || t === "arrival" ? `<div class="field"><label for="f-hours">Hours to sightsee</label><input type="number" id="f-hours" min="1" max="14" step="0.5" value="${d.hours}"><div class="seg pace" role="group" aria-label="Pace">${[[2.5,"Light day"],[4,"Half day"],[8,"Full day"]].map(([h,l]) => `<button type="button" data-hrs="${h}" aria-pressed="${+d.hours === h}">${l}</button>`).join("")}</div></div>` : ""}
        </div>
        ${needsLodging ? `<div class="field"><label for="f-lodging">Where you're staying in ${esc(d.destination || "this city")}</label>
          <select id="f-lodging">${opts(hotels, L.idx)}<option value="custom" ${L.idx === "custom" ? "selected" : ""}>My hotel or rental…</option></select>
          ${L.idx === "custom" ? `<div class="ask"><input type="text" id="f-lname" value="${esc(L.name || "")}" placeholder="Hotel name or address"><button type="button" class="btn small" data-act="geo" ${aiReady() ? "" : "disabled"}>Find it</button></div>
          <span class="hint">${L.ll ? "Found on the map: " + esc(L.name) : aiReady() ? "Type the name and tap Find it." : "Pick an area for now, or turn on the AI guide in Settings to find your exact hotel."}</span>` : `<span class="hint">Used for every day you're in ${esc(d.destination || "this city")}.</span>`}
        </div>` : ""}
        <details class="more dayopts" ${d.event ? "open" : ""}><summary>More options for this day</summary>
        ${t === "port" ? `<label class="check"><input type="checkbox" id="f-tender" ${d.tender ? "checked" : ""}><span>Tender port (small boats take you ashore)</span></label>` : ""}
        ${t === "land" ? `<label class="check"><input type="checkbox" id="f-return" ${d.returnToStart ? "checked" : ""}><span>Finish back at the hotel</span></label>` : ""}
        <div class="field"><label for="f-event">Event (optional)</label><input type="text" id="f-event" value="${esc(d.event)}" placeholder="e.g. a ball game, a festival, a concert"></div>
        <div class="field"><span class="lbl">Your style (all days)</span>
          <div class="seg" role="group" aria-label="Style">${[["touristy", "Famous sights"], ["mix", "A bit of both"], ["local", "Local favorites"]].map(([k, l]) => `<button type="button" data-style="${k}" aria-pressed="${trip.style === k}">${l}</button>`).join("")}</div>
          <span class="hint">Also picks where you eat: popular spots or places locals go.</span>
        </div>
        <label class="check"><input type="checkbox" id="f-along" ${d.alongWay ? "checked" : ""}><span>Add quick must-sees along the way</span></label>
        <label class="check"><input type="checkbox" id="f-fill" ${d.fillTime !== false ? "checked" : ""}><span>Fill spare time with bonus stops nearby</span></label>
        <div class="actions"><button class="btn ghost small" type="button" data-act="delday">Remove this day</button></div>
        </details>`}
        <div class="actions">
          ${t === "sea" ? `<button class="btn ghost" type="button" data-act="delday">Remove this day</button>` : `<button class="btn" type="submit" ${busy ? "disabled" : ""}>${city ? "See the day plan" : aiReady() ? "Build the guide" : "Save"}</button>`}
          <span class="hint">Changes save as you go.</span>
        </div>
      </form>
    </div>
  </div>`;
}

function siteCard(s, d, plan) {
  const on = (d.selected || []).includes(s.id);
  const other = plannedElsewhere(d)[s.id];
  let fit = "";
  if (s.far && plan && !plan.error) {
    const O = plan.w.head[plan.w.head.length - 1];
    const rt = tmin(O, s) * 2 + s.minutes, avail = plan.endBy - plan.start;
    fit = rt <= avail ? `<span class="tag fit">Fits today · ${dur(rt)} round trip</span>` : `<span class="tag nofit">Needs ${dur(rt)}, you have ${dur(avail)}</span>`;
  }
  return `<label class="site ${on ? "on" : ""}" for="s-${esc(s.id)}">
    <input type="checkbox" id="s-${esc(s.id)}" data-site="${esc(s.id)}" ${on ? "checked" : ""}>
    <div class="body">
      <div class="name">${esc(s.name)}</div>
      <div class="tags">
        ${other ? `<span class="tag seen">${on ? "Seeing again · first on" : "Planned for"} ${esc(fmtDow(other.date))} ${esc(fmtDate(other.date))}</span>` : ""}
        ${s.mustSee ? `<span class="tag must">Must-see</span>` : ""}
        ${s.kind === "local" ? `<span class="tag local">Local favorite</span>` : `<span class="tag">Famous sight</span>`}
        <span class="tag">${dur(s.minutes)} there</span>
        ${fit}
        ${s.cost ? `<span class="tag">${esc((cityFor(d).basics || {}).symbol || "€")}${s.cost}</span>` : `<span class="tag">Free</span>`}
        ${s.indoor ? `<span class="tag">Indoors</span>` : ""}
        ${closedOn(s, d.date) ? `<span class="tag nofit">${esc(s.closed)}</span>` : ""}
      </div>
      <p class="sum">${esc(unitText(s.summary))}</p>
      ${s.far && s.travel ? `<p class="travelnote">Getting there: ${esc(unitText(s.travel))}</p>` : ""}
      ${s.hours ? `<p class="travelnote">${esc(s.hours)}${s.closed ? " · " + esc(s.closed) : ""}</p>` : ""}
      ${P().access !== "none" && s.access ? `<p class="travelnote"><b>Access:</b> ${esc(s.access)}</p>` : ""}
    </div>
  </label>`;
}
function timeMeter(plan) {
  if (!plan || plan.error) return "";
  const avail = Math.max(1, plan.endBy - plan.start), extra = plan.dropped.reduce((t, x) => t + (x.minutes || 0) + 15, 0);
  const used = plan.end - plan.start + extra, pct = Math.min(100, Math.round(used / avail * 100));
  const full = plan.dropped.length || plan.over, near = !full && used > avail - 45;
  const msg = full ? `Your day is full. ${plan.dropped.length ? `<b>${plan.dropped.map(x => esc(x.name)).join(", ")}</b> won't fit${plan.dropped.length > 1 ? "" : ""}. Untick something or it stays off the plan.` : `It runs ${dur(plan.end - plan.endBy)} late.`}`
    : near ? `Almost full: about ${dur(avail - used)} left.` : `${dur(Math.max(0, avail - used))} free. Meals and walking are included.`;
  return `<div class="meter ${full ? "full" : near ? "near" : ""}" role="status" aria-live="polite">
    <div class="mrow"><b>${dur(Math.min(used, 24 * 60))} of ${dur(avail)}</b><span>${d0(plan)}</span></div>
    <div class="mbar"><i style="width:${pct}%"></i></div><p>${msg}</p></div>`;
}
const d0 = plan => `${fmt(plan.start)} to ${fmt(plan.endBy)}`;
function renderSites(d) {
  const city = cityFor(d);
  if (!city) return `${dayHeading(d)}${busyBlock()}${errBlock()}${needsCity(d)}`;
  refillIfNeeded(d, city); if (!d.selected) d.selected = defaultSelection(city, trip.style, d);
  const plan = buildPlan(d);
  const f = siteFilter;
  const elsewhere = plannedElsewhere(d);
  const away = x => elsewhere[x.id] && !d.selected.includes(x.id);
  const main = city.sites.filter(s => !s.quick && !away(s) && (f === "all" || (f === "must" ? s.mustSee : s.kind === f)));
  const quick = city.sites.filter(s => s.quick);
  const far = (city.farther || []).filter(x => !away(x));
  const already = [...city.sites.filter(x => !x.quick), ...(city.farther || [])].filter(away);
  const n = d.selected.length;
  const avail = plan && !plan.error ? dur(plan.endBy - plan.start) : "";
  return `
  ${dayHeading(d)}
  <p class="lede">Tick what you'd like to see${avail ? ` in the ${avail} you have` : ""}. Your route is worked out for you, and anything that won't fit is flagged on the plan.</p>
  ${city.ai ? `<p class="ai-note">Written by your AI guide from checked sources: every place is confirmed on the map, stories draw on Wikipedia and Wikivoyage (CC BY-SA), hours and access on OpenStreetMap contributors (ODbL). Check opening hours before you go.</p>` : city.builtin ? `<p class="ai-note">Kairoute guide. Hours and prices are typical: check before you go.</p>` : ""}
  <div class="filters seg" role="group" aria-label="Filter">
    ${[["all", "All"], ["must", "Must-sees"], ["touristy", "Famous"], ["local", "Local favorites"]].map(([k, l]) => `<button type="button" data-filter="${k}" aria-pressed="${f === k}">${l}</button>`).join("")}
  </div>
  ${timeMeter(plan)}
  <div class="card suggest"><div><h3>Let your guide plan it</h3><p class="lede">Picks the best stops for ${(() => { const n = trip.days.filter(o => cityFor(o) === city).length; return n > 1 ? `all ${n} days` : "today"; })()} in ${esc(city.city)}, from your start point, hours, pace, walking and interests. Each day gets its own area, nothing repeats, and every stop fits.</p></div>
    ${suggestMsg ? `<p class="banner" id="suggestNote" role="status">${esc(suggestMsg)}</p>` : ""}<div class="actions"><button class="btn" data-act="suggesttour">Suggest my tour</button><button class="btn ghost small" data-act="freshpicks">Fresh picks for this day only</button></div></div>
  <div class="sitelist">${main.map(s => siteCard(s, d, plan)).join("")}</div>
  ${far.length ? `<div><h3>Worth the trip</h3><p class="lede">Day trips and sights farther out, checked against your time today.</p></div>
  <div class="sitelist">${far.map(s => siteCard(s, d, plan)).join("")}</div>` : ""}
  ${errBlock()}
  ${addPlaceCard(d)}
  ${already.length ? `<details class="more already"><summary>Already planned on other days (${already.length})</summary><p class="lede" style="margin:8px 0">Want to go back? Tick one to see it again today.</p>
  <div class="sitelist">${already.map(s => siteCard(s, d, plan)).join("")}</div></details>` : ""}
  ${quick.length ? `<details class="more"><summary>Quick stops (${quick.length})</summary><p class="lede" style="margin:8px 0">Added automatically when your route passes them. Tick one to make it a planned stop.</p>
  <div class="sitelist">${quick.map(s => siteCard(s, d, plan)).join("")}</div></details>` : ""}
  <div class="stickybar"><span class="count">${n} site${n === 1 ? "" : "s"} picked</span><button class="btn" data-act="toplan">See my day plan</button></div>`;
}

function mapSVG(plan) {
  const ll = plan.items.filter(it => it.place).map(it => it.place);
  const minLa = Math.min(...ll.map(p => p.lat)), maxLa = Math.max(...ll.map(p => p.lat));
  const minLo = Math.min(...ll.map(p => p.lng)), maxLo = Math.max(...ll.map(p => p.lng));
  const k = Math.cos((minLa + maxLa) / 2 * Math.PI / 180);
  const w = (maxLo - minLo) * k || 0.01, h = (maxLa - minLa) || 0.01;
  const W = 640, H = 400, pad = 40;
  const sc = Math.min((W - pad * 2) / w, (H - pad * 2) / h);
  const ox = (W - w * sc) / 2, oy = (H - h * sc) / 2;
  const X = p => ox + (p.lng - minLo) * k * sc, Y = p => oy + (maxLa - p.lat) * sc;
  let legs = "", marks = "", n = 0, lastPlace = null, pendingLeg = null;
  plan.items.forEach(it => {
    if (it.type === "travel") { pendingLeg = it; return; }
    if (!it.place) return;
    if (lastPlace && pendingLeg) {
      const ride = pendingLeg.leg.mode === "ride";
      legs += `<line x1="${X(lastPlace).toFixed(1)}" y1="${Y(lastPlace).toFixed(1)}" x2="${X(it.place).toFixed(1)}" y2="${Y(it.place).toFixed(1)}" stroke="${ride ? "var(--ride)" : "var(--route)"}" stroke-width="${ride ? 4 : 5}" stroke-linecap="round"${ride ? ' stroke-dasharray="7 6"' : ""}/>`;
    }
    lastPlace = it.place; pendingLeg = null;
  });
  const drawn = new Set();
  plan.items.forEach(it => {
    const p = it.place; if (!p) return;
    const x = +X(p).toFixed(1), y = +Y(p).toFixed(1);
    const key = x + "," + y;
    if (it.type === "start" || it.type === "end" || it.type === "fixed") {
      if (drawn.has(key)) return; drawn.add(key);
      const lab = it.type === "fixed" ? "H" : it.type === "start" ? "S" : "E";
      marks += `<rect x="${x - 11}" y="${y - 11}" width="22" height="22" rx="5" fill="${it.type === "fixed" ? "var(--must)" : "var(--ink)"}"/><text x="${x}" y="${y + 4.5}" text-anchor="middle" font-size="12" font-weight="800" fill="var(--paper)">${lab}</text>`;
    } else if (it.type === "meal") marks += `<circle cx="${x}" cy="${y}" r="11" fill="var(--card)" stroke="var(--meal)" stroke-width="4"/><text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" font-weight="800" fill="var(--meal)">${it.meal.label[0]}</text>`;
    else if (it.type === "stop" && p.along) marks += `<circle cx="${x}" cy="${y}" r="6" fill="var(--route)" stroke="var(--card)" stroke-width="2"/>`;
    else if (it.type === "stop") { n++; marks += `<circle cx="${x}" cy="${y}" r="13" fill="var(--card)" stroke="var(--route)" stroke-width="4"/><text x="${x}" y="${y + 4.5}" text-anchor="middle" font-size="12.5" font-weight="800" fill="var(--ink)">${n}</text>`; }
  });
  const kmPx = sc / 111.32, uKm = useMiles() ? 1 / KM_MI : 1; const km = [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100].find(v => v * uKm * kmPx > 70) || 100;
  const bar = km * uKm * kmPx;
  let grid = "";
  for (let gx = 0; gx <= W; gx += 40) grid += `<line x1="${gx}" y1="0" x2="${gx}" y2="${H}" stroke="var(--line)" stroke-width="1" opacity=".5"/>`;
  for (let gy = 0; gy <= H; gy += 40) grid += `<line x1="0" y1="${gy}" x2="${W}" y2="${gy}" stroke="var(--line)" stroke-width="1" opacity=".5"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Route diagram for the day" font-family="Atkinson Hyperlegible, system-ui, sans-serif">
    <rect width="${W}" height="${H}" fill="var(--card)"/>${grid}${legs}${marks}
    <g transform="translate(${(W - 24 - bar).toFixed(1)} ${H - 22})"><line x1="0" y1="0" x2="${bar.toFixed(1)}" y2="0" stroke="var(--ink)" stroke-width="3"/><text x="${(bar / 2).toFixed(1)}" y="-7" text-anchor="middle" font-size="11" fill="var(--muted)">${km} ${useMiles() ? "mi" : "km"}</text></g>
    <g transform="translate(22 ${H - 40})"><text x="0" y="0" font-size="12" font-weight="800" fill="var(--muted)" text-anchor="middle">N</text><path d="M0 4 L5 18 L0 14 L-5 18 Z" fill="var(--muted)"/></g>
  </svg>`;
}
function gmapsLink(plan) {
  const ll = p => p.lat.toFixed(5) + "," + p.lng.toFixed(5);
  const pts = plan.items.filter(i => i.place && i.type !== "start" && !(i.type === "stop" && i.place.along)).map(i => i.place);
  const dest = pts[pts.length - 1] || plan.items[0].place;
  const wps = pts.slice(0, -1).slice(0, 9);
  return `https://www.google.com/maps/dir/?api=1&origin=${ll(plan.items[0].place)}&destination=${ll(dest)}${wps.length ? "&waypoints=" + encodeURIComponent(wps.map(ll).join("|")) : ""}&travelmode=walking`;
}
// ---------- Local events on the day ----------
// Real, dated events only: Ticketmaster listings for that date near the city (games, concerts, theatre,
// festivals), plus recurring events that travelers list on Wikivoyage for that month or weekday.
const eventsCache = {};
const MONTH_WORDS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function eventsFor(d, city) {
  if (!freeAI || !d.date || !city) return null;
  const mid = (city.sites || [])[0]; if (!mid) return null;
  const k = keyOf(city.city) + "|" + d.date;
  if (eventsCache[k]) return eventsCache[k].done ? eventsCache[k] : null;
  eventsCache[k] = { done: false };
  const la = (city.sites || []).map(x => x.lat).sort((a, b) => a - b), ln = (city.sites || []).map(x => x.lng).sort((a, b) => a - b), c = { lat: la[la.length >> 1], lng: ln[ln.length >> 1] };
  Promise.all([
    fetch(`${freeAI.url}/events?lat=${c.lat}&lng=${c.lng}&from=${d.date}&to=${d.date}`).then(r => r.ok ? r.json() : { events: [] }).catch(() => ({ events: [] })),
    voyageFor(city.city).catch(() => null)
  ]).then(([tm, vg]) => {
    const dt = new Date(d.date + "T12:00:00"), month = MONTH_WORDS[dt.getMonth()], dow = dt.toLocaleDateString("en-US", { weekday: "long" });
    const nth = ["first", "second", "third", "fourth", "last"][Math.min(4, Math.floor((dt.getDate() - 1) / 7))];
    const recurring = (vg ? vg.listings : []).filter(l => /festival|fair\b|parade|art ?walk|farmers'? market|night market|rodeo|carnival|fiesta|concert series|regatta|season/i.test(l.name + " " + l.content))
      .filter(l => new RegExp("\\b(" + month + "|every " + dow + "|" + dow + "s\\b|" + nth + " " + dow + ")", "i").test(l.content + " " + l.hours))
      .slice(0, 4).map(l => ({ name: l.name, date: d.date, time: "", venue: "", lat: isFinite(l.lat) ? l.lat : null, lng: isFinite(l.lng) ? l.lng : null, url: l.url || "", kind: "Local tradition", genre: "", note: l.content.slice(0, 200), src: "Wikivoyage" }));
    eventsCache[k] = { done: true, events: (tm.events || []).concat(recurring) };
    if (view === "plan") { const y = window.scrollY; render(); window.scrollTo(0, y); }
  });
  return null;
}
function eventsCard(d, city, plan) {
  const ev = eventsFor(d, city);
  if (!ev || !ev.events.length) return "";
  const stops = plan.items.filter(i => i.place && (i.type === "stop" || i.type === "meal")).map(i => i.place);
  const near = e => e.lat != null && stops.length ? Math.min(...stops.map(p => hav(p, e))) : null;
  const rows = ev.events.slice().sort((a, b) => (a.time || "99").localeCompare(b.time || "99")).slice(0, 8).map(e => { const km = near(e);
    return `<li><div class="evtime">${e.time ? fmt(toMin(e.time.slice(0, 5))) : e.src === "Wikivoyage" ? "All day" : "TBA"}</div><div><b>${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.name)}</a>` : esc(e.name)}</b>
      <span class="evmeta">${[e.kind && e.kind !== "Undefined" ? e.kind : "", e.genre && e.genre !== "Undefined" ? e.genre : "", e.venue, km != null ? (km < 1.6 ? "near your route" : distTxt(km) + " from your stops") : ""].filter(Boolean).map(esc).join(" · ")}</span>
      ${e.note ? `<span class="evmeta">${esc(e.note)}</span>` : ""}</div></li>`; }).join("");
  return `<div class="card events"><div><span class="eyebrow">Happening while you're here</span><h3>Off the beaten path on ${esc(fmtDow(d.date))} ${esc(fmtDate(d.date))}</h3></div><ul class="evlist">${rows}</ul>
    <p class="footnote">Real listings for this date from ${[...new Set(ev.events.map(e => e.src))].join(" and ")}. Check times and tickets on the official page.</p></div>`;
}
// Walking and riding look different everywhere: solid teal with a walker for walking, dashed violet with a
// car for taxi, bus, metro or train, on the map, the day timeline and in Tour mode.
const legIcon = m => m === "ride"
  ? `<svg class="legico" viewBox="0 0 24 24" aria-label="By car or transit" role="img"><path fill="currentColor" d="M5 11l1.6-4.6A2 2 0 0 1 8.5 5h7a2 2 0 0 1 1.9 1.4L19 11a2 2 0 0 1 2 2v4a1 1 0 0 1-1 1h-1a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H4a1 1 0 0 1-1-1v-4a2 2 0 0 1 2-2zm2.1 0h9.8l-1.2-3.4a.9.9 0 0 0-.8-.6H9.1a.9.9 0 0 0-.8.6zM7 15.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4zm10 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z"/></svg>`
  : `<svg class="legico" viewBox="0 0 24 24" aria-label="On foot" role="img"><path fill="currentColor" d="M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2a5.1 5.1 0 0 1-4.4-2.4l-1-1.6a2 2 0 0 0-1.7-1c-.3 0-.5.1-.8.1L6 8.3V13h2V9.6z"/></svg>`;
// ---- Real places to eat at day-trip stops ----
// A city's restaurants are gathered around its own sights. A day trip (e.g. Ancient Corinth from Athens) needs
// its own: when a planned stop has no known place to eat within a short walk, Kairoute asks the map
// (OpenStreetMap, free, no AI) for real restaurants and cafés around it, ranks them by reputation (one small
// AI call that only orders real candidates), and keeps them on this device for every later plan.
const FAR_EATS_KEY = "kairoute.fareats";
let farEats = (() => { try { return JSON.parse(localStorage.getItem(FAR_EATS_KEY) || "{}"); } catch (e) { return {}; } })();
const farAsked = new Set();
function farEatsMerge(city) {
  const k = keyOf(city.city), st = farEats[k]; if (!st || city._farN === (st.list || []).length) return;
  const have = new Set((city.restaurants || []).map(r => keyOf(r.name)));
  city.restaurants = (city.restaurants || []).concat((st.list || []).filter(r => !have.has(keyOf(r.name))));
  city._farN = (st.list || []).length;
}
function farEatsFor(city, d) {
  if (!city) return;
  farEatsMerge(city);
  if (!freeAI) return;
  const k = keyOf(city.city), st = farEats[k] || (farEats[k] = { list: [], done: [] });
  const sel = allSites(city).filter(x => (d.selected || []).includes(x.id) && isFinite(x.lat) && isFinite(x.lng));
  // Where the traveler stays too, for the suggested dinner at the end of the day.
  const L = (d.type === "land" || d.type === "arrival") ? lodgingFor(d, city) : null;
  if (L && isFinite(L.lat) && isFinite(L.lng)) sel.push({ id: "stay-" + keyOf(L.name).replace(/ /g, "-"), name: L.name, lat: L.lat, lng: L.lng });
  // A stop counts as bare with no place to eat close by; where the traveler stays, with fewer than 8
  // (lunches on other days use some of them, and dinner needs a choice of its own).
  const bare = sel.filter(x => !st.done.includes(x.id) && !farAsked.has(k + "|" + x.id) && (city.restaurants || []).filter(r => hav(r, x) <= 0.8).length < (/^stay-/.test(x.id) ? 8 : 1));
  if (!bare.length) return;
  bare.forEach(x => farAsked.add(k + "|" + x.id));
  fetch(`${freeAI.url}/places`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pts: bare.map(x => ({ lat: x.lat, lng: x.lng })), r: 1500 }) })
    .then(r => r.ok ? r.json() : null).then(async pl => {
      if (!pl || !Array.isArray(pl.places)) return;
      const seen = new Set((city.restaurants || []).map(r => keyOf(r.name))), score = p => (p.cuisine ? 2 : 0) + (p.hours ? 1 : 0) + (p.web ? 1 : 0) + Math.min(6, p.tags || 0) / 3 + (p.amenity === "restaurant" ? 1 : 0);
      const good = pl.places.filter(p => p.name && p.amenity !== "bar" && !(p.amenity === "fast_food" && !p.cuisine) && !seen.has(keyOf(p.name)) && seen.add(keyOf(p.name))).sort((a, b) => score(b) - score(a));
      const nice = t => String(t || "").split(/[;,]/)[0].replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
      const pick = [];
      for (const x of bare) good.filter(p => hav(p, x) <= 1.5 && !pick.includes(p) && !pick.some(q => hav(q, p) < 0.03)).slice(0, 8).forEach(p => pick.push(p)); // one entry per building: the map sometimes lists a place twice
      const list = pick.map(p => { const by = bare.slice().sort((a, b) => hav(a, p) - hav(b, p))[0];
        return { name: p.name, lat: +(+p.lat).toFixed(5), lng: +(+p.lng).toFixed(5), kind: "local", cuisine: nice(p.cuisine) || (p.amenity === "cafe" ? "Café" : p.amenity === "pub" ? "Pub" : "Restaurant"), price: "",
          why: `A real ${p.amenity === "cafe" ? "café" : "place to eat"} near ${by.name}${p.hours ? ". Hours listed: " + p.hours : ""}. Check it's open before you go.`, onMap: true, recommended: false, near: by.id }; });
      if (list.length >= 3) { const tmp = { restaurants: list }; await rankEats(tmp, bare.map(x => x.name).join(", ") + " (near " + city.city + ")"); list.splice(0, list.length, ...tmp.restaurants); }
      st.list = st.list.concat(list); st.done = st.done.concat(bare.map(x => x.id));
      try { localStorage.setItem(FAR_EATS_KEY, JSON.stringify(farEats)); } catch (e) {}
      farEatsMerge(city);
      if (view === "plan" || view === "tour") { const y = window.scrollY; render(); window.scrollTo(0, y); }
    }).catch(() => {});
}
// Days that spend more time getting around than seeing things get a clear warning, so a once-in-a-lifetime
// day is never quietly wasted in a car.
function travelCheck(plan) {
  const ride = plan.items.filter(i => i.type === "travel").reduce((a, i) => a + i.leg.min, 0);
  const see = plan.items.filter(i => i.type === "stop").reduce((a, i) => a + (i.place.minutes || 0), 0);
  return ride > 150 && ride > see ? { ride, see } : null;
}
// An earlier start: when a day can't fit everything (or a long drive pushes it late), try leaving earlier with
// the same finish time, in half-hour steps down to 06:30, and offer the latest start that fits it all. A start
// is only offered if nobody would reach a sight before it opens (from the sight's listed hours).
function opensAt(s) { const m = String(s.hours || "").match(/(\d{1,2})[:.](\d{2})/); return m ? +m[1] * 60 + +m[2] : null; }
function earlierStart(d, plan) {
  if (d.type !== "land" || !d.startTime || !(plan.dropped.length || plan.over)) return null;
  const s0 = toMin(d.startTime), end0 = s0 + d.hours * 60, keep = { startTime: d.startTime, hours: d.hours, selected: d.selected };
  let best = null;
  try {
    for (let st = s0 - 30; st >= 6 * 60 + 30; st -= 30) {
      d.startTime = fmt(st); d.hours = (end0 - st) / 60; bonusMemo.delete(d); mealMemo.delete(d);
      const p = buildPlan(d); if (!p || p.error) continue;
      const early = p.items.some(i => i.type === "stop" && opensAt(i.place) != null && i.time < opensAt(i.place) - 5);
      if (early) continue;
      if (p.dropped.length < plan.dropped.length || (!p.dropped.length && !p.over)) { best = { start: fmt(st), hours: (end0 - st) / 60, fits: plan.dropped.filter(x => !p.dropped.some(y => y.id === x.id)).map(x => x.name), all: !p.dropped.length && !p.over, end: fmt(p.end) }; if (best.all) break; }
    }
  } finally { Object.assign(d, keep); bonusMemo.delete(d); mealMemo.delete(d); }
  return best;
}
// Built-in example guides with fewer than 10 main sights are too thin to fill a day. When a day uses one, the
// full guide is fetched from the shared cache (free) or built once in the background (it's then shared with
// every traveler), and replaces the thin one.
const THIN_SIGHTS = 10, upgradeTried = new Set();
const isThin = c => !!(c && c.builtin && (c.sites || []).filter(x => !x.quick).length < THIN_SIGHTS);
let upgrading = null;
function upgradeThin(d, city) {
  if (!isThin(city) || !aiReady() || busy || upgrading) return;
  const k = keyOf(d.destination); if (upgradeTried.has(k)) return; upgradeTried.add(k);
  upgrading = d.destination;
  generateCity(d, true).then(ok => { upgrading = null; if (ok && (view === "plan" || view === "guide")) render(); }).catch(() => { upgrading = null; });
}
if (typeof window !== "undefined") window.__kairouteUpgrading = () => upgrading;
if (typeof window !== "undefined") window.__kairouteSights = () => { ensureBuiltins(); const out = {}; trip.days.forEach(d => { const c = cityFor(d); if (!c || out[d.destination]) return; out[d.destination] = { builtin: !!c.builtin, sites: (c.sites || []).map(x => x.name + (x.quick ? " [quick]" : "")), farther: (c.farther || []).map(x => x.name) }; }); return out; };
if (typeof window !== "undefined") window.__kairouteThin = () => { ensureBuiltins(); return trip.days.map((d, i) => { const c = cityFor(d); return c ? i + " " + d.destination + ": " + (c.sites || []).filter(x => !x.quick).length + (c.builtin ? " builtin" : "") : null; }).filter(Boolean).join("\n"); };
function renderPlan(d) {
  const city = cityFor(d);
  if (!city) return `${dayHeading(d)}${busyBlock()}${errBlock()}${needsCity(d)}`;
  refillIfNeeded(d, city); if (!d.selected) d.selected = defaultSelection(city, trip.style, d); crowdFor(city); farEatsFor(city, d); upgradeThin(d, city);
  const plan = buildPlan(d);
  if (plan.error) return `${dayHeading(d)}<div class="card empty"><p>${esc(plan.error)}</p><button class="btn" data-goto="trip">Edit this day</button></div>`;
  let n = 0;
  const rows = plan.items.map((it, idx) => {
    const pv = plan.items[idx - 1], nx = plan.items[idx + 1], rideIn = pv && pv.type === "travel" && pv.leg.mode === "ride", rideOut = nx && nx.type === "travel" && nx.leg.mode === "ride";
    const cls = `tl ${idx === 0 ? "first" : ""} ${idx === plan.items.length - 1 || it.type === "end" ? "last" : ""} ${rideIn ? "rin" : ""} ${rideOut ? "rout" : ""}`;
    if (it.type === "start") return `<div class="${cls}"><div class="time">${fmt(it.time)}</div><div class="rail"><div class="dot start">S</div></div><div class="what"><div class="nm">${esc(it.label)}</div>${it.place.note ? `<div class="sub">${esc(it.place.note)}</div>` : ""}</div></div>`;
    if (it.type === "travel") {
      const m = it.leg.mode;
      return `<div class="tl leg ${m}"><div class="time"></div><div class="rail"></div><div class="what">${legIcon(m)}<span>${it.leg.km < 0.1 ? "Next door" : `<b>${esc(it.leg.how)}</b> · ${dur(it.leg.min)} · ${distTxt(it.leg.km)}`}</span></div></div>`;
    }
    if (it.type === "fixed") return `<div class="${cls}"><div class="time">${fmt(it.time)}</div><div class="rail"><div class="dot fixed">H</div></div><div class="what"><div class="nm">${esc(it.place.name)}</div><div class="sub">${dur(it.place.minutes)}</div></div></div>`;
    if (it.type === "meal") {
      const r = it.place;
      return `<div class="${cls}"><div class="time">${fmt(it.time)}</div><div class="rail"><div class="dot meal">${it.meal.label[0]}</div></div><div class="what">
        <div class="nm">${it.meal.label}: ${esc(r.name)}</div><div class="sub">${[r.booked ? "Your reservation" : "", r.cuisine, r.price, r.generic || r.booked ? "" : r.kind === "local" ? "Local spot" : "Popular with visitors", dur(it.meal.len)].filter(Boolean).map(esc).join(" · ")}</div>
        ${r.booked ? `<div class="sub"><button class="link" data-act="bookopen" data-meal="${it.meal.label}">Change</button> · <button class="link" data-act="bookremove" data-meal="${it.meal.label}">Remove my reservation</button></div>` : `<button class="link" data-act="bookopen" data-meal="${it.meal.label}">Already booked ${it.meal.label.toLowerCase()} somewhere? Add it</button>`}
        <div class="mealbox">${r.crowdTop || r.top || r.recommended ? `<span class="badges">${crowdBadge(r)}${r.top ? `<i class="badge">Local favorite</i>` : ""}${r.recommended ? `<i class="badge">Travelers recommend</i>` : ""}</span>` : ""}<span>${esc(String(r.why || "").replace(/\s*\(Wikivoyage\)\s*$/, ""))}</span>${r.crowd ? `<span class="crowd">${esc(crowdLine(r))}</span>` : ""}${r.alts && r.alts.length ? `<span class="alt"><b>Or try</b> ${r.alts.map(a => esc(a.name) + (a.crowdTop ? " ★" : "") + (a.cuisine && a.cuisine !== "Restaurant" ? ` <small>(${esc(a.cuisine)})</small>` : "")).join(" · ")}</span>` : ""}${r.generic ? "" : eatStars(r.name, city)}</div></div></div>`;
    }
    if (it.type === "stop") {
      const s = it.place;
      if (s.along) return `<div class="${cls}"><div class="time">${fmt(it.time)}</div><div class="rail"><div class="dot quick"></div></div><div class="what"><div class="nm">On the way: ${esc(s.name)}</div><div class="sub">${esc(s.lookFor[0] || s.summary)}</div><button class="link" data-open="${esc(s.id)}">Hear about it</button></div></div>`;
      n++;
      return `<div class="${cls}"><div class="time">${fmt(it.time)}</div><div class="rail"><div class="dot">${n}</div></div><div class="what">
        <div class="nm">${esc(s.name)}</div><div class="sub">${dur(s.minutes)} · ${esc(String(s.category || "").replace(/^\w/, c => c.toUpperCase()))}${s.mustSee ? " · Must-see" : ""}${s.far && s.travel ? " · " + esc(unitText(s.travel)) : ""}</div>
        ${s.bonus ? `<div class="sub bonus">Bonus stop: it fits your spare time, right by your route</div>` : ""}<button class="link" data-open="${esc(s.id)}">Open the guide</button></div></div>`;
    }
    if (it.type === "evening") {
      const r = it.place, lbl = it.meal.label;
      return `<div class="tl evening"><div class="time">${fmt(it.time)}</div><div class="rail"><div class="dot meal">${lbl[0]}</div></div><div class="what">
        <div class="nm">${it.booked ? lbl + ": " + esc(r.name) : "Suggested dinner: " + esc(r.name)}</div>
        <div class="sub">${[it.booked ? "Your reservation" : "", r.cuisine, r.price, it.leg ? (it.leg.km < 0.1 ? "next door" : dur(it.leg.min) + " " + (it.leg.mode === "walk" ? "walk" : "ride") + " from " + (it.near || "where you finish")) : ""].filter(Boolean).map(esc).join(" · ")}</div>
        ${it.late ? `<div class="banner warn">You'll reach it about ${dur(it.time - it.meal.from)} after your reservation. Remove a stop, or ask the restaurant for a later table.</div>` : ""}
        ${it.booked ? "" : `<div class="mealbox">${r.crowdTop || r.top || r.recommended ? `<span class="badges">${crowdBadge(r)}${r.top ? `<i class="badge">Local favorite</i>` : ""}${r.recommended ? `<i class="badge">Travelers recommend</i>` : ""}</span>` : ""}<span>${esc(String(r.why || "").replace(/\s*\(Wikivoyage\)\s*$/, ""))}</span>${r.alts && r.alts.length ? `<span class="alt"><b>Or try</b> ${r.alts.map(a => esc(a.name) + (a.crowdTop ? " ★" : "") + (a.cuisine && a.cuisine !== "Restaurant" ? ` <small>(${esc(a.cuisine)})</small>` : "")).join(" · ")}</span>` : ""}${eatStars(r.name, city)}</div>`}
        ${it.booked ? `<div class="sub"><button class="link" data-act="bookopen" data-meal="${lbl}">Change</button> · <button class="link" data-act="bookremove" data-meal="${lbl}">Remove my reservation</button></div>` : `<button class="link" data-act="bookopen" data-meal="Dinner">Already booked dinner somewhere? Add it</button>`}</div></div>`;
    }
    if (it.type === "end") {
      const spare = plan.endBy - plan.end;
      return `<div class="${cls}"><div class="time">${fmt(it.time)}</div><div class="rail"><div class="dot start">${it.place ? "E" : "✓"}</div></div><div class="what"><div class="nm">${esc(it.label)}</div>
      <div class="sub">${d.type === "port" ? `All aboard ${esc(d.allAboard)}, so you have a 45-minute cushion${spare > 10 ? " plus " + dur(spare) + " spare" : ""}.` :
        d.type === "departure" ? `${MODES[d.mode].label} at ${esc(d.time)}${spare > 10 ? ". " + dur(spare) + " spare" : ""}.` :
        d.type === "embark" ? `All aboard ${esc(d.allAboard)}${spare > 10 ? ". " + dur(spare) + " spare" : ""}.` : spare > 10 ? dur(spare) + " to spare." : ""}</div></div></div>`;
    }
    return "";
  }).join("");
  const stopsN = plan.stops.filter(s => !s.place.along).length;
  return `
  ${dayHeading(d)}
  <div class="daysum" role="group" aria-label="Today at a glance">
    <div><b>${fmt(plan.start)}–${fmt(plan.endBy)}</b><span>${d.type === "port" ? "ashore" : "free time"} · ${dur(plan.endBy - plan.start)}</span></div>
    <div><b>${stopsN}${plan.along.length ? " + " + plan.along.length : ""}</b><span>stops${plan.along.length ? " + on the way" : ""}</span></div>
    <div><b>${distTxt(plan.walkKm)}</b><span>walking</span></div>
    <div><b>${fmt(plan.end)}</b><span>${d.type === "port" ? "back on board" : "finish"}</span></div>
  </div>
  ${plan.w.notes.map(t => `<p class="lede small">${esc(t)}</p>`).join("")}
  ${d.estimated ? `<div class="banner warn">These port times are estimated. Check them against your cruise documents.</div>` : ""}
  <div class="mcta"><button class="btn bigbtn" data-act="tourstart">▶ Start the tour</button></div><div class="planacts"><button class="btn bigbtn" data-act="tourstart">▶ Start the tour</button>
    ${suggestMsg ? `<p class="banner ok" id="suggestNote" role="status">${esc(suggestMsg)} <button class="linkbtn" data-act="suggestok">OK</button></p>` : ""}
    <div class="toolrow"><button class="btn ghost small" data-goto="sites">Change stops</button><button class="btn ghost small" data-act="suggesttour">Suggest my tour</button><a class="btn ghost small" href="${gmapsLink(plan)}" target="_blank" rel="noopener">Open in Google Maps</a>
    <label class="btn ghost small toggle"><input type="checkbox" id="f-rain" ${d.rain ? "checked" : ""}><span>Rainy day</span></label></div></div>
  ${plan.swaps.length ? `<div class="banner">Because of rain: ${plan.swaps.map(([a, b]) => esc(a.name) + " → " + esc(b.name)).join(", ")}.</div>` : ""}
  ${upgrading && keyOf(upgrading) === keyOf(d.destination) ? `<p class="banner" role="status"><span class="spinner"></span> Building a fuller guide for ${esc(d.destination)} in the background. This plan updates by itself in about two minutes.</p>` : ""}
  ${(tc => tc ? `<div class="banner warn" role="alert">This day has ${dur(tc.ride)} of travel for ${dur(tc.see)} at the sights. Consider fewer far-apart stops, more hours, or splitting it over two days.</div>` : "")(travelCheck(plan))}
  ${plan.closedToday.length ? `<div class="banner warn" role="alert">${plan.closedToday.map(s => `${esc(s.name)}: ${esc(s.closed.toLowerCase())}`).join(". ")}, and you're there on a ${esc(fmtDow(d.date))}. Swap it with Change stops.</div>` : ""}
  ${countdownCard(d, plan)}
  ${plan.over ? `<div class="banner warn" role="alert">This plan runs ${dur(plan.end - plan.endBy)} past ${fmt(plan.endBy)}. Remove a stop with Change stops, or change the times.</div>` : ""}
  ${plan.endBy - plan.start < 90 ? `<div class="banner warn">There isn't much time today, so keep it close: a coffee and one nearby sight at most.</div>` : ""}
  <div class="plangrid"><div class="left">
  <div class="mapbox">${mapSVG(plan)}
    <div class="maplegend"><span><i></i>Walk</span><span><i class="dash"></i>Taxi or transit</span><span style="color:var(--meal)">● Meal</span><span style="color:var(--must)">■ Hotel</span><span>● On the way</span></div>
  </div>
  ${(e => e ? `<div class="banner ok"><span>Leave at <b>${e.start}</b> instead of ${esc(d.startTime)} and ${e.fits.length ? `you also fit <b>${e.fits.map(esc).join(", ")}</b>` : "the day fits"}, back by ${e.end}. Earlier also means cooler weather, less traffic and fewer crowds.</span><button class="btn small" data-act="earlystart" data-v="${e.start}" data-h="${e.hours}">Leave at ${e.start}</button></div>` : "")(earlierStart(d, plan))}
  ${plan.dropped.length ? `<div class="banner warn dropped"><span>Didn't fit today: <b>${plan.dropped.map(s => esc(s.name)).join(", ")}</b>. Change the times on Trip, or swap them in with Change stops.</span></div>` : ""}
  ${eventsCard(d, city, plan)}
  ${aiReady() || askState.pending.length ? `<div class="card">${askBlock(null, "Ask about today: what to wear, where to get water, how to get tickets…")}</div>` : ""}
  <details class="more goodtoknow"><summary>Good to know today: getting around, costs, local words</summary>
  ${gettingAround(city, plan)}
  ${budgetCard(plan)}
  ${basicsCard(city)}
  </details>
  <p class="footnote">Times are estimates using a relaxed walking pace and typical taxi times. Check opening hours and book timed tickets for the big sights.</p>
  </div><div class="right"><div class="card"><div class="timeline">${rows}</div>
    <p class="bookrow">Already have a reservation? <button class="btn ghost small" data-act="bookopen" data-meal="Lunch">${(d.booked || {}).Lunch ? "Change lunch" : "Add lunch"}</button><button class="btn ghost small" data-act="bookopen" data-meal="Dinner">${(d.booked || {}).Dinner ? "Change dinner" : "Add dinner"}</button></p></div>${bookFormHTML(d)}</div></div>`;
}

function hashN(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function postcardSVG(s) {
  const h = hashN(s.name), W = 640, H = 280, shapes = [];
  let x = 0, i = 0;
  while (x < W) {
    const bw = 30 + ((h >>> (i % 24)) % 50), bh = 50 + (((h * (i + 3)) >>> 0) % 120);
    shapes.push(`<rect x="${x}" y="${H - bh}" width="${bw}" height="${bh}" fill="var(--route)" opacity="${0.18 + (i % 3) * 0.08}"/>`);
    if (i % 4 === 1) shapes.push(`<path d="M${x} ${H - bh} L${x + bw / 2} ${H - bh - 26} L${x + bw} ${H - bh} Z" fill="var(--route)" opacity="0.3"/>`);
    x += bw + 2; i++;
  }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="${W}" height="${H}" fill="var(--route-soft)"/><circle cx="${120 + (h % 400)}" cy="90" r="44" fill="var(--meal)" opacity="0.35"/>${shapes.join("")}<rect y="${H - 8}" width="${W}" height="8" fill="var(--route)"/></svg>`;
}
function paras(t) { return String(t || "").split(/\n\s*\n|\n/).filter(x => x.trim()).map(p => `<p>${esc(p.trim())}</p>`).join(""); }
function stopCard(s, num, city) {
  const ready = aiReady(), dp = deeper[s.id], an = answers[s.id];
  const photos = `https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(s.name + " " + city.city)}&title=Special:MediaSearch&type=image`;
  return `<article class="stopcard" id="stop-${esc(s.id)}">
    <div class="stopbody">
      <div class="head stophead"><span class="stopnum">${s.along ? "•" : num}</span><div><h3>${esc(s.name)}</h3><p class="stopmeta">${[s.category ? String(s.category).replace(/^\w/, c => c.toUpperCase()) : (s.along ? "On the way" : ""), s.minutes ? dur(s.minutes) : "", s.mustSee ? "Must-see" : ""].filter(Boolean).map(esc).join(" · ")}</p></div></div>
      <p class="lede">${esc(unitText(s.summary))}</p>
${quietOn(s) ? `<p class="banner quiet" role="note">🤫 <span><b>Quiet place.</b> Read the story below. Audio plays only after you confirm your earbuds are in.</span></p>` : ""}<div class="audio"><button class="btn" data-play="${esc(s.id)}" data-label="${quietOn(s) ? "🎧 Play with earbuds" : "▶ Play audio guide"}">${quietOn(s) ? "🎧 Play with earbuds" : "▶ Play audio guide"}</button><span class="state" aria-live="polite"></span></div>
      <details class="story" id="story-${esc(s.id)}" open><summary>The story</summary><div class="guidetext">${paras(unitText(s.guide))}</div></details>
      ${s.lookFor && s.lookFor.length ? `<div class="field"><span class="eyebrow">What to look for</span><ol class="lookfor">${s.lookFor.map(x => `<li><span>${esc(x)}</span></li>`).join("")}</ol></div>` : ""}
      ${picksBlock(s)}
      ${s.photoTip || s.travelerTip ? `<div class="tipsgrid">${s.photoTip ? `<p class="phototip"><b>Photo spot</b> ${esc(s.photoTip)} <a href="${photos}" target="_blank" rel="noopener">See photos</a></p>` : ""}${s.travelerTip ? `<p class="phototip"><b>From travelers</b> ${esc(unitText(s.travelerTip))}</p>` : ""}</div>` : ""}
      ${s.hours || s.tickets || s.crowds || s.priceNote || s.web ? `<div class="before"><span class="eyebrow">Before you go</span>
        ${s.hours ? `<div><b>Hours</b><span>${esc(s.hours)}${s.closed ? " · " + esc(s.closed) : ""}</span></div>` : ""}
        ${s.priceNote ? `<div><b>Price</b><span>${esc(s.priceNote)}</span></div>` : ""}
        ${s.tickets ? `<div><b>Tickets</b><span>${esc(s.tickets)}</span></div>` : ""}
        ${s.crowds ? `<div><b>Crowds</b><span>${esc(s.crowds)}</span></div>` : ""}
        ${s.access && P().access !== "none" ? `<div><b>Access</b><span>${esc(s.access)}</span></div>` : ""}
        ${s.web ? `<div><b>Website</b><span><a href="${esc(s.web)}" target="_blank" rel="noopener">Official site ↗</a></span></div>` : ""}
      </div>` : ""}
      ${s.sources && s.sources.length ? `<p class="ai-note">Checked against: ${s.sources.filter(x => x !== "map").map(esc).join(", ") || "the map"}${s.sources.includes("map") && s.sources.length > 1 ? " and the map" : ""}.</p>` : ""}
      ${(() => { const tr = translations[s.id + "|" + P().lang]; const need = P().lang !== "English" && city.lang !== P().lang;
        return need ? (tr ? `<div class="guidetext" id="tr-${esc(s.id)}">${tr.text ? paras(tr.text) : `<p class="ai-note"><span class="spinner"></span> Translating…</p>`}</div>${tr.error ? `<p class="ai-note">${esc(tr.error)}</p>` : ""}` : (ready ? `<div><button class="btn ghost small" data-translate="${esc(s.id)}">Read it in ${esc(P().lang)}</button></div>` : "")) : ""; })()}
      ${dp ? `<div class="guidetext" id="deep-${esc(s.id)}">${dp.text ? paras(dp.text) : `<p class="ai-note"><span class="spinner"></span> Your guide is thinking…</p>`}</div>${dp.error ? `<p class="ai-note">${esc(dp.error)}</p>` : ""}` : ""}
      ${ready ? `<div class="actions">${!dp || dp.error ? `<button class="btn ghost small" data-deeper="${esc(s.id)}">Tell me more</button>` : ""}</div>
      ${askBlock(s)}` : `<p class="ai-note">Turn on the AI guide in Settings to ask the guide questions and hear more.</p>`}
      ${journalBlock(s)}
    </div>
  </article>`;
}
function renderGuide(d) {
  const city = cityFor(d);
  if (!city) return `${dayHeading(d)}${busyBlock()}${errBlock()}${needsCity(d)}`;
  refillIfNeeded(d, city); if (!d.selected) d.selected = defaultSelection(city, trip.style, d);
  const plan = buildPlan(d);
  if (!plan || plan.error) return `${dayHeading(d)}<div class="card empty"><p>${esc(plan ? plan.error : "Set up your day first.")}</p><button class="btn" data-goto="trip">Edit this day</button></div>`;
  let n = 0;
  const cards = plan.items.filter(i => i.type === "stop").map(i => { if (!i.place.along) n++; return stopCard(i.place, n, city); }).join("");
  const jumps = plan.items.filter(i => i.type === "stop" && !i.place.along).map((i, k) => `<button type="button" class="chip" data-jump="${esc(i.place.id)}"><b>${k + 1}</b> ${esc(i.place.name)}</button>`).join("");
  return `${dayHeading(d)}<p class="lede">Every stop's story, in route order. For a guided walk through the day, use Tour mode.</p>
    <div class="mcta"><button class="btn bigbtn" data-act="tourstart">▶ Start the tour</button></div><div class="planacts"><button class="btn bigbtn" data-act="tourstart">▶ Start the tour</button></div>
    ${jumps ? `<nav class="jumps" aria-label="Jump to a stop">${jumps}</nav>` : ""}
    ${cards ? `<div class="stoplist">${cards}</div>` : `<div class="card empty"><p>No stops planned for today.</p><button class="btn" data-goto="sites">Choose stops</button></div>`}`;
}
// ---------- Tour mode ----------
function tourSteps(plan) {
  const steps = []; let leg = null;
  plan.items.forEach(it => {
    if (it.type === "travel") { leg = it.leg; return; }
    steps.push(Object.assign({}, it, { leg })); leg = null;
  });
  return steps;
}
function curTour(d) {
  if (!trip.tour || trip.tour.dayId !== d.id) trip.tour = { dayId: d.id, i: 0, phase: "at", arrivedAt: Date.now(), found: [], nudged: 0 };
  return trip.tour;
}
function stepName(st) { return st.type === "meal" ? st.meal.label + " at " + st.place.name : st.type === "start" || st.type === "end" ? st.label : st.place.name; }
function walkText(st, next2) {
  const leg = st.leg, nm = stepName(st);
  let t = leg ? `Next up: ${nm}. It's about ${dur(leg.min)} ${leg.mode === "walk" ? "on foot" : "by " + leg.how.toLowerCase()}.` : `Next up: ${nm}.`;
  if (st.type === "stop" && st.place.summary) t += " " + st.place.summary;
  if (st.type === "stop" && st.place.along) t += " It's a quick one, right on your way.";
  if (st.type === "meal") t += " " + (st.place.why || "") + " Plan on about " + dur(st.meal.len) + ".";
  if (st.type === "stop" && st.place.crowds) t += "\n\nA tip: " + st.place.crowds;
  if (next2 && next2.type === "stop" && next2.place.along) t += `\n\nOn the way, keep an eye out for ${next2.place.name}.`;
  return t;
}
function dirLink(from, to, leg) {
  const ll = p => p.lat.toFixed(5) + "," + p.lng.toFixed(5);
  return `https://www.google.com/maps/dir/?api=1&origin=${ll(from)}&destination=${ll(to)}&travelmode=${leg && leg.mode === "walk" ? "walking" : "transit"}`;
}
function renderTour(d) {
  const city = cityFor(d);
  if (!city) return `${dayHeading(d)}${busyBlock()}${errBlock()}${needsCity(d)}`;
  refillIfNeeded(d, city); if (!d.selected) d.selected = defaultSelection(city, trip.style, d);
  const plan = buildPlan(d);
  if (!plan || plan.error) return `${dayHeading(d)}<div class="card empty"><p>${esc(plan ? plan.error : "Set up your day first.")}</p><button class="btn" data-goto="trip">Edit this day</button></div>`;
  const steps = tourSteps(plan), T = curTour(d);
  T.i = Math.min(T.i, steps.length - 1);
  const st = steps[T.i], prev = steps[T.i - 1], nxt = steps[T.i + 1];
  const stopsOnly = steps.filter(x => x.type === "stop" && !x.place.along);
  const stopNo = st.type === "stop" && !st.place.along ? stopsOnly.indexOf(steps.find((x, k) => k === T.i)) + 1 : 0;
  const pct = Math.round(T.i / Math.max(1, steps.length - 1) * 100);
  const portBar = d.type === "port" ? `<div class="banner warn tourship"><span>All aboard <b>${esc(d.allAboard)}</b>. Be back at the ship by <b>${fmt(plan.endBy)}</b>.</span><span id="tourShip"></span></div>` : "";
  const head = `<div class="tourhead"><div><div class="eyebrow">Tour · ${esc(dayName(d))} · ${esc(fmtDate(d.date))}</div>
      <div class="tourbar"><i style="width:${pct}%"></i></div><div class="lede" style="font-size:.85rem">Step ${T.i + 1} of ${steps.length} · planned for ${fmt(st.time)}</div></div>
    <button class="btn ghost small" data-act="tourexit">Exit tour</button></div>${portBar}${followBar()}`;
  let body = "";
  if (T.phase === "walk" && st.type !== "start") {
    const nm = stepName(st);
    body = `<div class="tourcard">
      <div class="eyebrow">${st.leg && st.leg.mode === "walk" ? "Walk to" : "Head to"}</div>
      <h2 class="tourtitle">${esc(nm)}</h2>
      ${st.leg ? `<p class="tourleg ${st.leg.mode}">${legIcon(st.leg.mode)}<span>${esc(st.leg.how)} · ${dur(st.leg.min)} · ${distTxt(st.leg.km)}</span></p>` : ""}
      <p class="lede">Arrive around ${fmt(st.time)}.</p>
      ${nxt && nxt.type === "stop" && nxt.place.along ? `<div class="banner">On the way: <b>${esc(nxt.place.name)}</b>. ${esc(nxt.place.lookFor[0] || "")}</div>` : ""}
      <div class="audio"><button class="btn ghost" data-play="walk:${T.i}" data-label="▶ Hear what's next">▶ Hear what's next</button><span class="state" aria-live="polite"></span></div>
      <div class="actions tourmain">
        ${prev && prev.place ? `<a class="btn ghost" href="${dirLink(prev.place, st.place, st.leg)}" target="_blank" rel="noopener">Directions</a>` : ""}
        <button class="btn bigbtn" data-act="tourhere">I'm here</button>
      </div></div>`;
  } else if (st.type === "start") {
    body = `<div class="tourcard"><div class="eyebrow">Good morning</div><h2 class="tourtitle">${esc(st.label)}</h2>
      <p class="lede">Today: ${stopsOnly.length} stops${plan.meals.length ? ", " + plan.meals.map(m => esc(m.name)).join(" and ") + " to eat" : ""}, about ${distTxt(plan.walkKm)} on foot. ${d.type === "port" ? "I'll keep an eye on the time so you're back aboard early." : "I'll keep you on time."}</p>
      <ol class="tourlist">${stopsOnly.map(x => `<li>${fmt(x.time)} · ${esc(x.place.name)}</li>`).join("")}</ol>
      <div class="audio"><button class="btn ghost" data-play="intro:${d.id}" data-label="▶ Hear today's plan">▶ Hear today's plan</button><span class="state" aria-live="polite"></span></div>
      <div class="actions tourmain"><button class="btn bigbtn" data-act="tournext">Let's go</button></div></div>`;
  } else if (st.type === "end") {
    const rated = steps.filter(x => x.type === "stop" && ((trip.journal || {})[jKey(x.place)] || {}).rating).length;
    body = `<div class="tourcard"><div class="eyebrow">That's the day</div><h2 class="tourtitle">${esc(st.label)}</h2>
      <p class="lede">You saw ${stopsOnly.length} stops. ${rated ? "You rated " + rated + " of them." : "Rate them in your journal while it's fresh."}</p>
      <div class="actions tourmain"><button class="btn" data-goto="journal">${trip.days[trip.active + 1] ? "Open the journal" : "Make my memory video"}</button>${trip.days[trip.active + 1] ? `<button class="btn ghost" data-act="tourtomorrow">Next day: ${esc(trip.days[trip.active + 1].destination)}</button>` : ""}</div></div>`;
  } else if (st.type === "meal") {
    const r = st.place;
    body = `<div class="tourcard"><div class="eyebrow">${esc(st.meal.label)} · ${dur(st.meal.len)}</div><h2 class="tourtitle">${esc(r.name)}</h2>
      <p class="lede">${[r.cuisine, r.price, r.generic ? "" : r.kind === "local" ? "a local spot" : "popular with visitors"].filter(Boolean).map(esc).join(" · ")}</p>${r.crowdTop || r.crowd ? `<p class="badges">${crowdBadge(r)}<span class="crowd">${esc(crowdLine(r))}</span></p>` : ""}<p>${esc(r.why)}</p>
      ${r.generic ? "" : eatStars(r.name, cityFor(day()), "How was it? Rate it")}
      ${r.alts && r.alts.length ? `<p class="lede">Want something different, or it's full? Try ${r.alts.map(a => esc(a.name) + (a.cuisine && a.cuisine !== "Restaurant" ? " (" + esc(a.cuisine) + ")" : "")).join(" or ")}.</p>` : ""}
      <p class="timeleft" id="tourLeft"></p>
      <div class="actions tourmain"><button class="btn bigbtn" data-act="tournext">${nxt ? "Next: " + esc(stepName(nxt)) : "Finish"}</button></div></div>`;
  } else if (st.type === "fixed") {
    body = `<div class="tourcard"><div class="eyebrow">Quick stop</div><h2 class="tourtitle">${esc(st.place.name)}</h2><p class="lede">About ${dur(st.place.minutes)}.</p>
      <div class="actions tourmain"><button class="btn bigbtn" data-act="tournext">Done, next: ${esc(nxt ? stepName(nxt) : "")}</button></div></div>`;
  } else {
    const s = st.place;
    const found = T.found || [];
    body = `<div class="tourcard">
      <div class="stophead"><span class="stopnum big">${s.along ? "•" : stopNo}</span><div><h2 class="tourtitle">${esc(s.name)}</h2><p class="stopmeta">${esc(String(s.category || "").replace(/^\w/, c => c.toUpperCase()))}</p></div></div>
      <p class="timeleft" id="tourLeft"></p>
${quietOn(s) ? `<p class="banner quiet" role="note">🤫 <span><b>Quiet place.</b> The story is below to read. Audio plays only after you confirm your earbuds are in.</span></p>` : ""}
      <div class="audio"><button class="btn bigplay" data-play="${esc(s.id)}" data-label="${quietOn(s) ? "🎧 Play with earbuds" : "▶ Play the story"}">${quietOn(s) ? "🎧 Play with earbuds" : "▶ Play the story"}</button><span class="state" aria-live="polite"></span></div>
      ${s.lookFor && s.lookFor.length ? `<div class="field"><span class="eyebrow">Can you find these?</span>
        <div class="finds">${s.lookFor.map((x, k) => `<button class="find ${found.includes(k) ? "on" : ""}" data-find="${k}"><span class="fk">${found.includes(k) ? "✓" : k + 1}</span><span>${esc(x)}</span></button>`).join("")}</div></div>` : ""}
      ${picksBlock(s)}
      ${s.photoTip ? `<p class="phototip"><b>Photo spot:</b> ${esc(s.photoTip)}</p>` : ""}
      <details class="more" id="story-${esc(s.id)}" ${quietOn(s) ? "open" : ""}><summary>Read the story</summary><div class="guidetext" style="margin-top:8px">${paras(unitText(s.guide))}</div></details>
      ${aiReady() || askState.pending.length ? askBlock(s) : ""}
      ${journalBlock(s)}
      <div class="actions tourmain"><button class="btn bigbtn" data-act="tournext">${nxt ? "Next: " + esc(stepName(nxt)) : "Finish"}</button></div>
    </div>`;
  }
  return head + body;
}
function introText(d, plan) {
  const steps = tourSteps(plan).filter(x => x.type === "stop" && !x.place.along);
  return `Welcome to ${plan.city.city}. Here's the plan for today. ` + steps.map((x, k) => (k === steps.length - 1 && k ? "and finally, " : "") + x.place.name).join(", ") + "." +
    (plan.meals.length ? ` We'll stop for ${plan.meals.map(m => m.name).join(" and ")} along the way.` : "") +
    (d.type === "port" ? ` All aboard is at ${d.allAboard}, and I'll have you back at the ship by ${fmt(plan.endBy)}.` : ` We should be done around ${fmt(plan.end)}.`) + " Whenever you're ready, let's go.";
}
function tickTour() {
  const d = day(); if (view !== "tour" || !trip.tour) return;
  const plan = buildPlan(d); if (!plan || plan.error) return;
  const steps = tourSteps(plan), T = trip.tour, st = steps[T.i]; if (!st) return;
  const el = document.getElementById("tourLeft");
  if (el && T.phase === "at" && (st.type === "stop" || st.type === "meal")) {
    const planned = st.type === "meal" ? st.meal.len : st.place.minutes;
    const left = planned - (Date.now() - T.arrivedAt) / 60000;
    const nxt = steps[T.i + 1];
    el.textContent = left > 0 ? `About ${Math.ceil(left)} min left here${nxt ? ", then " + stepName(nxt) : ""}.` : `Time to move on${nxt ? " to " + stepName(nxt) : ""}.`;
    el.className = "timeleft" + (left <= 10 ? " soon" : "");
    if (left <= 10 && left > 0 && T.nudged < 1 && planned > 15) { T.nudged = 1; save(); if (!speakingId) speakText("nudge", `About ten more minutes here${nxt ? ", then " + stepName(nxt) : ""}.`); }
    if (left <= 0 && T.nudged < 2) { T.nudged = 2; save(); if (!speakingId) speakText("nudge", `Time to move on${nxt ? ". Next up, " + stepName(nxt) : ""}.`); }
  }
  const sh = document.getElementById("tourShip");
  if (sh && d.type === "port" && d.date === todayISO()) {
    const now = new Date().getHours() * 60 + new Date().getMinutes();
    const from = st.place || plan.w.head[0], port = plan.w.tail[plan.w.tail.length - 1];
    const leaveBy = plan.endBy - travel(from, port).min;
    sh.textContent = now >= leaveBy ? " Head back now." : ` Leave by ${fmt(leaveBy)} (${dur(leaveBy - now)}).`;
  }
}
// ---------- Follow me: GPS moves the tour along ----------
let geoWatch = null, geoPoll = null, geoState = "off", geoPos = null, geoMsg = "";
const ARRIVE_KM = 0.06;
function arriveHere(auto) {
  stopAudio(); const T = trip.tour; if (!T) return;
  T.phase = "at"; T.arrivedAt = Date.now(); T.nudged = 0; T.auto = !!auto; save(); render(); window.scrollTo(0, 0);
  const st = tourSteps(buildPlan(day()))[T.i];
  if (st && st.type === "stop") speakSite(st.place);
}
function toggleFollow() {
  if (geoWatch != null) { if (keepAwake) keepAwake.allowSleep().catch(() => {}); try { navigator.geolocation.clearWatch(geoWatch); } catch (e) {} geoWatch = null; clearInterval(geoPoll); geoPoll = null; geoState = "off"; geoMsg = ""; renderGuideOnly(); return; }
  if (!navigator.geolocation) { geoState = "unavailable"; geoMsg = "This device or window can't share your location. Tap I'm here when you arrive."; renderGuideOnly(); return; }
  geoState = "asking"; geoMsg = "Asking for your location…"; renderGuideOnly();
  if (keepAwake) keepAwake.keepAwake().catch(() => {});
  try {
    geoWatch = navigator.geolocation.watchPosition(onGeo, err => {
      if (err && err.code !== 1 && geoWatch != null) { if (geoState !== "on") { geoMsg = "Looking for a GPS signal… You can tap I'm here meanwhile."; renderGuideOnly(); } return; }
      if (geoWatch != null) try { navigator.geolocation.clearWatch(geoWatch); } catch (e) {}
      geoWatch = null; clearInterval(geoPoll); geoPoll = null; geoState = "unavailable";
      geoMsg = err && err.code === 1 ? "Location is blocked in this window. The full Kairoute app will ask for it. For now, tap I'm here when you arrive." : "Couldn't find your location. Tap I'm here when you arrive.";
      renderGuideOnly();
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 });
    // Some browsers throttle watchPosition; a gentle poll keeps arrival detection moving.
    geoPoll = setInterval(() => { if (geoWatch != null) navigator.geolocation.getCurrentPosition(onGeo, () => {}, { enableHighAccuracy: true, maximumAge: 4000, timeout: 10000 }); }, 5000);
  } catch (e) { geoState = "unavailable"; geoMsg = "Location isn't available here. Tap I'm here when you arrive."; renderGuideOnly(); }
}
function onGeo(pos) {
  geoPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
  const first = geoState !== "on"; geoState = "on"; geoMsg = "";
  const T = trip.tour; if (view !== "tour" || !T) { if (first) renderGuideOnly(); return; }
  const st = tourSteps(buildPlan(day()))[T.i];
  const target = st && st.place && isFinite(st.place.lat) ? st.place : null;
  const km = target ? hav(geoPos, target) : null;
  if (T.phase === "walk" && km != null && km <= Math.max(ARRIVE_KM, Math.min(0.12, (geoPos.acc || 0) / 1000))) { arriveHere(true); return; }
  if (first) renderGuideOnly();
  const el = document.getElementById("geoDist");
  if (el && km != null) el.textContent = distTxt(km, true) + " to go";
}
function followBar() {
  const on = geoState === "on" || geoState === "asking";
  return `<div class="follow"><button class="btn ${on ? "" : "ghost"} small" data-act="follow" aria-pressed="${on}">📍 Follow me: ${on ? "On" : "Off"}</button>
    <span class="lede">${geoState === "on" ? `The story starts by itself when you arrive. <b id="geoDist"></b>` : esc(geoMsg || "Turn on to start each story automatically when you arrive.")}</span></div>`;
}
function startTourTimer() { if (tourTimer) clearInterval(tourTimer); tickTour(); tourTimer = setInterval(tickTour, 15000); }
function renderGuideOnly() { if (view === "guide" || view === "tour") { const y = window.scrollY; render(); window.scrollTo(0, y); } }

// ---------- Events ----------
function readForm() {
  const d = day(), g = id => document.getElementById(id), v = id => (g(id) ? g(id).value : null);
  if (!g("dayForm")) return;
  const tt = g("f-triptext"); if (tt) tripText = tt.value;
  const newDest = v("f-dest").trim(), newEvent = g("f-event") ? v("f-event").trim() : d.event;
  if (newDest !== d.destination || newEvent !== d.event) {
    d.destination = newDest; d.event = newEvent;
    const key = keyOf(newDest) + (newEvent ? "|" + keyOf(newEvent) : "");
    d.cityKey = cities[key] ? key : (!newEvent && cities[keyOf(newDest)] ? keyOf(newDest) : null);
    d.selected = null; d.pointIdx = 0;
  }
  d.date = v("f-date") || d.date;
  if (g("f-time")) d.time = v("f-time");
  if (g("f-parr")) d.portArrive = v("f-parr");
  if (g("f-aboard")) d.allAboard = v("f-aboard");
  if (g("f-start")) d.startTime = v("f-start") || "09:00";
  if (g("f-hours")) d.hours = Math.max(1, Math.min(14, parseFloat(v("f-hours")) || 8));
  if (g("f-point")) d.pointIdx = +v("f-point");
  if (g("f-tender")) d.tender = g("f-tender").checked;
  if (g("f-return")) d.returnToStart = g("f-return").checked;
  if (g("f-along")) d.alongWay = g("f-along").checked;
  if (g("f-fill")) d.fillTime = g("f-fill").checked;
  if (g("f-lodging")) {
    const lk = cityKeyFor(d) || keyOf(d.destination);
    const sel = v("f-lodging"), cur = trip.lodging[lk] || {};
    if (sel === "custom") {
      const nm = g("f-lname") ? v("f-lname").trim() : (cur.name || "");
      trip.lodging[lk] = { idx: "custom", name: nm, ll: cur.idx === "custom" && cur.name === nm ? cur.ll : null };
    } else trip.lodging[lk] = { idx: +sel };
  }
}
function edited() { trip.sample = false; }
// Open a trip on today's day when the trip is under way.
function jumpToToday(t) { const i = t.days.findIndex(x => x.date === todayISO()); if (i >= 0) t.active = i; }
document.addEventListener("click", e => {
  const t = e.target.closest("button, a"); if (!t) return;
  if (t.dataset.view) { if (view === "trip") readForm(); view = t.dataset.view; aiError = ""; save(); render(); window.scrollTo(0, 0); return; }
  if (t.dataset.day != null && !t.dataset.act) { if (view === "trip") readForm(); trip.active = +t.dataset.day; aiError = ""; cdPreview = null; cdWhere = null; cdSpoken = false; stopAudio(); save(); render();
    if (t.classList.contains("itrow") && innerWidth < 800) { const f = document.getElementById("dayForm"); if (f) f.scrollIntoView({ block: "start" }); }
    return; }
  if (t.dataset.jump) { const el = document.getElementById("stop-" + t.dataset.jump); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (t.dataset.goto) { view = t.dataset.goto; render(); window.scrollTo(0, 0); return; }
  if (t.dataset.act === "savekey") { const k = ((document.getElementById("aikey") || {}).value || "").trim(); if (k) { try { localStorage.setItem(KEY_STORE, k); } catch (e) {} sample = webSample; } render(); return; }
  if (t.dataset.act === "clearkey") { try { localStorage.removeItem(KEY_STORE); } catch (e) {} if (!(cl && cl.use)) sample = freeAI ? freeSample : null; render(); return; }
  if (t.dataset.hrs) { readForm(); day().hours = +t.dataset.hrs; day().selected = null; edited(); save(); render(); return; }
  if (t.dataset.mode) { readForm(); day().mode = t.dataset.mode; day().pointIdx = 0; edited(); save(); render(); return; }
  if (t.dataset.style) { readForm(); trip.style = t.dataset.style; save(); render(); return; }
  if (t.dataset.chg) { const el = document.getElementById("chgText"); if (el) { el.value = t.dataset.chg; changeText = t.dataset.chg; el.focus(); } return; }
  if (t.dataset.filter) { siteFilter = t.dataset.filter; render(); return; }
  if (t.dataset.open) { view = "guide"; render(); const el = document.getElementById("stop-" + t.dataset.open); if (el) el.scrollIntoView({ block: "start" }); return; }
  if (t.dataset.find != null) { const T = trip.tour; const k = +t.dataset.find; T.found = T.found || []; T.found = T.found.includes(k) ? T.found.filter(x => x !== k) : [...T.found, k]; save(); renderGuideOnly(); return; }
  if (t.dataset.play) {
    const id = t.dataset.play, plan = buildPlan(day());
    const qs = allSites(cityFor(day())).find(x => x.id === id);
    if (qs && quietOn(qs) && speakingId !== id && Date.now() > earbudsOkUntil) {
      if (!window.confirm("Quiet place: earbuds in?\n\nTap OK to play through your earbuds, or Cancel to read the story instead.")) { const st = document.getElementById("story-" + id); if (st) { st.open = true; st.scrollIntoView({ block: "start", behavior: "smooth" }); } return; }
      earbudsOkUntil = Date.now() + 45 * 60000; // asked once, then trusted for the next 45 minutes
    }
    if (id.startsWith("walk:")) { const steps = tourSteps(plan), i = +id.slice(5); speakText(id, walkText(steps[i], steps[i + 1])); return; }
    if (id.startsWith("intro:")) { speakText(id, introText(day(), plan)); return; }
    const s = allSites(cityFor(day())).find(x => x.id === id); if (s) speakSite(s); return;
  }
  if (t.dataset.deeper) { const city = cityFor(day()); const s = allSites(city).find(x => x.id === t.dataset.deeper); if (s) goDeeper(s, city); return; }
  if (t.dataset.app) { if (t.dataset.app === "guide" && speakingId === "voice-sample") stopAudio(); appSet[t.dataset.app] = t.dataset.v; saveAppSet(); render(); return; }
  if (t.dataset.pref) {
    const k = t.dataset.pref, v = t.dataset.v; trip.prefs = P();
    if (k === "interest") trip.prefs.interests = trip.prefs.interests.includes(v) ? trip.prefs.interests.filter(x => x !== v) : [...trip.prefs.interests, v];
    else { trip.prefs[k] = v; if (k === "access" && (v === "limited" || v === "wheelchair")) trip.prefs.walk = "low"; }
    save(); render(); return;
  }
  if (t.dataset.wimgdel != null) { readWiz(); wiz.images.splice(+t.dataset.wimgdel, 1); render(); return; }
  if (t.dataset.mic) { listenAsk(t.dataset.mic); return; }
  if (t.dataset.playAns) { const pa = allSites(cityFor(day())).find(x => x.id === t.dataset.playAns); if (pa && quietOn(pa) && speakingId !== "ans:" + t.dataset.playAns && Date.now() > earbudsOkUntil) { if (!window.confirm("Quiet place: earbuds in?")) return; earbudsOkUntil = Date.now() + 45 * 60000; }
    const a = answers[t.dataset.playAns]; if (a && a.text) speakText("ans:" + t.dataset.playAns, a.text); renderGuideOnly(); return; }
  if (t.dataset.act === "asknoticeok") { askNotice = ""; render(); return; }
  if (t.dataset.act === "coachnext") { coachStep++; if (coachStep >= COACH.length) coachDone(); render(); return; }
  if (t.dataset.act === "coachskip") { coachDone(); render(); return; }
  if (t.dataset.act === "coachreplay") { coachStep = 0; view = "lobby"; render(); return; }
  if (t.dataset.act === "earlystart") { const d = day(); d.startTime = t.dataset.v; d.hours = +t.dataset.h; save(); render(); return; }
  if (t.dataset.act === "suggestok") { suggestMsg = ""; render(); return; }
  if (t.dataset.act === "daytitle") { dayRenaming = day().id; render(); const el = document.getElementById("dayTitleInput"); if (el) { el.focus(); el.select(); } return; }
  if (t.dataset.act === "daytitlesave") { const v = ((document.getElementById("dayTitleInput") || {}).value || "").trim().slice(0, 60), d = day(); if (v && v !== dayAuto(d)) d.title = v; else delete d.title; dayRenaming = null; save(); render(); return; }
  if (t.dataset.act === "daytitleauto") { delete day().title; dayRenaming = null; save(); render(); return; }
  if (t.dataset.act === "daytitlecancel") { dayRenaming = null; render(); return; }
  if (t.dataset.act === "syncstart") { syncStart(); return; }
  if (t.dataset.act === "syncfromlobby") { view = "settings"; render(); window.scrollTo(0, 0); return; }
  if (t.dataset.act === "syncjoin") { syncJoin = true; syncNote = ""; render(); const el = document.getElementById("sync-code"); if (el) el.focus(); return; }
  if (t.dataset.act === "synclink") { syncLink(); return; }
  if (t.dataset.act === "syncnow") { syncNote = ""; (async () => { await syncPull(); await syncPush(); render(); })(); return; }
  if (t.dataset.act === "syncoff") { syncSet(null); syncNote = "Sync is off on this device. Your trips stay here."; render(); return; }
  if (t.dataset.act === "bookopen") { const b = (day().booked || {})[t.dataset.meal]; bookForm = { label: t.dataset.meal, q: b ? b.name : "", time: b ? b.time : t.dataset.meal === "Lunch" ? "12:30" : "19:30", results: [] }; render(); const el = document.getElementById("bookform"); if (el) { el.scrollIntoView({ block: "center" }); const i = document.getElementById("bk-name"); if (i) i.focus(); } return; }
  if (t.dataset.act === "booksearch") { bookSearch(); return; }
  if (t.dataset.act === "bookcancel") { bookForm = null; render(); return; }
  if (t.dataset.bookpick != null && bookForm) { const y = bookForm.results[+t.dataset.bookpick], d = day(), tm = ((document.getElementById("bk-time") || {}).value || bookForm.time);
    if (y) { d.booked = Object.assign({}, d.booked, { [bookForm.label]: { name: y.name, lat: y.lat, lng: y.lng, kind: y.kind || "", addr: y.addr || "", time: /^\d\d:\d\d$/.test(tm) ? tm : bookForm.time } }); bookForm = null; trip.tour = null; save(); render(); } return; }
  if (t.dataset.act === "bookremove") { const d = day(); if (d.booked) { delete d.booked[t.dataset.meal]; if (!Object.keys(d.booked).length) delete d.booked; } trip.tour = null; save(); render(); return; }
  if (t.dataset.act === "memmake") { makeMemoryVideo(); return; }
  if (t.dataset.act === "memsave") { memSave(); return; }
  if (t.dataset.act === "memshare") { memShare(); return; }
  if (t.dataset.eatrate) { const y = window.scrollY; rateEat(t.dataset.eatname, +t.dataset.eatrate); render(); window.scrollTo(0, y); return; }
  if (t.dataset.rate) { const n = +t.dataset.rate; jUpdate(t.dataset.sid, j => { j.rating = j.rating === n ? 0 : n; }); renderGuideOnly(); return; }
  if (t.dataset.delphoto != null) { const i = +t.dataset.delphoto; jUpdate(t.dataset.sid, j => { j.photos.splice(i, 1); }); renderGuideOnly(); return; }
  if (t.dataset.translate) { const s = allSites(cityFor(day())).find(x => x.id === t.dataset.translate); if (s) translateSite(s); return; }
  if (t.dataset.phrase != null) { const c = cityFor(day()); const p = c && c.basics && c.basics.phrases[+t.dataset.phrase]; if (p) speakPhrase(p); return; }
  if (t.dataset.wz) {
    readWiz(); const k = t.dataset.wz, v = t.dataset.v;
    if (k === "interest") wiz.interests = wiz.interests.includes(v) ? wiz.interests.filter(x => x !== v) : [...wiz.interests, v];
    else { wiz[k] = v; if (k === "access" && (v === "limited" || v === "wheelchair")) wiz.walk = "low"; if (k === "access" && v === "kids" && !wiz.interests.includes("kids")) wiz.interests.push("kids"); }
    render(); return;
  }
  const act = t.dataset.act;
  if (act === "gotit") { trip.bannerSeen = true; save(); render(); return; }
  if (act === "lobby" || act === "settings" || act === "privacy" || act === "terms") { if (view === "trip") readForm(); stopAudio(); save(); view = act; resetAsk = false; aiError = ""; render(); window.scrollTo(0, 0); return; }
  if (act === "continue") { jumpToToday(trip); view = trip.tour && trip.tour.dayId === day().id && cityFor(day()) ? "tour" : "plan"; render(); window.scrollTo(0, 0); return; }
  if (act === "film" || act === "filmreplay") { stopAudio(); playFilm(false); return; }
  if (act === "filmclose") { closeFilm(); return; }
  if (act === "mytrips") { if (view === "trip") readForm(); save(); view = "trips"; aiError = ""; render(); window.scrollTo(0, 0); return; }
  if (act === "voicetry") {
    if (speakingId === "voice-sample") { stopAudio(); render(); return; }
    stopAudio(); const g = GUIDES.find(x => x[0] === guideVoice().speaker);
    speakLines("voice-sample", [`Hi, I'm ${g[1]}. Let's walk over to the old harbor together. Look up, just there, see that worn stone lion above the gate? It has been watching ships come and go for almost six hundred years.`], null);
    setTimeout(render, 300); return;
  }
  if (act === "newtrip") { wiz = { step: 0, text: "", name: "", style: trip.style || "mix", interests: [], pace: "moderate", walk: "medium", hotels: "", travelers: "", access: "none", party: 2, lang: "English", voice: "buttery", cruiseLine: "", ship: "" }; view = "wizard"; aiError = ""; render(); return; }
  if (act === "wizmore") { readWiz(); if (!wiz.text.trim() && !(wiz.images || []).length) { aiError = "Describe your trip first, even roughly."; render(); return; } aiError = ""; wiz.step = 1; render(); window.scrollTo(0, 0); return; }
  if (act === "wizback") { readWiz(); wiz.step--; render(); return; }
  if (act === "wizcancel") { wiz = null; view = "lobby"; render(); window.scrollTo(0, 0); return; }
  if (act === "opentrip") { save(); const x = library.find(y => y.id === t.dataset.id); if (x) { trip = x.trip; if (!trip.prefs) trip.prefs = defaultPrefs(); jumpToToday(trip); view = trip.tour && trip.tour.dayId === day().id && cityFor(day()) ? "tour" : "plan"; save(); render(); window.scrollTo(0, 0); } return; }
  if (act === "loadsample") { save(); trip = sampleTrip(); view = "plan"; save(); render(); return; }
  if (act === "rename") { renameId = t.dataset.id; render(); const el = document.getElementById("renameInput"); if (el) { el.focus(); el.select(); } return; }
  if (act === "renamesave") { doRename(t.dataset.id); return; }
  if (act === "renamecancel") { renameId = null; render(); return; }
  if (act === "delask") { delAsk = t.dataset.id; render(); return; }
  if (act === "delno") { delAsk = null; render(); return; }
  if (act === "deltrip") {
    delAsk = null; library = library.filter(y => y.id !== t.dataset.id);
    try { const tb = tombs(); tb[t.dataset.id] = Date.now(); localStorage.setItem(TOMB_KEY, JSON.stringify(tb)); } catch (e) {}
    if (t.dataset.id === trip.id) { const nx = library.filter(y => !y.trip.archived).sort((a, b) => b.updated - a.updated)[0]; trip = nx ? nx.trip : Object.assign(sampleTrip(), { placeholder: true }); }
    save(); render(); return;
  }
  if (act === "archive" || act === "restore") {
    const id = t.dataset.id, x = library.find(y => y.id === id); const tt = id === trip.id ? trip : x && x.trip; if (!tt) return;
    tt.archived = act === "archive"; if (x) x.trip = tt;
    if (act === "restore") { save(); trip = tt; }
    else if (id === trip.id) { save(); const nx = library.filter(y => !y.trip.archived && y.id !== id).sort((a, b) => b.updated - a.updated)[0]; if (nx) trip = nx.trip; }
    save(); render(); return;
  }
  if (act === "fixstops") { fixStops(); return; }
  if (act === "changetrip") { changeTrip(); return; }
  if (act === "suggesttour") {
    // Visible right away: the button says it's working, then the plan shows what changed on each day.
    t.disabled = true; t.textContent = "Planning your days…";
    setTimeout(() => {
      const city = cityFor(day()), days = trip.days.filter(o => city && cityFor(o) === city), before = days.map(o => (o.selected || []).slice());
      const n = suggestTour(day()), names = id => (allSites(city).find(x => x.id === id) || {}).name;
      const lines = days.map((o, i) => { const add = o.selected.filter(id => !before[i].includes(id)).map(names).filter(Boolean), rem = before[i].filter(id => !o.selected.includes(id)).map(names).filter(Boolean);
        return `${fmtDow(o.date)} ${fmtDate(o.date)}: ${o.selected.length} stops` + (add.length ? `, added ${add.join(", ")}` : "") + (rem.length ? `, moved or dropped ${rem.join(", ")}` : "") + (add.length || rem.length ? "" : ", already the best fit"); });
      suggestMsg = n ? `Done: ${n} stops planned across ${days.length} day${days.length > 1 ? "s" : ""}. ` + lines.join(". ") + "." : "Nothing fit in the time you have. Try adding hours on the Trip tab.";
      save(); render();
      const b = document.getElementById("suggestNote"); if (b) b.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 40);
    return;
  }
  if (act === "freshpicks") { const d = day(), city = cityFor(d); if (city) { d.selected = []; d.selected = defaultSelection(city, trip.style, d); save(); render(); } return; }
  if (act === "addplace") { const v = (document.getElementById("addPlace") || {}).value || ""; if (v.trim()) addPlaces(day(), v.trim()); return; }
  if (act === "moretrips") { addPlaces(day(), ""); return; }
  if (act === "picks") { const city = cityFor(day()); const s = city && allSites(city).find(x => x.id === t.dataset.id); if (s) getPicks(s, city); return; }
  if (act === "gen") { generateCity(day()); return; }
  if (act === "cdpreview") {
    if (cdPreview != null) { cdPreview = null; render(); return; }
    const plan = buildPlan(day()); if (!plan || plan.error) return;
    cdPreview = plan.start + Math.round((plan.endBy - plan.start) * 0.85); cdSpoken = false; render(); return;
  }
  if (act === "pdf") { readForm(); exportPDF(); return; }
  if (act === "copytrip") {
    const text = itineraryText();
    const box = document.getElementById("copyBox");
    const done = ok => { if (box) box.innerHTML = ok ? `<p class="ai-note">Copied. Paste it into a message or email to share with your group.</p>` : `<textarea readonly style="min-height:200px">${esc(text)}</textarea><p class="ai-note">Select the text above and copy it.</p>`; };
    try { navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); } catch (e) { done(false); }
    return;
  }
  if (act === "genall") { readForm(); buildAllGuides(); return; }
  if (act === "geo") { readForm(); geocodeLodging(day()); return; }
  if (act === "parsetrip") { readForm(); buildTripFromText(tripText); return; }
  if (act === "toplan") { view = "plan"; save(); render(); window.scrollTo(0, 0); return; }
  if (act === "addday") {
    readForm();
    const cur = day();
    const nd = newDay({ destination: cur.destination, date: cur.date ? addDays(cur.date, 1) : "", type: "land", cityKey: cur.cityKey });
    trip.days.splice(trip.active + 1, 0, nd); trip.active++; edited(); save(); render();
    return;
  }
  if (act === "tourstart") { const d = day(); if (!trip.tour || trip.tour.dayId !== d.id) trip.tour = null; curTour(d); view = "tour"; save(); render(); window.scrollTo(0, 0); return; }
  if (act === "tourexit") { stopAudio(); view = "plan"; render(); window.scrollTo(0, 0); return; }
  if (act === "tournext") {
    stopAudio(); const T = trip.tour; T.i++; T.phase = "walk"; T.found = []; T.nudged = 0; save(); render(); window.scrollTo(0, 0);
    const plan = buildPlan(day()); const steps = tourSteps(plan); const st = steps[T.i];
    if (st && st.type !== "end") speakText("walk:" + T.i, walkText(st, steps[T.i + 1]));
    else if (st) { T.phase = "at"; save(); render(); }
    return;
  }
  if (act === "tourhere") { arriveHere(); return; }
  if (act === "follow") { toggleFollow(); return; }
  if (act === "tourtomorrow") { stopAudio(); trip.active++; trip.tour = null; view = "plan"; save(); render(); window.scrollTo(0, 0); return; }
  if (act === "reset") { resetAsk = true; render(); return; }
  if (act === "resetno") { resetAsk = false; render(); return; }
  if (act === "resetyes") {
    try { ["wayside.trip2", "wayside.cities", "wayside.library", "wayside.trip", "wayside.touched"].forEach(k => localStorage.removeItem(k)); } catch (e) {}
    for (const k in cities) if (k !== "barcelona") delete cities[k];
    library = []; trip = sampleTrip(); resetAsk = false; view = "settings"; save(); render(); window.scrollTo(0, 0); return;
  }
  if (act === "prevday" || act === "nextday") {
    if (view === "trip") readForm();
    trip.active = Math.max(0, Math.min(trip.days.length - 1, trip.active + (act === "nextday" ? 1 : -1)));
    aiError = ""; cdPreview = null; cdWhere = null; stopAudio(); save(); render(); return;
  }
  if (act === "addport") {
    readForm();
    const cur = day();
    const nd = newDay({ destination: "", date: cur.date ? addDays(cur.date, 1) : "", type: "port", portArrive: "08:00", allAboard: "17:00" });
    trip.days.splice(trip.active + 1, 0, nd); trip.active++; view = "trip"; edited(); save(); render();
    const el = document.getElementById("f-dest"); if (el) { el.focus(); el.placeholder = "Port name, e.g. Kotor"; }
    return;
  }
  if (act === "delday") { if (trip.days.length < 2) return; trip.days.splice(trip.active, 1); trip.active = Math.min(trip.active, trip.days.length - 1); edited(); save(); render(); return; }
});
document.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset && t.dataset.site) {
    const d = day(), id = t.dataset.site;
    d.selected = d.selected || [];
    if (t.checked) { if (!d.selected.includes(id)) d.selected.push(id); } else d.selected = d.selected.filter(x => x !== id);
    save(); render(); return;
  }
  if (t.id === "chg-img" && t.files && t.files[0]) {
    changeText = ((document.getElementById("chgText") || {}).value || "");
    shrinkImage(t.files[0], 1600).then(url => { const bin = atob(url.split(",")[1]), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); changeImgs.push({ url, blob: new Blob([arr], { type: "image/jpeg" }) }); render(); });
    return;
  }
  if (t.id === "w-img" && t.files && t.files[0]) {
    readWiz(); const f = t.files[0];
    shrinkImage(f, 1600).then(url => { const bin = atob(url.split(",")[1]), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); wiz.images = wiz.images || []; wiz.images.push({ url, blob: new Blob([arr], { type: "image/jpeg" }) }); render(); })
      .catch(() => { aiError = "That photo couldn't be read. Try a JPEG or PNG."; render(); });
    return;
  }
  if (t.id === "f-rain") { day().rain = t.checked; save(); render(); return; }
  if (t.id === "cdWhere") { cdWhere = t.value; tickCountdown(); return; }
  if (t.id === "p-lang") { trip.prefs = P(); trip.prefs.lang = t.value; save(); render(); return; }
  if (t.id === "p-party") { trip.prefs = P(); trip.prefs.party = Math.max(1, Math.min(20, +t.value || 2)); save(); render(); return; }
  if (t.dataset && t.dataset.note) { jUpdate(t.dataset.note, j => { j.note = t.value; }); return; }
  if (t.dataset && t.dataset.photo && t.files && t.files[0]) {
    const sid = t.dataset.photo;
    shrinkImage(t.files[0]).then(url => { jUpdate(sid, j => { j.photos = j.photos || []; if (j.photos.length < 4) j.photos.push(url); }); renderGuideOnly(); })
      .catch(() => { aiError = "That photo couldn't be read. Try a JPEG or PNG."; render(); });
    return;
  }
  if (t.id === "f-type") { readForm(); const d = day(); d.type = t.value; d.pointIdx = 0; if (d.type === "departure" && d.mode === "ship") d.mode = "flight"; d.selected = null; edited(); save(); render(); return; }
  if (["f-point", "f-return", "f-along", "f-fill", "f-lodging", "f-tender", "f-date"].includes(t.id)) { readForm(); edited(); save(); render(); return; }
  if (t.closest && t.closest("#dayForm")) { readForm(); edited(); save(); }
});
document.addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target;
  if (f.id === "dayForm") {
    readForm(); edited(); save();
    const d = day();
    if (!d.destination) { aiError = "Type a city first."; render(); return; }
    if (cityFor(d)) { view = "plan"; aiError = ""; render(); window.scrollTo(0, 0); }
    else if (aiReady()) generateCity(d);
    else { render(); }
    return;
  }
  if (f.id === "wizForm") {
    readWiz();
    if (wiz.step === 0 && !wiz.text.trim() && !(wiz.images || []).length) { aiError = "Describe your trip first, even roughly."; render(); return; }
    aiError = "";
    if (e.submitter && e.submitter.dataset.next) { wiz.step++; render(); window.scrollTo(0, 0); return; }
    buildTripFromText((wiz.text || "(see the attached photos)") + (wiz.travelers ? "\nTravelers: " + wiz.travelers : ""));
    return;
  }
  if (f.dataset.ask) {
    const city = cityFor(day()); const s = f.dataset.ask === "day" ? null : allSites(city).find(x => x.id === f.dataset.ask);
    if (s || f.dataset.ask === "day") askGuide(s, city, f.querySelector("input").value);
  }
});

render();
})();
