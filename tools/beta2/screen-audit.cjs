// Beta 2 screen audit: runs tools/beta2/screen-rules.cjs over day plans as the traveler sees them.
//   node tools/beta2/screen-audit.cjs --results <outside-test-results dir>   live-site test trips (latest run of each trip)
//   node tools/beta2/screen-audit.cjs --texts <file.json>                   [{ trip, i, date, type, text }]
// Prints failures grouped by rule, S1 (ship/train/flight safety) first. Exit 1 on any S1 or S2.
const fs = require('fs'), path = require('path'), R = require('./screen-rules.cjs');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
function fromResults(dir) {
  const latest = {};
  for (const run of fs.readdirSync(dir).sort()) { const rd = path.join(dir, run); if (!fs.statSync(rd).isDirectory()) continue;
    for (const t of fs.readdirSync(rd)) { const f = path.join(rd, t, 'result.json'); if (!fs.existsSync(f)) continue; let j; try { j = JSON.parse(fs.readFileSync(f)); } catch (e) { continue; }
      if (!(j.days || []).some(d => d.text)) continue; latest[t] = { run, j }; } }
  const days = []; for (const [t, { run, j }] of Object.entries(latest)) for (const d of j.days) if (d.text) days.push({ trip: t, run, build: j.version, i: d.i, date: d.date, type: d.type, text: d.text });
  return days;
}
function audit(days) {
  const byRule = {}, trips = new Set(); let n = 0;
  for (const d of days) { n++; trips.add(d.trip); for (const f of R.rules(d.text, d)) (byRule[f.sev + ' ' + f.rule] = byRule[f.sev + ' ' + f.rule] || []).push(`${d.trip} day ${d.i + 1}${d.date ? ' (' + d.date + ')' : ''}: ${f.msg}`); }
  return { n, trips: trips.size, byRule };
}
if (require.main === module) {
  const days = arg('--results') ? fromResults(arg('--results')) : JSON.parse(fs.readFileSync(arg('--texts')));
  const { n, trips, byRule } = audit(days), keys = Object.keys(byRule).sort();
  console.log(`Screen audit: ${n} day plans on ${trips} trips, read as shown on screen.`);
  if (!keys.length) console.log('  All screen rules pass.');
  for (const k of keys) { console.log(`  ${k}: ${byRule[k].length}`); byRule[k].slice(0, process.argv.includes('--list') ? 999 : 4).forEach(x => console.log('      ' + x)); }
  if (process.argv.includes('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(byRule, null, 1));
  process.exitCode = keys.some(k => /^S[12]/.test(k)) ? 1 : 0;
}
module.exports = { audit, fromResults };
