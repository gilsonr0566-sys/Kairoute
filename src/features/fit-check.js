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
const fitsAll = r => !!(r && r.m && !r.m.over && !r.m.dropped.length && !((r.p && r.p.closedToday) || []).length); // a pick the day can't visit (closed) never "fits"
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
// The one gate every way of adding a stop goes through (ticking, the guide's optional stops, finding a
// place by name, a must-see found later, a day's starting picks): a stop is added only if the day, with it,
// still fits. With ask, a stop that doesn't fit opens the box; without, it is simply not added.
function fitAsk(d, id) { return fitOpen(d, id); }
function fitsWith(d, ids) { return fitsAll(fitTrial(d, [...new Set([...(d.selected || []), ...ids])])); }
const shutOn = (d, x) => { const c = cityFor(d); let w = null; try { w = c ? dayWindow(d, c) : null; } catch (e) {} return closedForDay(x, d, w); };
function addPick(d, id, ask) {
  const city = cityFor(d); if (!city) return false;
  d.selected = d.selected || []; if (d.selected.includes(id)) return true;
  // Closed that day (or open only outside the day's time here): never added; the box offers a day it's open.
  const sx = allSites(city).find(x => x.id === id); if (sx && shutOn(d, sx)) { if (ask) closedOpen(d, sx); return false; }
  if (!fitsWith(d, [id])) { if (ask) fitOpen(d, id); return false; }
  d.selected = [...d.selected, id]; rememberPick(d, allSites(city).find(x => x.id === id)); return true;
}
// Starting picks the app chose (never the traveler's own): trimmed, least important first, until the day fits.
function fitTrim(d, keep) {
  const city = cityFor(d); if (!city || !Array.isArray(d.selected) || !d.selected.length) return;
  const value = x => (x.mustSee ? 100 : 0) + (x.unesco ? 20 : 0) + (fameW(x) || 1) * 5;
  d.selected = d.selected.filter(id => { const x = allSites(city).find(y => y.id === id); return !x || (keep || []).includes(id) || !shutOn(d, x); }); // closed that day: never one of the app's picks
  for (let g = 0; g < 12 && d.selected.length && !fitsAll(fitTrial(d, d.selected)); g++) {
    const cand = allSites(city).filter(x => d.selected.includes(x.id) && !(keep || []).includes(x.id)).sort((a, b) => value(a) - value(b))[0];
    if (!cand) break; d.selected = d.selected.filter(i => i !== cand.id);
  }
}
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
  trip.days.forEach(o => { if (o !== d && !o.selected && !noShore(o) && cityFor(o) === city) seedPicks(o, city); });
  const roomOn = (x, o) => o !== d && cityFor(o) === city && !(o.selected || []).includes(x.id) && !shutOn(o, x) && fitsAll(fitTrial(o, [...(o.selected || []), x.id]));
  // A new sight: other days where it fits. An over day: other days where each pick that doesn't fit would.
  const others = s ? trip.days.filter(o => roomOn(s, o)).slice(0, 2) : [];
  const moves = s ? [] : (full.m.dropped || []).slice(0, 3).flatMap(x => { const px = picks.find(p => p.id === x.id); return px ? trip.days.filter(o => roomOn(px, o)).slice(0, 2).map(o => ({ x: px, o })) : []; });
  const never = s ? !fitsAll(fitTrial(d, [id])) : false;
  const times = timeOptions(d, target);
  const dayFirst = !!s && others.length > 0 && !sugg.length;
  if (dayFirst) sugg = [];
  rows.sort((a, b) => (sugg.includes(b.x.id) - sugg.includes(a.x.id)) || b.frees - a.frees);
  // Ready-made fixes the traveler accepts with one tap: the app does the arithmetic.
  const endOf = r => r && r.p && !r.p.error ? r.p.end : null;
  const fixes = [];
  const swapSet = ids => { const r = fitTrial(d, target.filter(i => !ids.includes(i))); return fitsAll(r) ? { kind: "swap", drop: ids, end: endOf(r) } : null; };
  const byVal = rows.slice().sort((a, b) => value(a.x) - value(b.x) || a.frees - b.frees);
  for (const r of byVal.filter(r => r.alone)) { const f = swapSet([r.x.id]); if (f) { f.must = r.x.mustSee; fixes.push(f); } if (fixes.length >= 2) break; }
  // Two picks at most: a bigger swap rebuilds the day, and another day or new times serve better.
  if (!fixes.length && canRoom) { const ids = []; for (const r of byVal.slice(0, 2)) { ids.push(r.x.id); const f = swapSet(ids); if (f) { f.must = ids.some(i => (picks.find(x => x.id === i) || {}).mustSee); fixes.push(f); break; } } }
  times.forEach(t => fixes.push(Object.assign({}, t, { how: t.kind, kind: "time" })));
  others.forEach(o => fixes.push({ kind: "day", o }));
  moves.forEach(v => fixes.push({ kind: "move", x: v.x, o: v.o }));
  // A swap that costs a must-see comes after other ways (a new time or another day), never first.
  const rank = f => f.kind === "swap" ? (f.must ? 3 : 0) : f.kind === "time" ? 1 : 2;
  fixes.sort((a, b) => rank(a) - rank(b));
  fitState = { fixes, d, id, s, need, never, others, moves, dayFirst, canRoom, base: base.m, rows, sugg, drop: new Set(), times };
  fitShow(); return false;
}
// A sight closed on the day the traveler tried to add it to: say why, and offer, in one tap, a day of the trip here
// when it's open and fits, or the best sight that is open today and fits instead.
function closedOpen(d, s) {
  const city = cityFor(d); if (!city) return;
  trip.days.forEach(o => { if (o !== d && !o.selected && !noShore(o) && cityFor(o) === city) seedPicks(o, city); });
  const others = trip.days.filter(o => o !== d && cityFor(o) === city && !noShore(o) && !(o.selected || []).includes(s.id) && !shutOn(o, s) && fitsAll(fitTrial(o, [...(o.selected || []), s.id]))).slice(0, 2);
  const taken = new Set(trip.days.filter(o => cityFor(o) === city).flatMap(o => o.selected || []));
  const alt = allSites(city).filter(x => !x.quick && x.id !== s.id && !taken.has(x.id) && religiousOk(x) && !shutOn(d, x) && (s.kind ? x.kind === s.kind : true))
    .sort((a, b) => (fameW(b) || 1) - (fameW(a) || 1) || hav(a, s) - hav(b, s)).find(x => fitsWith(d, [x.id]));
  let w = null; try { w = dayWindow(d, city); } catch (e) {}
  closedState = { d, s, others, alt, why: closedForDayWhy(s, d, w) };
  const old = document.querySelector(".fitbox"); if (old) old.remove();
  document.body.insertAdjacentHTML("beforeend", `<div class="fitbox" role="dialog" aria-modal="true" aria-labelledby="fitTitle"><div class="sheet" id="fitSheet">
    <h3 id="fitTitle">${esc(s.name)} is closed on ${esc(fmtDow(d.date))}</h3>
    <p>${closedState.why ? esc(closedState.why.replace(/\.$/, "")) + ". " : ""}Kairoute never plans a sight for a day it can't be visited.</p>
    ${others.length || alt ? `<div class="fitfixes"><p class="lbl">One tap</p>${others.map((o, k) => `<button type="button" class="btn ${k ? "ghost " : ""}fixbtn" data-act="closedday" data-to="${trip.days.indexOf(o)}">Add it to ${esc(fmtDow(o.date))} ${esc(fmtDate(o.date))}, when it's open</button>`).join("")}${alt ? `<button type="button" class="btn ${others.length ? "ghost " : ""}fixbtn" data-act="closedalt">Add ${esc(alt.name)} today instead (open today)</button>` : ""}</div>` : `<p class="mparts"><b>It isn't open on any day you're here.</b></p>`}
    <div class="row"><button type="button" class="btn ghost" data-act="fitcancel">Keep my day as is</button></div></div></div>`);
  const b = document.querySelector('.fitbox [data-act="closedday"], .fitbox [data-act="closedalt"], .fitbox [data-act="fitcancel"]'); if (b) b.focus({ preventScroll: true });
}
let closedState = null;
function closedGo(kind, to) {
  const C = closedState; closedState = null; const old = document.querySelector(".fitbox"); if (old) old.remove(); if (!C) return;
  if (kind === "day") { const o = trip.days[to]; if (o && addPick(o, C.s.id, false)) { o.anchor = C.s.id; trip.active = to; } }
  else if (kind === "alt" && C.alt && addPick(C.d, C.alt.id, false)) C.d.anchor = C.alt.id;
  save(); render(); if (typeof jumpToAnchor === "function") jumpToAnchor();
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
    ${F.fixes.length ? `<div class="fitfixes"><p class="lbl">${F.s ? "Ways to fit it in, one tap" : "Ways to make it fit, one tap"}</p>${F.fixes.map((f, k) => `<button type="button" class="btn ${k ? "ghost " : ""}fixbtn" data-act="fitfixgo" data-k="${k}">${fixLabel(F, f)}</button>`).join("")}</div>`
      : `<p class="mparts"><b>${F.s ? "There's no way to fit it into this day." : "Untick picks below until it fits."}</b></p>`}
    ${F.rows.length ? `<details class="fitown"${F.drop.size ? " open" : ""}><summary>Or choose what to untick yourself</summary><div class="fitlist">${F.rows.map(x => `<label class="fitrow"><input type="checkbox" data-fitdrop="${esc(x.x.id)}" ${F.drop.has(x.x.id) ? "" : "checked"}><span class="nm">${esc(x.x.name)}</span><span class="tags">${x.x.mustSee ? `<span class="tag must">Must-see</span>` : ""}<span class="tag">Frees ${x.frees >= 5 ? "about " + dur(x.frees) : "little time"}</span></span></label>`).join("")}</div></details>` : ""}
    <div class="row"><button type="button" class="btn ghost" data-act="fitcancel">${F.s ? "Keep my day as is" : "Not now"}</button><button type="button" class="btn" data-act="fitadd" ${ok ? "" : "disabled"}>${F.s ? "Add " + esc(F.s.name) : "Done"}</button></div>`;
}
function endWord(d) { return d.type === "port" || d.type === "embark" ? "back on board" : d.type === "departure" ? "at the " + ((MODES[d.mode] || {}).word || "station") : "finish"; }
function fixLabel(F, f) {
  const d = F.d, nm = id => esc((allSites(cityFor(d)).find(x => x.id === id) || {}).name || "");
  const at = f.end != null ? ` · ${endWord(d)} ${fmt(f.end)}` : "";
  if (f.kind === "swap") return F.s ? `Swap ${f.drop.map(nm).join(" and ")} for ${esc(F.s.name)}${at}` : `Leave out ${f.drop.map(nm).join(" and ")}${at}`;
  if (f.kind === "time") return `${f.how === "earlier" ? `Start at ${esc(f.startTime)} instead of ${esc(d.startTime)}` : `Finish at ${fmt(f.end)} instead of ${fmt(F.base.endBy)}`}${F.s ? ", and add it" : ", and keep every pick"}`;
  if (f.kind === "day") return `Add it to ${esc(fmtDow(f.o.date))} ${esc(fmtDate(f.o.date))} instead`;
  if (f.kind === "move") return `Move ${esc(f.x.name)} to ${esc(fmtDow(f.o.date))} ${esc(fmtDate(f.o.date))}`;
  return "";
}
function fitNext(F) {
  if (F.fixes.length) return "Pick one of the ways below and Kairoute rearranges your day.";
  return F.s ? "Even with nothing else picked, it can't fit this day." : "Untick picks below until it fits.";
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
function fitDay(o) {
  const id = fitState && fitState.id; fitState = null; fitShow(); if (!o || !id) return;
  const c = cityFor(o); if (!o.selected && c) seedPicks(o, c);
  if (addPick(o, id, false)) { o.anchor = id; trip.active = trip.days.indexOf(o); save(); render(); jumpToAnchor(); }
}
function fitMove(v) {
  if (!v || !fitState) return; const d = fitState.d;
  if (!addPick(v.o, v.x.id, false)) return;
  d.selected = d.selected.filter(i => i !== v.x.id); if (d.anchor === v.x.id) d.anchor = null;
  fitState = null; save(); fitOpen(d, null); fitShow(); render();
}
document.addEventListener("change", e => {
  const t = e.target; if (!t.dataset || !t.dataset.fitdrop || !fitState) return;
  if (t.checked) fitState.drop.delete(t.dataset.fitdrop); else fitState.drop.add(t.dataset.fitdrop);
  const sh = document.getElementById("fitSheet"); if (sh) { const y = sh.scrollTop; sh.innerHTML = fitHTML(); sh.scrollTop = y; const again = sh.querySelector(`[data-fitdrop="${t.dataset.fitdrop}"]`); if (again) again.focus({ preventScroll: true }); }
});
document.addEventListener("click", e => {
  const t0 = e.target.closest && e.target.closest("button");
  if (t0 && t0.dataset.act === "fitfix") { const d = day(); if (fitOpen(d, null)) render(); return; }
  if (closedState) { if (t0 && t0.dataset.act === "closedday") { closedGo("day", +t0.dataset.to); return; } if (t0 && t0.dataset.act === "closedalt") { closedGo("alt"); return; }
    if ((t0 && t0.dataset.act === "fitcancel") || (e.target.classList && e.target.classList.contains("fitbox"))) { closedState = null; const old = document.querySelector(".fitbox"); if (old) old.remove(); return; } }
  if (fitState && e.target.classList && e.target.classList.contains("fitbox")) { fitState = null; fitShow(); return; }
  const t = t0; if (!t || !fitState) return;
  if (t.dataset.act === "fitcancel") { fitState = null; fitShow(); }
  else if (t.dataset.act === "fitadd" && !t.disabled) fitApply();
  else if (t.dataset.act === "fitfixgo") { const f = fitState.fixes[+t.dataset.k]; if (!f) return;
    if (f.kind === "swap") { fitState.drop = new Set(f.drop); fitApply(); }
    else if (f.kind === "time") fitApply(f);
    else if (f.kind === "day") { t.dataset.act = "fitday"; t.dataset.fitday = trip.days.indexOf(f.o); fitDay(f.o); }
    else if (f.kind === "move") fitMove(f); }
  else if (t.dataset.act === "fittime") { const o = fitState.times[+t.dataset.k]; if (o) fitApply(o); }
  else if (t.dataset.act === "fitday") fitDay(trip.days[+t.dataset.fitday]);
  else if (t.dataset.act === "fitmove") fitMove(fitState.moves[+t.dataset.k]);
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
  if (!fitQueue.includes(s.id)) fitQueue.push(s.id);
  clearTimeout(fitTimer); fitTimer = setTimeout(fitRefine, 30);
  return undefined;
}
function fitRefine() {
  const ctx = sitesCtx; if (!ctx || view !== "sites" || fitState) return;
  const d = ctx.d; if (d !== day() || fitMemo.key !== fitKey(d)) return;
  const city = cityFor(d); if (!city) return;
  // Speed: these checks run between taps, never in their way. Each round does at most about 10 ms of checks (always
  // at least one), stops early when the traveler is touching the screen, then lets the browser respond first.
  const t0 = performance.now(), pend = () => { try { return !!(navigator.scheduling && navigator.scheduling.isInputPending && navigator.scheduling.isInputPending()); } catch (e) { return false; } };
  while (fitQueue.length) {
    if (performance.now() - t0 > 10 || (performance.now() > t0 && pend())) break;
    const id = fitQueue.shift();
    if (fitMemo.res.has(id)) continue;
    const ok = fitsAll(fitTrial(d, [...d.selected, id])); fitMemo.res.set(id, ok);
    const el = document.querySelector(`#view [data-card="${CSS.escape(id)}"]`), s = allSites(city).find(x => x.id === id);
    if (el && s && !d.selected.includes(id)) el.outerHTML = siteCard(s, d, ctx.plan, ctx.near);
  }
  if (fitQueue.length) fitTimer = setTimeout(fitRefine, 16);
}
if (typeof window !== "undefined") window.__kairouteFitPending = () => fitQueue.length;
if (typeof window !== "undefined") window.__kairouteFitExact = id => { const d = day(); return fitsAll(fitTrial(d, [...d.selected, id])); };
if (typeof window !== "undefined") window.__kairouteTimesFixed = () => timesFixed(day());
if (typeof window !== "undefined") window.__kairouteTryAdd = id => addPick(day(), id, true);
