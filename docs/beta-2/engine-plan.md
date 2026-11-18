# Beta 2 engine: build plan

Scope: the planning engine only (see "What Beta 2 changes, and what stays as is" in [lessons-from-the-old-engine.md](lessons-from-the-old-engine.md)). Every screen keeps calling `buildPlan(d)` and gets a plan in the same shape it gets today.

## The engine's steps, in plain English

How Beta 2 turns a trip into days. Each step only reads the steps before it, and the same trip always gives the same days.

1. **Fill the trip bucket.** (Richard's idea: "have a bucket, get all the pieces.") Before any planning, one bucket collects every piece: each day's times and places (hotel, port, airport, station), each city's sights and restaurants, opening hours for each date, the forecast. The bucket says what's still missing. The engine plans only from a complete bucket and never looks anything up halfway.
2. **Set each day's window.** When sightseeing can start and the hard end: all aboard minus 45 min on port days, the boarding time on boarding days, 3 h before a flight, 30 min before a train. Fixed steps (bags, the ride to the ship) come out first. A same-day fly-in with under 3 h left goes straight to the ship. Missing times stop that day with a clear message, never a guess.
3. **Lock the hearted days.** Their sights, order and restaurants are claimed first, so no other day can take them.
4. **Give each picked sight its day.** Days are handled in date order. A sight goes to the earliest day it's open and fits, and it's claimed once for the whole trip.
5. **Order each day by route.** Shortest, easiest path from the start to the end point. Must-sees don't change the order.
6. **Fit the day.** Check opening hours and the hard end. If it's too full: shorten long visits a little, try a quicker lunch, then let the least important stop go (the app's picks before the traveler's, a lone far-off stop before one in the day's main area). Then put back anything that truly fits.
7. **Nudge for comfort, within a cap.** Crowds, heat and the forecast may swap the order only if that adds no more than 15 min of riding (30 with a real forecast).
8. **Add meals.** Lunch and dinner near where you are, from real restaurants, never the same place twice in a trip. Booked tables stay at their time.
9. **Fill spare time.** Optional stops and quick sights on the way, never past the hard end, never on a cleared or hearted day.
10. **Write the timeline.** Real ride times set the clock. If a real ride time makes a stop late or unsafe, the plan flags it and says why, instead of quietly reshuffling the day.

## 1. Shape of the new engine

`src/engine/` holds plain files with no access to the page, the network, storage or the app's global variables. Each file has one job:

| File | Job |
|---|---|
| `bucket` (in the app: `src/features/zz-engine-bucket.js`) | Fills the **trip bucket**: one frozen collection of everything a plan may use: the trip, each city's guide, ride answers, ratings, forecast, today's date. Ids are stable; names are display only. |
| `window.js` | The day's window: start, hard end, head and tail steps (bags, rides to the ship, train or plane), every safety time. Missing times return an error, never a guess. |
| `travel.js` | Minutes between two places. Two answers: a **stable estimate** (distance, walking limit, guide's own ride note), used for choosing and ordering, and the **live time** (real ride answers), used only for the clock. |
| `hours.js` | Opening hours, closed days, last entry. One check every stop passes. |
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
