// ===================== Guide extras =====================
// Golden hour and photo spots, local know-how, practical answers for "Ask your guide", theme tours, kids mode,
// the before-you-arrive story, ship's-tour savings and the trip storybook. Rules for all of them:
// - Every place and fact comes from a named source: OpenStreetMap, Wikivoyage, Wikidata, the stop's own checked
//   guide text, or exact astronomy. The AI only rewrites or shortens text it is handed (see worker/extras.js).
// - Nothing is written for one city or one trip: it all runs from the trip's own days, stops and cities.
// - Answers are cached on the device (and on the server for everyone), so a trip planned online works offline.

// ---------- Shared: fetching from Kairoute's helper, cached on this device ----------
const GX_STORE = "kairoute.gx1";
let gxCache = (() => { try { return JSON.parse(localStorage.getItem(GX_STORE) || "{}") || {}; } catch (e) { return {}; } })();
const gxPending = new Set(), gxFailed = new Map();
function gxSaveCache() {
  try { const keys = Object.keys(gxCache); if (keys.length > 400) keys.sort((a, b) => (gxCache[a].t || 0) - (gxCache[b].t || 0)).slice(0, keys.length - 400).forEach(k => delete gxCache[k]); localStorage.setItem(GX_STORE, JSON.stringify(gxCache)); } catch (e) {}
}
let gxRenderTimer = null;
function gxRefresh() {
  clearTimeout(gxRenderTimer);
  gxRenderTimer = setTimeout(() => { const a = document.activeElement; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return gxRefresh(); if (view === "tour") renderGuideOnly(); else render(); }, 250);
}
// Returns what is known now (or undefined) and fetches it once in the background.
function gxGet(key, path, opts) {
  const hit = gxCache[key]; if (hit && hit.v !== undefined) return hit.v;
  if (!freeAI || gxPending.has(key) || (gxFailed.get(key) || 0) > Date.now() || (typeof navigator !== "undefined" && navigator.onLine === false)) return undefined;
  gxPending.add(key);
  fetch(freeAI.url + path, opts && opts.body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(opts.body) } : {})
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .catch(st => opts && opts.fallback ? opts.fallback().then(v => v || Promise.reject(st), () => Promise.reject(st)) : Promise.reject(st))
    .then(v => { gxCache[key] = { v, t: Date.now() }; gxSaveCache(); gxRefresh(); })
    .catch(st => { gxFailed.set(key, Date.now() + (st === 422 || st === 400 ? 864e5 : 90000)); if (st === 422 || st === 400) { gxCache[key] = { v: null, t: Date.now() }; gxSaveCache(); } })
    .finally(() => gxPending.delete(key));
  return undefined;
}
const gxR3 = n => (+n).toFixed(3);
// When Kairoute's helper can't reach the map servers (they turn away busy callers), the device asks OpenStreetMap's
// Overpass service itself: same query, same answer format, from the traveler's own connection.
async function gxNearDirect(what, lat, lng) {
  const A = what === "view" ? `(around:2000,${lat},${lng})` : `(around:700,${lat},${lng})`;
  const q = what === "view" ? `[out:json][timeout:12];(node["tourism"="viewpoint"]["name"]${A};way["tourism"="viewpoint"]["name"]${A};);out center tags 80;`
    : `[out:json][timeout:12];(node["amenity"~"^(toilets|drinking_water|pharmacy|atm)$"]${A};way["amenity"~"^(toilets|pharmacy)$"]${A};node["amenity"="bank"]["atm"="yes"]${A};);out center tags 200;`;
  for (const ep of ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"]) {
    try {
      const r = await fetch(ep, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "content-type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) continue; const d = await r.json(); if (d.remark && !(d.elements || []).length) continue;
      const list = (d.elements || []).map(e => { const t = e.tags || {}, la = e.lat != null ? e.lat : e.center && e.center.lat, ln = e.lon != null ? e.lon : e.center && e.center.lon; if (!isFinite(la)) return null;
        return what === "view" ? { name: t["name:en"] || t.name || "", local: t.name && t["name:en"] && t.name !== t["name:en"] ? t.name : undefined, lat: +(+la).toFixed(5), lng: +(+ln).toFixed(5), wd: t.wikidata || undefined, desc: (t.description || "").slice(0, 160) || undefined }
          : { kind: t.amenity === "bank" ? "atm" : t.amenity, name: t["name:en"] || t.name || t.operator || t.brand || "", lat: +(+la).toFixed(5), lng: +(+ln).toFixed(5), fee: t.fee || undefined, hours: t.opening_hours || undefined, wheelchair: t.wheelchair || undefined, access: t.access || undefined }; }).filter(x => x && (what !== "view" || x.name));
      return what === "view" ? { spots: list.slice(0, 120), source: "OpenStreetMap" } : { places: list.slice(0, 120), source: "OpenStreetMap" };
    } catch (e) {}
  }
  return null;
}
const gxStopsOf = plan => plan.items.filter(i => i.type === "stop" && i.place && isFinite(i.place.lat));
function gxCenter(city) {
  const pts = (city.sites || []).filter(x => isFinite(x.lat)).slice(0, 12);
  return pts.length ? { lat: pts.reduce((a, x) => a + x.lat, 0) / pts.length, lng: pts.reduce((a, x) => a + x.lng, 0) / pts.length } : null;
}
const gxMapLink = p => `https://www.google.com/maps/search/?api=1&query=${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

// ---------- Golden hour and photo spots ----------
// Sun times from the standard solar position formulas (the same ones NOAA and SunCalc use): exact to about a minute.
const GX_RAD = Math.PI / 180, GX_DAY = 864e5, GX_J1970 = 2440588, GX_J2000 = 2451545, GX_E = GX_RAD * 23.4397;
function gxSun(iso, lat, lng) {
  const date = new Date(Date.parse(iso + "T12:00:00Z") - lng / 15 * 3600000);
  const d = date / GX_DAY - 0.5 + GX_J1970 - GX_J2000, lw = GX_RAD * -lng, phi = GX_RAD * lat;
  const n = Math.round(d - 0.0009 - lw / (2 * Math.PI)), ds = 0.0009 + lw / (2 * Math.PI) + n;
  const M = GX_RAD * (357.5291 + 0.98560028 * ds), C = GX_RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + GX_RAD * 102.9372 + Math.PI, dec = Math.asin(Math.sin(GX_E) * Math.sin(L));
  const noon = GX_J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const at = h => { const c = (Math.sin(h * GX_RAD) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)); if (c < -1 || c > 1) return null;
    const w = Math.acos(c), set = GX_J2000 + (0.0009 + (w + lw) / (2 * Math.PI) + n) + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
    const toDate = j => new Date((j + 0.5 - GX_J1970) * GX_DAY); return [toDate(noon - (set - noon)), toDate(set)]; };
  const sr = at(-0.833), gh = at(6), bl = at(-4), bl2 = at(-6);
  return sr ? { sunrise: sr[0], sunset: sr[1], goldAmEnd: gh ? gh[0] : null, goldPmStart: gh ? gh[1] : null, blueStart: bl ? bl[1] : null, blueEnd: bl2 ? bl2[1] : null } : null;
}
// The city's own clock (time zone and daylight saving), from Open-Meteo's free time zone lookup, kept with the city.
const gxTzAsked = new Set();
function gxTz(city) {
  if (city.tz) return city.tz;
  const c = gxCenter(city), k = keyOf(city.city);
  if (!c || gxTzAsked.has(k) || (typeof navigator !== "undefined" && navigator.onLine === false)) return null;
  gxTzAsked.add(k);
  fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat.toFixed(3)}&longitude=${c.lng.toFixed(3)}&timezone=auto&forecast_days=1&daily=sunrise`)
    .then(r => r.json()).then(j => { if (j && j.timezone && j.timezone !== "GMT") { try { new Intl.DateTimeFormat("en-US", { timeZone: j.timezone }); city.tz = j.timezone; save(); gxRefresh(); } catch (e) {} } }).catch(() => { setTimeout(() => gxTzAsked.delete(k), 60000); });
  return null;
}
function gxLocalMin(dt, tz) {
  if (!dt) return null;
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(dt);
  return +p.find(x => x.type === "hour").value * 60 + +p.find(x => x.type === "minute").value;
}
function gxLight(d, city) {
  if (!d.date) return null;
  const tz = gxTz(city), c = gxCenter(city); if (!tz || !c) return null;
  const s = gxSun(d.date, c.lat, c.lng); if (!s) return null;
  const m = {}; for (const k in s) m[k] = gxLocalMin(s[k], tz);
  return m;
}
// Where the plan has the traveler at a given time (the stop they're at, or the last one they left).
function gxWhereAt(plan, t) {
  let at = null; for (const it of plan.items) { if (it.time > t) break; if (it.place && isFinite(it.place.lat)) at = it; }
  return at;
}
function gxViewpoints(plan) {
  const pts = gxStopsOf(plan).map(i => i.place), seen = new Set(), keys = [];
  pts.forEach(p => { const k = p.lat.toFixed(2) + "," + p.lng.toFixed(2); if (!seen.has(k) && keys.length < 4) { seen.add(k); keys.push(p); } });
  let all = [], done = true;
  keys.forEach(p => { const v = gxGet("view:" + gxR3(p.lat) + "," + gxR3(p.lng), `/x/near?what=view&lat=${gxR3(p.lat)}&lng=${gxR3(p.lng)}`, { fallback: () => gxNearDirect("view", gxR3(p.lat), gxR3(p.lng)) }); if (v === undefined) done = false; else if (v && v.spots) all = all.concat(v.spots); });
  const uniq = []; all.forEach(v => { if (!uniq.some(u => keyOf(u.name) === keyOf(v.name) || hav(u, v) < 0.05)) uniq.push(v); });
  return { done, spots: uniq.map(v => { const near = pts.slice().sort((a, b) => hav(a, v) - hav(b, v))[0]; return Object.assign({}, v, { near, km: near ? hav(near, v) : 0 }); }).filter(v => v.km <= 1.6).sort((a, b) => (b.wd ? 1 : 0) - (a.wd ? 1 : 0) || a.km - b.km) };
}
function gxLightCard(d, city, plan) {
  if (!d.date) return "";
  const L = gxLight(d, city);
  const vp = freeAI ? gxViewpoints(plan) : { done: true, spots: [] };
  const tips = gxStopsOf(plan).filter(i => i.place.photoTip && !i.place.along).slice(0, 4);
  if (!L && !vp.spots.length && !tips.length) return "";
  let plan2 = "";
  if (L && L.goldPmStart != null && L.sunset != null) {
    const g = L.goldPmStart, endBy = plan.endBy;
    const best = sp => vp.spots.filter(v => sp && hav(v, sp) <= 1.6).sort((a, b) => hav(a, sp) - hav(b, sp))[0];
    if (g >= plan.start && g <= endBy) {
      const at = gxWhereAt(plan, g), here = at && at.place, v = here && best(here);
      plan2 = `<p><b>Golden hour falls inside your day.</b> At ${fmt(g)} you should be ${at.type === "meal" ? "at " + esc(at.meal.label.toLowerCase()) + ", " + esc(here.name) : "at " + esc(here.name)}.${v ? ` The nearest viewpoint on the map is <b>${esc(v.name)}</b>, ${distTxt(hav(v, here))} away: be there by ${fmt(g)} for the warm light, sunset at ${fmt(L.sunset)}.` : ` Keep your camera out between ${fmt(g)} and ${fmt(L.sunset)}.`}</p>`;
    } else if (g > endBy && (d.type === "land" || d.type === "arrival")) {
      const last = gxStopsOf(plan).slice(-1)[0], v = last && best(last.place);
      plan2 = `<p><b>After your day:</b> golden hour starts at ${fmt(g)}, sunset ${fmt(L.sunset)}.${v ? ` Closest viewpoint to your last stop: <b>${esc(v.name)}</b>, ${distTxt(hav(v, last.place))} from ${esc(last.place.name)}.` : ""}</p>`;
    } else if (g > endBy && (d.type === "port" || d.type === "embark")) {
      plan2 = `<p><b>From the ship:</b> you're back aboard by ${fmt(endBy)}; golden hour starts at ${fmt(g)} and the sun sets at ${fmt(L.sunset)}. An open deck facing the town gives the classic sail-away photo.</p>`;
    } else if (L.goldAmEnd != null && L.goldAmEnd > plan.start - 90 && L.sunrise < plan.start) {
      plan2 = `<p><b>Early start?</b> Morning golden hour runs from sunrise at ${fmt(L.sunrise)} to ${fmt(L.goldAmEnd)}, before your day begins at ${fmt(plan.start)}.</p>`;
    }
  }
  const sumLine = L ? `sunset ${fmt(L.sunset)}` : "photo spots";
  return `<details class="more gxcard" data-gx-fold="light" ${gxOpen.has("light") ? "open" : ""}><summary>Golden hour and photo spots · ${esc(sumLine)}</summary><div class="gxin">
    ${L ? `<div class="basics gxsun"><div><b>Sunrise</b><span>${fmt(L.sunrise)}</span></div><div><b>Morning gold</b><span>${fmt(L.sunrise)}–${L.goldAmEnd != null ? fmt(L.goldAmEnd) : "–"}</span></div><div><b>Evening gold</b><span>${L.goldPmStart != null ? fmt(L.goldPmStart) : "–"}–${fmt(L.sunset)}</span></div><div><b>Sunset</b><span>${fmt(L.sunset)}</span></div>${L.blueStart != null ? `<div><b>Blue hour</b><span>${fmt(L.blueStart)}–${L.blueEnd != null ? fmt(L.blueEnd) : "–"}</span></div>` : ""}</div>` : (d.date ? `<p class="ai-note">Finding ${esc(city.city)}'s local time for the sun times…</p>` : "")}
    ${plan2}
    ${vp.spots.length ? `<span class="eyebrow">Viewpoints near your route</span><ul class="gxlist">${vp.spots.slice(0, 5).map(v => `<li><b>${esc(v.name)}</b>${v.local ? ` <small>(${esc(v.local)})</small>` : ""} · ${distTxt(v.km)} from ${esc(v.near.name)}${v.desc ? ` · ${esc(v.desc)}` : ""} · <a href="${gxMapLink(v)}" target="_blank" rel="noopener">Map</a></li>`).join("")}</ul>` : !vp.done ? `<p class="ai-note"><span class="spinner"></span> Looking up viewpoints on the map…</p>` : ""}
    ${tips.length ? `<span class="eyebrow">Photo tips at your stops</span><ul class="gxlist">${tips.map(i => `<li><b>${esc(i.place.name)}:</b> ${esc(i.place.photoTip)}</li>`).join("")}</ul>` : ""}
    <p class="ai-note">Sun times are calculated for ${esc(city.city)}${L ? " on " + esc(fmtDate(d.date)) : ""}. Viewpoints are from OpenStreetMap.</p></div></details>`;
}

// ---------- Local know-how: etiquette, tipping, fair prices, scams (Wikivoyage) ----------
const GX_KH = [["etiquette", "Etiquette"], ["tipping", "Tipping"], ["prices", "Fair prices"], ["scams", "Scams and pickpockets"]];
function gxKnowhow(city) {
  if (!city || !city.city) return undefined;
  const cname = String(city.city).split(",")[0].trim();
  return gxGet("kh:" + keyOf(cname + " " + (city.country || "")), `/x/knowhow?city=${encodeURIComponent(cname)}&country=${encodeURIComponent(city.country || "")}`);
}
function gxKnowCard(city) {
  if (!freeAI) return "";
  const k = gxKnowhow(city);
  const src = k && k.sources ? `<p class="ai-note">From Wikivoyage: ${k.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join(", ")} (CC BY-SA). Check prices locally; they change.</p>` : "";
  let body;
  if (k === undefined) body = `<p class="ai-note"><span class="spinner"></span> Reading the travel guides for ${esc(city.city)}…</p>`;
  else if (!k || k.none) return "";
  else if (k.groups) body = GX_KH.filter(([g]) => (k.groups[g] || []).length).map(([g, l]) => `<span class="eyebrow">${l}</span><ul class="gxlist">${k.groups[g].map(x => `<li>${esc(x.t)}</li>`).join("")}</ul>`).join("");
  else if (k.raw) body = k.raw.map(r => `<details class="more"><summary>${esc(r.src)}</summary><p class="small">${esc(r.text.slice(0, 1400))}${r.text.length > 1400 ? "…" : ""}</p></details>`).join("");
  return `<details class="more gxcard" data-gx-fold="know" ${gxOpen.has("know") ? "open" : ""}><summary>Local know-how: etiquette, tipping, fair prices, scams</summary><div class="gxin">${body}${src}</div></details>`;
}
// A scam or etiquette warning that names this stop (e.g. "pickpockets on the funicular to the castle").
function gxStopWarnings(s, city) {
  const k = freeAI ? gxKnowhow(city) : null; if (!k || !k.groups) return [];
  const words = keyOf(s.name).split(" ").filter(w => w.length > 4 && !/^(church|square|museum|street|palace|park|ancient|temple|cathedral|basilica|monastery)$/.test(w));
  if (!words.length) return [];
  return [...(k.groups.scams || []), ...(k.groups.etiquette || [])].filter(x => { const t = " " + keyOf(x.t) + " "; return words.some(w => t.includes(" " + w + " ")); }).slice(0, 2);
}

// ---------- Ask your guide: real restrooms, water, pharmacies and cash machines nearby ----------
const GX_AMEN = [["toilets", /rest ?room|toilet|bathroom|\bwc\b|lavator|loo\b|washroom|pee\b/i, "Public restrooms"], ["drinking_water", /water|fountain|refill|thirst/i, "Drinking water"], ["pharmacy", /pharmac|chemist|drug ?store|medicine|plaster|band-?aid/i, "Pharmacies"], ["atm", /\batm\b|cash|money machine|bank|withdraw/i, "Cash machines"]];
async function askExtra(site, city, q) {
  const want = GX_AMEN.filter(a => a[1].test(q)); if (!want.length || !freeAI) return "";
  const here = (geoPos && geoState === "on" && geoPos.acc < 500) ? geoPos : site && isFinite(site.lat) ? site : (() => { try { const p = buildPlan(day()); const s = p && gxStopsOf(p)[0]; return s ? s.place : null; } catch (e) { return null; } })();
  if (!here) return "";
  const key = "amen:" + gxR3(here.lat) + "," + gxR3(here.lng);
  let v = gxCache[key] && gxCache[key].v;
  if (!v) { try { const r = await fetch(`${freeAI.url}/x/near?what=amen&lat=${gxR3(here.lat)}&lng=${gxR3(here.lng)}`, { signal: AbortSignal.timeout(20000) }); if (r.ok) v = await r.json(); } catch (e) {}
    if (!v) v = await gxNearDirect("amen", gxR3(here.lat), gxR3(here.lng));
    if (v) { gxCache[key] = { v, t: Date.now() }; gxSaveCache(); } }
  const from = here === geoPos ? "where the traveler is now" : here.name;
  if (!v || !v.places) return `\nNo map data on ${want.map(a => a[2].toLowerCase()).join(" or ")} could be loaded right now: say so, and suggest asking at a café, museum or the ticket desk.`;
  return "\n" + want.map(([kind, , label]) => {
    const list = v.places.filter(p => p.kind === kind && p.access !== "private" && p.access !== "customers").map(p => Object.assign({ km: hav(p, here) }, p)).sort((a, b) => a.km - b.km).slice(0, 3);
    return list.length ? `${label} on OpenStreetMap near ${from} (only mention these): ` + list.map(p => `${p.name || label.replace(/s$/, "").toLowerCase()} ${Math.round(p.km * 1000)} m away${p.fee ? ", fee: " + p.fee : ""}${p.hours ? ", hours: " + p.hours : ""}${p.wheelchair === "yes" ? ", wheelchair accessible" : ""}`).join("; ") + "."
      : `No ${label.toLowerCase()} are mapped within about 700 m of ${from}: say so, and suggest asking at a café, museum or the ticket desk.`;
  }).join("\n");
}

// ---------- Theme tours ----------
// A theme steers which stops are suggested (stronger than an interest) and the angle of "Tell me more" and
// answers. Each stop's link to the theme is written only from its own guide text, and left out when there is none.
const THEMES = [
  ["", "No theme", [], ""],
  ["paul", "Footsteps of Paul", ["paul", "apostle", "bema", "agora", "areopagus", "mars hill", "synagogue", "early christian", "biblical", "bible", "acts of the apostles", "corinth", "ephesus", "philippi", "thessalon", "berea", "basilica"], "Footsteps of the Apostle Paul"],
  ["faith", "Faith and pilgrimage", INTEREST_WORDS.churches.concat(["pilgrim", "saint", "relic", "holy"]), "faith and pilgrimage"],
  ["ancient", "Ancient world and Olympics", ["ancient", "olymp", "stadium", "temple", "agora", "ruins", "archaeolog", "acropolis", "theatre", "theater", "forum", "amphitheat", "roman", "greek", "classical"], "the ancient world and the Olympic Games"],
  ["royal", "Kings, castles and palaces", ["castle", "palace", "royal", "king", "queen", "fortress", "throne", "citadel", "emperor"], "kings, castles and palaces"],
  ["art", "Art and artists", INTEREST_WORDS.art.concat(["sculpt", "fresco", "mosaic", "artist"]), "art and artists"],
  ["food", "Food history", ["market", "food", "tapas", "wine", "cheese", "bakery", "olive", "coffee", "spice", "tavern", "cuisine", "harvest", "trade"], "food history"],
  ["film", "Film and TV locations", ["film", "movie", "cinema", "studio"], "film and TV locations"]
];
const themeOf = () => THEMES.find(t => t[0] === (P().theme || "")) || THEMES[0];
// Interest words for choosing stops: the trip's interests, plus its theme counted three times over.
function interestWords() {
  const base = ((trip.prefs && trip.prefs.interests) || []).map(x => INTEREST_WORDS[x] || []).flat(), th = themeOf()[2];
  return th.length ? base.concat(th, th, th) : base;
}
const themeNote = () => { const t = themeOf(); return t[0] ? ` The traveler is on a "${t[1]}" theme tour: where well-established facts allow, connect the place to ${t[3]}; never invent a connection.` : ""; };
function themeField() {
  const cur = P().theme || "";
  return `<div class="field"><label for="p-theme">Theme tour</label><select id="p-theme" data-gx-theme>${THEMES.map(([k, l]) => `<option value="${k}" ${k === cur ? "selected" : ""}>${esc(l)}</option>`).join("")}</select><span class="hint">Suggested stops and the guide's stories follow the theme. Tap "Suggest my tour" on a day to re-plan around it.</span></div>`;
}
const gxFits = s => { const w = themeOf()[2]; const t = ((s.category || "") + " " + (s.name || "") + " " + (s.summary || "")).toLowerCase(); return w.some(x => t.includes(x)); };
function gxThemeLink(s, city) {
  const t = themeOf(); if (!t[0] || !freeAI || !s.guide || t[0] === "film") return null;
  const v = gxGet("th:" + t[0] + ":" + keyOf(city.city) + ":" + s.id, "/x/write", { body: { kind: "theme", text: [s.summary, s.guide].filter(Boolean).join("\n").slice(0, 3000), name: s.name, theme: t[1] } });
  // A Bible link the stop's own guide doesn't carry is never shown (the never-invent rule).
  if (v && v.text && BIBLE_TALK.test(v.text) && !bibleSite(s)) return null;
  return v && v.text ? v.text : v === undefined && gxFits(s) ? "" : null;
}
// Film and TV: real filming locations from Wikidata, near each stop.
function gxFilm(p) { return gxGet("film:" + gxR3(p.lat) + "," + gxR3(p.lng), `/x/film?lat=${gxR3(p.lat)}&lng=${gxR3(p.lng)}`); }
function gxFilmAt(s) {
  if (!freeAI || !isFinite(s.lat)) return [];
  const v = gxFilm(s); if (!v || !v.places) return [];
  return v.places.filter(f => hav(f, s) <= 0.25 || keyOf(f.name).includes(keyOf(s.name)) || keyOf(s.name).includes(keyOf(f.name))).flatMap(f => f.works).slice(0, 4);
}
function gxThemeCard(d, city, plan) {
  const t = themeOf(); if (!t[0]) return "";
  const stops = gxStopsOf(plan).filter(i => !i.place.along).map(i => i.place);
  let body = "";
  if (t[0] === "film") {
    if (!freeAI) return "";
    const seen = new Set(), rows = []; let waiting = false;
    stops.forEach(s => { const v = gxFilm(s); if (v === undefined) waiting = true; ((v && v.places) || []).forEach(f => { if (seen.has(f.wd) || hav(f, s) > 1.2) return; seen.add(f.wd); rows.push(Object.assign({ near: s, km: hav(f, s) }, f)); }); });
    rows.sort((a, b) => a.km - b.km);
    body = rows.length ? `<ul class="gxlist">${rows.slice(0, 8).map(f => `<li><b>${esc(f.name)}</b> · ${f.works.slice(0, 3).map(w => esc(w.title) + (w.year ? " (" + w.year + ")" : "")).join(", ")} · ${f.km < 0.1 ? "at " + esc(f.near.name) : distTxt(f.km) + " from " + esc(f.near.name)} · <a href="${gxMapLink(f)}" target="_blank" rel="noopener">Map</a></li>`).join("")}</ul><p class="ai-note">Filming locations from Wikidata.</p>`
      : waiting ? `<p class="ai-note"><span class="spinner"></span> Looking up film and TV locations near your stops…</p>` : `<p class="lede small">No filming locations are recorded near today's stops.</p>`;
  } else {
    const fit = stops.filter(gxFits);
    body = `<p class="lede small">${fit.length ? `Today's stops that fit: <b>${fit.map(s => esc(s.name)).join(", ")}</b>. Open each one in the guide to hear how it connects.` : `None of today's stops is a clear fit. Tap "Suggest my tour" to re-plan the day around the theme.`}</p>`;
  }
  return `<details class="more gxcard" data-gx-fold="theme" ${gxOpen.has("theme") ? "open" : ""}><summary>Theme: ${esc(t[1])}</summary><div class="gxin">${body}</div></details>`;
}

// ---------- Kids mode ----------
// Each stop gets a shorter, fun version of its story for children (written only from the stop's own story),
// and the tour's "Can you find these?" becomes a treasure hunt: find them all to earn the stop's badge.
const kidsOn = () => P().kids === "on";
function kidsField() {
  const on = kidsOn();
  return `<div class="field"><span class="lbl">Kids mode</span><div class="seg" role="group"><button type="button" data-gx-kids="on" aria-pressed="${on}">On</button><button type="button" data-gx-kids="off" aria-pressed="${!on}">Off</button></div><span class="hint">Short, fun stories for children and a treasure hunt with badges at every stop.</span></div>`;
}
function gxKidsStory(s, city) {
  if (!freeAI || !s.guide) return undefined;
  return gxGet("kids:" + keyOf(city.city) + ":" + s.id, "/x/write", { body: { kind: "kids", text: s.guide.slice(0, 3000), name: s.name } });
}
const gxBadges = () => (trip.badges = trip.badges || {});
function gxKidsBlock(s, city, inTour) {
  if (!kidsOn()) return "";
  const v = gxKidsStory(s, city), b = gxBadges()[jKey(s)], n = (s.lookFor || []).length;
  const story = v && v.text ? `<p class="gxkids">${esc(v.text)}</p><div class="audio"><button class="btn ghost small" data-gx-kidplay="${esc(s.id)}">${speakingId === "kids:" + s.id ? "■ Stop" : "▶ Play the kids' story"}</button></div>`
    : v === undefined && freeAI ? `<p class="ai-note"><span class="spinner"></span> Writing the kids' story…</p>` : "";
  const hunt = n ? (b ? `<p class="banner ok">🏅 Badge earned: <b>${esc(s.name)} explorer</b></p>` : `<p class="lede small">🔎 Treasure hunt: ${inTour ? `find all ${n} things in "Can you find these?" to earn the ${esc(s.name)} badge.` : `on the tour, find all ${n} things to look for here and earn the ${esc(s.name)} badge.`}</p>`) : "";
  if (!story && !hunt) return "";
  return `<div class="field gxkidsbox"><span class="eyebrow">For the kids</span>${story}${hunt}</div>`;
}
function gxBadgeShelf() {
  const all = Object.values(trip.badges || {}); if (!all.length && !kidsOn()) return "";
  return `<div class="card"><span class="eyebrow">Explorer badges</span>${all.length ? `<div class="gxbadges">${all.sort((a, b) => (a.at || 0) - (b.at || 0)).map(b => `<span class="gxbadge" title="${esc(fmtDate(b.date))}">🏅 ${esc(b.name)}</span>`).join("")}</div>` : `<p class="lede small">Find everything on a stop's treasure hunt during the tour to earn its badge.</p>`}</div>`;
}
// After the tour's own "found it" tap: award the badge when every item at the stop is found.
function gxCheckBadge() {
  const T = trip.tour; if (!T || !kidsOn()) return;
  let st = null; try { st = tourSteps(buildPlan(day()))[T.i]; } catch (e) {}
  const s = st && st.type === "stop" ? st.place : null; if (!s || !(s.lookFor || []).length) return;
  const found = (T.found || []).length, k = jKey(s), B = gxBadges();
  if (found >= s.lookFor.length && !B[k]) { B[k] = { name: s.name + " explorer", date: day().date, at: Date.now() }; save(); renderGuideOnly(); try { if (navigator.vibrate) navigator.vibrate([60, 40, 120]); } catch (e) {} }
}

// ---------- Before you arrive: the story of each city ----------
// About two and a half minutes, written only from the city's checked guide (its stops' stories) and Wikivoyage's
// "Understand" section. Shown on the first day in each city; it plays offline once made.
function gxPrimerSource(city) {
  const voy = gxGet("voy:" + keyOf(city.city), "/voyage?city=" + encodeURIComponent(String(city.city).split(",")[0]));
  if (voy === undefined) return undefined;
  const sites = (city.sites || []).slice().sort((a, b) => (b.mustSee ? 1 : 0) - (a.mustSee ? 1 : 0)).slice(0, 10);
  const parts = [voy && voy.understand ? "About the city (Wikivoyage): " + voy.understand : ""].concat(sites.map(s => `${s.name}: ${s.summary || ""} ${String(s.guide || "").split(/(?<=\.)\s+/).slice(0, 3).join(" ")}`));
  return parts.filter(Boolean).join("\n").slice(0, 9000);
}
function gxPrimer(city) {
  if (!freeAI) return null;
  if (city.primer && city.primer.text) return city.primer;
  const src = gxPrimerSource(city); if (src === undefined) return undefined; if (src.length < 300) return null;
  const v = gxGet("primer:" + keyOf(city.city), "/x/write", { body: { kind: "primer", text: src, name: city.city } });
  if (v && v.text) { city.primer = { text: v.text }; save(); return city.primer; }
  return v;
}
function gxPrimerCard(d, city) {
  const i = trip.days.indexOf(d), k = cityKeyFor(d);
  if (trip.days.slice(0, i).some(o => cityKeyFor(o) === k && o.type !== "sea")) return "";
  const pr = gxPrimer(city); if (pr === null) return "";
  const id = "primer:" + keyOf(city.city);
  return `<details class="more gxcard" data-gx-fold="primer" ${gxOpen.has("primer") ? "open" : ""}><summary>Before you arrive: the story of ${esc(String(city.city).split(",")[0])}</summary><div class="gxin">
    ${pr && pr.text ? `<div class="audio"><button class="btn small" data-gx-primer="${esc(keyOf(city.city))}">${speakingId === id ? "■ Stop" : "▶ Listen · about " + Math.max(1, Math.round(pr.text.split(/\s+/).length / 150)) + " min"}</button><span class="hint">Best the evening before, on the plane, train or ship.</span></div><div class="guidetext">${paras(pr.text)}</div><p class="ai-note">Told from Kairoute's checked guide to ${esc(city.city)} and Wikivoyage.</p>`
      : `<p class="ai-note"><span class="spinner"></span> Your guide is writing the story of ${esc(city.city)}…</p>`}</div></details>`;
}

// ---------- Ship's tour vs Kairoute (savings) ----------
// The traveler types the ship's (or tour company's) price for the tour they'd otherwise buy, from their cruise
// planner. Kairoute's side is the day's own estimated tickets and rides. No made-up price is ever shown.
function gxSavings(d, plan) {
  const price = +d.shipPrice; if (!(price > 0)) return null;
  const b = planBudget(plan), party = b.party, ship = Math.round(price * party), own = b.entry + b.move;
  return { ship, own, save: ship - own, sym: d.shipSym || b.sym, party };
}
function gxSaveCard(d, city, plan) {
  if (d.type !== "port" && d.type !== "embark" && !d.shipPrice) return "";
  const s = gxSavings(d, plan), b = planBudget(plan);
  const trips = trip.days.map(o => { if (o === d || !o.shipPrice) return o === d ? s : null; const c = cityFor(o); if (!c) return null; try { const p = buildPlan(o); return p && !p.error ? gxSavings(o, p) : null; } catch (e) { return null; } }).filter(Boolean);
  const total = trips.reduce((a, x) => a + x.save, 0);
  return `<details class="more gxcard" data-gx-fold="save" ${gxOpen.has("save") ? "open" : ""}><summary>Ship's tour vs Kairoute${s && s.save > 0 ? ` · save about ${money(s.sym, s.save)}` : ""}</summary><div class="gxin">
    <form class="ask gxprice" data-gx-price="${esc(d.id)}"><label for="gx-price-${esc(d.id)}" class="lbl">The ship's tour price per person (from your cruise planner)</label><span class="gxpricerow"><input type="number" inputmode="decimal" min="0" step="1" id="gx-price-${esc(d.id)}" value="${d.shipPrice ? esc(d.shipPrice) : ""}" placeholder="e.g. 189"><select id="gx-sym-${esc(d.id)}" aria-label="Currency">${["$", "€", "£", b.sym].filter((x, i, a) => a.indexOf(x) === i).map(x => `<option ${x === (d.shipSym || "$") ? "selected" : ""}>${esc(x)}</option>`).join("")}</select><button class="btn small" type="submit">Compare</button></span></form>
    ${s ? `<div class="basics"><div><b>Ship's tour</b><span>${money(s.sym, s.ship)} for ${s.party}</span></div><div><b>Your Kairoute day</b><span>about ${money(s.sym, s.own)} in tickets and rides</span></div><div><b>You keep</b><span>${s.save > 0 ? "about " + money(s.sym, s.save) : "no saving today"}</span></div></div>
      ${trips.length > 1 ? `<p class="lede small">Across the ${trips.length} days you compared: about <b>${money(s.sym, total)}</b> saved.</p>` : ""}
      <p class="ai-note">Tickets and rides are Kairoute's estimate for ${s.party} ${s.party === 1 ? "person" : "people"}, before meals${s.sym !== b.sym ? ` (shown in ${esc(s.sym)}; the estimate is in ${esc(b.sym)})` : ""}. Plus your Kairoute pass.</p>` : `<p class="lede small">Type the price of the ship's tour you'd take instead and see what you keep by touring with Kairoute.</p>`}
  </div></details>`;
}

// ---------- All the Day plan extras, in one compact group ----------
function gxPlanCards(d, city, plan) {
  try { return [gxPrimerCard(d, city), gxThemeCard(d, city, plan), gxLightCard(d, city, plan), gxSaveCard(d, city, plan), gxKnowCard(city)].join(""); }
  catch (e) { return ""; }
}
// On a stop (Guide tab and tour): kids' story and hunt, theme link, filmed here, and warnings that name the stop.
function gxStopExtras(s, city, inTour) {
  try {
    const link = gxThemeLink(s, city), film = themeOf()[0] === "film" ? gxFilmAt(s) : [], warn = gxStopWarnings(s, city);
    return `${gxKidsBlock(s, city, inTour)}
      ${link ? `<p class="gxtheme"><b>${esc(themeOf()[1])}:</b> ${esc(link)}</p>` : link === "" ? `<p class="ai-note"><span class="spinner"></span> Linking this stop to your theme…</p>` : ""}
      ${film.length ? `<p class="gxtheme"><b>Filmed here:</b> ${film.map(w => esc(w.title) + (w.year ? " (" + w.year + ")" : "")).join(", ")}</p>` : ""}
      ${warn.length ? `<p class="banner warn gxwarn">${warn.map(x => esc(x.t)).join(" ")}</p>` : ""}`;
  } catch (e) { return ""; }
}

// ---------- Trip storybook (PDF) ----------
// A keepsake book made on this device: a cover, then each day with its route, your photos (or the place's own
// Wikipedia photo), your stars and notes, and the guide's story of each stop. Printed books come later.
let gxBook = { busy: false, msg: "", err: "" };
function gxBookCard() {
  const days = trip.days.filter(d => d.type !== "sea" && cityFor(d)).length; if (!days) return "";
  return `<div class="card"><span class="eyebrow">Trip storybook</span><h3>Your trip as a photo book</h3>
    <p class="lede">A PDF book of your trip: every day's route, your photos and notes, your stars, and the story of each place. Save it, share it, or print it at home.</p>
    ${gxBook.busy ? `<p><span class="spinner"></span> ${esc(gxBook.msg || "Making your book…")}</p>` : `<div class="actions"><button class="btn" data-gx-book="1">Make my storybook</button></div>`}
    ${gxBook.err ? `<p class="banner warn">${esc(gxBook.err)}</p>` : ""}<p class="ai-note">Printed, bound books are coming in a later version.</p></div>`;
}
async function gxImgData(src, maxW) {
  const im = typeof src === "string" ? await loadImg(src) : src; if (!im) return null;
  try { const sc = Math.min(1, (maxW || 900) / im.width), c = document.createElement("canvas"); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); return { d: c.toDataURL("image/jpeg", 0.8), w: c.width, h: c.height }; } catch (e) { return null; }
}
async function gxMakeBook() {
  const J = window.jspdf && window.jspdf.jsPDF;
  if (!J) { gxBook.err = "The book maker couldn't load. Check your connection and try again."; render(); return; }
  gxBook = { busy: true, msg: "Gathering your days…", err: "" }; render();
  try {
    const doc = new J({ unit: "pt", format: "letter" }), W = 612, H = 792, M = 54, CW = W - 2 * M;
    const clean = t => String(t || "").normalize("NFC").replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "...").replace(/[^\x20-\xFF\n]/g, "");
    let y = M;
    const page = () => { doc.addPage(); y = M; };
    const need = h => { if (y + h > H - M) page(); };
    const text = (t, size, style, color, gap) => { doc.setFont("helvetica", style || "normal"); doc.setFontSize(size); doc.setTextColor(...(color || [30, 40, 40])); doc.splitTextToSize(clean(t), CW).forEach(r => { need(size * 1.4); doc.text(r, M, y + size); y += size * 1.4; }); y += gap || 0; };
    const img = (im, maxH) => { if (!im) return; let w = CW, h = im.h * w / im.w; if (h > maxH) { h = maxH; w = im.w * h / im.h; } need(h + 8); doc.addImage(im.d, "JPEG", M + (CW - w) / 2, y, w, h); y += h + 10; };
    // Cover
    doc.setFillColor(18, 60, 58); doc.rect(0, 0, W, H, "F");
    const logo = await gxImgData("icons/web-512.png", 400); if (logo) doc.addImage(logo.d, "JPEG", W / 2 - 60, 150, 120, 120);
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(30);
    doc.splitTextToSize(clean(trip.name || tripName(trip)), CW).forEach((r, i) => doc.text(r, W / 2, 330 + i * 36, { align: "center" }));
    const dated = trip.days.filter(d => d.date); doc.setFont("helvetica", "normal"); doc.setFontSize(14);
    if (dated.length) doc.text(clean(fmtDate(dated[0].date) + " - " + fmtDate(dated[dated.length - 1].date)), W / 2, 420, { align: "center" });
    doc.setFontSize(11); doc.text("A trip to remember, with Kairoute", W / 2, H - 70, { align: "center" });
    let stopsSeen = 0, km = 0, saved = 0, sym = "";
    for (let i = 0; i < trip.days.length; i++) {
      const d = trip.days[i], city = cityFor(d); if (d.type === "sea" || !city) continue;
      gxBook.msg = `Day ${i + 1} of ${trip.days.length}: ${d.destination}`; render();
      refillIfNeeded(d, city); if (!d.selected) d.selected = defaultSelection(city, trip.style, d);
      const plan = buildPlan(d); if (!plan || plan.error) continue;
      page(); km += plan.walkKm || 0; const sv = gxSavings(d, plan); if (sv && sv.save > 0) { saved += sv.save; sym = sv.sym; }
      text(`Day ${i + 1} · ${fmtDow(d.date)} ${fmtDate(d.date)}`, 11, "normal", [120, 130, 130]);
      text(d.title && d.title.trim() ? d.title.trim() : d.destination, 24, "bold", [18, 60, 58], 4);
      text(plan.items.filter(it => it.type === "stop" && !it.place.along || it.type === "meal").map(it => fmt(it.time) + "  " + (it.type === "meal" ? it.meal.label + ": " + it.place.name : it.place.name)).join("\n"), 10, "normal", [70, 80, 80], 10);
      for (const it of gxStopsOf(plan).filter(x => !x.place.along)) {
        const s = it.place, j = (trip.journal || {})[(cityKeyFor(d) || "x") + "/" + s.id] || {}; stopsSeen++;
        need(120); text(s.name, 15, "bold", [18, 60, 58]);
        if (j.rating) text("★".repeat(j.rating).replace(/★/g, "*") + "  " + ["", "Not for us", "OK", "Good", "Great", "Unforgettable"][j.rating], 10, "bold", [200, 120, 40]);
        const photos = (j.photos || []).slice(0, 2);
        if (photos.length) for (const p of photos) img(await gxImgData(p, 1000), 230);
        else { const ph = await spotPhoto(s).catch(() => null); if (ph) { img(await gxImgData(ph, 1000), 200); text("Photo: Wikipedia", 7, "italic", [140, 140, 140], 2); } }
        if (j.note) text("“" + j.note + "”", 11, "italic", [60, 60, 60], 4);
        const story = String(s.guide || s.summary || "").split(/\n\s*\n/)[0];
        if (story) text(story.length > 900 ? story.slice(0, story.lastIndexOf(". ", 900) + 1) : story, 10, "normal", [40, 50, 50], 4);
        const badge = (trip.badges || {})[jKey(s)]; if (badge) text("Badge earned: " + badge.name, 9, "bold", [18, 120, 90], 2);
        y += 8;
      }
    }
    page(); text("The trip in numbers", 22, "bold", [18, 60, 58], 8);
    text(`${stopsSeen} places · about ${distTxt(km)} on foot · ${trip.days.filter(d => d.type !== "sea").length} days`, 13, "normal", null, 6);
    if (saved > 0) text(`Saved about ${money(sym, saved)} compared with the ship's tours.`, 13, "normal", null, 6);
    const badges = Object.values(trip.badges || {}); if (badges.length) text("Explorer badges: " + badges.map(b => b.name).join(", "), 11, "normal", null, 6);
    text("Made with Kairoute. Stories are from Kairoute's checked city guides; photos are yours unless marked.", 9, "italic", [120, 120, 120]);
    const blob = doc.output("blob"), name = (trip.name || "trip").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") + "-storybook.pdf";
    const dl = cl && cl.use ? await cl.use("downloads").catch(() => null) : null;
    if (dl) await dl.save({ filename: name, data: blob });
    else { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
    gxBook = { busy: false, msg: "", err: "" };
  } catch (e) { gxBook = { busy: false, msg: "", err: "The storybook couldn't be made just now. Try again." }; }
  render();
}

// ---------- Taps and form entries for the extras ----------
if (typeof document !== "undefined") {
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-gx-kids],[data-gx-kidplay],[data-gx-primer],[data-gx-book],[data-find]"); if (!t) return;
    if (t.dataset.find != null) { setTimeout(gxCheckBadge, 0); return; } // the tour's own handler records the find first
    if (t.dataset.gxKids) { trip.prefs = Object.assign(defaultPrefs(), trip.prefs || {}, { kids: t.dataset.gxKids }); save(); render(); return; }
    if (t.dataset.gxKidplay) { const city = cityFor(day()), s = allSites(city).find(x => x.id === t.dataset.gxKidplay), v = s && gxKidsStory(s, city); if (v && v.text) { speakText("kids:" + s.id, v.text); renderGuideOnly(); } return; }
    if (t.dataset.gxPrimer) { const city = Object.values(cities).find(c => c && keyOf(c.city) === t.dataset.gxPrimer); if (city && city.primer) { speakText("primer:" + keyOf(city.city), city.primer.text); render(); } return; }
    if (t.dataset.gxBook) { if (!gxBook.busy) gxMakeBook(); }
  });
  document.addEventListener("change", e => {
    const t = e.target; if (!t || !t.matches) return;
    if (t.matches("[data-gx-theme]")) { trip.prefs = Object.assign(defaultPrefs(), trip.prefs || {}, { theme: t.value }); save(); render(); }
  });
  document.addEventListener("submit", e => {
    const f = e.target; if (!f || !f.dataset || !f.dataset.gxPrice) return;
    const d = trip.days.find(x => x.id === f.dataset.gxPrice); if (!d) return;
    const v = parseFloat((document.getElementById("gx-price-" + d.id) || {}).value); d.shipPrice = v > 0 ? Math.round(v * 100) / 100 : ""; d.shipSym = (document.getElementById("gx-sym-" + d.id) || {}).value || "$";
    save(); render();
  });
  // Remember which extras are open while the screen redraws.
  document.addEventListener("toggle", e => { const el = e.target; if (el && el.dataset && el.dataset.gxFold) { if (el.open) gxOpen.add(el.dataset.gxFold); else gxOpen.delete(el.dataset.gxFold); } }, true);
}
const gxOpen = new Set();
if (typeof window !== "undefined") window.__kairouteExtras = { gxNearDirect, gxSun, gxLocalMin, interestWords, themeOf, gxSavings, askExtra, THEMES };
