# What the old engine taught us

Kairoute Beta 1 (the demo copy, frozen for Fri Nov 20, 2026) was built in 8 days: Nov 10 to Nov 18, 2026, nearly 200 pull requests (#1 to #194). This page sets down what worked and what didn't, so Beta 2's engine starts with every lesson already in it. It is the spec for the Beta 2 rewrite.

Sources: the full commit history, the project's notes from every thread, and a read-through of the current engine (`src/main.js` and `src/features/`).

## What Beta 2 changes, and what stays as is

Beta 2 is **not** a rebuild of the whole app. Only the engine is rewritten: the planning core that decides which sights go on which day, groups them, puts them in order and times the day, plus the five "keep the plan steady" layers that grew around it. The new engine plugs into the app exactly where the old one sat, so everything the traveler sees keeps working.

**Rewritten (the engine):**
- Choosing which picked sights go on which day (one day per sight, all or something)
- Grouping and ordering a day's stops (route first, capped nudges for crowds, heat and weather)
- Fitting the day: opening hours, visit lengths, what gives way when time runs out
- Placing meals and optional stops, with no repeats across the trip
- The day's timeline, including every ship, train and flight safety time
- The steady-plan layers (shown-plan replay, heart-lock replay, taken-off list, late day-trip re-giving, renamed-id following), replaced by a planner that gives the same answer every time

**Stays as is (plugged into the new engine):**
- Every screen: Day plan, Change stops, Guide, Tour, Trip, Journal, settings, phone and tablet layouts
- City guides and how they're built (with or without AI), stories, voice and audio tour
- Maps, ride lookups (trains, ferries, metro, taxi), ride chooser buttons
- Trip entry (step by step, typed or photo), sync between devices, offline download
- Print/PDF, money and spending, booking trains, the heart button itself, ship countdown and alarms
- The publish gate and its checks (the engine gets its own fast checks on top)

---

## Part 1. What worked (carry into Beta 2 unchanged)

These rules held up under testing and Richard's own use. Beta 2 keeps every one of them as a written rule with its own automatic check.

### Planning rules

1. **Route first.** Picked sights are put in the shortest, easiest order for the traveler. Must-sees only decide what fits in a day. They never decide the order (Richard, Nov 17).
2. **Crowds, heat and forecast weather can nudge the order, but only a little.** They can add at most 15 minutes of riding (or a fifth more). With a real forecast (rain or a heat wave) the limit is 30 minutes (or a third more). Past that, the route order wins and the plan says so (#177).
3. **Opening hours are respected.** A sight closed that day is never planned. A stop the traveler would reach after last entry doesn't fit (#45, #93).
4. **One day per sight, no place twice.** A sight belongs to one day of the trip. No restaurant is planned twice. Each day's meals depend only on the days before it (#1, #140, #170).
5. **All or something.** When the picks don't all fit, keep as many as possible: long visits shrink a little first (down to 70%, never under 1 h 30), quick meals are tried next, and only what's truly left over is flagged (#1, Nov 12).
6. **Protect the day's main area.** When something has to go, a lone far-off stop goes before one in the cluster the day is built around (Nov 12).
7. **The traveler's own picks outrank the app's.** A must-see the app added never pushes out a place the traveler ticked (#99).
8. **A hearted day is locked.** Its stops, order, optional stops and places to eat stay put until a time changes (ship, flight, train, hours, hotel). If the app has to change it, it says why (#137).
9. **A day the traveler cleared stays empty.** No optional stops are pushed onto it (#3).
10. **Meals happen where you are.** A meal that adds more than about 20 minutes of travel is penalised, and real restaurants beat generic "lunch near X" (Nov 11-12).

### Ship, train and flight safety (Rule #2: never cause a client to miss their ship)

11. **Port days end at all aboard minus 45 minutes.** No leeway for a ship, train or plane (#28).
12. **Long rides back to the ship get extra time:** the guide's ride time plus 15 minutes, and 30% more (at least 15 minutes) on the ride back (#28).
13. **Tender ports allow an hour to get ashore**; other ports, 30 minutes (#28).
14. **Boarding day: at the terminal by the boarding time,** and never later than an hour before all aboard (#96, #98).
15. **Flights: be at the airport 3 hours early; trains: 30 minutes** (dayWindow).
16. **Flying in the day the ship sails:** if less than 3 hours of sightseeing would be left, go straight to the ship, and say plainly that a late flight is the commonest way to miss a ship (#185).
17. **Missing times are an error, never a guess.** An unknown cruise port or arrival point stops that day's plan instead of guessing (#106).
18. **Ports stay at the port.** A cruise port is never moved to the city centre (#106).
19. **Never say "guarantee".** Being on board is the traveler's responsibility; the app says to confirm all aboard with the cruise line.

### Places and facts

20. **Real places only.** The AI never invents a place. Sights are checked against Wikipedia and the map; restaurants come only from map data (Nov 11).
21. **Guides without AI work.** Any city can get a guide from travel guides (Wikivoyage), Wikidata and OpenStreetMap, with day trips only where a real train or ferry gets there (#173, #176, #188).
22. **Small ports and private islands get guides too,** from single sources when that's all there is (#188, #190, #191).
23. **Fame comes from outside evidence** (how many Wikipedia languages, UNESCO, travel-guide listings), not from the AI's opinion (Nov 12).
24. **Real rides.** Trains, ferries, metros and buses come from open map and timetable data, with a taxi fallback, and every ride label matches a button the traveler can tap (#35, #39, #165).
25. **Sights closed to visitors are left out** (working residences like the Élysée) in every city (#176).

### Testing and publishing

26. **Nothing goes live without passing the gate:** code check, planner quality test, safety net (6 sample trips), demo flow, steadiness check, speed and freeze check (#6, #85).
27. **A failed publish puts the last good version back** instead of leaving the "updating" page live (#89).
28. **Tests make no AI calls** (#183), and run on recorded internet answers so they are repeatable (#101, #186).
29. **Every bug Richard finds becomes a check,** so it can never come back unnoticed (Nov 12).

### Product

30. **Offline works for the whole trip,** with one tap to download (#55).
31. **The app sits still.** A drawn page does no planning or redrawing unless the traveler acts or new information changes that day (#92). Richard, Nov 14: "Speed is perfect now."

---

## Part 2. What did not work (and the rule that replaces it)

Each item: what went wrong, why it happened, and the rule Beta 2 follows from day one.

### 1. Plans drifted as information arrived
- **What went wrong:** A day's stops moved, swapped or disappeared after the traveler had already seen the plan. Phone and tablet could show different plans for the same day. Offline plans differed from online ones.
- **Why:** The planner used whatever ride times, ratings and fuller guides had arrived *so far*. The same trip planned at two moments gave two answers. Instead of fixing that, five freeze-and-repair layers were stacked on top: remembering the shown plan and replaying it (with a list of 34 fields to ignore), the heart lock, "taken off this day", re-giving day trips late, and following sights through renamed ids.
- **Beta 2 rule:** **The same inputs always give the same plan.** Which sights go on which day, and in what order, is decided only from stable facts (where places are, opening hours, the day's times, the traveler's picks). Ride answers that arrive later can only refine the clock times, never reshuffle the day, unless a stop would become unsafe or closed. Then the plan says what changed and why. No freeze layers needed.

### 2. The planner fetched data while it planned
- **What went wrong:** Planning a day could start internet lookups, whose answers then triggered a re-plan, which started more lookups. This caused freezes and stuck publishes.
- **Why:** Planning and fetching were mixed in the same functions, sharing one big pool of global state.
- **Beta 2 rule:** **The engine never fetches.** It is a pure calculator: trip and facts in, plans out. A separate loader collects facts first. The engine can run in a test with no internet at all.

### 3. Days depended on the order they were planned in
- **What went wrong:** A later day planned while an earlier one was half-built took a different day trip, and dinners came and went (#140).
- **Why:** Days read each other's half-finished results from shared memory.
- **Beta 2 rule:** **The whole trip is planned in one pass, in date order.** Each day sees only the finished days before it, plus the locked (hearted) days, which are placed first.

### 4. Repeats across days
- **What went wrong:** A sight or restaurant showed on two days (Madrid Jul 18 had Jul 19's picks).
- **Why:** "One day per sight" was checked in several places (picks, optional stops, quick sights on the way, meals) with different lists.
- **Beta 2 rule:** **One trip-wide ledger of what's used.** Every sight and restaurant is claimed once, in one place, and every part of the plan asks that ledger.

### 5. Zig-zag routes from crowds and heat
- **What went wrong:** Days crossed town and came back so a sight could be visited at a quieter or cooler hour (Richard, Nov 17).
- **Why:** Crowd and heat scores were mixed into the same cost as travel time, so a small comfort gain could buy a big detour.
- **Beta 2 rule:** **Route order is worked out first. Crowds, heat and forecast only choose between orders within the capped detour** (Part 1, rule 2). Built in, not added afterward.

### 6. Swapping from the "won't fit" box left a sight on two days
- **What went wrong:** Swapping a sight in from the won't-fit box never took it off its other day. Phone and tablet then differed.
- **Why:** The swap changed one day's picks directly instead of going through the one-day-per-sight rule.
- **Beta 2 rule:** **Every change to picks goes through one "move sight" action** that takes the sight off its old day and puts it on the new one, in one step.

### 7. Boarding time lost on redraw
- **What went wrong:** A boarding time the traveler typed was lost if the screen redrew before Save (#178).
- **Why:** The screen kept typed values in the page itself, and redraws rebuilt the page.
- **Beta 2 rule:** Already fixed in Beta 1 (#178), and the screens stay as they are. For the engine: **the engine reads trip facts only from the saved trip,** never from what happens to be on screen, so a redraw can never change a plan.

### 8. Same-day fly-in planned sightseeing
- **What went wrong:** A trip flying into Miami at 11:25 for a 15:30 all aboard got a sightseeing plan.
- **Why:** The boarding-day logic didn't know about a flight landing the same day.
- **Beta 2 rule:** **A day that ends at a ship, train or plane always counts every fixed step first** (arrival, bags, rides, the "be there by" time). Sightseeing gets only what's left, and under 3 hours means none (Part 1, rule 16).

### 9. Small ports and private islands got no guide
- **What went wrong:** Nassau and CocoCay showed "guide didn't come through."
- **Why:** The guide builder needed two sources to agree on each sight, and small places only have one.
- **Beta 2 rule:** **The engine plans any place that has a guide of any size, even a one-stop guide,** and a port with no sights still gets a safe day (time ashore and back to the ship).

### 10. Sight names in foreign languages
- **What went wrong:** Messina's sights showed as "Palazzo Zanca", "Quattro Fontane" (Nov 17).
- **Why:** Source names keep the local name for lesser sights. A wider rename (#184) was reverted because it shifted plans and tripped the demo gate.
- **Beta 2 rule:** **Names are display only. The engine identifies places by a stable id, never by name,** so renaming a place can never change a plan.

### 11. Ride labels without buttons
- **What went wrong:** The plan named a ride ("Train or car") that the ride chooser didn't offer.
- **Why:** The label and the button list were worked out separately.
- **Beta 2 rule:** **Every leg's label comes from the same list of choices the traveler can tap.** One source.

### 12. Short days dropped everything
- **What went wrong:** A light-day arrival dropped all four of Richard's picks (Nov 12).
- **Why:** The fitting loop gave up instead of keeping what fit.
- **Beta 2 rule:** **All or something** (Part 1, rule 5), proven by a test on 1-hour and 2.5-hour days.

### 13. Closed sights in the list
- **What went wrong:** Sights that are closed that day, or closed to the public altogether, were offered or planned.
- **Why:** Hours were checked in some steps (picks) but not others (optional stops, day trips).
- **Beta 2 rule:** **Opening hours are one check that every stop passes,** picks, optional stops, day trips and meals alike.

### 14. Hand-written guides hid gaps in the automatic path
- **What went wrong:** The demo trip runs on 11 hand-written city guides (exactly the Greece trip cities). 5 of the 6 test trips used them, so the automatic, no-AI path was barely tested. A port day on a no-AI guide had a dead end (no Build button) until Nov 18 (#194).
- **Why:** Hand-written guides were the quick way to make the demo work.
- **Beta 2 rule:** **No hand-written guides in the engine's tests.** Every test trip uses guides built the automatic way (from saved copies of real source data). Built-in guides may stay as content, never as proof.

### 15. Publishing jammed
- **What went wrong:** From Nov 17 6 PM to Nov 18, about 10 merges stacked up and none went live (#183 to #193 cancelled or failed).
- **Why:** Changes were merged faster than the 40-minute gate could check them, and several checks failed on timing races, not real bugs.
- **Beta 2 rule:** **The engine is tested on its own in seconds** (no browser, no internet), so most checks run fast. Browser checks wait for real state, never fixed delays. Beta 2 is tested on its own branch and never touches the live site until it has proven itself.

### 16. Errors swallowed silently
- **What went wrong:** About 200 places in the code catch an error and do nothing, so failures vanish instead of showing up.
- **Why:** Quick protection against crashes while building fast.
- **Beta 2 rule:** **The engine never hides an error.** Bad input gives a clear message on that day ("Add the ship times for this day"), and every unexpected error is logged so tests catch it.

### 17. Test code shipped inside the app
- **What went wrong:** About 120 test hooks and self-checks are built into the app travelers download.
- **Why:** The app was one big closure, so tests could only reach inside through hooks.
- **Beta 2 rule:** **The engine is a separate module with a plain front door** (trip and facts in, plans out). Tests call it directly. No test code in the app.

### 18. One huge file
- **What went wrong:** `main.js` is 726 KB in one file, with planning, screens, voice, rides and storage mixed together.
- **Beta 2 rule:** The rest of the app stays where it is for now (splitting it is separate, later work). **The engine is its own small files, one job each:** day window and safety times, choosing sights for each day, route order, fitting, meals, timeline. None of them touch the screen.

### 19. AI overspend
- **What went wrong:** About $4.22 of AI was charged Nov 11-17, mostly from testing. The app's own counter undercounted the real bill by about 38%.
- **Why:** Tests used live AI, and limits were checked against the app's own count, not Cloudflare's.
- **Beta 2 rule:** **The engine uses no AI at all, and nor do its tests.** Zero spend.

### 20. Fixes made for one city
- **What went wrong:** Several early fixes named one place (Pompeii leading Naples, the Corinth Canal, the Acropolis on a hearted day).
- **Why:** A bug found on one city was fixed where it showed up.
- **Beta 2 rule:** **No city names in the engine.** Every rule is general. A test checks that the engine's code contains no city or sight names.

### 21. "Remembered" plans and kept copies everywhere
- **What went wrong:** To stay fast and steady, plans were kept in several stores (a plan store, an older-plans store, a shown-plan store, a hearted copy, offline copies), each with its own rules for when it goes stale. Many of the speed and steadiness bugs came from these copies disagreeing.
- **Beta 2 rule:** **Because the plan is always the same for the same inputs, one copy is enough.** It is kept only for speed, keyed by its inputs, and can be thrown away at any time without changing what the traveler sees.

---

## How Beta 2 proves it's better

Beta 2 replaces the old engine only when it matches or beats it on the same trips:

- **Same trips, side by side:** the Greece trip, the sample cruise, Corpus Christi, Paris, Nassau, a private island, rainy days, short days and empty days.
- **Scored the same way:** sights kept, minutes riding, doubling back, safety margin before every ship, train and flight, closed stops, repeats.
- **Steady by proof:** each trip is planned with its information arriving in many different orders, and the plan must come out identical every time.
- **Safety never worse:** Beta 2 may never cut a ship, train or flight margin closer than Beta 1 on any day.

The demo copy (the live site) stays untouched through Fri Nov 20.
