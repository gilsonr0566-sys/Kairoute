// Beta 2 engine, part 0: shared helpers. Every engine file adds to one namespace, KEngine, and touches nothing else:
// no page, no storage, no internet, no app state. The same files load in the app and in Node (tools/beta2/engine.cjs).
var KEngine = typeof KEngine !== "undefined" ? KEngine : {};
(function (E) {
  const R = x => x * Math.PI / 180;
  // Straight-line km between two places.
  E.hav = (a, b) => { const dLa = R(b.lat - a.lat), dLo = R(b.lng - a.lng);
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(R(a.lat)) * Math.cos(R(b.lat)) * Math.sin(dLo / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(h)); };
  // "09:30" -> 570. Anything else is NaN, never a guess.
  E.clock = m => { const h = Math.floor(m / 60), mm = String(Math.round(m % 60)).padStart(2, "0"); return (h % 12 || 12) + ":" + mm + (h >= 12 && h < 24 ? " pm" : " am"); };
  E.toMin = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || "").trim()); return m ? +m[1] * 60 + +m[2] : NaN; };
  // The key two places share for a traveler's ride choice (the app's own pairKey, so saved choices still apply).
  const pk = p => (+p.lat).toFixed(3) + "," + (+p.lng).toFixed(3);
  E.pairKey = (a, b) => pk(a) + "," + pk(b);
  // A fixed, input-order-free tie-break: by id, then name. Used wherever two choices are otherwise equal.
  E.byId = (a, b) => String(a.id || "").localeCompare(String(b.id || "")) || String(a.name || "").localeCompare(String(b.name || ""));
  E.TO_GO = 20;
  // A lunch or dinner stop serves a meal: a place known for a treat (doughnuts, ice cream, pastries, chocolate, coffee)
  // is a snack on the way, never the day's lunch or dinner. Read from what the guide says it serves, in any guide.
  const TREAT = /\b(doughnuts?|donuts?|loukoumades|ice ?cream|gelat[oi]|dessert|pastr(y|ies)|patisserie|bakery|cakes?|chocolate|crepes?|waffles?|coffee|espresso|tea ?room|juice|smoothie|sweets?|confection|treat)\b/i;
  const MEAL = /\b(taverna|restaurant|trattoria|osteria|bistro|brasserie|grill|meze|mezze|kitchen|dining|seafood|steak|pizza|pasta|tapas|lunch|dinner)\b/i;
  E.mealPlace = r => { const said = r.cuisine ? String(r.cuisine) + " " + String(r.amenity || "") : [r.kind, r.amenity, r.why].filter(Boolean).join(" "); return !(TREAT.test(said) || /^(cafe|ice_cream|bakery|confectionery|pastry)$/i.test(String(r.amenity || r.kind || ""))) || MEAL.test(String(r.cuisine || "") + " " + String(r.amenity || "")); };
  E.PAD_MAX = 45; // longest ride each way for a trip out added to fill a day in town // lunch on the go: bought and eaten on the way, minutes
  E.MEALS = Object.freeze([
    Object.freeze({ label: "Lunch", from: 11 * 60 + 45, to: 14 * 60 + 30, len: 60, quick: 35 }),
    Object.freeze({ label: "Dinner", from: 18 * 60 + 30, to: 21 * 60, len: 75, quick: 45 })
  ]);
  // An engine error is never swallowed: it names the day and the reason, and tests fail on it.
  E.fail = (why, extra) => Object.assign({ error: why }, extra || {});
})(KEngine);
if (typeof module !== "undefined") module.exports = KEngine;
