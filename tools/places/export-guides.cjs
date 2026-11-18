// The public sights list of every place in the test trips, for the places build on GitHub (the trips themselves stay
// off the repo: tools/beta2/snapshots is not committed). Only public places go in: each sight's id, name, map point
// and getting-there note, each day trip's the same, and the port the ship docks at. No traveler, hotel or booking data.
// Usage: node tools/places/export-guides.cjs   (writes tools/places/guides.json)
const fs = require('fs'), path = require('path');
const SNAP = path.join(__dirname, '..', 'beta2', 'snapshots'), OUT = path.join(__dirname, 'guides.json');
const keep = x => ({ id: x.id, name: x.name, lat: x.lat, lng: x.lng, travelNote: x.travelNote || '' });
const was = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT)).places || {} : {}, out = Object.assign({}, was);
for (const f of fs.readdirSync(SNAP).filter(f => f.endsWith('.json')).sort()) {
  const s = JSON.parse(fs.readFileSync(path.join(SNAP, f)));
  for (const [key, c] of Object.entries(s.cities || {})) {
    const sites = (c.sites || []).filter(x => isFinite(x.lat)).map(keep), farther = (c.farther || []).filter(x => isFinite(x.lat)).map(keep);
    if (out[key] && out[key].sites.length + out[key].farther.length >= sites.length + farther.length) continue; // the fullest list wins
    const pd = (s.days || []).find(d => d.city === key && d.type === 'port' && d.point);
    out[key] = { name: c.name, sites, farther, port: pd ? { name: pd.point.name, lat: pd.point.lat, lng: pd.point.lng, known: !pd.point.unknown } : null };
  }
}
fs.writeFileSync(OUT, JSON.stringify({ note: 'Public sights of the test places (see export-guides.cjs).', places: out }, null, 1));
console.log(Object.keys(out).length + ' places');
