# Client feel test: 2026-11-23 19:50 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build 01305861-1795461761)

Tested (real touch taps and swipes): Galaxy S24 Ultra (412 x 915). 51 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 11 problem(s): 2 SLOW, 8 STUCK, 1 BACK; 8 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN JUMP (phone, choose-sights-day1): tapped "untick roman-agora" and it moved up 341px from under the finger (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (phone, choose-sights-day1-after): layout shift 1.64 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SLOW (phone, choose-sights-day1-after): tapped "open a sight": 952 ms before anything showed (limit 500) (Use the live app like a real client until 2026-11-30)
- WARN SLOW (phone, choose-sights-day1-after): tapped "open a sight": the screen kept changing for 5944 ms (limit 2500) (Use the live app like a real client until 2026-11-30)
- WARN SHIFT (phone, choose-sights-day5-after): layout shift 1.33 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SLOW (phone, choose-sights-day5-after): tapped "open a sight": 544 ms before anything showed (limit 500) (Use the live app like a real client until 2026-11-30)
- WARN SLOW (phone, choose-sights-day5-after): tapped "open a sight": the screen kept changing for 2931 ms (limit 2500) (Use the live app like a real client until 2026-11-30)
- WARN SHIFT (phone, guide-playing): layout shift 0.24 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SLOW (phone, open): tapped "coach Next": 1120 ms before anything showed (limit 500)
- STUCK (phone, trip): 1 spinner(s) still showing after the screen settled
- STUCK (phone, day0-arrival): 1 spinner(s) still showing after the screen settled
- STUCK (phone, day1-land): 1 spinner(s) still showing after the screen settled
- STUCK (phone, day4-embark): 1 spinner(s) still showing after the screen settled
- STUCK (phone, day5-port): 1 spinner(s) still showing after the screen settled
- STUCK (phone, day18-departure): 1 spinner(s) still showing after the screen settled
- STUCK (phone, day1-before-choose): 1 spinner(s) still showing after the screen settled
- SLOW (phone, day1-before-choose): tapped "Choose sights": the screen kept changing for 6996 ms (limit 2500)
- STUCK (phone, tour-exit): 1 spinner(s) still showing after the screen settled
- BACK (phone, phone back): the phone Back button (from a day plan, opened from the trip page) left the app instead of going back a screen

## Slowest taps

- phone open: "coach Next" 1120 ms
- phone choose-sights-day1-after: "open a sight" 952 ms
- phone choose-sights-day5-after: "open a sight" 544 ms
- phone tour-4: "Exit tour" 280 ms
- phone trip-again: "Day plan tab" 240 ms

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
