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
  // Nov 23 fold rule: a chapel the encyclopedia files under a palace, seen inside the museum whose travel-guide listing
  // names it (the Sistine Chapel and the Vatican Museums); a fresco inside that chapel goes with it.
  stop('Papal Testpalace', ['building', 'palace', 'structure'], 60, -0.4, -1.7),
  stop('Testine Chapel', ['building', 'chapel', 'church', 'structure'], 90, -0.3, -1.8, { partOf: ['Q133'], src: SRC.slice(1) }),
  stop('Testican Museums', ['art-museum', 'building', 'museum', 'structure'], 65, -0.5, -1.55, { en: 'One of the greatest art galleries in the world, the museum is most famous for its spiral staircase, the Testello Rooms and the exquisitely decorated Testine Chapel. It stands opposite the Church of San Testo.' }),
  stop('The Creation of Testam', ['feature'], 45, -0.31, -1.81, { partOf: ['Q134'] }),
  stop('Church of San Testo', ['building', 'church', 'structure'], 40, -0.7, -1.4),
  stop('Camp Testou', ['building', 'structure'], 80, 2.4, 2.4),
  stop('Testa Club Museum', ['building', 'museum', 'structure'], 40, 2.45, 2.45, { en: 'Trophies of the club. The museum can be visited by booking the Camp Testou Experience package.' }),
  stop('Testopolis Sea Wall', ['structure'], 110, -2.4, 2.2),
  // Names in the traveler's language, any language (rule R-11, Nov 23 Kusadasi): the encyclopedia's English name is shown;
  // a place known only by a local name in every source is never offered.
  stop('Testi Palace', ['building', 'palace', 'structure'], 14, 2.8, 0.6, { wd: 'Q934' }),
  stop('Testkale Müzesi', ['building', 'museum', 'structure'], 9, -2.8, -0.6, { localName: true, wd: 'Q935' }),
  stop('Plajı Testo', ['beach', 'feature'], 8, 3.2, 1.6, { localName: true }),
  stop('Kadı Testesi', [], 6, 3.4, -1.4, { localName: true }),
  // A heritage listing of many works close together is no stop of its own (Thessaloniki, Nov 23 untested-city audit).
  stop('Byzantine monuments of Testonica', ['feature'], 30, 0.9, -2.6, { wd: 'Q940', unesco: true }),
  stop('Church of Saint Testos', ['building', 'church', 'structure'], 20, 0.95, -2.5, { partOf: ['Q940'] }),
  stop('Testonica Rotunda', ['building', 'church', 'structure'], 25, 1.1, -2.7, { partOf: ['Q940'] }),
  stop('Testonica Walls', ['fortification', 'structure'], 22, 0.7, -2.9, { partOf: ['Q940'] }),
  stop('テスト寺', [], 6, -3.4, 1.4, { localName: true }),
  // A work of art held in a museum is seen inside it; one standing outdoors is a stop (Paris live check, Nov 24).
  stop('Venus of Testos', ['creative-work', 'statue'], 73, 0.1, 0.1, { partOf: ['Q990'] }),
  stop('Little Test Maid', ['creative-work', 'statue'], 45, -3.6, -3.6),
  // Names as a guide prints them: a capital first letter, no ", Testopolis" after them.
  stop('place de la Testcorde', ['square', 'structure'], 62, 3.6, -3.2),
  stop('Town Hall, Testopolis', ['building', 'structure'], 38, -3.6, 3.2),
];
const guideSite = Object.assign({ id: 'wv~Q131', name: 'Musei Testolini', minutes: 30, category: 'Sight', fromGuide: true, tags: ['from-guide'] }, at(-0.3, -0.6));
// The guide's own museum, and the travel guide's listing of it under its Italian name 400 m off (Messina, Nov 23).
const builtMuseum = Object.assign({ id: 'museo-t', name: 'Regional Museum of Testopolis', minutes: 75, category: 'Museum', builtin: true }, at(1.5, -1.6));
const twinListing = Object.assign({ id: 'wv~Q132', name: 'Museo regionale di Testopolis', minutes: 60, category: 'Sight', fromGuide: true, tags: ['from-guide'] }, at(1.8, -1.6));
const palaceListing = Object.assign({ id: 'wv~Q934', name: 'Palazzo Testi', minutes: 30, category: 'Sight', fromGuide: true, tags: ['from-guide'] }, at(2.8, 0.6));
const localListing = Object.assign({ id: 'wv~Q935', name: 'Testkale Müzesi', minutes: 60, category: 'Sight', fromGuide: true, tags: ['from-guide'] }, at(-2.8, -0.6));
const fails = []; let n = 0;
const ok = (what, cond, got) => { n++; if (!cond) fails.push(what + (got !== undefined ? ' (got ' + JSON.stringify(got) + ')' : '')); };
(async () => {
  const b = await chromium.launch(), pg = await b.newPage(); await pg.goto('file://' + file); await pg.waitForTimeout(1200);
  const sites = await pg.evaluate(a => { const c = { city: 'Testopolis', country: 'Testland', sites: JSON.parse(JSON.stringify(a.g)), farther: [], starts: {}, restaurants: [] }; window.__kairouteSourceSights(c, a.src);
    return c.sites.map(s => ({ name: s.name, cat: s.category, min: s.minutes, quick: !!s.quick, local: s.local })); }, { src: { area: 'Testopolis', center: C, stops }, g: [guideSite, builtMuseum, twinListing, palaceListing, localListing] });
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
  // The rule itself, on a famous stadium no travel guide or heritage list names (a list of 30 can drop a lesser one for other reasons).
  const np = await pg.evaluate(() => [window.__kairouteNotPlace({ name: 'Testopolis Stadium', kinds: ['building', 'stadium', 'structure'], sl: 120, src: ['Wikidata (Wikipedia in many languages)'] }),
    window.__kairouteNotPlace({ name: 'Old Testopolis Stadium', kinds: ['archaeological', 'stadium'], sl: 40, src: ['Wikidata (Wikipedia in many languages)'] })]);
  ok('a famous football stadium no guide lists is no sight (first-timer walk, Nov 22)', np[0] === true, np);
  ok('an ancient stadium is a sight', np[1] === false, np);
  ok('a village is no sight in a city list', !get('Fishing Village'));
  ok('a demolished building is no sight', !get('Demolished Gate'));
  ok('a world heritage listing of places kilometres apart is no stop of its own', !get('Historic Monuments of Testopolis'));
  ok('the places in that listing stay stops', !!get('North Temple') && !!get('South Temple'));
  ok('a bell tower beside its church is climbed on its own, not folded into the church', !!get('Bell Campanile'));
  ok("a travel-guide listing's museum takes its kind and a museum's visit length from the facts", (get('Musei Testolini') || {}).cat === 'Museum' && (get('Musei Testolini') || {}).min >= 90, get('Musei Testolini'));
  ok('a cistern named "Basilica" is no church: facts known but no kind of ours makes it a plain Sight', (get('Basilica Cistern') || {}).cat === 'Sight', get('Basilica Cistern'));
  ok('a world-famous sight of no kind of ours still gets a long visit, never a flat 40 minutes (Fable gap 11)', (get('Testopolis Sea Wall') || {}).min >= 90, get('Testopolis Sea Wall'));
  ok('a fort is called a castle or fort, never a palace', (get('Fort Testa') || {}).cat === 'Castle or fort', get('Fort Testa'));
  ok('a word the encyclopedia calls a term, not a place, is no stop (the Holy Land)', !get('Holy Testland'));
  ok('a peninsula or region is no stop', !get('Testland Peninsula'));
  ok('what the map calls a county, state or region is no stop', !get('Testshire'));
  ok('an old town that is also a region stays (the Old City of Jerusalem)', !!get('Old City of Testopolis'));
  ok('a holy place with thin data (Bethany) stays', !!get('Bethtest'));
  ok('a saint\'s name on a lift is no church ("Santa Justa Lift")', !!get('Santa Testa Lift') && get('Santa Testa Lift').cat !== 'Church', get('Santa Testa Lift'));
  ok('a travel-guide listing of a sight the guide already has, under its local name, is no second stop (Museo regionale / Regional Museum)', !get('Museo regionale di Testopolis') && sites.filter(s => /Regional Museum of Testopolis/i.test(s.name)).length === 1, sites.filter(s => /Testopolis/.test(s.name)));
  ok("a travel-guide listing shows the place's English name, whatever the listing's language (Palazzo Testi > Testi Palace)", !!get('Testi Palace') && !get('Palazzo Testi'), sites.filter(s => /Testi/.test(s.name)));
  { const loc = sites.filter(s => /Testkale|Plaj|Testesi|テスト/.test(s.local || '') || /Testkale|Plaj|Testesi|テスト/.test(s.name));
    ok('a place with no English name in any source is shown by what it is in English, its own name beneath (Kusadasi, Nov 23)', loc.length >= 2 && loc.every(s => !/Testkale|Plaj|Testesi|テスト/.test(s.name) && /^(Museum|Beach|Local sight|[A-Z][a-z]+( or [a-z]+)?)$/.test(s.name) && s.local), loc.map(s => s.name + ' / ' + s.local));
    ok('a place known only by a name in another script and of no known kind is not offered (it could not be told apart)', !sites.some(s => /テスト/.test(s.local || s.name)), loc.map(s => s.name + ' / ' + s.local)); }
  ok('a chapel a museum\'s listing names as seen inside it is part of that museum visit, not its own stop (Sistine Chapel)', !get('Testine Chapel'), sites.map(s => s.name));
  ok('a fresco inside that chapel is no stop of its own either', !get('The Creation of Testam'));
  ok('the museum itself stays', !!get('Testican Museums'));
  ok('a church the museum\'s listing names as "opposite" stays its own stop', !!get('Church of San Testo'));
  ok('a place a museum\'s listing names only inside a longer name (a stadium tour package) stays its own stop', !!get('Camp Testou'));
  ok('a work of art held in a museum is seen inside that museum, not offered as a stop (Venus de Milo, Paris)', !get('Venus of Testos') && !!get('Grand Museum'), sites.filter(s => /Venus|Grand Museum/.test(s.name)).map(s => s.name));
  ok('a statue standing outdoors is still a stop', !!get('Little Test Maid'), sites.filter(s => /Maid/.test(s.name)).map(s => s.name));
  ok('a sight name starts with a capital letter (place de la Concorde, Paris)', !!get('Place de la Testcorde') && !get('place de la Testcorde'), sites.filter(s => /Testcorde/.test(s.name)).map(s => s.name));
  ok('no ", City" after a sight name in its own city (Hôtel de Ville, Paris)', !!get('Town Hall') && !get('Town Hall, Testopolis'), sites.filter(s => /Town Hall/.test(s.name)).map(s => s.name));
  ok('a heritage listing of three or more listed works close together is no stop of its own; its works stay (Thessaloniki)', !get('Byzantine monuments of Testonica') && !!get('Testonica Rotunda'), sites.filter(s => /Testonica/.test(s.name)).map(s => s.name));
  // Day trips (Kusadasi, Nov 24): an inscription is no place to go; two day trips 1.5 km apart are one outing; a price
  // shows only where a source gives it (no AI guess, no "Free" when nothing is known).
  { const far = (n, id, dx, dy, more) => Object.assign({ id, name: n, minutes: 180, far: true, category: 'Day trip', famousFix: true, fame: 30 }, at(dx, dy), more || {});
    const got = await pg.evaluate(a => { const c = { city: 'Testopolis', country: 'Testland', sites: [], farther: JSON.parse(JSON.stringify(a.far)), starts: {}, restaurants: [] };
      window.__kairouteSourceSights(c, a.src); return c.farther.map(s => s.name); }, { src: { area: 'Testopolis', center: C, stops: [], far: [
      { name: 'Testilos epitaph', wd: 'Q950', sl: 40, kinds: ['creative-work'], km: 50 }, { name: 'Testyma', wd: 'Q951', sl: 45, kinds: ['archaeological', 'temple'], km: 52 }, { name: 'Testim', wd: 'Q952', sl: 30, kinds: ['settlement', 'admin-area'], km: 53 }] },
      far: [far('Testilos epitaph', 'ep-far', 40, 10, { wd: 'Q950', category: 'Ancient Site' }), far('Testyma', 'ty-far', 30, -50, { wd: 'Q951', fame: 45, category: 'Ancient Site' }), far('Testim', 'tm-far', 31, -50.5, { wd: 'Q952', category: 'Scenic Town' }), far('Test Lakes', 'tl-far', -40, 20)] });
    ok('an inscription or other object is no day trip (Seikilos epitaph, Kusadasi)', !got.includes('Testilos epitaph'), got);
    ok('two day trips within 3 km of each other are one outing, the better known kept (Didyma and Didim)', got.includes('Testyma') && !got.includes('Testim') && got.includes('Test Lakes'), got);
    const pr = await pg.evaluate(() => { const b = { builtin: true }; return [window.__kairoutePriceOf({ cost: 150, famousFix: true }, b), window.__kairoutePriceOf({ cost: 0, srcOnly: true }, b), window.__kairoutePriceOf({ cost: 40 }, b), window.__kairoutePriceOf({ cost: 0 }, b), window.__kairoutePriceOf({ cost: 20 }, { ai: true }), window.__kairoutePriceOf({ fee: 'free' }, {})]; });
    ok('a price shows only where a source gives it: none for an AI guess or an unknown, the written guide\'s price and "Free" kept', pr[0] === null && pr[1] === null && pr[2] === 40 && pr[3] === 0 && pr[4] === null && pr[5] === 0, pr); }
  // R-16 one story, one stop (Nov 24, Richard's Chania screenshot: the old-town walk's story on the synagogue's stop and
  // again on the walk's own stop). A story goes to the one sight it is about; a sight its walk stops at, close by, is on
  // that walk; a chapter's sight alone never gets the whole walk; a saved stop given a story before the rule gets it off.
  { const st = await pg.evaluate(() => { const K = window.__kairouteScripts; if (!K.STOP_SCRIPTS.some(x => x.id === 'test-walk'))
      K.STOP_SCRIPTS.push({ id: 'test-walk', v: 1, city: /Storyopolis/, site: /\b(old lanes|story synagogue)\b/i, title: 'Storyopolis Old Lanes', where: 'Storyopolis Old Lanes',
        parts: ['The fountain square', 'Story Synagogue', 'Kastro hill', 'Before you go'].map(name => ({ name, minutes: 1, stand: '', paras: ['x'] })) });
    const s = (id, name, lat, lng, more) => Object.assign({ id, name, lat, lng, minutes: 30 }, more || {});
    const a = { city: 'Storyopolis', sites: [s('syn', 'Story Synagogue', 40.0008, 20.0012), s('ol', 'Old Lanes of Storyopolis', 40, 20, { minutes: 60 }), s('k', 'Kastro', 40.002, 20.002), s('kf', 'Kastro', 40.05, 20.05), s('m', 'Town Museum', 40.001, 20.001)] };
    const b = { city: 'Storyopolis', sites: [s('syn', 'Story Synagogue', 40.0008, 20.0012, { scriptV: 'test-walk1', parts: [{ name: 'x' }, { name: 'y' }] })] };
    return { a: K.stops(a), b: K.stops(b), bParts: b.sites[0].parts || null }; });
    const g = (L, id) => L.find(x => x.id === id) || {};
    ok('a story goes to the one sight it is about, not to a sight its walk stops at (Chania old town and Etz Hayyim)', g(st.a, 'ol').story === 'test-walk1' && !g(st.a, 'syn').story && st.a.filter(x => x.story).length === 1, st.a);
    ok('a sight a story walk stops at, close by, is on that walk; one of the same name far away is not', JSON.stringify(g(st.a, 'syn').onWalk) === '["ol"]' && JSON.stringify(g(st.a, 'k').onWalk) === '["ol"]' && !g(st.a, 'kf').onWalk && !g(st.a, 'm').onWalk, st.a);
    ok('a chapter\'s sight alone never gets the whole walk, and a saved one that had it loses it', !st.b[0].story && !st.bParts, st.b); }
  const rel = await pg.evaluate(() => window.__kairoutePlaceRel({ name: 'Holstentor', lat: 53.8662, lng: 10.6797 }, { name: 'Holstentor', lat: 53.55, lng: 9.99 })[0]);
  ok('the same name 59 km apart is two places (Holstentor in Lubeck is not one near Hamburg)', rel !== 'same', rel);
  ok('no source sight is called "Church" unless it is one', !sites.some(s => s.cat === 'Church' && /mosque|synagogue|shrine|-ji|-taisha/i.test(s.name)));
  await b.close();
  console.log(fails.length ? 'FAILED:\n- ' + fails.join('\n- ') : '');
  console.log(`sight-rules-check: ${n - fails.length} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})();
