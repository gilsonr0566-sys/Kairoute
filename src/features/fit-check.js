// ---------- "Won't fit" box: picks can never go over the day's time ----------
// Ticking a sight that doesn't fit leaves it unticked and opens a box with the live timing and every way
// to make it fit: untick other picks (each says how much time it frees; "Suggested" only when one pick
// that isn't a must-see is enough), change today's times (start earlier or finish later, on hotel days
// only), or put the sight on another day in the same city where it fits. A day whose picks are already
// over its time (hours changed, an older plan) gets a "Make it fit" button that opens the same box.
// When the day is tied to a ship, train or flight, its times are fixed: the box says so and offers only
// unticking or another day (the ship's 45-minute safety margin is never touched). Every check uses the real
// day plan (route, meals, opening hours), the same one the time meter and the Day plan show.
let fitState = null;
function fitTrial(d, sel, t) {
  const keep = { selected: d.selected, hours: d.hours, startTime: d.startTime };
  d.selected = sel; if (t && t.hours != null) d.hours = t.hours; if (t && t.startTime) d.startTime = t.startTime; forget0(d);
  try { const p = buildPlan(d), m = meterCalc(p, d); return { p, m }; }
  finally { Object.assign(d, keep); forget0(d); }
}
const fitsAll = r => !!(r && r.m && !r.m.over && !r.m.dropped.length);
// Only a hotel day's times are the traveler's to change; arrival, departure, boarding and port days are set
// by the flight, train or ship.
const timesFixed = d => d.type !== "land";
function fixedWhy(d, newSight) {
  const m = MODES[d.mode] || {}, what = (m.label || "ride").toLowerCase().replace("car or bus", "ride");
  const why = d.type === "port" ? `To make sure you're back on board on time (all aboard ${esc(d.allAboard || "")}, with a 45-minute safety margin)`
    : d.type === "embark" ? `To make sure you board your ship on time (all aboard ${esc(d.allAboard || "")})`
    : d.type === "departure" ? `To make sure you catch your ${what}${d.time ? " at " + esc(d.time) : ""}`
    : d.type === "arrival" ? `Today starts when your ${what} gets in${d.time ? " at " + esc(d.time) : ""}, so`
    : "Today's times are fixed, so";
  const sep = d.type === "arrival" || !/^(port|embark|departure)$/.test(d.type) ? " " : ", ";
  return newSight ? `${why}${sep}there's no room for this today. Swap it for one of your picks, or see it on another day.`
    : `${why}${sep}there's no room for all of these picks today. Untick one, or move it to another day.`;
}
// The smallest change to today's times that fits everything: start earlier (same finish), or finish later.
function timeOptions(d, sel) {
  if (timesFixed(d) || !isFinite(+d.hours) || !d.startTime) return [];
  const out = [], st = toMin(d.startTime), h0 = +d.hours;
  for (let x = 30; x <= 240 && st - x >= 6 * 60; x += 30) { const t = { startTime: fmt(st - x), hours: h0 + x / 60 }, r = fitTrial(d, sel, t); if (fitsAll(r)) { out.push(Object.assign({ kind: "earlier", end: r.m.endBy }, t)); break; } }
  for (let h = h0 + 0.5; h <= h0 + 6; h += 0.5) { const r = fitTrial(d, sel, { hours: h }); if (!r.m || r.m.endBy > 23 * 60) break; if (fitsAll(r)) { out.push({ kind: "later", hours: h, end: r.m.endBy }); break; } }
  return out;
}
// Returns true when the sight can simply be ticked; otherwise opens the box and returns false.
function fitAsk(d, id) { return fitOpen(d, id); }
function fitOpen(d, id) {
  const city = cityFor(d); if (!city) return true;
  const s = id ? allSites(city).find(x => x.id === id) : null; if (id && !s) return true;
  const sel0 = (d.selected || []).slice(), target = id ? [...sel0, id] : sel0;
  const base = fitTrial(d, sel0); if (!base.m) return true;
  const full = fitTrial(d, target); if (!full.m || fitsAll(full)) return true;
  let need = 0;
  if (s) { try { need = stopCost(base.p, s).min; } catch (e) {} if (!(need > 0)) need = Math.max(5, full.m.used - base.m.used); }
  const picks = allSites(city).filter(x => sel0.includes(x.id));
  const fitsWithout = ids => fitsAll(fitTrial(d, target.filter(i => !ids.includes(i))));
  const rows = picks.map(x => { const r = fitTrial(d, sel0.filter(i => i !== x.id)); return { x, frees: Math.max(0, base.m.used - (r.m ? r.m.used : base.m.used)), alone: fitsWithout([x.id]) }; });
  const value = x => (x.mustSee ? 100 : 0) + (x.unesco ? 20 : 0) + (fameW(x) || 1) * 5;
  const one = rows.filter(r => r.alone && !r.x.mustSee).sort((a, b) => value(a.x) - value(b.x) || a.frees - b.frees)[0];
  let sugg = one ? [one.x.id] : [];
  const canRoom = picks.length > 0 && fitsWithout(picks.map(x => x.id));
  trip.days.forEach(o => { if (o !== d && !o.selected && o.type !== "sea" && cityFor(o) === city) seedPicks(o, city); });
  const roomOn = (x, o) => o !== d && cityFor(o) === city && !(o.selected || []).includes(x.id) && !closedOn(x, o.date) && fitsAll(fitTrial(o, [...(o.selected || []), x.id]));
  // A new sight: other days where it fits. An over day: other days where each pick that doesn't fit would.
  const others = s ? trip.days.filter(o => roomOn(s, o)).slice(0, 2) : [];
  const moves = s ? [] : (full.m.dropped || []).slice(0, 3).flatMap(x => { const px = picks.find(p => p.id === x.id); return px ? trip.days.filter(o => roomOn(px, o)).slice(0, 2).map(o => ({ x: px, o })) : []; });
  const never = s ? !fitsAll(fitTrial(d, [id])) : false;
  const times = timeOptions(d, target);
  const dayFirst = !!s && others.length > 0 && !sugg.length;
  if (dayFirst) sugg = [];
  rows.sort((a, b) => (sugg.includes(b.x.id) - sugg.includes(a.x.id)) || b.frees - a.frees);
  fitState = { d, id, s, need, never, others, moves, dayFirst, canRoom, base: base.m, rows, sugg, drop: new Set(), times };
  fitShow(); return false;
}
function fitShow() {
  const old = document.querySelector(".fitbox"); if (old) old.remove();
  if (!fitState) return;
  document.body.insertAdjacentHTML("beforeend", `<div class="fitbox" role="dialog" aria-modal="true" aria-labelledby="fitTitle"><div class="sheet" id="fitSheet">${fitHTML()}</div></div>`);
  const b = document.querySelector('.fitbox [data-fitdrop], .fitbox [data-act="fitcancel"]'); if (b) b.focus({ preventScroll: true });
}
function fitHTML() {
  const F = fitState, d = F.d, sel = [...d.selected.filter(i => !F.drop.has(i)), ...(F.id ? [F.id] : [])];
  const r = fitTrial(d, sel), m = r.m, ok = fitsAll(r);
  const freed = F.rows.filter(x => F.drop.has(x.x.id)).reduce((a, x) => a + x.frees, 0);
  // Until it fits, a new sight is counted as the day as planned without it plus its visit and detour.
  let used = m ? m.used : 0;
  if (!ok && F.s) { const wo = fitTrial(d, sel.filter(i => i !== F.id)); let nd = F.need; try { if (wo.p && !wo.p.error) nd = stopCost(wo.p, F.s).min; } catch (e) {} if (wo.m) used = wo.m.used + nd; }
  const avail = m ? m.avail : F.base.avail, over = Math.max(0, used - avail), pct = Math.min(100, Math.round(used / avail * 100));
  const when = d.type === "port" ? "your time ashore" : "today";
  const title = F.s ? `${esc(F.s.name)} doesn't fit ${when} yet` : `Your picks don't all fit ${when}`;
  return `<h3 id="fitTitle">${title}</h3>
    <div class="meter ${ok ? "" : "full"}" role="status" aria-live="polite">
      <div class="mrow"><b>${dur(Math.min(used, 24 * 60))} of ${dur(avail)}</b><span>${fmt(m ? m.start : F.base.start)} to ${fmt(m ? m.endBy : F.base.endBy)}</span></div>
      <div class="mbar"><i style="width:${pct}%"></i></div>
      ${F.s ? `<p class="mparts">${esc(F.s.name)} needs about ${dur(F.need)} with getting there and back on your route.${freed ? ` Unticked so far frees about ${dur(freed)}.` : ""}</p>` : freed ? `<p class="mparts">Unticked so far frees about ${dur(freed)}.</p>` : ""}
      <p>${ok ? `<b>It fits now</b>${avail - used >= 5 ? `, with ${dur(avail - used)} to spare` : ""}.` : `<b>${over ? dur(over) + " over" : "Doesn't fit the route and opening hours"}.</b> ${fitNext(F)}`}</p>
    </div>
    ${timesFixed(d) ? `<p class="fitwhy">${fixedWhy(d, !!F.s)}</p>` : ""}
    ${F.dayFirst ? otherDays("Best: see it on another day and keep today as planned") : ""}
    ${F.rows.length ? `<div class="fitlist"><p class="lbl">${F.canRoom ? "Make room: untick a pick" : "Unticking won't make enough room today"}</p>${F.rows.map(x => `<label class="fitrow"><input type="checkbox" data-fitdrop="${esc(x.x.id)}" ${F.drop.has(x.x.id) ? "" : "checked"}><span class="nm">${esc(x.x.name)}</span><span class="tags">${F.sugg.includes(x.x.id) ? `<span class="tag here">Suggested</span>` : ""}${x.x.mustSee ? `<span class="tag must">Must-see</span>` : ""}<span class="tag">Frees ${x.frees >= 5 ? "about " + dur(x.frees) : "little time"}</span></span></label>`).join("")}</div>` : ""}
    ${F.times.length ? `<div class="fitmore"><p class="lbl">Or change today's times</p><div class="actions">${F.times.map((t, k) => `<button type="button" class="btn ghost small" data-act="fittime" data-k="${k}">${t.kind === "earlier" ? `Start earlier, at ${esc(t.startTime)}` : `Finish later, at ${fmt(t.end)}`}${F.s ? " and add it" : " and keep every pick"}</button>`).join("")}</div></div>`
      : ""}
    ${F.never && !F.times.length ? `<p class="mparts"><b>Even on its own it doesn't fit this day.</b></p>` : ""}
    ${!F.dayFirst ? otherDays("Or see it on another day") : ""}
    ${F.moves.length ? `<div class="fitmore"><p class="lbl">Or move a pick to another day</p><div class="actions">${F.moves.map((v, k) => `<button type="button" class="btn ghost small" data-act="fitmove" data-k="${k}">Move ${esc(v.x.name)} to ${esc(fmtDow(v.o.date))} ${esc(fmtDate(v.o.date))}</button>`).join("")}</div></div>` : ""}
    <div class="row"><button type="button" class="btn ghost" data-act="fitcancel">${F.s ? "Keep my day as is" : "Not now"}</button><button type="button" class="btn" data-act="fitadd" ${ok ? "" : "disabled"}>${F.s ? "Add " + esc(F.s.name) : "Done"}</button></div>`;
}
function fitNext(F) {
  const ways = [F.canRoom ? `untick ${F.drop.size ? "more" : F.sugg.length === 1 ? "the suggested pick" : "picks"} below` : "", F.times.length ? "change today's times" : "", F.others.length ? "see it on another day" : "", F.moves.length ? "move a pick to another day" : ""].filter(Boolean);
  if (!ways.length) return F.s ? "Even with nothing else picked, it can't fit this day." : "Untick picks below until it fits.";
  return (F.canRoom || !F.rows.length ? "" : "Unticking alone can't make enough room. ") + ways.join(", or ").replace(/^./, c => c.toUpperCase()) + ".";
}
function otherDays(label) {
  const F = fitState; if (!F.others.length) return "";
  return `<div class="fitmore"><p class="lbl">${esc(label)}</p><div class="actions">${F.others.map(o => `<button type="button" class="btn ${F.dayFirst ? "" : "ghost "}small" data-act="fitday" data-fitday="${trip.days.indexOf(o)}">Add it to ${esc(fmtDow(o.date))} ${esc(fmtDate(o.date))}</button>`).join("")}</div></div>`;
}
function fitApply(t) {
  const F = fitState; if (!F) return;
  const d = F.d; d.selected = [...d.selected.filter(i => !F.drop.has(i)), ...(F.id ? [F.id] : [])];
  if (t) { if (t.hours != null) d.hours = t.hours; if (t.startTime) d.startTime = t.startTime; }
  if (F.s) { d.anchor = F.id; rememberPick(d, F.s); }
  fitState = null; fitShow(); save(); render(); if (F.s) jumpToAnchor();
}
document.addEventListener("change", e => {
  const t = e.target; if (!t.dataset || !t.dataset.fitdrop || !fitState) return;
  if (t.checked) fitState.drop.delete(t.dataset.fitdrop); else fitState.drop.add(t.dataset.fitdrop);
  const sh = document.getElementById("fitSheet"); if (sh) { const y = sh.scrollTop; sh.innerHTML = fitHTML(); sh.scrollTop = y; const again = sh.querySelector(`[data-fitdrop="${t.dataset.fitdrop}"]`); if (again) again.focus({ preventScroll: true }); }
});
document.addEventListener("click", e => {
  const t0 = e.target.closest && e.target.closest("button");
  if (t0 && t0.dataset.act === "fitfix") { const d = day(); if (fitOpen(d, null)) render(); return; }
  if (fitState && e.target.classList && e.target.classList.contains("fitbox")) { fitState = null; fitShow(); return; }
  const t = t0; if (!t || !fitState) return;
  if (t.dataset.act === "fitcancel") { fitState = null; fitShow(); }
  else if (t.dataset.act === "fitadd" && !t.disabled) fitApply();
  else if (t.dataset.act === "fittime") { const o = fitState.times[+t.dataset.k]; if (o) fitApply(o); }
  else if (t.dataset.act === "fitday") { const o = trip.days[+t.dataset.fitday], id = fitState.id; fitState = null; fitShow(); if (!o) return;
    const c = cityFor(o); if (!o.selected && c) seedPicks(o, c);
    o.selected = [...(o.selected || []), id]; o.anchor = id; rememberPick(o, c && allSites(c).find(x => x.id === id)); trip.active = trip.days.indexOf(o); save(); render(); jumpToAnchor(); }
  else if (t.dataset.act === "fitmove") { const v = fitState.moves[+t.dataset.k]; if (!v) return; const d = fitState.d;
    d.selected = d.selected.filter(i => i !== v.x.id); if (d.anchor === v.x.id) d.anchor = null;
    v.o.selected = [...(v.o.selected || []), v.x.id]; rememberPick(v.o, v.x); fitState = null; save();
    if (fitOpen(d, null)) fitShow(); render(); }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && fitState) { fitState = null; fitShow(); } });

// ---------- What still fits, on the sights list ----------
// Every sight not yet picked is checked against the real plan: would the day, with it added, still fit
// (route, travel, meals, opening hours)? The answers are kept until anything about the day changes, so the
// list recalculates after every tick or untick. A sight clearly too long for the time left is known at once;
// the rest are checked in small batches right after the list draws, and their cards update in place.
let sitesCtx = null, fitMemo = { key: "", res: new Map() }, fitQueue = [], fitTimer = 0;
const fitKey = d => { try { return JSON.stringify([trip.days.indexOf(d), d, trip.lodging, trip.prefs, trip.style]); } catch (e) { return String(Math.random()); } };
function fitCostOf(plan, s) { try { const c = stopCost(plan, s); return { min: c.min, spare: Math.max(0, c.spare) }; } catch (e) { return { min: s.minutes || 45, spare: 0 }; } }
function timeLeft(plan, d) { const m = meterCalc(plan, d); return m ? { left: Math.max(0, m.avail - m.used), m } : null; }
function siteFits(d, s, plan) {
  const k = fitKey(d); if (fitMemo.key !== k) { fitMemo = { key: k, res: new Map() }; fitQueue = []; }
  if (fitMemo.res.has(s.id)) return fitMemo.res.get(s.id);
  const m = meterCalc(plan, d); if (m && (m.over || m.dropped.length)) { fitMemo.res.set(s.id, false); return false; } // already full: nothing more fits
  const c = fitCostOf(plan, s);
  if (c.min > c.spare + 90) { fitMemo.res.set(s.id, false); return false; } // far more than the time left
  if (!fitQueue.includes(s.id)) fitQueue.push(s.id);
  clearTimeout(fitTimer); fitTimer = setTimeout(fitRefine, 30);
  return undefined;
}
function fitRefine() {
  const ctx = sitesCtx; if (!ctx || view !== "sites" || fitState) return;
  const d = ctx.d; if (d !== day() || fitMemo.key !== fitKey(d)) return;
  const city = cityFor(d); if (!city) return;
  const batch = fitQueue.splice(0, 3);
  for (const id of batch) {
    if (fitMemo.res.has(id)) continue;
    const ok = fitsAll(fitTrial(d, [...d.selected, id])); fitMemo.res.set(id, ok);
    const el = document.querySelector(`#view [data-card="${CSS.escape(id)}"]`), s = allSites(city).find(x => x.id === id);
    if (el && s && !d.selected.includes(id)) el.outerHTML = siteCard(s, d, ctx.plan, ctx.near);
  }
  if (fitQueue.length) fitTimer = setTimeout(fitRefine, 0);
}
if (typeof window !== "undefined") window.__kairouteFitPending = () => fitQueue.length;
if (typeof window !== "undefined") window.__kairouteFitExact = id => { const d = day(); return fitsAll(fitTrial(d, [...d.selected, id])); };
if (typeof window !== "undefined") window.__kairouteTimesFixed = () => timesFixed(day());
