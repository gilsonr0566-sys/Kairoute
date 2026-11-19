// Beta 2 engine, part 2: opening hours. One check that every stop passes, picks, optional stops, day trips alike
// (lesson 13: closed sights were checked in some steps and not others). Hours come already read for the day's date
// in the facts (spans of open minutes, and the last entry when listed); no hours known means no hours limit.
(function (E) {
  // How a visit starting at t for len minutes fits the hours: minutes to wait for opening, minutes past the latest
  // sensible arrival (the listed last entry, and never so late that the visit runs past closing).
  E.hoursFit = (oh, t, len) => {
    if (!oh || !oh.spans || !oh.spans.length) return { wait: 0, late: 0 };
    // The whole visit fits before closing (Nov 19 review: a 2-hour museum could be entered 45 minutes before it closed),
    // and entry is by the last entry when one is listed.
    const deadOf = (b) => Math.min(oh.last != null && oh.last <= b ? oh.last : Infinity, b - Math.max(15, len || 0));
    for (const [a, b] of oh.spans) {
      const dead = deadOf(b);
      if (t <= dead) { const wait = Math.max(0, a - t); return t + wait <= dead ? { wait, late: 0, open: a, close: b } : { wait: 0, late: t + wait - dead, open: a, close: b }; }
    }
    const [a, b] = oh.spans[oh.spans.length - 1]; return { wait: 0, late: t - deadOf(b), open: a, close: b };
  };
  // Can't be visited on this day at all: closed that date, or open only outside the day's window (under 30 minutes of overlap).
  E.closedForDay = (siteDay, win, minutes) => {
    if (!siteDay) return false; if (siteDay.closed) return true;
    const oh = siteDay.oh; if (!oh || !oh.spans || !oh.spans.length || !win || !(win.endBy > win.start)) return false;
    const need = Math.min(30, minutes || 30);
    return !oh.spans.some(([a, b]) => Math.min(b, win.endBy) - Math.max(a, win.start) >= need);
  };
})(KEngine);
