# Kairoute: how the app is checked (Beta 2), November 23, 2026

Plain-words overview of the whole checking process as it stands today, including the changes made today. Every item
is marked:

- **RUNNING**: built and running now.
- **BUILT**: written and tested, starts running once the build thread merges it into the Beta 2 branch (agreed for today).
- **PLANNED**: not built yet.

## Why it changed

Three things were wrong with how the app was checked.

1. **The checks agreed with the app instead of with the world.** Almost every check read the planner's own numbers: its
   own "be back by" time, its own leave-by, its own day start. When the planner got one of those numbers wrong, the plan
   and the check were wrong together, and everything passed. That's how a 5:45 am flight got a full Sintra day, a
   countdown was 41 minutes late, and "off the ship 5:30 am" came before the ship was in. Outside testers found these, not
   the tests.
2. **The tests were never shown to fail.** No one checked whether the tests could catch a real bug. When I put 7 real
   past bugs back into a copy of the planner, the old checks caught **1 of 7**.
3. **The release gate rarely finished.** It ran every check one after another (50 to 70 minutes), and each new change
   cancelled the run before it. 14 of 69 runs went green, and only 1 of the last 18. Nothing reached the live app for
   21 hours, so fixes waited and live checks lagged.

## The four rules now

1. **Check against the world, not against the app.** A separate safety checker works only from what the traveler typed
   (dates, times, airport, station or pier) and what the screen shows. It has its own simple model of travel. Its limits
   are set in the app's favour (at least 60 min at an airport, a ride no faster than 60 km/h in a straight line), so when
   it says something is unsafe, it really is. **BUILT**
2. **Prove the checks can fail.** Real past bugs are planted in a copy of the planner on every run, and the run fails
   unless every one is caught. Today 8 are planted. The old checks caught 1 of the first 7; with the new checker all 8 are
   caught. **BUILT**
3. **"Not tested" is never "passed".** Every part of the release check is reported as PASS, FAIL or NOT TESTED. A part
   that was cancelled, skipped or timed out blocks a release, the same as a failure. **BUILT**
4. **Every bug that gets past the tests teaches them.** Each one goes in a log with the answer to "why didn't a test
   catch it?". The fix isn't finished until a test exists that would have caught it, and where possible that test becomes
   a planted bug. **RUNNING** (the log has 10 entries)

## What runs, and when

### After every change (the release check)

Every change to the Beta 2 code runs 8 checks side by side, in about 15 minutes instead of an hour. **BUILT**

1. **Code.** No passwords or keys in the code, no syntax errors, the planner's own rules, and the helper's AI switch
   stays off.
2. **Safety.** The independent checker on the saved test trips and on 300 unusual trips (dawn and midnight flights,
   short and overnight port calls, tender ports, bag-storage days, multi-city trips), then the planted bugs.
3. **Planner rules.** Opening hours, public holidays, reasons with their numbers, lunch.
4. **Leaks and stress.** Wasted time, zig-zags, rides slower than walking, overfilled days.
5. **Phone flow.** The real app at phone size: taps, ticks, timing.
6. **What the traveler sees.** Screen rules on every day, phones set to other time zones, no signal, trips saved by
   the last two published versions, 5 screen sizes, all recorded voices, and the app's own safety guard.
7. **Odd days on screen.** Short, late and after-midnight port calls, ship days while a slow check waits, group trips.
8. **True words.** First run, day plan, places it can't reach, no paid AI offered, trips copied from the first app,
   outside text never run as code, the app claims nothing the AI can't do.

A ninth step writes the **release report** (see Reporting). A version is published only from a report that says
**RELEASE OK**. After publishing, the live site's version number is checked and the changed behavior is checked there
before anyone says "it's live". **RUNNING** (the live check)

### Every night, 1:30 am Central

**BUILT**, and it starts on the nightly schedule once the file is on the repository's main branch (handed to the build
thread).

- **1,000 new unusual trips** from a new seed each night, through both the old checks and the independent checker. The
  seed and every trip are kept, so any failure can be replayed exactly.
- **The planted bugs** again, on 300 trips.
- **Every ride the test plans hold, against real published timetables** (Transitous, built from the transit operators'
  own data). Rides to and from airports, stations and piers go first. Before today only 27 rides from a day's start to its
  sights were ever compared; now 128 rides are, 59 of them airport, station, pier or day-start rides. This is the kind of
  check that would have caught the airport metro planned at 68 minutes against a real 39.

### Every hour

- A sample of ride times against timetables. **RUNNING**

### Every week (Sunday evening)

- The Fable outside test on the live site, with harder demands each week, and the screen rules on every step.
  **RUNNING**

### On demand

- **Sight audit.** Every sight against Wikidata and OpenStreetMap: demolished, not a sight, wrong position, duplicate.
  **RUNNING on demand**. Running it every week is **PLANNED**.
- **Live dry runs** on places the app was never tuned for, and the **first-time traveler walk**. **RUNNING on demand**

## Reporting

### Every release check writes a report with your 14 items

What was tested, what wasn't, how many passed, failed, or were blocked or skipped, new bugs, known bugs, safety concerns,
AI factuality concerns, root causes, corrections made, tests added, remaining risks, and a release recommendation.
**BUILT**

### Your three release targets, each must be 0, at the top of every report

- Unverified return connections presented as confirmed. The new checker flags a way back that rests on a ride with no
  timetable but is marked as timetabled, and a train or boat that doesn't say its time isn't confirmed. A planted bug
  proves this check works.
- Unhandled critical workflow failures: errors while planning, and errors in the app's pages.
- Mandatory tests not executed: every part that didn't run, and every planted bug that couldn't be planted.

"These standards are gates, not claims that all possible failures have been eliminated." The report says this.

## The escaped-bug log

`docs/qa/escapes.md`. Each row has: where the bug was found and by whom, what the traveler saw, how serious it is, **why
the tests missed it**, the kind of test added, and its status. **RUNNING**

**New today, found by the independent checker before any traveler saw it:** a departure typed in the small hours (for
example 12:20 am) on a departure day is read as the next night, and the day fills with sights. Nobody is asked. A ticket
dated that day means this morning. It's reported as a known issue so it doesn't hold back today's fixes, and it's handed
to the leaving-days work as a general rule: ask the traveler which night, and plan nothing until they answer.

## Your testing directive, rule by rule

| # | Your rule | How it's met | Status |
|---|---|---|---|
| 1 | Independently test every changed feature | Release check on every change; independent safety checker | BUILT |
| 2 | Regression across affected features | The whole release check runs on every change, not only the changed part | BUILT |
| 3 | Never weaken a test to pass | Planted bugs fail the run if a weakened safety check stops catching them | BUILT (safety checks) |
| 4 | Normal, abnormal, boundary, invalid, contradictory inputs | Unusual trips (midnight, dawn, too-tight, every sight ticked, emptied days) | BUILT. Malformed trip-form entries: PLANNED |
| 5 | Randomized and property-based tests | Unusual trips plus independent rules on every day; a new seed nightly | BUILT |
| 6 | Every failure a permanent regression test | Escaped-bug log, planted bugs, nightly seeds kept | RUNNING. Nightly failures added to the saved trips automatically: PLANNED |
| 7 | Independently verify safety calculations | Independent safety checker | BUILT |
| 8 | Every route a plan is made, changed, saved or shown | Phone flow, screen check, older saved trips, trip copy, group trips | BUILT. Print and share view: PLANNED |
| 9 | Every final plan through the safety guard after its last change | The app's guard runs on every screen draw (since Nov 22); screen check tests it | RUNNING |
| 10 | Never safe when a return is unverified | Release target 1 and its planted bug | BUILT |
| 11 | Never invent schedules, hours, facts, times | AI off; "not confirmed" wording checked; one hours reader with official hours | RUNNING. Freshness date on each fact: PLANNED |
| 12 | AI against false premises, disputes, missing evidence, bad outside text | AI is off at runtime by your rule; outside text never runs as code | NOT TESTED for AI answers (an AI test set comes before AI is ever switched on) |
| 13 | Offline, interrupted, failed services, expired sessions, corrupted data | No-signal check, every service refused, older saved trips | BUILT. Interrupted save and corrupted storage: PLANNED |
| 14 | The real customer screens | Phone flow, screen check, first-time traveler walk on the live site | RUNNING |
| 15 | Supported phones and browsers | Chrome at 5 sizes (your tablet and phone use Chrome on Android) | BUILT. Safari and Firefox engines: PLANNED (free) |
| 16 | Independent review of safety changes | Weekly Fable outside test; this testing thread reviews safety changes | RUNNING weekly. Review before each publish: PLANNED |
| 17 | Never report a pass that didn't run | NOT TESTED is never PASS in the report | BUILT |
| 18 | Report skipped, blocked, failed, untested | Report section 2 and the targets | BUILT |
| 19 | Root causes, not patches | "Why missed" in the log; a rewrite of an area once its patches pile up (your Nov 17 rule) | RUNNING |
| 20 | No release with an open P0 or P1 | Publish only from RELEASE OK | BUILT (publishing is still a manual step) |

## Your QA package, document by document

- **Quality standard (001).** Severity P0 to P3 is mapped to this project's S1 to S3. Independent oracles, mutation
  testing and recorded seeds are in place. Gates A to F are covered by the 8 parts and the report.
- **Playbook (002).** Fast checks on every change, nightly random runs, the weekly outside test.
- **Test catalog (003).** Every area is mapped to a real check in `docs/qa/test-map.md`, with the uncovered ones marked
  NOT TESTED.
- **Release and incidents (004).** The release report, the escaped-bug log with the post-incident questions, and
  publishing only from RELEASE OK.
- **Metrics and report (005).** The report template is built into every run.
- **Roadmap (006).** Phases 0, 1, 3 and part of 6 (mutation testing) are done today. Phases 2, 4 and 5 are partly done.
- **Templates.** Not copied in. Beta 2 has no npm project and no TypeScript. Its checks are Node scripts with Playwright,
  run on GitHub. The templates' ideas are used through those scripts.

## In this zip

- `OVERVIEW.md`: this document.
- `qa/`: how Kairoute tests itself (README), the escaped-bug log, the risk register and test map.
- `workflows/beta2-gate.yml`: the release check (8 parts and the report).
- `workflows/truth-nightly.yml`: the nightly run.
- `tools/truth/`: the independent checker (`oracle.cjs`), the planted bugs (`mutants.cjs`), the report writer
  (`release-report.cjs`).
- `tools/`: the unusual-trip generator, the screen rules, and the ride-timetable comparison.
- `results/`: today's runs, including the planted-bug results and the first report.
- `release.md`: how a Beta 2 version is published and checked live.
