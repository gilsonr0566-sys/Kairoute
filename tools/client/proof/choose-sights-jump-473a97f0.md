# Proof the client feel test catches a jump (planted defect: the real Choose sights page before its fix)

Build 473a97f0 (xrdp7v, Nov 23 2026), phone 412x915, run locally with `SIZES=phone node tools/client/feel.cjs beta2-site/index.html`. Richard found this page "unusable, jumping around"; the test fails on it:

Result: FAIL, 7 problem(s): 4 SHIFT, 1 DEAD, 1 SELF-SCROLL, 1 JUMP
## Problems

- SHIFT (phone, trip): layout shift 0.11 while this screen opened and was used (limit 0.1) [moved: main "THU JUL 15 · BARCELONA · ARRIVING Barcel" 0->99]
- DEAD (phone, choose-sights-day1): tapped "tick back theatre-dionysus" and nothing on the screen changed
- SELF-SCROLL (phone, choose-sights-day1): tapped "tick plaka ()" and the page scrolled itself up 380px
- SHIFT (phone, choose-sights-day1-after): layout shift 1.67 while this screen opened and was used (limit 0.1) [moved: main "THU JUL 1 · ATHENS · LAND DAY Choose sig" 18->12; div#dayChips.days "Jun 30 · Athens Jul 1 · Athens Jul 2 · A" 0->6; main "THU JUL 1 · ATHENS · LAND DAY Choose sig" 44->50; div#dayChips.days "Jun 30 · Athens Jul 1 · Athens Jul 2 · A" 7->1; main "THU JUL 1 · ATHENS · LAND DAY Choose sig" 38->32]
- SHIFT (phone, choose-sights-day5-after): layout shift 1.36 while this screen opened and was used (limit 0.1) [moved: main "MON JUL 5 · HERAKLION · IN PORT Choose s" 18->12; div#dayChips.days "Jun 30 · Athens Jul 1 · Athens Jul 2 · A" 0->6; div.sitesgrid "All Must-sees Famous Local favorites Vis" 158->108; div.headacts "‹ Day plan" 100->47; div.sitesgrid "All Must-sees Famous Local favorites Vis" 132->182]
- JUMP (phone, guide): tapped "play a story" and it moved down 468px from under the finger
- SHIFT (phone, guide-playing): layout shift 0.29 while this screen opened and was used (limit 0.1) [moved: main "MON JUL 5 · HERAKLION · IN PORT Heraklio" 93->99; div#dayChips.days "Jun 30 · Athens Jul 1 · Athens Jul 2 · A" 56->50; main "MON JUL 5 · HERAKLION · IN PORT Heraklio" 18->12; div#dayChips.days "Jun 30 · Athens Jul 1 · Athens Jul 2 · A" 0->6; div.guidegrid "1 Palace of Knossos 2 Agios Minas Cathed" 138->88]


Also on that build (tablet sideways and upright): Home jumped up 178px as it opened (SHIFT 0.14); the phone Back button left the app (BACK).
