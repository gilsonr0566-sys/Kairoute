# Client feel test: 2026-11-26 18:45 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build 508a05ce-1795713386)

Tested (real touch taps and swipes): Galaxy S24 Ultra (412 x 915). 58 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 8 problem(s): 7 SLOW, 1 SHIFT; 2 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SHIFT (phone, choose-sights-day1-after): layout shift 1.47 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (phone, choose-sights-day5-after): layout shift 0.98 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SLOW (phone, home): tapped "Open the example trip": 2344 ms before anything showed (limit 500)
- SLOW (phone, home): tapped "Open the example trip": the screen kept changing for 7128 ms (limit 2500)
- SHIFT (phone, trip): layout shift 0.11 while this screen opened and was used (limit 0.1) [moved: main "THU JUL 15 · BARCELONA · ARRIVING Barcel" 0->100]
- SLOW (phone, trip): tapped "day 0 (arrival Athens)": 680 ms before anything showed (limit 500)
- SLOW (phone, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 6352 ms (limit 2500)
- SLOW (phone, choose-sights-day5-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 4226 ms (limit 2500)
- SLOW (phone, guide-playing): tapped "Start the tour": 1920 ms before anything showed (limit 500)
- SLOW (phone, guide-playing): tapped "Start the tour": the screen kept changing for 3495 ms (limit 2500)

## Slowest taps

- phone home: "Open the example trip" 2344 ms
- phone guide-playing: "Start the tour" 1920 ms
- phone trip: "day 0 (arrival Athens)" 680 ms
- phone stop-open-day1: "day 5" 464 ms
- phone after-close-fit-box-day5: "Back to my day plan" 272 ms

## Not tested / notes

- phone: [choose-sights-day1] 17 sights listed, 5 ticked
- phone: [choose-sights-day1] not on screen to tap: tick philopappos (More nearby (1))
- phone: [choose-sights-day1] not on screen to tap: untick philopappos
- phone: [choose-sights-day5] 7 sights listed, 7 ticked
- phone: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
