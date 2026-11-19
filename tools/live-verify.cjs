// One-off live check (Nov 19 demo fixes #207, #208) against the published site: run from a verify branch only.
const { chromium } = require('playwright');
const URL = process.env.LIVE_URL || 'https://gilsonr0566-sys.github.io/Kairoute/';
let fails = 0; const ok = m => console.log('ok   ' + m), bad = m => { fails++; console.log('FAIL ' + m); };
(async () => {
  const b = await chromium.launch();
  const v = await (await fetch(URL + 'version.txt?' + Date.now())).text().catch(() => '?'); console.log('live version.txt: ' + String(v).trim());
  async function open(vp) { const p = await b.newPage({ viewport: vp }); await p.goto(URL); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(2500);
    const s = p.locator('[data-act="loadsample"]').first(); if (await s.isVisible().catch(() => false)) await s.click(); await p.waitForTimeout(3000); return p; }
  for (const v of [{ name: 'Hotel Grande Bretagne', ll: null }, { name: '', ll: null }]) {
    const p = await open({ width: 800, height: 1280 });
    await p.evaluate(v => { const t = JSON.parse(localStorage.getItem('wayside.trip2')); t.lodging = t.lodging || {};
      for (const d of t.days) { const k = (d.cityKey || d.destination || '').toLowerCase().trim(); if (k) t.lodging[k] = Object.assign({ idx: 'custom' }, v); }
      for (const k of Object.keys(t.lodging)) t.lodging[k] = Object.assign({ idx: 'custom' }, v);
      localStorage.setItem('wayside.trip2', JSON.stringify(t)); }, v);
    await p.reload(); await p.waitForTimeout(3000);
    const days = (await p.evaluate(() => window.__kairouteDays())).filter(x => /^(land|arrival|embark|departure)$/.test(x.type)).slice(0, 8);
    const blank = [], noted = [], emb = [];
    for (const d of days) { await p.evaluate(i => window.__kairouteAt(i, 'plan'), d.i); await p.waitForTimeout(1200);
      const t = await p.evaluate(() => document.getElementById('view').innerText);
      if (/Choose where you're staying/.test(t)) blank.push(d.date + ' ' + d.type); if (/on the map yet/.test(t)) noted.push(d.i);
      if (d.type === 'embark') { emb.push(t.replace(/\s+/g, ' ').slice(0, 300)); await p.screenshot({ path: 'checks/demo/live-boarding-' + (v.name ? 'named' : 'noname') + '.png' }); } }
    const tag = `live unplaced hotel (${JSON.stringify(v.name)})`;
    if (blank.length) bad(`${tag}: blank days ${blank.join(', ')}`); else if (!noted.length || !emb.length) bad(`${tag}: no note or no boarding day`); else ok(`${tag}: ${days.length} days plan incl. boarding; boarding: ${emb[0]}`);
    await p.close(); }
  { const p = await open({ width: 1280, height: 800 });
    const r = await p.evaluate(() => { if (!window.__kairouteTravel) return null;
      const op = (mode, label, min) => ({ mode, kind: mode === 'ferry' ? 'Ferry' : 'Bus', label, operator: '', from: '', to: '', ride: min - 20, wait: 12, every: 20, everySrc: 'usual', access: { how: 'walk', min: 4, km: 0.3 }, egress: { how: 'walk', min: 4, km: 0.3 }, min, km: 2, noTimetable: true });
      const pan = { lat: 41.8986, lng: 12.4769, name: 'Pantheon' }, stp = { lat: 41.9022, lng: 12.4539, name: "St Peter's Basilica" };
      window.__kairouteTransitSet([{ a: pan, b: stp, opts: [op('ferry', 'Ferry Battelli di Roma', 100), op('bus', 'Bus 64', 22)] }]);
      return window.__kairouteTravel(pan, stp); });
    if (!r) bad('live slow ride: the new build is not live yet'); else if (r.choices.some(c => /Ferry/.test(c))) bad('live slow ride: ferry still offered ' + r.choices.join(', ')); else ok('live slow ride: ' + r.choices.join(', '));
    await p.close(); }
  await b.close(); console.log(fails ? fails + ' FAIL' : 'live verify passed'); process.exit(fails ? 1 : 0);
})();
