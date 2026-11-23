// ===================== Book the train (or ferry) between cities (Richard, Nov 17) =====================
// "We are traveling from Barcelona to Madrid by train, can the app give you the ability to book it."
// For every trip, not one route: a leaving day by train or ferry whose next day is the arrival in another city by the
// same way (the same date, or the next day for a night train or ferry) is a leg between cities. Its Day plan ends
// at the station with a card that shows:
//  - the real departures that day, from the operators' published timetables (the helper's /departures, Transitous),
//    nearest the traveler's own time, each with its arrival and ride time; nothing is ever made up. When the date's
//    timetable isn't published yet, the usual times for that kind of day are shown and said to be that.
//  - a quiet check: the traveler's time isn't among the trains found that day ("check the time on your ticket").
//  - a "Book train" button that opens a trusted booking site on that route, and says which date to choose there.
//    Prices aren't shown in the app: the rail or ferry company sets them and the booking page shows the real fare.
// Booking site: Trainline (Europe's biggest rail booking site, all the main operators: Renfe, iryo, Ouigo,
// Trenitalia, Italo, SNCF, DB, UK rail...; partner program for referral commission). Its route pages take the two
// towns; the date is picked on the page, so the card names it. The helper checks the route page exists (/bookcheck);
// where Trainline has no page (Greece, the US) and for ferries, Rome2Rio opens instead: it compares every way between
// any two places and links to the company selling each ticket. A broken link is never offered.
// In-app checkout (pick the train and pay without leaving Kairoute) needs a partner booking API (Trainline Partner
// Solutions or Omio), a signed agreement, payment handling and ticket delivery: after the demo (see docs/booking.md).
// It never changes a plan: it only reads the trip and the kept timetable answers.

// Partner tracking goes here once the partner accounts exist (each network wraps the page address in its own link).
const BOOK_WRAP = u => u;
const bookSlug = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s*\(.*?\)\s*/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
// Countries Trainline sells trains in, used only while the helper hasn't said whether the route page exists.
const BOOK_TL = new Set(["spain", "france", "italy", "germany", "united kingdom", "uk", "england", "scotland", "wales", "portugal", "austria", "switzerland", "belgium", "netherlands", "czechia", "czech republic", "luxembourg"]);
const bookChk = new Map(), bookChkBusy = new Set();
function bookSite(leg) {
  const k = bookSlug(leg.fromTown) + ":" + bookSlug(leg.toTown);
  let st = bookChk.get(k);
  if (st == null) { try { st = (JSON.parse(localStorage.getItem("kairoute.bookchk1") || "{}") || {})[k]; } catch (e) {} if (st) bookChk.set(k, st); }
  if (leg.mode === "train" && st == null && !bookChkBusy.has(k) && typeof freeAI !== "undefined" && freeAI && (typeof navigator === "undefined" || navigator.onLine !== false)) {
    bookChkBusy.add(k);
    fetch(`${freeAI.url}/bookcheck?from=${bookSlug(leg.fromTown)}&to=${bookSlug(leg.toTown)}`).then(r => r.ok ? r.json() : null).then(j => {
      const v = j && j.trainline; if (v === "ok" || v === "missing") { bookChk.set(k, v); try { const m = JSON.parse(localStorage.getItem("kairoute.bookchk1") || "{}") || {}; m[k] = v; localStorage.setItem("kairoute.bookchk1", JSON.stringify(m)); } catch (e) {} bookRepaint(); }
    }).catch(() => {}).finally(() => setTimeout(() => bookChkBusy.delete(k), 120000));
  }
  const inTL = c => BOOK_TL.has(String((c && c.country) || "").toLowerCase());
  const tl = leg.mode === "train" && (st === "ok" || (st !== "missing" && inTL(leg.cityA) && inTL(leg.cityB)));
  if (tl) return { name: "Trainline", url: BOOK_WRAP(`https://www.thetrainline.com/en/train-times/${bookSlug(leg.fromTown)}-to-${bookSlug(leg.toTown)}`), pick: true };
  const r2r = s => encodeURIComponent(String(s).replace(/\s+/g, "-"));
  return { name: "Rome2Rio", url: BOOK_WRAP(`https://www.rome2rio.com/map/${r2r(leg.fromTown)}/${r2r(leg.toTown)}`), pick: false };
}
const bookUrl = leg => bookSite(leg).url;

// The leg between cities that leaves on day d, or null.
function bookLeg(d) {
  if (!d || d.type !== "departure" || (d.mode !== "train" && d.mode !== "ferry")) return null;
  const i = trip.days.indexOf(d); if (i < 0) return null;
  const a = trip.days[i + 1];
  if (!a || a.type !== "arrival" || a.mode !== d.mode) return null;
  if (d.date && a.date) { const gap = (Date.parse(a.date + "T12:00:00Z") - Date.parse(d.date + "T12:00:00Z")) / 864e5; if (!(gap >= 0 && gap <= 1)) return null; }
  const fromTown = mainPlace(d), toTown = mainPlace(a);
  if (!fromTown || !toTown || bookSlug(fromTown) === bookSlug(toTown)) return null;
  const cA = cityFor(d), cB = cityFor(a), P = cA ? dayPoint(d, cA) : null, Q = cB ? dayPoint(a, cB) : null;
  return { mode: d.mode, word: d.mode === "ferry" ? "ferry" : "train", date: d.date || "", time: d.time || "", arrTime: a.time || "", fromTown, toTown, from: P, to: Q, cityA: cA, cityB: cB };
}

// Departures on the leg's date, from the helper's /departures (the operators' published timetables). Kept on the
// device, so the card still shows them with no signal. null while being looked up; { failed } when the helper
// couldn't answer (asked again after 2 minutes).
const DEP_KEY = "kairoute.depart1", depBusy = new Set(), depFail = new Map();
const depMem = (() => { try { return JSON.parse(localStorage.getItem(DEP_KEY) || "{}") || {}; } catch (e) { return {}; } })();
const depKeep = () => { try { const ks = Object.keys(depMem).sort((x, y) => depMem[y].t - depMem[x].t); const o = {}; ks.slice(0, 40).forEach(k => o[k] = depMem[k]); localStorage.setItem(DEP_KEY, JSON.stringify(o)); } catch (e) {} };
const depKeyOf = leg => [leg.mode, (+leg.from.lat).toFixed(3), (+leg.from.lng).toFixed(3), (+leg.to.lat).toFixed(3), (+leg.to.lng).toFixed(3), leg.date].join(",");
function bookTimes(leg) {
  if (!leg.from || !leg.to) return { list: [], none: true };
  const k = depKeyOf(leg), got = depMem[k], online = typeof navigator === "undefined" || navigator.onLine !== false;
  const stale = !got || (got.deps.length ? Date.now() - got.t > 3 * 864e5 : Date.now() - got.t > 6 * 3600e3);
  if (stale && online && typeof freeAI !== "undefined" && freeAI && !depBusy.has(k) && !(depFail.get(k) > Date.now() - 120000)) {
    depBusy.add(k);
    fetch(`${freeAI.url}/departures?a=${leg.from.lat},${leg.from.lng}&b=${leg.to.lat},${leg.to.lng}&date=${leg.date}&mode=${leg.mode}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error("departures " + r.status)))
      .then(j => { if (!Array.isArray(j.deps)) throw new Error("bad answer"); depMem[k] = { deps: j.deps, forDate: !!j.forDate, date: j.date || "", t: Date.now() }; depFail.delete(k); depKeep(); })
      .catch(() => depFail.set(k, Date.now()))
      .finally(() => { depBusy.delete(k); bookRepaint(); });
  }
  // No timetable service in this copy of the app (it runs without one): nothing is being looked up, so the card never
  // says it is (Nov 22 first-timer check: "Looking up the trains that day…" stayed on screen for good).
  if (!got && !(typeof freeAI !== "undefined" && freeAI)) return { noService: true };
  if (!got) return depBusy.has(k) || !online ? null : depFail.has(k) ? { failed: true } : null;
  return { list: got.deps.slice(), forDate: got.forDate, none: got.deps.length < 3, thin: got.deps.length > 0 && got.deps.length < 3 };
}

// An answer arriving redraws only the card (never the page), so it can't re-plan anything.
function bookRepaint() {
  if (typeof document === "undefined" || typeof view === "undefined" || view !== "plan") return;
  const el = document.querySelector("#view [data-bookride]"), d = trip.days[trip.active]; if (!el || !d) return;
  const html = bookRideCard(d); if (!html) return;
  const t = document.createElement("div"); t.innerHTML = html.trim(); const n = t.firstElementChild; if (n && n.outerHTML !== el.outerHTML) el.replaceWith(n);
}
const BOOK_ICO = { train: "🚆", ferry: "⛴" };
function bookRideCard(d) {
  const leg = bookLeg(d); if (!leg) return "";
  const W = leg.word, Wc = W[0].toUpperCase() + W.slice(1), mine = leg.time ? toMin(leg.time) : null;
  const when = leg.date ? `${fmtDow(leg.date)} ${fmtDate(leg.date)}` : "";
  const tt = bookTimes(leg), site = bookSite(leg);
  let times = "";
  if (!tt) times = `<div class="sub brnote">${navigator.onLine === false ? `${Wc} times show once you're online.` : `Looking up the ${W}s that day…`}</div>`;
  else if (tt.noService) times = `<div class="sub brnote">Kairoute doesn't show ${W} times. The booking page lists every ${W}.</div>`;
  else if (tt.failed) times = `<div class="sub brnote">${Wc} times couldn't be loaded just now. The booking page lists every ${W}.</div>`;
  else if (tt.none) times = `<div class="sub brnote">${tt.thin ? `Only part of this day's timetable is published so far.` : `No published timetable for this route yet.`} The booking page lists every ${W}.</div>`;
  else {
    // The five departures nearest the traveler's time (or the first five of the day), in time order.
    const near = (mine == null ? tt.list.slice(0, 5) : tt.list.slice().sort((p, q) => Math.abs(p.t - mine) - Math.abs(q.t - mine)).slice(0, 5)).sort((p, q) => p.t - q.t);
    const hit = mine != null && tt.list.find(r => Math.abs(r.t - mine) <= 5);
    const inRange = mine != null && tt.list.length >= 3 && mine >= tt.list[0].t && mine <= tt.list[tt.list.length - 1].t;
    times = `<div class="brlbl">${tt.forDate ? `${Wc}s on ${esc(when)}` : `Usual ${esc(leg.date ? fmtDowLong(leg.date) : "")} ${W}s`.replace(/\s+/g, " ")}</div>
      <ul class="brtimes">${near.map(r => `<li class="${hit && r.t === hit.t ? "mine" : ""}"><b>${fmt(r.t)}</b><span class="brarr">→ ${fmt(r.arr != null ? r.arr : (r.t + r.min) % 1440)}</span><span class="brdur">${dur(r.min)}${r.changes ? ` · ${r.changes} change${r.changes > 1 ? "s" : ""}` : ""}</span>${hit && r.t === hit.t ? `<em>Your train</em>` : ""}</li>`).join("")}</ul>
      <div class="sub brsrc">From the ${leg.mode === "ferry" ? "ferry" : "rail"} companies' published timetables${tt.forDate ? "" : `. The ${esc(when)} timetable isn't out yet, so these are the usual ${esc(fmtDowLong(leg.date))} times; check them when you book`}.</div>
      ${mine != null && !hit && inRange && tt.forDate ? `<div class="banner warn">We don't see a ${esc(fmt(mine))} ${W} in the published timetables. Some companies don't publish theirs, so check the time on your ticket.</div>` : ""}`;
  }
  return `<div class="bookride k-${leg.mode}" data-bookride="1">
    <div class="brhead"><span class="brico" aria-hidden="true">${BOOK_ICO[leg.mode]}</span><div><b>${Wc} to ${esc(leg.toTown)}</b><span>${[when, leg.time ? "planned for " + fmt(mine) : ""].filter(Boolean).map(esc).join(" · ")}</span></div></div>
    ${times}
    <a class="btn brbook" href="${esc(site.url)}" target="_blank" rel="noopener" data-bookurl="1">Book ${W} <span aria-hidden="true">↗</span></a>
    <div class="sub brsmall">${site.pick ? `Opens ${site.name} on ${esc(leg.fromTown)} to ${esc(leg.toTown)}${when ? `. Choose ${esc(when)} there` : ""}.` : `Opens ${site.name}, which shows every way from ${esc(leg.fromTown)} to ${esc(leg.toTown)} and links to the company that sells the ticket${when ? `. Choose ${esc(when)}` : ""}.`} The fare is set by the ${leg.mode === "ferry" ? "ferry" : "rail"} company and shown before you pay.</div>
  </div>`;
}
const fmtDowLong = dateFmt({ weekday: "long" });
if (typeof window !== "undefined") window.__kairouteBook = { leg: i => { const l = bookLeg(trip.days[i]); return l && Object.assign({}, l, { url: bookUrl(l), site: bookSite(l).name, cityA: undefined, cityB: undefined }); }, times: i => { const l = bookLeg(trip.days[i]); return l ? bookTimes(l) : null; }, slug: bookSlug };
