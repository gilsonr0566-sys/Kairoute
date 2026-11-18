// ---------- Change lunch or dinner on the Day plan (Richard, Nov 18: "I don't see a place to change lunch") ----------
// Every meal row on the Day plan has a "Change lunch" (or "Change dinner") link. It opens one small card with:
//  - other real places to eat near today's route (the guide's restaurants from the map, never invented, the same
//    filters the planner uses: rated 4.0 or better on Google when rated, open for this meal, not a place any other
//    day of the trip eats at), one tap each;
//  - a time for the meal (or "Best fit", the planner's own choice);
//  - Skip lunch today, and "I have a reservation" (the existing reservation form).
// The choice is stored on the day (d.mealPrefs = { Lunch: { pick, at, skip } }) and the planner plans around it:
// a chosen place is placed where it fits best in the route, a chosen time pins the meal there, and a skipped meal
// is left out (its time goes to sightseeing). A hearted day is planned again when a meal changes (ready.js).
let mealForm = null; // { label } while the card is open
const MEAL_TIMES = { Lunch: ["11:30", "12:00", "12:30", "13:00", "13:30", "14:00"], Dinner: ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30"] };
const mealPref = (d, label) => ((d && d.mealPrefs) || {})[label] || null;

// The day's meals as the planner should place them: MEALS, with the traveler's choices applied.
function dayMeals(d, city) {
  const P = (d && d.mealPrefs) || {};
  return MEALS.filter(m => !(P[m.label] && P[m.label].skip)).map(m => {
    const p = P[m.label]; if (!p) return m;
    const o = Object.assign({}, m);
    if (p.at && /^\d\d:\d\d$/.test(p.at)) { const t = toMin(p.at); o.from = t; o.to = t + 10; o.at = p.at; }
    const k = p.pick;
    if (k && k.name && isFinite(k.lat) && isFinite(k.lng)) {
      // The guide's own entry when it still has it (its rating, hours and cuisine stay current), else the saved one.
      const live = city && (city.restaurants || []).find(r => !r.generic && keyOf(r.name) === keyOf(k.name) && hav(r, k) < 0.2);
      o.pick = Object.assign({}, live || { name: k.name, lat: k.lat, lng: k.lng, cuisine: k.cuisine || "", kind: k.kind || "local", price: k.price || "", why: "" }, { mine: true });
    }
    return o;
  });
}

// Places to eat a traveler can switch to: real places near today's stops, best first.
function mealChoices(d, plan, label) {
  const city = plan && plan.city; if (!city) return [];
  const item = plan.items.find(x => (x.type === "meal" || x.type === "evening") && x.meal && x.meal.label === label && x.place);
  const cur = item ? item.place : null;
  // Near today's sights (named by the sight), or on a day without one, near where the day starts or ends.
  const sights = plan.items.filter(x => x.type === "stop" && x.place && isFinite(x.place.lat)).map(x => x.place);
  const stops = sights.length ? sights : plan.items.filter(x => (x.type === "start" || x.type === "end" || x.type === "fixed") && x.place && isFinite(x.place.lat)).map(x => x.place);
  // Never a place another day of the trip already eats at, so no place is planned twice.
  const taken = new Set();
  trip.days.forEach(o => { if (o === d || cityFor(o) !== city) return; let p = null; try { p = buildPlan(o); } catch (e) {} if (!p || p.error) return;
    (p.items || []).forEach(x => { if ((x.type === "meal" || x.type === "evening") && x.place && !x.place.generic) taken.add(keyOf(x.place.name)); }); });
  (plan.items || []).forEach(x => { if ((x.type === "meal" || x.type === "evening") && x.place && x !== item && !x.place.generic) taken.add(keyOf(x.place.name)); });
  const radius = item && item.type === "evening" ? 0.8 : 0.6;
  const near = r => { let b = Infinity, at = null; for (const s of stops) { const k = hav(s, r); if (k < b) { b = k; at = s; } } return { km: b, at }; };
  const fromLunch = r => cur && !cur.generic && isFinite(cur.lat) ? hav(cur, r) : Infinity; // close to where the meal is now also counts
  const alts = new Set(((cur && cur.alts) || []).map(a => keyOf(a.name)));
  const out = (city.restaurants || []).filter(r => !r.generic && !r.crowdDrop && isFinite(r.lat) && !(cur && keyOf(r.name) === keyOf(cur.name)) && !taken.has(keyOf(r.name)) && !mealShut(r, label, d.date))
    .map(r => Object.assign({ r, alt: alts.has(keyOf(r.name)) }, near(r))).filter(x => x.at && Math.min(x.km, fromLunch(x.r)) <= radius);
  const good = x => (x.alt ? 10 : 0) + (x.r.crowdTop ? 3 : 0) + (x.r.top ? 2 : 0) + (x.r.recommended ? 2 : 0) + (gGood(gOf(x.r)) ? 2 : 0) - x.km * 6;
  return out.sort((a, b) => good(b) - good(a)).slice(0, 6);
}

const mealRateTxt = r => { const g = r.g || gOf(r); return g && g.state === "ok" && g.rating ? "★ " + g.rating.toFixed(1) + " on Google" : ""; };

// The link under a meal on the timeline.
function mealChangeLink(lbl, r) {
  if (r && r.booked) return "";
  const p = mealPref(day(), lbl);
  return `<div class="sub mealchg"><button class="link" data-act="mealopen" data-meal="${esc(lbl)}">Change ${esc(lbl.toLowerCase())}</button>${p && (p.pick || p.at) ? ` · <span class="mine">Your ${p.pick ? "choice" : "time"}</span>` : ""}</div>`;
}

// Heads-up line when the traveler skipped a meal, with one tap to bring it back.
function mealSkipNote(d) {
  return ["Lunch", "Dinner"].filter(l => { const p = mealPref(d, l); return p && p.skip; })
    .map(l => `<div class="banner mealskip"><span>No ${l.toLowerCase()} planned today: you skipped it.</span><button type="button" class="btn small ghost" data-act="mealunskip" data-meal="${l}">Add ${l.toLowerCase()} back</button></div>`).join("");
}

// The card itself, above the timeline (where the reservation form opens too).
function mealFormHTML(d, plan) {
  const f = mealForm; if (!f || !plan || plan.error) return "";
  const lbl = f.label, low = lbl.toLowerCase(), p = mealPref(d, lbl) || {};
  const item = plan.items.find(x => (x.type === "meal" || x.type === "evening") && x.meal && x.meal.label === lbl && x.place);
  const ch = mealChoices(d, plan, lbl);
  const times = (MEAL_TIMES[lbl] || []).filter(t => { const m = toMin(t); return m >= plan.start && m + 30 <= Math.max(plan.endBy, item && item.type === "evening" ? 23 * 60 : 0); });
  const near = x => x.km < 0.05 ? "next to " + x.at.name : distTxt(x.km) + " from " + x.at.name;
  return `<div class="card bookform mealform" id="mealform"><h3>Change ${esc(low)}</h3>
    ${item ? `<p class="lede small">Now: <b>${esc(item.place.name)}</b> at ${fmt(item.time)}</p>` : ""}
    ${ch.length ? `<p class="eyebrow">Eat somewhere else nearby</p><div class="bookres">${ch.map((x, i) => `<button class="btn ghost" data-mealpick="${i}"><b>${esc(x.r.name)}</b><small>${[x.r.cuisine && x.r.cuisine !== "Restaurant" ? x.r.cuisine : "", mealRateTxt(x.r), near(x)].filter(Boolean).map(esc).join(" · ")}</small></button>`).join("")}</div>`
      : `<p class="lede small">No other place to eat the guide knows is close to today's stops.</p>`}
    ${times.length ? `<p class="eyebrow">Time</p><div class="jumps mealtimes"><button class="chip${p.at ? "" : " on"}" data-act="mealtime" data-v="">Best fit</button>${times.map(t => `<button class="chip${p.at === t ? " on" : ""}" data-act="mealtime" data-v="${t}">${t}</button>`).join("")}</div>` : ""}
    <div class="actions"><button class="btn" data-act="mealdone">Done</button><button class="btn ghost" data-act="mealskip">Skip ${esc(low)} today</button><button class="btn ghost" data-act="bookopen" data-meal="${esc(lbl)}">I have a reservation</button>${p.pick || p.at ? `<button class="btn ghost" data-act="mealreset">Use Kairoute's pick</button>` : ""}</div></div>`;
}

function setMealPref(d, label, change) {
  const P = Object.assign({}, d.mealPrefs || {}), cur = Object.assign({}, P[label] || {}, change);
  Object.keys(cur).forEach(k => { if (cur[k] == null || cur[k] === "" || cur[k] === false) delete cur[k]; });
  if (Object.keys(cur).length) P[label] = cur; else delete P[label];
  if (Object.keys(P).length) d.mealPrefs = P; else delete d.mealPrefs;
  trip.tour = null; save(); render();
}

if (typeof document !== "undefined") {
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-act],[data-mealpick]"); if (!t) return;
    const d = day(); if (!d) return;
    const act = t.dataset.act;
    if (act === "mealopen") { mealForm = { label: t.dataset.meal }; bookForm = null; render(); const el = document.getElementById("mealform"); if (el) el.scrollIntoView({ block: "nearest" }); return; }
    if (act === "bookopen") { mealForm = null; return; } // the reservation form takes the card's place (main.js opens it)
    if (!mealForm) { if (act === "mealunskip") setMealPref(d, t.dataset.meal, { skip: null }); return; }
    const L = mealForm.label;
    if (t.dataset.mealpick != null) {
      const plan = buildPlan(d), x = mealChoices(d, plan, L)[+t.dataset.mealpick]; if (!x) return;
      const r = x.r; setMealPref(d, L, { pick: { name: r.name, lat: +(+r.lat).toFixed(5), lng: +(+r.lng).toFixed(5), cuisine: r.cuisine || "", kind: r.kind || "", price: r.price || "" }, skip: null });
      return;
    }
    if (act === "mealtime") { setMealPref(d, L, { at: t.dataset.v || null, skip: null }); return; }
    if (act === "mealskip") { mealForm = null; setMealPref(d, L, { skip: true, pick: null, at: null }); return; }
    if (act === "mealreset") { setMealPref(d, L, { pick: null, at: null, skip: null }); return; }
    if (act === "mealdone") { mealForm = null; render(); return; }
    if (act === "mealunskip") setMealPref(d, t.dataset.meal, { skip: null });
  }, true);
  // Test hooks: the meal choices for the open day, and setting one without the screen.
  window.__kairouteMeal = { prefs: i => trip.days[i].mealPrefs || null, set: (i, label, change) => { trip.active = i; setMealPref(trip.days[i], label, change); },
    pick: (i, label, k) => { const d = trip.days[i], x = mealChoices(d, buildPlan(d), label)[k]; if (!x) return false; trip.active = i; setMealPref(d, label, { pick: { name: x.r.name, lat: +(+x.r.lat).toFixed(5), lng: +(+x.r.lng).toFixed(5), cuisine: x.r.cuisine || "", kind: x.r.kind || "", price: x.r.price || "" } }); return true; },
    choices: (i, label) => { const d = trip.days[i], p = buildPlan(d); return mealChoices(d, p, label).map(x => ({ name: x.r.name, km: +x.km.toFixed(2), near: x.at.name })); } };
}
