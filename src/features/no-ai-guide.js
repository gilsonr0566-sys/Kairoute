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
const bareName = s => KEngine.bareName(s);
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
  // The day trips travelers suggest, where a real line gets there, are part of the guide from the start.
  try { await farNoAI(c, src, true); } catch (e) {}
  return c;
}
// The airport, main station and cruise port, looked up by name on the map and the encyclopedia. A gateway port
// ("Civitavecchia (Rome)") is looked up by the port's own name.
const SG_KIND = {
  airport: { re: /airport|aeroporto|aeropuerto|a[ée]roport|flughafen|lufthavn|luchthaven|havaliman|aerodrom|αερολιμ/i, map: /aerodrome|airport/, km: 60 },
  station: { re: /station|stazione|estaci[oó]n|gare\b|bahnhof|centraal|σταθμ|dworzec|n[aá]dra[zž]/i, map: /station|train/, km: 15 },
  // Many ships tie up at a "wharf", "dock" or "jetty" (Prince George Wharf, Nassau): those count as the cruise port too.
  cruise: { re: /cruise|terminal|port of|harbou?r|\bport\b|porto|puerto|\bpier\b|quay|wharf|\bdocks?\b|jett(y|ies)|marina|λιμ[άα]ν/i, map: /harbou?r|ferry|pier|port|terminal|marina|wharf|dock|jetty/, km: 30 }
};
async function srcStarts(label, area, port, centre, d) {
  const gate = keyOf(port) !== keyOf(area);
  // The map is asked by the place's own name, never with the country after it (Round 1 part 2: "Paris, France railway
  // station" found nothing where "Paris railway station" found the stations; the same for Florence, Buenos Aires,
  // Le Havre and CocoCay). The country stays in the search's city label.
  const own = x => KEngine.placeOnly(x) || String(x || "");
  const A = own(area), Pn = own(port);
  const ask = { airport: [A + " airport", A + " international airport"], station: [A + " railway station", A + " central station"], cruise: ["Port of " + Pn, Pn + " cruise terminal", "Cruise pier"] };
  const names = [...ask.airport, ...ask.station, ...ask.cruise];
  let res = null;
  try { const r = await fetch(freeAI.url + "/ground", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ city: label, names: names.slice(0, 8), center: centre && isFinite(centre.lat) ? { lat: centre.lat, lng: centre.lng } : undefined }) }); if (r.ok) { const j = await r.json(); if (Array.isArray(j.results)) res = j.results; } } catch (e) {}
  const found = k => {
    // A port named apart from its city can be a long way out (a port 180 km from the capital it serves).
    const K = SG_KIND[k], lim = k === "cruise" && gate ? 300 : K.km, cands = [];
    names.forEach((n, i) => { if (!ask[k].includes(n)) return; const x = (res && res[i]) || {};
      (x.wiki || []).forEach(w => { if (w.lat != null && K.re.test(w.title || "")) cands.push({ name: w.title, lat: +w.lat, lng: +w.lng, any: n === "Cruise pier", wiki: true }); });
      (x.map || []).forEach(m => { if (isFinite(m.lat) && (K.re.test(m.name || "") || K.map.test(m.kind || ""))) cands.push({ name: m.name || n, lat: +m.lat, lng: +m.lng, kind: m.kind || "", any: n === "Cruise pier", fit: (K.map.test(m.kind || "") ? 2 : 0) + (k === "cruise" && /cruise|terminal|wharf|pier/i.test(m.name || "") ? 2 : 0) }); }); });
    // The plain "Cruise pier" search (asked last) only counts a place that names itself a cruise pier: a private island
    // or small port whose pier has no "Port of ..." name (Nov 18: CocoCay's pier is mapped as "Royal Caribbean Cruise
    // Pier"), never a nearby fishing or ferry pier.
    for (let i = cands.length - 1; i >= 0; i--) if (cands[i].any && !/cruise/i.test(cands[i].name)) cands.splice(i, 1);
    const inReach = cands.filter(p => p.name && hav(p, centre) <= lim);
    // A real terminal on the map ("Prince George Wharf Cruise Ship Terminal", a dock) before a shop or a bank that only
    // has "port" in its name (Nov 18, Nassau: "Banana Bay Nassau's Port Shop" was taken for the cruise port).
    const near = inReach.filter(p => !p.any).sort((a, b) => (a.fit === 0 ? 1 : 0) - (b.fit === 0 ? 1 : 0)).concat(inReach.filter(p => p.any).sort((a, b) => hav(a, centre) - hav(b, centre))); // the closest cruise pier, not a neighbour island's
    // A port named apart from the city ("Port (City)"): the pier is where the port is, the city only has the sights. The
    // search is centred on the city, so a pier in the city itself ("Bangkok Port" for a ship at a port 2 hours away) is
    // never taken for it (Round 2, N1): a pier that doesn't carry the port's own name counts only when it lies out of
    // the city (E.GATE_OUT km), as a port named apart does (a pier mapped only as "Cruise Terminal"). None: asked.
    // Kept, it carries the port's name ("Cruise Terminal, <port>"), so the traveler sees where it is and the plan knows
    // it serves the place from there (Round 2 re-check: a pier mapped only as "Cruise Terminal" was refused as too far).
    if (k === "cruise" && gate) { const out = (typeof KEngine !== "undefined" && KEngine.GATE_OUT) || 25;
      for (let i = near.length - 1; i >= 0; i--) { const c = near[i]; if (nameMatch(Pn, c.name)) continue;
        if (/cruise/i.test(c.name) && hav(c, centre) > out) near[i] = Object.assign({}, c, { name: c.name + ", " + Pn }); else near.splice(i, 1); } }
    // A pier named as another port's ("Port of <somewhere else>") is that port's, never this one's (Round 2 re-check: a
    // small harbour's pier taken for a city's cruise port).
    if (k === "cruise") for (let i = near.length - 1; i >= 0; i--) { const m = /^port of (.+)$/i.exec(String(near[i].name || "").trim()); if (m && !nameMatch(Pn, m[1]) && !nameMatch(A, m[1])) near.splice(i, 1); }
    // Never a building site or a closed station; every real one kept, so a city with several is asked which (Nov 20 tester:
    // London's Paris train sent to Victoria, Paris's station a Grand Paris Express building site).
    const real = typeof KEngine !== "undefined" && KEngine.gateChoices ? KEngine.gateChoices(near, k) : near;
    // A port with more than one cruise pier the map is as sure of: the traveler is asked which, as for airports (Round 1);
    // Only piers the port's own name search found count (the plain "Cruise pier" search also finds a neighbour island's).
    // The order stays the one above (a real terminal first, then the closest), so the plan starts from the likeliest.
    if (k === "cruise") { if (!real.length) return null; const R = typeof KEngine !== "undefined" && KEngine.cruiseRank ? KEngine.cruiseRank : () => 0, own = real.filter(p => !p.any), top = Math.max(0, ...own.map(R));
      // One the map is surest of: that one, never the first found (Round 2: a city's old harbour found first by the
      // "Port of ..." search was taken over the cruise port the terminal search found).
      const sure = own.filter(p => R(p) >= top - 1 && R(p) > 0); return sure.length >= 2 ? sure.slice(0, 3) : sure[0] || real[0]; }
    return real.length ? real.slice(0, 5) : null;
  };
  const starts = { cruise: [], airport: [], station: [], hotel: [], point: [] };
  for (const k of ["airport", "station", "cruise"]) {
    let p = found(k);
    if (Array.isArray(p)) { p.forEach(x => starts[k].push({ name: x.name, lat: x.lat, lng: x.lng, note: "" })); continue; }
    if (!p && k !== "station") { const g = knownGate(k, { name: k === "cruise" ? Pn : A + " airport" }, centre, k === "cruise" && gate ? 300 : SG_KIND[k].km); if (g) p = { name: g.name, lat: g.lat, lng: g.lng }; }
    starts[k].push(p ? { name: p.name, lat: p.lat, lng: p.lng, note: "" } : { name: (k === "cruise" ? "Cruise port of " + Pn : k === "airport" ? A + " airport" : A + " main station"), lat: centre.lat, lng: centre.lng, note: "", unknown: true });
  }
  starts.hotel.push({ name: "Hotel in central " + A, lat: centre.lat, lng: centre.lng, note: "Add your own hotel on the Trip page for exact times." });
  starts.point.push({ name: "Central " + A, lat: centre.lat, lng: centre.lng, note: "" });
  return starts;
}
if (typeof window !== "undefined") window.__kairouteSrcStarts = (label, centre, port) => srcStarts(label, label, port || label, centre, null);
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
// Day trips with no AI (Nov 17): the places travelers suggest for a day out in the city's travel guide (Wikivoyage
// "Go next" / "Day trips", from the helper's /sources), each offered only when a real public transport line or ferry
// gets there within 2 hours, with a service at least every 2 hours. The ride found names the trip's "Getting
// there" ("Train from Madrid Chamartín, about 35 min one way"); the planner then times it from the day's own start
// like any other stop. A place with no such line (an island with a few sailings, a village only reached by car) is
// left out, never guessed. The traveler's own line from the guide is its description. Up to 4, once per guide, and
// only for a guide with no day trips of its own.
const FARNOAI_V = 1, farNoAIBusy = {};
async function farNoAI(city, src, quiet) {
  const k = keyOf(city.city); if (!freeAI || farNoAIBusy[k] || city.farNoAIV === FARNOAI_V || !src || !Array.isArray(src.next) || !src.next.length) return;
  // A guide that already has its own day trips (a built-in or written guide) keeps them as they are.
  if ((city.farther || []).some(x => !x.noAI)) return;
  const centre = srcCentre(city, src); if (!centre) return;
  const all = allSites(city), have = y => all.some(s => sameSight(y, s) || (s.merged || []).some(m => sameSight(y, m)));
  const cands = src.next.filter(y => y && y.name && isFinite(y.lat) && y.km >= 8 && y.km <= 120 && !have(y) && keyOf(y.name) !== keyOf(city.city)).slice(0, 8);
  if (!cands.length) { city.farNoAIV = FARNOAI_V; return; }
  farNoAIBusy[k] = true;
  try {
    const r = await fetch(freeAI.url + "/transit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pairs: cands.map(y => ({ a: [+centre.lat, +centre.lng], b: [+y.lat, +y.lng], dow: 3 })) }) });
    if (!r.ok) return; const j = await r.json(), res = (j && j.results) || [];
    let added = 0; city.farther = city.farther || [];
    cands.forEach((y, i) => {
      if (added >= 4) return;
      const opts = ((res[i] && res[i].opts) || []).filter(o => o && isFinite(o.min) && o.min > 0 && o.min <= 120 && (!o.every || o.every <= 120) && o.kind);
      if (!opts.length) return;
      const o = opts.sort((a, b) => a.min - b.min)[0], mins = Math.round(o.min / 5) * 5 || o.min;
      const travel = `${o.kind} from ${o.from || city.city}, about ${mins} min one way`;
      const note = String(y.note || "").replace(new RegExp("^" + y.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*[-–—:,]?\\s*", "i"), "").trim();
      const st = normSite({ id: keyOf(y.name).replace(/ /g, "-") + "-far", name: y.name, lat: y.lat, lng: y.lng, minutes: 180, kind: "touristy", far: true, category: "Day trip", travel,
        summary: note.length > 20 ? note : `A day out that travelers suggest from ${city.city}.` }, 0);
      Object.assign(st, { far: true, fame: y.sl || 0, unesco: !!y.unesco, heritage: !!y.heritage, src: ["Wikivoyage (English)"], wd: y.wd, famousFix: true, noAI: true });
      city.farther.push(st); added++;
    });
    city.farNoAIV = FARNOAI_V;
    if (added) { keepFills(city); try { console.info("Kairoute added " + added + " day trips from the travel guide for " + city.city); } catch (e) {} if (quiet) return; save(); if (["plan", "sites", "guide"].includes(view)) { const y = window.scrollY; render(); window.scrollTo(0, y); } }
  } catch (e) {} finally { farNoAIBusy[k] = false; }
}
if (typeof window !== "undefined") {
  window.__kairouteFarNoAI = farNoAI;
  // Test hook: build a city's guide from its sources alone (as with the AI switched off) for day i.
  window.__kairouteSourceGuide = async i => { const d = trip.days[i]; const c = await sourceGuide(d); return c ? { city: c.city, main: c.sites.filter(x => !x.quick).length, quick: c.sites.filter(x => x.quick).length, must: c.sites.filter(x => x.mustSee).map(x => x.name), eats: c.restaurants.length, starts: Object.fromEntries(Object.entries(c.starts).map(([k, v]) => [k, v.map(p => p.name + (p.unknown ? " (unknown)" : ""))])) } : null; };
}
if (typeof window !== "undefined") window.__kairouteCityOf = i => { const d = trip.days[i]; return d ? cityFor(d) || null : null; };
