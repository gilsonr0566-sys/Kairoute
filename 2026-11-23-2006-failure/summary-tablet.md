# Client feel test: 2026-11-23 20:00 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build 01305861-1795461761)

Tested (real touch taps and swipes): Lenovo Idea Tab Plus 12.1" sideways (1280 x 800). 51 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 17 problem(s): 6 SHIFT, 2 SLOW, 8 STUCK, 1 BACK; 4 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SHIFT (tablet, choose-sights-day1-after): layout shift 0.90 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SLOW (tablet, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": 544 ms before anything showed (limit 500) (Use the live app like a real client until 2026-11-30)
- WARN SLOW (tablet, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 4383 ms (limit 2500) (Use the live app like a real client until 2026-11-30)
- WARN SHIFT (tablet, choose-sights-day5-after): layout shift 0.91 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SHIFT (tablet, open): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- SHIFT (tablet, home): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- SLOW (tablet, home): tapped "Open the example trip": the screen kept changing for 3015 ms (limit 2500)
- STUCK (tablet, trip): 1 spinner(s) still showing after the screen settled: span.spinner ""
- SLOW (tablet, trip): tapped "day 0 (arrival Athens)": the screen kept changing for 2829 ms (limit 2500)
- STUCK (tablet, day0-arrival): 1 spinner(s) still showing after the screen settled: span.spinner ""
- STUCK (tablet, day1-land): 1 spinner(s) still showing after the screen settled: span.spinner ""
- STUCK (tablet, day4-embark): 1 spinner(s) still showing after the screen settled: span.spinner ""
- STUCK (tablet, day5-port): 1 spinner(s) still showing after the screen settled: span.spinner ""
- STUCK (tablet, day18-departure): 1 spinner(s) still showing after the screen settled: span.spinner ""
- SHIFT (tablet, fit-box-day1): layout shift 0.46 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58]
- SHIFT (tablet, after-close-fit-box-day1): layout shift 0.46 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58]
- STUCK (tablet, tour-exit): 1 spinner(s) still showing after the screen settled: span.spinner ""
- STUCK (tablet, before-back): 1 spinner(s) still showing after the screen settled: span.spinner ""
- BACK (tablet, phone back): the phone Back button (from a day plan, opened from the trip page) left the app instead of going back a screen
- SHIFT (tablet, reopened): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- SHIFT (tablet, offline-open): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]

## Slowest taps

- tablet choose-sights-day1-after: ""Needs ..." (ways to fit it in)" 544 ms
- tablet home: "Open the example trip" 400 ms
- tablet tour-4: "Exit tour" 288 ms
- tablet choose-sights-day5-after: ""Needs ..." (ways to fit it in)" 264 ms
- tablet trip-again: "Day plan tab" 240 ms

## Not tested / notes

- tablet: [choose-sights-day1] 27 sights listed, 5 ticked
- tablet: [choose-sights-day1] not on screen to tap: tick national-garden (More nearby (4))
- tablet: [choose-sights-day1] not on screen to tap: untick national-garden
- tablet: [day5-before-choose] not on screen to tap: Choose sights
- tablet: [choose-sights-day5] 7 sights listed, 7 ticked
- tablet: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- tablet: [offline-open] not on screen to tap: offline day 5
- tablet: [offline-day] not on screen to tap: offline Choose sights
- tablet: [offline-choose] not on screen to tap: offline Guide
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
