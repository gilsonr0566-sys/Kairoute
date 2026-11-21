// Runs the app's own map check (src/features/water-check.js) against the real free services for the outside tester's
// Round 1 cases, and saves what it found to tools/beta2/sources/water-probe.json. Free services, no AI.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../src/features/water-check.js'), 'utf8');
// A browser sends its own User-Agent; Node's fetch sends none, which the map services turn away, so the probe names itself.
const uaFetch = (u, o = {}) => fetch(u, Object.assign({}, o, { headers: Object.assign({ 'user-agent': 'Kairoute-test/1.0 (trip planner check)' }, o.headers || {}) }));
const hav = (a, b) => { const R = 6371, t = x => x * Math.PI / 180, d = t(b.lat - a.lat), e = t(b.lng - a.lng), h = Math.sin(d / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(e / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const W = new Function('fetch', 'allSites', 'keyOf', 'save', 'render', 'window', 'navigator', 'hav', src + '; return { waterIslandQuery, waterIslandsFrom, waterAcross, waterOverpass, waterFoot, waterRoadGaps, waterCheck };')(uaFetch, c => c.sites, x => x, () => {}, () => {}, undefined, undefined, hav);
// The app's own check, start to end, as the app runs it: done when the place is marked asked, or after 3 minutes.
const runCheck = async (name, stops, start) => { const city = { city: name, sites: stops.map(x => Object.assign({}, x)) }, t = Date.now(); W.waterCheck(city, [start]);
  let last = ''; while (Date.now() - t < 180000 && !city.waterSig) { await new Promise(r => setTimeout(r, 2000)); const now = city.sites.map(x => x.acrossWater || '').join('|'); if (now !== last && now.replace(/\|/g, '')) { last = now; console.log('  ' + name + ' marked at ' + Math.round((Date.now() - t) / 1000) + ' s'); } }
  return { city, ms: Date.now() - t }; };
// Each case: a start (pier or centre) and stops, with what the tester says is true (across: needs a boat; road: false =
// far from any road).
const CASES = [
  { place: 'Dubrovnik', start: { lat: 42.6584, lng: 18.0850 }, stops: [{ id: 'Lokrum', lat: 42.6272, lng: 18.1194, across: true }, { id: 'Old town walls', lat: 42.6411, lng: 18.1100, across: false }] },
  { place: 'Santorini', start: { lat: 36.4166, lng: 25.4318 }, stops: [{ id: 'Nea Kameni', lat: 36.4040, lng: 25.3960, across: true }, { id: 'Oia', lat: 36.4618, lng: 25.3753, across: false }] },
  { place: 'Reykjavik', start: { lat: 64.1530, lng: -21.9510 }, stops: [{ id: 'Videy', lat: 64.1661, lng: -21.8538, across: true }, { id: 'Hallgrimskirkja', lat: 64.1417, lng: -21.9266, across: false }] },
  { place: 'Marseille', start: { lat: 43.3270, lng: 5.3600 }, stops: [{ id: "Chateau d'If", lat: 43.2798, lng: 5.3253, across: true }, { id: 'Notre-Dame de la Garde', lat: 43.2840, lng: 5.3713, across: false }] },
  { place: 'Venice', start: { lat: 45.4330, lng: 12.3190 }, stops: [{ id: 'San Giorgio Maggiore', lat: 45.4293, lng: 12.3433, across: true, road: false }, { id: 'St Mark\'s Basilica', lat: 45.4345, lng: 12.3397, across: false, road: false }, { id: 'Rialto Bridge', lat: 45.4380, lng: 12.3359, across: false, road: false }] },
  { place: 'Copenhagen (bridges)', start: { lat: 55.6761, lng: 12.5683 }, stops: [{ id: 'Christiansborg (Slotsholmen)', lat: 55.6761, lng: 12.5800, across: false }] },
];
(async () => {
  const out = [];
  for (const c of CASES) {
    const { city, ms } = await runCheck(c.place, c.stops, c.start);
    city.sites.forEach((s, i) => { const want = c.stops[i], got = !!s.acrossWater;
      const r = { place: c.place, stop: s.id, across: s.acrossWater || false, expectAcross: want.across, roadGap: s.roadGap || null, expectNoRoad: want.road === false, done: !!city.waterSig, ms,
        ok: got === want.across && (want.road === false ? s.roadGap > 150 : true) };
      out.push(r); console.log((r.ok ? 'ok   ' : 'FAIL ') + JSON.stringify(r)); });
    await new Promise(r => setTimeout(r, 2000));
  }
  // A whole place at once, as the app asks it (every guide sight plus the start).
  const whole = [];
  for (const [f, start, want] of [['dubrovnik-croatia', { lat: 42.6584, lng: 18.0850 }, /lokrum/i], ['reykjavik-iceland', { lat: 64.1530, lng: -21.9510 }, /vi[dð]ey|peace tower/i]]) {
    let g = []; try { g = JSON.parse(fs.readFileSync(path.join(__dirname, '../places/data', f + '.json'))).guideSights.filter(x => isFinite(x.lat)).slice(0, 79).map((x, i) => ({ id: 'g' + i, name: x.name, lat: x.lat, lng: x.lng })); } catch (e) {}
    const { city, ms } = await runCheck(f, g, start), hits = city.sites.filter(x => x.acrossWater).map(x => x.name + ' across to ' + x.acrossWater);
    const r = { place: f, points: g.length, ms, done: !!city.waterSig, across: hits, wantFound: hits.some(h => want.test(h)), wrong: hits.filter(h => !want.test(h)) };
    whole.push(r); console.log('WHOLE ' + JSON.stringify(r)); await new Promise(r => setTimeout(r, 3000)); }
  out.push({ whole });
  // The helper's free map-and-encyclopedia answer (/ground, no AI) for the piers the outside tester found wrong or missing,
  // asked exactly as the app asks it, so the pier rule can be checked against real answers.
  const ground = [];
  for (const [label, port, c] of [['Dubrovnik, Croatia', 'Dubrovnik', { lat: 42.6407, lng: 18.1077 }], ['Florence, Italy', 'Livorno', { lat: 43.7696, lng: 11.2558 }], ['Paris, France', 'Le Havre', { lat: 48.8566, lng: 2.3522 }],
    ['Haifa, Israel', 'Haifa', { lat: 32.794, lng: 34.9896 }], ['Berlin, Germany', 'Warnemunde', { lat: 52.52, lng: 13.405 }], ['Bangkok, Thailand', 'Laem Chabang', { lat: 13.7563, lng: 100.5018 }], ['CocoCay, Bahamas', 'CocoCay', { lat: 25.8167, lng: -77.9333 }]]) {
    const names = ['Port of ' + port, port + ' cruise terminal', 'Cruise pier'];
    try { const r = await uaFetch('https://kairoute-ai.rickgilson.workers.dev/ground', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://gilsonr0566-sys.github.io' }, body: JSON.stringify({ city: label, names, center: c }) });
      const j = await r.json(); const res = (j.results || []).map((x, i) => ({ q: names[i], wiki: (x.wiki || []).map(w => [w.title, w.lat, w.lng]), map: (x.map || []).map(m => [m.name, m.kind, m.lat, m.lng]) }));
      ground.push({ label, port, status: r.status, res }); console.log('GROUND ' + JSON.stringify({ label, port, res })); } catch (e) { ground.push({ label, port, err: String(e) }); }
    await new Promise(r => setTimeout(r, 1500)); }
  out.push({ ground });
  fs.mkdirSync(path.join(__dirname, 'sources'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'sources', 'water-probe.json'), JSON.stringify({ at: new Date().toISOString(), out }, null, 1));
  console.log(out.filter(x => x.ok).length + ' of ' + out.length + ' as expected');
})();
