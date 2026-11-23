// Live check (Nov 23): is the published Beta 2 app carrying the sight rules, and does the live helper send the facts
// they read? Reads the live page for the rules' code, then asks the live helper's /sources for four places.
const SITE = 'https://gilsonr0566-sys.github.io/Kairoute-Beta2/';
const get = async (u, j) => { for (let t = 0; t < 3; t++) { try { const r = await fetch(u, { cache: 'no-store' }); if (r.ok) return j ? await r.json() : await r.text(); console.log('HTTP', r.status, u); } catch (e) { console.log('ERR', e.message, u); } await new Promise(x => setTimeout(x, 5000)); } return null; };
const html = await get(SITE), ver = await get(SITE + 'version.txt');
console.log('LIVE version', (ver || '').trim(), 'page', html ? html.length : 0, 'bytes');
const marks = { 'twin listing dropped': 'const twin = s =>', 'same name 5 km apart': 'hav(a, b) > 5) return "";', 'group listing': 'if (x.isGroup) return true;', 'map area': 'if (x.area && !srcHas2(x, SRC_SIGHT_KINDS)) return true;', 'term': 'if (srcHas2(x, /^term$/)', 'fame length for Sight': 'Sight: [[100, 90], [60, 60]]', 'Castle or fort': '"Castle or fort"', 'Mosque label': '[/^mosque$/, "Mosque", 30]', 'lift is no church': 'lift|elevator|elevador', 'pinned lunch 10 min': 'L.pinned ? 10' };
for (const [k, v] of Object.entries(marks)) console.log(`${html && html.includes(v) ? 'LIVE ok ' : 'LIVE MISSING'} ${k}`);
const ai = await get(SITE + 'ai.json', true), H = ai && ai.url && ai.url.replace(/\/$/, '');
console.log('helper', H ? 'found' : 'NOT FOUND');
if (H) {
  const want = { 'Paris, France': ['Bastille'], 'Jerusalem, Israel': ['Holy Land', 'Old City', 'Via Dolorosa'], 'Lisbon, Portugal': ['Santa Justa', 'Belém Tower'], 'Kyoto, Japan': ['Historic Monuments of Ancient Kyoto'] };
  for (const [city, names] of Object.entries(want)) {
    const j = await get(H + '/sources?city=' + encodeURIComponent(city), true);
    console.log(`SOURCES ${city}: ${j && j.stops ? j.stops.length + ' stops' : 'no answer'}`);
    for (const n of names) for (const x of ((j && j.stops) || []).filter(x => x.name.includes(n)).slice(0, 3))
      console.log(`  ${x.name} ${x.wd} sl${x.sl} kinds=${(x.kinds || []).join(',')} gone=${!!x.gone} area=${x.area || ''} partOf=${(x.partOf || []).join(',')}`);
  }
}
