// Reasons have their numbers (Nov 23, gap list: "Didn't fit today" said no numbers; Richard, Nov 22: "Lies create mistrust
// of the app", every reason on screen traces to real data). Every saved test trip, each day changed the ways that make
// sights drop (every sight of the place ticked; the day cut to 2 h 30 min; both), planned by the engine. Checks:
//   numbers   every reason a pick was given up (plan.dropWhy) gives its numbers or times: what it needs and what is left,
//             how far past the day's end it would run, its opening hour, how late it would arrive, the lunch it would cost
//   explain   every "didn't fit" line in the day's notes gives its numbers too
//   true      a sight said not to fit on another day is not planned on some other day of the trip (then that day is named)
// No AI, no internet. Usage: node tools/beta2/reason-numbers-check.cjs [--list]
const fs = require('fs'), path = require('path'), E = require('./engine.cjs');
const dir = fs.existsSync(path.join(__dirname, 'snapshots')) && fs.readdirSync(path.join(__dirname, 'snapshots')).some(f => f.endsWith('.json')) ? path.join(__dirname, 'snapshots') : path.join(__dirname, 'corpus');
const list = process.argv.includes('--list'), fails = { numbers: [], explain: [], true: [] }; let reasons = 0, days = 0;
const NUM = /\d/;
const WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  const base = JSON.parse(fs.readFileSync(path.join(dir, f)));
  if (!Array.isArray(base.days)) continue;
  const variants = [];
  base.days.forEach((d, i) => { if (!d || d.type === 'sea' || d.noShore || !d.city || !base.cities[d.city]) return;
    const all = (base.cities[d.city].sites || []).filter(s => !s.quick).map(s => s.id);
    variants.push([i, 'every sight ticked', x => Object.assign(x, { selected: all.slice(), mine: all.slice(), own: true, wantsOnly: false })]);
    if (d.type === 'land' || d.type === 'arrival') {
      variants.push([i, '2.5 h', x => Object.assign(x, { hours: 2.5 })]);
      variants.push([i, 'every sight ticked, 2.5 h', x => Object.assign(x, { hours: 2.5, selected: all.slice(), mine: all.slice(), own: true, wantsOnly: false })]); } });
  for (const [i, label, change] of variants) {
    const b = JSON.parse(JSON.stringify(base)); change(b.days[i]); let ps;
    try { ps = E.planTrip(b); } catch (e) { fails.numbers.push(`${f} day ${i} (${label}): planner error ${e.message}`); continue; }
    days++; const p = ps[i]; if (!p || !p.items) continue;
    const at = id => ps.findIndex(o => o && o.items && o.items.some(x => x.t === 'stop' && (String(x.id) === String(id) || (x.includesIds || []).map(String).includes(String(id)))));
    for (const [id, w] of Object.entries(p.dropWhy || {})) { reasons++; if (!NUM.test(w)) fails.numbers.push(`${f} day ${i} (${label}): ${id} "${w}"`); }
    for (const t of p.explain || []) {
      if (/(didn't fit|doesn't fit|no longer fits|won't fit|can't fit)/i.test(t) && !NUM.test(t)) fails.explain.push(`${f} day ${i} (${label}): "${t}"`);
      const m = /^(.+?) is closed on \w+, and it didn't fit on (\w+)/.exec(t); if (!m) continue;
      const s = (b.cities[b.days[i].city].sites || []).concat(b.cities[b.days[i].city].farther || []).find(x => x.name === m[1]), j = s ? at(s.id) : -1;
      if (j >= 0) { const wd = WEEK[new Date(Date.parse(b.days[j].date + 'T12:00:00Z')).getUTCDay()]; fails.true.push(`${f} day ${i} (${label}): "${t}" but it is planned on ${wd} (day ${j})`); }
    }
  }
}
const n = Object.values(fails).reduce((a, l) => a + l.length, 0);
for (const [k, l] of Object.entries(fails)) { console.log(`${String(l.length).padStart(4)}  ${k}`); (list ? l : l.slice(0, 5)).forEach(x => console.log('        ' + x.slice(0, 260))); }
console.log(`reason-numbers-check: ${days} days planned, ${reasons} reasons a pick was given up, ${n} failures`);
process.exit(n ? 1 : 0);
