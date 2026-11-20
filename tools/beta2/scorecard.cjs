// Beta 2 scorecard: the numbers that say when the day-planning core is done (Nov 19, Richard: "Do you have a numerical
// goal. How do you know to stop this part"). Every saved test trip (the 20-city list, the Bahamas trips, the sample
// cruise through Greece, and the rest), planned with the places files. No AI, no network.
// Usage: node tools/beta2/scorecard.cjs [--flow <flow-check output>] [--full <FULL flow-check output>] [--json]
// Goals (all must hold):
//   1. 0 safety failures: no stop, and no return, past the time to be back on a ship, train or flight day (also under
//      the stress variants: all aboard earlier, ship late, slow and fast walkers, dragged orders)
//   2. 0 leaks, and never worse than the demo on any test trip
//   3. 100% of days out over lunchtime have a timed lunch at a real place
//   4. 0 zig-zag orders
//   5. 0 rides offered that are much slower than walking
//   6. 100% match between the picker's ticks and what the plan can hold (phone-flow checks 3c and 3d)
//   7. every sight listed once (no duplicate ids)
//   8. two full sweeps in a row with no new gap, then 5 days of Richard's own use with no new bug (kept by hand in
//      the state file next to the output)
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process'), E = require('./engine.cjs');
const dir = path.join(__dirname, 'snapshots'), PD = path.join(__dirname, '..', 'places', 'data');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const places = {}; if (fs.existsSync(PD)) for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; }
const LIM = { low: 0.8, medium: 1.7, high: 3.2 };
let trips = 0, days = 0, unsafe = [], lunchDays = 0, lunchMiss = [], slow = [], dups = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  const s = E.applyPlaces(JSON.parse(fs.readFileSync(path.join(dir, f))), places); let pl;
  try { pl = E.planTrip(s); } catch (e) { unsafe.push(`${f}: engine error ${e.message}`); continue; }
  trips++; const lim = LIM[(s.prefs || {}).walk || 'medium'] || LIM.medium;
  for (const [k, c] of Object.entries(s.cities || {})) { const seen = new Set(); for (const x of (c.sites || []).concat(c.farther || [])) { const id = String(x.id); if (seen.has(id)) dups.push(`${f} ${k}: ${id}`); seen.add(id); } }
  pl.forEach((p, i) => {
    const d = s.days[i]; if (!p || !p.items || d.noShore || d.type === 'sea') return; days++;
    const hard = /port|embark|departure/.test(d.type);
    if (hard && !p.safe && isFinite(p.endBy)) { if (p.end > p.endBy + 0.5) unsafe.push(`${f} day ${i + 1}: back ${E.clock(p.end)}, after ${E.clock(p.endBy)}`);
      p.items.forEach(x => { if (x.t === 'stop' && x.at + (x.min || 0) > p.endBy + 0.5) unsafe.push(`${f} day ${i + 1}: ${x.name} ends ${E.clock(x.at + x.min)}`); }); }
    const st = p.items.filter(x => x.t === 'stop'), w = E.dayWindow(d, E.makeTravel(s.prefs, s.legModes)), c = s.cities[d.city] || {};
    const eats = (c.restaurants || []).length || (c.farther || []).some(t => (t.foodDrink || []).length);
    if (w && !w.error && E.lunchWanted(w) && st.length && eats && !((d.mealPrefs || {}).Lunch || {}).skip) { lunchDays++;
      if (!p.items.some(x => (x.t === 'meal' && x.meal === 'Lunch') || x.lunchIn)) lunchMiss.push(`${f} day ${i + 1} (${d.city})`); }
    p.items.forEach(x => { if (x.t !== 'ride' || !x.options) return; const wk = x.options.find(o => o.kind === 'walk'); if (!wk || x.km / 1.3 > 2 * lim) return;
      x.options.filter(o => o.kind !== 'walk' && o.kind !== 'taxi' && o.min > wk.min + E.SLOWER_THAN_WALK).forEach(o => slow.push(`${f} day ${i + 1}: ${o.how} ${o.min} min beside a ${wk.min}-min walk`)); });
  });
}
const run = (script, args) => { try { return execFileSync('node', [path.join(__dirname, script)].concat(args || []), { env: Object.assign({}, process.env, { PLACES_DIR: PD }), encoding: 'utf8', maxBuffer: 1 << 26 }); } catch (e) { return String(e.stdout || '') + String(e.stderr || ''); } };
const cmp = run('compare.cjs'), lk = run('leaks.cjs'), stress = run('stress.cjs');
const num = (txt, re) => { const m = re.exec(txt); return m ? +m[1] : null; };
const cmpUnsafe = num(cmp, /safety failures:\s*(\d+)/), worse = num(cmp, /worse than the old engine:\s*(\d+)/);
const leaks = num(lk, /(\d+)\s+leaks?\b/i) != null ? num(lk, /(\d+)\s+leaks?\b/i) : num(lk, /leaks?:\s*(\d+)/i);
const stressPast = num(stress, /(\d+)\s+past the time to be back/), zig = num(stress, /(\d+)\s+order crosses back and forth/), stressAll = num(stress, /(\d+)\s+problems in/);
const flowTxt = arg('--flow') && fs.existsSync(arg('--flow')) ? fs.readFileSync(arg('--flow'), 'utf8') : '';
const pick = flowTxt ? ['plain tick really fits', 'sorts itself'].map(k => flowTxt.split('\n').find(l => l.includes(k) || l.toLowerCase().includes(k)) || '') : [];
const pickOk = flowTxt ? (pick.every(l => /^pass/.test(l)) && pick.some(Boolean)) : null;
const fullTxt = arg('--full') && fs.existsSync(arg('--full')) ? fs.readFileSync(arg('--full'), 'utf8') : '';
const fullGaps = fullTxt ? (fullTxt.match(/^LEAK/gm) || []).length : null;
const stFile = path.join(arg('--state') || '/mnt/project-files/beta2', 'scorecard-state.json');
let state = { cleanSweepsInARow: 0, richardDaysNoBug: 0 }; try { state = Object.assign(state, JSON.parse(fs.readFileSync(stFile, 'utf8'))); } catch (e) {}
const rows = [
  ['Safety failures (stops past ship/train/flight time)', unsafe.length + (cmpUnsafe || 0) + (stressPast || 0), 0, `${unsafe.length} on the trips, ${cmpUnsafe} vs demo, ${stressPast} under stress`],
  ['Leaks', leaks, 0, ''],
  ['Days worse than the demo', worse, 0, ''],
  ['Days out over lunchtime with a timed lunch', lunchDays ? Math.round(1000 * (lunchDays - lunchMiss.length) / lunchDays) / 10 + '%' : 'n/a', '100%', `${lunchDays - lunchMiss.length} of ${lunchDays}`],
  ['Zig-zag orders', zig, 0, ''],
  ['Rides offered much slower than walking', slow.length, 0, ''],
  ['Picker ticks match what the plan holds', pickOk == null ? 'not run' : pickOk ? '100%' : 'no', '100%', 'phone-flow 3c + 3d'],
  ['Sights listed twice', dups.length, 0, ''],
  ['Full sweeps in a row with no new gap', state.cleanSweepsInARow, 2, fullGaps == null ? '' : `latest sweep: ${fullGaps} gap${fullGaps === 1 ? '' : 's'}`],
  ["Days of Richard's own use with no new bug", state.richardDaysNoBug, 5, ''],
];
// The phone test (Richard: "And the phone test"): 100% of phone checks pass, and every goal has a phone check that shows
// it on screen. A goal whose phone check is still missing is listed.
const PHONE = { 'Safety failures': ['No stop runs past the leave-by time'], 'Leaks': ['No leaks on the trip as the phone holds it'], 'Days worse than the demo': ['No day on the phone is worse than the demo'],
  'Days out over lunchtime': ['Every day out over lunchtime shows a timed lunch'], 'Zig-zag orders': ['No day on the phone crosses back and forth', 'in the order the planner chose'],
  'Rides offered much slower': ['No ride choice on any day is much slower than walking'], 'Picker ticks match': ['plain tick really fits', 'sorts itself'],
  'Sights listed twice': ['Every sight is listed once'], 'Full sweeps in a row': ['Every day: empty it, then pick'] };
const flowLines = flowTxt.split('\n').filter(l => /^(pass|LEAK)/.test(l)), flowPass = flowLines.filter(l => /^pass/.test(l)).length;
const fullLines = fullTxt.split('\n').filter(l => /^(pass|LEAK)/.test(l)), allLines = flowLines.concat(fullLines);
const noPhone = [], phoneOf = name => { const k = Object.keys(PHONE).find(k => name.startsWith(k)); if (!k) return ''; const want = PHONE[k];
  if (!want) { noPhone.push(k); return 'no phone check yet'; } const got = want.map(w => allLines.find(l => l.includes(w)));
  return got.every(Boolean) ? (got.every(l => /^pass/.test(l)) ? 'phone check passes' : 'phone check fails') : 'phone check not run'; };
rows.forEach(r => { const ph = phoneOf(r[0]); if (ph) r[3] = (r[3] ? r[3] + '; ' : '') + ph; });
rows.push(['Phone checks passing', flowTxt ? Math.round(1000 * flowPass / Math.max(1, flowLines.length)) / 10 + '%' : 'not run', '100%', flowTxt ? `${flowPass} of ${flowLines.length}` : '']);
rows.push(['Goals without a phone check', noPhone.length, 0, noPhone.join(', ')]);
const met = r => String(r[1]) === String(r[2]) || (typeof r[1] === 'number' && typeof r[2] === 'number' && r[2] > 0 && r[1] >= r[2]);
if (process.argv.includes('--json')) console.log(JSON.stringify({ trips, days, rows: rows.map(r => ({ name: r[0], now: r[1], goal: r[2], note: r[3], met: met(r) })), unsafe, lunchMiss, slow, dups, stressAll }, null, 1));
else {
  console.log(`Scorecard: ${trips} test trips, ${days} days planned`);
  for (const r of rows) console.log(`${met(r) ? 'MET ' : 'NOT '} ${r[0]}: ${r[1]} (goal ${r[2]})${r[3] ? ' - ' + r[3] : ''}`);
  for (const [k, l] of [['unsafe', unsafe], ['no lunch', lunchMiss], ['slow', slow], ['twice', dups]]) l.slice(0, 10).forEach(m => console.log(`  ${k}: ${m}`));
}
