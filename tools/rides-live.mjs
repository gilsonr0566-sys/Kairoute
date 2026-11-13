// Rides live check: asks the live helper's /transit for the Naples port-day rides (as the app does) and prints
// what comes back, how long it took, and any error. Always exits 0 (it reports).
const U = "https://kairoute-ai.rickgilson.workers.dev";
const P = { ship: [40.8387, 14.2546], sorrento: [40.6263, 14.3757], pompeii: [40.749, 14.4848] };
const pairs = [["ship", "sorrento"], ["sorrento", "pompeii"], ["pompeii", "ship"]];
for (const [x, y] of pairs) {
  const t0 = Date.now();
  try {
    const r = await fetch(U + "/transit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pairs: [{ a: P[x], b: P[y], dow: 1 }] }), signal: AbortSignal.timeout(120000) });
    const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (e) {}
    console.log(`\n== ${x} -> ${y}: HTTP ${r.status} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    const res = j && j.results && j.results[0];
    if (!res) { console.log("   body: " + txt.slice(0, 400)); continue; }
    if (res.error) { console.log("   error: " + res.error); continue; }
    (res.opts || []).forEach(o => console.log(`   ${o.mode} · ${o.label} · ${o.min} min · every ${o.every || "?"} (${o.everySrc || "map"})${o.noTimetable ? " · no timetable" : ""} · deps ${(o.deps || []).length} · path ${(o.path || []).length} pts · checked ${o.checked || "-"}`));
    if (!(res.opts || []).length) console.log("   no options");
  } catch (e) { console.log(`\n== ${x} -> ${y}: failed after ${((Date.now() - t0) / 1000).toFixed(1)} s: ${e.message}`); }
}
