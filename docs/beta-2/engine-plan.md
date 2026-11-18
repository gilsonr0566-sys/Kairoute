# Beta 2 engine: build plan

Scope: the planning engine only (see "What Beta 2 changes, and what stays as is" in [lessons-from-the-old-engine.md](lessons-from-the-old-engine.md)). Every screen keeps calling `buildPlan(d)` and gets a plan in the same shape it gets today.

## The engine's steps, in plain English

How Beta 2 turns a trip into days. Each step only reads the steps before it, and the same trip always gives the same days.

1. **Know our resources: the places database.** (Richard: "what are my resources to find the pieces. Have that data base that can grow as needed and does not have to be rebuilt, just amended.") One growing database of every place, port, terminal, opening hours, ride time and restaurant Kairoute has ever found for any traveler. Each entry is stored once and reused. A new find is added, a correction updates the entry, and nothing is ever rebuilt from scratch. Each entry records which source found it and when it was last checked. Behind it sits a fixed list of free sources that find new pieces (see "The places database" below).
2. **Collect the pieces into the trip bucket.** (Richard: "have a bucket, get all the pieces", "then collect the pieces".) For this trip, the bucket is filled from the database first and goes to outside sources only for what's missing or out of date. Whatever the sources find is added to the database for the next traveler. The bucket says what's still missing, and planning runs only from a complete bucket. Nothing is looked up halfway through planning.
3. **Sort the pieces into groups and sites.** (Richard: "Which piece is a group, and which is an individual site. Old Town Square is a group. Astronomical clock is a site.") A group is a place that holds other sights: a square, an old town or district, a castle, an archaeological site, a park, an island, a museum complex. A site is one thing to see with its own story. A site inside a group is still its own stop, with its own narration, during the group's visit. Membership comes from the map's own boundaries, and for an open square, the buildings facing onto it. It's stored in the places database, so it's decided once and never changes while you plan. A group and the sights inside it are claimed together on one day, so nothing "Included" is ever scheduled twice.
4. **Label every piece with its categories.** (Richard: "add interest, must see, local favorite, and all the other categories so they can be sorted if they need to be displayed or not.") Every group and site carries its labels in the places database: the setup's interests (history, art and museums, architecture, food and markets, views and nature, churches and faith, Bible sites, shopping, beaches, kid-friendly), must-see, UNESCO, famous or local favorite, religious, open-air or indoor, quick stop, day trip, book ahead, timed show, quiet place, free, and group or site. The screens use these labels to decide what to show, and the planner reads the same ones, so a list and a plan never disagree.
5. **Set each day's window.** When sightseeing can start and the hard end: all aboard minus 45 min on port days, the boarding time on boarding days, 3 h before a flight, 30 min before a train. Fixed steps (bags, the ride to the ship) come out first. A same-day fly-in with under 3 h left goes straight to the ship. Missing times stop that day with a clear message, never a guess.
6. **Lock the hearted days.** Their sights, order and restaurants are claimed first, so no other day can take them.
7. **Give each picked sight its day.** Days are handled in date order. A sight goes to the earliest day it's open and fits, and it's claimed once for the whole trip.
8. **Order each day by route.** Shortest, easiest path from the start to the end point. Must-sees don't change the order.
9. **Fit the day.** Check opening hours and the hard end. If it's too full: shorten long visits a little, try a quicker lunch, then let the least important stop go (the app's picks before the traveler's, a lone far-off stop before one in the day's main area). Then put back anything that truly fits.
10. **Nudge for comfort, within a cap.** Crowds, heat and the forecast may swap the order only if that adds no more than 15 min of riding (30 with a real forecast).
11. **Add meals.** Lunch and dinner near where you are, from real restaurants, never the same place twice in a trip. Booked tables stay at their time.
12. **Fill spare time.** Optional stops and quick sights on the way, never past the hard end, never on a cleared or hearted day.
13. **Write the timeline.** Real ride times set the clock. If a real ride time makes a stop late or unsafe, the plan flags it and says why, instead of quietly reshuffling the day.


_Steps 5 onward are being reviewed with Richard and may change._

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
