# Client feel test: 2026-11-25 18:57 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build f0820bca-1795624846)

Tested (real touch taps and swipes): Galaxy S24 Ultra (412 x 915). 57 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 4 problem(s): 4 SLOW; 2 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SHIFT (phone, choose-sights-day1-after): layout shift 1.45 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (phone, choose-sights-day5-after): layout shift 1.00 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SLOW (phone, day1-before-choose): tapped "Choose sights": the screen kept changing for 4453 ms (limit 2500)
- SLOW (phone, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 5286 ms (limit 2500)
- SLOW (phone, choose-sights-day5-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 2558 ms (limit 2500)
- SLOW (phone, trip-again): tapped "day 5": 904 ms before anything showed (limit 500)

## Slowest taps

- phone trip-again: "day 5" 904 ms
- phone after-close-fit-box-day5: "Back to my day plan" 312 ms
- phone tour-4: "Exit tour" 232 ms
- phone home: "Open the example trip" 224 ms
- phone after-close-fit-box-day1: "Back to my day plan" 224 ms

## Not tested / notes

- phone: [choose-sights-day1] 24 sights listed, 5 ticked
- phone: [choose-sights-day1] not on screen to tap: tick src-q658339 (More nearby (4))
- phone: [choose-sights-day1] not on screen to tap: untick src-q658339
- phone: [choose-sights-day5] 7 sights listed, 7 ticked
- phone: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
