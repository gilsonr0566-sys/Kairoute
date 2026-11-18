// ---------- The street map's drawing layer ----------
// Everything Kairoute draws on top of the base map lives here, as one layer (Richard's rule, Nov 17: no patch layers):
//   1. the map and its route layers, the day's lines, markers and framing;
//   2. rides that read clearly: side by side when two share a road, direction arrows, a ride badge at each ride's
//      middle, the start and finish shown as what they are (cruise port, airport, station);
//   3. the base map's place names a little brighter, always below everything Kairoute draws;
//   4. the traveler as a small person, with the way they're facing.
// What feeds it stays in main.js: the plan as map data (mapPlanData), street routes (fetchRoutes, legLine), mounting
// the map in each screen's slot (mountMaps, mapSlot) and the offline map store.

// ---- 1. The map, the day's lines and markers ----
// The day's rides as map lines, each marked when it shares a road with another (drawn side by side).
function routeGeo(data, active) {
  return { type: "FeatureCollection", features: rideMarkShared(data.legs.map((l, i) => ({ type: "Feature", properties: { mode: l.mode, kind: l.kind || (l.mode === "foot" ? "walk" : "car"), on: active == null || active === i ? 1 : 0 }, geometry: { type: "LineString", coordinates: legLine(l) } }))) };
}
function cssVar(n, el) { return getComputedStyle(el || document.documentElement).getPropertyValue(n).trim(); }
// The one street map, made once per theme: base map, then the ride lines (case, one layer per kind of ride, each
// offset to its own side when it shares a road), the direction arrows, brighter place names and the locate button.
function ensureMap(ml) {
  const theme = mapDark() ? "dark" : "light";
  if (kmap && kmapTheme === theme) return kmap;
  if (kmap) { try { kmap.remove(); } catch (e) {} kmap = null; }
  kmapReady = false; kmapTheme = theme; kmapKey = "";
  if (!kmapEl) { kmapEl = document.createElement("div"); kmapEl.className = "kmap"; }
  kmap = new ml.Map({ container: kmapEl, style: MAP_TILES[theme], center: [0, 20], zoom: 1.5, attributionControl: { compact: true }, transformRequest: u => /^https:\/\/tiles\.openfreemap\.org\//.test(u) ? { url: u.replace(/^https:/, "kcache:") } : { url: u }, cooperativeGestures: true, dragRotate: false, pitchWithRotate: false, maxPitch: 0, fadeDuration: 0 });
  kmap.touchZoomRotate.disableRotation();
  kmap.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
  kmap.addControl(youControl(), "top-right");
  kmap.addControl(new ml.ScaleControl({ unit: useMiles() ? "imperial" : "metric", maxWidth: 90 }), "bottom-left");
  kmap.on("load", () => {
    const walk = cssVar("--route") || "#146B61";
    kmap.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    kmap.addLayer({ id: "route-case", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": theme === "dark" ? "#0B1716" : "#FFFFFF", "line-width": ["case", ["==", ["get", "on"], 1], 9, 6], "line-opacity": ["case", ["==", ["get", "on"], 1], 0.9, 0.4] } });
    // One layer per kind of leg: its own colour and line pattern (line patterns are in line widths here).
    for (const k of Object.keys(LEG_KINDS)) { const dash = LEG_KINDS[k].dash, w = k === "walk" ? [5, 3] : [4.5, 3];
      kmap.addLayer({ id: "route-" + k, type: "line", source: "route", filter: ["==", ["get", "kind"], k], layout: { "line-join": "round", "line-cap": k === "walk" || k === "ferry" ? "round" : "butt" },
        paint: Object.assign({ "line-color": cssVar("--t-" + k) || walk, "line-width": ["case", ["==", ["get", "on"], 1], w[0], w[1]], "line-opacity": ["case", ["==", ["get", "on"], 1], 1, 0.35] }, dash ? { "line-dasharray": dash.map(n => +(n / 3.5).toFixed(2)) } : {}) }); }
    rideLayers(kmap);
    mapLabelsBright(kmap, theme, true);
    kmapReady = true; kmapEl.dataset.ready = "1";
    mountMaps();
    prefetchTripMaps();
  });
  kmap.on("error", e => { if (!kmapReady && e && e.error && /style|fetch|Failed/i.test(String(e.error.message || ""))) kmapEl.dataset.failed = "1"; });
  return kmap;
}
// This screen's route and markers on the map: lines, stop markers, start and finish, ride badges, the traveler.
function drawMapData() {
  const ml = window.maplibregl, D = kmapData; if (!kmap || !kmapReady || !D || !ml) return;
  const src = kmap.getSource("route"); if (!src) return;
  src.setData(kmapGeo = routeGeo(D, D.active));
  const redraw = () => { if (kmapData === D && kmap.getSource("route")) { kmap.getSource("route").setData(kmapGeo = routeGeo(D, D.active)); rideBadges(); } };
  fetchRoutes(D.legs, redraw).then(() => { if (D.legs.some(l => !routeMem.has(legKey(l)))) setTimeout(() => { if (kmapData === D) fetchRoutes(D.legs, redraw); }, 21000); });
  const key = D.slot + "|" + D.key + "|" + (D.active == null ? "" : D.active);
  if (key === kmapKey) { placeYou(); return; }
  kmapKey = key;
  kmapMarks.forEach(m => m.remove()); kmapMarks = [];
  D.pts.forEach(p => {
    const el = document.createElement(p.id && D.slot === "plan" ? "button" : "div");
    el.className = "mk mk-" + p.kind + (D.focus && D.focus.includes(p.ll.join()) ? " on" : "");
    el.textContent = p.lab; el.title = p.name; el.setAttribute("aria-label", p.name);
    if (el.tagName === "BUTTON") { el.type = "button"; el.dataset.open = p.id; }
    if (p.kind === "start" || p.kind === "end") rideEndMarker(el, p);
    kmapMarks.push(new ml.Marker({ element: el }).setLngLat(p.ll).addTo(kmap));
  });
  placeYou();
  fitMap(D);
  rideBadges();
}
// Frame the day (or the leg being walked in the tour).
function fitMap(D) {
  const ml = window.maplibregl; if (!kmap || !ml) return;
  const coords = [];
  if (D.active != null && D.legs[D.active]) coords.push(...legLine(D.legs[D.active]));
  else {
    // Frame where the sightseeing happens. A far-off start or finish (an airport, a cruise port an hour away)
    // stays in view only when it is near the sights; otherwise its ride leaves the edge of the map.
    const core = D.pts.filter(p => p.kind !== "start" && p.kind !== "end"), use = core.length ? core : D.pts;
    const c = { lng: use.reduce((a, p) => a + p.ll[0], 0) / use.length, lat: use.reduce((a, p) => a + p.ll[1], 0) / use.length };
    const reach = Math.max(3, 1.5 * Math.max(...use.map(p => hav(c, { lng: p.ll[0], lat: p.ll[1] }))));
    const keep = D.pts.filter(p => use.includes(p) || hav(c, { lng: p.ll[0], lat: p.ll[1] }) <= reach), at = new Set(keep.map(p => p.ll.join()));
    keep.forEach(p => coords.push(p.ll));
    D.legs.forEach(l => { if (at.has(l.a.join()) && at.has(l.b.join())) coords.push(...legLine(l)); });
  }
  if (D.you && geoPos) coords.push([geoPos.lng, geoPos.lat]);
  if (!coords.length) return;
  const b = coords.reduce((bb, c) => bb.extend(c), new ml.LngLatBounds(coords[0], coords[0]));
  const w = kmapEl.clientWidth || 600, pad = Math.max(24, Math.min(60, Math.round(w / 10)));
  kmap.fitBounds(b, { padding: pad, maxZoom: 16.5, duration: 0 });
}

// ---- 2. Rides read clearly (Richard, Nov 18, Heraklion: "I only see one coming and going") ----
// On every street map, each ride can be followed on its own:
// - Two rides that share a road (out to a sight and back, or port -> sight -> town when port and town are close) are
//   drawn side by side, each on its own right-hand side, so both show instead of one hiding the other.
// - Small arrows along every line show which way it goes.
// - A small badge with the ride's icon (walk, taxi, metro, bus, ferry...) sits at the middle of each ride, in that
//   ride's colour. Short walks between neighbouring stops skip the badge when it would crowd the markers.
// - The day's start and finish (cruise port, airport, station or hotel) show their own icon instead of a letter.
const RIDE_SIDE_PX = 3.5, RIDE_SHARE = 0.3, RIDE_NEAR_M = 45;
let rideMarks = [], rideHooked = null;

// Metres between a point and a segment, on a flat local projection (fine at city scale).
function rideSegM(p, a, b, kx) {
  const ax = (a[0] - p[0]) * kx, ay = (a[1] - p[1]) * 111320, bx = (b[0] - p[0]) * kx, by = (b[1] - p[1]) * 111320;
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? -(ax * dx + ay * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(ax + t * dx, ay + t * dy);
}
// Points spread evenly along a line (by count of vertices; enough to tell whether two lines share a road).
function rideSamples(c, n) { if (c.length <= n) return c.slice(); const out = []; for (let i = 0; i < n; i++) out.push(c[Math.round(i * (c.length - 1) / (n - 1))]); return out; }
// For each line: does a good part of it run along another line of the same day? Those are drawn side by side.
function rideShared(lines) {
  const out = lines.map(() => false);
  for (let i = 0; i < lines.length; i++) {
    const s = rideSamples(lines[i], 24); if (s.length < 2) continue;
    const kx = 111320 * Math.cos(s[0][1] * Math.PI / 180);
    for (let j = 0; j < lines.length && !out[i]; j++) {
      if (j === i || lines[j].length < 2) continue;
      const L = lines[j]; let near = 0;
      for (const p of s) { for (let k = 1; k < L.length; k++) if (rideSegM(p, L[k - 1], L[k], kx) <= RIDE_NEAR_M) { near++; break; } }
      if (near / s.length >= RIDE_SHARE) out[i] = true;
    }
  }
  return out;
}
// Marks each line that shares a road (routeGeo).
function rideMarkShared(features) {
  const sh = rideShared(features.map(f => f.geometry.coordinates));
  features.forEach((f, i) => { f.properties.side = sh[i] ? 1 : 0; });
  return features;
}
// The arrow drawn along the lines: a white chevron with a dark edge, readable on every ride colour, light or dark.
function rideArrowImage() {
  const s = 2, w = 20 * s, h = 20 * s, c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.lineJoin = "round"; g.lineCap = "round";
  const path = () => { g.beginPath(); g.moveTo(6 * s, 4.5 * s); g.lineTo(13.5 * s, 10 * s); g.lineTo(6 * s, 15.5 * s); };
  g.strokeStyle = "rgba(10,25,24,.85)"; g.lineWidth = 5.5 * s; path(); g.stroke();
  g.strokeStyle = "#fff"; g.lineWidth = 2.6 * s; path(); g.stroke();
  return { width: w, height: h, data: g.getImageData(0, 0, w, h).data };
}
// Side-by-side offsets on the line layers, and the arrow layer (ensureMap, once the style has loaded).
function rideLayers(map) {
  const side = ["case", ["==", ["get", "side"], 1], RIDE_SIDE_PX, 0];
  (map.getStyle().layers || []).forEach(l => { if (/^route-/.test(l.id) && l.type === "line") map.setPaintProperty(l.id, "line-offset", side); });
  try { if (!map.hasImage("ride-arrow")) map.addImage("ride-arrow", rideArrowImage(), { pixelRatio: 2 }); } catch (e) { return; }
  if (!map.getLayer("route-arrows")) map.addLayer({ id: "route-arrows", type: "symbol", source: "route", filter: ["==", ["get", "on"], 1],
    layout: { "symbol-placement": "line", "symbol-spacing": 90, "icon-image": "ride-arrow", "icon-size": 0.75, "icon-rotation-alignment": "map", "icon-allow-overlap": true, "icon-ignore-placement": true,
      "icon-offset": ["case", ["==", ["get", "side"], 1], ["literal", [0, RIDE_SIDE_PX / 0.75]], ["literal", [0, 0]]] } });
}
// The point halfway along a line, by distance.
function rideMid(c) {
  if (c.length < 2) return c[0];
  const kx = Math.cos(c[0][1] * Math.PI / 180), seg = []; let tot = 0;
  for (let i = 1; i < c.length; i++) { const d = Math.hypot((c[i][0] - c[i - 1][0]) * kx, c[i][1] - c[i - 1][1]); seg.push(d); tot += d; }
  let half = tot / 2;
  for (let i = 0; i < seg.length; i++) { if (half <= seg[i] || i === seg.length - 1) { const t = seg[i] ? Math.min(1, half / seg[i]) : 0; return [c[i][0] + (c[i + 1][0] - c[i][0]) * t, c[i][1] + (c[i + 1][1] - c[i][1]) * t]; } half -= seg[i]; }
  return c[0];
}
const rideIcon = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${(LEG_KINDS[k] || LEG_KINDS.car).path}</svg>`;
// The ride badges at the middle of each ride. Rebuilt with the route; their show/hide is re-checked on zoom.
function rideBadges() {
  const ml = window.maplibregl, D = kmapData; rideMarks.forEach(m => m.remove()); rideMarks = [];
  if (!kmap || !ml || !D || !kmapGeo) return;
  kmapGeo.features.forEach((f, i) => {
    if (!f.properties.on || f.geometry.coordinates.length < 2) return;
    const k = f.properties.kind, el = document.createElement("div");
    el.className = "mk-ride k-" + k; el.innerHTML = rideIcon(k);
    el.setAttribute("aria-label", (LEG_KINDS[k] || LEG_KINDS.car).label); el.title = (LEG_KINDS[k] || LEG_KINDS.car).label;
    const m = new ml.Marker({ element: el }).setLngLat(rideMid(f.geometry.coordinates)).addTo(kmap);
    m._ride = { line: f.geometry.coordinates, side: f.properties.side, walk: k === "walk" }; rideMarks.push(m);
  });
  if (rideHooked !== kmap) { rideHooked = kmap; kmap.on("zoomend", rideFit); kmap.on("resize", rideFit); }
  rideFit();
}
// Hide a badge whose ride is too short on screen to need one, or that would sit on a stop marker; nudge a badge to
// its own side of the road when two rides share it.
function rideFit() {
  if (!kmap) return;
  const stops = kmapMarks.map(m => kmap.project(m.getLngLat()));
  rideMarks.forEach(m => {
    const r = m._ride, a = kmap.project(r.line[0]), b = kmap.project(r.line[r.line.length - 1]), at = kmap.project(m.getLngLat());
    let len = 0; for (let i = 1; i < r.line.length; i++) { const p = kmap.project(r.line[i - 1]), q = kmap.project(r.line[i]); len += Math.hypot(q.x - p.x, q.y - p.y); }
    const crowd = stops.some(s => Math.hypot(s.x - at.x, s.y - at.y) < 26);
    const hide = len < (r.walk ? 110 : 70) || crowd;
    m.getElement().style.display = hide ? "none" : "";
    if (r.side) { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; m.setOffset([-dy / l * 12, dx / l * 12]); }
  });
}
// The day's start and finish as what they are: a ship for a cruise port, a plane for an airport, a train for a
// station. Read from the plan's own words for the start and finish (Beta 2 adds a field).
function rideEndKind(name) {
  const t = String(name || "");
  if (/\b(ship|tender|cruise|port|pier|harbou?r|wharf|dock|jetty|terminal)\b/i.test(t) && !/airport|station/i.test(t)) return "ship";
  if (/airport|flight|\baero/i.test(t)) return "flight";
  if (/station|railway|bahnhof|stazione|gare\b|estaci[oó]n/i.test(t)) return "train";
  return "";
}
const RIDE_END_WORD = { ship: "Cruise port", flight: "Airport", train: "Station" };
// The start and finish markers (drawMapData).
function rideEndMarker(el, p) {
  const k = rideEndKind(p.name); if (!k) return;
  el.classList.add("mk-endk"); el.innerHTML = rideIcon(k) + `<span class="mk-endlab">${p.kind === "start" ? "Start" : "Finish"} · ${RIDE_END_WORD[k]}</span>`;
}
if (typeof window !== "undefined") window.__kairouteRides = () => ({
  side: kmapGeo ? kmapGeo.features.map(f => f.properties.side) : [], arrows: !!(kmap && kmap.getLayer && kmap.getLayer("route-arrows")),
  badges: rideMarks.map(m => ({ kind: m.getElement().className.replace(/^mk-ride k-/, ""), shown: m.getElement().style.display !== "none" })),
  ends: [...document.querySelectorAll("#view .mk-endk")].map(e => e.textContent) });
if (typeof window !== "undefined") window.__kairouteRideShared = lines => rideShared(lines);

// ---- 3. Place names a little brighter (Richard, Nov 18: dim on the dark map) ----
// The map's own street and place names get a little more contrast in both themes, with a halo so they stay crisp,
// while everything Kairoute draws (ride lines, arrows, stop markers, the location person) stays above them and bolder.
const MAP_LABELS = { dark: { color: "#C8D2D7", halo: "#0B1418" }, light: { color: "#4B5660", halo: "#FFFFFF" } };
function mapLabelsBright(map, theme, on) {
  const want = MAP_LABELS[theme] || MAP_LABELS.light;
  if (!map._labelOrig) map._labelOrig = {};
  (map.getStyle().layers || []).forEach(l => {
    if (l.type !== "symbol" || /^route-/.test(l.id) || !l.layout || !l.layout["text-field"]) return;
    if (!(l.id in map._labelOrig)) map._labelOrig[l.id] = ["text-color", "text-halo-color", "text-halo-width"].map(k => map.getPaintProperty(l.id, k));
    const o = map._labelOrig[l.id];
    try {
      // Water names keep their own colour (blue-grey on the sea), just with the stronger halo.
      if (on && !/water|ocean|sea|lake|river/i.test(l.id)) map.setPaintProperty(l.id, "text-color", want.color); else map.setPaintProperty(l.id, "text-color", o[0]);
      map.setPaintProperty(l.id, "text-halo-color", on ? want.halo : o[1]);
      map.setPaintProperty(l.id, "text-halo-width", on ? 1.4 : o[2]);
    } catch (e) {}
  });
}
if (typeof window !== "undefined") window.__kairouteLabels = on => { if (!kmap || !kmapReady) return null; if (on != null) mapLabelsBright(kmap, kmapTheme, on); return (kmap.getStyle().layers || []).filter(l => l.type === "symbol" && !/^route-/.test(l.id)).map(l => l.id + "=" + JSON.stringify(kmap.getPaintProperty(l.id, "text-color"))); };

// ---- 4. You on the map (Richard, Nov 18: "a little person on the map that shows where our current location is") ----
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
// Put the traveler on the map, or move them; called whenever the map or the position changes.
function placeYou() {
  const ml = window.maplibregl; if (!kmap || !ml) return;
  if (!geoPos || !kmapData) { if (kmapYou) { kmapYou.remove(); kmapYou = null; } return; }
  const ll = [geoPos.lng, geoPos.lat];
  if (!kmapYou) {
    kmapYou = new ml.Marker({ element: youElement() }).setLngLat(ll).addTo(kmap);
    if (kmapData.you && youNear()) fitMap(kmapData);
  } else kmapYou.setLngLat(ll);
  if (youHooked !== kmap) { youHooked = kmap; kmap.on("zoom", youPaint); kmap.on("rotate", youPaint); }
  if (geoPos.at !== youSeen) youWalkDir();
  youSeen = geoPos.at || 0;
  youPaint();
}
// The direction of walking, from the last two spots once they're far enough apart to be sure (standing still, GPS
// wanders). Works the same whichever part of the app is reading the position.
function youWalkDir() {
  const here = { lat: geoPos.lat, lng: geoPos.lng, at: geoPos.at || Date.now() };
  if (youTrail && here.at - youTrail.at < 60000) {
    if (hav(youTrail, here) * 1000 >= Math.max(8, (geoPos.acc || 0) * 0.6)) { youFix = { heading: youBearing(youTrail, here), at: Date.now() }; youTrail = here; }
  } else youTrail = here;
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
  if (youWatch != null || liveGeo != null || geoWatch != null) return; // already being read: one position for the whole app
  try {
    youWatch = navigator.geolocation.watchPosition(pos => {
      const c = pos.coords; youPerm = "granted"; youErr = "";
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
      if (youPerm === "denied" || geoPerm === "denied") { youNote("Location is off for Kairoute. To see yourself on the map, allow location for Kairoute in your phone or browser settings."); youWatchStart(true); return; }
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
  // The live day or the tour's Follow me took over reading the position: ours steps aside (one source for the app).
  if (youWatch != null && (liveGeo != null || geoWatch != null)) { try { navigator.geolocation.clearWatch(youWatch); } catch (e) {} youWatch = null; }
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
