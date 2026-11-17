// AI spend check (hourly): Cloudflare's real Workers AI numbers for the account, this month, by day and model.
// - Sends today's real total to the Kairoute helper (/realuse), a second guard behind its own count.
// - Works out this month's paid AI (each day past the free 10,000 neurons, $0.011 per 1,000).
// - Opens a GitHub issue for Richard (GitHub emails him) when this month's paid AI reaches 80% of the $5 cap,
//   and whenever AI runs while the master switch is off. One issue per reason per month (or day).
import { appendFileSync } from "node:fs";
const T = process.env.CLOUDFLARE_API_TOKEN, H = { authorization: "Bearer " + T, "content-type": "application/json" };
const CAP_USD = 5, WARN = 0.8, FREE = 10000, USD_PER_1000 = 0.011, HELPER = "https://kairoute-ai.rickgilson.workers.dev";
const acc = await (await fetch("https://api.cloudflare.com/client/v4/accounts", { headers: H })).json();
const id = acc.result && acc.result[0] && acc.result[0].id;
if (!id) { console.log("No Cloudflare account visible: " + JSON.stringify(acc.errors || [])); process.exit(1); }
const now = new Date(), month = now.toISOString().slice(0, 7), today = now.toISOString().slice(0, 10);
const query = `{ viewer { accounts(filter: { accountTag: "${id}" }) { aiInferenceAdaptiveGroups(limit: 1000, filter: { date_geq: "${month}-01" }, orderBy: [date_ASC]) { sum { totalNeurons } dimensions { date modelId } } } } }`;
const r = await (await fetch("https://api.cloudflare.com/client/v4/graphql", { method: "POST", headers: H, body: JSON.stringify({ query }) })).json();
if (r.errors) { console.log("Analytics error: " + JSON.stringify(r.errors.map(e => e.message))); process.exit(1); }
const rows = r.data.viewer.accounts[0].aiInferenceAdaptiveGroups, days = {};
for (const x of rows) {
  const d = x.dimensions.date; days[d] = days[d] || { total: 0, models: {} };
  days[d].total += x.sum.totalNeurons; days[d].models[x.dimensions.modelId] = Math.round(x.sum.totalNeurons);
}
const fmt = n => Math.round(n).toLocaleString("en-US");
let paidN = 0; const lines = [];
for (const [d, v] of Object.entries(days)) {
  const over = Math.max(0, v.total - FREE); paidN += over;
  lines.push(`| ${d} | ${fmt(v.total)} | ${fmt(over)} | ${Object.entries(v.models).map(([m, n]) => m.replace("@cf/", "") + " " + fmt(n)).join(", ")} |`);
}
// Workers Paid includes, per month: 10M requests, 10M KV reads, 1M KV writes, 1M lists, 1M removals. Past those it
// bills ($0.30 per M requests, $0.50 per M reads, $5 per M writes, lists or removals). Month so far, and its pace.
const q2 = `{ viewer { accounts(filter: { accountTag: "${id}" }) { kvOperationsAdaptiveGroups(limit: 2000, filter: { date_geq: "${month}-01" }) { sum { requests } dimensions { actionType date } } workersInvocationsAdaptive(limit: 2000, filter: { date_geq: "${month}-01" }) { sum { requests } dimensions { scriptName date } } } } }`;
const r2 = await (await fetch("https://api.cloudflare.com/client/v4/graphql", { method: "POST", headers: H, body: JSON.stringify({ query: q2 }) })).json();
const use = { requests: 0, kairouteRequests: 0 }, recent = {}, y1 = new Date(now - 86400e3).toISOString().slice(0, 10), y2 = new Date(now - 2 * 86400e3).toISOString().slice(0, 10);
const addRecent = (k, d, n) => { if (d === y1 || d === y2) recent[k] = (recent[k] || 0) + n; };
if (!r2.errors) {
  const A = r2.data.viewer.accounts[0];
  for (const x of A.kvOperationsAdaptiveGroups) { use[x.dimensions.actionType] = (use[x.dimensions.actionType] || 0) + x.sum.requests; addRecent(x.dimensions.actionType, x.dimensions.date, x.sum.requests); }
  for (const x of A.workersInvocationsAdaptive) { use.requests += x.sum.requests; addRecent("requests", x.dimensions.date, x.sum.requests); if (x.dimensions.scriptName === "kairoute-ai") use.kairouteRequests += x.sum.requests; }
}
const dim = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate(), elapsed = now.getUTCDate() - 1 + (now.getUTCHours() + 1) / 24;
const INCL = [["requests", "Worker requests (all apps)", 10e6, 0.30], ["read", "KV reads", 10e6, 0.50], ["write", "KV writes", 1e6, 5], ["list", "KV lists", 1e6, 5], ["delete", "KV removals", 1e6, 5]];
let otherUsd = 0, projUsd = 0; const useLines = [];
for (const [k, label, inc, per] of INCL) {
  // Pace: the busier of the month so far and the last two full days, so a busy week isn't hidden by quiet early days.
  const v = use[k] || 0, proj = v + Math.max(v / elapsed, (recent[k] || 0) / 2) * Math.max(0, dim - elapsed);
  otherUsd += Math.max(0, v - inc) / 1e6 * per; projUsd += Math.max(0, proj - inc) / 1e6 * per;
  useLines.push(`| ${label} | ${fmt(v)} | ${fmt(proj)} | ${fmt(inc)} |`);
}
const usd = paidN / 1000 * USD_PER_1000, todayN = Math.round((days[today] || { total: 0 }).total);
// Plan fees on the account, for the report (read-only; the token may not be allowed to see them).
let plans = "not readable with this token";
try {
  const s = await (await fetch(`https://api.cloudflare.com/client/v4/accounts/${id}/subscriptions`, { headers: H })).json();
  if (s.success) plans = (s.result || []).map(x => `${(x.rate_plan && x.rate_plan.public_name) || (x.product && x.product.name) || "plan"} $${x.price ?? "?"}/${x.frequency || "month"}`).join("; ") || "none";
} catch (e) {}
let st = {}; try { st = await (await fetch(HELPER + "/status")).json(); } catch (e) {}
const report = [`## AI spend check, ${now.toISOString().slice(0, 16).replace("T", " ")} UTC`, "",
  `- Master AI switch on the helper: **${st.on ? "ON" : "OFF"}**`,
  `- Today so far (whole account, real): **${fmt(todayN)} neurons** (free: 10,000 a day)`,
  `- Paid AI this month (real, whole account): **$${usd.toFixed(2)}** of the $${CAP_USD} cap (${Math.round(usd / CAP_USD * 100)}%)`,
  `- Cloudflare plans on the account: ${plans}`,
  `- Requests and storage past the plan's included amounts: **$${otherUsd.toFixed(2)}** so far; at this pace **$${projUsd.toFixed(2)}** by month end (Kairoute helper requests this month: ${fmt(use.kairouteRequests)})`, "",
  "| This month | So far | Month end at this pace | Included |", "|---|---|---|---|", ...useLines, "",
  "| Day (UTC) | Neurons | Paid neurons | By model |", "|---|---|---|---|", ...lines].join("\n");
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n");
// Second guard: the helper stops AI once the account's real total for today nears the free 10,000.
let prev = null;
if (process.env.REC_KEY) {
  try {
    const p = await fetch(HELPER + "/realuse", { method: "POST", headers: { "content-type": "application/json", "x-kairoute-rec": process.env.REC_KEY }, body: JSON.stringify({ date: today, neurons: todayN }) });
    const pj = await p.json().catch(() => ({})); if (pj.ok && pj.on === false) prev = +pj.prev || 0;
    console.log("Sent today's real count to the helper: " + p.status + " (last hour's: " + (pj.prev ?? "?") + ")");
  } catch (e) { console.log("Couldn't reach the helper: " + e.message); }
}
// Warnings to Richard as GitHub issues (GitHub emails the repository owner).
const GH = process.env.GITHUB_TOKEN, REPO = process.env.GITHUB_REPOSITORY;
async function warn(title) {
  if (!GH || !REPO) return console.log("WARN " + title);
  const gh = { authorization: "Bearer " + GH, accept: "application/vnd.github+json" };
  const seen = await (await fetch(`https://api.github.com/repos/${REPO}/issues?state=all&labels=ai-spend&per_page=50`, { headers: gh })).json();
  if (Array.isArray(seen) && seen.some(i => i.title === title)) return console.log("Already warned: " + title);
  const c = await fetch(`https://api.github.com/repos/${REPO}/issues`, { method: "POST", headers: gh, body: JSON.stringify({ title, body: report, labels: ["ai-spend"], assignees: ["gilsonr0566-sys"] }) });
  console.log("Warning issue: " + c.status);
}
// While the switch is off, today's real total should not grow (Richard's other apps use 2-12 a day): more than 50
// since the last hourly check means something ran.
if (st.on === false && prev !== null && prev > 0 && todayN - prev > 50) await warn(`AI ran while switched off (${today})`);
if (projUsd > 0) await warn(`Cloudflare requests or storage heading past the plan's included amounts (${month})`);
if (usd >= CAP_USD * WARN) await warn(`Kairoute AI spend reached ${usd >= CAP_USD ? 100 : 80}% of the $${CAP_USD} cap (${month})`);
