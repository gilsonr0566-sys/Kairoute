# Client feel test: 2026-11-23 20:36 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build 01305861-1795461761)

Tested (real touch taps and swipes): Lenovo Idea Tab Plus 12.1" upright (800 x 1280). 51 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 20 problem(s): 8 SHIFT, 4 SLOW, 7 STUCK, 1 BACK; 3 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SHIFT (upright, choose-sights-day1): layout shift 0.17 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (upright, choose-sights-day1-after): layout shift 1.00 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (upright, choose-sights-day5-after): layout shift 0.71 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SHIFT (upright, open): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- SLOW (upright, open): tapped "coach Next": 672 ms before anything showed (limit 500)
- SHIFT (upright, home): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- STUCK (upright, trip): 1 spinner(s) still showing after the screen settled: span.spinner "More about today" at 1387px in view
- SLOW (upright, trip): tapped "day 0 (arrival Athens)": 720 ms before anything showed (limit 500)
- STUCK (upright, day0-arrival): 1 spinner(s) still showing after the screen settled: span.spinner "More about today" at 1076px in view
- STUCK (upright, day1-land): 1 spinner(s) still showing after the screen settled: span.spinner "More about today" at 1076px in view
- STUCK (upright, day4-embark): 1 spinner(s) still showing after the screen settled: span.spinner "More about today" at 1369px in view
- STUCK (upright, day5-port): 1 spinner(s) still showing after the screen settled: span.spinner "More about today" at 1369px in view
- STUCK (upright, day18-departure): 1 spinner(s) still showing after the screen settled: span.spinner "More about today" at 1570px in view
- SLOW (upright, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": 640 ms before anything showed (limit 500)
- SLOW (upright, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 5036 ms (limit 2500)
- SHIFT (upright, fit-box-day1): layout shift 0.43 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58]
- SHIFT (upright, after-close-fit-box-day1): layout shift 0.43 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58]
- SHIFT (upright, fit-box-day5): layout shift 0.13 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58; div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58; div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58]
- SHIFT (upright, after-close-fit-box-day5): layout shift 0.13 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58; div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58; div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58]
- STUCK (upright, tour-exit): 1 spinner(s) still showing after the screen settled: span.spinner "More about today" at 1369px in view
- BACK (upright, phone back): the phone Back button (from a day plan, opened from the trip page) left the app instead of going back a screen
- SHIFT (upright, reopened): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- SHIFT (upright, offline-open): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]

## Slowest taps

- upright trip: "day 0 (arrival Athens)" 720 ms
- upright open: "coach Next" 672 ms
- upright choose-sights-day1-after: ""Needs ..." (ways to fit it in)" 640 ms
- upright home: "Open the example trip" 424 ms
- upright choose-sights-day5-after: ""Needs ..." (ways to fit it in)" 312 ms

## Not tested / notes

- upright: [choose-sights-day1] 27 sights listed, 5 ticked
- upright: [choose-sights-day1] not on screen to tap: tick national-garden (More nearby (4))
- upright: [choose-sights-day1] not on screen to tap: untick national-garden
- upright: [day5-before-choose] not on screen to tap: Choose sights
- upright: [choose-sights-day5] 7 sights listed, 7 ticked
- upright: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- upright: [offline-open] not on screen to tap: offline day 5
- upright: [offline-day] not on screen to tap: offline Choose sights
- upright: [offline-choose] not on screen to tap: offline Guide
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
