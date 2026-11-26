// Beta 2 engine, step 2: fold the places files (step 1) into a trip's bucket. Pure: takes the bucket and the places
// files by city key, returns a new bucket; never changes either. What it adds, all from checked free sources:
//  - how widely known each sight and nearby town is (language editions on Wikidata), UNESCO World Heritage, closed
//    for good;
//  - opening hours as mapped, read for each day's own date (so a sight shut on that weekday is shut in the plan);
//  - for a town a day away: whether travelers' guides list it as a day trip, its own sights and its food & drink
//    places (tastings, cafés, specialty shops), so the town is a group with its own stops;
//  - the real cruise terminal or pier, where the trip only had a guess for where the ship docks. With several
//    terminals and no word on which one, the plan uses the one farthest from the sights (never short of time getting back)
//    and says so.
(function (E) {
  const TOWN_KM = 3;
  // A food or drink place worth going out of the way for: a tasting, a local specialty, a café known for one thing.
  // Read from the travel guide's own words for the place, in any of a few languages.
  const SPECIAL = /tasting|winer|wine|vineyard|weingut|vino|brewer|brauerei|beer|distill|marzipan|chocolat|praline|ice ?cream|gelat|\beis|patisser|bakery|bäckerei|konditorei|roast|coffee|cheese|fromag|specialt|historic/i;
  E.foodSpecial = x => SPECIAL.test(String(x.name || "") + " " + String(x.content || x.note || ""));
  const copy = x => JSON.parse(JSON.stringify(x));
  // A name a traveler reading English can read: Latin letters (accents too), digits and punctuation. A place to eat on the
  // map named only in another script is left out: no one can find it by a name they can't read (Nov 19, a Hebrew name).
  E.readable = name => !!name && !E.otherScript(name);
  // A place to eat that isn't open to the public: a staff or officers' canteen, a members' club (Nov 20 tester: a city hall's
  // staff cafeteria planned as dinner).
  E.notPublicEat = x => /\b(cafeteria|canteen|mensa|staff|employees?|officers'?|members'?|private)\b/i.test(String((x && x.name) || (typeof x === "string" ? x : ""))) || /^(private|no|members)$/i.test(String((x && x.access) || ""));
  // An id made from a name is never empty and never shared by two places (R-11, Nov 25): a name in another script used
  // to give no letters at all, so every such listing got the one id "wv~" and all but the first were dropped as repeats.
  // The name is read in Latin letters first; one that still gives nothing takes its position.
  const nameId = x => { const k = String(E.latin(x.name) || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/ /g, "-");
    return k || "at-" + (+x.lat).toFixed(5) + "-" + (+x.lng).toFixed(5); };
  const eatPos = x => x && E.fin(x[1]) && E.fin(x[2]) ? { lat: x[1], lng: x[2] } : null; // a map place to eat: [name, lat, lng, hours, kind]
  E.applyPlaces = (bucket, places) => {
    const b = copy(bucket), notes = b.placeNotes = [];
    const guides = b.cities || {};
    for (const [key, city] of Object.entries(guides)) {
      const P = places && places[key]; if (!P) continue;
      // Public transport lines mapped around the place: every leg they serve offers them (part 1b).
      if ((P.transit || []).length) b.transit = (b.transit || []).concat(P.transit);
      // Road times by car on the map's roads between the place, its port and its trips out: a taxi takes them, with a
      // seventh more for traffic and 10 minutes to get going (part 1 holds them for any two points near their ends).
      for (const r of P.roads || []) if (r && r.a && r.b && E.fin(r.min)) { b.legs = b.legs || {};
        const leg = { mode: "ride", road: true, min: Math.round(r.min * 1.15 + 10), km: r.km || null, a: r.a, b: r.b };
        const k = E.pairKey(r.a, r.b); if (!b.legs[k]) b.legs[k] = leg; }
      // Ferry piers as mapped: a boat leaves from a pier and lands at one, never from a church in the old town (Nov 18,
      // a ferry to an island was drawn from a cathedral, across the streets).
      const piers = (P.ports || []).filter(x => !x.cruise && /ferry|pier/i.test(String(x.kind || ""))).concat(P.piers || []).filter(x => E.fin(x.lat) && E.fin(x.lng));
      if (piers.length) b.piers = (b.piers || []).concat(piers.map(x => ({ name: E.say(x.name, "the ferry pier"), lat: x.lat, lng: x.lng })));
      // The ferry routes the map draws between piers (which pier sails to which island).
      for (const l of P.ferryLinks || []) if (l && l.a && l.b && E.fin(l.a.lat) && E.fin(l.b.lat)) (b.ferryLinks = b.ferryLinks || []).push({ name: E.say(l.name || "", ""), a: { lat: l.a.lat, lng: l.a.lng, name: E.say(l.a.name || "", "") }, b: { lat: l.b.lat, lng: l.b.lng, name: E.say(l.b.name || "", "") } });
      for (const s of city.sites || []) {
        const f = P.sites && P.sites[s.id]; if (!f) continue;
        if (f.editions) s.editions = f.editions;
        if (f.unesco) s.unesco = true;
        // Closed for good only when the map shows no opening hours: hours mapped today mean people go in.
        if (f.closedForGood && !f.hours) s.closedForGood = true;
        if (f.hours && !s.hours) s.hours = f.hours;
        // The official website, where the sight's own tickets are sold (the Book tickets link starts from it).
        if (f.web && !s.web) s.web = f.web;
      }
      // A sight of the place across the water from it, from the map (asked when the place file was built): reached by boat,
      // whether or not the traveler's phone can reach the map's server for its own water check (Nov 23: an island off the
      // old town planned as a taxi ride). The on-device check can still add more; it never removes what the file says.
      for (const s of city.sites || []) { const isl = P.islands && P.islands.sites && P.islands.sites[s.id]; if (isl && isl.across && !s.acrossWater) s.acrossWater = (isl.island && isl.island.name) || true; }
      // The class rule (R-06): ANY stop that stands on a mapped island the place's centre isn't on, and that the map's
      // paths don't reach on foot from the centre, is across the water: a sight of the guide, one the travel guide or
      // the helper brings in, a stop the traveler adds, a town a day away and its own sights. From the island outlines in
      // the place file, so it holds offline (Nov 23: Lokrum wasn't one of the file's sights and was planned as a taxi).
      // Never the island a day of this place starts from (the ship's pier, a hotel): where the traveler is, is not across
      // the water from itself (Nov 24 Venice build: the cruise terminal's own islet came back as "no way there on foot").
      // Only an island EVERY day of the place starts from: a stay on an island no path reaches, with another day starting on
      // the main island, keeps it across the water (a boat from there; independent review of cce49f79).
      const isleOf = p => p && E.fin(p.lat) && E.fin(p.lng) ? ((E.islandAt(P.islands && P.islands.shapes, p) || {}).id || "-") : null;
      const dayHomes = (b.days || []).filter(d => d.city === key).map(d => [d.point, d.lodging, d.hotel].map(isleOf).filter(Boolean)).filter(h => h.length);
      const homes = new Set(dayHomes.length ? dayHomes[0].filter(id => id !== "-" && dayHomes.every(h => h.every(x => x === id))) : []);
      const across = s => { if (!s || s.acrossWater || !P.islands || !Array.isArray(P.islands.shapes)) return;
        const sh = E.islandAt(P.islands.shapes, s); if (sh && sh.id !== P.islands.centreShape && !homes.has(sh.id) && sh.walk === false) s.acrossWater = sh.name || true; };
      // Every listed sight shows its English name (tools/places/en-names.cjs: the English Wikipedia title, else the
      // Wikidata English label); one with no English name in any source is a "Local sight" with its own name beneath
      // as the name on signs (rule R-11, any language).
      // A thin guide (under 8 sights): the travel guide's own best-known sights for the place join it, unless already there (same
      // name, or within 150 m) or closed for good.
      if ((city.sites || []).length < 8 && (P.guideSights || []).length) {
        const key = n => String(n || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
        // The same place under a longer name in the guide ("The Roman Forum" is in "Colosseum and Roman Forum", Nov 23).
        const bare = n => key(n).replace(/^the /, ""), within = (big, small) => small.split(" ").length >= 2 && (" " + big + " ").includes(" " + small + " ");
        const more = P.guideSights.filter(x => x && x.name).filter(x => !x.closedForGood && !(x.noEn && !E.readable(E.latin(x.name))) && E.fin(x.lat) && ![...(city.sites || []), ...(city.farther || [])].some(s => [x.name, x.en].filter(Boolean).some(n => key(s.name) === key(n) || within(bare(s.name), bare(n))) || (E.fin(s.lat) && E.hav(s, x) <= 0.15)))
          .map((x, n) => Object.assign({ id: "wv~" + (x.wikidata || nameId(x)), name: x.en || (x.noEn ? "Local sight" : x.name), ...(x.en || x.noEn ? { local: E.latin(x.name) } : {}), lat: x.lat, lng: x.lng, minutes: /museum|museo|musei|musée|museu|muzeum|galler/i.test(x.name) ? 60 : 30,
            editions: x.editions || 0, unesco: !!x.unesco, tags: ["from-guide"], category: "Sight", fromGuide: true, blurb: x.note || "" }, x.web ? { web: x.web } : {}, x.posDoubt ? { posDoubt: true } : {})).filter((x, i, a) => a.findIndex(y => y.id === x.id) === i);
        // Filled up to 30 sights, the best known first (a guide page can list 170: too many to choose from on a phone,
        // and slow to plan).
        more.sort((x, y) => (y.unesco ? 1 : 0) - (x.unesco ? 1 : 0) || (y.editions || 0) - (x.editions || 0) || x.id.localeCompare(y.id));
        more.length = Math.min(more.length, Math.max(0, 30 - (city.sites || []).length));
        if (more.length) city.sites = (city.sites || []).concat(more);
      }
      // Restaurants and cafés on the map beside the place's sights: lunch where the traveler is, never a detour back to the
      // few the guide names (Nov 18, a small coastal city). Kept apart as from the map (no review behind them).
      if ((P.cityEats || []).length) { const have = new Set((city.restaurants || []).map(r => E.eatKey(r.name)));
        // A place the guide names that is also on the map keeps the map's opening hours (Nov 23 real-map check: Sala Thai
        // planned for 11:45, before it opens at noon, because the guide's copy had no hours and the map's copy was dropped).
        for (const r of city.restaurants || []) { if (r.hours || !r.name) continue; const k = E.eatKey(r.name);
          const m = P.cityEats.find(x => x.hours && x.name && E.eatKey(x.name) === k && (!E.fin(r.lat) || !E.fin(x.lat) || E.hav(r, x) <= 0.3)); if (m) r.hours = m.hours; }
        city.restaurants = (city.restaurants || []).concat(P.cityEats.filter(x => x.name && !E.notPublicEat(x) && E.readable(E.latin(x.name) || x.name) && E.fin(x.lat) && E.fin(x.lng) && !have.has(E.eatKey(x.name)))
          .map(x => Object.assign({ id: "map~" + E.eatKey(x.name).replace(/ /g, "-"), name: E.say(x.name, "a local restaurant"), lat: x.lat, lng: x.lng,  kind: x.amenity || "restaurant", amenity: x.amenity || "restaurant", cuisine: x.cuisine || "", fromMap: true }, x.hours ? { hours: x.hours } : {}))); }
      // Opening hours of the places to eat on the map near the sights ([name, lat, lng, hours, kind]): a place the guide
      // names, with no hours of its own, takes the hours of the place on the map with its name within 200 m ("Sorbillo" is
      // the map's "Antonio Sorbillo"). Nov 23 real-map check: lunches planned before the place opens.
      // The same for a nearby town's places to eat (Nov 23 release gate: Sitges's "Komokieras" planned for lunch at 11:45
      // with no hours, while the map says it opens at 13:15).
      const mapHours = r => {
        if (r.hours || !r.name || !E.fin(r.lat) || !E.fin(r.lng)) return; const k = E.eatKey(r.name); if (k.length < 4) return;
        const hit = E.nearby(P.eatHours, eatPos, r, 0.2).filter(x => x && x[0] && x[3]).map(x => ({ x, mk: E.eatKey(x[0]) }))
          .filter(o => o.mk && (o.mk === k || (o.mk.length >= 4 && (o.mk.includes(k) || k.includes(o.mk)))))
          .sort((a, b) => (b.mk === k) - (a.mk === k) || E.hav(r, { lat: a.x[1], lng: a.x[2] }) - E.hav(r, { lat: b.x[1], lng: b.x[2] }))[0];
        if (hit) { r.hours = hit.x[3]; if (hit.x[4]) r.mapKind = hit.x[4]; }
      };
      if ((P.eatHours || []).length) for (const r of city.restaurants || []) mapHours(r);
      // One sight, one id: a town's sights the app already lists (it shows the places files' sights in its own list, and
      // sends them back) are never added again (Nov 19 sweep: Toledo's sights twice over made a day of 23 stops, an 8-second tick).
      const added = [], haveFar = new Set((city.farther || []).map(x => String(x.id)));
      for (const s of city.farther || []) {
        const t = P.towns && P.towns[s.id]; if (!t) continue;
        if (t.editions) s.editions = t.editions;
        if (t.unesco) s.unesco = true;
        if (t.dayTripListed) s.dayTripListed = true;
        // Across the water, from the map (Fable review #6): on another island, with no road there but a ferry.
        const isl = P.islands && P.islands.towns && P.islands.towns[s.id]; if (isl && isl.across) s.acrossWater = (isl.island && isl.island.name) || true;
        // The town's own sights (travel guide "see" listings on the map, within a walk of the town) become stops of
        // their own, so a day there is planned sight by sight and weighed by what the town really offers.
        const own = (t.sights || []).filter(x => (x.kind || "see") === "see" && !(x.noEn && !E.readable(E.latin(x.name))) && E.fin(x.lat) && E.fin(x.lng) && E.hav(s, x) <= TOWN_KM);
        s.townSights = own.map(x => ({ name: x.en || (x.noEn ? "Local sight" : x.name), lat: x.lat, lng: x.lng }));
        // A museum gets an hour, anything else half an hour; getting there takes what the town's own ride note says.
        own.forEach((x, n) => { const id = s.id + "~" + (x.wikidata || n); if (haveFar.has(id)) return; haveFar.add(id); added.push({ id, name: x.en || (x.noEn ? "Local sight" : x.name), ...(x.en || x.noEn ? { local: E.latin(x.name) } : {}), lat: x.lat, lng: x.lng, minutes: /museum|museo|musée|museu|muzeum|galler/i.test(x.name) ? 60 : 30,
          far: true, town: s.id, townName: s.name, travelNote: s.travelNote || "", ...(s.acrossWater ? { acrossWater: s.acrossWater } : {}), editions: x.editions || 0, unesco: !!x.unesco, tags: ["in-town"], category: "Sight" }); });
        // A town keeps its own visit length when picked on its own (Fable review #12: an excavation town picked alone got an hour). Only when its
        // own sights are picked too does it shrink to the walk through its centre (planAll does that, and says so).
        if (own.length >= 2) s.townWalk = Math.min(s.minutes || 60, 60);
        s.foodDrink = (t.foodDrink || []).filter(x => x.name && E.readable(E.latin(x.name))).map(x => ({ name: E.say(x.name), lat: E.fin(x.lat) ? x.lat : null, lng: E.fin(x.lng) ? x.lng : null, kind: x.kind, note: x.content || "", special: E.foodSpecial(x) }));
        // No place to eat in its travel guide: the restaurants and cafés on the map beside it (named as from the map).
        if (!s.foodDrink.some(x => x.kind === "eat") && (t.mapEats || []).length) s.foodDrink = s.foodDrink.concat(t.mapEats.filter(x => x.name && !E.notPublicEat(x) && E.readable(E.latin(x.name) || x.name)).map(x => ({ name: E.say(x.name), lat: x.lat, lng: x.lng, kind: "eat", note: x.cuisine || "", special: false, fromMap: true })));
        if ((P.eatHours || []).length) for (const x of s.foodDrink) if (x.kind === "eat") mapHours(x);
      }
      if (added.length) city.farther = (city.farther || []).concat(added);
      for (const s of (city.sites || []).concat(city.farther || [])) across(s);
      // Hours per day: a mapped opening time read for that day's date, where the day has no hours for the sight yet.
      for (const d of b.days || []) {
        if (d.city !== key || !d.date) continue;
        d.sites = d.sites || {};
        for (const s of city.sites || []) {
          if (!s.hours && !E.checkedHoursFor(s, city.name)) continue;
          const have = d.sites[s.id]; if (have && (have.closed || (have.oh && have.oh.spans && have.oh.spans.length))) continue;
          // The one hours reader (part 2b) and the calendar rules (part 2c), with the day's holiday as the bucket gives it.
          const ctx = { holiday: d.holiday === undefined ? undefined : !!(d.holiday && d.holiday.name), lat: +s.lat, lng: +s.lng, city: city.name };
          const r = E.applyDayRules(s, E.readPlaceHours(s, d.date, ctx), d.date, Object.assign({}, ctx, { holiday: d.holiday || null, country: d.cc || null }));
          const h = Object.assign({}, (have || {}).hours || {}, { src: r.src || "OpenStreetMap", why: r.why || "" }); ["notes", "holidayUnsure", "restUnsure", "sundayAfternoon", "seasonChange"].forEach(k => { if (r[k]) h[k] = r[k]; });
          if (!r.known) continue;
          if (r.allDay) { d.sites[s.id] = Object.assign({}, have || {}, { allDay: true, hoursFrom: h.src, hours: h }); continue; }
          d.sites[s.id] = Object.assign({}, have || {}, { closed: !!r.closed, oh: r.closed ? null : { spans: r.spans, last: r.last != null ? r.last : null }, hoursFrom: h.src, hours: h });
        }
        // A landing with a cable car or funicular starting beside it: the town is at the other end.
        if (d.type === "port" && d.point && E.fin(d.point.lat) && !d.point.lift) for (const l of P.lifts || []) {
          const k = (l.ends || []).findIndex(e => E.hav(e, d.point) <= 0.4); if (k < 0) continue;
          // A name known only in another script ("Τελεφερίκ", which just means cable car) is shown as what it is.
          const kindName = l.kind ? l.kind[0].toUpperCase() + l.kind.slice(1) : "Cable car", nm = !l.name || E.say(l.name) !== l.name ? kindName : l.name;
          d.point = Object.assign({}, d.point, { lift: { name: nm, kind: l.kind, top: l.ends[1 - k] } }); break; }
        // Where the ship docks: a guessed point is replaced by a mapped cruise terminal or pier.
        if (d.point && d.point.unknown && (P.ports || []).some(p => p.cruise)) {
          const pts = (city.sites || []).filter(x => E.fin(x.lat));
          const cruise = P.ports.filter(p => p.cruise), town = pts.length ? { lat: pts.reduce((a, x) => a + x.lat, 0) / pts.length, lng: pts.reduce((a, x) => a + x.lng, 0) / pts.length } : d.point;
          const far = cruise.slice().sort((x, y) => E.hav(y, town) - E.hav(x, town) || String(x.name).localeCompare(String(y.name)))[0];
          const farName = E.say(far.name, "the cruise terminal");
          d.point = { id: null, name: farName, lat: far.lat, lng: far.lng, unknown: false, from: "OpenStreetMap" };
          notes.push({ day: d.i, note: cruise.length > 1 ? `Planned from ${farName}, the cruise terminal farthest from town, until you know which one your ship uses.` : `Your ship docks at ${farName}.` });
        }
      }
    }
    // Ground heights from the places file (R-33, E48): each point of a place gets the height read at it or within 60 m
    // (ele, metres), so a walk with no street route still counts the climb between its two ends. A point with no reading
    // near it keeps none: never a guessed height.
    for (const [key, city] of Object.entries(guides)) { const P = places && places[key], H = ((P && P.heights) || []).filter(h => Array.isArray(h) && E.fin(h[0]) && E.fin(h[1]) && E.fin(h[2]));
      if (!H.length) continue;
      const at = p => { if (!p || typeof p !== "object" || !E.hasPos(p) || E.fin(p.ele)) return; let best = null, bd = 0.06;
        for (const h of H) { const d = E.hav(p, { lat: h[0], lng: h[1] }); if (d <= bd) { bd = d; best = h; } } if (best) p.ele = best[2]; };
      for (const k of Object.keys(city)) if (Array.isArray(city[k])) city[k].forEach(at);
      for (const d of b.days || []) if (d.city === key) { at(d.point); at(d.hotel); } }
    return E.namesIn(b);
  };
  // THE names pass (R-11, Nov 25: "one app-wide rule applied at every source"). Every name the bucket holds for the
  // screen, whatever source it came from (the guide, the travel guide's listings, a town's own sights, the map, a
  // looked-up pier, hotel, station or airport, a ride note), leaves here in the traveler's language: its English name
  // when it has one, else Latin letters, else the plain word for what it is, with the readable local spelling kept for
  // the "Local name" line. And as a guide prints it: a capital first letter ("piazza Venezia" is Piazza Venezia).
  // Before this, each source had its own fix and a source without one (a guide listing with no English name, a town's
  // sight, the cruise terminal's name, a sight kept from an older guide) went through as it came. Places to eat keep
  // their own name here (their saved opening hours are filed under it); the plan's last step writes the shown one.
  const PLAIN_AT = { point: d => d.type === "port" || d.type === "embark" || d.type === "disembark" ? "the cruise port" : d.mode === "train" ? "the station" : d.mode === "flight" ? "the airport" : "your starting point",
    lodging: () => "your hotel", hotel: () => "your hotel", pier: () => "the pier" };
  E.namesIn = b => {
    const fix = (o, f, plain) => { if (o && typeof o[f] === "string" && E.otherScript(o[f])) o[f] = E.say(o[f], plain); };
    for (const city of Object.values((b && b.cities) || {})) for (const k of ["sites", "farther"]) for (const s of (city && city[k]) || []) {
      if (!s || typeof s.name !== "string") continue;
      if (typeof s.en === "string" && E.otherScript(s.en)) delete s.en; // an "English name" in another script is not one
      if (E.otherScript(s.name)) { const was = s.name; s.name = E.shownName(s); if (!s.local) { const l = E.say(was, ""); if (l && l !== s.name) s.local = l; } }
      if (typeof s.local === "string" && E.otherScript(s.local)) { const l = E.say(s.local, ""); if (l && l !== s.name) s.local = l; else delete s.local; }
      s.name = E.cap(s.name);
      fix(s, "townName", "the town"); fix(s, "travelNote"); fix(s, "blurb");
      for (const x of s.townSights || []) fix(x, "name", "Local sight");
    }
    for (const d of (b && b.days) || []) if (d) for (const f of Object.keys(PLAIN_AT)) fix(d[f], "name", PLAIN_AT[f](d));
    for (const n of (b && b.placeNotes) || []) fix(n, "note");
    return b;
  };
})(KEngine);
