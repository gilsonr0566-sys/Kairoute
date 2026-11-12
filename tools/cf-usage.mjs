// Real daily usage from Cloudflare's analytics for the account: Workers AI neurons by model and Worker requests.
const T = process.env.CLOUDFLARE_API_TOKEN, H = { authorization: "Bearer " + T, "content-type": "application/json" };
const acc = await (await fetch("https://api.cloudflare.com/client/v4/accounts", { headers: H })).json();
console.log("ACCOUNTS " + JSON.stringify((acc.result || []).map(a => a.name)) + " " + JSON.stringify(acc.errors || []));
const id = acc.result && acc.result[0] && acc.result[0].id; if (!id) process.exit(0);
const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
const q = async (name, body) => { const r = await (await fetch("https://api.cloudflare.com/client/v4/graphql", { method: "POST", headers: H, body: JSON.stringify({ query: `{ viewer { accounts(filter: { accountTag: "${id}" }) { ${body} } } }` }) })).json(); console.log(name + " " + JSON.stringify(r.errors ? r.errors.map(e => e.message) : r.data.viewer.accounts[0])); };
await q("AI", `aiInferenceAdaptiveGroups(limit: 500, filter: { date_geq: "${since}" }, orderBy: [date_ASC]) { sum { totalNeurons } dimensions { date modelId } }`);
await q("WORKERS", `workersInvocationsAdaptive(limit: 500, filter: { date_geq: "${since}" }, orderBy: [date_ASC]) { sum { requests subrequests } dimensions { date scriptName } }`);
await q("KV", `kvOperationsAdaptiveGroups(limit: 500, filter: { date_geq: "${since}" }, orderBy: [date_ASC]) { sum { requests } dimensions { date actionType } }`);
