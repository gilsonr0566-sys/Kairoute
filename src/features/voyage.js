// ---------- Days at sea: get ready for the next ports ----------
// A day at sea (or a port day spent on board) is a paid trip day too, so it gets its own page instead of an empty
// card: a briefing for each port coming up (the plan walked through, the story, what to look for, local words,
// money and manners, the big stories that match the traveler's interests), and a look back at the ports so far
// with the journal and the memory video. Everything comes from the trip's own checked guides and plans, which are
// kept on the device, so it all works with no internet on the ship; the spoken briefing uses the device voice
// when the natural voice can't be reached. No onboard activities are ever suggested: Kairoute has no ship data.

let voySel = null; // which panel the sea-day page shows: a day id, or "recap"

// The shore days a sea day prepares for: every port (or city) still ahead, up to the end of the cruise or the next
// six shore days, whichever comes first. Staying-on-board days are skipped; there is nothing to brief.
function voyAhead(d) {
  const i = trip.days.indexOf(d), out = [];
  for (const o of trip.days.slice(i + 1)) {
    if (noShore(o)) continue;
    if (throughTo(o)) continue; // its plan is on the leaving day that follows it
    if (cityFor(o)) out.push(o);
    if (out.length >= 6 || (o.type !== "port" && out.length >= 1)) break; // the cruise ends at its first non-port day
  }
  return out;
}
const voyBehind = d => trip.days.slice(0, Math.max(0, trip.days.indexOf(d))).filter(o => tourDay(o) && cityFor(o) && !throughTo(o));
function voyPlan(o) { try { const p = buildPlan(o); return p && !p.error ? p : null; } catch (e) { return null; } }
function voyStops(plan) { return plan ? plan.items.filter(x => x.type === "stop" && !x.place.along) : []; }
const voyWhen = o => fmtDow(o.date) + " " + fmtDate(o.date);
const voyWho = o => mainPlace(o) || o.destination || "your next stop";
// The traveler's interests, as the guide's own words (Bible, churches, history...), to pick the stories that matter.
function voyLikes(s) { const w = interestWords(); return w.reduce((a, k) => a + ((s.category + " " + s.summary + " " + (s.guide || "").slice(0, 400)).toLowerCase().includes(k) ? 1 : 0), 0); }
function voyDeep(plan) {
  const ints = interestWords(), stops = voyStops(plan).map(x => x.place).filter(s => !s.bonus || s.mustSee);
  const ranked = stops.map(s => ({ s, like: ints.length ? voyLikes(s) : 0 })).sort((a, b) => b.like - a.like || (b.s.mustSee ? 1 : 0) - (a.s.mustSee ? 1 : 0) || fameW(b.s) - fameW(a.s));
  const liked = ranked.filter(x => x.like);
  return { list: (liked.length ? liked : ranked).slice(0, 3).map(x => x.s), byInterest: !!liked.length };
}
function voyIntLabel() {
  const k = (trip.prefs && trip.prefs.interests) || []; if (!k.length) return "";
  const names = { bible: "the Bible", churches: "churches", history: "history", art: "art", architecture: "architecture", food: "food", views: "views", shopping: "shopping", beaches: "beaches", kids: "kids" };
  const l = k.map(x => names[x] || x); return l.length > 1 ? l.slice(0, -1).join(", ") + " and " + l[l.length - 1] : l[0];
}
// The heads-up a traveler should see before the day: what didn't fit, what's closed, a late plan, guessed port times.
function voyChecks(o, plan) {
  const out = [];
  if (!plan) return out;
  if (plan.over) out.push(`This plan runs ${dur(plan.end - plan.endBy)} past ${fmt(plan.endBy)}. Take out a stop.`);
  if ((plan.dropped || []).length) out.push(`Didn't fit: ${plan.dropped.map(s => s.name).join(", ")}.`);
  if ((plan.closedToday || []).length) out.push(`Closed that day: ${plan.closedToday.map(s => s.name).join(", ")}.`);
  if (o.estimated) out.push("These port times are estimated. Check them against your cruise documents.");
  return out;
}
function voyTimes(o, plan) {
  if (o.type === "port") return `Ship docks ${o.portArrive}${o.tender ? " (tender port)" : ""} · all aboard ${o.allAboard}${plan ? ` · your plan has you back by ${fmt(Math.min(plan.end, plan.endBy))}` : ""}`;
  if (o.type === "arrival") return `${MODES[o.mode] ? MODES[o.mode].label : "Arrival"} arrives ${o.time}${plan ? ` · sightseeing ${fmt(plan.start)}–${fmt(plan.endBy)}` : ""}`;
  if (o.type === "departure" || o.type === "embark") return plan ? `Sightseeing ${fmt(plan.start)}–${fmt(plan.end)} · be at ${plan.w.deadlineWord || "the terminal"} by ${fmt(plan.endBy)}` : "";
  return plan ? `${fmt(plan.start)}–${fmt(plan.end)}` : "";
}

// The spoken briefing: written from the plan and the guide, never by AI, so it's the same online or off.
function voyBriefText(o) {
  const city = cityFor(o), plan = voyPlan(o), name = voyWho(o), b = (city && city.basics) || {};
  const day = new Date(o.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  const out = [`Your briefing for ${day}: ${name}.`];
  if (o.type === "port") out.push(`The ship docks at ${o.portArrive}${o.tender ? ", and it's a tender port, so allow time for the boat to shore" : ""}. All aboard is at ${o.allAboard}${plan ? `, and your plan has you back at the ship by ${fmt(Math.min(plan.end, plan.endBy))}` : ""}. Being aboard on time is your responsibility, so check the all-aboard time on the ship that morning.`);
  else if (plan) out.push(voyTimes(o, plan).replace(/ · /g, ". ") + ".");
  if (city && city.primer && city.primer.text) out.push(city.primer.text);
  const st = voyStops(plan);
  if (st.length) {
    out.push("Here's your plan. " + plan.items.filter(x => x.type === "stop" && !x.place.along || x.type === "meal").map((x, k) => {
      const at = fmt(x.time);
      if (x.type === "meal") return `${x.meal.label} ${x.place.generic ? "near your stops" : "at " + x.place.name} around ${at}.`;
      return `${k ? "Then " : "First, "}${x.place.name}${x.place.bonus ? ", if you have time," : ""} at ${at}. ${x.place.summary || ""}`;
    }).join(" "));
    const look = st.map(x => x.place).filter(s => (s.lookFor || []).length).slice(0, 3);
    if (look.length) out.push("What to look for. " + look.map(s => `At ${s.name}: ${s.lookFor[0]}`).join(" "));
  }
  if (b.currency) out.push(`Money: the currency is the ${b.currency}.${b.tipping ? " Tipping: " + b.tipping : ""}`);
  if (b.safety) out.push("Staying safe: " + b.safety);
  const ph = (b.phrases || []).slice(0, 4);
  if (ph.length) out.push(`A few words${b.language ? " of " + b.language : ""}. ` + ph.map(p => `${p.local}${p.say ? ", said " + p.say : ""}, means ${p.meaning}.`).join(" "));
  out.push(`That's your briefing. Enjoy ${name}.`);
  return out.join("\n\n");
}

function voyPortPanel(o) {
  const i = trip.days.indexOf(o), city = cityFor(o), plan = voyPlan(o), b = (city && city.basics) || {};
  const checks = voyChecks(o, plan), deep = voyDeep(plan), st = voyStops(plan);
  const rows = plan ? plan.items.filter(x => (x.type === "stop" && !x.place.along) || x.type === "meal").map(x => `<li><b>${fmt(x.time)}</b> ${x.type === "meal" ? `${esc(x.meal.label)}${x.place.generic ? "" : ": " + esc(x.place.name)}` : `${x.place.bonus ? "Optional: " : ""}${esc(x.place.name)}`}</li>`).join("") : "";
  const kh = typeof gxKnowhow === "function" && freeAI ? gxKnowhow(city) : null;
  const khRows = kh && kh.groups ? GX_KH.filter(([g]) => (kh.groups[g] || []).length).map(([g, l]) => `<span class="eyebrow">${l}</span><ul class="gxlist">${kh.groups[g].slice(0, 4).map(x => `<li>${esc(x.t)}</li>`).join("")}</ul>`).join("") : "";
  const facts = [["Money", b.currency], ["Tipping", b.tipping], ["Staying safe", b.safety], ["Water", b.water], ["Plugs", b.plugs], ["Emergency", b.emergency]].filter(x => x[1]);
  const pr = city && city.primer && city.primer.text;
  const fold = (k, title, body, open) => body ? `<details class="card foldlist voyfold" data-voy-fold="${k}" ${open || voyOpen.has(k) ? "open" : ""}><summary>${title}</summary><div class="voyin">${body}</div></details>` : "";
  return `<div class="card voyday"><div class="voytop"><div><span class="eyebrow">${esc(voyWhen(o))} · ${esc(typeInfo(o.type).short)}</span><h3>${esc(dayName(o))}</h3><p class="lede small">${esc(voyTimes(o, plan))}</p></div>
      <div class="voyacts"><button class="btn small" data-voyopen="${i}:plan">Open the day plan</button><button class="btn ghost small" data-voyopen="${i}:sites">Change stops</button></div></div>
    ${checks.length ? `<div class="banner warn">${checks.map(esc).join(" ")}</div>` : ""}
    ${rows ? `<ol class="voyplan">${rows}</ol>` : `<p class="lede small">No stops planned yet. <button class="linkbtn" data-voyopen="${i}:sites">Choose stops</button></p>`}</div>
    ${fold("story", "The story of " + esc(voyWho(o)), pr ? `<div class="guidetext">${paras(pr)}</div><p class="ai-note">Told from Kairoute's checked guide and Wikivoyage.</p>` : "", true)}
    ${fold("deep", deep.byInterest ? "Go deeper: " + esc(voyIntLabel()) : "Go deeper: the big stories", deep.list.map(s => `<div class="voydeep"><div><b>${esc(s.name)}</b><span class="lede small">${esc(unitText(s.summary || ""))}</span></div><button class="btn ghost small" data-play="voystop:${i}:${esc(s.id)}" data-label="▶ Listen">${speakingId === "voystop:" + i + ":" + s.id ? "■ Stop audio" : "▶ Listen"}</button></div>`).join(""))}
    ${fold("look", "What to look for", st.map(x => x.place).filter(s => (s.lookFor || []).length).slice(0, 5).map(s => `<p><b>${esc(s.name)}:</b> ${esc(s.lookFor[0])}</p>`).join(""))}
    ${fold("words", "Local words" + (b.language ? " · " + esc(b.language) : ""), (b.phrases || []).length ? `<div class="phrases">${b.phrases.map((p, k) => `<button class="phrase" data-voyphrase="${i}:${k}"><span class="pl">${esc(p.local)}</span><span class="ps">${esc(p.say)}</span><span class="pm">${esc(p.meaning)}</span></button>`).join("")}</div>` : "")}
    ${fold("money", "Money, manners and safety", (facts.length ? `<div class="basics">${facts.map(([k, v]) => `<div><b>${k}</b><span>${esc(v)}</span></div>`).join("")}</div>` : "") + khRows)}`;
}

function voyRecapPanel(d) {
  const past = voyBehind(d), J = trip.journal || {};
  const rows = past.map(o => {
    const plan = voyPlan(o), ck = cityKeyFor(o) || "x", st = voyStops(plan).map(x => x.place);
    const js = st.map(s => J[ck + "/" + s.id] || {}), rated = js.filter(j => j.rating), photos = js.reduce((a, j) => a + (j.photos || []).length, 0);
    const avg = rated.length ? Math.round(rated.reduce((a, j) => a + j.rating, 0) / rated.length) : 0;
    return `<li><span class="voyrow"><b>${esc(voyWhen(o))}</b> ${esc(dayName(o))}</span><span class="lede small">${st.length} stop${st.length === 1 ? "" : "s"}${rated.length ? ` · rated ${rated.length}, ${"★".repeat(avg)}` : " · not rated yet"}${photos ? ` · ${photos} photo${photos === 1 ? "" : "s"}` : ""}</span></li>`;
  }).join("");
  return `<div class="card voyday"><div class="voytop"><div><span class="eyebrow">Your trip so far</span><h3>${past.length} day${past.length === 1 ? "" : "s"} ashore</h3></div>
    <div class="voyacts"><button class="btn small" data-goto="journal">Open the journal</button></div></div>
    ${rows ? `<ol class="voyplan voyrecap">${rows}</ol><p class="lede small">Rate your stops and add notes while they're fresh, then make your memory video in the journal.</p>` : `<p class="lede small">Nothing behind you yet. Your journal fills in as you tour.</p>`}</div>`;
}
const voyOpen = new Set();

function renderSea(d) {
  voyPrefetch();
  const ahead = voyAhead(d), past = voyBehind(d);
  if (!ahead.some(o => o.id === voySel) && voySel !== "recap") voySel = ahead[0] ? ahead[0].id : past.length ? "recap" : null;
  const sel = ahead.find(o => o.id === voySel) || null;
  const aboard = d.type === "port" ? `<div class="banner ok aboardcard" role="status"><span>⚓ Staying on board in ${esc(mainPlace(d) || "port")}: no shore plan and no ship-time alerts today.${aboardNote && aboardNote.day === d.id ? " " + esc(aboardNote.text) : ""}</span><button class="btn small" data-act="ashore">Go ashore after all</button></div>` : "";
  const main = sel ? `<button class="btn bigbtn tourbtn" data-play="brief:${esc(sel.id)}" data-label="▶ Hear the ${esc(voyWho(sel))} briefing">${speakingId === "brief:" + sel.id ? "■ Stop audio" : "▶ Hear the " + esc(voyWho(sel)) + " briefing"}</button>` : "";
  const list = ahead.map(o => `<button type="button" class="chip ${o === sel ? "on" : ""}" data-voysel="${esc(o.id)}" aria-pressed="${o === sel}"><b>${esc(fmtDate(o.date))}</b> ${esc(dayName(o))}</button>`).join("")
    + (past.length ? `<button type="button" class="chip ${voySel === "recap" ? "on" : ""}" data-voysel="recap" aria-pressed="${voySel === "recap"}"><b>↺</b> Your trip so far</button>` : "");
  const body = sel ? voyPortPanel(sel) : voySel === "recap" ? voyRecapPanel(d) : `<div class="card empty"><p>No more stops ahead on this trip.</p><button class="btn" data-goto="journal">Open the journal</button></div>`;
  return `${pageHead(d, null, main)}${aboard}
    <div class="guidegrid voygrid"><div class="guideside pane" data-pane="side">${list ? `<div class="eyebrow">Get ready for your next ${ahead.length === 1 ? "stop" : "stops"}</div><nav class="jumps" aria-label="Coming up">${list}</nav>` : ""}</div>
    <div class="guidemain pane" data-pane="stories">${body}</div></div>`;
}

// A leaving or boarding day with no night here: the arrival's page points to the one plan for the whole day.
function renderThrough(d) {
  const n = throughTo(d), k = trip.days.indexOf(n);
  return `${dayHeading(d)}<div class="card empty"><h3>Today is one plan</h3><p class="lede">${esc(MODES[d.mode] ? MODES[d.mode].label : "You")} in at ${esc(d.time)}, then ${n.type === "embark" ? "the ship" : "your " + (MODES[n.mode] ? MODES[n.mode].label.toLowerCase() : "departure")} at ${esc(n.type === "embark" ? n.allAboard : n.time)}: the sightseeing in between, your bags and the countdown are on one page.</p>
    <button class="btn" data-voyopen="${k}:${view === "guide" || view === "sites" ? view : "plan"}">See today's plan</button></div>`;
}

// Before the ship sails (or whenever the trip is opened online), the stories and local know-how for every stop
// ahead are fetched once and kept on the device, so the sea-day briefings work with no internet aboard.
let voyFetched = false;
function voyPrefetch() {
  if (voyFetched || !freeAI || typeof navigator === "undefined" || navigator.onLine === false) return;
  const todo = []; trip.days.forEach(o => { const c = !noShore(o) && cityFor(o); if (c && !todo.includes(c)) todo.push(c); });
  if (!todo.length || !trip.days.some(o => o.type === "port" || o.type === "sea")) return;
  voyFetched = true;
  todo.forEach((c, k) => setTimeout(() => { try { gxPrimer(c); gxKnowhow(c); } catch (e) {} }, 1500 * k + 2000));
}

// Taps on the sea-day page.
if (typeof document !== "undefined") {
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-voysel],[data-voyopen],[data-voyphrase]"); if (!t) return;
    if (t.dataset.voysel) { voySel = t.dataset.voysel; stopAudio(); render(); const m = document.querySelector('[data-pane="stories"]'); if (m) m.scrollTop = 0; return; }
    if (t.dataset.voyopen) { const [i, v] = t.dataset.voyopen.split(":"); trip.active = +i; view = v || "plan"; stopAudio(); save(); render(); toTop(); return; }
    if (t.dataset.voyphrase) { const [i, k] = t.dataset.voyphrase.split(":"), c = cityFor(trip.days[+i]), p = c && c.basics && (c.basics.phrases || [])[+k]; if (p) speakPhrase(p); }
  });
  document.addEventListener("toggle", e => { const el = e.target; if (el && el.dataset && el.dataset.voyFold) { if (el.open) voyOpen.add(el.dataset.voyFold); else voyOpen.delete(el.dataset.voyFold); } }, true);
}
// The audio buttons on this page go through the app's one play handler (data-play), which calls this.
function voyPlay(id) {
  if (id.startsWith("brief:")) { const o = trip.days.find(x => x.id === id.slice(6)); if (o) speakText(id, voyBriefText(o)); return true; }
  if (id.startsWith("voystop:")) {
    const [, i, sid] = id.split(":"), o = trip.days[+i], s = o && allSites(cityFor(o) || {}).find(x => x.id === sid); if (!s) return true;
    if (speakingId === id) { stopAudio(); return true; }
    stopAudio(); speakLines(id, toLines(siteLines(s)), null); return true;
  }
  return false;
}
if (typeof window !== "undefined") window.__kairouteVoyage = () => { const d = day(); return { ahead: voyAhead(d).map(o => ({ id: o.id, name: dayName(o) })), behind: voyBehind(d).length, sel: voySel, brief: voySel && voySel !== "recap" ? voyBriefText(trip.days.find(o => o.id === voySel)) : "" }; };

// ---------- Checks for the publish safety net (tools/voyage-check.cjs) ----------
// Sea days, boarding days, leaving days and cruise-end days on the sample trip and on small test trips: every one
// gives the traveler something real, and no plan ever risks the ship, train or plane.
if (typeof window !== "undefined") window.__kairouteVoyageCheck = () => {
  const res = [], ok = (name, pass, info) => res.push({ name, pass: !!pass, info: info || "" });
  const keep = trip, keepView = view, fresh = () => { bonusMemo = new Map(); mealMemo = new Map(); keptMemo = new Map(); eveMemo = new Map(); avoidMeals = new Set(); };
  const leavingOk = (d, label) => {
    const city = cityFor(d); seedPicks(d, city); fresh(); const pl = buildPlan(d);
    if (!pl || pl.error) { ok(label + ": has a plan", false, pl && pl.error); return null; }
    const stops = pl.items.filter(x => x.type === "stop"), far = stops.filter(x => !nearLeaving(x.place, pl.w) && !(d.selected || []).includes(x.place.id));
    ok(label + ": the plan ends by the be-there-by time", !pl.over && pl.end <= pl.endBy, fmt(pl.end) + " vs " + fmt(pl.endBy));
    ok(label + ": no day trips or far sights added", !far.length, far.map(x => x.place.name).join(", "));
    ok(label + ": the last item is the terminal, station or airport", pl.items[pl.items.length - 1].type === "end" && pl.w.tail[pl.w.tail.length - 1].deadline);
    ok(label + ": says when to be there", (pl.w.notesEnd || []).some(t => /be at the .+ by \d\d:\d\d/i.test(t)));
    return pl;
  };
  try {
    // 1. The sample trip.
    trip = sampleTrip(); fresh();
    const sea = trip.days.findIndex(d => d.type === "sea"), emb = trip.days.findIndex(d => d.type === "embark");
    trip.active = sea; view = "plan"; voySel = null; render();
    const v = document.getElementById("view"), ahead = voyAhead(trip.days[sea]);
    ok("Sea day: a page to get ready, not an empty card", v.querySelector(".voygrid") && !v.querySelector(".seacard"));
    ok("Sea day: lists the ports ahead, the next one first", ahead.length >= 2 && ahead[0] === trip.days.slice(sea + 1).find(o => !noShore(o)), ahead.map(dayName).join(", "));
    ok("Sea day: one main action, the briefing", v.querySelectorAll(".tourbtn").length === 1 && /briefing/.test(v.querySelector(".tourbtn").textContent));
    const br = voyBriefText(ahead[0]);
    ok("Briefing: ship times and responsibility", /All aboard is at \d\d:\d\d/.test(br) && /your responsibility/.test(br));
    ok("Briefing: walks through the plan", /Here's your plan\. First, /.test(br));
    ok("Briefing: money and local words", /currency/.test(br) && /A few words/.test(br));
    ok("Briefing: built from the guide only (no AI needed, works offline)", br.length > 400);
    ok("Sea day: the plan review lists the port's stops", v.querySelectorAll(".voyplan li").length >= 2);
    const deep = voyDeep(voyPlan(ahead[0]));
    ok("Sea day: deep dives follow the traveler's interests", !deep.byInterest || deep.list.every(s => voyLikes(s) > 0), deep.list.map(s => s.name).join(", "));
    voySel = "recap"; render();
    ok("Sea day: a look back at the ports so far", !!document.querySelector(".voyrecap") && document.querySelectorAll(".voyrecap li").length === voyBehind(trip.days[sea]).length);
    // 2. Boarding and leaving days on the sample trip.
    const pe = leavingOk(trip.days[emb], "Boarding day (Athens)");
    trip.days.forEach((d, i) => { if (d.type === "departure") leavingOk(d, "Leaving day " + i + " (" + mainPlace(d) + ")"); });
    // 3. Boarding is the only day in the city: the hours before the ship get real sights and lunch.
    trip = sampleTrip(); trip.days = [newDay({ date: "2027-07-04", destination: "Athens", type: "embark", startTime: "09:00", allAboard: "18:30" }), newDay({ date: "2027-07-05", destination: "At sea", type: "sea" })]; trip.active = 0; fresh();
    const p1 = leavingOk(trip.days[0], "Boarding day, only day in Athens");
    ok("Boarding day, only day in Athens: real sights before the ship", p1 && p1.items.filter(x => x.type === "stop").length >= 2, p1 && p1.items.filter(x => x.type === "stop").map(x => x.place.name).join(", "));
    ok("Boarding day, only day in Athens: lunch is planned", p1 && p1.items.some(x => x.type === "meal"));
    // 4. Off the cruise and flying home the same day: one plan from the ship to the airport, bags stored.
    trip = sampleTrip(); trip.days = [newDay({ date: "2027-07-14", destination: "At sea", type: "sea" }), newDay({ date: "2027-07-15", destination: "Barcelona", type: "arrival", mode: "ship", time: "07:00", cityKey: "barcelona" }), newDay({ date: "2027-07-15", destination: "Barcelona", type: "departure", mode: "flight", time: "17:00", cityKey: "barcelona" })]; trip.active = 2; fresh();
    const p2 = leavingOk(trip.days[2], "Cruise end, flight home");
    ok("Cruise end: the day starts off the ship, not at a hotel", p2 && /Off the ship/.test(p2.w.startLabel) && p2.start === 7 * 60 + MODES.ship.clear, p2 && p2.w.startLabel);
    ok("Cruise end: bags go into storage and are collected", p2 && p2.items.some(x => x.place && /Leave your bags/.test(x.place.name)) && p2.items.some(x => x.place && /Collect your bags/.test(x.place.name)));
    ok("Cruise end: sights between the ship and the airport", p2 && p2.items.filter(x => x.type === "stop").length >= 2);
    ok("Cruise end: the flight countdown runs on this day", !!fixedTitle(trip.days[2]) && p2 && p2.w.tail.length);
    trip.active = 1; view = "plan"; render();
    ok("Cruise end: the morning's page points to the one plan", !!document.querySelector('#view [data-voyopen="2:plan"]') && !document.querySelector("#view .timeline"));
    ok("Cruise end: the sea day before it briefs that day", voyAhead(trip.days[0]).map(o => o.id).join() === trip.days[2].id);
    trip.days[2].noBags = true; fresh(); const p3 = buildPlan(trip.days[2]);
    ok("Cruise end without bags to store: no storage stops", p3 && !p3.error && !p3.items.some(x => x.place && /bags/i.test(x.place.name)));
    // 5. Dates: an arrival and a departure the same day stay on that day.
    const ds = parseDayLines("DAY|2027-07-15|Barcelona|arrival|ship|07:00||||||\nDAY|2027-07-15|Barcelona|departure|flight|17:00||||||");
    ok("Dates: off the ship and flying the same day keep the same date", ds.length === 2 && ds[0].date === ds[1].date, ds.map(x => x.date).join(" "));
    // 6. A day with no picks left is filled, but a day the traveler cleared stays clear.
    trip = sampleTrip(); fresh(); const e2 = trip.days[emb]; e2.selected = []; e2.autoEmpty = false; fresh();
    ok("A boarding day the traveler cleared stays clear", !buildPlan(e2).items.some(x => x.type === "stop"));
    ok("Sample boarding day keeps something to do", pe && pe.items.some(x => x.type === "stop"));
    // 7. The boarding day's one leave-by time runs through the bag pickup and doesn't move with the stops.
    trip = sampleTrip(); fresh(); const e3 = trip.days[emb], lb = f => { e3.fillTime = f; fresh(); const p = buildPlan(e3); return p && p.items ? alarmState(e3, p) : null; };
    const s1 = lb(true), s0 = lb(false);
    ok("Boarding day: leave-by allows for collecting the bags, the same with or without optional stops", s1 && s0 && s1.via && s1.leaveBy === s0.leaveBy && s1.leaveBy <= s1.backBy - (s1.via.minutes || 0), s1 && s0 ? fmt(s1.leaveBy) + " / " + fmt(s0.leaveBy) + (s1.via ? " via " + s1.via.name : " (no bag stop)") : "no plan");
  } catch (e) { ok("checks ran", false, String(e && e.stack || e)); }
  finally { trip = keep; view = keepView; voySel = null; fresh(); render(); }
  return res;
};
