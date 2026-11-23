# Client feel test: 2026-11-23 19:20 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build 6dad9af-1795372685)

Tested (real touch taps and swipes): Galaxy S24 Ultra (412 x 915). 51 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 19 problem(s): 5 SLOW, 7 STUCK, 1 JUMP, 5 SHIFT, 1 BACK

## Problems

- SLOW (phone, open): tapped "coach Next": 696 ms before anything showed (limit 500)
- SLOW (phone, trip): tapped "day 0 (arrival Athens)": the screen kept changing for 3125 ms (limit 2500)
- STUCK (phone, day0-arrival): 1 spinner(s) still showing after the screen settled
- STUCK (phone, day1-land): 1 spinner(s) still showing after the screen settled
- STUCK (phone, day4-embark): 1 spinner(s) still showing after the screen settled
- STUCK (phone, day5-port): 1 spinner(s) still showing after the screen settled
- STUCK (phone, day18-departure): 1 spinner(s) still showing after the screen settled
- STUCK (phone, day1-before-choose): 1 spinner(s) still showing after the screen settled
- SLOW (phone, day1-before-choose): tapped "Choose sights": the screen kept changing for 3428 ms (limit 2500)
- JUMP (phone, choose-sights-day1): tapped "untick areopagus" and it moved up 1086px from under the finger
- SHIFT (phone, choose-sights-day1-after): layout shift 0.81 while this screen opened and was used (limit 0.1) [moved: main "THU JUL 1 · ATHENS · LAND DAY Choose sig" 19->13; div#dayChips.days "Jun 30 · Athens Jul 1 · Athens Jul 2 · A" 0->6; main "THU JUL 1 · ATHENS · LAND DAY Choose sig" 51->57; div#dayChips.days "Jun 30 · Athens Jul 1 · Athens Jul 2 · A" 13->7; main "THU JUL 1 · ATHENS · LAND DAY Choose sig" 37->31]
- SLOW (phone, choose-sights-day1-after): tapped "open a sight": 808 ms before anything showed (limit 500)
- SLOW (phone, choose-sights-day1-after): tapped "open a sight": the screen kept changing for 3808 ms (limit 2500)
- SHIFT (phone, choose-sights-day5-after): layout shift 1.25 while this screen opened and was used (limit 0.1) [moved: main "MON JUL 5 · HERAKLION · IN PORT Choose s" 19->13; div#dayChips.days "Jun 30 · Athens Jul 1 · Athens Jul 2 · A" 0->6; div.sitesgrid "All Must-sees Famous Local favorites Vis" 159->109; div.headacts "‹ Day plan" 101->48; div.sitesgrid "All Must-sees Famous Local favorites Vis" 141->191]
- SHIFT (phone, guide-playing): layout shift 0.28 while this screen opened and was used (limit 0.1) [moved: main "MON JUL 5 · HERAKLION · IN PORT Heraklio" 94->100; div#dayChips.days "Jun 30 · Athens Jul 1 · Athens Jul 2 · A" 56->50; main "MON JUL 5 · HERAKLION · IN PORT Heraklio" 19->13; div#dayChips.days "Jun 30 · Athens Jul 1 · Athens Jul 2 · A" 0->6; div.guidegrid "1 Palace of Knossos 2 Agios Minas Cathed" 139->89]
- SHIFT (phone, tour-3): layout shift 0.12 while this screen opened and was used (limit 0.1) [moved: main "TOUR · HERAKLION · JUL 5 Step 1 of 10 · " 100->51; div.field "CAN YOU FIND THESE? 1 The gypsum Throne " 545->614; div.tcside "PRO Pro guide's tips What a private guid" 823->892; span.state "This browser didn't start the voice. Che" 491->537]
- SHIFT (phone, tour-4): layout shift 0.13 while this screen opened and was used (limit 0.1) [moved: main "TOUR · HERAKLION · JUL 5 Step 1 of 10 · " 100->51; div.field "CAN YOU FIND THESE? 1 The gypsum Throne " 545->614; div.tcside "PRO Pro guide's tips What a private guid" 823->892; span.state "This browser didn't start the voice. Che" 491->537]
- STUCK (phone, tour-exit): 1 spinner(s) still showing after the screen settled
- BACK (phone, phone back): the phone Back button (from a day plan, opened from the trip page) left the app instead of going back a screen

## Slowest taps

- phone choose-sights-day1-after: "open a sight" 808 ms
- phone open: "coach Next" 696 ms
- phone choose-sights-day5-after: "open a sight" 456 ms
- phone after-close-sight-day1: "Back to my day plan" 408 ms
- phone tour-3: "tour step 3" 232 ms

## Not tested / notes

- phone: [choose-sights-day1] 5 sights listed, 4 ticked
- phone: [day5-before-choose] not on screen to tap: Choose sights
- phone: [choose-sights-day5] 7 sights listed, 7 ticked
- phone: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- phone: [offline-open] not on screen to tap: offline day 5
- phone: [offline-day] not on screen to tap: offline Choose sights
- phone: [offline-choose] not on screen to tap: offline Guide
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
