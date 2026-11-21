// ===================== Offline trips =====================
// Planning needs the internet. The trip itself runs with none: cruise ships, foreign SIM cards and old towns
// often have no signal. "Download for offline" saves on this device, for every day the traveler can use:
//  - the day's plan and what it is built from (the city guide, real places to eat and their ratings, the last
//    weather forecast, real ride timetables), so the plan comes out the same with no signal;
//  - the street map (tiles down to street level, label fonts, map icons) and the street routes;
//  - each stop's story, written out, and the recordings of stops that have one, in the traveler's guide voice;
//  - the day's time zone, so every time and the back-to-the-ship countdown stay right;
//  - the app itself (kept by the service worker; inside the Android app it is already on the device).
// "Ready for offline" shows only when a check of the device itself finds every piece. Anything missing is named,
// with one tap to finish while the traveler still has Wi-Fi. Nothing here is written for one trip or one city.

const OFF_STORE = "kairoute.offline1";
let offRun = null;   // a download in progress: { pct, step, stop }
let offRep = null;   // the last check of this device: { key, days: [...], app, ready, todo, notes }
let offMsg = "";     // how the last download ended, in plain words
let offFailed = [], offTimer = 0, offChecking = false, offAgain = false, offLater = false;
const offOnline = () => typeof navigator === "undefined" || navigator.onLine !== false;
const offSleep = ms => new Promise(r => setTimeout(r, ms));
const offMem = () => { try { return JSON.parse(localStorage.getItem(OFF_STORE) || "{}") || {}; } catch (e) { return {}; } };
const offKeep = m => { try { localStorage.setItem(OFF_STORE, JSON.stringify(m)); } catch (e) {} };

// ---------- Free trips: only the first day ----------
// A free trip plans and uses only its first day; the rest unlock with a trip pass. (Payments come later, so a trip
// with no pass set is a full trip.) Locked days are never downloaded and never count against "Ready for offline".
function freeDay() { return trip.days.find(x => !noShore(x) && x.destination) || null; }
function dayLocked(d) { return trip.pass === "free" && d !== freeDay(); }
const offDays = () => trip.days.filter(d => !noShore(d) && d.destination && !dayLocked(d)); // days spent on board need nothing
const offLockedN = () => trip.days.filter(d => !noShore(d) && d.destination && dayLocked(d)).length;

// ---------- What one day needs ----------
function offForget() { bonusMemo = new Map(); mealMemo = new Map(); keptMemo = new Map(); eveMemo = new Map(); avoidMeals = new Set(); }
// The day's plan exactly as the Day plan builds it, and the rides it looked up on the way.
function offPlan(d) {
  const city = cityFor(d); if (!city) return { plan: null, rides: [] };
  offForget(); refillIfNeeded(d, city); if (!d.selected) seedPicks(d, city);
  transitSeen = []; let plan = null;
  try { plan = buildPlan(d); } catch (e) { plan = null; }
  seenKeep(d, plan); // what this day shows now is what it shows offline (seen-plan.js)
  const seen = transitSeen; transitSeen = null; offForget();
  // The rides the day actually takes. While planning, the app also weighs rides between many other pairs of places;
  // offline it weighs them with whatever is kept on the device (every answer is kept as it arrives), so the plan comes
  // out the same, but only the rides on the plan itself need their own timetable before the day counts as ready.
  // (Counting every ride weighed asked for thousands of timetables a day and the download never reached "Ready".)
  const legs = new Set(); let prev = null;
  if (plan && !plan.error) plan.items.forEach(it => { if (!it.place) return; if (prev) { legs.add(pairKey(prev, it.place)); legs.add(pairKey(it.place, prev)); } prev = it.place; });
  const rides = [], had = new Set(); (seen || []).forEach(r => { if (legs.has(r[1]) && !had.has(r[0])) { had.add(r[0]); rides.push(r); } });
  return { plan: plan && !plan.error ? plan : null, rides };
}
const offSites = plan => plan.items.filter(i => i.type === "stop").map(i => allSites(plan.city).find(x => x.id === i.place.id) || i.place);
// A ride is covered by its own answer, by one for nearly the same trip (both ends close by), or by a lookup that found nothing.
const offRideHas = r => !!(transitMem[r[0]] || transitMem[r[1]] || (r[2] && transitNear(r[2], r[3], r[4])));
const offRideOk = (r, tried) => offRideHas(r) || !!tried[r[0]];
// The day's time zone, from the Day plan thread's saved zone when it's there, else the city's own clock.
function offZoneOk(d) {
  try { if (typeof dayZone === "function") { const z = dayZone(d); return !!(z && z.known); } } catch (e) {}
  const c = cityFor(d); return !!(c && (c.tz || (typeof gxTz === "function" && gxTz(c))));
}
// Everything the guide says on the day, each as the lines playback uses: every stop's story (and each part of a
// big stop, and its opening), the welcome, and the "next up" line before each walk or ride.
const offParas = t => String(t || "").split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
function offSpoken(d, plan) {
  const out = [], city = plan.city;
  plan.items.forEach(it => {
    if (it.type !== "stop") return;
    const s = allSites(city).find(x => x.id === it.place.id) || it.place;
    if (s.guide) out.push(toLines(siteLines(s)));
    if (s.parts && partsOn(s).length >= 2) {
      const on = partsOn(s); s.parts.forEach((p, k) => { if (on.includes(p)) out.push(offParas(partSpeech(s, k, false))); });
      let first = null; try { first = partPlan(it.place.parts ? it.place : s, it.time).list[0]; } catch (e) {}
      out.push(offParas(partSpeech(s, first ? first.k : s.parts.indexOf(on[0]), true)));
    }
  });
  out.push(offParas(introText(d, plan)));
  const steps = tourSteps(plan); for (let i = 1; i < steps.length; i++) out.push(offParas(walkText(steps[i], steps[i + 1])));
  return out.filter(x => x.length);
}
// Recorded stories (stop-scripts.js): the files for the traveler's guide voice, kept in their own store on the device.
// The name starts with "kairoute-maps-" so no app update (this app, Beta 2 or the demo on the same address) clears it.
const VOICE_CACHE = "kairoute-maps-voice-1";
function offScripts(plan) {
  const out = [];
  plan.items.forEach(it => { if (it.type !== "stop") return; const s = allSites(plan.city).find(x => x.id === it.place.id) || it.place;
    const sc = s.scriptV && STOP_SCRIPTS.find(x => s.scriptV === x.id + x.v); if (sc && !out.includes(sc)) out.push(sc); });
  return out;
}
const offAbs = f => new URL(f, location.href).href;
async function offScriptSaved(sc) {
  let c; try { c = await caches.open(VOICE_CACHE); } catch (e) { return false; }
  for (const f of scriptFiles(sc)) if (!(await c.match(offAbs(f)))) return false;
  return true;
}
async function offSaveScript(sc) {
  const c = await caches.open(VOICE_CACHE);
  for (const f of scriptFiles(sc)) { const u = offAbs(f); if (await c.match(u)) continue; const r = await fetch(u); if (!r.ok) return false; await c.put(u, r); }
  return true;
}
// Recordings are in English; other languages, or the device-voice setting, use the device's voice.
const offNatural = () => appSet.natvoice !== "off" && (P().lang || "English") === "English";
function offDeviceVoice() {
  if (nativeTTS) return true;
  try { const lc = langCode(P().lang || "English").slice(0, 2).toLowerCase(); return speechSynthesis.getVoices().some(v => v.localService && String(v.lang).toLowerCase().startsWith(lc)); } catch (e) { return false; }
}
async function offTileHits(urls) {
  if (!urls.length) return true;
  let c; try { c = await caches.open(MAP_CACHE); } catch (e) { return false; }
  const pick = [...new Set([urls[0], urls[urls.length >> 2], urls[urls.length >> 1], urls[(urls.length * 3) >> 2], urls[urls.length - 1]])];
  for (const u of pick) if (!(await c.match(u))) return false;
  return true;
}
async function offCheckDay(d, base, mem) {
  const out = { id: d.id, i: trip.days.indexOf(d), date: d.date, place: mainPlace(d) || d.destination, parts: {}, notes: [] };
  const put = (k, ok, miss) => { out.parts[k] = { ok: !!ok, miss: ok ? "" : miss }; };
  const city = cityFor(d);
  if (!city) { put("guide", false, "the guide for " + d.destination); out.ready = false; return out; }
  const { plan, rides } = offPlan(d);
  if (!plan) { put("plan", false, "the day's plan"); out.ready = false; return out; }
  put("plan", true);
  const tried = (mem.tried || {}), noRide = rides.filter(r => !offRideOk(r, tried)).length;
  put("rides", !noRide, noRide === 1 ? "1 ride timetable" : noRide + " ride timetables");
  if (rides.some(r => !offRideHas(r) && tried[r[0]])) out.notes.push("No published timetable was found for a ride, so the plan uses the cautious taxi time.");
  // The written guide comes with the city guide, which is always kept on the device.
  const thin = offSites(plan).filter(s => !s.along && !s.quick && (!s.guide || String(s.guide).length < 40)).length;
  put("text", true); if (thin) out.thin = thin; // said once for the trip, with the places (offThinNote)
  put("zone", offZoneOk(d), "the time zone");
  // Map: the tiles for this exact route, a sample of them really in the device's map store.
  if (base && base.tpl) { const t = dayTiles(d, plan, base.tpl), done = mapSavedList()[d.id] === t.sig; put("map", done && await offTileHits(t.urls), "the street map"); }
  else put("map", false, "the street map");
  // Stories: a stop with a recorded story plays its saved recording in the guide's voice; every other story is read
  // by a voice that is on the device itself.
  const spoken = offSpoken(d, plan), scs = offNatural() ? offScripts(plan) : []; let rec = 0; for (const sc of scs) if (await offScriptSaved(sc)) rec++;
  const dev = offDeviceVoice(), left = scs.length - rec;
  put("audio", !left, left === 1 ? "1 recorded story" : left + " recorded stories");
  if (!dev && spoken.length > scs.length) out.notes.push("This device has no voice of its own, so only the recorded stories play aloud. Every story is still on screen.");
  out.rec = rec; out.stories = spoken.length;
  out.ready = Object.values(out.parts).every(p => p.ok);
  return out;
}
// The app's own files, kept by the service worker: the page, the map library and the photo reader for the
// ship's-clock check (loaded only when someone snaps the clock, so it is fetched here ahead of time).
const OFF_APP_FILES = ["index.html", "lib/maplibre-gl.js", "lib/maplibre-gl.css", "lib/ocr/tesseract.min.js", "lib/ocr/worker.min.js", "lib/ocr/tesseract-core-lstm.wasm.js", "lib/ocr/eng.traineddata.gz"];
// The app's own files: kept by the service worker on the website, part of the app in the Android app.
async function offAppCheck() {
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return { ok: true };
  if (location.protocol === "file:") return { ok: true };
  if (typeof caches === "undefined" || !("serviceWorker" in navigator)) return { ok: false, miss: "This browser can't keep Kairoute for use offline. Use Chrome, or the Kairoute app." };
  const need = OFF_APP_FILES.map(u => new URL(u, location.href).href);
  const hits = await Promise.all(need.map(u => caches.match(u).catch(() => null)));
  let styles = true; try { const c = await caches.open(MAP_CACHE); for (const t of ["light", "dark"]) if (!(await c.match(MAP_TILES[t]))) styles = false; } catch (e) { styles = false; }
  const ok = hits.every(Boolean) && styles;
  return { ok, miss: ok ? "" : "the app's own files" };
}
const offKey = () => trip.id + "|" + trip.pass + "|" + appSet.natvoice + "|" + appSet.guide + "|" + offDays().map(d => d.id + ":" + d.destination + ":" + d.date + ":" + d.type + ":" + (d.aboard ? "b" : "") + ":" + (d.selected || []).join(",")).join(";");
let offHurry = false; // someone is waiting on the check: stop waiting for quiet moments
async function offCheck(eager) {
  if (offChecking && eager) { offHurry = true; while (offChecking) await offSleep(50); }
  if (offChecking) { offAgain = true; return offRep; }
  return offCheckNow(eager);
}
async function offCheckNow(eager) { // eager: asked for (a download ending, a test), so no waiting for quiet moments
  offChecking = true;
  try {
    const mem = offMem();
    let base = null; try { base = await mapBase(mapDark() ? "dark" : "light"); } catch (e) {}
    // One day at a time, each in a quiet moment: the check builds every day's plan, and it must never freeze a tap.
    const days = []; for (const d of offDays()) { if (eager || offHurry) await offSleep(0); else await offQuiet(); days.push(await offCheckDay(d, base, mem)); }
    const app = await offAppCheck();
    const todo = days.filter(x => !x.ready);
    // The key is taken after the days are checked: checking a day can pick its sights for the first time.
    offRep = { key: offKey(), dg: dataGen, at: Date.now(), days, app, ready: !!days.length && !todo.length && app.ok, todo: todo.length, notes: [...new Set(days.flatMap(x => x.notes))].concat(offThinNote(days)) };
    return offRep;
  } finally { offChecking = false; offHurry = false; if (offAgain) { offAgain = false; offSoon(200); } }
}
// Waits until the traveler hasn't touched or scrolled for a moment and no redraw is due, then for an idle slot.
async function offQuiet() {
  for (let n = 0; n < 40 && !offHurry && (Date.now() - lastTouch < 1500 || drTimer); n++) await offSleep(400);
  await new Promise(r => typeof requestIdleCallback === "function" ? requestIdleCallback(() => r(), { timeout: 2000 }) : setTimeout(r, 30));
}
function offSoon(ms) {
  clearTimeout(offTimer);
  offTimer = setTimeout(async () => { if (offRun) return; const was = offSig(); await offCheck(); if (offSig() !== was) offPaint(); }, ms == null ? 1200 : ms);
}
const offSig = () => offRep ? JSON.stringify([offRep.ready, offRep.todo, offRep.app.ok, offRep.days.map(x => [x.ready, x.rec, Object.values(x.parts).map(p => p.ok)])]) : "";
// A check that's out of date (the trip changed since) is never shown as ready.
const offFresh = () => offRep && offRep.key === offKey() ? offRep : null;

// ---------- The download ----------
// Waits until the lookups the plans started (places to eat, ratings, rides) have answered, up to a limit.
async function offSettle(ms) {
  const t0 = Date.now(); await offSleep(450);
  while (Date.now() - t0 < ms && (farPending > 0 || gInFlight > 0 || transitBusy || transitQ.size)) await offSleep(300);
}
async function offDownload() {
  if (offRun) return;
  if (!offOnline()) { offMsg = "There's no internet right now. Connect to Wi-Fi, then tap Download for offline."; offPaint(); return; }
  offRun = { pct: 0, step: "Getting ready", stop: false }; offMsg = ""; offPaint();
  const step = (pct, text) => { offRun.pct = Math.max(offRun.pct, Math.min(100, Math.round(pct))); offRun.step = text; offPaint(); };
  const mem = offMem(); mem.tried = mem.tried || {};
  let failed = [];
  try {
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) {} // ask the browser never to clear the saved trip
    // 1. Guides for any place that doesn't have one yet.
    if (offDays().some(d => !cityFor(d)) && aiReady()) { step(2, "Building the city guides first"); await buildAllGuides(); }
    const days = offDays().filter(d => cityFor(d));
    let n = 0;
    // 3. Each city's sources and fame list, which rank the sights in every plan, kept on the device.
    for (const c of [...new Set(days.map(cityFor))]) { if (offRun.stop) break; try { await Promise.race([fameFor(null, c), offSleep(60000)]); } catch (e) {} }
    // 4. Everything each plan is built from, until a round asks for nothing new: places to eat, their ratings,
    //    travelers' ratings, weather, rides on real timetables, the day's time zone.
    for (let round = 0; round < 6 && !offRun.stop; round++) {
      step(16 + round * 2.5, "Saving places to eat, ratings and ride timetables");
      for (const d of days) {
        const city = cityFor(d); const { plan, rides } = offPlan(d); if (!plan) continue;
        farEatsFor(city, d); gCheck(plan, city); crowdFor(city); if (typeof wxFetch === "function") wxFetch(city);
        rides.forEach(r => transitPins.add(r[0]));
        if (typeof ensureDayZone === "function") { try { await ensureDayZone(d); } catch (e) {} } else if (!city.tz && typeof gxTz === "function") gxTz(city);
      }
      await offSettle(60000);
      // A second round always runs: new places to eat can change a day's meals, which then need their ratings.
      const missing = days.flatMap(d => offPlan(d).rides).filter(r => !offRideHas(r));
      if (round >= 1 && !missing.length && !farPending && !gInFlight) break;
      // A ride still without a timetable after six tries is remembered as checked, so it doesn't hold up "Ready"
      // (the plan keeps the cautious taxi time for it). Otherwise it is asked again.
      if (round === 5) missing.forEach(r => { mem.tried[r[0]] = Date.now(); });
      else missing.forEach(r => transitFail.delete(r[0]));
    }
    transitKeep(); offKeep(mem);
    for (let k = 0; k < 20 && days.some(d => !offZoneOk(d)); k++) await offSleep(400);
    // 5. Maps: the style, label fonts and icons for light and dark, then each day's street routes and tiles.
    let tpl = "";
    if (!offRun.stop) {
      step(32, "Saving the street maps");
      for (const t of ["light", "dark"]) { try { const b = await mapBase(t); tpl = tpl || b.tpl; for (const u of mapStyleFiles(b.style)) await mapFetch(u).catch(() => {}); } catch (e) {} }
      try { tpl = (await mapBase(mapDark() ? "dark" : "light")).tpl || tpl; } catch (e) {}
      n = 0;
      for (const d of days) {
        if (offRun.stop) break; n++; const { plan } = offPlan(d); if (!plan || !tpl) continue;
        const ok = await saveDayMap(d, plan, tpl, (a, b) => step(32 + 28 * (n - 1 + a / b) / days.length, `Saving the street map for ${mainPlace(d) || d.destination} (day ${n} of ${days.length})`));
        if (!ok) failed.push("map for " + (mainPlace(d) || d.destination));
      }
    }
    // 2. Stop details (big stops split into parts) before anything is recorded, so the stories match. After the plans,
    //    rides and maps (the trip works offline without them), a few stops at a time.
    if (!offRun.stop && aiReady()) {
      const todo = [], had = new Set(); let k = 0;
      for (const d of days) { const { plan } = offPlan(d); if (!plan) continue;
        plan.items.filter(i => i.type === "stop" && !(i.place.extrasV >= EXTRAS_V) && !extrasAsked[keyOf(plan.city.city) + "|" + i.place.id] && walkWorthy(i.place, plan.city))
          .forEach(i => { const key = keyOf(plan.city.city) + "|" + i.place.id; if (had.has(key)) return; had.add(key); todo.push({ s: plan.city.sites.find(x => x.id === i.place.id) || i.place, c: plan.city, d }); }); }
      const work = async () => { for (let x; (x = todo.shift()) && !offRun.stop;) { k++; step(60, `Writing the guide's walk-throughs (${k} of ${k + todo.length})`); try { await Promise.race([stopExtras(x.s, x.c), offSleep(90000)]); } catch (e) {} } };
      await Promise.all([work(), work(), work()]);
      // A stop's details can change what its day's map shows: a day whose map no longer matches is saved again.
      if (tpl) for (const d of days) { if (offRun.stop) break; const { plan } = offPlan(d); if (plan && mapSavedList()[d.id] !== dayTiles(d, plan, tpl).sig) await saveDayMap(d, plan, tpl, () => {}); }
    }
    // 6. Recorded stories in the traveler's guide voice, every stop once (a stop on two days is saved once).
    if (!offRun.stop && offNatural()) {
      const todo = [];
      for (const d of days) { const { plan } = offPlan(d); if (!plan) continue; for (const sc of offScripts(plan)) if (!todo.some(x => x.sc === sc) && !(await offScriptSaved(sc))) todo.push({ sc, d }); }
      let k = 0;
      for (const x of todo) {
        if (offRun.stop) break; k++; step(60 + 38 * (k - 1) / Math.max(1, todo.length), `Saving the guide's recordings for ${mainPlace(x.d) || x.d.destination} (${k} of ${todo.length})`);
        try { if (!(await offSaveScript(x.sc))) failed.push("recording " + x.sc.id); } catch (e) { failed.push("recording " + x.sc.id); }
      }
    }
    // 7. Time zones the Day plan thread looks up, and anything else the app keeps, then check the device itself.
    step(99, "Checking everything is on this device");
    try { await fetch(new URL("index.html", location.href).href, { cache: "no-cache" }); await Promise.all(OFF_APP_FILES.slice(1).concat("ai.json").map(u => fetch(new URL(u, location.href).href).then(r => r.ok && r.arrayBuffer()).catch(() => {}))); } catch (e) {}
  } catch (e) { failed.push(String(e && e.message || e)); }
  const stopped = offRun.stop; offFailed = failed;
  offHurry = true; while (offChecking) await offSleep(100); // a check started before the download ended would be out of date
  try { await offCheckNow(true); } catch (e) {} offRun = null;
  const r = offRep;
  offMsg = stopped ? "Download paused. Tap Download for offline to carry on." :
    r.ready ? "" :
    !offOnline() ? "The internet dropped during the download. Tap Download for offline again when you're back on Wi-Fi." :
    "Some pieces didn't download (an outside service was busy). Tap Download for offline again to finish.";
  offPaint(); if (view === "plan" || view === "trip") render();
}

// ---------- What the traveler sees ----------
// Days counted the way the rest of the app counts them: calendar days ("19 days ashore" when sea days need nothing).
function offDaysWord(days) { const n = new Set(days.map(x => x.date || x.id)).size, all = tripFacts().days; return { n, w: n === all ? (n === 1 ? "day" : "days") : (n === 1 ? "day ashore" : "days ashore") }; }
// One sentence for the whole trip, naming the places (outside review, Nov 20: "3 stops have only a short written
// guide. 2 stops have only a short written guide. 6 stops..." with no place named).
function offThinNote(days) {
  const by = new Map(); days.filter(x => x.thin).forEach(x => by.set(x.place, (by.get(x.place) || 0) + x.thin));
  if (!by.size) return [];
  return [`Only a short written guide for some stops in ${offJoin([...by].map(([p, n]) => `${p} (${n})`))}.`];
}
const OFF_PART_NAMES = { guide: "Guide", plan: "Plan", rides: "Rides", text: "Guide text", zone: "Time zone", map: "Map", audio: "Stories" };
function offMissingText(x) { return Object.values(x.parts).filter(p => !p.ok).map(p => p.miss); }
const offJoin = a => a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
const offDevice = () => (window.innerWidth || 1000) >= 700 ? "tablet" : "phone";
function offHead() {
  const r = offFresh(), locked = offLockedN();
  if (offRun) return { cls: "run", ico: "⤓", title: "Saving your trip for offline", text: esc(offRun.step) + "…" };
  if (!offDays().length) return { cls: "", ico: "⤓", title: "Offline", text: "Add a day with a destination, then download it for offline." };
  if (!r) return { cls: "", ico: "…", title: "Checking what's saved", text: "Looking on this " + offDevice() + "." };
  const { n, w } = offDaysWord(r.days), todoN = offDaysWord(r.days.filter(x => !x.ready)).n, lockTxt = locked ? ` ${locked} more day${locked === 1 ? "" : "s"} unlock${locked === 1 ? "s" : ""} with a trip pass.` : "";
  if (r.ready) return { cls: "ok", ico: "✓", title: "Ready for offline", text: `${n === 1 ? "Your day is" : `All ${n} ${w} are`} saved on this ${offDevice()}: plans, street maps, stories, ride timetables and time zones. No internet needed on the trip.${lockTxt}` };
  const what = [...new Set(r.days.flatMap(offMissingText))].slice(0, 3);
  if (!r.app.ok && !r.todo) what.unshift(r.app.miss);
  const many = todoN === n ? (n === 1 ? "Your day isn't" : `None of the ${n} ${w} are`) : `${todoN} of ${n} ${w} aren't`;
  return { cls: "warn", ico: "!", title: "Not ready for offline yet", text: (offOnline() ? `${r.todo ? many + " fully saved on this " + offDevice() : "Almost there"}. Download now while you have Wi-Fi, before the ship sails or the flight leaves.` : `No internet right now. ${r.todo ? many + " fully saved" : "Some app files aren't saved"}: missing ${esc(offJoin(what))}.`) + lockTxt };
}
function offDayRows(r) {
  return r.days.map(x => `<li class="${x.ready ? "ok" : "no"}"><span class="offd">${esc(fmtDate(x.date) || "Day " + (x.i + 1))}</span><span class="offp">${esc(x.place)}</span><span class="offparts">${Object.entries(x.parts).map(([k, p]) => `<i class="${p.ok ? "y" : "n"}" title="${esc(p.ok ? OFF_PART_NAMES[k] + " saved" : "Missing: " + p.miss)}">${p.ok ? "✓" : "✗"} ${OFF_PART_NAMES[k]}</i>`).join("")}</span></li>`).join("") +
    trip.days.filter(d => !noShore(d) && d.destination && dayLocked(d)).map(d => `<li class="lock"><span class="offd">${esc(fmtDate(d.date) || "")}</span><span class="offp">${esc(mainPlace(d) || d.destination)}</span><span class="offparts"><i>Unlocks with a trip pass</i></span></li>`).join("");
}
// compact (the Trip page): one line with its button; the details fold open below it, so the day list comes first.
function offCard(compact) {
  const h = offHead(), r = offFresh();
  const btn = offRun ? `<button class="btn ghost small" data-act="offstop">Pause</button>`
    : h.cls === "ok" ? "" : `<button class="btn small" data-act="offdl" ${offOnline() && offDays().length ? "" : "disabled"}>Download for offline</button>`;
  if (compact && !offRun) return `<div class="card offcard offline1 ${h.cls}" id="offCard" role="status" aria-live="polite">
    <div class="offhead"><span class="offico" aria-hidden="true">${h.ico}</span><div class="offtxt"><b>${h.title}</b></div>${btn}</div>
    ${r && (r.days.length || r.notes.length) || h.cls ? `<details class="offdays"><summary>Details, day by day</summary><p class="offmsg">${h.text}</p>${offMsg ? `<p class="offmsg">${esc(offMsg)}</p>` : ""}${r && r.notes.length ? `<p class="offmsg">${r.notes.map(esc).join(" ")}</p>` : ""}${r && r.days.length ? `<ul>${offDayRows(r)}</ul>${r.ready && offOnline() ? `<button class="linkbtn" data-act="offdl">Check for updates and download again</button>` : ""}` : ""}</details>` : ""}
  </div>`;
  return `<div class="card offcard ${h.cls}" id="offCard" role="status" aria-live="polite">
    <div class="offhead"><span class="offico" aria-hidden="true">${h.ico}</span><div class="offtxt"><b>${h.title}</b><span>${h.text}</span></div>${btn}</div>
    ${offRun ? `<div class="offbar" role="progressbar" aria-valuenow="${offRun.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Download progress"><i style="width:${offRun.pct}%"></i></div>` : ""}
    ${offMsg ? `<p class="offmsg">${esc(offMsg)}</p>` : ""}
    ${r && !offRun && r.notes.length ? `<p class="offmsg">${r.notes.map(esc).join(" ")}</p>` : ""}
    ${r && r.days.length ? `<details class="offdays"><summary>What's saved, day by day</summary><ul>${offDayRows(r)}</ul>${r.ready && offOnline() ? `<button class="linkbtn" data-act="offdl">Check for updates and download again</button>` : ""}</details>` : ""}
  </div>`;
}
function offSettings() {
  return `${offCard()}
  <div class="card"><h3>How offline works</h3><p class="lede">Setting up a trip needs the internet: building guides, finding places to eat, ratings, ride timetables and recording the stories. Once it's planned, tap <b>Download for offline</b> on Wi-Fi and the whole trip runs with no signal: the Day plan, street maps, the guide and its stories, ride times and the back-to-the-ship countdown.</p>
  <p class="lede" id="offSpace">${esc(offSpaceText || "")}</p></div>`;
}
let offSpaceText = "";
function offSpace() {
  try { if (!navigator.storage || !navigator.storage.estimate) return;
    Promise.all([navigator.storage.estimate(), navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false)]).then(([e, keep]) => {
      const mb = Math.round((e.usage || 0) / 1048576), t = `Kairoute uses about ${mb < 1 ? "under 1" : mb} MB on this ${offDevice()}.${keep ? " Your browser has agreed to keep it." : ""}`;
      if (t !== offSpaceText) { offSpaceText = t; const el = document.getElementById("offSpace"); if (el) el.textContent = t; } }).catch(() => {});
  } catch (e) {}
}
// One line at the top of the Day plan and Guide: a nudge to download before the trip, or, with no internet, what
// this day is missing and what still works.
function tripSoon() {
  const ds = trip.days.map(d => d.date).filter(Boolean).sort(); if (!ds.length) return false;
  const t = todayISO(), ahead = Math.round((new Date(ds[0] + "T12:00:00Z") - new Date(t + "T12:00:00Z")) / 864e5);
  return ahead <= 10 && t <= ds[ds.length - 1];
}
function offBanner() {
  if (!["plan", "guide"].includes(view)) return "";
  const r = offFresh(), d = day();
  if (offRun) return `<div class="banner offban" id="offBanner" role="status"><span class="spinner"></span><span>Saving your trip for offline: ${esc(offRun.step)} (${offRun.pct}%)</span></div>`;
  if (!r || r.ready) return "";
  if (!offOnline()) {
    const x = r.days.find(y => y.id === d.id); if (!x || x.ready) return "";
    const miss = offMissingText(x), works = [];
    if (!x.parts.map || !x.parts.map.ok) works.push("the map shows a simple route drawing");
    if (x.parts.audio && !x.parts.audio.ok) works.push("tap a stop to read its story");
    return `<div class="banner warn offban" id="offBanner" role="status"><span><b>No internet.</b> This day isn't fully saved: missing ${esc(offJoin(miss))}. ${x.parts.plan && x.parts.plan.ok ? "The plan and its times still work" + (works.length ? "; " + works.join(", ") : "") + "." : ""}</span></div>`;
  }
  if (offLater || !tripSoon()) return "";
  return `<div class="banner warn offban" id="offBanner" role="status"><span><b>Get ready for offline.</b> ${r.todo ? (o => `${offDaysWord(r.days.filter(x => !x.ready)).n} of ${o.n} ${o.w} aren't saved on this ${offDevice()} yet`)(offDaysWord(r.days)) : "Some app files aren't saved yet"}. Download now while you have Wi-Fi.</span><span class="offbtns"><button class="btn small" data-act="offdl">Download now</button><button class="btn ghost small" data-act="offlater">Later</button></span></div>`;
}
// Updates the card and the banner in place (no full redraw, so nothing the traveler is reading moves).
function offPaint() {
  const c = document.getElementById("offCard"); if (c) { const w = document.createElement("div"); w.innerHTML = offCard(); const open = c.querySelector("details[open]"); c.replaceWith(w.firstElementChild); if (open) { const n = document.querySelector("#offCard details"); if (n) n.open = true; } }
  const v = document.getElementById("view"), b = document.getElementById("offBanner"), html = offBanner();
  if (b) { if (html) b.outerHTML = html; else b.remove(); } else if (html && v && !FULL_VIEWS[view]) v.insertAdjacentHTML("afterbegin", html);
}
function offAfterRender() {
  try {
    const v = document.getElementById("view"), html = offBanner();
    if (html && v && !FULL_VIEWS[view] && !document.getElementById("offBanner")) v.insertAdjacentHTML("afterbegin", html);
    if (view === "settings" && setSec === "offline") offSpace();
    // Checked again when the trip changes, and at most once a minute otherwise (the check builds every day's plan).
    if (!offRep || offRep.key !== offKey()) offSoon(); else if (offRep.dg !== dataGen && Date.now() - offRep.at > 60000 && (view === "trip" || view === "settings")) offSoon(3000); // after new answers, only where the status is shown: a page left alone sits still
  } catch (e) { console.warn("offline", e); }
}
document.addEventListener("click", e => {
  const t = e.target.closest && e.target.closest("[data-act]"); if (!t) return;
  const a = t.dataset.act;
  if (a === "offdl") { e.preventDefault(); offLater = false; offDownload(); }
  else if (a === "offstop") { e.preventDefault(); if (offRun) { offRun.stop = true; offRun.step = "Pausing"; offPaint(); } }
  else if (a === "offlater") { e.preventDefault(); offLater = true; offPaint(); }
});
// The status follows the connection: coming back online offers to finish; going offline says what's missing.
if (typeof window !== "undefined") {
  // The sights' ranking is applied from the saved sources as soon as the app opens, so plans match with no internet.
  setTimeout(() => { try { [...new Set((trip.days || []).map(d => cityFor(d)).filter(Boolean))].forEach(c => fameFor(null, c)); } catch (e) {} }, 0);
  addEventListener("online", () => { offMsg = ""; offSoon(300); offPaint(); });
  addEventListener("offline", () => { offSoon(100); offPaint(); });
  window.__kairouteOffline = { setPass: v => { if (v == null) delete trip.pass; else trip.pass = v; save(); }, check: () => offCheck(true), download: () => offDownload(), state: () => ({ run: offRun, rep: offFresh(), msg: offMsg, failed: offFailed, transit: Object.keys(transitMem).length, pins: transitPins.size }), plan: i => { const { plan } = offPlan(trip.days[i]); return plan ? plan.items.filter(x => x.type !== "travel").map(x => (x.type || "") + "@" + x.time + ":" + ((x.place && x.place.name) || x.label || "") + (x.type === "travel" ? "" : "")).join(" | ") + " || rides " + plan.items.filter(x => x.type === "travel").map(x => x.leg.how + " " + x.leg.min).join(", ") : null; } };
}
