// R-06 in every city: a stop across the water is a boat away in a city with no place file too. In the built app: a
// place with no island outlines of its own gets the helper's (/islands), and the engine marks a stop on an island no
// path reaches as across the water. The helper's answer is put in by hand (no internet in the gate). Then the app with
// the helper's outlines left out is planted on every run, and this check must fail on it.
// Usage: node tools/beta2/isles-any-city-check.cjs [beta2-site/index.html]
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { chromium } = require('playwright');
const SITE = path.resolve(process.argv[2] || 'beta2-site/index.html');
const want = 'return out || P2; }';
async function run(file) {
  const b = await chromium.launch(); const p = await b.newPage();
  try { await p.goto('file://' + file); await p.waitForFunction(() => window.__kairoutePlacesWithIsles && window.KEngine, null, { timeout: 30000 });
    return await p.evaluate(() => {
      const ring = [42.63, 18.115, 42.63, 18.13, 42.62, 18.13, 42.62, 18.115, 42.63, 18.115];
      const bucket = { cities: { 'no-file-port': { key: 'no-file-port', sites: [{ id: 'isl', name: 'Isle sight', lat: 42.625, lng: 18.122, minutes: 60 }, { id: 'town', name: 'Old town', lat: 42.641, lng: 18.11, minutes: 60 }], farther: [], restaurants: [] } },
        days: [{ city: 'no-file-port', point: { lat: 42.65, lng: 18.09 } }] };
      window.__kairouteIsles().set('no-file-port', { shapes: [{ id: 'w1', name: 'Isle', rings: [ring], walk: false }], centreShape: null, km: 12, open: 0 });
      const out = window.KEngine.applyPlaces(bucket, window.__kairoutePlacesWithIsles(bucket)), s = out.cities['no-file-port'].sites;
      // A place file whose build left the island "not known" takes the helper's answer for the same island.
      window.PLACES2 = Object.assign({}, window.PLACES2, { 'file-port': { key: 'file-port', islands: { shapes: [{ id: 'w2', name: 'Isle', rings: [ring], walk: null }], centreShape: null, km: 12 } } });
      const b2 = { cities: { 'file-port': JSON.parse(JSON.stringify(bucket.cities['no-file-port'])) }, days: [{ city: 'file-port', point: { lat: 42.65, lng: 18.09 } }] };
      b2.cities['file-port'].key = 'file-port';
      window.__kairouteIsles().set('file-port', { shapes: [{ id: 'w2', name: 'Isle', rings: [ring], walk: false }], centreShape: null, km: 12, open: 0 });
      const s2 = window.KEngine.applyPlaces(b2, window.__kairoutePlacesWithIsles(b2)).cities['file-port'].sites;
      return { isle: (s.find(x => x.id === 'isl') || {}).acrossWater || null, town: (s.find(x => x.id === 'town') || {}).acrossWater || null, fileIsle: (s2.find(x => x.id === 'isl') || {}).acrossWater || null }; }); }
  finally { await b.close(); }
}
(async () => {
  const bad = []; const r = await run(SITE);
  if (!r.isle) bad.push('a stop on an island no path reaches, in a city with no place file, is not marked across the water');
  if (r.town) bad.push('a stop on the mainland was marked across the water');
  if (!r.fileIsle) bad.push('a place file island its build left "not known" did not take the helper\'s answer');
  const html = fs.readFileSync(SITE, 'utf8'); if (!html.includes(want)) { console.log('FAIL the planted copy could not be made: the app text it changes is gone'); process.exit(1); }
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'isles-plant-')), 'index.html'); fs.writeFileSync(tmp, html.replace(want, 'return P2; }'));
  const pl = await run(tmp); const seen = !pl.isle && !pl.fileIsle;
  for (const m of bad) console.log('FAIL ' + m);
  console.log(`planted (helper outlines left out): ${seen ? 'caught' : 'NOT caught - BLIND'}`);
  console.log(`isles-any-city-check: ${bad.length ? bad.length + ' failed' : 'all passed'}`);
  process.exit(bad.length || !seen ? 1 : 0);
})();
