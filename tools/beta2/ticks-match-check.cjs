// Ticks match the plan (Nov 23 2026 outside test: on 13 of 174 days the sights ticked in Choose sights were not the
// stops on the Day plan). The BUILT Beta 2 app (never the demo), offline, no AI, with saved trips from that test
// (tools/beta2/ticks/*.json: the trip and its guides as the phone kept them). Each place's guide is installed again on
// days with no picks yet, as a guide arriving does; every day is read on screen as saved and after that:
//   1. the starting picks are marked as the app's (so the planner fills the day and the picker shows what it planned);
//   2. every numbered stop on the Day plan is ticked in Choose sights, and on a day still on the app's own picks every
//      ticked sight is a numbered stop (a list the traveler made may hold a sight that day can't take, said on the plan);
//   3. a day-trip town planned with its own sights is the walk between them, never its whole visit again beside them,
//      and the sights keep their town in what the planner is given.
// Usage: node tools/beta2/ticks-match-check.cjs [beta2-site/index.html]. Exit 1 on any failure.
const { chromium } = require('playwright'); const path = require('path'), http = require('http'), fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const B2 = path.resolve(process.argv[2] || path.join(ROOT, 'beta2-site', 'index.html'));
const DIR = path.join(__dirname, 'ticks');
function serve() { return new Promise(res => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
  let f = u === '/' || u === '/index.html' ? B2 : null; if (!f) for (const base of [path.dirname(B2), ROOT]) { const g = path.join(base, u); if (g.startsWith(base) && fs.existsSync(g) && !fs.statSync(g).isDirectory()) { f = g; break; } }
  if (!f) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
  s.listen(0, () => res({ base: 'http://localhost:' + s.address().port, close: () => s.close() })); }); }
const norm = x => String(x).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
(async () => {
  const browser = await chromium.launch(), srv = await serve(); const fails = []; let days = 0, ticks = 0, towns = 0;
  for (const f0 of fs.readdirSync(DIR).filter(x => x.endsWith('.json')).sort()) for (const fresh of [false, true]) {
    const fx = JSON.parse(fs.readFileSync(path.join(DIR, f0))), f = f0 + (fresh ? ' (guide installed again)' : ' (as saved)');
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, timezoneId: 'America/Chicago' });
    await ctx.route(u => !/^http:\/\/localhost/.test(String(u)), r => r.fulfill({ status: 503, body: '' }));
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await p.goto(srv.base + '/index.html'); await p.waitForTimeout(800);
    await p.evaluate(s => { localStorage.clear(); localStorage.setItem('kairoute.intro1', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, fx.storage);
    await p.reload(); await p.waitForTimeout(3500);
    const n = await p.evaluate(() => (window.__kairouteDays ? window.__kairouteDays() : []).length);
    const seeded = !fresh ? [] : await p.evaluate(() => { const out = []; if (!window.__kairouteReinstall) return [{ selected: 'no test hook', appSeeded: false }]; const seen = new Set(); window.__kairouteDays().forEach(d => { if (d.city && !seen.has(d.city)) { seen.add(d.city); out.push(...(window.__kairouteReinstall(d.i) || [])); } }); return out; });
    seeded.forEach((s, k) => { if (!s.appSeeded) fails.push(`${f}: a day's starting picks after its guide arrived are not marked as the app's (${s.selected} picks)`); });
    for (let i = 0; i < n; i++) {
      const r = await p.evaluate(async i => {
        const d = window.__kairouteDays()[i]; if (d.type === 'sea' || !d.city) return null;
        window.__kairouteGo('day', i); window.__kairouteGo('plan'); await new Promise(r => setTimeout(r, 1200));
        for (let k = 0; k < 40 && window.__kairouteFitPending && window.__kairouteFitPending() > 0; k++) await new Promise(r => setTimeout(r, 200));
        const text = (document.querySelector('main') || document.body).innerText;
        window.__kairouteGo('sites'); await new Promise(r => setTimeout(r, 1500));
        const on = [...document.querySelectorAll('input[data-site]')].filter(x => x.checked).map(x => (x.getAttribute('aria-label') || '').replace(/^Pick /, ''));
        const plans = window.__kairouteEngine2(), b = window.__kairouteBucket(true), ep = plans[i] || {}, bc = (b.cities || {})[d.city] || {};
        const far = bc.farther || [], townOf = new Map(far.filter(s => s.town != null).map(s => [String(s.id), String(s.town)]));
        const stops = (ep.items || []).filter(x => x.t === 'stop');
        const town = stops.filter(t => stops.some(s => townOf.get(String(s.id)) === String(t.id))).map(t => ({ name: t.name, min: t.min, full: (far.find(x => String(x.id) === String(t.id)) || {}).minutes || 0 }));
        const seed = ((window.__kairouteLeadWhy && window.__kairouteLeadWhy(i)) || {}).seedSig;
        // Sights a town's places listing names (id "<town>~<n>") whose town the planner was not told.
        const lost = (window.__kairouteBucket(true).cities[d.city].farther || []).filter(s => /~/.test(String(s.id)) && far.some(t => String(t.id) === String(s.id).split('~')[0]) && s.town == null).map(s => s.name);
        return { text, on, town, lost, seed, type: d.type, dest: d.dest };
      }, i);
      if (!r) continue; days++;
      const where = `${f} day ${i + 1} (${r.type} ${r.dest})`;
      if (!/\n(?:LEAVE|ARRIVE)\n/.test(r.text)) continue;
      const plan = [...r.text.matchAll(/\n(?:LEAVE|ARRIVE)\n[^\n]+\n\d+\n([^\n]+)/g)].map(m => m[1]);
      const P = new Set(plan.map(norm)), O = new Set(r.on.map(norm)); ticks += r.on.length;
      const tNotP = r.on.filter(x => !P.has(norm(x))), pNotT = [...new Set(plan)].filter(x => !O.has(norm(x)));
      // A list the traveler made may hold a sight that can't be visited that day (the plan says why); the app's own
      // starting picks are exactly what it planned.
      if ((r.seed === 'app picks' && tNotP.length) || pNotT.length) fails.push(`${where}: ticked but not on the plan: ${tNotP.join(', ') || 'none'}; on the plan but not ticked: ${pNotT.join(', ') || 'none'}`);
      r.town.forEach(t => { towns++; if (t.min > 60 || (t.full && t.min >= t.full)) fails.push(`${where}: ${t.name} is planned for ${t.min} min (its whole visit, ${t.full} min) beside its own sights (should be the walk between them)`); });
      if (r.lost.length) fails.push(`${where}: the planner was not told the town of ${r.lost.slice(0, 3).join(', ')}`);
    }
    if (errs.length) fails.push(`${f}: page errors: ${[...new Set(errs)].slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
  console.log(`Ticks match the plan: ${days} days read, ${ticks} ticks, ${towns} day-trip towns with their own sights, ${fails.length} failures`);
  fails.slice(0, 20).forEach(m => console.log('FAIL ' + m.slice(0, 400)));
  if (!days || !towns) { console.log('FAIL the saved trips gave no days or no day-trip town to read'); process.exitCode = 1; }
  await browser.close(); srv.close(); if (fails.length) process.exitCode = 1;
})();
