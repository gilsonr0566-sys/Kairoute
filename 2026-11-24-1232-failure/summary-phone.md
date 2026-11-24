# Client feel test: 2026-11-24 12:31 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build de7cba02-1795522279)

Tested (real touch taps and swipes): Galaxy S24 Ultra (412 x 915). 57 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 5 problem(s): 5 SLOW; 4 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SELF-SCROLL (phone, choose-sights-day1): tapped "untick roman-agora" and the page scrolled itself up 332px (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (phone, choose-sights-day1-after): layout shift 1.57 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (phone, choose-sights-day5-after): layout shift 1.12 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (phone, guide-playing): layout shift 0.20 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SLOW (phone, home): tapped "Open the example trip": 560 ms before anything showed (limit 500)
- SLOW (phone, home): tapped "Open the example trip": the screen kept changing for 3046 ms (limit 2500)
- SLOW (phone, day1-before-choose): tapped "Choose sights": the screen kept changing for 6025 ms (limit 2500)
- SLOW (phone, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 5096 ms (limit 2500)
- SLOW (phone, stop-open-day1): tapped "day 5": 648 ms before anything showed (limit 500)

## Slowest taps

- phone stop-open-day1: "day 5" 648 ms
- phone home: "Open the example trip" 560 ms
- phone day1-land: "day 4 (embark Athens)" 488 ms
- phone open: "coach Next" 392 ms
- phone after-close-fit-box-day5: "Back to my day plan" 320 ms

## Not tested / notes

- phone: [choose-sights-day1] 31 sights listed, 5 ticked
- phone: [choose-sights-day1] not on screen to tap: tick national-garden (More nearby (6))
- phone: [choose-sights-day1] not on screen to tap: untick national-garden
- phone: [choose-sights-day5] 7 sights listed, 7 ticked
- phone: [choose-sights-day5] could not reach: tick back koules
- phone: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
