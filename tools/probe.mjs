// One-off probe of the live helper (no AI): what the cruise-pier search finds for ports whose day came out blank, and
// the train departures it knows for a ship-day way back.
const U = "https://kairoute-ai.rickgilson.workers.dev", H = { "content-type": "application/json", origin: "https://gilsonr0566-sys.github.io" };
const ports = [];
for (const [label, P, center] of ports) {
  const names = ["Port of " + P, P + " cruise terminal", "Cruise pier"];
  const r = await fetch(U + "/ground", { method: "POST", headers: H, body: JSON.stringify({ city: label, names, center }) });
  const j = await r.json().catch(() => ({}));
  console.log("== GROUND", label, r.status);
  (j.results || []).forEach((x, i) => { console.log("  " + names[i] + ":");
    (x && x.wiki || []).forEach(w => console.log("    wiki", w.title, w.lat, w.lng));
    (x && x.map || []).forEach(m => console.log("    map", m.name, m.kind, m.lat, m.lng)); });
}
const hm = t => String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
// The ways back the outside check saw as taxis: from the city's sights to the port, and the way out.
const pairs = [["Rome Colosseum to Civitavecchia port", [41.8902, 12.4922], [42.095, 11.79]], ["Rome Navona to Civitavecchia port", [41.899, 12.477], [42.095, 11.79]]];
for (const date of [null, "2027-09-08"]) for (const [name, a, b] of pairs) {
  for (let round = 0; round < 2; round++) {
    const t0 = Date.now(), r = await fetch(U + "/transit", { method: "POST", headers: H, body: JSON.stringify({ pairs: [Object.assign({ a, b, dow: 3 }, date ? { date } : {})] }) });
    const j = await r.json().catch(() => ({})); const x = (j.results || [])[0] || {};
    console.log("== TRANSIT", name, date || "(weekday)", "round", round, "status", r.status, "partial", !!x.partial, "sec", Math.round((Date.now() - t0) / 1000));
    for (const o of x.opts || []) { const own = [...new Set((o.deps || []).map(d => d.t))].sort((a, b) => a - b), kd = [...new Set((o.kindDeps || []).map(d => d.t))].sort((a, b) => a - b);
      console.log("  ", o.kind, "|", o.label, "| min", o.min, "| own", own.length, own.map(hm).join(" "), "| kind", kd.length, kd.length ? hm(kd[0]) + "-" + hm(kd[kd.length - 1]) : "", "| src", o.src || o.source || ""); }
    if (!x.partial && (x.opts || []).length) break; await new Promise(r => setTimeout(r, 45000));
  }
}
