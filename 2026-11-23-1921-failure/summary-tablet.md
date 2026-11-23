# Client feel test: 2026-11-23 19:17 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build 6dad9af-1795372685)

Tested (real touch taps and swipes): Lenovo Idea Tab Plus 12.1" sideways (1280 x 800). 42 taps, 14 full-page swipe scrolls, 38 screens.

Result: FAIL, 27 problem(s): 8 SHIFT, 9 STUCK, 6 SCROLL, 3 SLOW, 1 BACK

## Problems

- SHIFT (tablet, open): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- SHIFT (tablet, home): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- STUCK (tablet, day0-arrival): 1 spinner(s) still showing after the screen settled
- STUCK (tablet, day1-land): 1 spinner(s) still showing after the screen settled
- STUCK (tablet, day4-embark): 1 spinner(s) still showing after the screen settled
- SCROLL (tablet, day4-embark): the page stopped scrolling at 0px of 2416px
- SCROLL (tablet, day4-embark): a swipe did not move the page (height 2416px)
- STUCK (tablet, day5-port): 1 spinner(s) still showing after the screen settled
- SCROLL (tablet, day5-port): the page stopped scrolling at 0px of 1586px
- SCROLL (tablet, day5-port): a swipe did not move the page (height 1586px)
- STUCK (tablet, day18-departure): 1 spinner(s) still showing after the screen settled
- SCROLL (tablet, day18-departure): the page stopped scrolling at 0px of 1664px
- SCROLL (tablet, day18-departure): a swipe did not move the page (height 1664px)
- SLOW (tablet, day1-before-choose): tapped "Choose sights": the screen kept changing for 6084 ms (limit 2500)
- SHIFT (tablet, choose-sights-day1): layout shift 1.69 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58]
- SHIFT (tablet, choose-sights-day1-after): layout shift 2.71 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58]
- SLOW (tablet, choose-sights-day1-after): tapped "open a sight": 640 ms before anything showed (limit 500)
- SLOW (tablet, choose-sights-day1-after): tapped "open a sight": the screen kept changing for 3573 ms (limit 2500)
- SHIFT (tablet, sight-open-day1): layout shift 0.85 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58]
- SHIFT (tablet, after-close-sight-day1): layout shift 0.85 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58]
- STUCK (tablet, day1-after-choose): 1 spinner(s) still showing after the screen settled
- STUCK (tablet, day5-after-choose): 1 spinner(s) still showing after the screen settled
- STUCK (tablet, stop-open-day5): 1 spinner(s) still showing after the screen settled
- STUCK (tablet, tour-exit): 1 spinner(s) still showing after the screen settled
- BACK (tablet, phone back): the phone Back button (from a day plan, opened from the trip page) left the app instead of going back a screen
- SHIFT (tablet, reopened): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- SHIFT (tablet, offline-open): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]

## Slowest taps

- tablet choose-sights-day1-after: "open a sight" 640 ms
- tablet guide: "play a story" 496 ms
- tablet day1-after-choose: "open stop Erechtheion" 488 ms
- tablet guide-playing: "Start the tour" 480 ms
- tablet home: "Open the example trip" 472 ms

## Not tested / notes

- tablet: [choose-sights-day1] 5 sights listed, 4 ticked
- tablet: [day5-before-choose] not on screen to tap: Choose sights
- tablet: [choose-sights-day5] not on screen to tap: filter Must-sees
- tablet: [choose-sights-day5] not on screen to tap: filter Famous
- tablet: [choose-sights-day5] not on screen to tap: filter Local favorites
- tablet: [choose-sights-day5] not on screen to tap: filter All
- tablet: [choose-sights-day5] 0 sights listed, 0 ticked
- tablet: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- tablet: [offline-open] not on screen to tap: offline day 5
- tablet: [offline-day] not on screen to tap: offline Choose sights
- tablet: [offline-choose] not on screen to tap: offline Guide
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
