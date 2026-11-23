// The release gate's verdict is tested (Nov 23, escapes E19: every gate run went green because the job searched the
// report for the words "RELEASE OK", which a DO NOT RELEASE report also contains; the publish step trusts a green run).
// Proves, on every gate run, that:
//   1. a report with a failed part says DO NOT RELEASE and exits 1;
//   2. a report where every part passed says RELEASE OK and exits 0;
//   3. the gate workflow's own verdict lines, run on each of those reports, fail the first and pass the second.
// Usage: node tools/truth/report-check.cjs   (exit 1 on any failure)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync, execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..'), PARTS = ['code', 'safety', 'engine', 'leaks', 'phone', 'screen', 'odd-screen', 'words'];
let bad = 0; const fail = m => { bad++; console.log('FAIL report-check ' + m); }, ok = m => console.log('ok   ' + m);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'report-check-'));
for (const k of PARTS) { fs.mkdirSync(path.join(tmp, 'part-' + k), { recursive: true }); fs.writeFileSync(path.join(tmp, 'part-' + k, 'log.txt'), 'ok   gone 0\n12 passed, 0 failed\n'); }
const head = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
const env = (results) => Object.assign({}, process.env, { R: JSON.stringify(Object.fromEntries(PARTS.map((k, i) => [k, { result: results[i] }]))), LIVE: head, NIGHTLY: '', NIGHTLY_JOBS: '[]', GATE_RUNS: '[]', THIS_JOBS: '[]' });
const report = results => spawnSync(process.execPath, [path.join(__dirname, 'release-report.cjs'), tmp], { cwd: ROOT, env: env(results), encoding: 'utf8' });
// The workflow's own verdict: the lines after "node tools/truth/release-report.cjs parts" that test rc and the report.
const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'beta2-gate.yml'), 'utf8').split('\n');
const verdict = wf.filter(l => /\$rc"? -eq 0|grep -q.*RELEASE OK/.test(l)).map(l => l.trim());
if (!verdict.length) fail('the gate workflow has no verdict lines (rc check and RELEASE OK line check)');
if (wf.some(l => /grep -q "RELEASE OK"/.test(l))) fail('the gate workflow still searches the report for the bare words "RELEASE OK"');
const judge = (r) => { fs.writeFileSync(path.join(tmp, 'release-report.md'), r.stdout); return spawnSync('bash', ['-c', `cd "${tmp}"; rc=${r.status}; ${verdict.join('\n')}`], { encoding: 'utf8' }).status; };
const no = report(['success', 'failure', 'success', 'success', 'success', 'success', 'success', 'success']);
if (no.status !== 1) fail(`a report with a failed part exited ${no.status}, not 1`); else ok('a report with a failed part exits 1');
if (/^## Release recommendation: \*\*RELEASE OK\*\*$/m.test(no.stdout)) fail('a report with a failed part recommends RELEASE OK'); else ok('a report with a failed part says DO NOT RELEASE');
if (verdict.length) { const j = judge(no); if (j === 0) fail('the gate workflow passes a DO NOT RELEASE report'); else ok('the gate workflow fails a DO NOT RELEASE report'); }
const cancelled = report(['success', 'cancelled', 'success', 'success', 'success', 'success', 'success', 'success']);
if (cancelled.status !== 1 || (verdict.length && judge(cancelled) === 0)) fail('a cancelled part does not block'); else ok('a cancelled part (NOT TESTED) blocks');
const yes = report(PARTS.map(() => 'success'));
if (yes.status !== 0 || !/^## Release recommendation: \*\*RELEASE OK\*\*$/m.test(yes.stdout)) fail(`a report with every part passed did not say RELEASE OK (exit ${yes.status}):\n${yes.stdout.split('\n').filter(l => /NOT MET/.test(l)).join('\n')}`); else ok('a report with every part passed says RELEASE OK');
if (verdict.length) { const j = judge(yes); if (j !== 0) fail('the gate workflow fails a RELEASE OK report'); else ok('the gate workflow passes a RELEASE OK report'); }
fs.rmSync(tmp, { recursive: true, force: true });
console.log(bad ? `${bad} failed` : 'The gate verdict follows the report: 0 failed');
process.exitCode = bad ? 1 : 0;
