// Loads the Beta 2 engine files (src/engine/*.js, in name order) into Node, exactly as the app gets them.
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', '..', 'src', 'engine');
const ctx = vm.createContext({ console, Date, Math, JSON, Object, Array, Map, Set, Number, String, isFinite, isNaN, NaN, Infinity });
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
// The engine's data (public holidays, hours checked on official websites): plain data, kept apart from the rules.
const ddir = path.join(__dirname, '..', '..', 'src', 'engine-data');
if (fs.existsSync(ddir)) for (const f of fs.readdirSync(ddir).filter(f => f.endsWith('.js')).sort()) vm.runInContext(fs.readFileSync(path.join(ddir, f), 'utf8'), ctx, { filename: f });
const E = vm.runInContext('KEngine', ctx);
// Saved test trips from before the one hours rule (Nov 19) list a place to eat as shut for lunch or dinner; read as the
// same facts the app now gives (closed that day, or open only outside that meal's hours). The engine reads one shape.
const upEats = f => !f || !('lunchShut' in f || 'dinnerShut' in f) ? f : f.lunchShut && f.dinnerShut ? { closed: true, oh: null }
  : { closed: false, oh: f.lunchShut ? { spans: [[17 * 60, 24 * 60]], last: null } : f.dinnerShut ? { spans: [[0, 16 * 60]], last: null } : null };
const up = b => { if (b && Array.isArray(b.days)) for (const d of b.days) if (d && d.eats) for (const k of Object.keys(d.eats)) d.eats[k] = upEats(d.eats[k]); return b; };
for (const fn of ['planTrip', 'applyPlaces']) { const orig = E[fn]; if (typeof orig === 'function') E[fn] = function (b, ...rest) { return orig.call(this, up(b), ...rest); }; }
module.exports = E;
