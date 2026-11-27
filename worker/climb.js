// How much a walk climbs and drops, from free height data (R-33; E48, Nov 24 2026: 21 walks were planned 5 to 12 min
// short because a walk's time came from its length alone: the Acropolis, Lycabettus, castle hills, the steps of a
// cliff town). A street route says how far a walk is, never how steep. climbOf(coords) takes the route's own path
// ([lng, lat] pairs), reads the ground height along it and adds up the metres climbed and dropped.
// Sources, both free with no key, tried in this order:
//   1. Valhalla's height service on the FOSSGIS server (the same host the routes come from);
//   2. Open Topo Data (api.opentopodata.org, the Mapzen 30 m terrain set; 100 points a request, 1 request a second,
//      1,000 a day: each walk is asked once and kept with its route for 90 days, shared by every traveler).
// Height data is rough (30 m squares, a metre or two of noise), so a rise or drop only counts once it passes 4 m from
// the last turning point; a flat street never "climbs". No answer from either source: null, and the walk keeps its
// time from the length alone (never a guessed climb).
const UA = { "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)" };
const hav = (a, b) => { const R = 6371000, r = Math.PI / 180, x = Math.sin((b[1] - a[1]) * r / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin((b[0] - a[0]) * r / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
// Points along the path about every `step` metres (at most `max`, both ends always in).
export function along(coords, step = 30, max = 100) {
  let len = 0; for (let i = 1; i < coords.length; i++) len += hav(coords[i - 1], coords[i]);
  const n = Math.max(2, Math.min(max, Math.ceil(len / step) + 1)), gap = len / (n - 1), out = [coords[0]]; let run = 0, want = gap;
  for (let i = 1; i < coords.length && out.length < n - 1; i++) { const a = coords[i - 1], b = coords[i], d = hav(a, b);
    while (d > 0 && run + d >= want && out.length < n - 1) { const f = (want - run) / d; out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); want += gap; }
    run += d; }
  out.push(coords[coords.length - 1]); return out;
}
// Metres up and down from a row of heights, counting a change only once it passes `noise` metres from the last turn.
export function upDown(h, noise = 4) {
  const v = h.filter(x => typeof x === "number" && isFinite(x)); if (v.length < 2 || v.length < h.length * 0.8) return null;
  let up = 0, down = 0, ref = v[0];
  for (const x of v) { if (x - ref >= noise) { up += x - ref; ref = x; } else if (ref - x >= noise) { down += ref - x; ref = x; } }
  return { up: Math.round(up), down: Math.round(down) };
}
async function valhallaHeights(pts, f) {
  const r = await f("https://valhalla1.openstreetmap.de/height", { method: "POST", headers: Object.assign({ "content-type": "application/json" }, UA), body: JSON.stringify({ shape: pts.map(p => ({ lat: p[1], lon: p[0] })), range: false }) });
  if (!r.ok) throw new Error("valhalla height " + r.status);
  const j = await r.json(); if (!Array.isArray(j.height) || j.height.length !== pts.length) throw new Error("valhalla height: no heights"); return j.height;
}
async function topoHeights(pts, f) {
  const r = await f("https://api.opentopodata.org/v1/mapzen?locations=" + pts.map(p => p[1].toFixed(5) + "," + p[0].toFixed(5)).join("|"), { headers: UA });
  if (!r.ok) throw new Error("opentopodata " + r.status);
  const j = await r.json(); if (!Array.isArray(j.results) || j.results.length !== pts.length) throw new Error("opentopodata: no heights"); return j.results.map(x => x.elevation);
}
export async function climbOf(coords, f = fetch) {
  if (!Array.isArray(coords) || coords.length < 2) return null; const pts = along(coords);
  for (const src of [valhallaHeights, topoHeights]) { try { const ud = upDown(await src(pts, f)); if (ud) return Object.assign(ud, { src: src === valhallaHeights ? "valhalla" : "opentopodata" }); } catch (e) { } }
  return null;
}
