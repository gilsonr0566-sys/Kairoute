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
  E.readable = name => !!name && !/[^\u0000-\u024F\u1E00-\u1EFF\u2000-\u206F\u20A0-\u20CF\s]/.test(String(name));
  // A place to eat that isn't open to the public: a staff or officers' canteen, a members' club (Nov 20 tester: a city hall's
  // staff cafeteria planned as dinner).
  E.notPublicEat = x => /\b(cafeteria|canteen|mensa|staff|employees?|officers'?|members'?|private)\b/i.test(String((x && x.name) || (typeof x === "string" ? x : ""))) || /^(private|no|members)$/i.test(String((x && x.access) || ""));
  E.applyPlaces = (bucket, places) => {
    const b = copy(bucket), notes = b.placeNotes = [];
    const guides = b.cities || {};
    for (const [key, city] of Object.entries(guides)) {
      const P = places && places[key]; if (!P) continue;
      // Public transport lines mapped around the place: every leg they serve offers them (part 1b).
      if ((P.transit || []).length) b.transit = (b.transit || []).concat(P.transit);
      // Road times by car on the map's roads between the place, its port and its trips out: a taxi takes them, with a
      // seventh more for traffic and 10 minutes to get going (part 1 holds them for any two points near their ends).
      for (const r of P.roads || []) if (r && r.a && r.b && isFinite(r.min)) { b.legs = b.legs || {};
        const leg = { mode: "ride", road: true, min: Math.round(r.min * 1.15 + 10), km: r.km || null, a: r.a, b: r.b };
        const k = E.pairKey(r.a, r.b); if (!b.legs[k]) b.legs[k] = leg; }
      // Ferry piers as mapped: a boat leaves from a pier and lands at one, never from a church in the old town (Nov 18,
      // a ferry to an island was drawn from a cathedral, across the streets).
      const piers = (P.ports || []).filter(x => !x.cruise && /ferry|pier/i.test(String(x.kind || ""))).concat(P.piers || []).filter(x => isFinite(x.lat) && isFinite(x.lng));
      if (piers.length) b.piers = (b.piers || []).concat(piers.map(x => ({ name: E.latin(x.name) || "the ferry pier", lat: x.lat, lng: x.lng })));
      // The ferry routes the map draws between piers (which pier sails to which island).
      for (const l of P.ferryLinks || []) if (l && l.a && l.b && isFinite(l.a.lat) && isFinite(l.b.lat)) (b.ferryLinks = b.ferryLinks || []).push({ name: E.latin(l.name || ""), a: { lat: l.a.lat, lng: l.a.lng, name: E.latin(l.a.name || "") }, b: { lat: l.b.lat, lng: l.b.lng, name: E.latin(l.b.name || "") } });
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
      // A thin guide (under 8 sights): the travel guide's own best-known sights for the place join it, unless already there (same
      // name, or within 150 m) or closed for good.
      if ((city.sites || []).length < 8 && (P.guideSights || []).length) {
        const key = n => String(n || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
        // The same place under a longer name in the guide ("The Roman Forum" is in "Colosseum and Roman Forum", Nov 23).
        const bare = n => key(n).replace(/^the /, ""), within = (big, small) => small.split(" ").length >= 2 && (" " + big + " ").includes(" " + small + " ");
        const more = P.guideSights.filter(x => !x.closedForGood && isFinite(x.lat) && !(city.sites || []).some(s => key(s.name) === key(x.name) || within(bare(s.name), bare(x.name)) || (isFinite(s.lat) && E.hav(s, x) <= 0.15)))
          .map((x, n) => Object.assign({ id: "wv~" + (x.wikidata || key(x.name).replace(/ /g, "-")), name: x.name, lat: x.lat, lng: x.lng, minutes: /museum|museo|musei|musée|museu|muzeum|galler/i.test(x.name) ? 60 : 30,
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
        city.restaurants = (city.restaurants || []).concat(P.cityEats.filter(x => x.name && !E.notPublicEat(x) && E.readable(E.latin(x.name) || x.name) && isFinite(x.lat) && isFinite(x.lng) && !have.has(E.eatKey(x.name)))
          .map(x => ({ id: "map~" + E.eatKey(x.name).replace(/ /g, "-"), name: E.latin(x.name) || x.name, lat: x.lat, lng: x.lng,  kind: x.amenity || "restaurant", amenity: x.amenity || "restaurant", cuisine: x.cuisine || "", fromMap: true }))); }
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
        const own = (t.sights || []).filter(x => (x.kind || "see") === "see" && isFinite(x.lat) && isFinite(x.lng) && E.hav(s, x) <= TOWN_KM);
        s.townSights = own.map(x => ({ name: x.name, lat: x.lat, lng: x.lng }));
        // A museum gets an hour, anything else half an hour; getting there takes what the town's own ride note says.
        own.forEach((x, n) => { const id = s.id + "~" + (x.wikidata || n); if (haveFar.has(id)) return; haveFar.add(id); added.push({ id, name: x.name, lat: x.lat, lng: x.lng, minutes: /museum|museo|musée|museu|muzeum|galler/i.test(x.name) ? 60 : 30,
          far: true, town: s.id, townName: s.name, travelNote: s.travelNote || "", ...(s.acrossWater ? { acrossWater: s.acrossWater } : {}), editions: x.editions || 0, unesco: !!x.unesco, tags: ["in-town"], category: "Sight" }); });
        // A town keeps its own visit length when picked on its own (Fable review #12: an excavation town picked alone got an hour). Only when its
        // own sights are picked too does it shrink to the walk through its centre (planAll does that, and says so).
        if (own.length >= 2) s.townWalk = Math.min(s.minutes || 60, 60);
        s.foodDrink = (t.foodDrink || []).map(x => ({ name: E.latin(x.name) || x.name, lat: isFinite(x.lat) ? x.lat : null, lng: isFinite(x.lng) ? x.lng : null, kind: x.kind, note: x.content || "", special: E.foodSpecial(x) }));
        // No place to eat in its travel guide: the restaurants and cafés on the map beside it (named as from the map).
        if (!s.foodDrink.some(x => x.kind === "eat") && (t.mapEats || []).length) s.foodDrink = s.foodDrink.concat(t.mapEats.filter(x => x.name && !E.notPublicEat(x) && E.readable(E.latin(x.name) || x.name)).map(x => ({ name: E.latin(x.name) || x.name, lat: x.lat, lng: x.lng, kind: "eat", note: x.cuisine || "", special: false, fromMap: true })));
      }
      if (added.length) city.farther = (city.farther || []).concat(added);
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
        if (d.type === "port" && d.point && isFinite(d.point.lat) && !d.point.lift) for (const l of P.lifts || []) {
          const k = (l.ends || []).findIndex(e => E.hav(e, d.point) <= 0.4); if (k < 0) continue;
          // A name known only in another script ("Τελεφερίκ", which just means cable car) is shown as what it is.
          const kindName = l.kind ? l.kind[0].toUpperCase() + l.kind.slice(1) : "Cable car", nm = !l.name || E.latin(l.name) !== l.name ? kindName : l.name;
          d.point = Object.assign({}, d.point, { lift: { name: nm, kind: l.kind, top: l.ends[1 - k] } }); break; }
        // Where the ship docks: a guessed point is replaced by a mapped cruise terminal or pier.
        if (d.point && d.point.unknown && (P.ports || []).some(p => p.cruise)) {
          const pts = (city.sites || []).filter(x => isFinite(x.lat));
          const cruise = P.ports.filter(p => p.cruise), town = pts.length ? { lat: pts.reduce((a, x) => a + x.lat, 0) / pts.length, lng: pts.reduce((a, x) => a + x.lng, 0) / pts.length } : d.point;
          const far = cruise.slice().sort((x, y) => E.hav(y, town) - E.hav(x, town) || String(x.name).localeCompare(String(y.name)))[0];
          d.point = { id: null, name: far.name, lat: far.lat, lng: far.lng, unknown: false, from: "OpenStreetMap" };
          notes.push({ day: d.i, note: cruise.length > 1 ? `Planned from ${far.name}, the cruise terminal farthest from town, until you know which one your ship uses.` : `Your ship docks at ${far.name}.` });
        }
      }
    }
    return b;
  };
})(KEngine);
