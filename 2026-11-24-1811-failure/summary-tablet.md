# Client feel test: 2026-11-24 18:07 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build b587c097-1795542403)

Tested (real touch taps and swipes): Lenovo Idea Tab Plus 12.1" sideways (1280 x 800). 57 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 5 problem(s): 4 SLOW, 1 DRIFT; 2 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SHIFT (tablet, choose-sights-day1-after): layout shift 0.45 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (tablet, choose-sights-day5-after): layout shift 0.45 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SLOW (tablet, open): tapped "coach Next": 1304 ms before anything showed (limit 500)
- SLOW (tablet, home): tapped "Open the example trip": the screen kept changing for 3713 ms (limit 2500)
- SLOW (tablet, day1-before-choose): tapped "Choose sights": the screen kept changing for 6572 ms (limit 2500)
- DRIFT (tablet, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen was still changing 8 s later
- SLOW (tablet, choose-sights-day5-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 3017 ms (limit 2500)

## Slowest taps

- tablet open: "coach Next" 1304 ms
- tablet tour-4: "Exit tour" 448 ms
- tablet trip-again: "Day plan tab" 424 ms
- tablet after-close-fit-box-day5: "Back to my day plan" 400 ms
- tablet after-close-fit-box-day1: "Back to my day plan" 352 ms

## Not tested / notes

- tablet: [choose-sights-day1] 24 sights listed, 5 ticked
- tablet: [choose-sights-day1] not on screen to tap: tick src-q658339 (More nearby (4))
- tablet: [choose-sights-day1] not on screen to tap: untick src-q658339
- tablet: [choose-sights-day5] 7 sights listed, 7 ticked
- tablet: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
