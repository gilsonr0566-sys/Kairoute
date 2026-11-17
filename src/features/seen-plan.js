// ---------- Offline shows the plan you saw online (Nov 17 full test pass) ----------
// A day's plan depends on ride timetables, which arrive over the internet a few at a time. With no internet, some
// timetables a plan was built on can be missing, and planning again from what's left put the same Athens stops in
// the opposite order, with other places to eat. The app must never disagree with itself. So each day remembers the
// plan last shown for it online: on the Day plan, Change stops, Guide or Tour, and for every day whenever the
// offline status is checked or the trip is downloaded. With no internet, the planner replays that plan, the same way
// a hearted day replays its own, with the same safety checks. A change the traveler makes (different sights, new
// times, a new ship time) or a safety problem (a stop now closed, a ship that won't wait) still plans again.
// Kept on this device only (localStorage "kairoute.seen.<trip id>"); a hearted day keeps its own lock instead.
function seenStore() {
  if (!seenStore.m || seenStore.id !== trip.id) { seenStore.id = trip.id; let m = null; try { m = JSON.parse(localStorage.getItem("kairoute.seen." + trip.id) || "null"); } catch (e) {} seenStore.m = m && typeof m === "object" ? m : {}; }
  return seenStore.m;
}
function seenOffline() { return typeof navigator !== "undefined" && navigator.onLine === false; }
function seenId(d) { return d.id || "i" + trip.days.indexOf(d) + ":" + (d.date || ""); }
// The plan to replay for this day, only with no internet and only while the day's sights are the ones it was seen with.
function seenFor(d) {
  if (!d || !seenOffline() || (d.ready && d.ready.lock)) return null;
  const s = seenStore()[seenId(d)]; return s && s.sel === selKey(d) && s.lock && Array.isArray(s.lock.seq) ? s : null;
}
// Part of the plan cache's key while offline, so a replayed plan is never mixed up with a fresh one.
function seenSig() { return seenOffline() ? JSON.stringify(seenStore()) : ""; }
function seenKeep(d, plan) {
  if (seenOffline() || !d || !plan || plan.error || !plan.lock || !Array.isArray(plan.lock.seq) || (d.ready && d.ready.lock)) return;
  const m = seenStore(), k = seenId(d), v = { sel: selKey(d), lock: plan.lock }, j = JSON.stringify(v);
  if (m[k] && JSON.stringify(m[k]) === j) return;
  m[k] = v; clearTimeout(seenKeep.t);
  seenKeep.t = setTimeout(() => { try { localStorage.setItem("kairoute.seen." + seenStore.id, JSON.stringify(seenStore())); } catch (e) {} }, 400);
}
function seenAfterRender() {
  try { if (!["plan", "sites", "guide", "tour"].includes(view)) return; const d = day(); if (!d || noShore(d) || !cityFor(d)) return; seenKeep(d, buildPlan(d)); } catch (e) {}
}
if (typeof window !== "undefined") window.__kairouteSeen = { get: i => seenStore()[seenId(trip.days[i])] || null, all: () => seenStore() };
