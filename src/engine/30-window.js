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
  E.NIGHT_DEP = 5 * 60;       // a departure before 5 am on a day that starts later is the next morning's (after midnight)
  E.BAGS_STORE_MIN = 60;     // off a ship, plane or train and leaving the same day: bags are stored only for an hour or more free
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
    airport: /\b(airfield|heliport|helipad|helicopter|seaplane|sea plane|air ?base|air force|naval air|aero ?club|gliding|glider|flying club|flying school|airstrip|air ?park|ultralight|microlight|national guard|army|military|executive airport|concourse|apron|runway|taxiway|hangar|control tower|car ?park|parking|cargo|freight)\b|\baerodrom(e|o)?\b/i,
    cruise: /\b(freight|cargo|container|seaplane|marina|yacht|fishing|naval|oil|fuel|bay|gulf|sound|strait|channel)\b/i };
  // An airport is offered only as a whole airport with passenger flights (round 6a tester: a planned airport not yet
  // built was offered, picked, and planned as a normal arrival). A terminal, gate or other part of one is not an airport.
  const GATE_KINDS = { station: /^(station|halt|train_station|stop)$/, airport: /^(aerodrome|airport|international_airport)$/, cruise: /^(ferry_terminal|pier|terminal|harbour|harbor|port|dock|wharf|quay|berth|cruise_terminal)$/ };
  // Where a cruise ship ties up (Round 1, Nov 20: a state ferry terminal, an old harbour for small boats, a whole port's
  // encyclopedia article placed in the old town, and a travel-guide sentence about the ferry to another country were each
  // taken for the cruise pier). A ferry terminal, an old port, a sentence or an article about the whole port is not a pier.
  E.GATE_OUT = 25; // km: a port named apart from its city ("Port (City)") lies at least this far out of the city
  const CRUISE_NOT = /\b(ferry|ferries|marine highway|old (port|harbou?r)|vieux[- ]port|porto (antico|vecchio)|stara luka|eski liman|puerto viejo|alter hafen)\b/i;
  E.cruiseOk = c => { const n = String((c && c.name) || "").trim(); if (!n) return false;
    if (n.length > 70 || /[.!?;]\s|\d+\s*(jd|eur|usd|euros?|dollars?|hours?)\b/i.test(n) || n.split(/\s+/).length > 9) return false; // a sentence
    if (CRUISE_NOT.test(n) && !/cruise/i.test(n)) return false;
    // An article about a whole port (no map kind) says nothing about where the ships tie up.
    if (c.wiki && !c.kind && /^(port|harbou?r) of\b/i.test(n) && !/cruise|terminal|pier|wharf|berth/i.test(n)) return false;
    return true; };
  // A passenger terminal, or a cruise terminal or pier by name, is where ships take people on, however the map files
  // it (Round 2 re-check: "Passengers Terminal" filed as a public building, a cruise terminal as an office or "yes", a
  // cruise pier as a marina, were dropped). How sure a cruise pier is: named for cruises,
  // a mapped terminal, a pier or wharf.
  E.cruiseRank = c => (/cruise/i.test(String(c.name || "")) ? 4 : 0) + (/cruise_terminal/.test(String(c.kind || "")) ? 3 : 0) + (/terminal|berth|wharf|pier|dock|quay/i.test(String(c.name || "")) ? 1 : 0);
  // What an encyclopedia article's opening sentence says about an airport: one still being planned or built, one that
  // has closed, or a military, private or helicopter field is no airport a traveler flies to. A real airport with
  // passenger flights has an IATA code, and its article gives it in the opening ("(IATA: XXX, ICAO: XXXX)").
  const AIR_OUT = /\b(planned|proposed|projected|future|under construction|to be (built|constructed)|being built|will (be|replace|open|serve)|expected to (open|begin|start)|scheduled to open|former(ly)?|closed|defunct|decommissioned|disused|abandoned|demolished|ceased|no longer|was (an?|the)\b[^.]*\b(airport|airfield|aerodrome)|heliport|private(ly[- ]owned)? (airport|airfield|aerodrome)|general aviation (airport|airfield|aerodrome)|glid(ing|er)|ultralight|air ?base|air force base|air station)\b/i;
  const AIR_MIL = /\bmilitary (airport|airfield|aerodrome|air ?base)\b/i, AIR_CIVIL = /\b(civil|civilian|commercial|passenger|joint)\b/i;
  E.airportUse = c => { const t = String((c && (c.about != null ? c.about : c.extract)) || "").replace(/\s+/g, " ").trim(); if (!t) return null; // nothing to tell from
    const first = t.split(/(?<=[a-z0-9)\]])\.\s+(?=[A-Z])/)[0];
    if (AIR_OUT.test(first) || (AIR_MIL.test(first) && !AIR_CIVIL.test(first))) return false;
    return /\bIATA\b\s*(code)?\s*[:\-]?\s*[A-Z]{3}\b/.test(t); };
  // A terminal or gate on its own is part of an airport, not one to choose; a guide's own "<Airport>, Terminal 2" names
  // the whole airport and which terminal of it, so it stays.
  const AIR_PART = /\b(terminals?|gates?|piers?|satellite)\b/i, AIR_WHOLE = /\b(airport|aeroporto|aeropuerto|a[ée]roport|flughafen|lufthavn|luchthaven|havaliman[ıi])\b[^,]*,\s*(terminals?|gates?|piers?|satellite)\b/i;
  E.gateOk = (kind, c) => !!c && (kind !== "cruise" || E.cruiseOk(c)) && (kind !== "airport" || (E.airportUse(c) !== false && !(AIR_PART.test(String(c.name || "")) && !AIR_WHOLE.test(String(c.name || ""))))) && !/^(list|lists|index|outline) of\b/i.test(String(c.name || "").trim()) && !(GATE_BAD[kind] && GATE_BAD[kind].test(String(c.name || ""))) && !(c.kind && GATE_KINDS[kind] && !GATE_KINDS[kind].test(String(c.kind)) && !(kind === "cruise" && /\bpassengers?\b.*\bterminal\b|\bcruise\b.*\b(terminal|pier|pirs?|quay|berth|wharf|dock|center|centre)s?\b/i.test(String(c.name || ""))));
  // Every real airport and station is kept, whether the map or the encyclopedia found it: a big airport known only from
  // its article must never be dropped (Round 2 re-check: dropping those picked a small airport silently, no question).
  // An airport's base name, without the terminal ("City Airport, Terminal 2" -> "City Airport").
  E.airportBase = n => String(n || "").replace(/\s*[,(-]\s*(terminals?|T)\s*[0-9A-Z]{1,3}\)?\s*$/i, "").trim();
  E.gateChoices = (list, kind) => { const key = n => String(n || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(), out = [];
    // Airports (tester round 7a: Venice-Lido and Kalaeloa still offered): the same field found twice, once by its
    // encyclopedia article (which says it is a general-aviation, closed or military field) and once on the map with
    // nothing said, is that same field, never offered. (A second airport the map alone knows is still offered: a real
    // one, such as a low-cost carriers' airport, must never be dropped for want of an article.)
    let bad = [];
    if (kind === "airport") bad = (list || []).filter(c => c && E.airportUse(c) === false);
    const sameField = (a, b) => key(E.airportBase(a.name)) === key(E.airportBase(b.name)) || (isFinite(a.lat) && isFinite(b.lat) && E.hav(a, b) <= 3);
    for (const c of list || []) { if (!c || !c.name || !isFinite(c.lat) || !isFinite(c.lng) || E.NOT_BUILT.test(c.name + " " + (c.kind || "")) || (kind && !E.gateOk(kind, c))) continue;
      if (kind === "airport" && E.airportUse(c) !== true && bad.some(b => sameField(b, c))) continue;
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
    // A group trip's day ends at the group's meeting time: not a minute past it (a day at the hotel may otherwise run 5 min over).
    if (d.meet) w.strict = true; if (d.date) w.date = String(d.date);
    // A port, station or airport far from every sight of the place (a port on another island, a gate grounded to the
    // wrong town) is as good as unknown: never planned from it.
    // A guide written as a trip out from that very place ("City from Port") names it, and is far by design.
    const GENERIC = /^(port|ports|cruise|terminal|terminals|pier|piers|harbou?r|marina|station|central|airport|international|ferry|new|old|the)$/;
    const named = String(d.placeName || "").toLowerCase(), words = String(P && P.name || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z]+/).filter(x => x.length >= 4 && !GENERIC.test(x));
    const servesFrom = words.some(x => named.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").includes(x));
    if (P && !P.unknown && !servesFrom && d.type !== "land" && isFinite(P.lat) && (d.siteSpots || []).length && Math.min(...d.siteSpots.map(x => E.hav(P, x))) > E.GATE_KM[d.mode === "flight" && d.type !== "port" && d.type !== "embark" ? "flight" : "other"])
      return E.fail(`${P.name} is ${Math.round(Math.min(...d.siteSpots.map(x => E.hav(P, x))))} km from every sight here, so it can't be the right place. Check where you arrive or leave; this day isn't planned on a guess.`, { unsure: true, farGate: true });
    // A city with more than one station or airport and none chosen: asked, never guessed.
    if (P && P.ask && P.ask.length > 1 && d.type !== "land" && d.type !== "port" && d.type !== "embark") { const word = (E.MODES[d.mode] || E.MODES.flight).word;
      // Terminals of one airport (two big hubs, tester round 7a): asked as the terminal, never as which airport.
      const bases = [...new Set(P.ask.map(E.airportBase))];
      if (word === "airport" && bases.length === 1 && P.ask.some(n => E.airportBase(n) !== n)) return E.fail(`Which terminal of ${bases[0]} ${d.type === "arrival" ? "do you arrive at" : "do you leave from"}? It's on your booking (${E.listWords(P.ask.slice(0, 4), "or")}). Choose it here${d.type === "arrival" ? "" : " and the day gets its time to leave by"}: no time is given on a guess.`, { unsure: true, askGate: true });
      return E.fail(`Which ${word} ${d.type === "arrival" ? "do you arrive at" : "do you leave from"}? There is more than one here (${E.listWords(P.ask.slice(0, 4), "or")}${P.ask.length > 4 ? " or another" : ""}). Choose it in the day's settings${d.type === "arrival" ? "" : " and the day gets its time to leave by"}: no time is given on a guess.`, { unsure: true, askGate: true }); }
    if (P && P.notGate && d.type !== "land") return E.fail(`${P.name} isn't an airport with passenger flights that I know of, so this day isn't planned from it. Name the airport on your booking and the day is planned from there.`, { unsure: true, notGate: true });
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
      // A late arrival's day ends no sooner than the traveler reaches the hotel (Nov 23: a 9:30 pm flight gave a day from
      // 10:45 pm to 11:00 pm and a plan reaching the hotel at 12:14 am, past its own end).
      w.sightFrom = w.start + chain(w.head, tr); w.endBy = Math.max(w.sightFrom, Math.min(23 * 60, lunchIn(w.sightFrom, d.hours)));
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
      // Only a departure in the small hours is the next morning's (E.NIGHT_DEP): a 9:00 am train on a day set to start at
      // 9:00 is this morning's, and the day starts earlier to reach it (leaveEarly below), with no sights (first-timer walk,
      // Nov 22: it was taken as the next morning's, planned sights all day and left "free time 16 h 10 min").
      const depAt = ship ? (isFinite(d.boardAt) ? d.boardAt : d.allAboard) : E.toMin(d.time);
      // A flight or train typed in the small hours could be this very morning or late tonight: the traveler is asked once,
      // and the day is planned on the answer (d.nightDep: "morning" | "night"), never on a guess (Nov 23 oracle: 00:20 and
      // 3:10 departures were taken as tonight's and the day filled with sights). Ships keep their all-aboard rule.
      const small = isFinite(w.start) && isFinite(w.endBy) && w.endBy + (ship ? E.BOARD_BEFORE : m.need) < w.start && isFinite(depAt) && depAt < E.NIGHT_DEP;
      if (small && !ship && d.nightDep !== "night" && d.nightDep !== "morning") { const lbl = (E.MODES[d.mode] || E.MODES.flight).label.toLowerCase();
        return E.fail(`Your ${lbl} leaves at ${E.clock(depAt)}. Is that early this morning, or late tonight after midnight? Choose below and the day is planned around it: nothing is planned on a guess.`, { unsure: true, askNight: true, depAt }); }
      if (small && (ship || d.nightDep === "night")) {
        w.endBy += 24 * 60; if (ship) { w.latest += 24 * 60; if (w.boardAt != null && w.boardAt < w.start) w.boardAt += 24 * 60; } }
      // Flying in the day the ship sails: under 3 hours left for sightseeing means none, straight to the ship.
      if (ship && d.thru && d.thru.mode === "flight") {
        const free = w.endBy - w.start - chain(w.head, tr) - chain(w.tail, tr);
        if (free < E.STRAIGHT_MIN) { w.straight = true; w.head = [w.head[0]]; w.tail = [end]; w.sightFrom = w.start; }
        w.notes.push(w.straight ? "flyInStraight" : "flyInWarn");
      }
      // Bags go into storage only when there is time to use between leaving and collecting them: under an hour free goes
      // straight on with the bags (outside test, Nov 22: bags left at 8:30 and collected at 8:45, nothing in between).
      if (d.thru && !w.straight && !d.noBags) { const free = w.endBy - w.start - chain(w.head, tr) - chain(w.tail, tr);
        if (free < E.BAGS_STORE_MIN) { w.straight = true; w.bagsStraight = true; w.head = [w.head[0]]; w.tail = [end]; w.sightFrom = w.start; w.notes.push("bagsStraight"); } }
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
      // Off a ship, plane or train the same day, the day can't start before it arrives: when the next one leaves too soon
      // to reach it, the day says so and plans nothing (weekly ladder, Nov 22: a 10:00 am flight after a 7:00 am ship
      // gave "Off the ship 5:30 am", before the ship was in).
      if (bare > w.endBy && w.through) { const am = (E.MODES[d.thru.mode] || E.MODES.flight).label.toLowerCase(), nx = d.type === "embark" ? "the ship" : "your " + (E.MODES[d.mode] || E.MODES.flight).label.toLowerCase();
        return Object.assign(E.fail(`This won't work as planned: your ${am} arrives at ${E.clock(E.toMin(d.thru.time))}, and getting off, the ride and the time ${nx} needs take until ${E.clock(bare)}, ${bare - w.endBy} min past the time to be there (${E.clock(w.endBy)}). Check both times on the Trip page.`), { tooTight: bare - w.endBy }); }
      if (bare > w.endBy) { const early = bare - w.endBy; w.plannedStart = w.start; w.start -= early; if (isFinite(w.sightFrom)) w.sightFrom -= early; w.leaveEarly = early; w.notes.push("leaveEarly"); }
    }
    return w;
  };
})(KEngine);
