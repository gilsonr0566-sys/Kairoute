// Planted name bugs (Rule R-11; Nov 25 2026). Each one puts back, in a copy of the planner, a way names have really gone
// wrong, found on Nov 25 by the rule-by-rule check (tools/beta2/core-places-check.cjs) before any traveler met it. The
// check must fail on every one; a planted bug it lets through means the check has gone blind to that class, and this
// run fails. (Random small bugs nobody has thought of are the fault audit's job, tools/truth/fault-audit.cjs.)
// Usage: node tools/truth/name-mutants.cjs
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const MUTANTS = [
  { id: 'names-pass-gone', file: '05-places.js', edits: [['    return E.namesIn(b);', '    return b;']],
    was: 'no one names pass: a guide listing with no English name, a town\'s own sight, a looked-up pier or hotel went to the list as it came' },
  { id: 'eat-key-empty', file: '70-day.js', edits: [['k = E.latin(n).toLowerCase()', 'k = n.toLowerCase()'], [' if (!k) k = n.trim().toLowerCase();', '']],
    was: 'every place to eat named in another script filed under one empty key: 131 map restaurants shared one id and one set of opening hours, and only one could ever be a lunch' },
  { id: 'listing-id-empty', file: '05-places.js', edits: [['x.wikidata || nameId(x)', 'x.wikidata || key(x.name).replace(/ /g, "-")']],
    was: 'every travel-guide listing named in another script got the one id "wv~", so all but the first were dropped as repeats' },
  { id: 'kana-whole-line', file: '00-core.js', edits: [['const s0 = s1.replace(/[\\u3040-\\u30ff]+/g, kanaOf);', 'const s0 = /[\\u3040-\\u30ff]/.test(s1) ? kanaOf(s1) : s1;']],
    was: 'a ride note with one Japanese word had its English rewritten too: "Train From Kyoto, Abot 65 Min"' },
  { id: 'accents-off-everything', file: '00-core.js', edits: [['const s = s0.replace(/[\\u0370-\\u03ff\\u1f00-\\u1fff]+/g, g => g.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").normalize("NFC"));', 'const s = s0.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").normalize("NFC");']],
    was: 'Cyrillic й, ё and ї lost their marks ("Yurii", "Kiiv") and a café beside a Greek word lost its é' },
  { id: 'capitals-half-done', file: '00-core.js', edits: [['r = cap(nx) || (cap(pv) && !low(nx)) ? r.toUpperCase() : r[0].toUpperCase() + r.slice(1);', 'r = r[0].toUpperCase() + r.slice(1);']],
    was: 'a Greek name written all in capitals, as signs are, came out "AThINA"' },
  { id: 'bracket-left-open', file: '00-core.js', edits: [['.replace(/\\(\\s*\\)|\\[\\s*\\]/g, " ").replace(/\\s+/g, " ").replace(/^[\\s,·:;\\-–\\/]+|[\\s,·:;\\-–\\/(\\[]+$/g, "");', '.replace(/[()\\[\\]\\-–,·:]+\\s*$/g, "").replace(/\\(\\s*\\)/g, "").replace(/\\s+/g, " ").trim();']],
    was: 'the readable part of a name lost its closing bracket or kept an open one: "(Sanjo Station", "Museum ("' },
  { id: 'cafe-accent-not-a-cafe', file: '00-core.js', edits: [['/(?<![\\p{L}\\p{N}])(caf[eéè]s?|caff[eèé]|kafe|kafeneio|bar)(?![\\p{L}\\p{N}])/iu', '/\\b(caf[eéè]s?|caff[eèé]|kafe|kafeneio|bar)\\b/i']],
    was: '"Café Central" was not a café to the lunch search (the word edge stopped at the é), so cafés were planned as restaurants' },
  { id: 'icons-as-script', file: '00-core.js', edits: [['const OTHER = /[^\\p{Script=Latin}\\p{Script=Common}\\p{Script=Inherited}\\p{Script=Braille}]/u;', 'const OTHER = /[^\\u0000-\\u024F\\u1E00-\\u1EFF\\u2000-\\u206F\\u20A0-\\u20CF]/;']],
    was: '"another script" was a list of code ranges that took an arrow, a trademark sign and the app\'s own icons for foreign letters' },
  { id: 'english-name-unused', file: '00-core.js', edits: [['if (typeof en === "string" && en.trim() && !E.otherScript(en)) return en.trim();', '']],
    was: 'a sight with an English name shown under the plain word or its transliteration instead' },
];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'name-mutants-')); let missed = 0;
const check = env => spawnSync('node', [path.join(ROOT, 'tools', 'beta2', 'core-places-check.cjs')], { cwd: ROOT, env: Object.assign({}, process.env, env), encoding: 'utf8' });
const base = check({ ENGINE_SRC: '' });
if (base.status !== 0) { console.log('NOT TESTED: the names and places check fails on the planner as it is, so it proves nothing about planted bugs\n' + String(base.stdout).slice(-600)); process.exit(1); }
for (const m of MUTANTS) {
  const src = path.join(tmp, m.id); fs.cpSync(path.join(ROOT, 'src', 'engine'), path.join(src, 'engine'), { recursive: true }); fs.cpSync(path.join(ROOT, 'src', 'engine-data'), path.join(src, 'engine-data'), { recursive: true });
  const f = path.join(src, 'engine', m.file); let txt = fs.readFileSync(f, 'utf8'), planted = true;
  // The planted bug must really be planted: when the planner's text has moved on this says so (NOT TESTED), never "caught".
  for (const [from, to] of m.edits) { if (txt.split(from).length !== 2) { planted = false; break; } txt = txt.replace(from, () => to); }
  if (!planted) { missed++; console.log(`NOT TESTED ${m.id}: the planner text this bug changes is gone; update it to the current code`); continue; }
  fs.writeFileSync(f, txt);
  const r = check({ ENGINE_SRC: src }), n = (String(r.stdout).match(/^FAIL /gm) || []).length;
  if (r.status === 0) { missed++; console.log(`MISSED     ${m.id}: ${m.was}`); } else console.log(`caught     ${m.id} (${n || 'the planner did not load:'} ${n ? 'findings' : String(r.stderr).trim().split('\n').pop().slice(0, 80)}): ${m.was}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Planted name bugs: ${MUTANTS.length - missed} of ${MUTANTS.length} caught`);
process.exit(missed ? 1 : 0);
