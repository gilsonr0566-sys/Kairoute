// ===================== Partner offer: mobile data for the trip (demo) =====================
// Shows how a partner offer works inside Kairoute, start to finish, without selling anything: before the trip,
// the Trip screen suggests a travel eSIM sized to the trip (its countries, its dates, how many days ashore).
// The traveler picks a plan, sees the checkout, and gets a confirmation that says plainly no purchase was made.
// - Demo only: no partner account, no payment, nothing leaves the device. Every step is labelled "Demo".
// - It never touches planning: it reads the trip, never changes it, and saves its own state under its own key
//   (not in the trip, so plans, sync and offline checks are unaffected).
// - Settings > Display > Partner offers turns it off. It hides itself once the trip has started.
// Plans and prices are sample figures in the range travel eSIMs sell for, worked out from the trip, not quotes.

const ESIM_STORE = "kairoute.esimDemo1";
let esimOpen = null; // the open sheet: { step: "plans" | "checkout" | "done", gb, phones }
const esimMem = () => { try { return JSON.parse(localStorage.getItem(ESIM_STORE) || "{}") || {}; } catch (e) { return {}; } };
const esimKeep = m => { try { localStorage.setItem(ESIM_STORE, JSON.stringify(m)); } catch (e) {} };
const esimOn = () => appSet.partners !== "off";

// Countries where one regional plan works (the common "Europe" eSIM coverage).
const ESIM_EUROPE = new Set(["albania", "austria", "belgium", "bosnia and herzegovina", "bulgaria", "croatia", "cyprus", "czechia", "czech republic", "denmark", "estonia", "finland", "france", "germany", "gibraltar", "greece", "hungary", "iceland", "ireland", "italy", "latvia", "liechtenstein", "lithuania", "luxembourg", "malta", "monaco", "montenegro", "netherlands", "north macedonia", "norway", "poland", "portugal", "romania", "san marino", "serbia", "slovakia", "slovenia", "spain", "sweden", "switzerland", "turkey", "türkiye", "united kingdom", "uk", "england", "scotland", "vatican city"]);
const ESIM_US = new Set(["united states", "usa", "us", "united states of america"]);

// Everything the offer needs, read from the trip: countries ashore, dates, days, where data first switches on.
function esimTrip() {
  const ashore = trip.days.filter(d => !noShore(d) && d.destination);
  const countries = [];
  ashore.forEach(d => { const c = cityFor(d), n = String((c && c.country) || "").trim(); if (n && !countries.some(x => x.toLowerCase() === n.toLowerCase())) countries.push(n); });
  const dates = trip.days.map(d => d.date).filter(Boolean).sort();
  const from = dates[0] || "", to = dates[dates.length - 1] || "";
  const days = from && to ? Math.round((new Date(to + "T12:00") - new Date(from + "T12:00")) / 864e5) + 1 : trip.days.length;
  const low = countries.map(x => x.toLowerCase());
  const region = !low.length ? "your trip" : low.length === 1 ? countries[0] : low.every(x => ESIM_EUROPE.has(x)) ? "Europe" : low.every(x => ESIM_US.has(x)) ? "United States" : "Global";
  const kind = low.length === 1 ? "one" : region === "Europe" ? "eu" : region === "United States" ? "us" : "global";
  const first = ashore[0];
  const seaDays = trip.days.filter(d => d.type === "sea").length;
  return { countries, from, to, days: Math.max(1, days), region, kind, firstPlace: first ? (placeLabel(first) || first.destination) : "", firstDate: first ? first.date : from, seaDays, places: [...new Set(ashore.map(d => d.destination))] };
}
// Three plans sized to the trip: validity covers every day, data from light to heavy use.
// About half a gigabyte a day covers maps, live ride times, messages and photos sent home; stories and maps are
// already saved for offline, so the guide itself needs no data.
function esimPlans(t) {
  const valid = [7, 15, 30].find(v => v >= t.days) || Math.ceil(t.days / 30) * 30;
  const mul = { one: 0.85, eu: 1, us: 1.1, global: 1.7 }[t.kind] || 1;
  const vAdj = { 7: 0.7, 15: 0.85, 30: 1 }[valid] || valid / 30;
  const price = gb => Math.round(({ 5: 14, 10: 22, 20: 34 }[gb]) * mul * vAdj * 2) / 2 - 0.01;
  const need = Math.max(1, t.days - t.seaDays) * 0.5, rec = [5, 10, 20].find(g => g >= need) || 20;
  return [5, 10, 20].map(gb => ({ gb, valid, price: price(gb), rec: gb === rec,
    use: gb === 5 ? "Maps, messages and ride times" : gb === 10 ? "Plus photos and video calls home" : "Heavy use or sharing with a laptop" }));
}
const ESIM_ICO = `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="2" y="12" width="3" height="6" rx="1" fill="currentColor"/><rect x="7" y="9" width="3" height="9" rx="1" fill="currentColor"/><rect x="12" y="6" width="3" height="12" rx="1" fill="currentColor"/><rect x="17" y="2" width="2" height="16" rx="1" fill="currentColor" opacity=".45"/></svg>`;
const esimMoney = n => "$" + n.toFixed(2);
const esimRange = t => t.from ? `${fmtDate(t.from)}${t.to && t.to !== t.from ? " – " + fmtDate(t.to) : ""}` : "";
const esimWhere = t => t.countries.length ? (t.countries.length <= 3 ? t.countries.join(", ") : `${t.countries.slice(0, 2).join(", ")} and ${t.countries.length - 2} more`) : t.places.slice(0, 3).join(", ");
const esimToday = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`; };

// The card on the Trip screen, under "Ready for offline". Before the trip only.
function esimCard() {
  if (!esimOn() || !trip.days.length) return "";
  const t = esimTrip(); if (!t.from || t.from < esimToday()) return "";
  const done = esimMem()[trip.id];
  if (done) return `<div class="card esimcard ok"><div class="offhead"><span class="offico" aria-hidden="true">${ESIM_ICO}</span><div class="offtxt"><b>Mobile data: ${done.gb} GB ${esc(done.region)} plan</b><span>Demo order · ${done.phones} phone${done.phones > 1 ? "s" : ""} · switches on ${esc(fmtDate(done.on))}</span></div><button class="btn ghost small" data-act="esimopen">View</button></div></div>`;
  const best = esimPlans(t).find(p => p.rec);
  return `<div class="card esimcard"><div class="offhead"><span class="offico" aria-hidden="true">${ESIM_ICO}</span><div class="offtxt"><b>Mobile data for your trip</b><span>${esc(esimWhere(t))} · ${esc(esimRange(t))}</span></div><button class="btn small" data-act="esimopen">See plans</button></div>
    <span class="esimtag"><span class="ptag">Partner</span><span class="ptag demo">Demo</span> ${best.gb} GB fits your ${t.days} days · from ${esimMoney(esimPlans(t)[0].price)}</span></div>`;
}

// ---------- The sheet: plans → checkout → confirmation ----------
function esimSheetHTML() {
  const t = esimTrip(), plans = esimPlans(t), s = esimOpen;
  const p = plans.find(x => x.gb === s.gb) || plans.find(x => x.rec), total = p.price * s.phones;
  const head = (step, title) => `<div class="esimtop"><div><span class="eyebrow">Partner offer · ${step}</span><h2>${title}</h2></div><button class="linkbtn esimx" data-act="esimclose" aria-label="Close">✕</button></div>
    <div class="esimbrand"><span class="esimlogo" aria-hidden="true">eSIM</span><div><b>Travel eSIM partner</b><span>Sample partner for this demo</span></div><span class="ptag demo">Demo</span></div>`;
  const facts = `<p class="lede esimfacts">${esc(t.region === "your trip" ? "Covers your trip" : t.region === "Global" ? "Global plan" : t.region + " plan")}${t.countries.length > 1 ? ` · covers ${esc(t.countries.join(", "))}` : ""} · ${esc(esimRange(t))} (${t.days} days)</p>`;
  let body = "";
  if (s.step === "plans") body = `${head("Step 1 of 3", "Mobile data for your trip")}${facts}
    <div class="esimplans" role="radiogroup" aria-label="Data plans">${plans.map(x => `<button type="button" class="esimplan" role="radio" aria-checked="${x.gb === p.gb}" data-act="esimpick" data-gb="${x.gb}">
      <span class="esimgb">${x.gb} GB</span><span class="esimuse">${esc(x.use)}<small>${x.valid} days</small></span><span class="esimprice">${esimMoney(x.price)}</span>${x.rec ? `<span class="ptag rec">Fits your trip</span>` : ""}</button>`).join("")}</div>
    <div class="esimrow"><span class="lbl">Phones</span><div class="seg" role="group" aria-label="How many phones">${[1, 2, 3, 4].map(n => `<button type="button" data-act="esimphones" data-n="${n}" aria-pressed="${s.phones === n}">${n}</button>`).join("")}</div></div>
    <p class="hint">Your stories and maps are already saved for offline, so the guide works without it. Data keeps maps, ride times and messages live.${t.seaDays ? " Ship Wi-Fi at sea is separate." : ""}</p>
    <div class="esimfoot"><span class="esimtotal">${esimMoney(total)}<small>${s.phones > 1 ? `${s.phones} × ${esimMoney(p.price)}` : "one phone"}</small></span><button class="btn" data-act="esimnext">Continue</button></div>`;
  else if (s.step === "checkout") body = `${head("Step 2 of 3", "Check your order")}
    <dl class="esimsum">
      <div><dt>Plan</dt><dd>${p.gb} GB · ${esc(t.region === "your trip" ? "Trip" : t.region)} · ${p.valid} days</dd></div>
      <div><dt>Covers</dt><dd>${esc(esimWhere(t) || "Your trip")}</dd></div>
      <div><dt>Switches on</dt><dd>When you land${t.firstPlace ? " in " + esc(t.firstPlace) : ""}, ${esc(fmtDate(t.firstDate))}</dd></div>
      <div><dt>Phones</dt><dd>${s.phones}</dd></div>
      <div class="esimgrand"><dt>Total</dt><dd>${esimMoney(total)}</dd></div>
    </dl>
    <div class="esimpay" aria-disabled="true"><span class="lbl">Pay with</span><div class="esimcardnum"><span>Card</span><span>Demo · nothing is charged</span></div></div>
    <p class="hint">Works on phones that take an eSIM (most phones from 2019 on). Sold and supported by the eSIM partner. Kairoute may earn a referral fee; your price is the same.</p>
    <div class="esimfoot"><button class="btn ghost" data-act="esimback">Back</button><button class="btn" data-act="esimbuy">Place order (demo)</button></div>`;
  else body = `${head("Step 3 of 3", "You're set for mobile data")}
    <div class="esimdone"><span class="esimcheck" aria-hidden="true">✓</span><div><b>Demo: no purchase made</b><span>In the full app, this is what happens next:</span></div></div>
    <ol class="esimnext">
      <li><b>Install it now, on Wi-Fi.</b> One tap on this phone, or scan a code on another.</li>
      <li><b>It switches on when you land${t.firstPlace ? " in " + esc(t.firstPlace) : ""}</b>, ${esc(fmtDate(t.firstDate))}. Your home number keeps working for calls and texts.</li>
      <li><b>Kairoute reminds you</b> the day before you leave, and shows the data left on the Trip screen.</li>
    </ol>
    <div class="esimfoot"><button class="btn ghost" data-act="esimundo">Remove demo order</button><button class="btn" data-act="esimclose">Done</button></div>`;
  return `<div class="psheet" id="esimSheet" role="dialog" aria-modal="true" aria-label="Mobile data for your trip"><div class="sheet esimsheet">${body}</div></div>`;
}
function esimPaint() {
  const old = document.getElementById("esimSheet"); if (old) old.remove();
  document.body.classList.toggle("psheet-on", !!esimOpen);
  if (!esimOpen) return;
  document.body.insertAdjacentHTML("beforeend", esimSheetHTML());
  const sh = document.querySelector("#esimSheet .sheet"); if (sh) sh.scrollTop = 0;
  const f = document.querySelector("#esimSheet .esimfoot .btn:last-child"); if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
}
function esimRefreshCard() { const c = document.querySelector("#view .esimcard"); if (c) c.outerHTML = esimCard(); }

document.addEventListener("click", e => {
  const sheet = document.getElementById("esimSheet");
  if (sheet && e.target === sheet) { esimOpen = null; esimPaint(); return; } // a tap outside the sheet closes it
  const t = e.target.closest && e.target.closest("[data-act]"); if (!t || !/^esim/.test(t.dataset.act)) return;
  e.preventDefault();
  const a = t.dataset.act, tp = () => esimTrip(), rec = () => esimPlans(tp()).find(p => p.rec).gb;
  if (a === "esimopen") { const done = esimMem()[trip.id]; esimOpen = done ? { step: "done", gb: done.gb, phones: done.phones } : { step: "plans", gb: rec(), phones: 1 }; }
  else if (!esimOpen) return;
  else if (a === "esimclose") esimOpen = null;
  else if (a === "esimpick") esimOpen.gb = +t.dataset.gb;
  else if (a === "esimphones") esimOpen.phones = +t.dataset.n;
  else if (a === "esimnext") esimOpen.step = "checkout";
  else if (a === "esimback") esimOpen.step = "plans";
  else if (a === "esimbuy") { const x = tp(), m = esimMem(); m[trip.id] = { gb: esimOpen.gb, phones: esimOpen.phones, region: x.region === "your trip" ? "trip" : x.region, on: x.firstDate, at: Date.now() }; esimKeep(m); esimOpen.step = "done"; esimRefreshCard(); }
  else if (a === "esimundo") { const m = esimMem(); delete m[trip.id]; esimKeep(m); esimOpen = null; esimRefreshCard(); }
  esimPaint();
});
if (typeof window !== "undefined") addEventListener("keydown", e => { if (e.key === "Escape" && esimOpen) { esimOpen = null; esimPaint(); } });
