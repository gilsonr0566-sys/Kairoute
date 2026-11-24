// Ride accuracy: how far the helper's ride estimates from the map (speed, waiting and boarding, walks at each end) are
// from the published timetables (Transitous, built on the operators' GTFS feeds), for the same kind of ride between the
// same two places. Places: every test trip in tools/beta2/snapshots (the 20-city list, the Greece and Bahamas trips):
// from where each day starts to its best-known sights farther than 2 km, and to its day trips.
// Usage: node tools/ride-accuracy.mjs [--transit live.js[,candidate.js]] [--names live,candidate] [--max N] [--minutes M] [--out file.json]
// No AI. Always exits 0 unless the check itself breaks: it reports, the summary says how close each kind is.
import fs from "fs"; import path from "path"; import { createRequire } from "module";
const require = createRequire(import.meta.url), arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
// One or more helper versions (comma-separated): the timetable is asked once, each version's map estimate is compared.
const SRCS = (arg("--transit") || new URL("../worker/transit.js", import.meta.url).pathname).split(","), NAMES = (arg("--names") || SRCS.map((x, i) => i ? "v" + i : "live").join(",")).split(",");
const MODS = []; for (const f of SRCS) MODS.push(await import(path.resolve(f))); const T = MODS[0];
for (const M of MODS) if (M.setMapWait) M.setMapWait(45000); // a runner gets a long wait on each map server
const BUDGET = +(arg("--minutes") || 150) * 60000, T0 = Date.now(); // stop asking in time to write the summary
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
// --legs: the rides the plans really hold (Nov 23, thread "Rebuild the testing and review process": ride times had been
// measured only from where a day starts to its sights, so the rides to and from airports, stations and piers, the ones
// a traveler can miss a flight or a ship on, were never compared with a timetable; the airport metro planned at 68 min
// against a timetabled 39 was found by an outside tester). Every ride of 2 km or more between two places in the plan of
// every day of every test trip, planned by the engine, the gate rides first.
if (process.argv.includes("--legs")) {
  pairs.length = 0; seen.clear();
  const E = require("./beta2/engine.cjs"), PD = path.join(path.dirname(new URL(import.meta.url).pathname), "places", "data"), places = {};
  if (fs.existsSync(PD)) for (const f of fs.readdirSync(PD).filter(f => f.endsWith(".json"))) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; }
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort()) {
    const s = JSON.parse(fs.readFileSync(path.join(dir, f))); let plans; try { plans = E.planTrip(E.applyPlaces(s, places)); } catch (e) { continue; }
    (s.days || []).forEach((d, i) => { const p = plans[i]; if (!p || !p.items || (ONLY && !ONLY.test(f + " " + d.city))) return;
      const its = p.items.filter(x => x.t !== "ride" && ok(x));
      for (let k = 1; k < its.length; k++) { const a = its[k - 1], b = its[k], km = hav(a, b); if (km < 2) continue;
        const gate = b.t === "end" || a.t === "start", key = [a.lat, a.lng, b.lat, b.lng].map(v => (+v).toFixed(3)).join(",");
        if (seen.has(key)) continue; seen.add(key);
        pairs.push({ trip: f.replace(/\.json$/, ""), city: d.city, from: a.name || a.t, to: b.name || b.t, a: { lat: +a.lat, lng: +a.lng }, b: { lat: +b.lat, lng: +b.lng }, km: +km.toFixed(1), gate, back: b.t === "end" && /^(port|departure|embark)$/.test(d.type || ""),
          dow: new Date(Date.parse(d.date + "T12:00:00Z")).getUTCDay() }); } });
  }
  // The ride back on a ship, train or flight day first (the one a traveler can miss the ship or train on), then the other
  // rides to and from a fixed point, so a run cut short has always measured those (Nov 24, testing thread).
  pairs.sort((x, y) => (y.back ? 1 : 0) - (x.back ? 1 : 0) || (y.gate ? 1 : 0) - (x.gate ? 1 : 0));
}
// --shard k/N: only every N-th ride from k (Nov 23: one runner got map answers for 47 of 171 rides in its time; several
// runners at once, each with its own share, measure them all).
{ const sh = arg("--shard"); if (sh) { const [k, n] = sh.split("/").map(Number); const keep = pairs.filter((_, i) => i % n === k); pairs.length = 0; pairs.push(...keep); } }
console.log(`Ride accuracy: ${pairs.length} rides from ${new Set(pairs.map(p => p.trip)).size} test trips${process.argv.includes("--legs") ? " (the rides the plans hold, " + pairs.filter(p => p.gate).length + " to or from an airport, station, pier or the day's start)" : ""}`);

// ---- Ask both sources for each ride ----
// Two rides at a time; the results are written after each ride, so a run cut short still has its numbers.
const sleep = ms => new Promise(r => setTimeout(r, ms)), byVer = NAMES.map(() => []), busyRows = [];
const best = (list, k, one) => list.filter(o => kindOf(o) === k && (!one || !/change/.test(o.label || ""))).sort((x, y) => x.min - y.min)[0];
// Each version keeps its own map answers for the run (ferries near a port, asked once for every ride from that port), as
// the live helper does with its store: Nov 24 the hourly run spent its time asking the busy map servers the same ferry
// question again for every ride and measured 17 of 87.
const MEM = NAMES.map(() => { const m = new Map(); return { get: async k => m.has(k) ? m.get(k) : null, put: async (k, v) => { m.set(k, v); } }; });
let done = 0, next = 0, stopped = false;
async function one(p) {
  let tt = [], why = [], gotMap = false;
  try { tt = await T.timetableOptions(p.a, p.b, p.dow); } catch (e) { why.push("timetable: " + e.message); }
  for (const [v, M] of MODS.entries()) {
    let map = [];
    // The free map servers turn busy runners away: one try, then one more after a pause, each with a long wait.
    for (let t = 0; t < 2; t++) {
      try { const m = await M.transitOptions(p.a, p.b, MEM[v]); map = Array.isArray(m) ? m : []; if (m && m.why) why.push(NAMES[v] + " map: " + m.why.join("; ")); break; }
      catch (e) { if (t) why.push(NAMES[v] + " map: " + e.message + (e.why ? " (" + e.why.join("; ") + ")" : "")); else await sleep(20000); }
    }
    if (map.length) gotMap = true;
    const rows = byVer[v];
    for (const k of new Set(map.map(kindOf))) {
      const est = best(map, k), real = best(tt, k, true) || best(tt, k);
      rows.push(!est || !real ? { ...p, kind: k, est: est && pick(est), real: null } : { ...p, kind: k, est: pick(est), real: pick(real), oneLeg: !/change/.test(real.label || "") });
    }
    // A ride kind the timetable knows and the map doesn't: the map would offer nothing (or a taxi) where a line runs.
    for (const k of new Set(tt.map(kindOf))) if (!map.some(o => kindOf(o) === k)) rows.push({ ...p, kind: k, est: null, real: pick(best(tt, k, true) || best(tt, k)) });
  }
  // A busy ferry lookup alone doesn't lose the ride: its train, metro and bus answers are still compared (Nov 24).
  if (why.length && !gotMap) busyRows.push({ ...p, kind: "-", why });
}
async function lane() {
  while (next < pairs.length) {
    if (Date.now() - T0 > BUDGET) { stopped = true; return; }
    const p = pairs[next++]; await one(p); done++;
    process.stdout.write(`\r  ${done}/${pairs.length}`);
    if (OUT) for (const [v] of MODS.entries()) fs.writeFileSync(outOf(v), JSON.stringify({ at: new Date().toISOString(), partial: true, done, rows: byVer[v] }, null, 1));
    await sleep(1000);
  }
}
const outOf = v => MODS.length === 1 ? OUT : OUT.replace(/(\.json)?$/, "-" + NAMES[v] + ".json");
await Promise.all(Array.from({ length: +(arg("--lanes") || 1) }, lane)); // one at a time by default: the map servers allow few at once
console.log(stopped ? `\nStopped at the time limit after ${done} of ${pairs.length} rides.` : "");
function pick(o) { return { label: o.label, min: o.min, ride: o.ride, wait: o.wait, every: o.every, everySrc: o.everySrc, access: o.access && o.access.min, egress: o.egress && o.egress.min, km: o.km, src: o.src }; }

// ---- How close: per kind, the in-vehicle time, the wait, the walks and the whole ride ----
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const within = (e, r) => Math.abs(e - r) <= Math.max(5, r * 0.2); // 5 min or 20%, whichever is more
function report(rows, name) {
const summary = {};
for (const k of [...new Set(rows.filter(r => r.kind !== "-").map(r => r.kind))].sort()) {
  const R = rows.filter(r => r.kind === k), both = R.filter(r => r.est && r.real), one = both.filter(r => r.oneLeg);
  const S = summary[k] = { rides: R.length, compared: both.length, mapOnly: R.filter(r => r.est && !r.real).length, timetableOnly: R.filter(r => !r.est && r.real).length };
  if (one.length) { const d = one.map(r => r.est.ride - r.real.ride); S.ride = { n: one.length, within: Math.round(100 * one.filter(r => within(r.est.ride, r.real.ride)).length / one.length), medianError: med(d.map(Math.abs)), medianBias: med(d) }; }
  if (both.length) { const d = both.map(r => r.est.min - r.real.min); S.total = { n: both.length, within: Math.round(100 * both.filter(r => within(r.est.min, r.real.min)).length / both.length), medianError: med(d.map(Math.abs)), medianBias: med(d) };
    const ev = both.filter(r => r.real.everySrc === "timetable"); if (ev.length) { const d2 = ev.map(r => r.est.every - r.real.every); S.every = { n: ev.length, medianError: med(d2.map(Math.abs)), medianBias: med(d2) }; }
    const w = both.map(r => (r.est.access + r.est.egress) - (r.real.access + r.real.egress)); S.walks = { n: both.length, medianError: med(w.map(Math.abs)), medianBias: med(w) }; }
}
console.log(`\n[${name}] Per kind (estimate minus timetable, minutes; 'within' = within 5 min or 20%):`);
for (const [k, S] of Object.entries(summary)) {
  console.log(`  ${k}: ${S.rides} rides, ${S.compared} with both, ${S.mapOnly} map only, ${S.timetableOnly} timetable only`);
  if (S.ride) console.log(`    in the vehicle (one line): ${S.ride.within}% within, median off ${S.ride.medianError}, bias ${S.ride.medianBias > 0 ? "+" : ""}${S.ride.medianBias} (${S.ride.n})`);
  if (S.total) console.log(`    whole ride:                ${S.total.within}% within, median off ${S.total.medianError}, bias ${S.total.medianBias > 0 ? "+" : ""}${S.total.medianBias} (${S.total.n})`);
  if (S.every) console.log(`    how often it runs:         median off ${S.every.medianError}, bias ${S.every.medianBias > 0 ? "+" : ""}${S.every.medianBias} (${S.every.n})`);
  if (S.walks) console.log(`    walks at both ends:        median off ${S.walks.medianError}, bias ${S.walks.medianBias > 0 ? "+" : ""}${S.walks.medianBias} (${S.walks.n})`);
}
const worst = rows.filter(r => r.est && r.real).map(r => ({ r, off: r.est.min - r.real.min })).sort((x, y) => Math.abs(y.off) - Math.abs(x.off)).slice(0, 25);
console.log(`\n[${name}] Furthest off (whole ride):`);
for (const { r, off } of worst) console.log(`  ${off > 0 ? "+" : ""}${off} min  ${r.kind}  ${r.trip}: ${r.from} > ${r.to} (${r.km} km)  map "${r.est.label}" ${r.est.min} (ride ${r.est.ride}, wait ${r.est.wait}, walks ${r.est.access}+${r.est.egress})  vs timetable "${r.real.label}" ${r.real.min} (ride ${r.real.ride}, wait ${r.real.wait}, every ${r.real.every}, walks ${r.real.access}+${r.real.egress})`);
return summary;
}
for (const [v] of MODS.entries()) { const summary = report(byVer[v], NAMES[v]); if (OUT) fs.writeFileSync(outOf(v), JSON.stringify({ at: new Date().toISOString(), done, of: pairs.length, summary, rows: byVer[v] }, null, 1)); }
if (busyRows.length) console.log(`\n${busyRows.length} rides with a busy source (not counted): ${busyRows.slice(0, 5).map(r => r.why.join(" / ")).join(" | ")}`);
