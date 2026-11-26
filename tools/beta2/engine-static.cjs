// Beta 2 engine rules checked in its code: no city or sight names (every rule is general), no hidden errors
// (no empty catch), no internet, storage, page or AI access. Usage: node tools/beta2/engine-static.cjs
const fs = require('fs'), path = require('path'); const dir = path.join(__dirname, '..', '..', 'src', 'engine'); let bad = 0;
const fixtures = path.join(__dirname, '..', 'fixtures'), snaps = path.join(__dirname, 'snapshots'), names = new Set();
for (const d of [fixtures, snaps]) if (fs.existsSync(d)) for (const f of fs.readdirSync(d).filter(f => f.endsWith('.json'))) {
  let j; try { j = JSON.parse(fs.readFileSync(path.join(d, f))); } catch (e) { continue; }
  const walk = o => { if (!o || typeof o !== 'object') return; if (typeof o.city === 'string' && o.city.length > 3) names.add(o.city); if (o.cities) Object.values(o.cities).forEach(c => c && c.name && names.add(c.name)); Object.values(o).forEach(v => typeof v === 'object' && walk(v)); }; walk(j); }
['Athens', 'Naples', 'Pompeii', 'Sorrento', 'Corinth', 'Acropolis', 'Barcelona', 'Madrid', 'Rome', 'Paris', 'Nassau', 'Miami', 'Santorini', 'Mykonos', 'Messina', 'Prague', 'Corpus Christi', 'Piraeus'].forEach(n => names.add(n));
// The app's own global state (the engine is handed everything it needs). The engine's own local "cities" (the bucket's)
// is not the app's, so only the app's trip object is looked for.
const BANNED = [[/(?<![.\w])isFinite\s*\(/, 'the global isFinite, which reads null, "" and true as finite numbers (a missing time as 0:00, E58): use E.fin, or Number.isFinite'], [/\bfetch\s*\(|XMLHttpRequest|WebSocket/, 'internet access'], [/localStorage|sessionStorage|indexedDB/, 'storage access'], [/\bdocument\.|\bwindow\./, 'page access'], [/catch\s*\([^)]*\)\s*\{\s*\}|catch\s*\{\s*\}/, 'an empty catch that hides an error'], [/\btrip\./, "the app's global state"]];
// Code and comments apart, read token by token (strings, template strings and regular expressions are skipped whole), so
// a comment's prose is never read as code (outside audit, Nov 21: "whole trip." in a comment was flagged as the app's
// state). Place names are looked for in both: an example in a comment is written generically too.
function split(src) { let code = '', notes = '', i = 0, prev = '';
  const reOk = () => /^$|[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) || /\b(return|typeof|case|in|of|delete|void|throw|new|else)$/.test(code.trimEnd());
  while (i < src.length) { const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { const e = src.indexOf('\n', i); const j = e < 0 ? src.length : e; notes += src.slice(i + 2, j) + '\n'; i = j; continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); const j = e < 0 ? src.length : e + 2; notes += src.slice(i + 2, j - 2) + '\n'; i = j; continue; }
    if (c === '"' || c === "'" || c === '`' || (c === '/' && reOk())) { let j = i + 1, cls = false;
      while (j < src.length) { const x = src[j]; if (x === '\\') { j += 2; continue; } if (c === '/') { if (x === '[') cls = true; else if (x === ']') cls = false; else if (x === '/' && !cls) break; if (x === '\n') break; } else if (x === c) break; j++; }
      code += src.slice(i, j + 1); i = j + 1; prev = 'x'; continue; }
    code += c; if (!/\s/.test(c)) prev = c; i++; }
  return { code, notes }; }
const once = [...new Map([...names].map(n => [n.toLowerCase(), n])).values()]; // one name once, whatever its case
// Usage check of the reader itself: a place named in code is found as code, in a comment as a comment.
{ const t = split('const a = "x // y"; // Lisbon\nconst r = /a\\/b/; /* Oslo */ const z = Bergen;'); if (!/Bergen/.test(t.code) || /Lisbon|Oslo/.test(t.code) || !/Lisbon/.test(t.notes) || !/Oslo/.test(t.notes)) { bad++; console.log('FAIL the checker reads code and comments wrongly'); } }
// Planted: the global isFinite is found, and the safe forms are not (R-01, E58).
{ const re = BANNED[0][0], hit = ['if (isFinite(d.boardAt)) x();', 'const ok = !isFinite (v);'], fine = ['Number.isFinite(v)', 'E.fin(v)', 'myisFinite(v)'];
  if (!hit.every(c => re.test(split(c).code)) || fine.some(c => re.test(split(c).code))) { bad++; console.log('FAIL the checker misses the global isFinite, or flags a safe form'); } }
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8'), { code, notes } = split(src);
  for (const [re, why] of BANNED) if (re.test(code)) { bad++; console.log(`FAIL ${f}: ${why}`); }
  for (const n of once) { const re = new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    if (re.test(code)) { bad++; console.log(`FAIL ${f}: names a place in its code (${n}); engine rules must be general`); }
    else if (re.test(notes)) { bad++; console.log(`FAIL ${f}: names a place in a comment (${n}); write the example generically`); } }
}
// The same number rule in the app's own code (src/main.js, src/features, src/end.js): the global isFinite reads a saved
// value of null as 0 (a pier saved with no latitude passed as a place on the map; testing thread, Nov 26), and so does a
// "+" put before the value given to fin, since +null is 0 (E59 class follow-up).
const FIN_PLUS = /\bfin\(\s*\+(?!\+)/, appFiles = ['main.js', 'end.js'].map(f => path.join(dir, '..', f)).concat(fs.readdirSync(path.join(dir, '..', 'features')).filter(f => f.endsWith('.js')).map(f => path.join(dir, '..', 'features', f)));
for (const f of appFiles.concat(fs.readdirSync(dir).filter(f => f.endsWith('.js')).map(f => path.join(dir, f)))) { const { code } = split(fs.readFileSync(f, 'utf8')), rel = path.relative(path.join(dir, '..', '..'), f);
  if (!f.includes(path.sep + 'engine' + path.sep) && BANNED[0][0].test(code)) { bad++; console.log(`FAIL ${rel}: ${BANNED[0][1]} (KEngine.fin in the app)`); }
  if (FIN_PLUS.test(code)) { bad++; console.log(`FAIL ${rel}: fin(+x) reads a missing value as 0 (+null is 0): give fin the value itself`); } }
{ const hit = ['if (E.fin(+d.lat)) x();', 'KEngine.fin( +p.lng)'], fine = ['E.fin(d.lat)', 'E.fin(a) + 1', 'fin(++i)'];
  if (!hit.every(c => FIN_PLUS.test(split(c).code)) || fine.some(c => FIN_PLUS.test(split(c).code))) { bad++; console.log('FAIL the checker misses fin(+x), or flags a safe form'); } }
console.log(bad ? `${bad} problems` : 'Engine code check passed'); process.exit(bad ? 1 : 0);
