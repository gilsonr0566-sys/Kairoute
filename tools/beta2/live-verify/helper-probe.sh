#!/bin/sh
# Can the live helper be reached the way the published app reaches it? (status codes and the start of each answer)
O=https://gilsonr0566-sys.github.io
for src in "$O/Kairoute-Beta2/ai.json" "$O/Kairoute/ai.json"; do echo "== $src"; curl -s -m 20 "$src" | head -c 300; echo; done
U=$(curl -s -m 20 "$O/Kairoute-Beta2/ai.json" | sed -n 's/.*"url" *: *"\([^"]*\)".*/\1/p'); [ -z "$U" ] && U=$(curl -s -m 20 "$O/Kairoute/ai.json" | sed -n 's/.*"url" *: *"\([^"]*\)".*/\1/p')
echo "helper: $U"
for path in "/status" "/sources?city=Paris" "/sources?city=Thessaloniki" "/famous?city=Paris"; do
  echo "== $path"; curl -s -m 60 -o /tmp/h.out -w "HTTP %{http_code} in %{time_total}s\n" -H "Origin: $O" "$U$path"; head -c 400 /tmp/h.out; echo
done
