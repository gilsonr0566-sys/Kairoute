# Beta 2 test trips (baseline)

The saved test trips the engine suites plan from, so a clean checkout can run them (the release gate copies these into
`tools/beta2/snapshots/`, then rebuilds the sample trip and the no-AI trips fresh on top). Test trips only: the 20-city
list (`g01`-`g20`, made by `tools/beta2/live-trip.cjs`, which needs the internet), live trips, the sample cruise and its
variants. No traveler's own trip and no personal data belong here. Refresh after a change to what the app saves:
`node tools/beta2/live-trip.cjs`, `./build.sh && node tools/beta2/snapshot.cjs && node tools/beta2/noai-trips.cjs`, then
copy `tools/beta2/snapshots/*.json` here.
