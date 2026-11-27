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
const tsStay = o => Object.assign({ k: "stay", place: "", date: "", nights: 3, inBy: "flight", leaveAt: "", inAt: "", hotel: "", homeBy: "flight", homeAt: "" }, o || {});
const tsCruise = o => Object.assign({ k: "cruise", ship: "", board: "", date: "", aboard: "", inBy: "flight", leaveAt: "", inAt: "", ports: [], end: "", endDate: "", off: "", homeBy: "flight", homeAt: "" }, o || {});
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
// The days, by the same rules for every trip.
function tsDays(legs) {
  const days = [], hotels = [], est = t => !t;
  const add = o => days.push(newDay(Object.assign({ hours: o.type === "arrival" ? 6 : 8 }, o)));
  legs.forEach((l, i) => {
    const prev = legs[i - 1], next = legs[i + 1], joinedIn = tsJoined(prev, l), joinedOut = next && tsJoined(l, next);
    if (l.k === "stay") {
      if (!joinedIn) add({ date: l.date, destination: l.place.trim(), type: "arrival", mode: l.inBy, time: l.inAt || (l.inBy === "flight" ? "10:30" : "11:00"), estimated: est(l.inAt) });
      for (let k = 1; k < (+l.nights || 0); k++) add({ date: addDays(l.date, k), destination: l.place.trim(), type: "land" });
      const last = tsEnd(l);
      if (!joinedOut && (+l.nights || 0) >= 0) {
        const by = next ? next.inBy : l.homeBy, at = next ? next.leaveAt : l.homeAt;
        if (next || l.homeAt || (+l.nights || 0) > 0) add({ date: last, destination: l.place.trim(), type: "departure", mode: by, time: at || (by === "flight" ? "15:00" : "12:00"), estimated: est(at) });
      }
      if (bareName(l.hotel)) hotels.push({ place: l.place.trim(), name: l.hotel.trim() });
    } else {
      if (!joinedIn) add({ date: l.date, destination: l.board.trim(), type: "arrival", mode: l.inBy, time: l.inAt || "10:30", estimated: est(l.inAt) });
      add({ date: l.date, destination: l.board.trim(), type: "embark", allAboard: l.aboard || "17:00", estimated: est(l.aboard) });
      const ports = l.ports.filter(p => p.date && bareName(p.place)).sort((a, b) => a.date.localeCompare(b.date));
      for (let dt = addDays(l.date, 1); dt < l.endDate; dt = addDays(dt, 1)) {
        const p = ports.find(x => x.date === dt);
        if (p) add({ date: dt, destination: p.place.trim(), type: "port", portArrive: p.arrive || "08:00", allAboard: p.aboard || "17:00", tender: !!p.tender, estimated: est(p.arrive) || est(p.aboard) });
        else add({ date: dt, destination: "At sea", type: "sea" });
      }
      add({ date: l.endDate, destination: l.end.trim(), type: "arrival", mode: "ship", time: l.off || "07:30", estimated: est(l.off) });
      if (!joinedOut && (next || l.homeAt)) { const by = next ? next.inBy : l.homeBy, at = next ? next.leaveAt : l.homeAt;
        add({ date: l.endDate, destination: l.end.trim(), type: "departure", mode: by, time: at || (by === "flight" ? "15:00" : "12:00"), estimated: est(at) }); }
    }
  });
  const ship = legs.find(l => l.k === "cruise" && bareName(l.ship));
  return { days, hotels, ship: ship ? { line: "", name: ship.ship.trim() } : null };
}
// ---- The form ----
const tsTimeF = (id, label, v, hint) => `<div class="field"><label for="${id}">${label}</label><input type="time" id="${id}" data-tsf="${id}" value="${esc(v || "")}">${hint ? `<span class="hint">${hint}</span>` : ""}</div>`;
const tsSeg = (i, key, v, list) => `<div class="seg" role="group" aria-label="How you travel">${list.map(([k, l]) => `<button type="button" data-ts="set" data-i="${i}" data-key="${key}" data-v="${k}" aria-pressed="${v === k}">${l}</button>`).join("")}</div>`;
function tsGetHere(l, i, legs) {
  const prev = legs[i - 1]; if (tsJoined(prev, l)) return "";
  const from = prev ? tsWhere(prev) : "", word = l.k === "cruise" ? "Getting to the ship" : "Getting there";
  return `<div class="field"><span class="lbl">${word}${l.k === "cruise" ? " (if you arrive the same day)" : ""}</span>${tsSeg(i, "inBy", l.inBy, TS_MOVE)}</div>
    <div class="row2">${prev && from ? tsTimeF(`ts-${i}-leaveAt`, `Leave ${esc(bareName(from))} at`, l.leaveAt) : ""}${tsTimeF(`ts-${i}-inAt`, `Arrive in ${esc(bareName(l.k === "cruise" ? l.board : l.place) || "town")} at`, l.inAt, l.inAt ? "" : "Leave empty if you don't know yet.")}</div>`;
}
// How the trip ends is asked once, after the last stop and the buttons that add more (outside review, Nov 20: it was
// asked on the first stop, before the traveler had said where else they were going).
function tsGoHome(l, i, legs) {
  if (!l || i !== legs.length - 1) return "";
  return `<div class="tsleg tshome"><div class="field"><span class="lbl">Going home from ${esc(bareName(tsWhere(l)) || "here")}</span>${tsSeg(i, "homeBy", l.homeBy, TS_MOVE)}</div>
    <div class="row2">${tsTimeF(`ts-${i}-homeAt`, `${l.homeBy === "flight" ? "Flight" : l.homeBy === "train" ? "Train" : l.homeBy === "ferry" ? "Ferry" : "Leave"} at`, l.homeAt)}</div></div>`;
}
function tsLegHTML(l, i, legs) {
  const head = `<div class="tshead"><span class="eyebrow">Stop ${i + 1} · ${l.k === "stay" ? "City stay" : "Cruise"}</span>${legs.length > 1 ? `<button type="button" class="linkbtn" data-ts="del" data-i="${i}" aria-label="Remove stop ${i + 1}">Remove</button>` : ""}</div>`;
  if (l.k === "stay") return `<div class="tsleg" data-leg="${i}">${head}
    <div class="row2"><div class="field"><label for="ts-${i}-place">City</label><input type="text" id="ts-${i}-place" data-tsf="ts-${i}-place" list="ts-cities" value="${esc(l.place)}" placeholder="e.g. Athens, Lisbon, Nashville" autocomplete="off"></div>
      <div class="field"><label for="ts-${i}-date">Arrive on</label><input type="date" id="ts-${i}-date" data-tsf="ts-${i}-date" value="${esc(l.date)}"></div></div>
    <div class="row2"><div class="field"><label for="ts-${i}-nights">Nights</label><input type="number" id="ts-${i}-nights" data-tsf="ts-${i}-nights" min="0" max="60" value="${esc(String(l.nights))}"></div>
      <div class="field"><label for="ts-${i}-hotel">Hotel (optional)</label><input type="text" id="ts-${i}-hotel" data-tsf="ts-${i}-hotel" value="${esc(l.hotel)}" placeholder="Name or address"></div></div>
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
    <div class="field"><span class="lbl">Ports of call</span><span class="hint">In order, from your cruise booking. Days with no port are added as sea days.</span></div>
    ${ports}<div class="actions"><button type="button" class="btn ghost small" data-ts="addport" data-i="${i}">+ Add a port</button></div>
    <div class="row2"><div class="field"><label for="ts-${i}-end">Cruise ends in</label><input type="text" id="ts-${i}-end" data-tsf="ts-${i}-end" list="ts-cities" value="${esc(l.end)}" placeholder="e.g. Barcelona" autocomplete="off"></div>
      <div class="field"><label for="ts-${i}-endDate">On</label><input type="date" id="ts-${i}-endDate" data-tsf="ts-${i}-endDate" value="${esc(l.endDate)}"></div></div>
    <div class="row2">${tsTimeF(`ts-${i}-off`, "Off the ship at", l.off, l.off ? "" : "Usually 7:00 to 9:00. Leave empty if you don't know.")}</div>
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
    <ul class="tips">${days.map(d => `<li><span><b>${esc(fmtDow(d.date))} ${esc(fmtDate(d.date))}</b> · ${esc(typeInfo(d.type).short)}${d.type === "sea" ? "" : " · " + esc(d.destination)}${d.type === "port" ? ` · ${esc(d.portArrive)}–${esc(d.allAboard)}` : d.type === "embark" ? ` · all aboard ${esc(d.allAboard)}` : d.type === "arrival" || d.type === "departure" ? ` · ${esc(MODES[d.mode].label.toLowerCase())} ${esc(d.time)}` : ""}${d.estimated && d.type !== "sea" ? " (time estimated)" : ""}</span></li>`).join("")}</ul>
    ${est ? `<p class="hint">Times you left empty are typical times, marked as estimated on the day. Add the real ones from your booking any time.</p>` : ""}</details>`;
}
function tsHTML(w) {
  if (!w.legs) w.legs = [tsStay()];
  return `<datalist id="ts-cities">${tsKnownPlaces().map(n => `<option value="${esc(n)}">`).join("")}</datalist>
    <p class="lede">Add each place in order, the way it's booked. Each new stop starts where the last one ends.</p>
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
  const err = tsCheck(wiz.legs); if (err) { aiError = err; render(); toTop(); return; }
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
    // Each hotel the traveler named is found on the map, so the day starts and ends at the real door.
    for (const h of hotels) {
      const d = trip.days.find(x => tsSame(x.destination, h.place)); if (!d) continue;
      const k = cityKeyFor(d) || keyOf(d.destination), was = trip.lodging[k];
      trip.lodging[k] = { idx: "custom", name: h.name, ll: null };
      await geocodeLodging(d);
      if (!trip.lodging[k].ll) { trip.lodging[k] = was || { idx: 0 }; aiError = `I couldn't find "${h.name}" on the map, so ${bareName(h.place)} days start from the city centre. Tap a ${bareName(h.place)} day to try the full name or street.`; save(); render(); }
    }
  })();
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-ts]"); if (!b || !wiz) return;
  e.preventDefault(); tsRead(); if (!wiz.legs) wiz.legs = [tsStay()];
  const a = b.dataset.ts, i = +b.dataset.i, L = wiz.legs;
  if (a === "mode") { wiz.mode = b.dataset.v; aiError = ""; }
  // A trip that starts with a cruise: the empty city stay the form opens with is replaced, not left as a "Stop 1: type
  // the city" the traveler has to find and remove (Bahamas test trip, Nov 17).
  if (a === "addcruise" && L.length === 1 && L[0].k === "stay" && !bareName(L[0].place) && !L[0].date && !bareName(L[0].hotel)) L.splice(0, 1);
  if (a === "addstay" || a === "addcruise") { tsFill(L); L.push(tsNext(a === "addcruise" ? "cruise" : "stay", L)); }
  if (a === "del" && L.length > 1) L.splice(i, 1);
  if (a === "set" && L[i]) L[i][b.dataset.key] = b.dataset.v;
  if (a === "addport" && L[i]) { const ps = L[i].ports, lastD = ps.length ? ps[ps.length - 1].date : L[i].date; ps.push(tsPort({ date: lastD ? addDays(lastD, 1) : "" })); if (L[i].endDate && lastD && addDays(lastD, 1) >= L[i].endDate) L[i].endDate = addDays(lastD, 2); }
  if (a === "delport" && L[i]) L[i].ports.splice(+b.dataset.j, 1);
  const y = window.scrollY; render(); window.scrollTo(0, y);
  if (a === "addstay" || a === "addcruise") { const el = document.querySelector(`[data-leg="${L.length - 1}"] input[type=text]`); if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: "center" }); } }
});
// Typing keeps the trip (a redraw never loses it); a finished field updates the day list below the form.
document.addEventListener("input", e => { if (e.target && e.target.dataset && e.target.dataset.tsf) tsRead(); });
document.addEventListener("change", e => {
  if (!(e.target && e.target.dataset && e.target.dataset.tsf) || !wiz || !wiz.legs) return;
  tsRead(); const f = e.target.dataset.tsf;
  // A date picked for a stop moves the empty dates after it with it.
  if (/-(date|nights|endDate)$/.test(f)) { tsFill(wiz.legs); wiz.legs.forEach((l, i) => { if (i && l.k === "stay" && !l.place && wiz.legs[i - 1].k === "cruise") l.place = wiz.legs[i - 1].end; }); }
  const p = document.getElementById("tsPrev"); if (p) p.innerHTML = tsPreview(wiz.legs);
});
if (typeof window !== "undefined") {
  // Test hook: the days a list of stops makes (the same rules the form uses).
  window.__kairouteTripSteps = legs => { const L = legs.map(l => l.k === "cruise" ? tsCruise(Object.assign({}, l, { ports: (l.ports || []).map(tsPort) })) : tsStay(l)); tsFill(L); const err = tsCheck(L); if (err) return { err }; const r = tsDays(L); mergeBoarding(r.days); sequenceDates(r.days); return { days: r.days.map(d => [d.date, d.type, d.destination, d.mode, d.time || "", d.type === "port" ? d.portArrive + "-" + d.allAboard : d.type === "embark" ? d.allAboard : "", d.estimated ? "est" : ""].join("|")), ship: r.ship }; };
}
