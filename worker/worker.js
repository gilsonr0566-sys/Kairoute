import { extras, Group } from "./extras.js";
import { allOptions, ferriesNear } from "./transit.js";
export { Group };
// Kairoute AI helper. The website sends a prompt (and optional photos); this Worker asks Workers AI
// and streams the answer back. Usage is counted from real token counts. On the free plan it stays inside
// Cloudflare's free allowance; on Workers Paid a monthly ceiling (about $5 extra) is the hard stop.
const MODEL = "@cf/google/gemma-4-26b-a4b-it";
// Gemma 4 26B costs about 9,091 neurons per million input tokens and 27,273 per million output tokens.
// The free allowance is 10,000 neurons a day; we stop at 9,700 (usage is counted from the real token counts, so this stays inside it).
const FREE_DAILY = 8500; // leaves 1,500 of the account-wide 10,000 for Richard's other app (light use)
// On Cloudflare's Workers Paid plan (set PAID = "1" in wrangler.toml), Kairoute may go past the free share,
// up to a monthly ceiling: 450,000 extra neurons is about $5, so the plan plus extras stays near $10 a month.
// The monthly ceiling is the real guard. Each day may use up to 3x its fair share of what is left this month,
// so a busy travel day has plenty, and the share shrinks by itself if earlier days ran heavy.
// Test tools (header x-kairoute-lab: 1) have their own small daily pool and never use travelers' allowance.
const MONTH_EXTRA = 450000, DAY_SHARE_X = 3, LAB_DAILY = 30000;
const IN_RATE = 9091 / 1e6, OUT_RATE = 27273 / 1e6;
const ALLOWED = [/^https:\/\/gilsonr0566-sys\.github\.io$/, /^https?:\/\/localhost(:\d+)?$/, /^capacitor:\/\/localhost$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/, /\.claudeusercontent\.com$/, /^https:\/\/claude\.ai$/];
// Natural guide voice (Deepgram Aura 1): about 1,364 neurons per 1,000 characters. Each stop's audio
// is made once and kept, so replaying it, or any traveler hearing the same stop, costs nothing.
const VOICE_MODEL = "@cf/deepgram/aura-1", VOICE_RATE = 1363.64 / 1000, FREE_VOICE = 3500;
const SPEAKERS = { buttery: "hera", airy: "luna", glassy: "asteria", rounded: "orion" };
const AURA1 = "angus asteria arcas orion orpheus athena luna zeus perseus helios hera stella".split(" ");
const AURA2 = "amalthea andromeda apollo arcas aries asteria athena atlas aurora callista cora cordelia delia draco electra harmonia helena hera hermes hyperion iris janus juno jupiter luna mars minerva neptune odysseus ophelia orion orpheus pandora phoebe pluto saturn thalia theia vesta zeus".split(" ");
const VOICE_MODELS = { "aura-1": { id: "@cf/deepgram/aura-1", rate: 1363.64 / 1000, speakers: AURA1 }, "aura-2": { id: "@cf/deepgram/aura-2-en", rate: 2727.27 / 1000, speakers: AURA2 } };
function voiceChoice(b) { const m = VOICE_MODELS[b.model] ? b.model : "aura-1", vm = VOICE_MODELS[m]; const sp = vm.speakers.includes(b.speaker) ? b.speaker : (SPEAKERS[b.voice] || "hera"); return { m, vm, sp: vm.speakers.includes(sp) ? sp : vm.speakers[0] }; }
async function sha(t) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }
const MAX_OUT = { quick: 1200, part: 8000, default: 14000, complex: 16000 };

function cors(origin) {
  const ok = origin && ALLOWED.some(r => r.test(origin));
  return { "Access-Control-Allow-Origin": ok ? origin : "https://gilsonr0566-sys.github.io", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "content-type", "Vary": "Origin" };
}
const today = () => new Date().toISOString().slice(0, 10);
async function used(env) { return +(await env.USAGE.get("n:" + today())) || 0; }
const month = () => new Date().toISOString().slice(0, 7);
async function addUse(env, n, lab) {
  // Running totals for the owner's Usage & cost page: everything this month, and each day (kept 40 days).
  const tm = "nm:" + month(), td = "nd:" + today(); const [a, b2] = await Promise.all([env.USAGE.get(tm), env.USAGE.get(td)]);
  await Promise.all([env.USAGE.put(tm, String(+((+a || 0) + n).toFixed(1)), { expirationTtl: 40 * 86400 }), env.USAGE.put(td, String(+((+b2 || 0) + n).toFixed(1)), { expirationTtl: 40 * 86400 })]);
  if (lab) {
    const tk = "t:" + today(), mk = "x:" + month(); const t = +(await env.USAGE.get(tk)) || 0, m = +(await env.USAGE.get(mk)) || 0;
    await env.USAGE.put(tk, String(+(t + n).toFixed(1)), { expirationTtl: 3 * 86400 });
    await env.USAGE.put(mk, String(+(m + n).toFixed(1)), { expirationTtl: 40 * 86400 }); return;
  }
  const k = "n:" + today(); const cur = +(await env.USAGE.get(k)) || 0, nxt = cur + n;
  await env.USAGE.put(k, String(+nxt.toFixed(3)), { expirationTtl: 3 * 86400 });
  const extra = Math.max(0, nxt - FREE_DAILY) - Math.max(0, cur - FREE_DAILY);
  if (extra > 0) { const mk = "x:" + month(); const m = +(await env.USAGE.get(mk)) || 0; await env.USAGE.put(mk, String(+(m + extra).toFixed(1)), { expirationTtl: 40 * 86400 }); }
}
async function limits(env) {
  if (env.PAID !== "1") return { DAILY_NEURONS: FREE_DAILY, VOICE_DAILY: FREE_VOICE, LAB_LEFT: 0 };
  const monthUsed = +(await env.USAGE.get("x:" + month())) || 0, left = Math.max(0, MONTH_EXTRA - monthUsed);
  const u = await used(env), todayExtra = Math.max(0, u - FREE_DAILY), labToday = +(await env.USAGE.get("t:" + today())) || 0;
  const d = new Date(), dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(), daysLeft = dim - d.getUTCDate() + 1;
  // share is based on what was left when today began (today's own use and lab use added back), but never past the monthly ceiling
  const share = Math.min(left + todayExtra, (left + todayExtra + labToday) / daysLeft * DAY_SHARE_X);
  const daily = FREE_DAILY + share;
  // Paid voice is paused (Richard, Nov 11: no paid audio until the guide content is locked down). New voice
  // recordings then stay inside the free daily allowance; set VOICE_PAID = "1" to turn paid voice back on.
  if (env.VOICE_PAID !== "1") return { DAILY_NEURONS: daily, VOICE_DAILY: Math.min(daily, FREE_VOICE), VOICE_TOTAL: FREE_DAILY, LAB_LEFT: 0 };
  return { DAILY_NEURONS: daily, VOICE_DAILY: daily, LAB_LEFT: Math.max(0, Math.min(LAB_DAILY - labToday, left)) };
}

// Places whose ferries couldn't be looked up while every free map server was busy (fq: keys, see ferriesNear in
// transit.js) are asked again on the helper's schedule, a few at a time with long waits, so a ferry is never hidden
// for long. A place still unanswered stays listed (for 14 days) and is tried again next time.
async function fillFerries(env) {
  const store = { get: k => env.USAGE.get(k, "json"), put: (k, v, ttl) => env.USAGE.put(k, JSON.stringify(v), { expirationTtl: ttl }) };
  const l = await env.USAGE.list({ prefix: "fq:", limit: 12 });
  for (const { name } of l.keys) { const [lat, lng] = name.slice(3).split(",").map(Number); if (!isFinite(lat) || !isFinite(lng)) { await env.USAGE.delete(name); continue; }
    try { await ferriesNear({ lat, lng }, store, 45000); await env.USAGE.delete(name); } catch (e) {} }
}

export default {
  async scheduled(ev, env, ctx) { ctx.waitUntil(fillFerries(env)); },
  async fetch(req, env, ctx) {
    const origin = req.headers.get("Origin") || "", h = cors(origin);
    if (req.method === "OPTIONS") return new Response(null, { headers: h });
    const url = new URL(req.url);
    const { DAILY_NEURONS, VOICE_DAILY, LAB_LEFT, VOICE_TOTAL = DAILY_NEURONS } = await limits(env), lab = req.headers.get("x-kairoute-lab") === "1";
    // Guide extras (viewpoints, restrooms, local know-how, kids' stories, city primers, theme links, film locations, group tours): see extras.js.
    if (url.pathname.startsWith("/x/")) return extras(req, env, ctx, url, h, { origin, ALLOWED, MODEL, IN_RATE, OUT_RATE, DAILY_NEURONS, used, addUse, sha });
    // /usage: the numbers behind the owner's "Usage & cost" page. Counts only, nothing about travelers.
    if (url.pathname === "/usage") {
      const g = k => env.USAGE.get(k).then(v => +v || 0), d0 = new Date(), days = [];
      for (let i = 13; i >= 0; i--) { const x = new Date(d0.getTime() - i * 86400000).toISOString().slice(0, 10); days.push(x); }
      const [aiToday, aiMonth, extraMonth, labToday, voiceToday, gDay, gMonth, ...hist] = await Promise.all([used(env), g("nm:" + month()), g("x:" + month()), g("t:" + today()), g("v:" + today()), g("gqd:" + today()), g("gqm:" + month()), ...days.map(x => g("nd:" + x))]);
      return Response.json({ at: new Date().toISOString(), month: month(), paid: env.PAID === "1",
        ai: { today: Math.round(aiToday), freeShare: FREE_DAILY, limitToday: Math.round(DAILY_NEURONS), month: Math.round(aiMonth), extraMonth: Math.round(extraMonth), extraCap: MONTH_EXTRA, usdPer1000: 0.011 },
        voice: { today: Math.round(voiceToday), freeDaily: FREE_VOICE, paidOn: env.VOICE_PAID === "1" }, lab: { today: Math.round(labToday), daily: LAB_DAILY },
        google: { today: gDay, month: gMonth, cap: 900, free: 1000, usdEach: 0.035, keyOn: !!env.GPLACES_KEY },
        history: days.map((x, i) => ({ date: x, neurons: Math.round(hist[i]) })) }, { headers: { ...h, "cache-control": "no-store" } });
    }
    if (url.pathname === "/status") { const u = await used(env); const vu = +(await env.USAGE.get("v:" + today())) || 0; return Response.json({ ok: true, model: MODEL, usedToday: Math.round(u), budget: DAILY_NEURONS, left: Math.max(0, Math.floor(DAILY_NEURONS - u)), voiceLeft: Math.max(0, Math.floor(Math.min(VOICE_DAILY - vu, VOICE_TOTAL - u))), labLeft: Math.floor(LAB_LEFT), monthExtraUsed: Math.round(+(await env.USAGE.get("x:" + month())) || 0), monthExtraCap: MONTH_EXTRA, labToday: Math.round(+(await env.USAGE.get("t:" + today())) || 0) }, { headers: h }); }
    // Real places from OpenStreetMap, so the app never sends anyone to a place the AI made up.
    // /places: restaurants and cafés around given points. /verify: finds each named sight on the map.
    if (url.pathname === "/places" && req.method === "POST") {
      if (origin && !ALLOWED.some(r => r.test(origin))) return Response.json({ error: "Not allowed" }, { status: 403, headers: h });
      let b; try { b = await req.json(); } catch (e) { return Response.json({ error: "Bad request" }, { status: 400, headers: h }); }
      const pts = (Array.isArray(b.pts) ? b.pts : []).map(p => [+(+p.lat).toFixed(3), +(+p.lng).toFixed(3)]).filter(p => isFinite(p[0]) && isFinite(p[1])).slice(0, 16);
      const r = Math.min(1500, Math.max(200, +b.r || 700));
      if (!pts.length) return Response.json({ places: [] }, { headers: h });
      const key = "p2:" + r + ":" + (await sha(JSON.stringify(pts)));
      const hit = await env.USAGE.get(key); if (hit) return new Response(hit, { headers: { ...h, "content-type": "application/json" } });
      const q = `[out:json][timeout:25];(${pts.map(([la, ln]) => `nwr["amenity"~"^(restaurant|cafe|fast_food|pub|bar|food_court)$"]["name"](around:${r},${la},${ln});`).join("")});out center tags 600;`;
      // First choice: Photon (map search near each point), which answers quickly. Then Overpass as a backup.
      const UA = { "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)" };
      const ph = [];
      // Three at a time, each with a time limit, so a slow map server can't hold up the guide for minutes.
      const jobs = pts.slice(0, 10).flatMap(([la, ln]) => ["amenity:restaurant", "amenity:cafe"].map(tag => [la, ln, tag])); let nx = 0;
      await Promise.all(Array.from({ length: 3 }, async () => {
        while (nx < jobs.length) { const [la, ln, tag] = jobs[nx++];
          try { const rr = await fetch(`https://photon.komoot.io/reverse?lat=${la}&lon=${ln}&radius=${(r / 1000).toFixed(2)}&limit=30&lang=en&osm_tag=${tag}`, { headers: UA, signal: AbortSignal.timeout(8000) }); if (rr.ok) { const j = await rr.json(); (j.features || []).forEach(f => { const p = f.properties || {}; ph.push({ name: p.name, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], amenity: tag.split(":")[1], cuisine: "", hours: "", web: "", tourism: false, tags: Object.keys(p).length }); }); } } catch (e) {}
        }
      }));
      if (ph.length >= 5) { const out = JSON.stringify({ places: ph.filter(p => p.name), src: "photon" }); ctx.waitUntil(env.USAGE.put(key, out, { expirationTtl: 30 * 86400 })); return new Response(out, { headers: { ...h, "content-type": "application/json" } }); }
      let data = null; const tried = [];
      for (const ep of ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]) {
        try { const rr = await fetch(ep, { method: "POST", signal: AbortSignal.timeout(16000), body: "data=" + encodeURIComponent(q), headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)" } }); tried.push(ep.split("/")[2] + " " + rr.status); if (rr.ok) { data = await rr.json(); break; } } catch (e) { tried.push(ep.split("/")[2] + " " + e.message); }
      }
      // Last resort: Nominatim (OpenStreetMap's own search), one point a second as its rules ask.
      if (!data) {
        const nm = [];
        for (const [la, ln] of pts.slice(0, 6)) {
          const d = r / 111000, e = d / Math.cos(la * Math.PI / 180);
          try { const rr = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&amenity=restaurant&bounded=1&limit=40&extratags=1&viewbox=${ln - e},${la + d},${ln + e},${la - d}`, { headers: { ...UA, "accept-language": "en" }, signal: AbortSignal.timeout(9000) }); tried.push("nominatim " + rr.status);
            if (rr.ok) (await rr.json()).forEach(f => { const t = f.extratags || {}; if (f.name) nm.push({ name: f.name, lat: +f.lat, lng: +f.lon, amenity: f.type || "restaurant", cuisine: t.cuisine || "", hours: t.opening_hours || "", web: t.website || "", tourism: false, tags: Object.keys(t).length + 2 }); }); } catch (e2) { tried.push("nominatim " + e2.message); }
          await new Promise(res => setTimeout(res, 1100));
        }
        if (nm.length >= 3) { const out = JSON.stringify({ places: nm, src: "nominatim" }); ctx.waitUntil(env.USAGE.put(key, out, { expirationTtl: 30 * 86400 })); return new Response(out, { headers: { ...h, "content-type": "application/json" } }); }
        return Response.json({ error: "map busy", tried }, { status: 502, headers: h });
      }
      const places = (data.elements || []).map(e => { const t = e.tags || {}; return { name: t.name, lat: e.lat ?? (e.center && e.center.lat), lng: e.lon ?? (e.center && e.center.lon), amenity: t.amenity, cuisine: t.cuisine || "", hours: t.opening_hours || "", web: t.website || t["contact:website"] || "", tourism: !!(t.tourism || t["name:en"] && t.name !== t["name:en"]), tags: Object.keys(t).length }; }).filter(p => p.name && isFinite(p.lat) && isFinite(p.lng));
      const out = JSON.stringify({ places });
      ctx.waitUntil(env.USAGE.put(key, out, { expirationTtl: 30 * 86400 }));
      return new Response(out, { headers: { ...h, "content-type": "application/json" } });
    }
    // /ground: for each named place, its Wikipedia article (summary and location) and matches on the map
    // (Photon, built on OpenStreetMap). The app keeps only places that really exist and writes their stories
    // from the article's facts.
    if (url.pathname === "/ground" && req.method === "POST") {
      if (origin && !ALLOWED.some(r => r.test(origin))) return Response.json({ error: "Not allowed" }, { status: 403, headers: h });
      let b; try { b = await req.json(); } catch (e) { return Response.json({ error: "Bad request" }, { status: 400, headers: h }); }
      const city = String(b.city || "").slice(0, 120), names = (Array.isArray(b.names) ? b.names : []).map(n => String(n || "").slice(0, 160)).slice(0, 40);
      // "Naples (Capri, Sorrento)" or "Kusadasi (Ephesus)": searches use the city itself; the places in brackets are day trips.
      const cityQ = city.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim() || city;
      const farNames = new Set((Array.isArray(b.far) ? b.far : []).map(n => String(n || "").slice(0, 160)));
      const UA = { "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)" };
      // Each fetch is tried up to 3 times; a "slow down" answer (429) waits longer before the next try.
      const get = async u => { for (let t = 0; t < 3; t++) { let wait = 700 * (t + 1); try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(8000) }); if (r.ok) return await r.json(); if (r.status === 429 || r.status >= 500) wait = 1500 * (t + 1); else return null; } catch (e) {} if (t < 2) await new Promise(ok => setTimeout(ok, wait)); } return null; };
      // The city's own location, so map searches favour places in this city over same-named places
      // elsewhere in the world, and the app measures "in this city" from the real centre.
      let center = null; const ck = "gc2:" + (await sha(cityQ.toLowerCase()));
      if (city) { center = await env.USAGE.get(ck, "json");
        // The travel guide's own page for the city (Wikivoyage) knows which Corpus Christi or Kotor is meant.
        if (!center) for (const t of [cityQ, cityQ.split(",")[0].trim()]) {
          const j = await get("https://en.wikivoyage.org/w/api.php?action=query&format=json&prop=coordinates&redirects=1&titles=" + encodeURIComponent(t));
          const pg = j && Object.values((j.query && j.query.pages) || {})[0], co = pg && pg.coordinates && pg.coordinates[0];
          if (co) { center = { lat: co.lat, lng: co.lon, from: "wikivoyage" }; ctx.waitUntil(env.USAGE.put(ck, JSON.stringify(center), { expirationTtl: 365 * 86400 })); break; }
        }
        if (!center) { const j = await get("https://photon.komoot.io/api/?limit=3&lang=en&osm_tag=place&q=" + encodeURIComponent(cityQ));
          const f = j && (j.features || []).find(f => /city|town|village|municipality|suburb|borough|island/.test((f.properties || {}).osm_value || "")) || (j && (j.features || [])[0]);
          if (f) { center = { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }; ctx.waitUntil(env.USAGE.put(ck, JSON.stringify(center), { expirationTtl: 365 * 86400 })); } } }
      // OpenStreetMap's own search allows about one request a second: calls in this request wait their turn.
      let photonFails = 0, nomiNext = 0;
      const nomi = async u => { const wait = Math.max(0, nomiNext - Date.now()); nomiNext = Math.max(Date.now(), nomiNext) + 1100; if (wait) await new Promise(ok => setTimeout(ok, wait)); return get(u); };
      const bias = center ? "&lat=" + center.lat + "&lon=" + center.lng + "&location_bias_scale=0.2&zoom=12" : "";
      const one = async name => {
        if (!name) return null;
        const k = "gr5:" + (await sha(name + "|" + cityQ + (farNames.has(name) ? "|far" : ""))), hit = await env.USAGE.get(k, "json"); if (hit) return hit;
        const plain = name.replace(/\s*\(.*?\)\s*/g, " ").trim(), q = plain + " " + cityQ;
        let wiki = null, map = null;
        {
          const j = await get("https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=5&prop=extracts|coordinates&exintro=1&explaintext=1&exchars=1400&redirects=1&gsrsearch=" + encodeURIComponent(q));
          if (j) { wiki = Object.values((j.query && j.query.pages) || {}).sort((a, b) => (a.index || 0) - (b.index || 0)).map(p => ({ title: p.title, extract: p.extract || "", lat: p.coordinates && p.coordinates[0] && p.coordinates[0].lat, lng: p.coordinates && p.coordinates[0] && p.coordinates[0].lon })); }
        }
        {
          // Inside the city's area first (a hard box about 60 km across), then anywhere as a fallback.
          // Photon (the free OpenStreetMap search) is tried first; once it has failed twice in this request
          // it is skipped, and OpenStreetMap's own search (Nominatim) answers instead, so a busy map
          // server no longer stops a whole city guide from being checked.
          if (photonFails < 2) {
            const box = center && !farNames.has(name) ? await get("https://photon.komoot.io/api/?limit=5&lang=en&bbox=" + [center.lng - 0.35, center.lat - 0.3, center.lng + 0.35, center.lat + 0.3].map(v => v.toFixed(4)).join(",") + "&q=" + encodeURIComponent(plain)) : null;
            // Only search worldwide when nothing came back inside the city's area (keeps the free map server happy).
            const wide = box && (box.features || []).length ? null : await get("https://photon.komoot.io/api/?limit=4&lang=en" + bias + "&q=" + encodeURIComponent(q));
            const j = (box || wide) ? { features: [...((box && box.features) || []), ...((wide && wide.features) || [])] } : null;
            if (j) { map = (j.features || []).map(f => ({ name: (f.properties || {}).name || "", lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], kind: (f.properties || {}).osm_value || "", city: (f.properties || {}).city || "", osm: ((f.properties || {}).osm_type || "") + ((f.properties || {}).osm_id || "") })); }
            else photonFails++;
          }
          if (!map) {
            const nm = list => (list || []).map(f => ({ name: f.name || String(f.display_name || "").split(",")[0], lat: +f.lat, lng: +f.lon, kind: f.type || "", city: "", osm: (f.osm_type || "") + (f.osm_id || "") }));
            const vb = center && !farNames.has(name) ? "&bounded=1&viewbox=" + [center.lng - 0.35, center.lat + 0.3, center.lng + 0.35, center.lat - 0.3].map(v => v.toFixed(4)).join(",") : "";
            const inBox = vb ? await nomi("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=en" + vb + "&q=" + encodeURIComponent(plain)) : null;
            const wide = inBox && inBox.length ? null : await nomi("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=4&accept-language=en&q=" + encodeURIComponent(q));
            if (inBox || wide) map = [...nm(inBox), ...nm(wide)];
          }
        }
        const res = { wiki: wiki || [], map: map || [], answered: !!(wiki && map) };
        if (res.answered) ctx.waitUntil(env.USAGE.put(k, JSON.stringify(res), { expirationTtl: 90 * 86400 }));
        return res;
      };
      const out = new Array(names.length); let next = 0;
      await Promise.all(Array.from({ length: 3 }, async () => { while (next < names.length) { const i = next++; out[i] = await one(names[i]); } }));
      return Response.json({ results: out, center }, { headers: h });
    }
    // /events?lat=&lng=&from=YYYY-MM-DD&to=YYYY-MM-DD: real, dated events near a place (games, concerts,
    // theatre, festivals) from Ticketmaster's Discovery API. Nothing is written by AI. Cached for 6 hours.
    if (url.pathname === "/events") {
      const lat = +url.searchParams.get("lat"), lng = +url.searchParams.get("lng"), from = String(url.searchParams.get("from") || ""), to = String(url.searchParams.get("to") || from);
      if (!isFinite(lat) || !isFinite(lng) || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return Response.json({ error: "Bad request" }, { status: 400, headers: h });
      if (!env.TM_KEY) return Response.json({ events: [], source: "none" }, { headers: h });
      const key = "ev1:" + lat.toFixed(2) + "," + lng.toFixed(2) + ":" + from + ":" + to;
      const hit = await env.USAGE.get(key); if (hit) return new Response(hit, { headers: { ...h, "content-type": "application/json" } });
      let events = [];
      try {
        const q = "https://app.ticketmaster.com/discovery/v2/events.json?apikey=" + encodeURIComponent(env.TM_KEY) + "&latlong=" + lat.toFixed(4) + "," + lng.toFixed(4) + "&radius=25&unit=miles&size=60&sort=date,asc&startDateTime=" + from + "T00:00:00Z&endDateTime=" + to + "T23:59:59Z";
        const r = await fetch(q, { signal: AbortSignal.timeout(10000) });
        if (r.ok) { const j = await r.json(); events = ((j._embedded && j._embedded.events) || []).map(e => { const v = (e._embedded && e._embedded.venues && e._embedded.venues[0]) || {}, c = (e.classifications && e.classifications[0]) || {};
          return { name: e.name, date: e.dates && e.dates.start && e.dates.start.localDate, time: e.dates && e.dates.start && e.dates.start.localTime || "", venue: v.name || "", lat: v.location ? +v.location.latitude : null, lng: v.location ? +v.location.longitude : null, url: e.url || "", kind: (c.segment && c.segment.name) || "", genre: (c.genre && c.genre.name) || "", src: "Ticketmaster" }; })
          .filter(e => e.name && e.date && e.date >= from && e.date <= to); }
      } catch (e) {}
      const out = JSON.stringify({ events, source: "ticketmaster" });
      ctx.waitUntil(env.USAGE.put(key, out, { expirationTtl: 6 * 3600 }));
      return new Response(out, { headers: { ...h, "content-type": "application/json" } });
    }
    // Traveler ratings of restaurants, shared by everyone. /ratings?city=<key> returns
    // { place: { avg, n } } for one city. POST /rate { city, place, stars, dev } records one traveler's 1-5 stars.
    // Guards: one rating per device and place (a second rating replaces the first), at most 30 ratings per
    // network address a day, and keys must look like Kairoute's own (lower-case words, short).
    // /grating (POST {places:[{name,lat,lng}]}): each restaurant's Google Maps rating, matched by name within 150 m.
    // Answers are kept 30 days and shared by every traveler; a daily cap keeps the cost inside Google's free allowance.
    // Without a key it says so ("nokey"), and the app shows places as not yet rated rather than vetted.
    if (url.pathname === "/grating" && req.method === "POST") {
      if (origin && !ALLOWED.some(r => r.test(origin))) return Response.json({ error: "Not allowed" }, { status: 403, headers: h });
      let b; try { b = await req.json(); } catch (e) { return Response.json({ error: "Bad request" }, { status: 400, headers: h }); }
      const list = (Array.isArray(b.places) ? b.places : []).slice(0, 40).filter(x => x && x.name && isFinite(x.lat) && isFinite(x.lng));
      const out = {}, todo = [];
      for (const x of list) { const k = "gq1:" + (await sha(String(x.name).toLowerCase() + "|" + (+x.lat).toFixed(3) + "|" + (+x.lng).toFixed(3))); const hit = await env.USAGE.get(k, "json"); if (hit) out[x.name] = hit; else todo.push([x, k]); }
      if (!env.GPLACES_KEY) { todo.forEach(([x]) => out[x.name] = { state: "nokey" }); return Response.json({ ratings: out }, { headers: h }); }
      // Rating lookups use Google's "Enterprise" Text Search, which is free for 1,000 calls a month: stay under
      // that with 900 a month (up to 150 in one day, so a whole new trip can be rated at once). Every answer is kept 30 days, so each restaurant is looked up about once a month.
      const dk = "gqd:" + today(), mk = "gqm:" + month(); let usedToday = +(await env.USAGE.get(dk)) || 0, usedMonth = +(await env.USAGE.get(mk)) || 0; const CAP = 150, MCAP = 900;
      const norm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9Ͱ-ϿЀ-ӿ]+/g, " ").trim();
      const near = (a, c) => Math.hypot((a.lat - c.latitude) * 111000, (a.lng - c.longitude) * 111000 * Math.cos(a.lat * Math.PI / 180));
      for (const [x, k] of todo) {
        if (usedToday >= CAP || usedMonth >= MCAP) { out[x.name] = { state: "later" }; continue; }
        usedToday++; usedMonth++;
        let res = null;
        try {
          const r = await fetch("https://places.googleapis.com/v1/places:searchText", { method: "POST", signal: AbortSignal.timeout(9000),
            headers: { "content-type": "application/json", "X-Goog-Api-Key": env.GPLACES_KEY, "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus" },
            body: JSON.stringify({ textQuery: String(x.name), maxResultCount: 5, locationBias: { circle: { center: { latitude: +x.lat, longitude: +x.lng }, radius: 200 } } }) });
          if (r.ok) { const j = await r.json(); const n = norm(x.name);
            const m = (j.places || []).filter(p => p.location && near(x, p.location) <= 150).find(p => { const g = norm(p.displayName && p.displayName.text); return g && (g === n || g.includes(n) || n.includes(g) || g.split(" ").filter(w => w.length > 3 && n.split(" ").includes(w)).length); });
            res = m ? { state: "ok", rating: m.rating || null, count: m.userRatingCount || 0, url: m.googleMapsUri || "", closed: m.businessStatus === "CLOSED_PERMANENTLY" } : { state: "notfound" }; }
        } catch (e) {}
        if (res) { out[x.name] = res; ctx.waitUntil(env.USAGE.put(k, JSON.stringify(res), { expirationTtl: 30 * 86400 })); } else out[x.name] = { state: "later" };
      }
      ctx.waitUntil(env.USAGE.put(dk, String(usedToday), { expirationTtl: 3 * 86400 })); ctx.waitUntil(env.USAGE.put(mk, String(usedMonth), { expirationTtl: 40 * 86400 }));
      return Response.json({ ratings: out }, { headers: h });
    }
    // /famous?city=: the best-known places in and around a city, ranked by how many Wikipedia languages write
    // about them (Wikidata "sitelinks"), an outside measure of fame that no AI can make up. "main" are within the
    // city, "far" are day trips within about 80 km. For a cruise port named like "Civitavecchia (Rome)", when the
    // place in brackets is far better known than the port town, the guide is about that place ("area").
    if (url.pathname === "/famous") {
      const label = String(url.searchParams.get("city") || "").slice(0, 120).trim(); if (!label) return Response.json({ error: "Empty" }, { status: 400, headers: h });
      const fd = await famousData(label, env, ctx); if (fd.error) return Response.json({ error: fd.error }, { status: fd.status || 500, headers: h });
      return Response.json(fd, { headers: h });
    }
    // /sources?city=: every source Kairoute uses for a city, gathered and cross-checked (see sourcesData).
    if (url.pathname === "/sources") {
      const label = String(url.searchParams.get("city") || "").slice(0, 120).trim(); if (!label) return Response.json({ error: "Empty" }, { status: 400, headers: h });
      const sd = await sourcesData(label, env, ctx); if (sd.error) return Response.json({ error: sd.error }, { status: sd.status || 500, headers: h });
      return Response.json(sd, { headers: h });
    }
    // /findplace?city=&q=: a restaurant (or any place) the traveler booked, looked up on OpenStreetMap by name in
    // that city, with every name the map knows it by (local script, English, Latin letters) and its street address.
    if (url.pathname === "/findplace") {
      const city = String(url.searchParams.get("city") || "").slice(0, 120).replace(/\s*\(.*?\)\s*/g, " ").trim(), q = String(url.searchParams.get("q") || "").slice(0, 120).trim();
      if (!city || q.length < 2) return Response.json({ error: "Empty" }, { status: 400, headers: h });
      const key = "fp1:" + (await sha(city.toLowerCase() + "|" + q.toLowerCase())), hit = await env.USAGE.get(key); if (hit) return new Response(hit, { headers: { ...h, "content-type": "application/json" } });
      const UA = { "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)", "accept-language": "en" };
      const nom = async u => { try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(9000) }); return r.ok ? await r.json() : null; } catch (e) { return null; } };
      const GR = { α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o", ά: "a", έ: "e", ή: "i", ί: "i", ό: "o", ύ: "y", ώ: "o", ϊ: "i", ϋ: "y", ΐ: "i", ΰ: "y" };
      const latin = t => String(t || "").toLowerCase().replace(/ου/g, "ou").replace(/αι/g, "e").replace(/ει|οι/g, "i").replace(/μπ/g, "b").replace(/ντ/g, "d").replace(/[\u0370-\u03ff\u1f00-\u1fff]/g, c => GR[c] || GR[c.normalize("NFD")[0]] || "");
      // The city's own box, so a "Platanos" elsewhere in the world never answers.
      const cj = await nom("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(city));
      const bb = cj && cj[0] && cj[0].boundingbox ? cj[0].boundingbox.map(Number) : null; // [south, north, west, east]
      const pad = 0.15, vb = bb ? "&bounded=1&viewbox=" + [bb[2] - pad, bb[1] + pad, bb[3] + pad, bb[0] - pad].join(",") : "";
      const generic = q.replace(/\b(taverna|tavern|restaurant|ristorante|trattoria|osteria|cafe|café|bistro|bar|the|mezedopolio|ouzeri|estiatorio)\b/gi, " ").replace(/\s+/g, " ").trim();
      const out = [];
      for (const term of [...new Set([q, generic].filter(t => t && t.length > 1))]) {
        const j = await nom("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&namedetails=1&addressdetails=1" + vb + "&q=" + encodeURIComponent(term));
        (j || []).forEach(f => { if (out.some(o => o.osm === f.osm_type + f.osm_id)) return; const nd = f.namedetails || {}, ad = f.address || {};
          const names = [...new Set([nd.name, nd["name:en"], nd["name:latin"], nd.int_name, nd.alt_name, nd.old_name, f.name].filter(Boolean))];
          out.push({ name: nd["name:en"] || nd.name || f.name || "", names: names.concat(names.map(latin).filter(x => /[a-z]/.test(x))), lat: +f.lat, lng: +f.lon, kind: f.type || "", cat: f.category || "", osm: f.osm_type + f.osm_id,
            addr: [ad.road && (ad.road + (ad.house_number ? " " + ad.house_number : "")), ad.suburb || ad.neighbourhood || ad.quarter].filter(Boolean).join(", ") }); });
        if (out.length) break;
        await new Promise(ok => setTimeout(ok, 1100)); // OpenStreetMap's search asks for one request a second
      }
      const body = JSON.stringify({ places: out.slice(0, 8), box: bb });
      if (out.length) ctx.waitUntil(env.USAGE.put(key, body, { expirationTtl: 30 * 86400 }));
      return new Response(body, { headers: { ...h, "content-type": "application/json" } });
    }
    // /sync (POST): the same trips on every device. A short sync code is the only key: "new" makes one from the
    // device's trips, "rev" says whether anything changed (cheap), "get" fetches, "put" saves when nothing newer
    // came in since (otherwise it answers 409 with the newer copy, so the device can merge and try again).
    if (url.pathname === "/sync" && req.method === "POST") {
      if (origin && !ALLOWED.some(r => r.test(origin))) return Response.json({ error: "Not allowed" }, { status: 403, headers: h });
      const len = +(req.headers.get("content-length") || 0); if (len > 15e6) return Response.json({ error: "Too big" }, { status: 413, headers: h });
      let b; try { b = await req.json(); } catch (e) { return Response.json({ error: "Bad request" }, { status: 400, headers: h }); }
      const ip = req.headers.get("cf-connecting-ip") || "x", ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
      const code = String(b.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const ttl = { expirationTtl: 400 * 86400 };
      const limit = async (k, max) => { const n = +(await env.USAGE.get(k)) || 0; if (n >= max) return false; ctx.waitUntil(env.USAGE.put(k, String(n + 1), { expirationTtl: 2 * 86400 })); return true; };
      if (b.op === "new") {
        if (!b.data || typeof b.data !== "object") return Response.json({ error: "Bad request" }, { status: 400, headers: h });
        if (!(await limit("syn:" + ip + ":" + today(), 20))) return Response.json({ error: "Too many" }, { status: 429, headers: h });
        let c = ""; for (let t = 0; t < 5; t++) { c = Array.from(crypto.getRandomValues(new Uint8Array(8)), x => ALPHA[x % ALPHA.length]).join(""); if (!(await env.USAGE.get("sm:" + c))) break; }
        const meta = { rev: 1, at: Date.now() };
        await env.USAGE.put("sd:" + c, JSON.stringify(b.data), ttl); await env.USAGE.put("sm:" + c, JSON.stringify(meta), ttl);
        return Response.json({ code: c, rev: 1, at: meta.at }, { headers: h });
      }
      if (!/^[A-Z0-9]{8}$/.test(code)) return Response.json({ error: "Bad code" }, { status: 400, headers: h });
      // Guessing codes: after 40 wrong codes in a day, a device is refused until tomorrow.
      if ((+(await env.USAGE.get("sym:" + ip + ":" + today())) || 0) >= 40) return Response.json({ error: "Too many" }, { status: 429, headers: h });
      const meta = await env.USAGE.get("sm:" + code, "json");
      if (!meta) { await limit("sym:" + ip + ":" + today(), 40); return Response.json({ error: "Unknown code" }, { status: 404, headers: h }); }
      if (b.op === "rev") return Response.json(meta, { headers: h });
      if (b.op === "get") { const data = await env.USAGE.get("sd:" + code, "json"); return Response.json({ rev: meta.rev, at: meta.at, data }, { headers: h }); }
      if (b.op === "put") {
        if (!b.data || typeof b.data !== "object") return Response.json({ error: "Bad request" }, { status: 400, headers: h });
        if (+b.base !== meta.rev) { const data = await env.USAGE.get("sd:" + code, "json"); return Response.json({ rev: meta.rev, at: meta.at, data }, { status: 409, headers: h }); }
        if (!(await limit("syw:" + code + ":" + today(), 800))) return Response.json({ error: "Too many" }, { status: 429, headers: h });
        const nm = { rev: meta.rev + 1, at: Date.now() };
        await env.USAGE.put("sd:" + code, JSON.stringify(b.data), ttl); await env.USAGE.put("sm:" + code, JSON.stringify(nm), ttl);
        return Response.json(nm, { headers: h });
      }
      return Response.json({ error: "Bad request" }, { status: 400, headers: h });
    }
    // /weather?lat=&lng=: the Open-Meteo forecast (free, no key) for 16 days, read into what the planner needs:
    // per day the high and low, the chance of rain, rain total and weather code, and per hour (7:00 to 21:00)
    // temperature, chance of rain and rain amount. Kept 3 hours per 0.1 degree, so a city is fetched once for everyone.
    if (url.pathname === "/weather") {
      const la = +(+url.searchParams.get("lat")).toFixed(1), ln = +(+url.searchParams.get("lng")).toFixed(1);
      if (!isFinite(la) || !isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) return Response.json({ error: "Bad request" }, { status: 400, headers: h });
      const key = "wx1:" + la + "," + ln, hit = await env.USAGE.get(key); if (hit) return new Response(hit, { headers: { ...h, "content-type": "application/json" } });
      try {
        const q = `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${ln}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code&hourly=temperature_2m,precipitation_probability,precipitation&timezone=auto&forecast_days=16`;
        const r = await fetch(q, { signal: AbortSignal.timeout(15000) }); if (!r.ok) return Response.json({ error: "forecast busy" }, { status: 502, headers: h });
        const j = await r.json(), D = j.daily || {}, H = j.hourly || {}, days = {};
        (D.time || []).forEach((t, i) => { days[t] = { tmax: D.temperature_2m_max[i], tmin: D.temperature_2m_min[i], prob: D.precipitation_probability_max ? D.precipitation_probability_max[i] : null, mm: D.precipitation_sum[i], code: D.weather_code[i], hours: [] }; });
        (H.time || []).forEach((t, i) => { const dd = days[t.slice(0, 10)], hr = +t.slice(11, 13); if (dd && hr >= 7 && hr <= 21) dd.hours.push([hr, H.temperature_2m[i], H.precipitation_probability ? H.precipitation_probability[i] : null, H.precipitation[i]]); });
        const out = JSON.stringify({ tz: j.timezone || "", days, src: "Open-Meteo" });
        ctx.waitUntil(env.USAGE.put(key, out, { expirationTtl: 3 * 3600 }));
        return new Response(out, { headers: { ...h, "content-type": "application/json" } });
      } catch (e) { return Response.json({ error: "forecast busy" }, { status: 502, headers: h }); }
    }
    if (url.pathname === "/ratings") {
      const city = String(url.searchParams.get("city") || "");
      if (!/^[a-z0-9 ,'-]{1,80}$/.test(city)) return Response.json({ error: "Bad request" }, { status: 400, headers: h });
      const [raw, bz] = await Promise.all([env.USAGE.get("rt1:" + city), env.USAGE.get("bz1:" + city)]), out = {};
      for (const [k, v] of Object.entries(JSON.parse(raw || "{}"))) if (v.n) out[k] = { avg: +(v.s / v.n).toFixed(2), n: v.n };
      // busy: { place: { hour: [sum of 1 quiet / 2 busy / 3 packed, reports] } }, from travelers who were there.
      return Response.json({ ratings: out, busy: JSON.parse(bz || "{}") }, { headers: { ...h, "cache-control": "public, max-age=120" } });
    }
    if (url.pathname === "/rate" && req.method === "POST") {
      let b; try { b = await req.json(); } catch (e) { b = {}; }
      const city = String(b.city || ""), place = String(b.place || ""), stars = Math.round(+b.stars), dev = String(b.dev || ""), busy = Math.round(+b.busy), hour = Math.round(+b.hour);
      const hasBusy = busy >= 1 && busy <= 3 && hour >= 0 && hour <= 23;
      if (!/^[a-z0-9 ,'-]{1,80}$/.test(city) || !/^[a-z0-9 ,'&.-]{1,80}$/.test(place) || !((stars >= 1 && stars <= 5) || hasBusy) || !/^[a-f0-9]{16,40}$/.test(dev)) return Response.json({ error: "Bad request" }, { status: 400, headers: h });
      const ip = req.headers.get("cf-connecting-ip") || "x", ik = "ri:" + ip + ":" + today(), used = +(await env.USAGE.get(ik)) || 0;
      if (used >= 60) return Response.json({ error: "Thanks! That's the limit for today." }, { status: 429, headers: h });
      // "How busy was it?": one report per traveler, place and day, counted for the hour they were there.
      if (hasBusy && !(stars >= 1 && stars <= 5)) {
        const bk = "bd:" + dev + ":" + city + ":" + place + ":" + today(); if (await env.USAGE.get(bk)) return Response.json({ ok: true, dup: true }, { headers: h });
        const ck = "bz1:" + city, all = JSON.parse((await env.USAGE.get(ck)) || "{}"), v = all[place] || (all[place] = {}), c = v[hour] || [0, 0];
        v[hour] = [c[0] + busy, c[1] + 1];
        await Promise.all([env.USAGE.put(ck, JSON.stringify(all)), env.USAGE.put(bk, "1", { expirationTtl: 2 * 86400 }), env.USAGE.put(ik, String(used + 1), { expirationTtl: 2 * 86400 })]);
        return Response.json({ ok: true, busy: v }, { headers: h });
      }
      const dk = "rd:" + dev + ":" + city + ":" + place, before = +(await env.USAGE.get(dk)) || 0;
      const ck = "rt1:" + city, all = JSON.parse((await env.USAGE.get(ck)) || "{}"), v = all[place] || { s: 0, n: 0 };
      if (before) v.s += stars - before; else { v.s += stars; v.n += 1; }
      all[place] = v;
      await Promise.all([env.USAGE.put(ck, JSON.stringify(all)), env.USAGE.put(dk, String(stars), { expirationTtl: 400 * 86400 }), env.USAGE.put(ik, String(used + 1), { expirationTtl: 2 * 86400 })]);
      return Response.json({ ok: true, avg: +(v.s / v.n).toFixed(2), n: v.n }, { headers: h });
    }
    // /voyage?city=: the city's Wikivoyage page (written by travelers): its listings (see, do, eat, drink)
    // with descriptions, hours, prices and locations, and the practical sections.
    if (url.pathname === "/voyage") {
      const city = String(url.searchParams.get("city") || "").slice(0, 120); if (!city) return Response.json({ error: "Empty" }, { status: 400, headers: h });
      const cityQ = city.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim() || city;
      const key = "wv1:" + (await sha(city.toLowerCase()));
      const hit = await env.USAGE.get(key); if (hit) return new Response(hit, { headers: { ...h, "content-type": "application/json" } });
      const UA = { "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)" };
      let wt = "", title = "";
      for (const t of [cityQ, cityQ.split(",")[0].trim()]) {
        try { const r = await fetch("https://en.wikivoyage.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&redirects=1&page=" + encodeURIComponent(t), { headers: UA }); if (r.ok) { const j = await r.json(); if (j.parse && j.parse.wikitext) { wt = j.parse.wikitext; title = j.parse.title; break; } } } catch (e) {}
      }
      const clean = t => String(t || "").replace(/\{\{[^{}]*\}\}/g, "").replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1").replace(/\[https?:\/\/\S+\s([^\]]*)\]/g, "$1").replace(/'{2,}/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      const listings = [];
      const re = /\{\{\s*(see|do|eat|drink|buy|listing|sleep)\s*\|/gi; let m;
      while ((m = re.exec(wt))) {
        let i = m.index + 2, depth = 1, j = i; while (j < wt.length && depth) { if (wt.startsWith("{{", j)) { depth++; j += 2; } else if (wt.startsWith("}}", j)) { depth--; j += 2; } else j++; }
        const body = wt.slice(i, j - 2); const f = {}; let d2 = 0, cur = "", parts = [];
        for (let k = 0; k < body.length; k++) { const c = body[k]; if (body.startsWith("{{", k) || body.startsWith("[[", k)) d2++; if (body.startsWith("}}", k) || body.startsWith("]]", k)) d2--; if (c === "|" && d2 <= 0) { parts.push(cur); cur = ""; } else cur += c; }
        parts.push(cur); parts.slice(1).forEach(x => { const e = x.indexOf("="); if (e > 0) f[x.slice(0, e).trim().toLowerCase()] = x.slice(e + 1).trim(); });
        const type = m[1].toLowerCase() === "listing" ? (f.type || "listing") : m[1].toLowerCase();
        if (f.name) listings.push({ type, name: clean(f.name), content: clean(f.content || f.description || "").slice(0, 700), hours: clean(f.hours), price: clean(f.price), url: f.url || "", lat: parseFloat(f.lat), lng: parseFloat(f.long || f.lng), wikipedia: clean(f.wikipedia), wikidata: f.wikidata || "" });
        re.lastIndex = j;
      }
      const section = name => { const mm = wt.match(new RegExp("==\\s*" + name + "\\s*==([\\s\\S]*?)(\\n==[^=]|$)", "i")); return mm ? clean(mm[1].replace(/\{\{\s*(see|do|eat|drink|buy|listing|sleep)[\s\S]*?\}\}/gi, "")).slice(0, 1500) : ""; };
      const out = JSON.stringify({ title, listings: listings.slice(0, 300), getAround: section("Get around"), staySafe: section("Stay safe"), understand: section("Understand").slice(0, 1200) });
      ctx.waitUntil(env.USAGE.put(key, out, { expirationTtl: 30 * 86400 }));
      return new Response(out, { headers: { ...h, "content-type": "application/json" } });
    }
    // /osm: opening hours, fees, wheelchair access and websites for map places, by their map ids.
    // /route: real street routes for the day map (walking on foot paths, rides on roads). Each leg is computed
    // once and kept for 90 days, so every traveler on the same streets shares it. Sources: the OpenStreetMap
    // routers run by FOSSGIS (OSRM first, Valhalla if OSRM is busy). Both are free and need no key.
    if (url.pathname === "/route" && req.method === "POST") {
      let b; try { b = await req.json(); } catch (e) { return Response.json({ error: "Bad request" }, { status: 400, headers: h }); }
      const ok = v => Array.isArray(v) && v.length === 2 && v.every(n => typeof n === "number" && isFinite(n)) && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90;
      const legs = (Array.isArray(b.legs) ? b.legs : []).slice(0, 40).map(l => l && ok(l.a) && ok(l.b) ? { m: l.m === "car" ? "car" : "foot", a: l.a, b: l.b } : null);
      // The free routers turn away bursts, so ask for at most 3 legs at a time (saved legs come straight from storage).
      const out = new Array(legs.length).fill(null); let next = 0;
      await Promise.all([0, 1, 2].map(async () => { while (next < legs.length) { const i = next++; if (legs[i]) out[i] = await routeLeg(legs[i], env, ctx).catch(() => null); } }));
      return Response.json({ routes: out }, { headers: h });
    }
    // /transit (POST {pairs:[{a:[lat,lng], b:[lat,lng]}]}): the mapped train, metro, tram, bus and ferry lines
    // between each pair of points, with stops, the real path and a cautious time (see transit.js). Each pair is
    // looked up once and kept (see keep below), so every traveler on the same trip shares it. Keys are tr4: since ferries come from their own
    // long-kept lookup at each end (answers from before that are not reused).
    if (url.pathname === "/transit" && req.method === "POST") {
      let b; try { b = await req.json(); } catch (e) { return Response.json({ error: "Bad request" }, { status: 400, headers: h }); }
      const ok = v => Array.isArray(v) && v.length === 2 && v.every(n => typeof n === "number" && isFinite(n)) && Math.abs(v[0]) <= 90 && Math.abs(v[1]) <= 180;
      // Pairs are looked up side by side, so a page asking for several still gets its answer in well under a minute.
      const pairs = (Array.isArray(b.pairs) ? b.pairs : []).slice(0, 12);
      const out = await Promise.all(pairs.map(async pr => {
        if (!pr || !ok(pr.a) || !ok(pr.b)) return { error: "bad" };
        const dow = Number.isInteger(pr.dow) && pr.dow >= 0 && pr.dow <= 6 ? pr.dow : 3, kind = dow === 0 ? "su" : dow === 6 ? "sa" : "wk";
        const key = "tr4:" + kind + ":" + [...pr.a, ...pr.b].map(n => n.toFixed(3)).join(",");
        // A full answer is kept 14 days (timetables change); one where a source was busy only 1 day. When the map answered
        // after the reply went out, its full answer replaces the partial one. A partial answer met again after 10 minutes
        // is looked up afresh in the background (once per 10 minutes), so a busy map server never hides a ferry for a day.
        const keep = x => env.USAGE.put(key, JSON.stringify({ opts: x.opts, partial: !!x.partial, t: Date.now() }), { expirationTtl: (x.partial ? 1 : x.opts.length ? 14 : 7) * 86400 });
        const store = { get: k => env.USAGE.get(k, "json"), put: (k, v, ttl) => env.USAGE.put(k, JSON.stringify(v), { expirationTtl: ttl }) };
        const look = () => allOptions({ lat: pr.a[0], lng: pr.a[1] }, { lat: pr.b[0], lng: pr.b[1] }, dow, 12000, store);
        const hit = await env.USAGE.get(key, "json");
        if (hit) {
          if (hit.partial && Date.now() - (hit.t || 0) > 600000 && !(await env.USAGE.get("lk:" + key))) {
            ctx.waitUntil(env.USAGE.put("lk:" + key, "1", { expirationTtl: 600 }).then(look).then(r => (!r.partial || r.opts.length > (hit.opts || []).length) ? keep(r).then(() => r.late ? r.late.then(f => f && keep(f)) : null) : (r.late ? r.late.then(f => f && keep(f)) : null)).catch(() => {}));
          }
          return { opts: hit.opts, partial: !!hit.partial };
        }
        try { const r = await look(), res = { opts: r.opts, partial: !!r.partial };
          ctx.waitUntil(keep(r).then(() => r.late ? r.late.then(f => f && keep(f)) : null).catch(() => {}));
          return res;
        } catch (e) { return { error: "map busy" }; }
      }));
      return Response.json({ results: out }, { headers: h });
    }
    // /nearsights?lat=&lng=&r=: the named sights OpenStreetMap knows within r metres of a point (monuments, churches,
    // artworks, viewpoints, museums, historic buildings, fountains). These are the real points a guide stops at
    // when walking someone through a square, an old town or a castle; nothing here is invented.
    if (url.pathname === "/nearsights") {
      const la = +(+url.searchParams.get("lat")).toFixed(4), ln = +(+url.searchParams.get("lng")).toFixed(4), r = Math.min(600, Math.max(60, +url.searchParams.get("r") || 250));
      if (!isFinite(la) || !isFinite(ln)) return Response.json({ error: "Bad request" }, { status: 400, headers: h });
      const key = "ns2:" + r + ":" + la + "," + ln, hit = await env.USAGE.get(key); if (hit) return new Response(hit, { headers: { ...h, "content-type": "application/json" } });
      const A = `(around:${r},${la},${ln})`;
      const q = `[out:json][timeout:15];(node["tourism"~"^(attraction|artwork|viewpoint|museum|gallery)$"]["name"]${A};way["tourism"~"^(attraction|museum|gallery)$"]["name"]${A};node["historic"]["name"]${A};way["historic"]["name"]${A};node["amenity"~"^(place_of_worship|fountain|clock|theatre)$"]["name"]${A};way["amenity"~"^(place_of_worship|theatre)$"]["name"]${A};);out center tags 150;`; // node and way only: light enough for the map servers' busy limits
      const UA = { "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)" };
      let data = null;
      const why = [];
      for (const ep of ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]) {
        try { const rr = await fetch(ep, { method: "POST", signal: AbortSignal.timeout(16000), body: "data=" + encodeURIComponent(q), headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", ...UA } }); if (rr.ok) { const d = await rr.json(); if ((d.elements || []).length || !d.remark) { data = d; if ((d.elements || []).length) break; } else why.push(ep.split("/")[2] + ": empty, " + String(d.remark).slice(0, 60)); } else why.push(ep.split("/")[2] + ": " + rr.status); } catch (e) { why.push(ep.split("/")[2] + ": " + String(e && e.name || e).slice(0, 40)); } // a timed-out answer comes back empty with a remark: try the next server
      }
      if (!data) { const old = await env.USAGE.get("ns1:" + r + ":" + la + "," + ln); if (old) return new Response(old, { headers: { ...h, "content-type": "application/json" } });
        return Response.json({ error: "map busy", why }, { status: 502, headers: h }); }
      const seen = new Set(), sights = [];
      for (const e of data.elements || []) { const t = e.tags || {}, lat = e.lat ?? (e.center && e.center.lat), lng = e.lon ?? (e.center && e.center.lon); const name = t["name:en"] || t.name;
        if (!name || !isFinite(lat) || seen.has(name.toLowerCase())) continue; seen.add(name.toLowerCase());
        if (/^(memorial|boundary_stone|milestone|wayside_cross|wayside_shrine|tomb|grave)$/.test(t.historic || "") && !t.wikidata && !t.wikipedia) continue;
        sights.push({ name, local: t.name && t.name !== name ? t.name : undefined, lat: +(+lat).toFixed(5), lng: +(+lng).toFixed(5), kind: t.tourism || t.historic || t.amenity || t.man_made || "", wd: t.wikidata || undefined, wiki: !!(t.wikipedia || t.wikidata), desc: (t.description || t.inscription || "").slice(0, 200) || undefined }); }
      const out = JSON.stringify({ sights: sights.slice(0, 60) });
      if (sights.length) ctx.waitUntil(env.USAGE.put(key, out, { expirationTtl: 60 * 86400 })); // an empty answer isn't kept, so a busy map server never leaves a stop without points
      return new Response(out, { headers: { ...h, "content-type": "application/json" } });
    }
    // /facts (POST {ids:[Wikidata ids], lang}): what each place is (Wikidata's one-line description and type) and the
    // opening of its Wikipedia article, so the walk-through guide tells real facts about each point instead of guessing.
    if (url.pathname === "/facts" && req.method === "POST") {
      let b; try { b = await req.json(); } catch (e) { return Response.json({ error: "Bad request" }, { status: 400, headers: h }); }
      const ids = [...new Set((Array.isArray(b.ids) ? b.ids : []).map(String).filter(x => /^Q\d+$/.test(x)))].slice(0, 20);
      const UA = { "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)" }, facts = {}, todo = [];
      for (const id of ids) { const hit = await env.USAGE.get("fx1:" + id, "json"); if (hit) facts[id] = hit; else todo.push(id); }
      if (todo.length) try {
        const w = await (await fetch("https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks|descriptions|claims&languages=en&sitefilter=enwiki&ids=" + todo.join("|"), { headers: UA, signal: AbortSignal.timeout(10000) })).json();
        const titles = {};
        for (const id of todo) { const e = (w.entities || {})[id]; if (!e || e.missing !== undefined) continue;
          const types = ((e.claims || {}).P31 || []).map(c => c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value && c.mainsnak.datavalue.value.id).filter(Boolean).slice(0, 6);
          facts[id] = { what: ((e.descriptions || {}).en || {}).value || "", types, text: "" };
          const sl = e.sitelinks || {}; if (sl.enwiki) titles[sl.enwiki.title] = id; }
        const tl = Object.keys(titles);
        if (tl.length) { const x = await (await fetch("https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&exchars=700&exlimit=20&redirects=1&titles=" + encodeURIComponent(tl.join("|")), { headers: UA, signal: AbortSignal.timeout(10000) })).json();
          const back = {}; for (const r of ((x.query || {}).normalized || []).concat((x.query || {}).redirects || [])) back[r.to] = back[r.from] || r.from;
          for (const pg of Object.values((x.query || {}).pages || {})) { const id = titles[pg.title] || titles[back[pg.title]]; if (id && facts[id]) facts[id].text = (pg.extract || "").replace(/\s+/g, " ").trim(); } }
        for (const id of todo) if (facts[id]) ctx.waitUntil(env.USAGE.put("fx1:" + id, JSON.stringify(facts[id]), { expirationTtl: 90 * 86400 }));
      } catch (e) {}
      return Response.json({ facts }, { headers: h });
    }
    if (url.pathname === "/osm" && req.method === "POST") {
      let b; try { b = await req.json(); } catch (e) { return Response.json({ error: "Bad request" }, { status: 400, headers: h }); }
      const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).filter(x => /^[NWR]\d+$/.test(x)).slice(0, 50);
      if (!ids.length) return Response.json({ places: {} }, { headers: h });
      try {
        const r = await fetch("https://nominatim.openstreetmap.org/lookup?format=jsonv2&extratags=1&osm_ids=" + ids.join(","), { headers: { "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)" } });
        if (!r.ok) return Response.json({ error: "map busy" }, { status: 502, headers: h });
        const j = await r.json(), places = {};
        for (const p of j) { const t = p.extratags || {}; places[p.osm_type[0].toUpperCase() + p.osm_id] = { hours: t.opening_hours || "", fee: t.fee || t.charge || "", wheelchair: t.wheelchair || "", web: t.website || t["contact:website"] || t.url || "", wikidata: t.wikidata || "" }; }
        return Response.json({ places }, { headers: h });
      } catch (e) { return Response.json({ error: "map busy" }, { status: 502, headers: h }); }
    }
    if (url.pathname === "/verify" && req.method === "POST") {
      if (origin && !ALLOWED.some(r => r.test(origin))) return Response.json({ error: "Not allowed" }, { status: 403, headers: h });
      let b; try { b = await req.json(); } catch (e) { return Response.json({ error: "Bad request" }, { status: 400, headers: h }); }
      const city = String(b.city || "").slice(0, 120), items = (Array.isArray(b.items) ? b.items : []).slice(0, 40);
      const out = [];
      for (const it of items) {
        const name = String(it.name || "").slice(0, 160); if (!name) { out.push(null); continue; }
        const k = "nv1:" + (await sha(name + "|" + city));
        let res = await env.USAGE.get(k, "json");
        if (!res) {
          const tries = [name + ", " + city, name.replace(/\s*\(.*?\)\s*/g, " ").trim() + ", " + city];
          for (const t of tries) {
            try {
              const rr = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&q=" + encodeURIComponent(t), { headers: { "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)", "accept-language": "en" } });
              if (rr.ok) { const j = await rr.json(); res = { found: j.map(x => ({ lat: +x.lat, lng: +x.lon, name: x.name || x.display_name, type: x.type, cls: x.category || x.class })) }; if (j.length) break; }
            } catch (e) {}
            await new Promise(r => setTimeout(r, 1100)); // the map service asks for at most one search a second
          }
          if (res) ctx.waitUntil(env.USAGE.put(k, JSON.stringify(res), { expirationTtl: 90 * 86400 }));
        }
        out.push(res);
      }
      return Response.json({ results: out }, { headers: h });
    }
    // Shared guide store: a finished city guide is kept so the same city is never written twice.
    if (url.pathname === "/guide") {
      if (req.method === "GET") {
        const k = String(url.searchParams.get("k") || "").slice(0, 400);
        const g = k ? await env.USAGE.get("g:" + k) : null;
        return g ? new Response(g, { headers: { ...h, "content-type": "application/json", "cache-control": "no-store" } }) : Response.json({ none: true }, { status: 404, headers: h });
      }
      if (req.method === "POST") {
        if (origin && !ALLOWED.some(r => r.test(origin))) return Response.json({ error: "Not allowed" }, { status: 403, headers: h });
        const raw = await req.text();
        if (raw.length > 1500000) return Response.json({ error: "Too big" }, { status: 413, headers: h });
        let b; try { b = JSON.parse(raw); } catch (e) { return Response.json({ error: "Bad request" }, { status: 400, headers: h }); }
        const k = String(b.k || "").slice(0, 400), g = b.guide;
        if (!k || !g || !Array.isArray(g.sites) || g.sites.length < 8) return Response.json({ error: "Incomplete guide" }, { status: 400, headers: h });
        // Safeguard: only guides whose every place was confirmed on the map or Wikipedia can be shared.
        const unchecked = [...g.sites, ...(g.farther || [])].filter(x => !x || x.onMap !== true).map(x => x && x.name);
        if (!g.grounded || !g.startsOk || unchecked.length || (g.restaurants || []).some(r => !r || r.onMap !== true)) return Response.json({ error: "Unchecked places", unchecked: unchecked.slice(0, 10) }, { status: 422, headers: h });
        await env.USAGE.put("g:" + k, JSON.stringify(g), { expirationTtl: 180 * 86400 });
        return Response.json({ ok: true }, { headers: h });
      }
    }
    // Turns a written stop story into a spoken guide's script: short lines, natural pauses, the odd
    // question or "look up", same facts. Made once per story and kept. Costs only a few neurons.
    if (url.pathname === "/script" && req.method === "POST") {
      if (origin && !ALLOWED.some(r => r.test(origin))) return Response.json({ error: "Not allowed" }, { status: 403, headers: h });
      let b; try { b = await req.json(); } catch (e) { return Response.json({ error: "Bad request" }, { status: 400, headers: h }); }
      const text = String(b.text || "").slice(0, 2400).trim(); if (!text) return Response.json({ error: "Empty" }, { status: 400, headers: h });
      const key = "s3:" + (await sha(text)), hit = await env.USAGE.get(key);
      if (hit) return new Response(hit, { headers: { ...h, "content-type": "application/json" } });
      if ((await used(env)) + 60 > DAILY_NEURONS) return Response.json({ error: "allowance used up" }, { status: 429, headers: h });
      const prompt = `You are a warm, lively professional tour guide speaking to your small group as you stand at the place. Rewrite the written text below into what you would actually SAY out loud.
Rules:
- Keep every fact, name, date and number exactly; add no new facts.
- Sound like a person THINKING while speaking, not reading: vary sentence length, start some lines with "Now," "So," "Okay," "Look up," "Here's the thing," ask the group the odd question and answer it, react to what you're telling them ("which is incredible, really"), add a brief aside, and once or twice let a thought form mid-sentence with "..." or rephrase yourself ("it's a church, well, really a fortress"). Never change or blur a fact, date or number. Speak in the present, pointing at what's in front of them. Keep it tasteful: at most two "..." hesitations per part, no "um".
- Contractions, no lists, no parentheses, no abbreviations.
- About the same length as the original, not longer.
- Split it into "parts": each part is one breath of speech, one to three sentences. Mark where a guide would pause longer by starting that part with "~".
Reply with JSON only: {"parts":["...","~..."]}

Written text:
"""${text}"""`;
      let out; try { out = await env.AI.run(MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: 1500, temperature: 0.5, chat_template_kwargs: { enable_thinking: false } }); }
      catch (e) { return Response.json({ error: "busy" }, { status: 502, headers: h }); }
      const ch = out && out.choices && out.choices[0];
      const raw = typeof (out && out.response) === "string" ? out.response : (ch && ch.message && ch.message.content) || "";
      let parts = []; try { const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)); parts = (j.parts || []).map(String).map(x => x.trim()).filter(Boolean).slice(0, 200); } catch (e) {}
      const u2 = (out && out.usage) || {}; ctx.waitUntil(addUse(env, (+u2.prompt_tokens || prompt.length / 4) * IN_RATE + (+u2.completion_tokens || raw.length / 3) * OUT_RATE));
      const total = parts.join(" ").length;
      if (parts.length < 2 || total < text.length * 0.5 || total > text.length * 1.6) return Response.json({ error: "No script" }, { status: 502, headers: h });
      const body = JSON.stringify({ parts });
      ctx.waitUntil(env.USAGE.put(key, body, { expirationTtl: 365 * 86400 }));
      return new Response(body, { headers: { ...h, "content-type": "application/json" } });
    }
    // Before a stop starts: can the natural voice say all of it? (Lines already made are free.) This keeps
    // one voice for the whole stop instead of switching halfway when the day's allowance runs out.
    if (url.pathname === "/voiceplan" && req.method === "POST") {
      let b; try { b = await req.json(); } catch (e) { return Response.json({ error: "Bad request" }, { status: 400, headers: h }); }
      const { m, vm, sp: speaker } = voiceChoice(b), texts = (Array.isArray(b.texts) ? b.texts : []).map(t => String(t || "").slice(0, 2000).trim()).filter(Boolean).slice(0, 200);
      let cost = 0;
      for (const t of texts) { const k = "a:" + (m === "aura-1" ? "" : m + ":") + speaker + ":" + (await sha(t)); const l = await env.USAGE.list({ prefix: k, limit: 1 }); if (!l.keys.length) cost += t.length * vm.rate; }
      const vUsed = +(await env.USAGE.get("v:" + today())) || 0, u = await used(env);
      return Response.json({ ok: vUsed + cost <= VOICE_DAILY && u + cost <= VOICE_TOTAL, cost: Math.round(cost) }, { headers: h });
    }
    if (url.pathname === "/speak" && req.method === "POST") {
      if (origin && !ALLOWED.some(r => r.test(origin))) return Response.json({ error: "Not allowed" }, { status: 403, headers: h });
      let b; try { b = await req.json(); } catch (e) { return Response.json({ error: "Bad request" }, { status: 400, headers: h }); }
      const text = String(b.text || "").slice(0, 2000).trim(), { m, vm, sp: speaker } = voiceChoice(b);
      if (!text) return Response.json({ error: "Empty" }, { status: 400, headers: h });
      const key = "a:" + (m === "aura-1" ? "" : m + ":") + speaker + ":" + (await sha(text));
      const hit = await env.USAGE.get(key, "arrayBuffer");
      if (hit) return new Response(hit, { headers: { ...h, "content-type": "audio/mpeg", "x-cached": "1", "cache-control": "public, max-age=31536000" } });
      const cost = text.length * vm.rate, vk = "v:" + today();
      const vUsed = +(await env.USAGE.get(vk)) || 0, u = await used(env);
      if (lab ? cost > LAB_LEFT : (vUsed + cost > VOICE_DAILY || u + cost > VOICE_TOTAL)) return Response.json({ error: "voice allowance used up" }, { status: 429, headers: h });
      let audio;
      try { const r = await env.AI.run(vm.id, { text, speaker, encoding: "mp3" }, { returnRawResponse: true }); if (!r.ok) throw new Error("tts " + r.status); audio = await r.arrayBuffer(); }
      catch (e) { return Response.json({ error: "The voice service is busy." }, { status: 502, headers: h }); }
      if (!audio || audio.byteLength < 1000) return Response.json({ error: "No audio" }, { status: 502, headers: h });
      ctx.waitUntil(Promise.all([addUse(env, cost, lab), lab ? null : env.USAGE.put(vk, String(+(vUsed + cost).toFixed(1)), { expirationTtl: 3 * 86400 }), env.USAGE.put(key, audio, { expirationTtl: 365 * 86400 })]));
      return new Response(audio, { headers: { ...h, "content-type": "audio/mpeg", "cache-control": "public, max-age=31536000" } });
    }
    // /identify: "What am I looking at?" A photo plus the real places around the traveler (the guide's stops and
    // OpenStreetMap's named sights near their GPS position, numbered by the app). The AI only picks one of those
    // numbers, or 0 when none matches; it never names a place of its own. About 1,500 input tokens per photo
    // (roughly 15 neurons), capped at 40 a day per traveler.
    if (url.pathname === "/identify" && req.method === "POST") {
      if (origin && !ALLOWED.some(r => r.test(origin))) return Response.json({ error: "Not allowed" }, { status: 403, headers: h });
      let b; try { b = await req.json(); } catch (e) { return Response.json({ error: "Bad request" }, { status: 400, headers: h }); }
      const img = typeof b.image === "string" && /^data:image\/(jpeg|png|webp);base64,(\/9j\/|iVBOR|UklGR)/.test(b.image) && b.image.length < 400000 ? b.image : null;
      const cands = (Array.isArray(b.cands) ? b.cands : []).slice(0, 25).map((c, i) => ({ n: i + 1, name: String((c && c.name) || "").slice(0, 90), kind: String((c && c.kind) || "").slice(0, 40), m: Math.round(+(c && c.m) || 0) })).filter(c => c.name);
      const dev = String(b.dev || ""); if (!img || !cands.length || !/^[a-f0-9]{16,40}$/.test(dev)) return Response.json({ error: "Bad request" }, { status: 400, headers: h });
      const ik = "id:" + dev + ":" + today(), n = +(await env.USAGE.get(ik)) || 0;
      if (n >= 40 && !lab) return Response.json({ error: "That's the limit for photo look-ups today." }, { status: 429, headers: h });
      const u = await used(env); if (u + 60 > DAILY_NEURONS) return Response.json({ error: "The AI allowance for today is used up." }, { status: 429, headers: h });
      const prompt = `A traveler took this photo standing where they are now. These are the only real places near them, with how far away each is:\n${cands.map(c => `${c.n}. ${c.name}${c.kind ? " (" + c.kind + ")" : ""}, ${c.m} m away`).join("\n")}\n\nWhich numbered place is the main subject of the photo? Use what you see (architecture, shape, signs, statues, columns, domes) and prefer nearer places when it's unclear. If none of them is clearly what the photo shows, answer 0. Reply only with JSON: {"n": number, "sure": "high"|"medium"|"low", "seen": "a few words on what is in the photo"}`;
      let out;
      try { out = await env.AI.run(MODEL, { messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: img } }, { type: "text", text: prompt }] }], max_tokens: 120, temperature: 0.1, chat_template_kwargs: { enable_thinking: false } }); }
      catch (e) { return Response.json({ error: "The AI service is busy. Try again in a minute." }, { status: 502, headers: h }); }
      const ch = out && out.choices && out.choices[0], text = typeof (out && out.response) === "string" ? out.response : (ch && ch.message && ch.message.content) || "";
      const u2 = (out && out.usage) || {}, pin = +u2.prompt_tokens || 1500, pout = +u2.completion_tokens || 40;
      ctx.waitUntil(Promise.all([addUse(env, pin * IN_RATE + pout * OUT_RATE, lab), env.USAGE.put(ik, String(n + 1), { expirationTtl: 2 * 86400 })]));
      let j = null; try { j = JSON.parse((/\{[\s\S]*\}/.exec(text) || ["{}"])[0]); } catch (e) {}
      const pick = j && Number.isInteger(+j.n) && +j.n >= 1 && +j.n <= cands.length ? +j.n : 0;
      return Response.json({ n: pick, sure: j && /^(high|medium|low)$/.test(j.sure) ? j.sure : "low", seen: j && typeof j.seen === "string" ? j.seen.slice(0, 160) : "" }, { headers: { ...h, "cache-control": "no-store" } });
    }
    if (url.pathname !== "/sample" || req.method !== "POST") return new Response("Kairoute AI helper", { headers: h });
    if (origin && !ALLOWED.some(r => r.test(origin))) return Response.json({ error: "Not allowed" }, { status: 403, headers: h });

    let body; try { body = await req.json(); } catch (e) { return Response.json({ error: "Bad request" }, { status: 400, headers: h }); }
    const prompt = String(body.prompt || "").slice(0, 60000), tier = MAX_OUT[body.tier] ? body.tier : "default";
    const images = (Array.isArray(body.images) ? body.images : []).filter(x => typeof x === "string" && x.startsWith("data:image/")).slice(0, 4);
    if (!prompt) return Response.json({ error: "Empty prompt" }, { status: 400, headers: h });

    const inTok = Math.ceil(prompt.length / 4) + images.length * 1200;
    const u = await used(env);
    if (u + inTok * IN_RATE + 500 > DAILY_NEURONS) return Response.json({ error: "The free AI allowance for today is used up. It resets at 6 pm Central time (7 pm in summer)." }, { status: 429, headers: h });

    const content = images.length ? [...images.map(d => ({ type: "image_url", image_url: { url: d } })), { type: "text", text: prompt }] : prompt;
    // No streaming: the free plan allows only a few milliseconds of Worker CPU per request, and
    // passing a long stream through used that up and cut answers short. Waiting costs no CPU.
    let out;
    try {
      out = await env.AI.run(MODEL, { messages: [{ role: "user", content }], max_tokens: MAX_OUT[tier], temperature: 0.4, chat_template_kwargs: { enable_thinking: false } });
    } catch (e) {
      return Response.json({ error: "The AI service is busy. Try again in a minute." }, { status: 502, headers: h });
    }
    const ch = out && out.choices && out.choices[0];
    const text = typeof (out && out.response) === "string" ? out.response : (ch && ch.message && ch.message.content) || "";
    const finish = (ch && ch.finish_reason) || null;
    const u2 = (out && out.usage) || {};
    const pin = +u2.prompt_tokens || inTok, pout = +u2.completion_tokens || Math.ceil(text.length / 3);
    ctx.waitUntil(addUse(env, pin * IN_RATE + pout * OUT_RATE));
    return Response.json({ text, finish, usage: { in: pin, out: pout } }, { headers: { ...h, "cache-control": "no-store" } });
  }
};

// The best-known places in and around a city (see /famous).
async function famousData(label, env, ctx) {
  const key = "fm6:" + (await sha(label.toLowerCase())), hit = await env.USAGE.get(key); if (hit) return JSON.parse(hit);
  const UA = { "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)" };
  const getJ = async (u, ms) => { for (let t = 0; t < 2; t++) { try { const r = await fetch(u, { headers: { ...UA, accept: "application/sparql-results+json" }, signal: AbortSignal.timeout(ms || 25000) }); if (r.ok) return await r.json(); } catch (e) {} } return null; };
  const centerOf = async name => {
    for (const t of [name, name.split(",")[0].trim()]) { const j = await getJ("https://en.wikivoyage.org/w/api.php?action=query&format=json&prop=coordinates&redirects=1&titles=" + encodeURIComponent(t), 9000);
      const pg = j && Object.values((j.query && j.query.pages) || {})[0], co = pg && pg.coordinates && pg.coordinates[0]; if (co) return { lat: co.lat, lng: co.lon }; }
    const j = await getJ("https://photon.komoot.io/api/?limit=1&lang=en&osm_tag=place&q=" + encodeURIComponent(name), 9000); const f = j && (j.features || [])[0];
    return f ? { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] } : null;
  };
  // Not sights: cities and municipalities, stations, airports, schools, hospitals, regions, seas, government bodies.
  const NOT_SIGHT = "wd:Q515 wd:Q1549591 wd:Q5119 wd:Q1637706 wd:Q200250 wd:Q2074737 wd:Q747074 wd:Q1093829 wd:Q15284 wd:Q3957 wd:Q928830 wd:Q55488 wd:Q1248784 wd:Q644371 wd:Q3918 wd:Q3914 wd:Q16917 wd:Q4022 wd:Q165 wd:Q39594 wd:Q10864048 wd:Q13220204 wd:Q13221722 wd:Q1620908 wd:Q1194951 wd:Q476028 wd:Q34770 wd:Q33742 wd:Q1288568 wd:Q5503 wd:Q15079663";
  const NOT_TOWN = "wd:Q928830 wd:Q55488 wd:Q1248784 wd:Q644371 wd:Q3918 wd:Q3914 wd:Q16917 wd:Q4022 wd:Q165 wd:Q39594 wd:Q10864048 wd:Q13220204 wd:Q13221722 wd:Q1620908 wd:Q34770 wd:Q33742 wd:Q1288568 wd:Q5503";
  const famous = async (c, r, min, bad, lim, maxPop) => {
    const q = `SELECT ?item ?itemLabel ?sl ?loc ?dist WHERE { SERVICE wikibase:around { ?item wdt:P625 ?loc . bd:serviceParam wikibase:center "Point(${c.lng} ${c.lat})"^^geo:wktLiteral . bd:serviceParam wikibase:radius "${r}" . bd:serviceParam wikibase:distance ?dist . }
      ?item wikibase:sitelinks ?sl . FILTER(?sl >= ${min}) FILTER NOT EXISTS { ?item wdt:P31 ?bad . VALUES ?bad { ${bad} } } FILTER NOT EXISTS { ?item wdt:P576 ?gone } FILTER NOT EXISTS { ?item wdt:P585 ?when } FILTER NOT EXISTS { ?item wdt:P580 ?from }
      FILTER NOT EXISTS { ?item wdt:P1082 ?pop FILTER(?pop > ${maxPop}) }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul,el,it,es,tr,fr,de" . } } ORDER BY DESC(?sl) LIMIT ${lim}`;
    const j = await getJ("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q), 40000);
    if (!j) return null; const seen = new Set(), out = [];
    for (const b of (j.results && j.results.bindings) || []) { const id = b.item.value.split("/").pop(); if (seen.has(id)) continue; seen.add(id);
      const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.loc.value); const name = b.itemLabel && b.itemLabel.value; if (!m || !name || /^Q\d+$/.test(name)) continue;
      out.push({ name, wd: id, sl: +b.sl.value, lat: +(+m[2]).toFixed(5), lng: +(+m[1]).toFixed(5), km: +(+b.dist.value).toFixed(1) }); }
    return out;
  };
  const port = label.replace(/\s*\(.*?\)\s*/g, " ").trim(), inBr = ((/\(([^)]*)\)/.exec(label) || [])[1] || "").split(",").map(x => x.trim()).filter(Boolean);
  let area = port, center = await centerOf(port);
  if (!center) return { error: "Unknown place", status: 404 };
  let main = await famous(center, 6, 8, NOT_SIGHT, 60, 20000);
  if (!main) return { error: "Busy", status: 503 };
  const fame = list => (list || []).slice(0, 5).reduce((a, x) => a + x.sl, 0);
  // The place in brackets, when it is a bigger draw than the port town itself, is where the day is spent.
  if (inBr.length) { const c2 = await centerOf(inBr[0]); if (c2) { const d = Math.hypot((c2.lat - center.lat) * 111, (c2.lng - center.lng) * 111 * Math.cos(center.lat * Math.PI / 180));
    if (d > 5) { const m2 = await famous(c2, 6, 8, NOT_SIGHT, 60, 20000); if (m2 && fame(m2) > fame(main) * 2.5) { area = inBr[0]; center = c2; main = m2; } } } }
  const farRaw = (await famous(center, 80, 25, NOT_TOWN, 120, 200000)) || [];
  const mainIds = new Set(main.map(x => x.wd)), lc = s => s.toLowerCase();
  const far = farRaw.filter(x => x.km > 6 && !mainIds.has(x.wd) && lc(x.name) !== lc(area) && lc(x.name) !== lc(port)).slice(0, 25);
  main = main.filter(x => lc(x.name) !== lc(area) && lc(x.name) !== lc(port)).slice(0, 45);
  // Heritage status (UNESCO World Heritage, or a national heritage register) for every place found.
  const hids = [...main, ...far].map(x => x.wd);
  if (hids.length) { const hj = await getJ("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(`SELECT ?item (MAX(IF(?h = wd:Q9259, 1, 0)) AS ?un) WHERE { VALUES ?item { ${hids.map(x => "wd:" + x).join(" ")} } ?item wdt:P1435 ?h } GROUP BY ?item`), 25000);
    const hm = new Map(((hj && hj.results && hj.results.bindings) || []).map(b => [b.item.value.split("/").pop(), +b.un.value]));
    [...main, ...far].forEach(x => { if (hm.has(x.wd)) { x.heritage = true; x.unesco = hm.get(x.wd) === 1; } }); }
  const res = { area, port, center, main, far };
  ctx.waitUntil(env.USAGE.put(key, JSON.stringify(res), { expirationTtl: 30 * 86400 }));
  return res;
}

// ---------- Per-city sources: step one of every guide ----------
// Several independent sources, global and local, gathered for one city and cross-checked by Wikidata id
// (or by name where a source has no id), so a place is trusted because many sources name it, not because
// one AI said so. Sources: Wikidata fame, Wikipedia in the local language, English Wikivoyage and the local
// language's Wikivoyage (including district pages), OpenStreetMap's tourist and historic places, and the
// national heritage registers and UNESCO list (Wikidata P1435), with each place's official website (P856).
const LANG_NAME = { en: "English", it: "Italian", es: "Spanish", ca: "Catalan", el: "Greek", tr: "Turkish", fr: "French", de: "German", pt: "Portuguese", nl: "Dutch", hr: "Croatian", mt: "Maltese", ar: "Arabic", he: "Hebrew", ja: "Japanese", zh: "Chinese", ru: "Russian", pl: "Polish", sv: "Swedish", da: "Danish", nb: "Norwegian", fi: "Finnish", cs: "Czech", hu: "Hungarian", ro: "Romanian", bg: "Bulgarian", sl: "Slovenian", sr: "Serbian", uk: "Ukrainian", ko: "Korean", vi: "Vietnamese", th: "Thai", id: "Indonesian", is: "Icelandic", ga: "Irish", et: "Estonian", lv: "Latvian", lt: "Lithuanian", sq: "Albanian", eu: "Basque", gl: "Galician" };
const fold = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9Ͱ-ϿЀ-ӿ ]+/g, " ").replace(/\s+/g, " ").trim();
const STOPW = new Set("the of and a an de la el le les du del della di da dei degli des los las lo il st saint san santa sant santo church museum".split(" "));
function sameName(a, b) {
  const ta = fold(a).split(" ").filter(t => t.length > 1 && !STOPW.has(t)), tb = new Set(fold(b).split(" "));
  if (!ta.length) return fold(a) === fold(b);
  return ta.filter(t => tb.has(t) || [...tb].some(x => x.length > 4 && t.length > 4 && x.slice(0, 5) === t.slice(0, 5))).length / ta.length >= 0.75;
}
const SEC_SEE = /^(see|sights|vedere|cosa vedere|da vedere|ver|que ver|lugares de interes|voir|a voir|sehenswurdigkeiten|sehenswertes|δειτε|αξιοθεατα|gormek|gorulecek yerler|zien|bezienswaardigheden|veja|o que ver)/;
const SEC_EAT = /^(eat|mangiare|dove mangiare|comer|donde comer|manger|ou manger|essen|kuche|restaurants|φατε|φαγητο|yemek|eten|onde comer)/;
const SEC_DRINK = /^(drink|bere|beber|donde beber|sortir|boire|ausgehen|nachtleben|ποτο|ποτα|icmek|uitgaan)/;
function parseListings(wt) {
  const out = [], heads = []; const hr = /^==\s*([^=].*?)\s*==\s*$/gm; let hm;
  while ((hm = hr.exec(wt))) heads.push({ at: hm.index, name: fold(hm[1]) });
  const secAt = i => { let n = ""; for (const x of heads) { if (x.at > i) break; n = x.name; } return n; };
  const clean = t => String(t || "").replace(/\{\{[^{}]*\}\}/g, "").replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1").replace(/\[https?:\/\/\S+\s([^\]]*)\]/g, "$1").replace(/'{2,}/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  let i = 0;
  while ((i = wt.indexOf("{{", i)) >= 0) {
    let j = i + 2, depth = 1; while (j < wt.length && depth) { if (wt.startsWith("{{", j)) { depth++; j += 2; } else if (wt.startsWith("}}", j)) { depth--; j += 2; } else j++; }
    const body = wt.slice(i + 2, j - 2); let d2 = 0, cur = ""; const parts = [];
    for (let k = 0; k < body.length; k++) { const c = body[k]; if (body.startsWith("{{", k) || body.startsWith("[[", k)) d2++; if (body.startsWith("}}", k) || body.startsWith("]]", k)) d2--; if (c === "|" && d2 <= 0) { parts.push(cur); cur = ""; } else cur += c; }
    parts.push(cur); const tname = fold(parts[0]); const f = {};
    parts.slice(1).forEach(x => { const e = x.indexOf("="); if (e > 0) f[fold(x.slice(0, e))] = x.slice(e + 1).trim(); });
    const name = clean(f.name || f.nome || f.nombre || f.nom || f["ονομα"] || f.isim || f.naam || "");
    if (name && name.length < 90 && (f.wikidata || f.lat || f.content || f.descrizione || f.descripcion || f.description || f["περιγραφη"] || f.beschreibung || f.alt)) {
      const typ = fold(f.type || f.tipo || f.typ || ""), sec = secAt(i);
      const kind = /^(see|vedere|ver|voir|sehen|do)$/.test(tname) && tname !== "do" ? "see" : /^(eat|mangiare|comer|manger|essen)$/.test(tname) ? "eat" : /^(drink|bere|beber|boire|trinken)$/.test(tname) ? "drink"
        : /^(see|sight|monument|museum|church|vedere|ver|voir)/.test(typ) ? "see" : /^(eat|restaurant|mangiare|comer|manger)/.test(typ) ? "eat" : /^(drink|bar)/.test(typ) ? "drink"
        : SEC_SEE.test(sec) ? "see" : SEC_EAT.test(sec) ? "eat" : SEC_DRINK.test(sec) ? "drink" : "";
      const lat = parseFloat(f.lat), lng = parseFloat(f.long || f.lng || f.lon);
      if (kind) out.push({ kind, name, wd: /^Q\d+$/.test(f.wikidata || "") ? f.wikidata : "", lat: isFinite(lat) ? lat : null, lng: isFinite(lng) ? lng : null,
        content: clean(f.content || f.descrizione || f.descripcion || f.description || f["περιγραφη"] || f.beschreibung || "").slice(0, 400), url: f.url || f.sito || f.web || "" });
    }
    i = j;
  }
  return out;
}
async function voyagePages(host, title, UA) {
  const get = async t => { try { const r = await fetch(`https://${host}/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&redirects=1&page=` + encodeURIComponent(t), { headers: UA, signal: AbortSignal.timeout(12000) }); if (r.ok) { const j = await r.json(); if (j.parse && j.parse.wikitext) return { title: j.parse.title, wt: j.parse.wikitext }; } } catch (e) {} return null; };
  const top = await get(title); if (!top) return { pages: 0, listings: [] };
  // Big cities keep their sights on district pages (Rome/Vatican, Barcelona/Eixample): read those too.
  const esc = top.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), subs = [...new Set([...top.wt.matchAll(new RegExp("\\[\\[" + esc + "/([^|\\]#]+)", "g"))].map(m => top.title + "/" + m[1].trim()))].slice(0, 14);
  const more = (await Promise.all(subs.map(get))).filter(Boolean);
  const listings = [top, ...more].flatMap(p => parseListings(p.wt));
  return { pages: 1 + more.length, title: top.title, listings };
}
async function sourcesData(label, env, ctx) {
  const key = "sr4:" + (await sha(label.toLowerCase())), hit = await env.USAGE.get(key); if (hit) return JSON.parse(hit);
  const UA = { "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)" };
  const getJ = async (u, ms, opt) => { for (let t = 0; t < 2; t++) { try { const r = await fetch(u, Object.assign({ headers: { ...UA, accept: "application/json" }, signal: AbortSignal.timeout(ms || 20000) }, opt || {})); if (r.ok) return await r.json(); } catch (e) {} } return null; };
  const T = {}, t0 = Date.now(), lap = k => { T[k] = Date.now() - t0; };
  const fam = await famousData(label, env, ctx); lap("fame");
  if (fam.error) return fam;
  const area = fam.area, center = fam.center, kmOf = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 111 * Math.cos(b.lat * Math.PI / 180));
  // The city's Wikidata item tells which language is local here and which local Wikivoyage page covers it.
  const enGuess = area.split(",")[0].trim(), enP = voyagePages("en.wikivoyage.org", enGuess, UA).then(v => { lap("enVoy"); return v; });
  let lang = "", localVoy = "", localWiki = "";
  const enTitle0 = (await enP).title || area.split(",")[0].trim();
  const ent = await getJ("https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&normalize=1&props=sitelinks|claims&sites=enwikivoyage&titles=" + encodeURIComponent(enTitle0), 15000);
  const city = ent && Object.values(ent.entities || {}).find(e => e && e.sitelinks);
  if (city) {
    const ids = c => ((city.claims && city.claims[c]) || []).map(x => x.mainsnak && x.mainsnak.datavalue && x.mainsnak.datavalue.value && x.mainsnak.datavalue.value.id).filter(Boolean);
    let langs = ids("P37");
    if (!langs.length && ids("P17").length) { const cj = await getJ("https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=" + ids("P17")[0], 15000); const ce = cj && cj.entities && Object.values(cj.entities)[0]; langs = ((ce && ce.claims && ce.claims.P37) || []).map(x => x.mainsnak.datavalue && x.mainsnak.datavalue.value.id).filter(Boolean); }
    if (langs.length) { const lj = await getJ("https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=" + langs.slice(0, 4).join("|"), 15000);
      const codes = langs.map(id => { const e = lj && lj.entities && lj.entities[id]; const c = e && e.claims && e.claims.P424 && e.claims.P424[0].mainsnak.datavalue; return c ? c.value : ""; }).filter(c => c && c !== "en");
      lang = codes.find(c => city.sitelinks[c + "wikivoyage"]) || codes[0] || "";
      if (lang && city.sitelinks[lang + "wikivoyage"]) localVoy = city.sitelinks[lang + "wikivoyage"].title;
      if (lang && city.sitelinks[lang + "wiki"]) localWiki = city.sitelinks[lang + "wiki"].title; }
  }
  lap("lang");
  const [enV, lcV] = await Promise.all([enP, localVoy ? voyagePages(lang + ".wikivoyage.org", localVoy, UA).then(v => { lap("localVoy"); return v; }) : Promise.resolve({ pages: 0, listings: [] })]);
  const LN = LANG_NAME[lang] || lang;
  const S = { fame: "Wikidata (Wikipedia in many languages)", localWiki: `Wikipedia in ${LN}`, enVoy: "Wikivoyage (English)", lcVoy: `Wikivoyage (${LN})`, heritage: "national heritage register", unesco: "UNESCO World Heritage" };
  // Gather every sight by Wikidata id where the source gives one.
  const byId = new Map(), noId = [];
  const add = (wd, name, lat, lng, src, extra) => {
    let x = wd && byId.get(wd);
    if (!x && !wd) x = [...byId.values(), ...noId].find(y => sameName(name, y.name) && (y.lat == null || lat == null || kmOf({ lat, lng }, y) < 1.5));
    if (!x) { x = { name, wd: wd || "", lat, lng, src: new Set(), sl: 0 }; if (wd) byId.set(wd, x); else noId.push(x); }
    x.src.add(src); if (x.lat == null && lat != null) { x.lat = lat; x.lng = lng; } Object.assign(x, extra || {});
    return x;
  };
  for (const m of fam.main) { const x = add(m.wd, m.name, m.lat, m.lng, S.fame, { sl: m.sl, unesco: m.unesco, heritage: m.heritage }); if (m.unesco) x.src.add(S.unesco); else if (m.heritage) x.src.add(S.heritage); }
  for (const l of enV.listings.filter(l => l.kind === "see")) add(l.wd, l.name, l.lat, l.lng, S.enVoy, { en: l.content, web: l.url || undefined });
  for (const l of lcV.listings.filter(l => l.kind === "see")) { const x = add(l.wd, l.name, l.lat, l.lng, S.lcVoy); x.local = x.local || l.name; x.lc = l.content; }
  // Facts for every id from Wikidata: local-language article, official website, heritage status, place, fame.
  const ids = [...byId.keys()].slice(0, 200), chunks = []; for (let k = 0; k < ids.length; k += 50) chunks.push(ids.slice(k, k + 50));
  const answers = await Promise.all(chunks.map(part => {
    const V = `VALUES ?item { ${part.map(x => "wd:" + x).join(" ")} }`, H2 = { headers: { ...UA, accept: "application/sparql-results+json" } }, url = q => "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q);
    return Promise.all([getJ(url(`SELECT ?item ?h ?w ?loc ?lab ?sl WHERE { ${V} OPTIONAL { ?item wdt:P1435 ?h } OPTIONAL { ?item wdt:P856 ?w } OPTIONAL { ?item wdt:P625 ?loc } OPTIONAL { ?item rdfs:label ?lab FILTER(LANG(?lab) = "en") } OPTIONAL { ?item wikibase:sitelinks ?sl } }`), 25000, H2),
      lang ? getJ(url(`SELECT ?item ?local WHERE { ${V} ?a schema:about ?item ; schema:isPartOf <https://${lang}.wikipedia.org/> ; schema:name ?local }`), 25000, H2) : null]).then(([a, b]) => ({ results: { bindings: [...((a && a.results.bindings) || []), ...((b && b.results.bindings) || [])] } })); }));
  lap("details");
  for (const j of answers) {
    for (const b of (j && j.results && j.results.bindings) || []) {
      const x = byId.get(b.item.value.split("/").pop()); if (!x) continue;
      if (b.lab && b.lab.value) x.name = b.lab.value;
      const m = b.loc && /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.loc.value); if (m && x.lat == null) { x.lat = +m[2]; x.lng = +m[1]; }
      if (b.web && !x.web) x.web = b.web.value; if (b.sl) x.sl = Math.max(x.sl, +b.sl.value);
      if (b.h) { if (b.h.value.endsWith("/Q9259")) { x.unesco = true; x.src.add(S.unesco); x.src.delete(S.heritage); } else if (!x.unesco) { x.heritage = true; x.src.add(S.heritage); } }
      if (b.local && b.local.value) { x.src.add(S.localWiki); x.local = x.local || b.local.value; }
    }
  }
  const near = x => x.lat == null || kmOf(x, center) <= 12;
  const stops = [...byId.values(), ...noId].filter(x => x.name && !/^Q\d+$/.test(x.name) && near(x) && fold(x.name) !== fold(area))
    .map(x => ({ name: x.name, local: x.local && x.local !== x.name ? x.local : undefined, wd: x.wd || undefined, lat: x.lat != null ? +(+x.lat).toFixed(5) : undefined, lng: x.lng != null ? +(+x.lng).toFixed(5) : undefined, sl: x.sl || 0, unesco: !!x.unesco, heritage: !!x.heritage, web: x.web, src: [...x.src], en: x.en || undefined, lc: x.lc || undefined }))
    .sort((a, b) => b.src.length - a.src.length || b.sl - a.sl).slice(0, 160);
  // Restaurants and cafes the guidebooks name (English and local), for cross-checking the map's list.
  const eats = [];
  for (const [v, src] of [[enV, S.enVoy], [lcV, S.lcVoy]]) for (const l of v.listings.filter(l => l.kind === "eat" || l.kind === "drink")) {
    const x = eats.find(y => sameName(l.name, y.name) && (y.lat == null || l.lat == null || kmOf(l, y) < 0.4));
    if (x) { if (!x.src.includes(src)) x.src.push(src); if (x.lat == null && l.lat != null) { x.lat = l.lat; x.lng = l.lng; } }
    else eats.push({ name: l.name, lat: l.lat, lng: l.lng, kind: l.kind, note: l.content.slice(0, 200), src: [src] });
  }
  const sources = [
    { name: S.fame, n: fam.main.length }, { name: S.enVoy, n: enV.listings.length, pages: enV.pages },
    { name: S.lcVoy, n: lcV.listings.length, pages: lcV.pages, none: !localVoy }, { name: S.localWiki, n: stops.filter(x => x.src.includes(S.localWiki)).length, none: !lang },
{ name: "Heritage registers and UNESCO", n: stops.filter(x => x.unesco || x.heritage).length }];
  const res = { area, lang, langName: LN, center, sources, stops, eats: eats.slice(0, 150), far: fam.far, ms: T };
  // Keep a full answer for 30 days; an answer missing a source that failed is kept only a day.
  ctx.waitUntil(env.USAGE.put(key, JSON.stringify(res), { expirationTtl: (enV.pages && fam.main.length ? 30 : 1) * 86400 }));
  return res;
}

// ---------- Street routes for the day map ----------
const ROUTE_UA = { "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)" };
const r5 = n => Math.round(n * 1e5) / 1e5;
// Google/Valhalla encoded polyline (precision 6 for Valhalla) to [lng, lat] pairs
function decodePoly(str, prec) {
  const f = Math.pow(10, prec), out = []; let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    for (const k of [0, 1]) {
      let sh = 0, res = 0, c;
      do { c = str.charCodeAt(i++) - 63; res |= (c & 31) << sh; sh += 5; } while (c >= 32);
      const d = res & 1 ? ~(res >> 1) : res >> 1;
      if (k === 0) lat += d; else lng += d;
    }
    out.push([r5(lng / f), r5(lat / f)]);
  }
  return out;
}
async function osrmLeg(l) {
  const host = l.m === "car" ? "routed-car/route/v1/driving" : "routed-foot/route/v1/foot";
  const r = await fetch(`https://routing.openstreetmap.de/${host}/${l.a[0]},${l.a[1]};${l.b[0]},${l.b[1]}?overview=full&geometries=geojson&steps=false`, { headers: ROUTE_UA });
  if (!r.ok) throw new Error("osrm " + r.status);
  const j = await r.json(), rt = j.routes && j.routes[0];
  if (!rt || !rt.geometry || rt.geometry.coordinates.length < 2) throw new Error("no route");
  return { c: rt.geometry.coordinates.map(p => [r5(p[0]), r5(p[1])]), km: Math.round(rt.distance) / 1000, min: Math.round(rt.duration / 60), src: "osrm" };
}
async function valhallaLeg(l) {
  const q = { locations: [{ lon: l.a[0], lat: l.a[1] }, { lon: l.b[0], lat: l.b[1] }], costing: l.m === "car" ? "auto" : "pedestrian", directions_type: "none" };
  const r = await fetch("https://valhalla1.openstreetmap.de/route?json=" + encodeURIComponent(JSON.stringify(q)), { headers: ROUTE_UA });
  if (!r.ok) throw new Error("valhalla " + r.status);
  const j = await r.json(), t = j.trip;
  if (!t || !t.legs || !t.legs[0]) throw new Error("no route");
  const c = decodePoly(t.legs[0].shape, 6); if (c.length < 2) throw new Error("no route");
  return { c, km: Math.round(t.summary.length * 1000) / 1000, min: Math.round(t.summary.time / 60), src: "valhalla" };
}
async function routeLeg(l, env, ctx) {
  const key = `rt1:${l.m}:${r5(l.a[0])},${r5(l.a[1])};${r5(l.b[0])},${r5(l.b[1])}`;
  const hit = await env.USAGE.get(key, "json"); if (hit) return hit;
  let res = null;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  // OSRM first, then Valhalla, then both again after a pause (each turns away bursts with "429 busy").
  for (const pause of [0, 1200]) {
    if (pause) await wait(pause);
    try { res = await osrmLeg(l); break; } catch (e) { try { res = await valhallaLeg(l); break; } catch (e2) {} }
  }
  if (!res) return null;
  ctx.waitUntil(env.USAGE.put(key, JSON.stringify(res), { expirationTtl: 90 * 86400 }));
  return res;
}
