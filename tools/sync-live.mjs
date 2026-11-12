// Live check of trip sync and of the reservation lookup on the Kairoute helper. Run by the "Check sync" workflow.
const U = "https://kairoute-ai.rickgilson.workers.dev", H = { "content-type": "application/json", Origin: "https://gilsonr0566-sys.github.io" };
const call = async b => { const r = await fetch(U + "/sync", { method: "POST", headers: H, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) }; };
const data = { v: 1, library: [{ id: "t-test", name: "Sync test", changed: 1, trip: { id: "t-test", days: [] } }], deleted: {}, cities: {} };
const a = await call({ op: "new", data }); console.log("new", a.s, a.j && a.j.code ? "code ok" : JSON.stringify(a.j));
const code = a.j.code;
const p1 = await call({ op: "put", code, base: 1, data: Object.assign({}, data, { library: [Object.assign({}, data.library[0], { changed: 2 })] }) }); console.log("put", p1.s, JSON.stringify(p1.j));
const p2 = await call({ op: "put", code, base: 1, data }); console.log("stale put", p2.s, "(409 expected)", p2.j && p2.j.rev);
const r = await call({ op: "rev", code }); console.log("rev", r.s, JSON.stringify(r.j));
const g = await call({ op: "get", code }); console.log("get", g.s, g.j && g.j.data && g.j.data.library[0].changed);
const bad = await call({ op: "get", code: "ZZZZZZZZ" }); console.log("unknown code", bad.s, "(404 expected)");
const gr = await (await fetch(U + "/ground", { method: "POST", headers: H, body: JSON.stringify({ city: "Athens", names: ["Taverna Platanos"] }) })).json();
console.log("reservation lookup:", ((gr.results || [])[0] || {}).map?.slice(0, 3).map(m => m.name + " " + m.lat + "," + m.lng).join(" | "));
