// Money on the live site: real exchange rates arrive, the Day plan shows ≈ home figures with the rate date, an amount
// typed in is kept and changes the day, the Journal adds up the trip and the spending report builds. Phone and tablet.
// Usage: node tools/money-live.cjs [url]
const { chromium } = require('playwright');
const URL = process.argv[2] || process.env.URL || 'https://gilsonr0566-sys.github.io/Kairoute/';
(async () => {
  const b = await chromium.launch(); let fails = 0; const bad = m => { fails++; console.log('FAIL ' + m); }, ok = m => console.log('ok   ' + m);
  for (const [name, w, h] of [['tablet', 1280, 800], ['phone', 412, 860]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'en-US', hasTouch: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('kairoute.intro1', '1'); } catch (e) {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL, { waitUntil: 'load', timeout: 60000 }); await p.waitForTimeout(3000);
    const has = await p.evaluate(() => !!window.__kairouteMoney); has ? ok(name + ': this build has the money features') : bad(name + ': live build lacks money features');
    if (!has) { await ctx.close(); continue; }
    const days = await p.evaluate(() => window.__kairouteDays()), hk = days.find(d => d.city && d.type === 'port');
    await p.evaluate(i => window.__kairouteAt(i, 'plan'), hk.i);
    let fx = null; for (let k = 0; k < 30 && !fx; k++) { await p.waitForTimeout(1000); fx = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('kairoute.fx1') || 'null'); } catch (e) { return null; } }); }
    fx ? ok(`${name}: real rates arrived (1 EUR = ${(1 / fx.rates.EUR).toFixed(3)} USD, rates from ${fx.day})`) : bad(name + ': no rates arrived in 30 s');
    await p.evaluate(i => window.__kairouteAt(i, 'plan'), hk.i); await p.waitForTimeout(800);
    const card = await p.evaluate(() => { const c = document.querySelector('#view .budgetcard'); return c ? c.textContent.replace(/\s+/g, ' ') : ''; });
    /≈ \$\d/.test(card) && /rate from/.test(card) ? ok(name + ': Day plan card: ' + card.slice(0, 260)) : bad(name + ': cost card: ' + card.slice(0, 300));
    await p.evaluate(() => { const a = document.querySelector('#view details.morefold'), g = document.querySelector('#view details.goodtoknow'); if (a) a.open = true; if (g) g.open = true; });
    await p.click('#view .budgetcard [data-spend="food"]'); await p.fill('#spendIn', '47'); await p.click('#view [data-spendact="save"]'); await p.waitForTimeout(400);
    const food = await p.evaluate(() => document.querySelector('#view .budgetcard [data-spend="food"]').textContent.replace(/\s+/g, ' '));
    /€47/.test(food) && /spent/.test(food) ? ok(name + ': typed 47 for food: ' + food.trim()) : bad(name + ': food entry: ' + food);
    await p.waitForTimeout(1500); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2500);
    await p.evaluate(i => window.__kairouteAt(i, 'plan'), hk.i); await p.waitForTimeout(800);
    const kept = await p.evaluate(() => (document.querySelector('#view .budgetcard [data-spend="food"]') || {}).textContent || '');
    /€47/.test(kept) ? ok(name + ': amount kept after reopening') : bad(name + ': amount lost after reopening');
    await p.evaluate(() => window.__kairouteAt(0, 'journal'));
    let sum = ''; for (let k = 0; k < 120; k++) { sum = await p.evaluate(() => (document.querySelector('#view .tripbudget summary') || {}).textContent || ''); if (sum && !/adding|so far/.test(sum)) break; await p.waitForTimeout(500); }
    /≈ \$[\d,]+/.test(sum) ? ok(name + ': Journal: ' + sum.replace(/\s+/g, ' ').trim()) : bad(name + ': Journal summary: ' + sum);
    const rows = await p.evaluate(() => document.querySelectorAll('#view .sprow').length), spentRow = await p.evaluate(() => (document.querySelector('#view .sprow.spent') || {}).textContent || '');
    rows >= 15 && /spent/.test(spentRow) ? ok(`${name}: ${rows} days listed; ${spentRow.replace(/\s+/g, ' ').trim()}`) : bad(`${name}: ${rows} rows, spent row "${spentRow}"`);
    const rep = await p.evaluate(() => { try { return window.__kairouteMoney.spendingHTML(); } catch (e) { return 'ERR ' + e.message; } });
    /<table class="pspend">/.test(rep) ? ok(name + ': spending report builds (' + (rep.match(/<tr>/g) || []).length + ' rows)') : bad(name + ': report: ' + rep.slice(0, 200));
    await p.evaluate(() => window.__kairouteGo ? window.__kairouteGo('settings', 0) : 0); await p.waitForTimeout(400);
    const set = await p.evaluate(() => { const s = document.getElementById('p-homecur'); return s ? s.options[s.selectedIndex].text : ''; });
    /Automatic \(US dollar\)/.test(set) ? ok(name + ': Settings: Home currency ' + set) : bad(name + ': home currency setting: ' + set);
    errs.length ? bad(name + ': page errors: ' + errs.slice(0, 3).join(' | ')) : ok(name + ': no page errors');
    await ctx.close();
  }
  await b.close(); console.log(fails ? `Money live check: ${fails} problem(s)` : 'Money live check passed'); process.exit(fails ? 1 : 0);
})();
