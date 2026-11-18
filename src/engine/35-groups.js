// Beta 2 engine, part 3b: groups and sites (Richard's step 3, Nov 18: "Which piece is a group, and which is an
// individual site." Example he gave: a city's old town square is a group; the famous clock on it is a site).
// A GROUP is a place that holds other sights: a square or plaza, an old town or district, a castle, an archaeological
// site, a park, a city-state, a museum complex, an island. A SITE is one thing to see, with its own story. A site can
// sit inside a group and still be its own stop (its own guide and narration) within the group's visit.
// Membership comes from two general rules, never from a list of places:
//  1. the map's own boundaries: the sight stands inside the group's mapped area (kept in the places database as `in`);
//  2. an open square or plaza has no walls, so the buildings that face onto it belong to it: a sight within a short walk
//     of the square's centre (SQUARE_REACH) is a member.
// Nested groups (a chapel inside a museum inside a city-state) go to the innermost group, and that group sits inside
// the outer one. Each sight belongs to at most one group, so "Included" sights are never scheduled twice.
(function (E) {
  E.SQUARE_REACH = 0.15; // km from a square's centre: the buildings around the square, not the streets beyond
  const SQUARE = /\b(square|plaza|piazza|platz|plaça|praça|plein|námestie|náměstí|rynek|trg|meydanı|agora)\b/i;
  const AREA = /\b(square|plaza|piazza|platz|old town|old city|historic (?:centre|center|quarter)|quarter|district|neighbou?rhood|castle|citadel|fortress|kremlin|alcazar|alcázar|archaeological (?:site|park)|ruins|excavations|palace complex|city-state|park|gardens?|island|cay|museum complex|monastery complex|campus|cemetery)\b/i;
  const text = s => (s.category || "") + " " + (s.name || "");
  E.isSquare = s => SQUARE.test(text(s));
  E.isAreaKind = s => AREA.test(text(s)) || E.isSquare(s);
  // sites: every sight of a city (main and farther), as in the trip bucket. Returns
  //   { kind: id -> "group" | "site", groupOf: id -> the innermost group holding it, members: group id -> [ids], parent }
  E.makeGroups = sites => {
    const list = sites.filter(s => s && s.id != null && isFinite(s.lat) && isFinite(s.lng)).slice().sort(E.byId), byId = new Map(list.map(s => [String(s.id), s]));
    const holders = new Map(); // site id -> ids of groups it stands in
    const add = (m, g) => { if (m === g) return; const k = String(m); if (!holders.has(k)) holders.set(k, new Set()); holders.get(k).add(String(g)); };
    for (const s of list) for (const g of s.in || []) if (byId.has(String(g))) add(s.id, g);                 // rule 1: map boundaries
    for (const g of list) if (E.isSquare(g) && !g.far) for (const s of list)                                // rule 2: around a square
      if (s !== g && !s.far && !E.isSquare(s) && E.hav(s, g) <= E.SQUARE_REACH && !(g.in || []).includes(s.id)) add(s.id, g.id);
    // A group never sits inside its own member (two places that each "contain" the other are both plain sites).
    for (const [m, gs] of holders) for (const g of [...gs]) if (holders.has(g) && holders.get(g).has(m)) { gs.delete(g); holders.get(g).delete(m); }
    // Innermost holder: the one that is itself inside the others.
    const groupOf = new Map();
    for (const [m, gs] of holders) { if (!gs.size) continue;
      const inner = [...gs].filter(g => ![...gs].some(h => h !== g && holders.has(h) && holders.get(h).has(g))).sort()[0] || [...gs].sort()[0];
      groupOf.set(m, inner); }
    const members = new Map(), kind = new Map();
    for (const [m, g] of groupOf) { if (!members.has(g)) members.set(g, []); members.get(g).push(m); }
    for (const s of list) kind.set(String(s.id), members.has(String(s.id)) ? "group" : "site");
    for (const v of members.values()) v.sort();
    // The outermost group a sight belongs to (a chapel -> museum -> city-state gives the city-state).
    const top = id => { let k = String(id), seen = new Set(); while (groupOf.has(k) && !seen.has(k)) { seen.add(k); k = groupOf.get(k); } return k; };
    // Everything a group's visit includes, at every depth.
    const within = g => { const out = []; const walk = k => (members.get(k) || []).forEach(m => { out.push(m); walk(m); }); walk(String(g)); return out; };
    return { kind, groupOf, members, top, within };
  };
  // Claim a visit in the ledger: a group claims everything inside it, a site claims itself, all on one day.
  E.claimVisit = (ledger, groups, id, day) => {
    const ids = [String(id)].concat(groups.kind.get(String(id)) === "group" ? groups.within(id) : []);
    if (!ids.every(x => ledger.sightFree(x, day))) return false;
    ids.forEach(x => ledger.claimSight(x, day, x === String(id) ? "stop" : "included")); return true;
  };
})(KEngine);
