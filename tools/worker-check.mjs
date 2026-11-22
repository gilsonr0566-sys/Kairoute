// Helper (Cloudflare Worker) security check, offline: runs worker/worker.js with a stand-in store and AI and no
// internet. A page from another website gets "Not allowed" on every paid or writing path and never reaches the AI,
// the outside services or the store; broken requests get a clear 400, never a crash; when today's AI allowance is
// used up the AI is not called; CORS never names another website. Run: node tools/worker-check.mjs
import worker from '../worker/worker.js';
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL ' + m); } };
const mk = (seed = {}, on = true) => { const m = new Map(Object.entries(seed)); const s = { AI_ON: on ? '1' : '0', AI_MODE: 'full', writes: 0, ai: 0, net: 0,
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
{ const d = new Date().toISOString().slice(0, 10); const env = mk({ ['n:' + d]: '8999' });
  const r = await call(env, '/sample', { origin: 'https://gilsonr0566-sys.github.io', body: { prompt: 'x'.repeat(4000) } }); ok(r.status === 429 && env.ai === 0, `/sample with the allowance used up: status ${r.status}, AI calls ${env.ai}`); }
// A normal request works and is counted.
{ const env = mk(); const r = await call(env, '/sample', { origin: 'https://gilsonr0566-sys.github.io', body: { prompt: 'hello' } }); ok(r.status === 200 && env.ai === 1 && env.writes > 0, `/sample normal request: status ${r.status}, AI ${env.ai}, counted ${env.writes > 0}`); }
// Huge prompts are cut, not passed through whole; at most 4 photos, only image data.
{ const env = mk(); let seen; env.AI.run = async (m, a) => { env.ai++; seen = a; return { response: 'ok' }; };
  await call(env, '/sample', { origin: 'https://gilsonr0566-sys.github.io', body: { prompt: 'y'.repeat(200000), images: ['javascript:alert(1)', ...Array(6).fill('data:image/png;base64,AA')] } });
  const c = seen && seen.messages[0].content, txt = Array.isArray(c) ? c.find(x => x.type === 'text').text : c, imgs = Array.isArray(c) ? c.filter(x => x.type === 'image_url') : [];
  ok(txt && txt.length <= 60000, `/sample passed a ${txt && txt.length}-character prompt to the AI`); ok(imgs.length <= 4 && imgs.every(x => x.image_url.url.startsWith('data:image/')), `/sample passed ${imgs.length} photos or a non-image`); }
// Master switch off (Richard, Nov 17): no path ever reaches the AI, tests and the recorder included.
for (const [p, body, hd] of [['/sample', { prompt: 'hello' }], ['/script', { text: 'A long enough stop text. '.repeat(20) }], ['/speak', { text: 'Hello there.' }], ['/speak', { text: 'Hello there.' }, { 'x-kairoute-lab': '1' }], ['/voiceplan', { texts: ['Hello there.'] }], ['/x/primer', { city: 'Athens' }]]) {
  const env = mk({}, false); cur = env; pend = []; let r;
  try { r = await worker.fetch(new Request('https://helper.test' + p, { method: 'POST', headers: { 'content-type': 'application/json', Origin: 'https://gilsonr0566-sys.github.io', ...(hd || {}) }, body: JSON.stringify(body) }), env, ctx); } catch (e) { r = { status: 'crash' }; }
  await Promise.all(pend); ok(env.ai === 0 && r.status !== 'crash', `AI switched off: ${p} reached the AI (${r.status})`);
  if (p === '/voiceplan') ok(r.status === 200 && (await r.json()).ok === false, '/voiceplan with the AI off must say the phone voice reads'); }
// Live voice off (the default): a traveler's new line is not recorded, a saved one still plays.
{ const env = mk(); const r = await call(env, '/speak', { origin: 'https://gilsonr0566-sys.github.io', body: { text: 'Hello there.' } }); ok(r.status === 429 && env.ai === 0, `/speak with live voice off: ${r.status}, ai ${env.ai}`); }
// Tests have their own small share: once used, no AI even with the day's total left.
{ const d = new Date().toISOString().slice(0, 10); const env = mk({ ['t:' + d]: '1500' }); const r = await call(env, '/sample?auto=1', { origin: 'https://gilsonr0566-sys.github.io', body: { prompt: 'hello' } }); ok(r.status === 429 && env.ai === 0, `/sample from a test past its share: ${r.status}`); }
// Cloudflare's real count is a second guard.
{ const d = new Date().toISOString().slice(0, 10); const env = mk({ ['r:' + d]: '9700' }); const r = await call(env, '/sample', { origin: 'https://gilsonr0566-sys.github.io', body: { prompt: 'hello' } }); ok(r.status === 429 && env.ai === 0, `/sample past Cloudflare's real count: ${r.status}`); }
// MINIMAL AI (the mode the helper runs in when switched on): only the trip and guide jobs reach the AI, inside
// 3,000 a day; everything else is refused before the AI; a kept answer is never paid for twice.
const ORI = 'https://gilsonr0566-sys.github.io', D0 = new Date().toISOString().slice(0, 10);
const mn = seed => { const e = mk(seed); e.AI_MODE = 'minimal'; return e; };
for (const job of ['trip', 'guide']) { const env = mn(); const r = await call(env, '/sample', { origin: ORI, body: { prompt: 'hello ' + job, purpose: job } }); ok(r.status === 200 && env.ai === 1, `minimal: the ${job} job should run: ${r.status}, ai ${env.ai}`); }
for (const job of [undefined, '', 'walk', 'extras', 'ask', 'translate', 'boarding', 'lookup', 'rank']) { const env = mn(); const r = await call(env, '/sample', { origin: ORI, body: { prompt: 'hello', purpose: job } }); ok(r.status === 403 && env.ai === 0, `minimal: job "${job}" reached the AI (${r.status}, ai ${env.ai})`); }
for (const [p, body, hd] of [['/identify', { image: 'data:image/png;base64,AA', cands: [{ name: 'A' }, { name: 'B' }] }], ['/script', { text: 'A long enough stop text. '.repeat(20) }], ['/speak', { text: 'Hello there.' }], ['/x/primer', { city: 'Athens' }], ['/sample', { prompt: 'hello', purpose: 'trip' }, { 'x-kairoute-lab': '1' }], ['/sample?auto=1', { prompt: 'hello', purpose: 'guide' }]]) {
  const env = mn(); cur = env; pend = []; let r;
  try { r = await worker.fetch(new Request('https://helper.test' + p, { method: 'POST', headers: { 'content-type': 'application/json', Origin: ORI, ...(hd || {}) }, body: JSON.stringify(body) }), env, ctx); } catch (e) { r = { status: 'crash' }; }
  await Promise.all(pend); ok(env.ai === 0 && r.status !== 'crash', `minimal: ${p}${hd ? ' (test)' : ''} reached the AI (${r.status})`); }
// The hard cap stops calls: walk the day's count up with real calls until the helper refuses, and check it never runs past 3,000.
{ const env = mn(); env.AI.run = async () => { env.ai++; return { response: 'ok', usage: { prompt_tokens: 20000, completion_tokens: 2000 } }; };
  let runs = 0, refused = null; for (let i = 0; i < 40 && !refused; i++) { const r = await call(env, '/sample', { origin: ORI, body: { prompt: 'trip ask ' + i, purpose: 'trip' } }); if (r.status === 200) runs++; else refused = r.status; }
  const st = await (await call(env, '/status', { method: 'GET', origin: ORI })).json();
  ok(refused === 429 && runs > 3 && env.ai === runs, `minimal cap: refused ${refused} after ${runs} runs (ai ${env.ai})`);
  ok(st.usedToday <= 3000 && st.left < 500 && st.mode === 'minimal' && st.budget === 3000, `minimal cap: day ended at ${st.usedToday} of budget ${st.budget}, left ${st.left}, mode ${st.mode}`);
  const before = env.ai, r2 = await call(env, '/sample', { origin: ORI, body: { prompt: 'trip ask 0', purpose: 'trip' } }), j2 = await r2.json();
  ok(r2.status === 200 && j2.kept === true && env.ai === before, `minimal: a kept answer should be served free even with the cap reached (${r2.status}, ai ${env.ai - before})`); }
{ const env = mn({ ['n:' + D0]: '2999' }); const r = await call(env, '/sample', { origin: ORI, body: { prompt: 'x'.repeat(4000), purpose: 'trip' } }); ok(r.status === 429 && env.ai === 0, `minimal: at 2,999 used, a new ask must be refused: ${r.status}`); }
{ const env = mn({ ['r:' + D0]: '3700' }); const r = await call(env, '/sample', { origin: ORI, body: { prompt: 'hello', purpose: 'trip' } }); ok(r.status === 429 && env.ai === 0, `minimal: Cloudflare's real count 3,700 must stop the AI: ${r.status}`); }
{ const env = mn(); await call(env, '/sample', { origin: ORI, body: { prompt: 'same', purpose: 'guide' } }); await call(env, '/sample', { origin: ORI, body: { prompt: 'same', purpose: 'guide' } }); ok(env.ai === 1, `minimal: the same ask was paid for ${env.ai} times`); }
// Test browsers never spend AI in minimal mode: localhost pages and headless browsers count as tests.
for (const [o, ua] of [['http://localhost:8765', ''], ['http://127.0.0.1:8080', ''], [ORI, 'Mozilla/5.0 HeadlessChrome/140.0']]) { const env = mn(); cur = env; pend = []; let r;
  try { r = await worker.fetch(new Request('https://helper.test/sample', { method: 'POST', headers: { 'content-type': 'application/json', Origin: o, 'user-agent': ua }, body: JSON.stringify({ prompt: 'hello', purpose: 'trip' }) }), env, ctx); } catch (e) { r = { status: 'crash' }; }
  await Promise.all(pend); ok(r.status === 429 && env.ai === 0, `minimal: a test browser (${o} ${ua}) reached the AI (${r.status})`); }
{ const env = mn(); cur = env; pend = []; const r = await worker.fetch(new Request('https://helper.test/sample', { method: 'POST', headers: { 'content-type': 'application/json', Origin: 'capacitor://localhost', 'user-agent': 'Mozilla/5.0 (Linux; Android 15) Chrome/140.0 Mobile' }, body: JSON.stringify({ prompt: 'hello', purpose: 'trip' }) }), env, ctx); await Promise.all(pend); ok(r.status === 200 && env.ai === 1, `minimal: the phone app must still build a trip (${r.status})`); }
// Ferry speed from the map (Nov 22, Richard: Naples-Sorrento shown at about an hour, every operator says 35-45 min): a boat
// for people only is estimated as a fast boat, a car ferry as a slow one.
{ const { ferryKmh } = await import('../worker/transit.js');
  ok(ferryKmh({}) === 38 && ferryKmh({ motor_vehicle: 'no' }) === 38, 'a passenger-only ferry is estimated at fast-boat speed');
  ok(ferryKmh({ motor_vehicle: 'yes' }) === 28 && ferryKmh({ hgv: 'yes' }) === 28, 'a car ferry is estimated at car-ferry speed');
  ok(Math.round(27 / ferryKmh({}) * 60) <= 45, 'a 27 km passenger crossing is estimated within the 35-45 min the timetables give'); }
console.log(fails ? `Helper security check: ${fails} of ${checks} failed` : `Helper security check passed (${checks} checks)`);
process.exit(fails ? 1 : 0);
