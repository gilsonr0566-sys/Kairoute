// ---------- Taken off this day: what left the day, why, and one tap to put it back (Richard, Nov 17) ----------
// "Needs some way to review what gets taken off the list and why." Every time the app (not the traveler) takes a pick
// off a day, the day keeps a short note: the sight, the plain reason, and when. The Day plan shows them in one fold,
// "Taken off this day", each with Put back (which goes through the same fit check as ticking it: if it doesn't fit,
// the box says what would make room). A sight that only became part of another stop (two names for one place, or a
// part of a bigger place: the Parthenon inside the Acropolis) is still on the day, so it is listed as "Now part of"
// that stop, with nothing to put back. A note goes away when the sight is back on the day.
const OFF_MAX = 30;
// Records that the app took a sight off the day. kind: "fit" (no longer fits the time), "interest", "closed",
// "merged" (now part of another stop: nothing to put back).
function offNote(d, x, why, kind, into) {
  if (!d || !x || x.id == null) return;
  const log = (d.offLog || []).filter(o => o.id !== x.id);
  log.push(Object.assign({ id: x.id, n: x.name || String(x.id), why: why || "", k: kind || "fit", at: Date.now() }, into ? { into } : {}));
  d.offLog = log.slice(-OFF_MAX);
}
// Every place a day stores a sight by its id now names the sight that stayed after a fold (dedupeSites): the picks,
// the traveler's own picks, the anchor, picks waiting to come back, the heart's saved plan and its fingerprint.
// Before this, a fold that kept the other copy's id made the hearted Athens day lose the Acropolis (Nov 17).
function foldRemap(c, folds) {
  if (!c || !folds || !folds.length || typeof trip === "undefined" || !trip || typeof cityFor !== "function") return 0;
  const step = new Map(folds.map(f => [f.from, f])), to = id => { let k = id, g = 0; while (step.has(k) && g++ < 20) k = step.get(k).to; return k; };
  const nameTo = n => { let f = folds.find(x => x.name === n), g = 0; while (f && g++ < 20) { const nx = folds.find(x => x.name === f.into); if (!nx) break; f = nx; } return f ? f.into : n; };
  const remapList = a => Array.isArray(a) ? [...new Set(a.map(to))] : a;
  let n = 0;
  const trips = [trip].concat((typeof library !== "undefined" && Array.isArray(library) ? library : []).map(x => x && x.trip).filter(Boolean));
  for (const t of trips) for (const d of (t.days || [])) {
    let dc = null; try { dc = cityFor(d); } catch (e) {} if (dc !== c) continue;
    const ids = [].concat(d.selected || [], d.mine || [], d.anchor ? [d.anchor] : [], (d.bumped || []).map(b => b.id), Object.keys(d.movedIn || {}),
      d.ready && d.ready.lock && Array.isArray(d.ready.lock.seq) ? d.ready.lock.seq.flatMap(x => [x.id].concat(x.inc || [])) : [], d.ready && d.ready.sig ? d.ready.sig.split("|") : []);
    if (!ids.some(id => step.has(id))) continue;
    const was = typeof selKey === "function" ? selKey(d) : null;
    // A pick folded into another stop: still on the day, as part of that stop. Said once, plainly.
    for (const id of (d.selected || [])) { const f = step.get(id); if (f && keyOf(nameTo(f.name)) !== keyOf(f.name)) offNote(d, { id, name: f.name }, f.rel === "same" ? `Same place as ${nameTo(f.name) === f.name ? f.into : nameTo(f.name)}, so it's one stop now` : `Part of ${f.into}, so it's visited there`, "merged", to(id)); }
    if (Array.isArray(d.selected)) d.selected = remapList(d.selected);
    if (Array.isArray(d.mine)) d.mine = remapList(d.mine);
    if (d.anchor) d.anchor = to(d.anchor);
    if (Array.isArray(d.bumped)) { const seen = new Set(); d.bumped = d.bumped.map(b => Object.assign({}, b, { id: to(b.id) })).filter(b => !seen.has(b.id) && seen.add(b.id)); }
    if (d.movedIn) { const m = {}; for (const k of Object.keys(d.movedIn)) m[to(k)] = d.movedIn[k]; d.movedIn = m; }
    if (d.ready) {
      const R = d.ready;
      if (R.lock && Array.isArray(R.lock.seq)) R.lock.seq = R.lock.seq.map(x => x.meal ? x : Object.assign({}, x, { id: to(x.id) }, x.inc ? { inc: [...new Set(x.inc.map(to))] } : {}, step.has(x.id) ? { n: nameTo(x.n) } : {}));
      if (R.sig) R.sig = [...new Set(R.sig.split("|").map(to))].sort().join("|");
      if (Array.isArray(R.names)) R.names = [...new Set(R.names.map(nameTo))];
      if (Array.isArray(R.bonus)) R.bonus = remapList(R.bonus);
      if (was != null && typeof readyKeep === "function") readyKeep(d, was);
    }
    if (typeof forget0 === "function") try { forget0(d); } catch (e) {}
    n++;
  }
  if (n) { try { planGen++; } catch (e) {} if (typeof readyLater === "function") readyLater(); }
  return n;
}
// Notes still worth showing: the sight isn't back on the day, and it is still in the guide.
function offShown(d) {
  const c = cityFor(d); if (!c || !Array.isArray(d.offLog) || !d.offLog.length) return [];
  const sel = new Set(d.selected || []), byId = new Map(allSites(c).map(x => [x.id, x]));
  return d.offLog.filter(o => o.k === "merged" ? byId.has(o.into) && sel.has(o.into) : !sel.has(o.id) && byId.has(o.id)).slice().reverse();
}
const agoWord = t => { const m = Math.round((Date.now() - (t || 0)) / 60000); return m < 2 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : fmtDow(new Date(t).toISOString().slice(0, 10)) + " " + fmtDate(new Date(t).toISOString().slice(0, 10)); };
// The fold on the Day plan. Closed unless something left the day in the last few minutes.
function offListHTML(d) {
  // A sight the "no longer fits" note above is naming right now isn't listed twice; after OK it moves here.
  const inNote = new Set((d.bumped || []).filter(b => !b.back).map(b => b.id)), rows = offShown(d).filter(o => !inNote.has(o.id)); if (!rows.length) return "";
  return `<details class="offlog"><summary><span>Taken off this day</span><b>${rows.length}</b></summary><ul>${rows.map(o => `<li><div class="offwhat"><b>${esc(o.n)}</b><span>${esc(o.why)}</span><small>${esc(agoWord(o.at))}</small></div>${o.k === "merged" ? `<span class="offin">Still on your day</span>` : `<button type="button" class="btn small" data-act="offback" data-id="${esc(o.id)}">Put back</button>`}</li>`).join("")}</ul>
    <button type="button" class="linkbtn offclear" data-act="offclear">Clear this list</button></details>`;
}
if (typeof document !== "undefined") document.addEventListener("click", e => {
  const t = e.target.closest && e.target.closest("[data-act=offback], [data-act=offclear]"); if (!t) return;
  const d = day(); if (!d) return;
  if (t.dataset.act === "offclear") { d.offLog = []; save(); render(); return; }
  // The same fit check as ticking the sight: it goes back when it fits, or the box says what would make room.
  if (addPick(d, t.dataset.id, true)) { d.offLog = (d.offLog || []).filter(o => o.id !== t.dataset.id); save(); render(); }
});
// Test hooks (tools/offlog-check.cjs).
if (typeof window !== "undefined") window.__kairouteOff = {
  log: i => (trip.days[i].offLog || []).slice(), shown: i => offShown(trip.days[i]).map(o => ({ n: o.n, why: o.why, k: o.k })),
  // A second copy of a picked sight arrives (as a city guide or the sources would bring it) and wins the fold, so the
  // kept sight carries the other id: the day, its heart and its lock must follow.
  twin: (i, id, extra) => { const d = trip.days[i], c = cityFor(d), s = allSites(c).find(x => x.id === id); if (!s) return { error: "no " + id };
    const tw = Object.assign({}, s, { id: id + "-twin", builtin: false, guide: String(s.guide || "") + " ".repeat(400), merged: undefined, alias: undefined }, extra || {}); delete tw.merged; delete tw.alias;
    c.sites.push(tw); const n = dedupeSites(c); planGen++; dataGen++;
    return { n, kept: allSites(c).filter(x => x.id === id || x.id === tw.id).map(x => ({ id: x.id, name: x.name })) }; },
};
