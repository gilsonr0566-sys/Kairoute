// Fetches each source in stories/<city>/sources.json and keeps a dated text copy in stories/<city>/snapshots/<key>.txt.
// Runs on GitHub's machines (this is research input, never shipped to travelers). Usage: node fetch-sources.mjs athens
import fs from "node:fs";
const city = process.argv[2], dir = `stories/${city}`, out = `${dir}/snapshots`;
fs.mkdirSync(out, { recursive: true });
const list = JSON.parse(fs.readFileSync(`${dir}/sources.json`, "utf8")).retrieve;
const UA = { "user-agent": "KairouteResearch/1.0 (story fact-checking; github.com/gilsonr0566-sys/kairoute)" };
const strip = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<(br|p|div|li|h\d|tr)[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&ndash;/g, "–").replace(/&mdash;/g, "—").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n))
  .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
const prev = fs.existsSync(`${out}/index.json`) ? JSON.parse(fs.readFileSync(`${out}/index.json`, "utf8")) : [];
const index = [];
const get = async (u, tries = 5) => { for (let i = 0; ; i++) { const r = await fetch(u, { headers: UA, redirect: "follow" }); const body = await r.text();
  if ((r.status === 429 || /too many requests/i.test(body.slice(0, 300))) && i < tries) { await new Promise(z => setTimeout(z, 5000 * (i + 1))); continue; } return { r, body }; } };
for (const s of list) {
  const had = prev.find(x => x.key === s.key && x.status === 200 && (x.chars || 0) > 300);
  if (had && !process.env.REFRESH) { index.push(had); continue; }
  let url, text = "", status = 0, title = s.wiki || "";
  try {
    if (s.wiki) {
      const site = s.site || "en.wikipedia.org";
      url = `https://${site}/wiki/${encodeURIComponent(s.wiki.replace(/ /g, "_"))}`;
      const api = `https://${site}/w/api.php?action=query&prop=extracts|pageprops|revisions&rvprop=ids|timestamp&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(s.wiki)}`;
      const { r, body } = await get(api); status = r.status;
      let j = JSON.parse(body), p = Object.values(j.query.pages)[0];
      if (!p.extract) { // title not found as written: take the encyclopedia's own best match
        const sr = JSON.parse((await get(`https://${site}/w/api.php?action=query&list=search&srlimit=1&format=json&srsearch=${encodeURIComponent(s.wiki)}`)).body);
        const t = sr.query.search[0] && sr.query.search[0].title;
        if (t) { j = JSON.parse((await get(api.replace(/titles=.*/, "titles=" + encodeURIComponent(t)))).body); p = Object.values(j.query.pages)[0]; }
      }
      text = p.extract || ""; title = p.title;
      const rev = p.revisions && p.revisions[0];
      index.push({ key: s.key, url, publisher: site === "en.wikipedia.org" ? "Wikipedia" : "Wikivoyage", type: "encyclopedia", title, wikidata: p.pageprops && p.pageprops.wikibase_item, revision: rev && rev.revid, revisionTime: rev && rev.timestamp, retrieved: new Date().toISOString(), chars: text.length, status });
    } else {
      url = s.url; const { r, body } = await get(url); status = r.status; text = /json/.test(r.headers.get("content-type") || "") ? body : strip(body);
      const t = body.match(/<title[^>]*>([^<]*)/i); title = t ? t[1].trim() : "";
      index.push({ key: s.key, url, publisher: s.publisher, type: /Ministry|Presidency|Parliament|Museum|Restoration|UNESCO|School/.test(s.publisher) ? "official" : /King James/.test(s.publisher) ? "primary" : "encyclopedia", title, retrieved: new Date().toISOString(), chars: text.length, status });
    }
  } catch (e) { index.push({ key: s.key, url: url || s.url, error: String(e.message || e), retrieved: new Date().toISOString() }); }
  if (!index[index.length - 1] || index[index.length - 1].key !== s.key) index.push({ key: s.key, url, error: "no entry" });
  fs.writeFileSync(`${out}/${s.key}.txt`, `SOURCE: ${url}\nRETRIEVED: ${new Date().toISOString()}\nSTATUS: ${status}\nTITLE: ${title}\n\n${text}\n`);
  console.log(s.key, status, text.length);
  await new Promise(r => setTimeout(r, 1500));
}
fs.writeFileSync(`${out}/index.json`, JSON.stringify(index, null, 1));
