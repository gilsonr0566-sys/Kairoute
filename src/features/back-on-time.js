// ---------- Getting back on time is the traveler's (Richard, Nov 20: liability, option 1) ----------
// Kairoute times the day back to the ship, the station or the airport, and those times are padded estimates. Once, when
// a trip first has a timed day (a port, the boarding day, a train or flight out), the traveler is told so plainly and
// taps "I understand". It is shown on the Trip page (where every new trip ends up) and on the Day plan of a timed day
// (where the example trip opens), until that one tap; the answer is kept with the app's settings, for every trip.
const backAcked = () => typeof appSet !== "undefined" && !!appSet.backAck;
const timedDay = d => !!d && (d.type === "port" || d.type === "embark" || (d.type === "departure" && !!d.time));
function backNoticeHTML(t) {
  t = t || trip; if (backAcked() || !t || !(t.days || []).some(timedDay)) return "";
  return `<div class="card backnotice" role="note" aria-labelledby="backTtl"><h3 id="backTtl">Getting back on time is up to you</h3>
    <p>Kairoute's leave-by and back-by times are estimates with spare time built in. Traffic, queues and the weather can still slow you down. The time that counts is the ship's all-aboard time or your train or flight, as your cruise line or carrier gives it. Check it on the day.</p>
    <div class="actions"><button type="button" class="btn small" data-act="backack">I understand</button><button type="button" class="linkbtn" data-act="terms">Terms of use</button></div></div>`;
}
if (typeof document !== "undefined") document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest('[data-act="backack"]'); if (!b) return;
  appSet.backAck = typeof todayISO === "function" ? todayISO() : new Date().toISOString().slice(0, 10); saveAppSet(); render();
});
