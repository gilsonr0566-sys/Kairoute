# Kairoute

**Be your own guide.** A self-guided tour app: plan each day of a trip (city stays, multi-city trips and cruise port
days), walk the best route between the sights, and hear the story at every stop.

- Beta 1 (frozen demo copy): https://gilsonr0566-sys.github.io/Kairoute/
- Beta 2 (the rewritten planning engine): https://gilsonr0566-sys.github.io/Kairoute-Beta2/

## How it's built

The app is a single web page assembled from `src/`:

- `./build.sh` builds Beta 1 into `index.html` (never commit the built `index.html` or `version.txt`).
- `./build-beta2.sh` builds Beta 2 into `beta2-site/index.html`.
- `src/shell.html` is the page layout and styles; `src/main.js` and `src/features/*.js` are the app, concatenated into
  one script (they don't parse on their own); `src/engine/*.js` is the Beta 2 planning engine (`KEngine`), which has no
  internet, storage or page access and names no city: every rule is general.

Trips are saved in the browser on each device (Beta 2 under its own `b2:` keys).

## The helper (Cloudflare Worker)

Everything the app looks up goes through one Cloudflare Worker, `worker/` (`kairoute-ai.rickgilson.workers.dev`):
map and encyclopedia lookups, opening hours, places to eat, timetables (Transitous), weather, and the AI jobs. There is
no Anthropic key and no other server. Most lookups are free public sources, kept in the Worker's KV store and shared by
every traveler.

AI (Workers AI) is controlled in `worker/wrangler.toml`:

- `AI_ON`: the master switch. It is `"0"` (OFF) by Richard's order of Nov 21, 2026: no AI is used without his
  explicit consent. `"0"` makes every AI call refuse. Never deploy with `"1"` unless he has said yes.
- `AI_MODE = "minimal"`: the AI does only the two jobs nothing else can do (reading a traveler's own words or booking
  photo into days, and writing a city's stop narration from the real places found); everything else
  answers "saving its AI for now". The daily cap is 3,000 neurons, and `MONTH_EXTRA_NEURONS = "0"` allows no paid AI
  past the free daily allowance.
- `VOICE_LIVE = "0"`: no live AI voice for travelers.

`https://kairoute-ai.rickgilson.workers.dev/status` shows the live switch, mode and today's use.

The helper deploys with `.github/workflows/worker-deploy.yml` (on a push to `main` that touches `worker/`, or by hand),
after the offline security and spend checks in `tools/worker-check.mjs`, and checks that the live `/status` matches
`wrangler.toml`. Tests never use the AI.

## Testing Beta 2

The saved test trips (`tools/beta2/snapshots/`) are not in the repository: they hold real places looked up for
real trips. They are made with the AI off, from free sources only: run the "Beta 2 live" workflow
(`.github/workflows/beta2-live.yml`, by hand from the Actions tab), which prints each new snapshot gzipped in its log
(`SNAP` lines), or on a machine with internet and Playwright run `sh build.sh && node tools/beta2/live-trip.cjs`
(`ONLY=<trip>` for one). With them in place:

```
node tools/beta2/engine-test.cjs
node tools/beta2/compare.cjs
node tools/beta2/leaks.cjs
node tools/beta2/scenarios.cjs
node tools/beta2/stress.cjs
node tools/beta2/engine-static.cjs
bash build-beta2.sh
node tools/ui/ui-check.cjs beta2-site/index.html
node tools/steps-e2e.cjs beta2-site/index.html
FULL=1 node tools/beta2/flow-check.cjs beta2-site/index.html
```

The browser checks need Playwright with Chromium. No test calls the AI.

## Releasing Beta 2

See `docs/beta-2/release.md`.
