# Client feel test: 2026-11-23 19:46 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build 01305861-1795461761)

Tested (real touch taps and swipes): Lenovo Idea Tab Plus 12.1" sideways (1280 x 800). 53 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 23 problem(s): 7 SHIFT, 5 SLOW, 8 STUCK, 2 DRIFT, 1 BACK; 9 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SHIFT (tablet, choose-sights-day1): layout shift 0.20 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SELF-SCROLL (tablet, choose-sights-day1): tapped "tick national-garden (More nearby (4))" and the page scrolled itself up 387px (Stop the select sites page jumping until 2026-11-30)
- WARN JUMP (tablet, choose-sights-day1): tapped "untick national-garden" and it disappeared from the screen (Stop the select sites page jumping until 2026-11-30)
- WARN SELF-SCROLL (tablet, choose-sights-day1): tapped "untick national-garden" and the page scrolled itself up 815px (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (tablet, choose-sights-day1-after): layout shift 1.84 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SLOW (tablet, choose-sights-day1-after): tapped "open a sight": 1560 ms before anything showed (limit 500) (Use the live app like a real client until 2026-11-30)
- WARN SHIFT (tablet, choose-sights-day5): layout shift 0.13 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (tablet, choose-sights-day5-after): layout shift 1.04 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SLOW (tablet, choose-sights-day5-after): tapped "open a sight": the screen kept changing for 3454 ms (limit 2500) (Use the live app like a real client until 2026-11-30)

## Problems

- SHIFT (tablet, open): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- SLOW (tablet, open): tapped "coach Next": 552 ms before anything showed (limit 500)
- SLOW (tablet, open): tapped "coach Next": 896 ms before anything showed (limit 500)
- SHIFT (tablet, home): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- SLOW (tablet, home): tapped "Open the example trip": the screen kept changing for 3192 ms (limit 2500)
- STUCK (tablet, trip): 1 spinner(s) still showing after the screen settled
- SLOW (tablet, trip): tapped "day 0 (arrival Athens)": 504 ms before anything showed (limit 500)
- STUCK (tablet, day0-arrival): 1 spinner(s) still showing after the screen settled
- STUCK (tablet, day1-land): 1 spinner(s) still showing after the screen settled
- STUCK (tablet, day4-embark): 1 spinner(s) still showing after the screen settled
- STUCK (tablet, day5-port): 1 spinner(s) still showing after the screen settled
- STUCK (tablet, day18-departure): 1 spinner(s) still showing after the screen settled
- DRIFT (tablet, choose-sights-day1-after): tapped "open a sight": the screen was still changing 8 s later
- SHIFT (tablet, stop-open-day1): layout shift 0.13 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58]
- DRIFT (tablet, day5-before-choose): the screen moved with no finger on it (shift 0.065, 0 scroll changes) [moved: div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58]
- SHIFT (tablet, sight-open-day5): layout shift 0.20 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58; div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58; div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58]
- SHIFT (tablet, after-close-sight-day5): layout shift 0.20 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58; div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58; div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58]
- SLOW (tablet, tour-4): tapped "Exit tour": 568 ms before anything showed (limit 500)
- STUCK (tablet, tour-exit): 1 spinner(s) still showing after the screen settled
- STUCK (tablet, before-back): 1 spinner(s) still showing after the screen settled
- BACK (tablet, phone back): the phone Back button (from a day plan, opened from the trip page) left the app instead of going back a screen
- SHIFT (tablet, reopened): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- SHIFT (tablet, offline-open): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]

## Slowest taps

- tablet choose-sights-day1-after: "open a sight" 1560 ms
- tablet open: "coach Next" 896 ms
- tablet tour-4: "Exit tour" 568 ms
- tablet open: "coach Next" 552 ms
- tablet trip: "day 0 (arrival Athens)" 504 ms

## Not tested / notes

- tablet: [choose-sights-day1] 27 sights listed, 5 ticked
- tablet: [day5-before-choose] not on screen to tap: Choose sights
- tablet: [choose-sights-day5] 7 sights listed, 7 ticked
- tablet: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- tablet: [offline-open] not on screen to tap: offline day 5
- tablet: [offline-day] not on screen to tap: offline Choose sights
- tablet: [offline-choose] not on screen to tap: offline Guide
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
