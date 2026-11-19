// Beta 2 stress scenarios for the day-planning core (Nov 19, Richard: "we can't move on till we have nailed this").
// Every day of every test trip, with the places files, planned again under harder conditions:
//   - a ship day with all aboard 90 and 180 minutes earlier, and arriving 60 minutes later
//   - a traveler who walks little, and one who walks a lot
//   - the day's stops in three dragged orders (reversed, rotated, odd-then-even)
//   - a land day starting two hours later
//   - the planner's own order against every single move of one stop: no day crosses back and forth (Nov 19, Richard's
//     Corinth day went 1 east, 2 west, 3 east, 4 west) when another order keeps every stop, lunch and the finish time
//     and rides 20 minutes (and a fifth) less
// Each plan is checked for the core rules: nothing past the time to be back (and the day back in time), no ride of no
// time between places apart, no NaN time, no stop reached after its last entry, no meal when the place is shut, lunch
// on a day over lunchtime or said why not, every pick planned or said why not, a dragged order kept, no engine error.
// No AI, no network. Usage: node tools/beta2/stress.cjs [--list]
const fs = require('fs'), path = require('path'), E = require('./engine.cjs');
const dir = path.join(__dirname, 'snapshots'), PD = path.join(__dirname, '..', 'places', 'data'), list = process.argv.includes('--list');
const places = {}; if (fs.existsSync(PD)) for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; }
const out = {}, add = (k, m) => { (out[k] = out[k] || new Set()).add(m); };
const label = { error: 'engine error', past: 'past the time to be back', zero: 'ride of no time between places apart', nan: 'time not a number',
  late: 'stop reached after its last entry', shut: 'meal when the place is shut', lunch: 'no lunch over lunchtime, nothing said',
  pick: 'pick left out, nothing said', order: 'dragged order not kept', guess: 'guessed ride on a ship day',
  zigzag: 'order crosses back and forth when a better one keeps everything' };
const rideMin = p => p.items.filter(x => x.t === 'ride').reduce((a, x) => a + (x.min || 0), 0);
const hasLunch = p => p.items.some(x => (x.t === 'meal' && x.meal === 'Lunch') || x.lunchIn);
let plans = 0;
const check = (tag, s, i, p, want) => {
  plans++; const d = s.days[i]; if (!p) return; if (p.error) return; if (!p.items) return;
  const hard = /port|embark|departure/.test(d.type), said = (p.explain || []).join(' ');
  if (!p.safe && isFinite(p.endBy)) {
    if (hard && p.end > p.endBy + 0.5) add('past', `${tag}: back ${E.clock(p.end)}, after ${E.clock(p.endBy)}`);
    p.items.forEach(x => { if (x.t === 'stop' && hard && x.at + (x.min || 0) > p.endBy + 0.5) add('past', `${tag}: ${x.name} ends ${E.clock(x.at + x.min)}`); });
  }
  p.items.forEach((x, k) => {
    if (x.at != null && !isFinite(x.at)) add('nan', `${tag}: ${x.t} ${x.name || ''}`);
    if (x.t === 'ride' && !isFinite(x.min)) add('nan', `${tag}: ride ${k}`);
    if (x.t === 'ride' && x.mode !== 'lift' && x.from && x.to && E.hasPos(x.from) && E.hasPos(x.to) && E.hav(x.from, x.to) > 0.05 && !(x.min > 0)) add('zero', `${tag}: ride ${k}`);
    if (x.t === 'ride' && hard && x.guess) add('guess', `${tag}: ride ${k}`);
    if (x.t === 'stop' && x.late) add('late', `${tag}: ${x.name}`);
    if (x.t === 'meal' && x.shut) add('shut', `${tag}: ${x.name}`);
  });
  if (p.safe) return;
  const st = p.items.filter(x => x.t === 'stop');
  const w = E.dayWindow(d, E.makeTravel(s.prefs, s.legModes));
  const c = s.cities[d.city] || {}, eats = (c.restaurants || []).length || (c.farther || []).some(t => (t.foodDrink || []).length);
  if (w && !w.error && E.lunchWanted(w) && st.length && eats && !((d.mealPrefs || {}).Lunch || {}).skip && !p.items.some(x => x.t === 'meal' && x.meal === 'Lunch') && !p.items.some(x => x.lunchIn)
    && !/lunch/i.test(said)) add('lunch', `${tag}`);
  for (const id of want.picks || []) { const sx = (c.sites || []).concat(c.farther || []).find(y => String(y.id) === String(id));
    if (sx && !st.some(x => String(x.id) === String(id) || (x.includesIds || []).map(String).includes(String(id))) && !said.includes(sx.name) && !said.includes(String(sx.name).split(',')[0])) add('pick', `${tag}: ${sx.name}`); }
  if (want.order) { const got = st.map(x => String(x.id)).filter(id => want.order.includes(id)), exp = want.order.filter(id => got.includes(id));
    if (got.join('>') !== exp.join('>')) add('order', `${tag}: wanted ${exp.join('>')}, got ${got.join('>')}`); }
};
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  const base = E.applyPlaces(JSON.parse(fs.readFileSync(path.join(dir, f))), places);
  let first; try { first = E.planTrip(base); } catch (e) { add('error', `${f}: ${e.message}`); continue; }
  base.days.forEach((d, i) => {
    if (d.noShore || d.type === 'sea' || !first[i] || !first[i].items) return;
    const ids = first[i].items.filter(x => x.t === 'stop').map(x => String(x.id));
    // The planner's order: each single move of one stop, planned as the traveler's own order.
    if (ids.length >= 3 && !d.order) { const p0 = first[i], r0 = rideMin(p0); let best = null;
      for (let a = 0; a < ids.length; a++) for (let b = 0; b < ids.length; b++) { if (a === b || b === a - 1) continue;
        const o = ids.slice(); o.splice(b, 0, o.splice(a, 1)[0]);
        const s = Object.assign({}, base, { days: base.days.map((e, j) => j === i ? Object.assign({}, e, { order: o }) : e) });
        let q; try { q = E.planTrip(s)[i]; } catch (e) { continue; } if (!q || !q.items || q.safe) continue;
        const qs = q.items.filter(x => x.t === 'stop').map(x => String(x.id));
        if (qs.slice().sort().join() !== ids.slice().sort().join() || q.items.some(x => x.late) || q.end > p0.end + 1 || (hasLunch(p0) && !hasLunch(q))) continue;
        const r = rideMin(q); if (!best || r < best.r) best = { r, o }; }
      if (best && r0 - best.r >= Math.max(20, r0 / 5)) add('zigzag', `${f} day ${i + 1} (${d.city}): ${ids.join('>')} rides ${r0} min, ${best.o.join('>')} ${best.r} min`); }
    const vars = [];
    if (d.type === 'port' && isFinite(d.allAboard)) {
      vars.push(['all aboard 90 min earlier', { allAboard: d.allAboard - 90 }], ['all aboard 180 min earlier', { allAboard: d.allAboard - 180 }]);
      if (isFinite(d.portArrive)) vars.push(['ship 60 min late', { portArrive: d.portArrive + 60 }]);
    }
    if (d.type === 'land' && d.startTime) vars.push(['starting 2 h later', { startTime: E.clock ? String(Math.floor(E.toMin(d.startTime) / 60) + 2).padStart(2, '0') + ':' + String(E.toMin(d.startTime) % 60).padStart(2, '0') : d.startTime }]);
    const run = (name, dayPatch, sPatch, want) => {
      const s = Object.assign({}, base, sPatch || {}, { days: base.days.map((e, j) => j === i ? Object.assign({}, e, dayPatch) : e) });
      let p; try { p = E.planTrip(s)[i]; } catch (e) { add('error', `${f} day ${i + 1} (${name}): ${e.message}`); return; }
      check(`${f} day ${i + 1} (${d.city}, ${name})`, s, i, p, want || {});
    };
    for (const [name, patch] of vars) run(name, patch);
    run('walks little', {}, { prefs: Object.assign({}, base.prefs, { walk: 'low' }) });
    run('walks a lot', {}, { prefs: Object.assign({}, base.prefs, { walk: 'high' }) });
    if (ids.length >= 3) {
      const orders = [ids.slice().reverse(), ids.slice(1).concat(ids[0]), ids.filter((x, k) => k % 2).concat(ids.filter((x, k) => !(k % 2)))];
      orders.forEach((o, k) => run('dragged order ' + (k + 1), { order: o, selected: ids, mine: ids, own: true }, null, { order: o, picks: ids }));
    }
  });
}
let total = 0;
for (const k of Object.keys(label)) { const n = out[k] ? out[k].size : 0; total += n; console.log(`${String(n).padStart(4)}  ${label[k]}`); if (list && n) [...out[k]].slice(0, 25).forEach(m => console.log('      ' + m)); }
console.log(`${String(total).padStart(4)}  problems in ${plans} stress plans`);
process.exit(total ? 1 : 0);
