// Asks the helper's /transit (mapped public transport lines, free sources, no AI) for a few pairs in big cities and
// saves the answers (tools/beta2/sources/transit-*.json), to check that metro and train are offered where they run
// (competitor review, Nov 20: Tokyo got only taxis). Runs on GitHub (the container can't reach the helper).
const fs = require('fs'), path = require('path');
const AI = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'ai.json'))).url.replace(/\/$/, '');
const pairs = [
  ['tokyo-haneda-shinjuku', [35.5494, 139.7798], [35.6896, 139.7006]], ['tokyo-shinjuku-asakusa', [35.6896, 139.7006], [35.7148, 139.7967]],
  ['tokyo-ueno-shibuya', [35.7141, 139.7774], [35.6580, 139.7016]], ['london-kingscross-westminster', [51.5320, -0.1233], [51.5007, -0.1246]],
  ['paris-nord-eiffel', [48.8809, 2.3553], [48.8584, 2.2945]], ['istanbul-sultanahmet-taksim', [41.0054, 28.9768], [41.0370, 28.9850]]];
(async () => { const out = {};
  for (const [k, a, b] of pairs) { const t0 = Date.now(); let j = null, code = 0;
    for (let t = 0; t < 2 && !j; t++) { try { const r = await fetch(AI + '/transit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pairs: [{ a, b, dow: 3 }] }), signal: AbortSignal.timeout(90000) }); code = r.status; if (r.ok) j = await r.json(); } catch (e) { code = String(e.message || e).slice(0, 60); } }
    const ans = j && (j.answers || j.out || j.routes || j)[0] || j; out[k] = { code, ms: Date.now() - t0, ans };
    console.log(k, code, Date.now() - t0 + ' ms', JSON.stringify(ans).slice(0, 400)); }
  fs.writeFileSync(path.join(__dirname, 'sources', 'transit-probe.json'), JSON.stringify(out, null, 1)); })();
