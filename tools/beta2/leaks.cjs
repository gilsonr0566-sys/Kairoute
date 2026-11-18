// Beta 2 leak report: problems beyond safety that a traveler would notice, counted across every saved trip.
// A leak is any of: a public transport line serves a ride but isn't offered; a voiced, must-see or picked sight left
// out without saying why, or left out when lunch on the go would have kept it; a sight the old engine planned that the
// new one leaves out; a name shown in a non-Latin script (Greek, Cyrillic, Arabic, Hebrew, Asian); a ride without its
// start, end or way of travel. Usage: PLACES_DIR=tools/places/data node tools/beta2/leaks.cjs [--list]
// Exit 1 when any leak is found (CI can gate on it once the known ones are fixed).
const fs = require('fs'), path = require('path'), E = require('./engine.cjs');
const dir = path.join(__dirname, 'snapshots'), list = process.argv.includes('--list');
const PD = process.env.PLACES_DIR, places = {};
if (PD) for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; }
const SCRIPT = /[Ͱ-Ͽἀ-῿Ѐ-ӿ֐-׿؀-ۿ฀-๿぀-ヿ㐀-鿿가-힯]/;
const leaks = { transit: [], wanted: [], lostVsOld: [], script: [], ride: [] };
const add = (k, f, msg) => leaks[k].push(`${f}: ${msg}`);
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  const raw = JSON.parse(fs.readFileSync(path.join(dir, f))), s = PD ? E.applyPlaces(JSON.parse(JSON.stringify(raw)), places) : raw;
  const plans = E.planTrip(s), tr = E.makeTravel(s.prefs, s.legModes), lines = s.transit || [];
  const planned = new Set(); plans.forEach(p => p && p.items && p.items.forEach(x => { if (x.t === 'stop') planned.add(String(x.id)); }));
  const said = plans.map(p => (p && p.explain || []).join(' '));
  const walkMin = km => Math.max(1, Math.round(km * 1.3 / ((s.prefs || {}).walk === 'low' ? 3.6 : 4.5) * 60));
  plans.forEach((p, i) => {
    if (!p || !p.items) return; const d = s.days[i], city = s.cities[d.city] || {};
    p.items.forEach((x, k) => {
      if (x.name && SCRIPT.test(x.name)) add('script', f, `day ${i}: "${x.name}"`);
      if (x.t !== 'ride') return;
      if (!x.mode || !x.from || !x.to || !isFinite(x.from.lat) || !isFinite(x.to.lat)) add('ride', f, `day ${i}: ride ${k} lacks ${!x.mode ? 'its way of travel' : 'its start or end'}`);
      const a = p.items[k - 1], b = p.items[k + 1];
      if (lines.length && a && b && isFinite(a.lat) && isFinite(b.lat)) { const km = E.hav(a, b);
        if (km >= 0.6 && km <= 15) { const t = E.transitOption(a, b, lines, walkMin); if (t && t.min < walkMin(km) && !(x.options || []).some(o => o.mode === 'transit')) add('transit', f, `day ${i}: ${a.name} to ${b.name}: ${t.how} isn't offered`); } }
    });
    // Wanted sights of a place seen on this day only (or picked for this day) that no day plans.
    const oneDay = s.days.filter(e => e.city === d.city && !e.noShore).length === 1;
    const wanted = (city.sites || []).filter(x => (d.selected || []).map(String).includes(String(x.id)) || (oneDay && E.ownStop(x)));
    for (const w of wanted) { if (planned.has(String(w.id))) continue;
      const why = said[i].includes(w.name) || (p.leftOut || []).map(String).includes(String(w.id));
      if (!why) add('wanted', f, `day ${i}: ${w.name} left out without a word`);
      else if (p.waysToFit && (p.waysToFit[w.id] || []).some(o => o.kind === 'lunchToGo')) add('wanted', f, `day ${i}: ${w.name} left out though lunch on the go keeps it`); }
  });
  // Every sight the old engine planned, kept somewhere in the new plan (or said why not).
  (raw.old || []).forEach((o, i) => { if (!o || !o.items) return; for (const x of o.items) { if (x.t !== 'stop' || x.id == null || planned.has(String(x.id))) continue;
    add('lostVsOld', f, `day ${i}: ${x.name}${said[i] && said[i].includes(x.name) ? ' (the plan says why)' : ' (no reason given)'}`); } });
}
let total = 0;
const label = { transit: 'public transport not offered', wanted: 'voiced, must-see or picked sight left out', lostVsOld: 'sight the old engine planned, left out', script: 'name in a non-Latin script', ride: 'ride without start, end or way of travel' };
for (const k of Object.keys(leaks)) { total += leaks[k].length; console.log(`${String(leaks[k].length).padStart(4)}  ${label[k]}`); if (list) leaks[k].forEach(m => console.log('      ' + m)); }
console.log(`${String(total).padStart(4)}  leaks in all${PD ? ' (with the places files)' : ''}`);
process.exit(total ? 1 : 0);
