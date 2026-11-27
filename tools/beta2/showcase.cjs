// Beta 2 showcase: the old engine's day plans beside the new engine's, for a few saved trips, as one page.
// Everything on the page comes from the engines' own output (the old plans saved in each snapshot, the new ones
// planned here by E.planTrip). No AI, no internet. Usage: node tools/beta2/showcase.cjs out.html name1 name2:auto ...
// name:auto plans the trip with the traveler's picks cleared (the app chooses everything); the old engine's column is
// then left out, since its saved plans were made with the picks. PLACES_DIR=<places files> folds them in first.
const fs = require('fs'), path = require('path'), E = require('./engine.cjs');
const [out, ...names] = process.argv.slice(2);
const PD = process.env.PLACES_DIR, places = {};
if (PD) for (const f of fs.readdirSync(PD).filter(f => f.endsWith('.json'))) { const p = JSON.parse(fs.readFileSync(path.join(PD, f))); places[p.key] = p; }
const load = n => { const [file, mode] = n.split(':'), s = JSON.parse(fs.readFileSync(path.join(dir, file + '.json'))); if (mode === 'auto') s.days.forEach(d => { d.selected = null; }); return { s: PD ? Object.assign(E.applyPlaces(s, places), { old: s.old }) : s, auto: mode === 'auto', file }; };
const dir = path.join(__dirname, 'snapshots');
const hm = m => { const h = Math.floor(m / 60), mm = String(Math.round(m % 60)).padStart(2, '0'); return (h > 12 ? h - 12 : h || 12) + ':' + mm + (h >= 12 ? ' pm' : ' am'); };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dayName = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

function column(p, d, which) {
  if (!p || p.error) return `<div class="col ${which}"><h4>${which === 'old' ? 'Old engine' : 'New engine'}</h4><p class="none">${esc(p ? p.error : 'No plan')}</p></div>`;
  const rows = [];
  for (const x of p.items) {
    if (x.t === 'ride') { if (x.min > 0) { const alt = (x.options || []).filter(o => o.mode !== x.mode).map(o => `${esc(o.how)} ${o.min} min`).join(' · ');
      rows.push(`<li class="ride"><span class="t"></span><span>${x.mode === 'walk' ? 'Walk' : x.mode === 'transit' ? esc(x.how) : 'Ride'} ${x.min} min${x.km ? ' · ' + (+x.km).toFixed(1) + ' km' : ''}${alt ? `<br><span class="alt">or ${alt}</span>` : ''}</span></li>`); } continue; }
    const kind = x.t === 'stop' ? (x.bonus ? 'stop added' : 'stop') : x.t;
    const label = x.t === 'meal' ? (x.min < 45 ? 'Quick lunch · ' : 'Lunch · ') + x.name : x.t === 'evening' ? 'Dinner idea · ' + x.name : x.name;
    const tag = x.t === 'stop' && x.bonus ? '<em>added by the app</em>' : x.t === 'stop' ? '<em>your pick</em>' : '';
    rows.push(`<li class="${kind}"><span class="t">${hm(x.at)}</span><span>${esc(label)}${x.t === 'stop' || x.t === 'meal' ? ` <small>${x.min} min</small>` : ''} ${tag}${x.late ? ' <b class="warn">after last entry</b>' : ''}</span></li>`);
  }
  const stops = p.items.filter(x => x.t === 'stop').length, sight = p.items.filter(x => x.t === 'stop').reduce((a, x) => a + (x.min || 0), 0);
  const hard = d.type === 'port' || d.type === 'embark' || d.type === 'departure';
  const spare = hard ? p.endBy - p.end : null;
  const meta = [`${stops} stops`, `${Math.round(sight / 6) / 10} h of sightseeing`];
  if (hard) meta.push(`<b class="${spare < 10 ? 'tight' : 'ok'}">back ${spare} min before the deadline</b>`);
  const notes = which === 'new' && (p.explain || []).length ? `<ul class="why">${p.explain.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : '';
  return `<div class="col ${which}"><h4>${which === 'old' ? 'Old engine' : 'New engine'}</h4><p class="meta">${meta.join(' · ')}</p><ol>${rows.join('')}</ol>${notes}</div>`;
}

const sections = [];
for (const n of names) {
  const { s, auto, file } = load(n), plans = E.planTrip(s);
  const days = s.days.map((d, i) => ({ d, i })).filter(({ d }) => d.type !== 'sea' && !d.noShore);
  const blocks = days.map(({ d, i }) => {
    const hard = d.type === 'port';
    const head = hard ? `Ashore ${hm(d.portArrive)}, all aboard ${hm(d.allAboard)} (back at the ship ${E.PORT_BUFFER} min before)` : `Out from ${hm(plans[i] && plans[i].start || 540)}, back by ${hm(plans[i] && plans[i].endBy || 1080)}`;
    return `<div class="day"><h3>${dayName(d.date)}</h3><p class="frame">${esc(head)}</p><div class="pair${auto ? ' solo' : ''}">${auto ? '' : column(s.old[i], d, 'old')}${column(plans[i], d, 'new')}</div></div>`;
  });
  sections.push(`<section id="${esc(file)}"><h2>${esc(s.label || file)}</h2>${auto ? '<p class="frame">No picks: the app chose every stop on its own.</p>' : ''}${blocks.join('')}</section>`);
}

const html = `<title>Beta 2 Engine Preview</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&family=Inter:wght@400;500;600&display=swap">
<style>
/* Layout: a route-sheet: each day is a pair of timetables, old on the left, new on the right; stacks on a phone. */
:root { --bg:#f6f8f5; --panel:#ffffff; --fg:#1d2a24; --muted:#5d6b64; --line:#dce4df; --green:#1f7a4d; --sun:#e8772e; --oldc:#8a9690;
  --display:"Manrope",system-ui,sans-serif; --body:"Inter",system-ui,sans-serif; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#121815; --panel:#1a221e; --fg:#e6eee9; --muted:#9aa8a0; --line:#2c3832; --green:#4cc38a; --sun:#f29a5c; --oldc:#7d8a84; color-scheme:dark } }
:root[data-theme="dark"] { --bg:#121815; --panel:#1a221e; --fg:#e6eee9; --muted:#9aa8a0; --line:#2c3832; --green:#4cc38a; --sun:#f29a5c; --oldc:#7d8a84; color-scheme:dark }
body { background:var(--bg); color:var(--fg); font-family:var(--body); font-size:15px; line-height:1.5; }
.wrap { max-width:1100px; margin:0 auto; padding-block:28px 60px; padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); display:grid; gap:36px; }
header h1 { font-family:var(--display); font-weight:800; font-size:clamp(26px,4vw,38px); margin:0; letter-spacing:-0.01em; text-wrap:balance; }
header h1 span { color:var(--green); }
header p { color:var(--muted); max-width:68ch; margin:8px 0 0; }
.legend { display:flex; flex-wrap:wrap; gap:8px 18px; font-size:13px; color:var(--muted); margin-top:14px; }
.legend i { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:6px; vertical-align:-1px; }
nav { display:flex; flex-wrap:wrap; gap:8px; }
nav a { font-size:13px; font-weight:600; color:var(--green); text-decoration:none; border:1px solid var(--line); border-radius:999px; padding:4px 12px; background:var(--panel); }
nav a:focus-visible, nav a:hover { border-color:var(--green); outline:none; }
section { display:grid; gap:18px; }
h2 { font-family:var(--display); font-weight:700; font-size:22px; margin:0; border-bottom:2px solid var(--green); padding-bottom:6px; text-wrap:balance; }
.day { display:grid; gap:8px; }
h3 { font-family:var(--display); font-size:16px; margin:0; }
.frame { margin:0; color:var(--muted); font-size:13px; }
.pair { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.pair.solo { grid-template-columns:minmax(0, 640px); }
@media (max-width:760px) { .pair { grid-template-columns:1fr; } }
.col { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:14px 16px; min-width:0; }
.col.new { border-color:var(--green); }
h4 { margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.08em; color:var(--oldc); }
.col.new h4 { color:var(--green); }
.meta { margin:4px 0 10px; font-size:13px; color:var(--muted); }
.meta b.ok { color:var(--green); font-weight:600; } .meta b.tight { color:var(--sun); font-weight:600; }
ol { list-style:none; margin:0; padding:0; display:grid; gap:2px; }
li { display:grid; grid-template-columns:68px 1fr; gap:8px; font-size:14px; font-variant-numeric:tabular-nums; }
li .t { color:var(--muted); font-size:13px; }
li.ride { color:var(--muted); font-size:12px; } li.ride .alt { color:var(--green); } li.ride span:last-child { padding-left:10px; border-left:2px dotted var(--line); }
li.start, li.end { font-weight:600; }
li.meal span:last-child, li.evening span:last-child { color:var(--sun); }
li small { color:var(--muted); }
li em { font-style:normal; font-size:11px; color:var(--muted); border:1px solid var(--line); border-radius:4px; padding:0 5px; margin-left:4px; white-space:nowrap; }
li.added em { color:var(--green); border-color:var(--green); }
.warn { color:var(--sun); font-size:12px; }
.why li { display:list-item; font-size:13px; }
.why { margin:10px 0 0; padding:8px 0 0 18px; border-top:1px solid var(--line); font-size:13px; color:var(--muted); }
.none { color:var(--muted); }
footer { color:var(--muted); font-size:12px; }
</style>
<div class="wrap">
<header><h1>The new engine, <span>side by side</span></h1>
<p>Each day shows the plan the current app makes (left) next to the plan the new Beta 2 engine makes from exactly the same trip facts (right). Both were made by the engines themselves from saved free-source data: nothing written by hand, no AI.</p>
<div class="legend"><span><i style="background:var(--green)"></i>New engine</span><span><i style="background:var(--oldc)"></i>Old engine</span><span><i style="background:var(--sun)"></i>Meals and tight spots</span></div></header>
<nav>${names.map(n => { const { s, file } = load(n); return `<a href="#${esc(file)}">${esc((s.label || file).split(':')[0])}</a>`; }).join('')}</nav>
${sections.join('\n')}
<footer>Times use the engines' own steady travel estimates. Entrance fees and tickets are not included. Made ${new Date().toISOString().slice(0, 10)} from the Beta 2 branch.</footer>
</div>`;
fs.writeFileSync(out, html);
console.log('wrote', out, html.length, 'bytes');
