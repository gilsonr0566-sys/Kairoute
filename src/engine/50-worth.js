// Beta 2 engine, part 5: what a sight is worth to this traveler, and which sights a day may draw from (step 5).
// One worth for every choice (which sights, which day, what to drop first), so the same sight never ranks differently
// in two places. Worth comes from stable facts only: must-see, UNESCO, outside fame, travelers' recommendations, the
// traveler's interests and style. Never from what happened to load first.
(function (E) {
  const has = (s, t) => E.has(s, t);
  // fameN: 0..1 from whatever fame number the guide carries (built-in guides carry none that differs).
  // Language editions on Wikidata (from the places files) are the steadiest measure: 10 editions 0.45, 60 0.8, 150+ 1.
  const fameN = s => { if (+s.editions > 0) return Math.min(1, Math.log10(+s.editions) / 2.2); const f = +s.fame || 0; return f > 3 ? Math.min(1, f / 80) : f > 1.2 ? Math.min(1, (f - 1) / 2) : 0; };
  E.worth = (s, prefs, style) => {
    if (!s) return 0;
    const interests = (prefs && prefs.interests) || [];
    let w = 10;
    if (s.mustSee || has(s, "must-see")) w += 100;
    if (s.unesco || has(s, "unesco")) w += 20;
    w += 30 * fameN(s);
    if (s.recommended) w += 10;
    if (s.far && s.dayTripListed) w += 25;   // travelers' guides send people there for the day
    if (style && style !== "mix" && s.kind === style) w += 12;
    if (interests.some(k => has(s, "interest:" + k))) w += 25;
    if (s.quick) w -= 25;
    if (typeof s.rank === "number") w += Math.max(0, 20 - s.rank);   // the guide's own order, best first
    return Math.max(1, Math.round(w * 10) / 10);
  };
  // Can this traveler visit it at all (their access needs and "skip religious sites"), and is it open today?
  E.allowed = (s, prefs, siteDay, win) => {
    if (!s || !isFinite(s.lat) || !isFinite(s.lng)) return false;
    if (prefs && prefs.religious === "skip" && has(s, "religious") && !s.religiousOk) return false;
    if (prefs && (prefs.access === "wheelchair" || prefs.access === "limited") && s.effort === "steep") return false;
    if (s.closedForGood || s.visitable === false) return false;
    if (siteDay && E.closedForDay(siteDay, win, s.minutes)) return false;
    return true;
  };
  // The one reason a sight can't be visited on a day, as E.allowed decides it (screen rule "one real reason", Nov 22 odd-trips
  // screen check: "is closed or can't be visited this day" was said whatever the reason was).
  E.notAllowedWhy = (s, prefs, siteDay, win) => {
    if (!s || !isFinite(s.lat) || !isFinite(s.lng)) return "isn't on the map, so it can't be planned";
    if (prefs && prefs.religious === "skip" && has(s, "religious") && !s.religiousOk) return "is a place of worship, and your settings skip those";
    if (prefs && (prefs.access === "wheelchair" || prefs.access === "limited") && s.effort === "steep") return "is a steep climb, and your settings ask for easy access";
    if (s.closedForGood) return "has closed for good";
    if (s.visitable === false) return "can't be visited inside";
    if (siteDay && siteDay.closed) return "is closed on this date";
    if (siteDay && siteDay.oh && siteDay.oh.spans && siteDay.oh.spans.length && win) return "is open " + siteDay.oh.spans.map(([a, b]) => E.clock(a) + " to " + E.clock(b)).join(" and ") + " that day, not long enough inside today's time (" + E.clock(win.start) + " to " + E.clock(win.endBy) + ") for a visit";
    return null;
  };
  // A worth-ordered list with a fixed tie-break (by id), so the answer never depends on input order.
  E.rank = (sites, prefs, style) => sites.map(s => ({ s, w: E.worth(s, prefs, style) }))
    .sort((a, b) => b.w - a.w || E.byId(a.s, b.s)).map(x => Object.assign({}, x.s, { worth: x.w }));
})(KEngine);
