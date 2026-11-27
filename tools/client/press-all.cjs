// Every button pressed (class rule R-38, Nov 27 2026). Richard: "Can we have Fable push all buttons", the day he found
// three broken controls a tap would have caught (Choose sights jumping, a ferry choice refused, an address lookup dead).
// The older tap sweep (tools/ui/tap-check.cjs) used one trip, never typed in a field, skipped anything it could not
// reach from the first screen, and was never part of the release gate.
//
// This check opens the app as a traveler holds it (phone and tablet, touch screen) on several trips and, on every
// screen of each, finds EVERY control (buttons, links, folds, tick boxes, fields, pick lists, anything that takes a
// finger) and presses each one with a real touch at the spot a finger would land. Whatever a press reveals (a form, a
// dialog, a new step) is searched and pressed too, to four presses deep. Fields are typed in (a usual value, nothing
// at all, and an odd one); pick lists are set to each choice. Before each press the app is put back exactly as it was,
// so nothing a press does (delete the trip, erase data) carries to the next.
//
// For every press it records what the control DID (screen changed, fold opened, words added or taken away, a share
// sheet, a print, a sound, a new page, a lookup) and holds these rules, the same on every screen and every trip:
//   ERROR     the app threw an error.
//   DEAD      nothing a traveler can see, hear or get happened.
//   COVERED   a finger cannot reach it: something else lies over the spot.
//   JUMP      what was tapped moved more than 48 px from under the finger while the screen stayed the same screen.
//   STUCK     a spinner or "busy" still showing 15 s later.
//   WIDE      the page became wider than the screen.
//   BROKEN    the screen shows "undefined", "NaN", "[object Object]" or is blank after the press.
//   LOST      after an odd value was typed, the app no longer opens on reload.
//   EXPECT    the control did not do what its own label says (the table in press-expect.cjs: one line per control kind).
//   UNTRUE    (runs with no internet) the screen says a place "couldn't be found" when the lookup never got an answer.
//   LINK      (live runs) a link the app offers does not open (page not found, no such site).
// And the coverage rule that makes it permanent: every action name in the built app (every data-act) must have been
// pressed in the run, or be listed in press-expect.cjs with the reason it cannot be; anything else is NOT PRESSED and
// fails. A new button nobody presses fails the gate.
//
// No AI, no spend: the helper's AI and paid paths are refused at the network layer; group trips use the helper's own
// code in this process, so nothing is written to the live helper. Live runs keep each lookup's answer for the run, so a
// lookup reaches the helper once however many times a press repeats it.
//
// Usage: node tools/client/press-all.cjs [beta2-site/index.html | https://gilsonr0566-sys.github.io/Kairoute-Beta2/]
//   TRIPS=first,example,during,rail,port,ferry,group,odd   SIZES=phone,tablet   ROOTS=plan,sites (name parts)
//   PART=1/4 (split the screens)   MAXDEPTH=4   OUT=press-out   POOL=3   PLANT=dead|jump|error|covered|wide|broken|untrue   ONLY=<regex on action or label>
// Exit 1 on any failure. Writes OUT/<trip>-<size>[-part].json (every press) and OUT/summary.md.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const ARG = process.argv[2] || 'beta2-site/index.html', LIVE = /^https?:/.test(ARG), ROOT = path.join(__dirname, '..', '..');
const OUT = path.resolve(process.env.OUT || 'press-out'); fs.mkdirSync(OUT, { recursive: true });
const X = require('./press-expect.cjs');
const SIZES = { phone: { viewport: { width: 412, height: 915 } }, tablet: { viewport: { width: 1280, height: 800 } }, upright: { viewport: { width: 800, height: 1280 } } };
const PICK = (process.env.SIZES || 'phone,tablet').split(','), TRIPS = (process.env.TRIPS || 'first,example,during,rail,port,ferry,group,odd').split(',');
const ONLYROOT = (process.env.ROOTS || '').split(',').filter(Boolean), PART = (process.env.PART || '1/1').split('/').map(Number);
const MAXDEPTH = +(process.env.MAXDEPTH || 4), POOL = +(process.env.POOL || 3), PLANT = process.env.PLANT || '', MAXROOT = +(process.env.MAXROOT || 700);
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null; // press only controls whose action or label matches (the proof runs)
const BUDGET = +(process.env.BUDGET_MIN || 0) * 60000, START = Date.now(); // stop pressing after this long: what is left is reported NOT PRESSED
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CORPUS = path.join(ROOT, 'tools', 'beta2', 'corpus');
// The helper's free paths (no AI, no paid lookups). Everything else on the helper is refused (zero spend).
const FREE = new Set(['/sources', '/famous', '/ground', '/places', '/transit', '/route', '/roadway', '/departures', '/ferries', '/weather', '/facts', '/osm', '/findplace', '/nearsights', '/bookcheck', '/voyage', '/x/near', '/islands', '/events', '/ratings']);
// Refused on the live helper: AI (/identify, /sample, /script, /speak, /voiceplan, /verify), anything that may cost (/grating) and anything that writes to it (/rate, /sync, /realuse).

function serve(file) { const dir = path.dirname(file), name = path.basename(file);
  return new Promise(res => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
    if (u === '/__blank') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end('<!doctype html><title>.</title>'); }
    let f = path.join(dir, u === '/' ? name : u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, u);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    const ty = f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : /\.(json|webmanifest)$/.test(f) ? 'application/json' : f.endsWith('.mp3') ? 'audio/mpeg' : 'application/octet-stream';
    r.writeHead(200, { 'content-type': ty }); fs.createReadStream(f).pipe(r); });
    s.listen(0, () => res({ url: 'http://localhost:' + s.address().port + '/', close: () => { s.closeAllConnections && s.closeAllConnections(); s.close(); } })); }); }

// ---- Trips -------------------------------------------------------------------------------------------------------
// A saved test trip as the app keeps it on the device.
function appTrip(name, c) {
  const days = c.days.map(d => { const x = Object.assign({}, d); delete x.i; delete x.sites; delete x.wx; delete x.missing; delete x.order;
    for (const k of ['portArrive', 'allAboard', 'boardAt']) if (typeof x[k] === 'number') x[k] = String(Math.floor(x[k] / 60)).padStart(2, '0') + ':' + String(x[k] % 60).padStart(2, '0'); else if (x[k] == null) delete x[k]; // the saved test trips keep minutes; the app keeps clock times
    for (const k of ['lodging', 'point', 'booked', 'locked', 'thru', 'order', 'only', 'mealAt', 'mealPrefs']) if (x[k] == null || typeof x[k] === 'object') delete x[k];
    x.cityKey = d.city; x.destination = d.city && c.cities[d.city] ? c.cities[d.city].name : d.typed || d.destination || ''; return x; });
  return { trip: { id: 'press-' + name, name: c.name || name, style: c.style || 'mix', active: 0, days, lodging: {}, journal: {}, prefs: c.prefs || {}, legModes: c.legModes || {} }, cities: c.cities };
}
const corpus = n => appTrip(n, JSON.parse(fs.readFileSync(path.join(CORPUS, n + '.json'), 'utf8')));
// Odd and empty input, as a trip already saved: a day with no place, a day with no date, a sea day alone, a name as
// long as a paragraph, markup and other scripts in names, hours of zero and of a whole day, a port day whose ship
// leaves before it arrives.
function oddTrip() {
  const long = 'A very long name that goes on and on '.repeat(8).trim();
  const days = [
    { id: 'o1', date: '2027-03-01', type: 'land', destination: '', hours: 9, startTime: '09:00' },
    { id: 'o2', date: '', type: 'land', destination: 'Lisbon', hours: 0, startTime: '09:00' },
    { id: 'o3', date: '2027-03-03', type: 'sea', destination: 'At sea' },
    { id: 'o4', date: '2027-03-04', type: 'port', destination: long, portArrive: '17:00', allAboard: '08:00' },
    { id: 'o5', date: '2027-03-05', type: 'land', destination: '<img src=x onerror=alert(1)> & "Zürich" 東京 مرحبا', hours: 24, startTime: '00:00' },
    { id: 'o6', date: '2027-03-05', type: 'leave', mode: 'train', time: '03:10', destination: 'Nowhereville-That-Does-Not-Exist' },
    { id: 'o7', date: '1999-12-31', type: 'arrival', mode: 'flight', time: '23:59', destination: 'Vienna' }
  ];
  return { trip: { id: 'press-odd', name: long, style: 'mix', active: 0, days, lodging: {}, journal: {}, prefs: {}, legModes: {} }, cities: {} };
}
// name: [what it is, seed (null = the app's own first open), clock (a time inside the trip, so day-of controls show)]
const TRIPDEF = {
  first: { label: 'First open, no trip yet (intro, new trip steps, example offer)', seed: null, first: true },
  example: { label: 'The example trip: 21 days, cruise port days, a train day, flights (before the trip)', seed: null },
  during: { label: 'The example trip on a port day, 10:40 am, ashore in Heraklion (countdown, live controls)', seed: null, clock: '2027-07-05T10:40:00+03:00', only: /plan|guide|tour|trip$|lobby/ },
  rail: { label: 'Rail trip: Vienna then Prague by train' + (LIVE ? ' (entered in the app\'s own new-trip form)' : ' (saved test trip: Vienna)'), seed: () => corpus('g02-vienna'),
    legs: [{ k: 'stay', place: 'Vienna', date: '2027-06-14', nights: 2, hotel: 'Hotel Sacher', inBy: 'train', inAt: '11:00' }, { k: 'stay', place: 'Prague', date: '2027-06-16', nights: 2, inBy: 'train', leaveAt: '09:10', inAt: '13:20', homeBy: 'train', homeAt: '15:00' }], only: /plan|sites|guide|tour|trip$/ },
  port: { label: LIVE ? 'Cruise: Athens, Kotor (tender), Naples, ends in Barcelona (entered in the app\'s own new-trip form)' : 'Cruise port day: Kotor (saved test trip, pier not yet chosen)', seed: () => corpus('g09-kotor'),
    legs: [{ k: 'cruise', board: 'Athens', ship: 'Sun Princess', date: '2027-07-04', aboard: '17:00', inBy: 'flight', inAt: '09:30', ports: [{ date: '2027-07-06', place: 'Kotor', arrive: '08:00', aboard: '17:00', tender: true }, { date: '2027-07-08', place: 'Naples', arrive: '07:00', aboard: '18:30' }], end: 'Barcelona', endDate: '2027-07-10', off: '07:00', homeBy: 'flight', homeAt: '14:00' }], only: /plan|sites|guide|tour|trip$/ },
  ferry: { label: LIVE ? 'Boat days: three nights in Naples, by ferry, at a rental address (entered in the app\'s own new-trip form)' : 'Boat day: Naples, Capri and Sorrento (saved test trip)', seed: () => corpus('f01-naples-capri'),
    legs: [{ k: 'stay', place: 'Naples', date: '2027-06-09', nights: 3, hotel: 'Via Toledo 148', inBy: 'ferry', inAt: '10:00', homeBy: 'flight', homeAt: '16:00' }], only: /plan|sites|guide|tour|trip$/ },
  group: { label: 'Group trip: the example trip shared as a group (owner)', seed: null, group: true, only: /plan|guide|settings|trip$|tour/ },
  odd: { label: 'Odd and empty input: no place, no date, sea day alone, very long and marked-up names, impossible times', seed: oddTrip }
};

// ---- In the page -------------------------------------------------------------------------------------------------
// Runs before the app on every load: keeps the real storage, seeds the trip once, and records everything a press can
// cause that is not on the page itself (print, share, copy, sound, a new window, a file, the camera, a lookup).
const PROBE = ([seed, first, plant]) => {
  const ls = window.localStorage; window.__realLS = ls;
  try { if (location.pathname.endsWith('/__blank') || /version\.txt$/.test(location.pathname)) return;
    if (!ls.getItem('b2:__copied')) { ls.setItem('b2:__copied', '1'); ls.setItem('b2:__merged2', '1');
      if (seed) { ls.setItem('b2:wayside.trip2', seed.trip); ls.setItem('b2:wayside.cities', seed.cities); }
      if (!first) ['lobbySeen', 'intro1', 'sunprincess1', 'spread1', 'bible1', 'coach1', 'coachDone', 'tourTip'].forEach(k => ls.setItem('b2:kairoute.' + k, '1')); } } catch (e) {}
  const P = window.__press = { fx: [], errs: [], shifts: [], lastMut: 0 };
  const fx = (k, v) => P.fx.push(k + (v ? ': ' + String(v).slice(0, 90) : ''));
  addEventListener('error', e => P.errs.push(String(e.message || e.error || 'error').slice(0, 240)));
  addEventListener('unhandledrejection', e => P.errs.push('promise: ' + String(e.reason && (e.reason.message || e.reason) || '').slice(0, 220)));
  try { window.print = () => fx('print'); } catch (e) {}
  try { Object.defineProperty(navigator, 'share', { configurable: true, value: d => { fx('share', d && (d.title || d.text || d.url || (d.files && 'file'))); return Promise.resolve(); } }); Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true }); } catch (e) {}
  try { const c = navigator.clipboard || {}; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: Object.assign(Object.create(c), { writeText: t => { fx('copy', t); return Promise.resolve(); }, write: () => { fx('copy'); return Promise.resolve(); } }) }); } catch (e) {}
  try { const o = window.open; window.open = (u, ...a) => { fx('opens', u); return null; }; } catch (e) {}
  try { const pl = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { fx('sound', (this.currentSrc || this.src || '').split('/').pop()); try { const r = pl.call(this); if (r && r.catch) r.catch(() => {}); return r; } catch (e) { return Promise.resolve(); } };
    const pa = HTMLMediaElement.prototype.pause; HTMLMediaElement.prototype.pause = function () { if (!this.paused) fx('sound stops'); return pa.call(this); }; } catch (e) {}
  try { if (window.speechSynthesis) { const sp = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = u => { fx('speaks', u && u.text); try { sp(u); } catch (e) {} }; const cn = speechSynthesis.cancel.bind(speechSynthesis); let spoke = false; speechSynthesis.cancel = () => { try { cn(); } catch (e) {} }; } } catch (e) {}
  try { const ac = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { fx(this.download ? 'file' : 'opens', this.download || this.href); if (!this.download && this.target === '_blank') return; if (this.download) return; return ac.call(this); }; } catch (e) {}
  try { const ic = HTMLInputElement.prototype.click; HTMLInputElement.prototype.click = function () { if (this.type === 'file') { fx('file picker'); return; } return ic.call(this); };
    if (HTMLInputElement.prototype.showPicker) HTMLInputElement.prototype.showPicker = function () { fx('picker', this.type); }; } catch (e) {}
  try { const md = navigator.mediaDevices; if (md) md.getUserMedia = () => { fx('camera or microphone'); return Promise.reject(new DOMException('no camera in this test', 'NotFoundError')); }; } catch (e) {}
  try { const g = navigator.geolocation; if (g) { const gp = g.getCurrentPosition.bind(g), wp = g.watchPosition.bind(g); g.getCurrentPosition = (...a) => { fx('asks where you are'); return gp(...a); }; g.watchPosition = (...a) => { fx('follows where you are'); return wp(...a); }; } } catch (e) {}
  try { const f = window.fetch; window.fetch = function (u, o) { try { const s = String(u && u.url || u); if (!/^data:|^blob:/.test(s)) { const q = new URL(s, location.href); if (q.origin !== location.origin || !/\.(mp3|json|txt|js)$/.test(q.pathname)) fx('lookup', q.hostname.replace(/^[^.]*\.([^.]*\.workers\.dev)$/, 'helper') .replace(/.*workers\.dev$/, 'helper') + q.pathname.slice(0, 40)); else if (/\.mp3$/.test(q.pathname)) fx('loads sound', q.pathname.split('/').pop()); } } catch (e) {} return f.apply(this, arguments); }; } catch (e) {}
  try { const fs0 = Element.prototype.requestFullscreen; if (fs0) Element.prototype.requestFullscreen = function () { fx('full screen'); return Promise.resolve(); }; } catch (e) {}
  try { if (window.Notification) Notification.requestPermission = () => { fx('asks to send notices'); return Promise.resolve('denied'); }; } catch (e) {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) P.shifts.push({ t: e.startTime, v: e.value, input: e.hadRecentInput }); }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
  const live = n => { const e = n && (n.nodeType === 1 ? n : n.parentElement); return !!(e && e.closest && e.closest('[role=status], [aria-live], .clock, .countdown, time, .spinner')); };
  const start = () => new MutationObserver(m => { if (m.some(r => !live(r.target))) P.lastMut = performance.now(); }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start);

  const Q = 'button, a[href], summary, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=switch], [role=checkbox], [role=link], [data-act], [data-day], [contenteditable=""], [contenteditable=true]';
  const vis = e => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; if (e.checkVisibility && !e.checkVisibility({ visibilityProperty: true })) return false; return !e.closest('[hidden], [inert], .maplibregl-canvas-container, .maplibregl-ctrl-attrib'); };
  const norm = s => String(s || '').trim().replace(/\s+/g, ' ');
  const label = e => norm(e.innerText || e.getAttribute('aria-label') || e.getAttribute('title') || e.placeholder || (e.labels && e.labels[0] && e.labels[0].innerText) || e.name || e.id || '').slice(0, 60);
  const kind = e => { const t = e.tagName, ty = (e.getAttribute('type') || '').toLowerCase();
    if (t === 'SELECT') return 'select'; if (t === 'TEXTAREA' || e.isContentEditable) return 'field';
    if (t === 'INPUT') return ty === 'checkbox' || ty === 'radio' ? 'check' : ty === 'file' ? 'file' : ty === 'range' ? 'range' : /^(button|submit|reset|image)$/.test(ty) ? 'tap' : /^(date|time|datetime-local|month|week|color)$/.test(ty) ? 'pick' : 'field';
    if (t === 'SUMMARY') return 'fold'; if (t === 'A') return 'link'; return 'tap'; };
  const data = e => Object.keys(e.dataset || {}).filter(k => !/^(feel|press)/.test(k)).sort().map(k => k + '=' + String(e.dataset[k]).slice(0, 40)).join(',');
  const sigOf = e => [e.tagName.toLowerCase() + (e.getAttribute('type') ? ':' + e.getAttribute('type') : ''), data(e), (e.id && !/\d{4,}/.test(e.id) ? '#' + e.id : ''), label(e).replace(/\d+/g, '#')].join('|');
  P.all = () => { const els = [...document.querySelectorAll(Q)].filter(vis);
    // Anything else that takes a finger: an element that shows the pointing hand and is not inside a control already listed.
    const set = new Set(els); document.querySelectorAll('#view *, .sheet *, dialog *, .modal *, header *, nav *').forEach(e => { if (set.has(e) || e.closest(Q)) return; if (getComputedStyle(e).cursor !== 'pointer') return; if (e.parentElement && getComputedStyle(e.parentElement).cursor === 'pointer' && !set.has(e.parentElement) && !e.parentElement.closest(Q)) return; if (e.tagName === 'LABEL' && e.control && set.has(e.control)) return; if (vis(e)) { els.push(e); set.add(e); } });
    // A dialog that fills the screen (the intro, a full-screen sheet): only what is in it can be pressed until it is
    // closed; what lies behind is pressed after the press that closes it.
    const top = [...document.querySelectorAll('.coach, dialog[open], .film, .sheet, .modal, [role=dialog]')].filter(o => { if (!vis(o)) return false; const r = o.getBoundingClientRect(); return r.width * r.height >= innerWidth * innerHeight * 0.8; }).pop();
    return top ? els.filter(e => top.contains(e)) : els; };
  // The empty fields a button belongs to (the same small form, row or card): a traveler fills them before pressing it.
  const TEXTY = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not([type=button]):not([type=submit]), textarea';
  P.beside = e => { let box = e.parentElement; for (let k = 0; k < 4 && box && box.id !== 'view' && box !== document.body; k++, box = box.parentElement) { const fs = [...box.querySelectorAll(TEXTY)].filter(f => vis(f) && !f.disabled && !f.readOnly); if (fs.length) return fs.length <= 6 ? fs.filter(f => !f.value) : []; if (/^(FORM|DIALOG|FIELDSET)$/.test(box.tagName) || /(^|\s)(card|sheet|modal|ask)(\s|$)/.test(typeof box.className === 'string' ? box.className : '')) break; } return []; };
  P.besideList = (sig, n) => { const e = P.find(sig, n); if (!e) return []; return P.beside(e).map(f => { f.setAttribute('data-press-fill', '1'); return { type: (f.getAttribute('type') || '').toLowerCase(), id: f.id || '', label: label(f), ph: f.placeholder || '', kind: kind(f), mode: f.getAttribute('inputmode') || '', tag: f.tagName.toLowerCase() }; }); };
  P.besideFill = vals => { const fs = [...document.querySelectorAll('[data-press-fill]')]; fs.forEach((f, i) => { f.removeAttribute('data-press-fill'); const set = Object.getOwnPropertyDescriptor(f.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set; f.focus({ preventScroll: true }); set.call(f, vals[i]); f.dispatchEvent(new Event('input', { bubbles: true })); }); return fs.length; };
  P.find = (sig, n) => { let k = 0; for (const e of P.all()) if (sigOf(e) === sig) { if (k === n) return e; k++; } return null; };
  P.controls = () => { const seen = new Map();
    return P.all().map(e => { const sig = sigOf(e), n = seen.get(sig) || 0; seen.set(sig, n + 1); const r = e.getBoundingClientRect();
      const cur = !!e.closest('[aria-selected=true], [aria-current]:not([aria-current=false]), [aria-pressed=true]') || /(^|\s)(on|active|sel|cur|current|picked)(\s|$)/.test(typeof e.className === 'string' ? e.className : '');
      const chrome = !!e.closest('header, nav, .tabs, .tabbar, .dayrow, .daystrip, .topbar, .appbar');
      return { sig, n, kind: kind(e), label: label(e), act: e.dataset.act || '', data: data(e), tag: e.tagName.toLowerCase(), type: (e.getAttribute('type') || '').toLowerCase(), id: e.id || '', off: !!(e.disabled || e.getAttribute('aria-disabled') === 'true'), cur, chrome,
        fillN: /^(tap|link)$/.test(kind(e)) ? P.beside(e).length : 0, href: e.tagName === 'A' ? e.getAttribute('href') || '' : '', target: e.tagName === 'A' ? e.target || '' : '', w: Math.round(r.width), h: Math.round(r.height), inMap: !!e.closest('.maplibregl-map, .leaflet-container'),
        opts: e.tagName === 'SELECT' ? [...e.options].map(o => o.value) : undefined, val: 'value' in e ? String(e.value).slice(0, 60) : undefined, max: e.getAttribute('max'), min: e.getAttribute('min'), ph: e.placeholder || '', mode: e.getAttribute('inputmode') || '' }; }); };
  // Bring it under the finger: mid-screen first, then nearer an edge if a pinned bar lies over it. Returns the spot
  // a finger lands on, or what covers it.
  P.aim = (sig, n) => { const e = P.find(sig, n); if (!e) return { gone: true };
    const hitOk = (x, y) => { const h = document.elementFromPoint(x, y); if (!h) return null; if (e === h || e.contains(h) || h.contains(e) && h.closest('label, button, summary, a')) return true; const lab = h.closest('label'); if (lab && (lab.control === e || lab.contains(e))) return true; return h; };
    let cover = null;
    for (const block of ['center', 'end', 'start', 'nearest']) { e.scrollIntoView({ block, inline: 'center', behavior: 'instant' }); const r = e.getBoundingClientRect();
      const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + Math.min(r.width / 2, 14), r.top + r.height / 2], [r.right - Math.min(r.width / 2, 14), r.top + r.height / 2]];
      for (const [x, y] of pts) { if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue; const ok = hitOk(x, y); if (ok === true) { e.setAttribute('data-press-me', '1'); P.anchor(e, x, y); return { x, y, top: r.top, left: r.left, w: r.width, h: r.height }; } if (ok) cover = ok; } }
    const r = e.getBoundingClientRect(); return { covered: cover ? (cover.tagName.toLowerCase() + (cover.id ? '#' + cover.id : '') + (typeof cover.className === 'string' && cover.className ? '.' + cover.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ' "' + norm(cover.innerText).slice(0, 40) + '"') : 'off the screen (' + Math.round(r.left) + ',' + Math.round(r.top) + ')' }; };
  // What the traveler is looking at just above the finger: a thing on screen that scrolls with the page and is no part
  // of the control. If IT moves after the press, the screen moved (JUMP); if only the control moves, something opened
  // or was added right at the finger (a list growing where its Add button was), which is what the traveler asked for.
  P.anchor = (e, x, y) => { document.querySelectorAll('[data-press-anchor]').forEach(a => a.removeAttribute('data-press-anchor'));
    const pinned = n => { for (let a = n; a && a !== document.body; a = a.parentElement) { const p = getComputedStyle(a).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
    for (const dy of [28, 60, 100, 150, 220]) for (const xx of [x, innerWidth / 2, innerWidth * 0.25]) { const yy = y - dy; if (yy < 4) continue; let h = document.elementFromPoint(xx, yy); if (!h || h === document.body || h === document.documentElement || h.id === 'view' || e.contains(h) || h.contains(e) || pinned(h)) continue; if (h.getBoundingClientRect().height > innerHeight * 0.6) continue; h.setAttribute('data-press-anchor', '1'); const key = h.tagName + '|' + norm(h.textContent).slice(0, 80); let k = 0; for (const o of document.querySelectorAll(h.tagName)) { if (o === h) break; if (o.tagName + '|' + norm(o.textContent).slice(0, 80) === key) k++; } P.anchorKey = [key, k]; return; } P.anchorKey = null; };
  // The same thing after a redraw replaced it: found again by what it is and says.
  P.anchorNow = () => { let a = document.querySelector('[data-press-anchor]'); if (a && a.isConnected) return a; if (!P.anchorKey) return null; let k = 0; for (const o of document.querySelectorAll(P.anchorKey[0].split('|')[0])) if (o.tagName + '|' + norm(o.textContent).slice(0, 80) === P.anchorKey[0]) { if (k === P.anchorKey[1]) return o; k++; } return null; };
  P.where = (sig, n) => { let e = document.querySelector('[data-press-me]'); if (!e || !e.isConnected) e = null; const same = !!e; if (!e) e = P.find(sig, n); if (!e) { const a = P.anchorNow(); return a && vis(a) ? { top: 0, left: 0, same: false, shown: false, sy: P.sy(), anchor: a.getBoundingClientRect().top } : null; } const r = e.getBoundingClientRect(); const a = P.anchorNow(); return { top: r.top, left: r.left, same, shown: vis(e), sy: P.sy(), anchor: a && vis(a) ? a.getBoundingClientRect().top : null }; };
  // How far the part of the screen the traveler scrolls is scrolled (the page on a phone, the list pane on a tablet).
  P.sy = () => { const ps = [...document.querySelectorAll('.pane, main, #view, dialog[open], .sheet')].filter(x => x.scrollHeight > x.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(x).overflowY)); return Math.round(scrollY + ps.reduce((a, x) => a + x.scrollTop, 0)); };
  P.hash = () => { let h = 2166136261, n = 0; try { const keys = []; for (let i = 0; i < ls.length; i++) keys.push(ls.key(i)); keys.sort(); for (const k of keys) { const v = ls.getItem(k) || ''; n += v.length; const step = v.length > 20000 ? 97 : 1; for (let i = 0; i < v.length; i += step) h = Math.imul(h ^ v.charCodeAt(i), 16777619); h = Math.imul(h ^ k.length, 16777619); } } catch (e) {} return (h >>> 0) + ':' + n; };
  P.unmark = () => document.querySelectorAll('[data-press-me], [data-press-anchor]').forEach(e => { e.removeAttribute('data-press-me'); e.removeAttribute('data-press-anchor'); });
  P.look = () => { const st = (() => { try { const s = window.__kairouteState(); return { view: s.view, busy: s.busy, err: s.err }; } catch (e) { return {}; } })();
    const v = document.getElementById('view') || document.body;
    return { view: st.view || '', err: st.err || '', text: document.body.innerText, folds: [...document.querySelectorAll('details')].map(d => d.open ? 1 : 0).join(''),
      over: [...document.querySelectorAll('dialog[open], .modal, .sheet, [role=dialog], .coach, .film, .toast')].filter(x => x.offsetParent || x.open || (x.getBoundingClientRect().width && getComputedStyle(x).display !== 'none' && getComputedStyle(x).visibility !== 'hidden')).map(x => (x.id || (typeof x.className === 'string' ? x.className : x.tagName)).slice(0, 30)).join(','),
      marks: [...document.querySelectorAll('[aria-pressed], [aria-selected], [aria-expanded], [aria-checked], input[type=checkbox], input[type=radio], .on, .sel, .active')].map(e => (e.getAttribute('aria-pressed') || '') + (e.getAttribute('aria-selected') || '') + (e.getAttribute('aria-expanded') || '') + (e.checked ? 'c' : '') + (typeof e.className === 'string' ? e.className.length : '')).join('|'),
      vals: [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea')].map(e => e.value).join('\u0001'),
      hash: location.hash, y: Math.round(scrollY) + ';' + [...document.querySelectorAll('.pane, main, #view, dialog, .sheet')].map(p => Math.round(p.scrollTop)).join(','), cls: document.documentElement.className + ' / ' + document.body.className, style: (document.documentElement.getAttribute('style') || '') + (document.documentElement.getAttribute('data-theme') || '') + getComputedStyle(document.documentElement).fontSize,
      focus: document.activeElement && document.activeElement !== document.body ? document.activeElement.tagName + '#' + document.activeElement.id : '', title: document.title,
      wide: Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, ...[...document.querySelectorAll('#view, .pane, main, dialog[open], .sheet')].filter(x => x.clientWidth > 0 && getComputedStyle(x).overflowX !== 'hidden' && getComputedStyle(x).overflowX !== 'clip').map(x => x.scrollWidth - x.clientWidth)), blank: !norm(v.innerText) && !v.querySelector('canvas, img, video, svg'),
      spin: [...document.querySelectorAll('.spinner, [aria-busy=true]')].filter(x => x.offsetParent && (!x.checkVisibility || x.checkVisibility({ visibilityProperty: true, opacityProperty: true }))).map(x => norm((x.parentElement || x).innerText).slice(0, 70)),
      media: [...document.querySelectorAll('audio, video')].map(m => m.paused ? 0 : 1).join('') + (window.speechSynthesis && speechSynthesis.speaking ? 's' : '') }; };
  // Planted defects: each a way this class has gone wrong; the check must catch every one (PLANT=...).
  if (plant) addEventListener('DOMContentLoaded', () => {
    if (plant === 'dead') window.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-act="mealopen"], [data-act="tixdone"]'); if (t) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    if (plant === 'error') document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-act="daytitle"]')) setTimeout(() => { throw new Error('planted error'); }, 0); }, true);
    if (plant === 'jump') window.addEventListener('click', e => { if (e.target.closest && e.target.closest('input[type=checkbox], label') && /sites/.test((window.__kairouteState && window.__kairouteState().view) || '')) setTimeout(() => { const v = document.getElementById('view'); v.style.paddingTop = (parseInt(v.style.paddingTop || '0', 10) + 160) + 'px'; }, 500); /* after the app's own redraw has kept its place */ }, true);
    if (plant === 'covered') { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:100%;z-index:99999;background:rgba(0,0,0,.01)'; d.className = 'plantedcover'; const put = () => { if (!document.querySelector('.plantedcover') && /sites/.test((window.__kairouteState && window.__kairouteState().view) || '')) document.body.appendChild(d); else if (document.querySelector('.plantedcover') && !/sites/.test((window.__kairouteState && window.__kairouteState().view) || '')) d.remove(); }; setInterval(put, 200); }
    if (plant === 'wide') document.addEventListener('click', e => { if (e.target.closest && e.target.closest('summary')) setTimeout(() => { document.documentElement.style.minWidth = '900px'; document.body.style.minWidth = '900px'; }, 60); }, true);
    if (plant === 'untrue') document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-act="mealopen"]')) setTimeout(() => { const v = document.getElementById('view'); const p = document.createElement('p'); p.textContent = "I couldn't find any place to eat near here."; v.insertBefore(p, v.firstChild); }, 60); }, true);
    if (plant === 'broken') document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-act="hrsopen"]')) setTimeout(() => { const h = document.querySelector('#view h2, #view h1, #view .dayhead'); if (h) h.append(' undefined'); }, 50); }, true);
  });
};

// ---- One browser page that can be put back to the start state --------------------------------------------------
async function makeLane(browser, base, size, def, snapshotRef, helper) {
  const D = SIZES[size];
  const opts = { viewport: D.viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 1, locale: 'en-US', timezoneId: def.clock ? 'Europe/Athens' : 'America/Chicago', serviceWorkers: 'block', geolocation: { latitude: 35.3387, longitude: 25.1442, accuracy: 20 }, permissions: ['geolocation'] };
  const ctx = await browser.newContext(opts);
  const seed = def.seed && !(LIVE && def.legs) ? (s => ({ trip: JSON.stringify(s.trip), cities: JSON.stringify(s.cities) }))(def.seed()) : null;
  await ctx.addInitScript(PROBE, [seed, !!def.first, PLANT]);
  const lane = { ctx, popups: [], dialogs: [], downloads: 0, net: {}, refused: {} };
  await ctx.route('**/*', async r => { const req = r.request(), url = req.url(); let u; try { u = new URL(url); } catch (e) { return r.abort(); }
    if (url.startsWith(base) || /^(data|blob):/.test(url)) return r.continue();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (/workers\.dev$/.test(u.hostname) || /^helper\.test$/.test(u.hostname)) { const p = u.pathname;
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
      if (p === '/status') return r.fulfill({ contentType: 'application/json', headers: cors, body: JSON.stringify({ ok: true, on: false, left: 0, budget: 0 }) });
      if (p.startsWith('/x/group')) { const o = await helper(url, req.method(), req.postData()); return r.fulfill({ status: o.status, contentType: 'application/json', headers: cors, body: o.body }); }
      if (LIVE && (FREE.has(p) || (p === '/guide' && req.method() === 'GET'))) { const key = req.method() + ' ' + url + ' ' + (req.postData() || '');
        if (!helper.memo.has(key)) helper.memo.set(key, (async () => { try { const a = await ctx.request.fetch(req, { timeout: 30000 }); return { status: a.status(), headers: Object.assign({}, a.headers(), cors), body: await a.body() }; } catch (e) { return null; } })());
        const a = await helper.memo.get(key); lane.net[p] = (lane.net[p] || 0) + 1; if (!a) { helper.memo.delete(key); return r.abort(); } return r.fulfill(a); }
      lane.refused[p] = (lane.refused[p] || 0) + 1; return r.fulfill({ status: LIVE ? 429 : 503, contentType: 'application/json', headers: cors, body: '{"error":"off in this test"}' }); }
    if (!LIVE) { if (/\/ai\.json$/.test(u.pathname)) return r.fulfill({ status: 503, body: '' }); return r.fulfill({ status: 503, body: '' }); }
    return r.continue(); });
  const p = lane.p = await ctx.newPage();
  if (def.clock) await p.clock.setFixedTime(new Date(def.clock));
  ctx.on('page', pg => { if (pg === p) return; lane.popups.push(pg.url()); pg.waitForLoadState('domcontentloaded', { timeout: 4000 }).catch(() => {}).then(() => { const u = pg.url(); if (u && u !== 'about:blank') lane.popups[lane.popups.length - 1] = u; return pg.close().catch(() => {}); }); });
  p.on('dialog', d => { lane.dialogs.push(d.type() + ': ' + d.message().slice(0, 80)); (d.type() === 'prompt' ? d.accept('Test') : d.accept()).catch(() => {}); });
  p.on('download', () => lane.downloads++);
  lane.pageerrs = []; p.on('pageerror', e => lane.pageerrs.push(String(e.message).slice(0, 240)));
  const ready = async () => { await p.waitForFunction(() => !!window.__kairouteGo && !!document.querySelector('#view'), null, { timeout: 30000 }); };
  lane.blank = base + (LIVE ? 'version.txt' : '__blank');
  lane.boot = async () => { await p.goto(base, { waitUntil: 'domcontentloaded' }); await ready(); await sleep(LIVE ? 2500 : 600); };
  // Back to the start: the saved state written again on an empty page of the same site (so nothing the old page still
  // writes can undo it), then the app opened fresh.
  lane.reset = async () => { lane.fresh = false;
    for (let k = 0; k < 3; k++) { try {
      await p.goto(lane.blank, { waitUntil: 'domcontentloaded' });
      await p.evaluate(s => { const ls = window.__realLS || localStorage; ls.clear(); for (const k in s) ls.setItem(k, s[k]); try { sessionStorage.clear(); } catch (e) {} }, snapshotRef.s);
      await p.goto(base, { waitUntil: 'domcontentloaded' }); await ready(); lane.fresh = true; lane.popups = []; lane.dialogs = []; lane.downloads = 0; lane.pageerrs = []; return; } catch (e) { lane.lastErr = String(e.message).split('\n')[0]; await sleep(500); } }
    throw new Error('the app did not open again: ' + lane.lastErr); };
  return lane;
}

// The helper's own code for group trips and device sync, run here: nothing is written to the live helper.
async function localHelper() { const mem = new Map(); let extras = null; try { extras = await import(path.join(ROOT, 'worker', 'extras.js')); } catch (e) {}
  const kv = { async get(k, t) { const v = mem.has(k) ? mem.get(k) : null; return v != null && t === 'json' ? JSON.parse(v) : v; }, async put(k, v) { mem.set(k, String(v)); }, async delete(k) { mem.delete(k); }, async list() { return { keys: [...mem.keys()].map(name => ({ name })), list_complete: true }; } };
  const h = async (url, method, body) => { if (!extras) return { status: 503, body: '{}' }; try { const u = new URL(url); const req = new Request(url, { method, body: /GET|HEAD/.test(method) ? undefined : body, headers: { 'content-type': 'application/json' } });
      const r = await extras.extras(req, { USAGE: kv, EXTRAS: kv, AI_ON: '0' }, { waitUntil() {} }, u, {}, { origin: null, ALLOWED: [] }); return { status: r.status, body: await r.text() }; } catch (e) { return { status: 500, body: JSON.stringify({ error: String(e.message) }) }; } };
  h.memo = new Map(); return h; }

// ---- Pressing ----------------------------------------------------------------------------------------------------
const lines = t => String(t || '').split('\n').map(s => s.trim()).filter(Boolean);
function diffText(a, b) { const A = new Map(), add = [], gone = []; for (const l of lines(a)) A.set(l, (A.get(l) || 0) + 1); const B = new Map(); for (const l of lines(b)) B.set(l, (B.get(l) || 0) + 1);
  for (const [l, n] of B) if ((A.get(l) || 0) < n) add.push(l); for (const [l, n] of A) if ((B.get(l) || 0) < n) gone.push(l); return { add, gone }; }
// A real street address in each test city (for the hotel or rental lookup), by the day's place.
const ADDR = { athens: 'Ermou 12', vienna: 'Kärntner Straße 10', kotor: 'Stari Grad 317', naples: 'Via Toledo 148', sorrento: 'Via Capo 12', lisbon: 'Rua Augusta 100', barcelona: 'Carrer de Mallorca 401', madrid: 'Calle de Alcalá 50', heraklion: '25is Avgoustou 10', rome: 'Via del Corso 126' };
const HOTEL = { athens: 'Hotel Grande Bretagne', vienna: 'Hotel Sacher', naples: 'Grand Hotel Vesuvio', lisbon: 'Hotel Avenida Palace', barcelona: 'Hotel Majestic', madrid: 'Hotel Ritz', rome: 'Hotel Artemide', kotor: 'Hotel Vardar' };
const VALUES = (c, ctx) => { // what a traveler would type, nothing at all, and an odd value
  const dk = String((ctx && ctx.dest) || '').toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
  const cityOf = t => Object.keys(t).find(k => dk.includes(k));
  const t = c.type, id = (c.id + ' ' + c.label + ' ' + c.ph).toLowerCase(), odd = '<b>"Zürich" & 東京 مرحبا 🚢</b> ' + 'x'.repeat(220);
  if (c.kind === 'pick') return t === 'date' ? ['2027-07-05', '', '1900-01-01'] : t === 'time' ? ['10:30', ''] : t === 'month' ? ['2027-07'] : ['2027-07-05T10:30'];
  if (t === 'number' || c.mode === 'numeric' || c.mode === 'decimal') return ['3', '', '-5'];
  if (t === 'email') return ['traveler@example.com', '', 'not-an-email'];
  if (t === 'tel') return ['+1 312 555 0100', '', 'abc'];
  if (t === 'url') return ['https://example.com', '', 'not a link'];
  if (/code/.test(id)) return ['ABC-234', '', '!!!', odd];
  if (/hotel|rental|staying|address|lodg/.test(id)) return [ADDR[cityOf(ADDR)] || '12 Main Street', HOTEL[cityOf(HOTEL)] || 'Grand Hotel', '', odd];
  if (/port|pier|dock|terminal/.test(id)) return ['Piraeus', '', odd];
  if (/city|dest|place|where|sight|add|leaves from|ends in/.test(id)) return ['Lisbon', 'Spinalonga', '', odd];
  if (/ship/.test(id)) return ['Sun Princess', '', odd];
  if (/flight/.test(id)) return ['UA 973', '', odd];
  if (/name|title/.test(id)) return ['Our summer trip', '', odd];
  if (/price|cost|amount|budget|\$|€/.test(id)) return ['25', '', '-1', 'abc'];
  return ['Acropolis', '', odd]; };

async function settle(p, max) { const end = Date.now() + max; await sleep(250);
  while (Date.now() < end) { const s = await p.evaluate(() => ({ now: performance.now(), last: window.__press ? window.__press.lastMut : 0 })).catch(() => null); if (!s) { await sleep(300); continue; } if (s.now - s.last > 450) return; await sleep(120); } }

// The steps of one press: [control, value?]. Returns the record.
async function doPress(lane, c, value, quietMax, enter, fill) { const p = lane.p; let filled = null;
  if (fill) { const fl = await p.evaluate(([s, n]) => window.__press.besideList(s, n), [c.sig, c.n]); filled = fl.map(f => VALUES(f, fill)[0]); if (fl.length) { await p.evaluate(v => window.__press.besideFill(v), filled); await sleep(150); } }
  const aim = await p.evaluate(([s, n]) => window.__press.aim(s, n), [c.sig, c.n]);
  if (aim.gone) return { gone: true };
  if (aim.covered) return { covered: aim.covered };
  await sleep(120);
  const aim2 = await p.evaluate(([s, n]) => { const w = window.__press.where(s, n); return w; }, [c.sig, c.n]); const top0 = aim2 ? aim2.top : aim.top, anchor0 = aim2 ? aim2.anchor : null, sy0 = aim2 ? aim2.sy : 0;
  const y = aim.y + (top0 - aim.top);
  const before = await p.evaluate(() => { const P = window.__press; P.fx.length = 0; P.errs.length = 0; P.t0 = performance.now(); return P.look(); });
  lane.popups = []; lane.dialogs = []; lane.downloads = 0; lane.pageerrs = []; const url0 = p.url(); const t0 = Date.now();
  let how = filled && filled.length ? 'tap, with the field' + (filled.length > 1 ? 's' : '') + ' beside it filled in (' + filled.map(v => JSON.stringify(v)).join(', ') + ')' : 'tap';
  try {
    if (c.kind === 'select') { how = 'choose ' + JSON.stringify(value); await p.evaluate(([s, n, v]) => { const e = window.__press.find(s, n); e.focus(); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [c.sig, c.n, value]); }
    else if (c.kind === 'file') { how = 'give it a photo'; const h = await p.evaluateHandle(([s, n]) => window.__press.find(s, n), [c.sig, c.n]); await h.asElement().setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') }); }
    else if (c.kind === 'range') { how = 'slide to ' + value; await p.evaluate(([s, n, v]) => { const e = window.__press.find(s, n); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [c.sig, c.n, value]); }
    else if (c.kind === 'pick') { how = 'set ' + JSON.stringify(value); await p.touchscreen.tap(aim.x, y); await sleep(80); await p.evaluate(([s, n, v]) => { const e = document.querySelector('[data-press-me]') || window.__press.find(s, n); if (!e) return; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(e, v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); e.blur(); }, [c.sig, c.n, value]); }
    else if (c.kind === 'field') { how = 'type ' + JSON.stringify(value.length > 40 ? value.slice(0, 37) + '…' : value); await p.touchscreen.tap(aim.x, y); await sleep(120);
      const foc = await p.evaluate(() => { const a = document.activeElement; return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable); });
      if (!foc) await p.evaluate(([s, n]) => { const e = document.querySelector('[data-press-me]') || window.__press.find(s, n); e && e.focus(); }, [c.sig, c.n]);
      await p.keyboard.press('Control+A'); await p.keyboard.press('Delete'); if (value) await p.keyboard.insertText(value); await sleep(150);
      if (enter && c.tag !== 'textarea') { how += ', then the keyboard\'s Enter (Go) key'; await p.keyboard.press('Enter'); } await sleep(200); await p.evaluate(() => { const a = document.activeElement; if (a && a.blur && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) a.blur(); }).catch(() => {}); }
    else await p.touchscreen.tap(aim.x, y);
  } catch (e) { return { failed: String(e.message).split('\n')[0].slice(0, 160) }; }
  await sleep(350);
  const pos1 = await p.evaluate(([s, n]) => window.__press && window.__press.where(s, n), [c.sig, c.n]).catch(() => null);
  await settle(p, quietMax);
  let after = await p.evaluate(() => window.__press && window.__press.look()).catch(() => null);
  if (!after) { await sleep(1500); after = await p.evaluate(() => window.__press && window.__press.look()).catch(() => null); }
  const navigated = p.url().split('#')[0] !== url0.split('#')[0];
  if (!after) return { how, left: p.url(), ms: Date.now() - t0, before, after: null, fx: [], errs: lane.pageerrs.slice(), popups: lane.popups.slice(), dialogs: lane.dialogs.slice(), downloads: lane.downloads, navigated: true };
  if (after.spin.length) { const end = Date.now() + 15000; while (Date.now() < end) { await sleep(1000); const s = await p.evaluate(() => window.__press.look().spin).catch(() => []); if (!s.length) { after = await p.evaluate(() => window.__press.look()); after.spun = true; break; } } }
  const pos2 = await p.evaluate(([s, n]) => window.__press.where(s, n), [c.sig, c.n]).catch(() => null);
  const more = await p.evaluate(() => ({ fx: window.__press.fx.slice(), errs: window.__press.errs.slice(), shift: window.__press.shifts.filter(s => s.t >= window.__press.t0 + 500 && !s.input).reduce((a, s) => a + s.v, 0) })).catch(() => ({ fx: [], errs: [], shift: 0 }));
  return { how, ms: Date.now() - t0, before, after, top0, anchor0, sy0, pos1, pos2, fx: more.fx, errs: [...new Set([...more.errs, ...lane.pageerrs])], shift: more.shift, popups: lane.popups.slice(), dialogs: lane.dialogs.slice(), downloads: lane.downloads, navigated };
}

// What the press did, in a traveler's words, and which rules it broke.
function judge(c, r, ctx) { const out = { did: [], fails: [], notes: [] };
  if (r.gone) { out.skip = 'gone'; return out; }
  if (r.covered) { out.fails.push(['COVERED', 'a finger cannot reach it: ' + r.covered + ' lies over it']); out.did.push('could not be pressed'); return out; }
  if (r.failed) { out.fails.push(['ERROR', 'the press itself failed: ' + r.failed]); return out; }
  const a = r.before, b = r.after;
  if (!b) { out.did.push('left the app for ' + r.left); if (!/^https?:/.test(r.left || '')) out.fails.push(['BROKEN', 'the app page was replaced by ' + r.left]); return out; }
  const d = diffText(a.text, b.text);
  if (a.view !== b.view) out.did.push('screen: ' + (a.view || '?') + ' → ' + (b.view || '?'));
  if (a.over !== b.over) out.did.push(b.over ? 'opens ' + b.over : 'closes ' + a.over);
  if (a.folds !== b.folds) out.did.push(a.folds.length !== b.folds.length ? 'folds redrawn' : (b.folds.split('').filter((x, i) => x === '1' && a.folds[i] !== '1').length ? 'fold opens' : 'fold closes'));
  if (d.add.length) out.did.push('shows: ' + d.add.slice(0, 3).map(s => '"' + s.slice(0, 70) + '"').join(' ') + (d.add.length > 3 ? ' (+' + (d.add.length - 3) + ' lines)' : ''));
  if (d.gone.length) out.did.push('removes: ' + d.gone.slice(0, 2).map(s => '"' + s.slice(0, 50) + '"').join(' ') + (d.gone.length > 2 ? ' (+' + (d.gone.length - 2) + ' lines)' : ''));
  if (a.marks !== b.marks && !d.add.length && !d.gone.length) out.did.push('its mark changes');
  if (a.vals !== b.vals) out.did.push('a field value changes');
  if (a.cls !== b.cls || a.style !== b.style) out.did.push('the look of the app changes');
  if (a.hash !== b.hash) out.did.push('address ' + b.hash);
  if (a.focus !== b.focus && /^(INPUT|TEXTAREA|SELECT)/.test(b.focus)) out.did.push('cursor in ' + b.focus);
  if (a.media !== b.media) out.did.push('sound ' + (/1|s/.test(b.media) ? 'plays' : 'stops'));
  for (const f of [...new Set(r.fx)]) out.did.push(f);
  for (const u of r.popups) out.did.push('opens a new page: ' + String(u).slice(0, 90));
  for (const u of r.dialogs) out.did.push('system box: ' + u);
  if (r.downloads) out.did.push('saves a file');
  if (r.navigated) out.did.push('leaves for ' + ctx.url);
  if (c.href && /^(mailto|tel|sms):/.test(c.href)) out.did.push('hands over to the phone\'s ' + (/^mailto/.test(c.href) ? 'mail' : 'phone') + ' app: ' + c.href.slice(0, 60));
  const scrolled = a.y !== b.y; if (scrolled && !out.did.length) out.did.push('the page scrolls');
  // A lookup or a sound file being fetched is not yet something the traveler sees or hears.
  const changed = out.did.some(s => !/^(lookup|loads sound)/.test(s));
  // Rules
  const errs = r.errs.filter(e => !/ResizeObserver loop|Script error\.?$|AbortError|The user aborted|play\(\) request|NotAllowedError|Failed to fetch|NetworkError|Load failed|no camera in this test/i.test(e));
  if (errs.length) out.fails.push(['ERROR', errs.slice(0, 2).join(' | ')]);
  if (b.err && b.err !== a.err && /undefined|TypeError|is not a function|Cannot read/i.test(b.err)) out.fails.push(['ERROR', 'the app shows its own error: ' + b.err.slice(0, 120)]);
  const quiet = c.kind === 'field' || c.kind === 'pick' || c.kind === 'range' || c.kind === 'select';
  if (!changed) { if (c.cur) out.did.push('already the current choice: nothing to change'); else if (quiet && (ctx.sameValue || c.kind !== 'select')) out.did.push(ctx.value === '' ? 'accepts being left empty' : 'takes the value'); else out.fails.push(['DEAD', 'nothing a traveler can see, hear or get happened']); }
  if (b.spin.length) out.fails.push(['STUCK', 'still waiting 15 s later: ' + b.spin[0]]);
  if (b.wide > 2 && b.wide > a.wide) out.fails.push(['WIDE', 'the page became ' + b.wide + ' px wider than the screen']);
  const bad = d.add.find(l => /\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b(?! island)/.test(l) && !/[“"'][^"”']*(undefined|null|NaN)[^"“']*["”']/.test(l));
  if (bad) out.fails.push(['BROKEN', 'the screen shows: "' + bad.slice(0, 100) + '"']);
  if (b.blank && !a.blank) out.fails.push(['BROKEN', 'the screen is blank after the press']);
  // With every lookup refused (this build, no internet) the app cannot know a place is not there: it must say the
  // lookup did not get through, never that nothing was found.
  if (!LIVE) { const lie = d.add.find(l => /couldn['’]t find|could not find|didn['’]t find|\bno (results|matches|places|restaurants|sights|trains|ferries|boats|flights)\b[^.]*\bfound|\bnot found\b|nothing (was )?found|doesn['’]t exist|no such (place|address)/i.test(l)); if (lie) out.fails.push(['UNTRUE', 'no lookup could be answered in this run, yet the screen says: "' + lie.slice(0, 110) + '"']); }
  // JUMP: same screen, the tapped control still there, and it moved from under the finger.
  const sameScreen = a.view === b.view && a.over === b.over && !r.navigated && !ctx.enter; // Enter sends the form: the app may rightly go to its answer
  for (const [pos, when] of [[r.pos1, 'at once'], [r.pos2, 'once the screen settled']]) { if (!sameScreen || !pos) continue;
    const dy = r.anchor0 != null ? (pos.anchor != null ? Math.round(pos.anchor - r.anchor0) : 0) : (pos.shown && r.top0 != null ? Math.round(pos.top - r.top0) : 0);
    if (Math.abs(dy) <= 48) continue;
    // Two ways a screen moves: the app scrolled it (allowed only for a control listed in press-expect.cjs as scrolling
    // to what it opens, and then what it opened must be on screen), or things on the page moved under the finger.
    const scrolled = Math.round((pos.sy || 0) - (r.sy0 || 0)), byLayout = dy + scrolled, self = Math.abs(byLayout) <= 48;
    if (self && X.scrollsTo(c, ctx)) { out.notes.push('the app scrolls ' + Math.abs(dy) + ' px to show what this opened'); break; }
    out.jump = dy; out.fails.push(['JUMP', (self ? 'the app scrolled the screen by itself, ' : 'things on the screen moved ') + Math.abs(self ? dy : byLayout) + ' px ' + ((self ? dy : byLayout) > 0 ? 'down' : 'up') + ' under the finger ' + when + (r.anchor0 != null ? '' : ' (the control itself moved)')]); break; }
  if (c.kind !== 'field' && c.kind !== 'pick' && c.kind !== 'select' && c.kind !== 'range' && (c.w < 24 || c.h < 24) && !c.inMap) out.notes.push('small target: ' + c.w + ' x ' + c.h + ' px');
  return out; }

// ---- The walk of one trip at one size ---------------------------------------------------------------------------
async function walk(browser, base, size, tripName, helper) {
  const def = TRIPDEF[tripName], snap = { s: {} }, recs = [], T0 = Date.now();
  const tag = `${tripName} ${size}`;
  const lanes = []; for (let i = 0; i < POOL; i++) { const l = await makeLane(browser, base, size, def, snap, helper); l.soft = 0; lanes.push(l); }
  // The start state: made once on the first lane (the app's own taps where the app has them), then copied to all.
  const L0 = lanes[0], p0 = L0.p; await L0.boot();
  if (LIVE && def.legs) { // the trip entered in the app's own new-trip form, field by field, then built by the app
    const type = async (id, v) => { if (v == null || v === '') return; const el = p0.locator('#' + id); if (!(await el.count())) throw new Error('the new-trip form has no field ' + id); await el.tap().catch(() => {}); await el.fill(String(v)); await el.press('Tab').catch(() => {}); await sleep(200); };
    const seg = async (i, key, v) => { if (!v) return; const el = p0.locator(`[data-ts="set"][data-i="${i}"][data-key="${key}"][data-v="${v}"]`).first(); if ((await el.getAttribute('aria-pressed').catch(() => null)) !== 'true') { await el.tap(); await sleep(400); } };
    await p0.locator('[data-act="newtrip"]').first().tap(); await sleep(800);
    for (let i = 0; i < def.legs.length; i++) { const l = def.legs[i];
      if (i > 0 || l.k === 'cruise') { await p0.locator(`[data-ts="${l.k === 'cruise' ? 'addcruise' : 'addstay'}"]`).first().tap(); await sleep(600); }
      if (l.k === 'stay') { await type(`ts-${i}-place`, l.place); await type(`ts-${i}-date`, l.date); await type(`ts-${i}-nights`, l.nights); await type(`ts-${i}-hotel`, l.hotel); }
      else { await type(`ts-${i}-board`, l.board); await type(`ts-${i}-ship`, l.ship); await type(`ts-${i}-date`, l.date); await type(`ts-${i}-aboard`, l.aboard); }
      await seg(i, 'inBy', l.inBy); await type(`ts-${i}-leaveAt`, l.leaveAt); await type(`ts-${i}-inAt`, l.inAt);
      for (let j = 0; j < (l.ports || []).length; j++) { const q = l.ports[j]; if (j > 0) { await p0.locator(`[data-ts="addport"][data-i="${i}"]`).first().tap(); await sleep(500); }
        await type(`ts-${i}-p${j}-date`, q.date); await type(`ts-${i}-p${j}-place`, q.place); await type(`ts-${i}-p${j}-arrive`, q.arrive); await type(`ts-${i}-p${j}-aboard`, q.aboard); if (q.tender) { await p0.locator(`[data-tsf="ts-${i}-p${j}-tender"]`).first().tap(); await sleep(300); } }
      if (l.k === 'cruise') { await type(`ts-${i}-end`, l.end); await type(`ts-${i}-endDate`, l.endDate); await type(`ts-${i}-off`, l.off); }
      if (i === def.legs.length - 1) { await seg(i, 'homeBy', l.homeBy); await type(`ts-${i}-homeAt`, l.homeAt); } }
    await p0.getByRole('button', { name: /Build my trip/i }).first().tap();
    const t0 = Date.now(); let st = {};
    while (Date.now() - t0 < 6 * 60000) { st = await p0.evaluate(() => { const s = window.__kairouteState ? window.__kairouteState() : {}; return { view: s.view, busy: s.busy || '', err: s.err || '', days: (s.days || []).length, guides: (s.days || []).filter(d => d.guide).length }; }).catch(() => ({})); if (st.view !== 'wizard' && !st.busy && Date.now() - t0 > 8000) break; await sleep(2000); }
    def.built = st; console.log(`   the app built the trip in ${Math.round((Date.now() - t0) / 1000)} s: ${st.days} days, ${st.guides} with a guide${st.err ? '; it says: ' + st.err : ''}`);
    if (st.view === 'wizard' || !st.days) throw new Error('the app did not build the trip from its own form' + (st.err ? ': ' + st.err : ''));
    for (let k = 0; k < 6; k++) { const sk = p0.locator('[data-act="coachskip"]').first(); if (await sk.isVisible().catch(() => false)) { await sk.tap().catch(() => {}); await sleep(300); } else break; }
    await p0.evaluate(() => { try { const ls = window.__realLS; ['lobbySeen', 'intro1', 'sunprincess1', 'spread1', 'bible1', 'coach1', 'coachDone', 'tourTip'].forEach(k => ls.setItem('b2:kairoute.' + k, '1')); } catch (e) {} });
  }
  else if (!def.seed && !def.first) { // the example trip, opened as a traveler opens it
    for (let k = 0; k < 6; k++) { const sk = p0.locator('[data-act="coachskip"]').first(); if (await sk.isVisible().catch(() => false)) { await sk.tap().catch(() => {}); await sleep(300); } else break; }
    const b = p0.locator('[data-act="continue"], [data-act="loadsample"]').first(); if (await b.isVisible().catch(() => false)) { await b.tap(); await sleep(LIVE ? 6000 : 2500); }
    for (let k = 0; k < 6; k++) { const sk = p0.locator('[data-act="coachskip"], .coach button:has-text("Skip")').first(); if (await sk.isVisible().catch(() => false)) { await sk.tap().catch(() => {}); await sleep(300); } else break; }
    await p0.evaluate(() => { try { const ls = window.__realLS; ['lobbySeen', 'intro1', 'sunprincess1', 'spread1', 'bible1', 'coach1', 'coachDone', 'tourTip'].forEach(k => ls.setItem('b2:kairoute.' + k, '1')); } catch (e) {} });
  }
  if (def.group) { // the owner shares the open trip as a group, with the app's own buttons
    await p0.evaluate(() => { window.__kairouteGo('settings'); }); await sleep(500);
    const sec = p0.locator('[data-setsec="group"]').first(); if (await sec.isVisible().catch(() => false)) { await sec.tap(); await sleep(500); }
    const lead = p0.locator('[data-grp="lead"]').first(); if (await lead.isVisible().catch(() => false)) { await lead.tap(); await sleep(2500); }
    def.groupOk = await p0.evaluate(() => { try { return !!JSON.parse(window.__realLS.getItem('b2:kairoute.group') || 'null'); } catch (e) { return false; } });
  }
  await sleep(LIVE ? 4000 : 800);
  snap.s = await p0.evaluate(() => { const ls = window.__realLS, o = {}; for (let i = 0; i < ls.length; i++) { const k = ls.key(i); o[k] = ls.getItem(k); } return o; });
  const days = await p0.evaluate(() => { try { return window.__kairouteDays(); } catch (e) { return []; } });
  // Screens: Home, Trip, then one day of each kind (by type and how the traveler arrives or leaves) on Day plan,
  // Choose sights, Guide and Tour, then Journal and Settings.
  const kinds = new Map(); days.forEach(d => { const k = d.type + (d.mode && /arriv|leav|board/.test(d.type) ? ' by ' + d.mode : ''); if (!kinds.has(k)) kinds.set(k, d.i); });
  if (def.clock) { const today = new Date(def.clock).toISOString().slice(0, 10); const i = days.findIndex(d => d.date === today || d.date === def.clock.slice(0, 10)); if (i >= 0) { kinds.clear(); kinds.set(days[i].type + ' (today)', i); } }
  let roots = [];
  if (def.first) roots = [{ name: 'lobby', view: null, label: 'First open' }];
  else { roots.push({ name: 'lobby', view: 'lobby', label: 'Home' }, { name: 'trip', view: 'trip', day: 0, dest: (days[0] || {}).dest || '', label: 'Trip' });
    for (const [k, i] of kinds) for (const v of ['plan', 'sites', 'guide', 'tour']) roots.push({ name: v + ':' + k, view: v, day: i, dest: days[i].dest || '', label: ({ plan: 'Day plan', sites: 'Choose sights', guide: 'Guide', tour: 'Tour' })[v] + ', ' + k + ' day (' + (days[i].dest || 'no place') + ')' });
    roots.push({ name: 'journal', view: 'journal', day: 0, label: 'Journal' }, { name: 'settings', view: 'settings', day: 0, label: 'Settings' }); }
  if (def.only) roots = roots.filter(r => def.only.test(r.name));
  if (ONLYROOT.length) roots = roots.filter(r => ONLYROOT.some(o => r.name.includes(o)));
  roots = roots.filter((r, i) => i % PART[1] === PART[0] - 1);
  console.log(`\n== ${tag}: ${def.label}\n   ${roots.length} screens: ${roots.map(r => r.name).join(', ')}`);
  for (const l of lanes) l.ready = l.reset().catch(e => { l.dead = String(e.message); });
  const take = async () => { for (;;) { const live = lanes.filter(l => !l.dead); if (!live.length) throw new Error('no browser page could reopen the app: ' + lanes[0].dead); const l = live.find(l => !l.busy); if (l) { l.busy = true; await l.ready; if (l.dead) continue; return l; } await sleep(50); } };
  // After a press that changed nothing the app keeps (the saved state is the same to the letter) the page is used
  // again without reopening the app; the next use checks the screen shows the very same controls as on a fresh open,
  // and reopens the app if not. Every 30th use reopens it anyway, and so does every failure before it is confirmed.
  const give = (l, soft) => { if (soft && l.soft < 30 && !l.dead) { l.soft++; l.fresh = false; } else { l.soft = 0; l.ready = l.reset().catch(e => { l.dead = String(e.message); }); } l.busy = false; };
  const sigs = list => list.map(c => c.sig).join('\n');
  // Opens the screen on this page; on a page used before, makes sure it is the same screen as on a fresh open.
  const openRoot = async (l, root) => { await goRoot(l, root); if (l.fresh || root.view === null) { if (!l.fresh) { await l.reset(); l.soft = 0; await goRoot(l, root); } if (!root.sigs) root.sigs = sigs(await l.p.evaluate(() => window.__press.controls())); return; }
    const now = sigs(await l.p.evaluate(() => window.__press.controls()).catch(() => []));
    if (!root.sigs || now !== root.sigs) { await l.reset(); l.soft = 0; await goRoot(l, root); if (!root.sigs) root.sigs = sigs(await l.p.evaluate(() => window.__press.controls())); } };
  const QUIET = LIVE ? 7000 : 3500;
  const goRoot = async (l, root) => { if (root.view === null) return; await l.p.evaluate(([v, i]) => { if (typeof i === 'number') window.__kairouteGo('day', i); window.__kairouteGo(v); scrollTo(0, 0); }, [root.view, root.day]); await settle(l.p, LIVE ? 5000 : 1500); };
  // Replays the presses that lead to a state. Returns false if a step is no longer there.
  const replay = async (l, pathSteps) => { for (const st of pathSteps) { const r = await doPress(l, st.c, st.value, QUIET, st.enter, st.fill); if (r.gone || r.covered || r.failed) return false; await l.p.evaluate(() => window.__press && window.__press.unmark()).catch(() => {}); } return true; };
  const chromeSeen = new Set(); // shared bars (tabs, the day strip, the top bar): pressed on the first screen of each kind
  const file = path.join(OUT, `${tripName}-${size}${PART[1] > 1 ? '-' + PART[0] : ''}.json`);
  const keep = () => fs.writeFileSync(file, JSON.stringify({ trip: tripName, label: def.label, size, live: LIVE, url: base, part: PART, group: def.groupOk, secs: Math.round((Date.now() - T0) / 1000), recs }, null, 0));
  for (const root of roots) {
    if (BUDGET && Date.now() - START > BUDGET) { recs.push({ trip: tripName, size, root: root.name, screen: root.label, path: [], label: '(whole screen)', did: [], fails: [], notpressed: 'this screen was not walked: the time allowed for the run (' + process.env.BUDGET_MIN + ' min) was used up' }); console.log(`NOT PRESSED [${tag} / ${root.label}] the time allowed for the run was used up`); continue; }
    const seen = new Set(); let n = 0, capped = 0; const rootT = Date.now();
    // Breadth first: a queue of states (the presses that lead there) whose new controls are to be pressed.
    const queue = [{ steps: [], base: null }];
    const doState = async state => {
      let list = state.list || [];
      if (!state.list) { const l = await take();
        try { await openRoot(l, root); if (await replay(l, state.steps)) list = await l.p.evaluate(() => window.__press.controls()); } catch (e) { recs.push({ trip: tripName, size, root: root.name, screen: root.label, path: state.steps.map(s => s.c.label), label: '(state)', fails: [['ERROR', 'could not open this screen: ' + String(e.message).split('\n')[0]]], did: [], harness: true }); }
        give(l, !state.steps.length); }
      if (process.env.VERBOSE) console.log(`   . ${root.name} state [${state.steps.map(s => s.c.label).join(' > ')}]: ${list.length} controls`);
      const fresh = list.filter(c => { const k = c.sig + '#' + c.n; if (state.base && state.base.has(k)) return false; if (seen.has(k)) return false; seen.add(k); return true; });
      const jobs = [];
      for (const c of fresh) { if (ONLY && !ONLY.test(c.act) && !ONLY.test(c.label)) continue;
        if (c.chrome && !state.steps.length) { const k = (root.view || 'lobby') + '|' + c.sig + '#' + c.n; if (chromeSeen.has(k)) { recs.push({ trip: tripName, size, root: root.name, screen: root.label, path: [], label: c.label, act: c.act, data: c.data, kind: c.kind, same: true, did: ['same bar as on the first screen of this kind: pressed there'], fails: [] }); continue; } chromeSeen.add(k); }
        if (c.off) { recs.push({ trip: tripName, size, root: root.name, screen: root.label, path: state.steps.map(s => s.c.label), label: c.label, act: c.act, data: c.data, kind: c.kind, off: true, did: ['greyed out: cannot be pressed'], fails: [] }); continue; }
        const vals = c.kind === 'select' ? (c.opts.length <= 8 ? c.opts : [...new Set([c.opts[0], c.opts[1], c.opts[Math.floor(c.opts.length / 2)], c.opts[c.opts.length - 2], c.opts[c.opts.length - 1]])]).filter(v => v !== c.val || c.opts.length === 1)
          : c.kind === 'range' ? [c.min || '0', c.max || '100'] : c.kind === 'field' || c.kind === 'pick' ? VALUES(c, { dest: root.dest || '' }) : [undefined];
        for (const v of vals) jobs.push({ c, value: v });
        if (c.kind === 'field' && c.tag === 'input') jobs.push({ c, value: vals[0], enter: true });
        if (c.fillN) jobs.push({ c, value: undefined, fill: { dest: root.dest || '' } });
      }
      // The presses of this state, a few pages at a time.
      await Promise.all(jobs.map(async job => { if (n >= MAXROOT || (BUDGET && Date.now() - START > BUDGET + 600000)) { capped++; return; } n++;
        const c = job.c; const mk = () => ({ filled: job.fill ? true : undefined, trip: tripName, size, root: root.name, screen: root.label, path: state.steps.map(s => s.c.label + (s.value ? ' = ' + String(s.value).slice(0, 20) : '')), label: c.label, act: c.act, data: c.data, kind: c.kind, tag: c.tag, value: job.value, w: c.w, h: c.h, href: c.href || undefined });
        // One try: the screen opened, the steps to this state repeated, the control pressed and judged.
        const once = async (l, pause) => { const rec = mk(); let r = null, soft = false;
          try { await openRoot(l, root); const okPath = await replay(l, state.steps); if (pause) await sleep(pause);
            if (!okPath) { rec.did = []; rec.fails = []; rec.skip = 'the steps to it could not be repeated'; return { rec, r, soft }; }
            const h0 = await l.p.evaluate(() => window.__press.hash());
            r = await doPress(l, c, job.value, QUIET, job.enter, job.fill); const j = judge(c, r, { url: l.p.url(), value: job.value, sameValue: job.value === c.val, enter: job.enter, view: root.view, trip: tripName });
            Object.assign(rec, { how: r.how, ms: r.ms, did: j.did, fails: j.fails, notes: j.notes, skip: j.skip, jump: j.jump, view: r.after && r.after.view, popups: r.popups && r.popups.length ? r.popups : undefined });
            const x = X.expect(c, r, rec, { live: LIVE, trip: tripName, size, root }); if (x) rec.fails.push(['EXPECT', x]);
            const h1 = r.after ? await l.p.evaluate(() => window.__press.hash()).catch(() => '') : '';
            soft = !!r.after && !r.navigated && h1 === h0 && !rec.fails.length && !(r.popups || []).length;
          } catch (e) { rec.did = rec.did || []; rec.fails = (rec.fails || []).concat([['ERROR', 'the check itself could not finish this press: ' + String(e.message).split('\n')[0].slice(0, 140)]]); rec.harness = true; }
          return { rec, r, soft }; };
        let l = await take(); let { rec, r, soft } = await once(l);
        // A failure counts when it happens again on a freshly opened app; seen once only, it is reported as unsteady.
        if (rec.fails && rec.fails.length) { give(l, false); l = await take(); if (!l.fresh) { await l.reset(); l.soft = 0; } const deadOnly = rec.fails.every(f => f[0] === 'DEAD'); const again = await once(l, deadOnly ? 3500 : 0);
          if (deadOnly && !again.rec.skip && !(again.rec.fails || []).length) { again.rec.notes = (again.rec.notes || []).concat(['pressed the instant it appeared it changed nothing; pressed 3.5 s later it did this']); rec = again.rec; r = again.r; }
          else {
          const rules = new Set((again.rec.fails || []).map(f => f[0])); const kept = rec.fails.filter(f => rules.has(f[0])), once1 = rec.fails.filter(f => !rules.has(f[0]));
          if (again.rec.skip) { /* could not repeat: keep the first try as it was */ } else { const first = rec; rec = again.rec; r = again.r; rec.harness = first.harness && again.rec.harness; rec.fails = (again.rec.fails || []).filter(f => kept.some(k => k[0] === f[0])).concat((again.rec.fails || []).filter(f => !first.fails.some(k => k[0] === f[0])).map(f => ['UNSTEADY', 'on the second try only: ' + f[0] + ', ' + f[1]])).concat(once1.map(f => ['UNSTEADY', 'on the first try only (not on a second, freshly opened app): ' + f[0] + ', ' + f[1]])); }
          }
          soft = false; }
        try {
          // An odd value typed: the app must still open on reload.
          if (r && r.after && (c.kind === 'field' || c.kind === 'pick') && job.value !== VALUES(c, { dest: root.dest || '' })[0] && job.value !== '') { soft = false; try { await l.p.reload({ waitUntil: 'domcontentloaded' }); await l.p.waitForFunction(() => !!window.__kairouteGo && !!document.querySelector('#view') && document.body.innerText.trim().length > 20, null, { timeout: 15000 }); await sleep(300); const e2 = l.pageerrs.filter(e => !/ResizeObserver|AbortError|Failed to fetch/.test(e)); if (e2.length) rec.fails.push(['LOST', 'after this value the app reopens with an error: ' + e2[0]]); } catch (e) { rec.fails.push(['LOST', 'after this value the app no longer opens on reload']); } }
          // What the press revealed is pressed next (same screen, or a screen with no place of its own in the list).
          else if (r && r.after && !r.navigated && state.steps.length + 1 < MAXDEPTH && !rec.skip && !rec.fails.some(f => f[0] === 'DEAD' || f[0] === 'COVERED') && (c.kind !== 'field' || job.enter) && c.kind !== 'pick') {
            const stays = r.after.view === r.before.view || !/^(lobby|trips|trip|plan|sites|guide|tour|journal|settings)$/.test(r.after.view || '') || r.after.over !== r.before.over || root.view === null;
            const changedMuch = rec.did.some(s => /^(shows|opens|closes|fold opens|screen|folds redrawn)/.test(s));
            if (stays && changedMuch) { const now = await l.p.evaluate(() => window.__press.controls()).catch(() => []); const baseSet = new Set([...list.map(c => c.sig + '#' + c.n), ...(state.base || [])]); const newOnes = now.filter(c2 => !baseSet.has(c2.sig + '#' + c2.n) && !seen.has(c2.sig + '#' + c2.n));
              if (newOnes.length) queue.push({ steps: [...state.steps, { c, value: job.value, enter: job.enter, fill: job.fill }], base: baseSet, list: now }); } }
        } catch (e) {}
        await l.p.evaluate(() => window.__press && window.__press.unmark()).catch(() => {});
        give(l, soft); recs.push(rec);
        if (process.env.VERBOSE) console.log(`   ${soft ? '·' : '↻'} ${rec.label.slice(0, 30)} ${rec.value !== undefined || rec.filled ? '(' + rec.how + ') ' : ''}→ ${(rec.did || []).join('; ').slice(0, 110)}`);
        for (const f of rec.fails || []) console.log(`${f[0] === 'UNSTEADY' ? 'NOTE' : 'FAIL'} ${f[0]} [${tag} / ${root.label}${rec.path.length ? ' / ' + rec.path.join(' > ') : ''}] "${rec.label}"${rec.value !== undefined || rec.filled ? ' (' + rec.how + ')' : ''}: ${f[1]}`);
      }));
    };
    while (queue.length) { const batch = queue.splice(0); await Promise.all(batch.map(doState)); }
    keep();
    if (capped) recs.push({ trip: tripName, size, root: root.name, screen: root.label, path: [], label: '(' + capped + ' more controls)', did: [], fails: [], notpressed: capped + ' controls on this screen were not pressed: the limit of ' + MAXROOT + ' presses a screen was reached' });
    console.log(`   ${tag} ${root.label}: ${n} presses, ${recs.filter(r => r.root === root.name && (r.fails || []).length).length} with a failure, ${Math.round((Date.now() - rootT) / 1000)} s`);
  }
  for (const l of lanes) { await l.ready.catch(() => {}); await l.ctx.close().catch(() => {}); }
  keep();
  return recs;
}

(async () => {
  const srv = LIVE ? null : await serve(path.resolve(ARG)); const base = LIVE ? ARG.replace(/\/?$/, '/') : srv.url;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] }); const helper = await localHelper();
  let all = [];
  for (const size of PICK) for (const t of TRIPS) { if (!TRIPDEF[t]) { console.log('NOT TESTED no such trip: ' + t); process.exitCode = 1; continue; }
    try { all = all.concat(await walk(browser, base, size, t, helper)); } catch (e) { console.log(`NOT TESTED [${t} ${size}] the walk stopped: ${String(e.message).split('\n')[0]}`); all.push({ trip: t, size, root: '-', screen: '-', path: [], label: '(walk)', did: [], fails: [['ERROR', 'the walk stopped: ' + String(e.message).split('\n')[0]]], harness: true }); } }
  await browser.close(); if (srv) srv.close();
  // LINK (live runs): every outside page the app offered is asked for once; "page not found" or "no such site" fails.
  if (LIVE) { const urls = new Map(); for (const r of all) for (const u of [r.href, ...(r.popups || [])]) if (/^https?:\/\//.test(u || '') && !u.startsWith(base)) { const k = u.split('#')[0]; if (!urls.has(k)) urls.set(k, r); }
    const list = [...urls.entries()].slice(0, 400); let bad = 0;
    await Promise.all(list.map(async ([u, r], i) => { await sleep(i * 150); let st = 0, err = '';
      for (const method of ['HEAD', 'GET']) { try { const a = await fetch(u, { method, redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'Mozilla/5.0 (link check)', accept: 'text/html,*/*' } }); st = a.status; if (st < 400 || ![403, 405, 501].includes(st)) break; } catch (e) { err = String(e.cause && e.cause.code || e.name || e.message); st = 0; } }
      if (st === 404 || st === 410 || /ENOTFOUND|ERR_NAME|EAI_AGAIN/.test(err)) { bad++; const rec = Object.assign({}, r, { label: r.label, did: ['link: ' + u], fails: [['LINK', 'the page it opens does not exist (' + (st || err) + '): ' + u.slice(0, 140)]], linkOnly: true }); all.push(rec); try { const f = path.join(OUT, 'links.json'); const prev = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : { trip: 'links', label: 'Links the app offers', size: PICK.join('+'), live: true, url: base, recs: [] }; prev.recs.push(rec); fs.writeFileSync(f, JSON.stringify(prev)); } catch (e) {} console.log(`FAIL LINK [${r.trip} ${r.size} / ${r.screen}] "${r.label}": the page it opens does not exist (${st || err}): ${u.slice(0, 140)}`); } }));
    console.log(`   links the app offered: ${list.length} asked for, ${bad} do not exist`); }
  const pressed = all.filter(r => !r.same && !r.off && !r.skip && !r.notpressed), failed = all.filter(r => (r.fails || []).some(f => f[0] !== 'UNSTEADY'));
  console.log(`\nEvery button pressed: ${pressed.length} presses on ${new Set(all.map(r => r.trip + r.size + r.root)).size} screens; ${failed.length} with a failure; ${all.filter(r => r.off).length} greyed out; ${all.filter(r => r.notpressed).length} screens cut short`);
  if (failed.length || all.some(r => r.notpressed)) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 2; });
