// Island outlines for a place file (R-06, Nov 23). The map's islands (place=island or islet) within reach of the place,
// as simplified outlines, so the app knows offline whether ANY stop stands on an island: the place's own sights, a town a
// day away, a stop the traveler adds, a sight the travel guide or the helper brings in. Before this the file held an
// answer per sight id, and a stop that wasn't in the file when it was built (Lokrum off Dubrovnik) was planned as a taxi
// whenever the phone couldn't reach the busy map server for its own check.
// Pure geometry here (tested in tools/beta2/engine-test.cjs); the fetching is in build.cjs.

// A relation's outer ways, joined end to end into closed rings. A way already closed is a ring by itself.
function rings(el) {
  const toPts = g => (g || []).filter(p => p && isFinite(p.lat) && isFinite(p.lon)).map(p => [p.lat, p.lon]);
  if (el.type === 'way') { const r = toPts(el.geometry); return r.length >= 4 ? [r] : []; }
  const parts = (el.members || []).filter(m => m.type === 'way' && (m.role === 'outer' || m.role === '')).map(m => toPts(m.geometry)).filter(r => r.length >= 2);
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
// Douglas-Peucker in degrees (tol 0.0003 is about 30 m): the coast's small bends go, the island's shape stays.
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
  // A tiny islet can fold to a line: keep its four corners of the box instead, so it still has an inside.
  if (out.length < 4) { const la = r.map(p => p[0]), ln = r.map(p => p[1]), s = Math.min(...la), n = Math.max(...la), w = Math.min(...ln), e = Math.max(...ln);
    return [[s, w], [s, e], [n, e], [n, w], [s, w]]; }
  return out;
}
// Stored flat to keep the file small: [lat, lng, lat, lng, ...] at 5 decimals (about 1 m).
const flat = r => r.flatMap(p => [+p[0].toFixed(5), +p[1].toFixed(5)]);
// Point in a flat ring (ray casting).
function inRing(f, lat, lng) {
  let inside = false;
  for (let i = 0, j = f.length - 2; i < f.length; j = i, i += 2) {
    const yi = f[i], xi = f[i + 1], yj = f[j], xj = f[j + 1];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside; }
  return inside;
}
const ringArea = f => { let a = 0; for (let i = 0, j = f.length - 2; i < f.length; j = i, i += 2) a += (f[j + 1] + f[i + 1]) * (f[j] - f[i]); return Math.abs(a / 2); };
// The smallest island outline a point stands on (an islet inside a bigger island's outline counts as the islet).
function shapeAt(shapes, lat, lng) {
  let best = null, ba = Infinity;
  for (const s of shapes || []) for (const f of s.rings || []) if (inRing(f, lat, lng)) { const a = ringArea(f); if (a < ba) { ba = a; best = s; } }
  return best;
}
// A point well inside an outline, for the road router to aim at: the inside point of a grid over its box that is
// farthest from the coast (never a coast vertex, which the router would snap to the mainland's nearest road).
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
module.exports = { rings, simplify, flat, inRing, ringArea, shapeAt, insidePoint };
