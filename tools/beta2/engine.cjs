// Loads the Beta 2 engine files (src/engine/*.js, in name order) into Node, exactly as the app gets them.
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', '..', 'src', 'engine');
const ctx = vm.createContext({ console, Date, Math, JSON, Object, Array, Map, Set, Number, String, isFinite, isNaN, NaN, Infinity });
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
module.exports = vm.runInContext('KEngine', ctx);
