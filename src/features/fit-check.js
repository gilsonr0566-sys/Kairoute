// ---------- "Won't fit" box on the sights list ----------
// Ticking a sight that doesn't fit the day's time leaves it unticked and opens a box that shows the timing
// and what would have to change: which of the day's picks to untick (each one says how much time it frees,
// with the smallest change that works marked "Suggested"), or how much longer the day would need to be when
// its length is the traveler's choice. The timing updates live as boxes are unticked, and "Add" turns on
// once the sight fits. Every check uses the real day plan (route, meals, opening hours), the same one the
// time meter and the Day plan show.
let fitState = null;
function fitTrial(d, sel, hours) {
  const keepSel = d.selected, keepH = d.hours;
  d.selected = sel; if (hours != null) d.hours = hours; forget0(d);
  try { const p = buildPlan(d), m = meterCalc(p, d); return { p, m }; }
  finally { d.selected = keepSel; d.hours = keepH; forget0(d); }
}
const fitOk = (r, before) => !!(r.m && !r.m.over && !r.m.dropped.some(x => !(before.dropped || []).some(y => y.id === x.id)));
// Returns true when the sight can simply be ticked; otherwise opens the box and returns false.
function fitAsk(d, id) {
  const city = cityFor(d); if (!city) return true;
  const s = allSites(city).find(x => x.id === id); if (!s) return true;
  const base = fitTrial(d, d.selected.slice()); if (!base.m) return true;
  const withIt = fitTrial(d, [...d.selected, id]); if (!withIt.m || fitOk(withIt, base.m)) return true;
  // Already over before this pick: only ask when this pick adds to it.
  if (base.m.over && withIt.m.over && !withIt.m.dropped.length) return true;
  // What the sight costs: its visit plus the detour from the day's route (the same figure its card shows).
  let need = 0; try { need = stopCost(base.p, s).min; } catch (e) {}
  if (!(need > 0)) need = Math.max(5, withIt.m.used - base.m.used);
  const picks = allSites(city).filter(x => d.selected.includes(x.id));
  const fitsWithout = ids => fitOk(fitTrial(d, [...d.selected.filter(i => !ids.includes(i)), id]), base.m);
  const rows = picks.map(x => { const r = fitTrial(d, d.selected.filter(i => i !== x.id)); return { x, frees: Math.max(0, base.m.used - (r.m ? r.m.used : base.m.used)), alone: fitsWithout([x.id]) }; });
  // Suggested: the least important single pick that makes room (never a must-see while anything else would
  // do); otherwise the fewest other picks that add up to enough time.
  const value = x => (x.mustSee ? 100 : 0) + (x.unesco ? 20 : 0) + (fameW(x) || 1) * 5;
  const byValue = (a, b) => value(a.x) - value(b.x) || a.frees - b.frees;
  let sugg = [];
  const oneOther = rows.filter(r => r.alone && !r.x.mustSee).sort(byValue)[0];
  if (oneOther) sugg = [oneOther.x.id];
  else {
    const pool = rows.filter(r => !r.x.mustSee).sort((a, b) => b.frees - a.frees);
    for (const r of pool) { sugg.push(r.x.id); if (fitsWithout(sugg)) break; }
    if (!sugg.length || !fitsWithout(sugg)) { const one = rows.filter(r => r.alone).sort(byValue)[0]; sugg = one ? [one.x.id] : []; }
  }
  // Another day in the same city where it fits as things stand.
  const others = trip.days.filter(o => o !== d && cityFor(o) === city && !(o.selected || []).includes(id) && !closedOn(s, o.date)).filter(o => {
    const b = fitTrial(o, (o.selected || []).slice()); if (!b.m) return false; return fitOk(fitTrial(o, [...(o.selected || []), id]), b.m); }).slice(0, 2);
  const never = !fitOk(fitTrial(d, [id]), base.m);
  // Famous sights aren't dropped for a lesser plan: when the only way to make room is a must-see and
  // another day has room, that day is the suggestion.
  const dayFirst = others.length > 0 && (!sugg.length || sugg.every(i => (picks.find(x => x.id === i) || {}).mustSee));
  if (dayFirst) sugg = [];
  rows.sort((a, b) => (sugg.includes(b.x.id) - sugg.includes(a.x.id)) || b.frees - a.frees);
  // More time: only where the day's length is the traveler's choice (hotel days and arrival days).
  let more = null;
  if ((d.type === "land" || d.type === "arrival") && isFinite(d.hours)) {
    for (let h = d.hours + 0.5; h <= d.hours + 8; h += 0.5) { const r = fitTrial(d, [...d.selected, id], h); if (!r.m) break; if (r.m.endBy <= base.m.endBy) break; if (fitOk(r, base.m)) { more = { h, endBy: r.m.endBy }; break; } }
  }
  const why = d.type === "port" ? `the ship's all-aboard time (${esc(d.allAboard || "")}) sets the end of the day` : d.type === "embark" ? "boarding time sets the end of the day" : d.type === "departure" ? "your departure time sets the end of the day" : "the day can't run any later";
  fitState = { d, id, s, need, never, others, dayFirst, base: base.m, rows, sugg, drop: new Set(), more, why };
  fitShow(); return false;
}
function fitShow() {
  const old = document.querySelector(".fitbox"); if (old) old.remove();
  if (!fitState) return;
  document.body.insertAdjacentHTML("beforeend", `<div class="fitbox" role="dialog" aria-modal="true" aria-labelledby="fitTitle"><div class="sheet" id="fitSheet">${fitHTML()}</div></div>`);
  const b = document.querySelector('.fitbox [data-fitdrop], .fitbox [data-act="fitcancel"]'); if (b) b.focus({ preventScroll: true });
}
function fitHTML() {
  const F = fitState, d = F.d, sel = [...d.selected.filter(i => !F.drop.has(i)), F.id];
  const r = fitTrial(d, sel), m = r.m, ok = fitOk(r, F.base);
  const freed = F.rows.filter(x => F.drop.has(x.x.id)).reduce((a, x) => a + x.frees, 0);
  // Until it fits, the meter shows the day as it would be with the sight in it (its visit and detour).
  const avail = m ? m.avail : F.base.avail, used = ok ? m.used : Math.max(m ? m.used : 0, F.base.used - freed + F.need), over = Math.max(0, used - avail), pct = Math.min(100, Math.round(used / avail * 100));
  return `<h3 id="fitTitle">${esc(F.s.name)} doesn't fit ${F.d.type === "port" ? "your time ashore" : "today"} yet</h3>
    <div class="meter ${ok ? "" : "full"}" role="status" aria-live="polite">
      <div class="mrow"><b>${dur(Math.min(used, 24 * 60))} of ${dur(avail)}</b><span>${fmt(m ? m.start : F.base.start)} to ${fmt(m ? m.endBy : F.base.endBy)}</span></div>
      <div class="mbar"><i style="width:${pct}%"></i></div>
      <p class="mparts">${esc(F.s.name)} needs about ${dur(F.need)} with getting there and back on your route.${freed ? ` Unticked so far frees about ${dur(freed)}.` : ""}</p>
      <p>${ok ? `<b>It fits now</b>${avail - used >= 5 ? `, with ${dur(avail - used)} to spare` : ""}.` : over ? `<b>${dur(over)} over.</b> ${F.rows.length ? `Untick ${F.drop.size ? "more" : "something"} below${F.more ? " or give the day more time" : ""}.` : F.more ? "Give the day more time below." : ""}` : `<b>Still doesn't fit</b> the route and opening hours. Untick ${F.drop.size ? "more" : "something"} below.`}</p>
    </div>
    ${F.dayFirst ? otherDays("Best: see it on another day, and keep today's must-sees") : ""}
    ${F.rows.length ? `<div class="fitlist"><p class="lbl">Make room: untick a pick</p>${F.rows.map(x => `<label class="fitrow"><input type="checkbox" data-fitdrop="${esc(x.x.id)}" ${F.drop.has(x.x.id) ? "" : "checked"}><span class="nm">${esc(x.x.name)}</span><span class="tags">${F.sugg.includes(x.x.id) ? `<span class="tag here">Suggested</span>` : ""}${x.x.mustSee ? `<span class="tag must">Must-see</span>` : ""}<span class="tag">Frees ${x.frees >= 5 ? "about " + dur(x.frees) : "little time"}</span></span></label>`).join("")}</div>` : ""}
    ${F.more ? `<div class="fitmore"><p class="lbl">Or give the day more time</p><button type="button" class="btn ghost small" data-act="fitmore">Add ${dur((F.more.h - F.d.hours) * 60)} to the day (until ${fmt(F.more.endBy)}) and add it</button></div>` : `<p class="mparts">More time isn't an option here: ${F.why}.</p>`}
    ${F.never && !F.more ? `<p class="mparts"><b>Even on its own it doesn't fit this day</b>${F.d.type === "port" ? " in your time ashore" : ""}.</p>` : ""}
    ${!F.dayFirst ? otherDays("Or see it on another day") : ""}
    <div class="row"><button type="button" class="btn ghost" data-act="fitcancel">Keep my day as is</button><button type="button" class="btn" data-act="fitadd" ${ok ? "" : "disabled"}>Add ${esc(F.s.name)}</button></div>`;
}
function otherDays(label) {
  const F = fitState; if (!F.others.length) return "";
  return `<div class="fitmore"><p class="lbl">${esc(label)}</p><div class="actions">${F.others.map(o => `<button type="button" class="btn ${F.dayFirst ? "" : "ghost "}small" data-act="fitday" data-fitday="${trip.days.indexOf(o)}">Add it to ${esc(fmtDow(o.date))} ${esc(fmtDate(o.date))}</button>`).join("")}</div></div>`;
}
function fitApply(hours) {
  const F = fitState; if (!F) return;
  const d = F.d; d.selected = [...d.selected.filter(i => !F.drop.has(i)), F.id]; if (hours != null) d.hours = hours;
  d.anchor = F.id; fitState = null; fitShow(); save(); render(); jumpToAnchor();
}
document.addEventListener("change", e => {
  const t = e.target; if (!t.dataset || !t.dataset.fitdrop || !fitState) return;
  if (t.checked) fitState.drop.delete(t.dataset.fitdrop); else fitState.drop.add(t.dataset.fitdrop);
  const sh = document.getElementById("fitSheet"); if (sh) { const y = sh.scrollTop; sh.innerHTML = fitHTML(); sh.scrollTop = y; const again = sh.querySelector(`[data-fitdrop="${t.dataset.fitdrop}"]`); if (again) again.focus({ preventScroll: true }); }
});
document.addEventListener("click", e => {
  if (fitState && e.target.classList && e.target.classList.contains("fitbox")) { fitState = null; fitShow(); return; }
  const t = e.target.closest && e.target.closest("button"); if (!t || !fitState) return;
  if (t.dataset.act === "fitcancel") { fitState = null; fitShow(); }
  else if (t.dataset.act === "fitadd" && !t.disabled) fitApply();
  else if (t.dataset.act === "fitmore" && fitState.more) fitApply(fitState.more.h);
  else if (t.dataset.act === "fitday") { const o = trip.days[+t.dataset.fitday], id = fitState.id; fitState = null; fitShow(); if (!o) return;
    o.selected = [...(o.selected || []), id]; o.anchor = id; trip.active = trip.days.indexOf(o); save(); render(); jumpToAnchor(); }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && fitState) { fitState = null; fitShow(); } });
