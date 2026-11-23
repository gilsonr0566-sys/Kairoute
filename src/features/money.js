// ===================== Money: home currency, what you really spent, the trip's spending =====================
// Richard, Nov 17: "We have how much the day will cost, but can it also have that translated to the user native
// currency too. Maybe even on the journal page have a total for the trip." Then: tapping Food, Tickets or Getting
// around opens a place to store what was actually spent.
// - Every amount the day estimates is in the local money; beside it, about what that is at home ("≈ $52").
//   Converted figures are always shown as approximate, with the date of the rate, never as exact.
// - Home currency: Settings > Display > Home currency. Automatic reads the device's region (US dollars when the
//   region is unknown). Kept for the device, not the trip (appSet.homecur).
// - Rates: one free, keyless daily table (open.er-api.com, base USD; Frankfurter as a second source; the copy
//   published with the site as a third). Kept on the device, so figures still show offline with the date they're
//   from. Asked for at most every 12 hours, only when a screen shows money, never while a tour is running.
// - What was spent: stored on the trip (trip.spent[day id] = { entry, food, move }, local money), so it syncs with
//   the trip. It never changes a plan (planKey leaves it out), so typing an amount never re-plans the day.
// - The trip's spending lives on the Journal: every day ashore, estimate or what was spent, in both currencies.

// ---- Which money a city uses (ISO code), worked out from its country, then its symbol, then its name ----
const CUR_COUNTRY = { greece: "EUR", italy: "EUR", spain: "EUR", france: "EUR", portugal: "EUR", germany: "EUR", austria: "EUR", netherlands: "EUR", belgium: "EUR", ireland: "EUR", finland: "EUR", estonia: "EUR", latvia: "EUR", lithuania: "EUR", luxembourg: "EUR", malta: "EUR", cyprus: "EUR", slovakia: "EUR", slovenia: "EUR", croatia: "EUR", monaco: "EUR", "san marino": "EUR", "vatican city": "EUR", vatican: "EUR", montenegro: "EUR", kosovo: "EUR", andorra: "EUR",
  turkey: "TRY", "türkiye": "TRY", turkiye: "TRY", "united kingdom": "GBP", uk: "GBP", england: "GBP", scotland: "GBP", wales: "GBP", "northern ireland": "GBP", gibraltar: "GIP",
  switzerland: "CHF", liechtenstein: "CHF", norway: "NOK", sweden: "SEK", denmark: "DKK", iceland: "ISK", poland: "PLN", czechia: "CZK", "czech republic": "CZK", hungary: "HUF", romania: "RON", bulgaria: "BGN", serbia: "RSD", albania: "ALL", "bosnia and herzegovina": "BAM", "north macedonia": "MKD",
  "united states": "USD", usa: "USD", us: "USD", "united states of america": "USD", "puerto rico": "USD", canada: "CAD", mexico: "MXN", bahamas: "BSD", jamaica: "JMD", bermuda: "BMD", "dominican republic": "DOP", "costa rica": "CRC", panama: "USD", belize: "BZD", "cayman islands": "KYD", aruba: "AWG", barbados: "BBD", "u.s. virgin islands": "USD", "us virgin islands": "USD", "british virgin islands": "USD", "sint maarten": "ANG", curaçao: "ANG", curacao: "ANG", "saint lucia": "XCD", "antigua and barbuda": "XCD", "st. kitts and nevis": "XCD", "saint kitts and nevis": "XCD", grenada: "XCD", honduras: "HNL", guatemala: "GTQ", colombia: "COP",
  brazil: "BRL", argentina: "ARS", chile: "CLP", peru: "PEN", uruguay: "UYU", ecuador: "USD",
  japan: "JPY", china: "CNY", "hong kong": "HKD", taiwan: "TWD", "south korea": "KRW", korea: "KRW", singapore: "SGD", thailand: "THB", vietnam: "VND", malaysia: "MYR", indonesia: "IDR", philippines: "PHP", india: "INR", "sri lanka": "LKR",
  australia: "AUD", "new zealand": "NZD", fiji: "FJD", "french polynesia": "XPF",
  egypt: "EGP", morocco: "MAD", tunisia: "TND", israel: "ILS", jordan: "JOD", "united arab emirates": "AED", uae: "AED", qatar: "QAR", oman: "OMR", "saudi arabia": "SAR", "south africa": "ZAR", kenya: "KES", tanzania: "TZS", mauritius: "MUR", seychelles: "SCR" };
const CUR_SYMBOL = { "€": "EUR", "₺": "TRY", "£": "GBP", "¥": "JPY", "₹": "INR", "₩": "KRW", "₪": "ILS", "zł": "PLN", "Kč": "CZK", "Ft": "HUF", "฿": "THB", "₫": "VND", "₱": "PHP", "R$": "BRL", "CHF": "CHF", "C$": "CAD", "A$": "AUD", "NZ$": "NZD", "US$": "USD", "HK$": "HKD", "S$": "SGD" };
const CUR_NAME = [[/\beuros?\b/i, "EUR"], [/turkish lira|\blira\b/i, "TRY"], [/pounds? sterling|british pound/i, "GBP"], [/swiss franc/i, "CHF"], [/norwegian kron/i, "NOK"], [/swedish kron/i, "SEK"], [/danish kron/i, "DKK"], [/icelandic kr/i, "ISK"], [/zloty|złoty/i, "PLN"], [/czech|koruna/i, "CZK"], [/forint/i, "HUF"], [/\byen\b/i, "JPY"], [/egyptian pound/i, "EGP"], [/dirham/i, "MAD"], [/shekel/i, "ILS"], [/canadian dollar/i, "CAD"], [/australian dollar/i, "AUD"], [/us dollars?|u\.s\. dollars?|american dollar/i, "USD"], [/east caribbean/i, "XCD"], [/mexican peso/i, "MXN"], [/real\b|reais/i, "BRL"], [/rand\b/i, "ZAR"], [/rupee/i, "INR"], [/baht/i, "THB"]];
// A guide's prices are in the local money unless its basics say otherwise (basics.prices, an ISO code: Kusadasi's
// sights list their tickets in euros though the lira is the local money).
const CUR_SIGN = { EUR: "€", USD: "$", GBP: "£", TRY: "₺", JPY: "¥", CHF: "CHF ", INR: "₹", ILS: "₪" };
function priceSym(city) { const b = (city && city.basics) || {}; return (b.prices && CUR_SIGN[b.prices]) || b.symbol || "€"; }
function curOf(city) {
  if (!city) return "";
  const b = city.basics || {}, ctry = String(city.country || "").trim().toLowerCase(), name = String(b.currency || "");
  if (b.prices && FX_NAMES[b.prices]) return b.prices;
  const iso = name.match(/\b([A-Z]{3})\b/); if (iso && FX_NAMES[iso[1]]) return iso[1];
  if (CUR_COUNTRY[ctry]) return CUR_COUNTRY[ctry];
  const sym = String(b.symbol || "").trim(); if (CUR_SYMBOL[sym]) return CUR_SYMBOL[sym];
  for (const [re, c] of CUR_NAME) if (re.test(name)) return c;
  if (sym === "$" && /dollar/i.test(name) && !ctry) return "USD";
  return sym === "€" || !sym ? "EUR" : ""; // the built-in guides without a symbol are all in the euro area
}

// ---- Home currency ----
const FX_NAMES = { USD: "US dollar", EUR: "Euro", GBP: "British pound", CAD: "Canadian dollar", AUD: "Australian dollar", NZD: "New Zealand dollar", CHF: "Swiss franc", JPY: "Japanese yen", MXN: "Mexican peso", BRL: "Brazilian real", INR: "Indian rupee", ZAR: "South African rand", SEK: "Swedish krona", NOK: "Norwegian krone", DKK: "Danish krone", PLN: "Polish zloty", CZK: "Czech koruna", HUF: "Hungarian forint", TRY: "Turkish lira", ILS: "Israeli shekel", SGD: "Singapore dollar", HKD: "Hong Kong dollar", CNY: "Chinese yuan", KRW: "South Korean won", TWD: "Taiwan dollar", THB: "Thai baht", PHP: "Philippine peso", AED: "UAE dirham", ISK: "Icelandic krona", RON: "Romanian leu", BGN: "Bulgarian lev", EGP: "Egyptian pound", MAD: "Moroccan dirham", ARS: "Argentine peso", CLP: "Chilean peso", COP: "Colombian peso" };
const REGION_CUR = { US: "USD", PR: "USD", CA: "CAD", MX: "MXN", GB: "GBP", IE: "EUR", AU: "AUD", NZ: "NZD", CH: "CHF", JP: "JPY", BR: "BRL", IN: "INR", ZA: "ZAR", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CZ: "CZK", HU: "HUF", TR: "TRY", IL: "ILS", SG: "SGD", HK: "HKD", CN: "CNY", KR: "KRW", TW: "TWD", TH: "THB", PH: "PHP", AE: "AED", IS: "ISK", RO: "RON", BG: "BGN", EG: "EGP", MA: "MAD", AR: "ARS", CL: "CLP", CO: "COP",
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", PT: "EUR", NL: "EUR", BE: "EUR", AT: "EUR", FI: "EUR", GR: "EUR", LU: "EUR", MT: "EUR", CY: "EUR", SK: "EUR", SI: "EUR", EE: "EUR", LV: "EUR", LT: "EUR", HR: "EUR" };
function homeAuto() {
  const langs = (typeof navigator !== "undefined" && (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language])) || [];
  for (const l of langs) { const m = String(l || "").match(/[-_]([A-Za-z]{2})\b/); if (m && REGION_CUR[m[1].toUpperCase()]) return REGION_CUR[m[1].toUpperCase()]; }
  return "USD";
}
const homeCur = () => (appSet.homecur && FX_NAMES[appSet.homecur] ? appSet.homecur : homeAuto());
function homeCurField() {
  const auto = homeAuto(), v = appSet.homecur && FX_NAMES[appSet.homecur] ? appSet.homecur : "";
  const opts = Object.keys(FX_NAMES).sort((a, b) => FX_NAMES[a].localeCompare(FX_NAMES[b]));
  return `<div class="field"><label for="p-homecur">Home currency</label><select id="p-homecur"><option value="" ${v ? "" : "selected"}>Automatic (${esc(FX_NAMES[auto])})</option>${opts.map(c => `<option value="${c}" ${v === c ? "selected" : ""}>${esc(FX_NAMES[c])} (${c})</option>`).join("")}</select><span class="hint">Day costs and the trip's spending also show about what they are in this money. Rates are updated daily and kept for offline use.</span></div>`;
}

// ---- Exchange rates ----
const FX_STORE = "kairoute.fx1";
let fxBusy = false, fxTried = 0;
const fxData = () => { try { const x = JSON.parse(localStorage.getItem(FX_STORE) || "null"); return x && x.rates && x.rates.USD ? x : null; } catch (e) { return null; } };
function fxKeep(x) { try { localStorage.setItem(FX_STORE, JSON.stringify(x)); } catch (e) {} }
// One table, base USD: { day: "2026-11-17" (the date the source says the rates are from), at: when fetched, rates }.
function fxParse(j) {
  if (j && j.result === "success" && j.rates && j.rates.USD === 1) return { day: new Date((j.time_last_update_unix || Date.now() / 1000) * 1000).toISOString().slice(0, 10), rates: j.rates };
  if (j && j.base === "USD" && j.rates && j.date) return { day: j.date, rates: Object.assign({ USD: 1 }, j.rates) }; // Frankfurter
  return null;
}
async function fxGet(url) {
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null, to = setTimeout(() => ctl && ctl.abort(), 8000);
  try { const r = await fetch(url, { cache: "no-store", signal: ctl && ctl.signal }); return r.ok ? fxParse(await r.json()) : null; } catch (e) { return null; } finally { clearTimeout(to); }
}
// Fresh rates when the kept ones are over 12 hours old (or missing), then every amount on screen is filled in.
async function fxEnsure() {
  const have = fxData();
  if (fxBusy || (have && Date.now() - have.at < 12 * 3600e3) || Date.now() - fxTried < 60e3) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false && have) return;
  if (document.body && document.body.classList.contains("touring-on") && have) return;
  fxBusy = true; fxTried = Date.now();
  try {
    let x = await fxGet("https://open.er-api.com/v6/latest/USD");
    if (!x) x = await fxGet("https://api.frankfurter.app/latest?from=USD");
    if (!x) x = await fxGet("rates.json"); // the copy published with the site (same address, kept for offline)
    if (x && (!have || x.day >= have.day)) { fxKeep(Object.assign(x, { at: Date.now() })); fxPaint(); }
  } finally { fxBusy = false; }
}
// About how much `n` of `from` is in the home money, or null when no rate is known.
function fxConv(n, from, to) {
  const x = fxData(); to = to || homeCur(); if (!x || !from || !n && n !== 0) return null;
  if (from === to) return n;
  const a = x.rates[from], b = x.rates[to]; return a && b ? n / a * b : null;
}
function homeMoney(n, cur) {
  cur = cur || homeCur(); // whole units: these are rough figures, and cents would suggest an exactness they don't have
  try { return new Intl.NumberFormat(typeof navigator !== "undefined" && navigator.language || "en-US", { style: "currency", currency: cur, maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(Math.round(n)); }
  catch (e) { return cur + " " + Math.round(n); }
}
// "≈ $52" for a local amount, as a span the rates can fill in later. Empty when home and local money are the same.
function fxSpan(n, cur, cls) {
  if (!cur || cur === homeCur()) return "";
  const v = fxConv(n, cur); fxEnsure();
  return `<span class="fx${cls ? " " + cls : ""}" data-fx="${n}" data-fxc="${cur}">${v == null ? "" : "≈ " + esc(homeMoney(v))}</span>`;
}
// The rate line: what the conversion used and the day it is from.
function fxNote(cur) {
  if (!cur || cur === homeCur()) return "";
  return `<span class="fxnote" data-fxnote="${cur}">${fxNoteText(cur)}</span>`;
}
function fxNoteText(cur) {
  const x = fxData(), one = fxConv(1, cur); if (!x || one == null) return "Your home-currency figures appear once the app has been online.";
  const old = (Date.now() - new Date(x.day + "T12:00:00Z")) / 864e5 > 3;
  const h = homeCur(), f = (n, c, dp) => { try { return new Intl.NumberFormat(typeof navigator !== "undefined" && navigator.language || "en-US", { style: "currency", currency: c, maximumFractionDigits: dp, minimumFractionDigits: dp }).format(n); } catch (e) { return c + " " + n.toFixed(dp); } };
  const rate = one >= 0.2 ? `${f(1, cur, 0)} = ${f(one, h, 2)}` : `${f(1, h, 0)} = ${f(1 / one, cur, 1 / one >= 100 ? 0 : 2)}`; // the side that reads easily
  return `Home-currency figures are approximate, at ${esc(rate)}, ${old ? "the rate when you were last online, on" : "rate from"} ${esc(fmtDate(x.day))}. Your bank's rate will differ a little.`;
}
const localMoneyFmt = (n, cur) => { try { return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n); } catch (e) { return cur + " " + n; } };
function fxPaint() {
  document.querySelectorAll("[data-fx]").forEach(el => { const v = fxConv(+el.dataset.fx, el.dataset.fxc); el.textContent = v == null ? "" : "≈ " + homeMoney(v); });
  document.querySelectorAll("[data-fxnote]").forEach(el => { el.innerHTML = fxNoteText(el.dataset.fxnote); });
}
if (typeof window !== "undefined") window.addEventListener("online", () => setTimeout(() => { fxTried = 0; if (document.querySelector("[data-fx],[data-fxnote]")) fxEnsure(); }, 2500));

// ---- What was really spent ----
const SPEND_KEYS = [["entry", "Tickets", "tickets"], ["food", "Food", "food"], ["move", "Getting around", "getting around"]];
let spendOpen = ""; // the block being typed into, on the Day plan
const spentOf = d => (trip.spent && d && d.id && trip.spent[d.id]) || {};
function spentSet(d, k, v) {
  if (!d || !d.id) return;
  trip.spent = trip.spent || {}; const s = Object.assign({}, trip.spent[d.id] || {});
  if (v == null || isNaN(v)) delete s[k]; else s[k] = Math.round(v * 100) / 100;
  if (Object.keys(s).length) trip.spent[d.id] = s; else delete trip.spent[d.id];
  save();
}
// The day's figures: each block is what was spent when it has been typed in, else the estimate.
function dayMoney(plan, d) {
  const b = planBudget(plan), s = spentOf(d), cur = curOf(plan.city), out = { cur, sym: b.sym, party: b.party, rows: [], total: 0, est: b.total, actual: 0, mixed: false };
  SPEND_KEYS.forEach(([k, label, low]) => { const has = typeof s[k] === "number", v = has ? s[k] : b[k]; out.rows.push({ k, label, low, est: b[k], spent: has ? s[k] : null, v }); out.total += v; if (has) out.actual++; });
  out.mixed = out.actual > 0 && out.actual < 3;
  return out;
}
const spendNum = n => Math.round(n) === n ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function budgetCard(plan, d) {
  d = d || day(); const m = dayMoney(plan, d), sym = m.sym;
  const block = r => `<button type="button" class="stat spendstat${r.spent != null ? " spent" : ""}${spendOpen === r.k ? " open" : ""}" data-spend="${r.k}" aria-expanded="${spendOpen === r.k}" aria-label="${esc(r.label)}: ${r.spent != null ? "spent " + esc(sym + spendNum(r.spent)) : "estimate " + esc(sym + spendNum(r.est))}. Tap to enter what you spent.">
      <b>${esc(sym + spendNum(r.v))}</b><span>${esc(r.low)}${r.spent != null ? " · spent" : ""}</span>${fxSpan(r.v, m.cur)}
      <small class="spendhint">${r.spent != null ? `Estimate ${esc(sym + spendNum(r.est))}` : "Tap to add what you spent"}</small></button>`;
  const open = SPEND_KEYS.find(x => x[0] === spendOpen), cur = open ? spentOf(d)[open[0]] : null;
  return `<div class="card budgetcard"><div><span class="eyebrow">Today's costs · ${m.party} ${m.party === 1 ? "person" : "people"}</span></div>
    <div class="summary">${m.rows.map(block).join("")}
      <div class="stat spendtotal"><b>${esc(sym + spendNum(m.total))}</b><span>total</span>${fxSpan(m.total, m.cur)}<small class="spendhint">${m.actual === 3 ? "All spent" : m.actual ? `Spent + estimate (estimate ${esc(sym + spendNum(m.est))})` : "Estimate"}</small></div>
    </div>
    ${open ? `<div class="spendedit"><label for="spendIn">What you spent on ${esc(open[2])} today, in ${esc(FX_NAMES[m.cur] ? FX_NAMES[m.cur].toLowerCase() + "s" : "local money")} (${esc(sym)}), for everyone</label>
      <div class="ask"><input id="spendIn" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" placeholder="${esc(spendNum(dayMoney(plan, d).rows.find(r => r.k === open[0]).est))}" value="${cur != null ? esc(String(cur)) : ""}">
      <button type="button" class="btn small" data-spendact="save">Save</button>${cur != null ? `<button type="button" class="btn ghost small" data-spendact="clear">Clear</button>` : ""}<button type="button" class="btn ghost small" data-spendact="close">Cancel</button></div></div>` : ""}
    <p class="footnote">Estimates are rough, from typical prices; tap a block to keep what you really spent. ${fxNote(m.cur)} Change the number of people in Settings.</p></div>`;
}
function spendRefresh(focus) {
  const box = document.querySelector("#view .budgetcard"), d = day(), city = d && cityFor(d); if (!box || !city) return;
  const plan = planPeek(d) || buildPlan(d); if (!plan || plan.error) return;
  box.outerHTML = budgetCard(plan, d);
  if (focus) { const i = document.getElementById("spendIn"); if (i) try { i.focus({ preventScroll: true }); i.select(); } catch (e) {} }
}
function spendSave() {
  const i = document.getElementById("spendIn"), d = day(); if (!i || !spendOpen) return;
  const raw = i.value.trim().replace(/[^\d.,]/g, ""), n = raw === "" ? NaN : parseFloat(/,\d{1,2}$/.test(raw) && !/\./.test(raw) ? raw.replace(",", ".") : raw.replace(/,/g, ""));
  if (raw !== "" && (isNaN(n) || n < 0 || n > 1e7)) { i.setCustomValidity("Type an amount, like 45 or 45.50"); i.reportValidity(); return; }
  if (raw !== "") spentSet(d, spendOpen, n); // an empty box leaves the amount as it was
  spendOpen = ""; spendRefresh();
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-spend],[data-spendact]"); if (!b) return;
  e.preventDefault();
  if (b.dataset.spend) { spendOpen = spendOpen === b.dataset.spend ? "" : b.dataset.spend; spendRefresh(!!spendOpen); return; }
  const a = b.dataset.spendact;
  if (a === "print") { printSpending(); return; }
  if (a === "save") spendSave();
  else if (a === "clear") { spentSet(day(), spendOpen, null); spendOpen = ""; spendRefresh(); }
  else { spendOpen = ""; spendRefresh(); }
});
document.addEventListener("keydown", e => {
  if (!e.target || e.target.id !== "spendIn") return;
  if (e.key === "Enter") { e.preventDefault(); spendSave(); } else if (e.key === "Escape") { spendOpen = ""; spendRefresh(); }
});

// ---- The trip's spending, on the Journal ----
// Days already planned are used at once; the rest are worked out one at a time in quiet moments afterwards, so
// opening the Journal never waits for twenty days of planning. full: plan every day now (tools and tests).
let budgetTimer = 0, budgetSteps = 0;
function tripBudget(full) {
  const rows = []; let missing = 0, todo = 0;
  trip.days.forEach((d, i) => {
    if (noShore(d)) return;
    const city = cityFor(d); if (!city) { missing++; return; }
    let plan = d.selected ? planPeek(d) : null;
    if (!plan && !full) { todo++; rows.push({ d, i, city, todo: true }); return; }
    if (!plan) { refillIfNeeded(d, city); if (!d.selected) seedPicks(d, city); plan = buildPlan(d); }
    if (!plan || plan.error) return;
    rows.push(Object.assign({ d, i, city }, dayMoney(plan, d)));
  });
  if (todo && !budgetTimer && budgetSteps < 3 * trip.days.length) budgetTimer = setTimeout(budgetStep, 300); // capped, in case answers keep arriving
  return { rows, missing, todo, days: rows.filter(r => !r.todo).length };
}
function budgetHtml() {
  const tb = tripBudget(), done = tb.rows.filter(r => !r.todo), home = homeCur();
  if (!tb.rows.length && !tb.missing) return "";
  const byCur = {}; done.forEach(r => { byCur[r.cur || r.sym] = byCur[r.cur || r.sym] || { sym: r.sym, n: 0 }; byCur[r.cur || r.sym].n += r.total; });
  const local = Object.values(byCur).map(x => x.sym + spendNum(Math.round(x.n))).join(" + ");
  let homeTot = 0, homeOk = done.length > 0; done.forEach(r => { const v = fxConv(r.total, r.cur); if (v == null) homeOk = false; else homeTot += v; });
  const allHome = done.length && done.every(r => r.cur === home), spentDays = done.filter(r => r.actual).length;
  const head = tb.todo && !done.length ? "adding up your days…" : `${allHome ? "" : homeOk ? `≈ ${esc(homeMoney(homeTot))}` : ""}${allHome ? esc(local) : homeOk ? ` <span class="lede" style="font-weight:400">(${esc(local)})</span>` : esc(local)}${tb.todo ? " <span class=\"lede\" style=\"font-weight:400\">(still adding up)</span>" : ""}`;
  const row = r => r.todo ? `<div class="sprow todo"><span class="spday">${esc(r.d.date ? fmtDate(r.d.date) : "Day " + (r.i + 1))} · ${esc(r.city.city || r.d.destination || "")}</span><span class="spamt">adding up…</span><span></span><span></span></div>`
    : `<div class="sprow${r.actual ? " spent" : ""}"><span class="spday">${esc(r.d.date ? fmtDate(r.d.date) : "Day " + (r.i + 1))} · ${esc(r.city.city || r.d.destination || "")}</span><span class="spamt">${esc(r.sym + spendNum(r.total))}</span><small class="sptag">${r.actual === 3 ? "spent" : r.actual ? "spent + est." : "est."}</small>${fxSpan(r.total, r.cur) || "<span></span>"}</div>`;
  const curs = [...new Set(done.map(r => r.cur).filter(c => c && c !== home))];
  return `<details class="card more tripbudget"><summary>${spentDays ? "Trip spending" : "Estimated cost"}: ${head} <span class="lede" style="font-weight:400">· for ${P().party} ${P().party === 1 ? "person" : "people"}</span></summary>
    <div class="sptable">${tb.rows.map(row).join("")}</div>
    <div class="actions spacts"><button type="button" class="btn ghost small" data-spendact="print">🖨 Print or save my spending as PDF</button></div>
    <p class="footnote">Tickets, food and getting around for each day ashore: what you spent where you've added it on the Day plan${spentDays ? ` (${spentDays} day${spentDays === 1 ? "" : "s"} so far)` : ""}, the estimate everywhere else. ${tb.missing ? `${tb.missing} day${tb.missing === 1 ? "" : "s"} still need a guide. ` : ""}Flights, the cruise and hotels aren't included. ${curs.map(fxNote).join(" ")}</p></details>`;
}
function budgetStep() {
  budgetTimer = 0; const box = document.querySelector("#view .tripbudget"); if (!box || view !== "journal") { budgetSteps = 0; return; }
  budgetSteps++;
  if (Date.now() - lastTouch < 600) { budgetTimer = setTimeout(budgetStep, 400); return; }
  const d = trip.days.find(x => !noShore(x) && cityFor(x) && !(x.selected && planPeek(x)));
  if (d) { const city = cityFor(d); try { refillIfNeeded(d, city); if (!d.selected) { seedPicks(d, city); save(); } buildPlan(d); } catch (e) {} }
  const open = box.open; box.outerHTML = budgetHtml(); const nb = document.querySelector("#view .tripbudget"); if (nb) nb.open = open;
}
// ---- The spending report: where the money went, day by day and by kind, in both currencies ----
// Same look and same print route as the printable plan (print-plan.js): the device's print dialog, where "Save as
// PDF" is one of the printers. Made on the device from the saved plans and amounts, so it works with no signal.
function spendingHTML() {
  const tb = tripBudget(true), rows = tb.rows.filter(r => !r.todo), home = homeCur(), showHome = rows.some(r => r.cur && r.cur !== home);
  const hm = (n, cur) => { const v = fxConv(n, cur); return v == null ? "" : homeMoney(v); };
  const cell = (r, x) => `<td class="${x.spent != null ? "pspent" : "pest"}">${esc(r.sym + spendNum(x.v))}${x.spent != null ? "" : "<i>est.</i>"}</td>`;
  const sum = { entry: 0, food: 0, move: 0 }, spent = { n: 0, home: 0 }, est = { n: 0, home: 0 }; let homeAll = 0, homeOk = true;
  const bySym = {};
  rows.forEach(r => { bySym[r.sym] = (bySym[r.sym] || 0) + r.total; r.rows.forEach(x => { const v = fxConv(x.v, r.cur); sum[x.k] += v == null ? 0 : v; if (v == null) homeOk = false; else homeAll += v; const b = x.spent != null ? spent : est; b.n++; b.home += v || 0; }); });
  const local = Object.entries(bySym).map(([k, v]) => k + spendNum(Math.round(v))).join(" + ");
  const big = (lbl, main, sub) => `<div><span>${lbl}</span><strong>${main}</strong>${sub ? `<em>${sub}</em>` : ""}</div>`;
  const dates = trip.days.map(x => x.date).filter(Boolean).sort();
  const curs = [...new Set(rows.map(r => r.cur).filter(c => c && c !== home))];
  return `<header class="phead">${PRINT_LOGO}<div><div class="pbrand">Kairoute · Spending report</div><h1>${esc(trip.name || tripName(trip))}</h1><div class="pspan">${dates.length ? esc(printDate(dates[0], { month: "long", day: "numeric" }) + " to " + printDate(dates[dates.length - 1], { month: "long", day: "numeric", year: "numeric" })) + " · " : ""}${rows[0] ? rows[0].party : P().party} ${(rows[0] ? rows[0].party : P().party) === 1 ? "person" : "people"}</div></div></header>
    <div class="pkeys pspkeys">
      ${big("Trip total", showHome && homeOk ? "≈ " + esc(homeMoney(homeAll)) : esc(local), showHome && homeOk ? esc(local) : "")}
      ${showHome ? big("You spent", spent.n ? "≈ " + esc(homeMoney(spent.home)) : "Nothing added yet", spent.n ? `added for ${rows.filter(r => r.actual).length} of ${rows.length} days` : "") : ""}
      ${showHome ? big("Still estimated", "≈ " + esc(homeMoney(est.home)), "") : ""}
      ${SPEND_KEYS.map(([k, l]) => big(esc(l), showHome ? "≈ " + esc(homeMoney(sum[k])) : esc(local && rows[0] ? rows[0].sym + spendNum(Math.round(rows.reduce((a, r) => a + r.rows.find(x => x.k === k).v, 0))) : ""), homeAll && showHome ? Math.round(100 * sum[k] / homeAll) + "% of the total" : "")).join("")}
    </div>
    <table class="pspend"><thead><tr><th>Day</th><th>Place</th><th>Tickets</th><th>Food</th><th>Getting around</th><th>Day total</th>${showHome ? `<th>≈ ${esc(home)}</th>` : ""}</tr></thead><tbody>
    ${rows.map(r => `<tr><td class="pt">${esc(r.d.date ? printDate(r.d.date, { month: "short", day: "numeric" }) : "Day " + (r.i + 1))}</td><td>${esc(r.city.city || r.d.destination || "")}</td>${r.rows.map(x => cell(r, x)).join("")}<td class="ptot">${esc(r.sym + spendNum(r.total))}</td>${showHome ? `<td class="phome">${esc(hm(r.total, r.cur))}</td>` : ""}</tr>`).join("")}
    </tbody><tfoot><tr><td colspan="2">Trip total</td>${SPEND_KEYS.map(([k]) => `<td>${showHome ? "≈ " + esc(homeMoney(sum[k])) : ""}</td>`).join("")}<td class="ptot">${esc(local)}</td>${showHome ? `<td class="phome">${homeOk ? "≈ " + esc(homeMoney(homeAll)) : ""}</td>` : ""}</tr></tfoot></table>
    <p class="pzone"><b class="pspentkey">Bold</b> amounts are what you spent, as you added them on the Day plan. <i>est.</i> marks Kairoute's estimate from typical prices, for ${rows[0] ? rows[0].party : P().party} people. Flights, the cruise and hotels aren't included.${tb.missing ? ` ${tb.missing} day${tb.missing === 1 ? "" : "s"} without a guide aren't counted.` : ""}</p>
    ${curs.map(c => `<p class="pzone">${fxNoteText(c)}</p>`).join("")}
    <footer class="pfoot"><p>Made with Kairoute on ${esc(printDate(todayISO()))}.</p></footer>`;
}
function printSpending() {
  let box = document.getElementById("printView");
  if (!box) { box = document.createElement("div"); box.id = "printView"; document.body.appendChild(box); }
  try { box.innerHTML = spendingHTML(); } catch (e) { aiError = "The spending report couldn't be made (" + (e && e.message || e) + ")."; render(); return; }
  const was = document.title; document.title = (trip.name || "Kairoute trip") + " - spending";
  const done = () => { document.title = was; removeEventListener("afterprint", done); };
  addEventListener("afterprint", done);
  if (typeof window.print === "function") { try { window.print(); } catch (e) { done(); } } else done();
}
if (typeof window !== "undefined") window.__kairouteMoney = { spendingHTML, setSpent: (i, o) => { const d = trip.days[i]; Object.keys(o).forEach(k => spentSet(d, k, o[k])); }, curOf, homeCur, fxConv, tripBudget: () => tripBudget(true).rows.map(r => ({ date: r.d.date, city: r.city.city, type: r.d.type, cur: r.cur, sym: r.sym, total: r.total, est: r.est, actual: r.actual, rows: r.rows })) };
