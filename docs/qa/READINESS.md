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
