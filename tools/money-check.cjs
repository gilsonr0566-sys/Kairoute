// Money check (src/features/money.js): home-currency figures, what was spent, the trip's spending and its report.
// Fails the publish if:
//  - a built-in city's money is unknown, or Kusadasi's euro prices show as lira,
//  - the Day plan's cost card doesn't show "≈" home figures and the rate's date once rates are known,
//  - typing what was spent re-plans the day, isn't kept after a reload, or doesn't change the day's total,
//  - the Journal's trip spending doesn't add up the same days as the Day plans, or the spending report fails,
//  - no rates at all (offline, first start) breaks any of it.
// Usage: node tools/money-check.cjs [path/to/index.html]
const { chromium } = require('playwright'); const path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const RATES = { day: '2026-11-17', rates: { USD: 1, EUR: 0.862, TRY: 42.3, GBP: 0.76 } };
(async () => {
  const b = await chromium.launch(); let fails = 0; const bad = m => { fails++; console.log('FAIL ' + m); }, ok = m => console.log('ok   ' + m);
  for (const withRates of [true, false]) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
    await ctx.addInitScript(([r, w]) => { try { localStorage.setItem('kairoute.intro1', '1'); if (w && !sessionStorage.getItem('fxSet')) { sessionStorage.setItem('fxSet', '1'); localStorage.setItem('kairoute.fx1', JSON.stringify(Object.assign({ at: Date.now() }, r))); } } catch (e) {} }, [RATES, withRates]);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + FILE); await p.waitForTimeout(700);
    const tag = withRates ? '' : ' (no rates)';
    const cc = await p.evaluate(() => { const M = window.__kairouteMoney; return M.tripBudget().map(r => [r.city, r.cur, r.sym]); });
    const unknown = cc.filter(x => !x[1]); unknown.length ? bad('cities without a known currency' + tag + ': ' + unknown.map(x => x[0]).join(', ')) : ok('every day ashore has its currency' + tag);
    const kus = cc.find(x => /Kusadasi/.test(x[0])); if (kus) (kus[1] === 'EUR' && kus[2] === '€') ? ok('Kusadasi prices in euros') : bad('Kusadasi prices shown as ' + kus.slice(1).join(' '));
    // Day plan card
    const port = (await p.evaluate(() => window.__kairouteDays())).find(d => d.city && d.type === 'port');
    await p.evaluate(i => window.__kairouteAt(i, 'plan'), port.i); await p.waitForTimeout(400);
    const card = await p.evaluate(() => { const c = document.querySelector('#view .budgetcard'); return c ? c.textContent.replace(/\s+/g, ' ') : ''; });
    if (!card) bad('no cost card on the Day plan' + tag);
    else if (withRates) (/≈ \$\d/.test(card) && /rate from Nov 17/.test(card)) ? ok('cost card shows ≈ dollars and the rate date') : bad('cost card lacks home figures: ' + card.slice(0, 200));
    else (!/≈/.test(card) && /once the app has been online/.test(card)) ? ok('no rates: card says figures come once online') : bad('no-rates card wrong: ' + card.slice(0, 200));
    // Typing what was spent: no re-plan, kept, total changes
    const before = await p.evaluate(() => window.__kairoutePlanStat().built);
    const tot0 = await p.evaluate(() => document.querySelector('#view .budgetcard .spendtotal b').textContent);
    await p.evaluate(() => document.querySelector('#view details.morefold') && (document.querySelector('#view details.morefold').open = true, document.querySelector('#view details.goodtoknow').open = true));
    await p.click('#view .budgetcard [data-spend="food"]'); await p.fill('#spendIn', '123.50'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    const after = await p.evaluate(() => window.__kairoutePlanStat().built), tot1 = await p.evaluate(() => document.querySelector('#view .budgetcard .spendtotal b').textContent);
    const foodTxt = await p.evaluate(() => document.querySelector('#view .budgetcard [data-spend="food"]').innerText);
    /€123\.50/.test(foodTxt) && /spent/.test(foodTxt) ? ok('food amount saved' + tag) : bad('food amount not shown: ' + foodTxt);
    tot1 !== tot0 ? ok('day total uses what was spent') : bad('day total unchanged ' + tot0);
    after === before ? ok('typing an amount never re-plans') : bad(`typing an amount re-planned (${before} -> ${after})`);
    await p.waitForTimeout(1500); // let the browser hand the saved amount to storage before reopening
    await p.reload(); await p.waitForTimeout(700); await p.evaluate(i => window.__kairouteAt(i, 'plan'), port.i); await p.waitForTimeout(300);
    const kept = await p.evaluate(() => (document.querySelector('#view .budgetcard [data-spend="food"]') || {}).textContent || '');
    /€123\.50/.test(kept) ? ok('amount kept after reopening') : bad('amount lost after reload' + tag);
    // Journal
    await p.evaluate(() => window.__kairouteAt(0, 'journal'));
    for (let k = 0; k < 80; k++) { const t = await p.evaluate(() => (document.querySelector('#view .tripbudget summary') || {}).textContent || ''); if (t && !/adding|so far/.test(t)) break; await p.waitForTimeout(400); }
    const num = s => s.split(' ').map(x => +x.replace(/[^\d.]/g, '')).join(' '), j = num(await p.evaluate(() => [...document.querySelectorAll('#view .sprow .spamt')].map(e => e.textContent).join(' '))), t = num(await p.evaluate(() => window.__kairouteMoney.tripBudget().map(r => r.sym + r.total).join(' ')));
    j && j === t ? ok('Journal trip spending matches every Day plan' + tag) : bad('Journal rows differ from plans:\n  ' + j + '\n  ' + t);
    const sum = await p.evaluate(() => document.querySelector('#view .tripbudget summary').textContent);
    withRates ? (/≈ \$[\d,]+/.test(sum) ? ok('Journal total in dollars') : bad('Journal summary lacks ≈ $: ' + sum)) : (!/≈/.test(sum) ? ok('no rates: Journal shows local money only') : bad('no-rates Journal shows ≈'));
    const rep = await p.evaluate(() => { try { return window.__kairouteMoney.spendingHTML(); } catch (e) { return 'ERR ' + e.message; } });
    /<table class="pspend">/.test(rep) && /Trip total/.test(rep) ? ok('spending report builds' + tag) : bad('spending report: ' + rep.slice(0, 200));
    errs.length ? bad('page errors' + tag + ': ' + errs.slice(0, 3).join(' | ')) : ok('no page errors' + tag);
    await ctx.close();
  }
  // The rate sources answer a page on the live site's address (they must allow other sites to read them). Only
  // reported: no internet here must never stop a publish, and the app falls back to the next source.
  try {
    const p = await (await b.newContext()).newPage(); await p.goto('https://gilsonr0566-sys.github.io/Kairoute/version.txt', { timeout: 15000 });
    const r = await p.evaluate(async () => { const out = []; for (const u of ['https://open.er-api.com/v6/latest/USD', 'https://api.frankfurter.app/latest?from=USD']) { try { const j = await (await fetch(u)).json(); out.push(u.split('/')[2] + ': ' + (j.rates && j.rates.EUR ? 'EUR ' + j.rates.EUR + ' on ' + (j.date || j.time_last_update_utc) : 'no rates')); } catch (e) { out.push(u.split('/')[2] + ': ' + e.message); } } return out; });
    console.log('rate sources from the live site: ' + r.join('; '));
  } catch (e) { console.log('rate sources not checked (no internet here)'); }
  await b.close();
  console.log(fails ? `Money check: ${fails} problem(s)` : 'Money check passed'); process.exit(fails ? 1 : 0);
})();
