// Places files are lasting facts: a new build only adds to or corrects what an earlier one found. A lookup that came
// back empty this time (a busy map server, a search that timed out) never wipes a fact found before.
// Usage as a tool: node tools/places/merge.cjs <older dir> <newer dir> <out dir>
const fs = require('fs'), path = require('path');
const empty = v => v == null || v === '' || v === 0 || v === false || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
const pick = (a, b) => empty(b) ? a : b;   // b is the newer value
function mergeFact(a = {}, b = {}) { const o = Object.assign({}, a); for (const k of Object.keys(b)) o[k] = k === 'closedForGood' ? !!b[k] : pick(a[k], b[k]); return o; }
function mergeList(a = [], b = []) {
  if (!b.length) return a.slice(); const byName = new Map(a.map(x => [x.name, x]));
  return b.map(x => byName.has(x.name) ? mergeFact(byName.get(x.name), x) : x);
}
function merge(older, newer) {
  if (!older) return newer; if (!newer) return older;
  const o = Object.assign({}, older, newer);
  o.sites = {}; for (const k of new Set([...Object.keys(older.sites || {}), ...Object.keys(newer.sites || {})])) o.sites[k] = mergeFact((older.sites || {})[k], (newer.sites || {})[k]);
  o.towns = {}; for (const k of new Set([...Object.keys(older.towns || {}), ...Object.keys(newer.towns || {})])) {
    const a = (older.towns || {})[k] || {}, b = (newer.towns || {})[k] || {};
    o.towns[k] = Object.assign(mergeFact(a, b), { sights: mergeList(a.sights, b.sights), foodDrink: mergeList(a.foodDrink, b.foodDrink) });
  }
  o.ports = pick(older.ports, newer.ports) || [];
  // Island outlines (R-06) are kept when a later build couldn't reach the map for them.
  if (older.islands && newer.islands) o.islands = Object.assign({}, older.islands, newer.islands, { shapes: pick(older.islands.shapes, newer.islands.shapes), centreShape: newer.islands.shapes ? newer.islands.centreShape : older.islands.centreShape });
  // Ground heights: every point measured before is kept, a newer reading wins.
  { const h = new Map(); for (const x of [].concat(older.heights || [], newer.heights || [])) if (Array.isArray(x) && x.length === 3) h.set(x[0] + ',' + x[1], x); if (h.size) o.heights = [...h.values()]; }
  o.dayTrips = [...new Set([...(older.dayTrips || []), ...(newer.dayTrips || [])])];
  for (const k of ['guideSights', 'mapPlaces', 'centre', 'wikivoyage', 'transit', 'lifts', 'cityEats', 'eatHours', 'piers', 'ferryLinks', 'roads']) o[k] = pick(older[k], newer[k]);
  o.missing = (newer.missing || older.missing || []).filter(m => !(m === 'a mapped cruise terminal or pier' && o.ports.some(p => p.cruise)) && !(m === 'travel guide page' && o.wikivoyage) && !(m === 'public transport lines on the map' && (o.transit || []).length));
  return o;
}
module.exports = { merge };
if (require.main === module) {
  const [A, B, OUT] = process.argv.slice(2); fs.mkdirSync(OUT, { recursive: true });
  const files = new Set([...fs.readdirSync(A), ...fs.readdirSync(B)].filter(f => f.endsWith('.json')));
  for (const f of files) { const r = d => fs.existsSync(path.join(d, f)) ? JSON.parse(fs.readFileSync(path.join(d, f))) : null;
    fs.writeFileSync(path.join(OUT, f), JSON.stringify(merge(r(A), r(B)), null, 1)); console.log('merged', f); }
}
