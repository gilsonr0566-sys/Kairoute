// Builds src/engine/19-holidays.js: every country's public holidays (and its regions' own) for the years the app plans,
// from the open "date-holidays" rule set (MIT; https://github.com/commenthol/date-holidays), worked out here once and
// shipped as plain data: the app never fetches holidays, works offline, and plans the same on every phone.
// Usage: npm i --no-save date-holidays@3 && node tools/places/holidays.cjs [firstYear] [lastYear]
// Re-run each year (tools/beta2/hours-test.cjs fails when the data ends within 15 months of today).
// Each date is "YYMMDD Name", with a flag before the name when it matters for planning:
//   ~  a date set by the moon (Islamic holidays): it may move by a day once the moon is seen;
//   ^HH  the eve of a holiday that starts at that hour (Jewish holidays start at sunset the day before).
const H = require('date-holidays'), fs = require('fs'), path = require('path');
const Y0 = +(process.argv[2] || 2026), Y1 = +(process.argv[3] || 2028);
const MOON = /ramadan|eid|islamic|hijri|muharram|ashura|mawlid|prophet|miraj|mi'raj|isra|arafat|sacrifice|bayram|laylat|al-adha|al-fitr/i;
const pad = n => String(n).padStart(2, '0');
const ymd = (d, tz) => { const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(d), g = t => p.find(x => x.type === t).value; return { d: g('year').slice(2) + g('month') + g('day'), h: +g('hour') % 24 }; };
function list(hd) {
  const tz = (hd.getTimezones() || [])[0] || 'UTC', m = new Map();
  for (let y = Y0; y <= Y1; y++) for (const x of hd.getHolidays(y, 'en')) {
    if (!['public', 'bank'].includes(x.type)) continue;
    const name = String(x.name).replace(/[|]/g, '/'), moon = MOON.test(name) ? '~' : '';
    // Every local date the holiday covers; a start in the afternoon or evening makes that date the eve, not the day.
    const a = ymd(x.start, tz); let t = new Date(x.start.getTime());
    if (a.h >= 12) { m.set(a.d + '^' + pad(a.h), (m.get(a.d + '^' + pad(a.h)) || []).concat(name)); t = new Date(t.getTime() + (24 - a.h) * 3600e3); }
    for (; t < x.end; t = new Date(t.getTime() + 24 * 3600e3)) { const b = ymd(t, tz); if (x.end.getTime() - t.getTime() <= 12 * 3600e3) break; m.set(b.d + moon, (m.get(b.d + moon) || []).concat(name)); }
  }
  // One line per date: the day itself wins over an eve on the same date.
  const out = new Map();
  for (const [k, names] of [...m.entries()].sort()) { const d = k.slice(0, 6), flag = k.slice(6); if (out.has(d) && !out.get(d).startsWith('^')) continue; out.set(d, (flag ? flag + ' ' : '') + [...new Set(names)].join(' / ')); }
  return out;
}
const all = {}, C = new H().getCountries('en'), EN = new Intl.DisplayNames(['en'], { type: 'region' });
for (const cc of Object.keys(C).sort()) {
  const hd = new H(cc, { languages: ['en'] }), nat = list(hd), e = { name: (() => { try { return EN.of(cc) || C[cc]; } catch (x) { return C[cc]; } })(), d: [...nat].map(([d, n]) => d + ' ' + n) };
  const st = hd.getStates(cc, 'en') || {}, r = {};
  // A region lists only how it differs: its own dates (d), and the country's dates it doesn't keep (x: Scotland has no
  // Easter Monday holiday).
  for (const s of Object.keys(st)) { const rl = list(new H(cc, s, { languages: ['en'] })), own = [...rl].filter(([d, n]) => nat.get(d) !== n), x = [...nat.keys()].filter(d => !rl.has(d));
    if (own.length || x.length) r[s] = Object.assign({ name: st[s], d: own.map(([d, n]) => d + ' ' + n) }, x.length ? { x } : {}); }
  if (Object.keys(r).length) e.r = r; all[cc] = e;
}
// Holidays checked against official sources that the open rules miss (tools/places/holidays-checked.json): added,
// never replacing a date the rules already have.
const CHK = JSON.parse(fs.readFileSync(path.join(__dirname, 'holidays-checked.json'), 'utf8')).add, yy = d => d.slice(2, 4) + d.slice(5, 7) + d.slice(8, 10);
for (const [key, c] of Object.entries(CHK)) {
  const [cc, rc] = key.split('-'), e = all[cc]; if (!e) throw new Error('no country ' + cc);
  const lines = c.d.filter(l => +l.slice(0, 4) >= Y0 && +l.slice(0, 4) <= Y1).map(l => yy(l) + l.slice(10));
  const add = (list, l) => { if (!list.some(x => x.slice(0, 6) === l.slice(0, 6) && x[7] !== '^')) { const i = list.findIndex(x => x.slice(0, 6) === l.slice(0, 6)); if (i >= 0) list.splice(i, 1); list.push(l); list.sort(); } };
  if (rc) { e.r = e.r || {}; const r = e.r[rc] = e.r[rc] || { name: c.name || rc, d: [] }; lines.forEach(l => add(r.d, l)); }
  else lines.forEach(l => add(e.d, l));
  for (const [r0, ds] of Object.entries(c.notIn || {})) { e.r = e.r || {}; const r = e.r[r0] = e.r[r0] || { name: r0, d: [] }; r.x = (r.x || []).concat(ds.map(yy)); }
}
const body = `// Beta 2 engine, part 1b: public holidays, as data (made by tools/places/holidays.cjs from the open date-holidays rules,
// years ${Y0}-${Y1}; do not edit by hand). KEngine.HOLIDAYS[country code] = { name, d: ["YYMMDD [flag] Name"], r: { region: { name, d, x: [dates not kept] } } }.
(function (E) { E.HOLIDAYS_YEARS = [${Y0}, ${Y1}]; E.HOLIDAYS = ${JSON.stringify(all)}; })(KEngine);
`;
fs.writeFileSync(path.join(__dirname, '..', '..', 'src', 'engine', '19-holidays.js'), body);
console.log('holidays:', Object.keys(all).length, 'countries,', body.length, 'bytes, years', Y0 + '-' + Y1);
