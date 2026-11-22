// Ride accuracy: how far the helper's ride estimates from the map (speed, waiting and boarding, walks at each end) are
// from the published timetables (Transitous, built on the operators' GTFS feeds), for the same kind of ride between the
// same two places. Places: every test trip in tools/beta2/snapshots (the 20-city list, the Greece and Bahamas trips):
// from where each day starts to its best-known sights farther than 2 km, and to its day trips.
// Usage: node tools/ride-accuracy.mjs [--transit path/to/transit.js] [--max N] [--out file.json]
// No AI. Always exits 0 unless the check itself breaks: it reports, the summary says how close each kind is.
import fs from "fs"; import path from "path"; import { createRequire } from "module";
const require = createRequire(import.meta.url), arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const T = await import(path.resolve(arg("--transit") || new URL("../worker/transit.js", import.meta.url).pathname));
const MAX = +(arg("--max") || 4), OUT = arg("--out"), ONLY = process.env.ONLY ? new RegExp(process.env.ONLY, "i") : null;
const hav = (a, b) => { const R = 6371, r = x => x * Math.PI / 180, dl = r(b.lat - a.lat), dg = r(b.lng - a.lng); const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dg / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const ok = p => p && isFinite(p.lat) && isFinite(p.lng);
// One kind for both sources: the map's modes and the timetable's kinds.
const KIND = { train: "train", light_rail: "train", rail: "train", subway: "metro", metro: "metro", monorail: "metro", tram: "tram", bus: "bus", trolleybus: "bus", coach: "bus", ferry: "ferry" };
const kindOf = o => KIND[String(o.mode || "").toLowerCase()] || String(o.mode || "").toLowerCase();

// ---- The places: each test trip's starting points and sights ----
const dir = path.join(path.dirname(new URL(import.meta.url).pathname), "beta2", "snapshots"), pairs = [], seen = new Set();
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort()) {
  const s = JSON.parse(fs.readFileSync(path.join(dir, f)));
  for (const d of s.days || []) {
    if (d.type === "sea" || d.noShore) continue;
    const city = (s.cities || {})[d.city]; if (!city) continue;
    if (ONLY && !ONLY.test(f + " " + d.city)) continue;
    const start = [d.point, d.lodging].find(ok); if (!start) continue;
    const sights = (city.sites || []).filter(x => ok(x) && hav(start, x) >= 2).sort((x, y) => (y.mustSee ? 1 : 0) - (x.mustSee ? 1 : 0) || (y.fame || 0) - (x.fame || 0));
    const far = (city.farther || []).filter(ok);
    let n = 0;
    for (const x of sights.slice(0, MAX).concat(far.slice(0, 2))) {
      const k = [start.lat, start.lng, x.lat, x.lng].map(v => (+v).toFixed(3)).join(",");
      if (seen.has(k)) continue; seen.add(k); n++;
      pairs.push({ trip: f.replace(/\.json$/, ""), city: d.city, from: start.name || "start", to: x.name, a: { lat: +start.lat, lng: +start.lng }, b: { lat: +x.lat, lng: +x.lng }, km: +hav(start, x).toFixed(1), dow: new Date(Date.parse(d.date + "T12:00:00Z")).getUTCDay() });
    }
  }
}
console.log(`Ride accuracy: ${pairs.length} rides from ${new Set(pairs.map(p => p.trip)).size} test trips`);

// ---- Ask both sources for each ride ----
const sleep = ms => new Promise(r => setTimeout(r, ms)), rows = [];
for (const [i, p] of pairs.entries()) {
  let tt = [], map = [], why = [];
  try { tt = await T.timetableOptions(p.a, p.b, p.dow); } catch (e) { why.push("timetable: " + e.message); }
  try { const m = await T.transitOptions(p.a, p.b); map = Array.isArray(m) ? m : []; if (m && m.why) why.push("map: " + m.why.join("; ")); } catch (e) { why.push("map: " + e.message); }
  const best = (list, k, one) => list.filter(o => kindOf(o) === k && (!one || !/change/.test(o.label || ""))).sort((x, y) => x.min - y.min)[0];
  for (const k of new Set(map.map(kindOf))) {
    const est = best(map, k), real = best(tt, k, true) || best(tt, k);
    if (!est || !real) { rows.push({ ...p, kind: k, est: est && pick(est), real: null }); continue; }
    rows.push({ ...p, kind: k, est: pick(est), real: pick(real), oneLeg: !/change/.test(real.label || "") });
  }
  // A ride kind the timetable knows and the map doesn't: the map would offer nothing (or a taxi) where a line runs.
  for (const k of new Set(tt.map(kindOf))) if (!map.some(o => kindOf(o) === k)) rows.push({ ...p, kind: k, est: null, real: pick(best(tt, k, true) || best(tt, k)) });
  if (why.length) rows.push({ ...p, kind: "-", why });
  process.stdout.write(`\r  ${i + 1}/${pairs.length}`);
  await sleep(1500);
}
function pick(o) { return { label: o.label, min: o.min, ride: o.ride, wait: o.wait, every: o.every, everySrc: o.everySrc, access: o.access && o.access.min, egress: o.egress && o.egress.min, km: o.km, src: o.src }; }
console.log("");

// ---- How close: per kind, the in-vehicle time, the wait, the walks and the whole ride ----
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const within = (e, r) => Math.abs(e - r) <= Math.max(5, r * 0.2); // 5 min or 20%, whichever is more
const summary = {};
for (const k of [...new Set(rows.filter(r => r.kind !== "-").map(r => r.kind))].sort()) {
  const R = rows.filter(r => r.kind === k), both = R.filter(r => r.est && r.real), one = both.filter(r => r.oneLeg);
  const S = summary[k] = { rides: R.length, compared: both.length, mapOnly: R.filter(r => r.est && !r.real).length, timetableOnly: R.filter(r => !r.est && r.real).length };
  if (one.length) { const d = one.map(r => r.est.ride - r.real.ride); S.ride = { n: one.length, within: Math.round(100 * one.filter(r => within(r.est.ride, r.real.ride)).length / one.length), medianError: med(d.map(Math.abs)), medianBias: med(d) }; }
  if (both.length) { const d = both.map(r => r.est.min - r.real.min); S.total = { n: both.length, within: Math.round(100 * both.filter(r => within(r.est.min, r.real.min)).length / both.length), medianError: med(d.map(Math.abs)), medianBias: med(d) };
    const ev = both.filter(r => r.real.everySrc === "timetable"); if (ev.length) { const d2 = ev.map(r => r.est.every - r.real.every); S.every = { n: ev.length, medianError: med(d2.map(Math.abs)), medianBias: med(d2) }; }
    const w = both.map(r => (r.est.access + r.est.egress) - (r.real.access + r.real.egress)); S.walks = { n: both.length, medianError: med(w.map(Math.abs)), medianBias: med(w) }; }
}
console.log("\nPer kind (estimate minus timetable, minutes; 'within' = within 5 min or 20%):");
for (const [k, S] of Object.entries(summary)) {
  console.log(`  ${k}: ${S.rides} rides, ${S.compared} with both, ${S.mapOnly} map only, ${S.timetableOnly} timetable only`);
  if (S.ride) console.log(`    in the vehicle (one line): ${S.ride.within}% within, median off ${S.ride.medianError}, bias ${S.ride.medianBias > 0 ? "+" : ""}${S.ride.medianBias} (${S.ride.n})`);
  if (S.total) console.log(`    whole ride:                ${S.total.within}% within, median off ${S.total.medianError}, bias ${S.total.medianBias > 0 ? "+" : ""}${S.total.medianBias} (${S.total.n})`);
  if (S.every) console.log(`    how often it runs:         median off ${S.every.medianError}, bias ${S.every.medianBias > 0 ? "+" : ""}${S.every.medianBias} (${S.every.n})`);
  if (S.walks) console.log(`    walks at both ends:        median off ${S.walks.medianError}, bias ${S.walks.medianBias > 0 ? "+" : ""}${S.walks.medianBias} (${S.walks.n})`);
}
const worst = rows.filter(r => r.est && r.real).map(r => ({ r, off: r.est.min - r.real.min })).sort((x, y) => Math.abs(y.off) - Math.abs(x.off)).slice(0, 25);
console.log("\nFurthest off (whole ride):");
for (const { r, off } of worst) console.log(`  ${off > 0 ? "+" : ""}${off} min  ${r.kind}  ${r.trip}: ${r.from} > ${r.to} (${r.km} km)  map "${r.est.label}" ${r.est.min} (ride ${r.est.ride}, wait ${r.est.wait}, walks ${r.est.access}+${r.est.egress})  vs timetable "${r.real.label}" ${r.real.min} (ride ${r.real.ride}, wait ${r.real.wait}, every ${r.real.every}, walks ${r.real.access}+${r.real.egress})`);
const busy = rows.filter(r => r.why); if (busy.length) console.log(`\n${busy.length} rides with a busy source (not counted): ${busy.slice(0, 5).map(r => r.why.join(" / ")).join(" | ")}`);
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), summary, rows }, null, 1));
