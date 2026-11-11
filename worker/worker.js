// Kairoute AI helper. The website sends a prompt (and optional photos); this Worker asks Workers AI
// and streams the answer back. A daily budget keeps usage inside Cloudflare's free allowance, so
// testing never costs money: once the budget is used up, requests stop until midnight UTC.
const MODEL = "@cf/google/gemma-4-26b-a4b-it";
// Gemma 4 26B costs about 9,091 neurons per million input tokens and 27,273 per million output tokens.
// The free allowance is 10,000 neurons a day; we stop at 9,700 (usage is counted from the real token counts, so this stays inside it).
const FREE_DAILY = 8500; // leaves 1,500 of the account-wide 10,000 for Richard's other app (light use)
// On Cloudflare's Workers Paid plan (set PAID = "1" in wrangler.toml), Kairoute may go past the free share,
// up to a monthly ceiling: 450,000 extra neurons is about $5, so the plan plus extras stays near $10 a month.
const MONTH_EXTRA = 450000, PAID_DAY_EXTRA = 30000;
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
async function addUse(env, n) {
  const k = "n:" + today(); const cur = +(await env.USAGE.get(k)) || 0, nxt = cur + n;
  await env.USAGE.put(k, String(+nxt.toFixed(3)), { expirationTtl: 3 * 86400 });
  const extra = Math.max(0, nxt - FREE_DAILY) - Math.max(0, cur - FREE_DAILY);
  if (extra > 0) { const mk = "x:" + month(); const m = +(await env.USAGE.get(mk)) || 0; await env.USAGE.put(mk, String(+(m + extra).toFixed(1)), { expirationTtl: 40 * 86400 }); }
}
async function limits(env) {
  if (env.PAID !== "1") return { DAILY_NEURONS: FREE_DAILY, VOICE_DAILY: FREE_VOICE };
  const left = Math.max(0, MONTH_EXTRA - (+(await env.USAGE.get("x:" + month())) || 0)), add = Math.min(PAID_DAY_EXTRA, left);
  return { DAILY_NEURONS: FREE_DAILY + add, VOICE_DAILY: FREE_VOICE + add };
}

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get("Origin") || "", h = cors(origin);
    if (req.method === "OPTIONS") return new Response(null, { headers: h });
    const url = new URL(req.url);
    const { DAILY_NEURONS, VOICE_DAILY } = await limits(env);
    if (url.pathname === "/status") { const u = await used(env); const vu = +(await env.USAGE.get("v:" + today())) || 0; return Response.json({ ok: true, model: MODEL, usedToday: Math.round(u), budget: DAILY_NEURONS, left: Math.max(0, Math.floor(DAILY_NEURONS - u)), voiceLeft: Math.max(0, Math.floor(Math.min(VOICE_DAILY - vu, DAILY_NEURONS - u))) }, { headers: h }); }
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
      let parts = []; try { const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)); parts = (j.parts || []).map(String).map(x => x.trim()).filter(Boolean).slice(0, 40); } catch (e) {}
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
      const { m, vm, sp: speaker } = voiceChoice(b), texts = (Array.isArray(b.texts) ? b.texts : []).map(t => String(t || "").slice(0, 2000).trim()).filter(Boolean).slice(0, 40);
      let cost = 0;
      for (const t of texts) { const k = "a:" + (m === "aura-1" ? "" : m + ":") + speaker + ":" + (await sha(t)); const l = await env.USAGE.list({ prefix: k, limit: 1 }); if (!l.keys.length) cost += t.length * vm.rate; }
      const vUsed = +(await env.USAGE.get("v:" + today())) || 0, u = await used(env);
      return Response.json({ ok: vUsed + cost <= VOICE_DAILY && u + cost <= DAILY_NEURONS, cost: Math.round(cost) }, { headers: h });
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
      if (vUsed + cost > VOICE_DAILY || u + cost > DAILY_NEURONS) return Response.json({ error: "voice allowance used up" }, { status: 429, headers: h });
      let audio;
      try { const r = await env.AI.run(vm.id, { text, speaker, encoding: "mp3" }, { returnRawResponse: true }); if (!r.ok) throw new Error("tts " + r.status); audio = await r.arrayBuffer(); }
      catch (e) { return Response.json({ error: "The voice service is busy." }, { status: 502, headers: h }); }
      if (!audio || audio.byteLength < 1000) return Response.json({ error: "No audio" }, { status: 502, headers: h });
      ctx.waitUntil(Promise.all([addUse(env, cost), env.USAGE.put(vk, String(+(vUsed + cost).toFixed(1)), { expirationTtl: 3 * 86400 }), env.USAGE.put(key, audio, { expirationTtl: 365 * 86400 })]));
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
