# Client feel test: 2026-11-24 02:00 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build 01305861-1795461761)

Tested (real touch taps and swipes): Galaxy S24 Ultra (412 x 915). 59 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 9 problem(s): 6 SLOW, 1 DRIFT, 1 BACK, 1 LANDING; 4 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN JUMP (phone, choose-sights-day1): tapped "untick roman-agora" and it moved up 341px from under the finger (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (phone, choose-sights-day1-after): layout shift 1.65 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (phone, choose-sights-day5-after): layout shift 1.32 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (phone, guide-playing): layout shift 0.24 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SLOW (phone, open): tapped "coach Next": 880 ms before anything showed (limit 500)
- SLOW (phone, day1-before-choose): tapped "Choose sights": the screen kept changing for 3143 ms (limit 2500)
- SLOW (phone, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": 648 ms before anything showed (limit 500)
- SLOW (phone, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 4742 ms (limit 2500)
- SLOW (phone, choose-sights-day5-after): tapped ""Needs ..." (ways to fit it in)": 744 ms before anything showed (limit 500)
- SLOW (phone, choose-sights-day5-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 2689 ms (limit 2500)
- DRIFT (phone, after-close-fit-box-day5): the screen moved with no finger on it (shift 0.000, 1 scroll changes e.g. 1576->1781)
- BACK (phone, phone back): the phone Back button (from a day plan, opened from the trip page) left the app instead of going back a screen
- LANDING (phone, offline-open): reopening the trip put the traveler back in the tour they had left with Exit tour

## Slowest taps

- phone open: "coach Next" 880 ms
- phone choose-sights-day5-after: ""Needs ..." (ways to fit it in)" 744 ms
- phone choose-sights-day1-after: ""Needs ..." (ways to fit it in)" 648 ms
- phone trip: "day 0 (arrival Athens)" 304 ms
- phone day5-port: "day 10 (sea At sea)" 256 ms

## Not tested / notes

- phone: [choose-sights-day1] 27 sights listed, 5 ticked
- phone: [choose-sights-day1] not on screen to tap: tick national-garden (More nearby (4))
- phone: [choose-sights-day1] not on screen to tap: untick national-garden
- phone: [choose-sights-day5] 7 sights listed, 7 ticked
- phone: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- phone: [offline-open] not on screen to tap: offline day 5
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
