// The sight audit's weekly summary (Nov 23): findings counted by kind for each place, and the findings that are new
// since the last summary. Reads tools/beta2/sight-audit/report-*.md, writes summary.md and keeps findings-last.txt (the
// list the next summary compares with). A finding is known by its place, kind and sight name, so a distance that moves
// a few metres is not "new". Usage: node tools/beta2/sight-audit-summary.cjs
'use strict';
const fs = require('fs'), path = require('path'), dir = path.join(__dirname, 'sight-audit');
const KINDS = ['POS', 'NAME', 'DUP', 'NOT', 'NOID', 'FOLD', 'LEN', 'FAME'];
const reps = fs.readdirSync(dir).filter(f => /^report-[a-z]+\.md$/.test(f) && !/^report-(all|\d+)\.md$/.test(f)).sort();
const rows = [], now = [];
for (const f of reps) {
  const place = f.slice(7, -3), c = Object.fromEntries(KINDS.map(k => [k, 0]));
  for (const l of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
    const m = /^- ([A-Z]+) (.*)$/.exec(l); if (!m || !KINDS.includes(m[1])) continue;
    c[m[1]]++; const what = m[2].split(/:| \{| \(| ~ | = | is /)[0].trim();
    now.push({ key: `${place} | ${m[1]} | ${what}`, line: `${place}: ${m[1]} ${m[2]}` });
  }
  rows.push([place, c]);
}
const lastF = path.join(dir, 'findings-last.txt'), last = new Set(fs.existsSync(lastF) ? fs.readFileSync(lastF, 'utf8').split('\n').filter(Boolean) : []);
const fresh = now.filter(x => !last.has(x.key)), gone = [...last].filter(k => !now.some(x => x.key === k));
const tot = Object.fromEntries(KINDS.map(k => [k, rows.reduce((a, [, c]) => a + c[k], 0)]));
const out = [`# Sight audit summary (${new Date().toISOString().slice(0, 10)})`, '', `${reps.length} places. ${last.size ? `${fresh.length} new findings since the last summary, ${gone.length} gone.` : 'First summary: every finding counts as new.'}`, '',
  '| Place | ' + KINDS.join(' | ') + ' |', '|---|' + KINDS.map(() => '---').join('|') + '|',
  ...rows.map(([p, c]) => `| ${p} | ` + KINDS.map(k => c[k]).join(' | ') + ' |'), '| **all** | ' + KINDS.map(k => `**${tot[k]}**`).join(' | ') + ' |', '',
  `## New since the last summary (${fresh.length})`, '', ...(fresh.length ? fresh.map(x => '- ' + x.line) : ['None.']), '',
  `## Gone since the last summary (${gone.length})`, '', ...(gone.length ? gone.map(k => '- ' + k) : ['None.']), ''].join('\n');
fs.writeFileSync(path.join(dir, 'summary.md'), out);
fs.writeFileSync(lastF, [...new Set(now.map(x => x.key))].sort().join('\n') + '\n');
console.log(out);
