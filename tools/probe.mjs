// One-off probe (Nov 14): where a cruise ship's port times for a date are published in a form the helper can read.
const UA = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", "accept-language": "en" };
const get = async u => { const r = await fetch(u, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(20000) }); return { r, t: await r.text() }; };
const txt = t => t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
try { const { t } = await get("https://www.cruisemapper.com/robots.txt"); console.log("ROBOTS cruisemapper:\n" + t.slice(0, 1500)); } catch (e) { console.log("robots err", e.message); }
for (const u of ["https://www.cruisemapper.com/cruise-lines/Princess-Cruises-ships-17", "https://www.cruisemapper.com/cruise-lines/Princess-Cruises-17", "https://www.cruisemapper.com/search?q=sun+princess", "https://www.cruisemapper.com/ports/naples-port-12"]) {
  try { const { r, t } = await get(u); const links = [...new Set((t.match(/href="[^"]*(sun-princess|naples)[^"]*"/gi) || []))].slice(0, 15);
    console.log(`\nPAGE ${r.status} ${r.url} ${t.length}b\n  links: ${links.join(" ")}\n  ${txt(t).slice(0, 200)}`); } catch (e) { console.log("ERR " + u + " " + e.message); }
}
