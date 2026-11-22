// Offline check of the ferry logic in worker/transit.js (no network): a ferry route mapped only by its course (no
// pier stops, like many seasonal coastal ferries) is offered between the two piers it passes, named after the
// nearest terminals, with its months from opening_hours or seasonal=*. Exits 1 on a problem.
import { topRides, ferryByCourse, runMonths, ferryChain, transitOptions, slimFerries, ferryKey, keptFerries, timetableOptions, mergeRides } from "../worker/transit.js";
let bad = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) bad++; };
// Naples Molo Beverello to Amalfi along the coast (a course of a few points), as OpenStreetMap often maps it.
const line = [[40.8366, 14.2563], [40.79, 14.27], [40.70, 14.30], [40.62, 14.36], [40.58, 14.45], [40.60, 14.55], [40.6327, 14.6029]].map(([lat, lng]) => ({ lat, lng }));
const terminals = new Map([["n1", { name: "Molo Beverello", lat: 40.8366, lng: 14.2563 }], ["n2", { name: "Porto di Amalfi", lat: 40.6327, lng: 14.6029 }]]);
const ship = { lat: 40.8380, lng: 14.2550 }, amalfi = { lat: 40.6335, lng: 14.6025 };
const f = ferryByCourse({ name: "Napoli - Amalfi", operator: "Alilauro", opening_hours: "Apr-Oct" }, line, ship, amalfi, terminals, "r1");
ok(f && f.mode === "ferry", "ferry found from its course alone (no pier stops in the route)");
ok(f && f.from === "Molo Beverello" && f.to === "Porto di Amalfi", `piers named after the nearest terminals (${f && f.from} > ${f && f.to})`);
ok(f && f.ride >= 50 && f.ride <= 200, `cautious ride time (${f && f.ride} min for ${f && f.km} km)`);
ok(f && f.wait >= 60, `no timetable: plans for a full gap plus boarding (${f && f.wait} min)`);
ok(f && JSON.stringify(f.months) === "[4,5,6,7,8,9,10]", `runs April to October (${f && JSON.stringify(f.months)})`);
const back = ferryByCourse({ name: "Napoli - Amalfi" }, line, amalfi, ship, terminals, "r1");
ok(back && back.from === "Porto di Amalfi" && back.to === "Molo Beverello", "the same course works the other way");
ok(!ferryByCourse({}, line, ship, { lat: 40.75, lng: 14.48 }, terminals, "r1"), "no ferry offered to a place the course doesn't reach");
ok(JSON.stringify(runMonths("", "summer")) === "[6,7,8,9]", "seasonal=summer is June to September");
ok(runMonths("Mo-Su 08:00-19:00", "") === null, "daily hours with no months: all year");
ok(JSON.stringify(runMonths("May 15-Sep 30 08:00-18:00", "")) === "[5,6,7,8,9]", "May 15-Sep 30 read as May to September");
// One change: the map has Napoli - Capri and Capri - Amalfi but nothing straight from Naples to Amalfi.
const W = (id, name, pts, tags) => ({ type: "way", id, tags: Object.assign({ route: "ferry", name }, tags || {}), geometry: pts.map(([lat, lon]) => ({ lat, lon })) });
const ways = [W(1, "Napoli - Capri", [[40.8366, 14.2563], [40.70, 14.24], [40.5560, 14.2380]], { duration: "0:50" }), W(2, "Capri-Amalfi", [[40.5560, 14.2380], [40.58, 14.40], [40.6327, 14.6029]], { duration: "1:00", seasonal: "summer" }), W(3, "Napoli - Palermo", [[40.8366, 14.2563], [38.12, 13.36]])];
const ch = await ferryChain(ship, amalfi, ways);
ok(ch.length && /1 change at Capri/.test(ch[0].label), `ferry with one change offered (${ch[0] && ch[0].label})`);
ok(ch[0] && ch[0].min >= 50 + 60 + 60, `the change is planned with a full gap between sailings (${ch[0] && ch[0].min} min door to door)`);
ok(ch[0] && JSON.stringify(ch[0].months) === "[6,7,8,9]", `runs only when both ferries run (${ch[0] && JSON.stringify(ch[0].months)})`);
ok(!(await ferryChain(ship, { lat: 38.12, lng: 13.36 }, ways)).length, "no change offered where a ferry goes straight there");
// Busy map servers: a ferry once found at both ends is still offered from the kept answers (Richard saw no ferry
// from the ship to Sorrento while every map server was busy), and ends the servers couldn't answer are listed for
// the patient fill job.
{ const realFetch = globalThis.fetch; globalThis.fetch = async () => { throw new Error("busy"); };
  const sorrento = { lat: 40.6263, lng: 14.3757 }, mem = new Map(), store = { get: async k => mem.get(k) || null, put: async (k, v) => { mem.set(k, v); } };
  const sw = W(9, "Napoli - Sorrento", [[40.8366, 14.2563], [40.75, 14.30], [40.6290, 14.3760]], { operator: "NLG", duration: "0:40" });
  const kept = slimFerries({ elements: [sw, { type: "node", id: 1, lat: 40.8366, lon: 14.2563, tags: { amenity: "ferry_terminal", name: "Molo Beverello" } }, { type: "node", id: 2, lat: 40.6290, lon: 14.3760, tags: { amenity: "ferry_terminal", name: "Marina Piccola" } }] });
  mem.set("fp1:" + ferryKey(ship), kept); mem.set("fp1:" + ferryKey(sorrento), kept);
  const r = await transitOptions(ship, sorrento, store).catch(e => e);
  const fer = Array.isArray(r) && r.find(o => o.mode === "ferry");
  ok(!!fer, `ferry offered from kept answers while the map servers are busy (${fer ? fer.label + ", " + fer.from + " > " + fer.to + ", " + fer.min + " min" : r && r.message})`);
  ok(Array.isArray(r) && r.partial === true, "the answer is marked partial so the rail lines are asked again soon");
  const mem2 = new Map(), store2 = { get: async k => mem2.get(k) || null, put: async (k, v) => { mem2.set(k, v); } };
  const r2 = await transitOptions(ship, sorrento, store2).catch(e => e);
  ok(r2 instanceof Error && mem2.has("fq:" + ferryKey(ship)) && mem2.has("fq:" + ferryKey(sorrento)), "nothing kept and servers busy: both ends listed for the fill job");
  const kf = await keptFerries(ship, sorrento, store);
  ok(kf && kf.length === 1 && kf[0].mode === "ferry", "a saved answer without a ferry gets the kept ferry added (no map servers asked)");
  const mem3 = new Map(), store3 = { get: async k => mem3.get(k) || null, put: async (k, v) => { mem3.set(k, v); } };
  ok((await keptFerries(ship, sorrento, store3)) === null && mem3.has("fq:" + ferryKey(ship)), "nothing kept yet: none added, and the ends are listed for the schedule");
  const clipped = slimFerries({ elements: [{ type: "way", id: 5, tags: { route: "ferry" }, geometry: [null, { lat: 40.8, lon: 14.2 }, { lat: 40.7, lon: 14.3 }, null] }, { type: "relation", id: 6, tags: { route: "ferry" }, members: [{ type: "way", ref: 1, geometry: [null, { lat: 40.8, lon: 14.2 }] }] }] });
  ok(clipped.ways[0].geometry.length === 2 && clipped.rels.length === 1, "a course clipped to the day-trip box (map points outside it come back empty) is kept without them");
  globalThis.fetch = realFetch; }
// The helper itself: a saved train-only answer (as Richard's Naples day had) gets the ferry once both ends are known,
// and until then is marked partial so the page asks again instead of keeping it for good.
{ const realFetch = globalThis.fetch; globalThis.fetch = async () => { throw new Error("busy"); };
  const worker = (await import("../worker/worker.js")).default, kv = new Map();
  const env = { USAGE: { get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; }, put: async (k, v) => { kv.set(k, v); }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: [...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })) }) } };
  const ctx = { waitUntil: () => {} }, a = [40.852, 14.26], b = [40.6263, 14.3757];
  kv.set("tr11:wk:" + [...a, ...b].map(n => n.toFixed(3)).join(","), JSON.stringify({ opts: [{ mode: "train", label: "Train 1 (Eav) + 1 change", min: 112 }], partial: false, t: Date.now() }));
  const ask = async () => (await (await worker.fetch(new Request("https://x/transit", { method: "POST", body: JSON.stringify({ pairs: [{ a, b, dow: 3 }] }) }), env, ctx)).json()).results[0];
  const r1 = await ask();
  ok(r1.partial === true && !r1.opts.some(o => o.mode === "ferry"), "ferries at an end not known yet: the saved answer is sent as partial (asked again soon)");
  const sw = { type: "way", id: 9, tags: { route: "ferry", name: "Napoli - Sorrento", duration: "0:45" }, geometry: [[40.8366, 14.2563], [40.75, 14.30], [40.6290, 14.3760]].map(([lat, lon]) => ({ lat, lon })) };
  const kept = JSON.stringify(slimFerries({ elements: [sw] }));
  kv.set("fp1:" + ferryKey({ lat: a[0], lng: a[1] }), kept); kv.set("fp1:" + ferryKey({ lat: b[0], lng: b[1] }), kept);
  const r2 = await ask(), f2 = r2.opts.find(o => o.mode === "ferry");
  ok(!!f2 && r2.opts.some(o => o.mode === "train"), `once both ends are known the saved answer offers the ferry beside the train (${f2 ? f2.label + ", " + f2.min + " min" : "none"})`);
  globalThis.fetch = realFetch; }
// Nov 22 live probe: a kept partial answer (trains known only until 9:53 am) is looked up afresh after 2 minutes, not 10.
{ const realFetch = globalThis.fetch; globalThis.fetch = async () => { throw new Error("busy"); };
  const worker = (await import("../worker/worker.js")).default, kv = new Map(); let bg = 0;
  const env = { USAGE: { get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; }, put: async (k, v) => { kv.set(k, v); }, delete: async k => { kv.delete(k); }, list: async () => ({ keys: [] }) } };
  const ctx = { waitUntil: p => { bg++; p.catch(() => {}); } }, a = [41.9033, 12.4533], b = [42.095, 11.79], key = "tr11:wk:" + [...a, ...b].map(n => n.toFixed(3)).join(",");
  const ask = async () => (await (await worker.fetch(new Request("https://x/transit", { method: "POST", body: JSON.stringify({ pairs: [{ a, b, dow: 3 }] }) }), env, ctx)).json()).results[0];
  const put = age => { kv.clear(); kv.set(key, JSON.stringify({ opts: [{ mode: "train", label: "Train 1", min: 100, kindDeps: [{ t: 372 }, { t: 593 }] }], partial: true, ttMissed: 9, t: Date.now() - age })); bg = 0; };
  put(60000); await ask(); const young = kv.has("lk:" + key);
  put(180000); await ask(); const old = kv.has("lk:" + key);
  ok(!young && old, `a kept partial answer is looked up afresh after 2 minutes, not before (1 min: ${young}, 3 min: ${old})`);
  globalThis.fetch = realFetch; }
{ const many = [1, 2, 3, 4, 5].map(i => ({ mode: "train", label: "T" + i, min: 100 + i })).concat([{ mode: "ferry", label: "F", min: 134 }]), t = topRides(many, 5);
  ok(t.length === 5 && t.some(o => o.mode === "ferry"), "a long list of quicker trains never pushes the ferry out (" + t.map(o => o.label).join(",") + ")"); }
// Trip date: the timetable is asked for the trip's own date (a summer ferry shows only then), the answer marked with it;
// when that date isn't published yet (nothing comes back) the next date of the same weekday kind is asked instead.
// The date is a month ahead: dates more than 120 days out are not asked (operators haven't published them).
{ const realFetch = globalThis.fetch, asked = [], date = new Date(Date.now() + 30 * 86400e3).toISOString().slice(0, 10); let empty = false;
  const it = (h) => ({ startTime: `2027-07-12T0${h}:00:00Z`, endTime: `2027-07-12T0${h + 1}:30:00Z`, duration: 5400, legs: [{ mode: "FERRY", startTime: `2027-07-12T0${h}:00:00Z`, duration: 5400, routeShortName: "", agencyName: "NLG", from: { name: "Molo Beverello", tz: "Europe/Rome" }, to: { name: "Amalfi" } }] });
  globalThis.fetch = async u => { const t = new URL(u).searchParams.get("time"); asked.push(t); return { ok: true, json: async () => ({ itineraries: empty && t.startsWith(date) ? [] : [it(6), it(8)] }) }; };
  const A = { lat: 40.8366, lng: 14.2563 }, B = { lat: 40.6327, lng: 14.6029 };
  const r = await timetableOptions(A, B, 1, date);
  ok(asked.length && asked.every(t => t.startsWith(date)), `timetable asked for the trip's own date (${asked[0]})`);
  ok(r.length && r.every(o => o.forDate === date && o.mode === "ferry"), "rides found for that date are marked with it");
  asked.length = 0; empty = true;
  const r2 = await timetableOptions(A, B, 1, date);
  ok(asked.some(t => !t.startsWith(date)) && r2.every(o => !o.forDate), "date not published yet: the usual day is asked and the rides aren't marked as that date's");
  globalThis.fetch = realFetch; }
{ const slow = { mode: "ferry", label: "Ferry via Capri", min: 210 }, quick = { mode: "ferry", label: "Ferry Napoli - Amalfi", min: 120 }, train = { mode: "train", label: "Train", min: 150 };
  ok(mergeRides([slow, train], [quick]).includes(quick), "a slow timetable ferry never hides a much quicker map ferry");
  ok(!mergeRides([{ ...quick, min: 125 }, train], [quick]).includes(quick), "a timetable ferry about as quick replaces the map's estimate"); }
// How often a line runs is measured only inside one search (the Athens airport metro showed "every 4 h 12 min": the
// gap from the last morning departure to the first midday one), and is stated only from three departures.
{ const realFetch = globalThis.fetch; const at = (h, m) => `2027-06-30T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;
  const it = (h, m, mode, ref, dur) => ({ startTime: at(h, m), endTime: at(h, m + dur), duration: dur * 60, legs: [{ mode, startTime: at(h, m), duration: dur * 60, routeShortName: ref, agencyName: "OASA", from: { name: "Airport", tz: "Europe/Athens" }, to: { name: "Syntagma" } }] });
  globalThis.fetch = async u => { const t = new URL(u).searchParams.get("time"), h = +t.slice(11, 13);
    // each search (8:00, 12:00, 16:00): two metro departures 30 min apart, one suburban train, three X95 buses 20 min apart
    const its = [it(h, 0, "SUBWAY", "3", 40), it(h, 30, "SUBWAY", "3", 40), it(h, 10, "SUBURBAN", "A1", 50), it(h, 2, "BUS", "X95", 65), it(h, 22, "BUS", "X95", 65), it(h, 42, "BUS", "X95", 65)];
    return { ok: true, json: async () => ({ itineraries: its }) }; };
  const r = await timetableOptions({ lat: 37.9364, lng: 23.9445 }, { lat: 37.9755, lng: 23.7348 }, 3, "2027-06-30");
  const metro = r.find(o => o.mode === "metro"), bus = r.find(o => o.mode === "bus"), train = r.find(o => o.mode === "train");
  ok(metro && metro.every === 30, `no gap spans two searches hours apart (metro: every ${metro && metro.every})`);
  ok(train && train.everySrc === "none", `a line seen once per search never claims a frequency (train: ${train && train.everySrc})`);
  ok(bus && bus.every === 20 && bus.everySrc === "timetable" && bus.everyN >= 2, `three departures in one search give the real frequency (bus: every ${bus && bus.every}, ${bus && bus.everySrc})`);
  globalThis.fetch = realFetch;
  const m = n => ({ mode: "metro", label: "Metro 3 v" + n, min: 45 + n }), x95 = { mode: "bus", label: "Bus X95", min: 70 };
  const top = topRides([m(1), m(2), m(3), m(4), x95], 4);
  ok(top.includes(x95), "the quickest ride of each kind stays: four metro variants never push the airport bus out");
  const f = { mode: "ferry", label: "Ferry", min: 200 }, many = topRides([m(1), x95, { mode: "train", label: "Train", min: 50 }, { mode: "tram", label: "Tram", min: 60 }, f], 3);
  ok(many.includes(f), "a ferry still always stays when there are more kinds than room"); }
// An hour the timetable service turns away is asked again, and an hour it never answers marks the answer incomplete
// (Nov 21 live check: a ride kept with only the 1 to 3 pm searches knew no train after 4 pm: the way back became a taxi).
{ const realFetch = globalThis.fetch, tries = {}; let never = null;
  const at = (h, m) => `2027-06-30T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;
  const it = h => ({ startTime: at(h, 5), endTime: at(h, 50), duration: 2700, legs: [{ mode: "RAIL", startTime: at(h, 5), duration: 2700, routeShortName: "R" + h, agencyName: "Rail", from: { name: "A", tz: "UTC" }, to: { name: "B" } }] });
  globalThis.fetch = async u => { const t = new URL(u).searchParams.get("time"), h = +t.slice(11, 13); tries[h] = (tries[h] || 0) + 1;
    if (h === never || (h >= 15 && tries[h] === 1)) return { ok: false, status: 429, json: async () => ({}) };
    return { ok: true, json: async () => ({ itineraries: [it(h)] }) }; };
  const A = { lat: 0.0, lng: 0.0 }, B = { lat: 0.3, lng: 0.0 };
  const r = await timetableOptions(A, B, 3, "2027-06-30"), late = Math.max(0, ...r.flatMap(o => (o.kindDeps || []).map(d => d.t)));
  ok(r.missed === 0 && late >= 20 * 60, `hours turned away once are asked again: the day's last train is known (${Math.floor(late / 60)}:${String(late % 60).padStart(2, "0")}, ${r.missed} hours missed)`);
  for (const k in tries) delete tries[k]; never = 17;
  const r2 = await timetableOptions(A, B, 3, "2027-06-30");
  ok(r2.missed === 1, `an hour never answered is counted, so the answer is kept as incomplete and asked again (${r2.missed})`);
  globalThis.fetch = realFetch; }
console.log(bad ? `${bad} ferry check(s) failed` : "ferry checks passed"); process.exit(bad ? 1 : 0);
