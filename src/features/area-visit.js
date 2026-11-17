// ---------- Area visits: a place and the sights inside it are one visit ----------
// Richard's Rome day (Jul 13, Nov 17): Piazza San Pietro 30 min, Sistine Chapel 45, St. Peter's Basilica 1 h 30, then
// lunch, then "Vatican City" 2 h 05 again: the same ground counted twice. An area (a city-state, a castle, a walled
// site, a museum complex, a park) and the sights inside it are never planned as separate stops. Which sights are inside
// which area comes from the map's own boundaries (OpenStreetMap areas the sight stands in), never from a guess about
// distance. When the area and sights inside it are both picked for a day, they become one visit:
//  - the sights inside, in a sensible order: timed-ticket sights first (their slot and queues decide the day), then the
//    ones that close earliest, open-air places (a square, a garden) last since they never close;
//  - the area's own time beyond those sights (more than 15 min left) as "the rest of" the area, last;
//  - total time: the sights' own times plus the walks between them, at least the area's own time, never both added.
// The planner routes and fits the visit as one stop, then the Day plan, Guide, tour and printout show its sights as
// consecutive stops under one heading ("Your Vatican City visit").
const AREA_STORE = "kairoute.areas1";
const AREA_NEAR = 1.2; // km: a sight folds into an area only within this of the area's own point (a site, not a whole city centre)
const AREA_EPS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
let areaMem = (() => { try { return JSON.parse(localStorage.getItem(AREA_STORE) || "{}") || {}; } catch (e) { return {}; } })();
const areaAsked = {};
const areaKey = s => keyOf(s.name) + "|" + (+s.lat).toFixed(4) + "|" + (+s.lng).toFixed(4);
function areaSave() { try { const ks = Object.keys(areaMem); if (ks.length > 1500) ks.slice(0, ks.length - 1500).forEach(k => delete areaMem[k]); localStorage.setItem(AREA_STORE, JSON.stringify(areaMem)); } catch (e) {} }
// One question to the map for the whole guide: for each sight, the named areas it stands inside (small ones only).
function areaQuery(pts) {
  return "[out:json][timeout:90];" + pts.map((p, i) => `is_in(${(+p.lat).toFixed(5)},${(+p.lng).toFixed(5)})->.a;area.a[name]->.a;.a convert a n=t["name"],en=t["name:en"],wd=t["wikidata"];out;make sep i=${i};out;`).join("");
}
// What the map answered, per sight: [{ n, en, wd }] (sep elements close each sight's list).
function areaParse(d, pts) {
  const out = {}; let cur = [];
  for (const e of (d && d.elements) || []) {
    if (e.type === "sep") { const p = pts[+(e.tags || {}).i]; if (p) out[areaKey(p)] = cur; cur = []; continue; }
    const t = e.tags || {}; if (!t.name && !t["name:en"]) continue;
    cur.push({ n: t.name || "", en: t["name:en"] || "", wd: t.wikidata || "" });
  }
  return out;
}
async function areaScan(city) {
  if (!city || typeof fetch !== "function") return;
  const k = keyOf(city.city); if (areaAsked[k] && Date.now() - areaAsked[k] < 600000) return; areaAsked[k] = Date.now();
  const need = allSites(city).filter(s => !s.quick && !s.far && isFinite(s.lat) && isFinite(s.lng) && !(areaKey(s) in areaMem)).slice(0, 80);
  if (!need.length) return;
  const q = areaQuery(need);
  for (const ep of AREA_EPS) {
    try {
      const r = await fetch(ep, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "content-type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(100000) });
      if (!r.ok) continue; const d = await r.json();
      if (d.remark && /error|timed out|runtime/i.test(d.remark)) continue;
      const got = areaParse(d, need); if (Object.keys(got).length < need.length) continue; // a cut-short answer is no answer
      Object.assign(areaMem, got); areaSave(); city.areaV = (city.areaV || 0) + 1; // the city's fingerprint moves, so kept plans are made again
      // Only an answer that puts one of the guide's sights inside another changes any plan.
      const all = allSites(city); if (all.some(m => all.some(a => inArea(m, a)))) { planGen++; dataRender(); }
      return;
    } catch (e) {}
  }
}
// The map area is this sight: same Wikidata item, or the same name both ways (English or local).
function areaIs(a, A) {
  if (a.wd && A.wd) return a.wd === A.wd;
  const same = (x, y) => !!x && !!y && nameMatch(x, y) && nameMatch(y, x);
  return [a.en, a.n].some(n => same(n, A.name) || same(n, A.local));
}
// Sight M stands inside area A (by the map's boundaries).
function inArea(M, A) {
  if (!M || !A || M === A || M.id === A.id || !isFinite(M.lat) || !isFinite(A.lat) || M.quick || A.quick) return false;
  const L = areaMem[areaKey(M)]; if (!L || !L.length) return false;
  if (sameSight(M, A) || hav(M, A) > AREA_NEAR) return false;
  return L.some(a => areaIs(a, A));
}
// Order of the sights inside one visit (see the top of this file). The traveler's own order (dragged) wins.
function areaOrder(mem) {
  if (ownOrd && mem.every(m => ownOrd.has(m.id))) return mem.slice().sort((a, b) => ownOrd.get(a.id) - ownOrd.get(b.id));
  const closeAt = m => { const oh = m.oh; if (oh && oh.spans && oh.spans.length) return oh.last != null ? oh.last : oh.spans[oh.spans.length - 1][1]; return 24 * 60; };
  return mem.slice().sort((a, b) => (isOpenAir(a) ? 1 : 0) - (isOpenAir(b) ? 1 : 0) || (bookAhead(b) ? 1 : 0) - (bookAhead(a) ? 1 : 0) || closeAt(a) - closeAt(b) || (b.minutes || 0) - (a.minutes || 0));
}
// One visit for area A and the picked sights inside it (all already planned copies with their minutes).
function areaBlock(A, mem, d) {
  const order = areaOrder(mem), sum = order.reduce((a, m) => a + (m.minutes || 0), 0), rest = Math.round(((A.minutes || 0) - sum) / 5) * 5;
  const parts = rest >= 15 ? order.concat([Object.assign({}, A, { minutes: rest, areaRest: true })]) : order;
  let walk = 0; for (let i = 1; i < parts.length; i++) walk += travel(parts[i - 1], parts[i]).min;
  const c = { lat: parts.reduce((a, p) => a + +p.lat, 0) / parts.length, lng: parts.reduce((a, p) => a + +p.lng, 0) / parts.length };
  // The visit is routed from one point (the middle); the walks in from there to the first sight and out from the last
  // one are counted too, so the real day (from the sights themselves) is never later than the plan that was fitted.
  const cushion = travel(c, parts[0]).min + travel(parts[parts.length - 1], c).min;
  const mine = new Set((d && d.mine) || []), rep = [...order, A].find(x => mine.has(x.id)) || A;
  const b = Object.assign({}, A, { id: rep.id, lat: +c.lat.toFixed(5), lng: +c.lng.toFixed(5), inc: parts, foldOf: [A].concat(order), areaWalk: walk + cushion,
    minutes: Math.ceil((parts.reduce((a, p) => a + (p.minutes || 0), 0) + walk + cushion) / 5) * 5,
    mustSee: !!(A.mustSee || order.some(m => m.mustSee)), unesco: !!(A.unesco || order.some(m => m.unesco)), fame: Math.max(A.fame || 0, ...order.map(m => m.fame || 0)),
    oh: parts[0].oh, cw: parts[0].cw, show: null, far: !!(A.far || order.some(m => m.far)) });
  b.areaFull = b.minutes;
  if (ownOrd) { const v = Math.min(...b.foldOf.map(x => ownOrd.has(x.id) ? ownOrd.get(x.id) : Infinity)); if (isFinite(v)) ownOrd.set(b.id, v); }
  return b;
}
// The day's picks with every area and the picked sights inside it made into one visit. Nested areas (the Sistine
// Chapel inside the Vatican Museums inside Vatican City) go into the outermost picked one.
function foldAreas(chosen, d) {
  const has = new Map();
  for (const A of chosen) { const mem = chosen.filter(M => inArea(M, A)); if (mem.length) has.set(A, mem); }
  if (!has.size) return chosen;
  const tops = [...has.keys()].filter(A => ![...has.keys()].some(B => B !== A && has.get(B).includes(A))).sort((a, b) => has.get(b).length - has.get(a).length);
  let out = chosen.slice(); const used = new Set();
  for (const A of tops) {
    if (used.has(A)) continue;
    const mem = has.get(A).filter(m => !used.has(m));
    if (!mem.length) continue;
    const b = areaBlock(A, mem, d); mem.concat([A]).forEach(x => used.add(x));
    out = out.filter(x => !mem.includes(x)).map(x => x === A ? b : x);
  }
  return out;
}
// The visit's sights as they are shown, with the time the plan gave the visit (a long day can shorten it).
function areaParts(b) {
  const parts = b.inc || [], full = parts.reduce((a, p) => a + (p.minutes || 0), 0), avail = Math.max(0, b.minutes - (b.areaWalk || 0));
  if (!full || avail >= full) return parts;
  const f = avail / full; return parts.map(p => Object.assign({}, p, { minutes: Math.max(5, Math.floor(p.minutes * f / 5) * 5), shortFrom: p.minutes }));
}
// A sight that a planned visit already covers (inside it, or the area around it), so the day never offers it again.
function areaCovered(x, seq) {
  return seq.some(s => !s.mealOf && (s.foldOf ? s.foldOf.some(y => inArea(x, y) || inArea(y, x)) : inArea(x, s) || inArea(s, x)));
}
// The heading above a visit's sights on the Day plan and the printout.
function areaHead(it) {
  const a = it && it.area; if (!a) return "";
  return a.k === 0 ? `Your ${a.name} visit: ${a.n} stops, ${dur(a.minutes)} in all` : `Part of your ${a.name} visit (${a.k + 1} of ${a.n})`;
}
// Test hooks (tools/area-check.cjs): the map's answers, sights added to a day's guide, and what the plan made of them.
if (typeof window !== "undefined") window.__kairouteArea = {
  mem: () => areaMem, keysFor: i => allSites(cityFor(trip.days[i])).filter(x => isFinite(x.lat)).map(x => ({ id: x.id, key: areaKey(x) })), set: m => { areaMem = Object.assign({}, areaMem, m); Object.values(cities).forEach(c => { if (c) c.areaV = (c.areaV || 0) + 1; }); planGen++; dataGen++; }, inArea: (a, b) => inArea(a, b), query: areaQuery, parse: areaParse,
  addSites: (i, list) => { const c = cityFor(trip.days[i]); list.forEach(x => { const o = (c.sites || []).find(y => y.id === x.id); if (o) Object.assign(o, x); else c.sites.push(x); }); planGen++; return allSites(c).map(x => x.id); },
  plan: i => { const d = trip.days[i]; bonusMemo = new Map(); mealMemo = new Map(); keptMemo = new Map(); eveMemo = new Map(); avoidMeals = new Set(); const p = buildPlan(d); if (!p || p.error) return { error: p && p.error };
    let lv = null; try { const st = alarmState(d, p, { before: true }); lv = { at: st.leaveBy, from: st.from && st.from.name }; } catch (e) { lv = { err: String(e) }; }
    const stops = p.items.filter(x => x.type === "stop");
    return { stops: stops.map(x => ({ id: x.place.id, name: x.place.name, t: x.time, len: x.place.minutes || 0, area: x.area || null, rest: !!x.place.areaRest, bonus: !!x.place.bonus, along: !!x.place.along })),
      last: ((p.items.filter(x => (x.type === "stop" && !x.place.bonus && !x.place.along) || x.type === "meal").pop() || {}).place || {}).name, folded: p.folded, dropped: p.dropped.map(x => x.id), end: p.end, endBy: p.endBy, over: p.over, leave: lv,
      html: (document.querySelector("#view") || {}).innerText || "" }; },
};
