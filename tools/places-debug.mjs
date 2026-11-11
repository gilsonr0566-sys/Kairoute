// Checks the real-places endpoints on the live helper. Run by the "Debug places" workflow.
const U = "https://kairoute-ai.rickgilson.workers.dev", H = { "content-type": "application/json", Origin: "https://gilsonr0566-sys.github.io" };
const pts = [{ lat: 27.815, lng: -97.389 }, { lat: 27.794, lng: -97.394 }];
let r = await fetch(U + "/places", { method: "POST", headers: H, body: JSON.stringify({ pts, r: 700 }) });
let t = await r.text(); console.log("places", r.status, t.slice(0, 600));
r = await fetch(U + "/verify", { method: "POST", headers: H, body: JSON.stringify({ city: "Corpus Christi", items: [{ name: "USS Lexington" }, { name: "Oceanic Science Museum" }, { name: "Community Garden Gates" }] }) });
console.log("verify", r.status, (await r.text()).slice(0, 1500));
const q = '[out:json][timeout:25];nwr["amenity"="restaurant"]["name"](around:700,27.794,-97.394);out center tags 20;';
r = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Kairoute/1.0" } });
console.log("direct overpass from runner", r.status, (await r.text()).slice(0, 300));
r = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/USS_Lexington_(CV-16)", { headers: { "user-agent": "Kairoute/1.0" } }); console.log("wiki", r.status);
