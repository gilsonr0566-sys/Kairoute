# Client feel test: 2026-11-24 18:40 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build b587c097-1795542403)

Tested (real touch taps and swipes): Lenovo Idea Tab Plus 12.1" sideways (1280 x 800). 57 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 5 problem(s): 5 SLOW; 2 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SHIFT (tablet, choose-sights-day1-after): layout shift 0.44 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (tablet, choose-sights-day5-after): layout shift 0.45 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SLOW (tablet, home): tapped "Open the example trip": the screen kept changing for 4140 ms (limit 2500)
- SLOW (tablet, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 3872 ms (limit 2500)
- SLOW (tablet, stop-open-day1): tapped "day 5": 800 ms before anything showed (limit 500)
- SLOW (tablet, choose-sights-day5): tapped "filter All": 744 ms before anything showed (limit 500)
- SLOW (tablet, guide): tapped "play a story": 1680 ms before anything showed (limit 500)

## Slowest taps

- tablet guide: "play a story" 1680 ms
- tablet stop-open-day1: "day 5" 800 ms
- tablet choose-sights-day5: "filter All" 744 ms
- tablet trip: "day 0 (arrival Athens)" 464 ms
- tablet after-close-fit-box-day1: "Back to my day plan" 424 ms

## Not tested / notes

- tablet: [choose-sights-day1] 24 sights listed, 5 ticked
- tablet: [choose-sights-day1] not on screen to tap: tick src-q658339 (More nearby (4))
- tablet: [choose-sights-day1] not on screen to tap: untick src-q658339
- tablet: [choose-sights-day5] 7 sights listed, 7 ticked
- tablet: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
