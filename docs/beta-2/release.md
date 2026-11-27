# Releasing Beta 2

Beta 2 is built from this repository and published from a separate one, `gilsonr0566-sys/Kairoute-Beta2`, whose GitHub
Pages site is https://gilsonr0566-sys.github.io/Kairoute-Beta2/ . A release is never reported as live until the live
site is checked.

1. **All checks pass** on the commit to release (see "Testing Beta 2" in the README): engine tests, compare, leaks,
   scenarios, stress, the engine code check, the screen check, the step check and the phone flows. Commit and push it.
2. **Build:** `bash build-beta2.sh` writes `beta2-site/index.html`. Its version stamp is in the page:
   `V=$(grep -o 'var B="[^"]*"' beta2-site/index.html | head -1 | cut -d'"' -f2)`.
3. **Copy to the publishing repository:** in a clone of `Kairoute-Beta2` (on `main`, pulled), copy
   `beta2-site/index.html` to `index.html`, write the stamp to `version.txt` (`printf '%s' "$V" > version.txt`),
   commit and push.
4. **Publish:** run its Pages workflow by hand:
   `gh api -X POST repos/gilsonr0566-sys/Kairoute-Beta2/actions/workflows/pages.yml/dispatches -f ref=main`, and wait
   for that run to succeed (a failed deploy step is usually GitHub's own; run it again).
5. **Check it is live:** open the live site and confirm the page's version stamp is `$V` (the outside test's runner
   prints it), then re-check the changed behavior there.
6. **Press every button on the live build** (rule R-40): start the workflow "Every button pressed" by hand
   (target `live`, trips `all`). It presses every control of every screen on eight trips at phone and tablet size
   with real lookups, and keeps its summary on the branch `press-all-results`. It also runs by itself every night.
   A failure there is a bug on the live app today: it goes to the escaped-bug ledger and its class rule, and holds the
   next release until fixed or listed in `docs/qa/warns.json` with an owner and an end date.

The helper (`worker/`) is released on its own (see the README); a change to it is checked against the live
`/status` and with the probes in `tools/beta2/` (for example `tt-check.cjs` for timetables).
