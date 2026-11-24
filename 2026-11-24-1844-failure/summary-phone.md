# Client feel test: 2026-11-24 18:43 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build b587c097-1795542403)

Tested (real touch taps and swipes): Galaxy S24 Ultra (412 x 915). 56 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 4 problem(s): 4 SLOW; 2 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SHIFT (phone, choose-sights-day1-after): layout shift 1.45 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (phone, choose-sights-day5-after): layout shift 0.93 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SLOW (phone, open): tapped "coach Next": 768 ms before anything showed (limit 500)
- SLOW (phone, home): tapped "Open the example trip": the screen kept changing for 3224 ms (limit 2500)
- SLOW (phone, day1-before-choose): tapped "Choose sights": the screen kept changing for 4143 ms (limit 2500)
- SLOW (phone, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 6151 ms (limit 2500)

## Slowest taps

- phone open: "coach Next" 768 ms
- phone after-close-fit-box-day5: "Back to my day plan" 224 ms
- phone tour-4: "Exit tour" 192 ms
- phone trip-again: "Day plan tab" 168 ms
- phone open: "coach Next" 160 ms

## Not tested / notes

- phone: [choose-sights-day1] 24 sights listed, 5 ticked
- phone: [choose-sights-day1] not on screen to tap: tick src-q658339 (More nearby (4))
- phone: [choose-sights-day1] not on screen to tap: untick src-q658339
- phone: [choose-sights-day5] 7 sights listed, 7 ticked
- phone: [choose-sights-day5] could not reach: tick back koules
- phone: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
