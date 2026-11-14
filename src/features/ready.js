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
  return !plan || plan.error || readySig(plan) === d.ready.sig ? "ok" : "changed";
}
function readyMark(d) {
  let plan = null; if (!noShore(d) && cityFor(d)) { try { plan = buildPlan(d); } catch (e) {} }
  d.ready = { at: Date.now(), sel: selSig(d), sig: readySig(plan), names: readyStops(plan).map(p => p.name), bonus: plan && !plan.error ? (plan.bonus || []).map(x => x.id) : [] };
}
// What changed since the heart was tapped, in a few words.
function readyChange(d) {
  if (readyState(d) !== "changed") return null;
  const now = readyStops(buildPlan(d)).map(p => p.name), was = d.ready.names || [];
  const added = now.filter(n => !was.includes(n)), gone = was.filter(n => !now.includes(n));
  return { added, gone };
}
const readyCount = () => { const ds = readyDays(); return { done: ds.filter(d => readyState(d) === "ok").length, of: ds.length }; };
const heartSVG = on => `<svg class="heartico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.6 2.3 4.5 6.2 4.5c2.3 0 3.8 1.3 4.6 2.6h2.4c.8-1.3 2.3-2.6 4.6-2.6 3.9 0 5.8 4.1 4.2 7.2C19.5 16.4 12 21 12 21z" ${on ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2"'}/></svg>`;
// The heart in the day's head, next to Rename.
function heartBtn(d) {
  const s = readyState(d), label = s === "ok" ? "Day ready" : s === "changed" ? "Changed: confirm" : "Mark day ready";
  return `<button class="linkbtn heartbtn ${s || "off"}" data-act="dayready" aria-pressed="${s === "ok"}" title="${s === "ok" ? "Tap to unmark this day" : "Tap when this day is planned the way you want it"}">${heartSVG(s === "ok")}<span>${label}</span></button>`;
}
// The small heart on a day in the day list (top strip and Trip screen).
const heartDot = d => { const s = readyState(d); return s ? `<span class="dheart ${s}" aria-label="${s === "ok" ? "Day ready" : "Changed since you marked it ready"}">${heartSVG(s === "ok")}</span>` : ""; };
function readyBanner(d) {
  const c = readyChange(d); if (!c) return "";
  const bits = [c.added.length ? `added ${c.added.map(esc).join(", ")}` : "", c.gone.length ? `took off ${c.gone.map(esc).join(", ")}` : ""].filter(Boolean).join(" and ");
  return `<div class="banner warn" role="status"><span>You marked this day ready, then Kairoute ${bits || "changed it"}${c.gone.length ? " (closed, or no longer fits the time safely)" : ""}. Check the plan and tap the heart to confirm it again.</span><button class="btn small" data-act="dayready">${heartSVG(true)} Confirm</button></div>`;
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
if (typeof window !== "undefined") window.__kairouteReady = { state: i => readyState(trip.days[i]), mark: i => { readyMark(trip.days[i]); save(); readyCheckAll(); }, clear: i => { delete trip.days[i].ready; save(); }, count: readyCount, change: i => readyChange(trip.days[i]), days: () => readyDays().map(d => trip.days.indexOf(d)) };
