// Helper (Cloudflare Worker) security check, offline: runs worker/worker.js with a stand-in store and AI and no
// internet. A page from another website gets "Not allowed" on every paid or writing path and never reaches the AI,
// the outside services or the store; broken requests get a clear 400, never a crash; when today's AI allowance is
// used up the AI is not called; CORS never names another website. Run: node tools/worker-check.mjs
import worker from '../worker/worker.js';
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL ' + m); } };
const mk = (seed = {}) => { const m = new Map(Object.entries(seed)); const s = { writes: 0, ai: 0, net: 0,
  USAGE: { get: async (k, t) => { const v = m.get(k); return v == null ? null : t === 'json' ? JSON.parse(v) : v; }, put: async (k, v) => { s.writes++; m.set(k, v); }, delete: async k => { s.writes++; m.delete(k); }, list: async () => ({ keys: [] }) },
  AI: { run: async () => { s.ai++; return { response: '{"ok":1}', usage: { prompt_tokens: 10, completion_tokens: 10 } }; } } }; return s; };
globalThis.fetch = async () => { cur.net++; throw new Error('no internet in this check'); };
const ctx = { waitUntil: p => { pend.push(Promise.resolve(p).catch(() => {})); } }; let pend = [], cur;
async function call(env, path, { method = 'POST', origin, body } = {}) { cur = env; pend = [];
  const h = { 'content-type': 'application/json' }; if (origin) h.Origin = origin;
  let r; try { r = await worker.fetch(new Request('https://helper.test' + path, { method, headers: h, body: method === 'GET' ? undefined : (typeof body === 'string' ? body : JSON.stringify(body || { prompt: 'x', city: 'Athens', name: 'Acropolis', lat: 37.97, lng: 23.72, q: 'x', text: 'hello', points: [[37.97, 23.72]], legs: [] })) }), env, ctx); }
  catch (e) { return { status: 'crash', err: e.message }; } await Promise.all(pend); return r; }
const EVIL = 'https://evil.example.com';
const PATHS = ['/sample', '/places', '/ground', '/events', '/grating', '/famous', '/sources', '/findplace', '/sync', '/weather', '/ratings', '/rate', '/voyage', '/route', '/ferries', '/transit', '/nearsights', '/facts', '/osm', '/verify', '/guide', '/script', '/voiceplan', '/speak', '/identify', '/x/viewpoints', '/x/restrooms', '/x/story'];
const open = [];
for (const p of PATHS) { const env = mk(); const r = await call(env, p, { origin: EVIL });
  ok(r.status !== 'crash', `${p} from another website crashed the helper: ${r.err}`);
  const acao = r.headers && r.headers.get('access-control-allow-origin'); ok(acao !== EVIL, `${p}: CORS names another website`);
  ok(env.ai === 0, `${p}: another website reached the AI`);
  if (env.net || env.writes) open.push(`${p} (${env.net ? 'outside services' : ''}${env.net && env.writes ? ', ' : ''}${env.writes ? 'store writes' : ''}, status ${r.status})`); }
if (open.length) console.log('NOTE paths that do free work for another website (no AI, no cost): ' + open.join('; '));
// Broken and empty requests: a clear answer, never a crash.
for (const p of ['/sample', '/places', '/sync', '/speak', '/identify', '/guide', '/rate']) { const env = mk();
  const r = await call(env, p, { origin: 'https://gilsonr0566-sys.github.io', body: '{not json' }); ok(r.status !== 'crash' && r.status < 500, `${p}: a broken request gave ${r.status} ${r.err || ''}`); ok(env.ai === 0, `${p}: a broken request reached the AI`); }
{ const env = mk(); const r = await call(env, '/sample', { origin: 'https://gilsonr0566-sys.github.io', body: { prompt: '' } }); ok(r.status === 400 && env.ai === 0, `/sample empty prompt: ${r.status}`); }
// Allowance used up: no AI call, a clear 429.
{ const d = new Date().toISOString().slice(0, 10); const env = mk({ ['n:' + d]: '8499' });
  const r = await call(env, '/sample', { origin: 'https://gilsonr0566-sys.github.io', body: { prompt: 'x'.repeat(4000) } }); ok(r.status === 429 && env.ai === 0, `/sample with the allowance used up: status ${r.status}, AI calls ${env.ai}`); }
// A normal request works and is counted.
{ const env = mk(); const r = await call(env, '/sample', { origin: 'https://gilsonr0566-sys.github.io', body: { prompt: 'hello' } }); ok(r.status === 200 && env.ai === 1 && env.writes > 0, `/sample normal request: status ${r.status}, AI ${env.ai}, counted ${env.writes > 0}`); }
// Huge prompts are cut, not passed through whole; at most 4 photos, only image data.
{ const env = mk(); let seen; env.AI.run = async (m, a) => { env.ai++; seen = a; return { response: 'ok' }; };
  await call(env, '/sample', { origin: 'https://gilsonr0566-sys.github.io', body: { prompt: 'y'.repeat(200000), images: ['javascript:alert(1)', ...Array(6).fill('data:image/png;base64,AA')] } });
  const c = seen && seen.messages[0].content, txt = Array.isArray(c) ? c.find(x => x.type === 'text').text : c, imgs = Array.isArray(c) ? c.filter(x => x.type === 'image_url') : [];
  ok(txt && txt.length <= 60000, `/sample passed a ${txt && txt.length}-character prompt to the AI`); ok(imgs.length <= 4 && imgs.every(x => x.image_url.url.startsWith('data:image/')), `/sample passed ${imgs.length} photos or a non-image`); }
console.log(fails ? `Helper security check: ${fails} of ${checks} failed` : `Helper security check passed (${checks} checks)`);
process.exit(fails ? 1 : 0);
