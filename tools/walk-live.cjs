// Writes the voice-tour walk-through for real stops on the live site (real sources, map and AI) and prints the
// script, so the live-guide standard can be read and checked. Usage: node tools/walk-live.cjs
const { chromium } = require('playwright');
const STOPS = [
  ['Athens', { name: 'Plaka and Anafiotika', lat: 37.9728, lng: 23.7300, category: 'Old town' }],
  ['Prague', { name: 'Old Town Square', lat: 50.0875, lng: 14.42139, category: 'Square' }, [{ name: 'Prague Astronomical Clock', lat: 50.08699, lng: 14.4207, category: 'Clock' }, { name: 'Charles Bridge', lat: 50.08639, lng: 14.41194, category: 'Bridge' }, { name: 'Prague Castle', lat: 50.09, lng: 14.4, category: 'Castle' }]]];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('https://gilsonr0566-sys.github.io/Kairoute/?t=' + Date.now()); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(4000);
  // Outside services (OpenStreetMap's map servers, Wikidata, the AI) are sometimes busy. When the map was busy and the
  // app rightly held back a thin walk, that's a warning, not a failure, so the run only goes red (and emails) for a
  // real problem in Kairoute's own walk-through. A long walk between two points is a quality warning too.
  let bad = 0; const lines = [], warns = []; const log0 = console.log; console.log = (...a) => { lines.push(a.join(' ')); log0(...a); };
  for (const [city, stop, others] of STOPS) {
    const r = await p.evaluate(([c, s, o]) => window.__kairouteWalkProbe(c, s, o), [city, stop, others]);
    console.log(`\n===== ${stop.name}, ${city} =====\nsources loaded: ${r.sources}; map sights nearby: ${r.mapSights}${r.mapWhy ? " (" + r.mapWhy + ")" : ""}; other stops in the guide: ${r.others}; real points (* = with facts): ${r.cands.join(', ')}`);
    console.log(`parts: ${r.parts.length}, stop time ${r.minutes} min${r.show ? ', show: ' + JSON.stringify(r.show) : ''}`);
    r.parts.forEach((x, i) => console.log(` ${i + 1}. ${x.name}${x.spot ? ' (spot)' : ''} · ${x.words} words · ${x.minutes} min · ${x.m} m from the last point\n    stand: ${x.stand}\n    walk: ${x.walk}\n    look: ${x.look}`));
    console.log('\n--- SCRIPT ---\n' + r.script + '\n--- END ---');
    const fails = [], busy = /502|busy|asked the map directly|Failed to fetch|abort/i.test(r.mapWhy || '') && r.mapSights === 0;
    if (r.parts.length < 3) (busy ? warns : fails).push((busy ? stop.name + ': ' : '') + 'fewer than 3 points' + (busy ? ' (the map servers were busy: the app waits and writes the walk later)' : ''));
    if (r.parts.some(x => !x.stand)) fails.push('a point without a stand-here line');
    if (r.parts.slice(1).some(x => !x.walk)) fails.push('a point without a walking cue');
    if (!r.intro || !r.wrap) fails.push('no opening or closing');
    if (r.parts.some(x => x.m > 300)) warns.push(stop.name + ': a walk of more than 300 m between two points');
    if (fails.length) { bad++; console.log('FAIL ' + stop.name + ': ' + fails.join('; ')); }
  }
  if (errs.length) { bad++; console.log('PAGE ERRORS: ' + errs.join(' | ')); }
  warns.forEach(w => console.log('WARN ' + w));
  console.log(bad ? `${bad} walk-through problem(s).` : `Walk-through live check passed${warns.length ? ` (${warns.length} warning(s))` : ''}.`);
  if (process.env.GITHUB_STEP_SUMMARY) try { require('fs').appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Walk-through live check\n\n```\n' + lines.join('\n') + '\n```\n'); } catch (e) {}
  await b.close(); process.exit(bad ? 1 : 0);
})();
