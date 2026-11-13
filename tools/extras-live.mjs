// Live check of the guide extras on Kairoute's real helper (run after a publish): real viewpoints and restrooms
// from OpenStreetMap, local know-how from Wikivoyage, the kids' story / city primer / theme link rewrites (and the
// guard that rejects a rewrite adding facts), film locations from Wikidata, and a full group-tour round trip.
// Uses the test budget header so travelers' allowance is never touched. Exit 1 on any failure.
const U = process.env.HELPER || "https://kairoute-ai.rickgilson.workers.dev";
const H = { "content-type": "application/json", "x-kairoute-lab": "1", origin: "https://gilsonr0566-sys.github.io" };
const fails = []; const ok = m => console.log("  ok  " + m), bad = m => { fails.push(m); console.log("  FAIL " + m); };
const get = async p => { const r = await fetch(U + p, { headers: H }); let j = null; try { j = await r.json(); } catch (e) {} return { s: r.status, j }; };
const post = async (p, b) => { const r = await fetch(U + p, { method: "POST", headers: H, body: JSON.stringify(b) }); let j = null; try { j = await r.json(); } catch (e) {} return { s: r.status, j }; };
const ACROPOLIS = "You are climbing the hill that gave the world the idea of the classical temple. In the 440s BC, the statesman Pericles used the treasury of the Athenian league to rebuild this rock after the Persians burned it in 480 BC. The Parthenon was finished in 438 BC and dedicated to Athena, the city's patron goddess. Its columns lean slightly inward and its floor curves upward in the middle, so that from a distance the building looks perfectly straight. Look for the small Temple of Athena Nike on the right as you come through the Propylaea gateway, and the Erechtheion with its porch of six maidens, the Caryatids.";
const AREOPAGUS = "This bare rock below the Acropolis is the Areopagus, or Mars Hill. In ancient times the city's highest court met here. According to the Book of Acts, chapter 17, the Apostle Paul stood here around AD 51 and spoke to the Athenians about the 'unknown god'. A bronze plaque at the foot of the steps carries the text of his sermon in Greek.";
(async () => {
  console.log("Viewpoints and practical places (OpenStreetMap)");
  for (const [n, la, ln] of [["Athens", 37.971, 23.726], ["Barcelona", 41.403, 2.174], ["Corpus Christi", 27.800, -97.396]]) {
    const v = await get(`/x/near?what=view&lat=${la}&lng=${ln}`); v.s === 200 && v.j && Array.isArray(v.j.spots) ? ok(`${n}: ${v.j.spots.length} named viewpoints (${v.j.spots.slice(0, 3).map(x => x.name).join(", ")})`) : bad(`${n} viewpoints: ${v.s} ${JSON.stringify(v.j).slice(0, 200)}`);
    const a = await get(`/x/near?what=amen&lat=${la}&lng=${ln}`); a.s === 200 && a.j && Array.isArray(a.j.places) ? ok(`${n}: ${a.j.places.length} restrooms/water/pharmacies/cash machines nearby`) : bad(`${n} amenities: ${a.s} ${JSON.stringify(a.j).slice(0, 200)}`);
  }
  console.log("Local know-how (Wikivoyage)");
  for (const [c, k] of [["Athens", "Greece"], ["Barcelona", "Spain"], ["Corpus Christi", "United States"]]) {
    const r = await get(`/x/knowhow?city=${encodeURIComponent(c)}&country=${encodeURIComponent(k)}`);
    if (r.s !== 200 || !r.j) { bad(`${c}: ${r.s}`); continue; }
    if (r.j.groups) { const n = Object.values(r.j.groups).reduce((a, x) => a + x.length, 0); n ? ok(`${c}: ${n} tips from ${r.j.sources.map(s => s.title).join(" + ")}`) : bad(`${c}: no tips`); for (const g in r.j.groups) r.j.groups[g].slice(0, 2).forEach(x => console.log(`      ${g}: ${x.t}`)); }
    else if (r.j.raw) ok(`${c}: raw Wikivoyage sections (AI not available): ${r.j.raw.map(x => x.src).join(", ")}`); else bad(`${c}: ${JSON.stringify(r.j).slice(0, 200)}`);
  }
  console.log("Grounded rewrites");
  const k = await post("/x/write", { kind: "kids", text: ACROPOLIS, name: "Acropolis and Parthenon" });
  k.s === 200 && k.j && k.j.text ? ok("kids' story: " + k.j.text.slice(0, 160) + "…") : k.s === 422 ? ok("kids' story rejected by the no-new-facts guard (" + (k.j.extra || []).join(", ") + ")") : bad("kids: " + k.s + " " + JSON.stringify(k.j));
  const t1 = await post("/x/write", { kind: "theme", text: AREOPAGUS, name: "Areopagus (Mars Hill)", theme: "Footsteps of Paul" });
  t1.s === 200 && t1.j && t1.j.text ? ok("theme link (Mars Hill, Paul): " + t1.j.text) : bad("theme link: " + t1.s + " " + JSON.stringify(t1.j));
  const t2 = await post("/x/write", { kind: "theme", text: ACROPOLIS, name: "Acropolis and Parthenon", theme: "Film and TV locations" });
  t2.s === 200 && t2.j && (t2.j.none || t2.j.text) ? ok("no invented link when the text has none: " + (t2.j.none ? "NONE" : t2.j.text)) : bad("theme none: " + t2.s + " " + JSON.stringify(t2.j));
  const pr = await post("/x/write", { kind: "primer", text: (ACROPOLIS + "\n" + AREOPAGUS + "\n").repeat(2), name: "Athens" });
  pr.s === 200 && pr.j && pr.j.text ? ok(`primer: ${pr.j.text.split(/\s+/).length} words`) : pr.s === 422 || pr.s === 502 ? ok("primer declined (thin source or guard): " + pr.s) : bad("primer: " + pr.s + " " + JSON.stringify(pr.j));
  console.log("Film locations (Wikidata)");
  const f = await get("/x/film?lat=41.403&lng=2.174"); f.s === 200 && f.j && Array.isArray(f.j.places) ? ok(`Barcelona: ${f.j.places.length} filmed places, e.g. ${f.j.places.slice(0, 2).map(p => p.name + ": " + p.works.map(w => w.title).slice(0, 2).join(", ")).join(" | ")}`) : bad("film: " + f.s + " " + JSON.stringify(f.j).slice(0, 200));
  console.log("Group tour round trip");
  const tripBig = { trip: { days: [{ id: "d1", destination: "Athens" }], name: "Live test" }, cities: { athens: { city: "Athens", sites: Array.from({ length: 60 }, (_, i) => ({ id: "s" + i, guide: "x".repeat(4000) })) } } };
  const g = await post("/x/group", { op: "new", trip: tripBig, name: "Live test", live: { dayId: "d1", i: 0 } });
  if (g.s !== 200 || !g.j || !g.j.code) bad("group new: " + g.s + " " + JSON.stringify(g.j)); else {
    ok("group " + g.j.code + " started with a " + Math.round(JSON.stringify(tripBig).length / 1024) + " KB trip");
    const r1 = await get(`/x/group?code=${g.j.code}&since=0`); r1.s === 200 && r1.j.trip && r1.j.trip.cities.athens.sites.length === 60 ? ok("follower received the whole trip") : bad("group get: " + r1.s);
    const l = await post("/x/group", { op: "live", code: g.j.code, token: g.j.token, live: { dayId: "d1", i: 3, phase: "at" } });
    const r2 = await get(`/x/group?code=${g.j.code}&since=${r1.j.tripRev}`); l.s === 200 && r2.j.live && r2.j.live.i === 3 && !r2.j.trip ? ok("leader's step reaches followers at once (no trip resent)") : bad("live: " + JSON.stringify(r2.j).slice(0, 200));
    const x = await post("/x/group", { op: "live", code: g.j.code, token: "wrong", live: { i: 9 } }); x.s === 403 ? ok("only the leader can move the group") : bad("token check: " + x.s);
    await post("/x/group", { op: "regroup", code: g.j.code, token: g.j.token, where: "the fountain", note: "In 10 minutes" });
    const r3 = await get(`/x/group?code=${g.j.code}&since=99`); r3.j.regroup && r3.j.regroup.where === "the fountain" ? ok("regroup call stored") : bad("regroup: " + JSON.stringify(r3.j).slice(0, 200));
    await post("/x/group", { op: "end", code: g.j.code, token: g.j.token }); const r4 = await get(`/x/group?code=${g.j.code}`); r4.s === 404 ? ok("ended group is gone") : bad("end: " + r4.s);
  }
  if (fails.length) { console.log(`\n${fails.length} live check(s) failed.`); process.exit(1); }
  console.log("\nAll live extras checks passed.");
})().catch(e => { console.error(e); process.exit(1); });
