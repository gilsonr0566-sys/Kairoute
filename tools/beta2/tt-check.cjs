// Asks the live helper's free timetable lookup (/transit, no AI) for ship-day rides the outside tester found falling to a
// taxi, and prints when each kind of ride is known to leave, to check the departures now cover the whole day.
const H = 'https://kairoute-ai.rickgilson.workers.dev';
const PAIRS = [['Civitavecchia to Rome', [42.0934, 11.7926], [41.9010, 12.5018], '2027-09-08'], ['Rome to Civitavecchia', [41.9010, 12.5018], [42.0934, 11.7926], '2027-09-08'],
  ['Zeebrugge to Bruges', [51.3268, 3.2042], [51.1972, 3.2176], '2027-08-04'], ['Haifa to Jerusalem (Saturday)', [32.8223, 34.9997], [31.7683, 35.2137], '2027-05-15']];
const hm = t => String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
(async () => {
  for (let round = 0; round < 3; round++) {
    const r = await fetch(H + '/transit', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://gilsonr0566-sys.github.io' }, body: JSON.stringify({ pairs: PAIRS.map(([, a, b, date]) => ({ a, b, date, dow: new Date(date + 'T12:00:00Z').getUTCDay() })) }) });
    const j = await r.json(); let partial = false;
    (j.results || []).forEach((x, i) => { if (x.partial) partial = true; const by = {};
      for (const o of x.opts || []) { const k = o.kind || o.mode; (by[k] = by[k] || []).push(...(o.deps || []).map(d => d.t)); }
      console.log('TT ' + PAIRS[i][0] + (x.partial ? ' (partial)' : '') + ': ' + Object.entries(by).map(([k, ts]) => k + ' ' + [...new Set(ts)].sort((p, q) => p - q).map(hm).join(' ')).join(' | ')); });
    if (!partial) break; await new Promise(ok => setTimeout(ok, 90000));
  }
})();
