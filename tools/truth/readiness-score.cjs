// One readiness number, up or down from the last report (Richard, Nov 25 2026: "is there a way for you to give me a 1
// percentage that shows a increase or decrease in readiness"). Built only from measured data, never from the pass count
// (docs/qa/READINESS.md). Four parts, 25 points each:
//   1. Fault audit: the average share of FRESH random planted bugs the release gate's checks catch, per area, against
//      the 90% target (docs/qa/fault-audit-latest.json, kept by the testing thread after each audit run).
//   2. Real-world rides: for each kind of ride on the saved trips' plans (walk, taxi, train, metro, bus, ferry...), the
//      share of the different rides whose time a source the app does not use confirms as right (not too fast, not far
//      too slow). A ride with no real-world time is NOT counted as right, so a kind with no outside source (trains,
//      metro and ferries today) scores 0. Kinds count equally. Offline, from tools/truth/real-world-cache.json.
//   3. Clean days: whole days in a row, up to yesterday (Central time), with 0 serious escapes and at most 1 other
//      (docs/qa/escapes.md), out of 7. Any day that fails starts the count again.
//   4. Real world coverage: the share of Richard's questions checked against the real world (docs/qa/COVERAGE.md,
//      "Real-world score per question": yes 1, partly 0.5, no 0).
// Hard cap: while any serious escape is open, or any ride back on a ship, train or flight day has no real-world time,
// the score can't go above 50%.
// Usage: node tools/truth/readiness-score.cjs [--save] [--history file.json] [--json]
//   --save adds this reading to the history (default /mnt/project-files/qa/readiness-history.json when that folder
//   exists, else docs/qa/readiness-history.json); the change is always against the last saved reading.
// Exit 0 always: it measures, it doesn't gate.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..'), QA = path.join(ROOT, 'docs', 'qa');
const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const HIST = arg('history') || process.env.READINESS_HISTORY || (fs.existsSync('/mnt/project-files/qa/') ? '/mnt/project-files/qa/readiness-history.json' : path.join(QA, 'readiness-history.json'));
const pct = x => Math.round(x * 1000) / 10;

// 1. Fault audit
const fa = JSON.parse(fs.readFileSync(path.join(QA, 'fault-audit-latest.json'), 'utf8')), target = (fa.target || 90) / 100;
const areas = Object.entries(fa.areas).map(([a, v]) => ({ a, rate: v.caught / v.planted }));
const faRate = areas.reduce((s, x) => s + x.rate, 0) / areas.length, p1 = Math.min(1, faRate / target);
const faWeak = areas.slice().sort((x, y) => x.rate - y.rate)[0];

// 2. Real-world rides (the release gate's own comparison, on the engine in this checkout)
const rw = require('./real-world-gate.cjs').compare(path.join(ROOT, 'tools', 'beta2', 'engine.cjs'));
const kinds = Object.entries(rw.kinds).map(([k, t]) => ({ k, rides: t.rides, compared: t.compared, right: t.right, share: t.rides ? t.right / t.rides : 0 }));
const p2 = kinds.length ? kinds.reduce((s, x) => s + x.share, 0) / kinds.length : 0;
const rwWeak = kinds.slice().sort((x, y) => x.share - y.share)[0];

// 3. Clean days (same reading of the ledger as tools/truth/escape-rate.cjs)
const rows = fs.readFileSync(path.join(QA, 'escapes.md'), 'utf8').split('\n').filter(l => /^\| E\d+ \|/.test(l)).map(l => {
  const c = l.split('|').map(x => x.trim()); return { id: c[1], found: c[2], by: c[3], sev: c[5], status: c[8] || '' }; });
const inHouse = r => /\*\*(Release gate|Independent check|Class check|Rules registry proof)/i.test(r.by) || /^Release gate part|^Release report/i.test(r.by);
const processRow = r => /^Process|\(process\)/i.test(r.sev), serious = r => /^(S1|P0|P1)\b/.test(r.sev) && !processRow(r);
const MON = { Nov: [2026, 10], Dec: [2026, 11], Jan: [2027, 0], Feb: [2027, 1], Mar: [2027, 2], Apr: [2027, 3], May: [2027, 4], Jun: [2027, 5], Jul: [2027, 6] };
const dayKey = r => { const m = /(Nov|Dec|Jan|Feb|Mar|Apr|May|Jun|Jul) (\d+)(?:-(\d+))?/.exec(r.found); if (!m) return null; const [y, mo] = MON[m[1]]; return new Date(Date.UTC(y, mo, +(m[3] || m[2]))).toISOString().slice(0, 10); };
const byDay = {};
for (const r of rows) { const d = dayKey(r); if (!d || inHouse(r) || processRow(r)) continue; const k = byDay[d] = byDay[d] || { serious: 0, other: 0 }; serious(r) ? k.serious++ : k.other++; }
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
let clean = 0;
for (let t = Date.parse(today + 'T00:00:00Z') - 864e5; clean < 7; t -= 864e5) { const k = byDay[new Date(t).toISOString().slice(0, 10)] || { serious: 0, other: 0 }; if (k.serious || k.other > 1) break; clean++; }
const p3 = clean / 7;
const openSerious = rows.filter(r => serious(r) && /^(Open|Partly)/i.test(r.status)).map(r => r.id);

// 4. Real-world coverage of Richard's questions
const cov = fs.readFileSync(path.join(QA, 'COVERAGE.md'), 'utf8'), sec = cov.split('## Real-world score per question')[1] || '';
const qs = sec.split('\n## ')[0].split('\n').filter(l => /^\| .* \| (yes|partly|no) \|/.test(l)).map(l => { const c = l.split('|').map(x => x.trim()); return { q: c[1], v: c[2] }; });
const p4 = qs.length ? qs.reduce((s, x) => s + ({ yes: 1, partly: 0.5, no: 0 })[x.v], 0) / qs.length : 0;

// Total, cap, change
const parts = [
  { name: 'Fault audit catch rate', score: p1, detail: `${pct(faRate)}% of fresh planted bugs caught (target 90%); weakest: ${faWeak.a} ${pct(faWeak.rate)}%` },
  { name: 'Real-world ride accuracy', score: p2, detail: kinds.map(x => `${x.k} ${x.right} of ${x.rides} confirmed right`).join(', ') + `; weakest: ${rwWeak ? rwWeak.k : '-'}` },
  { name: 'Clean days', score: p3, detail: `${clean} of 7 days in a row with 0 serious escapes and at most 1 other` },
  { name: 'Real-world coverage of your questions', score: p4, detail: `${qs.filter(x => x.v === 'yes').length} yes, ${qs.filter(x => x.v === 'partly').length} partly, ${qs.filter(x => x.v === 'no').length} no, of ${qs.length}` },
];
const raw = parts.reduce((s, x) => s + 25 * x.score, 0), capWhy = [];
if (openSerious.length) capWhy.push(`${openSerious.length} serious bug(s) open (${openSerious.join(', ')})`);
if (rw.backUnchecked.length) capWhy.push(`${rw.backUnchecked.length} ride(s) back to a ship, train or flight with no real-world time`);
const score = Math.round((capWhy.length ? Math.min(50, raw) : raw) * 10) / 10;
let hist = []; try { hist = JSON.parse(fs.readFileSync(HIST, 'utf8')); } catch (e) { /* first reading */ }
const last = hist[hist.length - 1], delta = last ? Math.round((score - last.score) * 10) / 10 : null;
const weakest = parts.slice().sort((a, b) => a.score - b.score)[0];
const reading = { at: new Date().toISOString(), score, raw: Math.round(raw * 10) / 10, capped: capWhy, parts: parts.map(p => ({ name: p.name, points: Math.round(25 * p.score * 10) / 10 })), fault: fa.run, rides: rw.compared };

if (process.argv.includes('--json')) console.log(JSON.stringify(Object.assign({ delta }, reading), null, 1));
else {
  console.log(`READINESS ${score}%  ${delta == null ? '(first reading)' : (delta > 0 ? 'up ' : delta < 0 ? 'down ' : 'no change, ') + Math.abs(delta) + ' since ' + new Date(last.at).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' Central'}`);
  if (capWhy.length) console.log(`Held at no more than 50% (would be ${reading.raw}%) while: ${capWhy.join('; ')}.`);
  console.log(`Weakest part: ${weakest.name} (${Math.round(25 * weakest.score * 10) / 10} of 25).`);
  console.log('\n| Part (25 points each) | Points | Measured |\n|---|---|---|');
  for (const p of parts) console.log(`| ${p.name} | ${Math.round(25 * p.score * 10) / 10} | ${p.detail} |`);
  if (rw.backUnchecked.length) console.log('\nRides back with no real-world time:\n' + rw.backUnchecked.map(x => '- ' + x).join('\n'));
}
if (process.argv.includes('--save')) { hist.push(reading); fs.mkdirSync(path.dirname(HIST), { recursive: true }); fs.writeFileSync(HIST, JSON.stringify(hist, null, 1) + '\n'); }
