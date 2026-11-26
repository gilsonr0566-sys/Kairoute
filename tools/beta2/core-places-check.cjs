// Names and places, rule by rule (R-11 and the places step; Nov 25 2026). The fault audit planted random small bugs in
// the planner's shared helpers (src/engine/00-core.js) and in the step that folds the places files into a trip
// (src/engine/05-places.js), and the release gate caught 7 of 20: the saved trips rarely touch these lines (a distance
// at a high latitude, a pier that is a cruise terminal, a guide listing with no English name, a restaurant known only
// in another script, a town's own sights). This check states what each rule must give, with expected values written
// here by hand or worked out a second way (a distance formula of its own, a full scan instead of the grid), never read
// back from the planner. Every name rule is run in every script, and every source a name can come from (the guide, the
// travel guide's listings, a town's sights and places to eat, the map, a pier, a cruise terminal, a lift, a ride note,
// a hotel or station looked up by name) is given names in Greek, Cyrillic, Japanese, Chinese, Hebrew, Arabic, Korean
// and Thai: nothing may leave in another script.
// Usage: node tools/beta2/core-places-check.cjs [--list]   (ENGINE_SRC=<copy of src> checks another copy). Exit 1 on a failure.
'use strict';
const E = require('./engine.cjs');
let pass = 0; const fails = [], list = process.argv.includes('--list');
const eq = (name, got, want) => { const a = JSON.stringify(got), b = JSON.stringify(want); if (a === b) { pass++; if (list) console.log('ok   ' + name); } else fails.push(`${name}: got ${String(a).slice(0, 160)}, expected ${String(b).slice(0, 160)}`); };
const ok = (name, cond, why) => { if (cond) { pass++; if (list) console.log('ok   ' + name); } else fails.push(`${name}${why ? ': ' + why : ''}`); };
const near = (name, got, want, tol) => ok(name, Math.abs(got - want) <= tol, `got ${got}, expected ${want} within ${tol}`);
const safe = (name, fn) => { try { fn(); } catch (e) { fails.push(`${name}: threw ${e.message}`); } };
// A second distance formula (the spherical law of cosines), so the planner's own is never the judge of itself.
const dist = (a, b) => { const r = Math.PI / 180, c = Math.sin(a.lat * r) * Math.sin(b.lat * r) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r); return 6371 * Math.acos(Math.min(1, Math.max(-1, c))); };
let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const SCRIPTS = { Greek: 'Ταβέρνα Θανάσης', Cyrillic: 'Кафе Пушкин', Japanese: '三条駅', kana: 'すし', Chinese: '故宫博物院', Hebrew: 'שוק הכרמל', Arabic: 'مطعم الياسمين', Korean: '경복궁역', Thai: 'วัดพระแก้ว', Armenian: 'Երևան', Georgian: 'თბილისი', Devanagari: 'ताज महल' };
const NOT_LATIN = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\p{Script=Braille}]/u;

// ---------------------------------------------------------------- distances and lookups by position
safe('distance', () => {
  near('distance: London to Paris is about 344 km', E.hav({ lat: 51.5074, lng: -0.1278 }, { lat: 48.8566, lng: 2.3522 }), 343.6, 1);
  near('distance: one degree of latitude is 111.2 km', E.hav({ lat: 10, lng: 20 }, { lat: 11, lng: 20 }), 111.19, 0.05);
  near('distance: one degree of longitude at 60 north is 55.6 km', E.hav({ lat: 60, lng: 20 }, { lat: 60, lng: 21 }), 55.6, 0.1);
  near('distance: one degree of longitude at the equator is 111.2 km', E.hav({ lat: 0, lng: 20 }, { lat: 0, lng: 21 }), 111.19, 0.05);
  eq('distance: a place to itself is 0', E.hav({ lat: 37.97, lng: 23.72 }, { lat: 37.97, lng: 23.72 }), 0);
  let worst = 0; for (let i = 0; i < 300; i++) { const a = { lat: rnd() * 150 - 75, lng: rnd() * 360 - 180 }, b = { lat: a.lat + rnd() * 2 - 1, lng: a.lng + rnd() * 2 - 1 }; worst = Math.max(worst, Math.abs(E.hav(a, b) - dist(a, b)), Math.abs(E.hav(a, b) - E.hav(b, a))); }
  ok('distance: agrees with a second formula on 300 random pairs, both ways round', worst < 0.01, 'off by ' + worst.toFixed(4) + ' km');
});
safe('nearby', () => {
  const pos = x => x && x.p;
  for (const lat0 of [0.3, 37.9, 64.1, -33.8, 78.2]) for (const km of [0.2, 0.7, 3]) {
    const list = []; for (let i = 0; i < 400; i++) list.push(i % 37 === 5 ? { n: i, p: null } : { n: i, p: { lat: lat0 + (rnd() - 0.5) * 0.12, lng: 23 + (rnd() - 0.5) * 0.12 / Math.max(0.2, Math.cos(lat0 * Math.PI / 180)) } });
    list.push(null);
    for (let q = 0; q < 6; q++) { const pt = { lat: lat0 + (rnd() - 0.5) * 0.1, lng: 23 + (rnd() - 0.5) * 0.1 };
      const want = list.filter(x => x && x.p && dist(pt, x.p) <= km).map(x => x.n), got = E.nearby(list, pos, pt, km).map(x => x.n);
      // A place within a hair of the edge may fall either side between two formulas; anything else must match the full scan.
      const edge = n => { const x = list.find(y => y && y.n === n); return Math.abs(dist(pt, x.p) - km) < 0.001; };
      const diff = want.filter(n => !got.includes(n)).concat(got.filter(n => !want.includes(n))).filter(n => !edge(n));
      ok(`nearby: the same places as a full scan (latitude ${lat0}, ${km} km)`, !diff.length, `${diff.length} differ: ${diff.slice(0, 5)}`);
      ok(`nearby: in list order (latitude ${lat0}, ${km} km)`, got.every((n, i) => !i || got[i - 1] < n), got.slice(0, 8).join(','));
    } }
  const L = [{ p: { lat: 10, lng: 10 } }, { p: { lat: 10.001, lng: 10 } }, { p: { lat: 10.02, lng: 10 } }];
  eq('nearby: 111 m away is within 0.2 km, 2.2 km is not', E.nearby(L, pos, { lat: 10, lng: 10 }, 0.2).length, 2);
  eq('nearby: no list, no point or a point with no position gives nothing', [E.nearby(null, pos, { lat: 1, lng: 1 }, 1), E.nearby(L, pos, null, 1), E.nearby(L, pos, { lat: NaN, lng: 1 }, 1), E.nearby(L, pos, { lat: 1, lng: undefined }, 1)], [[], [], [], []]);
  L.push({ p: { lat: 10.0005, lng: 10 } }); eq('nearby: a list that grew is read again', E.nearby(L, pos, { lat: 10, lng: 10 }, 0.2).length, 3);
  const other = x => x && x.q; eq('nearby: the same list read by another position is indexed again', E.nearby([{ p: { lat: 1, lng: 1 }, q: { lat: 5, lng: 5 } }], other, { lat: 5, lng: 5 }, 0.1).length, 1);
});
safe('islands', () => {
  const sq = (s, w, n, e) => [s, w, s, e, n, e, n, w]; // lat, lng corners
  const big = { id: 'big', rings: [sq(10, 20, 11, 21)] }, islet = { id: 'islet', rings: [sq(10.4, 20.4, 10.6, 20.6)] }, far = { id: 'far', rings: [sq(12, 20, 12.5, 20.5)] }, tiny = { id: 'tiny', rings: [[10.45, 20.45, 10.55, 20.45, 10.55, 20.55]] };
  eq('island: a point inside the outline', (E.islandAt([big], { lat: 10.2, lng: 20.2 }) || {}).id, 'big');
  eq('island: a point outside every outline', E.islandAt([big, far], { lat: 11.5, lng: 20.2 }), null);
  eq('island: just north, south, east and west of the outline are off it', [[11.01, 20.5], [9.99, 20.5], [10.5, 21.01], [10.5, 19.99]].map(([lat, lng]) => E.islandAt([big], { lat, lng })), [null, null, null, null]);
  eq('island: the islet inside a bigger outline is the islet, in either order', [E.islandAt([big, islet], { lat: 10.5, lng: 20.5 }).id, E.islandAt([islet, big], { lat: 10.5, lng: 20.5 }).id], ['islet', 'islet']);
  eq('island: beside the islet, still on the big island', E.islandAt([islet, big], { lat: 10.7, lng: 20.5 }).id, 'big');
  eq('island: an outline of fewer than four corners is not an outline', E.islandAt([tiny], { lat: 10.5, lng: 20.5 }), null);
  eq('island: no outlines, no point, or text for a position', [E.islandAt(null, { lat: 1, lng: 1 }), E.islandAt([big], null), E.islandAt([big], { lat: 'x', lng: 20.2 }), E.islandAt([big], { lat: 10.2 })], [null, null, null, null]);
  eq('island: a position given as text still counts', E.islandAt([big], { lat: '10.2', lng: '20.2' }).id, 'big');
  eq('island: a shape with no rings, and a broken ring, are passed over', (E.islandAt([{ id: 'x' }, null, { id: 'y', rings: ['no', null] }, far], { lat: 12.2, lng: 20.2 }) || {}).id, 'far');
  const tri = [0, 0, 0, 10, 10, 0]; eq('outline: inside and outside a triangle', [E.inRing(tri, 2, 2), E.inRing(tri, 8, 8), E.inRing(tri, -1, 2), E.inRing(tri, 2, -1)], [true, false, false, false]);
  const cee = [0, 0, 0, 10, 10, 10, 10, 0, 7, 0, 7, 7, 3, 7, 3, 0]; eq('outline: the notch of a C-shaped island is water', [E.inRing(cee, 5, 3), E.inRing(cee, 5, 8), E.inRing(cee, 1, 3), E.inRing(cee, 8.5, 3)], [false, true, true, true]);
});
// ---------------------------------------------------------------- clock, keys, fixed numbers
safe('clock', () => {
  eq('clock: minutes to a time of day', [0, 1, 59, 60, 570, 719, 720, 721, 779, 780, 1439].map(E.clockText), ['12:00 am', '12:01 am', '12:59 am', '1:00 am', '9:30 am', '11:59 am', '12:00 pm', '12:01 pm', '12:59 pm', '1:00 pm', '11:59 pm']);
  eq('clock: past midnight is the next morning, before midnight the evening before, never a minus sign', [1440, 1500, 2880 + 615, -30, -1440 - 90].map(E.clockText), ['12:00 am', '1:00 am', '10:15 am', '11:30 pm', '10:30 pm']);
  eq('clock: part minutes round to the nearest minute', [570.4, 570.6, 1439.6].map(E.clockText), ['9:30 am', '9:31 am', '12:00 am']);
  const was = E.clockFmt; E.clockFmt = null; eq('clock: am and pm unless the app sets its own format', E.clock(810), '1:30 pm'); E.clockFmt = m => 'T' + m; eq("clock: the app's own format when set", E.clock(810), 'T810'); E.clockFmt = was;
  eq('time of day to minutes', ['09:30', '9:05', '00:00', '23:59', ' 14:20 ', '24:00'].map(E.toMin), [570, 545, 0, 1439, 860, 1440]);
  ok('time of day: anything else is not a time, never a guess', ['', null, undefined, '9', '9:5', '930', 'noon', '9:30 pm', '09:30:00', '1:234'].every(t => Number.isNaN(E.toMin(t))));
  eq('pair key: both places to three decimals, in the order given', [E.pairKey({ lat: 37.97154, lng: 23.72576 }, { lat: '37.9', lng: 23.7 }), E.pairKey({ lat: 1.0004, lng: 2.0005 }, { lat: -3.14159, lng: 0 })], ['37.972,23.726,37.900,23.700', '1.000,2.001,-3.142,0.000']);
  eq('tie-break: by id, then by name, whatever order they came in', [{ id: 'b', name: 'A' }, { id: 'a', name: 'Z' }, { id: 'a', name: 'B' }, { name: 'C' }, { name: 'A' }].sort(E.byId).map(x => (x.id || '') + x.name), ['A', 'C', 'aB', 'aZ', 'bA']);
  for (const o of [['B', 'A', 'C', 'D'], ['D', 'C', 'B', 'A'], ['C', 'D', 'A', 'B']]) eq('tie-break: by name when there is no id (' + o.join('') + ')', o.map(name => ({ name })).sort(E.byId).map(x => x.name), ['A', 'B', 'C', 'D']);
  eq('fixed numbers: food to go 20 min, a trip out to fill a day at most 45 min each way, a meal at most 60 min after its last hour', [E.TO_GO, E.PAD_MAX, E.MEAL_LATE], [20, 45, 60]);
  eq('meal hours: lunch 11:45 am to 2:30 pm (60 min, 35 quick), dinner 6:30 to 9:00 pm (75 min, 45 quick)', E.MEALS, [{ label: 'Lunch', from: 705, to: 870, len: 60, quick: 35 }, { label: 'Dinner', from: 1110, to: 1260, len: 75, quick: 45 }]);
  ok('meal hours cannot be changed by a later step', Object.isFrozen(E.MEALS) && E.MEALS.every(Object.isFrozen));
  eq('an engine error names its reason and what it was about', [E.fail('no ship time'), E.fail('no ship time', { day: 3 })], [{ error: 'no ship time' }, { error: 'no ship time', day: 3 }]);
});
// ---------------------------------------------------------------- what the traveler typed
safe('typed places', () => {
  eq('typed place without its brackets', ['Port (City), Country', 'Piraeus (Athens), Greece', '  Naples ,  Italy ', 'A,, B', ', Rome,', 'Le Havre (Paris) (France)', 'Kotor;', '', null].map(E.bareName), ['Port, Country', 'Piraeus, Greece', 'Naples, Italy', 'A, B', 'Rome', 'Le Havre', 'Kotor;', '', '']);
  eq('typed place: the place alone, before the first comma', ['City, Country', 'Port (City), Country', 'Juneau', 'Half Moon Cay , Bahamas'].map(E.placeOnly), ['City', 'Port', 'Juneau', 'Half Moon Cay']);
  eq('typed place: what the traveler put in brackets', ['Port (Site)', 'Piraeus ( Athens ), Greece', 'No brackets', 'A (B) (C)', '', null].map(E.bracketPlace), ['Site', 'Athens', '', 'B', '', '']);
});
// ---------------------------------------------------------------- a place for a meal
safe('filing keys', () => {
  eq("a place to eat's filing key: small letters and digits, accents off, in Latin letters; never empty for a named place", ['Café Ñandú!', 'Ταβέρνα Θανάσης', 'Ελιά', 'Рандеву', 'すし', '三条', ' שוק ', 'SALMON NOODLE 京都', '', null, 'A  &  B 21'].map(E.eatKey), ['cafe nandu', 'taverna thanasis', 'elia', 'randevu', 'sushi', '三条', 'שוק', 'salmon noodle', '', '', 'a b 21']);
  ok('filing key: two different names in another script never share a key', new Set(Object.values(SCRIPTS).map(E.eatKey)).size === Object.values(SCRIPTS).length && Object.values(SCRIPTS).every(n => E.eatKey(n)));
  eq('filing key: asked again, the same', [E.eatKey('Ελιά'), E.eatKey('Ελιά')], ['elia', 'elia']);
});
safe('meal places', () => {
  const M = [
    [{ name: 'Taverna Platanos', cuisine: 'greek' }, true], [{ name: 'Da Michele', cuisine: 'pizza', amenity: 'restaurant' }, true], [{ name: 'Sala Thai', amenity: 'restaurant' }, true],
    [{ name: 'Gelateria Dondoli', cuisine: 'ice_cream' }, false], [{ name: 'Lukumades', cuisine: 'loukoumades' }, false], [{ name: 'Krispy', cuisine: 'donut' }, false], [{ name: 'Sweet Corner', cuisine: 'dessert' }, false],
    [{ name: 'Coffee Shop Vittoria' }, false], [{ name: 'Bar tabacchi Pappagone' }, false], [{ name: 'Bodega Sherry Bar' }, false], [{ name: 'Blue Lounge' }, false], [{ name: 'Wine Bar Enoteca' }, false],
    [{ name: 'Coffee & Kitchen' }, true], [{ name: 'Espresso Pizza' }, true], [{ name: 'The Lounge', cuisine: 'seafood' }, true], [{ name: 'Juice Bar', cuisine: 'steak' }, true],
    [{ name: 'Central', amenity: 'cafe' }, false], [{ name: 'Central', kind: 'bakery' }, false], [{ name: 'Central', amenity: 'ice_cream' }, false], [{ name: 'Central', kind: 'confectionery' }, false], [{ name: 'Central', amenity: 'pastry' }, false],
    [{ name: 'Central', amenity: 'cafe', cuisine: 'pasta' }, true], [{ name: 'Central', kind: 'touristy', why: 'famous for its chocolate' }, false], [{ name: 'Central', kind: 'touristy', why: 'grilled fish by the harbour' }, true],
    [{ name: 'Central', cuisine: 'regional', why: 'best coffee in town' }, true], [{ name: 'Central', kind: 'cafe', cuisine: 'coffee_shop;lunch' }, true], [{ name: 'Central' }, true], [{}, true],
    [{ name: 'Central', amenity: 'restaurant', kind: 'cafe' }, true], [{ name: 'Central', cuisine: 'waffles' }, false], [{ name: 'Central', cuisine: 'regional', amenity: 'coffee shop' }, false], [{ name: 'Central', cuisine: 'dessert', amenity: 'restaurant' }, true], [{ name: 'Central', cuisine: 'cocktails' }, false], [{ name: 'Central', cuisine: 'sherry', amenity: 'bar' }, false], [{ name: 'Tea Room Vienna', cuisine: 'tea' }, false], [{ name: 'Central', cuisine: 'crepe' }, false],
  ];
  M.forEach(([r, want]) => eq(`a meal is served at ${JSON.stringify(r)}`, E.mealPlace(r), want));
  const C = [[{ name: 'Café Central' }, true], [{ name: 'Caffè Florian' }, true], [{ name: 'Kafeneio To Steki' }, true], [{ name: 'Harbour Bar' }, true], [{ name: 'Cafes Lisboa' }, true], [{ name: 'Kafe Roma' }, true],
    [{ name: 'Bar Pizza Roma' }, false], [{ name: 'Café Central', cuisine: 'seafood' }, false], [{ name: 'Barcelona Grill' }, false], [{ name: 'Barbara' }, false], [{ name: 'Taverna Platanos' }, false], [{ cuisine: 'bar' }, false], [{}, false], [null, false], [undefined, false]];
  C.forEach(([r, want]) => eq(`a café or bar by its name: ${JSON.stringify(r)}`, E.cafeName(r), want));
  eq('worth going out of the way for (a tasting, a local specialty), read from the guide\'s words', [{ name: 'Weingut Mayer' }, { name: 'Niederegger', content: 'Marzipan since 1806' }, { name: 'Corner', note: 'historic counter' }, { name: 'Corner', content: 'cheap sandwiches' }, { name: 'Corner' }, {}].map(E.foodSpecial), [true, true, true, false, false, false]);
  eq('not open to the public (a staff canteen, a members\' club)', [{ name: 'City Hall Staff Cafeteria' }, { name: 'Mensa Uni' }, { name: 'Officers\' Mess' }, { name: 'Trattoria', access: 'private' }, { name: 'Trattoria', access: 'members' }, { name: 'Trattoria', access: 'no' }, 'Employees canteen', { name: 'Trattoria', access: 'yes' }, { name: 'Trattoria' }, { name: 'Privateer Grill' }, null, {}, 'Trattoria'].map(E.notPublicEat), [true, true, true, true, true, true, true, false, false, false, false, false, false]);
});
// ---------------------------------------------------------------- THE names rule, in every script
safe('names', () => {
  eq('another script: every script but Latin', Object.values(SCRIPTS).map(E.otherScript), Object.values(SCRIPTS).map(() => true));
  eq('another script: mixed with Latin letters still counts', ['Café 東京', 'Taverna Θανάσης', 'x١٢٣'].map(E.otherScript), [true, true, true]);
  eq('not another script: Latin with accents, Vietnamese, digits, signs and symbols shared by every script', ['Café Ñandú, Kraków', 'Phở Việt', 'Şehzade Camii', 'Þingvellir', '12:30 – 5 € · № 4 ★ → ™ 〰 ✓ (a) & b!', '', null, undefined, 42].map(E.otherScript), [false, false, false, false, false, false, false, false, false]);
  eq('readable: a name with only Latin letters; no name is not readable', ['Taverna', 'Ταβέρνα', '', null, 'Café №5'].map(E.readable), [true, false, false, false, true]);
  eq('Greek in Latin letters, as on Greek road signs', ['Ζευγολατιό', 'Αθήνα', 'Σταθμός Λαρίσης', 'Ερέχθειο', 'Ψυρρή', 'Μπενάκη', 'Λαμπράκη', 'Ευαγγελισμός', 'Αυλίδα', 'Ναύπλιο', 'Ουρανούπολη', 'Γκάζι', 'Ντολμά', 'Τσιμισκή', 'Τζια', 'ΑΘΗΝΑ', 'ΘΗΣΕΙΟ', 'Ο ΨΑΡΑΣ', 'ΑΧ', 'Χ', 'Χ. Ψ.', 'Χανιά', 'Θήρα', 'Οία', 'Ξάνθη', 'Ελευθερίου Βενιζέλου'].map(E.latin),
    ['Zevgolatio', 'Athina', 'Stathmos Larisis', 'Erechtheio', 'Psyrri', 'Benaki', 'Lampraki', 'Evangelismos', 'Avlida', 'Nafplio', 'Ouranoupoli', 'Gkazi', 'Ntolma', 'Tsimiski', 'Tzia', 'ATHINA', 'THISEIO', 'O PSARAS', 'ACH', 'Ch', 'Ch. Ps.', 'Chania', 'Thira', 'Oia', 'Xanthi', 'Eleftheriou Venizelou']);
  eq('Cyrillic in Latin letters', ['Кафе Пушкин', 'Красная площадь', 'Київ', 'Щука', 'Эрмитаж', 'Юрий Ёлкин', 'Объезд', 'Жуковский', 'Цветной бульвар', 'Ђорђе Љубиша', 'Њујорк Џез'].map(E.latin), ['Kafe Pushkin', 'Krasnaya ploshchad', 'Kiyiv', 'Shchuka', 'Ermitazh', 'Yuriy Yolkin', 'Obezd', 'Zhukovskiy', 'Tsvetnoy bulvar', 'Djordje Ljubisha', 'Njujork Dzez']);
  eq('Japanese kana read as written', ['すし', 'ラーメン', 'とうきょう', 'きょうと', 'さっぽろ', 'しんじゅく', 'ちゃや', 'じゅん', 'ぎんざ', 'カフェ・ド・パリ', 'おおさか', 'ニュー', 'きゃく', 'しょうぐん', 'ぴょん', 'ふぁん', 'しぇ', 'あゃ', 'んゃ'].map(E.latin), ['Sushi', 'Ramen', 'Tokyo', 'Kyoto', 'Sapporo', 'Shinjuku', 'Chaya', 'Jun', 'Ginza', 'Kafe Do Pari', 'Osaka', 'Nyu', 'Kyaku', 'Shogun', 'Pyon', 'Fan', 'She', 'Aya', 'Nya']);
  eq('Latin names pass through as they are; no name is no name', ['Café Ñandú', 'Þingvellir', '', null, undefined, 12].map(E.latin), ['Café Ñandú', 'Þingvellir', '', '', '', '12']);
  eq('the same name asked twice reads the same', [E.latin('Αθήνα'), E.latin('Αθήνα'), E.latin('Αθήνα Αθήνα')], ['Athina', 'Athina', 'Athina Athina']);
  const unreadable = ['三条駅', '故宫博物院', 'שוק הכרמל', 'مطعم الياسمين', '경복궁역', 'วัดพระแก้ว', 'Երևան', 'თბილისი', 'ताज महल'];
  eq('a name nobody can read gives way to the plain word for the thing', unreadable.map(n => E.say(n, 'the stop')), unreadable.map(() => 'the stop'));
  eq('a name with a readable part keeps that part', ['שוק הכרמל Carmel Market', '三条駅 (Sanjo Station)', 'Kyoto 京都', 'مطعم Al Yasmin', '東京 A1', 'Café 東京 -', 'Museum (博物館)'].map(n => E.say(n, 'the stop')), ['Carmel Market', 'Sanjo Station', 'Kyoto', 'Al Yasmin', 'the stop', 'Café', 'Museum']);
  eq('a name in Greek, Cyrillic or kana is written in Latin letters, with or without a plain word', [E.say('Ταβέρνα Θανάσης', 'Lunch'), E.say('Кафе Пушкин'), E.say('すし', 'Lunch'), E.say('Ταβέρνα 三条', 'Lunch')], ['Taverna Thanasis', 'Kafe Pushkin', 'Sushi', 'Taverna']);
  eq('a readable name is never changed', [E.say('Café Ñandú', 'x'), E.say('Train to Uji'), E.say('', 'x'), E.say(null)], ['Café Ñandú', 'Train to Uji', '', '']);
  eq('in a sentence, the unreadable name after to, from, at, via, for, into or towards is "the stop"', ['Train from 三条駅 to Uji', 'Bus to שוק הכרמל', 'Change at 경복궁역 for line 3', 'Tram towards วัดพระแก้ว', 'Walk via 故宫 to the gate', 'Bus for 三条', 'Ride into 三条'].map(t => E.say(t)),
    ['Train from the stop to Uji', 'Bus to the stop', 'Change at the stop for line 3', 'Tram towards the stop', 'Walk via the stop to the gate', 'Bus for the stop', 'Ride into the stop']);
  eq('in a sentence, the unreadable line after take, ride, board or catch is "the line"', ['Take 東西線 two stops', 'Take the 東西線 two stops', 'Ride קו 5 north', 'Board 호선 here', 'Catch the 東西線'].map(t => E.say(t)), ['Take the line two stops', 'Take the line two stops', 'Ride the line 5 north', 'Board the line here', 'Catch the line']);
  eq('in a sentence, any other unreadable word is left out, and no gap or empty bracket is left', ['Metro 東西線 (三条駅), 5 min', 'Lunch · 三条 · 12:30', 'Train from 三条 station', '三条 京都 駅'].map(t => E.say(t)), ['Metro, 5 min', 'Lunch · · 12:30', 'Train from the station', '']);
  eq('a capital first letter, as a guide prints a name', ['piazza Venezia', 'Place de la Concorde', 'élysée', '21 club', '', null].map(E.cap), ['Piazza Venezia', 'Place de la Concorde', 'Élysée', '21 club', '', '']);
  eq('the shown name: the English name when there is one, else Latin letters, else the plain word', [E.shownName({ name: '三条駅', en: 'Sanjo Station' }), E.shownName({ name: 'Ερέχθειο' }), E.shownName({ name: '三条駅' }), E.shownName({ name: '三条駅' }, 'the stop'), E.shownName({ name: 'Erechtheion', en: '' }), E.shownName({ name: '三条駅', en: '京都' }), E.shownName({ name: 'Local', en: '  Town Hall ' }), E.shownName(null, 'x'), E.shownName({ name: '경복궁', en: 5 })],
    ['Sanjo Station', 'Erechtheio', 'Local sight', 'the stop', 'Erechtheion', 'Local sight', 'Town Hall', '', 'Local sight']);
  // Every script, through every way a name is written: nothing leaves in another script.
  for (const [script, n] of Object.entries(SCRIPTS)) for (const out of [E.say(n), E.say(n, 'the stop'), E.say(n, ''), E.say('Train from ' + n + ' to ' + n), E.say(n + ' Café (' + n + ')', 'Lunch'), E.shownName({ name: n }), E.shownName({ name: n, en: n })])
    ok(`${script}: nothing written in that script`, !NOT_LATIN.test(out), JSON.stringify(out));
});
// ---------------------------------------------------------------- the places step, source by source
const A = { lat: 40, lng: 20 }, at = (dLatKm, dLngKm) => ({ lat: A.lat + dLatKm / 111.19, lng: A.lng + dLngKm / (111.19 * Math.cos(A.lat * Math.PI / 180)) });
const site = (id, name, km, more) => Object.assign({ id, name }, at(km, 0), more || {});
const base = more => Object.assign({ cities: { x: { name: 'Xtown', sites: [site('s1', 'Old Fort', 0), site('s2', 'Town Museum', 0.5)], farther: [], restaurants: [] } }, days: [{ i: 0, city: 'x', date: '2027-06-07', type: 'land' }] }, more || {}); // a Monday
const apply = (b, P) => E.applyPlaces(b, { x: P });
safe('places: untouched input, no file', () => {
  const b = base(), was = JSON.stringify(b), P = { sites: { s1: { editions: 40, unesco: true } } }, pw = JSON.stringify(P), out = apply(b, P);
  ok('places: the trip and the places file handed in are never changed', JSON.stringify(b) === was && JSON.stringify(P) === pw);
  eq('places: a place with no file keeps its guide as it was', E.applyPlaces(b, {}).cities.x.sites.map(s => s.name), ['Old Fort', 'Town Museum']);
  eq('places: no places files at all', E.applyPlaces(b, null).cities.x.sites.length, 2);
  eq('places: a file for another place is not used', E.applyPlaces(b, { y: P }).cities.x.sites[0].editions, undefined);
  eq('places: the notes start empty', out.placeNotes, []);
});
safe('places: sight facts', () => {
  const b = base(); b.cities.x.sites[1].hours = 'Mo-Su 10:00-18:00'; b.cities.x.sites[1].web = 'https://own.example';
  const out = apply(b, { sites: { s1: { editions: 40, unesco: true, closedForGood: true, web: 'https://fort.example' }, s2: { editions: 0, hours: 'Mo-Su 09:00-17:00', closedForGood: true, web: 'https://file.example' }, s9: { editions: 99 } } }).cities.x.sites;
  eq('sight facts: how widely known, World Heritage, the official website', [out[0].editions, out[0].unesco, out[0].web], [40, true, 'https://fort.example']);
  eq('sight facts: closed for good only when the map shows no opening hours', [out[0].closedForGood, out[1].closedForGood], [true, undefined]);
  eq("sight facts: the guide's own hours and website are kept", [out[1].hours, out[1].web, out[1].unesco, out[1].editions], ['Mo-Su 10:00-18:00', 'https://own.example', undefined, undefined]);
  const o2 = apply(base(), { sites: { s2: { hours: 'Mo-Su 09:00-17:00', closedForGood: true } } }).cities.x.sites[1]; eq('sight facts: hours from the map where the guide has none; hours mapped today mean it is open', [o2.hours, o2.closedForGood], ['Mo-Su 09:00-17:00', undefined]);
});
safe('places: rides', () => {
  const r1 = { a: at(0, 0), b: at(5, 0), min: 20, km: 6 }, r2 = { a: at(0, 0), b: at(9, 0), min: 10 };
  const b = base(); b.legs = { [E.pairKey(r2.a, r2.b)]: { mode: 'ride', min: 99 } }; b.transit = [{ id: 'old' }];
  const out = apply(b, { transit: [{ id: 't1' }, { id: 't2' }], roads: [r1, r2, { a: r1.a, b: r1.b, min: 500 }, { a: r1.a, min: 5 }, { a: r1.a, b: at(1, 1), min: 'soon' }, null] });
  eq('rides: mapped public transport lines are added to the trip\'s', out.transit.map(t => t.id), ['old', 't1', 't2']);
  eq('rides: a road time becomes a taxi time, a seventh more for traffic plus 10 minutes (20 gives 33)', out.legs[E.pairKey(r1.a, r1.b)], { mode: 'ride', road: true, min: 33, km: 6, a: r1.a, b: r1.b });
  eq('rides: a ride already known for the pair is kept; a road with no end or no time is passed over', [out.legs[E.pairKey(r2.a, r2.b)].min, Object.keys(out.legs).length], [99, 2]);
  eq('rides: no transit and no roads in the file adds nothing', [apply(base(), {}).transit, apply(base(), {}).legs], [undefined, undefined]);
  const o3 = apply(base(), { roads: [{ a: r1.a, b: r1.b, min: 7 }] }); eq('rides: a road with no distance says so (7 min gives 18)', [o3.legs[E.pairKey(r1.a, r1.b)].km, o3.legs[E.pairKey(r1.a, r1.b)].min], [null, 18]);
});
safe('places: piers and ferries', () => {
  const p = (name, kind, more) => Object.assign({ name, kind }, at(1, 1), more || {});
  const out = apply(base({ piers: [{ name: 'Kept', lat: 1, lng: 1 }] }), { ports: [p('Ferry Quay', 'ferry'), p('Cruise Ferry Hall', 'ferry terminal', { cruise: true }), p('Old Pier', 'Pier'), p('Marina', 'marina'), { name: 'No Place', kind: 'ferry' }, p('三条 Ferry', 'ferry'), p('三条', 'pier')],
    piers: [p('East Jetty'), { name: 'Nowhere', lat: 'x', lng: 2 }], ferryLinks: [{ name: 'Γραμμή 1', a: Object.assign({ name: 'Λιμάνι' }, at(0, 0)), b: Object.assign({ name: '三条' }, at(3, 0)) }, { name: 'Broken', a: { lat: 1, lng: 1 } }, { a: at(0, 0), b: at(1, 0) }, { name: 'No place', a: { lat: 'x', lng: 1 }, b: at(1, 0) }, null] });
  eq('piers: ferry piers and quays as mapped, never the cruise terminal, a marina or a pier with no position; an unreadable name is "the ferry pier"', out.piers.map(x => x.name), ['Kept', 'Ferry Quay', 'Old Pier', 'Ferry', 'the ferry pier', 'East Jetty']);
  ok('piers: each with its position', out.piers.slice(1).every(x => isFinite(x.lat) && isFinite(x.lng) && Object.keys(x).length === 3));
  eq('ferry routes between piers, names in Latin letters, a route with a missing end passed over', out.ferryLinks.map(l => [l.name, l.a.name, l.b.name]), [['Grammi 1', 'Limani', ''], ['', '', '']]);
  near('ferry routes: the ends keep their positions', E.hav(out.ferryLinks[0].a, out.ferryLinks[0].b), 3, 0.02);
  eq('piers: none in the file adds none', [apply(base(), { ports: [p('Cruise Hall', 'ferry', { cruise: true })] }).piers, apply(base(), {}).ferryLinks], [undefined, undefined]);
});
safe('places: travel guide sights', () => {
  const g = (name, km, more) => Object.assign({ name }, at(km, 3), more || {});
  const P = { guideSights: [g('Harbour Gallery', 1, { wikidata: 'Q5', editions: 12, web: 'https://g.example', note: 'Paintings', posDoubt: true }), g('old fort', 2), g('Somewhere New', 0, { lat: A.lat, lng: A.lng }), g('Shut Baths', 3, { closedForGood: true }), g('No Place', 4, { lat: undefined }),
    g('Παλάτι', 5, { en: 'The Palace', wikidata: 'Q6', unesco: true, editions: 3 }), g('三条', 6, { noEn: true, wikidata: 'Q7', editions: 50 }), g('Κάστρο', 7, { noEn: true, editions: 8 }), g('market hall', 8, { editions: 8 }), g('Harbour Gallery', 9, { wikidata: 'Q5' }), g('Museo Civico', 10), g('The Town Museum', 11), g('Fort', 12), null, { lat: 1, lng: 1 }] };
  const out = apply(base(), P).cities.x.sites, added = out.slice(2);
  eq('guide sights: join a thin guide, World Heritage first, then the best known, then by id; never one already there (same name, a longer name holding it, or within 150 m), closed for good, with no position, or unreadable with no English name; the same listing once',
    added.map(s => s.name), ['The Palace', 'Harbour Gallery', 'Local sight', 'Market hall', 'Fort', 'Museo Civico']);
  eq('guide sights: ids from the encyclopedia id, else from the name', added.map(s => s.id), ['wv~Q6', 'wv~Q5', 'wv~kastro', 'wv~market-hall', 'wv~fort', 'wv~museo-civico']);
  eq('guide sights: a museum or gallery gets an hour, anything else half an hour', added.map(s => s.minutes), [30, 60, 30, 30, 30, 60]);
  eq('guide sights: the local name in Latin letters under an English name or "Local sight"', added.map(s => s.local), ['Palati', undefined, 'Kastro', undefined, undefined, undefined]);
  eq('guide sights: what each carries', added[1], Object.assign({ id: 'wv~Q5', name: 'Harbour Gallery' }, at(1, 3), { minutes: 60, editions: 12, unesco: false, tags: ['from-guide'], category: 'Sight', fromGuide: true, blurb: 'Paintings', web: 'https://g.example', posDoubt: true }));
  eq('guide sights: World Heritage and editions as given, none is 0', [added[0].unesco, added[0].editions, added[4].editions, added[4].unesco, added[4].blurb, 'web' in added[4]], [true, 3, 0, false, '', false]);
  const eight = base(); for (let i = 3; i <= 8; i++) eight.cities.x.sites.push(site('s' + i, 'Sight ' + i, i * 0.4));
  eq('guide sights: a guide of 8 sights or more is left as it is', apply(eight, P).cities.x.sites.length, 8);
  const seven = base(); for (let i = 3; i <= 7; i++) seven.cities.x.sites.push(site('s' + i, 'Sight ' + i, i * 0.4, { lng: A.lng - 1 }));
  eq('guide sights: a guide of 7 sights takes them', apply(seven, P).cities.x.sites.length, 13);
  const many = { guideSights: Array.from({ length: 60 }, (_, i) => g('Listing ' + String(i).padStart(2, '0'), 1 + i * 0.3, { editions: i })) };
  const m = apply(base(), many).cities.x.sites; eq('guide sights: filled up to 30 sights in all, the best known first', [m.length, m[2].name, m[29].name], [30, 'Listing 59', 'Listing 32']);
  const far = base(); far.cities.x.farther = [site('f1', 'Market Hall', 30)]; eq('guide sights: one the guide already has as a trip out is not added again', apply(far, P).cities.x.sites.some(s => /market hall/i.test(s.name)), false);
  const scr = apply(base(), { guideSights: [g('三条', 1), g('故宫', 2), g('Κάστρο', 3), g('Κάστρο Νέο', 4)] }).cities.x.sites.slice(2);
  eq('guide sights: listings named in another script each keep an id of their own (they all shared one, and all but the first were dropped)', [scr.length, new Set(scr.map(x => x.id)).size, scr.map(x => x.name).sort(), scr.every(x => /^wv~[a-z0-9.-]+$/.test(x.id) && x.id.length > 5)], [4, 4, ['Kastro', 'Kastro Neo', 'Local sight', 'Local sight'], true]);
  eq('guide sights: none in the file, nothing added', apply(base(), { guideSights: [] }).cities.x.sites.length, 2);
});
safe('places: places to eat', () => {
  const e = (name, km, more) => Object.assign({ name }, at(km, 0), more || {});
  const b = base(); b.cities.x.restaurants = [e('Sala Thai', 0, { id: 'r1' }), e('Trattoria Roma', 1, { id: 'r2', hours: 'Mo-Su 12:00-22:00' }), e('Chez Far', 2, { id: 'r3' }), { id: 'r4', name: 'No Place' }, e('Sorbillo', 3, { id: 'r5' }), e('Abc', 4, { id: 'r6' }), e('Gino', 5, { id: 'r7' }), e('Dino Pizza', 8, { id: 'r8' })];
  const P = { cityEats: [e('SALA THAI', 0.2, { hours: 'Mo-Su 12:00-15:00' }), e('Trattoria Roma', 1, { hours: 'Mo-Su 09:00-10:00' }), e('Chez Far', 2.5, { hours: 'Mo-Su 08:00-09:00' }), e('No Place', 9, { hours: 'Mo-Su 07:00-08:00' }),
      e('Ταβέρνα Θανάσης', 6, { cuisine: 'greek', hours: 'Mo-Su 12:00-23:00' }), e('三条', 6.1), e('Staff Canteen', 6.2), e('Club', 6.3, { access: 'private' }), e('Harbour Café', 6.4, { amenity: 'cafe' }), { name: 'Nowhere', lat: 1 }, { lat: 1, lng: 1 }, e('Sala Thai', 7)],
    eatHours: [['Antonio Sorbillo', at(3.1, 0).lat, at(3.1, 0).lng, 'Mo-Su 12:00-16:00', 'restaurant'], ['Sorbillo', at(3.15, 0).lat, at(3.15, 0).lng, 'Mo-Su 11:00-15:00'], ['Sorbillo', at(3.5, 0).lat, at(3.5, 0).lng, 'Mo-Su 01:00-02:00'], ['Trattoria Roma', at(1, 0).lat, at(1, 0).lng, 'Mo-Su 05:00-06:00'], ['Dino', at(8, 0).lat, at(8, 0).lng, 'Mo-Su 10:00-11:00'], ['Gino e Figli', at(5.15, 0).lat, at(5.15, 0).lng, 'Mo-Su 06:00-07:00', 'cafe'], ['Abc', at(4, 0).lat, at(4, 0).lng, 'Mo-Su 01:00-02:00'],
      ['Da Gino Pizzeria', at(5.05, 0).lat, at(5.05, 0).lng, 'Mo-Su 18:00-23:00', 'fast_food'], ['Gino Bar', at(5.01, 0).lat, at(5.01, 0).lng, '', 'bar'], ['Luigi', at(5, 0).lat, at(5, 0).lng, 'Mo-Su 03:00-04:00'], null] };
  const out = apply(b, P).cities.x.restaurants, by = id => out.find(r => r.id === id);
  eq("places to eat: a guide's place also on the map within 300 m takes the map's hours; its own hours are kept; one farther away is another place", [by('r1').hours, by('r2').hours, by('r3').hours], ['Mo-Su 12:00-15:00', 'Mo-Su 12:00-22:00', undefined]);
  eq("places to eat: a guide's place with no position takes the hours of the map's place of its name", by('r4').hours, 'Mo-Su 07:00-08:00');
  eq('places to eat: hours from the map\'s place of the same name within 200 m, the exact name before a longer one, then the nearest', [by('r5').hours, by('r5').mapKind], ['Mo-Su 11:00-15:00', undefined]);
  eq('places to eat: a name under four letters is too short to match; a longer map name holding the name counts, and gives its kind; no hours, no match', [by('r6').hours, by('r7').hours, by('r7').mapKind], [undefined, 'Mo-Su 18:00-23:00', 'fast_food']);
  eq("places to eat: a map name of four letters held in the guide's name counts; a place with its own hours never takes the map's", [by('r8').hours, by('r2').hours], ['Mo-Su 10:00-11:00', 'Mo-Su 12:00-22:00']);
  const added = out.filter(r => r.fromMap);
  eq('places to eat: restaurants on the map join, in Latin letters; never one the guide has, a staff canteen, a private club, a name nobody can read, or one with no position', added.map(r => r.name), ['Taverna Thanasis', 'Harbour Café']);
  eq('places to eat: what a map place carries', added, [Object.assign({ id: 'map~taverna-thanasis', name: 'Taverna Thanasis' }, at(6, 0), { kind: 'restaurant', amenity: 'restaurant', cuisine: 'greek', fromMap: true, hours: 'Mo-Su 12:00-23:00' }), Object.assign({ id: 'map~harbour-cafe', name: 'Harbour Café' }, at(6.4, 0), { kind: 'cafe', amenity: 'cafe', cuisine: '', fromMap: true })]);
  const none = base(); none.cities.x.restaurants = [e('Sorbillo', 3, { id: 'r5' })]; eq('places to eat: no map places in the file, the guide\'s list is left alone', apply(none, {}).cities.x.restaurants, none.cities.x.restaurants);
  const far = base(); far.cities.x.restaurants = [e('Sorbillo', 3, { id: 'r5' })]; eq('places to eat: a map place of the name 250 m away is another place', apply(far, { eatHours: [['Sorbillo', at(3.25, 0).lat, at(3.25, 0).lng, 'Mo-Su 01:00-02:00']] }).cities.x.restaurants[0].hours, undefined);
});
safe('places: towns a day away', () => {
  const T = at(40, 0), tn = (dkm, more) => Object.assign({ lat: T.lat + dkm / 111.19, lng: T.lng }, more || {});
  const b = base(); b.cities.x.farther = [Object.assign({ id: 't1', name: 'Hilltown', minutes: 180, travelNote: 'Train, about 40 min' }, T), Object.assign({ id: 't2', name: 'Seatown', minutes: 45 }, at(60, 0)), Object.assign({ id: 't3', name: 'Plain' }, at(80, 0)), Object.assign({ id: 't1~Q1', name: 'Hill Castle' }, tn(0.5))];
  const P = { towns: { t1: { editions: 30, unesco: true, dayTripListed: true,
      sights: [tn(0.5, { name: 'Hill Castle', wikidata: 'Q1' }), tn(1, { name: 'Museo del Vino', editions: 9, unesco: true }), tn(2.9, { name: 'Κάστρο', en: 'The Keep' }), tn(3.2, { name: 'Too Far' }), tn(1, { name: 'A Bar', kind: 'drink' }), tn(1, { name: '三条', noEn: true }), tn(1, { name: 'Μονή', noEn: true }), { name: 'No Place' }, tn(1.5, { name: 'chapel', kind: 'see' })],
      foodDrink: [tn(0.2, { name: 'Weingut Mayer', kind: 'drink', content: 'Tasting daily' }), { name: 'Ταβέρνα', kind: 'eat' }, tn(0.3, { name: '三条', kind: 'eat' }), { kind: 'eat' }], mapEats: [tn(0.1, { name: 'Map Grill', cuisine: 'grill' })] },
    t2: { sights: [Object.assign({ name: 'Lighthouse' }, at(60.5, 0))], foodDrink: [Object.assign({ name: 'Bar Sol', kind: 'drink' }, at(60, 0))], mapEats: [Object.assign({ name: 'Map Grill', cuisine: 'grill' }, at(60.1, 0)), Object.assign({ name: 'Staff Canteen' }, at(60.1, 0)), Object.assign({ name: '三条' }, at(60.1, 0)), Object.assign({ name: 'Γύρος' }, at(60.2, 0)), { lat: 1, lng: 1 }] } },
    islands: { towns: { t2: { across: true, island: { name: 'Sea Isle' } }, t1: { across: false }, t3: { across: true } } },
    eatHours: [['Map Grill', at(60.1, 0).lat, at(60.1, 0).lng, 'Mo-Su 13:15-16:00', 'restaurant'], ['Bar Sol', at(60, 0).lat, at(60, 0).lng, 'Mo-Su 01:00-02:00']] };
  const c = apply(b, P).cities.x, t1 = c.farther[0], t2 = c.farther[1], t3 = c.farther[2], added = c.farther.slice(4);
  eq('towns: how widely known, World Heritage, listed as a day trip', [t1.editions, t1.unesco, t1.dayTripListed, t2.editions, t2.unesco, t2.dayTripListed], [30, true, true, undefined, undefined, undefined]);
  eq('towns: across the water from the map, with the island\'s name when it has one; a town with no file is left alone', [t1.acrossWater, t2.acrossWater, t3.acrossWater, t3.foodDrink], [undefined, 'Sea Isle', undefined, undefined]);
  eq('towns: the town\'s own sights within 3 km, English names, never a bar, one too far, with no position, or unreadable with no English name', t1.townSights.map(x => x.name), ['Hill Castle', 'Museo del Vino', 'The Keep', 'Local sight', 'chapel']);
  eq('towns: each of its sights becomes a stop of its own, once (never one the list already has)', added.map(x => [x.id, x.name, x.minutes, x.local]), [['t1~1', 'Museo del Vino', 60, undefined], ['t1~2', 'The Keep', 30, 'Kastro'], ['t1~3', 'Local sight', 30, 'Moni'], ['t1~4', 'Chapel', 30, undefined], ['t2~0', 'Lighthouse', 30, undefined]]);
  eq('towns: what a town\'s sight carries', added[0], Object.assign({ id: 't1~1', name: 'Museo del Vino' }, { lat: T.lat + 1 / 111.19, lng: T.lng }, { minutes: 60, far: true, town: 't1', townName: 'Hilltown', travelNote: 'Train, about 40 min', editions: 9, unesco: true, tags: ['in-town'], category: 'Sight' }));
  eq('towns: a sight of a town across the water is across the water too; no ride note is an empty one', [added[4].acrossWater, added[4].travelNote, added[4].editions, added[4].unesco, 'acrossWater' in added[0]], ['Sea Isle', '', 0, false, false]);
  eq('towns: with two or more sights of its own, the town itself is a walk of at most an hour; with one it keeps its length', [t1.townWalk, t2.townWalk, apply(Object.assign(base(), { cities: { x: { name: 'X', sites: [], farther: [Object.assign({ id: 't1', name: 'H', minutes: 40 }, T)] } } }), P).cities.x.farther[0].townWalk, apply(Object.assign(base(), { cities: { x: { name: 'X', sites: [], farther: [Object.assign({ id: 't1', name: 'H' }, T)] } } }), P).cities.x.farther[0].townWalk], [60, undefined, 40, 60]);
  const twoS = { towns: { t1: { sights: [tn(0.5, { name: 'One' }), tn(1, { name: 'Two' })] } } }; eq('towns: two sights of its own are enough for the walk', apply(Object.assign(base(), { cities: { x: { name: 'X', sites: [], farther: [Object.assign({ id: 't1', name: 'H', minutes: 90 }, T)] } } }), twoS).cities.x.farther[0].townWalk, 60);
  eq('towns: food and drink from the travel guide, names in Latin letters, never a name nobody can read', t1.foodDrink.map(x => [x.name, x.kind, x.note, x.special, x.lat == null]), [['Weingut Mayer', 'drink', 'Tasting daily', true, false], ['Taverna', 'eat', '', false, true]]);
  eq('towns: with no place to eat in the guide, the map\'s restaurants beside the town, marked as from the map, with the map\'s hours', t2.foodDrink.map(x => [x.name, x.kind, x.note, !!x.fromMap, x.hours]), [['Bar Sol', 'drink', '', false, undefined], ['Map Grill', 'eat', 'grill', true, 'Mo-Su 13:15-16:00'], ['Gyros', 'eat', '', true, undefined]]);
  eq('towns: with a place to eat in the guide, the map\'s are not added', t1.foodDrink.some(x => x.fromMap), false);
});
safe('places: across the water', () => {
  const sq = (c, half) => { const s = at(c - half, -half), n = at(c + half, half); return [s.lat, s.lng, s.lat, n.lng, n.lat, n.lng, n.lat, s.lng]; };
  const P = { islands: { centreShape: 'main', sites: { s2: { across: true, island: { name: 'Museum Isle' } }, s1: { across: false } },
    shapes: [{ id: 'main', name: 'Mainland', walk: false, rings: [sq(0, 1)] }, { id: 'isle', name: 'Fort Isle', walk: false, rings: [sq(5, 1)] }, { id: 'bridge', name: 'Bridge Isle', walk: true, rings: [sq(10, 1)] }, { id: 'noname', walk: false, rings: [sq(15, 1)] }, { id: 'unk', name: 'Unknown Isle', rings: [sq(20, 1)] }] } };
  const b = base(); b.cities.x.sites = [site('s1', 'Old Fort', 0), site('s2', 'Town Museum', 0.5), site('s3', 'Isle Fort', 5), site('s4', 'Bridge Church', 10), site('s5', 'Rock', 15), site('s6', 'Maybe', 20), site('s7', 'Inland', 30), site('s8', 'Said', 5, { acrossWater: 'Told Isle' })];
  b.cities.x.farther = [site('f1', 'Isle Town', 5.2)];
  const c = apply(b, P).cities.x, aw = c.sites.map(s => s.acrossWater);
  eq('across the water: what the file says of a sight; a stop on a mapped island the centre is not on, with no path on foot; never the centre\'s own island, an island a path reaches, one not known, or dry land; a name kept when already said', aw, [undefined, 'Museum Isle', 'Fort Isle', undefined, true, undefined, undefined, 'Told Isle']);
  eq('across the water: a town a day away on such an island too', c.farther[0].acrossWater, 'Fort Isle');
  const home = JSON.parse(JSON.stringify(b)); home.days = [{ i: 0, city: 'x', date: '2027-06-07', type: 'port', point: at(5, 0.2) }, { i: 1, city: 'x', date: '2027-06-08', type: 'land', lodging: at(5.1, 0) }, { i: 2, city: 'other', date: '2027-06-09', lodging: at(0, 0) }];
  eq('across the water: never the island every day of the place starts from', apply(home, P).cities.x.sites[2].acrossWater, undefined);
  home.days[1].lodging = at(0, 0); eq('across the water: an island only some days start from still needs the boat', apply(home, P).cities.x.sites[2].acrossWater, 'Fort Isle');
  eq('across the water: no island outlines in the file, nothing said', apply(b, { islands: { sites: {} } }).cities.x.sites[2].acrossWater, undefined);
});
safe('places: opening hours for the day', () => {
  const b = base(); b.cities.x.sites[0].hours = 'Mo-Fr 09:00-17:00; Sa,Su off'; b.cities.x.sites[1].hours = 'Tu-Su 10:00-18:00';
  b.days = [{ i: 0, city: 'x', date: '2027-06-07', type: 'land' }, { i: 1, city: 'x', date: '2027-06-12', type: 'land', sites: { s1: { closed: false, oh: { spans: [[600, 660]], last: null } }, s2: { note: 'kept', hours: { mine: 1 } } } }, { i: 2, city: 'y', date: '2027-06-07' }, { i: 3, city: 'x' }];
  const d = apply(b, {}).days;
  eq('hours: read for the day\'s own date: open Monday 9 to 5', [d[0].sites.s1.closed, d[0].sites.s1.oh.spans, d[0].sites.s1.hoursFrom], [false, [[540, 1020]], 'OpenStreetMap']);
  eq('hours: shut on that weekday is shut in the plan', [d[0].sites.s2.closed, d[0].sites.s2.oh], [true, null]);
  eq('hours: a day that already has the sight\'s hours keeps them; what else the day held is kept', [d[1].sites.s1.oh.spans, d[1].sites.s2.note, d[1].sites.s2.oh.spans, d[1].sites.s2.hours.mine, d[1].sites.s2.hours.src], [[[600, 660]], 'kept', [[600, 1080]], 1, 'OpenStreetMap']);
  eq('hours: a day in another place or with no date gets none', [d[2].sites, d[3].sites], [undefined, undefined]);
  const all = base(); all.cities.x.sites[0].hours = '24/7'; eq('hours: "open round the clock" on a place with a door is a placeholder on the map, never taken as known', apply(all, {}).days[0].sites.s1, undefined);
  eq('hours: a sight with no hours gets none', apply(base(), {}).days[0].sites, {});
});
safe('places: where the ship docks, lifts', () => {
  const port = (name, km, more) => Object.assign({ name, cruise: true, kind: 'cruise' }, at(km, 0), more || {});
  const b = base(); b.days = [{ i: 0, city: 'x', date: '2027-06-07', type: 'port', point: Object.assign({ name: 'Xtown port', unknown: true }, at(1, 1)) }, { i: 1, city: 'x', date: '2027-06-08', type: 'port', point: Object.assign({ name: 'Named Pier' }, at(2, 2)) }, { i: 2, city: 'x', date: '2027-06-09', type: 'land' }];
  const two = apply(b, { ports: [port('Near Terminal', 1), port('Far Terminal', 6), Object.assign({ name: 'Ferry Quay', kind: 'ferry' }, at(30, 0))] });
  eq('ship: a guessed dock becomes the mapped cruise terminal farthest from the sights, never a ferry quay', two.days[0].point, Object.assign({ id: null, name: 'Far Terminal' }, at(6, 0), { unknown: false, from: 'OpenStreetMap' }));
  eq('ship: with several terminals the plan says which it used and why; a dock the traveler named is kept', [two.placeNotes, two.days[1].point.name], [[{ day: 0, note: 'Planned from Far Terminal, the cruise terminal farthest from town, until you know which one your ship uses.' }], 'Named Pier']);
  const one = apply(b, { ports: [port('Only Terminal', 3)] }); eq('ship: with one terminal it says where the ship docks', [one.days[0].point.name, one.placeNotes], ['Only Terminal', [{ day: 0, note: 'Your ship docks at Only Terminal.' }]]);
  const tie = apply(b, { ports: [port('B Terminal', 4), port('A Terminal', 4)] }); eq('ship: two terminals equally far, the first by name', tie.days[0].point.name, 'A Terminal');
  const scr = apply(b, { ports: [port('Λιμάνι Επιβατών', 3)] }); eq('ship: a terminal named in another script is written in Latin letters, in the name and in the note', [scr.days[0].point.name, scr.placeNotes[0].note], ['Limani Epivaton', 'Your ship docks at Limani Epivaton.']);
  const scr2 = apply(b, { ports: [port('נמל חיפה', 3)] }); eq('ship: a terminal name nobody can read is "the cruise terminal"', [scr2.days[0].point.name, scr2.placeNotes[0].note], ['the cruise terminal', 'Your ship docks at the cruise terminal.']);
  eq('ship: no cruise terminal on the map, the guess stays and nothing is said', [apply(b, { ports: [Object.assign({ name: 'Ferry Quay', kind: 'ferry' }, at(3, 0))] }).days[0].point.unknown, apply(b, {}).placeNotes], [true, []]);
  const nos = JSON.parse(JSON.stringify(b)); nos.cities.x.sites = []; eq('ship: with no sights to measure from, farthest from the guess itself', apply(nos, { ports: [port('Near Terminal', 1.2, at(1.2, 1)), port('Far Terminal', 6)] }).days[0].point.name, 'Far Terminal');
  const gs = JSON.parse(JSON.stringify(b)); Object.assign(gs.days[0].point, at(10, 0));
  eq('ship: farthest from the sights, not from the guessed dock', [apply(gs, { ports: [port('South Terminal', -6), port('North Terminal', 8)] }).days[0].point.name, apply(gs, { ports: [port('South Terminal', -9), port('North Terminal', 8)] }).days[0].point.name], ['North Terminal', 'South Terminal']);
  const L = { lifts: [{ name: 'Sky Line', kind: 'funicular', ends: [at(2.3, 2), at(4, 4)] }, { name: 'Other', kind: 'gondola', ends: [at(2.1, 2), at(9, 9)] }] };
  const l = apply(b, L); eq('lift: a cable car or funicular starting within 400 m of the landing leads to the town at its other end; the first such; a land day has none', [l.days[1].point.lift, l.days[0].point.lift, l.days[2].point], [{ name: 'Sky Line', kind: 'funicular', top: at(4, 4) }, undefined, undefined]);
  const up = apply(b, { lifts: [{ name: 'Top First', kind: 'gondola', ends: [at(7, 7), at(2.2, 2)] }] }); eq('lift: whichever end is at the landing, the top is the other', up.days[1].point.lift.top, at(7, 7));
  eq('lift: one starting 600 m away is not at the landing', apply(b, { lifts: [{ name: 'Far', kind: 'gondola', ends: [at(2.6, 2), at(7, 7)] }] }).days[1].point.lift, undefined);
  const nm = k => apply(b, { lifts: [Object.assign({ ends: [at(2, 2), at(7, 7)] }, k)] }).days[1].point.lift.name;
  eq('lift: a name known only in another script, or no name, is shown as what it is', [nm({ name: 'Τελεφερίκ', kind: 'gondola' }), nm({ kind: 'funicular' }), nm({ name: '三条' }), nm({})], ['Gondola', 'Funicular', 'Cable car', 'Cable car']);
  const has = JSON.parse(JSON.stringify(b)); has.days[1].point.lift = { name: 'Mine' }; eq('lift: a landing that already has its lift keeps it', apply(has, L).days[1].point.lift, { name: 'Mine' });
});
// ---------------------------------------------------------------- a name in another script planted in EVERY source
safe('places: every source, every script', () => {
  const S = Object.values(SCRIPTS); let k = 0; const p = () => S[k++ % S.length];
  const T = at(40, 0), b = base();
  b.cities.x.sites = [site('s1', p(), 0), site('s2', p() + ' Museum', 0.5, { en: 'Town Museum' }), site('s3', 'Fort ' + p(), 1, { travelNote: 'Bus from ' + p() + ', about 20 min', blurb: p() + ' is old', local: p() }), site('s4', p(), 1.5, { en: p() })];
  b.cities.x.farther = [Object.assign({ id: 't1', name: p(), travelNote: 'Train from ' + p() + ' to ' + p() }, T), Object.assign({ id: 'f9', name: 'Away', townName: p(), townSights: [{ name: p() }] }, at(70, 0))];
  b.cities.x.restaurants = [Object.assign({ id: 'r1', name: p() }, at(0.1, 0))];
  b.days = [{ i: 0, city: 'x', date: '2027-06-07', type: 'port', point: Object.assign({ name: p(), unknown: true }, at(1, 1)), lodging: { name: p() }, hotel: { name: 'Hotel ' + p() }, pier: { name: p() } },
    { i: 1, city: 'x', date: '2027-06-08', type: 'departure', mode: 'flight', point: Object.assign({ name: p() }, at(2, 2)) }, { i: 2, city: 'x', date: '2027-06-09', type: 'arrival', mode: 'train', point: Object.assign({ name: p() }, at(2, 2)) }, { i: 3, city: 'x', date: '2027-06-10', type: 'land', point: Object.assign({ name: p() }, at(2, 2)) }];
  const P = { ports: [Object.assign({ name: p(), cruise: true }, at(5, 0)), Object.assign({ name: p(), kind: 'ferry' }, at(3, 0))], piers: [Object.assign({ name: p() }, at(3, 1))], ferryLinks: [{ name: p(), a: Object.assign({ name: p() }, at(0, 0)), b: Object.assign({ name: p() }, at(3, 0)) }],
    guideSights: S.map((n, i) => Object.assign({ name: n, wikidata: 'Q' + (100 + i) }, at(3 + i, 3), i % 3 === 0 ? { en: 'Listing ' + i } : i % 3 === 1 ? { noEn: true } : {})).concat(S.map((n, i) => Object.assign({ name: n + ' Gate ' + i }, at(20 + i, 3)))),
    cityEats: S.map((n, i) => Object.assign({ name: i % 2 ? n : n + ' Grill ' + i }, at(1 + i * 0.3, 2))),
    towns: { t1: { sights: S.map((n, i) => Object.assign({ name: n }, { lat: T.lat + (i + 1) / 1000, lng: T.lng }, i % 3 === 0 ? { en: 'Town Listing ' + i } : i % 3 === 1 ? { noEn: true } : {})), foodDrink: S.map(n => ({ name: n, kind: 'drink', content: n })), mapEats: S.map((n, i) => Object.assign({ name: n + ' Bar ' + i, cuisine: n }, T)) } },
    lifts: [{ name: p(), kind: 'funicular', ends: [at(2, 2), at(4, 4)] }] };
  const out = apply(b, P), bad = [];
  // Every text in what comes out, but the keys the app never prints as they are (ids, a restaurant's own filing name,
  // a place to eat's note from the map, which the plan's last step writes).
  const walk = (o, path) => { if (typeof o === 'string') { if (NOT_LATIN.test(o) && !/\.restaurants\.\d+\.name$|\.id$|\.note$|\.cuisine$/.test(path)) bad.push(path + ' = ' + o.slice(0, 40)); return; }
    if (o && typeof o === 'object') for (const [kk, v] of Object.entries(o)) walk(v, path + '.' + kk); };
  walk(out.cities, 'cities'); walk(out.days, 'days'); walk(out.piers, 'piers'); walk(out.ferryLinks, 'ferryLinks'); walk(out.placeNotes, 'placeNotes');
  ok(`a name in each of ${S.length} scripts planted in every source a name comes from: none leaves the places step in another script`, !bad.length, `${bad.length} did: ${bad.slice(0, 6).join(' | ')}`);
  const c = out.cities.x;
  eq('names pass: the English name when there is one; Latin letters with no local line that only repeats it; a readable part kept; the plain word otherwise', [c.sites[0].name, c.sites[0].local, c.sites[1].name, c.sites[2].name, c.sites[3].name], ['Taverna Thanasis', undefined, 'Town Museum', 'Fort', 'Local sight']);
  eq('names pass: ride notes and blurbs keep their sentence', [c.sites[2].travelNote, c.sites[2].blurb], ['Bus from Sushi, about 20 min', 'is old']);
  eq('names pass: each day\'s starting point by what it is', [out.days[1].point.name, out.days[2].point.name, out.days[3].point.name, out.days[0].lodging.name, out.days[0].hotel.name, out.days[0].pier.name].map(n => NOT_LATIN.test(n) ? 'BAD' : n).filter(n => /^(the|your)/.test(n)).sort(), ['the airport', 'the pier', 'the station', 'your hotel', 'your starting point'].filter(n => [out.days[1].point.name, out.days[2].point.name, out.days[3].point.name, out.days[0].lodging.name, out.days[0].pier.name].includes(n)).sort());
  const n2 = E.namesIn({ cities: { a: { sites: [{ name: 'piazza Venezia' }, { name: 'Κάστρο', local: 'Κάστρο' }, { name: 'Keep', local: 'Κάστρο' }, null, { id: 'x' }, { name: 'Κάστρο', local: 'The Castle on the Hill' }] }, b: null }, days: [null, { point: null }, { type: 'embark', point: { name: '三条' } }, { type: 'disembark', point: { name: '三条' } }, { mode: 'train', point: { name: '三条' } }], placeNotes: [{ note: 'Your ship docks at 三条.' }] });
  eq('names pass: a capital first letter; a local line in Latin letters, dropped when it only repeats the name; broken entries passed over', n2.cities.a.sites.slice(0, 3), [{ name: 'Piazza Venezia' }, { name: 'Kastro' }, { name: 'Keep', local: 'Kastro' }]);
  eq('names pass: a local line a sight already has is kept', n2.cities.a.sites[5], { name: 'Kastro', local: 'The Castle on the Hill' });
  eq('names pass: a port, an embarkation and a train day, and the notes', [n2.days[2].point.name, n2.days[3].point.name, n2.days[4].point.name, n2.placeNotes[0].note], ['the cruise port', 'the cruise port', 'the station', 'Your ship docks at the stop.']);
  eq('names pass: nothing to do on an empty trip', [E.namesIn({}), E.namesIn({ cities: {}, days: [] })], [{}, { cities: {}, days: [] }]);
  const twice = JSON.stringify(E.namesIn(JSON.parse(JSON.stringify(out)))); ok('names pass: run again, nothing changes', twice === JSON.stringify(out));
});
console.log(`Names and places, rule by rule: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('FAIL ' + f));
process.exit(fails.length ? 1 : 0);
