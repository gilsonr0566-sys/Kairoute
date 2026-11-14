// One-off probe (Nov 14): does a public ship page list Sun Princess's 2027 port times (Naples, Jul 12)?
const UA = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", "accept-language": "en" };
const get = async u => { const r = await fetch(u, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(25000) }); return { r, t: await r.text() }; };
const txt = t => t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const { t: sm } = await get("https://www.cruisemapper.com/sitemap.xml");
console.log("sitemap", sm.length, (sm.match(/<loc>[^<]+<\/loc>/g) || []).slice(0, 20).join(" "));
let shipUrls = (sm.match(/https?:\/\/www\.cruisemapper\.com\/ships\/Sun-Princess-\d+/gi) || []);
for (const sub of (sm.match(/<loc>([^<]*ships?[^<]*)<\/loc>/gi) || []).map(x => x.replace(/<\/?loc>/g, "")).slice(0, 6)) {
  try { const { t } = await get(sub); const m = t.match(/https?:\/\/www\.cruisemapper\.com\/ships\/Sun-Princess-\d+/gi) || []; console.log("sub", sub, t.length, m.slice(0, 3)); shipUrls = shipUrls.concat(m); } catch (e) { console.log("sub err", sub, e.message); }
}
shipUrls = [...new Set(shipUrls)]; console.log("ship urls", shipUrls);
for (const u of shipUrls.slice(0, 2)) {
  const { r, t } = await get(u); const x = txt(t);
  console.log(`\nSHIP ${r.status} ${r.url} ${t.length}b`);
  for (const re of [/Naples/g, /2027/g]) { let m, n = 0; while ((m = re.exec(x)) && n < 6) { console.log("  ..." + x.slice(Math.max(0, m.index - 160), m.index + 200)); n++; } }
  const tbl = t.match(/<table[\s\S]{0,4000}/i); console.log("  TABLE HTML: " + (tbl ? tbl[0].slice(0, 2500) : "none"));
  const links = [...new Set(t.match(/href="[^"]*(itinerar|schedule|year)[^"]*"/gi) || [])].slice(0, 20); console.log("  links " + links.join(" "));
}
