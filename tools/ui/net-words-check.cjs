// R-18 class check (Nov 24, outside test round 8a): a "couldn't do it" message blames the connection ("when you're online",
// "needs the internet", "no internet") only where the phone says it is offline. 36 of 65 trips were told to try again
// "when you're online" while online, because the helper was slow. Every such phrase in the app's source must sit on a line
// that tests navigator.onLine / offline, or inside netWhy (the one shared wording). Planted on every run: an unguarded
// message must be caught. Run: node tools/ui/net-words-check.cjs
'use strict';
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', '..', 'src'), BLAME = /when you're online|needs the internet|no internet right now|you're offline/i, GUARD = /onLine|offline|offOnline|_OFFLINE|netWhy/; // _OFFLINE: a constant named as the offline wording, used only when offline
const files = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.js$/.test(f)) files.push(p); } })(SRC);
const scan = (name, text) => text.split('\n').map((l, i) => ({ name, n: i + 1, l })).filter(x => BLAME.test(x.l) && !/^\s*\/\//.test(x.l) && !GUARD.test(x.l));
let fails = 0;
const planted = scan('planted', 'catch (e) { note = "Saving needs the internet. Try again when you\'re online."; }');
if (planted.length !== 1) { console.log('FAIL planted unguarded message not caught: net-words-check is BLIND'); process.exit(1); }
console.log('ok   planted: an unguarded "when you\'re online" message is caught');
for (const f of files) for (const x of scan(path.relative(SRC, f), fs.readFileSync(f, 'utf8'))) { fails++; console.log(`FAIL ${x.name}:${x.n} blames the connection without checking it: ${x.l.trim().slice(0, 140)}`); }
console.log(`net-words-check: ${files.length} files, ${fails} unguarded message(s)`); process.exit(fails ? 1 : 0);
