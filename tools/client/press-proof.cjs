// Proof that "every button pressed" (rule R-40) fires: on every run it plants each way a control has gone wrong and
// the press check must report every one; and it adds a button nobody presses to a copy of the build, which the
// coverage rule must report as NOT PRESSED. A planted defect that gets through fails the release.
//   dead     "Change lunch" swallowed: the press does nothing            -> DEAD
//   error    renaming the day throws                                     -> ERROR
//   jump     ticking a sight pushes the whole screen down 160 px         -> JUMP   (the Choose sights jumping class)
//   jump     the same on the Trip page, when the day's pace is set       -> JUMP   (R-28 on every screen)
//   covered  an unseen layer lies over the lower part of Choose sights   -> COVERED
//   wide     opening a fold makes the page wider than the screen         -> WIDE
//   broken   the hours button prints "undefined" on the screen           -> BROKEN
//   untrue   with no lookup answered, the screen says "couldn't find"    -> UNTRUE
//   nobody   a new action name in the build that no press reaches        -> NOT PRESSED
// Usage: node tools/client/press-proof.cjs [beta2-site/index.html]
const { spawnSync } = require('child_process'); const fs = require('fs'), path = require('path'), os = require('os');
const APP = path.resolve(process.argv[2] || 'beta2-site/index.html'), HERE = __dirname;
const PLANTS = [ // [plant, screens, only these controls, the rule that must fire]
  ['dead', 'plan:land', '^mealopen$', 'DEAD'], ['error', 'plan:land', '^daytitle$', 'ERROR'], ['jump', 'sites:land', '^Pick (Plaka|Lycabettus|National Garden)', 'JUMP'], ['jump', 'trip', '^(Light day|Half day)$', 'JUMP'],
  ['covered', 'sites:land', '^Pick ', 'COVERED'], ['wide', 'plan:land', "^(More about today|About today)", 'WIDE'], ['broken', 'plan:land', '^hrsopen$', 'BROKEN'], ['untrue', 'plan:land', '^mealopen$', 'UNTRUE']];
let missed = 0;
const run = (env, args) => spawnSync(process.execPath, args, { env: Object.assign({}, process.env, env), encoding: 'utf8', maxBuffer: 1 << 26, timeout: 600000 });
// The same presses with nothing planted must pass: otherwise a failure below proves nothing.
const tmp0 = fs.mkdtempSync(path.join(os.tmpdir(), 'press-proof-'));
const clean = run({ TRIPS: 'example', SIZES: 'phone', ROOTS: 'plan:land,sites:land', ONLY: PLANTS.map(p => p[2]).join('|'), MAXDEPTH: '1', OUT: tmp0, PLANT: '', POOL: '2' }, [path.join(HERE, 'press-all.cjs'), APP]);
const cleanFails = (clean.stdout.match(/^FAIL .*$/gm) || []);
if (clean.status !== 0 || cleanFails.length) { console.log('FAIL the proof\'s own presses do not pass with nothing planted:\n' + cleanFails.slice(0, 6).join('\n') + (clean.status === 0 ? '' : '\n' + String(clean.stdout).split('\n').slice(-4).join('\n') + String(clean.stderr).slice(-400))); missed++; }
else console.log('ok   nothing planted: ' + ((clean.stdout.match(/(\d+) presses on/) || [])[1] || '?') + ' presses, no failure');
for (const [plant, roots, only, rule] of PLANTS) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'press-proof-'));
  const r = run({ TRIPS: 'example', SIZES: 'phone', ROOTS: roots, ONLY: only, MAXDEPTH: '1', OUT: out, PLANT: plant, POOL: '2' }, [path.join(HERE, 'press-all.cjs'), APP]);
  const hit = new RegExp('^FAIL ' + rule + ' ', 'm').test(r.stdout || '');
  if (hit && r.status === 1) console.log('ok   planted "' + plant + '" caught: ' + ((r.stdout.match(new RegExp('^FAIL ' + rule + ' .*$', 'm')) || [''])[0]).slice(0, 170));
  else { missed++; console.log('MISSED planted "' + plant + '" was not reported as ' + rule + ' (exit ' + r.status + ')\n' + String(r.stdout).split('\n').slice(-6).join('\n') + String(r.stderr || '').slice(-300)); }
}
// A button nobody presses.
{ const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'press-proof-')), app2 = path.join(dir, 'index.html');
  fs.writeFileSync(app2, fs.readFileSync(APP, 'utf8') + '\n<!-- <button data-act="plantednobodypresses">x</button> -->');
  const r = run({}, [path.join(HERE, 'press-report.cjs'), tmp0, app2]);
  if (/^NOT PRESSED action "plantednobodypresses"/m.test(r.stdout || '') && r.status === 1) console.log('ok   planted "nobody" caught: NOT PRESSED action "plantednobodypresses"');
  else { missed++; console.log('MISSED a new action name no press reached was not reported as NOT PRESSED (exit ' + r.status + ')'); } }
console.log(missed ? `\nPress proof: ${missed} planted defect(s) MISSED` : `\nPress proof: all ${PLANTS.length + 1} planted defects caught`);
process.exitCode = missed ? 1 : 0;
