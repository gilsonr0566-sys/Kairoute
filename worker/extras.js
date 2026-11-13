// Kairoute guide extras (routes under /x/). Every fact here comes from a real, named source:
// OpenStreetMap (viewpoints, restrooms, water, pharmacies, cash machines), Wikivoyage (etiquette, tipping,
// prices, scams), Wikidata (film locations). The AI only rewrites or condenses text it is handed and is told
// to add nothing; each answer is made once and kept, so every traveler shares it and the cost stays tiny.
const UA = { "user-agent": "Kairoute/1.0 (travel guide; https://gilsonr0566-sys.github.io/Kairoute/)" };
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
const GROUP_TTL = 2 * 86400;

async function overpass(q) {
  for (const ep of OVERPASS) {
    try {
      const r = await fetch(ep, { method: "POST", signal: AbortSignal.timeout(20000), body: "data=" + encodeURIComponent(q), headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", ...UA } });
      if (r.ok) { const d = await r.json(); if ((d.elements || []).length || !d.remark) return d; }
    } catch (e) {}
  }
  return null;
}
const ll = e => [e.lat ?? (e.center && e.center.lat), e.lon ?? (e.center && e.center.lon)];
const r5 = n => +(+n).toFixed(5);
function cleanWiki(t) {
  return String(t || "").replace(/<!--[\s\S]*?-->/g, "").replace(/\{\{[^{}]*\}\}/g, "").replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, "").replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1").replace(/\[https?:\/\/\S+\s([^\]]*)\]/g, "$1")
    .replace(/'{2,}/g, "").replace(/<[^>]+>/g, "").replace(/^[*#:;]+\s*/gm, "• ").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
}
// The text of a Wikivoyage section and its subsections (e.g. "Buy" with its "Money", "Tipping" and "Costs" parts).
function sectionText(wt, names) {
  const out = [];
  const re = /^(==+)\s*([^=\n]+?)\s*\1\s*$/gm, heads = []; let m;
  while ((m = re.exec(wt))) heads.push({ lvl: m[1].length, name: m[2].trim(), at: m.index, body: m.index + m[0].length });
  heads.forEach((hd, i) => {
    if (!names.test(hd.name)) return;
    let end = wt.length; for (let j = i + 1; j < heads.length; j++) if (heads[j].lvl <= hd.lvl) { end = heads[j].at; break; }
    const body = wt.slice(hd.body, end).replace(/\{\{\s*(see|do|eat|drink|buy|sleep|listing)\s*\|[\s\S]*?\}\}/gi, "");
    const txt = cleanWiki(body); if (txt.length > 40) out.push(hd.name + ": " + txt);
  });
  return out.join("\n");
}
async function voyage(title) {
  try {
    const r = await fetch("https://en.wikivoyage.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&redirects=1&page=" + encodeURIComponent(title), { headers: UA, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null; const j = await r.json(); return j.parse && j.parse.wikitext ? { title: j.parse.title, wt: j.parse.wikitext } : null;
  } catch (e) { return null; }
}
async function runAI(H, env, ctx, prompt, maxTokens, temp) {
  if ((await H.used(env)) + 80 > H.DAILY_NEURONS) throw new Error("allowance");
  const out = await env.AI.run(H.MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: maxTokens, temperature: temp ?? 0.3, chat_template_kwargs: { enable_thinking: false } });
  const ch = out && out.choices && out.choices[0];
  const raw = typeof (out && out.response) === "string" ? out.response : (ch && ch.message && ch.message.content) || "";
  const u = (out && out.usage) || {}; ctx.waitUntil(H.addUse(env, (+u.prompt_tokens || prompt.length / 4) * H.IN_RATE + (+u.completion_tokens || raw.length / 3) * H.OUT_RATE));
  return raw;
}
const jsonOf = raw => { try { return JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)); } catch (e) { return null; } };
// Words of a rewrite that are not in its source: a rewrite may not bring in new names or numbers.
function newFacts(src, out) {
  const have = new Set((src.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []));
  const nums = (out.match(/\b\d[\d,.]*\b/g) || []).filter(n => !have.has(n.toLowerCase().replace(/[.,]$/, "")) && !/^(1|2|3|4|5|6|7|8|9|10|100)$/.test(n));
  const names = (out.match(/(?<=[a-z,;] )[A-Z][\p{L}'-]{2,}/gu) || []).filter(w => !have.has(w.toLowerCase()));
  return [...new Set([...nums, ...names])];
}

// What each kind of rewrite is for. The traveler's app sends only the source text; the instructions live here.
const WRITE = {
  kids: { max: 700, words: [60, 190], prompt: (t, x) => `Rewrite this tour-guide story for children aged 6 to 11 visiting ${x.name || "this place"}. About 120 words, spoken out loud by a fun, warm guide.
Rules: use ONLY facts from the story below; add no new facts, names, dates or numbers. Short sentences, simple words, one "Can you imagine...?" or "Look for..." moment. No lists, no markdown.
Reply with JSON only: {"text":"..."}

Story:
"""${t}"""` },
  primer: { max: 1600, words: [180, 520], prompt: (t, x) => `Write the "before you arrive" story of ${x.name}, for a traveler to listen to on the plane, ship or train the night before. About 350 words (two and a half minutes spoken), warm and vivid, like a great guide setting the scene: who built the place, the big moments of its history, what it feels like today, and what to look forward to seeing.
Rules: use ONLY facts stated in the source notes below; add no new facts, names, dates or numbers. If the notes are thin, write less rather than invent. Plain paragraphs, no headings, lists or markdown.
Reply with JSON only: {"text":"..."}

Source notes:
"""${t}"""` },
  theme: { max: 400, words: [12, 110], prompt: (t, x) => `A traveler is on a "${x.theme}" theme tour. Using ONLY the facts in the stop's guide text below, write one or two sentences (at most 60 words) telling them how ${x.name} connects to that theme, as a guide would say it.
If the text does not clearly connect this stop to the theme, reply {"text":"NONE"}. Never invent a connection, name, date or number.
Reply with JSON only: {"text":"..."}

Guide text for ${x.name}:
"""${t}"""` }
};

export async function extras(req, env, ctx, url, h, H) {
  const p = url.pathname, q = url.searchParams, json = (o, s) => Response.json(o, { status: s || 200, headers: h });
  const sendRaw = (body, s) => new Response(body, { status: s || 200, headers: { ...h, "content-type": "application/json" } });
  const okOrigin = () => !H.origin || H.ALLOWED.some(r => r.test(H.origin));

  // Real places near a point: named viewpoints for photos (what=view), or restrooms, drinking water,
  // pharmacies and cash machines for "where's the nearest...?" (what=amen).
  if (p === "/x/near") {
    const la = +(+q.get("lat")).toFixed(3), ln = +(+q.get("lng")).toFixed(3), what = q.get("what") === "amen" ? "amen" : "view";
    if (!isFinite(la) || !isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) return json({ error: "Bad request" }, 400);
    const key = "xn1:" + what + ":" + la + "," + ln, hit = await env.USAGE.get(key); if (hit) return sendRaw(hit);
    const A = what === "view" ? `(around:2000,${la},${ln})` : `(around:700,${la},${ln})`;
    const qq = what === "view"
      ? `[out:json][timeout:25];(nwr["tourism"="viewpoint"]["name"]${A};nwr["tourism"="viewpoint"]["wikidata"]${A};);out center tags 80;`
      : `[out:json][timeout:25];(nwr["amenity"~"^(toilets|drinking_water|pharmacy|atm)$"]${A};nwr["amenity"="bank"]["atm"="yes"]${A};);out center tags 200;`;
    const d = await overpass(qq); if (!d) return json({ error: "map busy" }, 502);
    const list = [];
    for (const e of d.elements || []) {
      const t = e.tags || {}, [lat, lng] = ll(e); if (!isFinite(lat)) continue;
      if (what === "view") list.push({ name: t["name:en"] || t.name || "", local: t.name && t["name:en"] && t.name !== t["name:en"] ? t.name : undefined, lat: r5(lat), lng: r5(lng), wd: t.wikidata || undefined, dir: t.direction || undefined, desc: (t.description || "").slice(0, 160) || undefined });
      else list.push({ kind: t.amenity === "bank" ? "atm" : t.amenity, name: t["name:en"] || t.name || t.operator || t.brand || "", lat: r5(lat), lng: r5(lng), fee: t.fee || undefined, hours: t.opening_hours || undefined, wheelchair: t.wheelchair || undefined, access: t.access || undefined });
    }
    const out = JSON.stringify({ [what === "view" ? "spots" : "places"]: list.filter(x => what !== "view" || x.name).slice(0, 120), source: "OpenStreetMap" });
    if (list.length) ctx.waitUntil(env.USAGE.put(key, out, { expirationTtl: (what === "view" ? 60 : 14) * 86400 }));
    return sendRaw(out);
  }

  // Local know-how for a city: etiquette, tipping, fair prices and scams, from the city's and the country's
  // Wikivoyage articles. The AI only sorts and shortens those sections; with no AI left today, the sections
  // themselves come back (shortened) so the traveler still gets the sourced advice.
  if (p === "/x/knowhow") {
    const city = String(q.get("city") || "").replace(/\s*\(.*?\)\s*/g, " ").split(",")[0].trim().slice(0, 80), country = String(q.get("country") || "").trim().slice(0, 60);
    if (!city) return json({ error: "Empty" }, 400);
    const key = "kh2:" + (await H.sha((city + "|" + country).toLowerCase())), hit = await env.USAGE.get(key); if (hit) return sendRaw(hit);
    const [cp, kp] = await Promise.all([voyage(city), country ? voyage(country) : null]);
    const SECT = /^(respect|stay safe|stay healthy|buy|money|costs?|tipping|bargaining|haggling|shopping|cope|scams?|crime|eat|etiquette|dress code|talk)$/i;
    const parts = [];
    if (cp) parts.push({ src: cp.title, text: sectionText(cp.wt, SECT).slice(0, 6000) });
    if (kp && (!cp || kp.title !== cp.title)) parts.push({ src: kp.title, text: sectionText(kp.wt, SECT).slice(0, 6000) });
    const usable = parts.filter(x => x.text.length > 80);
    if (!usable.length) { const none = JSON.stringify({ none: true }); ctx.waitUntil(env.USAGE.put(key, none, { expirationTtl: 7 * 86400 })); return sendRaw(none); }
    const sources = usable.map(x => ({ title: x.src, url: "https://en.wikivoyage.org/wiki/" + encodeURIComponent(x.src.replace(/ /g, "_")) }));
    const material = usable.map(x => `From Wikivoyage "${x.src}":\n${x.text}`).join("\n\n");
    const prompt = `Below are travel-guide sections about ${city}${country ? ", " + country : ""}. Pick out the practical advice a visitor needs, in four groups:
- "etiquette": dress codes (especially for churches and monasteries), greetings, gestures, behaviour that locals appreciate or dislike
- "tipping": how much to tip in restaurants, cafés, taxis, for guides
- "prices": fair prices and costs that are stated (meals, taxis, entry, bargaining advice)
- "scams": scams, pickpockets, tourist traps and how to avoid them
Rules: use ONLY what the sections say; never add advice, prices or numbers that are not in them. Each item is one short, plain sentence (at most 25 words), written to the traveler ("Cover your shoulders in churches."). Up to 5 items per group; leave a group empty if the sections say nothing about it. Say which source each item came from by its exact title.
Reply with JSON only: {"etiquette":[{"t":"...","src":"..."}],"tipping":[],"prices":[],"scams":[]}

${material}`;
    let groups = null;
    try { const raw = await runAI(H, env, ctx, prompt, 1400, 0.2); const j = jsonOf(raw);
      if (j) { groups = {}; for (const g of ["etiquette", "tipping", "prices", "scams"]) groups[g] = (Array.isArray(j[g]) ? j[g] : []).map(x => typeof x === "string" ? { t: x } : x).filter(x => x && x.t && String(x.t).length < 260).slice(0, 5).map(x => ({ t: String(x.t).trim(), src: usable.some(u => u.src === x.src) ? x.src : usable[0].src })); }
    } catch (e) {}
    // A condensed item must not bring in numbers that aren't in the sections.
    if (groups) for (const g in groups) groups[g] = groups[g].filter(x => !(String(x.t).match(/\d[\d.,]*/g) || []).some(n => !material.includes(n.replace(/[.,]$/, ""))));
    const has = groups && Object.values(groups).some(a => a.length);
    const body = JSON.stringify(has ? { groups, sources, at: new Date().toISOString().slice(0, 10) } : { raw: usable.map(x => ({ src: x.src, text: x.text.slice(0, 1800) })), sources });
    if (has) ctx.waitUntil(env.USAGE.put(key, body, { expirationTtl: 60 * 86400 }));
    return sendRaw(body);
  }

  // Grounded rewrites: kids' version of a stop story, the before-you-arrive story of a city, a stop's link to a theme.
  if (p === "/x/write" && req.method === "POST") {
    if (!okOrigin()) return json({ error: "Not allowed" }, 403);
    let b; try { b = await req.json(); } catch (e) { return json({ error: "Bad request" }, 400); }
    const W = WRITE[b.kind]; if (!W) return json({ error: "Bad request" }, 400);
    const text = String(b.text || "").slice(0, b.kind === "primer" ? 9000 : 3000).trim(), x = { name: String(b.name || "").slice(0, 120), theme: String(b.theme || "").slice(0, 80) };
    if (text.length < 80) return json({ error: "Too little to go on" }, 400);
    const key = "xw1:" + b.kind + ":" + (await H.sha(JSON.stringify([text, x]))), hit = await env.USAGE.get(key); if (hit) return sendRaw(hit);
    let raw; try { raw = await runAI(H, env, ctx, W.prompt(text, x), W.max, 0.4); } catch (e) { return json({ error: e.message === "allowance" ? "allowance used up" : "busy" }, e.message === "allowance" ? 429 : 502); }
    const j = jsonOf(raw), out = j && typeof j.text === "string" ? j.text.trim() : "";
    if (b.kind === "theme" && /^none\.?$/i.test(out)) { const body = JSON.stringify({ none: true }); ctx.waitUntil(env.USAGE.put(key, body, { expirationTtl: 180 * 86400 })); return sendRaw(body); }
    const words = out.split(/\s+/).length;
    if (!out || words < W.words[0] || words > W.words[1]) return json({ error: "No text" }, 502);
    // Safety: a rewrite that brings in names or numbers the source doesn't have is thrown away.
    const extra = newFacts(text + " " + x.name + " " + x.theme, out);
    if (extra.length > (b.kind === "primer" ? 2 : 1)) return json({ error: "Rewrite added facts", extra: extra.slice(0, 8) }, 422);
    const body = JSON.stringify({ text: out });
    ctx.waitUntil(env.USAGE.put(key, body, { expirationTtl: 365 * 86400 }));
    return sendRaw(body);
  }

  // Film and TV locations near a point, from Wikidata ("filming location" statements on real works).
  if (p === "/x/film") {
    const la = +(+q.get("lat")).toFixed(3), ln = +(+q.get("lng")).toFixed(3); if (!isFinite(la) || !isFinite(ln)) return json({ error: "Bad request" }, 400);
    const key = "xf1:" + la + "," + ln, hit = await env.USAGE.get(key); if (hit) return sendRaw(hit);
    const sparql = `SELECT ?place ?placeLabel ?work ?workLabel ?year ?coord WHERE {
      SERVICE wikibase:around { ?place wdt:P625 ?coord. bd:serviceParam wikibase:center "Point(${ln} ${la})"^^geo:wktLiteral; wikibase:radius "4". }
      ?work wdt:P915 ?place. OPTIONAL { ?work wdt:P577 ?date. BIND(YEAR(?date) AS ?year) }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 300`;
    let rows = [];
    try { const r = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(sparql), { headers: { ...UA, accept: "application/sparql-results+json" }, signal: AbortSignal.timeout(25000) });
      if (!r.ok) return json({ error: "busy" }, 502); rows = ((await r.json()).results || {}).bindings || []; } catch (e) { return json({ error: "busy" }, 502); }
    const by = new Map();
    for (const r of rows) {
      const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(r.coord && r.coord.value || ""); if (!m) continue;
      const id = r.place.value.split("/").pop(), name = r.placeLabel && r.placeLabel.value, work = r.workLabel && r.workLabel.value;
      if (!name || /^Q\d+$/.test(name) || !work || /^Q\d+$/.test(work)) continue;
      const e = by.get(id) || { wd: id, name, lat: r5(m[2]), lng: r5(m[1]), works: [] };
      if (!e.works.some(w => w.title === work)) e.works.push({ title: work, year: r.year ? +r.year.value : undefined, wd: r.work.value.split("/").pop() });
      by.set(id, e);
    }
    const body = JSON.stringify({ places: [...by.values()].map(e => (e.works.sort((a, b) => (b.year || 0) - (a.year || 0)), e.works = e.works.slice(0, 6), e)).slice(0, 60), source: "Wikidata" });
    ctx.waitUntil(env.USAGE.put(key, body, { expirationTtl: 60 * 86400 }));
    return sendRaw(body);
  }

  // Group tours: one leader, everyone else follows on their own phone. The group lives in a Durable Object,
  // so every follower sees the leader's latest step at once (no stale copies). Codes last two days.
  if (p === "/x/group") {
    if (!env.GROUPS) return json({ error: "Groups are not set up yet" }, 503);
    if (req.method === "POST" && !okOrigin()) return json({ error: "Not allowed" }, 403);
    const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let b = {}; if (req.method === "POST") { try { b = await req.json(); } catch (e) { return json({ error: "Bad request" }, 400); } }
    let code = String(b.code || q.get("code") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (b.op === "new") code = Array.from(crypto.getRandomValues(new Uint8Array(6)), v => ALPHA[v % ALPHA.length]).join("");
    if (!/^[A-Z0-9]{6}$/.test(code)) return json({ error: "Bad code" }, 400);
    const stub = env.GROUPS.get(env.GROUPS.idFromName(code));
    const r = await stub.fetch("https://group/" + (req.method === "POST" ? "post" : "get") + "?since=" + (+q.get("since") || 0) + "&code=" + code, req.method === "POST" ? { method: "POST", body: JSON.stringify(b) } : {});
    return new Response(r.body, { status: r.status, headers: { ...h, "content-type": "application/json", "cache-control": "no-store" } });
  }
  return json({ error: "Not found" }, 404);
}

// One group tour. State: the trip snapshot (sent once by the leader, refreshed when the plan changes), the
// leader's live position in the tour (day, step, part, what is playing and since when) and the last regroup call.
export class Group {
  constructor(state) { this.state = state; }
  // A trip with its city guides can pass a megabyte, so it is kept in pieces.
  async putTrip(t) { const s = JSON.stringify(t), st = this.state.storage, n = Math.ceil(s.length / 100000); const old = (await st.get("tn")) || 0; const put = { tn: n }; for (let i = 0; i < n; i++) put["t" + i] = s.slice(i * 100000, (i + 1) * 100000); await st.put(put); for (let i = n; i < old; i++) await st.delete("t" + i); }
  async getTrip() { const st = this.state.storage, n = (await st.get("tn")) || 0; if (!n) return null; const m = await st.get(Array.from({ length: n }, (_, i) => "t" + i)); let s = ""; for (let i = 0; i < n; i++) s += m.get("t" + i) || ""; try { return JSON.parse(s); } catch (e) { return null; } }
  async fetch(req) {
    const u = new URL(req.url), st = this.state.storage, now = Date.now();
    let g = (await st.get("g")) || null;
    if (g && now - g.touched > GROUP_TTL * 1000) { await st.deleteAll(); g = null; }
    if (u.pathname === "/get") {
      if (!g) return Response.json({ error: "Unknown code" }, { status: 404 });
      const since = +u.searchParams.get("since") || 0, out = { rev: g.rev, live: g.live, regroup: g.regroup, name: g.name, now, followers: Object.keys(g.seen || {}).filter(k => now - g.seen[k] < 90000).length };
      if (since < g.tripRev) { out.trip = await this.getTrip(); out.tripRev = g.tripRev; }
      return Response.json(out);
    }
    let b = {}; try { b = await req.json(); } catch (e) {}
    if (b.op === "new") {
      if (g) return Response.json({ error: "Try again" }, { status: 409 });
      if (!b.trip || JSON.stringify(b.trip).length > 8e6) return Response.json({ error: "Bad trip" }, { status: 400 });
      const token = crypto.randomUUID();
      g = { token, rev: 1, tripRev: 1, live: b.live || null, regroup: null, name: String(b.name || "").slice(0, 80), touched: now, seen: {} };
      await this.putTrip(b.trip); await st.put("g", g);
      return Response.json({ code: u.searchParams.get("code"), token, rev: 1, now });
    }
    if (!g) return Response.json({ error: "Unknown code" }, { status: 404 });
    if (b.op === "hello") { g.seen = g.seen || {}; g.seen[String(b.who || "x").slice(0, 40)] = now; for (const k in g.seen) if (now - g.seen[k] > 600000) delete g.seen[k]; g.touched = now; await st.put("g", g); return Response.json({ ok: true, now }); }
    if (b.token !== g.token) return Response.json({ error: "Only the leader can do that" }, { status: 403 });
    if (b.op === "live") { g.live = Object.assign({}, b.live || {}, { at: now }); g.rev++; }
    else if (b.op === "regroup") { g.regroup = { where: String(b.where || "").slice(0, 160), lat: +b.lat || null, lng: +b.lng || null, note: String(b.note || "").slice(0, 160), at: now, id: now.toString(36) }; g.rev++; }
    else if (b.op === "trip") { if (!b.trip || JSON.stringify(b.trip).length > 8e6) return Response.json({ error: "Bad trip" }, { status: 400 }); await this.putTrip(b.trip); g.tripRev = g.rev + 1; g.rev++; }
    else if (b.op === "end") { await st.deleteAll(); return Response.json({ ok: true }); }
    else return Response.json({ error: "Bad request" }, { status: 400 });
    g.touched = now; await st.put("g", g);
    return Response.json({ rev: g.rev, now });
  }
}
