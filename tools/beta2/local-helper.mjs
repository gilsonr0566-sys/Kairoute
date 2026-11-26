// The helper's code from THIS branch (worker/worker.js), run in Node on a local address, so a change to the helper can
// be tested on GitHub before it goes live (the sight audit's /sources with the new position and kinds rules). Only the
// free lookups work: no AI binding (AI_ON 0), storage kept in memory. Usage: node tools/beta2/local-helper.mjs [port]
// then point the app's helper at http://localhost:<port>/workers.dev (the path prefix is dropped).
import http from "node:http";
const W = (await import("../../worker/worker.js")).default, PORT = +process.argv[2] || 8790;
const mem = new Map();
const USAGE = { get: async (k, t) => { const v = mem.has(k) ? mem.get(k) : null; return v != null && t === "json" ? JSON.parse(v) : v; }, put: async (k, v) => { mem.set(k, String(v)); }, delete: async k => { mem.delete(k); },
  list: async () => ({ keys: [...mem.keys()].map(name => ({ name })), list_complete: true }) };
const env = { USAGE, AI_ON: "0", AI_MODE: "minimal", VOICE_LIVE: "0", MONTH_EXTRA_NEURONS: "0", AI: { run: async () => { throw new Error("no AI in the local helper"); } } };
http.createServer(async (q, r) => {
  const chunks = []; for await (const c of q) chunks.push(c);
  const path = q.url.replace(/^\/workers\.dev/, "") || "/";
  const req = new Request("http://localhost" + path, { method: q.method, headers: Object.assign({}, q.headers, { origin: "https://gilsonr0566-sys.github.io" }), body: /GET|HEAD/.test(q.method) ? undefined : Buffer.concat(chunks) });
  const waits = []; let res;
  try { res = await W.fetch(req, env, { waitUntil: p => waits.push(p), passThroughOnException() {} }); } catch (e) { console.log("local helper: " + path.slice(0, 60) + " threw " + String(e && e.stack || e).slice(0, 400)); res = new Response(JSON.stringify({ error: String(e && e.message) }), { status: 500 }); }
  if (res.status >= 500) console.log("local helper: " + path.slice(0, 60) + " answered " + res.status);
  const h = {}; res.headers.forEach((v, k) => { h[k] = v; }); h["access-control-allow-origin"] = "*";
  r.writeHead(res.status, h); r.end(Buffer.from(await res.arrayBuffer()));
  Promise.allSettled(waits);
}).listen(PORT, () => console.log("local helper on http://localhost:" + PORT + "/workers.dev"));
