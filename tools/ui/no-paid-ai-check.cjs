// No paid AI is offered to a traveler (Richard, Nov 21 2026: no AI of any kind and no paid service without his yes).
// Every Settings section, on a fresh device, must not offer an API key form or ask for an Anthropic/OpenAI key.
// Offline, no AI. Usage: node tools/ui/no-paid-ai-check.cjs [beta2-site/index.html]
const { chromium } = require('playwright'); const path = require('path'); const http = require('http'); const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'beta2-site/index.html');
const serve = f => new Promise(res => { const dir = path.dirname(f); const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(dir, u === '/' ? path.basename(f) : u); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'text/plain' }); fs.createReadStream(p).pipe(r); }); s.listen(0, () => res({ url: 'http://localhost:' + s.address().port + '/', close: () => s.close() })); });
(async () => {
  const s = await serve(FILE); const b = await chromium.launch(); const fails = [];
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
  await ctx.route(u => !/^http:\/\/localhost/.test(String(u)), r => r.fulfill({ status: 503, body: '' }));
  const p = await ctx.newPage(); await p.goto(s.url); await p.waitForTimeout(2500);
  for (let k = 0; k < 5; k++) { const sk = p.locator('.coach button:has-text("Skip")').first(); if (await sk.isVisible().catch(() => false)) await sk.click(); else break; }
  await p.evaluate(() => window.__kairouteGo('settings')); await p.waitForTimeout(1200);
  const secs = await p.locator('main .setnav button, main [data-sec]').count(); let seen = 0;
  for (let i = 0; i < secs; i++) { const btn = p.locator('main .setnav button, main [data-sec]').nth(i); if (!(await btn.isVisible().catch(() => false))) continue; const name = (await btn.innerText()).trim(); await btn.click(); await p.waitForTimeout(500); seen++;
    const bad = await p.evaluate(() => { const m = document.querySelector('main'); return { key: !!m.querySelector('#aikey'), text: (m.innerHTML.match(/own (Anthropic|OpenAI) key|API key|sk-ant-/i) || [''])[0] }; });
    if (bad.key || bad.text) fails.push(`Settings > ${name}: offers a paid AI key (${bad.text || '#aikey'})`); }
  if (!seen) fails.push('no Settings sections found');
  await b.close(); s.close();
  if (fails.length) { console.log('FAIL\n' + fails.join('\n')); process.exit(1); } console.log('PASS no-paid-ai check (' + seen + ' sections)');
})();
