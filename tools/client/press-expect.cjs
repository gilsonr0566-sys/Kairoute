// What each kind of control should do when pressed (rule R-42, "every button pressed"). One line per kind of control,
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
  [c => /(^|,)ts=(addstay|addcruise)/.test(c.data), 'a new stop is added and its first field is brought to the middle of the screen', 'opens'],
  [(c, x) => (c.act === 'wizmore' || /^Build my trip$/.test(c.label)), 'the new-trip form says what is missing at its top and the page goes there', 'opens'],
  [c => c.act === 'needgo', 'a Still needed line goes to the field it names and puts the cursor there'],
  [(c, x, r) => (x && x.view === 'trip' || r && r.after && r.after.view === 'trip') && /(^|,)day=\d+/.test(c.data) && !c.act, 'on the Trip page a day tapped in the list is opened in the form below it'],
  [c => c.act === 'mealopen' || c.act === 'bookopen', 'the card to change a meal, or to enter a reservation, opens above the day\'s list and the page goes to it', 'opens'],
  [c => /(^|,)jump=/.test(c.data), 'in the Guide, Next and the stop list open that stop\'s chapter from its top', 'opens'],
  [c => c.act === 'suggesttour', 'Suggest my tour answers in a note and the page goes to the note (the pinned leave-by strip gives way to the full card there)', 'opens'],
  [(c, x, r) => c.kind === 'fold' && (r.scrolls || []).some(s => /placeMenu/.test(s)), 'a menu too tall to fit above or below its button: the page moves just enough for the whole menu to show under it'],
];
exports.SCROLLS = SCROLLS;
// Returns '' (not listed), 'scroll' (the app may scroll to it) or 'opens' (it opens a card elsewhere on the page and goes there).
exports.scrollsTo = (c, x, r) => { for (const s of SCROLLS) { try { if (s[0](c, x, r || {})) return s[2] || 'scroll'; } catch (e) {} } return ''; };
// Action names that cannot be pressed in a test, each with the reason. Reported as NOT TESTED, never as a pass.
exports.CANNOT = {};
// Action names that may rightly show nothing at the moment they are pressed, each with the reason. Listed in the report
// under what the control did; a control not listed here that shows nothing is DEAD.
exports.QUIET = {
  filmreplay: 'Replay starts the intro film again; the film is moving pictures, and no words on the screen change, which is all this check can see',
};
