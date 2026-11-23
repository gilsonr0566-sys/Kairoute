// Beta 2 engine, part 2c: what the calendar does to opening hours (Nov 22 2026). Public holidays (part 1b's data),
// days of rest and prayer. Each rule is general (any city, any country) and says what it is: a fact from the place's
// own hours wins; where a rule only makes the hours uncertain, the plan says "not confirmed", never a guess as fact.
(function (E) {
  // ---------- which country (and region) a place is in, from its names ----------
  const ALIAS = { "usa": "US", "u.s.a.": "US", "u.s.": "US", "united states": "US", "america": "US", "uk": "GB", "britain": "GB", "great britain": "GB",
    "uae": "AE", "emirates": "AE", "turkey": "TR", "turkiye": "TR", "czech republic": "CZ", "holland": "NL", "turks and caicos": "TC", "turks & caicos": "TC",
    "russia": "RU", "south korea": "KR", "korea": "KR", "vatican": "VA", "vatican city": "VA", "azores": "PT", "madeira": "PT", "crete": "GR", "sicily": "IT", "sardinia": "IT", "canary islands": "ES" };
  const fold = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
  let NAMES = null;
  const names = () => {
    if (NAMES) return NAMES; NAMES = [];
    for (const [cc, c] of Object.entries(E.HOLIDAYS || {})) {
      NAMES.push({ n: fold(c.name), cc });
      for (const [rc, r] of Object.entries(c.r || {})) { const rn = fold(r.name).replace(/^(departement( et region d'outre-mer)?|hansestadt|comunidad de|ciudad de|region) /, ""); if (rn.length >= 4) NAMES.push({ n: rn, cc, rc }); }
    }
    for (const [a, cc] of Object.entries(ALIAS)) NAMES.push({ n: a, cc, alias: true });
    NAMES.sort((a, b) => b.n.length - a.n.length); return NAMES;
  };
  // texts: the country field, the typed destination, the guide's city name. The first text naming a country decides it;
  // a region name anywhere in the same texts sets the region ("Edinburgh, Scotland", "Juneau, Alaska", "Hamburg").
  E.countryOf = texts => {
    const all = (Array.isArray(texts) ? texts : [texts]).filter(Boolean).map(fold), hit = (t, n) => new RegExp("(^|[^a-z])" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^a-z])").test(t);
    let cc = null, rc = null;
    for (const t of all) { const x = names().find(x => hit(t, x.n)); if (x) { cc = x.cc; rc = x.rc || null; break; } }
    if (cc && !rc) for (const t of all) { const x = names().find(x => x.cc === cc && x.rc && hit(t, x.n)); if (x) { rc = x.rc; break; } }
    return cc ? { cc, region: rc, name: (E.HOLIDAYS[cc] || {}).name || cc } : null;
  };
  // ---------- public holidays ----------
  const key = iso => String(iso).slice(2, 4) + String(iso).slice(5, 7) + String(iso).slice(8, 10);
  const lines = (cc, rc) => { const c = (E.HOLIDAYS || {})[cc]; if (!c) return null; const r = rc && c.r && c.r[rc];
    return { list: (r ? r.d : []).concat(c.d.filter(l => !(r && r.x && r.x.includes(l.slice(0, 6))))) }; };
  // The holiday on a date in a place: { name, moon (date may move a day), eve: hour it starts the evening before } or
  // null; undefined when the date is outside the years the data holds (unknown, never "no holiday").
  E.holidayOn = (place, iso) => {
    if (!place || !place.cc || !iso) return undefined;
    const y = +String(iso).slice(0, 4); if (!(E.HOLIDAYS_YEARS && y >= E.HOLIDAYS_YEARS[0] && y <= E.HOLIDAYS_YEARS[1])) return undefined;
    const L = lines(place.cc, place.region); if (!L) return undefined;
    const k = key(iso), own = L.list.filter(l => l.slice(0, 6) === k);
    const day = own.find(l => l[7] !== "^"), eve = own.find(l => l[7] === "^");
    const read = l => { const m = /^\d{6} (?:([~^])(\d\d)? )?(.*)$/.exec(l); return { name: m[3], moon: m[1] === "~" || undefined, eve: m[1] === "^" ? +m[2] : undefined }; };
    if (day) return Object.assign(read(day), eve ? { eveOf: read(eve).name } : {});
    if (eve) { const e = read(eve); return { name: null, eveOf: e.name, from: e.eve * 60 }; }
    return null;
  };
  // Days on which most sights close (a holiday's name is the country's own; these are the ones travel guides warn of).
  E.BIG_CLOSURE = /^(christmas day|new year['’]s day|easter sunday|good friday|day of atonement|yom kippur)\b/i;

  // ---------- days of rest and prayer ----------
  const word = s => " " + String((s && (s.category + " " + s.name + " " + (s.kind || ""))) || "").toLowerCase() + " ";
  E.isMosque = s => /\b(mosque|camii?|cami|masjid|mezquita|moschee|jami|jamia)\b/.test(word(s)) && !/\b(former|museum|ruins?)\b/.test(word(s));
  E.isJewishSite = s => /\b(synagogue|jewish museum|old jewish|jewish quarter museum|shul)\b/.test(word(s));
  E.isChurch = s => /\b(church|cathedral|basilica|chapel|duomo|kirche|dom|iglesia|igreja|eglise|église|chiesa|abbey|monastery|monastir)\b/.test(word(s)) && !/\b(former|ruins?|museum)\b/.test(word(s));
  // The five daily prayers' times for a date and place (minutes on the local clock): from the sun (Muslim World League
  // angles 18 and 17, Asr at shadow length 1). Mosques open to visitors close for about half an hour to an hour at each.
  E.prayerTimes = (lat, lng, iso, offset) => {
    const s = E.sunAt(lat, lng, iso, offset), f = E.sunAt(lat, lng, iso, offset, 18), i = E.sunAt(lat, lng, iso, offset, 17);
    if (!s || s.rise == null) return null;
    const rad = Math.PI / 180, alt = Math.atan(1 / (1 + Math.tan(Math.abs(lat * rad - s.dec)))) / rad, a = E.sunAt(lat, lng, iso, offset, -alt);
    return { fajr: f && f.rise, dhuhr: s.noon + 5, asr: a && a.set, maghrib: s.set, isha: i && i.set };
  };
  // What the day of the week, the holidays and worship do to one place's hours on one date. In: the place, the reading
  // of its hours (part 2b), ctx { holiday, eve, country, lat, lng, offset }. Out: the reading, adjusted, with notes.
  E.applyDayRules = (s, r, iso, ctx) => {
    r = Object.assign({}, r); ctx = ctx || {}; const dow = new Date(iso + "T12:00:00Z").getUTCDay(), notes = [], cut = [];
    const hol = ctx.holiday, phSaid = !!r.phSaid || /\bPH\b|holiday/i.test(String((s && s.hours) || "") + " " + String((s && s.closed) || ""));
    // Public holiday: the place's own hours decide when they say what happens on holidays; otherwise the hours for
    // the day are not confirmed (planned as listed, and said).
    if (hol && hol.name && !phSaid && !r.closed) { r.holidayUnsure = hol.name; notes.push(`${hol.name} is a public holiday${hol.moon ? " (expected; the date can move a day with the moon)" : ""}: ${E.BIG_CLOSURE.test(hol.name) ? "most sights close or keep short hours" : "hours may differ"}, not confirmed`); }
    // The eve of a holiday that starts in the afternoon: hours after that are not confirmed (said, not guessed).
    else if (hol && !hol.name && hol.eveOf && hol.from != null && r.known && !r.closed && (r.spans || []).some(([, b]) => b > hol.from))
      notes.push(`the eve of ${hol.eveOf}: may close early from about ${E.clock(hol.from)}, not confirmed`);
    // Jewish sites close on the Sabbath (Friday evening to Saturday night) and on Jewish holidays, wherever they are,
    // unless their own hours say otherwise.
    if (E.isJewishSite(s) && !r.known) {
      const il = E.holidayOn({ cc: "IL" }, iso);
      if (dow === 6 || (il && il.name)) { r = { known: true, closed: true, spans: [], src: "rule", why: dow === 6 ? "Jewish sites close on the Sabbath (Saturday)" : "Jewish sites close on " + il.name }; }
      else if (dow === 5 || (il && il.eveOf)) cut.push([14 * 60, 1440, "closes early before the Sabbath or a holiday"]);
    }
    // In Israel, on the Sabbath and Jewish holidays most sights, shops and buses stop: a place without its own hours
    // for the day is not confirmed.
    if (ctx.country === "IL" && (dow === 6 || (hol && hol.name)) && !r.closed && !(r.known && r.src === "OpenStreetMap" && /\bSa\b/.test(String(s.hours || ""))))
      { r.restUnsure = true; notes.push(dow === 6 ? "Saturday is the Sabbath in Israel: many sights and buses don't run, opening not confirmed" : "a Jewish holiday: many sights close, opening not confirmed"); }
    // Mosques: closed to visitors at prayer times, and on Friday through the midday prayer.
    if (E.isMosque(s)) {
      const p = E.prayerTimes(ctx.lat != null ? ctx.lat : s.lat, ctx.lng != null ? ctx.lng : s.lng, iso, ctx.offset);
      if (p) { if (dow === 5) cut.push([p.dhuhr - 95, p.dhuhr + 100, "Friday prayers"]); else if (p.dhuhr) cut.push([p.dhuhr - 15, p.dhuhr + 50, "midday prayer"]);
        if (p.asr) cut.push([p.asr - 15, p.asr + 40, "afternoon prayer"]); if (p.maghrib) cut.push([p.maghrib - 10, p.maghrib + 40, "sunset prayer"]);
        notes.push("closed to visitors at prayer times (worked out from the sun for this date, about " + cut.filter(c => c[2] !== "closes early before the Sabbath or a holiday").map(c => E.clock(c[0]) + "–" + E.clock(c[1])).join(", ") + "; check at the door)"); }
      else notes.push("closed to visitors at prayer times, not worked out for this date");
    }
    // Churches on Sunday: services in the morning; with no hours of the church's own for Sunday, planned for the
    // afternoon and said.
    if (E.isChurch(s) && dow === 0 && !r.known && !r.closed) { r.sundayAfternoon = true; notes.push("Sunday services in the morning: visits usually from about 1 pm, not confirmed"); }
    if (cut.length) {
      const base = r.known && !r.allDay ? r.spans : null;
      r.cut = cut.map(c => [c[0], c[1]]);
      if (base) r.spans = base.flatMap(([a, b]) => cut.reduce((l, [c, d]) => l.flatMap(([p, q]) => d <= p || c >= q ? [[p, q]] : [[p, c], [d, q]].filter(([u, v]) => v - u >= 20)), [[a, b]]));
    }
    if (notes.length) r.notes = (r.notes || []).concat(notes);
    return r;
  };
})(KEngine);
