# Client feel test: 2026-11-25 18:55 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build f0820bca-1795624846)

Tested (real touch taps and swipes): Lenovo Idea Tab Plus 12.1" upright (800 x 1280). 58 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 2 problem(s): 2 SLOW; 2 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SHIFT (upright, choose-sights-day1-after): layout shift 0.55 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (upright, choose-sights-day5-after): layout shift 0.47 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SLOW (upright, home): tapped "Open the example trip": the screen kept changing for 2923 ms (limit 2500)
- SLOW (upright, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 3414 ms (limit 2500)

## Slowest taps

- upright guide-playing: "Start the tour" 392 ms
- upright day18-departure: "day 1" 240 ms
- upright after-close-fit-box-day1: "Back to my day plan" 216 ms
- upright tour-4: "Exit tour" 216 ms
- upright after-close-fit-box-day5: "Back to my day plan" 208 ms

## Not tested / notes

- upright: [choose-sights-day1] 24 sights listed, 5 ticked
- upright: [choose-sights-day1] not on screen to tap: tick src-q658339 (More nearby (4))
- upright: [choose-sights-day1] not on screen to tap: untick src-q658339
- upright: [choose-sights-day5] 9 sights listed, 7 ticked
- upright: [choose-sights-day5] not on screen to tap: tick wv~Q20127741 (More nearby (1))
- upright: [choose-sights-day5] not on screen to tap: untick wv~Q20127741
- upright: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
