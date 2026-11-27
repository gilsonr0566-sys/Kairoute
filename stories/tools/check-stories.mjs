// The gate every story passes before it is recorded or shipped ("I don't know" rule, Richard Nov 21: never invent
// certainty). Usage: node check-stories.mjs <city>. Exits 1 on any failure.
//  - Every claim cites saved sources, and its quote is found word for word in one of them.
//  - Every number in a claim appears in its quote. Every number a paragraph speaks belongs to a claim it cites.
//  - Labels: "verified" needs an official/primary source or two independent publishers; "unverified" is never spoken.
//  - Legend, tradition and disputed claims are spoken as such (the paragraph says "legend", "tradition", "historians"...).
//  - Practical facts (hours, prices, tickets) carry a checked date and are spoken as "usually" or "check".
//  - No "guarantee", "definitely", "certainly", "always open".
import fs from "node:fs";
const city = process.argv[2], dir = `stories/${city}`;
const idx = JSON.parse(fs.readFileSync(`${dir}/snapshots/index.json`, "utf8")), byKey = Object.fromEntries(idx.map(x => [x.key, x]));
const norm = s => String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[‘’`´]/g, "'").replace(/[“”]/g, '"').replace(/[–—−]/g, "-").replace(/\s+/g, " ").trim();
const snap = {}; const text = k => snap[k] ?? (snap[k] = fs.existsSync(`${dir}/snapshots/${k}.txt`) ? norm(fs.readFileSync(`${dir}/snapshots/${k}.txt`, "utf8")) : "");
const nums = s => (String(s).replace(/(\d),(\d{3})/g, "$1$2").match(/\d[\d.]*/g) || []).map(n => n.replace(/\.+$/, ""));
// Centuries count as their years: "the fifth century" or "5th century" backs "the 400s" (and the reverse).
const ORD = ["first","second","third","fourth","fifth","sixth","seventh","eighth","ninth","tenth","eleventh","twelfth","thirteenth","fourteenth","fifteenth","sixteenth","seventeenth","eighteenth","nineteenth","twentieth","twenty-first"];
const centuries = s => { const t = String(s).toLowerCase(), out = [];
  for (const m of t.matchAll(/(\d+)(?:st|nd|rd|th)(?=(?:,? (?:and|or|to) \d+(?:st|nd|rd|th))*[ -]centur)/g)) out.push(+m[1]);
  ORD.forEach((w, i) => { if (new RegExp("\\b" + w + "[ -]centur").test(t)) out.push(i + 1); });
  return out.flatMap(c => [String(c), String((c - 1) * 100)]); };
const backs = s => nums(s).concat(centuries(s));
// A spoken number may round a sourced one ("about 10" for 10.3): within 5%.
const near = (n, set) => set.has(n) || [...set].some(m => +m && Math.abs(+n - +m) <= 0.05 * Math.abs(+m) && Math.abs(+n - +m) < 1);
const LABELS = ["verified", "supported", "disputed", "legend", "tradition", "estimate", "scripture"];
const MARK = { legend: /\b(legend|myth|story goes|the story|were said|was said|is said|according to)\b/i, tradition: /\b(tradition|traditionally|is said|was said|believed)\b/i, disputed: /\b(historians|scholars|debate|disagree|differ|disputed|not sure|nobody's sure|no one's sure|another account|accounts differ|nobody knows|no one knows|not known|isn't settled|not settled|still argue|criticise|criticize|critics|uncertain|unclear|may have|might have|probably|perhaps)\b/i, estimate: /\b(about|around|roughly|nearly|almost|some|more than|over|close to)\b/i };
const BANNED = /\b(guarantee[ds]?|definitely|certainly|always open|never closed|100 ?%)\b/i;
let fail = 0, warn = 0; const err = (id, m) => { fail++; console.log(`FAIL ${id}: ${m}`); }, wrn = (id, m) => { warn++; console.log(`warn ${id}: ${m}`); };
const files = fs.readdirSync(dir).filter(f => /^[a-z0-9-]+\.json$/.test(f) && !["sources.json", "check-report.json", "say-add.json", "plan.json", "factcheck.json"].includes(f));
const report = [];
for (const f of files) {
  const st = JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8")), id = st.id;
  if (!st.checked || !/^\d{4}-\d\d-\d\d$/.test(st.checked)) err(id, "no checked date");
  for (const [ck, c] of Object.entries(st.claims || {})) {
    const at = `${id}/${ck}`;
    if (!LABELS.includes(c.label)) { err(at, `label "${c.label}" not allowed (unverified claims are cut, not spoken)`); continue; }
    if (!c.src || !c.src.length) { err(at, "no source"); continue; }
    for (const s of c.src) { const m = byKey[s]; if (!m) err(at, `unknown source ${s}`); else if (m.error || m.status !== 200 || (m.chars || 0) < 300) err(at, `source ${s} did not load (status ${m.status || m.error})`); }
    const quotes = [].concat(c.quote || []); if (!quotes.length) err(at, "no quote");
    for (const q of quotes) { if (!c.src.some(s => text(s).includes(norm(q)))) err(at, `quote not found in its sources: "${q.slice(0, 80)}"`); }
    const qn = new Set(quotes.flatMap(backs));
    for (const n of nums(c.says)) if (!near(n, qn)) err(at, `number ${n} in the claim is not in its quote`);
    if (c.label === "verified") { const pubs = new Set(c.src.map(s => byKey[s] && (/^Wiki(pedia|voyage)$/.test(byKey[s].publisher) ? "Wikimedia" : byKey[s].publisher))); const strong = c.src.some(s => byKey[s] && ["official", "primary"].includes(byKey[s].type)); if (!strong && pubs.size < 2) err(at, "verified needs an official/primary source or two independent publishers (Wikipedia and Wikivoyage count as one)"); }
  }
  let words = { 1: 0, 2: 0, 3: 0 };
  for (const [pi, part] of (st.parts || []).entries()) if (part.stand && nums(part.stand).length) err(`${id}/part${pi}`, "a stand-here line speaks a number");
  for (const [pi, part] of (st.parts || []).entries()) for (const [qi, p] of (part.paras || []).entries()) {
    const at = `${id}/part${pi}.${qi}`, cl = (p.c || []).map(k => st.claims[k]);
    if (cl.some(x => !x)) { err(at, "cites a claim that doesn't exist"); continue; }
    if (BANNED.test(p.t)) err(at, `banned certainty word: ${p.t.match(BANNED)[0]}`);
    const allowed = new Set(cl.flatMap(x => backs(x.says)).concat(nums(part.name || "")));
    for (const n of nums(p.t)) if (!near(n, allowed) && !(p.ok || []).includes(n)) err(at, `speaks the number ${n} without a claim that backs it`);
    for (const x of cl) if (MARK[x.label] && !MARK[x.label].test(p.t)) err(at, `a ${x.label} claim must be spoken as one ("${x.says.slice(0, 50)}…")`);
    if (!cl.length && !p.cue) wrn(at, "paragraph cites no claim and isn't marked as a cue (directions, feelings)");
    if (!cl.length && nums(p.t).length) err(at, "a cue paragraph (no claims) speaks a number: cite a claim or cut it");
    if (!cl.length && /\b(built|founded|dates? (back|from)|centur|was (the|a|an|once)|were (the|once)|named (after|for)|means|oldest|largest|highest|only)\b/i.test(p.t)) err(at, "a cue paragraph (no claims) states a fact: cite a claim or cut it");
    if (/\bsources (disagree|differ)|accounts differ\b/i.test(p.t) && !cl.some(x => x.label === "disputed" && new Set(x.src).size >= 2)) err(at, "says sources disagree, but no disputed claim cites two separate sources");
    const w = p.t.split(/\s+/).length; for (const L of [1, 2, 3]) if ((p.level || 1) <= L) words[L] += w;
  }
  for (const p of st.practical || []) { if (!p.checked) err(id, `practical "${p.t.slice(0, 40)}" has no checked date`); if (!/\b(usually|check|typically|at the time of checking|last checked)\b/i.test(p.t)) err(id, `practical "${p.t.slice(0, 40)}" must say "usually" or "check"`); }
  const mins = Object.fromEntries(Object.entries(words).map(([k, v]) => [k, +(v / 150).toFixed(1)]));
  report.push({ id, title: st.title, claims: Object.keys(st.claims || {}).length, minutes: mins, labels: Object.values(st.claims || {}).reduce((a, c) => (a[c.label] = (a[c.label] || 0) + 1, a), {}) });
}
console.table(report.map(r => ({ id: r.id, claims: r.claims, short: r.minutes[1], standard: r.minutes[2], full: r.minutes[3], labels: JSON.stringify(r.labels) })));
console.log(fail ? `${fail} failure(s), ${warn} warning(s)` : `ALL STORIES PASS (${warn} warning(s))`);
fs.writeFileSync(`${dir}/check-report.json`, JSON.stringify({ fail, warn, report }, null, 1));
process.exit(fail ? 1 : 0);
