// R-06 (E65): a boat the traveler chose is planned, said as not confirmed, on a day with a time to be back, whenever no
// sailing times say it can't work; refused only on real times, and then said truly. Checked on every saved test trip with
// the places files, with a planted copy that must fail.
//  Richard, Nov 27: "Its not allowing the ferry to sorrento again". The helper's ferry known from the map comes as an
//  answer with no sailing times; the engine counted every answer as a timetable, so the old test (only the words "no
//  sailing times are known") refused his own ferry and planned a taxi. Accepted rule (Richard, Nov 26): no published
//  timetable = shown not confirmed, an hour at the pier for the boat back, counted safe.
// For every port day of every saved trip with a time to be back, and every sight of that place 8 km or more from the
// pier (up to 4 a day): the sight is the traveler's only pick, the helper answers every ride to or from it with a ferry
// that has no sailing times (as the map's ferries come), and the traveler taps the ferry on each of those rides. Then:
//  - every such ride the plan makes is the ferry, never a taxi, and says no sailing times are confirmed;
//  - the boat back to the ship holds an hour at the pier and says so, and, with a road home too, when to give up on the
//    boat and take a taxi (from the taxi's own leave-by), so a last boat earlier than planned never costs the ship;
//  - the plan never ends after the time to be back;
//  - with real sailing times that miss the time needed, the chosen boat is refused with the reason (the sailing times
//    found), never "Pick the boat yourself".
// Also R-21: a pick the place's guide doesn't have is said, never dropped under "the reasons are above" (found with E65).
// Usage: node tools/beta2/own-boat-check.cjs
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..'), SRC = path.join(ROOT, 'src');
function run(E) {
  const bad = [], t = (c, m) => { if (!c) bad.push(m); };
  const PD = path.join(ROOT, 'tools', 'places', 'data'), places = {};
  for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; }
  const dir = path.join(ROOT, 'tools', 'beta2', 'corpus'); let days = 0, boats = 0, refused = 0, fastAuto = 0;
  const seen = new Set();
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    const trip = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    trip.days.forEach((d, i) => {
      if (d.type !== 'port' || !E.fin(d.allAboard) || !d.point || !E.fin(d.point.lat) || d.noShore) return;
      const c = trip.cities[d.city]; if (!c) return;
      const sig = d.city + '|' + d.point.lat + ',' + d.point.lng + '|' + d.allAboard + '|' + d.portArrive; if (seen.has(sig)) return; seen.add(sig);
      const far = [].concat(c.sites || [], c.farther || []).filter(s => E.fin(s.lat) && E.hav(s, d.point) >= 8).slice(0, 4);
      for (const s of far) {
        const X = { lat: +s.lat, lng: +s.lng }, touches = (a, b) => (E.hav(a, X) <= 2 && E.hav(b, X) >= 5) || (E.hav(b, X) <= 2 && E.hav(a, X) >= 5);
        const plan = (deps, picks) => { const b = JSON.parse(JSON.stringify(trip)); Object.assign(b.days[i], { selected: [String(s.id)], mine: [String(s.id)], own: true, wantsOnly: false });
          const B = E.applyPlaces(b, places), asked = [];
          B.answers = (a, z) => { if (!touches(a, z)) return null; asked.push([a, z]); const km = E.hav(a, z);
            const off = deps === 'month' ? [1 + (new Date(Date.parse(String(b.days[i].date) + 'T12:00:00Z')).getUTCMonth() + 6) % 12] : null; // six months away
            return [Object.assign({ id: 'boat-test', mode: 'ferry', label: 'Ferry (test)', min: deps === 'fast' ? Math.round(km / 45 * 60) + 5 : Math.round(km / 25 * 60) + 60, wait: deps === 'fast' ? 5 : 60, every: 60, km: +(km * 1.2).toFixed(1), steps: ['Ferry (test)'], access: { min: 2 } }, Array.isArray(deps) ? { deps } : {}, off ? { months: off } : {})]; };
          if (picks) B.legModes = picks;
          return { p: E.planTrip(B)[i], asked }; };
        let first; try { first = plan(null, null); } catch (e) { t(false, `${f} day ${i + 1} ${s.name}: does not plan (${e.message})`); continue; }
        const picks = {}; for (const [a, z] of first.asked) picks[E.pairKey(a, z)] = 'ferry';
        if (!Object.keys(picks).length) continue;
        days++;
        // The app's own choice: a quick boat with no sailing times to a place the road reaches too (not across the water) is
        // never taken on its own and said as "you chose it" on a day with a time to be back; it stays a choice (live check
        // Nov 27, Sorrento). Across the water, a picked place counts as choosing its boat (Richard, Nov 21).
        { let r; try { r = plan('fast', null); } catch (e) { r = null; }
          if (r && r.p && r.p.items) r.p.items.forEach((x, k) => { if (x.t !== 'ride' || x.kind !== 'ferry' || x.isle) return; fastAuto++;
            t(!/planned because you chose it/.test(x.note || ''), `${f} day ${i + 1} ${s.name}: the app took a boat with no sailing times on its own, to a place the road reaches, and said "you chose it"`); }); }
        for (const deps of [null, [6, 7, 8, 20, 21].map(h => ({ t: h * 60 })), 'month']) { // no sailing times; real sailings, mornings and evenings, none near midday; a boat that doesn't run in the trip's month
          let r; try { r = plan(deps, picks); } catch (e) { t(false, `${f} day ${i + 1} ${s.name}: does not plan with the boat chosen (${e.message})`); continue; }
          const p = r.p; if (!p || !p.items) continue;
          if (p.items.length) t(!(E.fin(p.end) && E.fin(p.endBy) && p.end > p.endBy) && !p.over, `${f} day ${i + 1} ${s.name}: with the chosen boat the day ends after the time to be back`);
          p.items.forEach((x, k) => { if (x.t !== 'ride' || !(x.options || []).some(o => o.kind === 'ferry')) return;
            const a = p.items.slice(0, k).reverse().find(y => E.fin(y.lat)), z = p.items.slice(k + 1).find(y => E.fin(y.lat));
            if (a && z && !touches(a, z)) return; const note = x.note || '', back = p.items[k + 1] && p.items[k + 1].t === 'end';
            if (!deps) { boats++;
              t(x.kind === 'ferry', `${f} day ${i + 1} ${s.name}: the ferry the traveler chose${back ? ' back to the ship' : ''} is planned as ${x.how || x.kind} (${note.slice(-160)})`);
              t(x.kind !== 'ferry' || /No sailing times are confirmed/.test(note), `${f} day ${i + 1} ${s.name}: the chosen ferry with no sailing times isn't said as not confirmed`);
              t(x.kind !== 'ferry' || !back || /Up to an hour at the pier/.test(note), `${f} day ${i + 1} ${s.name}: the chosen ferry back to the ship doesn't hold an hour at the pier`);
              // With a road home too, the boat back says when to give up on it and take a taxi, from the taxi's own leave-by.
              const tx = (x.options || []).find(o => o.kind === 'taxi'), m = note.match(/If there is no boat by (\d{1,2}:\d{2} [ap]m), take a taxi no later than (\d{1,2}:\d{2} [ap]m)/);
              if (x.kind === 'ferry' && back && tx && E.fin(p.endBy)) { const by = E.clock(p.endBy - tx.min);
                t(m ? m[2] === by : /A taxi back takes longer than the boat/.test(note), `${f} day ${i + 1} ${s.name}: the chosen ferry back has no taxi fallback timed from the taxi's own leave-by (${by}): ${note.slice(-200)}`); }
            } else { refused++;
              t(x.kind !== 'ferry' || !/No sailing times are confirmed/.test(note), `${f} day ${i + 1} ${s.name}: a chosen ferry with real sailing times is said as having none`); // planned on a real sailing (waiting for it), or refused
              t(!/Pick the boat yourself/.test(note), `${f} day ${i + 1} ${s.name}: the traveler chose the boat, yet the plan says "Pick the boat yourself"`);
              t(x.kind === 'ferry' || /You chose the boat, but|shows no (departure|sailing) near|doesn't run in/.test(note), `${f} day ${i + 1} ${s.name}: the chosen boat is refused without saying why it was refused (${note.slice(-160)})`); }
          });
        }
      }
    });
  }
  // R-21 (found with E65): a pick the place's guide doesn't have is never dropped in silence under "the reasons are above".
  { const trip = JSON.parse(fs.readFileSync(path.join(dir, 'sample-cruise.json'), 'utf8')), i = trip.days.findIndex(d => d.type === 'port' && trip.cities[d.city]);
    Object.assign(trip.days[i], { selected: ['no-such-sight'], mine: ['no-such-sight'], own: true, wantsOnly: false });
    const p = E.planTrip(E.applyPlaces(trip, places))[i], ex = (p.explain || []).join(' ');
    t(/isn't in this place's sights list/.test(ex), `a pick the guide doesn't have is dropped with no word (${ex.slice(0, 160)})`); }
  t(boats >= 3, `only ${boats} chosen boats were planned across the saved trips (the check would see nothing)`);
  return { bad, days, boats, refused };
}
if (require.main === module) {
  const E = require('./engine.cjs'), real = run(E);
  real.bad.slice(0, 30).forEach(m => console.log('FAIL ' + m));
  const PLANTS = [
    ['a picked place reached by road too taken as choosing its boat', '90-timeline.js', 'ownBoat = !!(leg.mine || (leg.isle && isleStop', 'ownBoat = !!(leg.mine || (isleStop'],
    ['a chosen boat with no sailing times refused unless its words say "no sailing times are known" (E65)', '90-timeline.js', 'if (ownBoat && E.boatNoTimes(leg, win.date)) {', 'if (ownBoat && leg.source !== "timetable" || ownBoat && /no sailing times are known/.test(unsure)) {'],
    ['a refused chosen boat told to "pick the boat yourself"', '90-timeline.js', 'ownBoat ? "You chose the boat, but " + unsure + ", so this ride is planned by taxi to be back in time." : ', ''],
    ['the chosen boat back with no taxi fallback', '90-timeline.js', 'const tx = backBoat ? (leg.options || []).find(o => o.kind === "taxi") : null', 'const tx = null'],
    ['a pick the guide lacks dropped in silence', '95-plan.js', 'if (!s) { unknownPicks++; continue; }', 'if (!s) continue;'],
  ];
  let blind = 0;
  for (const [name, file, want, to] of PLANTS) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'own-boat-plant-')); fs.cpSync(SRC, tmp, { recursive: true });
    const fp = path.join(tmp, 'engine', file), s = fs.readFileSync(fp, 'utf8');
    if (!s.includes(want)) { console.log(`FAIL the planted copy "${name}" could not be made: the engine text it changes is gone`); process.exit(1); }
    fs.writeFileSync(fp, s.replace(want, to));
    const out = cp.spawnSync(process.execPath, ['-e', `const E=require(${JSON.stringify(path.join(__dirname, 'engine.cjs'))});const fs=require('fs'),path=require('path'),ROOT=${JSON.stringify(ROOT)};process.stdout.write(JSON.stringify((${run.toString()})(E).bad))`], { env: Object.assign({}, process.env, { ENGINE_SRC: tmp }), maxBuffer: 1 << 26 });
    let planted = null; try { planted = JSON.parse(out.stdout); } catch (e) { console.log('FAIL planted run broke: ' + (out.stderr || '').toString().slice(0, 300)); process.exit(1); }
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`planted (${name}): ${planted.length} finding(s)${planted.length ? '' : ' - BLIND'}`); if (!planted.length) blind++;
  }
  console.log(`own-boat-check: ${real.days} far sights on port days, ${real.boats} chosen boats with no sailing times, ${real.refused} rides with sailings that miss; ${real.bad.length ? real.bad.length + ' failed' : 'all passed'}${blind ? ', but ' + blind + ' planted copies went unseen' : `; planted ${PLANTS.length} of ${PLANTS.length} caught`}`);
  process.exit(real.bad.length || blind ? 1 : 0);
}
module.exports = { run };
