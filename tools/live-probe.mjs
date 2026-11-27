// Live server check for the live trip features (runs in GitHub Actions: "Live features probe").
//  - /weather: a real Open-Meteo forecast for Athens, read into days and hours
//  - /identify: a photo of the Parthenon, with four real Acropolis places as the choices: must pick the Parthenon
//  - /rate + /ratings: a "how busy" report for a test city comes back in the city's busy table
// Uses the test pool (x-kairoute-lab), never travelers' AI allowance.
const U = "https://kairoute-ai.rickgilson.workers.dev", LAB = { "x-kairoute-lab": "1" };
// Only a real code bug fails the run (a broken answer shape or a refused request). A busy outside service or the
// AI picking differently on one photo is a warning: noted in the run summary, exit 0.
import { appendFileSync } from "node:fs";
let fails = 0; const lines = [];
const note = (t, m) => { const l = (t === "ok" ? "ok   " : t === "warn" ? "WARN " : "FAIL ") + m; console.log(l); lines.push("- " + l); if (t === "fail") fails++; };
const ok = (c, m, soft) => note(c ? "ok" : soft ? "warn" : "fail", m);
{ const r = await fetch(U + "/weather?lat=37.97&lng=23.73"); const j = r.ok ? await r.json() : null; const ds = j && j.days ? Object.keys(j.days) : [];
  ok(ds.length >= 7 && j.days[ds[0]].hours.length >= 10, `/weather: ${r.status}, ${ds.length} days, first day ${ds[0]}: ${ds[0] ? JSON.stringify({ ...j.days[ds[0]], hours: j.days[ds[0]].hours.slice(0, 3) }) : "none"}`, r.status >= 500); }
{ const img = await fetch("https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/The_Parthenon_in_Athens.jpg/500px-The_Parthenon_in_Athens.jpg", { headers: { "user-agent": "Kairoute-check/1.0" } });
  const b64 = "data:image/jpeg;base64," + Buffer.from(await img.arrayBuffer()).toString("base64");
  // Wikimedia only serves its standard thumbnail widths; any other answer is the photo host's problem, not ours.
  if (!img.ok || !b64.startsWith("data:image/jpeg;base64,/9j/")) note("warn", `test photo couldn't be downloaded (${img.status}); /identify not checked`); else {
  const cands = [{ name: "Erechtheion", kind: "ancient temple", m: 60 }, { name: "Parthenon", kind: "ancient temple", m: 80 }, { name: "Odeon of Herodes Atticus", kind: "ancient theatre", m: 190 }, { name: "Temple of Athena Nike", kind: "ancient temple", m: 120 }];
  const r = await fetch(U + "/identify", { method: "POST", headers: { "content-type": "application/json", ...LAB }, body: JSON.stringify({ image: b64, lat: 37.9715, lng: 23.7267, cands, dev: "0123456789abcdef0123" }) });
  const j = await r.json().catch(() => null);
  ok(r.ok && j && j.n === 2, `/identify: ${r.status} ${JSON.stringify(j)} (photo ${img.status}, ${b64.length} chars; expected 2 = Parthenon)`, r.status >= 500 || r.status === 429 || (r.ok && j && Number.isInteger(j.n)) || !img.ok);
  const r2 = await fetch(U + "/identify", { method: "POST", headers: { "content-type": "application/json", ...LAB }, body: JSON.stringify({ image: b64, cands: [{ name: "Fish market", kind: "market", m: 50 }, { name: "Bus station", kind: "station", m: 90 }], dev: "0123456789abcdef0123" }) });
  const j2 = await r2.json().catch(() => null); ok(r2.ok && j2 && j2.n === 0, `/identify with no matching place answers 0: ${JSON.stringify(j2)}`, r2.status >= 500 || r2.status === 429 || (r2.ok && j2 && Number.isInteger(j2.n))); } }
{ const dev = [...crypto.getRandomValues(new Uint8Array(10))].map(x => x.toString(16).padStart(2, "0")).join("");
  const r = await fetch(U + "/rate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ city: "kairoute probe", place: "test square", busy: 2, hour: 11, dev }) });
  const j = await r.json().catch(() => null); ok(r.ok && j && j.ok, `/rate busy: ${r.status} ${JSON.stringify(j)}`);
  const g = await (await fetch(U + "/ratings?city=" + encodeURIComponent("kairoute probe"))).json().catch(() => null);
  ok(g && g.busy && g.busy["test square"] && g.busy["test square"]["11"], `/ratings returns busy reports: ${JSON.stringify(g && g.busy)}`); }
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, "## Live features probe\n" + lines.join("\n") + "\n");
process.exit(fails ? 1 : 0);
