// R-06: the helper's island walk test (worker/islands.js) on made-up router answers, and a planted copy that trusts the
// walking router's fastest way alone (the Nov 24 live gap: an island whose fastest way takes a boat stayed "not known").
// Usage: node tools/islands-walk-check.mjs
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { pathToFileURL } from "node:url";
const isle = { id: "w1", name: "Isle", rings: [[0.01, 0.01, 0.01, 0.02, 0.02, 0.02, 0.02, 0.01, 0.01, 0.01]] }, centre = { lat: 0, lng: 0 };
const on = [0.015, 0.015], off = [0.0001, 0.0001];
const route = (ferry) => ({ legs: [{ steps: [{ mode: "walking" }, ...(ferry ? [{ mode: "ferry" }] : [])] }] });
const ans = (code, routes, end) => ({ code, routes, waypoints: [{ location: [0, 0] }, { location: [end[1], end[0]] }] });
const CASES = [
  ["bridge: fastest way walks", { foot: ans("Ok", [route(false)], on) }, true],
  ["water bus fastest, bridge another way", { foot: ans("Ok", [route(true), route(false)], on) }, true],
  ["only a boat; road router ends on the mainland", { foot: ans("Ok", [route(true)], on), car: ans("Ok", [route(false)], off) }, false],
  ["only a boat on foot; a road bridge", { foot: ans("Ok", [route(true)], on), car: ans("Ok", [route(false)], on) }, true],
  ["no path at all", { foot: { code: "NoRoute" } }, false],
  ["paths end on another shore", { foot: ans("Ok", [route(false)], off) }, false],
];
async function run(file) {
  const { _walkTo } = await import(pathToFileURL(file).href + "?" + Math.random()); const bad = [];
  for (const [name, r, want] of CASES) {
    globalThis.fetch = async (u) => { const j = /routed-car/.test(u) ? r.car : r.foot; return { ok: !!j, status: j ? 200 : 500, json: async () => j }; };
    const got = await _walkTo(centre, isle); if (!got || got.walk !== want) bad.push(`${name}: wanted ${want}, got ${got && got.walk} (${got && got.why})`); }
  return bad;
}
const src = path.resolve("worker/islands.js"), bad = await run(src);
bad.forEach(b => console.log("FAIL " + b));
// Planted: a boat on the fastest way gives "not known", as before Nov 24 (must be caught).
const txt = fs.readFileSync(src, "utf8"), plantFrom = 'if (!hasFerry(j.routes[0])) return { walk: true, why: "path" };';
if (!txt.includes(plantFrom)) { console.log("FAIL planted copy: the line to plant is gone"); process.exit(1); }
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "isw-")), pf = path.join(dir, "islands.js");
fs.writeFileSync(pf, txt.replace(plantFrom, plantFrom + ' return { walk: null, why: "planted" };'));
const caught = (await run(pf)).length;
console.log(caught ? `planted copy caught (${caught} cases)` : "FAIL planted copy not caught");
console.log(`islands-walk-check: ${bad.length || !caught ? "failed" : CASES.length + " cases passed"}`);
process.exit(bad.length || !caught ? 1 : 0);
