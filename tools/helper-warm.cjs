// Warms the live helper's kept answers for every city the app knows (rule R-29's other half, Nov 24). Kept answers are
// keyed by the code that made them, so a helper deploy starts every city cold, and a cold city's sources take about
// 100 s to gather: a traveler opening that city first waited, and sometimes the helper was stopped at about 60 s and the
// app said it "couldn't reach the travel guides and maps" (Paris, Lisbon, Nov 24). Run after every helper deploy
// (worker-deploy.yml) and on demand: each city's fame list and sources are asked for until they come back (3 tries).
// Cities: the built-in guides, the example trip's stops as the app names them, the place files, the 20-city test list.
// Usage: node tools/helper-warm.cjs [helper url]
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const H = process.argv[2] || 'https://kairoute-ai.rickgilson.workers.dev', O = 'https://gilsonr0566-sys.github.io';
const root = path.join(__dirname, '..'), labels = new Set();
try { const ctx = { window: {} }; vm.createContext(ctx);
  for (const f of ['data.js', 'cities1.js', 'cities2.js', 'cities3.js', 'cities4.js']) vm.runInContext(fs.readFileSync(path.join(root, 'src', f), 'utf8') + ';this.__B = typeof BUILTIN_CITIES !== "undefined" ? BUILTIN_CITIES : this.__B;', ctx);
  for (const [c] of ctx.__B || []) labels.add(c.area || c.city); } catch (e) { console.log('built-in guides not read: ' + e.message); }
for (const m of fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8').matchAll(/destination: "([^"]+)"/g)) if (!/^At sea$/.test(m[1])) { labels.add(m[1]); labels.add(m[1].replace(/\s*\(.*?\)\s*/g, ' ').trim()); }
for (const f of fs.readdirSync(path.join(root, 'tools', 'places', 'data'))) { try { labels.add(JSON.parse(fs.readFileSync(path.join(root, 'tools', 'places', 'data', f))).name); } catch (e) {} }
['Istanbul', 'Vienna', 'Lisbon', 'Barcelona', 'Edinburgh', 'Kyoto', 'Le Havre', 'Paris', 'Southampton', 'Kotor', 'Dubrovnik', 'Juneau', 'Ketchikan', 'Grand Turk', 'Mykonos', 'Ponta Delgada',
  'Half Moon Cay', 'Jerusalem', 'Haifa', 'Reykjavik', 'Venice', 'Dubai', 'Hamburg', 'Rome', 'Florence', 'London', 'Madrid', 'Thessaloniki', 'Split', 'Antalya', 'Osaka', 'Nassau'].forEach(x => labels.add(x));
const list = [...labels].filter(Boolean);
const ask = async (p, label) => { for (let t = 1; t <= 3; t++) { const t0 = Date.now();
  try { const r = await fetch(H + p + '?city=' + encodeURIComponent(label), { headers: { Origin: O }, signal: AbortSignal.timeout(280000) }); const s = (Date.now() - t0) / 1000;
    if (r.ok) { await r.text(); return `${r.status} in ${s.toFixed(1)} s${t > 1 ? ' (try ' + t + ')' : ''}`; } if (r.status === 404 || r.status === 400) return `${r.status} (not known)`; } catch (e) {} }
  return 'FAILED after 3 tries'; };
(async () => {
  console.log(`warming ${list.length} cities on ${H}`); let bad = 0, i = 0;
  const one = async label => { const f = await ask('/famous', label), s = await ask('/sources', label); if (/FAILED/.test(f + s)) bad++; console.log(`${label}: fame ${f}; sources ${s}`); };
  await Promise.all([0, 1, 2].map(async () => { while (i < list.length) await one(list[i++]); }));
  console.log(`helper-warm: ${list.length - bad} of ${list.length} warm${bad ? ', ' + bad + ' FAILED' : ''}`); process.exit(bad ? 1 : 0);
})();
