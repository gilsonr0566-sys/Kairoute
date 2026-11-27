// ===================== Everything shown is in the traveler's language (Rule R-11, the one exit) =====================
// Richard, Nov 23: "the app is presented in the language that is selected to view it in"; Nov 25: one app-wide rule,
// applied at every source and on every finished screen.
// Class: a name in another script (Greek, Cyrillic, Hebrew, Arabic, Japanese, Chinese, Korean, Thai...) reaching the
// traveler. It came back five times because each fix was made where one source entered (sights on Nov 17, ferry lines on
// Nov 18, stations, then the planner's own last step on Nov 23), while the app has some 450 places that print a name
// and a dozen sources: a saved guide from an older build, a place the traveler added from the map, a hotel, pier or
// station looked up by name, a helper answer shown as it came.
// Rule: ONE definition of "the traveler can read this" (the engine's KEngine.otherScript) and ONE way to write a name
// (KEngine.say: Greek, Cyrillic and kana in Latin letters by the standard rules; any other script gives way to the
// words around it, or to the plain word for the thing). It is applied where data comes in (the planner's names pass,
// the saved-guide re-check) and, here, at every way words LEAVE the app, whatever code wrote them and whatever source
// they came from, today's or one added next year:
//   - the screen: every piece of text and every spoken label (aria-label, title, alt, placeholder) put on the page;
//   - pictures the app draws (the shared trip card);
//   - the voice (the device's speech);
//   - text handed to other apps (share, copy).
// The one exception is the phrase card ("Useful words"), where the local words are the point.
// Every time the exit rule has to act, it counts it (window.__kairouteLang): on the saved test trips the count must be
// 0, so a source that lets a name through is still found and fixed at the source; the exit rule is the guarantee,
// never the excuse. Checked by tools/ui/screen-language-check.cjs on every screen of every saved test trip.
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const E = typeof KEngine !== "undefined" ? KEngine : null;
  if (!E || !E.otherScript || !E.say) return;
  const stat = window.__kairouteLang = { fixed: 0, by: {}, last: [] };
  const off = () => window.__kairoutePlant === "names-exit-off" || window.__kairoutePlant === "names-off"; // the checks' planted defect: the exit rule switched off
  // Left as they are: the phrase card's local words, and what the traveler is typing (their own words in their own box).
  const PHRASE = ".pl, [data-local-words]", LOCAL_OK = PHRASE + ", textarea, [contenteditable], script, style";
  const note = (was, where) => { stat.fixed++; stat.by[where] = (stat.by[where] || 0) + 1; if (stat.last.length < 40) stat.last.push(where + ": " + String(was).slice(0, 60)); };
  // A whole label that is only a name nobody can read is said as what it is; inside a sentence the engine's rule
  // keeps the sentence and names the thing plainly ("Train from the stop").
  const say = t => { const r = E.say(t); return r || E.say(t, "Local name not in English"); };
  window.__kairouteSay = say;
  const ATTRS = ["aria-label", "title", "alt", "placeholder"];
  const fixText = n => { const t = n.data; if (!t || !E.otherScript(t) || off()) return; const p = n.parentElement; if (p && p.closest(LOCAL_OK)) return;
    const lead = /^\s*/.exec(t)[0], tail = /\s*$/.exec(t)[0], r = lead + say(t.trim()) + tail; if (r !== t) { note(t, "text"); n.data = r; } };
  const fixAttrs = el => { if (off() || el.closest(PHRASE)) return; for (const a of ATTRS) { const v = el.getAttribute(a); if (v && E.otherScript(v)) { const r = say(v); if (r !== v) { note(v, a); el.setAttribute(a, r); } } } };
  const sweep = root => { if (!root) return;
    if (root.nodeType === 3) return fixText(root); if (root.nodeType !== 1) return;
    fixAttrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) fixText(n); else fixAttrs(n); } };
  const watch = () => { sweep(document.body);
    // Runs before the screen is painted (a mutation observer's turn comes before the next frame), so the traveler never
    // sees the name as it came.
    new MutationObserver(ms => { for (const m of ms) { if (m.type === "characterData") fixText(m.target); else if (m.type === "attributes") fixAttrs(m.target); else m.addedNodes.forEach(sweep); } })
      .observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS }); };
  if (document.body) watch(); else document.addEventListener("DOMContentLoaded", watch);
  // Pictures the app draws.
  try { const C = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
    if (C) for (const f of ["fillText", "strokeText", "measureText"]) { const was = C[f]; if (typeof was !== "function") continue;
      C[f] = function (t) { if (typeof t === "string" && E.otherScript(t) && !off()) { if (f !== "measureText") note(t, "picture"); arguments[0] = say(t); } return was.apply(this, arguments); }; } } catch (e) { console.warn("language rule: pictures", e); }
  // The device's voice. A phrase from the phrase card is spoken in its own language (its utterance names that
  // language); everything else is the guide speaking the traveler's language.
  try { const S = window.speechSynthesis, was = S && S.speak;
    if (was) S.speak = function (u) { try { const l = String((u && u.lang) || "").slice(0, 2).toLowerCase();
        if (u && typeof u.text === "string" && E.otherScript(u.text) && !off() && /^(en|es|fr|de|it|pt)$/.test(l)) { note(u.text, "voice"); u.text = say(u.text); } } catch (e) { console.warn("language rule: voice", e); }
      return was.apply(this, arguments); }; } catch (e) { console.warn("language rule: voice", e); }
  // Text handed to other apps.
  try { const was = navigator.share; if (typeof was === "function") navigator.share = function (d) { if (d && !off()) for (const k of ["title", "text"]) if (typeof d[k] === "string" && E.otherScript(d[k])) { note(d[k], "share"); d[k] = say(d[k]); } return was.apply(this, arguments); }; } catch (e) { console.warn("language rule: share", e); }
  try { const cb = navigator.clipboard, was = cb && cb.writeText; if (typeof was === "function") cb.writeText = function (t) { if (typeof t === "string" && E.otherScript(t) && !off()) { note(t, "copy"); arguments[0] = say(t); } return was.apply(this, arguments); }; } catch (e) { console.warn("language rule: copy", e); }
})();
