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
  // A name in Greek or Cyrillic letters, written in Latin letters by the standard fixed rules (Greek: ELOT 743, as on
  // Greek road and station signs; Cyrillic: the common English spelling), so a traveler reading English can read it
  // and match it to the signs ("Ζευγολατιό" is "Zevgolatio"). Names already in Latin letters pass through as they are.
  const GR2 = { "αι": "ai", "ει": "ei", "οι": "oi", "ου": "ou", "μπ": "b", "ντ": "nt", "γκ": "gk", "γγ": "ng", "τσ": "ts", "τζ": "tz" };
  const GRV = { "αυ": "a", "ευ": "e", "ηυ": "i" };
  const GR1 = { α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o" };
  const CY = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", і: "i", ї: "yi", є: "ye", ґ: "g", ј: "j", љ: "lj", њ: "nj", ћ: "c", ђ: "dj", џ: "dz" };
  const latinMemo = new Map();
  E.latin = name => {
    const s0 = String(name == null ? "" : name); if (!/[\u0370-\u03ff\u1f00-\u1fff\u0400-\u04ff]/.test(s0)) return s0;
    const got = latinMemo.get(s0); if (got != null) return got; const r = latinOf(s0); if (latinMemo.size < 5000) latinMemo.set(s0, r); return r;
  };
  const latinOf = s0 => {
    const s = s0.normalize("NFD").replace(/[\u0300-\u036f]/g, "").normalize("NFC");
    let out = "";
    for (let k = 0; k < s.length;) {
      const c = s[k], lo = c.toLowerCase(), two = (lo + (s[k + 1] || "")).toLowerCase(), up = c !== lo;
      let r = null, n = 1;
      if (GRV[two] != null) { const nx = (s[k + 2] || "").toLowerCase(); r = GRV[two] + (/[αεηιοωυβγδζλμνρ]/.test(nx) ? "v" : "f"); n = 2; }
      else if (GR2[two] != null) { r = GR2[two]; n = 2; if (two === "μπ" && k > 0 && /[α-ω]/i.test(s[k - 1])) r = "mp"; }
      else if (GR1[lo] != null) r = GR1[lo]; else if (CY[lo] != null) r = CY[lo]; else r = c;
      if (up && r) r = r[0].toUpperCase() + r.slice(1);
      out += r; k += n;
    }
    return out;
  };
  E.PAD_MAX = 45; // longest ride each way for a trip out added to fill a day in town // lunch on the go: bought and eaten on the way, minutes
  // A meal starts at most this long after its last orders (Nov 20 phone check: lunch at 3:47 pm after a day trip counted as
  // lunch). The leak report's "odd hour" is the same line.
  E.MEAL_LATE = 60;
  E.MEALS = Object.freeze([
    Object.freeze({ label: "Lunch", from: 11 * 60 + 45, to: 14 * 60 + 30, len: 60, quick: 35 }),
    Object.freeze({ label: "Dinner", from: 18 * 60 + 30, to: 21 * 60, len: 75, quick: 45 })
  ]);
  // An engine error is never swallowed: it names the day and the reason, and tests fail on it.
  E.fail = (why, extra) => Object.assign({ error: why }, extra || {});
})(KEngine);
if (typeof module !== "undefined") module.exports = KEngine;
