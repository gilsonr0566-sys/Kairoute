// ===================== How many days your picks need / If you come back =====================
// Richard (Nov 16): while a trip's days in a city aren't booked yet, a quiet hint says how many days the traveler's
// picks fit best in ("Your picks fit best in 3–4 days"). It never says "you need more days". Once the days are booked,
// a pick that doesn't fit any of them isn't lost: it goes to an "If you come back" list for that city.
// The same rule for every city: "booked" means every day spent in the city has a date.
const laterKey = city => keyOf((city && city.city) || "");
const cityShoreDays = city => (trip.days || []).filter(o => cityFor(o) === city && !noShore(o));
const cityBooked = city => { const ds = cityShoreDays(city); return ds.length > 0 && ds.every(o => /^\d{4}-\d\d-\d\d$/.test(o.date || "")); };
// Ids planned on any of the city's days.
const cityPicked = city => new Set(cityShoreDays(city).flatMap(o => o.selected || []));
// Everything the traveler asked for in this city: picks on its days, picks that came off (didn't fit), sights named
// when the trip was made.
function cityWanted(city) {
  const all = allSites(city), byId = id => all.find(s => s.id === id), out = new Map();
  for (const o of cityShoreDays(city)) {
    for (const id of o.selected || []) { const s = byId(id); if (s) out.set(s.id, s); }
    for (const b of o.bumped || []) { const s = byId(b.id); if (s && !b.back) out.set(s.id, s); }
    try { for (const id of wantIds(o, city)) { const s = byId(id); if (s) out.set(s.id, s); } } catch (e) {}
  }
  for (const x of laterList(city)) out.set(x.id, x);
  return [...out.values()];
}
// The picks that came off a booked city's days and aren't planned on another one.
function laterList(city) {
  if (!city || !trip) return [];
  const all = allSites(city), on = cityPicked(city), keep = ((trip.later || {})[laterKey(city)] || []);
  return keep.map(x => all.find(s => s.id === x.id) || all.find(s => s.name === x.name)).filter(s => s && !on.has(s.id));
}
// Called when picks come off a day because they no longer fit (settlePicks).
function laterAdd(d, out) {
  const city = cityFor(d); if (!city || !out || !out.length || !cityBooked(city)) return;
  trip.later = trip.later || {}; const k = laterKey(city), l = trip.later[k] = trip.later[k] || [];
  for (const x of out) if (!l.some(y => y.id === x.id)) l.push({ id: x.id, name: x.name });
}
// A typical shore day: the city's own day windows, less time for meals; 8 hours when none can be worked out.
function cityDayMin(city) {
  const ws = cityShoreDays(city).map(o => { const w = dayWindowSafe(o, city); return w && w.endBy > w.start ? w.endBy - w.start : 0; }).filter(m => m >= 180);
  const avg = ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : 480;
  return Math.max(180, avg - 75);
}
// How many days the picks fit best in: a day trip (a far sight) takes a day of its own; the rest are their visit
// times plus getting between stops (15 to 30 minutes each, so the answer is a range when it's close).
function picksDays(city) {
  const w = cityWanted(city); if (w.length < 3) return null;
  const far = w.filter(s => s.far).length, near = w.filter(s => !s.far), dm = cityDayMin(city);
  const mins = g => near.reduce((a, s) => a + (+s.minutes || 45) + g, 0);
  const lo = far + Math.ceil(mins(15) / dm), hi = far + Math.ceil(mins(30) / dm);
  return { lo: Math.max(1, lo), hi: Math.max(1, hi), n: w.length };
}
function picksDaysHint(city) {
  if (!city || cityBooked(city)) return "";
  const r = picksDays(city); if (!r) return "";
  const txt = r.lo === r.hi ? `${r.lo} day${r.lo === 1 ? "" : "s"}` : `${r.lo}–${r.hi} days`;
  return `<p class="lede small daysfit" role="note">Your picks fit best in ${txt}.</p>`;
}
// The folded "If you come back" list on Change stops (each sight can still be ticked for today).
function laterBlock(city, d, plan, near) {
  if (!city || !cityBooked(city)) return "";
  const l = laterList(city); if (!l.length) return "";
  return `<details class="more comeback"><summary>If you come back (${l.length})</summary><p class="lede small" style="margin:8px 0">Picks that didn't fit this visit. Tick one to try it today.</p>
  <div class="sitelist">${l.map(s => siteCard(s, d, plan, near)).join("")}</div></details>`;
}
if (typeof window !== "undefined") window.__kairouteLater = i => { const d = trip.days[i], c = cityFor(d); if (!c) return null; return { booked: cityBooked(c), days: picksDays(c), hint: picksDaysHint(c).replace(/<[^>]+>/g, ""), later: laterList(c).map(s => s.name), wanted: cityWanted(c).map(s => s.name) }; };
