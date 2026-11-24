# Client feel test: 2026-11-24 02:35 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build 01305861-1795461761)

Tested (real touch taps and swipes): Lenovo Idea Tab Plus 12.1" sideways (1280 x 800). 59 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 21 problem(s): 8 SHIFT, 10 SLOW, 1 DRIFT, 1 BACK, 1 LANDING; 4 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SHIFT (tablet, choose-sights-day1): layout shift 2.02 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (tablet, choose-sights-day1-after): layout shift 3.47 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (tablet, choose-sights-day5): layout shift 0.20 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (tablet, choose-sights-day5-after): layout shift 0.91 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SHIFT (tablet, open): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- SLOW (tablet, open): tapped "coach Next": 1128 ms before anything showed (limit 500)
- SHIFT (tablet, home): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- SLOW (tablet, home): tapped "Open the example trip": the screen kept changing for 3658 ms (limit 2500)
- SLOW (tablet, trip): tapped "day 0 (arrival Athens)": 504 ms before anything showed (limit 500)
- SLOW (tablet, trip): tapped "day 0 (arrival Athens)": the screen kept changing for 2875 ms (limit 2500)
- SLOW (tablet, day1-land): tapped "day 4 (embark Athens)": the screen kept changing for 3187 ms (limit 2500)
- SLOW (tablet, day1-before-choose): tapped "Choose sights": the screen kept changing for 6798 ms (limit 2500)
- SLOW (tablet, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": 1560 ms before anything showed (limit 500)
- SLOW (tablet, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 7960 ms (limit 2500)
- SHIFT (tablet, fit-box-day1): layout shift 0.26 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58]
- DRIFT (tablet, choose-sights-day5): the screen moved with no finger on it (shift 0.130, 0 scroll changes) [moved: div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58; div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58]
- SLOW (tablet, choose-sights-day5-after): tapped ""Needs ..." (ways to fit it in)": 576 ms before anything showed (limit 500)
- SLOW (tablet, choose-sights-day5-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 3428 ms (limit 2500)
- SHIFT (tablet, fit-box-day5): layout shift 0.20 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58; div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58; div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58]
- SHIFT (tablet, after-close-fit-box-day5): layout shift 0.13 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58; div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58]
- SHIFT (tablet, trip-again): layout shift 0.13 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "This is an example trip, to show how Kai" 0->16; div#view.wrap.panes "This is an example trip, to show how Kai" 0->16]
- BACK (tablet, phone back): the phone Back button (from a day plan, opened from the trip page) left the app instead of going back a screen
- SHIFT (tablet, reopened): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- SHIFT (tablet, offline-open): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- LANDING (tablet, offline-open): reopening the trip put the traveler back in the tour they had left with Exit tour

## Slowest taps

- tablet choose-sights-day1-after: ""Needs ..." (ways to fit it in)" 1560 ms
- tablet open: "coach Next" 1128 ms
- tablet choose-sights-day5-after: ""Needs ..." (ways to fit it in)" 576 ms
- tablet trip: "day 0 (arrival Athens)" 504 ms
- tablet after-close-fit-box-day1: "Back to my day plan" 472 ms

## Not tested / notes

- tablet: [choose-sights-day1] 27 sights listed, 5 ticked
- tablet: [choose-sights-day1] not on screen to tap: tick national-garden (More nearby (4))
- tablet: [choose-sights-day1] not on screen to tap: untick national-garden
- tablet: [choose-sights-day5] 7 sights listed, 7 ticked
- tablet: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- tablet: [offline-open] not on screen to tap: offline day 5
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
