// Beta 2 step 1: the places files. For every place a trip visits, gather lasting facts from free public sources and
// save them as one file per place (tools/places/data/<key>.json), so plans are made from checked facts instead of
// whatever a lookup returned that day. Sources, all free and without keys:
//   - Wikidata: what a place is, how widely known it is (number of language editions), UNESCO World Heritage, closed
//     for good, part of a bigger site.
//   - OpenStreetMap (Overpass): opening hours as mapped, fees, and the cruise terminals and piers at a port.
//   - Wikivoyage: the towns travelers' guides send people to for a day ("Go next", "Day trips"), and the listed
//     sights and food & drink places in those towns.
// No AI, no paid service. Runs on GitHub (beta2-live.yml) where the internet is open. Usage:
//   node tools/places/build.cjs [snapshots dir] [targets.json]
// Each file is printed as PLACES lines (gzip + base64) so it can be read back from the run's log.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), { merge } = require('./merge.cjs');
const SNAP = process.argv[2] || path.join(__dirname, '..', 'beta2', 'snapshots');
const TARGETS = process.argv[3] || path.join(__dirname, 'targets.json');
const OUT = path.join(__dirname, 'data'); fs.mkdirSync(OUT, { recursive: true });
const UA = 'KairouteBeta/0.1 (trip planner test build; places facts)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, opt = {}, tries = 4, wait = 60000) {
  for (let i = 0; i < tries; i++) {
    try {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), wait);
      const r = await fetch(url, Object.assign({ headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctl.signal }, opt)); clearTimeout(t);
      if (r.status === 429 || r.status >= 500) { await sleep(3000 * (i + 1)); continue; }
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { console.warn('  fetch failed', url.slice(0, 90), e.message); await sleep(2000 * (i + 1)); }
  }
  return null;
}
const hav = (a, b) => { const R = 6371, r = x => x * Math.PI / 180, dl = r(b.lat - a.lat), dg = r(b.lng - a.lng); const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dg / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const baseName = s => String(s || '').replace(/^cruise port of\s+/i, '').replace(/\s*\(.*?\)\s*/g, ' ').split(',')[0].trim();
const qOf = id => { const m = /(?:^|-)q(\d+)$/i.exec(String(id)); return m ? 'Q' + m[1] : null; };

// ---- Wikidata
const WD = 'https://www.wikidata.org/w/api.php?format=json&origin=*';
async function entities(qs) {
  const out = {};
  for (let i = 0; i < qs.length; i += 50) {
    const j = await get(`${WD}&action=wbgetentities&props=claims|sitelinks|labels&languages=en&ids=${qs.slice(i, i + 50).join('|')}`);
    Object.assign(out, (j && j.entities) || {}); await sleep(300);
  }
  return out;
}
const claim = (e, p) => ((e && e.claims && e.claims[p]) || []).map(c => c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value).filter(Boolean);
const ids = (e, p) => claim(e, p).map(v => v.id).filter(Boolean);
const coord = e => { const c = claim(e, 'P625')[0]; return c ? { lat: c.latitude, lng: c.longitude } : null; };
const WHS = 'Q9259';
// Closed for good: an end date or closure date stated plainly. One with a qualifier ("as a museum", "of this part")
// is about a former use, not the place (a building that stopped being a museum is still open), so it doesn't count.
// The official website (Wikidata P856), https preferred: where the Book tickets link starts (never a made-up address).
const officialWeb = e => { const w = claim(e, 'P856').filter(u => typeof u === 'string' && /^https?:\/\//i.test(u)); return w.find(u => /^https:/i.test(u)) || w[0] || ''; };
const shut = e => ['P576', 'P3999'].some(p => ((e && e.claims && e.claims[p]) || []).some(c => c.rank !== 'deprecated' && !Object.keys(c.qualifiers || {}).length));
// The item a name stands for near a point: of the matches within km, the most widely known (most language editions),
// so a town is not mistaken for a street or building named after it. A name with extra words ("X old town",
// "X monastery") is tried again without its last word when nothing matches.
async function findQ(name, near, km) {
  const words = String(name).split(/\s+/).filter(Boolean);
  for (let n = words.length; n >= 1; n--) {
    const j = await get(`${WD}&action=wbsearchentities&language=en&type=item&limit=7&search=${encodeURIComponent(words.slice(0, n).join(' '))}`);
    const hits = ((j && j.search) || []).map(x => x.id);
    if (hits.length) {
      const es = await entities(hits); let best = null;
      for (const q of hits) { const c = coord(es[q]); if (!c) continue; const d = near ? hav(near, c) : 0, ed = Object.keys(es[q].sitelinks || {}).length;
        if (d <= km && (!best || ed > best.ed || (ed === best.ed && d < best.d))) best = { q, d, c, ed }; }
      if (best) return best;
    }
    if (n <= 1 || words.slice(0, n - 1).join(' ').length < 4) break;
    await sleep(200);
  }
  return null;
}
async function whsNear(p, km) {
  const q = `SELECT ?w ?wLabel WHERE { SERVICE wikibase:around { ?w wdt:P625 ?loc. bd:serviceParam wikibase:center "Point(${p.lng} ${p.lat})"^^geo:wktLiteral. bd:serviceParam wikibase:radius "${km}". } ?w wdt:P1435 wd:${WHS}. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`;
  const j = await get('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } });
  return ((j && j.results && j.results.bindings) || []).map(b => ({ q: b.w.value.split('/').pop(), name: b.wLabel && b.wLabel.value }));
}

// ---- OpenStreetMap
// Map queries are slow when busy: each mirror gets a long wait and a second try before the next one is asked.
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
async function overpass(ql) {
  for (let round = 0; round < 2; round++)
    for (const u of OVERPASS) { const j = await get(u, { method: 'POST', body: 'data=' + encodeURIComponent(ql), headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' } }, 1, 200000);
      // A server that ran out of time says so in a remark and sends no elements: that is a failed try, not "nothing here".
      if (j && !(j.remark && /runtime error|timed out|out of memory/i.test(j.remark))) return j.elements || [];
      if (j) console.log('   map server:', String(j.remark).slice(0, 120)); await sleep(5000); }
  console.log('   map lookup gave nothing after every try');
  return [];
}
const pos = el => el.lat != null ? { lat: el.lat, lng: el.lon } : el.center ? { lat: el.center.lat, lng: el.center.lon } : null;
const CRUISE = /cruise|croisi|crocier|crucer|kreuzfahrt|cruzeir|kruvaz|terminal de passag|passenger terminal|passagier/i;
async function cruisePoints(p, island) {
  const r = island ? 4000 : 12000;
  const els = await overpass(`[out:json][timeout:90];(nwr(around:${r},${p.lat},${p.lng})["amenity"="ferry_terminal"];nwr(around:${r},${p.lat},${p.lng})["building"]["name"~"cruise|croisi|crocier|crucer|kreuzfahrt|cruzeir|terminal",i];nwr(around:${r},${p.lat},${p.lng})["landuse"="harbour"]["name"];nwr(around:${r},${p.lat},${p.lng})["man_made"="pier"]["name"];);out tags center;`);
  return els.map(el => { const t = el.tags || {}, q = pos(el); if (!q) return null; const name = t['name:en'] || t.name || '';
    const cruise = CRUISE.test(name) || /cruise/i.test(t.ferry || '') || t.cruise === 'yes';
    return { name, lat: +q.lat.toFixed(5), lng: +q.lng.toFixed(5), osm: el.type + '/' + el.id, kind: t.amenity === 'ferry_terminal' ? 'ferry terminal' : t.man_made === 'pier' ? 'pier' : 'terminal', cruise, d: +hav(p, q).toFixed(2) };
  }).filter(x => x && x.name).sort((a, b) => (b.cruise - a.cruise) || a.d - b.d).slice(0, 12);
}

// Cable cars, gondolas and funiculars around a place, each with its two ends: a landing below a town (a tender port
// under cliffs) is reached by one, and the engine counts its queue and ride as fixed steps of the day.
async function liftsNear(centre, km) {
  const r = Math.round(km * 1000);
  const els = await overpass(`[out:json][timeout:90];(way(around:${r},${centre.lat},${centre.lng})["aerialway"~"^(cable_car|gondola)$"];way(around:${r},${centre.lat},${centre.lng})["railway"="funicular"];);out tags geom;`);
  return els.filter(e => e.geometry && e.geometry.length >= 2).map(e => { const t = e.tags || {}, g = e.geometry, a = g[0], b = g[g.length - 1];
    return { name: t['name:en'] || t.name || (t.railway === 'funicular' ? 'Funicular' : 'Cable car'), kind: t.railway === 'funicular' ? 'funicular' : 'cable car',
      ends: [{ lat: +a.lat.toFixed(5), lng: +a.lon.toFixed(5) }, { lat: +b.lat.toFixed(5), lng: +b.lon.toFixed(5) }], osm: 'way/' + e.id }; })
    .filter(l => hav(l.ends[0], l.ends[1]) >= 0.1).sort((x, y) => x.osm.localeCompare(y.osm));
}

// The travel guide's own "see" listings for the place itself (on the map, within 12 km of its centre), with how widely
// known each is and UNESCO: a place whose saved guide is thin gets more to choose from.
// Opening hours, fee and website from the map, matched by the Wikidata tag mappers put on each sight. Asked sight by
// sight around its own spot (400 m), 20 at a time: one search around a whole spread-out city (Barcelona to Montserrat)
// timed out and left every sight without hours. items: [{ id, q, lat, lng }]. Returns { id: { hours, fee, web, osm } }.
async function mapFacts(items) {
  const out = {}, ok = items.filter(x => x.q && isFinite(x.lat) && isFinite(x.lng));
  for (let i = 0; i < ok.length; i += 20) {
    const part = ok.slice(i, i + 20);
    const els = await overpass(`[out:json][timeout:120];(${part.map(x => `nwr(around:400,${x.lat},${x.lng})["wikidata"="${x.q}"];`).join('')});out tags center;`);
    for (const el of els || []) { const tg = el.tags || {}; for (const x of part.filter(y => y.q === tg.wikidata)) {
      const f = out[x.id] = out[x.id] || {}; if (tg.opening_hours && !f.hours) f.hours = tg.opening_hours; if (tg.fee && !f.fee) f.fee = tg.fee;
      const w = tg.website || tg['contact:website']; if (!f.web && /^https?:\/\//i.test(w || '')) f.web = w; if (!f.osm) f.osm = el.type + '/' + el.id; } }
    await sleep(1500);
  }
  return out;
}
async function guideSights(title, centre) {
  const page = title ? await wvText(title) : null; if (!page) return [];
  // A big city's guide lists its sights on its district pages ("Dubai/Deira"): with fewer than 8 sights on the main page,
  // the districts it links to are read too (up to 12).
  let text = page.text;
  if (listings(text).filter(l => l.kind === 'see').length < 8) {
    const subs = [...new Set([...text.matchAll(/\[\[\s*([^\]|#]+?\/[^\]|#]+?)\s*(?:\|[^\]]*)?\]\]/g)].map(m => m[1].trim()).filter(t => t.toLowerCase().startsWith(page.title.toLowerCase() + '/')))].slice(0, 12);
    for (const t of subs) { const sp = await wvText(t); await sleep(300); if (sp) text += '\n' + sp.text; }
  }
  const out = listings(text).filter(l => l.kind === 'see' && isFinite(l.lat) && isFinite(l.lng) && hav(centre, l) <= 12)
    .map(l => ({ name: l.name, lat: l.lat, lng: l.lng, wikidata: /^Q\d+$/.test(l.wikidata) ? l.wikidata : '', note: l.content || '' }));
  const qs = [...new Set(out.map(x => x.wikidata).filter(Boolean))];
  if (qs.length) { const e = await entities(qs), lp = new Set(); Object.values(e).forEach(x => ids(x, 'P361').forEach(q => lp.add(q))); const lpe = lp.size ? await entities([...lp]) : {};
    for (const x of out) { const k = e[x.wikidata]; if (!k) continue; x.editions = Object.keys(k.sitelinks || {}).length;
      x.unesco = ids(k, 'P1435').includes(WHS) || ids(k, 'P361').some(q => ids(lpe[q], 'P1435').includes(WHS)); if (shut(k)) x.closedForGood = true; const w = officialWeb(k); if (w) x.web = w; } }
  return out;
}

// Public transport lines around a place (metro, light rail, tram, monorail, suburban train), each with its stops in
// order, so every leg they serve can offer them. Stops are the line's own stop or station nodes, merged by name.
async function transitLines(centre, km) {
  const r = Math.round(km * 1000);
  const els = await overpass(`[out:json][timeout:180];rel(around:${r},${centre.lat},${centre.lng})["type"="route"]["route"~"^(subway|light_rail|tram|monorail|train)$"]->.r;.r out body;node(r.r);out;`);
  const nodes = new Map(els.filter(e => e.type === 'node').map(e => [e.id, e])), seen = new Set(), lines = [];
  for (const rel of els.filter(e => e.type === 'relation')) {
    const t = rel.tags || {};
    const stops = [];
    for (const m of rel.members || []) {
      if (m.type !== 'node' || !/^(stop|stop_entry_only|stop_exit_only|platform|)$/.test(m.role || '')) continue;
      const n = nodes.get(m.ref); if (!n || !n.tags || !n.tags.name) continue;
      const name = n.tags['name:en'] || n.tags.int_name || n.tags['name:el-Latn'] || n.tags['name:latin'] || n.tags.name;
      if (stops.length && stops.some(s => s.name === name)) continue;
      stops.push({ name, lat: +n.lat.toFixed(5), lng: +n.lon.toFixed(5) });
    }
    if (stops.length < 2) continue;
    const key = t.route + '|' + (t.ref || t.name) + '|' + [stops[0].name, stops[stops.length - 1].name].sort().join('|');
    if (seen.has(key)) continue; seen.add(key);   // the same line mapped once each way
    // Trains reach day trips too (Athens to Corinth): kept, with only the stops within 150 km of the place.
    if (t.route === 'train') { const keep = stops.filter(s => hav(centre, s) <= 150); if (keep.length < 2) continue; stops.splice(0, stops.length, ...keep); }
    lines.push({ mode: t.route, ref: t.ref || '', name: t['name:en'] || t.name || '', stops });
  }
  return lines;
}

// ---- Wikivoyage
const WV = 'https://en.wikivoyage.org/w/api.php?format=json&origin=*';
async function wvText(title) {
  const j = await get(`${WV}&action=parse&prop=wikitext&redirects=1&page=${encodeURIComponent(title)}`);
  return j && j.parse && j.parse.wikitext ? { title: j.parse.title, text: j.parse.wikitext['*'] } : null;
}
function section(text, re) {
  const lines = text.split('\n'), out = []; let on = false, lvl = 0;
  for (const l of lines) { const h = /^(=+)\s*(.*?)\s*\1\s*$/.exec(l); if (h) { if (on && h[1].length <= lvl) on = false; if (re.test(h[2])) { on = true; lvl = h[1].length; continue; } } if (on) out.push(l); }
  return out.join('\n');
}
const links = s => [...s.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)].map(m => m[1].trim()).filter(x => !/^(File|Image|Category|wikipedia|w):/i.test(x));
function listings(text) {
  const out = [];
  for (const m of text.matchAll(/\{\{\s*(see|do|eat|drink|buy|listing|sleep)\s*\|([\s\S]*?)\}\}/gi)) {
    const kind = m[1].toLowerCase(); if (kind === 'sleep') continue;
    const f = {}; for (const part of m[2].split(/\n?\s*\|\s*/)) { const k = /^(\w[\w-]*)\s*=\s*([\s\S]*)$/.exec(part.trim()); if (k) f[k[1].toLowerCase()] = k[2].trim(); }
    const lat = parseFloat(f.lat), lng = parseFloat(f.long || f.lon || f.lng); if (!f.name) continue;
    out.push({ kind, name: f.name.replace(/\[\[|\]\]|'''?/g, ''), lat: isFinite(lat) ? lat : null, lng: isFinite(lng) ? lng : null, hours: f.hours || '', price: f.price || '', wikidata: f.wikidata || '', content: (f.content || '').replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').slice(0, 240) });
  }
  return out;
}

// Where the ship docks: the port town found by name (tried twice: the search is sometimes busy), then its mapped
// cruise terminals and piers.
async function portPoints(port, centre, island) {
  let p = port.known && isFinite(port.lat) ? port : null;
  for (let i = 0; !p && i < 2; i++) { const f = await findQ(baseName(port.name), centre, 400); if (f) p = f.c; else await sleep(3000); }
  if (!p) return { ports: [], missing: ['the port town', 'a mapped cruise terminal or pier'] };
  const ports = await cruisePoints(p, island);
  return { ports, missing: ports.some(x => x.cruise) ? [] : ['a mapped cruise terminal or pier'] };
}

async function buildPlace(t) {
  console.log(`\n== ${t.key} (${t.name})`);
  const out = { key: t.key, name: t.name, built: new Date().toISOString().slice(0, 10), sources: ['Wikidata', 'OpenStreetMap', 'Wikivoyage'], sites: {}, towns: {}, ports: [], dayTrips: [], missing: [],
    portQuery: t.port ? Object.assign({}, t.port, { island: !!t.island }) : null };   // kept so a later refresh can look again
  // Centre: the guide's sights, else the place found by name.
  let centre = t.centre;
  if (!centre) { const f = await findQ(baseName(t.name), null, 1e9); if (f) centre = f.c; }
  if (!centre) { out.missing.push('where this place is'); return out; }
  out.centre = centre;
  // 1. Wikidata facts for every sight that names its item, and for the towns a day away (found by name near them).
  // A sight whose id names no item is looked up by its name within a kilometre of where it is.
  for (const s of t.sites) { if (qOf(s.id) || !s.name || !isFinite(s.lat)) continue; const f = await findQ(s.name, s, 1); if (f) s.q = f.q; await sleep(200); }
  const qOfSite = s => qOf(s.id) || s.q || null;
  const qs = [...new Set(t.sites.map(qOfSite).filter(Boolean))];
  for (const s of t.farther) { const f = await findQ(s.name, s, 15); if (f) s.q = f.q; await sleep(200); }
  const all = await entities([...new Set(qs.concat(t.farther.map(s => s.q).filter(Boolean)))]);
  const parts = new Set(); Object.values(all).forEach(e => ids(e, 'P361').forEach(q => parts.add(q)));
  const partE = parts.size ? await entities([...parts]) : {};
  const fact = e => ({ wikidata: e.id, editions: Object.keys(e.sitelinks || {}).length, types: ids(e, 'P31'),
    unesco: ids(e, 'P1435').includes(WHS) || ids(e, 'P361').some(q => ids(partE[q], 'P1435').includes(WHS)),
    closedForGood: shut(e), partOf: ids(e, 'P361'), web: officialWeb(e) });
  for (const s of t.sites) { const q = qOfSite(s); if (q && all[q]) out.sites[s.id] = fact(all[q]); }
  // 2. OpenStreetMap hours and fees, matched by the Wikidata tag mappers put on the map.
  // Asked only around the place itself (a world-wide search times out on a busy map server).
  { const items = t.sites.map(x => { const q = qOfSite(x), c = q && coord(all[q]); return { id: x.id, q, lat: isFinite(x.lat) ? x.lat : c && c.lat, lng: isFinite(x.lng) ? x.lng : c && c.lng }; });
    const mf = await mapFacts(items);
    for (const [id, f] of Object.entries(mf)) { const o = out.sites[id] = out.sites[id] || {}; if (f.hours && !o.hours) o.hours = f.hours; if (f.fee) o.fee = f.fee; if (f.web && !o.web) o.web = f.web; o.osm = f.osm; } }
  // 3. Towns a day away: Wikidata fame and UNESCO, Wikivoyage listing as a day trip, and their own sights and food & drink.
  const host = await wvText(baseName(t.name)); await sleep(300);
  if (host) { const goNext = links(section(host.text, /^(go next|day trips?|nearby|around)/i)); out.dayTrips = [...new Set(goNext)].slice(0, 40); out.wikivoyage = host.title; }
  else out.missing.push('travel guide page');
  for (const s of t.farther) {
    const e = s.q && all[s.q], town = { name: s.name, wikidata: s.q || null, editions: e ? Object.keys(e.sitelinks || {}).length : 0, unesco: false, dayTripListed: false, sights: [], foodDrink: [] };
    town.dayTripListed = out.dayTrips.some(x => baseName(x).toLowerCase() === baseName(s.name).toLowerCase());
    const w = await whsNear(s, 3); town.unesco = w.length > 0; if (w.length) town.unescoSites = w.map(x => x.name); await sleep(300);
    const page = await wvText(baseName(s.name)); await sleep(300);
    // Sights: the guide's "see" listings on the map near the town. Food & drink: its eat, drink and buy listings, kept
    // even without a map point (the guide still names them for the town).
    if (page) for (const l of listings(page.text)) {
      const onMap = isFinite(l.lat) && isFinite(l.lng);
      if (l.kind === 'see') { if (onMap && hav(s, l) <= 20) town.sights.push(l); }
      else if (l.kind === 'eat' || l.kind === 'drink' || l.kind === 'buy') { if (!onMap || hav(s, l) <= 20) town.foodDrink.push(l); }
    }
    // How widely known each of the town's sights is, and UNESCO (itself or as part of a listed site), from Wikidata.
    const lq = [...new Set(town.sights.map(x => x.wikidata).filter(q => /^Q\d+$/.test(q)))];
    if (lq.length) {
      const le = await entities(lq), lp = new Set(); Object.values(le).forEach(e => ids(e, 'P361').forEach(q => lp.add(q)));
      const lpe = lp.size ? await entities([...lp]) : {};
      for (const x of town.sights) { const e = le[x.wikidata]; if (!e) continue; x.editions = Object.keys(e.sitelinks || {}).length;
        x.unesco = ids(e, 'P1435').includes(WHS) || ids(e, 'P361').some(q => ids(lpe[q], 'P1435').includes(WHS)); }
    }
    out.towns[s.id] = town;
  }
  // 4. Ports: the real cruise terminals or piers near where the ship docks.
  if (t.port) { const r = await portPoints(t.port, centre, !!t.island); out.ports = r.ports; out.missing.push(...r.missing); }
  // 3b. The guide's own sights for the place itself.
  if (host) out.guideSights = await guideSights(host.title, centre);
  // 4a. Cable cars and funiculars (a landing below the town).
  out.lifts = await liftsNear(centre, 15);
  // 4b. Public transport lines within reach of the sights.
  if (centre) {
    const spread = Math.max(3, ...t.sites.filter(s => isFinite(s.lat)).map(s => hav(centre, s)));
    out.transit = await transitLines(centre, Math.min(25, spread + 2));
    if (!out.transit.length) out.missing.push('public transport lines on the map');
  }
  // 5. A place with no guide at all (a private island): its own sights from the travel guide and the map.
  if (!t.sites.length) {
    const page = await wvText(baseName(t.name)); await sleep(300);
    if (page) out.guideSights = listings(page.text).filter(l => hav(centre, l) < 10);
    const els = await overpass(`[out:json][timeout:90];(nwr(around:3000,${centre.lat},${centre.lng})["tourism"~"attraction|viewpoint|museum"];nwr(around:3000,${centre.lat},${centre.lng})["leisure"~"beach_resort|water_park|park|nature_reserve"]["name"];nwr(around:3000,${centre.lat},${centre.lng})["natural"="beach"]["name"];nwr(around:3000,${centre.lat},${centre.lng})["amenity"~"restaurant|cafe|bar|ice_cream"]["name"];);out tags center;`);
    out.mapPlaces = els.map(el => { const q = pos(el), tg = el.tags || {}; return q && { name: tg['name:en'] || tg.name, lat: q.lat, lng: q.lng, kind: tg.tourism || tg.leisure || tg.natural || tg.amenity, hours: tg.opening_hours || '', osm: el.type + '/' + el.id }; }).filter(x => x && x.name);
    if (!(out.guideSights || []).length && !out.mapPlaces.length) out.missing.push('any listed sights');
  }
  console.log(`   ${(out.transit || []).length} public transport lines${(out.transit || []).length ? ' (' + [...new Set(out.transit.map(l => l.mode))].join(', ') + ')' : ''}`);
  console.log(`   ${Object.keys(out.sites).length} sights with facts (${Object.values(out.sites).filter(x => x.hours).length} with map hours), ${Object.keys(out.towns).length} towns, ${out.dayTrips.length} day-trip links, ${out.ports.length} port points${out.missing.length ? ', missing: ' + out.missing.join(', ') : ''}`);
  Object.entries(out.towns).forEach(([k, v]) => console.log(`   town ${v.name}: ${v.editions} editions, UNESCO ${v.unesco}, listed as day trip ${v.dayTripListed}, ${v.sights.length} sights, ${v.foodDrink.length} food & drink`));
  out.ports.slice(0, 4).forEach(p => console.log(`   port ${p.name} (${p.kind}${p.cruise ? ', cruise' : ''}) ${p.d} km`));
  return out;
}

(async () => {
  const targets = new Map();
  for (const f of fs.existsSync(SNAP) ? fs.readdirSync(SNAP).filter(f => f.endsWith('.json')) : []) {
    const s = JSON.parse(fs.readFileSync(path.join(SNAP, f)));
    for (const [key, c] of Object.entries(s.cities || {})) {
      const pts = (c.sites || []).filter(x => isFinite(x.lat)); if (targets.has(key)) continue;
      const centre = pts.length ? { lat: pts.reduce((a, x) => a + x.lat, 0) / pts.length, lng: pts.reduce((a, x) => a + x.lng, 0) / pts.length } : null;
      const portDay = (s.days || []).find(d => d.city === key && d.type === 'port' && d.point);
      targets.set(key, { key, name: c.name, centre, sites: c.sites || [], farther: (c.farther || []).map(x => Object.assign({}, x)),
        port: portDay ? { name: portDay.point.name, lat: portDay.point.lat, lng: portDay.point.lng, known: !portDay.point.unknown } : null });
    }
  }
  if (fs.existsSync(TARGETS)) for (const t of JSON.parse(fs.readFileSync(TARGETS)).places || []) {
    if (targets.has(t.key)) { if (t.island) targets.get(t.key).island = true; continue; }
    if (t.name && process.env.PLACES_EXTRA) targets.set(t.key, Object.assign({ sites: [], farther: [], centre: null }, t, { port: t.port ? { name: t.port, known: false } : null }));
  }
  // Places already saved are targets too (a quick refresh needs only their centre).
  for (const f of fs.readdirSync(OUT).filter(f => f.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(OUT, f)));
    if (!targets.has(p.key) && p.centre) targets.set(p.key, { key: p.key, name: p.name, centre: p.centre, sites: [], farther: [], port: p.portQuery || null, island: !!(p.portQuery && p.portQuery.island), saved: true, hasPorts: (p.ports || []).some(x => x.cruise) }); }
  const only = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null;
  for (const t of targets.values()) {
    if (only && !only.test(t.key)) continue;
    // REFRESH=transit,ports (TRANSIT_ONLY=1 means transit): refresh just those parts of each saved place, quickly.
    const refresh = (process.env.REFRESH || (process.env.TRANSIT_ONLY ? 'transit' : '')).split(',').filter(Boolean);
    if (refresh.length) {
      let centre = t.centre; if (!centre) { const f = await findQ(baseName(t.name), null, 1e9); if (f) centre = f.c; } if (!centre) continue;
      console.log(`\n== ${t.key} (${t.name})`);
      const fresh = { key: t.key, name: t.name, centre };
      if (refresh.includes('transit')) {
        const spread = Math.max(3, ...t.sites.filter(s => isFinite(s.lat)).map(s => hav(centre, s)));
        fresh.transit = await transitLines(centre, Math.min(25, spread + 2));
        console.log(`   ${fresh.transit.length} public transport lines${fresh.transit.length ? ' (' + [...new Set(fresh.transit.map(l => l.mode))].join(', ') + ')' : ''}`);
      }
      if (refresh.includes('see')) { fresh.guideSights = await guideSights(baseName(t.name), centre); console.log(`   ${fresh.guideSights.length} sights from the travel guide`); }
      if (refresh.includes('hours') && fs.existsSync(path.join(OUT, t.key.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.json'))) {
        const saved = JSON.parse(fs.readFileSync(path.join(OUT, t.key.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.json'))).sites || {};
        const es = await entities([...new Set(Object.values(saved).map(x => x.wikidata).filter(Boolean))]);
        const mf = await mapFacts(Object.entries(saved).map(([id, x]) => { const c = coord(es[x.wikidata]); return { id, q: x.wikidata, lat: c && c.lat, lng: c && c.lng }; }));
        fresh.sites = {}; for (const [id, f] of Object.entries(mf)) fresh.sites[id] = Object.assign({}, saved[id], f, saved[id].hours ? { hours: saved[id].hours } : {});
        // Official websites from Wikidata too (the Book tickets link starts there).
        for (const [id, x] of Object.entries(saved)) { const w = officialWeb(es[x.wikidata]); if (w) { fresh.sites[id] = fresh.sites[id] || Object.assign({}, x); fresh.sites[id].web = w; } }
        console.log(`   hours for ${Object.values(fresh.sites).filter(x => x.hours).length} of ${Object.keys(saved).length} sights`);
      }
      if (refresh.includes('lifts')) { fresh.lifts = await liftsNear(centre, 15); console.log(`   ${fresh.lifts.length} cable cars or funiculars`); }
      if (refresh.includes('ports') && t.port && !t.hasPorts) {
        const r = await portPoints(t.port, centre, !!t.island); fresh.ports = r.ports; fresh.missing = r.missing; fresh.portQuery = Object.assign({}, t.port, { island: !!t.island });
        console.log(`   ${r.ports.length} port points${r.missing.length ? ', missing: ' + r.missing.join(', ') : ''}`); r.ports.slice(0, 4).forEach(p => console.log(`   port ${p.name} (${p.kind}${p.cruise ? ', cruise' : ''}) ${p.d} km`));
      }
      const file = t.key.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.json', was = path.join(OUT, file);
      const out = merge(fs.existsSync(was) ? JSON.parse(fs.readFileSync(was)) : { key: t.key, name: t.name, centre, sites: {}, towns: {}, ports: [], dayTrips: [], missing: [] }, fresh);
      const body = JSON.stringify(out, null, 1); fs.writeFileSync(was, body);
      const z = zlib.gzipSync(body).toString('base64');
      console.log('PLACES-BEGIN ' + file); for (let i = 0; i < z.length; i += 4000) console.log('PLACES ' + z.slice(i, i + 4000)); console.log('PLACES-END');
      await sleep(3000); continue;
    }
    let out; try { out = await buildPlace(t); } catch (e) { console.log('   FAILED', e.stack); continue; }
    const file = t.key.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.json', was = path.join(OUT, file);
    if (fs.existsSync(was)) out = merge(JSON.parse(fs.readFileSync(was)), out);   // never lose a fact found before
    const body = JSON.stringify(out, null, 1);
    fs.writeFileSync(path.join(OUT, file), body);
    const z = zlib.gzipSync(body).toString('base64');
    console.log('PLACES-BEGIN ' + file); for (let i = 0; i < z.length; i += 4000) console.log('PLACES ' + z.slice(i, i + 4000)); console.log('PLACES-END');
  }
})();
