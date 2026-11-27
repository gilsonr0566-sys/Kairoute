# How Kairoute tests itself (Beta 2)

Set up Nov 23, 2026, in the thread "Rebuild the testing and review process". It follows Richard's QA package (KAI-QA-001
to 006, copy in the project files under `qa/`), fitted to how Beta 2 is really built. Beta 2 is one built page
(`build-beta2.sh` writes `beta2-site/index.html`), the planner is `src/engine/`, the checks are plain Node scripts in
`tools/`, and they run on GitHub. There is no npm project, so the package's npm, TypeScript and @playwright/test
templates are not used. Its rules are.

## The four rules this process keeps

1. **An independent oracle, not self-agreement.** A check that reads the planner's own numbers passes whenever the
   planner is wrong in a consistent way. The safety check (`tools/truth/oracle.cjs`) works only from what the traveler
   typed (dates, times, the gate's place) and what the screen shows. It uses its own small model of the world, with
   limits set in the planner's favour, so a failure is always a real failure.
2. **Prove the checks can fail.** `tools/truth/mutants.cjs` puts real past bugs back into a copy of the planner (a train
   read as tomorrow's, bags left read as bags collected, a leave-by 41 min late, the airport time lost, back after all
   aboard, ashore before docking, off the ship before it arrives). The gate fails unless every one is caught. If the
   planner's code moves and a planted bug can't be placed, that bug shows NOT TESTED, never "caught".
3. **NOT TESTED is never PASS.** The release report lists every part of the gate as PASS, FAIL or NOT TESTED. A
   cancelled, skipped or timed-out part blocks the release the same way a failure does.
4. **Every escaped bug teaches the tests.** Some bugs are found by an outside tester, Fable, Richard or a traveler instead
   of the gate. Each one goes in `docs/qa/escapes.md` with the answer to "why didn't a test catch it?" and the class of
   test added. The fix is not done until that test exists and fails on the old code. Where possible it becomes a
   planted defect.
5. **One rule for each class of bug, and every fix names it.** `docs/qa/RULES.md` is the one list of app-wide rules,
   each written for a whole class ("everything on screen is in the traveler's language"), with the gate check that
   enforces it and a planted bug that proves the check fires. `tools/truth/rules-check.cjs` fails the release when a
   logged bug is under no rule, a rule has no check or proof (or its owner's date has passed), or a commit that changes
   `src/` or `worker/` has no `Rule: R-xx` line. `tools/truth/screen-rule-proof.cjs` plants a bug for every screen rule.

## When things run

| When | What | Blocks a release? |
|---|---|---|
| Every push to the Beta 2 branch | **Release gate** (`.github/workflows/beta2-gate.yml`): 8 parts side by side, about 15 min: code; safety (independent check on saved and 300 odd trips, planted defects); engine rules, hours, reasons, lunch; leaks and stress; phone flow; what the traveler sees (screen rules, time zones, no signal, older saved trips, sizes, voices); odd days on screen and group trips; the app says only what is true. A last job writes the release report. | Yes: publish only from a report that says RELEASE OK |
| Every night, 1:30 am Central | **Truth check** (`.github/workflows/truth-nightly.yml`): 1,000 new unusual trips from a new seed (inputs kept to replay), both checks, planted defects on more trips; every ride the test plans hold (airport, station and pier rides first) against the published timetables | No. Each finding goes to the ledger and becomes a gate check |
| Every hour | Ride times against timetables, a sample (`ride-accuracy.yml`) | No |
| Each week (Sunday evening) | Fable outside test with harder demands (`beta2-outside-test/`), live site, screen rules on every step | No. Findings go to the ledger |
| On demand | Sight audit against Wikidata and OpenStreetMap (`sight-audit.yml`), live dry runs on new places (`beta2-live.yml`), first-time traveler walk (`first-timer.yml`) | No |
| After every publish | The live site's version stamp is checked, then the changed behavior is re-checked there (`docs/beta-2/release.md` step 5) | A fix isn't reported live until this is done |

## Severity (the package's P0 to P3, in this project's words)

- **P0 / S1:** could make a traveler miss a flight, train or ship, or plans something impossible as safe. Blocks the release.
- **P1:** wrong timing, a wrong ride, or an invented fact on screen. Blocks the release.
- **P2 / S2:** wrong or misleading on screen, with a workaround. Released only with an owner, written in the ledger.
- **P3 / S3:** untidy. Goes in the backlog.

**A safety finding is never a warning.** An S1 or P1 finding blocks the release, even when the same problem is already on
the live build, and even when a new check finds it for the first time. The app refuses to publish what it cannot show is
safe. (Until Nov 23 a new S1 finding could be listed as WARN while its fix was written. Richard called that a serious
design flaw, and it is gone: escapes.md E16.)

Enforced, not promised: the independent check and the odd-trip checks refuse `--warn` for any safety rule and fail the
run when asked; `tools/truth/no-warn-check.cjs` runs in the gate's code part and fails if any workflow warns a safety
rule or either tool stops refusing; the release report counts every safety finding, printed FAIL or WARN, as a fourth
release target that must be 0. Only an S2 finding may be listed as WARN, and only with an owner in `escapes.md`.

The rules themselves, each with its test and status: `SPEC-v2.md` (QA specification v2, Nov 23).

## Files

- `tools/truth/oracle.cjs`: the independent safety check. Run it with `node tools/truth/oracle.cjs --corpus`, or
  `--trips file` (the output of `odd-trips.cjs --out`).
- `tools/truth/mutants.cjs`: the planted defects. Add one for every escaped bug whose cause can be put back in a line.
- `tools/ride-accuracy.mjs --legs`: every planned ride against timetables (network: GitHub only).
- `docs/qa/escapes.md`: the escaped-bug ledger.
- `docs/qa/test-map.md`: the risk register and the package's test catalog mapped to the real checks, including what is
  NOT TESTED yet.
