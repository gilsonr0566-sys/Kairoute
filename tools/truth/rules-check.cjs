// The rules registry is enforced, not just written (docs/qa/RULES.md; Richard, Nov 23 2026: "there needs to be rules for
// every error found ... Everything else is layers and leak plugging"). Fails (exit 1) when:
//   A. a rule marked ENFORCED names no check the release gate runs, or no planted bug that proves the check fires, or a
//      planted bug that doesn't exist; a rule not ENFORCED has no owner or a date passed (or more than 7 days ahead);
//   B. a bug in the escaped-bug log (docs/qa/escapes.md) is not listed under any rule;
//   C. a commit changing the app or the helper (src/, worker/) after the registry's start has no `Rule: R-xx` line naming
//      a real rule, and is not linked in docs/qa/rule-links.md.
// It then proves itself: it feeds its own checks an unlinked bug, an unlinked fix and a rule with no proof, and fails if
// any of them gets through.   Usage: node tools/truth/rules-check.cjs [--since <git ref>]
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const START = '2026-11-23T23:30:00Z';
// Checks that plant their own bad input on every run (so naming one counts as a proof).
const PLANTING = new Set(['tools/truth/language-check.cjs', 'tools/client/steady-all.cjs', 'tools/truth/screen-rule-proof.cjs', 'tools/truth/no-warn-check.cjs',
  'tools/truth/report-check.cjs', 'tools/truth/rules-check.cjs', 'tools/truth/mutants.cjs', 'tools/truth/sight-mutants.cjs']);
const GATE = rd('.github/workflows/beta2-gate.yml');
const DEFECTS = new Set(['mutants.cjs', 'sight-mutants.cjs'].flatMap(f => (fs.readFileSync(path.join(__dirname, f), 'utf8').match(/id: '([a-z-]+)'/g) || []).map(s => s.slice(5, -1))));
const SCREEN = (() => { const s = fs.readFileSync(path.join(__dirname, 'screen-rule-proof.cjs'), 'utf8'); return new Set([...s.matchAll(/^  '([^']+)': \[/gm)].map(m => m[1])); })();
const today = new Date().toISOString().slice(0, 10), week = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

function parseRules(md) {
  const rules = [];
  for (const l of md.split('\n')) { if (!/^\| R-\d+ \|/.test(l)) continue; const c = l.split('|').map(x => x.trim());
    rules.push({ id: c[1], sev: c[2], text: c[3], by: c[4], proof: c[5], bugs: c[6], repeat: c[7], before: c[8], status: c[9] }); }
  return rules;
}
function checkRules(rules, gate = GATE) {
  const bad = [], ids = new Set();
  for (const r of rules) {
    if (ids.has(r.id)) bad.push(`${r.id}: listed twice`); ids.add(r.id);
    const tools = [...r.by.matchAll(/`(tools\/[^` ]+)/g)].map(m => m[1]);
    for (const t of tools) { if (!fs.existsSync(path.join(ROOT, t))) bad.push(`${r.id}: ${t} does not exist`); else if (!gate.includes(t)) bad.push(`${r.id}: ${t} is not run by the release gate`); }
    if (!['none', 'partial', 'yes'].includes(r.before)) bad.push(`${r.id}: "Before" must be none, partial or yes`);
    if (/^ENFORCED/.test(r.status)) {
      if (!tools.length) bad.push(`${r.id}: ENFORCED but names no check the gate runs`);
      let proofs = 0;
      for (const m of r.proof.matchAll(/`([^`]+)`/g)) { const p = m[1];
        if (/^screen: /.test(p)) { if (SCREEN.has(p.slice(8))) proofs++; else bad.push(`${r.id}: no planted screen bug "${p.slice(8)}" in screen-rule-proof.cjs`); }
        else if (/^tools\//.test(p)) { const f = p.split(' ')[0]; if (PLANTING.has(f) && gate.includes(f)) proofs++; else bad.push(`${r.id}: ${f} is not a check that plants its own bug in the gate`); }
        else if (/^[a-z]+(-[a-z]+)+$/.test(p)) { if (DEFECTS.has(p)) proofs++; else bad.push(`${r.id}: planted defect ${p} does not exist`); } }
      if (!proofs) bad.push(`${r.id}: ENFORCED but no planted bug proves its check fires`);
    } else {
      const o = /owner "[^"]+"/.test(r.status), d = /by (\d{4}-\d\d-\d\d)/.exec(r.status);
      if (!/^(NO PROOF|OPEN)/.test(r.status)) bad.push(`${r.id}: status must be ENFORCED, NO PROOF or OPEN`);
      if (!o) bad.push(`${r.id}: not enforced and no owner`);
      if (!d) bad.push(`${r.id}: not enforced and no date`); else if (d[1] < today) bad.push(`${r.id}: its date ${d[1]} has passed (${r.status.slice(0, 60)})`); else if (d[1] > week) bad.push(`${r.id}: date ${d[1]} is more than 7 days ahead`);
    }
  }
  return bad;
}
function checkEscapes(rules, esc) {
  const listed = new Set(rules.flatMap(r => r.bugs.match(/\bE\d+\b/g) || [])), bad = [];
  for (const l of esc.split('\n')) { const m = /^\| (E\d+) \|/.exec(l); if (m && !listed.has(m[1])) bad.push(`${m[1]}: in the escaped-bug log but under no rule in docs/qa/RULES.md`); }
  return bad;
}
function checkCommits(rules, commits, links) {
  const ids = new Set(rules.map(r => r.id)), linked = [...links.matchAll(/^\| *([0-9a-f]{8,}) *\| *([^|]*R-\d+[^|]*)\|/gm)].map(m => [m[1], m[2]]), bad = [];
  for (const c of commits) {
    const named = (c.msg.match(/^Rule: *(.+)$/m) || [, ''])[1].match(/R-\d+/g) || [], l = linked.find(([s]) => c.sha.startsWith(s));
    const all = named.concat(l ? l[1].match(/R-\d+/g) || [] : []);
    if (!all.length) bad.push(`${c.sha.slice(0, 8)} "${c.msg.split('\n')[0].slice(0, 60)}": changes the app but names no rule (add "Rule: R-xx", or link it in docs/qa/rule-links.md)`);
    else all.filter(x => !ids.has(x)).forEach(x => bad.push(`${c.sha.slice(0, 8)}: names ${x}, which is not in docs/qa/RULES.md`));
  }
  return bad;
}
function gitCommits() {
  try { execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, stdio: 'pipe' }); } catch (e) { return null; }
  if (fs.existsSync(path.join(ROOT, '.git', 'shallow'))) return null;
  const out = execFileSync('git', ['log', '--no-merges', `--since=${START}`, '--format=%x1e%H%x1f%B', '--', 'src', 'worker'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
  return out.split('\x1e').filter(Boolean).map(s => { const [sha, msg] = s.split('\x1f'); return { sha, msg: msg || '' }; });
}

const rules = parseRules(rd('docs/qa/RULES.md')), fails = [];
fails.push(...checkRules(rules), ...checkEscapes(rules, rd('docs/qa/escapes.md')));
const commits = gitCommits();
if (commits == null) fails.push('NOT TESTED: no full git history here, so fixes could not be checked for their rule (the gate checks out with fetch-depth 0)');
else fails.push(...checkCommits(rules, commits, rd('docs/qa/rule-links.md')));
// The check proves itself on planted input: each of these must be caught.
const self = [
  ['an escaped bug under no rule', checkEscapes(rules, '| E999 | Nov 23 | planted | x | S2 | x | x | Open |').length === 1],
  ['a fix with no rule line', checkCommits(rules, [{ sha: 'f'.repeat(40), msg: 'Lunch: fix\n\nCo-Authored-By: x' }], '').length === 1],
  ['a fix naming a rule that does not exist', checkCommits(rules, [{ sha: 'f'.repeat(40), msg: 'x\n\nRule: R-999' }], '').length === 1],
  ['a fix with its rule passes', checkCommits(rules, [{ sha: 'f'.repeat(40), msg: 'x\n\nRule: R-11, R-12' }], '').length === 0],
  ['an ENFORCED rule with no planted bug', checkRules([{ id: 'R-998', by: '`tools/truth/oracle.cjs`', proof: 'none', bugs: '', before: 'none', status: 'ENFORCED' }]).length === 1],
  ['an ENFORCED rule whose check the gate does not run', checkRules([{ id: 'R-997', by: '`tools/truth/oracle.cjs`', proof: '`leaveby-late`', bugs: '', before: 'none', status: 'ENFORCED' }], 'nothing').length >= 1],
  ['an open rule past its date', checkRules([{ id: 'R-996', by: '', proof: '', bugs: '', before: 'none', status: 'OPEN: owner "x", by 2026-01-01' }]).length === 1],
];
self.filter(s => !s[1]).forEach(s => fails.push(`SELF-TEST: ${s[0]} was not caught`));
const n = k => rules.filter(r => r.status.startsWith(k)).length;
for (const f of fails) console.log('FAIL ' + f);
console.log(`Rules registry: ${rules.length} rules (${n('ENFORCED')} enforced with a planted bug, ${n('NO PROOF')} checked without one yet, ${n('OPEN')} open); ` +
  `${rules.filter(r => /^yes/.test(r.repeat)).length} came back after a fix; ${rules.filter(r => r.before === 'none').length} had no check at all and ${rules.filter(r => r.before === 'partial').length} only a partial one when their first bug got through; ` +
  `${commits ? commits.length + ' app changes since the registry checked for their rule' : 'app changes not checked'}; self-test ${self.filter(s => s[1]).length}/${self.length}; ${fails.length} failed`);
process.exitCode = fails.length ? 1 : 0;
