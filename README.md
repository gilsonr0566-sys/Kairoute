# Kairoute

**Be your own guide.** A self-guided tour app: plan each day of a trip, walk the best route between the sights, and hear the story at every stop.

Live site: https://gilsonr0566-sys.github.io/Kairoute/

## How it's built

The app is a single web page, `index.html`, assembled from `src/` by `./build.sh`:

- `src/shell.html` – page layout and styles
- `src/data.js` – the built-in Barcelona guide
- `src/main.js` – the app

Trips are saved in the browser on each device.

## What works where

- **On this website:** planning, the Barcelona guide, tour mode, follow-me GPS, and speech using the browser's own voice.
- **AI features** (guides for new cities, reading itinerary photos, asking the guide, adding places): these work in the Claude preview today. On the website they need a small server and an Anthropic API key, which is the next step.

## Idea garden

Future ideas (live guides on call, earbud whisper mode, pilgrim passport, legacy mode, cruise-line and hotel editions, and more), researched with partners, costs, legal notes and a recommended order: see [docs/IDEA-GARDEN.md](docs/IDEA-GARDEN.md). Nothing there is being built until it is picked.
