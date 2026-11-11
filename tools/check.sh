#!/bin/sh
# Stops a broken build from going live: fails if the app's code uses any name that isn't defined
# (for example a function that was deleted by mistake).
set -e
cd "$(dirname "$0")/.."
cat src/data.js src/cities1.js src/cities2.js src/cities3.js src/cities4.js src/main.js > /tmp/kairoute-all.js
npx -y eslint@8 --no-eslintrc --env browser,es2022 --parser-options=ecmaVersion:2022 \
  --rule 'no-undef:error' --global jspdf,Capacitor /tmp/kairoute-all.js
node --check worker/worker.js
echo "Code check passed"
