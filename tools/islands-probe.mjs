// Asks the live helper's /islands for points given as "name:lat,lng|..." (env PTS), up to 4 times like the app, and
// prints each island's walk answer (R-06). Usage: PTS="Dubrovnik:42.641,18.110" node tools/islands-probe.mjs
const H = 'https://kairoute-ai.rickgilson.workers.dev', O = 'https://gilsonr0566-sys.github.io';
for (const p of (process.env.PTS || '').split('|').filter(Boolean)) { const [name, ll] = p.split(':'), [lat, lng] = ll.split(',');
  for (let t = 1; t <= 4; t++) { const t0 = Date.now();
    try { const r = await fetch(`${H}/islands?lat=${lat}&lng=${lng}`, { headers: { Origin: O }, signal: AbortSignal.timeout(60000) }); const j = await r.json().catch(() => null);
      console.log(`${name} ask ${t}: ${r.status} in ${((Date.now() - t0) / 1000).toFixed(0)} s; ${j && j.shapes ? j.shapes.length + ' islands, ' + j.open + ' not asked yet: ' + j.shapes.filter(s => s.walk !== null).map(s => s.name + '=' + s.walk).join(', ') : JSON.stringify(j)}`);
      if (j && j.shapes && !j.open) break; } catch (e) { console.log(`${name} ask ${t}: stopped (${e.name})`); } } }
