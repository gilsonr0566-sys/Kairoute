// ---------- One home for each fact (outside UI review, Nov 20) ----------
// The review found the same fact worked out on several screens and coming out different: three day lengths, three
// "back" times, a trip of 20, 21 and 22 days, 24-hour and am/pm times side by side. Each of those facts is now made
// here, once, and every screen prints what this gives it. tools/ui/ui-check.cjs checks no two screens disagree.

// ---- The clock: one format for every time the traveler sees ----
// Settings > Display > Clock: 24-hour, 12-hour, or (the default) whatever the device uses. Every time on screen,
// whichever part of the app wrote it (the planner's notes say "6:30 pm", the timeline "18:30"), is shown in that one
// format: the page's text is put through clockText as it is drawn, so no screen can mix the two.
function deviceClock12() {
  try { const o = new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions(); return o.hourCycle ? /^h1[12]$/.test(o.hourCycle) : !!o.hour12; } catch (e) { return false; }
}
const clockPref = () => (typeof appSet !== "undefined" && appSet.clock) || "auto";
const clock12 = () => { const p = clockPref(); return p === "12" || (p === "auto" && deviceClock12()); };
// "18:30" or "6:30 pm" for minutes since midnight, in the traveler's format.
function clockOf(m) { m = Math.round(m); const h = ((Math.floor(m / 60) % 24) + 24) % 24, mm = String(((m % 60) + 60) % 60).padStart(2, "0"); return clock12() ? `${h % 12 || 12}:${mm} ${h < 12 ? "am" : "pm"}` : String(h).padStart(2, "0") + ":" + mm; }
const T24 = /\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s?[AaPp]\.?[Mm]\b)(?!:\d)/g, T12 = /\b(1[0-2]|0?[1-9]):([0-5]\d)\s?([AaPp])\.?[Mm]\b/g;
// Any times in a piece of text, written the traveler's way.
function clockText(s) {
  s = String(s); if (s.indexOf(":") < 0) return s;
  if (clock12()) return s.replace(T12, (x, h, mm, ap) => `${+h}:${mm} ${ap.toLowerCase()}m`).replace(T24, (x, h, mm) => clockOf(+h * 60 + +mm));
  return s.replace(T12, (x, h, mm, ap) => { let H = +h % 12; if (/p/i.test(ap)) H += 12; return String(H).padStart(2, "0") + ":" + mm; });
}
// Put every text on the page through the clock, now and whenever the page changes (a re-render, the countdown's tick).
const CLOCK_SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION|CODE)$/;
function clockNode(n) {
  if (n.nodeType === 3) { const p = n.parentNode; if (!p || CLOCK_SKIP.test(p.nodeName) || (p.closest && p.closest("[data-noclock],[contenteditable]"))) return; const v = n.nodeValue, w = clockText(v); if (w !== v) n.nodeValue = w; return; }
  if (n.nodeType !== 1 || CLOCK_SKIP.test(n.nodeName)) return;
  const tw = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); let t; const all = []; while ((t = tw.nextNode())) all.push(t); all.forEach(clockNode);
}
if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
  const mo = new MutationObserver(ms => { for (const m of ms) { if (m.type === "characterData") clockNode(m.target); else m.addedNodes.forEach(clockNode); } });
  const start = () => { document.documentElement.classList.toggle("clock12", clock12()); clockNode(document.body); mo.observe(document.body, { subtree: true, childList: true, characterData: true }); };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
  window.__kairouteClock = { text: clockText, of: clockOf, is12: clock12, set: v => { appSet.clock = v; saveAppSet(); document.documentElement.classList.toggle("clock12", clock12()); render(); clockNode(document.body); } };
  // Settings' Clock buttons: the class that widens the time column follows the choice at once.
  document.addEventListener("click", e => { const t = e.target.closest && e.target.closest('[data-app="clock"]'); if (t) setTimeout(() => { document.documentElement.classList.toggle("clock12", clock12()); clockNode(document.body); }); });
}

// ---- The day: hours, time left, back-by and leave-by ----
// One answer for a planned day, from the plan itself (the engine's start, end and finish), never worked out again
// screen by screen:
//   start / endBy  the day's hours: sightseeing starts, and must be done by (back at the ship, train or flight point
//                  on a fixed day, the end the traveler set on a hotel day). len = endBy - start.
//   finish         when the plan's last stop and the ride back are done.
//   left           time left to fill: what Choose sights' bar, the free time row and the notes all say.
//   leaveBy        when to leave the last stop (or the free time) to be back by endBy: the countdown's own time.
//   allAboard      the ship's all-aboard time on the port's clock (port and boarding days).
// Where the traveler is when the way back begins: the plan's last stop or meal ashore (lunch back on board comes after the
// ride back); with none, the top of the cable car (or funicular) ridden up at the start; else the start itself. One answer
// for the free time row, the leave-by and the countdown (Nov 22 odd-trips screen check, a 7:00-11:00 tender call with no
// stops: the free time sat after the cable car down, and the start was moved to the leave-by time).
function lastAshoreIdx(plan) {
  const its = (plan && plan.items) || []; let j = -1; its.forEach((it, k) => { if (it.type === "stop" || (it.type === "meal" && !(it.place && it.place.onBoard))) j = k; });
  if (j >= 0) return j;
  // With no stop: the last step of the day's start (the bags left in storage, the hotel check-in, the cable car up), else
  // the start itself (Nov 23: free time was shown at the airport before the ride to the hotel, and before the bags were left).
  its.forEach((it, k) => { if (it.type === "start" || (it.type === "fixed" && (it.up || it.head))) j = k; });
  return j;
}
// Free time from where the day starts, with nothing planned away from it and no ride back (an evening port call whose
// picks are all shut, Nov 23 recheck): "leave here by 10:45 pm to be back by 10:45 pm" says nothing true; the screens say
// to be back by the time instead, leaving in time from wherever the traveler goes.
function freeAtStart(plan, F) { const its = (plan && plan.items) || [], j = lastAshoreIdx(plan); return !!(F && F.back === 0 && j >= 0 && its[j] && its[j].type === "start"); }
const backWhere = (d, plan) => d.type === "port" ? "the ship" : d.type === "embark" ? "the cruise terminal" : (fixedPointName(d, plan) || "your " + ((typeof MODES !== "undefined" && MODES[d.mode] || {}).label || "ride").toLowerCase());
function dayFacts(d, plan) {
  if (!d || !plan || plan.error) return null;
  const fixed = typeof fixedTitle === "function" && !!fixedTitle(d) && plan.w && plan.w.tail && plan.w.tail.length;
  const tl = typeof timeLeft === "function" ? timeLeft(plan, d) : null;
  const left = tl ? Math.max(0, Math.round(tl.left)) : Math.max(0, plan.endBy - plan.end);
  // The ride back from the plan's last stop or meal: the same rides the timeline lists after it.
  const its = plan.items || [], j = lastAshoreIdx(plan); // lunch back on board comes after the ride back (Round 1: Ketchikan)
  // Everything after the last stop is the way back: its rides and its fixed steps (a cable car's queue down, collecting
  // bags on the way): the latest time to leave the last stop leaves room for all of them (screen check, Nov 22: "leave
  // here by 2:59" printed after bags collected at 3:19, when the real latest was about 4:36).
  let back = 0; for (let k = j + 1; j >= 0 && k < its.length; k++) { const it = its[k]; if (it.type === "travel") back += (it.leg && it.leg.min) || 0;
    else if (it.type === "fixed") back += (it.place && it.place.minutes) || 0; else if (it.type === "end") break; }
  let leaveBy = plan.endBy - back;
  if (fixed && typeof alarmState === "function") { try { const st = alarmState(d, plan); if (st && isFinite(st.leaveBy)) leaveBy = Math.min(leaveBy, st.leaveBy); } catch (e) {} }
  const aa = (d.type === "port" || d.type === "embark") && d.allAboard ? shipToPort(d, d.allAboard) : null;
  return { start: plan.start, endBy: plan.endBy, len: plan.endBy - plan.start, finish: plan.end, left, back, leaveBy, fixed: !!fixed, allAboard: aa, over: !!plan.over };
}
// How the hours read, the same on every screen: "08:00–18:30" and "10 h 30 min".
const dayHoursText = f => `${fmt(f.start)}–${fmt(f.endBy)}`;
// The one line under the head on ship, train and flight days (finding 2): each time once, each with its name.
function fixedLine(d, plan) {
  const f = dayFacts(d, plan); if (!f || !f.fixed) return "";
  const where = d.type === "port" ? "the ship" : d.type === "embark" ? "the cruise terminal" : (fixedPointName(d, plan) || "your " + ((MODES[d.mode] || {}).label || "ride").toLowerCase());
  const parts = [d.type === "port" ? `Ashore ${fmt(f.start)}` : "", f.allAboard != null ? `Official all aboard <b>${fmt(f.allAboard)}</b>` : d.time && d.type === "departure" ? `${esc((MODES[d.mode] || {}).label || "Leaves")} <b>${fmt(toMin(d.time))}</b>` : "", `Back at ${esc(where)} by <b>${fmt(f.endBy)}</b>`].filter(Boolean);
  return `<p class="factline" data-fact="fixed">${parts.join(" · ")}</p>`;
}
function fixedPointName(d, plan) { const T = plan && plan.w && plan.w.tail; const p = T && T[T.length - 1]; return p && p.name ? p.name : ""; }

// ---- The trip: how long it is ----
// A trip is as long as its calendar: Jun 30 to Jul 20 is 21 days, however many day pages it has (a day that moves
// from one city to another has two). Where a narrower count is meant it says so ("19 days ashore").
function tripFacts(t) {
  t = t || trip; const ds = [...new Set((t.days || []).filter(d => d.date).map(d => d.date))].sort();
  const span = ds.length ? Math.round((new Date(ds[ds.length - 1] + "T12:00:00Z") - new Date(ds[0] + "T12:00:00Z")) / 864e5) + 1 : (t.days || []).length;
  const ashore = new Set((t.days || []).filter(d => d.date && !noShore(d)).map(d => d.date));
  return { days: Math.max(1, span), dates: ds, ashore: ashore.size, first: ds[0] || "", last: ds[ds.length - 1] || "" };
}
const tripDaysText = t => { const n = tripFacts(t).days; return n + (n === 1 ? " day" : " days"); };
// The day's number on the calendar: both halves of a moving day are the same day.
function dayNo(d, t) { t = t || trip; const ds = tripFacts(t).dates, k = ds.indexOf(d && d.date); return k >= 0 ? Math.round((new Date(d.date + "T12:00:00Z") - new Date(ds[0] + "T12:00:00Z")) / 864e5) + 1 : (t.days || []).indexOf(d) + 1; }

if (typeof window !== "undefined") window.__kairouteFacts = { day: i => { const d = trip.days[i == null ? trip.active : i], p = d && cityFor(d) && !noShore(d) ? buildPlan(d) : null; return dayFacts(d, p); }, trip: () => tripFacts() };

// The one "back by" time every screen says for a day: with free time on, the time the day is planned back by (the free
// time runs up to the leave-by); else when the plan's last step ends (first-timer walk, Nov 22: the sea day's preview
// said "back by 3:49 pm" for a port day whose own page said 5:45 pm).
function backByOf(d, plan) {
  if (!plan || plan.error) return null;
  const F = dayFacts(d, plan), freeOn = F && F.left >= 30 && !(plan.dropped || []).length && !(plan.w && plan.w.straight);
  return freeOn ? F.endBy : Math.min(plan.end, plan.endBy);
}
