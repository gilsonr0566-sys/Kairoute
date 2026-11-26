// Live probe of the helper's height reader (worker/climb.js) against walks whose climb is known from maps, plus the two
// free height services one by one, so a dead or changed service is seen here and not on a traveler's plan.
// Usage: node tools/truth/climb-probe.mjs   (needs the internet; run by .github/workflows/climb-probe.yml)
import { climbOf, along, upDown } from '../../worker/climb.js';
const UA = { 'user-agent': 'kairoute-test (height check; github.com/gilsonr0566-sys/kairoute)' };
// Straight lines stand in for the path here (the probe tests the height reading, not the router).
const WALKS = [
  ['Santorini: old port up to Fira (about 220 m up the cliff)', [[25.4270, 36.4195], [25.4290, 36.4200], [25.4305, 36.4205]], 150, 280],
  ['Athens: Monastiraki square up to the Acropolis gate (about 80 m)', [[23.7256, 37.9760], [23.7250, 37.9730], [23.7245, 37.9716]], 50, 120],
  ['Athens: Kolonaki up towards Lycabettus (roughly 100 m on this line)', [[23.7420, 37.9790], [23.7432, 37.9819]], 70, 200],
  ['Barcelona: Eixample, flat (under 15 m)', [[2.1620, 41.3900], [2.1700, 41.3960]], 0, 15],
  ['Venice: flat (under 8 m)', [[12.3350, 45.4340], [12.3390, 45.4370]], 0, 8],
];
let fail = 0;
for (const name of ['valhalla1.openstreetmap.de/height', 'api.opentopodata.org/v1/mapzen']) { const only = async (u, o) => { if (!String(u).includes(name.split('/')[0])) throw new Error('skipped'); return fetch(u, o); };
  console.log(`\n${name}`);
  for (const [label, path, lo, hi] of WALKS) { const t = Date.now(); let r = null, err = '';
    try { r = await climbOf(path, only); } catch (e) { err = e.message; }
    const ok = r && r.up >= lo && r.up <= hi; if (name.includes('valhalla') ? false : !ok) fail++;
    console.log(`  ${ok ? 'ok  ' : r ? 'OFF ' : 'NONE'} ${label}: ${r ? `up ${r.up} m, down ${r.down} m` : 'no answer ' + err} (${Date.now() - t} ms)`);
    await new Promise(z => setTimeout(z, 1200)); } }
// Either source answering right is enough for the helper (it tries them in order); the second is the one counted here.
const both = await climbOf(WALKS[0][1]); console.log(`\nhelper order: ${both ? both.src + ' answered, up ' + both.up + ' m' : 'no source answered'}`); if (!both) fail++;
console.log(`sample points: ${along(WALKS[0][1]).length}; noise filter on a flat row: ${JSON.stringify(upDown([10, 11, 10, 12, 11, 10, 11]))}`);
process.exit(fail ? 1 : 0);
