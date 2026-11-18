// Beta 2 engine, part 3c: categories (Richard's step 4). Every group and site carries its labels in the places
// database: interests (the setup's own list: history, art, architecture, food, views, churches, bible, shopping,
// beaches, kids), must-see, UNESCO, famous or local favorite, religious, open-air or indoor, quick stop, day trip,
// book ahead, timed show, quiet place, free, and group or site (step 3). The screens decide what to show by these tags
// and the planner reads the same ones, so a list and a plan never disagree about what a place is.
(function (E) {
  E.TAGS = Object.freeze(["must-see", "unesco", "famous", "local-favorite", "religious", "bible", "open-air", "indoor", "inside-or-out",
    "quick-stop", "day-trip", "book-ahead", "timed-show", "quiet-place", "free", "price-unknown", "no-story-yet", "group", "site"]);
  E.INTEREST_KEYS = Object.freeze(["history", "art", "architecture", "food", "views", "churches", "bible", "shopping", "beaches", "kids"]);
  E.has = (s, tag) => !!s && Array.isArray(s.tags) && s.tags.includes(tag);
  // Adds group or site (step 3) to each sight's tags. Returns new objects; the bucket itself is never changed.
  E.tagGroups = (sites, groups) => sites.map(s => Object.assign({}, s, { tags: (s.tags || []).filter(t => t !== "group" && t !== "site").concat(groups.kind.get(String(s.id)) || "site") }));
  // What to show or offer: show = "all" | "must" | "famous" | "local"; interests = the traveler's chosen interest keys
  // (none chosen = all); skip = tags to leave out (e.g. "religious" when the traveler turned religious sites off; a
  // must-see always stays). Sorted the same way every time: must-sees, then by fame, then by id.
  E.filterSights = (sites, opt) => {
    const o = opt || {}, show = o.show || "all", ints = o.interests || [], skip = o.skip || [];
    return sites.filter(s => {
      if (show === "must" && !E.has(s, "must-see")) return false;
      if (show === "famous" && !E.has(s, "famous")) return false;
      if (show === "local" && !E.has(s, "local-favorite")) return false;
      if (!E.has(s, "must-see") && skip.some(t => E.has(s, t))) return false;
      if (ints.length && !E.has(s, "must-see") && !ints.some(k => E.has(s, "interest:" + k))) return false;
      return true;
    }).sort((a, b) => (E.has(b, "must-see") ? 1 : 0) - (E.has(a, "must-see") ? 1 : 0) || (b.fame || 0) - (a.fame || 0) || E.byId(a, b));
  };
})(KEngine);
