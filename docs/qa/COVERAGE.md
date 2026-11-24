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

## Closing the real-world gaps, safety first

1. **Ride back to the ship, train or flight; every walk, taxi, train, metro and bus** (new today, `tools/truth/real-world.mjs`,
   nightly `.github/workflows/real-world.yml`): every ride on every saved trip's plan (881 rides, 411 different) is
   compared with sources the app never uses: **BRouter** for walks (real path length at 4.5 km/h) and taxis (drive time
   on empty roads), **Deutsche Bahn's journey planner** for trains, metro, trams and buses (most of Europe's rail and many
   city lines). The ride back on a ship, train or flight day planned faster than the real world allows is S1. Ferries are
   counted as NOT CHECKED, never as passed.
2. **Ride accuracy run that stalls** (17 of 87 rides last night): owned by the rides thread; asked to give the ride back its
   own time budget first so it is never the part that gets cut.
3. **Opening hours beyond the 161**: grow the official list from the sights the saved trips actually plan, biggest first.
4. **Visit lengths**: no free independent source; the honest answer stays "not covered" and the screen says the time is a
   suggestion.

## Do the checks catch bugs nobody has thought of? (fault audit)

`tools/truth/fault-audit.cjs` plants random small bugs in the planner (a < for a <=, a number off, && for ||) and counts
what share the release gate's checks catch, by area. Results: see the section added below when the run finishes.
