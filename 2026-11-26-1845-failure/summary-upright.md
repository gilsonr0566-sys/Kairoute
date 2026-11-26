# Client feel test: 2026-11-26 18:42 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build 508a05ce-1795713386)

Tested (real touch taps and swipes): Lenovo Idea Tab Plus 12.1" upright (800 x 1280). 60 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 6 problem(s): 6 SLOW; 2 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SHIFT (upright, choose-sights-day1-after): layout shift 0.55 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (upright, choose-sights-day5-after): layout shift 0.50 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SLOW (upright, home): tapped "Open the example trip": 1416 ms before anything showed (limit 500)
- SLOW (upright, home): tapped "Open the example trip": the screen kept changing for 5119 ms (limit 2500)
- SLOW (upright, day1-before-choose): tapped "Choose sights": the screen kept changing for 5417 ms (limit 2500)
- SLOW (upright, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 5502 ms (limit 2500)
- SLOW (upright, stop-open-day1): tapped "day 5": the screen kept changing for 2725 ms (limit 2500)
- SLOW (upright, guide-playing): tapped "Start the tour": 1752 ms before anything showed (limit 500)

## Slowest taps

- upright guide-playing: "Start the tour" 1752 ms
- upright home: "Open the example trip" 1416 ms
- upright after-close-fit-box-day5: "Back to my day plan" 240 ms
- upright trip: "day 0 (arrival Athens)" 224 ms
- upright tour-4: "Exit tour" 216 ms

## Not tested / notes

- upright: [choose-sights-day1] 18 sights listed, 5 ticked
- upright: [choose-sights-day1] not on screen to tap: tick philopappos (More nearby (1))
- upright: [choose-sights-day1] not on screen to tap: untick philopappos
- upright: [choose-sights-day5] 8 sights listed, 7 ticked
- upright: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
