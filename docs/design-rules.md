# Kairoute design rules

These are the rules behind the redesigned Day plan (Nov 2026), written down so every page looks and works the
same way. Every new or changed screen follows them. `tools/layout-check.cjs` checks the ones a script can check
on every page, at tablet and phone sizes in both orientations, before anything is published.

## 1. Say it once
- Each piece of information and each control appears **once per screen**: one day picker, one trip name, one
  main action, one place for each number. If two parts of a screen say the same thing, delete one.
- A list that can be tapped *is* the picker. Don't add a second picker beside it (the Trip screen's day list
  replaces the top day strip; the Guide's stop list replaces any stop dropdown).
- Don't explain what the screen already shows. No "Tap a day to edit it" or "Pick a stop to read its story"
  paragraphs. Short labels and clear buttons do that job.

- **One home for each fact** (outside UI review, Nov 20). The day's hours, time left, back-by, leave-by and all
  aboard come only from `dayFacts` in src/features/day-facts.js; the trip's length and day numbers only from
  `tripFacts` / `dayNo`. No screen works them out again. `tools/ui/ui-check.cjs` fails two screens that disagree,
  and a page that says the same sentence twice.
- Ship, train and flight days say their times once, in one line under the head: "Ashore 8:30 am · All aboard
  8:30 pm · Back at the ship by 7:45 pm".

## 2. One screen on a tablet
- On a tablet (sideways or upright) every page fits the window. The page itself never scrolls; panels scroll
  on their own (Day plan: map on the left, timeline on the right; Guide: stop list and story; Choose sights:
  tools and sights; Trip: day list and day form; Settings: sections and the open section).
- A re-render (live data, sync, a tap) never moves what the traveler is reading: each panel keeps its place.
- Phones scroll as one page, with the main content first (the timeline before the map).

## 3. The page head
Every day page (Day plan, Choose sights, Guide) opens with the same head, in this order, on one row:
1. Small grey line: date · place · kind of day (`.eyebrow`).
2. The page title (`h2`) with **✎ Rename** as a small link beside it, never a separate button.
3. On the right: the back-to-the-ship countdown on ship, train and flight days, then the page's actions, with the
   **one main action** last, in sunrise orange (section 4).

Trip-wide pages (Trip, Journal) use the same head: grey line with the trip facts, the title, ✎ Rename where
it applies, and the main action on the right. They have no day strip, because they aren't about one day.

## 4. One main action, a few tools, the rest in a menu
- **Action buttons are the same on every page** (Richard, Nov 18: "Keep the action buttons consistent").
  - The page's **one main action** sits in the head's action slot (`.headacts`), **last, top right**, beside the
    countdown when there is one. Built only with `mainBtnHTML(act, long, short)` in src/main.js, class `.mainbtn`:
    sunrise orange (`--cta`), white text, 44px tall (42px on phones, where it shows its short label).
    Today: Day plan and Guide **▶ Start the tour**, Choose sights **‹ Back to my day plan** ("‹ Day plan" on phones),
    Journal **Make my memory video**, sea days **▶ Hear the briefing**.
  - Other buttons in the head (📷 What's this?, Make my storybook, Exit tour) are plain outlined buttons
    (`.btn.ghost.small`), the same height as the main action, to its left.
  - Never a floating action bar on top of content. On phones the bottom tab bar's **Day plan** is always one tap
    away once the head scrolls off.
  - The tour's own step button (Let's go / Next) is the one exception: it stays pinned at the bottom of the stop
    card, because it moves the walk forward and must be within thumb reach.
  - `tools/layout-check.cjs` fails a page with more than one main action, a main action outside the head's
    top-right slot, head buttons of different heights, or a floating action bar.
- A short row of tools under the head (Choose sights, More). Light / Half / Full live in the hours editor, opened
  from the day's hours tile.
- Less-used options go in a drop-down **More** menu, grouped with small headings (`details.moremenu`), or in a
  fold-out list (**More about today**, **More options for this day**). New features join a menu or a fold, never a
  new row of buttons.
- Fewest taps: the thing a traveler does most is never more than one tap away.

## 5. Critical information is pinned
- On ship, train and flight days the back-to-the-ship countdown is in the head of **every** day page (Day plan,
  Choose sights, Guide, Tour). On tablets it stays on screen because the page doesn't scroll; on phones it pins
  to the top once you scroll past it. It never jumps or covers the content.
- Its colour follows the time left: green, amber at 30 min, red at 15, flashing at leave-by.
- The day strip is always within reach (Richard, Nov 14): on tablets the header stays put; on phones the strip pins to
  the top once you scroll past it, with the countdown just under it, so any day can be picked without scrolling
  back up. Picking a day from the pinned strip opens that day from its top. The pinned strip names the day, so the
  countdown doesn't repeat it.
- In the tour, the next step's button (I'm here / Next) stays reachable at the bottom of the screen.

## 6. Navigation
- A slim navigation bar with Home, Trip, Day plan, Guide, Journal and Settings: on the **left** in landscape
  (tablets, computers and phones held sideways), at the **bottom** in portrait (tablets and phones).
- It sits in exactly the same place, at the same size, on every page (`tools/nav-check.cjs`).
- Labels in slim bars, chips and buttons never wrap or get cut off (`white-space: nowrap`, sized for the widest
  label). Leave room for the real web fonts (Atkinson Hyperlegible, Outfit), which are wider than the fallback
  fonts test machines use. The layout checks swap in a wide stand-in font (`tools/wide-font.cjs`) so a label
  that would wrap on a real device fails locally too. (A phone held sideways once wrapped "Day plan" in the
  68 px bar, and only the live publish caught it.)
- The tour is a focused mode: the bar steps aside and **Exit tour** brings it back.

## 7. Same look everywhere
- Squared corners, no pills: tags 4 px, chips/buttons/fields 6–8 px, cards 10 px (`tools/pill-check.cjs`).
- Colours: deep green ink, route green for actions and selection, sunrise orange only for the main action and
  meals, red for must-sees and warnings. Ways of getting around have their own colours (section 9). Selected chips are filled route green.
- Type: page title `h2` (1.3 rem on tablets), section titles `h3`, grey `.eyebrow` labels, grey `.lede` for one-line
  notes. Cards: white, 1 px line, 10 px corners, 14 px padding on tablets.
- Nothing runs off the side of the screen, on any page, at any size (no sideways scrolling of the page).
- Buttons and list rows are at least 36 px tall so they're easy to tap; main actions 44 px or more.

## 8. Professional
- Real words, no jargon, no internal names. Times in the traveler's local time, labelled.
- **One clock**: every time on screen is in one format, 24-hour or am/pm, from Settings > Display > Clock (default:
  whatever the device uses). Code writes times as HH:MM; the page puts all text through `clockText` as it draws, so
  no screen mixes the two.
- **Same words everywhere**: a *sight* is something the traveler chose; a *stop* is a place on the day's route
  (sights, lunch, the ship). The page that chooses them is **Choose sights**; its main action **‹ Back to my day plan**.
- **Three levels of message**: a warning the traveler must act on (red, shown open); a note worth knowing (quiet line
  or closed fold with a count, "2 notes"); and nothing at all for what the screen already shows.
- Empty states say what to do next in one line and offer the one button that does it.
- Emoji only as small icons on buttons that already have words (📷 What's this?), never as decoration.

## 9. Ways of getting around
Every way of getting around has its own colour, icon and line, the same on the Day plan timeline, both maps, the
map key and in Tour mode. Never draw a leg in another kind's colour, and never use the colour alone: the icon and
the line pattern carry the meaning for colour-blind travellers.

| Kind | Light | Dark | Line | Icon |
|---|---|---|---|---|
| Walk | `#146B61` teal | `#4CC2B0` | solid | walker |
| Taxi or car | `#7B3FE4` violet | `#E3A3FF` | long dashes | car |
| Bus | `#C2185B` raspberry | `#FF5C9E` | short dashes | bus |
| Train, metro or tram | `#1F6FD1` blue | `#4D9DFF` | long rails | train |
| Ferry | `#8F5D00` amber | `#FFC23D` | dots | boat |
| Flight | `#4F5D6B` slate | `#B4C2CE` | dash-dot | plane |
| Ship | `#7A4B2A` brown | `#E0A97E` | very long dashes | ship |

- One definition: the colours are the `--t-*` tokens in `src/shell.html`. The kinds, labels, icons and line
  patterns are `LEG_KINDS` in `src/main.js`, and `legKind(leg)` says which kind a leg is. A new kind of ride gets
  a new entry in both, never a reused colour.
- Each colour reads at 4.5:1 or better on the page and on cards, in light and dark. Under normal, deuteranope,
  protanope and tritanope vision, any two ride colours stay clearly apart.
- Meal orange and must-see red are never used for lines.
- `tools/layout-check.cjs` enforces all of this: the contrast, the colour-blind separation, and that each ferry,
  bus, train, car and walk leg uses its own look on the timeline, the map and the key.

## Checklist for a new screen
- [ ] Nothing is shown twice (`node tools/ui/ui-check.cjs`). Facts come from `dayFacts` / `tripFacts`. No paragraph explains what the screen already shows.
- [ ] Fits one tablet screen, sideways and upright; panels scroll on their own.
- [ ] Same head as the other pages; one orange main action from `mainBtnHTML`, top right; less-used things in More or a fold.
- [ ] Countdown in the head on ship, train and flight days.
- [ ] Nav bar unchanged; no sideways scrolling; no pills.
- [ ] Rides use their own kind's colour, icon and line (section 9).
- [ ] `node tools/layout-check.cjs` passes.
