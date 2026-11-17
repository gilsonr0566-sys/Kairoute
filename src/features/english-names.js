// ===================== Sight names in English =====================
// Richard, Nov 17 (Messina): "is that all foreign language". The sources often know a lesser sight only by its
// local name: Wikidata's English label and even English Wikivoyage say "Palazzo Zanca", "Quattro Fontane",
// "Real Cittadella". A traveler reading English should see what the place is, so every sight that comes from the
// sources gets a plain English name, built with fixed rules (no AI, no paid service), and keeps its local name,
// shown in small text, for the signs on the street: "Zanca Palace" (Palazzo Zanca), "Four Fountains",
// "Royal Citadel", "Fort of the Holy Saviour", "Shrine of Our Lady of Montalto".
// Famous places keep the name English speakers already use (Ponte Vecchio, Castel Sant'Angelo, Plaza Mayor):
// only a sight written about in fewer than EN_FAME Wikipedia languages is renamed. A name the rules can't turn
// fully into English (an unknown common word) is left as it is, never half translated.
const EN_FAME = 30;
// Fixed phrases first (religious titles and the like), in Italian, Spanish, Portuguese, French and Catalan.
const EN_PHRASE = [
  [/\bquattro fontane\b/i, "Four Fountains"], [/\bsantissima annunziata\b/i, "Most Holy Annunciation"], [/\bsantissimo salvatore\b/i, "Holy Saviour"],
  [/\bsanti(ssima|sima) trinit[àa]d?(?=\s|$|[,)])/i, "Holy Trinity"], [/\bsant[ií]simo sacramento\b/i, "Blessed Sacrament"], [/\bsantissimo sacramento\b/i, "Blessed Sacrament"],
  [/\bmonte di piet[àa](?=\s|$|[,)])/i, "Mount of Piety"], [/\bmonte de piedad\b/i, "Mount of Piety"], [/\bcristo re\b/i, "Christ the King"], [/\bcristo rey\b/i, "Christ the King"], [/\bsacro cuore\b/i, "Sacred Heart"], [/\bsagrado coraz[oó]n\b/i, "Sacred Heart"],
  [/\bsagrado cora[çc][ãa]o\b/i, "Sacred Heart"], [/\b(madonna|nostra signora|nuestra se[ñn]ora|nossa senhora|mare de d[ée]u)\b/i, "Our Lady"],
  [/\b(santa|sainte|santa) croce\b/i, "Holy Cross"], [/\bsanta cruz\b/i, "Holy Cross"], [/\bspirito santo\b/i, "Holy Spirit"], [/\besp[ií]ritu santo\b/i, "Holy Spirit"]
];
const EN_KNOWN = new Set(EN_PHRASE.flatMap(([, en]) => en.toLowerCase().split(" ")));
// The word that says what the place is, and where English puts it: "pre" (Fort Gonzaga, Church of ...) or "post"
// (Zanca Palace, Marmora Tower).
const EN_HEAD = {};
const enHead = (words, en, pos) => words.split(" ").forEach(w => { EN_HEAD[w] = [en, pos]; });
enHead("palazzo palacio palais palau palácio palacete", "Palace", "post");
enHead("chiesa iglesia église eglise església esglesia igreja", "Church", "pre");
enHead("basilica basílica basilique", "Basilica", "pre");
enHead("cattedrale catedral cathédrale cathedrale duomo concattedrale", "Cathedral", "pre");
enHead("santuario sanctuaire santuari", "Shrine", "pre");
enHead("sacrario", "Memorial Shrine", "pre");
enHead("cappella capilla chapelle capela capella", "Chapel", "pre");
enHead("convento couvent convent", "Convent", "pre");
enHead("monastero monasterio mosteiro monestir", "Monastery", "pre");
enHead("abbazia abadía abadia abbaye", "Abbey", "pre");
enHead("forte fuerte", "Fort", "pre");
enHead("fortezza fortaleza forteresse", "Fortress", "post");
enHead("castello castillo château chateau castelo castell", "Castle", "post");
enHead("cittadella ciudadela citadelle cidadela ciutadella", "Citadel", "post");
enHead("torre", "Tower", "post");
enHead("fontana fuente fontaine", "Fountain", "post");
enHead("fontane fuentes fontaines", "Fountains", "post");
enHead("galleria galería galerie", "Gallery", "post");
enHead("museo musée musee museu", "Museum", "post");
enHead("pinacoteca", "Art Gallery", "post");
enHead("teatro théâtre", "Theatre", "post");
enHead("anfiteatro", "Amphitheatre", "post");
enHead("terme termas thermes", "Baths", "post");
enHead("porta puerta porte", "Gate", "post");
enHead("ponte puente", "Bridge", "post");
enHead("giardino jardín jardim jardí", "Garden", "post");
enHead("giardini jardines jardins", "Gardens", "post");
enHead("parco parque", "Park", "post");
enHead("mercato mercado marché mercat", "Market", "post");
enHead("biblioteca bibliothèque", "Library", "post");
enHead("colonna columna colonne", "Column", "post");
enHead("statua estatua", "Statue", "post");
enHead("monumento", "Monument", "post");
enHead("faro", "Lighthouse", "post");
enHead("cimitero cementerio cimetière cemitério cementiri", "Cemetery", "post");
enHead("arco", "Arch", "post");
enHead("casa", "House", "post");
enHead("orto", "Garden", "post");
// Describing words, which English puts before the place word ("Museo Archeologico Nazionale": National Archaeological Museum).
const EN_ADJ = { real: "Royal", reale: "Royal", regio: "Royal", regia: "Royal", ex: "Former", antiguo: "Old", antigua: "Old", antico: "Ancient", antica: "Ancient", antichi: "Ancient", antiche: "Ancient", vecchio: "Old", vecchia: "Old",
  nuovo: "New", nuova: "New", nuevo: "New", nueva: "New", monumentale: "Monumental", monumental: "Monumental", regionale: "Regional", nazionale: "National", nacional: "National",
  civico: "Civic", civica: "Civic", archeologico: "Archaeological", arqueológico: "Archaeological", archéologique: "Archaeological", botanico: "Botanical", botánico: "Botanical",
  comunale: "Municipal", municipal: "Municipal", municipale: "Municipal", diocesano: "Diocesan", diocesana: "Diocesan", interdisciplinare: "Interdisciplinary",
  maggiore: "Main", mayor: "Main", grande: "Great", gran: "Great", madre: "Mother", senatoria: "Senate", moderna: "Modern", contemporanea: "Contemporary" };
// Common words after "of" ("Palazzo della Cultura": Palace of Culture), with the article English uses.
const EN_WORD = { cultura: "Culture", culture: "Culture", lettera: "the Letter", poveri: "the Poor", pobres: "the Poor", giustizia: "Justice", justicia: "Justice", justice: "Justice",
  città: "the City", ciudad: "the City", cidade: "the City", ville: "the City", mare: "the Sea", mar: "the Sea", mer: "the Sea", pace: "Peace", paz: "Peace", paix: "Peace",
  vittoria: "Victory", victoria: "Victory", popolo: "the People", pueblo: "the People", immacolata: "the Immaculate Conception", inmaculada: "the Immaculate Conception",
  annunziata: "the Annunciation", assunta: "the Assumption", carmine: "Carmel", carmen: "Carmel", consolazione: "Consolation", grazie: "Graces", misericordia: "Mercy",
  arte: "Art", arti: "the Arts", artes: "the Arts", arts: "the Arts", scienza: "Science", scienze: "Sciences", ciencia: "Science", ciencias: "Sciences", storia: "History", historia: "History",
  angeli: "the Angels", ángeles: "the Angels", anges: "the Angels", santi: "the Saints", martiri: "the Martyrs", mártires: "the Martyrs", vergine: "the Virgin", virgen: "the Virgin",
  rosario: "the Rosary", lavoro: "Labour", indipendenza: "Independence", independencia: "Independence", libertà: "Freedom", libertad: "Freedom", liberté: "Freedom",
  cattedrale: "the Cathedral", duomo: "the Cathedral", catedral: "the Cathedral", porto: "the Port", puerto: "the Port", port: "the Port", mercanti: "the Merchants", mercaderes: "the Merchants",
  re: "the King", rey: "the King", roi: "the King", regina: "the Queen", reina: "the Queen", reine: "the Queen", catalani: "the Catalans", catalanes: "the Catalans", cancelleria: "the Chancellery", cancillería: "the Chancellery" };
// "of" words: those that carry "the" and those that don't.
const EN_OF_THE = /^(del|dello|della|dell'|dei|degli|delle|de la|de las|de los|du|des|de l'|do|da|dos|das|dels|de les)$/i;
const EN_OF = /^(di|d'|de)$/i;
const EN_SMALL = /^(e|y|et|i|and|di|d'|de|del|dello|della|dell'|dei|degli|delle|la|las|los|le|les|el|il|lo|l'|du|des|do|da|dos|das|dels|al|alla|all'|a|o|en|in|sul|sulla|the|of)$/i;
const EN_SAINT = /^(san|santa|sant'|santo|santi|santissima|santissimo|são|sao|saint|sainte|st\.?|ste\.?|sant)$/i;
const EN_WORSHIP = /\b(church|chapel|basilica|cathedral|shrine|abbey|monastery|convent|oratory|sanctuary|mosque|synagogue|temple|chiesa|iglesia|église|església|igreja|basílica|duomo|santuario|cappella|capilla)\b/i;
// "Dell'Immacolata" is "dell'" + "Immacolata": the apostrophe words split off so they read as one word each.
const enWords = s => String(s).replace(/\b([dDlL]|[dD]ell|[aA]ll|[sS]ant|[nN]ell|[sS]ull)'\s*/g, "$1' ").split(/\s+/).filter(Boolean);
const enCap = w => w.replace(/^\p{Ll}/u, c => c.toUpperCase());
// Place words in the local language that the safety net looks for in names shown to the traveler.
const EN_ENGLISH = /\b(church|park|palace|museum|gardens?|square|tower|gallery|cathedral|chapel|bridge|gate|house|castle|lift|elevator|street|market|monastery|convent|cemetery|fountains?|theatre|theater|zoo|aquarium|centre|center|hill|lake|beach|station|library|hall|pavilion|stadium|abbey|shrine|temple|walls?|baths|arch|column|statue|monument|memorial|tomb|mausoleum|forum|villa)\b/i;
const EN_FOREIGN = /(^|\s)(palazzo|chiesa|fontana|fontane|forte|torre|galleria|santuario|sacrario|cittadella|cattedrale|castello|museo|giardino|iglesia|palacio|capilla|fuente|museu|igreja|palácio|église|musée|fontaine|chapelle)(\s|$)/i;
// The English rendering of one name, or "" when it is already English or can't be rendered fully.
function enNameOf(name, cat, local) {
  const raw = String(name || "").trim(); if (!raw || nonLatin(raw)) return "";
  const m = /^(.*?)(\s*\([^)]*\)|,\s*[^,]+)?$/.exec(raw), tail = (m && m[2]) || "";
  let base = ((m && m[1]) || raw).trim().replace(/\s*-\s*/g, "-").replace(/["“”«»]/g, "");
  let phrased = false;
  for (const [re, en] of EN_PHRASE) if (re.test(base)) { base = base.replace(re, en); phrased = true; }
  let w = enWords(base);
  // Already English ("Royal Basilica of Saint Francis the Great", "Casa de Campo Park"): left as it is.
  if (!phrased && (EN_ENGLISH.test(raw) || /(^|\s)(of|the|and)(\s|$)/i.test(raw))) return "";
  // Lead words: "Ex Chiesa", "Real Cittadella".
  const pre = []; while (w.length > 1 && EN_ADJ[w[0].toLowerCase()] && !EN_HEAD[w[0].toLowerCase()]) pre.push(EN_ADJ[w.shift().toLowerCase()]);
  let head = EN_HEAD[w[0] && w[0].toLowerCase()];
  if (!head && w[0] && w[1] && EN_HEAD[w[1].toLowerCase()] && w[0].toLowerCase() === "orto") head = EN_HEAD.orto;
  if (head) w.shift();
  else if (pre.length) return "";   // "Real Madrid": a describing word alone isn't enough
  // "Orto Botanico", "Museo Archeologico Nazionale", "Cimitero monumentale": describing words after the place word.
  const post = []; while (head && w.length && EN_ADJ[w[0].toLowerCase()] && !EN_OF.test(w[0]) && !EN_OF_THE.test(w[0])) post.push(EN_ADJ[w.shift().toLowerCase()]);
  // What's left: "of" + a thing, a saint, or a proper name.
  const ofPart = rest => {
    if (!rest.length) return "";
    let lead = "";
    const two = rest.length > 1 ? (rest[0] + " " + rest[1]).toLowerCase() : "";
    if (/^de (la|las|los|les|l')$/.test(two)) { lead = "of the"; rest = rest.slice(2); }
    else if (EN_OF_THE.test(rest[0])) { lead = "of the"; rest = rest.slice(1); }
    else if (EN_OF.test(rest[0])) { lead = "of"; rest = rest.slice(1); }
    if (!rest.length) return null;
    // One common word: "della Cultura" is "of Culture", "della Lettera" "of the Letter".
    if (lead && rest.length === 1 && EN_WORD[rest[0].toLowerCase()]) return "of " + EN_WORD[rest[0].toLowerCase()];
    // A thing and its describing words: "d'Arte Moderna e Contemporanea" is "of Modern and Contemporary Art".
    if (lead && EN_WORD[rest[0].toLowerCase()] && rest[1] && EN_ADJ[rest[1].toLowerCase()]) {
      const adj = []; let k = 1;
      while (k < rest.length && (EN_ADJ[rest[k].toLowerCase()] || (/^(e|y|et|i|and)$/i.test(rest[k]) && rest[k + 1] && EN_ADJ[rest[k + 1].toLowerCase()]))) { if (EN_ADJ[rest[k].toLowerCase()]) adj.push(EN_ADJ[rest[k].toLowerCase()]); k++; }
      const more = k < rest.length ? ofPart(rest.slice(k)) : "";
      if (more === null || (more && !more.startsWith("of "))) return null;
      return "of " + adj.join(" and ") + " " + EN_WORD[rest[0].toLowerCase()].replace(/^the /, "") + (more ? " " + more : "");
    }
    // A describing word or a common word of the local language left in what follows "of": not fully English.
    if (lead && rest.some(t => !EN_SMALL.test(t) && (EN_ADJ[t.toLowerCase()] || EN_WORD[t.toLowerCase()]))) return null;
    // "of the" + a capitalized word: a thing in the local language ("de la Música", "de las Flores") unless it is
    // one the rules put into English ("del Holy Saviour"); left as it is.
    if (lead === "of the" && rest.some(t => !EN_SMALL.test(t) && !EN_WORD[t.toLowerCase()] && !EN_KNOWN.has(t.toLowerCase()))) return null;
    // Any other common word left in the name: not fully English, so leave the name as it is.
    if (rest.some(t => /^\p{Ll}/u.test(t) && !EN_SMALL.test(t) && !EN_WORD[t.toLowerCase()])) return null;
    const out = rest.map(t => EN_WORD[t.toLowerCase()] && /^\p{Ll}/u.test(t) ? EN_WORD[t.toLowerCase()].replace(/^the /, "") : t).join(" ").replace(/' /g, "'");
    if (lead) return lead + " " + out;
    if (EN_SAINT.test(rest[0])) return "of " + out;
    // "Pietro Castelli dell'Università": a proper name, then "of" something.
    const i = rest.findIndex((t, k) => k > 0 && (EN_OF.test(t) || EN_OF_THE.test(t)));
    if (i > 0) { const r2 = ofPart(rest.slice(i)), nm = rest.slice(0, i).join(" ");
      if (rest.slice(0, i).some(t => /^\p{Ll}/u.test(t) && !EN_SMALL.test(t))) return null;
      return r2 === null || !r2 ? " " + nm : { name: nm, of: r2.startsWith("of ") ? r2 : "of" + r2 }; }   // "of" a thing the rules can't put into English: left to the local name
    return " " + out;
  };
  let en = "";
  if (head) {
    const what = pre.concat(post.reverse()).concat(head[0]).join(" "), r = ofPart(w);
    if (r === null) return "";
    if (r && typeof r === "object") en = r.name + " " + what + " " + r.of;
    else if (!r) en = what;
    else if (r.startsWith("of ")) en = what + " " + r;
    else if (head[1] === "pre") en = (/^(Fort|Fortress|Castle|Tower)$/.test(head[0]) ? what + r : what + " of" + r);
    else en = r.trim() + " " + what;
  } else if (phrased) {
    // "Madonna della Lettera" became "Our Lady della Lettera": its "of" words still need English.
    const i = w.findIndex(t => EN_OF.test(t) || EN_OF_THE.test(t));
    if (i > 0) { const r = ofPart(w.slice(i)); if (r === null) return ""; en = w.slice(0, i).join(" ") + " " + (r.startsWith("of ") ? r : r.trim()); }
    else if (w.some(t => /^\p{Ll}/u.test(t) && !EN_SMALL.test(t))) return "";
    else en = w.join(" ");
    if (/church|cathedral|basilica|chapel|shrine/i.test(cat || "") && EN_WORSHIP.test(local || "") && !EN_WORSHIP.test(en)) en = (EN_SAINT.test(w[0]) ? en + " Church" : "Church of the " + en);
  } else if (/church|cathedral|basilica|chapel|shrine/i.test(cat || "") && EN_SAINT.test(w[0] || "") && !EN_WORSHIP.test(raw) && EN_WORSHIP.test(local || "")) {
    // A church known by its saint alone ("Santa Maria Alemanna", "Sant'Eustochia") says what it is in English, when
    // its local name says it is a church (the "Santa Justa Lift" is a lift).
    en = w.join(" ").replace(/' /g, "'") + " Church";
  } else return "";
  en = enCap(en.replace(/\s+/g, " ").replace(/' /g, "'").trim()) + tail;
  return keyOf(en) === keyOf(raw) ? "" : en;
}
// A sight from the sources gets its English name; its local name is kept for the signs. Famous places keep theirs.
function enSight(x, cat) {
  if (!x || !x.name || (x.sl || 0) >= EN_FAME) return null;
  const en = enNameOf(x.name, cat, x.local); if (!en) return null;
  return { name: en, local: x.local && !nonLatin(x.local) ? x.local : x.name };
}
// The local name in small text under an English one, when it helps (another spelling the traveler will see on signs).
function localLine(s) {
  const l = s && s.local ? String(s.local).trim() : "";
  if (!l || nonLatin(l) || keyOf(l) === keyOf(s.name) || keyOf(l) === keyOf(showName(s))) return "";
  return `<p class="localname">Local name: ${esc(l)}</p>`;
}
if (typeof window !== "undefined") window.__kairouteEnName = (n, cat, sl, local) => { const r = enSight({ name: n, sl: sl || 0, local }, cat); return r ? r.name : n; };
