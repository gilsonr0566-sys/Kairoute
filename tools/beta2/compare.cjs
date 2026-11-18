// Beta 2 side by side: the old engine's plans (saved in each snapshot) and the new engine's, on the same bucket, with
// the same scorer. Usage: node tools/beta2/compare.cjs [name-filter]. Exit 1 if the new engine has a safety failure.
const fs = require('fs'), path = require('path'), E = require('./engine.cjs'), { score } = require('./score.cjs');
const dir = path.join(__dirname, 'snapshots'), only = process.argv[2] ? new RegExp(process.argv[2]) : null;
let unsafe = 0; const rows = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  const s = JSON.parse(fs.readFileSync(path.join(dir, f))); if (only && !only.test(f)) continue;
  let plans; const t0 = Date.now();
  try { plans = E.planTrip(s); } catch (e) { console.log(`\n== ${s.label || f}: NEW ENGINE CRASHED ${e.stack}`); unsafe++; continue; }
  const ms = Date.now() - t0, o = score(s, s.old || []), n = score(s, plans);
  const safety = n.fails.filter(x => /ends .* late|closed stop|last entry|repeated/.test(x));
  unsafe += safety.length;
  const T = x => `stops ${x.stops} picks ${x.picksKept}/${x.picks} must ${x.mustKept} sight ${x.sightMin} ride ${x.rideMin} back ${x.backtrack} minMargin ${x.minMargin}`;
  console.log(`\n== ${s.label || f}  (${ms} ms)\n  old: ${T(o.total)}\n  new: ${T(n.total)}`);
  o.fails.forEach(x => console.log('   old FAIL ' + x)); n.fails.forEach(x => console.log('   NEW FAIL ' + x));
  if (process.env.SHOW) plans.forEach((p, i) => { if (!p || p.error) return; console.log(`  -- day ${i} ${s.days[i].date} ${s.days[i].type} ${s.days[i].city}: ${p.items.filter(x => x.t !== 'ride').map(x => `${Math.floor(x.at / 60)}:${String(x.at % 60).padStart(2, '0')} ${x.t === 'stop' ? '' : x.t + ' '}${x.name}`).join(' | ')}${p.safe ? ' SAFE DAY' : ''}`); });
  rows.push({ f, o: o.total, n: n.total });
}
console.log(`\nnew-engine safety failures: ${unsafe}`); process.exit(unsafe ? 1 : 0);
