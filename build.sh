#!/bin/sh
# Combines src/shell.html + src/data.js + src/main.js into index.html (the whole app is one page).
cd "$(dirname "$0")"
{ cat src/shell.html; printf '\n<script>\n'; cat src/data.js; printf '\n</script>\n<script>\n'; cat src/main.js; printf '\n</script>\n'; } > index.html
