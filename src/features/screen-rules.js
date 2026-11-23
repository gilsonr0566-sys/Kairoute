// Screen rules (Nov 22 2026, Richard: "what are all the ways the app can fail"): rules that read ONE day plan exactly as
// the traveler sees it (the page's text), never the planner's own numbers. One copy serves three places:
//   - the app itself (src/features/screen-guard.js): a day whose own screen fails a ship, train or flight rule says so
//     at the top of the plan instead of showing times that disagree, on every traveler's device;
//   - the release gate's phone run (tools/beta2/screen-gate.cjs);
//   - the live-site outside test results (tools/beta2/screen-audit.cjs).
// Severity: S1 = could make a traveler miss the ship, train or flight; S2 = wrong or misleading on screen; S3 = untidy.
var KScreenRules = (function () {
const T = s => { const m = String(s || '').trim().match(/^(\d{1,2}):(\d\d)(?:\s*([ap])m)?$/i); if (!m) return null; let h = +m[1]; if (m[3]) h = h % 12 + (m[3].toLowerCase() === 'p' ? 12 : 0); return h * 60 + +m[2]; };
const inTxt = s => { const m = /(\d{1,2}):(\d\d)\s*([ap])m/i.exec(s || ''); return m ? T(m[0]) : null; };
const dur = s => { const m = /^(?:(\d+) h)?\s*(?:(\d+) min)?(?:\s*·|$)/.exec(String(s || '').trim()); if (!m || (!m[1] && !m[2])) return null; return (+m[1] || 0) * 60 + (+m[2] || 0); };
const RIDE = /^((?:Walk|Taxi|Car|Train|Metro|Bus|Boat|Ferry|Tram|Cable|Funicular|Sea bus|Shuttle|Tender|Water|Monorail|Light rail|Coach|Subway|Underground|Rail|Hydrofoil|Catamaran|Gondola|Vaporetto|Lift|Elevator|Bike|Transit|Rideshare|Uber|Tuk)[^·]*?) · (?:(\d+) h ?)?(?:(\d+) min)?(?: · ([\d.]+) (mi|km|ft|m))?$/;
const KEY = /^(S|E|L|H|\d{1,2})$/;
const clock = m => m == null ? '?' : `${Math.floor(m / 60)}:${String(Math.round(m) % 60).padStart(2, '0')}`;
const SCRIPT = /[Ͱ-Ͽἀ-῿Ѐ-ӿ֐-׿؀-ۿ฀-๿぀-ヿ㐀-鿿가-힯]/;

function parse(text) {
  const all = String(text || '').split('\n').map(l => l.trim());
  const P = { rows: [], rides: [], lunchSaid: false };
  const lb = all.indexOf('LEAVE BY');
  if (lb >= 0) for (let k = lb + 1; k < lb + 6 && k < all.length; k++) { if (/all aboard/i.test(all[k])) P.allAboard = inTxt(all[k]); else if (T(all[k]) != null) { P.leaveBy = T(all[k]); break; } }
  for (const l of all) { if (/^Ashore /.test(l)) { P.ashore = inTxt(l); const a = /all aboard ([\d:]+\s*[ap]m)/i.exec(l), b = /Back at the ship by ([\d:]+\s*[ap]m)/i.exec(l); if (a) P.allAboard = T(a[1]); if (b) P.backBy = T(b[1]); } }
  P.header = all[0] || '';
  const start = all.findIndex(l => /^All times are /.test(l)); P.tzLine = start >= 0 ? all[start] : '';
  const L = start >= 0 ? all.slice(start) : all;
  let cur = null, ride = null, arrive = null;
  for (let k = 0; k < L.length; k++) {
    const l = L[k];
    if (l === 'ARRIVE' && T(L[k + 1]) != null) { arrive = T(L[k + 1]); k++; ride = null; continue; }
    if ((l === 'LEAVE' || l === 'UNTIL' || l === 'BY') && T(L[k + 1]) != null) {
      const t = T(L[k + 1]);
      if (l === 'UNTIL') { if (cur) cur.until = t; k++; continue; }
      if (KEY.test(L[k + 2] || '')) { const mt = L[k + 4] || '', isRide = RIDE.test(mt) && !/^(\d+ h|\d+ min)/.test(mt);
        cur = { key: L[k + 2], arrive, leave: l === 'LEAVE' ? t : null, by: l === 'BY' ? t : null, name: L[k + 3] || '', meta: isRide ? '' : mt, notes: [] }; P.rows.push(cur); arrive = null; ride = null; k += isRide ? 3 : 4; continue; }
    }
    if (l === 'ARRIVE' || l === 'LEAVE') continue;
    if (arrive == null && KEY.test(l) && l === 'E' && /^Back at|^At the|^Arrive|^End/i.test(L[k + 1] || '')) { cur = { key: 'E', arrive: null, name: L[k + 1], meta: '', notes: [] }; P.rows.push(cur); continue; }
    const m = RIDE.exec(l);
    if (m && (m[2] || m[3]) && !/^(\d+ h|\d+ min)/.test(l) && cur) {
      const min = (+m[2] || 0) * 60 + (+m[3] || 0);
      if (!ride) { ride = { from: cur, mode: m[1], min, dist: m[4] ? +m[4] * ({ mi: 1.609, km: 1, ft: 0.0003048, m: 0.001 })[m[5]] : null, head: l, choices: [], notes: [] }; P.rides.push(ride); }
      else ride.choices.push({ mode: m[1], min, txt: l });
      continue;
    }
    if (ride) ride.notes.push(l); else if (cur) cur.notes.push(l);
    if (/lunch/i.test(l)) P.lunchSaid = P.lunchSaid || /back on board|bring|pack|picnic|no (place|restaurant)|skip lunch|lunch on the go|no lunch/i.test(l);
  }
  // A ride belongs between its stop and the next row.
  P.rides.forEach(r => { const i = P.rows.indexOf(r.from); r.to = P.rows[i + 1] || null; });
  return P;
}

// rules(text, info) -> [{ sev, rule, msg }]. info: { type: 'port'|'embark'|'departure'|'land'|..., date: 'YYYY-MM-DD' }
function rules(text, info = {}) {
  const out = [], add = (sev, rule, msg) => out.push({ sev, rule, msg });
  const P = parse(text), hard = /port|embark|departure/.test(info.type || ''), raw = String(text || '');
  const stops = P.rows.filter(r => /^\d+$|^L$/.test(r.key));
  const asking = /Which (pier|port|airport|station|terminal)|couldn't be planned|not planned yet|Pick (the|your) |What time/i.test(raw);
  // ---- S1: ship, train and flight safety
  if (hard && stops.length && P.leaveBy == null && !asking) add('S1', 'leave-by shown', 'a ship, train or flight day with stops planned shows no LEAVE BY time');
  if (P.leaveBy != null) stops.forEach(s => { const out2 = s.until != null ? s.until : s.leave; if (out2 != null && out2 > P.leaveBy + 1) add('S1', 'leave-by after a stop', `LEAVE BY ${clock(P.leaveBy)} but ${s.name} is planned to ${s.until != null ? 'stay until' : 'leave at'} ${clock(out2)}`); });
  const end = P.rows.find(r => r.key === 'E');
  const back = P.backBy != null ? P.backBy : end && end.by;
  if (end && back != null) { const lastRide = P.rides.filter(r => r.to === end).pop(), last = lastRide && lastRide.from;
    const left = last ? (last.until != null ? last.until : last.leave) : null;
    if (left != null && lastRide && left + lastRide.min > back + 1) add('S1', 'ride back fits', `leaves ${last.name} ${clock(left)} + ${lastRide.head} = ${clock(left + lastRide.min)}, after back-by ${clock(back)}`);
    if (end.arrive != null && end.arrive > back + 1) add('S1', 'back by', `arrives back ${clock(end.arrive)}, after back-by ${clock(back)}`); }
  if (P.allAboard != null && back != null && back > P.allAboard - 30) add('S1', 'spare before all aboard', `back-by ${clock(back)} is less than 30 min before all aboard ${clock(P.allAboard)}`);
  if (P.ashore != null) { const first = P.rows.find(r => r.key === 'S'); if (first && first.leave != null && first.leave < P.ashore - 1) add('S1', 'ashore first', `leaves the ship ${clock(first.leave)}, before ashore ${clock(P.ashore)}`); }
  if (hard) P.rides.filter(r => r.to && r.to.key === 'E').forEach(r => { if (/about \d+ ?min|approximately|roughly/i.test(r.head)) add('S1', 'checked ride back', `the ride back is a guide's rough figure: "${r.head}"`); });
  // ---- S2: what the screen says must add up
  let prev = null;
  for (const r of P.rows) { if (r.until != null && r.leave != null && r.until < r.leave - 1) add('S2', 'times go forward', `free time "leave here by ${clock(r.until)}" comes after ${r.name} at ${clock(r.leave)}`); const t = r.arrive != null ? r.arrive : r.leave; if (prev != null && t != null && t < prev - 1) add('S2', 'times go forward', `${r.name} at ${clock(t)} comes after ${clock(prev)}`); const o = r.until != null ? r.until : r.leave != null ? r.leave : r.arrive; if (o != null) prev = o; }
  P.rides.forEach(r => { if (!r.to || r.to.arrive == null) return; const left = r.from.until != null ? r.from.until : r.from.leave; if (left == null) return;
    if (r.to.arrive + 1 < left + r.min) add('S2', 'ride time matches the clock', `${r.from.name} → ${r.to.name}: ${r.head}, but the clock gives ${r.to.arrive - left} min`);
    if (r.dist != null && r.dist > 0.5 && r.min === 0) add('S2', 'ride of no time', `${r.head}`); });
  // A walk's minutes match its distance (2 to 7 km/h), unless the card says why (spare time, steps, a queue, a climb).
  P.rides.forEach(r => { if (!/^Walk$/.test(r.mode) || r.dist == null || r.dist < 0.25 || !r.min) return; const kmh = r.dist / (r.min / 60);
    if ((kmh < 2 || kmh > 7) && !/spare|steps|stairs|queue|climb|uphill|hill|includes|wait/i.test(r.notes.join(' '))) add('S2', 'walk time matches its distance', `${r.head}: ${kmh.toFixed(1)} km/h, nothing on the card says why`); });
  stops.forEach(s => { const want = dur(s.meta); if (want != null && s.arrive != null && s.leave != null && s.leave - s.arrive + 1 < want) add('S2', 'visit length matches the clock', `${s.name}: card says ${s.meta.split(' · ')[0]}, clock gives ${s.leave - s.arrive} min`); });
  const lunch = P.rows.filter(r => r.key === 'L'), t = r => r.name + ' ' + r.meta + ' ' + r.notes.join(' ');
  lunch.forEach(s => { const t = s.name + ' ' + s.meta; if (/Lunch near |Lunch: Lunch in |Your pick|^(Quick )?lunch:?$|on your own|find a place/i.test(t) && !/bring|pack|picnic|no restaurant/i.test(t)) add('S2', 'lunch has a real place', `"${s.name}${s.meta ? ' · ' + s.meta : ''}" names no place to eat and does not say to bring food`); });
  // Lunch is a meal (lunch audit, Nov 22): never at a place whose name says coffee, drinks or a treat and no meal, and it starts
  // by the kitchen's last orders (2:30 pm) unless it is a lunch brought along or the card says it is late.
  lunch.forEach(s => { const nm = s.name.replace(/^(Quick )?lunch:\s*/i, '');
    if (/\b(coffee|espresso|tabacchi|sherry|wine ?bar|cocktails?|lounge|events|tea ?room|juice|gelateria|pasticceria|bakery|patisserie|ice ?cream|donuts?)\b/i.test(nm) && !/\b(taverna|restaurant|trattoria|osteria|bistro|brasserie|grill|meze|kitchen|dining|seafood|steak|pizza|pasta|tapas|lunch)\b/i.test(nm + ' ' + s.meta)) add('S2', 'lunch is a meal', `"${nm}" is a place for coffee, drinks or a treat, not lunch`);
    const at = s.arrive != null ? s.arrive : s.leave; if (at != null && at > 14 * 60 + 30 && !/bring|late lunch|reservation|your pick|on board/i.test(t(s))) add('S2', 'lunch at a lunch hour', `lunch at ${nm} starts ${clock(at)}, after the kitchen's last orders (2:30 pm)`); });
  const firstT = (P.rows[0] || {}).leave, lastT = end ? end.arrive : (P.rows[P.rows.length - 1] || {}).leave;
  if (stops.length >= 2 && firstT != null && lastT != null && firstT <= 12 * 60 && lastT >= 14 * 60 + 30 && !lunch.length && !P.lunchSaid) add('S2', 'lunch on a day out', `out ${clock(firstT)} to ${clock(lastT)} with no lunch and nothing said about it`);
  /* Bags: stored and collected with nothing between is storage for nothing; time out after collecting means carrying the bags. */
  const drop = P.rows.findIndex(r => r.key === 'H' && /leave your bags|luggage storage/i.test(r.name)), pick = P.rows.findIndex(r => r.key === 'H' && /collect your bags/i.test(r.name));
  if (drop >= 0 && pick > drop) { const mid = P.rows.slice(drop + 1, pick).filter(r => /^\d+$|^L$|^\+$/.test(r.key));
    if (!mid.length) add('S2', 'bags stored for something', `bags are left in storage and collected again with nothing in between (${clock(P.rows[drop].arrive)} to ${clock(P.rows[pick].leave)})`);
    P.rows.slice(pick).filter((r, i) => r.until != null || (i && /^\d+$|^L$/.test(r.key))).forEach(r => add('S2', 'bags stored for something', r.until != null ? `free time until ${clock(r.until)} comes after ${r.name}, so the traveler carries the bags` : `${r.name} comes after Collect your bags, so the traveler carries the bags there`)); }
  const names = stops.filter(s => s.key !== 'L').map(s => s.name.toLowerCase()); names.forEach((n, i) => { if (names.indexOf(n) !== i) add('S2', 'sight once', `${n} is on the plan twice`); });
  if (/\bNaN\b|undefined|\bnull\b|Invalid Date|\[object /.test(raw)) add('S2', 'no broken values', (raw.match(/.{0,40}(\bNaN\b|undefined|\bnull\b|Invalid Date|\[object ).{0,20}/) || [''])[0]);
  if (info.date) { const d = new Date(info.date + 'T12:00:00Z'), wd = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getUTCDay()], mo = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getUTCMonth()];
    const want = `${wd} ${mo} ${d.getUTCDate()}`; if (P.header && /^[A-Z]{3} [A-Z]{3} \d/.test(P.header) && !P.header.startsWith(want + ' ')) add('S2', 'date on the day', `header "${P.header.slice(0, 20)}" for ${info.date} (${want})`); }
  P.rides.forEach(r => { const w = r.choices.find(c => /^Walk$/.test(c.mode)) || (/^Walk$/.test(r.mode) ? r : null); if (!w || w.min > 30) return;
    if (!/^(Walk|Taxi|Taxi or car|Car)/.test(r.mode) && r.min > w.min + 10) add('S2', 'never slower than walking', `${r.head} chosen while walking takes ${w.min} min`); });
  { const flight = /to your flight|Flight \d|✈/.test(raw.slice(0, 400)), ship = /all aboard|🚢/.test(raw.slice(0, 400));
    if (flight && !ship && /before the ship|back at the ship|to the ship\b/i.test(raw)) add('S2', 'right words for the day', `a flight day says "${(raw.match(/[^\n.]{0,40}(before the ship|back at the ship|to the ship)[^\n.]{0,20}/i) || [''])[0].trim()}"`);
    if (ship && !flight && /before (your|the) flight/i.test(raw)) add('S2', 'right words for the day', 'a ship day talks about a flight'); }
  // One leave-by: a sentence that says when to leave for the ship, airport or station names the same time as the banner.
  if (P.leaveBy != null) for (const m of raw.matchAll(/leave for the (?:airport|ship|port|station|terminal|cruise terminal|pier)[^.]{0,20}? by (\d{1,2}:\d\d\s*[ap]m)/gi)) { const t = T(m[1]);
    // With bags on the way the same sentence first says when to leave the last stop (the banner's time), then the later
    // bags and leave-for times: "Leave X by 4:16 pm, collect your bags at 4:21 pm, and leave for the terminal by 4:36 pm".
    const head = raw.slice(Math.max(raw.lastIndexOf('\n', m.index), raw.lastIndexOf('. ', m.index)) + 1, m.index), first = /\bLeave [^.\n]{1,60}? by (\d{1,2}:\d\d\s*[ap]m)/i.exec(head);
    if (first && T(first[1]) != null && Math.abs(T(first[1]) - P.leaveBy) <= 2 && t != null && t >= P.leaveBy) continue;
    if (t != null && Math.abs(t - P.leaveBy) > 2) add('S2', 'one leave-by', `the banner says LEAVE BY ${clock(P.leaveBy)} but a note says "${m[0]}"`); }
  // ---- S2: never state something untrue (Richard, Nov 22: "Lies create mistrust of the app"). A reason on screen names
  // the ONE cause the app knows, with its numbers; when the data doesn't say, the screen says "not known" or "not confirmed".
  { const lines = raw.split('\n');
    lines.filter(l => /closed,? or (no longer|can't|doesn't)|is closed or |closed or can't be visited|isn't available on the plan's date|not available on (this|the) (date|day)/i.test(l))
      .forEach(l => add('S2', 'one real reason', `"${l.trim().slice(0, 120)}" gives a guessed either/or reason instead of the one the app knows`));
    lines.filter(l => /(no longer fits|doesn't fit|didn't fit|won't fit|can't fit)/i.test(l) && !/needs|over today's time|left|picks are over|more than|only \d|minutes? short|h \d+ min|\d+ min/i.test(l))
      .forEach(l => add('S3', 'reason has its numbers', `"${l.trim().slice(0, 120)}" says it doesn't fit without the numbers`));
    lines.forEach(l => { const m = /needs about (?:(\d+) h ?)?(?:(\d+) min)?[^.]*?only (?:(\d+) h ?)?(?:(\d+) min)? (?:is )?left/i.exec(l);
      if (m) { const need = (+m[1] || 0) * 60 + (+m[2] || 0), left = (+m[3] || 0) * 60 + (+m[4] || 0); if (need && need <= left) add('S2', 'reason adds up', `"${l.trim().slice(0, 120)}": needs ${need} min but ${left} min are left`); } });
    lines.forEach((l, k) => { const m = /no departure near (\d{1,2}:\d\d\s*[ap]m)[^.]*?next (?:known )?is about (\d{1,2}:\d\d\s*[ap]m)/i.exec(l); if (!m) return;
      const near = lines.slice(Math.max(0, k - 6), k + 6).join(' '), ev = /runs about every (\d+) min/i.exec(near), gap = T(m[2]) - T(m[1]);
      if (ev && gap > 2 * +ev[1] + 10 && !/missing|not known|isn't known|not in the timetable data|not confirmed/i.test(l)) add('S2', 'missing data said as missing', `a line that runs about every ${ev[1]} min is said to have no departure for ${gap} min: "${l.trim().slice(0, 100)}"`); }); }
  // A list in a sentence never has empty names ("Opening hours not confirmed for , , , ,").
  raw.split('\n').filter(l => /\b(for|of|are|:)\s*,\s*[,.]|,\s*,\s*,/.test(l) && /[A-Za-z]/.test(l)).forEach(l => add('S2', 'no empty names', `"${l.trim().slice(0, 100)}"`));
  // The parts of a visit ("1. Arrival 11:02", "2. The climb 11:03", ...) are spread over the visit, not a minute apart.
  stops.forEach(st => { const ts = st.notes.map(l => /(\d{1,2}:\d\d\s*[ap]m)$/i.exec(l)).filter(Boolean).map(m => T(m[1])), want = dur(st.meta);
    if (ts.length >= 3 && want >= 30 && Math.max(...ts) - Math.min(...ts) < want / 4) add('S2', 'visit parts spread over the visit', `${st.name}: ${ts.length} parts timed ${clock(Math.min(...ts))} to ${clock(Math.max(...ts))} in a ${want} min visit`); });
  // ---- S3: readable
  const RL = raw.split('\n'), foreign = RL.filter((l, k) => SCRIPT.test(l) && !/^[A-Za-z]+(-[A-Za-z]+)+\b/.test((RL[k + 1] || '').trim()) && !/USEFUL WORDS/i.test(RL.slice(Math.max(0, k - 30), k).join(' '))); /* a phrase card shows the local words with how to say them */ if (foreign.length) add('S3', 'English letters', `"${foreign[0].trim().slice(0, 70)}"`);
  P.rides.forEach(r => r.choices.forEach(c => { if (c.min > Math.max(3 * r.min, r.min + 90)) add('S3', 'no absurd ride choice', `"${c.txt}" offered beside ${r.head}`); }));
  return out;
}

return { parse, rules, T, clock };
})();
if (typeof module !== "undefined" && module.exports) module.exports = KScreenRules;
