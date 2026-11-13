
// ======================================================================================================
// Live trip features: things that need an app that runs all day, knows where you are and remembers the trip.
//  1. Opening hours and tickets: each sight's real hours for the plan's date shape the route (arrive after it
//     opens, finish before it closes), closed days move the sight to a day it's open, "book ahead" warnings.
//  2. Weather: the Open-Meteo forecast moves outdoor stops out of rain and midday heat, and offers indoor swaps.
//  3. Crowds: the guide's "best time to go" tips and Kairoute travelers' own reports keep stops out of their rush.
//  4. Running late: on the day itself the plan re-plans from where you are, keeping must-sees and the way back.
//  5. Back-to-the-ship alarm: a live countdown from your GPS position to the ship, station or airport.
//  6. Traveler feedback: star ratings and "how busy was it" for stops, shared by every Kairoute traveler.
//  7. "What am I looking at?": a photo plus GPS, matched only against real places near you.
// Nothing here invents data: a rule that has no source says so and changes nothing.
// ======================================================================================================

// ---------- 1. Opening hours ----------
const OPEN_AIR_RE = /square|plaza|piazza|park|garden|hill|neighbo|street|promenade|old town|quarter|district|beach|viewpoint|harbou?r|waterfront|bridge|canal|walk|market street|boulevard|avenue|fountain|monument|statue/i;
const isOpenAir = s => !!s && OPEN_AIR_RE.test((s.category || "") + " " + (s.name || "")) && !/museum|gallery|palace|castle|church|cathedral|basilica|monastery|tower|house|hall|theat|tomb/i.test((s.category || "") + " " + (s.name || ""));
const DAY_STEMS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const isOsmHours = h => /\b(Mo|Tu|We|Th|Fr|Sa|Su|PH|off)\b|^\d\d:\d\d-\d\d:\d\d(,\d\d:\d\d-\d\d:\d\d)*$|^24\/7$/.test(h);
// "Closed Mondays", "closed Mon and Tue", "Closed Monday–Wednesday", in the closed field or the hours text.
function closedByText(t, iso) {
  t = String(t || "").toLowerCase(); if (!t || !iso || !/closed|shut/.test(t)) return false;
  const dow = new Date(iso + "T12:00:00Z").getUTCDay();
  const seg = t.slice(t.search(/closed|shut/)).split(/[.;(]/)[0];
  if (/except|only|between|holiday|winter|summer|season|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/.test(seg) && !/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/.test(seg)) return false;
  const rng = /\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\s*(?:-|–|—|to|through)\s*(sun|mon|tue|wed|thu|fri|sat)[a-z]*/.exec(seg);
  if (rng) { const a = DAY_STEMS.indexOf(rng[1]), b = DAY_STEMS.indexOf(rng[2]); if (a <= b ? dow >= a && dow <= b : dow >= a || dow <= b) return true; }
  return new RegExp("\\b" + DAY_STEMS[dow] + "[a-z]*\\b").test(seg);
}
// Open and closing times for one date, from OpenStreetMap opening_hours (exact) or the guide's hours text
// ("9:00–18:00", "9am to 5pm"). Returns null when there's nothing clear to go on (and for open-air places),
// so the plan never pretends to know.
function siteWindow(s, iso) {
  if (!s || !iso || isOpenAir(s)) return null;
  const h = String(s.hours || "").trim(); if (!h) return null;
  if (isOsmHours(h)) {
    const spans = []; let cur = null;
    for (let m = 0; m <= 1440; m += 15) {
      const st = m < 1440 ? ohState(h, iso, m) : "closed"; if (st == null) return null;
      if (st === "open" && cur == null) cur = m; if (st !== "open" && cur != null) { spans.push([cur, m]); cur = null; }
    }
    return { spans, src: "OpenStreetMap", text: h };
  }
  if (/24 ?hours|always open|open all day|open 24/i.test(h)) return null;
  const tm = "(\\d{1,2})(?:[:.](\\d{2}))?\\s*(am|pm|a\\.m\\.|p\\.m\\.)?";
  const re = new RegExp(tm + "\\s*(?:–|-|—|to|until)\\s*" + tm, "i");
  // "Tue–Sat 10:00–18:00, Sun 10:00–15:00": use the part for the plan's weekday; if parts name days and none is
  // this weekday, the hours for today aren't known (the closed-day check covers listed closed days).
  const segs = h.split(/[;,]|\band\b/), dayRe = /^\s*(?:daily\s*)?(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?(?:\s*(?:-|–|—|to|through)\s*(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?)?/i;
  const dow = new Date(iso + "T12:00:00Z").getUTCDay(), named = segs.filter(x => dayRe.test(x) && re.test(x));
  let src = h;
  if (named.length) { const hit = named.find(x => { const dm = dayRe.exec(x), a0 = DAY_STEMS.indexOf(dm[1].toLowerCase()), b0 = dm[2] ? DAY_STEMS.indexOf(dm[2].toLowerCase()) : a0; return a0 <= b0 ? dow >= a0 && dow <= b0 : dow >= a0 || dow <= b0; });
    if (!hit) return null; src = hit; }
  const m = re.exec(src); if (!m) return null;
  if (!(m[2] || m[3]) || !(m[5] || m[6])) return null; // "2024-2025" or "Apr–Sep" aren't times
  const toM = (H, M, ap) => { let x = +H % 24; ap = (ap || "").toLowerCase(); if (ap.startsWith("p") && x < 12) x += 12; if (ap.startsWith("a") && x === 12) x = 0; return x * 60 + (+M || 0); };
  let a = toM(m[1], m[2], m[3] || (m[6] && +m[1] > +m[4] ? "am" : "")), b = toM(m[4], m[5], m[6]);
  if (!m[6] && b <= a && b < 12 * 60) b += 12 * 60; // "9–5"
  if (!(b > a) || a < 4 * 60) return null;
  const w = { spans: [[a, b]], src: "guide", text: h };
  const le = /last (?:entry|admission|entrance)[^0-9]{0,14}(\d{1,2})[:.](\d{2})/i.exec(h + " " + (s.tickets || ""));
  const lb = /last (?:entry|admission|entrance)[^.]{0,30}?(\d+)\s*(min|minutes|hour|hours|h)\b[^.]{0,12}before/i.exec(h + " " + (s.tickets || ""));
  if (le) w.last = +le[1] * 60 + +le[2]; else if (lb) w.last = b - +lb[1] * (/^h/i.test(lb[2]) ? 60 : 1);
  return w;
}
// Closed on the plan's date: OpenStreetMap hours with no opening that day, or else the guide's closed days.
function siteClosed(s, iso) {
  if (!s || !iso) return false;
  // OpenStreetMap's opening_hours, when it reads cleanly, is the most exact source and decides; otherwise the
  // closed days written in the guide.
  const w = siteWindow(s, iso); if (w && w.src === "OpenStreetMap") return !w.spans.length;
  return closedOn(s, iso) || closedByText(s.closed, iso) || closedByText(s.hours, iso);
}
// Closed for a day's visit: closed that date, or open only at hours outside the day's time here (a port day's time
// ashore, a hotel day's sightseeing hours), with less than half an hour of overlap. Every way a sight gets onto a
// day checks this, so the app never plans or picks a sight for a day it can't be visited.
function closedForDay(s, d, w) {
  if (!s || !d || !d.date) return false;
  if (siteClosed(s, d.date)) return true;
  const sw = siteWindow(s, d.date); if (!sw || !sw.spans || !sw.spans.length || !w || w.error || !(w.endBy > w.start)) return false;
  const need = Math.min(30, s.minutes || 30);
  return !sw.spans.some(([a, b]) => Math.min(b, w.endBy) - Math.max(a, w.start) >= need);
}
function closedForDayWhy(s, d, w) {
  if (siteClosed(s, d.date)) return closedWhy(s, d.date);
  const sw = siteWindow(s, d.date); return sw && sw.spans.length ? `open only ${sw.spans.map(([a, b]) => fmt(a) + "–" + fmt(b)).join(", ")}, outside your time here` : "";
}
const closedWhy = (s, iso) => { const c = String(s.closed || "").trim(); return c && closedByText(c, iso) || closedOn(s, iso) ? c : `Closed on ${fmtDow(iso)}s (${siteWindow(s, iso) ? "OpenStreetMap hours" : "listed hours"})`; };
// How a visit fits the hours: minutes to wait for opening, and minutes past the latest sensible arrival
// (the listed last entry, or 45 minutes before closing, less for a short visit).
function ohFit(w, t, len) {
  if (!w || !w.spans || !w.spans.length) return { wait: 0, late: 0 };
  for (const [a, b] of w.spans) {
    const dead = w.last != null && w.last <= b ? w.last : b - Math.min(Math.max(15, len || 0), 45);
    if (t <= dead) { const wait = Math.max(0, a - t); return t + wait <= dead ? { wait, late: 0, open: a, close: b } : { wait: 0, late: t + wait - dead, open: a, close: b }; }
  }
  const [a, b] = w.spans[w.spans.length - 1]; return { wait: 0, late: t - (w.last != null ? w.last : b - 30), open: a, close: b };
}
// Timed tickets that sell out: from the guide's ticket notes and the map's fee tag.
const BOOK_RE = /book (?:ahead|in advance|online|early|well)|advance (?:booking|tickets|reservation)|reserv(?:e|ation)s? (?:required|essential|recommended|ahead)|timed[- ](?:entry|ticket|slot)|sells? out|sold out|pre-?book|must be booked|only by reservation|online only|skip[- ]the[- ]line/i;
const bookAhead = s => !!s && BOOK_RE.test(String(s.tickets || "") + " " + String(s.priceNote || ""));

// ---------- 3. Crowds: when each place is busy, from real sources ----------
// The guide's "Crowds" tip ("go early, cruise groups arrive 10-14", "quieter after 4 pm") read into busy hours,
// plus what Kairoute travelers reported ("How busy was it?") once at least 3 have reported for an hour.
function crowdWindows(s, iso) {
  const out = [], t = String((s && s.crowds) || "").toLowerCase();
  if (t) {
    const hm = (H, M, ap) => { let x = +H; if (/p/.test(ap || "") && x < 12) x += 12; if (!ap && x < 7) x += 12; return x * 60 + (+M || 0); };
    const rng = /(?:busiest|crowded|busy|packed|peak|groups?|avoid)[^.]{0,40}?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*(?:-|–|to|and)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/.exec(t);
    if (rng) { const a = hm(rng[1], rng[2], rng[3] || (rng[6] && +rng[1] > +rng[4] ? "am" : "")), b = hm(rng[4], rng[5], rng[6]); if (b > a) out.push([a, b]); }
    else if (/midday|middle of the day|late morning|cruise (?:ship|passenger|group|crowd)|tour (?:bus|group)|mid-?morning/.test(t)) out.push([10 * 60 + 30, 14 * 60]);
    if (!out.length && /\b(go early|come early|arrive early|get there early|early morning|first thing|at opening|right when it opens|opening time|first (?:slot|entry)|before (?:9|10|11)\b)/.test(t)) {
      const b = /before (\d{1,2})(?:[:.](\d{2}))?\s*(am)?/.exec(t); out.push([b ? hm(b[1], b[2], "am") : 10 * 60, 15 * 60]); }
    if (!out.length && /(late afternoon|after (\d{1,2})\s*(pm|:00)?|evening|before closing|last hour|toward closing)/.test(t)) {
      const a = /after (\d{1,2})(?:[:.](\d{2}))?\s*(pm)?/.exec(t); out.push([10 * 60, a ? hm(a[1], a[2], "pm") : 16 * 60]); }
  }
  // A tip about one day ("Sunday at 11:00 is packed", "very busy at weekends") only counts on that day.
  const dayTip = /\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*days?\b|weekend/.exec(t);
  if (dayTip && iso) { const dw = new Date(iso + "T12:00:00Z").getUTCDay(), on = dayTip[0].startsWith("weekend") ? dw === 0 || dw === 6 : DAY_STEMS.indexOf(dayTip[1]) === dw;
    out.length = 0; if (on) { const at = /at (\d{1,2})[:.](\d{2})/.exec(t); out.push(at ? [+at[1] * 60 + +at[2] - 30, +at[1] * 60 + +at[2] + 45] : [10 * 60, 17 * 60]); } }
  const tr = travelerBusy(s);
  return out.length || tr.length ? { busy: out.concat(tr), src: [out.length ? "guide tip" : "", tr.length ? "Kairoute travelers" : ""].filter(Boolean).join(" and ") } : null;
}
let busyCache = {}; // city key -> { place key -> { hour -> [sum, n] } } from the worker
function travelerBusy(s) {
  const c = s && s._city && busyCache[s._city], h = c && c[keyOf(s.name)]; if (!h) return [];
  const out = []; Object.keys(h).forEach(k => { const [sum, n] = h[k]; if (n >= 3 && sum / n >= 2) out.push([+k * 60, +k * 60 + 60]); });
  return out;
}
const overlap = (a, b, c, d) => Math.max(0, Math.min(b, d) - Math.max(a, c));

// ---------- 2. Weather (Open-Meteo, free and keyless, through the worker so a city is fetched once for everyone) ----------
let wxCache = {}, wxAsked = {};
const WX_DAYS = 16;
function wxKey(city) { const p = city && ((city.sites || [])[0] || {}); return isFinite(p.lat) ? (+p.lat).toFixed(1) + "," + (+p.lng).toFixed(1) : null; }
function daysAhead(iso) { const t = todayISO(); return Math.round((new Date(iso + "T12:00:00Z") - new Date(t + "T12:00:00Z")) / 864e5); }
function wxFetch(city) {
  const k = wxKey(city); if (!k || wxAsked[k]) return;
  // The last forecast is used until a newer one arrives (and with no internet), so the plan never changes just because the signal went.
  try { const c = JSON.parse(localStorage.getItem("kairoute.wx." + k) || "null"); if (c && c.days) { wxCache[k] = c; if (Date.now() - c.at < 3 * 3600e3) { wxAsked[k] = 1; return; } } } catch (e) {}
  if (!freeAI || navigator.onLine === false) return; wxAsked[k] = 1;
  const [lat, lng] = k.split(",");
  fetch(`${freeAI.url}/weather?lat=${lat}&lng=${lng}`).then(r => r.ok ? r.json() : null).then(j => {
    if (!j || !j.days) return; j.at = Date.now(); wxCache[k] = j; try { localStorage.setItem("kairoute.wx." + k, JSON.stringify(j)); } catch (e) {}
    if (view === "plan" || view === "tour") render();
  }).catch(() => {});
}
// The forecast for one day, read into plain facts: wet hours (rain 50%+ and at least 0.3 mm), hot hours (33 °C+).
function wxFor(d, city) {
  if (!d || !d.date || noShore(d)) return null; const k = wxKey(city); if (!k) return null;
  const ahead = daysAhead(d.date); if (ahead < 0 || ahead >= WX_DAYS) return null;
  wxFetch(city); const f = wxCache[k], day0 = f && f.days && f.days[d.date]; if (!day0) return null;
  const wet = [], hot = []; let maxP = 0;
  (day0.hours || []).forEach(([hr, temp, prob, mm]) => { if (hr < 7 || hr > 21) return; maxP = Math.max(maxP, prob || 0);
    if ((prob || 0) >= 50 && (mm || 0) >= 0.3) wet.push([hr * 60, hr * 60 + 60]); if ((temp || 0) >= 33) hot.push([hr * 60, hr * 60 + 60]); });
  const merge = l => l.reduce((a, x) => { const t = a[a.length - 1]; if (t && t[1] >= x[0]) t[1] = x[1]; else a.push(x.slice()); return a; }, []);
  return { wet: merge(wet), hot: merge(hot), tmax: day0.tmax, tmin: day0.tmin, prob: day0.prob, mm: day0.mm, code: day0.code, src: "Open-Meteo" };
}
const tempTxt = c => useMiles() ? Math.round(c * 9 / 5 + 32) + "°F" : Math.round(c) + "°C";
const spanTxt = l => l.map(([a, b]) => fmt(a) + "–" + fmt(b)).join(", ");
let planWx = null; // the weather for the day being planned, read by simDay

// What a visit costs beyond its minutes: out in the rain or the midday heat (outdoor places only), or in its rush hour.
function visitPenalty(p, t, len) {
  let c = 0; const end = t + (len || 0);
  if (planWx && !p.indoor && !p.mealOf) { planWx.wet.forEach(([a, b]) => { c += overlap(t, end, a, b) * 2; }); planWx.hot.forEach(([a, b]) => { c += overlap(t, end, a, b) * 1.2; }); }
  if (p.cw) p.cw.busy.forEach(([a, b]) => { c += overlap(t, end, a, b) * 0.35; });
  return c;
}

// Closed today: say why, and move it to a day here when it's open, in one tap.
function closedBanner(d, plan) {
  const l = plan.closedToday || []; if (!l.length) return "";
  return l.map(s => `<div class="banner warn" role="alert"><span><b>${esc(s.name)}</b> is closed on ${esc(fmtDow(d.date))}${s.why ? " (" + esc(s.why.replace(/\.$/, "")) + ")" : ""}, so it's not in today's plan.${s.openOn ? ` It's open on ${esc(fmtDate(s.openOn.date))}, when you're here too.` : " It isn't open on any other day you're here."}</span>${s.openOn ? `<button class="btn small" data-act="closedmove" data-id="${esc(s.id)}" data-to="${trip.days.indexOf(s.openOn)}">Move it to ${esc(fmtDate(s.openOn.date))}</button>` : ""}${(() => { const a = closedAlt(d, s); return a ? `<button class="btn small ghost" data-act="closedswap" data-id="${esc(s.id)}" data-alt="${esc(a.id)}">Swap for ${esc(a.name)} (open today)</button>` : ""; })()}</div>`).join("");
}
// The best sight open today that fits in place of a closed pick: same kind when there is one, famous first, close by.
function closedAlt(d, s) {
  const city = cityFor(d); if (!city || typeof fitsAll !== "function") return null;
  const taken = new Set(trip.days.filter(o => cityFor(o) === city).flatMap(o => o.selected || [])), sel = (d.selected || []).filter(i => i !== s.id);
  let w = null; try { w = dayWindow(d, city); } catch (e) {}
  const c = allSites(city).filter(x => !x.quick && x.id !== s.id && !taken.has(x.id) && religiousOk(x) && !closedForDay(x, d, w));
  const rank = x => (x.kind && x.kind === s.kind ? 2 : 0) + (fameW(x) || 1) - hav(x, s) / 5;
  return c.sort((a, b) => rank(b) - rank(a)).slice(0, 8).find(x => fitsAll(fitTrial(d, [...sel, x.id]))) || null;
}
function swapClosed(id, alt) { const d = day(); d.selected = (d.selected || []).filter(x => x !== id); if (!d.selected.includes(alt)) d.selected = d.selected.concat(alt); d.anchor = alt; save(); render(); }
function moveClosed(id, to) {
  const d = day(), o = trip.days[to]; if (!o) return;
  d.selected = (d.selected || []).filter(x => x !== id);
  if (!o.selected) { const c = cityFor(o); o.selected = c ? defaultSelection(c, trip.style, o) : []; }
  if (!o.selected.includes(id)) o.selected = o.selected.concat(id);
  save(); render();
}

// Under each stop on the Day plan: one compact line with today's hours, a Book ahead tag, the rush hours and the
// traveler rating. A stop you'd reach too late gets its own warning line. Ticket details live in the Guide.
function stopLiveNotes(it, d) {
  const s = it.place, out = [], bits = [];
  if (it.ohLate) out.push(`<div class="sub livewarn">⚠ Closes at ${fmt(it.closes)}${s.oh && s.oh.last != null ? ` (last entry ${fmt(s.oh.last)})` : ""}: you'd get there too late to see it properly. Move it earlier with Change stops, or start the day earlier.</div>`);
  else if (s.oh && s.oh.spans.length) bits.push(`Open ${esc(spanTxt(s.oh.spans))}${s.oh.last != null ? `, last entry ${fmt(s.oh.last)}` : ""}${it.wait ? ` (you start at opening)` : ""} <small>${esc(s.oh.src === "OpenStreetMap" ? "OpenStreetMap" : "guide")}</small>`);
  if (s.cw && s.cw.busy.length) {
    const end = it.time + (s.minutes || 0), hit = s.cw.busy.filter(([a, b]) => overlap(it.time, end, a, b) > 10);
    bits.push(hit.length ? `<span class="livebusy">Usually busy ${esc(spanTxt(hit))}, expect a line</span>` : `Busiest ${esc(spanTxt(s.cw.busy))}, you miss the rush`);
  }
  const r = siteRating(s); if (r) bits.push(`★ ${r.avg.toFixed(1)} from ${r.n} Kairoute travelers`);
  const book = bookAhead(s) ? `<i class="badge book" title="${esc(String(s.tickets || s.priceNote || "").slice(0, 200))}">Book ahead</i>` : "";
  if (book || bits.length) out.push(`<div class="sub liveinfo">${book}${bits.join(" · ")}</div>`);
  out.push(rateRow(it, d));
  return out.join("");
}
function liveChecks(d, plan, add) {
  const st = plan.items.filter(i => i.type === "stop" && !i.place.along);
  const known = st.filter(i => i.place.oh && i.place.oh.spans.length), late = st.filter(i => i.ohLate);
  if (late.length) add("warn", `Would arrive after the last entry: ${esc(late.map(i => i.place.name + " (closes " + fmt(i.closes) + ")").join(", "))}.`);
  else if (known.length) add("ok", `Open when you get there: ${known.length} of ${st.length} stops checked against today's opening hours.`);
  const bk = st.filter(i => bookAhead(i.place)); if (bk.length) add("warn", `Book ahead (timed tickets can sell out): ${esc(bk.map(i => i.place.name).join(", "))}.`);
  const cw = st.filter(i => i.place.cw && i.place.cw.busy.length);
  if (cw.length) { const busy = cw.filter(i => i.place.cw.busy.some(([a, b]) => overlap(i.time, i.time + (i.place.minutes || 0), a, b) > 10));
    add(busy.length ? "warn" : "ok", busy.length ? `In the usual rush at ${esc(busy.map(i => i.place.name).join(", "))}; the plan couldn't fit them at a quieter time.` : `Planned outside the usual rush at all ${cw.length} stops with crowd information.`); }
  const wx = wxFor(d, plan.city);
  if (wx) add(wx.wet.length || wx.hot.length ? "warn" : "ok", `Forecast (Open-Meteo): ${tempTxt(wx.tmax)}, ${wx.prob || 0}% chance of rain${wx.wet.length ? `, wet ${spanTxt(wx.wet)}` : ""}${wx.hot.length ? `, very hot ${spanTxt(wx.hot)}` : ""}.${wx.wet.length || wx.hot.length ? " Outdoor stops are planned around it." : ""}`);
}
// ---------- 6. Traveler feedback, shared by every Kairoute traveler ----------
// Ratings and busy reports come back from the worker with the city's restaurant ratings. A stop with at least
// CROWD_MIN ratings gets a ranking weight: loved places (4.5+) are kept longer and suggested sooner, poorly rated
// ones (under 2.5) are suggested less. The traveler's own picks are never removed because of it.
function markSites(city, j) {
  const k = keyOf(city.city), m = j.ratings || {}; busyCache[k] = j.busy || {};
  allSites(city).forEach(s => { const r = m[keyOf(s.name)]; s.trav = r && r.n >= CROWD_MIN ? r : null; });
  bonusMemo = new Map(); keptMemo = new Map();
}
const siteRating = s => s && s.trav ? s.trav : null;
const travW = s => { const r = siteRating(s); return !r ? 1 : r.avg >= 4.5 ? 1.3 : r.avg >= 4 ? 1.1 : r.avg < 2.5 ? 0.6 : 1; };
function rateSite(s, stars) {
  const d = day(), city = cityFor(d); if (!city || !s) return;
  jUpdate(s.id, j => { j.rating = stars; }); postSiteRating(s, stars);
}
function postSiteRating(s, stars) {
  const city = cityFor(day()); if (!city || !s) return;
  if (freeAI && stars) fetch(`${freeAI.url}/rate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ city: keyOf(city.city), place: keyOf(s.name), stars, dev: devId() }) })
    .then(r => r.ok ? r.json() : null).then(j2 => { if (j2 && j2.ok && j2.n >= CROWD_MIN) { const o = allSites(city).find(x => x.id === s.id); if (o) o.trav = { avg: j2.avg, n: j2.n }; } }).catch(() => {});
}
let busySent = {};
function reportBusy(s, level) {
  const d = day(), city = cityFor(d); if (!city || !s) return; const k = d.id + "|" + s.id; busySent[k] = level;
  try { localStorage.setItem("kairoute.busy." + k, String(level)); } catch (e) {}
  if (freeAI) fetch(`${freeAI.url}/rate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ city: keyOf(city.city), place: keyOf(s.name), busy: level, hour: new Date().getHours(), dev: devId() }) }).catch(() => {});
  render();
}
const busyMine = (d, s) => { const k = d.id + "|" + s.id; if (busySent[k] == null) { try { busySent[k] = +localStorage.getItem("kairoute.busy." + k) || 0; } catch (e) { busySent[k] = 0; } } return busySent[k]; };
// On the Day plan, once a stop's visit time has passed (today, or a past day): rate it, and on the day say how busy it was.
function rateRow(it, d) {
  const s = it.place; if (!d.date || d.date > todayISO(d)) return "";
  const today = isToday(d); if (today && nowMin(d) < it.time + Math.min(20, s.minutes || 0)) return "";
  const mine = ((trip.journal || {})[(cityKeyFor(d) || "x") + "/" + s.id] || {}).rating || 0, b = today ? busyMine(d, s) : 0;
  return `<div class="livecard"><div class="rate"><span class="sub">${mine ? "Your rating" : "Been here? Rate it"}</span>${[1, 2, 3, 4, 5].map(n => `<button class="star ${mine >= n ? "on" : ""}" data-act="raterow" data-sid="${esc(s.id)}" data-n="${n}" aria-label="${n} star${n > 1 ? "s" : ""}">★</button>`).join("")}
    ${today ? `<span class="sub">How busy?</span>${[[1, "Quiet"], [2, "Busy"], [3, "Packed"]].map(([n, l]) => `<button class="busy" data-act="busyrow" data-sid="${esc(s.id)}" data-n="${n}" aria-pressed="${b === n}">${l}</button>`).join("")}` : ""}</div></div>`;
}
function liveAct(act, t) {
  const d = day();
  if (act === "wxswap") { d.rain = t.dataset.why === "heat" ? "heat" : true; d.wxKeep = false; save(); render(); return true; }
  if (act === "wxkeep") { d.wxKeep = true; save(); render(); return true; }
  if (act === "livereplan") { replanNow(d); return true; }
  if (act === "liveundo") { d.live = liveUndo; liveUndo = null; liveMsg = null; liveHold = Date.now() + 30 * 60e3; save(); render(); return true; }
  if (act === "livegps") { geoPerm = "unknown"; liveGeoStart(); render(); return true; }
  if (act === "livealerts") { try { Notification.requestPermission().then(() => render()); } catch (e) {} return true; }
  if (act === "alarmopen") { view = "plan"; render(); toTop(); return true; }
  if (act === "raterow" || act === "busyrow") { const city = cityFor(d), s = city && allSites(city).find(x => x.id === t.dataset.sid); if (!s) return true;
    if (act === "raterow") { rateSite(s, +t.dataset.n); render(); } else reportBusy(s, +t.dataset.n); return true; }
  if (act === "camopen") { const f = document.getElementById("camFile"); if (f) { f.value = ""; f.click(); } return true; }
  if (act === "camclose") { cam = null; camSheet(); return true; }
  if (act === "campick") { const x = cam && cam.cands[+t.dataset.k]; if (x) { cam.pick = x; cam.sure = "chosen"; camSheet(); } return true; }
  if (act === "camplay") { const city = cityFor(d), s = city && allSites(city).find(x => x.id === t.dataset.sid); if (s) speakSite(s); return true; }
  if (act === "wxundo") { d.rain = false; d.wxKeep = true; save(); render(); return true; }
  return false;
}
if (typeof window !== "undefined") window.__kairouteLive = { siteWindow, siteClosed, closedByText, crowdWindows, bookAhead, ohFit, isOpenAir,
  allSites: () => { ensureBuiltins(); const out = []; Object.values(cities).forEach(c => allSites(c).forEach(s => out.push({ city: c.city, name: s.name, hours: s.hours || "", closed: s.closed || "", crowds: s.crowds || "", tickets: s.tickets || "", category: s.category || "", indoor: !!s.indoor }))); return out; } };

// ---------- Weather on the Day plan ----------
// With a forecast (up to 16 days ahead): a small forecast chip, and when rain or strong heat is coming, one tap
// swaps outdoor stops for indoor ones nearby (must-sees stay). Further ahead: the manual "Rainy day" switch.
const WX_ICON = c => c == null ? "" : c >= 95 ? "⛈" : c >= 51 ? "🌧" : c >= 45 ? "🌫" : c >= 3 ? "⛅" : c >= 1 ? "🌤" : "☀";
function weatherTool(d, plan) {
  const wx = wxFor(d, plan.city);
  if (!wx) return `<label class="btn ghost small toggle"><input type="checkbox" id="f-rain" ${d.rain ? "checked" : ""}><span>Rainy day</span></label>`;
  return `<span class="wxchip" title="Forecast from Open-Meteo">${WX_ICON(wx.code)} ${tempTxt(wx.tmax)} · ${wx.prob || 0}% rain</span>`;
}
function weatherBanner(d, plan) {
  const wx = wxFor(d, plan.city), why = wx && wx.wet.length ? "rain" : wx && wx.hot.length ? "heat" : "";
  if (plan.swaps.length) return `<div class="banner"><span>${d.rain === "heat" || why === "heat" && d.rain !== true ? "Because of the heat" : "Because of rain"}: ${plan.swaps.map(([a, b]) => esc(a.name) + " → " + esc(b.name)).join(", ")}.</span>${wx ? `<button class="btn ghost small" data-act="wxundo">Back to my picks</button>` : ""}</div>`;
  if (!wx || !why || d.rain || d.wxKeep) return wx && why && !d.rain ? `<p class="lede small">${why === "rain" ? `Rain likely ${spanTxt(wx.wet)}` : `Very hot ${spanTxt(wx.hot)}`}: outdoor stops are planned outside those hours where they fit.</p>` : "";
  const outdoor = plan.stops.filter(i => !i.place.indoor && !i.place.mustSee && !i.place.along && !i.place.bonus);
  const msg = why === "rain" ? `Rain is likely ${spanTxt(wx.wet)} (${wx.prob}% chance, Open-Meteo).` : `It will be very hot, up to ${tempTxt(wx.tmax)} (${spanTxt(wx.hot)}, Open-Meteo).`;
  return `<div class="banner warn" role="alert"><span>${msg} ${outdoor.length ? `Swap ${outdoor.length} outdoor stop${outdoor.length > 1 ? "s" : ""} for indoor sights nearby? Must-sees stay.` : "Your outdoor stops are moved outside those hours where they fit."}</span>${outdoor.length ? `<button class="btn small" data-act="wxswap" data-why="${why}">Swap to indoor</button><button class="btn ghost small" data-act="wxkeep">Keep my plan</button>` : ""}</div>`;
}

// Styles for the live features, kept with them (squared corners, the app's colors).
if (typeof document !== "undefined") document.head.insertAdjacentHTML("beforeend", `<style id="live-css">
.tl .sub.liveinfo { color: var(--muted); font-size: .86rem; margin-top: 2px; }
.tl .sub.liveinfo small { opacity: .8; }
.tl .sub.livewarn { color: var(--warn); font-weight: 700; font-size: .86rem; margin-top: 2px; }
.badge.book { color: var(--must); background: var(--must-soft); margin-right: 4px; }
.wxchip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border: 1px solid var(--line); border-radius: 6px; font-size: .86rem; font-weight: 700; color: var(--ink); background: var(--card); white-space: nowrap; }
.banner .btn + .btn { margin-left: 6px; }
#alarmBar { position: fixed; left: 0; right: 0; top: 0; z-index: 60; display: flex; align-items: center; gap: 10px; padding: 6px 14px; background: var(--ink); color: var(--paper); font-weight: 700; font-size: .92rem; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
#alarmBar[hidden] { display: none; }
#alarmBar .ab-time { font-family: var(--font-display); font-size: 1.15rem; letter-spacing: .02em; }
#alarmBar .ab-txt { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
#alarmBar.soon { background: var(--meal); } #alarmBar.go { background: var(--warn); }
#alarmBar button { background: transparent; color: inherit; border: 1px solid currentColor; border-radius: 6px; padding: 3px 10px; font: inherit; font-size: .85rem; cursor: pointer; }
html.alarmon body { padding-top: 40px; }
html.alarmon.railnav header.top .tabs { top: 40px; }
.countdown .cdsrc { font-size: .8rem; color: var(--muted); }
.livecard .rate { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 6px 0 2px; }
.livecard .rate .star { font-size: 1.3rem; background: none; border: 0; color: var(--line); cursor: pointer; padding: 0 2px; }
.livecard .rate .star.on { color: #f2b33d; }
.livecard .rate .busy { border: 1px solid var(--line); background: var(--card); color: var(--ink); border-radius: 6px; padding: 3px 9px; font-size: .82rem; cursor: pointer; }
.livecard .rate .busy[aria-pressed="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.livecard .rrow { padding: 8px 0; border-top: 1px solid var(--line); } .livecard .rrow:first-of-type { border-top: 0; }
.donebox { color: var(--muted); font-size: .9rem; }
.camrow { margin: 6px 0 10px; } .camrow .btn { width: 100%; justify-content: center; }
#camSheet { position: fixed; inset: 0; z-index: 80; background: rgba(0,0,0,.45); display: flex; align-items: flex-end; justify-content: center; }
#camSheet .sheet { background: var(--card); color: var(--ink); width: min(640px, 100%); max-height: 88vh; overflow: auto; padding: 18px; border-radius: 10px 10px 0 0; }
#camSheet img.shot { width: 100%; max-height: 240px; object-fit: cover; border-radius: 8px; }
</style>`);

// ---------- 4. Running late: the day re-plans itself from where you are ----------
// d.live = { at, lat, lng, name, gps, finish, done: [sight ids], ate: [meal labels], stamp, preview }.
// The planner starts the day "now" at that spot, leaves out what's done, keeps the return time (ship, train,
// flight, hotel) and, when the rest no longer fits, gives up the lower-priority stops first (must-sees last).
// "Now" on the day's own clock (the device may still be on home time).
const nowMin = d => { if (d) return zoneNow(dayZone(d).tz).min; const n = new Date(); return n.getHours() * 60 + n.getMinutes() + n.getSeconds() / 60; };
function liveNow(d) { return d && isToday(d) ? nowMin(d) : cdPreview; }
function liveOn(d) { return !!(d && d.live && (d.live.preview ? cdPreview != null : d.live.stamp === todayISO(d) && isToday(d))); }
const liveDone = (d, id) => liveOn(d) && (d.live.done || []).includes(id);
const liveAte = (d, label) => liveOn(d) && (d.live.ate || []).includes(label);
function liveWindow(d, w) {
  if (!liveOn(d)) return; const L = d.live;
  const here = { id: "live-here", name: L.name || "Where you are", lat: L.lat, lng: L.lng, minutes: 0 };
  w.start = Math.round(L.at); w.head = L.finish > 0 ? [here, fixedStop(here, "Finish your visit to " + L.name, Math.round(L.finish))] : [here];
  w.startLabel = L.finish > 0 ? "Now" : L.gps && !L.atStop ? "Now: where you are" : "Now: leaving " + L.name; w.notes = [];
}
const geoFresh = () => !!(geoPos && geoPos.at && Date.now() - geoPos.at < 3 * 60e3 && (geoPos.acc || 0) < 150);
let liveMsg = null, liveUndo = null, liveLastAuto = 0, liveHold = 0;
const durOf = i => i.type === "meal" ? i.meal.len : i.place.minutes || 0;
function replanNow(d, o) {
  o = o || {}; const now = liveNow(d); if (now == null) return false;
  const plan = buildPlan(d); if (!plan || plan.error) return false;
  const items = plan.items.filter(i => (i.type === "stop" && !i.place.along) || i.type === "meal");
  let k = -1, from = null, atStop = true;
  const same = (a, b) => a && b && a.type === b.type && a.place.name === b.place.name;
  if (o.at) k = items.findIndex(i => same(i, o.at));
  else if (geoFresh()) { const near = items.find(i => hav(geoPos, i.place) <= 0.15); if (near) k = items.indexOf(near); else { atStop = false; from = { name: "Where you are", lat: geoPos.lat, lng: geoPos.lng }; k = items.filter(i => i.time <= now).length - 1; } }
  else if (cdWhere != null && cdWhere !== "auto") k = +cdWhere;
  else k = items.filter(i => i.time <= now).length - 1;
  const doneItems = items.slice(0, atStop ? k + 1 : Math.max(0, k)), cur = atStop ? items[k] : null;
  if (!from) from = cur ? cur.place : plan.w.head[plan.w.head.length - 1];
  const before = plan.stops.filter(i => !i.place.along && !i.place.bonus && !doneItems.some(x => x.place === i.place)).map(i => i.place);
  liveUndo = d.live ? JSON.parse(JSON.stringify(d.live)) : null;
  const prevDone = liveOn(d) ? d.live.done || [] : [], prevAte = liveOn(d) ? d.live.ate || [] : [];
  d.live = { at: Math.round(now), lat: from.lat, lng: from.lng, name: from.name, gps: !atStop || geoFresh(), atStop: !!cur, finish: Math.max(0, Math.round(o.finish || 0)),
    done: [...new Set(prevDone.concat(doneItems.filter(i => i.type === "stop").map(i => i.place.id)))], ate: [...new Set(prevAte.concat(doneItems.filter(i => i.type === "meal").map(i => i.meal.label)))],
    stamp: todayISO(d), preview: !isToday(d) };
  const after = buildPlan(d); if (!after || after.error) { d.live = liveUndo; return false; }
  const kept = new Set(after.stops.map(i => i.place.id)), lost = before.filter(s => !kept.has(s.id));
  const back = d.type === "port" ? "the ship" : d.type === "departure" ? "your " + MODES[d.mode].label.toLowerCase() : d.type === "embark" ? "boarding" : "the end of your day";
  liveMsg = { at: Math.round(now), auto: !!o.auto, behind: o.behind || 0, lost: lost.map(s => s.name), mustLost: lost.filter(s => s.mustSee).map(s => s.name), over: after.over, back, by: after.endBy };
  save(); render();
  const say = lost.length ? `I've re-planned the rest of your day. To keep you on time for ${back}, I've left out ${lost.map(s => s.name).join(" and ")}.` : "I've re-planned the rest of your day. Everything still fits.";
  if (!d.live.preview) liveAlert(o.auto ? "You're running late" : "Day re-planned", say, true);
  return true;
}
function liveBanner(d, plan) {
  if (!liveOn(d)) return "";
  const m = liveMsg, L = d.live, names = id => { const s = allSites(plan.city).find(x => x.id === id); return s ? s.name : null; };
  const done = (L.done || []).map(names).filter(Boolean);
  return `<div class="banner ${m && m.lost.length ? "warn" : "ok"}" role="status"><span><b>${m && m.auto ? `You're running about ${dur(Math.round(m.behind))} behind, so I re-planned` : "Re-planned"} at ${fmt(L.at)}</b> from ${esc(L.name)}${L.preview ? " (preview)" : ""}.
    ${m && m.lost.length ? ` Left out to get you to ${esc(m.back)} on time: <b>${m.lost.map(esc).join(", ")}</b>.${m.mustLost.length ? " That includes a must-see: there was no way to fit it." : ""}` : " Everything left still fits."}
    ${done.length ? `<span class="donebox"> Done: ${done.map(esc).join(", ")}.</span>` : ""}</span>
    <button class="btn ghost small" data-act="liveundo">Undo</button></div>`;
}

// ---------- 5. Back to the ship, train or plane: a live countdown from where you are ----------
const FIXED = { port: "Back to the ship", embark: "Getting to the ship", departure: null };
const fixedTitle = d => d.type === "departure" ? `Getting to your ${MODES[d.mode].label.toLowerCase()}` : FIXED[d.type] || "";
const realLegs = {}, legAsked = {};
// Walking or taxi time from here to the departure point: a real street route when the router answers (walk under
// 2.5 km, otherwise drive plus 10 minutes to find a taxi), else the app's usual estimate.
function legTo(from, to) {
  const est = travel(from, to), foot = hav(from, to) < 2.5, k = [from.lat, from.lng, to.lat, to.lng].map(x => (+x).toFixed(3)).join(",") + (foot ? "f" : "c");
  const r = realLegs[k];
  // The more cautious of the street route and the day plan's own time (which uses the train or ferry time the guide
  // gives, plus time for delays on the way back to the ship), so the countdown never promises more time than the plan.
  if (r) { const m = foot ? r.min : r.min + 10; return m >= est.min ? (foot ? { min: m, how: "Walk", src: "street route" } : { min: m, how: "Taxi", src: "street route + 10 min to find a taxi" }) : { min: est.min, how: est.how, transit: est.transit, src: "the day plan's time (more cautious than the street route)" }; }
  if (freeAI && !legAsked[k]) { legAsked[k] = 1;
    fetch(freeAI.url + "/route", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ legs: [{ m: foot ? "foot" : "car", a: [+from.lng, +from.lat], b: [+to.lng, +to.lat] }] }) })
      .then(x => x.ok ? x.json() : null).then(j => { const rt = j && j.routes && j.routes[0]; if (rt && isFinite(rt.min)) { realLegs[k] = rt; alarmTick(); } }).catch(() => {}); }
  return { min: est.min, how: est.how, transit: est.transit, src: "estimate" };
}
let alarmFired = {}, liveArrived = {};
function alarmState(d, plan) {
  const now = liveNow(d), items = plan.items.filter(i => i.type === "stop" || i.type === "meal");
  let from = null, src = "";
  if (geoFresh() && now != null && isToday(d)) { from = { name: "where you are", lat: geoPos.lat, lng: geoPos.lng }; src = "GPS"; }
  else if (cdWhere != null && cdWhere !== "auto" && items[+cdWhere]) { from = items[+cdWhere].place; src = "chosen"; }
  else { const at = now != null ? items.filter(i => i.time <= now).pop() : items[items.length - 1]; from = at ? at.place : plan.w.head[0]; src = "plan"; }
  const point = plan.w.tail[plan.w.tail.length - 1], leg = point ? legTo(from, point) : null;
  // One return time on each screen. Before the day: the time the day plan has you back, so the plan, this card and
  // the leave time all agree. On the day: the latest safe time (the plan's cushion before all aboard), counted down
  // from wherever you really are.
  const backBy = now == null && isFinite(plan.end) && plan.end > plan.w.start ? Math.min(plan.endBy, plan.end) : plan.endBy;
  const st = { now, from, src, point, leg, backBy, latest: plan.endBy, leaveBy: leg ? backBy - leg.min : null };
  st.ride = point ? rideBack(d, plan, st) : null;
  // On the day, leave-by is for the ride you can still catch. Before the day, the plan's own leave time stays, so
  // the countdown and the timeline agree.
  if (st.ride && now != null) st.leaveBy = st.ride.leaveBy;
  return st;
}
// The train or ferry back (to the ship, or to the station or airport on a travel day). From where the traveler is:
// the next departure they can still catch that gets them back in time, the last one that does, and when to leave
// for it. When none is left, the fastest way back by road. Uses the timetable saved with the plan, so it works
// with no signal. Null when the way back isn't a timetabled ride, or the traveler is already past it.
function rideBack(d, plan, st) {
  // The last timetabled train or ferry of the day that ends near the ship (or station): often the ride back itself,
  // sometimes followed by a short walk or a meal near the port.
  const end = plan.items.findIndex(i => i.type === "end"); if (end < 2) return null;
  let ri = -1; for (let k = end - 1; k > 0; k--) { const it = plan.items[k]; if (it.type === "travel" && it.leg.transit && (it.leg.transit.deps || []).length) { ri = k; break; } if (it.type === "travel" && it.leg.mode !== "walk" && it.leg.min > 25) break; }
  if (ri < 1) return null;
  const ti = plan.items[ri], o = ti.leg.transit, at = plan.items[ri - 1], origin = at && at.place, land = plan.items[ri + 1] && plan.items[ri + 1].place;
  if (!origin || !isFinite(origin.lat)) return null;
  // After the ride: the walk from where it arrives to the ship (a meal there can be skipped in a pinch).
  const after = land && isFinite(land.lat) && hav(land, st.point) > 0.05 ? legTo(land, st.point).min : 0;
  const here = st.from, toPoint = hav(here, st.point), toOrigin = hav(here, origin), span = hav(origin, st.point);
  if (toPoint < 2 || toOrigin > toPoint) return null; // already near the ship, or closer to it than to the ride
  const slack = ti.leg.slack || 0, safe = safeDeps(o, st.backBy - after, slack);
  // Getting from here to where the planned ride starts (nothing when you're there already).
  const extra = toOrigin <= 0.3 ? 0 : legTo(here, origin).min;
  // GPS between the ride's start and the ship, away from the start: you're on your way back.
  if (st.src === "GPS" && toOrigin > 1.5 && toOrigin + toPoint <= span * 1.25) return null;
  const leaveFor = x => x.t - x.lead - extra, now = st.now;
  const kind = o.kind || "Train", word = kind.toLowerCase(), where = o.from || "the " + (o.mode === "ferry" ? "pier" : "station");
  const planned = o.deps.find(x => x.t - x.lead >= ti.time) || null;
  const next = now == null ? (planned && safe.includes(planned) ? planned : safe[safe.length - 1]) : safe.find(x => leaveFor(x) >= now);
  const last = safe[safe.length - 1] || null;
  // By road from here, with the same cushion the plan gives a long ride back.
  const km = toPoint, base = roadGuess(km).min, taxiMin = base + (base >= 30 ? Math.max(15, Math.round(base * 0.3 / 5) * 5) : 0);
  const sym = (plan.city && plan.city.basics && plan.city.basics.symbol) || "", fare = /^[€£$]$/.test(sym) ? [Math.round((5 + km * 1.3 * 1.6) / 5) * 5, Math.round((8 + km * 1.3 * 2.6) / 5) * 5] : null;
  // Missed: the planned departure (or, failing that, a safe one in the last half hour) has gone while you're still here.
  const gone = now == null ? null : planned && safe.includes(planned) && leaveFor(planned) < now ? planned : safe.filter(x => leaveFor(x) < now && leaveFor(x) >= now - 30).pop() || null;
  const r = { kind, word, where, to: o.to || "", next, last, planned: gone || planned, extra, taxiMin, fare, sym, origin: origin.name, missed: !!gone };
  r.leaveBy = next ? leaveFor(next) : st.backBy - taxiMin;
  r.lastLeave = last ? leaveFor(last) : null;
  r.none = !next;
  return r;
}
function alarmCard(d, plan) {
  if (noShore(d)) return "";
  const fixed = !!fixedTitle(d) && plan.w.tail.length, live = liveNow(d) != null, items = plan.items.filter(i => i.type === "stop" || i.type === "meal");
  if (!fixed && !live) return "";
  const today = isToday(d), gpsOn = geoFresh();
  // On the day, the countdown follows the device's GPS by itself: no button to press, no place to pick.
  if (today && (fixed || live)) setTimeout(liveGeoAuto, 0);
  // A compact countdown in the Day plan's top row, always on screen; tap it for the details.
  const title = fixed ? fixedTitle(d) : "Your day, live";
  return `<details class="moremenu planmore cdchip livecard" id="cdCard"><summary aria-label="${esc(title)}: details">
      <span class="cdico" aria-hidden="true">${fixed ? (d.type === "departure" ? ({ flight: "✈️", train: "🚆", ferry: "⛴️", ship: "🚢", car: "🚌" }[d.mode] || "🧭") : "🚢"): "📍"}</span><span class="cdwords"><span class="cdlbl" id="cdLbl">${fixed ? (today ? "Leave in" : "Leave by") : "Live"}</span><span class="cdto">${fixed ? esc(d.type === "port" ? "back to ship" : d.type === "embark" ? "to the ship" : "to your " + MODES[d.mode].label.toLowerCase()) : "re-plan"}</span></span><b class="cdbig" id="cdBig">${fixed ? "--:--" : (today ? "On" : "Preview")}</b>
    </summary><div class="menupanel cdpanel" role="dialog" aria-label="${esc(title)}">
    <div><span class="eyebrow">${esc(title)}${!today && live ? " · preview" : ""}</span></div>
    ${fixed ? `<div class="cdsub" id="cdSub"></div><div class="cdsrc" id="cdSrc"></div>
    <div class="banner" id="cdMsg" hidden></div>
    ${d.type === "port" ? `<p class="cdagent" id="cdAgent" ${d.portAgent ? "" : "hidden"}>${d.portAgent ? `Can't make all aboard? Call the port agent: <a href="tel:${esc(String(d.portAgent).replace(/[^\d+]/g, ""))}">${esc(d.portAgent)}</a>` : ""}</p>
    <details class="cdwhere"><summary>${d.portAgent ? "Port agent's phone" : "Add the port agent's phone"}</summary><div class="field"><label for="cdAgentIn">Port agent's phone (it's in your cruise documents for each port)</label><input id="cdAgentIn" type="tel" inputmode="tel" value="${esc(d.portAgent || "")}" placeholder="+39 081 ..."></div></details>` : ""}
      ${gpsOn ? "" : `<details class="cdwhere" ${cdWhere && cdWhere !== "auto" ? "open" : ""}><summary>${today ? "GPS off? Pick your spot" : "Count from another spot"}</summary><div class="field"><label for="cdWhere">Where are you?</label>
      <select id="cdWhere"><option value="auto">Wherever the plan says</option>${items.map((i, k) => `<option value="${k}" ${String(cdWhere) === String(k) ? "selected" : ""}>${esc(i.place.name)}</option>`).join("")}</select></div></details>`}` : ""}
    <div class="actions">
      ${today && !gpsOn && geoPerm === "denied" ? `<button class="btn ghost small" data-act="livegps">Try my location again</button>` : ""}
      ${live ? `<button class="btn small" data-act="livereplan">Running late? Re-plan from now</button>` : ""}
      ${today && typeof Notification !== "undefined" && Notification.permission === "default" ? `<button class="btn ghost small" data-act="livealerts">Turn on alerts</button>` : ""}
      ${!today && cdPreview != null ? `<button class="btn ghost small" data-act="cdpreview">Stop preview</button>` : ""}
      ${today && (d.type === "port" || d.type === "embark") ? `<button class="btn ghost small" data-act="shipcheck">${d.shipChecked ? "Check the ship's clock again" : "Check the ship's clock"}</button>` : ""}
    </div>
    ${zoneNote(d)}
    ${today ? `<p class="lede small">${fixed ? "Alerts 30, 15 and 5 minutes before you need to leave, by sound, vibration and notification. " : ""}${gpsOn ? "Using your GPS. If you fall behind at a stop, the day re-plans itself." : geoPerm === "denied" || !navigator.geolocation ? "Location is off for Kairoute, so this counts from where the plan has you. Turn location on in your browser or phone settings for a live count from where you really are." : "Finding your location…"}</p>` : ""}
  </div></details>`;
}
function alarmTick() {
  const d = day(), bar = alarmBarEl();
  const city = d && cityFor(d), plan = city && !noShore(d) ? buildPlan(d) : null;
  if (!plan || plan.error) { if (bar) bar.hidden = true; document.documentElement.classList.remove("alarmon"); return; }
  const fixed = !!fixedTitle(d) && plan.w.tail.length, st = fixed ? alarmState(d, plan) : null, live = isToday(d) || cdPreview != null;
  // Running late, noticed by GPS: still at a stop well past the time the plan leaves it, or nowhere near the
  // stop the plan expected 20 minutes ago. At most once every 10 minutes, and never right after an Undo.
  if (isToday(d) && geoFresh() && Date.now() - liveLastAuto > 10 * 60e3 && Date.now() > liveHold) {
    const now = nowMin(d), items = plan.items.filter(i => (i.type === "stop" && !i.place.along) || i.type === "meal");
    const near = items.find(i => hav(geoPos, i.place) <= 0.12);
    if (near) { const k = d.id + "|" + near.place.name; if (!liveArrived[k]) liveArrived[k] = now;
      // You'll leave here when your visit is done (or now, if you've stayed past it): compare that with the plan.
      const leave = Math.max(now, liveArrived[k] + durOf(near)), behind = leave - (near.time + durOf(near));
      if (behind > 15 && !(liveOn(d) && d.live.atStop && d.live.name === near.place.name)) { liveLastAuto = Date.now(); replanNow(d, { auto: true, at: near, behind, finish: Math.max(5, leave - now) }); return; } }
    else { const due = items.filter(i => i.time + 20 < now && !(d.live && (d.live.done || []).includes(i.place.id))).pop();
      if (due && !(liveOn(d) && d.live.at > due.time)) { liveLastAuto = Date.now(); replanNow(d, { auto: true, behind: now - due.time }); return; } }
  }
  if (fixed) {
    const el = document.getElementById("cdBig"), sub = document.getElementById("cdSub"), msg = document.getElementById("cdMsg"), srcEl = document.getElementById("cdSrc");
    const fromTxt = st.src === "GPS" ? "where you are" : st.from.name, legTxt = `${st.leg.transit ? st.leg.how : st.leg.how.toLowerCase()} ${dur(st.leg.min)}`;
    const word = d.type === "port" ? (st.now == null ? `Back at the ship at ${fmt(st.backBy)}, ${dur(shipToPort(d, d.allAboard) - st.backBy)} before all aboard (${d.allAboard}).` : `Be back at the ship by ${fmt(st.backBy)} at the latest, ${dur(shipToPort(d, d.allAboard) - st.backBy)} before all aboard (${d.allAboard}).`) : d.type === "embark" ? `All aboard ${d.allAboard}. Be at the terminal by ${fmt(st.backBy)}.` : `${MODES[d.mode].label} at ${d.time}. Be at ${st.point.name} by ${fmt(st.backBy)}.`;
    const R = st.ride, dest = d.type === "departure" ? st.point.name : "the ship";
    const rideTxt = !R ? "" : R.none ? `No ${R.word} from ${R.where} gets you to ${dest} in time any more. Take a taxi now: about ${dur(R.taxiMin)} by road${R.fare ? `, roughly ${R.sym}${R.fare[0]}–${R.fare[1]} (agree the fare first)` : ""}.`
      : `${R.missed ? `You've missed the ${fmt(R.planned.t)} ${R.word}. ` : ""}${R.kind} ${R.to ? "to " + R.to + " " : ""}leaves ${R.where} at ${fmt(R.next.t)}: leave ${R.extra ? fromTxt : "for the " + (R.word === "ferry" ? "pier" : "station")} by ${fmt(R.leaveBy)}.${R.last && R.last !== R.next ? ` Last safe ${R.word}: ${fmt(R.last.t)}.` : ` This is the last ${R.word} that gets you back in time.`} If you miss it, a taxi takes about ${dur(R.taxiMin)}.`;
    if (sub) sub.textContent = R && st.now != null ? `${word} ${rideTxt}` : `${word} From ${fromTxt}: ${legTxt}, so leave by ${fmt(st.leaveBy)}.${R ? " " + rideTxt : ""}`;
    const agent = document.getElementById("cdAgent"); if (agent) agent.hidden = !(R && (R.none || R.missed) && d.portAgent);
    if (srcEl) srcEl.textContent = `Travel time: ${st.leg.src}${st.src === "GPS" ? ", from your GPS position" : st.src === "plan" ? ", from where the plan has you now" : ""}.`;
    if (srcEl && (d.type === "port" || d.type === "embark")) srcEl.textContent += " Being on board on time is your responsibility: confirm the all-aboard time with your cruise line on the day. Ships don't wait.";
    const chip = document.getElementById("cdCard"), lbl = document.getElementById("cdLbl");
    if (st.now == null) { if (lbl) lbl.textContent = "Leave by"; if (chip) chip.classList.remove("amber", "soon", "go"); if (el) el.textContent = fmt(st.leaveBy); if (msg) msg.hidden = true; if (srcEl) srcEl.textContent += ` On ${fmtDate(d.date)} it counts down live from your GPS position, with alerts.`; }
    else {
      const left = st.leaveBy - st.now;
      const big = left > 0 ? (left >= 60 ? Math.floor(left / 60) + "h " + String(Math.floor(left % 60)).padStart(2, "0") + "m" : Math.ceil(left) + " min") : "Go now";
      if (el) el.textContent = big;
      const level = left <= 0 ? "go" : left <= 15 || (R && R.none) ? "soon" : "";
      if (lbl) lbl.textContent = left > 0 ? "Leave in" : "Leave";
      const to = chip && chip.querySelector(".cdto"); if (to && R) to.textContent = R.none ? "taxi back now" : `for the ${fmt(R.next.t)} ${R.word}`;
      if (chip) { chip.classList.toggle("amber", left > 15 && left <= 30); chip.classList.toggle("soon", level === "soon"); chip.classList.toggle("go", level === "go"); }
      let text = left <= 0 ? `Head back now: you're ${dur(Math.ceil(-left))} past your leave-by time.` : left <= 30 ? `Start heading back in ${Math.ceil(left)} minutes.` : `You have time. Leave ${fromTxt} by ${fmt(st.leaveBy)}.`;
      if (R && R.none) text = `Missed the last safe ${R.word}. Take a taxi to ${dest} now (about ${dur(R.taxiMin)}).${d.portAgent && d.type === "port" ? " If you can't make all aboard, call the port agent: " + d.portAgent + "." : ""}`;
      else if (R && left > 0) text = (R.missed ? `Missed the ${fmt(R.planned.t)} ${R.word}: the next safe one is ${fmt(R.next.t)}. ` : "") + (R.next === R.last && left <= 30 ? `Last safe ${R.word} back: leave in ${Math.ceil(left)} minutes.` : left <= 30 ? `Leave in ${Math.ceil(left)} minutes for the ${fmt(R.next.t)} ${R.word}.` : `You have time. Leave by ${fmt(st.leaveBy)} for the ${fmt(R.next.t)} ${R.word}.`);
      if (msg) { msg.hidden = false; msg.className = "banner" + (level ? " warn" : ""); msg.textContent = text; }
      // Alerts at 30, 15 and 5 minutes before leaving, and at leave-by, each once (real days only).
      if (isToday(d)) for (const th of [30, 15, 5, 0]) { const k = d.id + "|" + th; if (left <= th && left > th - 10 && !alarmFired[k]) { alarmFired[k] = 1;
        liveAlert(fixedTitle(d), th ? `Leave in ${th} minutes to be at ${d.type === "departure" ? st.point.name : "the ship"} by ${fmt(st.backBy)} (${legTxt} from ${fromTxt}).` : `Time to go. Leave now to be at ${d.type === "departure" ? st.point.name : "the ship"} by ${fmt(st.backBy)}.`, th <= 15); } }
      if (isToday(d) && R) {
        const once = (k, title, body) => { k = d.id + "|" + k; if (!alarmFired[k]) { alarmFired[k] = 1; liveAlert(title, body, true); } };
        if (R.none) once("taxi", "Take a taxi now", text);
        else if (R.missed) once("missed|" + R.next.t, `Missed the ${R.word}`, `The ${fmt(R.planned.t)} ${R.word} has gone. Next safe one: ${fmt(R.next.t)} from ${R.where}. Leave by ${fmt(R.leaveBy)}.`);
        // Warn early: about 30 minutes before you must leave for the last safe departure.
        if (!R.none && R.lastLeave != null && R.lastLeave - st.now <= 30 && R.lastLeave - st.now > 0) once("lastsafe", `Last safe ${R.word} soon`, `The last ${R.word} that gets you to ${dest} in time leaves ${R.where} at ${fmt(R.last.t)}. Leave by ${fmt(R.lastLeave)}.`);
      }
      if (bar) { bar.className = level; bar.innerHTML = `<span class="ab-time">${esc(big)}</span><span class="ab-txt">${esc(fixedTitle(d))}: leave by ${fmt(st.leaveBy)} · ${esc(legTxt)}</span><button data-act="alarmopen">Open</button>`; }
    }
  }
  const show = !!(bar && fixed && live && st && st.now != null && view !== "plan" && !FULL_VIEWS[view]);
  if (bar) bar.hidden = !show; document.documentElement.classList.toggle("alarmon", show);
}
function alarmBarEl() {
  if (typeof document === "undefined") return null; let b = document.getElementById("alarmBar");
  if (!b) { b = document.createElement("div"); b.id = "alarmBar"; b.hidden = true; b.setAttribute("role", "timer"); document.body.appendChild(b); }
  return b;
}
// One alert, every way the device allows: voice, vibration, and a notification (shown even when the screen is off).
let liveAlertLog = [];
function liveAlert(title, body, loud) {
  liveAlertLog.push({ t: title, b: body }); if (liveAlertLog.length > 50) liveAlertLog.shift();
  try { if (navigator.vibrate) navigator.vibrate(loud ? [400, 200, 400, 200, 400] : [300]); } catch (e) {}
  try { if (tts && P().voice !== "off") tts.speak(body, { voice: P().voice }).catch(() => {}); } catch (e) {}
  try { if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    const opt = { body, icon: "icons/web-192.png", tag: "kairoute-live", renotify: true, requireInteraction: !!loud };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(r => r.showNotification(title, opt)).catch(() => { try { new Notification(title, opt); } catch (e) {} });
    else new Notification(title, opt); } } catch (e) {}
}
// Location for the live day (shares the tour's position when the tour is following you).
let liveGeo = null, liveGeoPoll = null, geoPerm = "unknown";
// Start following the device's position without being asked, unless the person has said no to location.
function liveGeoAuto() {
  if (liveGeo != null || !navigator.geolocation || geoPerm === "denied") return;
  const was = geoPerm;
  if (navigator.permissions && navigator.permissions.query) navigator.permissions.query({ name: "geolocation" }).then(p => {
    geoPerm = p.state; if (p.state !== "denied") liveGeoStart(); else if (was !== "denied") render();
    p.onchange = () => { geoPerm = p.state; if (p.state !== "denied") liveGeoStart(); render(); };
  }).catch(() => liveGeoStart());
  else liveGeoStart();
}
function liveGeoStart() {
  if (liveGeo != null || !navigator.geolocation) return;
  try { liveGeo = navigator.geolocation.watchPosition(pos => { const first = !geoFresh(); if (geoWatch == null) geoPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, at: Date.now() }; geoPerm = "granted"; if (first && view === "plan") render(); else alarmTick(); },
    err => { if (err && err.code === 1) { geoPerm = "denied"; try { navigator.geolocation.clearWatch(liveGeo); } catch (e) {} liveGeo = null; clearInterval(liveGeoPoll); render(); } }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 });
    // Standing still, some phones stop reporting: ask once a minute so the countdown always uses a fresh position.
    liveGeoPoll = setInterval(() => { if (liveGeo != null && geoWatch == null) navigator.geolocation.getCurrentPosition(pos => { geoPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, at: Date.now() }; }, () => {}, { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 }); }, 60000);
  } catch (e) { liveGeo = null; }
}
if (typeof window !== "undefined") setInterval(() => { try { alarmTick(); } catch (e) { console.warn("live", e); } }, 20000);
if (typeof window !== "undefined") window.__kairouteLiveProbe = () => { const d = day(), plan = buildPlan(d); const it = plan.items.filter(i => i.type === "stop" && !i.place.along);
  const f = it[0]; return { first: { name: f.place.name, lat: f.place.lat, lng: f.place.lng }, planned: fmt(f.time), lateAt: fmt(Math.round(f.time + f.place.minutes + 40)), endBy: fmt(plan.endBy), live: d.live || null }; };

// ---------- 7. "What am I looking at?" ----------
// Take a photo; with your GPS position the app lists the real places around you (the guide's stops within
// 700 m, then OpenStreetMap's named sights within 300 m) and the AI only picks which of those the photo shows.
let cam = null; // { img, busy, msg, cands, pick, sure, seen }
const camBtnHTML = () => `<button class="btn ghost small" data-act="camopen" aria-label="What am I looking at? Take a photo">📷 What's this?</button>`;
function camButton() {
  if (typeof document === "undefined" || document.getElementById("camFile")) return;
  document.body.insertAdjacentHTML("beforeend", `<input type="file" id="camFile" accept="image/*" capture="environment" hidden>`);
}
function camPosition() {
  if (geoFresh()) return Promise.resolve(geoPos);
  return new Promise(res => { if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(p => { geoPos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, at: Date.now() }; res(geoPos); }, () => res(null), { enableHighAccuracy: true, maximumAge: 20000, timeout: 9000 }); });
}
async function camLookup(file) {
  const d = day(), city = cityFor(d); if (!city || !file) return;
  cam = { busy: true, msg: "Finding where you are…" }; camSheet();
  try { cam.img = await shrinkImage(file, 640); } catch (e) { cam = { msg: "I couldn't read that photo. Try again." }; camSheet(); return; }
  camSheet();
  const pos = await camPosition(), plan = buildPlan(d), todays = plan && !plan.error ? plan.stops.map(i => i.place) : [];
  let cands = [];
  if (pos) {
    cands = allSites(city).filter(s => isFinite(s.lat)).map(s => ({ name: s.name, kind: s.category || "", m: Math.round(hav(pos, s) * 1000), site: s })).filter(c => c.m <= 700).sort((a, b) => a.m - b.m).slice(0, 12);
    cam.msg = "Looking at what's around you…"; camSheet();
    if (freeAI) try { const r = await fetch(`${freeAI.url}/nearsights?lat=${pos.lat.toFixed(4)}&lng=${pos.lng.toFixed(4)}&r=300`); const j = r.ok ? await r.json() : null;
      ((j && j.sights) || []).forEach(x => { if (cands.length >= 20 || cands.some(c => nameMatch(c.name, x.name) || nameMatch(x.name, c.name))) return; const m = Math.round(hav(pos, x) * 1000); if (m <= 400) cands.push({ name: x.name, kind: String(x.kind || "").replace(/_/g, " "), m, osm: x }); }); } catch (e) {}
    cands.sort((a, b) => a.m - b.m);
  } else cands = todays.filter(s => !s.fixed).map(s => ({ name: s.name, kind: s.category || "", m: 0, site: allSites(city).find(x => x.id === s.id) || s }));
  cam.cands = cands; cam.noGps = !pos;
  if (!cands.length) { cam.busy = false; cam.msg = pos ? "I don't know any sights within a few hundred meters of you, so I can't say what this is." : "I need your location to see what's around you. Turn on location and try again."; camSheet(); return; }
  if (!freeAI) { cam.busy = false; cam.msg = "Photo look-up needs the internet. Here's what's nearest to you:"; camSheet(); return; }
  cam.msg = "Matching your photo…"; camSheet();
  try {
    const r = await fetch(`${freeAI.url}/identify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: cam.img, lat: pos && pos.lat, lng: pos && pos.lng, cands: cands.map(c => ({ name: c.name, kind: c.kind, m: c.m })), dev: devId() }) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) { cam.msg = (j && j.error) || "The photo service is busy. Here's what's nearest to you:"; }
    else { cam.pick = j.n ? cands[j.n - 1] : null; cam.sure = j.sure; cam.seen = j.seen; cam.msg = ""; }
  } catch (e) { cam.msg = "No connection right now. Here's what's nearest to you:"; }
  cam.busy = false; camSheet();
  if (cam.pick && cam.pick.site && cam.sure !== "low") speakSite(cam.pick.site);
}
function camSheet() {
  let el = document.getElementById("camSheet"); if (!cam) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = "camSheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "What am I looking at?"); document.body.appendChild(el); }
  const c = cam, p = c.pick, s = p && p.site, near = (c.cands || []).slice(0, 4);
  const siteBox = x => `<p class="lede">${esc(unitText(x.summary || ""))}</p>${x.lookFor && x.lookFor.length ? `<span class="eyebrow">What to look for</span><ol class="lookfor">${x.lookFor.slice(0, 4).map(t => `<li><span>${esc(t)}</span></li>`).join("")}</ol>` : ""}
    <div class="actions"><button class="btn" data-act="camplay" data-sid="${esc(x.id)}">▶ Play the story</button></div>`;
  el.innerHTML = `<div class="sheet"><div class="actions" style="justify-content:space-between;align-items:center"><span class="eyebrow">What am I looking at?</span><button class="btn ghost small" data-act="camclose">Close</button></div>
    ${c.img ? `<img class="shot" src="${c.img}" alt="Your photo">` : ""}
    ${c.busy ? `<p class="banner" role="status"><span class="spinner"></span> ${esc(c.msg || "")}</p>` : ""}
    ${!c.busy && p ? `<h3>${c.sure === "low" ? "Maybe: " : ""}${esc(p.name)}</h3><p class="sub">${[p.kind, p.m ? p.m + " m from you" : "", c.sure === "high" ? "Confident match" : c.sure === "medium" ? "Likely match" : c.sure === "chosen" ? "You picked it" : "Not sure: check the sign"].filter(Boolean).map(esc).join(" · ")}</p>
      ${s ? siteBox(s) : `<p class="lede">${esc((p.osm && p.osm.desc) || "A named place on OpenStreetMap. It isn't one of the guide's stops yet.")}</p><div class="actions"><a class="btn ghost small" target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(p.name + " " + cityFor(day()).city)}">Read about it</a></div>`}` : ""}
    ${!c.busy && !p ? `<p class="lede">${esc(c.msg || (c.cands && c.cands.length ? "I couldn't match your photo to one of the places around you." : ""))}</p>` : ""}
    ${!c.busy && near.length && (!p || c.sure === "low") ? `<span class="eyebrow">${c.noGps ? "Today's stops" : "Nearest known places"}</span><div class="bookres">${near.filter(x => x !== p).map(x => `<button class="btn ghost" data-act="campick" data-k="${c.cands.indexOf(x)}"><b>${esc(x.name)}</b><small>${[x.kind, x.m ? x.m + " m" : ""].filter(Boolean).map(esc).join(" · ")}</small></button>`).join("")}</div>` : ""}
    <p class="ai-note">Matched only against real places near you (the guide and OpenStreetMap). Nothing is made up.</p></div>`;
}
if (typeof document !== "undefined") document.addEventListener("change", e => { if (e.target && e.target.id === "camFile" && e.target.files && e.target.files[0]) camLookup(e.target.files[0]); });
function liveAfterRender() { try { camButton(); alarmTick(); shipMount(); } catch (e) { console.warn("live", e); } }
// Test hooks for the safety net (tools/live-check.cjs): point the app at a stand-in server, load a forecast,
// read what each day's plan did with hours, weather and crowds, and count the alerts raised.
if (typeof window !== "undefined") window.__kairouteLiveTest = {
  setAI: u => { freeAI = u ? { url: u } : null; wxAsked = {}; },
  setWx: (city, days) => { const c = cities[city] || Object.values(cities).find(x => keyOf(x.city) === city); const k = wxKey(c); wxCache[k] = { at: Date.now(), days }; wxAsked[k] = 1; },
  clearWx: () => { wxCache = {}; },
  alerts: () => liveAlertLog.slice(),
  marks: (city, j) => { const c = Object.values(cities).find(x => keyOf(x.city) === city); markSites(c, j); return allSites(c).filter(s => s.trav).map(s => ({ id: s.id, w: travW(s), fame: fameW(s) })); },
  plan: i => { const d = trip.days[i], p = buildPlan(d); if (!p || p.error) return null;
    return { endBy: p.endBy, end: p.end, over: p.over, live: !!liveOn(d), closed: (p.closedToday || []).map(s => ({ id: s.id, openOn: s.openOn ? trip.days.indexOf(s.openOn) : -1 })), swaps: p.swaps.map(([a, b]) => [a.id, b.id, !!b.indoor]),
      stops: p.items.filter(x => x.type === "stop" && !x.place.along).map(x => ({ id: x.place.id, name: x.place.name, t: x.time, len: x.place.minutes || 0, indoor: !!x.place.indoor, must: !!x.place.mustSee, oh: x.place.oh ? { spans: x.place.oh.spans, last: x.place.oh.last } : null, late: x.ohLate || 0, busy: x.place.cw ? x.place.cw.busy : [], bonus: !!x.place.bonus })), wx: planWx || wxFor(d, p.city) }; },
  replan: (i, o) => { trip.active = i; return replanNow(trip.days[i], o || {}); },
  render: () => render(),
  wxFor: i => { const d = trip.days[i]; return wxFor(d, cityFor(d)); },
  alarm: i => { const d = trip.days[i], p = buildPlan(d), st = alarmState(d, p); return { now: st.now, leaveBy: st.leaveBy, backBy: st.backBy, live: liveOn(d), src: st.src, from: st.from.name, alerts: liveAlertLog.length }; },
  siteIdByName: (i, re) => { const s = allSites(cityFor(trip.days[i])).find(x => new RegExp(re).test(x.name)); return s ? s.id : null; },
  bookCount: i => { const p = buildPlan(trip.days[i]); return p && !p.error ? p.items.filter(x => x.type === "stop" && !x.place.along && !x.place.bonus && bookAhead(x.place)).length : 0; },
  // The ride back: where the plan's last leg starts and ends, a timetable to put on it, and the countdown's view of it.
  lastLeg: i => { const p = buildPlan(trip.days[i]), e = p.items.findIndex(x => x.type === "end"); let k = e - 1; while (k > 0 && !(p.items[k].type === "travel" && hav(p.items[k - 1].place, p.items[k + 1].place) >= 4)) k--;
    const o = p.items[k - 1].place, b = p.items[k + 1].place; return { from: { name: o.name, lat: o.lat, lng: o.lng }, to: { name: b.name, lat: b.lat, lng: b.lng }, key: pairKey(o, b) + "|" + dayKind(new Date(trip.days[i].date + "T12:00:00Z").getUTCDay()), leg: p.items[k].leg.how, endBy: p.endBy, legAt: p.items[k].time }; },
  addTransit: (k, opts) => { transitMem[k] = { opts, t: Date.now() }; },
  ride: i => { const d = trip.days[i], p = buildPlan(d), st = alarmState(d, p), r = st.ride; return { leaveBy: st.leaveBy, src: st.src, ride: r && { next: r.next && r.next.t, last: r.last && r.last.t, planned: r.planned && r.planned.t, missed: r.missed, none: r.none, extra: r.extra, taxiMin: r.taxiMin, fare: r.fare } }; },
  siteLL: i => { const p = buildPlan(trip.days[i]), s = p.items.find(x => x.type === "stop" && !x.place.along).place; return { name: s.name, lat: s.lat, lng: s.lng }; }
};
