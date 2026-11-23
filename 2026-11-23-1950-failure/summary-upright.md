# Client feel test: 2026-11-23 19:47 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build 01305861-1795461761)

Tested (real touch taps and swipes): Lenovo Idea Tab Plus 12.1" upright (800 x 1280). 51 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 22 problem(s): 9 SHIFT, 4 SLOW, 7 STUCK, 1 DRIFT, 1 BACK; 5 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SHIFT (upright, choose-sights-day1): layout shift 1.29 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (upright, choose-sights-day1-after): layout shift 2.11 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SLOW (upright, choose-sights-day1-after): tapped "open a sight": 720 ms before anything showed (limit 500) (Use the live app like a real client until 2026-11-30)
- WARN SLOW (upright, choose-sights-day1-after): tapped "open a sight": the screen kept changing for 5649 ms (limit 2500) (Use the live app like a real client until 2026-11-30)
- WARN SHIFT (upright, choose-sights-day5-after): layout shift 0.76 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SHIFT (upright, open): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- SLOW (upright, open): tapped "coach Next": 944 ms before anything showed (limit 500)
- SHIFT (upright, home): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- SLOW (upright, home): tapped "Open the example trip": the screen kept changing for 3253 ms (limit 2500)
- STUCK (upright, trip): 1 spinner(s) still showing after the screen settled
- STUCK (upright, day0-arrival): 1 spinner(s) still showing after the screen settled
- STUCK (upright, day1-land): 1 spinner(s) still showing after the screen settled
- STUCK (upright, day4-embark): 1 spinner(s) still showing after the screen settled
- STUCK (upright, day5-port): 1 spinner(s) still showing after the screen settled
- STUCK (upright, day18-departure): 1 spinner(s) still showing after the screen settled
- SLOW (upright, day1-before-choose): tapped "Choose sights": the screen kept changing for 5032 ms (limit 2500)
- SHIFT (upright, sight-open-day1): layout shift 0.43 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58]
- SHIFT (upright, after-close-sight-day1): layout shift 0.43 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58]
- SLOW (upright, day1-after-choose): tapped "open stop Must-sees": the screen kept changing for 2518 ms (limit 2500)
- SHIFT (upright, stop-open-day1): layout shift 0.69 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58]
- DRIFT (upright, day5-after-choose): the screen moved with no finger on it (shift 0.043, 0 scroll changes) [moved: div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58]
- SHIFT (upright, day5-after-choose): layout shift 0.13 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58; div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58; div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58]
- SHIFT (upright, stop-open-day5): layout shift 0.17 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58; div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58; div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58; div#view.wrap.panes "MON JUL 5 · HERAKLION · IN PORT Choose s" 0->58]
- STUCK (upright, tour-exit): 1 spinner(s) still showing after the screen settled
- BACK (upright, phone back): the phone Back button (from a day plan, opened from the trip page) left the app instead of going back a screen
- SHIFT (upright, reopened): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- SHIFT (upright, offline-open): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]

## Slowest taps

- upright open: "coach Next" 944 ms
- upright choose-sights-day1-after: "open a sight" 720 ms
- upright choose-sights-day5-after: "open a sight" 416 ms
- upright guide-playing: "Start the tour" 352 ms
- upright trip: "day 0 (arrival Athens)" 344 ms

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
