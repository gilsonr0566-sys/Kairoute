# When is Kairoute ready? Measured by escapes, not by passes

Richard, Nov 24 2026: "I don't feel we are close to being ready for prime time. With that said, you did 6998 passes with
0 errors. Either that means we are ready or there is fault in our pass testing."

Neither, strictly. "6,998 passed" means every check written so far agrees with the code. Each check was written for a bug
someone had already found, so the count says nothing about the bugs nobody has found yet, and those are what decide
whether a traveler can trust the app. Two numbers answer that question better.

## 1. Escapes: new bugs found by someone other than the checks

An escape is a bug the release gate let through, later found by an outside tester, Fable, Richard, a live run or another
thread reading the screen. Escapes are logged in `docs/qa/escapes.md` and counted per day by `tools/truth/escape-rate.cjs`.
Bugs the gate, the independent check or a class check caught first are counted apart: the checks worked on those.

**Ready for prime time** means all of these hold:

| Measure | Target |
|---|---|
| Serious escapes (S1 or P1: could cost a ship, train or flight, or badly mislead) | 0 for 14 days in a row |
| Other escapes | at most 1 a day, for 7 days in a row |
| Testing volume during those days (so a quiet week isn't just less testing) | the daily live outside run (50+ trips), the daily client feel run, the weekly Fable test, and Richard's own use every day |
| Fault audit catch rate (`tools/truth/fault-audit.cjs`: random bugs planted in the planner) | 90% or more in every area, with each miss read and either covered by a new check or shown to change nothing |
| Core exit criteria (Nov 19) | 0 safety failures, 0 leaks, 100% timed real lunch, 0 zig-zags, 100% ticks match, 2 clean sweeps in a row, 5 days of Richard's use with no new bug |

Every escape also gets its class rule (`docs/qa/RULES.md`): a check for the whole kind of bug, with a planted bug that
proves it fires, so the same class can't escape twice.

## 2. Fault audit: do the checks catch bugs nobody has thought of?

`tools/truth/fault-audit.cjs` copies the planner, plants one random small bug (a < for a <=, a number off, && for ||, a
dropped !), runs the engine-side checks of the release gate, and counts the share caught, by area (leave-by and
deadlines, rides, day planning and lunch, opening hours, names and places, screen rules). Past bugs are already planted
on every release by `tools/truth/mutants.cjs`; this one finds the gaps.

## 3. What the hourly report leads with

The report's first lines are, in this order:

1. **Escapes today**: how many new bugs were found outside the checks, how many serious, and the running count of days
   toward the targets above (from `escape-rate.cjs`).
2. **Fault audit catch rate** by area, from the last run, with the weakest area named.
3. Then the release status and everything else. The pass count moves to the end, as a count of checks, never as a sign
   of readiness.

## 4. One readiness number (Richard, Nov 25: "a 1 percentage that shows a increase or decrease in readiness")

`node tools/truth/readiness-score.cjs` gives one percentage, built only from measured data. The pass count is not in it.
Four parts, 25 points each:

| Part | What is measured | Full 25 points when |
|---|---|---|
| Fault audit catch rate | Average share of fresh random planted bugs the release gate catches, per area (`docs/qa/fault-audit-latest.json`, updated after each audit run). Bugs noticed only by the plan ledger are not counted: the ledger says a plan changed, not that it is wrong | 90% or more on average |
| Real-world ride accuracy | For each kind of ride on the saved trips' plans (walk, taxi, train, metro, bus, ferry), the share of rides whose time a source the app doesn't use confirms as right. A ride with no outside time is not counted as right, so a kind with no outside source scores 0. Kinds count equally | every ride of every kind confirmed right |
| Clean days | Whole days in a row, up to yesterday (Central), with 0 serious escapes and at most 1 other (`docs/qa/escapes.md`). A bad day resets it | 7 days |
| Real-world coverage of Richard's questions | `docs/qa/COVERAGE.md`, "Real-world score per question": yes 1, partly 0.5, no 0 | all 10 questions checked against the real world |

**Hard cap:** while any serious escape (S1, P0, P1) is open in the ledger, or any ride back to a ship, train or flight on
the saved trips has no real-world time, the score can't go above 50%, whatever the parts add up to.

The hourly report leads with the number, the change since the last report and the weakest part. The report saves each
reading with `--save` (history in `/mnt/project-files/qa/readiness-history.json`), so the change is always against the
last report. 100% is not "perfect"; it means every measure above has met its target. The full ready line in section 1
(14 days without a serious escape, 90% in every area) still applies.

First reading, Nov 25 10:30 AM Central: **29.6%** (fault audit 14.1, real-world rides 4.3, clean days 0, coverage 11.3),
held under 50% by E8, E46, E47 open and 13 rides back with no real-world time.
