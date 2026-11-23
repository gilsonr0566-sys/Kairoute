# Client feel test: 2026-11-23 20:05 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build 01305861-1795461761)

Tested (real touch taps and swipes): Galaxy S24 Ultra (412 x 915). 51 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 10 problem(s): 1 SLOW, 8 STUCK, 1 BACK; 7 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN JUMP (phone, choose-sights-day1): tapped "untick roman-agora" and it moved up 341px from under the finger (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (phone, choose-sights-day1-after): layout shift 1.62 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SLOW (phone, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": 720 ms before anything showed (limit 500) (Use the live app like a real client until 2026-11-30)
- WARN SLOW (phone, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 4929 ms (limit 2500) (Use the live app like a real client until 2026-11-30)
- WARN SHIFT (phone, choose-sights-day5-after): layout shift 1.31 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SLOW (phone, choose-sights-day5-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 2871 ms (limit 2500) (Use the live app like a real client until 2026-11-30)
- WARN SHIFT (phone, guide-playing): layout shift 0.24 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SLOW (phone, open): tapped "coach Next": 904 ms before anything showed (limit 500)
- STUCK (phone, trip): 1 spinner(s) still showing after the screen settled: span.spinner ""
- STUCK (phone, day0-arrival): 1 spinner(s) still showing after the screen settled: span.spinner ""
- STUCK (phone, day1-land): 1 spinner(s) still showing after the screen settled: span.spinner ""
- STUCK (phone, day4-embark): 1 spinner(s) still showing after the screen settled: span.spinner ""
- STUCK (phone, day5-port): 1 spinner(s) still showing after the screen settled: span.spinner ""
- STUCK (phone, day18-departure): 1 spinner(s) still showing after the screen settled: span.spinner ""
- STUCK (phone, day1-before-choose): 1 spinner(s) still showing after the screen settled: span.spinner ""
- STUCK (phone, tour-exit): 1 spinner(s) still showing after the screen settled: span.spinner ""
- BACK (phone, phone back): the phone Back button (from a day plan, opened from the trip page) left the app instead of going back a screen

## Slowest taps

- phone open: "coach Next" 904 ms
- phone choose-sights-day1-after: ""Needs ..." (ways to fit it in)" 720 ms
- phone choose-sights-day5-after: ""Needs ..." (ways to fit it in)" 360 ms
- phone trip: "day 0 (arrival Athens)" 328 ms
- phone tour-4: "Exit tour" 264 ms

## Not tested / notes

- phone: [choose-sights-day1] 27 sights listed, 5 ticked
- phone: [choose-sights-day1] not on screen to tap: tick national-garden (More nearby (4))
- phone: [choose-sights-day1] not on screen to tap: untick national-garden
- phone: [day5-before-choose] not on screen to tap: Choose sights
- phone: [choose-sights-day5] 7 sights listed, 7 ticked
- phone: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- phone: [offline-open] not on screen to tap: offline day 5
- phone: [offline-day] not on screen to tap: offline Choose sights
- phone: [offline-choose] not on screen to tap: offline Guide
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
