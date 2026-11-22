// ===================== Group trips and group tours =====================
// Group trips (Richard, Nov 21 2026): the owner picks ONE trip and sends its code (or link); that trip only is shared,
// their other trips stay private. Everyone who joins gets the trip on their own phone. On each day a member either
// follows the group's plan (kept in step with the owner's) or makes their own day. Safety rule: every plan on a day
// ends at the same meeting place and time, because the day's fixed facts (dates, hotel, ship, train, start and end
// times) always come from the group's plan; only the sights, order and meals are the member's own. A member can offer
// their own day to the group, and the owner can use it for everyone (with an undo). The owner can mark a day as a
// tour the group booked: Kairoute plans no sights that day.
// One person leads; everyone else follows on their own phone. Followers get the leader's trip once (it then
// works offline), move to the leader's step as the leader moves, hear the same story start when the leader
// plays it, and get a "regroup" call with the meeting spot. With a weak signal, each phone simply carries on
// with the tour by itself and catches up when the signal is back. The group lives on Kairoute's helper for
// two days (see worker/extras.js); journals and notes are never shared.
const GRP_STORE = "kairoute.group", GRP_LEAD = "kairoute.groupdays";
// The day's fixed facts: they set where and when the day starts and ends, so they always come from the group's plan.
const GRP_FACTS = ["date", "destination", "type", "mode", "time", "pointIdx", "portArrive", "allAboard", "tender", "startTime", "hours", "returnToStart",
  "cityKey", "estimated", "aboard", "boardAt", "through", "thru", "noBags", "timeGuess", "lastDay", "lodging", "point", "pointPicked", "event", "grpTour", "country", "typed"];
const GRP_KEEP = new Set(["id", "grpOwn", ...GRP_FACTS]);
// A day's own plan (what to see, the order, meals): everything but the fixed facts.
const grpPlanPart = d => { const o = {}; for (const k in d || {}) if (!GRP_KEEP.has(k)) o[k] = d[k]; return o; };
// A group day with someone else's plan on it: the group day's facts, the other plan's picks, order and meals.
function grpWithPlan(groupDay, planDay) { const o = {}; GRP_FACTS.concat(["id"]).forEach(k => { if (k in groupDay) o[k] = groupDay[k]; }); return Object.assign(grpPlanPart(planDay), o); }
let grp = (() => { try { return JSON.parse(localStorage.getItem(GRP_STORE) || "null"); } catch (e) { return null; } })();
let grpNote = "", grpBusy = false, grpLastLive = "", grpLastTrip = "", grpPollTimer = null, grpFails = 0, grpRegroupForm = false;
const grpSave = () => { try { if (grp) localStorage.setItem(GRP_STORE, JSON.stringify(grp)); else localStorage.removeItem(GRP_STORE); } catch (e) {} };
const grpFmt = c => c ? c.slice(0, 3) + "-" + c.slice(3) : "";
const grpWho = (() => { try { let w = localStorage.getItem("kairoute.devid2"); if (!w) { w = Math.random().toString(36).slice(2, 10); localStorage.setItem("kairoute.devid2", w); } return w; } catch (e) { return "x"; } })();
async function grpCall(body, query) {
  if (!freeAI) throw new Error("offline");
  const r = await fetch(freeAI.url + "/x/group" + (query || ""), body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const j = await r.json().catch(() => null); return { status: r.status, j };
}
// What followers receive: this trip's days and the city guides it uses. No journal, notes or photos.
function grpSnapshot() {
  const t = JSON.parse(JSON.stringify(trip)); delete t.journal; delete t.tour; delete t.badges;
  // The group's plan as the owner sees it: its stops in their order, so a member following the day sees the same day in
  // the same order from the first second, not one their own phone works out while its map answers are still arriving
  // (Nov 22 outside test: a new member's day had the group's 7 sights in another order for its first minutes).
  try { const P = typeof window !== "undefined" && window.__kairoutePlanStops ? window.__kairoutePlanStops() : [];
    t.days.forEach((x, i) => { delete x.grpOrder; const ids = P[i] || []; if (ids.length && !x.grpTour) x.grpOrder = ids; }); } catch (e) {}
  const cs = {}; trip.days.forEach(d => { const k = cityKeyFor(d); if (k && cities[k] && k !== "barcelona") cs[k] = cities[k]; });
  return { trip: t, cities: cs };
}
function grpLive() {
  const T = trip.tour, d = day();
  return { dayId: d.id, i: T && T.dayId === d.id ? T.i : 0, phase: T && T.dayId === d.id ? T.phase : "at", part: T && T.part || 0, play: speakingId && !/^(voice-sample|ans:|kids:|primer:)/.test(speakingId) ? speakingId : null, touring: view === "tour" };
}
async function grpLead() {
  if (grpBusy) return null; grpBusy = true; grpNote = ""; render();
  try {
    const { status, j } = await grpCall({ op: "new", trip: grpSnapshot(), name: trip.name || tripName(trip), live: grpLive() });
    if (status === 200 && j && j.code) { trip.groupShared = j.code; save(); grp = { code: j.code, role: "lead", token: j.token, tripId: trip.id, at: Date.now(), tripName: trip.name || tripName(trip) }; grpSave(); grpLastLive = ""; grpLastTrip = JSON.stringify(trip.days); grpNote = ""; return { code: j.code }; }
    grpNote = "The group couldn't start just now. Try again in a minute.";
  } catch (e) { grpNote = "Starting a group needs the internet. Try again when you're online."; }
  finally { grpBusy = false; render(); }
  return null;
}
function grpInstall(j, code, open) {
  for (const k in j.trip.cities || {}) if (!cities[k] && j.trip.cities[k] && Array.isArray(j.trip.cities[k].sites)) cities[k] = j.trip.cities[k];
  const id = "grp-" + code, lead = j.trip.trip, entry = library.find(x => x.id === id);
  const cur = trip && trip.id === id ? trip : entry ? entry.trip : null;
  // The member's own days stay theirs: they take the group day's facts (so they end where and when the group does)
  // and keep their own sights, order and meals.
  const mine = new Map(((cur && cur.days) || []).filter(d => d.grpOwn).map(d => [d.id, d]));
  try { localStorage.setItem(GRP_LEAD, JSON.stringify({ code, days: lead.days })); } catch (e) {}
  const t = JSON.parse(JSON.stringify(lead)); t.id = id; t.name = "Group: " + (j.name || tripName(lead)); t.group = code; t.journal = (cur && cur.journal) || {};
  t.days = t.days.map(ld => { const m = mine.get(ld.id); return m ? Object.assign(grpWithPlan(ld, m), { grpOwn: true }) : ld; });
  t.active = cur ? Math.max(0, Math.min(cur.active || 0, t.days.length - 1)) : Math.max(0, Math.min(lead.active || 0, t.days.length - 1));
  if (trip && trip.id === id) { trip = t; if (!trip.prefs) trip.prefs = defaultPrefs(); save(); return; }
  if (open) { if (trip && trip.days && trip.days.length) storeInLibrary(); const old = library.findIndex(x => x.id === id); if (old >= 0) library.splice(old, 1); trip = t; if (!trip.prefs) trip.prefs = defaultPrefs(); save(); return; }
  // The member is looking at another of their trips: update the group trip quietly, never switch trips under them.
  if (entry) { entry.trip = t; entry.updated = Date.now(); } else library.unshift({ id, name: t.name, updated: Date.now(), trip: t });
  save();
}
// The group's latest plan for a day, as the owner last sent it.
function grpLeadDay(id) { try { const g = JSON.parse(localStorage.getItem(GRP_LEAD) || "null"); return g && grp && g.code === grp.code ? (g.days || []).find(d => d.id === id) || null : null; } catch (e) { return null; } }
const grpTrip = () => !grp ? null : trip.id === grp.tripId ? trip : ((library.find(x => x.id === grp.tripId) || {}).trip || null);
const grpOwnIds = () => ((grpTrip() || {}).days || []).filter(d => d.grpOwn).map(d => d.id);
const grpHello = () => grp && grp.role === "follow" ? grpCall({ op: "hello", code: grp.code, who: grpWho, own: grpOwnIds() }).catch(() => {}) : null;
async function grpJoin(code) {
  code = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 6) { grpNote = "A group code has 6 letters and numbers, like K7M-4RX."; render(); return { ok: false }; }
  grpBusy = true; grpNote = ""; render();
  try {
    const { status, j } = await grpCall(null, "?code=" + code + "&since=0");
    if (status === 200 && j && j.trip) {
      grp = { code, role: "follow", tripId: "grp-" + code, rev: j.rev, tripRev: j.tripRev, follow: true, lastOk: Date.now(), seenRegroup: j.regroup ? j.regroup.id : "", tripName: j.name || "" };
      grpInstall(j, code, true); grpSave();
      grpApply(j, true); grpHello(); grpSchedule(1000); view = "trip";
      grpBusy = false; render(); return { ok: true };
    }
    grpNote = status === 404 ? "That group wasn't found. Check the code with your group leader." : "Couldn't reach the group just now. Try again in a minute.";
  } catch (e) { grpNote = "Joining needs the internet. Try again when you're online."; }
  grpBusy = false; render(); return { ok: false };
}
// Follower: go where the leader is, and start the same story when the leader starts it.
function grpApply(j, first) {
  if (!grp || grp.role !== "follow") return;
  if (j.trip && !first) { grpInstall(j, grp.code, false); grp.tripRev = j.tripRev; }
  grp.rev = j.rev; grp.lastOk = Date.now(); grp.followers = j.followers; grp.name = j.name; grp.members = j.members; grp.ownDays = j.ownDays || {}; grp.offers = j.offers || {};
  if (j.regroup && j.regroup.id !== grp.seenRegroup) {
    grp.regroup = j.regroup; grp.seenRegroup = j.regroup.id;
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]); } catch (e) {}
    if (!speakingId && window.speechSynthesis) try { speechSynthesis.speak(new SpeechSynthesisUtterance("Your group leader asks everyone to regroup at " + j.regroup.where + (j.regroup.note ? ". " + j.regroup.note : "."))); } catch (e) {}
  }
  const L = j.live; grpSave();
  if (L && grp.follow && trip.id === grp.tripId) {
    const key = JSON.stringify([L.dayId, L.i, L.phase, L.part, L.touring]);
    if (key !== grpLastLive || first) {
      grpLastLive = key; const di = trip.days.findIndex(d => d.id === L.dayId);
      if (di >= 0 && L.touring) { trip.active = di; trip.tour = Object.assign({ found: [], nudged: 0, arrivedAt: Date.now() }, trip.tour && trip.tour.dayId === L.dayId ? trip.tour : {}, { dayId: L.dayId, i: L.i, phase: L.phase, part: L.part }); if (view !== "tour") { stopAudio(); view = "tour"; } }
    }
    if (L.play && L.play !== speakingId && L.play !== grp.lastPlay && Date.now() - (L.at || 0) < 120000) {
      grp.lastPlay = L.play; setTimeout(() => { const b = document.querySelector(`[data-play="${CSS.escape(L.play)}"]`); if (b && speakingId !== L.play) b.click(); }, 400);
    }
  }
  render();
}
async function grpPoll() {
  if (!grp || grp.role !== "follow") return;
  try {
    const { status, j } = await grpCall(null, "?code=" + grp.code + "&since=" + (grp.tripRev || 0));
    if (status === 200 && j) { grpFails = 0; if (j.rev !== grp.rev || j.trip || !grp.lastOk || Date.now() - grp.lastOk > 15000) grpApply(j); else { grp.lastOk = Date.now(); grpSave(); } }
    else if (status === 404) { grpNote = "The group has ended. Your copy of the trip stays on this phone."; grp = null; grpSave(); render(); }
    else grpFails++;
  } catch (e) { grpFails++; }
}
function grpSchedule(ms) {
  clearTimeout(grpPollTimer); if (!grp || grp.role !== "follow") return;
  grpPollTimer = setTimeout(async () => { if (document.visibilityState !== "hidden") await grpPoll(); grpSchedule(Math.min(view === "tour" ? 20000 : 120000, (view === "tour" ? 3000 : 30000) * Math.pow(2, Math.min(grpFails, 3)))); if (view === "tour") { const el = document.getElementById("grpSignal"); if (el) el.innerHTML = grpSignalText(); } }, ms);
}
// Leader: send the current step (and the trip, when its plan changes) whenever it changes.
async function grpPush() {
  if (!grp || grp.role !== "lead" || trip.id !== grp.tripId) return;
  const live = grpLive(), key = JSON.stringify(live);
  if (key !== grpLastLive) { grpLastLive = key; try { const r = await grpCall({ op: "live", code: grp.code, token: grp.token, live }); if (r.status === 404) { grp = null; grpSave(); grpNote = "This group code has expired."; render(); } } catch (e) { grpLastLive = ""; } }
  const days = JSON.stringify(trip.days);
  if (days !== grpLastTrip && Date.now() - (grp.tripAt || 0) > 10000) { grp.tripAt = Date.now(); grpSave(); try { const r = await grpCall({ op: "trip", code: grp.code, token: grp.token, trip: grpSnapshot() }); if (r.status === 200) grpLastTrip = days; } catch (e) {} }
}
async function grpRegroup(where, note) {
  if (!grp || grp.role !== "lead") return;
  const pos = geoPos && geoState === "on" ? geoPos : null;
  try { await grpCall({ op: "regroup", code: grp.code, token: grp.token, where: where || "my location", note: note || "", lat: pos ? pos.lat : null, lng: pos ? pos.lng : null }); grpNote = "Regroup call sent to everyone."; } catch (e) { grpNote = "No signal: the regroup call couldn't be sent. Try again in a moment."; }
  grpRegroupForm = false; render();
}
async function grpEnd() {
  if (!grp) return;
  if (grp.role === "lead") { try { await grpCall({ op: "end", code: grp.code, token: grp.token }); } catch (e) {} const t = grpTrip(); if (t) { delete t.groupShared; } }
  grp = null; grpSave(); grpNote = ""; render();
}
function grpSignalText(ms) {
  if (!grp || grp.role !== "follow") return "";
  const gap = ms != null ? ms : Date.now() - (grp.lastOk || 0);
  return gap > 15000 ? `📶 No signal from the leader for ${gap < 120000 ? Math.round(gap / 1000) + " seconds" : Math.round(gap / 60000) + " minutes"}. Keep going on your own phone; you'll catch up when the signal's back.` : "";
}
// The bar at the top of the tour.
function groupBar() {
  if (!grp || trip.id !== grp.tripId) return "";
  if (grp.role === "lead") {
    const s = day(), T = trip.tour; let here = ""; try { const st = tourSteps(buildPlan(s))[T.i]; here = st && st.place ? st.place.name : ""; } catch (e) {}
    return `<div class="banner grpbar"><span>👥 <b>Leading a group</b> · code <b>${esc(grpFmt(grp.code))}</b>${grp.followers ? " · " + grp.followers + " following" : ""}</span>
      <span class="grpacts"><button class="btn small" data-grp="regroupform">Regroup</button><button class="btn ghost small" data-grp="end">End group</button></span>
      ${grpRegroupForm ? `<form class="ask grpform" data-grp-form="1"><input id="grp-where" type="text" value="${esc(here)}" aria-label="Where to meet" placeholder="Where to meet"><select id="grp-when" aria-label="When"><option value="">Now</option><option>In 10 minutes</option><option>In 20 minutes</option><option>In 30 minutes</option></select><button class="btn small" type="submit">Send</button></form>` : ""}
      ${grpNote ? `<span class="small">${esc(grpNote)}</span>` : ""}</div>`;
  }
  const rg = grp.regroup;
  return `<div class="banner grpbar"><span>👥 <b>Following ${esc(grp.name || "the group")}</b>${grp.follow ? "" : " · touring on your own"}</span>
    <span class="grpacts">${grp.follow ? "" : `<button class="btn small" data-grp="catchup">Catch up with the leader</button>`}<button class="btn ghost small" data-grp="leave">Leave group</button></span>
    <span id="grpSignal" class="small">${grpSignalText()}</span></div>
    ${rg && !grp.regroupOk ? `<div class="banner warn grpregroup" role="alert"><span>📣 <b>Regroup${rg.note ? " " + esc(rg.note.toLowerCase()) : " now"}</b> at <b>${esc(rg.where)}</b>${rg.lat ? ` · <a href="https://www.google.com/maps/dir/?api=1&destination=${rg.lat},${rg.lng}&travelmode=walking" target="_blank" rel="noopener">Directions${geoPos ? " (" + distTxt(hav(geoPos, rg)) + ")" : ""}</a>` : ""}</span><button class="btn small" data-grp="regroupok">On my way</button></div>` : ""}`;
}
// Open one of the traveler's trips (the group's, or the one they want to share).
function grpOpenTrip(id) {
  if (trip.id === id) return true; const x = library.find(y => y.id === id); if (!x) return false;
  storeInLibrary(); trip = x.trip; if (!trip.prefs) trip.prefs = defaultPrefs(); save(); return true;
}
const grpLink = () => grp ? location.origin + location.pathname + "#join=" + grp.code : "";
const grpTripsToShare = () => library.filter(x => x.trip && x.trip.days && x.trip.days.length && !x.trip.group && !x.trip.archived && !x.trip.placeholder);
// Settings > Group trip.
function groupCard() {
  const H = `<h3>Group trip</h3>`;
  if (!freeAI) return `<div class="card">${H}<p class="lede">Group trips need Kairoute's helper, which isn't available in this view.</p></div>`;
  const note = grpNote ? `<p class="banner" role="status">${esc(grpNote)}</p>` : "";
  if (grp && grp.role === "lead") return `<div class="card grpcard">${H}<p class="lede">You're sharing <b>${esc(grp.tripName || "this trip")}</b> with your group. Only this trip is shared: your other trips stay private.</p>
    <p class="lede small">Send this code or link. Anyone who opens it gets the trip on their own phone:</p><p class="synccode">${esc(grpFmt(grp.code))}</p>
    <div class="actions"><button class="btn" data-grp="invite">Send the invite</button><button class="btn ghost" data-grp="opentrip">Open the trip</button><button class="btn ghost" data-grp="opentour">Tour together</button></div>
    <p class="lede small">${grp.members ? `${grp.members} ${grp.members === 1 ? "person has" : "people have"} joined. ` : ""}On each day, everyone can follow your plan or make their own day. Every plan on a day ends at the same place and time as yours.</p>
    <div class="actions"><button class="btn ghost" data-grp="end">Stop sharing this trip</button></div>${note}</div>`;
  if (grp) return `<div class="card grpcard">${H}<p class="lede">You've joined <b>${esc(grp.name || grp.tripName || "a group trip")}</b>. On each day you can follow the group's plan or make your own day; either way you end where and when the group does.</p>
    <div class="actions"><button class="btn" data-grp="opentrip">Open the trip</button><button class="btn ghost" data-grp="opentour">Tour together</button><button class="btn ghost" data-grp="leave">Leave the group</button></div>${note}</div>`;
  const list = grpTripsToShare();
  return `<div class="card grpcard">${H}<p class="lede">Traveling with family, friends or a tour group? Pick the trip to share. Each person gets it on their own phone and, day by day, follows the group's plan or makes their own day. Only the trip you pick is shared.</p>
    ${list.length ? `<div class="grptrips">${list.map(x => `<div class="grptrip"><span><b>${esc(x.trip.name || x.name || tripName(x.trip))}</b><span class="small">${esc(fmtDate(x.trip.days[0].date) || "")}${x.trip.days.length > 1 ? " – " + esc(fmtDate(x.trip.days[x.trip.days.length - 1].date) || "") : ""} · ${x.trip.days.length} days</span></span><button class="btn small" data-grp="lead" data-trip="${esc(x.id)}" ${grpBusy ? "disabled" : ""}>Share this trip</button></div>`).join("")}</div>` : `<p class="lede small">Add a trip first, then share it here.</p>`}
    <div class="field"><label for="grp-code">Got a code from your group? Type it here</label><div class="ask"><input id="grp-code" type="text" autocapitalize="characters" autocomplete="off" maxlength="7" placeholder="e.g. K7M-4RX"><button class="btn" data-grp="join" ${grpBusy ? "disabled" : ""}>${grpBusy ? "Joining…" : "Join"}</button></div></div>
    ${note}</div>`;
}
// The meeting point of a day: where and when its plan ends (hotel, ship, station). Every plan that day ends there.
function grpMeet(plan) {
  if (!plan || plan.error || !plan.items) return null;
  const end = plan.items.find(x => x.type === "end"); if (!end) return null;
  return { known: !!(end.place && end.label && end.label !== "Day done"), where: end.label || "", time: plan.endBy, ends: plan.end };
}
const grpMeetLine = (m, own) => !m ? "" : m.known ? `${own ? "Meet your group" : "Everyone meets"}: <b>${esc(m.where.replace(/^Back at /, "back at ").replace(/^Boarding at /, "boarding at ").replace(/^At /, "at "))}</b> by <b>${fmt(m.time)}</b>.` : `This day has no set end point, so plans can end in different places. Agree where to meet, or use Regroup on the tour.`;
// The card at the top of a group trip's Day plan.
function grpDayCard(d, plan) {
  if (!grp || trip.id !== grp.tripId || !d || noShore(d)) return "";
  const m = grpMeet(plan), late = m && m.known && plan.end > m.time;
  const tour = d.grpTour ? `<p class="small">🎟 <b>Booked tour with the group today.</b> Kairoute plans no sights or lunch; your tour company runs the day.</p>` : "";
  const lateNote = late ? `<p class="small warn" role="alert">This plan ends ${dur(plan.end - m.time)} after the group meets. Take a stop off with Choose sights.</p>` : "";
  if (grp.role === "lead") {
    const own = (grp.ownDays || {})[d.id] || 0, offers = (grp.offers || {})[d.id] || [];
    return `<div class="banner grpday" data-grpday="lead"><div><span>👥 <b>Group day</b> · ${grp.members ? (grp.members - own) + " following your plan" + (own ? `, ${own} on their own day` : "") : "nobody has joined yet"}</span>
      <p class="small">${grpMeetLine(m, false)}</p>${tour}${lateNote}
      ${offers.map(o => `<p class="small grpoffer"><span>💡 <b>${esc(o.name || "Someone")}</b> offers their own plan for this day.</span> <button class="btn small" data-grp="useoffer" data-who="${esc(o.who)}">Use it for everyone</button> <button class="btn ghost small" data-grp="dropoffer" data-who="${esc(o.who)}">No thanks</button></p>`).join("")}
      ${d.grpUndo ? `<p class="small">You changed the group's plan for this day. <button class="linkbtn" data-grp="undoday">Undo</button></p>` : ""}</div></div>`;
  }
  if (d.grpOwn) {
    const offered = (((grp.offers || {})[d.id]) || []).some(o => o.who === grpWho);
    return `<div class="banner grpday ok" data-grpday="own"><div><span>🧭 <b>Your own day</b> · the group follows its own plan today.</span>
      <p class="small">${grpMeetLine(m, true)} Your plan is built to end there in time.</p>${tour}${lateNote}
      ${offered || grp.me ? "" : `<input id="grp-me" type="text" maxlength="40" autocomplete="given-name" placeholder="Your name (shown to the group)" aria-label="Your name, shown to the group">`}
      <span class="grpacts"><button class="btn small" data-grp="offer">${offered ? "Offered to the group ✓" : "Offer my day to the group"}</button><button class="btn ghost small" data-grp="follow">Back to the group's plan</button></span></div></div>`;
  }
  return `<div class="banner grpday" data-grpday="follow"><div><span>👥 <b>Following the group's plan</b> today. It updates when the group's plan changes.</span>
    <p class="small">${grpMeetLine(m, false)}</p>${tour}
    <span class="grpacts"><button class="btn small" data-grp="ownday">Make my own day</button></span></div></div>`;
}
// The Day plan's "More" menu: the trip owner marks a day as a tour the group booked.
function grpMenuHTML(d) {
  if (!grp || grp.role !== "lead" || trip.id !== grp.tripId || !d || noShore(d) || !/^(land|port)$/.test(d.type)) return "";
  return `<button class="menuitem" role="menuitem" data-grp="tourday">🎟 ${d.grpTour ? "Not a booked tour: plan this day" : "Booked tour with the group this day"}</button>`;
}
// A member makes a day their own: it starts as a copy of the group's plan, and they change the sights from there.
// The copied sights are the member's own list from then on (Nov 22 gate: an own day still marked as the app's seeding
// had its sights swapped by the planner for others when the owner's day got shorter, before the member ticked anything).
function grpMakeOwn(d) { d.grpOwn = true; if (Array.isArray(d.selected)) d.ownList = true; delete d.grpOrder; save(); grpHello(); }
// A member's day that follows the group: the owner's stops in the owner's order (null on any other day).
function grpFollowOrder(d) { return d && trip && trip.group && !d.grpOwn && !d.grpTour && !(Array.isArray(d.order) && d.order.length > 1) && Array.isArray(d.grpOrder) && d.grpOrder.length ? d.grpOrder.slice() : null; }
function grpFollow(d) {
  const ld = grpLeadDay(d.id); const i = trip.days.indexOf(d); if (i < 0) return;
  if (ld) trip.days[i] = JSON.parse(JSON.stringify(ld)); else { delete d.grpOwn; }
  save(); grpHello();
  const offered = (((grp.offers || {})[d.id]) || []).some(o => o.who === grpWho);
  if (offered) grpCall({ op: "offer", code: grp.code, who: grpWho, dayId: d.id, day: {}, withdraw: true }).catch(() => {});
}
async function grpOffer(d) {
  const me = ((document.getElementById("grp-me") || {}).value || "").trim(); if (me) { grp.me = me.slice(0, 40); grpSave(); }
  try { const r = await grpCall({ op: "offer", code: grp.code, who: grpWho, name: grp.me || "", dayId: d.id, day: grpPlanPart(d) });
    grpNote = r.status === 200 ? "Your day was offered to the group. The trip's owner can use it for everyone." : "Couldn't offer your day just now. Try again in a minute.";
    if (r.status === 200) { grp.offers = grp.offers || {}; grp.offers[d.id] = (grp.offers[d.id] || []).filter(o => o.who !== grpWho).concat([{ who: grpWho }]); grpSave(); }
  } catch (e) { grpNote = "Offering your day needs the internet. Try again when you're online."; }
  render();
}
// The owner uses a member's day for everyone. The group day's facts stay (same meeting point and time); if the plan
// can't end there in time, nothing changes. The previous plan is kept for an undo.
function grpUseOffer(d, who) {
  const o = (((grp.offers || {})[d.id]) || []).find(x => x.who === who); if (!o) return;
  const i = trip.days.indexOf(d), before = JSON.parse(JSON.stringify(d));
  const next = grpWithPlan(d, o.day); delete next.grpUndo; next.grpUndo = grpPlanPart(before); delete next.grpUndo.grpUndo;
  trip.days[i] = next; let ok = true;
  try { const pl = buildPlan(next), m = grpMeet(pl); ok = !!pl && !pl.error && (!m || !m.known || pl.end <= m.time); } catch (e) { ok = false; }
  if (!ok) { trip.days[i] = before; grpNote = "That plan doesn't end at the meeting point in time, so the group's plan stays as it was."; render(); return; }
  save(); grpCall({ op: "offerdone", code: grp.code, token: grp.token, dayId: d.id, who }).catch(() => {});
  grp.offers[d.id] = (grp.offers[d.id] || []).filter(x => x.who !== who); grpSave(); grpNote = ""; render();
}
function grpUndo(d) { if (!d.grpUndo) return; const i = trip.days.indexOf(d); trip.days[i] = grpWithPlan(d, d.grpUndo); delete trip.days[i].grpUndo; save(); render(); }
function grpTourDay(d) {
  // A booked tour: no sights, and no lunch (the tour may include one; Kairoute doesn't know, so it doesn't guess).
  if (d.grpTour) { d.selected = Array.isArray(d.grpTourPicks) ? d.grpTourPicks.slice() : null; if (d.grpTourCleared) d.cleared = true; else delete d.cleared; d.mealPrefs = d.grpTourMeals || null; delete d.grpTour; delete d.grpTourPicks; delete d.grpTourCleared; delete d.grpTourMeals; }
  else { d.grpTourPicks = Array.isArray(d.selected) ? d.selected.slice() : null; d.grpTourCleared = !!d.cleared; d.grpTourMeals = d.mealPrefs ? JSON.parse(JSON.stringify(d.mealPrefs)) : null; d.grpTour = true; d.selected = []; d.cleared = true;
    d.mealPrefs = Object.assign({}, d.mealPrefs || {}, { Lunch: Object.assign({}, (d.mealPrefs || {}).Lunch || {}, { skip: true }) }); }
  save(); render();
}
async function grpInvite() {
  const text = `Join our Kairoute group trip "${grp.tripName || ""}": open ${grpLink()} or type the code ${grpFmt(grp.code)} in Settings > Group trip.`;
  try { if (navigator.share) { await navigator.share({ title: "Kairoute group trip", text }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(text); grpNote = "Invite copied. Paste it into a message or email."; } catch (e) { grpNote = text; }
  render();
}
if (typeof document !== "undefined") {
  // A tick on a day that follows the group's plan makes that day the member's own (the group's plan isn't changed).
  document.addEventListener("change", e => {
    const t = e.target; if (!t || !t.dataset || !t.dataset.site || !grp || grp.role !== "follow" || trip.id !== grp.tripId) return;
    const d = day(); if (d && !d.grpOwn) { d.grpOwn = true; grpNote = ""; setTimeout(grpHello, 50); }
  }, true);
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-grp],[data-act]"); if (!t) return;
    if (t.dataset.act) { // a follower who steps through the tour by themselves stops following until they catch up
      if (grp && grp.role === "follow" && grp.follow && e.isTrusted && /^tour(next|here|part)$/.test(t.dataset.act)) { grp.follow = false; grpSave(); }
      return;
    }
    const a = t.dataset.grp, d = day();
    if (a === "lead") { if (t.dataset.trip && !grpOpenTrip(t.dataset.trip)) return; grpLead(); }
    else if (a === "join") grpJoin((document.getElementById("grp-code") || {}).value);
    else if (a === "end" || a === "leave") grpEnd();
    else if (a === "invite") grpInvite();
    else if (a === "sharegrp") { view = "settings"; setSec = "group"; render(); toTop(); }
    else if (a === "regroupform") { grpRegroupForm = !grpRegroupForm; render(); }
    else if (a === "regroupok") { grp.regroupOk = grp.regroup && grp.regroup.id; grp.regroup = null; grpSave(); render(); }
    else if (a === "catchup") { grp.follow = true; grpLastLive = ""; grpSave(); grpPoll(); }
    else if (a === "opentrip") { grpOpenTrip(grp.tripId); view = "trip"; render(); toTop(); }
    else if (a === "opentour") { grpOpenTrip(grp.tripId); curTour(day()); view = "tour"; save(); render(); toTop(); }
    else if (a === "ownday") { grpMakeOwn(d); view = "sites"; render(); toTop(); }
    else if (a === "follow") { grpFollow(d); render(); }
    else if (a === "offer") grpOffer(d);
    else if (a === "useoffer") grpUseOffer(d, t.dataset.who);
    else if (a === "dropoffer") { grpCall({ op: "offerdone", code: grp.code, token: grp.token, dayId: d.id, who: t.dataset.who }).catch(() => {}); grp.offers[d.id] = (grp.offers[d.id] || []).filter(x => x.who !== t.dataset.who); grpSave(); render(); }
    else if (a === "undoday") grpUndo(d);
    else if (a === "tourday") grpTourDay(d);
  });
  document.addEventListener("submit", e => {
    const f = e.target; if (!f || !f.dataset || !f.dataset.grpForm) return; e.preventDefault();
    grpRegroup((document.getElementById("grp-where") || {}).value, (document.getElementById("grp-when") || {}).value);
  });
  setInterval(() => { if (grp && grp.role === "lead") grpPush(); }, 1500);
  // The owner hears who joined, who plans their own day, and offered days: often while touring, now and then otherwise.
  let grpLeadAsk = 0;
  const grpLeadPoll = window.__kairouteGrpLeadPoll = () => { if (!grp || grp.role !== "lead" || document.visibilityState === "hidden") return; grpLeadAsk = Date.now(); grpCall(null, "?code=" + grp.code + "&since=999999").then(r => { if (!r.j) return; const k = JSON.stringify([r.j.followers, r.j.members, r.j.ownDays, Object.keys(r.j.offers || {}).map(x => x + (r.j.offers[x] || []).map(o => o.who))]); if (k !== grp.leadKey) { grp.leadKey = k; grp.followers = r.j.followers; grp.members = r.j.members; grp.ownDays = r.j.ownDays || {}; grp.offers = r.j.offers || {}; grpSave(); if (view === "tour") renderGuideOnly(); else renderKeep(); } }).catch(() => {}); };
  setInterval(() => { if (grp && grp.role === "lead" && Date.now() - grpLeadAsk > (view === "tour" ? 20000 : 60000)) grpLeadPoll(); }, 5000);
  let grpHelloAt = 0;
  setInterval(() => { if (grp && grp.role === "follow" && document.visibilityState !== "hidden" && Date.now() - grpHelloAt > (view === "tour" ? 45000 : 600000)) { grpHelloAt = Date.now(); grpHello(); } }, 15000);
  // A join link (…#join=K7M4RX) opens the group trip on this phone.
  // (It waits for the helper's address, read when the app starts.)
  const grpJoinLink = n => { const m = /[#&?]join=([A-Za-z0-9-]{6,7})/.exec(location.hash + location.search); if (!m) return; if (!freeAI && n < 30) { setTimeout(() => grpJoinLink(n + 1), 500); return; } try { history.replaceState(null, "", location.pathname); } catch (e) {} const c = m[1].replace(/-/g, "").toUpperCase(); if (grp && grp.code === c) { grpOpenTrip(grp.tripId); view = "trip"; render(); return; } if (grp && grp.role === "lead") { view = "settings"; setSec = "group"; grpNote = "You're already sharing a trip. Stop sharing it first to join another group."; render(); return; } view = "settings"; setSec = "group"; render(); grpJoin(c); };
  setTimeout(() => grpJoinLink(0), 600);
  setTimeout(() => grpSchedule(1500), 2000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && grp && grp.role === "follow") grpSchedule(200); });
}
// Test hooks for the safety net (tools/extras-check.cjs).
if (typeof window !== "undefined") {
  window.__kairouteGroup = { lead: grpLead, join: grpJoin, push: () => { grpLastLive = ""; if (grp) grp.tripAt = 0; return grpPush(); }, poll: grpPoll, regroup: grpRegroup, offlineNote: ms => grpSignalText(ms),
    state: () => grp, meet: i => grpMeet(buildPlan(trip.days[i])), hello: () => grpHello() };
  // For tools/beta2/group-check.cjs: the app's state lives in one closure.
  window.__kairouteGrpT = { get trip() { return trip; }, set trip(v) { trip = v; }, get library() { return library; }, get view() { return view; }, set view(v) { view = v; }, set setSec(v) { setSec = v; },
    buildPlan, render, save, storeInLibrary, allSites, cityFor, noShore, day: () => day() };
  window.__kairouteSetPrefs = patch => { trip.prefs = Object.assign(defaultPrefs(), trip.prefs || {}, patch); save(); render(); return P(); };
  window.__kairouteThemePicks = (key, theme) => { const city = cities[key], keep = trip.prefs.theme; const top = () => city.sites.filter(x => !x.mustSee).map(x => ({ id: x.id, n: interestWords().reduce((a, w) => a + ((x.category + " " + x.summary).toLowerCase().includes(w) ? 1 : 0), 0) })).sort((a, b) => b.n - a.n).slice(0, 3).map(x => x.id).join(",");
    trip.prefs.theme = ""; const without = top(); trip.prefs.theme = theme; const withTheme = top(); trip.prefs.theme = keep; return { without, withTheme }; };
  window.__kairouteSavings = i => { const d = trip.days[i]; return gxSavings(d, buildPlan(d)); };
  window.__kairouteTour = () => trip.tour;
  window.__kairouteTourStep = () => { try { const st = tourSteps(buildPlan(day()))[trip.tour.i]; return st ? { type: st.type, n: st.place && st.place.lookFor ? st.place.lookFor.length : 0, parts: !!(st.place && st.place.parts && partsOn(st.place).length >= 2) } : null; } catch (e) { return null; } };
  window.__kairouteBadges = () => Object.values(trip.badges || {});
  window.__kairouteView = () => view;
}
