// What each kind of control should do when pressed (rule R-38, "every button pressed"). One line per kind of control,
// keyed by its action name or its label; the press check (press-all.cjs) calls expect() after every press and reports
// EXPECT when the control did something else. Filled in as presses are reviewed: a control with no line here is held
// to the general rules only (it must do something a traveler can see, with no error, jump, cover or stuck wait).
//
// expect(c, r, rec, ctx) returns '' when the press did what it should, or the sentence to report.
//   c    the control (act, data, label, kind)        r   the raw before/after of the press
//   rec  the record so far (did: what it did)        ctx { live, trip, size, root }
const has = (rec, re) => (rec.did || []).some(s => re.test(s));
const RULES = [];
const rule = (name, match, should, test) => RULES.push({ name, match, should, test });

exports.RULES = RULES;
exports.expect = (c, r, rec, ctx) => { if (!r || !r.after || (rec.fails || []).some(f => /COVERED|DEAD|ERROR/.test(f[0]))) return '';
  for (const R of RULES) { let m = false; try { m = R.match(c, ctx); } catch (e) {} if (!m) continue; let ok = false; try { ok = R.test(c, r, rec, ctx); } catch (e) { ok = false; } rec.rule = R.name; if (!ok) return 'should ' + R.should; return ''; }
  return ''; };
// Action names that cannot be pressed in a test, each with the reason. Reported as NOT TESTED, never as a pass.
exports.CANNOT = {};
