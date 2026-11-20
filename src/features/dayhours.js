// ---------- Pick the day's hours on the Day plan (Richard, Nov 16) ----------
// The time tile at the top of the Day plan ("09:30–18:30, 8 h sightseeing") opens a start and an end time, so the
// traveler sets the real hours in a couple of taps. Light / Half / Full stay as quick presets. The times stay inside
// the day's real limits: an arrival day starts once you're in and have dropped your bags (set by the flight, train or
// ship), and every day ends by the latest the planner allows. A change that would take picks off asks first, with the
// same "Keep my hours" / "Shorten anyway" notice as Light / Half / Full (settlePicks, timeSnap).
let hrsOpenDay = null; // the day whose hours editor is open (stays open while the plan re-times)

const HRS_MIN = 1, HRS_MAX = 14;
// Sightseeing hours from `from` that end by `end`: the day's window adds a lunch break when it spans midday
// (lunchIn), so the hours are the largest quarter hour whose window still ends by `end`.
function hoursBetween(from, end) {
  let best = 0;
  for (let q = HRS_MIN * 4; q <= HRS_MAX * 4; q++) if (lunchIn(from, q / 4) <= end) best = q / 4;
  return best;
}
// The limits for the day's times, from the same rules dayWindow uses.
function hoursLimits(d, plan) {
  const w = plan && plan.w; if (!w) return null;
  if (d.type === "land") return { startFixed: false, start: toMin(d.startTime), from: toMin(d.startTime), minStart: 5 * 60, maxEnd: 23 * 60 + 30 };
  if (d.type === "arrival") { const from = w.sightFrom != null ? w.sightFrom : w.start; return { startFixed: true, start: w.start, from, minStart: from, maxEnd: 23 * 60 }; }
  return null;
}
const latestEnd = lim => Math.min(lim.maxEnd, lunchIn(lim.from, HRS_MAX));
// Hours shown on the tile: what the day really has (an arrival day that lands late is cut at the end of the evening).
function sightHours(d, plan) {
  const lim = hoursLimits(d, plan); if (!lim) return d.hours;
  const real = hoursBetween(lim.from, plan.endBy);
  return real ? Math.min(+d.hours, real) : +d.hours;
}
function hoursTileHTML(d, plan, text) {
  const open = hrsOpenDay === d;
  return `<button type="button" class="hrstile" data-act="hrsopen" aria-expanded="${open}" aria-controls="hrsEdit" aria-label="Today's hours ${fmt(plan.start)} to ${fmt(plan.endBy)}, ${esc(text)}. Change the hours">
    <b>${fmt(plan.start)}–${fmt(plan.endBy)}</b><span>${esc(text)} <i class="hrspen" aria-hidden="true">✎</i></span></button>`;
}
function hoursEditHTML(d, plan) {
  if (hrsOpenDay !== d) return "";
  const lim = hoursLimits(d, plan); if (!lim) return "";
  const startF = lim.startFixed
    ? `<div class="field hrsfix"><span class="lbl">Start</span><b>${fmt(lim.from)}</b><small>${esc(`After ${({ flight: "your flight lands", train: "your train gets in", ship: "you're off the ship", ferry: "your ferry gets in", car: "you arrive" })[d.mode] || "you arrive"} and you've dropped your bags`)}</small></div>`
    : `<div class="field"><label for="hrsStart">Start</label><input type="time" id="hrsStart" step="900" min="${fmt(lim.minStart)}" max="22:00" value="${esc(d.startTime)}"></div>`;
  return `<div class="hrsedit card" id="hrsEdit" role="group" aria-label="Today's hours">
    ${startF}
    <div class="field"><label for="hrsEnd">End</label><input type="time" id="hrsEnd" step="900" min="${fmt(lim.from + 60)}" max="${fmt(latestEnd(lim))}" value="${fmt(plan.endBy)}"><small>Latest ${fmt(latestEnd(lim))}</small></div>
    <div class="field hrsquick"><span class="lbl">Or a quick length</span><div class="seg pace daylen" role="group" aria-label="How long to sightsee today">${DAY_LEN.map(([h, l, sub]) => `<button type="button" data-act="daylen" data-h="${h}" aria-pressed="${+d.hours === h}" title="${esc(l)}: ${esc(sub)} of sightseeing">${esc(l.replace(/ day$/, ""))} <small>${sub}</small></button>`).join("")}</div></div>
    <button type="button" class="btn small" data-act="hrsdone">Done</button>
  </div>`;
}
// Applies a new start or end time. Clamped to the limits; the plan re-times, and picks that would drop are asked about.
function setDayHours(d, startStr, endStr) {
  const plan = buildPlan(d); if (!plan || plan.error) return false;
  const lim = hoursLimits(d, plan); if (!lim) return false;
  let s = lim.startFixed ? lim.from : toMin(startStr || d.startTime);
  if (!isFinite(s)) s = lim.from;
  s = Math.max(lim.minStart, Math.min(22 * 60, s));
  // The end the traveler had stays put when only the start moves (later start = shorter day, earlier = longer).
  let e = endStr ? toMin(endStr) : plan.endBy;
  if (!isFinite(e)) e = plan.endBy;
  e = Math.max(s + 60, Math.min(lim.maxEnd, e));
  const h = Math.max(HRS_MIN, hoursBetween(s, e));
  snapTimes(d);
  if (!lim.startFixed) d.startTime = fmt(s);
  d.hours = h;
  return true;
}
if (typeof document !== "undefined") {
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-act]"); if (!t) return;
    if (t.dataset.act === "hrsopen") { const d = day(); hrsOpenDay = hrsOpenDay === d ? null : d; render(); const f = document.getElementById(hrsOpenDay ? "hrsEdit" : "x"); if (f) { const i = f.querySelector("input"); if (i) i.focus({ preventScroll: true }); } }
    else if (t.dataset.act === "hrsdone") { hrsOpenDay = null; render(); const b = document.querySelector('[data-act="hrsopen"]'); if (b) b.focus({ preventScroll: true }); }
  });
  document.addEventListener("change", e => {
    const t = e.target; if (!t || (t.id !== "hrsStart" && t.id !== "hrsEnd")) return;
    const d = day(), s = document.getElementById("hrsStart"), en = document.getElementById("hrsEnd");
    if (!t.value) return;
    if (setDayHours(d, s ? s.value : null, t.id === "hrsEnd" ? en.value : null)) { save(); render(); const back = document.getElementById(t.id); if (back) back.focus({ preventScroll: true }); }
  });
  window.__kairouteDayHours = { set: (s, e) => { const d = day(); const ok = setDayHours(d, s, e); if (ok) { save(); render(); } return ok; }, get: () => { const d = day(), p = buildPlan(d); return p && !p.error ? { start: fmt(p.start), end: fmt(p.endBy), hours: d.hours, shown: sightHours(d, p) } : null; } };
}
