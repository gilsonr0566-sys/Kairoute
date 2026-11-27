// ---------- Ride timetables re-checked before the day ----------
// Train and ferry times change (a new summer timetable, a cancelled sailing). Every ride a day's plan takes is
// looked up again the day before and on the day itself, whenever the device is online, in a quiet moment in the
// background. When a line's times changed, only that day is planned again and its Day plan says so at the top
// ("Ferry time changed"), with the new departure and the new leave-by. Nothing is redrawn unless that day is on
// screen. With no signal the kept times are used and each ride says when its timetable was last checked.
const RR_KEY = "kairoute.rideCheck1";
let rrDone = (() => { try { return JSON.parse(localStorage.getItem(RR_KEY) || "{}"); } catch (e) { return {}; } })();
let rrTimer = 0, rrBusy = false;
const rrSave = () => { try { localStorage.setItem(RR_KEY, JSON.stringify(rrDone)); } catch (e) {} };
const rrNextDate = iso => new Date(Date.parse(iso + "T12:00:00Z") + 86400e3).toISOString().slice(0, 10);
// Which check is due for a day: "eve" the day before, "day" on the day (in the day's own time zone). null: none.
function rrSlot(d) {
  if (!d || !d.date || d.type === "sea") return null;
  let today; try { today = todayISO(d); } catch (e) { today = todayISO(); }
  return d.date === today ? "day" : d.date === rrNextDate(today) ? "eve" : null;
}
// The rides the day's plan takes on a real line, with the departure the plan uses for each.
function rrRides(d, plan) {
  const out = [], kind = dayKind(new Date(Date.parse(d.date + "T12:00:00Z")).getUTCDay());
  plan.items.forEach((x, k) => {
    if (x.type !== "travel" || !x.leg || x.leg.mode !== "ride" || !x.leg.transit) return;
    const a = plan.items.slice(0, k).reverse().find(y => y.place), b = plan.items.slice(k + 1).find(y => y.place); if (!a || !b) return;
    const o = x.leg.transit;
    out.push({ key: pairKey(a.place, b.place) + "|" + kind, a: [+a.place.lat, +a.place.lng], b: [+b.place.lat, +b.place.lng], id: rideId(o), mode: o.mode, label: o.label, at: x.time, was: rrDep(o, x.time), min: o.min });
  });
  return out;
}
// The departure a ride at time t catches: the first one after the walk to the station or pier.
const rrDep = (o, t) => { const at = t + ((o.access && o.access.min) || 0), nx = (o.deps || []).find(q => q.t >= at); return nx ? nx.t : null; };
// The day's leave-by (ship, train or flight), when the day has one.
function rrLeaveBy(d, plan) { try { return fixedTitle(d) && plan.w.tail.length ? alarmState(d, plan).leaveBy : null; } catch (e) { return null; } }
// Only this day's kept plans are dropped, so it alone is planned again.
function rrReplan(d) { for (const m of [planStore.map, planStore.old]) if (m) for (const [k, v] of [...m]) if (v.d === d) m.delete(k); nearGen++; }
// Compares a fresh answer with the ride the plan took. Returns the change to tell the traveler, or null.
function rrCompare(r, fresh) {
  const o = (fresh.opts || []).find(x => rideId(x) === r.id); if (!o) return null; // a line missing from one answer is kept (see transitMerge)
  const now = rrDep(o, r.at);
  if (r.was != null && now != null && now !== r.was) return { mode: r.mode, label: r.label, was: r.was, now, kind: "dep" };
  if (Math.abs((o.min || 0) - (r.min || 0)) >= 5) return { mode: r.mode, label: r.label, was: r.min, now: o.min, kind: "min" };
  return null;
}
async function rrFetch(rides, dow, date) {
  const r = await fetch(freeAI.url + "/transit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pairs: rides.map(x => ({ a: x.a, b: x.b, dow, date, fresh: true })) }) });
  if (!r.ok) throw new Error("transit " + r.status);
  return (await r.json()).results || [];
}
// Checks one day. fetcher is for the safety net (answers given instead of asking the helper).
async function rrCheckDay(d, slot, fetcher) {
  const plan = buildPlan(d); if (!plan || plan.error) return null;
  const rides = rrRides(d, plan); if (!rides.length) { rrDone[d.id + "|" + slot] = Date.now(); rrSave(); return []; }
  const before = rrLeaveBy(d, plan), dow = new Date(Date.parse(d.date + "T12:00:00Z")).getUTCDay();
  const res = await (fetcher || rrFetch)(rides, dow, d.date);
  const changes = []; let answered = 0;
  rides.forEach((r, i) => {
    const x = res[i]; if (!x || !Array.isArray(x.opts) || x.partial) return; // a busy source: try again later
    answered++;
    const c = rrCompare(r, x); if (c) changes.push(c);
    transitMem[r.key] = transitMerge(x, transitMem[r.key]);
  });
  if (answered < rides.length) return null; // not every ride answered: the check runs again later
  rrDone[d.id + "|" + slot] = Date.now(); rrSave();
  if (!changes.length) { nearGen++; transitKeep(); return []; }
  rrReplan(d); transitKeep();
  const after = buildPlan(d), lb = after && !after.error ? rrLeaveBy(d, after) : null;
  d.rideChange = { at: Date.now(), changes, leaveBy: lb != null && lb !== before ? lb : null, was: before };
  save();
  if (typeof view !== "undefined" && view === "plan" && day() === d) dataRender();
  return changes;
}
const rrWord = m => m === "ferry" ? "Ferry" : m === "bus" ? "Bus" : m === "tram" ? "Tram" : m === "subway" || m === "metro" ? "Metro" : "Train";
function rideChangeBanner(d) {
  const c = d && d.rideChange; if (!c || !(c.changes || []).length) return "";
  const words = [...new Set(c.changes.map(x => rrWord(x.mode)))], head = (words.length === 1 ? words[0] : "Ride") + (c.changes.length > 1 ? " times changed" : " time changed");
  const lines = c.changes.map(x => x.kind === "dep" ? `${esc(x.label)} now leaves at <b>${fmt(x.now)}</b> (was ${fmt(x.was)}).` : `${esc(x.label)} now takes <b>${dur(x.now)}</b> (was ${dur(x.was)}).`).join(" ");
  const lb = c.leaveBy != null ? ` New leave-by: <b>${fmt(c.leaveBy)}</b>${c.was != null ? ` (was ${fmt(c.was)})` : ""}.` : "";
  return `<div class="banner warn ridechange" role="alert"><span><b>${head}.</b> ${lines} The plan for this day is updated.${lb}</span><button class="btn small" data-act="ridechangeok">OK</button></div>`;
}
// Runs in quiet moments only (never mid-tap or mid-scroll), on start, every 20 minutes and when the signal returns.
async function rrRun() {
  if (rrBusy || typeof freeAI === "undefined" || !freeAI || (typeof navigator !== "undefined" && navigator.onLine === false) || !trip || !trip.days) return;
  rrBusy = true;
  try {
    for (const d of trip.days) {
      const slot = rrSlot(d); if (!slot || rrDone[d.id + "|" + slot] || !cityFor(d) || noShore(d)) continue;
      await offQuiet();
      try { await rrCheckDay(d, slot); } catch (e) {}
    }
    // Checks older than a week are forgotten.
    const old = Date.now() - 7 * 86400e3; let cut = false; for (const k in rrDone) if (rrDone[k] < old) { delete rrDone[k]; cut = true; } if (cut) rrSave();
  } finally { rrBusy = false; }
}
function rrSoon(ms) { clearTimeout(rrTimer); rrTimer = setTimeout(() => { rrRun().finally(() => rrSoon(20 * 60e3)); }, ms); }
if (typeof window !== "undefined") {
  rrSoon(15000);
  window.addEventListener("online", () => rrSoon(5000));
  // Safety net: check day i now with given answers ([{opts}] per ride, or a function of the rides).
  window.__kairouteRideRefresh = async (i, answer) => { const d = trip.days[i]; return rrCheckDay(d, "test", async rides => typeof answer === "function" ? answer(rides) : answer); };
  window.__kairouteRideRides = i => { const d = trip.days[i], pl = buildPlan(d); return pl && !pl.error ? rrRides(d, pl) : null; };
  window.__kairouteRideSlot = (i, today) => { const d = trip.days[i]; return d.date === today ? "day" : d.date === rrNextDate(today) ? "eve" : null; };
}
