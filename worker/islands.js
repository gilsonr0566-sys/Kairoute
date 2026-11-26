// Island outlines around any place (rule R-06), for a place with no place file: the same answer tools/places/build.cjs
// writes into a place file (islandShapes there), made on the helper the first time a traveler's trip needs it and kept,
// so a stop across the water is a boat away in every city, not only in the cities that have a place file (Nov 24:
// "islands since Nov 21" kept coming back because the check only ever ran on the place files' cities).
// The map's islands and islets within KM of the place, outlines simplified (about 30 m), and for each one the place
// itself is not on: can a person walk there from the place without a boat (OSRM foot, boats left out). walk: true (a
// bridge or causeway), false (no way on foot), null (not known: the router couldn't say, or it wasn't asked in time).
// Every read is kept as soon as it comes back (the outlines, each island's walk answer), so an ask stopped part way
// loses nothing and the next ask goes on from there (R-34's way). An answer with any island not asked yet is kept a day.
const UA = { "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)" };
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
export const ISLE_KM = 12;

function rings(el) {
  const toPts = g => (g || []).filter(p => p && isFinite(p.lat) && isFinite(p.lon)).map(p => [p.lat, p.lon]);
  if (el.type === "way") { const r = toPts(el.geometry); return r.length >= 4 ? [r] : []; }
  const parts = (el.members || []).filter(m => m.type === "way" && (m.role === "outer" || m.role === "")).map(m => toPts(m.geometry)).filter(r => r.length >= 2);
  const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7, out = [];
  while (parts.length) {
    let ring = parts.shift();
    for (let grew = true; grew && !same(ring[0], ring[ring.length - 1]);) { grew = false;
      for (let i = 0; i < parts.length; i++) { const p = parts[i], end = ring[ring.length - 1];
        if (same(end, p[0])) ring = ring.concat(p.slice(1));
        else if (same(end, p[p.length - 1])) ring = ring.concat(p.slice(0, -1).reverse());
        else continue;
        parts.splice(i, 1); grew = true; break; } }
    if (ring.length >= 4 && same(ring[0], ring[ring.length - 1])) out.push(ring);
  }
  return out;
}
function simplify(r, tol) {
  if (r.length <= 4) return r.slice();
  const keep = new Array(r.length).fill(false); keep[0] = keep[r.length - 1] = true;
  const st = [[0, r.length - 1]];
  while (st.length) { const [a, b] = st.pop(); let far = -1, fd = 0;
    const [y1, x1] = r[a], [y2, x2] = r[b], dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) { const [y, x] = r[i];
      let t = L ? ((x - x1) * dx + (y - y1) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)); if (d > fd) { fd = d; far = i; } }
    if (far > 0 && fd > tol) { keep[far] = true; st.push([a, far], [far, b]); } }
  const out = r.filter((p, i) => keep[i]);
  if (out.length < 4) { const la = r.map(p => p[0]), ln = r.map(p => p[1]), s = Math.min(...la), n = Math.max(...la), w = Math.min(...ln), e = Math.max(...ln);
    return [[s, w], [s, e], [n, e], [n, w], [s, w]]; }
  return out;
}
const flat = r => r.flatMap(p => [+p[0].toFixed(5), +p[1].toFixed(5)]);
function inRing(f, lat, lng) {
  let inside = false;
  for (let i = 0, j = f.length - 2; i < f.length; j = i, i += 2) {
    const yi = f[i], xi = f[i + 1], yj = f[j], xj = f[j + 1];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside; }
  return inside;
}
const ringArea = f => { let a = 0; for (let i = 0, j = f.length - 2; i < f.length; j = i, i += 2) a += (f[j + 1] + f[i + 1]) * (f[j] - f[i]); return Math.abs(a / 2); };
function shapeAt(shapes, lat, lng) { let best = null, ba = Infinity;
  for (const s of shapes || []) for (const f of s.rings || []) if (inRing(f, lat, lng)) { const a = ringArea(f); if (a < ba) { ba = a; best = s; } }
  return best; }
function insidePoint(f) {
  const la = [], ln = []; for (let i = 0; i < f.length; i += 2) { la.push(f[i]); ln.push(f[i + 1]); }
  const s = Math.min(...la), n = Math.max(...la), w = Math.min(...ln), e = Math.max(...ln);
  let best = null, bd = -1;
  for (let a = 1; a < 12; a++) for (let b = 1; b < 12; b++) { const lat = s + (n - s) * a / 12, lng = w + (e - w) * b / 12;
    if (!inRing(f, lat, lng)) continue; let d = Infinity;
    for (let i = 0; i < f.length; i += 2) d = Math.min(d, Math.hypot(f[i] - lat, f[i + 1] - lng));
    if (d > bd) { bd = d; best = { lat, lng }; } }
  return best || { lat: la[0], lng: ln[0] };
}
function nearRing(f, lat, lng, m) {
  const ky = 111320, kx = 111320 * Math.cos(lat * Math.PI / 180);
  for (let i = 0, j = f.length - 2; i < f.length; j = i, i += 2) {
    const ax = (f[j + 1] - lng) * kx, ay = (f[j] - lat) * ky, bx = (f[i + 1] - lng) * kx, by = (f[i] - lat) * ky, dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0; if (Math.hypot(ax + t * dx, ay + t * dy) <= m) return true; }
  return false;
}
const hav = (a, b) => { const R = 6371, r = x => x * Math.PI / 180, dl = r(b.lat - a.lat), dg = r(b.lng - a.lng); const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dg / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
// Every map server at once, the first good answer wins: one after another, a busy first server used up the whole ask
// (Nov 24 live probe: "Busy" after 57 s on every ask, for Dubrovnik, Kotor and Nassau).
async function overpass(q, ms) {
  const one = ep => fetch(ep, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { ...UA, "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, signal: AbortSignal.timeout(ms) })
    .then(r => r.ok ? r.json() : Promise.reject(new Error("busy"))).then(j => j && Array.isArray(j.elements) && !(j.remark && /runtime error|timed out/i.test(j.remark)) ? j.elements : Promise.reject(new Error("bad")));
  try { return await Promise.any(OVERPASS.map(one)); } catch (e) { return null; }
}
// Can a person walk from the centre to the island without a boat? Answers { walk, why }.
// The walking router's fastest way may take a boat even where a bridge reaches the island (Venice: water buses), and it
// can't be told to leave boats out (Nov 24 live probe: Lokrum and 152 of Venice's 155 islands came back "not known").
// So when its way takes a boat: one of its other ways without a boat that ends on the island = a bridge; else the road
// router's way (it can't leave boats out either: "InvalidValue", Nov 24 probe) with no boat in it, ending on the island =
// a road bridge or causeway; else no way on foot. A car island with only a car ferry, or an island with no roads (its
// point taken to the mainland's nearest road), is only by boat.
async function walkTo(centre, s) {
  const p = insidePoint(s.rings.reduce((a, f) => ringArea(f) > ringArea(a) ? f : a));
  const pts = [centre, p].map(q => (+q.lng).toFixed(5) + "," + (+q.lat).toFixed(5)).join(";");
  const ask = async (prof, q) => { try { const r = await fetch("https://routing.openstreetmap.de/routed-" + prof + "/route/v1/" + (prof === "car" ? "driving" : "foot") + "/" + pts + q, { headers: UA, signal: AbortSignal.timeout(12000) }); return r.ok || r.status === 400 ? await r.json() : null; } catch (e) { return null; } };
  const hasFerry = r => (r.legs || []).some(l => (l.steps || []).some(st => st.mode === "ferry"));
  const ends = j => { const w = (j.waypoints || [])[1]; return !!(w && w.location && s.rings.some(f => inRing(f, w.location[1], w.location[0]) || nearRing(f, w.location[1], w.location[0], 60))); };
  const j = await ask("foot", "?steps=true&overview=false&alternatives=3"); if (!j || !j.code) return undefined;   // asked again next time
  if (j.code === "NoRoute") return { walk: false, why: "no path" };
  if (j.code !== "Ok" || !j.routes || !j.routes[0]) return { walk: null, why: "router said " + j.code };
  if (!ends(j)) return { walk: false, why: "paths end on another shore" };
  if (!hasFerry(j.routes[0])) return { walk: true, why: "path" };
  if (j.routes.some(r => !hasFerry(r))) return { walk: true, why: "path besides the boat" };
  const c = await ask("car", "?steps=true&overview=false"); if (!c || !c.code) return undefined;
  if (c.code === "Ok" && c.routes && c.routes[0] && !hasFerry(c.routes[0]) && ends(c)) return { walk: true, why: "road" };
  if (c.code === "Ok" || c.code === "NoRoute") return { walk: false, why: "only by boat" };
  return { walk: null, why: "road router said " + c.code };
}
export async function islandsData(centre, env, codeKey, sha) {
  const t0 = Date.now(), c = { lat: +(+centre.lat).toFixed(3), lng: +(+centre.lng).toFixed(3) };
  const base = await codeKey("is", [rings, simplify, walkTo, islandsData]), key = base + c.lat + "," + c.lng, hit = await env.USAGE.get(key); if (hit) return JSON.parse(hit);
  // The outlines: kept 30 days as soon as they come back.
  const ok = base + "o:" + c.lat + "," + c.lng; let shapes = JSON.parse((await env.USAGE.get(ok)) || "null");
  if (!shapes) {
    // One question for the outlines themselves (the size is told from each one's box afterwards).
    const els = await overpass(`[out:json][timeout:40];(way["place"~"^(island|islet)$"](around:${ISLE_KM * 1000},${c.lat},${c.lng});relation["place"~"^(island|islet)$"](around:${ISLE_KM * 1000},${c.lat},${c.lng}););out tags geom;`, 45000);
    if (!els) return { error: "Busy", status: 503 };
    shapes = [];
    for (const el of els) { const rs = rings(el).map(r => r).filter(r => r.length >= 4); if (!rs.length) continue;
      const la = rs.flat().map(p => p[0]), ln = rs.flat().map(p => p[1]); if (hav({ lat: Math.min(...la), lng: Math.min(...ln) }, { lat: Math.max(...la), lng: Math.max(...ln) }) > 60) continue;
      const fl = rs.map(r => flat(simplify(r, 0.0003))).filter(f => f.length >= 8); if (!fl.length) continue;
      shapes.push({ id: el.type[0] + el.id, name: (el.tags && (el.tags["name:en"] || el.tags.name)) || "an island", rings: fl }); if (shapes.length >= 120) break; }
    await env.USAGE.put(ok, JSON.stringify(shapes), { expirationTtl: 30 * 86400 });
  }
  const home = shapeAt(shapes, c.lat, c.lng); let open = 0;
  for (const s of shapes) {
    if (home && s.id === home.id) { s.walk = true; continue; }
    if (ringArea(s.rings[0]) < 2e-6) { s.walk = null; continue; }   // a rock under about 2 ha: never asked
    const wk = base + "w:" + c.lat + "," + c.lng + ":" + s.id, kept = await env.USAGE.get(wk);
    if (kept != null) { const k = JSON.parse(kept); s.walk = k && typeof k === "object" ? k.walk : k; if (k && k.why) s.why = k.why; continue; }
    if (Date.now() - t0 > 45000) { s.walk = null; open++; continue; }   // asked next time (the app waits 60 s for one ask)
    const w = await walkTo(c, s);
    if (w === undefined) { s.walk = null; open++; continue; }
    s.walk = w.walk; s.why = w.why; await env.USAGE.put(wk, JSON.stringify(w), { expirationTtl: 90 * 86400 });
  }
  const res = { shapes, centreShape: home ? home.id : null, km: ISLE_KM, open };
  // Kept whole only when every island has its answer; until then each island's answer is kept on its own (above).
  if (!open) await env.USAGE.put(key, JSON.stringify(res), { expirationTtl: 30 * 86400 });
  return res;
}
// Where the boats land on an island or island group a day out of a city (rule R-36, Nov 25: Hvar, the Princes' Islands
// and Lantau were never offered as day trips, because the encyclopedia's point for an island is its middle, kilometres
// from any pier, so no boat was ever found "near" it). The map's own outline of the place (the island or archipelago
// that carries its encyclopedia id) and the ferry terminals on it or on a pier just off it: real mapped piers, never a
// guessed one. No outline or no pier on the map: an empty list, and the app then says nothing about a boat.
export const LAND_M = 400;
export function piersOn(shapes, piers) {
  const out = [];
  for (const p of piers || []) { if (!isFinite(p.lat) || !isFinite(p.lng)) continue;
    if (!(shapes || []).some(f => inRing(f, p.lat, p.lng) || nearRing(f, p.lat, p.lng, LAND_M))) continue;
    if (out.some(q => hav(q, p) < 0.25)) continue;   // one landing, mapped twice (the terminal and its building)
    out.push({ name: String(p.name || "").slice(0, 60), lat: +(+p.lat).toFixed(5), lng: +(+p.lng).toFixed(5) }); }
  return out;
}
export async function landingData(wd, env, codeKey) {
  if (!/^Q\d+$/.test(String(wd || ""))) return { error: "Bad request", status: 400 };
  const key = (await codeKey("ld", [rings, simplify, piersOn, landingData])) + wd, hit = await env.USAGE.get(key); if (hit) return JSON.parse(hit);
  // The outline: the island or island group itself, and the islands that are its members.
  const els = await overpass(`[out:json][timeout:40];(way["wikidata"="${wd}"]["place"~"^(island|islet|archipelago)$"];relation["wikidata"="${wd}"]["place"~"^(island|islet|archipelago)$"];)->.i;(.i;relation(r.i);)->.all;.all out tags geom;`, 40000);
  if (!els) return { error: "Busy", status: 503 };
  const shapes = [];
  for (const el of els) for (const r of rings(el)) { if (r.length < 4) continue; const f = flat(simplify(r, 0.0003)); if (f.length >= 8) shapes.push(f); if (shapes.length >= 60) break; }
  let piers = [];
  if (shapes.length) {
    const la = [], ln = []; for (const f of shapes) for (let i = 0; i < f.length; i += 2) { la.push(f[i]); ln.push(f[i + 1]); }
    const pad = 0.006, box = [Math.min(...la) - pad, Math.min(...ln) - pad, Math.max(...la) + pad, Math.max(...ln) + pad].map(n => n.toFixed(4)).join(",");
    const ps = await overpass(`[out:json][timeout:30];(node["amenity"="ferry_terminal"](${box});way["amenity"="ferry_terminal"](${box}););out tags center 200;`, 30000);
    if (!ps) return { error: "Busy", status: 503 };
    piers = piersOn(shapes, ps.map(e => ({ name: (e.tags && (e.tags["name:en"] || e.tags.int_name || e.tags.name)) || "", lat: e.lat ?? (e.center && e.center.lat), lng: e.lon ?? (e.center && e.center.lon) })));
  }
  const res = { wd, outline: shapes.length > 0, piers: piers.slice(0, 40) };
  await env.USAGE.put(key, JSON.stringify(res), { expirationTtl: (piers.length ? 60 : 14) * 86400 });
  return res;
}
// The way by road to a place a day out (rule R-36): the road router's drive, and whether it takes a boat on the way (a
// drive with a car ferry in it is no "about 40 min by road"). { min, km, ferry } or, when no road goes there, { none: true }.
// Kept 90 days; a router that didn't answer keeps nothing and is asked again.
export async function roadWay(a, b, env, codeKey) {
  const r3 = n => (+n).toFixed(3), key = (await codeKey("rw", [roadWay])) + [a.lat, a.lng, b.lat, b.lng].map(r3).join(","), hit = await env.USAGE.get(key); if (hit) return JSON.parse(hit);
  let j = null;
  try { const r = await fetch(`https://routing.openstreetmap.de/routed-car/route/v1/driving/${(+a.lng).toFixed(5)},${(+a.lat).toFixed(5)};${(+b.lng).toFixed(5)},${(+b.lat).toFixed(5)}?steps=true&overview=false`, { headers: UA, signal: AbortSignal.timeout(15000) }); if (r.ok || r.status === 400) j = await r.json(); } catch (e) {}
  if (!j || !j.code) return { error: "Busy", status: 503 };
  let res;
  if (j.code === "NoRoute") res = { none: true };
  else if (j.code !== "Ok" || !j.routes || !j.routes[0]) return { error: "Busy", status: 503 };
  else { const rt = j.routes[0], w = (j.waypoints || [])[1], off = w && w.location ? hav({ lat: w.location[1], lng: w.location[0] }, b) : 0;
    // A road that ends more than 2 km from the place doesn't reach it (an island with no roads: the nearest mainland road).
    res = off > 2 ? { none: true } : { min: Math.round(rt.duration / 60), km: +(rt.distance / 1000).toFixed(1), ferry: (rt.legs || []).some(l => (l.steps || []).some(st => st.mode === "ferry")) }; }
  await env.USAGE.put(key, JSON.stringify(res), { expirationTtl: 90 * 86400 });
  return res;
}
export { walkTo as _walkTo };
