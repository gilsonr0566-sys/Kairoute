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
    if (P && P.unknown && d.type !== "land" && !d.thru) return E.fail(`We couldn't find exactly where ${P.name} is, so this day isn't planned on a guess.`, { unsure: true });
    if (d.type === "land") {
      if (!L) return E.fail("Choose where you're staying.");
      w.head = [L]; w.tail = d.returnToStart ? [L] : [];
      w.start = E.toMin(d.startTime); w.endBy = Math.min(23 * 60 + 30, lunchIn(w.start, d.hours)); w.sightFrom = w.start;
    } else if (d.type === "arrival") {
      if (!L) return E.fail("Choose where you're staying."); if (!P) return E.fail("Choose your arrival point.");
      const m = E.MODES[d.mode] || E.MODES.flight;
      w.start = E.toMin(d.time) + m.clear; w.head = [P, fixed(L, "Check in or drop bags", 20)]; w.tail = [L];
      w.sightFrom = w.start + chain(w.head, tr); w.endBy = Math.min(23 * 60, lunchIn(w.sightFrom, d.hours));
    } else if (d.type === "departure" || d.type === "embark") {
      const ship = d.type === "embark", m = ship ? E.MODES.ship : E.MODES[d.mode] || E.MODES.flight;
      if (!P) return E.fail(ship ? "Choose the cruise port." : "Choose your departure point.");
      const end = Object.assign({}, P, { deadline: true });
      // Boarding: at the terminal by the boarding time, and never later than an hour before all aboard.
      const latest = ship ? d.allAboard - E.BOARD_BEFORE : null;
      w.endBy = ship ? (d.boardAt != null ? Math.min(d.boardAt, latest) : latest) : E.toMin(d.time) - m.need;
      if (ship) { w.boardAt = d.boardAt; w.latest = latest; }
      if (d.thru) { // off a ship, plane or train and leaving the same day: bags in storage near where you arrive
        const am = E.MODES[d.thru.mode] || E.MODES.flight, A = d.thru.point; if (!A) return E.fail("Choose where you arrive.");
        w.start = E.toMin(d.thru.time) + am.clear; w.through = true;
        w.head = d.noBags ? [A] : [A, fixed(A, "Leave your bags in luggage storage", 15)];
        w.tail = d.noBags ? [end] : [fixed(A, "Collect your bags", 15), end];
      } else {
        if (!L) return E.fail("Choose where you're staying.");
        w.start = E.toMin(d.startTime); w.head = [L]; w.tail = d.noBags ? [end] : [fixed(L, "Collect bags", 15), end];
      }
      // Flying in the day the ship sails: under 3 hours left for sightseeing means none, straight to the ship.
      if (ship && d.thru && d.thru.mode === "flight") {
        const free = w.endBy - w.start - chain(w.head, tr) - chain(w.tail, tr);
        if (free < E.STRAIGHT_MIN) { w.straight = true; w.head = [w.head[0]]; w.tail = [end]; w.sightFrom = w.start; }
        w.notes.push(w.straight ? "flyInStraight" : "flyInWarn");
      }
    } else if (d.type === "port") {
      if (!P) return E.fail("Choose where the ship docks.");
      w.start = d.portArrive + (d.tender ? E.TENDER_ASHORE : 30); w.buffer = E.PORT_BUFFER + (d.tender ? E.TENDER_BACK : 0); w.endBy = d.allAboard - w.buffer;
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
