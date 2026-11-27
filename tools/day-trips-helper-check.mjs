// R-37: the helper's part of the classic day trips rule, on made-up answers (no network): the piers of an island
// (worker/islands.js landingData/piersOn), the drive to a place and whether it takes a boat (roadWay), and the list of
// travel destinations joined to the fame list with what the city's own guide says of each (worker/worker.js destRows,
// mergeDests, voyageLinks, farSaid). Two planted copies must be caught: piers counted only inside the coastline (a ferry
// terminal stands on a jetty off it: the island then has "no pier", as before), and a drive's ferry step not looked at.
// Usage: node tools/day-trips-helper-check.mjs
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { pathToFileURL } from "node:url";
const W = await import(pathToFileURL(path.resolve("worker/worker.js")).href);
const mem = () => { const m = new Map(); return { USAGE: { get: async k => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, String(v)); } }, m }; };
const codeKey = async p => p + ".test:";
// An island 0.10 x 0.10 degrees (about 8 x 11 km) with its outline as one way; a neighbour island 3 km east.
const sq = (s, w, n, e) => [[s, w], [s, e], [n, e], [n, w], [s, w]].map(([lat, lon]) => ({ lat, lon }));
const ISLE = { type: "way", id: 1, tags: { place: "island", wikidata: "Q1", name: "Isle" }, geometry: sq(43.10, 16.40, 43.20, 16.50) };
const PIERS = [
  { type: "node", id: 11, lat: 43.150, lon: 16.450, tags: { amenity: "ferry_terminal", name: "Inland Terminal" } },             // on the island
  { type: "node", id: 12, lat: 43.0975, lon: 16.42, tags: { amenity: "ferry_terminal", name: "Town Jetty", "name:en": "Town Jetty" } }, // on a jetty 280 m off the south shore
  { type: "way", id: 13, center: { lat: 43.0976, lon: 16.4205 }, tags: { amenity: "ferry_terminal", name: "Town Jetty building" } },    // the same landing mapped twice
  { type: "node", id: 14, lat: 43.15, lon: 16.54, tags: { amenity: "ferry_terminal", name: "Neighbour Island Pier" } },          // 3 km east: another island
];
async function run(islandsFile) {
  const I = await import(pathToFileURL(islandsFile).href + "?" + Math.random()), bad = [], ok = (what, cond, got) => { if (!cond) bad.push(what + (got !== undefined ? " (got " + JSON.stringify(got) + ")" : "")); };
  // Piers
  let asks = 0; globalThis.fetch = async (u, o) => { asks++; const q = decodeURIComponent(String((o && o.body) || "")); return { ok: true, status: 200, json: async () => ({ elements: /ferry_terminal/.test(q) ? PIERS : /wikidata"="Q1"/.test(q) ? [ISLE] : [] }) }; };
  const env = mem(), r = await I.landingData("Q1", env, codeKey), names = (r.piers || []).map(p => p.name);
  ok("a terminal on the island is one of its piers", names.includes("Inland Terminal"), names);
  ok("a terminal on a jetty just off the shore is one of its piers", names.includes("Town Jetty"), names);
  ok("one landing mapped twice is one pier", names.length === 2, names);
  ok("a terminal on a neighbouring island is not this island's pier", !names.includes("Neighbour Island Pier"), names);
  const before = asks; await I.landingData("Q1", env, codeKey); ok("an island's piers are kept, not asked for twice", asks === before, asks - before);
  const none = await I.landingData("Q2", mem(), codeKey); ok("a place the map has no outline for has no piers, and says so (never a guessed pier)", none.outline === false && none.piers.length === 0, none);
  ok("a bad id is refused", (await I.landingData("Hvar", mem(), codeKey)).status === 400);
  globalThis.fetch = async () => ({ ok: false, status: 504, json: async () => ({}) });
  ok("map servers busy: an error to ask again, nothing kept as 'no piers'", (await I.landingData("Q1", mem(), codeKey)).status === 503);
  // The drive
  const drive = (steps, end, dur) => ({ code: "Ok", routes: [{ duration: dur || 2400, distance: 40000, legs: [{ steps: steps.map(mode => ({ mode })) }] }], waypoints: [{ location: [16.4, 43.5] }, { location: end }] });
  const A = { lat: 43.5, lng: 16.4 }, B = { lat: 43.3, lng: 16.6 };
  const road = async j => { globalThis.fetch = async () => ({ ok: !!j, status: j ? 200 : 500, json: async () => j }); return I.roadWay(A, B, mem(), codeKey); };
  let d = await road(drive(["driving"], [16.6, 43.3])); ok("a plain drive: its minutes, no boat", d.min === 40 && d.ferry === false, d);
  d = await road(drive(["driving", "ferry", "driving"], [16.6, 43.3])); ok("a drive with a car ferry in it says so", d.ferry === true, d);
  d = await road(drive(["driving"], [16.9, 43.3])); ok("a road that ends 24 km short of the place does not reach it", d.none === true, d);
  d = await road({ code: "NoRoute" }); ok("no road at all", d.none === true, d);
  d = await road(null); ok("the road router busy: an error to ask again, never 'no road'", d.status === 503, d);
  return bad;
}
const bad = await run(path.resolve("worker/islands.js"));
// The fame list and the travel-guide list
{ const ok = (what, cond, got) => { if (!cond) bad.push(what + (got !== undefined ? " (got " + JSON.stringify(got) + ")" : "")); };
  const row = (id, name, sl, dist, title) => ({ item: { value: "http://www.wikidata.org/entity/" + id }, itemLabel: { value: name }, sl: { value: String(sl) }, loc: { value: "Point(16.5 43.2)" }, dist: { value: String(dist) }, title: { value: title } });
  const rows = W.destRows([row("Q10", "Hvar", 63, 47, "Hvar"), row("Q10", "Hvar", 63, 47.1, "Hvar (island)"), row("Q11", "Q11", 5, 9, "Nameless"), row("Q12", "Manly", 21, 10.4, "Sydney/Manly")]);
  ok("one place with two travel-guide pages is one row; a place with no English name is left out", rows.length === 2 && rows[0].voy === "Hvar" && rows[1].voy === "Sydney/Manly", rows.map(x => x.name + ":" + x.voy));
  const fame = [...Array(25)].map((_, i) => ({ name: "Stadium " + i, wd: "Q9" + i, sl: 90 - i, km: 10 })).concat([]); fame[3] = { name: "Hvar", wd: "Q10", sl: 63, km: 47 };
  const far = W.mergeDests(fame, rows);
  ok("a destination the 25 best-known places crowded out is still on the list (Manly, sl 21)", far.some(x => x.wd === "Q12" && x.voy === "Sydney/Manly"), far.length);
  ok("a place on both lists is marked as having its own travel-guide page, not listed twice", far.filter(x => x.wd === "Q10").length === 1 && far.find(x => x.wd === "Q10").voy === "Hvar");
  const links = W.voyageLinks("Take the ferry to [[Sydney/Manly|Manly]]. [[Sydney/Manly#See|North Head]] and [[hvar]] by [[File:Boat.jpg|thumb]] [[wikipedia:Ferry]] [[Sydney/Manly]]");
  ok("links on the city's page are counted by page, whatever the label, files and other sites left out", links["Sydney/Manly"] === 3 && links["Hvar"] === 1 && Object.keys(links).length === 2, links);
  W.farSaid(far, { title: "Sydney", links });
  const m = far.find(x => x.wd === "Q12"), h = far.find(x => x.wd === "Q10");
  ok("a part of the city's own guide is marked so, with how often the city's page links to it", m.part === true && m.said === 3 && h.said === 1 && !h.part, { m, h });
  { const fr = [{ name: "Vaxholm", voy: "vaxholm", vt: "rural" }, { name: "Uppsala", voy: "Uppsala", vt: "city" }, { name: "Stockholm archipelago", voy: "Stockholm archipelago", vt: "region", said: 6 }, { name: "County", voy: "Stockholm County", vt: "region", said: 2 }, { name: "Sigtuna", voy: "Sigtuna", vt: "city", said: 7 }];
    const regs = W.regionsOf(fr, [{ name: "Sodermanland", voy: "Södermanland", vt: "region" }, { name: "Sigtuna", voy: "Sigtuna", vt: "city" }]);
    ok("the regions read are the ones the city's page links most, a Go next region first among equals, never a town", regs.join("|") === "Stockholm archipelago|Stockholm County|Södermanland", regs);
    ok("an area the city's page links six times is read even when four other Go next regions come before it, and when the guide files it as a rural area (Stockholm archipelago, live helper Nov 27)", regionOrder(W.regionsOf));
    ok("a town a region's page lists with a map marker and no link is named by it (Vaxholm on the Stockholm archipelago page, live helper Nov 27); a sight's marker and a name in passing are not", named(W.regionNames));
    ok("a place a region's own guide page names is marked as lying in it; one it does not name, and the region itself, are not", within(W.farWithin), fr.map(x => x.inVoy)); }
  const vk = c => W.voyKind(c.map(x => "Category:" + x));
  ok("the travel guide's own page kind is read from its status category: a city, a district, a park, a rural area", vk(["Has custom banner", "Usable cities"]) === "city" && vk(["Guide districts"]) === "district" && vk(["Outline parks"]) === "park" && vk(["Usable rural areas"]) === "rural" && vk(["Huge city articles"]) === "city", [vk(["Usable cities"]), vk(["Guide districts"])]);
  ok("a country, a region, an airport and an itinerary are told apart from places to go", vk(["Outline countries"]) === "country" && vk(["Usable regions"]) === "region" && vk(["Usable airports"]) === "airport" && vk(["Guide itineraries"]) === "itinerary");
  ok("a category that only mentions cities is not a page kind (\"Cities in Italy\")", vk(["Cities in Italy", "Has map markers"]) === ""); }
// Facts asked in batches: a place has its facts only when its batch and the batches of all its kinds were answered.
async function facts(F) { const out = [], ok = (what, cond, got) => { if (!cond) out.push(what + (got !== undefined ? " (got " + JSON.stringify(got) + ")" : "")); };
  const direct = new Map([["Q1", new Set(["Qisland"])], ["Q2", new Set(["Qtown", "Qport"])], ["Q3", new Set(["Qtown"])]]), okIds = new Set(["Q1", "Q2", "Q3"]), okClass = new Set(["Qisland", "Qtown"]);
  ok("a place whose batch and kinds were all answered has its facts", F("Q1", okIds, direct, okClass) === true && F("Q3", okIds, direct, okClass) === true);
  ok("a place with one kind not looked up has no facts yet (never 'not that kind')", F("Q2", okIds, direct, okClass) === false);
  ok("a place whose own batch was refused has no facts yet (never 'no kinds')", F("Q4", okIds, direct, okClass) === false);
  ok("a place the encyclopedia gives no kind at all has its (empty) facts", F("Q5", new Set(["Q5"]), direct, okClass) === true);
  return out; }
bad.push(...await facts(W.factsReady));
bad.forEach(b => console.log("FAIL " + b));
// Planted copies of islands.js (each must be caught).
const txt = fs.readFileSync("worker/islands.js", "utf8"), dir = fs.mkdtempSync(path.join(os.tmpdir(), "dth-"));
function regionOrder(ro) { const fr = [{ name: "Stockholm archipelago", voy: "Stockholm archipelago", vt: "rural", said: 6 }];
  const got = ro(fr, ["A", "B", "C", "D", "Stockholm archipelago"].map(v => ({ name: v, voy: v, vt: /arch/.test(v) ? "rural" : "region" }))); return got[0] === "Stockholm archipelago" && got.length === 4; }
// What a region's page names (rule R-37): its links, and the towns it lists with a map marker and no link.
function named(rn) { const got = rn("Two large ones, Värmdö and Vaxholm, stand out.\n* {{marker|type=city|name=Vaxholm|url=|lat=59.403302|long=18.326231}} (archaic spelling)\n* {{marker|type=city|name=[[Norrtälje]]|lat=59.7|long=18.7}}\n* {{marker|type=see|name=Fortress Museum|lat=59.4|long=18.3}}\n* [[Ekerö]] – islands in the lake") || {};
  return !!got.Vaxholm && !!got["Norrtälje"] && !!got["Ekerö"] && !got["Fortress Museum"] && !got["Värmdö"]; }
// A region's places (rule R-37): what marks them, given as a function so a planted copy can stand in for it.
function within(fw) { const fr = [{ name: "Vaxholm", voy: "vaxholm", vt: "rural" }, { name: "Uppsala", voy: "Uppsala", vt: "city" }, { name: "Stockholm archipelago", voy: "Stockholm archipelago", vt: "region", said: 6 }];
  fw(fr, [{ title: "Stockholm archipelago", links: { Vaxholm: 3, "Stockholm archipelago": 1 } }]); return fr[0].inVoy === "Stockholm archipelago" && !fr[1].inVoy && !fr[2].inVoy; }
const PLANT = [["piers only inside the coastline", "export const LAND_M = 400;", "export const LAND_M = 0;"], ["a drive's ferry step not looked at", 'ferry: (rt.legs || []).some(l => (l.steps || []).some(st => st.mode === "ferry")) }', "ferry: false }"],
  ["busy map servers kept as 'no piers'", 'if (!els) return { error: "Busy", status: 503 };\n  const shapes = [];', "const shapes = [];\n  if (!els) return { wd, outline: false, piers: [] };"]];
let missed = 0;
for (const [name, from, to] of PLANT) { if (txt.split(from).length !== 2) { console.log("FAIL planted copy '" + name + "': the line to plant is gone"); missed++; continue; }
  const pf = path.join(dir, "islands-" + missed + Math.random().toString(36).slice(2) + ".js"); fs.writeFileSync(pf, txt.replace(from, to));
  let caught = 0; try { caught = (await run(pf)).length; } catch (e) { caught = 1; }
  console.log(caught ? `planted copy caught: ${name}` : `FAIL planted copy not caught: ${name}`); if (!caught) missed++; }
{ const lost = (await facts((id, okIds) => okIds.has(id))).length + (await facts((id, okIds, direct, okClass) => [...(direct.get(id) || [])].every(c => okClass.has(c)))).length >= 2 && (await facts(() => true)).length;
  console.log(lost ? "planted copies caught: facts read from half an answer" : "FAIL planted copy not caught: facts read from half an answer"); if (!lost) missed++; }
{ const lost = !within(f => f) && !within((far, regs) => far.forEach(f => { f.inVoy = regs[0].title; }));
  console.log(lost ? "planted copies caught: a region's places never marked, or every place marked" : "FAIL planted copy not caught: a region's places"); if (!lost) missed++; }
{ const old = (far, next) => { const seen = new Set(); return (next || []).map(x => Object.assign({ said: 9 }, x)).concat((far || []).filter(x => x && x.said > 0)).filter(x => x && x.voy && x.vt === "region" && !seen.has(x.voy) && seen.add(x.voy)).sort((a, b) => (b.said || 0) - (a.said || 0)).slice(0, 3).map(x => x.voy); };
  const lost = !regionOrder(old); console.log(lost ? "planted copy caught: every Go next region counted alike, the first three read" : "FAIL planted copy not caught: region order"); if (!lost) missed++; }
{ const old = (far, next) => { const seen = new Set(), saidOf = x => Math.max(x.said || 0, ...(far || []).filter(f => f && f.voy === x.voy).map(f => f.said || 0)); return (next || []).map(x => Object.assign({}, x, { go: 1 })).concat((far || []).filter(x => x && x.said > 0)).filter(x => x && x.voy && x.vt === "region" && !seen.has(x.voy) && seen.add(x.voy)).map(x => ({ voy: x.voy, said: saidOf(x), go: x.go || 0 })).sort((a, b) => b.said - a.said || b.go - a.go).slice(0, 4).map(x => x.voy); };
  const lost = !regionOrder(old); console.log(lost ? "planted copy caught: a rural area's page not read (the travel guide files the Stockholm archipelago as one)" : "FAIL planted copy not caught: rural area page"); if (!lost) missed++; }
{ const lost = !named(W.voyageLinks) && !named(wt => Object.fromEntries([...String(wt).matchAll(/name\s*=\s*([^|}\[\]]+)/g)].map(m => [m[1].trim(), 1]).concat(Object.entries(W.voyageLinks(wt)))));
  console.log(lost ? "planted copies caught: a region's marker towns not read, or every marker read as a place" : "FAIL planted copy not caught: region marker names"); if (!lost) missed++; }
console.log(`day-trips-helper-check: ${bad.length || missed ? "failed" : "passed, " + (PLANT.length + 5) + " planted copies caught"}`);
process.exit(bad.length || missed ? 1 : 0);
