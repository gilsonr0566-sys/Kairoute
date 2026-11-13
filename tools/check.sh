#!/bin/sh
# Stops a broken build from going live: fails if the app's code uses any name that isn't defined
# (for example a function that was deleted by mistake).
set -e
cd "$(dirname "$0")/.."
cat src/data.js src/cities1.js src/cities2.js src/cities3.js src/cities4.js src/main.js src/features/*.js src/end.js > /tmp/kairoute-all.js
npx -y eslint@8 --no-eslintrc --env browser,es2022 --parser-options=ecmaVersion:2022 \
  --rule 'no-undef:error' --global jspdf,Capacitor /tmp/kairoute-all.js
node --check worker/worker.js
# Phones only play audio that starts from a tap, so the natural voice must claim the tap before its first await.
node -e 'const s=require("fs").readFileSync("src/main.js","utf8");const i=s.indexOf("async function speakNatural(");const head=s.slice(i,s.indexOf("await",i));if(i<0||!/natAudio\.src = SILENT/.test(head)||!/kairouteSound\(\)/.test(head)){console.error("speakNatural must unlock audio (SILENT + kairouteSound) before its first await");process.exit(1)}'
echo "Code check passed"
