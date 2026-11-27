# Rule links for commits made without a `Rule:` line

Every commit that changes `src/` or `worker/` after 2026-11-23 23:30 UTC names its rule in docs/qa/RULES.md with a
line `Rule: R-xx`. When a commit went in without one, link it here instead (checked by tools/truth/rules-check.cjs).
One line per commit: the start of its sha (8 or more characters), the rule(s), and why.

| Commit | Rule | Why |
|---|---|---|
| 15af25af | R-25 | Position lookups use one grid index (E.nearby): the "Needs" box on Choose sights answered in 2.5 s on a phone |
| 69b4cc4f | R-06 | Sights across the water are known from the place file (Lokrum planned as a taxi when the map server was busy) |
| 34f686c4 | R-05 | Rides to the day's own fixed steps keep the full gap (no-timetable wait) |
| 19551ccc | R-05, R-12 | No-timetable wait: half the gap going out, the full gap toward a fixed end |
| dc8192f3 | R-13 | No meal while its place is shut, for every eat source, checked on screen too (the lunch thread called it CR-MEAL-OPEN) |
| 1aea1a0c | R-30 | Saved content re-checked on every open; its body's first "Rule:" line is the rule's wording, so the R-30 line further down wasn't read |
| c1634e76 | R-15, R-16 | Day trips: no objects, one outing per place, prices only from a source (rule named in the subject line only) |
| 97c80b30 | R-32 | Nothing pinned ever covers content (its commit line says R-30, the number it had before the registry gave R-30 to saved content) |
| 622451db | R-21 | A pick the guide does not have is counted and said, never dropped in silence (its commit names no rule; linked by the where-you-are-staying thread so the gate can run) |
