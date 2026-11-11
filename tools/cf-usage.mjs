// Reads Cloudflare's own count of Workers AI use (neurons) per day this month, account-wide,
// so Kairoute's meter can be checked against what Cloudflare bills. Run by the "AI usage" workflow.
const T = process.env.CLOUDFLARE_API_TOKEN, H = { authorization: "Bearer " + T, "content-type": "application/json" };
const acc = (await (await fetch("https://api.cloudflare.com/client/v4/accounts", { headers: H })).json()).result || [];
console.log("accounts", acc.length);
const since = process.env.SINCE || new Date().toISOString().slice(0, 8) + "01";
for (const a of acc) {
  const q = `query($a:String!,$d:Date!){viewer{accounts(filter:{accountTag:$a}){aiInferenceAdaptiveGroups(limit:1000,filter:{date_geq:$d},orderBy:[date_ASC]){sum{totalNeurons} dimensions{date modelId}}}}}`;
  const r = await (await fetch("https://api.cloudflare.com/client/v4/graphql", { method: "POST", headers: H, body: JSON.stringify({ query: q, variables: { a: a.id, d: since } }) })).json();
  if (r.errors) { console.log("errors", JSON.stringify(r.errors).slice(0, 600)); continue; }
  const rows = r.data.viewer.accounts[0].aiInferenceAdaptiveGroups, byDay = {};
  rows.forEach(x => { const d = x.dimensions.date; byDay[d] = byDay[d] || { total: 0, models: {} }; byDay[d].total += x.sum.totalNeurons; byDay[d].models[x.dimensions.modelId] = Math.round((byDay[d].models[x.dimensions.modelId] || 0) + x.sum.totalNeurons); });
  let over = 0;
  for (const [d, v] of Object.entries(byDay)) { const o = Math.max(0, v.total - 10000); over += o; console.log("DAY", d, Math.round(v.total), "over free:", Math.round(o), "$" + (o / 1000 * 0.011).toFixed(2), JSON.stringify(v.models)); }
  console.log("MONTH over free:", Math.round(over), "neurons = $" + (over / 1000 * 0.011).toFixed(2));
}
