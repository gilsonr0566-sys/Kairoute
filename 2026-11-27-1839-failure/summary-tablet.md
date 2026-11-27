# Client feel test: 2026-11-27 18:29 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build 3358ede1-1795800704)

Tested (real touch taps and swipes): Lenovo Idea Tab Plus 12.1" sideways (1280 x 800). 58 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 12 problem(s): 12 SLOW; 2 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SHIFT (tablet, choose-sights-day1-after): layout shift 0.43 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (tablet, choose-sights-day5-after): layout shift 0.43 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SLOW (tablet, open): tapped "coach Next": 1000 ms before anything showed (limit 500)
- SLOW (tablet, home): tapped "Open the example trip": 568 ms before anything showed (limit 500)
- SLOW (tablet, home): tapped "Open the example trip": the screen kept changing for 3727 ms (limit 2500)
- SLOW (tablet, day0-arrival): tapped "day 1 (land Athens)": 656 ms before anything showed (limit 500)
- SLOW (tablet, day1-land): tapped "day 4 (embark Athens)": 1328 ms before anything showed (limit 500)
- SLOW (tablet, day1-land): tapped "day 4 (embark Athens)": the screen kept changing for 4410 ms (limit 2500)
- SLOW (tablet, day18-departure): tapped "day 1": 1240 ms before anything showed (limit 500)
- SLOW (tablet, day18-departure): tapped "day 1": the screen kept changing for 3433 ms (limit 2500)
- SLOW (tablet, day1-before-choose): tapped "Choose sights": the screen kept changing for 7046 ms (limit 2500)
- SLOW (tablet, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 4703 ms (limit 2500)
- SLOW (tablet, stop-open-day1): tapped "day 5": 1136 ms before anything showed (limit 500)
- SLOW (tablet, guide-playing): tapped "Start the tour": 1344 ms before anything showed (limit 500)

## Slowest taps

- tablet guide-playing: "Start the tour" 1344 ms
- tablet day1-land: "day 4 (embark Athens)" 1328 ms
- tablet day18-departure: "day 1" 1240 ms
- tablet stop-open-day1: "day 5" 1136 ms
- tablet open: "coach Next" 1000 ms

## Not tested / notes

- tablet: [choose-sights-day1] 19 sights listed, 5 ticked
- tablet: [choose-sights-day1] not on screen to tap: tick philopappos (More nearby (1))
- tablet: [choose-sights-day1] not on screen to tap: untick philopappos
- tablet: [choose-sights-day5] 7 sights listed, 7 ticked
- tablet: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
