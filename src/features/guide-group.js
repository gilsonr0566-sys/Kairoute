// ===================== Group tours =====================
// One person leads; everyone else follows on their own phone. Followers get the leader's trip once (it then
// works offline), move to the leader's step as the leader moves, hear the same story start when the leader
// plays it, and get a "regroup" call with the meeting spot. With a weak signal, each phone simply carries on
// with the tour by itself and catches up when the signal is back. The group lives on Kairoute's helper for
// two days (see worker/extras.js); journals and notes are never shared.
const GRP_STORE = "kairoute.group";
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
    if (status === 200 && j && j.code) { grp = { code: j.code, role: "lead", token: j.token, tripId: trip.id, at: Date.now() }; grpSave(); grpLastLive = ""; grpLastTrip = JSON.stringify(trip.days); grpNote = ""; return { code: j.code }; }
    grpNote = "The group couldn't start just now. Try again in a minute.";
  } catch (e) { grpNote = "Starting a group needs the internet. Try again when you're online."; }
  finally { grpBusy = false; render(); }
  return null;
}
function grpInstall(j, code) {
  for (const k in j.trip.cities || {}) if (!cities[k] && j.trip.cities[k] && Array.isArray(j.trip.cities[k].sites)) cities[k] = j.trip.cities[k];
  const id = "grp-" + code, t = j.trip.trip; t.id = id; t.name = "Group: " + (j.name || tripName(t)); t.group = code; t.journal = (library.find(x => x.id === id) || { trip: {} }).trip.journal || {};
  if (trip && trip.days && trip.days.length) storeInLibrary();
  const old = library.findIndex(x => x.id === id); if (old >= 0) library.splice(old, 1);
  trip = t; if (!trip.prefs) trip.prefs = defaultPrefs(); save();
}
async function grpJoin(code) {
  code = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 6) { grpNote = "A group code has 6 letters and numbers, like K7M-4RX."; render(); return { ok: false }; }
  grpBusy = true; grpNote = ""; render();
  try {
    const { status, j } = await grpCall(null, "?code=" + code + "&since=0");
    if (status === 200 && j && j.trip) {
      grpInstall(j, code); grp = { code, role: "follow", tripId: trip.id, rev: j.rev, tripRev: j.tripRev, follow: true, lastOk: Date.now(), seenRegroup: j.regroup ? j.regroup.id : "" }; grpSave();
      grpApply(j, true); grpCall({ op: "hello", code, who: grpWho }).catch(() => {}); grpSchedule(1000);
      grpBusy = false; render(); return { ok: true };
    }
    grpNote = status === 404 ? "That group wasn't found. Check the code with your group leader." : "Couldn't reach the group just now. Try again in a minute.";
  } catch (e) { grpNote = "Joining needs the internet. Try again when you're online."; }
  grpBusy = false; render(); return { ok: false };
}
// Follower: go where the leader is, and start the same story when the leader starts it.
function grpApply(j, first) {
  if (!grp || grp.role !== "follow") return;
  if (j.trip) { grpInstall(j, grp.code); grp.tripRev = j.tripRev; }
  grp.rev = j.rev; grp.lastOk = Date.now(); grp.followers = j.followers; grp.name = j.name;
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
    else if (status === 404) { grpNote = "The group tour has ended."; grp = null; grpSave(); render(); }
    else grpFails++;
  } catch (e) { grpFails++; }
}
function grpSchedule(ms) {
  clearTimeout(grpPollTimer); if (!grp || grp.role !== "follow") return;
  grpPollTimer = setTimeout(async () => { if (document.visibilityState !== "hidden") await grpPoll(); grpSchedule(Math.min(20000, 3000 * Math.pow(2, Math.min(grpFails, 3)))); if (view === "tour") { const el = document.getElementById("grpSignal"); if (el) el.innerHTML = grpSignalText(); } }, ms);
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
  if (grp.role === "lead") try { await grpCall({ op: "end", code: grp.code, token: grp.token }); } catch (e) {}
  grp = null; grpSave(); grpNote = ""; render();
}
function grpSignalText(ms) {
  if (!grp || grp.role !== "follow") return "";
  const gap = ms != null ? ms : Date.now() - (grp.lastOk || 0);
  return gap > 15000 ? `📶 No signal from the leader for ${gap < 120000 ? Math.round(gap / 1000) + " seconds" : Math.round(gap / 60000) + " minutes"}. Keep going on your own phone; you'll catch up when the signal's back.` : "";
}
// The bar at the top of the tour.
function groupBar() {
  if (!grp) return "";
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
// Settings > Group tour.
function groupCard() {
  if (!freeAI) return `<div class="card"><h3>Group tour</h3><p class="lede">Group tours need Kairoute's helper, which isn't available in this view.</p></div>`;
  if (grp) return `<div class="card"><h3>Group tour</h3>${grp.role === "lead" ? `<p class="lede">You're leading a group. Others join with this code:</p><p class="synccode">${esc(grpFmt(grp.code))}</p><p class="lede small">Start the tour as usual: everyone who joined moves with you, hears each story when you play it, and gets your regroup calls.</p>` : `<p class="lede">You're following ${esc(grp.name || "a group")}. Open the tour and it moves with your leader.</p>`}
    <div class="actions"><button class="btn" data-grp="opentour">Open the tour</button><button class="btn ghost" data-grp="${grp.role === "lead" ? "end" : "leave"}">${grp.role === "lead" ? "End the group" : "Leave the group"}</button></div>${grpNote ? `<p class="banner" role="status">${esc(grpNote)}</p>` : ""}</div>`;
  return `<div class="card"><h3>Group tour</h3><p class="lede">Touring with family or friends? One person leads; everyone else follows on their own phone, sees the same stop, hears the same story, and gets the leader's "regroup" calls. If the signal drops, each phone keeps touring by itself.</p>
    <div class="actions"><button class="btn" data-grp="lead" ${grpBusy ? "disabled" : ""}>Lead a group with "${esc(trip.name || tripName(trip))}"</button></div>
    <div class="field"><label for="grp-code">Joining someone's group? Type their code</label><div class="ask"><input id="grp-code" type="text" autocapitalize="characters" autocomplete="off" maxlength="7" placeholder="e.g. K7M-4RX"><button class="btn" data-grp="join" ${grpBusy ? "disabled" : ""}>${grpBusy ? "Joining…" : "Join"}</button></div></div>
    ${grpNote ? `<p class="banner" role="status">${esc(grpNote)}</p>` : ""}</div>`;
}
if (typeof document !== "undefined") {
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-grp],[data-act]"); if (!t) return;
    if (t.dataset.act) { // a follower who steps through the tour by themselves stops following until they catch up
      if (grp && grp.role === "follow" && grp.follow && e.isTrusted && /^tour(next|here|part)$/.test(t.dataset.act)) { grp.follow = false; grpSave(); }
      return;
    }
    const a = t.dataset.grp;
    if (a === "lead") grpLead();
    else if (a === "join") grpJoin((document.getElementById("grp-code") || {}).value);
    else if (a === "end" || a === "leave") grpEnd();
    else if (a === "regroupform") { grpRegroupForm = !grpRegroupForm; render(); }
    else if (a === "regroupok") { grp.regroupOk = grp.regroup && grp.regroup.id; grp.regroup = null; grpSave(); render(); }
    else if (a === "catchup") { grp.follow = true; grpLastLive = ""; grpSave(); grpPoll(); }
    else if (a === "opentour") { if (trip.id !== grp.tripId) { const x = library.find(y => y.id === grp.tripId); if (x) { storeInLibrary(); trip = x.trip; } } curTour(day()); view = "tour"; save(); render(); toTop(); }
  });
  document.addEventListener("submit", e => {
    const f = e.target; if (!f || !f.dataset || !f.dataset.grpForm) return; e.preventDefault();
    grpRegroup((document.getElementById("grp-where") || {}).value, (document.getElementById("grp-when") || {}).value);
  });
  setInterval(() => { if (grp && grp.role === "lead") grpPush(); }, 1500);
  setInterval(() => { if (grp && grp.role === "lead" && document.visibilityState !== "hidden") grpCall(null, "?code=" + grp.code + "&since=999999").then(r => { if (r.j && r.j.followers !== grp.followers) { grp.followers = r.j.followers; grpSave(); if (view === "tour") renderGuideOnly(); } }).catch(() => {}); }, 20000);
  setInterval(() => { if (grp && grp.role === "follow" && document.visibilityState !== "hidden") grpCall({ op: "hello", code: grp.code, who: grpWho }).catch(() => {}); }, 45000);
  setTimeout(() => grpSchedule(1500), 2000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && grp && grp.role === "follow") grpSchedule(200); });
}
// Test hooks for the safety net (tools/extras-check.cjs).
if (typeof window !== "undefined") {
  window.__kairouteGroup = { lead: grpLead, join: grpJoin, push: () => { grpLastLive = ""; return grpPush(); }, poll: grpPoll, regroup: grpRegroup, offlineNote: ms => grpSignalText(ms) };
  window.__kairouteSetPrefs = patch => { trip.prefs = Object.assign(defaultPrefs(), trip.prefs || {}, patch); save(); render(); return P(); };
  window.__kairouteThemePicks = (key, theme) => { const city = cities[key], keep = trip.prefs.theme; const top = () => city.sites.filter(x => !x.mustSee).map(x => ({ id: x.id, n: interestWords().reduce((a, w) => a + ((x.category + " " + x.summary).toLowerCase().includes(w) ? 1 : 0), 0) })).sort((a, b) => b.n - a.n).slice(0, 3).map(x => x.id).join(",");
    trip.prefs.theme = ""; const without = top(); trip.prefs.theme = theme; const withTheme = top(); trip.prefs.theme = keep; return { without, withTheme }; };
  window.__kairouteSavings = i => { const d = trip.days[i]; return gxSavings(d, buildPlan(d)); };
  window.__kairouteTour = () => trip.tour;
  window.__kairouteTourStep = () => { try { const st = tourSteps(buildPlan(day()))[trip.tour.i]; return st ? { type: st.type, n: st.place && st.place.lookFor ? st.place.lookFor.length : 0, parts: !!(st.place && st.place.parts && partsOn(st.place).length >= 2) } : null; } catch (e) { return null; } };
  window.__kairouteBadges = () => Object.values(trip.badges || {});
  window.__kairouteView = () => view;
}
