# Client feel test: 2026-11-27 18:32 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build 3358ede1-1795800704)

Tested (real touch taps and swipes): Galaxy S24 Ultra (412 x 915). 58 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 12 problem(s): 10 SLOW, 1 SHIFT, 1 DRIFT; 3 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SHIFT (phone, choose-sights-day1-after): layout shift 1.46 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SELF-SCROLL (phone, choose-sights-day5): tapped "untick koules (Your sights (7))" and the page scrolled itself up 50px (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (phone, choose-sights-day5-after): layout shift 0.97 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SLOW (phone, open): tapped "coach Next": 1192 ms before anything showed (limit 500)
- SLOW (phone, home): tapped "Open the example trip": 2320 ms before anything showed (limit 500)
- SLOW (phone, home): tapped "Open the example trip": the screen kept changing for 7799 ms (limit 2500)
- SHIFT (phone, trip): layout shift 0.11 while this screen opened and was used (limit 0.1) [moved: main "THU JUL 15 · BARCELONA · ARRIVING Barcel" 0->100]
- SLOW (phone, trip): tapped "day 0 (arrival Athens)": 664 ms before anything showed (limit 500)
- SLOW (phone, day1-land): tapped "day 4 (embark Athens)": 1128 ms before anything showed (limit 500)
- SLOW (phone, day4-embark): tapped "day 5 (port Heraklion)": 1760 ms before anything showed (limit 500)
- SLOW (phone, day4-embark): tapped "day 5 (port Heraklion)": the screen kept changing for 2862 ms (limit 2500)
- SLOW (phone, day1-before-choose): tapped "Choose sights": the screen kept changing for 6966 ms (limit 2500)
- DRIFT (phone, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen was still changing 8 s later
- SLOW (phone, stop-open-day1): tapped "day 5": 1752 ms before anything showed (limit 500)
- SLOW (phone, choose-sights-day5-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 3113 ms (limit 2500)

## Slowest taps

- phone home: "Open the example trip" 2320 ms
- phone day4-embark: "day 5 (port Heraklion)" 1760 ms
- phone stop-open-day1: "day 5" 1752 ms
- phone open: "coach Next" 1192 ms
- phone day1-land: "day 4 (embark Athens)" 1128 ms

## Not tested / notes

- phone: [choose-sights-day1] 19 sights listed, 5 ticked
- phone: [choose-sights-day1] not on screen to tap: tick philopappos (More nearby (1))
- phone: [choose-sights-day1] not on screen to tap: untick philopappos
- phone: [choose-sights-day5] 7 sights listed, 7 ticked
- phone: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
