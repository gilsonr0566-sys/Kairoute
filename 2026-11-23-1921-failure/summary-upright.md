# Client feel test: 2026-11-23 19:17 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build 6dad9af-1795372685)

Tested (real touch taps and swipes): Lenovo Idea Tab Plus 12.1" upright (800 x 1280). 42 taps, 14 full-page swipe scrolls, 38 screens.

Result: FAIL, 33 problem(s): 9 SHIFT, 4 SLOW, 9 STUCK, 4 SCROLL, 1 SELF-SCROLL, 5 DEAD, 1 BACK

## Problems

- SHIFT (upright, open): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- SHIFT (upright, home): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]
- SLOW (upright, trip): tapped "day 0 (arrival Athens)": the screen kept changing for 2584 ms (limit 2500)
- STUCK (upright, day0-arrival): 1 spinner(s) still showing after the screen settled
- STUCK (upright, day1-land): 1 spinner(s) still showing after the screen settled
- STUCK (upright, day4-embark): 1 spinner(s) still showing after the screen settled
- SCROLL (upright, day4-embark): could not get back to the top (stuck at 2449px)
- STUCK (upright, day5-port): 1 spinner(s) still showing after the screen settled
- SCROLL (upright, day5-port): could not get back to the top (stuck at 871px)
- STUCK (upright, day18-departure): 1 spinner(s) still showing after the screen settled
- SCROLL (upright, day18-departure): could not get back to the top (stuck at 1469px)
- SLOW (upright, day1-before-choose): tapped "Choose sights": the screen kept changing for 6313 ms (limit 2500)
- SHIFT (upright, choose-sights-day1): layout shift 1.93 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58]
- SCROLL (upright, choose-sights-day1): could not get back to the top (stuck at 2457px)
- SELF-SCROLL (upright, choose-sights-day1): tapped "filter Must-sees" and the page scrolled itself up 2250px
- DEAD (upright, choose-sights-day1): tapped "untick src-q242741 (Your sights (4))" and nothing on the screen changed
- DEAD (upright, choose-sights-day1): tapped "tick back src-q242741" and nothing on the screen changed
- DEAD (upright, choose-sights-day1): tapped "tick areopagus ()" and nothing on the screen changed
- SLOW (upright, choose-sights-day1): tapped "untick areopagus": 912 ms before anything showed (limit 500)
- DEAD (upright, choose-sights-day1): tapped "Your sights Hide" and nothing on the screen changed
- DEAD (upright, choose-sights-day1): tapped "Your sights Show" and nothing on the screen changed
- SHIFT (upright, choose-sights-day1-after): layout shift 2.15 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58]
- SLOW (upright, choose-sights-day1-after): tapped "open a sight": the screen kept changing for 4655 ms (limit 2500)
- SHIFT (upright, sight-open-day1): layout shift 1.21 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58]
- SHIFT (upright, after-close-sight-day1): layout shift 1.21 while this screen opened and was used (limit 0.1) [moved: div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58; div#view.wrap.panes "THU JUL 1 · ATHENS · LAND DAY Choose sig" 0->58]
- STUCK (upright, day1-after-choose): 1 spinner(s) still showing after the screen settled
- STUCK (upright, day5-after-choose): 1 spinner(s) still showing after the screen settled
- STUCK (upright, stop-open-day5): 1 spinner(s) still showing after the screen settled
- SHIFT (upright, tour-3): layout shift 0.12 while this screen opened and was used (limit 0.1) [moved: div#view.wrap "TOUR · HERAKLION · JUL 5 Step 1 of 10 · " 0->55; main "TOUR · HERAKLION · JUL 5 Step 1 of 10 · " 58->55; div.tcside "PRO Pro guide's tips What a private guid" 691->740; div.field "CAN YOU FIND THESE? 1 The gypsum Throne " 467->516; span.state "This browser didn't start the voice. Che" 414->459]
- SHIFT (upright, tour-4): layout shift 0.12 while this screen opened and was used (limit 0.1) [moved: div#view.wrap "TOUR · HERAKLION · JUL 5 Step 1 of 10 · " 0->55; main "TOUR · HERAKLION · JUL 5 Step 1 of 10 · " 58->55; div.tcside "PRO Pro guide's tips What a private guid" 691->740; div.field "CAN YOU FIND THESE? 1 The gypsum Throne " 467->516; span.state "This browser didn't start the voice. Che" 414->459]
- STUCK (upright, before-back): 1 spinner(s) still showing after the screen settled
- BACK (upright, phone back): the phone Back button (from a day plan, opened from the trip page) left the app instead of going back a screen
- SHIFT (upright, reopened): layout shift 0.14 while this screen opened and was used (limit 0.1) [moved: main "PREVIEW 0.9 Settings kairoute Be your ow" 179->0]

## Slowest taps

- upright choose-sights-day1-after: "open a sight" 408 ms
- upright open: "coach Next" 368 ms
- upright guide-playing: "Start the tour" 296 ms
- upright journal: "Settings tab" 288 ms
- upright home: "Open the example trip" 256 ms

## Not tested / notes

- upright: [choose-sights-day1] 5 sights listed, 4 ticked
- upright: [day5-before-choose] not on screen to tap: Choose sights
- upright: [choose-sights-day5] not on screen to tap: filter Must-sees
- upright: [choose-sights-day5] not on screen to tap: filter Famous
- upright: [choose-sights-day5] not on screen to tap: filter Local favorites
- upright: [choose-sights-day5] not on screen to tap: filter All
- upright: [choose-sights-day5] 0 sights listed, 0 ticked
- upright: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- upright: [offline-open] not on screen to tap: offline day 5
- upright: [offline-day] not on screen to tap: offline Choose sights
- upright: [offline-choose] not on screen to tap: offline Guide
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
