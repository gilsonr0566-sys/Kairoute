// Screen rules (Nov 22 2026, Richard: "what are all the ways the app can fail"): rules that read ONE day plan exactly as
// the traveler sees it (the page's text), never the planner's own numbers. One copy serves three places:
//   - the app itself (src/features/screen-guard.js): a day whose own screen fails a ship, train or flight rule says so
//     at the top of the plan instead of showing times that disagree, on every traveler's device;
//   - the release gate's phone run (tools/beta2/screen-gate.cjs);
//   - the live-site outside test results (tools/beta2/screen-audit.cjs).
// Severity: S1 = could make a traveler miss the ship, train or flight; S2 = wrong or misleading on screen; S3 = untidy.
// Words that tell the traveler when to head back in rough terms ("Leave Rome by mid-afternoon", "come back by
// mid-afternoon", "head back early"): one rule shared by the screen check and the app, which leaves them out on a day that
// has its own time to leave (src/main.js, planNote).
var KScreenAdvice = /[^.\n]*\b(?:leave\s+(?:\w+\s+){0,2}?by|(?:head|come|get|be)\s+back(?:\s+\w+){0,3}?\s+(?:by|before)|return(?:\s+\w+){0,3}?\s+(?:by|before))\s+(?:the\s+)?(?:early |mid-?|late )?(?:morning|afternoon|evening|noon|lunch(?:time)?)\b[^.\n]*\.?|[^.\n]*\b(?:head|come|get) back early\b[^.\n]*\.?/i;
var KScreenRules = (function () {
const T = s => { const m = String(s || '').trim().match(/^(\d{1,2}):(\d\d)(?:\s*([ap])m)?$/i); if (!m) return null; let h = +m[1]; if (m[3]) h = h % 12 + (m[3].toLowerCase() === 'p' ? 12 : 0); return h * 60 + +m[2]; };
const inTxt = s => { const m = /(\d{1,2}):(\d\d)\s*([ap])m/i.exec(s || ''); return m ? T(m[0]) : null; };
const dur = s => { const m = /^(?:(\d+) h)?\s*(?:(\d+) min)?(?:\s*·|$)/.exec(String(s || '').trim()); if (!m || (!m[1] && !m[2])) return null; return (+m[1] || 0) * 60 + (+m[2] || 0); };
const RIDE = /^((?:Walk|Taxi|Car|Train|Metro|Bus|Boat|Ferry|Tram|Cable|Funicular|Sea bus|Shuttle|Tender|Water|Monorail|Light rail|Coach|Subway|Underground|Rail|Hydrofoil|Catamaran|Gondola|Vaporetto|Lift|Elevator|Bike|Transit|Rideshare|Uber|Tuk)[^·]*?) · (?:(\d+) h ?)?(?:(\d+) min)?(?: · ([\d.]+) (mi|km|ft|m))?$/;
const KEY = /^(S|E|L|H|\d{1,2})$/;
const clock = m => m == null ? '?' : `${Math.floor(m / 60) % 24}:${String(Math.round(m) % 60).padStart(2, '0')}`;
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
    // The day's end row. On ship and leaving days it follows its own ARRIVE time ("ARRIVE 5:23 pm / E / Back at the ship");
    // before Nov 23 that layout was never read, so "back by" and "ride back fits" never ran on those days (found by
    // tools/truth/screen-rule-proof.cjs, which plants each rule's bug and checks it fires).
    if (KEY.test(l) && l === 'E' && /^Back at|^At the|^Arrive|^End/i.test(L[k + 1] || '')) { cur = { key: 'E', arrive, name: L[k + 1], meta: '', notes: [] }; P.rows.push(cur); arrive = null; ride = null; continue; }
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
  // A day that runs past midnight (all aboard 1:30 am, a 0:20 flight): a time more than 3 hours before the day's first time
  // is the next morning's, so 11:58 pm then 12:15 am reads as 17 min later, never 23 h earlier (Nov 22 odd-trips screen
  // check: the app's own guard warned "these times don't all agree" on every day with all aboard after midnight).
  const first = P.ashore != null ? P.ashore : (P.rows.map(r => r.arrive != null ? r.arrive : r.leave != null ? r.leave : r.by).find(t => t != null));
  if (first != null) { const nx = t => t != null && t < first - 180 ? t + 1440 : t;
    ['leaveBy', 'backBy', 'allAboard'].forEach(k => { P[k] = nx(P[k]); }); P.rows.forEach(r => { ['arrive', 'leave', 'until', 'by'].forEach(k => { r[k] = nx(r[k]); }); }); }
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
  // The countdown's own sentence adds up: leaving the last place by its time, the ride there reaches the bags (or other
  // stop on the way) by the time it gives (Nov 23: off the ship and flying out, "Collect your bags by 11:12 am ... From
  // Casa Batlló: taxi or car 26 min, so leave by 11:27 am", 26 min too late, because the bags left at 8:00 were read as the pick-up).
  { const m = /\bby (\d{1,2}:\d\d\s*[ap]m): \d[^.]* there, then the trip on takes the rest\. From ([^:]+): .*?(?:(\d+) h )?(\d+) min, so leave by (\d{1,2}:\d\d\s*[ap]m)/i.exec(raw);
    if (m) { const via = T(m[1]), lv = T(m[5]), ride = (+m[3] || 0) * 60 + +m[4]; if (via != null && lv != null && lv + ride > via + 1 && !(lv + ride > via + 720)) add('S1', 'leave-by reaches the bags', `"leave ${m[2]} by ${clock(lv)}" + ${ride} min reaches the stop on the way at ${clock(lv + ride)}, after its time ${clock(via)}`); } }
  // A flight or train typed in the small hours (before 5:00 am) is asked about, "this morning or tonight?", and nothing but
  // the way there is planned until the traveler answers; answered "this morning", no sights either (Nov 23 oracle: 00:20
  // and 3:10 departures filled the day with sights).
  { const t = T(info.time), small = info.type === 'departure' && info.mode !== 'ship' && t != null && t < 5 * 60;
    if (small && !info.nightDep && !/early this morning, or late tonight/i.test(raw)) add('S1', 'small-hours departure asked', `a ${info.time} departure is planned without asking whether it is this morning or tonight`);
    if (small && info.nightDep !== 'night' && stops.length) add('S1', 'small-hours departure asked', `a ${info.time} departure ${info.nightDep ? 'this morning' : 'not yet placed'} has ${stops.length} sight(s) planned`); }
  // A time to leave that is the time to be back, from a walk of no time (Nov 23 recheck, evening port call with nothing
  // planned ashore: "Leave here by 10:45 pm to be back by 10:45 pm", "From the cruise port: walk 0 min, so leave by").
  { const m = /Leave here by (\d{1,2}:\d\d\s*[ap]m) to be back by (\d{1,2}:\d\d\s*[ap]m)/i.exec(raw);
    if (m && T(m[1]) != null && T(m[1]) === T(m[2])) add('S2', 'leave-by is not the back-by', `"Leave here by ${m[1]} to be back by ${m[2]}": the same time, so the words say nothing true`);
    if (/: walk 0 min, so leave by/.test(raw)) add('S2', 'leave-by is not the back-by', 'a leave-by from a walk of 0 min'); }
  // One time to head back (Nov 24, outside test round 7b: "Leave Rome by mid-afternoon" on a day whose plan leaves St Peter's
  // at 5:30 pm): on a day with a LEAVE BY, no other words tell the traveler a different, vaguer time to head back.
  if (P.leaveBy != null) { const m = KScreenAdvice.exec(raw); if (m) add('S2', 'one time to head back', `"${m[0].trim()}" beside the plan's own LEAVE BY ${clock(P.leaveBy)}`); }
  // "Which airport" with only terminals of one airport to choose from is a terminal question (tester round 7a).
  { const m = /Which airport [^?]*\? There is more than one here \(([^)]*)\)/.exec(raw);
    if (m) { const ns = m[1].split(/,? or |, (?!(?:terminals?|T)\s*[0-9A-Z]{1,3}\b)/i).map(s => s.trim()).filter(Boolean), base = n => n.replace(/\s*,?\s*(terminals?|T)\s*[0-9A-Z]{1,3}$/i, '').trim();
      if (ns.length > 1 && new Set(ns.map(base)).size === 1 && ns.some(n => base(n) !== n)) add('S2', 'terminals asked as terminals', `"Which airport" asked with only terminals of one airport: ${m[1]}`); } }
  // Free time is the time really free where it is shown: from leaving the stop before it to its "until" (Nov 24, tester
  // round 7b, Naples: "Free time: 36 min" until 1:42 pm, right after a lunch ending 1:42 pm).
  P.rows.forEach(r => { if (r.until == null || r.leave == null) return; const n = r.notes.find(x => /^Free time: /.test(x)), m = n && dur(n.replace(/^Free time: /, ''));
    if (m != null && m > r.until - r.leave + 2) add('S2', 'free time fits its clock', `"${n}" until ${clock(r.until)}, but ${r.name} is left at ${clock(r.leave)}`); });
  // ---- S2: what the screen says must add up
  // Free time comes after the day's own first steps (bags left in storage, the hotel check-in), never before them at the
  // airport or the pier (Nov 23: "Free time 1 h 16 min" at the airport, then the ride to the hotel).
  { const fi = P.rows.findIndex(r => r.until != null), hi = P.rows.findIndex(r => /^(Leave your bags in luggage storage|Check in or drop bags)$/.test(r.name || ''));
    if (fi >= 0 && hi > fi) add('S2', 'free time after the first steps', `free time until ${clock(P.rows[fi].until)} comes before "${P.rows[hi].name}"`); }
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
  // Into a meal the clock adds up: leave + ride = arrive (card review, Nov 22: lunch looked pinned to 11:45 am, up to 47 min
  // missing). Time to spare before lunch shows on the card, never in the gap.
  // Free time before lunch ("UNTIL 11:41 am · Free time") is when the traveler leaves for it.
  P.rides.forEach(r => { const k = P.rows.indexOf(r.from), nx = P.rows[k + 1], lv = r.from.until != null ? r.from.until : r.from.leave; if (!nx || nx.key !== 'L' || lv == null || nx.arrive == null || r.choices.length) return;
    if (P.rides.filter(q => q.from === r.from).length > 1) return;
    const gap = nx.arrive - (lv + r.min); if (Math.abs(gap) > 2 && !/spare|wait|includes/i.test(r.notes.join(' '))) add('S2', 'leave + ride = arrive at lunch', `${r.from.name} leave ${clock(lv)} + ${r.head} gives ${clock(lv + r.min)}, lunch says arrive ${clock(nx.arrive)}`); });
  // No idle wait before a meal (R-13; outside test 7b, Nov 23: "2 h 31 min to spare before lunch" on arriving at 9:14 am,
  // about 26 days with 20 min or more): a wait of 20 min or more is free time where it is spent, shown as free time before
  // the way to the meal, never time standing at the restaurant.
  P.rows.filter(r => r.key === 'L').forEach(r => { const m = /(?:(\d+) h ?)?(?:(\d+) min)? to spare before (lunch|dinner)/i.exec([r.meta || ''].concat(r.notes || []).join(' \n '));
    const w = m ? (+m[1] || 0) * 60 + (+m[2] || 0) : 0; if (w >= 20) add('S2', 'no idle wait before a meal', `${r.name}: ${w} min "to spare" standing at the restaurant (shown as free time where it is spent instead)`); });
  // Dinner at a dinner hour (card review: "ARRIVE 11:43 pm Suggested dinner").
  const lines = raw.split('\n').map(l => l.trim());
  lines.forEach((l, k) => { if (/^(From|FROM|ARRIVE)$/.test(l) && T(lines[k + 1]) != null && T(lines[k + 1]) > 21 * 60 + 30 && /dinner/i.test(lines.slice(k + 2, k + 5).join(' '))) add('S2', 'dinner at a dinner hour', `dinner at ${lines[k + 1]}`); });
  const firstT = (P.rows[0] || {}).leave, lastT = end ? end.arrive : (P.rows[P.rows.length - 1] || {}).leave;
  if (stops.length >= 2 && firstT != null && lastT != null && firstT <= 12 * 60 && lastT >= 14 * 60 + 30 && !lunch.length && !P.lunchSaid) add('S2', 'lunch on a day out', `out ${clock(firstT)} to ${clock(lastT)} with no lunch and nothing said about it`);
  /* Bags: stored and collected with nothing between is storage for nothing; time out after collecting means carrying the bags. */
  const drop = P.rows.findIndex(r => r.key === 'H' && /leave your bags|luggage storage/i.test(r.name)), pick = P.rows.findIndex(r => r.key === 'H' && /collect your bags/i.test(r.name));
  if (drop >= 0 && pick > drop) { const mid = P.rows.slice(drop + 1, pick).filter(r => /^\d+$|^L$|^\+$/.test(r.key));
    if (!mid.length && P.rows[drop].until == null) add('S2', 'bags stored for something', `bags are left in storage and collected again with nothing in between (${clock(P.rows[drop].arrive)} to ${clock(P.rows[pick].leave)})`);
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
    lines.filter(l => /(no longer fits|doesn't fit|didn't fit|won't fit|can't fit)/i.test(l) && !/needs|over today's time|left|picks are over|more than|only \d|minutes? short|h \d+ min|\d+ min|\d+ h\b|\d{1,2}:\d{2}\s*(am|pm)?/i.test(l))
      .forEach(l => add('S3', 'reason has its numbers', `"${l.trim().slice(0, 120)}" says it doesn't fit without the numbers`));
    lines.forEach(l => { for (const m of l.matchAll(/needs about (?:(\d+) h ?)?(?:(\d+) min)?(?:(?!needs about)[^.;])*?only (?:(\d+) h ?)?(?:(\d+) min)? (?:is )?left/gi)) {
      const need = (+m[1] || 0) * 60 + (+m[2] || 0), left = (+m[3] || 0) * 60 + (+m[4] || 0); if (need && need <= left) add('S2', 'reason adds up', `"${l.trim().slice(0, 120)}": needs ${need} min but ${left} min are left`); } });
    lines.forEach((l, k) => { const m = /no departure near (\d{1,2}:\d\d\s*[ap]m)[^.]*?next (?:known )?is about (\d{1,2}:\d\d\s*[ap]m)/i.exec(l); if (!m) return;
      const near = lines.slice(Math.max(0, k - 6), k + 6).join(' '), ev = /runs about every (\d+) min/i.exec(near), gap = T(m[2]) - T(m[1]);
      if (ev && gap > 2 * +ev[1] + 10 && !/missing|not known|isn't known|not in the timetable data|not confirmed/i.test(l)) add('S2', 'missing data said as missing', `a line that runs about every ${ev[1]} min is said to have no departure for ${gap} min: "${l.trim().slice(0, 100)}"`); }); }
  // A list in a sentence never has empty names ("Opening hours not confirmed for , , , ,").
  raw.split('\n').filter(l => /\b(for|of|are|:)\s*,\s*[,.]|,\s*,\s*,/.test(l) && /[A-Za-z]/.test(l)).forEach(l => add('S2', 'no empty names', `"${l.trim().slice(0, 100)}"`));
  // The parts of a visit ("1. Arrival 11:02", "2. The climb 11:03", ...) are spread over the visit, not a minute apart.
  stops.forEach(st => { const ts = st.notes.map(l => /(\d{1,2}:\d\d\s*[ap]m)$/i.exec(l)).filter(Boolean).map(m => T(m[1])), want = dur(st.meta);
    if (ts.length >= 3 && want >= 30 && Math.max(...ts) - Math.min(...ts) < want / 4) add('S2', 'visit parts spread over the visit', `${st.name}: ${ts.length} parts timed ${clock(Math.min(...ts))} to ${clock(Math.max(...ts))} in a ${want} min visit`); });
  // ---- S3: readable
  const RL = raw.split('\n'), foreign = RL.filter((l, k) => SCRIPT.test(l) && !/^[A-Za-z]+(-[A-Za-z]+)+\b/.test((RL[k + 1] || '').trim()) && !/USEFUL WORDS/i.test(RL.slice(Math.max(0, k - 30), k).join(' '))); /* a phrase card shows the local words with how to say them */ if (foreign.length) add('S2', 'English letters', `"${foreign[0].trim().slice(0, 70)}"`);
  P.rides.forEach(r => r.choices.forEach(c => { if (c.min > Math.max(3 * r.min, r.min + 90)) add('S3', 'no absurd ride choice', `"${c.txt}" offered beside ${r.head}`); }));
  // ---- Opening hours (Nov 22, "make opening hours and closed days reliable"): what a stop's own hours line says agrees
  // with the times beside it. A visit starts after it opens and ends by its closing (a last entry is kept); a stop whose
  // hours aren't known says "not confirmed" with the hours it was planned in, and its visit sits inside them; a stop is
  // never planned on a day its line says it's closed.
  // A lunch's card shows its opening hours when they are known (class rule "no meal while the place is shut", Nov 23): the
  // same check holds it to them.
  for (const r of stops) { const line = (r.key === 'L' ? [r.meta || ''] : []).concat(r.notes || []).find(n => r.key === 'L' ? /^Open \d/.test(n) : /^Open \d|Hours not confirmed|^Closed(?! to visitors at prayer)/.test(n)) || '';
    if (r.key === 'L' && !line) continue;
    // lunch starts when the card says ("10 min to spare before lunch at 12:30 pm"): waiting outside before it opens is fine.
    const spareM = r.key === 'L' && [r.meta || ''].concat(r.notes || []).map(n => /before (?:lunch|dinner)[^0-9]* at (\d{1,2}:\d\d\s*[ap]m)/i.exec(n)).find(Boolean), from = spareM && T(spareM[1]) != null ? T(spareM[1]) : r.arrive;
    const times = [...line.matchAll(/(\d{1,2}:\d\d\s*[ap]m)\s*[–-]\s*(\d{1,2}:\d\d\s*[ap]m)/gi)].map(m => [T(m[1]), T(m[2])]).filter(x => x[0] != null && x[1] != null).map(([a, b]) => [a, b <= a ? b + 1440 : b]);
    const lastM = /last entry (\d{1,2}:\d\d\s*[ap]m)/i.exec(line), last = lastM ? T(lastM[1]) : null, until = r.leave != null ? r.leave : r.until;
    if (/^Closed(?! to visitors at prayer)/.test(line)) { add('S2', 'never planned while closed', `${r.name}: planned at ${clock(r.arrive)} but its hours line says "${line.slice(0, 60)}"`); continue; }
    if (/Hours not confirmed/.test(line) && !times.length) add('S2', 'unknown hours said with the planned window', `${r.name}: "Hours not confirmed" without the hours it was planned in`);
    if (!times.length || from == null) continue;
    const span = times.find(([a, b]) => from >= a - 1 && from < b) || null;
    if (!span) { add('S2', 'never planned while closed', `${r.name}: ${r.key === 'L' ? 'lunch at' : 'arrives'} ${clock(from)}, its hours are ${line.slice(0, 70)}`); continue; }
    if (until != null && until > span[1] + 1) add('S2', 'visit ends by closing', `${r.name}: stays until ${clock(until)}, closes ${clock(span[1])}`);
    if (last != null && r.arrive > last + 1) add('S2', 'arrive by last entry', `${r.name}: arrives ${clock(r.arrive)}, last entry ${clock(last)}`);
  }
  return out;
}

return { parse, rules, T, clock };
})();
if (typeof module !== "undefined" && module.exports) module.exports = KScreenRules;
