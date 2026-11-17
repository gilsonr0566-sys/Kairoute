// ===================== A guide for any city with no AI (Richard, Nov 17) =====================
// With the AI writer switched off, a place with no built-in guide still gets one, from the same free sources every
// guide is checked against: first a guide Kairoute already wrote and keeps on its helper (shared by every traveler),
// otherwise one built straight from the city's sources (Wikidata fame, Wikipedia, English and local Wikivoyage,
// heritage registers, UNESCO: see sourceSights), with real places to eat from the map and the city's airport, main
// station and cruise port looked up by name. Nothing is invented: each sight has its real position, its sources and the
// travel guide's own short description. Where a start point can't be found for sure it is marked unknown, and that
// day says so instead of planning from a guess (never confidently wrong). Once the AI writer is on again, the spoken
// stories are written for the sights on the traveler's days, as for any source sight.
const SRCG_V = 1;
const bareName = s => String(s || "").replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
async function guideNoAI(d, quiet) {
  const label = d.destination; if (!label || !freeAI) return false;
  if (!quiet) { if (view === "tour") view = "plan"; busy = { text: "Finding " + label + " in travel guides and maps…" }; aiError = ""; render(); toTop(); }
  try {
    const builtinNow = cityFor(d) && cityFor(d).builtin ? cityFor(d) : null;
    let raw = await cachedGuide(d), c = null;
    if (raw && !guideInLang(raw, P().lang)) raw = null;
    if (raw && builtinNow && (raw.sites || []).length <= (builtinNow.sites || []).length) raw = null;
    if (raw) {
      raw = await realPlaces(raw, label);
      if (raw && raw.grounded) { c = cleanCity(raw, label); if (raw.area) c.area = String(raw.area); if (!c.sites.length) c = null; }
    }
    if (!c && !builtinNow) c = await sourceGuide(d);
    if (!c) throw new Error(builtinNow ? "not fuller" : "no sources");
    installGuide(d, c);
    if (!quiet) { busy = null; view = "plan"; render(); toTop(); }
    return true;
  } catch (e) {
    try { console.warn("Guide (no AI) failed for " + label + ":", e && (e.message || e)); } catch (x) {}
    if (!quiet) { busy = null; aiError = /not fuller/.test((e && e.message) || "") ? "" : `I couldn't find ${label} in the travel guides and maps just now. Check the spelling (for example "Kotor, Montenegro") and try again.`; render(); }
    return false;
  }
}
async function sourceGuide(d) {
  const label = d.destination, src = await sourcesFor(label);
  if (!src || !Array.isArray(src.stops) || !src.center || !isFinite(src.center.lat)) return null;
  const area = bareName(src.area || label) || bareName(label), port = bareName(label);
  const title = keyOf(area) && keyOf(port) && !keyOf(port).includes(keyOf(area)) && !keyOf(area).includes(keyOf(port)) ? area + " (from " + port + ")" : area;
  const tmp = { city: title, country: "", sites: [], farther: [], starts: {}, restaurants: [] };
  sourceSights(tmp, src);
  const main = tmp.sites.filter(x => !x.quick);
  if (main.length < 3) return null;
  // The best known few are the must-sees (the same outside evidence famousRepair uses).
  const bar = famousMustBar(main.map(x => ({ sl: x.fame || 0 })));
  main.forEach(x => { if ((x.fame || 0) >= bar || x.unesco) x.mustSee = true; });
  let raw = { city: title, country: "", sites: tmp.sites, farther: [], restaurants: [], starts: null, grounded: true, verified: 0 };
  try { raw = (await realPlaces(raw, label)) || raw; } catch (e) {}
  const starts = await srcStarts(label, area, port, src.center, d);
  const c = cleanCity(Object.assign({}, raw, { sites: [], farther: [], starts }), label);
  Object.assign(c, { sites: tmp.sites, farther: [], ai: false, srcGuide: SRCG_V, grounded: true, startsOk: STARTS_V, area: label, eatsV: raw.eatsV || 0, verified: raw.verified || 0 });
  // cleanCity drops a start's "unknown" mark: put it back, so a day is never planned from a guessed port or airport.
  for (const k of Object.keys(starts)) (starts[k] || []).forEach((p, i) => { if (p.unknown && c.starts[k][i]) c.starts[k][i].unknown = true; });
  return c;
}
// The airport, main station and cruise port, looked up by name on the map and the encyclopedia. A gateway port
// ("Civitavecchia (Rome)") is looked up by the port's own name.
const SG_KIND = {
  airport: { re: /airport|aeroporto|aeropuerto|a[ée]roport|flughafen|lufthavn|luchthaven|havaliman|aerodrom|αερολιμ/i, map: /aerodrome|airport/, km: 60 },
  station: { re: /station|stazione|estaci[oó]n|gare\b|bahnhof|centraal|σταθμ|dworzec|n[aá]dra[zž]/i, map: /station|train/, km: 15 },
  cruise: { re: /cruise|terminal|port of|harbou?r|\bport\b|porto|puerto|\bpier\b|quay|marina|λιμ[άα]ν/i, map: /harbou?r|ferry|pier|port|terminal|marina/, km: 30 }
};
async function srcStarts(label, area, port, centre, d) {
  const gate = keyOf(port) !== keyOf(area);
  const ask = { airport: [area + " airport", area + " international airport"], station: [area + " railway station", area + " central station"], cruise: ["Port of " + port, port + " cruise terminal"] };
  const names = [...ask.airport, ...ask.station, ...ask.cruise];
  let res = null;
  try { const r = await fetch(freeAI.url + "/ground", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ city: label, names: names.slice(0, 8) }) }); if (r.ok) { const j = await r.json(); if (Array.isArray(j.results)) res = j.results; } } catch (e) {}
  const found = k => {
    const K = SG_KIND[k], lim = k === "cruise" && gate ? 150 : K.km, cands = [];
    names.forEach((n, i) => { if (!ask[k].includes(n)) return; const x = (res && res[i]) || {};
      (x.wiki || []).forEach(w => { if (w.lat != null && K.re.test(w.title || "")) cands.push({ name: w.title, lat: +w.lat, lng: +w.lng }); });
      (x.map || []).forEach(m => { if (isFinite(m.lat) && (K.re.test(m.name || "") || K.map.test(m.kind || ""))) cands.push({ name: m.name || n, lat: +m.lat, lng: +m.lng }); }); });
    const near = cands.filter(p => p.name && hav(p, centre) <= lim);
    if (k === "cruise" && gate) near.sort((a, b) => (nameMatch(port, b.name) ? 0 : 1) - (nameMatch(port, a.name) ? 0 : 1));
    return near[0] || null;
  };
  const starts = { cruise: [], airport: [], station: [], hotel: [], point: [] };
  for (const k of ["airport", "station", "cruise"]) {
    let p = found(k);
    if (!p && k !== "station") { const g = knownGate(k, { name: k === "cruise" ? port : area + " airport" }, centre, k === "cruise" && gate ? 150 : SG_KIND[k].km); if (g) p = { name: g.name, lat: g.lat, lng: g.lng }; }
    starts[k].push(p ? { name: p.name, lat: p.lat, lng: p.lng, note: "" } : { name: (k === "cruise" ? "Cruise port of " + port : k === "airport" ? area + " airport" : area + " main station"), lat: centre.lat, lng: centre.lng, note: "", unknown: true });
  }
  starts.hotel.push({ name: "Hotel in central " + area, lat: centre.lat, lng: centre.lng, note: "Add your own hotel on the Trip page for exact times." });
  starts.point.push({ name: "Central " + area, lat: centre.lat, lng: centre.lng, note: "" });
  return starts;
}
// The traveler's own hotel, found on the map by name (OpenStreetMap through the helper), with no AI.
async function findHotelNoAI(name, d) {
  if (!freeAI || !name) return null;
  try {
    const r = await fetch(freeAI.url + "/findplace?city=" + encodeURIComponent(bareName(d.destination)) + "&q=" + encodeURIComponent(name)); if (!r.ok) return null;
    const j = await r.json(), list = (j && j.places) || [];
    const hit = list.find(p => isFinite(p.lat) && (nameMatch(name, p.name) || (p.names || []).some(n => nameMatch(name, n)))) || list.find(p => isFinite(p.lat) && /hotel|guest|hostel|apartment|motel|tourism/.test((p.kind || "") + " " + (p.cat || "")));
    return hit ? { name: hit.name || name, lat: +hit.lat, lng: +hit.lng, addr: hit.addr || "" } : null;
  } catch (e) { return null; }
}
if (typeof window !== "undefined") {
  // Test hook: build a city's guide from its sources alone (as with the AI switched off) for day i.
  window.__kairouteSourceGuide = async i => { const d = trip.days[i]; const c = await sourceGuide(d); return c ? { city: c.city, main: c.sites.filter(x => !x.quick).length, quick: c.sites.filter(x => x.quick).length, must: c.sites.filter(x => x.mustSee).map(x => x.name), eats: c.restaurants.length, starts: Object.fromEntries(Object.entries(c.starts).map(([k, v]) => [k, v.map(p => p.name + (p.unknown ? " (unknown)" : ""))])) } : null; };
}
