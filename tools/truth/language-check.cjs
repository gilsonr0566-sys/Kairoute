// Everything on screen in the traveler's language (Richard, Nov 23 2026: "We have fought areas not being in English and yet
// it still pops up ... create rules that will keep things happening again"). A CLASS check, not a check of one source:
// sight names were fixed on Nov 18, yet station, line and restaurant names still came through in local script, because
// every source had its own fix. This reads every text the planner hands the screen (names, ride ways and steps, notes,
// reasons) on every saved test trip, and then again with a foreign name planted in EVERY source the planner reads:
// sights, restaurants, a town's places to eat, the timetable helper's line names, stops and walking ends. Any letter
// outside the Latin alphabet in what the traveler is shown fails. (The phrase card, "useful words", is the one place
// local script belongs; it is not built by the planner.)
// Usage: node tools/truth/language-check.cjs [--show 4]   (exit 1 on any finding; a WARN only with an owner and an
// unexpired date in docs/qa/warns.json, rule "language", as for every S2 rule)
'use strict';
const fs = require('fs'), path = require('path'), ROOT = path.join(__dirname, '..', '..');
const E = require('../beta2/engine.cjs'), { hav } = require('./oracle.cjs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; }, SHOW = +arg('show', 4);
// Not Latin letters: Greek, Cyrillic, Armenian, Hebrew, Arabic, Thai, Georgian, Japanese, Chinese, Korean and the rest.
const FOREIGN = /[Ͱ-Ͽἀ-῿Ѐ-ԯ԰-֏֐-׿؀-ۿݐ-ݿ฀-๿Ⴀ-ჿ぀-ヿ㐀-鿿가-힯]/;
// The texts a plan puts on the screen (the app shows these fields; ids, kinds and raw helper answers are not shown as such).
const SHOWN = new Set(['name', 'how', 'steps', 'note', 'notes', 'explain', 'why', 'msg', 'title', 'text', 'lunchIn', 'pierName', 'meal', 'said', 'unsure', 'lost', 'warn', 'reason', 'line', 'stop', 'label']);
const PD = path.join(ROOT, 'tools', 'places', 'data'), places = {};
if (fs.existsSync(PD)) for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; }
const dir = process.env.SNAP_DIR || path.join(ROOT, 'tools', 'beta2', 'corpus');
const trips = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => ({ name: f.replace(/\.json$/, ''), b: JSON.parse(fs.readFileSync(path.join(dir, f))) }));
// Planted names, one per script, each tagged with the source it was planted in.
const PLANT = ['Ταβέρνα Θανάσης', 'Кафе Пушкин', '三条駅', 'שוק הכרמל', 'مطعم الياسمين', '경복궁역', 'สถานี'];
let pi = 0; const plant = src => { const s = PLANT[pi++ % PLANT.length]; return s; };
function scan(plans, out, trip, srcOf) {
  const walk = (o, k, where) => { if (o == null) return; if (typeof o === 'string') { if (SHOWN.has(k) && FOREIGN.test(o)) out.push({ trip, where, field: k, text: o.slice(0, 80) }); return; }
    if (Array.isArray(o)) { o.forEach(x => walk(x, k, where)); return; } if (typeof o === 'object') for (const kk in o) if (kk !== 'ans' && kk !== 'raw' && kk !== 'osm') walk(o[kk], SHOWN.has(k) && Array.isArray(o) ? k : kk, where); };
  plans.forEach((p, i) => { if (!p) return; (p.items || []).forEach(x => walk(x, '', `day ${i + 1} ${x.t || ''}`)); ['explain', 'notes', 'msg', 'why', 'unsure'].forEach(k => walk(p[k], k, `day ${i + 1}`)); });
}
function run(planted) {
  const out = []; let n = 0;
  for (const { name, b: b0 } of trips) {
    // Planted in the trip as the app holds it, BEFORE the planner reads it (applyPlaces), so every conversion the planner
    // already does gets its chance.
    const b = JSON.parse(JSON.stringify(b0));
    if (planted) {
      for (const c of Object.values(b.cities || {})) {
        (c.sites || []).forEach((s, k) => { if (k % 3 === 0) s.name = plant('sight') + ' ' + (s.name || ''); });
        (c.restaurants || []).forEach(r => { r.name = plant('restaurant') + ' ' + (r.name || ''); });
        (c.farther || []).forEach(t => (t.foodDrink || []).forEach(x => { x.name = plant('town'); }));
      }
      b.answers = (a, z) => { const km = hav(a, z); if (!(km >= 1.5)) return []; const st = plant('station');
        return [{ id: 'rail|T', label: 'Γραμμή 1 ' + plant('line'), mode: 'train', kind: 'Train', steps: [`Train ${plant('line')} from ${st} to ${plant('station')}`], ride: Math.round(km) + 5, wait: 5, every: 30,
          min: Math.round(km) + 20, access: { how: 'walk', min: 5, km: 0.4, name: st }, egress: { how: 'walk', min: 8, km: 0.6, name: plant('station') } }]; };
    }
    let plans; try { const bb = E.applyPlaces(b, places); if (b.answers) bb.answers = b.answers; plans = E.planTrip(bb); } catch (e) { out.push({ trip: name, where: 'plan', field: 'error', text: e.message }); continue; }
    n++; scan(plans, out, name);
  }
  return { out, n };
}
const warns = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'qa', 'warns.json'), 'utf8')).warns || []; } catch (e) { return []; } })();
const today = new Date().toISOString().slice(0, 10), w = warns.find(x => x.rule === 'language' && x.owner && x.until >= today);
const A = run(false), B = run(true);
console.log(`Language on screen: ${A.n} saved trips as they are, then again with a foreign name planted in every source (sights, restaurants, towns' places to eat, timetable lines, stops)`);
for (const [label, r] of [['as saved', A], ['planted', B]]) {
  const byField = {}; r.out.forEach(x => (byField[x.field] = byField[x.field] || []).push(x));
  console.log(`${r.out.length ? (w ? 'WARN' : 'FAIL') : 'ok  '} language ${r.out.length}` + `   (${label})`);
  Object.entries(byField).forEach(([f, xs]) => { console.log(`       ${f}: ${xs.length}`); xs.slice(0, SHOW).forEach(x => console.log(`         ${x.trip} ${x.where}: ${x.text}`)); });
}
const bad = A.out.length + B.out.length;
if (bad && w) console.log(`Known (docs/qa/warns.json): owner "${w.owner}", until ${w.until}`);
process.exitCode = bad && !w ? 1 : 0;
