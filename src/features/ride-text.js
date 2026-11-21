// ---------- Ride directions people can read (Richard, Nov 14: Athens airport metro) ----------
// Timetable answers come with stop names as the operator writes them (ΕΛ. ΒΕΝΙΖΕΛΟΣ, ΣΥΝΤΑΓΜΑ), the operator's legal
// name on every line ("Metro M3 (Urban Rail Transport S.A.)") and one leg per train even when you stay on the same
// line. For every city: stop names in Latin letters, no operator names, and back-to-back legs on one line made one.
const RT_GR = { α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o" };
const RT_CY = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya" };
function latinName(s) {
  s = String(s || "").trim(); if (!s) return s;
  if (/[Ͱ-Ͽἀ-῿Ѐ-ӿ]/.test(s)) {
    let t = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    t = t.replace(/ου/g, "ou").replace(/αυ/g, "av").replace(/ευ/g, "ev").replace(/αι/g, "ai").replace(/ει/g, "ei").replace(/οι/g, "oi").replace(/(^|\s)μπ/g, "$1b").replace(/(^|\s)ντ/g, "$1d").replace(/γγ/g, "ng");
    t = [...t].map(c => RT_GR[c] != null ? RT_GR[c] : RT_CY[c] != null ? RT_CY[c] : c).join("");
    return t.replace(/(^|[\s.\-(/])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  }
  // ALL CAPITALS in Latin letters (TERMINI) reads as shouting: Termini.
  return s.length > 3 && s === s.toUpperCase() && /[A-Z]{3}/.test(s) ? s.toLowerCase().replace(/(^|[\s.\-(/])([a-z])/g, (m, a, b) => a + b.toUpperCase()) : s;
}
// "Metro M3 (Urban Rail Transport S.A.)" -> "Metro M3". A line with no number of its own keeps the operator, which is
// then its name ("Train (Circumvesuviana)"), without the legal ending.
// A line known only by a name in another script and no number ("Ferry Οία - Παλιό Λιμάνι Φηρών") is shown by its kind
// alone ("Ferry"): its stops, in Latin letters, already say where it goes.
function lineOnly(s) { const b = lineBare(s), rest = b.replace(/^\S+\s*/, "");
  return /[Ͱ-Ͽἀ-῿Ѐ-ӿ]/.test(rest) && !/\d/.test(rest) && /^\p{L}+$/u.test(b.split(/\s/)[0]) ? b.split(/\s/)[0] : latinName(b); }
function lineBare(s) {
  s = String(s || ""); const bare = s.replace(/\s*\([^)]*\)/g, "").trim();
  if (/\d|\b[A-Z]{1,3}\b/.test(bare.replace(/^\S+\s*/, ""))) return bare;
  return s.replace(/\(([^)]*)\)/g, (m, a) => "(" + a.replace(/\b(S\.?A\.?|S\.?p\.?A\.?|s\.?r\.?l\.?|Ltd\.?|GmbH|Inc\.?|plc)\b\.?/gi, "").replace(/\s+/g, " ").trim() + ")").replace(/\(\)/g, "").trim();
}
const rtMemo = new WeakMap();
function tidyRide(o) {
  if (!o || typeof o !== "object") return o; const had = rtMemo.get(o); if (had) return had;
  const r = Object.assign({}, o, { rawLabel: o.rawLabel || o.label });
  if (r.from) r.from = latinName(r.from); if (r.to) r.to = latinName(r.to);
  let legs = null;
  if (Array.isArray(o.steps) && o.steps.length) {
    const parsed = o.steps.map(s => { const m = /^(.+?): (.+) to (.+), (\d+) min$/.exec(String(s)); return m ? { line: lineOnly(m[1]), raw: m[1], from: latinName(m[2]), to: latinName(m[3]), min: +m[4] } : null; });
    if (parsed.every(Boolean)) {
      legs = []; for (const p of parsed) { const last = legs[legs.length - 1]; if (last && last.raw === p.raw) { last.to = p.to; last.min += p.min; } else legs.push(Object.assign({}, p)); }
      r.steps = legs.map((l, i) => i ? `change to ${l.line}: ${l.from} to ${l.to}, ${l.min} min` : `${l.line}: ${l.from} to ${l.to}, ${l.min} min`);
    } else r.steps = o.steps.map(s => lineOnly(s));
  }
  if (r.label) { const base = lineOnly(String(r.label).replace(/\s*\+\s*\d+\s+changes?$/, "")); const ch = legs ? legs.length - 1 : (/\+\s*(\d+)\s+change/.exec(r.label) || [0, 0])[1] | 0; r.label = base + (ch > 0 ? ` + ${ch} change${ch > 1 ? "s" : ""}` : ""); }
  rtMemo.set(o, r); return r;
}
if (typeof window !== "undefined") window.__kairouteTidyRide = o => tidyRide(o);
