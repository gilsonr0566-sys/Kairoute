// Where a listed sight really is (Nov 22 outside test: a synagogue in an old town was placed 2 km away, by the cruise
// port, so the plan sent a 17-minute taxi between two places a 2-minute walk apart). The travel guide's listing, the
// encyclopedia (Wikidata) and the map (OpenStreetMap, the element linked to the same Wikidata item) each give a point.
// One rule, no AI, the same answer every time for the same facts:
//   - a sight that is part of a bigger place (Wikidata P361 "part of" / P276 "located in": an old town, a palace
//     complex) stands in or beside it: a point farther than WHOLE_KM from every such whole is wrong;
//   - the guide's point stands when it is not wrong and the encyclopedia agrees (or says nothing). The map's point is
//     only a witness: a long wall's or a park's middle, or an element tagged with the wrong item, never moves a sight
//     both written sources agree on (Nov 22 refresh: a mosque would have moved 8 km on one mis-tagged map element);
//   - a guide's point that is wrong gives way to the map's, else the encyclopedia's, when that one is not wrong;
//   - when the guide and the encyclopedia disagree, the one the map agrees with stands; when nothing tells, or every
//     point is wrong, the guide's point is kept and marked posDoubt: the app is never told a spot is sure when it isn't.
// Returns { lat, lng, from, posDoubt?, moved? } (moved: km from the listing's point when another point was taken).
const WHOLE_KM = 1.5, AGREE_KM = 0.5;
const hav = (a, b) => { const R = 6371, r = x => x * Math.PI / 180, dl = r(b.lat - a.lat), dg = r(b.lng - a.lng); const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dg / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const ok = p => !!p && isFinite(p.lat) && isFinite(p.lng);
function placeOf(listing, wd, map, wholes) {
  if (!ok(listing)) return null;
  const W = (wholes || []).filter(ok), fits = p => !W.length || W.some(w => hav(p, w) <= WHOLE_KM);
  const out = (from, p, doubt) => Object.assign({ lat: +(+p.lat).toFixed(6), lng: +(+p.lng).toFixed(6), from }, doubt ? { posDoubt: true } : {}, from !== 'listing' && hav(p, listing) > 0.05 ? { moved: +hav(p, listing).toFixed(2) } : {});
  const D = ok(wd) ? wd : null, M = ok(map) ? map : null;
  if (!fits(listing)) { if (M && fits(M)) return out('map', M); if (D && fits(D)) return out('wikidata', D); return out('listing', listing, true); }
  // One written point only, and the map's element for the same item well away from it: one source against another, so
  // the point is kept but marked not sure (never told as sure when it isn't).
  if (!D && M && hav(M, listing) > WHOLE_KM) return out('listing', listing, true);
  if (!D || hav(listing, D) <= AGREE_KM || !fits(D)) return out('listing', listing);
  if (M && hav(M, listing) <= AGREE_KM) return out('listing', listing);
  if (M && hav(M, D) <= AGREE_KM) return out('wikidata', D);
  return out('listing', listing, true);
}
module.exports = { placeOf, WHOLE_KM, AGREE_KM };
