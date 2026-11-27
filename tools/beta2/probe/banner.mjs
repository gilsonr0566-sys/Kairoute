// Where the "Banner" sight in Kusadasi comes from: the English travel guide's wikitext around the word.
const UA = { 'User-Agent': 'KairouteBeta/0.1 (trip planner test build)' };
for (const t of ['Kuşadası', 'Kusadasi']) {
  const r = await fetch('https://en.wikivoyage.org/w/index.php?action=raw&title=' + encodeURIComponent(t), { headers: UA, redirect: 'follow' });
  const w = await r.text(); console.log('PAGE', t, r.status, w.length);
  let i = -1; while ((i = w.indexOf('Banner', i + 1)) >= 0) console.log('---\n' + w.slice(Math.max(0, i - 300), i + 300));
  if (w.length > 500) break; }
