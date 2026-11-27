# What the tests really check (Nov 24 2026)

Richard, Nov 24: "Are the tests looking at foreign languages being used, correct routes produced, accuracy of sources,
safety of back to train, flight, and cruise. Are there discrepancies in times being presented. Are sites grouped
correctly. Times given at sites stays correct. Are walk, train, metro, taxi, ferries and alike accurate ... Real data
offered. So you are telling me the almost 7000 passes give you 100% accuracy and if they are not, why are we using that
standard."

**Short answer: no.** Almost all of the ~7,000 passes check that the app **agrees with itself** (a ride's minutes match
its clock, one leave-by on every screen, nothing in a foreign script). Very few check that what the app says is **true
in the real world** (the bus really takes 25 minutes, the walk really is 1.2 km, the museum really opens at 9). A plan can
pass every one of the 7,000 and still send a traveler on a bus that takes twice as long. That is the gap, and it is why
the pass count is no longer used as a measure of readiness (docs/qa/READINESS.md).

Two kinds of check, used in the table:

- **Agrees with itself**: the app's screens, numbers and rules are consistent. Needed, but if a source is wrong, the
  app and the check are wrong together.
- **Checked against the real world**: compared with a source the app does **not** use (an official website, a
  different router, a different timetable), or with what the traveler typed (their ship and flight times).

Reach: **saved trips** = 35 fixed test trips, 34 places (the 20-city list, Greece, Bahamas, live trips). **Odd trips** =
hundreds of made-up trips in the release gate and 1,000 new ones each night (planned offline: ride times there are the
app's own estimates). **Live run** = the daily outside test on the published Beta 2 (50+ trips).

| Richard's question | What checks it today | Kind | Reach | Verdict |
|---|---|---|---|---|
| **Getting back to the ship, train or flight safely** | The independent safety check: never reads the planner's own back-by or leave-by, only what the traveler typed and the plan on screen, with the least time any ride could take; past bugs planted on every release, all caught | Real world for the deadline (the traveler's own times); agrees with itself for the ride time | Saved trips, odd trips (1,000 a night), live run | **Partly covered.** The deadline logic is well covered. Whether the ride back really takes the minutes shown was compared with real timetables by the hourly ride check, but last night it reached 17 of 87 rides and could compare only 1 (the map server was busy). New today: the real-world ride check (below) |
| **Walk, train, metro, taxi, ferry: accurate and safe** | Ride accuracy (hourly) vs Transitous; screen rules "never slower than walking", "walk time matches its distance" | Agrees with itself; Transitous is also one of the app's own sources | 24 saved trips, 87 rides, of which 1 compared last night | **Not covered** against the real world until today. Walks and taxis were never compared with a second router. Ferries have no free timetable anywhere: the app says "not confirmed" and the check makes sure it does |
| **Times agree across screens** | 48 screen rules on the finished screens (one leave-by, ride time matches the clock, times go forward, visit ends by closing...), each proven by a planted bug | Agrees with itself, which is the right test for this question | Saved trips, plus the trips saved by the two newest published builds | **Covered** |
| **Foreign languages** | Language check (every source the planner reads, with a foreign name planted in each), names check (English name from Wikidata) | Rule for letters; Wikidata for the right English name (the app also reads Wikidata) | Saved trips, every source | **Covered** for letters. **Partly** for "is it the right English name" (same source as the app) |
| **Correct routes produced** (order of the day, no zig-zags, sensible ride choice) | Engine tests, odd trips, screen rules "no absurd ride choice", "never slower than walking" | Agrees with itself plus simple physics | Saved and odd trips | **Partly.** No check compares the order with a real walking route |
| **Sights grouped correctly** (parts folded into the main sight, one story per stop) | Fold rules R-16, R-17, screen rule "sight once", planted sight bugs, weekly sight audit vs Wikidata "part of" | Mostly agrees with itself; the weekly audit uses the app's own sources | Saved trips; audit on the test places weekly | **Partly** |
| **Time at sites stays correct after changes** | Screen rule "visit length matches the clock", steady-screen checks after every redraw, reorder and swap checks | Agrees with itself | Saved trips, phone and tablets | **Covered** that the time stays the same after changes. **Not covered**: whether 40 minutes at a sight is the right length (no independent source exists) |
| **Opening hours** | Hours test: 161 sights checked by hand against their official websites, public holidays 2026-28; screen rules "never planned while closed", "arrive by last entry" | Real world for the 161; the rest use the map's hours, unchecked | Saved trips | **Partly.** Sights outside the 161 rely on OpenStreetMap hours, often missing (said as "hours not known") |
| **Accuracy of sources** | 161 official hours; Greek cruise stories fact-checked with sources; weekly sight audit (positions, names) | Real world for hours and stories; the audit uses the app's own sources | 161 sights; 82 stories; test places | **Partly** |
| **Real data offered** (no made-up claims) | Screen rules "one real reason", "reason has its numbers", "missing data said as missing", "lunch has a real place"; AI honesty and no-paid-AI checks | Checks that every claim points to data; not that the data is still true (a restaurant that closed last month) | Saved trips | **Partly** |

## Real-world score per question (read by `tools/truth/readiness-score.cjs`)

One line per question Richard asked. **yes** = checked against the real world (a source the app does not use, or what the
traveler typed), or, for "times agree across screens", the comparison between screens that IS the right test; **partly** =
some of it; **no** = only checked that the app agrees with itself. Change a line only when the check behind it is in the
release gate or a nightly run, and say which.

| Question | Real world | Why |
|---|---|---|
| Back to the ship, train or flight safely | partly | the deadline is the traveler's own time; ride back times have a real-world time only for walks and taxis (BRouter), not trains, metro or ferries |
| Walk, train, metro, taxi, ferry accurate | partly | walks and taxis vs BRouter in the gate; trains, metro, buses and ferries have no outside time yet |
| Times agree across screens | yes | 48 screen rules on the finished screens, each with a planted bug |
| Foreign languages | partly | letters rule on every source; the English name comes from Wikidata, the app's own source |
| Correct routes (order of the day) | no | no check compares the order with a real walking route |
| Sights grouped correctly | no | fold rules and the weekly audit use the app's own sources |
| Time at sites stays correct | partly | the time stays the same after changes; no outside source for the right visit length |
| Opening hours | partly | 161 sights vs official websites; the rest only the map's hours |
| Accuracy of sources | partly | official hours and fact-checked stories; the sight audit uses the app's own sources |
| Real data offered | partly | every claim must point to data; not checked that the data is still true |

## Closing the real-world gaps, safety first

1. **Ride back to the ship, train or flight; every walk, taxi, train, metro and bus** (new today, `tools/truth/real-world.mjs`,
   nightly `.github/workflows/real-world.yml`): every ride on every saved trip's plan (881 rides, 411 different) is
   compared with sources the app never uses: **BRouter** for walks (real path length at 4.5 km/h) and taxis (drive time
   on empty roads), and for trains, metro, trams, buses and ferries **the operators' own published timetable files**
   (since Nov 25: open GTFS feeds found through the Mobility Database catalog, about 1,800 live feeds worldwide, read by
   `tools/truth/gtfs-times.mjs` with its own arithmetic; Deutsche Bahn's journey planner, used first, stopped answering).
   A walk's real time counts its climb (1 min per 10 m, from BRouter's height data). The ride back on a ship, train or
   flight day planned faster than the real world allows is S1. A ferry whose operator publishes no open timetable is
   counted as NOT CHECKED, never as passed. What this does not prove: the app's journey planner (Transitous) is fed
   from the same operators' files, so a mistake inside an operator's own timetable is shared; everything between the
   file and the screen (the planner's answer, the app's reading of it, lines taken from the map, waits, walks to the
   stop) is checked.
2. **Ride accuracy run that stalls** (17 of 87 rides last night): owned by the rides thread; asked to give the ride back its
   own time budget first so it is never the part that gets cut.
3. **Opening hours beyond the 161**: grow the official list from the sights the saved trips actually plan, biggest first.
4. **Visit lengths**: no free independent source; the honest answer stays "not covered" and the screen says the time is a
   suggestion.

## Do the checks catch bugs nobody has thought of? (fault audit)

`tools/truth/fault-audit.cjs` plants random small bugs in the planner (a < for a <=, a number off, && for ||) and counts
what share the release gate's checks catch, by area. Results: see the section added below when the run finishes.

## First results (Nov 24, afternoon)

**Real-world ride check** (run 45447689433, saved trips planned as the app plans them): 362 rides compared.
- Walks: 231 of 252 right; 21 planned 5-12 min short (hills, walls). Taxis: 100 of 110 right; 2 planned too fast, 8 far
  too slow.
- Two serious ones on port days, logged as escapes E46 and E47 under the new rule R-33:
  - Kotor's mountain road to Njeguši, planned 23-25 min each way, really 42-50 min with empty roads.
  - The walk from the Nassau pier to Paradise Island, planned 18-21 min straight across the harbour, really 52-56 min
    over the bridge.
- Not checked yet: 17 train, metro and bus rides (the DB journey planner gave no answer from GitHub), 2 ferries (no
  source), 28 rides the router could not route.

**Fault audit, finished** (120 random bugs, 20 per area; full list in /mnt/project-files/reviews/fault-audit-2026-11-24.md):

| Area | Caught |
|---|---|
| Leave-by and deadlines | 11 of 20 (55%) |
| Rides | 11 of 20 (55%) |
| Screen rules | 9 of 20 (45%) |
| Day planning and lunch | 6 of 20 (30%) |
| Opening hours | 6 of 20 (30%) |
| Names and places | 5 of 20 (25%) |
| **All** | **48 of 120 (40%)** |

Some misses change nothing a traveler could see (an unused helper, a limit no real input reaches), so the true catch rate
is somewhat higher, but far from the 90% target. The pattern in the misses: the checks are strong where a past bug
taught them and blind where no test trip goes. Kairoute's promised margins (now closed by the margin rule, E49), Easter
and sunset hours (now closed, E52), a ferry arrival's time to get off, flying in on the day the ship sails with under
3 h free, a taxi-or-walk boundary, meal-hour limits, and boundaries in the screen rules (a < read as a <=).
Next: add test trips for every case the misses name (odd trips that fly in on sailing day, arrive by ferry, eat late),
then run the audit again with a new seed.
## Second fault audit (Nov 24, evening; GitHub run 45477515216, seed 48, a new set of 120 random bugs)

Run after the fixes above, with the full safety check now part of the audit (the independent safety check on saved,
unconfirmed-boat and no-timetable trips, plus the odd trips and the safety check on them).

| Area | First audit | Second audit |
|---|---|---|
| Screen rules | 9 of 20 (45%) | 14 of 20 (70%) |
| Leave-by and deadlines | 11 of 20 (55%) | 9 of 20 (45%) |
| Names and places | 5 of 20 (25%) | 9 of 20 (45%) |
| Opening hours | 6 of 20 (30%) | 8 of 20 (40%) |
| Day planning and lunch | 6 of 20 (30%) | 5 of 20 (25%) |
| Rides | 11 of 20 (55%) | 4 of 20 (20%) |
| **All** | **48 of 120 (40%)** | **49 of 120 (41%)** |

Honest reading: the bugs planted the first time are now caught, but a fresh set of random bugs is caught at about the
same rate. Fixing what one audit finds does not raise the catch rate for bugs nobody has seen; only broader checks do.
What the misses have in common:
- **Rides (weakest):** the walk-or-taxi boundary (a <= read as a <), road-speed bands, walk minutes per km, the
  2-hour gap rule, and guards with && read as ||. Several give a different but still plausible ride, which no check
  compares against anything. The nightly real-world ride check would see some of these, but it is not in the gate.
- **Day planning:** which sights get dropped when the day is full, the "also worth seeing" note, how long a far sight
  needs, Sunday-afternoon hours. No check says which sight *should* have been kept.
- Several misses change nothing a traveler sees (a cache size, a route-search size limit, an unused branch), so the
  true rate is somewhat higher, but still far from 90%.

Next, in order: (1) a "best ride" check that, for every ride on the saved trips, works out the expected kind and minutes
from first principles (distance, the walking limit, road speed) independently of the planner and flags any difference;
(2) a "kept the right sights" check (a dropped sight must rank below every kept one unless its hours or distance
forbid it); (3) put a cached copy of the real-world ride results in the gate so a ride-time bug is compared with real
routes, not only with itself; then audit again with a new seed.

## Third fault audit (Nov 24-25)

**Run at 0a7f8344: void.** One check (the reason-numbers check) was already failing on the unchanged planner after a
wording change, so it "caught" every planted bug and rides and day planning read 100%. The audit now runs every check on
the unchanged planner first; a check that fails there is left out and named as NOT TESTED, never counted as catching.

**Rerun at 3aac6d63** (GitHub run 45526712962, the same week seed 48 as the second audit; the code changed in between, so
the planted bugs overlap but are not all the same). Every check passed on the unchanged planner (no NOT TESTED).

| Area | Second audit | Third audit | What changed |
|---|---|---|---|
| Screen rules | 14 of 20 (70%) | 14 of 20 (70%) | |
| Rides | 4 of 20 (20%) | 11 of 20 (55%) | best-ride check, route-time check, real-world ride times in the gate |
| Leave-by and deadlines | 9 of 20 (45%) | 11 of 20 (55%) | |
| Names and places | 9 of 20 (45%) | 11 of 20 (55%) | |
| Day planning and lunch | 5 of 20 (25%) | 10 of 20 (50%) | odd trips plan the traveler's own ticked days; walkpref, garbled, roomleft |
| Opening hours | 8 of 20 (40%) | 8 of 20 (40%) | |
| **All** | **49 of 120 (41%)** | **65 of 120 (54%)** | |

Still far from 90%. Misses that matter most (safety first):
- **Border checks halved:** the time at the station for passport checks (90 min, to or from Britain) cut to 45, and
  nothing noticed. Same class as the ship margins (E49): Kairoute's own promise, which the independent check does not
  know. Next: the independent check gets its own list of passport borders and the 90 min promise.
- **Spare time on the way back** (slackFor) shortened for 15-30 min rides: not noticed.
- **Bag days:** the free time worked out with the bag steps added instead of taken away: not noticed.
- Opening hours: the checked-hours lookup, sunset maths, year ranges and "last entry N hours before": the hours test
  covers named cases only. Next: a fixture per opening-hours form the reader accepts.
- Several misses change nothing visible (memo sizes, sort tie-breaks, guards for input that never comes).

**A fresh set (seed 49, run 45526721276, same code, all checks passed on the unchanged planner):** 61 of 120 (51%).
Leave-by 12 (60%), rides 12 (60%), opening hours 13 (65%), screen rules 10 (50%), day planning 7 (35%), names and places
7 (35%). So about half of brand-new bugs are caught, in line with seed 48 (54%): the rise from 41% holds on bugs nobody had
seen. Weakest now: day planning (which far sight is kept, worth scores, the lunch-pick guard) and names and places (place
matching and the restaurant facts join). Since then the independent check holds the passport-border promise (cb8ed619).
