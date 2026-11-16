// One-loop check on real data: opens the site (live by default, or URL), lets the guides and ride answers arrive,
// then prints every day of the sample trip whose route crosses itself, and plans an Athens day like Richard's Jul 1
// "Ancient Athens" (Nov 16: out east mid-day, back west for lunch, then back beside the start). Exit 1 on any
// crossing on that day. Run by the "Loop live check" workflow.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://gilsonr0566-sys.github.io/Kairoute/';
const RE = process.env.RE || '^Acropolis and|Areopagus|^Acropolis Museum|Panathenaic|Olympian Zeus|^Monastiraki|^Ancient Agora|^Plaka|Theatre of Dionysus|^Philopappos|^Roman Agora';
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  await p.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
  await p.goto(URL + (URL.includes('?') ? '&' : '?') + 't=' + Date.now()); await p.waitForFunction(() => window.__kairouteDays && window.__kairouteCrossings, null, { timeout: 180000 });
  console.log('Version', await p.evaluate(() => fetch('version.txt', { cache: 'no-store' }).then(r => r.text()).catch(() => '?')));
  const days = await p.evaluate(() => window.__kairouteDays());
  for (const d of days) { if (d.type === 'sea') continue; await p.evaluate(i => window.__kairouteAt(i, 'plan'), d.i); await p.waitForTimeout(5000); }
  await p.waitForTimeout(20000);
  const show = async i => { const r = await p.evaluate(i => window.__kairouteRoute(i), i); return (r || []).map(x => `${String(Math.floor(x.time / 60)).padStart(2, '0')}:${String(x.time % 60).padStart(2, '0')} ${x.type.padEnd(7)} ${x.lat.toFixed(4)},${x.lng.toFixed(4)} ${x.leg ? '[' + x.leg + '] ' : ''}${x.name}`).join('\n   '); };
  const cr = await p.evaluate(() => window.__kairouteCrossings());
  console.log('Crossings per day: ' + JSON.stringify(cr));
  for (const d of days) if (cr[d.i]) console.log(`\nday ${d.i + 1} ${d.date} ${d.dest}: ${cr[d.i]} crossing(s)\n   ` + await show(d.i));
  const j1 = days.find(x => x.date === '2027-07-01');
  const r = await p.evaluate(([i, re]) => { const o = window.__kairouteDay(i, re, { hours: 10, startTime: '08:30', fillTime: false }); return { o: o && { dropped: o.dropped }, n: window.__kairouteCrossings()[i] }; }, [j1.i, RE]);
  console.log(`\nAthens day like Jul 1 (${RE}): ${r.n} crossing(s), dropped ${JSON.stringify(r.o && r.o.dropped)}\n   ` + await show(j1.i));
  await b.close(); process.exit(r.n ? 1 : 0);
})();
