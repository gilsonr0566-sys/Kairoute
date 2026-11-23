// Planted defects (Nov 23 2026, thread "Rebuild the testing and review process"; QA standard KAI-QA-001 section 8:
// "mutation testing should periodically check whether tests detect deliberately introduced defects").
//
// A green test run proves nothing if the tests could not have failed. Each mutant below puts back, in a copy of the
// engine, one way the planner has really gone wrong (most reached an outside tester or a traveler before a test caught
// them). The gate's day checks then run on that broken copy. Every mutant must be caught; one that is not means a class of
// bug the tests are blind to, and the run fails until a check is added that catches it.
//
// For each mutant the report shows who caught it: the older day checks (odd-trips.cjs, which read the planner's own
// back-by and leave-by) and the independent check (oracle.cjs, which reads only the traveler's own times).
// Usage: node tools/truth/mutants.cjs [--n 150] [--only id,id] [--lanes 4]
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..'), N = +arg('n', 150), ONLY = (arg('only', '') || '').split(',').filter(Boolean), LANES = +arg('lanes', 4);

// Each: the file, the exact text, what it becomes, and the real bug it stands for.
const MUTANTS = [
  { id: 'train-as-tomorrow', file: '30-window.js', from: 'E.NIGHT_DEP = 5 * 60;', to: 'E.NIGHT_DEP = 12 * 60;',
    was: 'A 9:00 am train or a 5:45 am flight read as the next day\'s: a full day of sights after it (first-timer walk and outside test, Nov 22-23)' },
  { id: 'bags-left-as-collected', file: '95-plan.js', from: '/bags/i.test(x.name || "") && !x.head)', to: '/bags/i.test(x.name || ""))',
    was: 'Bags left in storage at the start read as the bags collected: "leave Casa Batlló by" 41 min too late (leaving-days thread, Nov 23)' },
  { id: 'leaveby-late', file: '95-plan.js', from: 'plan.leaveAt = { out: t,', to: 'plan.leaveAt = { out: t + 41,',
    was: 'The leave-by on the banner later than the plan can make (Pompeii 3:21 banner, Nov 18; Ketchikan, Nov 20)' },
  { id: 'airport-time-gone', file: '30-window.js', from: 'flight: { label: "Flight", clear: 75, need: 180,', to: 'flight: { label: "Flight", clear: 75, need: 5,',
    was: 'Time needed at the airport lost (a guide figure or a rounding taking its place)' },
  { id: 'back-after-all-aboard', file: '30-window.js', from: 'w.endBy = aboard - w.buffer;', to: 'w.endBy = aboard + 30;',
    was: 'Back at the ship after all aboard (the ship-day rule Richard calls Rule #2)' },
  { id: 'ashore-before-docking', file: '30-window.js', from: 'w.start = d.portArrive + (d.tender ? E.TENDER_ASHORE : 30);', to: 'w.start = d.portArrive - 90;',
    was: 'Stops before passengers are ashore (failure map, section 1)' },
  { id: 'off-before-arrival', file: '30-window.js', from: 'w.start = E.toMin(d.thru.time) + am.clear;', to: 'w.start = E.toMin(d.thru.time) - 150;',
    was: '"Off the ship 5:30 am" when the ship arrives at 7:00 am (weekly ladder, Nov 22)' },
];

const run = (cmd, args, env) => new Promise(res => { const p = spawn(cmd, args, { cwd: ROOT, env: Object.assign({}, process.env, env) }); let out = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d); p.on('close', code => res({ code, out })); });
// Each rule's count ("FAIL leaveby 3", "WARN night 2", "ok   back 0"), so a rule already failing on the real engine still
// counts as catching the mutant when its count goes up.
const counts = out => { const c = {}; for (const l of out.split('\n')) { const m = /^(FAIL|WARN|ok)\s+(\w+)\s+(\d+)\s*$/.exec(l); if (m) c[m[2]] = +m[3]; } return c; };
const more = (now, base) => Object.keys(now).filter(k => now[k] > (base[k] || 0)).map(k => `${k} ${base[k] || 0} to ${now[k]}`);

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mutants-'));
  const trips = path.join(tmp, 'trips.json');
  // The same unusual trips for every mutant (fixed seed), generated and checked once on the real engine first:
  // a check that already fails on the real engine can't tell us whether it caught the mutant.
  const base = await run('node', ['tools/beta2/odd-trips.cjs', '--n', String(N), '--seed', '7', '--out', trips], { NOZIG: '1', SLOW_MS: '60000' });
  const baseOracle = await run('node', ['tools/truth/oracle.cjs', '--trips', trips]);
  const baseOld = counts(base.out), baseOra = counts(baseOracle.out);
  if (!Object.keys(baseOld).length || !Object.keys(baseOra).length) { console.log('NOT TESTED: the checks did not run on the real engine\n' + base.out.slice(-2000) + baseOracle.out.slice(-2000)); process.exit(1); }
  const already = [...Object.keys(baseOld).filter(k => baseOld[k]), ...Object.keys(baseOra).filter(k => baseOra[k])];
  const list = MUTANTS.filter(m => !ONLY.length || ONLY.includes(m.id)), rows = [];
  let next = 0;
  const lane = async () => { while (next < list.length) { const m = list[next++];
    const src = path.join(tmp, m.id); fs.cpSync(path.join(ROOT, 'src', 'engine'), path.join(src, 'engine'), { recursive: true });
    if (fs.existsSync(path.join(ROOT, 'src', 'engine-data'))) fs.cpSync(path.join(ROOT, 'src', 'engine-data'), path.join(src, 'engine-data'), { recursive: true });
    const f = path.join(src, 'engine', m.file), txt = fs.readFileSync(f, 'utf8');
    // The planted defect must really be planted: when the engine's text has moved on, this says so (NOT TESTED), never "caught".
    if (txt.split(m.from).length !== 2) { rows.push({ m, planted: false }); continue; }
    fs.writeFileSync(f, txt.replace(m.from, m.to));
    const env = { ENGINE_SRC: src, NOZIG: '1', SLOW_MS: '60000' };
    const [old, ora] = await Promise.all([run('node', ['tools/beta2/odd-trips.cjs', '--n', String(N), '--seed', '7'], env), run('node', ['tools/truth/oracle.cjs', '--trips', trips], env)]);
    const o = more(counts(old.out), baseOld), n = more(counts(ora.out), baseOra);
    rows.push({ m, planted: true, old: o, oracle: n });
  } };
  await Promise.all(Array.from({ length: LANES }, lane));
  console.log(`Planted defects: ${list.length}, on ${N} unusual trips (seed 7)${already.length ? `; already finding on the real engine (a mutant counts when it adds more): ${already.join(', ')}` : ''}\n`);
  let missed = 0;
  for (const r of list.map(m => rows.find(x => x.m === m))) {
    const caught = r.planted && (r.old.length || r.oracle.length); if (!caught) missed++;
    console.log(`${!r.planted ? 'NOT TESTED' : caught ? 'caught    ' : 'MISSED    '} ${r.m.id}: ${r.m.was}`);
    if (r.planted) console.log(`             older day checks: ${r.old.length ? r.old.join('; ') : 'nothing'}\n             independent check: ${r.oracle.length ? r.oracle.join('; ') : 'nothing'}`);
    else console.log('             the engine text this mutant changes is gone: update the mutant to the current code');
  }
  const byOld = rows.filter(r => r.planted && r.old.length).length, byOracle = rows.filter(r => r.planted && r.oracle.length).length;
  console.log(`\nCaught by the older day checks: ${byOld} of ${list.length}. By the independent check: ${byOracle} of ${list.length}. Missed or not tested: ${missed}.`);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exitCode = missed ? 1 : 0;
})();
