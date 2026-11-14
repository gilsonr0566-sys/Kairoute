// One-off probe (Nov 14): a ship's future sailing page and its port times (Sun Princess, Jul 2027).
const UA = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", "accept-language": "en" };
const get = async u => { const r = await fetch(u, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(25000) }); return { r, t: await r.text() }; };
const txt = t => t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
const { t } = await get("https://www.cruisemapper.com/ships/Sun-Princess-2167");
const i = t.indexOf("2027 Jul"); console.log("HTML around 2027 Jul: " + (i >= 0 ? t.slice(Math.max(0, i - 1500), i + 1500) : "none"));
const links = [...new Set(t.match(/href="https:\/\/www\.cruisemapper\.com\/(cruise|itinerar)[^"]*"/gi) || [])]; console.log("\ncruise links " + links.length + ": " + links.slice(0, 10).join(" "));
const jul = links.filter(l => /2027|jul/i.test(l)).slice(0, 3);
for (const l of (jul.length ? jul : links.slice(0, 2))) { const u = l.slice(6, -1); const { r, t: c } = await get(u); const x = txt(c); const k = x.search(/Naples/);
  console.log(`\nCRUISE ${r.status} ${r.url}\n  ${k >= 0 ? x.slice(Math.max(0, k - 600), k + 600) : x.slice(0, 600)}`); }
