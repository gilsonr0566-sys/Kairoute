// Saves what the helper's /sources answers for a list of places (free sources only: Wikidata, Wikipedia, Wikivoyage,
// heritage registers, UNESCO; no AI), so the app's sight list can be checked offline against a checked list of the
// sights every visitor expects (tools/beta2/fame-expect.json). Runs on GitHub (the container can't reach the helper).
const fs = require('fs'), path = require('path');
const AI = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'ai.json'))).url.replace(/\/$/, '');
const list = JSON.parse(fs.readFileSync(path.join(__dirname, 'fame-expect.json'))).places;
const only = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null;
const key = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
(async () => {
  for (const p of list) { if (only && !only.test(p.label)) continue;
    let j = null, code = 0;
    for (let t = 0; t < 3 && !j; t++) { try { const r = await fetch(AI + '/sources?city=' + encodeURIComponent(p.label), { signal: AbortSignal.timeout(120000) }); code = r.status; if (r.ok) j = await r.json(); } catch (e) { code = String(e.message || e).slice(0, 60); }
      if (!j) await new Promise(r => setTimeout(r, 15000)); }
    console.log(p.label, code, j ? (j.stops || []).length + ' stops' : 'no answer');
    if (j) fs.writeFileSync(path.join(__dirname, 'sources', key(p.label) + '.json'), JSON.stringify(j));
  }
})();
