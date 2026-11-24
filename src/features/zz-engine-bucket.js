// ---------- Beta 2: the trip bucket for the new engine ----------
// The trip bucket (Richard, Nov 18: "have a bucket, get all the pieces"): one complete collection of everything a plan may use, gathered before any planning runs, read from the app's state: the trip, each day's resolved places
// and times (hotel, port, airport, ship times in port time), each city's sights and places to eat with the facts for
// that day (opening hours, closed, crowds, ratings), and the forecast. The new engine (src/engine/) plans from this
// alone: it never reads the app's state, storage or the internet. Places are identified by id; names are display only.
// engineBucket(withOld) also returns the old planner's plans in a short form, so the two can be compared side by side.
// Step 4 (Richard, Nov 18: "add interest, must see, local favorite, and all the other categories so they can be
// sorted if they need to be displayed or not"): every label a sight carries, from the same rules the screens use, so
// the Sights list, filters and the planner all read one set of tags. Interests use the setup's own list (INTERESTS).
function sightTags(city, s) {
  const t = ((s.category || "") + " " + (s.summary || "") + " " + (s.name || "")).toLowerCase(), out = [];
  INTERESTS.forEach(([k]) => { if ((INTEREST_WORDS[k] || []).some(w => t.includes(w))) out.push("interest:" + k); });
  if (s.mustSee) out.push("must-see");
  if (s.unesco) out.push("unesco");
  out.push(sightKind(s, city) === "local" ? "local-favorite" : "famous");
  if (isReligious(s)) out.push("religious"); if (bibleSite(s)) out.push("bible");
  out.push(isOpenAir(s) ? "open-air" : s.indoor ? "indoor" : "inside-or-out");
  if (s.quick) out.push("quick-stop"); if ((city.farther || []).includes(s) || s.far) out.push("day-trip");
  if (bookAhead(s)) out.push("book-ahead"); if (s.show) out.push("timed-show"); if (isQuietPlace(s)) out.push("quiet-place");
  // The app stores an unknown fee as 0, so only an explicit "free" counts; no fee fact is "price unknown", never "free".
  if (s.free === true || /^free/i.test(String(s.fee || ""))) out.push("free"); else if (!(+s.cost > 0)) out.push("price-unknown");
  if (s.srcOnly && !s.guide) out.push("no-story-yet");
  return out;
}
const wishIds = (d, city) => { try { return city && typeof wantIds === "function" ? wantIds(d, city) : []; } catch (e) { return []; } };
const bucketCityMemo = new Map();
// A guide's own fingerprint is worked out once until something could have changed it: an answer arrived (dataGen) or the
// traveler changed something (planGen). The Sights list's quick fit checks build the bucket many times in between.
const cityHashMemo = new WeakMap();
function cityHashOf(city) {
  const m = cityHashMemo.get(city); if (m && m.g === dataGen && m.pg === planGen) return m.h;
  const h = strHash(JSON.stringify(city)); cityHashMemo.set(city, { g: dataGen, pg: planGen, h }); return h;
}
function cityMemoOf(city, ck, ints) {
  const sig = cityHashOf(city) + "|" + ints.join(",") + "|" + JSON.stringify(P());
  let m = bucketCityMemo.get(ck); if (!m || m.sig !== sig) { m = { sig, sites: null, farther: null, dates: new Map() }; bucketCityMemo.set(ck, m); }
  return m;
}
function mealPrefsFor(d) {
  const out = {}; Object.entries((d && d.mealPrefs) || {}).forEach(([k, v]) => { if (v && typeof v === "object") out[k] = Object.assign({}, v, v.pick ? { pick: { name: v.pick.name || "", lat: +v.pick.lat, lng: +v.pick.lng } } : {}); });
  return Object.keys(out).length ? out : null;
}
function engineBucket(withOld) {
  const n = v => (isFinite(+v) ? +v : null);
  const pt = p => p ? { id: p.id || null, name: p.name || "", lat: n(p.lat), lng: n(p.lng), unknown: !!p.unknown || (typeof unsurePoint === "function" && unsurePoint(p)), notGate: !!p.notGate, ask: Array.isArray(p.ask) && p.ask.length > 1 ? p.ask.map(String) : null } : null;
  const ints = (() => { try { return interestWords(); } catch (e) { console.warn("engineBucket: interests", e); return []; } })();
  const cityOut = {}, dayOut = [], waterHomes = {};
  const siteFacts = (city, s) => ({
    id: s.id, name: s.name, lat: n(s.lat), lng: n(s.lng), minutes: n(s.minutes) || 30, floor: stopFloor(s) || 0,
    // A guide built before a rule learned a kind of place is not a sight (a stadium named in another language) keeps it,
    // but never as a must-see the day plans on its own; the traveler can still pick it.
    mustSee: !!s.mustSee && !(s.srcOnly && typeof srcNotSpot === "function" && srcNotSpot(s)), quick: !!s.quick, far: !!s.far || (city.farther || []).includes(s), indoor: !!s.indoor,
    kind: s.kind || "", category: s.category || "", fame: fameW(s), unesco: !!s.unesco,
    religiousOk: religiousOk(s), srcOnly: !!s.srcOnly, hasGuide: !!s.guide, recommended: !!(s.unesco || (s.src || []).some(t => /Wikivoyage/.test(t))),
    likes: ints.reduce((a, w) => a + (((s.category || "") + " " + (s.summary || "")).toLowerCase().includes(w) ? 1 : 0), 0),
    travelNote: typeof s.travel === "string" ? s.travel : "", show: s.show || null,
    // From the map (water-check.js): on another island with no way there but a boat; how far the nearest road is.
    ...(s.acrossWater ? { acrossWater: s.acrossWater } : {}), ...(s.roadGap > 0 ? { roadGap: +s.roadGap } : {}),
    // A sight of a day-trip town (from the places files) keeps its town (Nov 23 outside test: without it the engine planned
    // Sintra's palaces as sights of their own beside the whole town's 3 h visit, and the town never became the walk to them).
    ...(s.town != null ? { town: String(s.town), townName: s.townName || "" } : {}),
    ...(s.posDoubt ? { posDoubt: true } : {}), // where it is isn't sure (its sources disagree): every ride to or from it says so
    access: [s.access, s.tickets, s.howToSee].filter(x => typeof x === "string").join(" ").slice(0, 300), // e.g. "viewed from the water"
    tags: sightTags(city, s), // step 4: every label the app sorts and shows by (same rules as the screens)
    // A sight a story's walk stops at (stop-scripts.js, one story one stop): planned the same day, it is seen on that walk.
    ...(Array.isArray(s.onWalk) && s.onWalk.length ? { onWalk: s.onWalk.map(String) } : {}),
    in: typeof inArea === "function" ? allSites(city).filter(a => a !== s && inArea(s, a)).map(a => a.id) : [] // the map areas it stands in (groups, step 3)
  });
  trip.days.forEach((d, i) => {
    const city = cityFor(d), ck = city ? keyOf(city.city) : null;
    // A guide's sight facts, and each date's opening hours, crowds and closed days, depend only on the guide itself
    // (its sights' and places' own fields), the traveler's interests and preferences: worked out once per guide as it
    // stands and kept until the guide changes, never again on every answer arriving.
    const cm = city ? cityMemoOf(city, ck, ints) : null;
    if (city && !cityOut[ck]) {
      if (!cm.sites) { cm.sites = (city.sites || []).map(s => siteFacts(city, s)); cm.farther = (city.farther || []).map(s => Object.assign(siteFacts(city, s), { far: true })); }
      cityOut[ck] = { key: ck, name: city.city, srcGuide: !!city.srcGuide,
        sites: cm.sites, farther: cm.farther,
        restaurants: (city.restaurants || []).filter(r => isFinite(+r.lat)).map(r => ({ id: keyOf(r.name), name: r.name, lat: +r.lat, lng: +r.lng, kind: r.kind || "", cuisine: r.cuisine || "",
          recommended: !!r.recommended, bothGuides: !!r.bothGuides, top: !!r.top, crowdTop: !!r.crowdTop, good: gGood(r.g || gOf(r)), drop: !!r.crowdDrop || gBad(r.g || gOf(r)) })) };
    }
    const L = city ? lodgingFor(d, city) : null; let P = null; try { P = city ? dayPoint(d, city) : null; } catch (e) { P = null; }
    const thru = throughFrom(d), A = thru && city ? dayPoint(thru, city) : null;
    const sh = hh => { try { return hh ? shipToPort(d, hh) : null; } catch (e) { console.warn("engineBucket: ship time", e); return null; } };
    const facts = { i, id: d.id, date: d.date || "", type: d.type, mode: d.mode, city: ck, typed: String(d.destination || ""), // as the traveler typed it ("Port (City), Country")
      noShore: noShore(d), through: !!throughTo(d),
      startTime: d.startTime || "", hours: n(d.hours), time: d.time || "", tender: !!d.tender, noBags: !!d.noBags, returnToStart: d.returnToStart !== false,
      meet: !!(trip && (trip.group || trip.groupShared)), // a group trip: every plan ends by the group's meeting time
      portArrive: sh(d.portArrive), allAboard: sh(d.allAboard), boardAt: typeof boardAt === "function" ? boardAt(d) : null,
      nightDep: d.nightDep === "night" || d.nightDep === "morning" ? d.nightDep : "", // a small-hours departure: this morning or tonight, as the traveler said
      thru: thru ? { mode: thru.mode, time: thru.time || "", point: pt(A), guess: !!thru.estimated || !thru.time } : null,
      // An arrival time the traveler never gave (the trip builder fills one in): asked, never planned on (Round 1: "Flight in at 10:30 am" invented).
      timeGuess: d.type === "arrival" && (!!d.estimated || !d.time),
      // The start place's note, when it names a way to ride (a port's sea bus or shuttle): offered as a choice for that ride.
      // The trip's last day, and whether the hotel is only the guide's guess (the traveler named none here).
      lastDay: i === trip.days.length - 1, stayGuess: !((trip.lodging[cityKeyFor(d) || keyOf(d.destination)] || {}).idx === "custom"),
      lodging: pt(L), point: P ? Object.assign(pt(P), typeof P.note === "string" && /\b(bus|buses|shuttle|boat|ferry|sea ?bus|water ?taxi|tram|metro|train)\b/i.test(P.note) ? { startNote: P.note.slice(0, 400) } : {}) : null,
      // The countries a leaving train runs between (a border means passport or ID checks: be there earlier).
      country: (city && city.country) || "", toCountry: d.type === "departure" && trip.days[i + 1] ? ((cityFor(trip.days[i + 1]) || {}).country || "") : "",
      toOther: d.type === "departure" && !!trip.days[i + 1] && (cityKeyFor(trip.days[i + 1]) || keyOf(trip.days[i + 1].destination || "")) !== (cityKeyFor(d) || keyOf(d.destination || "")),
      // The traveler's picks only: a list the app seeded on its own (untouched since: seedSig still matches) is the app's
      // suggestion, not the traveler's wish, so the engine picks for itself and keeps only what they chose (mine).
      // A day not seeded yet sends the sights the traveler named when making the trip (their wishes), as seeding would.
      // No picks of the traveler's own: the day's list is the guide's wants, and one that doesn't fit is never called "your pick".
      wantsOnly: !Array.isArray(d.selected) || (!d.ownList && appSeeded(d) && !(d.mine || []).length),
      selected: Array.isArray(d.selected) ? (!d.ownList && appSeeded(d) ? (d.mine || []).slice() : d.selected.slice()) : wishIds(d, city),
      mine: Array.isArray(d.selected) ? (d.mine || []).slice() : [...new Set((d.mine || []).concat(wishIds(d, city)))], order: Array.isArray(d.order) ? d.order.slice() : (typeof grpOrderFor === "function" ? grpOrderFor(d) : null), // a group day: the owner's order (guide-group.js)
      only: typeof grpStopsFor === "function" ? grpStopsFor(d) : null, // a group day: the owner's stops, and no others
      mealAt: d.mealAt && Object.keys(d.mealAt).length ? Object.assign({}, d.mealAt) : null,
      // The traveler's own list: they ticked or unticked something here (the app's seeding no longer stands).
      own: listIsOwn(d),
      cleared: clearedByYou(d), rain: !!d.rain, alongWay: d.alongWay !== false, fillTime: d.fillTime !== false, skipBonus: (d.skipBonus || []).slice(),
      booked: bookedMeals(d, city || {}).map(m => ({ label: m.label, from: m.from, len: m.len, place: pt(m.node) })),
      // The traveler's say on each meal (Change lunch: the place, a time, skip). The engine reads it with the booked tables
      // as ONE meal input (E.mealInput; Nov 20 review: none of these reached the planner).
      mealPrefs: mealPrefsFor(d),
      locked: d.ready && d.ready.lock && Array.isArray(d.ready.lock.seq) ? { t: d.ready.lock.t, seq: d.ready.lock.seq.filter(x => !x.meal).map(x => x.id).filter(Boolean) } : null,
      wx: city ? wxFor(d, city) : null, sites: {}, eats: {} };
    if (city && d.date) {
      let on = cm.dates.get(d.date);
      if (!on) { on = { sites: {}, eats: {} };
        // The ONE reading of hours (dayHours, live.js: the engine's reader with the place's holidays and calendar rules),
        // and what the plan must say about it: where the hours come from, why they're unknown, what the calendar does.
        allSites(city).forEach(s => { const r = dayHours(s, d.date, city), oh = siteWindow(s, d.date, city), cw = crowdWindows(Object.assign({ _city: ck }, s), d.date);
          const h = { src: r.src || "", why: r.why || "" }; ["notes", "holidayUnsure", "restUnsure", "sundayAfternoon", "seasonChange"].forEach(k => { if (r[k]) h[k] = r[k]; });
          on.sites[s.id] = { closed: siteClosed(s, d.date, city), oh: oh && oh.spans.length ? { spans: oh.spans, last: oh.last != null ? oh.last : null } : null, busy: cw ? cw.busy : null, hours: h };
          if (r.known && r.allDay && !isOpenAir(s)) on.sites[s.id].allDay = true; });
        // Each place to eat, the same facts as a sight for that date (Nov 19 fold: one hours rule): closed that day, and its
        // open spans when its hours are known. A table the traveler booked has no hours limit.
        (city.restaurants || []).forEach(r0 => { const r = Object.assign({}, r0, { hours: hoursOf(r0) }), w = r.booked ? null : siteWindow(r, d.date, city);
          on.eats[keyOf(r.name)] = { closed: !r.booked && siteClosed(r, d.date, city), oh: w && w.spans.length ? { spans: w.spans, last: null } : null }; });
        cm.dates.set(d.date, on); }
      facts.sites = on.sites; facts.eats = on.eats;
      // The date's calendar in this place: its country, and the public holiday (or the eve of one), from the app's own
      // holiday data (engine part 1b). Unknown (outside the data's years, or a country not known) is left out, never "none".
      const hc = hoursCtx(city, d.date); if (hc.place) facts.cc = hc.place.cc;
      if (hc.hol) facts.holiday = Object.assign({ country: hc.place.name }, hc.hol); else if (hc.hol === null) facts.holiday = null;
    }
    // What's still missing from the bucket for this day. Planning a day waits until its bucket is complete (or says
    // plainly what it planned without), so a plan is never made from half the pieces and then changed as the rest arrive.
    facts.missing = [!city && !noShore(d) ? "guide" : "", city && !noShore(d) && !L && d.type !== "port" ? "hotel" : "", city && !noShore(d) && !P && d.type !== "land" ? "arrival or departure point" : "",
      d.type === "port" && !(isFinite(facts.portArrive) && isFinite(facts.allAboard)) ? "ship times" : "", d.type === "embark" && !isFinite(facts.allAboard) ? "all-aboard time" : ""].filter(Boolean);
    dayOut.push(facts);
    if (city && !noShore(d)) { const h = waterHomes[ck] || (waterHomes[ck] = { city, pts: [] }); [P, L, A].forEach(x => { if (x && isFinite(+x.lat) && !h.pts.some(y => hav(x, y) < 0.2)) h.pts.push(x); }); }
  });
  // Which stops are across the water and how far each is from a road: asked of the map once per place, in the background.
  if (typeof waterCheck === "function") Object.values(waterHomes).forEach(h => { try { waterCheck(h.city, h.pts); } catch (e) { console.warn("water check", e); } });
  if (typeof waterWaits === "function") Object.values(waterHomes).forEach(h => { const ck = keyOf(h.city.city), c = cityOut[ck];
    const waits = s => !s.acrossWater && waterWaits(h.city, s.id);
    if (c && (c.sites || []).concat(c.farther || []).some(waits)) { const wait = s => s.acrossWater || !waterWaits(h.city, s.id) ? s : Object.assign({}, s, { waterPending: true }); cityOut[ck] = Object.assign({}, c, { sites: (c.sites || []).map(wait), farther: (c.farther || []).map(wait) }); } });
  const out = { v: 1, complete: dayOut.every(x => !x.missing.length), today: todayISO(), prefs: Object.assign({}, P()), style: trip.style || "mix", legModes: Object.assign({}, trip.legModes || {}), cities: cityOut, days: dayOut };
  if (withOld) out.old = engineOldPlans();
  return out;
}
// The old planner's plans in short form: every day planned afresh, in order, as the quality check does.
function engineOldPlans() {
  bonusMemo = new Map(); mealMemo = new Map(); keptMemo = new Map(); eveMemo = new Map(); avoidMeals = new Set();
  return trip.days.map((d, i) => {
    let p = null; try { p = buildPlan(d); } catch (e) { return { i, error: "crashed: " + e.message }; }
    if (!p) return { i, error: "no guide" }; if (p.error) return { i, error: p.error };
    const w = p.w || {};
    return { i, start: p.start, endBy: p.endBy, end: p.end, over: !!p.over, straight: !!w.straight,
      head: (w.head || []).map(x => ({ name: x.name, fixed: !!x.fixed, minutes: x.fixed ? x.minutes : 0 })), tail: (w.tail || []).map(x => ({ name: x.name, fixed: !!x.fixed, minutes: x.fixed ? x.minutes : 0 })),
      items: p.items.map(x => x.type === "travel" ? { t: "ride", mode: x.leg.mode, min: x.leg.min, km: Math.round((x.leg.km || 0) * 100) / 100 }
        : { t: x.type, id: x.place && (x.place.id || null), name: x.place && x.place.name, at: x.time, min: x.meal ? x.meal.len : x.place && x.place.minutes, lat: x.place && x.place.lat, lng: x.place && x.place.lng, bonus: !!(x.place && x.place.bonus), along: !!(x.place && x.place.along), meal: x.meal ? x.meal.label : null, late: x.ohLate || 0 }),
      dropped: (p.dropped || []).map(x => x.id), elsewhere: (p.elsewhere || []).map(x => ({ id: x.s.id, on: trip.days.indexOf(x.on) })), closedToday: (p.closedToday || []).map(x => x.id) };
  });
}
if (typeof window !== "undefined") window.__kairouteBucket = withOld => JSON.parse(JSON.stringify(engineBucket(withOld)));
