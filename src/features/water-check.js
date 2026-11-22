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
const WATER_STORE_V = 2;
const WATER_NO_ROAD = 1000; // metres: a stop this far from any road, with no path near it, is reached by boat
const WATER_FAR_ROAD = 400; // metres from a road a car can drive: a stop this far is checked on foot for a ferry
// The browser's own fetch, not the app's counting one: a question that fails or finds nothing changes no plan, so it must
// not make every plan look stale (Nov 20 sweep: offline, each failed question re-planned the day, an 8.7 s tick). An
// answer that does change something changes the place's own fields, and that re-plans it.
const waterFetch = (u, o) => (typeof window !== "undefined" && window.fetch ? window.fetch(u, o) : fetch(u, o));
const waterAsked = new Map();
const waterRoad = new Map(); // city key -> { q: the question (sig), wait: ids of stops still being walked }
// A stop whose water check is still out: the plan then never picks it on its own on a day with a time to be back
// (95-plan, autoPicks). Until the road answer is in, every stop of the place waits; after it, only the stops far from any
// road, which are walked next (Nov 21 live check: the whole ship day showed no sights while the walking routes came in).
function waterWaits(city, id) { if (!city) return false; const k = keyOf(city.city), q = waterAsked.get(k); if (!q || city.waterSig === q) return false;
  const r = waterRoad.get(k); return !r || r.q !== q || r.wait.has(String(id)); }
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
//   onFoot(i): true (a way on foot), "ferry" (the walking router's way takes a ferry), "none" (its paths don't join the
//   start's), false (no path near it), null (no answer). Across: a way on foot only by ferry, paths that don't join, or
//   on another island than every start with no path near it (a summit far from a path is not across by itself). A stop on
//   a start's island, or on the mainland with every start, is never across. The map's island question is often turned
//   away (Round 2 re-check: no answer in 3 of 6 places), so a ferry on the only way on foot is enough without it.
function waterAcross(pts, homes, isl, homeIsl, onFoot, far) {
  const share = (x, y) => !x ? !y : !!y && x.ids.some(id => y.ids.includes(id));
  const known = (homeIsl || []).filter(x => x !== null), out = {}, named = [];
  pts.forEach((p, i) => { const mine = isl ? isl[i] : null, walk = onFoot(i);
    if (walk == null || walk === true) return;
    if (mine != null && known.length && known.some(h => share(mine, h))) return;                           // a start's island, or the mainland
    // Another island than every start, or (no island answer) no path near a stop far out from any road: the road
    // router's nearest road is then over the water (Round 2: a volcano islet planned as "walk to the road, then taxi").
    const other = (mine && known.length) || (!mine && walk === false && far && far(i));
    if (!(walk === "ferry" || walk === "none" || (walk === false && other))) return;
    // The island's name; without the map's answer, stops close together share the first one's name (one island, one boat).
    const near = !mine && named.find(x => typeof hav === "function" && isFinite(+p.lat) && hav(x.p, p) <= 2);
    out[p.id] = mine ? mine.name : near ? near.name : (p.name || "an island"); named.push({ p, name: out[p.id] }); });
  return out;
}
async function waterOverpass(q) {
  for (const ep of OVERPASS_EPS) {
    try { const r = await waterFetch(ep, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "content-type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(45000) });
      if (!r.ok) continue; const d = await r.json(); if (d.remark && !(d.elements || []).length) continue; return d; } catch (e) {}
  }
  return null;
}
// On foot from a to b on OpenStreetMap's paths: true, "ferry" (only with a ferry), "none" (the paths there don't join
// the start's: another shore), false (no path near the stop), null (no answer).
async function waterFoot(a, b) {
  try { const r = await waterFetch(`https://routing.openstreetmap.de/routed-foot/route/v1/foot/${(+a.lng).toFixed(5)},${(+a.lat).toFixed(5)};${(+b.lng).toFixed(5)},${(+b.lat).toFixed(5)}?overview=false&steps=true`, { signal: AbortSignal.timeout(20000) });
    const j = await r.json(); if (j && j.code === "NoRoute") return "none"; if (!j || j.code !== "Ok" || !j.routes || !j.routes[0]) return null;
    const legs = j.routes[0].legs || [];
    // Snapped far from the stop (the nearest path is on the other shore) or a ferry on the way: not on foot.
    const snapFar = (j.waypoints || []).some(w => (w.distance || 0) > 300);
    return legs.some(l => (l.steps || []).some(st => st.mode === "ferry")) ? "ferry" : snapFar ? false : true; } catch (e) { return null; }
}
// How far each point is from a road a car can drive (metres), from the road router's snapping; null where not known.
async function waterRoadGaps(pts) {
  try { const coords = pts.map(p => (+p.lng).toFixed(5) + "," + (+p.lat).toFixed(5)).join(";");
    // Every point as a source and one destination: the answer's "sources" are each point snapped to its nearest road.
    const r = await waterFetch(`https://router.project-osrm.org/table/v1/driving/${coords}?destinations=0`, { signal: AbortSignal.timeout(20000) });
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
    // The map's island question is slow (30 to 40 s) and often turned away, so it runs beside the rest: the road router
    // (quick) says which stops are far from a road, those are walked first and the plan updated, then the islands.
    const pts = stops.concat(starts), islP = waterOverpass(waterIslandQuery(pts)).then(d => d ? waterIslandsFrom(d, pts.length) : null);
    const share = (x, y) => !x ? !y : !!y && x.ids.some(id => y.ids.includes(id));
    const foot = {}, asked = new Set();
    let gaps = null, sIsl = stops.map(() => null), hIsl = starts.map(() => null), isl = null;
    const walk = async list => { list = list.filter(i => !asked.has(i)).slice(0, 16 - asked.size); list.forEach(i => asked.add(i));
      const hk = hIsl.findIndex(h => h !== null), from = starts[hk >= 0 ? hk : 0];
      for (let k = 0; k < list.length; k += 4) await Promise.all(list.slice(k, k + 4).map(async i => { foot[i] = await waterFoot(from, stops[i]); })); };
    const apply = () => {
      const across = waterAcross(stops, starts, sIsl, hIsl, i => foot[i] === undefined ? (sIsl[i] != null && !asked.has(i) ? true : null) : foot[i], i => !!gaps && gaps[i] > WATER_NO_ROAD);
      const before = stops.map(s => ({ a: s.acrossWater, g: s.roadGap }));
      stops.forEach((s, i) => {
        // A stop is marked or cleared only on an answer about it (a walking route, or the map's island for one not walked).
        if (across[s.id]) s.acrossWater = across[s.id]; else if (foot[i] != null || (sIsl[i] != null && !asked.has(i))) delete s.acrossWater;
        if (gaps) { const g = gaps[i]; if (g != null && g > 150) s.roadGap = g; else if (g != null) delete s.roadGap; } });
      // The answer changes the place's own fields: plans made from the old ones are stale (the app's fetch wasn't used,
      // so the change is counted here; Round 2: stops across the water still planned on foot after the answer came).
      const changed = stops.some((s, i) => (s.acrossWater || null) !== (before[i].a || null) || (s.roadGap || null) !== (before[i].g || null));
      if (changed) { try { dataGen++; } catch (e) {} }
      try { save(); } catch (e) {}
      if (changed) try { render(); } catch (e) {} };
    gaps = await waterRoadGaps(stops);
    // Walking routes for the stops far from a road (the farthest first), then for any on another island than every start.
    // Only those still wait once the road answer is in (or none, when the road service didn't answer).
    const far = gaps ? stops.map((s, i) => i).filter(i => gaps[i] > WATER_FAR_ROAD).sort((x, y) => gaps[y] - gaps[x]) : [];
    waterRoad.set(keyOf(city.city), { q: sig, wait: new Set(far.slice(0, 16).map(i => String(stops[i].id))) }); try { dataGen++; render(); } catch (e) {}
    if (far.length) await walk(far);
    if (gaps || Object.keys(foot).length) apply();
    // The walking answers are in: no stop of the place waits any more.
    waterRoad.set(keyOf(city.city), { q: sig, wait: new Set() }); if (far.length) try { dataGen++; render(); } catch (e) {}
    isl = await islP;
    if (isl) { sIsl = isl.slice(0, stops.length); hIsl = isl.slice(stops.length);
      await walk(stops.map((s, i) => i).filter(i => sIsl[i] && !hIsl.some(h => h !== null && share(sIsl[i], h)))); apply(); }
    if (isl && gaps && [...asked].every(i => foot[i] != null)) { city.waterSig = sig; try { save(); } catch (e) {} }
    // A service busy or not answering (the map turns away a burst of questions): ask again in a few minutes.
    else setTimeout(() => { if (waterAsked.get(keyOf(city.city)) === sig) waterAsked.delete(keyOf(city.city)); }, 180000);
  })();
}
if (typeof window !== "undefined") window.__kairouteWater = { waterIslandQuery, waterIslandsFrom, waterAcross, waterWaits };
