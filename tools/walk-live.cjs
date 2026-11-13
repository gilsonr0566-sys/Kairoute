// Writes the voice-tour walk-through for real stops on the live site (real sources, map and AI) and prints the
// script, so the live-guide standard can be read and checked. Usage: node tools/walk-live.cjs
const { chromium } = require('playwright');
const STOPS = [
  ['Athens', { name: 'Plaka and Anafiotika', lat: 37.9728, lng: 23.7300, category: 'Old town' }],
  ['Prague', { name: 'Old Town Square', lat: 50.0875, lng: 14.42139, category: 'Square' }]];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('https://gilsonr0566-sys.github.io/Kairoute/?t=' + Date.now()); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(4000);
  let bad = 0;
  for (const [city, stop] of STOPS) {
    const r = await p.evaluate(([c, s]) => window.__kairouteWalkProbe(c, s), [city, stop]);
    console.log(`\n===== ${stop.name}, ${city} =====\nsources loaded: ${r.sources}; real points nearby: ${r.cands.join(', ')}`);
    console.log(`parts: ${r.parts.length}, stop time ${r.minutes} min${r.show ? ', show: ' + JSON.stringify(r.show) : ''}`);
    r.parts.forEach((x, i) => console.log(` ${i + 1}. ${x.name}${x.spot ? ' (spot)' : ''} · ${x.words} words · ${x.minutes} min\n    stand: ${x.stand}\n    walk: ${x.walk}\n    look: ${x.look}`));
    console.log('\n--- SCRIPT ---\n' + r.script + '\n--- END ---');
    const fails = [];
    if (r.parts.length < 3) fails.push('fewer than 3 points');
    if (r.parts.some(x => !x.stand)) fails.push('a point without a stand-here line');
    if (r.parts.slice(1).some(x => !x.walk)) fails.push('a point without a walking cue');
    if (!r.intro || !r.wrap) fails.push('no opening or closing');
    if (fails.length) { bad++; console.log('FAIL ' + stop.name + ': ' + fails.join('; ')); }
  }
  if (errs.length) { bad++; console.log('PAGE ERRORS: ' + errs.join(' | ')); }
  await b.close(); process.exit(bad ? 1 : 0);
})();
