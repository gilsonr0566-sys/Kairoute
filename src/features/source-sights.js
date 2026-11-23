// ===================== Every real sight the sources know =====================
// A guide's written list (a built-in starter guide, or an AI guide of about 20 sights) is only the start. Once a
// city's sources load (worker /sources: Wikidata fame, Wikipedia in the local language, English and local
// Wikivoyage, heritage registers and UNESCO, cross-checked), every visitable place that at least two of them
// name, inside the city, joins the sights list, ranked by fame. Nothing is invented: each one has its real
// position and its sources, and its short description comes from the travel guide that lists it. No AI is
// spent to list them; a sight's full spoken story is written only once a traveler puts it on a day (from its
// Wikipedia facts), and kept on the device.
// The same rule runs for every city and every port, including gateway ports ("Civitavecchia (Rome)"): the sources
// are asked for the city the day is really spent in.
const SRC_KIND_CAP = { Church: 12, Mosque: 12, Temple: 12, Shrine: 8, Museum: 12, Palace: 8, "Castle or fort": 8 };
const SRC_MAX_MAIN = 45, SRC_MAX_QUICK = 12, SRC_R = 8;
// A big city's landmarks spread wider than its centre (a tower 11 km out): one famous the world over counts within this.
const SRC_R_FAMED = 15;
// How many sources must agree on a place. Two, normally (a place is trusted because independent sources name it). A
// small place has too few for that: Nassau's travel guide names Fort Fincastle and Parliament House, but where English
// is the local language there is no second, local-language guide to agree, and a small island has only the map. There,
// with fewer than SRC_FEW places two sources agree on, one real source with the place's position is enough (a travel
// guide's listing, the encyclopedia, or the map), so a port day still gets real stops instead of no guide at all
// (Bahamas test trip, Nov 17: "The guide for Nassau didn't come through"). Nothing is ever made up either way.
const SRC_FEW = 6;
function srcNeed(src, centre) {
  const two = ((src && src.stops) || []).filter(x => (x.src || []).length >= 2 && x.lat != null && (!centre || hav(x, centre) <= SRC_R)).length;
  return two >= SRC_FEW ? 2 : 1;
}
// In a small place (srcNeed 1), a sight one real source names, with its position: a travel guide's listing, a place the
// encyclopedia knows in several languages, or a tourist place on the map; still visitable, open and a real spot.
const srcWorthyAt = need => need >= 2 ? srcWorthy : x => x && x.lat != null && /[A-Za-z]/.test(x.name || "") && !srcShut(x) && !srcNotSpot(x)
  && (srcVisitable(x) || (x.src || []).some(t => /OpenStreetMap/.test(t)) || (x.sl || 0) >= 15);
// Entries that are not one place to visit: a whole city or country, a district, transport, institutions.
const SRC_NEVER = /\b(city|district|business area|ministerios|rione|quartiere|municipality|province|region|metro|subway|railway|station|airport|line|radio|embassy|bank|ministry|school|hospital|programme|organization|organisation)\b/i;
// A sports ground in any language (first-timer walk, Nov 22: a football stadium, named in German, planned as a must-see
// with a 23 min taxi each way) is no sight unless listed; "arena" stays a sight, as many are Roman.
const SRC_UNLESS_LISTED = /\b(stadium|stadion|stadio|stade|estadio|est[áa]dio|stadyumu?|university|universit[àa]|academy|parliament)\b/i; // a listed monument (Panathenaic Stadium) is a sight
// Not a place a visitor goes in (competitor review, Nov 20: a stock exchange as a must-see, a plane crash as a sight, an office
// tower as a 40 min visit): a business or an office, or an event rather than a place (unless it names its memorial or museum).
// An office building is no stop unless it is a listed monument (the Chrysler Building) or World Heritage.
const SRC_BUSINESS = /\b(stock exchange|exchange|headquarters|head office|offices?|corporation|company|bank)\b/i;
const SRC_EVENT = /\b(disaster|crash|accident|bombing|shooting|attack|explosion|derailment|collision|fire of \d{4})\b/i, SRC_MEMORIAL = /\b(memorial|monument|museum|cenotaph)\b/i;
// What a place IS, from the encyclopedia's facts (the helper's kinds, Nov 22 audit), never from words in its name:
//  - a thing you can stand in or at (a building, ruin, park, square, monument, natural place) is a place;
//  - kinds known and none of them a place (an organisation, an event, a language, a region, a work of art, a parliament
//    or university as a body) is not a stop: UNESCO, a broadcaster, a football club, Pentecost and "continental Europe"
//    had passed as sights, some as must-sees, because many languages write about them;
//  - a sports ground or arena (Wiener Stadthalle) is a stop only when a travel guide lists it or it is a listed monument;
//  - a town or village (Dobrota, Prcanj by Kotor) is a day out, never a stop in a city's own list, unless it is World
//    Heritage or an old town or quarter (the Old City of Jerusalem);
//  - a university, school, hospital, station, hotel or office block only as a listed monument or World Heritage.
// Kinds unknown (an older answer, a failed ask): the name rules below decide, as before.
const SRC_PLACE_KINDS = /^(old-town|structure|feature|building|archaeological|ancient-city|amphitheatre|mausoleum|park|garden|natural|beach|mountain|island|waterfall|cemetery|viewpoint|museum|art-museum|church|cathedral|mosque|synagogue|temple|chapel|monastery|castle|fortification|palace|square|bridge|monument|statue|fountain|tower|skyscraper|observation-deck|theatre|opera-house|concert-hall|stadium|arena|sports-venue|market|zoo|aquarium|amusement-park)$/;
const SRC_SIGHT_KINDS = /^(old-town|archaeological|ancient-city|amphitheatre|mausoleum|park|garden|natural|beach|mountain|island|waterfall|cemetery|viewpoint|museum|art-museum|church|cathedral|mosque|synagogue|temple|chapel|monastery|castle|fortification|palace|square|bridge|monument|statue|fountain|tower|skyscraper|observation-deck|theatre|opera-house|concert-hall|market|zoo|aquarium|amusement-park)$/;
const SRC_OLD_TOWN = /\b(old town|old city|historic (centre|center|quarter)|quarter|medina|altstadt|centro storico|vieille ville|casco antiguo|ciutat vella|plaka|kaleici)\b/i;
const srcKnown = x => Array.isArray(x && x.kinds) && x.kinds.length > 0;
const srcHas2 = (x, re) => (x.kinds || []).some(k => re.test(k));
const srcListed = x => !!(x.unesco || x.heritage || (x.src || []).some(t => /Wikivoyage/.test(t)));
function srcNotPlace(x) {
  // Gone: demolished or destroyed (the Bastille fortress, whose square is what is left to see).
  if (x.gone) return true;
  // A listing of places, not a place: a whole whose parts are on the list themselves and lie kilometres apart
  // ("Historic Monuments of Ancient Kyoto", 17 temples across the city; Nov 23 sight check). See srcMarkGroups.
  if (x.isGroup) return true;
  // The map says it is a country, state or region: an area, not a place to stand in.
  if (x.area && !srcHas2(x, SRC_SIGHT_KINDS)) return true;
  if (!srcKnown(x)) return false;
  // A word, not a place: the encyclopedia calls it a term, and nothing more specific than "a location" (the Holy Land, Nov 23).
  if (srcHas2(x, /^term$/) && !srcHas2(x, SRC_SIGHT_KINDS) && !srcHas2(x, /^(building|structure)$/)) return true;
  if (!srcHas2(x, SRC_PLACE_KINDS) && !srcHas2(x, /^(settlement|admin-area)$/)) return true;
  if (srcHas2(x, /^continent$/)) return true;
  // A region, country or peninsula is no stop; an old town is (the Old City of Jerusalem is both a region and an old town).
  if (srcHas2(x, /^region$/) && !srcHas2(x, SRC_SIGHT_KINDS) && !srcHas2(x, /^(building|structure)$/) && !x.unesco && !SRC_OLD_TOWN.test(x.name + " " + (x.local || ""))) return true;
  if (srcHas2(x, /^(stadium|arena|sports-venue)$/) && !srcHas2(x, /^(archaeological|ancient-city|amphitheatre)$/) && !srcListed(x)) return true;
  if (srcHas2(x, /^(settlement|admin-area)$/) && !srcHas2(x, SRC_SIGHT_KINDS) && !x.unesco && !SRC_OLD_TOWN.test(x.name + " " + (x.local || ""))) return true;
  if (srcHas2(x, /^(university|school|hospital|station|airport|hotel|office-building|business)$/) && !srcHas2(x, /^(museum|art-museum|church|cathedral|mosque|synagogue|temple|chapel|monastery|castle|palace|archaeological)$/) && !x.unesco && !x.heritage) return true;
  return false;
}
if (typeof window !== "undefined") window.__kairouteNotPlace = x => srcNotPlace(x);
// "City" in a name means a city or district, except in an old town's ("Old City of Jerusalem" was never offered, Nov 23).
// A place the sources know only by a local-language name (no English label, no English travel guide, no single name
// for every language) is never offered: the app shows names in the traveler's language (Richard, Nov 23), and a local
// name can't be put into English without knowing the language. Whatever the language, the same rule.
// A place no source names in English (rule R-11, any language): shown by what it is in English ("Castle or fort",
// "Beach", "Museum"), its own name beneath as the name on signs. When what it is isn't known either, it is "Local
// sight" if its name can at least be read in Latin letters; otherwise it can't be told apart and is not offered.
const srcTypeName = x => { const cat = srcKindOf(x)[1]; return cat && cat !== "Sight" ? cat : nonLatin(x.name) ? "" : "Local sight"; };
// A name that already says in English what the place is ("Ladies Beach", "Papaz Hamamı Beach", "Ada Modern Art
// Gallery") is a proper name with an English word for its kind, as English maps write it: shown as it is.
// English words only (the traveler's language), whatever language the rest of the name is in.
const SRC_EN_KIND = /\b(museum|gallery|collection|basilica|cathedral|church|chapel|monastery|convent|abbey|catacombs?|mosque|synagogue|forum|baths|mausoleum|tomb|amphitheat(re|er)|theat(re|er)|ruins|acropolis|agora|shrine|temple|castle|fortress|fort|citadel|bastion|palace|villa|opera house|park|gardens?|square|fountain|statue|obelisk|bridge|gate|arch|stairs|steps|monument|memorial|beach|island|lighthouse|tower|market|bazaar|harbou?r|lake|bay|cave|hill|viewpoint|old town|aquarium|zoo)\b/i;
const srcSaysKind = x => !nonLatin(x.name) && SRC_EN_KIND.test(x.name);
const srcNotSpot = x => srcNotPlace(x) || (!!x.localName && !srcTypeName(x)) || (SRC_NEVER.test(x.name) && !(SRC_OLD_TOWN.test(x.name) && !/\b(metro|station|line|airport|bank|school|hospital)\b/i.test(x.name))) || SRC_BUSINESS.test(x.name) || (SRC_EVENT.test(x.name) && !SRC_MEMORIAL.test(x.name)) || ((SRC_UNLESS_LISTED.test(x.name) || /\bbuilding\b/i.test(x.name)) && !x.heritage && !x.unesco);
// What kind of stop a name describes: a typical visit length, a category and whether it is a walk-past stop.
const SRC_KINDS = [
  [/museum|museo|musei|museu|mus[ée]e|gallery|galleria|galer[ií]a|pinacoteca|collection/i, "Museum", 90],
  [/basilica|cathedral|duomo|cattedrale|catedral|church|chiesa|iglesia|esgl[ée]sia|chapel|cappella|oratory|monastery|convent|abbey/i, "Church", 30],
  [/catacomb/i, "Catacombs", 60],
  // A mosque, a synagogue or a temple is called what it is on its card, never "Church" (Nov 23 sight check).
  [/\b(mosque|camii|cami|masjid)\b/i, "Mosque", 30], [/\bsynagogue\b/i, "Synagogue", 30],
  // "Teatro di Marcello" is a ruin but "Teatro di San Carlo" an opera house: an Italian theatre's name alone says
  // nothing (Nov 22: San Carlo was shown as an ancient site); its kinds decide (srcKindOf), else it is a theatre.
  [/forum|foro|baths|terme|thermae|circus|circo|mausoleum|mausoleo|tomb|tomba|amphitheat|theatre of|ancient|archaeolog|acropolis|agora|ruins|domus|villa of|stadium of/i, "Ancient site", 60],
  [/\b(shrine|jinja|jing[uū])\b|-taisha\b|-jing[uū]\b|-g[uū]\b/i, "Shrine", 45], [/\b(temple|tempio)\b|-ji\b|-dera\b|-d[oō]\b/i, "Temple", 45],
  // A fort is called a castle or fort, never a palace (Nov 23 card review: a fort and a belfry were "Palace").
  [/castle|castel|castillo|fortress|\bfort\b|\bforte?\b|citadel|kastro|bastion|fortifications?/i, "Castle or fort", 50],
  [/palace|palazzo|palacio|palau|villa/i, "Palace", 50],
  [/\b(teatro|theat(re|er)|opera house|staatsoper|concert hall)\b/i, "Theatre", 30],
  [/park|garden|giardino|jard[ií]n|parque|parco|botanic/i, "Park or garden", 40],
  [/square|piazza|plaza|pla[çc]a|platz|place /i, "Square", 15],
  [/fountain|fontana|fuente|font |statue|column|colonna|obelisk|obelisco|bridge|ponte|puente|pont |gate|porta|puerta|arch of|arco di|arco de|stairs|steps|scalinata|keyhole|monument to/i, "Landmark", 10]
];
// Kind from the English and local names ("San Luigi dei Francesi" is "Chiesa di San Luigi dei Francesi" locally).
const srcKind = (name, local) => { const t = name + " " + (local || ""); return SRC_KINDS.find(k => k[0].test(t)) || (/^(san|santa|sant'|santo|saint|st\.?|são|santi|santissim)\b/i.test(name) && !/\b(lift|elevator|elevador|funicular|street|road|avenue|rua|calle|via|station|gate|hospital|school|island|beach|park|hill|bay|lighthouse)\b/i.test(name) ? SRC_KINDS[1] : [null, "Sight", 40]); };
const srcQuick = (name, local) => srcKind(name, local)[1] === "Landmark";
// Kind from the encyclopedia's facts first (Hagia Sophia, the Colosseum, the Tower of London and Burj Khalifa have no
// telling word in their names), the name only when the facts don't say. The first that fits wins, so a palace that
// is now an art museum (the Louvre) is a museum and a castle that is a museum is a castle.
const SRC_KIND_FACTS = [
  // A church that was a Roman temple (the Pantheon) is visited as a church; a ruined temple (Olympian Zeus) as a ruin.
  [/^art-museum$/, "Museum", 90], [/^mosque$/, "Mosque", 30], [/^synagogue$/, "Synagogue", 30], [/^(cathedral|church|chapel|monastery)$/, "Church", 30], [/^(archaeological|ancient-city|amphitheatre|mausoleum)$/, "Ancient site", 60], [/^temple$/, "Temple", 45],
  [/^(castle|fortification)$/, "Castle or fort", 50], [/^palace$/, "Palace", 50], [/^(skyscraper|observation-deck|tower)$/, "Tower", 40], [/^museum$/, "Museum", 90], [/^(theatre|opera-house|concert-hall)$/, "Theatre", 30],
  [/^(zoo|aquarium|amusement-park)$/, "Zoo or park", 150], [/^(park|garden)$/, "Park or garden", 40], [/^market$/, "Market", 40], [/^beach$/, "Beach", 90], [/^square$/, "Square", 15],
  [/^(stadium|arena|sports-venue)$/, "Stadium", 45], [/^(bridge|statue|fountain|monument)$/, "Landmark", 10]];
// A Shinto shrine is a temple to the encyclopedia's class tree but a shrine to everyone visiting: its name says which.
// When the facts are known but name no kind of ours, a name word is trusted only where it can't contradict them: "Basilica
// Cistern" is no church, a "Park" stadium no garden (Nov 23 card review). Otherwise it is a plain "Sight", which is always true.
const SRC_NAME_SAFE = /^(Landmark|Square|Market|Catacombs)$/;
const srcKindOf = x => { const k = srcKnown(x) && SRC_KIND_FACTS.find(([re]) => x.kinds.some(t => re.test(t)));
  if (!k) { const n = srcKind(x.name, x.local); return !srcKnown(x) || SRC_NAME_SAFE.test(n[1]) ? n : [null, "Sight", 40]; } const n = srcKind(x.name, x.local); return k[1] === "Temple" && n[1] === "Shrine" ? [null, "Shrine", k[2]] : [null, k[1], k[2]]; };
// How long a visit takes grows with how much there is to see and how many people come to see it: a place written about
// in 80+ languages (the Colosseum, Topkapı, the Louvre) has more rooms, more grounds and longer queues than the
// same kind of place known in 20 (Nov 22 audit: Hagia Sophia, the Colosseum and the Tower of London were 40-minute visits).
const SRC_FAME_LEN = { Landmark: [[40, 20]], Museum: [[120, 180], [80, 150], [50, 120]], Church: [[120, 75], [80, 60], [50, 45]], Mosque: [[120, 75], [80, 60], [50, 45]], Synagogue: [[80, 60], [50, 45]], Temple: [[120, 90], [80, 75], [50, 60]], Shrine: [[80, 75], [40, 60]], "Ancient site": [[80, 120], [60, 90]], Palace: [[80, 120], [50, 90]], "Castle or fort": [[80, 120], [50, 90]], Sight: [[100, 90], [60, 60]],
  Tower: [[100, 75], [50, 60]], Theatre: [[80, 45]], Market: [[40, 60]], Catacombs: [[50, 75]] };
const srcMinutes = (cat, base, sl) => { const b = (SRC_FAME_LEN[cat] || []).find(([at]) => (sl || 0) >= at); return b ? Math.max(base, b[1]) : base; };
// The guide's own centre: the middle of its written sights (a gateway port's guide is about the city it serves).
function srcCentre(city, src) {
  const pts = (city.sites || []).filter(x => !x.srcOnly && !x.quick && isFinite(x.lat));
  if (pts.length >= 3) { const la = pts.map(x => x.lat).sort((a, b) => a - b), ln = pts.map(x => x.lng).sort((a, b) => a - b); return { lat: la[pts.length >> 1], lng: ln[pts.length >> 1] }; }
  return src && src.center && isFinite(src.center.lat) ? src.center : pts[0] || null;
}
// One or two plain sentences from the travel guide that lists the place (English first, then the local one).
function srcSummary(x, cat, area) {
  const t = String(x.en || "").replace(/\s+/g, " ").trim();
  if (t.length > 25) { const ss = t.match(/[^.!?]+[.!?]+(\s|$)/g) || [t]; let out = ""; for (const s of ss) { if ((out + s).length > 230 && out) break; out += s; } return out.trim().slice(0, 260); }
  const kind = cat === "Sight" ? "sight" : cat.toLowerCase();
  return `${x.unesco ? "A World Heritage " : x.heritage ? "A listed historic " : "A "}${kind} in ${area}, named by ${x.src.length} independent sources.`;
}
if (typeof window !== "undefined") window.__kairouteNotSpot = x => srcNotSpot(x);
const srcVisitable = x => x && x.lat != null && (x.src || []).some(t => /Wikivoyage|heritage|UNESCO/.test(t));
// The quality bar (Richard: "not full for the sake of quantity, quality is the key"): a place joins the list only
// if travelers recommend it (a Wikivoyage listing, English or local), it is World Heritage, or it is a listed monument
// that 40+ Wikipedia languages write about (Rome's Santa Maria Maggiore), AND it is well known
// (written about in 15+ Wikipedia languages) or several independent sources agree (3+). A minor church on the
// heritage register alone, an office district or a government building doesn't make it.
// A place visitors can't go into on an ordinary day is never a stop, in any city: the travel guide's own words say
// it is closed to the public, or that it is a head of state's or government's working residence (the Élysée Palace,
// the Moncloa), unless that same sentence says it can still be visited ("Though it is the official residence of the
// King, ... state ceremonies"; tours, tickets, open to visitors).
const SRC_SHUT = /\b(is|are|remains?|currently)\s+(not open|closed|off[- ]limits|not accessible)\s+to\s+(the\s+)?(public|visitors|tourists)|\bno public access\b|\bnot open to (the )?public\b/i;
const SRC_SEAT = /\bofficial (residence|seat|workplace)\b|\bseat of the (government|president|prime minister|cabinet)\b/i;
const SRC_SEAT_OK = /\b(though|although|but|however|tours?|visit|visitors|open (to|for|daily|on)|tickets?|museum|state rooms)\b/i;
const srcShut = x => { const t = String((x && x.en) || ""); if (SRC_SHUT.test(t)) return true;
  return (t.match(/[^.!?]+[.!?]*/g) || []).some(s => SRC_SEAT.test(s) && !SRC_SEAT_OK.test(s)); };
// Famous the world over (competitor review, Nov 20: London had no Big Ben, Istanbul no Grand Bazaar, because no travel-guide
// page the sources read lists them): written about in 80+ Wikipedia languages, or 40+ with a second source agreeing, is a
// sight visitors expect even with no travel-guide listing. One source alone below 80 (a district's own article) is not.
const SRC_WORLD = 80, SRC_WIDE = 40;
const srcFamed = x => x && x.lat != null && ((x.sl || 0) >= SRC_WORLD || ((x.sl || 0) >= SRC_WIDE && (x.src || []).length >= 2));
// A listed monument three sources agree on, written about in 25+ languages, is a sight too (Dubrovnik's walls, a city's main
// shrine), even with no travel-guide listing.
const srcWorthy = x => (srcVisitable(x) || srcFamed(x) || (x.heritage && (x.sl || 0) >= 25 && (x.src || []).length >= 3)) && !srcShut(x) && (x.unesco || (x.heritage && ((x.sl || 0) >= 40 || ((x.sl || 0) >= 25 && (x.src || []).length >= 3))) || (x.src || []).some(t => /Wikivoyage/.test(t)) || srcFamed(x)) && ((x.sl || 0) >= 15 || (x.src || []).length >= 3) && !srcNotSpot(x);
if (typeof window !== "undefined") window.__kairouteSourceSights = (city, src) => sourceSights(city, src);
// "Acropolis of Athens" is the guide's "Acropolis and Parthenon": the city's own name is set aside when comparing.
const srcBare = (x, area) => { const a = keyOf(area); if (!a) return x; const n = keyOf(x.name).replace(new RegExp("\\b(of|in|de|di|del|d) " + a + "\\b|^" + a + " | " + a + "$", "g"), " ").replace(/\s+/g, " ").trim(); return n && n !== keyOf(x.name) ? Object.assign({}, x, { name: n }) : x; };
// A place inside a bigger stop's grounds (the Erechtheion on the Acropolis, a fountain on its square) is one of that
// stop's parts, never a stop of its own: the same reach the big-stop parts use (see partCands).
function srcReach(s) {
  if (!s || !isFinite(s.lat) || s.far || s.quick) return 0;
  const t = (s.category || "") + " " + s.name;
  return /castle|palace|citadel|fortress|kremlin|acropolis|archaeolog|ancient|forum|agora|monaster|abbey|park|garden|campus|cemetery|island|hill|complex/i.test(t) ? 0.45 : /square|plaza|piazza|platz|market/i.test(t) ? 0.2 : /old town|historic|quarter|district|village/i.test(t) ? 0.35 : AREA_CAT.test(t) ? 0.2 : 0;
}
const SRC_GROUNDS = /castle|citadel|fortress|kremlin|acropolis|archaeolog|ancient|forum|agora|monaster|abbey|complex|cemetery|campus/i;
const srcFame = (s, src) => s.fame != null ? s.fame : s.sl != null ? s.sl : ((src && srcStop(src, s.name, s)) || {}).sl || 0;
const srcPartOf = (x, s, src) => {
  // A sight famous in its own right (Big Ben beside the abbey) is never just a part of its neighbour: the planner folds it
  // into one visit when both are picked.
  if (srcFamed(x)) return false;
  // Nor is a museum travelers list on its own and many languages write about (the museum below a citadel, not in it).
  if ((x.sl || 0) >= 30 && (x.src || []).some(t => /Wikivoyage/.test(t)) && srcKind(x.name, x.local)[1] === "Museum") return false;
  const r = srcReach(s); if (!r || x.lat == null || !isFinite(s.lat) || hav(x, s) > r || (x.sl || 0) >= srcFame(s, src)) return false;
  // A museum, church or palace across from a park or on a square is its own visit; inside a castle's or an
  // ancient site's grounds it is part of that visit.
  return !/^(Museum|Church|Mosque|Synagogue|Temple|Shrine|Palace|Castle or fort|Catacombs)$/.test(srcKind(x.name, x.local)[1]) || SRC_GROUNDS.test((s.category || "") + " " + s.name);
};
// The whole a sight is part of, by the encyclopedia's own "part of" / "located in" (sent by the helper), when that whole
// is a place on the list within a kilometre and one visited as a whole: a museum, a castle or fortress, an ancient site
// (what is inside is seen in the same visit, however famous); a palace, church or monastery only when the part is the
// lesser of the two (Big Ben is seen from outside the Palace of Westminster, and is the more famous). A park, island,
// square or district is never a whole: the Eiffel Tower is not a part of the Champ de Mars.
const SRC_WHOLE_ANY = /^(museum|art-museum|castle|fortification|archaeological|ancient-city)$/, SRC_WHOLE_LESSER = /^(palace|church|cathedral|chapel|monastery|mosque|temple|synagogue)$/;
function srcMarkGroups(src) {
  const stops = (src && src.stops) || [];
  for (const w of stops) { if (!w.wd || w.lat == null) continue;
    const parts = stops.filter(p => p !== w && Array.isArray(p.partOf) && p.partOf.includes(w.wd) && p.lat != null);
    if (parts.length >= 2 && parts.some(p => hav(p, w) > 2)) w.isGroup = true; }
}
// A museum's own travel-guide description that names a sight as one of the things seen inside it ("most famous for its
// spiral staircase, the Raphael Rooms and the exquisitely decorated Sistine Chapel"): that sight is seen in the museum's
// visit (Nov 23: the Sistine Chapel was planned as its own stop after the Vatican Museums, because the encyclopedia files
// it under the palace, not the museum). Never when the words put it beside the museum ("next to", "opposite", "a walk
// from"), and never a place that is a whole visit of its own (another museum, a castle, an ancient site, a square, a park).
const SRC_BESIDE = /\b(next to|near|nearby|opposite|across|beside|behind|in front of|facing|close to|walk(?:ing)? (?:to|from)|way to|from|towards|outside|around|beyond|past|overlooking|views? of|view over|than|unlike)\s+(the\s+)?$/i;
const SRC_OWN_VISIT = /^(museum|art-museum|castle|fortification|archaeological|ancient-city|old-town|square|park|garden|palace|cathedral|island|natural|mountain|beach|stadium|arena|sports-venue)$/;
const SRC_OWN_VISIT_NAME = /\b(museum|museo|musei|mus[ée]e|castle|fortress|citadel|acropolis|forum|agora|palace|palazzo|cathedral|basilica|duomo|square|piazza|plaza|park|garden|island|old town|ruins|stadium|stadio|estadi|estadio|arena)\b/i;
const srcIsMuseum = W => srcKnown(W) ? srcHas2(W, /^(museum|art-museum)$/) : /\b(museum|museo|musei|mus[ée]e|museu|muzeum|gallery|galleria)\b/i.test(W.name + " " + (W.local || ""));
function srcNamedInside(x, W) {
  const t = String(W.en || W.summary || ""); if (!t || !x || x === W || x.wd && x.wd === W.wd) return false;
  if (srcKnown(x) ? srcHas2(x, SRC_OWN_VISIT) : SRC_OWN_VISIT_NAME.test(x.name + " " + (x.local || ""))) return false;
  for (const n of [x.name, x.local]) {
    if (!n || n.length < 6 || !/\s/.test(n.trim())) continue; // a whole name of two words or more, never one common word
    const m = new RegExp("(^|[^\\p{L}])" + n.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\p{L}])", "iu").exec(t); if (!m) continue;
    if (SRC_BESIDE.test(t.slice(Math.max(0, m.index - 40), m.index + m[1].length))) continue;
    // Part of a longer name (a stadium's tour, "the Camp Nou Experience"), not the place itself.
    if (/^\s+\p{Lu}/u.test(t.slice(m.index + m[0].length))) continue;
    return true;
  }
  return false;
}
function srcWholeOf(s, src, all, depth) {
  const stops = (src && src.stops) || [], x = s.wd && stops.find(y => y.wd === s.wd); if (!x || !isFinite(s.lat)) return null;
  for (const id of Array.isArray(x.partOf) ? x.partOf : []) {
    const W = stops.find(y => y.wd === id); if (!W || W.lat == null || hav(W, s) > 1 || !srcKnown(W) || srcNotPlace(W)) continue;
    // A tower beside a church or palace (St Mark's Campanile, Big Ben) is climbed or seen on its own.
    if (!srcHas2(W, SRC_WHOLE_ANY) && !(srcHas2(W, SRC_WHOLE_LESSER) && (x.sl || 0) < (W.sl || 0) && !srcHas2(x, /^(tower|observation-deck|skyscraper)$/))) continue;
    const on = all.find(o => o !== s && (o.wd === id || sameSight(o, W))); if (on) return on;
    // Its whole is itself seen inside a bigger visit (a fresco in a chapel that is seen in a museum): that visit.
    if (!(depth > 1)) { const up = srcWholeOf(Object.assign({}, W, { lat: W.lat, lng: W.lng }), src, all.filter(o => o !== s), (depth || 0) + 1); if (up) return up; }
  }
  // Named inside a museum's own description, within a kilometre: that museum, when it is on the list.
  for (const W of stops) {
    if (W === x || W.lat == null || hav(W, s) > 1 || !srcIsMuseum(W) || srcNotPlace(W) || !srcNamedInside(x, W)) continue;
    const on = all.find(o => o !== s && ((W.wd && o.wd === W.wd) || sameSight(o, W))); if (on) return on;
  }
  // A guide's own museum with such a description (its built-in card's summary).
  for (const o of all) {
    if (o === s || o.wd === x.wd || !isFinite(o.lat) || hav(o, s) > 1 || !srcIsMuseum(o) || !srcNamedInside(x, o)) continue;
    return o;
  }
  return null;
}
if (typeof window !== "undefined") window.__kairouteWholeOf = (s, src, all) => srcWholeOf(s, src, all);
const srcHas = (all, x, area, src) => { const b = srcBare(x, area || "");
  return all.some(s => sameSight(x, s) || placeRel(x, s) || placeRel(s, x) || (b !== x && (sameSight(b, s) || placeRel(b, s) || placeRel(s, b))) || srcPartOf(x, s, src)); };
// The full stories written for source sights, kept on this device (built-in guides aren't saved with the trip).
const SRCW_STORE = "kairoute.srcw1";
let srcWritten = (() => { try { return JSON.parse(localStorage.getItem(SRCW_STORE) || "{}") || {}; } catch (e) { return {}; } })();
const srcWKey = (city, s) => keyOf(city.city) + "|" + (s.wd || s.id);
function srcWSave() { try { const ks = Object.keys(srcWritten); if (ks.length > 600) ks.slice(0, ks.length - 600).forEach(k => delete srcWritten[k]); localStorage.setItem(SRCW_STORE, JSON.stringify(srcWritten)); } catch (e) {} }
const srcDone = new WeakMap();
function sourceSights(city, src) {
  if (!city || !src || !Array.isArray(src.stops) || srcDone.get(city) === src) return 0;
  srcDone.set(city, src);
  srcMarkGroups(src);
  // Sights a saved guide got from the sources before names were put into English get theirs now.
  for (const s of allSites(city)) if (s.srcOnly && !s.enN) { const en = enSight({ name: s.name, local: s.local, sl: s.fame }, s.category); if (en) Object.assign(s, en); s.enN = 1; }
  // A sight a saved guide got from the sources takes the sources' checked point now (the helper cross-checks the travel
  // guide, the encyclopedia and the map: Nov 22, a synagogue had been 2 km out of the old town it stands in).
  for (const s of allSites(city)) if (s.srcOnly && s.wd) { const x = src.stops.find(y => y.wd === s.wd); if (!x || x.lat == null || !isFinite(x.lat)) continue;
    if (!isFinite(s.lat) || hav(s, x) > 0.05) { s.lat = x.lat; s.lng = x.lng; } if (x.posDoubt) s.posDoubt = true; else delete s.posDoubt;
    // Its kind and visit length from the facts, where the saved one is still the old name-word guess (never a length
    // the traveler or a big stop's parts changed).
    if (srcKnown(x) && !s.parts && s.baseMin == null) { const [, oc, om] = srcKind(s.srcName || s.name, s.local), [, cat, m0] = srcKindOf(x), m = srcMinutes(cat, m0, x.sl);
      if (s.minutes === (s.quick ? 10 : om) && s.category === oc && (cat !== oc || m !== s.minutes)) { s.category = cat; if (!s.quick || cat !== "Landmark") { s.quick = false; s.minutes = m; } } } }
  // A sight the travel guide's page listed (id "wv~Q…", all "Sight", 30 minutes by its name alone) takes its kind and
  // visit length from the same facts (Nov 23 sight check, Rome: the Capitoline Museums and the Baths of Caracalla were
  // 30-minute "Sights"). Never a length the traveler or a big stop's parts changed.
  for (const s of allSites(city)) { const m = /^wv~(Q\d+)$/.exec(String(s.id)); if (!m || !s.fromGuide || s.parts || s.baseMin != null || s.category !== "Sight") continue;
    const x = src.stops.find(y => y.wd === m[1]); if (!x || !srcKnown(x) || srcNotPlace(x)) continue;
    const [, cat, m0] = srcKindOf(x); if (cat === "Sight") continue;
    if (!s.wd) s.wd = m[1]; s.category = cat; if (s.minutes === 30 || s.minutes === 60) s.minutes = srcMinutes(cat, m0, x.sl); }
  // A travel-guide listing shows the place's English name (the encyclopedia's English label or English Wikipedia
  // title, as the helper sends it), its listing name kept as the local name; one with no English name in any source
  // leaves the list unless the traveler chose it (rule R-11, any language: "Kadı Kalesi", "Palazzo Zanca").
  { const mine = new Set(((typeof trip !== "undefined" && trip && trip.days) || []).flatMap(d => (d.mine || []).map(String)));
    for (const k of ["sites", "farther"]) if (Array.isArray(city[k])) city[k] = city[k].filter(s => { const m = /^wv~(Q\d+)$/.exec(String(s.id)); if (!m || !s.fromGuide) return true;
      const x = src.stops.find(y => y.wd === m[1]); if (!x) return true;
      if (x.localName) { if (!s.srcName && !srcSaysKind(Object.assign({}, x, { name: s.name }))) { const t = srcTypeName(Object.assign({}, x, { name: s.name })); if (!t) return mine.has(String(s.id)); s.srcName = s.name; s.local = s.local || s.name; s.name = t; s.localOnly = true; } return true; }
      if (!s.srcName && x.name && !nonLatin(x.name) && keyOf(x.name) !== keyOf(s.name)) { s.srcName = s.name; s.local = s.local || s.name; s.name = x.name; }
      return true; }); }
  // A travel-guide listing that is a sight the guide already has under its English name leaves the list (Nov 23 sight
  // check: "Museo regionale di Messina" beside the "Regional Museum of Messina", "San Paolo fuori le Mura" beside the
  // "Basilica of Saint Paul Outside the Walls"): the same id, or the encyclopedia's English name is the guide's own, within 2 km.
  { const mine = new Set(((typeof trip !== "undefined" && trip && trip.days) || []).flatMap(d => (d.mine || []).map(String)));
    const twin = s => { const m = /^wv~(Q\d+)$/.exec(String(s.id)); if (!m || !s.fromGuide || mine.has(String(s.id))) return false;
      const x = src.stops.find(y => y.wd === m[1]), en = keyOf((x && x.name) || "");
      return allSites(city).some(t => t !== s && !/^wv~/.test(String(t.id)) && (!isFinite(t.lat) || !isFinite(s.lat) || hav(t, s) <= 2) &&
        (t.wd === m[1] || (en && en.split(" ").length >= 2 && (keyOf(t.name) === en || keyOf(t.srcName || "") === en)))); };
    for (const k of ["sites", "farther"]) if (Array.isArray(city[k])) city[k] = city[k].filter(s => !twin(s)); }
  // A sight a saved guide got from the sources that the facts now show is no place to visit (an organisation, an event, a
  // region, a village) leaves the list, unless the traveler chose it themselves.
  { const mine = new Set(((typeof trip !== "undefined" && trip && trip.days) || []).flatMap(d => (d.mine || []).map(String)));
    for (const k of ["sites", "farther"]) if (Array.isArray(city[k])) city[k] = city[k].filter(s => { if (!s.srcOnly || !s.wd || mine.has(String(s.id))) return true;
      const x = src.stops.find(y => y.wd === s.wd); if (x && x.localName && !s.localOnly && !s.srcName && !srcSaysKind(Object.assign({}, x, { name: s.name }))) { const t = srcTypeName(x); if (!t) return false; s.srcName = s.name; s.local = s.local || s.name; s.name = t; s.localOnly = true; }
      return !(x && k === "sites" && srcNotPlace(x)); }); }
  const centre = srcCentre(city, src); if (!centre) return 0;
  const area = String(src.area || city.city).replace(/\s*\(.*\)/, "");
  // The caps count the written guide and the sources' own sights, never the famous places written in (famousFix): those
  // come back from the device before this runs offline but arrive after it online, and must not change what's added.
  const own = () => (city.sites || []).filter(x => !x.famousFix);
  const all = allSites(city), mainN = () => own().filter(x => !x.quick).length, quickN = () => own().filter(x => x.quick).length;
  const score = x => (x.sl || 0) + 8 * (x.src || []).length + (x.unesco ? 30 : x.heritage ? 5 : 0) + ((x.src || []).some(t => /Wikivoyage/.test(t)) ? 10 : 0); // travelers recommend it
  const need = srcNeed(src, centre);
  const worthy = srcWorthyAt(need);
  const cands = src.stops.filter(x => worthy(x) && ((x.src || []).length >= need || (x.sl || 0) >= SRC_WORLD) && x.lat != null && x.name && keyOf(x.name) !== keyOf(area) && hav(x, centre) <= (srcFamed(x) && (x.sl || 0) >= 60 ? SRC_R_FAMED : SRC_R))
    .sort((a, b) => score(b) - score(a));
  let n = 0;
  const make = (x, extra) => {
    const [, cat, min0] = srcKindOf(x), q = !extra.far && cat === "Landmark" && (x.sl || 0) < SRC_WIDE, min = srcMinutes(cat, min0, x.sl);
    const st = normSite({ id: "src-" + (x.wd || keyOf(x.name).replace(/ /g, "-")), name: x.name, lat: x.lat, lng: x.lng, minutes: q ? 10 : min, category: cat, summary: srcSummary(x, cat, area), web: x.web, kind: "touristy", quick: q }, 0);
    Object.assign(st, { srcOnly: true, fame: x.sl || 0, unesco: !!x.unesco, heritage: !!x.heritage, src: x.src || [], local: x.local, wd: x.wd }, extra);
    // The helper's sources disagree on where it is and nothing settles it: said so on its card and on rides to it.
    if (x.posDoubt) st.posDoubt = true;
    const en = enSight(x, cat); if (en) Object.assign(st, en); st.enN = 1;
    if (!en && x.localName && !srcSaysKind(x)) { st.srcName = x.name; st.local = x.name; st.name = srcTypeName(x); st.localOnly = true; }   // "Palazzo Zanca" is shown as "Zanca Palace", its local name beneath
    const w = srcWritten[srcWKey(city, st)]; if (w) Object.assign(st, w);
    return st;
  };
  for (const x of cands) {
    if (srcHas(allSites(city), x, area, src)) continue;
    const q = srcKindOf(x)[1] === "Landmark" && (x.sl || 0) < SRC_WIDE;
    if (q ? quickN() >= SRC_MAX_QUICK + 5 : mainN() >= SRC_MAX_MAIN) continue;
    // Variety: one kind of place (churches, museums, palaces) never fills the list; the next best of another kind
    // (a famous staircase, a hill with a view, the catacombs) gets the room.
    const kind = srcKindOf(x)[1], cap = SRC_KIND_CAP[kind];
    if (cap && own().filter(s => !s.quick && srcKind(s.name, s.local)[1] === kind).length >= cap) continue;
    city.sites.push(make(x, {})); n++;
  }
  // A part of a bigger sight that is also on the list is seen in that visit, never a stop of its own (Nov 22 sight check:
  // the Sistine Chapel apart from the Vatican Museums, the Temple of Athena Nike apart from the Acropolis).
  { const mine = new Set(((typeof trip !== "undefined" && trip && trip.days) || []).flatMap(d => (d.mine || []).map(String)));
    for (const st of city.sites.filter(s => s.srcOnly && s.wd && !mine.has(String(s.id)))) if (srcWholeOf(st, src, allSites(city))) { city.sites.splice(city.sites.indexOf(st), 1); if (n) n--; } }
  if (n) { try { console.info(`Kairoute added ${n} sights from the sources for ${city.city}`); } catch (e) {} }
  return n;
}
// How many sights a city should offer, from how many real visitable places its sources agree on: a big city
// (Rome, Paris, Athens, Barcelona, Madrid) at least 30 worthwhile ones, a smaller one most of what its sources know.
function srcCoverageMin(src, centre) {
  const area = String((src && src.area) || ""), seen = [];
  const need = srcNeed(src, centre);
  const worthy = srcWorthyAt(need);
  for (const x of ((src && src.stops) || []).filter(x => worthy(x) && (x.src || []).length >= need && (!centre || hav(x, centre) <= SRC_R)).sort((a, b) => (b.sl || 0) - (a.sl || 0)))
    if (!srcHas(seen, x, area, src)) seen.push(x);   // one place counted once, with its parts (the Erechtheion is the Acropolis)
  return seen.length >= 50 ? 30 : Math.floor(seen.length * 0.6);
}
// The spoken story for a source sight is written once it is on a day: from its Wikipedia facts, four at a time.
const srcAsked = new Set();
async function writeSrcSights(plan, city) {
  if (!plan || plan.error || !city || typeof sample !== "function" || !sample || !aiReady()) return;
  const todo = plan.items.filter(i => i.type === "stop" && i.place && i.place.srcOnly && !i.place.guide).map(i => allSites(city).find(x => x.id === i.place.id)).filter(s => s && !srcAsked.has(srcWKey(city, s))).slice(0, 4);
  if (!todo.length) return;
  todo.forEach(s => srcAsked.add(srcWKey(city, s)));
  let facts = {};
  try { const ids = todo.map(s => s.wd).filter(Boolean); if (ids.length && freeAI) { const r = await fetch(freeAI.url + "/facts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids }) }); if (r.ok) facts = (await r.json()).facts || {}; } } catch (e) {}
  const prompt = `You are an expert tour guide writing data for a self-guided tour app in ${city.city}${city.country ? ", " + city.country : ""}. Write these real places. Keep each name exactly as given.
${todo.map((s, i) => { const f = s.wd && facts[s.wd]; return `${i + 1}. ${s.name}${s.local && s.local !== s.name ? " (" + s.local + ")" : ""}. ${f ? "Facts (Wikipedia): " + (f.what ? f.what + ". " : "") + String(f.text || "").slice(0, 900) : "No article: describe only what is certain and keep it short."}${s.summary ? " Travel guide: " + s.summary : ""}`; }).join("\n")}
Return ONLY JSON: {"places":[{"n":number,"guide","lookFor","photoTip","picks","hours","closed","tickets","crowds","cost","indoor","access"}]}
- "guide": spoken narration in second person, 110-150 words, built on the facts given; never invent names, dates or numbers. Say plainly where it is if another famous place has a similar name. "lookFor": 3 specific details. "picks": 3 insider extras, each {"k": "spot"|"timing"|"story"|"taste", "t": one or two sentences}. "cost": typical adult ticket in local currency as a number (0 if free).
- Write human-readable text in ${P().lang}.${faithNote()}`;
  try {
    const r = await sample(prompt, { modelTier: "default" }); const j = parseJSON(r.text || "");
    let got = 0;
    for (const x of (j && j.places) || []) {
      const s = todo[(+x.n || 0) - 1]; if (!s || !x.guide) continue;
      const w = normSite(Object.assign({}, s, x), 0), keep = { guide: w.guide, lookFor: w.lookFor, photoTip: w.photoTip, picks: w.picks, hours: w.hours, closed: w.closed, tickets: w.tickets, crowds: w.crowds, cost: w.cost, indoor: w.indoor, access: w.access };
      Object.assign(s, keep); srcWritten[srcWKey(city, s)] = keep; got++;
    }
    if (got) { srcWSave(); save(); if (["plan", "sites", "guide", "tour"].includes(view)) dataRender(); }
  } catch (e) { todo.forEach(s => setTimeout(() => srcAsked.delete(srcWKey(city, s)), 5 * 60000)); }
}
// Two places with look-alike names (St Peter's Basilica and the Basilica of St Paul Outside the Walls) are told
// apart on their cards: each says it is a different place and how far apart they are.
const TWIN_WORD = /\b(basilica|cathedral|church|chiesa|chapel|museum|museo|palace|palazzo|castle|castel|villa|fountain|fontana|gate|porta|tower|bridge|ponte|forum|baths|temple|monastery|abbey)\b/i;
const TWIN_REL = /\b(outside|inside|within|beyond|fuori|dentro|extramuros|intramuros)\b/i;
const twinSaint = n => ((/\b(?:st\.?|saint|san|santa|sant'?|santo|são|sankt)\s+([a-z]+)/i.exec(n) || [])[1] || "").toLowerCase();
// The famous place a look-alike name could be mistaken for: a "St Paul Outside the Walls" next to the city's best
// known basilica, or two churches of the same saint.
function twinOf(s, city) {
  const w = (TWIN_WORD.exec(s.name) || [])[1]; if (!w || !isFinite(s.lat)) return null;
  const lw = w.toLowerCase(), rel = TWIN_REL.test(s.name), sn = twinSaint(s.name);
  const c = allSites(city).filter(x => x !== s && isFinite(x.lat) && hav(x, s) > 0.3 && x.name.toLowerCase().includes(lw) && ((rel && !TWIN_REL.test(x.name) && (x.mustSee || (x.fame || 0) >= 60)) || (sn && twinSaint(x.name) === sn)));
  return c.sort((a, b) => (b.mustSee ? 1 : 0) - (a.mustSee ? 1 : 0) || (b.fame || 0) - (a.fame || 0))[0] || null;
}
function twinNote(s, city) {
  if (!city) return "";
  let t = twinOf(s, city);
  if (!t) { const back = allSites(city).filter(x => x !== s && TWIN_REL.test(x.name) && twinOf(x, city) === s).sort((a, b) => (b.fame || 0) - (a.fame || 0)); t = back[0] || null; }
  return t ? `<p class="travelnote">Not the same place as ${esc(t.name)}: a separate visit, ${esc(distTxt(hav(t, s), true))} away.</p>` : "";
}
if (typeof window !== "undefined") {
  // Test hook (safety net): a city's sights list grown from a snapshot of its sources, with no network and no AI.
  // fix = { destination, cityKey?, famous, sources, bench?: [names a free chatbot lists] }.
  window.__kairouteSrcCheck = fix => {
    ensureBuiltins();
    const base = fix.cityKey && cities[fix.cityKey] ? JSON.parse(JSON.stringify(cities[fix.cityKey])) : { city: fix.sources.area, country: "", sites: [], farther: [], starts: {}, restaurants: [] };
    const before = { main: (base.sites || []).filter(x => !x.quick).length, quick: (base.sites || []).filter(x => x.quick).length, far: (base.farther || []).length };
    const c = base; const base0 = allSites(base).slice(); const lbl = srcLabel(c, { destination: fix.destination });
    const added = sourceSights(c, fix.sources), gone = dedupeSites(c);
    const all = allSites(c), dup = [];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (placeRel(all[i], all[j]) === "same") dup.push(all[i].name + " = " + all[j].name);
    const centre = srcCentre(c, fix.sources), min = srcCoverageMin(fix.sources, centre);
    const has = alt => alt.split("|").map(n => all.find(s => nameMatch(n, s.name) || nameMatch(s.name, n) || (s.local && nameMatch(n, s.local)))).find(Boolean); // "A|B": either name
    const bench = (fix.bench || []).map(n => ({ n, hit: has(n) ? has(n).name : "" }));
    const twins = all.map(s => ({ s: s.name, note: twinNote(s, c).replace(/<[^>]+>/g, "") })).filter(x => x.note);
    const noSrc = all.filter(s => s.srcOnly && !(s.src && s.src.length)).map(s => s.name);
    // Names still in the local language: a lesser sight from the sources whose name says what it is in Italian,
    // Spanish, French or Portuguese ("Palazzo Zanca") must be shown in English (famous names keep theirs).
    const foreign = all.filter(s => s.srcOnly && (s.fame || 0) < EN_FAME && EN_FOREIGN.test(s.name)).map(s => s.name + (enNameOf(s.name, s.category, s.local) ? " (rules know it)" : ""));
    const why = fix.why ? fix.sources.stops.filter(x => srcVisitable(x) && (x.src || []).length >= 2).map(x => { const h = base0.find(y => sameSight(x, y) || placeRel(x, y) || placeRel(y, x)); return x.name + " -> " + (allSites(c).some(y => y.name === x.name) ? "added" : h ? (sameSight(x, h) ? "same-name " : "rel " + (placeRel(x, h) || placeRel(h, x)) + " ") + h.name : "?"); }) : [];
    return { added, gone, why, label: lbl, before, after: { main: c.sites.filter(x => !x.quick).length, quick: c.sites.filter(x => x.quick).length, far: (c.farther || []).length }, min, dup, bench, twins, noSrc, foreign,
      far: (c.farther || []).map(x => x.name), names: c.sites.filter(x => !x.quick).map(x => x.name) };
  };
}
if (typeof window !== "undefined") {
  // Test hook: hand the app a snapshot of a city's sources, as if the helper had answered.
  window.__kairouteSeedSources = (label, fam, src) => { if (fam) famousCache[label] = fam; if (src) sourcesCache[label] = src; Object.keys(fameAsked).forEach(k => delete fameAsked[k]); return true; };
}
// Test hook: the sight rules, for the checks (tools/beta2/flow-check.cjs and debugging).
if (typeof window !== "undefined") window.__kairouteSrcRules = () => ({ srcWorthy, srcFamed, srcNotSpot, srcPartOf, sameSight, placeRel, hav, srcCentre, srcKind });
