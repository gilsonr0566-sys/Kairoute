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
  const copy = x => JSON.parse(JSON.stringify(x));
  E.applyPlaces = (bucket, places) => {
    const b = copy(bucket), notes = b.placeNotes = [];
    const guides = b.cities || {};
    for (const [key, city] of Object.entries(guides)) {
      const P = places && places[key]; if (!P) continue;
      for (const s of city.sites || []) {
        const f = P.sites && P.sites[s.id]; if (!f) continue;
        if (f.editions) s.editions = f.editions;
        if (f.unesco) s.unesco = true;
        if (f.closedForGood) s.closedForGood = true;
        if (f.hours && !s.hours) s.hours = f.hours;
      }
      for (const s of city.farther || []) {
        const t = P.towns && P.towns[s.id]; if (!t) continue;
        if (t.editions) s.editions = t.editions;
        if (t.unesco) s.unesco = true;
        if (t.dayTripListed) s.dayTripListed = true;
        s.townSights = (t.sights || []).map(x => ({ name: x.name, lat: x.lat, lng: x.lng, hours: x.hours || "" }));
        s.foodDrink = (t.foodDrink || []).map(x => ({ name: x.name, lat: x.lat, lng: x.lng, kind: x.kind, note: x.content || "" }));
      }
      // Hours per day: a mapped opening time read for that day's date, where the day has no hours for the sight yet.
      for (const d of b.days || []) {
        if (d.city !== key || !d.date) continue;
        d.sites = d.sites || {};
        for (const s of city.sites || []) {
          if (!s.hours) continue;
          const have = d.sites[s.id]; if (have && (have.closed || (have.oh && have.oh.spans && have.oh.spans.length))) continue;
          const oh = E.ohSpans(s.hours, d.date); if (!oh) continue;
          d.sites[s.id] = Object.assign({}, have || {}, { closed: !oh.spans.length, oh: oh.spans.length ? oh : null, hoursFrom: "OpenStreetMap" });
        }
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
