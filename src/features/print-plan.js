// ---------- Printable trip plan (Print or save as PDF) ----------
// One tap lays the plan out as clean, large-type pages (no app screens around it) and opens the device's print
// dialog, where "Save as PDF" is one of the printers on every tablet, phone and computer. Made on the device from
// the saved plans, so it works with no signal. Whole trip from the Trip page; one day from the Day plan's More menu.
const PRINT_LOGO = '<svg viewBox="0 0 64 64" width="44" height="44" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#123C3A"/><g transform="translate(32,32) scale(0.4629) translate(-52.5,-50.875)"><rect x="14" y="8" width="17" height="84" rx="8.5" fill="#F7F5F0"/><path d="M34,52 L77,88" stroke="#F7F5F0" stroke-width="17" stroke-linecap="round" fill="none"/><circle cx="45.5" cy="41" r="4.2" fill="#F0643A"/><circle cx="52.67" cy="34.83" r="4.2" fill="#F0643A"/><circle cx="59.83" cy="28.67" r="4.2" fill="#F0643A"/><circle cx="67" cy="22.5" r="4.2" fill="#F0643A"/><circle cx="77" cy="15" r="9" fill="none" stroke="#F0643A" stroke-width="5.5"/></g></svg>';
const printDate = (iso, opt) => { if (!iso) return ""; try { return new Date(iso + "T12:00:00").toLocaleDateString("en-US", opt || { weekday: "long", month: "long", day: "numeric", year: "numeric" }); } catch (e) { return iso; } };
// How to get to the next stop, short and plain.
function printLeg(leg, endBy) {
  if (!leg || leg.km < 0.1) return "";
  const k = legKind(leg), o = leg.transit;
  let t = `<b>${esc(leg.how)}</b>, ${dur(leg.min)}${leg.mode === "walk" ? ` (${distTxt(leg.km)})` : ""}`;
  if (o) {
    const parts = [];
    if (o.from) parts.push(`${o.access && o.access.how === "walk" ? "walk" : "taxi"} ${dur((o.access && o.access.min) || 0)} to ${esc(o.from)}`);
    if (o.steps && o.steps.length) parts.push(o.steps.map(esc).join("; then ")); else if (o.to) parts.push(`ride to ${esc(o.to)}`);
    if (knownEvery(o)) parts.push(`runs about every ${dur(o.every)}`);
    if (parts.length) t += `: ${parts.join(", ")}`;
    if (leg.lastMile) t += `. If you miss it, a taxi takes about ${dur(leg.road || leg.min)}`;
  }
  if (leg.slack) t += `. Includes ${dur(leg.slack)} spare`;
  return `<tr class="pleg k-${k}"><td></td><td></td><td>${t}.</td></tr>`;
}
// A stop's ticket note, when it says to book ahead (timed entry, reservations, sells out).
const printBook = s => { const t = String((s && s.tickets) || "").trim(); return t && /book|advance|reserv|timed|sell|online|ahead/i.test(t) ? t.length > 180 ? t.slice(0, 177).replace(/\s+\S*$/, "") + "…" : t : ""; };
function printDay(d, i) {
  const n = trip.days.indexOf(d) + 1, head = `<div class="pdhead"><div class="pdnum">Day ${n}</div><div><h2>${esc(placeLabel(d) || "Day " + n)}</h2><div class="pddate">${esc(printDate(d.date))} · ${esc(typeInfo(d.type).short)}</div></div></div>`;
  if (d.type === "sea") return `<section class="pday sea">${head}<p>A day at sea. Nothing to plan ashore.</p></section>`;
  const city = cityFor(d);
  if (noShore(d)) return `<section class="pday">${head}<p>${esc(dayMeta(d))}.</p></section>`;
  if (!city) return `<section class="pday">${head}<p>The guide for ${esc(d.destination || "this place")} isn't built yet, so there are no stops to print.</p></section>`;
  refillIfNeeded(d, city); if (!d.selected) seedPicks(d, city);
  const plan = buildPlan(d);
  if (!plan || plan.error) return `<section class="pday">${head}<p>${esc((plan && plan.error) || "No plan for this day yet.")}</p></section>`;
  // The day's key times, in the place's own time.
  const keys = [];
  if (d.type === "port") { if (d.portArrive) keys.push(["Ship docks", esc(d.portArrive)]); if (d.allAboard) keys.push(["All aboard", esc(d.allAboard) + (d.shipOff ? " ship time" : "")]); if (d.tender) keys.push(["Tender port", "small boats take you ashore"]); }
  if (d.type === "embark" && d.allAboard) keys.push(["All aboard", esc(d.allAboard)]);
  if (d.type === "arrival" || d.type === "departure") keys.push([`${esc(MODES[d.mode].label)} ${d.type === "arrival" ? "arrives" : "leaves"}`, esc(d.time || "?")]);
  if (fixedTitle(d) && plan.w.tail.length) { try { const st = alarmState(d, plan, { before: true }); if (st && st.leaveBy != null) keys.push(["Leave by", `<b>${fmt(st.leaveBy)}</b>${st.from && st.from.name ? ` from ${esc(st.from.name)}` : ""}`]); keys.push([d.type === "port" ? "Back at the ship by" : "Be there by", fmt(plan.endBy)]); } catch (e) {} }
  else keys.push(["Sightseeing", `${fmt(plan.start)} to ${fmt(plan.endBy)}`]);
  let k = 0;
  const rows = plan.items.map((it, idx) => {
    const len = it.type === "meal" || it.type === "evening" ? (it.meal && it.meal.len) || 0 : it.type === "stop" || it.type === "fixed" ? (it.place && it.place.minutes) || 0 : 0;
    const arr = it.type === "start" ? "" : fmt(it.time), lv = it.type === "end" || it.type === "evening" ? "" : it.type === "start" ? fmt(it.time) : len >= 5 ? fmt(it.time + len) : "";
    const row = (cls, mark, body) => `<tr class="${cls}"><td class="pt">${arr}</td><td class="pt">${lv}</td><td><span class="pmark">${mark}</span>${body}</td></tr>`;
    if (it.type === "travel") return printLeg(it.leg, plan.endBy);
    if (it.type === "start") return row("pstart", "S", `<b>${esc(it.label)}</b>`);
    if (it.type === "end") return row("pend", it.place ? "E" : "✓", `<b>${esc(it.label)}</b>${d.type === "port" && d.allAboard ? `<div class="psub">All aboard ${esc(d.allAboard)}. The plan leaves a safety margin before it.</div>` : ""}`);
    if (it.type === "fixed") return row("pfixed", "H", `<b>${esc(it.place.name)}</b>${it.free ? `<div class="psub">Free time until ${fmt(it.time + it.free)}, then collect your bags.</div>` : ""}`);
    if (it.type === "meal" || it.type === "evening") {
      const r = it.place, lbl = it.meal.label, alts = (r.alts || []).map(a => a.name).filter(Boolean).slice(0, 2);
      const name = it.type === "evening" && !it.booked ? "Suggested dinner" : it.meal.quick && !r.booked ? "Quick " + lbl.toLowerCase() : lbl;
      return row("pmeal", lbl[0], `<b>${esc(name)}: ${esc(r.name)}</b><div class="psub">${[r.booked || it.booked ? "Your reservation" : "", r.cuisine, r.price].filter(Boolean).map(esc).join(" · ")}${alts.length ? `${r.cuisine || r.price ? ". " : ""}Or: ${alts.map(esc).join(", ")}` : ""}</div>`);
    }
    if (it.type === "stop") {
      const s = it.place, bk = printBook(s);
      const tag = s.along ? "On the way: " : s.bonus ? "Optional: " : "";
      const mark = s.along || s.bonus ? "+" : String(++k);
      const sub = [s.along ? "" : dur(s.minutes), s.mustSee ? "Must-see" : "", it.wait && it.opens != null ? `opens ${isFinite(it.opens) ? fmt(it.opens) : esc(it.opens)}` : ""].filter(Boolean).join(" · ");
      return row(s.bonus || s.along ? "pstop popt" : "pstop", mark, `${it.area ? `<div class="psub"><b>${esc(areaHead(it))}</b></div>` : ""}<b>${esc(tag + (s.areaRest ? "The rest of " + s.name : s.name))}</b>${sub ? `<div class="psub">${sub}</div>` : ""}${bk ? `<div class="pbook">Book ahead: ${esc(bk)}${(u => u ? ` Official tickets: ${esc(u)}` : "")(tixPrint(s, d))}${tixDone(d, s) ? " (booked)" : ""}</div>` : ""}`);
    }
    return "";
  }).join("");
  const notes = [plan.dropped.length ? `Didn't fit this day: ${plan.dropped.map(s => esc(s.name)).join(", ")}.` : "", d.estimated ? "Port times are estimated. Check them against your cruise documents." : ""].filter(Boolean);
  return `<section class="pday">${head}
    <div class="pkeys">${keys.map(([a, b]) => `<div><span>${a}</span><strong>${b}</strong></div>`).join("")}</div>
    <p class="pzone">All times are ${esc(zoneLabel(d))}.${d.shipOff && d.allAboard ? ` The ship's clock is ${dur(Math.abs(d.shipOff))} ${d.shipOff > 0 ? "ahead" : "behind"}: all aboard ${esc(d.allAboard)} ship time is ${fmt(toMin(d.allAboard) - d.shipOff)} ${esc(zoneLabel(d))}.` : ""}</p>
    <table class="ptable"><thead><tr><th>Arrive</th><th>Leave</th><th>Stop</th></tr></thead><tbody>${rows}</tbody></table>
    ${notes.map(t => `<p class="pnote">${t}</p>`).join("")}</section>`;
}
function printPlanHTML(days) {
  const dates = trip.days.map(x => x.date).filter(Boolean).sort(), one = days.length === 1;
  const span = one ? "" : dates.length ? `${printDate(dates[0], { month: "long", day: "numeric" })} to ${printDate(dates[dates.length - 1])}` : "";
  return `<header class="phead">${PRINT_LOGO}<div><div class="pbrand">Kairoute</div><h1>${esc(trip.name || tripName(trip))}</h1>${span ? `<div class="pspan">${esc(span)} · ${trip.days.length} days</div>` : ""}</div></header>
    ${days.map(printDay).join("")}
    <footer class="pfoot"><p><b>Your times.</b> All times are local to each place. Kairoute plans every day around getting you back with a safety margin before all aboard, your train or your flight. The cruise line's, airline's and rail company's times are final: always follow them. Opening hours can change, so check timed tickets before you go.</p><p>Made with Kairoute on ${esc(printDate(todayISO()))}.</p></footer>`;
}
// Opens the print dialog with the plan (the whole trip, or one day). Uses the browser's own print: on Android and
// iPad, pick "Save as PDF" as the printer to keep a copy.
function printPlan(dayIdx) {
  const days = dayIdx == null ? trip.days.slice() : [trip.days[dayIdx]].filter(Boolean);
  if (!days.length) return;
  let box = document.getElementById("printView");
  if (!box) { box = document.createElement("div"); box.id = "printView"; document.body.appendChild(box); }
  try { box.innerHTML = printPlanHTML(days); }
  catch (e) { aiError = "The printable plan couldn't be made (" + (e && e.message || e) + "). Use Copy itinerary instead."; render(); return; }
  const was = document.title; document.title = (trip.name || "Kairoute trip") + (days.length === 1 ? " - " + printDate(days[0].date, { month: "short", day: "numeric" }) : ""); // the PDF's file name
  const done = () => { document.title = was; removeEventListener("afterprint", done); };
  addEventListener("afterprint", done);
  if (typeof window.print === "function") { try { window.print(); } catch (e) { done(); exportPDF(); } } else { done(); exportPDF(); }
}
