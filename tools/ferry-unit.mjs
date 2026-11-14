// Offline check of the ferry logic in worker/transit.js (no network): a ferry route mapped only by its course (no
// pier stops, like many seasonal coastal ferries) is offered between the two piers it passes, named after the
// nearest terminals, with its months from opening_hours or seasonal=*. Exits 1 on a problem.
import { ferryByCourse, runMonths, ferryChain, transitOptions, slimFerries, ferryKey, keptFerries } from "../worker/transit.js";
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
  globalThis.fetch = realFetch; }
// The helper itself: a saved train-only answer (as Richard's Naples day had) gets the ferry once both ends are known,
// and until then is marked partial so the page asks again instead of keeping it for good.
{ const realFetch = globalThis.fetch; globalThis.fetch = async () => { throw new Error("busy"); };
  const worker = (await import("../worker/worker.js")).default, kv = new Map();
  const env = { USAGE: { get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; }, put: async (k, v) => { kv.set(k, v); }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: [...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })) }) } };
  const ctx = { waitUntil: () => {} }, a = [40.852, 14.26], b = [40.6263, 14.3757];
  kv.set("tr4:wk:" + [...a, ...b].map(n => n.toFixed(3)).join(","), JSON.stringify({ opts: [{ mode: "train", label: "Train 1 (Eav) + 1 change", min: 112 }], partial: false, t: Date.now() }));
  const ask = async () => (await (await worker.fetch(new Request("https://x/transit", { method: "POST", body: JSON.stringify({ pairs: [{ a, b, dow: 3 }] }) }), env, ctx)).json()).results[0];
  const r1 = await ask();
  ok(r1.partial === true && !r1.opts.some(o => o.mode === "ferry"), "ferries at an end not known yet: the saved answer is sent as partial (asked again soon)");
  const sw = { type: "way", id: 9, tags: { route: "ferry", name: "Napoli - Sorrento", duration: "0:45" }, geometry: [[40.8366, 14.2563], [40.75, 14.30], [40.6290, 14.3760]].map(([lat, lon]) => ({ lat, lon })) };
  const kept = JSON.stringify(slimFerries({ elements: [sw] }));
  kv.set("fp1:" + ferryKey({ lat: a[0], lng: a[1] }), kept); kv.set("fp1:" + ferryKey({ lat: b[0], lng: b[1] }), kept);
  const r2 = await ask(), f2 = r2.opts.find(o => o.mode === "ferry");
  ok(!!f2 && r2.opts.some(o => o.mode === "train"), `once both ends are known the saved answer offers the ferry beside the train (${f2 ? f2.label + ", " + f2.min + " min" : "none"})`);
  globalThis.fetch = realFetch; }
console.log(bad ? `${bad} ferry check(s) failed` : "ferry checks passed"); process.exit(bad ? 1 : 0);
