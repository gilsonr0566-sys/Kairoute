// The release report (Nov 23 2026, thread "Rebuild the testing and review process"). Written by the last job of the
// release gate from every part's own log. It follows Richard's testing directive (the 14 items every test cycle reports)
// and his release targets, each of which must be 0:
//   - unverified return connections presented as confirmed
//   - unhandled critical workflow failures
//   - mandatory tests not executed
// "These standards are gates, not claims that all possible failures have been eliminated." The report never says PASS
// for anything that did not run: a part cancelled, skipped or timed out is NOT TESTED, and NOT TESTED blocks.
// Usage (in the gate): R='<needs as JSON>' node tools/truth/release-report.cjs parts > report.md
//   parts/part-<job>/log.txt and fails.txt, as each part uploads them. LIVE=<sha of the published build> (optional).
'use strict';
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const dir = process.argv[2] || 'parts', needs = JSON.parse(process.env.R || '{}'), ROOT = path.join(__dirname, '..', '..');
const read = f => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } };
const NAMES = { code: 'Code: secrets, syntax, engine rules, helper AI switch', safety: 'Safety: independent check, odd trips, planted defects', engine: 'Engine rules, opening hours, reasons, lunch',
  leaks: 'Leaks and stress', phone: 'Phone flow (the real app, phone size)', screen: 'What the traveler sees (screen rules, time zones, no signal, older saved trips, sizes, voices, guard)',
  'odd-screen': 'Odd days on screen, ship days while the water check waits, group trips', words: 'The app says only what is true (first run, day plan, outside text, no paid AI, trip copy, AI honesty)',
  feel: 'What the traveler feels: real finger taps and swipes on phone and tablets (jumps, self-scroll, layout shift, slow and dead taps, Back button)', steady: 'Steady screens on every test trip: redraws move nothing, screens settle, every wait ends, reopening after Exit tour',
  language: "Every screen in the traveler's language: every saved trip, every screen, names in 7 scripts planted in every source",
  press: 'Every button pressed: a real touch on every control of every screen (first open and the example trip, phone, two presses deep), planted broken buttons all caught' };
const word = s => s === 'success' ? 'PASS' : s === 'failure' ? 'FAIL' : 'NOT TESTED (' + (s || 'not run') + ')';
const parts = Object.keys(needs).length ? Object.keys(needs) : Object.keys(NAMES);
// A part split side by side (a matrix job: part-steady-phone, part-steady-tablet) is read as one part.
const partDirs = k => { let ds = []; try { ds = fs.readdirSync(dir).filter(d => d === 'part-' + k || d.startsWith('part-' + k + '-') && !parts.includes(d.slice(5))); } catch (e) {} return ds.length ? ds : ['part-' + k]; };
const log = k => partDirs(k).map(d => read(path.join(dir, d, 'log.txt'))).join('\n'), fails = k => partDirs(k).map(d => read(path.join(dir, d, 'fails.txt')).trim()).filter(Boolean).join('\n');
const all = parts.map(log).join('\n');
const sh = c => { try { return execSync(c, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { return ''; } };

// ---- counts from the logs: "ok   rule 0" / "FAIL rule 3" / "WARN rule 2" lines, and "N passed, M failed" lines
let ruleOk = 0, ruleFail = 0, ruleWarn = 0, casesPass = 0, casesFail = 0;
for (const l of all.split('\n')) {
  let m = /^(ok|FAIL|WARN)\s+([\w-]+)\s+(\d+)\s*$/.exec(l); if (m) { if (m[1] === 'ok') ruleOk++; else if (m[1] === 'FAIL') ruleFail++; else ruleWarn++; continue; }
  m = /(\d+) (?:checks? )?passed,? (\d+) failed/i.exec(l); if (m) { casesPass += +m[1]; casesFail += +m[2]; }
}
const count = (re) => all.split('\n').reduce((a, l) => { const m = re.exec(l); return a + (m ? +m[1] : 0); }, 0);
const ran = k => needs[k] && (needs[k].result === 'success' || needs[k].result === 'failure');
// ---- the three release targets
const unverified = ran('safety') ? count(/^FAIL unverified\s+(\d+)/) : null;
const crit = parts.some(ran) ? count(/^FAIL error\s+(\d+)/) + (all.match(/planTrip threw|Uncaught |pageerror|TypeError:|ReferenceError:/g) || []).length : null;
const notRun = parts.filter(k => !ran(k)).length + (all.match(/^NOT TESTED/mg) || []).length;
// A fourth target (Richard, Nov 23): safety findings. Every S1 finding (a flight, train or ship that could be missed) and
// every safety rule of the day checks counts, whether printed FAIL or WARN, and any refused attempt to warn one. There is
// no warn-only path for safety: a trip the run cannot show is safe stops the release.
const SAFETY_RULES = /^(FAIL|WARN)\s+(gone|reach|leaveby|before|night|unverified|boat|backwait|back|start|order|nan)\s+(\d+)\s*$/;
const s1Count = parts.some(ran) ? all.split('\n').reduce((a, l) => { const m = SAFETY_RULES.exec(l); return a + (m ? +m[3] : 0); }, 0) + (all.match(/^REFUSED --warn/mg) || []).length : null;
const T = (n, what) => `| ${what} | ${n == null ? 'NOT TESTED' : n} | ${n === 0 ? 'met' : n == null ? 'NOT MET (not tested)' : 'NOT MET'} |`;
const escapes = read(path.join(ROOT, 'docs', 'qa', 'escapes.md')).split('\n').filter(l => /^\| E\d+/.test(l));
// Spec v2 T2: the latest nightly run. Its new-trips job turns red on a safety finding, which holds this release until a
// later nightly is clean or docs/qa/nightly-cleared.txt names that run as a proven false alarm.
const nightly = (process.env.NIGHTLY || '').split(' '), nJobs = (() => { try { return JSON.parse(process.env.NIGHTLY_JOBS || '[]'); } catch (e) { return []; } })();
const cleared = read(path.join(ROOT, 'docs', 'qa', 'nightly-cleared.txt'));
const nRed = nJobs.find(j => /^New unusual trips/.test(j.name || '') && j.conclusion === 'failure');
const nightlyHold = nightly[0] && nRed && !cleared.includes(nightly[0]) ? 1 : 0;
const nightlyLine = !nightly[0] ? 'No finished nightly run found (not blocking: the nightly attacks beyond the gate).' : nRed ? (nightlyHold ? `HOLD: the nightly run ${nightly[1]} (${nightly[2]}) found a safety problem.` : `The nightly run ${nightly[1]} found a problem, cleared as a false alarm in docs/qa/nightly-cleared.txt.`) : `The nightly run ${nightly[1]} (${nightly[2]}) found no safety problem.`;
// Spec v2 T5: a WARN only for a rule in docs/qa/warns.json, with an owner and a date not passed.
const today = new Date().toISOString().slice(0, 10);
const allowed = (() => { try { return JSON.parse(read(path.join(ROOT, 'docs', 'qa', 'warns.json'))).warns || []; } catch (e) { return []; } })();
const badWarns = all.split('\n').map(l => /^WARN\s+([\w-]+)\s+(\d+)/.exec(l)).filter(Boolean).filter(m => { const a = allowed.find(w => w.rule === m[1]); return !a || !a.owner || !(a.until >= today); }).map(m => m[1]);
// Spec v2 T8: an open S1 or P1 row in the escaped-bug ledger.
const openSevere = escapes.filter(l => { const c = l.split('|').map(x => x.trim()); return /^(S1|P0|P1)\b/.test(c[5] || '') && /^\*\*Open/.test(c[8] || ''); }).map(l => l.split('|')[1].trim());
const live = process.env.LIVE || '';
const range = live && sh(`git cat-file -t ${live}`) === 'commit' ? `${live}..HEAD` : '';
// Spec v2 T7: every commit since the published build that touches the leave-by and way-back files has a review row in
// docs/qa/reviews.md by a thread that did not write it. Unreviewed is NOT TESTED.
const SAFETY_FILES = 'src/engine/30-window.js src/engine/10-travel.js src/engine/90-timeline.js src/engine/95-plan.js src/live.js';
const reviewed = read(path.join(ROOT, 'docs', 'qa', 'reviews.md')).split('\n').map(l => (/^\|\s*([0-9a-f]{7,})\s*\|/.exec(l) || [])[1]).filter(Boolean);
const safetyCommits = range ? sh(`git log --no-merges --format=%h ${range} -- ${SAFETY_FILES}`).split('\n').filter(Boolean) : null;
const unreviewed = safetyCommits ? safetyCommits.filter(c => !reviewed.some(r => r.startsWith(c) || c.startsWith(r))) : ['(published build not known: cannot list the safety changes)'];
const targetsMet = unverified === 0 && crit === 0 && notRun === 0 && !unreviewed.length && s1Count === 0 && !nightlyHold && !badWarns.length && !openSevere.length;
const allPass = parts.every(k => needs[k] && needs[k].result === 'success');
const ok = allPass && targetsMet;

// ---- what changed since the published build
const corrections = range ? sh(`git log --no-merges --format='- %h %s' ${range}`).split('\n').filter(Boolean) : [];
const testsAdded = range ? sh(`git diff --name-status ${range} -- tools docs/qa .github/workflows`).split('\n').filter(l => /^[AM]\s/.test(l) && /check|test|rules|oracle|mutants|gate|odd|flow|audit|truth|scenario|leaks|stress/i.test(l)) : [];
const openEsc = escapes.filter(l => /\*\*Open\*\*|Partly|partly covered|\bGap\b/i.test(l)).map(l => { const c = l.split('|').map(x => x.trim()); return `- ${c[1]} ${c[4]} (${c[5]}): ${c[8].replace(/\*\*/g, '')}`; });
const gaps = read(path.join(ROOT, 'docs', 'qa', 'test-map.md')).split('\n').filter(l => /NOT TESTED/.test(l) && /^\|/.test(l)).map(l => { const c = l.split('|').map(x => x.trim()); return `- ${c[1]}: ${c.slice(2).filter(Boolean).join('; ').replace(/\*\*/g, '')}`; });
const s1 = all.split('\n').filter(l => /^\s+S1 /.test(l));
const warns = all.split('\n').filter(l => /^WARN /.test(l));

const out = [];
out.push(`# Beta 2 release report`, ``, `Commit ${(process.env.GITHUB_SHA || sh('git rev-parse HEAD')).slice(0, 8)}${process.env.GITHUB_RUN_NUMBER ? ', gate run ' + process.env.GITHUB_RUN_NUMBER : ''}, ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC.${live ? ' Compared with the published build ' + live + '.' : ''}`, ``);
out.push(`## Release recommendation: **${ok ? 'RELEASE OK' : 'DO NOT RELEASE'}**`, ``);
out.push(ok ? 'Every part ran and passed, and every release target is 0. This is a gate, not a claim that every failure is gone.' : `${!allPass ? 'A part failed or was not tested (not tested is never a pass). ' : ''}${!targetsMet ? 'A release target is not met.' : ''}`, ``);
out.push(`## Release targets (each must be 0)`, ``, `| Target | Count | |`, `|---|---|---|`, T(unverified, 'Unverified return connections presented as confirmed'), T(crit, 'Unhandled critical workflow failures'), T(notRun, 'Mandatory tests not executed'), T(s1Count, 'Safety findings (S1), including any known or warned'), ``, `A safety finding is never a warning: it blocks the release until fixed.`, ``,
  `| Also required (QA spec v2) | Count | |`, `|---|---|---|`,
  `| Nightly safety finding not yet fixed or cleared | ${nightlyHold} | ${nightlyHold ? 'NOT MET' : 'met'} |`,
  `| Warnings without an owner or past their date (docs/qa/warns.json) | ${badWarns.length} | ${badWarns.length ? 'NOT MET: ' + [...new Set(badWarns)].join(', ') : 'met'} |`,
  `| Safety changes since the published build with no independent review (docs/qa/reviews.md) | ${unreviewed.length} | ${unreviewed.length ? 'NOT MET (not tested): ' + unreviewed.join(', ') : 'met'} |`,
  `| Open S1 or P1 rows in the escaped-bug ledger | ${openSevere.length} | ${openSevere.length ? 'NOT MET: ' + openSevere.join(', ') : 'met'} |`, ``, nightlyLine, ``);
// Gate health (spec v2, T6): a part over 20 min, or fewer than half of the last 10 finished runs green, is a defect of the
// gate itself (it gets a ledger row; it does not block this release on its own).
const J = v => { try { return JSON.parse(process.env[v] || '[]'); } catch (e) { return []; } }, mins = (a, b) => (Date.parse(b) - Date.parse(a)) / 60000;
const gRuns = J('GATE_RUNS'), tJobs = J('THIS_JOBS').filter(j => j.s && j.e && j.name !== 'Release report');
const green = gRuns.filter(r => r.conclusion === 'success').length, slow = tJobs.filter(j => mins(j.s, j.e) > 20);
out.push(`## Gate health`, ``, gRuns.length ? `- Last ${gRuns.length} finished gate runs: ${green} green, ${gRuns.filter(r => r.conclusion === 'failure').length} failed, ${gRuns.filter(r => r.conclusion === 'cancelled').length} cancelled.${green * 2 < gRuns.length ? ' **Below half green: a gate defect, record it in docs/qa/escapes.md.**' : ''}` : '- Run history not available.',
  tJobs.length ? `- This run's parts: ${tJobs.map(j => `${j.name.split(':')[0]} ${Math.round(mins(j.s, j.e))} min`).join(', ')}; whole run ${Math.round(mins(tJobs.reduce((a, j) => j.s < a ? j.s : a, tJobs[0].s), tJobs.reduce((a, j) => j.e > a ? j.e : a, tJobs[0].e)))} min.${slow.length ? ' **Over 20 min: ' + slow.map(j => j.name.split(':')[0]).join(', ') + ' (a gate defect).**' : ''}` : '- Part times not available.', ``);
out.push(`## 1. What was tested`, ``, `| Part | Result |`, `|---|---|`, ...parts.map(k => `| ${NAMES[k] || k} | ${word(needs[k] && needs[k].result)} |`), ``);
out.push(`## 2. What was not tested`, ``, ...(parts.filter(k => !ran(k)).map(k => `- ${NAMES[k] || k}: ${word(needs[k] && needs[k].result)}`)), `- Known gaps, never tested by the gate (docs/qa/test-map.md):`, ...gaps.map(g => '  ' + g), `- AI answers at runtime: AI is off by Richard's rule, so they are not tested here. The recorded stories are checked at build time (factcheck.json), not in this gate.`, ``);
out.push(`## 3-5. Counts`, ``, `- Gate parts: ${parts.filter(k => needs[k] && needs[k].result === 'success').length} passed, ${parts.filter(k => needs[k] && needs[k].result === 'failure').length} failed, ${parts.filter(k => !ran(k)).length} not tested (blocked, skipped or cancelled).`,
  `- Rules checked on every planned day: ${ruleOk} with no finding, ${ruleFail} failing, ${ruleWarn} known and reported (WARN).`, `- Single test cases: ${casesPass} passed, ${casesFail} failed.`, ``);
out.push(`## 6. New bugs found in this run`, ``, ...(parts.filter(k => fails(k)).length ? parts.filter(k => fails(k)).map(k => `### ${NAMES[k] || k}\n\n\`\`\`\n${fails(k).split('\n').slice(0, 40).join('\n')}\n\`\`\``) : ['None.']), ``);
out.push(`## 7. Previously known bugs`, ``, ...(warns.length ? warns.map(w => `- ${w}`) : ['- No known finding is reported as WARN in this run.']), ...openEsc, ``);
out.push(`## 8. Safety concerns (S1 lines in this run)`, ``, ...(s1.length ? s1.slice(0, 30).map(l => '- ' + l.trim()) : ['- None found by the checks that ran.']), ``);
out.push(`## 9. AI factuality concerns`, ``, `- AI is off at runtime. ${/ai-honesty|AI honesty/i.test(all) ? 'The AI-honesty check (the app claims nothing the AI cannot do) ran in part 8.' : 'The AI-honesty check did not run: NOT TESTED.'} Guide stories are checked at build time against their sources, not by this gate.`, ``);
out.push(`## 10. Root causes`, ``, `Each escaped bug's root cause and "why didn't a test catch it" are in docs/qa/escapes.md. A failure in this run is investigated by the thread that owns the code it touches, and gets a row there if it reached a published build.`, ``);
out.push(`## 11. Corrections made since the published build`, ``, ...(corrections.length ? corrections.slice(0, 60) : [range ? '- None.' : '- Published build not given: not compared.']), ``);
out.push(`## 12. Regression tests added or changed since the published build`, ``, ...(testsAdded.length ? testsAdded.map(l => '- ' + l.replace(/^A\s+/, 'added ').replace(/^M\s+/, 'changed ')) : [range ? '- None.' : '- Published build not given: not compared.']), ``);
out.push(`## 13. Remaining risks`, ``, `- Every gap listed in section 2, and the open rows in section 7.`, `- The gate plans offline with the saved trips: live helper answers (timetables, maps) are checked by the nightly and weekly runs, not here.`, ``);
out.push(`## 14. Release recommendation`, ``, `**${ok ? 'RELEASE OK' : 'DO NOT RELEASE'}.** Publish only from a commit whose report says RELEASE OK, then check the live site's version and the changed behavior there before reporting it live.`);
console.log(out.join('\n'));
process.exitCode = ok ? 0 : 1;
