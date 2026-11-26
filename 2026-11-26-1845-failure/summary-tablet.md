# Client feel test: 2026-11-26 18:40 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build 508a05ce-1795713386)

Tested (real touch taps and swipes): Lenovo Idea Tab Plus 12.1" sideways (1280 x 800). 58 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 3 problem(s): 3 SLOW; 2 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SHIFT (tablet, choose-sights-day1-after): layout shift 0.43 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (tablet, choose-sights-day5-after): layout shift 0.43 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SLOW (tablet, home): tapped "Open the example trip": 592 ms before anything showed (limit 500)
- SLOW (tablet, day1-before-choose): tapped "Choose sights": the screen kept changing for 3375 ms (limit 2500)
- SLOW (tablet, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 4539 ms (limit 2500)

## Slowest taps

- tablet home: "Open the example trip" 592 ms
- tablet choose-sights-day5: "filter Must-sees" 368 ms
- tablet open: "coach Next" 272 ms
- tablet day5-port: "day 10 (sea At sea)" 272 ms
- tablet guide-playing: "Start the tour" 264 ms

## Not tested / notes

- tablet: [choose-sights-day1] 19 sights listed, 5 ticked
- tablet: [choose-sights-day1] not on screen to tap: tick philopappos (More nearby (1))
- tablet: [choose-sights-day1] not on screen to tap: untick philopappos
- tablet: [choose-sights-day5] 7 sights listed, 7 ticked
- tablet: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
