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
  E.applyPlaces = (bucket, places) => {
    const b = copy(bucket), notes = b.placeNotes = [];
    const guides = b.cities || {};
    for (const [key, city] of Object.entries(guides)) {
      const P = places && places[key]; if (!P) continue;
      // Public transport lines mapped around the place: every leg they serve offers them (part 1b).
      if ((P.transit || []).length) b.transit = (b.transit || []).concat(P.transit);
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
      // A thin guide (under 8 sights): the travel guide's own sights for the place join it, unless already there (same
      // name, or within 150 m) or closed for good.
      if ((city.sites || []).length < 8 && (P.guideSights || []).length) {
        const key = n => String(n || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
        const more = P.guideSights.filter(x => !x.closedForGood && isFinite(x.lat) && !(city.sites || []).some(s => key(s.name) === key(x.name) || (isFinite(s.lat) && E.hav(s, x) <= 0.15)))
          .map((x, n) => Object.assign({ id: "wv~" + (x.wikidata || key(x.name).replace(/ /g, "-")), name: x.name, lat: x.lat, lng: x.lng, minutes: /museum|museo|musée|museu|muzeum|galler/i.test(x.name) ? 60 : 30,
            editions: x.editions || 0, unesco: !!x.unesco, tags: ["from-guide"], category: "Sight", fromGuide: true, blurb: x.note || "" }, x.web ? { web: x.web } : {})).filter((x, i, a) => a.findIndex(y => y.id === x.id) === i);
        if (more.length) city.sites = (city.sites || []).concat(more);
      }
      const added = [];
      for (const s of city.farther || []) {
        const t = P.towns && P.towns[s.id]; if (!t) continue;
        if (t.editions) s.editions = t.editions;
        if (t.unesco) s.unesco = true;
        if (t.dayTripListed) s.dayTripListed = true;
        // The town's own sights (travel guide "see" listings on the map, within a walk of the town) become stops of
        // their own, so a day there is planned sight by sight and weighed by what the town really offers.
        const own = (t.sights || []).filter(x => (x.kind || "see") === "see" && isFinite(x.lat) && isFinite(x.lng) && E.hav(s, x) <= TOWN_KM);
        s.townSights = own.map(x => ({ name: x.name, lat: x.lat, lng: x.lng }));
        // A museum gets an hour, anything else half an hour; getting there takes what the town's own ride note says.
        own.forEach((x, n) => added.push({ id: s.id + "~" + (x.wikidata || n), name: x.name, lat: x.lat, lng: x.lng, minutes: /museum|museo|musée|museu|muzeum|galler/i.test(x.name) ? 60 : 30,
          far: true, town: s.id, townName: s.name, travelNote: s.travelNote || "", editions: x.editions || 0, unesco: !!x.unesco, tags: ["in-town"], category: "Sight" }));
        // With its sights listed one by one, the town itself is the walk through its centre.
        if (own.length >= 2) s.minutes = Math.min(s.minutes || 60, 60);
        s.foodDrink = (t.foodDrink || []).map(x => ({ name: x.name, lat: isFinite(x.lat) ? x.lat : null, lng: isFinite(x.lng) ? x.lng : null, kind: x.kind, note: x.content || "", special: E.foodSpecial(x) }));
        // No place to eat in its travel guide: the restaurants and cafés on the map beside it (named as from the map).
        if (!s.foodDrink.some(x => x.kind === "eat") && (t.mapEats || []).length) s.foodDrink = s.foodDrink.concat(t.mapEats.map(x => ({ name: x.name, lat: x.lat, lng: x.lng, kind: "eat", note: x.cuisine || "", special: false, fromMap: true })));
      }
      if (added.length) city.farther = (city.farther || []).concat(added);
      // Hours per day: a mapped opening time read for that day's date, where the day has no hours for the sight yet.
      for (const d of b.days || []) {
        if (d.city !== key || !d.date) continue;
        d.sites = d.sites || {};
        for (const s of city.sites || []) {
          if (!s.hours) continue;
          const have = d.sites[s.id]; if (have && (have.closed || (have.oh && have.oh.spans && have.oh.spans.length))) continue;
          const oh = E.ohSpans(s.hours, d.date);
          if (!oh) { if (/^(24\/7|(Mo-Su\s*)?00:00-(00|24):00)$/.test(String(s.hours).trim())) d.sites[s.id] = Object.assign({}, have || {}, { allDay: true, hoursFrom: "OpenStreetMap" }); continue; }
          d.sites[s.id] = Object.assign({}, have || {}, { closed: !oh.spans.length, oh: oh.spans.length ? oh : null, hoursFrom: "OpenStreetMap" });
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
