// Live check of the Google rating lookup for a few real restaurants. Run by "Check restaurant ratings".
const U = "https://kairoute-ai.rickgilson.workers.dev", H = { Origin: "https://gilsonr0566-sys.github.io", "content-type": "application/json" };
const places = [{ name: "Karamanlidika", lat: 37.9797, lng: 23.7253 }, { name: "Museo del Jamón", lat: 40.4166, lng: -3.7038 }, { name: "Pollo Rico Asador", lat: 40.4133, lng: -3.7014 }];
const r = await fetch(U + "/grating", { method: "POST", headers: H, body: JSON.stringify({ places }) }); console.log("STATUS " + r.status); console.log("RESULT " + JSON.stringify(await r.json()));
