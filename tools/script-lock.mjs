// Locks a hand-written stop script once it is final, so it may be voiced. Checks it against the narration template
// first and refuses if anything is missing. Usage: node tools/script-lock.mjs <script id> [--check]
// Template (the Prague clock script is the model): researched, sourced facts only; part 1 says where to stand; every
// part is short spoken paragraphs; legends told as legends; no promises ("guarantee"); ends on one human thought.
// The research file docs/tour-research/<id>.md must list its sources (links) and an uncertainty register.
import fs from "node:fs"; import { loadScripts, fingerprint, readLocks, LOCKS } from "./scripts-lib.mjs";
const id = process.argv[2], checkOnly = process.argv.includes("--check");
const { S, say } = loadScripts(), sc = S.find(x => x.id === id);
if (!sc) { console.error("No script with id", id, "- ids:", S.map(x => x.id).join(", ")); process.exit(1); }
const bad = [], words = sc.parts.flatMap(p => p.paras).join(" ").split(/\s+/).length, chars = sc.parts.flatMap(p => p.paras.map(say)).join("").length;
if (sc.parts.length < 4) bad.push("fewer than 4 parts");
if (!sc.parts[0].stand) bad.push("part 1 has no 'stand here' line");
sc.parts.forEach((p, k) => {
  if (!p.name || !p.paras || !p.paras.length) bad.push(`part ${k + 1} is empty`);
  if (!(p.minutes > 0)) bad.push(`part ${k + 1} has no minutes`);
  (p.paras || []).forEach((t, i) => {
    if (say(t).length > 1900) bad.push(`part ${k + 1} paragraph ${i + 1} is too long to voice in one go`);
    if (/\bguarantee/i.test(t)) bad.push(`part ${k + 1} says "guarantee"`);
    if (/\b(TODO|TBD|XXX)\b|\[\[/.test(t)) bad.push(`part ${k + 1} has a draft marker`);
  });
});
const rf = `docs/tour-research/${id}.md`;
if (!fs.existsSync(rf)) bad.push(`no research file ${rf}`);
else {
  const r = fs.readFileSync(rf, "utf8"), links = (r.match(/https?:\/\/\S+/g) || []).length;
  if (!/^##+ *Sources/mi.test(r) || links < 3) bad.push("research file needs a Sources section with at least 3 links");
  if (!/^##+ *Uncertain/mi.test(r)) bad.push("research file needs an Uncertainty register section");
}
console.log(`${sc.title}: ${sc.parts.length} parts, ${words} words (~${Math.round(words / 160)} min at 160 wpm), ${chars} characters to voice (~${Math.round(chars * 2.73)} neurons, ~$${(chars * 2.73 * 0.011 / 1000).toFixed(2)} if all paid)`);
if (bad.length) { console.error("NOT locked:\n - " + bad.join("\n - ")); process.exit(1); }
if (checkOnly) { console.log("Template check passed (not locked: --check)."); process.exit(0); }
const locks = readLocks();
locks[id] = { fp: fingerprint(sc), v: sc.v, title: sc.title, locked: new Date().toISOString().slice(0, 10), chars };
fs.writeFileSync(LOCKS, JSON.stringify(locks, null, 1) + "\n");
console.log("Locked", id, locks[id].fp);
