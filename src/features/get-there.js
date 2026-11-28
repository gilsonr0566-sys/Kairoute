// ===================== Get there: search any place and how to get there from where you are (rule R-40) =====================
// Richard, Nov 27: "Can we have some kind of search to help them get around." One search box, on the Day plan, the Guide
// and the Tour: the traveler types any place (a sight, a station, a restaurant, a street address, their hotel or the
// ship) and the app shows where it is and every way to get there from where they are now. The rule, for every city:
//  1. What is found is real: the trip's own places first (the day's start and end: ship, hotel, station, airport; the
//     guide's sights, day trips and restaurants), with no internet needed; then the map (OpenStreetMap through the
//     helper's /findplace, the same search and the same answer-picking rule as "Where you're staying", R-38: a named
//     place, else the door with the number typed, else a short street said as the street). Nothing found is said so.
//  2. The ways there come from the ONE ride layer the plans use (KEngine.makeTravel through zz-engine2: walks with their
//     climb, street routes, timetables, the boat across the water, the taxi), never a second calculator. Each way says
//     where its time comes from; a time no timetable confirms reads "about", never as a fact.
//  3. On a day with a time to be back (a ship, a train, a plane), the place is checked against it with the same ride
//     layer and its spare time for the way back: the latest time to leave the place, or plainly that going there now
//     leaves no time to get back. An estimate is never called confirmed.
//  4. Every name is in the traveler's language (R-11). No AI, nothing paid.
let gt = null; // { q, list, map, mapMsg, busy, pick, from, fromKey, msg }
const GT_MAP_KM = 60; // a map answer farther than this from the day's own place is someone else's
const gtBtnHTML = () => `<button class="btn ghost small" data-act="gtopen" aria-label="Get there: search any place and how to get there">🧭 Get there</button>`;
// A real position: a missing or empty one is never read as 0 (+null is 0).
const gtHas = p => !!p && p.lat != null && p.lat !== "" && p.lng != null && p.lng !== "" && KEngine.fin(Number(p.lat)) && KEngine.fin(Number(p.lng));
const gtPlant = k => typeof window !== "undefined" && window.__kairoutePlant === k;
const gtName = x => gtPlant("gt-local-script") ? String((x && x.name) || "") : showName(x);
function gtDay() { const d = day(); return d && d.type !== "sea" ? d : null; }
// The day's own places, every one the traveler might want to go back to: where the day starts and ends, the hotel.
function gtOwnPoints(d, city) {
  const out = [], w = dayWindowSafe(d, city), add = (p, sub, kind) => { if (p && gtHas(p) && !out.some(o => hav(o, p) < 0.05)) out.push({ name: gtName(p) || sub, lat: +p.lat, lng: +p.lng, sub, kind, own: true }); };
  if (w && !w.error) { const end = w.tail[w.tail.length - 1];
    if (end) add(end, end.backToShip ? "Your ship" : end.deadline ? "Where you leave from" : "Where your day ends", end.backToShip ? "ship" : end.deadline ? "leave" : "end");
    for (const p of w.head) add(p, p.fixed ? "On your way" : "Where your day starts", "start"); }
  try { add(lodgingFor(d, city), "Where you're staying", "stay"); } catch (e) {}
  return out;
}
// Everything the guide knows in this place (sights, day trips, places to eat), by id.
function gtGuidePlaces(city) {
  const out = [];
  for (const s of allSites(city)) if (gtHas(s)) out.push({ id: s.id, name: gtName(s), lat: +s.lat, lng: +s.lng, sub: txt(s.category) || (s.far ? "Day trip" : "Sight"), kind: s.far ? "trip" : "sight", site: s });
  for (const r of city.restaurants || []) if (r && !r.generic && gtHas(r)) out.push({ name: gtName(r), lat: +r.lat, lng: +r.lng, sub: txt(r.cuisine) || "Place to eat", kind: "eat" });
  return out;
}
// The traveler's words against a name: every word typed (two letters or more) starts a word of the name, or the R-38
// likeness rule (typos, most words) holds.
function gtMatch(q, name, alt) {
  const w = keyOf(q).split(" ").filter(t => t.length > 1); if (!w.length) return false;
  for (const n of [name, ...(alt || [])].filter(Boolean)) { const g = keyOf(n).split(" ");
    if (w.every(t => g.some(x => x.startsWith(t)))) return true; if (typeof stayLike === "function" && stayLike(q, n)) return true; }
  return false;
}
function gtLocal(d, city, q) {
  const own = gtOwnPoints(d, city), all = own.concat(gtGuidePlaces(city));
  if (!q.trim()) return own.concat(gtTodayStops(d, city));
  const ownWords = { ship: /\b(ship|boat|cruise|port|terminal|pier)\b/i, stay: /\b(hotel|stay|rental|apartment|airbnb|home)\b/i, leave: /\b(station|airport|train|flight)\b/i };
  return all.filter(p => gtMatch(q, p.name, p.site ? [p.site.name, p.site.local] : null) || (p.own && ownWords[p.kind] && ownWords[p.kind].test(q))).slice(0, 8);
}
function gtTodayStops(d, city) {
  try { const plan = buildPlan(d); if (!plan || plan.error) return [];
    return plan.items.filter(i => i.type === "stop" && !i.place.along && gtHas(i.place)).slice(0, 8).map(i => { const s = allSites(city).find(x => x.id === i.place.id) || i.place;
      return { id: s.id, name: gtName(s), lat: +s.lat, lng: +s.lng, sub: "On today's plan, " + fmt(i.time), kind: "sight", site: s }; }); } catch (e) { return []; }
}
// The map's answers: the R-38 pick first (a named place, the door, a short street), then other named places like the words.
async function gtMapSearch(d, city, q) {
  if (!freeAI || (typeof navigator !== "undefined" && navigator.onLine === false)) return { msg: "Searching the map needs the internet. Places your guide knows are listed above." };
  let j = null;
  try { const r = await fetch(freeAI.url + "/findplace?city=" + encodeURIComponent(bareName(d.destination)) + "&q=" + encodeURIComponent(q)); if (!r.ok) return { msg: "The map search didn't answer just now. Try again in a minute." }; j = await r.json(); }
  catch (e) { return { msg: "The map search didn't answer just now. Try again in a minute." }; }
  const mid = gtOwnPoints(d, city)[0] || allSites(city).find(s => gtHas(s)), near = p => !mid || hav(mid, p) <= GT_MAP_KM;
  const list = ((j && j.places) || []).filter(p => p && gtHas(p) && near({ lat: +p.lat, lng: +p.lng })), out = [];
  const hit = typeof stayPick === "function" ? stayPick(q, list) : null;
  if (hit) out.push({ name: gtPlant("gt-local-script") ? hit.p.name || hit.p.addr : stayLabel(hit, q), lat: +hit.p.lat, lng: +hit.p.lng, kind: "map", how: hit.how,
    sub: hit.how === "street" ? "The street, not the house number: the map doesn't have it" : hit.how === "door" ? "Address, from the map" : "From the map" + (hit.p.addr ? ", " + showName({ name: hit.p.addr }) : "") });
  for (const p of list) { if (out.length >= 5 || (hit && p === hit.p)) continue;
    const names = [p.name, ...(p.names || [])].filter(Boolean); if (!names.length || !(typeof stayLike === "function" ? names.some(n => stayLike(q, n)) : names.some(n => nameMatch(q, n)))) continue;
    if (/^(highway|boundary)$/.test(p.cat || "")) continue;
    const latinAlt = names.find(n => !nonLatin(n)), nm = gtPlant("gt-local-script") ? p.name : latinAlt || showName({ name: p.name });
    out.push({ name: nm, lat: +p.lat, lng: +p.lng, kind: "map", sub: "From the map" + (p.addr ? ", " + showName({ name: p.addr }) : "") }); }
  if (!out.length) return { msg: "I couldn't find " + (nonLatin(q) ? "that place" : "“" + q + "”") + " in " + bareName(d.destination) + " on the map. Try the name on a sign, or the street and house number." };
  return { list: out };
}
// Where the traveler is now: the phone's location when it is fresh; else where the plan has them at this time (today or
// the live preview); else the day's start. Always said which.
function gtFromChoices(d) {
  const plan = buildPlan(d), out = [];
  if (geoFresh() && (isToday(d) || !d.date)) out.push({ key: "gps", name: "where you are", lat: geoPos.lat, lng: geoPos.lng, say: "From where you are (your phone's location)" });
  if (plan && !plan.error) { const now = liveNow(d), its = plan.items.filter(i => (i.type === "start" || i.type === "stop" || (i.type === "meal" && !(i.place && i.place.onBoard))) && i.place && gtHas(i.place));
    const at = now != null ? its.filter(i => i.time <= now).pop() || its[0] : its[0];
    its.forEach((i, k) => out.push({ key: "p" + k, name: gtName(i.place), lat: +i.place.lat, lng: +i.place.lng, at: i.time, id: i.place.id,
      say: i === at ? (now != null ? "From " + gtName(i.place) + ", where your plan has you now" : "From " + gtName(i.place) + ", where your day starts") : "From " + gtName(i.place), dflt: i === at })); }
  return out;
}
const GT_ICON = { walk: "🚶", metro: "🚇", tram: "🚋", train: "🚆", bus: "🚌", ferry: "⛴️", taxi: "🚕" };
const GT_SRC = { timetable: "from the timetable", map: "a line on the map, no timetable: check at the stop", roads: "from the road map", guide: "the guide's time, not a timetable", estimate: "an estimate from the distance" };
// The ways there, from the plans' own ride layer; the next departure from a timetable when the clock is known.
function gtWays(d, from, to, now) {
  const i = trip.days.indexOf(d), leg = gtRide(i, from, to);
  if (gtPlant("gt-own-ride") || !leg) { const km = hav(from, to); return { pick: "walk", ways: [{ id: "walk", kind: "walk", how: "Walk", min: Math.max(1, Math.round(km * 1.3 / 4.5 * 60)), source: "estimate", steps: [] }], km }; }
  const ways = (leg.options && leg.options.length ? leg.options : [leg]).map(o => Object.assign({}, o));
  for (const o of ways) if (o.ans && now != null && KEngine.nextLeave) { const nx = KEngine.nextLeave(o, now); o.next = nx; o.noneLeft = nx == null && Array.isArray(o.ans.deps) && o.ans.deps.length > 0; }
  return { pick: leg.choice || (ways[0] && ways[0].id), ways: ways.sort((x, y) => x.min - y.min), note: leg.note || "", km: hav(from, to) };
}
// The ride layer: Beta 2's engine (zz-engine2), else the first app's own ride rule (its Day plan's), as one option.
function gtRide(i, a, b) {
  if (typeof window !== "undefined" && window.__kairouteRideNow) return window.__kairouteRideNow(i, a, b);
  const l = travel(a, b); if (!l) return null; const kind = l.mode === "walk" ? "walk" : l.transit ? "train" : "taxi";
  return { kind, how: l.how, min: l.min, choice: kind, source: l.transit ? "timetable" : "estimate", steps: [], slack: l.slack || 0 };
}
// A day with a time to be back: from the place, the plans' own ride back to the ship, station or airport (with its spare
// time), and the latest time to leave the place; or plainly that there isn't time.
function gtBackCheck(d, to, arrive) {
  if (gtPlant("gt-no-deadline")) return null;
  const plan = buildPlan(d); if (!plan || plan.error || !plan.w || !plan.w.tail || !plan.w.tail.length) return null;
  const end = plan.w.tail[plan.w.tail.length - 1]; if (!end || !(end.backToShip || end.deadline) || !KEngine.fin(plan.endBy)) return null;
  const i = trip.days.indexOf(d), back = gtRide(i, to, end); if (!back) return null;
  const word = deadlineWord(d), leaveBy = plan.endBy - back.min, sure = back.source === "timetable";
  return { word, backBy: plan.endBy, leaveBy, rideMin: back.min, how: back.how, kind: back.kind, sure, slack: back.slack || 0, room: arrive != null ? leaveBy - arrive : null, endName: gtName(end) };
}
function gtCardHTML(d) {
  const p = gt.pick, f = (gt.froms || []).find(x => x.key === gt.fromKey) || null;
  if (!f) return `<p class="lede">I need a place to start from. Turn on location, or open today's plan first.</p>`;
  const now = typeof window !== "undefined" && KEngine.fin(window.__kairouteGtAt) ? window.__kairouteGtAt : liveNow(d), leaveAt = now != null ? now : f.at;
  const r = gtWays(d, f, p, leaveAt), best = r.ways.find(o => o.id === r.pick) || r.ways[0];
  const est = o => o.kind !== "walk" && o.source !== "timetable" && !gtPlant("gt-confirmed");
  const row = o => `<li class="gtway${o === best ? " on" : ""}" data-kind="${esc(o.kind)}" data-src="${esc(o.source || "estimate")}"><span class="gtl1"><b>${GT_ICON[o.kind] || "🚕"} ${esc(KEngine.say(o.how, o.kind === "walk" ? "Walk" : "Taxi or car"))}</b> · <span class="gtmin">${est(o) ? "about " : ""}${dur(o.min)}</span>${o === best ? ` <span class="badge">Kairoute's pick</span>` : ""}</span>
    <span class="sub">${gtPlant("gt-confirmed") ? "" : esc(GT_SRC[o.source] || GT_SRC.estimate)}${o.next != null ? " · next one leaves about " + fmt(o.next) : o.noneLeft ? " · no more departures today in the timetable" : ""}</span>
    ${(o.steps || []).length ? `<span class="sub gtsteps">${o.steps.map(s => esc(KEngine.say(s, ""))).filter(Boolean).join(". ")}.</span>` : ""}</li>`;
  const arrive = leaveAt != null ? leaveAt + best.min : null, bc = gtBackCheck(d, p, arrive);
  let back = "";
  if (bc) {
    const basis = bc.sure || bc.kind === "walk" ? "" : bc.slack ? ` That is an estimate with ${dur(bc.slack)} spare in it; no timetable confirms it.` : " That is an estimate; no timetable confirms it.";
    if (bc.room != null && bc.room < 0) back = `<div class="banner warn gtback" role="alert" data-back="none"><span><b>Not enough time to get back.</b> Going there ${now != null ? "now" : "from " + esc(f.name)} you would arrive about ${fmt(arrive)}, but you must leave by ${fmt(bc.leaveBy)} to be back at ${esc(bc.endName)} by ${fmt(bc.backBy)} (${esc(bc.how.toLowerCase())}, ${dur(bc.rideMin)}).${basis}</span></div>`;
    else back = `<div class="banner ${bc.room != null && bc.room < 30 ? "warn" : ""} gtback" role="note" data-back="${bc.room != null && bc.room < 30 ? "short" : "ok"}"><span>To be back at ${esc(bc.endName)} by ${fmt(bc.backBy)}, leave ${esc(p.name)} by <b>${fmt(bc.leaveBy)}</b> at the latest (${esc(bc.how.toLowerCase())}, ${dur(bc.rideMin)}).${bc.room != null ? ` Arriving about ${fmt(arrive)} leaves you about ${dur(Math.max(0, bc.room))} there.` : ""}${basis} The time that counts is ${esc(bc.word)}'s own.</span></div>`;
  }
  const ll = x => (+x.lat).toFixed(5) + "," + (+x.lng).toFixed(5), gm = `https://www.google.com/maps/dir/?api=1&origin=${ll(f)}&destination=${ll(p)}&travelmode=${best.kind === "walk" ? "walking" : best.kind === "taxi" ? "driving" : "transit"}`;
  const fromSel = gt.froms.length > 1 ? `<div class="field gtfrom"><label for="gtFrom">Starting from</label><select id="gtFrom">${gt.froms.map(x => `<option value="${esc(x.key)}" ${x.key === gt.fromKey ? "selected" : ""}>${esc(x.say)}</option>`).join("")}</select></div>` : `<p class="sub gtfromline">${esc(f.say)}</p>`;
  return `<h3 class="gtdest">${esc(p.name)}</h3><p class="sub">${esc(p.sub || "")} · ${esc(distTxt(r.km))} away as the crow flies</p>${fromSel}
    ${back}<span class="eyebrow">Ways to get there</span><ul class="gtways">${r.ways.map(row).join("")}</ul>
    ${r.note ? `<p class="sub gtnote">${esc(KEngine.say(r.note, ""))}</p>` : ""}
    <div class="actions"><a class="btn ghost small" target="_blank" rel="noopener" href="${gm}">🗺 Directions in Google Maps</a><button class="btn ghost small" data-act="gtback">‹ Search again</button></div>`;
}
function gtResultsHTML() {
  const it = (x, k, src) => `<button class="btn ghost gtres" data-act="gtpick" data-src="${src}" data-k="${k}"><b>${esc(x.name)}</b><small>${esc(x.sub || "")}</small></button>`;
  const loc = (gt.list || []).map((x, k) => it(x, k, "l")).join(""), map = (gt.map || []).map((x, k) => it(x, k, "m")).join("");
  return `${loc ? `<span class="eyebrow">${gt.q.trim() ? "In your trip and guide" : "Your places today"}</span><div class="bookres">${loc}</div>` : ""}
    ${gt.busy ? `<p class="banner" role="status"><span class="spinner"></span> Searching the map…</p>` : ""}
    ${map ? `<span class="eyebrow">On the map</span><div class="bookres">${map}</div>` : ""}
    ${gt.mapMsg ? `<p class="lede small gtmsg" role="status">${esc(gt.mapMsg)}</p>` : ""}
    ${gt.q.trim() && !gt.asked && !gt.busy ? `<button class="btn small" data-act="gtmap">${nonLatin(gt.q) ? "Search the map" : "Search the map for “" + esc(gt.q.trim()) + "”"}</button>` : ""}`;
}
function gtSheet() {
  let el = document.getElementById("gtSheet"); if (!gt) { if (el) el.remove(); return; }
  const d = gtDay(); if (!d) { gt = null; if (el) el.remove(); return; }
  const fresh = !el;
  if (fresh) { el = document.createElement("div"); el.id = "gtSheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Get there"); document.body.appendChild(el);
    el.addEventListener("click", e => { if (e.target === el) { gt = null; gtSheet(); } }); }
  if (gt.pick) { el.innerHTML = `<div class="sheet"><div class="actions gttop"><span class="eyebrow">Get there</span><button class="btn ghost small" data-act="gtclose">Close</button></div><div class="gtcard">${gtCardHTML(d)}</div><p class="ai-note">Places from your guide and OpenStreetMap; ways and times from the same ride rules as your plan. Nothing is made up.</p></div>`; return; }
  if (fresh || !el.querySelector("#gtQ")) el.innerHTML = `<div class="sheet"><div class="actions gttop"><span class="eyebrow">Get there</span><button class="btn ghost small" data-act="gtclose">Close</button></div>
    <form class="ask gtask" data-gtform="1" role="search"><input type="search" id="gtQ" enterkeyhint="search" autocomplete="off" placeholder="A sight, station, restaurant or address" aria-label="Where do you want to go?" value="${esc(gt.q)}"><button type="submit" class="btn small">Search</button></form>
    <div id="gtRes" aria-live="polite"></div><p class="ai-note">Places from your guide and OpenStreetMap. Nothing is made up.</p></div>`;
  el.querySelector("#gtRes").innerHTML = gtResultsHTML();
  if (fresh) setTimeout(() => { const q = document.getElementById("gtQ"); if (q && !(window.matchMedia && matchMedia("(pointer: coarse)").matches && !q.value)) q.focus(); }, 0);
}
function gtType(q) { const d = gtDay(); if (!d || !gt) return; const city = cityFor(d); gt.q = q; gt.asked = false; gt.map = []; gt.mapMsg = ""; gt.list = city ? gtLocal(d, city, q) : []; gtSheet(); }
async function gtAskMap() {
  const d = gtDay(), city = d && cityFor(d); if (!gt || !city || !gt.q.trim()) return; const q = gt.q.trim();
  gt.busy = true; gt.asked = true; gtSheet();
  const r = await gtMapSearch(d, city, q); if (!gt || gt.q.trim() !== q) return;
  gt.busy = false; const seen = gt.list || [];
  gt.map = (r.list || []).filter(x => !seen.some(y => hav(x, y) < 0.06 && nameMatch(x.name, y.name)));
  gt.mapMsg = r.msg || (r.list && !gt.map.length ? "The map found only the places listed above." : ""); gtSheet();
}
async function gtChoose(x) {
  const d = gtDay(); if (!d || !x) return;
  gt.pick = x; gt.froms = gtFromChoices(d);
  // The phone's location, asked only now, from the traveler's own tap, and only on the day itself.
  if (isToday(d) && !geoFresh() && navigator.geolocation) { gt.fromKey = (gt.froms.find(f => f.dflt) || gt.froms[0] || {}).key; gtSheet();
    const pos = await camPosition(); if (pos && gt && gt.pick === x) { gt.froms = gtFromChoices(d); gt.fromKey = "gps"; } }
  else gt.fromKey = ((gt.froms.find(f => f.key === "gps")) || gt.froms.find(f => f.dflt) || gt.froms[0] || {}).key;
  gtAskRides(d); gtSheet();
}
// The street routes and timetables for the ride there and the ride back are asked as the plans' rides are; the card is
// drawn again as each answer arrives (the ride layer reads them through the app's kept answers).
let gtGen = -1, gtTimer = 0;
function gtAskRides(d) {
  const f = (gt.froms || []).find(x => x.key === gt.fromKey), p = gt.pick; if (!f || !p) return;
  const pairs = [], km = hav(f, p); if (km <= 3) pairs.push(["foot", f, p]); if (km > 0.5) pairs.push(["car", f, p]);
  try { if (pairs.length && typeof askRouteTimes === "function") askRouteTimes(pairs); } catch (e) {}
  clearInterval(gtTimer); gtGen = typeof nearGen !== "undefined" ? nearGen : 0;
  gtTimer = setInterval(() => { if (!gt || !gt.pick) { clearInterval(gtTimer); return; } if (typeof nearGen !== "undefined" && nearGen !== gtGen) { gtGen = nearGen; gtSheet(); } }, 1500);
}
function gtAct(act, t) {
  if (act === "gtopen") { const d = gtDay(); if (!d) return true; gt = { q: "", list: [], map: [] }; gtType(""); return true; }
  if (act === "gtclose") { gt = null; clearInterval(gtTimer); gtSheet(); return true; }
  if (act === "gtback") { const q = gt ? gt.q : ""; gt = { q, list: [], map: [] }; const el = document.getElementById("gtSheet"); if (el) el.innerHTML = ""; gtType(q); return true; }
  if (act === "gtmap") { gtAskMap(); return true; }
  if (act === "gtpick") { const x = gt && (t.dataset.src === "m" ? gt.map : gt.list)[+t.dataset.k]; if (x) gtChoose(x); return true; }
  return false;
}
if (typeof document !== "undefined") {
  document.addEventListener("input", e => { if (e.target && e.target.id === "gtQ") gtType(e.target.value); });
  document.addEventListener("submit", e => { if (e.target && e.target.dataset && e.target.dataset.gtform) { e.preventDefault(); const q = document.getElementById("gtQ"); if (q) gt.q = q.value; gtAskMap(); } });
  document.addEventListener("change", e => { if (e.target && e.target.id === "gtFrom" && gt) { gt.fromKey = e.target.value; gtAskRides(gtDay()); gtSheet(); } });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && gt) { gt = null; gtSheet(); } });
  document.head.insertAdjacentHTML("beforeend", `<style id="gt-css">
#gtSheet { position: fixed; inset: 0; z-index: 80; background: rgba(0,0,0,.45); display: flex; align-items: flex-end; justify-content: center; }
#gtSheet .sheet { background: var(--card); color: var(--ink); width: min(640px, 100%); max-height: 88vh; overflow: auto; padding: 18px; border-radius: 10px 10px 0 0; display: grid; gap: 10px; }
#gtSheet .gttop { justify-content: space-between; align-items: center; margin: 0; }
#gtSheet .gtask { display: flex; gap: 8px; } #gtSheet .gtask input { flex: 1; min-width: 0; min-height: 44px; font-size: 1rem; }
#gtSheet .gtres { width: 100%; }
#gtSheet .gtways { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
#gtSheet .gtway { border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; display: grid; gap: 2px; }
#gtSheet .gtway.on { border-color: var(--route); background: var(--route-soft); }
#gtSheet .gtway .sub { font-size: .86rem; color: var(--muted); }
#gtSheet h3.gtdest { margin: 0; }
#gtSheet .gtback { margin: 0; }
@media (min-width: 900px) { #gtSheet { align-items: center; } #gtSheet .sheet { border-radius: 10px; } }
</style>`);
}
if (typeof window !== "undefined") window.__kairouteGetThere = () => gt ? { q: gt.q, list: (gt.list || []).map(x => x.name), map: (gt.map || []).map(x => x.name), pick: gt.pick && gt.pick.name, from: gt.fromKey } : null;
