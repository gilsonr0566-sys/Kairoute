# Client feel test: 2026-11-24 02:36 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build 01305861-1795461761)

Tested (real touch taps and swipes): Lenovo Idea Tab Plus 12.1" upright (800 x 1280). 59 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 17 problem(s): 6 SHIFT, 9 SLOW, 1 BACK, 1 LANDING; 3 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SHIFT (upright, choose-sights-day1): layout shift 1.16 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (upright, choose-sights-day1-after): layout shift 1.98 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (upright, choose-sights-day5-after): layout shift 0.76 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SHIFT (upright, open): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- SLOW (upright, open): tapped "coach Next": 808 ms before anything showed (limit 500)
- SHIFT (upright, home): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- SLOW (upright, home): tapped "Open the example trip": the screen kept changing for 3655 ms (limit 2500)
- SLOW (upright, trip): tapped "day 0 (arrival Athens)": 744 ms before anything showed (limit 500)
- SLOW (upright, day1-before-choose): tapped "Choose sights": the screen kept changing for 5646 ms (limit 2500)
- SLOW (upright, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": 744 ms before anything showed (limit 500)
- SLOW (upright, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 5627 ms (limit 2500)
- SHIFT (upright, fit-box-day1): layout shift 0.56 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58]
- SLOW (upright, choose-sights-day5-after): tapped ""Needs ..." (ways to fit it in)": 808 ms before anything showed (limit 500)
- SLOW (upright, choose-sights-day5-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 3173 ms (limit 2500)
- SHIFT (upright, fit-box-day5): layout shift 0.13 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58; div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58; div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58]
- SLOW (upright, tour-exit): tapped "Journal tab": the screen kept changing for 7376 ms (limit 2500)
- BACK (upright, phone back): the phone Back button (from a day plan, opened from the trip page) left the app instead of going back a screen
- SHIFT (upright, reopened): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- SHIFT (upright, offline-open): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- LANDING (upright, offline-open): reopening the trip put the traveler back in the tour they had left with Exit tour

## Slowest taps

- upright open: "coach Next" 808 ms
- upright choose-sights-day5-after: ""Needs ..." (ways to fit it in)" 808 ms
- upright trip: "day 0 (arrival Athens)" 744 ms
- upright choose-sights-day1-after: ""Needs ..." (ways to fit it in)" 744 ms
- upright guide-playing: "Start the tour" 376 ms

## Not tested / notes

- upright: [choose-sights-day1] 27 sights listed, 5 ticked
- upright: [choose-sights-day1] not on screen to tap: tick national-garden (More nearby (4))
- upright: [choose-sights-day1] not on screen to tap: untick national-garden
- upright: [choose-sights-day5] 7 sights listed, 7 ticked
- upright: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- upright: [offline-open] not on screen to tap: offline day 5
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
