// ---------- Local time: every time on a day is that place's own clock, and "now" is read on that clock ----------
// Plans are written in the destination's local time (all aboard 18:30 means 18:30 in Naples). The device may still
// be on home time, so "now", "today" and every countdown are worked out from the real instant in the day's zone.
// Zones come from the country (offline, for single-zone countries), then a one-time lookup by coordinates when
// online, saved on the day as d.tz so it works offline and syncs. dayZone(d) is the hook other features use.
// Ships sometimes keep a clock that differs from the port's: d.shipOff (minutes, ship minus port) records what the
// traveler confirmed, and the all-aboard time (announced in ship time) is converted to port time for planning.

const ONE_ZONE = { greece: "Europe/Athens", italy: "Europe/Rome", "vatican city": "Europe/Rome", malta: "Europe/Malta", spain: "Europe/Madrid", france: "Europe/Paris",
  monaco: "Europe/Monaco", croatia: "Europe/Zagreb", montenegro: "Europe/Podgorica", slovenia: "Europe/Ljubljana", albania: "Europe/Tirane", turkey: "Europe/Istanbul", türkiye: "Europe/Istanbul",
  cyprus: "Asia/Nicosia", israel: "Asia/Jerusalem", egypt: "Africa/Cairo", morocco: "Africa/Casablanca", tunisia: "Africa/Tunis", germany: "Europe/Berlin", netherlands: "Europe/Amsterdam",
  belgium: "Europe/Brussels", "united kingdom": "Europe/London", uk: "Europe/London", england: "Europe/London", scotland: "Europe/London", wales: "Europe/London", ireland: "Europe/Dublin",
  norway: "Europe/Oslo", sweden: "Europe/Stockholm", denmark: "Europe/Copenhagen", finland: "Europe/Helsinki", estonia: "Europe/Tallinn", latvia: "Europe/Riga", lithuania: "Europe/Vilnius",
  poland: "Europe/Warsaw", "czech republic": "Europe/Prague", czechia: "Europe/Prague", austria: "Europe/Vienna", switzerland: "Europe/Zurich", hungary: "Europe/Budapest", iceland: "Atlantic/Reykjavik",
  bahamas: "America/Nassau", jamaica: "America/Jamaica", "cayman islands": "America/Cayman", "puerto rico": "America/Puerto_Rico", "dominican republic": "America/Santo_Domingo",
  barbados: "America/Barbados", "saint lucia": "America/St_Lucia", "st. lucia": "America/St_Lucia", aruba: "America/Aruba", curaçao: "America/Curacao", curacao: "America/Curacao",
  belize: "America/Belize", honduras: "America/Tegucigalpa", "costa rica": "America/Costa_Rica", panama: "America/Panama", colombia: "America/Bogota", peru: "America/Lima",
  japan: "Asia/Tokyo", "south korea": "Asia/Seoul", singapore: "Asia/Singapore", thailand: "Asia/Bangkok", vietnam: "Asia/Ho_Chi_Minh", "new zealand": "Pacific/Auckland",
  "united arab emirates": "Asia/Dubai", uae: "Asia/Dubai", "south africa": "Africa/Johannesburg", china: "Asia/Shanghai", "hong kong": "Asia/Hong_Kong", india: "Asia/Kolkata" };
const zoneAsked = {};
function zoneOk(tz) { try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch (e) { return false; } }
function dayCoords(d) {
  const c = typeof cityFor === "function" ? cityFor(d) : null; if (!c) return null;
  const st = c.starts || {}, p = isFinite(c.lat) ? c : [].concat(...Object.values(st)).find(x => x && isFinite(x.lat)) || (c.sites || []).find(x => isFinite(x.lat));
  return { lat: p ? +p.lat : NaN, lng: p ? +p.lng : NaN, country: c.country || "", city: c };
}
// { tz, known }: known is true once the zone is certain (saved, or a single-zone country); false while estimated.
function dayZone(d) {
  if (!d) return { tz: deviceZone(), known: false };
  if (d.tz && zoneOk(d.tz)) return { tz: d.tz, known: true };
  const c = dayCoords(d), country = String((c && c.country) || "").trim().toLowerCase();
  if (country === "spain" && c && c.lng < -12) return { tz: "Atlantic/Canary", known: true };
  if (country === "portugal") return { tz: c && c.lng < -20 ? "Atlantic/Azores" : c && c.lng < -12 ? "Atlantic/Madeira" : "Europe/Lisbon", known: true };
  if (ONE_ZONE[country] && zoneOk(ONE_ZONE[country])) return { tz: ONE_ZONE[country], known: true };
  if (c && isFinite(c.lat)) { zoneLookup(d, c); const h = Math.round(c.lng / 15); return { tz: h === 0 ? "Etc/GMT" : `Etc/GMT${h > 0 ? "-" : "+"}${Math.abs(h)}`, known: false }; }
  return { tz: deviceZone(), known: false };
}
// One lookup per place while online (Open-Meteo answers the zone for any coordinates); saved on the day.
function zoneLookup(d, c) {
  if (typeof fetch === "undefined" || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
  const k = c.lat.toFixed(2) + "," + c.lng.toFixed(2); if (zoneAsked[k]) return; zoneAsked[k] = 1;
  fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat.toFixed(3)}&longitude=${c.lng.toFixed(3)}&timezone=auto&forecast_days=1&daily=sunrise`)
    .then(r => r.ok ? r.json() : null).then(j => {
      if (!j || !j.timezone || !zoneOk(j.timezone)) { zoneAsked[k] = 0; return; }
      let changed = false; for (const x of trip.days) { const cx = dayCoords(x); if (cx && isFinite(cx.lat) && !x.tz && cx.lat.toFixed(2) + "," + cx.lng.toFixed(2) === k) { x.tz = j.timezone; changed = true; } }
      if (changed) { save(); render(); }
    }).catch(() => { zoneAsked[k] = 0; });
}
function deviceZone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; } }
// The wall clock in a zone right now: { date: "YYYY-MM-DD", min: minutes since midnight (with seconds) }.
function zoneNow(tz, at) {
  const t = at || new Date();
  try {
    const p = {}; new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(t).forEach(x => { p[x.type] = x.value; });
    return { date: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute + +p.second / 60 };
  } catch (e) { return { date: t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0"), min: t.getHours() * 60 + t.getMinutes() + t.getSeconds() / 60 }; }
}
// Minutes a zone is ahead of UTC on a given date (noon), e.g. Rome in July: 120.
function zoneOffset(tz, iso) {
  const at = new Date((iso || new Date().toISOString().slice(0, 10)) + "T12:00:00Z"), z = zoneNow(tz, at);
  let diff = Math.round(z.min - 12 * 60); const dd = z.date < at.toISOString().slice(0, 10) ? -1440 : z.date > at.toISOString().slice(0, 10) ? 1440 : 0; return diff + dd;
}
// A ship-announced time (all aboard, arrival) on the port's clock.
function shipToPort(d, hhmm) { return toMin(hhmm) - (+d.shipOff || 0); }
function isToday(d) { return !!(d && d.date && d.date === zoneNow(dayZone(d).tz).date); }
// The place's name for its clock: "Naples time".
function zoneLabel(d) { const c = typeof cityFor === "function" ? cityFor(d) : null; const n = String((c && c.city) || d.destination || "Local").replace(/\s*\(.*\)\s*/g, "").split(",")[0].trim(); return n + " time"; }
// One line under the day's times: whose clock they are, and a clear note when this device shows a different time.
function zoneNote(d) {
  if (!d || d.type === "sea") return "";
  const z = dayZone(d), lab = zoneLabel(d), dev = deviceZone();
  const gap = zoneOffset(z.tz, d.date) - zoneOffset(dev, d.date);
  const ship = d.shipOff ? ` The ship's clock is ${dur(Math.abs(d.shipOff))} ${d.shipOff > 0 ? "ahead of" : "behind"} ${esc(lab)}: all aboard ${esc(d.allAboard)} ship time is ${fmt(toMin(d.allAboard) - d.shipOff)} ${esc(lab)}.` : "";
  const est = z.known ? "" : " (time zone estimated until you're online once)";
  if (!gap) return `<p class="tzline">All times are ${esc(lab)}${est}.${ship}</p>`;
  return `<p class="tzline warn"><b>All times are ${esc(lab)}${est}.</b> This device is set to a different time zone (${dur(Math.abs(gap))} ${gap > 0 ? "behind" : "ahead"}); Kairoute already counts from ${esc(lab)}, so follow these times.${ship}</p>`;
}

// ---------- Ship's clock check: on a ship day, confirm the ship's clock matches the port's ----------
let shipChk = null; // { step: "ask"|"type"|"read"|"confirm"|"fail", guess, read, msg }
function shipCheckDue(d) { return !!(d && (d.type === "port" || d.type === "embark") && isToday(d) && !d.shipChecked && view === "plan"); }
function roundTo5(m) { return Math.round(m / 5) * 5; }
function shipSheetHTML(d) {
  if (!shipChk || !d) return "";
  const lab = zoneLabel(d), local = zoneNow(dayZone(d).tz).min, shown = fmt12(local);
  const intro = `<p class="lede small">Cruise ships sometimes keep their own clock, different from the port's. The ship announces it in the daily planner and on the cabin TV. All-aboard times are given in ship time.</p>`;
  let body;
  if (shipChk.step === "ask") body = `<h2>Is the ship's clock showing ${esc(shown)}?</h2>${intro}
    <div class="shipbtns"><button class="btn" data-act="shipok">Yes, it matches</button><button class="btn ghost" data-act="shiptype">No, enter the ship's time</button>
    <button class="btn ghost" data-act="shipsnap">📷 Snap the ship's clock</button></div>`;
  else if (shipChk.step === "type" || shipChk.step === "fail") body = `${shipChk.step === "fail" ? `<p class="banner warn" role="alert">${esc(shipChk.msg || "Couldn't read the time in that photo.")}</p>` : ""}
    <h2>What time does the ship's clock show?</h2>${intro}
    <div class="field"><label for="shipTime">Ship's time</label><input id="shipTime" type="time" step="300" value="${fmt(roundTo5(shipChk.guess != null ? shipChk.guess : local))}"></div>
    <div class="shipbtns"><button class="btn" data-act="shipset">Use this time</button>${shipChk.step === "fail" ? `<button class="btn ghost" data-act="shipsnap">Try the photo again</button>` : `<button class="btn ghost" data-act="shipsnap">📷 Snap the ship's clock</button>`}</div>`;
  else if (shipChk.step === "read") body = `<h2>Reading the ship's clock…</h2><p class="lede small"><span class="spinner"></span> This happens on your phone, no internet needed.</p>`;
  else body = `<h2>The photo shows ${esc(fmt12(shipChk.read))}. Use this?</h2><p class="lede small">Check it against the clock before you confirm.</p>
    <div class="shipbtns"><button class="btn" data-act="shipuseread">Yes, use ${esc(fmt12(shipChk.read))}</button><button class="btn ghost" data-act="shiptype">No, type it</button><button class="btn ghost" data-act="shipsnap">Try again</button></div>`;
  return `<div class="shipsheet" role="dialog" aria-modal="true" aria-label="Check the ship's clock"><div class="shipcard">
    <div class="eyebrow">Ship's clock · ${esc(lab)} now ${esc(shown)}</div>${body}
    <button class="linkbtn shiplater" data-act="shiplater">Later</button></div></div>`;
}
function fmt12(m) { m = ((Math.round(m) % 1440) + 1440) % 1440; const h = Math.floor(m / 60), mm = m % 60; return `${(h % 12) || 12}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; }
// The difference between the ship's clock and the port's, to the nearest 15 minutes (clocks are set in whole or half hours).
function shipOffsetFrom(shipMin, d) {
  const local = zoneNow(dayZone(d).tz).min; let off = shipMin - local; if (off > 720) off -= 1440; if (off < -720) off += 1440;
  const q = Math.round(off / 15) * 15; return Math.abs(q) < 10 ? 0 : q;
}
function shipApply(d, shipMin) { d.shipOff = shipMin == null ? 0 : shipOffsetFrom(shipMin, d); d.shipChecked = todayISO(d); shipChk = null; save(); render(); }
function shipMount() {
  const old = document.querySelector(".shipsheet"); if (old) old.remove();
  const d = typeof day === "function" ? day() : null;
  if (!shipChk && shipCheckDue(d) && !shipLater[d.id]) shipChk = { step: "ask" };
  if (shipChk && d && view === "plan") document.body.insertAdjacentHTML("beforeend", shipSheetHTML(d));
}
const shipLater = {};
// Reads the time from a photo of a clock or a ship's TV, on the device (Tesseract, bundled; works offline).
async function readClockPhoto(file) {
  if (typeof Tesseract === "undefined") await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "lib/ocr/tesseract.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const w = await Tesseract.createWorker("eng", 1, { workerPath: "lib/ocr/worker.min.js", corePath: "lib/ocr/tesseract-core-lstm.wasm.js", langPath: "lib/ocr/", gzip: true });
  try { await w.setParameters({ tessedit_char_whitelist: "0123456789:.APMapm " }); const r = await w.recognize(file); return clockFromText(r.data.text || ""); }
  finally { try { await w.terminate(); } catch (e) {} }
}
// "10:15", "10.15 AM", "9:05pm" → minutes; null when no clock time is found.
function clockFromText(t) {
  const m = /(\d{1,2})\s*[:.]\s*(\d{2})\s*([AaPp])?\.?\s*[Mm]?/.exec(String(t)); if (!m) return null;
  let h = +m[1]; const mm = +m[2]; if (h > 23 || mm > 59) return null;
  if (m[3]) { const pm = /p/i.test(m[3]); if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; }
  return h * 60 + mm;
}
function shipClick(t) {
  const act = t.dataset.act, d = day(); if (!act || !/^ship/.test(act)) return false;
  if (act === "shipok") { shipApply(d, null); return true; }
  if (act === "shiplater") { shipLater[d.id] = 1; shipChk = null; shipMount(); return true; }
  if (act === "shipcheck") { shipChk = { step: "ask" }; shipMount(); return true; }
  if (act === "shiptype") { shipChk = { step: "type", guess: shipChk && shipChk.read != null ? shipChk.read : null }; shipMount(); return true; }
  if (act === "shipset") { const v = (document.getElementById("shipTime") || {}).value; if (/^\d{1,2}:\d{2}$/.test(v || "")) shipApply(d, toMin(v)); return true; }
  if (act === "shipuseread") { if (shipChk && shipChk.read != null) shipApply(d, shipChk.read); return true; }
  if (act === "shipsnap") {
    let f = document.getElementById("shipFile");
    if (!f) { document.body.insertAdjacentHTML("beforeend", `<input type="file" id="shipFile" accept="image/*" capture="environment" hidden>`); f = document.getElementById("shipFile");
      f.addEventListener("change", async () => { const file = f.files && f.files[0]; f.value = ""; if (!file) return;
        const guess = zoneNow(dayZone(day()).tz).min; shipChk = { step: "read", guess }; shipMount();
        let read = null, why = "";
        try { read = await readClockPhoto(file); if (read == null) why = "Couldn't read the time in that photo. Try again closer to the clock, or type it below."; }
        catch (e) { why = navigator.onLine === false ? "The photo reader isn't saved on this phone yet and there's no internet, so type the ship's time instead." : "Couldn't read the time in that photo. Try again, or type it below."; }
        shipChk = read != null ? { step: "confirm", read, guess } : { step: "fail", msg: why, guess }; shipMount(); }); }
    f.click(); return true;
  }
  return false;
}
if (typeof window !== "undefined") window.__kairouteTime = { dayZone: i => dayZone(trip.days[i]), zoneNow, zoneOffset, isToday: i => isToday(trip.days[i]), clockFromText, shipOffsetFrom: (m, i) => shipOffsetFrom(m, trip.days[i]), set: (i, o) => { Object.assign(trip.days[i], o); save(); render(); }, sheet: () => shipChk && shipChk.step };
