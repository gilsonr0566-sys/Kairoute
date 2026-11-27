// Beta 2 build gate: the expected outcomes in yardstick-expect.json, reached by the engine on its own. Each check plans
// the trip with the traveler's picks cleared (so the engine's own suggestions are what's tested).
// Usage: PLACES_DIR=<places files> node tools/beta2/expect.cjs
const fs = require('fs'), path = require('path'), E = require('./engine.cjs');
const X = JSON.parse(fs.readFileSync(path.join(__dirname, 'yardstick-expect.json'))), dir = path.join(__dirname, 'snapshots');
const PD = process.env.PLACES_DIR, places = {};
if (PD) for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; }
let bad = 0;
for (const [name, checks] of Object.entries(X)) {
  if (!Array.isArray(checks)) continue;
  const f = path.join(dir, name + '.json'); if (!fs.existsSync(f)) { console.log(`skip ${name}: no saved trip here`); continue; }
  const s = JSON.parse(fs.readFileSync(f)); s.days.forEach(d => { d.selected = null; });
  const b = PD ? E.applyPlaces(s, places) : s, plans = E.planTrip(b);
  const stopNames = plans.flatMap(p => (p && p.items || []).filter(x => x.t === 'stop').map(x => x.name));
  const far = Object.values(b.cities).flatMap(c => c.farther || []), ranked = E.rank(far.map(x => Object.assign({}, x, { far: true })), b.prefs || {}, b.style);
  for (const c of checks) {
    let ok = false, got = '';
    if (c.check === 'day-trip-ranked-above') { const i = ranked.findIndex(x => x.name === c.better), j = ranked.findIndex(x => x.name === c.worse);
      ok = i >= 0 && (j < 0 || i < j); got = `ranked ${ranked.map(x => x.name + ' ' + x.worth).join(', ')}; planned: ${stopNames.filter(n => far.some(x => x.name === n)).join(', ') || 'no day trip'}`; }
    else if (c.check === 'day-trip-has-food-experience') { const t = far.find(x => x.name === c.town); ok = !!(t && (t.foodDrink || []).length); got = t ? `${(t.foodDrink || []).length} food & drink places: ${(t.foodDrink || []).slice(0, 6).map(x => x.name).join(', ')}` : 'town not in the guide'; }
    else { got = 'unknown check'; }
    if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${c.check}: ${got}`);
  }
}
process.exit(bad ? 1 : 0);
