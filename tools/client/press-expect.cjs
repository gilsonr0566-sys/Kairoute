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
// Controls that rightly scroll the screen to what they open or to the app's answer (a new form, a new step, a message at
// the top). Any other control that scrolls the screen by itself is a JUMP. [what matches, why].
const SCROLLS = [
  [c => /(^|,)ts=(addstay|addcruise)/.test(c.data), 'a new stop is added and its first field is brought to the middle of the screen'],
  [(c, x) => x && x.view === 'trip' && /(^|,)day=\d+/.test(c.data) && !c.act, 'on the Trip page a day tapped in the list is opened in the form below it'],
];
exports.SCROLLS = SCROLLS;
exports.scrollsTo = (c, x) => SCROLLS.some(s => { try { return s[0](c, x); } catch (e) { return false; } });
// Action names that cannot be pressed in a test, each with the reason. Reported as NOT TESTED, never as a pass.
exports.CANNOT = {};
