// Beta 2 engine, part 3: each day's window. When sightseeing can start, the hard end, and the fixed steps at each end
// (bags, check-in, the ride to the ship, train or plane). Every safety time lives here and only here (Rule #2: never
// cause a client to miss their ship). Missing times or an unknown port stop the day with a clear message, never a guess.
(function (E) {
  // How long getting off takes ("clear") and how early to be there to leave ("need"), by way of travel.
  E.MODES = Object.freeze({
    flight: { label: "Flight", clear: 75, need: 180, word: "airport" }, train: { label: "Train", clear: 15, need: 30, word: "station" },
    ship: { label: "Ship", clear: 60, need: 60, word: "port" }, ferry: { label: "Ferry", clear: 20, need: 40, word: "ferry terminal" },
    car: { label: "Car or bus", clear: 10, need: 20, word: "starting point" } });
  E.PORT_BUFFER = 45;        // back at the ship this long before all aboard
  E.STRAIGHT_MIN = 180;      // flying in the day the ship sails: under 3 h free means straight to the ship
  E.TENDER_ASHORE = 60;      // getting ashore by tender boat; 30 by gangway
  E.BOARD_BEFORE = 60;       // at the terminal at least an hour before all aboard
  E.GATE_KM = { flight: 80, other: 40 }; // farthest a port or station (airports lie farther out) may be from the nearest sight
  // Never a place that isn't built yet, or no longer used, as a station, airport or port (Nov 20 tester: a capital's
  // station was a metro building site).
  E.NOT_BUILT = /\b(under construction|construction|chantier|cantiere|obras?|baustelle|future|futur|proposed|planned|projet|project|disused|abandoned|former|closed)\b/i;
  // The real places of one kind a city search found, one per place (same name, or within 1 km), unbuilt ones left out.
  // More than one means the traveler is asked which (Nov 20 tester: a train abroad was sent to the wrong one of a
  // capital's stations; a city with two airports got one with no question asked).
  // The right KIND of place on the map (Nov 20 tester's 70-city table: a fire station, a petrol station, a subway stop, a
  // seaplane base and a freight terminal were each taken for a station, airport or cruise port). kind: station, airport
  // or cruise; a candidate's map kind (OpenStreetMap's value), when known, must be one that kind can be.
  const GATE_BAD = { station: /\b(fire|police|service|petrol|gas|filling|fuel|power|pumping|radio|lifeboat|research|space|weather|polling|coast ?guard|ambulance|bus|coach|subway|u-?bahn|metro|underground|tram|tube)\b|\bterminus\b/i,
    airport: /\b(airfield|heliport|seaplane|sea plane|air ?base|air force|naval air|aero ?club|gliding|flying club|airstrip)\b/i,
    cruise: /\b(freight|cargo|container|seaplane|marina|yacht|fishing|naval|oil|fuel|bay|gulf|sound|strait|channel)\b/i };
  const GATE_KINDS = { station: /^(station|halt|train_station|stop)$/, airport: /^(aerodrome|airport|terminal|international_airport)$/, cruise: /^(ferry_terminal|pier|terminal|harbour|harbor|port|dock|wharf|quay|berth|cruise_terminal)$/ };
  E.gateOk = (kind, c) => !!c && !/^(list|lists|index|outline) of\b/i.test(String(c.name || "").trim()) && !(GATE_BAD[kind] && GATE_BAD[kind].test(String(c.name || ""))) && !(c.kind && GATE_KINDS[kind] && !GATE_KINDS[kind].test(String(c.kind)));
  E.gateChoices = (list, kind) => { const key = n => String(n || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(), out = [];
    for (const c of list || []) { if (!c || !c.name || !isFinite(c.lat) || !isFinite(c.lng) || E.NOT_BUILT.test(c.name + " " + (c.kind || "")) || (kind && !E.gateOk(kind, c))) continue;
      if (!out.some(x => key(x.name) === key(c.name) || E.hav(x, c) <= 1)) out.push(c); }
    return out; };
  // How early to be at the station for a train to another country: ID checks inside the open-border area, passport and
  // security checks across its edge (Nov 20 tester: 30 min for a train with passport checks is not safe).
  E.OPEN_BORDERS = new Set(["austria", "belgium", "bulgaria", "croatia", "czechia", "czech republic", "denmark", "estonia", "finland", "france", "germany", "greece", "hungary", "iceland", "italy", "latvia", "liechtenstein", "lithuania", "luxembourg", "malta", "netherlands", "norway", "poland", "portugal", "romania", "slovakia", "slovenia", "spain", "sweden", "switzerland"]);
  E.BORDER_NEED = { open: 45, passport: 90 };
  E.trainNeed = (from, to) => { const a = String(from || "").trim().toLowerCase(), b = String(to || "").trim().toLowerCase();
    if (!a || !b || a === b) return null; return E.OPEN_BORDERS.has(a) && E.OPEN_BORDERS.has(b) ? E.BORDER_NEED.open : E.BORDER_NEED.passport; };
  E.TENDER_BACK = 30;        // tender port: the boats back stop well before all aboard and queue, so back this much earlier
  // A landing below the town, reached by cable car or funicular (from the places files): the queue and ride up, and the
  // queue and ride down, which is far longer when every passenger heads back at once.
  E.LIFT_UP = 20; E.LIFT_DOWN = 50;
  const hardEnd = t => t === "port" || t === "embark" || t === "departure";
  E.hardEnd = hardEnd;
  // "Hours to sightsee" are for seeing things: a lunch falling inside them is added on top, never pushed into dinner.
  const lunchIn = (from, hours) => { const end = from + hours * 60, L = E.MEALS[0]; return from < L.to - 30 && end > L.from + 45 ? Math.max(end, Math.min(end + L.len, E.MEALS[1].from)) : end; };
  const fixed = (p, label, minutes) => Object.assign({}, p, { id: "fx-" + label.replace(/\W+/g, "-").toLowerCase(), name: label, minutes, fixed: true });
  // Total minutes of a chain of fixed points: the rides between them plus each fixed stop's own minutes.
  const chain = (pts, tr) => { let c = 0; for (let i = 0; i < pts.length; i++) { if (i) c += tr.min(pts[i - 1], pts[i]); c += pts[i].fixed ? pts[i].minutes : 0; } return c; };
  E.chainMinutes = chain;
  // d: one day's facts (src/features/zz-engine-facts.js). tr: the travel calculator. Returns the window or { error }.
  E.dayWindow = (d, tr) => {
    if (d.noShore) return E.fail("At sea or staying aboard: no time ashore.", { noShore: true });
    if (d.through) return E.fail("This day's plan is on the next page, with your departure or boarding.", { through: true });
    const L = d.lodging, P = d.point, w = { head: [], tail: [], start: NaN, endBy: NaN, buffer: 0, hard: hardEnd(d.type), notes: [] };
    // A port, station or airport far from every sight of the place (a port on another island, a gate grounded to the
    // wrong town) is as good as unknown: never planned from it.
    // A guide written as a trip out from that very place ("Rome from Civitavecchia") names it, and is far by design.
    const GENERIC = /^(port|ports|cruise|terminal|terminals|pier|piers|harbou?r|marina|station|central|airport|international|ferry|new|old|the)$/;
    const named = String(d.placeName || "").toLowerCase(), words = String(P && P.name || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z]+/).filter(x => x.length >= 4 && !GENERIC.test(x));
    const servesFrom = words.some(x => named.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").includes(x));
    if (P && !P.unknown && !servesFrom && d.type !== "land" && isFinite(P.lat) && (d.siteSpots || []).length && Math.min(...d.siteSpots.map(x => E.hav(P, x))) > E.GATE_KM[d.mode === "flight" && d.type !== "port" && d.type !== "embark" ? "flight" : "other"])
      return E.fail(`${P.name} is ${Math.round(Math.min(...d.siteSpots.map(x => E.hav(P, x))))} km from every sight here, so it can't be the right place. Check where you arrive or leave; this day isn't planned on a guess.`, { unsure: true, farGate: true });
    // A city with more than one station or airport and none chosen: asked, never guessed.
    if (P && P.ask && P.ask.length > 1 && d.type !== "land" && d.type !== "port" && d.type !== "embark") { const word = (E.MODES[d.mode] || E.MODES.flight).word;
      return E.fail(`Which ${word} ${d.type === "arrival" ? "do you arrive at" : "do you leave from"}? There is more than one here (${E.listWords(P.ask.slice(0, 4), "or")}${P.ask.length > 4 ? " or another" : ""}). Choose it in the day's settings${d.type === "arrival" ? "" : " and the day gets its time to leave by"}: no time is given on a guess.`, { unsure: true, askGate: true }); }
    if (P && P.unknown && d.type !== "land" && !d.thru) return E.fail(`We couldn't find exactly where ${P.name} is, so this day isn't planned on a guess.`, { unsure: true });
    if (d.type === "land") {
      if (!L) return E.fail("Choose where you're staying.");
      w.head = [L]; w.tail = d.returnToStart ? [L] : [];
      w.start = E.toMin(d.startTime); w.endBy = Math.min(23 * 60 + 30, lunchIn(w.start, d.hours)); w.sightFrom = w.start;
    } else if (d.type === "arrival") {
      // Arriving on the trip's last day with no hotel of the traveler's own: they are going home, and the time they leave
      // isn't known. Asked, never planned as a stay with a guessed hotel (Nov 20 tester: off the ship at 6:00 on the last
      // morning, planned with a hotel check-in, a museum before it opened and a dinner).
      if (d.lastDay && d.stayGuess) return E.fail("This is your last day. Add how you leave and when (your flight or train home) on the Trip page, or your hotel if you're staying on, and the day is planned around it: nothing is planned on a guess.", { unsure: true, askLeave: true });
      // No arrival time given: asked, never planned on a time the app made up (Round 1, Nov 20: "Flight in at 10:30 am" on 12 of 15 cruises).
      const askArrive = mode => E.fail(`When does your ${(E.MODES[mode] || E.MODES.flight).label.toLowerCase()} arrive? Add the time on the Trip page and the day is planned around it: nothing is planned on a guess.`, { unsure: true, askArrive: true });
      if (d.timeGuess) return askArrive(d.mode);
      if (!L) return E.fail("Choose where you're staying."); if (!P) return E.fail("Choose your arrival point.");
      const m = E.MODES[d.mode] || E.MODES.flight;
      w.start = E.toMin(d.time) + m.clear; w.head = [P, Object.assign(fixed(L, "Check in or drop bags", 20), { bags: true })]; w.tail = [L];
      w.sightFrom = w.start + chain(w.head, tr); w.endBy = Math.min(23 * 60, lunchIn(w.sightFrom, d.hours));
    } else if (d.type === "departure" || d.type === "embark") {
      const ship = d.type === "embark", m = ship ? E.MODES.ship : E.MODES[d.mode] || E.MODES.flight;
      if (!P) return E.fail(ship ? "Choose the cruise port." : "Choose your departure point.");
      const end = Object.assign({}, P, { deadline: true }, d.noBags ? {} : { bags: true }); // reached from the bags, with them
      // Boarding: at the terminal by the boarding time, and never later than an hour before all aboard.
      const latest = ship ? d.allAboard - E.BOARD_BEFORE : null;
      // Countries not known for a train to another city: planned for ID checks at least, and the plan says when to allow more.
      const unknownBorder = !ship && d.mode === "train" && d.toOther && (!d.country || !d.toCountry);
      const border = !ship && d.mode === "train" ? (E.trainNeed(d.country, d.toCountry) || (unknownBorder ? E.BORDER_NEED.open : null)) : null;
      w.endBy = ship ? (d.boardAt != null ? Math.min(d.boardAt, latest) : latest) : E.toMin(d.time) - Math.max(m.need, border || 0);
      if (unknownBorder) w.borderUnknown = true; else if (border && border > m.need) w.borderNeed = border;
      if (ship) { w.boardAt = d.boardAt; w.latest = latest; }
      if (d.thru) { // off a ship, plane or train and leaving the same day: bags in storage near where you arrive
        if (d.thru.guess) return E.fail(`When does your ${(E.MODES[d.thru.mode] || E.MODES.flight).label.toLowerCase()} arrive? Add the time on the Trip page and the day is planned around it, with the time to get to ${d.type === "embark" ? "the ship" : "your next ride"}: nothing is planned on a guess.`, { unsure: true, askArrive: true });
        const am = E.MODES[d.thru.mode] || E.MODES.flight, A = d.thru.point; if (!A) return E.fail("Choose where you arrive.");
        w.start = E.toMin(d.thru.time) + am.clear; w.through = true;
        w.head = d.noBags ? [A] : [A, fixed(A, "Leave your bags in luggage storage", 15)];
        w.tail = d.noBags ? [end] : [fixed(A, "Collect your bags", 15), end];
      } else {
        if (!L) return E.fail("Choose where you're staying.");
        w.start = E.toMin(d.startTime); w.head = [L]; w.tail = d.noBags ? [end] : [fixed(L, "Collect bags", 15), end];
      }
      // A time to leave earlier than the day's start is after midnight, the next morning (Nov 20 review: a 00:40 flight gave
      // "Leave by -4:-43 am"): the day's window runs through midnight.
      if (isFinite(w.start) && isFinite(w.endBy) && w.endBy + (ship ? E.BOARD_BEFORE : m.need) < w.start) {
        w.endBy += 24 * 60; if (ship) { w.latest += 24 * 60; if (w.boardAt != null && w.boardAt < w.start) w.boardAt += 24 * 60; } }
      // Flying in the day the ship sails: under 3 hours left for sightseeing means none, straight to the ship.
      if (ship && d.thru && d.thru.mode === "flight") {
        const free = w.endBy - w.start - chain(w.head, tr) - chain(w.tail, tr);
        if (free < E.STRAIGHT_MIN) { w.straight = true; w.head = [w.head[0]]; w.tail = [end]; w.sightFrom = w.start; }
        w.notes.push(w.straight ? "flyInStraight" : "flyInWarn");
      }
    } else if (d.type === "port") {
      if (!P) return E.fail("Choose where the ship docks.");
      // All aboard after midnight (earlier on the clock than docking) is the next morning's.
      const aboard = isFinite(d.allAboard) && isFinite(d.portArrive) && d.allAboard < d.portArrive ? d.allAboard + 24 * 60 : d.allAboard;
      w.start = d.portArrive + (d.tender ? E.TENDER_ASHORE : 30); w.buffer = E.PORT_BUFFER + (d.tender ? E.TENDER_BACK : 0); w.endBy = aboard - w.buffer;
      w.head = [Object.assign({}, P, { leaveWhenReady: true })]; w.tail = [Object.assign({}, P, { backToShip: true })];
      const lf = P.lift;
      if (lf && lf.top && isFinite(lf.top.lat)) {
        const via = { lat: P.lat, lng: P.lng, name: lf.name || "Cable car" }, top = { lat: lf.top.lat, lng: lf.top.lng, name: lf.topName || P.name };
        w.head.push(Object.assign(fixed(top, (lf.kind === "funicular" ? "Funicular" : "Cable car") + " up (with the queue)", E.LIFT_UP), { viaLift: via }));
        w.tail.unshift(Object.assign(fixed(top, (lf.kind === "funicular" ? "Funicular" : "Cable car") + " down (the queue is longest when ships leave)", E.LIFT_DOWN), { viaLift: via }));
        w.lift = lf; w.notes.push("lift");
      }
    } else return E.fail("Unknown day type: " + d.type);
    if (!isFinite(w.start) || !isFinite(w.endBy)) return E.fail("Add the times for this day.");
    w.sightTo = w.endBy - chain(w.tail, tr); // when sightseeing must stop, before the fixed steps at the end
    // A ship, train or plane the day's own steps can't reach from the planned start (bags, the ride): the day starts
    // that much earlier, and says so. Never a plan that leaves after its own leave-by time.
    if (d.type === "embark" || d.type === "departure") {
      const bare = E.walkDay([], w, tr.estimate, null).end;
      if (bare > w.endBy) { const early = bare - w.endBy; w.plannedStart = w.start; w.start -= early; if (isFinite(w.sightFrom)) w.sightFrom -= early; w.leaveEarly = early; w.notes.push("leaveEarly"); }
    }
    return w;
  };
})(KEngine);
