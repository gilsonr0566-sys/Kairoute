# Kairoute QA specification, version 2

**Document ID:** KAI-QA-SPEC-2 · **Date:** November 23, 2026 · **Replaces:** the rules part of KAI-QA-001 to 006 (v1.0) where
they differ · **Applies to:** Beta 2 (the single built page, its engine `src/engine`, the helper `worker/`), and every
version after it.

## 0. The standard

> Kairoute actively tries to break itself, finds weaknesses before travelers do, and refuses to publish when it cannot
> demonstrate that a trip is safe. (Richard, Nov 23 2026)

Two refusals follow from that sentence, and this spec makes both of them tests:

1. **The release refuses.** A version is published only when every mandatory check ran, passed, and was itself shown
   able to fail. Anything else, including "it was already like that on the live site", is DO NOT RELEASE.
2. **The app refuses.** For a single trip, when the app cannot show that the traveler gets back to their flight, train
   or ship in time, it does not present that day as safe. It asks, plans less, or says "not confirmed". It never fills the
   gap with a guess.

v1's architecture stays: the quality standard, the playbook, the catalog, the release and incident process, the report,
the roadmap. v2 keeps all of it. It closes the weak spots found in the first day of running it, and gives every
remaining requirement a named test, a proof that the test bites, and a status.

## 1. What v2 changes, and why

| # | Finding (Nov 23) | v1 said | v2 rule | Status |
|---|---|---|---|---|
| F1 | **A safety finding could be listed as a warning.** The gate passed `--warn night` for a known S1 bug (a small-hours departure read as the next night) so it would not hold back other fixes. Richard: "a serious design flaw". | "No safety-critical failure may be waived by a developer acting alone" (it could still be waived) | **No warn-only path for safety, for anyone.** The checks refuse to warn a safety rule and fail the run. A guard test proves it on every run. The report counts every safety finding as a release target that must be 0. | ENFORCED (c35a8951) |
| F2 | The checks agreed with the app instead of with the world: they read the planner's own back-by, leave-by and day start. | "Independent oracles" (advice) | Every S1 requirement names an **independent oracle** that reads only what the traveler typed and what the screen shows. A check that reads the planner's own numbers does not count for S1. | ENFORCED for the 7 safety rules |
| F3 | Tests were never shown to fail. The old checks caught 1 of 7 real past bugs when they were planted back. | "Mutation testing should periodically check" | **A test counts only once it has been seen to fail.** Every S1 rule has at least one planted defect, run on every gate. A defect that cannot be planted is NOT TESTED and blocks. | ENFORCED (9 engine + 11 sight defects); coverage check TO BUILD (T1) |
| F4 | The gate ran 50-70 min in one line, each push cancelled the run before; 1 green in 18; no release for 21 hours. | not covered | The gate runs in parallel parts, about 15 min. Runs are never cancelled by a newer push. **Gate health is a tested requirement**: a part over 20 min or a green rate under 50% over 10 runs is a defect with a ledger row. | Parallel + no-cancel ENFORCED; health in every release report (T6) |
| F5 | The nightly run "reports only". A safety finding it makes at 1:30 am does not stop a release at 9 am. | "Scheduled nightly" | **A nightly safety finding holds the release** until it is fixed or proven a false alarm. The release report reads the latest nightly result. Every failing nightly trip is added to the saved test trips, so it is retested forever. | TO BUILD (T2, T3) |
| F6 | Publishing from RELEASE OK is a written rule; a person (or a Claude) does the copy. | "Release approver signs off" | **The publish step itself refuses** unless the exact commit has a RELEASE OK report. After publishing, the live version number and the changed behavior are checked on the live site before anyone says "live". | Live check RUNNING; publish refusal TO BUILD (T4) |
| F7 | The app's own refusals (ask about a small-hours departure, plan nothing on an unknown pier) were added one bug at a time. | Gate C (in prose) | **The app's fail-closed rules are a list (section 4), each with a test** and a planted defect that removes the refusal. | Partly ENFORCED; see section 4 |
| F8 | An S2 warning had no end date. | "P2: owner and approval" | An S2 warning lives in one file with an owner and an expiry date (7 days). After expiry it fails. | TO BUILD (T5) |
| F9 | The same thread wrote, tested and approved some safety changes. | "Not the sole author, tester and approver" | **A safety change is reviewed by someone who did not write it** before it is published: the testing thread reads the diff of any file that touches leave-by, back-by, deadlines, rides back or the guard, and the review is recorded in the release report. | TO BUILD (T7) |
| F10 | Requirements in v1 with no test at all (interrupted save, replan after delay, malformed form entries, Safari/Firefox, keyboard/screen reader, freshness date, AI answers). | listed | Each has a named test below with what it feeds in and what must come out. NOT TESTED stays visible in every report until it is built. | TO BUILD (section 6) |

## 2. Words used in this spec

- **S1 (= P0):** could make a traveler miss a flight, train or ship, or shows something impossible as safe. Blocks.
- **P1:** wrong timing, a wrong ride, an invented fact on screen, a core screen unusable. Blocks.
- **S2 (= P2):** wrong or misleading on screen, with a workaround. May be released only as a warning with an owner and an
  expiry (F8).
- **S3 (= P3):** untidy. Backlog.
- **Independent oracle:** a second, simpler model of the same truth, built only from what the traveler typed, what the
  screen shows, and outside facts (timetables, maps). It never calls the planner's own numbers.
- **Planted defect (mutant):** a real past bug, or a likely one, written back into a copy of the code. The check must
  catch it. If it does not, the check is broken, and the run fails.
- **ENFORCED:** the test runs in the release gate, blocks on failure, and has been seen to fail on the bug it guards.
- **NIGHTLY / WEEKLY:** runs on a schedule; how its findings reach the release is stated in the row.
- **TO BUILD:** specified here, not running yet. It appears as NOT TESTED in every release report until it is built.
- **PASS / FAIL / NOT TESTED:** only a check that ran and met its assertions is PASS. Cancelled, skipped, timed out,
  could not plant, library missing: NOT TESTED, which blocks like FAIL.

## 3. The release rule

A commit may be published only when its release report says **RELEASE OK**, and that happens only when all of these
are true:

| # | Condition | How it is checked |
|---|---|---|
| R1 | All 8 gate parts ran and passed | Report job reads every part's result; anything but success is FAIL or NOT TESTED |
| R2 | Unverified return connections presented as confirmed = 0 | `FAIL unverified` count from the independent check |
| R3 | Unhandled critical workflow failures = 0 | `FAIL error` + page errors, uncaught errors, TypeError, ReferenceError in any part's log |
| R4 | Mandatory tests not executed = 0 | Parts not run + every `NOT TESTED` line (including planted defects that could not be planted) |
| R5 | **Safety findings = 0, whether printed as FAIL or WARN** (new) | Count of every safety rule line (gone, reach, leaveby, before, night, unverified, back, start, order, nan) + any refused attempt to warn one |
| R6 | Every planted defect caught | `tools/truth/mutants.cjs`, `tools/truth/sight-mutants.cjs` exit 1 on any MISSED |
| R7 | No safety finding can be silenced | `tools/truth/no-warn-check.cjs` (code part) |
| R8 | No open S1/P1 row in the ledger | `tools/truth/release-report.cjs` reads `docs/qa/escapes.md` (built Nov 23) |
| R9 | The latest nightly run has no unresolved safety finding | The nightly's new-trips job turns red on one; `tools/truth/release-report.cjs` reads it (built Nov 23; needs the nightly workflow on main) |
| R10 | Every ENFORCED row of this spec is really in the gate | `tools/truth/spec-check.cjs` (code part) |

"These standards are gates, not claims that all possible failures have been eliminated." Every report says so.

## 4. The app's own refusals (fail closed)

The release gate stops a bad version. These rules stop a bad plan inside a good version. Each is a requirement on the
app, with its test.

| ID | When | The app must | Never | Test | Proof it bites | Status |
|---|---|---|---|---|---|---|
| FC-01 | A departure is typed between midnight and 5 am | Ask once: "early this morning, or late tonight?" Plan only the way there until answered | Pick a night silently | independent check rule `night` (`tools/truth/oracle.cjs`); leaving-days engine tests | planted defect `train-as-tomorrow`; a new one for the question itself (leaving-days thread) | ENFORCED once the leaving-days fix is merged (gate fails until then) |
| FC-02 | The way back rests on a boat or train with no timetable | Say "not confirmed" on that ride; add an hour at the pier; never mark the way back as timetabled | Show the time as confirmed | rule `unverified` (`tools/truth/oracle.cjs`); screen rules | planted defect `return-shown-confirmed` | ENFORCED |
| FC-03 | A stop would end after the latest safe leave time | Drop or shorten it, and say so | Keep it and show a leave-by after it | rules `gone`, `reach`, `leaveby` | `leaveby-late`, `airport-time-gone`, `back-after-all-aboard`, `bags-left-as-collected` | ENFORCED |
| FC-04 | A stop would start before the traveler can be there (plane landed, ship docked, tender) | Start the day at the earliest real time | Show a stop before arrival | rule `before` | `ashore-before-docking`, `off-before-arrival` | ENFORCED |
| FC-05 | The pier, terminal or airport is unknown | Ask which; plan no sights that depend on the answer | Assume one | `tools/ui/gate-ask-check.cjs` | TO BUILD: planted defect that assumes the first pier (T1) | Test ENFORCED; mutant TO BUILD |
| FC-06 | The deadline (all aboard, departure time) is missing | Ask; say no return check was possible | Plan as if there were none | TO BUILD: independent rule `nodeadline` on odd trips with the time blanked (T10) | planted defect: default deadline 23:59 | TO BUILD |
| FC-07 | The helper or a source is down, slow or refuses | Plan with what is known, mark rides "about", say what is missing | Invent a time; hang | `tools/beta2/noai-trips.cjs`, `tools/ui/no-signal-check.cjs`, `tools/beta2/water-wait-check.cjs` | TO BUILD: planted defect that turns a failed lookup into a timetable answer (T1) | Tests ENFORCED; mutant TO BUILD |
| FC-08 | The plan changes after it was checked (a tap, a tick, a re-plan) | Run the safety guard again before showing it | Show an unchecked plan | screen guard on every draw (`tools/beta2/screen-gate.cjs`), `tools/beta2/flow-check.cjs` after taps | TO BUILD: planted defect that skips the guard on re-plan (T1) | Tests ENFORCED; mutant TO BUILD |
| FC-09 | A traveler's typed times contradict each other (ship leaves before it arrives, flight before landing) | Say which ones clash and plan nothing until fixed | Swap or guess | TO BUILD: malformed and contradictory form entries (T11) | planted defect: clash silently swapped | TO BUILD |
| FC-10 | Asked "will I make my ship?" | Explain the buffer and the risk | Guarantee | `tools/ui/dayplan-check.cjs`, `tools/ai-honesty-check.cjs` | wording probes in those checks | ENFORCED |

## 5. Requirements and their tests

The v1 catalog IDs are kept. Rows marked ENFORCED name the tool that runs in `.github/workflows/beta2-gate.yml`.
`tools/truth/spec-check.cjs` (code part of the gate) fails when an ENFORCED row names a tool the gate does not run, or a
planted defect that does not exist. A row cannot claim ENFORCED unless that holds.

### 5.1 Safety core (S1). Each needs an independent oracle and a planted defect.

| ID | Requirement | Enforcing test | Proof it bites | Status |
|---|---|---|---|---|
| SAFE-001/002/003 | Back at the hard time with the buffer, or not marked safe; a minute over is never safe | `tools/truth/oracle.cjs` rules gone, reach, leaveby (floors set in the app's favor: 60 min airport, 10 train, 15 ship, 60 km/h straight line) | 4 planted defects (section 4, FC-03) | ENFORCED |
| SAFE-004 | Missing deadline: ask, never plan as if none | FC-06 | FC-06 | TO BUILD (T10) |
| SAFE-005/006 | Unknown or unverified way back is never shown as confirmed | rule `unverified` | `return-shown-confirmed` | ENFORCED |
| SAFE-008 / PLAN-020 | A delay re-plans everything after it and keeps the deadline | TO BUILD (T12): the live countdown re-plan driven on odd trips with a delay of 15, 45 and 90 min at each stop, then the independent check on the result | planted defect: re-plan keeps the old leave-by | TO BUILD |
| SAFE-010 | A malformed plan is never approved by the guard | TO BUILD (T11): feed the guard plans with missing times, NaN, negative rides | planted defect: guard returns safe on NaN | TO BUILD |
| SAFE-011/012/013 | No screen path skips the guard; every change re-checks | `tools/beta2/screen-gate.cjs`, `tools/beta2/flow-check.cjs` | FC-08 mutant | Tests ENFORCED; mutant TO BUILD |
| SAFE-014 / PLAN-016 | Phone in another time zone gives the same local plan | `tools/beta2/screen-gate.cjs` part B (Chicago, Tokyo, Athens) | TO BUILD: planted defect that uses the phone's zone (T1) | Test ENFORCED; mutant TO BUILD |
| SAFE-015 | Uncertain ride time shows "about" | rule `about` (S2) | TO BUILD (T1) | Test ENFORCED |
| PORT-001..015 | Ship days: arrival, all aboard, tender, overnight, after midnight, own boat picks | `tools/truth/oracle.cjs`, `tools/beta2/odd-trips.cjs`, `tools/beta2/odd-screen.cjs` | `back-after-all-aboard`, `ashore-before-docking` | ENFORCED |
| BACKWAIT | On a day with a time to be back, every ride after the last visit (to the bags, the cable car, the gate) on a line with no timetable allows the full gap between departures | rule `backwait` in `tools/truth/oracle.cjs` (saved trips, also with every ride answered as a no-timetable train) | `back-ride-half-gap` | ENFORCED (Nov 23) |
| NIGHT | Small-hours departure never read as the next night without asking | rule `night` | `train-as-tomorrow` | ENFORCED (blocks until the fix is merged) |

### 5.2 Rides and timetables (P1)

| ID | Requirement | Enforcing test | Proof it bites | Status |
|---|---|---|---|---|
| TRANS-001/002/006 | Every ride has a kind, a start, an end and a plausible time; no ride slower than walking | `tools/beta2/leaks.cjs`, `tools/beta2/odd-trips.cjs` (walk, zero), rule `physics`, `slowride` | TO BUILD: planted defect that doubles a metro time (T1) | ENFORCED |
| TRANS-003/004/005 | Bus, train and ferry times match the published timetable | `tools/ride-accuracy.mjs --legs` (every ride the test plans hold, airports, stations, piers first) against Transitous | caught the 68-min airport metro (real 39) when replayed | NIGHTLY. **v2:** a ride more than 25% or 15 min off the timetable becomes a ledger row the same day and holds the release (T2) |
| TRANS-007/008/010/011 | Missed, cancelled, last or no service: re-plan or say so | TO BUILD (T13): helper answers recorded with a cancelled sailing, a last train before the deadline, no service; plan must not use them | planted defect: ignore cancelled flag | TO BUILD |
| TRANS-012/013/014 | Helper timeout, 429, partial answer: no invented time | `tools/beta2/noai-trips.cjs`, `tools/beta2/water-wait-check.cjs` | FC-07 mutant | Tests ENFORCED; mutant TO BUILD |
| TRANS-015/016 | Seconds vs minutes, reversed coordinates | TO BUILD (T14): contract check on recorded helper answers (units, ranges, lat/lon order) | planted defect: seconds read as minutes | TO BUILD |

### 5.3 Planning (P1)

| ID | Requirement | Enforcing test | Proof it bites | Status |
|---|---|---|---|---|
| PLAN-001..003 | Normal days, empty days | `tools/beta2/engine-test.cjs`, `tools/beta2/flow-check.cjs` | old-code failures recorded in engine-test | ENFORCED |
| PLAN-004/007/019 | Too little time, conflicts: said, not hidden | `tools/beta2/odd-trips.cjs` | TO BUILD (T1) | ENFORCED |
| PLAN-005/006 | Invalid or missing durations | TO BUILD (T11) | planted defect | TO BUILD |
| PLAN-008/009 | Closed days and closing during a visit | `tools/beta2/hours-test.cjs`, rule `shut` | TO BUILD: planted defect that ignores holidays (T1) | ENFORCED |
| PLAN-010..013 | Picks, own order, removals, no duplicates | `tools/beta2/odd-trips.cjs` (pick, twice), `tools/beta2/flow-check.cjs` | TO BUILD (T1) | ENFORCED |
| PLAN-014 | Very many stops | `tools/beta2/stress.cjs`, odd-trips `slow` | n/a | ENFORCED |
| PLAN-015 | Same input, same plan | `tools/beta2/screen-gate.cjs` (offline and other zones give the same plan) | n/a | ENFORCED |
| PLAN-017/018 | Overnight and clock-change days | `tools/beta2/odd-trips.cjs` (after-midnight calls, clock-change dates) | TO BUILD (T1) | ENFORCED, partly |
| LUNCH | Every midday day has a real, open, nearby lunch | `tools/beta2/lunch-during-check.cjs`, rules `lunchshut`, `lunchlate` | `lunch-ignores-hours` | ENFORCED |
| SIGHTS | Only real, standing sights, at the right place, once | `tools/beta2/sight-rules-check.cjs`, `tools/truth/sight-mutants.cjs` | 11 planted sight defects | ENFORCED; weekly audit against Wikidata and OpenStreetMap |

### 5.4 Truth and AI (P1)

| ID | Requirement | Enforcing test | Proof it bites | Status |
|---|---|---|---|---|
| TRUE-01 | Every reason on screen traces to real data, else "not confirmed" | `tools/beta2/reason-numbers-check.cjs`, odd-trips `untrue` | TO BUILD (T1) | ENFORCED |
| TRUE-02 | No paid AI offered; AI off at runtime | `tools/ui/no-paid-ai-check.cjs`, `tools/worker-ai-gate.mjs` | the AI switch check fails with AI on | ENFORCED |
| TRUE-03 | The app claims nothing the AI can't do | `tools/ai-honesty-check.cjs` | wording probes | ENFORCED |
| SEC-003/004, AI-015 | Outside text is never run as code or obeyed | `tools/inject-check.cjs` | injected samples | ENFORCED |
| AI-001..020 | AI answers: false premises, disputes, legends, scripture, no invented hours or rides | TO BUILD (T15), **before AI is ever switched on**: a fixed question set with expected criteria, run with the helper's prompts; an AI never the only judge of safety answers | planted bad answers in the set | NOT TESTED (AI is off by Richard's rule) |
| FRESH | Every changing fact (hours, timetables) carries its source and date; past its window it says "check" | TO BUILD (T16) | planted defect: expired hours shown as current | TO BUILD |
| STORIES | Recorded stories match their sources | factcheck.json at build time | n/a | Build-time gate; TO BUILD: run it in the gate (T17) |

### 5.5 Screens, saving, resilience (P1 unless noted)

| ID | Requirement | Enforcing test | Status |
|---|---|---|---|
| UI-001..010, UI-013, UI-018 | Real screens at phone size, every control works, no page errors | `tools/beta2/flow-check.cjs`, `tools/ui/first-run-check.cjs`, `tools/ui/dayplan-check.cjs`, `tools/beta2/screen-gate.cjs` (5 sizes) | ENFORCED |
| UI-FEEL | Real touch at phone and tablet sizes: no tapped thing jumps from under the finger, no screen moving on its own, no layout shift over 0.10, first change within 500 ms and settled within 2.5 s, no dead taps, swipes reach the end, no stuck spinner, Back stays in the app | gate part 9 "feel" (back-check.cjs, client/feel.cjs) and a daily live run at 5:15 am, from "Use the live app like a real client" | TO BUILD (on claude/project-thread-pe7pi0, to merge). Severity: Back leaving the app, dead tap, stuck spinner, page error and NOT TESTED are P1 and always fail; jump, shift and slow are P2 and may be listed in docs/qa/warns.json with an owner and a date |
| UI-014..017 (P2) | Large text, keyboard, screen reader, contrast, touch size | TO BUILD (T18): axe-core in the screen gate (free), plus 200% text size | TO BUILD |
| UI-019, browsers | Safari and Firefox engines | TO BUILD (T19): Playwright WebKit and Firefox on the phone flow (free) | TO BUILD |
| DATA-001/004 | Saved trips survive the last two published versions | `tools/beta2/screen-gate.cjs` part D, `tools/ui/trip-copy-check.cjs` | ENFORCED |
| DATA-002, REL-002, REL-006 | Interrupted save and full or broken storage: no lost or half-saved trip, never "saved" when it wasn't | TO BUILD (T20): kill the page mid-save, corrupt stored JSON, fill storage | TO BUILD |
| REL-001/003 | Sources down or slow | `tools/ui/no-signal-check.cjs`, `tools/beta2/noai-trips.cjs` | ENFORCED |
| REL-004 | Stale offline copy says how old it is | TO BUILD (T16) | TO BUILD |
| PRINT | Print and share view shows the same leave-by and "not confirmed" words | TO BUILD (T21) | TO BUILD |

## 6. What is still to build, in order

Order follows Richard's rule: the things that protect travelers from the worst harm first. Each item ends when the test
runs in the gate (or nightly, where stated) and has been seen to fail on the bug it guards.

| # | Test to build | Feeds in | Must come out | Owner | Due |
|---|---|---|---|---|---|
| T1 | **Planted-defect coverage**: every S1 rule and every fail-closed rule (FC-01..10) has at least one planted defect; a check fails when a rule has none | the mutant lists and the rule lists | a table rule → defects; 0 rules without one | testing thread | **Done Nov 23** (`mutants.cjs`: all 7 safety rules fire, 11 of 11 defects caught) |
| T2 | **Nightly holds the release**: the report reads the latest nightly result; an S1 finding or a ride off its timetable (25% or 15 min) holds until fixed or proven false | latest nightly artifacts | DO NOT RELEASE with the finding named | testing thread | **Done Nov 23** (nightly workflow reaches main with the next PR) |
| T3 | **Nightly finds become permanent**: every failing nightly trip is saved to the test trips with its seed | nightly failures | new corpus files on a branch, retested by every gate | testing thread | Nov 25 |
| T4 | **Publish refuses** without a RELEASE OK report for the exact commit | commit sha, report artifact | publish stops with the reason | build thread with testing thread | **Built Nov 23** (Kairoute-Beta2 branch claude/project-thread-bw3ktc a9f9f99, pages.yml refuses without a passing gate run on the exact commit; live once merged to its main) |
| T5 | S2 warnings in one file with owner and expiry; expired fails | `docs/qa/warns.json` | FAIL after 7 days | testing thread | **Done Nov 23** (`docs/qa/warns.json`) |
| T6 | Gate health: part times and green rate over the last 10 runs, in every report | GitHub run history | a ledger row when a part is over 20 min or green rate under 50% | testing thread | **Done Nov 23** (release report "Gate health") |
| T7 | Independent review of safety changes, recorded in the report | diff of leave-by, back-by, deadline, ride-back, guard files since the live build | "reviewed by" line per safety commit; none = NOT TESTED | testing thread | **Done Nov 23** (`docs/qa/reviews.md`; unreviewed safety commits block) |
| T8 | Open S1/P1 ledger rows block unless a blocking test exists | `docs/qa/escapes.md` | DO NOT RELEASE naming the row | testing thread | **Done Nov 23** |
| T9 | **This spec is checked**: every ENFORCED row's tool is in the gate | this file, the gate workflow | FAIL naming the row | testing thread | **Done Nov 23** (`spec-check.cjs`) |
| T10 | Missing deadline asks (FC-06) | odd trips with times blanked | no sights planned, a question shown | leaving-days thread | Nov 26 |
| T11 | Malformed and contradictory form entries, malformed plans to the guard (FC-09, SAFE-010, PLAN-005/006) | fuzzed form values: empty, 25:99, negative, emoji, huge, ship leaving before arriving | a clear question; nothing planned on the clash; guard never "safe" | testing thread | Nov 27 |
| T12 | Delay re-plan (SAFE-008, PLAN-020) | odd trips, delays of 15/45/90 min at each stop | independent check clean on every re-plan | testing thread | Nov 28 |
| T13 | Cancelled, last and missing services | recorded helper answers | never planned on; said | rides thread | Nov 30 |
| T14 | Helper answer contract (units, ranges, coordinates) | recorded answers | schema and range check | rides thread | Nov 30 |
| T15 | AI question set (before AI is ever on) | fixed questions, expected criteria | scored report; safety answers judged by a fixed rule, not only by an AI | testing thread | before any AI switch-on |
| T16 | Freshness date on changing facts and on the offline copy | hours, timetables, saved copy | "checked on" date; "check" past its window | hours thread | Dec 4 |
| T17 | Story fact-check in the gate | factcheck.json | FAIL on an unsupported claim | stories thread | Nov 27 |
| T18 | Accessibility (axe-core, 200% text) | the built page | 0 serious findings on core screens | testing thread | Dec 2 |
| T19 | Safari and Firefox engines | phone flow | same results as Chrome | testing thread | Dec 2 |
| T20 | Interrupted save, broken storage | page killed mid-save, corrupted JSON, full storage | trip intact or clearly not saved | testing thread | Nov 29 |
| T21 | Print and share view | the shared page | same leave-by and "not confirmed" words as the app | testing thread | Dec 2 |

## 7. How Kairoute tries to break itself

| When | What attacks the app | What happens to a finding |
|---|---|---|
| Every change | 8 gate parts: saved trips, 300 unusual trips, the independent check, 20 planted defects, real screens at 5 sizes, no signal, other time zones, older saved trips | Blocks the release (no warnings for safety) |
| Every night, 1:30 am Central | 1,000 new unusual trips from a new seed, both checkers, planted defects on 300 trips, every planned ride against real timetables | **v2:** holds the release (T2) and becomes a saved trip (T3) |
| Every hour | A sample of ride times against timetables | A ride off its timetable gets a ledger row |
| Every week | The Fable outside test on the live site, harder each week; the sight audit against Wikidata and OpenStreetMap | Each new bug: ledger row, test, planted defect |
| Every escaped bug | The five questions: what happened, which rule failed, **why no test caught it**, was the data wrong, stale, missing, misread or badly shown, what test now stops it | Closed only when the test exists and fails on the old code |

## 8. Evidence kept for every run

Commit, part results, every log, the seed and the trips of every random run, the planted-defect table, the release
report with its 14 items and the release targets, the time zone (Central), and for live checks the version number seen
on the live site. Nothing personal, no keys.

## 9. Changing this spec

A rule here may be tightened by anyone. It may be loosened only by Richard, in writing, and the change is a ledger row
of its own. A test is never removed or weakened to get a pass; when a test is wrong, the fix shows the case it got wrong
and still fails on the bug it was written for.
