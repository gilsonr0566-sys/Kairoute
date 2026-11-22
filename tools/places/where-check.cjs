// Checks for tools/places/where.cjs: where a listed sight is placed when its sources disagree (no network).
const { placeOf } = require('./where.cjs');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const oldTown = { lat: 42.6410, lng: 18.1090 }, wrong = { lat: 42.6506, lng: 18.0914 }, right = { lat: 42.6413, lng: 18.1100 };
// Guide and encyclopedia agree on a wrong point 2 km out of the old town it is part of; the map has it in the old town.
let r = placeOf(wrong, wrong, right, [oldTown]);
ok(r.from === 'map' && Math.abs(r.lat - right.lat) < 1e-4 && r.moved > 1.5 && !r.posDoubt, `a sight 2 km out of the whole it is part of takes the map's point (got ${JSON.stringify(r)})`);
// No map point: the encyclopedia's point in the old town beats the guide's wrong one.
r = placeOf(wrong, right, null, [oldTown]);
ok(r.from === 'wikidata' && !r.posDoubt, `the encyclopedia's point in the whole beats the guide's out of it (got ${JSON.stringify(r)})`);
// Every point is out of the whole: kept, marked not sure.
r = placeOf(wrong, wrong, null, [oldTown]);
ok(r.from === 'listing' && r.posDoubt, `every point out of the whole: kept and marked not sure (got ${JSON.stringify(r)})`);
// Sources agree and fit: nothing changes, nothing marked.
r = placeOf(right, { lat: 42.6415, lng: 18.1102 }, null, [oldTown]);
ok(r.from === 'listing' && !r.posDoubt && !r.moved, `agreeing points in the whole: the guide's point, sure (got ${JSON.stringify(r)})`);
// No whole known, guide and encyclopedia 2 km apart, no map: not sure.
r = placeOf(wrong, right, null, []);
ok(r.from === 'listing' && r.posDoubt, `two sources far apart with nothing to tell: marked not sure (got ${JSON.stringify(r)})`);
// No whole known, guide and encyclopedia disagree: the one the map agrees with stands.
r = placeOf(wrong, right, right, []);
ok(r.from === 'wikidata' && !r.posDoubt, `guide and encyclopedia disagree: the one the map agrees with stands (got ${JSON.stringify(r)})`);
// Guide and encyclopedia agree: a map element far away (a long wall's middle, a mis-tagged element) never moves the sight.
r = placeOf(right, right, { lat: 42.70, lng: 18.20 }, []);
ok(r.from === 'listing' && !r.posDoubt && !r.moved, `two written sources that agree are never moved by the map (got ${JSON.stringify(r)})`);
// A sight a short walk outside its whole (a monastery by the old town's gate) stays where the guide puts it.
r = placeOf({ lat: 42.6420, lng: 18.1200 }, null, null, [oldTown]);
ok(r.from === 'listing' && !r.posDoubt, `a sight a short walk from its whole stays put (got ${JSON.stringify(r)})`);
// One written point, and the map's element for the same item 2 km away: kept, marked not sure.
r = placeOf(wrong, null, right, []);
ok(r.from === 'listing' && r.posDoubt, `one written point against the map 2 km away: marked not sure (got ${JSON.stringify(r)})`);
// One written point and the map agreeing: sure.
r = placeOf(right, null, { lat: 42.6416, lng: 18.1104 }, []);
ok(r.from === 'listing' && !r.posDoubt, `one written point the map agrees with: sure (got ${JSON.stringify(r)})`);
// The helper keeps its own copy of the rule (it can't load this file): every case above gives the same answer there.
{ const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'worker', 'worker.js'), 'utf8');
  const m = /\nfunction placeOf\(listing, wd, map, wholes\) \{[\s\S]*?\n\}\n/.exec(src);
  ok(!!m, "the helper has its own placeOf");
  if (m) { const W = new Function(m[0] + '; return placeOf;')();
    const cases = [[wrong, wrong, right, [oldTown]], [wrong, right, null, [oldTown]], [wrong, wrong, null, [oldTown]], [right, { lat: 42.6415, lng: 18.1102 }, null, [oldTown]], [wrong, right, null, []],
      [wrong, right, right, []], [right, right, { lat: 42.70, lng: 18.20 }, []], [{ lat: 42.6420, lng: 18.1200 }, null, null, [oldTown]], [wrong, null, right, []], [right, null, { lat: 42.6416, lng: 18.1104 }, []]];
    cases.forEach((c, i) => ok(JSON.stringify(W(...c)) === JSON.stringify(placeOf(...c)), `helper's placeOf gives the same answer as where.cjs (case ${i + 1}: ${JSON.stringify(W(...c))} vs ${JSON.stringify(placeOf(...c))})`)); } }
console.log(`where-check: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
