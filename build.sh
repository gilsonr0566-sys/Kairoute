#!/bin/sh
# Builds index.html for the website from src/. The page head (doctype, viewport, home-screen tags)
# lives here because the Claude preview adds its own.
set -e
cd "$(dirname "$0")"
{
  printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  printf '<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="icons/favicon.svg" type="image/svg+xml">\n<link rel="icon" href="icons/favicon-32.png" sizes="32x32">\n<link rel="apple-touch-icon" href="icons/apple-touch-icon-180.png">\n'
  printf '<meta name="theme-color" content="#123C3A">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="Kairoute">\n'
  cat src/shell.html; printf '\n<script>\n'; cat src/data.js src/cities1.js src/cities2.js src/cities3.js src/cities4.js; printf '\n</script>\n<script>\n'; cat src/main.js; printf '\n</script>\n'
  printf '<script>if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));</script>\n'
} > index.html
