// Offline check (no network, no AI) of how worker/transit.js finds a train between towns whose stations are beyond a
// short walk: Athens to the Corinth Canal and to Ancient Corinth. The map servers are stood in for by a small mapped
// suburban line (stations Athens, Isthmos, Corinth, Kiato) and a metro line, shaped as OpenStreetMap answers.
// Exits 1 on a problem.
import { transitOptions, trainReach } from "../worker/transit.js";
let bad = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) bad++; };
const P = (lat, lng) => ({ lat, lng });
const syntagma = P(37.9755, 23.7348), canal = P(37.9353, 22.9878), ancient = P(37.9057, 22.8800), larissa = P(38.0034, 23.7207);
const ST = [[1, "Athens", 38.0034, 23.7207], [2, "Ano Liosia", 38.0700, 23.6900], [3, "Megara", 37.9950, 23.3500], [4, "Isthmos", 37.9195, 22.9937], [5, "Corinth", 37.9246, 22.9277], [6, "Kiato", 38.0100, 22.7500]];
const MT = [[11, "Syntagma", 37.9755, 23.7348], [12, "Larissa Station", 38.0040, 23.7210], [13, "Sepolia", 38.0130, 23.7140]]; // a metro line, for the "never stretched" check
const node = ([id, name, lat, lon]) => ({ type: "node", id, lat, lon, tags: { name, railway: "station" } });
const rel = (id, route, name, list, en) => ({ type: "relation", id, tags: Object.assign({ type: "route", route, name, "public_transport:version": "1" }, en ? { "name:en": en } : {}),
  members: list.map(([ref, , lat, lon]) => ({ type: "node", ref, role: "stop", lat, lon })).concat([{ type: "way", ref: id * 10, role: "", geometry: list.map(([, , lat, lon]) => ({ lat, lon })) }]) });
const TRAIN = rel(100, "train", "Προαστιακός A4: Πειραιά → Κιάτο", ST, "Train A4: Piraeus → Kiato"), METRO = rel(200, "subway", "Metro 2", MT);
const within = (p, m, list) => list.filter(([, , lat, lon]) => Math.hypot((lat - p.lat) * 111, (lon - p.lng) * 88) * 1000 <= m);
// A stand-in for the map servers: answers the line question from what is "mapped" within the radii the query asks.
let asked = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => {
  const q = decodeURIComponent(String((o && o.body) || "").replace(/^data=/, "")); asked.push(q);
  if (/route=ferry/.test(q)) return { ok: true, json: async () => ({ elements: [] }) };
  if (/rel\(id:/.test(q)) { const ids = q.match(/rel\(id:([\d,]+)\)/)[1].split(",").map(Number); return { ok: true, json: async () => ({ elements: [TRAIN, METRO].filter(r => ids.includes(r.id)) }) }; }
  // Which ends' radii reach which stations: near (any rail), wide (trains only).
  const arounds = [...q.matchAll(/around:(\d+),([\d.]+),([\d.]+)\)\[railway/g)].map(m => ({ r: +m[1], p: P(+m[2], +m[3]) }));
  const ends = [...new Map(arounds.map(x => [x.p.lat + "," + x.p.lng, x.p])).values()];
  const hits = (p, routeOk) => [[TRAIN, ST], [METRO, MT]].filter(([r, list]) => arounds.some(x => x.p.lat === p.lat && x.p.lng === p.lng && routeOk(r, x.r) && within(p, x.r, list).length));
  const okR = (r, rad) => rad <= 2500 || r.tags.route === "train";
  const [A, B] = ends, ra = hits(A, okR).map(([r]) => r.id), rb = B ? hits(B, okR).map(([r]) => r.id) : [];
  const both = ra.filter(id => rb.includes(id));
  return { ok: true, json: async () => ({ elements: both.map(id => ({ type: "relation", id })).concat([...ST, ...MT].map(node)) }) };
};
ok(trainReach(syntagma, ancient) > 2500 && trainReach(syntagma, ancient) <= 10000, `far rides look for train stations farther out (${trainReach(syntagma, ancient)} m)`);
ok(trainReach(syntagma, P(37.9715, 23.7257)) === 2500, "city rides keep the usual walk-or-short-taxi reach");
{ asked = []; const r = await transitOptions(syntagma, canal); const t = (r || []).find(o => o.mode === "train");
  ok(!!t, "Athens centre to the Corinth Canal: the train is offered although Athens station is 3 km away");
  ok(t && t.from === "Athens" && t.to === "Isthmos", `boards at Athens, gets off at the station by the canal (${t && t.from} > ${t && t.to})`);
  ok(t && t.access.how === "taxi" && t.access.min >= 10, `the taxi to Athens station is counted (${t && t.access.how} ${t && t.access.min} min)`);
  ok(t && t.label === "Train A4: Piraeus → Kiato", `the line's English name, said once (${t && t.label})`);
  ok(t && t.ride >= 60, `cautious ride time with no timetable (${t && t.ride} min, ${t && t.km} km)`);
  ok(t && t.wait >= 30, `no timetable: waits a full usual gap (${t && t.wait} min)`);
  ok(!(r || []).some(o => o.mode === "subway"), "the metro is never stretched to a far ride");
  ok(asked.some(q => /around:\d{4,5},37\.9755,23\.7348\)\[railway/.test(q) && /\[route=train\]/.test(q)), "the map is asked for train stations farther out, train lines only"); }
{ const r = await transitOptions(syntagma, ancient); const t = (r || []).find(o => o.mode === "train");
  ok(t && t.to === "Corinth" && t.egress.how === "taxi", `Athens to Ancient Corinth: train to Corinth, then a taxi (${t && t.to}, ${t && t.egress.how} ${t && t.egress.min} min)`);
  const back = (await transitOptions(ancient, syntagma) || []).find(o => o.mode === "train");
  ok(back && back.from === "Corinth" && back.to === "Athens", `and the same train back (${back && back.from} > ${back && back.to})`); }
{ asked = []; await transitOptions(syntagma, larissa).catch(() => null);
  ok(!asked.some(q => /around:(?!2500)\d+,37\.9755/.test(q.split("route=ferry")[0])), "a city ride asks only the usual reach"); }
{ // A place 25 km off with its station 6 km away: the taxi would be too much of the trip, so no train.
  const near = P(37.98, 23.47), r = await transitOptions(syntagma, near).catch(() => null);
  ok(!(r || []).some(o => o.mode === "train" && o.egress.km > 5), "no train when the taxis would be most of the way"); }
globalThis.fetch = realFetch;
console.log(bad ? `${bad} train reach check(s) failed` : "train reach checks passed"); process.exit(bad ? 1 : 0);
