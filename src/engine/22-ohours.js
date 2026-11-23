// Beta 2 engine, part 2b: THE opening-hours reader (Nov 22 2026, "make opening hours and closed days reliable").
// Every place's hours, for one date, are read here and nowhere else: the map's opening_hours ("Apr-Oct: Mo-Su
// 08:00-20:00; PH off"), a guide's or Wikivoyage's words ("Tue-Sun 9am-5pm, closed Mondays; summer to 8pm"), and the
// sight's closed-days note. Before this, three readers (the app's, the engine's, the guide-text one) each understood a
// different part, ignored public holidays ("PH off" was skipped) and read seasonal words as all-year hours.
// The answer is always one of: open spans for the date (known), closed all day (known), or unknown, with the reason
// unknown ("hours change around this date", "the map's note says by appointment"). Never a guess passed off as known:
// what this reader doesn't fully understand is unknown, and the plan then says "hours not confirmed".
(function (E) {
  const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ymd = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
  const dt = iso => new Date(iso + "T12:00:00Z"), dowOf = iso => dt(iso).getUTCDay();
  const addDays = (iso, n) => { const x = dt(iso); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  E.isoAdd = addDays;
  // Western Easter (the "easter" of opening_hours) and the Orthodox one, for a year.
  E.easter = (y, orthodox) => {
    if (orthodox) { const a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7, m = Math.floor((d + e + 114) / 31), day = ((d + e + 114) % 31) + 1;
      const j = new Date(Date.UTC(y, m - 1, day)); j.setUTCDate(j.getUTCDate() + 13); return j.toISOString().slice(0, 10); }
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    return `${y}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
  };
  // The sun for a date and place, in minutes on the local clock (offset = minutes ahead of UTC that day). NOAA's
  // formulas; good to a minute or two, which is all "sunset" in an opening time can promise anyway. depth: the sun's
  // angle below the horizon (0.833 sunrise/sunset, 6 civil dawn/dusk).
  E.sunAt = (lat, lng, iso, offset, depth) => {
    if (!isFinite(lat) || !isFinite(lng) || !isFinite(offset) || !ymd(iso)) return null;
    const rad = Math.PI / 180, J = dt(iso).getTime() / 864e5 + 2440587.5, n = Math.round(J - 2451545.0 + 0.0008 - lng / 360);
    const Ms = (357.5291 + 0.98560028 * n) % 360, C = 1.9148 * Math.sin(Ms * rad) + 0.02 * Math.sin(2 * Ms * rad) + 0.0003 * Math.sin(3 * Ms * rad);
    const lam = (Ms + C + 180 + 102.9372) % 360, Jt = 2451545.0 + n - lng / 360 + 0.0053 * Math.sin(Ms * rad) - 0.0069 * Math.sin(2 * lam * rad);
    const dec = Math.asin(Math.sin(lam * rad) * Math.sin(23.44 * rad)), cosw = (Math.sin(-(depth == null ? 0.833 : depth) * rad) - Math.sin(lat * rad) * Math.sin(dec)) / (Math.cos(lat * rad) * Math.cos(dec));
    const toLocal = j => Math.round(((j - 2440587.5) * 864e5 - Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))) / 6e4 + offset);
    const noon = toLocal(Jt + 0.5 - 0.5); // Jt is the transit as a Julian day (days start at noon)
    if (cosw <= -1 || cosw >= 1) return { noon, rise: null, set: null, polar: cosw <= -1 ? "day" : "night", dec };
    const w = Math.acos(cosw) / rad / 360; return { noon, rise: toLocal(Jt - w), set: toLocal(Jt + w), dec };
  };

  // ---------- the map's opening_hours ----------
  const WD = "(?:Su|Mo|Tu|We|Th|Fr|Sa)", MO = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)";
  const VAR = { sunrise: 1, sunset: 1, dawn: 1, dusk: 1 };
  // Minutes for a time token: "08:30", "24:00", "sunset", "(sunset-01:00)". null when the sun is needed but unknown.
  function tmin(tok, ctx, iso) {
    tok = tok.trim(); let m = /^(\d{1,2}):(\d{2})$/.exec(tok); if (m) return +m[1] * 60 + +m[2];
    m = /^\(?\s*(sunrise|sunset|dawn|dusk)\s*(?:([+-])\s*(\d{1,2}):(\d{2}))?\s*\)?$/.exec(tok); if (!m) throw new Error("time " + tok);
    const s = ctx && E.sunAt(ctx.lat, ctx.lng, iso, ctx.offset, /dawn|dusk/.test(m[1]) ? 6 : 0.833); if (!s || s.rise == null) return null;
    const base = /sunrise|dawn/.test(m[1]) ? s.rise : s.set; return base + (m[2] ? (m[2] === "-" ? -1 : 1) * (+m[3] * 60 + +m[4]) : 0);
  }
  // Does a month-day selector ("Apr-Oct", "Apr 01-Oct 31", "Dec 25", "Jun 21-Sep 02", "easter", "2027 May 01") cover the date?
  function mdHit(sel, iso) {
    const p = ymd(iso), md = (mo, d) => mo * 100 + d, today = md(p.m, p.d);
    return sel.split(",").some(part => {
      part = part.trim(); if (!part) return false;
      // "2027 Jan 11-2027 Feb 17": a range with years is read as whole dates.
      let m = /^(\d{4})\s+(\S+(?:\s+\d{1,2})?)\s*-\s*(?:(\d{4})\s+)?(\S+(?:\s+\d{1,2})?)$/.exec(part);
      if (m && new RegExp("^" + MO).test(m[2]) && new RegExp("^" + MO).test(m[4])) { const one = (y, s, end) => { const x = new RegExp("^(" + MO + ")(?:\\s+(\\d{1,2}))?$").exec(s.trim()); if (!x) throw new Error("month " + s);
          const mo = MON.indexOf(x[1]) + 1, d = x[2] ? +x[2] : end ? new Date(Date.UTC(y, mo, 0)).getUTCDate() : 1; return y * 10000 + mo * 100 + d; };
        const lo = one(+m[1], m[2], false), hi = one(m[3] ? +m[3] : +m[1], m[4], true), t = p.y * 10000 + p.m * 100 + p.d; return t >= lo && t <= hi; }
      m = /^(\d{4})\s+(.*)$/.exec(part); if (m) { if (+m[1] !== p.y) return false; part = m[2]; }
      if (/^easter(\s*[+-]\d+\s*days?)?$/.test(part)) { const off = /([+-]\d+)/.exec(part); return addDays(E.easter(p.y), off ? +off[1] : 0) === iso; }
      const one = s => { const x = new RegExp("^(" + MO + ")(?:\\s+(\\d{1,2}))?$").exec(s.trim()); if (!x) throw new Error("month " + s); return { m: MON.indexOf(x[1]) + 1, d: x[2] ? +x[2] : null }; };
      const r = part.split("-");
      if (r.length === 1) { const a = one(r[0]); return a.d == null ? a.m === p.m : md(a.m, a.d) === today; }
      if (r.length !== 2) throw new Error("range " + part);
      const a = one(r[0]); let bs = r[1].trim(); if (/^\d{1,2}$/.test(bs)) bs = MON[a.m - 1] + " " + bs; // "Jul 01-15"
      const b = one(bs), lo = md(a.m, a.d == null ? 1 : a.d), hi = md(b.m, b.d == null ? 31 : b.d);
      return lo <= hi ? today >= lo && today <= hi : today >= lo || today <= hi;
    });
  }
  // Does a weekday selector ("Mo-Fr", "Sa,Su", "Su[-1]", "Tu[1,3]", "PH", "SH") cover the date? flags: { ph, sh }.
  function wdHit(sel, iso, fl) {
    const dow = dowOf(iso), p = ymd(iso), lastDay = new Date(Date.UTC(p.y, p.m, 0)).getUTCDate();
    return sel.split(",").some(part => {
      part = part.trim(); if (part === "PH") return !!fl.ph; if (part === "SH") return !!fl.sh;
      let m = new RegExp("^(" + WD + ")\\[([-\\d,\\s]+)\\]$").exec(part);
      if (m) { if (DAYS.indexOf(m[1]) !== dow) return false; return m[2].split(",").some(k => { k = +k; return k > 0 ? Math.ceil(p.d / 7) === k : Math.ceil((lastDay - p.d + 1) / 7) === -k; }); }
      m = new RegExp("^(" + WD + ")(?:-(" + WD + "))?$").exec(part); if (!m) throw new Error("day " + part);
      const a = DAYS.indexOf(m[1]), b = m[2] ? DAYS.indexOf(m[2]) : a; return a <= b ? dow >= a && dow <= b : dow >= a || dow <= b;
    });
  }
  const isoWeek = iso => { const d = dt(iso), day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3); const f = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); return 1 + Math.round(((d - f) / 864e5 - 3 + ((f.getUTCDay() + 6) % 7)) / 7); };
  // One rule ("Apr-Oct: Mo-Su 08:00-20:00") split into its selectors and what it says about time.
  function parseRule(rule) {
    let r = rule.trim(), comment = null;
    const cm = /\u0001(\d+)\u0001\s*$/.exec(r); if (cm) { comment = QUOTED[+cm[1]]; r = r.slice(0, cm.index).trim(); }
    if (/\u0001/.test(r)) throw new Error("comment inside a rule");
    const out = { years: null, md: null, weeks: null, wd: null, times: null, state: "open", comment };
    let m = new RegExp("^(\\d{4}(?:-\\d{4})?(?:\\s*,\\s*\\d{4}(?:-\\d{4})?)*)(?:\\s*:\\s*|\\s+(?=" + WD + "|PH|SH|\\d\\d:|off|closed|open))").exec(r); if (m) { out.years = m[1]; r = r.slice(m[0].length); }
    // Month-day part: everything up to the weekday or time part, ending at an optional ":".
    const DN = "\\d{1,2}(?!\\d|:\\d)", MDP = "(?:\\d{4}\\s+)?(?:" + MO + "(?:\\s+" + DN + ")?(?:\\s*-\\s*(?:(?:\\d{4}\\s+)?" + MO + "(?:\\s+" + DN + ")?|" + DN + "))?|easter(?:\\s*[+-]\\d+\\s*days?)?)";
    m = new RegExp("^(" + MDP + "(?:\\s*,\\s*" + MDP + ")*)(?:\\s*:\\s*|\\s+|$)").exec(r);
    if (m) { out.md = m[1].trim(); r = r.slice(m[0].length); }
    m = /^week\s+([\d\-,\/\s]+?)(?::\s*|\s+(?=[A-Z]|\d{1,2}:))/.exec(r); if (m) { out.weeks = m[1].trim(); r = r.slice(m[0].length); }
    m = new RegExp("^((?:" + WD + "(?:\\[[-\\d,\\s]+\\])?(?:-" + WD + ")?|PH|SH)(?:\\s*,\\s*(?:" + WD + "(?:\\[[-\\d,\\s]+\\])?(?:-" + WD + ")?|PH|SH))*)(?::\\s*|\\s+|$)").exec(r);
    if (m) { out.wd = m[1].replace(/\s+/g, ""); r = r.slice(m[0].length); }
    r = r.trim();
    const st = /\b(off|closed|open|unknown)\s*$/.exec(r); if (st) { out.state = st[1] === "closed" ? "off" : st[1]; r = r.slice(0, st.index).trim(); }
    if (r) out.times = r;
    else if (out.state === "open") out.times = "00:00-24:00";
    return out;
  }
  // "Mo-Fr 09:00-17:00, Sa 10:00-14:00" holds two rules; "Jan 01,May 01,Dec 25 off" and "Sa,Su 10:00-14:00" one each:
  // a comma starts another rule only right after a time or a state word.
  // Quoted comments are set aside before the rules are split, so a ";" or "," inside one ("closed; reopening in May")
  // never splits a rule; each comes back on its own rule.
  let QUOTED = [];
  function splitAdd(part) {
    const out = []; let cur = "";
    part.split(",").forEach((bit, k) => {
      if (k && new RegExp("(\\d\\d:\\d\\d\\+?|\\)|\\b(off|closed|open|unknown)|\u0001)\\s*$").test(cur) && new RegExp("^\\s*(" + WD + "|PH|SH|" + MO + "|easter|week\\b|\\d{4}\\s)").test(bit)) { out.push(cur); cur = bit; }
      else cur = k ? cur + "," + bit : bit;
    });
    out.push(cur); return out.map(x => x.trim()).filter(Boolean);
  }
  function ruleHits(R, iso, fl) {
    const p = ymd(iso);
    if (R.years && !R.years.split(",").some(y => { const [a, b] = y.split("-").map(Number); return p.y >= a && p.y <= (b || a); })) return false;
    if (R.md && !mdHit(R.md, iso)) return false;
    if (R.weeks) { const w = isoWeek(iso); if (!R.weeks.split(",").some(x => { const m = /^(\d+)(?:-(\d+))?(?:\/(\d+))?$/.exec(x.trim()); if (!m) throw new Error("week"); const a = +m[1], b = m[2] ? +m[2] : a, s = m[3] ? +m[3] : 1; return w >= a && w <= b && (w - a) % s === 0; })) return false; }
    if (R.wd && !wdHit(R.wd, iso, fl)) return false;
    return true;
  }
  function spansOf(R, ctx, iso) {
    if (!R.times) return [];
    return R.times.split(/\s*,\s*/).map(x => {
      x = x.trim(); const plus = /\+$/.test(x); x = x.replace(/\+$/, "");
      const m = /^(.+?)\s*-\s*(.+)$/.exec(x.replace(/\)\s*-\s*/, ")-"));
      if (!m) { if (plus) { const a = tmin(x, ctx, iso); return a == null ? null : [a, Math.max(a + 240, 24 * 60), "open-ended"]; } throw new Error("span " + x); }
      const a = tmin(m[1], ctx, iso), b0 = tmin(m[2], ctx, iso); if (a == null || b0 == null) return null;
      if (b0 <= a && b0 > 6 * 60) throw new Error("span " + x); // "09:00-8:00" is a typo, not a night opening
      const b = b0 <= a ? b0 + 1440 : b0; return [a, b];
    });
  }
  // The rules of one opening_hours string, read for one date with known flags: { spans, comment } or null (unclear).
  function evalOsm(text, iso, ctx, fl) {
    // "||" separates fallback rules: one applies only when no earlier rule matched the date.
    QUOTED = []; text = text.replace(/"([^"]*)"/g, (m, c) => "\u0001" + (QUOTED.push(c) - 1) + "\u0001");
    if (/"/.test(text)) throw new Error("unclosed comment");
    const groups = text.split("||").map(g => g.trim()).filter(Boolean); let spans = null, comment = null, unknown = false, matched = false;
    for (const g of groups) {
      if (matched) break;
      // ";" starts a rule that overrides; "," before a selector adds a rule ("Mo-Fr 09:00-17:00, Sa 10:00-14:00").
      const rules = []; g.split(";").forEach(part => { part = part.trim(); if (!part) return;
        splitAdd(part).forEach((b, k) => rules.push({ R: parseRule(b), add: k > 0 })); });
      for (const { R, add } of rules) {
        if (!ruleHits(R, iso, fl)) continue; matched = true;
        // A rule that says it isn't sure ("unknown", or a note like "by appointment") makes the date unknown, until a
        // later rule for the same date overrides it.
        const unsure = R.state === "unknown" || (!!R.comment && R.state !== "off" && (!R.times || /appointment|request|varies|irregular|services|events?|season|weather|call|ask|tour|unknown|maybe|check/i.test(R.comment)));
        // "We 12:00-14:00 off" closes those hours only (the way mappers mean it); a bare "off" closes the day.
        if (R.state === "off" && R.times && spans) { const cut = spansOf(Object.assign({}, R, { state: "open" }), ctx, iso); if (cut.some(x => x == null)) return null;
          spans = spans.flatMap(([a, b]) => cut.reduce((l, [c, d]) => l.flatMap(([p, q]) => d <= p || c >= q ? [[p, q]] : [[p, c], [d, q]].filter(([u, v]) => v > u)), [[a, b]])); continue; }
        const s = R.state === "off" || R.state === "unknown" ? [] : spansOf(R, ctx, iso); if (s.some(x => x == null)) return null;
        spans = add && spans ? spans.concat(s) : s; unknown = add ? unknown || unsure : unsure; comment = unsure ? (R.comment || "hours unknown") : R.comment || (add ? comment : null);
      }
    }
    if (unknown) return { unknown: true, why: comment };
    return { spans: spans || [], comment, matched };
  }
  // Read one opening_hours string for one date: { known, spans, closed, src } or { known: false, why }.
  // ctx: { holiday (true/false/undefined when the date's holiday status isn't known), lat, lng, offset }.
  E.readOsm = (text, iso, ctx) => {
    const h = String(text || "").trim(); ctx = ctx || {};
    if (!h || !ymd(iso)) return { known: false, why: "" };
    if (/^24\/7$/.test(h)) return { known: true, allDay: true, spans: [[0, 1440]] };
    const once = fl => {
      const today = evalOsm(h, iso, ctx, fl); if (!today || today.unknown) return today;
      // Spans running past midnight from the day before ("Fr 20:00-02:00") open the small hours of this date.
      const prev = evalOsm(h, addDays(iso, -1), ctx, { ph: fl.prevPh, sh: fl.sh });
      const carry = prev && !prev.unknown ? prev.spans.filter(([, b]) => b > 1440).map(([, b]) => [0, b - 1440]) : [];
      return { spans: carry.concat(today.spans), comment: today.comment, matched: today.matched };
    };
    // Unclear flags (a holiday status not known; school holidays, which no source here gives) are read both ways: when
    // the answers differ, the hours for the date are unknown.
    const phs = ctx.holiday == null ? [false, true] : [!!ctx.holiday], shs = [false, true];
    let res = null;
    try {
      for (const ph of phs) for (const sh of shs) {
        const r = once({ ph, sh, prevPh: !!ctx.prevHoliday }); if (!r) return { known: false, why: "the hours depend on the sun and the place's clock isn't known" };
        if (r.unknown) return { known: false, why: r.why || "the map's hours say so" };
        const key = JSON.stringify(r.spans);
        if (res && res.key !== key) return { known: false, why: sh ? "the hours change in school holidays" : "the hours may differ on a public holiday" };
        res = { key, r };
      }
    } catch (e) { return { known: false, syntax: true, why: "the map's hours aren't in a form Kairoute reads (" + h.slice(0, 60) + ")" }; }
    const spans = E.mergeSpans(res.r.spans);
    if (spans.length === 1 && spans[0][0] <= 0 && spans[0][1] >= 1440) return { known: true, allDay: true, spans: [[0, 1440]] };
    return { known: true, closed: !spans.length, spans, note: res.r.comment || "" };
  };
  E.mergeSpans = l => l.map(x => [Math.max(0, x[0]), Math.min(1440 + 360, x[1])]).filter(x => x[1] > x[0]).sort((a, b) => a[0] - b[0])
    .reduce((a, x) => { const t = a[a.length - 1]; if (t && x[0] <= t[1]) t[1] = Math.max(t[1], x[1]); else a.push([x[0], x[1]]); return a; }, []);

  // ---------- written hours (guides, Wikivoyage) ----------
  // Written hours are turned into the map's form, then read by the same rules. Words that change the meaning but
  // aren't understood ("except during services", "by appointment", "varies") make the hours unknown, never ignored.
  const FULLDAY = [["sundays?|sun\\.?", "Su"], ["mondays?|mon\\.?", "Mo"], ["tuesdays?|tues?\\.?", "Tu"], ["wednesdays?|wed\\.?", "We"], ["thursdays?|thurs?\\.?|thu\\.?", "Th"], ["fridays?|fri\\.?", "Fr"], ["saturdays?|sat\\.?", "Sa"]];
  const MONTHS = [["january|jan\\.?", "Jan"], ["february|feb\\.?", "Feb"], ["march|mar\\.?", "Mar"], ["april|apr\\.?", "Apr"], ["may", "May"], ["june|jun\\.?", "Jun"], ["july|jul\\.?", "Jul"], ["august|aug\\.?", "Aug"], ["september|sept?\\.?", "Sep"], ["october|oct\\.?", "Oct"], ["november|nov\\.?", "Nov"], ["december|dec\\.?", "Dec"]];
  const UNSURE = /appointment|request|varies|vary|variable|irregular|depend|during (?:services|mass|prayers?|events?|ceremon)|except (?:during|for (?:services|mass|events))|weather|seasonal|subject to|when (?:there|open)|not open to|tours? only|guided only|private|reservation only|ring|call ahead|by arrangement|occasionally|sometimes|some days|certain days|usually|typically|generally|currently closed|temporarily|renovation|restoration|closed until|reopen/i;
  // Seasons in words: summer and winter as most sights mean them. Where "summer hours" start differs from place to
  // place (April, May, June; or end in September or October) the date is read both ways, and if the answers differ the
  // shorter hours are planned and the plan says the hours change around this date.
  const seasonOf = (iso, lat) => { const m = ymd(iso).m, south = isFinite(lat) && lat < -10, mm = south ? ((m + 5) % 12) + 1 : m;
    return mm >= 6 && mm <= 8 ? ["summer"] : mm === 12 || mm <= 3 || mm === 11 ? ["winter"] : ["summer", "winter"]; };
  function toOsm(text, season) {
    let t = " " + String(text || "").toLowerCase().replace(/[–—−‒]/g, "-").replace(/\u00a0/g, " ").replace(/\s+/g, " ") + " ";
    // Times: "9am", "9.30 a.m.", "noon", "midnight", "9h30", "17h" -> "09:30"
    t = t.replace(/\bnoon\b|\bmidday\b/g, "12:00").replace(/\bmidnight\b/g, "24:00");
    t = t.replace(/(\d{1,2})h(\d{2})?\b/g, (_, h, m) => h + ":" + (m || "00"));
    t = t.replace(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?![a-z])/g, (_, h, m, ap) => { let x = +h % 12; if (/^p/.test(ap)) x += 12; return String(x).padStart(2, "0") + ":" + (m || "00"); });
    t = t.replace(/\b(\d{1,2})[:.](\d{2})\b/g, (_, h, m) => String(+h).padStart(2, "0") + ":" + m);
    // "an hour before sunset", "sunset", "dusk": the sun's times, as the map writes them
    t = t.replace(/\b(?:about |around |approximately )?(an?|one|two|1|2|half an?|30 min(?:utes)?|45 min(?:utes)?) ?(hours?|hrs?|h)? before (sunset|dusk)\b/g, (_, n, u, w) => { const m = /half|30/.test(n) ? 30 : /45/.test(n) ? 45 : /two|2/.test(n) ? 120 : 60; return "{" + w + "-" + String(m / 60 | 0).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0") + "}"; });
    t = t.replace(/\b(?:until |till |to )?(sunset|dusk)\b(?![-:)])/g, " $1").replace(/\b(sunrise|dawn)\b(?![-:)])/g, "$1");
    t = t.replace(/\b(about|around|approximately|approx\.?|roughly|ca\.)\s+/g, "");
    const TT = "(?:\\d\\d:\\d\\d|\\{?(?:sunrise|sunset|dawn|dusk)(?:-\\d\\d:\\d\\d)?\\}?)";
    t = t.replace(new RegExp("(" + TT + ")\\s*(?:-|to|until|till|til)\\s*(" + TT + ")", "g"), "$1-$2");
    // "9-5", "10-6" with no minutes: a day's hours only when the second number is smaller (afternoon) or both are hours
    t = t.replace(/(^|[\s(,;])(\d{1,2})\s*-\s*(\d{1,2})(?=[\s),;.]|$)/g, (all, pre, a, b) => { a = +a; b = +b; if (a < 5 || a > 12 || b > 12 || b < 1) return all; const bb = b <= a ? b + 12 : b < 8 ? b + 12 : b; return pre + String(a).padStart(2, "0") + ":00-" + String(bb).padStart(2, "0") + ":00"; });
    // Days
    t = t.replace(/\b(daily|every ?day|7 days(?: a week)?|all week|seven days(?: a week)?)\b/g, " Mo-Su ").replace(/\bweekdays\b/g, " Mo-Fr ").replace(/\b(weekends?|sat(?:urday)?s? (?:and|&) sun(?:day)?s?)\b/g, " Sa,Su ");
    t = t.replace(/\b(public|bank|national|religious) holidays?\b|\bholidays\b/g, " PH ");
    for (const [re, d] of FULLDAY) t = t.replace(new RegExp("\\b(?:" + re + ")(?![a-z])", "g"), d);
    for (const [re, m] of MONTHS) t = t.replace(new RegExp("\\b(?:" + re + ")(?![a-z])", "g"), m);
    t = t.replace(/(Su|Mo|Tu|We|Th|Fr|Sa)\s*(?:-|to|through|thru|until)\s*(Su|Mo|Tu|We|Th|Fr|Sa)/g, "$1-$2").replace(/(Su|Mo|Tu|We|Th|Fr|Sa)\s*(?:,|&|and|\/)\s*(?=(Su|Mo|Tu|We|Th|Fr|Sa)\b)/g, "$1,");
    t = t.replace(/(Su|Mo|Tu|We|Th|Fr|Sa)\s*(?:,|&|and|\/)\s*(?=(Su|Mo|Tu|We|Th|Fr|Sa)\b)/g, "$1,");
    t = t.replace(new RegExp("(" + MO + ")\\s*(\\d{1,2})?\\s*(?:-|to|through|until)\\s*(" + MO + ")\\s*(\\d{1,2})?", "g"), (_, a, ad, b, bd) => a + (ad ? " " + ad.padStart(2, "0") : "") + "-" + b + (bd ? " " + bd.padStart(2, "0") : ""));
    t = t.replace(new RegExp("(\\d{1,2})\\s+(" + MO + ")\\b", "g"), (_, d, m) => m + " " + d.padStart(2, "0")); // "25 Dec" -> "Dec 25"
    // Seasons: "summer" and "winter" (with "high/low season") become the side that holds for this date.
    t = t.replace(/\bnon-summer\b/g, " @winter ").replace(/\b(high season|peak season|summer(?: time| months| season)?|in summer)\b/g, " @summer ").replace(/\b(low season|off[- ]season|winter(?: time| months| season)?|in winter)\b/g, " @winter ");
    t = t.replace(/(\d\d:\d\d)\s*(?:&|and|\+|\/)\s*(?=\d\d:\d\d)/g, "$1, ");
    // A new selector right after a time starts a new clause ("May-Sep Mo-Sa 10:00-18:00 Su 11:30-16:00 Oct-Apr ...").
    t = t.replace(/(\d\d:\d\d\}?\)?|sunset|dusk)\s+(?=(?:Su|Mo|Tu|We|Th|Fr|Sa|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|PH)\b)/g, "$1; ");
    // "daily except Tuesdays 10:00-18:00": the named days are closed, the hours are for the rest.
    t = t.replace(/,?\s*\bexcept(?: on)?\s+((?:Su|Mo|Tu|We|Th|Fr|Sa|PH)(?:[-,](?:Su|Mo|Tu|We|Th|Fr|Sa|PH))*)\b/g, "; closed $1; ");
    t = t.replace(/(\d\d:\d\d\}?|\))\s+(?=(?:except|closed|shut)\b)/g, "$1; ");
    // "(shorter in winter)": the hours given are the summer ones; the winter ones aren't listed.
    let shorter = null; t = t.replace(/\b(?:shorter|reduced|limited|fewer) (?:hours )?(?:in )?@(summer|winter)\b|@(summer|winter):? (?:shorter|reduced|limited)(?: hours)?/g, (_, a, b) => { shorter = a || b; return " "; });
    // Last entry: kept apart.
    let last = null; const le = /last (?:entry|admission|entrance|tickets?(?: sold)?)\s*(?:is\s*)?(?:at\s*)?(\d\d:\d\d)/.exec(t), lb = /last (?:entry|admission|entrance|tickets?)[^.;]{0,30}?(\d+)\s*(min|minutes|mins|hours?|hrs?|h)\b[^.;]{0,15}before/.exec(t);
    if (le) last = { at: le[1] }; else if (lb) last = { before: +lb[1] * (/^h/.test(lb[2]) ? 60 : 1) };
    t = t.replace(/last (?:entry|admission|entrance|tickets?)[^.;)]*/g, " ");
    // Split into clauses; each becomes one rule or a closed-days note.
    const rules = [], offs = []; let unsure = UNSURE.test(t);
    if (shorter && season === shorter) return { osm: "", unsure: true, last, why: shorter + " hours are shorter and not listed" };
    if (shorter && !/@(summer|winter)/.test(t)) t = t; // the main hours hold outside the shorter season
    const clauses = t.split(/[;.\n]|\)\s*|\(|,\s*(?=(?:closed|shut|except|Su|Mo|Tu|We|Th|Fr|Sa|@|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|PH)\b)/).map(x => x.trim()).filter(Boolean);
    let lastSeason = null;
    for (let c of clauses) {
      const sm = /@(summer|winter)/.exec(c); const sea = sm ? sm[1] : (/^(?:to|until|till)\s+\d\d:\d\d/.test(c) ? lastSeason : null); if (sm) lastSeason = sm[1];
      if (sea && season && sea !== season) continue; // the other season's hours
      c = c.replace(/@(summer|winter)/g, " ").trim();
      const closed = /\b(closed|shut|except|no entry|not open)\b/.test(c);
      const days = (c.match(/\b(?:Su|Mo|Tu|We|Th|Fr|Sa)(?:-(?:Su|Mo|Tu|We|Th|Fr|Sa))?(?:,(?:Su|Mo|Tu|We|Th|Fr|Sa)(?:-(?:Su|Mo|Tu|We|Th|Fr|Sa))?)*\b|\bPH\b/g) || []).join(",");
      const mons = (c.match(new RegExp("\\b" + MO + "(?: \\d\\d)?(?:-" + MO + "(?: \\d\\d)?)?\\b", "g")) || []).join(",");
      const spans = (c.match(/(?:\d\d:\d\d|sunrise|dawn)-(?:\d\d:\d\d|sunset|dusk|\{(?:sunset|dusk)-\d\d:\d\d\})/g) || []).join(",").replace(/\{/g, "(").replace(/\}/g, ")");
      // "(to 20:00 in summer)", "summer 20:00": the season's closing time
      const until = !spans && /(?:^|\s)(?:to|until|till|closes(?: at)?)?\s*(\d\d:\d\d)\s*$/.exec(c);
      if (closed) { if (days || mons) offs.push((mons ? mons + (days ? " " : "") : "") + (days || "") + " off"); else if (!/\b(closed|shut) (?:to|for) (?:visitors|tourists) during\b/.test(c)) unsure = true; continue; }
      if (spans) { rules.push({ sel: (mons ? mons + ": " : "") + (days ? days + " " : ""), spans }); continue; }
      if (until && sea) { rules.push({ until: until[1] }); continue; }
      if (/\d\d:\d\d/.test(c) || /\b(open|hours)\b/.test(c) && !/^open$/.test(c)) { if (!/^(open|hours|opening hours|open daily|daily)?\s*$/.test(c.replace(/Mo-Su|\b(?:Su|Mo|Tu|We|Th|Fr|Sa)\b/g, "").trim())) unsure = true; }
      else if (/[a-z]{4,}/.test(c.replace(/\b(and|also|the|open|from|on|at|in|for|daily|only|all|year|round|hours|is|are|it|times?)\b/g, ""))) unsure = true;
    }
    // A season's closing time ("summer 20:00") changes the closing of the rule before it.
    const out = []; rules.forEach(r => { if (r.until) { const p = out[out.length - 1]; if (p) p.spans = p.spans.replace(/-(\d\d:\d\d)$/, "-" + r.until); else unsure = true; } else out.push(Object.assign({}, r)); });
    if (!out.length && !offs.length) return { osm: "", unsure: true, last };
    // Hours with days named open only those days ("Tu-Su 09:00-17:00" is closed Mondays); hours with none are every day.
    const osm = out.map(r => (r.sel || "") + r.spans).concat(offs).join("; ");
    return { osm, unsure, last, offsOnly: !out.length };
  }
  // Written hours for one date: the same answer shape as readOsm, plus last entry.
  E.readText = (text, iso, ctx) => {
    ctx = ctx || {}; const seasons = seasonOf(iso, ctx.lat);
    const reads = seasons.map(s => { const x = toOsm(text, s); return Object.assign(x, { r: x.osm && !x.offsOnly ? E.readOsm(x.osm, iso, ctx) : null }); });
    const x = reads[0];
    if (reads.some(r => r.unsure)) return { known: false, why: "the listed hours have conditions Kairoute can't check (" + String(text).trim().slice(0, 70) + ")", closed: reads.every(r => r.r && r.r.known && r.r.closed) || undefined };
    if (x.offsOnly) { const r = E.readOsm("Mo-Su 00:00-24:00; " + x.osm, iso, ctx); return r.known && r.closed ? { known: true, closed: true, spans: [] } : { known: false, offsOpen: r.known, why: "only the closed days are listed" }; }
    if (reads.some(r => !r.r || !r.r.known)) { const w = reads.find(r => r.r && !r.r.known); return { known: false, why: w ? w.r.why : "the listed hours aren't in a form Kairoute reads" }; }
    // Read both ways near the change of season: the same answer, or the shorter one, said as such.
    let res = reads[0].r, change = false;
    if (reads.length > 1 && JSON.stringify(reads[0].r.spans) !== JSON.stringify(reads[1].r.spans)) {
      change = true; const a = reads[0].r.spans, b = reads[1].r.spans, both = [];
      a.forEach(([p, q]) => b.forEach(([r, s]) => { const lo = Math.max(p, r), hi = Math.min(q, s); if (hi > lo) both.push([lo, hi]); }));
      res = { known: true, closed: !both.length, spans: both };
    }
    const lastOf = sp => !x.last || !sp.length ? null : x.last.at ? E.toMin(x.last.at) : sp[sp.length - 1][1] - x.last.before;
    return Object.assign({}, res, { last: lastOf(res.spans), seasonChange: change || undefined });
  };

  // ---------- one place, one date ----------
  // The ONE reading of a place's hours for a date, from every field it has: the map's opening_hours (exact syntax) or
  // written hours, then its closed-days note. ctx: { holiday, prevHoliday, lat, lng, offset }.
  // Answer: { known, closed, spans, last, src, why, seasonChange, allDay }.
  E.isOsmHours = h => /^\s*(24\/7|((\d{4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mo|Tu|We|Th|Fr|Sa|Su|PH|SH|week|easter)\b[^;]*?\s)?\(?(\d\d:\d\d|sunrise|sunset|dawn|dusk|off|closed)\b)/.test(String(h || "")) && !/\b(am|pm|daily|closed (?:on )?(?:mon|tue|wed|thu|fri|sat|sun)|to|until|and)\b|[–—]/i.test(String(h || ""));
  // ---------- hours checked against the place's own website (part 1c's list) ----------
  // The checked entry for a place: the same name (or one of its other names) in the same town, or the same spot on the
  // map with nearly the same name. A sight next door with a name that only starts the same ("Old Fort Museum" beside
  // the Old Fort) never takes the other's hours.
  const fold = x => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’'`]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/^the /, "").trim();
  const STOP = new Set(["the", "of", "and", "de", "di", "del", "la", "le", "st", "saint", "san", "santa"]);
  const toks = x => new Set(fold(x).split(" ").filter(w => w && !STOP.has(w)));
  const jac = (a, b) => { const A = toks(a), B = toks(b); if (!A.size || !B.size) return 0; let n = 0; A.forEach(w => { if (B.has(w)) n++; }); return n / (A.size + B.size - n); };
  let BYNAME = null;
  E.checkedHoursFor = (place, city) => {
    const L = E.CHECKED_HOURS; if (!place || !Array.isArray(L) || !L.length) return null;
    if (!BYNAME) { BYNAME = new Map(); L.forEach(c => [c.name].concat(c.aka || []).forEach(n => { const k = fold(n); if (k) (BYNAME.get(k) || BYNAME.set(k, []).get(k)).push(c); })); }
    const here = isFinite(+place.lat) && isFinite(+place.lng) && (+place.lat || +place.lng) ? { lat: +place.lat, lng: +place.lng } : null, town = fold(city);
    const near = (c, km) => here && c.lat != null ? E.hav(here, c) <= km : null;
    // Same name: in the same town (or within 15 km when the town isn't named the same way).
    for (const c of BYNAME.get(fold(place.name)) || []) { const d = near(c, 15); if (d === true || (d === null && town && (" " + town + " ").includes(" " + fold(c.city) + " "))) return c; }
    // Same spot, nearly the same name.
    if (here) { let best = null, bj = 0; for (const c of L) { if (near(c, 0.3) !== true) continue; const j = Math.max(...[c.name].concat(c.aka || []).map(n => jac(n, place.name))); if (j > bj) { bj = j; best = c; } } if (bj >= 0.75) return best; }
    return null;
  };
  // "20 min before closing", "1 hour before closing", "15:10": the last entry on a date with these spans, or null.
  const lastFrom = (text, spans) => {
    const t = String(text || "").trim(), close = spans.length ? spans[spans.length - 1][1] : null; if (close == null) return null;
    let m = /^(\d{1,3})\s*(min|minutes?|h|hours?)\b[^;(]*?before\s+clos/i.exec(t); if (m) return close - +m[1] * (/^h/i.test(m[2]) ? 60 : 1);
    m = /^(\d{1,2}):(\d{2})\s*(\([^)]*\))?$/.exec(t); if (m) { const v = +m[1] * 60 + +m[2]; return v > spans[0][0] && v < close ? v : null; }
    return null;
  };
  // A check older than a year is out of date: the hours are then not confirmed (used, and said).
  const ageDays = (checked, iso) => (Date.parse(iso + "T00:00:00Z") - Date.parse(checked + "T00:00:00Z")) / 864e5;
  E.readCheckedHours = (c, iso, ctx) => {
    const when = MON[+c.checked.slice(5, 7) - 1] + " " + c.checked.slice(0, 4), official = c.by === "official";
    const src = (official ? "official website" : "checked source (not the official site)") + ", checked " + when;
    let r = E.readOsm(c.oh, iso, Object.assign({}, ctx, { lat: c.lat != null ? c.lat : ctx.lat, lng: c.lng != null ? c.lng : ctx.lng }));
    // hol: the check found what the place does on public holidays, so its hours decide those days too.
    r = Object.assign({}, r, { src, checkedUrl: c.url || undefined }, c.hol || /\bPH\b/.test(c.oh) ? { phSaid: true } : {});
    if (r.known && !r.closed && !r.allDay) { const l = lastFrom(c.last, r.spans); if (l != null) r.last = l; }
    if (r.known && !official && !r.closed) r.secondHand = true;
    if (r.known && ageDays(c.checked, iso) > 365) r = Object.assign({}, r, { known: false, stale: true, why: "hours were checked " + when + ", more than a year before this date" });
    return r;
  };

  E.readPlaceHours = (place, iso, ctx) => {
    ctx = Object.assign({ lat: place && +place.lat, lng: place && +place.lng }, ctx || {});
    // Hours checked against the place's own website come first; where that check says the hours aren't published or
    // depend on the day, the hours are not confirmed, whatever the map says.
    const chk = ctx.checked !== false && E.checkedHoursFor(place, ctx.city);
    if (chk) { const r = E.readCheckedHours(chk, iso, ctx); if (r.known || !r.syntax) return r; }
    const h = String((place && place.hours) || "").trim(), cl = String((place && place.closed) || "").trim();
    // "00:00-00:00", "00:00-24:00" or "24/7" on the map is often a placeholder (an open ground, or a mapper's guess):
    // read as open all day only for places that have no gate.
    if (/^(24\/7|(Mo-Su\s*)?00:00-(00|24):00|open 24 hours|24 ?h(ou)?rs?|always open)$/i.test(h)) return { known: !!ctx.openAir, allDay: true, spans: [[0, 1440]], src: "OpenStreetMap", why: ctx.openAir ? "" : "the map says open round the clock, which for a place with a door is usually a placeholder" };
    // The map's syntax first; hours typed into the map in words ("09:00-16:30, closed Dec 27-Jan 1") are read as words.
    let r = { known: false, why: "" };
    if (h && E.isOsmHours(h)) { r = Object.assign(E.readOsm(h, iso, ctx), { src: "OpenStreetMap" }); if (!r.known && r.syntax) { const t = E.readText(h, iso, ctx); if (t.known) r = Object.assign(t, { src: "OpenStreetMap" }); } }
    else if (h) r = Object.assign(E.readText(h, iso, ctx), { src: "guide" });
    // The closed-days note ("Closed Mondays", "Closed 25 Dec and 1 Jan", "Closed on public holidays") closes the date
    // when it names it; a note that can't be read leaves the hours as they are but unconfirmed.
    if (cl && !/^(none|no|never|-|n\/a|open (?:daily|every ?day|all year))\.?$/i.test(cl)) {
      // A bare list ("Mondays", "25 Dec and 1 Jan") is a list of closed days; anything else is read as written.
      const bare = !/\b(closed|shut|open|except|only)\b/i.test(cl), c = E.readText(bare ? "closed " + cl : cl, iso, ctx);
      if (c.known && c.closed) return { known: true, closed: true, spans: [], src: r.src || "guide", why: cl };
      if (!c.known && !c.offsOpen && r.known) r = Object.assign({}, r, { known: false, why: "the closed days note can't be read for this date (" + cl.slice(0, 60) + ")" }); }
    return r;
  };
  // The app's older calls (one reader underneath).
  E.ohState = (hours, iso, minute) => { const r = E.readOsm(hours, iso, {}); if (!r.known) return null; return r.spans.some(([a, b]) => minute >= a && minute < b) ? "open" : "closed"; };
  E.ohSpans = (hours, iso, ctx) => { const r = E.readOsm(hours, iso, ctx || {}); return !r.known || r.allDay ? null : { spans: r.spans, last: null }; };
})(KEngine);
