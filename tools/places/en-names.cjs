// English names for places (Nov 23 class rule, Richard: "the app is presented in the language that is selected to view
// it in"). For every Wikidata id: the English Wikipedia title (without its bracketed part: the name English readers
// know, "Temple of Apollo"), else the English label,
// else the one name Wikidata gives for every language ("mul"). An id with none of these has no English name: a place
// the app knows only by a local-language name, whatever the language, which it never shows as a sight's name.
// enNames(ids) -> Map id -> { en, from }  (from: "enwiki" | "label" | "mul"; no entry: no English name)
// CLI: node tools/places/en-names.cjs  -> writes en/noEn on the places files' listed sights and tools/beta2/en-names.json
'use strict';
const fs = require('fs'), path = require('path');
const UA = 'KairouteBeta/0.1 (trip planner test build; English names)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function sparql(q) {
  for (let i = 0; i < 4; i++) { try { const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } });
    if (r.ok) return await r.json(); if (r.status === 429 || r.status >= 500) { await sleep(4000 * (i + 1)); continue; } return null; } catch (e) { await sleep(3000 * (i + 1)); } }
  return null; }
async function enNames(ids) {
  const out = new Map(), list = [...new Set(ids.filter(x => /^Q\d+$/.test(x)))];
  for (let k = 0; k < list.length; k += 150) { const part = list.slice(k, k + 150);
    const j = await sparql(`SELECT ?item ?en ?mul ?wt WHERE { VALUES ?item { ${part.map(x => 'wd:' + x).join(' ')} }
      OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") } OPTIONAL { ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
      OPTIONAL { ?a schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?wt } }`);
    if (!j) throw new Error('Wikidata did not answer: English names unknown, nothing written');
    for (const b of j.results.bindings) { const id = b.item.value.split('/').pop(), had = out.get(id);
      const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
      const pick = b.wt ? { en: b.wt.value.replace(/\s*\([^)]*\)\s*$/, ''), from: 'enwiki' } : b.en ? { en: cap(b.en.value), from: 'label' } : b.mul ? { en: cap(b.mul.value), from: 'mul' } : null;
      const rank = { enwiki: 3, label: 2, mul: 1 };
      if (pick && (!had || rank[pick.from] > rank[had.from])) out.set(id, pick); }
    await sleep(1200); }
  out.asked = list; return out; }
// The names a place has in other languages, in Latin letters (other scripts fail the gate on their own): what a shown
// name must not be when the place has an English one. id -> [names]
async function otherNames(ids) {
  const out = new Map(), list = [...new Set(ids.filter(x => /^Q\d+$/.test(x)))];
  for (let k = 0; k < list.length; k += 100) { const part = list.slice(k, k + 100);
    const j = await sparql(`SELECT ?item ?l WHERE { VALUES ?item { ${part.map(x => 'wd:' + x).join(' ')} } ?item rdfs:label ?l FILTER(!LANGMATCHES(LANG(?l), "en") && LANG(?l) != "mul") }`);
    if (!j) throw new Error('Wikidata did not answer: other-language names unknown, nothing written');
    for (const b of j.results.bindings) { const id = b.item.value.split('/').pop(), v = b.l.value; if (/[^\u0000-\u024f\u1e00-\u1eff\u2000-\u206f]/.test(v)) continue;
      if (!out.has(id)) out.set(id, new Set()); out.get(id).add(v); }
    await sleep(1200); }
  return out; }
module.exports = { enNames, otherNames };
if (require.main === module) (async () => {
  const dir = path.join(__dirname, 'data'), files = fs.readdirSync(dir).filter(f => f.endsWith('.json')), docs = files.map(f => [f, JSON.parse(fs.readFileSync(path.join(dir, f)))]);
  const lists = d => [d.guideSights || [], ...Object.values(d.towns || {}).map(t => t.sights || [])];
  const ids = docs.flatMap(([, d]) => lists(d).flat().map(x => x.wikidata).filter(Boolean));
  // The test trips' own sight ids too (src-q…, wv~Q…, town~Q…), for the names gate.
  const snap = path.join(__dirname, '..', 'beta2', 'snapshots');
  if (fs.existsSync(snap)) for (const f of fs.readdirSync(snap).filter(f => f.endsWith('.json'))) { const s = JSON.parse(fs.readFileSync(path.join(snap, f)));
    for (const c of Object.values(s.cities || {})) for (const x of [...(c.sites || []), ...(c.farther || [])]) { const m = /(?:^src-q|~Q|^wv~Q)(\d+)$/i.exec(String(x.id)); if (m) ids.push('Q' + m[1]); } }
  const idf = path.join(__dirname, '..', 'beta2', 'en-names-ids.json'); if (fs.existsSync(idf)) ids.push(...JSON.parse(fs.readFileSync(idf)).ids);
  const en = await enNames(ids); let named = 0, none = 0;
  for (const [f, d] of docs) { for (const x of lists(d).flat()) { if (!x.wikidata) continue; const e = en.get(x.wikidata); delete x.en; delete x.noEn;
      if (e) { if (e.en !== x.name) x.en = e.en; named++; } else { x.noEn = true; none++; } }
    fs.writeFileSync(path.join(dir, f), JSON.stringify(d, null, 1) + '\n'); }
  const book = {}; for (const id of en.asked.sort()) { const e = en.get(id); book[id] = e ? e.en : null; }
  // Other-language names, only where they differ from the English one (by letters alone).
  const key = n => String(n || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const oth = await otherNames(en.asked), other = {};
  for (const id of en.asked) { const e = book[id], o = [...(oth.get(id) || [])].filter(n => key(n) !== key(e)); const ks = [...new Set(o.map(key))].filter(Boolean).sort(); if (ks.length) other[id] = ks; }
  fs.writeFileSync(path.join(__dirname, '..', 'beta2', 'en-names.json'), JSON.stringify({ note: 'English names by Wikidata id (English label, else English Wikipedia title, else the name for every language); null: no English name. other: the names in other languages (Latin letters, as match keys) that differ from the English one. Written by tools/places/en-names.cjs. Test data for the names gate; the app reads the places files.', at: new Date().toISOString().slice(0, 10), names: book, other }, null, 1) + '\n');
  console.log(`English names: ${named} listed sights named, ${none} with no English name, ${Object.keys(book).length} ids in en-names.json`);
})().catch(e => { console.error(e.message); process.exit(1); });
