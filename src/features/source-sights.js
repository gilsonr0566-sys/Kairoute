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
const SRC_MAX_MAIN = 45, SRC_MAX_QUICK = 12, SRC_R = 8;
// Entries that are not one place to visit: a whole city or country, a district, transport, institutions.
const SRC_NEVER = /\b(city|district|business area|ministerios|rione|quartiere|municipality|province|region|metro|subway|railway|station|airport|line|radio|embassy|bank|ministry|school|hospital|programme|organization|organisation)\b/i;
const SRC_UNLESS_LISTED = /\b(stadium|stadio|estadio|university|universit[àa]|academy|parliament)\b/i; // a listed monument (Panathenaic Stadium) is a sight
const srcNotSpot = x => SRC_NEVER.test(x.name) || (SRC_UNLESS_LISTED.test(x.name) && !x.heritage && !x.unesco);
// What kind of stop a name describes: a typical visit length, a category and whether it is a walk-past stop.
const SRC_KINDS = [
  [/museum|museo|musei|museu|mus[ée]e|gallery|galleria|galer[ií]a|pinacoteca|collection/i, "Museum", 90],
  [/basilica|cathedral|duomo|cattedrale|catedral|church|chiesa|iglesia|esgl[ée]sia|chapel|cappella|oratory|monastery|convent|abbey|mosque|synagogue|temple of [A-Z]?|tempio/i, "Church", 30],
  [/catacomb/i, "Catacombs", 60],
  [/forum|foro|baths|terme|thermae|circus|circo|mausoleum|mausoleo|tomb|tomba|amphitheat|theatre of|teatro di|ancient|archaeolog|acropolis|agora|ruins|domus|villa of|stadium of/i, "Ancient site", 60],
  [/palace|palazzo|palacio|palau|castle|castel|castillo|fortress|fort |citadel|villa/i, "Palace", 50],
  [/park|garden|giardino|jard[ií]n|parque|parco|botanic/i, "Park or garden", 40],
  [/square|piazza|plaza|pla[çc]a|platz|place /i, "Square", 15],
  [/fountain|fontana|fuente|font |statue|column|colonna|obelisk|obelisco|bridge|ponte|puente|pont |gate|porta|puerta|arch of|arco di|arco de|stairs|steps|scalinata|keyhole|monument to/i, "Landmark", 10]
];
// Kind from the English and local names ("San Luigi dei Francesi" is "Chiesa di San Luigi dei Francesi" locally).
const srcKind = (name, local) => { const t = name + " " + (local || ""); return SRC_KINDS.find(k => k[0].test(t)) || (/^(san|santa|sant'|santo|saint|st\.?|são|santi|santissim)\b/i.test(name) ? SRC_KINDS[1] : [null, "Sight", 40]); };
const srcQuick = (name, local) => srcKind(name, local)[1] === "Landmark";
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
  return `${x.unesco ? "A World Heritage " : x.heritage ? "A listed historic " : "A "}${kind} in ${area}${x.local && x.local !== x.name ? ` (${x.local})` : ""}, named by ${x.src.length} independent sources.`;
}
const srcVisitable = x => x && x.lat != null && (x.src || []).some(t => /Wikivoyage|heritage|UNESCO/.test(t));
// The quality bar (Richard: "not full for the sake of quantity, quality is the key"): a place joins the list only
// if travelers recommend it (a Wikivoyage listing, English or local), it is World Heritage, or it is a listed monument
// that 40+ Wikipedia languages write about (Rome's Santa Maria Maggiore), AND it is well known
// (written about in 15+ Wikipedia languages) or several independent sources agree (3+). A minor church on the
// heritage register alone, an office district or a government building doesn't make it.
const srcWorthy = x => srcVisitable(x) && (x.unesco || (x.heritage && (x.sl || 0) >= 40) || (x.src || []).some(t => /Wikivoyage/.test(t))) && ((x.sl || 0) >= 15 || (x.src || []).length >= 3) && !srcNotSpot(x);
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
  const r = srcReach(s); if (!r || x.lat == null || !isFinite(s.lat) || hav(x, s) > r || (x.sl || 0) >= srcFame(s, src)) return false;
  // A museum, church or palace across from a park or on a square is its own visit; inside a castle's or an
  // ancient site's grounds it is part of that visit.
  return !/^(Museum|Church|Palace|Catacombs)$/.test(srcKind(x.name, x.local)[1]) || SRC_GROUNDS.test((s.category || "") + " " + s.name);
};
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
  const centre = srcCentre(city, src); if (!centre) return 0;
  const area = String(src.area || city.city).replace(/\s*\(.*\)/, "");
  const all = allSites(city), mainN = () => (city.sites || []).filter(x => !x.quick).length, quickN = () => (city.sites || []).filter(x => x.quick).length;
  const score = x => (x.sl || 0) + 8 * (x.src || []).length + (x.unesco ? 30 : x.heritage ? 5 : 0);
  const cands = src.stops.filter(x => srcWorthy(x) && (x.src || []).length >= 2 && x.name && keyOf(x.name) !== keyOf(area) && hav(x, centre) <= SRC_R)
    .sort((a, b) => score(b) - score(a));
  let n = 0;
  const make = (x, extra) => {
    const [, cat, min] = srcKind(x.name, x.local), q = !extra.far && srcQuick(x.name, x.local);
    const st = normSite({ id: "src-" + (x.wd || keyOf(x.name).replace(/ /g, "-")), name: x.name, lat: x.lat, lng: x.lng, minutes: q ? 10 : min, category: cat, summary: srcSummary(x, cat, area), web: x.web, kind: "touristy", quick: q }, 0);
    Object.assign(st, { srcOnly: true, fame: x.sl || 0, unesco: !!x.unesco, heritage: !!x.heritage, src: x.src || [], local: x.local, wd: x.wd }, extra);
    const w = srcWritten[srcWKey(city, st)]; if (w) Object.assign(st, w);
    return st;
  };
  for (const x of cands) {
    if (srcHas(allSites(city), x, area, src)) continue;
    const q = srcQuick(x.name, x.local);
    if (q ? quickN() >= SRC_MAX_QUICK + 5 : mainN() >= SRC_MAX_MAIN) continue;
    city.sites.push(make(x, {})); n++;
  }
  if (n) { try { console.info(`Kairoute added ${n} sights from the sources for ${city.city}`); } catch (e) {} }
  return n;
}
// How many sights a city should offer, from how many real visitable places its sources agree on: a big city
// (Rome, Paris, Athens, Barcelona, Madrid) at least 30 worthwhile ones, a smaller one most of what its sources know.
function srcCoverageMin(src, centre) {
  const area = String((src && src.area) || ""), seen = [];
  for (const x of ((src && src.stops) || []).filter(x => srcWorthy(x) && (x.src || []).length >= 2 && (!centre || hav(x, centre) <= SRC_R)).sort((a, b) => (b.sl || 0) - (a.sl || 0)))
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
    if (got) { srcWSave(); save(); if (["plan", "sites", "guide", "tour"].includes(view)) { const y = window.scrollY; render(); window.scrollTo(0, y); } }
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
    const has = n => all.find(s => nameMatch(n, s.name) || nameMatch(s.name, n) || (s.local && nameMatch(n, s.local)));
    const bench = (fix.bench || []).map(n => ({ n, hit: has(n) ? has(n).name : "" }));
    const twins = all.map(s => ({ s: s.name, note: twinNote(s, c).replace(/<[^>]+>/g, "") })).filter(x => x.note);
    const noSrc = all.filter(s => s.srcOnly && !(s.src && s.src.length)).map(s => s.name);
    const why = fix.why ? fix.sources.stops.filter(x => srcVisitable(x) && (x.src || []).length >= 2).map(x => { const h = base0.find(y => sameSight(x, y) || placeRel(x, y) || placeRel(y, x)); return x.name + " -> " + (allSites(c).some(y => y.name === x.name) ? "added" : h ? (sameSight(x, h) ? "same-name " : "rel " + (placeRel(x, h) || placeRel(h, x)) + " ") + h.name : "?"); }) : [];
    return { added, gone, why, label: lbl, before, after: { main: c.sites.filter(x => !x.quick).length, quick: c.sites.filter(x => x.quick).length, far: (c.farther || []).length }, min, dup, bench, twins, noSrc,
      far: (c.farther || []).map(x => x.name), names: c.sites.filter(x => !x.quick).map(x => x.name) };
  };
}
if (typeof window !== "undefined") {
  // Test hook: hand the app a snapshot of a city's sources, as if the helper had answered.
  window.__kairouteSeedSources = (label, fam, src) => { if (fam) famousCache[label] = fam; if (src) sourcesCache[label] = src; Object.keys(fameAsked).forEach(k => delete fameAsked[k]); return true; };
}
