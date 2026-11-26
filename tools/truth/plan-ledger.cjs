// The plan ledger: every change in what the planner plans is written down, and a change nobody wrote down fails the gate.
//
// Why (fault audit, Nov 24 2026: only 35% of random small bugs planted in day planning and in names and places were
// noticed by any check): the checks judge a plan against rules, and a rule only exists for a kind of bug someone has
// already thought of. A hurried edit that makes lunch 30 minutes later, drops the dinner window, prefers the farther
// restaurant or shortens every distance by a third breaks no rule anyone wrote, so nothing fails, and it ships. Those are
// the bugs nobody has seen yet.
//
// This check needs no rule. It plans every saved test trip with the planner as it is and writes each day down in plain
// words (docs/qa/plan-ledger.txt: every stop, ride and meal with its clock time and minutes, the leave-by time, what was
// left out and every sentence the day explains itself with). The file is kept in the repository. On every run the days
// are planned again and compared with the file:
//   - nothing differs: pass;
//   - anything differs: FAIL, with the days that changed and what changed on them.
// A change that is MEANT (a fix, a new rule) is accepted by running `node tools/truth/plan-ledger.cjs --accept`, which
// rewrites the file; it is committed with the change, so the commit itself shows, line by line, what the change does to
// real trips, and the reviewer reads plans, not code. A change that is NOT meant is a bug caught before release.
// What it cannot do: tell a good change from a bad one (people do that, reading the diff), or see a bug that was
// already in the plans when the ledger was first written (the rule checks, the real-world check and the plan laws,
// tools/truth/plan-laws.cjs, are for those).
//
// The trips are planned on a frozen copy of the place files (tools/truth/plan-ledger-places.json.gz, written by
// --accept --places), so the nightly place refreshes do not move the ledger: only the planner's code and the saved
// trips do. On every run two bugs are planted in a copy of the planner (lunch may start 30 min later; everyone walks a
// little slower) and the check must fail on each.
// Usage: node tools/truth/plan-ledger.cjs [--accept [--places]] [--show 12]
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), zlib = require('zlib'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..'), LEDGER = path.join(ROOT, 'docs', 'qa', 'plan-ledger.txt'), FROZEN = path.join(__dirname, 'plan-ledger-places.json.gz');
const has = k => process.argv.includes('--' + k), arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const clk = m => m == null || !isFinite(m) ? '--:--' : `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m) % 60).padStart(2, '0')}${m >= 1440 ? '+1' : ''}`;

function livePlaces() { const PD = path.join(ROOT, 'tools', 'places', 'data'), places = {}; for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json')).sort()) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; } return places; }
// One day in plain words. Everything a traveler could see change is here; nothing internal (scores, flags) is.
function dayText(d, p, i) {
  const out = [`day ${i + 1} ${d.date || ''} ${d.type || ''} ${d.city || ''}`.trim() + ` | ${clk(p.start)} to ${clk(p.end)}${p.over ? ' OVER' : ''}${p.leaveAt != null ? ' | leave by ' + clk(p.leaveAt) : ''}`];
  for (const x of p.items || []) {
    if (x.t === 'ride') out.push(`  ${x.how || x.kind || x.mode} ${x.min} min${x.wait ? ' +' + x.wait + ' wait' : ''}${x.slack ? ' (' + x.slack + ' kept)' : ''}`);
    else out.push(`  ${clk(x.at)} ${x.t}${x.meal ? ' ' + (x.meal.label || x.meal) : ''}: ${x.name || ''}${x.min != null ? ' ' + x.min + ' min' : ''}${x.shut ? ' SHUT' : ''}${x.late ? ' late ' + x.late : ''}${x.hoursUnknown ? ' (hours not confirmed)' : ''}`);
  }
  if ((p.dropped || []).length) out.push('  left out: ' + p.dropped.map(x => x.name || x.id || x).join('; '));
  if ((p.folded || []).length) out.push('  folded in: ' + p.folded.map(x => (x.name || x.id || x) + (x.into ? ' > ' + x.into : '')).join('; '));
  if ((p.suggest || []).length) out.push('  suggested: ' + p.suggest.map(x => x.name).join('; '));
  for (const e of p.explain || []) out.push('  says: ' + String(e).replace(/\s+/g, ' '));
  return out;
}
function ledgerOf(E, places) {
  const dir = path.join(ROOT, 'tools', 'beta2', 'corpus'), trips = new Map();
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) { const name = f.replace(/\.json$/, ''), b = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); let plans;
    try { plans = E.planTrip(E.applyPlaces(b, places)); } catch (e) { trips.set(name, new Map([['trip', ['does not plan: ' + String(e.message).slice(0, 200)]]])); continue; }
    const days = new Map(); b.days.forEach((d, i) => { const p = plans[i]; days.set('day ' + (i + 1), p && p.items ? dayText(d, p, i) : [`day ${i + 1} ${d.date || ''} ${d.type || ''} ${d.city || ''}`.trim() + ' | no plan']); }); trips.set(name, days); }
  return trips;
}
// The odd trips (tools/beta2/odd-trips.cjs: 300 unusual trips made from the saved ones, the same every run): far more
// kinds of day than the saved trips have (midnight flights, tender ports, bag days, border trains, slow walkers, booked
// and skipped lunches), so far more of the planner's code is run. Kept as one short fingerprint per day (the whole text
// would be 2 MB); a changed day is shown as it is planned now.
const ODD_N = 300, ODD_SEED = 1, crypto = require('crypto');
function oddTrips() { const f = path.join(os.tmpdir(), `ledger-odd-${process.pid}-${Date.now()}.json`);
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'beta2', 'odd-trips.cjs'), '--n', String(ODD_N), '--seed', String(ODD_SEED), '--out', f], { env: Object.assign({}, process.env, { MAKE_ONLY: '1', ENGINE_SRC: '' }), encoding: 'utf8', maxBuffer: 1 << 26 });
  if (!fs.existsSync(f)) throw new Error('the odd trips could not be made: ' + (r.stderr || r.stdout || '').slice(0, 200)); const t = JSON.parse(fs.readFileSync(f, 'utf8')); fs.rmSync(f, { force: true }); return t; }
function oddOf(E, places, trips) { const out = new Map();
  for (const t of trips) { let plans; try { plans = E.planTrip(E.applyPlaces(JSON.parse(JSON.stringify(t.bucket)), places)); } catch (e) { out.set(t.name, { prints: ['does-not-plan'], text: [['does not plan: ' + String(e.message).slice(0, 200)]] }); continue; }
    const text = t.bucket.days.map((d, i) => plans[i] && plans[i].items ? dayText(d, plans[i], i) : [`day ${i + 1} ${d.type || ''} ${d.city || ''} | no plan`]);
    out.set(t.name, { prints: text.map(l => crypto.createHash('sha1').update(l.join('\n')).digest('hex').slice(0, 10)), text }); }
  return out; }
const write = trips => { const out = ['# Plan ledger: what the planner plans for every saved test trip, in plain words.', '# Kept by tools/truth/plan-ledger.cjs. Never edit by hand: run it with --accept and commit the result with the change that caused it.', ''];
  for (const [name, days] of trips) { out.push('## ' + name); for (const lines of days.values()) out.push(...lines); out.push(''); }
  if (trips.odd) { out.push(`#odd ${ODD_N} odd trips (seed ${ODD_SEED}), one fingerprint per day`); for (const [name, o] of trips.odd) out.push('#odd ' + name + ' ' + o.prints.join(' ')); out.push(''); }
  return out.join('\n'); };
const readOdd = text => new Map(text.split('\n').filter(l => /^#odd odd\d/.test(l)).map(l => { const c = l.split(' '); return [c[1], c.slice(2)]; }));
function diffOdd(was, now) { const out = [];
  for (const [name, o] of now) { const w = was.get(name) || []; o.prints.forEach((p, i) => { if (w[i] !== p) out.push({ trip: name, day: 'day ' + (i + 1), head: o.text[i][0].split(' | ')[0], gone: [], added: o.text[i].slice(0, 9), odd: true }); }); }
  for (const name of was.keys()) if (!now.has(name)) out.push({ trip: name, day: 'trip', head: 'no longer made', gone: [], added: [], odd: true });
  return out; }
function read(text) { const trips = new Map(); let t = null, d = null;
  for (const l of text.split('\n')) { if (l.startsWith('## ')) { t = new Map(); trips.set(l.slice(3), t); d = null; } else if (!t || !l || l.startsWith('#')) continue; else if (!l.startsWith('  ')) { d = [l]; t.set(/^day \d+/.test(l) ? l.match(/^day \d+/)[0] : 'trip', d); } else if (d) d.push(l); }
  return trips; }
// The days that differ, each with its lines gone (-) and new (+).
function diff(was, now) { const out = [];
  for (const name of new Set([...was.keys(), ...now.keys()])) { const a = was.get(name) || new Map(), b = now.get(name) || new Map();
    for (const k of new Set([...a.keys(), ...b.keys()])) { const x = a.get(k) || [], y = b.get(k) || []; if (x.join('\n') === y.join('\n')) continue;
      const xs = new Set(x), ys = new Set(y); out.push({ trip: name, day: k, head: (y[0] || x[0] || '').split(' | ')[0], gone: x.filter(l => !ys.has(l)), added: y.filter(l => !xs.has(l)), moved: x.every(l => ys.has(l)) && y.every(l => xs.has(l)) }); } }
  return out; }
const frozen = () => JSON.parse(zlib.gunzipSync(fs.readFileSync(FROZEN)).toString('utf8'));
// odd: the odd trips, made once by the caller (they are the same for every planner compared).
function compare(engineFile, odd) { const E = require(engineFile), places = frozen(), text = fs.readFileSync(LEDGER, 'utf8');
  return diff(read(text), ledgerOf(E, places)).concat(odd ? diffOdd(readOdd(text), oddOf(E, places, odd)) : []); }

if (require.main === module) {
  const engine = path.join(ROOT, 'tools', 'beta2', 'engine.cjs');
  if (has('accept')) {
    if (has('places') || !fs.existsSync(FROZEN)) { fs.writeFileSync(FROZEN, zlib.gzipSync(Buffer.from(JSON.stringify(livePlaces())), { level: 9 })); console.log(`place files frozen for the ledger: ${path.relative(ROOT, FROZEN)} (${Math.round(fs.statSync(FROZEN).size / 1024)} KB)`); }
    const odd = oddTrips(), before = fs.existsSync(LEDGER) ? compare(engine, odd) : null, trips = ledgerOf(require(engine), frozen());
    trips.odd = oddOf(require(engine), frozen(), odd);
    const nOdd = [...trips.odd.values()].reduce((s, o) => s + o.prints.length, 0); fs.writeFileSync(LEDGER, write(trips)); delete trips.odd;
    console.log(`plan ledger written: ${[...trips.values()].reduce((s, d) => s + d.size, 0)} days of ${trips.size} saved trips and ${nOdd} days of ${ODD_N} odd trips${before ? `; ${before.length} day(s) changed from the ledger before` : ''}. Commit docs/qa/plan-ledger.txt with the change that caused it.`);
    process.exit(0);
  }
  if (!fs.existsSync(LEDGER) || !fs.existsSync(FROZEN)) { console.log('FAIL NOT TESTED: no plan ledger yet (run node tools/truth/plan-ledger.cjs --accept)'); process.exit(1); }
  const oddFile = path.join(os.tmpdir(), `ledger-odd-${process.pid}.json`); fs.writeFileSync(oddFile, JSON.stringify(oddTrips()));
  const ch = compare(engine, JSON.parse(fs.readFileSync(oddFile, 'utf8'))), SHOW = +arg('show', 12);
  for (const c of ch.slice(0, SHOW)) { console.log(`FAIL plan changed, not in the ledger: ${c.trip} ${c.head}${c.moved ? ' (same lines, another order)' : ''}${c.odd ? ' (an odd trip: planned now as below)' : ''}`); c.gone.slice(0, 5).forEach(l => console.log('    - ' + l.trim().slice(0, 170))); c.added.slice(0, 5).forEach(l => console.log('    + ' + l.trim().slice(0, 170))); }
  if (ch.length > SHOW) console.log(`    ... and ${ch.length - SHOW} more day(s)`);
  if (ch.length) console.log(`${ch.length} day(s) on ${new Set(ch.map(c => c.trip)).size} saved trip(s) are planned differently from the ledger. If every one of these changes is meant, run: node tools/truth/plan-ledger.cjs --accept   and commit docs/qa/plan-ledger.txt with the change (the diff is the record of what the change does to real trips). If any is not meant, it is a bug.`);
  // Planted: two edits no rule check notices. The ledger must see both.
  const PLANTS = [['lunch may start 30 min later', '70-day.js', null], ['everyone walks a little slower', '10-travel.js', ['speed = walk === "low" ? 3.6 : 4.5', 'speed = walk === "low" ? 3.6 : 4.2']]];
  { const core = fs.readFileSync(path.join(ROOT, 'src', 'engine', '00-core.js'), 'utf8'), m = /E\.MEAL_LATE = (\d+);/.exec(core); if (m) { PLANTS[0][1] = '00-core.js'; PLANTS[0][2] = [m[0], `E.MEAL_LATE = ${+m[1] + 30};`]; } }
  let blind = 0;
  // LEDGER_NO_PLANTS=1 (the fault audit, which plants its own bugs): the comparison alone.
  for (const [name, file, edit] of process.env.LEDGER_NO_PLANTS ? [] : PLANTS) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-plant-')); fs.cpSync(path.join(ROOT, 'src', 'engine'), path.join(tmp, 'engine'), { recursive: true }); if (fs.existsSync(path.join(ROOT, 'src', 'engine-data'))) fs.cpSync(path.join(ROOT, 'src', 'engine-data'), path.join(tmp, 'engine-data'), { recursive: true });
    const f = path.join(tmp, 'engine', file), s = fs.readFileSync(f, 'utf8');
    if (!edit || !s.includes(edit[0])) { console.log(`FAIL the planted copy "${name}" could not be made: the engine text it changes is gone`); process.exit(1); }
    fs.writeFileSync(f, s.replace(edit[0], edit[1]));
    const o = cp.spawnSync(process.execPath, ['-e', `process.stdout.write(String(require(${JSON.stringify(__filename)}).compare(${JSON.stringify(engine)}, JSON.parse(require('fs').readFileSync(${JSON.stringify(oddFile)}, 'utf8'))).length))`], { env: Object.assign({}, process.env, { ENGINE_SRC: tmp }), encoding: 'utf8', maxBuffer: 1 << 26 });
    fs.rmSync(tmp, { recursive: true, force: true });
    // The planted copy is compared with the ledger; days already differing on the real planner are taken off.
    const n = +o.stdout; if (!isFinite(n) || o.status) { console.log('FAIL planted run broke: ' + (o.stderr || '').slice(0, 300)); process.exit(1); }
    console.log(`planted (${name}): ${n > ch.length ? (n - ch.length) + ' more day(s) differ, caught' : 'NOT caught - BLIND'}`); if (!(n > ch.length)) blind++;
  }
  fs.rmSync(oddFile, { force: true });
  console.log(`plan-ledger: ${ch.length ? ch.length + ' day(s) changed and not in the ledger' : 'every day of every saved trip and every odd trip is planned as the ledger says'}; ${process.env.LEDGER_NO_PLANTS ? 'planted copies not run' : `planted ${PLANTS.length - blind} of ${PLANTS.length} caught`}`);
  process.exit(ch.length || blind ? 1 : 0);
}
module.exports = { compare, ledgerOf, dayText, diff, read, write, oddTrips, oddOf };
