# Client feel test: 2026-11-24 17:55 UTC

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/ (build de7cba02-1795522279)

Tested (real touch taps and swipes): Galaxy S24 Ultra (412 x 915). 58 taps, 14 full-page swipe scrolls, 40 screens.

Result: FAIL, 7 problem(s): 6 SLOW, 1 SHIFT; 3 known warning(s) with an owner and an end date

## Known warnings (owner, end date)

- WARN SELF-SCROLL (phone, choose-sights-day1): tapped "untick roman-agora" and the page scrolled itself up 332px (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (phone, choose-sights-day1-after): layout shift 1.64 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)
- WARN SHIFT (phone, choose-sights-day5-after): layout shift 1.26 while this screen opened and was used (limit 0.1) (Stop the select sites page jumping until 2026-11-30)

## Problems

- SLOW (phone, open): tapped "coach Next": 1208 ms before anything showed (limit 500)
- SLOW (phone, home): tapped "Open the example trip": the screen kept changing for 2611 ms (limit 2500)
- SLOW (phone, day0-arrival): tapped "day 1 (land Athens)": 1072 ms before anything showed (limit 500)
- SLOW (phone, choose-sights-day1-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 5733 ms (limit 2500)
- SLOW (phone, fit-box-day1): tapped "close the box": the screen kept changing for 2574 ms (limit 2500)
- SLOW (phone, choose-sights-day5-after): tapped ""Needs ..." (ways to fit it in)": the screen kept changing for 3305 ms (limit 2500)
- SHIFT (phone, guide-playing): layout shift 0.20 while this screen opened and was used (limit 0.1) [moved: div.guidegrid "1 Palace of Knossos 2 Agios Minas Cathed" 145->95; div.headacts "📷 What's this? ▶ Start tour" 87->34; div.guidegrid "1 Palace of Knossos 2 Agios Minas Cathed" 123->173; div.headacts "📷 What's this? ▶ Start tour" 62->115; div.guidegrid "1 Palace of Knossos 2 Agios Minas Cathed" 143->93]

## Slowest taps

- phone open: "coach Next" 1208 ms
- phone day0-arrival: "day 1 (land Athens)" 1072 ms
- phone trip: "day 0 (arrival Athens)" 392 ms
- phone after-close-fit-box-day5: "Back to my day plan" 288 ms
- phone tour-4: "Exit tour" 240 ms

## Not tested / notes

- phone: [choose-sights-day1] 31 sights listed, 5 ticked
- phone: [choose-sights-day1] not on screen to tap: tick national-garden (More nearby (6))
- phone: [choose-sights-day1] not on screen to tap: untick national-garden
- phone: [choose-sights-day5] 7 sights listed, 7 ticked
- phone: [guide] a story was tapped but no sound file was playing 2.5 s later (speech voice may be used instead)
- Real phone hardware and real Safari are not tested here (Chromium with touch emulation).
