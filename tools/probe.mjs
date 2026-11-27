// One-off probe: which shared guides the worker has, and their size.
const U = "https://kairoute-ai.rickgilson.workers.dev";
for (const k of ["v9|civitavecchia rome||port|bible,churches|English|none", "v9|madrid||||bible,churches|English|none", "v9|mykonos||port|bible,churches|English|none", "v9|naples capri sorrento||port|bible,churches|English|none"]) {
  const r = await fetch(U + "/guide?k=" + encodeURIComponent(k)); const t = await r.text(); let n = "?"; try { const j = JSON.parse(t); n = (j.sites || []).length + " sites, city " + j.city + (j.builtin ? " builtin" : ""); } catch (e) {}
  console.log(`GUIDE ${r.status} ${t.length} bytes ${n} :: ${k}`);
}
