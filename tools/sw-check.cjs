// Offline store check (Nov 21 review): the website address is shared by every site of the same GitHub account (the demo
// app, Beta 2, other projects), and so is the browser's cache store. An app update must delete only that app's own
// older offline copies: never the other Kairoute copy's, never the map store, never another project's.
// Runs sw.js (and beta2-site/sw.js when built) in a stand-in service worker. Usage: node tools/sw-check.cjs
const fs = require('fs'); const path = require('path'); const vm = require('vm');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL ' + m); } };
const ALL = ['kairoute-v3', 'kairoute-v4', 'kairoute-b2-v3', 'kairoute-b2-v4', 'kairoute-maps-1', 'sweep-cache-v1', 'workbox-precache-v2'];
async function run(file, mine) {
  const src = fs.readFileSync(file, 'utf8'), deleted = [], handlers = {};
  const self = { addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting: () => Promise.resolve(), clients: { claim: () => Promise.resolve(), matchAll: () => Promise.resolve([]) } };
  const caches = { keys: async () => ALL.slice(), delete: async k => { deleted.push(k); return true; }, open: async () => ({}), match: async () => null };
  vm.runInNewContext(src, { self, caches, fetch: async () => { throw new Error('offline'); }, setTimeout: () => 0, URL, Promise, location: { origin: 'https://x.test' } });
  const waits = []; handlers.activate({ waitUntil: p => waits.push(p) }); await Promise.all(waits);
  const name = (src.match(/const APP = "([^"]+)"/) || [])[1];
  ok(name === mine, `${file}: offline store name is ${name}, should be ${mine}`);
  const want = ALL.filter(k => k.indexOf(mine + '-v') === 0 && k !== mine + '-v4');
  ok(JSON.stringify(deleted.sort()) === JSON.stringify(want.sort()), `${file}: an update deleted [${deleted}] (should delete only [${want}])`);
}
(async () => {
  const root = path.join(__dirname, '..');
  await run(path.join(root, 'sw.js'), 'kairoute');
  const b2 = path.join(root, 'beta2-site', 'sw.js'); if (fs.existsSync(b2)) await run(b2, 'kairoute-b2'); else console.log('NOTE beta2-site/sw.js not built (sh build-beta2.sh)');
  console.log(fails ? `Offline store check: ${fails} of ${checks} failed` : `Offline store check passed (${checks} checks)`);
  process.exit(fails ? 1 : 0);
})();
