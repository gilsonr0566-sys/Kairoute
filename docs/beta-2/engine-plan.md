# Beta 2 engine: build plan

Scope: the planning engine only (see "What Beta 2 changes, and what stays as is" in [lessons-from-the-old-engine.md](lessons-from-the-old-engine.md)). Every screen keeps calling `buildPlan(d)` and gets a plan in the same shape it gets today.

## The engine's steps, in plain English (full list, for Richard's OK before more is built)

Each step reads only what the steps before it produced. Steps 9 to 15 run one day at a time, in date order; a day sees only the finished days before it and the locked days. **(new)** marks a step that wasn't in the list before.

**Gather**
1. **Know our resources: the places database.** Every place found for any traveler, stored once, amended and never rebuilt, with its source and when it was last checked. Free sources only. *Closes #10 names (fixed ids), #9 small places (one-source places kept), #19 spend.*
2. **Collect the pieces into the trip bucket.** From the database first, outside sources only for what's missing; the bucket lists what's still missing, and nothing is looked up after this. *Closes #1 drift, #2 lookups mid-plan.*
3. **Sort the pieces into groups and sites.** *Closes #4 repeats of "Included" sights.*
4. **Label every piece with its categories.** *Lists and plans read one set of labels.*
5. **(new) Check each piece for each date.** Visit length (never shorter than its story takes), opening hours and closed days for that date, last entry, timed shows, tickets to book ahead, indoor or outdoor, where the entrance is, step-free access, and the day's forecast. *Closes #13 closed sights, short visit times.*
6. **(new) Read the traveler's wishes.** Picks, hearted days, cleared days, a dragged order, booked tables, ride choices, pace, walking, interests, religious sites on or off. Every change to picks comes through one "move sight" action. *Closes #6 swap bug, #7 typed times lost.*

**Plan**
7. **Set each day's window** (ship, boarding, flight and train cut-offs; same-day fly-in). *Closes #8; Rule #2.*
8. **Lock the hearted days first.** Their sights, order and restaurants are claimed before anything else. *Replaces the heart-lock patch layer.*
9. **Give each pick its day.** Earliest day it's open and fits; a group and everything inside it go together; claimed once. *Closes #3 order of planning, #4 repeats.*
10. **Order each day by route.** Shortest, easiest path; a dragged order is kept; ties broken the same way every time. *Closes #1, #5 zig-zags.*
11. **Fit the day.** Hours and the hard end; shrink long visits, quick lunch, then the least important stop gives way; put back what fits; a pick that doesn't fit moves to a later day that has it. On a rain day, an outdoor sight may swap for an indoor one **(new: was missing from the list)**. *Closes #12 short days, #13; Rule #2.*
12. **Nudge for comfort, within a cap.** *Closes #5.*
13. **Add meals.** Real places, never twice in a trip, booked tables pinned. *Closes #4.*
14. **Fill spare time.** Never past the hard end, never on a cleared or hearted day; a leaving day keeps a few nearby sights for itself.
15. **(new) Choose each ride.** One list of choices per leg (walk, taxi, train, ferry...), the same list the buttons show; real timetables only set the clock. *Closes #11 labels without buttons, #1.*

**Check and explain**
16. **Write the timeline and check safety.** If a real ride time makes a stop late or unsafe, flag it and say why; never quietly reshuffle. Final ship, train and flight margin check. *Rule #2, #1.*
17. **(new) Explain the plan.** What didn't fit and why, what moved to another day, what's closed today and which day it's open. Nothing ever disappears silently. *Replaces the "taken off this day" patch layer.*
18. **(new) Running late.** During the day, re-plan from where the traveler is now, through the same steps 10 to 16 with a new start point and time. *Keeps the old running-late feature on the new engine.*

**Plug in and prove**
19. **(new) Keep one copy.** The plan is kept once, labelled by its bucket; same bucket, same plan. *Closes #21, replaces the shown-plan replay and renamed-id layers.*
20. **Plug into the app and remove the five patch layers.** The screens get plans in the shape they use today. *Closes #17 test code in the app.*
21. **Prove it.** Old vs new on all 9 test trips with one scorer; the same trip with pieces arriving in shuffled orders must give the same plan; safety margins never closer than Beta 1; existing publish checks pass. *Closes #14, #15.*

**Outside the engine, by agreement:** #16 hidden errors and #18 the huge file in the screen code stay as they are for now; #7 was already fixed in Beta 1.

## The places database (step 1 in detail)

**What it holds.** One entry per real place: sights, restaurants, hotel areas, cruise terminals, airports, stations, and the ride times between places. Each entry is keyed by a stable id (Wikidata id or OpenStreetMap id where there is one), never by name, so a renamed or translated place stays the same entry.

**Every entry carries:** the facts (where it is, hours, length of visit, fame, closed to the public or not), which source said so, when it was found, and when it was last checked. Facts that change go stale on a timetable: opening hours and restaurants are re-checked after about 30 days, ride timetables per season, a famous sight's location never.

**Amended, never rebuilt.** A new find is added. A better source updates just that fact and keeps the history. A place that turns out not to exist, or to be closed for good, is marked, not deleted, so it can never sneak back in from another source.

**Free sources that find new pieces (all already in use, no new costs):**
- Sights and fame: Wikivoyage (English and local), Wikidata, Wikipedia, UNESCO (through Wikidata)
- Map places, hours, restaurants, ports and stations: OpenStreetMap (through Photon, Overpass and Nominatim)
- Rides: open timetables (Transitous) and OpenStreetMap train, ferry, metro and bus lines; street routes from the free routers
- Weather: Open-Meteo
- Ratings: Kairoute travelers' own ratings, and Google ratings inside the free monthly allowance (900 a month, already capped)
- Ship times: the traveler's own booking (no paid cruise data)

**Where it's stored, at no cost.** The database lives as plain data files, one per city, in the Kairoute repository, published with the app on GitHub Pages. That costs nothing, keeps a full history of every change, and phones can keep a city's file for offline use. New finds from the helper are folded in by a scheduled job. This also reads far less from Cloudflare storage, which was trending over the plan's included amount. No new paid service is used. Only public places go in it, never anything about a traveler (names, bookings, their own trips stay on their device).

## 1. Shape of the new engine

`src/engine/` holds plain files with no access to the page, the network, storage or the app's global variables. Each file has one job:

| File | Job |
|---|---|
| `bucket` (in the app: `src/features/zz-engine-bucket.js`) | Fills the **trip bucket**: one frozen collection of everything a plan may use: the trip, each city's guide, ride answers, ratings, forecast, today's date. Ids are stable; names are display only. |
| `window.js` | The day's window: start, hard end, head and tail steps (bags, rides to the ship, train or plane), every safety time. Missing times return an error, never a guess. |
| `travel.js` | Minutes between two places. Two answers: a **stable estimate** (distance, walking limit, guide's own ride note), used for choosing and ordering, and the **live time** (real ride answers), used only for the clock. |
| `hours.js` | Opening hours, closed days, last entry. One check every stop passes. |
| `groups.js` | Step 3: sorts every piece into a group or a site, from map boundaries and the square rule; a group's visit claims everything inside it. |
| `tags.js` | Step 4: every piece's categories, and one sort and filter the screens and planner share. |
| `ledger.js` | The trip-wide record of what's used: each sight and each restaurant claimed once. |
| `assign.js` | Which picked sights go on which day: hearted days first (locked), then days in date order; a sight goes to the earliest day it fits. |
| `route.js` | Best route order for a day: exact for up to 9 stops, otherwise nearest-neighbour plus 2-opt, with a fixed tie-break (by id) so the answer never depends on input order. |
| `fit.js` | All or something: shrink long visits, try quick meals, then drop by worth (traveler's pick > must-see > fame), protecting the day's main area. Then put back what truly fits. |
| `nudge.js` | Crowds, midday heat and forecast choose between orders only within the capped extra riding (15 min or a fifth; forecast 30 min or a third). |
| `meals.js` | Lunch and dinner where you are, from real restaurants, never twice in a trip; booked tables pinned. |
| `fill.js` | Optional stops and quick sights on the way, in spare time, never past the hard end, never on a cleared or hearted day. |
| `timeline.js` | Turns the chosen order into the timed day with live ride times; flags (never hides) a stop that would now be late or unsafe. |
| `plan.js` | Front door: `planTrip(snapshot) -> plans for every day`. Same snapshot in, same plans out. |

`src/engine/adapter.js` is the only file that touches the old app: it builds the snapshot from the app's state, calls `planTrip`, and hands each screen its day in the old plan shape. When Beta 2 goes in, the five steady-plan layers (`seen-plan.js` replay, the heart-lock replay inside the planner, taken-off repair, late day-trip re-giving, renamed-id following) are removed, and the heart becomes a plain "keep these picks and this order" input.

The engine files also load in Node, so its tests run in seconds without a browser or the internet.

## 2. How it's proven (old vs new, same trips, same scorer)

1. **Buckets.** `tools/beta2/snapshot.cjs` opens the current app offline in a test browser and saves, for each test trip, the full trip bucket and the old engine's plans. Trips: the sample Greece cruise, Corpus Christi, a Barcelona train arrival, short port stops, rainy days, empty days, and no-AI guides built from saved source data (Paris, Nassau, a private island, Naples, Messina).
2. **One scorer** (`tools/beta2/score.cjs`) grades any plan, old or new, on: picks kept, must-sees kept, minutes riding, doubling back, closed or late stops, repeats across the trip, minutes of margin before every ship, train and flight, days ending late.
3. **Pass bar for Beta 2:**
   - safety margin never smaller than Beta 1 on any day, and never under the rule (45 min port days, etc.);
   - zero closed stops, zero repeats, zero late days;
   - picks kept equal or better in total, and no day loses a must-see Beta 1 kept unless it bought back safety;
   - riding equal or less in total.
4. **Steady by proof.** Each trip is planned with ride answers, ratings and fuller guides arriving in many shuffled orders (and with some missing). Choice and order of stops must be identical every time.
5. **No city names** in `src/engine/` (a check scans for them), no `catch` that hides an error, no network or storage calls.

## 3. Order of work

1. Snapshot tool and scorer, and a baseline report of the old engine. (This is the yardstick.) **Done Nov 18:** 6 test trips captured; the old engine scores 0 failures on them, with its tightest day finishing 11 min inside a ship or train margin.
2. Engine files, each with its own tests: window, travel, hours, route, ledger, assign, fit, meals, fill, nudge, timeline.
3. Side-by-side report: old vs new on every test trip, kept in `reports/beta2/`.
4. Adapter: plug the engine into the app on the Beta 2 branch, remove the five steady-plan layers, run the existing gate (safety net, demo flow, steadiness, speed) against it.
5. Hand Richard a Beta 2 test link once it beats the old engine on every trip.

## Holes checked against the steps (Nov 18)

Every one of the 21 failures in the lessons doc was checked against the steps. Two had no step and are now part of the plan:
- **#6 swap bug:** the picks step moves a sight with one "move" action that takes it off its old day in the same step. No screen changes a day's picks any other way.
- **#14 hand-written guides hiding gaps:** the yardstick gets no-AI test trips (guides built automatically from saved source data: a big city, a small port, a private island) before the planning steps are built.
**Done the same evening:** three no-AI test trips are now in the yardstick (`tools/beta2/noai-trips.cjs`: a big city stay, a small cruise port with a full day and a short call, a private island), and **#9** has its test (a port with no sights gets a safe day ashore). Still partly covered: **#17** the bucket is read through a test hook until it becomes the plug-in point.
