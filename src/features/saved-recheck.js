// ===================== Saved content is checked again every time it is opened (Rule R-30, Nov 24) =====================
// Class: content made and saved before a rule existed (a guide the AI wrote before it was turned off, a guide copied
// over from the first app, day trips and famous places the AI filled in, notes a day kept from older code) went
// straight to the screen, past every check made since. The Bastille stayed "standing" from a kept answer (R-29, the
// helper's side); this is the same class on the device's side.
// Rule: every saved city and day passes through recheckSaved() each time the app opens it (at start-up, when a guide
// comes from the helper's shared store, when kept fills come back). Facts the AI wrote are not a source: a fact with no
// checked source is removed (the screen then says nothing or "not confirmed", never the old claim), and AI-written
// stories carry a "not confirmed" mark. Places stay only where they are real places (the map or Wikidata confirmed them).
// Checked by tools/beta2/saved-recheck.cjs (gate, part 3): old saved trips, AI-era ones included, opened in the built
// app; 0 unchecked items may reach the screen.
// AI-made: a guide the AI wrote (city.ai, not built in), or a place the AI filled in (famousFix without noAI).
// Places from the sources, the map or a traveler's own add are not AI-made.
function aiMadeSight(s, city) {
  if (!s) return false;
  if (s.srcOnly || s.fromPlaces || s.fromGuide || s.fromSources || s.noAI || s.builtinCopy) return false;
  if (s.famousFix) return true;
  return !!(city && city.ai && !city.builtin);
}
// Facts the screen states as facts. Written by the AI with no source, so removed (the planner then reads them as
// unknown, the way the "I don't know" rule asks). Travel stays for the planner's boat and island check (a ferry
// trip must never be planned as a drive) but is marked, so it is never shown as a checked fact.
// (Plain values inside the function: start-up calls it before this file's top-level constants exist.)
function recheckSight(s, city) {
  if (!aiMadeSight(s, city)) return s;
  const RECHECK_FACTS = ["hours", "closed", "tickets", "crowds", "priceNote", "access", "cost"], NC_TRAVEL = "Not confirmed: ";
  const RECHECK_STORY = ["summary", "guide", "lookFor", "picks", "photoTip", "travelerTip"];
  for (const k of RECHECK_FACTS) if (k === "cost") s.cost = 0; else if (k in s) s[k] = "";
  if (typeof s.travel === "string" && s.travel.trim() && s.travel.indexOf(NC_TRAVEL) !== 0) s.travel = NC_TRAVEL + s.travel.trim();
  if (RECHECK_STORY.some(k => Array.isArray(s[k]) ? s[k].length : typeof s[k] === "string" && s[k].trim())) s.notConfirmed = true;
  // The mark travels with the words, so every screen and the voice that use them say it: the short description and the
  // story keep their words behind "Not confirmed"; the small claims (what to look for, tips, photo spots) go.
  for (const k of ["summary", "guide"]) if (typeof s[k] === "string" && s[k].trim() && !/^Not confirmed/.test(s[k])) s[k] = (k === "guide" ? "Not confirmed, from an earlier AI guide: " : "Not confirmed: ") + s[k].trim();
  s.lookFor = []; s.picks = []; s.photoTip = ""; s.travelerTip = "";
  return s;
}
// A whole saved city. Returns null when nothing in it can be trusted (an AI guide whose places were never checked on
// the map), so the caller drops it and the day gets a guide from the sources instead.
function recheckSaved(city) {
  if (!city || typeof city !== "object") return city;
  const aiCity = !!(city.ai && !city.builtin);
  if (aiCity && !city.grounded) return null;
  for (const k of ["sites", "farther"]) if (Array.isArray(city[k])) city[k] = city[k].filter(s => s && s.name && KEngine.fin(s.lat) && KEngine.fin(s.lng)).map(s => recheckSight(s, city));
  if (aiCity) {
    // Places to eat: only places on the map; the AI's ranking, style and price band are not a source.
    if (Array.isArray(city.restaurants)) city.restaurants = city.restaurants.filter(r => r && r.onMap).map(r => Object.assign(r, { top: false, style: "", price: "" }));
    // City basics the AI wrote (tipping, safety, emergency numbers, plugs, water, phrases, getting-around tips).
    if (city.basics) { for (const k of ["tipping", "safety", "emergency", "plugs", "water"]) city.basics[k] = ""; city.basics.phrases = []; }
    city.gettingAround = [];
  }
  // Names (R-11): a guide saved before the names rule, copied from the first app or holding a place added from the map
  // keeps its names as they came. Every sight's name passes the planner's one names pass each time the guide is opened
  // (English name, else Latin letters, else "Local sight"); the name as it came is kept for matching the sources again.
  if (typeof KEngine !== "undefined" && KEngine.namesIn && KEngine.otherScript && window.__kairoutePlant !== "names-in-off" && window.__kairoutePlant !== "names-off") {
    for (const k of ["sites", "farther"]) for (const s of city[k] || []) if (s && typeof s.name === "string" && KEngine.otherScript(s.name)) { if (!s.srcName) s.srcName = s.name; if (!(s.en && !KEngine.otherScript(s.en)) && KEngine.otherScript(KEngine.latin(s.name)) && !/[A-Za-z]{3}/.test(s.name)) s.localOnly = true; }
    KEngine.namesIn({ cities: { c: city } });
  }
  city.rechecked = Date.now();
  return city;
}
// Gate hook: open saved cities and a saved trip the way start-up does, and return what reaches the screen.
if (typeof window !== "undefined") window.__kairouteRecheck = (saved, t) => {
  const out = {};
  for (const k of Object.keys(saved || {})) { const c = recheckSaved(JSON.parse(JSON.stringify(saved[k]))); out[k] = c; }
  return out;
};
