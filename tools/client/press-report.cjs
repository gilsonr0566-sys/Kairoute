// The report of "every button pressed" (rule R-40): reads what press-all.cjs wrote (OUT/*.json, one file per trip, size
// and part) and writes OUT/summary.md and OUT/summary.json:
//   - how many controls were pressed, on which trips, sizes and screens;
//   - every failure, grouped by rule and by control (one class of failure = one line, with where it was seen);
//   - the coverage rule: every action name in the built app (data-act, in the page or in the code that answers taps)
//     must have been pressed at least once in the run, or be listed in press-expect.cjs (CANNOT) with its reason.
//     Anything else is NOT PRESSED. NOT PRESSED and NOT TESTED are never a pass;
//   - what every control did (one line per kind of control), so a person can read it against what it should do.
// Usage: node tools/client/press-report.cjs [OUT=press-out] [beta2-site/index.html]   Exit 1 on a failure or a gap.
//   NEED=first,example,... : the trips that must be in the run for the coverage rule to be judged (else NOT TESTED).
const fs = require('fs'), path = require('path');
const OUT = path.resolve(process.argv[2] || process.env.OUT || 'press-out'), ROOT = path.join(__dirname, '..', '..');
const APP = path.resolve(process.argv[3] || path.join(ROOT, 'beta2-site', 'index.html')); const X = require('./press-expect.cjs');
const files = fs.readdirSync(OUT).filter(f => f.endsWith('.json') && !/^summary/.test(f));
const runs = files.map(f => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'))); const recs = runs.flatMap(r => r.recs);
const live = runs.some(r => r.live), url = (runs[0] || {}).url || '';
// The action names of the built app.
const inventory = () => { if (!fs.existsSync(APP)) return null; const s = fs.readFileSync(APP, 'utf8'), a = new Set();
  for (const m of s.matchAll(/data-act=\\?["']([a-zA-Z0-9_-]+)/g)) a.add(m[1]);
  for (const m of s.matchAll(/(?:dataset\.act|\bact)\s*===\s*"([a-zA-Z0-9_-]+)"/g)) a.add(m[1]); return a; };
const inv = inventory();
const pressed = recs.filter(r => !r.same && !r.off && !r.skip && !r.notpressed && r.label !== '(state)' && r.label !== '(walk)');
const kindOf = r => r.act ? 'act ' + r.act : (r.data ? 'data ' + r.data.replace(/=[^,]*/g, '').split(',').slice(0, 2).join(',') + ' ' : '') + (r.kind || '') + ' "' + String(r.label || '').replace(/\d+/g, '#').slice(0, 40) + '"';
const acts = new Map(); for (const r of pressed) if (r.act) acts.set(r.act, (acts.get(r.act) || 0) + 1);
const offActs = new Set(recs.filter(r => r.off && r.act).map(r => r.act));
const fails = recs.filter(r => (r.fails || []).length);
const byClass = new Map(); // A screen jump with a known cause is one class per cause (one thing going away moves every control below it).
for (const r of fails) for (const f of r.fails) { const byCause = f[0] === 'JUMP' && r.cause; const k = f[0] + ' | ' + (byCause ? 'cause ' + r.cause.replace(/\d+/g, '#') : kindOf(r)); const g = byClass.get(k) || { rule: f[0], control: byCause ? 'any control below "' + r.cause + '"' : kindOf(r), label: r.label, why: f[1], n: 0, where: new Set(), sizes: new Set(), trips: new Set(), labels: new Set(), ex: r, byCause }; g.n++; g.labels.add(r.label); g.where.add(r.screen); g.sizes.add(r.size); g.trips.add(r.trip); byClass.set(k, g); }
const classes = [...byClass.values()].sort((a, b) => a.rule.localeCompare(b.rule) || b.n - a.n);
const need = (process.env.NEED || '').split(',').filter(Boolean), haveTrips = new Set(runs.map(r => r.trip)), missingTrips = need.filter(t => !haveTrips.has(t));
const notPressed = inv ? [...inv].filter(a => !acts.has(a) && !X.CANNOT[a]).sort() : null, cannot = inv ? [...inv].filter(a => !acts.has(a) && X.CANNOT[a]).sort() : [];
const stale = Object.keys(X.CANNOT).filter(a => acts.has(a));
const cut = recs.filter(r => r.notpressed), skipped = recs.filter(r => r.skip && r.skip !== 'gone'), harness = recs.filter(r => r.harness);
const L = []; const say = s => L.push(s);
say('# Every button pressed' + (live ? ' (live app)' : ' (this build, no internet)')); say('');
say((live ? 'App: ' + url : 'Build: beta2-site/index.html') + '. ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC.'); say('');
say('| | |'); say('|---|---|');
say('| Presses made (real touch, one at a time, app put back before each) | ' + pressed.length + ' |');
say('| Different controls pressed | ' + new Set(pressed.map(r => r.trip + '|' + r.size + '|' + r.root + '|' + (r.path || []).join('>') + '|' + r.label + '|' + (r.data || ''))).size + ' |');
say('| Screens walked (trip x size x screen) | ' + new Set(recs.map(r => r.trip + r.size + r.root)).size + ' |');
say('| Presses that broke a rule | ' + fails.filter(r => !r.harness).length + ' in ' + classes.length + ' classes |');
say('| Greyed-out controls seen (cannot be pressed) | ' + recs.filter(r => r.off).length + ' |');
say('| Action names in the app | ' + (inv ? inv.size : 'not counted (no build given)') + ' |');
if (inv) { say('| ... pressed at least once | ' + [...inv].filter(a => acts.has(a)).length + ' |'); say('| ... NOT PRESSED | ' + notPressed.length + ' |'); say('| ... cannot be pressed in a test (reason given below) | ' + cannot.length + ' |'); }
say('');
say('## Trips and sizes'); say(''); say('| Trip | Size | Presses | With a failure | Minutes |'); say('|---|---|---|---|---|');
const tk = new Map(); for (const r of runs) { const k = r.trip + '|' + r.size; const g = tk.get(k) || { label: r.label, trip: r.trip, size: r.size, n: 0, f: 0, s: 0 }; g.n += r.recs.filter(x => !x.same && !x.off && !x.skip && !x.notpressed).length; g.f += r.recs.filter(x => (x.fails || []).length).length; g.s += r.secs || 0; tk.set(k, g); }
for (const g of tk.values()) say(`| ${g.label} | ${g.size} | ${g.n} | ${g.f} | ${Math.round(g.s / 60)} |`);
say('');
say('## Failures, one line per class'); say('');
if (!classes.length) say('None.'); else { say('| Rule | Control | What happened | Seen | Where |'); say('|---|---|---|---|---|');
  for (const g of classes) say(`| ${g.rule} | ${g.byCause ? g.labels.size + ' controls, e.g. ' : ''}${g.label ? '"' + String(g.label).slice(0, 40).replace(/\|/g, '/') + '"' : ''}${g.ex.act ? ' (' + g.ex.act + ')' : ''} | ${String(g.why).replace(/\|/g, '/').slice(0, 160)} | ${g.n}x, ${[...g.sizes].join('+')} | ${[...g.trips].join(', ')}: ${[...g.where].slice(0, 3).join('; ')}${g.where.size > 3 ? ' (+' + (g.where.size - 3) + ')' : ''}${g.ex.path && g.ex.path.length ? ' after ' + g.ex.path.join(' > ').slice(0, 60) : ''} |`); }
say('');
say('## Not pressed, not tested'); say('');
if (missingTrips.length) say('- NOT TESTED: these trips were not in this run: ' + missingTrips.join(', ') + '.');
if (notPressed && notPressed.length) say('- NOT PRESSED (' + notPressed.length + ' action names no press reached): ' + notPressed.map(a => a + (offActs.has(a) ? ' (seen greyed out only)' : '')).join(', ') + '.');
for (const a of cannot) say('- Cannot be pressed in a test: ' + a + ': ' + X.CANNOT[a]);
for (const a of stale) say('- Listed as cannot be pressed, but it was pressed (take it off the list): ' + a);
for (const r of cut) say(`- NOT PRESSED [${r.trip} ${r.size} / ${r.screen}]: ${r.notpressed}`);
if (skipped.length) say('- ' + skipped.length + ' controls could not be reached again after the app was put back (the steps to them did not repeat): ' + [...new Set(skipped.map(r => '"' + r.label + '"'))].slice(0, 12).join(', ') + (skipped.length > 12 ? ' ...' : '') + '.');
if (harness.length) say('- NOT TESTED: ' + harness.length + ' presses the check itself could not finish.');
if (!live) say('- This run had no internet: every lookup (address, timetable, pier, sights from the web) was pressed, and had to answer honestly without a connection; whether the lookup finds the right thing is tested in the live run only.');
say('- Not pressed by this check: the map itself (pan, zoom, tapping a pin), drag to reorder, the phone\'s own Back button and system pickers (date wheel, share sheet, camera, print dialog: the app\'s call to each is recorded, the system screen is not driven).');
say('');
say('## What every control did'); say(''); say('One line per kind of control: its label, how often it was pressed, and what happened most often.'); say('');
const kinds = new Map(); for (const r of pressed) { const k = kindOf(r); const g = kinds.get(k) || { k, label: r.label, act: r.act, n: 0, did: new Map(), fails: 0, rule: r.rule }; g.n++; const d = (r.did || []).map(s => s.replace(/\d+/g, '#').replace(/"[^"]*"/g, '"…"').slice(0, 60)).slice(0, 2).join('; ') || '(nothing)'; g.did.set(d, (g.did.get(d) || 0) + 1); if ((r.fails || []).length) g.fails++; if (r.rule) g.rule = r.rule; kinds.set(k, g); }
say('| Control | Pressed | What it did (most often) | Held to | Failures |'); say('|---|---|---|---|---|');
for (const g of [...kinds.values()].sort((a, b) => (a.act || 'zz' + a.label).localeCompare(b.act || 'zz' + b.label))) { const top = [...g.did.entries()].sort((a, b) => b[1] - a[1])[0]; say(`| ${g.act ? g.act + ': ' : ''}"${String(g.label).slice(0, 36).replace(/\|/g, '/')}" | ${g.n} | ${top[0].replace(/\|/g, '/')} | ${g.rule ? 'its own rule: ' + g.rule : 'general rules'} | ${g.fails || ''} |`); }
fs.writeFileSync(path.join(OUT, 'summary.md'), L.join('\n') + '\n');
const sum = { live, url, presses: pressed.length, screens: new Set(recs.map(r => r.trip + r.size + r.root)).size, failed: fails.filter(r => !r.harness).length, classes: classes.map(g => ({ rule: g.rule, control: g.control, label: g.label, act: g.ex.act || '', why: g.why, n: g.n, sizes: [...g.sizes], trips: [...g.trips], where: [...g.where].slice(0, 6), path: g.ex.path || [] })), acts: inv ? inv.size : null, actsPressed: inv ? [...inv].filter(a => acts.has(a)).length : null, notPressed, cannot, missingTrips, cut: cut.length, harness: harness.length, ownRules: X.RULES.length };
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(sum, null, 1));
for (const g of classes) console.log(`FAIL ${g.rule} "${g.label}"${g.ex.act ? ' (' + g.ex.act + ')' : ''}: ${g.why} [${g.n}x; ${[...g.trips].join(', ')}; ${[...g.sizes].join('+')}; ${[...g.where][0]}]`);
if (notPressed) for (const a of notPressed) console.log('NOT PRESSED action "' + a + '"' + (offActs.has(a) ? ' (seen greyed out only)' : ''));
for (const t of missingTrips) console.log('NOT TESTED trip ' + t + ' was not in this run');
for (const r of cut) console.log(`NOT PRESSED [${r.trip} ${r.size} / ${r.screen}] ${r.notpressed}`);
if (harness.length) console.log('NOT TESTED ' + harness.length + ' presses the check could not finish');
console.log(`\nEvery button pressed: ${pressed.length} presses, ${sum.screens} screens, ${sum.failed} failures in ${classes.length} classes` + (inv ? `, ${sum.actsPressed} of ${inv.size} action names pressed, ${notPressed.length} NOT PRESSED, ${cannot.length} cannot be pressed` : ''));
process.exitCode = classes.length || (notPressed && notPressed.length) || missingTrips.length || cut.length || harness.length ? 1 : 0;
