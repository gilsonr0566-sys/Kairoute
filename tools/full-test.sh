#!/bin/bash
# Full test pass: one command runs every check Kairoute has that works on a test machine, then re-runs each
# failure once alone (a pass alone = the busy machine, not a bug) and writes test-results/full/summary.json + DONE.
# Usage: bash tools/full-test.sh            (all)      ONLY="plan-test safety-net" bash tools/full-test.sh  (some)
# Run detached for a long pass:  nohup bash tools/full-test.sh > /tmp/full.log 2>&1 &   then wait for test-results/full/DONE
# Not here (needs a real device): tour-audio.cjs (headless browsers have no speech voices).
# Never publishes, never commits. Built index.html / version.txt are put back to the placeholder at the end.
cd "$(dirname "$0")/.."
OUT=test-results/full; [ -n "$ONLY" ] && OUT=test-results/only; mkdir -p "$OUT"; find "$OUT" -mindepth 1 -delete; mkdir -p "$OUT/logs"  # outside checks/: the safety net clears checks/
T0=$(date +%s); LIMIT=${LIMIT:-1500}   # seconds per test file
# name | category | command   (categories: functional data security compat ux; "-half" = suggestion-only, counts at half weight)
TESTS=$(cat <<'LIST'
code-check|security|sh tools/check.sh
static-check|security|node tools/static-check.cjs
worker-check|security|node tools/worker-check.mjs
inject-check|security|node tools/inject-check.cjs
stress-check|security|node tools/stress-check.cjs
plan-test|data|node tools/plan-test.cjs
ferry-unit|data|node tools/ferry-unit.mjs
time-check|data|node tools/time-check.cjs
ship-check|data|node tools/ship-check.cjs
voyage-check|data|node tools/voyage-check.cjs
ride-check|data|node tools/ride-check.cjs
extras-check|data|node tools/extras-check.cjs index.html checks/extras
offline-sights|data|node tools/offline-sights.cjs
later-check|data|node tools/later-check.cjs
live-check|data|node tools/live-check.cjs
safety-net|functional|node tools/safety-net.cjs
clicktest|functional|node tools/clicktest.cjs http://localhost:8765/ phone,tablet 2
menu-check|functional|node tools/menu-check.cjs
ready-check|functional|node tools/ready-check.cjs
reorder-check|functional|node tools/reorder-check.cjs
hours-check|functional|node tools/hours-check.cjs
anchor-e2e|functional|node tools/anchor-e2e.cjs
addplace-e2e|functional|node tools/addplace-e2e.cjs
map-e2e|functional|env MOCK=1 node tools/map-e2e.cjs
nav-check|compat|node tools/nav-check.cjs
layout-check|compat|node tools/layout-check.cjs
offline-e2e|compat|node tools/offline-e2e.cjs
seen-check|compat|node tools/seen-check.cjs
steady-check|compat|env URL=http://localhost:8765/ node tools/steady-check.cjs
perf-check|compat|node tools/perf-check.cjs . --json checks/speed.json
freeze-probe|compat|node tools/freeze-probe.cjs . --cpu 4 --device phone --replay tools/fixtures/net-live.json.gz --gate --max-freeze 3000
pill-check|ux|node tools/pill-check.cjs
text-check|ux|node tools/text-check.cjs
a11y-check|ux|node tools/a11y-check.cjs
contrast-check|ux-half|env CONTRAST=1 node tools/a11y-check.cjs
LIST
)
sh build.sh
# The storybook PDF check needs jsPDF; test machines without the CDN get the same version from npm (kept in test-results/cache).
mkdir -p test-results/cache; JS=test-results/cache/jspdf.umd.min.js
if [ ! -s "$JS" ]; then ( cd test-results/cache && npm pack -q jspdf@2.5.1 >/dev/null 2>&1 && tar xzf jspdf-2.5.1.tgz -O package/dist/jspdf.umd.min.js > jspdf.umd.min.js ); fi
[ -s "$JS" ] && export JSPDF_FILE="$PWD/$JS"
python3 -m http.server 8765 >/dev/null 2>&1 & SRV=$!; sleep 1
run() { # name cmd -> exit code, log in $OUT/logs/name[.again].log
  local s=$(date +%s); timeout "$LIMIT" bash -c "$2" > "$OUT/logs/$1$3.log" 2>&1; local rc=$?
  echo "$rc $(( $(date +%s) - s ))"; }
echo "[" > "$OUT/results.json.part"; FIRST=1
while IFS='|' read -r name cat cmd; do
  [ -z "$name" ] && continue
  if [ -n "$ONLY" ] && ! [[ " $ONLY " == *" $name "* ]]; then continue; fi
  read rc secs < <(run "$name" "$cmd" "")
  again=""; againrc=""
  if [ "$rc" != 0 ]; then read againrc asecs < <(run "$name" "$cmd" ".again"); fi
  status=pass; [ "$rc" != 0 ] && { [ "$againrc" = 0 ] && status=flaky || status=fail; }
  [ "$rc" = 124 ] && [ "$againrc" != 0 ] && status=timeout
  printf '%s %-16s %-10s %s (%ss)\n' "$( [ $status = pass ] && echo ok || echo '!!')" "$name" "$cat" "$status" "$secs"
  [ $FIRST = 1 ] || echo "," >> "$OUT/results.json.part"; FIRST=0
  printf '{"name":"%s","cat":"%s","status":"%s","rc":%s,"rerun":"%s","secs":%s}' "$name" "$cat" "$status" "$rc" "$againrc" "$secs" >> "$OUT/results.json.part"
done <<< "$TESTS"
echo "]" >> "$OUT/results.json.part"; mv "$OUT/results.json.part" "$OUT/results.json"
kill $SRV 2>/dev/null
git checkout -- index.html version.txt 2>/dev/null
node -e '
const r=require("./'"$OUT"'/results.json"), cats={functional:30,data:25,security:20,compat:15,ux:10}, s={};
const w=t=>/-half$/.test(t.cat)?0.5:1, good=t=>t.status==="pass"||t.status==="flaky";
for (const c in cats) { const x=r.filter(t=>t.cat.replace(/-half$/,"")===c), run=x.reduce((a,t)=>a+w(t),0), ok=x.filter(good).reduce((a,t)=>a+w(t),0); s[c]={max:cats[c],run,passed:ok,raw:run?+(cats[c]*ok/run).toFixed(2):cats[c]}; }
require("fs").writeFileSync("'"$OUT"'/summary.json", JSON.stringify({finished:new Date().toISOString(),minutes:Math.round(('"$(date +%s)"'-'"$T0"')/60),cats:s,fails:r.filter(t=>t.status!=="pass"&&t.status!=="flaky").map(t=>t.name),flaky:r.filter(t=>t.status==="flaky").map(t=>t.name)},null,1));
console.log(JSON.stringify(s));'
date -u +%FT%TZ > "$OUT/DONE"
