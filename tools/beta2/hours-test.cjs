// Beta 2 opening hours and holidays: the one hours reader, the hours checked against official websites, the public
// holiday data and the calendar rules (Sabbath, prayer times, Sunday services), and every saved trip planned with them.
// Pure Node, no browser, no internet, no AI. Usage: node tools/beta2/hours-test.cjs
const E = require('./engine.cjs'), fs = require('fs'), path = require('path');
let fails = 0, oks = 0; const ok = (c, msg) => { if (c) oks++; else { fails++; console.log('FAIL ' + msg); } };
const C = E.clock, sp = r => r && r.known ? (r.closed ? 'closed' : r.spans.map(([a, b]) => C(a) + '-' + C(b)).join(',')) : 'unknown';

// ---- The reader: the map's opening_hours syntax ----
const osm = [
  ['Mo-Fr 09:00-17:00, Sa 10:00-14:00', '2026-11-28', '10:00 am-2:00 pm'],
  ['Mo-Fr 09:00-17:00; Sa,Su,PH off "building hours approximate"', '2026-11-22', 'closed'],
  ['Mo-Fr 09:00-17:00; Sa,Su,PH off "building hours approximate"', '2026-11-23', '9:00 am-5:00 pm'],
  ['off "temporarily closed since 2026-09-01; reopening"', '2026-11-23', 'closed'],
  ['Mo-Su 09:00-17:00; 2026 Dec 20-2027 Jan 05 off', '2027-01-02', 'closed'],
  ['Mo-Su 09:00-17:00; 2026 Dec 20-2027 Jan 05 off', '2027-01-06', '9:00 am-5:00 pm'],
  ['Apr-Oct: Mo-Su 08:00-20:00; Nov-Mar: Mo-Su 08:00-17:00', '2027-07-07', '8:00 am-8:00 pm'],
  ['Apr-Oct: Mo-Su 08:00-20:00; Nov-Mar: Mo-Su 08:00-17:00', '2027-01-07', '8:00 am-5:00 pm'],
  ['Apr 01-Oct 31 09:00-18:00; Nov 01-Mar 31 09:00-16:00', '2027-04-07', '9:00 am-6:00 pm'],
  ['Tu-Su 10:00-18:00; Mo off', '2027-07-05', 'closed'],
  ['Mo-Su 09:00-18:00; Su[-1] off', '2027-07-25', 'closed'],
  ['Mo-Su 09:00-18:00; Su[-1] off', '2027-07-18', '9:00 am-6:00 pm'],
  ['Mo-Su 09:00-18:00; We 12:00-13:00 off', '2027-07-07', '9:00 am-12:00 pm,1:00 pm-6:00 pm'],
  ['Fr 20:00-02:00', '2027-07-10', '12:00 am-2:00 am'],
  ['Mo-Su 10:00-17:00; easter off', '2027-03-28', 'closed'],
  ['Mo-Su 10:00-17:00 || "by appointment"', '2027-07-07', '10:00 am-5:00 pm'],
  ['Mo-Fr 10:00-17:00 "by appointment"', '2027-07-07', 'unknown'],
  ['unknown "hours vary with the ship schedule"', '2027-07-07', 'unknown'],
  ['24/7', '2027-07-07', '12:00 am-12:00 am'],
  // Nov 23 release gate: two spans or two rules written with only a space between them.
  ['Mo-Su 12:30-15:00 19:00-22:00', '2027-06-30', '12:30 pm-3:00 pm,7:00 pm-10:00 pm'],
  ['Tu-Sa 12:00-15:00 Tu-Sa 18:00-22:00', '2027-06-30', '12:00 pm-3:00 pm,6:00 pm-10:00 pm'],
  ['Th-Mo 13:15-15:30, 20:30-23:00; Tu off, We off', '2027-07-03', '1:15 pm-3:30 pm,8:30 pm-11:00 pm'],
  ['Th-Mo 13:15-15:30, 20:30-23:00; Tu off, We off', '2027-06-30', 'closed'],
];
for (const [h, iso, want] of osm) { const got = sp(E.readOsm(h, iso, { holiday: false })); ok(got === want, `map hours "${h}" on ${iso}: ${want} (got ${got})`); }
// A public holiday the date's status isn't known for: read both ways, unknown when they differ.
ok(!E.readOsm('Mo-Su 09:00-17:00; PH off', '2027-07-07', {}).known && E.readOsm('Mo-Su 09:00-17:00; PH off', '2027-07-07', { holiday: false }).known, 'PH with the holiday unknown is not confirmed; with it known, read');
ok(E.readOsm('Mo-Su 09:00-17:00; PH off', '2027-07-07', { holiday: true }).closed, 'PH off on a holiday: closed');
// Sunset times from the sun at the place (Athens, July): about 8:50 pm.
{ const r = E.readOsm('Mo-Su 09:30-sunset', '2027-07-07', { holiday: false, lat: 37.65, lng: 24.02, offset: 180 }); ok(r.known && r.spans[0][1] > 20 * 60 + 35 && r.spans[0][1] < 20 * 60 + 59, `sunset closing at Sounion in July (got ${sp(r)})`);
  ok(!E.readOsm('Mo-Su 09:30-sunset', '2027-07-07', { holiday: false }).known, 'sunset hours with the place\'s clock unknown are not confirmed'); }

// ---- The reader: hours in words (guides, the map's free text) ----
const words = [
  [{ hours: '9:00–19:00', closed: '25 Dec, 1 Jan' }, '2027-12-25', 'closed'],
  [{ hours: '9:00–19:00', closed: 'Mondays' }, '2027-07-19', 'closed'],
  [{ hours: '9:00–19:00', closed: 'Mondays' }, '2027-07-20', '9:00 am-7:00 pm'],
  [{ hours: 'Tue–Sun 10am–6pm' }, '2027-07-19', 'closed'],
  [{ hours: 'Tue–Sun 10am–6pm' }, '2027-07-20', '10:00 am-6:00 pm'],
  [{ hours: 'Daily 9am-5pm (summer until 7pm)' }, '2027-07-20', '9:00 am-7:00 pm'],
  [{ hours: 'Daily 9am-5pm (summer until 7pm)' }, '2027-01-19', '9:00 am-5:00 pm'],
  [{ hours: 'Mon-Thu 11:30-24:00' }, '2027-07-19', '11:30 am-12:00 am'],
  [{ hours: 'Open by appointment' }, '2027-07-19', 'unknown'],
  [{ hours: '24/7' }, '2027-07-19', 'unknown'],
];
for (const [s, iso, want] of words) { const got = sp(E.readPlaceHours(s, iso, { holiday: false })); ok(got === want || (want === 'unknown' && got === 'unknown'), `written hours ${JSON.stringify(s)} on ${iso}: ${want} (got ${got})`); }

// ---- Hours checked against official websites ----
const L = E.CHECKED_HOURS || [];
ok(L.length >= 150, `the checked list ships with the app (${L.length} places)`);
{ const odd = []; for (const c of L) for (const iso of ['2027-01-12', '2027-04-14', '2027-07-07', '2027-10-13']) { try { const r = E.readCheckedHours(c, iso, { holiday: false, offset: 0 }); if (!r.known && r.syntax) odd.push(c.city + ': ' + c.name); } catch (e) { odd.push(c.name + ' threw ' + e.message); } }
  const uniq = [...new Set(odd)]; ok(uniq.length <= 3, `checked hours read in the app's syntax (${uniq.length} not: ${uniq.join('; ')})`); }
// The same sight in a trip (other names, other spelling) takes its checked hours; a sight next door never does.
const at = (name, lat, lng, city) => E.checkedHoursFor({ name, lat, lng }, city);
ok((at('Acropolis and Parthenon', 37.9715, 23.7257, 'Athens') || {}).name === 'Acropolis', 'the Acropolis under another name takes its checked hours');
ok((at('Acropolis Museum', 37.9684, 23.7285, 'Athens') || {}).name === 'Acropolis Museum', 'the Acropolis Museum takes its own hours, not the Acropolis\'s');
ok(!at('National Museum in Prague', 50.0798, 14.4304, 'Prague'), 'a different museum in the same town never takes another\'s hours');
ok((at('Sultan Ahmed Mosque', 41.0054, 28.9768, 'Istanbul, Turkey') || {}).name === 'Blue Mosque', 'another name for the same mosque matches');
ok(!at('Blue Mosque', 40.0, -3.0, 'Somewhere else'), 'the same name in another town does not match');
ok((at('Dome of the Rock', null, null, 'Jerusalem (from Haifa , Israel)') || {}).name === 'Temple Mount / Haram esh-Sharif', 'the Dome of the Rock is visited on the Temple Mount\'s hours');
// Answers from the official sites, on the trips' own dates.
const chk = (name, city, iso, want, ctx) => { const c = at(name, null, null, city); const r = c ? E.readCheckedHours(c, iso, Object.assign({ holiday: false }, ctx)) : null; const got = sp(r); ok(got === want, `${name} on ${iso}: ${want} (got ${got}${r && r.src ? ', ' + r.src : ''})`); return r; };
{ const r = chk('Acropolis', 'Athens', '2027-07-07', '8:00 am-8:00 pm'); ok(r && r.last === 19 * 60 + 40 && /official website, checked Nov 2026/.test(r.src), 'the Acropolis\'s last entry is 20 minutes before closing, from its official site'); }
chk('Acropolis', 'Athens', '2027-05-02', 'closed'); // Orthodox Easter Sunday 2027
chk('Acropolis', 'Athens', '2027-01-12', '8:00 am-5:00 pm');
chk('Temple Mount', 'Jerusalem', '2027-07-10', 'closed'); // Saturday
chk('Temple Mount', 'Jerusalem', '2027-07-11', '7:30 am-11:00 am,1:30 pm-2:30 pm');
chk('Jewish Museum', 'Prague', '2027-07-10', 'closed'); // Saturday
{ const c = L.find(c => c.checked); const r = E.readCheckedHours(c, '2028-02-01', { holiday: false }); ok(!r.known && r.stale && /more than a year/.test(r.why), 'checked hours older than a year are not confirmed, and say why'); }
{ const newest = L.map(c => c.checked).sort().pop(), age = (Date.now() - Date.parse(newest)) / 864e5; ok(age < 330, `the checked hours are rechecked within 11 months (newest check ${newest}, ${Math.round(age)} days ago)`); }

// ---- Public holidays ----
const yNow = new Date().getUTCFullYear();
ok(E.HOLIDAYS_YEARS && E.HOLIDAYS_YEARS[1] >= new Date(Date.now() + 456 * 864e5).getUTCFullYear(), `holiday data covers the next 15 months (data ${E.HOLIDAYS_YEARS}, now ${yNow}): re-run tools/places/holidays.cjs`);
ok(Object.keys(E.HOLIDAYS || {}).length > 190, 'every country has its holidays');
ok(E.holidayOn({ cc: 'GR' }, '2030-01-01') === undefined, 'a date outside the data is unknown, never "no holiday"');
// Every date on the official calendars checked by hand (tools/beta2/holidays-official.json, Nov 22 2026). Known gaps:
// Israel's memorial and fast days are not rest days (sights open), so they are not holidays here.
{ const O = JSON.parse(fs.readFileSync(path.join(__dirname, 'holidays-official.json'))), SKIP = /Yom HaShoah|Yom HaZikaron|Tisha B'Av/; let n = 0; const miss = [];
  for (const [k, l] of Object.entries(O)) { if (!Array.isArray(l)) continue; const [cc, rc] = k.split('-');
    for (const h of l) { if (!/^\d{4}-\d\d-\d\d$/.test(h.date) || SKIP.test(h.name)) continue; n++; const r = E.holidayOn({ cc, region: rc || null }, h.date); if (!(r && (r.name || r.eveOf))) miss.push(k + ' ' + h.date + ' ' + h.name); } }
  ok(n > 200 && !miss.length, `every official holiday is in the data (${n} dates, missing: ${miss.join('; ') || 'none'})`); }
ok((E.holidayOn(E.countryOf(['Nassau, Bahamas']), '2027-01-11') || {}).name, 'Jan 11 2027 is a Bahamas holiday (Majority Rule Day, observed)');
ok((E.holidayOn(E.countryOf(['Ponta Delgada, Azores']), '2027-05-17') || {}).name, 'the Azores keep their own day');
ok(!(E.holidayOn(E.countryOf(['Barcelona, Spain', 'Catalonia']), '2027-03-25') || {}).name, 'Maundy Thursday is not a holiday in Catalonia');
ok((E.holidayOn({ cc: 'TR' }, '2027-10-28') || {}).from === 13 * 60, 'Turkey\'s half days start at 1 pm');
ok((E.countryOf(['Edinburgh, Scotland']) || {}).region === 'SCT' && !(E.holidayOn(E.countryOf(['Edinburgh, Scotland']), '2027-03-29') || {}).name, 'Scotland has no Easter Monday holiday');

// ---- Calendar rules ----
{ const r = E.applyDayRules({ name: 'Old New Synagogue', category: 'synagogue' }, { known: false }, '2027-07-10', {}); ok(r.closed && /Sabbath/.test(r.why), 'a synagogue with no hours of its own is closed on Saturday, and says why'); }
{ const p = E.prayerTimes(41.0054, 28.9768, '2027-07-09', 180); ok(p && Math.abs(p.dhuhr - (13 * 60 + 13)) < 10, `Istanbul midday prayer from the sun (${p && C(p.dhuhr)})`);
  const r = E.applyDayRules({ name: 'Blue Mosque', category: 'mosque', lat: 41.0054, lng: 28.9768 }, { known: true, spans: [[8 * 60 + 30, 19 * 60]] }, '2027-07-09', { offset: 180 });
  ok(r.spans.length >= 3 && !r.spans.some(([a, b]) => a < p.dhuhr && b > p.dhuhr), 'a mosque is closed to visitors through Friday prayers'); }
ok(!E.isMosque({ name: 'Mosque of Cristo de la Luz', content: 'built as a small mosque, but 200 years later was converted to a church' }) && !E.isMosque({ name: 'Mezquita', content: 'the mosque became a cathedral' }) && E.isMosque({ name: 'Sultan Ahmed Mosque' }),
  'a mosque now a church or museum is not planned around prayer times (Toledo, Nov 23)');
{ const r = E.applyDayRules({ name: 'St. Mary\'s Church', category: 'church' }, { known: false }, '2027-07-11', {}); ok(r.sundayAfternoon && /Sunday services/.test(r.notes.join(' ')), 'a church with no Sunday hours is planned for the afternoon, and says so'); }
{ const r = E.applyDayRules({ name: 'Museum', category: 'museum' }, { known: true, spans: [[600, 1080]] }, '2027-12-25', { holiday: { name: 'Christmas Day' } }); ok(r.holidayUnsure && /not confirmed/.test(r.notes.join(' ')), 'on Christmas Day a museum\'s usual hours are not confirmed, and the plan says so'); }
{ const r = E.applyDayRules({ name: 'Museum', category: 'museum' }, { known: true, spans: [[600, 1080]], phSaid: true }, '2027-12-25', { holiday: { name: 'Christmas Day' } }); ok(!r.holidayUnsure, 'hours that say what happens on holidays decide the holiday'); }
{ const r = E.applyDayRules({ name: 'Museum', category: 'museum' }, { known: true, spans: [[600, 1080]] }, '2027-10-28', { holiday: { name: null, eveOf: 'Republic Day', from: 780 } }); ok(/eve of Republic Day: may close early from about 1:00 pm/.test((r.notes || []).join(' ')), 'a half day says when places may close early'); }

// ---- Every saved trip, planned: never at a closed sight, within its hours, by its last entry, and said ----
{ const dir = path.join(__dirname, 'snapshots'); let stops = 0, known = 0, closed = 0, outside = 0, late = 0, unsaid = 0; const bad = [];
  if (!fs.existsSync(dir)) console.log('NOT RUN here: no saved trips (node tools/beta2/snapshot.cjs)'); else
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const s = JSON.parse(fs.readFileSync(path.join(dir, f)));
    E.planTrip(s).forEach((p, i) => { if (!p || !p.items || p.safe) return; const d = s.days[i];
      for (const x of p.items.filter(x => x.t === 'stop')) { stops++; const sd = (d.sites || {})[x.id] || {}, h = x.hours || {};
        if (sd.closed && !d.order) { closed++; bad.push(`${f} day ${i}: ${x.name} planned on a day it is closed`); continue; }
        const spans = sd.oh && sd.oh.spans && sd.oh.spans.length ? sd.oh.spans : null; if (!spans) { if (h.need && !h.unknown && !h.allDay && !sd.allDay) { unsaid++; bad.push(`${f} day ${i}: ${x.name} needs hours, has none, and isn't marked`); } continue; }
        known++; if (d.order) continue;
        if (!spans.some(([a, b]) => x.at >= a && x.at + x.min <= b + 1)) { outside++; bad.push(`${f} day ${i}: ${x.name} at ${C(x.at)} for ${x.min} min, open ${spans.map(([a, b]) => C(a) + '-' + C(b)).join(',')}`); }
        if (sd.oh.last != null && x.at > sd.oh.last) { late++; bad.push(`${f} day ${i}: ${x.name} arrives ${C(x.at)}, last entry ${C(sd.oh.last)}`); } } }); }
  bad.slice(0, 8).forEach(b => console.log('  ' + b));
  ok(stops > 100 && known > 20 && !closed && !outside && !late && !unsaid, `saved trips: ${stops} stops, ${known} with hours; ${closed} closed, ${outside} outside hours, ${late} after last entry, ${unsaid} unknown and unsaid`); }

// "Closed on Tuesday, so it's planned on Monday" is said only when Monday really has it (Nov 22, Vienna).
{ const dir = path.join(__dirname, 'snapshots'), PD = path.join(__dirname, '..', 'places', 'data'), places = {}; let n = 0; const wrong = [];
  if (fs.existsSync(PD)) for (const g of fs.readdirSync(PD).filter(g => g.endsWith('.json'))) { const q = JSON.parse(fs.readFileSync(path.join(PD, g))); places[q.key] = q; }
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { const s = E.applyPlaces(JSON.parse(fs.readFileSync(path.join(dir, f))), places), ps = E.planTrip(s);
    ps.forEach((p, i) => (p && p.explain || []).forEach(t => { const m = /^(.+) is (?:closed on \w+|inside .+), so it's planned (?:with it )?on (\w+)\.$/.exec(t); if (!m) return; n++;
      const k = ps.findIndex((q, j) => j !== i && q && q.items && s.days[j].city === s.days[i].city && new Date(s.days[j].date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) === m[2]);
      const q = ps[k]; if (!q || !q.items.some(x => x.t === 'stop' && (x.name === m[1] || (x.includes || []).includes(m[1])))) wrong.push(`${f} day ${i}: "${t}"`); })); }
  ok(!wrong.length, `a move to another day is said only when that day has it (${n} said, wrong: ${wrong.slice(0, 3).join('; ') || 'none'})`); }

// Class rule "no meal while the place is shut" on the screen (Nov 23): a lunch card shows the place's hours when known, and
// the screen rules hold the lunch's start to them (waiting outside before it opens is fine).
{ const R = require('./screen-rules.cjs');
  const card = (arr, lv, extra) => ['ARRIVE', arr, 'LEAVE', lv, 'L', 'Lunch: Komokieras'].concat(extra || [], ['Open 1:15 pm–3:30 pm, 8:30 pm–11:00 pm', '1 h']).join('\n'); // the card's lines as the app shows them
  const shut = t => R.rules(t, { type: '', date: '' }).some(f => f.rule === 'never planned while closed');
  ok(shut(card('11:45 am', '12:45 pm')), 'screen: lunch at 11:45 at a place whose card says it opens 1:15 pm is caught');
  ok(!shut(card('1:15 pm', '2:15 pm')), 'screen: lunch at opening time passes');
  ok(!shut(card('1:05 pm', '2:15 pm', ['10 min to spare before lunch at 1:15 pm'])), 'screen: arriving early and waiting for opening passes'); }

console.log(`\n${oks} checks passed, ${fails} failed`); process.exit(fails ? 1 : 0);
