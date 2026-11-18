#!/bin/sh
# CI only: start the test stand-in for the live AI helper (tools/helper-proxy.mjs) and point this checkout's ai.json
# at it, so the tests' repeat asks never reach the live helper. Put ai.json back with: git checkout -- ai.json
nohup node tools/helper-proxy.mjs 8788 > helper-proxy.log 2>&1 &
for i in 1 2 3 4 5 6 7 8 9 10; do curl -s -o /dev/null http://localhost:8788/workers.dev/ && break; sleep 0.5; done
printf '{"url":"http://localhost:8788/workers.dev"}\n' > ai.json
echo "Tests use the helper stand-in: $(cat ai.json)"
