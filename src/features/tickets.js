// ===================== Book a sight's tickets from the Day plan (Richard, Nov 18) =====================
// "We need to make the book ahead actionable to book that site."
// For every trip, not one site: any stop whose ticket notes say to book ahead (bookAhead in live.js: timed entry,
// sells out, reservation required...) gets one ticket row on the Day plan: a button that opens the place where the
// site's own operator sells its tickets, a "Booked" check the traveler ticks once done, and the fee rule said upfront
// (entrance fees are not included in Kairoute; the site sells the ticket and sets the price).
//
// Where the button goes comes from data, never from a guess, in this order:
//  1. The operator's own ticket store, when the sight's official website (Wikidata "official website", the map's
//     website tag, or the travel guide's listing) is on an operator below. Each store was seen linked from that
//     operator's own website (checked Nov 18 2026). A new operator joins this list only the same way.
//  2. Greek state sites: every archaeological site in Greece, and its state archaeological museums, sell their tickets
//     through Hellenic Heritage, the Ministry of Culture's own store (hh.gr: "the official platform of the Ministry of
//     Culture and ODAP"). The rule reads the sight's country and what it is, so it holds for Knossos, Delphi, Mycenae...
//  3. The sight's official website itself: its Tickets page sells the official tickets.
//  4. Nothing on record: "Find official tickets" opens a web search for the sight's official tickets, and says so,
//     with a warning about resellers and lookalike "official" sites. The app never makes up a ticket address.
// No store here takes a date in its address, so the row names the date to pick there (as the train card does).
// No prices, no partner or affiliate links (zero spend; partner programs wait for Richard's yes). No AI.
// It never changes a plan: the Booked tick lives on the day (synced with the trip) and only redraws the row.

// The operators' own ticket stores, matched by the sight's official website. Host match: the domain or a subdomain.
const TIX_STORES = [
  { hosts: ["hh.gr", "culture.gr", "culture.gov.gr", "tap.gr"], name: "Hellenic Heritage", who: "the Greek Ministry of Culture's ticket store", url: "https://tickets.hh.gr/en", find: true },
  { hosts: ["colosseo.it"], name: "the Colosseum Archaeological Park's ticket office", url: "https://ticketing.colosseo.it/en/" },
  { hosts: ["alhambra-patronato.es"], name: "the Alhambra's official ticket office", url: "https://tickets.alhambra-patronato.es/en/" },
  { hosts: ["sagradafamilia.org"], name: "the Sagrada Família's official ticket page", url: "https://sagradafamilia.org/en/tickets" },
  { hosts: ["uffizi.it"], name: "the Uffizi Galleries' official ticket page", url: "https://www.uffizi.it/en/tickets" }
];
const TIX_GR = TIX_STORES[0];
const tixHost = u => { try { const h = new URL(u).hostname.toLowerCase().replace(/^www\./, ""); return h; } catch (e) { return ""; } };
const tixOnHost = (h, hosts) => !!h && hosts.some(x => h === x || h.endsWith("." + x));
// What the sight is, in words: an archaeological site, or a Greek state archaeological museum.
const TIX_DIG = /ancient|archaeolog|archeolog|ruins?\b|acropol|sanctuary|palace of|amphitheat|ancient theat/i;
const tixGreekState = (s, country) => /^greece$/i.test(String(country || "").trim()) &&
  (TIX_DIG.test(String(s.category || "") + " " + String(s.kind || "")) || /archaeological (?:museum|site)|archeological (?:museum|site)/i.test(String(s.name || "")) || TIX_DIG.test(String(s.name || "")) && !/museum/i.test(String(s.name || "")));

// The ticket link for one sight. Pure: reads only the sight, its country and city. Used by the Day plan, the Guide
// and the printed plan, and meant for the Beta 2 engine's plan data as is.
// Returns { kind: "store" | "official" | "search", url, label, site, find }.
function tixLink(s, country, cityName) {
  if (!s) return null;
  const web = /^https?:\/\//i.test(String(s.web || "")) ? String(s.web) : "", h = tixHost(web);
  const store = h && TIX_STORES.find(x => tixOnHost(h, x.hosts));
  if (store) return { kind: "store", url: store.url, label: "Book tickets", site: store.name, who: store.who || "", find: !!store.find };
  if (tixGreekState(s, country)) return { kind: "store", url: TIX_GR.url, label: "Book tickets", site: TIX_GR.name, who: TIX_GR.who, find: true };
  if (web) return { kind: "official", url: web, label: "Book tickets", site: h, find: false };
  const q = `"${String(s.local && s.local !== s.name ? s.local : s.name).replace(/"/g, "")}"${cityName ? " " + cityName : ""} official tickets`;
  return { kind: "search", url: "https://duckduckgo.com/?q=" + encodeURIComponent(q), label: "Find official tickets", site: "", find: false };
}
const tixFor = (s, d) => { const c = d ? cityFor(d) : null; return tixLink(s, c && c.country, c && c.city); };

// Booked ticks, by sight, on the day itself (so they sync with the trip and print with it).
const tixDone = (d, s) => !!(d && d.tixDone && s && d.tixDone[s.id]);
function tixSet(d, sid, on) {
  if (!d || !sid) return;
  const m = Object.assign({}, d.tixDone || {}); if (on) m[sid] = Date.now(); else delete m[sid];
  if (Object.keys(m).length) d.tixDone = m; else delete d.tixDone;
  save();
}

// The row under a book-ahead stop on the Day plan.
function tixRow(it, d) {
  const s = it.place; if (!bookAhead(s)) return "";
  const L = tixFor(s, d); if (!L) return "";
  const done = tixDone(d, s), when = d && d.date ? `${fmtDow(d.date)} ${fmtDate(d.date)}` : "";
  const note = L.kind === "store" ? `Opens ${esc(L.site)}${L.who ? `, ${esc(L.who)}` : ""}.${L.find ? ` Pick ${esc(s.name)}` : ""}${when ? `${L.find ? ", then" : " Pick"} ${esc(when)}` : ""}${L.find || when ? "." : ""}`
    : L.kind === "official" ? `Opens ${esc(s.name)}'s official website (${esc(L.site)}); use its Tickets page${when ? ` and pick ${esc(when)}` : ""}.`
    : `No official ticket page on record yet, so this searches the web. Buy only on the site's own website: resellers and lookalike "official" sites charge more.`;
  return `<div class="tixrow${done ? " done" : ""}" data-tix="${esc(s.id)}">
    <div class="tixtop">${done ? `<i class="badge tixok">✓ Tickets booked</i>` : `<i class="badge book" title="${esc(String(s.tickets || s.priceNote || "").slice(0, 200))}">Book ahead</i>`}
      <a class="btn tixbook${L.kind === "search" ? " find" : ""}" href="${esc(L.url)}" target="_blank" rel="noopener" data-tixurl="${esc(L.kind)}">${done ? "Ticket site" : L.label} <span aria-hidden="true">↗</span></a>
      <button class="tixdone" data-act="tixdone" data-sid="${esc(s.id)}" aria-pressed="${done}">${done ? "Undo" : "Mark booked"}</button></div>
    ${done ? "" : `<div class="sub tixsmall">${note} Entrance fee not included: you pay the site.</div>`}
  </div>`;
}
function tixAct(act, t) {
  if (act !== "tixdone") return false;
  const d = day(), sid = t.dataset.sid; tixSet(d, sid, !(d.tixDone && d.tixDone[sid]));
  // Only the row is redrawn: a tick never re-plans the day.
  const el = t.closest("[data-tix]"), city = cityFor(d), s = city && allSites(city).find(x => x.id === sid);
  if (el && s) { const w = document.createElement("div"); w.innerHTML = tixRow({ place: s }, d).trim(); if (w.firstElementChild) el.replaceWith(w.firstElementChild); }
  else render();
  return true;
}
// For the day's checks list: what still needs booking.
function tixCheck(d, stops, add) {
  const bk = stops.filter(i => bookAhead(i.place)); if (!bk.length) return;
  const open = bk.filter(i => !tixDone(d, i.place));
  if (open.length) add("warn", `Book ahead (timed tickets can sell out): ${esc(open.map(i => i.place.name).join(", "))}. Entrance fees aren't included in Kairoute.`);
  else add("ok", `Tickets marked booked for ${bk.length === 1 ? esc(bk[0].place.name) : `all ${bk.length} book-ahead stops`}.`);
}
// The printed plan: where to buy, as a short address (no search links on paper).
const tixPrint = (s, d) => { const L = tixFor(s, d); return L && L.kind !== "search" ? L.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : ""; };
if (typeof window !== "undefined") window.__kairouteTix = { link: tixLink, stores: TIX_STORES, forStop: (i, sid) => { const d = trip.days[i], c = d && cityFor(d), s = c && allSites(c).find(x => x.id === sid); return s ? Object.assign({ book: bookAhead(s), done: tixDone(d, s) }, tixFor(s, d)) : null; } };
