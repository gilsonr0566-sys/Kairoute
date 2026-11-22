// Screen guard (Nov 22 2026, Richard: "what are all the ways the app can fail"; Rule #2, never cause a missed ship).
// After every render of a day plan, the plan's own text is read back through the screen rules (screen-rules.js), the
// same rules the release gate and the live tests use. If the screen fails a ship, train or flight rule (a stop past
// the LEAVE BY time, a ride back that doesn't fit, a free-time "leave by" after a later step), the day says so at the
// top, in plain words, and tells the traveler which time to trust: the earliest one shown. It never changes the plan
// and never hides it; it only refuses to let times that disagree look certain ("I don't know" principle, Nov 21).
// Everything it found is kept in window.__kairouteGuard for the checks.
const render_G0 = render;
render = function () { const r = render_G0.apply(this, arguments); try { guardAfterRender(); } catch (e) {} return r; };
function guardAfterRender() {
  const v = document.getElementById("view"); if (!v) return;
  const old = v.querySelector(".guardnote"); if (old) old.remove();
  if (typeof view === "undefined" || view !== "plan" || typeof KScreenRules === "undefined") return;
  const d = typeof day === "function" ? day() : null; if (!d) return;
  const found = KScreenRules.rules(v.innerText, { type: d.type, date: d.date });
  window.__kairouteGuard = { day: trip.active, found };
  const s1 = found.filter(f => f.sev === "S1"); if (!s1.length) return;
  const P = KScreenRules.parse(v.innerText), times = [P.leaveBy].concat(P.rows.map(r => r.until)).filter(t => t != null), first = times.length ? Math.min(...times) : null;
  const when = first == null ? "" : ` To be safe, leave by ${fmtClock(first)}, the earliest leave time on this page.`;
  v.insertAdjacentHTML("afterbegin", `<p class="banner warn guardnote" role="alert"><b>These times don't all agree.</b> ${esc(s1[0].msg)}.${when} Always check the time with your ship, train or airline.</p>`);
}
function fmtClock(m) { m = Math.round(m); const h = Math.floor(m / 60) % 24, mi = String(m % 60).padStart(2, "0");
  try { if (typeof clockLabel === "function") return clockLabel(m); } catch (e) {}
  return (h % 12 || 12) + ":" + mi + (h < 12 ? " am" : " pm"); }
window.__kairouteGuardCheck = () => { guardAfterRender(); return window.__kairouteGuard; };
