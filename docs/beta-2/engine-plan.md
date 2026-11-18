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
   a. claim the day's sights (a group with everything inside it; once per trip; a pick moves only through one "move sight" action). On a stay of two or more days in one city, the picks are first split into areas (whole groups, then places close together), and each day takes whole areas, so a day never crosses town and back (Prague dry run);
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

### Dry run: a Rome day from the cruise port (Nov 18)
The sample trip's Jul 13, 2027 call (docked 07:00, all aboard 20:30, Rome about 60 km from the ship), walked through the 11 steps with the pieces already built and the old engine's plan for comparison.

What held: the window came out 07:30 to 19:45 (30 min ashore, back 45 min before all aboard), exactly as the old engine; no sight is closed that Tuesday; the old plan is back at the ship at 18:13 with 92 min to spare.

Leaks found, and how each is closed:
1. **Thin guide.** Rome's built-in guide has 6 sights and no Vatican Museums or Sistine Chapel. *Step 3 checks every bucket against the outside fame list for the area and lists famous places that are missing; a guide is never trusted just because it exists.*
2. **Group membership unknown.** No map-area answer had arrived, so St Peter's was not known to be inside Vatican City and would have been treated as a plain site (the double count Richard saw on Nov 17). *Membership is a fact with a "not yet known" state. Step 3 lists it as missing, and step 9 says so; the engine never guesses.*
3. **A group disguised as a site.** "Colosseum and Roman Forum" is one entry. *Step 1 splits a combined entry into a group (the archaeological park) and its sites (Colosseum, Roman Forum, Palatine Hill), noting a shared ticket.*
4. **Unknown hours treated as no limit.** The Colosseum has no hours in the bucket. *Open-air places (a fountain, a square) are marked "always open" on purpose; anything else with unknown hours is listed by step 3, planned only within typical daytime hours, and step 9 says "hours not confirmed, check before you go".*
5. **Measured from the wrong place.** St Paul Outside the Walls was labelled a day trip because distance was measured from the ship, though it's in Rome. *Each day has a base area (where the sightseeing happens) separate from where it starts. Labels that depend on distance (day trip, near, within reach) are worked out per day in step 2, not stored as lasting categories.*
6. **The port-day order rule wasn't written into a step.** *Step 6b: on a port day the last stop is the one nearest the way back (here, Rome's station for the train to the port), and far stops come first.*
7. **The ride to and from the ship.** The plan used a road estimate (69 min); in reality it's a train plus getting to the stations, and the last safe train decides the day. *Ride timetables found when the bucket was filled are pinned with it, so step 6 plans with the slower of the estimate and the pinned timetable; step 7 adds the last safe train and a timed taxi fallback. Because the timetable is pinned, this no longer makes plans drift.*
8. **Timed tickets.** The Colosseum needs a booked time slot. *Step 6c plans it at a time and step 9 tells the traveler to book that slot; once booked, the slot is a wish held like a booked table.*

### Dry run 2: Athens (Nov 18)
Three sample-trip days through the 11 steps (with the Rome fixes in): the arrival day (Jun 30, flight lands 10:30), a Corinth day trip (Jul 3, 10 hours) and the boarding day at Piraeus (Jul 4, all aboard 18:30).

What held: all three windows match the old engine (arrival: sightseeing from 11:45 after passport control, the ride in and check-in; boarding day: at the terminal by 17:30 at the latest, bags collected on the way; Corinth: back by 19:00). Route order on the Corinth day is sensible (Canal on the way out, Ancient Corinth, Acrocorinth, back). No closed sights.

New leaks. All five are general rules inside existing steps; none changes the plan's shape.
1. **The same ticketed site on two days.** The Theatre of Dionysus (inside the Acropolis site, same ticket) is planned on Jun 30 and the Acropolis again on Jul 4. *Step 1: membership and shared tickets are site facts; with them, step 6a claims the group once (the Rome "not yet known" rule covers missing data).*
2. **Boarding day with no boarding time.** The plan uses the latest safe time (an hour before all aboard). *Step 3 lists the boarding time as missing and the plan says it's using the latest safe time; the typed-time check asks for it.*
3. **Midday heat on an open ruin in July.** The Acropolis is planned 10:45 to 12:45, though going there first costs no extra riding. *Step 6b: between orders that ride the same, the one that keeps exposed sites out of the midday heat wins (uses the "shade or exposure" site fact).*
4. **How the traveler gets to a day trip.** The Corinth legs use a road time (75 min), but by train it's about 3 hours door to door, and the day wouldn't fit. *New wish in step 2: how you're getting around (car, taxi or tour, or public transport). Step 7 plans with that choice; if unknown, public transport where a line exists, otherwise taxi, and step 9 says which was assumed.*
5. **Lunch at a hilltop fortress.** "Lunch near Acrocorinth" is a generic meal where there are no restaurants. *Step 6c: a meal goes only where real places to eat are within walking distance; otherwise it's moved to the town before (Ancient Corinth), or the plan says to bring food.*

### Dry run 3: Prague (Nov 18)
Two land days in Prague (May 11 and 12, 2027) built with AI off from the saved free sources, through the 11 steps (Rome and Athens fixes in). Old engine baseline: both days planned, no safety faults (no ship or train that day).

What held:
- **Old Town Square is a group, the Astronomical Clock a site.** The sources list Old Town Square with the Clock, Old Town Hall, Týn Church, Jan Hus Memorial and St Nicholas, and Prague Castle with St Vitus, Golden Lane, St George's and the Old Royal Palace. The old guide builder folds a place into the nearest bigger one, so it threw away Old Town Square, St Vitus and six other members and showed Prague Castle as a single 50-minute stop. *Step 1 keeps every place, as a group with its members, and merges only on a shared id. Held.*
- **The Old Town split across both days.** The old plan has Týn Church at 9:40 on day 1, "Old Town" at 4:40 that afternoon, and the Clock and Black Madonna house on day 2. *Step 6a claims the group once. Held.*
- **Jewish Quarter shared ticket.** The Old-New Synagogue is on day 1, the Old Jewish Cemetery (same ticket) on day 2. *Athens shared-ticket rule. Held.*

New leaks:
1. **Not enough facts to find the groups.** The free sources' answer says nothing about what kind of place each one is, so the group finder found no groups on this trip. *Rule inside step 1: use Wikidata's "what it is" (square, district, castle complex) and "part of" facts. The helper already fetches both for free; the database stores them. If they're missing, the "not yet known" state applies.*
2. **The days zigzag across town.** Day 1 goes Old Town, Wenceslas Square, Vyšehrad (south), Prague Castle (northwest), the Dancing House (south again), then back to the Old Town. Day 2 does Charles Bridge, the Lennon Wall and Petřín, right next to the Castle, without it. "Earliest day it fits" causes this on a multi-day stay. *This changes a step's rule (not the number of steps): step 6a splits a city stay into areas first, and each day takes whole areas.* Rome and Athens were single port days, so this didn't show before.
3. **The Clock at 3:02 for 40 minutes.** The show is on the hour. *Rule inside step 6c: the timed-ticket slot rule covers timed shows too (arrive a few minutes before the hour).*
4. **Lunch at 2:26.** The Castle pushed lunch late. *Rule inside step 6c: lunch stays inside a fixed window (11:30 to 2:00); a stop moves before lunch is pushed out.*
5. **Every sight marked "free".** With no fee fact, the bucket tagged Prague Castle and the National Museum as free. That's confidently wrong. *Rule inside step 3: no fee fact means "price unknown", never "free". Fixed in the bucket now (a low-level piece, no planning).*
6. **No centre, no guide.** One saved source answer had no city centre, and the guide builder quietly made no guide. *Rule inside step 3: a missing piece is listed by name, never a silent blank.*

### Dry run 4: Naples cruise call (Nov 18)
The sample trip's Naples day (Mon Jul 12 2027: ashore 7:30, all aboard 18:30, back at the terminal by 17:45), through the 11 steps with every Rome, Athens and Prague rule in. Hard case: Pompeii by the Circumvesuviana train. Old engine baseline: no safety fault (back 17:34, 11 minutes inside the buffer), but it didn't pick Pompeii.

Pompeii by train (worked with the saved timetable test copy): the quick estimate says 54 minutes each way, while the timetable door to door (taxi to Porta Nolana, train, walk) says 74. From the estimate the plan would leave Pompeii at 16:35, miss the 16:30 train, catch the 17:00 one and reach the terminal at 18:06: 21 minutes past the buffer, 24 before all aboard. *Held: the Rome rules (plan with the slower of estimate and timetable, last safe train) put the traveler on the 16:30, back 17:36. Far stop first and the Athens heat rule put Pompeii at opening (9:00) in the morning.*

Also held: the old plan visits the historic centre at 7:51, rides out to Pozzuoli, then comes back to the Archaeological Museum and Sansevero, a few minutes from where it started (Prague area rule and group claim); Sansevero's timed tickets (Rome timed-ticket slots); nothing open at 7:51 (the "best time of day" site fact).

New leaks, all rules inside existing steps:
1. **One missed train must not mean a missed ship.** Here the 45-minute buffer happens to absorb one missed train because they run every 30 minutes. With hourly trains it wouldn't. *Step 7: on a ship, train or flight day, the planned return leaves at least one later departure that still makes it back before all aboard; if not, the plan leaves on an earlier one.*
2. **A ferry with no real timetable.** The Sorrento and Capri ferries have only a usual frequency, and an island has no road back. *Step 7: on a ship day a return with no timetable is planned with the full gap as the wait; a return with no other way back (an island ferry) needs a real timetable or a ship-day warning and isn't suggested by default.*
3. **Open-air but gated.** Pozzuoli's amphitheatre has no hours on record, and the Rome rule treats open-air as always open, but it's a fenced, ticketed site. *Step 3: an open-air site with a ticket or gate and unknown hours is planned within usual daytime hours (9:00 to an hour before dusk) and labelled "hours not confirmed".*
4. **Strike days.** Italian transport strikes are announced in advance; on a strike day the Circumvesuviana may not run. *Step 2 per-date facts: service closures include announced strikes; the day then plans by taxi or tour if the traveler goes that way, or keeps Pompeii off a ship day.*

Resource: one new free candidate, the Italian government's public transport strike calendar, for leak 4. Nothing paid. Other countries rely on the timetables' own service changes until a free source is found.

### Dry runs 5 to 7: Hamburg, Nassau, CocoCay, live (Nov 18)
Built from scratch with AI off on GitHub (workflow "Beta 2 live dry run", tools/beta2/live-trip.cjs). Only the helper's free lookups ran; every AI, voice, Google-rating and sync call was refused in the test. Trips: Hamburg 2-day stay (Tue/Wed May 2027), Hamburg cruise call on a Sunday, Nassau cruise call, CocoCay private island. The real source answers are saved in tools/fixtures/live/ so these trips can be rerun offline.

What the app found on its own: Hamburg 47 sights, 4 day trips, 60 real restaurants; Nassau 6 sights, 18 restaurants; CocoCay 3 spots, 4 places to eat. Old engine: no safety faults (Hamburg port back 16:55 for 17:15; Nassau 16:04 for 16:15). CocoCay: the old engine refused to plan because it couldn't find the pier, which is safe but leaves the traveler with nothing.

Held (rules already in the plan): districts and areas planned as 40 to 90 minute stops (St. Pauli as a "museum", Paradise Island), no groups found (Speicherstadt holds Miniatur Wunderland and the Maritime Museum; Prague rule: Wikidata "what it is" and "part of"); zigzag days (Prague area rule); the stadium filed as a park and visited for 40 minutes (Prague rule: kind from Wikidata); "Lunch near Itzehoe" (Athens meal rule); a shop used as Nassau's port point (second source for ports); helper ride lookups timing out 12 times in Nassau (the engine never waits on the network; taxi fallback).

New leaks, all rules inside existing steps:
1. **Wrong interest tags from loose word matches.** The Reeperbahn (red-light district) and St. Pauli were tagged "Bible"; a church and a monument were tagged "beaches". *Step 1: interests come from what a place is (Wikidata type, map tags), not from words in its name or text; adult nightlife areas get their own tag and are never offered for faith or family interests.*
2. **A small town as a day trip.** Itzehoe (nothing to see) was picked over Lübeck (UNESCO) because towns have many Wikipedia languages; the ride out was 115 minutes and back 59. *Step 1 and 5: a day trip needs travelers' evidence (Wikivoyage day-trip listing, UNESCO or listed sights there), not town fame; step 7: the same leg uses the same ride basis both ways.*
3. **Closed for good, still offered.** The Islamic Centre Hamburg was closed by the authorities in 2024 but is in the list. *Step 1: Wikidata closing dates and map "disused" tags mark a place closed for good.*
4. **No opening hours at all.** None of Hamburg's 47 sights had hours, so Sunday, Monday and evening closures can't be checked. *Step 2: per-date hours from OpenStreetMap opening hours (already fetched by the helper for restaurants); where none, the Rome unknown-hours rule and the Naples gated rule apply.*
5. **Which cruise terminal.** Hamburg has three (Altona, Steinwerder, HafenCity); the app picked Altona without saying so, and Steinwerder is across the river. *Step 3: when a port has more than one terminal and the booking doesn't say, the terminal is listed as missing and the plan uses the one farthest from the sights until it's known (ship safety).*
6. **Private island with no known pier.** The map lookup for "Perfect Day at CocoCay" finds nothing (its map name is Little Stirrup Cay). *Step 1: places carry their other names. Step 4: when everything ashore is within a short walk and no rides are needed, the day is planned from the spots' own cluster with extra buffer and a "pier not confirmed" label, instead of no plan.*
7. **"Free" on everything.** The app stores an unknown fee as 0, so the Prague fix still showed "free". *Fixed in the bucket: only an explicit "free" counts; CocoCay's paid waterpark now shows "price unknown".*
8. **Sunday-only events.** Hamburg's Fish Market (Sundays 5:00 to 9:30) suits an early Sunday port call. *Step 2 per-date facts include weekly events from the map's opening hours.*

Resources: none new. All fixes use Wikidata, OpenStreetMap and Wikivoyage, which the helper already reaches for free.

### Test gate before plugging in (Richard, Nov 18: "more testing before we drop the engine in")
Step 10 (plug in) does not start until the built engine passes all of this, AI off, side by side with the old engine on the same saved real source data (captured live like the Hamburg run, then rerun offline so results repeat):

The 20 places (approved by Richard Nov 18; each tests something specific; trips defined in tools/beta2/live-trip.cjs, batches 1 to 4):
1. Istanbul, Thu+Fri stay: ferries across two continents, mosque prayer closures
2. Vienna, Mon+Tue stay: groups inside groups, Monday closures
3. Lisbon, Mon+Tue stay: hills, trams, walking effort
4. Barcelona, Sunday cruise call: timed tickets
5. Edinburgh, August stay: hilltop castle, festival crowds
6. Kyoto, April stay: non-Latin names, early temple closings, spread-out sites
7. Le Havre for Paris, cruise call: long train, tight ship timing
8. Southampton: fly in, board next day
9. Kotor, July tender call: fortress climb, heat
10. Dubrovnik, July call: timed walls, crowds
11. Juneau, cruise call: no roads out, tours
12. Ketchikan, short call: tiny town, rain
13. Grand Turk, cruise call: almost no data
14. Mykonos, tender call into the evening: tiny streets
15. Ponta Delgada, cruise call: thin island data
16. Half Moon Cay: a second private island
17. Jerusalem from Haifa, Saturday call: Sabbath closures
18. Reykjavik, January stay: day trips, winter dark
19. Venice, Sat+Sun stay: no cars, water buses, date-based entry fee
20. Dubai, July stay: extreme heat, big distances
Also kept in the yardstick: the 9 earlier test trips (6 sample-trip snapshots, Paris, Prague, Nassau, island) and the live Hamburg, Nassau and CocoCay runs.

Pass rule (every point, every trip):
- **Zero safety failures:** no stop after the back-by time, never less than the fixed buffer before all aboard, train or flight time, the last safe train always kept, no plan on a guessed port or terminal.
- **Never worse than the old engine:** not worse on any safety measure, closed stops, repeats or lateness, and not worse on the overall score (sights kept, must-sees kept, riding, backtracking).
- **Same plan every time:** 10 runs with the data arriving in shuffled order give identical plans.
- **Explains itself:** every dropped or moved sight and every estimated fact is labelled.
- **Fast enough:** each trip plans within the time limit on a slowed phone.
- **Expected outcomes reached on their own:** tools/beta2/yardstick-expect.json lists results the general rules must produce, never hard-coded (first one: from Hamburg, Lübeck is suggested as a day trip ahead of Itzehoe).
Any failure: fix it as a general rule, then rerun all 20.

### Resources added in the dry runs (Nov 18)
No new paid sources, and no new sources at all. Every fix uses a free source the app already reaches:
- **Train timetables:** open timetables (Transitous) and OpenStreetMap rail lines, through the helper's ride lookup. Already in use.
- **Outside fame list:** Wikidata (and Wikipedia language counts), through the helper's famous-places lookup. Already in use.
- **Shared tickets and "part of" (groups):** Wikidata "part of" and "what it is", which the helper's facts lookup already fetches; Wikivoyage text names combined tickets. Existing sources, two facts now kept that weren't stored before. Where neither says, it's "not yet known", never guessed.
- **Restaurant locations:** OpenStreetMap, through the helper's places lookup. Already in use.
- **Heat check:** Open-Meteo forecast within 16 days; beyond that, a rule from month and latitude (no source needed). Already in use.
- **Strike days (Naples run):** the Italian government's public strike calendar, free. The only new candidate source so far.
- **Fees:** none added. Unknown stays "price unknown" (and the rule that fees are not included stays upfront).

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
| `assign.js` | Which picked sights go on which day: hearted days first (locked), then days in date order; on a stay of 2+ days in one city, picks are split into areas first and each day takes whole areas; then a sight goes to the earliest day it fits. |
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
