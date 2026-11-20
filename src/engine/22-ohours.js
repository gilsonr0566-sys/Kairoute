// Beta 2 engine, part 2b: opening hours as mapped on OpenStreetMap ("Mo-Fr 09:00-17:00; Sa off"), read for one date.
// Only clear answers count: anything this reader doesn't fully understand (months, holidays, sunrise, comments) gives
// null (unknown), and the plan then treats the hours as unknown instead of pretending. Same reading as the app's own.
(function (E) {
  const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const dayIn = (sel, d) => sel.split(",").some(part => { part = part.trim(); const m = /^(Su|Mo|Tu|We|Th|Fr|Sa)(?:-(Su|Mo|Tu|We|Th|Fr|Sa))?$/.exec(part); if (!m) throw new Error("day");
    const a = DAYS.indexOf(m[1]), b = m[2] ? DAYS.indexOf(m[2]) : a; return a <= b ? d >= a && d <= b : d >= a || d <= b; });
  // Open at this minute of this date? "open", "closed" or null (can't tell).
  E.ohState = (hours, iso, minute) => {
    const h = String(hours || "").trim(); if (!h || !iso) return null;
    if (/^24\/7$/.test(h)) return "open";
    if (/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|week|sunrise|sunset|dawn|dusk|easter)\b|"|\[|SH\b/i.test(h)) return null;
    const dow = new Date(iso + "T12:00:00Z").getUTCDay(), prev = (dow + 6) % 7;
    let state = null;
    try {
      for (let rule of h.split(";")) {
        rule = rule.trim().replace(/\s*,\s*PH\b|\bPH\s*,\s*/g, ""); if (!rule || /^PH\b/.test(rule)) continue;
        const m = /^((?:(?:Su|Mo|Tu|We|Th|Fr|Sa)(?:-(?:Su|Mo|Tu|We|Th|Fr|Sa))?)(?:\s*,\s*(?:Su|Mo|Tu|We|Th|Fr|Sa)(?:-(?:Su|Mo|Tu|We|Th|Fr|Sa))?)*)?\s*(.*)$/.exec(rule);
        const sel = m[1] || "Mo-Su", rest = m[2].trim(), today = dayIn(sel, dow), yday = dayIn(sel, prev);
        if (/^(off|closed)$/i.test(rest)) { if (today) state = "closed"; continue; }
        const spans = (rest || "00:00-24:00").split(",").map(x => { const t = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\+?$/.exec(x.trim()); if (!t) throw new Error("time"); return [+t[1] * 60 + +t[2], +t[3] * 60 + +t[4]]; });
        if (today) state = spans.some(([a, b]) => b > a ? minute >= a && minute < b : minute >= a) ? "open" : "closed";
        if (yday && spans.some(([a, b]) => b <= a && minute < b)) state = "open";
      }
    } catch (e) { return null; }
    return state || "closed"; // days no rule names are closed days
  };
  // The open spans of one date ({ spans }, empty when closed all day), or null when unknown or open round the clock.
  E.ohSpans = (hours, iso) => {
    const h = String(hours || "").trim();
    if (!h || /^(24\/7|(Mo-Su\s*)?00:00-(00|24):00)$/.test(h)) return null;
    const spans = []; let cur = null;
    for (let m = 0; m <= 1440; m += 15) {
      const st = m < 1440 ? E.ohState(h, iso, m) : "closed"; if (st == null) return null;
      // Each change found in 15-minute steps is then found to the minute (Fable review #13: a sight closing at 5:20 was
      // taken as open until 5:30).
      const exact = (from, want) => { for (let k = Math.max(0, from - 14); k < from; k++) if ((E.ohState(h, iso, k) === "open") === want) return k; return from; };
      if (st === "open" && cur == null) cur = exact(m, true); if (st !== "open" && cur != null) { spans.push([cur, m < 1440 ? exact(m, false) : m]); cur = null; }
    }
    if (spans.length === 1 && spans[0][0] === 0 && spans[0][1] >= 1440) return null;
    return { spans, last: null };
  };
})(KEngine);
