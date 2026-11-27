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
      if (raw && raw.grounded) { c = recheckSaved(cleanCity(raw, label)); /* R-30 */ if (c && raw.area) c.area = String(raw.area); if (c && !c.sites.length) c = null; }
    }
    if (!c && !builtinNow) c = await sourceGuide(d);
    if (!c) throw new Error(builtinNow ? "not fuller" : "no sources");
    installGuide(d, c);
    if (!quiet) { busy = null; view = "plan"; render(); toTop(); }
    return true;
  } catch (e) {
    try { console.warn("Guide (no AI) failed for " + label + ":", e && (e.message || e)); } catch (x) {}
    if (!quiet) { busy = null; aiError = /not fuller/.test((e && e.message) || "") ? "" : notFoundMsg([label], "Try again"); render(); }
    return false;
  }
}
async function sourceGuide(d) {
  const label = d.destination, src = await sourcesFor(label);
  if (!src || !Array.isArray(src.stops) || !src.center || !KEngine.fin(src.center.lat)) return null;
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
  try { const r = await fetch(freeAI.url + "/ground", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ city: label, names: names.slice(0, 8), center: centre && KEngine.fin(centre.lat) ? { lat: centre.lat, lng: centre.lng } : undefined }) }); if (r.ok) { const j = await r.json(); if (Array.isArray(j.results)) res = j.results; } } catch (e) {}
  // R: the answers, one per name in N; C: where the search was centred (the city, or the port itself on a second look).
  const found = (k, R = res, N = names, C = centre) => {
    // A port named apart from its city can be a long way out (a port 180 km from the capital it serves).
    const K = SG_KIND[k], lim = k === "cruise" && gate ? 300 : K.km, cands = [];
    N.forEach((n, i) => { if (!ask[k].includes(n)) return; const x = (R && R[i]) || {};
      (x.wiki || []).forEach(w => { if (w.lat != null && K.re.test(w.title || "")) cands.push({ name: w.title, lat: +w.lat, lng: +w.lng, any: n === "Cruise pier", wiki: true, about: String(w.extract || "") }); });
      (x.map || []).forEach(m => { if (KEngine.fin(m.lat) && (K.re.test(m.name || "") || K.map.test(m.kind || ""))) cands.push({ name: m.name || n, lat: +m.lat, lng: +m.lng, kind: m.kind || "", any: n === "Cruise pier", fit: (K.map.test(m.kind || "") ? 2 : 0) + (k === "cruise" && /cruise|terminal|wharf|pier/i.test(m.name || "") ? 2 : 0) }); }); });
    // The plain "Cruise pier" search (asked last) only counts a place that names itself a cruise pier: a private island
    // or small port whose pier has no "Port of ..." name (Nov 18: CocoCay's pier is mapped as "Royal Caribbean Cruise
    // Pier"), never a nearby fishing or ferry pier.
    for (let i = cands.length - 1; i >= 0; i--) if (cands[i].any && !/cruise/i.test(cands[i].name)) cands.splice(i, 1);
    const inReach = cands.filter(p => p.name && hav(p, C) <= lim);
    // A real terminal on the map ("Prince George Wharf Cruise Ship Terminal", a dock) before a shop or a bank that only
    // has "port" in its name (Nov 18, Nassau: "Banana Bay Nassau's Port Shop" was taken for the cruise port).
    const near = inReach.filter(p => !p.any).sort((a, b) => (a.fit === 0 ? 1 : 0) - (b.fit === 0 ? 1 : 0)).concat(inReach.filter(p => p.any).sort((a, b) => hav(a, C) - hav(b, C))); // the closest cruise pier, not a neighbour island's
    // A port named apart from the city ("Port (City)"): the pier is where the port is, the city only has the sights. The
    // search is centred on the city, so a pier in the city itself ("Bangkok Port" for a ship at a port 2 hours away) is
    // never taken for it (Round 2, N1): a pier that doesn't carry the port's own name counts only when it lies out of
    // the city (E.GATE_OUT km), as a port named apart does (a pier mapped only as "Cruise Terminal"). None: asked.
    // Kept, it carries the port's name ("Cruise Terminal, <port>"), so the traveler sees where it is and the plan knows
    // it serves the place from there (Round 2 re-check: a pier mapped only as "Cruise Terminal" was refused as too far).
    if (k === "cruise" && gate) { const out = (typeof KEngine !== "undefined" && KEngine.GATE_OUT) || 25;
      for (let i = near.length - 1; i >= 0; i--) { const c = near[i]; if (nameMatch(Pn, c.name)) continue;
        if (/cruise|\bpassengers?\b.*\bterminal\b/i.test(c.name) && hav(c, centre) > out) near[i] = Object.assign({}, c, { addPort: true }); else near.splice(i, 1); } }
    // A pier named as another port's ("Port of <somewhere else>") is that port's, never this one's (Round 2 re-check: a
    // small harbour's pier taken for a city's cruise port).
    if (k === "cruise") for (let i = near.length - 1; i >= 0; i--) { const m = /^port of (.+)$/i.exec(String(near[i].name || "").trim()); if (m && !nameMatch(Pn, m[1]) && !nameMatch(A, m[1])) near.splice(i, 1); }
    // Never a building site or a closed station; every real one kept, so a city with several is asked which (Nov 20 tester:
    // London's Paris train sent to Victoria, Paris's station a Grand Paris Express building site).
    // (The port's name is added after this check, so a word in it never decides what the pier is.)
    const real = (typeof KEngine !== "undefined" && KEngine.gateChoices ? KEngine.gateChoices(near, k) : near).map(c => c.addPort ? Object.assign({}, c, { name: c.name + ", " + Pn }) : c);
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
  // A port named apart from its city with no pier found near the city: looked for again around the port itself, found
  // from its own encyclopedia article (Round 2 re-check: a port 120 km from the city it serves was searched for only
  // around the city, and nothing was found).
  if (gate && freeAI && starts.cruise.length === 1 && starts.cruise[0].unknown && Array.isArray(res)) {
    const at = res.flatMap(x => (x && x.wiki) || []).find(w => w && w.lat != null && KEngine.fin(w.lat) && KEngine.fin(w.lng) && nameMatch(Pn, w.title || ""));
    if (at) try { const r = await fetch(freeAI.url + "/ground", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ city: Pn, names: ask.cruise, center: { lat: +at.lat, lng: +at.lng } }) });
      if (r.ok) { const j = await r.json(); if (Array.isArray(j.results)) { const p = found("cruise", j.results, ask.cruise, { lat: +at.lat, lng: +at.lng });
        if (p) starts.cruise = (Array.isArray(p) ? p : [p]).map(x => ({ name: x.name, lat: x.lat, lng: x.lng, note: "" })); } } } catch (e) {}
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
    const hit = list.find(p => KEngine.fin(p.lat) && (nameMatch(name, p.name) || (p.names || []).some(n => nameMatch(name, n)))) || list.find(p => KEngine.fin(p.lat) && /hotel|guest|hostel|apartment|motel|tourism/.test((p.kind || "") + " " + (p.cat || "")));
    return hit ? { name: hit.name || name, lat: +hit.lat, lng: +hit.lng, addr: hit.addr || "" } : null;
  } catch (e) { return null; }
}
// ---- Classic day trips (rule R-37) ----
// Every city's guide offers its well-known day trips, the ones reached by boat included, in every city, from free
// sources alone (no AI, nothing invented). Nov 25: Hvar from Split, the Princes' Islands from Istanbul, Lantau from
// Hong Kong and Manly from Sydney were in no guide. The cause was the same everywhere: with the AI off, day trips came
// only from the first eight links of the travel guide's "Go next" list, only for a guide with no day trips of its own,
// and only where a line was found near the encyclopedia's point for the place, which for an island is its middle,
// kilometres from any pier. The rule, the same for every city:
// 1. What is a classic day trip: a real place 6 to 100 km out that this city's own travel guide (Wikivoyage) sends
//    its readers to (it lists it under "Go next", links to its page, or keeps it as a part of the city's own guide,
//    like "Sydney/Manly"), or that is a UNESCO World Heritage Site with a travel-guide page; known in 20+ Wikipedia
//    languages unless "Go next" names it or it is UNESCO; a place to go by the encyclopedia's facts (never an
//    airport, a stadium, a bridge, a university, a region or an organisation); not already in the guide.
// 2. The ones the city's guide says most about first, then the best known (fame alone put Salerno and Benevento ahead
//    of Capri and Sorrento for Naples), never the first ones mentioned; two of them within 3 km, or of one name, are
//    one outing.
// 3. Each needs a real way there, or it is left out: a train, bus or boat line within 2 hours (the timetables, then the
//    map's lines); for an island, looked for at the ferry terminals the map shows on that island, the nearest to the
//    city first, and the trip is planned to that pier; else a drive of up to 90 minutes that takes no boat. Its
//    "Getting there" says which of these it is, and a time that is no timetable's says so.
// 4. Up to 6 for a city, whether or not its guide already has day trips of its own. They are offered in the list for
//    the traveler to pick: the app never puts one on a day itself (never a day's leading pick).
// A way that couldn't be asked (a service busy) is asked again the next time; nothing is guessed in between.
const TRIPS_V = 2, TRIP_MAX = 6, TRIP_ASK = 16, TRIP_FAME = 20, TRIP_KM_MIN = 6, TRIP_KM = 100, TRIP_LINE_MIN = 120, TRIP_BOAT_KM = 40, TRIP_ROAD_KM = 75, TRIP_ROAD_MIN = 90, TRIP_ONE_KM = 3, TRIP_PART_KM = 15;
const TRIP_NOT = /^(airport|station|university|school|hospital|hotel|office-building|business|stadium|arena|sports-venue|street|road|bridge|organization|event|occurrence|language|creative-work|term|continent)$/;
const TRIP_NEVER = /^(airport|station|stadium|arena|sports-venue)$/;
const TRIP_PLACE = /^(settlement|island|old-town|archaeological|ancient-city|castle|fortification|palace|park|garden|natural|mountain|beach|waterfall|monastery|museum|art-museum|amusement-park|zoo)$/;
const TRIP_NOT_NAME = /\b(airport|railway station|train station|university|stadium|arena|bridge|motorway|highway|expressway|prison|hospital|province|county|district|region|prefecture|municipality)\b/i;
const tripIsle = y => srcHas2(y, /^island$/) && !srcHas2(y, /^settlement$/);
// Across water: an island by the facts, or a place the road map reaches only on a ferry or not at all.
const tripWater = y => tripIsle(y) || !!y.water;
// What a place a day out is, by the facts: a place to go, or not.
function tripPlace(y) {
  if (!y || y.gone || y.localName || nonLatin(y.name)) return false;   // shown in the traveler's language or not at all (R-11)
  // What the travel guide itself files the page under: a country, an airport or an itinerary is no day out; a city, a
  // district, a park or a rural area is a place to go, whatever the encyclopedia's classes say (live check, Nov 26: the
  // encyclopedia calls towns and islands "regions" too, so Sintra, Lantau and the Princes' Islands were kept out).
  if (/^(country|airport|itinerary|topic)$/.test(y.vt || "")) return false;
  // A part of the city's own guide ("Istanbul/Princes' Islands") is one of its district pages, whatever else it is called.
  const guidePlace = /^(city|district|park|rural)$/.test(y.vt || "") || !!y.part;
  // A district of the city itself is a day out only when it is out of town: an island, or 15 km out (Manly, Lantau and
  // the Princes' Islands yes; Kadıköy, Bondi Beach and the business district no). Asked before the facts are: with the
  // facts not answered a district is not known to be an island, so near by it stays out (live helper, Nov 26: Kadıköy,
  // 7.5 km from the middle of Istanbul, offered as a day trip by road when the encyclopedia's facts had not come).
  if (y.part && !y.next && !srcHas2(y, /^island$/) && y.km != null && y.km < TRIP_PART_KM) return false;
  if (!srcKnown(y)) return guidePlace || !TRIP_NOT_NAME.test(y.name);   // facts not known: its name alone must not say otherwise
  if (farNotPlace(y)) return false;
  if (!guidePlace && srcHas2(y, TRIP_NOT) && !srcHas2(y, TRIP_PLACE)) return false;
  // An airport, a station or a stadium is never a day out, even one built on an island of its own.
  if (srcHas2(y, TRIP_NEVER) && !srcHas2(y, /^settlement$/)) return false;
  // A page the travel guide files as a region (a coast, a delta, a county, an island group) is a day out only when it
  // is an island, a heritage site, or the city's guide sends readers on to it by name.
  if (y.vt === "region" && !srcHas2(y, /^island$/) && !y.unesco && !y.next) return false;
  // A province, county or district is an area, not a place to go (unless it is the heritage site itself).
  if (!y.vt && srcHas2(y, /^(admin-area|region)$/) && !srcHas2(y, TRIP_PLACE) && !y.unesco) return false;
  return true;
}
// How much a place is a classic day out of this city: what the city's own guide says of it first ("Go next", a part of
// the city's guide, each link to it up to five), a heritage site, then how well known it is.
const tripScore = y => (y.next ? 30 : 0) + (y.part ? 30 : 0) + 10 * Math.min(5, y.said || 0) + (y.unesco ? 30 : 0) + (y.sl || 0) / 2;
// The classic day trips the sources know for this city that its guide lacks, best first (steps 1 and 2).
function tripCands(city, src) {
  const centre = srcCentre(city, src); if (!centre || !src) return [];
  const all = allSites(city), names = [city.city, src.area].map(n => keyOf(String(n || "").replace(/\s*\(.*\)/, "").split(",")[0])).filter(Boolean);
  const have = y => all.some(s => !s.lineOpen && ((y.wd && s.wd === y.wd) || sameSight(y, s) || (s.merged || []).some(m => sameSight(y, m)) || (s.alsoNames || []).some(n => keyOf(n) === keyOf(y.name))));
  const pool = [];
  const put = (y, ev) => { if (!y || !y.name || !KEngine.fin(y.lat) || !KEngine.fin(y.lng)) return;
    // A part of the city's own guide is shown by its own name, never as the guide files it ("Venice/Burano"; live check, Nov 27).
    const m = /^([^/]+)\/(.+)$/.exec(String(y.name)); if (m && names.includes(keyOf(m[1]))) y = Object.assign({}, y, { name: m[2].trim() });
    const was = pool.find(x => (y.wd && x.wd === y.wd) || keyOf(x.name) === keyOf(y.name) && hav(x, y) <= TRIP_ONE_KM);
    if (was) { Object.assign(was, ev); for (const k of ["sl", "kinds", "note", "voy", "vt", "said", "part"]) if (was[k] == null && y[k] != null) was[k] = y[k]; if (y.unesco) was.unesco = true; if (y.heritage) was.heritage = true; return; }
    pool.push(Object.assign({}, y, ev, { km: hav(centre, y) })); };
  for (const y of src.far || []) if (y && y.voy && (y.said > 0 || y.part || y.unesco)) put(y, {});
  for (const y of src.next || []) put(y, { next: true });
  // The travel guide files an island group as a region or as a rural area ("Stockholm archipelago" is a rural area; live
  // check, Nov 27): either way it is an area with places in it.
  const tripArea = R => R.vt === "region" || (R.vt === "rural" && tripIsle(R));
  // A region the guide points to is no one spot: it is visited at the best-known place the region's own guide page
  // names (the Stockholm archipelago at Vaxholm; live check, Nov 27). The place takes the region's standing in the
  // city's guide. An island group keeps its own piers when the map has them: the place stands in only when it has none.
  for (let i = 0; i < pool.length; i++) { const R = pool[i]; if (!tripArea(R) || !R.voy || !(R.next || R.unesco || srcHas2(R, /^island$/))) continue;
    const mem = (src.far || []).filter(y => y && y.voy && y.inVoy === R.voy && KEngine.fin(y.lat) && KEngine.fin(y.lng) && !(y.wd && pool.some(x => x.wd === y.wd)) && !pool.some(x => keyOf(x.name) === keyOf(y.name)))
      .map(y => Object.assign({}, y, { km: hav(centre, y) })).filter(y => y.km > TRIP_KM_MIN && y.km <= TRIP_KM && !nonLatin(y.name) && !names.includes(keyOf(y.name)) && tripPlace(Object.assign({}, y, { next: true })))
      .sort((a, b) => (b.sl || 0) - (a.sl || 0) || a.km - b.km);
    if (!mem.length) continue;
    // Its best-known place is on the list already: the region is served, and no lesser place is put forward in its name.
    if (have(mem[0])) { if (!tripIsle(R)) pool.splice(i--, 1); continue; }
    const stand = Object.assign({}, mem[0], { said: R.said, next: R.next, sl: Math.max(R.sl || 0, mem[0].sl || 0), via: R.name, viaOf: mem.slice(0, 5).map(y => y.name) });
    if (tripIsle(R)) R.stand = stand; else pool[i] = stand; }
  const score = y => tripScore(y);
  const ok = pool.filter(y => y.km > TRIP_KM_MIN && y.km <= TRIP_KM && !names.includes(keyOf(y.name)) && tripPlace(y) && ((y.sl || 0) >= TRIP_FAME || y.unesco || y.next) && !have(y))
    .sort((a, b) => score(b) - score(a) || a.km - b.km);
  // One outing once: the same name twice (an island and its town), or two places within 3 km; a town or a sight has a
  // real spot to go to, so it stays ahead of the island it stands on.
  const out = [];
  for (const y of ok) { const k = out.findIndex(x => keyOf(x.name) === keyOf(y.name) || hav(x, y) <= TRIP_ONE_KM);
    if (k < 0) { out.push(y); continue; }
    if (keyOf(out[k].name) === keyOf(y.name) && tripIsle(out[k]) && !tripIsle(y)) out[k] = Object.assign({}, y, { sl: Math.max(y.sl || 0, out[k].sl || 0), unesco: y.unesco || out[k].unesco, next: y.next || out[k].next }); }
  return out.slice(0, TRIP_ASK);
}
// The words for how you get there, from the way found (step 3): a timetable's line, a line the map shows, or the road.
function tripTravel(way, cityName) {
  const five = m => Math.max(5, Math.round(m / 5) * 5);
  // A line that was found but takes too long is said as that, never as "no line known" (Wollongong from Sydney by road
  // while a train of over two hours was known; live check, Nov 27).
  if (way.road && way.road.slow) return `By road (taxi or car), about ${five(way.road.min)} min one way by the road route. The train, bus or boat lines Kairoute knows of take more than ${TRIP_LINE_MIN / 60} hours.`;
  if (way.road) return `By road (taxi or car), about ${five(way.road.min)} min one way by the road route. Kairoute doesn't know of a train, bus or boat line for this trip.`;
  const o = way.line, from = o.from && !nonLatin(o.from) ? o.from : cityName, boat = /ferry/i.test(o.mode || o.kind || "");
  // A ride with changes is named by its longest part but starts at the first stop: say so, or the card reads as if the
  // boat left from a railway station ("Ferry from Sydenham Station" for Manly; live check, Nov 27).
  const ch = +(/\+ (\d+) change/.exec(o.label || "") || [])[1] || (KEngine.fin(o.changes) && o.changes > 0 ? +o.changes : 0);
  // Where the named part itself is boarded, when the helper says (mainFrom): the quay the ferry really leaves.
  const main = o.mainFrom && !nonLatin(o.mainFrom) ? o.mainFrom : "";
  if (ch && !o.noTimetable && main) return `${o.kind} from ${main}, with ${ch} change${ch > 1 ? "s" : ""} on the way${main !== from ? " (the ride starts at " + from + ")" : ""}, about ${five(o.min)} min one way by its timetable. Check the times for your day.`;
  if (ch && !o.noTimetable) return `${o.kind} with ${ch} change${ch > 1 ? "s" : ""}, starting from ${from}, about ${five(o.min)} min one way by its timetable. Check the times for your day.`;
  if (way.noTime) return `${o.kind} from ${from}: the map shows the route, but Kairoute doesn't know its times or how long it takes. Check both before you go.`;
  if (o.noTimetable) return `${o.kind} from ${from}: the map shows the ${boat ? "route" : "line"}, but its times are not confirmed. About ${five(o.min)} min one way is an estimate; check the times before you go.`;
  return `${o.kind} from ${from}, about ${five(o.min)} min one way by its timetable. Check the times for your day.`;
}
const tripsBusy = {}, tripsTries = {}, tripsLog = {};
async function classicTrips(city, src, quiet) {
  const k = keyOf(city.city); if (!freeAI || tripsBusy[k] || !src || (!Array.isArray(src.far) && !Array.isArray(src.next))) return 0;
  // Once per guide for what the sources hold now: asked again when their lists grow, or when a way couldn't be asked.
  const sig = TRIPS_V + ":" + (src.far || []).length + ":" + (src.next || []).length;
  if (city.tripsSig === sig && !city.tripsOpen) return 0;
  if ((tripsTries[k] || 0) >= 3) return 0;
  const centre = srcCentre(city, src); if (!centre) return 0;
  const room = TRIP_MAX - (city.farther || []).filter(x => x.classic).length;
  const cands = room > 0 || (city.farther || []).some(x => x.lineOpen) ? tripCands(city, src) : [];
  if (!cands.length) { city.tripsSig = sig; delete city.tripsOpen; return 0; }
  tripsBusy[k] = true; tripsTries[k] = (tripsTries[k] || 0) + 1;
  let open = false, added = 0;
  try {
    const getJ = async u => { try { const r = await fetch(freeAI.url + u); if (r.ok) return await r.json(); if (r.status < 500 && r.status !== 429) return {}; } catch (e) {} return null; };
    // Where each is reached: an island at its piers (the two nearest the city), any other place at its own point.
    // Two islands at a time: asked all at once, the free map servers refused most of the asks (live check, Nov 26).
    const inTurn = async (list, n, fn) => { const out = new Array(list.length); let at = 0; await Promise.all(Array.from({ length: n }, async () => { while (at < list.length) { const i = at++; out[i] = await fn(list[i]); } })); return out; };
    // Whether a place is across water is asked of the road map when the facts don't say: they had not come, or they
    // name a town that stands on an island (live helper, Nov 26: with no facts answered Hvar was looked for at its
    // middle, found no line there, and its drive "with a ferry" ended the matter; Lamma had no road at all).
    const roadOf = y => getJ(`/roadway?a=${(+centre.lat).toFixed(4)},${(+centre.lng).toFixed(4)}&b=${(+y.lat).toFixed(4)},${(+y.lng).toFixed(4)}`);
    const roads = await inTurn(cands, 2, async y => { if (tripIsle(y) || !y.wd || (srcKnown(y) && !srcHas2(y, /^island$/))) return undefined;
      const j = await roadOf(y); if (!j) open = true; else if (j.ferry || j.none) y.water = true; return j; });
    const targets = await inTurn(cands, 2, async function at(y) {
      if (!tripWater(y) || !y.wd) return [{ lat: y.lat, lng: y.lng }];
      const j = await getJ("/landing?wd=" + encodeURIComponent(y.wd)); if (!j) { open = true; return []; }
      const ps = (j.piers || []).filter(p => KEngine.fin(p.lat) && KEngine.fin(p.lng)).sort((a, b) => hav(centre, a) - hav(centre, b)).slice(0, 2);
      // An island group with no pier of its own on the map is visited at the place its guide page names.
      if (!ps.length && y.stand) { const st = y.stand; for (const k of Object.keys(y)) delete y[k]; Object.assign(y, st); return at(y); }
      // An island or island group with a pier in town is the one the city stands on, not a day out ("Cyclades" from
      // Mykonos, "New Providence" from Nassau; live check, Nov 26).
      if (ps.length && hav(centre, ps[0]) <= TRIP_KM_MIN) return [{ home: true }];
      if (!ps.length) y.noOutline = !j.outline;
      return ps.length ? ps.map(p => ({ lat: p.lat, lng: p.lng, pier: p.name && !nonLatin(p.name) ? p.name : "" })) : [{ lat: y.lat, lng: y.lng, noPier: true }]; });
    const flat = []; targets.forEach((ts, i) => ts.forEach(t => { if (!t.home) flat.push({ i, t }); }));
    const lines = new Array(flat.length).fill(undefined);
    // Three at a time: eight trips a day out in one ask took the helper longer than the page waits (live check, Nov 26:
    // every first ask of eight timed out after 60 s, three tries running).
    for (let at = 0; at < flat.length; at += 3) { const part = flat.slice(at, at + 3); let res = null, why = "";
      try { const r = await fetch(freeAI.url + "/transit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pairs: part.map(x => ({ a: [+centre.lat, +centre.lng], b: [+x.t.lat, +x.t.lng], dow: 3 })) }) });
        if (r.ok) res = ((await r.json()) || {}).results || []; else why = " (" + r.status + ")"; } catch (e) { why = " (" + String(e && e.name || e) + ")"; }
      part.forEach((x, n) => { lines[at + n] = res ? res[n] || null : undefined; if (!res) x.why = why; }); }
    const ways = [], log = tripsLog[k] = [], last = tripsTries[k] >= 3;
    for (let i = 0; i < cands.length; i++) { const y = cands[i]; let best = null, boat = null, part = false, slowLine = false, unknown = !targets[i].length;
      if (targets[i][0] && targets[i][0].home) { log.push({ name: y.name, at: "a pier in town", lines: [], got: "the city stands on it" }); continue; }
      const L = { name: y.name, at: !targets[i].length ? "piers not answered" : targets[i][0].noPier ? (y.noOutline ? "no outline on the map" : "no pier on the map") : targets[i][0].pier != null ? targets[i].length + " pier(s)" : "its point" + (y.via ? ", standing for " + y.via + " (of " + (y.viaOf || []).join(", ") + ")" : ""), lines: [] }; log.push(L);
      if (roads[i]) L.road = roads[i].none ? "none" : roads[i].min + " min" + (roads[i].ferry ? " with a ferry" : "");
      flat.forEach((x, n) => { if (x.i !== i) return; const r = lines[n];
        L.lines.push(r === undefined ? "not answered" + (x.why || "") : r === null ? "no answer" : (r.partial ? "partial " : "") + ((r.opts || []).map(o => o && (o.kind || o.mode) + " " + o.min + (o.noTimetable ? " map" : "")).join(", ") || "none"));
        if (r === undefined || r === null || (r.partial && !(r.opts || []).length)) { unknown = true; return; }
        if (r.partial) part = true;
        if ((r.opts || []).some(o => o && o.kind && KEngine.fin(o.min) && o.min > TRIP_LINE_MIN)) slowLine = true;
        for (const o of r.opts || []) if (o && o.kind && KEngine.fin(o.min) && o.min > 0 && o.min <= TRIP_LINE_MIN && (!o.every || o.every <= 120) && (!best || o.min < best.line.min)) best = { line: o, at: x.t };
          // A boat the map shows with no timetable, to a pier near by: its guessed time runs long (the Princes' Islands,
          // 19 km from Istanbul, guessed at 3 hours; live check, Nov 26), so the guess neither rules the place out nor is
          // shown: the card says a boat goes and that Kairoute doesn't know its times.
          else if (o && o.kind && o.noTimetable && /ferry/i.test(o.mode || o.kind || "") && KEngine.fin(o.min) && o.min > TRIP_LINE_MIN && hav(centre, x.t) <= TRIP_BOAT_KM && !boat) boat = { line: o, at: x.t, noTime: true }; });
      if (!best && boat) best = boat;
      // No line (asked and answered: a line not asked about yet is not "no line"): the road, when a drive really goes
      // there without a boat. Never to an island.
      if (!best && (!unknown || last) && !tripWater(y) && y.km <= TRIP_ROAD_KM) { const j = roads[i] || await roadOf(y);
        L.road = !j ? "not answered" : j.none ? "none" : j.min + " min" + (j.ferry ? " with a ferry" : "");
        if (!j) unknown = true; else if (KEngine.fin(j.min) && j.min > 0 && j.min + 10 <= TRIP_ROAD_MIN && !j.ferry && !j.none) best = { road: { min: j.min + 10, km: j.km, slow: slowLine }, at: { lat: y.lat, lng: y.lng } }; }
      L.got = best ? (best.road ? "road" : "line") : unknown ? "unknown" : "no way";
      // Offered by road, or by a boat with no times, while the timetable was still being read: asked again another time.
      const more = !!best && ((unknown && !!best.road) || (!!best.noTime && part));
      if (best) ways.push({ y, way: best, lineOpen: more });
      if (best && (unknown || more)) open = true;   // offered by road on the last try: the line is asked about again another time
      // A way not answered yet: asked again later, and the places ranked after it wait for it, so the list never fills
      // with lesser places while a better one is still being asked about (live check, Nov 26: Enköping offered from
      // Stockholm while Sigtuna and Uppsala were unanswered). On the last try of a session what is known is offered.
      else if (unknown) { open = true; if (!last) break; } }
    city.farther = city.farther || [];
    for (const { y, way, lineOpen } of ways) {
      const note = String(y.note || "").replace(new RegExp("^" + y.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*[-–—:,]?\\s*", "i"), "").trim();
      const cat = (() => { const c = srcKnown(y) ? srcKindOf(y)[1] : ""; return c && !/^(Sight|Landmark)$/.test(c) && !tripIsle(y) && !srcHas2(y, /^settlement$/) ? c : "Day trip"; })();
      const about = y.unesco ? "A UNESCO World Heritage Site" : tripIsle(y) ? "An island" : srcHas2(y, /^settlement$/) ? "A town" : "A place";
      const via = y.via && !nonLatin(y.via) ? srcShowName(y.via, "") : "";
      const st = normSite({ id: (y.wd ? "trip-" + y.wd : keyOf(y.name).replace(/ /g, "-") + "-far"), name: srcShowName(y.name, ""), lat: way.at.lat, lng: way.at.lng, minutes: 180, kind: "touristy", far: true, category: cat, travel: tripTravel(way, city.city),
        summary: note.length > 20 ? note : via ? `${about} in ${via}, which the travel guide to ${String(city.city).replace(/\s*\(.*\)/, "")} sends its readers to.` : `${about} a day out from ${String(city.city).replace(/\s*\(.*\)/, "")} that the travel guide has a page of its own for.` }, 0);
      Object.assign(st, { far: true, fame: y.sl || 0, unesco: !!y.unesco, heritage: !!y.heritage, src: [y.next ? "Wikivoyage (English)" : "Wikivoyage (its own page)", "Wikidata (Wikipedia in many languages)"], wd: y.wd, famousFix: true, noAI: true, classic: true,
        travelSrc: way.road ? "road" : way.line.noTimetable ? "map" : "timetable" });
      if (way.at.pier) st.landing = way.at.pier;
      // A day trip offered by road while its line was not answered takes the line once it is known.
      const was = (city.farther || []).find(s => s.id === st.id && s.lineOpen);
      if (was) { if (!lineOpen) { delete was.lineOpen; if (!way.road) { Object.assign(was, { travel: st.travel, travelSrc: st.travelSrc, lat: st.lat, lng: st.lng }); added++; } } continue; }
      if (added >= room) continue;
      if (lineOpen) st.lineOpen = true;
      if (allSites(city).some(s => s.id === st.id)) continue;
      city.farther.push(st); added++;
    }
    city.tripsSig = sig; if (open) city.tripsOpen = true; else delete city.tripsOpen;
    if (added) { keepFills(city); try { console.info("Kairoute added " + added + " classic day trips for " + city.city); } catch (e) {} if (!quiet) { save(); if (["plan", "sites", "guide"].includes(view)) { const y = window.scrollY; render(); window.scrollTo(0, y); } } }
  } catch (e) {} finally { tripsBusy[k] = false; }
  return added;
}
// The name older code and saved hooks know this step by.
const farNoAI = (city, src, quiet) => classicTrips(city, src, quiet);
if (typeof window !== "undefined") {
  window.__kairouteFarNoAI = farNoAI;
  window.__kairouteClassicTrips = (city, src) => classicTrips(city, src, true);
  window.__kairouteTripLog = city => tripsLog[keyOf(city.city)] || [];
  window.__kairouteTripWhy = (city, src, re) => { const c = srcCentre(city, src), rx = new RegExp(re, "i"); return (src.far || []).concat((src.next || []).map(x => Object.assign({ next: true }, x))).filter(y => rx.test(y.name) || rx.test(y.voy || "")).map(y => ({ name: y.name, wd: y.wd, voy: y.voy, said: y.said, part: !!y.part, next: !!y.next, sl: y.sl, vt: y.vt, inVoy: y.inVoy, kinds: y.kinds, km: c ? +hav(c, y).toFixed(1) : null, place: tripPlace(Object.assign({ km: c ? hav(c, y) : null }, y)) })); };
  window.__kairouteTripCands = (city, src) => tripCands(city, src).map(y => ({ name: y.name, kinds: (y.kinds || []).join("/"), km: +y.km.toFixed(1), sl: y.sl || 0, next: !!y.next, part: !!y.part, said: y.said || 0, unesco: !!y.unesco, isle: tripIsle(y), score: Math.round(tripScore(y)) }));
  // Test hook: build a city's guide from its sources alone (as with the AI switched off) for day i.
  window.__kairouteSourceGuide = async i => { const d = trip.days[i]; const c = await sourceGuide(d); return c ? { city: c.city, main: c.sites.filter(x => !x.quick).length, quick: c.sites.filter(x => x.quick).length, must: c.sites.filter(x => x.mustSee).map(x => x.name), eats: c.restaurants.length, starts: Object.fromEntries(Object.entries(c.starts).map(([k, v]) => [k, v.map(p => p.name + (p.unknown ? " (unknown)" : ""))])) } : null; };
}
if (typeof window !== "undefined") window.__kairouteCityOf = i => { const d = trip.days[i]; return d ? cityFor(d) || null : null; };
