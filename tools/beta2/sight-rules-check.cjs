// Sight rules check (Nov 23): what a sight is, what it is called on its card, how long it takes and whether it is a
// stop of its own, decided from the encyclopedia's facts the helper sends. A made-up city with real kinds of places:
// each line is one rule that once failed on a real trip. Run: node tools/beta2/sight-rules-check.cjs [beta2-site/index.html]
const { chromium } = require('playwright'), path = require('path');
const file = path.resolve(process.argv[2] || 'beta2-site/index.html');
const C = { lat: 41.9, lng: 12.48 }, at = (dx, dy) => ({ lat: +(C.lat + dy / 111).toFixed(5), lng: +(C.lng + dx / 83).toFixed(5) });
const SRC = ['Wikivoyage (English)', 'Wikidata (Wikipedia in many languages)', 'Wikipedia (local language)', 'Heritage register'];
let q = 100; const stop = (name, kinds, sl, dx, dy, more) => Object.assign({ name, wd: 'Q' + (q++), sl, src: SRC, heritage: true, kinds }, at(dx, dy), more || {});
const stops = [
  stop('Grand Museum', ['building', 'museum', 'structure'], 90, 0, 0),
  stop('Painted Chapel', ['building', 'chapel', 'church', 'structure'], 110, 0.15, 0.1, { partOf: ['Q100'] }),
  stop('Iron Tower', ['structure', 'tower'], 150, 1.5, 0),
  stop('Field Park', ['feature', 'park'], 60, 1.6, 0.2),
  stop('Great Mosque', ['building', 'mosque', 'structure'], 70, -1, 0.5),
  stop('Old Synagogue', ['building', 'structure', 'synagogue'], 45, -1.2, 0.6),
  stop('Kitsune-taisha', ['building', 'structure', 'temple'], 45, -1.5, -0.5),
  stop('Kinpo-ji', ['building', 'structure', 'temple'], 60, -1.8, -0.5),
  stop('Teatro di San Fortunato', ['building', 'structure', 'theatre'], 45, 0.5, -1),
  stop('Holy Wisdom', ['building', 'church', 'mosque', 'museum', 'structure'], 152, 2, 1),
  stop('Hill Citadel', ['castle', 'fortification', 'structure'], 70, -2, 1.2),
  stop('Citadel Chapel', ['building', 'chapel', 'church', 'structure'], 20, -2.1, 1.25, { partOf: ['Q110'] }),
  stop('National Assembly', ['organization'], 80, 0.3, 0.8),
  stop('continental Europe', ['continent', 'region'], 200, 0.2, 0.2),
  stop('City Arena', ['arena', 'building', 'structure'], 50, 2.5, -1, { src: SRC.slice(1) }),
  stop('Fishing Village', ['settlement'], 40, 3, 2),
  stop('Demolished Gate', ['building', 'structure'], 60, 0.7, 0.4, { gone: true }),
  stop('Historic Monuments of Testopolis', ['feature'], 41, 0, -2, { unesco: true }),
  stop('North Temple', ['building', 'structure', 'temple'], 30, 0, 3, { partOf: ['Q117'] }),
  stop('South Temple', ['building', 'structure', 'temple'], 33, 0.5, -3.5, { partOf: ['Q117'] }),
  stop('Saint Mark Basilica', ['building', 'church', 'structure'], 65, 3, -2),
  stop('Bell Campanile', ['structure', 'tower'], 36, 3.05, -2.03, { partOf: ['Q120'] }),
  stop('Basilica Cistern', ['structure'], 34, 1, -0.3),
  stop('Fort Testa', ['fortification', 'structure'], 30, -0.8, 1.6),
  stop('Holy Testland', ['feature', 'term'], 91, 0.4, 2.5, { heritage: false }),
  stop('Via Testarosa', ['feature', 'street'], 48, 0.6, 0.3, { heritage: false, src: SRC.slice(1, 2) }),
  stop('Bethtest', ['feature'], 40, 2.2, 1.4, { heritage: false, src: SRC.slice(1, 3) }),
  stop('Old City of Testopolis', ['admin-area', 'feature', 'old-town', 'region', 'settlement'], 84, -0.6, 0.1, { unesco: true }),
  stop('Testland Peninsula', ['feature', 'region'], 160, 1.1, -2.2, { heritage: false }),
  stop('Testshire', ['feature'], 60, -2.6, -1.1, { heritage: false, area: true }),
  stop('Santa Testa Lift', [], 26, 0.9, 0.9),
  stop('Musei Testolini', ['art-museum', 'building', 'museum', 'structure'], 46, -0.3, -0.6),
  stop('Regional Museum of Testopolis', ['building', 'museum', 'structure'], 12, 1.8, -1.6),
];
const guideSite = Object.assign({ id: 'wv~Q131', name: 'Musei Testolini', minutes: 30, category: 'Sight', fromGuide: true, tags: ['from-guide'] }, at(-0.3, -0.6));
// The guide's own museum, and the travel guide's listing of it under its Italian name 400 m off (Messina, Nov 23).
const builtMuseum = Object.assign({ id: 'museo-t', name: 'Regional Museum of Testopolis', minutes: 75, category: 'Museum', builtin: true }, at(1.5, -1.6));
const twinListing = Object.assign({ id: 'wv~Q132', name: 'Museo regionale di Testopolis', minutes: 60, category: 'Sight', fromGuide: true, tags: ['from-guide'] }, at(1.8, -1.6));
const fails = []; let n = 0;
const ok = (what, cond, got) => { n++; if (!cond) fails.push(what + (got !== undefined ? ' (got ' + JSON.stringify(got) + ')' : '')); };
(async () => {
  const b = await chromium.launch(), pg = await b.newPage(); await pg.goto('file://' + file); await pg.waitForTimeout(1200);
  const sites = await pg.evaluate(a => { const c = { city: 'Testopolis', country: 'Testland', sites: JSON.parse(JSON.stringify(a.g)), farther: [], starts: {}, restaurants: [] }; window.__kairouteSourceSights(c, a.src);
    return c.sites.map(s => ({ name: s.name, cat: s.category, min: s.minutes, quick: !!s.quick })); }, { src: { area: 'Testopolis', center: C, stops }, g: [guideSite, builtMuseum, twinListing] });
  const get = nm => sites.find(s => s.name === nm);
  ok('a mosque is called a mosque', (get('Great Mosque') || {}).cat === 'Mosque', get('Great Mosque'));
  ok('a synagogue is called a synagogue', (get('Old Synagogue') || {}).cat === 'Synagogue', get('Old Synagogue'));
  ok('a Shinto shrine is called a shrine', (get('Kitsune-taisha') || {}).cat === 'Shrine', get('Kitsune-taisha'));
  ok('a Buddhist temple is called a temple, not an ancient site', (get('Kinpo-ji') || {}).cat === 'Temple', get('Kinpo-ji'));
  ok('an Italian theatre by its name is a theatre, not an ancient site', (get('Teatro di San Fortunato') || {}).cat === 'Theatre', get('Teatro di San Fortunato'));
  ok('a world-famous church-mosque-museum gets a long visit (75 min or more)', (get('Holy Wisdom') || {}).min >= 75, get('Holy Wisdom'));
  ok('a museum known in 90 languages gets 2.5 hours or more', (get('Grand Museum') || {}).min >= 150, get('Grand Museum'));
  ok('a chapel inside a museum is seen in the museum visit, not a stop', !get('Painted Chapel'), sites.map(s => s.name));
  ok('a chapel inside a citadel is seen in the citadel visit', !get('Citadel Chapel'));
  ok('the citadel itself stays', !!get('Hill Citadel'));
  ok('a famous tower beside a park is its own stop', !!get('Iron Tower'));
  ok('an organisation is no sight', !get('National Assembly'));
  ok('a continent is no sight', !get('continental Europe'));
  ok('an arena no travel guide lists is no sight', !get('City Arena'));
  ok('a village is no sight in a city list', !get('Fishing Village'));
  ok('a demolished building is no sight', !get('Demolished Gate'));
  ok('a world heritage listing of places kilometres apart is no stop of its own', !get('Historic Monuments of Testopolis'));
  ok('the places in that listing stay stops', !!get('North Temple') && !!get('South Temple'));
  ok('a bell tower beside its church is climbed on its own, not folded into the church', !!get('Bell Campanile'));
  ok("a travel-guide listing's museum takes its kind and a museum's visit length from the facts", (get('Musei Testolini') || {}).cat === 'Museum' && (get('Musei Testolini') || {}).min >= 90, get('Musei Testolini'));
  ok('a cistern named "Basilica" is no church: facts known but no kind of ours makes it a plain Sight', (get('Basilica Cistern') || {}).cat === 'Sight', get('Basilica Cistern'));
  ok('a fort is called a castle or fort, never a palace', (get('Fort Testa') || {}).cat === 'Castle or fort', get('Fort Testa'));
  ok('a word the encyclopedia calls a term, not a place, is no stop (the Holy Land)', !get('Holy Testland'));
  ok('a peninsula or region is no stop', !get('Testland Peninsula'));
  ok('what the map calls a county, state or region is no stop', !get('Testshire'));
  ok('an old town that is also a region stays (the Old City of Jerusalem)', !!get('Old City of Testopolis'));
  ok('a holy place with thin data (Bethany) stays', !!get('Bethtest'));
  ok('a saint\'s name on a lift is no church ("Santa Justa Lift")', !!get('Santa Testa Lift') && get('Santa Testa Lift').cat !== 'Church', get('Santa Testa Lift'));
  ok('a travel-guide listing of a sight the guide already has, under its local name, is no second stop (Museo regionale / Regional Museum)', !get('Museo regionale di Testopolis') && sites.filter(s => /Regional Museum of Testopolis/i.test(s.name)).length === 1, sites.filter(s => /Testopolis/.test(s.name)));
  const rel = await pg.evaluate(() => window.__kairoutePlaceRel({ name: 'Holstentor', lat: 53.8662, lng: 10.6797 }, { name: 'Holstentor', lat: 53.55, lng: 9.99 })[0]);
  ok('the same name 59 km apart is two places (Holstentor in Lubeck is not one near Hamburg)', rel !== 'same', rel);
  ok('no source sight is called "Church" unless it is one', !sites.some(s => s.cat === 'Church' && /mosque|synagogue|shrine|-ji|-taisha/i.test(s.name)));
  await b.close();
  console.log(fails.length ? 'FAILED:\n- ' + fails.join('\n- ') : '');
  console.log(`sight-rules-check: ${n - fails.length} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})();
