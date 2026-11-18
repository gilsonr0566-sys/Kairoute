# Beta 2 engine: build plan

Scope: the planning engine only (see "What Beta 2 changes, and what stays as is" in [lessons-from-the-old-engine.md](lessons-from-the-old-engine.md)). Every screen keeps calling `buildPlan(d)` and gets a plan in the same shape it gets today.

## The engine's steps (revised Nov 18 after Richard's "rethink it before you build", for his OK)

The 21 steps are now 11. Nothing was dropped: Richard's steps (resources, collect, groups and sites, categories) all live in steps 1 and 2, and steps that did one job between them are merged so no two steps can disagree. The engine itself is steps 4 to 9: **trip bucket in, plan out**. It reads nothing else.

**Gather (before the engine runs)**
1. **Places database: describe each place once.** Fixed id; group or site, and what's inside a group; categories; the place's lasting facts (see "What we need to know about each site" below). Every fact keeps its source, how sure we are, and when it was checked. Amended, never rebuilt; places merge only when they share a fixed id. *Richard's steps 1, 3 and 4. Closes #4, #9, #10, wrong merges.*
2. **Fill the trip bucket.** This trip's places from the database (free outside sources only for what's missing or out of date, and finds go back into the database); the facts for each date (hours that day, seasonal hours, closures for services, crowds, forecast); the trip's days and times; and the traveler's wishes (picks, hearts, cleared days, dragged order, booked tables, ride choices, pace, walking, interests, and, during the day, where they are now). Kept on the device for offline. *Richard's step 2. Closes #1, #2, #7, offline differences.*
3. **Check the bucket (safeguard, new).** Every piece is checked before the engine sees it: places where they should be, times in order (docking before all aboard, dates in sequence, ship time turned into port time), visit lengths and hours that make sense, ride data within sensible limits. A bad piece is held out with its reason; a missing piece is listed; an estimated value is marked as estimated. *Closes bad ride data, "never confidently wrong".*

**Plan (the engine)**
4. **Set each day's window.** Ship, boarding, flight and train safety times; same-day fly-in goes straight to the ship. *Closes #8. Rule #2.*
5. **Suggest picks where the traveler hasn't chosen (new: the old engine did this, the list had missed it).** Sights grouped by area, one area per day where possible; a port day leads with the best-known sight within reach of the ship; hearted days untouched; cleared days stay empty.
6. **Build each day, in date order, hearted days first.** One step with four parts that share one ledger:
   a. claim the day's sights (a group with everything inside it; once per trip; a pick moves only through one "move sight" action);
   b. order by route, with crowds, heat and forecast allowed only a capped nudge; a dragged order is kept;
   c. fit the day: hours, the hard end and meals together; shrink long visits, quicker lunch, rain-day indoor swap, then the least important stop gives way; a pick that doesn't fit goes to a later day that has it;
   d. fill spare time (never past the hard end, never on a cleared or hearted day).
   *Closes #3, #4, #5, #6, #12, #13.*
7. **Write the timeline.** The traveler's ride choices and real timetables set the clock, with one list of ride choices per leg (the same list the buttons show), and a taxi fallback that still makes the ship. A late stop is flagged, never quietly reshuffled. *Closes #1, #11. Rule #2.*
8. **Final guard (safeguard).** Every rule is checked on the finished plan: nothing past the hard end, nothing closed or after last entry, nothing repeated, every ship, train and flight margin kept, no stop at an unknown place. A failure is reported loudly. It is never patched over.
9. **Explain the plan.** What didn't fit and why, what moved to another day, what's closed today and when it's open, what changed since the traveler last looked and why, and which facts are estimated. *Closes silent drops; replaces the "taken off" layer.*

**Plug in and prove**
10. **Plug into the app.** One copy of each plan, labelled by its bucket; the five patch layers removed; screens unchanged. Running late is the same engine with a new start point and time, not a separate feature. *Closes #17, #21.*
11. **Prove it.** Old vs new on all 9 test trips with one scorer; the same bucket with pieces in shuffled order gives the same plan; safety margins never closer than Beta 1; a whole trip planned within a time limit on a slowed-down test device; existing publish checks pass. *Closes #14, #15, tablet freezes.*

### Leaks closed (Nov 18, before Richard's OK)
1. **Screens only send wishes.** A screen can only add a wish to the bucket (a pick, a heart, a moved sight, a ride choice, a typed time). It never changes a plan directly. The plan is always re-made by the engine from the bucket.
2. **Each trip keeps the database version it was planned with.** A newer version is used only when the traveler chooses to refresh. One exception: a safety change (a place now closed, a port moved, a ship time corrected) always applies at once, and the plan says what changed and why. The same pinned version is shared between the traveler's devices, and a new engine release is treated the same way.
3. **If the final guard fails, the traveler gets a safe day, never a broken plan.** On a port, boarding or leaving day that is just the time ashore and back at the ship, station or airport on time; on other days a free day. Either way the plan says what went wrong, and the failure is logged for us to fix in the engine.
4. **Typed times are checked.** All aboard after docking, boarding before all aboard, a flight or train time on the right day, nothing outside a sensible range, and ship time turned into port time. A time that fails is asked again, never planned around.
5. **A bad find can't spread.** New finds go through the same bucket check before they enter the shared database, and safety-critical facts (where a port or terminal is, ship-related times) need a second source or a map match before other travelers get them.

### Second review with the leak fixes in (Nov 18)
No step merges or new steps. Three overlaps between the additions are settled, and one safeguard is added:
- **Pinned version vs filling the bucket.** Step 2 fills a trip's bucket once. Newer data goes into the database, but the trip keeps its pinned version until the traveler chooses to refresh (safety changes always apply, leak 2). Refreshing is a wish like any other.
- **Suggested picks stay put.** Once a day with the app's suggested picks has been shown, those picks are saved as that day's picks (marked as the app's). A change on one day can't reshuffle the suggestions on another; a day gets new suggestions only when the traveler asks.
- **"What changed since you last looked" can't become the old replay layer.** The last shown plan is kept only to explain differences (step 9). The engine never reads it to plan.
- **A traveler's own finds vs shared finds.** A new find that passes the bucket check is used in that traveler's trip at once; it reaches other travelers only after the stricter check in leak 5.
- **Safeguard added: the engine always finishes.** Every search in the engine has a fixed limit, and the whole trip has a time limit. If either is reached, that day gets the safe day from leak 3 and the problem is logged.

**Restaurant facts** to keep in the database alongside sites: where it is, hours for lunch and dinner, cuisine and price level, ratings (travelers' and Google's within the free allowance), closed for good or not, and how sure we are.

### What we need to know about each site
Already collected: where it is, visit length, opening hours and closed days, last entry, timed shows, book-ahead, indoor or outdoor, crowd times, cost, fame and sources, category, how to get there for day trips, closed to visitors.

Missing today, to be added to the database so the engine can decide how to handle a site instead of guessing:
- **Entrance point** (big sites are entered at one gate, not at their middle) and exit if different
- **Minimum and typical visit length** (today there is one number)
- **Timed-entry tickets** (needs a slot) vs walk-in, and **security or queue time** at busy sites
- **Seasonal hours** (summer and winter) and **closures for religious services**
- **Effort:** steps, steep climb, uneven ground (for pace, step-free access and the heat)
- **Shade or exposure** (an open ruin at midday), and **best time of day** (sunset viewpoints, morning light)
- **Outside-only** (seen from the street, not entered)
- **Dress code** (shoulders and knees covered) as a note to the traveler
- **How sure we are** of each fact, and when it was last checked

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

## Holes checked against the steps (Nov 18, numbering from the earlier 21-step list)

Every one of the 21 failures in the lessons doc was checked against the steps. Two had no step and are now part of the plan:
- **#6 swap bug:** the picks step moves a sight with one "move" action that takes it off its old day in the same step. No screen changes a day's picks any other way.
- **#14 hand-written guides hiding gaps:** the yardstick gets no-AI test trips (guides built automatically from saved source data: a big city, a small port, a private island) before the planning steps are built.
**Done the same evening:** three no-AI test trips are now in the yardstick (`tools/beta2/noai-trips.cjs`: a big city stay, a small cruise port with a full day and a short call, a private island), and **#9** has its test (a port with no sights gets a safe day ashore). Still partly covered: **#17** the bucket is read through a test hook until it becomes the plug-in point.

## Other errors from the project, checked against the steps (Nov 18, numbering from the earlier 21-step list; all now folded into the 11 steps)

Beyond the 21 in the lessons doc. Proposed additions to the engine steps are marked **add**.

Engine (proposed additions):
- **add to step 1:** wrong merges and duplicates (two museums merged into one, the same place twice under its local and English names). One entry per real place; entries merge only when they share a fixed id (Wikidata or map id), never on a loose name match.
- **add to step 15:** bad ride data (a city metro shown as "every 4 h 12 min", three near-identical metro rows). Each ride kind gets sensible limits; data outside them says "check the timetable" instead of being shown as fact.
- **add to step 17:** a rule change in the sources quietly changed an existing city's guide and plan (the small-port rule changed the Chania demo guide). When the database changes a day the traveler has already seen, the plan says what changed and why.
- **add to step 19:** online and offline plans differed. The trip's bucket is kept on the device, so offline plans come from the same bucket.
- **add to step 21:** freezes on the tablet. The new engine must plan a whole trip within a fixed time limit on a slowed-down test device.

Rest of the app (not engine steps; already handled or parked):
- No ship itinerary or flight-number lookup at trip entry (needs paid data; parked). The engine already plans on estimated times and says so.
- AI overspend and the guide failing with AI off: the engine uses no AI; guides with AI off are built from free sources (steps 1 and 2).
- Voice costs: voice is outside the engine; paid voice is off.
- Publishes blocked by the demo check, and storage use over plan: publishing and helper work, not engine work. Beta 2 is tested on its own branch, and step 1 reduces storage reads.
- Boarding time lost on redraw (#178): a screen bug, fixed in Beta 1; the engine only reads the saved trip.
