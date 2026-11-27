# Every button pressed (live app)

App: https://gilsonr0566-sys.github.io/Kairoute-Beta2/. 2026-11-27 20:29 UTC.

| | |
|---|---|
| Presses made (real touch, one at a time, app put back before each) | 2795 |
| Different controls pressed | 1780 |
| Screens walked (trip x size x screen) | 48 |
| Presses that broke a rule | 280 in 119 classes |
| Greyed-out controls seen (cannot be pressed) | 0 |
| Action names in the app | 171 |
| ... pressed at least once | 70 |
| ... NOT PRESSED | 101 |
| ... cannot be pressed in a test (reason given below) | 0 |

## Trips and sizes

| Trip | Size | Presses | With a failure | Minutes |
|---|---|---|---|---|
| Boat day: Naples, Capri and Sorrento (saved test trip) | phone | 1003 | 111 | 28 |
| Odd and empty input: no place, no date, sea day alone, very long and marked-up names, impossible times | phone | 834 | 62 | 19 |
| Cruise port day: Kotor (saved test trip, pier not yet chosen) | phone | 959 | 108 | 26 |

## Failures, one line per class

| Rule | Control | What happened | Seen | Where |
|---|---|---|---|---|
| BROKEN | "Change the name" | the screen shows: "Land day · undefined–NaN:NaN" | 9x, phone | odd: Day plan, land day (no place); Choose sights, land day (no place); Guide, land day (no place) (+6) after Mar 4 · A very long name that goes on and on A very long nam |
| BROKEN | "Sightseeing from my hotel Arriving (flig" | the screen shows: "Boarding · All aboard null" | 4x, phone | ferry, port: Trip |
| DEAD | "Build the guide" (gen) | nothing a traveler can see, hear or get happened | 9x, phone | ferry, odd, port: Tour, sea day (no place); Day plan, land day (no place); Choose sights, land day (no place) (+5) |
| DEAD | "Replay" (filmreplay) | nothing a traveler can see, hear or get happened | 6x, phone | ferry, odd, port: Home; Settings after Watch the intro |
| DEAD | "Find it" (geo) | nothing a traveler can see, hear or get happened | 2x, phone | ferry, port: Trip after + Add a day > Jun 10 ⌂ New day Land day · 9:00 am–6:00 pm Gu |
| DEAD | "Zoom in" | nothing a traveler can see, hear or get happened | 2x, phone | ferry, port: Trip after + Add a port day > Port name, e.g. Kotor = Piraeus |
| DEAD | "Zoom out" | nothing a traveler can see, hear or get happened | 2x, phone | ferry, port: Trip after + Add a port day > Port name, e.g. Kotor = Piraeus |
| DEAD | "Show where I am on the map" | nothing a traveler can see, hear or get happened | 1x, phone | ferry: Trip after + Add a port day > Port name, e.g. Kotor = Piraeus |
| ERROR | "Trip" | Uncaught TypeError: Cannot read properties of undefined (reading 'list') / Cannot read properties of undefined (reading 'list') | 7x, phone | odd: Home; Day plan, land day (no place); Choose sights, land day (no place) (+4) after Terms |
| ERROR | "Download for offline" (celoffdl) | Uncaught TypeError: Cannot read properties of undefined (reading 'list') / Cannot read properties of undefined (reading 'list') | 4x, phone | odd: Day plan, sea day (At sea); Choose sights, sea day (At sea); Guide, sea day (At sea) (+1) after Lock this day |
| ERROR | "Edit itinerary" | Uncaught TypeError: Cannot read properties of undefined (reading 'list') / Cannot read properties of undefined (reading 'list') | 2x, phone | odd: Home; Settings |
| ERROR | "(state)" | could not open this screen: page.evaluate: TypeError: Cannot read properties of undefined (reading 'list') | 1x, phone | odd: Trip |
| ERROR | "Edit this day" | Uncaught TypeError: Cannot read properties of undefined (reading 'list') / Cannot read properties of undefined (reading 'list') | 1x, phone | odd: Day plan, land day (no place) after Mar 2 · Lisbon > Build the Lisbon guide |
| JUMP | "Jul 8 ⚓ Kotor, Montenegro In port · Asho" | the screen moved 499 px up under the finger at once | 13x, phone | port: Trip |
| JUMP | "+ Add a city stay" | the screen moved 89 px up under the finger at once | 12x, phone | ferry, odd, port: Home; Settings after Plan a new trip |
| JUMP | "Build the Vienna guide" (gen) | the screen moved 55 px down under the finger at once | 12x, phone | odd: Day plan, land day (no place); Choose sights, land day (no place); Guide, land day (no place) (+6) after Mar 7 · Vienna |
| JUMP | "+ Add a cruise" | the screen moved 374 px down under the finger at once | 6x, phone | ferry, odd, port: Home; Settings after Plan a new trip |
| JUMP | "Personalize first" (wizmore) | the screen moved 603 px down under the finger at once | 6x, phone | ferry, odd, port: Home; Settings after Plan a new trip |
| JUMP | "Build my trip" | the screen moved 603 px down under the finger at once | 6x, phone | ferry, odd, port: Home; Settings after Plan a new trip |
| JUMP | "Rename" (rename) | the screen moved 75 px down under the finger at once | 6x, phone | ferry, odd, port: Home; Settings after More |
| JUMP | "Jun 10 ⚓ Naples In port · Ashore 420, al" | the screen moved 475 px up under the finger at once | 6x, phone | ferry: Trip |
| JUMP | "Sightseeing from my hotel Arriving (flig" | the screen moved 54 px down under the finger at once | 6x, phone | ferry, port: Trip |
| JUMP | "+ Add a port day" (addport) | the screen moved 108 px down under the finger at once | 4x, phone | ferry, port: Trip |
| JUMP | "Jun 10 ⌂ Lisbon Land day · 9:00 am–6:00 " | the screen moved 684 px up under the finger at once | 4x, phone | ferry: Trip after + Add a day |
| JUMP | "Jul 8 ⌂ Lisbon Land day · 9:00 am–6:00 p" | the screen moved 708 px up under the finger at once | 4x, phone | port: Trip after + Add a day |
| JUMP | "+ Add a day" (addday) | the screen moved 101 px down under the finger at once | 3x, phone | ferry, port: Trip |
| JUMP | "Jun 10 ⌂ New day Land day · 9:00 am–6:00" | the screen moved 627 px up under the finger at once | 3x, phone | ferry: Trip after + Add a day |
| JUMP | "Or take metro · about 1 h 5 min" | the screen moved 50 px up under the finger at once | 3x, phone | ferry, port: Trip after + Add a port day > Port name, e.g. Kotor = Piraeus > ✎ Renam |
| JUMP | "Jul 8 ⌂ New day Land day · 9:00 am–6:00 " | the screen moved 651 px up under the finger at once | 3x, phone | port: Trip after + Add a day |
| JUMP | "Jun 9 〰 At sea At sea · No stops" | the screen moved 475 px up under the finger at once | 2x, phone | ferry: Trip |
| JUMP | "More options for this day" | the screen moved 382 px up under the finger at once | 2x, phone | ferry, port: Trip after + Add a day |
| JUMP | "Build the guide" | the screen moved 109 px down under the finger at once | 2x, phone | ferry, port: Trip after + Add a day |
| JUMP | "Jun 10 ⚓ New day In port · Ashore 8:00 a" | the screen moved 583 px up under the finger at once | 2x, phone | ferry: Trip after + Add a port day |
| JUMP | "Port name, e.g. Kotor" | the screen moved 79 px down under the finger at once | 2x, phone | ferry, port: Trip after + Add a port day |
| JUMP | "Flight" | the screen moved 58 px down under the finger at once | 2x, phone | ferry, port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Train" | the screen moved 58 px down under the finger at once | 2x, phone | ferry, port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Ship" | the screen moved 58 px down under the finger at once | 2x, phone | ferry, port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Ferry" | the screen moved 58 px down under the finger at once | 2x, phone | ferry, port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Car or bus" | the screen moved 58 px down under the finger at once | 2x, phone | ferry, port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jun 9 ⚓ New day Boarding · All aboard nu" | the screen moved 495 px up under the finger at once | 2x, phone | ferry: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jun 9 ⚓ New day In port · Ashore null, a" | the screen moved 495 px up under the finger at once | 2x, phone | ferry: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jun 9 ⚓ Lisbon Boarding · All aboard 10:" | the screen moved 552 px up under the finger at once | 2x, phone | ferry: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Find it" (geo) | the screen moved 78 px down under the finger at once | 2x, phone | ferry, port: Trip after + Add a day > Jun 10 ⌂ New day Land day · 9:00 am–6:00 pm Gu |
| JUMP | "Famous sights" | the screen moved 52 px down under the finger at once | 2x, phone | ferry: Trip after + Add a day > More options for this day |
| JUMP | "A bit of both" | the screen moved 52 px down under the finger at once | 2x, phone | ferry: Trip after + Add a day > More options for this day |
| JUMP | "Local favorites" | the screen moved 52 px down under the finger at once | 2x, phone | ferry: Trip after + Add a day > More options for this day |
| JUMP | "Jun 10 ⌂ Lisbon Land day · 9:00 am–6:00 " | the screen moved 607 px up under the finger at once | 2x, phone | ferry: Trip after + Add a day > Build the guide for Lisbon |
| JUMP | "Jun 9 ↗ Lisbon Leaving · Flight leaves 9" | the screen moved 586 px up under the finger at once | 2x, phone | ferry: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jun 10 ⚓ Naples In port · Ashore , all a" | the screen moved 411 px up under the finger at once | 2x, phone | ferry: Trip after Remove this day > Jun 10 ⚓ Naples In port · Ashore 420, all  |
| JUMP | "Jun 9 ⚓ New day Boarding · All aboard Gu" | the screen moved 495 px up under the finger at once | 2x, phone | ferry: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jun 9 ⚓ New day In port · Ashore , all a" | the screen moved 495 px up under the finger at once | 2x, phone | ferry: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jun 9 ↘ Lisbon Arriving · Flight arrives" | the screen moved 586 px up under the finger at once | 2x, phone | ferry: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jun 9 ↘ Lisbon Arriving · Train arrives " | the screen moved 586 px up under the finger at once | 2x, phone | ferry: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jun 9 ↘ Lisbon Arriving · Ship arrives 9" | the screen moved 586 px up under the finger at once | 2x, phone | ferry: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jun 9 ↘ Lisbon Arriving · Ferry arrives " | the screen moved 586 px up under the finger at once | 2x, phone | ferry: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jun 9 ↘ Lisbon Arriving · Car or bus arr" | the screen moved 586 px up under the finger at once | 2x, phone | ferry: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Rainy day: plan indoor sights" | the screen moved 50 px up under the finger at once | 2x, phone | ferry, port: Trip after + Add a port day > Port name, e.g. Kotor = Piraeus > More |
| JUMP | "Make it again" (memmake) | the screen moved 438 px down under the finger once the screen settled | 2x, phone | ferry, port: Journal after Memory video |
| JUMP | "Jul 7 〰 At sea At sea · No stops" | the screen moved 499 px up under the finger at once | 2x, phone | port: Trip |
| JUMP | "Jul 8 ⚓ New day In port · Ashore 8:00 am" | the screen moved 587 px up under the finger at once | 2x, phone | port: Trip after + Add a port day |
| JUMP | "Jul 7 ⚓ New day Boarding · All aboard nu" | the screen moved 519 px up under the finger at once | 2x, phone | port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jul 7 ⚓ New day In port · Ashore null, a" | the screen moved 519 px up under the finger at once | 2x, phone | port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jul 7 ⚓ New day Boarding · All aboard Gu" | the screen moved 519 px up under the finger at once | 2x, phone | port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jul 7 ↘ Lisbon Arriving · Car or bus arr" | the screen moved 610 px up under the finger at once | 2x, phone | port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jul 7 ↗ Lisbon Leaving · Flight leaves 9" | the screen moved 610 px up under the finger at once | 2x, phone | port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jul 7 ⚓ Lisbon Boarding · All aboard 10:" | the screen moved 576 px up under the finger at once | 2x, phone | port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jul 7 ↘ Lisbon Arriving · Ferry arrives " | the screen moved 610 px up under the finger at once | 2x, phone | port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jul 7 ⚓ New day In port · Ashore , all a" | the screen moved 519 px up under the finger at once | 2x, phone | port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jul 7 ↘ Lisbon Arriving · Ship arrives 9" | the screen moved 610 px up under the finger at once | 2x, phone | port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jul 8 ⌂ Lisbon Land day · 9:00 am–6:00 p" | the screen moved 631 px up under the finger at once | 2x, phone | port: Trip after + Add a day > Build the guide for Lisbon |
| JUMP | "Jul 7 ↘ Lisbon Arriving · Flight arrives" | the screen moved 610 px up under the finger at once | 2x, phone | port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jul 7 ↘ Lisbon Arriving · Train arrives " | the screen moved 610 px up under the finger at once | 2x, phone | port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jul 8 ⚓ Kotor, Montenegro, staying aboar" | the screen moved 499 px up under the finger at once | 2x, phone | port: Trip after Jul 8 ⚓ Kotor, Montenegro In port · Ashore 480, all aboard 1 |
| JUMP | "Jun 9 ↘ New day Arriving · Flight arrive" | the screen moved 529 px up under the finger at once | 1x, phone | ferry: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jun 9 ↗ New day Leaving · Flight leaves " | the screen moved 529 px up under the finger at once | 1x, phone | ferry: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jun 10 ⚓ Naples In port · Ashore 10:30 a" | the screen moved 435 px up under the finger at once | 1x, phone | ferry: Trip after Remove this day > Jun 10 ⚓ Naples In port · Ashore 420, all  |
| JUMP | "Jun 10 ⌂ New day Land day · 9:00 am–11:3" | the screen moved 627 px up under the finger at once | 1x, phone | ferry: Trip after + Add a day > Light day |
| JUMP | "Finish back at the hotel" | the screen moved 52 px down under the finger at once | 1x, phone | ferry: Trip after + Add a day > More options for this day |
| JUMP | "Add quick must-sees along the way" | the screen moved 52 px down under the finger at once | 1x, phone | ferry: Trip after + Add a day > More options for this day |
| JUMP | "Fill spare time with bonus stops nearby" | the screen moved 159 px up under the finger at once | 1x, phone | ferry: Trip after + Add a day > More options for this day |
| JUMP | "Jun 10 ⚓ Athens In port · Ashore 8:00 am" | the screen moved 563 px up under the finger at once | 1x, phone | ferry: Trip after + Add a port day > Jun 10 ⚓ New day In port · Ashore 8:00 am |
| JUMP | "Jun 9 ⚓ Lisbon In port · Ashore 10:30 am" | the screen moved 576 px up under the finger at once | 1x, phone | ferry: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jun 9 ↘ New day Arriving · Train arrives" | the screen moved 529 px up under the finger at once | 1x, phone | ferry: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jun 9 ↘ New day Arriving · Ship arrives " | the screen moved 529 px up under the finger at once | 1x, phone | ferry: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jun 9 ↘ New day Arriving · Ferry arrives" | the screen moved 529 px up under the finger at once | 1x, phone | ferry: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jun 9 ↘ New day Arriving · Car or bus ar" | the screen moved 529 px up under the finger at once | 1x, phone | ferry: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Or take metro · about 1 h 25 min" | the screen moved 50 px up under the finger at once | 1x, phone | ferry: Trip after + Add a port day > Port name, e.g. Kotor = Piraeus > Lock th |
| JUMP | "Jun 10 ⌂ Lisbon Land day · 9:00 am–11:30" | the screen moved 684 px up under the finger at once | 1x, phone | ferry: Trip after + Add a day > Light day > Jun 10 ⌂ New day Land day · 9:00 a |
| JUMP | "1:30 pm" (mealtime) | the screen moved 1748 px up under the finger at once | 1x, phone | ferry: Trip after + Add a port day > Port name, e.g. Kotor = Piraeus > Change  |
| JUMP | "Jul 7 ↗ New day Leaving · Flight leaves " | the screen moved 553 px up under the finger at once | 1x, phone | port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jul 7 ↘ New day Arriving · Flight arrive" | the screen moved 553 px up under the finger at once | 1x, phone | port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jul 8 ⚓ Athens In port · Ashore 8:00 am," | the screen moved 587 px up under the finger at once | 1x, phone | port: Trip after + Add a port day > Jul 8 ⚓ New day In port · Ashore 8:00 am, |
| JUMP | "Jul 7 ↘ New day Arriving · Car or bus ar" | the screen moved 553 px up under the finger at once | 1x, phone | port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jul 8 ⌂ New day Land day · 9:00 am–11:30" | the screen moved 651 px up under the finger at once | 1x, phone | port: Trip after + Add a day > Light day |
| JUMP | "Jul 7 ⚓ Lisbon In port · Ashore 10:30 am" | the screen moved 600 px up under the finger at once | 1x, phone | port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jul 7 ↘ New day Arriving · Ship arrives " | the screen moved 553 px up under the finger at once | 1x, phone | port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jul 7 ↘ New day Arriving · Train arrives" | the screen moved 553 px up under the finger at once | 1x, phone | port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "Jul 7 ↘ New day Arriving · Ferry arrives" | the screen moved 553 px up under the finger at once | 1x, phone | port: Trip after Sightseeing from my hotel Arriving (flight, train or ship) L |
| JUMP | "More" | the screen moved 166 px up under the finger at once | 1x, phone | port: Trip after + Add a port day > Port name, e.g. Kotor = Piraeus |
| JUMP | "Mark booked" (tixdone) | the screen moved 50 px up under the finger at once | 1x, phone | port: Trip after + Add a port day > Port name, e.g. Kotor = Piraeus |
| JUMP | "Change lunch" (mealopen) | the screen moved 50 px up under the finger at once | 1x, phone | port: Trip after + Add a port day > Port name, e.g. Kotor = Piraeus |
| JUMP | "Jul 8 ⌂ Lisbon Land day · 9:00 am–11:30 " | the screen moved 708 px up under the finger at once | 1x, phone | port: Trip after + Add a day > Light day > Jul 8 ⌂ New day Land day · 9:00 am |
| JUMP | "Or take metro · about 1 h 25 min" | the screen moved 50 px up under the finger at once | 1x, phone | port: Trip after + Add a port day > Port name, e.g. Kotor = Piraeus > ✎ Renam |
| JUMP | "✨ Suggest my tour" (suggesttour) | the screen moved 50 px up under the finger at once | 1x, phone | port: Trip after + Add a port day > Port name, e.g. Kotor = Piraeus > More |
| JUMP | "Pick Muo" | the screen moved 117 px up under the finger at once | 1x, phone | port: Choose sights, sea day (no place) after Jul 8 · Kotor, Montenegro |
| JUMP | "Pick Kavač" | the screen moved 223 px up under the finger at once | 1x, phone | port: Choose sights, sea day (no place) after Jul 8 · Kotor, Montenegro |
| STUCK | "Build the Vienna guide" (gen) | still waiting 15 s later: Finding Vienna in travel guides and maps… | 7x, phone | odd: Day plan, land day (no place); Choose sights, land day (no place); Guide, land day (no place) (+4) after Mar 7 · Vienna |
| STUCK | "Golden hour and photo spots · sunset 8:4" | still waiting 15 s later: Looking up viewpoints on the map… | 2x, phone | ferry, port: Trip after + Add a port day > Port name, e.g. Kotor = Piraeus > More ab |
| UNSTEADY | "Build the A very long name that goes on " (gen) | on the first try only (not on a second, freshly opened app): JUMP, the screen moved 585 px down under the finger at once | 3x, phone | odd: Day plan, land day (no place) after Mar 4 · A very long name that goes on and on A very long nam |
| UNSTEADY | "Golden hour and photo spots · sunset 8:4" | on the first try only (not on a second, freshly opened app): JUMP, the screen moved 50 px up under the finger once the screen settled | 2x, phone | ferry, port: Trip after + Add a port day > Port name, e.g. Kotor = Piraeus > More ab |
| UNSTEADY | "Build my trip" | on the first try only (not on a second, freshly opened app): JUMP, the screen moved 677 px down under the finger at once | 1x, phone | ferry: Home after Plan a new trip |
| UNSTEADY | "More" | on the first try only (not on a second, freshly opened app): JUMP, the screen moved 166 px up under the finger at once | 1x, phone | ferry: Trip after + Add a port day > Port name, e.g. Kotor = Piraeus |
| UNSTEADY | "About today's plan16 notes" | on the first try only (not on a second, freshly opened app): JUMP, the screen moved 50 px up under the finger once the screen settled | 1x, phone | ferry: Trip after + Add a port day > Port name, e.g. Kotor = Piraeus |
| UNSTEADY | "✨ Suggest my tour" (suggesttour) | on the first try only (not on a second, freshly opened app): JUMP, the screen moved 73 px down under the finger once the screen settled | 1x, phone | ferry: Trip after + Add a port day > Port name, e.g. Kotor = Piraeus > More |
| UNSTEADY | "1:00 pm" (mealtime) | on the first try only (not on a second, freshly opened app): JUMP, the screen moved 1480 px up under the finger at once | 1x, phone | ferry: Trip after + Add a port day > Port name, e.g. Kotor = Piraeus > Change  |
| UNSTEADY | "Make it again" (memmake) | on the first try only (not on a second, freshly opened app): DEAD, nothing a traveler can see, hear or get happened | 1x, phone | ferry: Journal after Memory video |
| UNSTEADY | "Name this day" | on the first try only (not on a second, freshly opened app): STUCK, still waiting 15 s later: Finding At sea in travel guides and maps… | 1x, phone | odd: Tour, sea day (At sea) after ✎ Rename |
| UNSTEADY | "Personalize first" (wizmore) | on the first try only (not on a second, freshly opened app): JUMP, the screen moved 677 px down under the finger at once | 1x, phone | port: Home after Plan a new trip |
| WIDE | "Port name, e.g. Kotor" | the page became 1691 px wider than the screen | 2x, phone | ferry, port: Trip after + Add a port day |

## Not pressed, not tested

- NOT TESTED: these trips were not in this run: first, example, during, rail, group.
- NOT PRESSED (101 action names no press reached): addplace, alarmopen, ashore, asknoticeok, boardcal, boardcancel, boardchange, boardsave, bonusadd, bonusskip, bookcancel, bookremove, booksearch, bumpok, busyrow, camclose, campick, camplay, celebrate, changetrip, clearanchor, clearkey, closedalt, closedday, closedmove, closedswap, cutkeep, cutok, daylen, daytitleauto, earlystart, esimback, esimbuy, esimclose, esimnext, esimopen, esimphones, esimpick, esimundo, fitadd, fitask, fitcancel, fitday, fitfix, fitfixgo, fitleave, fitmove, fittime, fixstops, follow, gotit, hrsdone, hrsopen, lateend, livealerts, livegps, livereplan, liveundo, mealreset, mealunskip, moretrips, mytrips, nextday, nightdep, offback, offclear, offlater, opentrip, orderback, orderkeep, orderreset, parsetrip, picks, pointpick, prevday, raterow, readyorderno, readyorderyes, ridechangeok, rideundo, savekey, shipcheck, shiplater, shipok, shipset, shipsnap, shiptimes, shiptype, shipuseread, sortagain, suggestok, syncnow, syncoff, tourexit, tourhere, tournext, tourpart, tourtomorrow, wxkeep, wxswap, wxundo.
- 2 controls could not be reached again after the app was put back (the steps to them did not repeat): "Taxi or car · about 38 min", "What's saved, day by day".
- NOT TESTED: 1 presses the check itself could not finish.
- Not pressed by this check: the map itself (pan, zoom, tapping a pin), drag to reorder, the phone's own Back button and system pickers (date wheel, share sheet, camera, print dialog: the app's call to each is recorded, the system screen is not driven).

## What every control did

One line per kind of control: its label, how often it was pressed, and what happened most often.

| Control | Pressed | What it did (most often) | Held to | Failures |
|---|---|---|---|---|
| aboard: "⚓ I'm staying on board today" | 1 | closes menupanel cdpanel; folds redrawn | general rules |  |
| addday: "+ Add a day" | 4 | folds redrawn; shows: "…" "…" "…" (+# lines) | general rules | 3 |
| addport: "+ Add a port day" | 4 | folds redrawn; shows: "…" "…" "…" (+# lines) | general rules | 4 |
| archive: "Archive" | 6 | fold closes; shows: "…" "…" | general rules |  |
| backack: "I understand" | 2 | removes: "…" "…" (+# lines) | general rules |  |
| bookopen: "I have a reservation" | 5 | fold closes; shows: "…" "…" "…" (+# lines) | general rules |  |
| camopen: "📷 Identify a sight by photo" | 2 | fold closes; removes: "…" "…" (+# lines) | general rules |  |
| cdpreview: "▶ Preview the day live" | 2 | fold closes; shows: "…" "…" "…" (+# lines) | general rules |  |
| celclose: "Later" | 4 | closes celebrate; removes: "…" "…" (+# lines) | general rules |  |
| celoffdl: "Download for offline" | 4 | screen: plan → trip; closes celebrate | general rules | 4 |
| coachnext: "Next" | 3 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| coachreplay: "How Kairoute works" | 3 | screen: settings → lobby; opens coach,sheet | general rules |  |
| coachskip: "Skip" | 3 | closes coach,sheet; removes: "…" "…" (+# lines) | general rules |  |
| continue: "Continue trip" | 6 | screen: lobby → plan; folds redrawn | general rules |  |
| copytrip: "Copy itinerary" | 2 | shows: "…"; copy: f#-naples-capri

Wed Jun # · At sea · At sea · No stop | general rules |  |
| dayready: "Lock this day" | 72 | shows: "…"; removes: "…" | general rules |  |
| daytitle: "✎ Rename" | 36 | shows: "…" "…"; removes: "…" "…" | general rules |  |
| daytitlecancel: "Cancel" | 36 | shows: "…" "…"; removes: "…" "…" | general rules |  |
| daytitlesave: "Save" | 36 | shows: "…" "…"; removes: "…" "…" | general rules |  |
| delask: "Delete" | 6 | shows: "…" "…"; removes: "…" | general rules |  |
| delday: "Remove this day" | 4 | folds redrawn; shows: "…" "…" "…" (+# lines) | general rules |  |
| delno: "Keep" | 3 | fold closes; removes: "…" "…" (+# lines) | general rules |  |
| deltrip: "Yes, delete" | 3 | folds redrawn; shows: "…" | general rules |  |
| film: "Watch the intro" | 6 | opens film; shows: "…" "…" "…" (+# lines) | general rules |  |
| filmclose: "Close" | 6 | closes film; removes: "…" "…" (+# lines) | general rules |  |
| filmreplay: "Replay" | 6 | (nothing) | general rules | 6 |
| freshpicks: "Fresh sights for this day only" | 4 | shows: "…" "…"; removes: "…" "…" | general rules |  |
| gen: "Build the guide" | 43 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules | 25 |
| genall: "Build the guide for Lisbon" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| geo: "Find it" | 4 | (nothing) | general rules | 4 |
| loadsample: "★ Open the example trip Athens, the " | 6 | screen: lobby → plan; folds redrawn | general rules |  |
| lobby: "Home" | 46 | screen: wizard → lobby; shows: "…" "…" "…" (+# lines) | general rules |  |
| mealdone: "Done" | 1 | removes: "…" "…" (+# lines) | general rules |  |
| mealopen: "Change lunch" | 2 | fold opens; shows: "…" "…" "…" (+# lines) | general rules | 1 |
| mealskip: "Skip lunch today" | 1 | folds redrawn; shows: "…" "…" "…" (+# lines) | general rules |  |
| mealtime: "Best fit" | 6 | folds redrawn; shows: "…" "…" "…" (+# lines) | general rules | 2 |
| memmake: "Memory video" | 4 | shows: "…" "…" "…" (+# lines); removes: "…" | general rules | 2 |
| memsave: "Save video" | 2 | file: f#-naples-capri.mp# | general rules |  |
| memshare: "Share" | 2 | share: f#-naples-capri | general rules |  |
| newtrip: "Plan a new trip" | 6 | screen: lobby → wizard; shows: "…" "…" "…" (+# lines) | general rules |  |
| offdl: "Download for offline" | 5 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| offstop: "Pause" | 1 | shows: "…" "…" "…"; removes: "…" | general rules |  |
| picksfold: "Your sights (1) Hide" | 8 | shows: "…"; removes: "…" "…" (+# lines) | general rules |  |
| piersearch: "Find it" | 12 | shows: "…"; lookup: overpass-api.de/api/interpreter | general rules |  |
| printday: "🖨 Print or save this day as PDF" | 2 | print | general rules |  |
| printtrip: "🖨 Print or save as PDF" | 4 | print; lookup: tiles.openfreemap.org/styles/positron | general rules |  |
| privacy: "Privacy" | 6 | screen: lobby → privacy; folds redrawn | general rules |  |
| rename: "Rename" | 8 | shows: "…" "…"; removes: "…" | general rules | 6 |
| renamecancel: "Cancel" | 5 | fold closes; shows: "…" | general rules |  |
| renamesave: "Save" | 5 | fold closes; shows: "…" | general rules |  |
| reset: "Start over" | 3 | shows: "…" "…"; removes: "…" | general rules |  |
| resetno: "Keep my trips" | 3 | shows: "…"; removes: "…" "…" | general rules |  |
| resetyes: "Yes, clear everything" | 3 | shows: "…"; removes: "…" "…" | general rules |  |
| restore: "Restore" | 3 | fold closes; shows: "…" "…" "…" (+# lines) | general rules |  |
| rideforce: "Take Or take metro and leave out Acr" | 1 | folds redrawn; shows: "…" "…" "…" (+# lines) | general rules |  |
| settings: "Settings" | 21 | screen: lobby → settings; folds redrawn | general rules |  |
| suggesttour: "✨ Suggest my tour" | 6 | shows: "…" | general rules | 2 |
| syncfromlobby: "Sync with another device" | 6 | screen: lobby → settings; folds redrawn | general rules |  |
| syncjoin: "I have a code" | 3 | shows: "…" "…" "…"; removes: "…" "…" | general rules |  |
| synclink: "Link this device" | 6 | shows: "…" | general rules |  |
| syncstart: "Get my code" | 3 | shows: "…"; lookup: helper/sync | general rules |  |
| terms: "Terms" | 8 | screen: lobby → terms; folds redrawn | general rules |  |
| tixdone: "Mark booked" | 5 | folds redrawn; shows: "…" "…" "…" | general rules | 1 |
| tlview: "⠿ Change the order (drag the stops)" | 2 | fold closes; shows: "…" "…" | general rules |  |
| toplan: "‹ Day plan" | 4 | screen: sites → plan; shows: "…" "…" "…" (+# lines) | general rules |  |
| tourstart: "▶ Start tour" | 2 | screen: plan → tour; folds redrawn | general rules |  |
| voicetry: "Hear this voice" | 3 | sound: wav;base#,UklGRkQDAABXQVZFZm#IBAAAAABAAEAQB#AAEAfAAAB; sound: p#-#.mp# | general rules |  |
| wizback: "Back" | 3 | folds redrawn; shows: "…" "…" "…" (+# lines) | general rules |  |
| wizcancel: "Cancel" | 12 | screen: wizard → lobby; shows: "…" "…" "…" (+# lines) | general rules |  |
| wizmore: "Personalize first" | 12 | shows: "…" | general rules | 7 |
| "+ Add a city stay" | 12 | shows: "…" "…" "…" (+# lines); a field value changes | general rules | 12 |
| "+ Add a cruise" | 12 | shows: "…" "…" "…" (+# lines); removes: "…" "…" | general rules | 6 |
| "+ Add a port" | 6 | shows: "…" "…" "…" (+# lines); a field value changes | general rules |  |
| "▶ Hear the Kotor, Montenegro briefin" | 4 | speaks: Your briefing for Thursday, July #: Kotor, Montenegr; speaks: Being aboard on time is your responsibility, so chec | general rules |  |
| "▶ Hear the Naples briefing" | 4 | speaks: Your briefing for Thursday, June #: Naples. The ship; speaks: Enjoy Naples. | general rules |  |
| "🗺 Open in Google Maps" | 2 | fold closes; removes: "…" "…" (+# lines) | general rules |  |
| "🚢 LEAVE BY all aboard 5:00 pm estim" | 2 | fold opens; shows: "…" "…" "…" (+# lines) | general rules |  |
| "12-hour (6:30 pm)" | 3 | its mark changes | general rules |  |
| "24-hour (18:30)" | 3 | its mark changes; the look of the app changes | general rules |  |
| "A bit of both" | 4 | shows: "…" "…"; removes: "…" | general rules | 2 |
| "A bit of both" | 1 | already the current choice: nothing to change | general rules |  |
| "About" | 8 | screen: privacy → settings; shows: "…" "…" "…" (+# lines) | general rules |  |
| "About today's plan16 notes" | 2 | fold opens; shows: "…" "…" "…" (+# lines) | general rules | 1 |
| "Acropolis Museum" | 2 | screen: plan → guide; folds redrawn | general rules |  |
| "Acropolis promenade (Dionysiou Areop" | 2 | screen: plan → guide; folds redrawn | general rules |  |
| "Add more details (optional)" | 6 | fold opens; shows: "…" | general rules |  |
| "Add quick must-sees along the way" | 2 | shows: "…" "…"; removes: "…" | general rules | 1 |
| "Add the port agent's phone" | 2 | fold opens; shows: "…" | general rules |  |
| "AI guide" | 8 | screen: privacy → settings; shows: "…" "…" | general rules |  |
| "All" | 4 | already the current choice: nothing to change | general rules |  |
| "All aboard" | 54 | a field value changes | general rules |  |
| "All-aboard time" | 6 | a field value changes; lookup: tiles.openfreemap.org/styles/positron | general rules |  |
| "Always quiet" | 3 | its mark changes | general rules |  |
| "Architecture" | 3 | its mark changes | general rules |  |
| "Architecture" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "Archived trips (1)" | 3 | fold opens; shows: "…" "…" "…" (+# lines) | general rules |  |
| "Areopagus (Mars Hill)" | 2 | screen: plan → guide; folds redrawn | general rules |  |
| "Arrival time" | 6 | a field value changes; lookup: tiles.openfreemap.org/styles/positron | general rules |  |
| "Arrive in Acropolis at" | 18 | a field value changes | general rules |  |
| "Arrive in Lisbon at" | 18 | a field value changes | general rules |  |
| "Arrive in town at" | 27 | a field value changes; lookup: tiles.openfreemap.org/styles/positron | general rules |  |
| "Arrive on" | 27 | a field value changes; lookup: tiles.openfreemap.org/styles/positron | general rules |  |
| "Art & museums" | 2 | its mark changes | general rules |  |
| "Art & museums" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "Automatic" | 3 | already the current choice: nothing to change | general rules |  |
| "Automatic (US dollar) Argentine peso" | 12 | a field value changes | general rules |  |
| "Beaches" | 3 | its mark changes | general rules |  |
| "Beaches" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "Bible sites" | 3 | its mark changes | general rules |  |
| "Bible sites" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "Boarding day" | 18 | a field value changes | general rules |  |
| "Book tickets ↗" | 2 | lookup: tiles.openfreemap.org/styles/positron; opens a new page: https://www.theacropolismuseum.gr/en?__cf_ | general rules |  |
| "Build my trip" | 12 | shows: "…" | general rules | 7 |
| "Build the guide" | 4 | shows: "…" "…" "…"; removes: "…" | general rules | 2 |
| "Car or bus" | 36 | shows: "…"; removes: "…" | general rules |  |
| "Car or bus" | 4 | shows: "…" "…" "…"; removes: "…" "…" | general rules | 2 |
| "Change the name" | 9 | screen: plan → trip; folds redrawn | general rules | 9 |
| "Check out at" | 6 | a field value changes; lookup: tiles.openfreemap.org/styles/positron | general rules |  |
| "Choose sights" | 2 | screen: plan → sites; folds redrawn | general rules |  |
| "Choose sights" | 8 | screen: plan → sites; shows: "…" "…" "…" (+# lines) | general rules |  |
| "Churches & faith" | 3 | its mark changes | general rules |  |
| "Churches & faith" | 3 | its mark changes | general rules |  |
| "Clara Woman, American, warm" | 3 | lookup: helper/voyage; already the current choice: nothing to change | general rules |  |
| "Clear" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "Connect another device" | 8 | screen: privacy → settings; shows: "…" "…" "…" (+# lines) | general rules |  |
| "Daniel Man, American, calm" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "Dark" | 3 | its mark changes; the look of the app changes | general rules |  |
| "Date" | 36 | a field value changes | general rules |  |
| "Date" | 6 | shows: "…" "…" "…"; removes: "…" "…" (+# lines) | general rules |  |
| "Day plan" | 21 | already the current choice: nothing to change | general rules |  |
| "Deep" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "Departure time" | 6 | a field value changes; lookup: tiles.openfreemap.org/styles/positron | general rules |  |
| "Details, day by day" | 1 | fold opens; shows: "…" "…" "…" (+# lines) | general rules |  |
| "Device voice only" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "Display" | 8 | screen: privacy → settings; shows: "…" "…" "…" (+# lines) | general rules |  |
| "e.g. a ball game, a festival, a conc" | 8 | a field value changes | general rules |  |
| "e.g. Athens, Lisbon, Nashville" | 45 | a field value changes | general rules |  |
| "e.g. Barcelona" | 24 | a field value changes | general rules |  |
| "e.g. Cruise Terminal 2" | 24 | a field value changes; lookup: tiles.openfreemap.org/styles/positron | general rules |  |
| "e.g. K7M-4RX" | 15 | lookup: tiles.openfreemap.org/styles/positron; lookup: helper/voyage | general rules |  |
| "e.g. Mediterranean 2027" | 11 | a field value changes | general rules |  |
| "e.g. one uses a cane; kids aged 8 an" | 12 | a field value changes | general rules |  |
| "e.g. Piraeus (Athens)" | 24 | a field value changes | general rules |  |
| "e.g. Rome, Nashville, Juneau" | 10 | a field value changes | general rules |  |
| "e.g. Santorini" | 60 | a field value changes | general rules |  |
| "e.g. Sun Princess" | 24 | a field value changes | general rules |  |
| "Edit itinerary" | 6 | screen: lobby → trip; shows: "…" "…" "…" (+# lines) | general rules | 2 |
| "Edit this day" | 7 | screen: guide → trip; folds redrawn | general rules | 1 |
| "Eleanor Woman, British" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "English Spanish French German Italia" | 30 | a field value changes; cursor in SELECT#w-lang | general rules |  |
| "Entrance fee not included · more" | 4 | fold opens; shows: "…" | general rules |  |
| "Famous" | 4 | shows: "…" "…"; removes: "…" "…" (+# lines) | general rules |  |
| "Famous sights" | 2 | its mark changes | general rules |  |
| "Famous sights" | 3 | shows: "…" "…"; removes: "…" | general rules | 2 |
| "Ferry" | 36 | shows: "…"; removes: "…" | general rules |  |
| "Ferry" | 4 | shows: "…" "…" "…"; removes: "…" "…" | general rules | 2 |
| "Ferry at" | 18 | a field value changes | general rules |  |
| "Fill spare time with bonus stops nea" | 2 | shows: "…" "…"; removes: "…" | general rules | 1 |
| "Finish back at the hotel" | 1 | shows: "…" "…"; removes: "…" | general rules | 1 |
| "Flight" | 36 | already the current choice: nothing to change | general rules |  |
| "Flight" | 4 | shows: "…" "…"; removes: "…" | general rules | 2 |
| "Flight at" | 27 | a field value changes; lookup: tiles.openfreemap.org/styles/positron | general rules |  |
| "Food & markets" | 3 | its mark changes | general rules |  |
| "Food & markets" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "Full day" | 2 | shows: "…" "…"; removes: "…" | general rules |  |
| "Getting around, costs and local word" | 2 | fold opens; shows: "…" "…" "…" (+# lines) | general rules |  |
| "Golden hour and photo spots · sunset" | 2 | fold opens; shows: "…" "…" "…" (+# lines) | general rules | 2 |
| "Group trip" | 8 | screen: privacy → settings; shows: "…" "…" "…" (+# lines) | general rules |  |
| "Guide" | 21 | screen: plan → guide; its mark changes | general rules |  |
| "Guide voice" | 8 | screen: privacy → settings; shows: "…" "…" "…" (+# lines) | general rules |  |
| "Half day" | 2 | shows: "…" "…" "…"; removes: "…" "…" | general rules |  |
| "Happy to walk a lot" | 3 | its mark changes | general rules |  |
| "Happy to walk a lot" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "Henry Man, British" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "Hide" | 3 | already the current choice: nothing to change | general rules |  |
| "History" | 3 | its mark changes | general rules |  |
| "History" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "Hotel name or address" | 10 | a field value changes | general rules |  |
| "Hotel near Baixa-Chiado Hotel near A" | 6 | shows: "…"; removes: "…" "…" | general rules |  |
| "Hours to sightsee" | 10 | shows: "…" "…" "…"; removes: "…" "…" | general rules |  |
| "How many people?" | 15 | a field value changes | general rules |  |
| "Include them" | 3 | lookup: helper/voyage; already the current choice: nothing to change | general rules |  |
| "Join" | 6 | shows: "…"; a field value changes | general rules |  |
| "Journal" | 21 | screen: plan → journal; shows: "…" "…" "…" (+# lines) | general rules |  |
| "Jul 7 〰 At sea At sea · No stops" | 2 | the page scrolls | general rules | 2 |
| "Jul 7 · At sea" | 4 | already the current choice: nothing to change | general rules |  |
| "Jul 7 · Our summer trip" | 5 | already the current choice: nothing to change | general rules |  |
| "Jul 7 ↗ Lisbon Leaving · Flight leav" | 2 | the page scrolls | general rules | 2 |
| "Jul 7 ↗ New day Leaving · Flight lea" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules | 1 |
| "Jul 7 ↘ Lisbon Arriving · Car or bus" | 2 | the page scrolls | general rules | 2 |
| "Jul 7 ↘ Lisbon Arriving · Ferry arri" | 2 | the page scrolls | general rules | 2 |
| "Jul 7 ↘ Lisbon Arriving · Flight arr" | 2 | the page scrolls | general rules | 2 |
| "Jul 7 ↘ Lisbon Arriving · Ship arriv" | 2 | the page scrolls | general rules | 2 |
| "Jul 7 ↘ Lisbon Arriving · Train arri" | 2 | the page scrolls | general rules | 2 |
| "Jul 7 ↘ New day Arriving · Car or bu" | 2 | the page scrolls | general rules | 1 |
| "Jul 7 ↘ New day Arriving · Ferry arr" | 2 | the page scrolls | general rules | 1 |
| "Jul 7 ↘ New day Arriving · Flight ar" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules | 1 |
| "Jul 7 ↘ New day Arriving · Ship arri" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules | 1 |
| "Jul 7 ↘ New day Arriving · Train arr" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules | 1 |
| "Jul 7 ⚓ Lisbon Boarding · All aboard" | 2 | the page scrolls | general rules | 2 |
| "Jul 7 ⚓ Lisbon In port · Ashore 10:3" | 1 | the page scrolls | general rules | 1 |
| "Jul 7 ⚓ New day Boarding · All aboar" | 2 | the page scrolls | general rules | 2 |
| "Jul 7 ⚓ New day Boarding · All aboar" | 2 | shows: "…" "…" "…"; removes: "…" "…" | general rules | 2 |
| "Jul 7 ⚓ New day In port · Ashore , a" | 2 | the page scrolls | general rules | 2 |
| "Jul 7 ⚓ New day In port · Ashore nul" | 2 | shows: "…"; removes: "…" | general rules | 2 |
| "Jul 8 · Athens" | 1 | lookup: overpass-api.de/api/interpreter; lookup: router.project-osrm.org/table/v#/driving/#.#,#.#;#.# | general rules |  |
| "Jul 8 · Kotor, Montenegro" | 4 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Jul 8 ⌂ Lisbon Land day · 9:00 am–11" | 1 | the page scrolls | general rules | 1 |
| "Jul 8 ⌂ Lisbon Land day · 9:00 am–6:" | 2 | the page scrolls | general rules | 2 |
| "Jul 8 ⌂ Lisbon Land day · 9:00 am–6:" | 4 | the page scrolls | general rules | 4 |
| "Jul 8 ⌂ New day Land day · 9:00 am–1" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules | 1 |
| "Jul 8 ⌂ New day Land day · 9:00 am–6" | 6 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules | 3 |
| "Jul 8 ⚓ Athens In port · Ashore 8:00" | 1 | the page scrolls | general rules | 1 |
| "Jul 8 ⚓ Kotor, Montenegro In port · " | 13 | shows: "…"; removes: "…" | general rules | 13 |
| "Jul 8 ⚓ Kotor, Montenegro, staying a" | 2 | the page scrolls | general rules | 2 |
| "Jul 8 ⚓ New day In port · Ashore 8:0" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules | 2 |
| "Jul 8 Athens" | 1 | folds redrawn; shows: "…" "…" "…" (+# lines) | general rules |  |
| "Jul 8 Kotor, Montenegro" | 4 | already the current choice: nothing to change | general rules |  |
| "Jun 10 · Athens" | 1 | lookup: tiles.openfreemap.org/backup_planet/#_#_pt/#/#; lookup: tiles.openfreemap.org/backup_planet/#_#_pt/#/# | general rules |  |
| "Jun 10 · Naples" | 4 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Jun 10 ⌂ Lisbon Land day · 9:00 am–1" | 1 | the page scrolls | general rules | 1 |
| "Jun 10 ⌂ Lisbon Land day · 9:00 am–6" | 2 | the page scrolls | general rules | 2 |
| "Jun 10 ⌂ Lisbon Land day · 9:00 am–6" | 4 | the page scrolls | general rules | 4 |
| "Jun 10 ⌂ New day Land day · 9:00 am–" | 2 | the page scrolls | general rules | 1 |
| "Jun 10 ⌂ New day Land day · 9:00 am–" | 6 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules | 3 |
| "Jun 10 ⚓ Athens In port · Ashore 8:0" | 1 | the page scrolls | general rules | 1 |
| "Jun 10 ⚓ Naples In port · Ashore , a" | 2 | the page scrolls | general rules | 2 |
| "Jun 10 ⚓ Naples In port · Ashore 10:" | 1 | the page scrolls | general rules | 1 |
| "Jun 10 ⚓ Naples In port · Ashore 420" | 6 | folds redrawn; shows: "…" "…" "…" (+# lines) | general rules | 6 |
| "Jun 10 ⚓ New day In port · Ashore 8:" | 2 | lookup: helper/voyage; already the current choice: nothing to change | general rules | 2 |
| "Jun 10 Athens" | 1 | folds redrawn; shows: "…" "…" "…" (+# lines) | general rules |  |
| "Jun 10 Naples" | 4 | already the current choice: nothing to change | general rules |  |
| "Jun 9 〰 At sea At sea · No stops" | 2 | the page scrolls | general rules | 2 |
| "Jun 9 · At sea" | 4 | already the current choice: nothing to change | general rules |  |
| "Jun 9 · Our summer trip" | 5 | already the current choice: nothing to change | general rules |  |
| "Jun 9 ↗ Lisbon Leaving · Flight leav" | 2 | the page scrolls | general rules | 2 |
| "Jun 9 ↗ New day Leaving · Flight lea" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules | 1 |
| "Jun 9 ↘ Lisbon Arriving · Car or bus" | 2 | the page scrolls | general rules | 2 |
| "Jun 9 ↘ Lisbon Arriving · Ferry arri" | 2 | the page scrolls | general rules | 2 |
| "Jun 9 ↘ Lisbon Arriving · Flight arr" | 2 | the page scrolls | general rules | 2 |
| "Jun 9 ↘ Lisbon Arriving · Ship arriv" | 2 | the page scrolls | general rules | 2 |
| "Jun 9 ↘ Lisbon Arriving · Train arri" | 2 | the page scrolls | general rules | 2 |
| "Jun 9 ↘ New day Arriving · Car or bu" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules | 1 |
| "Jun 9 ↘ New day Arriving · Ferry arr" | 2 | the page scrolls | general rules | 1 |
| "Jun 9 ↘ New day Arriving · Flight ar" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules | 1 |
| "Jun 9 ↘ New day Arriving · Ship arri" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules | 1 |
| "Jun 9 ↘ New day Arriving · Train arr" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules | 1 |
| "Jun 9 ⚓ Lisbon Boarding · All aboard" | 2 | the page scrolls | general rules | 2 |
| "Jun 9 ⚓ Lisbon In port · Ashore 10:3" | 1 | the page scrolls | general rules | 1 |
| "Jun 9 ⚓ New day Boarding · All aboar" | 2 | the page scrolls | general rules | 2 |
| "Jun 9 ⚓ New day Boarding · All aboar" | 2 | shows: "…" "…" "…"; removes: "…" "…" | general rules | 2 |
| "Jun 9 ⚓ New day In port · Ashore , a" | 2 | the page scrolls | general rules | 2 |
| "Jun 9 ⚓ New day In port · Ashore nul" | 2 | shows: "…"; removes: "…" | general rules | 2 |
| "K7MQ-4RX2" | 15 | lookup: tiles.openfreemap.org/styles/positron; takes the value | general rules |  |
| "Kid-friendly" | 3 | its mark changes | general rules |  |
| "Kid-friendly" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "Kilometers" | 3 | its mark changes | general rules |  |
| "Large" | 3 | its mark changes | general rules |  |
| "Leave at" | 18 | a field value changes | general rules |  |
| "LEAVE BY all aboard 5:00 pm estimate" | 2 | fold opens; shows: "…" "…" "…" (+# lines) | general rules |  |
| "Leave Lisbon at" | 9 | a field value changes | general rules |  |
| "Light" | 3 | its mark changes; the look of the app changes | general rules |  |
| "Light" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "Light day" | 2 | shows: "…" "…" "…"; removes: "…" "…" | general rules |  |
| "Limited walking" | 3 | its mark changes | general rules |  |
| "Limited walking" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "Local favorites" | 4 | shows: "…" "…"; removes: "…" | general rules | 2 |
| "Local favorites" | 4 | shows: "…" "…"; removes: "…" "…" (+# lines) | general rules |  |
| "Local favorites" | 2 | its mark changes | general rules |  |
| "Lunch: why here" | 2 | fold opens; shows: "…" | general rules |  |
| "Make my storybook" | 2 | file: f#-naples-capri-storybook.pdf | general rules |  |
| "Mar 1 · New day" | 3 | already the current choice: nothing to change | general rules |  |
| "Mar 1 · Our summer trip" | 15 | already the current choice: nothing to change | general rules |  |
| "Mar 2 · Lisbon" | 3 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Mar 3 · At sea" | 3 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Mar 4 · A very long name that goes o" | 3 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Mar 5 · <img src=x onerror=alert > &" | 3 | shows: "…"ZÜRICH"…" "…"Zürich"…" "…"Zürich"…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Mar 6 · Nowhereville-That-Does-Not-E" | 3 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Mar 7 · Vienna" | 3 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Match my device" | 6 | already the current choice: nothing to change | general rules |  |
| "Maya Woman, American, bright" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "Miles" | 3 | already the current choice: nothing to change | general rules |  |
| "More" | 8 | fold opens; shows: "…" "…" "…" (+# lines) | general rules | 2 |
| "More about today" | 2 | fold opens; shows: "…" "…" "…" (+# lines) | general rules |  |
| "More options for this day" | 2 | fold opens; shows: "…" "…" "…" (+# lines) | general rules | 2 |
| "Must-sees" | 4 | shows: "…"; removes: "…" "…" (+# lines) | general rules |  |
| "My hotel or rental…" | 2 | shows: "…" "…"; removes: "…" | general rules |  |
| "Name or address" | 45 | a field value changes; lookup: tiles.openfreemap.org/styles/positron | general rules |  |
| "Name this day" | 144 | a field value changes; lookup: tiles.openfreemap.org/styles/positron | general rules | 1 |
| "Next" | 3 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Nights" | 45 | a field value changes | general rules |  |
| "No special needs" | 3 | already the current choice: nothing to change | general rules |  |
| "No special needs" | 3 | lookup: helper/voyage; already the current choice: nothing to change | general rules |  |
| "No theme Footsteps of Paul Faith and" | 21 | a field value changes; lookup: helper/voyage | general rules |  |
| "Off" | 6 | its mark changes | general rules |  |
| "Off" | 3 | lookup: helper/voyage; already the current choice: nothing to change | general rules |  |
| "Off the ship at" | 18 | a field value changes | general rules |  |
| "Offline" | 8 | screen: privacy → settings; shows: "…" "…" "…" (+# lines) | general rules |  |
| "On" | 18 | a field value changes | general rules |  |
| "On" | 3 | lookup: helper/voyage; already the current choice: nothing to change | general rules |  |
| "On" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "Open the day plan" | 16 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Open the guide" | 3 | screen: journal → guide; shows: "…" "…" "…" (+# lines) | general rules |  |
| "Open the journal" | 6 | screen: plan → journal; shows: "…" "…" "…" (+# lines) | general rules |  |
| "Or take metro · about 1 h 25 min" | 1 | shows: "…"; lookup: overpass-api.de/api/interpreter | general rules | 1 |
| "Or take metro · about 1 h 25 min" | 1 | shows: "…"; lookup: overpass-api.de/api/interpreter | general rules | 1 |
| "Or take metro · about 1 h 5 min" | 3 | shows: "…"; lookup: overpass-api.de/api/interpreter | general rules | 3 |
| "Panagia Kapnikarea" | 1 | screen: plan → guide; folds redrawn | general rules |  |
| "People traveling" | 15 | a field value changes; lookup: tiles.openfreemap.org/styles/positron | general rules |  |
| "Pick Aquarium Boka" | 2 | shows: "…" "…" "…"; removes: "…" "…" (+# lines) | general rules |  |
| "Pick Basilica of St. Dominic" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Bourbon Tunnel" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Capri" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Caserta" | 1 | shows: "…"; removes: "…" | general rules |  |
| "Pick Castel Capuano" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Castel dell'Ovo" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Castel Nuovo" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Castel Sant'Elmo" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Castle of San Giovanni" | 2 | shows: "…" "…" "…"; removes: "…" "…" (+# lines) | general rules |  |
| "Pick Certosa di San Martino" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Church of Our Lady of Remedy" | 2 | shows: "…" "…" "…"; removes: "…" "…" (+# lines) | general rules |  |
| "Pick Dobrota" | 1 | shows: "…" "…" "…"; removes: "…" "…" (+# lines) | general rules |  |
| "Pick Donnaregina Contemporary Art Mu" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Filangieri Civic Museum" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Fortifications of Kotor" | 2 | shows: "…" "…" "…"; removes: "…" "…" (+# lines) | general rules |  |
| "Pick Gesù Nuovo" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Herculaneum" | 1 | shows: "…"; removes: "…" | general rules |  |
| "Pick Historic Centre of Naples" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Kavač" | 1 | shows: "…" "…" "…"; removes: "…" "…" (+# lines) | general rules | 1 |
| "Pick Kotor Cathedral" | 2 | shows: "…" "…" "…"; removes: "…" "…" (+# lines) | general rules |  |
| "Pick Lovćen National Park" | 2 | shows: "…" "…" "…"; removes: "…" "…" (+# lines) | general rules |  |
| "Pick Maritime Museum of Montenegro i" | 2 | shows: "…" "…" "…"; removes: "…" "…" (+# lines) | general rules |  |
| "Pick Mrčevac" | 1 | shows: "…" "…" "…"; removes: "…" "…" (+# lines) | general rules |  |
| "Pick Muo" | 1 | shows: "…" "…" "…"; removes: "…" "…" (+# lines) | general rules | 1 |
| "Pick Museo di Capodimonte" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Museo Nazionale della Ceramica " | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Naples Cathedral and the Chapel" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick National Archaeological Museum" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Njeguši" | 1 | shows: "…" "…" "…"; removes: "…" "…" (+# lines) | general rules |  |
| "Pick Palace of Capodimonte" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Palace of Sangro of Casacalenda" | 1 | shows: "…"; removes: "…" | general rules |  |
| "Pick Palace of Sangro of Casacalenda" | 1 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick PAN Museum" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Piazza del Plebiscito and the R" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Pompeii" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Pozzuoli (ancient Puteoli)" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Prčanj" | 1 | shows: "…" "…" "…"; removes: "…" "…" (+# lines) | general rules |  |
| "Pick Salerno" | 1 | shows: "…"; removes: "…" | general rules |  |
| "Pick San Francesco di Paola Church" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Sansevero Chapel (Veiled Christ" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Sant'Anna dei Lombardi Church" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Sant'Anna di Palazzo Church" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Santa Chiara Church" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Santa Maria del Carmine Church" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Serbian Orthodox church of St N" | 2 | shows: "…" "…" "…"; removes: "…" "…" (+# lines) | general rules |  |
| "Pick Škaljari" | 1 | shows: "…" "…" "…"; removes: "…" "…" (+# lines) | general rules |  |
| "Pick Sorrento" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Spaccanapoli and the historic c" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Stazione Zoologica Anton Dohrn" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Teatro di San Carlo" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Pick Virgiliano Park" | 2 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Piraeus cruise terminals" | 2 | cursor in SELECT#f-point | general rules |  |
| "Plaka and Anafiotika" | 2 | screen: plan → guide; folds redrawn | general rules |  |
| "Port name, e.g. Kotor" | 8 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules | 2 |
| "Privacy" | 8 | screen: privacy → settings | general rules |  |
| "Rainy day: plan indoor sights" | 2 | its mark changes; lookup: overpass-api.de/api/interpreter | general rules | 2 |
| "Relaxed" | 3 | its mark changes | general rules |  |
| "Relaxed" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "Remove" | 10 | removes: "…" "…" (+# lines); a field value changes | general rules |  |
| "Remove port" | 24 | removes: "…" "…" (+# lines); a field value changes | general rules |  |
| "See it all" | 3 | its mark changes | general rules |  |
| "See it all" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "See the day plan" | 4 | screen: trip → plan; folds redrawn | general rules |  |
| "See what fits" | 1 | screen: plan → sites; folds redrawn | general rules |  |
| "Share or rebuild the trip" | 2 | fold opens; shows: "…" "…" | general rules |  |
| "Share this trip" | 6 | shows: "…"; lookup: helper/x/group | general rules |  |
| "Share with my group" | 6 | screen: lobby → settings; folds redrawn | general rules |  |
| "Ship" | 4 | shows: "…" "…" "…"; removes: "…" "…" | general rules | 2 |
| "Ship arrives" | 36 | a field value changes; lookup: tiles.openfreemap.org/styles/positron | general rules |  |
| "Ship docks" | 6 | a field value changes; lookup: tiles.openfreemap.org/styles/positron | general rules |  |
| "Ship's tour vs Kairoute" | 2 | fold opens; shows: "…" "…" "…" (+# lines) | general rules |  |
| "Shopping" | 3 | its mark changes | general rules |  |
| "Shopping" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "Short walks only" | 3 | its mark changes | general rules |  |
| "Short walks only" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "Show" | 3 | its mark changes | general rules |  |
| "Show where I am on the map" | 2 | (nothing) | general rules | 1 |
| "Sightseeing from my hotel Arriving (" | 10 | folds redrawn; shows: "…" "…" "…" (+# lines) | general rules | 10 |
| "Skip them" | 3 | its mark changes | general rules |  |
| "Standard" | 3 | already the current choice: nothing to change | general rules |  |
| "Start time" | 6 | a field value changes; lookup: tiles.openfreemap.org/styles/positron | general rules |  |
| "Staying on board this day (not going" | 1 | shows: "…" "…" "…" (+# lines); removes: "…" "…" (+# lines) | general rules |  |
| "Steady" | 3 | already the current choice: nothing to change | general rules |  |
| "Steady" | 3 | lookup: helper/voyage; already the current choice: nothing to change | general rules |  |
| "Taxi or car · about 38 min" | 1 | already the current choice: nothing to change | general rules |  |
| "Taxi or car · about 54 min" | 1 | already the current choice: nothing to change | general rules |  |
| "Tender port (small boats take you as" | 12 | its mark changes; cursor in INPUT# | general rules |  |
| "Tender port (small boats take you as" | 1 | shows: "…"; removes: "…" | general rules |  |
| "Terms of use" | 8 | screen: privacy → settings; shows: "…" "…" "…" (+# lines) | general rules |  |
| "Ticket site ↗" | 2 | lookup: tiles.openfreemap.org/styles/positron; opens a new page: https://www.theacropolismuseum.gr/en?__cf_ | general rules |  |
| "Train" | 36 | shows: "…"; removes: "…" | general rules |  |
| "Train" | 4 | shows: "…" "…" "…"; removes: "…" "…" | general rules | 2 |
| "Train at" | 18 | a field value changes | general rules |  |
| "Trip" | 21 | already the current choice: nothing to change | general rules | 7 |
| "Trip name" | 20 | a field value changes | general rules |  |
| "Trip preferences" | 8 | screen: privacy → settings; folds redrawn | general rules |  |
| "Up to 30 minutes" | 3 | already the current choice: nothing to change | general rules |  |
| "Up to 30 minutes" | 3 | lookup: helper/voyage; already the current choice: nothing to change | general rules |  |
| "Views & nature" | 3 | its mark changes | general rules |  |
| "Views & nature" | 3 | its mark changes | general rules |  |
| "Warm" | 3 | lookup: helper/voyage; already the current choice: nothing to change | general rules |  |
| "What we checked for this day 3 thing" | 2 | fold opens; shows: "…" "…" "…" (+# lines) | general rules |  |
| "What's saved, day by day" | 1 | fold opens; shows: "…" "…" "…" | general rules |  |
| "Wheelchair or scooter" | 3 | its mark changes | general rules |  |
| "Wheelchair or scooter" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "wovenleafapps@gmail.com" | 6 | lookup: tiles.openfreemap.org/styles/positron; hands over to the phone's mail app: mailto:wovenleafapps@gma | general rules |  |
| "Young kids or a stroller" | 3 | its mark changes | general rules |  |
| "Young kids or a stroller" | 3 | its mark changes; lookup: helper/voyage | general rules |  |
| "Your data" | 8 | screen: privacy → settings; shows: "…" "…" "…" | general rules |  |
| "Your days: 4 days" | 3 | fold opens; shows: "…" "…" "…" (+# lines) | general rules |  |
| "Your guide's voice" | 3 | lookup: helper/voyage; already the current choice: nothing to change | general rules |  |
| "Zoom in" | 2 | (nothing) | general rules | 2 |
| "Zoom out" | 2 | (nothing) | general rules | 2 |
