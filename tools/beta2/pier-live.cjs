// Opens the LIVE Beta 2 site in a browser and asks the app's own pier lookup (no AI: the helper's free map answer) for
// the ports the outside tester found blank, exactly as a trip typed "Port (City), Country" asks it. Prints what each
// candidate became, so the pier rule can be checked against real answers. Changes nothing.
const { chromium } = require('playwright');
const CASES = [['Bangkok, Thailand', { lat: 13.7563, lng: 100.5018 }, 'Laem Chabang'], ['Jerusalem, Israel', { lat: 31.7683, lng: 35.2137 }, 'Haifa'],
  ['Berlin, Germany', { lat: 52.52, lng: 13.405 }, 'Warnemunde'], ['Bruges, Belgium', { lat: 51.2093, lng: 3.2247 }, 'Zeebrugge'], ['Dubrovnik, Croatia', { lat: 42.6407, lng: 18.1077 }, null],
  ['Kotor, Montenegro', { lat: 42.4247, lng: 18.7712 }, null], ['Copenhagen, Denmark', { lat: 55.6761, lng: 12.5683 }, null], ['CocoCay, Bahamas', { lat: 25.8167, lng: -77.9333 }, null],
  ['Florence, Italy', { lat: 43.7696, lng: 11.2558 }, 'Livorno'], ['Paris, France', { lat: 48.8566, lng: 2.3522 }, 'Le Havre']];
(async () => {
  const b = await chromium.launch(), p = await b.newPage(); const grounds = [];
  p.on('response', async r => { if (/\/ground$/.test(r.url())) { try { const body = JSON.parse(r.request().postData() || '{}'); const j = await r.json();
    grounds.push({ city: body.city, names: body.names, res: (j.results || []).map(x => ({ wiki: (x.wiki || []).map(w => w.title).slice(0, 4), map: (x.map || []).map(m => m.name + ' [' + m.kind + ']').slice(0, 6) })) }); } catch (e) {} } });
  await p.goto('https://gilsonr0566-sys.github.io/Kairoute-Beta2/?t=' + Date.now()); await p.waitForTimeout(4000);
  await p.evaluate(() => window.__kairouteMockHelper && window.__kairouteMockHelper('https://kairoute-ai.rickgilson.workers.dev', null, true));
  console.log('version', await p.evaluate(() => { const m = document.documentElement.innerHTML.match(/var B="([^"]*)"/); return m && m[1]; }));
  for (const [label, c, port] of CASES) {
    const n0 = grounds.length;
    const r = await p.evaluate(([l, c, port]) => window.__kairouteSrcStarts(l, c, port).then(s => s.cruise), [label, c, port]).catch(e => 'ERR ' + e.message);
    await p.waitForTimeout(500);
    console.log('PIER ' + JSON.stringify({ label, port, got: r, ground: grounds.slice(n0).map(g => g.res.slice(4)) }));
    await p.waitForTimeout(1500); }
  await b.close();
})();
