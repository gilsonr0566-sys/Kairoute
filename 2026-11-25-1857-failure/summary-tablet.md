# Client feel test: 2026-11-25 18:53 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build f0820bca-1795624846)

Tested (real touch taps and swipes): Lenovo Idea Tab Plus 12.1" sideways (1280 x 800). 57 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 4 problem(s): 4 SLOW; 2 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SHIFT (tablet, choose-sights-day1-after): layout shift 0.43 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (tablet, choose-sights-day5-after): layout shift 0.43 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SLOW (tablet, home): tapped "Open the example trip": the screen kept changing for 2688 ms (limit 2500)
- SLOW (tablet, trip): tapped "day 0 (arrival Athens)": the screen kept changing for 4010 ms (limit 2500)
- SLOW (tablet, day1-before-choose): tapped "Choose sights": the screen kept changing for 3779 ms (limit 2500)
- SLOW (tablet, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 4276 ms (limit 2500)

## Slowest taps

- tablet guide-playing: "Start the tour" 352 ms
- tablet trip: "day 0 (arrival Athens)" 336 ms
- tablet tour-4: "Exit tour" 328 ms
- tablet after-close-fit-box-day1: "Back to my day plan" 304 ms
- tablet trip-again: "Day plan tab" 280 ms

## Not tested / notes

- tablet: [choose-sights-day1] 24 sights listed, 5 ticked
- tablet: [choose-sights-day1] not on screen to tap: tick src-q658339 (More nearby (4))
- tablet: [choose-sights-day1] not on screen to tap: untick src-q658339
- tablet: [choose-sights-day5] 7 sights listed, 7 ticked
- tablet: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
