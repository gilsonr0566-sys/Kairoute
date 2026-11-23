// Beta 2 engine, part 0: shared helpers. Every engine file adds to one namespace, KEngine, and touches nothing else:
// no page, no storage, no internet, no app state. The same files load in the app and in Node (tools/beta2/engine.cjs).
var KEngine = typeof KEngine !== "undefined" ? KEngine : {};
(function (E) {
  const R = x => x * Math.PI / 180;
  // Straight-line km between two places.
  E.hav = (a, b) => { const dLa = (b.lat - a.lat) * Math.PI / 180, dLo = (b.lng - a.lng) * Math.PI / 180;
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLo / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(h)); };
  // Things near a point, from a list of positioned things (Nov 23 phone feel test: the "Needs" box took 2.5 s, most of
  // it a scan of every mapped place to eat for every restaurant). One rule for every lookup by position in a data list:
  // the list is put in a grid of cells once (kept with the list itself, so a list that never changes is indexed once
  // while the app runs) and a lookup reads only the cells around the point. The answer is exactly the scan's: every
  // thing within km, in list order. pos(x) gives the thing's { lat, lng } (or null).
  const NEAR_CELL = 0.0025, nearIdx = new WeakMap(); // about 280 m of latitude per cell
  E.nearby = (list, pos, pt, km) => {
    if (!Array.isArray(list) || !pt || !isFinite(pt.lat) || !isFinite(pt.lng)) return [];
    let ix = nearIdx.get(list); if (!ix || ix.pos !== pos || ix.n !== list.length) {
      const cells = new Map(); list.forEach((x, i) => { const p = x && pos(x); if (!p || !isFinite(p.lat) || !isFinite(p.lng)) return;
        const k = Math.floor(p.lat / NEAR_CELL) + "," + Math.floor(p.lng / NEAR_CELL); let c = cells.get(k); if (!c) cells.set(k, c = []); c.push(i); });
      ix = { pos, n: list.length, cells }; nearIdx.set(list, ix); }
    const dLat = Math.ceil(km / 111 / NEAR_CELL), dLng = Math.ceil(km / (111 * Math.max(0.05, Math.cos(pt.lat * Math.PI / 180))) / NEAR_CELL);
    const la = Math.floor(pt.lat / NEAR_CELL), lo = Math.floor(pt.lng / NEAR_CELL), hits = [];
    for (let i = la - dLat; i <= la + dLat; i++) for (let j = lo - dLng; j <= lo + dLng; j++) { const c = ix.cells.get(i + "," + j); if (c) hits.push(...c); }
    const bLat = km / 110, bLng = km / (110 * Math.max(0.05, Math.cos(pt.lat * Math.PI / 180))); // a box a little larger than the circle
    return hits.sort((a, b) => a - b).map(i => list[i]).filter(x => { const p = pos(x); return Math.abs(p.lat - pt.lat) <= bLat && Math.abs(p.lng - pt.lng) <= bLng && E.hav(pt, p) <= km; }); };
  // The island a point stands on, from a place file's island outlines (R-06, Nov 23): the smallest outline that holds it
  // (an islet inside a bigger island's outline is the islet), or null on no mapped island. Outlines are flat
  // [lat, lng, lat, lng, ...] rings; each ring's box is worked out once and kept with the ring.
  const ringBox = new WeakMap();
  const boxOf = f => { let b = ringBox.get(f); if (b) return b; b = { s: Infinity, n: -Infinity, w: Infinity, e: -Infinity, a: 0 };
    for (let i = 0, j = f.length - 2; i < f.length; j = i, i += 2) { b.s = Math.min(b.s, f[i]); b.n = Math.max(b.n, f[i]); b.w = Math.min(b.w, f[i + 1]); b.e = Math.max(b.e, f[i + 1]); b.a += (f[j + 1] + f[i + 1]) * (f[j] - f[i]); }
    b.a = Math.abs(b.a / 2); ringBox.set(f, b); return b; };
  E.inRing = (f, lat, lng) => { let inside = false;
    for (let i = 0, j = f.length - 2; i < f.length; j = i, i += 2) { const yi = f[i], xi = f[i + 1], yj = f[j], xj = f[j + 1];
      if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside; }
    return inside; };
  E.islandAt = (shapes, pt) => {
    if (!Array.isArray(shapes) || !pt || !isFinite(+pt.lat) || !isFinite(+pt.lng)) return null;
    const lat = +pt.lat, lng = +pt.lng; let best = null, ba = Infinity;
    for (const s of shapes) for (const f of (s && s.rings) || []) { if (!Array.isArray(f) || f.length < 8) continue; const b = boxOf(f);
      if (lat < b.s || lat > b.n || lng < b.w || lng > b.e || b.a >= ba) continue;
      if (E.inRing(f, lat, lng)) { ba = b.a; best = s; } }
    return best; };
  // "09:30" -> 570. Anything else is NaN, never a guess.
  // A clock time, never with a minus sign: past midnight reads as the next morning's time (Nov 20 review).
  // The app may set its own clock format (24-hour or am/pm, from the traveler's setting); the engine's own text is am/pm.
  E.clockFmt = null;
  E.clockText = m0 => { const m = ((Math.round(m0) % 1440) + 1440) % 1440, h = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0"); return (h % 12 || 12) + ":" + mm + (h >= 12 ? " pm" : " am"); };
  E.clock = m => E.clockFmt ? E.clockFmt(m) : E.clockText(m);
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
  // The place's own name counts too (Nov 22 lunch audit: "Coffee Shop Vittoria", "Bar tabacchi Pappagone", "Muräne Café Bar
  // Events" and a sherry bar were planned as lunch because the map gave no kind): a name that says drinks, coffee or a
  // treat, and no meal, is not a lunch place.
  const DRINKS = /\b(coffee|espresso|tabacchi|tabaccheria|sherry|wine ?bar|sherry ?bar|beer ?garden|brewery taproom|cocktails?|lounge|events|tea ?room|juice|smoothie|gelateria|pasticceria|bakery|patisserie|ice ?cream|donuts?|doughnuts?)\b/i;
  E.mealPlace = r => { const said = r.cuisine ? String(r.cuisine) + " " + String(r.amenity || "") : [r.kind, r.amenity, r.why].filter(Boolean).join(" "), nm = String(r.name || "");
    if (DRINKS.test(nm + " " + String(r.cuisine || "")) && !MEAL.test(nm + " " + String(r.cuisine || ""))) return false;
    return !(TREAT.test(said) || /^(cafe|ice_cream|bakery|confectionery|pastry)$/i.test(String(r.amenity || r.kind || ""))) || MEAL.test(String(r.cuisine || "") + " " + String(r.amenity || "")); };
  // A café or bar by name may serve a light lunch, but a restaurant nearby is the better lunch: the lunch search counts a
  // café as farther away than it is.
  E.cafeName = r => /\b(caf[eéè]s?|caff[eèé]|kafe|kafeneio|bar)\b/i.test(String((r && r.name) || "")) && !MEAL.test(String((r && r.name) || "") + " " + String((r && r.cuisine) || ""));
  // A name in Greek or Cyrillic letters, written in Latin letters by the standard fixed rules (Greek: ELOT 743, as on
  // Greek road and station signs; Cyrillic: the common English spelling), so a traveler reading English can read it
  // and match it to the signs ("Ζευγολατιό" is "Zevgolatio"). Names already in Latin letters pass through as they are.
  const GR2 = { "αι": "ai", "ει": "ei", "οι": "oi", "ου": "ou", "μπ": "b", "ντ": "nt", "γκ": "gk", "γγ": "ng", "τσ": "ts", "τζ": "tz" };
  const GRV = { "αυ": "a", "ευ": "e", "ηυ": "i" };
  const GR1 = { α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o" };
  const CY = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", і: "i", ї: "yi", є: "ye", ґ: "g", ј: "j", љ: "lj", њ: "nj", ћ: "c", ђ: "dj", џ: "dz" };
  const latinMemo = new Map();
  // A place as the traveler typed it, without what they added in brackets ("Port (City), Country" -> "Port,
  // Country"), never a space left before the comma (Round 1: "Cruise port of Port , Country" found nothing, 6 port days
  // lost to one text bug).
  E.bareName = s => String(s || "").replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+([,;.])/g, "$1").replace(/,\s*,/g, ",").replace(/\s+/g, " ").replace(/^[\s,]+|[\s,]+$/g, "").trim();
  // The place alone, without the country or region after the first comma ("City, Country" -> "City").
  E.placeOnly = s => E.bareName(s).split(",")[0].trim();
  // What the traveler put in brackets after a port: the place they mean to see from it ("Port (Site)" -> "Site").
  E.bracketPlace = s => { const m = String(s || "").match(/\(([^)]+)\)/); return m ? m[1].trim() : ""; };
  // Japanese kana, read as written (Hepburn): station and shop names are often in kana alone. Kanji have no reading
  // without a dictionary, so they are left to E.say's plain word (round 2 outside test, Nov 23: Japanese station and lunch names).
  const KANA = {}; ("a i u e o ka ki ku ke ko sa shi su se so ta chi tsu te to na ni nu ne no ha hi fu he ho ma mi mu me mo ya - yu - yo ra ri ru re ro wa wi - we wo").split(" ")
    .forEach((r, i) => { if (r !== "-") { KANA["あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもや_ゆ_よらりるれろわゐ_ゑを"[i]] = r; KANA["アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤ_ユ_ヨラリルレロワヰ_ヱヲ"[i]] = r; } });
  Object.assign(KANA, { ん: "n", ン: "n", が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go", ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo", だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do", ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo", ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
    ガ: "ga", ギ: "gi", グ: "gu", ゲ: "ge", ゴ: "go", ザ: "za", ジ: "ji", ズ: "zu", ゼ: "ze", ゾ: "zo", ダ: "da", ヂ: "ji", ヅ: "zu", デ: "de", ド: "do", バ: "ba", ビ: "bi", ブ: "bu", ベ: "be", ボ: "bo", パ: "pa", ピ: "pi", プ: "pu", ペ: "pe", ポ: "po", ヴ: "vu", "・": " ", "ー": "-" });
  const SMALL = { ゃ: "ya", ゅ: "yu", ょ: "yo", ャ: "ya", ュ: "yu", ョ: "yo", ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o", ァ: "a", ィ: "i", ゥ: "u", ェ: "e", ォ: "o" };
  const kanaOf = s => { let out = "";
    for (let k = 0; k < s.length; k++) { const c = s[k], nx = s[k + 1];
      if (c === "っ" || c === "ッ") { const r = KANA[nx]; out += r ? r[0] : ""; continue; }
      if (c === "ー") { out += out.slice(-1); continue; }
      const r = KANA[c]; if (r == null) { out += c; continue; }
      if (nx && SMALL[nx]) { const y = SMALL[nx]; out += /^(shi|chi|ji)$/.test(r) ? r.slice(0, -1) + (y.length > 1 ? y.slice(1) : y) : /[aiueo]$/.test(r) && r.length > 1 ? r.slice(0, -1) + y : r + y; k++; continue; }
      out += r; }
    // Long vowels as English maps write them: Tokyo, Kyoto, ramen.
    return out.replace(/ou|oo/g, "o").replace(/uu/g, "u").replace(/aa/g, "a").replace(/ee/g, "e").replace(/(^|\s)([a-z])/g, (m, a, b) => a + b.toUpperCase()); };
  E.latin = name => {
    const s0 = String(name == null ? "" : name); if (!/[\u0370-\u03ff\u1f00-\u1fff\u0400-\u04ff\u3040-\u30ff]/.test(s0)) return s0;
    const got = latinMemo.get(s0); if (got != null) return got; const r = latinOf(s0); if (latinMemo.size < 5000) latinMemo.set(s0, r); return r;
  };
  const latinOf = s1 => {
    const s0 = /[\u3040-\u30ff]/.test(s1) ? kanaOf(s1) : s1;
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
  // A name or line of words the traveler can read: Greek, Cyrillic and kana put into Latin letters; anything still in
  // another script (Hebrew, Arabic, kanji, Thai...) is never shown. A name gives way to the plain word given ("the stop",
  // "Train"); in a sentence, the name after "to", "from" or "at" becomes "the stop", after "take" or "ride" "the line", and
  // any other is left out (round 2 outside test, Nov 23: Hebrew train lines, Japanese station names).
  const OTHER = /[^\u0000-\u024F\u1E00-\u1EFF\u2000-\u206F\u20A0-\u20CF]/;
  E.say = (name, plain) => { const t = E.latin(name); if (!OTHER.test(t)) return t;
    if (plain != null) { const left = t.replace(/[^\u0000-\u024F\u1E00-\u1EFF]+/g, " ").replace(/[()\[\]\-–,·:]+\s*$/g, "").replace(/\(\s*\)/g, "").replace(/\s+/g, " ").trim(); return /[A-Za-z]{3}/.test(left) ? left : plain; }
    return t.replace(/(\b(?:to|from|at|towards|via|for|into)\s+)?([^\u0000-\u024F\u1E00-\u1EFF\s][^\u0000-\u024F\u1E00-\u1EFF]*(?:\s+[^\u0000-\u024F\u1E00-\u1EFF\s][^\u0000-\u024F\u1E00-\u1EFF]*)*)/gi,
      (m, pre, run, at, all) => { const b = all.slice(0, at); return pre ? pre + "the stop" : /\b(take|ride|board|catch)\s+the\s+$/i.test(b) ? "line" : /\b(take|ride|board|catch)\s+$/i.test(b) ? "the line" : ""; })
      .replace(/the stop (station|stop|pier)\b/gi, "the $1").replace(/\(\s*\)/g, "").replace(/\s+([,.;)])/g, "$1").replace(/\s{2,}/g, " ").trim(); };
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
