// Rides live check: asks the live helper's /transit for the Naples port-day rides (as the app does) and prints
// what comes back, how long it took, and any error. Always exits 0 (it reports).
const U = "https://kairoute-ai.rickgilson.workers.dev";
const P = { ship: [40.8387, 14.2546], sorrento: [40.6263, 14.3757], pompeii: [40.749, 14.4848] };
const pairs = [["ship", "sorrento"], ["sorrento", "pompeii"], ["pompeii", "ship"]];
for (const [x, y] of pairs) {
  const t0 = Date.now();
  try {
    const ask = () => fetch(U + "/transit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pairs: [{ a: P[x], b: P[y], dow: 1 }] }), signal: AbortSignal.timeout(120000) });
    const r = await ask().catch(() => ask()); // a dropped connection is tried once more
    const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (e) {}
    console.log(`\n== ${x} -> ${y}: HTTP ${r.status} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    const res = j && j.results && j.results[0];
    if (!res) { console.log("   body: " + txt.slice(0, 400)); continue; }
    if (res.error) { console.log("   error: " + res.error); continue; }
    (res.opts || []).forEach(o => console.log(`   ${o.mode} · ${o.label} · ${o.min} min · every ${o.every || "?"} (${o.everySrc || "map"})${o.noTimetable ? " · no timetable" : ""} · deps ${(o.deps || []).length} · path ${(o.path || []).length} pts · checked ${o.checked || "-"}`));
    if (!(res.opts || []).length) console.log("   no options");
  } catch (e) { console.log(`\n== ${x} -> ${y}: failed after ${((Date.now() - t0) / 1000).toFixed(1)} s: ${e.message}`); }
}
// All three in one request, as the page asks: must come back well inside the 100 s a web request may take.
{ const t0 = Date.now();
  try { const r = await fetch(U + "/transit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pairs: pairs.map(([x, y]) => ({ a: P[x], b: P[y], dow: 3 })) }), signal: AbortSignal.timeout(120000) });
    const j = await r.json().catch(() => null);
    console.log(`\n== all three together (a Wednesday): HTTP ${r.status} in ${((Date.now() - t0) / 1000).toFixed(1)} s: ` + (j && j.results ? j.results.map(x => x.error || (x.opts || []).length + " options").join(", ") : "no answer"));
  } catch (e) { console.log(`\n== all three together: failed after ${((Date.now() - t0) / 1000).toFixed(1)} s: ${e.message}`); } }
// A mixed batch (Barcelona and Naples rides in one request, as a whole trip asks): every answer must belong to its own pair.
{ const mix = [[[41.3685, 2.1534], [41.4145, 2.1527], 0], [[41.4145, 2.1527], [41.3685, 2.1534], 0], [[40.838, 14.255], [40.7489, 14.4848], 1], [[40.7489, 14.4848], [40.838, 14.255], 1], [[40.5532, 14.2222], [40.838, 14.255], 1], [[40.838, 14.255], [40.6263, 14.3757], 1]];
  for (const round of [1, 2]) { const t0 = Date.now();
    const r = await fetch(U + "/transit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pairs: mix.map(([a, b, dow]) => ({ a, b, dow })) }), signal: AbortSignal.timeout(120000) }).catch(e => null);
    const j = r && await r.json().catch(() => null);
    console.log(`\n== mixed batch, round ${round}: HTTP ${r && r.status} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    (j && j.results || []).forEach((x, i) => console.log(`   ${mix[i][0]} > ${mix[i][1]}: ` + (x.error || (x.opts || []).map(o => `${o.label} ${o.min}m from ${o.from} to ${o.to}`).join(" / ") || "none"))); } }
