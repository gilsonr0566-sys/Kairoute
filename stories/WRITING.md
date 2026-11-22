# Writing a story for the Kairoute story library

The story library is part of the app. Each story belongs to a **sight**, not to a trip, so every traveler who visits
that sight hears the same checked story. Stories are written at build time from saved sources, checked by
`stories/tools/check-stories.mjs`, fact-checked a second time by an independent reviewer, and recorded in the five
Kokoro guide voices. Nothing here runs AI inside the app.

## Which sights get a story (general rule, any city)

1. Every sight in the app's own guide for that place (`src/cities*.js` for the built-in cities, `sites` in
   `tools/places/data/<place>.json` for the others), most famous first. Fame is the number of Wikipedia language
   editions (`editions`). Take the top 12.
2. Day-trip places the app offers from that place (`towns` in the same file) with 30 or more editions.
3. A smaller sight that sits inside or right next to a bigger one is **folded into the bigger story** as a part
   (Fold sub-sights rule, Nov 20). It never gets its own story.

## Files

- `stories/<city>/sources.json`: what to fetch (`{"key","wiki"}` for Wikipedia, add `"site":"en.wikivoyage.org"` for
  Wikivoyage, or `{"key","url","publisher"}`). Pushing it makes the "Story sources" workflow save dated text copies in
  `stories/<city>/snapshots/` (this container can't reach Wikipedia; GitHub's machines can). Britannica and World
  History Encyclopedia block the fetcher, so don't list them.
- `stories/<city>/<id>.json`: one story. Copy the shape of `stories/athens/areopagus.json`.

```
{ "id": "knossos", "v": 1, "city": "heraklion", "title": "The Palace of Knossos",
  "match": { "ids": ["knossos"], "names": ["knossos"], "wikidata": ["Q..."] },
  "checked": "YYYY-MM-DD",
  "claims": { "<key>": { "label": "supported", "says": "...", "src": ["wp-knossos"], "quote": ["word-for-word text from the snapshot"] } },
  "parts": [ { "name": "Arrival", "stand": "where to stand, no numbers",
               "paras": [ { "t": "spoken words", "c": ["<claim keys>"], "level": 1 } ] } ],
  "practical": [] }
```

- `match.ids` are the app's own site ids for that sight (from `src/cities*.js`), `match.names` are lower-case words
  that appear in the sight's name as travelers and maps write it (distinctive words only: "knossos", never
  "cathedral" or "museum" alone), `match.wikidata` the sight's Wikidata ids.

## The rules the checker enforces

- Every claim has a source key and a quote found **word for word** in that saved snapshot (copy it from the file).
- Every number in a claim is in its quote. Every number a paragraph speaks belongs to a claim the paragraph cites.
  Centuries count as years ("5th century" backs "the 400s").
- Labels: `verified` (needs an official or primary source, or two independent publishers; Wikipedia and Wikivoyage
  count as one), `supported`, `disputed`, `legend`, `tradition`, `estimate`, `scripture`. Anything you can't source is
  **cut**, never softened.
- A legend paragraph says "legend", "myth" or "the story goes". Tradition says "tradition" or "believed". Disputed
  says "historians", "scholars", "nobody knows", "probably", "may have". Estimate says "about", "around", "some".
- No "guarantee", "definitely", "certainly", "always open".
- A paragraph with no claims must be marked `"cue": true` and can only be directions or feelings: no facts, no
  numbers.
- Practical facts (hours, prices, tickets) are left out unless an official source states them; then they carry a
  `checked` date and say "usually" or "check".

## How it should sound

- A professional guide standing beside the traveler, thinking while speaking: short and varied sentences, plain
  words, present tense where natural, the odd question to the listener. American English.
- Parts in walking order. Each part opens with a `stand` line (where to stand, what to face, no numbers) and the
  first paragraph tells the traveler what is in front of them.
- Levels: `1` is the short version (about 1 minute in all), `2` adds the standard telling (about 3 minutes in all),
  `3` adds the full telling (about 5 to 6 minutes in all). Every part has at least one level-1 paragraph.
- 2 to 4 things to look at, each with a direction ("above the door", "on your left as you face the harbor"), but only
  where a source places the thing; never invent a position.
- People and events in order. Legends told as legends. Where sources disagree or don't know, say so plainly
  ("nobody knows for sure").
- Faith: where a sight has a Bible connection, quote the King James Version from the saved `kjv-*` snapshot (label
  `scripture`), and keep Scripture and later tradition apart ("Acts says..." versus "tradition says...").
- Safety cues where they matter (steep steps, heat, slippery marble), marked as cues.
- Close on one human thought, not a recap of facts.
- Hard local names: add `[word, how to say it]` pairs to `stories/<city>/say-add.json`; they are merged into
  `stories/say.json`.

## Before a story ships

1. `node stories/tools/check-stories.mjs <city>` passes (writes `check-report.json`).
2. An independent fact-check reads each story against its snapshots; every must-fix is fixed and checked again.
3. `node stories/tools/to-app.mjs` writes `src/features/stop-stories.js` (add the city's name pattern to `CITY` in
   that tool), and pushing it records every voice (workflow "Record stop scripts in the Kairoute voices").
4. It is called live only after it plays on the live Beta 2 site.
