// Fault audit: do the checks catch bugs nobody has thought of yet? (Richard, Nov 24 2026: "you did 6998 passes with 0
// errors. Either that means we are ready or there is fault in our pass testing.")
//
// A pass count only says the checks agree with the code. This plants RANDOM small bugs (not past bugs: those are in
// mutants.cjs) into a copy of the planner, one at a time, the kind a hurried edit makes: a < that should be <=, a number
// off (a buffer, a walking speed, a limit), && for ||, a + for a -, a ! dropped. Then it runs the release gate's
// engine-side checks on that copy and counts what share of the planted bugs at least one check notices, by area.
// A bug that changes nothing a traveler could ever see is possible (an "equivalent" change), so the missed share is an
// upper bound; the missed list is printed so a person can read them.
//
// Usage: node tools/truth/fault-audit.cjs [--per 30] [--seed 1] [--lanes 4] [--area leave-by,rides] [--out file.json]
// Needs tools/beta2/snapshots (cp tools/beta2/corpus/*.json tools/beta2/snapshots/) and opening_hours installed.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const PER = +arg('per', 30), LANES = +arg('lanes', 4), OUT = arg('out', null);
let seed = +arg('seed', 1); const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const AREAS = {
  'leave-by and deadlines': ['30-window.js', '90-timeline.js'],
  'rides': ['10-travel.js', '12-transit.js', '60-route.js'],
  'day planning and lunch': ['95-plan.js', '70-day.js', '40-ledger.js', '50-worth.js', '35-groups.js', '55-areas.js', '36-tags.js'],
  'opening hours': ['20-hours.js', '22-ohours.js', '23-dayrules.js'],
  'names and places': ['00-core.js', '05-places.js'],
  'screen rules': ['../features/screen-rules.js'],
};
// The screen rules read the page, not the planner: their own planted-bug proof is the check that runs on them.
const SCREEN_CHECKS = [['screen-rule proof', ['tools/truth/screen-rule-proof.cjs']]];
const ONLY = (arg('area', '') || '').split(',').filter(Boolean);
// The checks, in order of speed; the first that fails catches the bug (the rest are not run).
const CHECKS = [
  ['engine-test', ['tools/beta2/engine-test.cjs'], { FAIL_FAST: '1' }],
  ['route times', ['tools/beta2/route-time-check.cjs']],
  ['best ride', ['tools/beta2/best-ride-check.cjs']],
  ['real-world rides', ['tools/truth/real-world-gate.cjs']],
  ['independent check', ['tools/truth/oracle.cjs', '--corpus']],
  ['hours-test', ['tools/beta2/hours-test.cjs']],
  ['lunch check', ['tools/beta2/lunch-during-check.cjs'], { PLACES_DIR: 'tools/places/data' }],
  ['reason numbers', ['tools/beta2/reason-numbers-check.cjs']],
  ['language', ['tools/truth/language-check.cjs'], { PLACES_DIR: 'tools/places/data' }],
  ['names', ['tools/beta2/names-check.cjs'], { PLACES_DIR: 'tools/places/data' }],
  // The rest of the gate's safety part: the independent check in its other two modes, and the 300 odd trips with the
  // older day checks and the independent check on them (the slowest, so last).
  ['independent check, unconfirmed notes', ['tools/truth/oracle.cjs', '--corpus', '--unconfirmed']],
  ['independent check, no timetable', ['tools/truth/oracle.cjs', '--corpus', '--no-timetable']],
  ['odd trips', src => ['tools/beta2/odd-trips.cjs', '--n', '300', '--seed', '1', '--warn', 'walk', '--out', path.join(src, 'odd.json')], { NOZIG: '1', SLOW_MS: '60000' }],
  ['independent check on odd trips', src => ['tools/truth/oracle.cjs', '--trips', path.join(src, 'odd.json')]],
];
// Mutation operators: each finds candidate spots on a line (outside strings, regexes and comments, roughly) and returns
// the changed line.
const OPS = [
  ['< to <=', /(?<![<=>!])<(?![<=])(?=\s*[\w(.+-])/g, '<='], ['<= to <', /<=/g, '<'], ['> to >=', /(?<![-=<>])>(?![>=])(?=\s*[\w(.+-])/g, '>='], ['>= to >', />=/g, '>'],
  ['&& to ||', /&&/g, '||'], ['|| to &&', /\|\|(?!=)/g, '&&'],
  ['+ to -', /(?<=[\w)\]] )\+(?= [\w(])/g, '-'], ['- to +', /(?<=[\w)\]] )-(?= [\w(])/g, '+'],
  ['number up', /(?<![\w.])(\d{2,4})(?![\w.])/g, m => String(Math.round(+m * 1.5) + 5)], ['number down', /(?<![\w.])(\d{2,4})(?![\w.])/g, m => String(Math.max(0, Math.round(+m * 0.5)))],
  ['drop !', /!(?=[\w(])(?!=)/g, ''],
];
const codeOf = l => l.replace(/\/\/.*$/, '').replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, s => ' '.repeat(s.length)).replace(/\/(?![*/])(?:[^/\\\n]|\\.)+\/[gimsuy]*/g, s => ' '.repeat(s.length));
function candidates(file) {
  const lines = fs.readFileSync(path.join(ROOT, 'src', 'engine', file), 'utf8').split('\n'), out = [];
  lines.forEach((l, i) => { if (/^\s*(\/\/|\*)/.test(l)) return; const code = codeOf(l);
    OPS.forEach(([name, re, to]) => { for (const m of code.matchAll(new RegExp(re.source, 'g'))) out.push({ file, line: i, col: m.index, len: m[0].length, op: name, to: typeof to === 'function' ? to(m[0]) : to, was: m[0] }); }); });
  return { lines, out };
}
const run = (args, env, cwd) => new Promise(res => { const p = spawn('node', args, { cwd, env: Object.assign({}, process.env, env) }); let o = ''; p.stdout.on('data', d => o += d); p.stderr.on('data', d => o += d);
  const t = setTimeout(() => p.kill('SIGKILL'), 8 * 60000); p.on('close', code => { clearTimeout(t); res({ code, out: o }); }); });

(async () => {
  const plan = [];
  for (const [area, files] of Object.entries(AREAS)) { if (ONLY.length && !ONLY.some(a => area.startsWith(a))) continue;
    const pool = files.flatMap(f => candidates(f).out);
    const seen = new Set();
    while (plan.filter(p => p.area === area).length < Math.min(PER, pool.length) && seen.size < pool.length) { const c = pool[Math.floor(rnd() * pool.length)], k = `${c.file}:${c.line}:${c.col}:${c.op}`; if (seen.has(k)) continue; seen.add(k); plan.push(Object.assign({ area }, c)); } }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fault-')), rows = [];
  let next = 0;
  const lane = async () => { while (next < plan.length) { const m = plan[next++], src = path.join(tmp, 'm' + plan.indexOf(m));
    fs.cpSync(path.join(ROOT, 'src', 'engine'), path.join(src, 'engine'), { recursive: true });
    if (fs.existsSync(path.join(ROOT, 'src', 'engine-data'))) fs.cpSync(path.join(ROOT, 'src', 'engine-data'), path.join(src, 'engine-data'), { recursive: true });
    const f = path.join(src, 'engine', m.file), lines = fs.readFileSync(path.join(ROOT, 'src', 'engine', m.file), 'utf8').split('\n'), l = lines[m.line];
    lines[m.line] = l.slice(0, m.col) + m.to + l.slice(m.col + m.len); m.before = l.trim().slice(0, 160); m.after = lines[m.line].trim().slice(0, 160);
    if (m.area === 'screen rules') { // a copy of the screen rules, loaded by the proof in place of the real one
      const real = path.join(ROOT, 'src', 'features', 'screen-rules.js'), proof = path.join(src, 'proof.cjs');
      fs.writeFileSync(path.join(src, 'screen-rules.js'), lines.join('\n'));
      fs.writeFileSync(proof, fs.readFileSync(path.join(__dirname, 'screen-rule-proof.cjs'), 'utf8').replace("require('../beta2/screen-rules.cjs')", `require(${JSON.stringify(path.join(src, 'screen-rules.js'))})`)
        .replace("path.join(__dirname, '..', '..', 'src', 'features', 'screen-rules.js')", JSON.stringify(path.join(src, 'screen-rules.js'))).replace("require('./screen-fixtures.json')", `require(${JSON.stringify(path.join(__dirname, 'screen-fixtures.json'))})`));
      let r; try { require(path.join(src, 'screen-rules.js')); r = await run([proof], {}, ROOT); } catch (e) { r = null; }
      if (!r) rows.push(Object.assign(m, { result: 'not counted (does not load)' })); else rows.push(Object.assign(m, { result: r.code ? 'caught' : 'missed', by: r.code ? 'screen-rule proof' : null }));
      process.stderr.write(`${rows.length}/${plan.length} ${rows[rows.length - 1].result}  screen-rules.js:${m.line + 1} ${m.op}\n`); fs.rmSync(src, { recursive: true, force: true }); continue; }
    fs.writeFileSync(f, lines.join('\n'));
    // A planted change that stops the engine loading at all is a typo, not a bug a traveler would meet: not counted.
    const load = await run(['-e', `require(${JSON.stringify(path.join(ROOT, 'tools', 'beta2', 'engine.cjs'))})`], { ENGINE_SRC: src }, ROOT);
    if (load.code) { rows.push(Object.assign(m, { result: 'not counted (does not load)' })); fs.rmSync(src, { recursive: true, force: true }); continue; }
    let by = null;
    for (const [name, args, env] of CHECKS) { const r = await run(typeof args === 'function' ? args(src) : args, Object.assign({ ENGINE_SRC: src }, env || {}), ROOT); if (r.code) { by = name; m.why = (r.out.match(/^(FAIL|MISSED|NOT TESTED).*$/m) || [r.out.trim().split('\n').pop() || ''])[0].slice(0, 200); break; } }
    rows.push(Object.assign(m, { result: by ? 'caught' : 'missed', by }));
    process.stderr.write(`${rows.length}/${plan.length} ${by ? 'caught by ' + by : 'MISSED'}  ${m.file}:${m.line + 1} ${m.op}\n`);
    fs.rmSync(src, { recursive: true, force: true }); } };
  await Promise.all(Array.from({ length: LANES }, lane));
  fs.rmSync(tmp, { recursive: true, force: true });
  const counted = rows.filter(r => r.result !== 'not counted (does not load)');
  console.log(`Fault audit: ${counted.length} random bugs planted in the planner (seed ${arg('seed', 1)}), ${rows.length - counted.length} more did not load and are not counted\n`);
  console.log('| Area | Planted | Caught | Share | Caught first by the engine tests |\n|---|---|---|---|---|');
  for (const area of Object.keys(AREAS)) { const a = counted.filter(r => r.area === area); if (!a.length) continue; const c = a.filter(r => r.result === 'caught');
    console.log(`| ${area} | ${a.length} | ${c.length} | ${Math.round(100 * c.length / a.length)}% | ${a.filter(r => r.by === 'engine-test').length} |`); }
  const c = counted.filter(r => r.result === 'caught');
  console.log(`| **All** | ${counted.length} | ${c.length} | ${Math.round(100 * c.length / Math.max(1, counted.length))}% | ${counted.filter(r => r.by === 'engine-test').length} |\n`);
  console.log('Missed (each could be a bug no check would notice, or a change that makes no difference; read them):');
  counted.filter(r => r.result === 'missed').forEach(r => console.log(`- [${r.area}] ${r.file}:${r.line + 1} ${r.op}: ${r.before}  =>  ${r.after}`));
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
})();
