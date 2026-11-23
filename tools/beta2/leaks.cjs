// Beta 2 leak report: problems beyond safety that a traveler would notice, counted across every saved trip.
// A leak is any of: a public transport line serves a ride but isn't offered; a voiced, must-see or picked sight left
// out without saying why, or left out when lunch on the go would have kept it; a sight the old engine planned that the
// new one leaves out; a name shown in a non-Latin script (Greek, Cyrillic, Arabic, Hebrew, Asian); a ride without its
// start, end or way of travel; a day planned from a port far from every sight; a sight seen only from the water reached
// by land. Usage: PLACES_DIR=tools/places/data node tools/beta2/leaks.cjs [--list]
// Exit 1 when any leak is found (CI can gate on it once the known ones are fixed).
const fs = require('fs'), path = require('path'), E = require('./engine.cjs');
const dir = process.env.SNAP_DIR || path.join(__dirname, 'snapshots'), list = process.argv.includes('--list');
const PD = process.env.PLACES_DIR, places = {};
if (PD) for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; }
const SCRIPT = /[Ͱ-Ͽἀ-῿Ѐ-ӿ֐-׿؀-ۿ฀-๿぀-ヿ㐀-鿿가-힯]/;
const leaks = { transit: [], wanted: [], lostVsOld: [], thin: [], script: [], ride: [], gate: [], water: [], twice: [], cross: [], mealTime: [], mealOff: [], mealAgain: [], longWalk: [], shortRide: [] };
const swaps = [];
const add = (k, f, msg) => leaks[k].push(`${f}: ${msg}`);
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  const raw = JSON.parse(fs.readFileSync(path.join(dir, f))), s = PD ? E.applyPlaces(JSON.parse(JSON.stringify(raw)), places) : raw;
  const plans = E.planTrip(s), tr = E.makeTravel(s.prefs, s.legModes), lines = s.transit || [];
  const planned = new Set(); plans.forEach(p => p && p.items && p.items.forEach(x => { if (x.t === 'stop') { planned.add(String(x.id)); (x.includesIds || []).forEach(m => planned.add(String(m))); } }));
  const said = plans.map(p => (p && p.explain || []).join(' '));
  const walkMin = km => Math.max(1, Math.round(km * 1.3 / ((s.prefs || {}).walk === 'low' ? 3.6 : 4.5) * 60));
  const eatDays = new Map();
  plans.forEach((p, i) => {
    if (!p || !p.items) return; const d = s.days[i], city = s.cities[d.city] || {};
    // Organizer: the day's stops in an order that doesn't waste travel. Compared with the best order for the same stops
    // between the same start and end, the plan may spend extra time only for a reason (opening hours, lunch, a trip out
    // kept as one block); more than 20 minutes extra is a leak.
    { const w = E.dayWindow(d, tr); const st = p.items.filter(x => x.t === 'stop' && isFinite(x.lat));
      if (w && !w.error && st.length >= 3) { const from = w.head[w.head.length - 1], to = w.tail.length ? w.tail[0] : null;
        const best = E.bestOrder(st.slice().sort(E.byId), from, to, tr.min), cost = seq => E.pathCost(seq, from, to, tr.min);
        const extra = Math.round(cost(st) - cost(best));
        // The best order for travel alone may miss a sight's opening hours or the time to be back (Nov 23: a museum
        // that shuts at 3 pm put last); then the extra travel has its reason and isn't a leak.
        const bySite = x => [].concat(city.sites || [], city.farther || []).find(y => String(y.id) === String(x.id)) || Object.assign({}, x, { minutes: x.min });
        // The day's lunch takes time too: the order is walked with the plan's own lunch length put after whichever stop
        // brings it nearest midday (a museum reached after lunch may then be shut).
        const meal = p.items.find(x => x.t === 'meal'), mealMin = meal ? Math.max(30, meal.min || meal.minutes || 60) : 0;
        const walk = seq => E.walkDay(seq, w, tr.estimate, id => (d.sites || {})[id] || null), score = r => r.late * 1000 + r.over;
        const fits = seq => { try { const ss = seq.map(bySite); if (!mealMin) return score(walk(ss));
          let bestR = null; for (let k = 1; k <= ss.length; k++) { const prev = ss[k - 1], lunch = { id: '__lunch', name: 'lunch', lat: prev.lat, lng: prev.lng, minutes: mealMin, indoor: true };
            const r = walk(ss.slice(0, k).concat([lunch], ss.slice(k))), at = (r.items.find(x => x.t === 'stop' && x.id === '__lunch') || {}).at;
            if (at != null && at >= 690 && at <= 900) { const sc = score(r); if (bestR == null || sc < bestR) bestR = sc; } }
          return bestR == null ? score(walk(ss)) : bestR; } catch (e) { return 0; } };
        if (extra > 20 && !st.some(x => x.far) && fits(best) <= fits(st)) add('cross', f, `day ${i}: ${extra} min more travel than the best order (${st.map(x => x.name).join(' > ')}; best: ${best.map(x => x.name).join(' > ')})`); } }
    // Restaurants: lunch between 11:30 and 15:00, dinner from 17:30; a meal stop near the way; a place not repeated.
    p.items.forEach((x, k) => { if (x.t !== 'meal' && x.t !== 'evening') return; const lunch = (x.meal || 'Lunch') === 'Lunch' && x.t === 'meal';
      if (lunch && (x.at < 690 || x.at > E.MEALS[0].to + E.MEAL_LATE)) add('mealTime', f, `day ${i}: lunch at ${E.clock(x.at)} (${x.name})`);
      if (!lunch && x.at < 1050) add('mealTime', f, `day ${i}: dinner at ${E.clock(x.at)} (${x.name})`);
      const a = p.items.slice(0, k).reverse().find(y => isFinite(y.lat) && y.t !== 'ride'), b = p.items.slice(k + 1).find(y => isFinite(y.lat) && y.t !== 'ride');
      // (before a ride out of town the lunch is measured from the last stop in town: the ride out leaves from the city, so
      // the meal costs at most the way from that stop to it; eating where the ride out arrives is on the way too)
      const off = !b || E.hav(a || x, b) > 10 ? (a ? (b ? Math.min(E.hav(a, x), E.hav(x, b)) : E.hav(a, x)) : 0) : E.hav(a, x) + E.hav(x, b) - E.hav(a, b);
      if (lunch && a && b && isFinite(x.lat) && off > 1.6) add('mealOff', f, `day ${i}: ${x.name} adds ${off.toFixed(1)} km between ${a.name} and ${b.name}`);
      if (x.name && !x.packed && !x.onBoard) { const was = eatDays.get(x.name); if (was != null && was !== i) add('mealAgain', f, `${x.name} on day ${was} and day ${i}`); else eatDays.set(x.name, i); } });
    // Path and transport: no long walk where a ride is offered; no taxi for a few steps.
    p.items.forEach((x, k) => { if (x.t !== 'ride') return; const a = p.items[k - 1], b = p.items[k + 1]; if (!a || !b || !isFinite(a.lat) || !isFinite(b.lat)) return; const km = E.hav(a, b);
      if (x.mode === 'walk' && km > 2.5 && (x.options || []).some(o => o.mode !== 'walk')) add('longWalk', f, `day ${i}: ${km.toFixed(1)} km on foot, ${a.name} to ${b.name}`);
      if (x.mode === 'ride' && km < 0.6 && !b.backToShip && !/ship|port|terminal|pier|station|airport/i.test(b.name + ' ' + a.name)) add('shortRide', f, `day ${i}: taxi for ${Math.round(km * 1000)} m, ${a.name} to ${b.name}`); });
    // A port or gate far from every sight of the place, planned anyway (a lookup put it on the wrong island).
    { const P = d.point, spots = (city.sites || []).filter(x => isFinite(x.lat)), named = (d.city + ' ' + (city.name || '')).toLowerCase();
      const words = String(P && P.name || '').toLowerCase().split(/[^a-z]+/).filter(x => x.length >= 4 && !/^(port|ports|cruise|terminal|pier|harbou?r|marina|station|central|airport|international|ferry)$/.test(x));
      if (P && isFinite(P.lat) && spots.length && d.type !== 'land' && !words.some(x => named.includes(x))) { const km = Math.min(...spots.map(x => E.hav(P, x)));
        if (km > 40) add('gate', f, `day ${i}: planned from ${P.name}, ${Math.round(km)} km from every sight`); } }
    // The same sight twice in one day.
    { const ids = p.items.filter(x => x.t === 'stop' && x.id != null).map(x => String(x.id)); const twice = ids.filter((x, k) => ids.indexOf(x) !== k);
      if (twice.length) add('twice', f, `day ${i}: ${[...new Set(twice)].join(', ')} planned twice`); }
    p.items.forEach((x, k) => {
      if (x.name && SCRIPT.test(x.name)) add('script', f, `day ${i}: "${x.name}"`);
      // A sight seen only from the water: reached by boat, never by land.
      if (x.t === 'stop') { const st = (city.sites || []).find(y => String(y.id) === String(x.id));
        if (st && E.waterOnly(st)) { const legs = [p.items[k - 1], p.items[k + 1]].filter(y => y && y.t === 'ride');
          if (legs.some(y => y.mode !== 'boat')) add('water', f, `day ${i}: ${x.name} is seen from the water but is reached by ${legs.map(y => y.mode).join('/')}`); } }
      if (x.t !== 'ride') return;
      [x.how].concat((x.options || []).map(o => o.how)).filter(h => h && SCRIPT.test(h)).forEach(h => add('script', f, `day ${i}: ride "${h}"`));
      if (!x.mode || !x.from || !x.to || !isFinite(x.from.lat) || !isFinite(x.to.lat)) add('ride', f, `day ${i}: ride ${k} lacks ${!x.mode ? 'its way of travel' : 'its start or end'}`);
      const a = p.items[k - 1], b = p.items[k + 1];
      if (lines.length && a && b && isFinite(a.lat) && isFinite(b.lat)) { const km = E.hav(a, b);
        if (km >= 0.6 && km <= 15) { const t = E.transitOption(a, b, lines, walkMin); if (t && t.min < walkMin(km) && !(x.options || []).some(o => o.mode === 'transit')) add('transit', f, `day ${i}: ${a.name} to ${b.name}: ${t.how} isn't offered`); } }
    });
    // A thin day: three hours or more left unused, and the plan doesn't say what to do with them.
    { const w = E.dayWindow(d, tr), spare = w && isFinite(w.endBy) && isFinite(p.end) ? w.endBy - p.end : 0;
      if (spare >= 180 && !/time left|free time|at leisure|day is yours/i.test(said[i])) add('thin', f, `day ${i} (${d.type}): ${Math.floor(spare / 60)} h ${spare % 60} min left unused, ${p.items.filter(x => x.t === 'stop').length} stops`); }
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
    // A leak when the new day leaves the time unused and says nothing; a full day that chose other sights is a swap.
    const p = plans[i], w = p && !p.error && E.dayWindow(s.days[i], tr), spare = w && isFinite(w.endBy) && isFinite(p.end) ? w.endBy - p.end : 0;
    // Free time is the traveler's (Nov 18, Richard): unused time that offers sights to add is the plan's answer.
    const why = (said[i] && said[i].includes(x.name)) || (p && (p.suggest || []).length > 0);
    if (!why && spare >= (x.min || 30) + 20) add('lostVsOld', f, `day ${i}: ${x.name} (${spare} min left unused, no reason given)`); else swaps.push(`${f}: day ${i}: ${x.name}${why ? ' (the plan says why)' : ' (day full, other sights chosen)'}`); } });
}
let total = 0;
const label = { twice: 'same sight twice in a day', cross: 'stops in an order that wastes 20+ min of travel', mealTime: 'lunch or dinner at an odd hour', mealOff: 'meal stop far off the way', mealAgain: 'same restaurant on two days', longWalk: 'long walk (over 2.5 km) where a ride is offered', shortRide: 'taxi for a short hop (under 600 m)', transit: 'public transport not offered', wanted: 'voiced, must-see or picked sight left out', lostVsOld: 'sight the old engine planned, left out', thin: 'thin day: 3 hours or more unused, nothing said', script: 'name in a non-Latin script', ride: 'ride without start, end or way of travel', gate: 'planned from a port or gate far from every sight', water: 'sight seen only from the water, reached by land' };
for (const k of Object.keys(leaks)) { total += leaks[k].length; console.log(`${String(leaks[k].length).padStart(4)}  ${label[k]}`); if (list) leaks[k].forEach(m => console.log('      ' + m)); }
console.log(`      (${swaps.length} sights the old engine planned were swapped for others on a full day, or left out with the reason said)`); if (list) swaps.forEach(m => console.log('        ' + m));
console.log(`${String(total).padStart(4)}  leaks in all${PD ? ' (with the places files)' : ''}`);
process.exit(total ? 1 : 0);
