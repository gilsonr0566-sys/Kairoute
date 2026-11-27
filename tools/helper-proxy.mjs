// Test stand-in for the live AI helper: one local address that every test browser in a CI job uses (ai.json points
// here during the tests; see tools/test-helper.sh). Each different request goes to the live helper once; repeats
// in the same job are answered from memory. Test runs were most of the helper's requests and storage reads/writes
// (Nov 17: 166k requests, 1.9M reads, 189k writes), heading past what the $5 plan includes. Richard: no spending.
// Usage: node tools/helper-proxy.mjs [port]   (the address to use is http://localhost:<port>/workers.dev, so tests
// that recognise the helper by "workers.dev" in the address still do)
import http from "node:http";
import { createHash } from "node:crypto";
import fs from "node:fs";
const LIVE = process.env.HELPER_URL || "https://kairoute-ai.rickgilson.workers.dev", PORT = +process.argv[2] || 8788;
// Never kept: anything that writes or reads a traveler's own saved data, and counters that must be fresh.
const PASS = /^\/(sync|rate|ratings|realuse|status|usage)(\/|$)/;
const kept = new Map(); let live = 0, hits = 0, dirty = false;
// Kept between runs (HELPER_STORE file, carried by the workflow's cache) so the same test asks don't reach the live
// helper again on the next run either. Answers older than 3 days are dropped, so tests never lean on stale data long.
const STORE = process.env.HELPER_STORE, MAX_AGE = 3 * 86400e3, stamp = new Map();
if (STORE) try {
  const old = JSON.parse(fs.readFileSync(STORE, "utf8")), now = Date.now(); let n = 0;
  for (const [k, e] of Object.entries(old)) if (now - e.t < MAX_AGE) { kept.set(k, Promise.resolve({ status: e.status, h: e.h, b: Buffer.from(e.b, "base64") })); stamp.set(k, e.t); n++; }
  console.log(`Test helper stand-in: ${n} answers carried over from earlier runs`);
} catch (e) { console.log("Test helper stand-in: nothing carried over (" + e.code + ")"); }
const save = async () => {
  if (!STORE || !dirty) return; dirty = false; const out = {};
  for (const [k, p] of kept) { const x = await p; if (x.status < 500 && x.status !== 429) out[k] = { t: stamp.get(k) || Date.now(), status: x.status, h: x.h, b: x.b.toString("base64") }; }
  fs.writeFileSync(STORE + ".tmp", JSON.stringify(out)); fs.renameSync(STORE + ".tmp", STORE);
};
const srv = http.createServer(async (q, r) => {
  const chunks = []; for await (const c of q) chunks.push(c); const body = Buffer.concat(chunks);
  const path = q.url.replace(/^\/workers\.dev/, "") || "/";
  const pass = PASS.test(path.split("?")[0]);
  const key = createHash("sha256").update(q.method + " " + path + " " + (q.headers.origin || "") + " " + (q.headers["x-kairoute-lab"] || "") + " ").update(body).digest("hex");
  let job = pass ? null : kept.get(key);
  if (job) hits++;
  else {
    live++;
    const headers = {}; for (const [k, v] of Object.entries(q.headers)) if (!/^(host|connection|content-length|accept-encoding)$/i.test(k)) headers[k] = v;
    job = fetch(LIVE + path, { method: q.method, headers, body: /^(GET|HEAD)$/.test(q.method) ? undefined : body, signal: AbortSignal.timeout(120000) })
      .then(async x => { const h = {}; x.headers.forEach((v, k) => { if (!/^(content-encoding|content-length|transfer-encoding|connection)$/i.test(k)) h[k] = v; }); return { status: x.status, h, b: Buffer.from(await x.arrayBuffer()) }; })
      .catch(e => ({ status: 502, h: { "content-type": "application/json", "access-control-allow-origin": q.headers.origin || "*" }, b: Buffer.from(JSON.stringify({ error: "helper unreachable: " + e.message })) }));
    if (!pass) { kept.set(key, job); stamp.set(key, Date.now()); job.then(x => { if (x.status >= 500 || x.status === 429) kept.delete(key); else dirty = true; }); }
  }
  const x = await job; r.writeHead(x.status, x.h); r.end(x.b);
});
srv.listen(PORT, () => console.log(`Test helper stand-in on http://localhost:${PORT}/workers.dev -> ${LIVE}`));
const report = () => console.log(`Test helper stand-in: ${live} asks went to the live helper, ${hits} answered from memory`);
const stop = () => { report(); save().catch(e => console.log("save failed: " + e.message)).finally(() => process.exit(0)); };
process.on("SIGTERM", stop); process.on("SIGINT", stop);
setInterval(report, 600000).unref(); setInterval(() => save().catch(() => {}), 20000).unref();
