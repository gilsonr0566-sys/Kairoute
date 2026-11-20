// ===================== Across the water, and how far the road is =====================
// Round 1 outside test (Nov 20): stops on an island reached by taxi or on foot (Lokrum "Walk 6 min", Nea Kameni and
// Viðey by taxi, Château d'If by taxi) and taxis between the sights of a car-free city on the water. The map knows both,
// so the app asks it for every place, never a list of cities:
// - OpenStreetMap (Overpass): which mapped island (place=island or islet) each stop and each start point (pier, hotel,
//   the place's centre) stands on.
// - A stop on another island than every start point is checked with the free walking router on OpenStreetMap's paths:
//   no way there on foot, or only one with a ferry in it, and it is across the water (a bridge keeps it on land).
// - The free road router (OSRM) says how far each stop is from the nearest road a car can drive.
// The answers are kept with the place (its sights' own fields), so they are asked once and work offline. Free services,
// no AI, from the traveler's own connection. A service that doesn't answer changes nothing: the plan stays as it was.
const WATER_STORE_V = 1;
const waterAsked = new Map();
const OVERPASS_EPS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"];

// One question for all points: the islands each one stands on, as "id:name" ("" for none), in the points' order.
function waterIslandQuery(pts) {
  return "[out:json][timeout:40];" + pts.map((p, i) => `is_in(${(+p.lat).toFixed(5)},${(+p.lng).toFixed(5)})->.a;area.a["place"~"^(island|islet)$"];make w i=${i},isl=set(id()),nm=set(t["name:en"]),nl=set(t["name"]);out;`).join("");
}
// The islands per point from the answer: each "w" element carries its point's index, the area ids and the names.
function waterIslandsFrom(d, n) {
  const out = new Array(n).fill(null);
  for (const e of (d && d.elements) || []) { const t = e.tags || {}, i = +t.i; if (!(i >= 0 && i < n)) continue;
    const ids = String(t.isl || "").split(";").filter(Boolean); if (!ids.length) { out[i] = ""; continue; }
    // The smallest island a point stands on is listed first by the map when islets sit inside a bigger island's outline;
    // any one shared is enough to be on the same island.
    out[i] = { ids, name: String(t.nm || "").split(";")[0] || String(t.nl || "").split(";")[0] || "an island" }; }
  return out;
}
// The rule, apart from the fetching (so it can be tested): which stops are across the water.
//   pts: the stops; homes: the start points; isl / homeIsl: the islands from waterIslandsFrom (null = not known);
//   onFoot(i, h): true (a way on foot with no ferry), false (none, or only with a ferry), null (not known).
function waterAcross(pts, homes, isl, homeIsl, onFoot) {
  const known = homeIsl.filter(x => x !== null); if (!known.length) return {};
  const share = (x, y) => !x ? !y : !!y && x.ids.some(id => y.ids.includes(id));
  const out = {};
  pts.forEach((p, i) => { const mine = isl[i]; if (mine == null || !mine) return;                      // not known, or on the mainland
    if (known.some(h => share(mine, h))) return;                                                       // the same island as a start
    const hi = homes.findIndex((h, k) => homeIsl[k] !== null), walk = onFoot(i, hi);
    if (walk === false) out[p.id] = mine.name; });
  return out;
}
async function waterOverpass(q) {
  for (const ep of OVERPASS_EPS) {
    try { const r = await fetch(ep, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "content-type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(45000) });
      if (!r.ok) continue; const d = await r.json(); if (d.remark && !(d.elements || []).length) continue; return d; } catch (e) {}
  }
  return null;
}
// On foot from a to b on OpenStreetMap's paths: true, false (no way, or a ferry on it), null (no answer).
async function waterFoot(a, b) {
  try { const r = await fetch(`https://routing.openstreetmap.de/routed-foot/route/v1/foot/${(+a.lng).toFixed(5)},${(+a.lat).toFixed(5)};${(+b.lng).toFixed(5)},${(+b.lat).toFixed(5)}?overview=false&steps=true`, { signal: AbortSignal.timeout(20000) });
    const j = await r.json(); if (j && j.code === "NoRoute") return false; if (!j || j.code !== "Ok" || !j.routes || !j.routes[0]) return null;
    const legs = j.routes[0].legs || [];
    // Snapped far from the stop (the nearest path is on the other shore) or a ferry on the way: not on foot.
    const snapFar = (j.waypoints || []).some(w => (w.distance || 0) > 300);
    return !(snapFar || legs.some(l => (l.steps || []).some(st => st.mode === "ferry"))); } catch (e) { return null; }
}
// How far each point is from a road a car can drive (metres), from the road router's snapping; null where not known.
async function waterRoadGaps(pts) {
  try { const coords = pts.map(p => (+p.lng).toFixed(5) + "," + (+p.lat).toFixed(5)).join(";");
    // Every point as a source and one destination: the answer's "sources" are each point snapped to its nearest road.
    const r = await fetch(`https://router.project-osrm.org/table/v1/driving/${coords}?destinations=0`, { signal: AbortSignal.timeout(20000) });
    const k = await r.json(); if (!k || k.code !== "Ok" || !Array.isArray(k.sources)) return null;
    return k.sources.map(w => isFinite(w && w.distance) ? Math.round(w.distance) : null);
  } catch (e) { return null; }
}
// Ask once per place (and again only when its stops change); the answers become the sights' own fields.
function waterCheck(city, homes) {
  if (!city || typeof fetch !== "function" || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
  const stops = allSites(city).filter(s => isFinite(+s.lat) && isFinite(+s.lng)).slice(0, 80);
  const starts = (homes || []).filter(p => p && isFinite(+p.lat) && isFinite(+p.lng)).slice(0, 6);
  if (!stops.length || !starts.length) return;
  const sig = WATER_STORE_V + "|" + stops.map(s => s.id).join(",") + "|" + starts.map(p => (+p.lat).toFixed(3) + "," + (+p.lng).toFixed(3)).join(";");
  if (city.waterSig === sig || waterAsked.get(keyOf(city.city)) === sig) return;
  waterAsked.set(keyOf(city.city), sig);
  (async () => {
    const pts = stops.concat(starts), d = await waterOverpass(waterIslandQuery(pts));
    const isl = d ? waterIslandsFrom(d, pts.length) : null;
    const across = {};
    if (isl) { const sIsl = isl.slice(0, stops.length), hIsl = isl.slice(stops.length), foot = {};
      // Walking routes only for the stops on another island than every start (a few per place at most).
      const cand = stops.map((s, i) => i).filter(i => sIsl[i] && !hIsl.some(h => h !== null && (h ? h.ids.some(id => sIsl[i].ids.includes(id)) : false)));
      for (const i of cand.slice(0, 12)) { const hi = hIsl.findIndex(h => h !== null); foot[i] = hi >= 0 ? await waterFoot(starts[hi], stops[i]) : null; }
      Object.assign(across, waterAcross(stops, starts, sIsl, hIsl, i => foot[i] == null ? null : foot[i])); }
    const gaps = await waterRoadGaps(stops);
    // Nothing answered: ask again another time.
    if (!isl && !gaps) { waterAsked.delete(keyOf(city.city)); return; }
    stops.forEach((s, i) => {
      if (isl) { if (across[s.id]) s.acrossWater = across[s.id]; else delete s.acrossWater; }
      if (gaps) { const g = gaps[i]; if (g != null && g > 150) s.roadGap = g; else if (g != null) delete s.roadGap; } });
    if (isl && gaps) city.waterSig = sig;
    // One service busy (the map turns away a burst of questions): ask the rest again in a few minutes.
    else setTimeout(() => { if (waterAsked.get(keyOf(city.city)) === sig) waterAsked.delete(keyOf(city.city)); }, 180000);
    try { save(); } catch (e) {}
    try { render(); } catch (e) {}
  })();
}
if (typeof window !== "undefined") window.__kairouteWater = { waterIslandQuery, waterIslandsFrom, waterAcross };
