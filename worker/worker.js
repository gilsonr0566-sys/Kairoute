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

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get("Origin") || "", h = cors(origin);
    if (req.method === "OPTIONS") return new Response(null, { headers: h });
    const url = new URL(req.url);
    const { DAILY_NEURONS, VOICE_DAILY, LAB_LEFT, VOICE_TOTAL = DAILY_NEURONS } = await limits(env), lab = req.headers.get("x-kairoute-lab") === "1";
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
        try { const rr = await fetch(ep, { method: "POST", signal: AbortSignal.timeout(20000), body: "data=" + encodeURIComponent(q), headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)" } }); tried.push(ep.split("/")[2] + " " + rr.status); if (rr.ok) { data = await rr.json(); break; } } catch (e) { tried.push(ep.split("/")[2] + " " + e.message); }
      }
      if (!data) return Response.json({ error: "map busy", tried }, { status: 502, headers: h });
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
    if (url.pathname === "/ratings") {
      const city = String(url.searchParams.get("city") || "");
      if (!/^[a-z0-9 ,'-]{1,80}$/.test(city)) return Response.json({ error: "Bad request" }, { status: 400, headers: h });
      const raw = JSON.parse((await env.USAGE.get("rt1:" + city)) || "{}"), out = {};
      for (const [k, v] of Object.entries(raw)) if (v.n) out[k] = { avg: +(v.s / v.n).toFixed(2), n: v.n };
      return Response.json({ ratings: out }, { headers: { ...h, "cache-control": "public, max-age=120" } });
    }
    if (url.pathname === "/rate" && req.method === "POST") {
      let b; try { b = await req.json(); } catch (e) { b = {}; }
      const city = String(b.city || ""), place = String(b.place || ""), stars = Math.round(+b.stars), dev = String(b.dev || "");
      if (!/^[a-z0-9 ,'-]{1,80}$/.test(city) || !/^[a-z0-9 ,'&.-]{1,80}$/.test(place) || !(stars >= 1 && stars <= 5) || !/^[a-f0-9]{16,40}$/.test(dev)) return Response.json({ error: "Bad request" }, { status: 400, headers: h });
      const ip = req.headers.get("cf-connecting-ip") || "x", ik = "ri:" + ip + ":" + today(), used = +(await env.USAGE.get(ik)) || 0;
      if (used >= 30) return Response.json({ error: "Thanks! That's the limit for today." }, { status: 429, headers: h });
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
