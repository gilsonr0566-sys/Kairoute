// ===================== Build a trip step by step, no AI (Richard, Nov 17) =====================
// The traveler enters the trip as it is booked, one stop at a time: a city stay (where, the day you arrive, how many
// nights, how you get there) or a cruise (where and when you board, each port with its times, where it ends). Dates
// and times are picked, not typed, and each new stop starts from the one before it (the next stay begins the day the
// last one ends, a cruise boards where you are, the next port is the next day), so a whole trip takes a few taps a
// stop. The days are laid out by fixed rules, the same for every trip: arrival and leaving days, sightseeing days in
// between, the boarding day, port days with their times, sea days for the dates between ports, and getting off the
// ship. Nothing is guessed: a time left empty is marked as estimated and the day says so. The AI reading of a
// description or a photo stays as an optional shortcut when the AI guide is on.
const TS_MOVE = [["flight", "Flight"], ["train", "Train"], ["ferry", "Ferry"], ["car", "Car or bus"]];
// inGate: the airport or station you arrive at; fromGate: the one you leave the stop before from; homeGate: the one you
// leave from to go home. leaveNight / homeNight: a leaving time in the small hours is "morning" (early that day) or
// "night" (late that night, after midnight), asked as it is typed (R-01, R-41).
const tsStay = o => Object.assign({ k: "stay", place: "", date: "", nights: 3, inBy: "flight", leaveAt: "", inAt: "", inGate: "", fromGate: "", leaveNight: "", hotel: "", homeBy: "flight", homeAt: "", homeGate: "", homeNight: "" }, o || {});
const tsCruise = o => Object.assign({ k: "cruise", ship: "", board: "", date: "", aboard: "", inBy: "flight", leaveAt: "", inAt: "", inGate: "", fromGate: "", leaveNight: "", ports: [], end: "", endDate: "", off: "", homeBy: "flight", homeAt: "", homeGate: "", homeNight: "" }, o || {});
const tsPort = o => Object.assign({ date: "", place: "", arrive: "", aboard: "", tender: false }, o || {});
const tsEnd = l => l.k === "stay" ? (l.date ? addDays(l.date, Math.max(0, +l.nights || 0)) : "") : l.endDate;
const tsWhere = l => l.k === "stay" ? l.place : l.end;
// The same city, however it is typed: "Athens", "Athens, Greece", "Piraeus (Athens)" (the form's own example for a cruise
// port) and "Athens (Piraeus)" are all the same place as a stay in Athens (Round 1 part 2: a stay in a city and the cruise
// from its port the same day became a flight out and a flight in, with times made up).
const tsNames = x => { const E = typeof KEngine !== "undefined" ? KEngine : null, out = [bareName(x)];
  if (E && E.placeOnly) out.push(E.placeOnly(x), E.bracketPlace(x)); return out.map(keyOf).filter(Boolean); };
const tsSame = (a, b) => { if (!a || !b) return false; const A = tsNames(a), B = tsNames(b); return A.some(k => B.includes(k)); };
// Does this stop start where and when the one before it ends (off the ship into a stay, a stay straight onto the ship)?
function tsJoined(prev, l) {
  if (!prev) return false;
  if (l.k === "stay") return prev.k === "cruise" && tsSame(prev.end, l.place) && prev.endDate === l.date;
  return prev.k === "stay" && tsSame(prev.place, l.board) && tsEnd(prev) === l.date;
}
// A new stop starts where the last one ends.
function tsNext(kind, legs) {
  const last = legs[legs.length - 1], end = last ? tsEnd(last) : "", at = last ? tsWhere(last) : "";
  if (kind === "cruise") return tsCruise({ board: at, date: end, ports: [tsPort({ date: end ? addDays(end, 1) : "" })] });
  return tsStay({ place: last && last.k === "cruise" ? at : "", date: end, inBy: last && last.k === "cruise" ? "flight" : "train" });
}
function tsFill(legs) { // empty dates follow from the stop before (the reader can leave them as offered)
  legs.forEach((l, i) => { const prev = legs[i - 1];
    if (l.k === "cruise") { l.ports.forEach((p, j) => { if (!p.date) { const b = j ? l.ports[j - 1].date : l.date; if (b) p.date = addDays(b, 1); } });
      if (!l.endDate && l.ports.length && l.ports[l.ports.length - 1].date) l.endDate = addDays(l.ports[l.ports.length - 1].date, 1); }
    if (!l.date && prev && tsEnd(prev)) l.date = tsEnd(prev);
  });
}
// What's missing or out of order, in plain words (one message, the first problem first).
function tsCheck(legs) {
  if (!legs.length) return "Add where you're going first.";
  for (let i = 0; i < legs.length; i++) {
    const l = legs[i], prev = legs[i - 1], n = "Stop " + (i + 1);
    if (l.k === "stay") {
      if (!bareName(l.place)) return `${n}: type the city.`;
      if (!l.date) return `${n}: pick the day you arrive in ${l.place}.`;
      if (!(+l.nights >= 0)) return `${n}: how many nights in ${l.place}?`;
    } else {
      if (!bareName(l.board)) return `${n}: type where the cruise leaves from.`;
      if (!l.date) return `${n}: pick the day you board.`;
      if (!bareName(l.end)) return `${n}: type where the cruise ends.`;
      if (!l.endDate) return `${n}: pick the day the cruise ends.`;
      if (l.endDate <= l.date) return `${n}: the cruise must end after the day you board.`;
      for (const p of l.ports) {
        if (!p.date && !bareName(p.place)) continue;
        if (!bareName(p.place)) return `${n}: type the port for ${fmtDate(p.date)}, or remove that port.`;
        if (!p.date) return `${n}: pick the date for ${p.place}.`;
        if (p.date <= l.date || p.date >= l.endDate) return `${n}: ${p.place} on ${fmtDate(p.date)} is outside the cruise (${fmtDate(l.date)} to ${fmtDate(l.endDate)}).`;
        if (p.arrive && p.aboard && p.aboard <= p.arrive) return `${n}: in ${p.place} the all-aboard time must be after the ship arrives.`;
      }
      const ds = l.ports.filter(p => p.date).map(p => p.date); if (new Set(ds).size < ds.length) return `${n}: two ports have the same date.`;
    }
    if (prev && tsEnd(prev) && l.date < tsEnd(prev)) return `${n} starts ${fmtDate(l.date)}, before the stop before it ends (${fmtDate(tsEnd(prev))}).`;
  }
  return "";
}
// ---- R-41: every detail a day's plan depends on is asked here, up front (Richard, Nov 27: "all the information that has
// to be entered for a trip needs to be asked upfront and not leave it to be located to be filled in") ----
// What the planner and the safety checks use for each day: the time each flight, train, ferry or car arrives and leaves,
// which airport or station it uses (a city can have several, and the time to get there depends on which), the hotel
// (every day starts and ends there), the ship's all-aboard time on the boarding day, each port's arrival and all-aboard
// times, the time off the ship, and for a departure in the small hours whether it is that morning or that night. Every
// one has a field on this form. Before the trip is made, the ones left empty are listed together, each one tap from its
// field; the traveler fills them in, or says they don't know them yet. A detail not known yet is never filled in as if it
// were real: the day says it's missing and the Trip page lists it until it's added (tripNeeds below).
const TS_GATE = { flight: "airport", train: "station" };
const tsSmall = t => /^\d\d:\d\d$/.test(t || "") && t < "05:00";
const tsRide = m => ({ flight: "flight", train: "train", ferry: "ferry" })[m] || "";
function tsNeeds(legs) {
  const out = [], need = (f, what) => out.push({ f, what }), nm = x => bareName(x || "") || "there";
  legs.forEach((l, i) => {
    const prev = legs[i - 1], here = nm(l.k === "stay" ? l.place : l.board), id = k => `ts-${i}-${k}`;
    if (!tsJoined(prev, l)) {
      const r = tsRide(l.inBy), from = prev ? nm(tsWhere(prev)) : "";
      if (prev && !l.leaveAt) need(id("leaveAt"), r ? `When your ${r} leaves ${from}` : `When you leave ${from}`);
      if (prev && TS_GATE[l.inBy] && !bareName(l.fromGate)) need(id("fromGate"), `Which ${TS_GATE[l.inBy]} you leave ${from} from`);
      if (prev && tsSmall(l.leaveAt) && !l.leaveNight) need(id("leaveNight"), `Whether your ${l.leaveAt} ${r || "departure"} is early in the morning or late at night`);
      if (!l.inAt) need(id("inAt"), r ? `When your ${r} ${l.inBy === "flight" ? "lands" : "arrives"} in ${here}` : `When you arrive in ${here}`);
      if (TS_GATE[l.inBy] && !bareName(l.inGate)) need(id("inGate"), `Which ${TS_GATE[l.inBy]} you arrive at in ${here}`);
    }
    if (l.k === "stay") { if ((+l.nights || 0) > 0 && !bareName(l.hotel)) need(id("hotel"), `Your hotel in ${here}`); }
    else {
      if (!l.aboard) need(id("aboard"), `All-aboard time on boarding day in ${here}`);
      l.ports.forEach((p, j) => { if (!bareName(p.place)) return;
        if (!p.arrive) need(id(`p${j}-arrive`), `When the ship arrives in ${nm(p.place)}`);
        if (!p.aboard) need(id(`p${j}-aboard`), `All-aboard time in ${nm(p.place)}`); });
      if (!l.off) need(id("off"), `When you're off the ship in ${nm(l.end)}`);
    }
    if (i === legs.length - 1) { const r = tsRide(l.homeBy), at = nm(tsWhere(l));
      if (!l.homeAt) need(id("homeAt"), r ? `When your ${r} home leaves ${at}` : `When you leave ${at} to go home`);
      if (TS_GATE[l.homeBy] && !bareName(l.homeGate)) need(id("homeGate"), `Which ${TS_GATE[l.homeBy]} you leave ${at} from`);
      if (tsSmall(l.homeAt) && !l.homeNight) need(id("homeNight"), `Whether your ${l.homeAt} ${r || "departure"} is early in the morning or late at night`); }
  });
  return out;
}
// The list, shown before the trip is made (wiz.missAsk: "build" or "more", the button that asked).
function tsNeedHTML(w) {
  if (!w.missAsk) return ""; const n = tsNeeds(w.legs); if (!n.length) return "";
  return `<div class="card tsneed" role="alert" id="tsNeed"><h3>Your plan needs ${n.length === 1 ? "one more detail" : n.length + " more details"} from your bookings</h3>
    <p class="lede small">Kairoute plans each day around these. Fill in what you have. Anything you don't know yet stays on your Trip page as "still needed" until you add it, and the days it affects say so: a time you haven't given is never shown as confirmed.</p>
    <ul class="tips tsneedlist">${n.map(x => `<li><button type="button" class="linkbtn" data-ts="needgo" data-f="${esc(x.f)}">${esc(x.what)}</button></li>`).join("")}</ul>
    <div class="actions"><button type="button" class="btn" data-ts="needgo" data-f="${esc(n[0].f)}">Fill them in</button><button type="button" class="btn ghost" data-ts="needok">I don't know ${n.length === 1 ? "it" : "these"} yet, continue</button></div></div>`;
}
// Before the trip is made (or before "Personalize first" leaves this page): the details left empty are asked, once.
function tsAskNeeds(next) {
  if (!wiz || !wiz.legs || wiz.unknownOk || !tsNeeds(wiz.legs).length) return false;
  wiz.missAsk = next; wiz.step = 0; aiError = ""; render();
  const c = document.getElementById("tsNeed"); if (c) c.scrollIntoView({ block: "start" }); return true;
}
// The airports and stations a city's own guide lists (offered as the traveler types).
function tsGateNames(place, kind) {
  const k = keyOf(bareName(place || "")); if (!k || !kind) return [];
  const out = []; try { ensureBuiltins(); for (const [c] of BUILTIN_CITIES) if (keyOf(bareName(c.city)) === k) ((c.starts || {})[kind] || []).forEach(g => out.push(g.name)); } catch (e) {}
  Object.values(cities).forEach(c => { if (c && keyOf(bareName(c.city || "")) === k) ((c.starts || {})[kind] || []).forEach(g => { if (!g.unknown) out.push(g.name); }); });
  return [...new Set(out)];
}
// After the guides are in: each airport or station the traveler named is matched to the city's own list, else found on
// the map (the same lookup the day uses, pierSearch); one clear answer is used, else the day asks with the name filled in.
async function tsGates() {
  for (const d of trip.days) {
    if (!d.gateWant || d.gate || d.pointPicked) continue;
    const kind = askKind(d), city = cityFor(d); if (!city || (kind !== "airport" && kind !== "station")) continue;
    const want = keyOf(d.gateWant), code = /^[A-Z]{3}$/.test(d.gateWant.trim()) ? d.gateWant.trim() : "";
    // Every word the traveler typed (past "airport", "station" and the like) is in the listed name, or the code is.
    const words = n => keyOf(n || "").split(/[^a-z0-9]+/).filter(x => x.length > 2 && !/^(airport|station|international|the|and|railway|train|terminal)$/.test(x));
    const list = pointList(city, kind), mine = words(d.gateWant);
    const hits = list.map((p, idx) => ({ p, idx })).filter(({ p }) => !p.unknown && (keyOf(p.name) === want || (code && new RegExp("\\b" + code + "\\b").test(p.name || "")) || (mine.length && mine.every(x => words(p.name).includes(x)))));
    if (hits.length === 1) { d.pointIdx = hits[0].idx; d.pointPicked = true; save(); continue; }
    if (typeof navigator !== "undefined" && navigator.onLine === false) continue;
    try {
      const ss = allSites(city).filter(x => KEngine.fin(x.lat)), mid = ss.length ? { lat: ss.map(x => +x.lat).sort((a, b) => a - b)[ss.length >> 1], lng: ss.map(x => +x.lng).sort((a, b) => a - b)[ss.length >> 1] } : null;
      const r = freeAI ? await fetch(freeAI.url + "/findplace?city=" + encodeURIComponent(bareName(d.destination)) + "&q=" + encodeURIComponent(d.gateWant)) : null, j = r && r.ok ? await r.json() : null;
      const K = typeof SG_KIND !== "undefined" ? SG_KIND[kind] : null;
      const ok = ((j && j.places) || []).filter(m => KEngine.fin(m.lat) && KEngine.fin(m.lng) && (!mid || hav(mid, m) <= (kind === "airport" ? 60 : 30)))
        .filter(m => !K || K.map.test(String(m.kind || "")) || K.re.test(String(m.name || "")))
        .filter(m => kind !== "airport" || !KEngine.gateOk || (KEngine.gateOk("airport", m) && !(KEngine.NOT_BUILT && KEngine.NOT_BUILT.test(String(m.name || "") + " " + String(m.kind || "")))));
      const one = ok.filter((m, i) => !ok.slice(0, i).some(y => hav(y, m) < 1));
      if (one.length === 1) { d.gate = Object.assign({ name: one[0].name, lat: +(+one[0].lat).toFixed(5), lng: +(+one[0].lng).toFixed(5), kind }, one[0].kind ? { mapKind: String(one[0].kind) } : {}); save(); }
    } catch (e) {}
  }
  render();
}
// ---- R-41 on every trip, however it was made (this form, a description, a photo, a day added by hand) ----
// Every detail a day's plan depends on that the traveler hasn't given: a time filled in with a typical one (estimated)
// or left empty, an airport, station or pier the day has to ask about, a hotel not given. Listed on the Trip page, each
// one tap from the field that takes it, with how many days are left before the trip, until all are in.
function tripNeeds() {
  const out = [], today = typeof todayISO === "function" ? todayISO() : "";
  const seenHotel = {};
  trip.days.forEach((d, i) => {
    if (!d || d.type === "sea" || noShore(d) || (today && d.date && d.date < today)) return;
    const place = placeLabel(d) || bareName(d.destination || "") || "this day", when = d.date ? ` (${fmtDow(d.date)} ${fmtDate(d.date)})` : "", r = tsRide(d.mode);
    const add = (f, what) => out.push({ i, f, what: what + when });
    if (d.type === "arrival" && (d.estimated || !d.time)) add("f-time", d.mode === "ship" ? `When you're off the ship in ${place}` : r ? `When your ${r} ${d.mode === "flight" ? "lands" : "arrives"} in ${place}` : `When you arrive in ${place}`);
    if (d.type === "departure" && (d.estimated || !d.time)) add("f-time", r ? `When your ${r} leaves ${place}` : `When you leave ${place}`);
    if (d.type === "departure" && !d.estimated && tsSmall(d.time) && d.nightDep !== "morning" && d.nightDep !== "night") add("f-time", `Whether your ${d.time} ${r || "departure"} from ${place} is early in the morning or late at night`);
    if (d.type === "embark" && (d.estimated || !d.allAboard)) add("f-aboard", `All-aboard time on boarding day in ${place}`);
    if (d.type === "port" && (d.estimated || !d.portArrive || !d.allAboard)) add("f-parr", `The ship's arrival and all-aboard times in ${place}`);
    const city = cityFor(d), kind = askKind(d);
    if (city && kind && (d.type !== "arrival" || d.mode !== "ship")) { let P = null; try { P = dayPoint(d, city); } catch (e) {}
      if (!P || unsurePoint(P) || P.notGate || (P.ask && P.ask.length > 1)) add("f-point", kind === "cruise" ? `Which pier the ship docks at in ${place}` : `Which ${kind} you ${d.type === "arrival" ? "arrive at in" : "leave from in"} ${place}`); }
    const stay = d.type === "land" || (d.type === "arrival" && !throughTo(d) && !(d.mode === "ship" && i === trip.days.length - 1)) || (d.type === "departure" && !throughFrom(d));
    const k = cityKeyFor(d) || keyOf(d.destination || "");
    if (stay && k && !seenHotel[k]) { seenHotel[k] = 1; const L = trip.lodging && trip.lodging[k];
      if (!L || (L.idx === "custom" && !(L.ll && KEngine.fin(L.ll.lat)))) out.push({ i, f: "f-lodging", what: L && L.idx === "custom" && (L.typed || L.name) ? `Where ${L.typed || L.name} is in ${place} (${L.failed && window.__kairoutePlant !== "stay-down-label" ? "not placed on the map yet: the map search didn't answer" : L.miss ? "not found on the map" : "not placed on the map yet"})` : `Your hotel in ${place}` }); }
  });
  return out;
}
function tripNeedsHTML() {
  if (!trip || trip.sample) return ""; const n = tripNeeds(); if (!n.length) return "";
  const first = trip.days.map(d => d.date).filter(Boolean).sort()[0], today = typeof todayISO === "function" ? todayISO() : "";
  const left = first && today ? Math.round((Date.parse(first) - Date.parse(today)) / 864e5) : null;
  const when = left == null || left < 0 ? "" : left === 0 ? " Your trip starts today." : left === 1 ? " Your trip starts tomorrow." : ` Your trip starts in ${left} days.`;
  return `<div class="card tsneed tripneeds" role="status"><h3>Still needed for your plan: ${n.length}</h3>
    <p class="lede small">Each day is planned around these details from your bookings.${when} Until they're in, the days they affect say what's missing, and a time you haven't given is never shown as confirmed.</p>
    <ul class="tips tsneedlist">${n.slice(0, 12).map(x => `<li><button type="button" class="linkbtn" data-act="needgo" data-i="${x.i}" data-f="${esc(x.f)}">${esc(x.what)}</button></li>`).join("")}</ul>
    ${n.length > 12 ? `<p class="hint">And ${n.length - 12} more, listed here as you add these.</p>` : ""}</div>`;
}
// What a day says when a time on it isn't from the traveler's booking yet, in the words of that day (R-18: a flight day
// never talks about port times).
function estLine(d) {
  if (!d || !d.estimated || d.type === "sea" || d.type === "land") return "";
  if (d.type === "port") return "These port times are estimated, not from your booking yet: typical times, not confirmed. Check them against your cruise documents and add the real ones on the Trip page.";
  if (d.type === "embark") return "The all-aboard time is estimated, not from your booking yet: a typical time, not confirmed. Check it against your cruise documents and add it on the Trip page.";
  if (d.type === "arrival" && d.mode === "ship") return "The time you're off the ship is estimated, not from your booking yet. Check it against your cruise documents and add it on the Trip page.";
  const r = tsRide(d.mode); return `Your ${r || "travel"} time isn't from your booking yet. Add it on the Trip page.`;
}
if (typeof window !== "undefined") window.__kairouteTripNeeds = () => tripNeeds().map(x => x.what);
// The days, by the same rules for every trip.
function tsDays(legs) {
  const days = [], hotels = [], est = t => !t;
  // The airport or station the traveler named for this ride (found on the map once the city's guide is in, tsGates), and
  // their answer for a small-hours departure (the day's nightDep, R-01).
  const gw = (o, gate, night) => { if (bareName(gate || "") && TS_GATE[o.mode]) o.gateWant = String(gate).trim();
    if ((night === "morning" || night === "night") && o.time && tsSmall(o.time)) o.nightDep = night; return o; };
  const add = o => days.push(newDay(Object.assign({ hours: o.type === "arrival" ? 6 : 8 }, o)));
  legs.forEach((l, i) => {
    const prev = legs[i - 1], next = legs[i + 1], joinedIn = tsJoined(prev, l), joinedOut = next && tsJoined(l, next);
    if (l.k === "stay") {
      if (!joinedIn) add(gw({ date: l.date, destination: l.place.trim(), type: "arrival", mode: l.inBy, time: l.inAt || (l.inBy === "flight" ? "10:30" : "11:00"), estimated: est(l.inAt) }, l.inGate));
      for (let k = 1; k < (+l.nights || 0); k++) add({ date: addDays(l.date, k), destination: l.place.trim(), type: "land" });
      const last = tsEnd(l);
      if (!joinedOut && (+l.nights || 0) >= 0) {
        const by = next ? next.inBy : l.homeBy, at = next ? next.leaveAt : l.homeAt;
        if (next || l.homeAt || (+l.nights || 0) > 0) add(gw({ date: last, destination: l.place.trim(), type: "departure", mode: by, time: at || (by === "flight" ? "15:00" : "12:00"), estimated: est(at) }, next ? next.fromGate : l.homeGate, next ? next.leaveNight : l.homeNight));
      }
      if (bareName(l.hotel)) hotels.push({ place: l.place.trim(), name: l.hotel.trim() });
    } else {
      if (!joinedIn) add(gw({ date: l.date, destination: l.board.trim(), type: "arrival", mode: l.inBy, time: l.inAt || "10:30", estimated: est(l.inAt) }, l.inGate));
      add({ date: l.date, destination: l.board.trim(), type: "embark", allAboard: l.aboard || "17:00", estimated: est(l.aboard) });
      const ports = l.ports.filter(p => p.date && bareName(p.place)).sort((a, b) => a.date.localeCompare(b.date));
      for (let dt = addDays(l.date, 1); dt < l.endDate; dt = addDays(dt, 1)) {
        const p = ports.find(x => x.date === dt);
        if (p) add({ date: dt, destination: p.place.trim(), type: "port", portArrive: p.arrive || "08:00", allAboard: p.aboard || "17:00", tender: !!p.tender, estimated: est(p.arrive) || est(p.aboard) });
        else add({ date: dt, destination: "At sea", type: "sea" });
      }
      add({ date: l.endDate, destination: l.end.trim(), type: "arrival", mode: "ship", time: l.off || "07:30", estimated: est(l.off) });
      if (!joinedOut && (next || l.homeAt)) { const by = next ? next.inBy : l.homeBy, at = next ? next.leaveAt : l.homeAt;
        add(gw({ date: l.endDate, destination: l.end.trim(), type: "departure", mode: by, time: at || (by === "flight" ? "15:00" : "12:00"), estimated: est(at) }, next ? next.fromGate : l.homeGate, next ? next.leaveNight : l.homeNight)); }
    }
  });
  const ship = legs.find(l => l.k === "cruise" && bareName(l.ship));
  return { days, hotels, ship: ship ? { line: "", name: ship.ship.trim() } : null };
}
// ---- The form ----
// A field the plan needs and the traveler left empty is marked once they've been asked (wiz.missAsk), so it's easy to find.
const tsNeedMark = (id, v) => wiz && wiz.missAsk && !String(v || "").trim() ? ` aria-invalid="true"` : "";
const tsTimeF = (id, label, v, hint) => `<div class="field"><label for="${id}">${label}</label><input type="time" id="${id}" data-tsf="${id}" value="${esc(v || "")}"${tsNeedMark(id, v)}>${hint ? `<span class="hint">${hint}</span>` : ""}</div>`;
// Which airport or station, typed as the booking shows it; the city's own list is offered as they type.
function tsGateF(id, label, v, place, mode) {
  const kind = TS_GATE[mode]; if (!kind) return "";
  const names = tsGateNames(place, kind);
  return `<div class="field"><label for="${id}">${label}</label><input type="text" id="${id}" data-tsf="${id}" ${names.length ? `list="${id}-l"` : ""} value="${esc(v || "")}" placeholder="${kind === "airport" ? "Name or code from your booking" : "Station name on your ticket"}" autocomplete="off"${tsNeedMark(id, v)}>${names.length ? `<datalist id="${id}-l">${names.map(n => `<option value="${esc(n)}">`).join("")}</datalist>` : ""}</div>`;
}
// A leaving time in the small hours: that morning, or late that night after midnight (asked as it's typed, R-01).
function tsNightF(id, key, i, t, date, v) {
  if (!tsSmall(t)) return "";
  const day = date ? `${fmtDow(date)} ${fmtDate(date)}` : "that day";
  return `<div class="field"><span class="lbl" id="${id}">${esc(t)} is in the small hours. Which is it?</span><div class="seg" role="group" aria-labelledby="${id}"${wiz && wiz.missAsk && !v ? ` aria-invalid="true"` : ""}><button type="button" data-ts="set" data-i="${i}" data-key="${key}" data-v="morning" aria-pressed="${v === "morning"}">Early on ${esc(day)}</button><button type="button" data-ts="set" data-i="${i}" data-key="${key}" data-v="night" aria-pressed="${v === "night"}">Late on ${esc(day)}, after midnight</button></div></div>`;
}
const tsSeg = (i, key, v, list) => `<div class="seg" role="group" aria-label="How you travel">${list.map(([k, l]) => `<button type="button" data-ts="set" data-i="${i}" data-key="${key}" data-v="${k}" aria-pressed="${v === k}">${l}</button>`).join("")}</div>`;
function tsGetHere(l, i, legs) {
  const prev = legs[i - 1]; if (tsJoined(prev, l)) return "";
  const from = prev ? tsWhere(prev) : "", word = l.k === "cruise" ? "Getting to the ship" : "Getting there", here = l.k === "cruise" ? l.board : l.place;
  const kind = TS_GATE[l.inBy], K = kind ? kind[0].toUpperCase() + kind.slice(1) : "";
  return `<div class="field"><span class="lbl">${word}${l.k === "cruise" ? " (if you arrive the same day)" : ""}</span>${tsSeg(i, "inBy", l.inBy, TS_MOVE)}</div>
    ${prev && from ? `<div class="row2">${tsTimeF(`ts-${i}-leaveAt`, `Leave ${esc(bareName(from))} at`, l.leaveAt)}${tsGateF(`ts-${i}-fromGate`, `${K} in ${esc(bareName(from))}`, l.fromGate, from, l.inBy)}</div>${tsNightF(`ts-${i}-leaveNight`, "leaveNight", i, l.leaveAt, tsEnd(prev), l.leaveNight)}` : ""}
    <div class="row2">${tsTimeF(`ts-${i}-inAt`, `Arrive in ${esc(bareName(here) || "town")} at`, l.inAt)}${tsGateF(`ts-${i}-inGate`, `${K} in ${esc(bareName(here) || "town")}`, l.inGate, here, l.inBy)}</div>`;
}
// How the trip ends is asked once, after the last stop and the buttons that add more (outside review, Nov 20: it was
// asked on the first stop, before the traveler had said where else they were going).
function tsGoHome(l, i, legs) {
  if (!l || i !== legs.length - 1) return "";
  const at = tsWhere(l), kind = TS_GATE[l.homeBy];
  return `<div class="tsleg tshome"><div class="field"><span class="lbl">Going home from ${esc(bareName(at) || "here")}</span>${tsSeg(i, "homeBy", l.homeBy, TS_MOVE)}</div>
    <div class="row2">${tsTimeF(`ts-${i}-homeAt`, `${l.homeBy === "flight" ? "Flight" : l.homeBy === "train" ? "Train" : l.homeBy === "ferry" ? "Ferry" : "Leave"} at`, l.homeAt)}${tsGateF(`ts-${i}-homeGate`, `${kind ? kind[0].toUpperCase() + kind.slice(1) : ""} in ${esc(bareName(at) || "town")}`, l.homeGate, at, l.homeBy)}</div>
    ${tsNightF(`ts-${i}-homeNight`, "homeNight", i, l.homeAt, tsEnd(l), l.homeNight)}</div>`;
}
function tsLegHTML(l, i, legs) {
  const head = `<div class="tshead"><span class="eyebrow">Stop ${i + 1} · ${l.k === "stay" ? "City stay" : "Cruise"}</span>${legs.length > 1 ? `<button type="button" class="linkbtn" data-ts="del" data-i="${i}" aria-label="Remove stop ${i + 1}">Remove</button>` : ""}</div>`;
  if (l.k === "stay") return `<div class="tsleg" data-leg="${i}">${head}
    <div class="row2"><div class="field"><label for="ts-${i}-place">City</label><input type="text" id="ts-${i}-place" data-tsf="ts-${i}-place" list="ts-cities" value="${esc(l.place)}" placeholder="e.g. Athens, Lisbon, Nashville" autocomplete="off"></div>
      <div class="field"><label for="ts-${i}-date">Arrive on</label><input type="date" id="ts-${i}-date" data-tsf="ts-${i}-date" value="${esc(l.date)}"></div></div>
    <div class="row2"><div class="field"><label for="ts-${i}-nights">Nights</label><input type="number" id="ts-${i}-nights" data-tsf="ts-${i}-nights" min="0" max="60" value="${esc(String(l.nights))}"></div>
      <div class="field"><label for="ts-${i}-hotel">Hotel</label><input type="text" id="ts-${i}-hotel" data-tsf="ts-${i}-hotel" value="${esc(l.hotel)}" placeholder="Name or address"${+l.nights > 0 ? tsNeedMark("", l.hotel) : ""}></div></div>
    ${tsGetHere(l, i, legs)}</div>`;
  const ports = l.ports.map((p, j) => `<div class="tsport" data-port="${j}">
      <div class="row2"><div class="field"><label for="ts-${i}-p${j}-date">Date</label><input type="date" id="ts-${i}-p${j}-date" data-tsf="ts-${i}-p${j}-date" value="${esc(p.date)}"></div>
        <div class="field"><label for="ts-${i}-p${j}-place">Port</label><input type="text" id="ts-${i}-p${j}-place" data-tsf="ts-${i}-p${j}-place" list="ts-cities" value="${esc(p.place)}" placeholder="e.g. Santorini" autocomplete="off"></div></div>
      <div class="row2">${tsTimeF(`ts-${i}-p${j}-arrive`, "Ship arrives", p.arrive)}${tsTimeF(`ts-${i}-p${j}-aboard`, "All aboard", p.aboard)}</div>
      <div class="tsrow"><label class="check"><input type="checkbox" data-tsf="ts-${i}-p${j}-tender" ${p.tender ? "checked" : ""}><span>Tender port (small boats take you ashore)</span></label>
        <button type="button" class="linkbtn" data-ts="delport" data-i="${i}" data-j="${j}" aria-label="Remove this port">Remove port</button></div></div>`).join("");
  return `<div class="tsleg" data-leg="${i}">${head}
    <div class="row2"><div class="field"><label for="ts-${i}-board">Leaves from</label><input type="text" id="ts-${i}-board" data-tsf="ts-${i}-board" list="ts-cities" value="${esc(l.board)}" placeholder="e.g. Piraeus (Athens)" autocomplete="off"></div>
      <div class="field"><label for="ts-${i}-ship">Ship (optional)</label><input type="text" id="ts-${i}-ship" data-tsf="ts-${i}-ship" value="${esc(l.ship)}" placeholder="e.g. Sun Princess"></div></div>
    <div class="row2"><div class="field"><label for="ts-${i}-date">Boarding day</label><input type="date" id="ts-${i}-date" data-tsf="ts-${i}-date" value="${esc(l.date)}"></div>${tsTimeF(`ts-${i}-aboard`, "All aboard", l.aboard)}</div>
    ${tsGetHere(l, i, legs)}
    <div class="field"><span class="lbl">Ports of call</span><span class="hint">In order, with their times, from your cruise booking. Days with no port are added as sea days.</span></div>
    ${ports}<div class="actions"><button type="button" class="btn ghost small" data-ts="addport" data-i="${i}">+ Add a port</button></div>
    <div class="row2"><div class="field"><label for="ts-${i}-end">Cruise ends in</label><input type="text" id="ts-${i}-end" data-tsf="ts-${i}-end" list="ts-cities" value="${esc(l.end)}" placeholder="e.g. Barcelona" autocomplete="off"></div>
      <div class="field"><label for="ts-${i}-endDate">On</label><input type="date" id="ts-${i}-endDate" data-tsf="ts-${i}-endDate" value="${esc(l.endDate)}"></div></div>
    <div class="row2">${tsTimeF(`ts-${i}-off`, "Off the ship at", l.off, l.off ? "" : "On your cruise documents (often 7:00 to 9:00).")}</div>
</div>`;
}
function tsKnownPlaces() {
  const out = new Set(); try { ensureBuiltins(); for (const [c] of BUILTIN_CITIES) out.add(String(c.city).replace(/\s*\(.*\)/, "")); } catch (e) {}
  Object.values(cities).forEach(c => { if (c && c.city) out.add(String(c.city).replace(/\s*\(.*\)/, "")); });
  return [...out].sort();
}
function tsPreview(legs) {
  if (tsCheck(legs)) return "";
  const { days } = tsDays(legs); if (!days.length) return "";
  const n = new Set(days.map(d => d.date)).size, ports = days.filter(d => d.type === "port").length, est = days.some(d => d.estimated && d.type !== "sea");
  return `<details class="more tsprev"><summary>Your days: ${n} day${n === 1 ? "" : "s"}${ports ? ` · ${ports} port${ports === 1 ? "" : "s"}` : ""}</summary>
    <ul class="tips">${days.map(d => { const g = d.estimated && d.type !== "sea", nt = " · time not given yet";
      return `<li><span><b>${esc(fmtDow(d.date))} ${esc(fmtDate(d.date))}</b> · ${esc(typeInfo(d.type).short)}${d.type === "sea" ? "" : " · " + esc(d.destination)}${d.type === "port" ? (g ? " · times not given yet" : ` · ${esc(d.portArrive)}–${esc(d.allAboard)}`) : d.type === "embark" ? (g ? " · all aboard not given yet" : ` · all aboard ${esc(d.allAboard)}`) : d.type === "arrival" || d.type === "departure" ? ` · ${esc(MODES[d.mode].label.toLowerCase())}${g ? nt : " " + esc(d.time)}` : ""}</span></li>`; }).join("")}</ul>
    ${est ? `<p class="hint">A time not given yet is never shown as confirmed. Your Trip page lists it until you add it from your booking.</p>` : ""}</details>`;
}
function tsHTML(w) {
  if (!w.legs) w.legs = [tsStay()];
  return `<datalist id="ts-cities">${tsKnownPlaces().map(n => `<option value="${esc(n)}">`).join("")}</datalist>
    ${tsNeedHTML(w)}
    <p class="lede">Add each place in order, the way it's booked, with the times, airports, stations and hotels from your bookings. Each new stop starts where the last one ends.</p>
    ${w.legs.map((l, i) => tsLegHTML(l, i, w.legs)).join("")}
    <div class="actions"><button type="button" class="btn ghost small" data-ts="addstay">+ Add a city stay</button><button type="button" class="btn ghost small" data-ts="addcruise">+ Add a cruise</button></div>
    ${tsGoHome(w.legs[w.legs.length - 1], w.legs.length - 1, w.legs)}
    <div id="tsPrev">${tsPreview(w.legs)}</div>`;
}
// Reads every field of the form into the trip being made (called before any tap acts, and as the traveler types).
function tsRead() {
  if (!wiz || !wiz.legs) return;
  document.querySelectorAll("[data-tsf]").forEach(el => {
    const m = /^ts-(\d+)-(?:p(\d+)-)?(\w+)$/.exec(el.dataset.tsf); if (!m) return;
    const l = wiz.legs[+m[1]]; if (!l) return;
    const o = m[2] != null ? l.ports[+m[2]] : l; if (!o) return;
    const v = el.type === "checkbox" ? el.checked : el.value;
    o[m[3]] = m[3] === "nights" ? Math.max(0, Math.min(60, parseInt(v, 10) || 0)) : v;
  });
}
function tsBuild() {
  tsRead(); tsFill(wiz.legs);
  const err = tsCheck(wiz.legs); if (err) { aiError = err; wiz.step = 0; render(); toTop(); return; }
  if (tsAskNeeds("build")) return;
  const { days, hotels, ship } = tsDays(wiz.legs);
  mergeBoarding(days); sequenceDates(days);
  const prefs = { pace: wiz.pace, walk: wiz.walk, interests: wiz.interests.slice(), travelers: wiz.travelers, access: wiz.access, party: wiz.party, lang: wiz.lang, voice: wiz.voice };
  if (prefs.pace === "relaxed") days.forEach(x => { if (x.type === "land") x.hours = 6.5; });
  if (prefs.pace === "packed") days.forEach(x => { if (x.type === "land") x.hours = 10; });
  trip = { id: "t" + Date.now(), ...(ship ? { ship } : {}), name: wiz.name || "", active: 0, sourceText: "", portCheck: null, style: wiz.style || "mix", prefs, lodging: {}, days, sample: false, madeBy: "steps" };
  if (!trip.name) trip.name = tripName(trip);
  wiz = null; busy = null; aiError = ""; save(); view = "trip"; render(); toTop();
  (async () => {
    await buildAllGuides();
    await tsGates();
    // Each hotel the traveler named is found on the map, so the day starts and ends at the real door.
    for (const h of hotels) {
      const d = trip.days.find(x => tsSame(x.destination, h.place)); if (!d) continue;
      const k = cityKeyFor(d) || keyOf(d.destination), was = trip.lodging[k];
      trip.lodging[k] = { idx: "custom", name: h.name, ll: null };
      await geocodeLodging(d);
      if (!trip.lodging[k].ll) { aiError = trip.lodging[k].failed ? `The map search didn't answer, so "${h.name}" isn't placed yet and ${bareName(h.place)} days start from the city centre. Tap a ${bareName(h.place)} day and Find it to try again.` : `I couldn't find "${h.name}" on the map, so ${bareName(h.place)} days start from the city centre. Tap a ${bareName(h.place)} day to try the full name or street.`; trip.lodging[k] = was || { idx: 0 };  save(); render(); }
    }
  })();
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-ts]"); if (!b || !wiz) return;
  e.preventDefault(); tsRead(); if (!wiz.legs) wiz.legs = [tsStay()];
  const a = b.dataset.ts, i = +b.dataset.i, L = wiz.legs;
  // The list of details still empty: one tap goes to the field; "I don't know yet" goes on with them left empty.
  if (a === "needgo") { const f = b.dataset.f, el = f && (document.getElementById(f) || document.querySelector(`[data-tsf="${f}"]`)); if (el) { el.scrollIntoView({ block: "center" }); if (el.focus) el.focus({ preventScroll: true }); } return; }
  if (a === "needok") { const next = wiz.missAsk; wiz.unknownOk = true; wiz.missAsk = ""; if (next === "more") { aiError = ""; wiz.step = 1; render(); toTop(); } else tsBuild(); return; }
  if (a === "mode") { wiz.mode = b.dataset.v; aiError = ""; }
  // A trip that starts with a cruise: the empty city stay the form opens with is replaced, not left as a "Stop 1: type
  // the city" the traveler has to find and remove (Bahamas test trip, Nov 17).
  if (a === "addcruise" && L.length === 1 && L[0].k === "stay" && !bareName(L[0].place) && !L[0].date && !bareName(L[0].hotel)) L.splice(0, 1);
  if (a === "addstay" || a === "addcruise") { tsFill(L); L.push(tsNext(a === "addcruise" ? "cruise" : "stay", L)); }
  if (a === "del" && L.length > 1) L.splice(i, 1);
  if (a === "set" && L[i]) L[i][b.dataset.key] = b.dataset.v;
  if (a === "addport" && L[i]) { const ps = L[i].ports, lastD = ps.length ? ps[ps.length - 1].date : L[i].date; ps.push(tsPort({ date: lastD ? addDays(lastD, 1) : "" })); if (L[i].endDate && lastD && addDays(lastD, 1) >= L[i].endDate) L[i].endDate = addDays(lastD, 2); }
  if (a === "delport" && L[i]) L[i].ports.splice(+b.dataset.j, 1);
  redrawStill();
  if (a === "addstay" || a === "addcruise") { const el = document.querySelector(`[data-leg="${L.length - 1}"] input[type=text]`); if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: "center" }); } }
});
// Typing keeps the trip (a redraw never loses it); a finished field updates the day list below the form.
document.addEventListener("input", e => { if (e.target && e.target.dataset && e.target.dataset.tsf) { tsRead(); if (String(e.target.value || "").trim()) e.target.removeAttribute("aria-invalid"); } });
document.addEventListener("change", e => {
  if (!(e.target && e.target.dataset && e.target.dataset.tsf) || !wiz || !wiz.legs) return;
  tsRead(); const f = e.target.dataset.tsf;
  // A date picked for a stop moves the empty dates after it with it.
  if (/-(date|nights|endDate)$/.test(f)) { tsFill(wiz.legs); wiz.legs.forEach((l, i) => { if (i && l.k === "stay" && !l.place && wiz.legs[i - 1].k === "cruise") l.place = wiz.legs[i - 1].end; }); }
  // A leaving time typed in the small hours asks, right there, whether it's that morning or that night (R-01).
  // Only when the question has to appear or go: nothing else on the page moves.
  if (/-(leaveAt|homeAt)$/.test(f) && !!document.getElementById(f.replace(/At$/, "Night")) !== tsSmall(e.target.value)) { const y = window.scrollY; render(); window.scrollTo(0, y); return; }
  const p = document.getElementById("tsPrev"); if (p) p.innerHTML = tsPreview(wiz.legs);
});
if (typeof window !== "undefined") {
  // Test hook: the days a list of stops makes (the same rules the form uses).
  window.__kairouteTripSteps = legs => { const L = legs.map(l => l.k === "cruise" ? tsCruise(Object.assign({}, l, { ports: (l.ports || []).map(tsPort) })) : tsStay(l)); tsFill(L); const err = tsCheck(L); if (err) return { err }; const needs = tsNeeds(L).map(x => x.f + " " + x.what); const r = tsDays(L); mergeBoarding(r.days); sequenceDates(r.days); return { needs, meta: r.days.map(d => [d.date, d.type, d.gateWant || "", d.nightDep || ""].join("|")), days: r.days.map(d => [d.date, d.type, d.destination, d.mode, d.time || "", d.type === "port" ? d.portArrive + "-" + d.allAboard : d.type === "embark" ? d.allAboard : "", d.estimated ? "est" : ""].join("|")), ship: r.ship }; };
}
