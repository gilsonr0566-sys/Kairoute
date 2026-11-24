// Readiness by escapes, not by passes (Richard, Nov 24 2026: "6998 passes with 0 errors. Either that means we are ready or
// there is fault in our pass testing"). A pass count only says the checks agree with the code. What says whether the app
// is ready is how many NEW bugs still get past every check and are found by someone else: an outside tester, Fable,
// Richard, a live run, another thread reading the screen. Those are escapes. This counts them per day from the escaped-bug
// log (docs/qa/escapes.md), apart from bugs the release gate or a class check caught first (those worked as intended).
// Usage: node tools/truth/escape-rate.cjs [--days 7]   (prints a table; exit 0 always: it measures, it doesn't gate)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..'), DAYS = +((process.argv[process.argv.indexOf('--days') + 1]) || 7);
const rows = fs.readFileSync(path.join(ROOT, 'docs', 'qa', 'escapes.md'), 'utf8').split('\n').filter(l => /^\| E\d+ \|/.test(l)).map(l => {
  const c = l.split('|').map(x => x.trim()); return { id: c[1], found: c[2], by: c[3], sev: c[5] }; });
// Caught in house: the release gate, the independent check, a class check, the registry's own proofs.
const inHouse = r => /\*\*(Release gate|Independent check|Class check|Rules registry proof)/i.test(r.by) || /^Release gate part|^Release report/i.test(r.by);
const process_ = r => /^Process|\(process\)/i.test(r.sev);
const day = r => { const m = /Nov (\d+)(?:-(\d+))?/.exec(r.found); return m ? +(m[2] || m[1]) : null; }; // a range counts on its last day
const sevOf = r => /^S1|^P0|^P1/.test(r.sev) ? 'serious' : 'other';
const by = {};
for (const r of rows) { const d = day(r); if (d == null) continue; const k = by[d] = by[d] || { esc: [], serious: [], house: [] };
  if (inHouse(r)) k.house.push(r.id); else if (!process_(r)) { k.esc.push(r.id); if (sevOf(r) === 'serious') k.serious.push(r.id); } }
const days = Object.keys(by).map(Number).sort((a, b) => a - b).slice(-DAYS);
console.log('| Day | Escapes (found outside the checks) | of which could miss a ship or badly mislead (S1/P1) | Caught by the checks first |\n|---|---|---|---|');
for (const d of days) { const k = by[d]; console.log(`| Nov ${d} | ${k.esc.length} (${k.esc.join(', ') || '-'}) | ${k.serious.length} (${k.serious.join(', ') || '-'}) | ${k.house.length} (${k.house.join(', ') || '-'}) |`); }
const last = days[days.length - 1], k = by[last] || { esc: [], serious: [] };
console.log(`\nToday (Nov ${last}): ${k.esc.length} escape(s), ${k.serious.length} serious. Ready needs 7 days in a row with 0 serious and at most 1 other, while outside testing keeps its volume (docs/qa/READINESS.md).`);
