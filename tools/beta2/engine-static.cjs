// Beta 2 engine rules checked in its code: no city or sight names (every rule is general), no hidden errors
// (no empty catch), no internet, storage, page or AI access. Usage: node tools/beta2/engine-static.cjs
const fs = require('fs'), path = require('path'); const dir = path.join(__dirname, '..', '..', 'src', 'engine'); let bad = 0;
const fixtures = path.join(__dirname, '..', 'fixtures'), snaps = path.join(__dirname, 'snapshots'), names = new Set();
for (const d of [fixtures, snaps]) if (fs.existsSync(d)) for (const f of fs.readdirSync(d).filter(f => f.endsWith('.json'))) {
  let j; try { j = JSON.parse(fs.readFileSync(path.join(d, f))); } catch (e) { continue; }
  const walk = o => { if (!o || typeof o !== 'object') return; if (typeof o.city === 'string' && o.city.length > 3) names.add(o.city); if (o.cities) Object.values(o.cities).forEach(c => c && c.name && names.add(c.name)); Object.values(o).forEach(v => typeof v === 'object' && walk(v)); }; walk(j); }
['Athens', 'Naples', 'Pompeii', 'Sorrento', 'Corinth', 'Acropolis', 'Barcelona', 'Madrid', 'Rome', 'Paris', 'Nassau', 'Miami', 'Santorini', 'Mykonos', 'Messina', 'Prague', 'Corpus Christi', 'Piraeus'].forEach(n => names.add(n));
const BANNED = [[/\bfetch\s*\(|XMLHttpRequest|WebSocket/, 'internet access'], [/localStorage|sessionStorage|indexedDB/, 'storage access'], [/\bdocument\.|\bwindow\./, 'page access'], [/catch\s*\([^)]*\)\s*\{\s*\}|catch\s*\{\s*\}/, 'an empty catch that hides an error'], [/\btrip\.|\bcities\[/, "the app's global state"]];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8'), code = src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  for (const [re, why] of BANNED) if (re.test(code)) { bad++; console.log(`FAIL ${f}: ${why}`); }
  for (const n of names) if (new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(src)) { bad++; console.log(`FAIL ${f}: names a place (${n}); engine rules must be general`); }
}
console.log(bad ? `${bad} problems` : 'Engine code check passed'); process.exit(bad ? 1 : 0);
