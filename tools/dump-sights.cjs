// Lists every sight Kairoute's guides offer for each city of the example trip, as the live site has them
// (full guides load from the shared cache). Run by the "List guide sights" workflow.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } }); p.on('console', m => { if (m.type() === 'warning' && /Guide build failed/.test(m.text())) console.log('WARN ' + m.text().slice(0, 400)); }); p.on('response', r => { if (r.status() >= 500) console.log('HTTP ' + r.status() + ' ' + r.url().slice(0, 160)); });
  await p.goto('https://gilsonr0566-sys.github.io/Kairoute/?t=' + Date.now()); await p.evaluate(() => localStorage.setItem('kairoute.intro1', '1')); await p.reload(); await p.waitForTimeout(3000);
  await p.click('[data-act="continue"]').catch(() => {}); await p.waitForTimeout(800);
  const n = await p.evaluate(() => document.querySelectorAll('.daychip').length);
  for (let i = 0; i < n; i++) { await p.click(`.daychip[data-day="${i}"]`).catch(() => {}); await p.click('#tab-plan').catch(() => {}); for (let t = 0; t < 40; t++) { await p.waitForTimeout(1500); if (!(await p.evaluate(() => window.__kairouteUpgrading()))) break; } }
  console.log('SIGHTS ' + JSON.stringify(await p.evaluate(() => window.__kairouteSights ? window.__kairouteSights() : 'no hook')));
  // Repeats folded (one place under two names, or a part of a bigger place), in every guide the app holds.
  const log = await p.evaluate(() => window.__kairouteDedupeLog ? window.__kairouteDedupeLog() : []), cities = await p.evaluate(() => window.__kairouteDupCities ? window.__kairouteDupCities() : null);
  console.log(`DEDUPE ${cities ? cities.n + ' guides checked, ' + cities.sights + ' sights; ' : ''}${log.filter(x => x.rel === 'same').length} repeats merged, ${log.filter(x => x.rel === 'part').length} parts folded into their place`);
  log.forEach(x => console.log(`  ${x.city}: ${x.rel === 'same' ? 'merged' : 'part of'} "${x.gone}" -> "${x.kept}"`));
  if (cities) console.log('LEFT ' + JSON.stringify(cities.left));
  // Near twins: two sights of one city within 300 m, whatever their names, with what the app knows of each, so a
  // repeat under two languages' names (Duomo di Messina / Messina Cathedral) shows how it got in.
  const twins = await p.evaluate(() => { try { const out = []; const seen = new Set(); const f = x => [x.name, x.srcOnly ? 'src' : 'guide', x.wd || '-', x.local || '-', x.category || '-'].join(' | ');
    for (const k in cities) { const c = cities[k]; if (!c || seen.has(c)) continue; seen.add(c); const all = allSites(c).filter(x => isFinite(x.lat));
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { const d = hav(all[i], all[j]); if (d > 0.3) continue;
        const r = placeRel(all[i], all[j]) || placeRel(all[j], all[i]) || 'apart'; out.push(c.city + ' ' + Math.round(d * 1000) + 'm ' + r + ': ' + f(all[i]) + '  <>  ' + f(all[j])); } }
    return out; } catch (e) { return ['twin scan failed: ' + e]; } });
  twins.forEach(x => console.log('TWIN ' + x));
  await b.close();
})();
