// Helper cache check (rule: "an answer made before a rule change is never served", Nov 23). The Bastille stayed
// "standing" on the live helper for hours after the destroyed-building rule shipped, because its answer was kept under a
// hand-numbered key nobody bumped. Now every kept answer's key carries a fingerprint of the code that made it
// (codeKey in worker/worker.js), so a rule change starts a fresh key by itself. This check:
//  1. Static: no hand-numbered key ("sr11:", "tr9:") outside the stored records listed below, which hold data the
//     helper gathers (ratings, ferry timetables) or answers fixed by their full input (AI and voice by prompt hash).
//  2. Live in Node: the helper's code is copied twice, the second with one rule changed (a comment inside the sources
//     rules, then inside the shared timetable code); the key each copy asks the store for must differ.
// Run: node tools/worker-cache-check.mjs
import fs from 'fs'; import path from 'path'; import os from 'os'; import { pathToFileURL, fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), W = path.join(here, '..', 'worker');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL ' + m); } else console.log('ok   ' + m); };
// Records the helper keeps on purpose, under fixed names (not answers made by rules that change).
const STORED = { rt1: 'travelers\' ratings', bz1: 'busy-hour reports', fp1: 'ferry timetables gathered by the schedule', ns1: 'nearby sights gathered list',
  s3: 'voice clips by text hash', sp1: 'AI answers by full prompt hash', xw1: 'AI write-ups by full input hash' };
const files = fs.readdirSync(W).filter(f => f.endsWith('.js'));
const handKeys = texts => { const n = new Set(); for (const t of texts) for (const m of t.matchAll(/["'`]([a-z]{1,4}\d+):/g)) n.add(m[1]); return [[...n], [...n].filter(k => !STORED[k])]; };
// Planted on every run: a hand-numbered answer key, the very thing that kept the Bastille standing, must be caught.
{ const [, caught] = handKeys(['const key = "sr12:" + (await sha(label));']); ok(caught.length === 1 && caught[0] === 'sr12', `a planted hand-numbered key ("sr12:") is caught (${caught.join(', ') || 'missed'})`);
  if (!caught.length) { console.log('worker-cache-check: BLIND'); process.exit(1); } }
const [numberedList, hand] = handKeys(files.map(f => fs.readFileSync(path.join(W, f), 'utf8'))), numbered = new Set(numberedList);
ok(!hand.length, `no hand-numbered answer keys outside the stored records (${[...numbered].join(', ')} all listed)` + (hand.length ? ': found ' + hand.join(', ') : ''));
{ const src = fs.readFileSync(path.join(W, 'worker.js'), 'utf8'), memo = /const MEMO_KEYS = \/\^\(([^)]*)\)/.exec(src), pre = [...src.matchAll(/codeKey\("([a-z]+)"/g)].map(m => m[1]);
  const ext = [...fs.readFileSync(path.join(W, 'extras.js'), 'utf8').matchAll(/codeKey\("([a-z]+)"/g)].map(m => m[1]), all = [...new Set([...pre, ...ext])];
  const miss = all.filter(p => !memo || !memo[1].split('|').includes(p));
  ok(all.length >= 15 && !miss.length, `every code-keyed answer (${all.length} kinds) is also known to the short memory` + (miss.length ? ': missing ' + miss.join(', ') : '')); }
// Two copies of the helper, one rule apart.
async function copy(tag, change, swap) { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'kr-cache-' + tag + '-'));
  for (const f of files) { let s = fs.readFileSync(path.join(W, f), 'utf8'); if (swap && f === 'worker.js') { if (!s.includes(swap[0])) throw new Error('not found: ' + swap[0]); s = s.replace(swap[0], swap[1]); } if (change && change[0] === f) { const at = s.indexOf(change[1]); if (at < 0) throw new Error('not found: ' + change[1]); s = s.slice(0, at + change[1].length) + ' /* a rule changed */ ' + s.slice(at + change[1].length); } fs.writeFileSync(path.join(d, f), s); }
  return (await import(pathToFileURL(path.join(d, 'worker.js')).href)).default; }
globalThis.fetch = async () => { throw new Error('no internet in this check'); };
async function keysAsked(worker, url) { const asked = []; const env = { AI_ON: '0', USAGE: { get: async k => { asked.push(k); return null; }, put: async () => {}, delete: async () => {}, list: async () => ({ keys: [] }) } };
  try { await worker.fetch(new Request('https://helper.test' + url, { headers: { Origin: 'https://gilsonr0566-sys.github.io' } }), env, { waitUntil: () => {} }); } catch (e) {}
  return asked; }
const base = await copy('a');
for (const [what, change, url, pre] of [
  ['the sources rules', ['worker.js', 'async function sourcesData(label, env, ctx) {'], '/sources?city=Testopolis', 'sr.'],
  ['the shared timetable code (every ride and weather answer)', ['transit.js', 'export async function allOptions(a, b, dow, mapWait = 12000, store, date) {'], '/weather?lat=41.9&lng=12.5', 'wx.']]) {
  const b = await copy('b', change), k1 = (await keysAsked(base, url)).filter(k => k.startsWith(pre)), k2 = (await keysAsked(b, url)).filter(k => k.startsWith(pre));
  ok(k1.length > 0 && k2.length > 0 && k1[0] !== k2[0], `a change to ${what} starts a fresh key (${k1[0] || 'none'} vs ${k2[0] || 'none'})`);
  const k3 = (await keysAsked(base, url)).filter(k => k.startsWith(pre)); ok(k3[0] === k1[0], `with no change the key stays the same, so answers are reused (${what})`); }
// 3. A slow answer is kept in stages (R-29, Nov 24): a cold city's sources take about 100 s and the helper is sometimes
// stopped part way (Lisbon: dropped at 64 s, and asked again it started from scratch). Here the city's later sources
// never answer: the first ask is given up, and the second must not read English Wikivoyage again. Planted on every
// run: the same helper without stage keeping must read it twice.
async function stageReads(worker) {
  const store = new Map(), env = { AI_ON: '0', USAGE: { get: async k => store.has(k) ? store.get(k) : null, put: async (k, v) => { store.set(k, v); }, delete: async k => { store.delete(k); }, list: async () => ({ keys: [] }) } };
  const ask = () => Promise.race([worker.fetch(new Request('https://helper.test/sources?city=Testopolis', { headers: { Origin: 'https://gilsonr0566-sys.github.io' } }), env, { waitUntil: () => {} }).catch(() => {}), new Promise(r => setTimeout(r, 400))]);
  let voy = 0; const hang = new Promise(() => {});
  globalThis.fetch = async () => { throw new Error('no internet'); };
  await ask(); const fk = [...store.keys()].find(k => k.startsWith('fm.')) ; // nothing kept yet: the fame list failed
  const fmKey = (await (async () => { const asked = []; const e2 = { AI_ON: '0', USAGE: { get: async k => { asked.push(k); return null; }, put: async () => {}, delete: async () => {}, list: async () => ({ keys: [] }) } };
    try { await worker.fetch(new Request('https://helper.test/sources?city=Testopolis', { headers: { Origin: 'https://gilsonr0566-sys.github.io' } }), e2, { waitUntil: () => {} }); } catch (e) {} return asked.find(k => k.startsWith('fm.')); })());
  if (!fmKey || fk) return -1;
  store.set(fmKey, JSON.stringify({ area: 'Testopolis', center: { lat: 1, lng: 1 }, main: [], far: [] }));
  globalThis.fetch = async u => { u = String(u); if (u.includes('en.wikivoyage.org')) { voy++; return new Response(JSON.stringify({ parse: { title: 'Testopolis', wikitext: '== See ==\n* {{see | name=Old Tower | lat=1 | long=1 | content=A tower.}}\n' } }), { headers: { 'content-type': 'application/json' } }); } return hang; };
  await ask(); await ask();
  globalThis.fetch = async () => { throw new Error('no internet in this check'); };
  return voy; }
{ const n = await stageReads(await copy('s')); ok(n === 1, `a city's English Wikivoyage, read before the helper was stopped, is kept: asked again it is not read again (read ${n} time(s))`);
  const p = await stageReads(await copy('p', null, ['enP = voyageKept(', 'enP = voyagePages(']));
  ok(p === 2, `planted: the helper without stage keeping reads it again, and this check sees it (read ${p} time(s))`); if (p !== 2) console.log('worker-cache-check: BLIND on stage keeping'); }
// R-34: every outside read in a city's sources (Wikidata here) is kept as soon as it comes back, so an ask the app
// stops at 60 s loses nothing and the next ask starts where it stopped.
async function wdReads(worker) {
  const store = new Map(), env = { AI_ON: '0', USAGE: { get: async k => store.has(k) ? store.get(k) : null, put: async (k, v) => { store.set(k, v); }, delete: async k => { store.delete(k); }, list: async () => ({ keys: [] }) } };
  const ask = () => Promise.race([worker.fetch(new Request('https://helper.test/sources?city=Testopolis', { headers: { Origin: 'https://gilsonr0566-sys.github.io' } }), env, { waitUntil: () => {} }).catch(() => {}), new Promise(r => setTimeout(r, 400))]);
  const fmKey = (await (async () => { const asked = []; const e2 = { AI_ON: '0', USAGE: { get: async k => { asked.push(k); return null; }, put: async () => {}, delete: async () => {}, list: async () => ({ keys: [] }) } };
    globalThis.fetch = async () => { throw new Error('no internet'); };
    try { await worker.fetch(new Request('https://helper.test/sources?city=Testopolis', { headers: { Origin: 'https://gilsonr0566-sys.github.io' } }), e2, { waitUntil: () => {} }); } catch (e) {} return asked.find(k => k.startsWith('fm.')); })());
  if (!fmKey) return -1;
  store.set(fmKey, JSON.stringify({ area: 'Testopolis', center: { lat: 1, lng: 1 }, main: [], far: [] }));
  let wd = 0; const hang = new Promise(() => {}), J = o => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } });
  globalThis.fetch = async u => { u = String(u);
    if (u.includes('en.wikivoyage.org')) return J({ parse: { title: 'Testopolis', wikitext: '== See ==\n* {{see | name=Old Tower | lat=1 | long=1 | content=A tower.}}\n' } });
    if (u.includes('www.wikidata.org/w/api.php') && u.includes('wbgetentities') && u.includes('titles=')) { wd++; return J({ entities: { Q1: { sitelinks: { enwikivoyage: { title: 'Testopolis' } }, claims: {} } } }); }
    return hang; };
  await ask(); await ask();
  globalThis.fetch = async () => { throw new Error('no internet in this check'); };
  return wd; }
{ const n = await wdReads(await copy('w')); ok(n === 1, `R-34: a city's Wikidata read, back before the app stopped the ask, is kept: asked again it is not read again (read ${n} time(s))`);
  const p = await wdReads(await copy('q', null, ['if (r.ok) { const j = await r.json(); await env.USAGE.put(k, JSON.stringify(j), { expirationTtl: 30 * 86400 }).catch(() => {}); return j; } } catch (e) {} } return null; };\n  const T = {}', 'if (r.ok) { const j = await r.json(); return j; } } catch (e) {} } return null; };\n  const T = {}']));
  ok(p === 2, `planted: the helper without kept reads reads Wikidata again, and this check sees it (read ${p} time(s))`); if (p !== 2) console.log('worker-cache-check: BLIND on kept reads'); }
console.log(`worker-cache-check: ${checks - fails} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
