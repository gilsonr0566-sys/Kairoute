# Every button pressed (this build, no internet)

Build: beta2-site/index.html. 2026-11-27 19:58 UTC.

| | |
|---|---|
| Presses made (real touch, one at a time, app put back before each) | 11 |
| Different controls pressed | 11 |
| Screens walked (trip x size x screen) | 1 |
| Presses that broke a rule | 9 in 9 classes |
| Greyed-out controls seen (cannot be pressed) | 0 |
| Action names in the app | 171 |
| ... pressed at least once | 9 |
| ... NOT PRESSED | 162 |
| ... cannot be pressed in a test (reason given below) | 0 |

## Trips and sizes

| Trip | Size | Presses | With a failure | Minutes |
|---|---|---|---|---|
| First open, no trip yet (intro, new trip steps, example offer) | tablet | 11 | 9 | 1 |

## Failures, one line per class

| Rule | Control | What happened | Seen | Where |
|---|---|---|---|---|
| COVERED | "Plan a new trip" (newtrip) | a finger cannot reach it: div.sheet "🧭 HOW KAIROUTE WORKS · 1 OF 4 Plan a tr" lies over it | 1x, tablet | first: First open |
| COVERED | "Watch the intro" (film) | a finger cannot reach it: div.sheet "🧭 HOW KAIROUTE WORKS · 1 OF 4 Plan a tr" lies over it | 1x, tablet | first: First open |
| COVERED | "Settings" (settings) | a finger cannot reach it: div.coach "🧭 HOW KAIROUTE WORKS · 1 OF 4 Plan a tr" lies over it | 1x, tablet | first: First open |
| COVERED | "Sync with another device" (syncfromlobby) | a finger cannot reach it: div.row "Skip Next" lies over it | 1x, tablet | first: First open |
| COVERED | "Open the example trip" (continue) | a finger cannot reach it: div.coach "🧭 HOW KAIROUTE WORKS · 1 OF 4 Plan a tr" lies over it | 1x, tablet | first: First open |
| COVERED | "Edit itinerary" | a finger cannot reach it: div.coach "🧭 HOW KAIROUTE WORKS · 1 OF 4 Plan a tr" lies over it | 1x, tablet | first: First open |
| COVERED | "More" | a finger cannot reach it: div.coach "🧭 HOW KAIROUTE WORKS · 1 OF 4 Plan a tr" lies over it | 1x, tablet | first: First open |
| COVERED | "Privacy" (privacy) | a finger cannot reach it: div.coach "🧭 HOW KAIROUTE WORKS · 1 OF 4 Plan a tr" lies over it | 1x, tablet | first: First open |
| COVERED | "Terms" (terms) | a finger cannot reach it: div.coach "🧭 HOW KAIROUTE WORKS · 1 OF 4 Plan a tr" lies over it | 1x, tablet | first: First open |

## Not pressed, not tested

- NOT TESTED: these trips were not in this run: example, during, rail, port, ferry, group, odd.
- NOT PRESSED (162 action names no press reached): aboard, addday, addplace, addport, alarmopen, archive, ashore, asknoticeok, backack, boardcal, boardcancel, boardchange, boardsave, bonusadd, bonusskip, bookcancel, bookopen, bookremove, booksearch, bumpok, busyrow, camclose, camopen, campick, camplay, cdpreview, celclose, celebrate, celoffdl, changetrip, clearanchor, clearkey, closedalt, closedday, closedmove, closedswap, coachreplay, copytrip, cutkeep, cutok, daylen, dayready, daytitle, daytitleauto, daytitlecancel, daytitlesave, delask, delday, delno, deltrip, earlystart, esimback, esimbuy, esimclose, esimnext, esimopen, esimphones, esimpick, esimundo, filmclose, filmreplay, fitadd, fitask, fitcancel, fitday, fitfix, fitfixgo, fitleave, fitmove, fittime, fixstops, follow, freshpicks, gen, genall, geo, gotit, hrsdone, hrsopen, lateend, livealerts, livegps, livereplan, liveundo, loadsample, lobby, mealdone, mealopen, mealreset, mealskip, mealtime, mealunskip, memmake, memsave, memshare, moretrips, mytrips, nextday, nightdep, offback, offclear, offdl, offlater, offstop, opentrip, orderback, orderkeep, orderreset, parsetrip, picks, picksfold, piersearch, pointpick, prevday, printday, printtrip, raterow, readyorderno, readyorderyes, rename, renamecancel, renamesave, reset, resetno, resetyes, restore, ridechangeok, rideforce, rideundo, savekey, shipcheck, shiplater, shipok, shipset, shipsnap, shiptimes, shiptype, shipuseread, sortagain, suggestok, suggesttour, syncjoin, synclink, syncnow, syncoff, syncstart, tixdone, tlview, toplan, tourexit, tourhere, tournext, tourpart, tourstart, tourtomorrow, voicetry, wizback, wizcancel, wizmore, wxkeep, wxswap, wxundo.
- This run had no internet: every lookup (address, timetable, pier, sights from the web) was pressed, and had to answer honestly without a connection; whether the lookup finds the right thing is tested in the live run only.
- Not pressed by this check: the map itself (pan, zoom, tapping a pin), drag to reorder, the phone's own Back button and system pickers (date wheel, share sheet, camera, print dialog: the app's call to each is recorded, the system screen is not driven).

## What every control did

One line per kind of control: its label, how often it was pressed, and what happened most often.

| Control | Pressed | What it did (most often) | Held to | Failures |
|---|---|---|---|---|
| coachnext: "Next" | 1 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| coachskip: "Skip" | 1 | closes coach,sheet; removes: "…" "…" (+# lines) | general rules |  |
| continue: "Open the example trip" | 1 | could not be pressed | general rules | 1 |
| film: "Watch the intro" | 1 | could not be pressed | general rules | 1 |
| newtrip: "Plan a new trip" | 1 | could not be pressed | general rules | 1 |
| privacy: "Privacy" | 1 | could not be pressed | general rules | 1 |
| settings: "Settings" | 1 | could not be pressed | general rules | 1 |
| syncfromlobby: "Sync with another device" | 1 | could not be pressed | general rules | 1 |
| terms: "Terms" | 1 | could not be pressed | general rules | 1 |
| "Edit itinerary" | 1 | could not be pressed | general rules | 1 |
| "More" | 1 | could not be pressed | general rules | 1 |
