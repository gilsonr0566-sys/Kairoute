// Voices hearted stops slowly (Richard, Nov 17: "We don't go till June, can we slowly start voicing to keep the monthly
// rate below my 5 dollars. Only start working on the ones I hearted." and "Make sure the script is locked down first").
// Run nightly by the workflow "Voice hearted stops slowly", just before the free AI allowance resets (00:00 UTC):
//  - only LOCKED hand-written scripts (audio/locks.json, see tools/script-lock.mjs); a draft is never voiced;
//  - only stops on a day a traveler has hearted (the app reports them to the helper's /voicewant);
//  - in the order the stops come in the trip (earliest date first);
//  - the helper spends what's left of today's free allowance first, then at most ~$1 a month, and none once the
//    month's AI spend passes ~$2 (worker.js dripRoom), so normal use keeps most of the $5 ceiling;
//  - paused on the dates in tools/voice-drip.json (the Nov 20 demo).
// Recordings go to audio/<script id>/ with the code (served by the website, shared by every traveler, saved for offline).
// Progress for the monthly report: reports/voice-drip.json.
// Usage: node tools/voice-drip.mjs [--dry]
import fs from "node:fs"; import crypto from "node:crypto";
import { loadScripts, readLocks, isLocked, paraHash } from "./scripts-lib.mjs";
const dry = process.argv.includes("--dry");
const cfg = JSON.parse(fs.readFileSync("tools/voice-drip.json", "utf8")), day = new Date().toISOString().slice(0, 10), mo = day.slice(0, 7);
const RP = "reports/voice-drip.json", rep = fs.existsSync(RP) ? JSON.parse(fs.readFileSync(RP, "utf8")) : { months: {}, done: {} };
const save = () => { if (!dry) fs.writeFileSync(RP, JSON.stringify(rep, null, 1) + "\n"); };
if ((cfg.pause || []).includes(day)) { console.log(`Paused today (${day}): ${cfg.pauseWhy || ""}`); process.exit(0); }
const T = process.env.CLOUDFLARE_API_TOKEN, AI = JSON.parse(fs.readFileSync("ai.json", "utf8")).url;
const KEY = T ? crypto.createHash("sha256").update(T).digest("hex").slice(0, 40) : "";
if (!T) { console.error("No CLOUDFLARE_API_TOKEN"); process.exit(1); }
const H = { "x-kairoute-rec": KEY };
const wr = await fetch(AI + "/voicewant", { headers: H }); if (!wr.ok) { console.error("Couldn't read hearted stops:", wr.status, await wr.text()); process.exit(1); }
const want = await wr.json();
console.log(`Hearted stops reported: ${want.stops.length}. Free allowance left today for the drip: ${want.freeLeftToday} neurons. Month's paid AI so far: ${want.monthExtraUsed} neurons ($${(want.monthExtraUsed * 0.011 / 1000).toFixed(2)}).`);
const { S, say } = loadScripts(), locks = readLocks();
const wantOf = sc => want.stops.filter(w => sc.city.test(w.city) && sc.site.test(w.name));
const firstDate = ws => ws.map(w => w.date || "9999").sort()[0];
const queue = S.filter(sc => isLocked(sc, locks) && wantOf(sc).length).sort((a, b) => firstDate(wantOf(a)).localeCompare(firstDate(wantOf(b))));
// Hearted stops with no locked script yet: they wait for a finished script (written, checked, locked) first.
rep.needsScript = want.stops.filter(w => !S.some(sc => isLocked(sc, locks) && sc.city.test(w.city) && sc.site.test(w.name)))
  .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999")).map(w => ({ date: w.date, city: w.city, name: w.name, draft: S.some(sc => sc.city.test(w.city) && sc.site.test(w.name)) }));
let made = 0, stop = "";
for (const sc of queue) {
  if (stop) break;
  const dir = `audio/${sc.id}`; fs.mkdirSync(dir, { recursive: true });
  const mf = `${dir}/manifest.json`, man = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, "utf8")) : {};
  let missing = 0;
  for (const [k, p] of sc.parts.entries()) for (const [i, para] of p.paras.entries()) {
    const text = say(para), h = paraHash(text), f = `${dir}/p${k}-${i}.mp3`, id = `p${k}-${i}`;
    if (man[id] === h && fs.existsSync(f) && fs.statSync(f).size > 1000) continue;
    missing++;
    if (stop || made >= (cfg.maxParasPerRun || 30)) { stop = stop || "enough for one night"; continue; }
    if (dry) { console.log("would record", f, text.length); continue; }
    const r = await fetch(AI + "/speak", { method: "POST", headers: { ...H, "x-kairoute-drip": "1", "content-type": "application/json" }, body: JSON.stringify({ text, model: "aura-2", speaker: "aurora" }) });
    const b = Buffer.from(await r.arrayBuffer());
    if (r.status === 429) { stop = "budget: " + b.toString("utf8", 0, 200); continue; }
    if (!r.ok || b.length < 1000 || !/audio/.test(r.headers.get("content-type") || "")) { console.log("couldn't record", f, r.status, b.toString("utf8", 0, 160)); stop = "voice service busy"; continue; }
    fs.writeFileSync(f, b); man[id] = h; made++; missing--; console.log("recorded", f, b.length, "bytes, paid part", r.headers.get("x-drip-paid") || 0);
  }
  if (!dry) {
    // Files for paragraphs that no longer exist are removed.
    const keep = new Set(sc.parts.flatMap((p, k) => p.paras.map((x, i) => `p${k}-${i}`)));
    for (const fn of fs.readdirSync(dir)) if (/^p\d+-\d+\.mp3$/.test(fn) && !keep.has(fn.slice(0, -4))) fs.unlinkSync(`${dir}/${fn}`);
    for (const id of Object.keys(man)) if (!keep.has(id)) delete man[id];
    fs.writeFileSync(mf, JSON.stringify(man, null, 1) + "\n");
  }
  if (!missing && !rep.done[sc.id]) rep.done[sc.id] = { title: sc.title, date: firstDate(wantOf(sc)), voiced: day, fp: locks[sc.id].fp };
  console.log(`${sc.title}: ${missing ? missing + " paragraphs still to voice" : "fully voiced"}`);
}
// The month's numbers come from the helper's own count (every drip paragraph, free and paid).
const after = dry ? want : await (await fetch(AI + "/voicewant", { headers: H })).json(), d = after.drip || {};
rep.months[mo] = { paragraphs: d.paras || 0, neurons: Math.round(d.neurons || 0), paidNeurons: Math.round(d.paid || 0), paidUsd: +((d.paid || 0) * 0.011 / 1000).toFixed(2),
  stopsFinished: Object.values(rep.done).filter(x => x.voiced.startsWith(mo)).map(x => x.title), monthAiPaidUsd: +((after.monthExtraUsed || 0) * 0.011 / 1000).toFixed(2) };
rep.queue = queue.map(sc => ({ id: sc.id, title: sc.title, date: firstDate(wantOf(sc)), done: !!rep.done[sc.id] }));
rep.updated = new Date().toISOString(); rep.lastStop = stop || (queue.length ? "queue done" : "nothing locked and hearted yet");
save();
console.log(`Tonight: ${made} paragraphs recorded. ${stop ? "Stopped: " + stop : "Nothing more to voice."} Month: ${rep.months[mo].paragraphs} paragraphs, $${rep.months[mo].paidUsd} paid by the drip. Waiting for a locked script: ${rep.needsScript.length} hearted stops.`);
