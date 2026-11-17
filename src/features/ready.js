// ---------- Day ready: the heart (Richard, Nov 14) ----------
// One tap on the heart says "this day is planned the way I want it". The heart shows on that day in the day list,
// and the app stops reshuffling the day on its own: its picks and optional stops stay as they were. A change the
// traveler didn't make (a sight now closed, a ride that no longer fits, a later re-plan on the day) still goes in,
// because safety comes first; the heart then turns to an outline with a note saying what changed, until they
// confirm the day again. Saved with the trip, so it works offline and syncs to their other devices.
// When every day is hearted, a short celebration: "Your trip is ready".
// What the heart vouches for: the traveler's own sights on the day (order and times may shift with fresh ride times).
// Optional stops are kept as they were where they still fit, but coming or going doesn't count as a change.
const readyStops = plan => plan && !plan.error ? plan.stops.filter(s => !s.place.along && !s.place.bonus).map(s => s.place) : [];
const readySig = plan => readyStops(plan).map(p => p.id || p.name).sort().join("|");
// Days that can be hearted: any day with a plan of its own (a day at sea or on board counts once it has a plan).
const readyDays = () => trip.days.filter(d => !throughTo(d) && (noShore(d) || cityFor(d)));
const selSig = d => selKey(d);
function selKey(d) { return (Array.isArray(d.selected) ? d.selected.slice().sort() : []).join("|"); }
// A change the app makes to a hearted day's sights (a pick that no longer fits once the ship leaves earlier, a sight
// now closed, a guide merging two copies of a sight) is not the traveler's change: the heart must turn to an outline
// with a note, not go quietly off. Every place the app edits d.selected on its own calls this with the key from before.
// The same goes for the "these are still the app's own picks" mark (seedSig): a pick the app took off doesn't make the
// list the traveler's, so a famous day trip found later can still lead the day (Pompeii on Naples, Nov 14).
function readyKeep(d, was) { if (!d) return; if (d.ready && d.ready.sel != null && d.ready.sel === was) d.ready.sel = selKey(d); if (d.seedSig && d.seedSig === was) d.seedSig = selKey(d); }
function readyState(d) {
  if (!d || !d.ready) return "";
  // The traveler changed the day's sights themselves: it's theirs to mark ready again (no warning needed).
  if (d.ready.sel != null && d.ready.sel !== selSig(d)) return "";
  if (noShore(d) || !cityFor(d)) return "ok";
  let plan = null; try { plan = buildPlan(d); } catch (e) { return "ok"; }
  if (plan && !plan.error && plan.lockBroken) return "changed"; // a time change (or safety) made the app change the day
  // A heart from before the lock: the plan it vouches for is locked now, the first time it's seen unchanged.
  if (plan && !plan.error && !d.ready.lock && plan.lock && readySig(plan) === d.ready.sig) { d.ready.lock = plan.lock; readyLater(); }
  return !plan || plan.error || readySig(plan) === d.ready.sig ? "ok" : "changed";
}
let readySaveT = 0;
function readyLater() { if (readySaveT || typeof setTimeout === "undefined") return; readySaveT = setTimeout(() => { readySaveT = 0; save(); }, 0); }
function readyMark(d) {
  let plan = null; if (!noShore(d) && cityFor(d)) { try { plan = buildPlan(d); } catch (e) {} }
  d.ready = { at: Date.now(), sel: selSig(d), sig: readySig(plan), names: readyStops(plan).map(p => p.name), bonus: plan && !plan.error ? (plan.bonus || []).map(x => x.id) : [] };
  if (plan && !plan.error && plan.lock) d.ready.lock = plan.lock; // the whole plan, kept as it is: order, optional stops, places to eat
  d.ready.pulse = 0;
}
// What changed since the heart was tapped, in a few words.
function readyChange(d) {
  if (readyState(d) !== "changed") return null;
  const now = readyStops(buildPlan(d)).map(p => p.name), was = d.ready.names || [];
  const added = now.filter(n => !was.includes(n)), gone = was.filter(n => !now.includes(n));
  const p = buildPlan(d); return { added, gone, why: p && !p.error ? p.lockBroken || "" : "" };
}
const readyCount = () => { const ds = readyDays(); return { done: ds.filter(d => readyState(d) === "ok").length, of: ds.length }; };
const heartSVG = on => `<svg class="heartico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.6 2.3 4.5 6.2 4.5c2.3 0 3.8 1.3 4.6 2.6h2.4c.8-1.3 2.3-2.6 4.6-2.6 3.9 0 5.8 4.1 4.2 7.2C19.5 16.4 12 21 12 21z" ${on ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2"'}/></svg>`;
// The heart in the day's head, next to Rename.
function heartBtn(d) {
  const s = readyState(d), label = s === "ok" ? "Day ready" : s === "changed" ? "Changed: tap to lock" : "Mark day ready";
  // A brief pulse the first time the heart is shown changed, so the traveler notices; not on every redraw.
  let pulse = ""; if (s === "changed" && !d.ready.pulse) { d.ready.pulse = Date.now(); readyLater(); pulse = " pulse"; } else if (s === "changed" && Date.now() - d.ready.pulse < 2500) pulse = " pulse";
  return `<button class="linkbtn heartbtn ${s || "off"}${pulse}" data-act="dayready" aria-pressed="${s === "ok"}" title="${s === "ok" ? "Tap to unmark this day" : "Tap when this day is planned the way you want it"}">${heartSVG(s === "ok")}<span>${label}</span></button>`;
}
// The small heart on a day in the day list (top strip and Trip screen).
const heartDot = d => { const s = readyState(d); return s ? `<span class="dheart ${s}" aria-label="${s === "ok" ? "Day ready" : "Changed since you marked it ready"}">${heartSVG(s === "ok")}</span>` : ""; };
function readyBanner(d) {
  const c = readyChange(d); if (!c) return "";
  const bits = [c.added.length ? `added ${c.added.map(esc).join(", ")}` : "", c.gone.length ? `took off ${c.gone.map(esc).join(", ")}` : ""].filter(Boolean).join(" and ");
  const txt = c.why ? `Your locked day changed because ${esc(c.why)}${bits ? `: Kairoute ${bits}` : ", so Kairoute re-planned it"}.` : `You marked this day ready, then Kairoute ${bits || "changed it"}${c.gone.length ? " (closed, or no longer fits the time safely)" : ""}.`;
  return `<div class="banner warn readychg" role="status"><span>${txt} Check the plan and tap the heart to lock it again.</span><button class="btn small" data-act="dayready">${heartSVG(true)} Lock again</button></div>`;
}
// ---- Your trip is ready ----
let celebrateOpen = false;
function celebrateHTML() {
  const ds = trip.days, nDays = new Set(ds.map(x => x.date).filter(Boolean)).size || ds.length, cities = new Set(ds.filter(x => !noShore(x) && x.destination).map(x => keyOf(mainPlace(x) || x.destination))).size;
  let sights = 0; ds.forEach(d => { if (noShore(d) || !cityFor(d)) return; try { sights += readyStops(buildPlan(d)).length; } catch (e) {} });
  const off = typeof offFresh === "function" ? offFresh() : null, offOk = !!(off && off.ready);
  return `<div class="celebrate" id="celebrate" role="dialog" aria-modal="true" aria-labelledby="celTitle">
    <div class="celcard">
      <svg class="celroute" viewBox="0 0 240 120" aria-hidden="true">
        <path class="celpath" d="M20 96 C 60 96, 70 40, 120 52 S 190 92, 222 30" fill="none" stroke="var(--route)" stroke-width="6" stroke-linecap="round"/>
        <circle class="celsun" cx="222" cy="30" r="13" fill="#F28C38"/>
        <g class="celrays" stroke="#F28C38" stroke-width="3" stroke-linecap="round"><path d="M222 6v6M222 48v6M198 30h6M240 30h-6M205 13l4 4M239 13l-4 4"/></g>
        <circle cx="20" cy="96" r="7" fill="var(--route)"/>
      </svg>
      <h2 id="celTitle">Your trip is ready</h2>
      <p class="lede">Every day is planned the way you want it.</p>
      <div class="celstats"><div><b>${nDays}</b><span>day${nDays === 1 ? "" : "s"}</span></div><div><b>${cities}</b><span>${cities === 1 ? "place" : "places"}</span></div><div><b>${sights}</b><span>sights</span></div></div>
      ${offOk ? `<p class="celoff ok">✓ Saved for offline: no internet needed on the trip.</p>` : `<button class="btn" data-act="celoffdl">Download for offline</button>`}
      <button class="btn ghost" data-act="celclose">${offOk ? "Done" : "Later"}</button>
    </div></div>`;
}
function celebrate() {
  if (celebrateOpen) return; celebrateOpen = true;
  const el = document.createElement("div"); el.innerHTML = celebrateHTML(); document.body.appendChild(el.firstElementChild);
  const c = document.getElementById("celebrate"); requestAnimationFrame(() => c && c.classList.add("on"));
  const b = c && c.querySelector("[data-act=celoffdl], [data-act=celclose]"); if (b) b.focus();
}
function celebrateClose() { const c = document.getElementById("celebrate"); if (c) c.remove(); celebrateOpen = false; }
// After a heart is tapped: the moment the last day is hearted, celebrate (once per trip; replay from the Trip screen).
function readyCheckAll() {
  const c = readyCount();
  if (c.of && c.done === c.of && !trip.celebrated) { trip.celebrated = Date.now(); save(); setTimeout(celebrate, 350); }
  if (c.done < c.of && trip.celebrated) { delete trip.celebrated; save(); }
}
function readyTripLine() {
  const c = readyCount(); if (!c.of) return "";
  return `<div class="readyline"><span class="dheart ${c.done === c.of ? "ok" : ""}">${heartSVG(c.done === c.of)}</span><span><b>${c.done} of ${c.of}</b> days ready</span>${c.done === c.of ? `<button class="linkbtn" data-act="celebrate">See your trip summary</button>` : ""}</div>`;
}
if (typeof document !== "undefined") document.addEventListener("click", e => {
  const t = e.target.closest && e.target.closest("[data-act]"); if (!t) return;
  const act = t.dataset.act;
  if (act === "dayready") { const d = day(); if (!d) return; if (readyState(d) === "ok") delete d.ready; else readyMark(d); save(); render(); readyCheckAll(); }
  else if (act === "celebrate") celebrate();
  else if (act === "celclose") celebrateClose();
  else if (act === "celoffdl") { celebrateClose(); view = "trip"; render(); setTimeout(() => { const b = document.querySelector('[data-act="offdl"]'); if (b && !b.disabled) b.click(); }, 50); }
});
if (typeof document !== "undefined") document.addEventListener("keydown", e => { if (e.key === "Escape" && celebrateOpen) celebrateClose(); });
if (typeof window !== "undefined") window.__kairouteReady = { state: i => readyState(trip.days[i]), mark: i => { readyMark(trip.days[i]); save(); readyCheckAll(); }, clear: i => { delete trip.days[i].ready; save(); }, count: readyCount, change: i => readyChange(trip.days[i]), days: () => readyDays().map(d => trip.days.indexOf(d)),
  // For the checks: the day's plan in short (stops and meals, in order), and new outside data the planner would use.
  shape: i => { const pl = buildPlan(trip.days[i]); return pl && !pl.error ? pl.items.filter(x => x.type === "stop" || x.type === "meal").map(x => (x.type === "meal" ? x.meal.label + ": " : "") + x.place.name).join(" > ") : "no plan"; },
  plan: i => { const pl = buildPlan(trip.days[i]); return pl && !pl.error ? { over: !!pl.over, locked: !!pl.locked, why: pl.lockBroken || "", lock: trip.days[i].ready && trip.days[i].ready.lock ? trip.days[i].ready.lock.t : null } : null; },
  newData: i => { const d = trip.days[i], c = cityFor(d), pl = buildPlan(d), first = pl.stops[0].place;
    c.sites.push(Object.assign({}, first, { id: "lock-test-mustsee", name: "Lock Test Must-See", mustSee: true, minutes: 15, quick: false, oh: null, hours: null, closed: null, bonus: false, lat: +first.lat + 0.0006, lng: +first.lng + 0.0006 }));
    (c.restaurants || []).reverse().forEach(r => { r.top = false; r.crowdTop = false; r.recommended = !r.recommended; });
    planGen++; dataGen++;
    const copy = JSON.parse(JSON.stringify(d)); delete copy.ready; const ix = trip.days.length; trip.days.push(copy);
    try { const p2 = buildPlan(copy); return !!(p2 && !p2.error && p2.items.some(x => x.place && x.place.id === "lock-test-mustsee")); } finally { trip.days.splice(ix, 1); planGen++; } } };
// ---------- The heart's lock (Richard, Nov 16: "The heart locks things down barring a time change") ----------
// When a day is hearted, its plan is kept as it was: every stop in its order (the traveler's picks, optional stops and
// quick sights on the way), each stop's time there, and the places to eat. Nothing the app does in the background
// (a re-plan when a guide or ride time arrives, a meal swap, a better loop, the day fill) changes it. What can:
//  - a change to the day's times or setup (ship arrival or all aboard, boarding, flight or train time, start time,
//    hours to sightsee, hotel, a table booked): the day is planned again for the new times;
//  - the hearted plan no longer being safe: a stop now closed that day, or rides slow enough that the day would run
//    past its hard end (the ship never waits: Rule #2).
// Then the plan says what forced it (plan.lockBroken), the heart turns to an outline with a short pulse, and one tap
// locks the new plan.
function lockTimes(d, city, w) {
  const thru = throughFrom(d), L = lodgingFor(d, city);
  return { type: d.type || "", mode: d.mode || "", start: d.startTime || "", hours: d.hours == null ? "" : String(d.hours), time: d.time || "",
    arrive: d.portArrive || "", aboard: d.allAboard || "", tender: !!d.tender, board: d.boardTime || "", thru: (thru && thru.time) || "",
    back: !!d.returnToStart, bags: !!d.noBags, stay: (L && L.name) || "", book: JSON.stringify(d.booked || {}),
    set: [!!d.rain, !!d.alongWay, d.fillTime !== false, trip.style || "mix", (trip.prefs && trip.prefs.pace) || "moderate"].join("|"),
    endBy: d.type === "arrival" ? null : Math.round(w.endBy) }; // an arrival day's end depends on the ride in, which isn't a time the traveler set
}
// The day's plan as it can be stored: stops by id with their minutes and what they are, meals with their place.
function lockSeqOut(seq) {
  return seq.map(x => {
    if (x.mealOf) { const n = Object.assign({}, x); delete n.mealOf; delete n.alts; return { meal: x.mealOf.label, q: x.mealOf.quick ? 1 : 0, bk: x.mealOf.booked ? 1 : 0, node: n }; }
    return { id: x.id, n: x.name, min: x.minutes || 0, sf: x.shortFrom || 0, b: x.bonus ? 1 : 0, a: x.along ? 1 : 0 };
  });
}
// What changed in the day's times, in a few plain words.
function lockTimeWhy(a, b, d) {
  const word = (MODES[d.mode] || {}).label || "travel";
  if (a.aboard !== b.aboard) return `all aboard is now ${b.aboard || "not set"}`;
  if (a.arrive !== b.arrive) return `the ship now docks at ${b.arrive || "a time not set"}`;
  if (a.tender !== b.tender) return b.tender ? "this is now a tender port" : "the ship now docks at the pier";
  if (a.board !== b.board) return `your boarding time is now ${b.board || "not set"}`;
  if (a.time !== b.time) return `your ${word.toLowerCase()} time is now ${b.time || "not set"}`;
  if (a.thru !== b.thru) return `your arrival time is now ${b.thru || "not set"}`;
  if (a.start !== b.start) return `the day now starts at ${b.start || "a time not set"}`;
  if (a.hours !== b.hours) return "you changed the day's hours";
  if (a.stay !== b.stay) return "your hotel changed";
  if (a.book !== b.book) return "your table booking changed";
  if (a.type !== b.type || a.mode !== b.mode) return "the day's travel changed";
  if (a.endBy !== b.endBy) return `the time to be back is now ${fmt(b.endBy)}`;
  if (a.back !== b.back || a.bags !== b.bags || a.set !== b.set) return "you changed this day's settings";
  return "";
}
// Replays a hearted day's plan. Returns { seq, dropped, bonus, along, quick, eve } when it still holds, { why } when a
// time change or safety forces a new plan, or null for a day without a lock (not hearted, or hearted before locks).
function lockReplay(d, city, w, lockT, w0start, k) {
  const R = d && d.ready, L = R && R.lock;
  if (!R || !L || !Array.isArray(L.seq) || !L.t) return null;
  if (R.sel != null && R.sel !== selKey(d)) return null; // the traveler changed the day's sights: theirs to heart again
  const tw = lockTimeWhy(L.t, lockT, d); if (tw) return { why: tw };
  const by = new Map(); (city.sites || []).concat(city.farther || []).forEach(s => { if (s && s.id != null && !by.has(s.id)) by.set(s.id, s); });
  const seq = [], bonus = [], along = []; let quick = false;
  for (const x of L.seq) {
    if (x.meal) {
      if (k.liveAte && k.liveAte(d, x.meal)) continue;
      const m0 = MEALS.find(m => m.label === x.meal); if (!m0) return { why: "a meal could no longer be placed" };
      let m = x.q ? Object.assign({}, m0, { len: QUICK_MEAL[m0.label] || m0.len, quick: true }) : m0, node = x.node;
      if (x.bk) { const b = k.inDay.find(b => b.label === x.meal); if (!b) return { why: "your table booking changed" }; m = b; node = b.node; }
      if (x.q) quick = true;
      const cur = !x.bk && node && !node.generic ? (city.restaurants || []).find(r => keyOf(r.name) === keyOf(node.name)) : null;
      seq.push(Object.assign({}, cur || node, { mealOf: m }));
      continue;
    }
    if (liveDone(d, x.id)) continue;
    const s = by.get(x.id); if (!s) return { why: `${x.n || "a stop"} is no longer in the guide` };
    if (closedForDay(s, d, w)) return { why: `${s.name} is closed that day` };
    if (k.seenOn && k.seenOn[s.id]) return { why: `${s.name} is now planned on ${dayName(k.seenOn[s.id]) || "an earlier day"}` };
    const n = Object.assign({}, s, { minutes: x.min || s.minutes }, k.live(s));
    if (x.sf) n.shortFrom = x.sf; if (x.b) { n.bonus = true; bonus.push(n); } if (x.a) { n.along = true; along.push(s); }
    seq.push(n);
  }
  // Safety: the same limits the planner keeps. A ship, train or plane never waits.
  const r = simDay(seq, k.t0, k.O, k.ZZ, k.style), lim = w.endBy - k.tailCost(), behind = w.start !== w0start;
  if (r.end > lim + (hardEnd(d) ? 0 : 5)) return { why: behind ? "you're running behind, and the day as hearted would run past " + fmt(lim) : `rides now take longer, and the day as hearted would run past ${fmt(lim)}` };
  if (r.late > (L.late || 0)) { let who = ""; for (let i = 1; i <= seq.length && !who; i++) if (simDay(seq.slice(0, i), k.t0, k.O, k.ZZ, k.style).late > (L.late || 0)) who = seq[i - 1].name;
    return { why: `you'd now reach ${who || "a stop"} after it closes` }; }
  const inSeq = new Set(seq.filter(x => !x.mealOf).map(x => x.id));
  return { seq, dropped: k.chosen.filter(s => !inSeq.has(s.id)), bonus, along, quick, eve: L.eve || "" };
}
