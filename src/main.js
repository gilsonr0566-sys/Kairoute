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
const langCode = n => (LANGS.find(x => x[0] === n) || LANGS[0])[1];
const VOICES = [["buttery", "Warm"], ["airy", "Light"], ["glassy", "Clear"], ["rounded", "Deep"]];
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
  if (savedCities) Object.assign(cities, savedCities, { barcelona: SAMPLE_CITY });
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
const WALK_LIMIT = { low: 0.8, medium: 2.0, high: 3.2 };
const PACE = { relaxed: 1.2, moderate: 1, packed: 0.85 };
function travel(a, b) {
  const d = hav(a, b);
  const lim = WALK_LIMIT[(trip.prefs && trip.prefs.walk) || "medium"];
  const speed = trip.prefs && trip.prefs.walk === "low" ? 3.6 : 4.5;
  if (d <= lim) return { mode: "walk", how: "Walk", km: d * 1.3, min: Math.max(2, Math.round(d * 1.3 / speed * 60)) };
  if (d <= 6) return { mode: "ride", how: "Metro, bus or taxi", km: d * 1.3, min: Math.round(10 + d * 1.3 / 22 * 60) };
  if (d <= 15) return { mode: "ride", how: "Taxi or rideshare", km: d * 1.3, min: Math.round(10 + d * 1.3 / 25 * 60) };
  return { mode: "ride", how: "Train or car", km: d * 1.25, min: Math.round(20 + d * 1.25 / 60 * 60) };
}
const tmin = (a, b) => (a && b ? travel(a, b).min : 0);
function allSites(city) { return [...(city.sites || []), ...(city.farther || [])]; }
// Sights already planned on another day in the same city, by site id -> that day.
function plannedElsewhere(d) {
  const k = cityKeyFor(d), out = {}; if (!k) return out;
  trip.days.forEach(o => { if (o !== d && cityKeyFor(o) === k && o.selected) o.selected.forEach(id => { if (!out[id]) out[id] = o; }); });
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
function defaultSelection(city, style, d) {
  const taken = d ? plannedElsewhere(d) : {};
  const s = city.sites.filter(x => !x.quick && !taken[x.id]);
  const picks = s.filter(x => x.mustSee).map(x => x.id);
  const ints = ((trip.prefs && trip.prefs.interests) || []).map(x => INTEREST_WORDS[x] || []).flat();
  const score = x => ints.reduce((a, w) => a + ((x.category + " " + x.summary).toLowerCase().includes(w) ? 1 : 0), 0) + (style === "mix" || x.kind === style ? 0.5 : 0);
  const extra = s.filter(x => !x.mustSee).sort((a, b) => score(b) - score(a)).slice(0, 2).map(x => x.id);
  const carried = d ? carryOver(d).filter(id => !taken[id]) : [];
  let sel = [...new Set([...carried, ...picks, ...extra])];
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
  return list[L.idx] || list[0] || null;
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
    w.notes.push(`${m.label} arrives ${d.time}. We allow ${dur(m.clear)} to get ${d.mode === "flight" ? "through passport control and baggage" : d.mode === "ship" ? "off the ship with your luggage" : "off the train"}.`);
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
  const rs = (city.restaurants || []).filter(r => !used.has(r.name));
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
    const pool = cands.length ? cands : (budget < fixed + 60 ? order : []);
    if (!pool.length) break;
    let best = null, bestVal = -1;
    for (const c of pool) {
      const save = total(order) - total(order.filter(x => x !== c));
      const val = save / (c.kind === style ? 1.4 : 1);
      if (val > bestVal) { bestVal = val; best = c; }
    }
    dropped.push(best);
    order = optimize(order.filter(x => x !== best), O, Z);
  }
  // Quick sights along the way
  const along = [];
  if (d.alongWay) {
    const used = new Set(order.map(s => s.id));
    const quick = (city.sites || []).filter(s => s.quick && !used.has(s.id));
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
  // Timeline
  const items = [{ type: "start", place: w.head[0], time: w.start, label: w.startLabel }];
  let clock = w.start, prev = w.head[0];
  const go = (p, type, extra) => {
    const leg = travel(prev, p);
    items.push({ type: "travel", leg, time: clock }); clock += leg.min;
    items.push(Object.assign({ type, place: p, time: clock }, extra || {})); clock += p.minutes || 0; prev = p;
  };
  w.head.slice(1).forEach(p => go(p, "fixed"));
  const usedR = new Set(), meals = [];
  let mi = 0;
  const tryMeal = next => {
    while (mi < MEALS.length) {
      const m = MEALS[mi];
      if (clock > m.to) { mi++; continue; }
      if (w.endBy < m.from + 45) return;
      const arriveNext = next ? clock + tmin(prev, next) + (next.minutes || 0) : clock;
      if (clock >= m.from || (next && arriveNext > m.to) || !next) {
        if (clock < m.from - 60 && next) return;
        const r = pickRestaurant(city, prev, next, style, usedR);
        if (!r) { mi++; return; }
        usedR.add(r.name);
        const leg = travel(prev, r);
        items.push({ type: "travel", leg, time: clock }); clock += leg.min;
        const at = Math.max(clock, m.from);
        items.push({ type: "meal", meal: m, place: r, time: at }); clock = at + m.len;
        meals.push(r); prev = r; mi++;
        return;
      }
      return;
    }
  };
  order.forEach(s => { tryMeal(s); go(s, "stop"); });
  tryMeal(w.tail[0] || null);
  w.tail.forEach((p, i) => go(Object.assign({}, p, { minutes: p.fixed ? p.minutes : 0 }), i === w.tail.length - 1 ? "end" : "fixed", i === w.tail.length - 1 ? { label: w.endLabel } : {}));
  if (!w.tail.length) items.push({ type: "end", place: null, time: clock, label: "Day done" });
  const walkKm = items.filter(i => i.type === "travel" && i.leg.mode === "walk").reduce((a, i) => a + i.leg.km, 0);
  const stops = items.filter(i => i.type === "stop");
  return { city, w, items, stops, dropped, along, meals, swaps, closedToday, start: w.start, endBy: w.endBy, end: clock, walkKm, over: clock > w.endBy + 5, tight: budget < fixed + 45 };
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
  return JSON.parse(text.slice(a, b + 1));
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
    cost: Math.max(0, num(s.cost) || 0), indoor: !!s.indoor, access: String(s.access || "")
  };
}
function cleanCity(c, dest) {
  const num = numV;
  const okLL = p => p && isFinite(num(p.lat)) && isFinite(num(p.lng));
  const site = normSite;
  const starts = {};
  for (const k of ["cruise", "airport", "station", "hotel", "point"]) starts[k] = ((c.starts && c.starts[k]) || []).filter(okLL).map(p => ({ name: String(p.name), lat: num(p.lat), lng: num(p.lng), note: p.note ? String(p.note) : "" }));
  return {
    city: String(c.city || dest), country: String(c.country || ""), ai: true, starts,
    sites: (c.sites || []).filter(okLL).map((s, i) => site(s, i)),
    farther: (c.farther || []).filter(okLL).map((s, i) => Object.assign(site(s, i, "-far"), { far: true })),
    basics: c.basics ? {
      currency: String(c.basics.currency || ""), symbol: String(c.basics.symbol || ""), language: String(c.basics.language || ""), langCode: String(c.basics.langCode || ""),
      tipping: String(c.basics.tipping || ""), safety: String(c.basics.safety || ""), emergency: String(c.basics.emergency || ""), plugs: String(c.basics.plugs || ""), water: String(c.basics.water || ""),
      phrases: (c.basics.phrases || []).filter(p => p && p.local).slice(0, 10).map(p => ({ local: String(p.local), say: String(p.say || ""), meaning: String(p.meaning || ""), lang: String(p.lang || c.basics.langCode || "") }))
    } : null,
    lang: P().lang,
    gettingAround: (c.gettingAround || []).filter(x => x && x.tip).slice(0, 5).map(x => ({ mode: String(x.mode || ""), tip: String(x.tip) })),
    restaurants: (c.restaurants || []).filter(okLL).map(r => ({ name: String(r.name), lat: num(r.lat), lng: num(r.lng), kind: r.kind === "local" ? "local" : "touristy", cuisine: String(r.cuisine || ""), price: String(r.price || ""), why: String(r.why || "") }))
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
async function generateCity(d, quiet) {
  if (!aiReady()) return false;
  const label = d.destination;
  if (!quiet) { busy = { text: "Asking your guide about " + label + "…" }; aiError = ""; render(); }
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
    const { text } = await sample(prompt, { modelTier: "default", onText: ({ text }) => { if (busy) { busy.text = (quiet ? busy.prefix || "" : "") + "Writing the " + label + " guide… " + Math.min(99, Math.round(text.length / 260)) + "%"; updateBusy(); } } });
    const c = cleanCity(parseJSON(text), label);
    if (!c.sites.length) throw new Error("empty");
    const key = keyOf(label) + (d.event ? "|" + keyOf(d.event) : "");
    cities[key] = c;
    trip.days.forEach(x => { if (keyOf(x.destination) === keyOf(label) && !x.event === !d.event) { x.cityKey = key; x.pointIdx = 0; if (!x.selected) x.selected = defaultSelection(c, trip.style, x); } });
    save();
    if (!quiet) { busy = null; view = "sites"; render(); }
    return true;
  } catch (e) {
    if (!quiet) { busy = null; aiError = aiErrorText(e, "The guide for " + label); render(); }
    return false;
  }
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
async function askGuide(site, city, q) {
  if (!aiReady() || !q.trim()) return;
  const k = site.id; answers[k] = { q, text: "", loading: true }; renderGuideOnly();
  try {
    await sample(`You are an expert local tour guide in ${city.city}. A traveler at ${site.name} asks: "${q}". Answer in under 120 words, friendly and specific. If it's about opening hours, prices or tickets, give typical information and remind them to check the official site.${faithNote()} No markdown.`, {
      modelTier: "quick", cache: false, onText: ({ text }) => { answers[k].text = text; const el = document.getElementById("ans-" + k); if (el) el.textContent = text; }
    });
    answers[k].loading = false; renderGuideOnly();
  } catch (e) { answers[k] = { q, text: "", loading: false, error: "No answer came back. Try asking again." }; renderGuideOnly(); }
}

// ---------- Audio guide ----------
function stopAudio() {
  if (tts) { try { tts.stop(); } catch (e) {} }
  if (window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending)) try { speechSynthesis.cancel(); } catch (e) {}
  if (nativeTTS) { nativeRun++; try { nativeTTS.stop(); } catch (e) {} }
  speakingId = null; ttsState = "idle"; updateAudioUI();
}
function speakSite(site) {
  if (speakingId === site.id) { stopAudio(); return; }
  stopAudio();
  const tr = translations[site.id + "|" + P().lang];
  const parts = tr && tr.text && !tr.loading ? [`${site.name}.`, tr.text] : [`${site.name}.`, site.guide];
  if (!(tr && tr.text) && site.lookFor && site.lookFor.length) parts.push("While you're here, look for these. " + site.lookFor.map((x, i) => (i + 1) + ". " + x).join(" "));
  if (!(tr && tr.text) && site.picks && site.picks.length) parts.push("And here are your guide's insider picks. " + site.picks.map(x => x.t).join(" "));
  if (deeper[site.id] && deeper[site.id].text && !deeper[site.id].loading) parts.push(deeper[site.id].text);
  const lines = [];
  parts.join("\n\n").split(/\n\s*\n/).forEach(p => { p = p.trim(); while (p.length > 1800) { const cut = p.lastIndexOf(". ", 1800) + 1 || 1800; lines.push(p.slice(0, cut)); p = p.slice(cut).trim(); } if (p) lines.push(p); });
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
function speakLines(id, lines, lc) {
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
  ttsState = "speaking"; updateAudioUI();
  try {
    for (const text of lines) {
      if (run !== nativeRun || speakingId !== id) return;
      await nativeTTS.speak({ text, lang: lc || "en-US", rate: 0.95, pitch: 1.0, volume: 1.0, category: "playback" });
    }
    if (run === nativeRun && speakingId === id) { speakingId = null; ttsState = "idle"; updateAudioUI(); }
  } catch (e) { if (run === nativeRun && speakingId === id) { speakingId = null; audioMsg = "The device voice couldn't start. Check that a text-to-speech voice is installed in Android settings."; updateAudioUI(); } }
}
let audioMsg = "";
const IN_CLAUDE = /claude\.ai|claudeusercontent|anthropic/.test(location.hostname);
const NO_AUDIO = IN_CLAUDE ? "Sound can't play inside the Claude app on phones and tablets. Open Kairoute's website in Chrome instead. The story is written out below meanwhile."
  : "This browser didn't start the voice. Check that the volume is up and the phone isn't on silent, then tap play again. The story is written out below meanwhile.";
function speakBrowser(id, lines, lc) {
  const synth = window.speechSynthesis;
  if (!synth || !window.SpeechSynthesisUtterance) { speakingId = null; audioMsg = NO_AUDIO; updateAudioUI(); return; }
  // Short chunks: some browsers stop long utterances after about 15 seconds.
  const chunks = [];
  lines.forEach(l => (l.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [l]).forEach(sn => {
    sn = sn.trim(); if (!sn) return;
    const last = chunks[chunks.length - 1];
    if (last && (last + " " + sn).length < 220) chunks[chunks.length - 1] = last + " " + sn; else chunks.push(sn);
  }));
  let started = false;
  try {
    chunks.forEach((t, i) => {
      const u = new SpeechSynthesisUtterance(t); u.rate = 0.98; if (lc) u.lang = lc;
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
function updateAudioUI() {
  document.querySelectorAll("[data-play]").forEach(b => {
    const on = b.dataset.play === speakingId;
    b.innerHTML = on ? "■ Stop audio" : (b.dataset.label || "▶ Play audio guide");
    b.setAttribute("aria-pressed", on ? "true" : "false");
    const st = b.parentElement.querySelector(".state");
    if (st) st.textContent = on ? (ttsState === "starting" ? "Starting…" : "Playing") : (audioMsg || "");
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
function render() {
  renderView();
  if (openFolds.size) document.querySelectorAll("#view details").forEach(el => { const sm = el.querySelector("summary"); if (sm && openFolds.has(view + "|" + sm.textContent.trim())) el.open = true; });
}
function renderView() {
  ensureBuiltins();
  if (view === "trips") view = "lobby";
  const full = !!FULL_VIEWS[view];
  document.querySelector("header.top").hidden = full;
  $view.className = full ? "full" : "wrap";
  if (full) { if (tourTimer) { clearInterval(tourTimer); tourTimer = null; } stopCountdownIfAny(); $view.innerHTML = FULL_VIEWS[view](); return; }
  document.getElementById("aiStatus").textContent = aiReady() ? "AI guide on" : "Your own guide, any city";
  document.getElementById("dayChips").innerHTML = trip.days.map((x, i) =>
    `<button class="daychip" data-day="${i}" aria-pressed="${i === trip.active}"><b>${esc(fmtDate(x.date) || "Day " + (i + 1))}</b> · ${esc(x.type === "sea" ? "At sea" : x.destination || "New day")}</button>`).join("");
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
function dayHeading(d) {
  return `<div><div class="eyebrow">${esc(fmtDow(d.date))} ${esc(fmtDate(d.date))} · ${esc(typeInfo(d.type).short)}</div><h2>${esc(d.type === "sea" ? "At sea" : d.destination)}</h2></div>`;
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
let appSet = { theme: "system", text: "standard" };
try { Object.assign(appSet, JSON.parse(localStorage.getItem("kairoute.app") || "{}")); } catch (e) {}
function applyAppSet() {
  const r = document.documentElement;
  if (appSet.theme === "system") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", appSet.theme);
  if (appSet.text === "large") r.setAttribute("data-text", "large"); else r.removeAttribute("data-text");
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
    <div class="sechead"><h2>Planned trips</h2><span class="lede">${list.length - archived.length} saved on this device</span></div>
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
  <div class="card"><h3>Display</h3>
    <div class="field"><span class="lbl">Appearance</span>${seg("theme", [["system", "Match my device"], ["light", "Light"], ["dark", "Dark"]])}</div>
    <div class="field"><span class="lbl">Text size</span>${seg("text", [["standard", "Standard"], ["large", "Large"]])}</div>
  </div>
  ${settingsCard().replace('<details class="card more">', '<details class="card more" open>')}
  <div class="card"><h3>AI guide</h3><p class="lede">${aiReady() ? "On. Kairoute uses Claude to build city guides, find your hotel, read itinerary photos and answer your questions." : "Off. Add your AI key below to build guides for every city and find your hotel. Barcelona works without it."}</p>
    ${cl && cl.use ? "" : `<div class="field"><label for="aikey">Anthropic API key</label><div class="ask"><input type="password" id="aikey" autocomplete="off" placeholder="${getKey() ? "Saved on this device" : "sk-ant-…"}"><button type="button" class="btn small" data-act="savekey">Save</button>${getKey() ? `<button type="button" class="btn ghost small" data-act="clearkey">Remove</button>` : ""}</div><span class="hint">Stored only on this device and sent only to Anthropic. Get one at console.anthropic.com under API keys.</span></div>`}</div>
  <div class="card"><div><h3>Your data</h3><p class="lede">Trips, guides and journal entries are saved only on this device. Starting over clears all of it and loads the example trip again.</p></div>
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
    <div class="field"><span class="lbl">Guide voice</span><div class="seg" role="group" aria-label="Voice">${VOICES.map(([k, l]) => `<button type="button" data-wz="voice" data-v="${k}" aria-pressed="${w.voice === k}">${l}</button>`).join("")}</div></div>
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
    ${entries.length ? `<div class="sitelist">${entries.map(j => `<div class="card"><div><div class="eyebrow">${esc(fmtDate(j.date))} · ${esc(j.city || "")}</div><h3>${esc(j.name || "")}</h3></div>
      ${j.rating ? `<div class="stars static">${"★".repeat(j.rating)}<span style="opacity:.25">${"★".repeat(5 - j.rating)}</span></div>` : ""}
      ${j.note ? `<p>${esc(j.note)}</p>` : ""}
      ${j.photos && j.photos.length ? `<div class="photos">${j.photos.map(p => `<div class="ph"><img src="${p}" alt="Photo of ${esc(j.name || "")}"></div>`).join("")}</div>` : ""}
    </div>`).join("")}</div>` : `<div class="card empty"><p>Nothing yet. Open the Guide tab on any day, rate a stop or add a photo.</p><button class="btn" data-goto="guide">Open the guide</button></div>`}`;
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
      <div>${renameId === trip.id ? renameBox(trip.id, trip.name || tripName(trip)) : `<div class="setrow"><h2>${esc(trip.name || "Your trip")}</h2><button class="btn ghost small" data-act="rename" data-id="${esc(trip.id)}">Rename</button></div>`}<p class="lede">${trip.days.length} days, ${trip.days.filter(x => x.type === "port").length} cruise stops. Tap a day to edit it.</p></div>
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
      <p class="sum">${esc(s.summary)}</p>
      ${s.far && s.travel ? `<p class="travelnote">Getting there: ${esc(s.travel)}</p>` : ""}
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
  ${city.ai ? `<p class="ai-note">Written by your AI guide. Check opening hours before you go.</p>` : city.builtin ? `<p class="ai-note">Kairoute guide. Hours and prices are typical: check before you go.</p>` : ""}
  <div class="filters seg" role="group" aria-label="Filter">
    ${[["all", "All"], ["must", "Must-sees"], ["touristy", "Famous"], ["local", "Local favorites"]].map(([k, l]) => `<button type="button" data-filter="${k}" aria-pressed="${f === k}">${l}</button>`).join("")}
  </div>
  ${timeMeter(plan)}
  <div class="actions" style="justify-content:flex-end"><button class="btn ghost small" data-act="freshpicks">Suggest fresh picks for this day</button></div>
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
      legs += `<line x1="${X(lastPlace).toFixed(1)}" y1="${Y(lastPlace).toFixed(1)}" x2="${X(it.place).toFixed(1)}" y2="${Y(it.place).toFixed(1)}" stroke="var(--route)" stroke-width="${ride ? 3 : 5}" stroke-linecap="round"${ride ? ' stroke-dasharray="7 6"' : ""}/>`;
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
  const kmPx = sc / 111.32; const km = [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100].find(v => v * kmPx > 70) || 100;
  const bar = km * kmPx;
  let grid = "";
  for (let gx = 0; gx <= W; gx += 40) grid += `<line x1="${gx}" y1="0" x2="${gx}" y2="${H}" stroke="var(--line)" stroke-width="1" opacity=".5"/>`;
  for (let gy = 0; gy <= H; gy += 40) grid += `<line x1="0" y1="${gy}" x2="${W}" y2="${gy}" stroke="var(--line)" stroke-width="1" opacity=".5"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Route diagram for the day" font-family="Atkinson Hyperlegible, system-ui, sans-serif">
    <rect width="${W}" height="${H}" fill="var(--card)"/>${grid}${legs}${marks}
    <g transform="translate(${(W - 24 - bar).toFixed(1)} ${H - 22})"><line x1="0" y1="0" x2="${bar.toFixed(1)}" y2="0" stroke="var(--ink)" stroke-width="3"/><text x="${(bar / 2).toFixed(1)}" y="-7" text-anchor="middle" font-size="11" fill="var(--muted)">${km} km</text></g>
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
function renderPlan(d) {
  const city = cityFor(d);
  if (!city) return `${dayHeading(d)}${busyBlock()}${errBlock()}${needsCity(d)}`;
  refillIfNeeded(d, city); if (!d.selected) d.selected = defaultSelection(city, trip.style, d);
  const plan = buildPlan(d);
  if (plan.error) return `${dayHeading(d)}<div class="card empty"><p>${esc(plan.error)}</p><button class="btn" data-goto="trip">Edit this day</button></div>`;
  let n = 0;
  const rows = plan.items.map((it, idx) => {
    const cls = `tl ${idx === 0 ? "first" : ""} ${idx === plan.items.length - 1 ? "last" : ""}`;
    if (it.type === "start") return `<div class="${cls}"><div class="time">${fmt(it.time)}</div><div class="rail"><div class="dot start">S</div></div><div class="what"><div class="nm">${esc(it.label)}</div>${it.place.note ? `<div class="sub">${esc(it.place.note)}</div>` : ""}</div></div>`;
    if (it.type === "travel") {
      const m = it.leg.mode;
      return `<div class="tl leg ${m}"><div class="time"></div><div class="rail"></div><div class="what">${it.leg.km < 0.1 ? "Next door" : it.leg.how + " · " + dur(it.leg.min) + " · " + it.leg.km.toFixed(1) + " km"}</div></div>`;
    }
    if (it.type === "fixed") return `<div class="${cls}"><div class="time">${fmt(it.time)}</div><div class="rail"><div class="dot fixed">H</div></div><div class="what"><div class="nm">${esc(it.place.name)}</div><div class="sub">${dur(it.place.minutes)}</div></div></div>`;
    if (it.type === "meal") {
      const r = it.place;
      return `<div class="${cls}"><div class="time">${fmt(it.time)}</div><div class="rail"><div class="dot meal">${it.meal.label[0]}</div></div><div class="what">
        <div class="nm">${it.meal.label}: ${esc(r.name)}</div><div class="sub">${esc(r.cuisine)} · ${esc(r.price)} · ${r.kind === "local" ? "Local favorite" : "Popular with visitors"} · ${dur(it.meal.len)}</div>
        <div class="mealbox"><span>${esc(r.why)}</span>${r.alts && r.alts.length ? `<span class="alt">Also nearby: ${r.alts.map(a => esc(a.name)).join(", ")}</span>` : ""}</div></div></div>`;
    }
    if (it.type === "stop") {
      const s = it.place;
      if (s.along) return `<div class="${cls}"><div class="time">${fmt(it.time)}</div><div class="rail"><div class="dot quick"></div></div><div class="what"><div class="nm">On the way: ${esc(s.name)}</div><div class="sub">${esc(s.lookFor[0] || s.summary)}</div><button class="link" data-open="${esc(s.id)}">Hear about it</button></div></div>`;
      n++;
      return `<div class="${cls}"><div class="time">${fmt(it.time)}</div><div class="rail"><div class="dot">${n}</div></div><div class="what">
        <div class="nm">${esc(s.name)}</div><div class="sub">${dur(s.minutes)} · ${esc(s.category)}${s.mustSee ? " · Must-see" : ""}${s.far && s.travel ? " · " + esc(s.travel) : ""}</div>
        <button class="link" data-open="${esc(s.id)}">Open the guide</button></div></div>`;
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
  <div class="windowbar"><span>Free from <b>${fmt(plan.start)}</b></span><span>${d.type === "port" ? "Back at ship by" : d.type === "departure" || d.type === "embark" ? "At the terminal by" : "Done by"} <b>${fmt(plan.endBy)}</b></span><span>${dur(plan.endBy - plan.start)} in all</span></div>
  ${plan.w.notes.map(t => `<p class="lede">${esc(t)}</p>`).join("")}
  ${d.estimated ? `<div class="banner warn">These port times are estimated. Check them against your cruise documents.</div>` : ""}
  <div class="actions planacts"><button class="btn bigbtn" data-act="tourstart" style="background:var(--meal)">▶ Start the tour</button><button class="btn ghost" data-goto="sites">Change stops</button><a class="btn ghost" href="${gmapsLink(plan)}" target="_blank" rel="noopener">Directions in Google Maps</a></div>
  <label class="check"><input type="checkbox" id="f-rain" ${d.rain ? "checked" : ""}><span><b>Rain expected</b> · swap outdoor stops for indoor ones</span></label>
  ${plan.swaps.length ? `<div class="banner">Because of rain: ${plan.swaps.map(([a, b]) => esc(a.name) + " → " + esc(b.name)).join(", ")}.</div>` : ""}
  ${plan.closedToday.length ? `<div class="banner warn" role="alert">${plan.closedToday.map(s => `${esc(s.name)}: ${esc(s.closed.toLowerCase())}`).join(". ")}, and you're there on a ${esc(fmtDow(d.date))}. Swap it with Change stops.</div>` : ""}
  ${countdownCard(d, plan)}
  ${plan.over ? `<div class="banner warn" role="alert">This plan runs ${dur(plan.end - plan.endBy)} past ${fmt(plan.endBy)}. Remove a stop with Change stops, or change the times.</div>` : ""}
  ${plan.endBy - plan.start < 90 ? `<div class="banner warn">There isn't much time today, so keep it close: a coffee and one nearby sight at most.</div>` : ""}
  <div class="plangrid"><div class="left">
  <div class="summary">
    <div class="stat"><b>${stopsN}</b><span>stops</span></div>
    <div class="stat"><b>${plan.along.length}</b><span>on the way</span></div>
    <div class="stat"><b>${plan.walkKm.toFixed(1)} km</b><span>walking</span></div>
    <div class="stat"><b>${fmt(plan.end)}</b><span>${d.type === "port" ? "back on board" : "finish"}</span></div>
  </div>
  <div class="mapbox">${mapSVG(plan)}
    <div class="maplegend"><span><i></i>Walk</span><span><i class="dash"></i>Taxi or transit</span><span style="color:var(--meal)">● Meal</span><span style="color:var(--must)">■ Hotel</span><span>● On the way</span></div>
  </div>
  ${plan.dropped.length ? `<div class="banner warn dropped"><span>Didn't fit today: <b>${plan.dropped.map(s => esc(s.name)).join(", ")}</b>. Change the times on Trip, or swap them in with Change stops.</span></div>` : ""}
  <details class="more goodtoknow"><summary>Good to know today: getting around, costs, local words</summary>
  ${gettingAround(city, plan)}
  ${budgetCard(plan)}
  ${basicsCard(city)}
  </details>
  <p class="footnote">Times are estimates using a relaxed walking pace and typical taxi times. Check opening hours and book timed tickets for the big sights.</p>
  </div><div class="right"><div class="card"><div class="timeline">${rows}</div></div></div></div>`;
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
    <div class="postcard">${postcardSVG(s)}<div class="num">${s.along ? "•" : num}</div><div class="cat">${esc(s.category || (s.along ? "On the way" : "Stop"))}</div></div>
    <div class="stopbody">
      <div class="head"><h3>${esc(s.name)}</h3><p class="lede">${esc(s.summary)}</p></div>
      <div class="audio"><button class="btn" data-play="${esc(s.id)}">▶ Play audio guide</button><span class="state" aria-live="polite"></span></div>
      ${s.lookFor && s.lookFor.length ? `<div class="field"><span class="eyebrow">What to look for</span><ol class="lookfor">${s.lookFor.map(x => `<li><span>${esc(x)}</span></li>`).join("")}</ol></div>` : ""}
      ${picksBlock(s)}
      ${s.photoTip ? `<p class="phototip"><b>Photo spot:</b> ${esc(s.photoTip)} <a href="${photos}" target="_blank" rel="noopener">See photos of it</a></p>` : ""}
      ${s.hours || s.tickets || s.crowds ? `<div class="before"><span class="eyebrow">Before you go</span>
        ${s.hours ? `<div><b>Hours</b><span>${esc(s.hours)}${s.closed ? " · " + esc(s.closed) : ""}</span></div>` : ""}
        ${s.tickets ? `<div><b>Tickets</b><span>${esc(s.tickets)}</span></div>` : ""}
        ${s.crowds ? `<div><b>Crowds</b><span>${esc(s.crowds)}</span></div>` : ""}
        ${s.access && P().access !== "none" ? `<div><b>Access</b><span>${esc(s.access)}</span></div>` : ""}
      </div>` : ""}
      <div class="guidetext">${paras(s.guide)}</div>
      ${(() => { const tr = translations[s.id + "|" + P().lang]; const need = P().lang !== "English" && city.lang !== P().lang;
        return need ? (tr ? `<div class="guidetext" id="tr-${esc(s.id)}">${tr.text ? paras(tr.text) : `<p class="ai-note"><span class="spinner"></span> Translating…</p>`}</div>${tr.error ? `<p class="ai-note">${esc(tr.error)}</p>` : ""}` : (ready ? `<div><button class="btn ghost small" data-translate="${esc(s.id)}">Read it in ${esc(P().lang)}</button></div>` : "")) : ""; })()}
      ${dp ? `<div class="guidetext" id="deep-${esc(s.id)}">${dp.text ? paras(dp.text) : `<p class="ai-note"><span class="spinner"></span> Your guide is thinking…</p>`}</div>${dp.error ? `<p class="ai-note">${esc(dp.error)}</p>` : ""}` : ""}
      ${ready ? `<div class="actions">${!dp || dp.error ? `<button class="btn ghost small" data-deeper="${esc(s.id)}">Tell me more</button>` : ""}</div>
      <form class="ask" data-ask="${esc(s.id)}"><input type="text" id="ask-${esc(s.id)}" placeholder="Ask the guide about this place" aria-label="Ask the guide about ${esc(s.name)}"><button class="btn small" type="submit">Ask</button></form>
      ${an ? `<div class="answer"><b>${esc(an.q)}</b>\n<span id="ans-${esc(s.id)}">${esc(an.text || (an.loading ? "Thinking…" : an.error || ""))}</span></div>` : ""}` : `<p class="ai-note">Turn on the AI guide in Settings to ask the guide questions and hear more.</p>`}
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
  return `${dayHeading(d)}<p class="lede">Every stop's story, in route order. For a guided walk through the day, use Tour mode.</p>
    <div class="actions"><button class="btn" data-act="tourstart" style="background:var(--meal)">▶ Start the tour</button></div>
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
  if (!city) return `${dayHeading(d)}${needsCity(d)}`;
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
  const head = `<div class="tourhead"><div><div class="eyebrow">Tour · ${esc(city.city)} · ${esc(fmtDate(d.date))}</div>
      <div class="tourbar"><i style="width:${pct}%"></i></div><div class="lede" style="font-size:.85rem">Step ${T.i + 1} of ${steps.length} · planned for ${fmt(st.time)}</div></div>
    <button class="btn ghost small" data-act="tourexit">Exit tour</button></div>${portBar}${followBar()}`;
  let body = "";
  if (T.phase === "walk" && st.type !== "start") {
    const nm = stepName(st);
    body = `<div class="tourcard">
      <div class="eyebrow">${st.leg && st.leg.mode === "walk" ? "Walk to" : "Head to"}</div>
      <h2 class="tourtitle">${esc(nm)}</h2>
      ${st.leg ? `<p class="tourleg">${esc(st.leg.how)} · ${dur(st.leg.min)} · ${st.leg.km.toFixed(1)} km</p>` : ""}
      <p class="lede">Arrive around ${fmt(st.time)}.</p>
      ${nxt && nxt.type === "stop" && nxt.place.along ? `<div class="banner">On the way: <b>${esc(nxt.place.name)}</b>. ${esc(nxt.place.lookFor[0] || "")}</div>` : ""}
      <div class="audio"><button class="btn ghost" data-play="walk:${T.i}" data-label="▶ Hear what's next">▶ Hear what's next</button><span class="state" aria-live="polite"></span></div>
      <div class="actions tourmain">
        ${prev && prev.place ? `<a class="btn ghost" href="${dirLink(prev.place, st.place, st.leg)}" target="_blank" rel="noopener">Directions</a>` : ""}
        <button class="btn bigbtn" data-act="tourhere">I'm here</button>
      </div></div>`;
  } else if (st.type === "start") {
    body = `<div class="tourcard"><div class="eyebrow">Good morning</div><h2 class="tourtitle">${esc(st.label)}</h2>
      <p class="lede">Today: ${stopsOnly.length} stops${plan.meals.length ? ", " + plan.meals.map(m => esc(m.name)).join(" and ") + " to eat" : ""}, about ${plan.walkKm.toFixed(1)} km on foot. ${d.type === "port" ? "I'll keep an eye on the time so you're back aboard early." : "I'll keep you on time."}</p>
      <ol class="tourlist">${stopsOnly.map(x => `<li>${fmt(x.time)} · ${esc(x.place.name)}</li>`).join("")}</ol>
      <div class="audio"><button class="btn ghost" data-play="intro:${d.id}" data-label="▶ Hear today's plan">▶ Hear today's plan</button><span class="state" aria-live="polite"></span></div>
      <div class="actions tourmain"><button class="btn bigbtn" data-act="tournext">Let's go</button></div></div>`;
  } else if (st.type === "end") {
    const rated = steps.filter(x => x.type === "stop" && ((trip.journal || {})[jKey(x.place)] || {}).rating).length;
    body = `<div class="tourcard"><div class="eyebrow">That's the day</div><h2 class="tourtitle">${esc(st.label)}</h2>
      <p class="lede">You saw ${stopsOnly.length} stops. ${rated ? "You rated " + rated + " of them." : "Rate them in your journal while it's fresh."}</p>
      <div class="actions tourmain"><button class="btn" data-goto="journal">Open the journal</button>${trip.days[trip.active + 1] ? `<button class="btn ghost" data-act="tourtomorrow">Next day: ${esc(trip.days[trip.active + 1].destination)}</button>` : ""}</div></div>`;
  } else if (st.type === "meal") {
    const r = st.place;
    body = `<div class="tourcard"><div class="eyebrow">${esc(st.meal.label)} · ${dur(st.meal.len)}</div><h2 class="tourtitle">${esc(r.name)}</h2>
      <p class="lede">${esc(r.cuisine)} · ${esc(r.price)} · ${r.kind === "local" ? "a local favorite" : "popular with visitors"}</p><p>${esc(r.why)}</p>
      ${r.alts && r.alts.length ? `<p class="lede">Full or closed? Try ${r.alts.map(a => esc(a.name)).join(" or ")}.</p>` : ""}
      <p class="timeleft" id="tourLeft"></p>
      <div class="actions tourmain"><button class="btn bigbtn" data-act="tournext">${nxt ? "Next: " + esc(stepName(nxt)) : "Finish"}</button></div></div>`;
  } else if (st.type === "fixed") {
    body = `<div class="tourcard"><div class="eyebrow">Quick stop</div><h2 class="tourtitle">${esc(st.place.name)}</h2><p class="lede">About ${dur(st.place.minutes)}.</p>
      <div class="actions tourmain"><button class="btn bigbtn" data-act="tournext">Done, next: ${esc(nxt ? stepName(nxt) : "")}</button></div></div>`;
  } else {
    const s = st.place;
    const found = T.found || [];
    body = `<div class="tourcard">
      <div class="postcard" style="border-radius:12px;overflow:hidden">${postcardSVG(s)}<div class="num">${s.along ? "•" : stopNo}</div><div class="cat">${esc(s.category || "")}</div></div>
      <h2 class="tourtitle">${esc(s.name)}</h2>
      <p class="timeleft" id="tourLeft"></p>
      <div class="audio"><button class="btn bigplay" data-play="${esc(s.id)}" data-label="▶ Play the story">▶ Play the story</button><span class="state" aria-live="polite"></span></div>
      ${s.lookFor && s.lookFor.length ? `<div class="field"><span class="eyebrow">Can you find these?</span>
        <div class="finds">${s.lookFor.map((x, k) => `<button class="find ${found.includes(k) ? "on" : ""}" data-find="${k}"><span class="fk">${found.includes(k) ? "✓" : k + 1}</span><span>${esc(x)}</span></button>`).join("")}</div></div>` : ""}
      ${picksBlock(s)}
      ${s.photoTip ? `<p class="phototip"><b>Photo spot:</b> ${esc(s.photoTip)}</p>` : ""}
      <details class="more"><summary>Read the story</summary><div class="guidetext" style="margin-top:8px">${paras(s.guide)}</div></details>
      ${aiReady() ? `<form class="ask" data-ask="${esc(s.id)}"><input type="text" id="ask-${esc(s.id)}" placeholder="Ask your guide anything about this place" aria-label="Ask the guide"><button class="btn small" type="submit">Ask</button></form>
        ${answers[s.id] ? `<div class="answer"><b>${esc(answers[s.id].q)}</b>\n<span id="ans-${esc(s.id)}">${esc(answers[s.id].text || (answers[s.id].loading ? "Thinking…" : answers[s.id].error || ""))}</span></div>` : ""}` : ""}
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
  if (el && km != null) el.textContent = km < 1 ? Math.round(km * 1000 / 10) * 10 + " m to go" : km.toFixed(1) + " km to go";
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
  if (t.dataset.goto) { view = t.dataset.goto; render(); window.scrollTo(0, 0); return; }
  if (t.dataset.act === "savekey") { const k = ((document.getElementById("aikey") || {}).value || "").trim(); if (k) { try { localStorage.setItem(KEY_STORE, k); } catch (e) {} sample = webSample; } render(); return; }
  if (t.dataset.act === "clearkey") { try { localStorage.removeItem(KEY_STORE); } catch (e) {} if (!(cl && cl.use)) sample = null; render(); return; }
  if (t.dataset.hrs) { readForm(); day().hours = +t.dataset.hrs; day().selected = null; edited(); save(); render(); return; }
  if (t.dataset.mode) { readForm(); day().mode = t.dataset.mode; day().pointIdx = 0; edited(); save(); render(); return; }
  if (t.dataset.style) { readForm(); trip.style = t.dataset.style; save(); render(); return; }
  if (t.dataset.chg) { const el = document.getElementById("chgText"); if (el) { el.value = t.dataset.chg; changeText = t.dataset.chg; el.focus(); } return; }
  if (t.dataset.filter) { siteFilter = t.dataset.filter; render(); return; }
  if (t.dataset.open) { view = "guide"; render(); const el = document.getElementById("stop-" + t.dataset.open); if (el) el.scrollIntoView({ block: "start" }); return; }
  if (t.dataset.find != null) { const T = trip.tour; const k = +t.dataset.find; T.found = T.found || []; T.found = T.found.includes(k) ? T.found.filter(x => x !== k) : [...T.found, k]; save(); renderGuideOnly(); return; }
  if (t.dataset.play) {
    const id = t.dataset.play, plan = buildPlan(day());
    if (id.startsWith("walk:")) { const steps = tourSteps(plan), i = +id.slice(5); speakText(id, walkText(steps[i], steps[i + 1])); return; }
    if (id.startsWith("intro:")) { speakText(id, introText(day(), plan)); return; }
    const s = allSites(cityFor(day())).find(x => x.id === id); if (s) speakSite(s); return;
  }
  if (t.dataset.deeper) { const city = cityFor(day()); const s = allSites(city).find(x => x.id === t.dataset.deeper); if (s) goDeeper(s, city); return; }
  if (t.dataset.app) { appSet[t.dataset.app] = t.dataset.v; saveAppSet(); render(); return; }
  if (t.dataset.pref) {
    const k = t.dataset.pref, v = t.dataset.v; trip.prefs = P();
    if (k === "interest") trip.prefs.interests = trip.prefs.interests.includes(v) ? trip.prefs.interests.filter(x => x !== v) : [...trip.prefs.interests, v];
    else { trip.prefs[k] = v; if (k === "access" && (v === "limited" || v === "wheelchair")) trip.prefs.walk = "low"; }
    save(); render(); return;
  }
  if (t.dataset.wimgdel != null) { readWiz(); wiz.images.splice(+t.dataset.wimgdel, 1); render(); return; }
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
  if (act === "continue") { jumpToToday(trip); view = trip.tour && trip.tour.dayId === day().id ? "tour" : "plan"; render(); window.scrollTo(0, 0); return; }
  if (act === "film" || act === "filmreplay") { stopAudio(); playFilm(false); return; }
  if (act === "filmclose") { closeFilm(); return; }
  if (act === "mytrips") { if (view === "trip") readForm(); save(); view = "trips"; aiError = ""; render(); window.scrollTo(0, 0); return; }
  if (act === "newtrip") { wiz = { step: 0, text: "", name: "", style: trip.style || "mix", interests: [], pace: "moderate", walk: "medium", hotels: "", travelers: "", access: "none", party: 2, lang: "English", voice: "buttery", cruiseLine: "", ship: "" }; view = "wizard"; aiError = ""; render(); return; }
  if (act === "wizmore") { readWiz(); if (!wiz.text.trim() && !(wiz.images || []).length) { aiError = "Describe your trip first, even roughly."; render(); return; } aiError = ""; wiz.step = 1; render(); window.scrollTo(0, 0); return; }
  if (act === "wizback") { readWiz(); wiz.step--; render(); return; }
  if (act === "wizcancel") { wiz = null; view = "lobby"; render(); window.scrollTo(0, 0); return; }
  if (act === "opentrip") { save(); const x = library.find(y => y.id === t.dataset.id); if (x) { trip = x.trip; if (!trip.prefs) trip.prefs = defaultPrefs(); jumpToToday(trip); view = trip.tour && trip.tour.dayId === day().id ? "tour" : "plan"; save(); render(); window.scrollTo(0, 0); } return; }
  if (act === "loadsample") { save(); trip = sampleTrip(); view = "plan"; save(); render(); return; }
  if (act === "rename") { renameId = t.dataset.id; render(); const el = document.getElementById("renameInput"); if (el) { el.focus(); el.select(); } return; }
  if (act === "renamesave") { doRename(t.dataset.id); return; }
  if (act === "renamecancel") { renameId = null; render(); return; }
  if (act === "delask") { delAsk = t.dataset.id; render(); return; }
  if (act === "delno") { delAsk = null; render(); return; }
  if (act === "deltrip") {
    delAsk = null; library = library.filter(y => y.id !== t.dataset.id);
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
  if (["f-point", "f-return", "f-along", "f-lodging", "f-tender", "f-date"].includes(t.id)) { readForm(); edited(); save(); render(); return; }
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
    const city = cityFor(day()); const s = allSites(city).find(x => x.id === f.dataset.ask);
    if (s) askGuide(s, city, f.querySelector("input").value);
  }
});

render();
})();
