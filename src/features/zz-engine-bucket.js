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
  if (s.cost === 0 || s.free === true || /^free/i.test(String(s.cost || ""))) out.push("free"); else if (s.cost == null) out.push("price-unknown");   // no fee fact is "unknown", never "free"
  if (s.srcOnly && !s.guide) out.push("no-story-yet");
  return out;
}
function engineBucket(withOld) {
  const n = v => (isFinite(+v) ? +v : null);
  const pt = p => p ? { id: p.id || null, name: p.name || "", lat: n(p.lat), lng: n(p.lng), unknown: !!p.unknown || (typeof unsurePoint === "function" && unsurePoint(p)) } : null;
  const ints = (() => { try { return interestWords(); } catch (e) { console.warn("engineBucket: interests", e); return []; } })();
  const cityOut = {}, dayOut = [];
  const siteFacts = (city, s) => ({
    id: s.id, name: s.name, lat: n(s.lat), lng: n(s.lng), minutes: n(s.minutes) || 30, floor: stopFloor(s) || 0,
    mustSee: !!s.mustSee, quick: !!s.quick, far: !!s.far || (city.farther || []).includes(s), indoor: !!s.indoor,
    kind: s.kind || "", category: s.category || "", fame: fameW(s), unesco: !!s.unesco,
    religiousOk: religiousOk(s), srcOnly: !!s.srcOnly, hasGuide: !!s.guide, recommended: !!(s.unesco || (s.src || []).some(t => /Wikivoyage/.test(t))),
    likes: ints.reduce((a, w) => a + (((s.category || "") + " " + (s.summary || "")).toLowerCase().includes(w) ? 1 : 0), 0),
    travelNote: typeof s.travel === "string" ? s.travel : "", show: s.show || null,
    tags: sightTags(city, s), // step 4: every label the app sorts and shows by (same rules as the screens)
    in: typeof inArea === "function" ? allSites(city).filter(a => a !== s && inArea(s, a)).map(a => a.id) : [] // the map areas it stands in (groups, step 3)
  });
  trip.days.forEach((d, i) => {
    const city = cityFor(d), ck = city ? keyOf(city.city) : null;
    if (city && !cityOut[ck]) {
      cityOut[ck] = { key: ck, name: city.city, srcGuide: !!city.srcGuide,
        sites: (city.sites || []).map(s => siteFacts(city, s)), farther: (city.farther || []).map(s => Object.assign(siteFacts(city, s), { far: true })),
        restaurants: (city.restaurants || []).filter(r => isFinite(+r.lat)).map(r => ({ id: keyOf(r.name), name: r.name, lat: +r.lat, lng: +r.lng, kind: r.kind || "", cuisine: r.cuisine || "",
          recommended: !!r.recommended, bothGuides: !!r.bothGuides, top: !!r.top, crowdTop: !!r.crowdTop, good: gGood(r.g || gOf(r)), drop: !!r.crowdDrop || gBad(r.g || gOf(r)) })) };
    }
    const L = city ? lodgingFor(d, city) : null; let P = null; try { P = city ? dayPoint(d, city) : null; } catch (e) { P = null; }
    const thru = throughFrom(d), A = thru && city ? dayPoint(thru, city) : null;
    const sh = hh => { try { return hh ? shipToPort(d, hh) : null; } catch (e) { console.warn("engineBucket: ship time", e); return null; } };
    const facts = { i, id: d.id, date: d.date || "", type: d.type, mode: d.mode, city: ck, noShore: noShore(d), through: !!throughTo(d),
      startTime: d.startTime || "", hours: n(d.hours), time: d.time || "", tender: !!d.tender, noBags: !!d.noBags, returnToStart: d.returnToStart !== false,
      portArrive: sh(d.portArrive), allAboard: sh(d.allAboard), boardAt: typeof boardAt === "function" ? boardAt(d) : null,
      thru: thru ? { mode: thru.mode, time: thru.time || "", point: pt(A) } : null,
      lodging: pt(L), point: pt(P),
      selected: Array.isArray(d.selected) ? d.selected.slice() : null, mine: (d.mine || []).slice(), order: Array.isArray(d.order) ? d.order.slice() : null,
      cleared: clearedByYou(d), rain: !!d.rain, alongWay: d.alongWay !== false, fillTime: d.fillTime !== false, skipBonus: (d.skipBonus || []).slice(),
      booked: bookedMeals(d, city || {}).map(m => ({ label: m.label, from: m.from, len: m.len, place: pt(m.node) })),
      locked: d.ready && d.ready.lock && Array.isArray(d.ready.lock.seq) ? { t: d.ready.lock.t, seq: d.ready.lock.seq.filter(x => !x.meal).map(x => x.id).filter(Boolean) } : null,
      wx: city ? wxFor(d, city) : null, sites: {}, eats: {} };
    if (city && d.date) {
      allSites(city).forEach(s => { const oh = siteWindow(s, d.date), cw = crowdWindows(Object.assign({ _city: ck }, s), d.date);
        facts.sites[s.id] = { closed: siteClosed(s, d.date), oh: oh ? { spans: oh.spans, last: oh.last != null ? oh.last : null } : null, busy: cw ? cw.busy : null }; });
      (city.restaurants || []).forEach(r => { facts.eats[keyOf(r.name)] = { lunchShut: mealShut(r, "Lunch", d.date), dinnerShut: mealShut(r, "Dinner", d.date) }; });
    }
    // What's still missing from the bucket for this day. Planning a day waits until its bucket is complete (or says
    // plainly what it planned without), so a plan is never made from half the pieces and then changed as the rest arrive.
    facts.missing = [!city && !noShore(d) ? "guide" : "", city && !noShore(d) && !L && d.type !== "port" ? "hotel" : "", city && !noShore(d) && !P && d.type !== "land" ? "arrival or departure point" : "",
      d.type === "port" && !(isFinite(facts.portArrive) && isFinite(facts.allAboard)) ? "ship times" : "", d.type === "embark" && !isFinite(facts.allAboard) ? "all-aboard time" : ""].filter(Boolean);
    dayOut.push(facts);
  });
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
