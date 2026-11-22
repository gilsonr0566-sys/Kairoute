// Where a listed sight really is (Nov 22 outside test: a synagogue in an old town was placed 2 km away, by the cruise
// port, so the plan sent a 17-minute taxi between two places a 2-minute walk apart). The travel guide's listing, the
// encyclopedia (Wikidata) and the map (OpenStreetMap, the element linked to the same Wikidata item) each give a point.
// One rule, no AI, the same answer every time for the same facts:
//   - a sight that is part of a bigger place (Wikidata P361 "part of" / P276 "located in": an old town, a palace
//     complex) stands in or beside it: a point farther than WHOLE_KM from every such whole is wrong;
//   - of the points that are not wrong, the map's wins (it is drawn on the ground), then the listing's, then the
//     encyclopedia's;
//   - when every point is wrong, or two points disagree and nothing tells which is right, the sight keeps the
//     listing's point and is marked posDoubt: the app is never told a spot is sure when it isn't.
// Returns { lat, lng, from, posDoubt?, moved? } (moved: km from the listing's point when another point was taken).
const WHOLE_KM = 1.5, AGREE_KM = 0.5;
const hav = (a, b) => { const R = 6371, r = x => x * Math.PI / 180, dl = r(b.lat - a.lat), dg = r(b.lng - a.lng); const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dg / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const ok = p => !!p && isFinite(p.lat) && isFinite(p.lng);
function placeOf(listing, wd, map, wholes) {
  const W = (wholes || []).filter(ok), cand = [['map', map], ['listing', listing], ['wikidata', wd]].filter(([, p]) => ok(p));
  if (!ok(listing)) return null;
  const fits = p => !W.length || W.some(w => hav(p, w) <= WHOLE_KM);
  const good = cand.filter(([, p]) => fits(p));
  const out = (from, p, doubt) => Object.assign({ lat: +(+p.lat).toFixed(6), lng: +(+p.lng).toFixed(6), from }, doubt ? { posDoubt: true } : {}, from !== 'listing' && hav(p, listing) > 0.05 ? { moved: +hav(p, listing).toFixed(2) } : {});
  if (!good.length) return out('listing', listing, true);
  const [from, p] = good[0];
  // Two sources that both pass but stand far apart, with no whole to tell them apart and no map point: not sure.
  const apart = !W.length && from !== 'map' && good.some(([, q]) => hav(p, q) > AGREE_KM);
  return out(from, p, apart);
}
module.exports = { placeOf, WHOLE_KM, AGREE_KM };
