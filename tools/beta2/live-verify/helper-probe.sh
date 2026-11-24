#!/bin/sh
# How long the live helper takes for a city's sources, cold and again (the app gives up sooner than this).
U=https://kairoute-ai.rickgilson.workers.dev; O=https://gilsonr0566-sys.github.io
for c in Paris Thessaloniki Lisbon Kusadasi; do for n in 1 2; do
  echo "== /sources?city=$c try $n"; curl -s -m 280 -o /tmp/h.out -w "HTTP %{http_code} in %{time_total}s, %{size_download} bytes\n" -H "Origin: $O" "$U/sources?city=$c"; head -c 300 /tmp/h.out; echo
done; done
