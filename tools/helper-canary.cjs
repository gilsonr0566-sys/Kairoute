// Canary for rule R-34 (a city nobody has opened yet still gets its guide): asks the live helper for cities that are
// NOT in the warm list, the way the app asks (the app's 60 s limit per ask, up to 4 asks, again only on a 5xx or a
// stopped wait), and fails when any city gets no guide. A different slice of the list each run, so the cities are cold
// (kept answers last 30 days). Prints each stage's time from the helper's answer (ms), so a slow stage is named.
// Run after every helper deploy and every app publish (outside test round 8b, Nov 24: 28 of 36 trips got no guide,
// found 12 hours late because no run was tied to the deploy).
// Usage: node tools/helper-canary.cjs [count] [helper url]
'use strict';
const N = +process.argv[2] || 10, H = process.argv[3] || 'https://kairoute-ai.rickgilson.workers.dev', O = 'https://gilsonr0566-sys.github.io';
const LIST = ['Seville', 'Porto', 'Krakow', 'Budapest', 'Seoul', 'Lima', 'Cape Town', 'Bergen', 'Valletta', 'Tallinn', 'Riga', 'Vilnius', 'Gdansk',
  'Ljubljana', 'Zadar', 'Bologna', 'Verona', 'Palermo', 'Granada', 'Cordoba', 'Malaga', 'Bilbao', 'Bordeaux', 'Lyon', 'Marseille', 'Nice', 'Strasbourg',
  'Cologne', 'Munich', 'Dresden', 'Heidelberg', 'Innsbruck', 'Lucerne', 'Geneva', 'Antwerp', 'Ghent', 'Rotterdam', 'Copenhagen', 'Stockholm', 'Oslo',
  'Helsinki', 'Bratislava', 'Sofia', 'Bucharest', 'Belgrade', 'Sarajevo', 'Tirana', 'Rhodes', 'Corfu', 'Nafplio', 'Izmir', 'Cappadocia', 'Tbilisi',
  'Petra', 'Muscat', 'Doha', 'Cairo', 'Luxor', 'Fes', 'Seville', 'Hanoi', 'Hoi An', 'Bangkok', 'Chiang Mai', 'Siem Reap', 'Kuala Lumpur', 'Bali',
  'Hong Kong', 'Taipei', 'Busan', 'Nara', 'Hiroshima', 'Kanazawa', 'Melbourne', 'Auckland', 'Queenstown', 'Vancouver', 'Quebec City', 'Montreal',
  'Boston', 'Chicago', 'San Francisco', 'New Orleans', 'Savannah', 'Charleston', 'San Juan', 'Cartagena', 'Cusco', 'Quito', 'Santiago', 'Rio de Janeiro',
  'Salvador', 'Montevideo', 'Havana', 'Oaxaca', 'Antigua Guatemala', 'Bermuda', 'Sitka', 'Skagway', 'Victoria', 'Galway', 'York', 'Bath', 'Oxford', 'Cork'];
const uniq = [...new Set(LIST)], day = Math.floor(Date.now() / 86400000), hour = new Date().getUTCHours(), start = ((day * 24 + hour) * N) % uniq.length;
const pick = process.env.CANARY_CITIES ? process.env.CANARY_CITIES.split('|').filter(Boolean) : Array.from({ length: Math.min(N, uniq.length) }, (_, i) => uniq[(start + i) % uniq.length]);
async function asApp(city) {
  const t0 = Date.now(), log = [];
  for (let t = 0; t < 4; t++) { const a0 = Date.now(); let again = true;
    try { const r = await fetch(H + '/sources?city=' + encodeURIComponent(city), { headers: { Origin: O }, signal: AbortSignal.timeout(60000) }); again = r.status >= 500;
      log.push(`${r.status} ${((Date.now() - a0) / 1000).toFixed(0)}s`);
      if (r.ok) { const j = await r.json(); if (j && Array.isArray(j.stops)) return { ok: true, s: (Date.now() - t0) / 1000, log, ms: j.ms || {}, stops: j.stops.length }; }
    } catch (e) { log.push(`${/Timeout|Abort/.test(e.name || '') ? 'stopped at 60s' : 'error'}`); }
    if (!again) break; }
  return { ok: false, s: (Date.now() - t0) / 1000, log };
}
(async () => {
  console.log(`canary: ${pick.length} cities nobody has opened on ${H}`); let bad = 0;
  await Promise.all([0, 1, 2].map(async k => { for (let i = k; i < pick.length; i += 3) { const c = pick[i], r = await asApp(c); if (!r.ok) bad++;
    if (!r.ok) { const t0 = Date.now(); try { const x = await fetch(H + '/sources?city=' + encodeURIComponent(c), { headers: { Origin: O }, signal: AbortSignal.timeout(280000) }); const j = x.ok ? await x.json() : null; r.after = `then one long ask: ${x.status} in ${((Date.now() - t0) / 1000).toFixed(0)} s${j && j.ms ? '; stages ' + Object.entries(j.ms).map(([k, v]) => k + ' ' + (v / 1000).toFixed(0) + 's').join(' ') : ''}`; } catch (e) { r.after = `then one long ask: stopped after ${((Date.now() - t0) / 1000).toFixed(0)} s`; } }
    console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${c}: ${r.s.toFixed(0)} s, asks ${r.log.join(', ')}${r.ok ? `; ${r.stops} sights; stages ${Object.entries(r.ms).map(([k, v]) => k + ' ' + (v / 1000).toFixed(0) + 's').join(' ')}` : ''}${r.after ? '; ' + r.after : ''}`); } }));
  console.log(`helper-canary: ${pick.length - bad} of ${pick.length} cities got their guide the way the app asks${bad ? ', ' + bad + ' got none (R-34)' : ''}`); process.exit(bad ? 1 : 0);
})();
