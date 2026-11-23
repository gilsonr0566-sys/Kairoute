// Planted defects for the sight rules (Nov 23 2026; QA standard KAI-QA-001 section 8). Each mutant puts back, in a copy
// of the built app, one way the sight list has really gone wrong (most reached an outside tester first: docs/qa/escapes.md).
// The sight rules check then runs on that broken copy and must fail. A mutant it does not catch means a class of sight bug
// the gate is blind to, and this run fails. A mutant whose text is no longer in the build is NOT TESTED (also a failure),
// never "caught". Engine mutants are in tools/truth/mutants.cjs; these change the app's own sight rules.
// Usage: node tools/truth/sight-mutants.cjs [beta2-site/index.html] [--only id,id]
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const argv = process.argv.slice(2), oi = argv.indexOf('--only'), ONLY = oi >= 0 ? argv[oi + 1].split(',') : [];
const file = path.resolve(argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--only') || 'beta2-site/index.html');
const CHECK = path.join(__dirname, '..', 'beta2', 'sight-rules-check.cjs');
const MUTANTS = [
  { id: 'gone-offered', from: '  if (x.gone) return true;', to: '  if (false) return true;',
    was: 'The demolished Bastille offered as a must-see (outside test, Nov 22; escapes E5)' },
  { id: 'stadium-as-sight', from: 'if (srcHas2(x, /^(stadium|arena|sports-venue)$/) &&', to: 'if (false && srcHas2(x, /^(stadium|arena|sports-venue)$/) &&',
    was: 'A football stadium listed as a sight (first-timer walk, Nov 22; escapes E6)' },
  { id: 'organisation-as-sight', from: 'if (!srcHas2(x, SRC_PLACE_KINDS) && !srcHas2(x, /^(settlement|admin-area)$/)) return true;', to: 'if (false) return true;',
    was: 'An organisation or a film festival shown as a stop (Fable gap 11, Nov 22)' },
  { id: 'region-as-stop', from: 'if (srcHas2(x, /^region$/) &&', to: 'if (false && srcHas2(x, /^region$/) &&',
    was: 'A peninsula or region shown as a stop (Fable gap 11: "continental Europe")' },
  { id: 'term-as-stop', from: 'if (srcHas2(x, /^term$/) &&', to: 'if (false && srcHas2(x, /^term$/) &&',
    was: 'The Holy Land, a word not a place, shown as a stop (sight check, Nov 23)' },
  { id: 'map-area-as-stop', from: 'if (x.area && !srcHas2(x, SRC_SIGHT_KINDS)) return true;', to: 'if (false) return true;',
    was: 'A county or region on the map shown as a stop (sight check, Nov 23)' },
  { id: 'group-as-stop', from: 'if (x.isGroup) return true;', to: 'if (false) return true;',
    was: '"Historic Monuments of Ancient Kyoto", 17 temples across a city, as one stop (sight check, Nov 23)' },
  { id: 'mosque-as-church', from: '[/^mosque$/, "Mosque", 30]', to: '[/^mosque$/, "Church", 30]',
    was: 'Mosques labelled "Church" (Fable gap 11, Nov 22)' },
  { id: 'flat-visit-length', from: 'Sight: [[100, 90], [60, 60]]', to: 'Sight: []',
    was: 'Every sight a flat 40 minutes whatever its fame (Fable gap 11, Nov 22)' },
  { id: 'same-name-far-merged', from: 'if (isFinite(a.lat) && isFinite(b.lat) && hav(a, b) > 5) return "";', to: '',
    was: "Lübeck's Holstentor took the id of a Hamburg place 59 km away (sight audit, Nov 23)" },
  { id: 'twin-listing-kept', from: 'city[k] = city[k].filter(s => !twin(s));', to: 'city[k] = city[k].filter(s => true);',
    was: '"Museo regionale di Messina" beside the "Regional Museum of Messina" (sight audit, Nov 23)' },
  { id: 'local-only-name-shown', from: 'if (!en && x.localName && !srcSaysKind(x)) {', to: 'if (false) {',
    was: 'Kusadasi: "Kadı Kalesi", "Halk Plajı" shown under their Turkish names: no English name in any source (Nov 23, rule R-11)' },
  { id: 'listing-keeps-local-name', from: 'if (!s.srcName && x.name && !nonLatin(x.name) && keyOf(x.name) !== keyOf(s.name)) {', to: 'if (false) {',
    was: 'Messina: "Palazzo Zanca" shown under its listing name though it has an English one (Nov 23, rule R-11)' },
];
const html = fs.readFileSync(file, 'utf8'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sight-mutants-'));
const real = spawnSync('node', [CHECK, file], { encoding: 'utf8' });
if (real.status !== 0) { console.log('NOT TESTED: the sight rules check fails on the real build\n' + (real.stdout || '').slice(-1500)); process.exit(1); }
let bad = 0;
for (const m of MUTANTS.filter(m => !ONLY.length || ONLY.includes(m.id))) {
  if (html.split(m.from).length !== 2) { bad++; console.log(`NOT TESTED ${m.id}: its text is not in the build once (the code moved on: update the mutant)`); continue; }
  const f = path.join(tmp, m.id + '.html'); fs.writeFileSync(f, html.replace(m.from, m.to));
  const r = spawnSync('node', [CHECK, f], { encoding: 'utf8' }), caught = r.status !== 0;
  if (!caught) bad++;
  const why = ((r.stdout || '').split('\n').find(l => l.startsWith('- ')) || '').slice(2, 110);
  console.log(`${caught ? 'caught' : 'MISSED'} ${m.id}: ${m.was}${caught ? ' (by: ' + why + ')' : ''}`);
}
console.log(`sight-mutants: ${bad ? bad + ' not caught or not tested' : 'all caught'}`);
process.exit(bad ? 1 : 0);
