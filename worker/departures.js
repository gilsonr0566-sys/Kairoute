// /departures: every train (or ferry) between two stations on one date, from the operators' published timetables
// (Transitous, the free worldwide planner built on public GTFS feeds). Used by the "Book train" card at the end of a
// leaving day (src/features/book-ride.js); the day planner never uses it, so it can't change a plan.
// - Asked through the day (05:00 to 20:00 local), so the traveler sees the departures around their own time.
// - Only rides whose main part is a train (or a ferry) count, and a ride far slower than the quickest one that day
//   (a detour through another city) is left out: a timetable not yet complete for a far date can offer Rome to
//   Florence through Turin. Nothing is made up: no answer means no list.
// - When the date's timetable isn't published yet (nothing comes back), the next date of the same kind (weekday,
//   Saturday or Sunday) from two days ahead is used, and the answer says so (forDate false).
// - No operator names: the screen shows times, ride length and changes only.
import { dayFor, localMin } from "./transit.js";
const UA = { "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)" };
const RAIL = new Set(["RAIL", "REGIONAL_RAIL", "REGIONAL_FAST_RAIL", "LONG_DISTANCE", "HIGHSPEED_RAIL", "NIGHT_RAIL", "SUBURBAN"]);
const HOURS = [5, 8, 11, 14, 17, 20];
// A date's hh:00 local time, as the planner's time parameter (UTC, shifted by longitude like transit.js).
const at = (iso, lng, hh) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCHours(hh - Math.round(lng / 15), 0, 0, 0); return d.toISOString().replace(/\.\d+Z$/, "Z"); };

async function lookAt(a, b, when, mode) {
  const ask = hh => fetch(`https://api.transitous.org/api/v1/plan?fromPlace=${a.lat},${a.lng}&toPlace=${b.lat},${b.lng}&time=${when(hh)}&numItineraries=8`, { headers: UA, signal: AbortSignal.timeout(20000) })
    .then(r => r.ok ? r.json() : Promise.reject(new Error("timetable " + r.status)));
  const res = []; // two at a time: the free planner turns away bursts
  for (let i = 0; i < HOURS.length; i += 2) res.push(...await Promise.allSettled(HOURS.slice(i, i + 2).map(ask)));
  if (!res.some(x => x.status === "fulfilled")) throw new Error("timetable busy");
  const want = mode === "ferry" ? (m => m === "FERRY") : (m => RAIL.has(m));
  const rows = [];
  for (const x of res) if (x.status === "fulfilled") for (const it of x.value.itineraries || []) {
    const ride = (it.legs || []).filter(l => l.mode !== "WALK"); if (!ride.length) continue;
    const main = ride.reduce((p, q) => (q.duration || 0) > (p.duration || 0) ? q : p);
    // The main part must be the train (or ferry), and trains/ferries must carry most of the ride.
    const onWant = ride.filter(l => want(l.mode)).reduce((n, l) => n + (l.duration || 0), 0), total = ride.reduce((n, l) => n + (l.duration || 0), 0);
    if (!want(main.mode) || onWant < total * 0.8) continue;
    const f = ride[0], z = ride[ride.length - 1];
    const t = localMin(f.startTime, (f.from || {}).tz, a.lng), arr = localMin(z.endTime, (z.to || {}).tz, b.lng);
    const min = Math.round((Date.parse(z.endTime) - Date.parse(f.startTime)) / 60000);
    if (t == null || !isFinite(min) || min <= 0) continue;
    rows.push({ t, arr, min, changes: ride.length - 1, fast: ride.some(l => l.mode === "HIGHSPEED_RAIL"), night: min > 6 * 60 && (arr < t), from: (f.from || {}).name || "", to: (z.to || {}).name || "" });
  }
  if (!rows.length) return [];
  const best = Math.min(...rows.map(r => r.min));
  const by = new Map();
  for (const r of rows.filter(r => r.min <= best * 1.5 + 20).sort((p, q) => p.t - q.t || p.min - q.min)) if (!by.has(r.t)) by.set(r.t, r);
  return [...by.values()];
}

export async function departures(a, b, date, mode) {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Date.parse(date) > Date.now() - 86400e3) {
    try { const r = await lookAt(a, b, hh => at(date, a.lng, hh), mode); if (r.length) return { deps: r, forDate: true, date }; } catch (e) {}
  }
  const dow = date ? new Date(date + "T12:00:00Z").getUTCDay() : 3;
  const like = dayFor(dow, a.lng, 12).slice(0, 10);
  const r = await lookAt(a, b, hh => at(like, a.lng, hh), mode);
  return { deps: r, forDate: false, date: like };
}
