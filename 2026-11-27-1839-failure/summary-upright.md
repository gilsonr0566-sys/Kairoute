# Client feel test: 2026-11-27 18:29 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build 3358ede1-1795800704)

Tested (real touch taps and swipes): Lenovo Idea Tab Plus 12.1" upright (800 x 1280). 58 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 10 problem(s): 10 SLOW; 2 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SHIFT (upright, choose-sights-day1-after): layout shift 0.55 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (upright, choose-sights-day5-after): layout shift 0.48 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SLOW (upright, home): tapped "Open the example trip": 1768 ms before anything showed (limit 500)
- SLOW (upright, home): tapped "Open the example trip": the screen kept changing for 5024 ms (limit 2500)
- SLOW (upright, trip): tapped "day 0 (arrival Athens)": 920 ms before anything showed (limit 500)
- SLOW (upright, day0-arrival): tapped "day 1 (land Athens)": 1320 ms before anything showed (limit 500)
- SLOW (upright, day4-embark): tapped "day 5 (port Heraklion)": 1312 ms before anything showed (limit 500)
- SLOW (upright, day4-embark): tapped "day 5 (port Heraklion)": the screen kept changing for 3997 ms (limit 2500)
- SLOW (upright, day5-port): tapped "day 10 (sea At sea)": 1440 ms before anything showed (limit 500)
- SLOW (upright, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 5654 ms (limit 2500)
- SLOW (upright, stop-open-day1): tapped "day 5": 1464 ms before anything showed (limit 500)
- SLOW (upright, offline-open): tapped "Continue trip": the screen kept changing for 2615 ms (limit 2500)

## Slowest taps

- upright home: "Open the example trip" 1768 ms
- upright stop-open-day1: "day 5" 1464 ms
- upright day5-port: "day 10 (sea At sea)" 1440 ms
- upright day0-arrival: "day 1 (land Athens)" 1320 ms
- upright day4-embark: "day 5 (port Heraklion)" 1312 ms

## Not tested / notes

- upright: [choose-sights-day1] 17 sights listed, 5 ticked
- upright: [choose-sights-day1] not on screen to tap: tick philopappos (More nearby (1))
- upright: [choose-sights-day1] not on screen to tap: untick philopappos
- upright: [choose-sights-day5] 7 sights listed, 7 ticked
- upright: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
