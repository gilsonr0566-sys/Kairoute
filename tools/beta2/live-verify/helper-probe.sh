#!/bin/sh
# What the live helper says about sights that showed wrong on the live list (Paris, Nov 24).
U=https://kairoute-ai.rickgilson.workers.dev; O=https://gilsonr0566-sys.github.io
curl -s -m 280 -H "Origin: $O" "$U/sources?city=Paris" > /tmp/paris.json
node -e '
const j = JSON.parse(require("fs").readFileSync("/tmp/paris.json")); const all = [...(j.stops||[]), ...(j.far||[])];
for (const x of all) if (/venus|milo|louvre|champs|cité|cite|concorde|monceau|hôtel de ville|samaritaine/i.test(x.name)) console.log(JSON.stringify(x).slice(0, 700));'
