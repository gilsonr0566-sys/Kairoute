// Offline check of the ferry logic in worker/transit.js (no network): a ferry route mapped only by its course (no
// pier stops, like many seasonal coastal ferries) is offered between the two piers it passes, named after the
// nearest terminals, with its months from opening_hours or seasonal=*. Exits 1 on a problem.
import { ferryByCourse, runMonths, ferryChain } from "../worker/transit.js";
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
console.log(bad ? `${bad} ferry check(s) failed` : "ferry checks passed"); process.exit(bad ? 1 : 0);
