// Real public transport between two points, from OpenStreetMap: the train, metro, tram, bus and ferry lines
// that stop near both ends, with the stop names, the line's real path between them (so the map draws the
// rail line or the ferry's course, not a straight line), and a cautious time. Nothing here is invented:
// every line, stop and operator is a mapped one. Times come from the line's own tags where mappers recorded
// them (duration, interval, opening hours, fare) and otherwise from cautious speeds for that kind of line.
// Used by the worker's /transit endpoint and by tools/transit-probe.mjs.

const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
const UA = { "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)" };
const R_STOP = 2500, R_FERRY = 1500; // how far from each end a station or pier may be (a walk or a short taxi)
// Cautious running speeds (km/h) and the time lost at each stop between, by kind of line.
const SPEED = { train: [55, 0.8], light_rail: [45, 0.7], subway: [33, 0.5], monorail: [30, 0.5], tram: [17, 0.4], bus: [24, 0.5], trolleybus: [20, 0.4], ferry: [28, 0] };
// How often a line usually runs (minutes) when mappers didn't record it: kept on the cautious side.
const EVERY = { train: 30, light_rail: 30, subway: 8, monorail: 10, tram: 12, bus: 30, trolleybus: 15, ferry: 60 };
const NAME = { train: "Train", light_rail: "Train", subway: "Metro", monorail: "Monorail", tram: "Tram", bus: "Bus", trolleybus: "Trolleybus", ferry: "Ferry" };

const rad = x => x * Math.PI / 180;
export const hav = (a, b) => { const dLa = rad(b.lat - a.lat), dLn = rad(b.lng - a.lng), s = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLn / 2) ** 2; return 12742 * Math.asin(Math.sqrt(s)); };
const mins = v => { const s = String(v || "").trim(); let m; if ((m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s))) return +m[1] * 60 + +m[2]; if ((m = /^(\d+(?:\.\d+)?)\s*(?:min|mins|minutes)?$/i.exec(s))) return +m[1]; return null; };
const lineLen = pts => pts.reduce((a, p, i) => a + (i ? hav(pts[i - 1], p) : 0), 0);

// Chain a route's ways into one line, flipping each way so it joins the last one.
function chain(ways) {
  let out = [];
  for (const w of ways) {
    let g = (w.geometry || []).map(p => ({ lat: p.lat, lng: p.lon })); if (g.length < 2) continue;
    if (!out.length) { out = g; continue; }
    const end = out[out.length - 1], start = out[0];
    const d = [hav(end, g[0]), hav(end, g[g.length - 1]), hav(start, g[0]), hav(start, g[g.length - 1])], k = d.indexOf(Math.min(...d));
    if (d[k] > 2) continue; // a gap: skip a stray piece rather than draw a jump
    if (k === 1) g = g.slice().reverse();
    if (k === 2) { out = out.slice().reverse(); }
    if (k === 3) { out = out.slice().reverse(); g = g.slice().reverse(); }
    out = out.concat(g.slice(1));
  }
  return out;
}
const nearestIdx = (pts, p) => { let bi = -1, bd = Infinity; pts.forEach((q, i) => { const d = hav(q, p); if (d < bd) { bd = d; bi = i; } }); return [bi, bd]; };
// Keep at most n points of a line for the map.
const thin = (pts, n) => { if (pts.length <= n) return pts; const step = (pts.length - 1) / (n - 1); return Array.from({ length: n }, (_, i) => pts[Math.round(i * step)]); };

async function overpass(q) {
  const why = [];
  for (const ep of OVERPASS) {
    try {
      const r = await fetch(ep, { method: "POST", signal: AbortSignal.timeout(15000), body: "data=" + encodeURIComponent(q), headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", ...UA } });
      if (r.ok) { const d = await r.json(); if (!d.remark || (d.elements || []).length) return d; why.push(ep.split("/")[2] + ": " + String(d.remark).slice(0, 60)); } else why.push(ep.split("/")[2] + ": " + r.status);
    } catch (e) { why.push(ep.split("/")[2] + ": " + String(e && e.name || e).slice(0, 40)); }
  }
  const e = new Error("map busy"); e.why = why; throw e;
}

// Getting from a point to a stop: walk up to 1.2 km, otherwise a short taxi.
const access = km => { const walk = km * 1.3; return walk <= 1.2 ? { how: "walk", min: Math.round(walk / 4.5 * 60), km: +walk.toFixed(2) } : { how: "taxi", min: Math.round(5 + km * 1.4 / 20 * 60), km: +(km * 1.4).toFixed(2) }; };

// ---- Real timetables (Transitous) ----
// Transitous is the free, open, worldwide journey planner built on the public GTFS timetables operators publish.
// It answers with real departures, lines, changes and the path of each ride. Kairoute asks for a typical day of
// the same kind as the trip day (weekday, Saturday or Sunday) in the coming weeks, mid-morning local time, and
// turns the answers into one option per way of making the trip: the typical door-to-door time, how often it
// runs, plus half the gap between departures as the wait (at most 15 min). Ferries are often missing from GTFS,
// so the map's ferry routes (below) are still added.
const TMODE = { RAIL: "Train", REGIONAL_RAIL: "Train", REGIONAL_FAST_RAIL: "Train", LONG_DISTANCE: "Train", HIGHSPEED_RAIL: "Train", NIGHT_RAIL: "Train", SUBURBAN: "Train", SUBWAY: "Metro", METRO: "Metro", TRAM: "Tram", BUS: "Bus", COACH: "Coach", FERRY: "Ferry", FUNICULAR: "Funicular", AERIAL_LIFT: "Cable car", CABLE_CAR: "Cable car" };
function decodePoly(str, prec) { const f = Math.pow(10, prec || 7), out = []; let i = 0, lat = 0, lng = 0;
  while (i < str.length) { for (const k of [0, 1]) { let sh = 0, r = 0, c; do { c = str.charCodeAt(i++) - 63; r |= (c & 31) << sh; sh += 5; } while (c >= 32 && i <= str.length); const d = r & 1 ? ~(r >> 1) : r >> 1; if (k) lng += d; else lat += d; } out.push({ lat: lat / f, lng: lng / f }); }
  return out; }
function dayFor(dow, lng, hh) { // the next date (from 2 days ahead) with the same kind of day, at about hh:00 local time
  const kind = x => x === 0 ? 0 : x === 6 ? 6 : 1, want = kind(dow == null ? 3 : dow), d = new Date(Date.now() + 2 * 86400000);
  for (let k = 0; k < 8 && kind(d.getUTCDay()) !== want; k++) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(hh - Math.round(lng / 15), 0, 0, 0); return d.toISOString().replace(/\.\d+Z$/, "Z"); }
// Minutes after local midnight for a departure, in the stop's own time zone.
function localMin(iso, tz, lng) {
  const t = new Date(iso); if (!isFinite(t)) return null;
  try { if (tz) { const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(t); const g = k => +(p.find(x => x.type === k) || {}).value; return g("hour") * 60 + g("minute"); } } catch (e) {}
  return ((t.getUTCHours() + Math.round(lng / 15)) * 60 + t.getUTCMinutes() + 1440) % 1440;
}
export async function timetableOptions(a, b, dow) {
  // Morning, midday and late afternoon, so the plan knows the departures through the day (the last ones back included).
  const ask = hh => fetch(`https://api.transitous.org/api/v1/plan?fromPlace=${a.lat},${a.lng}&toPlace=${b.lat},${b.lng}&time=${dayFor(dow, a.lng, hh)}&numItineraries=6`, { headers: UA, signal: AbortSignal.timeout(20000) }).then(r => r.ok ? r.json() : Promise.reject(new Error("timetable " + r.status)));
  const all = await Promise.allSettled([ask(8), ask(12), ask(16)]);
  if (!all.some(x => x.status === "fulfilled")) throw new Error("timetable busy");
  const seen = new Set(), its = []; for (const x of all) if (x.status === "fulfilled") for (const it of x.value.itineraries || []) { const k = it.startTime + "|" + it.endTime; if (!seen.has(k)) { seen.add(k); its.push(it); } }
  const groups = new Map();
  for (const it of its) {
    const legs = it.legs || [], ride = legs.filter(l => l.mode !== "WALK"); if (!ride.length) continue;
    const main = ride.reduce((x, y) => (y.duration || 0) > (x.duration || 0) ? y : x), key = ride.map(l => l.mode + (l.routeShortName || "")).join(">");
    (groups.get(key) || groups.set(key, []).get(key)).push({ it, legs, ride, main });
  }
  const out = [];
  for (const g of groups.values()) {
    const durs = g.map(x => x.it.duration / 60).sort((x, y) => x - y), typ = durs[Math.floor(durs.length / 2)];
    const starts = g.map(x => Date.parse(x.main.startTime)).sort((x, y) => x - y), gaps = starts.slice(1).map((t, i) => (t - starts[i]) / 60000).filter(x => x >= 3);
    const every = gaps.length ? Math.round(gaps.sort((x, y) => x - y)[Math.floor(gaps.length / 2)]) : null, ev = every || 30;
    const x = g[0], m = x.main, kind = TMODE[m.mode] || "Train", wait = Math.round(Math.min(ev * 0.5, 15) + 3);
    // Departure times of the first ride (local), and how long from walking off to arriving, for each.
    const first = r => r.ride[0], deps = g.map(r => ({ t: localMin(first(r).startTime, (first(r).from || {}).tz, a.lng), lead: Math.round((Date.parse(first(r).startTime) - Date.parse(r.it.startTime)) / 60000), dur: Math.round(r.it.duration / 60) })).filter(d => d.t != null).sort((p, q) => p.t - q.t);
    const walkA = x.legs[0] && x.legs[0].mode === "WALK" ? Math.round(x.legs[0].duration / 60) : 0, walkB = x.legs.length > 1 && x.legs[x.legs.length - 1].mode === "WALK" ? Math.round(x.legs[x.legs.length - 1].duration / 60) : 0;
    let path = []; for (const l of x.legs) if (l.legGeometry && l.legGeometry.points) path = path.concat(decodePoly(l.legGeometry.points, l.legGeometry.precision || 7));
    const nm = l => [TMODE[l.mode] || l.mode, l.routeShortName].filter(Boolean).join(" ") + (l.agencyName ? ` (${l.agencyName.replace(/\s*-\s*Divisione.*$/i, "").replace(/\b(srl|spa|s\.?l\.?|sau|sa)\b\.?/gi, "").replace(/\s+/g, " ").trim()})` : "");
    const steps = x.ride.map(l => `${nm(l)}: ${l.from && l.from.name} to ${l.to && l.to.name}, ${Math.round(l.duration / 60)} min`);
    const km = path.length > 1 ? lineLen(path) : hav(a, b) * 1.3;
    out.push({ mode: kind.toLowerCase(), kind, label: nm(m) + (x.ride.length > 1 ? ` + ${x.ride.length - 1} change${x.ride.length > 2 ? "s" : ""}` : ""), operator: "", from: (x.ride[0].from || {}).name || "", to: (x.ride[x.ride.length - 1].to || {}).name || "",
      ride: Math.round(typ - walkA - walkB), wait, every: ev, everySrc: every ? "timetable" : "usual", access: { how: "walk", min: walkA, km: +(walkA * 4.5 / 60).toFixed(2) }, egress: { how: "walk", min: walkB, km: +(walkB * 4.5 / 60).toFixed(2) },
      min: Math.round(typ + wait), km: +km.toFixed(1), stops: x.ride.reduce((n, l) => n + ((l.intermediateStops || []).length), 0), hours: "", fare: "", steps, deps: deps.slice(0, 30), checked: new Date().toISOString().slice(0, 10),
      path: thin(path.length > 1 ? path : [a, b], 160).map(p => [+p.lng.toFixed(5), +p.lat.toFixed(5)]), fromPt: [+a.lng, +a.lat], toPt: [+b.lng, +b.lat], src: "Transitous timetables (" + (m.agencyName || "operator") + ")" });
  }
  return out.sort((x, y) => x.min - y.min).slice(0, 4);
}
// Both sources: real timetables first; the map adds what timetables lack (ferries mostly). A map rail line is kept
// only when the timetables had no rail answer at all.
export async function allOptions(a, b, dow) {
  const [tt, map] = await Promise.all([timetableOptions(a, b, dow).catch(() => null), transitOptions(a, b).catch(() => null)]);
  if (!tt && !map) throw new Error("map busy");
  const t = tt || [], hasRail = t.some(o => /train|metro|tram/.test(o.mode));
  const m = (map || []).filter(o => o.mode === "ferry" ? !t.some(x => x.mode === "ferry") : !hasRail);
  return { opts: t.concat(m).sort((x, y) => x.min - y.min).slice(0, 5), partial: !tt || !map };
}
export async function transitOptions(a, b) {
  const A = `${a.lat},${a.lng}`, B = `${b.lat},${b.lng}`;
  // Rides of 4 km and more: rail and ferry lines (a bus or tram that far is slower than the taxi the plan offers
  // anyway). Two light questions instead of one heavy one, because the free map servers time out on heavy ones:
  // first which lines stop near both ends, then the path of the few that do.
  const stops = (P, set) => `(node(around:${R_STOP},${P})[railway~"^(station|halt|stop)$"];node(around:${R_STOP},${P})[public_transport=stop_position][~"^(train|light_rail|subway|monorail|ferry)$"~"^yes$"];node(around:${R_STOP},${P})[amenity=ferry_terminal];)->.${set};`;
  const RT = `[type=route][route~"^(train|light_rail|subway|monorail|ferry)$"]`;
  const q1 = `[out:json][timeout:20];${stops(A, "sa")}${stops(B, "sb")}rel(bn.sa)${RT}->.ra;rel(bn.sb)${RT}->.rb;rel.ra.rb;out ids;
way(around:${R_FERRY},${A})[route=ferry]->.fa;way(around:${R_FERRY},${B})[route=ferry]->.fb;way.fa.fb;out geom;
.sa out tags;.sb out tags;`;
  const d1 = await overpass(q1);
  const ids = (d1.elements || []).filter(e => e.type === "relation").map(e => e.id).slice(0, 6);
  const d2 = ids.length ? await overpass(`[out:json][timeout:25];rel(id:${ids.join(",")});out geom;`) : { elements: [] };
  const el = (d1.elements || []).filter(e => e.type !== "relation").concat(d2.elements || []), stopTag = new Map();
  for (const e of el) if ((e.type === "node" || e.type === "way") && e.tags && !(e.tags.route)) stopTag.set(e.type[0] + e.id, { name: e.tags["name:en"] || e.tags.name || "", lat: e.lat ?? (e.center && e.center.lat), lng: e.lon ?? (e.center && e.center.lon) });
  const opts = [];
  for (const r of el.filter(e => e.type === "relation" && e.tags)) {
    const t = r.tags, mode = t.route; if (!SPEED[mode]) continue;
    const mem = r.members || [];
    const stopsM = mem.map((m, i) => ({ m, i })).filter(({ m }) => m.type === "node" && /^(stop|stop_entry_only|stop_exit_only|platform|platform_entry_only|platform_exit_only|)$/.test(m.role || "") && isFinite(m.lat))
      .map(({ m, i }) => ({ i, lat: m.lat, lng: m.lon, id: "n" + m.ref, plat: /platform/.test(m.role || "") }));
    const ways = mem.filter(m => m.type === "way" && !/platform/.test(m.role || "") && m.geometry);
    // Prefer stop positions over platforms; fall back to platforms when a line maps only those.
    const pool = stopsM.some(s => !s.plat) ? stopsM.filter(s => !s.plat) : stopsM;
    if (pool.length < 2) continue;
    const near = p => { let best = null; pool.forEach((s, k) => { const km = hav(s, p); if (km * 1000 <= R_STOP && (!best || km < best.km)) best = { s, k, km }; }); return best; };
    const sa = near(a), sb = near(b); if (!sa || !sb || sa.k === sb.k) continue;
    if (sa.k > sb.k && /^2/.test(t["public_transport:version"] || "2") && mode !== "ferry") continue; // a one-way route: the other direction's relation covers this trip
    const between = Math.abs(sb.k - sa.k) - 1;
    const line = chain(ways);
    let path = [], km = hav(sa.s, sb.s) * 1.25;
    if (line.length >= 2) { const [ia, da] = nearestIdx(line, sa.s), [ib, db] = nearestIdx(line, sb.s);
      if (da < 0.5 && db < 0.5 && ia !== ib) { path = ia < ib ? line.slice(ia, ib + 1) : line.slice(ib, ia + 1).reverse(); const L = lineLen(path); if (L >= hav(sa.s, sb.s) * 0.9) km = L; else path = []; } }
    const [v, perStop] = SPEED[mode], total = line.length >= 2 ? lineLen(line) : 0, dur = mins(t.duration);
    let ride = dur && total > 0 ? dur * Math.min(1, km / total) : km / v * 60 + between * perStop;
    ride = Math.max(ride, km / (v * 1.6) * 60); // never quicker than the line could run
    const every = mins(t.interval), nmA = (stopTag.get(sa.s.id) || {}).name, nmB = (stopTag.get(sb.s.id) || {}).name;
    opts.push(mk({ mode, ref: t.ref || "", name: t.name || "", operator: t.operator || t.network || "", from: nmA || t.from || "", to: nmB || t.to || "", fromPt: sa.s, toPt: sb.s, km, ride, every, hours: t.opening_hours || "", fare: t.charge || t.fee || "", stops: between, path, a, b, osm: "r" + r.id }));
  }
  // Ferries are often mapped as one way from pier to pier rather than as a route relation.
  for (const w of el.filter(e => e.type === "way" && e.tags && e.tags.route === "ferry")) {
    const g = (w.geometry || []).map(p => ({ lat: p.lat, lng: p.lon })); if (g.length < 2) continue;
    const s = g[0], e = g[g.length - 1], fwd = hav(s, a) + hav(e, b) <= hav(e, a) + hav(s, b), from = fwd ? s : e, to = fwd ? e : s, path = fwd ? g : g.slice().reverse();
    const nmFrom = (fwd ? w.tags.from : w.tags.to) || "", nmTo = (fwd ? w.tags.to : w.tags.from) || "";
    if (hav(from, a) * 1000 > R_FERRY * 1.5 || hav(to, b) * 1000 > R_FERRY * 1.5) continue;
    const km = lineLen(path), dur = mins(w.tags.duration);
    opts.push(mk({ mode: "ferry", ref: w.tags.ref || "", name: w.tags.name || "", operator: w.tags.operator || "", from: nmFrom, to: nmTo, fromPt: from, toPt: to, km, ride: dur || km / SPEED.ferry[0] * 60, every: mins(w.tags.interval), hours: w.tags.opening_hours || "", fare: w.tags.charge || w.tags.fee || "", stops: 0, path, a, b, osm: "w" + w.id }));
  }
  // One option per line (the quickest way to ride it), quickest first.
  const best = new Map();
  for (const o of opts) { const k = o.mode + "|" + (o.ref || o.name || o.operator).toLowerCase(); if (!best.has(k) || best.get(k).min > o.min) best.set(k, o); }
  return [...best.values()].sort((x, y) => x.min - y.min).slice(0, 5);
}
function mk(o) {
  const acc = access(hav(o.a, o.fromPt)), egr = access(hav(o.toPt, o.b));
  const every = o.every && o.every >= 3 && o.every <= 240 ? Math.round(o.every) : null, ev = every || EVERY[o.mode];
  // No timetable here, only how often the line runs (or the usual for its kind): plan for the worst case, a full
  // gap between services (at most an hour), plus boarding. Ferries board early.
  const wait = Math.round(Math.min(ev, 60) + (o.mode === "ferry" ? 10 : 3));
  const ride = Math.round(o.ride);
  const label = [NAME[o.mode], o.ref && !(o.name || "").includes(o.ref) ? o.ref : "", o.name].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 80);
  return { mode: o.mode, kind: NAME[o.mode], label, operator: o.operator.slice(0, 60), from: o.from.slice(0, 60), to: o.to.slice(0, 60), ride, wait, every: ev, everySrc: every ? "map" : "usual", access: acc, egress: egr,
    min: acc.min + wait + ride + egr.min, km: +o.km.toFixed(1), stops: o.stops, hours: String(o.hours).slice(0, 80), fare: String(o.fare).slice(0, 40),
    path: thin(o.path.length >= 2 ? o.path : [o.fromPt, o.toPt], 120).map(p => [+p.lng.toFixed(5), +p.lat.toFixed(5)]),
    fromPt: [+o.fromPt.lng.toFixed(5), +o.fromPt.lat.toFixed(5)], toPt: [+o.toPt.lng.toFixed(5), +o.toPt.lat.toFixed(5)], src: "OpenStreetMap " + o.osm, noTimetable: true };
}
