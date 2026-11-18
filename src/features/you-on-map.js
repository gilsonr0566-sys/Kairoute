// ---------- You on the map (Richard, Nov 18: "a little person on the map that shows where our current location is") ----------
// Every street map (Day plan and Tour) shows the traveler as a small person, the way map apps do. A soft beam shows
// which way they're facing (the phone's compass, or the direction they're walking when there's no compass), a faint
// ring shows how sure the phone is of the spot, and the person turns grey when the position is old.
// It uses only the phone's own location (free, no outside service) and works with no internet: GPS needs none, and
// the saved map tiles show underneath. Nothing is asked without a tap: the round button on the map asks the phone
// for permission the first time; once the traveler has said yes, the person appears by itself whenever a map is open.
// The tour's Follow me and the live day share the same position (geoPos), so there is one dot, never two.
const YOU_PERSON = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="13.2" cy="4.3" r="2.3" fill="currentColor"/><path d="M9.6 8.6c.5-.5 1.2-.8 2-.8h1.1c1 0 1.8.6 2.1 1.5l.8 2.4 2.2 1.2c.5.3.7.9.4 1.4-.3.5-.9.7-1.4.4l-2.6-1.4c-.2-.1-.4-.3-.5-.6l-.3-.9-.9 3.7 2.3 2.5c.2.2.3.4.3.6l.6 4c.1.6-.3 1.1-.9 1.2-.6.1-1.1-.3-1.2-.9l-.5-3.7-2.1-2.2-.8 3.1c-.1.2-.2.4-.3.6l-2.4 3c-.4.5-1 .5-1.4.2-.5-.4-.5-1-.2-1.4l2.2-2.8 1.8-7.4-1 .5-.9 2.7c-.2.5-.7.8-1.3.6-.5-.2-.8-.7-.6-1.3l1.1-3.1c.1-.3.3-.5.5-.6l1.9-1.1z" fill="currentColor"/></svg>`;
const YOU_LOCATE = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2" fill="currentColor"/><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 1.5v3.5M12 19v3.5M1.5 12H5M19 12h3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const YOU_STALE_MS = 60e3, YOU_NEAR_KM = 40;
let youWatch = null, youWanted = false, youPerm = "unknown", youFix = null, youSeen = 0, youTicker = null, youHooked = null;
let youCompassAsked = false, youTrail = null, youHead = null, youHeadAt = 0, youCompass = null, youPaintQ = false, youNoteT = null, youErr = "";

// The marker: accuracy ring, heading beam and the person, centred on the spot.
function youElement() {
  const el = document.createElement("div");
  el.className = "mk-you"; el.setAttribute("role", "img"); el.setAttribute("aria-label", "You are here");
  el.innerHTML = `<span class="you-acc"></span><span class="you-beam"></span><span class="you-pin">${YOU_PERSON}</span>`;
  return el;
}
// Called by placeYou() (main.js) whenever the map or the position changes.
function youPlace() {
  const ml = window.maplibregl; if (!kmap || !ml) return;
  if (!geoPos || !kmapData) { if (kmapYou) { kmapYou.remove(); kmapYou = null; } return; }
  const ll = [geoPos.lng, geoPos.lat];
  if (!kmapYou) {
    kmapYou = new ml.Marker({ element: youElement() }).setLngLat(ll).addTo(kmap);
    if (kmapData.you && youNear()) fitMap(kmapData);
  } else kmapYou.setLngLat(ll);
  if (youHooked !== kmap) { youHooked = kmap; kmap.on("zoom", youPaint); kmap.on("rotate", youPaint); }
  youSeen = geoPos.at || 0;
  youPaint();
}
// Ring size, beam direction and the grey "old position" look. Cheap: runs on zoom and on each compass reading.
function youPaint() {
  if (!kmapYou || !geoPos || !kmap) return;
  const el = kmapYou.getElement(), stale = !geoPos.at || Date.now() - geoPos.at > YOU_STALE_MS;
  el.classList.toggle("stale", stale);
  const acc = el.querySelector(".you-acc"), beam = el.querySelector(".you-beam");
  // Metres per screen pixel at this zoom and latitude (512-pixel map tiles).
  const mpp = 40075016.686 * Math.cos(geoPos.lat * Math.PI / 180) / (512 * Math.pow(2, kmap.getZoom()));
  const dia = geoPos.acc && mpp > 0 ? Math.min(420, 2 * geoPos.acc / mpp) : 0;
  if (acc) { acc.style.width = acc.style.height = Math.round(dia) + "px"; acc.style.display = dia > 40 ? "" : "none"; }
  const h = youHeading();
  if (beam) { beam.style.display = h == null || stale ? "none" : ""; if (h != null) beam.style.transform = `translate(-50%, -100%) rotate(${Math.round(h - (kmap.getBearing() || 0))}deg)`; }
  el.setAttribute("aria-label", stale ? "Where you were last seen" : h == null ? "You are here" : "You are here, facing " + youCompassWord(h));
}
function youBearing(a, b) { const r = Math.PI / 180, y = Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r), x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r); return (Math.atan2(y, x) / r + 360) % 360; }
const youCompassWord = h => ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"][Math.round(((h % 360) + 360) % 360 / 45) % 8];
// The compass wins while it's reading; otherwise the direction of walking from GPS (only when actually moving).
function youHeading() {
  if (youHead != null && Date.now() - youHeadAt < 4000) return youHead;
  if (youFix && youFix.heading != null && Date.now() - youFix.at < 20000) return youFix.heading;
  return null;
}
function youPaintSoon() { if (youPaintQ) return; youPaintQ = true; requestAnimationFrame(() => { youPaintQ = false; youPaint(); }); }

// ---- the phone's compass ----
function youCompassStart(fromTap) {
  if (typeof window === "undefined") return;
  const DOE = window.DeviceOrientationEvent; if (!DOE) return;
  // iPhone and iPad ask for the compass separately, and only from a tap; until then their compass stays quiet.
  if (fromTap && !youCompassAsked && typeof DOE.requestPermission === "function") { youCompassAsked = true; DOE.requestPermission().catch(() => {}); }
  if (youCompass) return;
  const listen = () => {
    const ev = "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";
    youCompass = { ev, fn: e => {
      let h = null;
      if (typeof e.webkitCompassHeading === "number" && isFinite(e.webkitCompassHeading)) h = e.webkitCompassHeading; // iPhone, iPad
      else if ((e.absolute || ev === "deviceorientationabsolute") && e.alpha != null) h = 360 - e.alpha; // Android
      if (h == null) return;
      const turn = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
      h = ((h + turn) % 360 + 360) % 360;
      // Smooth the needle so the beam doesn't shake: move part of the way, the short way round.
      if (youHead == null) youHead = h; else { const d = ((h - youHead + 540) % 360) - 180; youHead = (youHead + d * 0.35 + 360) % 360; }
      youHeadAt = Date.now(); youPaintSoon();
    } };
    window.addEventListener(ev, youCompass.fn, true);
  };
  listen();
}
function youCompassStop() { if (!youCompass) return; window.removeEventListener(youCompass.ev, youCompass.fn, true); youCompass = null; youHead = null; }

// ---- following the position while a map is on screen ----
function youWatchStart(fromTap) {
  if (!navigator.geolocation) { youPerm = "none"; return; }
  youCompassStart(fromTap);
  if (youWatch != null) return;
  try {
    youWatch = navigator.geolocation.watchPosition(pos => {
      const c = pos.coords; youPerm = "granted"; youErr = "";
      // The direction of walking, only when really moving (standing still, GPS headings wander). Many phones don't
      // report a heading, so it also comes from the last two spots, once they're far enough apart to be sure.
      let heading = c.heading != null && isFinite(c.heading) && (c.speed || 0) > 0.7 ? c.heading : null;
      const here = { lat: c.latitude, lng: c.longitude, at: Date.now() };
      if (heading == null && youTrail && Date.now() - youTrail.at < 60000) {
        const m = hav(youTrail, here) * 1000;
        if (m >= Math.max(8, (c.accuracy || 0) * 0.6)) { heading = youBearing(youTrail, here); youTrail = here; }
      } else youTrail = here;
      if (heading == null && youFix && youFix.heading != null && Date.now() - youFix.at < 20000) heading = youFix.heading;
      youFix = { heading, at: Date.now() };
      // The tour's Follow me keeps its own, faster position; never fight it.
      if (geoWatch == null) geoPos = { lat: c.latitude, lng: c.longitude, acc: c.accuracy, at: Date.now() };
      const first = !kmapYou; placeYou();
      if (first && youWanted) youCenter();
    }, err => {
      if (err && err.code === 1) { youPerm = "denied"; youWatchStop(); if (youWanted) youNote("Location is off for Kairoute. To see yourself on the map, allow location for Kairoute in your phone or browser settings."); youWanted = false; return; }
      youErr = "signal";
      if (youWanted && !kmapYou) youNote("Looking for your location… You'll appear on the map as soon as your phone finds a signal.");
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
  } catch (e) { youWatch = null; }
}
function youWatchStop() {
  if (youWatch != null) { try { navigator.geolocation.clearWatch(youWatch); } catch (e) {} youWatch = null; }
  youCompassStop();
}
// Is the traveler anywhere near this map's places? (At home planning a trip, the map stays on the trip.)
function youNear() {
  const D = kmapData; if (!geoPos || !D || !D.pts || !D.pts.length) return false;
  return D.pts.some(p => hav(geoPos, { lng: p.ll[0], lat: p.ll[1] }) <= YOU_NEAR_KM);
}
function youCenter() {
  if (!kmap || !geoPos) return;
  if (!youNear()) {
    const D = kmapData, km = D && D.pts && D.pts.length ? Math.min(...D.pts.map(p => hav(geoPos, { lng: p.ll[0], lat: p.ll[1] }))) : null;
    youNote(km != null ? `You're ${km >= 100 ? Math.round(useMiles() ? km * KM_MI : km).toLocaleString("en") + (useMiles() ? " mi" : " km") : distTxt(km)} from this day's places. You'll show on the map once you're there.` : "You'll show on the map once you're near this day's places.");
    return;
  }
  kmap.easeTo({ center: [geoPos.lng, geoPos.lat], zoom: Math.max(kmap.getZoom(), 15.5), duration: 600 });
}
// A short line at the foot of the map, gone after a few seconds.
function youNote(msg) {
  if (!kmapEl) return;
  let n = kmapEl.querySelector(".you-note");
  if (!n) { n = document.createElement("div"); n.className = "you-note"; n.setAttribute("role", "status"); kmapEl.appendChild(n); }
  n.textContent = msg; n.hidden = false;
  clearTimeout(youNoteT); youNoteT = setTimeout(() => { n.hidden = true; }, 7000);
}
// The round button on the map, under + and −.
function youControl() {
  return { onAdd() {
    const box = document.createElement("div"); box.className = "maplibregl-ctrl maplibregl-ctrl-group you-ctrl";
    const b = document.createElement("button"); b.type = "button"; b.className = "you-btn"; b.title = "Show where I am"; b.setAttribute("aria-label", "Show where I am on the map");
    b.innerHTML = YOU_LOCATE;
    b.addEventListener("click", () => {
      youWanted = true;
      if (!navigator.geolocation) { youNote("This device can't share its location."); return; }
      if (youPerm === "denied") { youNote("Location is off for Kairoute. To see yourself on the map, allow location for Kairoute in your phone or browser settings."); youWatchStart(true); return; }
      if (youPerm !== "granted" && !geoPos) youNote("Your phone will ask to share your location. Kairoute uses it only to show you on the map and keep your day on time.");
      youWatchStart(true);
      if (geoPos && Date.now() - (geoPos.at || 0) < YOU_STALE_MS) { placeYou(); youCenter(); }
      else if (youErr) youNote("Looking for your location… You'll appear on the map as soon as your phone finds a signal.");
    });
    box.appendChild(b); this._box = box; return box;
  }, onRemove() { if (this._box) this._box.remove(); } };
}
// After each render: keep following while a map is on screen and the traveler has allowed location; stop otherwise.
function youAfterRender() {
  if (typeof document === "undefined" || !navigator.geolocation) return;
  const onMap = !!document.querySelector("#view [data-map]") && !document.hidden;
  if (!onMap) { youWatchStop(); clearInterval(youTicker); youTicker = null; return; }
  if (youPerm === "granted" || youWanted) youWatchStart(false);
  else if (youPerm === "unknown" && navigator.permissions && navigator.permissions.query) {
    youPerm = "checking";
    navigator.permissions.query({ name: "geolocation" }).then(p => {
      youPerm = p.state === "prompt" ? "unknown-asked" : p.state;
      if (p.state === "granted") youAfterRender();
      p.onchange = () => { youPerm = p.state; if (p.state === "granted") youAfterRender(); else if (p.state === "denied") youWatchStop(); };
    }).catch(() => { youPerm = "unknown-asked"; });
  }
  // A position from the live day or the tour that arrived without the map being told; and the grey "old" look.
  if (!youTicker) youTicker = setInterval(() => {
    if (!document.querySelector("#view [data-map]")) { clearInterval(youTicker); youTicker = null; return; }
    if (geoPos && geoPos.at !== youSeen) placeYou(); else youPaint();
  }, 2000);
}
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => { try { if (document.hidden) youWatchStop(); else youAfterRender(); } catch (e) {} });
// For the screen tests.
if (typeof window !== "undefined") window.__kairouteYouAge = ms => { if (geoPos) geoPos.at = Date.now() + ms; if (youFix) youFix.at = Date.now() + ms; youPaint(); };
if (typeof window !== "undefined") window.__kairouteYou = () => { const el = kmapYou && kmapYou.getElement(); const beam = el && el.querySelector(".you-beam");
  return { on: !!el, person: !!(el && el.querySelector(".you-pin svg")), stale: !!(el && el.classList.contains("stale")), beam: !!(beam && beam.style.display !== "none"), turn: beam ? beam.style.transform : "", label: el ? el.getAttribute("aria-label") : "", watching: youWatch != null, btn: !!document.querySelector("#view .you-btn"), note: (document.querySelector("#view .you-note:not([hidden])") || {}).textContent || "" }; };
