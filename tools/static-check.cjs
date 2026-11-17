// Static code check (security and stability, no browser): no keys or passwords written into the repository,
// no eval or new Function in the app, no function defined twice in the app bundle (the later one silently wins),
// scripts only from the expected places, and every outside address the app calls uses https.
// Run: node tools/static-check.cjs
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const root = path.join(__dirname, '..'); process.chdir(root);
let fails = 0; const fail = m => { fails++; console.log('FAIL ' + m); };
const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(f => f && /\.(js|cjs|mjs|html|json|toml|yml|yaml|sh|md|txt)$/.test(f) && fs.statSync(f).size < 3e6);
// 1. Secrets: common key shapes (Google, GitHub, Cloudflare/AWS style, private keys, bearer tokens written out).
const SECRET = [/AIza[0-9A-Za-z_\-]{35}/, /ghp_[0-9A-Za-z]{36}/, /github_pat_[0-9A-Za-z_]{40,}/, /AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /sk-[A-Za-z0-9]{32,}/, /xox[bpas]-[0-9A-Za-z-]{20,}/, /Bearer [A-Za-z0-9_\-]{30,}/];
for (const f of files) { const t = fs.readFileSync(f, 'utf8'); for (const re of SECRET) { const m = re.exec(t); if (m && !/\$\{\{|secrets\./.test(t.slice(Math.max(0, m.index - 40), m.index))) fail(`${f}: looks like a key or password is written in (${m[0].slice(0, 8)}…)`); } }
// 2. The app bundle (same order as build.sh).
const order = ['src/data.js', 'src/cities1.js', 'src/cities2.js', 'src/cities3.js', 'src/cities4.js', 'src/main.js', ...fs.readdirSync('src/features').sort().map(f => 'src/features/' + f), 'src/end.js'];
const app = order.map(f => fs.readFileSync(f, 'utf8')).join('\n');
if (/[^.\w]eval\s*\(/.test(app)) fail('the app uses eval()');
if (/new Function\s*\(/.test(app)) fail('the app uses new Function()');
// 3. Top-level functions defined twice (only the last one runs, so a fix in the first is silently lost).
const seen = {}; for (const f of order) { const t = fs.readFileSync(f, 'utf8'); for (const m of t.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) (seen[m[1]] = seen[m[1]] || []).push(f); }
for (const [n, where] of Object.entries(seen)) if (where.length > 1) fail(`function ${n} is defined ${where.length} times (${[...new Set(where)].join(', ')})`);
// 4. Outside addresses: https only (http only for localhost), scripts only from the expected hosts.
for (const m of app.matchAll(/["'`](http:\/\/[^"'`\s]+)/g)) if (!/localhost|127\.0\.0\.1|www\.w3\.org/.test(m[1])) fail(`plain http address in the app: ${m[1].slice(0, 80)}`);
const shell = fs.readFileSync('src/shell.html', 'utf8'), OKHOST = /^(https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\/|lib\/|\.\/lib\/)/;
for (const m of shell.matchAll(/<script[^>]+src=["']([^"']+)/g)) if (!OKHOST.test(m[1])) fail(`script from an unexpected place: ${m[1]}`);
// 5. The worker never hands back its keys.
const w = ['worker/worker.js', 'worker/extras.js', 'worker/transit.js'].filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n');
for (const m of w.matchAll(/env\.([A-Z_]*KEY[A-Z_]*|[A-Z_]*TOKEN)/g)) { const line = w.split('\n').find(l => l.includes(m[0])) || ''; if (/Response\.json\([^)]*env\.[A-Z_]*(KEY|TOKEN)/.test(line)) fail(`worker may send ${m[1]} back to the browser`); }
console.log(fails ? `Static check: ${fails} problem(s)` : `Static check passed (${files.length} files, ${Object.keys(seen).length} functions)`);
process.exit(fails ? 1 : 0);
