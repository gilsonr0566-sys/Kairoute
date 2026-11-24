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
async function overpass(q, ms) {
  for (const ep of OVERPASS) { try { const r = await fetch(ep, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { ...UA, "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, signal: AbortSignal.timeout(ms) });
    if (r.ok) { const j = await r.json(); if (j && Array.isArray(j.elements) && !(j.remark && /runtime error|timed out/i.test(j.remark))) return j.elements; } } catch (e) {} }
  return null;
}
// Can a person walk from the centre to the island without a boat? The same test as the place files' (build.cjs).
async function walkTo(centre, s) {
  const p = insidePoint(s.rings.reduce((a, f) => ringArea(f) > ringArea(a) ? f : a));
  const url = "/route/v1/foot/" + [centre, p].map(q => (+q.lng).toFixed(5) + "," + (+q.lat).toFixed(5)).join(";") + "?steps=true&overview=false";
  const ask = async u => { try { const r = await fetch("https://routing.openstreetmap.de/routed-foot" + u, { headers: UA, signal: AbortSignal.timeout(12000) }); return r.ok || r.status === 400 ? await r.json() : null; } catch (e) { return null; } };
  const hasFerry = r => (r.legs || []).some(l => (l.steps || []).some(st => st.mode === "ferry"));
  let j = await ask(url); if (!j || !j.code) return undefined;   // not asked: the router didn't answer (asked again next time)
  if (j.code === "NoRoute") return false;
  if (j.code !== "Ok" || !j.routes || !j.routes[0]) return null;
  if (hasFerry(j.routes[0])) { j = await ask(url + "&exclude=ferry"); if (!j || !j.code) return undefined; if (j.code === "NoRoute") return false;
    if (j.code !== "Ok" || !j.routes || !j.routes[0] || hasFerry(j.routes[0])) return null; }
  const w = (j.waypoints || [])[1], on = w && w.location && s.rings.some(f => inRing(f, w.location[1], w.location[0]) || nearRing(f, w.location[1], w.location[0], 60));
  return !!on;
}
export async function islandsData(centre, env, codeKey, sha) {
  const t0 = Date.now(), c = { lat: +(+centre.lat).toFixed(3), lng: +(+centre.lng).toFixed(3) };
  const base = await codeKey("is", [rings, simplify, walkTo, islandsData]), key = base + c.lat + "," + c.lng, hit = await env.USAGE.get(key); if (hit) return JSON.parse(hit);
  // The outlines: kept 30 days as soon as they come back.
  const ok = base + "o:" + c.lat + "," + c.lng; let shapes = JSON.parse((await env.USAGE.get(ok)) || "null");
  if (!shapes) {
    const list = await overpass(`[out:json][timeout:25];(way["place"~"^(island|islet)$"](around:${ISLE_KM * 1000},${c.lat},${c.lng});relation["place"~"^(island|islet)$"](around:${ISLE_KM * 1000},${c.lat},${c.lng}););out tags bb;`, 28000);
    if (!list) return { error: "Busy", status: 503 };
    const small = list.filter(e => e.bounds && hav({ lat: e.bounds.minlat, lng: e.bounds.minlon }, { lat: e.bounds.maxlat, lng: e.bounds.maxlon }) <= 60).slice(0, 120);
    shapes = [];
    for (let i = 0; i < small.length; i += 60) { const part = small.slice(i, i + 60), ids = t => part.filter(e => e.type === t).map(e => e.id).join(",");
      const els = await overpass("[out:json][timeout:25];(" + (ids("way") ? `way(id:${ids("way")});` : "") + (ids("relation") ? `relation(id:${ids("relation")});` : "") + ");out tags geom;", 28000);
      if (!els) return { error: "Busy", status: 503 };
      for (const el of els) { const rs = rings(el).map(r => flat(simplify(r, 0.0003))).filter(f => f.length >= 8); if (!rs.length) continue;
        shapes.push({ id: el.type[0] + el.id, name: (el.tags && (el.tags["name:en"] || el.tags.name)) || "an island", rings: rs }); } }
    await env.USAGE.put(ok, JSON.stringify(shapes), { expirationTtl: 30 * 86400 });
  }
  const home = shapeAt(shapes, c.lat, c.lng); let open = 0;
  for (const s of shapes) {
    if (home && s.id === home.id) { s.walk = true; continue; }
    if (ringArea(s.rings[0]) < 2e-6) { s.walk = null; continue; }   // a rock under about 2 ha: never asked
    const wk = base + "w:" + c.lat + "," + c.lng + ":" + s.id, kept = await env.USAGE.get(wk);
    if (kept != null) { s.walk = JSON.parse(kept); continue; }
    if (Date.now() - t0 > 45000) { s.walk = null; open++; continue; }   // asked next time (the app waits 60 s for one ask)
    const w = await walkTo(c, s);
    if (w === undefined) { s.walk = null; open++; continue; }
    s.walk = w; await env.USAGE.put(wk, JSON.stringify(w), { expirationTtl: 90 * 86400 });
  }
  const res = { shapes, centreShape: home ? home.id : null, km: ISLE_KM, open };
  // Kept whole only when every island has its answer; until then each island's answer is kept on its own (above).
  if (!open) await env.USAGE.put(key, JSON.stringify(res), { expirationTtl: 30 * 86400 });
  return res;
}
