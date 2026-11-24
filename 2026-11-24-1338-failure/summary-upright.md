# Client feel test: 2026-11-24 13:35 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build de7cba02-1795522279)

Tested (real touch taps and swipes): Lenovo Idea Tab Plus 12.1" upright (800 x 1280). 58 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 4 problem(s): 4 SLOW; 2 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SHIFT (upright, choose-sights-day1-after): layout shift 0.59 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (upright, choose-sights-day5-after): layout shift 0.49 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SLOW (upright, home): tapped "Open the example trip": the screen kept changing for 2959 ms (limit 2500)
- SLOW (upright, day1-land): tapped "day 4 (embark Athens)": 776 ms before anything showed (limit 500)
- SLOW (upright, day1-before-choose): tapped "Choose sights": the screen kept changing for 3165 ms (limit 2500)
- SLOW (upright, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 4525 ms (limit 2500)

## Slowest taps

- upright day1-land: "day 4 (embark Athens)" 776 ms
- upright trip: "day 0 (arrival Athens)" 432 ms
- upright guide-playing: "Start the tour" 336 ms
- upright home: "Open the example trip" 296 ms
- upright tour-4: "Exit tour" 288 ms

## Not tested / notes

- upright: [choose-sights-day1] 31 sights listed, 5 ticked
- upright: [choose-sights-day1] not on screen to tap: tick national-garden (More nearby (6))
- upright: [choose-sights-day1] not on screen to tap: untick national-garden
- upright: [choose-sights-day5] 7 sights listed, 7 ticked
- upright: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
