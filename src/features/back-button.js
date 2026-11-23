// The phone's Back button (Nov 23 2026, client feel test, thread "Use the live app like a real client").
// The app changed screens without telling the browser, so on an Android phone the Back button (or the back swipe)
// closed Kairoute from any screen: a traveler on Choose sights or in the middle of a day plan who pressed Back was
// thrown out of the app. Now each screen the traveler moves to (which screen, which day) is a step in the browser's
// history, so Back goes to the screen before, inside the app, and only leaves it from the first screen.
// One layer: render() calls backAfterRender(); a screen change made by several quick redraws in a row (one tap) is
// one step, never several. Back never changes the trip: it only shows an earlier screen and day.
let backKey = null, backPopping = false, backTimer = null;
const backHere = () => ({ v: String(view || ""), a: trip && trip.days && trip.days[trip.active] ? trip.active : null });
const backKeyOf = s => s.v + "|" + (s.a == null ? "" : s.a);
function backAfterRender() {
  if (typeof history === "undefined" || !history.pushState) return;
  clearTimeout(backTimer);
  backTimer = setTimeout(() => { try {
    const s = backHere(), k = backKeyOf(s);
    if (backKey === null) { history.replaceState(Object.assign({ kroute: 1 }, s), "", location.href); backKey = k; backPopping = false; return; }
    if (k === backKey) { backPopping = false; return; }
    backKey = k;
    if (backPopping) { backPopping = false; history.replaceState(Object.assign({ kroute: 1 }, s), "", location.href); return; }
    history.pushState(Object.assign({ kroute: 1 }, s), "", location.href);
  } catch (e) {} }, 0);
}
if (typeof window !== "undefined") window.addEventListener("popstate", e => {
  const s = e.state; if (!s || !s.kroute) return;
  if (backKeyOf(s) === backKey) return;
  try { if (view === "tour" && s.v !== "tour" && typeof stopAudio === "function") stopAudio(); } catch (er) {}
  backPopping = true;
  if (s.a != null && trip.days && trip.days[s.a]) trip.active = s.a;
  view = s.v || "lobby"; render(); toTop();
});
