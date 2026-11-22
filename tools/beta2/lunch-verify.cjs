// Checks the places Beta 2 plans for lunch against the real map, today (Nov 22 2026 lunch audit): for each place in
// tools/beta2/lunch-sample.json (made by lunch-audit.cjs --json), is there a place to eat by that name on OpenStreetMap
// within 150 m, what kind it is, is it marked closed for good, and do its mapped hours say it is open at the planned
// lunch time that weekday. Read with the app's own hours reader. Needs the internet (run on GitHub, not in the app).
// Usage: node tools/beta2/lunch-verify.cjs [tools/beta2/lunch-sample.json]
const fs = require('fs'), E = require('./engine.cjs');
const list = JSON.parse(fs.readFileSync(process.argv[2] || __dirname + '/lunch-sample.json', 'utf8'));
const EPS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9Ͱ-ϿЀ-ӿ֐-׿؀-ۿ぀-ヿ一-鿿]+/g, ' ').replace(/\b(the|restaurant|ristorante|restaurante|taverna|trattoria|cafe|bar)\b/g, ' ').replace(/\s+/g, ' ').trim();
const like = (a, b) => { a = norm(a); b = norm(b); if (!a || !b) return false; if (a === b || a.includes(b) || b.includes(a)) return true;
  const A = new Set(a.split(' ')), B = b.split(' '), common = B.filter(w => A.has(w) && w.length > 2).length; return common >= Math.min(2, Math.min(A.size, B.length)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function ask(q) {
  for (let t = 0; t < 6; t++) { const url = EPS[t % EPS.length];
    try { const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'kairoute-lunch-check/1.0' } });
      if (r.ok) return await r.json(); } catch (e) {}
    await sleep(3000 * (t + 1)); }
  return null;
}
(async () => {
  const rows = []; let found = 0, gone = 0, shut = 0, unknown = 0, notFound = 0, kindOff = 0;
  for (const p of list) {
    const q = `[out:json][timeout:25];nwr(around:150,${p.lat},${p.lng})[name];out tags center 60;`;
    const j = await ask(q); await sleep(1100);
    if (!j) { rows.push(Object.assign({}, p, { state: 'no answer' })); continue; }
    const els = (j.elements || []).filter(e => e.tags && [e.tags.name, e.tags['name:en'], e.tags['name:latin'], e.tags['int_name'], e.tags['old_name']].some(n => like(n, p.name)));
    const lat = e => e.lat != null ? e.lat : e.center && e.center.lat, lng = e => e.lon != null ? e.lon : e.center && e.center.lon;
    els.sort((a, b) => E.hav(p, { lat: lat(a), lng: lng(a) }) - E.hav(p, { lat: lat(b), lng: lng(b) }));
    const e = els[0];
    if (!e) { notFound++; rows.push(Object.assign({}, p, { state: 'not on the map within 150 m' })); continue; }
    found++;
    const t = e.tags, amen = t.amenity || t.shop || t.tourism || t.leisure || '', hours = t.opening_hours || '';
    const closedForGood = /^(yes|closed)$/i.test(t.disused || '') || !!t['disused:amenity'] || !!t['was:amenity'] || /permanently/i.test(t.note || '');
    let open = null; if (hours) { const st = E.ohState(hours, p.date, p.at), st2 = E.ohState(hours, p.date, p.at + p.min - 1); open = st == null || st2 == null ? null : st === 'open' && st2 === 'open' ? 'open' : 'closed'; }
    if (closedForGood) gone++; if (open === 'closed') shut++; if (open == null) unknown++;
    const mealKind = /^(restaurant|fast_food|food_court|biergarten)$/.test(amen) || (/^(cafe|pub|bar)$/.test(amen) && /./.test(t.cuisine || ''));
    if (!mealKind) kindOff++;
    rows.push(Object.assign({}, p, { state: closedForGood ? 'closed for good on the map' : open === 'closed' ? 'shut at the planned time' : open === 'open' ? 'open at the planned time' : 'hours not on the map',
      osm: e.type + '/' + e.id, mapName: t.name, amenity: amen, cuisine: t.cuisine || '', hours, m: Math.round(E.hav(p, { lat: lat(e), lng: lng(e) }) * 1000), mealKind }));
  }
  const at = m => E.clock(m);
  for (const r of rows) console.log(`${r.state.padEnd(30)} ${String(r.city).padEnd(28)} ${r.name}${r.mapName && r.mapName !== r.name ? ' (map: ' + r.mapName + ')' : ''} · ${r.date} ${at(r.at)} · ${r.amenity || ''}${r.cuisine ? '/' + r.cuisine : ''}${r.mealKind === false ? ' NOT A MEAL PLACE' : ''}${r.hours ? ' · "' + r.hours + '"' : ''}${r.m != null ? ' · ' + r.m + ' m' : ''}`);
  console.log(`\n${list.length} places planned for lunch: ${found} found on the map by name, ${notFound} not found within 150 m; ${gone} marked closed for good; ${shut} shut at the planned time; ${unknown} with no readable hours; ${kindOff} not mapped as a place for a meal.`);
  fs.writeFileSync('lunch-verify-results.json', JSON.stringify(rows, null, 1));
})();
