# Risk register and test map (Beta 2, Nov 23 2026)

This maps Richard's QA package (KAI-QA-003 test catalog, risk register template) onto the checks that really exist. It
says plainly what is **NOT TESTED** yet. A row moves only when a check exists and has been seen to fail on the bug it
guards (a planted defect, or the old code).

## Risk register

| Risk | Impact | Controls in the app | Tests | Gap / next action |
|---|---|---|---|---|
| R-001 Wrong or unverified return ride | Critical | Boats only on confirmed sailings; "not confirmed" said; ride source on each option | Screen rules (checked ride back); ride accuracy hourly; nightly planned rides vs timetables | Ferries with no open timetable can only be said "not confirmed" (E8) |
| R-002 Back after the hard time, shown as safe | Critical | One leave-by (95-plan); the in-app guard | Independent check (gone, reach, leaveby); planted defects (5 of 7 are this risk); screen rules; odd trips | Small-hours departure read as the next night, never asked (E9, open) |
| R-003 Stale opening hours or timetables | High | One hours reader, 161 official sights, holidays 2026-28 | hours-test; screen "closed on" backed by hours | Recheck hours by Oct 2027; no freshness date shown per fact yet |
| R-004 Legend or disputed claim said as fact | High | Stories from build time with a fact-check gate, sources shown | Story fact-check (factcheck.json) | Not part of the release gate |
| R-005 Trip lost when the signal drops | High | Own offline store | Screen gate C (no signal), D (older saved trips) | Save interrupted mid-write: NOT TESTED |
| R-006 Time zone or clock-change error | High | Plans in local time | Screen gate B (Chicago, Tokyo, Athens phones); odd trips on clock-change dates | A trip crossing a clock change on screen: partly |
| R-007 Outside text run as code or as instructions | High | AI off; text escaped | inject-check; ai-honesty-check | None known |
| R-008 Walking or access need ignored | High | "Walks little" pace | Odd trips (walk); stress | Step-free routes: NOT TESTED (no data source) |
| R-009 A sight that isn't one (gone, a stadium, an office) | Medium | Wikidata kinds and "gone" from the helper | sight-rules-check (gate); sight audit (on demand) | The audit doesn't run on a schedule (E5, E6) |
| R-010 The gate itself not running or not finishing | High | Parallel gate, release report, NOT TESTED blocks | The report job | Gate health (time, green rate) not yet tracked over time |

## Test catalog vs checks

Legend: **Gate** = blocks a release. **Nightly** = reported each night. **Weekly** = the Fable outside test. **Manual** =
a person checks it. **NOT TESTED** = nothing checks it yet.

| Package area | Covered by | Level |
|---|---|---|
| PLAN-001..003 basic plans, empty day | engine-test, flow-check, odd trips (emptied days) | Gate |
| PLAN-004 zero time, PLAN-019 conflicts | odd trips (short calls, too-tight hops say so) | Gate |
| PLAN-008/009 closed day, closes during visit | hours-test, screen "closed on" | Gate |
| PLAN-010/011/012 pins, own order, removals | odd trips (own order, unticked), flow-check ticks | Gate |
| PLAN-013 duplicates | odd trips `twice`, screen rule "sight once" | Gate |
| PLAN-015 same input, same plan | screen gate B/C (time zone, offline give the same plan) | Gate |
| PLAN-016/017/018 time zone, overnight, clock change | screen gate B; odd trips (after-midnight calls, clock-change dates) | Gate, partly |
| PLAN-020 replan after a delay | live countdown re-plans from where the traveler is | **NOT TESTED** in the gate |
| SAFE-001..003 deadline and buffer | independent check; planted defects | Gate |
| SAFE-004/005/006 missing or unverified return | screen rules (checked ride back, "not confirmed") | Gate |
| SAFE-011/012 guard bypass, plan changed after the guard | screen guard on every render; flow-check after taps | Gate |
| SAFE-014 clock mismatch | screen gate B | Gate |
| TRANS-001..006 ride kinds and steps | engine-test, leaks (never slower than walking), screen rules | Gate |
| TRANS-003/004/005 timetables for bus, train, ferry | ride accuracy (hourly), planned rides (nightly) | Nightly |
| TRANS-012/013/014 helper timeout, 429, partial answer | noai-trips, water-wait-check, live dry runs | Gate, partly |
| PORT-001..015 ship days | screen rules (ship rules), odd trips (tender, overnight, after midnight), independent check | Gate |
| PORT-015 "will I make the ship?" never a guarantee | dayplan-check (words) | Gate |
| AI-001..020 guide content | AI is off at runtime; stories are checked at build time | AI-runtime cases **NOT TESTED** (AI off by Richard's rule) |
| UI-001..020 screens | first-run, dayplan, gate-ask, no-signal, tap-check, 5 screen sizes | Gate; screen-reader and keyboard: **NOT TESTED** |
| DATA-001..004 saved trips | screen gate D (last two published builds); trip-copy-check | Gate |
| DATA-002 interrupted save | none | **NOT TESTED** |
| SEC-002 secrets in code | static-check | Gate |
| SEC-003/004 outside text | inject-check | Gate |
| REL-001..006 sources down, slow, stale | noai-trips (every source refused), water-wait-check | Gate, partly; stale cache: **NOT TESTED** |
| Performance | odd trips `slow` (plan time), flow-check tap times | Gate |
| Mutation testing | tools/truth/mutants.cjs (7 planted defects) | Gate |
