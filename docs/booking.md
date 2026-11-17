# Booking trains and ferries

## What's live (Nov 2026)

A leaving day by train or ferry, followed by the arrival in the next city by the same way, ends its Day plan with a
**Train to <city>** card (`src/features/book-ride.js`):

- **Departures that day** from the operators' published timetables (helper `/departures`, built on Transitous, the
  free worldwide planner fed by public GTFS timetables). The five nearest the planned time, with arrival and ride time.
  If that date's timetable isn't published yet (operators publish a few months ahead), the usual times for that kind of
  day are shown and labelled as such. Fewer than three trains found: no list, the booking page has them all.
- **Your train** is marked when the planned time is in the timetable; a planned time missing from the date's published
  timetable gets a gentle "check the time on your ticket" (some companies, such as iryo, publish no open timetable).
- **Book train**: opens Trainline's route page (Barcelona to Madrid, Rome to Florence...) and tells the traveler which
  date to pick. The helper's `/bookcheck` confirms the route page exists; where Trainline has none (Greece, the US) and
  for ferries, Rome2Rio opens instead (every way between any two places, with links to the company selling each ticket).
- No prices in the app: the company sets the fare and the booking page shows it before payment.
- The card never touches the plan, and an arriving answer redraws only the card.

Checks: `tools/book-check.cjs` (publish gate, mocked helper), `tools/book-live.cjs` (live site + real helper).

## Earning from bookings (partner links)

Every booking link passes through `BOOK_WRAP` in `book-ride.js`. Once a partner account exists, that one function
wraps the address in the network's tracking link and every trip earns from then on.

- **Trainline** partner program (rail across Europe). Sign-up via its affiliate network; referral commission on each
  sale (rail is typically 2-5%). Needs: business name, website (the live app), payout bank details, tax form.
- **Rome2Rio** affiliate program (its partners pay per booking made through it).
- **Omio** (trains, buses, ferries, Europe and North America): Impact, campaign 7385, 2-10% of online sales, 30-day
  cookie. A good second source once signed up (its pages block automated checks, so the app can't confirm a route page
  exists; links would need its city-id deep links from the partner dashboard).
- **Ferryhopper** (Greek islands and Mediterranean ferries): own partner program; its deep links need port codes from
  the partner dashboard.

Claude does the sign-ups; Richard provides his name, business details and bank account.

## In-app checkout (after the demo)

Picking the train and paying without leaving Kairoute needs:

1. A signed distribution agreement with a rail booking API: Trainline Partner Solutions, Omio's partner API, or a rail
   aggregator (Distribusion, Rail Europe's API). These require a business review and usually a minimum volume.
2. Live fares and seat availability through that API (prices then come from the seller, never estimated).
3. Payment: a payment provider (Stripe) or the partner's hosted checkout, plus refunds and changes.
4. Tickets: e-tickets delivered into the app and by email, kept offline on the phone.
5. Traveler details (names, passport for some routes), privacy policy and terms updates.
6. Customer support for failed bookings, cancellations and strikes.
