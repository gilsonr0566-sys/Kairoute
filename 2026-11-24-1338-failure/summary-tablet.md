# Client feel test: 2026-11-24 13:34 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build de7cba02-1795522279)

Tested (real touch taps and swipes): Lenovo Idea Tab Plus 12.1" sideways (1280 x 800). 58 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 6 problem(s): 6 SLOW; 2 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SHIFT (tablet, choose-sights-day1-after): layout shift 0.42 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (tablet, choose-sights-day5-after): layout shift 0.45 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SLOW (tablet, open): tapped "coach Next": 864 ms before anything showed (limit 500)
- SLOW (tablet, home): tapped "Open the example trip": the screen kept changing for 2996 ms (limit 2500)
- SLOW (tablet, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 6228 ms (limit 2500)
- SLOW (tablet, choose-sights-day5-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 2908 ms (limit 2500)
- SLOW (tablet, stop-open-day5): tapped "Guide tab": 808 ms before anything showed (limit 500)
- SLOW (tablet, tour-1): tapped "tour step 1": 816 ms before anything showed (limit 500)

## Slowest taps

- tablet open: "coach Next" 864 ms
- tablet tour-1: "tour step 1" 816 ms
- tablet stop-open-day5: "Guide tab" 808 ms
- tablet trip: "day 0 (arrival Athens)" 496 ms
- tablet tour-4: "Exit tour" 440 ms

## Not tested / notes

- tablet: [choose-sights-day1] 31 sights listed, 5 ticked
- tablet: [choose-sights-day1] not on screen to tap: tick national-garden (More nearby (6))
- tablet: [choose-sights-day1] not on screen to tap: untick national-garden
- tablet: [choose-sights-day5] 7 sights listed, 7 ticked
- tablet: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
