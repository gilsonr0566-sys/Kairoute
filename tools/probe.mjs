// One-off probe of the live helper (no AI): what the cruise-pier search finds for ports whose day came out blank, and
// the train departures it knows for a ship-day way back.
const U = "https://kairoute-ai.rickgilson.workers.dev", H = { "content-type": "application/json", origin: "https://gilsonr0566-sys.github.io" };
const ports = [["Dubrovnik, Croatia", "Dubrovnik", { lat: 42.6421, lng: 18.1065 }], ["Reykjavik, Iceland", "Reykjavik", { lat: 64.1453, lng: -21.916 }]];
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
for (let round = 0; round < 4; round++) {
  const r = await fetch(U + "/transit", { method: "POST", headers: H, body: JSON.stringify({ pairs: [{ a: [41.9010, 12.5018], b: [42.0934, 11.7926], date: "2027-09-08", dow: 3 }] }) });
  const j = await r.json().catch(() => ({})); const x = (j.results || [])[0] || {};
  console.log("== TRANSIT Rome to Civitavecchia, round", round, "partial", !!x.partial);
  for (const o of x.opts || []) { const ts = [...new Set((o.kindDeps || o.deps || []).map(d => d.t))].sort((a, b) => a - b); console.log("  ", o.kind, o.label, ts.length, ts.map(hm).join(" ")); }
  if (!x.partial && (x.opts || []).length) break; await new Promise(r => setTimeout(r, 60000));
}
