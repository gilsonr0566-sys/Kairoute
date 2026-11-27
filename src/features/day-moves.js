// ---------- Swap two days, remove a day (R-38) ----------
// Richard, Nov 27: "A way to move a planned day and swap it for a different day" and "I see a way to add a day but not to
// remove a day". Both live on the Trip screen, under the day's date, as few taps as possible: Swap (tap) then the other
// day (tap); Remove (tap) then Remove the day (tap). Each can be undone with one tap.
//
// The rule (R-38), for every trip and every day:
//  - A swap moves the traveler's PLAN for the day (picks, own order, meal choices, hours, name), never the travel. The
//    date, the place, the hotel and every ship, train and flight time stay on their date. Only two sightseeing days in
//    the same place swap; an arrival, leaving, boarding, port or sea day is refused with its plain reason, and so is a
//    day already over or a day whose tour has started. A booking or an event stays on its own date (it was booked for
//    that date) and the note says so.
//  - Both swapped days are planned again for their new dates through the one planner (opening hours, closed days,
//    holidays, lunch and the safety guard all run as for any day); a heart on either day comes off, since the day it
//    marked is no longer that plan. Every pick is still accounted for: planned, or named on its day.
//  - Removing a day never moves another day's date: the other days keep their dates, so the trip ends on its last day.
//    A ship, train or flight day is never removed by accident: the question names the travel and says to remove it only
//    if the booking changed. The removed day's picks go to another day in the same place where they fit (never onto a
//    hearted day), the rest back to the sights list, and the note names each one.
// Checked on the real screen by tools/ui/day-moves-check.cjs (with planted copies that must fail).
let dmOpen = null;   // { kind: "swap" | "remove", id: day id } while the swap list or the remove question is open
let dmNote = null;   // { text, warn, undo } after a swap or a removal
// The traveler's plan for a day: what moves with a swap. Everything else (date, place, type, ship/train/flight times,
// the arrival point, bookings, events, weather, tour progress, the heart) stays with its date.
const DM_PLAN = ["selected", "cleared", "ownList", "autoEmpty", "seedSig", "mine", "anchor", "order", "orderOk", "pendingOrder", "pendingCut", "cutOk",
  "mealAt", "mealPrefs", "title", "titleTyped", "pickNames", "wants", "wantsAsked", "skipBonus", "bumped", "movedIn", "startTime", "hours",
  "returnToStart", "alongWay", "fillTime", "grpOwn", "grpOrder", "grpOrderSel", "grpTour", "grpTourPicks", "grpTourMeals", "grpTourCleared", "grpFold", "grpUndo"];
const dmWhen = d => (d.date ? fmtDow(d.date) + " " + fmtDate(d.date) : "this day");
const dmPlace = d => keyOf(cityKeyFor(d) || d.destination || "");
const dmModeWord = d => d.type === "port" || d.type === "embark" ? "ship" : (MODES[d.mode] ? MODES[d.mode].label.toLowerCase() : "travel");
// Why a day can't take part in a swap, in plain words (null when it can).
function dmTravelWhy(d) {
  if (d.type === "arrival") return `${dmWhen(d)} is your arrival day: the ${dmModeWord(d)} arriving${d.time ? " at " + d.time : ""} stays on its date`;
  if (d.type === "departure") return `${dmWhen(d)} is your leaving day: the ${dmModeWord(d)}${d.time ? " at " + d.time : ""} stays on its date`;
  if (d.type === "embark") return `${dmWhen(d)} is your boarding day: the ship${d.allAboard ? " (all aboard " + d.allAboard + ")" : ""} stays on its date`;
  if (d.type === "port") return `${dmWhen(d)} is a cruise port day: the ship's times${d.allAboard ? " (all aboard " + d.allAboard + ")" : ""} stay on their date`;
  if (d.type === "sea") return `${dmWhen(d)} is a day at sea`;
  return null;
}
function dmWhyNot(d) {
  if (!d) return "That day is no longer in the trip";
  const tw = dmTravelWhy(d); if (tw) return tw;
  if (d.date && d.date < todayISO(d)) return `${dmWhen(d)} is already over`;
  if (trip.tour && trip.tour.dayId === d.id && !trip.tour.left) return `your tour of ${dmWhen(d)} has started`;
  return null;
}
function swapWhyNot(a, b) {
  if (!a || !b || a === b) return "Choose another day";
  const wa = dmWhyNot(a); if (wa) return wa;
  const wb = dmWhyNot(b); if (wb) return wb;
  if (dmPlace(a) !== dmPlace(b)) return `${dmWhen(b)} is in ${mainPlace(b) || "another place"}: a day swaps only with another day in ${mainPlace(a) || "the same place"}`;
  return null;
}
const dmPicks = d => (Array.isArray(d.selected) ? d.selected : []);
const dmName = (d, id) => { const c = cityFor(d), s = c ? allSites(c).find(x => x.id === id) : null; return s ? s.name : null; };
function dmForget() { bonusMemo = new Map(); mealMemo = new Map(); keptMemo = new Map(); eveMemo = new Map(); if (typeof fitEpoch === "number") fitEpoch++; }
function swapDays(a, b) {
  const why = swapWhyNot(a, b); if (why) return why;
  const snap = { a: dmPlanOf(a), b: dmPlanOf(b), ra: a.ready ? JSON.parse(JSON.stringify(a.ready)) : null, rb: b.ready ? JSON.parse(JSON.stringify(b.ready)) : null };
  dmSetPlan(a, snap.b); dmSetPlan(b, snap.a);
  // The plan moved is the traveler's choice for that date: it is kept as their own list (an app-chosen list would
  // otherwise be chosen again for the date and come back as it was).
  for (const d of [a, b]) if (Array.isArray(d.selected)) { d.ownList = true; delete d.autoEmpty; }
  // A heart marked the plan that was on its date: that plan has moved, so the heart comes off both days.
  for (const d of [a, b]) { delete d.ready; delete d.askReady; }
  dmForget(); edited(); save();
  dmLastSwap = { a: a.id, b: b.id, snap };
  return null;
}
let dmLastSwap = null;
const dmPlanOf = d => { const o = {}; for (const k of DM_PLAN) if (Object.prototype.hasOwnProperty.call(d, k)) o[k] = JSON.parse(JSON.stringify(d[k] === undefined ? null : d[k])); return o; };
function dmSetPlan(d, o) { for (const k of DM_PLAN) { if (Object.prototype.hasOwnProperty.call(o, k)) d[k] = JSON.parse(JSON.stringify(o[k])); else delete d[k]; } }
// What a swapped day shows after it is planned again for its new date: the picks it doesn't plan, and why when the
// sight is closed that day. The day's own page says the same (R-21); the note only points to it.
function dmUnplanned(d) {
  let p = null; try { p = buildPlan(d); } catch (e) { return []; }
  if (!p || p.error || !p.items) return [];
  const on = new Set(); p.items.forEach(x => { if (x.type === "stop" && x.place) { on.add(String(x.place.id)); (x.place.includesIds || []).forEach(y => on.add(String(y))); } });
  (p.folded || []).forEach(x => on.add(String(x && x.id != null ? x.id : x)));
  const c = cityFor(d);
  return dmPicks(d).filter(id => !on.has(String(id))).map(id => { const s = c ? allSites(c).find(x => x.id === id) : null; if (!s) return null;
    const shut = typeof shutOn === "function" && shutOn(d, s); return s.name + (shut ? " (closed that day)" : ""); }).filter(Boolean);
}
function dmSwapNote(a, b) {
  const parts = [`Swapped: ${dmWhen(a)} now has the plan that was on ${dmWhen(b)}, and ${dmWhen(b)} the plan from ${dmWhen(a)}. Both days were planned again for their new dates (opening hours, closed days and lunch).`];
  for (const d of [a, b]) { const u = dmUnplanned(d); if (u.length) parts.push(`Not planned on ${dmWhen(d)}: ${u.join(", ")}. The day says why.`); }
  for (const d of [a, b]) { const bk = Object.keys(d.booked || {}); if (bk.length) parts.push(`Your booked ${bk.join(" and ").toLowerCase()} stays on ${dmWhen(d)}, the date it was booked for.`);
    if (d.event) parts.push(`${d.event} stays on ${dmWhen(d)}.`); }
  return parts.join(" ");
}
// Remove a day. The other days keep their dates; the day's picks go to another day in the same place where they fit.
function removeDay(d) {
  const i = trip.days.indexOf(d); if (i < 0) return "That day is no longer in the trip";
  if (trip.days.length < 2) return "A trip needs at least one day";
  const snap = JSON.parse(JSON.stringify(d)), picks = dmPicks(d).slice(), names = {};
  picks.forEach(id => { names[id] = dmName(d, id) || id; });
  trip.days.splice(i, 1);
  if (trip.tour && trip.tour.dayId === d.id) trip.tour = null;
  if (trip.active >= trip.days.length || trip.active > i) trip.active = Math.max(0, Math.min(trip.days.length - 1, trip.active > i ? trip.active - 1 : trip.active));
  dmForget();
  // Picks go to another sightseeing day in the same place, only where they fit and never onto a hearted day. A pick
  // moved stays the traveler's own there (an app-chosen list would be chosen again by the planner and lose it).
  const place = dmPlace(d), others = trip.days.filter(o => tourDay(o) && o.type !== "sea" && dmPlace(o) === place && !o.ready && !(o.date && o.date < todayISO(o)));
  const moved = {}, back = [], wasOwn = {};
  picks.forEach(id => { let put = null;
    for (const o of others) { if (dmPicks(o).includes(id)) { put = o; break; } let ok = false; try { ok = addPick(o, id, false); } catch (e) { ok = false; } if (ok) { if (!(o.id in wasOwn)) wasOwn[o.id] = !!o.ownList; (moved[o.id] = moved[o.id] || []).push(id); markMine(o, id, true); o.ownList = true; put = o; break; } }
    if (!put) back.push(id); });
  edited(); save();
  const text = [`Removed ${dmWhen(d)} (${mainPlace(d) || "New day"}). The other days keep their dates${trip.days.length ? `: the trip now ends ${dmWhen(trip.days.map(x => x).sort((x, y) => String(x.date).localeCompare(String(y.date)))[trip.days.length - 1])}` : ""}.`];
  Object.entries(moved).forEach(([oid, ids]) => { const o = trip.days.find(x => x.id === oid); if (o) text.push(`Moved to ${dmWhen(o)}: ${ids.map(id => names[id]).join(", ")}.`); });
  if (back.length) text.push(`Back in the sights list: ${back.map(id => names[id]).join(", ")}.`);
  dmNote = { text: text.join(" "), undo: { kind: "remove", day: snap, idx: i, moved, wasOwn } };
  return null;
}
function dmUndo() {
  const u = dmNote && dmNote.undo; dmNote = null; if (!u) return;
  if (u.kind === "swap") { const a = trip.days.find(x => x.id === u.a), b = trip.days.find(x => x.id === u.b);
    if (a && b && u.snap) { dmSetPlan(a, u.snap.a); dmSetPlan(b, u.snap.b); if (u.snap.ra) a.ready = u.snap.ra; if (u.snap.rb) b.ready = u.snap.rb; dmForget(); edited(); save(); dmNote = { text: `Undone: ${dmWhen(a)} and ${dmWhen(b)} have their own plans back.` }; } return; }
  if (u.kind === "remove" && !trip.days.some(x => x.id === u.day.id)) {
    Object.entries(u.moved || {}).forEach(([oid, ids]) => { const o = trip.days.find(x => x.id === oid); if (o && Array.isArray(o.selected)) { o.selected = o.selected.filter(id => !ids.includes(id)); if (Array.isArray(o.mine)) o.mine = o.mine.filter(id => !ids.includes(id)); if (u.wasOwn && u.wasOwn[oid] === false) delete o.ownList; } });
    const at = Math.min(u.idx, trip.days.length); trip.days.splice(at, 0, u.day); trip.active = at; dmForget(); edited(); save();
    dmNote = { text: `Undone: ${dmWhen(u.day)} is back with its plan.` };
  }
}
// The Trip screen's controls, under the day's date in the day's card.
function dayMovesHTML(d) {
  if (!d) return "";
  const btns = `<div class="dmrow"><button type="button" class="btn ghost small" data-act="dmswap" aria-expanded="${dmOpen && dmOpen.kind === "swap" && dmOpen.id === d.id}">⇄ Swap with another day</button><button type="button" class="btn ghost small" data-act="dmremove" aria-expanded="${dmOpen && dmOpen.kind === "remove" && dmOpen.id === d.id}">✕ Remove this day</button></div>`;
  let box = "";
  if (dmOpen && dmOpen.id === d.id && dmOpen.kind === "swap") {
    const own = dmWhyNot(d);
    if (own) box = `<p class="banner warn dmbox" role="status">This day can't be swapped: ${esc(own)}. Only sightseeing days in the same place swap; travel days stay with their bookings.</p>`;
    else {
      const ok = trip.days.filter(o => o !== d && !swapWhyNot(d, o)), same = trip.days.filter(o => o !== d && dmPlace(o) === dmPlace(d) && swapWhyNot(d, o));
      box = `<div class="card dmbox" role="group" aria-label="Swap with which day"><p class="lede">${ok.length ? `Swap ${esc(dmWhen(d))} with which day? The plans change places; dates, hotel and travel stay put.` : `No other sightseeing day in ${esc(mainPlace(d) || "this place")} to swap with.`}</p>
        ${ok.length ? `<div class="dmlist">${ok.map(o => `<button type="button" class="btn small dmpick" data-act="dmswapto" data-id="${esc(o.id)}"><b>${esc(dmWhen(o))}</b> · ${esc(dayName(o))} · ${dmPicks(o).length} pick${dmPicks(o).length === 1 ? "" : "s"}</button>`).join("")}</div>` : ""}
        ${same.length ? `<ul class="dmwhy">${same.map(o => `<li>${esc(swapWhyNot(d, o))}.</li>`).join("")}</ul>` : ""}
        <button type="button" class="linkbtn" data-act="dmclose">Cancel</button></div>`;
    }
  }
  if (dmOpen && dmOpen.id === d.id && dmOpen.kind === "remove") {
    const tw = dmTravelWhy(d), n = dmPicks(d).length;
    const travel = d.type === "arrival" || d.type === "departure" || d.type === "embark" || d.type === "port";
    box = `<div class="card dmbox ${travel ? "warn" : ""}" role="alertdialog" aria-label="Remove this day"><p class="lede"><b>Remove ${esc(dmWhen(d))} (${esc(mainPlace(d) || "New day")})?</b> ${travel ? esc(tw) + " in your booking. Remove it only if your booking changed: Kairoute then plans nothing for the " + esc(dmModeWord(d)) + " that day. " : ""}${n ? `Its ${n} pick${n === 1 ? "" : "s"} move to another day in ${esc(mainPlace(d) || "this place")} where they fit; the rest go back to the sights list. ` : ""}The other days keep their dates.</p>
      <div class="actions"><button type="button" class="btn small" data-act="dmremoveyes" data-id="${esc(d.id)}">Remove the day</button><button type="button" class="btn ghost small" data-act="dmclose">Keep it</button></div></div>`;
  }
  const note = dmNote ? `<p class="banner ${dmNote.warn ? "warn" : "ok"} dmnote" role="status">${esc(dmNote.text)}${dmNote.undo ? ` <button type="button" class="linkbtn" data-act="dmundo">Undo</button>` : ""}</p>` : "";
  return note + btns + box;
}
// The note says what the tap did: it is brought into view (the list it was tapped in has closed above it).
function dmShowNote() { setTimeout(() => { const n = document.querySelector(".dmnote"); if (n && n.scrollIntoView) n.scrollIntoView({ block: "center" }); }, 30); }
function dayMoveAct(act, t) {
  if (!/^dm/.test(act || "")) return false;
  const d = day();
  if (act === "dmswap" || act === "dmremove") { const k = act === "dmswap" ? "swap" : "remove"; readForm(); dmOpen = dmOpen && dmOpen.kind === k && dmOpen.id === d.id ? null : { kind: k, id: d.id }; dmNote = null; render(); return true; }
  if (act === "dmclose") { dmOpen = null; render(); return true; }
  if (act === "dmundo") { dmOpen = null; dmUndo(); render(); return true; }
  if (act === "dmswapto") {
    const b = trip.days.find(x => x.id === t.dataset.id); dmOpen = null;
    const why = swapDays(d, b);
    dmNote = why ? { text: `Not swapped: ${why}.`, warn: true } : { text: dmSwapNote(d, b), undo: Object.assign({ kind: "swap" }, dmLastSwap) };
    render(); dmShowNote(); return true;
  }
  if (act === "dmremoveyes") {
    const x = trip.days.find(y => y.id === t.dataset.id); dmOpen = null;
    const why = removeDay(x); if (why) dmNote = { text: `Not removed: ${why}.`, warn: true };
    render(); dmShowNote(); return true;
  }
  return false;
}
// Test hook (tools/ui/day-moves-check.cjs): each day as the check needs it.
if (typeof window !== "undefined") window.__kairouteDayMoves = () => trip.days.map((d, i) => { const o = {}; for (const k in d) if (!DM_PLAN.includes(k) && k !== "ready" && k !== "askReady" && typeof d[k] !== "function") o[k] = d[k];
  return { i, id: d.id, date: d.date, type: d.type, place: dmPlace(d), picks: dmPicks(d).slice(), names: dmPicks(d).map(id => dmName(d, id)), ready: !!d.ready, title: d.title || "", fixed: JSON.stringify(o), active: i === trip.active }; });
// Test hook: the sights of a day's place that are shut on any of the given days (by the app's one hours reader).
if (typeof window !== "undefined") window.__kairouteDayMovesShut = (idx) => { const ds = idx.map(i => trip.days[i]), c = cityFor(ds[0]); if (!c) return [];
  return allSites(c).map(x => ({ id: x.id, name: x.name, shut: ds.map(d => !!shutOn(d, x)) })).filter(x => x.shut.some(Boolean)); };
