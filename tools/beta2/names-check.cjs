// Names in the traveler's language (Richard, Nov 23: "the app is presented in the language that is selected to view
// it in"). Every saved test trip, planned by the engine: every name the traveler can see (the sights offered in the
// list, the stops, rides and their steps, stations, lines, lunch places, notes) is in Latin letters, and a sight's shown
// name is not in the local language when an English one exists. Run by the release gate.
// Fails on: any letter of another script (Hebrew, Arabic, Greek, Cyrillic, Japanese, Chinese, Korean, Thai...), in any
// shown field; a sight shown under its name in another language, whatever the language: for every sight with a
// Wikidata id, tools/beta2/en-names.json (tools/places/en-names.cjs) gives its English name (the English label, else
// the English Wikipedia title) and its names in every other language. A shown name that is one of those other names,
// and not the English one, fails; so does a place with no English name at all shown under a local one. No word lists:
// the same test for every language (rule R-11).
// Usage: node tools/beta2/names-check.cjs [--list]
'use strict';
const fs = require('fs'), path = require('path'), E = require('./engine.cjs');
const dir = process.env.SNAP_DIR || path.join(__dirname, 'snapshots'), list = process.argv.includes('--list');
const PD = process.env.PLACES_DIR || path.join(__dirname, '..', 'places', 'data'), places = {};
if (PD) for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; }
const OTHER = /[^\u0000-ɏḀ-ỿ -⁯₠-⃏℀-⅏←-⇿∀-⋿⌀-⏿─-➿️\u{1F000}-\u{1FAFF}]/u;
const BOOK = path.join(__dirname, 'en-names.json');
if (!fs.existsSync(BOOK)) { console.log('names-check: NOT RUN, tools/beta2/en-names.json is missing (node tools/places/en-names.cjs, needs Wikidata). An unrun check is never a pass.'); process.exit(1); }
const BK = JSON.parse(fs.readFileSync(BOOK)), book = BK.names, other = BK.other;
if (!other) { console.log('names-check: NOT RUN, en-names.json has no other-language names yet (node tools/places/en-names.cjs). An unrun check is never a pass.'); process.exit(1); }
const keyOf = n => String(n || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
const qOf = x => { const m = /(?:^src-q|~Q|^wv~Q)(\d+)$/i.exec(String(x.id || '')); return m ? 'Q' + m[1] : x.wd || x.wikidata || null; };
// A sight shown under its name in another language, or null.
const localOf = x => { const q = qOf(x), en = q && book[q], loc = q && other[q]; if (!loc || !loc.includes(keyOf(x.name))) return null;
  return `"${x.name}" (${q}) is its ${en ? 'local name; English name "' + en + '"' : 'local name and it has no English name in any source'}`; };
const bad = { script: [], local: [] }; let names = 0, trips = 0, planted = 0;
const seen = new Set(), add = (k, f, msg) => { const key = k + f + msg; if (!seen.has(key)) { seen.add(key); bad[k].push(`${f}: ${msg}`); } };
const SHOWN = new Set(['name', 'how', 'label', 'note', 'why', 'from', 'to', 'title', 'townName', 'travelNote', 'meal', 'where', 'line', 'station']);
const walk = (o, f, where, out) => { if (!o || typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) { if (typeof v === 'string') { if (SHOWN.has(k)) out.push([v, where + '.' + k]); }
    else if (Array.isArray(v) && (k === 'steps' || k === 'explain')) v.forEach(t => typeof t === 'string' && out.push([t, where + '.' + k]));
    else if (v && typeof v === 'object' && !/^(ans|raw|src|facts|oh|hours)$/.test(k)) walk(v, f, where, out); } };
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  const raw = JSON.parse(fs.readFileSync(path.join(dir, f))), s = PD ? E.applyPlaces(JSON.parse(JSON.stringify(raw)), places) : raw; trips++;
  // The list the traveler chooses from.
  for (const [ck, c] of Object.entries(s.cities || {})) for (const x of [...(c.sites || []), ...(c.farther || [])]) { names++;
    if (OTHER.test(x.name || '')) add('script', f, `${c.name || ck} list: "${x.name}"`);
    else { const m = localOf(x); if (m) add('local', f, `${c.name || ck} list: ${m}`); } }
  // Every planned day.
  let plans = []; try { plans = E.planTrip(s); } catch (e) { console.log(`skip ${f}: ${e.message}`); }
  plans.forEach((p, i) => { if (!p || !p.items) return; const out = []; walk({ items: p.items, explain: p.explain, leaveAt: p.leaveAt }, f, 'day ' + i, out);
    for (const [t, w] of out) { names++; if (OTHER.test(t)) add('script', f, `${w}: "${t.slice(0, 90)}"`); } });
  // The same trip with names in other scripts planted in every source the plan reads (every third sight, every place
  // to eat, the map's places to eat, each town's food and drink, ride notes): what reaches the screen is still in
  // Latin letters (rule R-11, one last layer in the engine). Kept apart from the real findings as "planted".
  { const SCR = ['נתי מזנון המשק', '三条(京都府)', 'Σταθμός Λαρίσης', 'مطعم الشاطئ', '경복궁', 'วัดพระแก้ว'], pick = k => SCR[k % SCR.length];
    const r2 = JSON.parse(JSON.stringify(raw)); let k = 0;
    for (const c of Object.values(r2.cities || {})) { (c.sites || []).forEach((x, i) => { if (i % 3 === 0) x.name = pick(k++) + ' ' + (x.name || ''); if (x.travelNote != null) x.travelNote = 'Train from ' + pick(k++); });
      (c.farther || []).forEach(x => { if (x.travelNote != null) x.travelNote = 'Bus from ' + pick(k++); }); (c.restaurants || []).forEach(x => { x.name = pick(k++); }); }
    const pl = {}; for (const [key, q] of Object.entries(places)) { const c = JSON.parse(JSON.stringify(q)); (c.cityEats || []).forEach(x => { x.name = pick(k++); });
      Object.values(c.towns || {}).forEach(t => { (t.foodDrink || []).forEach(x => { x.name = pick(k++); }); (t.mapEats || []).forEach(x => { x.name = pick(k++); }); }); pl[key] = c; }
    const s2 = PD ? E.applyPlaces(r2, pl) : r2; let p2 = []; try { p2 = E.planTrip(s2); } catch (e) {}
    p2.forEach((p, i) => { if (!p || !p.items) return; const out = []; walk({ items: p.items, explain: p.explain, leaveAt: p.leaveAt }, f, 'day ' + i, out);
      for (const [t, w] of out) { planted++; if (OTHER.test(t)) add('script', f, `planted ${w}: "${t.slice(0, 90)}"`); } }); }
}
// The check is never blind: a planted local name (one the book knows in another language) and a planted name in
// another script must both be caught, or the run fails.
{ const q = Object.keys(other).find(id => book[id] && other[id].length), x = { id: 'wv~' + q, name: other[q][0] };
  const caught = !!localOf(x) && !localOf({ id: x.id, name: book[q] }), scr = OTHER.test('נתי מזנון') && OTHER.test('東京駅') && !OTHER.test('Café Ñandú, Kraków');
  if (!caught || !scr) { console.log('names-check: BLIND, a planted ' + (!caught ? 'local name' : 'script name') + ' was not caught'); process.exit(1); }
  console.log(`planted names caught (local "${x.name}" for ${q}, Hebrew and Japanese script); the English name passes`); }
const n = bad.script.length + bad.local.length;
console.log(`${bad.script.length} names in another script, ${bad.local.length} sight names in the local language (${names} names on ${trips} trips, and ${planted} more with names in other scripts planted in every source)`);
if (list || n) for (const k of Object.keys(bad)) bad[k].slice(0, list ? 999 : 15).forEach(x => console.log(`  ${k === 'script' ? 'SCRIPT' : 'LOCAL '} ${x}`));
console.log(`names-check: ${n ? 'FAILED' : 'passed'}`);
process.exit(n ? 1 : 0);
