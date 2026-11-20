// ---------- A plan once shown stays the plan (Nov 17 full test pass, then Richard: "the moving around, disappearing") ----------
// A day's plan depends on data that keeps arriving after it is first shown: ride timetables (a few at a time), places
// to eat and their ratings, the outside sources that confirm or merge sights, a fuller city guide. Planning again from
// each new piece put the same Athens stops in another order, swapped places to eat, and once took the Acropolis off a
// day when a merge gave it a new id. A traveler who has seen a day's plan must find the same plan there later, online
// or offline. So each day remembers the plan last shown for it (Day plan, Choose sights, Guide or Tour, and every day
// when the offline status is checked or the trip is downloaded), and the planner replays it, the way a hearted day
// replays its own, with the same safety checks. Only these plan the day again:
//  - a change the traveler makes: different sights, new times or hours, a new ship time, a dragged order, a setting
//    (seenCtx below: everything on the day the traveler or their bookings set, and the trip's preferences);
//  - safety: a stop now closed, rides now slow enough to miss the ship (lockReplay), a sight planned on another day.
// A sight that changed its id (two copies of one place merged, a new guide) is found by its old id among its aliases.
// A plan is remembered only once the day's data has settled (its guide and kept sights loaded, rides answered, or
// 15 s at most) and only when every pick is in the guide, so a half-loaded plan is never the one kept.
// Kept on this device only (localStorage "kairoute.seen.<trip id>"); a hearted day keeps its own lock instead.
function seenStore() {
  if (!seenStore.m || seenStore.id !== trip.id) { seenStore.id = trip.id; let m = null; try { m = JSON.parse(localStorage.getItem("kairoute.seen." + trip.id) || "null"); } catch (e) {} seenStore.m = m && typeof m === "object" ? m : {}; }
  return seenStore.m;
}
function seenOffline() { return typeof navigator !== "undefined" && navigator.onLine === false; }
function seenId(d) { return d.id || "i" + trip.days.indexOf(d) + ":" + (d.date || ""); }
// What the traveler (or their bookings) set on the day, and the trip's preferences: a change to any of it plans again.
// Left out: what the app itself writes in the background (notes, marks, tour progress) and the picks (compared apart).
const SEEN_SKIP = new Set(["ready", "offLog", "bumped", "seedSig", "timeSnap", "wxKeep", "pointIdx", "live", "shipChecked", "askReady", "wantsAsked",
  "titleTyped", "title", "pickNames", "autoEmpty", "respread", "selected", "mine", "boardChecks", "shipSym", "shipPrice", "shipOff", "portAgent",
  "destOrig", "cityKey", "id", "wants", "pendingCut", "cutOk", "orderOk", "pendingOrder", "anchor"]);
function seenCtx(d) {
  const o = []; for (const k in d) if (!SEEN_SKIP.has(k) && typeof d[k] !== "function" && d[k] !== undefined) o.push([k, d[k]]);
  o.sort((a, b) => a[0] < b[0] ? -1 : 1);
  return JSON.stringify(o) + "|" + JSON.stringify(trip.prefs || {}) + "|" + JSON.stringify(trip.lodging || {}) + "|" + (trip.style || "");
}
// Ids as the guide knows them now: a sight merged into another (or renamed by a new guide) is found by its old id.
function seenIds(d) {
  const c = typeof cityFor === "function" ? cityFor(d) : null; if (!c) return null;
  const m = new Map(); for (const s of allSites(c)) if (s && s.id != null) m.set(s.id, s.id);
  for (const s of allSites(c)) for (const a of (s && s.alias) || []) if (a != null && !m.has(a)) m.set(a, s.id);
  return m;
}
function seenCanon(m, sel, nameOf) { return [...new Set(String(sel || "").split("|").filter(Boolean).map(id => (m && m.get(id)) || (nameOf && nameOf(id)) || id))].sort().join("|"); }
// An id the guide no longer knows (a guide fetched again or a fuller one, no merge behind it): the same place in the
// guide now, by the app's own test of one place (samePlace: name, spelling, spot). What each id was comes from the
// remembered plan (name and spot) and the day's own record of what each pick was called.
function seenByName(d, s) {
  const c = cityFor(d); if (!c) return () => null; const was = {};
  for (const x of (s.lock && s.lock.seq) || []) { if (x.id != null && x.n) was[x.id] = { name: x.n, lat: x.la != null ? x.la : NaN, lng: x.lo != null ? x.lo : NaN };
    (x.inc || []).forEach((i, j) => { const n = (x.incn || [])[j], ll = (x.incp || [])[j]; if (n) was[i] = { name: n, lat: ll ? ll[0] : NaN, lng: ll ? ll[1] : NaN }; }); }
  for (const [id, n] of Object.entries(d.pickNames || {})) if (!was[id] && n) was[id] = { name: n, lat: NaN, lng: NaN };
  const sites = allSites(c), memo = {};
  return id => { if (id in memo) return memo[id]; const w = was[id]; const hit = w ? sites.find(x => x && samePlace(w, x)) : null; return (memo[id] = hit ? hit.id : null); };
}
// The plan to replay for this day, while the day's sights and settings are the ones it was shown with. Not while the
// planner weighs another way to plan the day (fast rides, no evening).
function seenFor(d) {
  if (!d || (d.ready && d.ready.lock) || ridePref !== "public" || skipEvening) return null;
  const s = seenStore()[seenId(d)]; if (!s || !s.lock || !Array.isArray(s.lock.seq)) return null;
  if (s.ctx != null && s.ctx !== seenCtx(d)) { seenBreakLog(d, "settings: " + seenDiff(s.ctx, seenCtx(d))); return null; }
  if (s.sel !== selKey(d)) { const m = seenIds(d), a = seenCanon(m, s.sel, seenByName(d, s)), b = seenCanon(m, selKey(d)); if (a !== b) { seenBreakLog(d, "picks: " + a + " -> " + b); return null; } }
  return s;
}
// Part of the plan cache's key, so a replayed plan is never mixed up with a fresh one.
let seenGen = 0;
function seenSig() { return String(seenGen); }
// Has the day's data settled? Its guide and kept sights are in, and no ride question is waiting (15 s at most).
function seenSettled(d) {
  const k = seenId(d), first = seenSettled.at || (seenSettled.at = {}); if (!first[k]) first[k] = Date.now();
  let busy = false;
  try { busy = (typeof guideLoading === "function" && guideLoading(d)) || fillPending > 0 || transitQ.size > 0 || transitBusy; } catch (e) {}
  return !busy || Date.now() - first[k] > 15000;
}
// The last few times a remembered plan couldn't be replayed, and why (test reports, never shown).
const seenBreaks = [];
function seenDiff(a, b) { let i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(Math.max(0, i - 40), i + 60) + " => " + b.slice(Math.max(0, i - 40), i + 60); }
function seenBreakLog(d, why) { const k = seenId(d) + ": " + why; if (seenBreaks[seenBreaks.length - 1] !== k) { seenBreaks.push(k); if (seenBreaks.length > 400) seenBreaks.shift(); } }
const seenNo = {}; // why a day's shown plan wasn't remembered last time (test reports)
function seenKeep(d, plan) {
  if (seenOffline() || !d || !plan || plan.error || !plan.lock || !Array.isArray(plan.lock.seq) || (d.ready && d.ready.lock)) return;
  if (plan.seen || ridePref !== "public" || skipEvening) return; // already the remembered plan, or a trial of another way
  // Every pick must be in the guide: a plan made while a pick is still on its way is never the one kept.
  const m = seenIds(d); if (!m || (d.selected || []).some(id => !m.has(id))) { seenNo[seenId(d)] = "a pick not in the guide yet"; return; }
  if (!seenSettled(d)) { seenNo[seenId(d)] = "data still arriving"; return; }
  delete seenNo[seenId(d)];
  const st = seenStore(), k = seenId(d), v = { sel: selKey(d), ctx: seenCtx(d), lock: plan.lock }, j = JSON.stringify(v);
  if (st[k] && JSON.stringify(st[k]) === j) return;
  if (st[k]) seenBreakLog(d, "a new plan remembered (" + (st[k].sel !== v.sel ? "picks" : st[k].ctx !== v.ctx ? "settings" : "same picks and settings") + ")");
  // The plan cache isn't cleared: the plan kept is the one just shown, and replaying it gives the same plan, so
  // remembering it never makes the day plan again (typing what was spent never re-plans: money-check).
  // Written at once (a plan is remembered about once per day shown): a page closed or a trip switched a moment later
  // must not lose it, and it is written under the trip it belongs to.
  if (!st[k]) seenBreakLog(d, "first plan remembered for this day (store has " + Object.keys(st).length + " days, trip " + seenStore.id + ")");
  st[k] = v; try { localStorage.setItem("kairoute.seen." + seenStore.id, JSON.stringify(st)); } catch (e) { seenBreakLog(d, "couldn't save: " + e.name + " " + JSON.stringify(st).length + " chars"); }
}
function seenAfterRender() {
  try { if (!["plan", "sites", "guide", "tour"].includes(view)) return; const d = day(); if (!d || noShore(d) || !cityFor(d)) return; seenKeep(d, buildPlan(d)); } catch (e) {}
}
if (typeof window !== "undefined") window.__kairouteSeen = { get: i => seenStore()[seenId(trip.days[i])] || null, all: () => seenStore(),
  // Test hooks (plan-steady check): forget every remembered plan; remember every day's plan now, as the download does.
  breaks: () => seenBreaks.slice(), bump: () => { seenGen++; }, clear: () => { seenStore.m = {}; seenGen++; try { localStorage.removeItem("kairoute.seen." + trip.id); } catch (e) {} },
  keepAll: () => { let n = 0; for (const d of trip.days) { try { if (noShore(d) || !cityFor(d)) continue; seenKeep(d, buildPlan(d)); if (seenStore()[seenId(d)]) n++; } catch (e) {} } return n; } };
// Why a remembered plan isn't replayed now (test reports): none kept, picks or settings changed, or what forced it.
function seenWhy(d, p) {
  const s = seenStore()[seenId(d)]; if (!s) return "no plan remembered"; if (p && p.seen) return "";
  if (!seenFor(d)) return s.ctx !== seenCtx(d) ? "day settings changed" : "picks changed"; return (p && p.seenBroke) || "";
}
// Test hooks (tools/steady-check.cjs): every pick is on the day's plan (a stop, inside an area visit, or named as left
// out), and whether the app is still fetching rides or a guide.
if (typeof window !== "undefined") {
  window.__kairouteSteady = (i, was) => { const d = trip.days[i]; let p = null; try { p = buildPlan(d); } catch (e) {}
    const on = new Set(); if (p && !p.error) { (p.stops || []).forEach(s => s.place && on.add(s.place.id)); (p.folded || []).forEach(id => on.add(id)); (p.dropped || []).forEach(x => on.add(x.id)); }
    const m = seenIds(d) || new Map(), has = id => on.has(id) || on.has(m.get(id));
    // gone: picks from before (was) that are no longer on the day under any of their ids, with no note saying why.
    const sel = new Set((d.selected || []).map(id => m.get(id) || id)), off = new Set((d.offLog || []).map(o => o.id));
    const byPlace = seenByName(d, seenStore()[seenId(d)] || {}), now = id => m.get(id) || byPlace(id) || id;
    const gone = (was || []).filter(id => !sel.has(now(id)) && !off.has(id));
    const st = seenStore()[seenId(d)];
    return { sel: (d.selected || []).slice(), gone, skipped: p && p.seenSkipped ? p.seenSkipped : [], seen: !!(p && p.seen), why: seenWhy(d, p), kept: st && st.lock ? st.lock.seq.map(x => x.meal ? "meal:" + ((x.node || {}).name || "") : (x.b ? "+" : "") + (x.n || x.id)).join(" > ") : "", skip: seenNo[seenId(d)] || "", missing: p && !p.error ? (d.selected || []).filter(id => !has(id)) : [] }; };
  window.__kairouteSteadyBusy = () => { try { return transitQ.size > 0 || transitBusy || fillPending > 0 || trip.days.some(d => guideLoading(d)); } catch (e) { return false; } };
}
