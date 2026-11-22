// Sight audit (Nov 22 2026, thread "Check every sight's facts and position"). For each test place, the Beta 2 app is
// run as a traveler would (AI off, the live helper's free lookups only), and every sight it offers (the guide's own and
// what the places files add in the engine) is checked against outside sources the app did NOT use for that fact:
//   POS   where the app puts it vs where OpenStreetMap maps the same Wikidata item (and Wikidata's own point)
//   NAME  shown in another script, or a local-language name where Wikidata has an English one
//   DUP   one place offered twice (same Wikidata id, or the same name a short walk apart)
//   NOT   not a place a visitor goes (a person, company, street, station, school...), closed or demolished
//   NOID  a sight no outside source can find (no Wikidata id and nothing of that name on the map nearby)
//   FOLD  a sight inside a bigger sight on the list (Wikidata "part of", or inside its mapped grounds) still a stop of its own
//   LEN   a visit length out of the usual range for that kind of place
//   FAME  a well-known sight (Wikipedia languages, UNESCO, the checked must-see list) missing, or not marked must-see
//   TRIP  an expected day trip missing (Lübeck from Hamburg)
// Runs on GitHub (sight-audit.yml): the container has no way to Wikidata or the map. Usage:
//   node tools/beta2/sight-audit.cjs dump [index.html]   (browser: writes tools/beta2/sight-audit/<name>.dump.json)
//   node tools/beta2/sight-audit.cjs audit               (network: reads the dumps, writes <name>.audit.json + report.md)
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, 'sight-audit'); fs.mkdirSync(DIR, { recursive: true });
const ROOT = path.join(__dirname, '..', '..');
const PLACES = [
  // The 20-city yardstick
  ['istanbul', 'Istanbul, Turkey', 'stay'], ['vienna', 'Vienna, Austria', 'stay'], ['lisbon', 'Lisbon, Portugal', 'stay'], ['barcelona', 'Barcelona, Spain', 'port'],
  ['edinburgh', 'Edinburgh, Scotland', 'stay'], ['kyoto', 'Kyoto, Japan', 'stay'], ['lehavre', 'Le Havre (Paris), France', 'port'], ['southampton', 'Southampton, England', 'stay'],
  ['kotor', 'Kotor, Montenegro', 'port'], ['dubrovnik', 'Dubrovnik, Croatia', 'port'], ['juneau', 'Juneau, Alaska', 'port'], ['ketchikan', 'Ketchikan, Alaska', 'port'],
  ['grandturk', 'Grand Turk, Turks and Caicos', 'port'], ['mykonos', 'Mykonos, Greece', 'port'], ['pontadelgada', 'Ponta Delgada, Azores', 'port'], ['halfmooncay', 'Half Moon Cay, Bahamas', 'port'],
  ['haifa', 'Haifa (Jerusalem), Israel', 'port'], ['reykjavik', 'Reykjavik, Iceland', 'stay'], ['venice', 'Venice, Italy', 'stay'], ['dubai', 'Dubai, UAE', 'stay'],
  // The Greece trip's places (built-in guides plus their sources)
  ['athens', 'Athens', 'stay'], ['santorini', 'Santorini', 'port'], ['heraklion', 'Heraklion', 'port'], ['chania', 'Chania', 'port'], ['kusadasi', 'Kusadasi', 'port'],
  ['messina', 'Messina', 'port'], ['naples', 'Naples', 'port'], ['rome', 'Rome', 'port'], ['madrid', 'Madrid', 'stay'],
  // The Bahamas field test, and Hamburg (Lübeck must come up as a day trip)
  ['nassau', 'Nassau, Bahamas', 'port'], ['cococay', 'Perfect Day at CocoCay, Bahamas', 'port'], ['hamburg', 'Hamburg, Germany', 'stay'],
];
const BATCHES = 8, batchOf = i => i % BATCHES;
const only = () => PLACES.filter((p, i) => (!process.env.ONLY || process.env.ONLY.split(',').includes(p[0])) && (process.env.BATCH == null || String(batchOf(i)) === process.env.BATCH));
const hav = (a, b) => { const R = 6371, t = x => x * Math.PI / 180, dl = t(b.lat - a.lat), dg = t(b.lng - a.lng); const h = Math.sin(dl / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dg / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const fold = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// ------------------------------------------------------------------ dump (browser) ------------------------------------------------------------------
async function dump() {
  const { chromium } = require('playwright');
  const FILE = path.resolve(process.argv[3] || path.join(ROOT, 'beta2-site', 'index.html'));
  const AIJ = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'ai.json'), 'utf8')).url || ''; } catch (e) { return ''; } })();
  const REAL = /^http:\/\/localhost:\d+\/workers\.dev$/.test(AIJ) ? AIJ : 'https://kairoute-ai.rickgilson.workers.dev', MOCK = 'https://mock.test';
  const PASS = new Set(['/sources', '/famous', '/ground', '/places', '/transit', '/route', '/departures', '/ferries', '/weather', '/facts', '/osm', '/findplace', '/nearsights', '/verify', '/bookcheck', '/voyage']);
  const helper = async r => {
    const req = r.request(), u = new URL(req.url());
    if (u.pathname === '/status') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, on: false, left: 0, budget: 0 }) });
    if (!PASS.has(u.pathname)) return r.fulfill({ status: 429, body: '{"error":"off in this test"}' });
    for (let i = 0; i < 3; i++) {
      try { const res = await fetch(REAL + u.pathname + u.search, { method: req.method(), headers: { 'content-type': 'application/json', origin: 'https://gilsonr0566-sys.github.io' }, body: req.method() === 'POST' ? req.postData() : undefined, signal: AbortSignal.timeout(150000) });
        const body = await res.text(); if (res.ok || res.status < 500) return r.fulfill({ status: res.status, contentType: 'application/json', body }); } catch (e) { console.log('helper', u.pathname, e.message); }
      await new Promise(x => setTimeout(x, 3000));
    }
    return r.fulfill({ status: 502, body: '{}' });
  };
  const prefs = { pace: 'moderate', walk: 'medium', interests: [], travelers: '', access: 'none', party: 2, lang: 'English' };
  const b = await chromium.launch();
  for (const [name, label, kind] of only()) {
    const days = kind === 'port'
      ? [{ id: 'd1', date: '2027-06-08', destination: 'At sea', type: 'sea' }, { id: 'd2', date: '2027-06-09', destination: label, type: 'port', portArrive: '08:00', allAboard: '18:00', time: '08:00', startTime: '08:00', hours: 10, pointIdx: 0, alongWay: true, returnToStart: true, selected: null, mode: 'flight' }]
      : ['2027-06-08', '2027-06-09', '2027-06-10'].map((date, i) => ({ id: 'd' + (i + 1), date, destination: label, type: 'land', mode: 'flight', time: '09:00', pointIdx: 0, startTime: '09:00', hours: 8, alongWay: true, returnToStart: true, selected: null }));
    const first = days.findIndex(d => d.type !== 'sea');
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    await p.route('**/*', r => { const u = r.request().url(); if (u.startsWith(MOCK)) return helper(r); return /^file:/.test(u) ? r.continue() : r.abort(); });
    await p.goto('file://' + FILE);
    await p.evaluate(([days, prefs, a]) => { localStorage.setItem('kairoute.intro1', '1'); localStorage.setItem('wayside.trip2', JSON.stringify({ id: 't-audit', name: 'Audit', style: 'mix', active: a, lodging: {}, journal: {}, prefs, days })); }, [days, prefs, first]);
    await p.reload(); await p.waitForTimeout(500);
    await p.evaluate(m => window.__kairouteMockHelper(m, null, true), MOCK);
    await p.evaluate(i => window.__kairouteAt(i, 'plan'), first); await p.waitForTimeout(300);
    const btn = p.locator('[data-act="gen"]').first();
    if (await btn.isVisible().catch(() => false)) await btn.click();
    await p.waitForFunction(i => { const s = window.__kairouteState(); return !s.busy && !!window.__kairouteCityOf(i); }, first, { timeout: 480000 }).catch(() => console.log('  (timed out waiting for the guide)'));
    // Sources and the day trips arrive after the guide: give them time, then look at the Sights list once (it grows the list).
    await p.waitForTimeout(20000);
    await p.evaluate(i => window.__kairouteAt(i, 'sites'), first).catch(() => {}); await p.waitForTimeout(15000);
    const out = await p.evaluate(i => {
      const c = window.__kairouteCityOf(i); if (!c) return null;
      const pick = (s, far) => ({ id: s.id, name: s.name, local: s.local || s.srcName || '', lat: s.lat, lng: s.lng, minutes: s.minutes, baseMin: s.baseMin, category: s.category || '', kind: s.kind || '', quick: !!s.quick, mustSee: !!s.mustSee,
        fame: s.fame || 0, unesco: !!s.unesco, heritage: !!s.heritage, wd: s.wd || '', src: s.src || [], srcOnly: !!s.srcOnly, builtin: !s.srcOnly && !s.noAI && !s.famousFix, famousFix: !!s.famousFix, far: !!far, travel: typeof s.travel === 'string' ? s.travel : '',
        parts: (s.parts || []).map(x => x.name), merged: (s.merged || []).map(x => x.name || x), posDoubt: !!s.posDoubt, summary: String(s.summary || '').slice(0, 160) });
      return { city: c.city, builtin: !!c.builtin, srcGuide: !!c.srcGuide, sites: (c.sites || []).map(s => pick(s, false)), farther: (c.farther || []).map(s => pick(s, true)) };
    }, first);
    const bucket = await p.evaluate(() => window.__kairouteBucket(false)).catch(() => null);
    const src = await p.evaluate(() => { try { return typeof sourcesCache !== 'undefined' ? Object.keys(sourcesCache) : null; } catch (e) { return null; } }).catch(() => null);
    fs.writeFileSync(path.join(DIR, name + '.dump.json'), JSON.stringify({ name, label, kind, at: new Date().toISOString(), guide: out, bucket, src }));
    console.log(`${name}: ${out ? out.sites.length + ' sights, ' + out.farther.length + ' farther (' + out.city + ')' : 'NO GUIDE'}`);
    await p.close();
  }
  await b.close();
}

// ------------------------------------------------------------------ audit (network) ------------------------------------------------------------------
const UA = { 'user-agent': 'KairouteAudit/1.0 (test run; https://github.com/gilsonr0566-sys/kairoute)' };
async function getJ(u, opt, tries = 3) {
  for (let t = 0; t < tries; t++) {
    try { const r = await fetch(u, Object.assign({ headers: { ...UA, accept: 'application/json' }, signal: AbortSignal.timeout(60000) }, opt || {})); if (r.ok) return await r.json(); if (r.status === 429 || r.status >= 500) await new Promise(x => setTimeout(x, 5000 * (t + 1))); else return null; } catch (e) { await new Promise(x => setTimeout(x, 3000)); }
  }
  return null;
}
const sparql = q => getJ('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: { ...UA, accept: 'application/sparql-results+json' } });
async function entities(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 45) {
    const j = await getJ('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|labels|sitelinks|descriptions&languages=en&ids=' + ids.slice(i, i + 45).join('|'));
    Object.assign(out, (j && j.entities) || {});
  }
  return out;
}
const claimIds = (e, p) => ((e && e.claims && e.claims[p]) || []).map(c => c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value && c.mainsnak.datavalue.value.id).filter(Boolean);
const claimPt = e => { const c = e && e.claims && e.claims.P625 && e.claims.P625[0]; const v = c && c.mainsnak.datavalue && c.mainsnak.datavalue.value; return v ? { lat: v.latitude, lng: v.longitude } : null; };
async function overpass(q) {
  for (const ep of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']) {
    const j = await getJ(ep, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { ...UA, 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' } }, 2);
    if (j) return j;
  }
  return null;
}
// Kinds that are never a visit (Wikidata P31), and kinds that set a usual visit length. Classes are matched through
// "subclass of" once per run (one query), so a "Catholic cathedral" counts as a church.
const NOT_VISIT = { Q5: 'a person', Q4830453: 'a business', Q783794: 'a company', Q43229: 'an organization', Q327333: 'a government agency', Q27686: 'a hotel', Q79007: 'a street', Q34442: 'a road',
  Q3918: 'a university', Q3914: 'a school', Q16917: 'a hospital', Q55488: 'a railway station', Q719456: 'a station', Q1248784: 'an airport', Q3917681: 'an embassy', Q22687: 'a bank', Q1021645: 'an office building',
  Q11755880: 'a residential building', Q123705: 'a neighbourhood', Q1656682: 'an event', Q13406463: 'a list', Q4167410: 'a disambiguation page', Q11424: 'a film', Q7725634: 'a book', Q215380: 'a music group',
  Q847017: 'a sports club', Q476028: 'a football club', Q18127: 'a record label', Q41298: 'a magazine', Q11032: 'a newspaper', Q1137809: 'a courthouse', Q1802963: 'a mansion (private)', Q15243209: 'a historic district', Q1549591: 'a big city', Q515: 'a city', Q3957: 'a town', Q486972: 'a settlement' };
const LEN = [ // [class ids, label, min, max] first match wins (most specific first)
  [['Q207694', 'Q17431399', 'Q2668072'], 'art museum or gallery', 45, 240], [['Q33506'], 'museum', 30, 180],
  [['Q2977', 'Q163687', 'Q56242215'], 'cathedral or basilica', 20, 90], [['Q16970', 'Q32815', 'Q34627', 'Q44539', 'Q108325', 'Q44613'], 'church, mosque, synagogue, temple, chapel or monastery', 10, 90],
  [['Q839954', 'Q15661340', 'Q1497364'], 'archaeological site or ancient city', 40, 240], [['Q23413', 'Q57821', 'Q57831', 'Q1785071', 'Q91122'], 'castle or fortress', 45, 180],
  [['Q16560', 'Q751876'], 'palace', 30, 180], [['Q22698', 'Q1107656', 'Q167346'], 'park or garden', 20, 180], [['Q174782', 'Q1371849'], 'square', 5, 30],
  [['Q483453', 'Q179700', 'Q4989906', 'Q575759'], 'fountain, statue or monument', 5, 30], [['Q12280'], 'bridge', 5, 30], [['Q12518'], 'tower', 15, 90],
  [['Q43501', 'Q2281788'], 'zoo or aquarium', 90, 240], [['Q330284', 'Q37654'], 'market', 20, 90], [['Q40080'], 'beach', 60, 300], [['Q24354'], 'theatre', 10, 120],
];
// The checked must-see list (by hand, Nov 20): test expectations only, never read by the app.
const EXPECT = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'fame-expect.json'), 'utf8')).places; } catch (e) { return []; } })();
const EXPECT_MORE = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'sight-expect.json'), 'utf8')).places; } catch (e) { return []; } })();
async function classMap(classes) {
  // Every class a sight is an instance of, with which of our classes it falls under (subclass of, transitively).
  const want = [...new Set([...Object.keys(NOT_VISIT), ...LEN.flatMap(x => x[0])])];
  const out = {};
  for (let i = 0; i < classes.length; i += 80) {
    const part = classes.slice(i, i + 80);
    const j = await sparql(`SELECT ?c ?w WHERE { VALUES ?c { ${part.map(x => 'wd:' + x).join(' ')} } VALUES ?w { ${want.map(x => 'wd:' + x).join(' ')} } ?c wdt:P279* ?w }`);
    for (const b of (j && j.results && j.results.bindings) || []) { const c = b.c.value.split('/').pop(), w = b.w.value.split('/').pop(); (out[c] = out[c] || new Set()).add(w); }
  }
  return out;
}
async function audit() {
  const places = {}; for (const f of fs.readdirSync(path.join(ROOT, 'tools', 'places', 'data'))) { const P = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'places', 'data', f))); if (P.key) places[P.key] = P; }
  let E = null; try { E = require('./engine.cjs'); } catch (e) { console.log('engine not loaded', e.message); }
  const report = [];
  for (const [name, label] of only()) {
    const fp = path.join(DIR, name + '.dump.json'); if (!fs.existsSync(fp)) { report.push(`## ${label}\nNo dump.\n`); continue; }
    const D = JSON.parse(fs.readFileSync(fp)); const F = [];
    if (!D.guide) { report.push(`## ${label}\nNO GUIDE: the app built no sights list.\n`); continue; }
    // What the engine plans with: the guide plus the places files (thin guides get the travel guide's sights).
    let sights = D.guide.sites.concat(D.guide.farther);
    if (E && D.bucket) { try { const b2 = E.applyPlaces(D.bucket, places); for (const c of Object.values(b2.cities || {})) for (const s of (c.sites || []).concat(c.farther || [])) if (!sights.some(x => x.id === s.id)) sights.push({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, minutes: s.minutes, category: s.category || '', far: !!s.far, fromPlaces: true, wd: String(s.id).replace(/^.*~/, '').match(/^Q\d+$/) ? String(s.id).replace(/^.*~/, '') : '', fame: s.fame || s.editions || 0, mustSee: !!s.mustSee, posDoubt: !!s.posDoubt, town: s.townName || '' }); } catch (e) { F.push(['ERR', 'places fold failed: ' + e.message]); } }
    const main = sights.filter(s => !s.far), pts = main.filter(s => isFinite(s.lat));
    const centre = pts.length ? { lat: pts.map(s => s.lat).sort((a, b) => a - b)[pts.length >> 1], lng: pts.map(s => s.lng).sort((a, b) => a - b)[pts.length >> 1] } : null;
    // A sight with no Wikidata id (a built-in guide's own): found by name on Wikidata near the city, so its facts and
    // position can still be checked (marked as matched by name).
    for (const s of sights) if (!/^Q\d+$/.test(s.wd || '') && isFinite(s.lat) && centre) {
      const q = String(s.name).replace(/\s*\(.*?\)\s*/g, ' ').split(/\s+(?:and|&)\s+/)[0].trim();
      const j = await getJ('https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&limit=7&search=' + encodeURIComponent(q));
      const cand = ((j && j.search) || []).map(x => x.id); if (!cand.length) continue;
      const ce = await entities(cand);
      const near = cand.map(id => ce[id]).filter(e => e && claimPt(e) && hav(claimPt(e), s.far ? s : centre) <= (s.far ? 8 : 20));
      if (near.length) { s.wd = near[0].id; s.wdByName = true; }
      await new Promise(x => setTimeout(x, 300));
    }
    const ids = [...new Set(sights.map(s => s.wd).filter(x => /^Q\d+$/.test(x)))];
    const ent = await entities(ids);
    const cls = await classMap([...new Set(Object.values(ent).flatMap(e => claimIds(e, 'P31')))]);
    const under = (e, set) => claimIds(e, 'P31').some(c => (cls[c] ? [...cls[c]] : []).concat([c]).some(w => set.includes(w)));
    // OpenStreetMap: every mapped object carrying one of these Wikidata ids, with its centre and bounds.
    const osm = {};
    if (ids.length && centre) {
      for (let i = 0; i < ids.length; i += 60) {
        const j = await overpass(`[out:json][timeout:90];nwr["wikidata"~"^(${ids.slice(i, i + 60).join('|')})$"](around:60000,${centre.lat},${centre.lng});out center bb tags;`);
        for (const e of (j && j.elements) || []) { const q = e.tags && e.tags.wikidata; if (!q) continue; const c = e.center || (e.lat != null ? { lat: e.lat, lon: e.lon } : null); if (!c) continue;
          const bb = e.bounds ? { s: e.bounds.minlat, n: e.bounds.maxlat, w: e.bounds.minlon, e: e.bounds.maxlon } : null;
          const size = bb ? hav({ lat: bb.s, lng: bb.w }, { lat: bb.n, lng: bb.e }) : 0;
          // Keep the biggest mapped object for an id (the site's grounds, not a gate of it).
          if (!osm[q] || size > osm[q].size) osm[q] = { lat: c.lat, lng: c.lon, bb, size, type: e.type + '/' + e.id, tags: { tourism: e.tags.tourism, historic: e.tags.historic, amenity: e.tags.amenity, leisure: e.tags.leisure, building: e.tags.building, name: e.tags['name:en'] || e.tags.name } }; }
        await new Promise(x => setTimeout(x, 2000));
      }
    }
    // Sights with no Wikidata id: is there anything of that name on the map near where the app puts it?
    const noId = sights.filter(s => !/^Q\d+$/.test(s.wd || '') && isFinite(s.lat));
    const nameHit = {};
    for (const s of noId.slice(0, 40)) {
      const words = fold(s.name).split(' ').filter(w => w.length >= 4 && !/^(church|museum|palace|castle|square|park|garden|beach|tower|house|street|old|town|the)$/.test(w));
      if (!words.length) continue;
      const j = await overpass(`[out:json][timeout:40];nwr["name"~"${words.slice(0, 2).map(w => w.replace(/[^a-z0-9]/g, '')).join('.*')}",i](around:5000,${s.lat},${s.lng});out center 5;`);
      const hits = ((j && j.elements) || []).map(e => ({ name: e.tags && (e.tags['name:en'] || e.tags.name), lat: (e.center || e).lat, lng: (e.center || e).lon, wd: e.tags && e.tags.wikidata })).filter(h => isFinite(h.lat));
      nameHit[s.id] = hits.sort((a, b) => hav(a, s) - hav(b, s))[0] || null;
      await new Promise(x => setTimeout(x, 1200));
    }
    for (const s of sights) {
      const e = s.wd ? ent[s.wd] : null, o = s.wd ? osm[s.wd] : null, wp = claimPt(e), tag = `${s.name}${s.far ? ' [day trip]' : ''}${s.fromPlaces ? ' [places file]' : ''}${s.wdByName ? ' {' + s.wd + ' by name}' : ''}`;
      // POS: the app's point against the map's object for the same item (its size allowed for), and Wikidata's point.
      if (isFinite(s.lat)) {
        if (o) { const d = hav(s, o), allow = Math.max(0.25, o.size / 2);
          if (d > allow) F.push(['POS', `${tag}: app ${s.lat.toFixed(5)},${s.lng.toFixed(5)} is ${d.toFixed(2)} km from the map's ${o.tags.name || ''} (${o.type}, ${o.lat.toFixed(5)},${o.lng.toFixed(5)})${wp ? `; Wikidata ${hav(wp, o).toFixed(2)} km from the map` : ''}${s.posDoubt ? ' (app says not sure)' : ''}`, { d, id: s.id, wd: s.wd, app: [s.lat, s.lng], map: [o.lat, o.lng], wdpt: wp && [wp.lat, wp.lng] }]); }
        else if (wp && hav(s, wp) > 0.3) F.push(['POS', `${tag}: app is ${hav(s, wp).toFixed(2)} km from Wikidata's point (not on the map by id)`, { d: hav(s, wp), id: s.id, wd: s.wd, app: [s.lat, s.lng], wdpt: [wp.lat, wp.lng] }]);
        else if (!s.wd && nameHit[s.id] && hav(s, nameHit[s.id]) > 0.4) F.push(['POS?', `${tag}: no id; the nearest "${nameHit[s.id].name}" on the map is ${hav(s, nameHit[s.id]).toFixed(2)} km away`, { id: s.id }]);
        if (centre && !s.far && hav(s, centre) > 15) F.push(['POS', `${tag}: ${hav(s, centre).toFixed(1)} km from the city's sights but not a day trip`, { id: s.id }]);
      } else F.push(['POS', `${tag}: no position at all`, { id: s.id }]);
      // NAME
      if (/^(the )?(museum|ancient theat(er|re)|church|castle|fort|tower|park|beach|square|harbou?r|old town|market|cathedral|chapel|palace|stadium|lighthouse|viewpoint)$/i.test(String(s.name).trim())) F.push(['NAME', `${tag}: a bare name that says what, not which one`, { id: s.id }]);
      if (/[^\u0000-ɏḀ-ỿ -⁯₠-⃏\s]/.test(s.name)) F.push(['NAME', `${tag}: not in English letters`, { id: s.id }]);
      const en = e && e.labels && e.labels.en && e.labels.en.value;
      if (en && fold(en) !== fold(s.name) && !fold(s.name).includes(fold(en)) && !fold(en).includes(fold(s.name)) && /\b(palazzo|chiesa|iglesia|igreja|museo|museu|mus[ée]e|kirche|dom|schloss|camii|sarayı|cami|mosquée|église|basilique|praça|plaza|piazza|castello|castillo|torre|ponte|puerta|porta|jardin|giardino|parque|parco|fontana|fuente|palacio|pal[aá]cio|capela|cappella|igrexa|templo|tempio|saray|kule|köprü|kilisesi|mosque|moschee)\b/i.test(s.name)) F.push(['NAME', `${tag}: local name; Wikidata's English name is "${en}"`, { id: s.id, en }]);
      if (s.wd && !e) F.push(['NOID', `${tag}: Wikidata id ${s.wd} not found`, { id: s.id }]);
      // NOT: not a visit, or gone.
      if (e) {
        const kinds = claimIds(e, 'P31').flatMap(c => [c, ...(cls[c] ? [...cls[c]] : [])]).filter(c => NOT_VISIT[c]).map(c => NOT_VISIT[c]);
        const isSight = under(e, ['Q33506', 'Q16970', 'Q839954', 'Q23413', 'Q16560', 'Q22698', 'Q174782', 'Q4989906', 'Q12280', 'Q12518', 'Q483453', 'Q179700', 'Q40080', 'Q570116', 'Q2319498', 'Q811979']);
        if (kinds.length && !isSight) F.push(['NOT', `${tag}: Wikidata says it is ${[...new Set(kinds)].join(', ')} (${(e.descriptions && e.descriptions.en && e.descriptions.en.value) || ''})`, { id: s.id }]);
        if (claimIds(e, 'P576').length || (e.claims && e.claims.P576) || (e.claims && e.claims.P582 && !e.claims.P580)) F.push(['NOT', `${tag}: Wikidata has an end date (closed, dissolved or demolished)`, { id: s.id }]);
        if (claimIds(e, 'P5817').some(x => ['Q56556915', 'Q30108381', 'Q63065035', 'Q11755959'].includes(x))) F.push(['NOT', `${tag}: Wikidata's state of use says demolished, closed or private`, { id: s.id }]);
      } else if (!s.wd && !nameHit[s.id] && !s.fromPlaces && s.builtin !== true) F.push(['NOID', `${tag}: no Wikidata id and nothing of the name on the map nearby (from ${(s.src || []).join(', ') || 'no source'})`, { id: s.id }]);
      else if (!s.wd && !nameHit[s.id] && s.builtin) F.push(['NOID', `${tag}: built-in sight with no Wikidata id and nothing of the name on the map nearby`, { id: s.id }]);
      // LEN
      if (e && isFinite(s.minutes)) { const k = LEN.find(L => under(e, L[0]));
        if (k && !s.quick && (s.minutes < k[2] || s.minutes > k[3])) F.push(['LEN', `${tag}: ${s.minutes} min, but a ${k[1]} usually takes ${k[2]}-${k[3]} min`, { id: s.id, min: s.minutes, kind: k[1] }]); }
    }
    // DUP
    for (let i = 0; i < sights.length; i++) for (let j = i + 1; j < sights.length; j++) {
      const a = sights[i], b = sights[j]; if (!isFinite(a.lat) || !isFinite(b.lat)) continue;
      if (a.wd && a.wd === b.wd) { F.push(['DUP', `${a.name} = ${b.name} (same Wikidata ${a.wd})`, { a: a.id, b: b.id }]); continue; }
      const fa = fold(a.name), fb = fold(b.name), d = hav(a, b);
      const ta = new Set(fa.split(' ').filter(w => w.length > 3)), tb = new Set(fb.split(' ').filter(w => w.length > 3)), shared = [...ta].filter(w => tb.has(w)).length;
      if (d < 0.25 && (fa === fb || (shared >= 1 && shared >= Math.min(ta.size, tb.size) && Math.min(ta.size, tb.size) > 0))) F.push(['DUP', `${a.name} ~ ${b.name} (${Math.round(d * 1000)} m apart, same words)`, { a: a.id, b: b.id }]);
      else if (o_same(a, b, osm) && d < 0.4) F.push(['DUP', `${a.name} ~ ${b.name} (the map draws them as one object)`, { a: a.id, b: b.id }]);
    }
    // FOLD: part of another sight on the list (Wikidata), or inside its mapped grounds, yet a stop of its own.
    let groups = null; if (E && E.makeGroups) try { groups = E.makeGroups(sights.filter(s => isFinite(s.lat)).map(s => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, category: s.category, far: s.far, in: [] }))); } catch (e) {}
    const byWd = new Map(sights.filter(s => s.wd).map(s => [s.wd, s]));
    for (const s of sights) {
      const e = s.wd && ent[s.wd]; if (!e || s.far) continue;
      const parents = claimIds(e, 'P361').concat(claimIds(e, 'P276')).map(q => byWd.get(q)).filter(p => p && p !== s);
      for (const p of parents) if (!(p.parts || []).some(n => fold(n) === fold(s.name)) && !(groups && groups.groupOf && groups.groupOf.get(String(s.id)) === String(p.id)))
        F.push(['FOLD', `${s.name} is part of ${p.name} (Wikidata) but is a separate stop`, { id: s.id, of: p.id }]);
      if (!parents.length && isFinite(s.lat)) for (const p of sights) {
        const po = p.wd && osm[p.wd]; if (p === s || p.far || !po || !po.bb || po.size < 0.12 || po.size > 3) continue;
        const so = osm[s.wd]; if (so && so.size >= po.size) continue;
        const inBox = s.lat >= po.bb.s && s.lat <= po.bb.n && s.lng >= po.bb.w && s.lng <= po.bb.e;
        const grounds = /castle|fort|citadel|archaeolog|palace|monastery|abbey|acropolis|ruins|kremlin|complex|park|garden|cemetery/i.test((p.category || '') + ' ' + p.name + ' ' + JSON.stringify(po.tags));
        if (inBox && grounds && (s.fame || 0) < (p.fame || 0) && !(p.parts || []).some(n => fold(n) === fold(s.name))) {
          const g = groups && groups.groupOf && groups.groupOf.get(String(s.id));
          if (String(g) !== String(p.id)) F.push(['FOLD', `${s.name} stands inside ${p.name}'s mapped grounds but is a separate stop`, { id: s.id, of: p.id }]);
        }
      }
    }
    // FAME: the best-known places around (Wikipedia languages), visitable kinds, against the list.
    if (centre) {
      const j = await sparql(`SELECT ?item ?itemLabel ?sl ?loc WHERE { SERVICE wikibase:around { ?item wdt:P625 ?loc . bd:serviceParam wikibase:center "Point(${centre.lng} ${centre.lat})"^^geo:wktLiteral . bd:serviceParam wikibase:radius "6" . } ?item wikibase:sitelinks ?sl . FILTER(?sl >= 25)
        FILTER NOT EXISTS { ?item wdt:P31/wdt:P279* ?bad . VALUES ?bad { wd:Q486972 wd:Q56061 wd:Q5 wd:Q4830453 wd:Q43229 wd:Q55488 wd:Q3918 wd:Q3914 wd:Q16917 wd:Q1248784 wd:Q79007 wd:Q34442 wd:Q4022 wd:Q23397 wd:Q165 wd:Q1656682 wd:Q123705 wd:Q15284 wd:Q1093829 wd:Q719456 wd:Q483110 wd:Q13226383 wd:Q2221906 wd:Q8502 wd:Q1149652 } }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul" . } } ORDER BY DESC(?sl) LIMIT 40`);
      const top = ((j && j.results && j.results.bindings) || []).map(b => ({ wd: b.item.value.split('/').pop(), name: b.itemLabel.value, sl: +b.sl.value }));
      const have = q => sights.some(s => s.wd === q.wd || fold(s.name) === fold(q.name) || (s.parts || []).some(n => fold(n) === fold(q.name)));
      top.slice(0, 15).forEach((q, k) => { if (!have(q)) F.push(['FAME', `#${k + 1} best known nearby, "${q.name}" (${q.sl} Wikipedia languages, ${q.wd}), is not offered`, { wd: q.wd, sl: q.sl }]); });
      const exp = EXPECT_MORE.find(x => x.key === name) || EXPECT.find(x => fold(x.label.split(',')[0]) === fold(label.split(',')[0]));
      for (const want of (exp && exp.expect) || []) {
        const hit = sights.find(s => want.split('|').some(n => fold(s.name).includes(fold(n)) || fold(n).includes(fold(s.name)) || (s.parts || []).some(p => fold(p).includes(fold(n)))));
        if (!hit) F.push(['FAME', `must-see "${want}" is not offered`, { want }]);
        else if (!hit.mustSee && !hit.far && !(hit.parts || []).length) F.push(['FAME', `must-see "${want}" is offered (${hit.name}) but not marked must-see`, { want, id: hit.id }]);
      }
      const rank = main.slice().sort((a, b) => (b.fame || 0) - (a.fame || 0));
      const must = main.filter(s => s.mustSee).map(s => s.name);
      F.push(['INFO', `${main.length} sights, ${sights.length - main.length} day trips/towns; must-see: ${must.join(', ') || 'none'}; top by fame: ${rank.slice(0, 8).map(s => s.name + ' ' + (s.fame || 0)).join(', ')}`]);
    }
    if (/hamburg/i.test(label) && !sights.some(s => s.far && /l[uü]beck/i.test(s.name + ' ' + (s.town || '')))) F.push(['TRIP', 'Lübeck is not offered as a day trip from Hamburg', {}]);
    const far = sights.filter(s => s.far && !s.town).map(s => s.name);
    if (far.length) F.push(['INFO', `day trips: ${far.join(', ')}`]);
    fs.writeFileSync(path.join(DIR, name + '.audit.json'), JSON.stringify({ name, label, centre, findings: F.map(([k, t, x]) => ({ k, t, x: x || {} })), sights }, null, 1));
    const order = ['POS', 'DUP', 'NOT', 'NOID', 'NAME', 'FOLD', 'LEN', 'FAME', 'TRIP', 'POS?', 'ERR', 'INFO'];
    report.push(`## ${label} (${D.guide.city}${D.guide.builtin ? ', built-in guide' : D.guide.srcGuide ? ', guide from sources' : ''})\n` + F.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map(([k, t]) => `- ${k} ${t}`).join('\n') + '\n');
    console.log(report[report.length - 1]);
  }
  fs.writeFileSync(path.join(DIR, `report-${process.env.BATCH || 'all'}.md`), report.join('\n'));
}
function o_same(a, b, osm) { const x = a.wd && osm[a.wd], y = b.wd && osm[b.wd]; return !!(x && y && x.type === y.type); }

(process.argv[2] === 'audit' ? audit() : dump()).catch(e => { console.error(e); process.exit(1); });
