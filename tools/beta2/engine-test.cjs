// Beta 2 engine tests: each piece on its own (made-up days) and against the old engine (saved test trips).
// Pure Node, no browser, no internet, no AI. Usage: node tools/beta2/engine-test.cjs
const E = require('./engine.cjs'), fs = require('fs'), path = require('path');
let fails = 0, oks = 0; const ok = (c, msg) => { if (c) oks++; else { fails++; console.log('FAIL ' + msg); } };
const tr = E.makeTravel({ walk: 'medium' }, {});
const port = { name: 'Port', lat: 37.94, lng: 23.64 }, hotel = { name: 'Hotel', lat: 37.97, lng: 23.73 }, air = { name: 'Airport', lat: 37.94, lng: 23.94 };
const day = o => Object.assign({ type: 'land', mode: 'flight', startTime: '09:00', hours: 8, returnToStart: true, lodging: hotel, point: port }, o);

// ---- Safety times (Rule #2) ----
{ const w = E.dayWindow(day({ type: 'port', portArrive: 480, allAboard: 1020 }), tr);
  ok(w.start === 510 && w.endBy === 975 && w.hard, `port day: ashore 30 min after docking, back 45 min before all aboard (got ${w.start}-${w.endBy})`); }
{ const w = E.dayWindow(day({ type: 'port', portArrive: 480, allAboard: 1020, tender: true }), tr); ok(w.start === 540, 'tender port: an hour to get ashore'); }
{ const w = E.dayWindow(day({ type: 'embark', allAboard: 1020, boardAt: 780 }), tr); ok(w.endBy === 780, 'boarding day: at the terminal by the boarding time'); }
{ const w = E.dayWindow(day({ type: 'embark', allAboard: 1020, boardAt: 990 }), tr); ok(w.endBy === 960, 'boarding day: never later than an hour before all aboard'); }
{ const w = E.dayWindow(day({ type: 'departure', mode: 'flight', time: '15:00' }), tr); ok(w.endBy === 720, 'flight: at the airport 3 h early'); }
{ const w = E.dayWindow(day({ type: 'departure', mode: 'train', time: '15:00' }), tr); ok(w.endBy === 870, 'train: at the station 30 min early'); }
{ const w = E.dayWindow(day({ type: 'embark', allAboard: 930, boardAt: null, thru: { mode: 'flight', time: '11:25', point: air } }), tr);
  ok(w.straight === true && w.tail.length === 1 && w.head.length === 1, 'same-day fly-in with under 3 h free: straight to the ship'); }
{ const w = E.dayWindow(day({ type: 'embark', allAboard: 1200, boardAt: null, thru: { mode: 'flight', time: '08:00', point: air } }), tr);
  ok(!w.straight && w.notes.includes('flyInWarn'), 'same-day fly-in with time to spare: sightseeing, with the late-flight warning'); }
{ const w = E.dayWindow(day({ type: 'port', portArrive: NaN, allAboard: 1020 }), tr); ok(w.error && /times/.test(w.error), 'missing ship times: an error, never a guess'); }
{ const w = E.dayWindow(day({ type: 'port', portArrive: 480, allAboard: 1020, point: Object.assign({}, port, { unknown: true }) }), tr); ok(w.error && w.unsure, 'unknown port: not planned on a guess'); }
{ const far = { lat: 38.2, lng: 23.0, name: 'Far' }, back = Object.assign({}, port, { backToShip: true });
  const a = tr.estimate(far, port), b = tr.estimate(far, back); ok(b.min > a.min && b.slack >= 15, 'long ride back to the ship gets at least 15 extra minutes'); }

// ---- Travel estimate is stable and order-free ----
{ const a = { lat: 37.97, lng: 23.72 }, b = { lat: 37.975, lng: 23.73 };
  ok(tr.min(a, b) === tr.min(a, b) && tr.estimate(a, b).mode === 'walk', 'short hop is a walk, same answer every time');
  const tr2 = E.makeTravel({ walk: 'medium' }, { [E.pairKey(a, b)]: 'taxi' }); ok(tr2.estimate(a, b).mode === 'ride', "traveler's chosen ride is used");
  ok(tr.saidMin('About 1 hour on the Circumvesuviana train') === 60 && tr.saidMin('60-75 min') === 75, "guide's ride notes are read"); }

// ---- Opening hours ----
{ const oh = { spans: [[540, 1020]], last: 960 };
  ok(E.hoursFit(oh, 500, 60).wait === 40, 'waits for opening'); ok(E.hoursFit(oh, 970, 60).late === 10, 'late after last entry');
  ok(E.closedForDay({ closed: true }, { start: 0, endBy: 1440 }), 'closed date is closed');
  ok(E.closedForDay({ oh: { spans: [[1200, 1320]] } }, { start: 510, endBy: 975 }, 60), 'open only outside the window counts as closed'); }

// ---- Against the old engine: every day's window on the saved test trips ----
const dir = path.join(__dirname, 'snapshots');
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const s = JSON.parse(fs.readFileSync(path.join(dir, f))), t2 = E.makeTravel(s.prefs, s.legModes); let n = 0;
  s.days.forEach((d, i) => { const o = s.old[i], w = E.dayWindow(d, t2); if (!o || o.error) { ok(!!w.error || !d.city, `${f} day ${i}: old engine had no plan (${o && o.error}) but the new window has none of its reasons`); return; }
    n++; ok(!w.error, `${f} day ${i}: new window error ${w.error}`); if (w.error) return;
    ok(w.start === o.start && w.endBy === o.endBy, `${f} day ${i} ${d.type}: window ${w.start}-${w.endBy}, old ${o.start}-${o.endBy}`);
    ok(!!w.straight === !!o.straight && w.head.length === o.head.length && w.tail.length === o.tail.length, `${f} day ${i}: fixed steps differ`); });
  console.log(`ok   ${s.name}: ${n} day windows compared with the old engine`);
}

// ---- Against the old engine: the timed day. The old engine's own stop order, walked through the new clock, must
// end at the same minute (rides, waits for opening, visits, meals, fixed steps).
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const s = JSON.parse(fs.readFileSync(path.join(dir, f))), t2 = E.makeTravel(s.prefs, s.legModes); let n = 0, same = 0;
  s.days.forEach((d, i) => { const o = s.old[i]; if (!o || o.error) return; const w = E.dayWindow(d, t2), c = s.cities[d.city], all = [...c.sites, ...c.farther];
    const body = o.items.slice(1 + (w.head.length - 1) * 2, o.items.length - w.tail.length * 2), seq = [];
    for (const x of body) { if (x.t === 'stop') { const f0 = all.find(y => y.id === x.id); seq.push(f0 ? Object.assign({}, f0, { minutes: x.min }) : null); }
      else if (x.t === 'meal') seq.push({ id: 'meal', name: x.name, lat: x.lat, lng: x.lng, mealOf: E.MEALS.find(m => m.label === x.meal), len: x.min }); }
    if (seq.includes(null) || body.some(x => x.t === 'fixed')) return; // area visits (parts) and booked tables are compared once those steps are built
    n++; const r = E.walkDay(seq, w, t2.estimate, id => d.sites[id]);
    if (Math.abs(r.end - o.end) <= 1) same++; else ok(false, `${f} day ${i} ${d.type}: old order ends ${r.end} on the new clock, old engine says ${o.end}`); });
  ok(n > 0, f + ': no days to compare'); oks += same; console.log(`ok   ${s.name}: ${same} of ${n} timed days match the old engine to the minute`);
}
console.log(`\n${oks} checks passed, ${fails} failed`); process.exit(fails ? 1 : 0);
