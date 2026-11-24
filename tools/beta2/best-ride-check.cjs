// R-12 / R-33: the best ride, worked out apart from the planner. Second fault audit (Nov 24): rides were the weakest area
// (4 of 20 planted bugs caught); several bugs gave a different but still plausible ride that no check compared with
// anything. This check keeps its OWN copy of the ride rules in plain numbers (walking limits, walking speed, road speed
// bands, when a walk is offered, when a bus wins, luggage, the extra time before a deadline, the 2-hour departure rule,
// the gap to a known ride, the best order of a day's stops) and asks the engine the same questions over a grid of
// distances that sits on every boundary. Any difference is a finding: either the engine changed a rule (then this copy and
// docs/qa/RULES.md change with it, on purpose) or a bug changed it.
// Then a set of bugs from the audit is planted in copies of the engine on every run, and each one must be caught.
// Usage: node tools/beta2/best-ride-check.cjs
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const SRC = path.join(__dirname, '..', '..', 'src');

function run(E) {
  const bad = []; const t = (c, m) => { if (!c && bad.length < 40) bad.push(m); };
  // ---- The rules, in plain numbers (not read from the engine) ----
  const LIMIT = { low: 0.8, medium: 1.7, high: 3.2 }, SPEED = { low: 3.6, medium: 4.5, high: 4.5 }, EITHER = 4, BAGS = 10;
  const speedOf = d => d <= 6 ? 22 : d <= 15 ? 22 + (d - 6) * 8 / 9 : d <= 40 ? 30 + (d - 15) * 1.2 : d <= 70 ? 60 + (d - 40) * 2 / 3 : Math.min(85, 80 + (d - 70) * 0.1);
  const taxiOf = d => { const k = 1.3 - 0.1 * Math.min(1, Math.max(0, (d - 15) / 25)), add = 10 + 5 * Math.min(1, d / 40); return Math.round(add + d * k / speedOf(d) * 60); };
  const footOf = (km, walk) => Math.max(2, Math.round(km / SPEED[walk] * 60));
  const slackOf = m => m < 30 ? 0 : Math.max(15, Math.round(m * 0.3 / 5) * 5);
  const pubWins = (pub, road) => !(road < pub - 40 && road < pub * 0.6);
  // A point d km east of a start at the equator-ish latitude used (the engine's distance is the haversine).
  const A = { lat: 10, lng: 20 }, east = d => ({ lat: 10, lng: 20 + d / (6371 * Math.PI / 180 * Math.cos(10 * Math.PI / 180)) });
  const DS = [0.01, 0.3, 0.59, 0.61, 0.79, 0.81, 1.0, 1.69, 1.71, 2.5, 3.19, 3.21, 3.99, 4.01, 5, 5.99, 6.01, 10, 14.99, 15.01, 25, 39.99, 40.01, 55, 69.99, 70.01, 120];
  // 1. Plain rides (no lines, no timetables, no water, no known routes): the kind and minutes.
  for (const walk of ['low', 'medium', 'high']) for (const end of ['', 'bags', 'backToShip']) for (const d0 of DS) {
    const B = Object.assign(east(d0), end ? { [end]: true } : {}), d = E.hav(A, B);
    const r = E.makeTravel({ walk }, {}, null, null, null, null).estimate(A, B);
    const lab = `${walk} walker, ${d.toFixed(2)} km${end ? ' (' + end + ')' : ''}`;
    if (d < 0.02) { t(r.kind === 'walk' && r.min === 0, `${lab}: a ride of no distance is a walk of 0 min (got ${r.kind} ${r.min})`); continue; }
    const foot = footOf(d * 1.3, walk), walkOffered = d <= EITHER, taxiOffered = d >= 0.6;
    let taxi = taxiOffered ? taxiOf(d) : null; if (taxi != null && end === 'backToShip') taxi += slackOf(taxi);
    const walkOk = walkOffered && d <= LIMIT[walk] && !(end === 'bags' && foot > BAGS);
    const want = walkOk ? 'walk' : taxiOffered ? 'taxi' : 'walk', wantMin = want === 'walk' ? foot : taxi;
    t(r.kind === want, `${lab}: the ride is a ${want} (got ${r.kind})`);
    if (r.kind === want) t(r.min === wantMin, `${lab}: the ${want} takes ${wantMin} min (got ${r.min})`);
    const ow = (r.options || []).find(o => o.kind === 'walk'), ot = (r.options || []).find(o => o.kind === 'taxi');
    t(!!ow === walkOffered || (!r.options && (r.kind === 'walk') === walkOffered), `${lab}: a walk is ${walkOffered ? '' : 'not '}offered (up to ${EITHER} km)`);
    if (ow) t(ow.min === foot, `${lab}: the walk offered takes ${foot} min (got ${ow.min})`);
    if (ot) t(ot.min === taxi, `${lab}: the taxi offered takes ${taxi} min (got ${ot.min})`);
    if (end === 'backToShip' && r.kind === 'taxi') t(/estimate with \d+ min extra/.test(r.note || '') === (taxi >= 30), `${lab}: a taxi back of ${taxi} min ${taxi >= 30 ? 'says' : 'does not say'} it is an estimate with extra time (note: ${r.note || 'none'})`);
  }
  // 2. A known street route: the walk is as long as the route, the taxi the router's time with traffic and start-up.
  for (const d0 of [0.5, 1.2, 2.2, 3.5]) for (const f of [1.0, 1.8, 3.5]) {
    const B = east(d0), d = E.hav(A, B), fk = d * f, routes = () => ({ foot: { km: fk }, car: { km: fk * 1.1, min: fk * 1.1 / 20 * 60 } });
    const r = E.makeTravel({ walk: 'medium' }, {}, null, null, null, null, routes).estimate(A, B), dw = Math.max(d, fk / 1.3);
    const foot = footOf(Math.max(d * 1.3, fk), 'medium'), taxi = d >= 0.6 ? Math.max(taxiOf(d), Math.round(fk * 1.1 / 20 * 60 * 1.15 + 10)) : null;
    const want = dw <= LIMIT.medium ? 'walk' : taxi != null ? 'taxi' : 'walk', lab = `${d.toFixed(2)} km, street route ${fk.toFixed(2)} km`;
    t(r.kind === want, `${lab}: the ride is a ${want} (got ${r.kind})`);
    if (r.kind === want) t(r.min === (want === 'walk' ? foot : taxi), `${lab}: the ${want} takes ${want === 'walk' ? foot : taxi} min (got ${r.min})`);
  }
  // 3. A bus answered by a timetable: taken only when quicker than the walk, unless the taxi saves a great deal.
  for (const d0 of [1.0, 2.5, 6, 20]) for (const bm of [8, 25, 60, 140]) for (const mode of ['bus', 'metro']) {
    const B = east(d0), d = E.hav(A, B), ans = () => [{ id: 'x1', mode, label: mode === 'bus' ? 'Bus 7' : 'M2', min: bm, steps: [mode === 'bus' ? 'Bus 7' : 'M2'] }];
    const r = E.makeTravel({ walk: 'medium' }, {}, null, null, ans, null).estimate(A, B);
    const foot = footOf(d * 1.3, 'medium'), taxi = taxiOf(d), walkOk = d <= EITHER && d <= LIMIT.medium;
    const offered = d >= 1.5 && (bm < foot || (d > LIMIT.medium && (d > 2 * LIMIT.medium || bm <= foot + 10))) && !(bm > 2 * taxi + 20 && bm > foot);
    const quick = offered && (!(d <= EITHER) || bm < foot);
    const want = walkOk ? 'walk' : quick && pubWins(bm, taxi) ? mode : 'taxi', lab = `${d.toFixed(2)} km, ${mode} ${bm} min`;
    t(r.kind === want, `${lab}: the ride is a ${want} (walk ${foot}, taxi ${taxi}; got ${r.kind} ${r.min})`);
    if (r.kind === mode) { t(r.transitMode === mode, `${lab}: a ${mode} ride says it is a ${mode} (got ${r.transitMode})`); t(r.how === (mode === 'bus' ? 'Bus 7' : 'M2'), `${lab}: the ride's words are the timetable's ("${mode === 'bus' ? 'Bus 7' : 'M2'}"; got "${r.how}")`); }
  }
  // 4. The way to a known ride's ends (borrowed times): on foot up to 0.8 km, else by road.
  for (const km of [0, 0.01, 0.019, 0.02, 0.3, 0.79, 0.8, 0.81, 2, 7]) for (const byRoad of [false, true]) {
    const want = !(km >= 0.02) ? 0 : byRoad ? Math.round(km * 1.3 / 25 * 60) : km <= 0.8 ? Math.ceil(km * 1.3 / 4 * 60) : Math.round(5 + km * 1.3 / 25 * 60);
    t(E.gapMin(km, byRoad) === want, `the way to a known ride ${km} km away ${byRoad ? 'by road' : 'on foot or by taxi'} takes ${want} min (got ${E.gapMin(km, byRoad)})`);
  }
  // 5. A timetabled ride runs near the time: on the way to a deadline only within 60 min (or two intervals); otherwise
  //    dropped only when nothing is known for two hours.
  const leg = (deps, every) => ({ ans: { deps: deps.map(x => ({ t: x })), every, access: { min: 0 } } });
  //    (times in minutes of the day; 6:00 is the first search.)
  const RUNS = [[[600, 720], 0, 590, true, true], [[600, 720], 0, 530, true, false], [[600, 720], 0, 530, false, false], [[900], 0, 600, false, false],
    [[900], 0, 780, false, false], [[400, 900], 0, 700, false, false], [[400, 800], 0, 700, false, true], [[560], 0, 470, false, true], [[600], 0, 700, false, true],
    [[600, 760], 40, 685, true, true], [[600, 760], 20, 685, true, false]];
  for (const [deps, every, at, dl, want] of RUNS) t(E.runsAt(leg(deps, every), at, dl) === want, `departures ${deps.join(',')} (every ${every || '?'}), needed at ${at}${dl ? ' before a deadline' : ''}: ${want ? 'runs' : 'not taken'} (got ${E.runsAt(leg(deps, every), at, dl)})`);
  // 6. A ride swapped for another way says that way, in that way's words.
  const base = E.makeTravel({ walk: 'medium' }, {}, null, null, null, null).estimate(A, east(3));
  const sw = E.legAs(base, { kind: 'bus', id: 'bus', how: 'Bus 12 to the old town', min: 21, steps: [], source: 'timetable' }, 'the taxi rank is closed');
  t(sw.how === 'Bus 12 to the old town' && sw.kind === 'bus' && sw.min === 21, `a ride swapped to the bus says "Bus 12 to the old town", 21 min (got "${sw.how}", ${sw.kind}, ${sw.min})`);
  // 7. The best order of a day's stops: the shortest of every order, up to 8 stops (worked out by trying them all).
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const perms = a => a.length <= 1 ? [a] : a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map(p => [x].concat(p)));
  for (let k = 0; k < 24; k++) { const n = 4 + (k % 5), stops = [], from = { id: 'F', lat: 10, lng: 20 }, to = k % 2 ? { id: 'T', lat: 10 + rnd() * 0.05, lng: 20 + rnd() * 0.05 } : null;
    for (let i = 0; i < n; i++) stops.push({ id: 's' + i, lat: 10 + rnd() * 0.05, lng: 20 + rnd() * 0.05 });
    const cost = (p, q) => Math.round(E.hav(p, q) * 1000) / 10 + (p.id === 's1' && q.id === 's2' ? 30 : 0);
    const got = E.bestOrder(stops, from, to, cost), gc = E.pathCost(got, from, to, cost);
    const best = Math.min(...perms(stops).map(p => E.pathCost(p, from, to, cost)));
    t(gc <= best + 1e-6, `the best order of ${n} stops is the shortest of every order (${best.toFixed(1)}; got ${gc.toFixed(1)})`); }
  return bad;
}

if (require.main === module) {
  const real = run(require('./engine.cjs'));
  for (const m of real) console.log('FAIL ' + m);
  // Planted on every run: bugs of the second fault audit's kind that a plausible-looking ride hides.
  const PLANTS = [
    ['the walking limit read as "less than" (a walk of exactly the limit)', '10-travel.js', 'pick = w && dw <= lim && ', 'pick = w && dw < lim - 0.02 && '],
    ['the road speed band from 6 km changed', '10-travel.js', 'd <= 15 ? 22 + (d - 6) * 8 / 9', 'd <= 15 ? 24 + (d - 6) * 8 / 9'],
    ['walk minutes per km for the low walker', '10-travel.js', 'speed = walk === "low" ? 3.6 : 4.5', 'speed = walk === "low" ? 4.5 : 4.5'],
    ['the 2-hour rule for departures', '10-travel.js', 'return !(nx - Math.max(at, S) >= 120 ||', 'return !(nx - Math.max(at, S) >= 240 ||'],
    ['the way to a known ride on foot', '10-travel.js', 'km <= 0.8 ? Math.ceil(km * 1.3 / 4 * 60)', 'km <= 0.8 ? Math.ceil(km * 1.3 / 5 * 60)'],
    ['a public ride labelled with its kind, not its line', '10-travel.js', '{ transitMode: pick.transitMode || (pick.ans && pick.ans.mode) || pick.kind }', '{ transitMode: pick.kind === "metro" ? "train" : pick.transitMode || (pick.ans && pick.ans.mode) || pick.kind }'],
    ['the swapped ride keeps the old words', '10-travel.js', 'mode: E.modeOfKind(o.kind), kind: o.kind, how: o.how,', 'mode: E.modeOfKind(o.kind), kind: o.kind, how: leg.how,'],
    ['the extra time back to a ship from 20 min', '10-travel.js', 'if (o.min < 30) continue;', 'if (o.min < 20) continue;'],
    ['the best order searched by a shortcut above 5 stops', '60-route.js', 'sorted.length <= 10 ? exact', 'sorted.length <= 5 ? exact'],
    ['a bus taken when the taxi saves a great deal', '10-travel.js', 'E.publicWins = (pub, roadMin) => !(roadMin < pub - 40 && roadMin < pub * 0.6);', 'E.publicWins = (pub, roadMin) => !(roadMin < pub - 90 && roadMin < pub * 0.6);'],
  ];
  let blind = 0;
  for (const [name, file, from, to] of PLANTS) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ride-plant-')); fs.cpSync(SRC, tmp, { recursive: true });
    const f = path.join(tmp, 'engine', file), s = fs.readFileSync(f, 'utf8');
    if (!s.includes(from)) { console.log(`FAIL planted copy "${name}" could not be made: the engine text it changes is gone`); blind++; fs.rmSync(tmp, { recursive: true, force: true }); continue; }
    fs.writeFileSync(f, s.replace(from, to));
    const out = cp.spawnSync(process.execPath, ['-e', `const E=require(${JSON.stringify(path.join(__dirname, 'engine.cjs'))});process.stdout.write(JSON.stringify(require(${JSON.stringify(__filename)}).run(E)))`], { env: Object.assign({}, process.env, { ENGINE_SRC: tmp }), encoding: 'utf8' });
    fs.rmSync(tmp, { recursive: true, force: true });
    let n = -1; try { n = JSON.parse(out.stdout).length; } catch (e) { console.log(`FAIL planted "${name}" run broke: ${(out.stderr || '').slice(0, 200)}`); blind++; continue; }
    console.log(`planted (${name}): ${n ? n + ' finding(s), caught' : 'NOT caught - BLIND'}`); if (!n) blind++;
  }
  console.log(`best-ride-check: ${real.length ? real.length + ' failed' : 'all passed'}; planted ${PLANTS.length - blind} of ${PLANTS.length} caught`);
  process.exit(real.length || blind ? 1 : 0);
}
module.exports = { run };
