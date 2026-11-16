// ---------- Drag the day's stops into any order (Richard, Nov 16) ----------
// Each stop on the Day plan has a handle: drag it up or down (finger or mouse), or focus it and use the arrow keys.
// The day is planned again in the new order at once: times, rides and meals follow it (see ownOrd in the planner).
// If the new order costs a stop the traveler picked (it would close before they get there, or the day would run
// past the time back to the ship, train or flight), one notice names it, with "Put back" and "Keep new order". The
// safety margin never gives: in an order that doesn't fit, the stop drops, never the time back.
// A day marked ready asks first; changing it takes the heart off. "Use Kairoute's best order" goes back to the app's.
const gripSVG = `<svg class="gripico" viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></g></svg>`;
const dragHandle = s => `<button type="button" class="draghandle" data-drag="${esc(s.id)}" aria-label="Move ${esc(s.name)}: drag, or use the up and down arrow keys" title="Drag to change the order">${gripSVG}</button>`;
function orderLine(d) {
  return Array.isArray(d.order) && d.order.length > 1
    ? `<p class="ordline">You set the order of the stops; the times follow it. <button type="button" class="linkbtn" data-act="orderreset">Use Kairoute's best order</button></p>`
    : `<p class="ordline hint">${gripSVG}<span>Drag a stop by its handle to change the order.</span></p>`;
}
const pickedOut = (d, pl) => pl && !pl.error ? (pl.dropped || []).filter(x => (d.selected || []).includes(x.id)).map(x => x.name) : [];
// The heads-up notice (shared with the shorter-day question: askNote).
function orderNote(d, plan) {
  if (d.askReady) return askNote("orderask readyask", "This day is marked ready. Change the order of its stops anyway? The heart comes off until you mark the day ready again.",
    ["readyorderno", "Keep it as it was"], ["readyorderyes", "Change the order"]);
  const p = d.pendingOrder; if (!p) return "";
  const out = new Set(pickedOut(d, plan)), names = (p.names || []).filter(n => out.has(n));
  if (!names.length) return "";
  const one = names.length === 1;
  const why = d.type === "port" && d.allAboard ? `before you have to head back to the ship (all aboard ${esc(d.allAboard)})` : hardEnd(d) ? "before you have to leave for your ship, train or flight" : "in today's time";
  return askNote("orderask", `In this order, ${namesHTML(names)} no longer ${one ? "fits" : "fit"} ${why}, or would be closed by the time you get there. Put the stops back the way they were, or keep the new order without ${one ? "it" : "them"}?`,
    ["orderback", "Put back"], ["orderkeep", "Keep new order"]);
}
// ids: the new order of the day's stops, or null for Kairoute's own order.
function reorderStops(d, ids) {
  if (!d) return;
  if (d.ready && readyState(d)) { d.askReady = { order: ids }; save(); render(); return; }
  const lost0 = pickedOut(d, buildPlan(d)), prev = Array.isArray(d.order) ? d.order.slice() : null;
  if (ids && ids.length > 1) d.order = ids.slice(); else delete d.order;
  delete d.pendingOrder;
  const lost = pickedOut(d, buildPlan(d)).filter(n => !lost0.includes(n));
  if (lost.length) d.pendingOrder = { prev, names: lost };
  save(); render();
}
const stopIds = () => [...document.querySelectorAll(".timeline .tl[data-stop]")].map(r => r.dataset.stop);
// Keyboard: the arrow keys move the focused stop one place, and focus stays on it.
function moveBy(id, by) {
  const ids = stopIds(), i = ids.indexOf(id), j = i + by; if (i < 0 || j < 0 || j >= ids.length) return;
  ids.splice(j, 0, ids.splice(i, 1)[0]); reorderStops(day(), ids);
  requestAnimationFrame(() => { const h = document.querySelector(`.draghandle[data-drag="${CSS.escape(id)}"]`); if (h) h.focus(); });
}
// Finger or mouse: the stop follows the pointer; a line shows where it will land; the list scrolls near the edges.
let dragSt = null;
function dragStart(e, h) {
  const row = h.closest(".tl[data-stop]"); if (!row || dragSt) return;
  e.preventDefault(); try { h.setPointerCapture(e.pointerId); } catch (x) {}
  const sc = row.closest(".pane") || null;
  dragSt = { id: row.dataset.stop, row, h, y0: e.clientY, s0: sc ? sc.scrollTop : window.scrollY, sc, to: null, y: e.clientY, raf: 0 };
  row.classList.add("dragging"); document.body.classList.add("dragging-on");
}
function dragTarget() {
  const st = dragSt, rows = [...document.querySelectorAll(".timeline .tl[data-stop]")].filter(r => r !== st.row);
  let at = rows.length; for (let i = 0; i < rows.length; i++) { const r = rows[i].getBoundingClientRect(); if (st.y < r.top + r.height / 2) { at = i; break; } }
  document.querySelectorAll(".tl.dropat, .tl.dropend").forEach(r => r.classList.remove("dropat", "dropend"));
  if (rows[at]) rows[at].classList.add("dropat"); else if (rows.length) rows[rows.length - 1].classList.add("dropend");
  st.to = at;
}
function dragPaint() {
  const st = dragSt; if (!st) return; st.raf = 0;
  const scNow = st.sc ? st.sc.scrollTop : window.scrollY;
  st.row.style.transform = `translateY(${st.y - st.y0 + scNow - st.s0}px)`;
  dragTarget();
  // Near the top or bottom edge, scroll so any stop can be reached in a long day.
  const box = st.sc ? st.sc.getBoundingClientRect() : { top: 0, bottom: innerHeight };
  const pinned = document.querySelector(".dayrow.pinned, #cdCard.pinned > summary"), top = Math.max(box.top, pinned ? pinned.getBoundingClientRect().bottom : 0);
  const v = st.y < top + 70 ? -12 : st.y > box.bottom - 90 ? 12 : 0;
  if (v) { if (st.sc) st.sc.scrollTop += v; else window.scrollBy(0, v); st.raf = requestAnimationFrame(dragPaint); }
}
function dragMove(e) { const st = dragSt; if (!st) return; e.preventDefault(); st.y = e.clientY; if (!st.raf) st.raf = requestAnimationFrame(dragPaint); }
function dragEnd(cancel) {
  const st = dragSt; if (!st) return; dragSt = null;
  if (st.raf) cancelAnimationFrame(st.raf);
  st.row.classList.remove("dragging"); st.row.style.transform = ""; document.body.classList.remove("dragging-on");
  document.querySelectorAll(".tl.dropat, .tl.dropend").forEach(r => r.classList.remove("dropat", "dropend"));
  if (cancel || st.to == null) return;
  const ids = stopIds(), i = ids.indexOf(st.id); if (i < 0) return;
  const rest = ids.filter(x => x !== st.id); rest.splice(st.to, 0, st.id);
  if (rest.join("|") !== ids.join("|")) reorderStops(day(), rest);
}
if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", e => { const h = e.target.closest && e.target.closest(".draghandle"); if (h && (e.button === 0 || e.pointerType !== "mouse")) dragStart(e, h); });
  document.addEventListener("pointermove", dragMove, { passive: false });
  document.addEventListener("pointerup", () => dragEnd(false));
  document.addEventListener("pointercancel", () => dragEnd(true));
  document.addEventListener("keydown", e => {
    if (dragSt && e.key === "Escape") { dragEnd(true); return; }
    const h = e.target.closest && e.target.closest(".draghandle"); if (!h) return;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); moveBy(h.dataset.drag, e.key === "ArrowUp" ? -1 : 1); }
  });
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-act]"); if (!t) return;
    const act = t.dataset.act, d = day(); if (!d) return;
    if (act === "orderreset") reorderStops(d, null);
    else if (act === "orderkeep") { delete d.pendingOrder; d.orderOk = true; save(); render(); } // what no longer fits comes off the picks, with the usual note to fit it back in
    else if (act === "orderback") { const p = d.pendingOrder; if (p && p.prev && p.prev.length > 1) d.order = p.prev; else delete d.order; delete d.pendingOrder; save(); render(); }
    else if (act === "readyorderno") { delete d.askReady; save(); render(); }
    else if (act === "readyorderyes") { const a = d.askReady; delete d.askReady; delete d.ready; reorderStops(d, a ? a.order : null); readyCheckAll(); }
  });
}
if (typeof window !== "undefined") window.__kairouteOrder = { ids: stopIds, set: (i, ids) => { trip.active = i; reorderStops(trip.days[i], ids); }, get: i => trip.days[i].order || null, pending: i => trip.days[i].pendingOrder || null };
