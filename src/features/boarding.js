// ---------- Boarding day: getting to the ship (Richard, Nov 14: "Embarkation day needs a plan to get to the ship.
// Find out their boarding time. Reminders, and whatever else you think of.") ----------
// Every cruise trip, not one: the traveler's own boarding time (typed, or read from a photo of the boarding pass and
// confirmed by them, never guessed) sets when the plan gets them to the terminal; the ride there runs through the
// bag pickup with extra time for traffic (dayWindow + alarmState); a checklist of what to have on you; reminders
// the night before and on the morning (in the app, and as calendar alarms that work with the app closed and
// offline); and the morning before it fills only with nearby sights that keep the margin (the day fill).

const BOARD_HM = /^([01]?\d|2[0-3]):([0-5]\d)$/;
// The boarding (check-in) time on the port's clock, or null when the traveler hasn't given one.
function boardAt(d) { return d && d.type === "embark" && BOARD_HM.test(String(d.boardTime || "").trim()) ? shipToPort(d, String(d.boardTime).trim()) : null; }
function boardShip() { return trip && trip.ship && trip.ship.name ? trip.ship.name : ""; }

// The lines under "Boarding at …" on the Day plan's last row.
function boardNotes(d, w) {
  const bt = w.boardAt, aa = d.allAboard, out = [];
  if (bt != null && bt > w.latest) out.push(`Your boarding time is late in the day, so the plan gets you to the terminal by ${fmt(w.latest)}, an hour before all aboard (${aa}).`);
  else if (bt != null) out.push(`Your boarding time is ${fmt(bt)}: the plan gets you to the terminal then. All aboard ${aa}.`);
  else out.push(`All aboard ${aa}: be at the terminal by ${fmt(w.endBy)} at the latest. Your cruise line gives you a boarding time: add it and the plan gets you there for it.`);
  out.push(`${d.noBags ? "" : "Porters take your big bags at the curb (luggage tags on; they reach your cabin by evening). "}Keep your passport, boarding pass, medicines and valuables in your carry-on for check-in and security.`);
  out.push(d.terminal ? `Your terminal: ${d.terminal}. Tell the driver.` : "Big ports have more than one cruise terminal: check yours on your boarding pass and tell the driver.");
  out.push("Book the taxi or transfer the day before, or ask your hotel to call one. Being aboard on time is your responsibility: check your boarding time with your cruise line.");
  return out;
}

// What to have on you. General for every cruise; each line is something cruise lines ask for or advise.
const BOARD_LIST = [
  ["passport", "Passport, valid well after the cruise (many countries ask for 6 months), and any visas"],
  ["pass", "Boarding pass or e-ticket, printed or in the cruise line's app"],
  ["checkin", "Online check-in done, with any health or travel forms the cruise line asked for"],
  ["tags", "Luggage tags on every big bag"],
  ["carry", "A carry-on for the first hours: big bags reach the cabin by evening"],
  ["meds", "Medicines, valuables and chargers in the carry-on, not in the big bags"],
  ["card", "The credit card for your onboard account"],
  ["cash", "Small notes for porter tips"],
  ["offline", "Your trip ready for offline on this device, for days at sea"]
];
const boardDone = d => BOARD_LIST.filter(([k]) => d.boardChecks && d.boardChecks[k]).length;

let boardCalNote = null;
let boardEdit = null; // { id, time, term, msg, busy } while the traveler is entering or confirming
const boardOpenFolds = new Set();

// The boarding card at the top of the boarding day's heads-up. Asks once for the boarding time; afterwards one line.
function boardCard(d, plan) {
  if (!d || d.type !== "embark" || !plan || plan.error) return "";
  const bt = boardAt(d), ed = boardEdit && boardEdit.id === d.id ? boardEdit : null, ship = boardShip();
  const ask = bt == null || ed;
  const top = ask ? `<div class="bc-ask">
      <label class="bc-f"><span>Boarding time</span><input type="time" id="bc-time" value="${esc(ed ? ed.time || "" : d.boardTime || "")}"></label>
      <label class="bc-f bc-term"><span>Terminal <small>(optional)</small></span><input type="text" id="bc-term" maxlength="60" placeholder="From your boarding pass" value="${esc(ed ? ed.term || "" : d.terminal || "")}"></label>
      <button class="btn small" data-act="boardsave">Save</button>
      ${aiReady() && !(ed && ed.busy) ? `<label class="btn ghost small bc-photo">📷 Read my boarding pass<input type="file" accept="image/*" data-board-photo="1" hidden></label>` : ""}
      ${ed && ed.busy ? `<span class="bc-busy" role="status"><span class="spinner"></span> Reading your photo…</span>` : ""}
      ${bt != null ? `<button class="btn ghost small" data-act="boardcancel">Cancel</button>` : ""}
    </div>
    <p class="bc-hint">${ed && ed.msg ? esc(ed.msg) : `On your boarding pass or check-in confirmation (also called arrival or check-in time). Until then the plan gets you there by ${fmt(plan.endBy)}, an hour before all aboard.`}</p>`
    : `<div class="bc-set"><span>🛳 Boarding time <b>${fmt(bt)}</b>${d.terminal ? ` · ${esc(d.terminal)}` : ""}${ship ? ` · ${esc(ship)}` : ""} · all aboard ${esc(d.allAboard)}</span><button class="btn ghost small" data-act="boardchange">Change</button></div>`;
  const n = boardDone(d), all = BOARD_LIST.length;
  const list = `<details class="more bc-list" data-board-fold="list" ${boardOpenFolds.has("list") ? "open" : ""}><summary>What to have on you · <b>${n} of ${all}</b> ready</summary>
    <div class="bc-items">${BOARD_LIST.map(([k, t]) => `<label class="check"><input type="checkbox" data-board-check="${k}" ${d.boardChecks && d.boardChecks[k] ? "checked" : ""}><span>${esc(t)}</span></label>`).join("")}</div></details>`;
  const canNotify = typeof Notification !== "undefined" && Notification.permission === "default";
  return `<div class="card boardcard${ask ? " asking" : ""}" role="group" aria-label="Boarding">
    ${ask ? `<div class="bc-ttl">🛳 <b>When do you board${ship ? " " + esc(ship) : ""}?</b></div>` : ""}${top}
    ${boardCalNote && boardCalNote.id === d.id ? `<p class="bc-hint" role="status">${esc(boardCalNote.text)}</p>` : ""}<div class="bc-row">${list}<div class="bc-acts"><button class="btn ghost small" data-act="boardcal" title="Alarms at 7 PM the evening before, and 1 hour, 15 minutes and 0 minutes before you leave for the ship. They work with the app closed and with no signal.">📅 Add reminders to my calendar</button>${canNotify ? `<button class="btn ghost small" data-act="livealerts">Turn on alerts</button>` : ""}</div></div>
  </div>`;
}

// The day before boarding: a reminder on that day's plan.
function boardEve(d) {
  if (!d || !trip) return "";
  const i = trip.days.indexOf(d), n = trip.days[i + 1];
  if (!n || n.type !== "embark" || !n.date || !d.date || addDays(d.date, 1) !== n.date) return "";
  const bt = boardAt(n), ship = boardShip(), left = BOARD_LIST.length - boardDone(n);
  return `<div class="banner ok boardeve"><span><b>Tomorrow you board${ship ? " " + esc(ship) : ""}</b>${bt != null ? `, boarding time ${fmt(bt)}` : ""}. Tonight: pack a carry-on for the first hours, put the luggage tags on, and check your passport and boarding pass${left ? ` (${left} thing${left > 1 ? "s" : ""} left on your list)` : ""}.</span><button class="btn small" data-board-go="${i + 1}">${bt != null ? "Boarding day" : "Add boarding time"}</button></div>`;
}

// Calendar reminders: a small .ics with alarms, made on the device (no account, no server), so they ring with the
// app closed and with no signal. Times are written in UTC from the port's own time zone.
function boardICS(d) {
  const plan = buildPlan(d); if (!plan || plan.error) return null;
  const st = alarmState(d, plan, { before: true }), z = dayZone(d), off = zoneOffset(z.tz, d.date);
  const utc = (iso, min) => { const t = new Date(iso + "T00:00:00Z").getTime() + (min - off) * 60000; return new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z"); };
  const escI = t => String(t).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
  const fold = l => { const out = []; while (l.length > 74) { out.push(l.slice(0, 74)); l = " " + l.slice(74); } out.push(l); return out.join("\r\n"); };
  const ship = boardShip() || "your ship", bt = boardAt(d), from = st.from && st.from.name || "your hotel", term = d.terminal || (plan.w.tail[plan.w.tail.length - 1] || {}).name || "the cruise terminal";
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z"), eve = addDays(d.date, -1);
  const todo = BOARD_LIST.filter(([k]) => !(d.boardChecks && d.boardChecks[k])).map(([, t]) => "- " + t).join("\n");
  const ev = (uid, day, start, mins, title, desc, alarms) => ["BEGIN:VEVENT", `UID:${uid}-${d.id}@kairoute`, `DTSTAMP:${stamp}`, `DTSTART:${utc(day, start)}`, `DTEND:${utc(day, start + mins)}`,
    `SUMMARY:${escI(title)}`, `DESCRIPTION:${escI(desc)}`, `LOCATION:${escI(term)}`,
    ...alarms.flatMap(a => ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escI(title)}`, `TRIGGER:${a ? "-PT" + a + "M" : "PT0M"}`, "END:VALARM"]), "END:VEVENT"];
  const leave = st.leaveBy, be = st.backBy, how = boardHow(st, term);
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kairoute//Boarding day//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    ...ev("eve", eve, 19 * 60, 15, `Tomorrow: board ${ship}`, `${bt != null ? "Boarding time " + fmt(bt) + ". " : ""}${how} All aboard ${d.allAboard}. Times are ${zoneLabel(d)}.${todo ? "\n\nStill to do:\n" + todo : ""}`, [0]),
    ...ev("go", d.date, leave, Math.max(15, be - leave), `Leave for ${ship}`, `${how} All aboard ${d.allAboard}. Being aboard on time is your responsibility: check your boarding time with your cruise line.`, [60, 15, 0]),
    "END:VCALENDAR"];
  return { text: lines.map(fold).join("\r\n") + "\r\n", leave, be, eve };
}
// The countdown's own leave-by, in words: from where, via the bags, to the terminal.
function boardHow(st, term) {
  const via = st.via, hotel = via && (st.from && hav(st.from, via) < 0.05 ? st.from.name : via.name.replace(/^Collect (your )?bags( at )?/i, "") || "your bags");
  return via && st.from && hav(st.from, via) >= 0.05 ? `Leave ${st.from.name} by ${fmt(st.leaveBy)}, collect your bags at ${hotel} by ${fmt(st.goBy)}, and be at ${term} by ${fmt(st.backBy)}.`
    : `Leave ${st.from && st.from.name || "your hotel"}${via ? " with your bags" : ""} by ${fmt(st.leaveBy)} to be at ${term} by ${fmt(st.backBy)}.`;
}
function boardCalendar(d) {
  const r = boardICS(d); if (!r) return;
  try {
    const blob = new Blob([r.text], { type: "text/calendar" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `boarding-${d.date}.ics`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  } catch (e) {}
  boardCalNote = { id: d.id, text: `Calendar file saved: open it to add alarms on ${fmtDate(r.eve)} at 7 PM, and at ${fmt(r.leave - 60)}, ${fmt(r.leave - 15)} and ${fmt(r.leave)} on boarding day (${zoneLabel(d)}).` }; render();
}

// Reading the boarding pass: only what's printed. The traveler checks it and taps Save; nothing is saved by itself.
async function boardPhoto(d, file) {
  boardEdit = { id: d.id, time: d.boardTime || "", term: d.terminal || "", busy: true }; render();
  try {
    const url = await shrinkImage(file, 1600), blob = await (await fetch(url)).blob();
    const { text } = await sample(`This photo should be a cruise boarding pass, e-ticket or check-in confirmation. Copy only what is printed on it. Reply ONLY with JSON {"boardTime": "HH:MM" or null, "allAboard": "HH:MM" or null, "terminal": string or null, "ship": string or null, "date": "YYYY-MM-DD" or null}. boardTime is the passenger's boarding, check-in or arrival appointment time. Use 24-hour times. Use null for anything not printed; never guess.`, { modelTier: "complex", images: [blob] });
    boardEdit = Object.assign({ id: d.id, busy: false }, boardRead(parseJSON(text) || {}, d));
  } catch (e) { boardEdit = { id: d.id, time: d.boardTime || "", term: d.terminal || "", busy: false, msg: "Couldn't read that photo. Type the time in, or try again with signal." }; }
  render();
}

// What the photo said, for the traveler to check: only printed values; nothing is saved here.
function boardRead(j, d) {
  const hm = v => BOARD_HM.test(String(v || "").trim()) ? String(v).trim().padStart(5, "0") : "", t = hm(j.boardTime), aa = hm(j.allAboard), warn = [];
  if (j.date && d.date && j.date !== d.date) warn.push(`the photo's date is ${j.date}, this day is ${d.date}`);
  if (aa && aa !== String(d.allAboard || "").padStart(5, "0")) warn.push(`it shows all aboard ${aa}, the trip has ${d.allAboard} (change it on the Trip screen if the pass is right)`);
  const term = j.terminal ? String(j.terminal).slice(0, 60) : "";
  return { time: t || d.boardTime || "", term: term || d.terminal || "", found: !!t,
    msg: t ? `Read from your photo: boarding time ${t}${term ? ", " + term : ""}. Check it, then tap Save.${warn.length ? " Note: " + warn.join("; ") + "." : ""}` : "I couldn't find a boarding time on that photo. Type it in, or try a sharper photo of the boarding pass." };
}

// In-app reminders while the app is open: the evening before (from 7 PM) and the morning of (30 minutes before the
// day starts). The leave-by alerts at 30, 15 and 5 minutes come from the countdown. Each fires once per device.
function boardRemind() {
  if (!trip || typeof Notification === "undefined" && typeof navigator === "undefined") return;
  for (const d of trip.days) {
    if (d.type !== "embark" || !d.date) continue;
    const z = dayZone(d), now = zoneNow(z.tz), ship = boardShip() || "your ship", bt = boardAt(d);
    const once = (k, title, body) => { const key = "kairoute.board." + d.id + "." + d.date + "." + k; try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch (e) { return; } liveAlert(title, body, false); };
    if (now.date === addDays(d.date, -1) && now.min >= 19 * 60) once("eve", `Tomorrow: board ${ship}`, `${bt != null ? "Boarding time " + fmt(bt) + ". " : "Add your boarding time in Kairoute. "}Pack a carry-on for the first hours, put the luggage tags on, and check your passport and boarding pass.`);
    else if (now.date === d.date) { const plan = buildPlan(d); if (plan && !plan.error && now.min >= plan.start - 30 && now.min < plan.endBy) { const st = alarmState(d, plan, { before: true }); once("morning", `Boarding day: ${ship}`, boardHow(st, d.terminal || "the terminal")); } }
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-act^='board'],[data-board-go]"); if (!t) return;
    const d = day();
    if (t.dataset.boardGo != null) { e.preventDefault(); e.stopImmediatePropagation(); trip.active = +t.dataset.boardGo; view = "plan"; cdPreview = null; cdWhere = null; save(); renderKeep(); toTop(); return; }
    const a = t.dataset.act; if (!/^board(save|cancel|change|cal)$/.test(a)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (a === "boardcal") { boardCalendar(d); return; }
    if (a === "boardchange") { boardEdit = { id: d.id, time: d.boardTime || "", term: d.terminal || "" }; render(); return; }
    if (a === "boardcancel") { boardEdit = null; render(); return; }
    const tv = (document.getElementById("bc-time") || {}).value || "", term = ((document.getElementById("bc-term") || {}).value || "").trim().slice(0, 60);
    if (!BOARD_HM.test(tv)) { boardEdit = { id: d.id, time: tv, term, msg: "Type your boarding time, for example 12:30." }; render(); return; }
    const was = d.boardTime;
    d.boardTime = tv.padStart(5, "0"); if (term) d.terminal = term; else delete d.terminal;
    // A new boarding time changes how long the morning is: the app's own picks are made again to fit it (never the
    // traveler's own: those stay, and anything that no longer fits is named with a one-tap fix).
    if (was !== d.boardTime && !(d.mine || []).length) { d.selected = null; delete d.autoEmpty; }
    boardEdit = null; edited(); save(); render();
  }, true);
  document.addEventListener("change", e => {
    const t = e.target; if (!t || !t.dataset) return;
    if (t.dataset.boardCheck) { const d = day(); d.boardChecks = d.boardChecks || {}; if (t.checked) d.boardChecks[t.dataset.boardCheck] = 1; else delete d.boardChecks[t.dataset.boardCheck]; save(); render(); return; }
    if (t.dataset.boardPhoto && t.files && t.files[0]) boardPhoto(day(), t.files[0]);
  });
  document.addEventListener("toggle", e => { const el = e.target; if (el && el.dataset && el.dataset.boardFold) { if (el.open) boardOpenFolds.add(el.dataset.boardFold); else boardOpenFolds.delete(el.dataset.boardFold); } }, true);
  setInterval(() => { try { boardRemind(); } catch (e) {} }, 60000);
}
