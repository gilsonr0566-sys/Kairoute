// Kairoute AI helper. The website sends a prompt (and optional photos); this Worker asks Workers AI
// and streams the answer back. A daily budget keeps usage inside Cloudflare's free allowance, so
// testing never costs money: once the budget is used up, requests stop until midnight UTC.
const MODEL = "@cf/google/gemma-4-26b-a4b-it";
// Gemma 4 26B costs about 9,091 neurons per million input tokens and 27,273 per million output tokens.
// The free allowance is 10,000 neurons a day; we stop at 9,700 (usage is counted from the real token counts, so this stays inside it).
const DAILY_NEURONS = 9700;
const IN_RATE = 9091 / 1e6, OUT_RATE = 27273 / 1e6;
const ALLOWED = [/^https:\/\/gilsonr0566-sys\.github\.io$/, /^https?:\/\/localhost(:\d+)?$/, /^capacitor:\/\/localhost$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/, /\.claudeusercontent\.com$/, /^https:\/\/claude\.ai$/];
const MAX_OUT = { quick: 1200, part: 8000, default: 14000, complex: 16000 };

function cors(origin) {
  const ok = origin && ALLOWED.some(r => r.test(origin));
  return { "Access-Control-Allow-Origin": ok ? origin : "https://gilsonr0566-sys.github.io", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "content-type", "Vary": "Origin" };
}
const today = () => new Date().toISOString().slice(0, 10);
async function used(env) { return +(await env.USAGE.get("n:" + today())) || 0; }
async function addUse(env, n) { const k = "n:" + today(); const cur = +(await env.USAGE.get(k)) || 0; await env.USAGE.put(k, String(+(cur + n).toFixed(3)), { expirationTtl: 3 * 86400 }); }

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get("Origin") || "", h = cors(origin);
    if (req.method === "OPTIONS") return new Response(null, { headers: h });
    const url = new URL(req.url);
    if (url.pathname === "/status") { const u = await used(env); return Response.json({ ok: true, model: MODEL, usedToday: Math.round(u), budget: DAILY_NEURONS, left: Math.max(0, Math.floor(DAILY_NEURONS - u)) }, { headers: h }); }
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
