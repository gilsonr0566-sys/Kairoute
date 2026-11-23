// The QA spec is checked, not just written (docs/qa/SPEC-v2.md, T9). For every table row whose status says ENFORCED:
//   - every tool it names (`tools/...`) must be run by the release gate (.github/workflows/beta2-gate.yml);
//   - every planted defect it names (`some-defect-id`) must exist in tools/truth/mutants.cjs or sight-mutants.cjs.
// A row can only claim ENFORCED when that is true. Usage: node tools/truth/spec-check.cjs   (exit 1 on any failure)
'use strict';
const fs = require('fs'), path = require('path'), ROOT = path.join(__dirname, '..', '..');
const spec = fs.readFileSync(path.join(ROOT, 'docs', 'qa', 'SPEC-v2.md'), 'utf8');
const gate = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'beta2-gate.yml'), 'utf8');
const ids = new Set(['mutants.cjs', 'sight-mutants.cjs'].flatMap(f => (fs.readFileSync(path.join(__dirname, f), 'utf8').match(/id: '([a-z-]+)'/g) || []).map(s => s.slice(5, -1))));
let rows = 0, bad = 0;
for (const l of spec.split('\n')) {
  if (!/^\|/.test(l) || !/ENFORCED/.test(l)) continue;
  const cells = l.split('|').map(c => c.trim()), id = cells[1]; rows++;
  for (const m of l.matchAll(/`([^`]+)`/g)) {
    const t = m[1];
    if (/^tools\//.test(t)) { const file = t.split(' ')[0]; if (!fs.existsSync(path.join(ROOT, file))) { bad++; console.log(`FAIL spec ${id}: ${file} does not exist`); } else if (!gate.includes(file)) { bad++; console.log(`FAIL spec ${id}: ${file} is not run by the release gate`); } }
    else if (/^[a-z]+(-[a-z]+)+$/.test(t) && !ids.has(t)) { bad++; console.log(`FAIL spec ${id}: planted defect ${t} does not exist`); }
  }
}
console.log(`Spec check: ${rows} ENFORCED rows, ${bad} failed`);
process.exitCode = bad || !rows ? 1 : 0;
