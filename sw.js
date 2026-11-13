// Kairoute offline support: keep the app and its fonts on the device so it opens with no signal.
const CACHE = "kairoute-v3";
const KEEP = /^kairoute-maps-/; // the map store (tiles and label fonts) is managed by the app and survives app updates
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icons/web-192.png", "./icons/web-512.png", "./icons/apple-touch-icon-180.png", "./lib/maplibre-gl.js", "./lib/maplibre-gl.css"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && !KEEP.test(k)).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.endsWith("/version.txt")) return; // always ask the network, so new versions are noticed
  // The app page: try the network first so updates arrive, fall back to the saved copy offline.
  if (req.mode === "navigate" || (url.origin === location.origin && url.pathname.endsWith("/index.html"))) {
    // "no-cache" checks with the server every time, so a copy the browser kept from an earlier visit is never shown once a new version is out.
    e.respondWith(fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); return r; }).catch(() => caches.match("./index.html")));
    return;
  }
  // Fonts, icons and other files: use the saved copy, refresh it in the background.
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
