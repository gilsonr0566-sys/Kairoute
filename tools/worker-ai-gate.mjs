// AI gate check (Nov 21 review), offline: proves that NO route of the helper can reach Workers AI unless all of the
// owner's rules allow it. Runs worker/worker.js with a stand-in store, a stand-in AI that counts calls, and no internet.
// Every route the helper has is found by reading its source (so a new route is covered the day it is added) and is
// called in every way a caller could: from the app, with no Origin (curl, a script), as a test (lab header, ?auto=1,
// headless), with a recorder key, with each job name, with a photo. Then:
//   1. AI switched off (AI_ON = "0"), minimal or full mode: zero AI calls from any route, ever.
//   2. Minimal mode, AI on: the only AI calls are /sample with the job "trip" or "guide". /identify, /x/*, voice and
//      scripts never reach the AI.
//   3. Scheduled work (every 15 minutes) never reaches the AI, even with AI on in full mode.
//   4. Today's allowance used up: zero AI calls from any route, even in full mode.
//   5. The check isn't blind: in full mode with allowance left, /identify does reach the stand-in AI.
// Run: node tools/worker-ai-gate.mjs
import worker from '../worker/worker.js';
import fs from 'fs';
const here = new URL('../worker/', import.meta.url);
const src = ['worker.js', 'extras.js'].map(f => fs.readFileSync(new URL(f, here), 'utf8')).join('\n');
const ROUTES = [...new Set([...src.matchAll(/pathname === "(\/[a-z0-9/]+)"/g), ...src.matchAll(/p === "(\/x\/[a-z0-9]+)"/g)].map(m => m[1]))].sort();
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL ' + m); } };
ok(ROUTES.length >= 30 && ROUTES.includes('/identify'), `only ${ROUTES.length} routes found in the helper's source`);
ROUTES.push('/sample', '/', '/unknown');
// Only the gate may hold the real binding: no other code may keep a copy of env.AI.
ok(!/=\s*env\.AI\s*[;,)]/.test(src.replace(/const real = env\.AI,/, '')), 'some code keeps its own copy of the AI binding (only aiGate may)');
ok((src.match(/AI\.run\(/g) || []).length === (src.match(/env\.AI\.run\(/g) || []).length && /real\.run\(\.\.\.a\)/.test(src), 'an AI call that is not env.AI.run (only the gate calls the real binding)');

const ORI = 'https://gilsonr0566-sys.github.io', D0 = new Date().toISOString().slice(0, 10);
const IMG = 'data:image/jpeg;base64,/9j/' + 'A'.repeat(200);
const mk = ({ on, mode, seed = {} }) => { const m = new Map(Object.entries(seed)); const s = { AI_ON: on ? '1' : '0', AI_MODE: mode, VOICE_LIVE: '1', REC_KEY: 'rk', ai: 0, aiFrom: [],
  USAGE: { get: async (k, t) => { const v = m.get(k); return v == null ? null : t === 'json' ? JSON.parse(v) : v; }, put: async (k, v) => { m.set(k, v); }, delete: async k => { m.delete(k); }, list: async () => ({ keys: [] }), getWithMetadata: async k => ({ value: m.get(k) ?? null, metadata: null }) },
  AI: { run: async () => { s.ai++; s.aiFrom.push(cur.path); return { response: '{"n":1,"sure":"high","text":"ok"}', choices: [{ message: { content: '{"n":1}' } }], usage: { prompt_tokens: 10, completion_tokens: 10 } }; } },
  GROUPS: { idFromName: () => ({}), get: () => ({ fetch: async () => new Response('{}') }) } }; return s; };
let cur = { path: '' }, pend = [];
globalThis.fetch = async () => { throw new Error('no internet in this check'); };
// Waits (retries, map servers' turn-taking) pass at once: nothing here is real time.
const realST = globalThis.setTimeout; globalThis.setTimeout = (f, ms, ...a) => realST(f, 0, ...a);
const ctx = { waitUntil: p => { pend.push(Promise.resolve(p).catch(() => {})); } };
// A body that gets past each route's own input checks as far as possible.
// Each ask is new (the helper remembers answers in its own memory across requests, so a repeat is answered free).
let nth = 0; const body = (job) => ({ prompt: 'Hello there, plan my day. #' + (++nth), purpose: job, image: IMG, cands: [{ name: 'Old Fort', kind: 'castle', m: 40 }, { name: 'Harbour', m: 90 }], dev: 'abcdef0123456789',
  text: 'A long enough stop text for a script or a voice line. '.repeat(12), texts: ['Hello there.'], speaker: 'luna', city: 'Athens', country: 'Greece', name: 'Acropolis', lat: 37.97, lng: 23.72,
  names: ['Acropolis'], places: [{ name: 'Acropolis', lat: 37.97, lng: 23.72 }], code: 'ABCD12', what: 'kids', sights: [{ name: 'Acropolis' }] });
const WAYS = [
  { tag: 'app', h: { Origin: ORI } },
  { tag: 'no origin', h: {} },
  { tag: 'lab test', h: { Origin: ORI, 'x-kairoute-lab': '1' } },
  { tag: 'auto test', h: { Origin: ORI }, q: '?auto=1' },
  { tag: 'recorder', h: { Origin: ORI, 'x-kairoute-rec': 'rk' } },
  { tag: 'phone app', h: { Origin: 'capacitor://localhost', 'user-agent': 'Mozilla/5.0 (Linux; Android 15) Chrome/140.0 Mobile' } }];
const JOBS = ['trip', 'guide', 'identify', 'walk', 'extras', ''];
async function hit(env, path, way, job, method) { cur = { path }; pend = [];
  let r = null; try { r = await worker.fetch(new Request('https://helper.test' + path + (way.q || ''), { method, headers: { 'content-type': 'application/json', ...way.h }, body: method === 'GET' ? undefined : JSON.stringify(body(job)) }), env, ctx); } catch (e) {}
  if (process.env.DEBUG && r) console.log(path, way.tag, job, r.status, (await r.clone().text()).slice(0, 120));
  await Promise.all(pend); }
async function sweep(env) { for (const path of ROUTES) for (const way of WAYS) for (const method of ['POST', 'GET']) for (const job of method === 'GET' ? [''] : path === '/sample' ? JOBS : ['trip']) await hit(env, path, way, job, method); }

// 1. Switched off: nothing, in either mode.
for (const mode of ['minimal', 'full']) { const env = mk({ on: false, mode }); await sweep(env);
  ok(env.ai === 0, `AI switched off (${mode}): ${env.ai} AI call(s) from ${[...new Set(env.aiFrom)].join(', ')}`); }
// 2. Minimal, on: only /sample trip|guide.
{ const env = mk({ on: true, mode: 'minimal' }); await sweep(env); const bad = env.aiFrom.filter(p => p !== '/sample');
  ok(bad.length === 0, `minimal AI: routes other than /sample reached the AI: ${[...new Set(bad)].join(', ')}`);
  for (const job of JOBS) { const e2 = mk({ on: true, mode: 'minimal' }); await hit(e2, '/sample', WAYS[0], job, 'POST');
    ok(e2.ai === (job === 'trip' || job === 'guide' ? 1 : 0), `minimal AI: /sample job "${job}" made ${e2.ai} AI call(s)`); }
  { const e2 = mk({ on: true, mode: 'minimal' }); await hit(e2, '/identify', WAYS[0], '', 'POST'); ok(e2.ai === 0, `minimal AI: /identify reached the AI`); } }
// 3. Scheduled work never reaches the AI.
{ const env = mk({ on: true, mode: 'full' }); cur = { path: 'scheduled' }; pend = []; try { await worker.scheduled({}, env, ctx); } catch (e) {} await Promise.all(pend);
  ok(env.ai === 0, `scheduled work reached the AI (${env.ai})`); }
// 4. Allowance used up (our count and Cloudflare's real count): nothing, even in full mode.
for (const seed of [{ ['n:' + D0]: '99999' }, { ['r:' + D0]: '99999' }]) { const env = mk({ on: true, mode: 'full', seed }); await sweep(env);
  ok(env.ai === 0, `allowance used up (${Object.keys(seed)[0]}): ${env.ai} AI call(s) from ${[...new Set(env.aiFrom)].join(', ')}`); }
// 5. Not blind: full mode, allowance left, the photo route does reach the stand-in AI.
{ const env = mk({ on: true, mode: 'full' }); await hit(env, '/identify', WAYS[0], '', 'POST'); ok(env.ai === 1, `full mode: /identify should reach the stand-in AI once (got ${env.ai}); the check may be blind`); }
// 6. Plain answers: a feature that is switched off says so (403, disabled), never "busy, try again"; /status lists
//    what the app may offer, so its buttons and words match.
const call1 = async (env, path, method = 'POST', job = 'trip') => { cur = { path }; pend = []; const r = await worker.fetch(new Request('https://helper.test' + path, { method, headers: { 'content-type': 'application/json', Origin: ORI }, body: method === 'GET' ? undefined : JSON.stringify(body(job)) }), env, ctx); await Promise.all(pend); return r; };
for (const [on, mode] of [[false, 'minimal'], [true, 'minimal']]) { const env = mk({ on, mode }); const r = await call1(env, '/identify'); const j = await r.json();
  ok(r.status === 403 && j.disabled === true && env.ai === 0, `${on ? 'minimal' : 'off'}: /identify should answer 403 "switched off" (got ${r.status} ${JSON.stringify(j).slice(0, 80)})`); }
for (const [on, mode, want] of [[false, 'minimal', { tripImport: false, cityGuide: false, askQuestions: false, photoIdentify: false, liveVoice: false, savedVoice: true }],
  [true, 'minimal', { tripImport: true, cityGuide: true, askQuestions: false, photoIdentify: false, liveVoice: false, savedVoice: true }],
  [true, 'full', { tripImport: true, cityGuide: true, askQuestions: true, photoIdentify: true, savedVoice: true }]]) {
  const env = mk({ on, mode }); env.VOICE_LIVE = '0'; const st = await (await call1(env, '/status', 'GET')).json();
  for (const k in want) ok(st.caps && st.caps[k] === want[k], `/status caps (${on ? mode : 'off'}): ${k} should be ${want[k]}, got ${st.caps && st.caps[k]}`); }
{ const env = mk({ on: false, mode: 'minimal' }); const r = await call1(env, '/sample'); ok(r.status >= 400 && r.status < 500 && env.ai === 0, `off: /sample should refuse plainly (got ${r.status})`); }
console.log(fails ? `AI gate check: ${fails} of ${checks} failed` : `AI gate check passed (${checks} checks, ${ROUTES.length} routes x ${WAYS.length} ways of calling)`);
process.exit(fails ? 1 : 0);
