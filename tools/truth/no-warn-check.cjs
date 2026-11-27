// No safety finding can be silenced (Nov 23 2026, Richard: "the S1 warning exception is a serious design flaw").
// Proves, on every gate run, that:
//   1. no workflow passes --warn for a safety rule (the gate and the nightly);
//   2. the independent check and the odd-trip checks refuse to warn a safety rule and fail the run when asked.
// Usage: node tools/truth/no-warn-check.cjs   (exit 1 on any failure)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const SAFETY = ['error', 'gone', 'reach', 'leaveby', 'before', 'night', 'unverified', 'backwait', 'nan', 'back', 'order', 'start'];
let bad = 0; const fail = m => { bad++; console.log('FAIL no-warn ' + m); }, ok = m => console.log('ok   ' + m);
// 1. workflows
const wf = path.join(ROOT, '.github', 'workflows');
for (const f of fs.readdirSync(wf).filter(f => /\.ya?ml$/.test(f))) {
  fs.readFileSync(path.join(wf, f), 'utf8').split('\n').forEach((l, i) => { const m = /--warn[ =]+([\w,-]+)/.exec(l); if (!m) return;
    const hit = m[1].split(',').filter(k => SAFETY.includes(k)); if (hit.length) fail(`${f}:${i + 1} warns safety rule(s) ${hit.join(',')}`); });
}
ok('no workflow warns a safety rule');
// 2. the tools refuse
const empty = path.join(os.tmpdir(), 'no-warn-empty.json'); fs.writeFileSync(empty, '[]');
const run = (args) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
for (const k of ['gone', 'reach', 'leaveby', 'before', 'night', 'unverified', 'backwait']) {
  const r = run([path.join('tools', 'truth', 'oracle.cjs'), '--trips', empty, '--warn', k]);
  if (r.status === 1 && /REFUSED --warn/.test(r.stdout)) ok(`independent check refuses --warn ${k}`); else fail(`independent check accepted --warn ${k} (exit ${r.status})`);
}
for (const k of ['back', 'leaveby', 'start']) {
  const r = run([path.join('tools', 'beta2', 'odd-trips.cjs'), '--n', '0', '--warn', k]);
  if (r.status === 1 && /REFUSED --warn/.test(r.stdout)) ok(`odd-trip checks refuse --warn ${k}`); else fail(`odd-trip checks accepted --warn ${k} (exit ${r.status})`);
}
console.log(bad ? `${bad} failed` : 'No safety finding can be silenced: 0 failed');
process.exitCode = bad ? 1 : 0;
