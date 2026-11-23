# Escaped-bug ledger

Every bug found by someone other than the release gate goes here: an outside tester, Fable, Richard, a traveler, or a
nightly run. One row per bug. "Why missed" names the gap in the tests, not in the code. "Class added" is the test that
now catches the whole kind of bug, not just this case. A row is closed only when that test exists and fails on the old
code.

Process (QA package KAI-QA-004, post-incident questions): what happened; which rule or check failed; **why didn't a test
catch it**; was the data wrong, stale, missing, misread or badly shown; what test now prevents it coming back.

| # | Found | By | Bug (what the traveler saw) | Sev | Why the tests missed it | Class added | Status |
|---|---|---|---|---|---|---|---|
| E1 | Nov 22-23 | Outside test 6a (Lisbon), first-timer walk | A 5:45 am flight, and a 9:00 am train, read as the next day's. A full day of sights after the traveler had left | S1 | The day checks compared stops with the planner's own back-by time, which was wrong by a day. Plan and check agreed. | Independent check `gone`/`reach` from the typed time; planted defect `train-as-tomorrow` | Fixed 70f2cd3; test 405260f9 |
| E2 | Nov 23 | Leaving-days review | "Leave Casa Batlló by" 41 min too late: bags left at the start read as the bags collected | S1 | No check compared the two leave-by times on screen with the steps between them | Independent check `leaveby` (the steps between the two leave-by times); planted defect `bags-left-as-collected` | Fixed a96fb2c1; test 405260f9 |
| E3 | Nov 22 | Weekly ladder | "Off the ship 5:30 am" when the ship arrives at 7:00 am | S1 | The "start" check used the planner's own day start | Independent check `before` from the typed arrival; planted defect `off-before-arrival` | Fixed; test 405260f9 |
| E4 | Nov 18 | Richard (Pompeii, demo) | Leave-by banner 3:21 while a stop ran to 3:47 | S1 | Checks read planner numbers on one sample trip, never the screen | Screen rules on every day (Nov 22); planted defect `leaveby-late` | Fixed |
| E5 | Nov 22 | Outside test | The demolished Bastille offered as a must-see | P1 | Sight facts were checked against Wikidata only in one-off audits of 32 places, not as part of a release | Helper sends "gone" and kinds from Wikidata (a5bbb9e); sight audit. **Gap:** the audit doesn't run on a schedule yet | Fixed; class partly covered |
| E6 | Nov 22 | First-timer walk | A football stadium listed as a sight | P2 | Same as E5 | Same as E5 (70f2cd3, kinds from Wikidata) | Fixed; class partly covered |
| E7 | Nov 22-23 | Outside test | Airport metro planned at 68 min against a timetabled 39 | P1 | Ride times were compared with timetables for start-to-sight rides only (27 measured). Rides to and from airports, stations and piers never were | Nightly: every ride the plans hold against Transitous (`ride-accuracy.mjs --legs`, airport, station and pier rides first) | Speed fix ec0b538a; nightly class new |
| E8 | Nov 18-22 | Richard (Naples, Sorrento ferry) | Wrong boat and ferry timing | P1 | No timetable truth for ferries, and the sample trip only | Ferry timetable lookups; nightly ride check. **Gap:** many ferries publish no open timetable, so the app must say "not confirmed" | Partly |
| E9 | Nov 23 | **Independent check, before any traveler** | A departure typed in the small hours (00:20) on a departure day is read as the next night, and the day fills with sights. Never asked | S1 | Every earlier check read the planner's own reading of the time | Independent check `night` (now FAIL in the gate, no longer WARN); engine-test "small hours" checks; screen rule "small-hours departure asked"; planted defect `small-hours-guessed` | **Fixed** (leaving-days thread): a departure before 5:00 am is asked once ("early this morning, or late tonight?"), nothing planned until answered; kept on the day as `nightDep`; "this morning" plans only the way there, setting out the evening before |
| E10 | Nov 21-23 | Process | Fixes sat unpublished for a day: the release gate ran 50-70 min in one job, each push cancelled the last run, 1 green run in 18 | Process | The gate's own speed and health were never measured | Gate in 8 parallel parts (about 15 min) with a release report; NOT TESTED blocks | Fixed 405260f9 |
