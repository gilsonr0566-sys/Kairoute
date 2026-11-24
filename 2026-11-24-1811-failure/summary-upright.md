# Client feel test: 2026-11-24 18:08 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build b587c097-1795542403)

Tested (real touch taps and swipes): Lenovo Idea Tab Plus 12.1" upright (800 x 1280). 57 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 6 problem(s): 5 SLOW, 1 SCROLL; 3 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SELF-SCROLL (upright, choose-sights-day1): tapped "filter Must-sees" and the page scrolled itself up 2234px (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (upright, choose-sights-day1-after): layout shift 0.58 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (upright, choose-sights-day5-after): layout shift 0.44 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SLOW (upright, open): tapped "coach Next": 944 ms before anything showed (limit 500)
- SLOW (upright, home): tapped "Open the example trip": the screen kept changing for 3415 ms (limit 2500)
- SCROLL (upright, choose-sights-day1): could not get back to the top (stuck at 2498px)
- SLOW (upright, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 3631 ms (limit 2500)
- SLOW (upright, stop-open-day1): tapped "day 5": 680 ms before anything showed (limit 500)
- SLOW (upright, journal): tapped "Settings tab": 1392 ms before anything showed (limit 500)

## Slowest taps

- upright journal: "Settings tab" 1392 ms
- upright open: "coach Next" 944 ms
- upright stop-open-day1: "day 5" 680 ms
- upright trip: "day 0 (arrival Athens)" 352 ms
- upright guide-playing: "Start the tour" 312 ms

## Not tested / notes

- upright: [choose-sights-day1] 24 sights listed, 5 ticked
- upright: [choose-sights-day1] not on screen to tap: tick src-q658339 (More nearby (4))
- upright: [choose-sights-day1] not on screen to tap: untick src-q658339
- upright: [choose-sights-day5] 7 sights listed, 7 ticked
- upright: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
