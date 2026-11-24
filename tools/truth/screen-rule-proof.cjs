// Every screen rule is proven to fire (rules registry, docs/qa/RULES.md; Richard, Nov 23: "there needs to be rules for
// every error found"). A rule that never fires protects nothing, and a rule nobody has seen fail can be broken by a later
// edit without anyone noticing. For EVERY rule in src/features/screen-rules.js this plants the bug the rule is about into a
// real day plan as the phone shows it (tools/truth/screen-fixtures.json: Naples port day, Barcelona arrival, Barcelona
// leaving by train, saved from the sample trip) and checks:
//   - the clean page does not trip the rule (no false alarm on a good day);
//   - the planted page does trip it.
// A rule with no planted proof here fails the check, so a new screen rule can't be added without one.
// Usage: node tools/truth/screen-rule-proof.cjs   (exit 1 on any failure)
'use strict';
const fs = require('fs'), path = require('path');
const R = require('../beta2/screen-rules.cjs');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'features', 'screen-rules.js'), 'utf8');
const FX = require('./screen-fixtures.json');
const rep = (a, b) => t => { if (!t.includes(a)) throw new Error(`fixture no longer has "${a.slice(0, 40)}"`); return t.replace(a, b); };
const add = s => t => t + '\n' + s;
// rule -> [fixture, plant(text), info override]
const P = {
  'leave-by shown': ['naples', rep('\nLEAVE BY\n', '\nLEAVING\n')],
  'leave-by after a stop': ['naples', rep('\nestimate\n5:18 pm\n', '\nestimate\n1:00 pm\n')],
  'ride back fits': ['naples', rep('Back at the ship by 5:45 pm', 'Back at the ship by 4:00 pm')],
  'back by': ['naples', rep('Back at the ship by 5:45 pm', 'Back at the ship by 4:00 pm')],
  'spare before all aboard': ['naples', rep('Official all aboard 6:30 pm', 'Official all aboard 6:00 pm')],
  'ashore first': ['naples', rep('Ashore 7:30 am', 'Ashore 9:30 am')],
  'checked ride back': ['naples', t => { const i = t.lastIndexOf('\nE\n'), k = t.lastIndexOf(' min · ', i), s = t.lastIndexOf('\n', k); return t.slice(0, s + 1) + 'Taxi or car, about 25 min' + t.slice(t.indexOf(' · ', s)); }],
  'leave-by reaches the bags': ['leave', rep('so leave by 11:10 am', 'so leave by 11:30 am')],
  'small-hours departure asked': ['leave', t => t, { time: '00:20', mode: 'train' }],
  'free time after the first steps': ['arrive', t => rep('\nH\nCheck in or drop bags', '\nH\nHotel')(t).replace('Back at Hotel near Plaça de Catalunya', 'Check in or drop bags')],
  'leave-by is not the back-by': ['naples', add('The day fits, with travel, meals and lines allowed for: 2 h 45 min of free time, then leave by 10:45 pm to be back by 10:45 pm.')],
  'tender both ways': ['naples', rep('\nS\nOff the ship at ', '\nS\nTender ashore to ')],
  'one time to head back': ['naples', add('From the cruise port: Rome is about 1 hour 15 minutes by train. Leave Rome by mid-afternoon.')],
  'terminals asked as terminals': ['leave', add('Which airport do you leave from? There is more than one here (Big City Airport, Terminal 1 or Big City Airport, Terminal 2). Choose yours')],
  'free time fits its clock': ['arrive', t => { const m = /\nUNTIL\n(\d{1,2}:\d\d [ap]m)\n\+\nFree time: /.exec(t); if (!m) throw new Error('fixture has no free time'); return t.replace(/\nFree time: [^\n]*/, '\nFree time: 9 h 59 min'); }],
  'times go forward': ['naples', rep('ARRIVE\n9:58 am', 'ARRIVE\n8:00 am')],
  'ride time matches the clock': ['naples', rep('ARRIVE\n12:14 pm', 'ARRIVE\n12:05 pm')],
  'ride of no time': ['naples', rep('Walk · 16 min · 0.7 mi', 'Walk · 0 min · 0.7 mi')],
  'walk time matches its distance': ['naples', rep('Walk · 16 min · 0.7 mi', 'Walk · 16 min · 5.0 mi')],
  'visit length matches the clock': ['naples', rep('30 min · Sight', '2 h · Sight')],
  'lunch has a real place': ['naples', rep('Lunch: Sorbillo', 'Lunch near Naples')],
  'lunch is a meal': ['naples', rep('Lunch: Sorbillo\nPizza · € · Local spot · 1 h', 'Lunch: Gran Caffè Coffee\nCafé · € · 1 h')],
  'lunch at a lunch hour': ['naples', rep('ARRIVE\n12:56 pm', 'ARRIVE\n2:45 pm')],
  'leave + ride = arrive at lunch': ['naples', rep('ARRIVE\n12:56 pm', 'ARRIVE\n1:10 pm')],
  'no idle wait before a meal': ['naples', rep('Lunch: Sorbillo\n', 'Lunch: Sorbillo\n45 min to spare before lunch at 1:41 pm\n')],
  'dinner at a dinner hour': ['arrive', rep('FROM\n6:30 pm', 'FROM\n11:43 pm')],
  'lunch on a day out': ['naples', rep('\nL\nLunch: Sorbillo', '\n4\nSorbillo')],
  'bags stored for something': ['arrive', t => rep('\nH\nCheck in or drop bags', '\nH\nLeave your bags in luggage storage')(t).replace('\n1\nLa Rambla & La Boqueria market', '\nH\nCollect your bags')],
  'points are places': ['naples', rep('The opera house and the Galleria 9:27 am\n', 'The opera house and the Galleria 9:27 am\nClosing 9:33 am\n')],
  'a place once': ['naples', rep('The opera house and the Galleria 9:27 am\n', 'The opera house and the Galleria 9:27 am\nCertosa e Museo di San Martino 9:33 am\n')],
  'sight once': ['naples', rep('Santa Maria del Carmine Maggiore\n30 min', 'Certosa e Museo di San Martino\n30 min')],
  'no broken values': ['naples', add('Walk · NaN min')],
  'date on the day': ['naples', t => t, { date: '2027-07-13' }],
  'never slower than walking': ['naples', rep('Walk · 39 min', 'Walk · 12 min')],
  'right words for the day': ['leave', t => rep('to your train', 'to your flight')(t) + '\nBe back at the ship in good time.'],
  'one leave-by': ['leave', rep('Leave Park Güell by 11:10 am', 'Leave Park Güell by 10:00 am')],
  'one real reason': ['naples', add('Sorrento (closed, or no longer fits the time safely)')],
  'reason has its numbers': ['naples', add("Rialto Bridge didn't fit in the time.")],
  'reason adds up': ['naples', add('Capri needs about 1 h but only 2 h is left.')],
  'missing data said as missing': ['naples', add('Runs about every 30 min.\nNo departure near 3:20 pm; the next is about 5:20 pm.')],
  'no empty names': ['naples', add('Opening hours not confirmed for , , , .')],
  'visit parts spread over the visit': ['naples', t => t.replace('The Royal Palace 9:13 am', 'The Royal Palace 9:01 am').replace('The opera house and the Galleria 9:27 am', 'The opera house and the Galleria 9:02 am').replace('Closing 9:33 am', 'Closing 9:03 am')],
  'English letters': ['naples', rep('Santa Maria del Carmine Maggiore\n30 min', 'Σάντα Μαρία\n30 min')],
  'no absurd ride choice': ['naples', rep('Walk · 39 min', 'Bus · 10 h 49 min')],
  'never planned while closed': ['naples', rep('Open 9:00 am–8:00 pm travel guide', 'Closed on Mondays')],
  'unknown hours said with the planned window': ['naples', rep('Hours not confirmed: planned as if open 9:00 am–5:00 pm. Check before you go', 'Hours not confirmed. Check before you go')],
  'visit ends by closing': ['naples', rep('Open 8:30 am–1:30 pm, 4:30 pm–7:30 pm', 'Open 8:30 am–12:30 pm')],
  'arrive by last entry': ['naples', rep('Open 9:00 am–7:00 pm, last entry 6:30 pm', 'Open 9:00 am–7:00 pm, last entry 2:00 pm')],
};
const all = [...new Set([...SRC.matchAll(/add\('S\d', '([^']+)'/g)].map(m => m[1]))];
let bad = 0, ok = 0;
for (const rule of all) {
  const p = P[rule];
  if (!p) { bad++; console.log(`NOT PROVEN  ${rule}: no planted bug in tools/truth/screen-rule-proof.cjs`); continue; }
  const fx = FX[p[0]], info = Object.assign({ type: fx.type, date: fx.date }, p[2] || {});
  const fires = (txt, inf) => R.rules(txt, inf).filter(x => x.rule === rule);
  const clean = fires(fx.text, { type: fx.type, date: fx.date });
  if (clean.length) { bad++; console.log(`FALSE ALARM ${rule}: fires on the clean ${p[0]} page: ${clean[0].msg}`); continue; }
  let txt; try { txt = p[1](fx.text); } catch (e) { bad++; console.log(`BROKEN      ${rule}: ${e.message}`); continue; }
  const hit = fires(txt, info);
  if (!hit.length) { bad++; console.log(`MISSED      ${rule}: the planted bug went through`); continue; }
  ok++; if (process.env.VERBOSE) console.log(`caught      ${rule}: ${hit[0].msg}`);
}
for (const k of Object.keys(P)) if (!all.includes(k)) { bad++; console.log(`STALE       ${k}: no such rule in screen-rules.js`); }
console.log(`Screen-rule proof: ${ok} of ${all.length} screen rules caught their planted bug, ${bad} failed`);
process.exitCode = bad ? 1 : 0;
