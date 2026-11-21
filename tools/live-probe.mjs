// AI-off proof (Nov 21): live /status must say off, then every path that can reach Workers AI must refuse.
// Probes run only after /status says off, so a broken switch can't make this check spend anything.
const H = "https://kairoute-ai.rickgilson.workers.dev", n = Date.now();
const st = await (await fetch(H + "/status")).json();
console.log("status: " + JSON.stringify({ on: st.on, mode: st.mode, budget: st.budget, usedToday: st.usedToday, left: st.left, voiceLeft: st.voiceLeft, labLeft: st.labLeft }));
if (st.on !== false || st.mode !== "off") { console.log("FAIL helper is not off; no probes sent"); process.exit(1); }
const post = (p, b) => fetch(H + p, { method: "POST", headers: { "content-type": "application/json", origin: "https://gilsonr0566-sys.github.io" }, body: JSON.stringify(b) }).then(async r => [r.status, (await r.text()).slice(0, 100)]).catch(e => [0, e.message]);
const img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const probes = [
  ["/sample trip (traveler)", "/sample", { prompt: "Plan one day in Lisbon, probe " + n, purpose: "trip", tier: "quick" }],
  ["/sample guide (traveler)", "/sample", { prompt: "Two lines about Lisbon, probe " + n, purpose: "guide", tier: "quick" }],
  ["/sample walk", "/sample", { prompt: "Walk probe " + n, purpose: "walk", tier: "quick" }],
  ["/script", "/script", { name: "Probe Tower " + n, city: "Lisbon" }],
  ["/speak", "/speak", { text: "Probe line " + n }],
  ["/identify", "/identify", { image: img, city: "Lisbon" }],
  ["/x/primer", "/x/primer", { city: "Probe City " + n }],
  ["/x/ask", "/x/ask", { q: "What is this probe " + n + "?", city: "Lisbon" }],
];
let bad = 0;
for (const [name, p, b] of probes) { const [s, t] = await post(p, b); const ok = s !== 200; if (!ok) bad++; console.log(`${ok ? "refused" : "ANSWERED"} ${s} ${name}: ${t}`); }
const st2 = await (await fetch(H + "/status")).json();
console.log(`usedToday before ${st.usedToday}, after ${st2.usedToday}`);
if (bad || st2.usedToday !== st.usedToday) { console.log("FAIL an AI path answered or usage moved"); process.exit(1); }
console.log("PASS every AI path refused and usage did not move");
