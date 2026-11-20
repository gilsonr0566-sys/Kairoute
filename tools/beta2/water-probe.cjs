// Runs the app's own map check (src/features/water-check.js) against the real free services for the outside tester's
// Round 1 cases, and saves what it found to tools/beta2/sources/water-probe.json. Free services, no AI.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../src/features/water-check.js'), 'utf8');
const W = new Function('fetch', 'allSites', 'keyOf', 'save', 'render', 'window', 'navigator', src + '; return { waterIslandQuery, waterIslandsFrom, waterAcross, waterOverpass, waterFoot, waterRoadGaps };')(fetch, () => [], x => x, () => {}, () => {}, undefined, undefined);
// Each case: a start (pier or centre) and stops, with what the tester says is true (across: needs a boat; road: false =
// far from any road).
const CASES = [
  { place: 'Dubrovnik', start: { lat: 42.6584, lng: 18.0850 }, stops: [{ id: 'Lokrum', lat: 42.6272, lng: 18.1194, across: true }, { id: 'Old town walls', lat: 42.6411, lng: 18.1100, across: false }] },
  { place: 'Santorini', start: { lat: 36.4166, lng: 25.4318 }, stops: [{ id: 'Nea Kameni', lat: 36.4040, lng: 25.3960, across: true }, { id: 'Oia', lat: 36.4618, lng: 25.3753, across: false }] },
  { place: 'Reykjavik', start: { lat: 64.1530, lng: -21.9510 }, stops: [{ id: 'Videy', lat: 64.1661, lng: -21.8538, across: true }, { id: 'Hallgrimskirkja', lat: 64.1417, lng: -21.9266, across: false }] },
  { place: 'Marseille', start: { lat: 43.3270, lng: 5.3600 }, stops: [{ id: "Chateau d'If", lat: 43.2798, lng: 5.3253, across: true }, { id: 'Notre-Dame de la Garde', lat: 43.2840, lng: 5.3713, across: false }] },
  { place: 'Venice', start: { lat: 45.4330, lng: 12.3190 }, stops: [{ id: 'San Giorgio Maggiore', lat: 45.4293, lng: 12.3433, across: true, road: false }, { id: 'St Mark\'s Basilica', lat: 45.4345, lng: 12.3397, across: false, road: false }, { id: 'Rialto Bridge', lat: 45.4380, lng: 12.3359, across: false, road: false }] },
  { place: 'Copenhagen (bridges)', start: { lat: 55.6761, lng: 12.5683 }, stops: [{ id: 'Christiansborg (Slotsholmen)', lat: 55.6761, lng: 12.5800, across: false }] },
];
(async () => {
  // What the map service says to the island question itself (status and the start of the answer), to see a refusal.
  for (const ep of ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']) {
    try { const q = W.waterIslandQuery([{ lat: 42.6272, lng: 18.1194 }, { lat: 42.6584, lng: 18.0850 }]); const r = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
      console.log('raw', ep, r.status, (await r.text()).slice(0, 1500)); } catch (e) { console.log('raw', ep, String(e)); } }
  const out = [];
  for (const c of CASES) {
    const pts = c.stops.concat([c.start]), d = await W.waterOverpass(W.waterIslandQuery(pts));
    const isl = d ? W.waterIslandsFrom(d, pts.length) : null, foot = {};
    if (isl) for (let i = 0; i < c.stops.length; i++) if (isl[i] && !(isl[pts.length - 1] && isl[pts.length - 1].ids.some(id => isl[i].ids.includes(id)))) foot[i] = await W.waterFoot(c.start, c.stops[i]);
    const across = isl ? W.waterAcross(c.stops, [c.start], isl.slice(0, c.stops.length), [isl[pts.length - 1]], i => foot[i] == null ? null : foot[i]) : null;
    const gaps = await W.waterRoadGaps(c.stops);
    c.stops.forEach((s, i) => { const got = across ? !!across[s.id] : null, gap = gaps ? gaps[i] : null;
      const r = { place: c.place, stop: s.id, island: isl ? isl[i] : 'no answer', startIsland: isl ? isl[pts.length - 1] : null, onFoot: foot[i], across: got, expectAcross: s.across, roadGap: gap, expectNoRoad: s.road === false,
        ok: got === s.across && (s.road === false ? gap > 150 : true) };
      out.push(r); console.log((r.ok ? 'ok   ' : 'FAIL ') + JSON.stringify(r)); });
    await new Promise(r => setTimeout(r, 2000));
  }
  fs.mkdirSync(path.join(__dirname, 'sources'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'sources', 'water-probe.json'), JSON.stringify({ at: new Date().toISOString(), out }, null, 1));
  console.log(out.filter(x => x.ok).length + ' of ' + out.length + ' as expected');
})();
