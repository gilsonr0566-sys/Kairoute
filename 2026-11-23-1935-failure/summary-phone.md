# Client feel test: 2026-11-23 19:35 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build 6dad9af-1795372685)

Tested (real touch taps and swipes): Galaxy S24 Ultra (412 x 915). 41 taps, 14 full-page swipe scrolls, 38 screens.

Result: FAIL, 14 problem(s): 2 SLOW, 8 STUCK, 2 SHIFT, 1 JUMP, 1 BACK

## Problems

- SLOW (phone, trip): tapped "day 0 (arrival Athens)": the screen kept changing for 2756 ms (limit 2500)
- STUCK (phone, day0-arrival): 1 spinner(s) still showing after the screen settled
- STUCK (phone, day1-land): 1 spinner(s) still showing after the screen settled
- STUCK (phone, day4-embark): 1 spinner(s) still showing after the screen settled
- STUCK (phone, day5-port): 1 spinner(s) still showing after the screen settled
- STUCK (phone, day18-departure): 1 spinner(s) still showing after the screen settled
- STUCK (phone, day1-before-choose): 1 spinner(s) still showing after the screen settled
- SLOW (phone, day1-before-choose): tapped "Choose sights": the screen kept changing for 5939 ms (limit 2500)
- STUCK (phone, day5-before-choose): 1 spinner(s) still showing after the screen settled
- SHIFT (phone, choose-sights-day5-after): layout shift 1.32 while this screen opened and was used (limit 0.1) [moved: main "MON JUL 5 · HERAKLION · IN PORT Choose s" 19->13; div#dayChips.days "Jun 30 · Athens Jul 1 · Athens Jul 2 · A" 0->6; div.sitesgrid "All Must-sees Famous Local favorites Vis" 159->109; div.headacts "‹ Day plan" 101->48; div.sitesgrid "All Must-sees Famous Local favorites Vis" 136->186]
- JUMP (phone, guide): tapped "play a story" and it moved down 447px from under the finger
- SHIFT (phone, guide-playing): layout shift 0.31 while this screen opened and was used (limit 0.1) [moved: main "MON JUL 5 · HERAKLION · IN PORT Heraklio" 94->100; div#dayChips.days "Jun 30 · Athens Jul 1 · Athens Jul 2 · A" 56->50; main "MON JUL 5 · HERAKLION · IN PORT Heraklio" 19->13; div#dayChips.days "Jun 30 · Athens Jul 1 · Athens Jul 2 · A" 0->6; div.guidegrid "1 Palace of Knossos 2 Agios Minas Cathed" 139->89]
- STUCK (phone, tour-exit): 1 spinner(s) still showing after the screen settled
- BACK (phone, phone back): the phone Back button (from a day plan, opened from the trip page) left the app instead of going back a screen

## Slowest taps

- phone open: "coach Next" 456 ms
- phone choose-sights-day5-after: "open a sight" 344 ms
- phone stop-open-day1: "Day plan tab" 280 ms
- phone guide-playing: "Start the tour" 248 ms
- phone day1-land: "day 4 (embark Athens)" 224 ms

## Not tested / notes

- phone: [choose-sights-day1] not on screen to tap: filter Must-sees
- phone: [choose-sights-day1] not on screen to tap: filter Famous
- phone: [choose-sights-day1] not on screen to tap: filter Local favorites
- phone: [choose-sights-day1] not on screen to tap: filter All
- phone: [choose-sights-day1] 0 sights listed, 0 ticked
- phone: [choose-sights-day1-after] not on screen to tap: Back to my day plan
- phone: [choose-sights-day5] 7 sights listed, 7 ticked
- phone: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- phone: [offline-open] not on screen to tap: offline day 5
- phone: [offline-day] not on screen to tap: offline Choose sights
- phone: [offline-choose] not on screen to tap: offline Guide
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
