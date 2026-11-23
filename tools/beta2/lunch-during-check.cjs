// A lunch brought along in a long visit (Nov 23, gap list: "King Ranch late brought lunch"; the lunch audit's last 3
// faults). A long visit over lunchtime with no place to eat known near it had its brought lunch AFTER the visit, at
// 3:30 pm. Now it is eaten in the visit around midday. Every saved test trip, each day re-picked with each farther
// sight alone and with a town sight (the lunch audit's sets), planned with the places files when given. Checks:
//   time     every brought lunch starts between 11:30 am and 2:30 pm when the day is out over lunchtime
//   inside   a lunch marked as eaten during a visit lies inside that visit's time, right after it on the plan
//   once     that visit is one stop on the plan (its two parts are never shown as two stops)
// No AI, no internet. Usage: [PLACES_DIR=tools/places/data] node tools/beta2/lunch-during-check.cjs [--list]
const fs = require('fs'), path = require('path'), E = require('./engine.cjs');
const dir = fs.existsSync(path.join(__dirname, 'snapshots')) && fs.readdirSync(path.join(__dirname, 'snapshots')).some(f => f.endsWith('.json')) ? path.join(__dirname, 'snapshots') : path.join(__dirname, 'corpus');
const PD = process.env.PLACES_DIR, places = {}; if (PD) for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; }
const list = process.argv.includes('--list'), fails = { time: [], inside: [], once: [] }; let packed = 0, during = 0, days = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  const raw = JSON.parse(fs.readFileSync(path.join(dir, f))); if (!Array.isArray(raw.days)) continue;
  const base = PD ? E.applyPlaces(JSON.parse(JSON.stringify(raw)), places) : raw;
  base.days.forEach((d, i) => {
    if (d.noShore || d.type === 'sea') return; const city = base.cities[d.city]; if (!city) return;
    const far = (city.farther || []).filter(s => !s.town && isFinite(s.lat)).slice(0, 5), town = (city.sites || []).filter(s => isFinite(s.lat) && !s.quick).slice(0, 1);
    const sets = far.map(s => [s.id]).concat(town.length ? far.slice(0, 3).map(s => [s.id, town[0].id]) : []);
    for (const pick of sets) {
      const s = Object.assign({}, base, { days: base.days.map((e, j) => j === i ? Object.assign({}, e, { selected: pick.slice(), mine: pick.slice(), own: true, cleared: false }) : e) });
      let p; try { p = E.planTrip(s)[i]; } catch (e) { continue; } if (!p || !p.items) continue; days++;
      const tag = `${f} day ${i} [${pick.join(', ')}]`, st = p.items.filter(x => x.t === 'stop');
      p.items.forEach((x, k) => { if (x.t !== 'meal' || !x.packed || x.meal !== 'Lunch') return; packed++;
        const out = st.length && Math.min(...st.map(y => y.at)) <= 12 * 60 && Math.max(...st.map(y => y.at + (y.min || 0))) >= 14 * 60 + 30;
        if (out && (x.at < 11 * 60 + 30 || x.at > 14 * 60 + 30)) fails.time.push(`${tag}: brought lunch at ${E.clock(x.at)}`);
        if (x.during == null) return; during++;
        const v = p.items[k - 1];
        if (!v || v.t !== 'stop' || String(v.id) !== String(x.during) || x.at < v.at || x.at + x.min > v.at + v.min) fails.inside.push(`${tag}: lunch at ${E.clock(x.at)} not inside the visit before it (${v ? v.name + ' ' + E.clock(v.at) + ', ' + v.min + ' min' : 'none'})`);
        if (st.filter(y => String(y.id) === String(x.during)).length !== 1) fails.once.push(`${tag}: ${x.during} is ${st.filter(y => String(y.id) === String(x.during)).length} stops`); });
    }
  });
}
const n = Object.values(fails).reduce((a, l) => a + l.length, 0);
for (const [k, l] of Object.entries(fails)) { console.log(`${String(l.length).padStart(4)}  ${k}`); (list ? l : l.slice(0, 5)).forEach(x => console.log('        ' + x)); }
console.log(`lunch-during-check: ${days} days planned, ${packed} brought lunches, ${during} eaten during a visit, ${n} failures`);
process.exit(n ? 1 : 0);
