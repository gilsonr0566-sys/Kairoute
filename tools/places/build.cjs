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
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const SNAP = process.argv[2] || path.join(__dirname, '..', 'beta2', 'snapshots');
const TARGETS = process.argv[3] || path.join(__dirname, 'targets.json');
const OUT = path.join(__dirname, 'data'); fs.mkdirSync(OUT, { recursive: true });
const UA = 'KairouteBeta/0.1 (trip planner test build; places facts)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, opt = {}, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 60000);
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
async function findQ(name, near, km) {
  const j = await get(`${WD}&action=wbsearchentities&language=en&type=item&limit=7&search=${encodeURIComponent(name)}`);
  const hits = ((j && j.search) || []).map(x => x.id); if (!hits.length) return null;
  const es = await entities(hits); let best = null;
  for (const q of hits) { const c = coord(es[q]); if (!c) continue; const d = near ? hav(near, c) : 0; if (d <= km && (!best || d < best.d)) best = { q, d, c }; }
  return best;
}
async function whsNear(p, km) {
  const q = `SELECT ?w ?wLabel WHERE { SERVICE wikibase:around { ?w wdt:P625 ?loc. bd:serviceParam wikibase:center "Point(${p.lng} ${p.lat})"^^geo:wktLiteral. bd:serviceParam wikibase:radius "${km}". } ?w wdt:P1435 wd:${WHS}. SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`;
  const j = await get('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } });
  return ((j && j.results && j.results.bindings) || []).map(b => ({ q: b.w.value.split('/').pop(), name: b.wLabel && b.wLabel.value }));
}

// ---- OpenStreetMap
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
async function overpass(ql) {
  for (const u of OVERPASS) { const j = await get(u, { method: 'POST', body: 'data=' + encodeURIComponent(ql), headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' } }, 2); if (j) return j.elements || []; }
  return [];
}
const pos = el => el.lat != null ? { lat: el.lat, lng: el.lon } : el.center ? { lat: el.center.lat, lng: el.center.lon } : null;
const CRUISE = /cruise|croisi|crocier|crucer|kreuzfahrt|cruzeir|kruvaz|terminal de passag|passenger terminal|passagier/i;
async function cruisePoints(p, island) {
  const r = island ? 4000 : 12000;
  const els = await overpass(`[out:json][timeout:90];(nwr(around:${r},${p.lat},${p.lng})["amenity"="ferry_terminal"];nwr(around:${r},${p.lat},${p.lng})["name"~"cruise|croisi|crocier|crucer|kreuzfahrt|cruzeir|terminal",i];nwr(around:${r},${p.lat},${p.lng})["man_made"="pier"]["name"];);out tags center;`);
  return els.map(el => { const t = el.tags || {}, q = pos(el); if (!q) return null; const name = t['name:en'] || t.name || '';
    const cruise = CRUISE.test(name) || /cruise/i.test(t.ferry || '') || t.cruise === 'yes';
    return { name, lat: +q.lat.toFixed(5), lng: +q.lng.toFixed(5), osm: el.type + '/' + el.id, kind: t.amenity === 'ferry_terminal' ? 'ferry terminal' : t.man_made === 'pier' ? 'pier' : 'terminal', cruise, d: +hav(p, q).toFixed(2) };
  }).filter(x => x && x.name).sort((a, b) => (b.cruise - a.cruise) || a.d - b.d).slice(0, 12);
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
    const lat = parseFloat(f.lat), lng = parseFloat(f.long || f.lon || f.lng); if (!f.name || !isFinite(lat) || !isFinite(lng)) continue;
    out.push({ kind, name: f.name.replace(/\[\[|\]\]|'''?/g, ''), lat, lng, hours: f.hours || '', price: f.price || '', wikidata: f.wikidata || '', content: (f.content || '').replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').slice(0, 240) });
  }
  return out;
}

async function buildPlace(t) {
  console.log(`\n== ${t.key} (${t.name})`);
  const out = { key: t.key, name: t.name, built: new Date().toISOString().slice(0, 10), sources: ['Wikidata', 'OpenStreetMap', 'Wikivoyage'], sites: {}, towns: {}, ports: [], dayTrips: [], missing: [] };
  // Centre: the guide's sights, else the place found by name.
  let centre = t.centre;
  if (!centre) { const f = await findQ(baseName(t.name), null, 1e9); if (f) centre = f.c; }
  if (!centre) { out.missing.push('where this place is'); return out; }
  out.centre = centre;
  // 1. Wikidata facts for every sight that names its item, and for the towns a day away (found by name near them).
  const qs = [...new Set(t.sites.map(s => qOf(s.id)).filter(Boolean))];
  for (const s of t.farther) { const f = await findQ(s.name, s, 15); if (f) s.q = f.q; await sleep(200); }
  const all = await entities([...new Set(qs.concat(t.farther.map(s => s.q).filter(Boolean)))]);
  const parts = new Set(); Object.values(all).forEach(e => ids(e, 'P361').forEach(q => parts.add(q)));
  const partE = parts.size ? await entities([...parts]) : {};
  const fact = e => ({ wikidata: e.id, editions: Object.keys(e.sitelinks || {}).length, types: ids(e, 'P31'),
    unesco: ids(e, 'P1435').includes(WHS) || ids(e, 'P361').some(q => ids(partE[q], 'P1435').includes(WHS)),
    closedForGood: claim(e, 'P576').length > 0 || claim(e, 'P3999').length > 0, partOf: ids(e, 'P361') });
  for (const s of t.sites) { const q = qOf(s.id); if (q && all[q]) out.sites[s.id] = fact(all[q]); }
  // 2. OpenStreetMap hours and fees, matched by the Wikidata tag mappers put on the map.
  const wq = qs.concat(t.farther.map(s => s.q).filter(Boolean));
  if (wq.length) {
    const els = await overpass(`[out:json][timeout:120];nwr["wikidata"~"^(${wq.join('|')})$"];out tags center;`);
    for (const el of els) { const tg = el.tags || {}; const id = t.sites.find(s => qOf(s.id) === tg.wikidata); if (!id) continue;
      const f = out.sites[id.id] = out.sites[id.id] || {}; if (tg.opening_hours && !f.hours) f.hours = tg.opening_hours; if (tg.fee) f.fee = tg.fee; f.osm = el.type + '/' + el.id; }
  }
  // 3. Towns a day away: Wikidata fame and UNESCO, Wikivoyage listing as a day trip, and their own sights and food & drink.
  const host = await wvText(baseName(t.name)); await sleep(300);
  if (host) { const goNext = links(section(host.text, /^(go next|day trips?|nearby|around)/i)); out.dayTrips = [...new Set(goNext)].slice(0, 40); out.wikivoyage = host.title; }
  else out.missing.push('travel guide page');
  for (const s of t.farther) {
    const e = s.q && all[s.q], town = { name: s.name, wikidata: s.q || null, editions: e ? Object.keys(e.sitelinks || {}).length : 0, unesco: false, dayTripListed: false, sights: [], foodDrink: [] };
    town.dayTripListed = out.dayTrips.some(x => baseName(x).toLowerCase() === baseName(s.name).toLowerCase());
    const w = await whsNear(s, 3); town.unesco = w.length > 0; if (w.length) town.unescoSites = w.map(x => x.name); await sleep(300);
    const page = await wvText(baseName(s.name)); await sleep(300);
    if (page) for (const l of listings(page.text)) { if (hav(s, l) > 20) continue; (l.kind === 'see' || l.kind === 'do' ? town.sights : town.foodDrink).push(l); }
    out.towns[s.id] = town;
  }
  // 4. Ports: the real cruise terminals or piers near where the ship docks.
  if (t.port) {
    let p = t.port.known ? t.port : null;
    if (!p) { const f = await findQ(baseName(t.port.name), centre, 400); if (f) p = f.c; }
    if (p) out.ports = await cruisePoints(p, !!t.island); else out.missing.push('the port town');
    if (!out.ports.some(x => x.cruise)) out.missing.push('a mapped cruise terminal or pier');
  }
  // 5. A place with no guide at all (a private island): its own sights from the travel guide and the map.
  if (!t.sites.length) {
    const page = await wvText(baseName(t.name)); await sleep(300);
    if (page) out.guideSights = listings(page.text).filter(l => hav(centre, l) < 10);
    const els = await overpass(`[out:json][timeout:90];(nwr(around:3000,${centre.lat},${centre.lng})["tourism"~"attraction|viewpoint|museum"];nwr(around:3000,${centre.lat},${centre.lng})["leisure"~"beach_resort|water_park|park|nature_reserve"]["name"];nwr(around:3000,${centre.lat},${centre.lng})["natural"="beach"]["name"];nwr(around:3000,${centre.lat},${centre.lng})["amenity"~"restaurant|cafe|bar|ice_cream"]["name"];);out tags center;`);
    out.mapPlaces = els.map(el => { const q = pos(el), tg = el.tags || {}; return q && { name: tg['name:en'] || tg.name, lat: q.lat, lng: q.lng, kind: tg.tourism || tg.leisure || tg.natural || tg.amenity, hours: tg.opening_hours || '', osm: el.type + '/' + el.id }; }).filter(x => x && x.name);
    if (!(out.guideSights || []).length && !out.mapPlaces.length) out.missing.push('any listed sights');
  }
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
  const only = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null;
  for (const t of targets.values()) {
    if (only && !only.test(t.key)) continue;
    let out; try { out = await buildPlace(t); } catch (e) { console.log('   FAILED', e.stack); continue; }
    const file = t.key.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.json', body = JSON.stringify(out, null, 1);
    fs.writeFileSync(path.join(OUT, file), body);
    const z = zlib.gzipSync(body).toString('base64');
    console.log('PLACES-BEGIN ' + file); for (let i = 0; i < z.length; i += 4000) console.log('PLACES ' + z.slice(i, i + 4000)); console.log('PLACES-END');
  }
})();
