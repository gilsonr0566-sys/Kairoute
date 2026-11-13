#!/bin/sh
# Builds index.html for the website from src/. The page head (doctype, viewport, home-screen tags)
# lives here because the Claude preview adds its own.
set -e
cd "$(dirname "$0")"
V="$(git rev-parse --short HEAD 2>/dev/null || date +%s)-$(date +%s)"
{
  printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  printf '<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="icons/favicon.svg" type="image/svg+xml">\n<link rel="icon" href="icons/favicon-32.png" sizes="32x32">\n<link rel="apple-touch-icon" href="icons/apple-touch-icon-180.png">\n'
  printf '<meta name="theme-color" content="#123C3A">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="Kairoute">\n'
  cat src/shell.html; printf '\n<script>\n'; cat src/data.js src/cities1.js src/cities2.js src/cities3.js src/cities4.js; printf '\n</script>\n<script>\n'; cat src/main.js src/features/*.js src/end.js; printf '\n</script>\n'
  printf '<script>if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));</script>\n'
  # When a newer version is published, switch to it: on opening, on coming back to the app, and every 5 minutes while open (never mid-tour).
  printf '<script>(function(){var B="%s";function busy(){return document.body&&document.body.classList.contains("touring-on")}function chk(){if(location.protocol!=="https:"||document.visibilityState!=="visible")return;fetch("version.txt",{cache:"no-store"}).then(function(r){return r.ok?r.text():""}).then(function(t){t=t.trim();if(!t||t===B||busy())return;var k="kairoute.reloadedTo",s="";try{s=sessionStorage.getItem(k)||"";sessionStorage.setItem(k,t)}catch(e){}if(s===t){var u=new URL(location.href);if(u.searchParams.get("v")===t)return;u.searchParams.set("v",t);location.replace(u.href)}else location.reload()}).catch(function(){})}addEventListener("load",chk);addEventListener("pageshow",function(e){if(e.persisted)chk()});addEventListener("focus",chk);document.addEventListener("visibilitychange",chk);setInterval(chk,300000)})();</script>\n' "$V"
} > index.html
printf '%s\n' "$V" > version.txt
